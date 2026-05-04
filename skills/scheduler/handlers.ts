import type { SkillHandler } from "@agentresources/skill-types";

type Json = Record<string, unknown>;
const apiBase = (ctx: { apiUrl?: string }) => ctx.apiUrl ?? "https://api.agentresources.xyz";

const TOO_FAST_CRON = /^\*\/[1-9]\s/; // every-N-min where N<10 or */ in seconds field is forbidden anyway

const scheduleAt: SkillHandler<{ run_at: string; action: Json; description?: string }, Json> = {
  kind: "schedule.at",
  reversible: true,
  description: "One-shot future schedule.",
  async handler({ input, ctx }) {
    const runAt = String((input as Json).run_at ?? "");
    const t = Date.parse(runAt);
    if (!Number.isFinite(t)) return { ok: false, error: "run_at must be ISO timestamp" };
    if (t < Date.now() - 5 * 60 * 1000) return { ok: false, error: "run_at_too_far_in_past" };
    const res = await ctx.http.request("POST", `${apiBase(ctx)}/api/v1/agents/me/goals`, {
      body: { kind: "scheduled", run_at: runAt, payload: input },
    });
    return res.statusCode === 201
      ? { ok: true, output: res.body as Json }
      : { ok: false, error: `gateway ${res.statusCode}` };
  },
};

const scheduleCron: SkillHandler<{ cron: string; action: Json; description?: string }, Json> = {
  kind: "schedule.cron",
  reversible: true,
  description: "Recurring schedule.",
  async handler({ input, ctx }) {
    const cron = String((input as Json).cron ?? "");
    const fields = cron.trim().split(/\s+/);
    if (fields.length !== 5) return { ok: false, error: "cron_must_be_5_fields" };
    if (TOO_FAST_CRON.test(cron) && fields[0]?.startsWith("*/")) {
      const n = Number(fields[0].slice(2));
      if (Number.isFinite(n) && n < 1) return { ok: false, error: "cron_too_fast" };
    }
    const res = await ctx.http.request("POST", `${apiBase(ctx)}/api/v1/agents/me/goals`, {
      body: { kind: "scheduled", cron, payload: input },
    });
    return res.statusCode === 201
      ? { ok: true, output: res.body as Json }
      : { ok: false, error: `gateway ${res.statusCode}` };
  },
};

const scheduleCancel: SkillHandler<{ goal_id: string }, Json> = {
  kind: "schedule.cancel",
  reversible: true,
  description: "Cancel a scheduled task by goal id.",
  async handler({ input, ctx }) {
    const id = String((input as Json).goal_id ?? "");
    if (!id) return { ok: false, error: "goal_id required" };
    const res = await ctx.http.request(
      "DELETE",
      `${apiBase(ctx)}/api/v1/agents/me/goals/${encodeURIComponent(id)}`,
    );
    return res.statusCode === 200 || res.statusCode === 204
      ? { ok: true, output: { cancelled: id } }
      : { ok: false, error: `gateway ${res.statusCode}` };
  },
};

const handlers: SkillHandler[] = [scheduleAt, scheduleCron, scheduleCancel];
export default handlers;
export { handlers };
