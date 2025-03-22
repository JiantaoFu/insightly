#!/bin/bash

# Create build directory
mkdir -p build

# Package for Chrome
zip -r build/chrome-extension.zip . \
  -x "build/*" \
  -x ".*" \
  -x "*.git*" \
  -x "build.sh"

# Package for Firefox
zip -r build/firefox-addon.zip . \
  -x "build/*" \
  -x ".*" \
  -x "*.git*" \
  -x "build.sh"

echo "Build complete!"
echo "Chrome extension: build/chrome-extension.zip"
echo "Firefox addon: build/firefox-addon.zip"

echo "Testing instructions:"
echo "Chrome: Go to chrome://extensions, enable Developer mode, and click 'Load unpacked'"
echo "Firefox: Go to about:debugging#/runtime/this-firefox, click 'Load Temporary Add-on' and select manifest.json"
