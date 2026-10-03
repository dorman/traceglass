// @polsia:user-owned — pure shared contract for deterministic LogSift lenses.
import { z } from 'zod';

const Kebab = z.string().regex(/^[a-z][a-z0-9-]{0,62}$/);
const Version = z.string().regex(/^v\d+\.\d+\.\d+$/);
const NonEmpty = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0);

export const LensReference = z.object({
  source: z.enum(['rust_builtin', 'json_manifest']),
  id: Kebab,
});

export const LensGroup = z.object({
  id: Kebab,
  title: NonEmpty,
  description: NonEmpty,
  priority: z.number().int().nonnegative(),
  references: z.array(LensReference),
  fallback: z.boolean().optional(),
});

export const Lens = z.object({
  id: Kebab,
  title: NonEmpty,
  description: NonEmpty,
  groups: z.array(LensGroup).min(1),
});

export const LensCatalog = z.object({
  catalog: Kebab,
  version: Version,
  title: NonEmpty,
  description: NonEmpty,
  lenses: z.array(Lens).min(1),
});

export type LensReferenceT = z.infer<typeof LensReference>;
export type LensGroupT = z.infer<typeof LensGroup>;
export type LensT = z.infer<typeof Lens>;
export type LensCatalogT = z.infer<typeof LensCatalog>;

export type LensInventoryEntry = LensReferenceT & { version?: string; set?: string };

export type LensValidationResult = { ok: true; value: LensCatalogT } | { ok: false; error: string };

/** Validate shape and deterministic catalog invariants without filesystem or server imports. */
export function validateLensCatalog(
  input: unknown,
  inventory: readonly LensInventoryEntry[] = [],
): LensValidationResult {
  const parsed = LensCatalog.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join('; ') };
  }
  const catalog = parsed.data;
  if (catalog.catalog !== 'logsift-lenses') {
    return { ok: false, error: `unsupported lens catalog "${catalog.catalog}"` };
  }
  const lensIds = new Set<string>();
  const known = new Set(inventory.map((entry) => `${entry.source}:${entry.id}`));
  for (const lens of catalog.lenses) {
    if (!lensIds.add(lens.id)) return { ok: false, error: `duplicate lens id "${lens.id}"` };
    const groupIds = new Set<string>();
    const references = new Set<string>();
    let lastPriority = -1;
    let fallbackCount = 0;
    for (const group of lens.groups) {
      if (!groupIds.add(group.id))
        return { ok: false, error: `duplicate group id "${group.id}" in ${lens.id}` };
      if (group.priority < lastPriority)
        return { ok: false, error: `group priorities are not stable in ${lens.id}` };
      lastPriority = group.priority;
      if (group.fallback) fallbackCount += 1;
      for (const reference of group.references) {
        const key = `${reference.source}:${reference.id}`;
        if (references.has(key))
          return { ok: false, error: `duplicate reference "${key}" in ${lens.id}` };
        references.add(key);
        if (known.size > 0 && !known.has(key))
          return { ok: false, error: `unknown reference "${key}"` };
      }
    }
    if (fallbackCount !== 1)
      return { ok: false, error: `${lens.id} must have exactly one fallback group` };
  }
  return { ok: true, value: catalog };
}
