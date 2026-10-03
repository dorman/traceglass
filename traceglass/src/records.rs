use std::path::Path;

use serde::Serialize;
use serde_json::Value;

use crate::lenses::Selection;
use crate::signatures::{Library, Severity, SignatureProvenance};

/// Input classes recognized by the CLI. Structured parsing is an enrichment
/// step: a failed parser never prevents line-level scanning.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum InputFormat {
    PlainText,
    Json,
    Ndjson,
    Csv,
}

impl InputFormat {
    pub fn label(self) -> &'static str {
        match self {
            Self::PlainText => "plain text",
            Self::Json => "JSON",
            Self::Ndjson => "NDJSON",
            Self::Csv => "CSV",
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct FindingEvidence {
    pub id: String,
    pub source: String,
    pub provenance: SignatureProvenance,
    pub category: String,
    pub title: String,
    pub explanation: String,
    pub severity_rationale: String,
    pub false_positive_note: String,
    pub evidence: String,
    pub lens_id: String,
    pub lens_version: String,
    pub group: String,
    pub priority: u32,
}

/// Stable machine-readable row. `raw` is always the sanitized source line;
/// `message` is enriched from structured fields when one is available.
#[derive(Clone, Debug, Serialize)]
pub struct NormalizedRecord {
    pub file: String,
    pub line: usize,
    pub raw: String,
    pub message: String,
    pub severity: String,
    pub finding: Option<FindingEvidence>,
}

#[derive(Clone, Debug)]
pub struct NormalizedInput {
    pub format: InputFormat,
    pub records: Vec<NormalizedRecord>,
    pub warning: Option<String>,
}

/// Strip ANSI escape sequences and other control characters from a line before
/// it reaches a terminal or machine serializer. Tabs remain useful spacing.
pub fn sanitize_text(input: &str) -> String {
    let chars: Vec<char> = input.chars().collect();
    let mut out = String::with_capacity(input.len());
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c == '\u{1b}' {
            i += 1;
            if chars.get(i) == Some(&'[') {
                i += 1;
                while let Some(next) = chars.get(i).copied() {
                    i += 1;
                    if next.is_ascii() && ('@'..='~').contains(&next) {
                        break;
                    }
                }
            } else if chars.get(i) == Some(&']') {
                i += 1;
                while i < chars.len() {
                    let next = chars[i];
                    i += 1;
                    if next == '\u{7}' {
                        break;
                    }
                    if next == '\u{1b}' && chars.get(i) == Some(&'\\') {
                        i += 1;
                        break;
                    }
                }
            }
            continue;
        }
        if c == '\n' || c == '\r' || c == '\t' || !c.is_control() {
            out.push(c);
        }
        i += 1;
    }
    out
}

pub fn detect_format(path: Option<&Path>, content: &str) -> InputFormat {
    if let Some(ext) = path.and_then(|p| p.extension()).and_then(|e| e.to_str()) {
        match ext.to_ascii_lowercase().as_str() {
            "json" => return InputFormat::Json,
            "ndjson" | "jsonl" => return InputFormat::Ndjson,
            "csv" | "csb" => return InputFormat::Csv,
            _ => {}
        }
    }

    let non_empty: Vec<&str> = content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .collect();
    if non_empty.is_empty() {
        return InputFormat::PlainText;
    }
    if non_empty[0].trim_start().starts_with('{') || non_empty[0].trim_start().starts_with('[') {
        if non_empty.len() > 1
            && non_empty
                .iter()
                .all(|line| serde_json::from_str::<Value>(line.trim()).is_ok())
        {
            return InputFormat::Ndjson;
        }
        return InputFormat::Json;
    }
    if non_empty.len() > 1 && non_empty[0].contains(',') && non_empty[1].contains(',') {
        return InputFormat::Csv;
    }
    InputFormat::PlainText
}

fn severity_label(severity: Severity) -> String {
    match severity {
        Severity::Critical => "critical",
        Severity::High => "high",
        Severity::Medium => "medium",
        Severity::Low => "low",
        Severity::Info => "info",
    }
    .to_string()
}

fn finding_for(
    line: &str,
    library: &Library,
    lens: &Selection,
) -> (String, Option<FindingEvidence>) {
    let mut strongest: Option<(Severity, usize)> = None;
    for index in library.matches(line) {
        let severity = library[index].severity;
        if strongest.is_none_or(|(current, _)| severity > current) {
            strongest = Some((severity, index));
        }
    }
    let Some((severity, index)) = strongest else {
        return ("info".to_string(), None);
    };
    let signature = &library[index];
    let placement = lens.placement("rust_builtin", signature.id);
    (
        severity_label(severity),
        Some(FindingEvidence {
            id: signature.id.to_string(),
            source: signature.provenance.source.to_string(),
            provenance: signature.provenance,
            category: signature.category.to_string(),
            title: signature.title.to_string(),
            explanation: signature.explain.to_string(),
            severity_rationale: signature.severity_rationale.to_string(),
            false_positive_note: signature.false_positive_note.to_string(),
            evidence: line.to_string(),
            lens_id: lens.id().to_string(),
            lens_version: lens.version().to_string(),
            group: placement.group,
            priority: placement.priority,
        }),
    )
}

fn field_text(value: &Value) -> Option<String> {
    [
        "message",
        "msg",
        "log",
        "text",
        "error",
        "event",
        "description",
    ]
    .into_iter()
    .find_map(|key| {
        value
            .get(key)
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
    })
}

fn records_from_lines(
    file: &str,
    content: &str,
    library: &Library,
    lens: &Selection,
    messages: impl Fn(usize, &str) -> Option<String>,
) -> Vec<NormalizedRecord> {
    content
        .lines()
        .enumerate()
        .map(|(index, line)| {
            let raw = sanitize_text(line);
            let message = messages(index + 1, line).unwrap_or_else(|| raw.clone());
            let (severity, finding) = finding_for(&raw, library, lens);
            NormalizedRecord {
                file: file.to_string(),
                line: index + 1,
                raw,
                message,
                severity,
                finding,
            }
        })
        .collect()
}

fn json_records(
    file: &str,
    content: &str,
    library: &Library,
    lens: &Selection,
) -> (Vec<NormalizedRecord>, Option<String>) {
    let mut warning = None;
    let parsed = serde_json::from_str::<Value>(content);
    match parsed {
        Ok(value) => {
            let message = field_text(&value);
            let records = records_from_lines(file, content, library, lens, move |line, _| {
                (line == 1).then(|| message.clone()).flatten()
            });
            (records, warning)
        }
        Err(error) => {
            warning = Some(format!(
                "{} parse failed ({error}); using line-level scanning",
                InputFormat::Json.label()
            ));
            (
                records_from_lines(file, content, library, lens, |_, _| None),
                warning,
            )
        }
    }
}

fn ndjson_records(
    file: &str,
    content: &str,
    library: &Library,
    lens: &Selection,
) -> (Vec<NormalizedRecord>, Option<String>) {
    let mut invalid_line = None;
    let messages: Vec<Option<String>> = content
        .lines()
        .enumerate()
        .map(
            |(index, line)| match serde_json::from_str::<Value>(line.trim()) {
                Ok(value) => field_text(&value),
                Err(_) if !line.trim().is_empty() => {
                    invalid_line = Some(index + 1);
                    None
                }
                Err(_) => None,
            },
        )
        .collect();
    let warning = invalid_line.map(|line| {
        format!("NDJSON parse failed on line {line}; using line-level scanning for that line")
    });
    (
        records_from_lines(file, content, library, lens, |line, _| {
            messages.get(line.saturating_sub(1)).cloned().flatten()
        }),
        warning,
    )
}

fn csv_records(
    file: &str,
    content: &str,
    library: &Library,
    lens: &Selection,
) -> (Vec<NormalizedRecord>, Option<String>) {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(content.as_bytes());
    let headers = match reader.headers() {
        Ok(headers) => headers.clone(),
        Err(error) => {
            return (
                records_from_lines(file, content, library, lens, |_, _| None),
                Some(format!(
                    "CSV parse failed ({error}); using line-level scanning"
                )),
            );
        }
    };
    let mut messages = Vec::new();
    let message_index = headers.iter().position(|header| {
        matches!(
            header.to_ascii_lowercase().as_str(),
            "message" | "msg" | "log" | "text" | "error" | "event"
        )
    });
    for result in reader.records() {
        match result {
            Ok(record) => {
                messages.push(message_index.and_then(|index| record.get(index).map(str::to_string)))
            }
            Err(error) => {
                return (
                    records_from_lines(file, content, library, lens, |_, _| None),
                    Some(format!(
                        "CSV parse failed ({error}); using line-level scanning"
                    )),
                );
            }
        }
    }
    let records = records_from_lines(file, content, library, lens, |line, _| {
        if line == 1 {
            Some(headers.iter().collect::<Vec<_>>().join(","))
        } else {
            messages.get(line - 2).cloned().flatten()
        }
    });
    (records, None)
}

pub fn normalize(
    file: &str,
    path: Option<&Path>,
    content: &str,
    library: &Library,
) -> NormalizedInput {
    let lens = Selection::default().expect("shipped default lens must validate");
    normalize_with_lens(file, path, content, library, &lens)
}

pub fn normalize_with_lens(
    file: &str,
    path: Option<&Path>,
    content: &str,
    library: &Library,
    lens: &Selection,
) -> NormalizedInput {
    let format = detect_format(path, content);
    let (records, warning) = match format {
        InputFormat::PlainText => (
            records_from_lines(file, content, library, lens, |_, _| None),
            None,
        ),
        InputFormat::Json => json_records(file, content, library, lens),
        InputFormat::Ndjson => ndjson_records(file, content, library, lens),
        InputFormat::Csv => csv_records(file, content, library, lens),
    };
    NormalizedInput {
        format,
        records,
        warning,
    }
}

pub fn format_warning(path: &Path, content: &str) -> Option<String> {
    let library = Library::builtin();
    normalize(&path.display().to_string(), Some(path), content, &library).warning
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ansi_and_controls_are_removed_without_losing_text() {
        assert_eq!(
            sanitize_text("\u{1b}[31mERROR\u{1b}[0m\tline\u{1}"),
            "ERROR\tline"
        );
    }

    #[test]
    fn malformed_json_falls_back_to_lines() {
        let input = normalize(
            "broken.json",
            Some(Path::new("broken.json")),
            "{\"message\":\"ERROR connection refused\"\n",
            &Library::builtin(),
        );
        assert_eq!(input.format, InputFormat::Json);
        assert!(input.warning.is_some());
        assert_eq!(
            input.records[0].raw,
            "{\"message\":\"ERROR connection refused\""
        );
        assert!(input.records[0].finding.is_some());
    }

    #[test]
    fn structured_fields_and_source_lines_are_both_retained() {
        let input = normalize(
            "events.ndjson",
            Some(Path::new("events.ndjson")),
            "{\"message\":\"connection refused\",\"service\":\"api\"}\n",
            &Library::builtin(),
        );
        assert_eq!(input.format, InputFormat::Ndjson);
        assert_eq!(input.records[0].message, "connection refused");
        assert!(input.records[0].raw.contains("service"));
    }

    #[test]
    fn finding_carries_stable_identity_and_trust_metadata() {
        let input = normalize(
            "sample.log",
            None,
            "FATAL unhandled exception in scan engine\n",
            &Library::builtin(),
        );
        let finding = input.records[0].finding.as_ref().expect("finding");
        assert_eq!(finding.id, "fatal-error-crash");
        assert_eq!(finding.source, "builtin");
        assert_eq!(finding.provenance.catalog, "traceglass-rust-builtins");
        assert_eq!(finding.provenance.pattern, finding.id);
        assert!(!finding.severity_rationale.is_empty());
        assert!(!finding.false_positive_note.is_empty());
    }

    #[test]
    fn csb_is_csv() {
        let input = normalize(
            "events.csb",
            Some(Path::new("events.csb")),
            "timestamp,message\n1,connection refused\n",
            &Library::builtin(),
        );
        assert_eq!(input.format, InputFormat::Csv);
        assert_eq!(input.records[1].message, "connection refused");
    }
}
