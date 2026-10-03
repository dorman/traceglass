import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MarketingPageRenderer } from '@/components/custom/marketing/marketing-page-renderer';
import { PageContent } from '@/lib/contracts/pages';
import {
  cleanupRetiredPricingContent,
  reconcileGeneratedWaitlistCopy,
} from '@/lib/marketing-page-content';

vi.mock('@/components/custom/brand-mark', () => ({
  BrandMark: () => createElement('span', { 'data-testid': 'brand-mark' }),
}));

describe('retired TraceGlass pricing content', () => {
  it('removes home pricing and the old title while preserving unrelated edited sections', () => {
    const publishedHome = {
      version: 1,
      sections: [
        { id: 'hero', kind: 'hero', data: { heading: 'Grammarly, for logs.' }, assets: [] },
        { id: 'pricing', kind: 'pricing', data: { heading: '$12/mo' }, assets: [] },
        { id: 'legacy-checkout', kind: 'billing-card', data: { price: '$12', heading: 'Subscribe via Stripe' }, assets: [] },
        { id: 'custom-contact', kind: 'cta', data: { heading: 'Talk to us' }, assets: [] },
      ],
      assets: [],
      editorNote: 'Keep this customer content.',
    };

    const cleaned = cleanupRetiredPricingContent({
      sourceKey: 'home',
      title: 'Read the signal. Ignore the noise.',
      content: publishedHome,
    });

    expect(cleaned.title).toBe('TraceGlass');
    expect(cleaned.titleChanged).toBe(true);
    expect(cleaned.contentChanged).toBe(true);
    expect(cleaned.content).toEqual({
      ...publishedHome,
      sections: publishedHome.sections.filter(
        (section) => section.id === 'hero' || section.id === 'custom-contact',
      ),
    });
    expect(cleanupRetiredPricingContent({ ...cleaned, sourceKey: 'home' })).toEqual({
      ...cleaned,
      titleChanged: false,
      contentChanged: false,
    });
  });

  it('removes the release Pro CTA but preserves release and custom CTA sections', () => {
    const release = {
      version: 1,
      sections: [
        { id: 'release-status', kind: 'hero', data: { heading: 'Release status' }, assets: [] },
        { id: 'release-price', kind: 'pricing', data: { heading: '$12/mo' }, assets: [] },
        { id: 'release-checkout', kind: 'billing-card', data: { price: '$12', heading: 'Subscribe via Stripe' }, assets: [] },
        { id: 'release-cta', kind: 'cta', data: { heading: 'Subscribe — $12/mo' }, assets: [] },
        { id: 'custom-cta', kind: 'cta', data: { heading: 'Get launch updates' }, assets: [] },
        { id: 'waitlist-form', kind: 'waitlist-form', data: { heading: 'Join the list' }, assets: [] },
      ],
      assets: [],
    };

    const cleaned = cleanupRetiredPricingContent({
      sourceKey: 'release',
      title: 'TraceGlass release status',
      content: release,
    });
    const sections = (cleaned.content as typeof release).sections;

    expect(cleaned.contentChanged).toBe(true);
    expect(sections.map((section) => section.id)).toEqual([
      'release-status',
      'custom-cta',
      'waitlist-form',
    ]);
    expect(cleanupRetiredPricingContent({ ...cleaned, sourceKey: 'release' })).toMatchObject({
      titleChanged: false,
      contentChanged: false,
    });
  });

  it('omits the managed title intro on the home source and keeps it on other pages', () => {
    const content = PageContent.parse({ version: 1, sections: [], assets: [] });
    const render = (sourceKey: string) =>
      renderToStaticMarkup(
        createElement(MarketingPageRenderer, {
          page: {
            sourceKey,
            title: 'Read the signal. Ignore the noise.',
            seoDescription: 'Managed page description.',
            content,
          },
        }),
      );

    const homeMarkup = render('home');
    const releaseMarkup = render('release');

    expect(homeMarkup).not.toContain('<header');
    expect(homeMarkup).not.toContain('Read the signal. Ignore the noise.');
    expect(homeMarkup).not.toContain('Managed page description.');
    expect(releaseMarkup).toContain('<header');
    expect(releaseMarkup).toContain('Read the signal. Ignore the noise.');
    expect(releaseMarkup).toContain('Managed page description.');
  });

  it('does not render retired pricing or billing-card offers even if they remain in a draft', () => {
    const content = PageContent.parse({
      version: 1,
      sections: [
        {
          id: 'legacy-pricing',
          kind: 'pricing',
          data: { heading: 'Paid plan', pro: ['$12/mo'] },
          assets: [],
        },
        {
          id: 'legacy-billing',
          kind: 'billing-card',
          data: { heading: 'Subscribe via Stripe', price: '$12' },
          assets: [],
        },
      ],
      assets: [],
    });
    const markup = renderToStaticMarkup(
      createElement(MarketingPageRenderer, {
        page: {
          sourceKey: 'release',
          title: 'TraceGlass release status',
          seoDescription: 'Release status.',
          content,
        },
      }),
    );

    expect(markup).not.toContain('$12');
    expect(markup).not.toContain('Subscribe via Stripe');
  });

  it('reconciles only unchanged generated waitlist copy and preserves custom page content', () => {
    const customSection = {
      id: 'custom-contact',
      kind: 'cta',
      data: { heading: 'Questions? Contact us.' },
      assets: [],
    };
    const input = {
      title: 'Get the email when Pro ships.',
      body: 'Join the email-only waitlist for curated local watchlists.',
      seoDescription:
        'Join the TraceGlass Pro waitlist for weekly curated watchlists. No log content or diagnostic data is collected.',
      content: {
        version: 1,
        sections: [
          {
            id: 'waitlist-hero',
            kind: 'hero',
            data: {
              eyebrow: 'Pro · launching soon',
              heading: 'Get the email when Pro ships.',
              body: "Pro brings weekly curated, domain-tuned watchlists for Splunk, Docker, Kubernetes, Endpoint Detection, and CI runners — delivered to your local TraceGlass CLI. We'll send exactly one message on launch day.",
            },
            assets: [],
          },
          {
            id: 'waitlist-form',
            kind: 'waitlist-form',
            data: {
              heading: 'Join the launch list.',
              body: 'Your email address — and only your email address. No log content, source code, or filenames.',
            },
            assets: [],
          },
          customSection,
        ],
        assets: [],
        editorNote: 'Preserve this editor field.',
      },
    };

    const reconciled = reconcileGeneratedWaitlistCopy(input);
    const content = reconciled.content as typeof input.content;

    expect(reconciled.changed).toBe(true);
    expect(reconciled.title).toBe('TraceGlass paid plan updates');
    expect(reconciled.body).toContain(
      'A paid TraceGlass plan is planned, but it isn’t available yet.',
    );
    expect(content.sections[2]).toEqual(customSection);
    expect(content.editorNote).toBe('Preserve this editor field.');
    expect(content.sections[0]?.data.heading).toBe(
      'A paid TraceGlass plan is planned, but it isn’t available yet.',
    );
    expect(content.sections[1]?.data.body).toContain('does not start a subscription');
    expect(reconcileGeneratedWaitlistCopy(reconciled).changed).toBe(false);
  });
});
