import { describe, expect, it } from 'vitest';
import { InstallGuideResponse } from '@/lib/contracts/install';
import { installCatalog } from '@/lib/install-catalog';

describe('public install catalog', () => {
  it('keeps unpublished beta targets non-clickable and preserves the source fallback', () => {
    const catalog = InstallGuideResponse.parse(installCatalog);

    expect(catalog.releases.releaseStatus).toBe('unpublished');
    expect(catalog.releases.version).toBeNull();
    expect(catalog.releases.fallback.command).toBe('cargo install --path . --locked');
    expect(catalog.releases.platforms.map((platform) => platform.target)).toEqual([
      'x86_64-unknown-linux-gnu',
      'aarch64-apple-darwin',
      'x86_64-apple-darwin',
      'x86_64-pc-windows-msvc',
    ]);
    expect(
      catalog.releases.platforms.every((platform) => platform.availability === 'unavailable'),
    ).toBe(true);
    expect(catalog.releases.platforms.every((platform) => platform.downloadUrl === null)).toBe(
      true,
    );
    expect(catalog.releases.platforms.every((platform) => platform.sha256 === null)).toBe(true);
    expect(catalog.releases.platforms.every((platform) => platform.signatureUrl === null)).toBe(
      true,
    );
    expect(catalog.releases.verification.status).toBe('not-published');
    expect(JSON.stringify(catalog)).not.toMatch(/npm|pip|brew|v0\.1\.0/);
  });

  it('rejects an advertised installer without complete verification metadata', () => {
    const invalid = {
      ...installCatalog,
      releases: {
        ...installCatalog.releases,
        platforms: installCatalog.releases.platforms.map((platform, index) =>
          index === 0
            ? {
                ...platform,
                availability: 'available',
                downloadUrl: 'https://github.com/dorman/traceglass/releases/download/v0.2.0/installer',
              }
            : platform,
        ),
      },
    };
    expect(InstallGuideResponse.safeParse(invalid).success).toBe(false);
  });
});
