# `paseo-fleet` (`fleet`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A522-3c873a.svg)](https://nodejs.org)
[![Tests: node --test](https://img.shields.io/badge/tests-node%20--test-brightgreen.svg)](test)
[![Code style: Prettier](https://img.shields.io/badge/code%20style-prettier-ff69b4.svg)](https://prettier.io)

Model-agnostic multi-agent fleet skills (**Coordinator**, **Worker**, **Reviewer**) and open event protocol for [Paseo](https://getpaseo.com), Claude Code, and Antigravity.

Enables autonomous agent teams to triage incoming events from external channels (Slack, GitLab, GitHub, Telegram), execute implementations in isolated git worktrees, gate on independent adversarial review, and report outcomes seamlessly without hardcoded model or tool dependencies.

---

## Architecture Overview

```
                      External Platforms (Slack, GitLab, GitHub, Webhooks)
                                           │
                                           ▼ (Layer 1 Filter)
                      ┌────────────────────────────────────────┐
                      │  Paseo Fleet Protocol (Inbound Event)  │
                      │  paseo send <coordinator_agent_id>     │
                      └────────────────────┬───────────────────┘
                                           │
                                           ▼
                      ┌────────────────────────────────────────┐
                      │      Fleet Coordinator (Orchestrator)  │
                      │  - Triage & Deduplication              │
                      │  - Subtask Decomposition               │
                      │  - Worktree Provisioning               │
                      └────────────┬───────────────────────▲───┘
                                   │                       │
           1. Delegate Task        │                       │ 4. Verdict (APPROVED)
                                   ▼                       │
        ┌────────────────────────────────────┐             │
        │    Fleet Worker (Implementer)      │             │
        │  - Isolated Git Worktree           │             │
        │  - Test-Driven Development (TDD)   │             │
        │  - Self-Verification Evidence      │             │
        └──────────────────┬─────────────────┘             │
                           │                               │
                           │ 2. Handoff Diff Artifact      │
                           ▼                               │
        ┌──────────────────────────────────────────────────┴─┐
        │          Fleet Reviewer (Quality Gate)             │
        │  - Independent Adversarial Critique                │
        │  - Security, Invariant & Regression Checks         │
        │  - Feedback Loop (CHANGES_REQUESTED / APPROVED)    │
        └────────────────────────────────────────────────────┘
```

---

## Fleet Skills & Roles

`paseo-fleet` provides three skills:

| Skill | Invocation | Description |
| --- | --- | --- |
| **Start Coordinator** | `/start-fleet-coordinator` | Activates the session as coordinator, binds the Slack and GitLab adapters, sweeps what was already waiting, presents a verified plan, then listens for events. |
| **End Coordinator** | `/end-fleet-coordinator` | Clears the coordinator bindings on the adapters. The router plugins keep running. |
| **Coordinator** | `skills/coordinator` | How the coordinator triages events, delegates code to Worker agents in worktrees with narrow prompts, gates work with the project's own review, and drafts every outbound action for approval. |

Workers are ordinary agents started by the coordinator with a task-specific prompt; review follows the project's
own rules. The plugin ships no separate Worker or Reviewer skill.

---

## Autonomous Lifecycle: Zero Manual Work

Start and stop the entire multi-agent fleet with zero manual file editing:

```bash
# 1. Activate the current agent session as Coordinator and enable the router plugins
fleet activate

# 2. Collect everything that was already waiting on you from every adapter
fleet sweep

# 3. Check coordinator liveness, channels, and router plugin status
fleet status

# 4. Unbind the coordinator from the adapters (the router plugins keep running)
fleet stop
```

Router health and logs: `paseo plugin ls`, `paseo plugin logs gitlab`, `paseo plugin logs slack`.

When running inside a Paseo agent session, invoking `/start-fleet-coordinator` automatically calls `fleet activate`, which:

1. Detects the unique session ID (`$PASEO_AGENT_ID`).
2. Registers the ID as the active Coordinator in `~/.config/paseo/fleet/config.json`.
3. Binds the ID to the Slack adapter (`slack set-coordinator <id>`).
4. Binds the ID to the GitLab adapter (`gitlab set-coordinator <id>`).
5. Enables the `slack` and `gitlab` plugins if they are installed but disabled (`paseo plugin enable <id>`). The event routers run inside Paseo as the server part of these plugins, so activation starts no processes.
6. Reads `~/.config/paseo/fleet/channels.json` and reports ready channels.

The skill then runs `fleet sweep`, verifies every item against its source, presents a prioritised plan, dispatches Workers for the items that need code, and queues every outbound action (messages, comments, pushes, merge requests) for the user's approval before it starts listening for new events.

---

## Multi-Project & Multi-Instance Isolation

The fleet protocol prevents collisions across multiple projects, repositories, and workspaces using explicit routing scopes:

```json
{
  "channels": {
    "slack:work": {
      "type": "chat",
      "instance": "T0123456789",
      "scope": null,
      "mcp_tool": "slack_send_message",
      "cli_command": "slack send",
      "description": "Work Slack workspace",
      "is_primary": true
    },
    "gitlab:work": {
      "type": "forge",
      "instance": "https://gitlab.example.com",
      "scope": "team/project",
      "mcp_tool": "gitlab_create_issue_note",
      "cli_command": "gitlab comment",
      "description": "Work GitLab (team/project)"
    }
  },
  "primary_channel": "slack:work"
}
```

- **`instance`**: Uniquely identifies the team, tenant, or host (e.g. Slack Team `T0123456789`, GitLab host `https://gitlab.example.com`).
- **`scope`**: Identifies the specific repository, project, or channel namespace (e.g. `team/project` or `C01DEV`).
- **`urn`**: Globally unique uniform resource name (`urn:gitlab:gitlab.example.com:team/project:issue:42`), enabling 100% idempotent deduplication across agents.

---

## CLI Reference (`fleet`)

```bash
# Initialize fleet directories (~/.config/paseo/fleet/)
fleet init

# Activate current agent ($PASEO_AGENT_ID) as coordinator & enable router plugins
fleet activate

# Check fleet status, coordinator binding, and router plugin status
fleet status

# Collect waiting work from every adapter (default: since the last sweep, at least 24h back)
fleet sweep
fleet sweep --since 3d --adapters gitlab
fleet sweep --no-cursor   # do not move the cursor

# Register a push channel provider
fleet channel add slack:work --tool slack_send_message --cli "slack send" --type chat --instance T0123456789 --primary
fleet channel add gitlab:work --tool gitlab_create_issue_note --cli "gitlab comment" --type forge --instance https://gitlab.example.com --scope team/project

# Inspect registered channels
fleet channel ls

# Remove a channel
fleet channel rm gitlab:work

# Dispatch synthetic test event to verify round-trip delivery
fleet test-event --channel slack:work

# Unbind coordinator from the adapters (router plugins keep running)
fleet stop
```

---

## Building Custom Adapters

Anyone can build custom adapters (e.g. `paseo-telegram`, `paseo-github`, `paseo-jira`, `paseo-discord`). Read the [Adapter Author Guide](protocol/author-guide.md) to implement the contract in minutes.

---

## Documentation Index

- [**Paseo Fleet Protocol Specification**](protocol/fleet-protocol.md)
- [**Adapter Author Guide**](protocol/author-guide.md)
- [**Coordinator Skill**](skills/coordinator/SKILL.md)
- [**Coordinator Startup Sweep**](skills/coordinator/references/startup-sweep.md)

---

## License

MIT © kern0x1b
