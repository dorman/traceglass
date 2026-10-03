#!/usr/bin/env node
// @polsia:user-owned — cli/logsift.mjs is the legacy LogSift Node CLI kept only
// for the unit test suite (tests/unit/logsift-*.test.ts). It is NOT the
// official install path for the product — the official Rust-native TraceGlass
// product is distributed through its signed beta installer when published or
// a source build. Do not publish this artifact
// to npm; do not promote it from customer-facing copy.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { MINIMUM_BASELINE_LINES, normalizeLineTemplate, scoreAnomalies } from './anomaly.mjs';
import {
  loadSignatureCatalog,
  loadSignatureDirectory,
  loadSignatureLibrary,
  loadSignatureManifest,
  loadSignatures,
  tryLoadSignatureManifest,
  validateSignatureManifest,
} from './signatures.mjs';
import { defaultLens, lensPlacement, selectLens } from './lenses.mjs';

const ANSI = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
};

/**
 * Severity tier rank (lower is more severe). `critical` is rank 0 — the
 * most severe — and is the only tier whose matches drive exit code 1.
 * `notice` and `info` are aliases that share rank 2 so a watchlist kept
 * on the older `info` name behaves identically to a watchlist using
 * `notice`.
 */
export const TIER_RANK = {
  critical: 0,
  warning: 1,
  notice: 2,
  info: 2,
  debug: 3,
};

/**
 * Per-tier ANSI color (foreground). A tier name not present here
 * decorates with no color (plain text) so unknown tiers remain visible.
 */
const TIER_COLOR = {
  critical: ANSI.red,
  warning: ANSI.yellow,
  notice: ANSI.cyan,
  info: ANSI.cyan,
  debug: ANSI.gray,
};

const TIER_ORDER = ['critical', 'warning', 'notice', 'info', 'debug'];

function colorFor(tier) {
  return TIER_COLOR[tier] ?? null;
}

function rankFor(tier) {
  return TIER_RANK[tier] ?? null;
}

const HELP_TEXT = `logsift — decorate streamed log lines by watchlist severity
and exit non-zero on the first critical match.

Usage:
  logsift [flags] [<file>]
  echo "INFO  starting" | logsift --watchlist ./logsift.json

Flags:
  -w, --watchlist <path>    JSON watchlist (default: ./logsift.json).
      --signatures <dir>    Recursively load versioned signature manifests;
                            falls back to LOGSIFT_SIGNATURES when absent.
      --lens <id>           Review lens: general-triage (default), incident-
                            reliability, or security-signals.
  -f, --file <path>         Read input from a file instead of stdin.
      --format <fmt>        Output format: text (default), json, or csv.
      --min-severity <tier>
                            Filter output below the chosen tier. Tiers
                            (low → high rank): critical < warning <
                            notice (alias: info) < debug. Default: keep
                            all severities (equivalently, "debug").
  -h, --help                Print this help and exit.

Positional arguments:
  <file>                    Equivalent to --file.

Exit codes:
  0  no critical matches survived the filter.
  1  at least one critical match survived the filter.
  2  usage error (watchlist/signatures/input unreadable, invalid, or unknown
     --format/--min-severity value).

Output goes to stdout; counts and diagnostics go to stderr.
`;

/**
 * Recursive zod schema describing a single watchlist entry. Each entry
 * is either a bare keyword string or an object with a `keyword` plus
 * optional `severity`, `multi`, and `continuation` qualifiers. The
 * flat-string form inherits the tier from the array it lives in; the
 * object form may also override that with an explicit `severity`.
 */
const KeywordSchema = z
  .string()
  .min(1)
  .refine((s) => s.trim().length > 0, { message: 'keyword must not be whitespace-only' });

const EntryObjectSchema = z.object({
  keyword: KeywordSchema,
  severity: z.string().min(1).optional(),
  multi: z.boolean().optional(),
  continuation: z.string().optional(),
});

const EntrySchema = z.union([KeywordSchema, EntryObjectSchema]);

/**
 * Top-level watchlist is an object whose keys are tier names and whose
 * values are arrays of entries. The schema accepts any tier key, so
 * callers can name additional tiers (e.g. "alert", "trace") beyond the
 * built-in critical/warning/notice/debug set.
 */
const WatchlistSchema = z.record(z.string(), z.array(EntrySchema));

function normalizeEntries(entries, defaultTier) {
  return entries.map((e) => {
    if (typeof e === 'string') {
      return { keyword: e, tier: defaultTier, source: 'user_watchlist' };
    }
    return { ...e, tier: e.severity ?? defaultTier, source: 'user_watchlist' };
  });
}

export function parseWatchlist(rawJsonString) {
  let parsed;
  try {
    parsed = JSON.parse(rawJsonString);
  } catch (err) {
    return { ok: false, error: `invalid JSON: ${err.message}` };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'watchlist must be an object keyed by tier name' };
  }
  const result = WatchlistSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => {
      const path = i.path.length === 0 ? '<root>' : i.path.join('.');
      return `${path}: ${i.message}`;
    });
    return { ok: false, error: issues.join('; ') };
  }
  const value = {};
  for (const [tier, rawEntries] of Object.entries(result.data)) {
    value[tier] = normalizeEntries(rawEntries, tier);
  }
  return { ok: true, value };
}

/**
 * Append signature entries after the operator's base watchlist entries. The
 * arrays are copied so loading a catalog never mutates the parsed watchlist.
 */
export function mergeWatchlists(baseWatchlist, signatureWatchlist) {
  const merged = {};
  for (const [tier, entries] of Object.entries(baseWatchlist)) {
    merged[tier] = [...entries];
  }
  for (const [tier, entries] of Object.entries(signatureWatchlist)) {
    if (!merged[tier]) merged[tier] = [];
    merged[tier].push(...entries);
  }
  return merged;
}

const regexByEntry = new WeakMap();

function regexForEntry(entry) {
  let regex = regexByEntry.get(entry);
  if (regex) return regex;
  const flags = entry.flags ?? 'i';
  regex = new RegExp(entry.regex, `${flags}g`);
  regexByEntry.set(entry, regex);
  return regex;
}

function findHitsForEntries(line, entries, defaultTier) {
  const hits = [];
  const lowerLine = line.toLowerCase();
  for (const e of entries) {
    const entry = typeof e === 'string' ? { keyword: e, tier: defaultTier } : e;
    if (typeof entry.regex === 'string') {
      const regex = regexForEntry(entry);
      regex.lastIndex = 0;
      let match = regex.exec(line);
      while (match !== null) {
        const matchedText = match[0];
        if (matchedText.length > 0) {
          hits.push({
            keyword: entry.keyword ?? entry.regex,
            start: match.index,
            length: matchedText.length,
            severity: entry.tier,
            entry,
          });
        }
        // Global RegExp iteration does not advance after a zero-length
        // match. Move one UTF-16 code unit so an empty pattern cannot loop.
        if (matchedText.length === 0) regex.lastIndex = match.index + 1;
        match = regex.exec(line);
      }
      continue;
    }
    const keyword = entry.keyword;
    if (typeof keyword !== 'string') continue;
    const flags = entry.flags ?? 'i';
    const haystack = flags === 'i' ? lowerLine : line;
    const needle = flags === 'i' ? keyword.toLowerCase() : keyword;
    if (needle.length === 0) continue;
    if (needle.length > haystack.length) continue;
    let from = 0;
    while (from <= haystack.length - needle.length) {
      const idx = haystack.indexOf(needle, from);
      if (idx === -1) break;
      hits.push({ keyword, start: idx, length: needle.length, severity: entry.tier, entry });
      from = idx + needle.length;
    }
  }
  return hits;
}

function recordForHit(file, lineNumber, line, hit, lens) {
  const record = {
    file: file ?? null,
    line: lineNumber,
    severity: hit.severity,
    match: line.slice(hit.start, hit.start + hit.length),
    source: hit.entry?.source ?? 'user_watchlist',
  };
  if (hit.entry?.signature) record.signature = hit.entry.signature;
  if (hit.entry?.signature) {
    const signature = hit.entry.signature;
    const source = signature.source === 'builtin' ? 'json_manifest' : 'legacy_external';
    const placement = lensPlacement(lens, source, signature.id ?? 'legacy-unknown');
    record.signature = {
      ...signature,
      lens: {
        id: lens.lens.id,
        version: lens.catalog.version,
        group: placement.group,
        priority: placement.priority,
      },
    };
  }
  return record;
}

/**
 * Non-overlapping rule: pick the leftmost hit, then the next whose
 * start is at or after the previous end. Ties on start are broken by
 * tier rank (critical beats warning beats notice beats debug). Returns
 * picks in pick-order (left-to-right).
 */
function pickHits(hits) {
  if (hits.length === 0) return [];
  const sorted = [...hits].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const aRank = rankFor(a.severity) ?? 99;
    const bRank = rankFor(b.severity) ?? 99;
    return aRank - bRank;
  });
  const picked = [];
  let end = -1;
  for (const h of sorted) {
    if (h.start >= end) {
      picked.push(h);
      end = h.start + h.length;
    }
  }
  return picked;
}

/**
 * Walk a non-pick segment on the originating line. Emit whitespace runs
 * as plain text and wrap each non-whitespace token in `wrap`, so the
 * gap between picks inherits the line color while preserving the
 * original whitespace boundaries.
 */
function wrapNonPickSegment(seg, wrap) {
  let out = '';
  let i = 0;
  while (i < seg.length) {
    if (/\s/.test(seg[i])) {
      out += seg[i];
      i += 1;
      continue;
    }
    let j = i;
    while (j < seg.length && !/\s/.test(seg[j])) j += 1;
    out += wrap + seg.slice(i, j) + ANSI.reset;
    i = j;
  }
  return out;
}

/**
 * Pick the most severe (lowest-rank) tier among the kept picks, or
 * `null` if none survived the cutoff.
 */
function worstKeptTier(picked) {
  let worst = null;
  for (const h of picked) {
    const r = rankFor(h.severity) ?? 99;
    if (worst === null) {
      worst = h.severity;
      continue;
    }
    const w = rankFor(worst) ?? 99;
    if (r < w) worst = h.severity;
  }
  return worst;
}

/**
 * Wrap each matched substring on the line with the per-tier ANSI color.
 * A picked hit whose tier is not in TIER_COLOR is rendered plain; the
 * orig-line color (when any picked hit has a color) is the most severe
 * of the kept picks.
 *
 * When `continuations` is non-empty, the joined block uniformly
 * inherits the originating line's color: between picked hits on the
 * first line, non-whitespace tokens inherit the color (whitespace stays
 * plain), and each continuation line is wrapped as a whole (preserving
 * its leading indent). The single-line behavior is unchanged when no
 * continuations are present.
 */
export function decorate(line, hits, continuations = [], options = {}) {
  const { minRank = null } = options;
  const pickedAll = pickHits(hits);
  if (pickedAll.length === 0) return line;
  const picked =
    minRank !== null ? pickedAll.filter((h) => (rankFor(h.severity) ?? 99) <= minRank) : pickedAll;
  if (picked.length === 0) return line;
  const lineSeverity = worstKeptTier(picked);
  const wrap = lineSeverity ? colorFor(lineSeverity) : null;
  const hasContinuations = continuations.length > 0;

  let out = '';
  let cursor = 0;
  for (const h of picked) {
    if (h.start > cursor) {
      const seg = line.slice(cursor, h.start);
      out += hasContinuations && wrap ? wrapNonPickSegment(seg, wrap) : seg;
    }
    const pickText = line.slice(h.start, h.start + h.length);
    out += wrap ? `${wrap}${pickText}${ANSI.reset}` : pickText;
    cursor = h.start + h.length;
  }
  if (cursor < line.length) {
    const seg = line.slice(cursor);
    out += hasContinuations && wrap ? wrapNonPickSegment(seg, wrap) : seg;
  }

  for (const cont of continuations) {
    out += `\n${wrap ? `${wrap}${cont}${ANSI.reset}` : cont}`;
  }

  return out;
}

async function* toLines(input) {
  if (typeof input === 'string') {
    if (input.length === 0) return;
    const endsWithNewline = input.endsWith('\n');
    const parts = input.split('\n');
    const tail = parts.pop();
    for (const line of parts) yield line;
    if (tail !== undefined && !(tail === '' && endsWithNewline)) yield tail;
    return;
  }
  let buffer = '';
  for await (const chunk of input) {
    buffer += String(chunk);
    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';
    for (const line of parts) yield line;
  }
  if (buffer.length > 0) yield buffer;
}

/**
 * Run the highlighter over an input source. `input` may be a string, a
 * Readable, or any AsyncIterable<string>. Returns the decorated
 * output (lines joined('\n')), an exit code (1 if any block had a
 * critical match that survived the filter, 0 otherwise), counts per
 * tier whose members survived the filter (plus the line count), and a
 * per-highlight and anomaly records arrays used by json/csv serializers.
 *
 * `file` is metadata only — when present, every record carries it;
 * when absent (or null) records carry null (stdin). It does not affect
 * detection or ordering.
 *
 * `minSeverity` optionally short-circuits the tier cutoff (a tier name
 * like "warning"); any pick whose tier rank exceeds the cutoff is
 * dropped before counting, recording, and decoration. An invalid tier
 * name causes run() to throw.
 */
export async function run({ input, watchlist, file = null, minSeverity = null, lens = defaultLens() }) {
  const selectedLens = typeof lens === 'string' ? selectLens(lens) : lens;
  const minRank =
    minSeverity === null || minSeverity === undefined
      ? null
      : (() => {
          const r = rankFor(minSeverity);
          if (r === null) throw new Error(`unknown tier "${minSeverity}"`);
          return r;
        })();

  const allLines = [];
  for await (const line of toLines(input)) allLines.push(line);
  const anomalyEvidence = scoreAnomalies(allLines);

  const counts = { lines: allLines.length };
  counts.anomalies = 0;
  let criticalCount = 0;
  const tierSeen = new Set(TIER_ORDER);
  for (const tier of Object.keys(watchlist)) {
    if (!tierSeen.has(tier)) tierSeen.add(tier);
  }
  for (const tier of tierSeen) counts[tier] = 0;

  const records = [];
  const anomalies = [];
  const outputRecords = [];
  const addMatchRecord = (record) => {
    records.push(record);
    outputRecords.push(record);
  };

  const linesHits = allLines.map((line) => {
    const hits = [];
    for (const [tier, entries] of Object.entries(watchlist)) {
      hits.push(...findHitsForEntries(line, entries, tier));
    }
    return hits;
  });

  const consumed = new Array(allLines.length).fill(false);
  const decoratedLines = [];

  for (let i = 0; i < allLines.length; i++) {
    if (consumed[i]) continue;
    const line = allLines[i];
    const hits = linesHits[i];
    const pickedAll = pickHits(hits);

    if (pickedAll.length === 0) {
      const anomaly = {
        type: 'anomaly',
        file: file ?? null,
        line: i + 1,
        text: line,
        ...anomalyEvidence[i],
      };
      anomalies.push(anomaly);
      outputRecords.push(anomaly);
      counts.anomalies += 1;
      decoratedLines.push(line);
      continue;
    }

    if (minRank !== null) {
      const filteredHits = hits.filter((h) => (rankFor(h.severity) ?? 99) <= minRank);
      const picked = pickHits(filteredHits);
      if (picked.length === 0) {
        decoratedLines.push(line);
        continue;
      }
      decoratedLines.push(decorate(line, hits, [], { minRank }));
      const winnerTier = worstKeptTier(picked, null);
      if (winnerTier !== null) {
        if (winnerTier === 'critical') criticalCount += 1;
        counts[winnerTier] = (counts[winnerTier] ?? 0) + 1;
      }
      for (const h of picked) {
          records.push(recordForHit(file, i + 1, line, h, selectedLens));
      }
      continue;
    }

    const winnerHit = pickedAll[0];
    const winnerEntry = winnerHit.entry;
    const winnerTier = winnerHit.severity;
    if (winnerTier === 'critical') criticalCount += 1;
    counts[winnerTier] = (counts[winnerTier] ?? 0) + 1;

    const anyHasMulti = pickedAll.some((h) => h.entry.multi === true);
    const anyHasContinuation = pickedAll.some((h) => h.entry.continuation !== undefined);
    const opensContinuation =
      anyHasMulti || anyHasContinuation || (i + 1 < allLines.length && /^\s/.test(allLines[i + 1]));

    const tail = [];
    if (opensContinuation) {
      const winnerCont = winnerEntry.continuation;
      const winnerContRe = winnerCont !== undefined ? new RegExp(winnerCont) : null;
      let j = i + 1;
      while (j < allLines.length) {
        const nextHits = linesHits[j];
        const nextPicked = pickHits(nextHits);
        const triggersNew = nextPicked.length > 0;
        const wsTrigger = /^\s/.test(allLines[j]);
        const contPatternTrigger = winnerContRe?.test(allLines[j]);
        const multiTrigger = winnerEntry.multi === true && !triggersNew;
        const continues = wsTrigger || contPatternTrigger || multiTrigger;
        if (!continues) break;
        tail.push(allLines[j]);
        consumed[j] = true;
        for (const h of nextPicked) {
          addMatchRecord(recordForHit(file, j + 1, allLines[j], h, selectedLens));
        }
        j += 1;
      }
    }

    decoratedLines.push(decorate(line, hits, tail));

    for (const h of pickedAll) {
      addMatchRecord(recordForHit(file, i + 1, line, h, selectedLens));
    }
  }

  const output = decoratedLines.join('\n');
  const exitCode = criticalCount > 0 ? 1 : 0;
  return { output, exitCode, counts, records, anomalies, outputRecords };
}

const FORMATS = new Set(['text', 'json', 'csv']);
const MIN_TIERS = new Set(Object.keys(TIER_RANK));

function parseFormatValue(value) {
  if (typeof value !== 'string') return { ok: false };
  if (FORMATS.has(value)) return { ok: true, value };
  return { ok: false };
}

function parseMinSeverityValue(value) {
  if (typeof value !== 'string') return { ok: false };
  if (MIN_TIERS.has(value)) return { ok: true, value };
  return { ok: true, raw: value };
}

function parseArgs(argv, env = process.env) {
  const opts = {
    watchlist: null,
    signatures: null,
    file: null,
    positional: null,
    help: false,
    formatRaw: null,
    formatError: null,
    minSeverityRaw: null,
    minSeverityError: null,
    lens: null,
  };
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      opts.help = true;
      i += 1;
      continue;
    }
    if (a === '--watchlist' || a === '-w') {
      opts.watchlist = argv[i + 1] ?? null;
      i += 2;
      continue;
    }
    if (a === '--signatures') {
      opts.signatures = argv[i + 1] ?? null;
      i += 2;
      continue;
    }
    if (a.startsWith('--signatures=')) {
      opts.signatures = a.slice('--signatures='.length);
      i += 1;
      continue;
    }
    if (a === '--lens') {
      opts.lens = argv[i + 1] ?? null;
      i += 2;
      continue;
    }
    if (a.startsWith('--lens=')) {
      opts.lens = a.slice('--lens='.length);
      i += 1;
      continue;
    }
    if (a === '--file' || a === '-f') {
      opts.file = argv[i + 1] ?? null;
      i += 2;
      continue;
    }
    if (a === '--format' || a === '-F') {
      const value = argv[i + 1] ?? null;
      const result = parseFormatValue(value);
      if (result.ok) {
        opts.formatRaw = result.value;
      } else {
        opts.formatError = value;
      }
      i += 2;
      continue;
    }
    if (a.startsWith('--format=')) {
      const value = a.slice('--format='.length);
      const result = parseFormatValue(value);
      if (result.ok) {
        opts.formatRaw = result.value;
      } else {
        opts.formatError = value;
      }
      i += 1;
      continue;
    }
    if (a === '--min-severity' || a === '--minSeverity') {
      const value = argv[i + 1] ?? null;
      const result = parseMinSeverityValue(value);
      if (result.ok && 'value' in result) {
        opts.minSeverityRaw = result.value;
      } else {
        opts.minSeverityError = value;
      }
      i += 2;
      continue;
    }
    if (a.startsWith('--min-severity=')) {
      const value = a.slice('--min-severity='.length);
      const result = parseMinSeverityValue(value);
      if (result.ok && 'value' in result) {
        opts.minSeverityRaw = result.value;
      } else {
        opts.minSeverityError = value;
      }
      i += 1;
      continue;
    }
    if (a.startsWith('--') || (a.startsWith('-') && a.length > 1)) {
      i += 1;
      continue;
    }
    opts.positional = a;
    i += 1;
  }
  if (!opts.file && opts.positional) opts.file = opts.positional;
  if (opts.formatRaw === null) {
    const envVal = env.LOGSIFT_FORMAT;
    if (envVal && envVal.length > 0) {
      const result = parseFormatValue(envVal);
      if (result.ok) {
        opts.formatRaw = result.value;
      } else {
        opts.formatError = envVal;
      }
    } else {
      opts.formatRaw = 'text';
    }
  }
  if (opts.lens === null) opts.lens = env.LOGSIFT_LENS ?? 'general-triage';
  return {
    watchlist: opts.watchlist,
    signatures: opts.signatures,
    file: opts.file,
    positional: opts.positional,
    help: opts.help,
    format: opts.formatError !== null ? null : opts.formatRaw,
    formatError: opts.formatError,
    minSeverity: opts.minSeverityError !== null ? null : opts.minSeverityRaw,
    minSeverityError: opts.minSeverityError,
    lens: opts.lens,
  };
}

function escapeCsv(field) {
  const s = String(field ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serialize a records array as json or csv. text is not handled here
 * — text mode is the existing decorated output and is rendered by
 * `main`.
 */
export function serialize(records, format) {
  if (format === 'json') {
    return `${JSON.stringify(records, null, 2)}\n`;
  }
  if (format === 'csv') {
    const header =
      'file,line,severity,match,type,text,source,signature_id,catalog,version,set,pattern,explanation,severity_rationale,false_positive_note,lens_id,lens_version,lens_group,lens_priority,anomaly_score,anomaly_confidence,anomaly_status,anomaly_inputs,anomaly_explanation,anomaly_limitations';
    const rows = records.map((r) => {
      if (r.type === 'anomaly') {
        return [
          r.file,
          r.line,
          '',
          '',
          'anomaly',
          r.text,
          ...Array(13).fill(''),
          r.score,
          r.confidence,
          r.status,
          JSON.stringify(r.inputs),
          r.explanation,
          JSON.stringify(r.limitations),
        ]
          .map(escapeCsv)
          .join(',');
      }
      const signature = r.signature ?? {};
      const lens = signature.lens ?? {};
      return [
        r.file,
        r.line,
        r.severity,
        r.match,
        'match',
        '',
        r.source ?? 'user_watchlist',
        signature.id,
        signature.catalog,
        signature.version,
        signature.set,
        signature.pattern ?? signature.name,
        signature.explanation,
        signature.severityRationale,
        signature.falsePositiveNote,
        lens.id,
        lens.version,
        lens.group,
        lens.priority,
        '',
        '',
        '',
        '',
        '',
        '',
      ]
        .map(escapeCsv)
        .join(',');
    });
    return [header, ...rows].join('\n');
  }
  return '';
}

function countsLine(counts) {
  const tiers = Object.keys(counts)
    .filter((k) => k !== 'lines')
    .sort((a, b) => (rankFor(a) ?? 99) - (rankFor(b) ?? 99));
  const tail = tiers.map((t) => `${t}=${counts[t]}`).join(' ');
  return `counts: lines=${counts.lines} ${tail}\n`;
}

function anomalySummary(anomalies) {
  if (anomalies.length === 0) return '';
  const sample = anomalies
    .slice(0, 3)
    .map(
      (anomaly) =>
        `  line ${anomaly.line}: ${anomaly.text} [score=${anomaly.score.toFixed(3)} confidence=${anomaly.confidence.toFixed(3)} status=${anomaly.status}]\n`,
    )
    .join('');
  const omitted = anomalies.length - 3;
  const omittedNote = omitted > 0 ? `  ... ${omitted} additional anomalous lines omitted\n` : '';
  return `anomalies:\n${sample}${omittedNote}`;
}

/**
 * CLI entry point. argv is the raw argument vector (no node binary
 * or script path). options can override stdin/stdout/stderr streams,
 * the env, and the process object (for setting exitCode without
 * crashing the test harness that imports this file).
 */
export { parseArgs };

export async function main(argv, options = {}) {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const stdin = options.stdin ?? process.stdin;
  const env = options.env ?? process.env;
  const proc = options.process ?? process;

  const args = parseArgs(argv, env);
  if (args.help) {
    stdout.write(HELP_TEXT);
    proc.exitCode = 0;
    return { exitCode: 0, ok: true };
  }
  if (args.formatError !== null && args.format === null) {
    stderr.write(`logsift: unknown --format value: ${args.formatError}\n`);
    proc.exitCode = 2;
    return { exitCode: 2, ok: false };
  }
  if (args.minSeverityError !== null && args.minSeverity === null) {
    stderr.write(`logsift: unknown --min-severity value: ${args.minSeverityError}\n`);
    proc.exitCode = 2;
    return { exitCode: 2, ok: false };
  }
  let lens;
  try {
    lens = selectLens(options.lens ?? args.lens);
  } catch (err) {
    stderr.write(`logsift: unknown --lens value: ${err.message}\n`);
    proc.exitCode = 2;
    return { exitCode: 2, ok: false };
  }
  const watchlistPath =
    args.watchlist ?? options.watchlistPath ?? env.LOGSIFT_WATCHLIST ?? './logsift.json';

  let watchlistRaw;
  try {
    watchlistRaw = readFileSync(watchlistPath, 'utf-8');
  } catch (err) {
    stderr.write(`logsift: cannot read watchlist ${watchlistPath}: ${err.message}\n`);
    proc.exitCode = 2;
    return { exitCode: 2, ok: false };
  }
  const wl = parseWatchlist(watchlistRaw);
  if (!wl.ok) {
    stderr.write(`logsift: invalid watchlist ${watchlistPath}: ${wl.error}\n`);
    proc.exitCode = 2;
    return { exitCode: 2, ok: false };
  }

  const signaturesPath =
    args.signatures ?? options.signaturesPath ?? env.LOGSIFT_SIGNATURES ?? null;
  let watchlist = wl.value;
  if (signaturesPath) {
    let loadedSignatures;
    try {
      loadedSignatures = loadSignatureDirectory(signaturesPath, {
        onWarning: (warning) => stderr.write(`logsift: ${warning}\n`),
      });
    } catch (err) {
      stderr.write(`logsift: cannot read signatures directory ${signaturesPath}: ${err.message}\n`);
      proc.exitCode = 2;
      return { exitCode: 2, ok: false };
    }
    watchlist = mergeWatchlists(watchlist, loadedSignatures.watchlist);
  }

  let input;
  if (args.file) {
    try {
      input = readFileSync(args.file, 'utf-8');
    } catch (err) {
      stderr.write(`logsift: cannot read input file ${args.file}: ${err.message}\n`);
      proc.exitCode = 2;
      return { exitCode: 2, ok: false };
    }
  } else {
    input = stdin;
  }

  const result = await run({
    input,
    watchlist,
    file: args.file,
    minSeverity: options.minSeverity ?? args.minSeverity,
    lens,
  });
  const format = options.format ?? args.format;
  if (format === 'text') {
    if (result.output.length > 0) {
      stdout.write(result.output);
      if (!result.output.endsWith('\n')) stdout.write('\n');
    }
  } else {
    stdout.write(serialize(result.outputRecords, format));
  }
  stderr.write(countsLine(result.counts));
  if (format === 'text') stderr.write(anomalySummary(result.anomalies));
  proc.exitCode = result.exitCode;
  return {
    exitCode: result.exitCode,
    counts: result.counts,
    records: result.records,
    anomalies: result.anomalies,
    outputRecords: result.outputRecords,
    format,
    ok: true,
  };
}

// Run when invoked as a script (`node cli/logsift.mjs ...`).
const invokedPath = process.argv[1];
if (invokedPath && pathToFileURL(invokedPath).href === import.meta.url) {
  await main(process.argv.slice(2));
}

export const _internal = { toLines, parseArgs, findHitsForEntries, TIER_RANK, ANSI, escapeCsv };

export { MINIMUM_BASELINE_LINES, normalizeLineTemplate, scoreAnomalies };

export {
  loadSignatureCatalog,
  loadSignatureDirectory,
  loadSignatureLibrary,
  loadSignatureManifest,
  loadSignatures,
  tryLoadSignatureManifest,
  validateSignatureManifest,
};
