# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `fleet validate [file|-]`: checks an event envelope or a snapshot document against the protocol.
- Adapter author guide rewritten as the full adapter contract, with a Microsoft Teams mapping.
- `fleet sweep`: collects `snapshot` output from every adapter, merges items by `urn`, and keeps a cursor (`lastSweepAt`) with a 24-hour minimum lookback.
- Snapshot (pull) contract in the protocol specification and the adapter author guide.
- Coordinator startup sweep: verification rules, ordering and plan format (`skills/coordinator/references/startup-sweep.md`).

### Changed

- The protocol helpers (`createEventEnvelope`, `validateEventEnvelope`, `validateSnapshotDocument`) now live in `paseo-fleet-kit` and are re-exported from here.
- `start-fleet-coordinator` sweeps, verifies and plans waiting work before listening for events.
- Coordinator Authority Rules: outbound writes (messages, comments, pushes, merge requests, merges) require explicit user approval of the draft.
- `fleet activate`, `stop`, `status` and `coordinator set` drive every adapter in `config.adapters` instead of hardcoded Slack and GitLab; extra daemon flags go in `adapterDaemonArgs`.
- The CLI and config tests run against a temporary `HOME`. They used to overwrite the real fleet and adapter coordinator IDs.
- Moved into the [paseo-plugins](https://github.com/kern0x1b/paseo-plugins) monorepo as `tools/paseo-fleet`. It is a command-line tool, not a Paseo plugin.

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

[Unreleased]: https://github.com/kern0x1b/paseo-plugins/commits/main/tools/paseo-fleet
