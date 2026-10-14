// @polsia:user-owned — reusable TraceGlass brand mark.

import Image from 'next/image';
import { cn } from '@/lib/utils';

/** Full stacked logo (icon + wordmark). Optimized local WebP (~22KB). */
const fullLogo = {
  src: '/assets/traceglass-logo.webp',
  width: 380,
  height: 240,
} as const;

/**
 * Icon-only mark (terminal prompt + magnifying glass). Use in tight chrome
 * like the site header, paired with a text wordmark for readability.
 */
const iconMark = {
  src: '/assets/traceglass-mark.webp',
  width: 241,
  height: 128,
} as const;

export function BrandMark({
  className,
  priority = false,
  sizes = '(max-width: 768px) 42vw, 180px',
  variant = 'full',
  showWordmark = false,
}: {
  className?: string;
  priority?: boolean;
  sizes?: string;
  /** `full` = stacked icon+wordmark; `mark` = icon only. */
  variant?: 'full' | 'mark';
  /** When true, render a CSS "TraceGlass" label beside the mark (header chrome). */
  showWordmark?: boolean;
}) {
  const asset = variant === 'mark' ? iconMark : fullLogo;

  const image = (
    <Image
      src={asset.src}
      alt="TraceGlass"
      width={asset.width}
      height={asset.height}
      priority={priority}
      sizes={sizes}
      className={cn(
        variant === 'mark'
          ? 'h-8 w-auto object-contain sm:h-9'
          : 'h-auto w-[8.5rem] object-contain',
        className,
      )}
    />
  );

  if (!showWordmark) return image;

  // Visible wordmark mirrors the logo palette; aria-hidden so screen readers
  // only hear the image alt ("TraceGlass") once.
  return (
    <span className="inline-flex items-center gap-2">
      {image}
      <span
        aria-hidden="true"
        className="select-none text-base font-semibold tracking-tight sm:text-lg"
      >
        <span className="text-zinc-50">Trace</span>
        <span className="text-brand-400">Glass</span>
      </span>
    </span>
  );
}
