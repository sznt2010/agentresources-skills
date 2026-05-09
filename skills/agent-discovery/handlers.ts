/**
 * agent-discovery — scan the open web for autonomous-agent builders and upsert
 * them into the agent_leads CRM via the AR gateway.
 *
 * One handler:
 *   discovery.scan  reversible — runs N searches via /agents/me/search, scores
 *                   each result, and upserts the top hits as stage="new".
 *                   The agent_leads table dedupes by (agent_id, lower(contact_handle))
 *                   so re-runs are idempotent (409 → "already exists" no-op).
 *
 * Input shape:
 *   {
 *     queries: Array<{ q: string; channel?: "x" | "web" | "discord" | "linkedin" }>;
 *     max_per_query?: number;   // default 5, hard cap 8
 *     min_score?: number;       // default 1 — discard results below
 *   }
 *
 * Output shape:
 *   {
 *     queries_run: number;
 *     candidates_seen: number;
 *     leads_created: number;
 *     leads_existing: number;
 *     skipped: number;
 *   }
 */
import type { SkillHandler } from "@agentresources/skill-types";

type Json = Record<string, unknown>;

interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
}

type Channel = "x" | "web" | "discord" | "telegram" | "email" | "other";

interface Candidate {
  contact_handle: string;
  channel: Channel;
  display_name: string;
  url: string;
  score: number;
  why: string[];
}

const apiBase = (ctx: { apiUrl?: string }) => ctx.apiUrl ?? "https://api.agentresources.xyz";

const HARD_CAP = 8;

const KEYWORDS: Array<{ kw: RegExp; weight: number; tag: string }> = [
  { kw: /\bautonomous\s+agent/i, weight: 3, tag: "autonomous-agent" },
  { kw: /\bAI\s+(?:tool|sales|crm|assistant)/i, weight: 2, tag: "ai-tool" },
  { kw: /\bagent\s+(?:framework|runtime|platform)/i, weight: 3, tag: "agent-platform" },
  {
    kw: /\bbuilt\s+(?:with|using)\s+(?:LangChain|AutoGPT|crewAI|MCP)/i,
    weight: 2,
    tag: "agent-stack",
  },
  { kw: /\b(?:launch|launched|ship|shipped|releas\w+)/i, weight: 1, tag: "shipping" },
  { kw: /\b202[5-9]\b/, weight: 1, tag: "recent" },
  { kw: /\bopen[-\s]?source/i, weight: 1, tag: "oss" },
];

/** Derive a stable handle from a URL. Returns null if we can't extract anything useful. */
function deriveHandle(url: string): { handle: string; channel: Channel } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const segments = u.pathname.split("/").filter(Boolean);

  if (host === "x.com" || host === "twitter.com") {
    const handle = segments[0];
    if (!handle || ["home", "search", "status", "i", "compose"].includes(handle)) return null;
    return { handle: `@${handle}`, channel: "x" };
  }
  if (host === "discord.com" || host === "discord.gg") {
    if (segments[0]) return { handle: `discord:${segments[0]}`, channel: "discord" };
    return null;
  }
  if (host === "linkedin.com") {
    const idx = segments.findIndex((s) => s === "in" || s === "company");
    if (idx >= 0 && segments[idx + 1]) {
      // No first-class linkedin channel in the launch enum — bucket as "other".
      return { handle: `linkedin:${segments[idx + 1]}`, channel: "other" };
    }
    return null;
  }
  // Generic web — use bare domain.
  if (host && host.includes(".")) {
    return { handle: host, channel: "web" };
  }
  return null;
}

function scoreText(...parts: string[]): { score: number; tags: string[] } {
  const text = parts.filter(Boolean).join(" ");
  let score = 0;
  const tags: string[] = [];
  for (const { kw, weight, tag } of KEYWORDS) {
    if (kw.test(text)) {
      score += weight;
      tags.push(tag);
    }
  }
  return { score, tags };
}

const discoveryScan: SkillHandler<
  {
    queries: Array<{ q: string; channel?: Channel }>;
    max_per_query?: number;
    min_score?: number;
  },
  Json
> = {
  kind: "discovery.scan",
  reversible: true,
  description: "Run a batch of web searches and upsert candidate leads into the CRM.",
  async handler({ input, ctx }) {
    const queries = Array.isArray((input as Json).queries)
      ? ((input as Json).queries as Array<{ q?: unknown; channel?: unknown }>)
      : [];
    if (queries.length === 0) return { ok: false, error: "queries required" };
    const maxPerQuery = Math.min(
      Math.max(Number((input as Json).max_per_query ?? 5) || 5, 1),
      HARD_CAP,
    );
    const minScore = Math.max(Number((input as Json).min_score ?? 1) || 0, 0);

    let candidatesSeen = 0;
    let leadsCreated = 0;
    let leadsExisting = 0;
    let skipped = 0;
    const errors: string[] = [];

    const seen = new Set<string>(); // lower(contact_handle) within this run

    for (const entry of queries) {
      const q = String(entry?.q ?? "").trim();
      if (!q) {
        skipped++;
        continue;
      }
      const channelHint = (entry?.channel as Channel | undefined) ?? undefined;

      let results: SearchResult[] = [];
      try {
        const res = await ctx.http.request("POST", `${apiBase(ctx)}/api/v1/agents/me/search`, {
          body: { query: q, max_results: maxPerQuery },
        });
        if (res.statusCode !== 200) {
          errors.push(`search ${res.statusCode} for "${q}"`);
          continue;
        }
        results = ((res.body as Json).results as SearchResult[] | undefined) ?? [];
      } catch (err) {
        errors.push(`search threw for "${q}": ${String(err)}`);
        continue;
      }

      const candidates: Candidate[] = [];
      for (const r of results) {
        candidatesSeen++;
        const derived = deriveHandle(r.url);
        if (!derived) {
          skipped++;
          continue;
        }
        const { score, tags } = scoreText(r.title, r.snippet ?? "", r.url);
        if (score < minScore) {
          skipped++;
          continue;
        }
        const channel = channelHint ?? derived.channel;
        const key = derived.handle.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({
          contact_handle: derived.handle,
          channel,
          display_name: r.title || derived.handle,
          url: r.url,
          score,
          why: tags,
        });
      }

      // Upsert each candidate.
      for (const c of candidates) {
        try {
          const res = await ctx.http.request("POST", `${apiBase(ctx)}/api/v1/agents/me/leads`, {
            body: {
              display_name: c.display_name,
              contact_handle: c.contact_handle,
              contact_channel: c.channel,
              contact_url: c.url,
              stage: "new",
              tags: c.why,
              source_url: c.url,
              metadata: {
                source: "agent-discovery",
                source_query: q,
                source_url: c.url,
                score: c.score,
                why: c.why,
              },
            },
          });
          if (res.statusCode === 201) leadsCreated++;
          else if (res.statusCode === 409) leadsExisting++;
          else errors.push(`lead.create ${res.statusCode}: ${JSON.stringify(res.body)}`);
        } catch (err) {
          errors.push(`lead.create threw: ${String(err)}`);
        }
      }
    }

    await ctx.emitSpan({
      name: "discovery.scan.complete",
      attributes: {
        queries: queries.length,
        candidates_seen: candidatesSeen,
        leads_created: leadsCreated,
        leads_existing: leadsExisting,
        skipped,
        error_count: errors.length,
      },
      status: errors.length === 0 ? "OK" : "ERROR",
    });

    return {
      ok: true,
      output: {
        queries_run: queries.length,
        candidates_seen: candidatesSeen,
        leads_created: leadsCreated,
        leads_existing: leadsExisting,
        skipped,
        errors: errors.slice(0, 10),
      },
    };
  },
};

const handlers: SkillHandler[] = [discoveryScan];
export default handlers;
export { handlers };
