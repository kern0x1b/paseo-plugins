# Adapter Author Guide

An adapter connects one platform to the Fleet Coordinator. The event shape is in
[fleet-protocol.md](fleet-protocol.md). Two reference adapters implement it:

- [`plugins/paseo-slack`](../../../plugins/paseo-slack): chat platform, WebSocket events, subscriptions per thread.
- [`plugins/paseo-gitlab`](../../../plugins/paseo-gitlab): forge, polling, health alerts.

Start from [`libs/paseo-fleet-kit`](../../../libs/paseo-fleet-kit). It provides the event helpers, the
subscription file, the routing flow and the daemon state file. An adapter adds only what is specific to its
platform: how events arrive, the filter, the subscription match and the event meta.

The fleet never imports an adapter. It runs adapters as commands named in `~/.config/paseo/fleet/config.json`
under `adapters` (default `["slack", "gitlab"]`).

## 1. Commands

| Command                               | Called by | Behaviour                                                                            |
| ------------------------------------- | --------- | ------------------------------------------------------------------------------------ |
| `<name> set-coordinator <id>`         | fleet     | Store the Coordinator agent ID. `none` or `--clear` unsets it.                       |
| `<name> unset-coordinator`            | fleet     | Clear the stored Coordinator agent ID.                                               |
| `<name> snapshot [--since <iso>]`     | fleet     | Print what already waits on the user as one document (fleet-protocol.md, section 3). |
| `<name> subscribe --agent <id> …`     | agents    | Route matching events to one agent instead of the Coordinator.                       |
| `<name> unsubscribe`, `subscriptions` | agents    | Remove and list subscriptions.                                                       |
| `<name> mcp`                          | agents    | Stdio MCP server exposing the platform's tools.                                      |

The reference adapters run the event router as the server part of a Paseo plugin (`index.server.ts`).
`paseo plugin ls` shows its status and `paseo plugin logs <id>` its logs.

## 2. Event flow

```text
platform event ─► Layer 1 filter ─► subscription match? ─yes─► plain prompt to that agent
                                          │ no
                                          ▼
                       channel event ─► paseo send <coordinator> '<channel tag>' --no-wait
```

1. **Receive.** WebSocket, long poll, webhook or timer. Store nothing the platform can give back.
2. **Layer 1 filter.** Drop noise before it reaches an agent: your own messages, system and bot chatter,
   channels where you are not mentioned. Keep direct messages, mentions and anything a subscription matches.
3. **Route.** The first matching subscription wins and its agent gets the event. With no match, the event goes
   to the Coordinator.
4. **Resolve the Coordinator**: the ID set by `set-coordinator`, then the coordinator field of the adapter's
   config. With none, return `routed: false` and log it. Never throw.
5. **Deliver** with `paseo send <agent-id> <text> --no-wait`, through `execFile` with an argument array. Do not
   build a shell string from event text.

## 3. The event

Build it with `createChannelEvent` from `paseo-fleet-kit`. It refuses an event without `source`, `kind` or
`urn`, and drops absent meta values. Render it with `renderChannelEvent`.

- **`urn` identifies the resource**, not the event: `urn:<platform>:<instance>:<scope>:<type>:<id>`.
  `fleet sweep` merges items from every adapter by `meta.urn`.
- **`urn` is deterministic.** Derive it from platform identifiers, never from a clock or random number, so a
  retry deduplicates instead of repeating.
- **`kind` is the semantic category**, such as `dm`, `mention`, `merge_request_opened`.
- **No defaults.** When a platform field is missing, throw. Do not write `unknown`, `default` or `null`.
- **`content` is text.** Keep it readable and bounded in length (the GitLab adapter cuts bodies at 4000 characters).

## 4. Subscriptions

A subscription is a small record in the adapter's config directory:

```json
{
  "coordinatorAgentId": "afe3e85b-…",
  "subscriptions": [
    { "id": "sub_1a2b3c4d", "agentId": "2a4279a", "channel": "C123", "thread_ts": "1727200000.123" }
  ]
}
```

Match on the platform's own coordinates (channel, thread, sender, project, merge request). A field left empty
matches anything. Adding an identical subscription replaces the old one. Extend `BaseSubscriptionRegistry` and
write `add`, `remove` and `findMatchingAgent`.

## 5. Event router rules

- Write `daemon-state.json` (`pid`, `running`, `startedAt`, `lastEventAt`, `eventsDispatched`) so the router's
  health can be read without talking to the process.
- Reload the registry on every event. A coordinator change applies without a restart.
- Log one line per event with the target agent. Do not log message content or tokens.
- Report a failing source to the Coordinator once when it breaks and once when it recovers, not once per poll.
- Exit cleanly on `SIGTERM` and remove the state file.

## 6. Snapshot

- Use the platform's own notion of "waiting on me": to-dos, review requests, assignments, unanswered direct
  messages and mentions.
- Resolve the user from the credentials. Do not ask for a user ID.
- Put each item in the channel shape. Facts the Coordinator needs to verify go into `content`.
- Report each failing source in `errors` and keep returning the rest. Exit non-zero only when you cannot
  authenticate.
- Never mark anything as read or done.

## 7. Checklist

- [ ] `set-coordinator` and `unset-coordinator` persist and clear the ID.
- [ ] Every event passes `createChannelEvent`; a missing `source`, `kind` or `urn` throws.
- [ ] `<name> snapshot` prints a `paseo-channel/v1` document and an auth failure exits non-zero.
- [ ] `urn` is deterministic; a repeated event produces the same `urn`.
- [ ] The adapter name is in `adapters`; `fleet status` lists its plugin status.
- [ ] Tests run offline and leave the real config untouched.
