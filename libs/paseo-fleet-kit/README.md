# paseo-fleet-kit

Shared building blocks for Paseo fleet adapters. Zero dependencies, Node 20+, ESM.
`paseo-slack` and `paseo-gitlab` are built on it, and so is any new adapter.
The contract an adapter implements is in the
[adapter author guide](../../tools/paseo-fleet/protocol/author-guide.md).

```js
import {
  createEventEnvelope,
  validateEventEnvelope,
  validateSnapshotDocument,
  BaseSubscriptionRegistry,
  BaseEventDispatcher,
  createDaemonStateStore,
} from "paseo-fleet-kit";
```

| Export                                          | Use it for                                                                                                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createEventEnvelope`, `validateEventEnvelope`  | Build and check a `paseo-fleet/v1` event.                                                                                                           |
| `validateSnapshotDocument`                      | Check the output of `<adapter> snapshot`.                                                                                                           |
| `BaseSubscriptionRegistry`                      | Subscription file with coordinator ID, `addSubscription`, `removeSubscriptions`. You add `add`, `remove` and `findMatchingAgent` for your platform. |
| `BaseEventDispatcher`                           | The routing flow: filter, subscription first, then Coordinator, then unrouted. You implement `shouldProcess`, `buildPrompt`, `buildEnvelope`.       |
| `createDaemonStateStore`                        | `daemon-state.json` read, write, clear and the "is this pid really our daemon" check.                                                               |
| `readJsonFile`, `writeJsonFile`, `removeFile`   | Small file helpers that create directories and tolerate corrupt JSON.                                                                               |
| `paseo-fleet-kit/testing` → `useIsolatedHome()` | Point `HOME` at a temp directory so tests never touch real config.                                                                                  |

## A minimal adapter

```js
import { BaseEventDispatcher, BaseSubscriptionRegistry, createEventEnvelope } from "paseo-fleet-kit";

class TeamsRegistry extends BaseSubscriptionRegistry {
  findMatchingAgent(event) {
    return this.list().find((s) => s.chatId === event.chatId)?.agentId ?? null;
  }
}

class TeamsDispatcher extends BaseEventDispatcher {
  shouldProcess(event) {
    return event.isDirectMessage || event.mentionsMe;
  }
  buildPrompt(event) {
    return `[Teams message]\n${event.text}`;
  }
  buildEnvelope(event) {
    return createEventEnvelope({
      id: `evt_teams_${event.tenantId}_${event.messageId}`,
      source: "teams",
      instance: event.tenantId,
      event_type: event.isDirectMessage ? "dm" : "mention",
      actor: { id: event.userId, name: event.userName, is_bot: false },
      content: event.text,
      reply_action: { type: "mcp", tool: "teams_send_message", params: { chat_id: event.chatId } },
    });
  }
}
```
