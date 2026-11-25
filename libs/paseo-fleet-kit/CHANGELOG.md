# Changelog

All notable changes to this library are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- First version: protocol helpers moved from `paseo-fleet`, plus `BaseSubscriptionRegistry`, `BaseEventDispatcher`, `createDaemonStateStore`, JSON file helpers and a `testing` entry point, extracted from the duplicated code in `paseo-slack` and `paseo-gitlab`.

### Changed

- Events are `{ content, meta }` in the shape Claude Code Channels use. `createChannelEvent` and `validateChannelEvent` check them, and `renderChannelEvent` writes the `<channel source=… kind=… urn=…>` tag.
- `validateSnapshotDocument` checks the `paseo-channel/v1` format.
- `BaseEventDispatcher` delivers rendered tags: `buildChannelEvent` replaces `buildEnvelope`, and `buildPrompt` and `buildBatchMessage` render the tags.

### Added

- `mergeChannelEventsByUrn`: merges events that share a `meta.urn`.

### Removed

- `createEventEnvelope`, `validateEventEnvelope`, `PROTOCOL_VERSION` and the `reply_action` field.
