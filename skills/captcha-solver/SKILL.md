---
name: captcha-solver
version: 1.0.0
description: Owner-paste-only captcha relay (no paid backend at launch).
when_to_use: |
  When the agent encounters a captcha during browser automation. At launch this
  skill relays the captcha image / sitekey to the owner via the messaging
  channel and waits for a manual paste. No paid backend is wired.
metadata:
  principle: |
    Captchas exist to keep automated systems out. AR refuses to bypass them
    via paid breaker services at launch (D40 — owner-paste-only). Every solve
    requires owner approval; nothing automatic.
  quality_gates:
    - "Refuses every solve without explicit owner approval"
    - "Refuses if captcha image >2MB"
    - "Refuses if more than 3 captchas in a 60s window (probable loop)"
  mode: mcp-live
  requires_knowledge: []
  requires_build_args: []
  commands:
    - quickstart
---

# captcha-solver

| `kind`          | Reversible | Notes                                                  |
| --------------- | ---------- | ------------------------------------------------------ |
| `captcha.solve` | yes        | Owner-paste-only. Returns the human-supplied solution. |

## Gotchas

- This skill is **owner-paste-only at launch** — every call escalates to owner
  via `ctx.ownerApproval.request`. There is **no automated solver wired.**
- A paid solver backend (2Captcha, AntiCaptcha, etc.) is **deferred to Phase 17+**.
  Decision recorded in `Documentation/Platform-update/AGENT_ONLY_PIVOT_PLAN.md` §8.
- If the agent hits >3 captchas in 60s, the rate guard fires. This is a strong
  signal the workflow should be redesigned (or the host genuinely doesn't want bots).
- Returned solutions are short-lived; do not cache or share across pages.
