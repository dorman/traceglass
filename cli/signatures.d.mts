// @polsia:user-owned — declarations for the deprecated compatibility loader.
export function loadSignatureDirectory(
  directory: string,
  options?: { onWarning?: (message: string) => void; warn?: (message: string) => void },
): {
  directory: string;
  files: string[];
  manifests: unknown[];
  entries: unknown[];
  watchlist: Record<string, unknown[]>;
  counts: Record<string, number>;
  countsBySet: Record<string, Record<string, number>>;
  warnings: string[];
};
export const loadSignatureCatalog: typeof loadSignatureDirectory;
export const loadSignatureLibrary: typeof loadSignatureDirectory;
export const loadSignatures: typeof loadSignatureDirectory;
export interface LoadedSignatureManifest {
  trust: 'builtin' | 'legacy';
  entries: Array<{ source: 'builtin' | 'legacy_external'; keyword?: string }>;
  watchlist: Record<string, unknown[]>;
  matchers: unknown[];
  manifest: unknown;
}
export function loadSignatureManifest(parsed: unknown): LoadedSignatureManifest;
export function tryLoadSignatureManifest(parsed: unknown):
  | { ok: true; value: LoadedSignatureManifest }
  | { ok: false; error: string };
export function validateSignatureManifest(parsed: unknown):
  | { ok: true; value: unknown }
  | { ok: false; error: string };
