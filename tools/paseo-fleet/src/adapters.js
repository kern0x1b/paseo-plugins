import { execFileSync } from 'node:child_process';
import { DEFAULT_ADAPTERS } from './sweep.js';

export function resolveAdapters(config) {
  return config.adapters || DEFAULT_ADAPTERS;
}

function runAdapter(adapter, args) {
  try {
    execFileSync(adapter, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (err) {
    const stderr = err.stderr ? String(err.stderr).trim() : '';
    throw new Error(`${adapter} ${args.join(' ')} failed: ${stderr || err.message}`);
  }
}

export function bindCoordinator(adapter, agentId) {
  runAdapter(adapter, ['set-coordinator', agentId]);
}

export function unbindCoordinator(adapter) {
  runAdapter(adapter, ['unset-coordinator']);
}

export function readRouterStatus(adapter, { paseoBin = 'paseo', run = execFileSync } = {}) {
  const plugins = JSON.parse(
    run(paseoBin, ['plugin', 'ls', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }),
  );
  const plugin = plugins.find((entry) => entry.id === adapter);
  if (!plugin) return { installed: false, running: false, status: 'not installed' };
  return { installed: true, running: plugin.status === 'running', status: plugin.status };
}

export function enableRouter(adapter, { paseoBin = 'paseo', run = execFileSync } = {}) {
  run(paseoBin, ['plugin', 'enable', adapter], { stdio: ['ignore', 'ignore', 'inherit'] });
}
