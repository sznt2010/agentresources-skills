# AR Skills v1 — Authoring Specification

**Status:** Canonical. All AR-published skills MUST conform.
**Last updated:** 4 May 2026
**Audience:** Skill authors (Istvan + Copilot only — see D14.b access lock).
**Reference decisions:** D4, D8, D9, D10, D18.b, D19.a, D27, D29, D31, D34.

This document is the canonical authoring spec for skills published in this repository and served at `agentresources.xyz/skills/<name>/`. Every skill in `skills/` (excluding `_template/`) MUST follow this layout. The CI gate `scripts/validate-skills.ts` enforces it.

---

## What is an AR skill?

An AR skill is a **single-folder, framework-neutral capability pack** an autonomous agent can fork by copying the folder. Every skill is **simultaneously documentation and code**: a human reads `SKILL.md`, an autonomous agent imports `handlers.ts`. There is no docs-only vs runtime-only split.

Forking happens by:

1. Cloning or copying `skills/<name>/` into the consuming agent's runtime, OR
2. Calling the AR CLI: `ar skill add <name>` (live-fetch from `agentresources.xyz/skills/<name>/`).

Skills are **free**, by policy. If something is paid (Trust Card, KYA scan, retraining, on-chain attestation), it is NOT a skill — see AGENTS.md "Skills are free, by policy."

---

## Folder layout (every skill is identical)

```
skills/<name>/
├── SKILL.md                        ← required. Human-readable spec + Gotchas section.
├── skill.json                      ← required. Machine manifest with 5 AR extension fields.
├── handlers.ts                     ← required. Default-exports SkillHandler[].
├── .claude-plugin/
│   └── marketplace.json            ← required. Anthropic Official Marketplace listing.
├── commands/                       ← required directory. May be empty.
│   └── quickstart.md               ← recommended. /<name>:quickstart slash-command.
├── scripts/                        ← required directory. May be empty. Helper scripts callable by handlers.
├── references/                     ← required directory. May be empty. Knowledge fragments bundled with skill.
└── README.md                       ← optional. Marketing-site short blurb (separate from SKILL.md body).
```

The CI gate fails if any required file/directory is missing.

---

## SKILL.md format

YAML frontmatter + Markdown body. Frontmatter follows agentskills.io v1; AR-specific fields live in the `metadata:` block (D31.c).

```yaml
---
name: example-skill                    # kebab-case, must match folder name
version: 1.0.0                         # semver
description: One-line summary, ≤120 chars.
when_to_use: |
  When the agent needs to do X. Specific triggers: A, B, C.
metadata:
  principle: |                         # D18.b — invariant rule the skill encodes (WHAT)
    The single rule this skill never violates.
  quality_gates:                       # D8.b — hard refusals enforced at autonomous-session boundary
    - "Refuses if input lacks signature"
    - "Refuses if rate-limit budget exceeded"
  mode: paste | mcp-live | both        # D8.b — data-access posture
  requires_knowledge:                  # D19.a — L3 knowledge packs fetched at runtime
    - trust-card
    - erc8004
  requires_build_args:                 # AR runtime hint: Docker layers needed
    - WITH_BROWSER                     # only set when the skill imports playwright/heavy native deps
  commands:                            # D29.a — slash-commands provided in commands/
    - quickstart
---

# Example Skill

[Body — what the skill does, how to use it, examples.]

## Gotchas    <!-- REQUIRED section per D27.c gate 6 -->

Real failure points the agent should know about. Not generic warnings.

- [Specific failure mode #1, with mitigation]
- [Specific failure mode #2, with mitigation]
```

### Required SKILL.md sections

1. `# <Skill display name>` (H1) — first non-frontmatter line.
2. Body explaining what the skill does + when to use it.
3. `## Gotchas` (H2) section — at least one bullet, real failure points (D27.c gate 6).

The body MUST be ≤500 lines (D31.a — readability gate).

---

## skill.json format

```json
{
  "$schema": "https://agentresources.xyz/schemas/skill-manifest-v1.json",
  "name": "example-skill",
  "version": "1.0.0",
  "skill_hash": "sha256:<hex digest of SKILL.md, computed at publish time>",
  "trusted_contact": "@ar-team",
  "ar_metadata": {
    "quality_gates_count": 2,
    "data_locality": "local | gateway | cloud",
    "verified_at": "2026-05-04T00:00:00Z"
  }
}
```

The 5 AR extension fields (D27.b):

| Field                             | Type   | Source of truth                                                                |
| --------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `name`                            | string | matches folder + SKILL.md frontmatter                                          |
| `skill_hash`                      | string | sha256 over `SKILL.md` byte-for-byte (computed by `validate-skills.ts`)        |
| `trusted_contact`                 | string | always `@ar-team` for AR-published skills                                      |
| `ar_metadata.quality_gates_count` | int    | length of frontmatter `quality_gates` array                                    |
| `ar_metadata.data_locality`       | enum   | `local` (no I/O), `gateway` (calls AR gateway), `cloud` (calls 3rd-party APIs) |

`skill_hash` is computed at publish time by the CI gate. Authors leave it as `sha256:placeholder` during development; the gate fills it in.

---

## handlers.ts format

```ts
import type { SkillHandler } from "@agentresources/skill-types";

export const handlers: SkillHandler[] = [
  {
    kind: "example.do_thing",
    reversible: false,
    handler: async (action, ctx) => {
      // ctx provides: http (undici), emitSpan, recall, remember, ownerApproval, deps
      // action.input is unknown — validate at the top of the handler
      return {
        ok: true,
        output: {
          /* ... */
        },
      };
    },
  },
];

export default handlers;
```

Rules:

- `kind` MUST be namespaced: `<skill-name-snake>.<verb>`. Wildcard dispatch (`<skill>.*`) supported by the runtime — the dispatcher first tries an exact match, then `prefix.*`, then a bare top-level fallback.
- `reversible: true` triggers the runtime's reversible-write gate (dry-run preview → owner approval → confirm).
- Handlers MUST be pure with respect to side effects: all external calls go through `ctx.http` or `ctx.deps.*` (DI for testability).
- Handlers MUST emit at least one telemetry span per invocation (`ctx.emitSpan(...)`); the safety harness handles the `action.<kind>` span automatically — emit additional sub-spans for substeps.
- No top-level side-effects in the module. Imports must not run code at load time.

---

## .claude-plugin/marketplace.json (D29.b)

Required for Anthropic Official Marketplace listing. Minimal shape:

```json
{
  "name": "agent-resources/<skill-name>",
  "displayName": "Skill Display Name",
  "description": "One-liner from SKILL.md frontmatter.",
  "version": "1.0.0",
  "skill_path": "./SKILL.md"
}
```

---

## commands/ folder (D29.a)

`commands/<verb>.md` is a Markdown file whose body becomes the system prompt for `/<skill-name>:<verb>` slash-commands invoked by the consuming runtime. Optional but recommended.

Example: `commands/quickstart.md` → triggers as `/agent-resources:quickstart`.

The runtime's planner, when it sees an owner directive matching `/<skill>:<verb>`, loads the matching `commands/<verb>.md` and inlines it into the planner system prompt. If the file is missing, the dispatcher falls back to the handler directly without prompt enrichment.

---

## scripts/ folder

Helper scripts (`.ts` or `.sh`) that handlers may shell out to. Keep them small. Anything reusable across skills belongs in `packages/sdk/` or `packages/agent-runtime-utils/` instead.

---

## references/ folder

Read-only knowledge fragments bundled with the skill. Examples:

- `references/erc8004-addresses.md` — pin contract addresses the skill assumes.
- `references/telegram-rate-limits.md` — known constraints the skill must respect.

Reference files are NOT loaded automatically. Handlers `import` them via `fs.readFileSync` if needed, or the consuming agent reads them as docs.

---

## 6-gate pre-delivery checklist (D27.c)

Every AR-published skill MUST pass these 6 gates. The CI script `scripts/validate-skills.ts` enforces all 6 mechanically:

1. **agentskills.io v1 schema valid** — frontmatter parses, required keys present.
2. **`skill.json` complete** — all 5 AR extension fields populated.
3. **`trusted_contact` declared** — exactly `@ar-team` for AR-published skills.
4. **`skill_hash` matches body** — `sha256(SKILL.md)` equals `skill.json.skill_hash`.
5. **`marketplace.json` present** — `.claude-plugin/marketplace.json` exists with required fields.
6. **Gotchas section present** — `## Gotchas` H2 in SKILL.md body with at least one bullet.

The CI gate runs as part of `pnpm --filter=@ar/gateway run test` (via `tests/skills.test.ts`) and as a standalone command `pnpm run validate:skills`.

---

## Adding a new skill

```bash
cp -r skills/_template skills/my-new-skill
# Edit SKILL.md, skill.json, handlers.ts, .claude-plugin/marketplace.json
pnpm run validate:skills          # must pass before commit
```

---

## Forking by an autonomous agent

Two paths:

**(a) Copy the folder.** From any framework — Claude Code, Cursor, OpenClaw, LangChain, Vercel, custom — copy `skills/<name>/` into the agent's runtime skill directory. SKILL.md is the human-readable spec; handlers.ts is importable from any TypeScript/Node runtime.

**(b) Use the CLI.** `ar skill add <name>` fetches the latest from `agentresources.xyz/skills/<name>/` and places it in the active runtime's skill directory. See D34.b.

Both paths produce an identical, working skill.

---

## Versioning + lifecycle

- Skills follow semver. Breaking handler-shape changes = MAJOR bump.
- Skill catalog edges (`supersedes` / `relates_to` / `duplicates`) live in `skill.json.ar_metadata.relations` (Phase 17+, see D15.b).
- Old versions remain at `agentresources.xyz/skills/<name>/<version>/` permanently. The unsuffixed URL points to the latest.

---

## What this spec does NOT cover

- **Paid skills.** None exist. Skills are free, by policy.
- **Per-IDE native plugins.** Rejected in D17.b. The 6-IDE `init` coverage in D16.b + D21.b is the only IDE-specific surface AR ships.
- **Selective disclosure / zk proofs over skill claims.** Phase 22 and Phase 24 territory. Not in scope here.

---

## Feedback / contributions

Skill submissions are not open. Per D14.b access lock, only Istvan + Copilot author and publish AR skills. External agents fork freely; they do not contribute back to this folder.
