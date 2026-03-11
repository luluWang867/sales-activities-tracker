/* ===================================================
   Sales Activities Tracker — App Logic
   SELF (Solar & Energy Loan Fund)
=================================================== */

// ===== CONSTANTS =====
const STORAGE = {
  yearlyGoals:  'sat_yearly_goals',
  monthlyGoals: 'sat_monthly_goals',
  dailyLogs:    'sat_daily_logs',
  contractors:  'sat_contractors',
};

const DEFAULT_YEARLY_GOALS = {
  loan_volume:  1000000,
  avg_loan_size: 15000,
  closed_loans: 67,
  applications: 134,
  leads:        268,
  calls:        536,
};

const DEFAULT_MONTHLY_GOALS = {
  loan_volume:   100000,
  avg_loan_size:  10000,
  closed_loans:   10,
  applications:   20,
  leads:          40,
  calls:          80,
  working_days:   22,
};

const DAILY_TARGETS = {
  calls:        10,
  leads:        6,
  applications: 3,
  loans_closed: 1,
};

const ACTIVITY_META = [
  { key: 'calls',        icon: '☎️',  label: 'Calls to Contractors', target: 10, unit: 'per day', hasNotes: false },
  { key: 'leads',        icon: '📥',  label: 'New Leads Identified',  target: 6,  unit: 'per day', hasNotes: false },
  { key: 'applications', icon: '📝',  label: 'Applications Submitted',target: 3,  unit: 'per day', hasNotes: false },
  { key: 'loans_closed', icon: '✅',  label: 'Loans Closed',          target: 1,  unit: 'per day', hasNotes: false },
  { key: 'pm_followups', icon: '🛠️', label: 'PM Follow-ups',         target: null,unit:'as needed',hasNotes: true  },
  { key: 'recruiting',   icon: '🔨',  label: 'Recruiting Contractors',target: null,unit:'1–2/wk',  hasNotes: true  },
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CONTRACTOR_STATUSES = ['contacted','follow-up','active','inactive'];
const STATUS_LABELS = { contacted:'Contacted', 'follow-up':'Follow-up', active:'Active', inactive:'Inactive' };
const STATUS_CLASSES = { contacted:'status-contacted', 'follow-up':'status-followup', active:'status-active', inactive:'status-inactive' };

// ===== STATE =====
const state = {
  view: 'dashboard',
  dailyDate: todayStr(),
  contractorMonth: new Date().getMonth(),
  contractorYear: new Date().getFullYear(),
  yearlyGoals: {},
  monthlyGoals: {},
  dailyLogs: {},
  contractors: [],
};

// ===== UTILITIES =====
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function parseDate(str) {
  const [y,m,d] = str.split('-').map(Number);
  return new Date(y, m-1, d);
}

function offsetDate(str, delta) {
  const d = parseDate(str);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDateDisplay(str) {
  const d = parseDate(str);
  return d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
}

function fmtMonthYear(month, year) {
  return `${MONTHS[month]} ${year}`;
}

function fmt$(n) {
  if (n === null || n === undefined || isNaN(n)) return '$0';
  if (n >= 1000000) return `$${(n/1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n/1000).toFixed(0)}K`;
  return `$${Number(n).toLocaleString()}`;
}

function pct(val, goal) {
  if (!goal) return 0;
  return Math.min(100, Math.round((val / goal) * 100));
}

function pctClass(p) {
  if (p >= 100) return 'pct-ok';
  if (p >= 60)  return 'pct-warn';
  return 'pct-bad';
}

function barColor(p) {
  if (p >= 100) return 'green';
  if (p >= 60)  return 'blue';
  if (p >= 30)  return 'orange';
  return 'red';
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// ===== DATA PERSISTENCE =====
function loadData() {
  state.yearlyGoals  = JSON.parse(localStorage.getItem(STORAGE.yearlyGoals))  || { ...DEFAULT_YEARLY_GOALS };
  state.monthlyGoals = JSON.parse(localStorage.getItem(STORAGE.monthlyGoals)) || { ...DEFAULT_MONTHLY_GOALS };
  state.dailyLogs    = JSON.parse(localStorage.getItem(STORAGE.dailyLogs))    || {};
  state.contractors  = JSON.parse(localStorage.getItem(STORAGE.contractors))  || [];
}

function save(key) {
  const map = {
    yearlyGoals:  () => localStorage.setItem(STORAGE.yearlyGoals,  JSON.stringify(state.yearlyGoals)),
    monthlyGoals: () => localStorage.setItem(STORAGE.monthlyGoals, JSON.stringify(state.monthlyGoals)),
    dailyLogs:    () => localStorage.setItem(STORAGE.dailyLogs,    JSON.stringify(state.dailyLogs)),
    contractors:  () => localStorage.setItem(STORAGE.contractors,  JSON.stringify(state.contractors)),
  };
  map[key] && map[key]();
}

function getLog(dateStr) {
  if (!state.dailyLogs[dateStr]) {
    state.dailyLogs[dateStr] = { calls:0, leads:0, applications:0, loans_closed:0, pm_followups:0, pm_notes:'', recruiting:0, rec_notes:'', loan_volume:0 };
  }
  return state.dailyLogs[dateStr];
}

// ===== PROGRESS AGGREGATION =====
function getMonthProgress(year, month) {
  const days = getDaysInMonth(year, month);
  const totals = { calls:0, leads:0, applications:0, loans_closed:0, pm_followups:0, recruiting:0, loan_volume:0 };
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const log = state.dailyLogs[key];
    if (log) {
      totals.calls        += Number(log.calls)        || 0;
      totals.leads        += Number(log.leads)        || 0;
      totals.applications += Number(log.applications) || 0;
      totals.loans_closed += Number(log.loans_closed) || 0;
      totals.pm_followups += Number(log.pm_followups) || 0;
      totals.recruiting   += Number(log.recruiting)   || 0;
      totals.loan_volume  += Number(log.loan_volume)  || 0;
    }
  }
  return totals;
}

function getYearProgress(year) {
  const totals = { calls:0, leads:0, applications:0, loans_closed:0, loan_volume:0 };
  for (const key of Object.keys(state.dailyLogs)) {
    if (!key.startsWith(String(year))) continue;
    const log = state.dailyLogs[key];
    if (log) {
      totals.calls        += Number(log.calls)        || 0;
      totals.leads        += Number(log.leads)        || 0;
      totals.applications += Number(log.applications) || 0;
      totals.loans_closed += Number(log.loans_closed) || 0;
      totals.loan_volume  += Number(log.loan_volume)  || 0;
    }
  }
  return totals;
}

function getContractorsForMonth(year, month) {
  return state.contractors.filter(c => {
    if (!c.contacted_on) return false;
    const d = new Date(c.contacted_on + 'T00:00:00');
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

// ===== NAVIGATION =====
function navigate(view) {
  state.view = view;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  const titles = { dashboard:'Dashboard', daily:'Daily Log', contractors:'Contractors', goals:'Goals' };
  document.getElementById('pageTitle').textContent = titles[view] || view;
  renderView();
}

// ===== RENDER ROUTER =====
function renderView() {
  const el = document.getElementById('mainContent');
  const actions = document.getElementById('topbarActions');
  actions.innerHTML = '';
  if (state.view === 'dashboard')   { el.innerHTML = renderDashboard(); }
  if (state.view === 'daily')       { el.innerHTML = renderDailyLog();   attachDailyEvents(); }
  if (state.view === 'contractors') { el.innerHTML = renderContractors(); attachContractorEvents(); }
  if (state.view === 'goals')       { el.innerHTML = renderGoals(); attachGoalEvents(); }
}

// ===== DASHBOARD =====
function renderDashboard() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const mp = getMonthProgress(year, month);
  const yp = getYearProgress(year);
  const mg = state.monthlyGoals;
  const yg = state.yearlyGoals;

  const todayLog = state.dailyLogs[todayStr()] || {};
  const todayItems = [
    { icon:'☎️', label:'Calls',  val: todayLog.calls || 0 },
    { icon:'📥', label:'Leads',  val: todayLog.leads || 0 },
    { icon:'📝', label:'Apps',   val: todayLog.applications || 0 },
    { icon:'✅', label:'Loans',  val: todayLog.loans_closed || 0 },
  ];

  const monthRows = [
    { icon:'☎️', label:'Calls to Contractors', val: mp.calls,        goal: mg.calls,       fmtVal: mp.calls,        fmtGoal: mg.calls },
    { icon:'📥', label:'New Leads',             val: mp.leads,        goal: mg.leads,       fmtVal: mp.leads,        fmtGoal: mg.leads },
    { icon:'📝', label:'Applications',          val: mp.applications, goal: mg.applications,fmtVal: mp.applications, fmtGoal: mg.applications },
    { icon:'✅', label:'Loans Closed',          val: mp.loans_closed, goal: mg.closed_loans,fmtVal: mp.loans_closed, fmtGoal: mg.closed_loans },
    { icon:'💰', label:'Loan Volume',           val: mp.loan_volume,  goal: mg.loan_volume, fmtVal: fmt$(mp.loan_volume), fmtGoal: fmt$(mg.loan_volume) },
  ];

  const yearRows = [
    { icon:'☎️', label:'Calls to Contractors', val: yp.calls,        goal: yg.calls,       fmtVal: yp.calls,        fmtGoal: yg.calls },
    { icon:'📥', label:'New Leads',             val: yp.leads,        goal: yg.leads,       fmtVal: yp.leads,        fmtGoal: yg.leads },
    { icon:'📝', label:'Applications',          val: yp.applications, goal: yg.applications,fmtVal: yp.applications, fmtGoal: yg.applications },
    { icon:'✅', label:'Loans Closed',          val: yp.loans_closed, goal: yg.closed_loans,fmtVal: yp.loans_closed, fmtGoal: yg.closed_loans },
    { icon:'💰', label:'Loan Volume',           val: yp.loan_volume,  goal: yg.loan_volume, fmtVal: fmt$(yp.loan_volume), fmtGoal: fmt$(yg.loan_volume) },
  ];

  function progressRowsHtml(rows) {
    return rows.map(r => {
      const p = pct(r.val, r.goal);
      return `
      <div class="progress-row">
        <div class="progress-label"><span class="progress-label-icon">${r.icon}</span>${r.label}</div>
        <div class="progress-track"><div class="progress-fill ${barColor(p)}" style="width:${p}%"></div></div>
        <div class="progress-numbers">${r.fmtVal} / ${r.fmtGoal}</div>
        <div class="progress-pct ${pctClass(p)}">${p}%</div>
      </div>`;
    }).join('');
  }

  const contractorsThisMonth = getContractorsForMonth(year, month).length;

  return `
  <div class="today-summary">
    <h3>Today — ${fmtDateDisplay(todayStr())}</h3>
    <div class="today-pills">
      ${todayItems.map(i => `<div class="today-pill">${i.icon} ${i.val} ${i.label}</div>`).join('')}
      ${todayLog.loan_volume ? `<div class="today-pill">💰 ${fmt$(todayLog.loan_volume)}</div>` : ''}
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat-card" style="--stat-color:#7DC245">
      <div class="stat-label">Calls This Month</div>
      <div class="stat-value">${mp.calls}</div>
      <div class="stat-meta">Goal: ${mg.calls} <span class="stat-badge ${mp.calls >= mg.calls ? 'badge-success' : 'badge-warning'}">${pct(mp.calls, mg.calls)}%</span></div>
    </div>
    <div class="stat-card" style="--stat-color:#3281B7">
      <div class="stat-label">Leads This Month</div>
      <div class="stat-value">${mp.leads}</div>
      <div class="stat-meta">Goal: ${mg.leads} <span class="stat-badge ${mp.leads >= mg.leads ? 'badge-success' : 'badge-info'}">${pct(mp.leads, mg.leads)}%</span></div>
    </div>
    <div class="stat-card" style="--stat-color:#023E66">
      <div class="stat-label">Applications</div>
      <div class="stat-value">${mp.applications}</div>
      <div class="stat-meta">Goal: ${mg.applications} <span class="stat-badge ${mp.applications >= mg.applications ? 'badge-success' : 'badge-warning'}">${pct(mp.applications, mg.applications)}%</span></div>
    </div>
    <div class="stat-card" style="--stat-color:#E3A008">
      <div class="stat-label">Loans Closed</div>
      <div class="stat-value">${mp.loans_closed}</div>
      <div class="stat-meta">Goal: ${mg.closed_loans} <span class="stat-badge ${mp.loans_closed >= mg.closed_loans ? 'badge-success' : 'badge-danger'}">${pct(mp.loans_closed, mg.closed_loans)}%</span></div>
    </div>
  </div>

  <div class="dashboard-grid">
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">📅 ${fmtMonthYear(month, year)} Progress</div>
          <div class="card-subtitle">Monthly goals vs actual</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="navigate('daily')">Log Today →</button>
      </div>
      <div class="card-body">
        <div class="progress-rows">${progressRowsHtml(monthRows)}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">📆 ${year} Yearly Progress</div>
          <div class="card-subtitle">Annual goals vs actual</div>
        </div>
      </div>
      <div class="card-body">
        <div class="progress-rows">${progressRowsHtml(yearRows)}</div>
      </div>
    </div>
  </div>

  <div style="margin-top:20px">
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">🔨 Contractor Recruiting — ${fmtMonthYear(month, year)}</div>
          <div class="card-subtitle">Target: 4–8 per month</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="navigate('contractors')">View All →</button>
      </div>
      <div class="card-body">
        <div class="progress-rows">
          <div class="progress-row">
            <div class="progress-label"><span class="progress-label-icon">🔨</span>Contractors Recruited</div>
            <div class="progress-track"><div class="progress-fill ${barColor(pct(contractorsThisMonth, 8))}" style="width:${pct(contractorsThisMonth, 8)}%"></div></div>
            <div class="progress-numbers">${contractorsThisMonth} / 8</div>
            <div class="progress-pct ${pctClass(pct(contractorsThisMonth, 8))}">${pct(contractorsThisMonth, 8)}%</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ===== DAILY LOG =====
function renderDailyLog() {
  const log = getLog(state.dailyDate);
  const isToday = state.dailyDate === todayStr();

  function activityRowHtml(meta) {
    const val = Number(log[meta.key]) || 0;
    let progressHtml = '';
    if (meta.target) {
      const p = pct(val, meta.target);
      progressHtml = `
        <td class="activity-bar-cell">
          <div class="activity-bar-wrap"><div class="activity-bar-fill ${barColor(p)}" style="width:${p}%"></div></div>
          <div class="text-xs text-muted">${p}% of ${meta.target}</div>
        </td>`;
    } else {
      progressHtml = `<td class="text-xs text-muted">${meta.unit}</td>`;
    }

    const notesKey = meta.key === 'pm_followups' ? 'pm_notes' : 'rec_notes';
    const notesHtml = meta.hasNotes
      ? `<td><textarea class="notes-input" rows="2" placeholder="Notes..." data-key="${notesKey}">${log[notesKey] || ''}</textarea></td>`
      : `<td></td>`;

    return `
    <tr class="activity-row">
      <td>
        <div class="activity-name">
          <span class="activity-emoji">${meta.icon}</span>
          ${meta.label}
        </div>
        <div class="text-xs text-muted" style="margin-top:2px">${meta.unit}</div>
      </td>
      <td>${meta.target ? `<span class="target-badge">${meta.target}/day</span>` : `<span class="target-badge">${meta.unit}</span>`}</td>
      <td>
        <div class="counter-control">
          <button class="counter-btn" data-action="dec" data-key="${meta.key}">−</button>
          <div class="counter-display"><input type="number" min="0" value="${val}" data-key="${meta.key}" /></div>
          <button class="counter-btn" data-action="inc" data-key="${meta.key}">+</button>
        </div>
      </td>
      ${progressHtml}
      ${notesHtml}
    </tr>`;
  }

  return `
  <div class="date-nav">
    <button class="date-nav-btn" id="prevDay">◀</button>
    <div class="date-display" id="dateDisplay">${fmtDateDisplay(state.dailyDate)}</div>
    <button class="date-nav-btn" id="nextDay">▶</button>
    ${isToday ? '<span class="stat-badge badge-success" style="margin-left:4px">Today</span>' : `<button class="btn btn-ghost btn-sm" id="goToday">Go to Today</button>`}
    <button class="btn btn-ghost btn-sm" id="copyYesterday">📋 Copy Yesterday</button>
    <span class="save-status hidden" id="saveStatus">✓ Saved</span>
  </div>

  <div class="card mb-4">
    <div class="card-header" style="padding-bottom:12px">
      <div class="card-title">💰 Loan Volume Closed Today</div>
    </div>
    <div class="card-body" style="padding-top:8px">
      <div class="volume-input-wrap">
        <span class="currency-prefix">$</span>
        <input type="number" class="volume-input" id="loanVolume" placeholder="0" min="0" value="${log.loan_volume || ''}" />
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-body" style="padding:0; overflow:hidden; border-radius:var(--radius)">
      <table class="activity-table">
        <thead>
          <tr>
            <th>Activity</th>
            <th>Target</th>
            <th>Count</th>
            <th>Progress</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${ACTIVITY_META.map(activityRowHtml).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function attachDailyEvents() {
  document.getElementById('prevDay').onclick = () => { state.dailyDate = offsetDate(state.dailyDate, -1); renderView(); };
  document.getElementById('nextDay').onclick = () => { state.dailyDate = offsetDate(state.dailyDate,  1); renderView(); };
  const goToday = document.getElementById('goToday');
  if (goToday) goToday.onclick = () => { state.dailyDate = todayStr(); renderView(); };

  document.getElementById('copyYesterday').onclick = () => {
    const yesterday = offsetDate(state.dailyDate, -1);
    const yLog = state.dailyLogs[yesterday];
    if (!yLog) { showToast('No data for yesterday.'); return; }
    const cur = getLog(state.dailyDate);
    ['calls','leads','applications','loans_closed','pm_followups','recruiting'].forEach(k => { cur[k] = yLog[k] || 0; });
    save('dailyLogs');
    renderView();
    showToast('Copied from yesterday!');
  };

  document.getElementById('loanVolume').oninput = (e) => {
    getLog(state.dailyDate).loan_volume = Number(e.target.value) || 0;
    debounceSave();
  };

  // Counter buttons
  document.querySelectorAll('.counter-btn').forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.key;
      const log = getLog(state.dailyDate);
      if (btn.dataset.action === 'inc') log[key] = (Number(log[key]) || 0) + 1;
      if (btn.dataset.action === 'dec') log[key] = Math.max(0, (Number(log[key]) || 0) - 1);
      save('dailyLogs');
      const input = document.querySelector(`input[data-key="${key}"]`);
      if (input) input.value = log[key];
      refreshActivityRow(key, log[key]);
      showSaveStatus();
    };
  });

  // Counter inputs (manual entry)
  document.querySelectorAll('.counter-display input').forEach(input => {
    input.oninput = (e) => {
      const key = e.target.dataset.key;
      const val = Math.max(0, Number(e.target.value) || 0);
      getLog(state.dailyDate)[key] = val;
      refreshActivityRow(key, val);
      debounceSave();
    };
  });

  // Notes inputs
  document.querySelectorAll('.notes-input').forEach(textarea => {
    textarea.oninput = (e) => {
      getLog(state.dailyDate)[e.target.dataset.key] = e.target.value;
      debounceSave();
    };
  });
}

function refreshActivityRow(key, val) {
  const meta = ACTIVITY_META.find(m => m.key === key);
  if (!meta || !meta.target) return;
  const p = pct(val, meta.target);
  const fill = document.querySelector(`.activity-row:has([data-key="${key}"]) .activity-bar-fill`);
  const pctEl = document.querySelector(`.activity-row:has([data-key="${key}"]) .text-xs.text-muted`);
  if (fill) { fill.style.width = p + '%'; fill.className = `activity-bar-fill ${barColor(p)}`; }
  if (pctEl) pctEl.textContent = `${p}% of ${meta.target}`;
}

let saveTimer = null;
function debounceSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { save('dailyLogs'); showSaveStatus(); }, 600);
}

function showSaveStatus() {
  const el = document.getElementById('saveStatus');
  if (!el) return;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 2000);
}

// ===== CONTRACTORS =====
function renderContractors() {
  const { contractorMonth: month, contractorYear: year } = state;
  const monthContractors = getContractorsForMonth(year, month);
  const total = state.contractors.length;

  const statusCounts = {};
  monthContractors.forEach(c => { statusCounts[c.status] = (statusCounts[c.status]||0)+1; });

  function contractorRowHtml(c) {
    const statusClass = STATUS_CLASSES[c.status] || 'status-contacted';
    const statusLabel = STATUS_LABELS[c.status] || c.status;
    return `
    <tr data-id="${c.id}">
      <td style="font-weight:600">${c.name}</td>
      <td>${c.contacted_on ? new Date(c.contacted_on+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}</td>
      <td>${c.followup_date ? new Date(c.followup_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}</td>
      <td><span class="status-pill ${statusClass}">● ${statusLabel}</span></td>
      <td class="text-muted text-sm">${c.notes || '—'}</td>
      <td>
        <div class="action-btns">
          <button class="btn btn-ghost btn-sm btn-icon edit-contractor" data-id="${c.id}">✏️</button>
          <button class="btn btn-danger-ghost btn-sm btn-icon del-contractor" data-id="${c.id}">🗑️</button>
        </div>
      </td>
    </tr>`;
  }

  const tableHtml = monthContractors.length === 0
    ? `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">🔨</div><div class="empty-title">No contractors this month</div><div class="empty-sub">Add a contractor to get started.</div></div></td></tr>`
    : monthContractors.map(contractorRowHtml).join('');

  return `
  <div class="contractor-header">
    <div class="flex items-center gap-3">
      <div class="contractor-month-nav">
        <button class="date-nav-btn" id="prevMonth">◀</button>
        <div class="month-label">${fmtMonthYear(month, year)}</div>
        <button class="date-nav-btn" id="nextMonth">▶</button>
      </div>
    </div>
    <div class="flex items-center gap-2" style="flex-wrap:wrap">
      <div class="contractor-stats">
        <div class="cstat">This Month: <strong>${monthContractors.length}</strong> / 8</div>
        <div class="cstat">Total: <strong>${total}</strong></div>
      </div>
      <button class="btn btn-primary" id="addContractorBtn">+ Add Contractor</button>
    </div>
  </div>

  <div class="card">
    <div class="contractor-table-wrap">
      <table class="contractor-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Contacted On</th>
            <th>Follow-up Date</th>
            <th>Status</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${tableHtml}
        </tbody>
      </table>
    </div>
  </div>`;
}

function attachContractorEvents() {
  document.getElementById('prevMonth').onclick = () => {
    let { contractorMonth: m, contractorYear: y } = state;
    m--; if (m < 0) { m = 11; y--; }
    state.contractorMonth = m; state.contractorYear = y;
    renderView();
  };
  document.getElementById('nextMonth').onclick = () => {
    let { contractorMonth: m, contractorYear: y } = state;
    m++; if (m > 11) { m = 0; y++; }
    state.contractorMonth = m; state.contractorYear = y;
    renderView();
  };
  document.getElementById('addContractorBtn').onclick = () => openContractorModal(null);

  document.querySelectorAll('.edit-contractor').forEach(btn => {
    btn.onclick = () => {
      const c = state.contractors.find(x => x.id === btn.dataset.id);
      if (c) openContractorModal(c);
    };
  });
  document.querySelectorAll('.del-contractor').forEach(btn => {
    btn.onclick = () => {
      if (confirm('Delete this contractor?')) {
        state.contractors = state.contractors.filter(x => x.id !== btn.dataset.id);
        save('contractors');
        renderView();
        showToast('Contractor deleted.');
      }
    };
  });
}

function openContractorModal(existing) {
  const isEdit = !!existing;
  document.getElementById('modalTitle').textContent = isEdit ? 'Edit Contractor' : 'Add Contractor';
  document.getElementById('modalBody').innerHTML = `
  <div class="form-group">
    <label class="form-label">Contractor Name *</label>
    <input type="text" class="form-input" id="cName" placeholder="e.g. ABC Solar LLC" value="${existing?.name || ''}" />
  </div>
  <div class="form-row">
    <div class="form-group">
      <label class="form-label">Contacted On</label>
      <input type="date" class="form-input" id="cContacted" value="${existing?.contacted_on || ''}" />
    </div>
    <div class="form-group">
      <label class="form-label">Follow-up Date</label>
      <input type="date" class="form-input" id="cFollowup" value="${existing?.followup_date || ''}" />
    </div>
  </div>
  <div class="form-group">
    <label class="form-label">Status</label>
    <select class="form-select" id="cStatus">
      ${CONTRACTOR_STATUSES.map(s => `<option value="${s}" ${existing?.status===s?'selected':''}>${STATUS_LABELS[s]}</option>`).join('')}
    </select>
  </div>
  <div class="form-group">
    <label class="form-label">Notes</label>
    <textarea class="form-textarea" id="cNotes" placeholder="Any details...">${existing?.notes || ''}</textarea>
  </div>`;

  document.getElementById('modalFooter').innerHTML = `
  <button class="btn btn-ghost" id="modalCancelBtn">Cancel</button>
  <button class="btn btn-primary" id="modalSaveBtn">${isEdit ? 'Save Changes' : 'Add Contractor'}</button>`;

  showModal();

  document.getElementById('modalCancelBtn').onclick = hideModal;
  document.getElementById('modalSaveBtn').onclick = () => {
    const name = document.getElementById('cName').value.trim();
    if (!name) { alert('Please enter a contractor name.'); return; }
    const data = {
      id: existing?.id || uid(),
      name,
      contacted_on: document.getElementById('cContacted').value || null,
      followup_date: document.getElementById('cFollowup').value || null,
      status: document.getElementById('cStatus').value,
      notes: document.getElementById('cNotes').value.trim(),
    };
    if (isEdit) {
      const idx = state.contractors.findIndex(x => x.id === data.id);
      if (idx !== -1) state.contractors[idx] = data;
    } else {
      state.contractors.push(data);
    }
    save('contractors');
    hideModal();
    renderView();
    showToast(isEdit ? 'Contractor updated.' : 'Contractor added!');
  };
}

// ===== GOALS =====
function renderGoals() {
  const yg = state.yearlyGoals;
  const mg = state.monthlyGoals;

  function yearlyFields() {
    return `
    <div class="goal-row"><span class="goal-label">Total Loan Volume Goal</span><div style="display:flex;align-items:center;gap:6px"><span class="currency-prefix">$</span><input type="number" class="goal-input" id="yg-loan_volume" value="${yg.loan_volume || ''}" placeholder="1000000" /></div></div>
    <div class="goal-divider"></div>
    <div class="goal-row"><span class="goal-label">Average Loan Size</span><div style="display:flex;align-items:center;gap:6px"><span class="currency-prefix">$</span><input type="number" class="goal-input" id="yg-avg_loan_size" value="${yg.avg_loan_size || ''}" placeholder="15000" /></div></div>
    <div class="goal-divider"></div>
    <div class="goal-row"><span class="goal-label">Target Closed Loans</span><input type="number" class="goal-input" id="yg-closed_loans" value="${yg.closed_loans || ''}" placeholder="67" /></div>
    <div class="goal-divider"></div>
    <div class="goal-row"><span class="goal-label">Applications Needed <span class="goal-auto">auto</span></span><input type="number" class="goal-input" id="yg-applications" value="${yg.applications || ''}" placeholder="134" /></div>
    <div class="goal-divider"></div>
    <div class="goal-row"><span class="goal-label">Leads Needed <span class="goal-auto">auto</span></span><input type="number" class="goal-input" id="yg-leads" value="${yg.leads || ''}" placeholder="268" /></div>
    <div class="goal-divider"></div>
    <div class="goal-row"><span class="goal-label">Calls to Contractors <span class="goal-auto">auto</span></span><input type="number" class="goal-input" id="yg-calls" value="${yg.calls || ''}" placeholder="536" /></div>`;
  }

  function monthlyFields() {
    return `
    <div class="goal-row"><span class="goal-label">Total Loan Volume Goal</span><div style="display:flex;align-items:center;gap:6px"><span class="currency-prefix">$</span><input type="number" class="goal-input" id="mg-loan_volume" value="${mg.loan_volume || ''}" placeholder="100000" /></div></div>
    <div class="goal-divider"></div>
    <div class="goal-row"><span class="goal-label">Average Loan Size</span><div style="display:flex;align-items:center;gap:6px"><span class="currency-prefix">$</span><input type="number" class="goal-input" id="mg-avg_loan_size" value="${mg.avg_loan_size || ''}" placeholder="10000" /></div></div>
    <div class="goal-divider"></div>
    <div class="goal-row"><span class="goal-label">Target Closed Loans</span><input type="number" class="goal-input" id="mg-closed_loans" value="${mg.closed_loans || ''}" placeholder="10" /></div>
    <div class="goal-divider"></div>
    <div class="goal-row"><span class="goal-label">Applications Needed <span class="goal-auto">auto</span></span><input type="number" class="goal-input" id="mg-applications" value="${mg.applications || ''}" placeholder="20" /></div>
    <div class="goal-divider"></div>
    <div class="goal-row"><span class="goal-label">Leads Needed <span class="goal-auto">auto</span></span><input type="number" class="goal-input" id="mg-leads" value="${mg.leads || ''}" placeholder="40" /></div>
    <div class="goal-divider"></div>
    <div class="goal-row"><span class="goal-label">Calls to Contractors <span class="goal-auto">auto</span></span><input type="number" class="goal-input" id="mg-calls" value="${mg.calls || ''}" placeholder="80" /></div>
    <div class="goal-divider"></div>
    <div class="goal-row"><span class="goal-label">Working Days in Month</span><input type="number" class="goal-input" id="mg-working_days" value="${mg.working_days || ''}" placeholder="22" /></div>`;
  }

  return `
  <div class="goals-grid">
    <div class="goal-card">
      <div class="goal-card-header">
        <span class="goal-card-title">📆 Yearly Goals</span>
        <button class="btn btn-accent btn-sm" id="saveYearly">Save</button>
      </div>
      <div class="goal-fields">${yearlyFields()}</div>
      <div style="padding:0 20px 20px"><p class="text-xs text-muted">💡 Tip: Set your Target Closed Loans and the other fields will auto-calculate based on industry ratios (2× leads, 2× apps, 2× calls per loan).</p></div>
    </div>
    <div class="goal-card">
      <div class="goal-card-header">
        <span class="goal-card-title">📅 Monthly Goals</span>
        <button class="btn btn-accent btn-sm" id="saveMonthly">Save</button>
      </div>
      <div class="goal-fields">${monthlyFields()}</div>
      <div style="padding:0 20px 20px"><p class="text-xs text-muted">💡 Tip: Monthly goals auto-calculate from closed loans. Adjust directly if needed.</p></div>
    </div>
  </div>`;
}

function attachGoalEvents() {
  // Auto-calculate yearly
  ['yg-closed_loans', 'yg-avg_loan_size', 'yg-loan_volume'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.oninput = autoCalcYearly;
  });

  // Auto-calculate monthly
  ['mg-closed_loans', 'mg-avg_loan_size', 'mg-loan_volume'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.oninput = autoCalcMonthly;
  });

  document.getElementById('saveYearly').onclick = () => {
    const fields = ['loan_volume','avg_loan_size','closed_loans','applications','leads','calls'];
    fields.forEach(f => {
      const el = document.getElementById(`yg-${f}`);
      if (el) state.yearlyGoals[f] = Number(el.value) || 0;
    });
    save('yearlyGoals');
    showToast('✅ Yearly goals saved!');
  };

  document.getElementById('saveMonthly').onclick = () => {
    const fields = ['loan_volume','avg_loan_size','closed_loans','applications','leads','calls','working_days'];
    fields.forEach(f => {
      const el = document.getElementById(`mg-${f}`);
      if (el) state.monthlyGoals[f] = Number(el.value) || 0;
    });
    save('monthlyGoals');
    showToast('✅ Monthly goals saved!');
  };
}

function autoCalcYearly() {
  const closed = Number(document.getElementById('yg-closed_loans')?.value) || 0;
  if (closed > 0) {
    const appsEl = document.getElementById('yg-applications');
    const leadsEl = document.getElementById('yg-leads');
    const callsEl = document.getElementById('yg-calls');
    if (appsEl && !appsEl.matches(':focus')) appsEl.value = closed * 2;
    if (leadsEl && !leadsEl.matches(':focus')) leadsEl.value = closed * 4;
    if (callsEl && !callsEl.matches(':focus')) callsEl.value = closed * 8;
  }
}

function autoCalcMonthly() {
  const closed = Number(document.getElementById('mg-closed_loans')?.value) || 0;
  if (closed > 0) {
    const appsEl = document.getElementById('mg-applications');
    const leadsEl = document.getElementById('mg-leads');
    const callsEl = document.getElementById('mg-calls');
    if (appsEl && !appsEl.matches(':focus')) appsEl.value = closed * 2;
    if (leadsEl && !leadsEl.matches(':focus')) leadsEl.value = closed * 4;
    if (callsEl && !callsEl.matches(':focus')) callsEl.value = closed * 8;
  }
}

// ===== MODAL =====
function showModal() {
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function hideModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

// ===== TOAST =====
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
}

// ===== SIDEBAR TOGGLE =====
function initSidebarToggle() {
  document.getElementById('sidebarToggle').onclick = () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  };
}

// ===== INIT =====
function init() {
  loadData();

  // Sidebar date
  document.getElementById('sidebarDate').textContent = new Date().toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });

  // Nav listeners
  document.querySelectorAll('.nav-item').forEach(el => {
    el.onclick = (e) => { e.preventDefault(); navigate(el.dataset.view); };
  });

  // Modal close
  document.getElementById('modalClose').onclick = hideModal;
  document.getElementById('modalOverlay').onclick = (e) => { if (e.target === e.currentTarget) hideModal(); };

  initSidebarToggle();
  navigate('dashboard');
}

init();
