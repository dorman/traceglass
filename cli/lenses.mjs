// @polsia:user-owned — compatibility adapter for the shared deterministic lens catalog.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_CATALOG = new URL('../traceglass/lenses/v0.1.0/catalog.json', import.meta.url);

function nonEmpty(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} must be non-empty`);
}

export function validateLensCatalog(raw) {
  nonEmpty(raw?.catalog, 'catalog');
  nonEmpty(raw?.version, 'version');
  if (!/^v\d+\.\d+\.\d+$/.test(raw.version)) throw new Error(`invalid lens catalog version "${raw.version}"`);
  if (!Array.isArray(raw.lenses) || raw.lenses.length === 0) throw new Error('lens catalog must contain lenses');
  const lensIds = new Set();
  for (const lens of raw.lenses) {
    if (!/^[a-z][a-z0-9-]{0,62}$/.test(lens.id)) throw new Error(`invalid lens id "${lens.id}"`);
    if (!lensIds.add(lens.id)) throw new Error(`duplicate lens id "${lens.id}"`);
    nonEmpty(lens.title, `title for ${lens.id}`);
    nonEmpty(lens.description, `description for ${lens.id}`);
    if (!Array.isArray(lens.groups) || lens.groups.length === 0) throw new Error(`lens ${lens.id} has no groups`);
    const groupIds = new Set();
    const refs = new Set();
    let lastPriority = -1;
    let fallbacks = 0;
    for (const group of lens.groups) {
      if (!/^[a-z][a-z0-9-]{0,62}$/.test(group.id) || !groupIds.add(group.id)) throw new Error(`duplicate or invalid group ${lens.id}/${group.id}`);
      nonEmpty(group.title, `title for ${lens.id}/${group.id}`);
      nonEmpty(group.description, `description for ${lens.id}/${group.id}`);
      if (!Number.isInteger(group.priority) || group.priority < 0 || group.priority < lastPriority) throw new Error(`invalid group priority in ${lens.id}/${group.id}`);
      lastPriority = group.priority;
      if (group.fallback === true) fallbacks += 1;
      if (!Array.isArray(group.references)) throw new Error(`references missing in ${lens.id}/${group.id}`);
      for (const reference of group.references) {
        if (!['rust_builtin', 'json_manifest'].includes(reference.source) || !/^[a-z][a-z0-9-]{0,62}$/.test(reference.id)) throw new Error(`invalid reference ${lens.id}/${group.id}`);
        const key = `${reference.source}:${reference.id}`;
        if (!refs.add(key)) throw new Error(`duplicate reference ${key} in ${lens.id}`);
      }
    }
    if (fallbacks !== 1) throw new Error(`lens ${lens.id} must have exactly one fallback group`);
  }
  return raw;
}

export function loadLensCatalog(path = DEFAULT_CATALOG) {
  const filePath =
    typeof path === 'string'
      ? path
      : path.protocol === 'file:'
        ? fileURLToPath(path)
        : resolve(process.cwd(), 'traceglass/lenses/v0.1.0/catalog.json');
  const raw = JSON.parse(readFileSync(filePath, 'utf8'));
  return validateLensCatalog(raw);
}

export function selectLens(id = 'general-triage', catalog = loadLensCatalog()) {
  const lens = catalog.lenses.find((candidate) => candidate.id === id);
  if (!lens) throw new Error(`unknown lens "${id}"`);
  return { catalog, lens };
}

export function lensPlacement(selection, source, id) {
  const { lens } = selection;
  for (const [groupOrder, group] of lens.groups.entries()) {
    if (group.references.some((reference) => reference.source === source && reference.id === id)) return { group: group.id, groupTitle: group.title, priority: group.priority, groupOrder };
  }
  const fallbackOrder = lens.groups.findIndex((group) => group.fallback === true);
  const fallback = lens.groups[fallbackOrder];
  return { group: fallback.id, groupTitle: fallback.title, priority: fallback.priority, groupOrder: fallbackOrder };
}

export function defaultLens() {
  return selectLens('general-triage');
}
