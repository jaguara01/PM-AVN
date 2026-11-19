'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** A top-bar link that marks itself as the current page. `match` is a path prefix; "/" only matches the home page. */
export function NavLink({ href, match = href, className = 'nav', children }: { href: string; match?: string; className?: string; children: React.ReactNode }) {
  const path = usePathname() ?? '';
  const current = match === '/' ? path === '/' : path.startsWith(match);
  return <Link className={className} href={href} aria-current={current ? 'page' : undefined}>{children}</Link>;
}
