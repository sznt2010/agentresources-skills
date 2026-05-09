# /agent-discovery quickstart

Run a discovery scan against a small batch of seed queries and upsert any
new candidates into `agent_leads` (stage=`new`).

```jsonc
{
  "kind": "discovery.scan",
  "input": {
    "queries": [{ "q": "AutoGPT pricing 2026" }, { "q": "AI sales agent launch", "channel": "x" }],
    "max_per_query": 5,
    "min_score": 1,
  },
}
```

Returns `{ queries_run, candidates_seen, leads_created, leads_existing, skipped }`.
