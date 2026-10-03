# TraceGlass signature library — v0.2.0

This directory is the v0.2.0 signature data catalog. It is a directory of
per-set JSON manifests consumed by the web catalog loader; there is no
aggregate `manifest.json` file. The Rust CLI has a separately tested built-in
catalog and does not load this directory at runtime.

Use the files as catalog data for the app's signature preview and contract
tests. They are not a command-line installation or runtime-loader contract.

Every manifest follows the v0.1.0 contract: `version`, lower-kebab `set`,
title, description, and one or more patterns. Each pattern has one `string` or
`regex` matcher and a `critical`, `warning`, `notice`, or `debug` severity.
Shipped patterns additionally require an immutable lower-kebab `id`,
`explanation`, `severityRationale`, `falsePositiveNote`, and positive/negative
`examples` fixtures. Repeated v0.1.0 IDs retain their original identity and
version provenance; they are not silently reinterpreted as v0.2.0 patterns.

## Set inventory

| Manifest | Coverage |
| --- | --- |
| `nginx-access-errors.json` | Carried forward from v0.1.0: nginx 5xx, upstream, permission, and disconnect signals |
| `postgres-timeouts.json` | Carried forward from v0.1.0: PostgreSQL timeout, connection, and deadlock signals |
| `docker-container-crashes.json` | Carried forward from v0.1.0: container exits, OOM, runtime, panic, and restart signals |
| `splunk-search-errors.json` | Splunk search-peer failures, search timeouts, dispatch errors, and license violations |
| `windows-event-anomalies.json` | Windows failed logons, audit-log clearing, service installation, and clock changes |
| `antivirus-edr-alerts.json` | Antivirus and EDR threat, detection, isolation, remediation, and update alerts |

## Compatibility

v0.2.0 is additive and keeps the v0.1.0 manifest shape and matching semantics.
The original `signatures/v0.1.0/` directory remains available for consumers
that need the earlier three-set catalog. The v0.2.0 directory carries those
three operational manifests forward unchanged and adds the three new
vendor-focused manifests; their v0.1.0 version provenance is preserved.

The Rust built-in catalog is separate and does not load these JSON files at
runtime. See `traceglass/docs/SIGNATURES.md` for the shared evidence vocabulary,
watchlist boundary, and deferred coverage gaps.
