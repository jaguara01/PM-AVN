import Anthropic from '@anthropic-ai/sdk';
import type { CompleteFn } from '@/lib/similarity';

/** A configured text model: how to call it, and the name stored with each profile it writes. */
export interface Llm {
  complete: CompleteFn;
  /** For example "claude-sonnet-5-5" or "azure-openai:gpt-4.1-mini". */
  name: string;
}

type Env = Record<string, string | undefined>;

/**
 * Any service with an OpenAI-style `POST {baseUrl}/chat/completions`: Azure OpenAI (v1 API), Google Gemini, OpenAI, Ollama.
 * Azure OpenAI: `baseUrl` is https://<resource>.openai.azure.com/openai/v1 and `model` is the deployment name.
 * Gemini: `baseUrl` is https://generativelanguage.googleapis.com/v1beta/openai and the key comes from Google AI Studio.
 */
export function openAICompatibleComplete(baseUrl: string, model: string, apiKey?: string, fetchImpl: typeof fetch = fetch): CompleteFn {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const isAzure = /\.azure\.com/i.test(baseUrl);
  const isGemini = /generativelanguage\.googleapis\.com/i.test(baseUrl);
  return async (prompt) => {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Azure accepts its key in either header; other services expect the bearer token.
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        ...(apiKey && isAzure ? { 'api-key': apiKey } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        // Gemini 3 models always think and cannot switch it off; keep that short. Profiles are small, so no token cap is set:
        // a cap that thinking tokens also count against can cut the JSON off half-way.
        ...(isGemini ? { reasoning_effort: 'low' } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Chat request to ${url} failed with ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    const text = json.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('Chat response contained no message text.');
    return text;
  };
}

function anthropicComplete(model: string): CompleteFn {
  const client = new Anthropic();
  return async (prompt) => {
    const message = await client.messages.create({ model, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] });
    return message.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
  };
}

/**
 * The text model to use, from environment variables. Returns null when none is configured, so callers fall back to
 * the offline extractor. An OpenAI-compatible service (LLM_BASE_URL and LLM_MODEL) wins over ANTHROPIC_API_KEY.
 */
export function llmFromEnv(env: Env = process.env, fetchImpl?: typeof fetch): Llm | null {
  if (env.LLM_BASE_URL && env.LLM_MODEL) {
    const label = /\.azure\.com/i.test(env.LLM_BASE_URL) ? 'azure-openai' : /generativelanguage\.googleapis\.com/i.test(env.LLM_BASE_URL) ? 'gemini' : 'openai-compatible';
    return { complete: openAICompatibleComplete(env.LLM_BASE_URL, env.LLM_MODEL, env.LLM_API_KEY, fetchImpl), name: `${label}:${env.LLM_MODEL}` };
  }
  if (env.ANTHROPIC_API_KEY) {
    const model = env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
    return { complete: anthropicComplete(model), name: model };
  }
  return null;
}
