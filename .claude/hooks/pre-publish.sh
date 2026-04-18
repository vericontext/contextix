#!/usr/bin/env bash
# Pre-publish guard: runs before any `npm publish` command.
# Blocks (exit 2) if:
#   1. git working tree is dirty
#   2. dist/ doesn't exist or is older than src/
#   3. bin field is missing from package.json
#   4. version in package.json matches the already-published latest on npm

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only run for npm publish commands
if [[ "$COMMAND" != *"npm publish"* ]]; then
  exit 0
fi

REPO_DIR="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || echo "$CLAUDE_PROJECT_DIR")"
cd "$REPO_DIR"

ERRORS=()

# 1. Git must be clean
if ! git diff --quiet HEAD 2>/dev/null; then
  ERRORS+=("Git working tree is dirty. Commit or stash changes before publishing.")
fi

# 2. dist/ must exist
if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
  ERRORS+=("dist/ not found or incomplete. Run: npm run build")
fi

# 3. dist must be newer than src (check if rebuild needed)
if [ -d "dist" ] && [ -d "src" ]; then
  NEWEST_SRC=$(find src -name "*.ts" -newer dist/index.js 2>/dev/null | head -1)
  if [ -n "$NEWEST_SRC" ]; then
    ERRORS+=("Source files changed after last build (e.g. $NEWEST_SRC). Run: npm run build")
  fi
fi

# 4. bin field must exist in package.json
BIN=$(jq -r '.bin // empty' package.json 2>/dev/null)
if [ -z "$BIN" ] || [ "$BIN" = "null" ]; then
  ERRORS+=("bin field is missing from package.json. Run: npm pkg fix")
fi

# 5. Version must not already be published
PKG_VERSION=$(jq -r '.version' package.json 2>/dev/null)
PKG_NAME=$(jq -r '.name' package.json 2>/dev/null)
NPM_VERSIONS=$(npm view "$PKG_NAME" versions --json 2>/dev/null || echo "[]")
if echo "$NPM_VERSIONS" | jq -e --arg v "$PKG_VERSION" 'index($v) != null' > /dev/null 2>&1; then
  ERRORS+=("Version $PKG_VERSION is already published on npm. Bump version first: npm version patch|minor|major")
fi

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "=== Pre-publish checks failed ===" >&2
  for err in "${ERRORS[@]}"; do
    echo "  ✗ $err" >&2
  done
  exit 2
fi

echo '{"systemMessage": "Pre-publish checks passed. Proceeding with npm publish."}'
exit 0
