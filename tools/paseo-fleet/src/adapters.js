import { execFileSync } from 'node:child_process';
import { DEFAULT_ADAPTERS } from './sweep.js';

export function resolveAdapters(config) {
  return config.adapters || DEFAULT_ADAPTERS;
}

function runQuietly(adapter, args) {
  try {
    execFileSync(adapter, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function bindCoordinator(adapter, agentId) {
  return runQuietly(adapter, ['set-coordinator', agentId]);
}

export function unbindCoordinator(adapter) {
  return runQuietly(adapter, ['unset-coordinator']);
}

export function readRouterStatus(adapter, { paseoBin = 'paseo', run = execFileSync } = {}) {
  try {
    const plugins = JSON.parse(
      run(paseoBin, ['plugin', 'ls', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
    );
    const plugin = plugins.find((entry) => entry.id === adapter);
    if (!plugin) return { installed: false, running: false, status: 'not installed' };
    return { installed: true, running: plugin.status === 'running', status: plugin.status };
  } catch {
    return { installed: false, running: false, status: 'unknown (paseo plugin ls failed)' };
  }
}

export function enableRouter(adapter, { paseoBin = 'paseo', run = execFileSync } = {}) {
  try {
    run(paseoBin, ['plugin', 'enable', adapter], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
