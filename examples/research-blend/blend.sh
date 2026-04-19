#!/usr/bin/env bash
# Blend arXiv RSS + URLs + markdown notes into one graph for a research topic.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v contextix >/dev/null 2>&1; then
  echo "contextix not in PATH — run 'npm i -g contextix' or use 'npx contextix'" >&2
  exit 1
fi

DOMAIN="${CONTEXTIX_DOMAIN:-ai}"

echo "[blend] 1/3 — arXiv cs.AI RSS (latest 10)"
contextix ingest rss http://arxiv.org/rss/cs.AI --max 10 --domain "$DOMAIN" || true

echo ""
echo "[blend] 2/3 — markdown notes"
contextix ingest markdown ./notes --domain "$DOMAIN"

echo ""
echo "[blend] 3/3 — URLs from urls.txt"
while IFS= read -r line || [[ -n "$line" ]]; do
  url="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [[ -z "$url" || "$url" == \#* ]] && continue
  echo "  → $url"
  contextix ingest url "$url" --domain "$DOMAIN" || true
done < urls.txt

echo ""
echo "[blend] complete."
echo ""
echo "  contextix signals -t 30d --domain $DOMAIN"
echo "  contextix entities --domain $DOMAIN --type concept -n 20"
echo "  contextix why \"<some event from signals>\""
