/* Typed entry point for the transcript parser and meeting heuristics in core.js (ported from the prototype). */
import * as core from './core.js';

export interface Turn {
  /** Position in the transcript, from 0. Used as the line number everywhere. */
  i: number;
  spk: string;
  /** Seconds from the start, when the transcript has timestamps. */
  t: number | null;
  text: string;
}

export interface HeuristicAnalysis {
  summary: string;
  topics: { title: string; start: number; summary: string }[];
  decisions: { text: string; turn: number }[];
  actions: { task: string; owner: string; due: string | null; priority: 'high' | 'medium' | 'low'; turn: number }[];
  questions: { text: string; owner: string; turn: number }[];
  risks: { text: string; turn: number }[];
  commands: { turn: number; speaker: string; request: string }[];
}

type Core = {
  parseTranscript: (raw: string) => { turns: Turn[]; format: string };
  heuristic: (turns: Turn[], wake: string) => HeuristicAnalysis;
  redact: (s: string) => string;
  externalDomains: (turns: Turn[], extra: unknown[], internal: string) => string[];
  speakerStats: (turns: Turn[]) => { name: string; words: number; turns: number; secs: number; pct: number }[];
  duration: (turns: Turn[]) => number | null;
  fmtT: (s: number | null) => string;
  parseDue: (text: string | null, base: string) => string;
};
const c = core as unknown as Core;

export const parseTranscript = c.parseTranscript;
export const heuristic = c.heuristic;
export const redact = c.redact;
export const externalDomains = c.externalDomains;
export const speakerStats = c.speakerStats;
export const duration = c.duration;
export const fmtT = c.fmtT;
/** "by Friday" → an ISO date relative to `base` (the meeting date), or "" when the text has no recognisable date. */
export const parseDue = c.parseDue;
