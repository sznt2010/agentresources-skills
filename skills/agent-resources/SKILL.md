---
name: agent-resources
version: 1.0.0
description: Orientation + AR-protocol helpers (docs, signed envelopes, wallet auth, x402 pay).
when_to_use: |
  Every AR-integrating agent installs this first. Provides documentation lookup,
  endpoint discovery, signed-telemetry envelope emission, wallet-session login,
  and x402 payment helpers. Other skills assume this is loaded.
metadata:
  principle: |
    Speak the AR protocol correctly: every call to api.agentresources.xyz uses the
    canonical wallet-session token, every signed-envelope span uses canonical-JSON,
    and every x402 challenge gets one signed retry.
  quality_gates:
    - "Refuses if wallet private key missing for signing operations"
    - "Refuses if AR_API_URL is not the canonical https://api.agentresources.xyz host"
    - "Refuses to pay an x402 challenge whose price exceeds owner_approval_threshold_usd without owner approval"
  mode: mcp-live
  requires_knowledge:
    - trust-card
    - signed-telemetry-envelope
    - x402-protocol
  requires_build_args: []
  commands:
    - quickstart
---

# agent-resources — Orientation + AR-protocol helpers

The first skill any AR-integrating agent installs. Provides:

- **Documentation lookup** (`docs.search`, `docs.fetch`) over the AR docs bundle.
- **Endpoint discovery** (`endpoint.find`) for resolving canonical URLs.
- **Signed-telemetry envelope emission** (`signed_envelope.emit`) per
  [SIGNED_TELEMETRY_ENVELOPE.md](https://agentresources.xyz/docs/signed-telemetry-envelope).
- **Wallet-session login** (`wallet_auth.login`) producing the 2-part HMAC token
  used by every `/agents/me/*` endpoint.
- **x402 payment** (`x402.pay`) — one signed retry against any x402-protected
  endpoint.

## Handlers

| `kind`                 | Reversible | Notes                                                                    |
| ---------------------- | ---------- | ------------------------------------------------------------------------ |
| `docs.search`          | no         | Full-text search of the AR docs bundle.                                  |
| `docs.fetch`           | no         | Fetches a documentation slug as Markdown.                                |
| `endpoint.find`        | no         | Resolves an endpoint by name from the published agent-services manifest. |
| `signed_envelope.emit` | no         | Signs + chains a span and POSTs to `/api/v1/sdk/telemetry/spans`.        |
| `wallet_auth.login`    | no         | Wallet-challenge → signature → wallet-session token (cached for 30 min). |
| `x402.pay`             | yes        | Hits a 402-protected endpoint, signs the X-PAYMENT header, retries once. |

## Inputs

`signed_envelope.emit` expects `{ name: string, attributes?: object, status?: "OK" | "ERROR" }`.
`wallet_auth.login` expects nothing — uses `ctx.deps.wallet` (an EOA private key).
`x402.pay` expects `{ url: string, method?: string, body?: unknown, max_price_usdc?: number }`.

## Outputs

Each handler returns `{ ok: true, output: ... }` on success.

## Examples

See `commands/quickstart.md`.

## Gotchas

- `signed_envelope.emit` requires the agent has called `POST /agents/:id/signing-keys`
  to register its public key. Skill auto-registers on first call.
- `wallet_auth.login` issues a token valid for 30 min; the helper caches it
  in-process. After process restart you'll see one challenge round-trip on first call.
- The `format: "recovered"` quirk in `@noble/curves` v2 means the recovery byte
  is the FIRST byte of the 65-byte signature (NOT last). Helpers handle this
  internally; if you call sign yourself, prepend recovery, do not append.
- `x402.pay` deliberately performs ONE signed retry. If the gateway returns
  402 again (e.g. wrong wallet), the helper does NOT keep guessing — it returns
  `{ ok: false }` so the planner can decide.
- Per AR-Skills-v1, the helper handlers in this skill (signing, login, x402) are
  free. AR's _paid_ products (Trust Card, KYA, scan, retraining) are NEVER
  packaged as skill handlers — see AGENTS.md.
