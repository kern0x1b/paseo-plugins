# AGENTS.md

Guidance for automated agents and contributors working in this repository. It
describes the layout, invariants that must hold, and the exact commands to verify changes.

## What this is

`paseo-channels` is the `channels` CLI, the event protocol and the receiver-session skill for
[Paseo](https://getpaseo.com). It routes events from the `gitlab` and `slack` Paseo plugins into one receiver
session as Claude Code channel tags, using the **Paseo Fleet Event Protocol** (`protocol/`).

## Layout

| Path                              | Purpose                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `protocol/`                       | Event protocol (channel shape), snapshot format, and the adapter author guide.      |
| `skills/handling-channel-events/` | Skill for the receiver session: starting and stopping, reading tags, startup sweep. |
| `bin/channels.js`                 | Executable CLI: `on`, `off`, `status`, `sweep`, `help`.                             |
| `src/config.js`                   | Safe manager for the `~/.config/paseo/fleet/config.json` configuration.             |
| `src/adapters.js`, `src/sweep.js` | Adapter binding and plugin status, and the sweep across adapters.                   |
| `test/`                           | Automated test suite run via `node --test test/`.                                   |

The state directory (`~/.config/paseo/fleet`), the `paseo-fleet-kit` library and the `paseo-channel/v1` format keep
their names: running plugins depend on them.

## Commands

Run from the repository root:

```bash
npm test             # node --test test/; must pass and never touch the live network
npm run format       # prettier --write .
npm run format:check # prettier --check .
```

## Conventions

- **Pure Modern Node.js ESM.** Zero external runtime dependencies. Uses native Node.js APIs (`node:fs`, `node:child_process`, `node:test`, `node:assert`).
- **Conventional Commits.** Subject lowercased, ≤ 100 chars (e.g. `feat: ...`, `fix: ...`, `chore: ...`).
- **Self-documenting code.** The codebase is clean and comment-free; code should be self-explanatory through clear naming and structure.
- **English everywhere** in code, documentation, and commit messages.
- **Zero manual configuration.** Tools must be discoverable and configurable programmatically by agents.

## Invariants — Do Not Break

- **No Tool Name Collisions.** Every channel retains its natural distinct tool name (`slack_send_message`, `gitlab_add_note`). Never reuse identical tool names across adapters.
- **Channel-shaped events.** Every event is `{ content, meta }` with `source`, `kind` and `urn` in `meta`. Adapters never fill in defaults for a missing value.
- **Stable names on disk.** Do not rename the state directory, stored keys (`coordinatorAgentId`) or the `paseo-channel/v1` format without migrating the running plugins.
- **No personal data.** Never commit real usernames, private company URLs, tokens, or local home paths.
