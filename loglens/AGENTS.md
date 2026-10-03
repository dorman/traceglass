# AGENTS.md

## Cursor Cloud specific instructions

`loglens` is a single-binary Rust terminal UI (TUI) app ("Grammarly for logs"). There is only one service: the CLI/TUI binary itself.

### Toolchain
- The crate uses `edition = "2024"` (see `Cargo.toml`), which requires Rust >= 1.85. The default `rustup` toolchain is set to `stable` (currently 1.97.x). Do not downgrade; the pre-1.85 toolchain fails to even parse the manifest (`feature edition2024 is required`).

### Build / lint / test / run
Standard commands (also documented in `README.md` "Development"):
- Build: `cargo build` / `cargo build --release`
- Lint: `cargo clippy --all-targets -- -D warnings` and `cargo fmt --check`
- Test: `cargo test` (unit tests live inline in `src/*.rs`; must run from the crate root so `samples/` resolves)
- Run: `cargo run -- samples/bundle` (or any file/folder/.zip)
- Install smoke: `cargo install --path . --locked && loglens --version`
- Release: hold tagging until after merge + thorough testing. When ready, tag
  `v*` on `master` for the signed GitHub Release workflow. The workflow never
  publishes crates.io; source/Cargo installation remains the technical fallback.

### CI & release
- **PR/CI** (`.github/workflows/rust.yml`): push/PR to `master`; matrix
  `ubuntu-latest` / `macos-latest` / `windows-latest`; steps are
  `fmt --check`, `clippy -D warnings`, `cargo test`, release build, and
  (Unix only) `cargo install --path . --force --locked` + `--version`/`--help`.
- **Tagged release** (`.github/workflows/release.yml`): push `v*` (or
  `workflow_dispatch` with a tag). Builds the four exact target triples,
  native installers, payload archives, signed Ed25519 manifest, detached
  signatures, and SHA-256 data. It fails without the external signing secret
  and does **not** publish to crates.io.
- **`scripts/install.sh` and `install.ps1`**: local wrappers only. They refuse
  remote-shell piping and launch the already-downloaded native installer; the
  native installer owns verification, current-user install, consent, and TUI
  launch.
  Maintainer tag steps live in `docs/USER_GUIDE.md` — do not duplicate them here.

### Code map
Startup wiring (`src/main.rs`): `Cli::parse` → `Theme::dark()` + `rules::build_rules`
→ `App::new` → enable mouse/bracketed paste → `event::run` ⇄ `ui::draw` →
restore terminal (panic hook also clears mouse/paste).

| Module | Role |
| ------ | ---- |
| `cli.rs` | clap: files, `-k`/`-r`/`-i`, `--format`, `--stdin` |
| `app.rs` | State: tabs/files, rules, search/filter, scan, status, open caps, hit-test regions |
| `event.rs` | Modes `Viewer` / `Browser` / `Input`; keys/mouse; scan chunking (`SCAN_CHUNK`); paste only in Input |
| `ui.rs` | Layout: tabs, log+gutter, legend, lean status, welcome / browser / findings / help / input |
| `ingest.rs` | Resolve file/dir/zip → `LoadTarget`s (+ temp dir for zips); collect caps |
| `records.rs` | Classify plain/JSON/NDJSON/CSV/`.csb` input and preserve normalized records |
| `output.rs` | Sanitize raw output and serialize stable JSON/CSV machine records |
| `rules.rs` | Compile keyword/regex highlights with size/nest budgets |
| `signatures.rs` | Built-in Medium–Critical scan library (no catch-all ERROR/WARN) |
| `theme.rs` | Dark palette + level-tint tokens; panel chrome (no theme cycling) |
| `browser.rs` | In-TUI filesystem browser (mark / open / recursive `O`) |
| `clipboard.rs` | OSC-52 yank helpers (`copy_text`) |
| `config.rs` | Tiny `~/.config/loglens` prefs (ignore-case, legend, scan-on-open, browser cwd); edited in-app via the settings panel (`,`) |

Hot paths worth knowing:
- **Open** → `ingest::resolve` → `LogFile::load` / `rescan` → rebuild filtered view
- **Scan** → `begin_scan` then `scan_step` chunks so the UI stays responsive; cancel clears gutter dots

Safety/resource caps (50 MiB logs, zip extract budgets, 250k lines/file, 64
rules, 10k findings, …) are documented for operators in
`docs/USER_GUIDE.md` → "Limits & safety". Constants live beside the enforcing
code in `ingest.rs` / `app.rs` / `rules.rs` — prefer updating both together.

### Running the TUI (non-obvious)
- A regular file on an interactive terminal opens the full-screen TUI using crossterm raw mode + alternate screen and mouse capture. Piped stdin, redirected output, and explicit `--format raw|json|csv` modes are non-interactive.
- Useful sample data lives in `samples/` (`sample.log`, `big.log`, `network.log`, `bundle/`, `bundle.zip`).
- A scan starts automatically on open (`--no-scan` opts out); `S` rescans the curated built-in signature catalog. Other first moves: `a` add a keyword highlight to the local watchlist, `r` add a regex highlight to the local watchlist, `/` search, `f` filter, `:` go to line, `m` bookmark (`M` clear), `←`/`→` pan long lines, `y`/`Y` yank line/path, `e` export findings, `,` settings, `?` help, `q` quit. No candidate suggestions or AI behavior exists.
- CLI smoke checks without a TTY include piped raw output and explicit `--format raw|json|csv`, plus `loglens --version` and `loglens --help`.
