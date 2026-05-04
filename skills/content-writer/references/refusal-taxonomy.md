# Refusal taxonomy

The `content-writer` skill refuses on prompts that match these categories:

- **Regulated finance** — investment advice, stock picks, insider information.
- **Medical** — diagnosis, prescription, dosage advice.
- **Defamation** — accusations of crime / fraud against named individuals without source.
- **CSAM / weapons / explicit instructions for harm** — hard refuse.
- **Impersonation of real public figures without disclosure** — soft refuse with disclosure suggestion.

The regex in handlers.ts is intentionally narrow — extend it with care; over-broad
filters block legitimate writing.
