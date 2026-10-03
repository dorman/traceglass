// @polsia:user-owned — client access seam for owner-only page UI.
'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { PageOwnerAccess } from '@/lib/contracts/pages';

export function usePageOwner() {
  const [isOwner, setIsOwner] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void apiFetch('/api/admin/pages/access', { schema: PageOwnerAccess })
      .then((result) => {
        if (active) setIsOwner(result.isOwner);
      })
      .catch(() => {
        if (active) setIsOwner(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { isOwner: isOwner === true, isLoading: isOwner === null };
}
