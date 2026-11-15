// CALISTHENICS OS backend. Bound to a Google Sheet (Extensions > Apps Script).
// Setup: Project Settings > Script Properties: ADMIN_USER, ADMIN_PASS. Run setup() once. Deploy as Web app.
const SS = () => SpreadsheetApp.getActive();
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('Calisthenics OS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function setup() {
  const H = {Users:['username','salt','hash','role','active','created'],
    Routines:['id','username','name','day','exercises'],
    Logs:['username','date','routineId','idx','sets','reps']};
  for (const n in H) {
    const s = SS().getSheetByName(n) || SS().insertSheet(n);
    if (!s.getLastRow()) s.appendRow(H[n]);
  }
  SS().getSheetByName('Users').getRange('A:A').setNumberFormat('@');
  SS().getSheetByName('Logs').getRange('A:B').setNumberFormat('@');
  const p = PropertiesService.getScriptProperties();
  const u = p.getProperty('ADMIN_USER'), pw = p.getProperty('ADMIN_PASS');
  if (!u || !pw) throw new Error('Set ADMIN_USER and ADMIN_PASS in Script Properties, then run setup again.');
  if (!tbl_('Users').rows.some(r => String(r.username) === u)) addUser_(u, pw, 'admin');
  if (!tbl_('Routines').rows.some(r => r.username === '_template')) {
    const x = (name,sets,reps,unit) => ({name,sets,reps,unit:unit||'reps',rest:60,note:''});
    const T = [
      ['Push day','Mon',[x('Push-ups',3,15),x('Diamond push-ups',3,10),x('Pike push-ups',3,8),x('Dips',3,10),x('Plank',3,45,'sec')]],
      ['Pull day','Tue',[x('Pull-ups',3,5),x('Chin-ups',3,8),x('Australian rows',3,12),x('Dead hang',3,30,'sec')]],
      ['Legs and core','Wed',[x('Squats',3,20),x('Lunges',3,12),x('Calf raises',3,20),x('Leg raises',3,12),x('Plank',3,45,'sec')]],
      ['Rest and mobility','Thu',[]],
      ['Upper body','Fri',[x('Push-ups',3,15)]]];
    T.forEach(t => SS().getSheetByName('Routines').appendRow(['r'+Utilities.getUuid().slice(0,8),'_template',t[0],t[1],JSON.stringify(t[2])]));
  }
}

function api(a, t, d) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    d = d || {};
    if (a === 'register') return {ok:true, data:register_(d)};
    if (a === 'login') return {ok:true, data:login_(d)};
    const u = session_(t), fn = A[a];
    if (!fn) throw new Error('Unknown action');
    if (a.indexOf('admin_') === 0 && u.role !== 'admin') throw new Error('Not allowed');
    return {ok:true, data:fn(u, d, t)};
  } catch (e) { return {ok:false, error:e.message}; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}

function tbl_(n) {
  const s = SS().getSheetByName(n), v = s.getDataRange().getValues(), h = v.shift();
  return {s, rows: v.map((r, i) => { const o = {_r:i+2}; h.forEach((k, j) => o[k] = r[j]); return o; })};
}
function hash_(salt, pw) {
  let h = salt + pw;
  for (let i = 0; i < 300; i++)
    h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt)
      .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
  return h;
}
function addUser_(u, pw, role) {
  const salt = Utilities.getUuid();
  SS().getSheetByName('Users').appendRow([u, salt, hash_(salt, pw), role, true, new Date()]);
  if (role !== 'admin') tbl_('Routines').rows.filter(r => r.username === '_template').forEach(r =>
    SS().getSheetByName('Routines').appendRow(['r'+Utilities.getUuid().slice(0,8), u, r.name, r.day, r.exercises]));
}
function register_(d) {
  const u = String(d.username || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(u)) throw new Error('Username: 3-20 letters, numbers or underscores.');
  if (u === '_template') throw new Error('Username taken.');
  if (String(d.password || '').length < 8) throw new Error('Password needs at least 8 characters.');
  if (d.password !== d.confirm) throw new Error('Passwords do not match.');
  if (tbl_('Users').rows.some(r => String(r.username) === u)) throw new Error('Username taken.');
  addUser_(u, d.password, 'user');
  return login_({username:u, password:d.password});
}
function login_(d) {
  const u = String(d.username || '').trim().toLowerCase();
  const r = tbl_('Users').rows.find(r => String(r.username) === u);
  if (!r || hash_(r.salt, String(d.password || '')) !== r.hash) throw new Error('Wrong username or password.');
  if (r.active === false || r.active === 'FALSE') throw new Error('This account is deactivated.');
  const t = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('s:' + t, u, 21600);
  return {token:t, username:u, role:r.role};
}
function session_(t) {
  const u = t && CacheService.getScriptCache().get('s:' + t);
  if (!u) throw new Error('SESSION');
  const r = tbl_('Users').rows.find(r => String(r.username) === u);
  if (!r || r.active === false || r.active === 'FALSE') throw new Error('SESSION');
  return {username:u, role:r.role};
}
const okDate_ = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s));

const A = {
  logout: (u, d, t) => { CacheService.getScriptCache().remove('s:' + t); return true; },
  me: u => u,
  change_pw: (u, d) => {
    if (String(d.password || '').length < 8) throw new Error('Password needs at least 8 characters.');
    return setPw_(u.username, d.password);
  },
  routines: u => tbl_('Routines').rows.filter(r => r.username === u.username)
    .map(r => ({id:r.id, name:r.name, day:r.day, exercises:JSON.parse(r.exercises || '[]')})),
  routine_save: (u, d) => {
    const owner = d.template && u.role === 'admin' ? '_template' : u.username;
    const ex = (d.exercises || []).slice(0, 40).map(e => ({name:String(e.name).slice(0,60), sets:+e.sets||1, reps:+e.reps||1,
      unit:e.unit === 'sec' ? 'sec' : 'reps', rest:+e.rest||0, note:String(e.note || '').slice(0,200)}));
    const T = tbl_('Routines'), row = d.id && T.rows.find(r => r.id === d.id && r.username === owner);
    const vals = [row ? row.id : 'r'+Utilities.getUuid().slice(0,8), owner, String(d.name || 'Routine').slice(0,40),
      DAYS.indexOf(d.day) >= 0 ? d.day : '', JSON.stringify(ex)];
    if (row) T.s.getRange(row._r, 1, 1, 5).setValues([vals]); else T.s.appendRow(vals);
    return vals[0];
  },
  routine_delete: (u, d) => {
    const T = tbl_('Routines'), row = T.rows.find(r => r.id === d.id && r.username === u.username);
    if (row) T.s.deleteRow(row._r);
    return true;
  },
  routine_duplicate: (u, d) => {
    const row = tbl_('Routines').rows.find(r => r.id === d.id && r.username === u.username);
    if (!row) throw new Error('Not found');
    SS().getSheetByName('Routines').appendRow(['r'+Utilities.getUuid().slice(0,8), u.username, row.name + ' copy', '', row.exercises]);
    return true;
  },
  logs: (u, d) => {
    if (!okDate_(d.date)) throw new Error('Bad date');
    return tbl_('Logs').rows.filter(r => r.username === u.username && String(r.date) === d.date)
      .map(r => ({routineId:r.routineId, idx:+r.idx}));
  },
  toggle: (u, d) => {
    if (!okDate_(d.date)) throw new Error('Bad date');
    const R = tbl_('Routines').rows.find(r => r.id === d.routineId && r.username === u.username);
    const e = R && JSON.parse(R.exercises)[+d.idx];
    if (!e) throw new Error('Not found');
    const L = tbl_('Logs'), row = L.rows.find(r => r.username === u.username && String(r.date) === d.date &&
      r.routineId === d.routineId && +r.idx === +d.idx);
    if (row) L.s.deleteRow(row._r); else L.s.appendRow([u.username, d.date, d.routineId, +d.idx, e.sets, e.reps]);
    return !row;
  },
  stats: (u, d) => {
    if (!okDate_(d.today)) throw new Error('Bad date');
    const L = tbl_('Logs').rows.filter(r => r.username === u.username);
    const R = tbl_('Routines').rows.filter(r => r.username === u.username);
    const per = {}, byDay = {};
    let sets = 0, reps = 0;
    L.forEach(r => {
      const k = r.date + '|' + r.routineId; per[k] = (per[k] || 0) + 1;
      byDay[r.date] = (byDay[r.date] || 0) + 1; sets += +r.sets; reps += r.sets * r.reps;
    });
    const workouts = Object.keys(per).filter(k => {
      const q = R.find(r => r.id === k.split('|')[1]);
      return q && per[k] >= JSON.parse(q.exercises).length;
    }).length;
    const day = s => { const x = new Date(s + 'T12:00:00Z'); return x; };
    const iso = x => x.toISOString().slice(0, 10);
    let streak = 0, c = day(d.today);
    if (!byDay[iso(c)]) c.setUTCDate(c.getUTCDate() - 1);
    while (byDay[iso(c)]) { streak++; c.setUTCDate(c.getUTCDate() - 1); }
    const week = [];
    for (let i = 6; i >= 0; i--) { const x = day(d.today); x.setUTCDate(x.getUTCDate() - i); week.push({date:iso(x), n:byDay[iso(x)] || 0}); }
    return {workouts, streak, days:Object.keys(byDay).length, sets, reps, week,
      consistency:Math.round(week.filter(w => w.n).length / 7 * 100)};
  },
  admin_users: () => {
    const L = tbl_('Logs').rows, out = [];
    tbl_('Users').rows.forEach(r => out.push({username:String(r.username), role:r.role,
      active:!(r.active === false || r.active === 'FALSE'), sets:L.filter(l => l.username === String(r.username)).length}));
    return out;
  },
  admin_active: (u, d) => {
    const T = tbl_('Users'), r = T.rows.find(r => String(r.username) === d.username);
    if (!r || r.role === 'admin') throw new Error('Not allowed');
    T.s.getRange(r._r, 5).setValue(!!d.active); return true;
  },
  admin_reset: (u, d) => {
    if (String(d.password || '').length < 8) throw new Error('Password needs at least 8 characters.');
    return setPw_(d.username, d.password);
  }
};
function setPw_(username, pw) {
  const T = tbl_('Users'), r = T.rows.find(r => String(r.username) === username);
  if (!r) throw new Error('Not found');
  const salt = Utilities.getUuid();
  T.s.getRange(r._r, 2, 1, 2).setValues([[salt, hash_(salt, pw)]]);
  return true;
}