#!/usr/bin/env bash
# claude-accounts — installer (macOS / Linux / git-bash). Delegates to the Node setup.
set -e
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install from https://nodejs.org then re-run."
  exit 1
fi
node "$dir/setup.js" install
