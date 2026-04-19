# Security policy

## Supported versions

The latest `0.x.y` release on npm receives security fixes. Older minor versions do not.

## Reporting a vulnerability

Please do **not** open a public issue for security-sensitive reports.

Use GitHub's private security advisory flow:
1. Go to https://github.com/vericontext/contextix/security/advisories/new
2. Describe the issue, the affected version, and a proof-of-concept if you have one
3. Maintainers respond within 7 days

If you can't use GitHub advisories, email the maintainer listed on the [npm package page](https://www.npmjs.com/package/contextix).

## Scope

Security issues of interest:
- **Code execution** — a crafted skill file, source fetch, or MCP server response causes unintended code execution on the host
- **Data exfiltration** — extractor / ingest path leaks `ANTHROPIC_API_KEY` or other env values into emitted graph content, logs, or outbound requests
- **Path traversal** — `ingest markdown` or similar reads outside the intended directory
- **Supply chain** — a dependency update introduces a malicious change
- **Denial of service** — adversarial input to any connector that locks up or exhausts memory on reasonable inputs

Out of scope:
- Bugs in upstream MCP servers (report to their maintainers)
- Misconfigured skill files that leak your own credentials — that's an authoring issue
- Known issues already tracked in public advisories

## Disclosure process

1. You report privately
2. We confirm the issue and assess severity
3. We prepare a fix + a patch release
4. We publish a public GHSA advisory crediting the reporter (opt-in)
5. We push the fixed version to npm

Target timeline: **14 days** from report to fix for high / critical severity; longer for low / informational.
