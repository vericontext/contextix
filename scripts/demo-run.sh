#!/usr/bin/env bash
# Timed demo for the README GIF. Invoked via:
#   asciinema rec /tmp/contextix-demo.cast -c "bash scripts/demo-run.sh"
set -euo pipefail

pause() { sleep "${1:-1}"; }
prompt() { printf "\033[1;32m$\033[0m %s\n" "$1"; }

# Run contextix from the local dist build so we're demoing what's in the
# working tree, not a previously-installed global version.
CTX="node $(cd "$(dirname "$0")/.." && pwd)/dist/index.js"

clear

prompt "npx contextix ingest rss https://news.ycombinator.com/rss --max 5"
pause 0.5
$CTX ingest rss "https://news.ycombinator.com/rss" --max 5
pause 2

echo
prompt "npx contextix signals -t 24h -n 3"
pause 0.5
$CTX signals -t 24h -n 3
pause 3

echo
TITLE="$($CTX signals -t 24h -n 1 --json 2>/dev/null | node -e '
  let d = "";
  process.stdin.on("data", c => d += c);
  process.stdin.on("end", () => {
    try {
      const r = JSON.parse(d);
      const s = JSON.parse(r.content.find(c => c.type === "text").text);
      process.stdout.write(s.signals?.[0]?.title ?? "");
    } catch { process.stdout.write(""); }
  });
' 2>/dev/null)"
TITLE="${TITLE:-AI}"

prompt "npx contextix why \"${TITLE}\""
pause 0.5
$CTX why "$TITLE" || true
pause 3

echo
