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
    assert.doesNotMatch(output, /channel add|test-event|validate/);
  });

  it('runs init and status commands', () => {
    const initOutput = execSync('node bin/fleet.js init', { encoding: 'utf8', env });
    assert.match(initOutput, /initialized successfully/);

    const statusOutput = execSync('node bin/fleet.js status', { encoding: 'utf8', env });
    assert.match(statusOutput, /Paseo Fleet Status/);
  });

  it('sets and reads the coordinator', () => {
    execSync('node bin/fleet.js coordinator set test-coord-42', { encoding: 'utf8', env });
    const getOutput = execSync('node bin/fleet.js coordinator get', { encoding: 'utf8', env });
    assert.match(getOutput, /test-coord-42/);
  });

  it('treats the removed commands as unknown and prints the manual', () => {
    for (const command of ['channel ls', 'test-event --dry-run', 'validate -']) {
      const output = execSync(`node bin/fleet.js ${command}`, { encoding: 'utf8', env });
      assert.match(output, /USAGE:/, command);
    }
  });

  it('shows adapters generically in status', () => {
    execSync('node bin/fleet.js init', { encoding: 'utf8', env });
    const config = JSON.stringify({ adapters: ['teams-not-installed'] });
    const status = execSync(
      `node -e "require('node:fs').writeFileSync(process.env.HOME + '/.config/paseo/fleet/config.json', process.argv[1])" '${config}' && node bin/fleet.js status`,
      { encoding: 'utf8', env },
    );
    assert.match(status, /teams-not-installed plugin: /);
  });
});
