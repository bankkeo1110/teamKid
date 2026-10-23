#!/usr/bin/env bash
# Build the public website (Vercel): landing page + a browser-only KID Office demo + install.ps1.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf public && mkdir -p public/office/vendor
cp site/index.html public/index.html
cp kidwin/office/index.html kidwin/office/office3d.js kidwin/office/demo-client.js public/office/
cp kidwin/office/vendor/* public/office/vendor/
cp install.ps1 VERSION public/
echo "built public/ (Team KID $(cat VERSION))"
