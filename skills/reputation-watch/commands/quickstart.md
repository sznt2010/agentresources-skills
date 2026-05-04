# Quickstart — reputation-watch

```ts
await dispatcher.dispatch({
  kind: "mention.subscribe",
  input: { keyword: "agentresources", platform: "x", cadence_seconds: 900 },
});

const mentions = await dispatcher.dispatch({
  kind: "mention.list",
  input: { acknowledged: false, limit: 25 },
});
```
