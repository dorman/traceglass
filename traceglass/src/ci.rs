//! CI / GitHub Actions build-log triage helpers.
//!
//! Pure text processing with no filesystem access so the WASM demo can reuse
//! the same parser. Marker and timestamp shapes follow public GitHub Actions
//! documentation and third-party format notes — not a scrubbed real workflow
//! log from this repository.

use crate::signatures::Library;

/// How many surrounding original lines to attach to each candidate (before +
/// after the hit). About five lines of evidence including the candidate itself.
const CONTEXT_RADIUS: usize = 2;

/// How many alternate candidates to surface after the primary one.
const ALTERNATE_CANDIDATES: usize = 3;

/// UTF-8 BOM, sometimes present on exported Windows logs.
const UTF8_BOM: &str = "\u{feff}";

/// Optional leading timestamp GitHub Actions prefixes on each log line, e.g.
/// `2026-10-16T12:34:56.1234567Z `.
fn timestamp_prefix_len(line: &str) -> usize {
    let bytes = line.as_bytes();
    // YYYY-MM-DDTHH:MM:SS
    if bytes.len() < 20 {
        return 0;
    }
    let head = &bytes[..19];
    let is_digits = |s: &[u8]| s.iter().all(|b| b.is_ascii_digit());
    if !(is_digits(&head[0..4])
        && head[4] == b'-'
        && is_digits(&head[5..7])
        && head[7] == b'-'
        && is_digits(&head[8..10])
        && head[10] == b'T'
        && is_digits(&head[11..13])
        && head[13] == b':'
        && is_digits(&head[14..16])
        && head[16] == b':'
        && is_digits(&head[17..19]))
    {
        return 0;
    }
    let mut i = 19;
    if bytes.get(i) == Some(&b'.') {
        i += 1;
        let start = i;
        while i < bytes.len() && bytes[i].is_ascii_digit() {
            i += 1;
        }
        if i == start {
            return 0;
        }
    }
    if bytes.get(i) != Some(&b'Z') {
        return 0;
    }
    i += 1;
    if bytes.get(i) != Some(&b' ') {
        return 0;
    }
    i += 1;
    i
}

/// Strip an optional UTF-8 BOM from the start of a log body.
pub fn strip_bom(text: &str) -> &str {
    text.strip_prefix(UTF8_BOM).unwrap_or(text)
}

/// Strip a leading GitHub Actions timestamp prefix for matching only.
///
/// The original line (with timestamp) is kept for display and line numbers.
pub fn strip_timestamp_prefix(line: &str) -> &str {
    let n = timestamp_prefix_len(line);
    if n == 0 { line } else { &line[n..] }
}

/// Prepare a line for marker / signature / generic matching: drop ANSI and the
/// optional timestamp prefix. Display continues to use the original line text.
pub fn match_text(line: &str) -> String {
    let sanitized = crate::records::sanitize_text(line);
    strip_timestamp_prefix(&sanitized).to_string()
}

/// Why a line is worth checking first. Lower discriminant = higher priority.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum CandidateRank {
    /// A `##[error]` annotation.
    AnnotationError = 0,
    /// A step that ended with a non-zero exit code.
    NonZeroStep = 1,
    /// A built-in signature finding on the match text.
    SignatureFinding = 2,
    /// A generic `error:` / `FAILED` line (with false-positive guards).
    GenericError = 3,
}

impl CandidateRank {
    pub fn label(self) -> &'static str {
        match self {
            Self::AnnotationError => "##[error]",
            Self::NonZeroStep => "non-zero exit",
            Self::SignatureFinding => "signature",
            Self::GenericError => "generic error",
        }
    }
}

/// One parsed log line with matching metadata. `original` is for display;
/// markers are recognized on `match_text` only.
#[derive(Clone, Debug)]
pub struct CiLine {
    /// 0-based index into the log's line list (same as TUI `jump_to_line`).
    pub index: usize,
    /// Original line text (timestamp and all).
    pub original: String,
    /// Text used for marker / signature / generic matching.
    pub match_text: String,
    /// Innermost open `##[group]` name, if any.
    pub step_name: Option<String>,
    pub kind: LineKind,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum LineKind {
    Plain,
    GroupStart { name: String },
    GroupEnd,
    AnnotationError,
    AnnotationWarning,
    ProcessCompleted { exit_code: i32 },
}

/// A `##[group]` … `##[endgroup]` region (or an unclosed group through EOF).
#[derive(Clone, Debug)]
pub struct CiStep {
    pub name: String,
    pub start_index: usize,
    pub end_index: usize,
    pub exit_code: Option<i32>,
}

/// Parsed CI log: lines, steps, and no filesystem involvement.
#[derive(Clone, Debug)]
pub struct ParsedCiLog {
    pub lines: Vec<CiLine>,
    pub steps: Vec<CiStep>,
}

/// One ranked error candidate with a short evidence window.
#[derive(Clone, Debug)]
pub struct ErrorCandidate {
    /// 0-based line index.
    pub line_index: usize,
    pub rank: CandidateRank,
    pub step_name: Option<String>,
    /// Short reason suitable for a status line ("worth checking first").
    pub reason: String,
    pub false_positive_note: Option<String>,
    /// Original lines in `[line_index - r, line_index + r]`, as `(index, text)`.
    pub context: Vec<(usize, String)>,
}

/// Parse a CI / build log into lines and steps.
///
/// Nested or unclosed `##[group]` markers do not panic or loop: the group stack
/// is bounded by line count, and a missing `##[endgroup]` simply closes at EOF.
pub fn parse_ci_log(text: &str) -> ParsedCiLog {
    let body = strip_bom(text);
    let mut lines = Vec::new();
    let mut steps = Vec::new();
    // Stack of (step_index_in_steps, name).
    let mut stack: Vec<(usize, String)> = Vec::new();

    for (index, raw) in body.lines().enumerate() {
        // `str::lines` already drops `\n` / `\r\n`; keep the visible text.
        let original = raw.to_string();
        let matched = match_text(&original);
        let step_name = stack.last().map(|(_, n)| n.clone());
        let kind = classify_match_text(&matched);

        match &kind {
            LineKind::GroupStart { name } => {
                let step_idx = steps.len();
                steps.push(CiStep {
                    name: name.clone(),
                    start_index: index,
                    end_index: index,
                    exit_code: None,
                });
                stack.push((step_idx, name.clone()));
            }
            LineKind::GroupEnd => {
                if let Some((step_idx, _)) = stack.pop() {
                    steps[step_idx].end_index = index;
                }
            }
            LineKind::ProcessCompleted { exit_code } => {
                if let Some((step_idx, _)) = stack.last() {
                    steps[*step_idx].exit_code = Some(*exit_code);
                }
            }
            _ => {}
        }

        lines.push(CiLine {
            index,
            original,
            match_text: matched,
            step_name,
            kind,
        });
    }

    // Unclosed groups: extend through the last line.
    if !lines.is_empty() {
        let last = lines.len() - 1;
        for (step_idx, _) in stack {
            steps[step_idx].end_index = last;
        }
    }

    ParsedCiLog { lines, steps }
}

fn classify_match_text(text: &str) -> LineKind {
    if let Some(rest) = text.strip_prefix("##[group]") {
        return LineKind::GroupStart {
            name: rest.to_string(),
        };
    }
    if text == "##[endgroup]" || text.starts_with("##[endgroup]") {
        return LineKind::GroupEnd;
    }
    if text.starts_with("##[error]") {
        return LineKind::AnnotationError;
    }
    if text.starts_with("##[warning]") {
        return LineKind::AnnotationWarning;
    }
    if let Some(code) = parse_process_completed(text) {
        return LineKind::ProcessCompleted { exit_code: code };
    }
    LineKind::Plain
}

fn parse_process_completed(text: &str) -> Option<i32> {
    // "Process completed with exit code N." (trailing period optional)
    const PREFIX: &str = "Process completed with exit code ";
    let rest = text.strip_prefix(PREFIX)?;
    let digits = rest.trim_end_matches('.').trim().trim_start_matches('+');
    if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_digit()) {
        // Allow a leading minus for completeness.
        let signed = rest.trim_end_matches('.').trim();
        return signed.parse().ok();
    }
    digits.parse().ok()
}

/// Rank first-error candidates for a parsed log.
///
/// Order: `##[error]`, then a step that ended non-zero, then built-in signature
/// findings, then generic `error:` / `FAILED` lines. Returns the earliest
/// high-rank candidate first, then up to three alternates. Lines like `0 errors`
/// or "error" inside a package name are not generic candidates.
pub fn rank_error_candidates(parsed: &ParsedCiLog, library: &Library) -> Vec<ErrorCandidate> {
    let mut candidates: Vec<ErrorCandidate> = Vec::new();

    for line in &parsed.lines {
        if let Some(c) = candidate_for_line(line, library) {
            candidates.push(c);
        }
    }

    // Non-zero step: prefer the ProcessCompleted line; if missing, use the
    // step's last line so an unclosed failing group still surfaces.
    for step in &parsed.steps {
        let Some(code) = step.exit_code else {
            continue;
        };
        if code == 0 {
            continue;
        }
        let hit = parsed
            .lines
            .iter()
            .find(|l| {
                l.index >= step.start_index
                    && l.index <= step.end_index
                    && matches!(l.kind, LineKind::ProcessCompleted { exit_code } if exit_code != 0)
            })
            .map(|l| l.index)
            .unwrap_or(step.end_index);
        if candidates
            .iter()
            .any(|c| c.line_index == hit && c.rank == CandidateRank::NonZeroStep)
        {
            continue;
        }
        if parsed.lines.get(hit).is_some() {
            candidates.push(ErrorCandidate {
                line_index: hit,
                rank: CandidateRank::NonZeroStep,
                step_name: Some(step.name.clone()),
                reason: format!("step ended with exit code {code}"),
                false_positive_note: Some(
                    "A non-zero exit is evidence worth checking first; optional steps with continue-on-error can also end non-zero.".into(),
                ),
                context: Vec::new(),
            });
        }
    }

    candidates.sort_by(|a, b| {
        a.rank
            .cmp(&b.rank)
            .then(a.line_index.cmp(&b.line_index))
            .then(a.reason.cmp(&b.reason))
    });

    // Deduplicate by line: keep the highest-rank reason for that line.
    let mut seen_lines = std::collections::BTreeSet::new();
    candidates.retain(|c| seen_lines.insert(c.line_index));

    candidates.truncate(1 + ALTERNATE_CANDIDATES);
    attach_context(parsed, &mut candidates);
    candidates
}

fn candidate_for_line(line: &CiLine, library: &Library) -> Option<ErrorCandidate> {
    match line.kind {
        LineKind::AnnotationError => {
            return Some(ErrorCandidate {
                line_index: line.index,
                rank: CandidateRank::AnnotationError,
                step_name: line.step_name.clone(),
                reason: "##[error] annotation".into(),
                false_positive_note: Some(
                    "Runner annotations are strong evidence, but retries and continue-on-error steps can emit ##[error] without being the failure worth fixing first.".into(),
                ),
                context: Vec::new(), // filled after we have the full line list
            });
        }
        LineKind::ProcessCompleted { exit_code } if exit_code != 0 => {
            return Some(ErrorCandidate {
                line_index: line.index,
                rank: CandidateRank::NonZeroStep,
                step_name: line.step_name.clone(),
                reason: format!("process completed with exit code {exit_code}"),
                false_positive_note: Some(
                    "A non-zero exit is evidence worth checking first; optional steps with continue-on-error can also end non-zero.".into(),
                ),
                context: Vec::new(),
            });
        }
        _ => {}
    }

    // Built-in signatures on match text (timestamp/ANSI already stripped).
    if let Some(si) = library.matches(&line.match_text).next() {
        let sig = &library[si];
        return Some(ErrorCandidate {
            line_index: line.index,
            rank: CandidateRank::SignatureFinding,
            step_name: line.step_name.clone(),
            reason: format!("signature · {}", sig.title),
            false_positive_note: Some(sig.false_positive_note.to_string()),
            context: Vec::new(),
        });
    }

    if is_generic_error_line(&line.match_text) {
        return Some(ErrorCandidate {
            line_index: line.index,
            rank: CandidateRank::GenericError,
            step_name: line.step_name.clone(),
            reason: "generic error:/FAILED line".into(),
            false_positive_note: Some(
                "Generic error tokens are noisy; package names and summaries like \"0 errors\" are filtered, but expected test failures can still match.".into(),
            ),
            context: Vec::new(),
        });
    }

    None
}

/// Fill context windows after candidates are collected against the full log.
fn attach_context(parsed: &ParsedCiLog, candidates: &mut [ErrorCandidate]) {
    for c in candidates.iter_mut() {
        c.context = context_window(&parsed.lines, c.line_index);
    }
}

fn context_window(lines: &[CiLine], hit: usize) -> Vec<(usize, String)> {
    let start = hit.saturating_sub(CONTEXT_RADIUS);
    let end = (hit + CONTEXT_RADIUS + 1).min(lines.len());
    lines[start..end]
        .iter()
        .map(|l| (l.index, l.original.clone()))
        .collect()
}

/// Generic fallback: `error:` (tool style) or a whole-word `FAILED`.
/// Rejects `0 errors`, `N error(s)`, and "error" embedded in identifiers.
pub fn is_generic_error_line(match_text: &str) -> bool {
    let t = match_text.trim();
    if t.is_empty() {
        return false;
    }
    // Summaries like "0 errors", "1 error", "2 errors" are not candidates.
    if is_error_count_summary(t) {
        return false;
    }
    // `error:` as a token (compiler / script style), not inside a word.
    if has_error_colon(t) {
        return true;
    }
    // Whole-word `FAILED` (shells / MSBuild). Case-sensitive so summaries like
    // "0 failed" do not become candidates.
    has_whole_word_failed(t)
}

fn is_error_count_summary(t: &str) -> bool {
    let lower = t.to_ascii_lowercase();
    let bytes = lower.as_bytes();
    let mut i = 0;
    while i < bytes.len() && bytes[i].is_ascii_digit() {
        i += 1;
    }
    if i == 0 {
        return false;
    }
    let rest = lower[i..].trim_start();
    rest == "error" || rest == "errors" || rest.starts_with("error ") || rest.starts_with("errors ")
}

fn has_error_colon(t: &str) -> bool {
    let lower = t.to_ascii_lowercase();
    let mut search = lower.as_str();
    while let Some(pos) = search.find("error:") {
        let before = &search[..pos];
        // Must be at start or preceded by a non-identifier char.
        let ok_before = before.is_empty()
            || before
                .chars()
                .next_back()
                .is_some_and(|c| !c.is_ascii_alphanumeric() && c != '_' && c != '-');
        if ok_before {
            return true;
        }
        search = &search[pos + 6..];
    }
    false
}

fn has_whole_word_failed(t: &str) -> bool {
    let mut search = t;
    while let Some(pos) = search.find("FAILED") {
        let before_ok = pos == 0
            || search[..pos]
                .chars()
                .next_back()
                .is_some_and(|c| !c.is_ascii_alphanumeric() && c != '_');
        let after = &search[pos + 6..];
        let after_ok = after.is_empty()
            || after
                .chars()
                .next()
                .is_some_and(|c| !c.is_ascii_alphanumeric() && c != '_');
        if before_ok && after_ok {
            return true;
        }
        search = &search[pos + 6..];
    }
    false
}

/// Rank candidates and attach evidence context windows.
pub fn first_error_candidates(text: &str, library: &Library) -> Vec<ErrorCandidate> {
    let parsed = parse_ci_log(text);
    rank_error_candidates(&parsed, library)
}

/// Detect a root-level GitHub Actions job log name: `N_<job>.txt`.
///
/// Returns `(order, job_name)` when the *basename* matches. Paths with a
/// directory component (per-step files under a job folder) return `None`.
pub fn github_job_log_parts(display_name: &str) -> Option<(u32, &str)> {
    let name = display_name
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(display_name);
    // Root-level only: the display name itself must not contain a separator.
    if display_name.contains('/') || display_name.contains('\\') {
        return None;
    }
    let stem = name
        .strip_suffix(".txt")
        .or_else(|| name.strip_suffix(".TXT"))?;
    let (num, rest) = stem.split_once('_')?;
    if num.is_empty() || rest.is_empty() {
        return None;
    }
    if !num.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let order: u32 = num.parse().ok()?;
    Some((order, rest))
}

/// When display names include root-level `N_<job>.txt` entries, return the
/// indices to keep (numeric order) and the job tab name for each.
///
/// Returns `None` when no root-level job logs are present so callers leave the
/// resolve list unchanged. Per-step paths like `build/2_Set up job.txt` never
/// qualify.
pub fn select_github_job_logs(names: &[String]) -> Option<Vec<(usize, String)>> {
    let mut job_logs: Vec<(u32, usize, String)> = Vec::new();
    for (idx, name) in names.iter().enumerate() {
        if let Some((order, job)) = github_job_log_parts(name) {
            job_logs.push((order, idx, job.to_string()));
        }
    }
    if job_logs.is_empty() {
        return None;
    }
    job_logs.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)));
    Some(
        job_logs
            .into_iter()
            .map(|(_, idx, job)| (idx, job))
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::signatures::Library;
    use std::fs;
    use std::path::PathBuf;

    fn lib() -> Library {
        Library::builtin()
    }

    fn fixture(name: &str) -> String {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/ci")
            .join(name);
        fs::read_to_string(path).unwrap_or_else(|e| panic!("read fixture {name}: {e}"))
    }

    #[test]
    fn strips_bom_and_timestamp_for_matching_only() {
        let line = "2026-10-16T12:34:56.1234567Z ##[error]boom";
        assert_eq!(strip_timestamp_prefix(line), "##[error]boom");
        assert_eq!(strip_bom("\u{feff}hello"), "hello");
        assert_eq!(strip_bom("hello"), "hello");
        let matched = match_text(line);
        assert_eq!(matched, "##[error]boom");
    }

    #[test]
    fn nested_and_unclosed_groups_do_not_panic() {
        let text = "\
##[group]outer
##[group]inner
still going
##[endgroup]
no close for outer
";
        let parsed = parse_ci_log(text);
        assert_eq!(parsed.steps.len(), 2);
        assert_eq!(parsed.steps[0].name, "outer");
        assert_eq!(parsed.steps[1].name, "inner");
        assert_eq!(parsed.steps[1].end_index, 3); // endgroup line
        assert_eq!(parsed.steps[0].end_index, parsed.lines.len() - 1);
    }

    #[test]
    fn ranks_annotation_error_first() {
        let text = "\
##[group]Build
error: stale
##[error]real failure
Process completed with exit code 1.
##[endgroup]
";
        let c = first_error_candidates(text, &lib());
        assert!(!c.is_empty());
        assert_eq!(c[0].rank, CandidateRank::AnnotationError);
        assert_eq!(c[0].step_name.as_deref(), Some("Build"));
        assert!(c[0].context.len() >= 3);
    }

    #[test]
    fn false_positive_trap_skips_zero_errors_and_package_name() {
        let text = fixture("false_positive_trap.txt");
        let c = first_error_candidates(&text, &lib());
        assert!(
            c.is_empty(),
            "expected no candidates, got: {:?}",
            c.iter().map(|x| (&x.reason, x.rank)).collect::<Vec<_>>()
        );
    }

    #[test]
    fn github_job_log_parts_root_only_and_numeric() {
        assert_eq!(
            github_job_log_parts("2_build (windows-latest).txt"),
            Some((2, "build (windows-latest)"))
        );
        assert_eq!(github_job_log_parts("10_deploy.txt"), Some((10, "deploy")));
        assert_eq!(github_job_log_parts("build/2_Set up job.txt"), None);
        assert_eq!(github_job_log_parts("notes.txt"), None);
    }

    #[test]
    fn select_job_logs_orders_numerically() {
        let names = vec![
            "10_deploy.txt".into(),
            "2_build (windows-latest).txt".into(),
            "build/1_Set up job.txt".into(),
            "2_build (windows-latest)/3_Run.txt".into(),
        ];
        let selected = select_github_job_logs(&names).expect("job logs present");
        assert_eq!(
            selected,
            vec![(1, "build (windows-latest)".into()), (0, "deploy".into()),]
        );
    }

    #[test]
    fn fixture_clean_pass_has_no_high_rank_candidate() {
        let c = first_error_candidates(&fixture("clean_pass.txt"), &lib());
        assert!(
            c.iter().all(|x| x.rank > CandidateRank::NonZeroStep),
            "clean pass should not surface annotation/non-zero candidates: {c:?}"
        );
    }

    #[test]
    fn fixture_single_failing_step_prefers_annotation() {
        let c = first_error_candidates(&fixture("single_failing_step.txt"), &lib());
        assert_eq!(c[0].rank, CandidateRank::AnnotationError);
        assert_eq!(c[0].step_name.as_deref(), Some("Run cargo build"));
    }

    #[test]
    fn fixture_noisy_setup_still_finds_test_error() {
        let c = first_error_candidates(&fixture("noisy_setup_fail.txt"), &lib());
        assert_eq!(c[0].rank, CandidateRank::AnnotationError);
        assert_eq!(c[0].step_name.as_deref(), Some("Run npm test"));
    }

    #[test]
    fn fixture_ansi_bom_and_crlf_windows_paths() {
        let ansi = fixture("ansi_bom.txt");
        assert!(ansi.starts_with('\u{feff}') || ansi.as_bytes().starts_with(&[0xef, 0xbb, 0xbf]));
        let c = first_error_candidates(&ansi, &lib());
        assert_eq!(c[0].rank, CandidateRank::AnnotationError);

        let win = fixture("crlf_windows.txt");
        assert!(win.contains('\r') || win.contains("D:\\a\\"));
        let c = first_error_candidates(&win, &lib());
        assert_eq!(c[0].rank, CandidateRank::AnnotationError);
        assert!(c[0].context.iter().any(|(_, t)| t.contains("D:\\a\\")));
    }

    #[test]
    fn fixture_plain_fallback_and_two_errors() {
        let c = first_error_candidates(&fixture("plain_fallback.txt"), &lib());
        assert!(!c.is_empty());
        assert!(
            c[0].rank == CandidateRank::GenericError
                || c[0].rank == CandidateRank::SignatureFinding
        );

        let c = first_error_candidates(&fixture("two_errors.txt"), &lib());
        assert!(c.len() >= 2);
        assert_eq!(c[0].rank, CandidateRank::AnnotationError);
        assert_eq!(c[1].rank, CandidateRank::AnnotationError);
        assert!(c[0].line_index < c[1].line_index);
    }

    #[test]
    fn generic_guards_reject_package_and_count_summaries() {
        assert!(!is_generic_error_line("Installing super-error-kit 1.0"));
        assert!(!is_generic_error_line("0 errors"));
        assert!(!is_generic_error_line("1 error"));
        assert!(is_generic_error_line("error: link failed"));
        assert!(is_generic_error_line("Build FAILED"));
        assert!(!is_generic_error_line("0 failed"));
        assert!(!is_generic_error_line("unfailed_check ok"));
    }
}
