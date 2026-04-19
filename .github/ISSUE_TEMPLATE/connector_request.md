---
name: Connector request
about: Propose a new ingest source type (Notion, Slack, Linear, Gmail, ...)
labels: connector
---

## Source

<!-- What system? e.g. Notion, Linear, GitHub issues, Slack archives -->

## Why this source

<!-- What would the graph look like with this source? What use case
does it unlock? -->

## Access model

- [ ] Public (no auth) — e.g. RSS feed, public URL
- [ ] API key — e.g. `NOTION_TOKEN`
- [ ] OAuth flow — requires interactive login
- [ ] Local export file — e.g. Slack export `.zip`

## Mapping sketch

```
<source concept> → SignalEvent
<source concept> → Entity (entityType: ?)
<source concept> → Relation (type: ?)
```

## Pagination / rate limits

<!-- Any gotchas for batch ingest at scale? -->

## Willing to contribute?

- [ ] I can write the connector
- [ ] I can test against real data once someone else writes it
- [ ] Just filing the request
