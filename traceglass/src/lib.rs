//! TraceGlass library surface.
//!
//! The default feature set builds the full CLI/TUI. The `wasm-scan` feature
//! exposes the in-memory signature scanner used by the browser demo: no
//! filesystem walks, no TUI, and zip handling is in-memory only (no temp dirs).

pub mod ci;
pub mod lenses;
pub mod records;
pub mod rules;
pub mod scan;
pub mod signatures;

#[cfg(feature = "zip")]
pub mod zip_mem;

#[cfg(test)]
mod scan_demo_bundle;

#[cfg(feature = "cli")]
pub mod cli;
#[cfg(feature = "cli")]
pub mod output;

#[cfg(feature = "fs")]
pub mod config;
#[cfg(feature = "fs")]
pub mod ingest;
#[cfg(feature = "fs")]
pub mod watchlist;

#[cfg(feature = "tui")]
pub mod app;
#[cfg(feature = "tui")]
pub mod browser;
#[cfg(feature = "tui")]
pub mod clipboard;
#[cfg(feature = "tui")]
pub mod event;
#[cfg(feature = "tui")]
pub mod theme;
#[cfg(feature = "tui")]
pub mod ui;
#[cfg(feature = "tui")]
pub mod walkthrough;

/// What this build includes. Useful for the WASM demo honesty note.
pub fn build_capabilities() -> BuildCapabilities {
    BuildCapabilities {
        signature_scan: true,
        lenses: true,
        structured_formats: cfg!(feature = "cli") || cfg!(feature = "wasm-scan"),
        filesystem_ingest: cfg!(feature = "fs"),
        zip_extract: cfg!(feature = "zip"),
        zip_in_memory: cfg!(feature = "wasm-scan"),
        interactive_tui: cfg!(feature = "tui"),
        machine_cli: cfg!(feature = "cli"),
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
pub struct BuildCapabilities {
    pub signature_scan: bool,
    pub lenses: bool,
    pub structured_formats: bool,
    pub filesystem_ingest: bool,
    pub zip_extract: bool,
    pub zip_in_memory: bool,
    pub interactive_tui: bool,
    pub machine_cli: bool,
}
