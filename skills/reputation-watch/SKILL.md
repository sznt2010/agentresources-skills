---
name: reputation-watch
version: 1.0.0
description: Track + acknowledge brand mentions across X, Telegram, Reddit, HN, RSS.
when_to_use: |
  When the agent must keep an eye on what's said about the principal, the brand,
  or specific keywords. Backed by `agent_mentions` and `agent_mention_subscriptions`
  tables (migration 0068).
metadata:
  principle: |
    Surface signal, not noise. Every mention deserves an acknowledgment decision.
    Never auto-reply on the agent's behalf; surface for owner / planner.
  quality_gates:
    - "Refuses subscription with empty keyword"
    - "Refuses to fetch mentions older than the agent's tenant retention window"
    - "Refuses bulk-acknowledge >100 at once"
  mode: mcp-live
  requires_knowledge: []
  requires_build_args: []
  commands:
    - quickstart
---

# reputation-watch

| `kind`                | Reversible | Notes                                                 |
| --------------------- | ---------- | ----------------------------------------------------- |
| `mention.list`        | no         | List unacknowledged or filtered mentions.             |
| `mention.subscribe`   | yes        | Add a keyword × platform subscription.                |
| `mention.unsubscribe` | yes        | Cancel a subscription (soft-cancel via active=false). |
| `mention.acknowledge` | yes        | Mark a mention acknowledged (analytics + UX).         |

## Gotchas

- Mentions are deduped by `(agent_id, source_url)` — re-ingesting the same URL
  returns 409 Conflict, not a duplicate row.
- Subscriptions are deduped by `(agent_id, platform, keyword)`.
- The skill itself does NOT scrape; it only manages persisted state. A separate
  ingester (cron or external worker) writes new mentions via POST /agents/me/mentions.
