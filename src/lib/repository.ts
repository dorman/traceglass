// @polsia:user-owned — shared client-safe repository configuration.

export const canonicalRepositoryUrl = 'https://github.com/dorman/loglens';
export const canonicalReleasesUrl = `${canonicalRepositoryUrl}/releases`;

export function canonicalRepositoryBlobUrl(path: string): string {
  return `${canonicalRepositoryUrl}/blob/main/${path}`;
}
