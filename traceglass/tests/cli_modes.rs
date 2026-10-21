use std::io::Write;
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value;

fn binary() -> Command {
    Command::new(env!("CARGO_BIN_EXE_traceglass"))
}

fn temporary_findings_path() -> std::path::PathBuf {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock after epoch")
        .as_nanos();
    std::env::temp_dir().join(format!(
        "traceglass-findings-{}-{stamp}.json",
        std::process::id()
    ))
}

#[test]
fn explicit_json_mode_is_machine_readable_and_keeps_evidence() {
    let output = binary()
        .args(["--format", "json", "tests/fixtures/events.ndjson"])
        .output()
        .expect("run traceglass");
    assert!(output.status.success());
    let records: Vec<Value> = serde_json::from_slice(&output.stdout).expect("JSON records");
    assert_eq!(records.len(), 3);
    assert_eq!(records[1]["line"], 2);
    assert_eq!(records[1]["file"], "events.ndjson");
    assert!(records[1]["finding"]["title"].as_str().is_some());
}

#[test]
fn findings_export_coexists_with_existing_json_stdout() {
    let baseline = binary()
        .args(["--format", "json", "tests/fixtures/events.ndjson"])
        .output()
        .expect("run baseline traceglass");
    assert!(baseline.status.success());

    let findings_path = temporary_findings_path();
    let output = binary()
        .args([
            "--format",
            "json",
            "--findings",
            findings_path.to_str().expect("UTF-8 temporary path"),
            "tests/fixtures/events.ndjson",
        ])
        .output()
        .expect("run traceglass with findings export");
    assert!(output.status.success());
    assert_eq!(output.stdout, baseline.stdout);

    let document: Value =
        serde_json::from_slice(&std::fs::read(&findings_path).expect("findings file"))
            .expect("findings JSON");
    assert_eq!(document["schema"], "traceglass.findings.v1");
    assert!(
        !document["findings"]
            .as_array()
            .expect("findings array")
            .is_empty()
    );
    std::fs::remove_file(findings_path).expect("remove temporary findings file");
}

#[test]
fn csv_mode_has_stable_header_and_escaped_fields() {
    let output = binary()
        .args(["--format", "csv", "tests/fixtures/events.csv"])
        .output()
        .expect("run traceglass");
    assert!(output.status.success());
    let text = String::from_utf8(output.stdout).expect("UTF-8 CSV");
    assert!(text.starts_with(
        "file,line,severity,message,evidence,raw,signature_id,source,catalog,version,set,pattern,severity_rationale,explanation,false_positive_note,matched_evidence,lens_id,lens_version,lens_group,lens_priority\n"
    ));
    assert!(text.contains("PostgreSQL connection or transaction failure"));
}

#[test]
fn piped_stdin_defaults_to_sanitized_raw_output() {
    let mut child = binary()
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .expect("spawn traceglass");
    child
        .stdin
        .take()
        .expect("stdin")
        .write_all(b"\x1b[31mERROR\x1b[0m connection refused\n")
        .expect("write stdin");
    let output = child.wait_with_output().expect("wait for traceglass");
    assert!(output.status.success());
    assert_eq!(output.stdout, b"ERROR connection refused\n");
}

#[test]
fn help_documents_all_machine_modes() {
    let output = binary().arg("--help").output().expect("run help");
    let help = String::from_utf8(output.stdout).expect("UTF-8 help");
    assert!(help.contains("TraceGlass"));
    assert!(help.contains("--format <FORMAT>"));
    assert!(help.contains("--findings <PATH>"));
    assert!(help.contains("raw"));
    assert!(help.contains("json"));
    assert!(help.contains("csv"));
    assert!(help.contains("--lens"));
    assert!(help.contains("--ci"));
    assert!(help.contains("--color"));
    assert!(help.contains("--theme"));
    assert!(help.contains("truecolor"));
}

#[test]
fn lens_selection_is_reported_without_changing_raw_output() {
    let output = binary()
        .args([
            "--lens",
            "security-signals",
            "--format",
            "json",
            "tests/fixtures/plain.log",
        ])
        .output()
        .expect("run traceglass");
    assert!(output.status.success());
    let records: Vec<Value> = serde_json::from_slice(&output.stdout).expect("JSON records");
    // `finding: null` still yields Some(Null) from Value::get — skip nulls.
    let finding = records
        .iter()
        .find_map(|record| record.get("finding").filter(|value| value.is_object()))
        .expect("fixture finding");
    assert_eq!(finding["lens_id"], "security-signals");
    assert_eq!(finding["lens_version"], "v0.1.0");
    assert!(finding["group"].as_str().is_some());
    assert!(finding["priority"].as_u64().is_some());
}

#[test]
fn unknown_lens_is_a_usage_error_before_input_processing() {
    let output = binary()
        .args([
            "--lens",
            "not-a-lens",
            "--format",
            "json",
            "does-not-exist.log",
        ])
        .output()
        .expect("run traceglass");
    assert_eq!(output.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&output.stderr).contains("unknown lens"));
}

/// GIF demo support pack: planted OOM → restart-loop cascade must keep firing
/// the striking built-ins (no detection-code changes required).
#[test]
fn demo_bundle_surfaces_planted_incident_cascade() {
    let findings_path = temporary_findings_path();
    let output = binary()
        .args([
            "--lens",
            "incident-reliability",
            "--findings",
            findings_path.to_str().expect("UTF-8 temporary path"),
            "samples/demo-bundle/case",
        ])
        .output()
        .expect("scan demo-bundle/case");
    assert!(
        output.status.success(),
        "stderr={}",
        String::from_utf8_lossy(&output.stderr)
    );

    let document: Value =
        serde_json::from_slice(&std::fs::read(&findings_path).expect("findings file"))
            .expect("findings JSON");
    let findings = document["findings"].as_array().expect("findings array");
    assert!(
        findings.len() >= 10,
        "expected a multi-signal cascade, got {}",
        findings.len()
    );

    let ids: std::collections::BTreeSet<&str> = findings
        .iter()
        .filter_map(|f| f["match"]["signature_id"].as_str())
        .collect();
    for required in [
        "fatal-error-crash",
        "resource-exhaustion",
        "kubernetes-workload-failure",
        "container-runtime-failure",
        "nginx-upstream-failure",
        "postgresql-connection-transaction-failure",
        "mysql-storage-concurrency-failure",
        "connection-refused-reset",
        "systemd-unit-failure",
        "diagnostic-assertion-traceback",
    ] {
        assert!(
            ids.contains(required),
            "missing planted signature {required}; have {ids:?}"
        );
    }

    assert!(
        findings.iter().any(|f| f["severity"] == "critical"),
        "demo should surface at least one Critical finding"
    );
    assert!(
        findings
            .iter()
            .any(|f| f["lens"]["id"] == "incident-reliability"),
        "incident-reliability lens should annotate findings"
    );

    // Zip twin must scan the same story (no README tab noise).
    let zip_findings_path = temporary_findings_path();
    let zip_output = binary()
        .args([
            "--lens",
            "incident-reliability",
            "--findings",
            zip_findings_path.to_str().expect("UTF-8 temporary path"),
            "samples/demo-bundle.zip",
        ])
        .output()
        .expect("scan demo-bundle.zip");
    assert!(zip_output.status.success());
    let zip_document: Value =
        serde_json::from_slice(&std::fs::read(&zip_findings_path).expect("zip findings file"))
            .expect("zip findings JSON");
    let zip_ids: std::collections::BTreeSet<&str> = zip_document["findings"]
        .as_array()
        .expect("zip findings array")
        .iter()
        .filter_map(|f| f["match"]["signature_id"].as_str())
        .collect();
    assert_eq!(ids, zip_ids, "directory and zip demo packs must agree");

    let _ = std::fs::remove_file(findings_path);
    let _ = std::fs::remove_file(zip_findings_path);
}
