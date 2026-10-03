# Changelog

## v0.2.0

- Added `splunk-search-errors` for Splunk search-peer, timeout, dispatch, and
  licensing signals.
- Added `windows-event-anomalies` for Windows Event IDs and system anomalies.
- Added `antivirus-edr-alerts` for antivirus and EDR vendor alerts.
- Carried forward `nginx-access-errors`, `postgres-timeouts`, and
  `docker-container-crashes` from v0.1.0 without changing their manifests or
  version provenance.
- Removed no sets.
- Added stable IDs, explanations, severity rationales, false-positive notes,
  and positive/negative audit fixtures to every shipped pattern. Carry-forward
  patterns retain their v0.1.0 version provenance.

The `signatures/v0.1.0/` catalog remains available for backward-compatible
consumers. The canonical v0.2.0 loader input is the directory
`signatures/v0.2.0/`, not an aggregate manifest file.
