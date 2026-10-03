// @polsia:user-owned — global navigation rendered from src/lib/nav.ts.

'use client';

import { ChevronDown, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { AuthNav } from '@/components/custom/auth-nav';
import { BrandMark } from '@/components/custom/brand-mark';
import { ThemeToggle } from '@/components/custom/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { usePageOwner } from '@/hooks/use-page-owner';
import { useIsAdmin, useSession } from '@/lib/auth-client';
import { type NavGroup, type NavItem, navItems } from '@/lib/nav';
import { siteName } from '@/lib/site';
import { cn } from '@/lib/utils';

function useIsAuthenticated(): boolean {
  const { data } = useSession();
  return Boolean(data?.user);
}

function visibleItems(
  group: NavGroup,
  isAuthenticated: boolean,
  isAdmin: boolean,
  isOwner: boolean,
): NavItem[] {
  return navItems
    .filter(
      (item) =>
        item.group === group &&
        (!item.requiresAuth || isAuthenticated) &&
        (!item.requiresAdmin || isAdmin) &&
        (!item.requiresOwner || isOwner),
    )
    .sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
        a.label.localeCompare(b.label),
    );
}

// Inline top-bar slots (a slot = one link OR one `menu` dropdown), capped so the
// bar can't grow wide. Kept here (not a sibling module) so a template upgrade
// re-stamps the whole nav as one user-owned file rather than seeding an orphan.
const MAX_PRIMARY_SLOTS = 5;

type NavSlot =
  | { readonly type: 'link'; readonly item: NavItem }
  | { readonly type: 'menu'; readonly label: string; readonly items: readonly NavItem[] };

const itemOrder = (i: NavItem) => i.order ?? Number.MAX_SAFE_INTEGER;
const slotOrder = (s: NavSlot) =>
  s.type === 'link' ? itemOrder(s.item) : Math.min(...s.items.map(itemOrder));
const slotLabel = (s: NavSlot) => (s.type === 'link' ? s.item.label : s.label);

// Items sharing a `menu` collapse into one dropdown (at their earliest position);
// the rest stay links. Sorts by `order` then label.
function buildPrimarySlots(items: readonly NavItem[]): NavSlot[] {
  const links: NavSlot[] = [];
  const menus = new Map<string, NavItem[]>();
  for (const item of items) {
    if (item.menu) {
      const bucket = menus.get(item.menu);
      if (bucket) bucket.push(item);
      else menus.set(item.menu, [item]);
    } else {
      links.push({ type: 'link', item });
    }
  }
  const menuSlots: NavSlot[] = [...menus].map(([label, its]) => ({
    type: 'menu',
    label,
    items: [...its].sort((a, b) => itemOrder(a) - itemOrder(b) || a.label.localeCompare(b.label)),
  }));
  return [...links, ...menuSlots].sort(
    (a, b) => slotOrder(a) - slotOrder(b) || slotLabel(a).localeCompare(slotLabel(b)),
  );
}

// At most MAX_PRIMARY_SLOTS triggers render; the rest collapse into "More".
function splitPrimarySlots(slots: NavSlot[]): { inline: NavSlot[]; overflow: NavSlot[] } {
  if (slots.length <= MAX_PRIMARY_SLOTS) return { inline: slots, overflow: [] };
  return {
    inline: slots.slice(0, MAX_PRIMARY_SLOTS - 1),
    overflow: slots.slice(MAX_PRIMARY_SLOTS - 1),
  };
}

export function SiteNav() {
  const isAuthenticated = useIsAuthenticated();
  const isAdmin = useIsAdmin();
  const { isOwner } = usePageOwner();
  // The brand links home, so drop a redundant '/' item from the rendered links.
  const primary = visibleItems('primary', isAuthenticated, isAdmin, isOwner).filter(
    (item) => item.href !== '/',
  );
  const secondary = visibleItems('secondary', isAuthenticated, isAdmin, isOwner);

  // Top-bar slots (links + `menu` dropdowns); `inline` renders, `overflow` → "More".
  const slots = buildPrimarySlots(primary);
  const { inline, overflow } = splitPrimarySlots(slots);
  const collapsedCount = primary.length + secondary.length;

  // Controlled so a drawer link both navigates AND dismisses the overlay; without
  // this the Sheet stays open over the new route after client-side navigation.
  const [open, setOpen] = React.useState(false);

  const pathname = usePathname();
  // Exact match for the root; segment-boundary match for everything else so
  // '/blog' highlights on '/blog/post' but '/' never matches every route.
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
  const isSlotActive = (slot: NavSlot) =>
    slot.type === 'link' ? isActive(slot.item.href) : slot.items.some((i) => isActive(i.href));
  if (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  ) {
    return null;
  }

  return (
    <header className="site-design-nav dark sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/95 text-zinc-100 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/80">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-14 max-w-screen-xl items-center gap-2 px-4"
      >
        <Link
          href="/"
          className="mr-2 shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <BrandMark className="h-9 w-auto sm:h-10" priority sizes="160px" />
          <span className="sr-only">{siteName}</span>
        </Link>

        {/* Desktop (md+): inline slots — direct links + `menu` dropdowns */}
        <div className="hidden items-center gap-1 md:flex">
          {inline.map((slot) =>
            slot.type === 'link' ? (
              <Button
                key={slot.item.href}
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  'site-design-nav-link text-zinc-300 hover:bg-zinc-900 hover:text-brand-300',
                  isActive(slot.item.href) && 'bg-zinc-900 text-brand-300',
                )}
              >
                <Link
                  href={slot.item.href}
                  aria-current={isActive(slot.item.href) ? 'page' : undefined}
                >
                  {slot.item.label}
                </Link>
              </Button>
            ) : (
              <DropdownMenu key={`menu:${slot.label}`}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'site-design-nav-link text-zinc-300 hover:bg-zinc-900 hover:text-brand-300',
                      isSlotActive(slot) && 'bg-zinc-900 text-brand-300',
                    )}
                  >
                    {slot.label}
                    <ChevronDown className="ml-1 size-4 opacity-60" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="site-design-menu border-zinc-800 bg-zinc-900 text-zinc-100"
                >
                  {slot.items.map((item) => (
                    <DropdownMenuItem
                      key={item.href}
                      asChild
                      className="focus:bg-zinc-800 focus:text-brand-300"
                    >
                      <Link
                        href={item.href}
                        aria-current={isActive(item.href) ? 'page' : undefined}
                      >
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          )}

          {/* Overflow: everything past the cap collapses here so the bar can't grow wide */}
          {overflow.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'site-design-nav-link text-zinc-300 hover:bg-zinc-900 hover:text-brand-300',
                    overflow.some(isSlotActive) && 'bg-zinc-900 text-brand-300',
                  )}
                >
                  More
                  <ChevronDown className="ml-1 size-4 opacity-60" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="site-design-menu border-zinc-800 bg-zinc-900 text-zinc-100"
              >
                {overflow.map((slot, index) => {
                  // Separate a menu group from its neighbours, but not plain links.
                  const fenced =
                    index > 0 && (slot.type === 'menu' || overflow[index - 1]?.type === 'menu');
                  return (
                    <React.Fragment
                      key={slot.type === 'link' ? slot.item.href : `menu:${slot.label}`}
                    >
                      {fenced && <DropdownMenuSeparator />}
                      {slot.type === 'link' ? (
                        <DropdownMenuItem
                          asChild
                          className="focus:bg-zinc-800 focus:text-brand-300"
                        >
                          <Link
                            href={slot.item.href}
                            aria-current={isActive(slot.item.href) ? 'page' : undefined}
                          >
                            {slot.item.label}
                          </Link>
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>{slot.label}</DropdownMenuLabel>
                          {slot.items.map((item) => (
                            <DropdownMenuItem
                              key={item.href}
                              asChild
                              className="focus:bg-zinc-800 focus:text-brand-300"
                            >
                              <Link
                                href={item.href}
                                aria-current={isActive(item.href) ? 'page' : undefined}
                              >
                                {item.label}
                              </Link>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                      )}
                    </React.Fragment>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Right cluster: ml-auto pushes it right at every breakpoint */}
        <div className="ml-auto flex items-center gap-1">
          {/* Desktop secondary buttons */}
          <div className="hidden items-center gap-1 md:flex">
            {secondary.map((item) => (
              <Button
                key={item.href}
                asChild
                variant="secondary"
                size="sm"
                className="site-design-action bg-brand-400 text-zinc-950 hover:bg-brand-300"
              >
                <Link href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
                  {item.label}
                </Link>
              </Button>
            ))}
          </div>

          {/* Always visible */}
          <ThemeToggle />
          <AuthNav />

          {/* Mobile (below md): burger + drawer — only when there's something to collapse */}
          {collapsedCount > 0 && (
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                aria-describedby={undefined}
                className="site-design-menu flex flex-col border-zinc-800 bg-zinc-950 text-zinc-100"
              >
                <SheetHeader>
                  <SheetTitle className="text-left">
                    <BrandMark className="h-10 w-auto" sizes="180px" />
                    <span className="sr-only">{siteName}</span>
                  </SheetTitle>
                </SheetHeader>
                <nav aria-label="Mobile" className="mt-6 flex flex-col gap-1 overflow-y-auto">
                  {/* All slots, no overflow; a `menu` slot becomes a labeled section. */}
                  {slots.map((slot) =>
                    slot.type === 'link' ? (
                      <Button
                        key={slot.item.href}
                        asChild
                        variant="ghost"
                        className={cn(
                          'site-design-nav-link w-full justify-start',
                          isActive(slot.item.href) && 'bg-zinc-900 text-brand-300',
                        )}
                      >
                        <Link
                          href={slot.item.href}
                          aria-current={isActive(slot.item.href) ? 'page' : undefined}
                          onClick={() => setOpen(false)}
                        >
                          {slot.item.label}
                        </Link>
                      </Button>
                    ) : (
                      <div key={`menu:${slot.label}`} className="flex flex-col gap-1">
                        <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">
                          {slot.label}
                        </p>
                        {slot.items.map((item) => (
                          <Button
                            key={item.href}
                            asChild
                            variant="ghost"
                            className={cn(
                              'site-design-nav-link w-full justify-start pl-6',
                              isActive(item.href) && 'bg-zinc-900 text-brand-300',
                            )}
                          >
                            <Link
                              href={item.href}
                              aria-current={isActive(item.href) ? 'page' : undefined}
                              onClick={() => setOpen(false)}
                            >
                              {item.label}
                            </Link>
                          </Button>
                        ))}
                      </div>
                    ),
                  )}
                  {secondary.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1 border-t border-border pt-4">
                      {secondary.map((item) => (
                        <Button
                          key={item.href}
                          asChild
                          variant="secondary"
                          className="site-design-action w-full justify-start bg-brand-400 text-zinc-950 hover:bg-brand-300"
                        >
                          <Link
                            href={item.href}
                            aria-current={isActive(item.href) ? 'page' : undefined}
                            onClick={() => setOpen(false)}
                          >
                            {item.label}
                          </Link>
                        </Button>
                      ))}
                    </div>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  const isAuthenticated = useIsAuthenticated();
  const isAdmin = useIsAdmin();
  const { isOwner } = usePageOwner();
  const pathname = usePathname();
  const footer = visibleItems('footer', isAuthenticated, isAdmin, isOwner);
  if (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  ) {
    return null;
  }
  if (footer.length === 0) return null;

  return (
    <footer className="site-design-footer dark border-t border-zinc-800 bg-zinc-950 text-zinc-100">
      <nav
        aria-label="Footer"
        className="mx-auto flex max-w-screen-xl flex-wrap items-center gap-4 px-4 py-8 text-sm"
      >
        <Link
          href="/"
          className="mr-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <BrandMark className="h-10 w-auto" sizes="160px" />
          <span className="sr-only">{siteName}</span>
        </Link>
        {footer.map((item) => (
          <Button
            key={item.href}
            asChild
            variant="link"
            size="sm"
            className="text-zinc-400 hover:text-brand-300"
          >
            <Link href={item.href}>{item.label}</Link>
          </Button>
        ))}
      </nav>
    </footer>
  );
}
