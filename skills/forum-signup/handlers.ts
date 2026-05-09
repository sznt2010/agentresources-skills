/**
 * forum-signup — Coordinates a multi-step signup flow on a forum / gated site.
 *
 * Flow: navigate → fill → owner approval → submit → poll OTP via gateway →
 * fill OTP → confirm → emit forum.signup_complete span.
 *
 * Browser steps are delegated to `ctx.deps.browser` (browser-control skill),
 * email OTP polling is delegated to gateway POST /agents/me/email/poll-otp.
 */
import type { SkillHandler } from "@agentresources/skill-types";

type Json = Record<string, unknown>;

interface BrowserClient {
  navigate(url: string): Promise<Json>;
  fill(selector: string, value: string): Promise<Json>;
  click(selector: string): Promise<Json>;
  waitFor?(selector: string, timeoutMs?: number): Promise<Json>;
}

const apiBase = (ctx: { apiUrl?: string }): string =>
  (ctx as { apiUrl?: string }).apiUrl ?? "https://api.agentresources.xyz";

const browserOf = (ctx: { deps?: Json }): BrowserClient | undefined => {
  const deps = ctx.deps as { browser?: BrowserClient } | undefined;
  return deps?.browser;
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const forumSignup: SkillHandler<
  {
    url: string;
    platform: string;
    username: string;
    email: string;
    password: string;
    submit_selector?: string;
    username_selector?: string;
    email_selector?: string;
    password_selector?: string;
    otp_selector?: string;
    otp_confirm_selector?: string;
    poll_window_seconds?: number;
    from_filter?: string;
    subject_filter?: string;
  },
  Json
> = {
  kind: "forum.signup",
  reversible: false,
  description:
    "Sign up for a forum/account. Browser fills the form, owner approves submit, " +
    "then gateway IMAP polls the OTP and the skill enters it.",
  async handler({ input, ctx }) {
    const i = input as Json;
    const url = String(i.url ?? "").trim();
    const platform = String(i.platform ?? "").trim();
    const username = String(i.username ?? "").trim();
    const email = String(i.email ?? "").trim();
    const password = String(i.password ?? "");
    if (!url || !platform || !username || !email || !password) {
      return { ok: false, error: "url/platform/username/email/password required" };
    }

    const browser = browserOf(ctx as { deps?: Json });
    if (!browser) return { ok: false, error: "platform_not_configured" };

    const usernameSel = String(i.username_selector ?? "input[name=username]");
    const emailSel = String(i.email_selector ?? "input[type=email]");
    const passwordSel = String(i.password_selector ?? "input[type=password]");
    const submitSel = String(i.submit_selector ?? "button[type=submit]");
    const otpSel = String(i.otp_selector ?? "input[name=otp]");
    const otpConfirmSel = String(i.otp_confirm_selector ?? "button[type=submit]");
    const pollWindowSeconds = Number(i.poll_window_seconds ?? 300);
    const fromFilter = i.from_filter ? String(i.from_filter) : undefined;
    const subjectFilter = i.subject_filter ? String(i.subject_filter) : undefined;

    await ctx.emitSpan({
      name: "forum.signup_start",
      attributes: { url, platform, username, email },
    });

    // 1-2. Navigate + fill
    try {
      await browser.navigate(url);
      await browser.fill(usernameSel, username);
      await browser.fill(emailSel, email);
      await browser.fill(passwordSel, password);
    } catch (err) {
      return {
        ok: false,
        error: "browser_fill_failed",
        output: { detail: (err as Error).message },
      };
    }

    // 3. Owner approval BEFORE submit (signup is non-reversible).
    if (ctx.ownerApproval) {
      const approval = await ctx.ownerApproval.request({
        kind: "forum.signup",
        summary: `Sign up on ${platform} as ${username} (${email})`,
        details: { url, platform, username, email },
      });
      if (!approval.approved) {
        await ctx.emitSpan({
          name: "forum.signup_refused",
          attributes: { url, platform, reason: approval.note ?? "owner_refused" },
          status: "ERROR",
        });
        return {
          ok: false,
          error: "owner_refused",
          output: { note: approval.note ?? null },
        };
      }
    }

    // 4. Submit
    try {
      await browser.click(submitSel);
    } catch (err) {
      return {
        ok: false,
        error: "browser_submit_failed",
        output: { detail: (err as Error).message },
      };
    }

    // 5. Poll OTP via gateway (decrypts email_imap credential server-side).
    const deadline = Date.now() + pollWindowSeconds * 1000;
    let otp: string | null = null;
    let pollAttempts = 0;
    while (Date.now() < deadline) {
      pollAttempts++;
      const res = await ctx.http.request({
        method: "POST",
        url: `${apiBase(ctx)}/api/v1/agents/me/email/poll-otp`,
        body: {
          since_seconds: Math.min(pollWindowSeconds, 600),
          from_filter: fromFilter,
          subject_filter: subjectFilter,
        },
      });
      if (res.statusCode === 200) {
        const body = (res.body ?? {}) as { found?: boolean; otp?: string };
        if (body.found && body.otp) {
          otp = body.otp;
          break;
        }
      } else if (res.statusCode === 404) {
        // No email_imap credential — refuse early, don't keep polling.
        return {
          ok: false,
          error: "no_email_credential",
          output: { hint: "Register an email_imap credential first." },
        };
      }
      await sleep(15_000);
    }

    if (!otp) {
      await ctx.emitSpan({
        name: "forum.signup_otp_timeout",
        attributes: { url, platform, poll_window_seconds: pollWindowSeconds, pollAttempts },
        status: "ERROR",
      });
      return {
        ok: false,
        error: "otp_timeout",
        output: { poll_window_seconds: pollWindowSeconds, pollAttempts },
      };
    }

    // 6. Enter the code + confirm
    try {
      await browser.fill(otpSel, otp);
      await browser.click(otpConfirmSel);
    } catch (err) {
      return {
        ok: false,
        error: "browser_otp_entry_failed",
        output: { detail: (err as Error).message },
      };
    }

    // 7. Record success
    await ctx.emitSpan({
      name: "forum.signup_complete",
      attributes: { url, platform, username, email },
    });

    return {
      ok: true,
      output: { platform, username, email, pollAttempts },
    };
  },
};

const handlers: SkillHandler[] = [forumSignup];
export default handlers;
