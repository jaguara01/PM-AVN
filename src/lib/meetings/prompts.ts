/** Templates and prompts for documents, questions and in-call requests. Pure functions: the caller supplies the model. */

export const MEETING_TEMPLATES = {
  minutes: ['Meeting minutes', 'Formal minutes: attendees, agenda items discussed, decisions, action items table (task, owner, due), open issues.'],
  email: ['Recap email', 'A concise recap email to all participants: 3-sentence summary, decisions, action items grouped by owner with due dates, and open questions. Include a subject line.'],
  plan: ['Plan with timeline', 'A project plan from what was discussed: goal, scope, workstreams with owners, a milestone table with dates (only dates stated or clearly implied; mark others TBD), risks, and open questions.'],
  numbers: ['Numbers brief', 'Collect every figure, cost, estimate or target mentioned. Present a table (item, figure, who said it, line ref), then call out inconsistencies, missing numbers and what must be confirmed.'],
  spec: ['Spec draft', 'A requirements draft: problem, goals, non-goals, requirements, user stories, open questions, and next steps, derived strictly from the discussion.'],
  customer: ['Customer call brief', 'Who was involved, customer needs and pain points, objections, commitments we made, commitments they made, and recommended next steps.'],
  decisions: ['Decision log', 'For each decision give context, options considered, the decision, rationale, owner, and the line where it was made.'],
  custom: ['Your own brief', ''],
} as const satisfies Record<string, readonly [string, string]>;

export const PROJECT_TEMPLATES = {
  status: ['Status update', 'A status update for stakeholders: overall state in two sentences, what was finished, what is in progress, what is late and why it matters, decisions taken in recent meetings, and what happens next week.'],
  week: ['Plan for next week', 'A plan for the next seven days: per person, the tasks to focus on in priority order, with due dates, and anything blocking them.'],
  risks: ['Risk review', 'A risk review: late tasks, tasks with no owner or no date, overloaded people, risks and open questions raised in meetings. A table with risk, evidence, suggested mitigation and owner.'],
  sponsor: ['Sponsor email', 'A short email to a sponsor who has two minutes: where the project stands, the one decision or help needed from them, and the next milestone. Include a subject line.'],
  custom: ['Your own brief', ''],
} as const satisfies Record<string, readonly [string, string]>;

export type MeetingTemplate = keyof typeof MEETING_TEMPLATES;
export type ProjectTemplate = keyof typeof PROJECT_TEMPLATES;

const RULES = 'Use Markdown (headings, lists, tables where useful). Use only the material below; do not invent facts, names, numbers or dates, and write "TBD" when something is unknown.';

export function documentPrompt(name: string, instructions: string, extra: string, material: string, citeLines: boolean): string {
  return `You write working documents for a project team. Produce: ${name}. ${instructions}
${extra ? `Extra instructions from the user: ${extra}\n` : ''}Rules: ${RULES}${citeLines ? ' Cite transcript lines as [#n].' : ''} Reply with the document only.

${material}`;
}

export function askPrompt(question: string, meetingTitle: string, transcript: string, otherMeetings: string, history: { role: 'user' | 'assistant'; content: string }[]): string {
  const past = history.slice(-6).map((m) => `${m.role === 'user' ? 'Question' : 'Answer'}: ${m.content}`).join('\n');
  return `You answer questions about meetings using ONLY the material below. Cite lines of the current meeting as [#n]; for other meetings cite the meeting title. If the material does not contain the answer, say so. Be concise; use lists or tables when they help.

CURRENT MEETING: ${meetingTitle}
TRANSCRIPT:
${transcript}
${otherMeetings ? `\nOTHER MEETINGS (summaries only):\n${otherMeetings}\n` : ''}${past ? `\nEARLIER IN THIS CONVERSATION:\n${past}\n` : ''}
QUESTION: ${question}`;
}

export function commandPrompt(wake: string, speaker: string, turn: number, request: string, transcriptSoFar: string): string {
  return `You were present in this meeting as an assistant called "${wake}". At line ${turn}, ${speaker} asked you: "${request}"
Carry out the request using only the transcript so far (below). Produce the deliverable directly in Markdown (document, timeline table, recap, answer), and cite lines as [#n]. If the request needs data you do not have, such as files in another app, say exactly what you would need and give the best draft you can with placeholders marked TBD. Do not invent figures.

TRANSCRIPT SO FAR:
${transcriptSoFar}`;
}
