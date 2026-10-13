# WASM browser demo — POC notes

## Approach

1. Converted `traceglass` from binary-only to **lib + bin**.
2. Feature-gated native-only pieces:
   - `tui` → crossterm/ratatui + UI modules
   - `fs` → zip ingest, config, watchlist
   - `cli` → clap machine entrypoint
   - `wasm-scan` → in-memory scanner only
3. Added `traceglass::scan` (shared by CLI findings path and WASM).
4. Added `traceglass/wasm` (`wasm-bindgen`) and portable `web-demo/`.

## Included

- Full built-in signature library + lenses
- Plain / JSON / NDJSON / CSV structured enrichment
- Planted-incident sample replay (real WASM findings)
- Try-your-own via File API (no upload)
- Strict CSP, no analytics / third-party scripts

## Excluded (honest)

- Directory walks / filesystem browser
- Zip extraction
- Interactive TUI
- Watchlist / config persistence
- Worker threads (native scanner is cooperative on the UI thread anyway)

## Sample provenance

`traceglass/samples/demo-bundle/` and `web-demo/public/samples/` are **vendored
from draft PR #52** (`cursor/demo-bundle-ba9e`) because that sample is not on
`main` yet. See `VENDOR_NOTE.md`.

## CSP

`connect-src 'self'` is required so wasm-bindgen can `fetch` the same-origin
`.wasm` at startup. After load, Playwright asserts **zero** further network
requests during sample and user-file scans. Ideal `connect-src 'none'` would
need inlining the wasm bytes (possible follow-up).
