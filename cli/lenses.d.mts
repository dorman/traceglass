// @polsia:user-owned — declarations for the compatibility lens adapter.
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

export function validateLensCatalog(raw: unknown): LensCatalog;
export function loadLensCatalog(path?: string | URL): LensCatalog;
export function selectLens(id?: string, catalog?: LensCatalog): LensSelection;
export function lensPlacement(
  selection: LensSelection,
  source: string,
  id: string,
): { group: string; groupTitle: string; priority: number; groupOrder: number };
export function defaultLens(): LensSelection;
