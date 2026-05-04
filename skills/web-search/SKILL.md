---
name: web-search
version: 1.0.0
description: Web / news / scholar search via Brave, Tavily, or SerpAPI.
when_to_use: |
  Whenever the agent needs current information from the open web. Provider is
  configured via `AR_SEARCH_PROVIDER` env var (brave|tavily|serpapi).
metadata:
  principle: |
    Use the cheapest provider that returns a citable result. Always return
    source URLs; never fabricate.
  quality_gates:
    - "Refuses if no provider key is configured"
    - "Refuses if query is empty or pure punctuation"
    - "Refuses if result count exceeds 100 (soft DoS guard)"
  mode: mcp-live
  requires_knowledge: []
  requires_build_args: []
  commands:
    - quickstart
---

# web-search

| `kind`           | Reversible | Notes                                                     |
| ---------------- | ---------- | --------------------------------------------------------- |
| `search.web`     | no         | General web search.                                       |
| `search.news`    | no         | News-only search.                                         |
| `search.scholar` | no         | Scholar/academic search (Tavily fallback if unsupported). |

## Gotchas

- Each provider has different rate limits and pricing. The runtime owns the keys.
- `search.scholar` falls back to `search.web` with a "scholar" prefix on
  providers that lack a dedicated scholar endpoint.
- Results include source URLs; never paraphrase as "fact" without citing.
