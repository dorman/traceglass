//! Browser bindings for the TraceGlass in-memory scanner.
//!
//! Excluded from this build (see parent crate features):
//! - filesystem ingest / directory walks
//! - zip extraction
//! - interactive TUI (crossterm / ratatui)
//! - config / watchlist persistence
//! - threads (the native scanner is cooperative anyway)

use serde::Serialize;
use wasm_bindgen::prelude::*;

use traceglass::scan::{self, ScanSource};
use traceglass::{BuildCapabilities, build_capabilities};

#[wasm_bindgen(start)]
pub fn start() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Honest capability report for the demo UI.
#[wasm_bindgen]
pub fn capabilities_json() -> String {
    serde_json::to_string(&build_capabilities()).expect("capabilities serialize")
}

#[derive(Serialize)]
struct ScanMeta {
    source_count: usize,
    total_bytes: usize,
    elapsed_ms: f64,
    finding_count: usize,
    capabilities: BuildCapabilities,
}

/// Scan a single UTF-8 log (name + text). Returns `traceglass.findings.v1` JSON.
#[wasm_bindgen]
pub fn scan_text(name: &str, content: &str, lens_id: &str) -> Result<String, JsValue> {
    let sources = [ScanSource {
        name: name.to_string(),
        content: content.to_string(),
    }];
    scan::scan_to_findings_json(&sources, lens_id).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Scan many named sources. `sources_json` is
/// `[{"name":"a.log","content":"..."}, ...]`.
#[wasm_bindgen]
pub fn scan_sources_json(sources_json: &str, lens_id: &str) -> Result<String, JsValue> {
    #[derive(serde::Deserialize)]
    struct In {
        name: String,
        content: String,
    }
    let parsed: Vec<In> = serde_json::from_str(sources_json)
        .map_err(|e| JsValue::from_str(&format!("invalid sources JSON: {e}")))?;
    let sources: Vec<ScanSource> = parsed
        .into_iter()
        .map(|s| ScanSource {
            name: s.name,
            content: s.content,
        })
        .collect();
    scan::scan_to_findings_json(&sources, lens_id).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Compact findings array JSON plus timing metadata.
#[wasm_bindgen]
pub fn scan_with_meta(sources_json: &str, lens_id: &str) -> Result<JsValue, JsValue> {
    #[derive(serde::Deserialize)]
    struct In {
        name: String,
        content: String,
    }
    let parsed: Vec<In> = serde_json::from_str(sources_json)
        .map_err(|e| JsValue::from_str(&format!("invalid sources JSON: {e}")))?;
    let total_bytes: usize = parsed.iter().map(|s| s.content.len()).sum();
    let source_count = parsed.len();
    let sources: Vec<ScanSource> = parsed
        .into_iter()
        .map(|s| ScanSource {
            name: s.name,
            content: s.content,
        })
        .collect();

    let started = js_sys::Date::now();
    let findings =
        scan::scan_findings(&sources, lens_id).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let elapsed_ms = js_sys::Date::now() - started;

    #[derive(Serialize)]
    struct Out {
        findings: Vec<scan::FindingView>,
        meta: ScanMeta,
    }

    let out = Out {
        meta: ScanMeta {
            source_count,
            total_bytes,
            elapsed_ms,
            finding_count: findings.len(),
            capabilities: build_capabilities(),
        },
        findings,
    };
    serde_wasm_bindgen::to_value(&out).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    wasm_bindgen_test_configure!(run_in_browser);

    #[wasm_bindgen_test]
    fn scans_fatal_line() {
        let json = scan_text(
            "api.log",
            "FATAL unhandled exception in api worker\n",
            "incident-reliability",
        )
        .expect("scan");
        assert!(json.contains("fatal-error-crash"));
        assert!(json.contains("critical"));
    }
}
