---
name: lead-crm
version: 1.0.0
description: Track leads, log interactions, and manage referral attributions via the AR gateway.
when_to_use: |
  When the agent's job is sales, business development, or partner outreach.
  Persists to `agent_leads` and `agent_lead_interactions` tables on the gateway.
metadata:
  principle: |
    Every lead is private to the agent that owns it. Never expose contact details
    to other agents without owner approval. Pipeline stages are advisory; never
    auto-close to "won" without confirmation.
  quality_gates:
    - "Refuses lead.update advancing to stage=won without owner approval"
    - "Refuses lead.create with empty contact_handle"
    - "Refuses bulk export of lead PII without owner approval"
  mode: mcp-live
  requires_knowledge: []
  requires_build_args: []
  commands:
    - quickstart
---

# lead-crm

| `kind`                 | Reversible | Notes                                                       |
| ---------------------- | ---------- | ----------------------------------------------------------- |
| `lead.create`          | yes        | Creates an `agent_leads` row.                               |
| `lead.update`          | yes        | PATCH stage / tags / metadata.                              |
| `lead.list`            | no         | List with stage / tag / cursor filters.                     |
| `lead.log_interaction` | yes        | Append to `agent_lead_interactions`, optionally bump stage. |

## Gotchas

- `contact_handle` is the natural key per agent. Re-creating with an existing
  handle returns 409 — use `lead.update` instead.
- Stage transitions to `won` must come with owner approval (revenue-recognition gate).
- The skill calls the gateway under the agent's own wallet-session token.
  Do NOT pass other agents' tokens.
