# Adapter Author Guide: Building a Paseo Fleet Adapter

An adapter connects one external platform (Slack, GitLab, Microsoft Teams, Jira, Discord) to the
fleet Coordinator. This guide is the complete contract. Two reference adapters implement it:

- [`tools/paseo-slack`](../../paseo-slack): chat platform, WebSocket events, subscriptions per thread.
- [`plugins/paseo-gitlab`](../../../plugins/paseo-gitlab): forge, polling, health alerts.

Read them next to this guide. The file names below are the same in both.

The fleet never imports an adapter. It runs adapters as commands named in `~/.config/paseo/fleet/config.json`
under `adapters` (default `["slack", "gitlab"]`), so a new adapter needs no change to `paseo-fleet`:
install the command on `PATH`, add its name to `adapters`, and `fleet activate`, `fleet stop`,
`fleet status` and `fleet sweep` include it.

## 1. The contract

An adapter is one executable, `<name>`, with these subcommands. Items marked fleet are called by the
`fleet` CLI; the rest are for the user and the agents.

| Command                               | Called by | Behaviour                                                                                       |
| ------------------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `<name> daemon`                       | fleet     | Run the real-time event router in the foreground until `SIGTERM`.                               |
| `<name> daemon status`                | fleet     | Print `{"running": true, "pid": 123, ...}` as JSON. `running` is false when no daemon is alive. |
| `<name> daemon stop`                  | fleet     | Send `SIGTERM` to the daemon and wait for it to exit.                                           |
| `<name> set-coordinator <id>`         | fleet     | Store the Coordinator agent ID. `none` or `--clear` unsets it.                                  |
| `<name> unset-coordinator`            | fleet     | Clear the stored Coordinator agent ID.                                                          |
| `<name> snapshot [--since <iso>]`     | fleet     | Print what already waits on the user as one JSON document (section 5 of the protocol).          |
| `<name> subscribe --agent <id> …`     | agents    | Route matching events to one specific agent instead of the Coordinator (section 4).             |
| `<name> unsubscribe`, `subscriptions` | agents    | Remove and list subscriptions.                                                                  |
| `<name> mcp`                          | agents    | Stdio MCP server exposing the platform's tools, including the one named in `reply_action`.      |
| `<name> send …`                       | agents    | Post a reply, the CLI form of the MCP reply tool (`gitlab comment` in the GitLab adapter).      |

An adapter that skips `subscribe` and `mcp` still works as a push source, but the Coordinator cannot
reply through it and agents cannot follow a single thread.

## 2. Event flow

```text
platform event ─► Layer 1 filter ─► subscription match? ─yes─► plain prompt to that agent
                                          │ no
                                          ▼
                              envelope ─► paseo send <coordinator> '<json>' --no-wait
```

1. **Receive.** WebSocket, long poll, webhook or timer. Store nothing the platform can give back.
2. **Layer 1 filter.** Drop noise before it reaches an agent: your own messages, system and bot chatter,
   channels where you are not mentioned. Keep direct messages, mentions, and anything matched by a
   subscription.
3. **Route.** The first matching subscription wins and its agent gets a plain-text prompt. With no
   match, the event goes to the Coordinator as a `paseo-fleet/v1` envelope.
4. **Resolve the Coordinator** in this order: the ID set by `set-coordinator`, then the coordinator
   field of the adapter's own config. With none, return `routed: false` and log it. Never throw.
5. **Deliver** with `paseo send <agent-id> <text> --no-wait`, using `execFile` with an argument array.
   Do not build a shell string from event text.

## 3. The envelope

Build it with `createEventEnvelope` from `paseo-fleet` or by hand, then check it with
`fleet validate`. Required: `protocol`, `id`, `source`, `event_type`, `actor`, `content`,
`reply_action`.

Choices that matter:

- **`id` is deterministic.** Derive it from platform identifiers (`evt_slack_<team>_<channel>_<ts>`),
  never from a clock or random number. A retry then deduplicates instead of repeating.
- **`urn` identifies the resource**, not the event: `urn:<platform>:<instance>:<scope>:<type>:<id>`.
  `fleet sweep` merges items from every adapter by `urn`.
- **`instance`** is the workspace, tenant or host. It lets one fleet serve two Slack workspaces or two
  GitLab hosts.
- **`reply_action` is complete.** The Coordinator must never guess where to reply: put the tool name
  and every parameter it needs (channel, thread, chat ID) into `reply_action.params`.
- **`content` is text only.** Strip markup the model cannot use and keep it under a few kilobytes.

## 4. Subscriptions

A subscription is a small record in the adapter's own config directory:

```json
{
  "coordinatorAgentId": "afe3e85b-…",
  "subscriptions": [
    { "id": "sub_1a2b3c4d", "agentId": "2a4279a", "channel": "C123", "thread_ts": "1727200000.123" }
  ]
}
```

Match on the platform's own coordinates (channel, thread, sender, project, merge request). A field left
empty matches anything. Adding an identical subscription replaces the old one. `list`, `add` and
`remove` are the whole API; copy `SubscriptionRegistry` from either reference adapter.

## 5. Daemon rules

- Write `daemon-state.json` (`pid`, `running`, `startedAt`, `lastEventAt`, `eventsDispatched`) so
  `daemon status` can answer without talking to the process.
- Reload the registry on every event. A coordinator change must apply to the running daemon without a
  restart.
- Log one line per event with the target agent. Do not log message content or tokens.
- Report a failing source to the Coordinator once when it breaks and once when it recovers, as the GitLab
  adapter does with its health alerts, instead of once per poll.
- Exit cleanly on `SIGTERM` and remove the state file.

## 6. Snapshot

Push events only cover what happens while the daemon runs. `snapshot` covers what is already waiting.

- Use the platform's own notion of "waiting on me": to-dos, review requests, assignments, unanswered
  direct messages and mentions.
- Resolve the user from the credentials. Do not ask for a user ID.
- Put raw evidence into `snapshot.state` and leave judgement to the Coordinator.
- Report each failing source in `errors` and keep returning the rest. Exit non-zero only when you cannot
  authenticate.
- Never mark anything as read or done.

Check the output with `<name> snapshot | fleet validate -`.

## 7. Registration

```bash
fleet channel add teams:work --tool teams_send_message --cli "teams send" --type chat \
  --instance <tenant-id> --scope <team-id>
```

Then add the adapter name to `adapters` in `~/.config/paseo/fleet/config.json`. If the daemon needs
extra flags, add them under `adapterDaemonArgs` (for example `{ "teams": ["--tenant", "work"] }`).

## 8. Worked mapping: Microsoft Teams

| Contract piece    | Slack                        | GitLab                       | Teams                                                         |
| ----------------- | ---------------------------- | ---------------------------- | ------------------------------------------------------------- |
| Event source      | Socket Mode WebSocket        | REST polling                 | Microsoft Graph change notifications, or polling `/me/chats`  |
| Layer 1 filter    | DMs, mentions, subscriptions | To-dos, pipeline failures    | 1:1 and group chats, `@mention` of the user, subscriptions    |
| `instance`        | team ID                      | host URL                     | tenant ID                                                     |
| `scope`           | channel ID                   | project path                 | team or chat ID                                               |
| `urn`             | `urn:slack:T:C:ts`           | `urn:gitlab:host:path:mr:42` | `urn:teams:tenant:chat:message-id`                            |
| Subscription keys | channel, thread, sender      | project, target              | chat, thread, sender                                          |
| Snapshot          | unanswered DMs and mentions  | to-dos, MRs, assigned issues | chats where the last message is not yours and mentions of you |
| Reply tool        | `slack_send_message`         | `gitlab_create_issue_note`   | `teams_send_message` with `chat_id` and `reply_to`            |

A minimal adapter is `bin/teams.js` (the commands in section 1), `src/dispatcher.js` (sections 2 and 3),
`src/subscriptions.js` (section 4) and `src/snapshot.js` (section 6), with its own tests that fake the
platform at the network boundary. Tests must never write to the real home directory: set `HOME` to a temp
directory, as `tools/paseo-fleet/test/isolated-home.mjs` does.

## 9. Checklist

- [ ] `<name> daemon status` prints JSON with `running` and `pid`.
- [ ] `set-coordinator` and `unset-coordinator` persist and clear the ID.
- [ ] A synthetic event passes `fleet validate -`.
- [ ] `<name> snapshot | fleet validate -` passes, and an auth failure exits non-zero.
- [ ] Event IDs are deterministic; a repeated event produces the same `id`.
- [ ] `reply_action.params` is enough to reply without any other lookup.
- [ ] The adapter name is in `adapters`; `fleet status` lists its daemon.
- [ ] Tests run offline and leave the real config untouched.
