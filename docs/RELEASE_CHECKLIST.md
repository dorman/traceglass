# TraceGlass release checklist (v0.1.0-rc → v0.1.0)

Target launch window: **2026-11-15**. This checklist is docs-only guidance for
the owner. It does **not** cut tags, create releases, or merge PRs.

Related:

- [`../TRUST.md`](../TRUST.md) — plain-language privacy
- [`THREAT_MODEL.md`](THREAT_MODEL.md) — threats and mitigations
- [`../RELEASING.md`](../RELEASING.md) — signed-release operator runbook
  (secret setup, rc tag, installer smoke)

---

## Already on `main` (merged)

These landed and are the release baseline to use:

| PR | What it delivered |
| -- | ----------------- |
| **#50** | Dependabot / Actions SHA bumps + `clap` 4.6.7 |
| **#51** | Ed25519-signed manifests + `SHA256SUMS`, `release.yml` on `v*` tags building **4** targets, installer trust/`--tag`, rc/prerelease support, **Installer smoke** workflow, root [`RELEASING.md`](../RELEASING.md) |
| **#52** | Demo support bundle under `traceglass/samples/demo-bundle/` |
| **#53** | MIT license alignment — **Copyright (c) 2026 TraceGlass** |
| **#54** | Client-side WASM browser demo (`web-demo/`, `traceglass/wasm/`) |

Superseded Dependabot PRs (#37, #38, #39, #43, #44, #49) should be closed if
still open.

---

## Pipeline facts (from #51, now on `main`)

| Item | Detail |
| ---- | ------ |
| Trigger | Push tag `v*` or `workflow_dispatch` with tag (`.github/workflows/release.yml`) |
| Targets (4) | `x86_64-unknown-linux-gnu`, `aarch64-apple-darwin`, `x86_64-apple-darwin` (Intel on `macos-15-intel`), `x86_64-pc-windows-msvc` |
| Artifacts | Per-target installer + payload archive, `traceglass-release.json(.sig)`, `SHA256SUMS(.sig)`, per-artifact `.sig` |
| Signing | Ed25519 via OpenSSL `pkeyutl -sign … -rawin`; secret `TRACEGLASS_RELEASE_SIGNING_KEY_PEM` |
| Public trust anchor | `traceglass/installer/src/lib.rs` — key id `traceglass-ed25519-26deb421`, public key base64 `Jt60If+IJMDSQh3x8XN1ctHXwJJEOncGRy/EZGkU/DU=` |
| Prerelease | Tags containing `-` (e.g. `v0.1.0-rc.1`) publish as GitHub **prerelease**; Cargo version stays `0.1.0` |
| Installer | `--tag` for a specific release (GitHub `latest` skips prereleases) |
| Smoke | `.github/workflows/installer-smoke.yml` (`workflow_dispatch`) on all four hosted targets |
| OS signing | Disabled-by-default placeholders only; **not** Authenticode / notarization |

Full operator steps: [`RELEASING.md`](../RELEASING.md).

---

## Owner-only steps (cannot be done by agents)

- [ ] Generate Ed25519 keypair **offline**; never commit the private key
- [ ] Set GitHub Actions secret **`TRACEGLASS_RELEASE_SIGNING_KEY_PEM`** to the
      private PEM matching the public key embedded in
      `traceglass/installer/src/lib.rs`
- [ ] Confirm the validate job fails closed if the secret is missing / not PEM-shaped
- [ ] Decide tag name (`v0.1.0-rc.1` recommended for dry-run)
- [ ] Push annotated tag from updated `main` (owner cuts tags — agents must not)
- [ ] Run **Actions → Installer smoke** with that tag
- [ ] Optionally fix pre-existing **Vercel preview** failures on `main` (not a
      CLI release blocker; ignore Vercel when judging CI green)

---

## v0.1.0-rc dry-run (four targets)

After the signing secret is set:

1. Ensure Rust workflows on `main` are healthy (ignore Vercel).
2. Tag `v0.1.0-rc.1` (or similar) and push the tag → `release.yml` runs.
3. Confirm release assets include, for **each** of the four targets:
   - `traceglass-installer-<triple>[.exe]`
   - payload `.tar.gz` or `.zip`
   - matching `.sig` files
   - plus `traceglass-release.json`, `.sig`, `SHA256SUMS`, `SHA256SUMS.sig`
4. Run **Installer smoke** (`workflow_dispatch`) with `tag=v0.1.0-rc.1`.

| Target triple | Smoke runner | Check |
| ------------- | ------------ | ----- |
| `x86_64-unknown-linux-gnu` | `ubuntu-latest` | [ ] |
| `aarch64-apple-darwin` | `macos-latest` | [ ] |
| `x86_64-apple-darwin` | `macos-15-intel` | [ ] |
| `x86_64-pc-windows-msvc` | `windows-latest` | [ ] |

Per job expectations: download assets → verify `SHA256SUMS` / manifest /
installer `.sig` with embedded public key →
`traceglass-installer --tag <tag> --yes --no-path --no-launch` →
`traceglass --version` / `--help`.

Manual spot-check:

```sh
./traceglass-installer --tag v0.1.0-rc.1
# GitHub "latest" skips prereleases — use --tag or the release page.
```

---

## Windows signing status

| Item | Status |
| ---- | ------ |
| Ed25519 TraceGlass release signatures | On `main` (from #51); used by installer |
| **Microsoft Artifact Signing / Authenticode** | **Not started** |
| SmartScreen reputation | **Warnings expected** for new/unsigned (no Authenticode) binaries |
| macOS Developer ID + notarization | **Not started**; Gatekeeper prompts expected |

Do not advertise OS trust beyond Ed25519 publisher verification until those
credentials and pipeline steps exist. `release.yml` keeps disabled placeholders
for future OS signing.

---

## v0.1.0 readiness checklist

### Already true on `main`

- [x] #50 / #51 / #53 (and #52 / #54) merged
- [x] Signed release pipeline + installer smoke workflow present
- [x] Embedded key id `traceglass-ed25519-26deb421` in installer
- [x] Scanner local-only trust story documented ([`TRUST.md`](../TRUST.md))
- [x] Threat model drafted ([`THREAT_MODEL.md`](THREAT_MODEL.md))
- [x] Operator runbook ([`RELEASING.md`](../RELEASING.md))
- [x] License: MIT, Copyright (c) 2026 TraceGlass

### Blockers / remaining before 2026-11-15

- [ ] Add **`TRACEGLASS_RELEASE_SIGNING_KEY_PEM`**
- [ ] Successful **`v0.1.0-rc.*` dry-run** on all **four** targets (release + installer smoke)
- [ ] Fix any rc failures (Intel Mac runner availability, digest false-fails, OpenSSL signing, installer `--tag`)
- [ ] Cut **`v0.1.0`** (non-prerelease) only after rc smoke is green
- [ ] Update public install docs / site catalog only when artifacts are actually published
- [ ] Honest SmartScreen / Gatekeeper messaging (no Authenticode / notarization yet)
- [ ] (Optional) Tighten WASM demo hosting / CSP before advertising a public browser URL (`web-demo/POC_NOTES.md`)
- [ ] (Optional) Clear Vercel preview breakages (ignore Vercel for merge/CI decisions)

### Explicit non-goals for v0.1.0 unless scheduled

- Microsoft Artifact Signing / Authenticode  
- Apple notarization  
- crates.io publish (release workflow does not publish crates.io)

---

## Quick command crib (owner)

```sh
# after signing secret is set:
git checkout main && git pull
git tag -a v0.1.0-rc.1 -m "TraceGlass v0.1.0-rc.1"
git push origin v0.1.0-rc.1
# then: Actions → Installer smoke → Run workflow → tag v0.1.0-rc.1
```
