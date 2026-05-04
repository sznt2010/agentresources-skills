import type { SkillHandler } from "@agentresources/skill-types";

type Json = Record<string, unknown>;

const apiBase = (ctx: { apiUrl?: string }) => ctx.apiUrl ?? "https://api.agentresources.xyz";

const leadCreate: SkillHandler<Json, Json> = {
  kind: "lead.create",
  reversible: true,
  description: "Create a lead.",
  async handler({ input, ctx }) {
    const handle = String((input as Json).contact_handle ?? "").trim();
    if (!handle) return { ok: false, error: "contact_handle required" };
    const res = await ctx.http.request("POST", `${apiBase(ctx)}/api/v1/agents/me/leads`, {
      body: input,
    });
    return res.statusCode === 201
      ? { ok: true, output: res.body as Json }
      : { ok: false, error: `gateway ${res.statusCode}: ${JSON.stringify(res.body)}` };
  },
};

const leadUpdate: SkillHandler<{ id: string; stage?: string; [k: string]: unknown }, Json> = {
  kind: "lead.update",
  reversible: true,
  description: "Update a lead.",
  async handler({ input, ctx }) {
    const id = String((input as Json).id ?? "");
    if (!id) return { ok: false, error: "id required" };
    const stage = (input as Json).stage as string | undefined;
    if (stage === "won") {
      const ok = await ctx.ownerApproval.request({
        action: "lead.update.won",
        reason: `marking lead ${id} as won`,
      });
      if (!ok.granted) return { ok: false, error: "owner_refused" };
    }
    const { id: _id, ...patch } = input as Json;
    const res = await ctx.http.request(
      "PATCH",
      `${apiBase(ctx)}/api/v1/agents/me/leads/${encodeURIComponent(id)}`,
      { body: patch },
    );
    return res.statusCode === 200
      ? { ok: true, output: res.body as Json }
      : { ok: false, error: `gateway ${res.statusCode}: ${JSON.stringify(res.body)}` };
  },
};

const leadList: SkillHandler<Json, Json> = {
  kind: "lead.list",
  reversible: false,
  description: "List leads.",
  async handler({ input, ctx }) {
    const res = await ctx.http.request("GET", `${apiBase(ctx)}/api/v1/agents/me/leads`, {
      query: input as Json,
    });
    return { ok: true, output: res.body as Json };
  },
};

const leadLogInteraction: SkillHandler<
  { id: string; kind: string; summary: string; stage_after?: string; payload?: Json },
  Json
> = {
  kind: "lead.log_interaction",
  reversible: true,
  description: "Append an interaction.",
  async handler({ input, ctx }) {
    const id = String((input as Json).id ?? "");
    if (!id) return { ok: false, error: "id required" };
    const { id: _id, ...body } = input as Json;
    const res = await ctx.http.request(
      "POST",
      `${apiBase(ctx)}/api/v1/agents/me/leads/${encodeURIComponent(id)}/interactions`,
      { body },
    );
    return res.statusCode === 201
      ? { ok: true, output: res.body as Json }
      : { ok: false, error: `gateway ${res.statusCode}: ${JSON.stringify(res.body)}` };
  },
};

const handlers: SkillHandler[] = [leadCreate, leadUpdate, leadList, leadLogInteraction];
export default handlers;
export { handlers };
