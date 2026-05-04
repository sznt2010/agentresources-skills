/**
 * cross-platform-messaging — Telegram / Discord / X / email send+reply.
 *
 * The runtime injects platform clients via `ctx.deps.messaging.<platform>`.
 * Missing platform → handler returns `{ ok:false, error:"platform_not_configured" }`.
 */
import type { SkillHandler } from "@agentresources/skill-types";

type Json = Record<string, unknown>;
type Platform = "telegram" | "discord" | "x" | "email";

interface PlatformClient {
  send(to: string, body: string, opts?: Json): Promise<Json>;
  reply(threadId: string, body: string, opts?: Json): Promise<Json>;
  dm(handle: string, body: string, opts?: Json): Promise<Json>;
}

const clientOf = (ctx: { deps?: Json }, platform: Platform): PlatformClient | undefined => {
  const messaging = (ctx.deps as { messaging?: Record<string, PlatformClient> } | undefined)
    ?.messaging;
  return messaging?.[platform];
};

const messageSend: SkillHandler<{ platform: Platform; to: string; body: string }, Json> = {
  kind: "message.send",
  reversible: true,
  description: "Send a message on a single platform.",
  async handler({ input, ctx }) {
    const platform = (input as Json).platform as Platform;
    const to = String((input as Json).to ?? "");
    const body = String((input as Json).body ?? "");
    if (!platform || !to || !body) return { ok: false, error: "platform/to/body required" };
    const client = clientOf(ctx as { deps?: Json }, platform);
    if (!client) return { ok: false, error: "platform_not_configured" };
    const res = await client.send(to, body);
    return { ok: true, output: res };
  },
};

const messageReply: SkillHandler<{ platform: Platform; thread_id: string; body: string }, Json> = {
  kind: "message.reply",
  reversible: true,
  description: "Reply to an existing thread.",
  async handler({ input, ctx }) {
    const platform = (input as Json).platform as Platform;
    const threadId = String((input as Json).thread_id ?? "");
    const body = String((input as Json).body ?? "");
    if (!platform || !threadId || !body)
      return { ok: false, error: "platform/thread_id/body required" };
    const client = clientOf(ctx as { deps?: Json }, platform);
    if (!client) return { ok: false, error: "platform_not_configured" };
    return { ok: true, output: await client.reply(threadId, body) };
  },
};

const messageDm: SkillHandler<{ platform: Platform; handle: string; body: string }, Json> = {
  kind: "message.dm",
  reversible: true,
  description: "Open a DM thread.",
  async handler({ input, ctx }) {
    const platform = (input as Json).platform as Platform;
    const handle = String((input as Json).handle ?? "");
    const body = String((input as Json).body ?? "");
    if (!platform || !handle || !body) return { ok: false, error: "platform/handle/body required" };
    const client = clientOf(ctx as { deps?: Json }, platform);
    if (!client) return { ok: false, error: "platform_not_configured" };
    return { ok: true, output: await client.dm(handle, body) };
  },
};

const messageBroadcast: SkillHandler<
  { platform: Platform; recipients: string[]; body: string },
  Json
> = {
  kind: "message.broadcast",
  reversible: true,
  description: "Send the same message to N recipients (≤50 default).",
  async handler({ input, ctx }) {
    const platform = (input as Json).platform as Platform;
    const recipients = ((input as Json).recipients as string[] | undefined) ?? [];
    const body = String((input as Json).body ?? "");
    if (!platform || recipients.length === 0 || !body)
      return { ok: false, error: "platform/recipients/body required" };
    if (recipients.length > 50) {
      const ok = await ctx.ownerApproval.request({
        action: "message.broadcast",
        reason: `broadcast to ${recipients.length} recipients on ${platform}`,
      });
      if (!ok.granted) return { ok: false, error: "owner_refused" };
    }
    const client = clientOf(ctx as { deps?: Json }, platform);
    if (!client) return { ok: false, error: "platform_not_configured" };
    const results: Json[] = [];
    for (const r of recipients) {
      try {
        results.push({ to: r, ok: true, result: await client.send(r, body) });
      } catch (err) {
        results.push({ to: r, ok: false, error: (err as Error).message });
      }
    }
    return { ok: true, output: { results } };
  },
};

const handlers: SkillHandler[] = [messageSend, messageReply, messageDm, messageBroadcast];
export default handlers;
export { handlers };
