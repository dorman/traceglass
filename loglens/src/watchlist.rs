//! Persistent, local watchlists for the interactive TUI.
//!
//! The watchlist is deliberately a small versioned document. It is not the
//! same format as the unrelated Node CLI watchlist: the TUI only persists the
//! ordered keyword/regex rules a user can edit in the workspace.

use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};

use crate::config;
use crate::rules::{self, MAX_REGEX_PATTERN_LEN, MAX_RULES, Rule};
use crate::theme::Theme;

pub const VERSION: u32 = 1;
pub const FILE_NAME: &str = "watchlist.json";

/// One user-owned highlight entry, preserving its kind and array order.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WatchlistEntry {
    pub kind: EntryKind,
    pub value: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum EntryKind {
    Keyword,
    Regex,
}

impl EntryKind {
    pub fn label(self) -> &'static str {
        match self {
            Self::Keyword => "keyword",
            Self::Regex => "regex",
        }
    }
}

/// A validated version-1 watchlist document.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Watchlist {
    pub entries: Vec<WatchlistEntry>,
}

impl Watchlist {
    pub fn empty() -> Self {
        Self { entries: Vec::new() }
    }

    /// Build the in-memory document from active rules. CLI rules predate the
    /// workspace and historically accepted duplicates, so validation happens
    /// when the user edits or saves this derived list.
    pub fn from_rules(rules: &[Rule]) -> Self {
        Self {
            entries: rules
                .iter()
                .map(|rule| WatchlistEntry {
                    kind: if rule.is_regex {
                        EntryKind::Regex
                    } else {
                        EntryKind::Keyword
                    },
                    value: rule.label.clone(),
                })
                .collect(),
        }
    }

    /// Validate and normalize a complete replacement document before it is
    /// installed into the active TUI state.
    pub fn validate(entries: Vec<WatchlistEntry>, ignore_case: bool) -> Result<Self> {
        if entries.len() > MAX_RULES {
            bail!("watchlist has too many entries (max {MAX_RULES})");
        }

        let mut seen = HashSet::with_capacity(entries.len());
        let mut normalized = Vec::with_capacity(entries.len());
        for (index, entry) in entries.into_iter().enumerate() {
            let value = entry.value.trim().to_string();
            if value.is_empty() {
                bail!(
                    "watchlist entry {} has an empty {} value",
                    index + 1,
                    entry.kind.label()
                );
            }
            if entry.kind == EntryKind::Regex && value.len() > MAX_REGEX_PATTERN_LEN {
                bail!(
                    "watchlist entry {} regex is too long (max {MAX_REGEX_PATTERN_LEN} bytes)",
                    index + 1
                );
            }

            // Duplicate identity follows the active matching case policy. A
            // keyword and regex remain distinct because they have different
            // matching semantics even when their text is equal.
            let identity_value = if ignore_case {
                value.to_lowercase()
            } else {
                value.clone()
            };
            let identity = (entry.kind, identity_value);
            if !seen.insert(identity) {
                bail!(
                    "watchlist entry {} duplicates an earlier {} '{}', with ignore-case {}",
                    index + 1,
                    entry.kind.label(),
                    value,
                    if ignore_case { "enabled" } else { "disabled" }
                );
            }

            // This is the single matcher/compiler path used by the viewer.
            rules::compile_rule(
                &value,
                entry.kind == EntryKind::Regex,
                ignore_case,
                index,
                &Theme::dark(),
            )
            .with_context(|| {
                format!(
                    "invalid watchlist {} at entry {}",
                    entry.kind.label(),
                    index + 1
                )
            })?;
            normalized.push(WatchlistEntry {
                kind: entry.kind,
                value,
            });
        }
        Ok(Self { entries: normalized })
    }

    pub fn with_added(
        &self,
        kind: EntryKind,
        value: impl Into<String>,
        ignore_case: bool,
    ) -> Result<Self> {
        let mut entries = self.entries.clone();
        entries.push(WatchlistEntry {
            kind,
            value: value.into(),
        });
        Self::validate(entries, ignore_case)
    }

    pub fn without(&self, index: usize, ignore_case: bool) -> Result<(Self, WatchlistEntry)> {
        if index >= self.entries.len() {
            bail!("watchlist selection is no longer available");
        }
        let mut entries = self.entries.clone();
        let removed = entries.remove(index);
        Ok((Self::validate(entries, ignore_case)?, removed))
    }

    /// Compile the validated document into the app's normal highlight rules.
    pub fn to_rules(&self, ignore_case: bool, theme: &Theme) -> Result<Vec<Rule>> {
        self.entries
            .iter()
            .enumerate()
            .map(|(index, entry)| {
                rules::compile_rule(
                    &entry.value,
                    entry.kind == EntryKind::Regex,
                    ignore_case,
                    index,
                    theme,
                )
            })
            .collect()
    }

    fn to_json(&self) -> Result<String> {
        let document = Document {
            version: VERSION,
            entries: self
                .entries
                .iter()
                .map(|entry| RawEntry {
                    kind: entry.kind.label().to_string(),
                    value: entry.value.clone(),
                })
                .collect(),
        };
        Ok(serde_json::to_string_pretty(&document)? + "\n")
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct DocumentInput {
    version: u32,
    entries: Vec<RawEntry>,
}

#[derive(Debug, Serialize)]
struct Document {
    version: u32,
    entries: Vec<RawEntry>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct RawEntry {
    kind: String,
    value: String,
}

fn parse(text: &str, ignore_case: bool) -> Result<Watchlist> {
    let document: DocumentInput =
        serde_json::from_str(text).context("malformed watchlist JSON")?;
    if document.version != VERSION {
        bail!(
            "unsupported watchlist version {} (expected {})",
            document.version,
            VERSION
        );
    }
    let entries = document
        .entries
        .into_iter()
        .map(|raw| {
            let kind = match raw.kind.as_str() {
                "keyword" => EntryKind::Keyword,
                "regex" => EntryKind::Regex,
                other => return Err(anyhow::anyhow!("unknown watchlist entry kind '{other}'")),
            };
            Ok(WatchlistEntry {
                kind,
                value: raw.value,
            })
        })
        .collect::<Result<Vec<_>>>()?;
    Watchlist::validate(entries, ignore_case)
}

pub fn path() -> Option<PathBuf> {
    config::config_dir().map(|dir| dir.join(FILE_NAME))
}

/// Load the saved watchlist. A missing file is the normal first-run default;
/// every other read/parse/validation error is returned to the caller.
pub fn load(ignore_case: bool) -> Result<Option<Watchlist>> {
    let Some(path) = path() else {
        return Ok(None);
    };
    match fs::read_to_string(&path) {
        Ok(text) => parse(&text, ignore_case)
            .map(Some)
            .with_context(|| format!("could not load watchlist '{}'", path.display())),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error)
            .with_context(|| format!("could not read watchlist '{}'", path.display())),
    }
}

pub fn save(list: &Watchlist, ignore_case: bool) -> Result<PathBuf> {
    let Some(path) = path() else {
        bail!("cannot save watchlist: no config directory (set HOME or LOGLENS_CONFIG_DIR)");
    };
    save_to(&path, list, ignore_case)?;
    Ok(path)
}

/// Testable persistence seam. The document is validated again immediately
/// before writing, then a complete same-directory temporary file is renamed
/// over the target. The prior target is never touched when serialization or
/// writing the temporary file fails.
pub fn save_to(path: &Path, list: &Watchlist, ignore_case: bool) -> Result<()> {
    let validated = Watchlist::validate(list.entries.clone(), ignore_case)?;
    let body = validated.to_json()?;
    let dir = path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("watchlist path has no parent directory"))?;
    fs::create_dir_all(dir)
        .with_context(|| format!("could not create watchlist directory '{}'", dir.display()))?;

    let mut temp_path = None;
    let mut temp_file = None;
    for attempt in 0..100u32 {
        let candidate = dir.join(format!(
            ".{FILE_NAME}.{}.{}.tmp",
            std::process::id(),
            attempt
        ));
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&candidate)
        {
            Ok(file) => {
                temp_path = Some(candidate);
                temp_file = Some(file);
                break;
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(error).context("could not create watchlist temporary file");
            }
        }
    }
    let temp_path = temp_path
        .ok_or_else(|| anyhow::anyhow!("could not reserve a watchlist temporary file"))?;
    let mut file = temp_file.expect("temporary file exists with its path");
    let write_result = (|| -> Result<()> {
        file.write_all(body.as_bytes())
            .context("could not write watchlist temporary file")?;
        file.sync_all()
            .context("could not flush watchlist temporary file")?;
        Ok(())
    })();
    drop(file);
    if let Err(error) = write_result {
        let _ = fs::remove_file(&temp_path);
        return Err(error);
    }

    let rename_result = replace_file(&temp_path, path);
    if rename_result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    rename_result.with_context(|| format!("could not replace watchlist '{}'", path.display()))
}

fn replace_file(temp: &Path, target: &Path) -> std::io::Result<()> {
    #[cfg(windows)]
    {
        // Windows does not replace an existing file with rename. The temp
        // file is already complete and durable before this replacement
        // window begins, so an I/O failure cannot leave partial JSON.
        if target.exists() {
            fs::remove_file(target)?;
        }
    }
    fs::rename(temp, target)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ENV_LOCK;

    fn entry(kind: EntryKind, value: &str) -> WatchlistEntry {
        WatchlistEntry {
            kind,
            value: value.into(),
        }
    }

    fn temp_path(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "loglens-watchlist-{label}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("clock after epoch")
                .as_nanos()
        ))
    }

    #[test]
    fn canonical_round_trip_preserves_order_and_types() {
        let list = Watchlist::validate(
            vec![
                entry(EntryKind::Keyword, " ERROR "),
                entry(EntryKind::Regex, r"timeout\s+\d+"),
            ],
            false,
        )
        .unwrap();
        let path = temp_path("roundtrip").join(FILE_NAME);
        save_to(&path, &list, false).unwrap();
        let loaded = parse(&fs::read_to_string(&path).unwrap(), false).unwrap();
        assert_eq!(loaded, list);
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&fs::read_to_string(&path).unwrap()).unwrap()
                ["version"],
            1
        );
        let _ = fs::remove_dir_all(path.parent().unwrap());
    }

    #[test]
    fn rejects_malformed_unknown_duplicate_empty_and_invalid_entries() {
        for (text, expected) in [
            (
                r#"{"version":2,"entries":[]}"#,
                "unsupported watchlist version",
            ),
            (
                r#"{"version":1,"entries":[{"kind":"other","value":"x"}]}"#,
                "unknown watchlist entry kind",
            ),
            (
                r#"{"version":1,"entries":[{"kind":"keyword","value":"  "}]}"#,
                "empty keyword",
            ),
            (
                r#"{"version":1,"entries":[{"kind":"regex","value":"("}]}"#,
                "invalid watchlist regex",
            ),
            (
                r#"{"version":1,"entries":[{"kind":"keyword","value":"x"},{"kind":"keyword","value":"x"}]}"#,
                "duplicates",
            ),
            (
                r#"{"version":1,"entries":[],"extra":true}"#,
                "unknown field",
            ),
        ] {
            let error = parse(text, false).unwrap_err().to_string();
            assert!(
                error.contains(expected),
                "{error} does not contain {expected}"
            );
        }
        let error = parse(r#"not json"#, false).unwrap_err().to_string();
        assert!(error.contains("malformed watchlist JSON"), "{error}");
    }

    #[test]
    fn duplicate_policy_is_kind_aware_and_case_aware() {
        let mixed = Watchlist::validate(
            vec![
                entry(EntryKind::Keyword, "Error"),
                entry(EntryKind::Regex, "error"),
            ],
            true,
        )
        .unwrap();
        assert_eq!(mixed.entries.len(), 2);
        let error = Watchlist::validate(
            vec![
                entry(EntryKind::Keyword, "Error"),
                entry(EntryKind::Keyword, " error "),
            ],
            true,
        )
        .unwrap_err()
        .to_string();
        assert!(error.contains("ignore-case enabled"), "{error}");
    }

    #[test]
    fn replacement_is_complete_before_target_changes() {
        let dir = temp_path("replacement");
        let path = dir.join(FILE_NAME);
        let old = Watchlist::validate(vec![entry(EntryKind::Keyword, "old")], false).unwrap();
        save_to(&path, &old, false).unwrap();
        let new = Watchlist::validate(vec![entry(EntryKind::Keyword, "new")], false).unwrap();
        save_to(&path, &new, false).unwrap();
        let loaded = parse(&fs::read_to_string(&path).unwrap(), false).unwrap();
        assert_eq!(loaded.entries[0].value, "new");
        let _ = fs::remove_dir_all(dir);

        let bad_parent = temp_path("bad-target");
        fs::create_dir_all(&bad_parent).unwrap();
        let bad_target = bad_parent.join("target-dir");
        fs::create_dir_all(&bad_target).unwrap();
        let error = save_to(&bad_target, &old, false).unwrap_err().to_string();
        assert!(error.contains("could not replace watchlist"), "{error}");
        let _ = fs::remove_dir_all(bad_parent);
    }

    #[test]
    fn env_path_missing_is_a_default() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let dir = temp_path("missing");
        unsafe { std::env::set_var("LOGLENS_CONFIG_DIR", &dir) };
        assert!(load(false).unwrap().is_none());
        unsafe { std::env::remove_var("LOGLENS_CONFIG_DIR") };
        let _ = fs::remove_dir_all(dir);
    }
}
