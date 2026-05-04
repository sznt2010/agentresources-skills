/**
 * captcha-solver — owner-paste-only at launch (D40).
 *
 * Every solve escalates via `ctx.ownerApproval.request`. The owner reviews the
 * captcha image (passed in the reason text) and pastes the solution into the
 * approval response. No paid solver backend is wired — that's deferred to
 * Phase 17+.
 */
import type { SkillHandler } from "@agentresources/skill-types";

type Json = Record<string, unknown>;

const recentSolves: number[] = [];
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 3;

const captchaSolve: SkillHandler<
  { image_base64?: string; sitekey?: string; url?: string; type?: string },
  Json
> = {
  kind: "captcha.solve",
  reversible: true,
  description: "Owner-paste-only captcha solve. Every call requires owner approval.",
  async handler({ input, ctx }) {
    const now = Date.now();
    while (recentSolves.length && recentSolves[0]! < now - RATE_WINDOW_MS) recentSolves.shift();
    if (recentSolves.length >= RATE_LIMIT) {
      return { ok: false, error: "captcha_rate_exceeded — likely loop, redesign workflow" };
    }
    recentSolves.push(now);

    const img = String((input as Json).image_base64 ?? "");
    if (img && Buffer.from(img, "base64").length > 2 * 1024 * 1024) {
      return { ok: false, error: "image_too_large" };
    }
    const sitekey = String((input as Json).sitekey ?? "");
    const url = String((input as Json).url ?? "");
    const type = String((input as Json).type ?? "image");

    const approval = await ctx.ownerApproval.request({
      action: "captcha.solve",
      reason: `Solve ${type} captcha on ${url} (sitekey=${sitekey || "n/a"}). Reply with solution text.`,
      payload: { image_base64: img, sitekey, url, type },
    });
    if (!approval.granted) return { ok: false, error: "owner_refused" };
    const solution = String((approval as { value?: unknown }).value ?? "").trim();
    if (!solution) return { ok: false, error: "owner_returned_empty_solution" };
    return { ok: true, output: { solution } };
  },
};

const handlers: SkillHandler[] = [captchaSolve];
export default handlers;
export { handlers };
