import type { SkillHandler } from "@agentresources/skill-types";

type Json = Record<string, unknown>;
const apiBase = (ctx: { apiUrl?: string }) => ctx.apiUrl ?? "https://api.agentresources.xyz";

const mentionList: SkillHandler<Json, Json> = {
  kind: "mention.list",
  reversible: false,
  description: "List mentions.",
  async handler({ input, ctx }) {
    const res = await ctx.http.request("GET", `${apiBase(ctx)}/api/v1/agents/me/mentions`, {
      query: input as Json,
    });
    return { ok: true, output: res.body as Json };
  },
};

const mentionSubscribe: SkillHandler<
  { keyword: string; platform?: string; cadence_seconds?: number; metadata?: Json },
  Json
> = {
  kind: "mention.subscribe",
  reversible: true,
  description: "Add a subscription.",
  async handler({ input, ctx }) {
    const keyword = String((input as Json).keyword ?? "").trim();
    if (!keyword) return { ok: false, error: "keyword required" };
    const res = await ctx.http.request(
      "POST",
      `${apiBase(ctx)}/api/v1/agents/me/mention-subscriptions`,
      { body: input },
    );
    return res.statusCode === 201
      ? { ok: true, output: res.body as Json }
      : { ok: false, error: `gateway ${res.statusCode}: ${JSON.stringify(res.body)}` };
  },
};

const mentionUnsubscribe: SkillHandler<{ subscription_id: string }, Json> = {
  kind: "mention.unsubscribe",
  reversible: true,
  description: "Cancel a subscription.",
  async handler({ input, ctx }) {
    const id = String((input as Json).subscription_id ?? "");
    if (!id) return { ok: false, error: "subscription_id required" };
    const res = await ctx.http.request(
      "DELETE",
      `${apiBase(ctx)}/api/v1/agents/me/mention-subscriptions/${encodeURIComponent(id)}`,
    );
    return res.statusCode === 200
      ? { ok: true, output: res.body as Json }
      : { ok: false, error: `gateway ${res.statusCode}` };
  },
};

const mentionAcknowledge: SkillHandler<{ mention_id: string }, Json> = {
  kind: "mention.acknowledge",
  reversible: true,
  description: "Mark mention acknowledged.",
  async handler({ input, ctx }) {
    const id = String((input as Json).mention_id ?? "");
    if (!id) return { ok: false, error: "mention_id required" };
    const res = await ctx.http.request(
      "POST",
      `${apiBase(ctx)}/api/v1/agents/me/mentions/${encodeURIComponent(id)}/acknowledge`,
    );
    return res.statusCode === 200
      ? { ok: true, output: res.body as Json }
      : { ok: false, error: `gateway ${res.statusCode}` };
  },
};

const handlers: SkillHandler[] = [
  mentionList,
  mentionSubscribe,
  mentionUnsubscribe,
  mentionAcknowledge,
];
export default handlers;
export { handlers };
