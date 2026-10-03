// @polsia:user-owned — typed static release catalog for the public install API.
import { canonicalReleasesUrl } from '@/lib/repository';

const unavailablePlatform = (platform: {
  name: string;
  os: 'Linux' | 'macOS' | 'Windows';
  architecture: string;
  target: string;
  installerName: string;
  installerFormat: 'binary' | 'exe';
  note: string;
}) => ({
  ...platform,
  availability: 'unavailable' as const,
  downloadUrl: null,
  sha256: null,
  signatureUrl: null,
  signingKeyId: null,
  permissionNote:
    'The beta installer will default to a current-user location and ask before PATH or shortcut changes.',
  launchNote:
    'After explicit consent, it will open a new terminal and start the no-argument interactive TUI.',
});

export const installCatalog = {
  releases: {
    releaseStatus: 'unpublished' as const,
    version: null,
    heading: 'One-click beta installers are being prepared',
    description:
      'The signed installer path is the planned beta experience. Downloads stay disabled until the matching release artifacts and signed manifest are published.',
    releasePageUrl: canonicalReleasesUrl,
    verification: {
      manifestUrl: null,
      manifestSignatureUrl: null,
      signatureScheme: 'Ed25519' as const,
      signingKeyId: 'loglens-release-ed25519-2026',
      status: 'not-published' as const,
      osSigningLimitations:
        'Release signatures verify the publisher and payload. Windows Authenticode, macOS Developer ID, and notarization are separate publisher credentials and are not claimed until configured.',
    },
    platforms: [
      unavailablePlatform({
        name: 'Linux · x86_64 · glibc',
        os: 'Linux',
        architecture: 'x86_64',
        target: 'x86_64-unknown-linux-gnu',
        installerName: 'loglens-installer-x86_64-unknown-linux-gnu',
        installerFormat: 'binary',
        note: 'Planned target: glibc-based Linux on Intel or AMD 64-bit systems.',
      }),
      unavailablePlatform({
        name: 'macOS · Apple silicon',
        os: 'macOS',
        architecture: 'aarch64',
        target: 'aarch64-apple-darwin',
        installerName: 'loglens-installer-aarch64-apple-darwin',
        installerFormat: 'binary',
        note: 'Planned target: macOS on Apple silicon.',
      }),
      unavailablePlatform({
        name: 'macOS · Intel',
        os: 'macOS',
        architecture: 'x86_64',
        target: 'x86_64-apple-darwin',
        installerName: 'loglens-installer-x86_64-apple-darwin',
        installerFormat: 'binary',
        note: 'Planned target: macOS on Intel Macs.',
      }),
      unavailablePlatform({
        name: 'Windows · x86_64',
        os: 'Windows',
        architecture: 'x86_64',
        target: 'x86_64-pc-windows-msvc',
        installerName: 'loglens-installer-x86_64-pc-windows-msvc.exe',
        installerFormat: 'exe',
        note: 'Planned target: 64-bit Windows on the MSVC toolchain.',
      }),
    ],
    fallback: {
      label: 'Technical fallback: build from source',
      command: 'cargo install --path . --locked',
      details:
        'Rust 1.85+ is required. This is for contributors and technical users while the signed beta installers remain unpublished.',
      docsUrl: 'https://github.com/dorman/loglens/blob/master/docs/USER_GUIDE.md',
    },
  },
} as const;
