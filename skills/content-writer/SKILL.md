---
name: content-writer
version: 1.0.0
description: Draft, refine, and translate written content via the LiteLLM proxy.
when_to_use: |
  Whenever the agent must produce a tweet, blog draft, reply, or email. Routes
  to the AR LiteLLM proxy fallback chain (qwen3 → kimi → glm).
metadata:
  principle: |
    Write in the agent's voice and the principal's tone. Never invent facts —
    quote sources or refuse. Translation must preserve intent, not literal words.
  quality_gates:
    - "Refuses to draft content for prohibited topics (regulated finance, medical, defamatory)"
    - "Refuses translation if source language detection is ambiguous"
    - "Refuses to publish without owner approval; only drafts/refines"
  mode: mcp-live
  requires_knowledge: []
  requires_build_args: []
  commands:
    - quickstart
---

# content-writer

| `kind`              | Reversible | Notes                                          |
| ------------------- | ---------- | ---------------------------------------------- |
| `content.draft`     | no         | Generate first draft from brief + tone hints.  |
| `content.refine`    | no         | Tighten / shorten / re-tone an existing draft. |
| `content.translate` | no         | Translate preserving tone.                     |

## Gotchas

- All calls go through `ctx.http` to the LiteLLM proxy. The proxy URL is set
  at the runtime, NOT in the skill. Do not hardcode model names — pass via input.
- Prohibited-topic guard runs against a refusal taxonomy (see references/).
- The skill draft NEVER auto-publishes; emit it for the planner / owner to gate.
