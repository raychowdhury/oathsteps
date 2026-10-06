#!/usr/bin/env bash
# Regenerate the Xcode project (new files are picked up) and build for the simulator.
set -euo pipefail
cd "$(dirname "$0")"
xcodegen generate --quiet
xcodebuild -project OathSteps.xcodeproj -scheme OathSteps -destination 'generic/platform=iOS Simulator' -derivedDataPath build CODE_SIGNING_ALLOWED=NO build "$@"
