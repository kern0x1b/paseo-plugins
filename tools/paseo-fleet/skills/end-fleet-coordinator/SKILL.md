---
name: end-fleet-coordinator
description: Stop the Fleet Coordinator session: clears the coordinator binding on the GitLab and Slack adapters and deactivates event routing. The router plugins keep running.
user-invocable: true
---

# End Fleet Coordinator

Use this skill to safely shut down the Fleet Coordinator session and unbind it from the GitLab and Slack adapters.

---

## Shutdown Procedure

Immediately execute the shutdown command:

```bash
fleet stop
```

This command automatically:

1. Clears the coordinator binding on the Slack adapter (`slack unset-coordinator`).
2. Clears the coordinator binding on the GitLab adapter (`gitlab unset-coordinator`).
3. Clears the fleet coordinator binding so no orphaned events are dispatched.
4. Leaves the `gitlab` and `slack` plugins running. To stop one, run `paseo plugin disable <id>`.

---

## Confirmation

After executing `fleet stop`, confirm to the user that:

- The coordinator binding is cleared on the GitLab and Slack adapters.
- The `gitlab` and `slack` plugins are still running (`paseo plugin ls`).
- No further events will be routed to Paseo until the coordinator is restarted with `/start-fleet-coordinator`.
