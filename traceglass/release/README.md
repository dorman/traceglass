# Signed release contract

The release workflow publishes one `traceglass-release.json` manifest and a raw
Ed25519 detached signature, `traceglass-release.json.sig`, alongside each target
installer, its detached signature, and the CLI payload archive. The manifest
binds the tag, target triple, exact filenames, HTTPS GitHub Release URLs,
SHA-256 hashes, signature URLs, archive format, executable hash, and signing
key id.

The standalone installer embeds the public Ed25519 key for key id
`traceglass-ed25519-26deb421` (first eight hex digits of the raw public key).
It accepts only the canonical `dorman/traceglass` GitHub Release host and path
shape. It verifies the manifest, the target payload signature and hash, the
archive contents, and the extracted executable before writing a current-user
install. It never executes manifest text or a server-provided command.

Supported tags are `vMAJOR.MINOR.PATCH` and SemVer prereleases such as
`v0.1.0-rc.1`. Prerelease tags are published as GitHub prereleases. Pass
`traceglass-installer --tag v0.1.0-rc.1` to install a prerelease; GitHub’s
`latest` link does not point at prereleases.

The corresponding private key is an external GitHub Actions secret named
`TRACEGLASS_RELEASE_SIGNING_KEY_PEM`; it must never be committed. The workflow
fails in the early `validate` job if the secret is missing. See `/RELEASING.md`
for the cut-tag and smoke-test procedure.

**OS-level signing is not configured.** Windows Authenticode, macOS Developer
ID, and notarization are separate credentials and are intentionally not claimed
by the Ed25519 release signature. Release binaries are unsigned at the OS level
until those credentials are provisioned; the workflow contains disabled
placeholders only.

Changing the embedded public key or key id requires a new installer build. The
checked-in schema is a review aid. The workflow generates the concrete manifest
only after every target installer and payload has been built, hashed, signed,
and smoke-tested.
