import type { ProjectProfile, SimilarityResult, SimilarityWeights } from './types';

export const DEFAULT_WEIGHTS: SimilarityWeights = { semantic: 0.55, technologies: 0.25, keywords: 0.15, domains: 0.05 };

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/**
 * How informative each term is across the whole portfolio. A technology every project uses
 * says little about which two projects are alike; a rare one says a lot.
 */
export function inverseFrequency(lists: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const list of lists) for (const t of new Set(list)) df.set(t, (df.get(t) ?? 0) + 1);
  const n = lists.length || 1;
  return new Map([...df].map(([t, d]) => [t, Math.log(1 + n / d)]));
}

/** Overlap of two term lists, each term weighted by how rare it is. Null when either side is empty: no data is not the same as no overlap. */
export function weightedOverlap(a: string[], b: string[], idf?: Map<string, number>): { value: number | null; shared: string[] } {
  if (!a.length || !b.length) return { value: null, shared: [] };
  const w = (t: string) => idf?.get(t) ?? 1;
  const setB = new Set(b);
  const shared = [...new Set(a)].filter((t) => setB.has(t));
  const union = new Set([...a, ...b]);
  const top = shared.reduce((s, t) => s + w(t), 0);
  const bottom = [...union].reduce((s, t) => s + w(t), 0);
  return { value: bottom ? top / bottom : 0, shared: shared.sort((x, y) => w(y) - w(x)) };
}

export interface Comparable {
  projectId: string;
  profile: ProjectProfile;
  embedding: number[];
}

export interface PortfolioStats {
  technologies: Map<string, number>;
  keywords: Map<string, number>;
  domains: Map<string, number>;
}

export function portfolioStats(all: Comparable[]): PortfolioStats {
  return {
    technologies: inverseFrequency(all.map((p) => p.profile.technologies)),
    keywords: inverseFrequency(all.map((p) => p.profile.keywords)),
    domains: inverseFrequency(all.map((p) => p.profile.domains)),
  };
}

function reasonFor(shared: SimilarityResult['shared'], semantic: number): string {
  const bits: string[] = [];
  if (shared.technologies.length) bits.push(`both use ${shared.technologies.slice(0, 4).join(', ')}`);
  if (shared.domains.length) bits.push(`both sit in ${shared.domains.slice(0, 2).join(' and ')}`);
  if (shared.keywords.length) bits.push(`shared themes: ${shared.keywords.slice(0, 4).join(', ')}`);
  if (!bits.length) return semantic >= 0.5 ? 'Their descriptions read alike, with no named technology or theme in common.' : 'Little in common.';
  const s = bits.join('; ');
  return s[0].toUpperCase() + s.slice(1) + '.';
}

/**
 * Hybrid score: meaning (embedding cosine) plus explicit overlap of technologies, keywords and domains.
 * When a project has no technologies (or keywords, or domains) recorded, that part is left out and its
 * weight is shared among the parts that do have data.
 */
export function scoreSimilarity(a: Comparable, b: Comparable, stats?: PortfolioStats, weights: SimilarityWeights = DEFAULT_WEIGHTS): SimilarityResult {
  const semantic = Math.max(0, Math.min(1, cosine(a.embedding, b.embedding)));
  const tech = weightedOverlap(a.profile.technologies, b.profile.technologies, stats?.technologies);
  const kw = weightedOverlap(a.profile.keywords, b.profile.keywords, stats?.keywords);
  const dom = weightedOverlap(a.profile.domains, b.profile.domains, stats?.domains);
  const parts: [number | null, number][] = [
    [semantic, weights.semantic],
    [tech.value, weights.technologies],
    [kw.value, weights.keywords],
    [dom.value, weights.domains],
  ];
  const usable = parts.filter(([v]) => v !== null) as [number, number][];
  const total = usable.reduce((s, [, w]) => s + w, 0) || 1;
  const score = usable.reduce((s, [v, w]) => s + v * w, 0) / total;
  const shared = { technologies: tech.shared, keywords: kw.shared, domains: dom.shared };
  return {
    projectId: b.projectId,
    score: Math.round(score * 1000) / 1000,
    parts: { semantic, technologies: tech.value, keywords: kw.value, domains: dom.value },
    shared,
    reason: reasonFor(shared, semantic),
  };
}

/** Every other project, most similar first. */
export function rankSimilar(target: Comparable, all: Comparable[], weights?: SimilarityWeights): SimilarityResult[] {
  const stats = portfolioStats(all);
  return all
    .filter((p) => p.projectId !== target.projectId)
    .map((p) => scoreSimilarity(target, p, stats, weights))
    .sort((x, y) => y.score - x.score);
}

/** The strongest pairs across the whole portfolio, each pair once. */
export function topPairs(all: Comparable[], limit = 10, weights?: SimilarityWeights): (SimilarityResult & { fromId: string })[] {
  const stats = portfolioStats(all);
  const out: (SimilarityResult & { fromId: string })[] = [];
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) out.push({ fromId: all[i].projectId, ...scoreSimilarity(all[i], all[j], stats, weights) });
  return out.sort((x, y) => y.score - x.score).slice(0, limit);
}
