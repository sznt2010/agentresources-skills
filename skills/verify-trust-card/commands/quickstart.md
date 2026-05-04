# Quickstart — verify-trust-card

```ts
const fetched = await dispatcher.dispatch({
  kind: "trust_card.fetch",
  input: { wallet: "0x4da73F7B725abC5565ce87DE3d51CFFBb71D59aC" },
});

const verified = await dispatcher.dispatch({
  kind: "trust_card.verify",
  input: { card: fetched.output },
});

const onchain = await dispatcher.dispatch({
  kind: "trust_card.cross_check_onchain",
  input: { wallet: fetched.output.credentialSubject.agentWallet, token_id: 45880 },
});
```
