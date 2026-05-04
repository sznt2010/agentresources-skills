/**
 * agent-resources — orientation + AR-protocol helpers.
 *
 * Forkable: copy this folder into your own repo and invoke handlers
 * directly. Depends on `@agentresources/skill-types` (forkable contract)
 * and `@agentresources/sdk` (canonical-JSON + signing helpers).
 */
import type { SkillHandler } from "@agentresources/skill-types";

type Json = Record<string, unknown>;

const AR_API = (apiUrl?: string) => apiUrl ?? "https://api.agentresources.xyz";

// ── docs.search ─────────────────────────────────────────────────────────
const docsSearch: SkillHandler<{ query: string; limit?: number }, Json> = {
  kind: "docs.search",
  reversible: false,
  description: "Full-text search of the AR docs bundle.",
  async handler({ input, ctx }) {
    const query = String((input as Json).query ?? "").trim();
    if (!query) return { ok: false, error: "query required" };
    const limit = Number((input as Json).limit ?? 5);
    const res = await ctx.http.request("GET", `${AR_API(ctx.apiUrl)}/api/v1/docs/search`, {
      query: { q: query, limit },
    });
    return { ok: true, output: res.body as Json };
  },
};

// ── docs.fetch ──────────────────────────────────────────────────────────
const docsFetch: SkillHandler<{ slug: string }, Json> = {
  kind: "docs.fetch",
  reversible: false,
  description: "Fetch a documentation page by slug.",
  async handler({ input, ctx }) {
    const slug = String((input as Json).slug ?? "").trim();
    if (!slug) return { ok: false, error: "slug required" };
    const res = await ctx.http.request(
      "GET",
      `${AR_API(ctx.apiUrl)}/api/v1/docs/${encodeURIComponent(slug)}`,
    );
    return { ok: true, output: res.body as Json };
  },
};

// ── endpoint.find ───────────────────────────────────────────────────────
const endpointFind: SkillHandler<{ name: string }, Json> = {
  kind: "endpoint.find",
  reversible: false,
  description: "Resolve a named endpoint from /.well-known/agent-services.json.",
  async handler({ input, ctx }) {
    const name = String((input as Json).name ?? "").trim();
    if (!name) return { ok: false, error: "name required" };
    const manifest = await ctx.http.request(
      "GET",
      `${AR_API(ctx.apiUrl)}/.well-known/agent-services.json`,
    );
    const services = (manifest.body as Json).services as Record<string, unknown> | undefined;
    const endpoint = services?.[name];
    if (!endpoint) return { ok: false, error: `endpoint ${name} not found` };
    return { ok: true, output: { endpoint } };
  },
};

// ── signed_envelope.emit ───────────────────────────────────────────────
const signedEnvelopeEmit: SkillHandler<
  { name: string; attributes?: Json; status?: "OK" | "ERROR" },
  Json
> = {
  kind: "signed_envelope.emit",
  reversible: false,
  description: "Sign + chain a telemetry span and POST to the gateway.",
  async handler({ input, ctx }) {
    const name = String((input as Json).name ?? "").trim();
    if (!name) return { ok: false, error: "span name required" };
    const span = {
      name,
      status: ((input as Json).status as string) ?? "OK",
      attributes: ((input as Json).attributes as Json) ?? {},
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
    };
    // The gateway's ingest endpoint accepts unsigned spans too; the runtime
    // layer (or a forked agent's signer) wraps with the chained envelope.
    // Skills do not perform signing themselves to avoid leaking key material.
    await ctx.emitSpan({ name: `skill.${name}`, attributes: span.attributes, status: span.status });
    return { ok: true, output: { emitted: true, name } };
  },
};

// ── wallet_auth.login ──────────────────────────────────────────────────
const walletAuthLogin: SkillHandler<Json, Json> = {
  kind: "wallet_auth.login",
  reversible: false,
  description: "Stub: wallet-session login is performed by the runtime, not skills.",
  async handler({ ctx }) {
    // The runtime injects an authed http client; if the agent reaches this
    // skill, it already has a token. We expose the helper so forked agents
    // can document the protocol; the actual login is runtime-level.
    return {
      ok: true,
      output: {
        note: "wallet_auth.login is performed by the AR runtime before skill dispatch",
        identity: ctx.identity,
      },
    };
  },
};

// ── x402.pay ───────────────────────────────────────────────────────────
const x402Pay: SkillHandler<
  { url: string; method?: string; body?: unknown; max_price_usdc?: number },
  Json
> = {
  kind: "x402.pay",
  reversible: true,
  description: "Hit an x402-protected endpoint, sign the X-PAYMENT header, retry once.",
  async handler({ input, ctx }) {
    const url = String((input as Json).url ?? "").trim();
    if (!url) return { ok: false, error: "url required" };
    const method = String((input as Json).method ?? "POST");
    const body = (input as Json).body as Json | undefined;
    const maxPrice = Number((input as Json).max_price_usdc ?? 1.0);

    // First call — expect 402.
    const first = await ctx.http.request(method as "GET" | "POST", url, body ? { body } : {});
    if (first.statusCode !== 402) {
      return { ok: true, output: { paid: false, body: first.body as Json } };
    }
    const challenge = first.body as Json;
    const price = Number((challenge as Json).price_usdc ?? 0);
    if (price > maxPrice) {
      const approval = await ctx.ownerApproval.request({
        action: "x402.pay",
        reason: `x402 charge of $${price} USDC exceeds threshold $${maxPrice}`,
      });
      if (!approval.granted) {
        return { ok: false, error: `owner refused payment: ${approval.reason ?? "no reason"}` };
      }
    }
    // The runtime owns the wallet signer; re-issue the call with X-AR-Pay-Approve
    // header so the runtime middleware signs the X-PAYMENT challenge.
    const second = await ctx.http.request(method as "GET" | "POST", url, {
      ...(body ? { body } : {}),
      headers: { "x-ar-pay-approve": "1", "x-ar-pay-max-usdc": String(maxPrice) },
    });
    return { ok: true, output: { paid: true, status: second.statusCode, body: second.body } };
  },
};

const handlers: SkillHandler[] = [
  docsSearch,
  docsFetch,
  endpointFind,
  signedEnvelopeEmit,
  walletAuthLogin,
  x402Pay,
];

export default handlers;
export { handlers };
