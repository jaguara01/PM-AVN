/** Line icons used across the app. Decorative: always paired with visible text. */
const PATHS = {
  portfolio: 'M10 10m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0M4.5 4.5m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M15.5 4.5m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M4.5 15.5m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M15.5 15.5m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M5.8 5.8l2.6 2.6M14.2 5.8l-2.6 2.6M5.8 14.2l2.6-2.6M14.2 14.2l-2.6-2.6',
  folder: 'M3 6.5A1.5 1.5 0 0 1 4.5 5H8l1.7 2h5.8A1.5 1.5 0 0 1 17 8.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5z',
  down: 'm6 8 4 4 4-4',
  meetings: 'M3 6.5A1.5 1.5 0 0 1 4.5 5h7A1.5 1.5 0 0 1 13 6.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5zM13 9l4-2.5v7L13 11',
  home: 'M3.5 9 10 3.8 16.5 9v7h-4.3v-4.6H7.8V16H3.5z',
  me: 'M10 10a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM4 16.5c.7-3 3-4.4 6-4.4s5.3 1.4 6 4.4',
  plus: 'M10 4.5v11M4.5 10h11',
  doc: 'M5.5 2.5h6.5l3 3v12h-9.5zM12 2.5v3h3M8 10h5M8 13h5',
  bulb: 'M7.5 15h5M8.5 17.5h3M10 2.5a5 5 0 0 0-3 9c.6.4.8 1 .8 1.8h4.4c0-.8.2-1.4.8-1.8a5 5 0 0 0-3-9z',
  refresh: 'M15.5 8A6 6 0 0 0 4.6 6.5M4.5 12a6 6 0 0 0 10.9 1.5M4.5 3.5v3h3M15.5 16.5v-3h-3',
} as const;

export function Icon({ name, size = 18 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
      <path d={PATHS[name]} />
    </svg>
  );
}
