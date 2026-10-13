# WASM browser demo — POC notes

## Approach

1. Converted `traceglass` from binary-only to **lib + bin**.
2. Feature-gated native-only pieces:
   - `tui` → crossterm/ratatui + UI modules
   - `fs` → on-disk zip ingest, config, watchlist
   - `cli` → clap machine entrypoint
   - `wasm-scan` → in-memory scanner + in-memory zip
3. Added `traceglass::scan` (shared by CLI findings path and WASM).
4. Added `traceglass/wasm` (`wasm-bindgen`) and portable `web-demo/`.

## Included

- Full built-in signature library + lenses (**same code / catalog as CLI**)
- Plain / JSON / NDJSON / CSV structured enrichment
- In-memory ZIP support-bundle scan (`zip_mem`)
- Planted-incident sample replay (real WASM findings)
- Try-your-own via File API (log or zip, no upload)
- Strict CSP, no analytics / third-party / CDN scripts or webfonts

## Excluded (honest)

- Directory walks / filesystem browser
- On-disk zip temp extraction (CLI path)
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
requests during sample, user-file, and zip scans. Ideal `connect-src 'none'`
would need inlining the wasm bytes (possible follow-up).

See also `COPY_VERIFICATION.md` for marketing-copy claim checks.

## Perf & memory (headless Chromium)

Measured 2026-10-13 with Playwright Chromium
(`--enable-precise-memory-info`, best-effort `--expose-gc`). Reproduce:

```bash
cd web-demo && npm run build && npm run preview &
node scripts/bench-sizes.mjs   # → artifacts/bench-sizes.json
```

**Memory metric:** Chrome `performance.memory.usedJSHeapSize` peak while
scanning (JS heap sample, **not** process RSS). Crossing a string into wasm
linear memory roughly doubles resident cost for large inputs.

**Hard limit:** `traceglass::scan::MAX_SOURCE_BYTES` = **50 MiB** per source
(UI rejects larger text files). That is where the demo stops being useful for
a single file today.

| Workload | Size | Wall | WASM timer | Findings | Peak JS heap | Peak Δ vs baseline | Result |
| -------- | ---- | ---- | ---------- | -------- | ------------ | ------------------- | ------ |
| Planted-incident sample | 6.4 KiB | **36 ms** | **34 ms** | 16 | 1.4 MiB | +0.1 MiB | OK |
| Synthetic log | **10 MiB** | **234 ms** | **170 ms** | 1 (fatal) | 31.4 MiB | +30.1 MiB | OK |
| Synthetic log | **50 MiB** | **1001 ms** | **727 ms** | 1 (fatal) | 151.7 MiB | +150.4 MiB | OK (at cap) |
| Synthetic log | **200 MiB** | ~1.2 s to fail | — | 0 | **602.6 MiB** | +601.3 MiB | **Fails** — `exceeds 52428800 byte limit` |

### Degradation / failure notes

- **≤10 MiB:** snappy; heap peak ≈ 3× input (JS string + JSON bridge + wasm copy).
- **50 MiB:** usable but main-thread bound (~1 s wall); heap peak ≈ **150 MiB Δ** — tab can hitch; no progress UI yet.
- **>50 MiB:** rejected by the scanner guard. The current `scan_with_meta(JSON.stringify…)` bridge still materializes the oversized payload in JS (and may touch wasm) **before** the guard fires, so a hostile/oversized drop can spike heap (~600 MiB observed for 200 MiB) even though no findings are produced. Launch hardening should size-check in JS **before** stringify/wasm and/or stream chunked scans.
- **ZIP:** supported in-memory; same 50 MiB-per-member spirit via extract caps; not separately timed in this table (sample zip is tiny).

### Bundle size (for context)

| Artifact | Raw | Gzip |
| -------- | --- | ---- |
| `traceglass_wasm_bg.wasm` (with in-memory zip) | ~1.20 MiB | ~0.47 MiB |

## Launch-ready by 2026-11-15 — effort estimate

**Verdict:** Soft-launchable by Nov 15 if hosting destination is decided in the
next few days and we stick to a **≤50 MiB / sample-first** marketing demo.
Not blocked on scanner correctness; blocked on productization and repo move.

Today is 2026-10-13 (~4.5 weeks to Nov 15). Remaining work is bounded polish,
not a rewrite.

### Remaining tasks (concrete)

| # | Task | What changes | Invasiveness | Depends on owner |
| - | ---- | ------------ | ------------ | ---------------- |
| 1 | **Hosting / repo split** — create or confirm `dorman/traceglass-site`, copy `web-demo/` + build recipe, CI deploy (Pages/Vercel static), canonical URL | New repo or subtree; little TraceGlass core churn | Medium (process), low (code) | **Yes — must decide host** |
| 2 | **UX polish** — brand pass on site, motion/timing of replay, mobile layout, “Install CLI / GitHub” destinations, honest limits callout (50 MiB, zip OK, no folders) | Mostly `web-demo/` HTML/CSS/TS | Low–medium | Design sign-off |
| 3 | **Accessibility** — full keyboard path for dropzone/replay, focus management, live-region polish, contrast audit, reduced-motion | `web-demo/` only | Low | — |
| 4 | **Large-file handling** — JS pre-check before wasm; progress/cancel; optional Worker so UI stays responsive; fail soft on >50 MiB without 600 MiB heap spike; consider chunked scan later | `web-demo` + small wasm API tweaks | Medium | Size policy (keep 50 MiB?) |
| 5 | **CSP / privacy proof** — optional inline wasm for `connect-src 'none'`; keep Playwright no-network gate | Build pipeline | Low–medium | — |
| 6 | **Size budget (optional)** — push gzip wasm toward &lt;300 KiB via `opt-level=z` / subset signatures if marketing requires | `wasm` profile + maybe feature | Medium | Kill criteria on size |
| 7 | **Sample hygiene** — drop vendored demo-bundle once PR #52 merges; point site at one canonical fixture | Samples only | Low | Merge #52 |

### Sequencing suggestion (to hit Nov 15)

1. **Owner decisions this week:** host repo + public URL + whether 50 MiB cap / ~0.5 MiB gzip wasm is acceptable.
2. **Parallel track A:** stand up site repo + static deploy of current `web-demo` (task 1) — unlocks a private preview URL immediately.
3. **Parallel track B:** a11y + UX polish + JS size pre-check (tasks 2–4 minimum bar) on the demo.
4. **Before public link:** task 5 network-proof wording + Playwright green on site CI; task 7 if #52 landed.
5. **Stretch (only if size is a launch blocker):** task 6.

### Risk if delayed

- Hosting decision slips → nothing public even if code is ready.
- Shipping without JS pre-check → oversized drops can still thrash memory (see 200 MiB row).
- Trying full CLI parity (folder walks, TUI-in-browser) before Nov 15 → out of scope; do not.

### Out of scope for Nov 15 soft launch

- Directory ingest in-browser
- Full TUI in canvas
- Streaming multi-hundred-MiB scans without a raised cap + Worker design
- Perfect gzip size without a deliberate signature subset
