import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTranscript, heuristic, parseDue } from '@/lib/transcript/core.js';

describe('transcript parsing', () => {
  it('reads the Zoom-style sample', () => {
    const { turns, format } = parseTranscript(readFileSync('prototype/sample.txt', 'utf8'));
    expect(format).toBe('Zoom-style');
    expect(turns).toHaveLength(15);
    expect(turns[2]).toMatchObject({ spk: 'Tom Becker', t: 48 });
  });
  it('reads WebVTT, SRT, "Name: text" and JSON', () => {
    expect(parseTranscript('WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n<v Alice Roe>Hello team.</v>').turns[0].spk).toBe('Alice Roe');
    expect(parseTranscript('1\n00:00:01,000 --> 00:00:04,000\nBob: Hi.').format).toBe('SRT');
    expect(parseTranscript('Alice Roe: Hello all.\nBob Kim: Let us begin.').turns).toHaveLength(2);
    expect(parseTranscript('[{"speaker":"A","text":"hi","start":1}]').format).toBe('JSON');
  });
  it('finds commitments and requests spoken to the assistant', () => {
    const { turns } = parseTranscript(readFileSync('prototype/sample.txt', 'utf8'));
    const a = heuristic(turns, 'Claude');
    expect(a.actions.some((x: { owner: string; due: string }) => x.owner === 'Priya Nair' && /friday/i.test(x.due))).toBe(true);
    expect(a.commands).toHaveLength(3);
  });
  it('turns spoken deadlines into dates relative to the meeting', () => {
    expect(parseDue('by Friday', '2026-11-11')).toBe('2026-11-13');
    expect(parseDue('end of the month', '2026-11-13')).toBe('2026-11-30');
    expect(parseDue('soon', '2026-11-13')).toBe('');
  });
});
