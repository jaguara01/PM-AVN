import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { openEmbedded } from '@/lib/db/client';
import { listOpenActionsFor } from '@/lib/db/repo';
import { hourNow } from '@/lib/dates';
import { loadExamples } from '@/lib/examples';
import { importMeeting, sendActionToBoard } from '@/lib/services/meetings';

describe('my work', () => {
  it('lists action items promised by a person that are not on a board yet', async () => {
    const db = await openEmbedded();
    await loadExamples(db, '2026-11-19');
    const { id } = await importMeeting(db, { text: readFileSync('prototype/sample.txt', 'utf8'), projectId: 'summit', heldOn: '2026-11-17' }, null);
    const open = await listOpenActionsFor(db, 'Priya Nair');
    expect(open.length).toBeGreaterThan(0);
    expect(open[0]).toMatchObject({ meetingId: id, meetingTitle: 'Untitled meeting' });
    await sendActionToBoard(db, open[0].id);
    expect((await listOpenActionsFor(db, 'Priya Nair')).length).toBe(open.length - 1);
    await db.close();
  });
});

describe('time of day', () => {
  it('is an hour from 0 to 23', () => {
    const h = hourNow(new Date('2026-11-19T23:30:00Z'));
    expect(h).toBe(0); // 00:30 in Brussels
  });
});
