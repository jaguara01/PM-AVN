import { z } from 'zod';
import { normalizeList, normalizeTerm } from './normalize';
import type { ProjectProfile } from './types';

/** Anything that can turn a prompt into text. The app passes Claude; tests pass a stub. */
export type CompleteFn = (prompt: string) => Promise<string>;

const RawProfile = z.object({
  summary: z.string().default(''),
  goals: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  domains: z.array(z.string()).default([]),
  deliverables: z.array(z.string()).default([]),
});

export const PROFILE_PROMPT = `You are profiling a project so it can be compared with other projects in the same organisation.
Read the material and return ONLY one JSON object, no prose, with exactly these keys:
{
 "summary": "2-3 sentences: what the project is, for whom, and why",
 "goals": ["outcome the project is trying to reach", ...],
 "keywords": ["5-12 themes or subject-matter terms, lower case, 1-3 words each"],
 "technologies": ["languages, frameworks, platforms, tools, data stores, standards actually named or clearly implied"],
 "domains": ["1-3 business or subject domains, lower case, e.g. events, ecommerce, hr, data platform"],
 "deliverables": ["what is handed over at the end"]
}
Rules: use only what the material supports and never invent technologies. Prefer the common name of a technology ("postgresql", "react"). Keywords describe what the project is about, not project-management words like "deadline" or "meeting". Use empty arrays when the material says nothing.`;

function cleanProfile(raw: z.infer<typeof RawProfile>): ProjectProfile {
  const texts = (xs: string[], max: number) => xs.map((x) => x.trim()).filter(Boolean).slice(0, max);
  return {
    summary: raw.summary.trim(),
    goals: texts(raw.goals, 8),
    keywords: normalizeList(raw.keywords, 15),
    technologies: normalizeList(raw.technologies, 25),
    domains: normalizeList(raw.domains, 4),
    deliverables: texts(raw.deliverables, 8),
  };
}

/** Pull the first JSON object out of a model reply, tolerating code fences and stray prose. */
export function parseJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The model reply contained no JSON object.');
  return JSON.parse(text.slice(start, end + 1));
}

export async function extractProfileWithModel(sourceText: string, complete: CompleteFn): Promise<ProjectProfile> {
  const reply = await complete(`${PROFILE_PROMPT}\n\nMATERIAL:\n${sourceText}`);
  return cleanProfile(RawProfile.parse(parseJsonObject(reply)));
}

/* ---------- offline extractor: no model, no network ---------- */

const STOP = new Set(
  'about above after again also because been before being between both could does doing done down during each even every from further have having here into just like make more most much only other over really same should some such than that their them then there these they this those through very want were what when where which while will with would your project projects task tasks meeting meetings team teams need needs next week month send sent get review plan work update decisions description summary new first agree agreed build create write add'.split(' '),
);

/** Technologies the offline extractor can recognise. Claude does not need this list. */
const KNOWN_TECH = [
  'python', 'javascript', 'typescript', 'java', 'c#', 'golang', 'rust', 'php', 'ruby', 'kotlin', 'sql',
  'react', 'next.js', 'vue', 'angular', 'svelte', 'node.js', 'django', 'flask', 'fastapi', 'spring boot', 'laravel', 'ruby on rails', '.net',
  'postgresql', 'mysql', 'sql server', 'mongodb', 'redis', 'elasticsearch', 'snowflake', 'bigquery', 'databricks', 'dbt', 'airflow', 'kafka', 'apache spark',
  'aws', 'azure', 'google cloud', 'kubernetes', 'docker', 'terraform', 'ci-cd', 'github actions', 'gitlab',
  'salesforce', 'hubspot', 'sap', 'workday', 'netsuite', 'shopify', 'stripe', 'wordpress', 'contentful', 'figma', 'jira', 'confluence', 'sharepoint',
  'microsoft teams', 'slack', 'zoom', 'google meet', 'excel', 'powerbi', 'tableau', 'looker',
  'llms', 'generative ai', 'machine learning', 'embeddings', 'retrieval-augmented generation', 'pgvector', 'openai', 'claude',
  'rest api', 'graphql', 'oauth', 'single sign-on', 'ios', 'android', 'react native', 'flutter', 'tailwind', 'html', 'css',
];
const TECH_PATTERNS = KNOWN_TECH.map((t) => ({ t, re: new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&')}($|[^a-z0-9+#])`, 'i') }));
const EXTRA_SPELLINGS: [RegExp, string][] = [
  [/\bpostgres\b/i, 'postgresql'], [/\bnext\.?js\b/i, 'next.js'], [/\bnode\.?js\b/i, 'node.js'], [/\bk8s\b/i, 'kubernetes'],
  [/\bpower bi\b/i, 'powerbi'], [/\bLLMs?\b/, 'llms'], [/\bGCP\b/, 'google cloud'], [/\bCI\/CD\b/i, 'ci-cd'], [/\bSSO\b/, 'single sign-on'],
];
const DOMAIN_HINTS: [RegExp, string][] = [
  [/\b(event|summit|conference|venue|catering|speakers?)\b/i, 'events'],
  [/\b(website|landing page|seo|cms|case stud(y|ies))\b/i, 'web'],
  [/\b(checkout|cart|shop|ecommerce|e-commerce|orders?)\b/i, 'ecommerce'],
  [/\b(warehouse|pipeline|etl|dashboard|analytics|kpi|reporting)\b/i, 'data and analytics'],
  [/\b(onboarding|recruit|hiring|payroll|employee)\b/i, 'hr'],
  [/\b(invoice|budget|billing|finance|accounting)\b/i, 'finance'],
  [/\b(crm|lead|sales|pipeline review|customers?)\b/i, 'sales and customers'],
  [/\b(mobile app|ios|android)\b/i, 'mobile'],
  [/\b(model|llm|chatbot|assistant|embedding|machine learning)\b/i, 'ai'],
  [/\b(campaign|newsletter|brand|social media|marketing)\b/i, 'marketing'],
];

/** A serviceable profile from word counts and dictionaries. Used when no model is configured, and in tests. */
export function extractProfileOffline(sourceText: string, description = ''): ProjectProfile {
  const technologies: string[] = [];
  for (const { t, re } of TECH_PATTERNS) if (re.test(sourceText)) technologies.push(t);
  for (const [re, t] of EXTRA_SPELLINGS) if (re.test(sourceText) && !technologies.includes(t)) technologies.push(t);

  const counts = new Map<string, number>();
  const body = sourceText.replace(/^(PROJECT|DESCRIPTION|TASKS|MEETINGS):/gm, ' ');
  for (const w of body.toLowerCase().match(/[a-zà-ÿ][a-zà-ÿ-]{3,}/g) ?? []) {
    if (STOP.has(w) || technologies.includes(normalizeTerm(w))) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const keywords = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([w]) => w);
  const domains = DOMAIN_HINTS.filter(([re]) => re.test(sourceText)).map(([, d]) => d).slice(0, 3);
  const sentences = description.split(/(?<=[.!?])\s+/).filter(Boolean);
  return {
    summary: sentences.slice(0, 3).join(' ') || 'No description yet.',
    goals: [],
    keywords: normalizeList(keywords, 10),
    technologies: normalizeList(technologies, 25),
    domains,
    deliverables: [],
  };
}
