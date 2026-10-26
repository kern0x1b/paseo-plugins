#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import {
  ensureFleetDir,
  getConfigPath,
  getChannelsPath,
  loadConfig,
  saveConfig,
  loadChannels,
  addChannel,
  removeChannel,
} from '../src/config.js';
import {
  bindCoordinator,
  readDaemonStatus,
  resolveAdapters,
  startDaemon,
  stopDaemon,
  unbindCoordinator,
} from '../src/adapters.js';
import { createEventEnvelope, validateEventEnvelope, validateSnapshotDocument } from 'paseo-fleet-kit';
import { parseSince, resolveSweepSince, runSweep } from '../src/sweep.js';

const args = process.argv.slice(2);
const command = args[0] || 'help';

function parseFlags(rawArgs) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (rawArgs[i + 1] && !rawArgs[i + 1].startsWith('--')) {
        flags[key] = rawArgs[i + 1];
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

function printHelp() {
  console.log(`
paseo-fleet (fleet) - Model-agnostic Multi-Agent Fleet Orchestration & Protocol

USAGE:
  fleet <command> [subcommand] [options...]

COMMANDS:
  init                             Initialize fleet configuration directories and channels file
  coordinator set <agent-id>       Set active fleet coordinator agent ID globally
  coordinator get                  Show current fleet coordinator agent ID
  coordinator clear                Clear current coordinator agent ID
  channel add <name> [options]     Register a push channel provider
                                   Options: --tool <name> --cli <cmd> --type <chat|forge>
                                            --instance <host|team> --scope <repo|channel>
                                            --desc <text> --primary
  channel rm <name>                Remove a registered push channel
  channel ls                       List all registered push channels
  status                           Show coordinator liveness and registered channel health
  test-event [options]             Dispatch a synthetic test event envelope to the coordinator
                                   Options: --channel <name> --instance <id> --scope <id> --dry-run
  activate [agent-id]              Self-activate current agent ($PASEO_AGENT_ID) as coordinator and start daemons
  sweep                            Collect everything currently waiting on you from every adapter as one JSON queue
                                   Options: --since <iso|24h|3d> (default: since the last sweep, at least 24h back;
                                            72h on the first run) --adapters <a,b> --no-cursor
  validate [file|-]                Check an event envelope or a snapshot document (stdin by default)
                                   against the protocol; exit code 1 when invalid
  stop                             Stop all background fleet push daemons
  help                             Show this manual

EXAMPLES:
  fleet init
  fleet activate
  fleet coordinator set afe3e85b-e376-4b7f-a10b-5970ced5b432
  fleet channel add slack:work --tool slack_send_message --cli "slack send" --type chat --instance T01WORK --scope C01DEV --primary
  fleet channel add gitlab:corp --tool gitlab_create_issue_note --cli "gitlab comment" --type forge --instance https://gitlab.corp.net --scope core/backend
  fleet status
  fleet sweep
  fleet sweep --since 3d --adapters gitlab
  fleet test-event --channel slack:work
`);
}

async function main() {
  const { flags, positional } = parseFlags(args.slice(1));

  try {
    switch (command) {
      case 'init': {
        ensureFleetDir();
        console.log(`Fleet environment initialized successfully.`);
        console.log(`Config:   ${getConfigPath()}`);
        console.log(`Channels: ${getChannelsPath()}`);
        break;
      }

      case 'start':
      case 'activate': {
        let id = positional[0] || process.env.PASEO_AGENT_ID;
        if (!id) {
          const cfg = loadConfig();
          id = cfg.coordinatorAgentId;
        }
        if (!id) {
          console.error(
            'Error: cannot resolve coordinator agent ID. Run within Paseo or specify: fleet activate <agent-id>',
          );
          process.exit(1);
        }

        saveConfig({ coordinatorAgentId: id });
        console.log(`Coordinator agent ID set to: ${id}`);

        const config = loadConfig();
        for (const adapter of resolveAdapters(config)) {
          if (bindCoordinator(adapter, id)) {
            console.log(`Bound to ${adapter} daemon.`);
          }
          const status = readDaemonStatus(adapter);
          if (status.running) {
            console.log(`${adapter} daemon is already running (PID ${status.pid}).`);
            continue;
          }
          try {
            console.log(`Started ${adapter} daemon in background (PID ${startDaemon(adapter, config)}).`);
          } catch (err) {
            console.error(`Failed to start ${adapter} daemon: ${err.message}`);
          }
        }

        const manifest = loadChannels();
        const active = Object.keys(manifest.channels || {});
        console.log(`Fleet Coordinator successfully activated!`);
        console.log(`Active channels: ${active.join(', ') || 'none'}`);
        console.log(`Listening for inbound events.`);
        console.log(`Next: run 'fleet sweep' to collect work that was already waiting before activation.`);
        break;
      }

      case 'sweep': {
        const config = loadConfig();
        const since = flags.since
          ? parseSince(flags.since)
          : resolveSweepSince({ lastSweepAt: config.lastSweepAt });
        const adapters = flags.adapters ? flags.adapters.split(',') : resolveAdapters(config);
        const sweep = await runSweep({ adapters, since });
        if (!flags['no-cursor'] && sweep.sources.some((source) => source.ok)) {
          saveConfig({ lastSweepAt: sweep.started_at });
        }
        console.log(JSON.stringify(sweep, null, 2));
        break;
      }

      case 'stop':
      case 'deactivate': {
        for (const adapter of resolveAdapters(loadConfig())) {
          if (stopDaemon(adapter)) {
            console.log(`Stopped ${adapter} daemon.`);
          }
          unbindCoordinator(adapter);
        }
        saveConfig({ coordinatorAgentId: null });

        console.log(`Fleet daemons stopped and coordinator cleared.`);
        break;
      }

      case 'coordinator': {
        const sub = positional[0] || 'get';
        if (sub === 'set') {
          let id = positional[1];
          if (!id || id === 'self') {
            id = process.env.PASEO_AGENT_ID;
          }
          if (!id) {
            console.error('Error: missing agent ID. Usage: fleet coordinator set <agent-id>');
            process.exit(1);
          }
          saveConfig({ coordinatorAgentId: id });
          console.log(`Coordinator agent ID set to: ${id}`);

          for (const adapter of resolveAdapters(loadConfig())) {
            if (bindCoordinator(adapter, id)) {
              console.log(`Bound to ${adapter} daemon.`);
            }
          }
        } else if (sub === 'clear') {
          saveConfig({ coordinatorAgentId: null });
          console.log('Coordinator agent ID cleared.');
        } else if (sub === 'get') {
          const config = loadConfig();
          console.log(config.coordinatorAgentId ? config.coordinatorAgentId : 'No coordinator set.');
        } else {
          console.error(`Unknown subcommand: ${sub}`);
          process.exit(1);
        }
        break;
      }

      case 'channel': {
        const sub = positional[0] || 'ls';
        if (sub === 'add') {
          const name = positional[1];
          if (!name) {
            console.error('Error: missing channel name. Usage: fleet channel add <name> [options]');
            process.exit(1);
          }
          const manifest = addChannel(name, {
            type: flags.type || 'chat',
            mcp_tool: flags.tool || null,
            cli_command: flags.cli || null,
            instance: flags.instance || null,
            scope: flags.scope || null,
            description: flags.desc || flags.description || null,
            is_primary: Boolean(flags.primary),
          });
          console.log(`Channel '${name}' registered successfully.`);
          if (flags.primary) {
            console.log(`Set as primary notification channel.`);
          }
        } else if (sub === 'rm') {
          const name = positional[1];
          if (!name) {
            console.error('Error: missing channel name. Usage: fleet channel rm <name>');
            process.exit(1);
          }
          removeChannel(name);
          console.log(`Channel '${name}' removed.`);
        } else if (sub === 'ls') {
          const manifest = loadChannels();
          const channels = manifest.channels || {};
          const keys = Object.keys(channels);
          console.log(`Primary Channel: ${manifest.primary_channel || 'none'}`);
          console.log(`Registered Channels (${keys.length}):`);
          for (const key of keys) {
            const ch = channels[key];
            const star = manifest.primary_channel === key ? ' [primary]' : '';
            const details = [];
            if (ch.instance) details.push(`instance=${ch.instance}`);
            if (ch.scope) details.push(`scope=${ch.scope}`);
            if (ch.mcp_tool) details.push(`tool=${ch.mcp_tool}`);
            if (ch.cli_command) details.push(`cli=${ch.cli_command}`);
            const detailStr = details.length > 0 ? `, ${details.join(', ')}` : '';
            console.log(`- ${key}${star}: type=${ch.type}${detailStr}`);
          }
        } else {
          console.error(`Unknown subcommand: ${sub}`);
          process.exit(1);
        }
        break;
      }

      case 'status': {
        const config = loadConfig();
        const manifest = loadChannels();
        const keys = Object.keys(manifest.channels || {});
        console.log(`Paseo Fleet Status`);
        console.log(`------------------`);
        console.log(`Coordinator Agent: ${config.coordinatorAgentId || 'Not configured'}`);
        console.log(`Primary Channel:   ${manifest.primary_channel || 'Not configured'}`);
        console.log(`Active Channels:   ${keys.length > 0 ? keys.join(', ') : 'None registered'}`);
        for (const adapter of resolveAdapters(config)) {
          const status = readDaemonStatus(adapter);
          console.log(`${adapter} daemon: ${status.running ? `Running (PID ${status.pid})` : 'Stopped'}`);
        }
        break;
      }

      case 'test-event': {
        const config = loadConfig();
        if (!config.coordinatorAgentId && !flags['dry-run']) {
          console.error('Error: No coordinator configured. Set one via: fleet coordinator set <id>');
          process.exit(1);
        }

        const channel = flags.channel || 'synthetic';
        const envelope = createEventEnvelope({
          source: channel,
          instance: flags.instance || null,
          scope: flags.scope || null,
          event_type: 'test_ping',
          content: 'Synthetic test event: verifying fleet connectivity',
          reply_action: {
            type: 'none',
          },
        });

        console.log('Generated Event Envelope:');
        console.log(JSON.stringify(envelope, null, 2));

        if (!flags['dry-run']) {
          execSync(
            `paseo send ${config.coordinatorAgentId} ${JSON.stringify(JSON.stringify(envelope))} --no-wait`,
            { stdio: 'inherit' },
          );
          console.log(`Dispatched to Coordinator (${config.coordinatorAgentId}).`);
        }
        break;
      }

      case 'validate': {
        const source = positional[0];
        const raw = source && source !== '-' ? fs.readFileSync(source, 'utf8') : fs.readFileSync(0, 'utf8');
        const document = JSON.parse(raw);
        const result = Array.isArray(document.items)
          ? validateSnapshotDocument(document)
          : validateEventEnvelope(document);
        if (!result.valid) {
          console.error(`Invalid: ${result.error}`);
          process.exit(1);
        }
        console.log(Array.isArray(document.items) ? 'Valid snapshot document.' : 'Valid event envelope.');
        break;
      }

      case 'help':
      default:
        printHelp();
        break;
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
