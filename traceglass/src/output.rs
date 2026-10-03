use std::io::{self, Write};
use std::path::Path;

use anyhow::{Context, Result};
use serde::Serialize;

use crate::cli::OutputFormat;
use crate::lenses::Selection;
use crate::records::{NormalizedRecord, normalize_with_lens, sanitize_text};
use crate::signatures::Library;

pub struct SourceText {
    pub name: String,
    pub path: Option<std::path::PathBuf>,
    pub content: String,
}

pub fn write_machine(
    sources: &[SourceText],
    format: OutputFormat,
    library: &Library,
    lens: &Selection,
    findings_path: Option<&Path>,
) -> Result<()> {
    let normalized: Vec<_> = sources
        .iter()
        .flat_map(|source| {
            let input = normalize_with_lens(
                &source.name,
                source.path.as_deref(),
                &source.content,
                library,
                lens,
            );
            if let Some(warning) = input.warning {
                eprintln!("traceglass: warning: {} ({})", warning, source.name);
            }
            input.records
        })
        .collect();

    if let Some(path) = findings_path {
        write_findings(path, &normalized)?;
    }

    let stdout = io::stdout();
    let mut handle = stdout.lock();
    match format {
        OutputFormat::Raw => {
            for source in sources {
                let text = sanitize_text(&source.content);
                handle.write_all(text.as_bytes())?;
                if !text.ends_with('\n') && !text.is_empty() {
                    handle.write_all(b"\n")?;
                }
            }
        }
        OutputFormat::Json => serde_json::to_writer_pretty(&mut handle, &normalized)?,
        OutputFormat::Csv => write_csv(&mut handle, &normalized)?,
    }
    if !matches!(format, OutputFormat::Raw) {
        handle.write_all(b"\n")?;
    }
    handle.flush()?;
    Ok(())
}

const FINDINGS_SCHEMA: &str = "traceglass.findings.v1";
const FINDINGS_KIND: &str = "observability_evidence";
const FINDINGS_DISCLAIMER: &str =
    "Evidence annotations only; not AI confidence and not a root-cause verdict.";

#[derive(Debug, Serialize)]
struct FindingsDocument {
    schema: &'static str,
    kind: &'static str,
    disclaimer: &'static str,
    findings: Vec<FindingAnnotation>,
}

#[derive(Debug, Serialize)]
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

#[derive(Debug, Serialize)]
struct FindingLocation {
    line: usize,
}

#[derive(Debug, Serialize)]
struct FindingMatch {
    signature_id: Option<String>,
    pattern: Option<String>,
}

#[derive(Debug, Serialize)]
struct FindingLens {
    id: String,
    version: String,
    group: String,
    priority: u32,
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

fn serialize_findings(records: &[NormalizedRecord]) -> Result<String> {
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

fn write_findings(path: &Path, records: &[NormalizedRecord]) -> Result<()> {
    let document = serialize_findings(records)?;
    std::fs::write(path, document)
        .with_context(|| format!("failed to write findings document to {}", path.display()))?;
    Ok(())
}

fn write_csv<W: Write>(writer: W, records: &[NormalizedRecord]) -> Result<()> {
    let mut csv = csv::Writer::from_writer(writer);
    csv.write_record([
        "file",
        "line",
        "severity",
        "message",
        "evidence",
        "raw",
        "signature_id",
        "source",
        "catalog",
        "version",
        "set",
        "pattern",
        "severity_rationale",
        "explanation",
        "false_positive_note",
        "matched_evidence",
        "lens_id",
        "lens_version",
        "lens_group",
        "lens_priority",
    ])?;
    for record in records {
        let finding = record.finding.as_ref();
        let priority = finding
            .map(|value| value.priority.to_string())
            .unwrap_or_default();
        csv.write_record([
            record.file.as_str(),
            &record.line.to_string(),
            record.severity.as_str(),
            record.message.as_str(),
            finding.map(|value| value.title.as_str()).unwrap_or(""),
            record.raw.as_str(),
            finding.map(|value| value.id.as_str()).unwrap_or(""),
            finding.map(|value| value.source.as_str()).unwrap_or(""),
            finding.map(|value| value.provenance.catalog).unwrap_or(""),
            finding.map(|value| value.provenance.version).unwrap_or(""),
            finding.map(|value| value.provenance.set).unwrap_or(""),
            finding.map(|value| value.provenance.pattern).unwrap_or(""),
            finding
                .map(|value| value.severity_rationale.as_str())
                .unwrap_or(""),
            finding
                .map(|value| value.explanation.as_str())
                .unwrap_or(""),
            finding
                .map(|value| value.false_positive_note.as_str())
                .unwrap_or(""),
            finding.map(|value| value.evidence.as_str()).unwrap_or(""),
            finding.map(|value| value.lens_id.as_str()).unwrap_or(""),
            finding
                .map(|value| value.lens_version.as_str())
                .unwrap_or(""),
            finding.map(|value| value.group.as_str()).unwrap_or(""),
            priority.as_str(),
        ])?;
    }
    csv.flush()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::records::normalize;
    use serde_json::Value;

    #[test]
    fn csv_has_stable_columns_and_escaped_values() {
        let source = SourceText {
            name: "sample.log".to_string(),
            path: None,
            content: "message\nERROR, connection refused\n".to_string(),
        };
        let input = normalize(&source.name, None, &source.content, &Library::builtin());
        let mut bytes = Vec::new();
        write_csv(&mut bytes, &input.records).unwrap();
        let text = String::from_utf8(bytes).unwrap();
        assert!(text.starts_with(
            "file,line,severity,message,evidence,raw,signature_id,source,catalog,version,set,pattern,severity_rationale,explanation,false_positive_note,matched_evidence,lens_id,lens_version,lens_group,lens_priority\n"
        ));
        assert!(text.contains("\"ERROR, connection refused\""));
    }

    #[test]
    fn findings_document_projects_a_populated_record() {
        let source = SourceText {
            name: "sample.log".to_string(),
            path: None,
            content: "FATAL unhandled exception in scan engine\n".to_string(),
        };
        let input = normalize(&source.name, None, &source.content, &Library::builtin());
        let document: Value = serde_json::from_str(&serialize_findings(&input.records).unwrap())
            .expect("valid findings JSON");

        assert_eq!(document["schema"], FINDINGS_SCHEMA);
        assert_eq!(document["kind"], FINDINGS_KIND);
        assert_eq!(document["disclaimer"], FINDINGS_DISCLAIMER);
        assert_eq!(document["findings"][0]["source_file"], "sample.log");
        assert_eq!(document["findings"][0]["location"]["line"], 1);
        assert_eq!(
            document["findings"][0]["match"]["signature_id"],
            "fatal-error-crash"
        );
        assert_eq!(
            document["findings"][0]["match"]["pattern"],
            "fatal-error-crash"
        );
        assert_eq!(document["findings"][0]["signal_type"], "crash");
        assert_eq!(document["findings"][0]["severity"], "critical");
        assert_eq!(
            document["findings"][0]["message"],
            "FATAL unhandled exception in scan engine"
        );
        assert_eq!(
            document["findings"][0]["matched_evidence"],
            "FATAL unhandled exception in scan engine"
        );
    }

    #[test]
    fn findings_document_serializes_empty_results() {
        let document: Value =
            serde_json::from_str(&serialize_findings(&[]).unwrap()).expect("valid findings JSON");
        assert_eq!(document["findings"], serde_json::json!([]));
        assert!(serialize_findings(&[]).unwrap().ends_with("\n"));
    }

    #[test]
    fn findings_document_preserves_builtin_provenance_and_lens() {
        let input = normalize(
            "sample.log",
            None,
            "FATAL unhandled exception in scan engine\n",
            &Library::builtin(),
        );
        let document: Value = serde_json::from_str(&serialize_findings(&input.records).unwrap())
            .expect("valid findings JSON");
        let finding = &document["findings"][0];
        assert_eq!(finding["provenance"]["source"], "builtin");
        assert_eq!(finding["provenance"]["catalog"], "traceglass-rust-builtins");
        assert_eq!(finding["provenance"]["version"], "builtin-v1");
        assert_eq!(finding["provenance"]["set"], "core");
        assert_eq!(finding["provenance"]["pattern"], "fatal-error-crash");
        assert_eq!(finding["lens"]["id"], "general-triage");
        assert_eq!(finding["lens"]["version"], "v0.1.0");
        assert!(finding["lens"]["group"].as_str().is_some());
        assert!(finding["lens"]["priority"].as_u64().is_some());
    }
}
