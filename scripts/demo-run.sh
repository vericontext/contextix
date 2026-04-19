#!/usr/bin/env bash
# Timed demo for the README GIF. Invoked via:
#   asciinema rec /tmp/contextix-demo.cast -c "bash scripts/demo-run.sh"
set -euo pipefail

pause() { sleep "${1:-1}"; }
prompt() { printf "\n\033[1;32m$\033[0m %s\n" "$1"; }

CTX="node $(cd "$(dirname "$0")/.." && pwd)/dist/index.js"

clear
printf "\033[1;34m# contextix — CLI toolkit for agentic AI\033[0m\n"
pause 0.8

prompt "npx contextix ingest mcp ./examples/skills/hackernews-top.mjs"
pause 0.4
$CTX ingest mcp ./examples/skills/hackernews-top.mjs 2>&1
pause 2.5

prompt "npx contextix signals -t 24h -n 4"
pause 0.4
$CTX signals -t 24h -n 4 --json 2>&1 | node -e '
let d = "";
process.stdin.on("data", c => d += c);
process.stdin.on("end", () => {
  try {
    const r = JSON.parse(d);
    const s = JSON.parse(r.content.find(c => c.type === "text").text);
    console.log(`\n  ${s.count} recent signals:`);
    for (const sig of s.signals.slice(0, 4)) {
      const dot = sig.importance === "high" ? "\x1b[31m◆\x1b[0m" : sig.importance === "critical" ? "\x1b[31m●\x1b[0m" : "\x1b[33m·\x1b[0m";
      console.log(`  ${dot} ${sig.title.slice(0, 72)}`);
    }
  } catch (e) { console.log(d); }
});
'
pause 3

printf "\n\033[90m# graph at ~/.contextix/graph.json  •  MCP + CLI + HTTP, same graph\033[0m\n"
pause 2
