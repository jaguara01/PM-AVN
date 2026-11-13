export interface Embedder {
  /** Stored next to each vector. Vectors from different models are never compared. */
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
}

function l2normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return n ? v.map((x) => x / n) : v;
}

/** Works with any service that exposes an OpenAI-style `POST {baseUrl}/embeddings`. */
export class HttpEmbedder implements Embedder {
  readonly model: string;
  constructor(private baseUrl: string, model: string, private apiKey?: string) {
    this.model = model;
  }
  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}) },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) throw new Error(`Embeddings request failed with ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as { data?: { index?: number; embedding: number[] }[] };
    if (!json.data || json.data.length !== texts.length) throw new Error('Embeddings response did not contain one vector per input.');
    return [...json.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((d) => l2normalize(d.embedding));
  }
}

const HASH_STOP = new Set(
  'the and for with from that this into over before after each one two three new are was will can has have its their our your not but all per goals deliverables domains technologies keywords project'.split(' '),
);

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Local fallback with no network: hashes words and word pairs into a fixed-size vector.
 * It matches shared wording, not meaning ("venue" and "location" look unrelated), so use a real
 * embedding model for anything beyond development and tests.
 */
export class HashEmbedder implements Embedder {
  readonly model: string;
  constructor(private dim = 512) {
    this.model = `local-hash-${dim}`;
  }
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const v = new Array<number>(this.dim).fill(0);
      const words = (text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}.#+-]*/gu) ?? [])
        .map((w) => w.replace(/[.-]+$/, ''))
        .filter((w) => w.length > 2 && !HASH_STOP.has(w))
        .map((w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
      const grams = words.concat(words.slice(1).map((w, i) => `${words[i]} ${w}`));
      const tf = new Map<string, number>();
      for (const g of grams) tf.set(g, (tf.get(g) ?? 0) + 1);
      for (const [g, n] of tf) {
        const hsh = fnv1a(g);
        v[hsh % this.dim] += (hsh & 0x80000000 ? -1 : 1) * (1 + Math.log(n));
      }
      return l2normalize(v);
    });
  }
}

export function embedderFromEnv(env: Record<string, string | undefined> = process.env): Embedder {
  if (env.EMBEDDINGS_BASE_URL && env.EMBEDDINGS_MODEL) return new HttpEmbedder(env.EMBEDDINGS_BASE_URL, env.EMBEDDINGS_MODEL, env.EMBEDDINGS_API_KEY);
  return new HashEmbedder();
}
