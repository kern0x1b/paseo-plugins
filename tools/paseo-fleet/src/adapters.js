import { execFileSync, spawn } from 'node:child_process';
import { DEFAULT_ADAPTERS } from './sweep.js';

export const DEFAULT_DAEMON_ARGS = { gitlab: ['--all-hours'] };

export function resolveAdapters(config) {
  return config.adapters || DEFAULT_ADAPTERS;
}

function daemonArgsFor(adapter, config) {
  return (config.adapterDaemonArgs || DEFAULT_DAEMON_ARGS)[adapter] || [];
}

function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
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

export function readDaemonStatus(adapter) {
  try {
    const output = execFileSync(adapter, ['daemon', 'status'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const status = JSON.parse(output);
    if (status && status.running && status.pid && isPidAlive(status.pid)) {
      return { running: true, pid: status.pid };
    }
  } catch {}
  return { running: false, pid: null };
}

export function startDaemon(adapter, config) {
  const child = spawn(adapter, ['daemon', ...daemonArgsFor(adapter, config)], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return child.pid;
}

export function stopDaemon(adapter) {
  return runQuietly(adapter, ['daemon', 'stop']);
}
