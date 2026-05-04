# Quickstart — agent-resources

## Search the docs

```ts
await dispatcher.dispatch({ kind: "docs.search", input: { query: "trust card" } });
```

## Fetch a docs page

```ts
await dispatcher.dispatch({ kind: "docs.fetch", input: { slug: "trust-card-protocol" } });
```

## Discover an endpoint

```ts
await dispatcher.dispatch({ kind: "endpoint.find", input: { name: "x402-v2" } });
```

## Pay an x402-protected endpoint

```ts
await dispatcher.dispatch({
  kind: "x402.pay",
  input: { url: "https://api.example.com/premium", max_price_usdc: 0.5 },
});
```

The runtime injects the wallet signer. Skills never see the private key.
