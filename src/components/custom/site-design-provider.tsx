// @polsia:user-owned — loads public appearance settings and applies safe CSS tokens.
'use client';

import { type ReactNode, useEffect } from 'react';
import { apiFetch } from '@/lib/api-client';
import {
  DEFAULT_SITE_DESIGN,
  type SiteDesign,
  SiteDesignResponse,
  SiteDesignSchema,
  siteDesignCssVariables,
} from '@/lib/contracts/site-design';

function applyDesign(design: SiteDesign) {
  const root = document.documentElement;
  root.dataset.siteDesign = 'active';
  root.dataset.siteCardTreatment = design.cardTreatment;
  root.dataset.siteButtonTreatment = design.buttonTreatment;
  for (const [name, value] of Object.entries(siteDesignCssVariables(design))) {
    root.style.setProperty(name, value);
  }
}

export function SiteDesignProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let savedDesign = DEFAULT_SITE_DESIGN;
    applyDesign(savedDesign);

    const handleSavedEvent = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const parsed = SiteDesignSchema.safeParse(event.detail);
      if (!parsed.success) return;
      savedDesign = parsed.data;
      applyDesign(parsed.data);
    };

    window.addEventListener('site-design:saved', handleSavedEvent);
    void apiFetch('/api/site-design', { schema: SiteDesignResponse })
      .then((response) => {
        savedDesign = response.design;
        applyDesign(response.design);
      })
      .catch(() => applyDesign(DEFAULT_SITE_DESIGN));

    return () => {
      window.removeEventListener('site-design:saved', handleSavedEvent);
    };
  }, []);

  return <>{children}</>;
}
