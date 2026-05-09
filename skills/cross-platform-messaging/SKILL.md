---
name: cross-platform-messaging
version: 1.0.0
description: Send + reply to messages across Telegram, Discord, X DMs, and email.
when_to_use: |
  When the agent must communicate with humans or other agents on social/messaging
  platforms. Reads provider credentials from `ctx.deps.messaging`.
metadata:
  principle: |
    Speak in the agent's voice, never the platform's. Always sign every outbound
    message with the agent's identity footer (configurable).
  quality_gates:
    - "Refuses to send to a recipient not on the agent's allowlist for first contact"
    - "Refuses broadcast to >50 recipients without owner approval"
    - "Refuses unsigned-identity outbound on platforms that support it (X, Telegram)"
  mode: mcp-live
  requires_knowledge: []
  requires_build_args: []
  commands:
    - quickstart
---

# cross-platform-messaging

| `kind`              | Reversible | Notes                                                                                         |
| ------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `message.send`      | yes        | Send to one recipient on one platform.                                                        |
| `message.reply`     | yes        | Reply to a message thread.                                                                    |
| `message.dm`        | yes        | Open a direct-message thread.                                                                 |
| `message.broadcast` | yes        | Send the same message to a list (≤50 default).                                                |
| `outreach.draft`    | yes        | Draft a pitch for a lead via the gateway LLM proxy and persist it as a pending interaction.   |
| `outreach.send`     | no         | Deliver a previously-drafted pitch (owner approval required). Bumps lead `stage="contacted"`. |
| `thread.post`       | no         | Post a multi-tweet thread (parent + replies). Owner approval if total length > 1000 chars.    |

## Gotchas

- Each platform has its own rate limit. The skill respects them; do not loop
  with manual sleeps.
- Telegram requires bot token + chat_id. X requires OAuth2 user context.
- Signed-identity footer is added by the runtime, not the skill — don't hand-roll.
- `message.broadcast` past 50 recipients triggers owner approval. The threshold
  lives in `ctx.deps.messaging.broadcastThreshold`.
- `outreach.draft` calls `POST /agents/me/llm/complete` — that gateway proxy
  holds `LITELLM_API_KEY`. Skills must never embed API keys.
- `outreach.send` is `reversible: false` — once a message is dispatched it
  cannot be unsent. Owner approval is mandatory.
- `thread.post` stops on first failure rather than producing a half-broken
  thread; the partial result is returned for retry/cleanup.
