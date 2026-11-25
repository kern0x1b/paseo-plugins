import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { isolatedHome } from './isolated-home.mjs';

const env = { ...process.env, HOME: isolatedHome, USERPROFILE: isolatedHome, PASEO_AGENT_ID: '' };

function writeConfig(config) {
  const script =
    "require('node:fs').writeFileSync(process.env.HOME + '/.config/paseo/fleet/config.json', process.argv[1])";
  execSync(`mkdir -p "$HOME/.config/paseo/fleet" && node -e "${script}" '${JSON.stringify(config)}'`, {
    encoding: 'utf8',
    env,
  });
}

function run(args, extraEnv = {}) {
  return spawnSync('node', ['bin/channels.js', ...args], { encoding: 'utf8', env: { ...env, ...extraEnv } });
}

describe('channels CLI binary', () => {
  it('prints the manual with the five commands and none of the removed ones', () => {
    const result = run(['help']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /USAGE:/);
    for (const command of ['on [agent-id]', 'off', 'status', 'sweep', 'help']) {
      assert.match(result.stdout, new RegExp(command.replace(/[[\]]/g, '\\$&')));
    }
    assert.doesNotMatch(result.stdout, /init|coordinator set|validate|test-event|channel add/);
  });

  it('turns the receiver session on for a given agent and off again, with no adapters to bind', () => {
    writeConfig({ adapters: [] });

    const on = run(['on', 'receiver-agent-42']);
    assert.equal(on.status, 0, on.stderr);
    assert.match(on.stdout, /Receiver session set to: receiver-agent-42/);
    assert.match(on.stdout, /Receiver session is on/);

    const status = run(['status']);
    assert.equal(status.status, 0);
    assert.match(status.stdout, /Channels Status/);
    assert.match(status.stdout, /Receiver session: receiver-agent-42/);

    const off = run(['off']);
    assert.equal(off.status, 0, off.stderr);
    assert.match(off.stdout, /Receiver session is off/);
    assert.match(run(['status']).stdout, /Receiver session: Not set/);
  });

  it('takes the receiver session from PASEO_AGENT_ID when no agent is given', () => {
    writeConfig({ adapters: [] });
    const on = run(['on'], { PASEO_AGENT_ID: 'env-agent-7' });
    assert.equal(on.status, 0, on.stderr);
    assert.match(on.stdout, /Receiver session set to: env-agent-7/);
    run(['off']);
  });

  it('refuses `on` when no agent can be resolved', () => {
    writeConfig({ adapters: [] });
    const result = run(['on']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /cannot resolve the receiver session/);
  });

  it('shows adapters generically in status', () => {
    writeConfig({ adapters: ['teams-not-installed'] });
    const result = run(['status']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /teams-not-installed plugin: /);
  });

  it('sweeps every named adapter, reports the missing one in the document and keeps the cursor', () => {
    writeConfig({ adapters: [] });
    const result = run(['sweep', '--adapters', 'no-such-adapter-for-test']);
    assert.equal(result.status, 0, result.stderr);
    const sweep = JSON.parse(result.stdout);
    assert.equal(sweep.format, 'paseo-channel/v1');
    assert.equal(sweep.kind, 'sweep');
    assert.deepEqual(sweep.sources, [{ adapter: 'no-such-adapter-for-test', ok: false, items: 0 }]);
    assert.equal(sweep.errors[0].source, 'no-such-adapter-for-test');
    assert.equal(
      JSON.parse(execSync(`cat "$HOME/.config/paseo/fleet/config.json"`, { encoding: 'utf8', env }))
        .lastSweepAt,
      undefined,
    );
  });

  it('exits 1 with the reason on stderr for an unknown or removed command', () => {
    for (const command of [
      'init',
      'activate',
      'stop',
      'coordinator',
      'channel',
      'test-event',
      'validate',
      'fleet',
    ]) {
      const result = run([command]);
      assert.equal(result.status, 1, command);
      assert.equal(result.stdout, '', command);
      assert.match(result.stderr, new RegExp(`unknown command '${command}'`), command);
    }
  });
});
