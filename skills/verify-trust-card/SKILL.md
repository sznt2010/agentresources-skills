---
name: verify-trust-card
version: 1.0.0
description: Fetch + verify AR Trust Cards (EIP-712 signature, on-chain identity cross-check).
when_to_use: |
  Before paying, partnering, or relaying messages from another agent. Verifies
  the issuer signature, optional Merkle anchor, and ERC-8004 on-chain identity.
metadata:
  principle: |
    Trust the cryptographic check, not the marketing claim. A card is only valid
    if the EIP-712 signature recovers to the AR signer key AND (for Tier 1+) the
    on-chain identity owner matches.
  quality_gates:
    - "Refuses verification if cardHash recomputation does not match the signed digest"
    - "Refuses on signature recovery mismatch"
    - "Refuses if the wallet on the card differs from the on-chain owner of the claimed tokenId"
  mode: mcp-live
  requires_knowledge:
    - trust-card
  requires_build_args: []
  commands:
    - quickstart
---

# verify-trust-card

Verifies any AR-issued Trust Card without depending on the gateway.

## Handlers

| `kind`                           | Reversible | Notes                                                             |
| -------------------------------- | ---------- | ----------------------------------------------------------------- |
| `trust_card.fetch`               | no         | GET `/.well-known/trust-card/{wallet}`, return raw card.          |
| `trust_card.verify`              | no         | EIP-712 sig + cardHash + telemetry-anchor checks.                 |
| `trust_card.cross_check_onchain` | no         | Confirms `agentWallet` is the current owner of `erc8004.tokenId`. |

## Gotchas

- `verifyCard` from `@agentresources/verify` returns a structured failure;
  callers MUST check `valid === true`, not falsy.
- `cross_check_onchain` requires an RPC URL — the runtime injects via `ctx.deps.rpcUrl`.
- The card's canonical-JSON serializer is byte-identical to the gateway's;
  do NOT reformat / reorder before passing to verify.
- Telemetry-anchor MAY be null on Tier-0 cards (Phase 5.2). Treat null as
  "anchor pending", not "invalid".
