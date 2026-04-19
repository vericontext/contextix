---
name: Skill request
about: Propose a skill for a specific MCP server (Notion, Linear, Slack, Gmail, ...)
labels: skill
---

## MCP server

<!-- Name + install command of the MCP server. Link to its repo if possible. -->

Example: `@anthropic/notion-mcp` — `npx -y @anthropic/notion-mcp`

## What the skill should extract

<!-- Which MCP tools get called, and how their results map to graph shape. -->

- Tools to call:
  - `list_databases` → ?
  - `query_database` → one event per page?
- Entities to emit:
  - `person` for page authors?
  - `concept` for tags?
- Relations:
  - `involves` from page event → author person?

## Auth model

- [ ] Public / keyless
- [ ] API key (single env var)
- [ ] OAuth flow (requires `requiredEnv` + external login)
- [ ] Local export file

## Willing to contribute?

- [ ] I can write the skill
- [ ] I can test against real data once someone else writes it
- [ ] Just filing the request

## Related

<!-- Existing skill files in examples/skills/ that would inform this one,
or issues with similar shape. -->
