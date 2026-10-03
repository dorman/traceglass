// @polsia:user-owned — filesystem loader for the versioned LogSift signature library.
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { z } from 'zod';

const SIGNATURE_TIERS = ['critical', 'warning', 'notice', 'debug'];

const NonEmptyText = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, { message: 'must not be empty or whitespace-only' });

const SignatureId = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,62}$/, 'must be lower-kebab-case, 1-63 characters');

const SignatureExamplesSchema = z.object({
  positive: NonEmptyText,
  negative: NonEmptyText,
});

const SignatureQualitySchema = z.object({
  id: SignatureId,
  explanation: NonEmptyText,
  severityRationale: NonEmptyText,
  falsePositiveNote: NonEmptyText,
  examples: SignatureExamplesSchema,
});

const SignatureMatchSchema = z
  .object({
    string: NonEmptyText.optional(),
    regex: NonEmptyText.optional(),
    flags: z.union([z.literal(''), z.literal('i')]).optional(),
  })
  .refine((match) => (typeof match.string === 'string') !== (typeof match.regex === 'string'), {
    message: 'match must declare exactly one of `string` or `regex`',
  });

const SignaturePatternSchema = z.object({
  name: NonEmptyText,
  severity: z.enum(SIGNATURE_TIERS),
  match: SignatureMatchSchema,
  // Optional here for backward compatibility with external legacy manifests.
  // Shipped catalogs are checked as trusted below and require the full block.
  id: SignatureId.optional(),
  explanation: NonEmptyText.optional(),
  severityRationale: NonEmptyText.optional(),
  falsePositiveNote: NonEmptyText.optional(),
  examples: SignatureExamplesSchema.optional(),
});

const SignatureManifestSchema = z.object({
  version: z.string().regex(/^v\d+\.\d+\.\d+$/, 'must look like vMAJOR.MINOR.PATCH'),
  set: z.string().regex(/^[a-z][a-z0-9-]{0,62}$/, 'must be lower-kebab-case, 1-63 characters'),
  title: NonEmptyText,
  description: NonEmptyText,
  patterns: z.array(SignaturePatternSchema).min(1, 'patterns must be non-empty'),
  notes: z.string().optional(),
});

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function formatValidationIssues(issues) {
  return issues
    .map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : '<root>'}: ${issue.message}`)
    .join('; ');
}

function trustForPattern(pattern) {
  const hasQuality =
    pattern.id !== undefined ||
    pattern.explanation !== undefined ||
    pattern.severityRationale !== undefined ||
    pattern.falsePositiveNote !== undefined ||
    pattern.examples !== undefined;
  if (!hasQuality) return 'legacy';
  const quality = SignatureQualitySchema.safeParse(pattern);
  if (!quality.success) {
    throw new Error(formatValidationIssues(quality.error.issues));
  }
  return 'builtin';
}

function trustForManifest(manifest) {
  const trusts = manifest.patterns.map(trustForPattern);
  if (trusts.includes('legacy') && trusts.includes('builtin')) {
    throw new Error('pattern quality metadata must be complete or omitted for a legacy manifest');
  }
  return trusts[0] ?? 'legacy';
}

/**
 * Validate a parsed manifest without touching the filesystem. The return
 * shape mirrors the CLI's other parse helpers so callers can report malformed
 * children without aborting a whole directory load.
 */
export function validateSignatureManifest(parsed) {
  const result = SignatureManifestSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: formatValidationIssues(result.error.issues) };
  }
  return { ok: true, value: result.data };
}

function compileSignatureRegex(source, flags, patternName) {
  try {
    return new RegExp(source, `${flags}g`);
  } catch (error) {
    throw new Error(`pattern "${patternName}" has invalid regex: ${errorMessage(error)}`);
  }
}

function makeProvenance(manifest, pattern, trust) {
  if (trust === 'builtin') {
    return {
      source: 'builtin',
      catalog: 'logsift-json-manifests',
      trust: 'trusted',
      id: pattern.id,
      version: manifest.version,
      set: manifest.set,
      pattern: pattern.name,
      name: pattern.name,
      explanation: pattern.explanation,
      severityRationale: pattern.severityRationale,
      falsePositiveNote: pattern.falsePositiveNote,
      examples: pattern.examples,
    };
  }
  return {
    source: 'legacy_external',
    catalog: 'external-legacy',
    trust: 'legacy',
    version: manifest.version,
    set: manifest.set,
    pattern: pattern.name,
    name: pattern.name,
  };
}

/**
 * Validate and compile one parsed signature manifest. Regex sources are
 * compiled during this step so a bad pattern is rejected before it can enter
 * the unified watchlist.
 */
export function loadSignatureManifest(parsed) {
  const checked = validateSignatureManifest(parsed);
  if (!checked.ok) throw new Error(`invalid signature manifest: ${checked.error}`);

  const manifest = checked.value;
  const trust = trustForManifest(manifest);
  const names = new Set();
  const ids = new Set();
  for (const pattern of manifest.patterns) {
    if (names.has(pattern.name)) {
      throw new Error(`duplicate pattern name "${pattern.name}"`);
    }
    names.add(pattern.name);
    if (trust === 'builtin') {
      if (ids.has(pattern.id)) throw new Error(`duplicate pattern id "${pattern.id}"`);
      ids.add(pattern.id);
    }
  }
  const watchlist = Object.fromEntries(SIGNATURE_TIERS.map((tier) => [tier, []]));
  const entries = [];
  const matchers = [];

  for (const pattern of manifest.patterns) {
    const flags = pattern.match.flags ?? 'i';
    const provenance = makeProvenance(manifest, pattern, trust);
    const isLiteral = typeof pattern.match.string === 'string';
    const entry = isLiteral
      ? {
          keyword: pattern.match.string,
          tier: pattern.severity,
          flags,
          source: provenance.source,
          signature: provenance,
        }
      : {
          // Keep the existing watchlist keyword field populated for callers
          // that inspect entries; matching uses the retained regex source.
          keyword: pattern.name,
          regex: pattern.match.regex,
          tier: pattern.severity,
          flags,
          source: provenance.source,
          signature: provenance,
        };

    if (isLiteral) {
      const needle = flags === 'i' ? pattern.match.string.toLowerCase() : pattern.match.string;
      matchers.push({
        name: pattern.name,
        id: provenance.id,
        severity: pattern.severity,
        flags,
        source: pattern.match.string,
        provenance,
        explanation: provenance.explanation,
        severityRationale: provenance.severityRationale,
        falsePositiveNote: provenance.falsePositiveNote,
        test: (line) => (flags === 'i' ? line.toLowerCase() : line).includes(needle),
      });
    } else {
      compileSignatureRegex(pattern.match.regex, flags, pattern.name);
      const testRegex = new RegExp(pattern.match.regex, flags);
      matchers.push({
        name: pattern.name,
        id: provenance.id,
        severity: pattern.severity,
        flags,
        source: pattern.match.regex,
        provenance,
        explanation: provenance.explanation,
        severityRationale: provenance.severityRationale,
        falsePositiveNote: provenance.falsePositiveNote,
        test: (line) => {
          testRegex.lastIndex = 0;
          return testRegex.test(line);
        },
      });
    }

    watchlist[pattern.severity].push(entry);
    entries.push(entry);
  }

  return { manifest, entries, watchlist, matchers, trust };
}

/**
 * Convenience helper for callers that want a non-throwing manifest result.
 */
export function tryLoadSignatureManifest(parsed) {
  try {
    return { ok: true, value: loadSignatureManifest(parsed) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

function comparePaths(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function discoverJsonFiles(rootPath, warn) {
  const files = [];

  function walk(directory, isRoot) {
    let children;
    try {
      children = readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if (isRoot) throw error;
      warn(`skipping ${directory}: cannot read directory: ${errorMessage(error)}`);
      return;
    }

    children.sort((left, right) => comparePaths(left.name, right.name));
    for (const child of children) {
      const childPath = join(directory, child.name);
      if (child.isDirectory()) {
        walk(childPath, false);
      } else if (child.isFile() && extname(child.name) === '.json') {
        files.push(childPath);
      }
    }
  }

  walk(rootPath, true);
  files.sort(comparePaths);
  return files;
}

function emptyTierCounts() {
  return Object.fromEntries(SIGNATURE_TIERS.map((tier) => [tier, 0]));
}

function addEntryToCounts(counts, entry) {
  counts[entry.tier] = (counts[entry.tier] ?? 0) + 1;
}

function warningHandler(options, warnings) {
  const callback = typeof options === 'function' ? options : (options.onWarning ?? options.warn);
  return (message) => {
    warnings.push(message);
    if (callback) {
      callback(message);
    } else {
      process.stderr.write(`${message}\n`);
    }
  };
}

/**
 * Recursively load JSON signature manifests in deterministic path order.
 * Invalid child files produce warnings and are skipped; failure to open the
 * selected root directory is intentionally allowed to throw for the CLI to
 * turn into its usage/read error (exit code 2).
 */
export function loadSignatureDirectory(directory, options = {}) {
  const warnings = [];
  const warn = warningHandler(options, warnings);
  const files = discoverJsonFiles(directory, warn);
  const watchlist = Object.fromEntries(SIGNATURE_TIERS.map((tier) => [tier, []]));
  const entries = [];
  const manifests = [];
  const counts = emptyTierCounts();
  const countsBySet = {};
  const trustedIdentities = new Map();

  for (const filePath of files) {
    let raw;
    try {
      raw = readFileSync(filePath, 'utf8');
    } catch (error) {
      warn(`skipping ${filePath}: cannot read manifest: ${errorMessage(error)}`);
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      warn(`skipping ${filePath}: invalid JSON: ${errorMessage(error)}`);
      continue;
    }

    let loaded;
    try {
      loaded = loadSignatureManifest(parsed);
    } catch (error) {
      warn(`skipping ${filePath}: ${errorMessage(error)}`);
      continue;
    }

    // schema.json is a deliberately valid format crib, not an operational
    // set. The reserved set id is the source-of-truth exclusion marker.
    if (loaded.manifest.set === 'schema-example') continue;

    if (loaded.trust === 'builtin') {
      const identityEntries = loaded.entries.map((entry) => {
        const signature = entry.signature;
        return [
          signature?.id,
          JSON.stringify({
            set: signature?.set,
            pattern: signature?.pattern,
            keyword: entry.keyword,
            regex: entry.regex,
            flags: entry.flags,
            tier: entry.tier,
          }),
        ];
      });
      const collision = identityEntries.find(([id, identity]) => {
        if (!id) return false;
        const previous = trustedIdentities.get(id);
        if (previous === undefined) {
          trustedIdentities.set(id, identity);
          return false;
        }
        return previous !== identity;
      });
      if (collision) {
        warn(
          `skipping ${filePath}: trusted signature id "${collision[0]}" changes identity across manifests`,
        );
        continue;
      }
    }

    manifests.push(loaded.manifest);
    for (const entry of loaded.entries) {
      watchlist[entry.tier].push(entry);
      entries.push(entry);
      addEntryToCounts(counts, entry);

      let setCounts = countsBySet[entry.signature.set];
      if (!setCounts) {
        setCounts = emptyTierCounts();
        countsBySet[entry.signature.set] = setCounts;
      }
      addEntryToCounts(setCounts, entry);
    }
  }

  return {
    directory,
    files,
    manifests,
    entries,
    watchlist,
    counts,
    countsBySet,
    warnings,
  };
}

export const loadSignatures = loadSignatureDirectory;
export const loadSignatureCatalog = loadSignatureDirectory;
export const loadSignatureLibrary = loadSignatureDirectory;
