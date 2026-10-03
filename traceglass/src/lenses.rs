//! Versioned, deterministic review lenses shared by the Rust CLI and TUI.
//!
//! A lens is deliberately an ordering/grouping layer over the reviewed
//! signature library. It never owns match expressions and never filters a
//! finding out of the evidence set.

use anyhow::{Result, bail};
use serde::Deserialize;

const CATALOG_JSON: &str = include_str!("../lenses/v0.1.0/catalog.json");
pub const CATALOG_VERSION: &str = "v0.1.0";

#[derive(Clone, Debug, Deserialize)]
pub struct Catalog {
    pub catalog: String,
    pub version: String,
    pub title: String,
    pub description: String,
    pub lenses: Vec<LensDefinition>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct LensDefinition {
    pub id: String,
    pub title: String,
    pub description: String,
    pub groups: Vec<LensGroup>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct LensGroup {
    pub id: String,
    pub title: String,
    pub description: String,
    pub priority: u32,
    pub references: Vec<LensReference>,
    #[serde(default)]
    pub fallback: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Hash)]
pub struct LensReference {
    pub source: String,
    pub id: String,
}

#[derive(Clone, Debug)]
pub struct Selection {
    catalog: Catalog,
    lens_index: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Placement {
    pub group: String,
    pub group_title: String,
    pub priority: u32,
    pub group_order: usize,
}

pub fn catalog() -> Result<Catalog> {
    let parsed: Catalog = serde_json::from_str(CATALOG_JSON)?;
    validate(&parsed)?;
    Ok(parsed)
}

fn valid_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 63
        && value.as_bytes()[0].is_ascii_lowercase()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

fn known_reference(reference: &LensReference) -> bool {
    match reference.source.as_str() {
        "rust_builtin" => [
            "tamper-protection-disabled",
            "powershell-encoded-command",
            "process-injection-hollowing",
            "lolbin-execution",
            "system-clock-rollback",
            "certificate-validation-failure",
            "signature-database-corrupt",
            "fatal-error-crash",
            "resource-exhaustion",
            "connection-refused-reset",
            "update-failure",
            "installer-rollback",
            "access-denied-unauthorized",
            "container-runtime-failure",
            "kubernetes-workload-failure",
            "systemd-unit-failure",
            "nginx-upstream-failure",
            "mysql-storage-concurrency-failure",
            "postgresql-connection-transaction-failure",
            "windows-event-audit-service-failure",
            "edr-alert",
            "splunk-search-indexer-failure",
            "diagnostic-assertion-traceback",
        ]
        .contains(&reference.id.as_str()),
        "json_manifest" => [
            "docker-container-non-zero-exit",
            "docker-container-out-of-memory",
            "docker-container-oci-exec-failed",
            "docker-container-go-panic",
            "docker-container-restarting",
            "nginx-5xx-response",
            "nginx-upstream-connect-timeout",
            "nginx-permission-denied",
            "nginx-client-disconnected",
            "postgres-statement-timeout",
            "postgres-connection-timeout",
            "postgres-too-many-connections",
            "postgres-deadlock",
            "postgres-lock-timeout",
            "av-threat-detected",
            "crowdstrike-detection",
            "sentinelone-incident",
            "defender-remediation",
            "av-signatures-updated",
            "splunk-search-peer-failure",
            "splunk-search-timeout",
            "splunk-search-bundle-init",
            "splunk-license-violation",
            "windows-failed-logon",
            "windows-audit-log-cleared",
            "windows-service-installed",
            "windows-system-time-changed",
        ]
        .contains(&reference.id.as_str()),
        _ => false,
    }
}

pub fn validate(catalog: &Catalog) -> Result<()> {
    if catalog.catalog != "logsift-lenses" || catalog.version != CATALOG_VERSION {
        bail!(
            "unsupported lens catalog {}/{}",
            catalog.catalog,
            catalog.version
        );
    }
    if catalog.title.trim().is_empty() || catalog.description.trim().is_empty() {
        bail!("lens catalog title and description are required");
    }
    let mut lens_ids = std::collections::HashSet::new();
    for lens in &catalog.lenses {
        if !valid_id(&lens.id) || lens.title.trim().is_empty() || lens.description.trim().is_empty()
        {
            bail!("invalid lens metadata for {}", lens.id);
        }
        if !lens_ids.insert(&lens.id) {
            bail!("duplicate lens id {}", lens.id);
        }
        let mut group_ids = std::collections::HashSet::new();
        let mut refs = std::collections::HashSet::new();
        let mut previous_priority = 0;
        let mut fallback_count = 0;
        for (index, group) in lens.groups.iter().enumerate() {
            if !valid_id(&group.id)
                || group.title.trim().is_empty()
                || group.description.trim().is_empty()
            {
                bail!("invalid group metadata for {}/{}", lens.id, group.id);
            }
            if !group_ids.insert(&group.id) {
                bail!("duplicate group id {}/{}", lens.id, group.id);
            }
            if index > 0 && group.priority < previous_priority {
                bail!("group priorities are not stable in {}", lens.id);
            }
            previous_priority = group.priority;
            if group.fallback {
                fallback_count += 1;
            }
            for reference in &group.references {
                if !known_reference(reference) {
                    bail!(
                        "unknown lens reference {}:{}",
                        reference.source,
                        reference.id
                    );
                }
                if !refs.insert(reference) {
                    bail!(
                        "duplicate lens reference {}:{} in {}",
                        reference.source,
                        reference.id,
                        lens.id
                    );
                }
            }
        }
        if fallback_count != 1 {
            bail!("lens {} must have exactly one fallback group", lens.id);
        }
    }
    Ok(())
}

impl Selection {
    pub fn default() -> Result<Self> {
        Self::from_id("general-triage")
    }

    pub fn from_id(id: &str) -> Result<Self> {
        let catalog = catalog()?;
        let Some(lens_index) = catalog.lenses.iter().position(|lens| lens.id == id) else {
            bail!(
                "unknown lens '{id}' (choose general-triage, incident-reliability, or security-signals)"
            );
        };
        Ok(Self {
            catalog,
            lens_index,
        })
    }

    pub fn available() -> Result<Vec<(String, String)>> {
        Ok(catalog()?
            .lenses
            .into_iter()
            .map(|lens| (lens.id, lens.title))
            .collect())
    }

    pub fn id(&self) -> &str {
        &self.catalog.lenses[self.lens_index].id
    }

    pub fn title(&self) -> &str {
        &self.catalog.lenses[self.lens_index].title
    }

    pub fn version(&self) -> &str {
        &self.catalog.version
    }

    pub fn lens(&self) -> &LensDefinition {
        &self.catalog.lenses[self.lens_index]
    }

    pub fn placement(&self, source: &str, id: &str) -> Placement {
        let lens = self.lens();
        lens.groups
            .iter()
            .enumerate()
            .find(|(_, group)| {
                group
                    .references
                    .iter()
                    .any(|reference| reference.source == source && reference.id == id)
            })
            .or_else(|| {
                lens.groups
                    .iter()
                    .enumerate()
                    .find(|(_, group)| group.fallback)
            })
            .map(|(group_order, group)| Placement {
                group: group.id.clone(),
                group_title: group.title.clone(),
                priority: group.priority,
                group_order,
            })
            .expect("validated lens catalog always has a fallback group")
    }

    pub fn catalog(&self) -> &Catalog {
        &self.catalog
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shipped_catalog_validates_and_exposes_three_lenses() {
        let catalog = catalog().unwrap();
        assert_eq!(catalog.lenses.len(), 3);
        assert_eq!(
            Selection::from_id("security-signals").unwrap().version(),
            "v0.1.0"
        );
    }

    #[test]
    fn unknown_evidence_uses_explicit_fallback_group() {
        let selection = Selection::from_id("security-signals").unwrap();
        let placement = selection.placement("legacy_external", "future-signal");
        assert_eq!(placement.group, "other-evidence");
    }
}
