# Quickstart — cross-platform-messaging

```ts
await dispatcher.dispatch({
  kind: "message.send",
  input: { platform: "telegram", to: "@staven_owner", body: "Daily report ready." },
});

await dispatcher.dispatch({
  kind: "message.broadcast",
  input: { platform: "x", recipients: ["@user1", "@user2"], body: "We just shipped." },
});
```
