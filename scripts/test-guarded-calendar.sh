#!/usr/bin/env bash
set -euo pipefail

# Compile the bridge and run only the Foundation/fake-store core tests. Never run
# the EventKit executable, request TCC permission, sign, or install an app.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
SWIFT_DIR="$PROJECT_DIR/swift"
export CLANG_MODULE_CACHE_PATH="$SWIFT_DIR/.build/module-cache"
export SWIFTPM_MODULECACHE_OVERRIDE="$CLANG_MODULE_CACHE_PATH"

# SwiftPM's nested sandbox cannot run inside the Relay sandbox. This package has
# no external dependencies or plugins; all caches stay in the worktree.
exec swift test --disable-sandbox \
  --package-path "$SWIFT_DIR" \
  --scratch-path "$SWIFT_DIR/.build" \
  --cache-path "$SWIFT_DIR/.build/cache" \
  --config-path "$SWIFT_DIR/.build/config" \
  --security-path "$SWIFT_DIR/.build/security" \
  -Xswiftc -module-cache-path -Xswiftc "$CLANG_MODULE_CACHE_PATH" \
  --filter GuardedCalendarCoreTests
