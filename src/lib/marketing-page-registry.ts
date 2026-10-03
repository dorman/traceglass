// @polsia:user-owned — stable identity and template baselines for existing routes.

export type ExistingMarketingPage = {
  id: string;
  sourceKey: string;
  sourcePath: string;
  templateKey: string;
  slug: string;
  legacySlugs: string[];
  title: string;
  body: string;
  seoDescription: string;
  content: import('@/lib/contracts/pages').PageContent;
};

import { getDefaultMarketingPageContent } from '@/lib/marketing-page-content';

export const existingMarketingPages: readonly ExistingMarketingPage[] = [
  {
    id: 'marketing-home',
    sourceKey: 'home',
    sourcePath: '/',
    templateKey: 'home',
    slug: 'home',
    legacySlugs: [],
    title: 'TraceGlass',
    body: 'TraceGlass highlights the log lines that matter with a local watchlist and curated built-in signatures, then stays entirely local.',
    seoDescription:
      'A local-first Rust CLI for local keyword and regex highlights, curated built-in signature findings, and CI-ready log review. No AI or network access required.',
    content: getDefaultMarketingPageContent('home'),
  },
  {
    id: 'marketing-install',
    sourceKey: 'install',
    sourcePath: '/install',
    templateKey: 'install',
    slug: 'install',
    legacySlugs: [],
    title: 'Install TraceGlass',
    body: 'Install TraceGlass with the planned signed one-click beta installer, or use the technical source fallback.',
    seoDescription:
      'Install TraceGlass with the planned one-click beta installer for supported Linux, macOS, and Windows targets.',
    content: getDefaultMarketingPageContent('install'),
  },
  {
    id: 'marketing-release',
    sourceKey: 'release',
    sourcePath: '/release',
    templateKey: 'release',
    slug: 'release',
    legacySlugs: [],
    title: 'TraceGlass release status',
    body: 'The signed one-click beta installer is being prepared alongside the interactive TUI and stable machine modes.',
    seoDescription:
      'TraceGlass release status: signed installer plan, interactive TUI scanning, and structured output.',
    content: getDefaultMarketingPageContent('release'),
  },
  {
    id: 'marketing-signatures',
    sourceKey: 'signatures',
    sourcePath: '/signatures',
    templateKey: 'signatures',
    slug: 'signatures',
    legacySlugs: [],
    title: 'Signature library',
    body: 'Preview the open-source signature sets that ship with TraceGlass.',
    seoDescription:
      'Preview the open-source TraceGlass signature library for search errors, Windows events, and antivirus alerts.',
    content: getDefaultMarketingPageContent('signatures'),
  },
  {
    id: 'marketing-waitlist',
    sourceKey: 'waitlist',
    sourcePath: '/waitlist',
    templateKey: 'waitlist',
    slug: 'waitlist',
    legacySlugs: [],
    title: 'TraceGlass paid plan updates',
    body: 'A paid TraceGlass plan is planned, but it isn’t available yet. Request one email update; signup does not start a subscription.',
    seoDescription:
      'A paid TraceGlass plan is planned, but it isn’t available yet. Request one email update; signup does not start a subscription. Target date: November 15, 2026.',
    content: getDefaultMarketingPageContent('waitlist'),
  },
];

export function findExistingMarketingPage(key: string) {
  return existingMarketingPages.find(
    (page) =>
      page.sourceKey === key ||
      page.sourcePath === key ||
      page.slug === key ||
      page.legacySlugs.includes(key),
  );
}
