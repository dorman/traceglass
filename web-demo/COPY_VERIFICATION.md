# Marketing copy verification (vs draft 2026-10-13)

Checked against implementation on branch `cursor/wasm-browser-demo-587e`.

## (1) Same engine / same catalog?

**Yes — same crate, same code path, same embedded catalog. Not a subset.**

| Piece | Evidence |
| ----- | -------- |
| Signatures | WASM calls `traceglass::scan` → `signatures::Library::builtin()` in `traceglass/src/signatures.rs` — the identical built-in set the CLI uses |
| Lenses | Both embed `traceglass/lenses/v0.1.0/catalog.json` via `include_str!`; `CATALOG_VERSION = "v0.1.0"` |
| Findings schema | Same `traceglass.findings.v1` document shape as `--findings` |
| Crate wiring | `traceglass-wasm` depends on `traceglass` with `default-features = false, features = ["wasm-scan"]` — not a fork |

What differs is **I/O / UI**, not detection: no TUI, no filesystem walks, zip is in-memory (no temp dir). FAQ wording *"same scanning engine… CLI adds the full terminal UI, folders, and scripted output"* is accurate.

## (2) Zero network after initial load?

**Yes for scanning.** Headless Chromium ledger (Playwright + one-off capture):

**On load (same-origin only, 4 requests):**
1. `GET /` (document)
2. `GET /assets/index-*.js` (script)
3. `GET /assets/index-*.css` (stylesheet)
4. `GET /assets/traceglass_wasm_bg-*.wasm` (fetch — wasm-bindgen init)

**Hosts:** only `127.0.0.1:4173`. **External / CDN / analytics / webfonts:** none.

**After load** (sample scan + zip scan): **0 requests**.

Fonts use `@font-face { src: local(...) }` only — no Google Fonts / CDN. If IBM Plex is not installed locally, the stack falls back to system fonts without networking.

**CSP:** `connect-src 'self'` (needed for the local `.wasm` fetch at startup). No analytics scripts.

**Offline proof prompt:** valid *after* the page (and `.wasm`) have loaded. Turn off Wi-Fi then scan — works. Do not claim the *first* visit works fully offline (must fetch self assets once).

## (3) ZIP / support-bundle in WASM?

**Yes (added in this follow-up).** In-memory extractor `traceglass::zip_mem` + `scan_zip_bytes` WASM export. User can drop a `.zip`; Playwright confirms planted-incident findings from `demo-bundle.zip` with zero post-load network.

Not identical to CLI path (CLI uses on-disk temp extract via `ingest::extract_zip`); same zip crate + same safety caps, no filesystem.

## CTA / privacy line

Demo page now uses:
- Primary: **Watch the replay**
- Secondary: **Scan a log in your browser**
- Privacy: **Your file stays in this browser tab. It's never uploaded, so there's nothing for us to store or delete.**

## Copy claim flags

| Draft claim | Verdict | Suggested wording if needed |
| ----------- | ------- | --------------------------- |
| “same engine as the CLI” | **Keep** | Optional clarity: “same signature library and lens catalog as the CLI” |
| “drop in your own log” + ZIP | **Keep** (ZIP now supported) | — |
| “Nothing leaves your machine” | **Keep** for scan path | — |
| Network-tab / Wi-Fi proof | **Keep with nuance** | “Once the page has loaded, open the network tab or turn off Wi-Fi — the scan still works.” |
| “Is this the real tool?” FAQ | **Keep** | Already honest about TUI/folders/scripted output |
| “root cause?” FAQ | **Keep** | Matches disclaimer |
| After-demo GitHub / Install CTAs | **OK** | Top-level navigations on click; not fetched at load |

## Size note after ZIP

Enabling in-memory zip grew the wasm blob: **~1.20 MiB raw / ~0.47 MiB gzip** (was ~1.08 / ~0.41).
