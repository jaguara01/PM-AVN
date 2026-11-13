/** Canonical names, so "Postgres", "postgresql" and "PG" count as the same technology. */
const ALIASES: Record<string, string> = {
  postgres: 'postgresql', pg: 'postgresql', psql: 'postgresql',
  js: 'javascript', ts: 'typescript', node: 'node.js', nodejs: 'node.js',
  reactjs: 'react', 'react.js': 'react', nextjs: 'next.js', next: 'next.js', vuejs: 'vue', 'vue.js': 'vue',
  k8s: 'kubernetes', gcp: 'google cloud', 'amazon web services': 'aws', 'ms teams': 'microsoft teams', teams: 'microsoft teams',
  'power bi': 'powerbi', 'ms sql': 'sql server', mssql: 'sql server', py: 'python', golang: 'go',
  llm: 'llms', 'large language models': 'llms', genai: 'generative ai', 'gen ai': 'generative ai',
  ml: 'machine learning', ai: 'artificial intelligence', 'ci/cd': 'ci-cd', cicd: 'ci-cd',
  'e-commerce': 'ecommerce', 'e commerce': 'ecommerce', sso: 'single sign-on', rag: 'retrieval-augmented generation',
};

export function normalizeTerm(raw: string): string {
  const t = raw.toLowerCase().trim().replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}.#+]+|[^\p{L}\p{N}.#+]+$/gu, '');
  return ALIASES[t] ?? t;
}

/** Normalise, drop empties and duplicates, keep first-seen order. */
export function normalizeList(items: unknown, max = 25): string[] {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== 'string') continue;
    const t = normalizeTerm(item);
    if (t && t.length <= 60 && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
