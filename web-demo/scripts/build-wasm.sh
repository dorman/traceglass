#!/usr/bin/env bash
# Build the TraceGlass WASM crate into web-demo/pkg for Vite to consume.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
WASM_CRATE="$REPO/traceglass/wasm"
OUT="$ROOT/pkg"

command -v wasm-pack >/dev/null || {
  echo "wasm-pack is required (https://rustwasm.github.io/wasm-pack/)" >&2
  exit 1
}

rustup target add wasm32-unknown-unknown >/dev/null

echo "Building traceglass-wasm (release, web target)…"
wasm-pack build "$WASM_CRATE" \
  --target web \
  --release \
  --out-dir "$OUT" \
  --out-name traceglass_wasm

# Drop wasm-pack scaffolding we do not ship.
rm -f "$OUT/.gitignore" "$OUT/package.json" "$OUT/README.md"

RAW_BYTES=$(wc -c < "$OUT/traceglass_wasm_bg.wasm" | tr -d ' ')
GZ_BYTES=$(gzip -c "$OUT/traceglass_wasm_bg.wasm" | wc -c | tr -d ' ')
echo "WASM raw: ${RAW_BYTES} bytes"
echo "WASM gzip: ${GZ_BYTES} bytes"
printf '%s\n' "$RAW_BYTES" > "$OUT/wasm-size-raw.txt"
printf '%s\n' "$GZ_BYTES" > "$OUT/wasm-size-gzip.txt"
