# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Adapter author guide rewritten as the full adapter contract, with a Microsoft Teams mapping.
- `channels sweep`: collects `snapshot` output from every adapter, merges items by `urn`, and keeps a cursor (`lastSweepAt`) with a 24-hour minimum lookback.
- Snapshot (pull) contract in the protocol specification and the adapter author guide.
- Coordinator startup sweep: verification rules, ordering and plan format (`skills/handling-channel-events/references/startup-sweep.md`).

### Removed

- `fleet channel add`, `fleet channel rm`, `fleet channel ls` and the channels registry (`~/.config/paseo/fleet/channels.json`). Adapters are the only sources.
- `fleet test-event`.
- `fleet init`, and `fleet coordinator set`, `get` and `clear`: `channels on` and `channels off` cover them, and `channels status` shows the receiver session.
- `protocol/schema/` and `protocol/examples/`: the event is described in `protocol/fleet-protocol.md`.
- The `reply_action` field of events and snapshot items. Replies go through the platform's own tool, with the ids from the event meta.
- `skills/worker`, `skills/reviewer` and `skills/fleet-setup`: Workers get a task-specific prompt from the coordinator, review follows the project's own rules, and setup is done by `channels on`.
- Coordinator references `triage-matrix.md` and `dispatch-lifecycle.md`, folded into the coordinator skill.

### Changed

- The tool is renamed from `paseo-fleet` to `paseo-channels`, its CLI from `fleet` to `channels`. The state directory `~/.config/paseo/fleet`, the `paseo-fleet-kit` library and the `paseo-channel/v1` format keep their names.
- The fleet coordinator is called the receiver session in prose and in the CLI output.
- Coordinator skill rewritten around how the fleet actually works: verify claims before acting, narrow Worker prompts, the project's own review gate, approval for every outbound action.
- Events use the Claude Code Channels shape: `{ content, meta }` with `source`, `kind` and `urn` in `meta`, delivered as a `<channel>` tag. The snapshot document format is `paseo-channel/v1`. See [fleet-protocol.md](protocol/fleet-protocol.md) and [Channels reference](https://code.claude.com/docs/en/channels-reference).
- `channels sweep` merges items by `meta.urn` and refuses a snapshot that is not in the `paseo-channel/v1` format.
- Adapter author guide and protocol specification rewritten for the channel shape.
- `channels on` and `channels status` no longer print channels; they report the coordinator and the adapter plugins only.
- The start skill sweeps, verifies and plans waiting work before listening for events.
- Coordinator Authority Rules: outbound writes (messages, comments, pushes, merge requests, merges) require explicit user approval of the draft.
- `channels on`, `off`, `status` and `sweep` drive every adapter in `config.adapters` instead of hardcoded Slack and GitLab; extra daemon flags go in `adapterDaemonArgs`.
- The CLI and config tests run against a temporary `HOME`. They used to overwrite the real fleet and adapter coordinator IDs.
- Moved into the [paseo-plugins](https://github.com/kern0x1b/paseo-plugins) monorepo as `tools/paseo-channels`. It is a command-line tool, not a Paseo plugin.

## 1.0.0 - 2026-10-02

### Added

- Standardized, model-agnostic fleet role skills:
  - `skills/coordinator/` — Inbound triage, capability probe, worktree dispatch, and outbound notification.
  - `skills/worker/` — Isolated worktree execution, TDD implementation, and verification reports.
  - `skills/reviewer/` — Independent adversarial code review, quality gating, and approval rubrics.
  - `skills/fleet-setup/` — Autonomous agent setup for zero-manual fleet configuration.
- Open **Paseo Fleet Protocol (v1)** specification, JSON Schemas, author guide, and reference event payloads.
- Standalone `fleet` CLI for managing coordinator bindings, channel registries, and synthetic health checks.
- Automated test suite covering CLI, channel manifest management, and protocol envelope validation.

[Unreleased]: https://github.com/kern0x1b/paseo-plugins/commits/main/tools/paseo-channels
