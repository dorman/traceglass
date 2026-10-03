use ratatui::style::Color;
use regex::RegexSet;
use serde::Serialize;

use crate::rules;

/// Severity of a scan finding, ordered low → high so `max`/sort work directly.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub enum Severity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

impl Severity {
    pub fn label(self) -> &'static str {
        match self {
            Severity::Critical => "CRIT",
            Severity::High => "HIGH",
            Severity::Medium => "MED",
            Severity::Low => "LOW",
            Severity::Info => "INFO",
        }
    }

    pub fn color(self) -> Color {
        match self {
            Severity::Critical => Color::Rgb(0xFF, 0x55, 0x55),
            Severity::High => Color::Rgb(0xE8, 0x8B, 0x3D),
            Severity::Medium => Color::Rgb(0xE5, 0xC0, 0x7B),
            Severity::Low => Color::Rgb(0x61, 0xAF, 0xEF),
            Severity::Info => Color::Rgb(0x7C, 0x83, 0x94),
        }
    }
}

/// Provenance vocabulary shared by Rust findings and the JSON/Node catalog.
/// Rust built-ins are deliberately a separate runtime catalog from the JSON
/// manifests, so their catalog name and version make that distinction explicit.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub struct SignatureProvenance {
    pub source: &'static str,
    pub catalog: &'static str,
    pub version: &'static str,
    pub set: &'static str,
    pub pattern: &'static str,
}

/// What a detection means: stable identity, severity rationale, and the
/// plain-English explanation shown in the findings panel. The pattern itself
/// lives in the [`Library`]'s `RegexSet`.
pub struct Signature {
    pub id: &'static str,
    pub severity: Severity,
    pub category: &'static str,
    pub title: &'static str,
    pub explain: &'static str,
    pub severity_rationale: &'static str,
    pub false_positive_note: &'static str,
    pub provenance: SignatureProvenance,
}

/// The built-in detection library: signature metadata plus a single [`RegexSet`]
/// holding every pattern.
///
/// The set is the only compiled form of the patterns, so it cannot drift out of
/// step with the metadata, and [`Library::matches`] tests a line against all
/// signatures in one pass instead of running each regex separately.
pub struct Library {
    signatures: Vec<Signature>,
    set: RegexSet,
}

impl Library {
    /// Build the built-in library. Panics on a malformed built-in pattern —
    /// that is a bug in this file, not something a user can trigger.
    pub fn builtin() -> Self {
        let (signatures, patterns) = builtin_defs();
        let set = rules::compile_regex_set(&patterns)
            .unwrap_or_else(|e| panic!("invalid built-in signature set: {e}"));
        debug_assert_eq!(signatures.len(), set.len());
        Self { signatures, set }
    }

    /// Indices of every signature matching `line`, ascending.
    pub fn matches<'a>(&'a self, line: &str) -> impl Iterator<Item = usize> + 'a {
        self.set.matches(line).into_iter()
    }

    /// How many signatures the library holds. Callers size per-signature
    /// bookkeeping with this, so it must stay in step with the match indices
    /// [`Self::matches`] yields.
    pub fn signature_count(&self) -> usize {
        self.signatures.len()
    }
}

/// Lets existing `signatures[finding.sig]` call sites keep working.
impl std::ops::Index<usize> for Library {
    type Output = Signature;

    fn index(&self, i: usize) -> &Signature {
        &self.signatures[i]
    }
}

/// The built-in detection library. Curated for general logs plus the kinds of
/// signals that show up in endpoint/anti-virus diagnostic bundles. All patterns
/// are case-insensitive.
///
/// Returns metadata and patterns as parallel lists, in the order the `RegexSet`
/// will report match indices.
fn builtin_defs() -> (Vec<Signature>, Vec<&'static str>) {
    use Severity::*;
    // (severity, category, title, explanation, pattern)
    const DEFS: &[(Severity, &str, &str, &str, &str)] = &[
        (
            Critical,
            "tamper",
            "Security protection disabled/tampered",
            "Real-time protection or the AV service was disabled or tampered with — investigate whether this was user, policy, or malware driven.",
            r"(?i)\b(tamper|disabl(e|ed|ing)|turn(ed)? off|bypass(ed)?)\b.{0,20}\b(real[- ]?time|protection|defender|antivirus|self[- ]?protection|security)\b",
        ),
        (
            High,
            "suspicious",
            "Encoded PowerShell command",
            "PowerShell invoked with an encoded/hidden command — a very common malware and living-off-the-land technique.",
            r"(?i)powershell(\.exe)?\b.{0,60}(-enc(odedcommand)?|-e\b|frombase64string|-nop|-w\s*hidden)",
        ),
        (
            High,
            "suspicious",
            "Process injection / hollowing",
            "Log mentions injection into another process — often used to run code under a trusted process like explorer.exe.",
            r"(?i)\b(inject(ion|ed|ing)?|hollow(ing)?|reflective load)\b.{0,30}\b(process|explorer|memory|thread|dll)\b",
        ),
        (
            Medium,
            "suspicious",
            "Living-off-the-land binary",
            "A commonly-abused system binary was executed — legitimate at times, but frequently used by attackers to blend in.",
            r"(?i)\b(mshta|rundll32|regsvr32|certutil|bitsadmin|wscript|cscript|wmic|schtasks)\.exe\b",
        ),
        (
            High,
            "integrity",
            "Clock / time rollback detected",
            "System clock manipulation — can indicate license tampering or an attempt to evade time-based checks.",
            r"(?i)\b(clock|system time|time)\b.{0,20}\b(roll ?back|tamper|manipulat|set back)\b|rollback detected on system clock",
        ),
        (
            High,
            "integrity",
            "Certificate validation failure",
            "A TLS/code-signing certificate failed to validate — the update/comms channel may be misconfigured or intercepted.",
            r"(?i)cert(ificate)?\b.{0,20}(valid\w*\s+fail|invalid|untrusted|revoked|expired|verification failed)",
        ),
        (
            High,
            "integrity",
            "Signature/definition database corrupt",
            "The AV signature/definition database is corrupt or failed to load — protection may be degraded until repaired.",
            r"(?i)\b(signature|definition|virus def\w*)\b.{0,20}\b(corrupt|invalid|failed|missing|damaged)\b",
        ),
        (
            Critical,
            "crash",
            "Fatal error / crash",
            "A fatal error, crash, or unhandled exception occurred — the component likely stopped functioning.",
            r"(?i)\b(fatal|unhandled exception|access violation|segfault|segmentation fault|kernel panic|stack ?trace|core dumped|crash(ed)?)\b",
        ),
        (
            High,
            "resource",
            "Resource exhaustion",
            "The system ran out of a critical resource (memory/disk/handles) — a frequent root cause of cascading failures.",
            r"(?i)(out of memory|oom\b|disk full|no space left|insufficient (memory|disk)|handle leak|i/o error)",
        ),
        (
            Medium,
            "network",
            "Connection refused / reset",
            "A network connection was refused or reset — check connectivity to update/telemetry endpoints.",
            r"(?i)connection\s+(refused|reset|timed? ?out|aborted)",
        ),
        (
            Medium,
            "update",
            "Update failure",
            "A product/signature update failed — the client may be running with stale protection.",
            r"(?i)\b(update|upgrade)\b.{0,30}\b(fail(ed|ure)?|error|timeout|refused|could not)\b",
        ),
        (
            Medium,
            "install",
            "Installer rollback",
            "An installation rolled back (e.g. MSI error 1603) — the install/repair did not complete successfully.",
            r"(?i)(rollback|rolling back)\b|error\s*1603|msi.{0,20}(fail|abort)",
        ),
        (
            Medium,
            "access",
            "Access denied / unauthorized",
            "A permission or authorization check failed — may block the product from operating correctly.",
            r"(?i)(access denied|permission denied|unauthorized|0x80070005|e_accessdenied)",
        ),
        (
            High,
            "container",
            "Container startup or runtime failure",
            "A container runtime could not start, create, or keep a container running.",
            r"(?i)(oci runtime|failed to create shim|containerd.{0,30}(failed|error)|container.{0,25}(exited|failed|restart loop))",
        ),
        (
            High,
            "kubernetes",
            "Kubernetes workload restart or image failure",
            "Kubernetes reports a failed workload restart, image pull, probe, or out-of-memory termination.",
            r"(?i)(CrashLoopBackOff|ImagePullBackOff|OOMKilled|Back-off restarting failed container|readiness probe failed|liveness probe failed)",
        ),
        (
            Medium,
            "systemd",
            "systemd unit failed to start",
            "systemd or journal output reports a unit start or service failure.",
            r"(?i)(systemd|journal).{0,40}(failed|failure|error)|failed to start [a-z0-9_.@-]+\.service",
        ),
        (
            High,
            "nginx",
            "nginx upstream or request failure",
            "nginx could not reach an upstream or rejected a request because the upstream path failed.",
            r"(?i)(upstream timed out|no live upstreams|connect\(\) failed|client intended to send too large body)",
        ),
        (
            High,
            "mysql",
            "MySQL storage or concurrency failure",
            "MySQL reports a deadlock, crashed table, unavailable connection capacity, or InnoDB failure.",
            r"(?i)(InnoDB:.{0,30}(error|failed)|deadlock found when trying to get lock|too many connections|table .* marked as crashed)",
        ),
        (
            High,
            "postgresql",
            "PostgreSQL connection or transaction failure",
            "PostgreSQL reports a fatal connection, deadlock, or unavailable database condition.",
            r"(?i)(FATAL:\s*(database|password|connection)|could not connect to server|deadlock detected|terminating connection due to administrator command)",
        ),
        (
            Medium,
            "windows-event",
            "Windows Event Log audit or service failure",
            "Windows Event output records an audit failure, service failure, or a related system event requiring review.",
            r"(?i)(EventID|Event ID).{0,12}(failed|failure|7031|7034|4625|1102)|Audit Failure|The service terminated unexpectedly",
        ),
        (
            High,
            "edr",
            "Endpoint detection or response alert",
            "An antivirus or EDR report contains a detection, quarantine, isolation, or remediation signal.",
            r"(?i)\b(EDR|antivirus|endpoint protection)\b.{0,40}\b(detect(ed|ion)?|quarantin(e|ed)|isolat(ed|ion)|remediat(ed|ion))\b",
        ),
        (
            High,
            "splunk",
            "Splunk search or indexer failure",
            "Splunk reports an unavailable search peer, failed dispatch, or indexer problem.",
            r"(?i)\b(splunkd|search peer|indexer|dispatch)\b.{0,40}\b(fail(ed|ure)?|down|unavailable|timeout|license violation)\b",
        ),
        (
            Medium,
            "diagnostic",
            "Diagnostic assertion or traceback",
            "A diagnostic report contains an assertion, panic, traceback, or exception marker that merits human review.",
            r"(?i)(assertion failed|panic:\s|traceback \(most recent call last\)|unhandled exception)",
        ),
        // Deliberately omit catch-all "error" / "warn" signatures: they flood
        // real logs, burn the findings cap, and bury Medium+ triage signals.
        // Use keyword highlights (`a` / `-k ERROR,WARN`) for that volume instead.
    ];

    // This is the audit ledger for the 23 built-ins. Keep IDs immutable even
    // when a title or explanation is improved. The positive/negative examples
    // live with the regression table below so they can exercise matching.
    const AUDIT: &[(&str, &str, &str)] = &[
        (
            "tamper-protection-disabled",
            "Critical because protection tampering can indicate a security control was deliberately weakened.",
            "Administrative policy changes and maintenance can intentionally disable protection.",
        ),
        (
            "powershell-encoded-command",
            "High because encoded or hidden PowerShell is a common execution-obfuscation signal, but not proof of abuse.",
            "Software deployment and incident-response tooling may use encoded PowerShell legitimately.",
        ),
        (
            "process-injection-hollowing",
            "High because injection or hollowing can transfer execution into a trusted process.",
            "Security tools and debuggers can report legitimate injection-like operations.",
        ),
        (
            "lolbin-execution",
            "Medium because these binaries have legitimate uses but are frequently abused to blend into system activity.",
            "Installers, administrators, and automation commonly invoke the same binaries.",
        ),
        (
            "system-clock-rollback",
            "High because time manipulation can evade time-based controls or invalidate audit ordering.",
            "Virtual-machine snapshots and clock synchronization repairs can produce similar messages.",
        ),
        (
            "certificate-validation-failure",
            "High because a failed certificate check can expose a broken or intercepted trust path.",
            "Expired certificates, private test CAs, and clock skew are common benign causes.",
        ),
        (
            "signature-database-corrupt",
            "High because a damaged definition store can leave endpoint protection degraded.",
            "Interrupted upgrades or disk errors can corrupt definitions without malicious activity.",
        ),
        (
            "fatal-error-crash",
            "Critical because the affected component may have stopped handling its workload.",
            "Expected crash reporting and test failures can emit the same generic markers.",
        ),
        (
            "resource-exhaustion",
            "High because exhausted memory, disk, handles, or I/O capacity can cascade into service failure.",
            "Short-lived load tests and intentionally constrained environments can trigger it.",
        ),
        (
            "connection-refused-reset",
            "Medium because it identifies a failed network dependency without establishing why it failed.",
            "Planned restarts, network tests, and temporary endpoint outages are common.",
        ),
        (
            "update-failure",
            "Medium because stale updates can reduce protection or leave a component behind its expected state.",
            "Offline maintenance windows and intentionally pinned versions can look identical.",
        ),
        (
            "installer-rollback",
            "Medium because install or repair did not complete and the product state needs review.",
            "A user-cancelled or deliberately rolled-back maintenance operation is benign.",
        ),
        (
            "access-denied-unauthorized",
            "Medium because a missing permission can prevent a required operation from completing.",
            "Least-privilege policy, expected ACLs, and probing code often produce this signal.",
        ),
        (
            "container-runtime-failure",
            "High because a workload could not start or remain running.",
            "A bad image, capacity limit, or intentionally stopped development container can cause it.",
        ),
        (
            "kubernetes-workload-failure",
            "High because restart loops, failed probes, and image errors make a workload unavailable.",
            "Deployments during rollout and intentionally failing health checks can be expected.",
        ),
        (
            "systemd-unit-failure",
            "Medium because a service unit did not start or reported an operational error.",
            "Disabled optional units and normal boot ordering races can be harmless.",
        ),
        (
            "nginx-upstream-failure",
            "High because the edge proxy could not serve a healthy upstream request.",
            "Deploys, drained backends, and client request-size tests can create the same entry.",
        ),
        (
            "mysql-storage-concurrency-failure",
            "High because storage or lock failures can block writes and cause cascading database errors.",
            "Expected contention and maintenance operations can produce deadlocks or capacity errors.",
        ),
        (
            "postgresql-connection-transaction-failure",
            "High because PostgreSQL reports a failed connection or transaction path.",
            "Routine failover, pool saturation, and administrative termination can match.",
        ),
        (
            "windows-event-audit-service-failure",
            "Medium because an audit or service event deserves review but is not inherently malicious.",
            "Scheduled tasks, policy changes, and expected service restarts can emit these events.",
        ),
        (
            "edr-alert",
            "High because an endpoint tool reported detection or remediation activity requiring triage.",
            "Test samples, quarantine simulations, and false positives are included by design.",
        ),
        (
            "splunk-search-indexer-failure",
            "High because search or indexing availability is impaired.",
            "Indexer maintenance, license limits, and planned peer rotation can be expected.",
        ),
        (
            "diagnostic-assertion-traceback",
            "Medium because diagnostic output indicates a component hit an exceptional path.",
            "Developer builds and handled test failures routinely include assertions or tracebacks.",
        ),
    ];
    assert_eq!(DEFS.len(), AUDIT.len(), "built-in signature metadata drifted");

    let signatures = DEFS
        .iter()
        .zip(AUDIT.iter())
        .map(|((sev, cat, title, explain, _), (id, rationale, false_positive))| Signature {
            id,
            severity: *sev,
            category: cat,
            title,
            explain,
            severity_rationale: rationale,
            false_positive_note: false_positive,
            provenance: SignatureProvenance {
                source: "builtin",
                catalog: "loglens-rust-builtins",
                version: "builtin-v1",
                set: "core",
                pattern: id,
            },
        })
        .collect();
    let patterns = DEFS.iter().map(|(_, _, _, _, pat)| *pat).collect();
    (signatures, patterns)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The signature metadata, as defined in this file.
    fn defs() -> Vec<Signature> {
        builtin_defs().0
    }

    fn titles_matching(line: &str) -> Vec<&'static str> {
        let lib = Library::builtin();
        lib.matches(line).map(|i| lib[i].title).collect()
    }

    fn ids_matching(line: &str) -> Vec<&'static str> {
        let lib = Library::builtin();
        lib.matches(line).map(|i| lib[i].id).collect()
    }

    #[test]
    fn all_builtin_signatures_compile() {
        let defs = defs();
        assert!(!defs.is_empty());
        // Every pattern must compile — Library::builtin panics otherwise.
        let _ = Library::builtin();
        assert!(defs.iter().any(|s| s.severity == Severity::Critical));
    }

    /// One representative line per built-in signature, plus lines that must not
    /// match anything. `None` means "no findings at all".
    const EXPECTED: &[(&str, Option<&str>)] = &[
        // NB: this pattern wants the verb before the noun. The reversed phrasing
        // ("Real-time protection was disabled") does *not* match today — a real
        // coverage gap in the signature, left alone here because widening it
        // changes what gets flagged in customer logs.
        (
            "ERROR Disabled real-time protection via registry edit",
            Some("Security protection disabled/tampered"),
        ),
        (
            "WARN  Suspicious process detected: powershell.exe -enc <base64>",
            Some("Encoded PowerShell command"),
        ),
        (
            "ALERT Blocked process injection attempt targeting explorer.exe",
            Some("Process injection / hollowing"),
        ),
        (
            "DEBUG rundll32.exe launched with unusual arguments",
            Some("Living-off-the-land binary"),
        ),
        (
            "ERROR License validation failed: rollback detected on system clock",
            Some("Clock / time rollback detected"),
        ),
        (
            "ERROR Certificate validation failed for update.example.com",
            Some("Certificate validation failure"),
        ),
        (
            "ERROR Signature database corrupt, failed to load definitions",
            Some("Signature/definition database corrupt"),
        ),
        (
            "FATAL unhandled exception in scan engine (core dumped)",
            Some("Fatal error / crash"),
        ),
        (
            "ERROR out of memory while building index",
            Some("Resource exhaustion"),
        ),
        (
            "WARN  connection refused to telemetry.example.com",
            Some("Connection refused / reset"),
        ),
        (
            "ERROR update failed: could not reach the update server",
            Some("Update failure"),
        ),
        (
            "ERROR Installer rolling back changes (error 1603)",
            Some("Installer rollback"),
        ),
        (
            "ERROR access denied opening quarantine store (0x80070005)",
            Some("Access denied / unauthorized"),
        ),
        (
            "containerd: failed to create shim task for container api",
            Some("Container startup or runtime failure"),
        ),
        (
            "pod api entered CrashLoopBackOff after OOMKilled",
            Some("Kubernetes workload restart or image failure"),
        ),
        (
            "systemd[1]: failed to start payments.service",
            Some("systemd unit failed to start"),
        ),
        (
            "2026/09/17 [error] upstream timed out while reading response header",
            Some("nginx upstream or request failure"),
        ),
        (
            "InnoDB: error while waiting for lock; deadlock found when trying to get lock",
            Some("MySQL storage or concurrency failure"),
        ),
        (
            "FATAL: password authentication failed for user app",
            Some("PostgreSQL connection or transaction failure"),
        ),
        (
            "Windows Event ID 4625: Audit Failure",
            Some("Windows Event Log audit or service failure"),
        ),
        (
            "EDR detection quarantined suspicious process",
            Some("Endpoint detection or response alert"),
        ),
        (
            "splunkd search peer unavailable during dispatch",
            Some("Splunk search or indexer failure"),
        ),
        (
            "Traceback (most recent call last):",
            Some("Diagnostic assertion or traceback"),
        ),
        // Clean lines: a generic ERROR is highlight material, not a finding.
        (
            "2026-07-22 10:00:01 INFO  Starting AV agent service v14.2.1",
            None,
        ),
        (
            "2026-07-22 10:00:07 ERROR something went sideways in module X",
            None,
        ),
        ("plain text with no interesting tokens at all", None),
        ("", None),
    ];

    /// Near-misses are intentionally kept explicit: they document the current
    /// deterministic boundary instead of silently widening a regex during an
    /// audit. Other signatures may match a near-miss; this test checks only the
    /// named signature.
    const NEAR_MISSES: &[(&str, &str)] = &[
        ("tamper-protection-disabled", "Real-time protection was disabled"),
        ("powershell-encoded-command", "powershell.exe -file inventory.ps1"),
        ("process-injection-hollowing", "process opened explorer.exe normally"),
        ("lolbin-execution", "rundll32 launched without the .exe suffix"),
        ("system-clock-rollback", "system clock synchronized successfully"),
        ("certificate-validation-failure", "certificate validation succeeded"),
        ("signature-database-corrupt", "signature database loaded successfully"),
        ("fatal-error-crash", "scan completed successfully"),
        ("resource-exhaustion", "memory available: 8 GB"),
        ("connection-refused-reset", "connection established to telemetry"),
        ("update-failure", "update completed successfully"),
        ("installer-rollback", "installation completed successfully"),
        ("access-denied-unauthorized", "access granted to quarantine store"),
        ("container-runtime-failure", "container started successfully"),
        ("kubernetes-workload-failure", "pod is running and ready"),
        ("systemd-unit-failure", "started payments.service"),
        ("nginx-upstream-failure", "upstream responded with 200"),
        ("mysql-storage-concurrency-failure", "MySQL query completed"),
        ("postgresql-connection-transaction-failure", "PostgreSQL connection established"),
        ("windows-event-audit-service-failure", "Windows Event ID 4624: Audit Success"),
        ("edr-alert", "EDR scan completed with no alert"),
        ("splunk-search-indexer-failure", "splunkd search peer available"),
        ("diagnostic-assertion-traceback", "diagnostic assertion passed"),
    ];

    /// Guards the index→metadata pairing. The `RegexSet` reports only indices, so
    /// a change that let patterns drift out of step with the metadata beside them
    /// would keep matching lines while attaching the *wrong* explanation to them.
    /// Checking a known line resolves to its own title is what catches that; the
    /// coverage assertion stops a new signature from being added untested.
    #[test]
    fn every_signature_reports_its_own_title() {
        let lib = Library::builtin();
        for (line, expected) in EXPECTED {
            let titles: Vec<&str> = lib.matches(line).map(|i| lib[i].title).collect();
            match expected {
                // Other signatures may also match — overlap is by design — but the
                // one describing this line must be among them.
                Some(want) => assert!(
                    titles.contains(want),
                    "expected {want:?} for {line:?}, got {titles:?}"
                ),
                None => assert!(
                    titles.is_empty(),
                    "expected no findings for {line:?}, got {titles:?}"
                ),
            }
        }

        // Every built-in signature needs a line in the table above.
        for sig in defs() {
            assert!(
                EXPECTED.iter().any(|(_, want)| *want == Some(sig.title)),
                "signature {:?} has no line in EXPECTED — add one",
                sig.title
            );
        }
    }

    #[test]
    fn every_signature_has_stable_metadata_and_a_documented_near_miss() {
        let mut ids = std::collections::HashSet::new();
        for signature in defs() {
            let valid_id = signature
                .id
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
            assert!(valid_id, "invalid stable id {:?}", signature.id);
            assert!(ids.insert(signature.id), "duplicate stable id {:?}", signature.id);
            assert!(!signature.severity_rationale.trim().is_empty());
            assert!(!signature.false_positive_note.trim().is_empty());
            assert_eq!(signature.provenance.source, "builtin");
            assert_eq!(signature.provenance.pattern, signature.id);
            let (_, positive) = EXPECTED
                .iter()
                .find(|(_, title)| *title == Some(signature.title))
                .expect("every signature has a positive fixture");
            assert!(!ids_matching(positive.expect("positive fixture")).is_empty());
        }
        assert_eq!(ids.len(), 23);
        for (id, near_miss) in NEAR_MISSES {
            assert!(
                !ids_matching(near_miss).contains(id),
                "near-miss unexpectedly matched {id}: {near_miss:?}"
            );
        }
    }

    #[test]
    fn severity_ordering_critical_gt_info() {
        assert!(Severity::Critical > Severity::High);
        assert!(Severity::High > Severity::Medium);
        assert!(Severity::Medium > Severity::Low);
        assert!(Severity::Low > Severity::Info);
    }

    #[test]
    fn matches_encoded_powershell_sample_line() {
        let line = "WARN  Suspicious process detected: powershell.exe -enc <base64>";
        let titles = titles_matching(line);
        assert!(
            titles.iter().any(|t| t.contains("PowerShell")),
            "expected encoded PowerShell signature, got {titles:?}"
        );
    }

    #[test]
    fn matches_certificate_validation_failure() {
        let line = "ERROR Certificate validation failed for update.example.com";
        let titles = titles_matching(line);
        assert!(
            titles.iter().any(|t| t.contains("Certificate")),
            "expected cert failure signature, got {titles:?}"
        );
    }

    #[test]
    fn matches_clock_rollback_phrase() {
        let line = "ERROR License validation failed: rollback detected on system clock";
        let titles = titles_matching(line);
        assert!(
            titles
                .iter()
                .any(|t| t.contains("Clock") || t.contains("rollback")),
            "expected clock rollback signature, got {titles:?}"
        );
    }

    #[test]
    fn matches_connection_refused() {
        let line = "connection refused while contacting update.example.com:443";
        let titles = titles_matching(line);
        assert!(
            titles.iter().any(|t| t.contains("Connection")),
            "expected connection signature, got {titles:?}"
        );
    }

    #[test]
    fn matches_installer_rollback() {
        let line = "Error 1603: Fatal error during installation — rolling back";
        let titles = titles_matching(line);
        assert!(
            titles
                .iter()
                .any(|t| t.contains("Installer") || t.contains("rollback")),
            "expected installer rollback signature, got {titles:?}"
        );
    }

    #[test]
    fn clean_info_line_is_not_an_error_finding() {
        let line = "2026-07-22 10:00:01 INFO  Starting AV agent service v14.2.1";
        let titles = titles_matching(line);
        assert!(
            titles.is_empty(),
            "clean INFO startup line should not match: {titles:?}"
        );
    }

    #[test]
    fn catch_all_error_and_warn_are_not_scan_signatures() {
        // Broad ERROR/WARN lines must not produce findings on their own —
        // those belong in keyword highlights, not the triage panel.
        let error_line = "2026-07-22 10:00:07 ERROR something went sideways in module X";
        let warn_line = "2026-07-22 10:00:05 WARN  Real-time protection module took 3200ms";
        assert!(
            titles_matching(error_line).is_empty(),
            "generic ERROR must not be a scan signature: {:?}",
            titles_matching(error_line)
        );
        assert!(
            titles_matching(warn_line).is_empty(),
            "generic WARN must not be a scan signature: {:?}",
            titles_matching(warn_line)
        );
        assert!(
            !defs()
                .iter()
                .any(|s| s.title == "Generic error" || s.title == "Warning")
        );
    }

    #[test]
    fn builtin_signatures_are_medium_or_higher() {
        assert!(
            defs().iter().all(|s| s.severity >= Severity::Medium),
            "scan signatures should stay at Medium+ to avoid findings flood"
        );
    }
}
