
/* =========================================================
   CALISTHENICS OS
   API MODULE
   ========================================================= */


/* =========================================================
   1. MAIN API ROUTER
   ========================================================= */

function api(action, payload) {
  payload = payload || {};

  // Always authenticate from the session token.
  const user = requireUser_(payload.token);
  const userId = String(user.user_id);

  switch (action) {

    case 'dashboard':
      return dashboardData_(userId);

    case 'profile':
      return getProfile_(userId);

    case 'saveProfile':
      return saveProfile_(userId, payload);

    case 'bodyMetrics':
      return getBodyMetrics_(userId);

    case 'consistency':
      return getConsistency_(userId);

    case 'saveHeight':
      return saveHeight_(userId, payload);

    case 'saveBodyMetrics':
      return saveBodyMetrics_(userId, payload);

    case 'routines':
      return getRoutines_(userId);

    case 'saveRoutine':
      return saveRoutine_(userId, payload);

    case 'deleteRoutine':
      return deleteRoutine_(userId, payload.routine_id);

    case 'saveSet':
      return saveSet_(userId, payload);

    case 'finishWorkout':
      return finishWorkout_(userId, payload);

    case 'history':
      return getHistory_(userId);

    case 'progressions':
      return getProgressions_(userId);

    case 'saveProgression':
      return saveProgression_(userId, payload);

    case 'friends':
      return getFriends_(userId);

    case 'addFriend':
      return addFriend_(userId, payload.username);

    case 'respondFriend':
      return respondFriend_(
        userId,
        payload.friendship_id,
        payload.accept
      );

    case 'heartbeat':
      setPresence_(
        userId,
        payload.state || 'online',
        payload.activity || 'Online'
      );

      return { ok: true };

    case 'searchUsers':
      return searchUsers_(userId, payload.query);

    default:
      throw new Error('Unknown action: ' + safeText_(action, 80));
  }
}


/* =========================================================
   2. DASHBOARD
   ========================================================= */


function dashboardData_(userId) {

  userId = String(userId);

  // 1. Read each workout sheet only ONCE.
  const allSessions = rows_('WorkoutSessions');
  const allSets = rows_('WorkoutSets');

  // 2. Filter current user's records in memory.
  const sessions = allSessions.filter(s =>
    String(s.user_id) === userId
  );

  const sets = allSets.filter(s =>
    String(s.user_id) === userId &&
    (
      s.completed === true ||
      String(s.completed).toLowerCase() === 'true' ||
      String(s.completed) === '1'
    )
  );

  // 3. Calculate completed workout statistics.
  const completedSessions = sessions.filter(s =>
    String(s.status) === 'completed'
  );

  const totalReps = sets.reduce((total, s) =>
    total + (Number(s.actual_reps) || 0), 0
  );

  // 4. Get routines.
  const routines = getRoutines_(userId);

  // 5. Get Singapore date and weekday.
  const now = new Date();

  const today = Utilities.formatDate(
    now,
    'Asia/Singapore',
    'yyyy-MM-dd'
  );

  const weekday = Utilities.formatDate(
    now,
    'Asia/Singapore',
    'EEEE'
  ).toLowerCase();

  const todayRoutine = routines.find(r =>
    String(r.assigned_day || '').trim().toLowerCase() === weekday
  ) || routines.find(r =>
    String(r.assigned_day || '').trim().toLowerCase() === 'everyday'
  );

  // 6. Filter today's sessions from existing memory data.
  const todaySessions = sessions.filter(s => {

    const startedAt = new Date(s.started_at);

    if (!Number.isFinite(startedAt.getTime())) {
      return false;
    }

    return Utilities.formatDate(
      startedAt,
      'Asia/Singapore',
      'yyyy-MM-dd'
    ) === today;

  });

  // 7. Build today's session ID lookup.
  const todaySessionIds = new Set(
    todaySessions.map(s => String(s.session_id))
  );

  // 8. Filter today's completed sets from existing memory data.
  const todaySets = sets.filter(s =>
    todaySessionIds.has(String(s.session_id))
  );

  // 9. Calculate per-exercise set and rep progress for today's routine.
  const exerciseProgress = [];
  const completedExercises = [];

  if (todayRoutine) {

    (todayRoutine.exercises || []).forEach(ex => {

      const exerciseName = String(ex.exercise_name || '');
      const key = exerciseName.trim().toLowerCase();
      const matchingSets = todaySets.filter(s =>
        String(s.exercise_name || '').trim().toLowerCase() === key
      );

      const loggedSets = matchingSets.length;
      const actualReps = matchingSets.reduce((sum, s) =>
        sum + (Number(s.actual_reps) || 0), 0
      );
      const targetSets = Math.max(1, Number(ex.target_sets) || 1);
      const targetReps = Number(String(ex.target_reps || '').match(/^\s*\d+(?:\.\d+)?/)?.[0]) || 0;
      const targetTotalReps = targetSets * targetReps;
      const setsMet = loggedSets >= targetSets;
      const repsMet = targetTotalReps === 0 || actualReps >= targetTotalReps;
      const completed = setsMet && repsMet;

      if (completed) completedExercises.push(exerciseName);

      exerciseProgress.push({
        exercise_name: exerciseName,
        logged_sets: loggedSets,
        target_sets: targetSets,
        actual_reps: actualReps,
        target_total_reps: targetTotalReps,
        completed: completed
      });

    });

  }

  // 10. Today's completed sessions.
  const todayDone = todaySessions.filter(s =>
    String(s.status) === 'completed'
  );

  // 11. Return original dashboard response structure.
  return {

    workouts: completedSessions.length,

    totalReps: totalReps,

    totalSets: sets.length,

    todayDone: todayDone.length,

    completedExercises: completedExercises,

    exerciseProgress: exerciseProgress,

    routines: routines,

    todayRoutine: todayRoutine || null,

    recent: completedSessions.slice(-5).reverse(),

    friends: getFriends_(userId)

  };

}



/* =========================================================
   3. PROFILE
   ========================================================= */

function ensureProfileHeightColumn_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Profiles');
  if (!sheet) return;
  const lastCol = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v).trim());
  if (!headers.includes('height_cm')) sheet.getRange(1, lastCol + 1).setValue('height_cm');
}


function getProfile_(userId) {

  ensureProfileHeightColumn_();

  return rows_('Profiles').find(p =>
    String(p.user_id) === userId
  ) || {
    display_name: '',
    goal: '',
    level: 'Beginner'
  };

}


function saveProfile_(userId, p) {

  return lock_(() => {

    const old = getProfile_(userId);

    const patch = {

      display_name: safeText_(p.display_name, 60),

      goal: safeText_(p.goal, 120),

      level: safeText_(p.level, 30),

      height_cm: p.height_cm == null || p.height_cm === '' ? (old.height_cm || '') : Number(p.height_cm),

      updated_at: now_()

    };

    if (old.user_id) {

      updateById_(
        'Profiles',
        'user_id',
        userId,
        patch
      );

    } else {

      append_('Profiles', Object.assign({

        user_id: userId,

        created_at: now_()

      }, patch));

    }

    return { ok: true };

  });

}


/* =========================================================
   4. BODY METRICS (BMI + DAILY WEIGHT)
   ========================================================= */

function weightLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('WeightLogs');
  if (!sheet) {
    sheet = ss.insertSheet('WeightLogs');
    sheet.appendRow(['user_id', 'log_date', 'weight_kg', 'created_at']);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(['user_id', 'log_date', 'weight_kg', 'created_at']);
  }
  return sheet;
}

function getBodyMetrics_(userId) {
  const profile = getProfile_(userId);
  const sheet = weightLogSheet_();
  const values = sheet.getDataRange().getValues();
  if (!values.length) return { height_cm: Number(profile.height_cm) || '', entries: [] };
  const headers = values[0].map(h => String(h).trim());
  const ix = Object.fromEntries(headers.map((h, i) => [h, i]));
  const entries = values.slice(1).filter(row => String(row[ix.user_id]) === String(userId))
    .map(row => ({
      date: String(row[ix.log_date] || ''),
      weight_kg: Number(row[ix.weight_kg]) || 0
    }))
    .filter(x => x.date && x.weight_kg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  return { height_cm: Number(profile.height_cm) || '', entries: entries.slice(-90) };
}

function saveHeight_(userId, p) {
  return lock_(() => {
    const height = p.height_cm == null || p.height_cm === '' ? 0 : Number(p.height_cm);
    if (!Number.isFinite(height) || height < 80 || height > 250) {
      throw new Error('Height must be between 80 and 250 cm.');
    }

    // Save height directly to the Profiles sheet. This operation is independent
    // from WeightLogs and does not require or read a weight value.
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Profiles');
    if (!sheet) throw new Error('Profiles sheet was not found.');
    let lastCol = Math.max(1, sheet.getLastColumn());
    let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v).trim());
    if (!headers.includes('user_id')) throw new Error('Profiles sheet is missing the user_id column.');
    if (!headers.includes('height_cm')) {
      lastCol += 1;
      sheet.getRange(1, lastCol).setValue('height_cm');
      headers.push('height_cm');
    }
    if (!headers.includes('updated_at')) {
      lastCol += 1;
      sheet.getRange(1, lastCol).setValue('updated_at');
      headers.push('updated_at');
    }
    const userCol = headers.indexOf('user_id') + 1;
    const heightCol = headers.indexOf('height_cm') + 1;
    const updatedCol = headers.indexOf('updated_at') + 1;
    const lastRow = sheet.getLastRow();
    let targetRow = 0;
    if (lastRow >= 2) {
      const ids = sheet.getRange(2, userCol, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(userId)) { targetRow = i + 2; break; }
      }
    }
    if (!targetRow) {
      targetRow = Math.max(2, lastRow + 1);
      sheet.getRange(targetRow, userCol).setValue(String(userId));
      const displayCol = headers.indexOf('display_name') + 1;
      const goalCol = headers.indexOf('goal') + 1;
      const levelCol = headers.indexOf('level') + 1;
      const createdCol = headers.indexOf('created_at') + 1;
      if (displayCol > 0) sheet.getRange(targetRow, displayCol).setValue('');
      if (goalCol > 0) sheet.getRange(targetRow, goalCol).setValue('');
      if (levelCol > 0) sheet.getRange(targetRow, levelCol).setValue('Beginner');
      if (createdCol > 0) sheet.getRange(targetRow, createdCol).setValue(now_());
    }
    sheet.getRange(targetRow, heightCol).setValue(height);
    sheet.getRange(targetRow, updatedCol).setValue(now_());
    return { ok: true, height_cm: height };
  });
}

function saveBodyMetrics_(userId, p) {
  return lock_(() => {
    const weight = p.weight_kg == null || p.weight_kg === '' ? 0 : Number(p.weight_kg);
    if (!Number.isFinite(weight) || weight < 20 || weight > 400) {
      throw new Error('Weight must be between 20 and 400 kg.');
    }

    const date = Utilities.formatDate(new Date(), 'Asia/Singapore', 'yyyy-MM-dd');
    const sheet = weightLogSheet_();
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const ix = Object.fromEntries(headers.map((h, i) => [h, i]));
    let updated = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][ix.user_id]) === String(userId) && String(data[i][ix.log_date]) === date) {
        sheet.getRange(i + 1, ix.weight_kg + 1).setValue(weight);
        sheet.getRange(i + 1, ix.created_at + 1).setValue(now_());
        updated = true;
        break;
      }
    }
    if (!updated) sheet.appendRow([String(userId), date, weight, now_()]);
    const profile = getProfile_(userId);
    return { ok: true, date: date, weight_kg: weight, height_cm: Number(profile.height_cm) || '' };
  });
}


/* =========================================================
   4. ROUTINES
   ========================================================= */

function getRoutines_(userId) {

  const all = rows_('Routines').filter(r =>
    String(r.user_id) === userId
  );

  const exercises = rows_('RoutineExercises').filter(e =>
    String(e.user_id) === userId
  );

  return all.map(r => {

    const routineExercises = exercises
      .filter(e =>
        String(e.routine_id) === String(r.routine_id)
      )
      .sort((a, b) =>
        Number(a.position) - Number(b.position)
      );

    return Object.assign({}, r, {
      exercises: routineExercises
    });

  });

}


function saveRoutine_(userId, p) {

  return lock_(() => {

    const name = safeText_(p.routine_name, 80).trim();

    if (!name) {
      throw new Error('Routine name is required.');
    }

    if (p.exercises != null && !Array.isArray(p.exercises)) {
      throw new Error('Invalid exercises data.');
    }

    const submittedExercises = (p.exercises || []).slice(0, 40);

    // Validate all exercises before changing database records.
    const exercises = submittedExercises.map((e, i) => {

      if (!e || typeof e !== 'object' || Array.isArray(e)) {
        throw new Error('Invalid exercise at position ' + (i + 1));
      }

      const exerciseName = safeText_(e.exercise_name, 80).trim();

      if (!exerciseName) {
        throw new Error('Exercise name is required.');
      }

      const sets = e.target_sets == null || e.target_sets === ''
        ? 3
        : Number(e.target_sets);

      const rest = e.rest_seconds == null || e.rest_seconds === ''
        ? 60
        : Number(e.rest_seconds);

      if (!Number.isInteger(sets) || sets < 1 || sets > 20) {
        throw new Error('Invalid target sets.');
      }

      if (!Number.isInteger(rest) || rest < 0 || rest > 900) {
        throw new Error('Invalid rest seconds.');
      }

      return {
        exercise_name: exerciseName,
        category: safeText_(e.category, 30),
        target_sets: sets,
        target_reps: safeText_(e.target_reps, 30),
        rest_seconds: rest,
        position: i + 1,
        notes: safeText_(e.notes, 200)
      };

    });

    let id = safeText_(p.routine_id, 80);

    const existing = id
      ? rows_('Routines').find(r =>
          String(r.routine_id) === id &&
          String(r.user_id) === userId
        )
      : null;

    if (id && !existing) {
      throw new Error('Routine not found.');
    }

    if (!existing) {

      id = uid_();

      append_('Routines', {

        routine_id: id,
        user_id: userId,
        routine_name: name,
        assigned_day: safeText_(p.assigned_day, 20),
        description: safeText_(p.description, 250),
        created_at: now_(),
        updated_at: now_()

      });

    } else {

      updateById_('Routines', 'routine_id', id, {

        routine_name: name,
        assigned_day: safeText_(p.assigned_day, 20),
        description: safeText_(p.description, 250),
        updated_at: now_()

      });

    }

    // Replace only exercises belonging to this user's routine.
    rows_('RoutineExercises')
      .filter(e =>
        String(e.routine_id) === id &&
        String(e.user_id) === userId
      )
      .forEach(e => {
        deleteById_(
          'RoutineExercises',
          'id',
          String(e.id),
          userId
        );
      });

    exercises.forEach(e => {

      append_('RoutineExercises', Object.assign({

        id: uid_(),
        routine_id: id,
        user_id: userId

      }, e));

    });

    return {
      ok: true,
      routine_id: id
    };

  });

}


function deleteRoutine_(userId, id) {

  return lock_(() => {

    id = safeText_(id, 80);

    const routine = rows_('Routines').find(r =>
      String(r.routine_id) === id &&
      String(r.user_id) === userId
    );

    if (!routine) {
      throw new Error('Routine not found.');
    }

    rows_('RoutineExercises')
      .filter(e =>
        String(e.routine_id) === id &&
        String(e.user_id) === userId
      )
      .forEach(e => {

        deleteById_(
          'RoutineExercises',
          'id',
          String(e.id),
          userId
        );

      });

    deleteById_(
      'Routines',
      'routine_id',
      id,
      userId
    );

    return { ok: true };

  });

}


/* =========================================================
   5. WORKOUT SETS
   ========================================================= */

function saveSet_(userId, p) {

  return lock_(() => {

    const exerciseName = safeText_(
      p.exercise_name,
      80
    ).trim();

    if (!exerciseName) {
      throw new Error('Exercise name is required.');
    }

    const setNumber = Number(p.set_number);
    const actualReps = Number(p.actual_reps);

    const weight = p.weight == null || p.weight === ''
      ? 0
      : Number(p.weight);

    const holdSeconds = p.hold_seconds == null || p.hold_seconds === ''
      ? 0
      : Number(p.hold_seconds);

    if (
      !Number.isInteger(setNumber) ||
      setNumber < 1 ||
      setNumber > 100
    ) {
      throw new Error('Invalid set number.');
    }

    if (
      !Number.isFinite(actualReps) ||
      actualReps < 0 ||
      actualReps > 10000 ||
      !Number.isFinite(weight) ||
      weight < 0 ||
      weight > 10000 ||
      !Number.isFinite(holdSeconds) ||
      holdSeconds < 0 ||
      holdSeconds > 86400
    ) {
      throw new Error('Invalid workout values.');
    }

    let sessionId = safeText_(p.session_id, 80);

    const routineId = safeText_(p.routine_id, 80);

    let routineName = safeText_(p.routine_name, 80);

    if (routineId) {

      const routine = rows_('Routines').find(r =>
        String(r.routine_id) === routineId &&
        String(r.user_id) === userId
      );

      if (!routine) {
        throw new Error('Routine not found.');
      }

      routineName = String(routine.routine_name || '');
    }

    // Validate session before creating any records.
    if (sessionId) {

      const session = rows_('WorkoutSessions').find(s =>
        String(s.session_id) === sessionId &&
        String(s.user_id) === userId
      );

      if (!session) {
        throw new Error('Workout session not found.');
      }

      if (session.status !== 'in_progress') {
        throw new Error('Workout session is already completed.');
      }

    } else {

      sessionId = uid_();

      append_('WorkoutSessions', {

        session_id: sessionId,
        user_id: userId,
        routine_id: routineId,
        routine_name: routineName,
        started_at: now_(),
        finished_at: '',
        duration_seconds: 0,
        status: 'in_progress'

      });

    }

    append_('WorkoutSets', {

      set_id: uid_(),
      session_id: sessionId,
      user_id: userId,
      exercise_name: exerciseName,
      set_number: setNumber,
      target_reps: safeText_(p.target_reps, 30),
      actual_reps: actualReps,
      weight: weight,
      hold_seconds: holdSeconds,
      completed: true,
      notes: safeText_(p.notes, 200),
      created_at: now_()

    });

    return {

      ok: true,
      session_id: sessionId

    };

  });

}


/* =========================================================
   6. FINISH WORKOUT
   ========================================================= */

function finishWorkout_(userId, p) {

  return lock_(() => {

    const id = safeText_(p.session_id, 80);

    if (!id) {
      throw new Error('Session ID is required.');
    }

    const session = rows_('WorkoutSessions').find(s =>
      String(s.session_id) === id &&
      String(s.user_id) === userId
    );

    if (!session) {
      throw new Error('Workout session not found.');
    }

    if (session.status !== 'in_progress') {
      throw new Error('Workout session is already completed.');
    }

    const startedAt = new Date(session.started_at).getTime();

    if (
      !Number.isFinite(startedAt) ||
      startedAt > Date.now()
    ) {
      throw new Error('Invalid workout start time.');
    }

    const duration = Math.floor(
      (Date.now() - startedAt) / 1000
    );

    updateById_('WorkoutSessions', 'session_id', id, {

      finished_at: now_(),
      duration_seconds: duration,
      status: 'completed'

    });

    return { ok: true };

  });

}


/* =========================================================
   CONSISTENCY / ACTIVITY SUMMARY
   ========================================================= */

function getConsistency_(userId) {
  userId = String(userId);
  const allSets = rows_('WorkoutSets').filter(s =>
    String(s.user_id) === userId && (
      s.completed === true ||
      String(s.completed).toLowerCase() === 'true' ||
      String(s.completed) === '1'
    )
  );

  const allSessions = rows_('WorkoutSessions').filter(s =>
    String(s.user_id) === userId
  );

  const daily = new Map();
  allSets.forEach(s => {
    const dt = new Date(s.created_at);
    if (!Number.isFinite(dt.getTime())) return;
    const day = Utilities.formatDate(dt, 'Asia/Singapore', 'yyyy-MM-dd');
    const item = daily.get(day) || { date: day, sets: 0, reps: 0, sessions: new Set() };
    item.sets += 1;
    item.reps += Number(s.actual_reps) || 0;
    if (s.session_id) item.sessions.add(String(s.session_id));
    daily.set(day, item);
  });

  // Use set activity as the source of truth: saving at least one set makes a day active.
  const activeDays = Array.from(daily.keys()).sort();
  const today = Utilities.formatDate(new Date(), 'Asia/Singapore', 'yyyy-MM-dd');
  const dateAt = value => new Date(value + 'T12:00:00');
  const dayOffset = (value, offset) => {
    const d = dateAt(value);
    d.setDate(d.getDate() + offset);
    return Utilities.formatDate(d, 'Asia/Singapore', 'yyyy-MM-dd');
  };

  let currentStreak = 0;
  let cursor = daily.has(today) ? today : dayOffset(today, -1);
  while (daily.has(cursor)) {
    currentStreak += 1;
    cursor = dayOffset(cursor, -1);
  }

  let bestStreak = 0;
  let run = 0;
  let previous = null;
  activeDays.forEach(day => {
    run = previous && dayOffset(previous, 1) === day ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    previous = day;
  });

  const days = [];
  for (let i = 29; i >= 0; i--) {
    const date = dayOffset(today, -i);
    const item = daily.get(date);
    days.push({
      date: date,
      active: !!item,
      sets: item ? item.sets : 0,
      reps: item ? item.reps : 0,
      sessions: item ? item.sessions.size : 0
    });
  }

  const last7 = days.slice(-7);
  const activeLast7 = last7.filter(d => d.active).length;
  const activeLast30 = days.filter(d => d.active).length;
  const totalSets = days.reduce((sum, d) => sum + d.sets, 0);
  const totalReps = days.reduce((sum, d) => sum + d.reps, 0);

  return {
    days: days,
    currentStreak: currentStreak,
    bestStreak: bestStreak,
    activeLast7: activeLast7,
    activeLast30: activeLast30,
    totalSets30: totalSets,
    totalReps30: totalReps,
    allTimeActiveDays: activeDays.length,
    totalSessions: allSessions.length
  };
}


/* =========================================================
   7. WORKOUT HISTORY
   ========================================================= */

function getHistory_(userId) {

  return rows_('WorkoutSessions')
    .filter(s =>
      String(s.user_id) === userId
    )
    .sort((a, b) =>
      new Date(b.started_at).getTime() -
      new Date(a.started_at).getTime()
    )
    .slice(0, 100);

}


/* =========================================================
   8. PROGRESSIONS
   ========================================================= */

function getProgressions_(userId) {

  return rows_('Progressions').filter(p =>
    String(p.user_id) === userId
  );

}


function saveProgression_(userId, p) {

  return lock_(() => {

    const skillName = safeText_(p.skill_name, 80).trim();

    const stageName = safeText_(p.stage_name, 80).trim();

    if (!skillName || !stageName) {
      throw new Error('Skill name and stage name are required.');
    }

    const stageNumber = p.stage_number == null || p.stage_number === ''
      ? 1
      : Number(p.stage_number);

    const bestReps = p.best_reps == null || p.best_reps === ''
      ? 0
      : Number(p.best_reps);

    const bestHold = p.best_hold_seconds == null || p.best_hold_seconds === ''
      ? 0
      : Number(p.best_hold_seconds);

    if (
      !Number.isInteger(stageNumber) ||
      stageNumber < 1 ||
      stageNumber > 100
    ) {
      throw new Error('Invalid progression stage.');
    }

    if (
      !Number.isInteger(bestReps) ||
      bestReps < 0 ||
      bestReps > 10000 ||
      !Number.isFinite(bestHold) ||
      bestHold < 0 ||
      bestHold > 86400
    ) {
      throw new Error('Invalid progression values.');
    }

    const id = safeText_(p.progression_id, 80);

    const data = {

      skill_name: skillName,
      stage_name: stageName,
      stage_number: stageNumber,
      status: safeText_(p.status, 30),
      best_reps: bestReps,
      best_hold_seconds: bestHold,
      notes: safeText_(p.notes, 200),
      updated_at: now_()

    };

    const old = id
      ? rows_('Progressions').find(x =>
          String(x.progression_id) === id &&
          String(x.user_id) === userId
        )
      : null;

    if (id && !old) {
      throw new Error('Progression not found.');
    }

    if (old) {

      updateById_(
        'Progressions',
        'progression_id',
        id,
        data
      );

    } else {

      append_('Progressions', Object.assign({

        progression_id: uid_(),
        user_id: userId

      }, data));

    }

    return { ok: true };

  });

}
