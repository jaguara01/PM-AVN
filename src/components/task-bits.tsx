import type { Priority, Status } from '@/lib/tasks';

/** Small, presentational pieces shared by the board, lists and panels. Safe in server and client components. */

export function StatusIcon({ status }: { status: Status }) {
  return (
    <svg className={`st st-${status}`} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      {status === 'done' ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="m4.9 8.2 2.1 2.1 4.1-4.5" fill="none" stroke="var(--surface)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          {status === 'doing' && <path d="M8 3.6a4.4 4.4 0 0 1 0 8.8z" fill="currentColor" />}
          {status === 'review' && <path d="M8 3.6a4.4 4.4 0 1 1-4.4 4.4H8z" fill="currentColor" />}
        </>
      )}
    </svg>
  );
}

export function PriorityIcon({ priority }: { priority: Priority }) {
  const n = { high: 3, medium: 2, low: 1 }[priority];
  return (
    <svg className={`pr pr-${priority}`} viewBox="0 0 14 12" width="14" height="12" role="img" aria-label={`${priority} priority`}>
      <title>{`${priority[0].toUpperCase()}${priority.slice(1)} priority`}</title>
      {[0, 1, 2].map((i) => <rect key={i} x={i * 5} y={8 - i * 4} width="3" height={4 + i * 4} rx="1" fill="currentColor" opacity={i < n ? 1 : 0.22} />)}
    </svg>
  );
}

const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
const initials = (s: string) => s.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export function Avatar({ name, size = 'sm' }: { name: string; size?: 'xs' | 'sm' | 'md' }) {
  if (!name || name === 'Unassigned' || name === 'Team') return <span className={`av none ${size}`} title="Unassigned" />;
  return <span className={`av ${size}`} style={{ ['--h' as string]: hue(name) }} title={name}>{initials(name)}</span>;
}
