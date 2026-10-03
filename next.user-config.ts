// @polsia:user-owned — your Next.js customizations, merged into next.config.ts by the
// framework. Edit freely (no slot markers). next.config.ts stays framework-owned: don't
// put security headers / CSP / a full `images` block here.
import type { NextConfig } from 'next';

import type { CspExtraSources } from '@/lib/csp';
import type { AppCapabilities } from '@/lib/permissions-policy';

type RemotePatterns = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>;

/** Remote hosts you load <Image> from. e.g. { protocol: 'https', hostname: 'images.unsplash.com' } */
export const userRemotePatterns: RemotePatterns = [
  {
    protocol: 'https',
    hostname: 'pub-629428d185ca4960a0a73c850d32294b.r2.dev',
    pathname: '/company_274843/chat/598467e0-a6a8-427c-911e-8f7fd831b9c0.png',
  },
];

/** Package-level Next options (transpilePackages, experimental.optimizePackageImports, …). */
export const userNextConfig: NextConfig = {};

/** Browser features the app needs (microphone/camera/geolocation). Default off — secure. */
export const appCapabilities: AppCapabilities = {};

/** Per-app CSP source allow-lists (frame/connect/media/font/img). Default empty. */
export const cspExtraSources: CspExtraSources = {};

export type ConfigPlugin = (config: NextConfig) => NextConfig;

/**
 * Next plugins that must WRAP the whole config (next-intl, Sentry, MDX,
 * bundle-analyzer). Each entry is a `(config) => config` wrapper — pre-bind
 * options. next.config.ts applies these and re-asserts the security headers
 * afterward, so a plugin can extend the build but never drop the day-1 posture.
 * For i18n, install the `i18n` module and add its plugin here per its AGENT.md.
 *
 *   export const userConfigPlugins: ConfigPlugin[] = [
 *     createNextIntlPlugin('./src/i18n/request.ts'),
 *     (config) => withSentryConfig(config, { silent: true }),
 *   ];
 */
export const userConfigPlugins: ConfigPlugin[] = [];
