// @polsia:user-owned — deterministic, local-only anomaly evidence for the
// legacy LogSift Node CLI. This module has no persistence or network surface.

export const MINIMUM_BASELINE_LINES = 5;

const LIMITATIONS = [
  'Template rarity is the only scored feature in this phase.',
  'The baseline is limited to this local run and may not represent longer-lived normal behavior.',
  'This evidence is supplementary and is not a clean, infected, or security verdict.',
];

const TIMESTAMP_RE =
  /\b(?:\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:z|[+-]\d{2}:?\d{2})?|\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)\b/gi;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const NUMBER_RE = /\b\d+\b/g;

/**
 * Convert a local line into a stable shape. Dynamic values are replaced before
 * generic numbers so timestamps, addresses, UUIDs, and numeric identifiers do
 * not make otherwise equivalent log lines look different.
 */
export function normalizeLineTemplate(line) {
  return String(line)
    .trim()
    .toLowerCase()
    .replace(TIMESTAMP_RE, '<timestamp>')
    .replace(UUID_RE, '<uuid>')
    .replace(IPV4_RE, '<ip>')
    .replace(NUMBER_RE, '<number>')
    .replace(/\s+/g, ' ');
}

function bounded(value) {
  return Math.max(0, Math.min(1, value));
}

function rounded(value) {
  return Math.round(bounded(value) * 1_000_000) / 1_000_000;
}

/**
 * Score every local line against a leave-one-out frequency baseline.
 *
 * A score of 0 means the line's normalized template is as common as the
 * leave-one-out sample permits; a score near 1 means its template has little
 * or no support in that sample. The returned array keeps the input order.
 */
export function scoreAnomalies(lines, options = {}) {
  const sourceLines = Array.from(lines, (line) => String(line));
  const minimumBaseline = Math.max(
    1,
    Math.floor(options.minimumBaseline ?? MINIMUM_BASELINE_LINES),
  );
  const templates = sourceLines.map(normalizeLineTemplate);
  const frequencies = new Map();
  for (const template of templates) {
    frequencies.set(template, (frequencies.get(template) ?? 0) + 1);
  }

  return templates.map((template) => {
    const baselineSize = sourceLines.length - 1;
    const templateSupport = (frequencies.get(template) ?? 1) - 1;
    const sufficient = baselineSize >= minimumBaseline;
    const score = sufficient ? rounded(1 - templateSupport / baselineSize) : 0;
    const confidence = sufficient ? rounded(baselineSize / (minimumBaseline * 2)) : 0;
    const status = sufficient ? 'scored' : 'insufficient_baseline';
    const inputs = {
      template,
      baselineSize,
      templateSupport,
      distinctTemplates: frequencies.size,
      minimumBaseline,
      leaveOneOut: true,
    };
    const explanation = sufficient
      ? `Normalized template has ${templateSupport} supporting line(s) in the ${baselineSize}-line leave-one-out baseline; rarity produces a ${score.toFixed(3)} score.`
      : `Only ${baselineSize} baseline line(s) remain after leaving this line out; at least ${minimumBaseline} are required for a comparison.`;
    const limitations = sufficient
      ? [...LIMITATIONS]
      : [
          `At least ${minimumBaseline} baseline lines are required before rarity is scored.`,
          ...LIMITATIONS,
        ];

    return {
      score,
      confidence,
      status,
      inputs,
      explanation,
      limitations,
    };
  });
}
