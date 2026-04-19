#!/usr/bin/env bash
# Ingest every feed in feeds.txt into the local contextix graph.
# Usage: ./daily-ingest.sh [feeds-file]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FEEDS_FILE="${1:-$SCRIPT_DIR/feeds.txt}"

if [[ ! -f "$FEEDS_FILE" ]]; then
  echo "feeds file not found: $FEEDS_FILE" >&2
  exit 1
fi

if ! command -v contextix >/dev/null 2>&1; then
  echo "contextix not in PATH — run 'npm i -g contextix' or use 'npx contextix'" >&2
  exit 1
fi

DOMAIN="${CONTEXTIX_DOMAIN:-general}"
MAX="${CONTEXTIX_MAX:-20}"

echo "[daily-ingest] domain=$DOMAIN max=$MAX feeds=$FEEDS_FILE"

while IFS= read -r line || [[ -n "$line" ]]; do
  # strip whitespace + skip blanks and comments
  url="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [[ -z "$url" || "$url" == \#* ]] && continue

  echo ""
  echo "[daily-ingest] → $url"
  contextix ingest rss "$url" --domain "$DOMAIN" --max "$MAX" || {
    echo "[daily-ingest] failed: $url (continuing)"
  }
done < "$FEEDS_FILE"

echo ""
echo "[daily-ingest] complete. Query with: contextix signals -t 1d"
