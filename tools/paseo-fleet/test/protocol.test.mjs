import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PROTOCOL_VERSION,
  createEventEnvelope,
  validateEventEnvelope,
  validateSnapshotDocument,
} from '../src/protocol.js';

describe('Paseo Fleet Protocol', () => {
  it('creates a standard event envelope', () => {
    const envelope = createEventEnvelope({
      source: 'slack',
      event_type: 'mention',
      content: 'Hello fleet',
      reply_action: {
        type: 'mcp',
        tool: 'slack_send_message',
        params: { channel: 'C123' },
      },
    });

    assert.equal(envelope.protocol, PROTOCOL_VERSION);
    assert.equal(envelope.source, 'slack');
    assert.equal(envelope.event_type, 'mention');
    assert.equal(envelope.content, 'Hello fleet');
    assert.ok(envelope.id.startsWith('evt_'));
    assert.ok(envelope.timestamp);
    assert.equal(envelope.reply_action.tool, 'slack_send_message');
  });

  it('validates a correct envelope', () => {
    const envelope = createEventEnvelope({
      source: 'gitlab',
      instance: 'https://gitlab.corp.net',
      scope: 'core/backend',
      urn: 'urn:gitlab:gitlab.corp.net:core/backend:issue:42',
      event_type: 'pipeline_failed',
      content: 'CI failure',
    });

    assert.equal(envelope.instance, 'https://gitlab.corp.net');
    assert.equal(envelope.scope, 'core/backend');
    assert.equal(envelope.urn, 'urn:gitlab:gitlab.corp.net:core/backend:issue:42');

    const result = validateEventEnvelope(envelope);
    assert.equal(result.valid, true);
  });

  it('rejects an envelope with missing required fields', () => {
    assert.equal(validateEventEnvelope(null).valid, false);
    assert.equal(validateEventEnvelope({}).valid, false);
    assert.equal(
      validateEventEnvelope({
        protocol: 'invalid/v99',
        id: '1',
        source: 's',
        event_type: 'e',
        content: 'c',
        reply_action: {},
      }).valid,
      false,
    );
  });

  it('throws when creating envelope without required properties', () => {
    assert.throws(() => createEventEnvelope({}), /source is required/);
    assert.throws(() => createEventEnvelope({ source: 'slack' }), /event_type is required/);
    assert.throws(() => createEventEnvelope({ source: 'slack', event_type: 'dm' }), /content is required/);
  });
});

describe('Snapshot document validation', () => {
  const item = () => ({
    ...createEventEnvelope({
      source: 'teams',
      event_type: 'unanswered_dm',
      content: 'Can you review this?',
      reply_action: { type: 'mcp', tool: 'teams_send_message', params: { chat_id: '19:abc' } },
    }),
    snapshot: { reasons: ['unanswered_dm'], state: { messageCount: 2 } },
  });
  const document = (overrides = {}) => ({
    protocol: PROTOCOL_VERSION,
    source: 'teams',
    generated_at: '2026-10-26T08:00:00.000Z',
    items: [item()],
    errors: [],
    ...overrides,
  });

  it('accepts a well-formed snapshot', () => {
    assert.deepEqual(validateSnapshotDocument(document()), { valid: true });
  });

  it('accepts an empty snapshot with a failing source reported', () => {
    const result = validateSnapshotDocument(
      document({ items: [], errors: [{ source: 'chats', error: 'Graph API error 503' }] }),
    );
    assert.equal(result.valid, true);
  });

  it('rejects an item without snapshot reasons', () => {
    const broken = { ...item(), snapshot: { reasons: [] } };
    const result = validateSnapshotDocument(document({ items: [broken] }));
    assert.equal(result.valid, false);
    assert.match(result.error, /items\[0\].*reasons/);
  });

  it('rejects an item that is not a valid envelope', () => {
    const broken = { ...item(), reply_action: undefined };
    const result = validateSnapshotDocument(document({ items: [broken] }));
    assert.equal(result.valid, false);
    assert.match(result.error, /items\[0\].*reply_action/);
  });
});
