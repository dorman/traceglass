//! In-memory scan API shared by the machine CLI and the WASM browser demo.
//!
//! Callers supply already-loaded text. There is no filesystem or network I/O
//! here — that is intentional for the client-side demo.

use anyhow::{Result, bail};

use crate::lenses::Selection;
use crate::records::{NormalizedRecord, normalize_with_lens};
use crate::signatures::Library;

/// One named text buffer to scan (typically a single log file's contents).
#[derive(Clone, Debug)]
pub struct ScanSource {
    pub name: String,
    pub content: String,
}

/// Soft per-source size cap for the WASM / demo path (50 MiB, same spirit as
/// the native ingest limit). Callers may enforce a lower UI limit.
pub const MAX_SOURCE_BYTES: usize = 50 * 1024 * 1024;

/// Scan one or more in-memory sources and return a `traceglass.findings.v1`
/// JSON document (same schema as `--findings`).
pub fn scan_to_findings_json(sources: &[ScanSource], lens_id: &str) -> Result<String> {
    let lens = resolve_lens(lens_id)?;
    let library = Library::builtin();
    let records = normalize_sources(sources, &library, &lens)?;
    serialize_findings_document(&records)
}

/// Scan a zip support bundle from raw bytes (browser File API / WASM path).
#[cfg(feature = "zip")]
pub fn scan_zip_bytes_to_findings_json(archive_bytes: &[u8], lens_id: &str) -> Result<String> {
    let sources = crate::zip_mem::sources_from_zip_bytes(archive_bytes)?;
    scan_to_findings_json(&sources, lens_id)
}

/// Scan a zip and return compact finding rows (for WASM UI).
#[cfg(feature = "zip")]
pub fn scan_zip_bytes_findings(archive_bytes: &[u8], lens_id: &str) -> Result<Vec<FindingView>> {
    let sources = crate::zip_mem::sources_from_zip_bytes(archive_bytes)?;
    scan_findings(&sources, lens_id)
}

/// Scan and return only the finding annotations (no full record dump).
pub fn scan_findings(sources: &[ScanSource], lens_id: &str) -> Result<Vec<FindingView>> {
    let lens = resolve_lens(lens_id)?;
    let library = Library::builtin();
    let records = normalize_sources(sources, &library, &lens)?;
    Ok(records
        .iter()
        .filter_map(FindingView::from_record)
        .collect())
}

fn resolve_lens(lens_id: &str) -> Result<Selection> {
    let id = if lens_id.trim().is_empty() {
        "general-triage"
    } else {
        lens_id
    };
    Selection::from_id(id)
}

fn normalize_sources(
    sources: &[ScanSource],
    library: &Library,
    lens: &Selection,
) -> Result<Vec<NormalizedRecord>> {
    if sources.is_empty() {
        bail!("no sources to scan");
    }
    let mut records = Vec::new();
    for source in sources {
        if source.content.len() > MAX_SOURCE_BYTES {
            bail!(
                "source '{}' exceeds {} byte limit",
                source.name,
                MAX_SOURCE_BYTES
            );
        }
        let input = normalize_with_lens(&source.name, None, &source.content, library, lens);
        records.extend(input.records);
    }
    Ok(records)
}

/// Compact finding row for UIs that do not want the full findings document.
#[derive(Clone, Debug, serde::Serialize)]
pub struct FindingView {
    pub source_file: String,
    pub line: usize,
    pub severity: String,
    pub signature_id: String,
    pub title: String,
    pub category: String,
    pub explanation: String,
    pub evidence: String,
    pub lens_id: String,
    pub lens_group: String,
    pub lens_priority: u32,
}

impl FindingView {
    fn from_record(record: &NormalizedRecord) -> Option<Self> {
        let finding = record.finding.as_ref()?;
        Some(Self {
            source_file: record.file.clone(),
            line: record.line,
            severity: record.severity.clone(),
            signature_id: finding.id.clone(),
            title: finding.title.clone(),
            category: finding.category.clone(),
            explanation: finding.explanation.clone(),
            evidence: finding.evidence.clone(),
            lens_id: finding.lens_id.clone(),
            lens_group: finding.group.clone(),
            lens_priority: finding.priority,
        })
    }
}

const FINDINGS_SCHEMA: &str = "traceglass.findings.v1";
const FINDINGS_KIND: &str = "observability_evidence";
const FINDINGS_DISCLAIMER: &str =
    "Evidence annotations only; not AI confidence and not a root-cause verdict.";

#[derive(Debug, serde::Serialize)]
struct FindingsDocument {
    schema: &'static str,
    kind: &'static str,
    disclaimer: &'static str,
    findings: Vec<FindingAnnotation>,
}

#[derive(Debug, serde::Serialize)]
struct FindingAnnotation {
    source_file: String,
    location: FindingLocation,
    #[serde(rename = "match")]
    match_data: FindingMatch,
    signal_type: String,
    severity: String,
    explanation: String,
    provenance: crate::signatures::SignatureProvenance,
    message: String,
    matched_evidence: String,
    lens: FindingLens,
}

#[derive(Debug, serde::Serialize)]
struct FindingLocation {
    line: usize,
}

#[derive(Debug, serde::Serialize)]
struct FindingMatch {
    signature_id: Option<String>,
    pattern: Option<String>,
}

#[derive(Debug, serde::Serialize)]
struct FindingLens {
    id: String,
    version: String,
    group: String,
    priority: u32,
}

fn serialize_findings_document(records: &[NormalizedRecord]) -> Result<String> {
    let document = FindingsDocument {
        schema: FINDINGS_SCHEMA,
        kind: FINDINGS_KIND,
        disclaimer: FINDINGS_DISCLAIMER,
        findings: records.iter().filter_map(finding_annotation).collect(),
    };
    let mut serialized = serde_json::to_string_pretty(&document)?;
    serialized.push('\n');
    Ok(serialized)
}

fn finding_annotation(record: &NormalizedRecord) -> Option<FindingAnnotation> {
    let finding = record.finding.as_ref()?;
    Some(FindingAnnotation {
        source_file: record.file.clone(),
        location: FindingLocation { line: record.line },
        match_data: FindingMatch {
            signature_id: (!finding.id.is_empty()).then(|| finding.id.clone()),
            pattern: (!finding.provenance.pattern.is_empty())
                .then(|| finding.provenance.pattern.to_string()),
        },
        signal_type: finding.category.clone(),
        severity: record.severity.clone(),
        explanation: finding.explanation.clone(),
        provenance: finding.provenance,
        message: record.message.clone(),
        matched_evidence: finding.evidence.clone(),
        lens: FindingLens {
            id: finding.lens_id.clone(),
            version: finding.lens_version.clone(),
            group: finding.group.clone(),
            priority: finding.priority,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scans_fatal_line_to_critical_finding() {
        let sources = [ScanSource {
            name: "api.log".into(),
            content: "FATAL unhandled exception in api worker\n".into(),
        }];
        let findings = scan_findings(&sources, "incident-reliability").unwrap();
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].signature_id, "fatal-error-crash");
        assert_eq!(findings[0].severity, "critical");
        assert_eq!(findings[0].lens_id, "incident-reliability");
    }

    #[test]
    fn findings_json_matches_schema_name() {
        let sources = [ScanSource {
            name: "api.log".into(),
            content: "FATAL boom\n".into(),
        }];
        let json = scan_to_findings_json(&sources, "general-triage").unwrap();
        assert!(json.contains("traceglass.findings.v1"));
        assert!(json.contains("fatal-error-crash"));
    }
}
