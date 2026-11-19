'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** A link that marks itself as the current page. `match` is a path prefix; with `exact`, or for "/", only that path matches. */
export function NavLink({ href, match = href, exact = false, className = 'nav', children }: { href: string; match?: string; exact?: boolean; className?: string; children: React.ReactNode }) {
  const path = usePathname() ?? '';
  const current = match === '/' || exact ? path === match : path.startsWith(match);
  return <Link className={className} href={href} aria-current={current ? 'page' : undefined}>{children}</Link>;
}
