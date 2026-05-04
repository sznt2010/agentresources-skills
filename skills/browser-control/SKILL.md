---
name: browser-control
version: 1.0.0
description: Headless browser automation (open, click, type, screenshot, scrape) via Playwright.
when_to_use: |
  When the agent must read or interact with a website that lacks a clean API.
  All actions are owner-approval-gated for non-allowlisted domains.
metadata:
  principle: |
    Browse the same web humans browse, but never click `submit` on a transaction
    flow without owner approval. Keep robots.txt in mind; don't hammer.
  quality_gates:
    - "Refuses navigations to non-https URLs unless explicitly allowed"
    - "Refuses form submission on financial/checkout pages without owner approval"
    - "Refuses if WITH_BROWSER build arg was not set (Playwright not installed)"
  mode: mcp-live
  requires_knowledge: []
  requires_build_args:
    - WITH_BROWSER
  commands:
    - quickstart
---

# browser-control

Playwright-driven headless Chromium for the agent. Skipped at runtime if the
container was not built with `WITH_BROWSER=1`.

## Handlers

| `kind`               | Reversible | Notes                                  |
| -------------------- | ---------- | -------------------------------------- |
| `browser.open`       | yes        | Opens a new page (returns page id).    |
| `browser.click`      | yes        | Clicks a CSS selector on an open page. |
| `browser.type`       | yes        | Types text into a focused element.     |
| `browser.screenshot` | no         | PNG bytes (base64).                    |
| `browser.scrape`     | no         | Returns innerText of a selector.       |

## Gotchas

- Playwright adds ~300 MB to the runtime image. Build with `WITH_BROWSER=1` ONLY if you need it.
- The skill keeps page handles in-process. After process restart, re-open the page.
- `browser.click` on inputs of type `submit` triggers the owner-approval gate
  unless the host is on the allow-list (`ctx.deps.browser.allowedHosts`).
- `browser.screenshot` truncates above 4 MB to avoid token blow-up on the planner.
- Use `wait_for: "networkidle"` (default) instead of fixed sleeps.
