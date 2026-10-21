#!/usr/bin/env bash
# Copy the published site (the menu, shared assets, every planner and the gathering guide) into a folder.
# Usage: tools/build_site.sh [out-dir]   (default: _site)
set -euo pipefail
cd "$(dirname "$0")/.."
out="${1:-_site}"
rm -rf "$out"
mkdir -p "$out"
cp index.html LICENSE NOTICE.md "$out"/
cp -r shared essence-extraction crafting macros *-planner "$out"/
# Serve files as they are: no Jekyll processing.
touch "$out/.nojekyll"
echo "Site written to $out ($(find "$out" -type f | wc -l) files)"
