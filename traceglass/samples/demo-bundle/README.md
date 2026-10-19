# Demo support bundle (CASE-2026-1013-8841)

Synthetic L2 escalation pack for TraceGlass README / Terminal Trove GIF
recording. Entirely fake: documentation IPs (`192.0.2.0/24`,
`198.51.100.0/24`, `203.0.113.0/24`), `*.example.com` hosts, and obviously
fake tokens. Do not treat any value as a real secret.

Open the nested `case/` tree (or `demo-bundle.zip`) for demos so this
README is not loaded as a log tab.

## Planted issue

Root cause: the checkout API pod ran out of heap under load and was killed
by the node (memory pressure). That produced a Kubernetes restart loop, then
a cascade: edge proxy lost backends, clients saw 5xx/timeouts, Postgres and
MySQL showed concurrency / capacity pain from the reconnect storm, and the
node unit reported a failed start.

Noise (healthy boot lines, routine GC, checkpoints, keepalive closes) is
included so the demo shows TraceGlass lifting the needle, not a file full of
only alerts.

## Expected findings (built-in signatures)

Open with the Incident / Reliability lens. Findings sort **Critical first**,
then High, then Medium; within a severity band the lens ranks availability
signals ahead of runtime/capacity/diagnostics. You should see roughly this
mix (counts can vary slightly if a line hits more than one pattern):

| Severity | Signature id | Why it appears |
| -------- | ------------ | -------------- |
| Critical | `fatal-error-crash` | API worker abort / dump in `case/app/api.log` (row 1) |
| High | `resource-exhaustion` | Explicit memory-pressure line in `case/app/api.log` |
| High | `kubernetes-workload-failure` | Restart-loop / memory-kill markers in `case/k8s/events.log` |
| High | `container-runtime-failure` | containerd / OCI start failure in `case/system/journal.log` |
| High | `nginx-upstream-failure` | Edge upstream loss in `case/edge/nginx-error.log` |
| High | `postgresql-connection-transaction-failure` | DB connectivity / lock pain in `case/db/postgres.log` |
| High | `mysql-storage-concurrency-failure` | Pool capacity signal in `case/db/mysql.log` |
| Medium | `connection-refused-reset` | Peer reject lines at the edge |
| Medium | `systemd-unit-failure` | Unit start failure in `case/system/journal.log` |
| Medium | `diagnostic-assertion-traceback` | Python stack marker in `case/app/api.log` |

`case/system/config-snapshot.env` is background context (fake URLs / tokens).
`case/system/thumbnail.bin` is a tiny binary TraceGlass should skip.

## Suggested GIF script (~25 seconds)

Build or install TraceGlass first (`cargo build` from `traceglass/`, or
`cargo run --manifest-path traceglass/Cargo.toml -- …`).

```bash
# From the traceglass/ crate directory:
cargo run --quiet -- --lens incident-reliability samples/demo-bundle/case
# or, after install:
# traceglass --lens incident-reliability samples/demo-bundle/case
# zip of the case tree (no README tab):
# traceglass --lens incident-reliability samples/demo-bundle.zip
```

Keystrokes once the TUI opens (scan runs automatically):

1. **0–3s** — findings panel appears; severity bar shows Critical + High.
2. **`j` `j`** — step through the top Critical/High rows; detail pane explains each.
3. **`Enter`** — jump to the source line (memory-pressure / abort in `app/api.log`).
4. **`Tab`** — next file; **`p`** / **`P`** walk findings across tabs.
5. **`L`** then **`2`** — confirm Incident / Reliability grouping (if not already set).
6. **`e`** — optional: export `traceglass-findings.md`.
7. **`q`** — quit.

Preflight without a TTY (paste into the PR / notes):

```bash
cargo run --quiet -- --lens incident-reliability --format json \
  --findings /tmp/demo-bundle-findings.json samples/demo-bundle/case
```

## Layout

```
demo-bundle/
  README.md                      this file (human instructions)
  case/                          open this tree in TraceGlass
    app/api.log                  application / worker log
    k8s/events.log               cluster events
    edge/nginx-error.log         edge proxy errors
    db/postgres.log              primary database log
    db/mysql.log                 inventory cache database log
    system/journal.log           node journal excerpt
    system/config-snapshot.env   fake config snapshot
    system/thumbnail.bin         binary skip demonstrator
samples/demo-bundle.zip          zip of case/ (same contents, no README)
```
