
const $ = id => document.getElementById(id);

const state = {
  token: null,
  user: null,
  page: 'dashboard',
  routines: [],
  sessionId: null,
  workoutStarted: null,
  authMode: 'login',
  heartbeat: null,
  deferredInstallPrompt: null
};


// ---------------------------------------------------------
// THEMES
// ---------------------------------------------------------

const COS_THEMES = ['forest', 'ocean', 'sunset', 'midnight', 'violet'];

function applyTheme(theme, persist = true) {
  const selected = COS_THEMES.includes(theme) ? theme : 'forest';
  document.documentElement.dataset.theme = selected;

  const appSelect = $('themeSelect');
  const authSelect = $('themeSelectAuth');
  if (appSelect) appSelect.value = selected;
  if (authSelect) authSelect.value = selected;

  const colors = {
    forest: '#0d120e',
    ocean: '#08151d',
    sunset: '#1b1112',
    midnight: '#0b0d18',
    violet: '#130f1d'
  };
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute('content', colors[selected]);

  if (persist) {
    try { localStorage.setItem('cos_theme', selected); } catch (e) {}
  }
}

function initThemes() {
  let saved = 'forest';
  try { saved = localStorage.getItem('cos_theme') || 'forest'; } catch (e) {}
  applyTheme(saved, false);

  ['themeSelect', 'themeSelectAuth'].forEach(id => {
    const control = $(id);
    if (control) control.addEventListener('change', () => applyTheme(control.value));
  });
}

// ---------------------------------------------------------
// PASSWORD VISIBILITY
// ---------------------------------------------------------

document.addEventListener('click', event => {
  const toggle = event.target.closest('[data-password-toggle]');
  if (!toggle) return;

  const input = $(toggle.dataset.passwordToggle);
  if (!input) return;

  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  toggle.textContent = reveal ? 'Hide' : 'Show';
  toggle.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
  toggle.setAttribute('aria-pressed', String(reveal));
});

// ---------------------------------------------------------
// PWA INSTALL
// ---------------------------------------------------------

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

function showIosInstallGuide() {
  $('modalRoot').innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal install-guide">
        <div class="install-guide-icon">＋</div>
        <div class="eyebrow">INSTALL ON IPHONE / IPAD</div>
        <h2>Add Calisthenics OS to Home Screen</h2>
        <ol class="install-steps">
          <li>Open this website in <b>Safari</b>.</li>
          <li>Tap the <b>Share</b> button <span class="share-symbol">↑</span>.</li>
          <li>Scroll down and choose <b>Add to Home Screen</b>.</li>
          <li>Tap <b>Add</b> to finish.</li>
        </ol>
        <p class="muted-block">iOS does not allow websites to trigger installation directly. Use Safari's Share menu to install the app.</p>
        <div class="modal-actions">
          <button class="btn primary" onclick="closeModal()">Got it</button>
        </div>
      </div>
    </div>`;
}

async function installApp() {
  if (isStandaloneApp()) {
    toast('Calisthenics OS is already installed.');
    return;
  }

  if (isIosDevice()) {
    showIosInstallGuide();
    return;
  }

  if (state.deferredInstallPrompt) {
    state.deferredInstallPrompt.prompt();
    const result = await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    if (result && result.outcome === 'accepted') {
      toast('Installation started.');
    }
    return;
  }

  toast('Use your browser menu and choose Install app or Add to Home Screen.');
}

function initPwaInstall() {
  const installButton = $('installAppBtn');
  if (!installButton) return;

  if (isStandaloneApp()) {
    installButton.classList.add('hidden');
    return;
  }

  installButton.addEventListener('click', installApp);

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    installButton.classList.remove('hidden');
  });

  window.addEventListener('appinstalled', () => {
    state.deferredInstallPrompt = null;
    installButton.classList.add('hidden');
    toast('Calisthenics OS installed.');
  });
}

async function rpc(fn, ...args) {
  const endpoint = window.COS_CONFIG?.API_URL;

  if (!endpoint || !/^https:\/\/.+/.test(endpoint)) {
    throw new Error('Configure your Cloudflare Worker API URL in js/config.js first.');
  }

  let payload;

  if (fn === 'api') {
    payload = { fn, action: args[0], payload: args[1] || {} };
  } else if (fn === 'getSessionUser' || fn === 'logoutUser') {
    payload = { fn, token: args[0] };
  } else {
    payload = { fn, payload: args[0] || {} };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Backend request failed');
    }

    return data.data;
  } finally {
    clearTimeout(timer);
  }
}

function api(action, payload = {}) {
  return rpc('api', action, { ...payload, token: state.token });
}

// Consistent button feedback for asynchronous actions.
async function runButtonAction(button, label, action) {
  if (!button || button.disabled) return;
  const original = button.innerHTML;
  button.disabled = true;
  button.classList.add('is-loading');
  button.setAttribute('aria-busy', 'true');
  button.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span><span>${esc(label || 'Please wait...')}</span>`;
  try { return await action(); }
  finally {
    if (button.isConnected) {
      button.innerHTML = original;
      button.disabled = false;
      button.classList.remove('is-loading');
      button.removeAttribute('aria-busy');
    }
  }
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

initThemes();
initPwaInstall();

function hideBoot() {
  const b = $('boot');
  b.style.opacity = '0';
  setTimeout(() => b.classList.add('hidden'), 450);
}

function showAuth() {
  hideBoot();
  $('authView').classList.remove('hidden');
  $('appView').classList.add('hidden');
}

function showApp() {
  hideBoot();
  $('authView').classList.add('hidden');
  $('appView').classList.remove('hidden');

  $('sideName').textContent = state.user.display_name || state.user.username;
  $('sideAvatar').textContent = (state.user.username || 'U')[0].toUpperCase();
  $('topAvatar').textContent = (state.user.username || 'U')[0].toUpperCase();

  startHeartbeat();
  navigate('dashboard');
}

// PASSWORD VALIDATION

const passwordInput = $('authPassword');
let passwordError = $('passwordError');

if (passwordInput && !passwordError) {
  passwordError = document.createElement('small');
  passwordError.id = 'passwordError';
  passwordError.className = 'field-error';
  passwordInput.insertAdjacentElement('afterend', passwordError);
}

if (passwordError) {
  passwordError.style.display = 'block';
  passwordError.style.fontSize = '12px';
  passwordError.style.marginTop = '6px';
  passwordError.style.color = '#ef4444';
}

function updatePasswordHint() {
  if (!passwordInput || !passwordError) return;

  const isRegister = state.authMode === 'register';
  const length = passwordInput.value.length;

  if (!isRegister || length === 0) {
    passwordError.textContent = '';
    return;
  }

  if (length < 8) {
    passwordError.textContent = 'Password must be at least 8 characters.';
    passwordError.style.color = '#ef4444';
  } else if (length > 128) {
    passwordError.textContent = 'Password cannot exceed 128 characters.';
    passwordError.style.color = '#ef4444';
  } else {
    passwordError.textContent = 'Password length looks good.';
    passwordError.style.color = '#16a34a';
  }
}

if (passwordInput) {
  passwordInput.addEventListener('input', updatePasswordHint);
}

function setAuthMode(mode) {
  state.authMode = mode;

  const reg = mode === 'register';

  $('authTitle').textContent = reg
    ? 'Create your account.'
    : 'Welcome back.';

  $('authSubtitle').textContent = reg
    ? 'Start building your strength journey.'
    : 'Sign in and keep your momentum.';

  $('authSubmit').innerHTML = reg
    ? 'Create account <span>→</span>'
    : 'Sign in <span>→</span>';

  $('confirmWrap').classList.toggle('hidden', !reg);
  $('switchText').textContent = reg
    ? 'Already a member?'
    : 'New here?';

  $('switchAuth').textContent = reg ? 'Sign in' : 'Create account';

  $('authPassword').autocomplete = reg
    ? 'new-password'
    : 'current-password';

  $('authError').textContent = '';

  updatePasswordHint();
}

$('switchAuth').addEventListener('click', () => {
  setAuthMode(state.authMode === 'login' ? 'register' : 'login');
});

$('authForm').addEventListener('submit', async e => {
  e.preventDefault();

  $('authError').textContent = '';

  const username = $('authUsername').value.trim();
  const password = $('authPassword').value;

  try {
    if (state.authMode === 'register') {
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters.');
      }

      if (password.length > 128) {
        throw new Error('Password cannot exceed 128 characters.');
      }

      if (password !== $('authConfirm').value) {
        throw new Error('Passwords do not match.');
      }
    }

    $('authSubmit').disabled = true;
    $('authSubmit').innerHTML = '<span class="btn-spinner" aria-hidden="true"></span><span>Please wait…</span>';
    $('authSubmit').disabled = true;

    let result;

    if (state.authMode === 'register') {
      result = await rpc('registerUser', { username, password });
    } else {
      result = await rpc('loginUser', { username, password });
    }

    state.token = result.token;
    state.user = result.user;

    sessionStorage.setItem('cos_token', state.token);

    showApp();

  } catch (err) {
    $('authError').textContent = err.message;

  } finally {
    $('authSubmit').disabled = false;
    setAuthMode(state.authMode);
  }
});

$('logoutBtn').addEventListener('click', async () => {
  try {
    await rpc('logoutUser', state.token);
  } catch (e) {}

  stopHeartbeat();
  sessionStorage.removeItem('cos_token');

  state.token = null;
  state.user = null;

  showAuth();
});

$('mainNav').addEventListener('click', e => {
  const b = e.target.closest('[data-page]');
  if (b) navigate(b.dataset.page);
});

$('mobileMenu').addEventListener('click', () => {
  $('appView').querySelector('.sidebar').classList.toggle('open');
});

function navigate(page) {
  state.page = page;

  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });

  $('appView').querySelector('.sidebar').classList.remove('open');

  const names = {
    dashboard: 'Dashboard',
    routines: 'My routines',
    workout: 'Workout log',
    progression: 'Progression',
    body: 'BMI & Body weight',
    consistency: 'Consistency',
    history: 'Workout history',
    friends: 'Friends',
    profile: 'Profile'
  };

  $('topTitle').textContent = names[page] || 'Dashboard';
  $('topEyebrow').textContent = page.toUpperCase();

  renderPage();
}

async function renderPage() {
  const root = $('pageContent');

  root.innerHTML = `<div class="loading-state">
    <div class="loading-spinner"></div>
    <div class="loading-copy"><b>Preparing your training space</b><span>Syncing your progress and routines…</span></div>
    <div class="loading-skeleton"><i></i><i></i><i></i></div>
  </div>`;

  try {
    if (state.page === 'dashboard') await renderDashboard(root);
    if (state.page === 'routines') await renderRoutines(root);
    if (state.page === 'workout') await renderWorkout(root);
    if (state.page === 'progression') await renderProgression(root);
    if (state.page === 'body') await renderBodyMetrics(root);
    if (state.page === 'consistency') await renderConsistency(root);
    if (state.page === 'history') await renderHistory(root);
    if (state.page === 'friends') await renderFriends(root);
    if (state.page === 'profile') await renderProfile(root);
  } catch (e) {
    root.innerHTML = '<div class="empty">Could not load this section: ' + esc(e.message) + '</div>';
  }
}

function dayName() {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
}

async function renderDashboard(root) {
  const d = await api('dashboard');

  state.routines = d.routines || [];

  // Everyday routines are selected client-side as a fallback for older Apps Script deployments.
  const r = d.todayRoutine || (d.routines || []).find(item =>
    String(item.assigned_day || '').toLowerCase() === 'everyday'
  );
  const done = new Set(d.completedExercises || []);
  const progressByName = new Map((d.exerciseProgress || []).map(x => [String(x.exercise_name || '').toLowerCase(), x]));
  const items = r?.exercises || [];
  const pct = items.length ? Math.round(done.size / items.length * 100) : 0;

  root.innerHTML = `<div class="welcome-row">
    <div>
      <div class="eyebrow">YOUR TRAINING SPACE · ${dayName().toUpperCase()}</div>
      <h1>Let's get stronger, ${esc(state.user.display_name || state.user.username)}.</h1>
      <p>Small reps. Consistent effort. Real progress.</p>
    </div>
    <button class="btn primary" onclick="navigate('workout')">Start workout →</button>
  </div>

  <div class="grid stats-grid">
    <div class="card stat-card"><div class="stat-head">WORKOUTS COMPLETED <span class="stat-icon">◎</span></div><div class="stat-value">${d.workouts}</div><div class="stat-note">All-time sessions</div></div>
    <div class="card stat-card"><div class="stat-head">TOTAL REPS <span class="stat-icon">↗</span></div><div class="stat-value">${d.totalReps}</div><div class="stat-note">Recorded repetitions</div></div>
    <div class="card stat-card"><div class="stat-head">SETS LOGGED <span class="stat-icon">▤</span></div><div class="stat-value">${d.totalSets}</div><div class="stat-note">Training volume</div></div>
    <div class="card stat-card"><div class="stat-head">FRIENDS ONLINE <span class="stat-icon">♧</span></div><div class="stat-value">${(d.friends?.friends || []).filter(f => f.state !== 'offline').length}</div><div class="stat-note">Your training circle</div></div>
  </div>

  <div class="grid content-grid">
    <div class="card">
      <div class="card-title">
        <div><h3>Today's routine</h3><p>${r ? esc(r.routine_name) + ' · ' + items.length + ' exercises' : 'No routine assigned for today'}</p></div>
        <button class="btn secondary small-btn" onclick="navigate('routines')">Edit routine</button>
      </div>
      ${r ? `
        <div class="progress-caption"><span>DAILY COMPLETION</span><span>${done.size}/${items.length} exercises · ${pct}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="routine-list" style="margin-top:14px">
          ${items.map((x, i) => {
            const p = progressByName.get(String(x.exercise_name || '').toLowerCase()) || {};
            const isDone = done.has(x.exercise_name) || p.completed === true;
            const targetSets = Number(x.target_sets) || 1;
            const loggedSets = Number(p.logged_sets) || 0;
            const actualReps = Number(p.actual_reps) || 0;
            const targetTotal = Number(p.target_total_reps) || 0;
            const exercisePct = targetTotal > 0 ? Math.min(100, Math.round(actualReps / targetTotal * 100)) : Math.min(100, Math.round(loggedSets / targetSets * 100));
            return `
            <div class="routine-row ${isDone ? 'done' : ''} routine-progress-row">
              <div class="routine-check">${isDone ? '✓' : i + 1}</div>
              <div class="routine-info"><b>${esc(x.exercise_name)}</b><small>${loggedSets}/${targetSets} sets · ${actualReps}${targetTotal ? ' / ' + targetTotal : ''} reps · ${exercisePct}%</small><div class="exercise-progress-track"><div class="exercise-progress-fill" style="width:${exercisePct}%"></div></div></div>
              <span class="pill ${isDone ? 'status-complete' : ''}">${isDone ? 'COMPLETED' : esc(x.category || 'IN PROGRESS')}</span>
            </div>`;
          }).join('')}
        </div>
        <div class="actions"><button class="btn primary" onclick="runButtonAction(this,'Starting...',()=>startRoutine('${esc(r.routine_id)}'))">Start this routine →</button></div>
      ` : '<div class="empty">Create a routine and assign it to ' + dayName() + '.</div>'}
    </div>

    <div class="card">
      <div class="card-title">
        <div><h3>Training circle</h3><p>See who's online and training</p></div>
        <button class="text-btn" onclick="navigate('friends')">View all</button>
      </div>
      ${(d.friends?.friends || []).slice(0, 5).map(friendHtml).join('') || '<div class="empty">Add friends to train together.</div>'}
      <div class="progress-caption"><span>CONSISTENCY</span><span>Keep showing up</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:100%"></div></div>
      <p class="muted-block">Your progress is built one session at a time. Track your sets to see meaningful trends.</p>
    </div>
  </div>`;
}

function friendHtml(f) {
  const cls = f.state === 'workout' ? 'workout' : f.state === 'online' ? 'online' : '';
  const status = f.state === 'workout'
    ? 'Working out · ' + (f.activity || 'Training')
    : f.state === 'online' ? 'Online' : 'Offline';

  return `<div class="friend-row">
    <div class="avatar">${esc(f.username[0].toUpperCase())}</div>
    <div class="friend-info"><b>${esc(f.username)}</b><small><span class="presence ${cls}"></span>${esc(status)}</small></div>
  </div>`;
}

async function renderRoutines(root) {
  const routines = await api('routines');
  state.routines = routines;

  root.innerHTML = `<div class="section-head">
    <div><div class="eyebrow">PLAN YOUR TRAINING</div><h1>My routines</h1><p>Build, edit and organize your weekly sessions.</p></div>
    <button class="btn primary" onclick="openRoutine()">+ New routine</button>
  </div>
  ${routines.length ? `<div class="grid routine-cards">
    ${routines.map(r => `<div class="card routine-card">
      <div class="card-title"><div><h3>${esc(r.routine_name)}</h3><p>${esc(r.assigned_day || 'Unscheduled')} · ${(r.exercises || []).length} exercises</p></div><span class="pill">ROUTINE</span></div>
      ${(r.exercises || []).map(x => `<div class="exercise-line"><span>${esc(x.exercise_name)}</span><span class="muted">${esc(x.target_sets)} × ${esc(x.target_reps)}</span></div>`).join('')}
      <div class="actions">
        <button class="btn secondary small-btn" onclick="openRoutine('${esc(r.routine_id)}')">Edit</button>
        <button class="btn secondary small-btn" onclick="runButtonAction(this,'Starting...',()=>startRoutine('${esc(r.routine_id)}'))">Start</button>
        <button class="btn danger small-btn" onclick="runButtonAction(this,'Deleting...',()=>removeRoutine('${esc(r.routine_id)}'))">Delete</button>
      </div>
    </div>`).join('')}
  </div>` : '<div class="empty">No routines yet. Create your first training plan.</div>'}`;
}

function openRoutine(id) {
  const r = state.routines.find(x => String(x.routine_id) === String(id));

  let ex = r?.exercises || [{
    exercise_name: 'Push-ups',
    category: 'Push',
    target_sets: 3,
    target_reps: '10',
    rest_seconds: 60,
    notes: ''
  }];

  $('modalRoot').innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
    <div class="modal">
      <h2>${r ? 'Edit routine' : 'Create routine'}</h2>
      <label class="field">Routine name<input id="rName" value="${esc(r?.routine_name || '')}" placeholder="e.g. Upper body"></label>
      <label class="field">Training day<select id="rDay">${['Unscheduled', 'Everyday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => `<option ${r?.assigned_day === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <label class="field">Description<input id="rDesc" value="${esc(r?.description || '')}" placeholder="Focus for this session"></label>
      <div class="card-title"><h3>Exercises</h3><button class="btn secondary small-btn" onclick="addExerciseEditor()">+ Add exercise</button></div>
      <div id="exerciseEditors">${ex.map(exerciseEditor).join('')}</div>
      <div class="modal-actions">
        <button class="btn secondary" onclick="closeModal()">Cancel</button>
        <button class="btn primary" onclick="runButtonAction(this,'Saving...',()=>saveRoutine('${esc(id || '')}'))">Save routine</button>
      </div>
    </div>
  </div>`;
}

function exerciseEditor(x = {}) {
  return `<div class="exercise-editor">
    <div class="exercise-editor-head"><b>Exercise</b><button class="text-btn" onclick="this.closest('.exercise-editor').remove()">Remove</button></div>
    <div class="form-grid">
      <label class="field">Name<input class="ex-name" value="${esc(x.exercise_name || '')}" placeholder="Pull-ups"></label>
      <label class="field">Category<input class="ex-cat" value="${esc(x.category || 'Pull')}" placeholder="Push / Pull / Core"></label>
      <label class="field">Sets<input class="ex-sets" type="number" min="1" max="20" value="${esc(x.target_sets || 3)}"></label>
      <label class="field">Reps / duration<input class="ex-reps" value="${esc(x.target_reps || '8')}" placeholder="8 or 30 sec"></label>
      <label class="field">Rest (seconds)<input class="ex-rest" type="number" value="${esc(x.rest_seconds || 60)}"></label>
      <label class="field">Notes<input class="ex-notes" value="${esc(x.notes || '')}" placeholder="Optional"></label>
    </div>
  </div>`;
}

function addExerciseEditor() {
  $('exerciseEditors').insertAdjacentHTML('beforeend', exerciseEditor());
}

async function saveRoutine(id) {
  const exercises = [...document.querySelectorAll('.exercise-editor')]
    .map(el => ({
      exercise_name: el.querySelector('.ex-name').value,
      category: el.querySelector('.ex-cat').value,
      target_sets: el.querySelector('.ex-sets').value,
      target_reps: el.querySelector('.ex-reps').value,
      rest_seconds: el.querySelector('.ex-rest').value,
      notes: el.querySelector('.ex-notes').value
    }))
    .filter(x => x.exercise_name.trim());

  try {
    await api('saveRoutine', {
      routine_id: id,
      routine_name: $('rName').value,
      assigned_day: $('rDay').value,
      description: $('rDesc').value,
      exercises
    });

    closeModal();
    toast('Routine saved');
    renderPage();
  } catch (e) {
    toast(e.message);
  }
}

async function removeRoutine(id) {
  if (!confirm('Delete this routine?')) return;

  try {
    await api('deleteRoutine', { routine_id: id });
    toast('Routine deleted');
    renderPage();
  } catch (e) {
    toast(e.message);
  }
}

function closeModal() {
  $('modalRoot').innerHTML = '';
}

async function startRoutine(id) {
  const r = state.routines.find(x => String(x.routine_id) === String(id)) ||
    (await api('routines')).find(x => String(x.routine_id) === String(id));

  if (!r) {
    toast('Routine not found');
    return;
  }

  state.activeRoutine = r;
  state.sessionId = null;
  state.workoutStarted = Date.now();

  await api('heartbeat', {
    state: 'workout',
    activity: 'Working out · ' + r.routine_name
  });

  navigate('workout');
}

async function renderWorkout(root) {
  const routines = state.routines.length ? state.routines : await api('routines');
  state.routines = routines;

  if (!state.activeRoutine) {
    root.innerHTML = `<div class="section-head">
      <div><div class="eyebrow">LOG YOUR TRAINING</div><h1>Workout log</h1><p>Select a routine or record a freestyle session.</p></div>
    </div>
    <div class="grid routine-cards">
      ${routines.map(r => `<div class="card">
        <h3>${esc(r.routine_name)}</h3>
        <p class="muted">${esc(r.assigned_day)} · ${(r.exercises || []).length} exercises</p>
        <button class="btn primary" onclick="runButtonAction(this,'Starting...',()=>startRoutine('${esc(r.routine_id)}'))">Start workout →</button>
      </div>`).join('')}
    </div>
    ${!routines.length ? '<div class="empty">Create a routine first to start tracking.</div>' : ''}`;

    return;
  }

  const r = state.activeRoutine;

  root.innerHTML = `<div class="section-head">
    <div><div class="eyebrow">SESSION IN PROGRESS</div><h1>${esc(r.routine_name)}</h1><p>Log each set as you complete it. Your records are saved to your account.</p></div>
    <button class="btn secondary" onclick="cancelWorkout()">Exit session</button>
  </div>
  <div class="card">
    <div class="card-title"><div><h3>Exercise tracker</h3><p>${(r.exercises || []).length} exercises · Save each completed set</p></div><span class="pill">LIVE SESSION</span></div>
    ${(r.exercises || []).map((x, i) => `<div class="workout-exercise">
      <h4>${i + 1}. ${esc(x.exercise_name)} <span class="muted">· ${esc(x.target_sets)} × ${esc(x.target_reps)}</span></h4>
      <div class="set-inputs">
        <input class="log-reps" type="number" min="0" placeholder="Actual reps">
        <input class="log-weight" type="number" min="0" step=".5" placeholder="Weight kg">
        <input class="log-hold" type="number" min="0" placeholder="Hold sec">
        <button class="btn primary small-btn" onclick="runButtonAction(this,'Saving set...',()=>logSet(this,'${esc(x.exercise_name)}','${esc(x.target_reps)}',${i + 1}))">Save set</button>
      </div>
    </div>`).join('')}
    <div class="actions"><button class="btn primary" onclick="runButtonAction(this,'Finishing...',()=>finishWorkout())">Finish workout ✓</button></div>
  </div>`;
}

async function logSet(btn, name, target, setNo) {
  const wrap = btn.closest('.workout-exercise');
  const reps = wrap.querySelector('.log-reps').value;
  const weight = wrap.querySelector('.log-weight').value;
  const hold = wrap.querySelector('.log-hold').value;
  const nextSetNo = Number(wrap.dataset.loggedSets || 0) + 1;

  if (!reps && !hold) {
    toast('Enter reps or hold duration first.');
    return;
  }

  try {
    const r = state.activeRoutine;

    const result = await api('saveSet', {
      session_id: state.sessionId,
      routine_id: r.routine_id,
      routine_name: r.routine_name,
      exercise_name: name,
      set_number: nextSetNo,
      target_reps: target,
      actual_reps: reps,
      weight,
      hold_seconds: hold
    });

    state.sessionId = result.session_id;
    wrap.dataset.loggedSets = String(nextSetNo);
    wrap.style.borderLeft = '3px solid var(--lime)';
    toast('Set saved');
  } catch (e) {
    toast(e.message);
  }
}

async function finishWorkout() {
  if (!state.sessionId) {
    toast('Log at least one set before finishing.');
    return;
  }

  try {
    await api('finishWorkout', { session_id: state.sessionId });
    await api('heartbeat', { state: 'online', activity: 'Online' });

    state.activeRoutine = null;
    state.sessionId = null;

    toast('Workout completed. Great work!');
    navigate('dashboard');
  } catch (e) {
    toast(e.message);
  }
}

async function cancelWorkout() {
  if (confirm('Exit this workout? Sets already saved will remain in your log.')) {
    state.activeRoutine = null;
    state.sessionId = null;

    await api('heartbeat', { state: 'online', activity: 'Online' });
    navigate('dashboard');
  }
}

async function renderProgression(root) {
  const data = await api('progressions');
  const skills = ['Pull-up', 'Muscle-up', 'Handstand', 'L-Sit', 'Front Lever', 'Planche'];

  root.innerHTML = `<div class="section-head">
    <div><div class="eyebrow">SKILL DEVELOPMENT</div><h1>Progression</h1><p>Track your current stage and personal milestones.</p></div>
    <button class="btn primary" onclick="openProgression()">+ Add skill</button>
  </div>
  <div class="grid routine-cards">
    ${data.map(p => `<div class="card">
      <div class="card-title"><h3>${esc(p.skill_name)}</h3><span class="pill">${esc(p.status)}</span></div>
      <h2>${esc(p.stage_name)}</h2>
      <p class="muted">Stage ${esc(p.stage_number)} · Best ${esc(p.best_reps)} reps · ${esc(p.best_hold_seconds)} sec hold</p>
      <p class="muted-block">${esc(p.notes || 'Keep practicing with good form.')}</p>
      <button class="btn secondary small-btn" onclick="openProgression('${esc(p.progression_id)}')">Edit progress</button>
    </div>`).join('')}
    ${!data.length ? '<div class="empty">No skills tracked yet. Add a skill to start recording your progression.</div>' : ''}
  </div>`;

  state.progressions = data;
}

function openProgression(id) {
  const p = (state.progressions || []).find(x => String(x.progression_id) === String(id)) || {};

  $('modalRoot').innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
    <div class="modal">
      <h2>${p.progression_id ? 'Update skill' : 'Track a skill'}</h2>
      <label class="field">Skill<input id="pSkill" value="${esc(p.skill_name || '')}" list="skillOptions" placeholder="Pull-up"></label>
      <datalist id="skillOptions">${['Pull-up', 'Muscle-up', 'Handstand', 'L-Sit', 'Front Lever', 'Back Lever', 'Planche'].map(s => `<option>${s}</option>`).join('')}</datalist>
      <label class="field">Current stage<input id="pStage" value="${esc(p.stage_name || '')}" placeholder="Negative pull-up"></label>
      <div class="form-grid">
        <label class="field">Stage number<input id="pNumber" type="number" value="${esc(p.stage_number || 1)}"></label>
        <label class="field">Status<select id="pStatus">${['Learning', 'Practicing', 'Achieved'].map(s => `<option ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="field">Best reps<input id="pReps" type="number" value="${esc(p.best_reps || 0)}"></label>
        <label class="field">Best hold (sec)<input id="pHold" type="number" value="${esc(p.best_hold_seconds || 0)}"></label>
      </div>
      <label class="field">Notes<textarea id="pNotes">${esc(p.notes || '')}</textarea></label>
      <div class="modal-actions">
        <button class="btn secondary" onclick="closeModal()">Cancel</button>
        <button class="btn primary" onclick="runButtonAction(this,'Updating...',()=>saveProgression('${esc(id || '')}'))">Save progress</button>
      </div>
    </div>
  </div>`;
}

async function saveProgression(id) {
  try {
    await api('saveProgression', {
      progression_id: id,
      skill_name: $('pSkill').value,
      stage_name: $('pStage').value,
      stage_number: $('pNumber').value,
      status: $('pStatus').value,
      best_reps: $('pReps').value,
      best_hold_seconds: $('pHold').value,
      notes: $('pNotes').value
    });

    closeModal();
    toast('Progress updated');
    renderPage();
  } catch (e) {
    toast(e.message);
  }
}

async function renderBodyMetrics(root) {
  const data = await api('bodyMetrics');
  const entries = data.entries || [];
  const latest = entries[entries.length - 1];
  const height = Number(data.height_cm) || 0;
  const bmi = Number(data.bmi) || (latest && height ? latest.weight_kg / Math.pow(height / 100, 2) : 0);
  const bmiLabel = !bmi ? 'Not available' : bmi < 18.5 ? 'Below healthy range' : bmi < 25 ? 'Healthy range' : bmi < 30 ? 'Above healthy range' : 'High BMI range';
  const bmiTone = bmi >= 18.5 && bmi < 25 ? 'good' : 'neutral';
  const maxPoints = entries.slice(-30);
  const weights = maxPoints.map(x => x.weight_kg);
  const min = weights.length ? Math.min(...weights) - 1 : 0;
  const max = weights.length ? Math.max(...weights) + 1 : 1;
  const coords = weights.map((v, i) => {
    const x = weights.length < 2 ? 50 : 24 + i * (552 / (weights.length - 1));
    const y = 150 - ((v - min) / Math.max(1, max - min)) * 112;
    return [x, y];
  });
  const points = coords.map(p => p.join(',')).join(' ');
  const chart = entries.length ? `<svg class="weight-chart" viewBox="0 0 600 190" role="img" aria-label="Daily body weight trend">
    <line x1="24" y1="38" x2="576" y2="38" class="chart-grid"/><line x1="24" y1="94" x2="576" y2="94" class="chart-grid"/><line x1="24" y1="150" x2="576" y2="150" class="chart-grid"/>
    ${coords.length > 1 ? `<polyline points="${points}" class="weight-line"/>` : ''}
    ${coords.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="4" class="weight-point"/>`).join('')}
    <text x="24" y="178" class="chart-label">${esc(maxPoints[0].date)}</text><text x="576" y="178" text-anchor="end" class="chart-label">${esc(maxPoints[maxPoints.length - 1].date)}</text>
  </svg>` : `<div class="empty">Your weight chart will appear after your first daily entry.</div>`;

  root.innerHTML = `<div class="section-head"><div><div class="eyebrow">BODY COMPOSITION TRACKER</div><h1>BMI & Body weight</h1><p>Record your weight daily and follow your long-term trend.</p></div></div>
    <div class="grid body-summary-grid">
      <div class="card body-bmi-card"><div class="stat-head">CURRENT BMI <span class="stat-icon">◉</span></div><div class="stat-value">${bmi ? bmi.toFixed(1) : '—'}</div><div class="stat-note">${esc(bmiLabel)}</div><p class="muted-block">BMI is a general screening measure, not a diagnosis.</p></div>
      <div class="card"><div class="stat-head">LATEST WEIGHT</div><div class="stat-value">${latest ? latest.weight_kg.toFixed(1) : '—'} <small>kg</small></div><div class="stat-note">${latest ? `Last recorded ${esc(latest.date)}` : 'No weight recorded yet'}</div></div>
      <div class="card"><div class="stat-head">HEIGHT</div><div class="stat-value">${height ? height.toFixed(1) : '—'} <small>cm</small></div><div class="stat-note">Set your height below</div></div>
    </div>
    <div class="grid body-content-grid">
      <div class="card"><div class="card-title"><div><h3>Daily weight trend</h3><p>Last 30 entries · ${entries.length} total records</p></div><span class="pill">KG</span></div>${chart}</div>
      <div class="card height-entry-card">
        <div class="card-title"><div><h3>Height</h3><p>Profile measurement · Save once, update only if it changes.</p></div><span class="pill">PROFILE</span></div>
        <form id="bodyHeightForm" class="body-form">
          <label class="field">Height (cm)<input id="bodyHeight" type="number" min="80" max="250" step="0.1" value="${height || ''}" placeholder="e.g. 172" required></label>
          <button class="btn primary full" id="saveHeightBtn" type="submit">${height ? 'Update height' : 'Save height'}</button>
        </form>
        <p class="muted-block">This value is saved to your profile and is not part of daily weight records.</p>
      </div>
      <div class="card weight-entry-card">
        <div class="card-title"><div><h3>Daily weight</h3><p>One entry per day. Saving again updates today's entry.</p></div><span class="pill">KG</span></div>
        <form id="bodyWeightForm" class="body-form">
          <label class="field">Weight (kg)<input id="bodyWeight" type="number" min="20" max="400" step="0.1" value="${latest && latest.date === new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Singapore'}) ? latest.weight_kg : ''}" placeholder="e.g. 68.5" required></label>
          <button class="btn primary full" id="saveBodyMetricsBtn" type="submit">Save today's weight</button>
        </form>
        <p class="muted-block">Only your body weight is recorded in the daily log.</p>
      </div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-title"><div><h3>Recent entries</h3><p>Your latest daily measurements</p></div></div>
      ${entries.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>DATE</th><th>WEIGHT</th><th>BMI</th></tr></thead><tbody>${entries.slice(-10).reverse().map(e => `<tr><td>${esc(e.date)}</td><td>${e.weight_kg.toFixed(1)} kg</td><td>${height ? (e.weight_kg / Math.pow(height/100,2)).toFixed(1) : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No entries yet.</div>'}
    </div>`;

  $('bodyHeightForm').addEventListener('submit', async event => {
    event.preventDefault();
    const btn = $('saveHeightBtn');
    if (btn.disabled) return;
    const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="mini-spinner"></span> Saving...';
    try {
      await api('saveHeight', { height_cm: $('bodyHeight').value });
      toast('Height saved to your profile');
      await renderBodyMetrics(root);
    } catch (error) {
      toast(error.message || 'Could not save height');
    } finally {
      if (btn.isConnected) { btn.disabled = false; btn.innerHTML = old; }
    }
  });

  $('bodyWeightForm').addEventListener('submit', async event => {
    event.preventDefault();
    const btn = $('saveBodyMetricsBtn');
    if (btn.disabled) return;
    const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="mini-spinner"></span> Saving...';
    try {
      await api('saveBodyMetrics', { weight_kg: $('bodyWeight').value });
      toast("Today's weight saved");
      await renderBodyMetrics(root);
    } catch (error) {
      toast(error.message || 'Could not save weight');
    } finally {
      if (btn.isConnected) { btn.disabled = false; btn.innerHTML = old; }
    }
  });
}



async function renderProfile(root) {
  const profile = await api('profile');
  const user = state.user || {};
  const dob = String(profile.date_of_birth || '');
  const calculatedAge = dob ? Math.max(0, Math.floor((Date.now() - new Date(dob + 'T00:00:00').getTime()) / 31557600000)) : (profile.age || '');
  root.innerHTML = `
    <div class="section-head"><div><div class="eyebrow">ACCOUNT & PERSONAL DETAILS</div><h1>Your profile</h1><p>Manage your account and personal information.</p></div></div>
    <div class="grid profile-layout">
      <section class="card">
        <div class="card-title"><div><h3>Account information</h3><p>Your login identity and security settings</p></div><span class="pill">ACCOUNT</span></div>
        <form id="profileNameForm" class="body-form">
          <label class="field">Display name<input id="profileDisplayName" maxlength="60" value="${esc(profile.display_name || user.display_name || '')}" placeholder="How should we call you?"></label>
          <button class="btn primary" type="submit" id="saveDisplayNameBtn">Save display name</button>
        </form>
        <div class="profile-divider"></div>
        <form id="usernameForm" class="body-form">
          <label class="field">Username<input id="profileUsername" minlength="3" maxlength="32" pattern="[a-zA-Z0-9_]{3,32}" value="${esc(user.username || '')}" required></label>
          <label class="field">Current password<input id="usernameCurrentPassword" type="password" autocomplete="current-password" required></label>
          <button class="btn secondary" type="submit" id="changeUsernameBtn">Change username</button>
        </form>
        <div class="profile-divider"></div>
        <form id="passwordForm" class="body-form">
          <label class="field">Current password<input id="oldPassword" type="password" autocomplete="current-password" required></label>
          <label class="field">New password<input id="newPassword" type="password" minlength="8" autocomplete="new-password" required></label>
          <label class="field">Confirm new password<input id="confirmNewPassword" type="password" minlength="8" autocomplete="new-password" required></label>
          <button class="btn secondary" type="submit" id="changePasswordBtn">Update password</button>
        </form>
        <div class="profile-divider"></div>
        <button class="btn danger" id="profileLogoutBtn" type="button">Log out</button>
      </section>
      <section class="card">
        <div class="card-title"><div><h3>Personal details</h3><p>Optional information stored in your private profile</p></div><span class="pill">PERSONAL</span></div>
        <form id="personalDetailsForm" class="body-form">
          <label class="field">Gender
            <select id="profileGender"><option value="">Prefer not to say</option><option value="Male" ${profile.gender==='Male'?'selected':''}>Male</option><option value="Female" ${profile.gender==='Female'?'selected':''}>Female</option></select>
          </label>
          <label class="field">Date of birth<input id="profileDob" type="date" value="${esc(dob)}"></label>
          <label class="field">Age (calculated from date of birth)<input id="profileAge" type="number" min="0" max="120" value="${esc(calculatedAge)}" readonly></label>
          <label class="field">Religion <input id="profileReligion" maxlength="60" value="${esc(profile.religion || '')}" placeholder="Optional"></label>
          <label class="field">Race / Ethnicity <input id="profileRace" maxlength="60" value="${esc(profile.race || '')}" placeholder="Optional"></label>
          <label class="field">Country <input id="profileCountry" maxlength="80" value="${esc(profile.country || '')}" placeholder="Country"></label>
          <button class="btn primary" type="submit" id="savePersonalBtn">Save personal details</button>
        </form>
      </section>
    </div>
    <section class="card profile-body-card">
      <div class="card-title"><div><h3>Body information</h3><p>Height is saved once; daily weight records stay in BMI & Body weight.</p></div><span class="pill">BODY</span></div>
      <div class="profile-body-stats">
        <div><small>HEIGHT</small><b>${Number(profile.height_cm) ? Number(profile.height_cm).toFixed(1)+' cm' : 'Not set'}</b></div>
        <div><small>BMI & WEIGHT</small><b><a href="#" id="goBodyMetrics">Open BMI tracker →</a></b></div>
      </div>
    </section>`;

  $('profileDob').addEventListener('change', () => {
    const v = $('profileDob').value;
    $('profileAge').value = v ? Math.max(0, Math.floor((Date.now() - new Date(v+'T00:00:00').getTime()) / 31557600000)) : '';
  });
  $('goBodyMetrics').addEventListener('click', e => { e.preventDefault(); navigate('body'); });

  $('profileNameForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('saveDisplayNameBtn');
    await runButtonAction(btn, 'Saving...', async () => {
      await api('saveProfile', { display_name: $('profileDisplayName').value });
      state.user.display_name = $('profileDisplayName').value;
      $('sideName').textContent = state.user.display_name || state.user.username;
      toast('Display name updated');
    }).catch(err => toast(err.message));
  });

  $('personalDetailsForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('savePersonalBtn');
    await runButtonAction(btn, 'Saving...', async () => {
      const dobValue = $('profileDob').value;
      await api('saveProfile', {
        gender: $('profileGender').value,
        date_of_birth: dobValue,
        age: $('profileAge').value,
        religion: $('profileReligion').value,
        race: $('profileRace').value,
        country: $('profileCountry').value
      });
      toast('Personal details saved');
    }).catch(err => toast(err.message));
  });

  $('usernameForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('changeUsernameBtn');
    await runButtonAction(btn, 'Updating...', async () => {
      const result = await rpc('changeUsername', {
        token: state.token,
        newUsername: $('profileUsername').value,
        currentPassword: $('usernameCurrentPassword').value
      });
      state.user.username = result.username;
      $('sideAvatar').textContent = result.username[0].toUpperCase();
      $('topAvatar').textContent = result.username[0].toUpperCase();
      $('usernameCurrentPassword').value = '';
      toast('Username updated');
    }).catch(err => toast(err.message));
  });

  $('passwordForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('changePasswordBtn');
    if ($('newPassword').value !== $('confirmNewPassword').value) {
      toast('New passwords do not match'); return;
    }
    await runButtonAction(btn, 'Updating...', async () => {
      await rpc('changePassword', {
        token: state.token,
        oldPassword: $('oldPassword').value,
        newPassword: $('newPassword').value
      });
      $('passwordForm').reset();
      toast('Password updated successfully');
    }).catch(err => toast(err.message));
  });

  $('profileLogoutBtn').addEventListener('click', async () => {
    try { await rpc('logoutUser', state.token); } catch (e) {}
    stopHeartbeat();
    sessionStorage.removeItem('cos_token');
    state.token = null; state.user = null;
    showAuth();
  });
}

async function renderConsistency(root) {
  const data = await api('consistency');
  const days = data.days || [];
  const maxSets = Math.max(1, ...days.map(d => Number(d.sets) || 0));
  const bars = days.map(d => {
    const height = d.active ? Math.max(8, Math.round((Number(d.sets) || 0) / maxSets * 100)) : 3;
    const label = new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return `<div class="consistency-bar-wrap" title="${esc(label)} · ${Number(d.sets)||0} sets · ${Number(d.reps)||0} reps">
      <div class="consistency-bar ${d.active ? 'is-active' : ''}" style="height:${height}%"></div>
    </div>`;
  }).join('');
  const heat = days.map(d => {
    const label = new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    const intensity = !d.active ? 'level-0' : d.sets >= 8 ? 'level-4' : d.sets >= 5 ? 'level-3' : d.sets >= 3 ? 'level-2' : 'level-1';
    return `<div class="consistency-heat ${intensity}" title="${esc(label)}: ${Number(d.sets)||0} sets, ${Number(d.reps)||0} reps"></div>`;
  }).join('');
  const recent = days.slice(-7).map(d => {
    const label = new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
    return `<div class="consistency-day-row"><span>${esc(label)}</span><span>${d.active ? `${Number(d.sets)||0} sets · ${Number(d.reps)||0} reps` : 'Rest day'}</span><b class="${d.active ? 'activity-on' : 'activity-off'}">${d.active ? 'ACTIVE' : '—'}</b></div>`;
  }).join('');

  root.innerHTML = `<div class="section-head">
    <div><div class="eyebrow">SHOW UP, TRACK PROGRESS</div><h1>Consistency</h1><p>Your training activity, active days and streaks — based on sets you actually log.</p></div>
    <button class="btn secondary" onclick="renderPage()">↻ Refresh</button>
  </div>
  <div class="grid stats-grid consistency-stats">
    <div class="card stat-card"><div class="stat-head">CURRENT STREAK <span class="stat-icon">🔥</span></div><div class="stat-value">${Number(data.currentStreak)||0}</div><div class="stat-note">Consecutive active days</div></div>
    <div class="card stat-card"><div class="stat-head">BEST STREAK <span class="stat-icon">✦</span></div><div class="stat-value">${Number(data.bestStreak)||0}</div><div class="stat-note">Your personal best</div></div>
    <div class="card stat-card"><div class="stat-head">ACTIVE DAYS <span class="stat-icon">▦</span></div><div class="stat-value">${Number(data.activeLast30)||0}<small class="consistency-denom">/30</small></div><div class="stat-note">Last 30 days</div></div>
    <div class="card stat-card"><div class="stat-head">SETS LOGGED <span class="stat-icon">▤</span></div><div class="stat-value">${Number(data.totalSets30)||0}</div><div class="stat-note">Last 30 days</div></div>
  </div>
  <div class="grid content-grid consistency-content">
    <div class="card">
      <div class="card-title"><div><h3>30-day activity</h3><p>Daily training volume · logged sets</p></div><span class="pill">LAST 30 DAYS</span></div>
      <div class="consistency-chart" role="img" aria-label="Bar chart showing logged sets for each of the last 30 days">${bars}</div>
      <div class="consistency-axis"><span>30 days ago</span><span>Today</span></div>
      <div class="consistency-legend"><span><i class="legend-dot active"></i> Activity recorded</span><span><i class="legend-dot"></i> No sets logged</span></div>
    </div>
    <div class="card">
      <div class="card-title"><div><h3>Activity summary</h3><p>Your last 7 days</p></div></div>
      <div class="consistency-week-summary"><b>${Number(data.activeLast7)||0}/7</b><span>active days this week</span></div>
      <div class="consistency-day-list">${recent}</div>
    </div>
  </div>
  <div class="card consistency-heat-card">
    <div class="card-title"><div><h3>Activity calendar</h3><p>Each square represents one day. More logged sets = stronger activity.</p></div></div>
    <div class="consistency-heatmap">${heat}</div>
    <div class="consistency-legend"><span>Less</span><i class="consistency-heat level-0"></i><i class="consistency-heat level-1"></i><i class="consistency-heat level-2"></i><i class="consistency-heat level-3"></i><i class="consistency-heat level-4"></i><span>More</span></div>
    <p class="muted-block consistency-note">A day counts as active when at least one workout set is saved. Starting a workout without logging a set does not count. Rest days are okay — consistency is about sustainable progress.</p>
  </div>`;
}


async function renderHistory(root) {
  const data = await api('history');

  root.innerHTML = `<div class="section-head">
    <div><div class="eyebrow">YOUR TRAINING RECORD</div><h1>Workout history</h1><p>Your saved workout sessions.</p></div>
  </div>
  <div class="card">
    ${data.length ? `<table class="table">
      <thead><tr><th>WORKOUT</th><th>STARTED</th><th>STATUS</th><th>DURATION</th></tr></thead>
      <tbody>${data.map(s => `<tr>
        <td>${esc(s.routine_name || 'Workout')}</td>
        <td>${new Date(s.started_at).toLocaleString()}</td>
        <td><span class="pill">${esc(s.status)}</span></td>
        <td>${Math.round((Number(s.duration_seconds) || 0) / 60)} min</td>
      </tr>`).join('')}</tbody>
    </table>` : '<div class="empty">Your completed sessions will appear here.</div>'}
  </div>`;
}

async function renderFriends(root) {
  const data = await api('friends');

  root.innerHTML = `<div class="section-head">
    <div><div class="eyebrow">TRAIN TOGETHER</div><h1>Friends</h1><p>Add people and see who's online or currently working out.</p></div>
  </div>
  <div class="grid content-grid">
    <div class="card">
      <div class="card-title"><div><h3>Your circle</h3><p>Live activity updates while friends are active</p></div></div>
      ${data.friends.map(friendHtml).join('') || '<div class="empty">No friends yet. Search by username to connect.</div>'}
    </div>
    <div class="card">
      <h3>Find people</h3>
      <p class="muted-block">Search for another Calisthenics OS username.</p>
      <div class="search-row">
        <input id="friendSearch" placeholder="Search username">
        <button class="btn primary" onclick="runButtonAction(this,'Searching...',()=>searchFriend())">Search</button>
      </div>
      <div id="friendResults"></div>
      <div class="card-title" style="margin-top:25px"><h3>Friend requests</h3></div>
      ${data.incoming.map(f => `<div class="request-row">
        <div class="avatar">${esc(f.username[0].toUpperCase())}</div>
        <b style="flex:1;font-size:12px">${esc(f.username)}</b>
        <button class="btn primary small-btn" onclick="runButtonAction(this,'Accepting...',()=>respondFriend('${esc(f.friendship_id)}',true))">Accept</button>
        <button class="btn secondary small-btn" onclick="runButtonAction(this,'Declining...',()=>respondFriend('${esc(f.friendship_id)}',false))">Decline</button>
      </div>`).join('') || '<p class="muted-block">No pending requests.</p>'}
    </div>
  </div>`;
}

async function searchFriend() {
  const q = $('friendSearch').value;

  try {
    const users = await api('searchUsers', { query: q });
    $('friendResults').innerHTML = users.map(u => `<div class="request-row">
      <b style="flex:1;font-size:12px">${esc(u.username)}</b>
      <button class="btn secondary small-btn" onclick="runButtonAction(this,'Adding...',()=>sendFriend('${esc(u.username)}'))">Add friend</button>
    </div>`).join('') || '<p class="muted-block">No matching users found.</p>';
  } catch (e) {
    toast(e.message);
  }
}

async function sendFriend(username) {
  try {
    const r = await api('addFriend', { username });
    toast(r.message);
    searchFriend();
  } catch (e) {
    toast(e.message);
  }
}

async function respondFriend(id, accept) {
  try {
    await api('respondFriend', { friendship_id: id, accept });
    toast(accept ? 'Friend request accepted' : 'Request declined');
    renderPage();
  } catch (e) {
    toast(e.message);
  }
}

function startHeartbeat() {
  stopHeartbeat();

  const beat = async () => {
    if (!state.token) return;

    try {
      const active = !!state.activeRoutine;

      await api('heartbeat', {
        state: active ? 'workout' : 'online',
        activity: active
          ? 'Working out · ' + state.activeRoutine.routine_name
          : 'Online'
      });
    } catch (e) {}
  };

  beat();

  state.heartbeat = setInterval(beat, 30000);

  // Poll only the Friends page.
  // Do not reload the entire Dashboard every 45 seconds.
  state.presencePoll = setInterval(() => {
    if (state.page === 'friends') {
      renderPage();
    }
  }, 45000);
}

function stopHeartbeat() {
  if (state.heartbeat) clearInterval(state.heartbeat);
  if (state.presencePoll) clearInterval(state.presencePoll);
}

async function boot() {
  const token = sessionStorage.getItem('cos_token');

  if (token) {
    state.token = token;

    try {
      const result = await rpc('getSessionUser', token);
      state.user = result.user;
      showApp();
      return;
    } catch (e) {
      sessionStorage.removeItem('cos_token');
      state.token = null;
    }
  }

  showAuth();
}

window.addEventListener('load', boot);
