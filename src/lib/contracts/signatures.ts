// Versioned shared signature library: zod contract + pure loader for the
// curated JSON manifests under `signatures/<version>/<set>.json`. The Rust
// CLI can parse the same JSON directly; this module exists for the Node/TS
// stack only.
//
// Pure by design — does NOT read the filesystem; pass parsed JSON in via
// `loadSignatureManifest(json)` and import `SignatureManifest` for validation
// without I/O. Server-action-banned surfacing: nothing in this file pulls in
// `server-only`, Prisma, or filesystem APIs.

import { z } from 'zod';

/**
 * Closed set of severities. Aligned with the legacy `TIER_RANK` map in
 * `cli/logsift.mjs`: `critical < warning < notice < debug`. We deliberately
 * DO NOT include `info` here — the signature library is a separate catalog
 * and never needs the legacy `info` alias; consumers that already include
 * `info` for watchlist parity can map it locally if they want to.
 */
export const SIGNATURE_SEVERITIES = ['critical', 'warning', 'notice', 'debug'] as const;
export type SignatureSeverityT = (typeof SIGNATURE_SEVERITIES)[number];

export const SignatureSeverity = z.enum(SIGNATURE_SEVERITIES);

/** Kebab-case set id: starts lowercase, [a-z0-9-], 1-63 chars. */
const Kebab = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,62}$/, 'set id must be kebab-case (lowercase, [a-z0-9-], ≤ 63)');

/** vMAJOR.MINOR.PATCH (one literal `v` prefix). */
const SemVerV = z
  .string()
  .regex(/^v\d+\.\d+\.\d+$/, 'version must look like vMAJOR.MINOR.PATCH (e.g. v0.1.0)');

/**
 * Closed set of regex flag strings in v0.1.0. We deliberately limit to a
 * one-flag shape ('i' or empty) so behaviour stays tool-agnostic; the same
 * passes to the Rust CLI without surprises. Default is 'i' for both
 * `string` and `regex` matches so consumers that don't carry their own flag
 * still behave legacily.
 */
const FlagsString = z
  .union([z.literal(''), z.literal('i')])
  .optional()
  .describe('regex flags: "" (case-sensitive) or "i" (case-IN-sensitive)');

/** Stable identity and audit metadata for a trusted shipped pattern. */
export const SignatureId = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,62}$/, 'pattern id must be lower-kebab-case');

export const SignatureExamples = z.object({
  positive: z.string().min(1),
  negative: z.string().min(1),
});

/**
 * Per-pattern match rule: a literal OR a regex.
 *
 * We use a custom refinement instead of z.union / z.discriminatedUnion
 * because the latter accepts BOTH `string` and `regex` in the same shape
 * (zod can't enforce "exactly one key" via .union). The custom check
 * enforces "exactly one of string/regex is set, the other is absent;
 * flags is optional and falls back to a default at compile time."
 */
export const SignatureMatchRule = z
  .object({
    string: z.string().min(1).optional(),
    regex: z.string().min(1).optional(),
    flags: FlagsString,
  })
  .refine(
    (m) => {
      const hasString = typeof m.string === 'string';
      const hasRegex = typeof m.regex === 'string';
      return hasString !== hasRegex;
    },
    { message: 'match must declare exactly one of `string` or `regex`' },
  );
export type SignatureMatch = z.infer<typeof SignatureMatchRule>;

export const SignaturePattern = z.object({
  name: z.string().min(1, 'pattern `name` is required'),
  severity: SignatureSeverity,
  match: SignatureMatchRule,
  // Optional for legacy external manifests. Shipped catalogs require the full
  // block in the catalog-quality regression suite and the Node loader marks
  // entries without it as legacy rather than builtin evidence.
  id: SignatureId.optional(),
  explanation: z.string().min(1).optional(),
  severityRationale: z.string().min(1).optional(),
  falsePositiveNote: z.string().min(1).optional(),
  examples: SignatureExamples.optional(),
});
export type SignaturePatternT = z.infer<typeof SignaturePattern>;

export const SignatureManifest = z.object({
  version: SemVerV,
  set: Kebab,
  title: z.string().min(1),
  description: z.string(),
  patterns: z.array(SignaturePattern).min(1, 'patterns must be non-empty'),
  notes: z.string().optional(),
});

export type SignatureManifestT = z.infer<typeof SignatureManifest>;

/**
 * Client-safe response shape for the public signature catalog preview. The
 * manifest fields stay aligned with the source contract while the server adds
 * presentation-safe samples and canonical source links.
 */
export const SignatureCatalogSet = z.object({
  set: SignatureManifest.shape.set,
  title: z.string().min(1),
  description: z.string(),
  version: SignatureManifest.shape.version,
  severity: SignatureSeverity,
  sample: z.array(z.string().min(1)).min(3).max(5),
  manifestHref: z.string().url(),
});

export type SignatureCatalogSet = z.infer<typeof SignatureCatalogSet>;

export const SignatureCatalogResponse = z.object({
  eyebrow: z.string().min(1),
  heading: z.string().min(1),
  intro: z.string().min(1),
  version: SignatureManifest.shape.version,
  sets: z.array(SignatureCatalogSet),
});

export type SignatureCatalogResponse = z.infer<typeof SignatureCatalogResponse>;

export interface CompiledMatcher {
  name: string;
  id?: string;
  severity: SignatureSeverityT;
  provenance: SignatureProvenance;
  test: (line: string) => boolean;
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
}

export interface LoadedSignature {
  manifest: SignatureManifestT;
  matchers: CompiledMatcher[];
  trust: 'builtin' | 'legacy';
}

function manifestTrust(manifest: SignatureManifestT): 'builtin' | 'legacy' {
  const names = new Set<string>();
  const ids = new Set<string>();
  for (const pattern of manifest.patterns) {
    if (names.has(pattern.name)) throw new Error(`duplicate pattern name "${pattern.name}"`);
    names.add(pattern.name);
    if (pattern.id !== undefined) {
      if (ids.has(pattern.id)) throw new Error(`duplicate pattern id "${pattern.id}"`);
      ids.add(pattern.id);
    }
  }
  const hasQuality = manifest.patterns.map((pattern) =>
    [
      pattern.id,
      pattern.explanation,
      pattern.severityRationale,
      pattern.falsePositiveNote,
      pattern.examples,
    ].some((value) => value !== undefined),
  );
  if (hasQuality.some(Boolean) && !hasQuality.every(Boolean)) {
    throw new Error('pattern quality metadata must be complete or omitted for a legacy manifest');
  }
  return hasQuality[0] ? 'builtin' : 'legacy';
}

function provenanceFor(
  manifest: SignatureManifestT,
  pattern: SignaturePatternT,
  trust: 'builtin' | 'legacy',
): SignatureProvenance {
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
 * Compile a single pattern's match rule into a matcher. The default for
 * regex matches is `'i'` so the contract matches legacy TraceGlass behaviour
 * (case-IN-sensitive); string matches follow the same default for parity.
 */
function compileMatcher(pattern: SignaturePatternT): Omit<CompiledMatcher, 'provenance'> {
  const m = pattern.match;
  const flags = m.flags ?? 'i';
  if (typeof m.string === 'string') {
    const needle = flags === 'i' ? m.string.toLowerCase() : m.string;
    return {
      name: pattern.name,
      severity: pattern.severity,
      test: (line: string) => {
        const haystack = flags === 'i' ? line.toLowerCase() : line;
        return haystack.includes(needle);
      },
    };
  }
  // The other branch is guaranteed by SignatureMatchRule’s refine: if it
  // wasn't `string`, it's `regex`. We still assert non-undefined at runtime
  // so a future schema change to the rule doesn’t silently emit `undefined`.
  if (typeof m.regex !== 'string') {
    throw new Error(
      `pattern "${pattern.name}" match is missing both string and regex source — should have been rejected upstream`,
    );
  }
  const re = new RegExp(m.regex, flags);
  return {
    name: pattern.name,
    severity: pattern.severity,
    test: (line: string) => re.test(line),
  };
}

/**
 * Pure loader. Takes parsed JSON and returns the typed manifest plus
 * compiled per-pattern matchers. The function is intentionally pure (no
 * `fs`, no `path`) so it is callable from any environment — including a
 * minimal `node --eval` test harness — and the Rust CLI can mirror its
 * behaviour 1:1.
 *
 * Throws on validation failure (use `SignatureManifest.safeParse` upstream
 * to gather field errors). Safe to call multiple times with the same input;
 * `compileKey()` in tests can re-use the regulated output.
 */
export function loadSignatureManifest(parsed: unknown): LoadedSignature {
  const result = SignatureManifest.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    throw new Error(`invalid signature manifest: ${issues}`);
  }
  const manifest = result.data;
  const trust = manifestTrust(manifest);
  return {
    manifest,
    trust,
    matchers: manifest.patterns.map((pattern) => {
      const provenance = provenanceFor(manifest, pattern, trust);
      return { ...compileMatcher(pattern), id: provenance.id, provenance };
    }),
  };
}

/**
 * Convenience helper for tests that want both safeParse + loader in one
 * call. Returns either { ok: true, value } or { ok: false, error } so the
 * caller can branch on validity.
 */
export function tryLoadSignatureManifest(
  parsed: unknown,
): { ok: true; value: LoadedSignature } | { ok: false; error: string } {
  const probe = SignatureManifest.safeParse(parsed);
  if (!probe.success) {
    const issueText = probe.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    return { ok: false, error: issueText };
  }
  try {
    return { ok: true, value: loadSignatureManifest(parsed) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
