/**
 * content-writer — draft / refine / translate via LiteLLM proxy.
 *
 * The runtime injects an LLM completion function via `ctx.deps.completion`
 * (signature: `(prompt: string, opts?) => Promise<string>`) so the skill stays
 * model-agnostic and rotation-safe.
 */
import type { SkillHandler } from "@agentresources/skill-types";

type Json = Record<string, unknown>;
type Completion = (prompt: string, opts?: Json) => Promise<string>;

const completionOf = (ctx: { deps?: Json }): Completion | undefined =>
  (ctx.deps as { completion?: Completion } | undefined)?.completion;

const PROHIBITED = /\b(insider trade|defame|stock pick|prescribe|medical advice)\b/i;

const draft: SkillHandler<{ brief: string; tone?: string; max_words?: number }, Json> = {
  kind: "content.draft",
  reversible: false,
  description: "Draft new content from a brief.",
  async handler({ input, ctx }) {
    const brief = String((input as Json).brief ?? "").trim();
    if (!brief) return { ok: false, error: "brief required" };
    if (PROHIBITED.test(brief)) return { ok: false, error: "prohibited_topic" };
    const completion = completionOf(ctx as { deps?: Json });
    if (!completion) return { ok: false, error: "completion_not_configured" };
    const tone = String((input as Json).tone ?? "neutral, professional");
    const maxWords = Number((input as Json).max_words ?? 300);
    const text = await completion(
      `Write a draft (≤${maxWords} words) in tone "${tone}":\n\n${brief}`,
    );
    return { ok: true, output: { text } };
  },
};

const refine: SkillHandler<{ text: string; instructions: string }, Json> = {
  kind: "content.refine",
  reversible: false,
  description: "Refine existing content.",
  async handler({ input, ctx }) {
    const text = String((input as Json).text ?? "").trim();
    const instructions = String((input as Json).instructions ?? "").trim();
    if (!text || !instructions) return { ok: false, error: "text and instructions required" };
    const completion = completionOf(ctx as { deps?: Json });
    if (!completion) return { ok: false, error: "completion_not_configured" };
    const out = await completion(
      `Refine the following per instructions: ${instructions}\n\n${text}`,
    );
    return { ok: true, output: { text: out } };
  },
};

const translate: SkillHandler<{ text: string; target_lang: string }, Json> = {
  kind: "content.translate",
  reversible: false,
  description: "Translate while preserving tone.",
  async handler({ input, ctx }) {
    const text = String((input as Json).text ?? "").trim();
    const target = String((input as Json).target_lang ?? "").trim();
    if (!text || !target) return { ok: false, error: "text and target_lang required" };
    const completion = completionOf(ctx as { deps?: Json });
    if (!completion) return { ok: false, error: "completion_not_configured" };
    const out = await completion(
      `Translate to ${target}, preserving tone. If the source language is ambiguous, refuse with the literal token "AMBIGUOUS_SOURCE".\n\n${text}`,
    );
    if (out.trim() === "AMBIGUOUS_SOURCE") return { ok: false, error: "ambiguous_source" };
    return { ok: true, output: { text: out } };
  },
};

const handlers: SkillHandler[] = [draft, refine, translate];
export default handlers;
export { handlers };
