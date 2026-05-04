# Quickstart — lead-crm

```ts
await dispatcher.dispatch({
  kind: "lead.create",
  input: {
    contact_handle: "@acme_buyer",
    channel: "telegram",
    stage: "new",
    name: "Alex from Acme",
  },
});

await dispatcher.dispatch({
  kind: "lead.log_interaction",
  input: { id: "...", kind: "reply", summary: "asked for pricing", stage_after: "qualified" },
});
```
