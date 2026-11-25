import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseSince, resolveSweepSince, runSweep } from '../src/sweep.js';

const now = new Date('2026-10-02T12:00:00Z');

function snapshotOf(source, items, errors = []) {
  return {
    format: 'paseo-channel/v1',
    source,
    generated_at: '2026-10-02T12:00:00.000Z',
    items,
    errors,
  };
}

function eventOf(source, urn, content = 'text', extraMeta = {}) {
  return { content, meta: { source, kind: 'dm', urn, ...extraMeta } };
}

describe('Fleet sweep', () => {
  it('parses durations and ISO timestamps for --since', () => {
    assert.equal(parseSince('24h', now).toISOString(), '2026-10-01T12:00:00.000Z');
    assert.equal(parseSince('3d', now).toISOString(), '2026-09-29T12:00:00.000Z');
    assert.equal(parseSince('2026-09-30T08:00:00Z', now).toISOString(), '2026-09-30T08:00:00.000Z');
    assert.throws(() => parseSince('yesterday', now), /Invalid --since/);
  });

  it('looks back at least 24 hours even when the last sweep was recent', () => {
    assert.equal(resolveSweepSince({ now }).toISOString(), '2026-09-29T12:00:00.000Z');
    assert.equal(
      resolveSweepSince({ lastSweepAt: '2026-10-02T11:00:00Z', now }).toISOString(),
      '2026-10-01T12:00:00.000Z',
    );
    assert.equal(
      resolveSweepSince({ lastSweepAt: '2026-09-25T00:00:00Z', now }).toISOString(),
      '2026-09-25T00:00:00.000Z',
    );
  });

  it('merges events with the same urn into one event and keeps every distinct content line', async () => {
    const sweep = await runSweep({
      adapters: ['chat'],
      since: now,
      snapshotRunner: async () =>
        snapshotOf('chat', [
          eventOf('chat', 'urn:chat:1', 'first line'),
          eventOf('chat', 'urn:chat:1', 'first line\nsecond line', { thread_ts: '1.2' }),
          eventOf('chat', 'urn:chat:2', 'other'),
        ]),
    });

    assert.equal(sweep.items.length, 2);
    assert.deepEqual(sweep.items[0], {
      content: 'first line\nsecond line',
      meta: { source: 'chat', kind: 'dm', urn: 'urn:chat:1', thread_ts: '1.2' },
    });
    assert.equal(sweep.items[1].meta.urn, 'urn:chat:2');
  });

  it('reports a failing adapter without losing the others', async () => {
    const calls = [];
    const sweep = await runSweep({
      adapters: ['chat', 'forge'],
      since: now,
      snapshotRunner: async (adapter, since) => {
        calls.push([adapter, since.toISOString()]);
        if (adapter === 'forge') throw new Error('command not found');
        return snapshotOf(
          'chat',
          [eventOf('chat', 'urn:chat:1')],
          [{ source: 'mentions', error: 'rate limited' }],
        );
      },
    });

    assert.deepEqual(calls, [
      ['chat', '2026-10-02T12:00:00.000Z'],
      ['forge', '2026-10-02T12:00:00.000Z'],
    ]);
    assert.equal(sweep.items.length, 1);
    assert.deepEqual(sweep.sources, [
      { adapter: 'chat', ok: true, items: 1 },
      { adapter: 'forge', ok: false, items: 0 },
    ]);
    assert.deepEqual(sweep.errors, [
      { source: 'chat:mentions', error: 'rate limited' },
      { source: 'forge', error: 'command not found' },
    ]);
  });

  it('refuses a snapshot that is not in the channel format instead of reading it', async () => {
    const sweep = await runSweep({
      adapters: ['chat'],
      since: now,
      snapshotRunner: async () => ({ protocol: 'paseo-fleet/v1', source: 'chat', items: [] }),
    });

    assert.deepEqual(sweep.sources, [{ adapter: 'chat', ok: false, items: 0 }]);
    assert.deepEqual(sweep.errors, [{ source: 'chat', error: 'Invalid format: expected paseo-channel/v1' }]);
  });

  it('writes the sweep document in the channel format', async () => {
    const sweep = await runSweep({
      adapters: ['chat'],
      since: now,
      snapshotRunner: async () => snapshotOf('chat', []),
    });
    assert.equal(sweep.format, 'paseo-channel/v1');
    assert.equal(sweep.kind, 'sweep');
    assert.deepEqual(sweep.items, []);
  });
});
