#!/bin/sh
# Copies a tagged version of github.com/atem-lab/kit into /kit/, so the site serves its fonts and scripts from its own
# origin (no third party sees a visit). Usage: scripts/kit.sh v0.1.0
set -eu
tag="${1:?usage: scripts/kit.sh <tag>, e.g. v0.1.0}"
here="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL "https://codeload.github.com/atem-lab/kit/tar.gz/refs/tags/$tag" | tar -xz -C "$tmp"
src="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d)"
rm -rf "$here/kit"
mkdir -p "$here/kit"
cp -R "$src/src" "$src/fonts" "$src/README.md" "$here/kit/"
printf '%s\n' "$tag" > "$here/kit/VERSION"
echo "kit $tag in $here/kit"
