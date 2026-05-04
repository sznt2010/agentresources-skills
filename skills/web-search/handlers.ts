/**
 * web-search — Brave / Tavily / SerpAPI multi-provider search.
 *
 * The runtime injects a provider client via `ctx.deps.search.{web,news,scholar}`
 * with signature `(query, opts?) => Promise<{ results: SearchResult[] }>`.
 */
import type { SkillHandler } from "@agentresources/skill-types";

type Json = Record<string, unknown>;
interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
}
interface SearchProvider {
  search(query: string, opts?: Json): Promise<{ results: SearchResult[] }>;
}

const providerOf = (
  ctx: { deps?: Json },
  kind: "web" | "news" | "scholar",
): SearchProvider | undefined => {
  const search = (ctx.deps as { search?: Record<string, SearchProvider> } | undefined)?.search;
  return search?.[kind] ?? search?.web;
};

const make = (
  kind: "search.web" | "search.news" | "search.scholar",
  providerKey: "web" | "news" | "scholar",
): SkillHandler<{ query: string; limit?: number }, Json> => ({
  kind,
  reversible: false,
  description: `${kind} via configured provider`,
  async handler({ input, ctx }) {
    const query = String((input as Json).query ?? "").trim();
    if (!query || /^[\s\p{P}]+$/u.test(query))
      return { ok: false, error: "non_empty_query_required" };
    const limit = Math.min(Number((input as Json).limit ?? 10), 100);
    if (limit > 100) return { ok: false, error: "limit_too_high" };
    const provider = providerOf(ctx as { deps?: Json }, providerKey);
    if (!provider) return { ok: false, error: "provider_not_configured" };
    const res = await provider.search(query, { limit });
    return { ok: true, output: res };
  },
});

const handlers: SkillHandler[] = [
  make("search.web", "web"),
  make("search.news", "news"),
  make("search.scholar", "scholar"),
];
export default handlers;
export { handlers };
