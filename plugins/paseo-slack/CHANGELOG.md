# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed

- The `reply_action` field of events and snapshot items. Replies go through the platform's own tool, with the ids from the event meta.

- The polling fallback: a WebSocket that cannot connect is retried and alerted on, never replaced by polling DMs. A failed DM history read, an unreadable config file and a refused token at start now fail instead of being skipped.

### Changed

- Events are delivered as `<channel source="slack" kind=… urn=…>` tags, one per event, with no batch header.
- `slack snapshot` prints a `paseo-channel/v1` document.
- `src/` builds on `paseo-fleet-kit` for subscriptions, dispatching and daemon state files; behaviour and stored files are unchanged.
- Moved into the [paseo-plugins](https://github.com/kern0x1b/paseo-plugins) monorepo as `plugins/paseo-slack`.
- The event router runs inside Paseo as the server part of the `slack` plugin instead of a background `slack daemon` process.

### Added

- `slack snapshot --since <iso>`: direct messages and mentions you have not replied to, grouped per conversation or thread, as one `paseo-channel/v1` document for `channels sweep`.

## 1.1.0 - 2026-10-02

### Added

- Support for the **Paseo Fleet Protocol v1** (`paseo-fleet/v1`) event envelope.
- Multi-workspace disambiguation with `instance` (`teamId`), `scope` (`channelId`), and fully qualified `urn:slack:<team>:<channel>:<ts>`.
- Deterministic `reply_action` mapping directly to `slack_send_message` with channel and thread timestamps.

## 1.0.0 - 2026-10-01

### Added

- Unified Slack CLI (`slack`) with subcommands: `send`, `history`, `thread`, `search`, `react`, `whoami`, `subscribe`, `unsubscribe`, `subscriptions`, `daemon`, `mcp`, `api`, `config`.
- Real-time inbound event router daemon (`slack daemon`) with WebSocket (Socket Mode) support and smart direct polling fallback.
- Fleet Coordinator and agent subscriptions with zero-cost Layer 1 deterministic message filtering.
- Standard stdio Model Context Protocol (MCP) server (`slack mcp`) for AI agents in Paseo, Claude Code, and Antigravity.
- Zero runtime external dependencies: pure Node.js 20+ ESM using native `fetch` and `WebSocket`.
- Comprehensive documentation and AI agent skill (`skills/slack-cli/`).

[Unreleased]: https://github.com/kern0x1b/paseo-plugins/commits/main/plugins/paseo-slack
