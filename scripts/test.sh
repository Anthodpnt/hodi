#!/usr/bin/env bash

set -Eeuo pipefail

# ==========================================
# Run the server test suite.
# ==========================================

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/run-node.sh" 'npm ci && npm test'
