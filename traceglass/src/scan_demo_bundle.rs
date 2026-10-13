//! Lock-in test for the planted-incident sample (vendored from draft PR #52).

#[cfg(test)]
mod tests {
    use crate::scan::{ScanSource, scan_findings};
    use std::path::PathBuf;

    fn demo_case_dir() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("samples/demo-bundle/case")
    }

    fn load_logs() -> Vec<ScanSource> {
        let root = demo_case_dir();
        let paths = [
            "app/api.log",
            "k8s/events.log",
            "edge/nginx-error.log",
            "db/postgres.log",
            "db/mysql.log",
            "system/journal.log",
        ];
        paths
            .into_iter()
            .map(|rel| {
                let path = root.join(rel);
                ScanSource {
                    name: rel.to_string(),
                    content: std::fs::read_to_string(&path)
                        .unwrap_or_else(|e| panic!("read {}: {e}", path.display())),
                }
            })
            .collect()
    }

    #[test]
    fn demo_bundle_surfaces_planted_incident_cascade_via_scan_api() {
        let findings = scan_findings(&load_logs(), "incident-reliability").expect("scan");
        assert!(
            findings.len() >= 10,
            "expected a multi-signal cascade, got {}",
            findings.len()
        );

        let ids: std::collections::BTreeSet<&str> =
            findings.iter().map(|f| f.signature_id.as_str()).collect();
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
        assert!(findings.iter().any(|f| f.severity == "critical"));
        assert!(findings.iter().any(|f| f.lens_id == "incident-reliability"));
    }
}
