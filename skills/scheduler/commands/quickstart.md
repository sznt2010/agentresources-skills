# Quickstart — scheduler

```ts
await dispatcher.dispatch({
  kind: "schedule.cron",
  input: { cron: "0 9 * * *", action: { kind: "report.daily" }, description: "Daily 9am report" },
});

await dispatcher.dispatch({
  kind: "schedule.at",
  input: { run_at: "2026-06-01T00:00:00Z", action: { kind: "campaign.launch" } },
});
```
