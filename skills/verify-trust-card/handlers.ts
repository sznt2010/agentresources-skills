import type { SkillHandler } from "@agentresources/skill-types";

type Json = Record<string, unknown>;

const trustCardFetch: SkillHandler<{ wallet: string; api_url?: string }, Json> = {
  kind: "trust_card.fetch",
  reversible: false,
  description: "Fetch a Trust Card by wallet address.",
  async handler({ input, ctx }) {
    const wallet = String((input as Json).wallet ?? "").trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      return { ok: false, error: "wallet must be a 0x-prefixed 40-char hex address" };
    }
    const apiUrl = String(
      (input as Json).api_url ?? ctx.apiUrl ?? "https://api.agentresources.xyz",
    );
    const res = await ctx.http.request("GET", `${apiUrl}/.well-known/trust-card/${wallet}`, {
      headers: { accept: "application/vc+ld+json" },
    });
    if (res.statusCode !== 200) {
      return { ok: false, error: `Trust Card fetch failed: status ${res.statusCode}` };
    }
    return { ok: true, output: res.body as Json };
  },
};

const trustCardVerify: SkillHandler<{ card: Json }, Json> = {
  kind: "trust_card.verify",
  reversible: false,
  description: "Verify EIP-712 sig + cardHash on a Trust Card.",
  async handler({ input }) {
    const card = (input as Json).card as Json | undefined;
    if (!card || typeof card !== "object") {
      return { ok: false, error: "card object required" };
    }
    try {
      // Lazy-import to keep the skill bundle small for non-verifying agents.
      const { verifyCard } = (await import("@agentresources/verify")) as {
        verifyCard: (c: Json) => Promise<Json>;
      };
      const result = await verifyCard(card);
      const valid = (result as Json).valid === true;
      return valid ? { ok: true, output: result } : { ok: false, error: JSON.stringify(result) };
    } catch (err) {
      return { ok: false, error: `verify failed: ${(err as Error).message}` };
    }
  },
};

const trustCardCrossCheck: SkillHandler<
  { wallet: string; token_id: number; rpc_url?: string },
  Json
> = {
  kind: "trust_card.cross_check_onchain",
  reversible: false,
  description: "Confirm on-chain owner of ERC-8004 tokenId matches card wallet.",
  async handler({ input, ctx }) {
    const wallet = String((input as Json).wallet ?? "").toLowerCase();
    const tokenId = Number((input as Json).token_id ?? -1);
    const rpcUrl = String(
      (input as Json).rpc_url ?? (ctx.identity as Json | undefined)?.rpc_url ?? "",
    );
    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !Number.isFinite(tokenId) || !rpcUrl) {
      return { ok: false, error: "wallet, token_id, and rpc_url required" };
    }
    // Identity Registry on Base mainnet.
    const REG = "0x8004A169a0E0C2E0E2A0e2F0C2E0c2E0E2a0a432".toLowerCase();
    // ownerOf(uint256) selector = 0x6352211e
    const data = "0x6352211e" + BigInt(tokenId).toString(16).padStart(64, "0");
    const res = await ctx.http.request("POST", rpcUrl, {
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: REG, data }, "latest"],
      },
    });
    const result = ((res.body as Json).result ?? "") as string;
    if (!result.startsWith("0x") || result.length < 66) {
      return { ok: false, error: `RPC owner lookup failed: ${result}` };
    }
    const owner = "0x" + result.slice(-40).toLowerCase();
    return { ok: true, output: { owner, matches: owner === wallet } };
  },
};

const handlers: SkillHandler[] = [trustCardFetch, trustCardVerify, trustCardCrossCheck];
export default handlers;
export { handlers };
