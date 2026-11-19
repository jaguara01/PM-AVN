'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Text that edits in place and saves when it loses focus. `save` returns an error message, or nothing when it worked. */
export function InlineText({ id, value, className, placeholder, label, save }: {
  id: string; value: string; className?: string; placeholder?: string; label: string;
  save: (v: string) => Promise<string | void>;
}) {
  const router = useRouter();
  const [v, setV] = useState(value);
  const [error, setError] = useState('');
  return (
    <>
      <input id={id} className={className} value={v} placeholder={placeholder} aria-label={label}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        onBlur={async () => {
          if (v === value) return;
          const err = await save(v);
          if (err) { setError(err); setV(value); } else { setError(''); router.refresh(); }
        }} />
      {error && <p className="err" role="alert">{error}</p>}
    </>
  );
}

/** A button that asks for a second click before it acts. */
export function ConfirmButton({ label, confirmLabel, action, className = 'btn quiet' }: { label: string; confirmLabel: string; action: () => Promise<void>; className?: string }) {
  const [armed, setArmed] = useState(false);
  return (
    <button type="button" className={className} onClick={async () => (armed ? action() : setArmed(true))} onBlur={() => setArmed(false)}>
      {armed ? confirmLabel : label}
    </button>
  );
}
