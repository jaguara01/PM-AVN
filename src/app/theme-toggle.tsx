'use client';

import { useEffect, useState } from 'react';

const KEY = 'pmavn.theme';

/** Light or dark, remembered in this browser. Until someone clicks it, the system setting decides. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(KEY); } catch {}
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
    setDark(saved ? saved === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches === true);
  }, []);

  function toggle() {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch {}
    setDark(!dark);
  }

  return (
    <button type="button" className="iconbtn" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
      <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dark ? (
          <>
            <circle cx="10" cy="10" r="3.3" />
            <path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M15.3 4.7 14 6M6 14l-1.3 1.3" />
          </>
        ) : (
          <path d="M16.5 12A6.5 6.5 0 1 1 8 3.5a5.2 5.2 0 0 0 8.5 8.5z" />
        )}
      </svg>
    </button>
  );
}
