/**
 * browser-control — Playwright-backed page automation.
 *
 * The runtime injects a Playwright BrowserContext via `ctx.deps.browser`.
 * If `ctx.deps.browser` is absent (WITH_BROWSER=0 build), every handler returns
 * { ok:false, error: "browser_not_installed" } so the planner can pick a
 * different action.
 */
import type { SkillHandler } from "@agentresources/skill-types";

type Json = Record<string, unknown>;

interface BrowserPage {
  id: string;
  goto(url: string, opts?: { waitUntil?: string }): Promise<void>;
  click(sel: string): Promise<void>;
  fill(sel: string, value: string): Promise<void>;
  textContent(sel: string): Promise<string | null>;
  screenshot(opts?: { fullPage?: boolean }): Promise<Buffer>;
  url(): string;
  close(): Promise<void>;
}
interface BrowserDeps {
  newPage(): Promise<BrowserPage>;
  getPage(id: string): BrowserPage | undefined;
  allowedHosts?: string[];
}

const getBrowser = (ctx: { deps?: Json }): BrowserDeps | undefined => {
  const deps = ctx.deps as { browser?: BrowserDeps } | undefined;
  return deps?.browser;
};

const browserOpen: SkillHandler<{ url: string }, Json> = {
  kind: "browser.open",
  reversible: true,
  description: "Open a URL in a new headless page.",
  async handler({ input, ctx }) {
    const browser = getBrowser(ctx as { deps?: Json });
    if (!browser) return { ok: false, error: "browser_not_installed" };
    const url = String((input as Json).url ?? "");
    if (!/^https:\/\//.test(url)) return { ok: false, error: "https_required" };
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    return { ok: true, output: { page_id: page.id, url: page.url() } };
  },
};

const browserClick: SkillHandler<{ page_id: string; selector: string }, Json> = {
  kind: "browser.click",
  reversible: true,
  description: "Click a selector on an open page.",
  async handler({ input, ctx }) {
    const browser = getBrowser(ctx as { deps?: Json });
    if (!browser) return { ok: false, error: "browser_not_installed" };
    const page = browser.getPage(String((input as Json).page_id ?? ""));
    if (!page) return { ok: false, error: "page_not_found" };
    const selector = String((input as Json).selector ?? "");
    if (!selector) return { ok: false, error: "selector required" };
    // Submit-element heuristic: ask for owner approval.
    if (/\b(submit|checkout|pay|buy)\b/i.test(selector)) {
      const ok = await ctx.ownerApproval.request({
        action: "browser.click.submit",
        reason: `clicking submit-like selector "${selector}" on ${page.url()}`,
      });
      if (!ok.granted) return { ok: false, error: "owner_refused" };
    }
    await page.click(selector);
    return { ok: true, output: { clicked: selector } };
  },
};

const browserType: SkillHandler<{ page_id: string; selector: string; text: string }, Json> = {
  kind: "browser.type",
  reversible: true,
  description: "Type text into an input.",
  async handler({ input, ctx }) {
    const browser = getBrowser(ctx as { deps?: Json });
    if (!browser) return { ok: false, error: "browser_not_installed" };
    const page = browser.getPage(String((input as Json).page_id ?? ""));
    if (!page) return { ok: false, error: "page_not_found" };
    await page.fill(String((input as Json).selector ?? ""), String((input as Json).text ?? ""));
    return { ok: true, output: { typed: true } };
  },
};

const browserScreenshot: SkillHandler<{ page_id: string }, Json> = {
  kind: "browser.screenshot",
  reversible: false,
  description: "PNG screenshot, base64-encoded.",
  async handler({ input, ctx }) {
    const browser = getBrowser(ctx as { deps?: Json });
    if (!browser) return { ok: false, error: "browser_not_installed" };
    const page = browser.getPage(String((input as Json).page_id ?? ""));
    if (!page) return { ok: false, error: "page_not_found" };
    const buf = await page.screenshot();
    if (buf.length > 4 * 1024 * 1024) {
      return { ok: false, error: "screenshot_too_large" };
    }
    return { ok: true, output: { png_base64: buf.toString("base64") } };
  },
};

const browserScrape: SkillHandler<{ page_id: string; selector: string }, Json> = {
  kind: "browser.scrape",
  reversible: false,
  description: "Return innerText of a selector.",
  async handler({ input, ctx }) {
    const browser = getBrowser(ctx as { deps?: Json });
    if (!browser) return { ok: false, error: "browser_not_installed" };
    const page = browser.getPage(String((input as Json).page_id ?? ""));
    if (!page) return { ok: false, error: "page_not_found" };
    const text = await page.textContent(String((input as Json).selector ?? ""));
    return { ok: true, output: { text: text ?? "" } };
  },
};

const handlers: SkillHandler[] = [
  browserOpen,
  browserClick,
  browserType,
  browserScreenshot,
  browserScrape,
];
export default handlers;
export { handlers };
