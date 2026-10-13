# TraceGlass browser demo (portable)

Self-contained static demo that runs the TraceGlass signature scanner in the
browser via WebAssembly. Intended to move as-is into the future
`dorman/traceglass-site` marketing repo.

## Privacy claim (honest)

- Your log is read with the **File API** and scanned in WASM on the main thread.
- Nothing is uploaded. Closing or refreshing the page discards everything.
- CSP allows `connect-src 'self'` only so the page can fetch the local `.wasm`
  asset at startup. Scanning itself issues **no** network requests (asserted in
  Playwright). There are no analytics or third-party scripts.

## What's included / excluded

| Included | Excluded (native-only) |
| -------- | ---------------------- |
| Built-in signature library | Filesystem / directory walks |
| Lenses (`incident-reliability`, etc.) | Zip extraction |
| Plain / JSON / NDJSON / CSV line scan | Interactive TUI |
| Planted-incident sample replay | Watchlist / config persistence |

## Develop

```bash
# from repo root
cd web-demo
npm install
npx playwright install chromium   # once
npm run dev                       # builds wasm then Vite
```

## Build / test

```bash
npm run build                     # wasm-pack + vite build → dist/
npm test                          # Playwright against preview server
```

Artifacts land in `artifacts/` (`wasm-size.json`, `sample-scan.json`, `perf-50mb.json`).

## Layout

- `../traceglass/` — library + CLI (features gate TUI/fs)
- `../traceglass/wasm/` — `wasm-bindgen` crate
- `pkg/` — generated JS/WASM (gitignored; CI builds it)
- `public/samples/` — vendored planted-incident logs from draft PR #52
