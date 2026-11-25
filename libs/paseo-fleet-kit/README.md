# paseo-fleet-kit

Shared building blocks for Paseo fleet adapters. Zero dependencies, Node 22+, ESM.
`paseo-slack` and `paseo-gitlab` are built on it, and so is any new adapter.
The contract an adapter implements is in the
[adapter author guide](../../tools/paseo-channels/protocol/author-guide.md).

```js
import {
  createChannelEvent,
  renderChannelEvent,
  validateChannelEvent,
  mergeChannelEventsByUrn,
  validateSnapshotDocument,
  BaseSubscriptionRegistry,
  BaseEventDispatcher,
  createDaemonStateStore,
} from "paseo-fleet-kit";
```

| Export                                          | Use it for                                                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createChannelEvent`, `validateChannelEvent`    | Build and check a `{ content, meta }` event. Refuses a missing `source`, `kind` or `urn`, and drops absent meta values.                                      |
| `renderChannelEvent`                            | Render an event as the `<channel source=… kind=… urn=…>` tag Claude Code shows.                                                                              |
| `mergeChannelEventsByUrn`                       | Merge events that share a `meta.urn` into one event.                                                                                                         |
| `validateSnapshotDocument`                      | Check the output of `<adapter> snapshot` (`format: "paseo-channel/v1"`).                                                                                     |
| `BaseSubscriptionRegistry`                      | Subscription file with the receiver session ID, `addSubscription`, `removeSubscriptions`. You add `add`, `remove` and `findMatchingAgent` for your platform. |
| `BaseEventDispatcher`                           | The routing flow: filter, subscription first, then the receiver session, then unrouted. You implement `shouldProcess` and `buildChannelEvent`.               |
| `createDaemonStateStore`                        | `daemon-state.json` read, write, clear and the "is this pid really our daemon" check.                                                                        |
| `readJsonFile`, `writeJsonFile`, `removeFile`   | Small file helpers that create directories and refuse corrupt JSON.                                                                                          |
| `paseo-fleet-kit/testing` → `useIsolatedHome()` | Point `HOME` at a temp directory so tests never touch real config.                                                                                           |

## A minimal adapter

```js
import { BaseEventDispatcher, BaseSubscriptionRegistry, createChannelEvent } from "paseo-fleet-kit";

class TeamsRegistry extends BaseSubscriptionRegistry {
  findMatchingAgent(event) {
    return this.list().find((s) => s.chatId === event.chatId)?.agentId ?? null;
  }
}

class TeamsDispatcher extends BaseEventDispatcher {
  shouldProcess(event) {
    return event.isDirectMessage || event.mentionsMe;
  }
  buildChannelEvent(event) {
    return createChannelEvent({
      content: event.text,
      meta: {
        source: "teams",
        kind: event.isDirectMessage ? "dm" : "mention",
        urn: `urn:teams:${event.tenantId}:${event.chatId}:${event.messageId}`,
        user: event.userId,
        team: event.tenantId,
      },
    });
  }
}
```

`buildPrompt` and `buildBatchMessage` render the tags; `dispatch` and `dispatchBatch` deliver them.
