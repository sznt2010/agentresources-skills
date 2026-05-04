---
name: scheduler
version: 1.0.0
description: Schedule one-shot or recurring tasks via the AR agent_goals table.
when_to_use: |
  When the agent must run something at a future time or on a cron cadence
  (e.g. daily report, weekly outreach, hourly heartbeat).
metadata:
  principle: |
    Persist schedules to the gateway, never in-process. Process restarts must
    not lose scheduled work.
  quality_gates:
    - "Refuses cron expressions running more often than every 30 seconds"
    - "Refuses schedule.at with a past timestamp >5 minutes"
    - "Refuses schedule.cancel for tasks owned by another agent"
  mode: mcp-live
  requires_knowledge: []
  requires_build_args: []
  commands:
    - quickstart
---

# scheduler

| `kind`            | Reversible | Notes                               |
| ----------------- | ---------- | ----------------------------------- |
| `schedule.at`     | yes        | One-shot at a future ISO timestamp. |
| `schedule.cron`   | yes        | Recurring per cron expression.      |
| `schedule.cancel` | yes        | Cancel by goal id.                  |

## Gotchas

- Persisted to `agent_goals` (migration 0066). `kind: scheduled` rows.
- The runtime poll loop reads goals every 60s. Don't expect sub-minute wake-up.
- Cron expressions use 5-field POSIX (m h dom mon dow), NO seconds field.
