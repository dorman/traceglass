use std::path::PathBuf;

use clap::{Parser, ValueEnum};

#[derive(Clone, Copy, Debug, ValueEnum, PartialEq, Eq)]
pub enum OutputFormat {
    /// Emit sanitized source text without terminal control sequences.
    Raw,
    /// Emit a JSON array of normalized records.
    Json,
    /// Emit normalized records with the stable file/line/severity schema.
    Csv,
}

/// TraceGlass - highlight the things that matter in your logs.
///
/// Run with no arguments for the welcome screen (press `o` to browse for
/// logs), or pass files, folders, or .zip bundles directly. A file path opens
/// the TUI on an interactive terminal; pipes and explicit output formats stay
/// non-interactive. Keywords and regexes can also be added live from inside
/// the TUI.
#[derive(Parser, Debug)]
#[command(name = "traceglass", version, about, long_about = None)]
pub struct Cli {
    /// Files, folders, or .zip archives to open (folders/zips recurse).
    pub files: Vec<String>,

    /// Literal keyword to highlight. Repeatable, or comma-separated within one flag.
    /// e.g. -k ERROR -k "timeout,rollback"
    #[arg(short = 'k', long = "keyword", value_delimiter = ',')]
    pub keywords: Vec<String>,

    /// Regex pattern to highlight. Repeatable.
    #[arg(short = 'r', long = "regex")]
    pub regexes: Vec<String>,

    /// Match case-insensitively (applies to both keywords and regexes).
    #[arg(short = 'i', long = "ignore-case")]
    pub ignore_case: bool,

    /// Don't scan for diagnostic signals on open. Useful when opening a large
    /// bundle just to read one file; press `S` to scan when you want it.
    #[arg(long = "no-scan")]
    pub no_scan: bool,

    /// Non-interactive output format. Explicit formats are safe for scripts and CI.
    #[arg(long, value_enum)]
    pub format: Option<OutputFormat>,

    /// Write matched built-in findings as a deterministic observability JSON document.
    #[arg(long, value_name = "PATH")]
    pub findings: Option<PathBuf>,

    /// Read stdin even when it is attached to a terminal.
    #[arg(long)]
    pub stdin: bool,

    /// Replay the interactive walkthrough. Ignored by machine modes.
    #[arg(long)]
    pub walkthrough: bool,

    /// Deterministic review lens. Matching is unchanged; the lens changes
    /// finding groups and review priority.
    #[arg(long, value_name = "ID", default_value = "general-triage")]
    pub lens: Option<String>,
}
