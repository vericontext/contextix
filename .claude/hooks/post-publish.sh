#!/usr/bin/env bash
# Post-publish: runs after a successful `npm publish`.
# 1. Pushes the version tag to GitHub
# 2. Sends a macOS desktop notification

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [[ "$COMMAND" != *"npm publish"* ]]; then
  exit 0
fi

REPO_DIR="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || echo "$CLAUDE_PROJECT_DIR")"
cd "$REPO_DIR"

PKG_VERSION=$(jq -r '.version' package.json 2>/dev/null)
PKG_NAME=$(jq -r '.name' package.json 2>/dev/null)

# Push commits and version tag
git push origin main --tags 2>/dev/null || true

# macOS notification
osascript -e "display notification \"$PKG_NAME@$PKG_VERSION published to npm\" with title \"npm publish\" sound name \"Glass\"" 2>/dev/null || true

exit 0
