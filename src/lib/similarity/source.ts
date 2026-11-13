import { createHash } from 'node:crypto';
import type { ProjectProfile, ProjectSource } from './types';

/** The text Claude (or the offline extractor) reads to write a profile. Capped so one huge project cannot blow the prompt. */
export function buildSourceText(src: ProjectSource, maxChars = 24000): string {
  const parts = [
    `PROJECT: ${src.name}`,
    src.description ? `DESCRIPTION: ${src.description}` : '',
    src.tasks.length ? 'TASKS:\n' + src.tasks.map((t) => `- ${t.title}${t.notes ? ` (${t.notes})` : ''}`).join('\n') : '',
    src.meetings.length
      ? 'MEETINGS:\n' +
        src.meetings
          .map((m) => `- ${m.title}: ${m.summary ?? ''}${m.decisions?.length ? ` Decisions: ${m.decisions.join('; ')}` : ''}`)
          .join('\n')
      : '',
  ];
  return parts.filter(Boolean).join('\n\n').slice(0, maxChars);
}

/** Changes only when the source material changes, so unchanged projects are not re-extracted or re-embedded. */
export function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}

/** The text that gets embedded. Built from the profile, not the raw source, so projects are compared on what they are about rather than on how their task lists happen to be worded. */
export function profileToEmbeddingText(name: string, p: ProjectProfile): string {
  return [
    `${name}. ${p.summary}`,
    p.goals.length ? `Goals: ${p.goals.join('; ')}` : '',
    p.deliverables.length ? `Deliverables: ${p.deliverables.join('; ')}` : '',
    p.domains.length ? `Domains: ${p.domains.join(', ')}` : '',
    p.technologies.length ? `Technologies: ${p.technologies.join(', ')}` : '',
    p.keywords.length ? `Keywords: ${p.keywords.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
