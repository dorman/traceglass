# Releasing TraceGlass

This document covers the signed GitHub Release path used for the `v0.1.0-rc`
dry-run ahead of the November 15, 2026 launch. Binaries are **Ed25519-signed at
the TraceGlass release layer** (`traceglass-release.json`, per-artifact `.sig`
files, and `SHA256SUMS`). They are **not** Windows Authenticode-signed or macOS
Developer ID / notarized yet.

Also see [`TRUST.md`](TRUST.md) (privacy / no phone-home),
[`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md), and
[`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) (rc → stable gates).

## One-time: add the signing secret

1. Generate an Ed25519 key pair offline (owner only). Keep the private key out of
   git, tickets, and chat.
2. Store the **private** key PEM as the repository Actions secret
   `TRACEGLASS_RELEASE_SIGNING_KEY_PEM`.
3. Confirm the matching **public** key is embedded in
   `traceglass/installer/src/lib.rs` as `SIGNING_PUBLIC_KEY_B64`, with key id
   `SIGNING_KEY_ID` (`traceglass-ed25519-26deb421`, the first eight hex digits of
   the raw public key). The release workflow writes the same key id into the
   manifest.

The release workflow fails immediately in the `validate` job if the secret is
missing or does not look like a PEM private key. Never print or paste the secret
value into logs.

## Cut a prerelease (rc) tag

Cargo package version stays at `0.1.0` in `traceglass/Cargo.toml`. Tags may be
the exact version or a SemVer prerelease of it:

- `v0.1.0-rc.1` — dry-run / release-candidate (marked **prerelease** on GitHub)
- `v0.1.0` — eventual stable release (not prerelease)

```sh
git checkout main
git pull
git tag -a v0.1.0-rc.1 -m "TraceGlass v0.1.0-rc.1"
git push origin v0.1.0-rc.1
```

Pushing the tag runs `.github/workflows/release.yml`, which:

1. Checks the signing secret early
2. Validates fmt/clippy/tests (CLI + installer), including signature unit tests
3. Builds Linux x86_64, macOS Apple silicon, macOS Intel (`macos-15-intel`), and Windows
4. Signs artifacts with OpenSSL Ed25519 (`pkeyutl -rawin`)
5. Publishes a GitHub Release (prerelease when the tag contains `-`)

You can also start the workflow with **Actions → Release → Run workflow** and
supply the tag name (the tag must already exist or be creatable by the action’s
publish step as configured).

## Run the installer smoke test

After the release publishes successfully:

1. Open **Actions → Installer smoke → Run workflow**
2. Set `tag` to the published tag (for example `v0.1.0-rc.1`)
3. Confirm all four jobs are green:
   - `ubuntu-latest` → `x86_64-unknown-linux-gnu`
   - `macos-15-intel` → `x86_64-apple-darwin` (Intel)
   - `macos-latest` → `aarch64-apple-darwin` (Apple silicon)
   - `windows-latest` → `x86_64-pc-windows-msvc`

Each job downloads the published installer, verifies `SHA256SUMS` /
`traceglass-release.json` / installer `.sig` files with the embedded public key,
runs `traceglass-installer --tag <tag> --yes --no-path --no-launch`, then runs
`traceglass --version` and `--help`.

Intel smoke uses the same `macos-15-intel` hosted label as `release.yml`. Apple
silicon and Linux/Windows smoke remain on standard hosted runners.

## Install a specific rc locally

GitHub’s `latest` link skips prereleases. Download the target installer from the
release page, or pass `--tag`:

```sh
./traceglass-installer --tag v0.1.0-rc.1
```

## Owner checklist for the first rc

- [ ] `TRACEGLASS_RELEASE_SIGNING_KEY_PEM` set in repo secrets
- [ ] Public key / key id in `installer/src/lib.rs` match that keypair
- [ ] Tag `v0.1.0-rc.1` (or similar) pushed
- [ ] Release workflow green; assets include four installers, four payloads,
      `traceglass-release.json(.sig)`, and `SHA256SUMS(.sig)`
- [ ] Installer smoke workflow green on all four targets
- [ ] Docs still state that OS-level signing (Authenticode / notarization) is not
      configured
