#!/usr/bin/env node

import { ensureFleetDir, getConfigPath, loadConfig, saveConfig } from '../src/config.js';
import {
  bindCoordinator,
  enableRouter,
  readRouterStatus,
  resolveAdapters,
  unbindCoordinator,
} from '../src/adapters.js';
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
  init                             Initialize the fleet configuration directory
  coordinator set <agent-id>       Set active fleet coordinator agent ID globally
  coordinator get                  Show current fleet coordinator agent ID
  coordinator clear                Clear current coordinator agent ID
  status                           Show the coordinator and the state of each adapter plugin
  activate [agent-id]              Self-activate current agent ($PASEO_AGENT_ID) as coordinator and enable the adapter plugins
  sweep                            Collect everything currently waiting on you from every adapter as one JSON queue
                                   Options: --since <iso|24h|3d> (default: since the last sweep, at least 24h back;
                                            72h on the first run) --adapters <a,b> --no-cursor
  stop                             Clear the coordinator binding from every adapter
  help                             Show this manual

EXAMPLES:
  fleet init
  fleet activate
  fleet coordinator set afe3e85b-e376-4b7f-a10b-5970ced5b432
  fleet status
  fleet sweep
  fleet sweep --since 3d --adapters gitlab
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
          bindCoordinator(adapter, id);
          console.log(`Bound ${adapter} to the coordinator.`);
          const status = readRouterStatus(adapter);
          if (status.running) {
            console.log(`${adapter} plugin is running inside Paseo.`);
          } else if (status.installed) {
            enableRouter(adapter);
            console.log(`Enabled the ${adapter} plugin.`);
          } else {
            throw new Error(`The ${adapter} plugin is ${status.status}: install it with 'paseo plugin add'.`);
          }
        }

        console.log(`Fleet Coordinator successfully activated!`);
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
          unbindCoordinator(adapter);
        }
        saveConfig({ coordinatorAgentId: null });

        console.log(`Coordinator cleared; events go only to agents with their own subscriptions.`);
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
            bindCoordinator(adapter, id);
            console.log(`Bound ${adapter} to the coordinator.`);
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

      case 'status': {
        const config = loadConfig();
        console.log(`Paseo Fleet Status`);
        console.log(`------------------`);
        console.log(`Coordinator Agent: ${config.coordinatorAgentId || 'Not configured'}`);
        for (const adapter of resolveAdapters(config)) {
          console.log(`${adapter} plugin: ${readRouterStatus(adapter).status}`);
        }
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
