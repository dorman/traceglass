// @polsia:user-owned — brand identity. Edit freely. `site.ts` re-exports
// siteName/siteDescription; `manifest.ts` + `opengraph-image.tsx` read `brandVisual`.

export const siteName = 'TraceGlass';
export const siteDescription =
  'Rust-native local log review — add keyword or regex highlights to a local watchlist, while curated built-in signatures scan Splunk, Docker, and Windows event logs. No AI or network access required.';

// PWA + social-share colors. HEX only (the oklch() tokens in globals.css aren't
// readable here) — set to match your brand seed.
export const brandVisual = {
  /** PWA browser-UI / status-bar color. */
  themeColor: '#158353',
  /** PWA splash + install background. */
  backgroundColor: '#050706',
  /** Social-share (OG/Twitter) image. */
  og: {
    background: '#050706',
    foreground: '#f3fff9',
    /** Second line under the site name; '' hides it. */
    tagline: 'Local-first log review',
  },
} as const;
