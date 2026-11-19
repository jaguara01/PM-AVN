import { describe, expect, it } from 'vitest';
import { llmFromEnv, openAICompatibleComplete } from '@/lib/llm';
import { HttpEmbedder, embedderFromEnv } from '@/lib/similarity';

/** A fetch stand-in that records the request and answers with `body`. No network. */
function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('choosing the text model', () => {
  it('is null with nothing configured', () => {
    expect(llmFromEnv({})).toBeNull();
  });
  it('uses Claude with an Anthropic key', () => {
    expect(llmFromEnv({ ANTHROPIC_API_KEY: 'x' })?.name).toBe('claude-sonnet-5-5');
  });
  it('prefers an OpenAI-compatible service and labels Azure', () => {
    const env = { ANTHROPIC_API_KEY: 'x', LLM_BASE_URL: 'https://pmavn.openai.azure.com/openai/v1', LLM_MODEL: 'gpt-4.1-mini', LLM_API_KEY: 'k' };
    expect(llmFromEnv(env)?.name).toBe('azure-openai:gpt-4.1-mini');
    expect(llmFromEnv({ LLM_BASE_URL: 'http://localhost:11434/v1', LLM_MODEL: 'llama3.2' })?.name).toBe('openai-compatible:llama3.2');
  });
});

describe('OpenAI-compatible chat', () => {
  it('calls Azure OpenAI v1 with the deployment name and both key headers', async () => {
    const { impl, calls } = fakeFetch({ choices: [{ message: { content: '{"summary":"S"}' } }] });
    const complete = openAICompatibleComplete('https://pmavn.openai.azure.com/openai/v1/', 'gpt-4.1-mini', 'secret', impl);
    expect(await complete('hello')).toBe('{"summary":"S"}');
    expect(calls[0].url).toBe('https://pmavn.openai.azure.com/openai/v1/chat/completions');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['api-key']).toBe('secret');
    expect(headers.authorization).toBe('Bearer secret');
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ model: 'gpt-4.1-mini', messages: [{ role: 'user', content: 'hello' }] });
  });
  it('sends no Azure header to other services, and no key when none is set', async () => {
    const { impl, calls } = fakeFetch({ choices: [{ message: { content: 'ok' } }] });
    await openAICompatibleComplete('http://localhost:11434/v1', 'llama3.2', undefined, impl)('hi');
    expect(calls[0].init.headers).toEqual({ 'content-type': 'application/json' });
  });
  it('reports the status and message when the service refuses', async () => {
    const { impl } = fakeFetch({ error: { message: 'DeploymentNotFound' } }, 404);
    await expect(openAICompatibleComplete('https://x.openai.azure.com/openai/v1', 'nope', 'k', impl)('hi')).rejects.toThrow(/404.*DeploymentNotFound/);
  });
});

describe('embeddings from Azure OpenAI', () => {
  it('uses the same v1 base URL and deployment name', () => {
    const e = embedderFromEnv({ EMBEDDINGS_BASE_URL: 'https://pmavn.openai.azure.com/openai/v1', EMBEDDINGS_MODEL: 'text-embedding-3-small', EMBEDDINGS_API_KEY: 'k' });
    expect(e).toBeInstanceOf(HttpEmbedder);
    expect(e.model).toBe('text-embedding-3-small');
  });
  it('sends the deployment name and both key headers, and keeps vectors in input order', async () => {
    const { impl, calls } = fakeFetch({ data: [{ index: 1, embedding: [0, 2] }, { index: 0, embedding: [3, 4] }] });
    const vectors = await new HttpEmbedder('https://pmavn.openai.azure.com/openai/v1', 'text-embedding-3-small', 'k', impl).embed(['a', 'b']);
    expect(calls[0].url).toBe('https://pmavn.openai.azure.com/openai/v1/embeddings');
    expect((calls[0].init.headers as Record<string, string>)['api-key']).toBe('k');
    expect(vectors).toEqual([[0.6, 0.8], [0, 1]]);
  });
});
