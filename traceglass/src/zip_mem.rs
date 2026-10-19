//! In-memory zip → text sources for the WASM / browser path.
//!
//! Same safety budgets as [`crate::ingest`]'s on-disk extractor, but never
//! touches the filesystem — required for `wasm32` where temp dirs don't exist.

use std::io::{Cursor, Read};
use std::path::{Component, Path};

use anyhow::{Result, bail};
use zip::ZipArchive;

use crate::scan::ScanSource;

/// Mirror of ingest caps (keep in sync when those change).
const MAX_LOG_BYTES: u64 = 50 * 1024 * 1024;
const MAX_EXTRACT_FILE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_EXTRACT_TOTAL_BYTES: u64 = 512 * 1024 * 1024;
const MAX_EXTRACT_ENTRIES: usize = 10_000;
const MAX_ZIP_ARCHIVE_BYTES: u64 = 256 * 1024 * 1024;
const MAX_FILES_PER_RESOLVE: usize = 2_000;

/// Expand a zip byte buffer into named UTF-8 text sources ready for
/// [`crate::scan`]. Binary / empty / oversize members are skipped.
pub fn sources_from_zip_bytes(archive_bytes: &[u8]) -> Result<Vec<ScanSource>> {
    if archive_bytes.len() as u64 > MAX_ZIP_ARCHIVE_BYTES {
        bail!(
            "zip is larger than {} MB; refuse to open",
            MAX_ZIP_ARCHIVE_BYTES / (1024 * 1024)
        );
    }
    let mut archive = ZipArchive::new(Cursor::new(archive_bytes))
        .map_err(|e| anyhow::anyhow!("not a valid zip archive: {e}"))?;

    let mut sources = Vec::new();
    let mut total_read: u64 = 0;
    let entry_count = archive.len().min(MAX_EXTRACT_ENTRIES);

    for i in 0..entry_count {
        if sources.len() >= MAX_FILES_PER_RESOLVE {
            break;
        }
        let mut zf = match archive.by_index(i) {
            Ok(zf) => zf,
            Err(_) => continue,
        };
        if zf.is_dir() {
            continue;
        }
        // Mirror on-disk ingest: never treat symlink members as text sources.
        if zf.is_symlink() {
            continue;
        }
        if zf.size() > MAX_EXTRACT_FILE_BYTES {
            continue;
        }
        if total_read >= MAX_EXTRACT_TOTAL_BYTES {
            break;
        }

        // zip 9.x: mangled_name returns Result.
        let Ok(mangled) = zf.mangled_name() else {
            continue;
        };
        if !safe_zip_member_path(&mangled) {
            continue;
        }
        let name = mangled.to_string_lossy().replace('\\', "/");
        if name.is_empty() || name.split('/').any(|p| p.starts_with('.')) {
            continue;
        }

        let budget = MAX_EXTRACT_FILE_BYTES
            .min(MAX_LOG_BYTES)
            .min(MAX_EXTRACT_TOTAL_BYTES - total_read);
        let mut buf = Vec::new();
        let mut limited = (&mut zf).take(budget + 1);
        if limited.read_to_end(&mut buf).is_err() {
            continue;
        }
        if buf.len() as u64 > budget || buf.is_empty() {
            continue;
        }
        // Binary heuristic: NUL in the first chunk → skip (same idea as ingest).
        let probe = &buf[..buf.len().min(8192)];
        if probe.contains(&0) {
            continue;
        }

        total_read += buf.len() as u64;
        let content = String::from_utf8_lossy(&buf).into_owned();
        sources.push(ScanSource { name, content });
    }

    sources.sort_by_key(|a| a.name.to_lowercase());
    if sources.is_empty() {
        bail!("no readable text sources found in zip");
    }
    Ok(sources)
}

fn safe_zip_member_path(path: &Path) -> bool {
    if path.is_absolute() {
        return false;
    }
    for component in path.components() {
        match component {
            Component::Normal(_) => {}
            Component::CurDir => {}
            _ => return false, // Prefix / RootDir / ParentDir
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn tiny_zip(entries: &[(&str, &[u8])]) -> Vec<u8> {
        let mut cursor = Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut cursor);
            let opts = zip::write::SimpleFileOptions::default();
            for (name, body) in entries {
                zip.start_file(*name, opts).unwrap();
                zip.write_all(body).unwrap();
            }
            zip.finish().unwrap();
        }
        cursor.into_inner()
    }

    #[test]
    fn extracts_text_and_skips_binary() {
        let bytes = tiny_zip(&[
            ("app/api.log", b"FATAL unhandled exception\n"),
            ("bin/thumb.bin", b"hello\0world"),
            ("readme.txt", b"notes\n"),
        ]);
        let sources = sources_from_zip_bytes(&bytes).unwrap();
        let names: Vec<_> = sources.iter().map(|s| s.name.as_str()).collect();
        assert_eq!(names, ["app/api.log", "readme.txt"]);
        assert!(sources[0].content.contains("FATAL"));
    }

    #[test]
    fn zip_slip_parent_segments_are_mangled_not_traversed() {
        // `ZipFile::mangled_name` strips `..`; we additionally reject any
        // remaining non-Normal components. The hostile member must never keep
        // a `../` prefix in the emitted source name.
        let bytes = tiny_zip(&[("../escape.log", b"FATAL boom\n"), ("ok.log", b"ok\n")]);
        let sources = sources_from_zip_bytes(&bytes).unwrap();
        assert!(sources.iter().any(|s| s.name == "ok.log"));
        for source in &sources {
            assert!(
                !source.name.contains(".."),
                "zip-slip name leaked: {}",
                source.name
            );
        }
    }

    #[test]
    fn symlink_entries_are_skipped() {
        let mut cursor = Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut cursor);
            let opts = zip::write::SimpleFileOptions::default();
            zip.start_file("ok.log", opts).unwrap();
            zip.write_all(b"FATAL boom\n").unwrap();
            zip.add_symlink("evil.link", "/etc/passwd", opts).unwrap();
            zip.finish().unwrap();
        }
        let bytes = cursor.into_inner();
        let sources = sources_from_zip_bytes(&bytes).unwrap();
        assert_eq!(sources.len(), 1);
        assert_eq!(sources[0].name, "ok.log");
    }
}
