import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRouterStatus } from '../src/adapters.js';

const pluginList = (plugins) => () => JSON.stringify(plugins);

test('an adapter plugin that runs inside Paseo is reported running', () => {
  const status = readRouterStatus('gitlab', { run: pluginList([{ id: 'gitlab', status: 'running' }]) });
  assert.deepEqual(status, { installed: true, running: true, status: 'running' });
});

test('a disabled or missing adapter plugin is reported as such', () => {
  const run = pluginList([{ id: 'gitlab', status: 'disabled' }]);
  assert.equal(readRouterStatus('gitlab', { run }).status, 'disabled');
  assert.deepEqual(readRouterStatus('slack', { run }), {
    installed: false,
    running: false,
    status: 'not installed',
  });
});
