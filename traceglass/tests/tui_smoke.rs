use std::error::Error;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use portable_pty::{CommandBuilder, PtySize, native_pty_system};

#[test]
fn packaged_binary_opens_file_scans_and_shows_findings_in_a_pty() -> Result<(), Box<dyn Error>> {
    let binary = std::env::var_os("TRACEGLASS_SMOKE_BINARY")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_BIN_EXE_traceglass")));
    let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("samples/sample.log");
    let export_dir = std::env::temp_dir().join(format!(
        "traceglass-pty-findings-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_nanos()
    ));
    std::fs::create_dir_all(&export_dir)?;
    std::fs::write(export_dir.join("traceglass-findings.md"), "keep this file")?;

    let pty = native_pty_system().openpty(PtySize {
        rows: 32,
        cols: 120,
        pixel_width: 0,
        pixel_height: 0,
    })?;
    let mut command = CommandBuilder::new(binary);
    command.arg(fixture);
    command.cwd(&export_dir);
    let mut child = pty.slave.spawn_command(command)?;
    drop(pty.slave);

    let mut writer = pty.master.take_writer()?;
    let mut reader = pty.master.try_clone_reader()?;
    let (output_tx, output_rx) = mpsc::channel();
    thread::spawn(move || {
        let mut chunk = [0_u8; 4096];
        loop {
            match reader.read(&mut chunk) {
                Ok(0) | Err(_) => break,
                Ok(size) => {
                    if output_tx.send(chunk[..size].to_vec()).is_err() {
                        break;
                    }
                }
            }
        }
    });

    let deadline = Instant::now() + Duration::from_secs(15);
    let mut transcript = String::new();
    let mut requested_findings = false;
    let mut saw_findings = false;
    let mut requested_export = false;
    let mut saw_export = false;

    while Instant::now() < deadline {
        if let Ok(bytes) = output_rx.recv_timeout(Duration::from_millis(250)) {
            transcript.push_str(&String::from_utf8_lossy(&bytes));
        }

        if !requested_findings && transcript.contains("sample.log") {
            writer.write_all(b"s")?;
            writer.flush()?;
            requested_findings = true;
        }

        if requested_findings
            && !saw_findings
            && transcript.to_ascii_lowercase().contains("scan findings")
        {
            saw_findings = true;
        }

        if saw_findings && !requested_export {
            writer.write_all(b"e")?;
            writer.flush()?;
            requested_export = true;
        }

        if requested_export
            && transcript
                .to_ascii_lowercase()
                .contains("kept the earlier export")
        {
            saw_export = true;
            writer.write_all(b"q")?;
            writer.flush()?;
            break;
        }
    }

    if !saw_findings {
        let _ = child.kill();
    }
    let _ = child.wait()?;
    assert!(
        requested_findings,
        "file name was not rendered: {transcript}"
    );
    assert!(
        saw_findings,
        "findings panel was not rendered: {transcript}"
    );
    assert!(
        transcript.to_ascii_lowercase().contains("high")
            || transcript.to_ascii_lowercase().contains("medium")
            || transcript.to_ascii_lowercase().contains("critical"),
        "severity finding was not rendered: {transcript}"
    );
    assert!(
        transcript.contains("source: builtin") && transcript.contains("evidence"),
        "finding evidence/provenance was not rendered: {transcript}"
    );
    assert!(
        saw_export,
        "collision-safe export feedback was not rendered: {transcript}"
    );
    let export = std::fs::read_to_string(export_dir.join("traceglass-findings-2.md"))?;
    assert!(export.contains("source: builtin"));
    assert!(export.contains("false-positive"));
    std::fs::remove_dir_all(export_dir)?;
    Ok(())
}

#[test]
fn packaged_binary_reopens_saved_watchlist_in_a_pty() -> Result<(), Box<dyn Error>> {
    let binary = std::env::var_os("TRACEGLASS_SMOKE_BINARY")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_BIN_EXE_traceglass")));
    let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("samples/sample.log");
    let config_dir = std::env::temp_dir().join(format!(
        "traceglass-pty-watchlist-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_nanos()
    ));
    std::fs::create_dir_all(&config_dir)?;

    let pty = native_pty_system().openpty(PtySize {
        rows: 32,
        cols: 120,
        pixel_width: 0,
        pixel_height: 0,
    })?;
    let mut command = CommandBuilder::new(binary);
    command.arg("--no-scan");
    command.arg(fixture);
    command.env("TRACEGLASS_CONFIG_DIR", &config_dir);
    let mut child = pty.slave.spawn_command(command)?;
    drop(pty.slave);

    let mut writer = pty.master.take_writer()?;
    let mut reader = pty.master.try_clone_reader()?;
    let (output_tx, output_rx) = mpsc::channel();
    thread::spawn(move || {
        let mut chunk = [0_u8; 4096];
        loop {
            match reader.read(&mut chunk) {
                Ok(0) | Err(_) => break,
                Ok(size) => {
                    if output_tx.send(chunk[..size].to_vec()).is_err() {
                        break;
                    }
                }
            }
        }
    });

    let mut transcript = String::new();
    let mut wait_for = |needle: &str| {
        let start = transcript.len();
        let deadline = Instant::now() + Duration::from_secs(10);
        while Instant::now() < deadline {
            if let Ok(bytes) = output_rx.recv_timeout(Duration::from_millis(200)) {
                transcript.push_str(&String::from_utf8_lossy(&bytes));
            }
            if transcript[start..].contains(needle) {
                return true;
            }
        }
        false
    };

    assert!(wait_for("sample.log"), "viewer did not open: {transcript}");
    writer.write_all(b"a")?;
    writer.flush()?;
    assert!(
        wait_for("Add keyword highlight to local watchlist"),
        "viewer add prompt did not name the local watchlist: {transcript}"
    );
    writer.write_all(b"ERROR\r")?;
    writer.flush()?;
    assert!(
        wait_for("added keyword highlight to local watchlist: ERROR"),
        "viewer add status did not name the local watchlist: {transcript}"
    );
    writer.write_all(b"f")?;
    writer.flush()?;
    assert!(
        wait_for("Failed to connect"),
        "keyword match was not visible after filtering: {transcript}"
    );
    writer.write_all(b"W")?;
    writer.flush()?;
    assert!(
        wait_for("Watchlist workspace"),
        "workspace did not open: {transcript}"
    );
    assert!(
        wait_for("[keyword]"),
        "viewer-added keyword was not present in the local watchlist workspace: {transcript}"
    );
    writer.write_all(b"aERROR\r")?;
    writer.flush()?;
    assert!(
        wait_for("unsaved local watchlist"),
        "added entry did not finish its rescan: {transcript}"
    );
    writer.write_all(b"r(\r")?;
    writer.flush()?;
    assert!(
        wait_for("invalid watchlist regex"),
        "invalid regex feedback was not rendered: {transcript}"
    );
    writer.write_all(b"x")?;
    writer.flush()?;
    assert!(
        wait_for("removed keyword highlight from local watchlist"),
        "remove feedback was not rendered: {transcript}"
    );
    writer.write_all(b"aERROR\r")?;
    writer.flush()?;
    assert!(
        wait_for("unsaved local watchlist"),
        "re-added entry did not finish its rescan: {transcript}"
    );
    writer.write_all(b"s")?;
    writer.flush()?;
    assert!(
        wait_for("local watchlist saved"),
        "save feedback was not rendered: {transcript}"
    );
    writer.write_all(b"qS")?;
    writer.flush()?;
    assert!(
        wait_for("source: builtin"),
        "built-in signature evidence was not rendered after saving the local watchlist: {transcript}"
    );
    writer.write_all(b"qW")?;
    writer.flush()?;
    assert!(
        wait_for("Watchlist workspace"),
        "workspace did not reopen: {transcript}"
    );
    writer.write_all(b"R")?;
    writer.flush()?;
    assert!(
        wait_for("local watchlist reloaded"),
        "reload feedback was not rendered: {transcript}"
    );
    let persisted = std::fs::read_to_string(config_dir.join("watchlist.json"))?;
    assert!(persisted.contains("\"version\": 1"));
    assert!(persisted.contains("\"kind\": \"keyword\""));
    assert!(persisted.contains("\"value\": \"ERROR\""));
    assert!(!persisted.contains("source"));

    writer.write_all(b"qq")?;
    writer.flush()?;
    let _ = child.wait()?;
    let _ = std::fs::remove_dir_all(config_dir);
    Ok(())
}
