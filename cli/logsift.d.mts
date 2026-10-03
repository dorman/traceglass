// @polsia:user-owned — type declarations for the sibling cli/logsift.mjs.
// Pure ESM Node CLI module; types live alongside so test files can import them.
export type Severity = 'critical' | 'warning' | 'notice' | 'info' | 'debug';

export type SignatureFlags = '' | 'i';

export type Format = 'text' | 'json' | 'csv';

export interface WatchEntry {
  keyword: string;
  /** Per-keyword severity override; the tier from the parent array is used when omitted. */
  severity?: string;
  multi?: boolean;
  continuation?: string;
  /** Signature-library regex source; present only on generated regex entries. */
  regex?: string;
  /** Signature-library matching flags. Legacy entries omit this field. */
  flags?: SignatureFlags;
  /** Explicit source boundary: user-authored watchlist or catalog evidence. */
  source?: 'user_watchlist' | 'builtin' | 'legacy_external';
  /** Provenance for an entry loaded from a versioned signature manifest. */
  signature?: SignatureProvenance;
}

export interface WatchEntryWithTier extends WatchEntry {
  tier: string;
}

export interface SignatureProvenance {
  source: 'builtin' | 'legacy_external';
  catalog: string;
  trust: 'trusted' | 'legacy';
  id?: string;
  version: string;
  set: string;
  pattern: string;
  name: string;
  explanation?: string;
  severityRationale?: string;
  falsePositiveNote?: string;
  examples?: { positive: string; negative: string };
  lens?: {
    id: string;
    version: string;
    group: string;
    priority: number;
  };
}

export interface Watchlist {
  critical: WatchEntryWithTier[];
  warning: WatchEntryWithTier[];
  notice: WatchEntryWithTier[];
  info: WatchEntryWithTier[];
  debug: WatchEntryWithTier[];
  /** Tier name (any string, e.g. "critical", "warning", "notice", "debug"). */
  [tier: string]: WatchEntryWithTier[];
}

export type LegacyWatchlist = { [tier: string]: string[] };

export type ParseResult = { ok: true; value: Watchlist } | { ok: false; error: string };

export interface Hit {
  keyword: string;
  /** Tier name inherited from the parent array on the watchlist. */
  severity: string;
  start: number;
  length: number;
  entry?: WatchEntryWithTier;
}

export interface SignatureMatcher {
  name: string;
  id?: string;
  severity: 'critical' | 'warning' | 'notice' | 'debug';
  flags: SignatureFlags;
  source: string;
  provenance: SignatureProvenance;
  explanation?: string;
  severityRationale?: string;
  falsePositiveNote?: string;
  test(line: string): boolean;
}

export interface SignaturePattern {
  name: string;
  severity: 'critical' | 'warning' | 'notice' | 'debug';
  match: { string?: string; regex?: string; flags?: SignatureFlags };
  id: string;
  explanation?: string;
  severityRationale?: string;
  falsePositiveNote?: string;
  examples?: { positive: string; negative: string };
}

export interface SignatureManifest {
  version: string;
  set: string;
  title: string;
  description: string;
  patterns: ReadonlyArray<SignaturePattern>;
  notes?: string;
}

export interface LoadedSignatureManifest {
  manifest: SignatureManifest;
  entries: ReadonlyArray<WatchEntryWithTier>;
  watchlist: Watchlist;
  matchers: ReadonlyArray<SignatureMatcher>;
  trust: 'builtin' | 'legacy';
}

export type SignatureCounts = {
  critical: number;
  warning: number;
  notice: number;
  debug: number;
};

export type SignatureValidationResult =
  | { ok: true; value: SignatureManifest }
  | { ok: false; error: string };

export interface SignatureLoadOptions {
  onWarning?: (warning: string) => void;
  warn?: (warning: string) => void;
}

export type SignatureWarningHandler = (warning: string) => void;

export interface SignatureDirectoryLoad {
  directory: string;
  files: ReadonlyArray<string>;
  manifests: ReadonlyArray<SignatureManifest>;
  entries: ReadonlyArray<WatchEntryWithTier>;
  watchlist: Watchlist;
  counts: SignatureCounts;
  countsBySet: { [set: string]: SignatureCounts };
  warnings: ReadonlyArray<string>;
}

export interface RunCounts {
  critical: number;
  warning: number;
  /** Alias of "notice" — populated in either form regardless of which tier name is used. */
  info: number;
  notice: number;
  debug: number;
  anomalies: number;
  lines: number;
  [tier: string]: number;
}

export interface MatchRecord {
  file: string | null;
  line: number;
  severity: string;
  match: string;
  source?: 'user_watchlist' | 'builtin' | 'legacy_external';
  signature?: SignatureProvenance;
}

export type AnomalyStatus = 'scored' | 'insufficient_baseline';

export interface AnomalyInputs {
  /** Normalized local line shape used as the frequency key. */
  template: string;
  /** Number of lines remaining after leaving the candidate out. */
  baselineSize: number;
  /** Number of matching templates in the leave-one-out baseline. */
  templateSupport: number;
  distinctTemplates: number;
  minimumBaseline: number;
  leaveOneOut: true;
}

export interface AnomalyRecord {
  type: 'anomaly';
  file: string | null;
  line: number;
  text: string;
  score: number;
  confidence: number;
  status: AnomalyStatus;
  inputs: AnomalyInputs;
  explanation: string;
  limitations: ReadonlyArray<string>;
}

export type OutputRecord = MatchRecord | AnomalyRecord;

export interface RunResult {
  output: string;
  exitCode: 0 | 1;
  counts: RunCounts;
  /** Matched records retain the original shape and ordering. */
  records: ReadonlyArray<MatchRecord>;
  anomalies: ReadonlyArray<AnomalyRecord>;
  /** Ordered union used by machine-format serializers. */
  outputRecords: ReadonlyArray<OutputRecord>;
}

export interface ParsedArgs {
  watchlist: string | null;
  signatures: string | null;
  file: string | null;
  positional: string | null;
  help: boolean;
  format: Format | null;
  formatError: string | null;
  minSeverity: string | null;
  minSeverityError: string | null;
  lens: string;
}

export function parseWatchlist(rawJsonString: string): ParseResult;
export function validateSignatureManifest(parsed: unknown): SignatureValidationResult;
export function loadSignatureManifest(parsed: unknown): LoadedSignatureManifest;
export function tryLoadSignatureManifest(
  parsed: unknown,
): { ok: true; value: LoadedSignatureManifest } | { ok: false; error: string };
export function loadSignatureDirectory(
  directory: string,
  options?: SignatureLoadOptions | SignatureWarningHandler,
): SignatureDirectoryLoad;
export const loadSignatures: typeof loadSignatureDirectory;
export const loadSignatureCatalog: typeof loadSignatureDirectory;
export const loadSignatureLibrary: typeof loadSignatureDirectory;
export function mergeWatchlists(base: Watchlist, signatures: Watchlist): Watchlist;
export const MINIMUM_BASELINE_LINES: 5;
export function normalizeLineTemplate(line: string): string;
export function scoreAnomalies(
  lines: ReadonlyArray<string>,
  options?: { minimumBaseline?: number },
): ReadonlyArray<Omit<AnomalyRecord, 'type' | 'file' | 'line' | 'text'>>;
export function decorate(
  line: string,
  hits: ReadonlyArray<Hit>,
  continuations?: ReadonlyArray<string>,
  options?: { minRank?: number | null },
): string;
export function parseArgs(
  argv: ReadonlyArray<string>,
  env?: Partial<NodeJS.ProcessEnv>,
): ParsedArgs;
export function serialize(records: ReadonlyArray<OutputRecord>, format: Format): string;
export function run(opts: {
  input: string | AsyncIterable<string>;
  watchlist: Watchlist | LegacyWatchlist;
  file?: string | null;
  minSeverity?: string | null;
  lens?: LensSelection | string;
}): Promise<RunResult>;
export function main(
  argv: ReadonlyArray<string>,
  options?: {
    stdout?: { write(s: string): void };
    stderr?: { write(s: string): void };
    stdin?: NodeJS.ReadableStream & { isTTY?: boolean };
    env?: Partial<NodeJS.ProcessEnv>;
    process?: { exitCode?: number };
    watchlistPath?: string;
    signaturesPath?: string;
    format?: Format;
    minSeverity?: string | null;
    lens?: string;
  },
): Promise<{
  exitCode: number;
  counts?: RunCounts;
  records?: ReadonlyArray<MatchRecord>;
  anomalies?: ReadonlyArray<AnomalyRecord>;
  outputRecords?: ReadonlyArray<OutputRecord>;
  format?: Format;
  ok: boolean;
}>;

export const TIER_RANK: { readonly [tier: string]: number };

export interface LensReference {
  source: 'rust_builtin' | 'json_manifest';
  id: string;
}

export interface LensGroup {
  id: string;
  title: string;
  description: string;
  priority: number;
  references: ReadonlyArray<LensReference>;
  fallback?: boolean;
}

export interface LensDefinition {
  id: string;
  title: string;
  description: string;
  groups: ReadonlyArray<LensGroup>;
}

export interface LensCatalog {
  catalog: string;
  version: string;
  title: string;
  description: string;
  lenses: ReadonlyArray<LensDefinition>;
}

export interface LensSelection {
  catalog: LensCatalog;
  lens: LensDefinition;
}
