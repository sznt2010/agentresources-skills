# Quickstart — content-writer

```ts
const draft = await dispatcher.dispatch({
  kind: "content.draft",
  input: { brief: "Announce our shipped Phase 15.6", tone: "concise, candid", max_words: 80 },
});

await dispatcher.dispatch({
  kind: "content.translate",
  input: { text: draft.output.text, target_lang: "Hungarian" },
});
```
