# TraceGlass trust statement

For L2 support specialists and IT/security reviewers who need a plain-language
answer to: *does this tool phone home with customer logs?*

**No AI, no network access needed to scan. Nothing is uploaded, no telemetry, no phone-home.**

This page is limited to facts that can be checked in the current source. Deeper
threat analysis lives in [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md). Release
readiness lives in [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md).
Operator steps for the signed GitHub Release path (secret, rc tag, installer
smoke) live in [`RELEASING.md`](RELEASING.md).

---

## What you run, what it does

| Component | Network? | What it touches |
| --------- | -------- | --------------- |
| **`traceglass` scanner / TUI** (the tool you use on a log bundle) | **No.** Scanning and viewing are local-only. | Reads the files/folders/ZIPs you open; optional local config under `~/.config/traceglass` (or `TRACEGLASS_CONFIG_DIR`). |
| **`traceglass-installer`** (one-click install from GitHub Releases) | **Yes.** It downloads the signed release manifest and payloads over HTTPS. | Verifies Ed25519 signatures and SHA-256, then installs for the current user. |
| **Marketing website** (this repo’s Next.js app) | Separate from the CLI. Not used when you scan logs offline. | N/A to air-gapped triage. |
| **Optional WASM browser demo** (`web-demo/`) | Loads same-origin `.wasm` at startup; scans stay in-tab (no upload). | Not required for offline CLI triage; see threat model + `web-demo/POC_NOTES.md`. |

Approved summary again: **No AI, no network access needed to scan. Nothing is uploaded, no telemetry, no phone-home.**

---

## Scanner: no phone-home (verifiable)

The CLI crate (`traceglass/`) has **no HTTP/network client dependency**.
`traceglass/Cargo.toml` lists local libraries only (clap, crossterm, ratatui,
regex, serde, csv, zip, …). There is no `reqwest`, `ureq`, `hyper`, or similar
in the scanner dependency tree.

Behavior that stays on the machine:

- Built-in signature scan and user watchlist highlights run in-process
  (`traceglass/src/signatures.rs`, `traceglass/src/rules.rs`, `traceglass/src/app.rs`).
- Config and watchlist files are written only under the local config directory
  (`traceglass/src/config.rs`, `traceglass/src/watchlist.rs`).
- Export writes a local markdown file in the process working directory
  (`App::export_findings` in `traceglass/src/app.rs`).
- Machine modes (`--format raw|json|csv`) write to stdout / a local `--findings`
  path (`traceglass/src/output.rs`).

### Sockets (important precision)

Do **not** claim the TUI “never opens any socket.” On Unix, the interactive TUI
uses crossterm’s event source, which creates **local `AF_UNIX` socketpairs**
(`UnixStream::pair`) for terminal/event wakeup — not network connections. That
code lives in the `crossterm` dependency (for example
`event/source/unix/tty.rs` → `nonblocking_unix_pair`), pulled in via
`traceglass/src/event.rs` / `traceglass/src/main.rs`.

Non-interactive modes (`--format …`, pipes) do not need that TUI event loop.
Neither mode opens outbound TCP/UDP for scanning.

### Installer: network is expected

The installer **does** use the network. `traceglass/installer/Cargo.toml`
depends on `reqwest` (blocking + rustls). `traceglass/installer/src/main.rs`
downloads the release manifest, signature, and payload from GitHub Releases,
then verifies them before writing
(`traceglass/installer/src/lib.rs`: embedded public key, URL allowlist, hash
checks, safe archive extraction).

After install, running `traceglass` on a log file does not call back to that
installer path.

---

## How to verify yourself

### 1. Run offline

```sh
# After you already have a local binary (source build or previously installed):
unshare -n --map-root-user traceglass --format raw /path/to/sample.log
# or disconnect NIC / enable airplane mode, then:
traceglass /path/to/support-bundle.zip
```

If scanning required the network, these would fail. They should succeed.

### 2. Firewall / egress test

Point a host firewall or corporate proxy deny-all egress at the workstation,
then open a customer bundle with `traceglass`. The session should still scan
and render. (The **installer** will fail under deny-all — that is expected.)

### 3. Dependency / source review

```sh
cd traceglass
grep -E 'reqwest|ureq|hyper|tokio::net' Cargo.toml Cargo.lock || true
# Expect no hits for the scanner crate. The installer crate under
# installer/ is the component that uses reqwest.
```

### 4. Checksums and Ed25519-signed manifest (published releases)

When a GitHub Release is published by the signed pipeline:

1. Download `SHA256SUMS`, `SHA256SUMS.sig`, `traceglass-release.json`, and
   `traceglass-release.json.sig` with the installer/payload for your target.
2. Verify the Ed25519 signatures against the **public** key embedded in
   `traceglass/installer/src/lib.rs` (`SIGNING_PUBLIC_KEY_B64` /
   `SIGNING_KEY_ID` = `traceglass-ed25519-26deb421`).
3. Confirm SHA-256 digests match `SHA256SUMS`.
4. Prefer the native installer (it performs these checks before install), or
   follow [`RELEASING.md`](RELEASING.md) and `traceglass/release/README.md`.

Windows Authenticode / macOS Developer ID + notarization are **separate** from
this Ed25519 release layer and are **not** configured yet (see the release
checklist and [`RELEASING.md`](RELEASING.md)).

---

## What this document does *not* claim

- It does not claim the installer works offline.
- It does not claim “no sockets at all” for the TUI (local `AF_UNIX` pairs exist).
- It does not claim OS code signing (Authenticode / notarization) unless those
  pipelines are actually configured.
- It does not claim the optional WASM demo is a substitute for the offline CLI;
  that path must keep a strict CSP and client-side-only processing (see the
  threat model and `web-demo/POC_NOTES.md`).
