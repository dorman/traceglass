# TraceGlass threat model

Scope: the Rust CLI/TUI (`traceglass/`), the native installer
(`traceglass/installer/`), the signed GitHub Release pipeline
(`.github/workflows/release.yml`), and a possible future WASM browser demo.
The marketing Next.js app is out of band except where it hosts download links.

Related: [`../TRUST.md`](../TRUST.md) (plain-language privacy),
[`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) (v0.1.0-rc / v0.1.0 gates),
[`../RELEASING.md`](../RELEASING.md) (signed-release operator runbook).

---

## 1. Assets

| Asset | Why it matters |
| ----- | -------------- |
| Customer / support **log content** | Often contains hostnames, tokens, PII, proprietary errors. |
| **Findings / exports** written locally | Derived evidence; still sensitive. |
| Local **config + watchlist** (`~/.config/traceglass`) | Operator preferences and custom patterns. |
| **Release binaries + installers** | Integrity of what support staff run. |
| **Ed25519 release signing key** (`TRACEGLASS_RELEASE_SIGNING_KEY_PEM`) | Publisher authenticity for GitHub Release artifacts. |
| Embedded **public key / key id** in the installer | Trust anchor for offline verification of downloads. |
| Operator **terminal session** | Escape-sequence attacks can corrupt or hijack the TTY. |
| Optional **WASM demo** (`web-demo/`) | Brand trust; must not become an upload or exfil channel. |

---

## 2. Trust boundaries

```
┌─────────────────────────────────────────────────────────────┐
│  Operator workstation                                       │
│  ┌──────────────┐   local files only   ┌─────────────────┐  │
│  │ Untrusted    │ ───────────────────► │ traceglass CLI  │  │
│  │ log / ZIP    │                      │ / TUI (no HTTP) │  │
│  └──────────────┘                      └────────┬────────┘  │
│                                                 │ optional  │
│                                                 ▼           │
│                                        local config/export  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Install path (separate)                                    │
│  installer ──HTTPS──► GitHub Releases (manifest + payload)  │
│       │ verifies Ed25519 + SHA-256 + URL allowlist          │
│       ▼                                                     │
│  current-user install directory                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Release CI (GitHub Actions)                                │
│  tag v* → build 4 targets → sign with repo secret → publish │
└─────────────────────────────────────────────────────────────┘
```

- **Inside the scanner boundary:** process memory, opened paths, local config.
- **Crossing the boundary (installer only):** HTTPS to `github.com/<repo>/releases/...`
  as enforced in `traceglass/installer/src/lib.rs`.
- **Not crossed by scan:** no telemetry endpoints, no account API, no AI service.

---

## 3. Threats and mitigations

### 3.1 Malicious or huge log input

**Threat:** A hostile support bundle tries to OOM the process, fill disk, or
hang the UI.

**Mitigations (present):**

| Control | Location |
| ------- | -------- |
| 50 MiB per log file | `MAX_LOG_BYTES` in `traceglass/src/ingest.rs`; also enforced in `LogFile` load in `traceglass/src/app.rs` |
| 250k lines / file, 32 KiB / line, 1M session lines, 500 open tabs | `MAX_LINES_PER_FILE`, `MAX_LINE_BYTES`, `MAX_TOTAL_LINES`, `MAX_OPEN_FILES` in `traceglass/src/app.rs` |
| Scan finding cap 10k; match caps per line/file | `MAX_FINDINGS`, `MAX_MATCHES_*` in `traceglass/src/app.rs` |
| Chunked scan so the UI stays responsive | `SCAN_CHUNK` / `scan_step` path in `traceglass/src/event.rs` + `app.rs` |
| Operator-facing table | `traceglass/docs/USER_GUIDE.md` → “Limits & safety” |

### 3.2 Parser / regex DoS

**Threat:** Pathological regexes (user `-r` / watchlist) or pathological log
shapes burn CPU.

**Mitigations:**

| Control | Location |
| ------- | -------- |
| Regex size + DFA size + nest limits | `REGEX_SIZE_LIMIT`, `REGEX_NEST_LIMIT` in `traceglass/src/rules.rs` |
| Max pattern length 512 B; max 64 rules | `MAX_REGEX_PATTERN_LEN`, `MAX_RULES` |
| Keywords are `regex::escape`d | `compile_rule` in `traceglass/src/rules.rs` |
| Input prompt rejects control chars; 4 096 char cap | `push_input_chars` in `traceglass/src/app.rs` |
| Paste only applied in input mode | `traceglass/src/event.rs` |

**Gap:** Rust `regex` is generally linear, but a large file × many rules can
still be slow near caps. Caps bound damage; they do not make scanning free.

### 3.3 Zip bombs and zip-slip

**Threat:** Small archive expands hugely, or entries escape the extract dir
(`../`).

**Mitigations:**

| Control | Location |
| ------- | -------- |
| Compressed archive size gate before CDR parse | `MAX_ZIP_ARCHIVE_BYTES` in `traceglass/src/ingest.rs` |
| Per-entry / total extract budgets + entry count | `MAX_EXTRACT_FILE_BYTES`, `MAX_EXTRACT_TOTAL_BYTES`, `MAX_EXTRACT_ENTRIES` |
| Limited reader discards oversize streams | `extract_zip` in `ingest.rs` |
| Path containment / zip-slip rejection | `extract_zip` + tests in `ingest.rs` |
| Temp dir `0700`, removed on `Drop` | ingest + `App` temp_dirs |
| Symlinks not followed in folder collect | `ingest.rs` |
| Installer archive member allowlist | `traceglass/installer/src/lib.rs` (`UnsafeArchiveMember`, single expected executable) |

### 3.4 Terminal escape injection in rendered logs

**Threat:** Logs containing CSI/OSC/BEL sequences corrupt the operator’s
terminal, clear the screen, or inject clipboard/title changes when printed.

**Status on current main: mitigated for log display and machine output — not
an open vulnerability.**

| Control | Location |
| ------- | -------- |
| TUI path replaces C0/C1 controls (except TAB) with U+FFFD before store/render | `sanitize_log_line` in `traceglass/src/app.rs` (`split_log_lines`); unit test `sanitizes_ansi_and_control_characters_in_log_lines` |
| Non-interactive / record path strips ANSI CSI/OSC and other controls | `sanitize_text` in `traceglass/src/records.rs`; used by `traceglass/src/output.rs` |
| Ratatui cell painting does not re-interpret ANSI from string content | `traceglass/src/ui.rs` |
| Intentional OSC-52 only on user yank (`y`/`Y`), size-capped, from already-sanitized lines | `traceglass/src/clipboard.rs`, callers in `app.rs` |

**Residual notes (not current CVEs, keep watching):**

- OSC-52 is a deliberate terminal escape written by TraceGlass itself when the
  operator yanks; hostile *log* bytes should not reach that path unsanitized.
- Markdown export embeds sanitized excerpts; exotic filenames with backticks
  could still skew markdown structure if the export is rendered by a loose
  viewer (`format_findings_markdown` in `app.rs`) — low impact, local file.

If sanitization were ever removed or bypassed on a render path, treat that as
a **high** severity regression and block release.

### 3.5 Supply chain / dependencies

**Threat:** Compromised crate or GitHub Action steals the signing key or
injects a backdoor.

**Mitigations:**

- Locked builds (`--locked`) in CI (`.github/workflows/rust.yml`, `release.yml`).
- `cargo audit` job in Rust workflow.
- Workflow pin-by-SHA style for actions (Dependabot / action bumps from #50 are
  on `main`).
- Scanner dependency surface intentionally small; network stack isolated to
  the installer crate.

**Gaps / recommendations:**

- Keep Dependabot (or equivalent) current as actions/crates continue to move.
- Periodically re-run `cargo audit` / `cargo deny` if adopted.
- Prefer minimal feature flags on `zip` / `reqwest` (already `default-features = false` where used).

### 3.6 Release signing key compromise

**Threat:** Attacker with `TRACEGLASS_RELEASE_SIGNING_KEY_PEM` can publish
malware that the installer trusts.

**Mitigations:**

- Private key only in GitHub Actions secrets; never committed
  (`traceglass/release/README.md`, `release.yml`, [`RELEASING.md`](../RELEASING.md)).
- Public key + key id embedded and reviewable in
  `traceglass/installer/src/lib.rs` (`SIGNING_KEY_ID` =
  `traceglass-ed25519-26deb421`).
- Workflow refuses to publish without the secret (early validate gate + OpenSSL
  `pkeyutl -rawin` signing from #51).

**Gaps / recommendations:**

- Owner-only key generation and storage; rotate if exposed.
- Restrict who can push `v*` tags and who can edit repo secrets.
- After rotation, ship a new installer build with the new public key (old
  installers will not trust new signatures — plan a transition).

### 3.7 Installer tampering / substitute artifacts

**Threat:** Modified installer binary, swapped payload, or MITM returning a
wrong file.

**Mitigations:**

- Manifest + per-artifact Ed25519 signatures and SHA-256
  (`installer/src/lib.rs`, `release.yml` publish job).
- Canonical GitHub Release URL/path checks (`UnexpectedUrl`).
- Hash of extracted executable checked after unpack.
- Fail closed on missing/altered/unsigned data.

**Gaps:**

- Until OS code signing exists, users may see SmartScreen/Gatekeeper warnings
  even for authentic binaries (see release checklist).
- Users who bypass the installer and run an unsigned binary from an untrusted
  mirror are outside this trust model.

### 3.8 WASM web demo (on `main` via #54)

**Threat:** A browser demo silently uploads logs, loads third-party scripts, or
exfiltrates via loose CSP.

**Current posture** (`web-demo/`, `web-demo/POC_NOTES.md`):

- Process files **only in the browser** (File API); no upload endpoint.
- Strict CSP with no analytics / third-party / CDN scripts or webfonts.
- `connect-src 'self'` is required so wasm-bindgen can `fetch` the same-origin
  `.wasm` at startup; Playwright asserts **zero** further network requests
  during sample / user-file / zip scans. Ideal `connect-src 'none'` would need
  inlining wasm bytes (documented follow-up).
- Size caps in the same spirit as the CLI (50 MiB guard in the POC).
- Demo is local-to-the-tab, not a substitute for the offline CLI trust story in
  [`TRUST.md`](../TRUST.md).

**Gap:** Do not advertise a public demo URL as fully audited until hosting is
decided and CSP + no-network-after-load proofs stay green on that path.

---

## 4. Existing mitigations map (quick index)

| Concern | Primary files |
| ------- | ------------- |
| No scanner network client | `traceglass/Cargo.toml`, absence of HTTP crates; contrast `installer/Cargo.toml` |
| Local AF_UNIX TUI wakeup (not phone-home) | crossterm `UnixStream::pair` via TUI event loop (`src/event.rs`) |
| Escape sanitization | `src/app.rs`, `src/records.rs`, `src/output.rs` |
| Zip / size / open caps | `src/ingest.rs`, `src/app.rs` |
| Regex budgets | `src/rules.rs` |
| Installer verify | `installer/src/lib.rs`, `installer/src/main.rs` |
| Signed release | `.github/workflows/release.yml`, `installer-smoke.yml`, `traceglass/release/README.md`, `RELEASING.md` |
| Operator docs | `traceglass/docs/USER_GUIDE.md`, `TRUST.md`, `RELEASING.md` |
| WASM demo CSP / no-upload | `web-demo/` (+ Playwright specs), `web-demo/POC_NOTES.md` |

---

## 5. Gaps and recommendations

1. **Add `TRACEGLASS_RELEASE_SIGNING_KEY_PEM`** (owner-only), then run the
   `v0.1.0-rc` dry-run + Installer smoke on all four targets. See
   [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) and
   [`RELEASING.md`](../RELEASING.md). Release-hardening PRs #50/#51/#53 are
   already on `main` (OpenSSL Ed25519 `-rawin` included).
2. **OS code signing:** Microsoft Artifact Signing / Authenticode and Apple
   Developer ID + notarization are **not started**. Expect SmartScreen and
   Gatekeeper friction; document honestly.
3. **Keep escape sanitization under test** in CI; treat regressions as
   release-blocking.
4. **WASM:** keep strict CSP and no-network-after-load proofs before any public
   demo URL; consider inlining wasm for `connect-src 'none'`.
5. **Optional hardening:** markdown-escape export filenames/excerpts; consider
   `cargo deny` licenses/advisories gate; document key-rotation runbook.
