use std::error::Error;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use portable_pty::{CommandBuilder, PtySize, native_pty_system};

/// Device Status Report cursor-position query (`CSI 6 n`). ConPTY emits this
/// and blocks the child until the host replies with `CSI row ; col R`.
const CURSOR_POSITION_QUERY: &str = "\u{1b}[6n";
const CURSOR_POSITION_REPLY: &[u8] = b"\x1b[1;1R";

/// Answer outstanding DSR cursor-position queries so Windows ConPTY smokes can
/// paint. Harmless on Unix PTYs that never emit the query.
fn answer_cursor_position_queries(
    transcript: &str,
    answered: &mut usize,
    writer: &mut impl Write,
) -> std::io::Result<()> {
    let seen = transcript.matches(CURSOR_POSITION_QUERY).count();
    while *answered < seen {
        writer.write_all(CURSOR_POSITION_REPLY)?;
        writer.flush()?;
        *answered += 1;
    }
    Ok(())
}

fn ingest_pty_output(
    transcript: &mut String,
    bytes: &[u8],
    answered: &mut usize,
    writer: &mut impl Write,
) -> std::io::Result<()> {
    transcript.push_str(&String::from_utf8_lossy(bytes));
    answer_cursor_position_queries(transcript, answered, writer)
}

/// Per-step PTY wait ceiling. Windows ConPTY can lag far behind Unix PTYs when
/// painting popups; keep Unix snappy and give Windows a generous budget.
fn smoke_step_timeout() -> Duration {
    if cfg!(windows) {
        Duration::from_secs(45)
    } else {
        Duration::from_secs(15)
    }
}

/// Wait for `needle` in content painted after this call. Also accept a needle
/// that arrived in the same frame as the previous wait by scanning a short
/// overlap window at the end of the existing transcript.
///
/// Prefer [`wait_until_contains`] when the needle may already be present earlier
/// in the transcript (e.g. findings title + detail share one ConPTY frame).
fn wait_for_needle(
    transcript: &mut String,
    output_rx: &mpsc::Receiver<Vec<u8>>,
    writer: &mut impl Write,
    answered: &mut usize,
    needle: &str,
) -> bool {
    let mut start = transcript
        .len()
        .saturating_sub(needle.len().saturating_mul(4));
    while start > 0 && !transcript.is_char_boundary(start) {
        start -= 1;
    }
    wait_while(transcript, output_rx, writer, answered, |transcript| {
        transcript[start..].contains(needle)
    })
}

/// Poll the full PTY transcript until `needle` appears (or the smoke ceiling
/// elapses). Use this for assertions about on-screen state rather than
/// "arrived since the last keystroke" sequencing.
fn wait_until_contains(
    transcript: &mut String,
    output_rx: &mpsc::Receiver<Vec<u8>>,
    writer: &mut impl Write,
    answered: &mut usize,
    needle: &str,
) -> bool {
    wait_while(transcript, output_rx, writer, answered, |transcript| {
        transcript.contains(needle)
    })
}

fn wait_until_contains_ignore_ascii_case(
    transcript: &mut String,
    output_rx: &mpsc::Receiver<Vec<u8>>,
    writer: &mut impl Write,
    answered: &mut usize,
    needle: &str,
) -> bool {
    let needle = needle.to_ascii_lowercase();
    wait_while(transcript, output_rx, writer, answered, |transcript| {
        transcript.to_ascii_lowercase().contains(&needle)
    })
}

fn wait_while(
    transcript: &mut String,
    output_rx: &mpsc::Receiver<Vec<u8>>,
    writer: &mut impl Write,
    answered: &mut usize,
    mut ready: impl FnMut(&str) -> bool,
) -> bool {
    let deadline = Instant::now() + smoke_step_timeout();
    while Instant::now() < deadline {
        if ready(transcript) {
            return true;
        }
        if let Ok(bytes) = output_rx.recv_timeout(Duration::from_millis(200)) {
            let _ = ingest_pty_output(transcript, &bytes, answered, writer);
        }
    }
    ready(transcript)
}

#[test]
fn packaged_binary_opens_file_scans_and_shows_findings_in_a_pty() -> Result<(), Box<dyn Error>> {
    let binary = std::env::var_os("TRACEGLASS_SMOKE_BINARY")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_BIN_EXE_traceglass")));
    let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("samples/sample.log");
    // Short temp stem; collision note is painted before the path so deep
    // macOS /var/folders canonicalize() results cannot truncate it away.
    let export_dir = std::env::temp_dir().join(format!(
        "tg-pty-f-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_nanos()
    ));
    std::fs::create_dir_all(&export_dir)?;
    std::fs::write(export_dir.join("traceglass-findings.md"), "keep this file")?;
    // Skip the first-run walkthrough so keystrokes reach the viewer.
    let config_dir = export_dir.join("config");
    std::fs::create_dir_all(&config_dir)?;
    std::fs::write(config_dir.join("config"), "walkthrough=skipped\n")?;

    let pty = native_pty_system().openpty(PtySize {
        rows: 32,
        cols: 120,
        pixel_width: 0,
        pixel_height: 0,
    })?;
    let mut command = CommandBuilder::new(binary);
    command.arg(fixture);
    command.cwd(&export_dir);
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
    let mut answered_dsr = 0usize;

    // Open the viewer first. A completed scan with findings auto-opens the
    // findings panel (`finalize_scan`); do not press `s` on first paint — that
    // key toggles the panel closed and was the Windows flake (status already
    // showed "scan: N findings" while the panel title never appeared).
    assert!(
        wait_until_contains(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "sample.log"
        ),
        "file name was not rendered: {transcript}"
    );

    // Poll the PTY until the panel title appears (or the Windows-generous
    // ceiling elapses). Do not send `s`: finalize_scan already opens the panel,
    // and a late `s` closes it while leaving the "scan: N findings" status.
    assert!(
        wait_until_contains_ignore_ascii_case(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "scan findings"
        ),
        "findings panel was not rendered: {transcript}"
    );
    assert!(
        transcript.to_ascii_lowercase().contains("high")
            || transcript.to_ascii_lowercase().contains("medium")
            || transcript.to_ascii_lowercase().contains("critical"),
        "severity finding was not rendered: {transcript}"
    );

    // Wait for the selected finding's detail pane (provenance + evidence)
    // before exporting. Title + detail often share one ConPTY frame, so search
    // the full transcript rather than a short post-title overlap window.
    assert!(
        wait_until_contains(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "source: builtin"
        ),
        "finding evidence/provenance was not rendered: {transcript}"
    );
    assert!(
        wait_until_contains_ignore_ascii_case(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "evidence"
        ),
        "finding evidence/provenance was not rendered: {transcript}"
    );

    writer.write_all(b"e")?;
    writer.flush()?;
    assert!(
        wait_until_contains_ignore_ascii_case(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "kept the earlier"
        ),
        "collision-safe export feedback was not rendered: {transcript}"
    );
    writer.write_all(b"q")?;
    writer.flush()?;

    let _ = child.kill();
    // portable-pty children can ignore a late kill; never block the suite.
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let _ = child.wait();
        let _ = tx.send(());
    });
    let _ = rx.recv_timeout(Duration::from_secs(2));
    let export = std::fs::read_to_string(export_dir.join("traceglass-findings-2.md"))?;
    assert!(
        export.contains("**source:** `builtin`") || export.contains("source: builtin"),
        "export missing builtin provenance: {export}"
    );
    assert!(
        export.contains("false-positive"),
        "export missing false-positive note: {export}"
    );
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
        "tg-pty-w-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_nanos()
    ));
    std::fs::create_dir_all(&config_dir)?;
    // Skip the first-run walkthrough so keystrokes reach the viewer.
    std::fs::write(config_dir.join("config"), "walkthrough=skipped\n")?;

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
    let mut answered_dsr = 0usize;

    assert!(
        wait_for_needle(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "sample.log"
        ),
        "viewer did not open: {transcript}"
    );
    writer.write_all(b"a")?;
    writer.flush()?;
    assert!(
        wait_for_needle(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "Add keyword highlight to local watchlist"
        ),
        "viewer add prompt did not name the local watchlist: {transcript}"
    );
    writer.write_all(b"ERROR\r")?;
    writer.flush()?;
    assert!(
        // Status paints with cursor hops against the previous message, so the
        // full sentence may not be contiguous in the PTY transcript.
        wait_for_needle(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "local watchlist: ERROR"
        ),
        "viewer add status did not name the local watchlist: {transcript}"
    );
    writer.write_all(b"f")?;
    writer.flush()?;
    assert!(
        wait_for_needle(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "Failed to conn"
        ),
        "keyword match was not visible after filtering: {transcript}"
    );
    writer.write_all(b"W")?;
    writer.flush()?;
    assert!(
        wait_for_needle(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "Watchlist workspace"
        ),
        "workspace did not open: {transcript}"
    );
    // Painted in the same frame as the workspace chrome.
    assert!(
        transcript.contains("[keyword]"),
        "viewer-added keyword was not present in the local watchlist workspace: {transcript}"
    );
    // Workspace already has ERROR from the viewer add; a duplicate should be rejected.
    writer.write_all(b"aERROR\r")?;
    writer.flush()?;
    assert!(
        wait_for_needle(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "duplicates an earlier keyword"
        ),
        "duplicate keyword feedback was not rendered: {transcript}"
    );
    writer.write_all(b"r(\r")?;
    writer.flush()?;
    // Status paints with cursor hops, so "regex" may not be contiguous.
    assert!(
        wait_for_needle(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "invalid watchlist"
        ),
        "invalid regex feedback was not rendered: {transcript}"
    );
    writer.write_all(b"x")?;
    writer.flush()?;
    assert!(
        wait_for_needle(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "from local watchlist"
        ),
        "remove feedback was not rendered: {transcript}"
    );
    writer.write_all(b"aERROR\r")?;
    writer.flush()?;
    // Prefer "to local watchlist: ERROR" over the shared stem
    // "local watchlist: ERROR" (also appears in the prior remove status) and
    // over the full "added keyword…" sentence (status paints with cursor hops
    // that can split "added"). Matching too early lets `s` land while busy()
    // still drops non-cancel keys.
    assert!(
        wait_for_needle(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "to local watchlist: ERROR"
        ),
        "re-added entry did not finish: {transcript}"
    );
    writer.write_all(b"s")?;
    writer.flush()?;
    // Path in the status line can truncate the trailing filename; match the stem.
    assert!(
        wait_for_needle(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "watchlist saved"
        ),
        "save feedback was not rendered: {transcript}"
    );
    writer.write_all(b"qS")?;
    writer.flush()?;
    assert!(
        wait_for_needle(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "source: builtin"
        ),
        "built-in signature evidence was not rendered after saving the local watchlist: {transcript}"
    );
    writer.write_all(b"qW")?;
    writer.flush()?;
    assert!(
        wait_for_needle(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "Watchlist workspace"
        ),
        "workspace did not reopen: {transcript}"
    );
    writer.write_all(b"R")?;
    writer.flush()?;
    assert!(
        wait_for_needle(
            &mut transcript,
            &output_rx,
            &mut writer,
            &mut answered_dsr,
            "watchlist reloaded"
        ),
        "reload feedback was not rendered: {transcript}"
    );
    let persisted = std::fs::read_to_string(config_dir.join("watchlist.json"))?;
    assert!(persisted.contains("\"version\": 1"));
    assert!(persisted.contains("\"kind\": \"keyword\""));
    assert!(persisted.contains("\"value\": \"ERROR\""));
    assert!(!persisted.contains("source"));

    writer.write_all(b"qq")?;
    writer.flush()?;
    let _ = child.kill();
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let _ = child.wait();
        let _ = tx.send(());
    });
    let _ = rx.recv_timeout(Duration::from_secs(2));
    let _ = std::fs::remove_dir_all(config_dir);
    Ok(())
}
