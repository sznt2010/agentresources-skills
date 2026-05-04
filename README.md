# Agent Resources Skills

> Free, MIT skills for autonomous agents. Cryptographic trust layer included.

[![Verify mirror](https://github.com/sznt2010/agentresources-skills/actions/workflows/verify-mirror.yml/badge.svg)](https://github.com/sznt2010/agentresources-skills/actions/workflows/verify-mirror.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

This repo is the public mirror of the 10 [Agent Resources](https://agentresources.xyz)
skills. The canonical source lives in the AR monorepo and is mirrored here
byte-identically so `skills.sh`, `officialskills.sh`, and any agent that
clones this repo can read the same files an AR-native runtime loads.

## Install

```sh
# Pull every skill in this repo into your project's skill folder:
npx skills add agentresources/skills

# Or fork a single skill bundle directly from the AR website:
curl -sSL https://agentresources.xyz/skills/agent-resources/bundle.tar.gz | tar -xz
```

## The 10 skills

| Skill                                                                    | Type        | What it does                                                                                             |
| ------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------- |
| [`agent-resources`](./skills/agent-resources/SKILL.md)                   | orientation | Trust Cards, signed telemetry, wallet auth, x402 payments — the AR primer every agent should read first. |
| [`verify-trust-card`](./skills/verify-trust-card/SKILL.md)               | action      | Verify any AR-issued Trust Card (EIP-712) and cross-check against the on-chain ERC-8004 NFT.             |
| [`browser-control`](./skills/browser-control/SKILL.md)                   | action      | Playwright-driven browser automation gated by a `WITH_BROWSER=1` build arg.                              |
| [`cross-platform-messaging`](./skills/cross-platform-messaging/SKILL.md) | action      | Telegram / Discord / X / email send + broadcast with hard-rate caps.                                     |
| [`lead-crm`](./skills/lead-crm/SKILL.md)                                 | action      | Track leads + interactions on the AR gateway.                                                            |
| [`content-writer`](./skills/content-writer/SKILL.md)                     | action      | LiteLLM-backed copy with hard refusal regex.                                                             |
| [`web-search`](./skills/web-search/SKILL.md)                             | action      | Brave / Tavily / SerpAPI search with dependency injection.                                               |
| [`scheduler`](./skills/scheduler/SKILL.md)                               | action      | Cron-style goal scheduling on the AR soul-loop.                                                          |
| [`reputation-watch`](./skills/reputation-watch/SKILL.md)                 | action      | Mention monitoring across X / Telegram / Discord / Reddit / HN / RSS.                                    |
| [`captcha-solver`](./skills/captcha-solver/SKILL.md)                     | action      | Owner-paste-only at launch — every solve escalates via owner approval.                                   |

## Skills are free

These skills are **free**, by policy. Paid AR products — Trust Card issuance,
Scan, KYA, Retraining, on-chain attestation — are billable API services and
are explicitly NOT distributed as skills. See
[PHILOSOPHY](https://agentresources.xyz/philosophy) for the full rationale.

## Crypto-scam notice

AR has **no token, no presale, no airdrop, no points, no staking**. We will
**never** DM you to ask for seed phrases, private keys, or funds. The only
on-chain artefacts are ERC-8004 Identity NFTs, daily Merkle anchors, and the
AR Treasury Agent (Base mainnet `tokenId 45880`). Report impersonation to
contact@agentresources.xyz.

## How this repo stays in sync

This repo is a downstream **mirror** of the canonical source at
`agentresources.xyz/skills/<slug>/SKILL.md`. CI verifies byte-identical match
on every push. To open a PR, edit the canonical source in the AR monorepo —
the change will land here via the next sync.

## License

[MIT](./LICENSE) © Agent Resources

## Trust Card

Verify the publisher of this repo:
[https://api.agentresources.xyz/.well-known/trust-card/agent/32f4ec0b-452e-467d-997b-ebd49730bb0a](https://api.agentresources.xyz/.well-known/trust-card/agent/32f4ec0b-452e-467d-997b-ebd49730bb0a)
