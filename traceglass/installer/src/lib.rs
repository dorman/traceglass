//! @polsia:user-owned — trust policy and safe archive handling for the installer.

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use flate2::read::GzDecoder;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::io::{Cursor, Read};
use std::path::{Component, Path, PathBuf};
use tar::Archive;
use thiserror::Error;
use zip::ZipArchive;

pub const REPOSITORY: &str = "dorman/traceglass";
pub const MANIFEST_URL: &str =
    "https://github.com/dorman/traceglass/releases/latest/download/traceglass-release.json";
pub const MANIFEST_SIGNATURE_URL: &str =
    "https://github.com/dorman/traceglass/releases/latest/download/traceglass-release.json.sig";
pub const SIGNATURE_SCHEME: &str = "Ed25519";
/// Short fingerprint of the embedded release public key (first 8 hex chars).
/// Must match `signingKeyId` written by `.github/workflows/release.yml`.
pub const SIGNING_KEY_ID: &str = "traceglass-ed25519-26deb421";
/// Raw 32-byte Ed25519 public key (base64). Private key is only in the
/// `TRACEGLASS_RELEASE_SIGNING_KEY_PEM` GitHub Actions secret.
pub const SIGNING_PUBLIC_KEY_B64: &str = "Jt60If+IJMDSQh3x8XN1ctHXwJJEOncGRy/EZGkU/DU=";
const SUPPORTED_TARGETS: [&str; 4] = [
    "x86_64-unknown-linux-gnu",
    "aarch64-apple-darwin",
    "x86_64-apple-darwin",
    "x86_64-pc-windows-msvc",
];

#[derive(Debug, Error)]
pub enum InstallerError {
    #[error("invalid release manifest: {0}")]
    InvalidManifest(String),
    #[error("release signature verification failed")]
    InvalidSignature,
    #[error("release URL is outside the canonical GitHub path: {0}")]
    UnexpectedUrl(String),
    #[error("unsupported target: {0}")]
    UnsupportedTarget(String),
    #[error("archive contains an unsafe or unexpected member: {0}")]
    UnsafeArchiveMember(String),
    #[error("archive does not contain the expected executable")]
    MissingExecutable,
    #[error("archive contains more than one executable")]
    MultipleExecutables,
    #[error("SHA-256 mismatch: expected {expected}, got {actual}")]
    HashMismatch { expected: String, actual: String },
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("archive error: {0}")]
    Archive(String),
    #[error("encoding error: {0}")]
    Encoding(String),
}

#[derive(Debug, Deserialize)]
pub struct ReleaseManifest {
    pub schema: String,
    pub repository: String,
    pub version: String,
    pub targets: Vec<ReleaseTarget>,
}

#[derive(Debug, Deserialize)]
pub struct ReleaseTarget {
    pub target: String,
    pub installer: Artifact,
    pub payload: PayloadArtifact,
}

#[derive(Debug, Deserialize)]
pub struct Artifact {
    pub filename: String,
    pub url: String,
    pub sha256: String,
    #[serde(rename = "signatureUrl")]
    pub signature_url: String,
    #[serde(rename = "signatureScheme")]
    pub signature_scheme: String,
    #[serde(rename = "signingKeyId")]
    pub signing_key_id: String,
}

#[derive(Debug, Deserialize)]
pub struct PayloadArtifact {
    #[serde(flatten)]
    pub artifact: Artifact,
    #[serde(rename = "archiveFormat")]
    pub archive_format: String,
    #[serde(rename = "executableSha256")]
    pub executable_sha256: String,
}

pub fn public_key() -> Result<VerifyingKey, InstallerError> {
    let decoded = BASE64
        .decode(SIGNING_PUBLIC_KEY_B64)
        .map_err(|error| InstallerError::Encoding(error.to_string()))?;
    let bytes: [u8; 32] = decoded
        .try_into()
        .map_err(|_| InstallerError::Encoding("public key must be 32 bytes".to_string()))?;
    VerifyingKey::from_bytes(&bytes)
        .map_err(|error| InstallerError::Encoding(format!("invalid public key: {error}")))
}

pub fn verify_signature(
    content: &[u8],
    signature_bytes: &[u8],
    key: &VerifyingKey,
) -> Result<(), InstallerError> {
    let signature =
        Signature::from_slice(signature_bytes).map_err(|_| InstallerError::InvalidSignature)?;
    key.verify(content, &signature)
        .map_err(|_| InstallerError::InvalidSignature)
}

pub fn sha256_hex(content: &[u8]) -> String {
    let digest = Sha256::digest(content);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn verify_hash(content: &[u8], expected: &str) -> Result<(), InstallerError> {
    let actual = sha256_hex(content);
    if actual != expected {
        return Err(InstallerError::HashMismatch {
            expected: expected.to_string(),
            actual,
        });
    }
    Ok(())
}

pub fn validate_manifest(content: &[u8]) -> Result<ReleaseManifest, InstallerError> {
    let manifest: ReleaseManifest = serde_json::from_slice(content)
        .map_err(|error| InstallerError::InvalidManifest(error.to_string()))?;
    if manifest.schema != "traceglass-release/v1" || manifest.repository != REPOSITORY {
        return Err(InstallerError::InvalidManifest(
            "schema or repository does not match the pinned product".to_string(),
        ));
    }
    if !is_valid_release_tag(&manifest.version) {
        return Err(InstallerError::InvalidManifest(
            "version must be a release tag like v0.1.0 or v0.1.0-rc.1".to_string(),
        ));
    }
    if manifest.targets.is_empty() {
        return Err(InstallerError::InvalidManifest(
            "no release targets".to_string(),
        ));
    }
    for target in &manifest.targets {
        if !SUPPORTED_TARGETS.contains(&target.target.as_str()) {
            return Err(InstallerError::UnsupportedTarget(target.target.clone()));
        }
        validate_artifact(&target.installer, &manifest.version)?;
        validate_artifact(&target.payload.artifact, &manifest.version)?;
        if target.installer.signature_scheme != SIGNATURE_SCHEME
            || target.payload.artifact.signature_scheme != SIGNATURE_SCHEME
            || target.installer.signing_key_id != SIGNING_KEY_ID
            || target.payload.artifact.signing_key_id != SIGNING_KEY_ID
        {
            return Err(InstallerError::InvalidManifest(
                "artifact signing metadata does not match the embedded trust policy".to_string(),
            ));
        }
        if target.payload.archive_format != "tar.gz" && target.payload.archive_format != "zip" {
            return Err(InstallerError::InvalidManifest(
                "payload archive format is not supported".to_string(),
            ));
        }
        let expected_archive = if target.target.contains("windows") {
            format!("traceglass-{}.zip", target.target)
        } else {
            format!("traceglass-{}.tar.gz", target.target)
        };
        let expected_installer = if target.target.contains("windows") {
            format!("traceglass-installer-{}.exe", target.target)
        } else {
            format!("traceglass-installer-{}", target.target)
        };
        if target.payload.artifact.filename != expected_archive
            || target.installer.filename != expected_installer
        {
            return Err(InstallerError::InvalidManifest(
                "artifact filename does not match the target contract".to_string(),
            ));
        }
        for hash in [
            &target.installer.sha256,
            &target.payload.artifact.sha256,
            &target.payload.executable_sha256,
        ] {
            if hash.len() != 64
                || !hash
                    .bytes()
                    .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
            {
                return Err(InstallerError::InvalidManifest(
                    "artifact hashes must be lowercase SHA-256 values".to_string(),
                ));
            }
        }
    }
    Ok(manifest)
}

fn validate_artifact(artifact: &Artifact, version: &str) -> Result<(), InstallerError> {
    let prefix = format!("https://github.com/{REPOSITORY}/releases/download/{version}/");
    if artifact.url != format!("{prefix}{}", artifact.filename)
        || artifact.signature_url != format!("{prefix}{}.sig", artifact.filename)
    {
        return Err(InstallerError::UnexpectedUrl(artifact.url.clone()));
    }
    Ok(())
}

/// Accept `vMAJOR.MINOR.PATCH` and optional SemVer prerelease (`v0.1.0-rc.1`).
pub fn is_valid_release_tag(version: &str) -> bool {
    let Some(rest) = version.strip_prefix('v') else {
        return false;
    };
    let (core, prerelease) = match rest.split_once('-') {
        Some((core, pre)) => (core, Some(pre)),
        None => (rest, None),
    };
    let parts: Vec<&str> = core.split('.').collect();
    if parts.len() != 3
        || !parts
            .iter()
            .all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()))
    {
        return false;
    }
    match prerelease {
        None => true,
        Some("") => false,
        Some(pre) => pre.split('.').all(|id| {
            !id.is_empty()
                && id
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        }),
    }
}

/// Build canonical manifest and signature URLs for `latest` or a specific tag.
pub fn manifest_urls_for_tag(tag: Option<&str>) -> (String, String) {
    match tag {
        Some(tag) => {
            let base = format!("https://github.com/{REPOSITORY}/releases/download/{tag}");
            (
                format!("{base}/traceglass-release.json"),
                format!("{base}/traceglass-release.json.sig"),
            )
        }
        None => (MANIFEST_URL.to_string(), MANIFEST_SIGNATURE_URL.to_string()),
    }
}

pub fn expected_target() -> &'static str {
    if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        "x86_64-unknown-linux-gnu"
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        "aarch64-apple-darwin"
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        "x86_64-apple-darwin"
    } else if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        "x86_64-pc-windows-msvc"
    } else {
        "unsupported"
    }
}

pub fn find_target<'a>(
    manifest: &'a ReleaseManifest,
    target: &str,
) -> Result<&'a ReleaseTarget, InstallerError> {
    manifest
        .targets
        .iter()
        .find(|candidate| candidate.target == target)
        .ok_or_else(|| InstallerError::UnsupportedTarget(target.to_string()))
}

pub fn read_file(path: &Path) -> Result<Vec<u8>, InstallerError> {
    let mut file = std::fs::File::open(path)?;
    let mut content = Vec::new();
    file.read_to_end(&mut content)?;
    Ok(content)
}

pub fn extract_payload(
    content: &[u8],
    archive_format: &str,
    target: &str,
    destination: &Path,
) -> Result<PathBuf, InstallerError> {
    std::fs::create_dir_all(destination)?;
    let expected = if target.contains("windows") {
        "traceglass.exe"
    } else {
        "traceglass"
    };
    let mut executable: Option<PathBuf> = None;
    match archive_format {
        "tar.gz" => {
            let decoder = GzDecoder::new(Cursor::new(content));
            let mut archive = Archive::new(decoder);
            for item in archive
                .entries()
                .map_err(|error| InstallerError::Archive(error.to_string()))?
            {
                let mut entry = item.map_err(|error| InstallerError::Archive(error.to_string()))?;
                let path = entry
                    .path()
                    .map_err(|error| InstallerError::Archive(error.to_string()))?
                    .into_owned();
                validate_member(&path, target, expected)?;
                if entry.header().entry_type().is_symlink()
                    || entry.header().entry_type().is_hard_link()
                {
                    return Err(InstallerError::UnsafeArchiveMember(
                        path.display().to_string(),
                    ));
                }
                let output = destination.join(&path);
                entry
                    .unpack(&output)
                    .map_err(|error| InstallerError::Archive(error.to_string()))?;
                if path.file_name().and_then(|name| name.to_str()) == Some(expected) {
                    if executable.is_some() {
                        return Err(InstallerError::MultipleExecutables);
                    }
                    executable = Some(output);
                }
            }
        }
        "zip" => {
            let mut archive = ZipArchive::new(Cursor::new(content))
                .map_err(|error| InstallerError::Archive(error.to_string()))?;
            for index in 0..archive.len() {
                let mut entry = archive
                    .by_index(index)
                    .map_err(|error| InstallerError::Archive(error.to_string()))?;
                let path = PathBuf::from(entry.name().replace('\\', "/"));
                validate_member(&path, target, expected)?;
                if entry
                    .unix_mode()
                    .is_some_and(|mode| mode & 0o170000 == 0o120000)
                {
                    return Err(InstallerError::UnsafeArchiveMember(
                        path.display().to_string(),
                    ));
                }
                if entry.is_dir() {
                    std::fs::create_dir_all(destination.join(&path))?;
                    continue;
                }
                let output = destination.join(&path);
                if let Some(parent) = output.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                let mut file = std::fs::File::create(&output)?;
                std::io::copy(&mut entry, &mut file)?;
                if path.file_name().and_then(|name| name.to_str()) == Some(expected) {
                    if executable.is_some() {
                        return Err(InstallerError::MultipleExecutables);
                    }
                    executable = Some(output);
                }
            }
        }
        other => {
            return Err(InstallerError::Archive(format!(
                "unsupported archive format {other}"
            )));
        }
    }
    executable.ok_or(InstallerError::MissingExecutable)
}

fn validate_member(path: &Path, target: &str, expected: &str) -> Result<(), InstallerError> {
    let mut components = path.components();
    let stage = format!("traceglass-{target}");
    if path == Path::new(&stage) {
        return Ok(());
    }
    let valid = matches!(components.next(), Some(Component::Normal(value)) if value.to_string_lossy() == stage)
        && matches!(components.next(), Some(Component::Normal(value)) if value.to_string_lossy() == expected || value.to_string_lossy() == "README.md" || value.to_string_lossy() == "LICENSE")
        && components.next().is_none();
    if !valid {
        return Err(InstallerError::UnsafeArchiveMember(
            path.display().to_string(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    #[test]
    fn accepts_only_the_canonical_artifact_path() {
        let artifact = Artifact {
            filename: "traceglass-installer-x86_64-unknown-linux-gnu".to_string(),
            url: "https://github.com/dorman/traceglass/releases/download/v9.9.9/traceglass-installer-x86_64-unknown-linux-gnu".to_string(),
            sha256: "a".repeat(64),
            signature_url: "https://github.com/dorman/traceglass/releases/download/v9.9.9/traceglass-installer-x86_64-unknown-linux-gnu.sig".to_string(),
            signature_scheme: "Ed25519".to_string(),
            signing_key_id: SIGNING_KEY_ID.to_string(),
        };
        validate_artifact(&artifact, "v9.9.9").expect("canonical URL should pass");
        let mut altered = artifact;
        altered.url = "https://example.test/payload".to_string();
        assert!(validate_artifact(&altered, "v9.9.9").is_err());
    }

    #[test]
    fn verifies_detached_ed25519_signatures() {
        let signing_key = SigningKey::from_bytes(&[7; 32]);
        let content = br#"{"schema":"traceglass-release/v1"}"#;
        let signature = signing_key.sign(content);
        let verifying_key = signing_key.verifying_key();
        verify_signature(content, &signature.to_bytes(), &verifying_key).expect("valid signature");
        assert!(verify_signature(b"tampered", &signature.to_bytes(), &verifying_key).is_err());
    }

    #[test]
    fn throwaway_signed_manifest_verifies_and_wrong_key_is_rejected() {
        let signing_key = SigningKey::from_bytes(&[9; 32]);
        let wrong_key = SigningKey::from_bytes(&[11; 32]).verifying_key();
        let manifest = sample_manifest_json("v0.1.0-rc.1");
        let signature = signing_key.sign(manifest.as_bytes());
        let verifying_key = signing_key.verifying_key();

        verify_signature(manifest.as_bytes(), &signature.to_bytes(), &verifying_key)
            .expect("throwaway-signed manifest must verify");
        validate_manifest(manifest.as_bytes()).expect("rc tag manifest must parse");

        assert!(
            matches!(
                verify_signature(manifest.as_bytes(), &signature.to_bytes(), &wrong_key),
                Err(InstallerError::InvalidSignature)
            ),
            "a different Ed25519 public key must reject the signature"
        );
        assert!(
            matches!(
                verify_signature(b"tampered-manifest", &signature.to_bytes(), &verifying_key),
                Err(InstallerError::InvalidSignature)
            ),
            "tampered bytes must reject the signature"
        );
    }

    #[test]
    fn accepts_prerelease_tags_and_rejects_malformed_versions() {
        assert!(is_valid_release_tag("v0.1.0"));
        assert!(is_valid_release_tag("v0.1.0-rc.1"));
        assert!(is_valid_release_tag("v1.2.3-beta.2"));
        assert!(!is_valid_release_tag("0.1.0"));
        assert!(!is_valid_release_tag("v0.1"));
        assert!(!is_valid_release_tag("v0.1.0-"));
        assert!(!is_valid_release_tag("v0.1.0-rc_1"));
        validate_manifest(sample_manifest_json("v0.1.0-rc.1").as_bytes())
            .expect("prerelease manifest should validate");
    }

    #[test]
    fn embedded_public_key_decodes_to_expected_fingerprint() {
        let key = public_key().expect("embedded public key must decode");
        let fingerprint: String = key
            .as_bytes()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        assert_eq!(&fingerprint[..8], "26deb421");
        assert_eq!(
            fingerprint,
            "26deb421ff8824c0d2421df1f1737572d1d7c092443a7706472fc4646914fc35"
        );
        assert_eq!(SIGNING_KEY_ID, "traceglass-ed25519-26deb421");
        assert_eq!(
            SIGNING_PUBLIC_KEY_B64,
            "Jt60If+IJMDSQh3x8XN1ctHXwJJEOncGRy/EZGkU/DU="
        );
    }

    #[test]
    fn rejects_traversal_members_before_install() {
        let error = validate_member(
            Path::new("traceglass-x86_64-unknown-linux-gnu/../../traceglass"),
            "x86_64-unknown-linux-gnu",
            "traceglass",
        );
        assert!(matches!(error, Err(InstallerError::UnsafeArchiveMember(_))));
    }

    #[test]
    fn rejects_an_unexpected_archive_member() {
        use flate2::{Compression, write::GzEncoder};
        use tar::{Builder, Header};

        let encoder = GzEncoder::new(Vec::new(), Compression::default());
        let mut builder = Builder::new(encoder);
        let mut header = Header::new_gnu();
        header.set_size(1);
        header.set_mode(0o644);
        header.set_cksum();
        builder
            .append_data(
                &mut header,
                "traceglass-x86_64-unknown-linux-gnu/evil",
                &b"x"[..],
            )
            .expect("fixture archive");
        let encoder = builder.into_inner().expect("tar encoder");
        let archive = encoder.finish().expect("gzip archive");
        let destination = tempfile::tempdir().expect("temporary extraction directory");
        let result = extract_payload(
            &archive,
            "tar.gz",
            "x86_64-unknown-linux-gnu",
            destination.path(),
        );
        assert!(matches!(
            result,
            Err(InstallerError::UnsafeArchiveMember(_))
        ));
        assert!(
            !destination
                .path()
                .join("traceglass-x86_64-unknown-linux-gnu/evil")
                .exists()
        );
    }

    #[test]
    fn rejects_malformed_manifest_before_download_selection() {
        let error = validate_manifest(br#"{"schema":"not-traceglass"}"#);
        assert!(matches!(error, Err(InstallerError::InvalidManifest(_))));
    }

    fn sample_manifest_json(version: &str) -> String {
        let target = "x86_64-unknown-linux-gnu";
        let prefix = format!("https://github.com/{REPOSITORY}/releases/download/{version}");
        let installer = format!("traceglass-installer-{target}");
        let payload = format!("traceglass-{target}.tar.gz");
        let hash = "a".repeat(64);
        format!(
            r#"{{
  "schema": "traceglass-release/v1",
  "repository": "{REPOSITORY}",
  "version": "{version}",
  "targets": [{{
    "target": "{target}",
    "installer": {{
      "filename": "{installer}",
      "url": "{prefix}/{installer}",
      "sha256": "{hash}",
      "signatureUrl": "{prefix}/{installer}.sig",
      "signatureScheme": "Ed25519",
      "signingKeyId": "{SIGNING_KEY_ID}"
    }},
    "payload": {{
      "filename": "{payload}",
      "url": "{prefix}/{payload}",
      "sha256": "{hash}",
      "signatureUrl": "{prefix}/{payload}.sig",
      "signatureScheme": "Ed25519",
      "signingKeyId": "{SIGNING_KEY_ID}",
      "archiveFormat": "tar.gz",
      "executableSha256": "{hash}"
    }}
  }}]
}}"#
        )
    }
}
