// @polsia:user-owned — reusable TraceGlass brand mark.

import Image from 'next/image';
import { cn } from '@/lib/utils';

const logo =
  'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/company_274843/chat/598467e0-a6a8-427c-911e-8f7fd831b9c0.png';

export function BrandMark({
  className,
  priority = false,
  sizes = '(max-width: 768px) 42vw, 180px',
}: {
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <Image
      src={logo}
      alt="TraceGlass"
      width={1536}
      height={1024}
      priority={priority}
      sizes={sizes}
      className={cn('h-auto w-[8.5rem] object-contain', className)}
    />
  );
}
