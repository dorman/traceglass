# TraceGlass test matrix

The fixtures cover plain text, JSON, NDJSON, CSV, `.csb`, malformed structured
input, empty input, vendor-specific text, and representative Docker,
Kubernetes, systemd, nginx, MySQL, PostgreSQL, Windows Event, EDR, Splunk, and
generic diagnostic lines. `cargo test --locked` exercises the normalizer and
the real binary's raw, JSON, CSV, and stdin modes.

The `tui_smoke` integration test uses a real cross-platform PTY at 120x32: it
opens `samples/sample.log`, exercises viewer `a`, asserts the prompt and
post-rescan status name a keyword highlight and the local watchlist, filters to
the known `ERROR` match, opens W to confirm the saved entry, and then checks
that a curated built-in finding still renders `source: builtin`. It retains
the watchlist invalid-regex, duplicate, remove, save, reload, and persistence
journey, including that `watchlist.json` contains only the user entry. The
findings journey also checks export feedback and the collision-safe Markdown
path. Set `TRACEGLASS_SMOKE_BINARY` to run the same test against an extracted
release binary.

The renderer tests use `ratatui::backend::TestBackend` for the wide help sheet
and compact 42x12 layouts. The compact matrix covers the stacked highlight
legend, findings filter/detail summary, two-row local watchlist footer, browser
footer, local-watchlist input prompt, settings, progress overlays, empty-file/
no-match states, walkthrough prompt/pages, and hit-test rectangles. The
supported PTY journey remains
120x32; 42x12 is intentionally a deterministic render-only stress case because
PTY resize behavior is not portable across all supported hosts.

The walkthrough unit and event coverage checks its unseen/skipped/completed
config states, page transitions, skip persistence, replay from `T`, and that
machine-mode CLI invocations never initialize it. Its copy is checked against
the local-only and human-review evidence contract.

Run the focused Rust matrix from `traceglass/`:

```text
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
cargo test --locked --test tui_smoke -- --nocapture
```

The last command drives the built binary through crossterm events rather than
testing a mock renderer. The test documents the current behavior only: no
candidate suggestions or AI behavior are added. No anomaly assertions belong
here: those records are part of the sibling Node CLI contract, not the Rust TUI
state.

Watchlist persistence tests use an isolated temporary directory through the
temporary `TRACEGLASS_CONFIG_DIR` fixture and remove it after each case; they never
write a real user config directory. The canonical persisted state is
traceglass/watchlist.json with version 1 typed keyword/regex entries. Unit coverage exercises ordered
round trips, missing defaults, strict malformed/unsupported documents,
duplicate/empty/invalid input, and replacement failure preservation.

The PTY watchlist journey uses the real binary and the same temporary config
override: viewer `a`, inspect/add/reject/remove entries, save, scan for built-in
evidence, close, reopen, and reload. The supported smoke size is 120x32;
narrow-terminal rendering is covered by the UI test backend at 42x12 where a
real PTY size is not portable.

The lens matrix checks the shipped `lenses/v0.1.0/catalog.json`, all three
stable IDs, version validation, duplicate/unknown reference failure, stable
placement, and explicit `other-evidence` fallback behavior. CLI coverage
exercises `--lens` in JSON/CSV, raw sanitization, stdin, invalid-selection exit
2, repeated analysis stability, and retained provenance/explanation/evidence.
The real 120x32 PTY journey selects lenses with `L`, number shortcuts, and
Enter, observes a changed review order without rescanning, jumps to selected
source evidence, and verifies that built-in findings never enter the persisted
user watchlist. The 42x12 backend matrix includes the chooser, findings detail,
footer, and help-sheet lens text.

Release artifact smoke tests use these exact target payload names:

- `traceglass-x86_64-unknown-linux-gnu.tar.gz`
- `traceglass-aarch64-apple-darwin.tar.gz`
- `traceglass-x86_64-apple-darwin.tar.gz`
- `traceglass-x86_64-pc-windows-msvc.zip`

The corresponding native installers are `traceglass-installer-<target>` on Unix
and `traceglass-installer-x86_64-pc-windows-msvc.exe` on Windows. The release
manifest binds each installer and payload to its exact URL, hash, signature,
and executable hash.

Each archive must contain only the target directory, its platform executable,
`README.md`, and `LICENSE`. The native `traceglass-installer` verifies the signed
manifest, exact canonical URL/path, detached Ed25519 payload signature,
SHA-256, archive traversal/symlink policy, exact executable, and executable
hash before installation. Missing signatures, altered archives, extra
executables, and declined consent must leave the user install untouched.

The shell and PowerShell files are local wrappers only. They refuse a piped
invocation and never download or execute remote text. There is no checksum
bypass, `sudo` default, telemetry, service, or auto-update path.

The release workflow runs package, fmt, clippy, Rust tests, installer build,
PTY/machine-mode smoke checks, archive-content checks, and signed-manifest
generation before creating a GitHub Release. It fails closed when the external
`TRACEGLASS_RELEASE_SIGNING_KEY_PEM` secret is absent. No crates.io publication is
performed by the workflow.

## Signature regression matrix

`src/signatures.rs` contains one positive fixture and one named negative or
near-miss for each of the 23 Rust built-ins. The fixtures are table-driven and
assert stable IDs, unique metadata, deterministic matching, and the deliberate
reversed tamper phrasing gap. `tests/unit/signatures/catalog-quality.test.ts`
loads every shipped JSON pattern across v0.1.0 and v0.2.0, checks trusted
metadata/provenance, and runs its `examples.positive` and `examples.negative`
inputs against the compiled matcher. Exact carry-forward IDs may repeat across
catalog versions only when their match identity is unchanged.

Run the focused checks with:

```text
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test --locked
npm run test -- tests/unit/signatures tests/unit/logsift-format.test.ts tests/unit/logsift-run.test.ts tests/unit/logsift-watchlist.test.ts
```

Machine-output tests assert signature ID, source/provenance, rationale, caveat,
location/evidence, lens ID/version/group/priority, and the absence of
clean/infected or AI classification fields. The PTY watchlist test confirms a
user keyword remains the only saved entry after a built-in scan and lens change.
