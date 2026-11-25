import './isolated-home.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig, saveConfig } from '../src/config.js';

describe('Fleet Configuration', () => {
  it('loads and saves coordinator config', () => {
    saveConfig({ coordinatorAgentId: 'test-agent-123' });
    const config = loadConfig();
    assert.equal(config.coordinatorAgentId, 'test-agent-123');
  });
});
