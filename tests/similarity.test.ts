import { describe, expect, it } from 'vitest';
import {
  HashEmbedder, buildSourceText, contentHash, cosine, extractProfileOffline, extractProfileWithModel, inverseFrequency, normalizeList, parseJsonObject,
  rankSimilar, scoreSimilarity, weightedOverlap, type Comparable, type ProjectProfile,
} from '@/lib/similarity';

const profile = (over: Partial<ProjectProfile>): ProjectProfile => ({ summary: '', goals: [], keywords: [], technologies: [], domains: [], deliverables: [], ...over });

describe('normalising terms', () => {
  it('maps spellings of one technology to one name and removes duplicates', () => {
    expect(normalizeList(['Postgres', 'postgresql', ' PG ', 'NextJS', 'K8s'])).toEqual(['postgresql', 'next.js', 'kubernetes']);
  });
  it('ignores values that are not strings', () => {
    expect(normalizeList(['React', 3, null, ''])).toEqual(['react']);
  });
});

describe('overlap', () => {
  it('is null when one side has no data', () => {
    expect(weightedOverlap([], ['react']).value).toBeNull();
  });
  it('counts a rare shared term for more than a common one', () => {
    const idf = inverseFrequency([['excel', 'snowflake'], ['excel', 'snowflake'], ['excel'], ['excel'], ['excel', 'react']]);
    const rare = weightedOverlap(['excel', 'snowflake'], ['snowflake', 'react'], idf).value!;
    const common = weightedOverlap(['excel', 'snowflake'], ['excel', 'react'], idf).value!;
    expect(rare).toBeGreaterThan(common);
  });
});

describe('hybrid score', () => {
  const emb = (x: number, y: number) => [x, y];
  const a: Comparable = { projectId: 'a', embedding: emb(1, 0), profile: profile({ technologies: ['snowflake', 'powerbi'], keywords: ['kpi', 'sales'], domains: ['data and analytics'] }) };
  const b: Comparable = { projectId: 'b', embedding: emb(0.9, 0.1), profile: profile({ technologies: ['snowflake', 'dbt'], keywords: ['kpi', 'finance'], domains: ['data and analytics'] }) };
  const c: Comparable = { projectId: 'c', embedding: emb(0, 1), profile: profile({ technologies: ['figma'], keywords: ['venue'], domains: ['events'] }) };

  it('ranks the related project first and says why', () => {
    const ranked = rankSimilar(a, [a, b, c]);
    expect(ranked.map((r) => r.projectId)).toEqual(['b', 'c']);
    expect(ranked[0].shared.technologies).toEqual(['snowflake']);
    expect(ranked[0].reason).toMatch(/snowflake/);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
  it('does not punish a project for having no technologies recorded', () => {
    const bare: Comparable = { projectId: 'd', embedding: emb(1, 0), profile: profile({}) };
    const r = scoreSimilarity(a, bare);
    expect(r.parts.technologies).toBeNull();
    expect(r.score).toBeCloseTo(1, 5);
  });
  it('stays between 0 and 1', () => {
    for (const r of rankSimilar(a, [a, b, c])) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });
});

describe('profile extraction', () => {
  const text = buildSourceText({ name: 'Sales reporting', description: 'Weekly dashboards for managers.', tasks: [{ title: 'Build Power BI dashboards on Snowflake' }, { title: 'Connect Salesforce data' }], meetings: [] });

  it('offline: finds named technologies and a domain', () => {
    const p = extractProfileOffline(text, 'Weekly dashboards for managers.');
    expect(p.technologies).toEqual(expect.arrayContaining(['snowflake', 'powerbi', 'salesforce']));
    expect(p.domains).toContain('data and analytics');
    expect(p.summary).toBe('Weekly dashboards for managers.');
  });
  it('offline: does not mistake ordinary words for technologies', () => {
    const p = extractProfileOffline('PROJECT: Launch\n\nTASKS:\n- Go live in spring\n- Spark interest with a swift campaign');
    expect(p.technologies).toEqual([]);
  });
  it('with a model: accepts fenced JSON and normalises the lists', async () => {
    const reply = '```json\n{"summary":"S","goals":["g"],"keywords":["KPI","kpi"],"technologies":["Postgres","Power BI"],"domains":["Data Platform"],"deliverables":[]}\n```';
    const p = await extractProfileWithModel(text, async () => reply);
    expect(p).toMatchObject({ summary: 'S', keywords: ['kpi'], technologies: ['postgresql', 'powerbi'], domains: ['data platform'] });
  });
  it('with a model: rejects a reply without JSON', () => {
    expect(() => parseJsonObject('Sorry, I cannot.')).toThrow();
  });
  it('hash changes only when the source changes', () => {
    expect(contentHash(text)).toBe(contentHash(text));
    expect(contentHash(text)).not.toBe(contentHash(text + ' more'));
  });
});

describe('local hash embedder', () => {
  it('puts texts with shared wording closer than unrelated ones', async () => {
    const [x, y, z] = await new HashEmbedder().embed(['Power BI dashboards on Snowflake for sales', 'Sales dashboards built on Snowflake', 'Book a venue and catering for the summit']);
    expect(cosine(x, y)).toBeGreaterThan(cosine(x, z));
  });
});
