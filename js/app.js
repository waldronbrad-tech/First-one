// Weekly Compass — Roles → Goals (with plans) → Tasks → Actions, organized each week
// around Covey's Habit 3: "Put First Things First".
(() => {
  'use strict';

  const STORAGE_KEY = 'weeklyCompass.v1';
  // OAuth Client ID for the hosted app (https://waldronbrad-tech.github.io). Not a secret.
  const DEFAULT_CLIENT_ID = '967205404225-3tv8k291racu7oe2ed8b9l542b16a9rg.apps.googleusercontent.com';

  // Google Calendar's event colors, so a role's color carries over to the calendar.
  const COLORS = [
    { id: '9', name: 'Blueberry', hex: '#3f51b5' },
    { id: '10', name: 'Basil', hex: '#0b8043' },
    { id: '6', name: 'Tangerine', hex: '#f4511e' },
    { id: '3', name: 'Grape', hex: '#8e24aa' },
    { id: '7', name: 'Peacock', hex: '#039be5' },
    { id: '5', name: 'Banana', hex: '#f6bf26' },
    { id: '4', name: 'Flamingo', hex: '#e67c73' },
    { id: '2', name: 'Sage', hex: '#33b679' },
    { id: '1', name: 'Lavender', hex: '#7986cb' },
    { id: '11', name: 'Tomato', hex: '#d50000' },
    { id: '8', name: 'Graphite', hex: '#616161' },
  ];
  const UNASSIGNED = { id: null, name: 'Unassigned', colorId: '8' };

  const QUADRANTS = {
    1: { name: 'Urgent & Important', hint: 'Necessity: crises, deadlines, pressing problems' },
    2: { name: 'Not Urgent & Important', hint: 'Quality: planning, relationships, prevention, renewal' },
    3: { name: 'Urgent & Not Important', hint: 'Deception: interruptions, some calls and meetings' },
    4: { name: 'Not Urgent & Not Important', hint: 'Waste: trivia, busywork, time-wasters' },
  };

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // ---------- utilities ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const colorHex = (colorId) => (COLORS.find((c) => c.id === colorId) || COLORS[COLORS.length - 1]).hex;

  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const weekKey = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - ((d.getDay() - state.settings.weekStartsOn + 7) % 7));
    return ymd(d);
  };
  const firstOfMonth = (d) => ymd(new Date(d.getFullYear(), d.getMonth(), 1));
  const weekDates = (key) => Array.from({ length: 7 }, (_, i) => addDays(parseYmd(key), i));
  const fmtDate = (d, opts) => d.toLocaleDateString(undefined, opts);
  const fmtTime = (hhmm) => {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };
  const minutesLabel = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ' ' + (min % 60) + 'm' : ''}` : `${min}m`);

  // ---------- state ----------
  function defaultRoles() {
    return [
      { name: 'Tonic Chairman', colorId: '3' },
      { name: 'Sales', colorId: '6' },
      { name: 'Delivery & Developer', colorId: '9' },
      { name: 'Finance & Housekeeper', colorId: '10' },
      { name: 'Relationship Builder', colorId: '4' },
      { name: 'Innovator', colorId: '1' },
      { name: 'Jiu Jitsu', colorId: '11' },
    ].map((r) => ({ id: uid(), statement: '', ...r }));
  }

  // Roles seeded by earlier versions of the app, replaced if they were never used.
  const PREVIOUS_SEEDS = [
    'Individual|Partner|Parent|Professional|Community',
    'Tonic Chairman|Sales|Delivery|Developer|Finance|Housekeeper|Relationship Builder|Innovator',
    'Tonic Chairman|Sales|Delivery|Developer|Finance|Housekeeper|Relationship Builder|Innovator|Jiu Jitsu',
    'Tonic Chairman|Sales|Delivery & Developer|Finance|Housekeeper|Relationship Builder|Innovator|Jiu Jitsu',
  ];

  function defaultState() {
    return {
      version: 1,
      settings: {
        weekStartsOn: 1, clientId: DEFAULT_CLIENT_ID, calendarId: 'primary', defaultDuration: 60, theme: 'auto',
        planningDay: 5, planningTime: '16:30', gcalLinked: false,
      },
      mission: '',
      roles: defaultRoles(),
      goals: [],
      tasks: [],
      weeks: {},
      pendingDeletes: [],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        const base = defaultState();
        const loaded = { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) } };
        if (!loaded.settings.clientId) loaded.settings.clientId = DEFAULT_CLIENT_ID;
        const untouched = !loaded.goals.length && !loaded.tasks.length;
        if (untouched && PREVIOUS_SEEDS.includes(loaded.roles.map((r) => r.name).join('|'))) {
          loaded.roles = defaultRoles();
          loaded.settings.weekStartsOn = 1;
          loaded.settings.planningTime = base.settings.planningTime;
        }
        return loaded;
      }
    } catch (e) { /* fall through to defaults */ }
    return defaultState();
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { toast('Could not save to this browser.'); }
  }

  // Every change is saved locally and then pushed to Google Calendar.
  function save() {
    persist();
    scheduleSync();
  }

  let state = load();
  let currentWeek = weekKey(new Date());
  let view = 'compass';
  let currentMonth = firstOfMonth(new Date());
  let eventsByDay = {};

  const roleById = (id) => state.roles.find((r) => r.id === id);
  const goalById = (id) => state.goals.find((g) => g.id === id);
  const taskById = (id) => state.tasks.find((t) => t.id === id);
  const taskRole = (t) => roleById(t.roleId) || UNASSIGNED;
  const taskColor = (t) => colorHex(taskRole(t).colorId);
  const weekData = (key = currentWeek) => {
    if (!state.weeks[key]) state.weeks[key] = { reflection: '' };
    return state.weeks[key];
  };
  const weekTasks = (key = currentWeek) => state.tasks.filter((t) => t.week === key);
  const sortTasks = (a, b) => (a.start || '99').localeCompare(b.start || '99') || a.quadrant - b.quadrant || (a.priority || 'Z').localeCompare(b.priority || 'Z');

  // ---------- toast ----------
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  // ---------- shared components ----------
  function taskCard(t, { draggable = false, showActions = false } = {}) {
    const role = taskRole(t);
    const goal = goalById(t.goalId);
    const doneActions = t.actions.filter((a) => a.done).length;
    const when = t.date
      ? (view === 'week' ? '' : fmtDate(parseYmd(t.date), { weekday: 'short' }) + ' ') + (t.start ? fmtTime(t.start) : 'Any time')
      : 'Unscheduled';
    const meta = [
      `<span class="q q${t.quadrant}" title="${esc(QUADRANTS[t.quadrant].name)}">Q${t.quadrant}</span>`,
      t.priority ? `<span>${esc(t.priority)}</span>` : '',
      `<span>${esc(when)}${t.start ? ' · ' + minutesLabel(t.duration) : ''}</span>`,
      `<span>${esc(goal ? goal.title : role.name)}</span>`,
      t.actions.length ? `<span>${doneActions}/${t.actions.length} actions</span>` : '',
      t.gcalEventId ? '<span class="synced" title="On Google Calendar">&#10003; cal</span>' : '',
    ].join('');
    const actions = showActions && t.actions.length
      ? `<ul class="actions-mini">${t.actions.map((a) => `
          <li class="${a.done ? 'done' : ''}"><input type="checkbox" data-act="toggle-action" data-id="${t.id}" data-action="${a.id}" ${a.done ? 'checked' : ''} aria-label="Action done"><span>${esc(a.text)}</span></li>`).join('')}</ul>`
      : '';
    return `<div class="task ${t.done ? 'done' : ''}" style="--c:${taskColor(t)}" data-task="${t.id}" ${draggable ? 'draggable="true"' : ''}>
      <input type="checkbox" data-act="toggle-task" data-id="${t.id}" ${t.done ? 'checked' : ''} aria-label="Mark task done">
      <div class="task-body" data-act="edit-task" data-id="${t.id}">
        <div class="task-title">${esc(t.title)}</div>
        <div class="task-meta">${meta}</div>
        ${actions}
      </div>
    </div>`;
  }

  function goalProgress(goal) {
    const tasks = state.tasks.filter((t) => t.goalId === goal.id);
    const done = tasks.filter((t) => t.done).length;
    return { total: tasks.length, done, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
  }

  // ---------- views ----------
  function renderCompass() {
    const roleCards = state.roles.map((r) => {
      const goals = state.goals.filter((g) => g.roleId === r.id);
      const thisWeek = weekTasks().filter((t) => t.roleId === r.id);
      return `<article class="panel role-card" style="--c:${colorHex(r.colorId)}">
        <div class="panel-head">
          <h3 class="role-name"><span class="swatch"></span>${esc(r.name)}</h3>
          <button class="btn small ghost" data-act="edit-role" data-id="${r.id}">Edit</button>
        </div>
        ${r.statement ? `<p class="role-statement">${esc(r.statement)}</p>` : ''}
        <ul class="goal-list">
          ${goals.map((g) => {
            const p = goalProgress(g);
            return `<li class="goal-row ${g.status === 'done' ? 'done' : ''}" data-act="edit-goal" data-id="${g.id}">
              <span class="grow"><span class="goal-title">${esc(g.title)}</span></span>
              <span class="progress" title="${p.done}/${p.total} tasks done"><span style="width:${p.pct}%"></span></span>
            </li>`;
          }).join('') || '<li class="hint">No goals yet. What is the most important thing you could do in this role?</li>'}
        </ul>
        <div class="toolbar" style="margin:12px 0 0">
          <button class="btn small" data-act="new-goal" data-role="${r.id}">+ Goal</button>
          <button class="btn small" data-act="new-task" data-role="${r.id}">+ Task this week</button>
          <span class="spacer"></span>
          <span class="hint">${thisWeek.length} this week</span>
        </div>
      </article>`;
    }).join('');

    return `
      <section class="panel">
        <div class="panel-head"><h2>Personal mission statement</h2></div>
        <textarea id="mission" rows="4" placeholder="What do I want to be (character) and do (contributions), and what values guide me?">${esc(state.mission)}</textarea>
        <p class="hint" style="margin-top:6px">Begin each weekly plan by reconnecting with your mission. It is the "true north" for every role and goal below.</p>
      </section>
      <div class="section-title">
        <h2>Roles &amp; goals</h2>
        <button class="btn primary" data-act="new-role">+ Role</button>
      </div>
      ${state.roles.length > 7 ? '<p class="hint" style="margin-bottom:12px">Covey suggests about seven roles. If a week feels crowded, consider which roles can share goals.</p>' : ''}
      <div class="grid cards">${roleCards || '<div class="empty">Add the roles you play: family, work, community, self.</div>'}</div>`;
  }

  function renderPlan() {
    const groups = state.roles.map((r) => {
      const goals = state.goals.filter((g) => g.roleId === r.id);
      if (!goals.length) return '';
      return `<div class="section-title"><h2 class="role-name"><span class="swatch" style="--c:${colorHex(r.colorId)}"></span>${esc(r.name)}</h2></div>
        <div class="grid cards">${goals.map(goalCard).join('')}</div>`;
    }).join('');

    const loose = weekTasks().filter((t) => !t.goalId).sort(sortTasks);
    return `
      <div class="toolbar">
        <p class="hint">Each goal carries a measure, a plan, and the tasks (with action steps) that move it forward this week.</p>
        <span class="spacer"></span>
        <button class="btn primary" data-act="new-goal">+ Goal</button>
      </div>
      ${groups || '<div class="empty panel">No goals yet. Add one from a role on the Compass tab, or click "+ Goal".</div>'}
      <div class="section-title"><h2>Tasks not linked to a goal</h2>
        <button class="btn" data-act="new-task">+ Task</button></div>
      <div class="task-list">${loose.map((t) => taskCard(t, { showActions: true })).join('') || '<p class="hint">None this week.</p>'}</div>`;
  }

  function goalCard(g) {
    const r = roleById(g.roleId) || UNASSIGNED;
    const p = goalProgress(g);
    const tasks = weekTasks().filter((t) => t.goalId === g.id).sort(sortTasks);
    return `<article class="panel goal-card" style="--c:${colorHex(r.colorId)}">
      <div class="panel-head">
        <h3>${esc(g.title)}${g.status === 'done' ? ' &#10003;' : ''}</h3>
        <button class="btn small ghost" data-act="edit-goal" data-id="${g.id}">Edit</button>
      </div>
      <div class="goal-meta">
        ${g.measure ? `<span><strong>Measure:</strong> ${esc(g.measure)}</span>` : ''}
        ${g.due ? `<span><strong>Due:</strong> ${esc(fmtDate(parseYmd(g.due), { month: 'short', day: 'numeric', year: 'numeric' }))}</span>` : ''}
        <span><strong>Progress:</strong> ${p.done}/${p.total} tasks</span>
      </div>
      ${g.plan ? `<div class="plan-text">${esc(g.plan)}</div>` : ''}
      <div class="task-list">${tasks.map((t) => taskCard(t, { showActions: true })).join('') || '<p class="hint">No tasks this week.</p>'}</div>
      <div class="toolbar" style="margin:10px 0 0"><button class="btn small" data-act="new-task" data-goal="${g.id}">+ Task</button></div>
    </article>`;
  }

  function renderWeek() {
    const dates = weekDates(currentWeek);
    const tray = weekTasks().filter((t) => !t.date).sort(sortTasks);
    const today = ymd(new Date());

    const days = dates.map((d) => {
      const key = ymd(d);
      const dayTasks = state.tasks.filter((t) => t.date === key);
      const items = dayTasks.map((t) => ({ sort: t.start || '', html: taskCard(t, { draggable: true }) }));
      state.goals.filter((g) => g.due === key).forEach((g) => items.push({ sort: '', html: goalChip(g) }));
      (eventsByDay[key] || []).forEach((ev) => items.push(eventChip(ev)));
      items.sort((a, b) => (a.sort || '99').localeCompare(b.sort || '99'));
      const minutes = dayTasks.filter((t) => t.start).reduce((sum, t) => sum + t.duration, 0);
      return `<section class="day ${key === today ? 'today' : ''}">
        <div class="day-head"><span class="dow">${DOW[d.getDay()]}</span><span class="date">${fmtDate(d, { month: 'short', day: 'numeric' })}</span></div>
        <div class="day-body dropzone" data-date="${key}">${items.map((i) => i.html).join('')}</div>
        <div class="day-foot"><span>${minutes ? minutesLabel(minutes) + ' planned' : ''}</span>
          <button class="btn small ghost" data-act="new-task" data-date="${key}" aria-label="Add task on ${fmtDate(d, { weekday: 'long' })}">+ Add</button></div>
      </section>`;
    }).join('');

    return `
      <div class="toolbar">
        <button class="btn primary" data-act="new-task">+ Task</button>
        <button class="btn" data-act="rollover">Roll unfinished to next week</button>
        <span class="spacer"></span>
        ${calendarButton()}
        <button class="btn" data-act="export-ics">Export .ics</button>
      </div>
      <div class="legend">${roleLegend()}${Object.keys(QUADRANTS).map((q) => `<span><span class="q q${q}">Q${q}</span>${QUADRANTS[q].name}</span>`).join('')}</div>
      <h3 style="margin-bottom:6px">Big rocks to schedule</h3>
      <p class="hint" style="margin-bottom:8px">"The key is not to prioritize what's on your schedule, but to schedule your priorities." Drag a task onto a day, or open it to set the date and time.</p>
      <div class="tray dropzone" data-date="">${tray.map((t) => taskCard(t, { draggable: true })).join('') || '<span class="tray-empty">Everything is scheduled.</span>'}</div>
      <div class="week-grid">${days}</div>`;
  }

  const roleLegend = () => state.roles.map((r) => `<span><span class="swatch" style="--c:${colorHex(r.colorId)}"></span>${esc(r.name)}</span>`).join('');

  const calendarButton = () => (GCal.isConnected()
    ? '<button class="btn" data-act="sync-click">Sync now</button>'
    : '<button class="btn" data-act="gcal-connect">Connect Google Calendar</button>');

  function eventChip(ev, compact = false) {
    const start = ev.start.dateTime ? new Date(ev.start.dateTime) : null;
    const time = start ? start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'All day';
    const c = ev.colorId ? colorHex(ev.colorId) : 'var(--q4)';
    const title = esc(ev.summary || '(no title)');
    const html = compact
      ? `<div class="mevent" style="--c:${c}" title="${title} (Google Calendar)">${start ? `<span class="mtime">${esc(time)}</span> ` : ''}${title}</div>`
      : `<div class="gevent" style="--c:${c}" title="Google Calendar event"><strong>${title}</strong>${esc(time)}</div>`;
    return { sort: start ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : '', html };
  }

  function goalChip(g) {
    const r = roleById(g.roleId) || UNASSIGNED;
    return `<div class="mgoal" style="--c:${colorHex(r.colorId)}" data-act="edit-goal" data-id="${g.id}" title="Goal target date">&#127919; ${esc(g.title)}</div>`;
  }

  function monthRange() {
    const m = parseYmd(currentMonth);
    const last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    return [parseYmd(weekKey(m)), addDays(parseYmd(weekKey(last)), 7)];
  }

  function renderMonth() {
    const [start, end] = monthRange();
    const month = parseYmd(currentMonth).getMonth();
    const today = ymd(new Date());
    const heads = Array.from({ length: 7 }, (_, i) => `<div class="mhead">${DOW[(state.settings.weekStartsOn + i) % 7]}</div>`).join('');
    let cells = '';
    for (let d = new Date(start); d < end; d = addDays(d, 1)) {
      const key = ymd(d);
      const items = state.tasks.filter((t) => t.date === key).map((t) => ({
        sort: t.start || '',
        html: `<div class="mtask ${t.done ? 'done' : ''}" style="--c:${taskColor(t)}" draggable="true" data-task="${t.id}" data-act="edit-task" data-id="${t.id}" title="${esc(t.title)}">${t.start ? `<span class="mtime">${esc(fmtTime(t.start))}</span> ` : ''}${esc(t.title)}</div>`,
      }));
      (eventsByDay[key] || []).forEach((ev) => items.push(eventChip(ev, true)));
      items.sort((a, b) => (a.sort || '99').localeCompare(b.sort || '99'));
      cells += `<div class="mcell dropzone ${d.getMonth() !== month ? 'out' : ''} ${key === today ? 'today' : ''}" data-date="${key}">
        <div class="mcell-head">
          <button class="mday" data-act="goto-week" data-date="${key}" title="Plan this week"><span class="mdow">${DOW[d.getDay()]} </span>${d.getDate()}</button>
          <button class="btn small ghost madd" data-act="new-task" data-date="${key}" aria-label="Add task on ${esc(fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' }))}">+</button>
        </div>
        ${state.goals.filter((g) => g.due === key).map(goalChip).join('')}${items.map((i) => i.html).join('')}
      </div>`;
    }
    return `
      <div class="toolbar">
        <p class="hint">Plan a month ahead: + adds a task on that date, drag tasks between days, or click a date to plan that week in detail.</p>
        <span class="spacer"></span>
        ${calendarButton()}
      </div>
      <div class="legend">${roleLegend()}</div>
      <div class="month-grid">${heads}${cells}</div>`;
  }

  function eventDay(ev) {
    if (ev.start.date) return ev.start.date;
    return ymd(new Date(ev.start.dateTime));
  }

  function renderReview() {
    const tasks = weekTasks();
    const done = tasks.filter((t) => t.done);
    const pct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
    const minutes = (list) => list.filter((t) => t.date && t.start).reduce((s, t) => s + t.duration, 0);
    const q = [1, 2, 3, 4].map((n) => {
      const list = tasks.filter((t) => t.quadrant === n);
      return { n, count: list.length, done: list.filter((t) => t.done).length, minutes: minutes(list) };
    });
    const q2Share = tasks.length ? Math.round((q[1].count / tasks.length) * 100) : 0;
    const activeGoals = state.goals.filter((g) => g.status !== 'done');
    const goalsTouched = activeGoals.filter((g) => tasks.some((t) => t.goalId === g.id));
    const neglected = state.roles.filter((r) => !tasks.some((t) => t.roleId === r.id));
    const maxCount = Math.max(1, ...state.roles.map((r) => tasks.filter((t) => t.roleId === r.id).length));
    const qColor = { 1: 'var(--q1)', 2: 'var(--q2)', 3: 'var(--q3)', 4: 'var(--q4)' };

    return `
      <div class="stats">
        <div class="stat"><div class="num">${pct}%</div><div class="lbl">Tasks completed (${done.length}/${tasks.length})</div></div>
        <div class="stat"><div class="num">${q2Share}%</div><div class="lbl">Tasks in Quadrant II</div></div>
        <div class="stat"><div class="num">${goalsTouched.length}/${activeGoals.length}</div><div class="lbl">Active goals advanced</div></div>
        <div class="stat"><div class="num">${minutesLabel(minutes(tasks))}</div><div class="lbl">Time scheduled</div></div>
      </div>
      <div class="grid two">
        <section class="panel">
          <div class="panel-head"><h2>Balance across roles</h2></div>
          ${state.roles.map((r) => {
            const list = tasks.filter((t) => t.roleId === r.id);
            const d = list.filter((t) => t.done).length;
            return `<div class="bar-row" style="--c:${colorHex(r.colorId)}">
              <span class="role-name"><span class="swatch"></span>${esc(r.name)}</span>
              <div class="bar" role="img" aria-label="${d} of ${list.length} done"><span class="planned" style="width:${(list.length / maxCount) * 100}%"></span><span class="done" style="width:${(d / maxCount) * 100}%"></span></div>
              <span class="hint">${d}/${list.length} done</span>
            </div>`;
          }).join('')}
          ${neglected.length ? `<p class="hint warn" style="margin-top:8px">No tasks this week for: ${neglected.map((r) => esc(r.name)).join(', ')}. Is that a deliberate choice?</p>` : ''}
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Time management matrix</h2></div>
          <div class="matrix">
            ${q.map((c) => `<div class="cell" style="--qc:${qColor[c.n]}">
              <div><span class="q q${c.n}">Q${c.n}</span> <strong>${QUADRANTS[c.n].name}</strong></div>
              <div class="num">${c.done}/${c.count}</div>
              <div class="hint">${c.minutes ? minutesLabel(c.minutes) + ' scheduled · ' : ''}${QUADRANTS[c.n].hint}</div>
            </div>`).join('')}
          </div>
          <p class="hint" style="margin-top:8px">Effective people grow Quadrant II and shrink Q3 and Q4, which over time also shrinks Q1.</p>
        </section>
      </div>
      <section class="panel" style="margin-top:16px">
        <div class="panel-head"><h2>Weekly evaluation</h2></div>
        <textarea id="reflection" rows="6" placeholder="What goals did I reach? What challenges did I face? What decisions did I make? Did I keep my priorities, or let urgency take over?">${esc(weekData().reflection || '')}</textarea>
      </section>`;
  }

  function renderSettings() {
    const s = state.settings;
    return `
      <div class="grid two">
        <section class="panel">
          <div class="panel-head"><h2>Google Calendar</h2>
            <span class="hint">${GCal.isConnected() ? '&#9679; Connected, syncing automatically' : 'Not connected'}</span></div>
          <div class="grid" style="gap:12px">
            <div>
              <label for="set-client">OAuth Client ID</label>
              <input type="text" id="set-client" data-setting="clientId" value="${esc(s.clientId)}" placeholder="1234-abc.apps.googleusercontent.com">
            </div>
            <div>
              <label for="set-cal">Calendar ID</label>
              <input type="text" id="set-cal" data-setting="calendarId" value="${esc(s.calendarId)}" placeholder="primary">
              <p class="hint" style="margin-top:4px">Use "primary" for your main Gmail calendar, or the ID of a dedicated calendar.</p>
            </div>
            <div class="toolbar" style="margin:0">
              ${GCal.isConnected()
                ? '<button class="btn" data-act="gcal-disconnect">Disconnect</button>'
                : '<button class="btn primary" data-act="gcal-connect">Connect</button>'}
            </div>
            <p class="hint">Setup: in Google Cloud Console enable the Google Calendar API, create an OAuth Client ID of type "Web application", and add <code>${esc(location.origin)}</code> as an Authorized JavaScript origin. See the README for details. Once connected, every scheduled task and goal target date syncs automatically in the role's color. Moving, renaming or deleting a synced event in Google Calendar updates the app too. Google sign-in lasts about an hour; after that, click Reconnect and any changes made in the meantime are sent.</p>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Preferences</h2></div>
          <div class="grid" style="gap:12px">
            <div>
              <label for="set-week">Week starts on</label>
              <select id="set-week" data-setting="weekStartsOn">
                ${DOW.map((d, i) => `<option value="${i}" ${s.weekStartsOn === i ? 'selected' : ''}>${d}</option>`).join('')}
              </select>
            </div>
            <div class="row-2">
              <div>
                <label for="set-pday">Weekly planning day</label>
                <select id="set-pday" data-setting="planningDay">
                  ${DOW.map((d, i) => `<option value="${i}" ${s.planningDay === i ? 'selected' : ''}>${d}</option>`).join('')}
                </select>
              </div>
              <div>
                <label for="set-ptime">Planning time</label>
                <input type="time" id="set-ptime" data-setting="planningTime" value="${esc(s.planningTime)}">
              </div>
            </div>
            <div>
              <label for="set-dur">Default task length (minutes)</label>
              <input type="number" id="set-dur" min="5" step="5" data-setting="defaultDuration" value="${s.defaultDuration}">
            </div>
            <div>
              <label for="set-theme">Theme</label>
              <select id="set-theme" data-setting="theme">
                ${['auto', 'light', 'dark'].map((t) => `<option value="${t}" ${s.theme === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}
              </select>
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Your data</h2></div>
          <p class="hint" style="margin-bottom:10px">Everything is stored in this browser. Export a backup to move it to another device.</p>
          <div class="toolbar" style="margin:0">
            <button class="btn" data-act="export-json">Export backup</button>
            <label class="btn" style="margin:0;color:inherit;font-size:inherit">Import backup<input type="file" id="import-file" accept="application/json" hidden></label>
            <button class="btn danger" data-act="reset">Reset everything</button>
          </div>
        </section>
      </div>`;
  }

  const VIEWS = { compass: renderCompass, plan: renderPlan, week: renderWeek, month: renderMonth, review: renderReview, settings: renderSettings };

  function render() {
    document.querySelectorAll('.tabs [data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === view)));
    const dates = weekDates(currentWeek);
    $('#week-label').textContent = view === 'month'
      ? fmtDate(parseYmd(currentMonth), { month: 'long', year: 'numeric' })
      : `${fmtDate(dates[0], { month: 'short', day: 'numeric' })} – ${fmtDate(dates[6], { month: 'short', day: 'numeric', year: 'numeric' })}`;
    $('#view').innerHTML = planningBanner() + VIEWS[view]();
    applyTheme();
    updateSyncStatus();
  }

  // Shown from the planning time on planning day (default Friday 4pm) until planned or dismissed.
  function planningBanner() {
    const now = new Date();
    const { planningDay, planningTime } = state.settings;
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (now.getDay() !== planningDay || hhmm < planningTime || state.planningDismissed === ymd(now)) return '';
    return `<div class="banner" role="status">
      <span>&#129517; <strong>Time for your weekly planning.</strong> Review this week, then put first things first for next week.</span>
      <span class="spacer"></span>
      <button class="btn primary small" data-act="start-planning">Plan next week</button>
      <button class="btn small ghost" data-act="dismiss-planning">Dismiss</button>
    </div>`;
  }

  function applyTheme() {
    const t = state.settings.theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  // ---------- modal forms ----------
  const modal = $('#modal');
  const form = $('#modal-form');
  let onSubmit = null;

  function openModal(html, submit) {
    form.innerHTML = html;
    onSubmit = submit;
    modal.showModal();
    const first = form.querySelector('input[type="text"], textarea, select');
    if (first) first.focus();
  }

  form.addEventListener('submit', (e) => {
    const btn = e.submitter;
    if (!btn || btn.value === 'cancel') return;
    e.preventDefault();
    if (btn.value === 'delete') {
      if (onSubmit && onSubmit.onDelete && confirm('Delete this? This cannot be undone.')) {
        onSubmit.onDelete();
        modal.close();
      }
      return;
    }
    if (!form.reportValidity()) return;
    onSubmit(new FormData(form));
    modal.close();
    save();
    render();
  });

  const modalActions = (canDelete) => `<div class="modal-actions">
      ${canDelete ? '<button class="btn danger" value="delete">Delete</button>' : ''}
      <span class="spacer"></span>
      <button class="btn" value="cancel" formnovalidate>Cancel</button>
      <button class="btn primary" value="save">Save</button>
    </div>`;

  function colorPicker(selected) {
    return `<div class="color-pick" role="radiogroup" aria-label="Color">${COLORS.map((c) => `
      <label title="${c.name}"><input type="radio" name="colorId" value="${c.id}" ${c.id === selected ? 'checked' : ''}><span style="--c:${c.hex}"></span></label>`).join('')}</div>`;
  }

  function editRole(role) {
    const isNew = !role;
    const used = new Set(state.roles.map((r) => r.colorId));
    const r = role || { name: '', colorId: (COLORS.find((c) => !used.has(c.id)) || COLORS[0]).id, statement: '' };
    const submit = (fd) => {
      const data = { name: fd.get('name').trim(), colorId: fd.get('colorId') || '8', statement: fd.get('statement').trim() };
      if (isNew) state.roles.push({ id: uid(), ...data });
      else Object.assign(role, data);
    };
    submit.onDelete = () => {
      state.roles = state.roles.filter((x) => x !== role);
      state.goals.forEach((g) => { if (g.roleId === role.id) g.roleId = null; });
      state.tasks.forEach((t) => { if (t.roleId === role.id) t.roleId = null; });
      save(); render();
    };
    openModal(`
      <h2>${isNew ? 'New role' : 'Edit role'}</h2>
      <div><label for="f-name">Role</label><input type="text" id="f-name" name="name" required value="${esc(r.name)}" placeholder="e.g. Manager, Father, Coach"></div>
      <div><label>Color (used for every goal and task in this role, and in Google Calendar)</label>${colorPicker(r.colorId)}</div>
      <div><label for="f-st">Role statement</label><textarea id="f-st" name="statement" rows="3" placeholder="Who do I want to be in this role?">${esc(r.statement)}</textarea></div>
      ${modalActions(!isNew)}`, submit);
  }

  function roleOptions(selected, { allowNone = false } = {}) {
    return (allowNone ? `<option value="">Unassigned</option>` : '')
      + state.roles.map((r) => `<option value="${r.id}" ${r.id === selected ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
  }

  function editGoal(goal, defaults = {}) {
    const isNew = !goal;
    const g = goal || { title: '', roleId: defaults.roleId || (state.roles[0] && state.roles[0].id) || '', measure: '', plan: '', due: '', status: 'active' };
    const submit = (fd) => {
      const data = {
        title: fd.get('title').trim(),
        roleId: fd.get('roleId') || null,
        measure: fd.get('measure').trim(),
        plan: fd.get('plan').trim(),
        due: fd.get('due') || '',
        status: fd.get('status'),
      };
      if (isNew) state.goals.push({ id: uid(), ...data });
      else {
        Object.assign(goal, data);
        state.tasks.forEach((t) => { if (t.goalId === goal.id) t.roleId = data.roleId; });
      }
    };
    submit.onDelete = () => {
      state.goals = state.goals.filter((x) => x !== goal);
      state.tasks.forEach((t) => { if (t.goalId === goal.id) t.goalId = null; });
      if (goal.gcalEventId) state.pendingDeletes.push(goal.gcalEventId);
      save(); render();
    };
    openModal(`
      <h2>${isNew ? 'New goal' : 'Edit goal'}</h2>
      <div><label for="f-title">Goal</label><input type="text" id="f-title" name="title" required value="${esc(g.title)}" placeholder="What important result do you want?"></div>
      <div class="row">
        <div><label for="f-role">Role</label><select id="f-role" name="roleId">${roleOptions(g.roleId, { allowNone: true })}</select></div>
        <div><label for="f-due">Target date</label><input type="date" id="f-due" name="due" value="${esc(g.due)}"></div>
      </div>
      <div><label for="f-measure">Measure of success</label><input type="text" id="f-measure" name="measure" value="${esc(g.measure)}" placeholder="How will you know you achieved it?"></div>
      <div><label for="f-plan">Plan</label><textarea id="f-plan" name="plan" rows="4" placeholder="Strategy, milestones and the key steps to get there">${esc(g.plan)}</textarea></div>
      <div><label for="f-status">Status</label><select id="f-status" name="status">
        <option value="active" ${g.status !== 'done' ? 'selected' : ''}>Active</option>
        <option value="done" ${g.status === 'done' ? 'selected' : ''}>Achieved</option></select></div>
      ${modalActions(!isNew)}`, submit);
  }

  function editTask(task, defaults = {}) {
    const isNew = !task;
    const goal = goalById(defaults.goalId);
    const t = task || {
      title: defaults.title || '',
      goalId: defaults.goalId || '',
      roleId: goal ? goal.roleId : (defaults.roleId || ''),
      quadrant: 2,
      priority: 'A',
      date: defaults.date || '',
      start: defaults.date ? '09:00' : '',
      duration: state.settings.defaultDuration,
      notes: '',
      actions: [],
    };
    const goalOpts = '<option value="">No goal</option>' + state.roles.map((r) => {
      const goals = state.goals.filter((g) => g.roleId === r.id && (g.status !== 'done' || g.id === t.goalId));
      return goals.length ? `<optgroup label="${esc(r.name)}">${goals.map((g) => `<option value="${g.id}" ${g.id === t.goalId ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</optgroup>` : '';
    }).join('') + state.goals.filter((g) => !g.roleId).map((g) => `<option value="${g.id}" ${g.id === t.goalId ? 'selected' : ''}>${esc(g.title)}</option>`).join('');

    const submit = (fd) => {
      const goalId = fd.get('goalId') || null;
      const linked = goalById(goalId);
      const date = fd.get('date') || null;
      const data = {
        title: fd.get('title').trim(),
        goalId,
        roleId: linked ? linked.roleId : (fd.get('roleId') || null),
        quadrant: Number(fd.get('quadrant')),
        priority: fd.get('priority'),
        date,
        week: date ? weekKey(parseYmd(date)) : (task ? task.week : currentWeek),
        start: date ? (fd.get('start') || '') : '',
        duration: Math.max(5, Number(fd.get('duration')) || state.settings.defaultDuration),
        notes: fd.get('notes').trim(),
        actions: [...form.querySelectorAll('.action-edit')].map((row) => ({
          id: row.dataset.id || uid(),
          text: row.querySelector('input[type="text"]').value.trim(),
          done: row.querySelector('input[type="checkbox"]').checked,
        })).filter((a) => a.text),
      };
      if (isNew) state.tasks.push({ id: uid(), done: false, gcalEventId: null, ...data });
      else Object.assign(task, data);
    };
    submit.onDelete = () => {
      state.tasks = state.tasks.filter((x) => x !== task);
      if (task.gcalEventId) state.pendingDeletes.push(task.gcalEventId);
      save(); render();
    };

    openModal(`
      <h2>${isNew ? 'New task' : 'Edit task'}</h2>
      <div><label for="f-title">Task</label><input type="text" id="f-title" name="title" required value="${esc(t.title)}" placeholder="What will you do?"></div>
      <div class="row">
        <div><label for="f-goal">Goal</label><select id="f-goal" name="goalId">${goalOpts}</select></div>
        <div><label for="f-role">Role (if no goal)</label><select id="f-role" name="roleId" ${t.goalId ? 'disabled' : ''}>${roleOptions(t.roleId, { allowNone: true })}</select></div>
      </div>
      <div class="row">
        <div><label for="f-q">Quadrant</label><select id="f-q" name="quadrant">
          ${[1, 2, 3, 4].map((n) => `<option value="${n}" ${t.quadrant === n ? 'selected' : ''}>Q${n} · ${QUADRANTS[n].name}</option>`).join('')}</select></div>
        <div><label for="f-p">Priority</label><select id="f-p" name="priority">
          ${['A', 'B', 'C'].map((p) => `<option ${t.priority === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
      </div>
      <div class="row three">
        <div><label for="f-date">Date (blank = big rocks tray)</label><input type="date" id="f-date" name="date" value="${esc(t.date || '')}"></div>
        <div><label for="f-start">Start time</label><input type="time" id="f-start" name="start" value="${esc(t.start)}"></div>
        <div><label for="f-dur">Minutes</label><input type="number" id="f-dur" name="duration" min="5" step="5" value="${t.duration}"></div>
      </div>
      <div>
        <label>Action steps</label>
        <div id="action-rows">${t.actions.map(actionRow).join('')}</div>
        <button type="button" class="btn small" data-act="add-action">+ Action step</button>
      </div>
      <div><label for="f-notes">Notes</label><textarea id="f-notes" name="notes" rows="2">${esc(t.notes)}</textarea></div>
      ${modalActions(!isNew)}`, submit);

    $('#f-goal', form).addEventListener('change', (e) => {
      const g = goalById(e.target.value);
      const roleSel = $('#f-role', form);
      roleSel.disabled = Boolean(g);
      if (g) roleSel.value = g.roleId || '';
    });
  }

  const actionRow = (a = { id: '', text: '', done: false }) => `<div class="action-edit" data-id="${esc(a.id)}">
      <input type="checkbox" ${a.done ? 'checked' : ''} aria-label="Done">
      <input type="text" value="${esc(a.text)}" placeholder="Next concrete action">
      <button type="button" class="btn small ghost" data-act="remove-action" aria-label="Remove">&times;</button>
    </div>`;

  // ---------- calendar ----------
  function eventBody(t) {
    const role = taskRole(t);
    const goal = goalById(t.goalId);
    const lines = [
      `Role: ${role.name}`,
      goal ? `Goal: ${goal.title}` : null,
      `Quadrant ${t.quadrant}: ${QUADRANTS[t.quadrant].name} · Priority ${t.priority}`,
      t.actions.length ? '\nAction steps:\n' + t.actions.map((a) => `${a.done ? '[x]' : '[ ]'} ${a.text}`).join('\n') : null,
      t.notes ? '\n' + t.notes : null,
      '\nPlanned with Weekly Compass',
    ].filter(Boolean);
    const body = {
      summary: (t.done ? '✓ ' : '') + t.title,
      description: lines.join('\n'),
      colorId: role.colorId,
      status: 'confirmed',
      extendedProperties: { private: { weeklyCompassTaskId: t.id } },
    };
    if (t.start) {
      const [h, m] = t.start.split(':').map(Number);
      const start = parseYmd(t.date);
      start.setHours(h, m, 0, 0);
      const end = new Date(start.getTime() + t.duration * 60000);
      const iso = (d) => `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
      body.start = { dateTime: iso(start), timeZone: TZ };
      body.end = { dateTime: iso(end), timeZone: TZ };
    } else {
      body.start = { date: t.date };
      body.end = { date: ymd(addDays(parseYmd(t.date), 1)) };
    }
    return body;
  }

  // ---------- two-way sync ----------
  // Local changes are detected by comparing each item's event body with what was last sent,
  // so anything edited anywhere in the app is pushed. Edits made in Google Calendar to synced
  // events (time, title, done mark, deletion) are pulled back unless the app has newer edits.
  const sig = (body) => JSON.stringify(body);
  let syncing = false;
  let syncAgain = false;
  let syncTimer = null;
  let syncError = '';

  function goalEventBody(g) {
    const role = roleById(g.roleId) || UNASSIGNED;
    return {
      summary: `${g.status === 'done' ? '✓ ' : ''}🎯 ${g.title}`,
      description: [
        `Goal · Role: ${role.name}`,
        g.measure ? `Measure: ${g.measure}` : null,
        g.plan ? `\nPlan:\n${g.plan}` : null,
        '\nPlanned with Weekly Compass',
      ].filter(Boolean).join('\n'),
      colorId: role.colorId,
      status: 'confirmed',
      transparency: 'transparent',
      start: { date: g.due },
      end: { date: ymd(addDays(parseYmd(g.due), 1)) },
      extendedProperties: { private: { weeklyCompassGoalId: g.id } },
    };
  }

  function pendingChanges() {
    const items = [];
    const check = (obj, hasDate, makeBody) => {
      if (hasDate) {
        const body = makeBody(obj);
        if (!obj.gcalEventId || sig(body) !== obj.gcalSig) items.push({ obj, body });
      } else if (obj.gcalEventId) {
        items.push({ obj, body: null });
      }
    };
    state.tasks.forEach((t) => check(t, Boolean(t.date), eventBody));
    state.goals.forEach((g) => check(g, Boolean(g.due), goalEventBody));
    return items;
  }

  const pendingCount = () => pendingChanges().length + state.pendingDeletes.length;

  function scheduleSync(delay = 1200) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, delay);
    updateSyncStatus();
  }

  async function syncNow() {
    if (!GCal.isConnected()) { updateSyncStatus(); return; }
    if (syncing) { syncAgain = true; return; }
    syncing = true;
    syncError = '';
    updateSyncStatus();
    const cal = state.settings.calendarId;
    try {
      while (state.pendingDeletes.length) {
        await GCal.deleteEvent(cal, state.pendingDeletes[0]);
        state.pendingDeletes.shift();
        persist();
      }
      for (const { obj, body } of pendingChanges()) {
        if (body) {
          const ev = await GCal.upsertEvent(cal, obj.gcalEventId, body);
          Object.assign(obj, { gcalEventId: ev.id, gcalSig: sig(body), gcalUpdated: ev.updated });
        } else {
          await GCal.deleteEvent(cal, obj.gcalEventId);
          Object.assign(obj, { gcalEventId: null, gcalSig: null, gcalUpdated: null });
        }
        persist();
      }
      await pullVisible();
    } catch (e) {
      syncError = e.message;
      if (e.status === 401) GCal.expire();
    } finally {
      syncing = false;
      updateSyncStatus();
      if (syncAgain) { syncAgain = false; scheduleSync(300); }
    }
  }

  function visibleRange() {
    if (view === 'month') return monthRange();
    const start = parseYmd(currentWeek);
    return [start, addDays(start, 7)];
  }

  async function pullVisible() {
    if (!GCal.isConnected()) return;
    const [from, to] = visibleRange();
    const items = await GCal.listEvents(state.settings.calendarId, from, to, { showDeleted: true });
    const byDay = {};
    let changed = false;
    for (const ev of items) {
      const priv = (ev.extendedProperties && ev.extendedProperties.private) || {};
      const task = priv.weeklyCompassTaskId && taskById(priv.weeklyCompassTaskId);
      const goal = priv.weeklyCompassGoalId && goalById(priv.weeklyCompassGoalId);
      if (task) { changed = applyRemoteTask(task, ev) || changed; continue; }
      if (goal) { changed = applyRemoteGoal(goal, ev) || changed; continue; }
      if (ev.status === 'cancelled') continue;
      const day = eventDay(ev);
      (byDay[day] = byDay[day] || []).push(ev);
    }
    for (let d = new Date(from); d < to; d = addDays(d, 1)) eventsByDay[ymd(d)] = byDay[ymd(d)] || [];
    if (changed) persist();
    if (changed || view === 'week' || view === 'month') safeRender();
  }

  function applyRemoteTask(t, ev) {
    if (ev.id !== t.gcalEventId || ev.updated === t.gcalUpdated) return false;
    if (t.gcalSig !== sig(eventBody(t))) return false; // edited in the app since last sync: app wins
    if (ev.status === 'cancelled') {
      Object.assign(t, { date: null, start: '', gcalEventId: null, gcalSig: null, gcalUpdated: null });
      return true;
    }
    const summary = ev.summary || '';
    if (summary.replace(/^✓\s*/, '')) t.title = summary.replace(/^✓\s*/, '');
    t.done = summary.startsWith('✓');
    if (ev.start.dateTime) {
      const s = new Date(ev.start.dateTime);
      const e = new Date(ev.end.dateTime);
      t.date = ymd(s);
      t.start = `${pad(s.getHours())}:${pad(s.getMinutes())}`;
      t.duration = Math.max(5, Math.round((e - s) / 60000));
    } else {
      t.date = ev.start.date;
      t.start = '';
    }
    t.week = weekKey(parseYmd(t.date));
    Object.assign(t, { gcalUpdated: ev.updated, gcalSig: sig(eventBody(t)) });
    return true;
  }

  function applyRemoteGoal(g, ev) {
    if (ev.id !== g.gcalEventId || ev.updated === g.gcalUpdated) return false;
    if (g.gcalSig !== sig(goalEventBody(g))) return false;
    if (ev.status === 'cancelled') {
      Object.assign(g, { due: '', gcalEventId: null, gcalSig: null, gcalUpdated: null });
      return true;
    }
    if (ev.start.date) g.due = ev.start.date;
    Object.assign(g, { gcalUpdated: ev.updated, gcalSig: sig(goalEventBody(g)) });
    return true;
  }

  // Avoid re-rendering under someone who is typing.
  function safeRender() {
    const a = document.activeElement;
    if (a && $('#view').contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    render();
  }

  function refreshVisible() {
    if (!GCal.isConnected()) return;
    pullVisible().catch((e) => { syncError = e.message; updateSyncStatus(); });
  }

  function updateSyncStatus() {
    const el = $('#sync-status');
    if (!el) return;
    const n = pendingCount();
    let text;
    let cls;
    if (!GCal.isConnected()) {
      if (state.settings.gcalLinked) { text = n ? `Reconnect calendar · ${n} waiting` : 'Reconnect calendar'; cls = 'warn'; }
      else { text = 'Connect Google Calendar'; cls = 'off'; }
    } else if (syncing) { text = 'Syncing…'; cls = 'busy'; }
    else if (syncError) { text = 'Sync failed · retry'; cls = 'warn'; }
    else if (n) { text = `${n} to sync`; cls = 'busy'; }
    else { text = '✓ Synced with Google'; cls = 'ok'; }
    el.textContent = text;
    el.title = syncError || 'Google Calendar sync';
    el.className = `btn small sync-status ${cls}`;
  }

  async function connectCalendar() {
    if (!state.settings.clientId) {
      view = 'settings';
      render();
      toast('Add your Google OAuth Client ID to connect.');
      return;
    }
    try {
      await GCal.connect(state.settings.clientId);
      state.settings.gcalLinked = true;
      persist();
      toast('Connected. Syncing with Google Calendar…');
      render();
      await syncNow();
    } catch (e) {
      toast(e.message);
      updateSyncStatus();
    }
  }

  function exportIcs() {
    const scheduled = weekTasks().filter((t) => t.date);
    if (!scheduled.length) { toast('Schedule some tasks on days first.'); return; }
    const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const compact = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Weekly Compass//EN', 'CALSCALE:GREGORIAN'];
    scheduled.forEach((t) => {
      const b = eventBody(t);
      lines.push('BEGIN:VEVENT', `UID:${t.id}@weekly-compass`, `DTSTAMP:${stamp}`);
      if (t.start) {
        const [h, m] = t.start.split(':').map(Number);
        const start = parseYmd(t.date);
        start.setHours(h, m, 0, 0);
        const utc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
        lines.push(`DTSTART:${utc(start)}`, `DTEND:${utc(new Date(start.getTime() + t.duration * 60000))}`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${compact(parseYmd(b.start.date))}`, `DTEND;VALUE=DATE:${compact(parseYmd(b.end.date))}`);
      }
      lines.push(`SUMMARY:${icsEsc(t.title)}`, `DESCRIPTION:${icsEsc(b.description)}`, `CATEGORIES:${icsEsc(taskRole(t).name)}`, 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    download(`weekly-compass-${currentWeek}.ics`, lines.join('\r\n'), 'text/calendar');
  }

  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- other actions ----------
  function rollover() {
    const next = ymd(addDays(parseYmd(currentWeek), 7));
    const open = weekTasks().filter((t) => !t.done);
    if (!open.length) { toast('Nothing unfinished this week.'); return; }
    if (!confirm(`Move ${open.length} unfinished task(s) to next week's big rock tray?`)) return;
    open.forEach((t) => { t.week = next; t.date = null; t.start = ''; });
    save();
    render();
    toast(`Moved ${open.length} task(s) to next week.`);
  }

  function setWeekStart(n) {
    state.settings.weekStartsOn = n;
    state.tasks.forEach((t) => { t.week = weekKey(t.date ? parseYmd(t.date) : parseYmd(t.week)); });
    const remapped = {};
    Object.entries(state.weeks).forEach(([k, v]) => { remapped[weekKey(parseYmd(k))] = remapped[weekKey(parseYmd(k))] || v; });
    state.weeks = remapped;
    currentWeek = weekKey(parseYmd(currentWeek));
  }

  function shiftPeriod(n) {
    if (view === 'month') {
      const m = parseYmd(currentMonth);
      currentMonth = ymd(new Date(m.getFullYear(), m.getMonth() + n, 1));
    } else {
      currentWeek = ymd(addDays(parseYmd(currentWeek), 7 * n));
    }
    render();
    refreshVisible();
  }

  const ACTIONS = {
    'week-prev': () => shiftPeriod(-1),
    'week-next': () => shiftPeriod(1),
    'week-today': () => { currentWeek = weekKey(new Date()); currentMonth = firstOfMonth(new Date()); render(); refreshVisible(); },
    'goto-week': (el) => { currentWeek = weekKey(parseYmd(el.dataset.date)); view = 'week'; render(); refreshVisible(); },
    'new-role': () => editRole(null),
    'edit-role': (el) => editRole(roleById(el.dataset.id)),
    'new-goal': (el) => editGoal(null, { roleId: el.dataset.role }),
    'edit-goal': (el) => editGoal(goalById(el.dataset.id)),
    'new-task': (el) => editTask(null, { roleId: el.dataset.role, goalId: el.dataset.goal, date: el.dataset.date }),
    'edit-task': (el) => editTask(taskById(el.dataset.id)),
    'toggle-task': (el) => { const t = taskById(el.dataset.id); t.done = el.checked; save(); render(); },
    'toggle-action': (el) => {
      const t = taskById(el.dataset.id);
      const a = t.actions.find((x) => x.id === el.dataset.action);
      a.done = el.checked;
      if (t.actions.every((x) => x.done)) t.done = true;
      save(); render();
    },
    'add-action': () => {
      $('#action-rows', form).insertAdjacentHTML('beforeend', actionRow());
      $('#action-rows .action-edit:last-child input[type="text"]', form).focus();
    },
    'remove-action': (el) => el.closest('.action-edit').remove(),
    rollover,
    'start-planning': () => {
      state.planningDismissed = ymd(new Date());
      currentWeek = ymd(addDays(parseYmd(weekKey(new Date())), 7));
      view = 'compass';
      save(); render();
      toast('Planning next week. Start with your mission and roles.');
    },
    'dismiss-planning': () => { state.planningDismissed = ymd(new Date()); save(); render(); },
    'gcal-connect': connectCalendar,
    'sync-click': () => (GCal.isConnected() ? syncNow() : connectCalendar()),
    'gcal-disconnect': () => {
      GCal.disconnect();
      state.settings.gcalLinked = false;
      eventsByDay = {};
      persist(); render(); toast('Disconnected from Google Calendar.');
    },
    'export-ics': exportIcs,
    'export-json': () => download(`weekly-compass-backup-${ymd(new Date())}.json`, JSON.stringify(state, null, 2), 'application/json'),
    reset: () => {
      if (!confirm('Erase all roles, goals, tasks and settings in this browser?')) return;
      state = defaultState(); currentWeek = weekKey(new Date()); save(); render();
    },
  };

  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.tabs [data-view]');
    if (tab) {
      const from = view;
      view = tab.dataset.view;
      // Coming from a week, show the month containing it; otherwise stay on the month last viewed.
      if (view === 'month' && from === 'week') currentMonth = firstOfMonth(addDays(parseYmd(currentWeek), 3));
      render();
      refreshVisible();
      return;
    }
    const el = e.target.closest('[data-act]');
    if (!el || !ACTIONS[el.dataset.act]) return;
    if (el.tagName !== 'INPUT') e.preventDefault();
    ACTIONS[el.dataset.act](el);
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'mission') state.mission = el.value;
    else if (el.id === 'reflection') weekData().reflection = el.value;
    else return;
    save();
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.setting) {
      const key = el.dataset.setting;
      if (key === 'weekStartsOn') setWeekStart(Number(el.value));
      else if (key === 'planningDay') state.settings[key] = Number(el.value);
      else if (key === 'planningTime') state.settings[key] = el.value || '16:30';
      else if (key === 'defaultDuration') state.settings[key] = Math.max(5, Number(el.value) || 60);
      else state.settings[key] = el.value.trim() || ({ calendarId: 'primary', clientId: DEFAULT_CLIENT_ID }[key] || '');
      save();
      render();
    } else if (el.id === 'import-file' && el.files[0]) {
      el.files[0].text().then((txt) => {
        const data = JSON.parse(txt);
        if (!Array.isArray(data.roles) || !Array.isArray(data.tasks)) throw new Error('Not a Weekly Compass backup.');
        if (!confirm('Replace all current data with this backup?')) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        state = load(); currentWeek = weekKey(new Date()); render(); toast('Backup imported.');
      }).catch((err) => toast('Import failed: ' + err.message));
    }
  });

  // ---------- drag & drop scheduling ----------
  document.addEventListener('dragstart', (e) => {
    const card = e.target.closest && e.target.closest('[data-task][draggable="true"]');
    if (!card) return;
    e.dataTransfer.setData('text/plain', card.dataset.task);
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  document.addEventListener('dragend', (e) => {
    const card = e.target.closest && e.target.closest('[data-task]');
    if (card) card.classList.remove('dragging');
  });
  document.addEventListener('dragover', (e) => {
    const zone = e.target.closest && e.target.closest('.dropzone');
    if (!zone) return;
    e.preventDefault();
    zone.classList.add('over');
  });
  document.addEventListener('dragleave', (e) => {
    const zone = e.target.closest && e.target.closest('.dropzone');
    if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('over');
  });
  document.addEventListener('drop', (e) => {
    const zone = e.target.closest && e.target.closest('.dropzone');
    if (!zone) return;
    e.preventDefault();
    const t = taskById(e.dataTransfer.getData('text/plain'));
    if (!t) return;
    const date = zone.dataset.date || null;
    if (date && !t.date && !t.start) t.start = '09:00';
    if (!date) t.start = '';
    t.date = date;
    t.week = date ? weekKey(parseYmd(date)) : t.week;
    save();
    render();
  });

  // Keep both sides current while the app is open.
  setInterval(() => { if (!document.hidden) syncNow(); }, 5 * 60 * 1000);
  window.addEventListener('focus', () => syncNow());

  render();
})();
