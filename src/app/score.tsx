import type { SimilarityResult } from '@/lib/similarity';

export const PARTS = [['semantic', 'Meaning'], ['technologies', 'Technologies'], ['keywords', 'Keywords'], ['domains', 'Domain']] as const;

/** A match out of 100 in a circle: orange for strong, amber for some, grey for weak. */
export function Score({ value }: { value: number }) {
  const n = Math.round(value * 100);
  return <span className={`score ${n >= 40 ? '' : n >= 15 ? 'mid' : 'low'}`} title={`${n} out of 100`}>{n}</span>;
}

export function ScoreParts({ parts }: { parts: SimilarityResult['parts'] }) {
  return (
    <div className="parts">
      {PARTS.map(([k, label]) => {
        const v = parts[k];
        if (v === null) return null;
        const n = Math.round(v * 100);
        return (
          <div key={k} style={{ display: 'contents' }}>
            <span>{label}</span>
            <div className="meter"><i className={`p-${k}`} style={{ width: `${n}%` }} /></div>
            <b>{n}</b>
          </div>
        );
      })}
    </div>
  );
}
