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

// ─── Outreach + thread (Phase 15.6 follow-up) ────────────────────────────────
//
// outreach.draft — generate a pitch draft for a lead and persist it as a
//   pending agent_lead_interactions row (kind="pitch", body=draft).
// outreach.send — given an interaction_id, request owner approval, then
//   actually deliver the message and advance lead.stage="contacted".
// thread.post — post a multi-tweet thread on X (or any platform exposing
//   reply()), one parent + N replies. Reversible=false — once tweets are
//   live they can only be deleted, not unsent.

const apiBase = (ctx: { apiUrl?: string }) =>
  (ctx as { apiUrl?: string }).apiUrl ?? "https://api.agentresources.xyz";

const outreachDraft: SkillHandler<
  { lead_id: string; channel?: Platform; goal?: string; tone?: string },
  Json
> = {
  kind: "outreach.draft",
  reversible: true,
  description:
    "Generate a pitch draft for a lead via the gateway LLM proxy and persist it as a pending interaction.",
  async handler({ input, ctx }) {
    const leadId = String((input as Json).lead_id ?? "");
    if (!leadId) return { ok: false, error: "lead_id required" };
    const goal = String(
      (input as Json).goal ?? "Introduce AR Trust Cards as the trust layer for autonomous agents.",
    );
    const tone = String(
      (input as Json).tone ?? "concise, friendly, founder-to-founder, no marketing fluff",
    );

    // 1. Fetch the lead.
    const leadRes = await ctx.http.request(
      "GET",
      `${apiBase(ctx)}/api/v1/agents/me/leads/${encodeURIComponent(leadId)}`,
    );
    if (leadRes.statusCode !== 200) {
      return { ok: false, error: `lead_lookup_${leadRes.statusCode}` };
    }
    const leadBody = leadRes.body as Json;
    const lead = (leadBody.lead as Json | undefined) ?? leadBody;
    const channel =
      ((input as Json).channel as Platform | undefined) ??
      (lead.contact_channel as Platform | undefined) ??
      "x";
    const displayName = String(lead.display_name ?? lead.contact_handle ?? "there");
    const handle = String(lead.contact_handle ?? "");
    const url = String(lead.contact_url ?? "");

    // 2. Ask the gateway LLM for a draft.
    const sysPrompt =
      "You are a thoughtful AR (Agent Resources) outreach assistant drafting a SHORT first-touch message. " +
      "Output ONLY the message body. Do not include subject, signature, or quoted source links. " +
      "Hard length cap: 3 short paragraphs OR 4 sentences for X/Telegram.";
    const userPrompt = [
      `Channel: ${channel}`,
      `Recipient: ${displayName}${handle ? ` (${handle})` : ""}`,
      url ? `Their context URL: ${url}` : "",
      `Goal: ${goal}`,
      `Tone: ${tone}`,
      "",
      "Write the message now.",
    ]
      .filter(Boolean)
      .join("\n");
    const llmRes = await ctx.http.request("POST", `${apiBase(ctx)}/api/v1/agents/me/llm/complete`, {
      body: {
        prompt: userPrompt,
        system_prompt: sysPrompt,
        max_tokens: 500,
        temperature: 0.6,
      },
    });
    if (llmRes.statusCode !== 200) {
      return { ok: false, error: `llm_${llmRes.statusCode}` };
    }
    const draftText = String((llmRes.body as Json).text ?? "").trim();
    if (!draftText) return { ok: false, error: "empty_draft" };

    // 3. Persist as a pending interaction.
    const intRes = await ctx.http.request(
      "POST",
      `${apiBase(ctx)}/api/v1/agents/me/leads/${encodeURIComponent(leadId)}/interactions`,
      {
        body: {
          kind: "pitch",
          channel,
          body: draftText,
          metadata: {
            source: "outreach.draft",
            status: "pending_approval",
            llm_model: (llmRes.body as Json).model,
            generated_at: new Date().toISOString(),
          },
        },
      },
    );
    if (intRes.statusCode !== 201) {
      return { ok: false, error: `interaction_${intRes.statusCode}` };
    }
    const interaction =
      ((intRes.body as Json).interaction as Json | undefined) ?? (intRes.body as Json);
    const interactionId = String(interaction.id ?? "");

    await ctx.emitSpan({
      name: "outreach.draft.complete",
      attributes: {
        lead_id: leadId,
        interaction_id: interactionId,
        channel,
        draft_length: draftText.length,
      },
      status: "OK",
    });

    return {
      ok: true,
      output: {
        interaction_id: interactionId,
        channel,
        draft: draftText,
      },
    };
  },
};

const outreachSend: SkillHandler<
  { lead_id: string; interaction_id: string; channel?: Platform },
  Json
> = {
  kind: "outreach.send",
  reversible: false,
  description:
    "Deliver a previously-drafted pitch after owner approval. Updates the interaction kind=message_out and lead stage=contacted.",
  async handler({ input, ctx }) {
    const leadId = String((input as Json).lead_id ?? "");
    const interactionId = String((input as Json).interaction_id ?? "");
    if (!leadId || !interactionId) {
      return { ok: false, error: "lead_id/interaction_id required" };
    }

    // 1. Load the interaction (we need the body + channel + recipient).
    const leadRes = await ctx.http.request(
      "GET",
      `${apiBase(ctx)}/api/v1/agents/me/leads/${encodeURIComponent(leadId)}`,
    );
    if (leadRes.statusCode !== 200) {
      return { ok: false, error: `lead_lookup_${leadRes.statusCode}` };
    }
    const leadBody = leadRes.body as Json;
    const lead = (leadBody.lead as Json | undefined) ?? leadBody;
    const interactions = ((leadBody.interactions as Json[] | undefined) ?? []) as Json[];
    const interaction = interactions.find((i) => String(i.id) === interactionId);
    if (!interaction) return { ok: false, error: "interaction_not_found" };
    const draftText = String(interaction.body ?? "").trim();
    if (!draftText) return { ok: false, error: "empty_interaction_body" };
    const channel =
      ((input as Json).channel as Platform | undefined) ??
      (interaction.channel as Platform | undefined) ??
      (lead.contact_channel as Platform | undefined) ??
      "x";
    const recipient = String(lead.contact_handle ?? "");
    if (!recipient) return { ok: false, error: "lead_has_no_contact_handle" };

    // 2. Owner approval.
    const decision = await ctx.ownerApproval.request({
      action: "outreach.send",
      reason: `send pitch to ${recipient} on ${channel}`,
      payload: {
        lead_id: leadId,
        interaction_id: interactionId,
        channel,
        recipient,
        preview: draftText.slice(0, 280),
      },
    });
    if (!decision.granted) {
      return { ok: false, error: "owner_refused", details: { reason: decision.reason ?? null } };
    }

    // 3. Dispatch via the platform client.
    const client = clientOf(ctx as { deps?: Json }, channel);
    if (!client) return { ok: false, error: "platform_not_configured" };
    let dispatch: Json;
    try {
      dispatch = await (channel === "telegram" || channel === "discord"
        ? client.dm(recipient, draftText)
        : client.send(recipient, draftText));
    } catch (err) {
      return { ok: false, error: "send_failed", details: { message: (err as Error).message } };
    }

    // 4. Append a kind="message_out" interaction with stage_after="contacted".
    await ctx.http.request(
      "POST",
      `${apiBase(ctx)}/api/v1/agents/me/leads/${encodeURIComponent(leadId)}/interactions`,
      {
        body: {
          kind: "message_out",
          channel,
          body: draftText,
          stage_after: "contacted",
          metadata: {
            source: "outreach.send",
            draft_interaction_id: interactionId,
            dispatch,
            sent_at: new Date().toISOString(),
          },
        },
      },
    );

    await ctx.emitSpan({
      name: "outreach.send.complete",
      attributes: {
        lead_id: leadId,
        interaction_id: interactionId,
        channel,
      },
      status: "OK",
    });

    return {
      ok: true,
      output: {
        lead_id: leadId,
        interaction_id: interactionId,
        channel,
        recipient,
        dispatch,
      },
    };
  },
};

const threadPost: SkillHandler<
  { platform?: Platform; tweets: string[]; reference_key?: string },
  Json
> = {
  kind: "thread.post",
  reversible: false,
  description:
    "Post a thread (parent + replies) on a single platform. Owner approval is required when total length > 1000 chars.",
  async handler({ input, ctx }) {
    const platform = ((input as Json).platform as Platform | undefined) ?? "x";
    const tweets = ((input as Json).tweets as string[] | undefined) ?? [];
    if (!Array.isArray(tweets) || tweets.length === 0) {
      return { ok: false, error: "tweets[] required" };
    }
    if (tweets.length > 25) return { ok: false, error: "thread_too_long_max_25" };
    const totalLen = tweets.reduce((acc, t) => acc + String(t ?? "").length, 0);
    if (totalLen > 1000) {
      const decision = await ctx.ownerApproval.request({
        action: "thread.post",
        reason: `post a ${tweets.length}-tweet thread on ${platform} (${totalLen} chars)`,
        payload: { platform, total_length: totalLen, preview: tweets[0]?.slice(0, 200) ?? "" },
      });
      if (!decision.granted) return { ok: false, error: "owner_refused" };
    }

    const client = clientOf(ctx as { deps?: Json }, platform);
    if (!client) return { ok: false, error: "platform_not_configured" };

    const posted: Json[] = [];
    let parentId: string | undefined;
    for (let i = 0; i < tweets.length; i++) {
      const body = String(tweets[i] ?? "").trim();
      if (!body) {
        posted.push({ index: i, ok: false, error: "empty_tweet" });
        continue;
      }
      try {
        const res = parentId
          ? await client.reply(parentId, body)
          : await client.send("self", body, { thread: true });
        const id = String((res as Json).id ?? (res as Json).thread_id ?? "") || undefined;
        if (!parentId && id) parentId = id;
        posted.push({ index: i, ok: true, id, result: res });
        await ctx.emitSpan({
          name: "x.post.thread_tweet",
          attributes: { platform, index: i, length: body.length, id: id ?? null },
          status: "OK",
        });
      } catch (err) {
        posted.push({ index: i, ok: false, error: (err as Error).message });
        await ctx.emitSpan({
          name: "x.post.thread_tweet",
          attributes: { platform, index: i, length: body.length, error: (err as Error).message },
          status: "ERROR",
        });
        // Stop the thread on first failure — partial threads look broken.
        break;
      }
    }

    await ctx.emitSpan({
      name: "x.post.thread_complete",
      attributes: {
        platform,
        tweets_attempted: tweets.length,
        tweets_posted: posted.filter((p) => (p as Json).ok === true).length,
        total_length: totalLen,
        parent_id: parentId ?? null,
        reference_key: (input as Json).reference_key ?? null,
      },
      status: posted.every((p) => (p as Json).ok === true) ? "OK" : "ERROR",
    });

    return {
      ok: true,
      output: {
        platform,
        parent_id: parentId,
        posted,
      },
    };
  },
};

const handlers: SkillHandler[] = [
  messageSend,
  messageReply,
  messageDm,
  messageBroadcast,
  outreachDraft,
  outreachSend,
  threadPost,
];
export default handlers;
export { handlers };
