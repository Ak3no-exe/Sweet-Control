// ── Storage ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'screen_time_entries';

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function toMinutes(h, m) { return h * 60 + m; }

function formatDuration(totalMinutes) {
  if (totalMinutes === 0) return '0m';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Returns "YYYY-Wnn" ISO week key for a date string "YYYY-MM-DD" */
function getWeekKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const tmp = new Date(d);
  tmp.setHours(12, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
  const yearStart = new Date(tmp.getFullYear(), 0, 1);
  const week = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  return `${tmp.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Returns the Monday of the ISO week containing dateStr */
function getMondayOfWeek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d;
}

/** "YYYY-MM-DD" for today */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Display label for a date string */
function displayDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Week label "Lun 16 – Dim 22 juin" */
function weekLabel(weekKey) {
  const [year, wNum] = weekKey.split('-W').map(Number);
  // Find first Monday of that ISO week
  const jan4 = new Date(year, 0, 4);
  const mon = new Date(jan4);
  mon.setDate(jan4.getDate() + (wNum - 1) * 7 - (jan4.getDay() || 7) + 1);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `${fmt(mon)} – ${fmt(sun)} ${year}`;
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function showError(msg) {
  document.getElementById('form-error').textContent = msg;
  setTimeout(() => { document.getElementById('form-error').textContent = ''; }, 3000);
}

// ── Core: add entry ───────────────────────────────────────────────────────────
function addEntry() {
  const dateVal  = document.getElementById('entry-date').value;
  const hoursVal = parseInt(document.getElementById('entry-hours').value)   || 0;
  const minsVal  = parseInt(document.getElementById('entry-minutes').value) || 0;

  if (!dateVal)              return showError('Choisis une date.');
  if (hoursVal === 0 && minsVal === 0) return showError('Entre au moins 1 minute.');
  if (hoursVal > 23)         return showError('Les heures doivent être entre 0 et 23.');
  if (minsVal  > 59)         return showError('Les minutes doivent être entre 0 et 59.');

  const entries = loadEntries();

  // One entry per day — merge if already exists
  const idx = entries.findIndex(e => e.date === dateVal);
  if (idx !== -1) {
    if (!confirm(`Une entrée existe déjà pour le ${displayDate(dateVal)}. Remplacer ?`)) return;
    entries[idx].minutes = toMinutes(hoursVal, minsVal);
  } else {
    entries.push({ date: dateVal, minutes: toMinutes(hoursVal, minsVal) });
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  saveEntries(entries);

  document.getElementById('entry-hours').value   = '';
  document.getElementById('entry-minutes').value = '';

  render();
}

// ── Core: delete entry ────────────────────────────────────────────────────────
function deleteEntry(date) {
  const entries = loadEntries().filter(e => e.date !== date);
  saveEntries(entries);
  render();
}

// ── Core: clear all ───────────────────────────────────────────────────────────
function clearAll() {
  if (!confirm('Effacer toutes les données ?')) return;
  localStorage.removeItem(STORAGE_KEY);
  render();
}

// ── Render: stats ──────────────────────────────────────────────────────────────
function renderStats(entries) {
  const today = todayStr();
  const weekKey = getWeekKey(today);
  const thisWeek = entries.filter(e => getWeekKey(e.date) === weekKey);

  if (thisWeek.length === 0) {
    document.getElementById('stat-total').textContent = '—';
    document.getElementById('stat-avg').textContent   = '—';
    document.getElementById('stat-days').textContent  = '—';
    document.getElementById('stat-peak').textContent  = '—';
    return;
  }

  const total = thisWeek.reduce((s, e) => s + e.minutes, 0);
  const avg   = Math.round(total / thisWeek.length);
  const peak  = Math.max(...thisWeek.map(e => e.minutes));

  document.getElementById('stat-total').textContent = formatDuration(total);
  document.getElementById('stat-avg').textContent   = formatDuration(avg);
  document.getElementById('stat-days').textContent  = `${thisWeek.length}/7`;
  document.getElementById('stat-peak').textContent  = formatDuration(peak);
}

// ── Render: week bars ─────────────────────────────────────────────────────────
function renderWeekBars(entries) {
  const today   = todayStr();
  const monday  = getMondayOfWeek(today);
  const days    = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const weekKey = getWeekKey(today);
  const thisWeek = entries.filter(e => getWeekKey(e.date) === weekKey);
  const maxMin  = Math.max(...thisWeek.map(e => e.minutes), 1);

  const container = document.getElementById('week-bars');
  container.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds     = d.toISOString().slice(0, 10);
    const entry  = thisWeek.find(e => e.date === ds);
    const mins   = entry ? entry.minutes : 0;
    const pct    = mins ? Math.max((mins / maxMin) * 90, 6) : 0;
    const isToday = ds === today;

    const wrap = document.createElement('div');
    wrap.className = 'day-bar-wrap';

    const col = document.createElement('div');
    col.className = 'day-bar-col';

    const bar = document.createElement('div');
    bar.className = `bar${isToday ? ' today' : ''}${!entry ? ' empty' : ''}`;
    bar.style.height = `${pct}%`;
    bar.title = entry ? formatDuration(mins) : 'Pas de données';

    col.appendChild(bar);

    const label = document.createElement('span');
    label.className = 'day-label';
    label.textContent = days[i];

    const time = document.createElement('span');
    time.className = 'day-time';
    time.textContent = entry ? formatDuration(mins) : '';

    wrap.appendChild(col);
    wrap.appendChild(label);
    wrap.appendChild(time);
    container.appendChild(wrap);
  }
}

// ── Render: history ────────────────────────────────────────────────────────────
function renderHistory(entries) {
  const container = document.getElementById('history-list');
  container.innerHTML = '';

  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-state">Aucune donnée encore. Commence par ajouter une entrée !</p>';
    return;
  }

  // Group by week, most recent first
  const grouped = {};
  [...entries].reverse().forEach(e => {
    const wk = getWeekKey(e.date);
    if (!grouped[wk]) grouped[wk] = [];
    grouped[wk].push(e);
  });

  Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).forEach(([wk, wkEntries]) => {
    const total = wkEntries.reduce((s, e) => s + e.minutes, 0);
    const avg   = Math.round(total / wkEntries.length);

    const group = document.createElement('div');
    group.className = 'week-group';

    const heading = document.createElement('div');
    heading.className = 'week-heading';
    heading.innerHTML = `
      <span class="week-heading-label">${weekLabel(wk)}</span>
      <span class="week-avg">moy. ${formatDuration(avg)}/j</span>
    `;

    const entriesList = document.createElement('div');
    entriesList.className = 'week-entries';

    wkEntries.forEach(e => {
      const row = document.createElement('div');
      row.className = 'entry-row';
      row.innerHTML = `
        <span class="entry-date">${displayDate(e.date)}</span>
        <span class="entry-time">${formatDuration(e.minutes)}</span>
        <button class="entry-delete" title="Supprimer" onclick="deleteEntry('${e.date}')">✕</button>
      `;
      entriesList.appendChild(row);
    });

    group.appendChild(heading);
    group.appendChild(entriesList);
    container.appendChild(group);
  });
}

// ── Main render ───────────────────────────────────────────────────────────────
function render() {
  const entries = loadEntries();
  renderStats(entries);
  renderWeekBars(entries);
  renderHistory(entries);
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.getElementById('entry-date').value = todayStr();
render();
