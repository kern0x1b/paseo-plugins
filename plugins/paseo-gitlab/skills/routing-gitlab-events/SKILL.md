---
name: routing-gitlab-events
description: "Routes GitLab events to Paseo agents: subscribes an agent to a merge request, issue, branch or author so those events reach it instead of the receiver session. Used when an agent should follow one MR or branch, or to see or clear subscriptions."
---

# Routing GitLab events

The router runs inside Paseo as the server part of the `gitlab` plugin. Every two minutes it polls GitLab and pushes
the new events as `<channel source="gitlab" ...>` tags (see the `handling-channel-events` skill). An event goes to
the agent whose subscription matches it; everything else, and the router's own alerts, go to the receiver session.

| Subscription | Matches                                                       |
| ------------ | ------------------------------------------------------------- |
| `mr_iid`     | reviews, comments, approvals and pushes of that merge request |
| `issue_iid`  | discussion on that issue                                      |
| `ref`        | pipelines and pushes of that branch                           |
| `author`     | events created by that user                                   |

Subscribe with the `gitlab_subscribe` MCP tool or `gitlab subscribe --agent <agent-id> --mr <iid>`; list with
`gitlab_list_subscriptions`, remove with `gitlab_unsubscribe`. A subscription of an archived agent is dropped on the
next event, and its events go back to the receiver.

Configuration: `~/.config/gitlab-router/config.json`; `GITLAB_HOST`, `GITLAB_TOKEN`, `GITLAB_PROJECT_ID` and
`PASEO_BIN` override it.
