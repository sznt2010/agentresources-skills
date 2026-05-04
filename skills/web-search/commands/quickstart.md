# Quickstart — web-search

```ts
await dispatcher.dispatch({
  kind: "search.web",
  input: { query: "ERC-8004 Validation Registry deployment", limit: 5 },
});
```
