// @polsia:user-owned — versioned, client-safe snapshots for managed marketing pages.
import { PageContent, type PageContent as PageContentValue } from '@/lib/contracts/pages';

type ContentData = Record<string, unknown>;
type SnapshotSection = {
  id: string;
  kind: string;
  data: ContentData;
  assets?: PageContentValue['assets'];
  [key: string]: unknown;
};

const asset = (id: string, ref: string, alt?: string) => ({
  id,
  kind: 'visual',
  ref,
  ...(alt ? { alt } : {}),
});

const section = (
  id: string,
  kind: string,
  data: ContentData,
  assets: PageContentValue['assets'] = [],
) => ({
  id,
  kind,
  data,
  assets,
});

const homeSections: SnapshotSection[] = [
  section(
    'hero',
    'hero',
    {
      eyebrow: 'Rust-native · local-first · beta installer',
      heading: 'Grammarly, for logs.',
      body: 'Open a diagnostic file in the TUI, or pipe logs through a machine mode. TraceGlass keeps source lines visible while it ranks signals across Splunk, Docker, Kubernetes, databases, and endpoint collections.',
      links: [
        { label: 'Install TraceGlass', href: '/install' },
        { label: 'How it works', href: '#workflow' },
        { label: 'Open on GitHub', href: 'https://github.com/dorman/loglens' },
      ],
      stats: [
        { value: '100%', label: 'runs locally' },
        { value: '0', label: 'bytes uploaded' },
        { value: '1 click', label: 'beta install path' },
      ],
      terminal: {
        title: 'docker-compose.log',
        prompt: '$ loglens docker-compose.log',
        lines: [
          'INFO  Server ready on :8080',
          'INFO  Connected to postgres',
          'HIGH  Container startup or runtime failure',
          'MED   Connection refused / reset',
          'finding → docker-compose.log:3',
          'press Enter to jump to evidence',
        ],
      },
    },
    [asset('hero-terminal', 'terminal', 'Highlighted log output')],
  ),
  section('features', 'features', {
    eyebrow: 'Features',
    heading: "Built for the developer who already knows what they're looking for.",
    body: 'No upload and no remote processing. The TUI keeps your user-controlled local keyword watchlist separate from curated built-in signatures: add a keyword or regex highlight when you choose, while built-ins produce findings without changing your saved entries.',
    items: [
      {
        title: 'Stdin, file, or pipe',
        body: 'Reads from stdin, a file path, or a piped stream. Drop into any shell command — tail, journalctl, kubectl logs, splunk export.',
        icon: 'terminal',
      },
      {
        title: 'Curated built-in signatures + local highlights',
        body: 'Review severity-ranked findings from the versioned built-in signature catalog, then add keyword or regex highlights to your local watchlist for the vocabulary of your system. Built-ins never enter the saved watchlist.',
        icon: 'list-checks',
        badge: 'Today',
      },
      {
        title: 'File-first TUI',
        body: 'A regular file opens the interactive terminal UI and scans immediately. Piped stdin and redirected output stay plain and automation-safe.',
        icon: 'palette',
      },
      {
        title: 'Raw, JSON, or CSV',
        body: 'Use --format raw, --format json, or --format csv for stable automation output with file identity, line numbers, severity, and evidence.',
        icon: 'shield-alert',
      },
      {
        title: 'One-click beta installer',
        body: 'The planned TraceGlass installer verifies a signed release before installing for the current user and opening the TUI. Downloads stay disabled until artifacts are published.',
        icon: 'package',
      },
      {
        title: 'Local-only by default',
        body: 'Runs entirely on the machine reading the log. The local watchlist needs no AI or network access: nothing is transmitted, no telemetry, no service, and no silent update behavior.',
        icon: 'lock',
      },
    ],
  }),
  section('use-cases', 'use-cases', {
    eyebrow: 'Built for',
    heading: 'Wherever the log already lives.',
    body: 'Splunk exports, Docker and Kubernetes output, systemd/journal logs, nginx, MySQL, PostgreSQL, Windows Event, antivirus/EDR collections, and generic diagnostics.',
    items: [
      {
        title: 'Splunk exports',
        body: 'Open a CSV export or choose JSON/CSV output for scripts while retaining raw source lines and matched evidence.',
        command: '$ loglens --format json splunk-export.csv',
        output: '{ "file": "splunk-export.csv", "severity": "high" }',
      },
      {
        title: 'Docker Compose',
        body: 'Open a compose log and scan on open; use search, line filtering, and finding navigation to keep the review focused.',
        command: '$ docker compose logs -t | loglens',
        output: 'L3  HIGH  container startup or runtime failure\nEnter → source evidence',
      },
      {
        title: 'Antivirus diagnostic logs',
        body: 'AV and EDR reports can be large and vendor-specific; line fallback keeps the source searchable even when a structure is unknown.',
        command: '$ loglens diagnostic-collection.zip',
        output: '[2026-07-22 10:14] HIGH endpoint detection signal\nreview → jump to source line',
      },
      {
        title: 'kubectl pod logs',
        body: 'Kubernetes restart, probe, image-pull, and OOM signals are highlighted without requiring a vendor-specific parser.',
        command: '$ kubectl logs api-x-7f9c | loglens',
        output:
          'INFO  container started\nHIGH OOMKilled  memory limit exceeded\nfinding evidence retained',
      },
      {
        title: 'CI runner logs',
        body: 'Use JSON or CSV records in CI when a script needs stable fields; findings remain neutral review signals with evidence and severity.',
        command: '$ loglens --format csv runner.log',
        output:
          'file,line,severity,message,evidence,raw\nrunner.log,2,medium,panic: …,Diagnostic assertion,…',
      },
    ],
  }),
  section('workflow', 'how-it-works', {
    eyebrow: 'How it works',
    heading: 'Install once, then review locally.',
    body: 'The beta installer verifies the release, opens the same interactive TUI, and leaves every CLI output mode available for scripts.',
    items: [
      {
        number: '01',
        title: 'Open a source',
        body: 'Pass a file, folder, ZIP bundle, or pipe stdin. The TUI scans file paths on open and preserves raw line identity.',
        command: '$ loglens ./diagnostic-bundle/',
        output: 'opened 8 file(s) · scanning diagnostic signals…',
      },
      {
        number: '02',
        title: 'Search and triage',
        body: 'Search text, filter visible lines, filter finding severity, and jump from a finding to its source evidence.',
        command: '$ loglens --format json events.ndjson',
        output: '[ { "line": 2, "severity": "high", "finding": { ... } } ]',
      },
      {
        number: '03',
        title: 'Choose an output mode',
        body: 'Pipes default to raw text. Explicit raw, JSON, and CSV modes never start the interactive terminal protocol.',
        command: '$ cat app.log | loglens --format csv',
        output: 'file,line,severity,message,evidence,raw',
      },
    ],
  }),
  section(
    'privacy',
    'privacy',
    {
      heading: 'Nothing leaves your machine.',
      body: 'TraceGlass is a local CLI. Your log content, your stack traces, your PII — all of it stays in the pipe between the source command and your terminal. There is no hosted backend, no analytics, no opt-in telemetry. Even crash reports are written locally.',
      points: ['No network calls', 'No cloud dashboard', 'No telemetry'],
    },
    [asset('privacy-lock', 'lock', 'Local-only privacy')],
  ),
  section('faq', 'faq', {
    eyebrow: 'FAQ',
    heading: 'Questions a developer asks before installing a CLI.',
    body: "If yours isn't here, write to us.",
    items: [
      {
        question: 'How does this differ from grep --color?',
        answer:
          'grep highlights a pattern. TraceGlass keeps curated built-in signatures as separate scan evidence, while your keyword and regex highlights are user-controlled entries in a local watchlist. Add them explicitly, then jump from each match to its source line.',
      },
      {
        question: 'Does it upload my logs?',
        answer:
          'No. The CLI is a single Rust binary that reads from stdin, a file, or a pipe and writes to your terminal. The local watchlist needs no AI or network access: there is no network call, hosted backend, or analytics.',
      },
      {
        question: 'What is the beta install method?',
        answer:
          'The TraceGlass one-click installer is the planned beta path for supported Linux glibc x86_64, macOS Apple silicon, macOS Intel, and Windows x86_64 targets. It will verify a signed manifest and payload before installing for the current user. Downloads remain disabled until a real release is published; contributors can build from a clone in the meantime.',
      },
      {
        question: 'What about regex highlights and watchlists?',
        answer:
          'The TUI supports live keyword and regex highlights. Press a or r to add the chosen highlight to your local watchlist. Curated built-in signatures are a separate versioned scan catalog and never enter the saved list. TraceGlass does not currently generate candidate suggestions.',
      },
      {
        question: 'Which log formats work?',
        answer:
          'Plain text, .txt and .log files, JSON and NDJSON, CSV and .csb, folders, ZIP bundles, and stdin. Unknown vendor structures fall back to line-level scanning.',
      },
    ],
  }),
];

const snapshots: Record<string, PageContentValue> = {
  home: PageContent.parse({
    version: 1,
    sections: homeSections,
    assets: homeSections.flatMap((item) => item.assets ?? []),
  }),
  install: PageContent.parse({
    version: 1,
    sections: [
      section('install-guide', 'install-guide', {
        eyebrow: 'Install guide',
        heading: 'From source checkout to diagnostic review.',
        body: 'The TraceGlass one-click beta installer will verify the signed release, install for the current user, and open the same interactive TUI. It is not enabled until real artifacts are published; Cargo/source remains the technical fallback.',
        links: [
          { label: 'Check release status', href: 'https://github.com/dorman/loglens/releases' },
          { label: 'Read release notes', href: '/release' },
        ],
      }),
    ],
    assets: [asset('install-terminal', 'terminal', 'Recommended install command')],
  }),
  release: PageContent.parse({
    version: 1,
    sections: [
      section('release-hero', 'hero', {
        eyebrow: 'Release status · beta installer',
        heading: 'A signed path from download to TUI',
        body: 'The one-click beta installer is being prepared for supported Linux glibc x86_64, macOS Apple silicon, macOS Intel, and Windows x86_64 targets. No artifact is advertised until its signed manifest, payload, and release entry exist.',
      }),
      section('release-install', 'release-install', {
        heading: 'Install the beta artifact when it is published.',
        items: [
          {
            title: 'One-click installer',
            body: 'A local installer will verify the Ed25519 manifest, payload signature, and SHA-256 before asking for PATH and TUI-launch consent.',
            command: 'status: unavailable until signed release publication',
          },
          {
            title: 'Technical source fallback',
            body: 'Rust users can build the open-source binary directly while the beta installer remains unpublished.',
            command: 'cargo install --path . --locked',
          },
        ],
      }),
      section('release-features', 'features', {
        eyebrow: 'Current behavior',
        heading: 'The verified CLI journey.',
        items: [
          {
            title: 'Interactive TUI scan-on-open',
            body: 'Running TraceGlass against a file opens the interactive terminal UI and scans immediately.',
          },
          {
            title: 'Severity-ranked findings',
            body: 'Curated built-in signatures produce severity-ranked findings and evidence for human review. They are immutable scan metadata, not local watchlist entries.',
          },
          {
            title: 'Search, filter, and triage',
            body: 'Search source text, filter visible lines, filter findings by severity, and jump to evidence.',
          },
          {
            title: 'JSON / CSV structured output',
            body: '--format raw, --format json, and --format csv are non-interactive and preserve file/line identity.',
          },
          {
            title: 'Versioned signature library',
            body: 'Signals cover Docker, Kubernetes, systemd, nginx, MySQL, PostgreSQL, Windows Event, antivirus/EDR, Splunk, and generic diagnostics.',
          },
        ],
      }),
      section('release-privacy', 'privacy', {
        heading: 'Your logs never leave the pipe.',
        body: 'TraceGlass is a local-only binary. Your logs never leave the pipe between the log source and your terminal — no cloud backend, no telemetry, no service, and no silent auto-update.',
      }),
    ],
    assets: [asset('release-lock', 'lock', 'Local-only release')],
  }),
  signatures: PageContent.parse({
    version: 1,
    sections: [
      section('signature-hero', 'hero', {
        eyebrow: 'Signature library · v0.2.0',
        heading: 'Open-source detection sets for the logs that hurt.',
        body: 'Preview the curated, versioned built-in signature library for Splunk search errors, Windows Event anomalies, and antivirus/EDR alerts. Built-ins produce findings and never enter the local watchlist.',
      }),
      section('signature-catalog', 'signature-catalog', {
        body: 'The live catalog below is loaded from the current release.',
      }),
    ],
    assets: [asset('signature-library', 'library', 'Signature library')],
  }),
  waitlist: PageContent.parse({
    version: 1,
    sections: [
      section('waitlist-hero', 'hero', {
        eyebrow: 'Paid plan · not available yet',
        heading: 'A paid TraceGlass plan is planned, but it isn’t available yet.',
        body: 'Request one email update about availability. Signing up does not start a subscription. Target launch date: November 15, 2026.',
      }),
      section('waitlist-form', 'waitlist-form', {
        heading: 'Request one email update.',
        body: 'A paid TraceGlass plan is planned, but it isn’t available yet. We’ll use your email only to send one update. Signing up does not start a subscription. Target launch date: November 15, 2026.',
      }),
    ],
    assets: [asset('waitlist-shield', 'shield-check', 'Email-only waitlist')],
  }),
};

export function getDefaultMarketingPageContent(templateKey: string): PageContentValue {
  return snapshots[templateKey] ?? PageContent.parse({ version: 1, sections: [], assets: [] });
}

export const defaultMarketingPageContent = getDefaultMarketingPageContent;

export function legacyMarketingPageContent(input: {
  title: string;
  body: string;
  seoDescription?: string;
  templateKey?: string | null;
  sourceKey?: string | null;
  content?: unknown;
}): PageContentValue {
  const parsed = PageContent.safeParse(input.content);
  if (parsed.success) return parsed.data;
  const template = input.templateKey ?? input.sourceKey;
  const baseline = template ? snapshots[template] : undefined;
  if (baseline && (input.sourceKey || input.templateKey)) return baseline;
  return PageContent.parse({
    version: 1,
    sections: [
      section('legacy-body', 'legacy-body', {
        heading: input.title,
        body: input.body,
        seoDescription: input.seoDescription ?? '',
      }),
    ],
    assets: [],
  });
}

export function normalizeMarketingPageContent(input: {
  title: string;
  body: string;
  seoDescription?: string;
  templateKey?: string | null;
  sourceKey?: string | null;
  content?: unknown;
}): PageContentValue {
  return legacyMarketingPageContent(input);
}

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Remove retired pricing sections while preserving all unrelated managed-page content. */
export function cleanupRetiredPricingContent(input: {
  sourceKey: string | null | undefined;
  title: string;
  content: unknown;
}): { title: string; content: unknown; titleChanged: boolean; contentChanged: boolean } {
  const nextTitle = input.sourceKey === 'home' ? 'TraceGlass' : input.title;
  const titleChanged = nextTitle !== input.title;
  if (
    (input.sourceKey !== 'home' && input.sourceKey !== 'release') ||
    !isJsonRecord(input.content) ||
    !Array.isArray(input.content.sections)
  ) {
    return { title: nextTitle, content: input.content, titleChanged, contentChanged: false };
  }

  const sections = input.content.sections.filter((section) => {
    if (!isJsonRecord(section)) return true;
    const isRetiredOffer =
      section.id === 'pricing' ||
      section.kind === 'pricing' ||
      section.id === 'billing-card' ||
      section.kind === 'billing-card';
    return !isRetiredOffer && (input.sourceKey !== 'release' || section.id !== 'release-cta');
  });
  const contentChanged = sections.length !== input.content.sections.length;
  return {
    title: nextTitle,
    content: contentChanged ? { ...input.content, sections } : input.content,
    titleChanged,
    contentChanged,
  };
}

const generatedWaitlistCopy = {
  title: 'TraceGlass paid plan updates',
  body: 'A paid TraceGlass plan is planned, but it isn’t available yet. Request one email update; signup does not start a subscription.',
  seoDescription:
    'A paid TraceGlass plan is planned, but it isn’t available yet. Request one email update; signup does not start a subscription. Target date: November 15, 2026.',
  heroEyebrow: 'Paid plan · not available yet',
  heroHeading: 'A paid TraceGlass plan is planned, but it isn’t available yet.',
  heroBody:
    'Request one email update about availability. Signing up does not start a subscription. Target launch date: November 15, 2026.',
  formHeading: 'Request one email update.',
  formBody:
    'A paid TraceGlass plan is planned, but it isn’t available yet. We’ll use your email only to send one update. Signing up does not start a subscription. Target launch date: November 15, 2026.',
} as const;

const previousGeneratedWaitlistCopy = {
  title: 'Get the email when Pro ships.',
  body: [
    'Join the email-only waitlist for curated packs that stay separate from your local watchlist.',
    'Join the email-only waitlist for curated local watchlists.',
  ],
  seoDescription: [
    'Join the TraceGlass Pro waitlist for weekly curated packs. No log content or diagnostic data is collected. Target launch: November 15, 2026.',
    'Join the TraceGlass Pro waitlist for weekly curated watchlists. No log content or diagnostic data is collected.',
  ],
  heroEyebrow: 'Pro · launching soon',
  heroHeading: 'Get the email when Pro ships.',
  heroBody: [
    "Pro brings weekly curated, domain-tuned packs for Splunk, Docker, Kubernetes, Endpoint Detection, and CI runners — delivered to your local TraceGlass CLI without changing your editable local watchlist. We'll send exactly one message on the target launch date, November 15, 2026.",
    "Pro brings weekly curated, domain-tuned watchlists for Splunk, Docker, Kubernetes, Endpoint Detection, and CI runners — delivered to your local TraceGlass CLI. We'll send exactly one message on launch day.",
  ],
  formHeading: 'Join the launch list.',
  formBody: [
    'Your email address — and only your email address. No log content, source code, or filenames. Target launch: November 15, 2026; the product remains unpublished until a real release exists.',
    'Your email address — and only your email address. No log content, source code, or filenames.',
  ],
} as const;

const previousWaitlistBodies = new Set<string>(previousGeneratedWaitlistCopy.body);
const previousWaitlistDescriptions = new Set<string>(previousGeneratedWaitlistCopy.seoDescription);

/** Update only unchanged generated waitlist copy, leaving custom sections and edits intact. */
export function reconcileGeneratedWaitlistCopy(input: {
  title: string;
  body: string;
  seoDescription: string;
  content: unknown;
}): {
  title: string;
  body: string;
  seoDescription: string;
  content: unknown;
  changed: boolean;
  contentChanged: boolean;
} {
  const titleChanged = input.title === previousGeneratedWaitlistCopy.title;
  const bodyChanged = previousWaitlistBodies.has(input.body);
  const descriptionChanged = previousWaitlistDescriptions.has(input.seoDescription);
  const title = titleChanged ? generatedWaitlistCopy.title : input.title;
  const body = bodyChanged ? generatedWaitlistCopy.body : input.body;
  const seoDescription = descriptionChanged
    ? generatedWaitlistCopy.seoDescription
    : input.seoDescription;

  if (!isJsonRecord(input.content) || !Array.isArray(input.content.sections)) {
    return {
      title,
      body,
      seoDescription,
      content: input.content,
      changed: titleChanged || bodyChanged || descriptionChanged,
      contentChanged: false,
    };
  }

  let contentChanged = false;
  const sections = input.content.sections.map((value) => {
    if (!isJsonRecord(value)) return value;
    const sectionData = value.data;
    if (!isJsonRecord(sectionData)) return value;
    const replacements: Record<string, { previous: readonly string[]; next: string }> =
      value.id === 'waitlist-hero'
        ? {
            eyebrow: {
              previous: [previousGeneratedWaitlistCopy.heroEyebrow],
              next: generatedWaitlistCopy.heroEyebrow,
            },
            heading: {
              previous: [previousGeneratedWaitlistCopy.heroHeading],
              next: generatedWaitlistCopy.heroHeading,
            },
            body: {
              previous: [...previousGeneratedWaitlistCopy.heroBody],
              next: generatedWaitlistCopy.heroBody,
            },
          }
        : value.id === 'waitlist-form'
          ? {
              heading: {
                previous: [previousGeneratedWaitlistCopy.formHeading],
                next: generatedWaitlistCopy.formHeading,
              },
              body: {
                previous: [...previousGeneratedWaitlistCopy.formBody],
                next: generatedWaitlistCopy.formBody,
              },
            }
          : {};
    const updates = Object.fromEntries(
      Object.entries(replacements)
        .filter(
          ([field, copy]) =>
            typeof sectionData[field] === 'string' && copy.previous.includes(sectionData[field]),
        )
        .map(([field, copy]) => [field, copy.next]),
    );
    if (Object.keys(updates).length === 0) return value;
    contentChanged = true;
    return { ...value, data: { ...sectionData, ...updates } };
  });

  return {
    title,
    body,
    seoDescription,
    content: contentChanged ? { ...input.content, sections } : input.content,
    changed: titleChanged || bodyChanged || descriptionChanged || contentChanged,
    contentChanged,
  };
}

export type MarketingSnapshotSection = SnapshotSection;
