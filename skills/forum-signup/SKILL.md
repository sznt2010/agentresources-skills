---
name: forum-signup
version: 1.0.0
description: Sign up for a forum/account using browser-control + email IMAP OTP polling.
when_to_use: |
  When the agent needs to register a new account on a forum, mailing list,
  or signup-gated site. Coordinates: navigate → fill → submit → poll OTP →
  enter → done. Owner approval required before submitting the form.
metadata:
  principle: |
    Sign up only on forums where the agent is welcome. Refuse drive-by
    signups. Email OTPs are decoded server-side; the runtime never sees
    the mailbox password.
  quality_gates:
    - "Refuses without owner approval before submit"
    - "Refuses if no active email_imap credential exists"
    - "Refuses if email OTP not delivered within poll_window_seconds"
  mode: mcp-live
  requires_knowledge: []
  requires_build_args:
    - WITH_BROWSER
  commands:
    - quickstart
---

# forum-signup

Coordinates a multi-step signup flow:

| Step              | Action                                                              |
| ----------------- | ------------------------------------------------------------------- |
| 1. Navigate       | `browser.navigate` to the signup URL                                |
| 2. Fill           | `browser.fill` username/email/password from input                   |
| 3. Owner approval | `ctx.ownerApproval.request` — required before submitting            |
| 4. Submit         | `browser.click` the submit button                                   |
| 5. Poll OTP       | `email.poll_otp` (gateway) — wait up to `poll_window_seconds`       |
| 6. Enter code     | `browser.fill` the OTP field, then `browser.click` confirm          |
| 7. Record         | Emit `forum.signup_complete` span; runtime stores it as memory.fact |

## Handlers

| `kind`         | Reversible | Notes                                               |
| -------------- | ---------- | --------------------------------------------------- |
| `forum.signup` | no         | Full signup orchestration. Requires owner approval. |

## Inputs

```json
{
  "kind": "forum.signup",
  "input": {
    "url": "https://moltbook.forum/register",
    "platform": "moltbook.forum",
    "username": "marc-ar",
    "email": "marc@agentresources.xyz",
    "password": "<runtime-generated>",
    "submit_selector": "#signup-button",
    "username_selector": "#username",
    "email_selector": "#email",
    "password_selector": "#password",
    "otp_selector": "#otp-code",
    "otp_confirm_selector": "#otp-submit",
    "poll_window_seconds": 300,
    "from_filter": "noreply@moltbook.forum"
  }
}
```

## Gotchas

- `browser.*` actions need `WITH_BROWSER=1` in the runtime container build.
  Without it the skill returns `error: "platform_not_configured"`.
- Owner approval is requested BEFORE the submit click — once submitted, the
  signup is non-reversible (most forums don't allow self-delete).
- The OTP poll calls gateway `POST /agents/me/email/poll-otp` with
  `from_filter` and `subject_filter`. The gateway decrypts the agent's
  `email_imap` credential server-side. The runtime never sees the password.
- The OTP regex looks for any 6-8 digit code in subject + body. If the forum
  sends a magic-link instead of a numeric code, this skill returns
  `error: "otp_format_unsupported"` — extend the gateway poll-otp regex
  rather than working around it here.
- Default `poll_window_seconds=300` (5 min). Some forums delay email by 60s+
  due to SPF/DKIM batching; bump to 600 if you see frequent timeouts.
- The skill emits `forum.signup_complete` regardless of forum-engagement
  ratio. To then POST on the forum you still need to satisfy the
  `forum.engage` gate (≥3 prior `forum.read`/`forum.reply` on the domain).
