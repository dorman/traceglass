# Signed release contract

The release workflow publishes one `traceglass-release.json` manifest and a raw
Ed25519 detached signature, `traceglass-release.json.sig`, alongside each target
installer, its detached signature, and the CLI payload archive. The manifest
binds the tag, target triple, exact filenames, HTTPS GitHub Release URLs,
SHA-256 hashes, signature URLs, archive format, executable hash, and signing
key id.

The standalone installer embeds the public Ed25519 key for
`traceglass-release-ed25519-2026`. It accepts only the canonical `dorman/traceglass`
GitHub Release host and path shape. It verifies the manifest, the target
payload signature and hash, the archive contents, and the extracted executable
before writing a current-user install. It never executes manifest text or a
server-provided command.

The corresponding private key is an external GitHub Actions secret named
`TRACEGLASS_RELEASE_SIGNING_KEY_PEM`; it must never be committed. The workflow
fails before publishing if the secret is missing. Windows Authenticode, macOS
Developer ID, and notarization are separate credentials and are intentionally
not implied by the Ed25519 release signature.

Before the first release, the release owner must generate an Ed25519 key pair,
store the PEM private key in that GitHub secret, and replace the embedded
installer public key with the matching raw 32-byte public key (base64 encoded).
The installer key id and public key are deliberately reviewable in
`installer/src/lib.rs`; changing either requires a new installer build. This
sandbox has no publisher account or private release key, so no beta artifact is
marked available here.

The checked-in schema is a review aid. The workflow generates the concrete
manifest only after every target installer and payload has been built, hashed,
signed, and smoke-tested.
