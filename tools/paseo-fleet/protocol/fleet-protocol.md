# Paseo Fleet Event Protocol

Adapters deliver events to the Fleet Coordinator in the shape Claude Code Channels use. The reference for
the channel model is [Channels reference](https://code.claude.com/docs/en/channels-reference).

## 1. Event

An event is an object with two fields:

```json
{
  "content": "!42 merge_request_opened by @dev: Add payment gateway",
  "meta": {
    "source": "gitlab",
    "kind": "merge_request_opened",
    "urn": "urn:gitlab:gitlab.corp.net:core/backend:mr:42",
    "url": "https://gitlab.corp.net/core/backend/-/merge_requests/42",
    "author": "dev",
    "title": "Add payment gateway",
    "project": "core/backend",
    "mr": "42"
  }
}
```

- `content` is the readable text of the event.
- `meta` is a flat map of string values. Keys match `^[A-Za-z0-9_]+$`. A value that is absent (`undefined`,
  `null`, empty) is not written. Numbers are written as strings. Anything else is refused.
- `source`, `kind` and `urn` are required. `urn` identifies the resource and is the deduplication key.

Meta used by the adapters:

| Source   | Meta keys                                                                       |
| -------- | ------------------------------------------------------------------------------- |
| `gitlab` | `url`, `author`, `title`, `project`, `mr`, `issue`, `pipeline`, `todo`, `scope` |
| `slack`  | `channel`, `user`, `ts`, `thread_ts`, `team`, `url`                             |

`scope="others"` marks an event from the router that watches other people's activity.

An event that lacks `source`, `kind` or `urn`, or has an invalid key, is an error. No adapter fills in a default. In a batch, such an event is logged and replaced by a tag of its own, `kind="delivery_error"` with `urn="urn:<source>:error:<raw id>"` and the reason as content; the other events are delivered.

## 2. Delivery

An adapter renders the event as a tag and sends it to the Coordinator:

```text
<channel source="gitlab" kind="merge_request_opened" urn="urn:gitlab:gitlab.corp.net:core/backend:mr:42" author="dev" mr="42" project="core/backend" title="Add payment gateway" url="https://gitlab.corp.net/core/backend/-/merge_requests/42">
!42 merge_request_opened by @dev: Add payment gateway
</channel>
```

- `source`, `kind` and `urn` come first, the other attributes follow in alphabetical order.
- Attribute values escape `&`, `"`, `<` and `>`. In the content, `<channel` and `</channel` (any letter case) are escaped, so text cannot open or close an element.
- A batch is the tags one after another, separated by a blank line. It has no header.

```bash
paseo send <coordinator_agent_id> '<channel ...>...</channel>' --no-wait
```

## 3. Snapshot

Push events cover only what happens while a router runs. A snapshot covers what already waits on the user.
Every adapter prints one document:

```bash
<adapter> snapshot [--since <iso-timestamp>]
```

```json
{
  "format": "paseo-channel/v1",
  "source": "gitlab",
  "generated_at": "2026-10-02T08:00:00.000Z",
  "items": [
    { "content": "...", "meta": { "source": "gitlab", "kind": "todo_review_requested", "urn": "..." } }
  ],
  "errors": [{ "source": "todos", "error": "GitLab API error 503" }]
}
```

- Every item is a channel event (section 1). Its `meta.source` equals the document `source`.
- Items are deduplicated by `urn` inside one adapter. The first meta wins; distinct content lines are joined.
- A failing source goes to `errors`, and the other sources are still returned.
- Snapshots are read-only.

`fleet sweep` runs the snapshot of every adapter in `adapters` (default `slack` and `gitlab`), refuses a document
that does not match the format, and merges the items across adapters by `meta.urn`.
