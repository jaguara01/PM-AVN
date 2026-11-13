/* PM-AVN: state, storage, helpers, Claude calls */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = o => JSON.parse(JSON.stringify(o));
const today = () => isoOf(new Date());
const LS = 'northdesk.v1';
const STATUS = [['todo', 'To do'], ['doing', 'In progress'], ['review', 'In review'], ['done', 'Done']];
const STNAME = Object.fromEntries(STATUS);
const COLORS = ['#2E8B6A', '#3B63D9', '#8A4FB3', '#D9951A', '#C8503C', '#1E8A99', '#5B6B7A'];

let S = { v: 1, projects: [], tasks: [], prefs: { me: '' }, example: false };
let M = [];
let view = { route: 'home', id: null, tab: 'board', mtab: 'notes' };
let sampler = null, dl = null, cloud = null, storeState = 'local';
let busy = {}, toastT = null;
let draft = { text: '', title: '', domains: '', wake: 'Claude', redact: true, pid: '', date: '' };

/* ---------- storage: browser cache always, Claude account when available ---------- */
const dirty = { ws: false, m: new Set(), del: new Set() };
let saving = false, saveT = null, edited = false;
function localSave() { try { localStorage.setItem(LS, JSON.stringify({ S, M })); } catch (e) { } }
function persist(m) {
  if (!edited) M.forEach(x => dirty.m.add(x.id));
  edited = true; dirty.ws = true; if (m) dirty.m.add(m.id);
  localSave(); clearTimeout(saveT); saveT = setTimeout(flush, 900);
}
async function flush() {
  if (!cloud) return;
  if (saving) { saveT = setTimeout(flush, 600); return; }
  saving = true;
  try {
    if (dirty.ws) { dirty.ws = false; await cloud.ws.set({ state: clone(S), at: Date.now() }); }
    for (const id of [...dirty.del]) { dirty.del.delete(id); await cloud.ws.collection('meetings').doc(id).delete(); }
    for (const id of [...dirty.m]) {
      dirty.m.delete(id); const m = M.find(x => x.id === id); if (!m) continue;
      try { await cloud.ws.collection('meetings').doc(id).set(clone(m)); m.localOnly = false; }
      catch (e) { if (e && e.code === 'invalid_argument') { if (!m.localOnly) toast('“' + m.title + '” is too long to sync. It stays in this browser.'); m.localOnly = true; } else throw e; }
    }
    if (storeState !== 'cloud') { storeState = 'cloud'; render(); }
  } catch (e) {
    if (storeState !== 'error') { storeState = 'error'; toast(e && e.code === 'quota_exceeded' ? 'Storage is full. Delete old meetings to keep syncing.' : 'Could not save to your account. Changes stay in this browser.'); render(); }
  }
  saving = false;
  if (dirty.ws || dirty.m.size || dirty.del.size) { if (storeState !== 'error') saveT = setTimeout(flush, 900); }
}
function loadLocal() {
  try { const o = JSON.parse(localStorage.getItem(LS) || 'null'); if (o && o.S && Array.isArray(o.S.projects)) { S = o.S; M = o.M || []; return true; } } catch (e) { }
  return false;
}
async function connectCloud() {
  if (typeof claude === 'undefined') return;
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);
  try {
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
    const id = user ? await user.id() : null;
    if (!db || !id) return;
    const ws = db.collection('data/users/' + id).doc('workspace');
    const snap = await withTimeout(ws.get(), 10000);
    cloud = { ws };
    if (snap.exists && !edited) {
      const ms = await withTimeout(ws.collection('meetings').get(), 10000);
      const st = clone(snap.data()).state;
      if (st && Array.isArray(st.projects)) {
        const localOnly = M.filter(m => m.localOnly);
        S = st; M = ms.docs.map(d => clone(d.data())).concat(localOnly.filter(l => !ms.docs.some(d => d.id === l.id)));
        M.sort((a, b) => b.created - a.created); localSave();
      }
    } else if (!S.example || edited) { dirty.ws = true; M.forEach(m => dirty.m.add(m.id)); flush(); }
    storeState = 'cloud'; render();
  } catch (e) { }
}

/* ---------- small helpers ---------- */
function toast(msg) {
  const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); }
  catch (e) { toast('Copying is blocked here. Select the text and copy it.'); }
}
async function saveFile(name, data) {
  if (dl) { try { await dl.save({ filename: name, data }); return; } catch (e) { if (e && e.code === 'declined') return; } }
  await copy(data);
}
const fname = s => String(s).replace(/[^\w\- ]+/g, '').trim() || 'export';
const hue = n => { let x = 0; for (const c of String(n)) x = (x * 31 + c.charCodeAt(0)) % 360; return x; };
const initials = n => String(n).split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const av = (n, cls = '') => !n || n === 'Unassigned' ? `<span class="av none ${cls}" title="Unassigned"></span>` : `<span class="av ${cls}" style="--h:${hue(n)}" title="${h(n)}">${h(initials(n))}</span>`;
const fmtDay = iso => dateOf(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
function dueLabel(iso) {
  if (!iso) return '';
  const d = diffDays(today(), iso);
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : fmtDay(iso);
}
const isLate = t => t.status !== 'done' && t.due && t.due < today();
const project = id => S.projects.find(p => p.id === id);
const meeting = id => M.find(m => m.id === id);
const tasksOf = pid => S.tasks.filter(t => t.pid === pid).sort((a, b) => a.order - b.order);
const people = () => [...new Set([...S.tasks.map(t => t.owner), ...M.flatMap(m => m.speakers || [])].filter(x => x && !['Unassigned', 'Team', 'Speaker'].includes(x)))].sort();
const stIcon = s => `<svg class="st st-${s}" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${{
  todo: '<circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  doing: '<circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 3.6a4.4 4.4 0 0 1 0 8.8z" fill="currentColor"/>',
  review: '<circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 3.6a4.4 4.4 0 1 1-4.4 4.4H8z" fill="currentColor"/>',
  done: '<circle cx="8" cy="8" r="7" fill="currentColor"/><path d="m4.9 8.2 2.1 2.1 4.1-4.5" fill="none" stroke="var(--surface)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
}[s]}</svg>`;
const prIcon = p => { const n = { high: 3, medium: 2, low: 1 }[p] || 2; return `<svg class="pr" viewBox="0 0 14 12" width="14" height="12" role="img" aria-label="${p} priority"><title>${p} priority</title>${[0, 1, 2].map(i => `<rect x="${i * 5}" y="${8 - i * 4}" width="3" height="${4 + i * 4}" rx="1" fill="currentColor" opacity="${i < n ? 1 : .22}"/>`).join('')}</svg>`; };
const srcMark = `<svg class="src" viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M6 .8 11.2 6 6 11.2.8 6z" fill="currentColor"/></svg>`;
const ICON = {
  home: '<path d="M3.5 9 10 3.8 16.5 9v7h-4.3v-4.6H7.8V16H3.5z"/>', me: '<circle cx="10" cy="7" r="3.2"/><path d="M4 16.5c.7-3 3-4.4 6-4.4s5.3 1.4 6 4.4"/>',
  meet: '<rect x="3" y="4.5" width="14" height="9.5" rx="2"/><path d="M7 17h6M10 14v3"/>', plus: '<path d="M10 4.5v11M4.5 10h11"/>', x: '<path d="m5 5 10 10M15 5 5 15"/>',
  search: '<circle cx="9" cy="9" r="5"/><path d="m13 13 3.5 3.5"/>',
};
const ico = n => `<svg class="ico" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

/* ---------- tasks ---------- */
function newTask(o) {
  const t = { id: uid(), pid: o.pid, title: o.title || 'New task', status: o.status || 'todo', owner: o.owner || 'Unassigned', due: o.due || '', start: o.start || '', priority: o.priority || 'medium', notes: o.notes || '', mid: o.mid || null, turn: o.turn ?? null, created: today(), order: Date.now() + Math.random() };
  S.tasks.push(t); return t;
}
function deleteTask(id) {
  S.tasks = S.tasks.filter(t => t.id !== id);
  M.forEach(m => m.actions.forEach(a => { if (a.taskId === id) { a.taskId = null; dirty.m.add(m.id); } }));
}

/* ---------- markdown (small) ---------- */
function md(src) {
  const esc = h(src);
  const inline = s => s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>')
    .replace(/\[#(\d+)\]/g, '<a class="ref" data-act="jump" data-turn="$1">$1</a>');
  const L = esc.split('\n'); let out = '', i = 0, list = null;
  const close = () => { if (list) { out += `</${list}>`; list = null; } };
  while (i < L.length) {
    const l = L[i]; let m;
    if (/^\s*\|.*\|\s*$/.test(l) && L[i + 1] && /^\s*\|[\s:\-|]+\|\s*$/.test(L[i + 1])) {
      close(); const row = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim()));
      out += '<div class="tw"><table><thead><tr>' + row(l).map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>'; i += 2;
      while (i < L.length && /^\s*\|.*\|\s*$/.test(L[i])) { out += '<tr>' + row(L[i]).map(c => `<td>${c}</td>`).join('') + '</tr>'; i++; }
      out += '</tbody></table></div>'; continue;
    }
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) { close(); out += `<h${m[1].length + 2}>${inline(m[2])}</h${m[1].length + 2}>`; }
    else if ((m = l.match(/^\s*[-*]\s+(?:\[( |x)\]\s+)?(.*)/))) { if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; } out += `<li>${inline(m[2])}</li>`; }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; } out += `<li>${inline(m[1])}</li>`; }
    else if (/^\s*---+\s*$/.test(l)) { close(); out += '<hr>'; }
    else if (!l.trim()) close();
    else { close(); out += `<p>${inline(l)}</p>`; }
    i++;
  }
  close(); return out;
}

/* ---------- Claude: meeting analysis ---------- */
function ctxText(m, upto) {
  const turns = upto != null ? m.turns.filter(t => t.i <= upto) : m.turns;
  return turns.map(t => { const x = `[${t.i}] ${t.spk}${t.t != null ? ' (' + fmtT(t.t) + ')' : ''}: ${t.text}`; return m.redact ? redact(x) : x; }).join('\n');
}
function chunks(m, max = 45000) {
  const out = []; let c = '';
  for (const t of m.turns) { const x = ctxText({ ...m, turns: [t] }) + '\n'; if (c.length + x.length > max && c) { out.push(c); c = ''; } c += x; }
  if (c) out.push(c); return out;
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
function analysisPrompt(m, body, part) {
  return `You are the note-taker for a team meeting. Below is a transcript, one line per turn, formatted "[n] Speaker (m:ss): text".
${part ? 'This is one part of a longer transcript.\n' : ''}Return ONLY one JSON object, no prose, with exactly this shape:
${SCHEMA}
Rules: ground every item in the transcript and never invent facts, owners or dates. "turn" must be the [n] index where the item is best evidenced. Owners must be participant names exactly as written. Action items are commitments or explicit requests, not general discussion. Decisions are things the group agreed. "commands" are requests addressed to an assistant called "${m.wake}" (e.g. "${m.wake}, start a doc"). Use empty arrays when there is nothing. Write in the language of the transcript.

TRANSCRIPT:
${body}`;
}
function normalize(a, m, mode) {
  const n = m.turns.length, T = v => { v = parseInt(v); return isNaN(v) ? 0 : Math.max(0, Math.min(n - 1, v)); };
  const arr = x => Array.isArray(x) ? x : [];
  return {
    mode, title: a.title || '', summary: String(a.summary || ''),
    topics: arr(a.topics).map(t => ({ title: String(t.title || 'Topic'), start: T(t.start), summary: String(t.summary || '') })).sort((x, y) => x.start - y.start),
    decisions: arr(a.decisions).map(d => ({ text: String(d.text || d), turn: T(d.turn) })),
    actions: arr(a.actions).map(x => ({ task: String(x.task || ''), owner: x.owner || 'Unassigned', due: x.due && x.due !== 'null' ? String(x.due) : null, priority: ['high', 'medium', 'low'].includes(x.priority) ? x.priority : 'medium', turn: T(x.turn) })).filter(x => x.task),
    questions: arr(a.questions).map(q => ({ text: String(q.text || q), owner: q.owner || '', turn: T(q.turn) })),
    risks: arr(a.risks).map(r => ({ text: String(r.text || r), turn: T(r.turn) })),
    commands: arr(a.commands).map(c => ({ turn: T(c.turn), speaker: c.speaker || m.turns[T(c.turn)].spk, request: String(c.request || '') })).filter(c => c.request),
  };
}
async function runAI(m) {
  const parts = chunks(m); let res;
  if (parts.length === 1) res = await sampler.json(analysisPrompt(m, parts[0], false), { modelTier: 'default' });
  else {
    const partial = [];
    for (const p of parts) partial.push(await sampler.json(analysisPrompt(m, p, true), { modelTier: 'default' }));
    res = await sampler.json(`Merge these partial meeting analyses (JSON, from consecutive parts of one transcript) into ONE analysis with exactly this shape, deduplicating and keeping the original "turn" indices. Return ONLY JSON.\n${SCHEMA}\n\nPARTS:\n${JSON.stringify(partial)}`, { modelTier: 'default' });
  }
  return normalize(res, m, 'ai');
}
/* suggested actions already sent to a project are kept; the rest are replaced */
function applyAnalysis(m, a) {
  const kept = (m.actions || []).filter(x => x.taskId);
  m.analysis = { ...a, actions: undefined };
  m.actions = kept.concat(a.actions.filter(x => !kept.some(k => k.turn === x.turn)).map(x => ({ id: uid(), ...x, dueDate: parseDue(x.due, m.date), taskId: null })));
  if (a.title && !m.titleEdited) m.title = a.title;
  m.board = null;
}
function importMeeting(raw, o) {
  const { turns, format } = parseTranscript(raw);
  if (!turns.length) { toast('Paste or drop a transcript first.'); return null; }
  const m = { id: uid(), projectId: o.pid || '', title: o.title || 'Untitled meeting', titleEdited: !!o.title, date: o.date || today(), created: Date.now(), format, turns, wake: o.wake || 'Claude', redact: o.redact !== false, domains: o.domains || '', docs: [], chat: [], actions: [] };
  m.speakers = [...new Set(turns.map(t => t.spk))];
  m.external = externalDomains(turns, [], m.domains);
  applyAnalysis(m, heuristic(turns, m.wake));
  M.unshift(m); return m;
}
async function analyze(id) {
  const m = meeting(id); if (!m || !sampler || busy['an' + id]) return;
  busy['an' + id] = true; render();
  try { applyAnalysis(m, await runAI(m)); persist(m); toast('Notes updated'); }
  catch (e) { toast(e && e.code === 'not_granted' ? 'Claude was not allowed to read this meeting. The quick notes stay.' : 'Claude could not analyse this meeting. The quick notes stay.'); }
  busy['an' + id] = false; render();
}
function sendToBoard(m, a) {
  if (!m.projectId || !project(m.projectId)) { toast('Choose a project for this meeting first.'); return false; }
  const t = newTask({ pid: m.projectId, title: a.task, owner: a.owner === 'Team' ? 'Unassigned' : a.owner, due: a.dueDate || '', priority: a.priority, mid: m.id, turn: a.turn, notes: a.due && !a.dueDate ? 'Due as said in the meeting: ' + a.due : '' });
  a.taskId = t.id; return true;
}

/* ---------- document templates ---------- */
const MT = {
  minutes: ['Meeting minutes', 'Formal minutes: attendees, agenda items discussed, decisions, action items table (task, owner, due), open issues.'],
  email: ['Recap email', 'A concise recap email to all participants: 3-sentence summary, decisions, action items grouped by owner with due dates, and open questions. Include a subject line.'],
  plan: ['Plan with timeline', 'A project plan from what was discussed: goal, scope, workstreams with owners, a milestone table with dates (only dates stated or clearly implied; mark others TBD), risks, and open questions.'],
  budget: ['Numbers brief', 'Collect every figure, cost, estimate or target mentioned. Present a table (item, figure, who said it, turn ref), then call out inconsistencies, missing numbers and what must be confirmed.'],
  prd: ['Spec draft', 'A product requirements draft: problem, goals, non-goals, requirements, user stories, open questions, and next steps, derived strictly from the discussion.'],
  brief: ['Customer call brief', 'Who was involved, customer needs and pain points, objections, commitments we made, commitments they made, and recommended next steps.'],
  decisions: ['Decision log', 'For each decision give context, options considered, the decision, rationale, owner, and the turn where it was made.'],
  custom: ['Your own brief', ''],
};
const PT = {
  status: ['Status update', 'A status update for stakeholders: overall state in two sentences, what was finished, what is in progress, what is late and why it matters, decisions taken in recent meetings, and what happens next week.'],
  week: ['Plan for next week', 'A plan for the next seven days: per person, the tasks to focus on in priority order, with due dates, and anything blocking them.'],
  risks: ['Risk review', 'A risk review: late tasks, tasks with no owner or no date, overloaded people, risks and open questions raised in meetings. A table with risk, evidence, suggested mitigation and owner.'],
  mail: ['Stakeholder email', 'A short email to a sponsor who has two minutes: where the project stands, the one decision or help needed from them, and the next milestone. Include a subject line.'],
  custom: ['Your own brief', ''],
};
function projectContext(p) {
  const ts = tasksOf(p.id), ms = M.filter(m => m.projectId === p.id);
  return `PROJECT: ${p.name}\n${p.desc ? 'About: ' + p.desc + '\n' : ''}TODAY: ${today()}\n\nTASKS:\n${ts.map(t => `- [${STNAME[t.status]}] ${t.title} | owner: ${t.owner} | due: ${t.due || 'none'}${isLate(t) ? ' (LATE)' : ''} | ${t.priority}${t.mid && meeting(t.mid) ? ' | from meeting: ' + meeting(t.mid).title : ''}`).join('\n') || '(none)'}\n\nMEETINGS:\n${ms.map(m => `- ${m.title} (${m.date}): ${m.analysis.summary}\n  Decisions: ${m.analysis.decisions.map(d => d.text).join(' | ') || 'none'}\n  Open questions: ${m.analysis.questions.map(d => d.text).join(' | ') || 'none'}\n  Risks: ${m.analysis.risks.map(d => d.text).join(' | ') || 'none'}`).join('\n') || '(none)'}`;
}
async function generate(kind, key, extra) {
  if (!sampler || busy.gen) return;
  const isM = kind === 'm', owner = isM ? meeting(view.id) : project(view.id), [name, instr] = (isM ? MT : PT)[key];
  const body = isM
    ? `MEETING: ${owner.title} (${owner.date})\nACTION ITEMS:\n${owner.actions.map(a => `- ${a.task} | owner: ${a.owner} | due: ${a.dueDate || a.due || 'n/a'} [#${a.turn}]`).join('\n') || '(none)'}\n\nTRANSCRIPT:\n${ctxText(owner)}`
    : projectContext(owner);
  const prompt = `You write working documents for a project team. Produce: ${name}. ${instr}
${extra ? 'Extra instructions from the user: ' + extra : ''}
Rules: use Markdown (headings, lists, tables where useful). Use only the material below; do not invent facts, names, numbers or dates, and write "TBD" when something is unknown.${isM ? ' Cite transcript turns as [#n].' : ''} Reply with the document only.

${body}`;
  busy.gen = true; view.doc = ''; render();
  try {
    const r = await sampler(prompt, { modelTier: 'default', onText: ({ text }) => { view.doc = text; const o = $('#docout'); if (o) o.innerHTML = md(text); } });
    view.doc = r.text; view.docName = name; owner.docs = owner.docs || []; owner.docs.unshift({ id: uid(), name, text: r.text, at: Date.now() }); persist(isM ? owner : null);
  } catch (e) { toast('Claude could not write this document. Try again in a moment.'); }
  busy.gen = false; render();
}
async function ask(q) {
  const m = meeting(view.id); if (!sampler || !q.trim() || busy.ask) return;
  m.chat.push({ role: 'user', content: q }, { role: 'assistant', content: '' }); busy.ask = true; render();
  const others = view.scope === 'all' ? M.filter(x => x.id !== m.id && (!m.projectId || x.projectId === m.projectId)).map(x => `## ${x.title} (${x.date})\nSummary: ${x.analysis.summary}\nDecisions: ${x.analysis.decisions.map(d => d.text).join(' | ')}\nActions: ${x.actions.map(a => `${a.task} (${a.owner})`).join(' | ')}`).join('\n\n') : '';
  const sys = `You answer questions about meetings using ONLY the material below. Cite transcript turns of the CURRENT meeting as [#n]; for other meetings cite the meeting title. If the material does not contain the answer, say so. Be concise.\n\nCURRENT MEETING: ${m.title}\nTRANSCRIPT:\n${ctxText(m)}\n${others ? '\nOTHER MEETINGS (summaries only):\n' + others : ''}`;
  const hist = m.chat.slice(0, -2).map(x => ({ role: x.role, content: x.content }));
  const last = m.chat[m.chat.length - 1];
  try {
    const r = await sampler([{ role: 'user', content: sys }, { role: 'assistant', content: 'Ready.' }, ...hist, { role: 'user', content: q }], { modelTier: 'default', cache: false, onText: ({ text }) => { last.content = text; const el = $('#msgs .msg:last-child'); if (el) { el.innerHTML = md(text); $('#msgs').scrollTop = 1e9; } } });
    last.content = r.text;
  } catch (e) { last.content = 'Claude could not answer. Try again in a moment.'; }
  busy.ask = false; persist(m); render();
}
async function runCommand(k) {
  const m = meeting(view.id), c = m.analysis.commands[k]; if (!sampler || busy['c' + k]) return;
  busy['c' + k] = true; render();
  const prompt = `You were present in this meeting as an assistant called "${m.wake}". At turn ${c.turn}, ${c.speaker} asked you: "${c.request}"
Carry out the request using only the transcript so far (below). Produce the deliverable directly in Markdown (doc, timeline table, recap, answer, etc.), cite turns as [#n]. If the request needs data you do not have (e.g. files in a connected app), say exactly what you would need and give the best draft you can with placeholders marked TBD. Do not invent figures.

TRANSCRIPT SO FAR:
${ctxText(m, c.turn)}`;
  try { const r = await sampler(prompt, { modelTier: 'default', cache: false }); c.result = r.text; persist(m); }
  catch (e) { toast('Claude could not run this request. Try again in a moment.'); }
  busy['c' + k] = false; render();
}

/* ---------- example workspace ---------- */
function exampleWorkspace() {
  const t = today(), p1 = { id: 'summit', name: 'Customer summit', color: 0, desc: 'Two-day customer event at Harbor Hall on 18 and 19 March.', docs: [] }, p2 = { id: 'website', name: 'Website refresh', color: 1, desc: 'New pricing page and case studies before the summit invitations go out.', docs: [] };
  S = { v: 1, projects: [p1, p2], tasks: [], prefs: { me: 'Priya Nair' }, example: true }; M = [];
  const m = importMeeting(SAMPLE_TEXT, { pid: 'summit', title: 'Summit planning session', date: addDays(t, -2), domains: 'acme.com' });
  const tidy = ['Get quotes from two outside caterers', 'Send the revised budget to Dana in finance', 'Get the registration page live'];
  m.actions.filter(a => a.owner !== 'Unassigned').slice(0, 3).forEach((a, i) => { a.task = tidy[i]; sendToBoard(m, a); });
  const mk = (pid, title, status, owner, due, priority, start) => newTask({ pid, title, status, owner, due: due == null ? '' : addDays(t, due), start: addDays(t, start ?? -6), priority });
  mk('summit', 'Sign the Harbor Hall contract', 'review', 'Maya Chen', 2, 'high', -5);
  mk('summit', 'Shortlist keynote speakers', 'doing', 'Jordan Ellis', 6, 'medium', -3);
  mk('summit', 'Book hotel block for speakers', 'todo', 'Tom Becker', 12, 'medium', 1);
  mk('summit', 'Send save-the-date to customers', 'todo', 'Priya Nair', -1, 'high', -8);
  mk('summit', 'Tour the venue', 'done', 'Priya Nair', -6, 'medium', -12);
  mk('website', 'Rewrite the pricing page', 'doing', 'Jordan Ellis', 4, 'high', -4);
  mk('website', 'Collect three customer case studies', 'todo', 'Priya Nair', 9, 'medium', 0);
  mk('website', 'Fix the mobile navigation', 'review', 'Tom Becker', 1, 'low', -2);
  mk('website', 'Agree the new sitemap', 'done', 'Maya Chen', -3, 'medium', -10);
  const s = S.tasks.filter(x => x.mid); if (s[0]) s[0].status = 'doing';
}
