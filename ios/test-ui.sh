#!/usr/bin/env bash
# Generate the Xcode project and run the UI tests on an iPhone simulator:
# SIMULATOR_UDID if set, else a booted iPhone, else the first available one.
set -euo pipefail
cd "$(dirname "$0")"
xcodegen generate --quiet
udid=${SIMULATOR_UDID:-$(xcrun simctl list devices available -j | python3 -c '
import json, sys
devices = json.load(sys.stdin)["devices"]
phones = [d for runtime in sorted(devices, reverse=True) if "iOS" in runtime for d in devices[runtime] if d["name"].startswith("iPhone")]
print(next((d for d in phones if d["state"] == "Booted"), phones[0])["udid"])')}
echo "Simulator: $udid"
rm -rf build/ui.xcresult
xcodebuild test -project OathSteps.xcodeproj -scheme OathSteps -destination "id=$udid" -derivedDataPath build -resultBundlePath build/ui.xcresult CODE_SIGNING_ALLOWED=NO "$@"
