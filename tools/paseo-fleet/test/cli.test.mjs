import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { isolatedHome } from './isolated-home.mjs';

const env = { ...process.env, HOME: isolatedHome, USERPROFILE: isolatedHome };

describe('Fleet CLI binary', () => {
  it('prints help message', () => {
    const output = execSync('node bin/fleet.js help', { encoding: 'utf8', env });
    assert.match(output, /paseo-fleet/);
    assert.match(output, /USAGE:/);
  });

  it('runs init and status commands', () => {
    const initOutput = execSync('node bin/fleet.js init', { encoding: 'utf8', env });
    assert.match(initOutput, /initialized successfully/);

    const statusOutput = execSync('node bin/fleet.js status', { encoding: 'utf8', env });
    assert.match(statusOutput, /Paseo Fleet Status/);
  });

  it('manages coordinator and channels via cli', () => {
    execSync('node bin/fleet.js coordinator set test-coord-42', { encoding: 'utf8', env });
    const getOutput = execSync('node bin/fleet.js coordinator get', { encoding: 'utf8', env });
    assert.match(getOutput, /test-coord-42/);

    execSync('node bin/fleet.js channel add custom-hook --tool hook_send --type webhook', {
      encoding: 'utf8',
      env,
    });
    const lsOutput = execSync('node bin/fleet.js channel ls', { encoding: 'utf8', env });
    assert.match(lsOutput, /custom-hook/);

    execSync('node bin/fleet.js channel rm custom-hook', { encoding: 'utf8', env });
    const lsAfter = execSync('node bin/fleet.js channel ls', { encoding: 'utf8', env });
    assert.doesNotMatch(lsAfter, /custom-hook/);
  });

  it('generates test-event in dry-run mode', () => {
    const output = execSync('node bin/fleet.js test-event --channel test-ch --dry-run', {
      encoding: 'utf8',
      env,
    });
    assert.match(output, /Generated Event Envelope:/);
    assert.match(output, /test-ch/);
    assert.match(output, /test_ping/);
  });
});

describe('Fleet CLI validate command', () => {
  it('accepts a valid envelope and rejects an invalid one', () => {
    const valid = JSON.stringify({
      protocol: 'paseo-fleet/v1',
      id: 'evt_1',
      source: 'teams',
      event_type: 'mention',
      content: 'hello',
      reply_action: { type: 'none' },
    });
    const accepted = execSync('node bin/fleet.js validate -', { encoding: 'utf8', env, input: valid });
    assert.match(accepted, /Valid event envelope/);

    assert.throws(
      () =>
        execSync('node bin/fleet.js validate -', {
          encoding: 'utf8',
          env,
          input: '{"protocol":"other"}',
          stdio: 'pipe',
        }),
      /Invalid protocol/,
    );
  });

  it('shows adapters generically in status', () => {
    execSync('node bin/fleet.js init', { encoding: 'utf8', env });
    const config = JSON.stringify({ adapters: ['teams-not-installed'] });
    const status = execSync(
      `node -e "require('node:fs').writeFileSync(process.env.HOME + '/.config/paseo/fleet/config.json', process.argv[1])" '${config}' && node bin/fleet.js status`,
      { encoding: 'utf8', env },
    );
    assert.match(status, /teams-not-installed daemon: Stopped/);
  });
});
