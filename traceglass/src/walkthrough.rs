//! Pure state and copy for the optional first-run walkthrough.
//!
//! The walkthrough deliberately knows nothing about the viewer or terminal. It
//! is a small, deterministic content contract that the app and renderer can
//! exercise independently.

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Decision {
    #[default]
    Unseen,
    Skipped,
    Completed,
}

impl Decision {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Unseen => "unseen",
            Self::Skipped => "skipped",
            Self::Completed => "completed",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "unseen" => Some(Self::Unseen),
            "skipped" => Some(Self::Skipped),
            "completed" => Some(Self::Completed),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Stage {
    Prompt,
    Page(usize),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct State {
    pub stage: Stage,
}

impl State {
    pub const fn prompt() -> Self {
        Self {
            stage: Stage::Prompt,
        }
    }

    pub const fn first_page() -> Self {
        Self {
            stage: Stage::Page(0),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Page {
    pub title: &'static str,
    pub body: &'static str,
}

pub const PAGES: [Page; 4] = [
    Page {
        title: "Open logs and bundles",
        body: "o opens the local browser. Enter/l enters folders; Space marks files and o opens them. O opens folders or ZIPs. You can also pass files, folders, or ZIPs on the command line. Piped stdin stays in machine mode.",
    },
    Page {
        title: "Choose a review lens",
        body: "L chooses General Triage, Incident / Reliability, or Security Signals. A lens changes grouping and review priority only; matching and source evidence stay unchanged.",
    },
    Page {
        title: "Search and filter",
        body: "/ searches text, f shows matching lines, and c clears search and filter. These controls change what you read; S is the separate scan for curated built-in signals.",
    },
    Page {
        title: "Read and export findings",
        body: "After S, s opens findings. Read severity, explanation, false-positive context, and source evidence. Enter jumps; e exports locally. Processing stays local. Findings are evidence for human review, not malware verdicts, security determinations, or completeness claims.",
    },
];

pub const PAGE_COUNT: usize = PAGES.len();

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decisions_round_trip_and_unknown_values_are_ignored() {
        for decision in [Decision::Unseen, Decision::Skipped, Decision::Completed] {
            assert_eq!(Decision::parse(decision.as_str()), Some(decision));
        }
        assert_eq!(Decision::parse("later"), None);
    }

    #[test]
    fn content_covers_the_local_review_contract() {
        let copy = PAGES
            .iter()
            .map(|page| page.body)
            .collect::<Vec<_>>()
            .join(" ");
        for term in ["o", "L", "/", "f", "c", "S", "s", "Enter", "e", "local"] {
            assert!(copy.contains(term), "walkthrough is missing {term}");
        }
        assert!(copy.contains("human review"));
        assert!(copy.contains("not malware verdicts"));
    }
}
