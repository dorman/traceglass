# TraceGlass

**Grammarly for logs** — a local Rust terminal UI that opens diagnostic logs,
finds review signals, and helps you search, filter, and triage the evidence.
Keyword and regex highlights are user-controlled entries in a local watchlist;
curated built-in signatures are a separate versioned scan catalog. No AI,
network access, or log upload is needed.

traceglass is designed for handed-over files and bundles: Docker and container
logs, Kubernetes/k8s output, systemd/journal logs, nginx logs, MySQL and
PostgreSQL logs, Windows Event Logs, antivirus/EDR collections, Splunk exports,
and generic diagnostic text.

## Install

The TraceGlass one-click beta installer is the primary non-developer path. The
planned target matrix is Linux glibc x86_64, macOS Apple silicon, macOS Intel,
and Windows x86_64. A target is not available until its native installer, CLI
payload, signed Ed25519 manifest, detached signatures, and SHA-256 values are
published together in a GitHub Release.

When a target is published, download its installer locally from
[GitHub Releases](https://github.com/dorman/traceglass/releases) and run it. The
installer verifies the Ed25519 manifest, exact GitHub URL/path, payload
signature, SHA-256, safe archive contents, and extracted executable before
writing. Missing, altered, unsigned, or unexpected data fails closed.

The default location belongs to the current user. The installer explains
UAC/Gatekeeper/permission prompts and asks before modifying PATH, creating a
shortcut, or opening a new terminal. A successful opt-in launch starts
`traceglass` with no arguments in the interactive welcome/browser TUI. If no
terminal can be opened, it prints the installed path and a manual command.

The beta installer has no log upload, telemetry, service/daemon, or silent
auto-update behavior. Ed25519 release signatures are publisher verification;
Windows Authenticode, macOS Developer ID, and notarization are separate and
are not claimed without their external credentials.

The release pairs are Linux glibc x86_64 (`traceglass-installer-x86_64-unknown-linux-gnu` plus a `.tar.gz` payload), macOS Apple silicon (`traceglass-installer-aarch64-apple-darwin` plus a `.tar.gz` payload), macOS Intel (`traceglass-installer-x86_64-apple-darwin` plus a `.tar.gz` payload), and Windows x86_64 (`traceglass-installer-x86_64-pc-windows-msvc.exe` plus a `.zip` payload).

### Technical source fallback

Until signed beta artifacts are published, or for contributors, use Rust 1.85
or newer and build from a clone:

```sh
git clone https://github.com/dorman/traceglass.git
cd traceglass/traceglass
cargo install --path . --locked
traceglass --version
traceglass --help
```

### Contributor source build

Source builds are for contributors who need to modify the crate:

```sh
git clone https://github.com/dorman/traceglass.git
cd traceglass/traceglass
cargo build --locked
cargo test --locked
cargo clippy --all-targets --locked -- -D warnings
cargo fmt --check
```

## Run

A regular file path opens the interactive TUI and scans on open:

```sh
traceglass agent.log
traceglass ./diagnostic-bundle/
traceglass support-logs.zip
```

With no path, an interactive terminal opens the welcome/browser flow. A pipe
defaults to sanitized raw text and never enables terminal control protocols:

```sh
kubectl logs api-0 | traceglass
journalctl -u nginx | traceglass
```

The first interactive launch offers an optional four-page walkthrough covering
opening files and bundles, review lenses, search/filter controls, and findings.
Press `Enter` to start or `s`/`Esc` to skip. The decision is stored locally in
the config file. Press `T` in the welcome/viewer/help surface, or run
`traceglass --walkthrough`, to replay it. Machine modes never initialize the TUI
or emit walkthrough copy.

Use explicit machine modes for scripts and CI. They are non-interactive for
both files and stdin:

```sh
traceglass --format raw events.ndjson
traceglass --format json events.ndjson
cat export.csv | traceglass --format csv
traceglass --format json --findings traceglass-findings.json events.ndjson
traceglass --findings traceglass-findings.json app.log
traceglass --lens security-signals --format json events.ndjson
cat app.log | traceglass --stdin --format json
```

`raw` writes source text with ANSI and control sequences removed. `json` writes
a JSON array of stable records with `file`, `line`, `raw`, `message`,
`severity`, and optional `finding` evidence (`category`, `title`, `evidence`).
`csv` writes the same data with the header:
`file,line,severity,message,evidence,raw,signature_id,source,catalog,version,set,pattern,severity_rationale,explanation,false_positive_note,matched_evidence,lens_id,lens_version,lens_group,lens_priority`.

### Findings evidence export

`--findings <PATH>` writes a pretty-printed JSON document with a final newline
using the versioned `traceglass.findings.v1` schema. It can be used alone or
alongside `--format raw`, `--format json`, or `--format csv`; the selected
stdout format remains unchanged. With no explicit format, it selects the same
non-interactive sanitized raw output used for piped input. The destination is
written locally after scanning; log content and findings are never submitted
automatically to a network service or AI system.

The document has the fixed top-level fields `schema`, `kind` (always
`observability_evidence`), `disclaimer`, and `findings`. Each finding contains
`source_file`, `location.line`, `match.signature_id`, `match.pattern`,
`signal_type`, `severity`, `explanation`, `provenance`, `message`,
`matched_evidence`, and `lens`. `provenance` is the existing matcher metadata
(`source`, `catalog`, `version`, `set`, and `pattern`); `lens` contains its
deterministic `id`, `version`, `group`, and numeric `priority`. The match
identity fields are stable signature/watchlist identities when available and
are JSON `null` when a future finding source does not provide them; they are
never derived from mutable explanatory text.

Only normalized records with a built-in finding are included. Findings retain
source traversal and one-based line order, so identical inputs and lens
selection produce byte-for-byte identical documents. An input with no findings
writes the same schema and disclaimer with `"findings": []`. The export is
evidence annotation only: severity and lens priority are deterministic source
metadata, not AI confidence, a root-cause verdict, or a clean/infected or
security verdict.

### Versioned analysis lenses

The default `general-triage` lens orders recognized evidence by severity and
stable source location. `incident-reliability` prioritizes availability and
dependencies, then runtime/deployment, capacity, and diagnostics.
`security-signals` prioritizes protection/integrity, execution/persistence,
identity/audit, and `other-evidence`. Select a lens for one run with
`--lens <id>`; the shipped catalog version is `v0.1.0`.

Lens selection never changes matchers, removes lines, or changes jump targets.
Machine output and Markdown exports show lens ID/version/group/priority beside
the existing provenance, rationale, explanation, false-positive note, and
matched evidence. The TUI uses `L` from the viewer or findings panel and
supports `j/k`, `1/2/3`, Enter, and Esc. Changing lenses re-ranks cached
findings without rescanning and never writes `watchlist.json`. These are
deterministic review aids, not security verdicts or completeness claims.

## Input and review behavior

Plain text, `.txt`, `.log`, JSON, NDJSON, CSV, and `.csb` (treated as CSV) are
accepted. JSON and CSV fields enrich the `message` value while the original
line remains available for display, search, and evidence. Malformed or
vendor-specific structures produce a warning and fall back to line-level
scanning; they are not rejected solely because no dedicated parser exists.

The TUI shows source lines and severity-ranked findings. `/` searches, `f`
filters visible lines, `S` rescans, `s` opens the findings panel, `f`/`F` in
that panel filters severity, `p`/`P` moves between findings, and `Enter` jumps
to the selected evidence. Pressing `a` or `r` opens a prompt; confirming the
value adds a keyword or regex highlight to the local watchlist. Built-in
signatures produce findings but are never saved into that watchlist. Findings
are signals for human review; traceglass reports evidence and severity without
making a security determination. No candidate suggestions are currently
generated.

Folders and ZIP bundles retain the existing bounded, local-only behavior:
binary files are skipped during collection, symlinks are not followed, and
file, line, archive, extraction, and open-tab limits remain enforced. No log
content is uploaded, telemetered, or processed remotely.

## Command-line reference

```text
traceglass [OPTIONS] [FILES]...
```

| Option | Meaning |
| --- | --- |
| `[FILES]...` | Files, folders, or `.zip` archives to open or process |
| `-k, --keyword <KEYWORD>` | Literal keyword highlight for this run; repeatable or comma-separated |
| `-r, --regex <PATTERN>` | Regex highlight for this run; repeatable |
| `-i, --ignore-case` | Case-insensitive user highlights for this session |
| `--no-scan` | Skip scan-on-open in the TUI; press `S` to scan later |
| `--format <raw\|json\|csv>` | Force a non-interactive output format |
| `--findings <PATH>` | Write matched findings to a versioned local observability JSON document |
| `--lens <id>` | Select `general-triage`, `incident-reliability`, or `security-signals` |
| `--walkthrough` | Replay the interactive walkthrough; machine modes remain non-interactive |
| `--stdin` | Read stdin explicitly, even when it is a terminal |
| `--version` | Print version |
| `--help` | Print CLI help |

## Development

```sh
cargo build --locked
cargo test --locked
cargo clippy --all-targets -- -D warnings
cargo fmt --check
```

The fixture and mode matrix is documented in [`tests/README.md`](tests/README.md).
Resource limits are documented in [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md).
