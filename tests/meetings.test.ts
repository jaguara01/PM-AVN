import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openEmbedded, type Db } from '@/lib/db/client';
import { createProject, deleteMeeting, getMeeting, getTask, listDocuments, listMeetingActions, listMeetings, listPeople, listTasks, updateMeeting, updateMeetingAction } from '@/lib/db/repo';
import { normalize } from '@/lib/meetings/analysis';
import { renderMarkdown } from '@/lib/markdown';
import { analyzeMeeting, askAboutMeeting, importMeeting, layoutWhiteboard, runMeetingCommand, sendActionToBoard, sendAllToBoard, writeDocument, UserError } from '@/lib/services/meetings';
import { taskSources } from '@/lib/services/sources';
import type { Llm } from '@/lib/llm';

const SAMPLE = readFileSync('prototype/sample.txt', 'utf8');

/** A stand-in model: answers analysis prompts with fixed JSON and everything else with a fixed text. No network. */
function fakeLlm(): Llm & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    name: 'fake-model',
    prompts,
    complete: async (p) => {
      prompts.push(p);
      if (p.startsWith('You are the note-taker')) {
        return '```json\n' + JSON.stringify({
          title: 'Summit planning', summary: 'Harbor Hall chosen.',
          topics: [{ title: 'Venue', start: 0, summary: 's' }, { title: 'Budget', start: 7, summary: 's' }],
          decisions: [{ text: 'Harbor Hall, 18 and 19 March', turn: 6 }],
          actions: [
            { task: 'Get two catering quotes', owner: 'Priya Nair', due: 'by Friday', priority: 'high', turn: 5 },
            { task: 'Send revised budget', owner: 'Tom Becker', due: 'next Wednesday', priority: 'medium', turn: 7 },
            { task: 'Decide the emcee', owner: 'Team', due: null, priority: 'low', turn: 99 },
          ],
          questions: [{ text: 'Invite partners?', owner: 'Maya Chen', turn: 9 }],
          risks: [{ text: 'Speaker travel not budgeted', turn: 8 }],
          commands: [{ turn: 2, speaker: 'Tom Becker', request: 'Claude, start a doc for this plan' }],
        }) + '\n```';
      }
      return '## Answer\nHarbor Hall [#6]';
    },
  };
}

let db: Db;
beforeAll(async () => {
  db = await openEmbedded();
  await createProject(db, { id: 'summit', name: 'Customer summit' });
});
afterAll(() => db.close());

describe('analysis clean-up', () => {
  it('clamps line numbers, drops empty items and defaults owners and priorities', () => {
    const turns = [{ i: 0, spk: 'A', t: null, text: 'x' }, { i: 1, spk: 'B', t: null, text: 'y' }];
    const { analysis, actions } = normalize({ decisions: [{ text: 'd', turn: 40 }, { text: '' }], actions: [{ task: 't', priority: 'urgent' }, { task: '' }], commands: 'oops' }, turns, 'm');
    expect(analysis.decisions).toEqual([{ text: 'd', turn: 1 }]);
    expect(actions).toEqual([{ task: 't', owner: 'Unassigned', due: null, priority: 'medium', turn: 0 }]);
    expect(analysis.commands).toEqual([]);
  });
});

describe('markdown', () => {
  it('escapes HTML and links line references', () => {
    const html = renderMarkdown('# Title\n<script>x</script> see [#4]\n\n| a | b |\n|---|---|\n| 1 | 2 |', (n) => `/t#turn-${n}`);
    expect(html).toContain('<h3>Title</h3>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<a class="ref" href="/t#turn-4">4</a>');
    expect(html).toContain('<td>1</td>');
  });
});

describe('meetings', () => {
  let offlineId = '';
  let modelId = '';

  it('imports offline with quick notes and dated action items', async () => {
    ({ id: offlineId } = await importMeeting(db, { text: SAMPLE, projectId: 'summit', heldOn: '2026-11-17', domains: 'acme.com' }, null));
    const m = (await getMeeting(db, offlineId))!;
    expect(m).toMatchObject({ format: 'Zoom-style', title: 'Untitled meeting', external: ['partnerco.com'] });
    expect(m.analysis.writtenBy).toBe('offline');
    expect(m.analysis.commands).toHaveLength(3);
    const priya = (await listMeetingActions(db, offlineId)).find((a) => a.owner === 'Priya Nair')!;
    expect(priya).toMatchObject({ dueSaid: 'by Friday', due: '2026-11-20' });
    expect(await listPeople(db)).toContain('Jordan Ellis');
  });

  it('refuses an empty transcript', async () => {
    await expect(importMeeting(db, { text: '   ' }, null)).rejects.toBeInstanceOf(UserError);
  });

  it('imports with a model: title, notes and action items from its answer', async () => {
    const llm = fakeLlm();
    ({ id: modelId } = await importMeeting(db, { text: SAMPLE, projectId: 'summit', heldOn: '2026-11-17' }, llm));
    const m = (await getMeeting(db, modelId))!;
    expect(m.title).toBe('Summit planning');
    expect(m.analysis.writtenBy).toBe('fake-model');
    const actions = await listMeetingActions(db, modelId);
    expect(actions.map((a) => [a.task, a.owner, a.due])).toEqual([
      ['Get two catering quotes', 'Priya Nair', '2026-11-20'],
      ['Send revised budget', 'Tom Becker', '2026-11-18'],
      ['Decide the emcee', 'Unassigned', null],
    ]);
    expect(llm.prompts[0]).toContain('[email]'); // contact details masked by default
  });

  it('sends action items to the board and keeps them through a rewrite', async () => {
    const [first] = await listMeetingActions(db, modelId);
    await updateMeetingAction(db, first.id, { owner: 'Maya Chen' });
    const taskId = await sendActionToBoard(db, first.id);
    expect(await getTask(db, taskId)).toMatchObject({ title: 'Get two catering quotes', owner: 'Maya Chen', due: '2026-11-20', priority: 'high', meetingId: modelId, turn: 5 });
    expect(await sendActionToBoard(db, first.id)).toBe(taskId); // sending twice does not duplicate
    await analyzeMeeting(db, modelId, fakeLlm());
    const after = await listMeetingActions(db, modelId);
    expect(after.filter((a) => a.taskId)).toHaveLength(1);
    expect(after.filter((a) => a.task === 'Get two catering quotes')).toHaveLength(1);
    expect(await sendAllToBoard(db, modelId)).toBe(2);
    expect((await listTasks(db, 'summit')).length).toBe(3);
    const src = await taskSources(db, await listTasks(db, 'summit'));
    expect(src[taskId]).toMatchObject({ meetingTitle: 'Summit planning', speaker: 'Priya Nair' });
  });

  it('needs a project before sending', async () => {
    await updateMeeting(db, offlineId, { projectId: null });
    const [a] = await listMeetingActions(db, offlineId);
    await expect(sendActionToBoard(db, a.id)).rejects.toThrow(/Choose a project/);
  });

  it('answers questions, runs in-call requests and writes documents', async () => {
    const llm = fakeLlm();
    expect(await askAboutMeeting(db, modelId, 'Where is it?', 'project', llm)).toContain('Harbor Hall');
    expect((await getMeeting(db, modelId))!.chat).toHaveLength(2);
    await runMeetingCommand(db, modelId, 0, llm);
    expect((await getMeeting(db, modelId))!.analysis.commands[0].result).toContain('Harbor Hall');
    expect(llm.prompts.at(-1)).not.toContain('[14]'); // only the transcript up to the request
    const docId = await writeDocument(db, { meetingId: modelId, template: 'minutes' }, '', llm);
    const pdoc = await writeDocument(db, { projectId: 'summit', template: 'status' }, 'For the board', llm);
    expect((await listDocuments(db, { meetingId: modelId })).map((d) => d.id)).toEqual([docId]);
    expect((await listDocuments(db, { projectId: 'summit' })).map((d) => d.id)).toEqual([pdoc]);
    expect(llm.prompts.at(-1)).toContain('Get two catering quotes');
    await expect(writeDocument(db, { projectId: 'summit', template: 'custom' }, '', llm)).rejects.toThrow(/Describe/);
  });

  it('lays out a whiteboard by topic', async () => {
    const nodes = await layoutWhiteboard(db, (await getMeeting(db, modelId))!);
    expect(nodes.filter((n) => n.kind === 'topic').map((n) => n.text)).toEqual(['Venue', 'Budget']);
    expect(nodes.find((n) => n.kind === 'risk')!.x).toBeGreaterThan(nodes.find((n) => n.kind === 'decision')!.x - 1);
  });

  it('lists meetings with review counts and deletes without losing tasks', async () => {
    const list = await listMeetings(db, { projectId: 'summit' });
    expect(list.find((m) => m.id === modelId)).toMatchObject({ toReview: 0, onBoard: 3 });
    await deleteMeeting(db, modelId);
    const tasks = await listTasks(db, 'summit');
    expect(tasks).toHaveLength(3);
    expect(tasks.every((t) => t.meetingId === null)).toBe(true);
  });
});
