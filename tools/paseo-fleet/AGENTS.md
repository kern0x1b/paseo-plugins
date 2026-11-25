# AGENTS.md

Guidance for automated agents and contributors working in this repository. It
describes the architecture, layout, invariants that must hold, and the exact commands
to verify changes.

## What this is

A model-agnostic multi-agent fleet specification and protocol repository for [Paseo](https://getpaseo.com).
It defines standardized roles for **Coordinator** (orchestrator), **Worker** (implementer), and
**Reviewer** (adversarial quality gate), along with an open **Paseo Fleet Protocol** for connecting
external push event sources (e.g. `paseo-slack`, `paseo-gitlab`, `paseo-github`, `paseo-telegram`).

## Layout

| Path                              | Purpose                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `protocol/`                       | Fleet event protocol (channel shape), snapshot format, and the adapter author guide.    |
| `skills/start-fleet-coordinator/` | One-touch user skill to self-activate coordinator session and enable router plugins.    |
| `skills/end-fleet-coordinator/`   | One-touch user skill to clear coordinator bindings on the adapters.                     |
| `skills/coordinator/`             | Fleet Coordinator skill: triage, delegation to Workers, approval rules, startup sweep.  |
| `bin/fleet.js`                    | Executable CLI for fleet initialization, coordinator binding, sweep, and status checks. |
| `src/config.js`                   | Safe manager for the `~/.config/paseo/fleet/config.json` configuration.                 |
| `test/`                           | Automated test suite run via `node --test test/`.                                       |

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

- **Model & Provider Agnosticism.** Role skills must never hardcode specific model names or providers (`gpt-*`, `claude-*`, `gemini-*`).
- **No Tool Name Collisions.** Every channel retains its natural distinct tool name (`slack_send_message`, `gitlab_add_note`). Never reuse identical tool names across adapters.
- **Channel-shaped events.** Every event is `{ content, meta }` with `source`, `kind` and `urn` in `meta`. Adapters never fill in defaults for a missing value.
- **Independent Quality Gate.** The Reviewer agent must never be merged with the Worker; independent evaluation prevents author bias.
- **No personal data.** Never commit real usernames, private company URLs, tokens, or local home paths.
