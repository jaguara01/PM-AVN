/* PM-AVN: views and events */
const ref = n => `<a class="ref" data-act="jump" data-turn="${n}" title="Open this line in the transcript">${n}</a>`;
const hashOf = v => ({ home: 'home', mywork: 'my-work', meetings: 'meetings', project: 'p-' + v.id, meeting: 'm-' + v.id })[v.route] || 'home';
function go(route, id, extra) {
  view = { route, id: id || null, tab: 'board', mtab: 'notes', ...extra };
  try { if (location.hash.slice(1) !== hashOf(view)) location.hash = hashOf(view); } catch (e) { }
  render(); const mn = $('.main'); if (mn) mn.scrollTop = 0;
}
function fromHash() {
  const x = location.hash.slice(1);
  if (!x || x === hashOf(view)) return;
  const base = { tab: 'board', mtab: 'notes' };
  if (x.startsWith('p-') && project(x.slice(2))) view = { route: 'project', id: x.slice(2), ...base };
  else if (x.startsWith('m-') && meeting(x.slice(2))) view = { route: 'meeting', id: x.slice(2), ...base };
  else if ({ home: 1, 'my-work': 1, meetings: 1 }[x]) view = { route: { home: 'home', 'my-work': 'mywork', meetings: 'meetings' }[x], ...base };
  else return;
  render();
}

function render() {
  const ae = document.activeElement, fid = ae && ae.id, ss = ae && ae.selectionStart, mn = $('.main'), top = mn ? mn.scrollTop : 0, key = view.route + view.id;
  if (view.route === 'project' && !project(view.id) || view.route === 'meeting' && !meeting(view.id)) view = { route: 'home', tab: 'board', mtab: 'notes' };
  if (S.prefs.theme) document.documentElement.dataset.theme = S.prefs.theme;
  $('#root').innerHTML = topbar() + `<main class="main" data-key="${h(key)}">${S.example ? `<div class="banner"><span>This is an example workspace so you can see how things fit together.</span><span class="grow"></span><button class="btn sm" data-act="keep-example">Keep it</button><button class="btn sm solid" data-act="clear-example">Start with an empty workspace</button></div>` : ''}${({ home: homeView, mywork: myWorkView, meetings: meetingsView, project: projectView, meeting: meetingView, search: searchView })[view.route]()}${footer()}</main>` + drawer();
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); try { el.setSelectionRange(ss, ss); } catch (e) { } } }
  const m2 = $('.main'); if (m2 && mn && mn.dataset.key === key) m2.scrollTop = top;
  $$('a[data-act], .trow, .tl-lab, .topics li').forEach(a => a.tabIndex = 0);
  bindWhiteboard(); const ms = $('#msgs'); if (ms) ms.scrollTop = 1e9;
}

const isDark = () => S.prefs.theme ? S.prefs.theme === 'dark' : (document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && !!window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches));
function topbar() {
  const on = r => view.route === r ? 'on' : '';
  const waiting = M.reduce((n, m) => n + m.actions.filter(a => !a.taskId).length, 0);
  const cur = view.route === 'project' && project(view.id);
  return `<header class="topbar">
  <a class="brand" data-act="go" data-r="home" aria-label="PM-AVN home"><img src="__LOGO__" alt="element61" width="104" height="42"><b>PM-AVN</b><span>Project management</span></a>
  <nav class="tnav" aria-label="Workspace">
   <a class="nav ${on('home')}" data-act="go" data-r="home">${ico('home')}<span>Home</span></a>
   <a class="nav ${on('mywork')}" data-act="go" data-r="mywork">${ico('me')}<span>My work</span></a>
   <details class="pmenu"><summary class="nav ${cur ? 'on' : ''}">${ico('folder')}<span>${cur ? h(cur.name) : 'Projects'}</span>${ico('down')}</summary>
    <div class="pmenu-list">${S.projects.map(p => `<a class="nav ${view.route === 'project' && view.id === p.id ? 'on' : ''}" data-act="go" data-r="project" data-id="${p.id}"><i class="pdot" style="background:${COLORS[p.color % COLORS.length]}"></i><span>${h(p.name)}</span><em class="quiet">${S.tasks.filter(t => t.pid === p.id && t.status !== 'done').length}</em></a>`).join('') || '<p class="quietp" style="padding:6px 13px">No projects yet.</p>'}<hr><a class="nav" data-act="new-project">${ico('plus')}<span>New project</span></a></div></details>
   <a class="nav ${on('meetings')} ${view.route === 'meeting' ? 'on' : ''}" data-act="go" data-r="meetings">${ico('meet')}<span>Meetings</span>${waiting ? `<em title="Action items waiting for review">${waiting}</em>` : ''}</a>
  </nav>
  <div class="tright"><label class="find">${ico('search')}<input id="search" type="search" placeholder="Search tasks and meetings" value="${h(view.q || '')}" aria-label="Search"></label>
  <button class="iconbtn" data-act="theme" aria-label="${isDark() ? 'Switch to light mode' : 'Switch to dark mode'}" title="${isDark() ? 'Light mode' : 'Dark mode'}">${ico(isDark() ? 'sun' : 'moon')}</button>
  <button class="btn solid pillbtn" data-act="go" data-r="meetings">${ico('plus')}New meeting</button></div>
 </header>`;
}
const footer = () => `<footer class="foot"><span><i class="led ${storeState === 'cloud' ? 'ok' : storeState === 'error' ? 'bad' : ''}"></i>${storeState === 'cloud' ? 'Saved to your Claude account' : storeState === 'error' ? 'Not syncing, saved in this browser' : 'Saved in this browser'}</span>
  <span><i class="led ${sampler ? 'ok' : ''}"></i>${sampler ? 'Claude is available' : 'Claude is not available here'}</span><span class="grow"></span>
  <a data-act="backup">Download backup</a><label>Restore<input type="file" id="restore" accept=".json" hidden></label></footer>`;

/* ---------- shared pieces ---------- */
const taskRow = (t, o = {}) => `<div class="trow ${t.status === 'done' ? 'is-done' : ''}" data-act="open-task" data-id="${t.id}">
  <button class="stbtn" data-act="cycle" data-id="${t.id}" title="${STNAME[t.status]}. Click to move forward." aria-label="${STNAME[t.status]}">${stIcon(t.status)}</button>
  <span class="tt">${h(t.title)}${t.mid ? `<span class="srcwrap" title="From a meeting">${srcMark}</span>` : ''}</span>
  ${o.project ? `<span class="tp"><i class="pdot" style="background:${COLORS[(project(t.pid) || { color: 6 }).color % COLORS.length]}"></i>${h((project(t.pid) || { name: '' }).name)}</span>` : ''}
  ${prIcon(t.priority)}<span class="td ${isLate(t) ? 'late' : ''}">${h(dueLabel(t.due))}</span>${av(t.owner, 'sm')}</div>`;
const empty = (title, body, btn) => `<div class="empty"><b>${title}</b><p>${body}</p>${btn || ''}</div>`;

/* ---------- home ---------- */
const FLOW = [['Plan', 'Projects, owners and dates on one board, so everyone sees what is next.'], ['Meet', 'Drop in a transcript from any tool. Notes, decisions and action items come out.'], ['Deliver', 'Move tasks to done on the board and timeline, and keep dates honest.'], ['Report', 'Write status updates and next-week plans from the tasks and meeting notes.']];
const srow = (attrs, icon, label, meta = '', extra = '', cls = '') => `<a class="srow ${cls}" ${attrs}>${ico(icon)}<span class="sl">${label}</span>${extra}${meta}${ico('arrow').replace('class="ico"', 'class="ico go"')}</a>`;
const scard = (n, title, rows) => `<section class="scard c${n}"><h2><span class="num">${n}</span><span>${title}</span></h2>${rows}</section>`;
function homeView() {
  const t0 = today(), open = S.tasks.filter(t => t.status !== 'done'), late = open.filter(isLate), week = open.filter(t => t.due >= t0 && t.due <= addDays(t0, 6));
  const days = [...Array(7)].map((_, i) => addDays(t0, i));
  const waitingM = M.filter(m => m.actions.some(a => !a.taskId)), waitingN = M.reduce((n, m) => n + m.actions.filter(a => !a.taskId).length, 0);
  const hr = new Date().getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const first = S.prefs.me ? ', ' + h(S.prefs.me.split(' ')[0]) : '';
  const plan = S.projects.map(p => { const ts = tasksOf(p.id), nl = ts.filter(isLate).length; return srow(`data-act="go" data-r="project" data-id="${p.id}"`, 'folder', h(p.name), `<span class="sm">${ts.filter(t => t.status === 'done').length} of ${ts.length} done</span>`, nl ? `<span class="tag t3">${nl} late</span>` : ''); }).join('') + srow('data-act="new-project"', 'plus', 'Start a new project', '', '', 'add');
  const meet = M.slice(0, 5).map(m => { const w = m.actions.filter(a => !a.taskId).length; return srow(`data-act="go" data-r="meeting" data-id="${m.id}" ${w ? 'data-mtab="actions"' : ''}`, 'meet', h(m.title), `<span class="sm">${fmtDay(m.date)}</span>`, w ? `<span class="tag t2">${w} to review</span>` : ''); }).join('') + srow('data-act="go" data-r="meetings"', 'doc', 'Import a transcript from Teams, Zoom or Meet', '', '', 'add');
  const due = [...late.sort((a, b) => a.due < b.due ? -1 : 1), ...week.filter(t => !isLate(t)).sort((a, b) => a.due < b.due ? -1 : 1)].slice(0, 6);
  const deliver = due.map(t => srow(`data-act="open-task" data-id="${t.id}"`, 'clock', h(t.title), `<span class="sm ${isLate(t) ? 'late' : ''}">${h(dueLabel(t.due))}</span>`, av(t.owner, 'sm'))).join('') || '<p class="quietp" style="padding:8px">Nothing is due this week.</p>';
  const report = S.projects.slice(0, 4).map(p => srow(`data-act="go" data-r="project" data-id="${p.id}" data-tab="docs" data-tpl="status"`, 'doc', 'Status update for ' + h(p.name), '<span class="sm">Write with Claude</span>')).join('') + srow('data-act="go" data-r="mywork"', 'me', 'See everything assigned to me', '', '', 'add');
  return `<section class="hero"><h1>${greet}${first}: here is your week across every project</h1>
   <p class="welcome">Welcome to PM-AVN, the element61 project workspace.</p>
   <p class="intro">${week.length} ${week.length === 1 ? 'task is' : 'tasks are'} due in the next seven days${late.length ? `, and <b class="late">${late.length} ${late.length === 1 ? 'is' : 'are'} late</b>` : ''}.${waitingN ? ` ${waitingN} action ${waitingN === 1 ? 'item from a meeting is' : 'items from meetings are'} waiting for your review.` : ''}</p></section>
  <section><p class="eyebrow">Your project flow</p><div class="steps">${FLOW.map(([t, d], i) => `<div class="step c${i + 1}"><span class="num">${i + 1}</span><b>${t}</b><span class="sd">${d}</span></div>`).join('')}</div></section>
  <section><p class="eyebrow">Next seven days</p><div class="week" aria-label="Next seven days">${days.map((d, i) => { const ts = week.filter(t => t.due === d); const wd = dateOf(d); return `<div class="day ${i === 0 ? 'now' : ''} ${[0, 6].includes(wd.getDay()) ? 'wkd' : ''}"><div class="dh"><span>${i === 0 ? 'Today' : wd.toLocaleDateString('en-GB', { weekday: 'short' })}</span><b>${wd.getDate()}</b></div>
    ${ts.map(t => `<button class="chip" data-act="open-task" data-id="${t.id}" style="--c:${COLORS[(project(t.pid) || { color: 6 }).color % COLORS.length]}"><span>${h(t.title)}</span>${av(t.owner, 'xs')}</button>`).join('')}</div>`; }).join('')}</div></section>
  <div class="stepcards">${scard(1, 'Plan: your projects', plan)}${scard(2, 'Meet: recent meetings', meet)}${scard(3, 'Deliver: late and due this week', deliver)}${scard(4, 'Report: keep people informed', report)}</div>
  ${waitingM.length ? `<aside class="tip">${ico('bulb')}<span>${waitingN} action ${waitingN === 1 ? 'item' : 'items'} from <b>${h(waitingM[0].title)}</b>${waitingM.length > 1 ? ` and ${waitingM.length - 1} other ${waitingM.length === 2 ? 'meeting' : 'meetings'}` : ''} ${waitingN === 1 ? 'is' : 'are'} waiting to go on a board.</span><button class="btn sm solid" data-act="go" data-r="meeting" data-id="${waitingM[0].id}" data-mtab="actions">Review</button></aside>` : ''}`;
}
const meetingRow = m => { const w = m.actions.filter(a => !a.taskId).length, p = project(m.projectId); return `<a class="mrow" data-act="go" data-r="meeting" data-id="${m.id}"><div class="pn"><b>${h(m.title)}</b><span>${fmtDay(m.date)}${p ? ', ' + h(p.name) : ''}</span></div>${w ? `<span class="pill sig">${w} to review</span>` : `<span class="pill">${m.actions.length} on the board</span>`}</a>`; };

/* ---------- my work ---------- */
function myWorkView() {
  const me = S.prefs.me, t0 = today(), mine = S.tasks.filter(t => t.owner === me && t.status !== 'done');
  const g = [['Late', mine.filter(isLate)], ['Next seven days', mine.filter(t => t.due >= t0 && t.due <= addDays(t0, 6))], ['Later', mine.filter(t => t.due > addDays(t0, 6))], ['No date', mine.filter(t => !t.due)]];
  return `<header class="top"><div><h1>My work</h1><p class="sub">Open tasks assigned to one person, across every project.</p></div>
   <label class="inl">Show tasks for<select id="me">${['', ...people()].map(p => `<option value="${h(p)}" ${p === me ? 'selected' : ''}>${h(p || 'Choose a person')}</option>`).join('')}</select></label></header>
  ${!me ? empty('Choose who you are', 'Pick your name above and this page lists what is on your plate.') : mine.length ? g.filter(x => x[1].length).map(([n, ts]) => `<h2>${n} <span class="count">${ts.length}</span></h2><div class="rows">${ts.sort((a, b) => (a.due || '9') < (b.due || '9') ? -1 : 1).map(t => taskRow(t, { project: 1 })).join('')}</div>`).join('') : empty('Nothing open', h(me) + ' has no open tasks.')}`;
}

/* ---------- meetings list + import ---------- */
function importForm() {
  return `<section class="panel"><h2>Import a transcript</h2>
   <div class="drop" id="drop">Drop a .txt, .vtt, .srt, .json or .md file here, or <label class="lk">choose a file<input type="file" id="file" accept=".txt,.vtt,.srt,.json,.md,text/*" hidden></label></div>
   <textarea id="paste" rows="7" placeholder="Or paste the transcript. Zoom, Teams, Google Meet, Otter, Fireflies, WebVTT, SRT, JSON and plain text all work." aria-label="Transcript">${h(draft.text)}</textarea>
   <div class="fgrid">
    <label class="f">Title<input id="d-title" value="${h(draft.title)}" placeholder="Named for you if left empty"></label>
    <label class="f">Project<select id="d-pid"><option value="">No project</option>${S.projects.map(p => `<option value="${p.id}" ${draft.pid === p.id ? 'selected' : ''}>${h(p.name)}</option>`).join('')}</select></label>
    <label class="f">Meeting date<input type="date" id="d-date" value="${h(draft.date || today())}"></label>
    <label class="f">Your email domains<input id="d-domains" value="${h(draft.domains)}" placeholder="acme.com"></label>
   </div>
   <label class="chk"><input type="checkbox" id="d-redact" ${draft.redact ? 'checked' : ''}>Hide email addresses and phone numbers from Claude</label>
   <div class="bar"><button class="btn solid" data-act="import">Create meeting notes</button><button class="btn" data-act="sample">Load a sample transcript</button></div></section>`;
}
function meetingsView() {
  return `<header class="top"><div><h1>Meetings</h1><p class="sub">Turn a transcript into notes, decisions and action items, then send the action items to a project board.</p></div></header>
  <div class="cols wide">${importForm()}<section><h2>All meetings <span class="count">${M.length}</span></h2>${M.length ? `<div class="rows">${M.map(meetingRow).join('')}</div>` : '<p class="quietp">Imported meetings are listed here.</p>'}</section></div>`;
}

/* ---------- project ---------- */
const PTABS = [['board', 'Board'], ['list', 'List'], ['timeline', 'Timeline'], ['meetings', 'Meetings'], ['docs', 'Documents']];
function projectView() {
  const p = project(view.id), all = tasksOf(p.id), f = view.owner || '', ts = f ? all.filter(t => t.owner === f) : all;
  const owners = [...new Set(all.map(t => t.owner))].sort();
  return `<header class="top"><div class="grow"><div class="ptitle"><i class="pdot lg" style="background:${COLORS[p.color % COLORS.length]}"></i><input class="h1in" id="p-name" value="${h(p.name)}" aria-label="Project name"></div>
   <input class="subin" id="p-desc" value="${h(p.desc || '')}" placeholder="Add a one-line description" aria-label="Project description"></div>
   <div class="bar"><label class="inl">Owner<select id="f-owner"><option value="">Everyone</option>${owners.map(o => `<option ${o === f ? 'selected' : ''}>${h(o)}</option>`).join('')}</select></label>
   <button class="btn solid" data-act="new-task">${ico('plus')}New task</button><button class="btn quiet" data-act="del-project">Delete</button></div></header>
  <div class="tabs" role="tablist">${PTABS.map(([k, l]) => `<button role="tab" aria-selected="${view.tab === k}" class="${view.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${l}</button>`).join('')}</div>
  ${({ board: boardV, list: listV, timeline: timelineV, meetings: pMeetingsV, docs: () => docPanel('p') })[view.tab](p, ts)}`;
}
function boardV(p, ts) {
  return `<div class="board">${STATUS.map(([k, l]) => { const c = ts.filter(t => t.status === k); return `<section class="lane" data-lane="${k}"><h3>${stIcon(k)}<span>${l}</span><span class="count">${c.length}</span></h3>
   <div class="cards">${c.map(t => `<article class="card" draggable="true" data-act="open-task" data-id="${t.id}" tabindex="0"><p>${h(t.title)}</p><div class="cmeta">${t.mid ? `<span class="srcwrap" title="From a meeting">${srcMark}</span>` : ''}${prIcon(t.priority)}<span class="td ${isLate(t) ? 'late' : ''}">${h(dueLabel(t.due))}</span><span class="grow"></span>${av(t.owner, 'sm')}</div></article>`).join('')}</div>
   <input class="qa" id="qa-${k}" data-status="${k}" placeholder="Add a task" aria-label="Add a task to ${l}"></section>`; }).join('')}</div>`;
}
function listV(p, ts) {
  const s = view.sort || { k: 'order', d: 1 }, key = t => s.k === 'status' ? STATUS.findIndex(x => x[0] === t.status) : s.k === 'priority' ? ['high', 'medium', 'low'].indexOf(t.priority) : s.k === 'due' ? (t.due || '9999') : (t[s.k] ?? '');
  const rows = [...ts].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * s.d);
  const th = (k, l) => `<th><button data-act="sort" data-k="${k}" class="${s.k === k ? 'on' : ''}">${l}${s.k === k ? (s.d > 0 ? ' ↑' : ' ↓') : ''}</button></th>`;
  if (!rows.length) return empty('No tasks here yet', 'Add the first task, or send action items over from a meeting.', '<button class="btn solid" data-act="new-task">New task</button>');
  return `<div class="tw"><table class="list"><thead><tr>${th('status', 'Status')}${th('title', 'Task')}${th('owner', 'Owner')}${th('due', 'Due')}${th('priority', 'Priority')}<th>Source</th></tr></thead><tbody>
  ${rows.map(t => `<tr class="${t.status === 'done' ? 'is-done' : ''}"><td><select id="l-${t.id}-status" data-task="${t.id}" data-field="status" aria-label="Status">${STATUS.map(([k, l]) => `<option value="${k}" ${t.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
   <td class="ltitle"><a data-act="open-task" data-id="${t.id}">${h(t.title)}</a></td>
   <td><input id="l-${t.id}-owner" data-task="${t.id}" data-field="owner" list="people" value="${h(t.owner)}" aria-label="Owner"></td>
   <td><input type="date" id="l-${t.id}-due" class="${isLate(t) ? 'late' : ''}" data-task="${t.id}" data-field="due" value="${h(t.due)}" aria-label="Due date"></td>
   <td><select id="l-${t.id}-priority" data-task="${t.id}" data-field="priority" aria-label="Priority">${['high', 'medium', 'low'].map(x => `<option ${t.priority === x ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
   <td>${t.mid && meeting(t.mid) ? `<a class="srclink" data-act="go" data-r="meeting" data-id="${t.mid}" data-mtab="actions">${srcMark}${h(meeting(t.mid).title)}</a>` : ''}</td></tr>`).join('')}</tbody></table></div>${peopleList()}`;
}
const peopleList = () => `<datalist id="people">${people().map(p => `<option>${h(p)}</option>`).join('')}<option>Unassigned</option></datalist>`;
function timelineV(p, ts) {
  const dated = ts.filter(t => t.due), t0 = today(), W = 28;
  if (!dated.length) return empty('Nothing to place on a timeline', 'Tasks appear here once they have a due date.');
  const st = t => { const s = t.start || t.created || t.due; return s > t.due ? t.due : s; };
  let a = dated.reduce((m, t) => st(t) < m ? st(t) : m, addDays(t0, -3)), b = dated.reduce((m, t) => t.due > m ? t.due : m, addDays(t0, 21));
  if (diffDays(a, t0) > 28) a = addDays(t0, -28);
  b = addDays(b, 4); if (diffDays(a, b) > 150) b = addDays(a, 150);
  const n = diffDays(a, b) + 1, days = [...Array(n)].map((_, i) => addDays(a, i)), x = d => Math.max(0, Math.min(n - 1, diffDays(a, d)));
  const rows = dated.sort((p1, p2) => st(p1) < st(p2) ? -1 : st(p1) > st(p2) ? 1 : p1.due < p2.due ? -1 : 1);
  const undated = ts.length - dated.length;
  return `<div class="tl" style="--w:${W}px;--n:${n}"><div class="tl-in">
   <div class="tl-head"><div class="tl-lab"></div><div class="tl-days">${days.map(d => { const dt = dateOf(d), first = dt.getDate() === 1 || d === a; return `<span class="${[0, 6].includes(dt.getDay()) ? 'wkd' : ''} ${d === t0 ? 'now' : ''}">${first ? `<b>${dt.toLocaleDateString('en-GB', { month: 'short' })}</b>` : ''}${dt.getDate()}</span>`; }).join('')}</div></div>
   ${rows.map(t => `<div class="tl-row"><div class="tl-lab" data-act="open-task" data-id="${t.id}">${stIcon(t.status)}<span>${h(t.title)}</span></div><div class="tl-track"><button class="tl-bar s-${t.status} ${isLate(t) ? 'late' : ''}" data-act="open-task" data-id="${t.id}" style="left:${x(st(t)) * W}px;width:${(x(t.due) - x(st(t)) + 1) * W - 4}px" title="${h(t.title)}, due ${h(fmtDay(t.due))}">${av(t.owner, 'xs')}<span>${h(t.owner === 'Unassigned' ? '' : t.owner.split(' ')[0])}</span></button></div></div>`).join('')}
   <i class="tl-now" style="left:calc(var(--lab) + ${x(t0) * W + W / 2}px)"></i></div></div>
   ${undated ? `<p class="quietp">${undated} ${undated === 1 ? 'task has' : 'tasks have'} no due date and ${undated === 1 ? 'is' : 'are'} not shown.</p>` : ''}`;
}
function pMeetingsV(p) {
  const ms = M.filter(m => m.projectId === p.id);
  return `<div class="cols wide"><section><h2>Meetings in this project <span class="count">${ms.length}</span></h2>${ms.length ? `<div class="rows">${ms.map(meetingRow).join('')}</div>` : '<p class="quietp">No meetings yet. Import a transcript and its action items can go straight to this board.</p>'}</section>${(draft.pid = p.id, importForm())}</div>`;
}

/* ---------- documents (project and meeting) ---------- */
function docPanel(kind) {
  const T = kind === 'm' ? MT : PT, o = kind === 'm' ? meeting(view.id) : project(view.id), sel = T[view.tpl] ? view.tpl : Object.keys(T)[0], docs = o.docs || [];
  return `<div class="cols docs"><section class="panel"><h2>Write a document</h2>
   <div class="tpls" role="radiogroup" aria-label="Document type">${Object.entries(T).map(([k, v]) => `<button role="radio" aria-checked="${sel === k}" class="${sel === k ? 'on' : ''}" data-act="tpl" data-k="${k}">${v[0]}</button>`).join('')}</div>
   <label class="f">${sel === 'custom' ? 'Describe the document' : 'Anything to add? Audience, tone, language'}<textarea id="tpl-extra" rows="3">${h(view.extra || '')}</textarea></label>
   <div class="bar"><button class="btn solid" data-act="generate" data-kind="${kind}" data-k="${sel}" ${!sampler || busy.gen ? 'disabled' : ''}>${busy.gen ? '<i class="spin"></i>Writing' : 'Write with Claude'}</button>${!sampler ? '<span class="hint">Open this page in Claude to write documents.</span>' : ''}</div>
   ${docs.length ? `<h2>Saved</h2><div class="rows">${docs.map(d => `<a class="mrow" data-act="open-doc" data-did="${d.id}"><div class="pn"><b>${h(d.name)}</b><span>${new Date(d.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${new Date(d.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></div></a>`).join('')}</div>` : ''}</section>
  <section class="paper"><div class="bar end">${view.doc ? `<button class="btn sm" data-act="copy-doc">Copy</button><button class="btn sm" data-act="dl-doc">Download</button>` : ''}</div>
   <div class="doc" id="docout">${view.doc ? md(view.doc) : `<p class="quietp">${kind === 'm' ? 'The document is written from this meeting. Numbers in boxes link back to the transcript line they came from.' : 'The document is written from this project’s tasks, dates and meeting notes.'}</p>`}</div></section></div>`;
}

/* ---------- meeting ---------- */
const MTABS = [['notes', 'Notes'], ['actions', 'Action items'], ['whiteboard', 'Whiteboard'], ['build', 'Documents'], ['ask', 'Ask'], ['transcript', 'Transcript']];
function meetingView() {
  const m = meeting(view.id), a = m.analysis, dur = duration(m.turns), w = m.actions.filter(x => !x.taskId).length;
  return `<header class="top"><div class="grow"><input class="h1in" id="m-title" value="${h(m.title)}" aria-label="Meeting title">
   <p class="sub">${m.speakers.length} speakers, ${m.turns.length} turns${dur ? ', ' + fmtT(dur) + ' long' : ''}. ${a.mode === 'ai' ? 'Notes written by Claude.' : 'Quick notes from keywords. ' + (sampler ? 'Ask Claude for better ones.' : '')}${m.external && m.external.length ? ` <span class="pill warn">Outside guests: ${h(m.external.join(', '))}</span>` : ''}</p></div>
   <div class="bar"><label class="inl">Project<select id="m-pid"><option value="">No project</option>${S.projects.map(p => `<option value="${p.id}" ${m.projectId === p.id ? 'selected' : ''}>${h(p.name)}</option>`).join('')}</select></label>
   <label class="inl">Date<input type="date" id="m-date" value="${h(m.date)}"></label>
   ${sampler ? `<button class="btn ${a.mode === 'ai' ? '' : 'solid'}" data-act="analyze" ${busy['an' + m.id] ? 'disabled' : ''}>${busy['an' + m.id] ? '<i class="spin"></i>Reading' : a.mode === 'ai' ? 'Rewrite notes' : 'Write notes with Claude'}</button>` : ''}<button class="btn quiet" data-act="del-meeting">Delete</button></div></header>
  <div class="tabs" role="tablist">${MTABS.map(([k, l]) => `<button role="tab" aria-selected="${view.mtab === k}" class="${view.mtab === k ? 'on' : ''}" data-act="mtab" data-tab="${k}">${l}${k === 'actions' && w ? `<em>${w}</em>` : ''}</button>`).join('')}</div>
  ${({ notes: notesV, actions: actionsV, whiteboard: whiteboardV, build: () => docPanel('m'), ask: askV, transcript: transcriptV })[view.mtab](m)}`;
}
function notesV(m) {
  const a = m.analysis, spk = speakerStats(m.turns), li = (xs, none) => xs.length ? `<ul class="pts">${xs.map(d => `<li>${h(d.text)} ${ref(d.turn)}</li>`).join('')}</ul>` : `<p class="quietp">${none}</p>`;
  return `<div class="cols notes"><section><h2>Summary</h2><p class="lead">${h(a.summary)}</p>
   <h2>Decisions</h2>${li(a.decisions, 'No decisions found.')}
   <h2>Open questions</h2>${li(a.questions, 'No open questions found.')}
   <h2>Risks</h2>${li(a.risks, a.mode === 'ai' ? 'No risks raised.' : 'Risks are picked up when Claude writes the notes.')}</section>
  <section><h2>What was discussed</h2><ol class="topics">${a.topics.map(t => `<li data-act="jump" data-turn="${t.start}"><b>${h(t.title)}</b><span class="when">${m.turns[t.start] && m.turns[t.start].t != null ? fmtT(m.turns[t.start].t) : ''}</span><p>${h(t.summary)}</p></li>`).join('')}</ol>
   <h2>Who spoke</h2>${spk.map(s => `<div class="talk">${av(s.name, 'sm')}<span>${h(s.name)}</span><div class="meter"><i style="width:${s.pct}%"></i></div><b>${s.pct}%</b></div>`).join('')}
   <h2>Privacy</h2><label class="chk"><input type="checkbox" id="m-redact" ${m.redact ? 'checked' : ''}>Hide email addresses and phone numbers from Claude</label>
   <div class="bar"><button class="btn sm" data-act="exp-md">Download notes</button><button class="btn sm" data-act="copy-notes">Copy notes</button></div></section></div>`;
}
function actionsV(m) {
  const p = project(m.projectId), w = m.actions.filter(a => !a.taskId);
  return `<div class="bar between"><p class="sub">${p ? `Review what was promised, then send it to the <b>${h(p.name)}</b> board.` : 'Choose a project above to send these to its board.'}</p>${w.length ? `<button class="btn solid" data-act="send-all" ${p ? '' : 'disabled'}>Send all ${w.length} to the board</button>` : ''}</div>
  ${m.actions.length ? `<div class="acts">${m.actions.map(a => { const t = a.taskId && S.tasks.find(x => x.id === a.taskId); return `<div class="act ${t ? 'sent' : ''}" data-ma="${a.id}">
    <textarea id="a-${a.id}-task" data-field="task" rows="2" aria-label="Task" ${t ? 'readonly' : ''}>${h(t ? t.title : a.task)}</textarea>
    <div class="afields"><label class="f">Owner<input id="a-${a.id}-owner" data-field="owner" list="people" value="${h(t ? t.owner : a.owner)}" ${t ? 'readonly' : ''}></label>
    <label class="f"><span>Due${a.due && !t ? `<i class="said">said ${h(a.due)}</i>` : ''}</span><input type="date" id="a-${a.id}-due" data-field="dueDate" value="${h(t ? t.due : a.dueDate || '')}" ${t ? 'readonly' : ''}></label>
    <label class="f">Priority<select id="a-${a.id}-pr" data-field="priority" ${t ? 'disabled' : ''}>${['high', 'medium', 'low'].map(x => `<option ${(t ? t.priority : a.priority) === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
    <div class="aside">${ref(a.turn)}${t ? `<button class="btn sm" data-act="open-task" data-id="${t.id}">${stIcon(t.status)}${STNAME[t.status]}</button>` : `<button class="btn sm solid" data-act="send-one" ${p ? '' : 'disabled'}>Send to board</button><button class="iconbtn" data-act="drop-action" title="Dismiss" aria-label="Dismiss">${ico('x')}</button>`}</div></div>`; }).join('')}</div>` : empty('No action items found', 'Nothing in this transcript read like a commitment.')}
  <div class="bar"><button class="btn" data-act="add-action">Add an action item</button></div>${peopleList()}`;
}
function layoutBoard(m) {
  const a = m.analysis, topics = a.topics.length ? a.topics : [{ title: 'Meeting', start: 0, summary: '' }], items = [];
  const push = (kind, o) => items.push({ id: kind + items.length, kind, text: o.text || o.task, turn: o.turn, owner: o.owner });
  a.decisions.forEach(o => push('decision', o)); m.actions.forEach(o => push('action', o)); a.questions.forEach(o => push('question', o)); a.risks.forEach(o => push('risk', o));
  const nodes = [], W = 236;
  topics.forEach((t, c) => {
    const end = topics[c + 1] ? topics[c + 1].start : 1e9, lo = c === 0 ? -1 : t.start;
    nodes.push({ id: 'topic' + c, kind: 'topic', text: t.title, turn: t.start, x: 28 + c * (W + 28), y: 28 });
    items.filter(it => it.turn >= lo && it.turn < end).forEach((it, r) => nodes.push({ ...it, x: 28 + c * (W + 28), y: 112 + r * 118 }));
  });
  return nodes;
}
function whiteboardV(m) {
  if (!m.board) m.board = layoutBoard(m);
  const mx = Math.max(900, ...m.board.map(n => n.x + 270)), my = Math.max(480, ...m.board.map(n => n.y + 140));
  return `<div class="bar between"><p class="legend"><i class="k-decision"></i>Decision<i class="k-action"></i>Action<i class="k-question"></i>Question<i class="k-risk"></i>Risk</p><div class="bar"><button class="btn sm" data-act="add-sticky">Add a note</button><button class="btn sm" data-act="reset-wb">Reset layout</button></div></div>
  <div class="wbwrap"><div class="wb" id="wb" style="width:${mx}px;height:${my}px">${m.board.map(n => `<div class="sticky k-${n.kind}" data-nid="${n.id}" style="left:${n.x}px;top:${n.y}px"><div class="nt" ${n.kind === 'sticky' ? 'contenteditable="true"' : ''}>${h(n.text)}</div>${n.owner && n.kind === 'action' ? `<div class="no">${h(n.owner)}</div>` : ''}</div>`).join('')}</div></div>`;
}
function bindWhiteboard() {
  const wb = $('#wb'), m = wb && meeting(view.id); if (!m) return;
  let d = null;
  wb.addEventListener('pointerdown', e => { const el = e.target.closest('.sticky'); if (!el || e.target.closest('[contenteditable]')) return; const n = m.board.find(x => x.id === el.dataset.nid); d = { el, n, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y }; el.setPointerCapture(e.pointerId); el.classList.add('drag'); });
  wb.addEventListener('pointermove', e => { if (!d) return; d.n.x = Math.max(0, d.ox + e.clientX - d.sx); d.n.y = Math.max(0, d.oy + e.clientY - d.sy); d.el.style.left = d.n.x + 'px'; d.el.style.top = d.n.y + 'px'; });
  const end = () => { if (d) { d.el.classList.remove('drag'); d = null; persist(m); } };
  wb.addEventListener('pointerup', end); wb.addEventListener('pointercancel', end);
  wb.addEventListener('input', e => { const el = e.target.closest('.sticky'); if (el) { m.board.find(x => x.id === el.dataset.nid).text = e.target.textContent; persist(m); } });
}
function askV(m) {
  const cmds = m.analysis.commands, sc = view.scope || 'this';
  return `<div class="cols docs"><section><h2>Asked of ${h(m.wake)} during the call <span class="count">${cmds.length}</span></h2>
   ${cmds.length ? cmds.map((c, k) => `<div class="cmd" data-k="${k}"><p class="who">${av(c.speaker, 'xs')}<b>${h(c.speaker)}</b>${ref(c.turn)}</p><blockquote>${h(c.request)}</blockquote>${c.result ? `<div class="doc">${md(c.result)}</div><div class="bar"><button class="btn sm" data-act="cmd-copy">Copy</button></div>` : `<button class="btn sm solid" data-act="cmd-run" ${!sampler || busy['c' + k] ? 'disabled' : ''}>${busy['c' + k] ? '<i class="spin"></i>Working' : 'Do this now'}</button>`}</div>`).join('') : `<p class="quietp">When someone says “${h(m.wake)}, start a doc for this plan”, the request shows up here so it can be done after the call.</p>`}
   ${cmds.length ? '<p class="hint">Each request only sees the transcript up to the moment it was spoken.</p>' : ''}</section>
  <section class="chat"><div class="bar between"><h2>Ask about this meeting</h2><div class="switch"><button class="${sc === 'this' ? 'on' : ''}" data-act="scope" data-s="this">This meeting</button><button class="${sc === 'all' ? 'on' : ''}" data-act="scope" data-s="all" ${M.length < 2 ? 'disabled' : ''}>${m.projectId ? 'Whole project' : 'All meetings'}</button></div></div>
   <div class="msgs" id="msgs">${m.chat.length ? m.chat.map(x => `<div class="msg ${x.role}">${x.role === 'user' ? h(x.content) : (x.content ? md(x.content) : '<i class="spin"></i>')}</div>`).join('') : `<div class="sugg">${['What did we decide, and who disagreed?', 'What did each person commit to?', 'What is still unresolved?'].map(q => `<button data-act="suggest" data-q="${h(q)}">${h(q)}</button>`).join('')}</div>`}</div>
   <div class="bar"><input id="q" placeholder="${sampler ? 'Ask a question' : 'Open this page in Claude to ask questions'}" ${!sampler ? 'disabled' : ''} aria-label="Question"><button class="btn solid" data-act="ask" ${!sampler || busy.ask ? 'disabled' : ''}>Ask</button></div></section></div>`;
}
function transcriptV(m) {
  const q = (view.tq || '').toLowerCase(), sp = view.sp || '', re = q ? new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig') : null;
  const rows = m.turns.filter(t => (!sp || t.spk === sp) && (!q || (t.text + t.spk).toLowerCase().includes(q)));
  return `<div class="bar"><input id="tq" type="search" placeholder="Search the transcript" value="${h(view.tq || '')}" aria-label="Search the transcript"><select id="tsp" aria-label="Speaker"><option value="">All speakers</option>${m.speakers.map(s => `<option ${sp === s ? 'selected' : ''}>${h(s)}</option>`).join('')}</select><button class="btn sm" data-act="exp-txt">Download</button></div>
  <div class="tx">${rows.map(t => `<div class="turn" id="turn-${t.i}"><span class="tn">${t.i}</span><span class="when">${t.t != null ? fmtT(t.t) : ''}</span><div><b style="color:hsl(${hue(t.spk)} var(--avs) var(--avl))">${h(t.spk)}</b><p>${re ? h(t.text).replace(re, '<mark>$1</mark>') : h(t.text)}</p></div></div>`).join('') || '<p class="quietp">No lines match.</p>'}</div>`;
}
function notesMd(m) {
  const a = m.analysis;
  return `# ${m.title}\n${m.date}\n\n## Summary\n${a.summary}\n\n## Decisions\n${a.decisions.map(d => `- ${d.text}`).join('\n') || '- none'}\n\n## Action items\n${m.actions.map(x => `- ${x.task} (${x.owner}${x.dueDate || x.due ? ', ' + (x.dueDate || x.due) : ''})`).join('\n') || '- none'}\n\n## Open questions\n${a.questions.map(q => `- ${q.text}`).join('\n') || '- none'}\n\n## Risks\n${a.risks.map(q => `- ${q.text}`).join('\n') || '- none'}\n`;
}

/* ---------- search ---------- */
function searchView() {
  const q = (view.q || '').toLowerCase(), ts = S.tasks.filter(t => (t.title + ' ' + t.owner + ' ' + t.notes).toLowerCase().includes(q));
  const ms = M.map(m => ({ m, hit: m.title.toLowerCase().includes(q) ? null : m.turns.find(t => t.text.toLowerCase().includes(q)) })).filter(x => x.hit !== undefined && (x.hit || x.m.title.toLowerCase().includes(q)));
  return `<header class="top"><div><h1>Results for “${h(view.q)}”</h1></div></header>
  <h2>Tasks <span class="count">${ts.length}</span></h2>${ts.length ? `<div class="rows">${ts.map(t => taskRow(t, { project: 1 })).join('')}</div>` : '<p class="quietp">No tasks match.</p>'}
  <h2>Meetings <span class="count">${ms.length}</span></h2>${ms.length ? `<div class="rows">${ms.map(({ m, hit }) => `<a class="mrow" data-act="go" data-r="meeting" data-id="${m.id}" ${hit ? `data-mtab="transcript" data-turn="${hit.i}"` : ''}><div class="pn"><b>${h(m.title)}</b><span>${hit ? h(hit.spk) + ': ' + h(hit.text.slice(0, 140)) : fmtDay(m.date)}</span></div></a>`).join('')}</div>` : '<p class="quietp">No meetings match.</p>'}`;
}

/* ---------- task drawer ---------- */
function drawer() {
  const t = view.task && S.tasks.find(x => x.id === view.task); if (!t) return '';
  const m = t.mid && meeting(t.mid), turn = m && m.turns[t.turn];
  return `<div class="scrim" data-act="close-task"></div><aside class="drawer" role="dialog" aria-label="Task">
   <div class="bar between"><button class="stbtn big" data-act="cycle" data-id="${t.id}">${stIcon(t.status)}<span>${STNAME[t.status]}</span></button><button class="iconbtn" data-act="close-task" aria-label="Close">${ico('x')}</button></div>
   <textarea class="dtitle" id="tf-title" data-task="${t.id}" data-field="title" rows="${Math.min(5, Math.max(1, Math.ceil(t.title.length / 32)))}" aria-label="Task title">${h(t.title)}</textarea>
   <div class="fgrid">
    <label class="f">Status<select id="tf-status" data-task="${t.id}" data-field="status">${STATUS.map(([k, l]) => `<option value="${k}" ${t.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="f">Owner<input id="tf-owner" data-task="${t.id}" data-field="owner" list="people" value="${h(t.owner)}"></label>
    <label class="f">Start<input type="date" id="tf-start" data-task="${t.id}" data-field="start" value="${h(t.start)}"></label>
    <label class="f">Due<input type="date" id="tf-due" class="${isLate(t) ? 'late' : ''}" data-task="${t.id}" data-field="due" value="${h(t.due)}"></label>
    <label class="f">Priority<select id="tf-priority" data-task="${t.id}" data-field="priority">${['high', 'medium', 'low'].map(x => `<option ${t.priority === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    <label class="f">Project<select id="tf-pid" data-task="${t.id}" data-field="pid">${S.projects.map(p => `<option value="${p.id}" ${t.pid === p.id ? 'selected' : ''}>${h(p.name)}</option>`).join('')}</select></label>
   </div>
   <label class="f">Notes<textarea id="tf-notes" data-task="${t.id}" data-field="notes" rows="5">${h(t.notes)}</textarea></label>
   ${m ? `<div class="origin"><p>${srcMark}<span>From <a data-act="go" data-r="meeting" data-id="${m.id}" data-mtab="transcript" data-turn="${t.turn}">${h(m.title)}</a>, ${h(fmtDay(m.date))}</span></p>${turn ? `<blockquote><b>${h(turn.spk)}</b> ${h(turn.text)}</blockquote>` : ''}</div>` : ''}
   <div class="grow"></div><div class="bar between"><span class="hint">Created ${h(fmtDay(t.created))}</span><button class="btn quiet" data-act="del-task">Delete task</button></div>${peopleList()}</aside>`;
}

/* ---------- events ---------- */
let armed = { k: '', at: 0 };
const confirmTwice = (k, msg) => { const n = Date.now(); if (armed.k === k && n - armed.at < 4000) { armed.k = ''; return true; } armed = { k, at: n }; toast(msg); return false; };
function jump(n) { view.mtab = 'transcript'; view.tq = ''; view.sp = ''; render(); const el = $('#turn-' + n); if (el) { if (el.scrollIntoView) el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); } }
function readDraft() { if (!$('#paste')) return; draft = { text: $('#paste').value, title: $('#d-title').value, pid: $('#d-pid').value, date: $('#d-date').value, domains: $('#d-domains').value, wake: 'Claude', redact: $('#d-redact').checked }; }
function loadFile(f) { if (f) f.text().then(x => { readDraft(); draft.text = x; if (!draft.title) draft.title = f.name.replace(/\.[^.]+$/, ''); render(); }); }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, m = view.route === 'meeting' ? meeting(view.id) : null, p = view.route === 'project' ? project(view.id) : null;
  if (el.tagName !== 'INPUT' && el.tagName !== 'LABEL') e.preventDefault();
  e.stopPropagation();
  switch (act) {
    case 'go': { const d = el.dataset; go(d.r, d.id, { mtab: d.mtab || 'notes', tab: d.tab || 'board', tpl: d.tpl }); if (d.turn) jump(+d.turn); break; }
    case 'theme': S.prefs.theme = isDark() ? 'light' : 'dark'; persist(); render(); break;
    case 'tab': view.tab = el.dataset.tab; view.doc = ''; render(); break;
    case 'mtab': view.mtab = el.dataset.tab; view.doc = ''; render(); break;
    case 'keep-example': S.example = false; persist(); render(); break;
    case 'clear-example': if (confirmTwice('clear', 'This removes everything in the workspace. Click again to confirm.')) { M.forEach(x => dirty.del.add(x.id)); S = { v: 1, projects: [], tasks: [], prefs: { me: '' }, example: false }; M = []; persist(); go('home'); } break;
    case 'new-project': { const np = { id: uid(), name: 'New project', color: S.projects.length, desc: '', docs: [] }; S.projects.push(np); persist(); go('project', np.id); const i = $('#p-name'); if (i) { i.focus(); i.select(); } break; }
    case 'del-project': if (confirmTwice('dp', 'This deletes the project and its tasks. Click Delete again to confirm.')) { S.tasks = S.tasks.filter(t => t.pid !== p.id); S.projects = S.projects.filter(x => x.id !== p.id); M.forEach(x => { if (x.projectId === p.id) { x.projectId = ''; x.actions.forEach(a => a.taskId = null); dirty.m.add(x.id); } }); persist(); go('home'); } break;
    case 'new-task': { const t = newTask({ pid: p.id, owner: view.owner || 'Unassigned' }); persist(); view.task = t.id; render(); const i = $('#tf-title'); if (i) { i.focus(); i.select(); } break; }
    case 'open-task': view.task = el.dataset.id; render(); break;
    case 'close-task': view.task = null; render(); break;
    case 'del-task': deleteTask(view.task); view.task = null; persist(); render(); toast('Task deleted'); break;
    case 'cycle': { const t = S.tasks.find(x => x.id === el.dataset.id), i = STATUS.findIndex(s => s[0] === t.status); t.status = STATUS[(i + 1) % 4][0]; persist(); render(); break; }
    case 'sort': { const k = el.dataset.k, s = view.sort || {}; view.sort = { k, d: s.k === k ? -s.d : 1 }; render(); break; }
    case 'sample': readDraft(); draft.text = SAMPLE_TEXT; draft.title = draft.title || 'Summit planning session'; render(); break;
    case 'import': { readDraft(); const nm = importMeeting(draft.text, draft); if (!nm) break; persist(nm); draft = { ...draft, text: '', title: '' }; go('meeting', nm.id); if (sampler) analyze(nm.id); break; }
    case 'analyze': analyze(m.id); break;
    case 'del-meeting': if (confirmTwice('dm', 'This deletes the meeting. Tasks already on a board stay. Click Delete again to confirm.')) { S.tasks.forEach(t => { if (t.mid === m.id) t.mid = null; }); M = M.filter(x => x.id !== m.id); dirty.del.add(m.id); persist(); go('meetings'); } break;
    case 'send-one': { const a = m.actions.find(x => x.id === el.closest('[data-ma]').dataset.ma); if (sendToBoard(m, a)) { persist(m); render(); toast('Sent to the board'); } break; }
    case 'send-all': { let n = 0; m.actions.filter(a => !a.taskId).forEach(a => { if (sendToBoard(m, a)) n++; }); if (n) { persist(m); render(); toast(n + ' sent to the board'); } break; }
    case 'drop-action': m.actions = m.actions.filter(x => x.id !== el.closest('[data-ma]').dataset.ma); persist(m); render(); break;
    case 'add-action': m.actions.push({ id: uid(), task: 'New action item', owner: 'Unassigned', due: null, dueDate: '', priority: 'medium', turn: 0, taskId: null }); persist(m); render(); break;
    case 'jump': if (m) jump(+el.dataset.turn); break;
    case 'add-sticky': m.board.push({ id: 'sticky' + uid(), kind: 'sticky', text: 'New note', x: 40, y: 40 }); persist(m); render(); break;
    case 'reset-wb': m.board = null; render(); break;
    case 'tpl': view.extra = $('#tpl-extra').value; view.tpl = el.dataset.k; render(); break;
    case 'generate': view.extra = $('#tpl-extra').value; view.tpl = el.dataset.k; generate(el.dataset.kind, el.dataset.k, view.extra); break;
    case 'open-doc': { const d = ((m || p).docs || []).find(x => x.id === el.dataset.did); view.doc = d.text; view.docName = d.name; render(); break; }
    case 'copy-doc': copy(view.doc); break;
    case 'dl-doc': saveFile(fname(view.docName || 'document') + '.md', view.doc); break;
    case 'scope': view.scope = el.dataset.s; render(); break;
    case 'suggest': ask(el.dataset.q); break;
    case 'ask': { const q = $('#q'), v = q.value; q.value = ''; ask(v); break; }
    case 'cmd-run': runCommand(+el.closest('.cmd').dataset.k); break;
    case 'cmd-copy': copy(m.analysis.commands[+el.closest('.cmd').dataset.k].result); break;
    case 'exp-md': saveFile(fname(m.title) + ' notes.md', notesMd(m)); break;
    case 'copy-notes': copy(notesMd(m)); break;
    case 'exp-txt': saveFile(fname(m.title) + ' transcript.txt', m.turns.map(x => `${x.t != null ? '[' + fmtT(x.t) + '] ' : ''}${x.spk}: ${x.text}`).join('\n')); break;
    case 'backup': saveFile('pm-avn backup ' + today() + '.json', JSON.stringify({ S, M }, null, 1)); break;
  }
});
document.addEventListener('change', e => {
  const t = e.target, m = view.route === 'meeting' ? meeting(view.id) : null, p = view.route === 'project' ? project(view.id) : null;
  if (t.dataset.task) { const k = S.tasks.find(x => x.id === t.dataset.task), f = t.dataset.field; k[f] = t.value.trim() || (f === 'owner' ? 'Unassigned' : f === 'title' ? k.title : ''); persist(); render(); return; }
  const ma = t.closest('[data-ma]');
  if (ma && t.dataset.field) { const a = m.actions.find(x => x.id === ma.dataset.ma); a[t.dataset.field] = t.value; persist(m); return; }
  switch (t.id) {
    case 'me': S.prefs.me = t.value; persist(); render(); break;
    case 'f-owner': view.owner = t.value; render(); break;
    case 'p-name': p.name = t.value.trim() || p.name; persist(); render(); break;
    case 'p-desc': p.desc = t.value; persist(); break;
    case 'm-title': m.title = t.value.trim() || m.title; m.titleEdited = true; persist(m); render(); break;
    case 'm-pid': m.projectId = t.value; persist(m); render(); break;
    case 'm-date': if (t.value) { m.date = t.value; m.actions.forEach(a => { if (!a.taskId) a.dueDate = parseDue(a.due, m.date) || a.dueDate; }); persist(m); render(); } break;
    case 'm-redact': m.redact = t.checked; persist(m); break;
    case 'tsp': view.sp = t.value; render(); break;
    case 'file': loadFile(t.files[0]); break;
    case 'restore': { const f = t.files[0]; if (f) f.text().then(x => { try { const o = JSON.parse(x); if (!o.S || !Array.isArray(o.S.projects)) throw 0; M.forEach(y => dirty.del.add(y.id)); S = o.S; M = o.M || []; M.forEach(y => { dirty.del.delete(y.id); dirty.m.add(y.id); }); persist(); go('home'); toast('Backup restored'); } catch (err) { toast('That file is not a PM-AVN backup.'); } }); break; }
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'search') { const q = t.value; if (q.trim().length >= 2) { if (view.route !== 'search') view = { ...view, prev: { ...view }, route: 'search' }; view.q = q; render(); } else if (view.route === 'search') { view = { ...view.prev, q: '' }; render(); } }
  if (t.id === 'tq') { view.tq = t.value; render(); }
});
document.addEventListener('keydown', e => {
  const t = e.target;
  if (e.key === 'Escape' && view.task) { view.task = null; render(); }
  if (e.key !== 'Enter') return;
  if (t.id === 'q') { const v = t.value; t.value = ''; ask(v); }
  if (t.classList.contains('qa') && t.value.trim()) { newTask({ pid: view.id, title: t.value.trim(), status: t.dataset.status, owner: view.owner || 'Unassigned' }); t.value = ''; persist(); render(); }
  if (t.matches('[data-act][tabindex]') && !/^(INPUT|TEXTAREA|BUTTON|SELECT)$/.test(t.tagName)) t.click();
});
/* board drag and drop */
let dragId = null;
document.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('.card'); if (!c) return; dragId = c.dataset.id; c.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; } catch (err) { } });
document.addEventListener('dragend', () => { dragId = null; $$('.lane.over').forEach(l => l.classList.remove('over')); $$('.card.dragging').forEach(c => c.classList.remove('dragging')); });
document.addEventListener('dragover', e => {
  const l = e.target.closest && e.target.closest('.lane, #drop'); if (!l) return; e.preventDefault();
  if (l.id === 'drop') { l.classList.add('on'); return; }
  if (!dragId) return; $$('.lane.over').forEach(x => x !== l && x.classList.remove('over')); l.classList.add('over');
});
document.addEventListener('dragleave', e => { const d = e.target.closest && e.target.closest('#drop'); if (d) d.classList.remove('on'); });
document.addEventListener('drop', e => {
  const dz = e.target.closest && e.target.closest('#drop');
  if (dz) { e.preventDefault(); loadFile(e.dataTransfer.files[0]); return; }
  const l = e.target.closest && e.target.closest('.lane'); if (!l || !dragId) return; e.preventDefault();
  const t = S.tasks.find(x => x.id === dragId), over = e.target.closest('.card'), lane = tasksOf(t.pid).filter(x => x.status === l.dataset.lane && x.id !== t.id);
  t.status = l.dataset.lane;
  const i = over ? lane.findIndex(x => x.id === over.dataset.id) : -1;
  if (i >= 0) lane.splice(i, 0, t); else lane.push(t);
  lane.forEach((x, n) => x.order = n);
  dragId = null; persist(); render();
});
window.addEventListener('hashchange', fromHash);
document.addEventListener('pointerdown', e => { $$('details.pmenu[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; }); });

/* ---------- start ---------- */
if (!loadLocal()) exampleWorkspace();
fromHash(); render();
if (typeof claude !== 'undefined') {
  claude.use('sample').then(s => { sampler = s; render(); }).catch(() => { });
  claude.use('downloads').then(d => { dl = d; }).catch(() => { });
  connectCloud();
}
