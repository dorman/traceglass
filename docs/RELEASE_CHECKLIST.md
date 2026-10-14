# TraceGlass release checklist (v0.1.0-rc → v0.1.0)

Target launch window: **2026-11-15**. This checklist is docs-only guidance for
the owner. It does **not** cut tags, create releases, or merge PRs.

Related: [`../TRUST.md`](../TRUST.md), [`THREAT_MODEL.md`](THREAT_MODEL.md).
PR #51 also adds root `RELEASING.md` with the operator runbook once merged.

---

## Merge order (owner)

Merge **in this order**, then add the signing secret:

1. **PR #50** — Dependabot / Actions SHA bumps + `clap` 4.6.7  
2. **PR #51** — Release pipeline (Ed25519-signed manifests + `SHA256SUMS`,
   `release.yml` on `v*` tags building **4** targets, installer trust,
   rc support, installer smoke workflow)  
3. **PR #53** — TraceGlass MIT / rename leftovers (license alignment)  
4. Owner adds repo secret **`TRACEGLASS_RELEASE_SIGNING_KEY_PEM`**

Do **not** merge superseded Dependabot PRs (#37, #38, #39, #43, #44, #49);
close them after #50 lands.

---

## Snapshot: #50 / #51 vs current `main` (as of this doc)

`main` has moved with marketing/TUI PRs **#55**, **#56**, and **#58** merged
(Signal TUI redesign, logo assets, sample.log demo alignment, plus Vercel
trigger commits).

| PR | Title | Mergeability vs current `main` | CI |
| -- | ----- | ------------------------------ | -- |
| **#50** `cursor/dependabot-bumps-clear-028b` | chore(deps): clear Dependabot bumps on current main | **Merges cleanly** (`git merge` dry-run: auto-merge OK; GitHub `mergeable=true`) | Rust **build** (ubuntu/macOS/Windows), **audit**, **workflows** (zizmor), **semgrep**: pass. **Vercel preview: fail** (pre-existing / out of scope). `mergeable_state=unstable` because of Vercel. |
| **#51** `cursor/release-pipeline-rc-1324` | Prepare TraceGlass v0.1.0-rc release pipeline and installer trust | **Merges cleanly** (auto-merge OK including `traceglass/AGENTS.md`; GitHub `mergeable=true`) | Same pattern: Rust matrix + audit + workflows + semgrep **pass**; **Vercel fail** (pre-existing). `mergeable_state=unstable`. |

Re-check before merging:

```sh
gh pr view 50 --json mergeable,mergeStateStatus,statusCheckRollup
gh pr view 51 --json mergeable,mergeStateStatus,statusCheckRollup
# or locally:
git fetch origin main cursor/dependabot-bumps-clear-028b cursor/release-pipeline-rc-1324
git merge-tree $(git merge-base origin/main origin/cursor/dependabot-bumps-clear-028b) \
  origin/main origin/cursor/dependabot-bumps-clear-028b
git merge-tree $(git merge-base origin/main origin/cursor/release-pipeline-rc-1324) \
  origin/main origin/cursor/release-pipeline-rc-1324
```

---

## What #50 verifies / changes

**Verified on the PR (author notes + CI):**

- Local: `cargo test --locked`, `clippy -D warnings`, `fmt --check`
- CI green for Rust build matrix, audit, zizmor workflows, semgrep

**Changes:**

- SHA-pin bumps in `.github/workflows/release.yml` and `rust.yml`:
  - `actions/download-artifact` 4.3.0 → 8.0.1
  - `actions/upload-artifact` 4.6.2 → 7.0.1
  - `softprops/action-gh-release` 2.6.2 → 3.0.2
  - `Swatinem/rust-cache` 2.9.1 → 2.9.2
- `clap` → **4.6.7** in `traceglass/Cargo.toml` + lockfile
- **No** signing semantics changes

**Residual risk:** first real tag / `workflow_dispatch` should confirm artifact
upload/download round-trip under action majors v7/v8 and publish with
`action-gh-release` v3.

---

## What #51 verifies / changes

**Verified on the PR:**

- CLI: `cargo test --locked` (~230), clippy clean
- Installer: `cargo test --manifest-path installer/Cargo.toml --locked` (incl.
  wrong-key / tamper reject); clippy clean
- OpenSSL `pkeyutl -rawin` sign ↔ installer-style verify
- CI: Rust builds on three OS images include installer signature tests; audit /
  workflows / semgrep green

**Pipeline behavior after merge:**

| Item | Detail |
| ---- | ------ |
| Trigger | Push tag `v*` or `workflow_dispatch` with tag |
| Targets (4) | `x86_64-unknown-linux-gnu`, `aarch64-apple-darwin`, `x86_64-apple-darwin` (build/smoke on `macos-13` in #51), `x86_64-pc-windows-msvc` |
| Artifacts | Per-target installer + payload archive, `traceglass-release.json(.sig)`, `SHA256SUMS(.sig)`, per-artifact `.sig` |
| Signing | Ed25519 via OpenSSL `pkeyutl -sign … -rawin`; secret `TRACEGLASS_RELEASE_SIGNING_KEY_PEM` |
| Public trust anchor | Embedded in `traceglass/installer/src/lib.rs` — key id `traceglass-ed25519-26deb421`, public key base64 `Jt60If+IJMDSQh3x8XN1ctHXwJJEOncGRy/EZGkU/DU=` (replaces placeholder key id on current `main`) |
| Prerelease | Tags containing `-` (e.g. `v0.1.0-rc.1`) publish as GitHub **prerelease**; Cargo version stays `0.1.0` |
| Installer | `--tag` for specific release (needed because GitHub `latest` skips prereleases); rename/trust copy aligned to TraceGlass |
| Smoke | New `Installer smoke` workflow (`workflow_dispatch`) on all four hosted targets |
| OS signing | Disabled-by-default placeholders only; **not** Authenticode / notarization |

---

## Owner-only steps (cannot be done by agents)

- [ ] Review and merge **#50**, then **#51**, then **#53**
- [ ] Generate Ed25519 keypair **offline**; never commit the private key
- [ ] Set GitHub Actions secret **`TRACEGLASS_RELEASE_SIGNING_KEY_PEM`** to the
      private PEM matching the public key embedded by #51
- [ ] Confirm secret gate fails closed if unset (validate job in #51)
- [ ] Decide tag name (`v0.1.0-rc.1` recommended for dry-run)
- [ ] Push annotated tag from updated `main` (owner cuts tags — agents must not)
- [ ] Run **Actions → Installer smoke** with that tag
- [ ] Optionally fix pre-existing **Vercel preview** failures on `main` (not a
      CLI release blocker, but keeps `mergeable_state` clean)

---

## v0.1.0-rc dry-run (four targets)

After #50+#51+#53 + signing secret:

1. Ensure `main` is green enough for Rust workflows.
2. Tag `v0.1.0-rc.1` (or similar) and push the tag → `release.yml` runs.
3. Confirm release assets include, for **each** of the four targets:
   - `traceglass-installer-<triple>[.exe]`
   - payload `.tar.gz` or `.zip`
   - matching `.sig` files
   - plus `traceglass-release.json`, `.sig`, `SHA256SUMS`, `SHA256SUMS.sig`
4. Run **Installer smoke** (`workflow_dispatch`) with `tag=v0.1.0-rc.1`.

| Target triple | Smoke runner (#51) | Check |
| ------------- | ------------------ | ----- |
| `x86_64-unknown-linux-gnu` | `ubuntu-latest` | [ ] |
| `aarch64-apple-darwin` | `macos-latest` | [ ] |
| `x86_64-apple-darwin` | `macos-13` | [ ] (if GitHub retires `macos-13`, need another Intel hosted label or self-hosted Intel Mac) |
| `x86_64-pc-windows-msvc` | `windows-latest` | [ ] |

Per job expectations: download assets → verify `SHA256SUMS` / manifest /
installer `.sig` with embedded public key →
`traceglass-installer --tag <tag> --yes --no-path --no-launch` →
`traceglass --version` / `--help`.

Manual spot-check on a laptop:

```sh
./traceglass-installer --tag v0.1.0-rc.1
# GitHub "latest" skips prereleases — use --tag or the release page.
```

---

## Windows signing status

| Item | Status |
| ---- | ------ |
| Ed25519 TraceGlass release signatures | Implemented in pipeline (#51); used by installer |
| **Microsoft Artifact Signing / Authenticode** | **Not started** |
| SmartScreen reputation | **Warnings expected** for new/unsigned (no Authenticode) binaries |
| macOS Developer ID + notarization | **Not started**; Gatekeeper prompts expected |

Do not advertise OS trust beyond Ed25519 publisher verification until those
credentials and pipeline steps exist. #51 leaves disabled placeholders in
`release.yml` for future OS signing.

---

## v0.1.0 readiness checklist

### Already true / verified on open PRs

- [x] Scanner local-only trust story documented ([`TRUST.md`](../TRUST.md))
- [x] Threat model drafted ([`THREAT_MODEL.md`](THREAT_MODEL.md))
- [x] #50 / #51 still merge cleanly against post-#55/#56/#58 `main` (re-verify at merge time)
- [x] Rust CI green on #50 and #51 (ignore known Vercel preview fail)

### Blockers / remaining before 2026-11-15

- [ ] Merge **#50 → #51 → #53**
- [ ] Add **`TRACEGLASS_RELEASE_SIGNING_KEY_PEM`**
- [ ] Successful **`v0.1.0-rc.*` dry-run** on all **four** targets (release + installer smoke)
- [ ] Fix any rc failures (Intel Mac runner availability, digest false-fails, OpenSSL signing, installer `--tag`)
- [ ] Cut **`v0.1.0`** (non-prerelease) only after rc smoke is green
- [ ] Update public install docs / site catalog only when artifacts are actually published
- [ ] Honest SmartScreen / Gatekeeper messaging (no Authenticode / notarization yet)
- [ ] (Optional but recommended) Decide WASM demo hosting + strict CSP before advertising a browser path (#54)
- [ ] (Optional) Clear Vercel preview breakages so PR merge status is not `unstable`

### Explicit non-goals for v0.1.0 unless scheduled

- Microsoft Artifact Signing / Authenticode  
- Apple notarization  
- crates.io publish (release workflow does not publish crates.io)

---

## Quick command crib (owner)

```sh
# after merges + secret:
git checkout main && git pull
git tag -a v0.1.0-rc.1 -m "TraceGlass v0.1.0-rc.1"
git push origin v0.1.0-rc.1
# then: Actions → Installer smoke → Run workflow → tag v0.1.0-rc.1
```
