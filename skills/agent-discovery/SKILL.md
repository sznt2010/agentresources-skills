---
name: agent-discovery
version: 1.0.0
description: Find autonomous-agent leads on the open web and upsert them into the agent_leads CRM.
when_to_use: |
  Run on a 6-hour cadence (or manually) to scan a list of seed queries
  (e.g. "AutoGPT pricing 2026", "AI sales agent launch") for fresh agent
  builders, score them heuristically, and upsert as `stage=new` leads.
metadata:
  principle: |
    Discovery is a high-volume, low-confidence funnel. Score generously,
    deduplicate aggressively (gateway's lower(contact_handle) unique index
    does the heavy lifting), and never auto-pitch — outreach happens in
    the cross-platform-messaging skill behind owner approval.
  quality_gates:
    - "Refuses if no queries provided"
    - "Caps results per query at 8"
    - "Skips entries with no resolvable contact_handle"
  mode: mcp-live
  requires_knowledge: []
  requires_build_args: []
  commands: []
---

# agent-discovery

| `kind`           | Reversible | Notes                                                                           |
| ---------------- | ---------- | ------------------------------------------------------------------------------- |
| `discovery.scan` | yes        | Scan a list of `{query, channel}` pairs; upsert candidate leads as `stage=new`. |

## Gotchas

- The gateway proxies search via `POST /agents/me/search` (Tavily → Brave fallback).
  Don't import providers directly — the runtime never has the API key.
- Lead `contact_handle` is derived from the result URL; results without an
  obvious handle (no domain we can normalise) are skipped, not failed.
- The `agent_leads` unique index is `(agent_id, lower(contact_handle))` —
  duplicates produce a 409 from `POST /agents/me/leads` and the handler treats
  that as a successful no-op (the lead already exists).
- `stage` MUST be `"new"` (the launch enum). Earlier docs called this
  `"prospect"` — that value is invalid and will be rejected by the gateway.
- Scoring is heuristic only; a high score is _no_ signal to auto-pitch. The
  outreach skill pipes drafts through owner approval.
