# loglens

This repository contains the loglens marketing app and the canonical Rust CLI
source in [`loglens/`](./loglens/). loglens is a local-first terminal tool for
opening diagnostic logs, finding severity-ranked signals, and reviewing the
source evidence without uploading log content. Keyword and regex highlights
are user-controlled entries in a local watchlist; curated built-in signatures
are separate versioned scan metadata. The watchlist needs no AI or network
access, and no candidate suggestions are currently generated.

## CLI install

The primary beta path is the LogSift one-click installer. It is planned for
Linux glibc x86_64, macOS Apple silicon, macOS Intel, and Windows x86_64. The
installer is not advertised as available until the matching native installer,
CLI archive, signed Ed25519 manifest, detached signatures, and SHA-256 data are
published together in a GitHub Release.

When published, download the installer for the exact target from
[GitHub Releases](https://github.com/dorman/loglens/releases), run it locally,
and follow its prompts. It verifies the signed manifest, target payload, safe
archive contents, and extracted executable before any install write. It defaults
to a current-user location, asks before PATH or shortcut changes, and asks
before opening a new terminal for the no-argument interactive TUI. It never
uploads logs, enables telemetry, installs a service, or silently updates.

Windows SmartScreen, macOS Gatekeeper/Developer ID, and notarization status are
separate from the Ed25519 release signature and are only claimed when those
publisher credentials are configured.

Until the beta artifacts are published, the technical fallback is a source
build with Rust 1.85 or newer:

```sh
git clone https://github.com/dorman/loglens.git
cd loglens
cargo install --path . --locked
```

### Contributor development

Source builds are for contributors who need to change the Rust crate:

```sh
git clone https://github.com/dorman/loglens.git
cd loglens
cargo build --locked
cargo test --locked
```

## CLI behavior

A regular file path opens the interactive ratatui TUI and scans on open:

```sh
loglens agent.log
loglens ./diagnostic-bundle/
loglens support-logs.zip
```

Piped stdin defaults to sanitized raw text. Explicit modes are always
non-interactive and suitable for scripts:

```sh
cat app.log | loglens
loglens --format raw app.log
loglens --format json events.ndjson
loglens --format csv events.csb
loglens --lens incident-reliability --format json events.ndjson
cat app.log | loglens --stdin --format json
```

Supported input includes plain text, `.txt`, `.log`, JSON, NDJSON, CSV, `.csb`
(treated as CSV), folders, ZIP bundles, and stdin. JSON/CSV parsing enriches
the `message` field while preserving each raw source line. Malformed or
vendor-specific structures warn on stderr and fall back to line-level
scanning/filtering.

The curated built-in signature catalog covers Docker/container logs, Kubernetes/k8s,
systemd/journal, nginx, MySQL, PostgreSQL, Windows Event Logs, antivirus/EDR,
Splunk exports, and generic diagnostics. The TUI supports search, visible-line
filtering, severity filtering, highlight navigation, and jump/triage from a
finding to its source line. Pressing `a` or `r` and confirming a value adds a
keyword or regex highlight to the local watchlist; built-ins never enter the
saved file. Findings are evidence for human review, not a security
determination.

On the first interactive launch, loglens offers an optional four-page
walkthrough for opening files and bundles, choosing lenses, searching/filtering,
and reading/exporting findings. Press `Enter` to start, or `s`/`Esc` to skip.
The choice is stored locally in the loglens config file; `T` in the viewer or
help screen, or `--walkthrough`, replays it. Piped stdin, redirected output,
`--format`, and `--findings` remain non-interactive and never print onboarding.

The versioned `v0.1.0` lens catalog provides three deterministic review modes:
`general-triage` (default), `incident-reliability`, and `security-signals`.
`--lens <id>` selects one for a run. Lenses change grouping and priority only;
all matches, source lines, occurrences, jump targets, provenance, explanations,
and false-positive notes remain available. Unsupported external or legacy
evidence is retained as `other-evidence`. Processing is local and AI-free, and
lens selection never changes the separate user watchlist.

## Machine-output schema

`raw` removes ANSI and control sequences while retaining source text.
`json` emits an array of records:

```json
{
  "file": "events.ndjson",
  "line": 2,
  "raw": "{\"message\":\"connection refused\"}",
  "message": "connection refused",
  "severity": "medium",
  "finding": {
    "category": "network",
    "title": "Connection refused / reset",
    "evidence": "..."
  }
}
```

`csv` emits the stable header
`file,line,severity,message,evidence,raw,signature_id,source,catalog,version,set,pattern,severity_rationale,explanation,false_positive_note,matched_evidence,lens_id,lens_version,lens_group,lens_priority`.
JSON and CSV include all source lines, including rows without a finding.

## Marketing app

The commands below develop the surrounding Next.js marketing app; they are not
CLI installation instructions.

The surrounding Next.js app is a local product site. It uses the Polsia
template's Next.js, Prisma, Tailwind, and shadcn baseline. App development
commands are:

```sh
npm install
npm run typecheck
npm run lint
npm run test
SKIP_ENV_VALIDATION=1 npm run build
```

The CLI fixture and mode matrix is documented in
[`loglens/tests/README.md`](./loglens/tests/README.md). The CLI's complete
usage guide and resource limits are in
[`loglens/docs/USER_GUIDE.md`](./loglens/docs/USER_GUIDE.md).
