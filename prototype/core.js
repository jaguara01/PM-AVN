/* Debrief core: transcript parsing + offline heuristic analysis. Pure functions, no DOM. */
const TS = "(\\d{1,2}:\\d{2}(?::\\d{2})?(?:[.,]\\d+)?)";
const NAME = "\\p{Lu}[\\p{L}'.\\-]*(?: [\\p{L}'.\\-]+){0,4}";
const toSec = s => String(s).replace(',', '.').split(':').map(parseFloat).reduce((a, v) => a * 60 + v, 0);
const fmtT = s => {
  if (s == null || isNaN(s)) return '';
  s = Math.round(s);
  const H = Math.floor(s / 3600), M = Math.floor(s % 3600 / 60), S = s % 60;
  return (H ? H + ':' + String(M).padStart(2, '0') : M) + ':' + String(S).padStart(2, '0');
};
const BADNAME = /^(https?|note|notes|agenda|re|fwd|subject|date|time|to|from|cc|bcc|summary|todo|action|decision|question|answer|example|warning)$/i;

const PATS = [
  { id: 'zoom', k: 'header', re: new RegExp("^\\[(.{1,60}?)\\]\\s+" + TS + "\\s*$", 'u'), get: m => ({ spk: m[1], t: toSec(m[2]) }) },
  { id: 'teams', k: 'header', re: new RegExp("^(" + NAME + ")\\s+" + TS + "\\s*$", 'u'), get: m => ({ spk: m[1], t: toSec(m[2]) }) },
  { id: 'tsName', k: 'inline', re: new RegExp("^\\[?" + TS + "\\]?\\s+([^:\\n]{1,40}?):\\s+(.+)$", 'u'), get: m => ({ spk: m[2], t: toSec(m[1]), text: m[3] }) },
  { id: 'nameTs', k: 'inline', re: new RegExp("^([^:\\n(\\[]{1,40}?)\\s*[(\\[]" + TS + "[)\\]]\\s*:?\\s*(.*)$", 'u'), get: m => ({ spk: m[1], t: toSec(m[2]), text: m[3] }) },
  { id: 'name', k: 'inline', re: new RegExp("^([\\p{L}][\\p{L}'.\\-]*(?: [\\p{L}'.\\-]+){0,4}):\\s+(.+)$", 'u'), get: m => ({ spk: m[1], t: null, text: m[2] }) },
];

function mergeSame(turns) {
  const out = [];
  for (const t of turns) {
    const p = out[out.length - 1];
    if (p && p.spk === t.spk) p.text += ' ' + t.text; else out.push({ ...t });
  }
  return out;
}
const finalize = turns => turns.map(t => ({ ...t, spk: (t.spk || 'Speaker').trim().replace(/\s+/g, ' '), text: t.text.trim() }))
  .filter(t => t.text).map((t, i) => ({ ...t, i }));

function parseCues(raw) {
  const out = [];
  for (const block of raw.split(/\n\s*\n/)) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const k = lines.findIndex(l => l.includes('-->'));
    if (k < 0) continue;
    const start = toSec(lines[k].split('-->')[0].trim().split(' ')[0]);
    let text = lines.slice(k + 1).join(' '), spk = 'Speaker';
    const v = text.match(/<v(?:\.[^ >]*)?\s+([^>]+)>/);
    if (v) spk = v[1];
    text = text.replace(/<[^>]+>/g, '').trim();
    if (!v) {
      const m = text.match(/^([\p{L}][\p{L}'.\-]*(?: [\p{L}'.\-]+){0,4}):\s+(.*)$/u);
      if (m && !BADNAME.test(m[1])) { spk = m[1]; text = m[2]; }
    }
    out.push({ spk, t: start, text });
  }
  return mergeSame(out);
}

function fromJSON(j) {
  const arr = Array.isArray(j) ? j : (j.segments || j.transcript || j.utterances || j.turns || j.monologues || (j.results && j.results.items) || null);
  if (!Array.isArray(arr)) return null;
  const out = arr.map(o => {
    if (typeof o === 'string') return { spk: 'Speaker', t: null, text: o };
    let t = o.start ?? o.start_time ?? o.startTime ?? o.timestamp ?? o.time ?? null;
    if (typeof t === 'string') t = t.includes(':') ? toSec(t) : parseFloat(t);
    if (typeof t === 'number' && t > 86400) t /= 1000;
    let text = o.text ?? o.content ?? o.message ?? o.transcript ?? (o.words && o.words.map(w => w.text || w.word).join(' ')) ?? (o.elements && o.elements.map(e => e.value).join('')) ?? '';
    const spk = o.speaker ?? o.speaker_name ?? o.speakerName ?? o.name ?? o.user ?? o.participant ?? o.author ?? 'Speaker';
    return { spk: typeof spk === 'object' ? (spk.name || 'Speaker') : String(spk), t: isNaN(t) ? null : t, text: String(text) };
  });
  return mergeSame(out);
}

function parseTranscript(raw) {
  raw = String(raw || '').replace(/\r/g, '').replace(/^﻿/, '').trim();
  if (!raw) return { turns: [], format: 'empty' };
  if (/^[\[{]/.test(raw)) {
    try { const t = fromJSON(JSON.parse(raw)); if (t && t.length) return { turns: finalize(t), format: 'JSON' }; } catch (e) { }
  }
  if (raw.includes('-->')) {
    const t = parseCues(raw);
    if (t.length) return { turns: finalize(t), format: /^WEBVTT/.test(raw) ? 'WebVTT' : 'SRT' };
  }
  const lines = raw.split('\n').map(l => l.trim());
  const nonEmpty = lines.filter(Boolean).length;
  let best = null, bestN = 0;
  for (const p of PATS) {
    let n = 0;
    for (const l of lines) { const m = l.match(p.re); if (m && !BADNAME.test(p.get(m).spk)) n++; }
    if (n > bestN) { bestN = n; best = p; }
  }
  const need = nonEmpty <= 4 ? 1 : 2;
  if (best && bestN >= need) {
    const turns = []; let cur = null;
    for (const l of lines) {
      if (!l) continue;
      const m = l.match(best.re);
      const g = m && !BADNAME.test(best.get(m).spk) ? best.get(m) : null;
      if (g) { cur = { spk: g.spk, t: g.t, text: g.text || '' }; turns.push(cur); }
      else if (cur) cur.text += (cur.text ? ' ' : '') + l;
      else { cur = { spk: 'Speaker', t: null, text: l }; turns.push(cur); }
    }
    const label = { zoom: 'Zoom-style', teams: 'Teams-style', tsName: 'Timestamped', nameTs: 'Timestamped', name: 'Speaker: text' }[best.id];
    return { turns: finalize(turns), format: label };
  }
  const paras = raw.split(/\n\s*\n/).map(s => s.replace(/\n/g, ' '));
  return { turns: finalize(paras.map(text => ({ spk: 'Speaker', t: null, text }))), format: 'Plain text' };
}

/* ---------- privacy helpers ---------- */
const EMAIL = /[A-Za-z0-9._%+\-]+@([A-Za-z0-9.\-]+\.[A-Za-z]{2,})/g;
const PHONE = /(?<![\w])(?:\+?\d[\d\s().\-]{8,}\d)(?![\w])/g;
const redact = s => s.replace(EMAIL, '[email]').replace(PHONE, '[phone]');
function externalDomains(turns, speakersExtra, internal) {
  const int = internal.split(/[,\s]+/).map(s => s.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
  if (!int.length) return [];
  const found = new Set();
  const txt = turns.map(t => t.spk + ' ' + t.text).join(' ');
  for (const m of txt.matchAll(EMAIL)) { const d = m[1].toLowerCase(); if (!int.some(i => d === i || d.endsWith('.' + i))) found.add(d); }
  if (/\((external|guest)\)/i.test(txt)) found.add('(marked external)');
  return [...found];
}

/* ---------- stats ---------- */
function speakerStats(turns) {
  const m = {};
  turns.forEach((t, k) => {
    const s = m[t.spk] || (m[t.spk] = { name: t.spk, words: 0, turns: 0, secs: 0 });
    s.words += t.text.split(/\s+/).length; s.turns++;
    const nx = turns[k + 1];
    if (t.t != null && nx && nx.t != null && nx.t >= t.t && nx.t - t.t < 300) s.secs += nx.t - t.t;
  });
  const a = Object.values(m).sort((x, y) => y.words - x.words);
  const tot = a.reduce((x, s) => x + s.words, 0) || 1;
  a.forEach(s => s.pct = Math.round(100 * s.words / tot));
  return a;
}
function duration(turns) {
  const ts = turns.map(t => t.t).filter(t => t != null);
  return ts.length > 1 ? Math.max(...ts) - Math.min(...ts) : null;
}

/* ---------- heuristic analysis (works offline, no AI) ---------- */
const STOP = new Set('about above after again also because been before being between both could does doing done down during each even every from further have having here into just like make more most much only other over really same should some such than that their them then there these they this those through very want were what when where which while will with would your yeah okay right think know going gonna need get got let one two can not and the for are but you our out has had how its who why all any'.split(' '));
const DOW = '(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight|eod|eow|end of (?:the )?(?:day|week|month|quarter)|next (?:week|month|quarter|monday|tuesday|wednesday|thursday|friday)|this (?:week|friday|month)|\\d{1,2}[/.]\\d{1,2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \\d{1,2})';
const DUE = new RegExp('\\b(?:by |before |on |until |due )?' + DOW + '\\b', 'i');
const ACT = /\b(i['’]ll|i will|we['’]ll|we will|let me|can you|could you|will you|would you|please|need to|needs to|action item|follow up|follow-up|i can take|i['’]m going to|i am going to|i['’]ve got|take that|owns? (?:this|that))\b/i;
const DEC = /\b(we (?:decided|agreed)|decided|agreed|let['’]s go with|the decision is|approved|we['’]ll go with|we are going with|we['’]re going with|locked|signed off)\b/i;

function keywords(text, n) {
  const f = {};
  (text.toLowerCase().match(/[a-zà-ÿ]{4,}/g) || []).forEach(w => { if (!STOP.has(w)) f[w] = (f[w] || 0) + 1; });
  return Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]);
}
function sentences(turns) {
  const out = [];
  turns.forEach(t => (t.text.match(/[^.!?]+[.!?]*/g) || []).forEach(s => { s = s.trim(); if (s.length > 12) out.push({ s, i: t.i, spk: t.spk }); }));
  return out;
}

function heuristic(turns, wake) {
  const S = sentences(turns), names = new Set(turns.map(t => t.spk));
  const actions = [], decisions = [], questions = [];
  const seen = new Set();
  for (const x of S) {
    if (new RegExp('\\b' + wake + '\\b', 'i').test(x.s)) continue;
    if (ACT.test(x.s) && actions.length < 14) {
      let owner = 'Unassigned';
      const addr = x.s.match(new RegExp("^(" + NAME + "),?\\s+(?:can|could|will|would|please)", 'u'));
      if (/\b(i['’]ll|i will|let me|i can take|i['’]m going to|i am going to|i['’]ve got)\b/i.test(x.s)) owner = x.spk;
      else if (addr && [...names].some(n => n.split(' ')[0] === addr[1])) owner = [...names].find(n => n.split(' ')[0] === addr[1]);
      else if (/\bwe['’]ll|we will\b/i.test(x.s)) owner = 'Team';
      const due = (x.s.match(DUE) || [null])[0];
      const key = x.s.toLowerCase().slice(0, 50);
      if (!seen.has(key)) { seen.add(key); actions.push({ task: x.s.replace(/^(okay|ok|yeah|sure|so|and|great|thanks?)[,.]?\s+/i, ''), owner, due: due ? due.trim() : null, priority: 'medium', turn: x.i }); }
    }
    if (DEC.test(x.s) && decisions.length < 8) decisions.push({ text: x.s, turn: x.i });
    if (x.s.endsWith('?') && x.s.length > 35 && questions.length < 8) questions.push({ text: x.s, owner: x.spk, turn: x.i });
  }
  const k = Math.min(6, Math.max(1, Math.round(turns.length / 10)));
  const size = Math.ceil(turns.length / k), topics = [];
  for (let a = 0; a < turns.length; a += size) {
    const seg = turns.slice(a, a + size), kw = keywords(seg.map(t => t.text).join(' '), 3);
    topics.push({ title: kw.length ? kw.map(w => w[0].toUpperCase() + w.slice(1)).join(' · ') : 'Discussion', start: seg[0].i, summary: seg[0].text.slice(0, 140) + (seg[0].text.length > 140 ? '…' : '') });
  }
  const gk = new Set(keywords(turns.map(t => t.text).join(' '), 25));
  const ranked = S.map(x => ({ ...x, sc: (x.s.toLowerCase().match(/[a-zà-ÿ]{4,}/g) || []).filter(w => gk.has(w)).length / Math.sqrt(x.s.length) })).sort((a, b) => b.sc - a.sc).slice(0, 3).sort((a, b) => a.i - b.i);
  return {
    mode: 'heuristic',
    summary: ranked.map(x => x.s).join(' ') || 'No summary available.',
    topics, decisions, actions, questions, risks: [],
    commands: findCommands(turns, wake),
  };
}

/* "Claude, start a doc..." style requests addressed to the assistant */
function findCommands(turns, wake) {
  const re = new RegExp('(?:^|[\\s,.;!?])(?:hey |ok |okay )?' + wake + '[,:]?\\s+(.{6,})$', 'i');
  const out = [];
  turns.forEach(t => {
    for (const s of t.text.split(/(?<=[.!?])\s+/)) {
      const m = s.match(re);
      if (m && !/^(is|was|said|says|thinks)\b/i.test(m[1])) { out.push({ turn: t.i, speaker: t.spk, request: s.slice(s.toLowerCase().indexOf(wake.toLowerCase())).trim() }); break; }
    }
  });
  return out;
}


/* ---------- dates ---------- */
const pad2 = n => String(n).padStart(2, '0');
const isoOf = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const dateOf = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (iso, n) => { const d = dateOf(iso); d.setDate(d.getDate() + n); return isoOf(d); };
const diffDays = (a, b) => Math.round((dateOf(b) - dateOf(a)) / 864e5);
const DOWS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/* turn "by Friday", "next Wednesday", "end of the month", "March 18" into an ISO date relative to the meeting date */
function parseDue(text, base) {
  if (!text) return '';
  const s = String(text).toLowerCase();
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  const b = dateOf(base), dow = b.getDay();
  const friday = addDays(base, ((5 - dow) + 7) % 7);
  const eom = (k) => isoOf(new Date(b.getFullYear(), b.getMonth() + 1 + k, 0, 12));
  if (/\b(today|tonight|eod|end of (the )?day)\b/.test(s)) return base;
  if (/\btomorrow\b/.test(s)) return addDays(base, 1);
  for (let i = 0; i < 7; i++) if (new RegExp('\\b' + DOWS[i] + '\\b').test(s)) return addDays(base, ((i - dow) + 7) % 7 || 7);
  if (/\bnext week\b/.test(s)) return addDays(friday, 7);
  if (/\b(eow|end of (the )?week|this week)\b/.test(s)) return friday;
  if (/\bnext month\b/.test(s)) return eom(1);
  if (/\b(end of (the )?month|this month)\b/.test(s)) return eom(0);
  if (/\bnext quarter\b/.test(s)) return isoOf(new Date(b.getFullYear(), Math.floor(b.getMonth() / 3) * 3 + 6, 0, 12));
  if (/\bend of (the )?quarter\b/.test(s)) return isoOf(new Date(b.getFullYear(), Math.floor(b.getMonth() / 3) * 3 + 3, 0, 12));
  m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? (\d{1,2})\b/) ;
  let mm, dd;
  if (m) { mm = MONS.indexOf(m[1]); dd = +m[2]; }
  else if ((m = s.match(/\b(\d{1,2}) (?:of )?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/))) { mm = MONS.indexOf(m[2]); dd = +m[1]; }
  else if ((m = s.match(/\b(\d{1,2})[/.](\d{1,2})\b/))) { dd = +m[1]; mm = +m[2] - 1; if (mm > 11) { mm = +m[1] - 1; dd = +m[2]; } }
  if (mm != null && mm >= 0 && dd >= 1 && dd <= 31) {
    let d = new Date(b.getFullYear(), mm, dd, 12);
    if (diffDays(base, isoOf(d)) < -30) d = new Date(b.getFullYear() + 1, mm, dd, 12);
    return isoOf(d);
  }
  return '';
}

if (typeof module !== 'undefined') module.exports = { parseTranscript, heuristic, findCommands, redact, externalDomains, speakerStats, duration, fmtT, toSec, parseDue, addDays, diffDays, isoOf };
