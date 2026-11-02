#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SWIFT_DIR="$PROJECT_ROOT/swift"
BIN_DIR="${BIN_DIR:-$PROJECT_ROOT/bin}"
BUNDLE_ID="me.jbkjr.macos-mcp-bridge"
APP_DIR="$BIN_DIR/MacOSMCPBridge.app"

echo "Building Swift CLI..."
cd "$SWIFT_DIR"

# Build in release mode
swift build -c release

# Copy the binary to bin directory
mkdir -p "$BIN_DIR"
cp ".build/release/MacOSMCPBridge" "$BIN_DIR/macos-mcp-bridge"

# Re-sign ad-hoc so the embedded Info.plist is bound into the signature.
# Without a bound Info.plist, TCC cannot show a consent dialog and
# EventKit access requests fail with "Unknown error".
codesign --force --sign - --identifier "$BUNDLE_ID" "$BIN_DIR/macos-mcp-bridge"

# Assemble the .app bundle the server prefers (see src/utils/eventkit-cli.ts).
# Launched via LaunchServices, it is its own TCC responsible process.
# Note: ad-hoc signatures are keyed to the cdhash, so each rebuild may
# require granting Calendar/Reminders/Contacts access again.
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
cp "Resources/Info.plist" "$APP_DIR/Contents/Info.plist"
cp ".build/release/MacOSMCPBridge" "$APP_DIR/Contents/MacOS/MacOSMCPBridge"
codesign --force --sign - --identifier "$BUNDLE_ID" "$APP_DIR"

echo "Swift CLI built successfully: $BIN_DIR/macos-mcp-bridge, $APP_DIR"
codesign -dv "$APP_DIR" 2>&1 | grep -E 'Identifier|Info.plist' || true
