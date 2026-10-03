// @polsia:user-owned — shared zod contract for the public beta install catalog.
// Keep this module client-importable: it contains only zod schemas and types.
import { z } from 'zod';

export const TechnicalFallback = z.object({
  label: z.string(),
  command: z.string(),
  details: z.string(),
  docsUrl: z.string().url(),
});

export const ReleasePlatform = z
  .object({
    name: z.string(),
    os: z.enum(['Linux', 'macOS', 'Windows']),
    architecture: z.string().min(1),
    target: z.string(),
    installerName: z.string().min(1),
    installerFormat: z.enum(['binary', 'exe']),
    availability: z.enum(['available', 'unavailable']),
    downloadUrl: z.string().url().nullable(),
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    signatureUrl: z.string().url().nullable(),
    signingKeyId: z.string().min(1).nullable(),
    note: z.string(),
    permissionNote: z.string(),
    launchNote: z.string(),
  })
  .superRefine((platform, context) => {
    const verified = [
      platform.downloadUrl,
      platform.sha256,
      platform.signatureUrl,
      platform.signingKeyId,
    ];
    if (platform.availability === 'available' && verified.some((value) => value === null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Available installers require a URL, SHA-256, signature URL, and signing key.',
      });
    }
    if (platform.availability === 'unavailable' && verified.some((value) => value !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Unavailable installers must not expose download or verification metadata.',
      });
    }
  });

export const ReleaseVerification = z.object({
  manifestUrl: z.string().url().nullable(),
  manifestSignatureUrl: z.string().url().nullable(),
  signatureScheme: z.literal('Ed25519'),
  signingKeyId: z.string().min(1),
  status: z.enum(['not-published', 'published']),
  osSigningLimitations: z.string(),
});

export const ReleaseInstall = z.object({
  releaseStatus: z.enum(['unpublished', 'published']),
  version: z
    .string()
    .regex(/^v\d+\.\d+\.\d+$/)
    .nullable(),
  heading: z.string(),
  description: z.string(),
  releasePageUrl: z.string().url(),
  verification: ReleaseVerification,
  platforms: z.array(ReleasePlatform),
  fallback: TechnicalFallback,
});

export const InstallGuideResponse = z.object({
  releases: ReleaseInstall,
});

export type ReleasePlatform = z.infer<typeof ReleasePlatform>;
export type ReleaseVerification = z.infer<typeof ReleaseVerification>;
export type TechnicalFallback = z.infer<typeof TechnicalFallback>;
export type ReleaseInstall = z.infer<typeof ReleaseInstall>;
export type InstallGuideResponse = z.infer<typeof InstallGuideResponse>;
