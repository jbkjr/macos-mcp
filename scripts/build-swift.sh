#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SWIFT_DIR="$PROJECT_ROOT/swift"
BIN_DIR="$PROJECT_ROOT/bin"

echo "Building Swift CLI..."
cd "$SWIFT_DIR"

# Build in release mode
swift build -c release

# Copy the binary to bin directory
mkdir -p "$BIN_DIR"
cp ".build/release/MacOSMCPBridge" "$BIN_DIR/macos-mcp-bridge"

echo "Swift CLI built successfully: $BIN_DIR/macos-mcp-bridge"
