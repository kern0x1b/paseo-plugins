# `paseo-channels` (`channels`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A522-3c873a.svg)](https://nodejs.org)
[![Tests: node --test](https://img.shields.io/badge/tests-node%20--test-brightgreen.svg)](test)
[![Code style: Prettier](https://img.shields.io/badge/code%20style-prettier-ff69b4.svg)](https://prettier.io)

Routes GitLab and Slack events into one [Paseo](https://getpaseo.com) session as Claude Code channel tags. The
package holds the `channels` CLI, the event protocol and the skill that tells the receiver session how to handle
what arrives.

---

## How it fits together

```
 GitLab plugin ──┐                        ┌─► receiver session (channels on)
                 ├─► <channel ...> tags ──┤
 Slack plugin  ──┘   paseo send           └─► agent subscribed to that MR, issue or thread
```

- The `gitlab` and `slack` Paseo plugins poll or listen to their platforms and push each new event as a tag.
- The receiver session is the one agent that gets events nobody subscribed to.
- An agent subscribed to a merge request, issue or thread gets that object's events instead.

---

## Skill

`skills/handling-channel-events` is loaded by the receiver session. It covers starting and stopping event handling,
the startup sweep (`skills/handling-channel-events/references/startup-sweep.md`), how to read a tag and how to act on
it. The GitLab plugin ships its own skill, `routing-gitlab-events`, for subscriptions.

---

## Lifecycle

```bash
# 1. Make this session the receiver and enable the router plugins
channels on

# 2. Collect what was already waiting on you from every adapter
channels sweep

# 3. Check the receiver session and the router plugins
channels status

# 4. Clear the receiver binding (the router plugins keep running)
channels off
```

Router health and logs: `paseo plugin ls`, `paseo plugin logs gitlab`, `paseo plugin logs slack`.

`channels on` without an argument uses `$PASEO_AGENT_ID`. It:

1. Stores the agent ID as `coordinatorAgentId` in `~/.config/paseo/fleet/config.json`.
2. Binds the ID to every adapter in `adapters` (`slack set-coordinator <id>`, `gitlab set-coordinator <id>`).
3. Enables each adapter plugin that is installed but disabled (`paseo plugin enable <id>`). The routers run inside
   Paseo as the server part of these plugins, so `channels on` starts no processes.

---

## Isolation by `meta`

Every event carries the identity it belongs to in `meta`, so one receiver serves several workspaces, hosts and
projects without collisions:

```text
<channel source="slack" kind="dm" urn="urn:slack:T0123456789:D01ABCDEF:1727200000.123" channel="D01ABCDEF" team="T0123456789" thread_ts="1727200000.123" ts="1727200000.123" user="U12345678">
```

- **`team`** and **`project`** (or `channel`): the workspace, host or repository the event came from.
- **`urn`**: globally unique resource name (`urn:gitlab:gitlab.example.com:team/project:issue:42`). It is the key
  `channels sweep` deduplicates by, so one resource reaches the session once.

The full event shape, the meta keys of each adapter and the snapshot format are in the
[Paseo Fleet Event Protocol](protocol/fleet-protocol.md). The channel model it follows is described in the
[Channels reference](https://code.claude.com/docs/en/channels-reference).

---

## CLI reference (`channels`)

```bash
channels on [agent-id]        # receiver session on: bind adapters, enable plugins
channels off                  # receiver session off: unbind adapters, plugins keep running
channels status               # receiver session and the state of each adapter plugin
channels sweep                # waiting work from every adapter (since the last sweep, at least 24h back)
channels sweep --since 3d --adapters gitlab
channels sweep --no-cursor    # do not move the cursor
channels help
```

Unknown commands exit with code 1 and a message on stderr.

---

## Building custom adapters

Anyone can build an adapter (e.g. for Teams, Jira or Discord). Read the [Adapter Author Guide](protocol/author-guide.md)
and the [`paseo-fleet-kit`](../../libs/paseo-fleet-kit) README.

---

## Documentation index

- [**Paseo Fleet Event Protocol**](protocol/fleet-protocol.md)
- [**Adapter Author Guide**](protocol/author-guide.md)
- [**Handling Channel Events skill**](skills/handling-channel-events/SKILL.md)
- [**Startup sweep**](skills/handling-channel-events/references/startup-sweep.md)

---

## License

MIT © kern0x1b
