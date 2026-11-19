import { z } from 'zod';
import { heuristic, fmtT, redact, type Turn } from '@/lib/transcript';
import { parseJsonObject, type CompleteFn } from '@/lib/similarity';

export interface Analysis {
  /** "offline" for the keyword extractor, otherwise the model's name. */
  writtenBy: string;
  title: string;
  summary: string;
  topics: { title: string; start: number; summary: string }[];
  decisions: { text: string; turn: number }[];
  questions: { text: string; owner: string; turn: number }[];
  risks: { text: string; turn: number }[];
  /** Requests addressed to the assistant during the call ("Claude, start a doc"), with the result once run. */
  commands: { turn: number; speaker: string; request: string; result?: string }[];
}

/** An action item as found in the transcript, before anyone reviewed it. */
export interface ProposedAction {
  task: string;
  owner: string;
  /** The deadline as said ("by Friday"), or null. */
  due: string | null;
  priority: 'high' | 'medium' | 'low';
  turn: number;
}

/** The transcript as the model sees it: one numbered line per turn, with contact details masked when asked. */
export function transcriptText(turns: Turn[], opts: { redact: boolean; upto?: number }): string {
  return turns
    .filter((t) => opts.upto === undefined || t.i <= opts.upto)
    .map((t) => {
      const line = `[${t.i}] ${t.spk}${t.t !== null ? ` (${fmtT(t.t)})` : ''}: ${t.text}`;
      return opts.redact ? redact(line) : line;
    })
    .join('\n');
}

const SCHEMA = `{
 "title": "short meeting title",
 "summary": "4-6 sentence summary of what was discussed and concluded",
 "topics": [{"title":"", "start": <turn index where it begins>, "summary":"one sentence"}],
 "decisions": [{"text":"", "turn": <n>}],
 "actions": [{"task":"imperative sentence", "owner":"participant name or Unassigned", "due":"as stated, or null", "priority":"high|medium|low", "turn": <n>}],
 "questions": [{"text":"open question not resolved in the meeting", "owner":"who raised it or should answer", "turn": <n>}],
 "risks": [{"text":"", "turn": <n>}],
 "commands": [{"turn": <n>, "speaker":"", "request":"verbatim request addressed to the assistant"}]
}`;

export function analysisPrompt(body: string, wake: string, part: boolean): string {
  return `You are the note-taker for a team meeting. Below is a transcript, one line per turn, formatted "[n] Speaker (m:ss): text".
${part ? 'This is one part of a longer transcript.\n' : ''}Return ONLY one JSON object, no prose, with exactly this shape:
${SCHEMA}
Rules: ground every item in the transcript and never invent facts, owners or dates. "turn" must be the [n] index where the item is best evidenced. Owners must be participant names exactly as written. Action items are commitments or explicit requests, not general discussion. Decisions are things the group agreed. "commands" are requests addressed to an assistant called "${wake}" (e.g. "${wake}, start a doc"). Use empty arrays when there is nothing. Write in the language of the transcript.

TRANSCRIPT:
${body}`;
}

const loose = z.array(z.any()).catch([]);
const Raw = z.object({
  title: z.string().catch(''),
  summary: z.string().catch(''),
  topics: loose, decisions: loose, actions: loose, questions: loose, risks: loose, commands: loose,
});

/** Turns whatever the model returned into a clean analysis: turn numbers clamped to the transcript, empty items dropped. */
export function normalize(raw: unknown, turns: Turn[], writtenBy: string): { analysis: Analysis; actions: ProposedAction[] } {
  const a = Raw.parse(raw ?? {});
  const n = turns.length;
  const T = (v: unknown) => {
    const x = parseInt(String(v), 10);
    return Number.isNaN(x) ? 0 : Math.max(0, Math.min(n - 1, x));
  };
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v && typeof v === 'object' && 'text' in v ? String((v as { text: unknown }).text).trim() : '');
  const prio = (p: unknown) => (p === 'high' || p === 'low' ? p : 'medium') as ProposedAction['priority'];
  const analysis: Analysis = {
    writtenBy,
    title: a.title.trim(),
    summary: a.summary.trim(),
    topics: a.topics.map((t) => ({ title: str(t?.title) || 'Topic', start: T(t?.start), summary: str(t?.summary) })).sort((x, y) => x.start - y.start),
    decisions: a.decisions.map((d) => ({ text: str(d), turn: T(d?.turn) })).filter((d) => d.text),
    questions: a.questions.map((q) => ({ text: str(q), owner: str(q?.owner), turn: T(q?.turn) })).filter((q) => q.text),
    risks: a.risks.map((r) => ({ text: str(r), turn: T(r?.turn) })).filter((r) => r.text),
    commands: a.commands
      .map((c) => ({ turn: T(c?.turn), speaker: str(c?.speaker) || turns[T(c?.turn)]?.spk || '', request: str(c?.request) }))
      .filter((c) => c.request),
  };
  const actions = a.actions
    .map((x) => ({
      task: str(x?.task),
      owner: str(x?.owner) || 'Unassigned',
      due: x?.due && String(x.due) !== 'null' ? String(x.due) : null,
      priority: prio(x?.priority),
      turn: T(x?.turn),
    }))
    .filter((x) => x.task);
  return { analysis, actions };
}

export function offlineAnalysis(turns: Turn[], wake: string): { analysis: Analysis; actions: ProposedAction[] } {
  const h = heuristic(turns, wake);
  return { ...normalize({ ...h, title: '' }, turns, 'offline') };
}

/** Splits long transcripts so each request stays a reasonable size, then merges the partial results. */
export async function analyzeWithModel(turns: Turn[], opts: { wake: string; redact: boolean; complete: CompleteFn; writtenBy: string; maxChars?: number }) {
  const max = opts.maxChars ?? 45000;
  const parts: string[] = [];
  let cur = '';
  for (const t of turns) {
    const line = transcriptText([t], { redact: opts.redact }) + '\n';
    if (cur && cur.length + line.length > max) {
      parts.push(cur);
      cur = '';
    }
    cur += line;
  }
  if (cur) parts.push(cur);
  let raw: unknown;
  if (parts.length <= 1) raw = parseJsonObject(await opts.complete(analysisPrompt(parts[0] ?? '', opts.wake, false)));
  else {
    const partial: unknown[] = [];
    for (const p of parts) partial.push(parseJsonObject(await opts.complete(analysisPrompt(p, opts.wake, true))));
    raw = parseJsonObject(
      await opts.complete(
        `Merge these partial meeting analyses (JSON, from consecutive parts of one transcript) into ONE analysis with exactly this shape, deduplicating and keeping the original "turn" indices. Return ONLY JSON.\n${SCHEMA}\n\nPARTS:\n${JSON.stringify(partial)}`,
      ),
    );
  }
  return normalize(raw, turns, opts.writtenBy);
}
