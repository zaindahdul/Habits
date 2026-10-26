// Weekly habit tracker. Everything is saved in this browser's localStorage.
(() => {
  'use strict';

  // Edit this list to change your habits. type: 'check' | 'gym' | 'time'
  const HABITS = [
    { id: 'gym',      name: 'Gym',                 note: 'Lifting or cardio', type: 'gym' },
    { id: 'water',    name: 'Water',               note: '2 bottles',         type: 'check' },
    { id: 'nophone',  name: 'No phone before bed',                            type: 'check' },
    { id: 'creatine', name: 'Creatine',                                       type: 'check' },
    { id: 'noporn',   name: 'No porn',                                        type: 'check' },
    { id: 'wake',     name: 'Wake up before 9',                               type: 'check' },
    { id: 'study',    name: 'Study',               note: 'Hours & minutes',   type: 'time' },
  ];

  const WORKOUTS = {
    lifting: { label: 'Lifting', options: ['Arms', 'Chest', 'Back', 'Legs'] },
    cardio:  { label: 'Cardio',  options: ['Running', 'Swimming', 'Biking'] },
  };

  const STORAGE_KEY = 'habit-tracker:v1';
  const MAX_MINUTES = 24 * 60;

  const $ = id => document.getElementById(id);

  // ---------- Dates (local time, never UTC) ----------
  const pad = n => String(n).padStart(2, '0');
  const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const startOfToday = () => addDays(new Date(), 0);
  const startOfWeek = d => addDays(d, -((d.getDay() + 6) % 7)); // weeks start on Monday
  const fmtDate = (d, opts) => d.toLocaleDateString(undefined, opts);

  function fmtMinutes(total) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (!h) return `${m}m`;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  // ---------- Storage ----------
  // data = { 'YYYY-MM-DD': { water: true, gym: { type: 'lifting', focus: 'Chest' }, study: 90 } }
  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      warnNoStorage();
    }
  }

  function warnNoStorage() {
    $('note').textContent = "Your browser is blocking storage, so changes won't be kept after you close this page.";
    $('note').classList.add('warn');
  }

  let data = load();

  function dayData(key) {
    const entry = data[key];
    return entry && typeof entry === 'object' ? entry : {};
  }

  function setValue(key, id, value) {
    const entry = { ...dayData(key) };
    if (value) entry[id] = value;
    else delete entry[id];
    if (Object.keys(entry).length) data[key] = entry;
    else delete data[key];
    save();
  }

  function getWorkout(key, id) {
    const w = dayData(key)[id];
    const valid = w && Object.hasOwn(WORKOUTS, w.type) && WORKOUTS[w.type].options.includes(w.focus);
    return valid ? w : null;
  }

  function getMinutes(key, id) {
    const m = Math.round(Number(dayData(key)[id]));
    return m > 0 ? Math.min(m, MAX_MINUTES) : 0;
  }

  function isDone(key, habit) {
    if (habit.type === 'gym') return getWorkout(key, habit.id) !== null;
    if (habit.type === 'time') return getMinutes(key, habit.id) > 0;
    return dayData(key)[habit.id] === true;
  }

  // ---------- View state ----------
  let today = startOfToday();
  let weekStart = startOfWeek(today);
  let days = [];

  const isCurrentWeek = () => keyOf(weekStart) === keyOf(startOfWeek(today));

  function el(tag, props = {}, ...children) {
    const { attrs, dataset, ...rest } = props;
    const node = Object.assign(document.createElement(tag), rest);
    if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (dataset) Object.assign(node.dataset, dataset);
    node.append(...children.filter(c => c != null && c !== false));
    return node;
  }

  // ---------- Rendering ----------
  function render() {
    closePicker(false);

    days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const key = keyOf(date);
      return { date, key, isToday: key === keyOf(today), future: date > today };
    });

    const first = days[0].date;
    const last = days[6].date;
    const short = { month: 'short', day: 'numeric' };
    const withYear = { ...short, year: 'numeric' };
    const sameYear = first.getFullYear() === last.getFullYear();
    $('range').textContent = `${fmtDate(first, sameYear ? short : withYear)} – ${fmtDate(last, withYear)}`;
    $('next').disabled = isCurrentWeek();
    $('current').disabled = isCurrentWeek();

    const cellClass = d => [d.isToday && 'today', d.future && 'future'].filter(Boolean).join(' ');

    $('head').replaceChildren(
      el('th', { className: 'habit-col', scope: 'col' }, 'Habit'),
      ...days.map(d => el('th', { className: cellClass(d), scope: 'col' },
        el('span', { className: 'dow' }, fmtDate(d.date, { weekday: 'short' })),
        el('span', { className: 'dnum' }, d.date.getDate()),
      )),
      el('th', { className: 'sum-col', scope: 'col' }, 'Week'),
    );

    $('body').replaceChildren(...HABITS.map(habit => el('tr', {},
      el('th', { className: 'habit-col', scope: 'row' },
        el('span', { className: 'habit-name' }, habit.name),
        habit.note && el('span', { className: 'habit-note' }, habit.note),
      ),
      ...days.map(d => el('td', { className: cellClass(d) }, renderCell(habit, d))),
      el('td', { className: 'sum-col', dataset: { sum: habit.id } }),
    )));

    $('foot').replaceChildren(
      el('th', { className: 'habit-col', scope: 'row' }, 'Done'),
      ...days.map(d => el('td', { className: cellClass(d), dataset: { daySum: d.key } })),
      el('td', { className: 'sum-col' }),
    );

    updateStats();
    scrollToToday();
  }

  function renderCell(habit, d) {
    const label = `${habit.name}, ${fmtDate(d.date, { weekday: 'long', month: 'long', day: 'numeric' })}`;

    if (habit.type === 'gym') {
      const btn = el('button', {
        type: 'button',
        disabled: d.future,
        dataset: { key: d.key, habit: habit.id, label },
        attrs: { 'aria-haspopup': 'dialog', 'aria-expanded': 'false' },
      });
      paintWorkout(btn);
      return btn;
    }

    if (habit.type === 'time') {
      const total = getMinutes(d.key, habit.id);
      const input = (value, unit) => el('input', {
        type: 'text',
        className: 'time-in',
        value,
        disabled: d.future,
        attrs: { inputmode: 'numeric', maxlength: '2', placeholder: '0', autocomplete: 'off', 'aria-label': `${label}, ${unit}` },
      });
      return el('div', { className: total ? 'time filled' : 'time', dataset: { key: d.key, habit: habit.id } },
        input(total >= 60 ? String(Math.floor(total / 60)) : '', 'hours'),
        el('span', { className: 'unit' }, 'h'),
        input(total % 60 ? String(total % 60) : '', 'minutes'),
        el('span', { className: 'unit' }, 'm'),
      );
    }

    return el('input', {
      type: 'checkbox',
      className: 'check',
      checked: isDone(d.key, habit),
      disabled: d.future,
      dataset: { key: d.key, habit: habit.id },
      attrs: { 'aria-label': label },
    });
  }

  function paintWorkout(btn) {
    const w = getWorkout(btn.dataset.key, btn.dataset.habit);
    btn.className = `gym-btn ${w ? w.type : 'empty'}`;
    if (w) {
      btn.replaceChildren(
        el('span', { className: 'gym-type' }, WORKOUTS[w.type].label),
        el('span', { className: 'gym-focus' }, w.focus),
      );
    } else {
      btn.replaceChildren(el('span', { className: 'gym-plus', attrs: { 'aria-hidden': 'true' } }, '+'));
    }
    btn.setAttribute('aria-label', `${btn.dataset.label}: ${w ? `${WORKOUTS[w.type].label}, ${w.focus}` : 'not logged'}`);
  }

  function updateStats() {
    let done = 0;
    let possible = 0;

    for (const d of days) {
      const cell = document.querySelector(`[data-day-sum="${d.key}"]`);
      if (d.future) {
        cell.textContent = '';
        continue;
      }
      const count = HABITS.filter(h => isDone(d.key, h)).length;
      cell.textContent = `${count}/${HABITS.length}`;
      cell.classList.toggle('perfect', count === HABITS.length);
      done += count;
      possible += HABITS.length;
    }

    const pastDays = days.filter(d => !d.future);
    for (const habit of HABITS) {
      const cell = document.querySelector(`[data-sum="${habit.id}"]`);
      if (habit.type === 'time') {
        const total = pastDays.reduce((sum, d) => sum + getMinutes(d.key, habit.id), 0);
        cell.textContent = total ? fmtMinutes(total) : '—';
      } else {
        cell.textContent = `${pastDays.filter(d => isDone(d.key, habit)).length}/7`;
      }
    }

    const pct = possible ? Math.round((done / possible) * 100) : 0;
    $('bar-fill').style.width = `${pct}%`;
    $('progress-label').textContent = `${done} of ${possible} done · ${pct}%`;
  }

  function scrollToToday() {
    const wrap = $('table-wrap');
    const th = wrap.querySelector('thead th.today');
    const stickyWidth = wrap.querySelector('thead th.habit-col').offsetWidth;
    wrap.scrollLeft = th ? Math.max(0, th.offsetLeft - stickyWidth - 8) : 0;
  }

  // ---------- Checkboxes & study time ----------
  const tbody = $('body');

  function readMinutes(wrap) {
    const [hIn, mIn] = wrap.querySelectorAll('.time-in');
    const total = (parseInt(hIn.value, 10) || 0) * 60 + (parseInt(mIn.value, 10) || 0);
    return Math.min(total, MAX_MINUTES);
  }

  tbody.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('.check')) {
      setValue(t.dataset.key, t.dataset.habit, t.checked);
      updateStats();
    } else if (t.matches('.time-in')) {
      // Tidy up once you leave the field, e.g. "0h 90m" becomes "1h 30m".
      const wrap = t.closest('.time');
      const total = readMinutes(wrap);
      const [hIn, mIn] = wrap.querySelectorAll('.time-in');
      hIn.value = total >= 60 ? String(Math.floor(total / 60)) : '';
      mIn.value = total % 60 ? String(total % 60) : '';
    }
  });

  tbody.addEventListener('input', e => {
    const t = e.target;
    if (!t.matches('.time-in')) return;
    const digits = t.value.replace(/\D/g, '').slice(0, 2);
    if (digits !== t.value) t.value = digits;
    const wrap = t.closest('.time');
    const total = readMinutes(wrap);
    wrap.classList.toggle('filled', total > 0);
    setValue(wrap.dataset.key, wrap.dataset.habit, total);
    updateStats();
  });

  // Select the whole number when a time field is focused so typing replaces it.
  let selectOnMouseUp = null;
  tbody.addEventListener('pointerdown', e => {
    selectOnMouseUp = e.target.matches('.time-in') && document.activeElement !== e.target ? e.target : null;
  });
  tbody.addEventListener('focusin', e => {
    if (e.target.matches('.time-in')) e.target.select();
  });
  tbody.addEventListener('mouseup', e => {
    if (selectOnMouseUp && e.target === selectOnMouseUp) e.preventDefault();
    selectOnMouseUp = null;
  });

  // ---------- Workout picker ----------
  const picker = $('gym-pop');
  let anchor = null;
  let pickerType = 'lifting';

  function openPicker(btn) {
    closePicker(false);
    const w = getWorkout(btn.dataset.key, btn.dataset.habit);
    anchor = btn;
    pickerType = w ? w.type : 'lifting';
    btn.setAttribute('aria-expanded', 'true');
    picker.hidden = false;
    paintPicker();
    (picker.querySelector('.chip.selected') || picker.querySelector('.chip')).focus();
  }

  function closePicker(restoreFocus) {
    if (!anchor) return;
    const btn = anchor;
    anchor = null;
    picker.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (restoreFocus && btn.isConnected) btn.focus();
  }

  function paintPicker() {
    const w = getWorkout(anchor.dataset.key, anchor.dataset.habit);
    picker.dataset.type = pickerType;
    for (const b of $('gym-seg').children) {
      b.setAttribute('aria-pressed', String(b.dataset.type === pickerType));
    }
    $('gym-chips').replaceChildren(...WORKOUTS[pickerType].options.map(option => {
      const selected = Boolean(w && w.type === pickerType && w.focus === option);
      return el('button', {
        type: 'button',
        className: selected ? 'chip selected' : 'chip',
        dataset: { focus: option },
        attrs: { 'aria-pressed': String(selected) },
      }, option);
    }));
    $('gym-clear').hidden = !w;
    positionPicker();
  }

  function positionPicker() {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const w = picker.offsetWidth;
    const h = picker.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const gap = 6;
    const margin = 8;
    const left = Math.max(margin, Math.min(r.left + r.width / 2 - w / 2, vw - w - margin));
    let top = r.bottom + gap;
    if (top + h > vh - margin && r.top - gap - h >= margin) top = r.top - gap - h;
    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
  }

  function saveWorkout(value) {
    const btn = anchor;
    setValue(btn.dataset.key, btn.dataset.habit, value);
    paintWorkout(btn);
    updateStats();
    closePicker(true);
  }

  tbody.addEventListener('click', e => {
    const btn = e.target.closest('.gym-btn');
    if (!btn || btn.disabled) return;
    if (anchor === btn) closePicker(true);
    else openPicker(btn);
  });

  picker.addEventListener('click', e => {
    const seg = e.target.closest('.seg button');
    const chip = e.target.closest('.chip');
    if (seg) {
      pickerType = seg.dataset.type;
      paintPicker();
    } else if (chip) {
      saveWorkout({ type: pickerType, focus: chip.dataset.focus });
    } else if (e.target.closest('#gym-clear')) {
      saveWorkout(null);
    }
  });

  document.addEventListener('pointerdown', e => {
    if (anchor && !picker.contains(e.target) && !anchor.contains(e.target)) closePicker(false);
  });
  document.addEventListener('focusin', e => {
    if (anchor && !picker.contains(e.target) && e.target !== anchor) closePicker(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && anchor) closePicker(true);
  });
  window.addEventListener('resize', positionPicker);
  document.addEventListener('scroll', positionPicker, true);

  // ---------- Week navigation ----------
  $('prev').addEventListener('click', () => {
    weekStart = addDays(weekStart, -7);
    render();
  });
  $('next').addEventListener('click', () => {
    if (isCurrentWeek()) return;
    weekStart = addDays(weekStart, 7);
    render();
  });
  $('current').addEventListener('click', () => {
    weekStart = startOfWeek(today);
    render();
  });

  // Roll over to the new day (and new week) if the page is left open past midnight.
  function checkDate() {
    const now = startOfToday();
    if (keyOf(now) === keyOf(today)) return;
    const wasCurrent = isCurrentWeek();
    today = now;
    if (wasCurrent) weekStart = startOfWeek(today);
    render();
  }
  setInterval(checkDate, 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkDate();
  });

  // Keep multiple open tabs in sync.
  window.addEventListener('storage', e => {
    if (e.key !== null && e.key !== STORAGE_KEY) return;
    data = load();
    render();
  });

  try {
    localStorage.setItem(`${STORAGE_KEY}:test`, '1');
    localStorage.removeItem(`${STORAGE_KEY}:test`);
  } catch {
    warnNoStorage();
  }

  render();
})();
