import Anthropic from '@anthropic-ai/sdk';
import type { CompleteFn } from '@/lib/similarity';

export const claudeModel = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

/** Returns null when no API key is configured, so callers can fall back to the offline extractor. */
export function claudeFromEnv(): CompleteFn | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic();
  return async (prompt) => {
    const message = await client.messages.create({ model: claudeModel(), max_tokens: 1500, messages: [{ role: 'user', content: prompt }] });
    return message.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
  };
}
