# Signature evidence contract

LogSift exposes deterministic local matches as evidence, not verdicts. A
finding is an upstream signal for observability or an explicitly selected
downstream tool; it is never a clean/infected/security classification and it
does not promote itself into a user rule. Curated built-in signatures are
immutable, versioned scan metadata. They are separate from the user's local
keyword/regex watchlist, which changes only when the user explicitly adds or
removes a highlight. No AI or network service generates the current catalog,
and no candidate suggestions are currently produced.

## Shared metadata vocabulary

Every trusted shipped pattern has an immutable lowercase `id` that does not
depend on its display title or catalog version. Its audit metadata contains:

- `explanation`: what the line means in plain English.
- `severityRationale`: why the existing severity tier was chosen.
- `falsePositiveNote`: the most important benign interpretation to check.
- `examples.positive` and `examples.negative`: small regression fixtures that
  exercise the exact literal/regex boundary.

Machine evidence uses the same provenance fields on both catalogs:
`source`, `catalog`, `version`, `set`, and `pattern`. The Rust source is
`source=builtin`, `catalog=loglens-rust-builtins`, `version=builtin-v1`,
`set=core`. JSON-manifest matches are `source=builtin`,
`catalog=logsift-json-manifests`, and retain their manifest version and set.
Entries from a user watchlist are `source=user_watchlist` and carry no
built-in signature provenance. Legacy external manifests remain usable for
compatibility but are marked `source=legacy_external`, `trust=legacy`.

## Lens metadata

`loglens/lenses/v0.1.0/catalog.json` is the reviewed lens catalog. It references
signature IDs and never duplicates match expressions. Each lens has ordered
groups with explicit priorities plus an `other-evidence` fallback. General
Triage includes every reviewed signature; Incident / Reliability emphasizes
availability/dependency, runtime/deployment, capacity, and diagnostics; Security
Signals emphasizes protection/integrity, execution/persistence, identity/audit,
and then other evidence. Unknown external or legacy evidence is not discarded.

Machine findings add `lens_id`, `lens_version`, `lens_group`, and
`lens_priority`; the TUI and Markdown export show the same context. Ordering is
stable: lens priority, group order, severity, source/file order, line, stable
signature ID, then match text. Selection changes review order/grouping only and
does not alter matching or the separate user watchlist.

## Rust built-in audit inventory

The Rust binary keeps this catalog compiled into `loglens/src/signatures.rs`;
it does not load the JSON files at runtime. The 23 IDs are:

| ID | Severity | Area |
| --- | --- | --- |
| `tamper-protection-disabled` | Critical | protection tampering |
| `powershell-encoded-command` | High | encoded PowerShell |
| `process-injection-hollowing` | High | process injection |
| `lolbin-execution` | Medium | living-off-the-land binary |
| `system-clock-rollback` | High | clock manipulation |
| `certificate-validation-failure` | High | certificate trust |
| `signature-database-corrupt` | High | definition store |
| `fatal-error-crash` | Critical | fatal/crash marker |
| `resource-exhaustion` | High | memory/disk/handle/I/O |
| `connection-refused-reset` | Medium | network dependency |
| `update-failure` | Medium | update path |
| `installer-rollback` | Medium | install/repair |
| `access-denied-unauthorized` | Medium | permission boundary |
| `container-runtime-failure` | High | container runtime |
| `kubernetes-workload-failure` | High | Kubernetes workload |
| `systemd-unit-failure` | Medium | systemd service |
| `nginx-upstream-failure` | High | nginx upstream |
| `mysql-storage-concurrency-failure` | High | MySQL storage/locks |
| `postgresql-connection-transaction-failure` | High | PostgreSQL |
| `windows-event-audit-service-failure` | Medium | Windows Event |
| `edr-alert` | High | endpoint detection |
| `splunk-search-indexer-failure` | High | Splunk search/indexing |
| `diagnostic-assertion-traceback` | Medium | diagnostic exception |

Each built-in has a table-driven positive fixture and a named near-miss in the
Rust unit tests. The deliberate reversed phrasing `Real-time protection was
disabled` remains a non-match for `tamper-protection-disabled`; broadening that
pattern is deferred until a reviewed positive/negative pair is available.

## JSON catalog inventory

The shipped manifests contain 27 unique pattern IDs across the v0.1.0 and
v0.2.0 directories. v0.2.0 carries the three v0.1.0 sets forward unchanged
and adds `antivirus-edr-alerts`, `splunk-search-errors`, and
`windows-event-anomalies`; repeated IDs are accepted only when their set,
pattern name, and match definition are identical. The catalog-quality test
loads every pattern's positive and negative examples and checks trusted
provenance, duplicate identity, and malformed metadata behavior.

The catalogs intentionally retain their separate version directories and
version provenance. They are preview/consumer data, not a runtime dependency
of the Rust built-in scanner.

## Output and watchlists

Rust JSON keeps the existing normalized record shape and adds rich `finding`
metadata. Rust CSV keeps its existing columns and appends stable signature and
evidence columns. Markdown exports include ID, provenance, severity rationale,
explanation, false-positive note, location, occurrence span, and matched line.
Node JSON records preserve the same fields under `signature`; Node CSV adds
the corresponding columns. None of these formats emit a clean/infected
verdict or an AI-generated classification.

The TUI's `watchlist.json` remains a versioned document containing only the
operator's local keyword and regex entries. Pressing the add action and
confirming a keyword or regex highlight writes that user entry to the local
watchlist. Built-ins are immutable scan metadata; opening the watchlist
workspace, saving, or reloading it never serializes or promotes a built-in
finding. A future candidate suggestion would remain a suggestion until the
operator explicitly accepted it.

## Maintainer checks

Run the focused suites from the repository root:

```text
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test --locked
npm run test -- tests/unit/signatures tests/unit/logsift-format.test.ts tests/unit/logsift-run.test.ts tests/unit/logsift-watchlist.test.ts
```

When adding a reviewed pattern, update its stable metadata and both examples
in the same change. Keep a coverage gap documented here or in the inline test
table rather than widening a family without evidence.
