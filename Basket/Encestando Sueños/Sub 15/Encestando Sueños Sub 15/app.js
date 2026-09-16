'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES
═══════════════════════════════════════════════════════════════════════════ */
const QUARTER_SECS = 10 * 60;
const QUARTERS     = ['Q1','Q2','Q3','Q4','OT'];
const STORAGE_KEY  = 'mba_es15_game_v1';
const HISTORY_KEY  = 'mba_es15_hist_v1';

const DEFAULT_PLAYERS = [
  'Jugador 1',  'Jugador 2',  'Jugador 3',  'Jugador 4',
  'Jugador 5',  'Jugador 6',  'Jugador 7',  'Jugador 8',
  'Jugador 9',  'Jugador 10', 'Jugador 11', 'Jugador 12',
];

/* Tiros: cada par = (Encestado, Fallado) */
const SHOT_CFG = [
  { label:'2 Puntos',  madeKey:'2PT_MADE', attKey:'2PT_ATT',  pts:2,
    madeColor:'#1a5e35', missColor:'#5c0a0a' },
  { label:'3 Puntos',  madeKey:'3PT_MADE', attKey:'3PT_ATT',  pts:3,
    madeColor:'#0e4d3f', missColor:'#5c0a0a' },
  { label:'Tiro Libre',madeKey:'FT_MADE',  attKey:'FT_ATT',   pts:1,
    madeColor:'#0b5e4e', missColor:'#5c0a0a' },
];

/* Stats sin par (botón simple) */
const STAT_CFG = [
  { key:'REB_OFF', label:'Reb. Ofensivo',  color:'#8a6914' },
  { key:'REB_DEF', label:'Reb. Defensivo', color:'#7d5d12' },
  { key:'AST',     label:'Asistencia',     color:'#1f6090' },
  { key:'TOV',     label:'Pérdida',        color:'#7b241c' },
  { key:'STL',     label:'Robo',           color:'#6c3483' },
  { key:'BLK',     label:'Bloqueo',        color:'#0e6251' },
  { key:'FOUL',    label:'Falta',          color:'#a93226' },
];

/* Todas las claves internas de stats */
const ALL_STAT_KEYS = [
  '2PT_MADE','2PT_ATT','3PT_MADE','3PT_ATT','FT_MADE','FT_ATT',
  'REB_OFF','REB_DEF','AST','TOV','STL','BLK','FOUL',
];

/* Helpers de totales (usados en TABLE_COLS y Excel) */
function totStat(key) { return S.players.reduce((n,p) => n + (S.stats[p]?.[key] || 0), 0); }

/* Columnas de la tabla */
const TABLE_COLS = [
  { h:'MIN',
    fn: p => fmtMin(S.minutesPlayed[p]||0),
    total: () => fmtMin(totalMins()) },
  { h:'PTS',
    fn: p => pts(p),
    total: () => S.players.reduce((n,p) => n + pts(p), 0) },
  { h:'2PT M/A',
    fn: p => `${S.stats[p]['2PT_MADE']}/${S.stats[p]['2PT_ATT']}`,
    total: () => `${totStat('2PT_MADE')}/${totStat('2PT_ATT')}` },
  { h:'3PT M/A',
    fn: p => `${S.stats[p]['3PT_MADE']}/${S.stats[p]['3PT_ATT']}`,
    total: () => `${totStat('3PT_MADE')}/${totStat('3PT_ATT')}` },
  { h:'TL M/A',
    fn: p => `${S.stats[p]['FT_MADE']}/${S.stats[p]['FT_ATT']}`,
    total: () => `${totStat('FT_MADE')}/${totStat('FT_ATT')}` },
  { h:'FG%',
    fn: p => fmtPct(fgPct(p)),
    total: () => {
      const m = totStat('2PT_MADE') + totStat('3PT_MADE');
      const a = totStat('2PT_ATT')  + totStat('3PT_ATT');
      return fmtPct(a > 0 ? m/a : null);
    },
  },
  { h:'3PT%',
    fn: p => fmtPct(threePct(p)),
    total: () => {
      const m = totStat('3PT_MADE'), a = totStat('3PT_ATT');
      return fmtPct(a > 0 ? m/a : null);
    },
  },
  { h:'FT%',
    fn: p => fmtPct(ftPct(p)),
    total: () => {
      const m = totStat('FT_MADE'), a = totStat('FT_ATT');
      return fmtPct(a > 0 ? m/a : null);
    },
  },
  { h:'R.Of',  fn: p => S.stats[p].REB_OFF,                   total: () => totStat('REB_OFF') },
  { h:'R.Def', fn: p => S.stats[p].REB_DEF,                   total: () => totStat('REB_DEF') },
  { h:'REB',   fn: p => S.stats[p].REB_OFF + S.stats[p].REB_DEF,
               total: () => totStat('REB_OFF') + totStat('REB_DEF') },
  { h:'AST',   fn: p => S.stats[p].AST,   total: () => totStat('AST') },
  { h:'TOV',   fn: p => S.stats[p].TOV,   total: () => totStat('TOV') },
  { h:'ROB',   fn: p => S.stats[p].STL,   total: () => totStat('STL') },
  { h:'BLQ',   fn: p => S.stats[p].BLK,   total: () => totStat('BLK') },
  { h:'FALT',  fn: p => S.stats[p].FOUL,  total: () => totStat('FOUL'),
               cellClass: p => S.stats[p].FOUL >= 5 ? 'falt-5' : (S.stats[p].FOUL >= 4 ? 'falt-4' : '') },
];

/* ═══════════════════════════════════════════════════════════════════════════
   ESTADO GLOBAL
═══════════════════════════════════════════════════════════════════════════ */
let S = newState();

function newState() {
  const players = [...DEFAULT_PLAYERS];
  return {
    gameName:      'Enc. Sueños Sub 15 vs ___',
    quarter:       'Q1',
    secsLeft:      QUARTER_SECS,
    clockRunning:  false,
    players,
    stats:         makeStats(players),
    minutesPlayed: makeMinutes(players),
    onCourt:       [],
    fouledOut:     {},
    selected:      players[0],
    history:       [],
  };
}

function makeStats(players) {
  const obj = {};
  players.forEach(p => {
    obj[p] = {};
    ALL_STAT_KEYS.forEach(k => obj[p][k] = 0);
  });
  return obj;
}

function makeMinutes(players) {
  const obj = {};
  players.forEach(p => obj[p] = 0);
  return obj;
}

function ensurePlayer(p) {
  if (!S.stats[p]) S.stats[p] = {};
  ALL_STAT_KEYS.forEach(k => { if (S.stats[p][k] === undefined) S.stats[p][k] = 0; });
  if (S.minutesPlayed[p] === undefined) S.minutesPlayed[p] = 0;
  if (!S.fouledOut) S.fouledOut = {};
}

/* ═══════════════════════════════════════════════════════════════════════════
   MIGRACIÓN DE DATOS VIEJOS (2PT/3PT/FT → M/A)
═══════════════════════════════════════════════════════════════════════════ */
function migrateIfNeeded(d) {
  if (!d.stats) return d;
  Object.keys(d.stats).forEach(p => {
    const s = d.stats[p];
    if ('2PT' in s && !('2PT_MADE' in s)) {
      s['2PT_MADE'] = s['2PT'] || 0;
      s['2PT_ATT']  = s['2PT'] || 0;
      delete s['2PT'];
    }
    if ('3PT' in s && !('3PT_MADE' in s)) {
      s['3PT_MADE'] = s['3PT'] || 0;
      s['3PT_ATT']  = s['3PT'] || 0;
      delete s['3PT'];
    }
    if ('FT' in s && !('FT_MADE' in s)) {
      s['FT_MADE'] = s['FT'] || 0;
      s['FT_ATT']  = s['FT'] || 0;
      delete s['FT'];
    }
  });
  return d;
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS DE CÁLCULO
═══════════════════════════════════════════════════════════════════════════ */
function pts(p) {
  const s = S.stats[p];
  return (s['2PT_MADE']||0)*2 + (s['3PT_MADE']||0)*3 + (s['FT_MADE']||0);
}

function fgPct(p) {
  const s = S.stats[p];
  const a = (s['2PT_ATT']||0) + (s['3PT_ATT']||0);
  return a > 0 ? ((s['2PT_MADE']||0) + (s['3PT_MADE']||0)) / a : null;
}

function threePct(p) {
  const s = S.stats[p];
  return s['3PT_ATT'] > 0 ? s['3PT_MADE'] / s['3PT_ATT'] : null;
}

function ftPct(p) {
  const s = S.stats[p];
  return s['FT_ATT'] > 0 ? s['FT_MADE'] / s['FT_ATT'] : null;
}

function fmtPct(v) {
  return v === null ? '--' : Math.round(v * 100) + '%';
}

function totalPts()  { return S.players.reduce((n, p) => n + pts(p), 0); }
function totalMins() { return Object.values(S.minutesPlayed).reduce((a,b) => a+b, 0); }

function fmtMin(secs) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function shortName(full) {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return full;
  const first = parts[0];
  const hasDup = S.players.some(p => p !== full && p.split(/\s+/)[0] === first);
  return hasDup ? `${first} ${parts[1].slice(0,2)}.` : first;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PERSISTENCIA
═══════════════════════════════════════════════════════════════════════════ */
let _saveTimer = null;

function scheduleSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(save, 1500);
}

function save() {
  try {
    const { history, ...toSave } = S;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch(e) { console.warn('Error guardando:', e); }
  /* La nube va DESPUÉS del guardado local y en su propio try/catch: si Firebase
     está caído o no hay internet, la app sigue exactamente como antes. */
  try { if (typeof liveOnSave === 'function') liveOnSave(); } catch(e) {}
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const d = migrateIfNeeded(JSON.parse(raw));
    S = {
      gameName:      d.gameName      ?? S.gameName,
      quarter:       d.quarter       ?? S.quarter,
      secsLeft:      d.secsLeft      ?? QUARTER_SECS,
      clockRunning:  false,
      players:       d.players       ?? S.players,
      stats:         d.stats         ?? S.stats,
      minutesPlayed: d.minutesPlayed ?? S.minutesPlayed,
      onCourt:       d.onCourt       ?? [],
      fouledOut:     d.fouledOut     ?? {},
      selected:      d.selected      ?? (d.players?.[0] ?? S.players[0]),
      history:       [],
    };
    S.players.forEach(ensurePlayer);
    // Merge any DEFAULT_PLAYERS not present in saved state (handles roster additions)
    DEFAULT_PLAYERS.forEach(p => {
      if (!S.players.includes(p)) {
        S.players.push(p);
        ensurePlayer(p);
      }
    });
    return true;
  } catch(e) { console.warn('Error cargando:', e); return false; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   RELOJ
═══════════════════════════════════════════════════════════════════════════ */
let _interval = null;

function startInterval() {
  if (_interval) return;
  _interval = setInterval(tick, 1000);
}

function tick() {
  if (!S.clockRunning) return;
  S.onCourt.forEach(p => { S.minutesPlayed[p] = (S.minutesPlayed[p]||0) + 1; });
  if (S.secsLeft > 0) {
    S.secsLeft--;
    if (S.secsLeft === 0) { S.clockRunning = false; onQuarterEnd(); }
  }
  renderClock();
  refreshMinCells();
}

function onQuarterEnd() {
  updateClockBtn();
  navigator.vibrate?.([200,100,200,100,200]);
  document.getElementById('clockDisplay')?.classList.add('flash');
  setTimeout(() => document.getElementById('clockDisplay')?.classList.remove('flash'), 2200);
  toast(`¡Fin del ${S.quarter}! 🏀`);
}

function toggleClock() {
  S.clockRunning = !S.clockRunning;
  updateClockBtn();
  scheduleSave();
}

function resetClock() {
  S.clockRunning = false;
  S.secsLeft = QUARTER_SECS;
  updateClockBtn();
  renderClock();
  scheduleSave();
}

function updateClockBtn() {
  const btn = document.getElementById('btnToggleClock');
  if (!btn) return;
  if (S.clockRunning) { btn.textContent = '⏸'; btn.classList.add('paused'); }
  else                { btn.textContent = '▶'; btn.classList.remove('paused'); }
}

function renderClock() {
  const el = document.getElementById('clockDisplay');
  if (!el) return;
  const m = Math.floor(S.secsLeft/60), s = S.secsLeft % 60;
  el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  el.className = 'clock-num';
  if (S.secsLeft <= 60)       el.classList.add('red');
  else if (S.secsLeft <= 180) el.classList.add('yellow');
}

/* ═══════════════════════════════════════════════════════════════════════════
   RENDER PRINCIPAL
═══════════════════════════════════════════════════════════════════════════ */
function renderAll() {
  document.getElementById('gameName').value = S.gameName;
  renderQuarterBtns();
  document.getElementById('clockQuarter').textContent = S.quarter;
  renderClock();
  updateClockBtn();
  renderPlayers();
  renderStatButtons();
  renderActiveBadge();
  renderScore();
  const tbl = document.getElementById('tableSection');
  if (tbl && !tbl.classList.contains('hidden')) renderTable();
}

function renderScore() {
  const el = document.getElementById('scoreVal');
  if (el) el.textContent = totalPts();
}

function renderQuarterBtns() {
  const sel = document.getElementById('quarterSelector');
  if (!sel) return;
  sel.innerHTML = '';
  QUARTERS.forEach(q => {
    const b = document.createElement('button');
    b.textContent = q; b.dataset.q = q;
    if (S.quarter === q) b.classList.add('active');
    sel.appendChild(b);
  });
}

/* Jugadores */
function renderPlayers() {
  const list = document.getElementById('playerList');
  if (!list) return;
  list.innerHTML = '';
  S.players.forEach(p => {
    const wrap = document.createElement('div');
    wrap.className = 'player-wrap';

    const btn = document.createElement('button');
    btn.className = 'player-btn';
    btn.dataset.player = p;
    btn.textContent = shortName(p);
    if (p === S.selected) btn.classList.add('selected');

    const cBtn = document.createElement('button');
    cBtn.dataset.court = p;

    if (S.fouledOut[p]) {
      btn.classList.add('fouled-out');
      cBtn.className = 'court-btn fouled-out';
      cBtn.textContent = '✕ 5 Faltas';
    } else if (S.onCourt.includes(p)) {
      btn.classList.add('on-court');
      cBtn.className = 'court-btn in';
      cBtn.textContent = '● Cancha';
    } else {
      cBtn.className = 'court-btn';
      cBtn.textContent = '○ Fuera';
    }

    wrap.append(btn, cBtn);
    list.appendChild(wrap);
  });
}

/* Botones de stats */
function renderStatButtons() {
  const grid = document.getElementById('statGrid');
  if (!grid) return;
  grid.innerHTML = '';

  /* ── Sección: Tiros ── */
  const shotLbl = document.createElement('div');
  shotLbl.className = 'stat-section-label';
  shotLbl.textContent = 'TIROS';
  grid.appendChild(shotLbl);

  SHOT_CFG.forEach(cfg => {
    const s = S.selected ? S.stats[S.selected] : null;
    const madeVal = s ? (s[cfg.madeKey]||0) : 0;
    const missVal = s ? ((s[cfg.attKey]||0) - (s[cfg.madeKey]||0)) : 0;

    const makeBtn = document.createElement('button');
    makeBtn.className = 'stat-btn shot-made';
    makeBtn.dataset.stat = cfg.madeKey;
    makeBtn.style.setProperty('--btn-color', cfg.madeColor);
    makeBtn.innerHTML =
      `<span class="stat-label">✓ ${cfg.label}</span>` +
      `<span class="stat-count" id="sc_${cfg.madeKey}">${madeVal}</span>`;

    const missBtn = document.createElement('button');
    missBtn.className = 'stat-btn shot-miss';
    missBtn.dataset.stat = cfg.attKey + '_MISS';
    missBtn.style.setProperty('--btn-color', cfg.missColor);
    missBtn.innerHTML =
      `<span class="stat-label">✗ ${cfg.label}</span>` +
      `<span class="stat-count" id="sc_${cfg.attKey}_MISS">${missVal}</span>`;

    grid.append(makeBtn, missBtn);
  });

  /* ── Sección: Estadísticas ── */
  const otherLbl = document.createElement('div');
  otherLbl.className = 'stat-section-label';
  otherLbl.textContent = 'ESTADÍSTICAS';
  grid.appendChild(otherLbl);

  STAT_CFG.forEach(cfg => {
    const btn = document.createElement('button');
    btn.className = 'stat-btn';
    btn.dataset.stat = cfg.key;
    btn.style.setProperty('--btn-color', cfg.color);
    const count = S.selected ? (S.stats[S.selected]?.[cfg.key] ?? 0) : 0;
    btn.innerHTML =
      `<span class="stat-label">${cfg.label}</span>` +
      `<span class="stat-count" id="sc_${cfg.key}">${count}</span>`;
    if (cfg.key === 'FOUL') btn.style.gridColumn = '1 / -1';
    grid.appendChild(btn);
  });
}

/* Actualiza solo los contadores (sin re-render) */
function updateCounts() {
  if (!S.selected) return;
  const s = S.stats[S.selected];
  // Shot counters
  SHOT_CFG.forEach(cfg => {
    const madeEl = document.getElementById(`sc_${cfg.madeKey}`);
    const missEl = document.getElementById(`sc_${cfg.attKey}_MISS`);
    if (madeEl) madeEl.textContent = s[cfg.madeKey] || 0;
    if (missEl) missEl.textContent = (s[cfg.attKey]||0) - (s[cfg.madeKey]||0);
  });
  // Simple stat counters
  STAT_CFG.forEach(cfg => {
    const el = document.getElementById(`sc_${cfg.key}`);
    if (el) el.textContent = s[cfg.key] || 0;
  });
}

function renderActiveBadge() {
  const nameEl   = document.getElementById('activeName');
  const statusEl = document.getElementById('activeStatus');
  if (nameEl) nameEl.textContent = S.selected || '—';
  if (statusEl) {
    if (S.fouledOut[S.selected]) {
      statusEl.textContent = '✕ Eliminado (5F)';
      statusEl.className   = 'active-status fouled-out';
    } else if (S.onCourt.includes(S.selected)) {
      statusEl.textContent = '● En cancha';
      statusEl.className   = 'active-status in';
    } else {
      statusEl.textContent = '○ Fuera';
      statusEl.className   = 'active-status out';
    }
  }
}

/* Tabla completa */
function renderTable() {
  const tbl = document.getElementById('statsTable');
  if (!tbl) return;

  const headers = ['Jugador', ...TABLE_COLS.map(c => c.h)];
  let html = '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';

  S.players.forEach(p => {
    const isSel = p === S.selected;
    const isFO  = S.fouledOut[p];
    const rowCls = [isSel ? 'selected' : '', isFO ? 'row-fouled-out' : ''].filter(Boolean).join(' ');
    html += `<tr${rowCls ? ` class="${rowCls}"` : ''}><td>${shortName(p)}${isFO ? '*' : ''}</td>`;
    TABLE_COLS.forEach(col => {
      const val = col.fn(p);
      const cls = col.cellClass ? col.cellClass(p) : '';
      html += `<td${cls ? ` class="${cls}"` : ''}>${val}</td>`;
    });
    html += '</tr>';
  });

  // Fila TOTAL
  html += '<tr class="total-row"><td>TOTAL</td>';
  TABLE_COLS.forEach(col => {
    html += `<td>${col.total()}</td>`;
  });
  html += '</tr></tbody>';

  // Nota al pie si hay eliminados
  const foList = S.players.filter(p => S.fouledOut[p]);
  if (foList.length) {
    html += `<tfoot><tr><td colspan="${headers.length}" class="foul-note">* Eliminado por 5 faltas</td></tr></tfoot>`;
  }

  tbl.innerHTML = html;
}

function refreshMinCells() {
  const tbl = document.getElementById('tableSection');
  if (!tbl || tbl.classList.contains('hidden')) return;
  const rows = document.querySelectorAll('#statsTable tbody tr:not(.total-row)');
  rows.forEach((row, i) => {
    const p = S.players[i];
    if (p) row.cells[1].textContent = fmtMin(S.minutesPlayed[p]||0);
  });
  const totRow = document.querySelector('#statsTable .total-row');
  if (totRow) totRow.cells[1].textContent = fmtMin(totalMins());
}

function updateTableRow(player) {
  const tbl = document.getElementById('tableSection');
  if (!tbl || tbl.classList.contains('hidden')) return;
  const rows = document.querySelectorAll('#statsTable tbody tr:not(.total-row)');
  const idx  = S.players.indexOf(player);
  if (idx < 0 || !rows[idx]) return;

  // Update player name (may need * for fouled out)
  rows[idx].cells[0].textContent = shortName(player) + (S.fouledOut[player] ? '*' : '');
  rows[idx].classList.toggle('row-fouled-out', !!S.fouledOut[player]);

  TABLE_COLS.forEach((col, i) => {
    const cell = rows[idx].cells[i+1];
    cell.textContent = col.fn(player);
    cell.className = col.cellClass ? (col.cellClass(player) || '') : '';
  });
  updateTotalRow();
}

function updateTotalRow() {
  const totRow = document.querySelector('#statsTable .total-row');
  if (!totRow) return;
  TABLE_COLS.forEach((col, i) => {
    totRow.cells[i+1].textContent = col.total();
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACCIONES DE JUGADORES
═══════════════════════════════════════════════════════════════════════════ */
function selectPlayer(name) {
  S.selected = name;
  document.querySelectorAll('.player-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.player === name)
  );
  renderActiveBadge();
  updateCounts();
  document.querySelectorAll('#statsTable tbody tr:not(.total-row)').forEach((row, i) => {
    row.classList.toggle('selected', S.players[i] === name);
  });
}

function toggleCourt(player) {
  if (S.fouledOut[player]) {
    toast(`${shortName(player)} fue eliminado por 5 faltas`);
    return;
  }
  haptic();
  const idx = S.onCourt.indexOf(player);
  if (idx === -1) S.onCourt.push(player);
  else            S.onCourt.splice(idx, 1);

  const on  = S.onCourt.includes(player);
  const pBtn = document.querySelector(`.player-btn[data-player="${CSS.escape(player)}"]`);
  if (pBtn) pBtn.classList.toggle('on-court', on);
  const cBtn = document.querySelector(`.court-btn[data-court="${CSS.escape(player)}"]`);
  if (cBtn) { cBtn.textContent = on ? '● Cancha' : '○ Fuera'; cBtn.classList.toggle('in', on); }

  if (player === S.selected) renderActiveBadge();
  scheduleSave();
}

/* ═══════════════════════════════════════════════════════════════════════════
   REGISTRO DE STATS Y UNDO
═══════════════════════════════════════════════════════════════════════════ */
function logStat(key) {
  if (!S.selected) { toast('Selecciona un jugador primero'); return; }
  if (S.fouledOut[S.selected]) { toast(`${shortName(S.selected)} fue eliminado por 5 faltas`); return; }
  haptic();
  sessTrack(key, S.selected);

  // Snapshot completo para undo (incluye fouledOut y onCourt)
  S.history.push({
    player: S.selected, key,
    snap:         JSON.stringify(S.stats),
    fouledOutSnap: JSON.stringify(S.fouledOut),
    onCourtSnap:   JSON.stringify(S.onCourt),
  });
  if (S.history.length > 60) S.history.shift();

  // Aplicar acción
  const st = S.stats[S.selected];
  if      (key === '2PT_MADE')          { st['2PT_MADE']++; st['2PT_ATT']++; }
  else if (key === '2PT_ATT_MISS')      { st['2PT_ATT']++; }
  else if (key === '3PT_MADE')          { st['3PT_MADE']++; st['3PT_ATT']++; }
  else if (key === '3PT_ATT_MISS')      { st['3PT_ATT']++; }
  else if (key === 'FT_MADE')           { st['FT_MADE']++; st['FT_ATT']++; }
  else if (key === 'FT_ATT_MISS')       { st['FT_ATT']++; }
  else                                   { st[key]++; }

  // Chequeo de eliminación por 5 faltas
  if (key === 'FOUL') checkFoulOut(S.selected);

  // Actualizar contadores del panel
  updateCounts();

  // Animación tap
  const statBtn = document.querySelector(`.stat-btn[data-stat="${CSS.escape(key)}"]`);
  if (statBtn) {
    statBtn.classList.remove('tapped');
    void statBtn.offsetWidth;
    statBtn.classList.add('tapped');
    statBtn.addEventListener('animationend', () => statBtn.classList.remove('tapped'), { once:true });
  }

  renderScore();
  updateTableRow(S.selected);
  appendLog(S.selected, key);
  scheduleSave();
}

function checkFoulOut(player) {
  if ((S.stats[player].FOUL || 0) < 5) return;
  S.fouledOut[player] = true;

  // Sacar de cancha automáticamente
  const idx = S.onCourt.indexOf(player);
  if (idx !== -1) S.onCourt.splice(idx, 1);

  // Actualizar botones del jugador
  const pBtn = document.querySelector(`.player-btn[data-player="${CSS.escape(player)}"]`);
  if (pBtn) { pBtn.classList.remove('on-court'); pBtn.classList.add('fouled-out'); }
  const cBtn = document.querySelector(`.court-btn[data-court="${CSS.escape(player)}"]`);
  if (cBtn) { cBtn.textContent = '✕ 5 Faltas'; cBtn.className = 'court-btn fouled-out'; }

  if (player === S.selected) renderActiveBadge();

  navigator.vibrate?.([100,50,100,50,300]);
  toast(`⚠️ ${shortName(player)} eliminado por 5 faltas`);
  appendFoulOutLog(player);
}

function undoLast() {
  if (!S.history.length) { toast('Nada que deshacer'); return; }
  haptic();
  const { player, key, snap, fouledOutSnap, onCourtSnap } = S.history.pop();
  SESS.undos++;
  S.stats    = JSON.parse(snap);
  S.fouledOut = fouledOutSnap ? JSON.parse(fouledOutSnap) : S.fouledOut;
  S.onCourt   = onCourtSnap   ? JSON.parse(onCourtSnap)   : S.onCourt;

  if (player === S.selected) updateCounts();
  renderScore();
  appendLog(player, key, true);
  updateTableRow(player);
  renderPlayers();          // re-renderizar para reflejar estado fouledOut/onCourt
  if (player === S.selected) renderActiveBadge();
  scheduleSave();
}

/* Log de acciones */
function actionLabel(key) {
  if (key === '2PT_MADE')     return '✓ 2PT';
  if (key === '2PT_ATT_MISS') return '✗ 2PT';
  if (key === '3PT_MADE')     return '✓ 3PT';
  if (key === '3PT_ATT_MISS') return '✗ 3PT';
  if (key === 'FT_MADE')      return '✓ TL';
  if (key === 'FT_ATT_MISS')  return '✗ TL';
  return STAT_CFG.find(c => c.key === key)?.label ?? key;
}

function appendLog(player, key, undo = false) {
  const log = document.getElementById('actionLog');
  if (!log) return;
  const line = document.createElement('div');
  line.className = 'log-entry' + (undo ? ' undo' : '');
  line.textContent = `${undo?'↩':'+'} ${shortName(player)} — ${actionLabel(key)} [${S.quarter}]`;
  log.insertBefore(line, log.firstChild);
  while (log.children.length > 25) log.removeChild(log.lastChild);
}

function appendFoulOutLog(player) {
  const log = document.getElementById('actionLog');
  if (!log) return;
  const line = document.createElement('div');
  line.className = 'log-entry foul-out-entry';
  line.textContent = `⚠ ${shortName(player)} ELIMINADO [${S.quarter}]`;
  log.insertBefore(line, log.firstChild);
}

/* ═══════════════════════════════════════════════════════════════════════════
   GESTIÓN DE JUGADORES
═══════════════════════════════════════════════════════════════════════════ */
function addPlayer() {
  const raw = prompt('Nombre completo del jugador:');
  if (!raw) return;
  const name = raw.trim().replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
  if (S.players.includes(name)) { toast(`${name} ya existe`); return; }
  S.players.push(name);
  ensurePlayer(name);
  renderPlayers();
  renderTable();
  scheduleSave();
}

function removePlayer() {
  if (!S.selected) return;
  if (S.players.length <= 1) { toast('Necesitas al menos un jugador'); return; }
  if (!confirm(`¿Quitar a ${S.selected}?`)) return;
  const idx = S.players.indexOf(S.selected);
  S.players.splice(idx, 1);
  delete S.stats[S.selected];
  delete S.minutesPlayed[S.selected];
  delete S.fouledOut[S.selected];
  S.onCourt = S.onCourt.filter(p => p !== S.selected);
  S.selected = S.players[Math.max(0, idx-1)];
  renderAll();
  scheduleSave();
}

/* ═══════════════════════════════════════════════════════════════════════════
   GUARDAR / CARGAR / NUEVO PARTIDO
═══════════════════════════════════════════════════════════════════════════ */
function manualSave() { save(); toast('Partido guardado ✓'); }

function manualLoad() {
  if (!confirm('¿Cargar el último partido guardado? Se perderán los cambios actuales.')) return;
  if (loadSaved()) { renderAll(); toast('Partido cargado ✓'); }
  else               toast('No hay partido guardado');
}

async function newGame() {
  if (!confirm('¿Iniciar un nuevo partido?\n\nSe guardarán las estadísticas actuales en el historial.')) return;

  // Guardar partido actual al historial si tiene datos
  if (totalPts() > 0 || S.players.some(p => S.minutesPlayed[p] > 0)) {
    const rivalScoreRaw = prompt('¿Cuántos puntos anotó el rival? (Enter para saltar)', '');
    const rivalScore    = rivalScoreRaw !== null && rivalScoreRaw.trim() !== '' ? parseInt(rivalScoreRaw) : null;
    const rivalName     = S.gameName.replace(/mba\s*vs\s*/i, '').trim() || '???';
    await saveToHistory(rivalName, rivalScore);
  }

  const opponent = prompt('Nombre del nuevo rival:', '___') || '___';
  S = newState();
  S.gameName = `MBA vs ${opponent.trim()}`;
  localStorage.removeItem(STORAGE_KEY);
  renderAll();
  toast('🔄 Nuevo partido iniciado');
}

/* ═══════════════════════════════════════════════════════════════════════════
   HISTORIAL DE PARTIDOS
═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   FIREBASE — Historial en la nube
═══════════════════════════════════════════════════════════════════════════ */
const FB_BASE = 'https://titans-tracker-default-rtdb.firebaseio.com';
const FB_NODE = 'mba_sub15';

/* ═══════════════════════════════════════════════════════════════════════════
   IDENTIDAD DEL TRACKER
   Único lugar donde se define equipo, liga, categoría, logos y colores.
   Todo el texto visible del reporte y del historial sale de aquí.
   OJO: esto NO toca nombres de campos de datos (titansScore y compañía siguen
   igual en Firebase; renombrarlos dejaría los partidos guardados en blanco).
═══════════════════════════════════════════════════════════════════════════ */
const TRACKER_ID = {
  team:       'MBA',
  league:     'Encestando Sueños',
  category:   'Sub 15',
  teamPlural: false,
  teamColor:  '#F59E0B',
  logo:       null,
  leagueLogo: null,
  theme: { base:'#C2620A', accent:'#F59E0B', ink:'#451A03', baseText:'#9A4E08' },
};


/* ═══ IDENTIDAD DEL DISPOSITIVO ═══════════════════════════════════════════ */
const DEV_ID = (() => {
  try {
    let id = localStorage.getItem('bk_device_id');
    if (!id) {
      id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('bk_device_id', id);
    }
    return id;
  } catch(e) { return 'd_anon'; }
})();

const DEV_INFO = (() => {
  const ua = navigator.userAgent;
  let device = 'Desconocido';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) device = 'iPad';
  else if (/iPhone/.test(ua))    device = 'iPhone';
  else if (/Android/.test(ua))   device = /Mobile/.test(ua) ? 'Android' : 'Tablet Android';
  else if (/Macintosh/.test(ua)) device = 'Mac';
  else if (/Windows/.test(ua))   device = 'Windows';
  let browser = 'Otro';
  if      (/CriOS|Chrome|Chromium/.test(ua)) browser = 'Chrome';
  else if (/FxiOS|Firefox/.test(ua))         browser = 'Firefox';
  else if (/Edg/.test(ua))                   browser = 'Edge';
  else if (/Safari/.test(ua))                browser = 'Safari';
  let pwa = false;
  try { pwa = window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone; } catch(e) {}
  return { device, browser, pwa, screen: `${screen.width}x${screen.height}`, lang: navigator.language || '' };
})();

let GEO = null;
async function loadGeo() {
  try {
    const cached = sessionStorage.getItem('bk_geo');
    if (cached) { GEO = JSON.parse(cached); return; }
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 4000);
    const r = await fetch('https://ipwho.is/', { signal: ctl.signal });
    const d = await r.json();
    if (d && d.success !== false) {
      GEO = { ip: d.ip || '', city: d.city || '', region: d.region || '',
              country: d.country || '', isp: (d.connection && d.connection.isp) || '' };
      sessionStorage.setItem('bk_geo', JSON.stringify(GEO));
    }
  } catch(e) {}
}

function fbLog(event, extra) {
  try { fetch(`${FB_BASE}/activity_log.json`, { method:'POST', body:JSON.stringify({ event, tracker:FB_NODE, ts:Date.now(), device:DEV_ID, devInfo:(typeof DEV_INFO!=='undefined'?DEV_INFO:null), geo:GEO||null, ...(extra||{}) }) }); } catch(e){}
}

async function appEnabled() {
  try {
    const r = await fetch(`${FB_BASE}/app_status/${FB_NODE}.json`, {cache:'no-store'});
    const v = await r.json();
    return v !== false;
  } catch(e) { return false; }
}
function showBlocked() {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;background:#0f1117;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#e2e8f0;font-family:system-ui;text-align:center;padding:24px';
  d.innerHTML = '<div style="font-size:56px">\u{1F512}</div>' +
    '<div style="font-size:22px;font-weight:700">App desactivada</div>' +
    '<div style="color:#94a3b8;max-width:320px;line-height:1.5">Esta app est\u00e1 temporalmente desactivada por el administrador. Se necesita conexi\u00f3n a internet y autorizaci\u00f3n para usarla.</div>' +
    '<button onclick="location.reload()" style="margin-top:12px;padding:10px 28px;border-radius:8px;border:none;background:#3b82f6;color:#fff;font-size:14px;font-weight:600;cursor:pointer">Reintentar</button>';
  document.body.appendChild(d);
}

/* ═══ TELEMETRÍA DE SESIÓN ═══════════════════════════════════════════════ */
const SESSION_ID    = FB_NODE + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const SESSION_START = Date.now();
const SESS = { stats:0, undos:0, byStat:{}, byPlayer:{}, byQuarter:{}, saves:0, first:0, last:0 };

function sessTrack(key, player) {
  SESS.stats++;
  SESS.byStat[key]      = (SESS.byStat[key]      || 0) + 1;
  if (player) SESS.byPlayer[player] = (SESS.byPlayer[player] || 0) + 1;
  SESS.byQuarter[S.quarter] = (SESS.byQuarter[S.quarter] || 0) + 1;
  if (!SESS.first) SESS.first = Date.now();
  SESS.last = Date.now();
}

function sessFlush(closed) {
  const now = Date.now();
  const body = {
    tracker:     FB_NODE,
    device:      DEV_ID,
    devInfo:     DEV_INFO,
    geo:         GEO || null,
    start:       SESSION_START,
    end:         now,
    minutes:     Math.round((now - SESSION_START) / 60000),
    activeMin:   SESS.first ? Math.round((SESS.last - SESS.first) / 60000) : 0,
    gameName:    (typeof S !== 'undefined' && S.gameName)  || '',
    quarter:     (typeof S !== 'undefined' && S.quarter)   || '',
    score:       (typeof totalPts === 'function') ? totalPts() : 0,
    players:     (typeof S !== 'undefined' && S.players)   || [],
    stats:       SESS.stats,
    undos:       SESS.undos,
    byStat:      SESS.byStat,
    byPlayer:    SESS.byPlayer,
    byQuarter:   SESS.byQuarter,
    saves:       SESS.saves,
    closed:      !!closed,
  };
  try {
    fetch(`${FB_BASE}/sessions/${SESSION_ID}.json`,
          { method:'PUT', body: JSON.stringify(body), keepalive: !!closed });
  } catch(e) {}
}

function sessStart() {
  loadGeo().then(() => sessFlush(false));
  sessFlush(false);
  setInterval(() => sessFlush(false), 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sessFlush(true);
  });
  window.addEventListener('pagehide', () => sessFlush(true));
}

async function fbGet() {
  try {
    const res = await fetch(`${FB_BASE}/${FB_NODE}/history.json?orderBy="$key"`);
    if (!res.ok) throw new Error('offline');
    const data = await res.json();
    if (!data) return [];
    return Object.entries(data)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([fbKey, game]) => ({...game, _fbKey: fbKey}));
  } catch(e) {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]'); }
    catch(_) { return []; }
  }
}

async function fbPush(game) {
  try {
    const res = await fetch(`${FB_BASE}/${FB_NODE}/history.json`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(game)
    });
    const {name: fbKey} = await res.json();
    try {
      const local = JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
      local.push(game);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(local));
    } catch(_) {}
    fbLog('history_save', { gameName: game.gameName||'', rivalName: game.rivalName||'', titansScore: game.titansScore??null, rivalScore: game.rivalScore??null, players: game.players||[] });
    SESS.saves++; sessFlush(false);
    return fbKey;
  } catch(e) {
    try {
      const local = JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
      local.push(game);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(local));
    } catch(_) {}
    return null;
  }
}

async function fbDelete(fbKey) {
  if (!fbKey) return;
  try {
    await fetch(`${FB_BASE}/${FB_NODE}/history/${fbKey}.json`, {method: 'DELETE'});
  } catch(e) { console.warn('Delete failed (offline?):', e); }
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch(e) { return []; }
}

async function saveToHistory(rivalName, rivalScore) {
  const game = {
    date:          new Date().toLocaleDateString('es-ES'),
    gameName:      S.gameName,
    rivalName,
    titansScore:   totalPts(),
    rivalScore,
    stats:         JSON.parse(JSON.stringify(S.stats)),
    minutesPlayed: JSON.parse(JSON.stringify(S.minutesPlayed||{})),
    fouledOut:     JSON.parse(JSON.stringify(S.fouledOut||{})),
    players:       [...S.players],
  };
  const fbKey = await fbPush(game);
  toast('📚 Partido guardado en historial');
  return fbKey;
}

/* ¿Hay algo que guardar en el partido en curso? */
function hasCurrentGameData() {
  return totalPts() > 0 || S.players.some(p => (S.minutesPlayed[p]||0) > 0);
}

/* Guarda el partido en curso con el marcador del rival ya resuelto.
   La usa el botón del Historial. NO abre ningún prompt: el Historial vive en
   otra ventana y, mientras esa ventana tiene el foco, el navegador descarta
   los diálogos de la ventana de la app — el prompt volvía null y el guardado
   se cancelaba en silencio. El campo de puntos del rival ahora está dentro
   del Historial y el valor llega por parámetro.
   Devuelve {ok, error} para que el Historial pueda mostrar qué pasó. */
async function saveCurrentToHistoryWithScore(rivalScore) {
  if (!hasCurrentGameData())
    return { ok:false, sinPartido:true,
             error:'la app no tiene ningún partido cargado en este dispositivo. Las '
                 + 'estadísticas viven en el equipo donde se marcaron: si el partido lo '
                 + 'marcaste en otro celular, tablet o navegador, súbelo desde ese equipo.' };
  const rivalName = S.gameName.replace(/.*vs\s*/i, '').trim() || '???';
  let fbKey = null;
  try {
    fbKey = await saveToHistory(rivalName, rivalScore);
  } catch (e) {
    return { ok:false, error:(e && e.message) || 'error inesperado al guardar' };
  }
  if (!fbKey)
    return { ok:false, offline:true,
             error:'no se pudo llegar a Firebase. El partido quedó guardado solo en este dispositivo; con internet, vuelve a intentarlo.' };
  return { ok:true, fbKey };
}

/* Compatibilidad: mismo comportamiento de siempre, con prompt. Sirve cuando se
   llama desde la propia ventana de la app (donde el prompt sí se muestra). */
async function saveCurrentToHistory() {
  if (!hasCurrentGameData()) {
    toast('No hay estadísticas para guardar en el historial');
    return false;
  }
  const rivalScoreRaw = prompt('¿Cuántos puntos hizo el rival? (Enter para saltar)', '');
  if (rivalScoreRaw === null) return false;  // cancelled
  const rivalScore = rivalScoreRaw.trim() !== '' ? parseInt(rivalScoreRaw, 10) : null;
  const r = await saveCurrentToHistoryWithScore(rivalScore);
  return !!(r && r.ok);
}

async function openHistorial() {
  const history = await fbGet();
  const T = TRACKER_ID;
  const cur = { name: S.gameName, pts: totalPts(), hasData: hasCurrentGameData() };
  const SIN_PARTIDO_MSG = 'La app no tiene ningún partido cargado en este dispositivo. '
    + 'El Historial sube el partido que esté abierto en la app, y las estadísticas viven '
    + 'en el equipo donde se marcaron. Si el partido lo marcaste en otro celular, tablet o '
    + 'navegador, tienes que subirlo desde ese mismo equipo.';

  /* ── Season totals per player ── */
  const allPlayers = [...new Set(history.flatMap(g => g.players))];
  const seasonStats = {};
  allPlayers.forEach(p => {
    seasonStats[p] = { gp:0, pts:0, fg2m:0,fg2a:0, fg3m:0,fg3a:0, ftm:0,fta:0,
                       reb:0, ast:0, tov:0, stl:0, blk:0, foul:0, mins:0 };
  });
  history.forEach(g => {
    g.players.forEach(p => {
      const s = g.stats[p]; if (!s) return;
      const ss = seasonStats[p];
      const gpts = (s['2PT_MADE']||0)*2 + (s['3PT_MADE']||0)*3 + (s['FT_MADE']||0);
      if (gpts > 0 || (g.minutesPlayed[p]||0) > 0) ss.gp++;
      ss.pts  += gpts;
      ss.fg2m += s['2PT_MADE']||0; ss.fg2a += s['2PT_ATT']||0;
      ss.fg3m += s['3PT_MADE']||0; ss.fg3a += s['3PT_ATT']||0;
      ss.ftm  += s['FT_MADE']||0;  ss.fta  += s['FT_ATT']||0;
      ss.reb  += (s.REB_OFF||0)+(s.REB_DEF||0);
      ss.ast  += s.AST||0; ss.tov += s.TOV||0;
      ss.stl  += s.STL||0; ss.blk += s.BLK||0; ss.foul += s.FOUL||0;
      ss.mins += g.minutesPlayed[p]||0;
    });
  });

  const avg = (v, gp) => gp > 0 ? (v/gp).toFixed(1) : '--';
  const pct  = (m, a) => a > 0 ? Math.round(m/a*100)+'%' : '--';

  /* ── Record ── */
  let W=0, L=0, D=0;
  history.forEach(g => {
    if (g.rivalScore === null || g.rivalScore === undefined) return;
    if (g.titansScore > g.rivalScore) W++;
    else if (g.titansScore < g.rivalScore) L++;
    else D++;
  });

  /* ── SVG line chart ── */
  function sparkline(playerName) {
    const games = history.filter(g => g.players.includes(playerName));
    if (games.length < 2) return '<em style="color:#6f675c;font-size:0.75rem">Pocos partidos</em>';
    const vals = games.map(g => {
      const s = g.stats[playerName] || {};
      return (s['2PT_MADE']||0)*2 + (s['3PT_MADE']||0)*3 + (s['FT_MADE']||0);
    });
    const max = Math.max(...vals, 1);
    const W2 = 160, H2 = 40, pad = 6;
    const points = vals.map((v, i) => {
      const x = pad + (i / (vals.length-1)) * (W2 - pad*2);
      const y = H2 - pad - (v / max) * (H2 - pad*2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const dots = vals.map((v, i) => {
      const x = pad + (i / (vals.length-1)) * (W2 - pad*2);
      const y = H2 - pad - (v / max) * (H2 - pad*2);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${T.theme.accent}"/>
              <title>Partido ${i+1}: ${v} pts</title>`;
    }).join('');
    return `<svg width="${W2}" height="${H2}" style="overflow:visible" role="img" aria-label="Progresión de puntos de ${playerName}">
      <polyline points="${points}" fill="none" stroke="${T.theme.base}" stroke-width="2" stroke-linejoin="round"/>
      ${dots}
    </svg>`;
  }

  /* ── Games list HTML ── */
  const gamesHtml = history.length === 0
    ? '<p class="empty-state">No hay partidos registrados aún.</p>'
    : [...history].reverse().map((g, ri) => {
        const i = history.length - 1 - ri;
        const won  = g.rivalScore !== null && g.rivalScore !== undefined && g.titansScore > g.rivalScore;
        const lost = g.rivalScore !== null && g.rivalScore !== undefined && g.titansScore < g.rivalScore;
        const tied = g.rivalScore !== null && g.rivalScore !== undefined && g.titansScore === g.rivalScore;
        const result = won ? '✅' : lost ? '❌' : tied ? '🟡' : '';
        const resClass = won ? 'res-win' : lost ? 'res-loss' : tied ? 'res-draw' : '';
        const scoreStr = g.rivalScore !== null && g.rivalScore !== undefined
          ? `${g.titansScore} — ${g.rivalScore}` : `${g.titansScore} — ?`;
        return `<details class="game-item ${resClass}">
          <summary>
            <span class="game-result">${result}</span>
            <span class="game-title">${T.team} vs ${g.rivalName}</span>
            <span class="game-score">${scoreStr}</span>
            <span class="game-date">${g.date}</span>
            <button class="del-game-btn" onclick="event.preventDefault();event.stopPropagation();deleteGame('${g._fbKey||''}',${i})" title="Eliminar partido" aria-label="Eliminar partido">🗑️</button>
          </summary>
          <div class="game-detail">
            <table class="h-table">
              <thead><tr><th>Jugador</th><th>MIN</th><th>PTS</th><th>2PT M/A</th><th>3PT M/A</th><th>TL M/A</th><th>FG%</th><th>REB</th><th>AST</th><th>TOV</th><th>FALT</th></tr></thead>
              <tbody>${g.players.map(p => {
                const s = g.stats[p]||{};
                const gpts = (s['2PT_MADE']||0)*2+(s['3PT_MADE']||0)*3+(s['FT_MADE']||0);
                const fgm = (s['2PT_MADE']||0)+(s['3PT_MADE']||0);
                const fga = (s['2PT_ATT']||0)+(s['3PT_ATT']||0);
                return `<tr>
                  <td>${p}</td>
                  <td>${fmtMin(g.minutesPlayed[p]||0)}</td>
                  <td><b>${gpts}</b></td>
                  <td>${s['2PT_MADE']||0}/${s['2PT_ATT']||0}</td>
                  <td>${s['3PT_MADE']||0}/${s['3PT_ATT']||0}</td>
                  <td>${s['FT_MADE']||0}/${s['FT_ATT']||0}</td>
                  <td>${fga>0?Math.round(fgm/fga*100)+'%':'--'}</td>
                  <td>${(s.REB_OFF||0)+(s.REB_DEF||0)}</td>
                  <td>${s.AST||0}</td><td>${s.TOV||0}</td><td>${s.FOUL||0}</td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          </div>
        </details>`;
      }).join('');

  /* ── Season table HTML ── */
  const seasonHtml = allPlayers
    .filter(p => seasonStats[p].gp > 0)
    .sort((a,b) => seasonStats[b].pts - seasonStats[a].pts)
    .map(p => {
      const ss = seasonStats[p];
      return `<tr>
        <td><b>${p}</b></td>
        <td>${ss.gp}</td>
        <td>${avg(ss.pts, ss.gp)}</td>
        <td>${pct(ss.fg2m+ss.fg3m, ss.fg2a+ss.fg3a)}</td>
        <td>${pct(ss.fg3m, ss.fg3a)}</td>
        <td>${pct(ss.ftm, ss.fta)}</td>
        <td>${avg(ss.reb, ss.gp)}</td>
        <td>${avg(ss.ast, ss.gp)}</td>
        <td>${avg(ss.tov, ss.gp)}</td>
        <td>${avg(ss.foul, ss.gp)}</td>
        <td style="padding:4px 8px">${sparkline(p)}</td>
      </tr>`;
    }).join('');

  const html = `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Historial — ${T.team} ${T.category}</title>
<style>
${idStyles()}
  .record{display:flex;gap:12px;margin-bottom:30px;flex-wrap:wrap}
  .rec-box{flex:1 1 90px;text-align:center;padding:14px 12px;border-radius:2px;border:1px solid var(--rule);background:var(--paper-2)}
  .rec-box .num{font-family:var(--serif);font-size:2.4rem;font-weight:700;line-height:1}
  .rec-box .lbl{font-size:0.62rem;font-weight:700;letter-spacing:0.16em;margin-top:4px;color:var(--muted)}
  .rec-box.win .num{color:#1a6b3c}.rec-box.loss .num{color:#a02020}.rec-box.draw .num{color:var(--ink)}
  .rec-box.win{border-top:3px solid #1a6b3c}.rec-box.loss{border-top:3px solid #a02020}.rec-box.draw{border-top:3px solid var(--base)}
  .game-item{border:1px solid var(--rule);border-radius:2px;margin-bottom:8px;overflow:hidden;background:#fff;
             break-inside:avoid;page-break-inside:avoid}
  .game-item summary{display:flex;align-items:center;gap:10px;padding:11px 14px;cursor:pointer;
                     list-style:none;background:var(--paper-2);font-weight:600;flex-wrap:wrap}
  .game-item summary::-webkit-details-marker{display:none}
  .game-item[open] summary{background:#fff;border-bottom:1px solid var(--rule)}
  .game-item.res-win summary{border-left:4px solid #1a6b3c}
  .game-item.res-loss summary{border-left:4px solid #a02020}
  .game-item.res-draw summary{border-left:4px solid var(--base)}
  .game-result{font-size:0.95rem;flex-shrink:0}
  .game-title{flex:1 1 140px;font-size:0.95rem;font-family:var(--serif);font-weight:600}
  .game-score{font-family:var(--serif);font-weight:700;font-size:1.05rem;color:var(--ink);flex-shrink:0}
  .game-date{font-size:0.72rem;color:var(--muted);flex-shrink:0}
  .game-detail{padding:12px;overflow-x:auto;-webkit-overflow-scrolling:touch}
  .h-table{border-collapse:collapse;min-width:100%;font-size:0.78rem;white-space:nowrap}
  .h-table th{background:var(--ink);color:#fff;padding:6px 8px;text-align:center;font-weight:700;
              font-size:0.66rem;letter-spacing:0.06em;text-transform:uppercase}
  .h-table th:first-child{text-align:left}
  .h-table td{padding:5px 8px;text-align:center;border-bottom:1px solid var(--rule)}
  .h-table td:first-child{text-align:left}
  .h-table tr:nth-child(even) td{background:var(--paper-2)}
  .season-table{border-collapse:collapse;min-width:100%;font-size:0.78rem;white-space:nowrap}
  .season-table th{background:var(--ink);color:#fff;padding:7px 8px;text-align:center;font-weight:700;
                   font-size:0.66rem;letter-spacing:0.06em;text-transform:uppercase}
  .season-table th:first-child{text-align:left}
  .season-table td{padding:6px 8px;text-align:center;border-bottom:1px solid var(--rule)}
  .season-table td:first-child{text-align:left;font-weight:600}
  .season-table tr:nth-child(even) td{background:var(--paper-2)}
  .tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--rule);border-radius:2px}
  .empty-state{color:var(--muted);padding:20px;text-align:center;font-style:italic;
               border:1px dashed var(--rule);border-radius:2px}
  .save-bar{background:var(--paper-2);border:1px solid var(--rule);border-left:4px solid var(--base);
            border-radius:2px;padding:14px 16px;margin-bottom:22px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .save-bar-label{color:var(--ink);font-size:0.85rem;flex:1 1 160px;margin:0}
  .save-bar-text{flex:1 1 200px;min-width:0}
  .save-bar-game{font-size:0.76rem;color:var(--muted);margin-top:3px}
  .save-bar-game.sin-partido{color:#7d1a1a;font-weight:700}
  .rival-field{display:flex;flex-direction:column;gap:3px;font-size:0.66rem;font-weight:700;
               letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);flex-shrink:0}
  .rival-field input{width:84px;padding:8px 10px;border:1px solid var(--rule);border-radius:2px;
                     font-size:1rem;font-family:var(--serif);font-weight:700;color:var(--text);
                     background:#fff;text-align:center}
  .rival-field input:focus-visible{outline:3px solid var(--accent);outline-offset:1px}
  .save-current-btn{background:#1a6b3c;color:#fff;border:none;border-radius:2px;padding:11px 18px;
                    font-size:0.9rem;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;font-family:inherit}
  .save-current-btn:hover{background:#14532b}
  .save-current-btn:disabled,.rival-field input:disabled{opacity:0.5;cursor:not-allowed}
  .save-msg{margin:-14px 0 20px;padding:10px 14px;border-radius:2px;font-size:0.86rem;font-weight:600}
  .save-msg.ok{background:#e8f3ec;color:#14532b;border-left:4px solid #1a6b3c}
  .save-msg.err{background:#fbeaea;color:#7d1a1a;border-left:4px solid #a02020}
  .del-game-btn{margin-left:auto;background:none;border:none;font-size:1rem;cursor:pointer;opacity:0.45;
                padding:3px 6px;border-radius:2px;flex-shrink:0;line-height:1}
  .del-game-btn:hover{opacity:1;background:#fbe9e9}
  @media print{.print-btn,.save-bar,.save-msg,.del-game-btn{display:none}
    .game-item{border-color:#bbb}
    details{display:block}
    details>summary{list-style:none}}
</style>
</head>
<script>
/* El guardado ocurre aquí, en la ventana del Historial. No se usa prompt():
   mientras esta ventana tiene el foco, el navegador descarta los diálogos de
   la ventana de la app, y el guardado se cancelaba en silencio. */
function saveMsg(texto, clase) {
  const el = document.getElementById('saveMsg');
  el.textContent = texto;
  el.className = 'save-msg ' + clase;
  el.hidden = false;
}
async function doSaveCurrent() {
  const btn = document.getElementById('btnSaveCurrent');
  if (!window.opener || window.opener.closed) {
    saveMsg('Se perdió el vínculo con la app. Cierra esta ventana y vuelve a abrir el Historial desde la app.', 'err');
    return;
  }
  const raw = (document.getElementById('rivalPts').value || '').trim();
  // Sin regex a propósito: este script viaja dentro de un template literal y
  // ahí las barras invertidas se pierden (un /^\d+$/ se emitía como /^d+$/ y
  // rechazaba todos los números). Number.isInteger no necesita escapes.
  const n = Number(raw);
  if (raw !== '' && (!Number.isInteger(n) || n < 0 || n > 999)) {
    saveMsg('Los puntos del rival tienen que ser un número entero entre 0 y 999. Déjalo vacío si no lo sabes.', 'err');
    return;
  }
  const rivalScore = raw === '' ? null : n;
  btn.disabled = true;
  saveMsg('Guardando…', 'ok');
  let r;
  try { r = await window.opener.saveCurrentToHistoryWithScore(rivalScore); }
  catch (e) { r = { ok:false, error:(e && e.message) || 'error inesperado' }; }
  if (r && r.ok) {
    saveMsg('✓ Partido guardado en el historial', 'ok');
    window.opener.openHistorial();
    window.close();
  } else {
    btn.disabled = false;
    saveMsg('No se guardó: ' + ((r && r.error) || 'error desconocido'), 'err');
  }
}
function onRivalKey(e) { if (e.key === 'Enter') { e.preventDefault(); doSaveCurrent(); } }
async function deleteGame(fbKey, idx) {
  if (!confirm('¿Eliminar este partido del historial? Esta acción no se puede deshacer.')) return;
  if (!window.opener || window.opener.closed) { alert('Cierra y vuelve a abrir el historial desde la app.'); return; }
  await window.opener.fbDelete(fbKey);
  window.opener.openHistorial();
  window.close();
}
</script>
<body><div class="page">
  <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  <div class="save-bar">
    <div class="save-bar-text">
      <p class="save-bar-label">¿Terminaste el partido? Guárdalo para que aparezca en el historial.</p>
      <p class="save-bar-game${cur.hasData ? '' : ' sin-partido'}">${cur.hasData
        ? `${cur.name} · ${cur.pts} punto${cur.pts!==1?'s':''} cargados en la app`
        : '⚠️ La app no tiene ningún partido cargado en este dispositivo'}</p>
    </div>
    <label class="rival-field" for="rivalPts">Puntos del rival
      <input id="rivalPts" type="number" min="0" max="999" step="1" inputmode="numeric"
             placeholder="—" onkeydown="onRivalKey(event)">
    </label>
    <button class="save-current-btn" id="btnSaveCurrent" onclick="doSaveCurrent()">💾 Guardar Partido Actual</button>
  </div>
  <p id="saveMsg" class="save-msg${cur.hasData ? '' : ' err'}"${cur.hasData ? ' hidden' : ''}>${cur.hasData ? '' : SIN_PARTIDO_MSG}</p>

  ${idHeader('Historial de temporada', `${history.length} partido${history.length!==1?'s':''} registrado${history.length!==1?'s':''}`)}

  <div class="record">
    <div class="rec-box win"><div class="num">${W}</div><div class="lbl">VICTORIAS</div></div>
    <div class="rec-box loss"><div class="num">${L}</div><div class="lbl">DERROTAS</div></div>
    <div class="rec-box draw"><div class="num">${D}</div><div class="lbl">EMPATES</div></div>
  </div>

  <section>
    <h2>Partidos Jugados</h2>
    ${gamesHtml}
  </section>

  <section>
    <h2>Promedios de Temporada</h2>
    <div class="tbl-wrap">
      <table class="season-table">
        <thead><tr>
          <th>Jugador</th><th>PJ</th><th>PTS/J</th><th>FG%</th><th>3PT%</th><th>FT%</th>
          <th>REB/J</th><th>AST/J</th><th>TOV/J</th><th>FALT/J</th><th>Progresión PTS</th>
        </tr></thead>
        <tbody>${seasonHtml || '<tr><td colspan="11" style="text-align:center;color:#6f675c;padding:14px">Sin datos aún</td></tr>'}</tbody>
      </table>
    </div>
  </section>

  ${idFooter()}
</div></body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
  else toast('Permite ventanas emergentes para ver el historial');
}

/* ═══════════════════════════════════════════════════════════════════════════
   IDENTIDAD VISUAL COMPARTIDA (reporte + historial)
   Todo sale de TRACKER_ID: equipo, liga, categoría, logos y colores.
═══════════════════════════════════════════════════════════════════════════ */

/* Insignia de liga: logo embebido si existe, si no un distintivo tipográfico. */
function idLeagueBadge() {
  const T = TRACKER_ID;
  if (T.leagueLogo) return `<img class="lg-mark" src="${T.leagueLogo}" alt="${T.league}">`;
  const initials = T.league.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0,2);
  return `<svg class="lg-mark" viewBox="0 0 120 120" role="img" aria-label="${T.league}">
    <circle cx="60" cy="60" r="56" fill="none" stroke="${T.theme.base}" stroke-width="3"/>
    <circle cx="60" cy="60" r="48" fill="${T.theme.ink}"/>
    <text x="60" y="60" text-anchor="middle" dominant-baseline="central"
          font-family="Georgia,'Times New Roman',serif" font-size="40" font-weight="700"
          fill="#ffffff" letter-spacing="1">${initials}</text>
    <path d="M14 60 A46 46 0 0 1 106 60" fill="none" stroke="${T.theme.accent}" stroke-width="2"/>
  </svg>`;
}

/* Logo del equipo: imagen embebida o wordmark tipográfico. */
function idTeamMark() {
  const T = TRACKER_ID;
  if (T.logo) return `<img class="tm-mark" src="${T.logo}" alt="${T.team}">`;
  return `<div class="tm-wordmark" style="color:${T.theme.ink};border-color:${T.theme.base}">
    <span class="tm-wordmark-main">${T.team}</span>
    <span class="tm-wordmark-sub">${T.league}</span>
  </div>`;
}

/* Cabecera editorial común. */
function idHeader(kicker, meta) {
  const T = TRACKER_ID;
  return `<header class="id-header">
    <div class="id-marks">${idTeamMark()}${idLeagueBadge()}</div>
    <div class="id-lines">
      <p class="id-kicker">${kicker}</p>
      <h1 class="id-team">${T.team}</h1>
      <p class="id-league">${T.team} · ${T.league} · ${T.category}</p>
      ${meta ? `<p class="id-meta">${meta}</p>` : ''}
    </div>
  </header>`;
}

function idFooter() {
  const T = TRACKER_ID;
  return `<footer class="id-footer">${T.team} · ${T.league} · ${T.category} — generado por el tracker de estadísticas</footer>`;
}

/* CSS común: papel, serif editorial y los tres colores de la liga. */
function idStyles() {
  const T = TRACKER_ID;
  return `
  :root{
    --base:${T.theme.base}; --accent:${T.theme.accent}; --ink:${T.theme.ink};
    --base-text:${T.theme.baseText || T.theme.base};
    --team:${T.teamColor || T.theme.accent};
    --paper:#faf8f4; --paper-2:#f4f1ea; --rule:#e0dbd0; --text:#241f1a; --muted:#6f675c;
    --serif:Georgia,'Iowan Old Style','Times New Roman',serif;
    --sans:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{max-width:100%;overflow-x:hidden}
  body{font-family:var(--sans);background:var(--paper-2);color:var(--text);font-size:14px;
       -webkit-text-size-adjust:100%}
  .page{max-width:860px;margin:0 auto;background:var(--paper);padding:36px 32px 28px;
        border-top:6px solid var(--base);box-shadow:0 1px 3px rgba(0,0,0,0.06)}
  /* Cabecera */
  .id-header{display:flex;align-items:center;gap:20px;flex-wrap:wrap;
             border-bottom:1px solid var(--rule);padding-bottom:18px;margin-bottom:8px}
  .id-marks{display:flex;align-items:center;gap:12px;flex-shrink:0}
  .tm-mark{width:66px;height:66px;object-fit:contain;display:block}
  .lg-mark{width:52px;height:52px;object-fit:contain;display:block}
  .tm-wordmark{display:flex;flex-direction:column;justify-content:center;padding:8px 14px;
               border-left:4px solid;min-height:60px}
  .tm-wordmark-main{font-family:var(--serif);font-size:1.9rem;font-weight:700;line-height:1;letter-spacing:0.02em}
  .tm-wordmark-sub{font-size:0.6rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;
                   margin-top:4px;color:var(--muted)}
  .id-lines{flex:1 1 200px;min-width:0}
  .id-kicker{font-size:0.64rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:var(--base-text)}
  .id-team{font-family:var(--serif);font-size:2rem;font-weight:700;line-height:1.1;margin:2px 0 4px;color:var(--ink);
           display:inline-block;background:linear-gradient(transparent 64%,var(--team) 64%);padding:0 2px}
  .id-league{font-size:0.78rem;font-weight:600;letter-spacing:0.04em;color:var(--muted)}
  .id-meta{font-size:0.74rem;color:var(--muted);margin-top:3px}
  .id-footer{margin-top:28px;padding-top:12px;border-top:1px solid var(--rule);
             font-size:0.68rem;color:var(--muted);text-align:center;letter-spacing:0.04em}
  /* Secciones */
  section{margin-bottom:30px;break-inside:avoid;page-break-inside:avoid}
  section h2,section h3{font-family:var(--sans);font-size:0.68rem;font-weight:800;letter-spacing:0.16em;
    text-transform:uppercase;color:#fff;background:var(--ink);padding:7px 12px;border-radius:2px;
    margin-bottom:14px;break-after:avoid;page-break-after:avoid}
  section p{line-height:1.7;color:var(--text)}
  h1,h2,h3,tr,.kpi,.top-player,.tip{break-inside:avoid;page-break-inside:avoid}
  /* Botón imprimir */
  .print-btn{display:block;margin:0 auto 26px;padding:11px 30px;background:var(--ink);color:#fff;
             border:none;border-radius:2px;font-size:0.95rem;font-weight:700;cursor:pointer;
             letter-spacing:0.05em;font-family:inherit}
  .print-btn:hover{background:var(--base-text)}
  .print-btn:focus-visible,.save-current-btn:focus-visible,.del-game-btn:focus-visible,
  summary:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
  @media (max-width:520px){
    .page{padding:22px 16px 20px}
    .id-team{font-size:1.6rem}
    .tm-mark{width:52px;height:52px}
    .lg-mark{width:42px;height:42px}
  }
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  @media print{
    body{background:#fff}
    .page{padding:16px;box-shadow:none;max-width:100%;border-top-width:4px}
    .print-btn{display:none}
    section h2,section h3{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    thead{display:table-header-group}
    tfoot{display:table-footer-group}
    tr,img,svg{break-inside:avoid;page-break-inside:avoid}
    /* En papel no hay scroll: los contenedores deben soltar el recorte y las
       tablas anchas encogerse para que no se corten columnas. */
    .table-scroll,.tbl-wrap,.game-detail{overflow:visible!important;border:none}
    .stats-table,.season-table,.h-table{min-width:0!important;width:100%!important;
      table-layout:fixed;font-size:0.6rem}
    .stats-table th,.stats-table td,.season-table th,.season-table td,
    .h-table th,.h-table td{padding:3px 2px;white-space:normal;word-break:break-word;
      overflow-wrap:anywhere}
    .stats-table th:first-child,.stats-table td:first-child{width:13%}
    .stats-table th:last-child,.stats-table td:last-child{width:11%}
    .season-table th:first-child,.season-table td:first-child,
    .h-table th:first-child,.h-table td:first-child{width:16%}
    .season-table th:last-child,.season-table td:last-child{width:16%}
    details{display:block}details>summary{list-style:none}
    details:not([open])>.game-detail{display:none}
  }`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   REPORTE DE PARTIDO
═══════════════════════════════════════════════════════════════════════════ */
function pct1(v) { return v === null ? '--' : (Math.round(v * 1000)/10) + '%'; }

/* Concordancia del nombre del equipo en el resumen narrativo. */
function teamSubject() {
  const T = TRACKER_ID;
  return T.teamPlural ? `Los ${T.team}` : T.team;
}
function teamVerb(plural, singular) {
  return TRACKER_ID.teamPlural ? plural : singular;
}

function reportSummaryText(rivalPts) {
  const teamPts = totalPts();
  const sorted  = [...S.players].filter(p => pts(p) > 0).sort((a,b) => pts(b)-pts(a));
  const mvp     = sorted[0];
  const second  = sorted[1];
  let txt = '';

  if (rivalPts !== null) {
    const diff = teamPts - rivalPts;
    if (diff > 0)      txt += `${teamSubject()} ${teamVerb('se impusieron','se impuso')} por ${teamPts} a ${rivalPts}, logrando una victoria por ${diff} punto${diff!==1?'s':''}. `;
    else if (diff < 0) txt += `${teamSubject()} ${teamVerb('cayeron','cayó')} por ${rivalPts} a ${teamPts}, una derrota por ${Math.abs(diff)} punto${Math.abs(diff)!==1?'s':''}. `;
    else               txt += `El partido terminó en un empate ${teamPts}-${rivalPts}. `;
  } else {
    txt += `${teamSubject()} ${teamVerb('anotaron','anotó')} ${teamPts} puntos en total. `;
  }

  if (mvp) {
    txt += `El equipo se apoyó en el rendimiento de ${mvp} (${pts(mvp)} PT`;
    const fg = fgPct(mvp);
    if (fg !== null) txt += `, ${pct1(fg)} FG`;
    txt += `). `;
  }
  if (second) txt += `${second} fue el segundo anotador con ${pts(second)} puntos. `;

  const ftA = totStat('FT_ATT'), ftM = totStat('FT_MADE');
  if (ftA >= 5) {
    const fp = ftM / ftA;
    if (fp < 0.50) txt += `El equipo mostró debilidades en el tiro libre (${pct1(fp)}), un área clave a trabajar. `;
    else if (fp >= 0.75) txt += `El tiro libre fue una fortaleza del equipo (${pct1(fp)}). `;
  }

  const tov = totStat('TOV');
  if (tov > 15)     txt += `Las ${tov} pérdidas de balón fueron un factor negativo a corregir. `;
  else if (tov <= 8) txt += `El equipo manejó bien el balón con solo ${tov} pérdidas. `;

  return txt || 'Partido completado.';
}

function reportRecommendations() {
  const recs = [];

  const ftA = totStat('FT_ATT'), ftM = totStat('FT_MADE');
  if (ftA >= 5 && ftM/ftA < 0.50)
    recs.push(`Práctica de tiros libres: el equipo estuvo al ${pct1(ftM/ftA)} — meta mínima 60%.`);

  const thA = totStat('3PT_ATT'), thM = totStat('3PT_MADE');
  if (thA === 0 || (thA > 0 && thM/thA < 0.25))
    recs.push('Desarrollar el juego perimetral: identificar tiradores de 3 puntos confiables para abrir la cancha.');

  const tov = totStat('TOV');
  if (tov > 15)
    recs.push(`Reducir pérdidas de balón: ${tov} turnovers totales. Trabajar transiciones y toma de decisiones.`);

  const elim = S.players.filter(p => S.fouledOut[p]);
  if (elim.length)
    recs.push(`Disciplina defensiva: ${elim.map(shortName).join(', ')} fue${elim.length>1?'ron':''} eliminado${elim.length>1?'s':''} por 5 faltas.`);

  const nearFO = S.players.filter(p => (S.stats[p].FOUL||0) >= 4 && !S.fouledOut[p]);
  if (nearFO.length)
    recs.push(`Control de faltas: ${nearFO.map(shortName).join(', ')} terminó con 4 faltas — cuidar la defensa individual.`);

  if (!recs.length) recs.push('Buen partido general. Mantener el nivel de ejecución y seguir trabajando la unidad de equipo.');
  return recs;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANÁLISIS PROFUNDO
   Métricas derivadas de los mismos datos ya registrados. No cambia nada de lo
   que se guarda: solo lee stats/minutesPlayed/fouledOut del partido en curso.
═══════════════════════════════════════════════════════════════════════════ */

/* Tiros fallados de un jugador (campo + libres). */
function missedShots(p) {
  const s = S.stats[p];
  return ((s['2PT_ATT']||0)-(s['2PT_MADE']||0))
       + ((s['3PT_ATT']||0)-(s['3PT_MADE']||0))
       + ((s['FT_ATT']||0)-(s['FT_MADE']||0));
}

/* Valoración: PTS + REB + AST + STL + BLK − TOV − tiros fallados. */
function valoracion(p) {
  const s = S.stats[p];
  return pts(p) + (s.REB_OFF||0)+(s.REB_DEF||0) + (s.AST||0) + (s.STL||0) + (s.BLK||0)
       - (s.TOV||0) - missedShots(p);
}

/* Intentos de campo de un jugador. */
function fgAtt(p) {
  const s = S.stats[p];
  return (s['2PT_ATT']||0) + (s['3PT_ATT']||0);
}

/* Paquete de análisis del partido en curso. */
function reportAnalysis() {
  const teamPts = totalPts();

  /* Eficiencia vs volumen: ≥6 intentos de campo con menos de 30% FG */
  const inefficient = S.players.filter(p => {
    const fg = fgPct(p);
    return fgAtt(p) >= 6 && fg !== null && fg < 0.30;
  });

  /* Puntos por minuto: mejor ratio con al menos 5 minutos jugados */
  const eligible = S.players.filter(p => (S.minutesPlayed[p]||0) >= 300 && pts(p) > 0);
  let bestPPM = null;
  eligible.forEach(p => {
    const ppm = pts(p) / ((S.minutesPlayed[p]||0)/60);
    if (!bestPPM || ppm > bestPPM.ppm) bestPPM = { player:p, ppm };
  });

  /* Ratio AST/TOV del equipo */
  const ast = totStat('AST'), tov = totStat('TOV');
  const astTov = tov > 0 ? ast/tov : (ast > 0 ? Infinity : null);

  /* Dependencia ofensiva del máximo anotador */
  const scorers = [...S.players].filter(p => pts(p) > 0).sort((a,b) => pts(b)-pts(a));
  const topScorer = scorers[0] || null;
  const share = (topScorer && teamPts > 0) ? pts(topScorer)/teamPts : null;

  /* Rebote ofensivo % */
  const ro = totStat('REB_OFF'), rd = totStat('REB_DEF');
  const orebPct = (ro+rd) > 0 ? ro/(ro+rd) : null;

  /* Rotación: jugadores sin minutos */
  const bench = S.players.filter(p => (S.minutesPlayed[p]||0) === 0);

  return { teamPts, inefficient, bestPPM, ast, tov, astTov, topScorer, share, ro, rd, orebPct, bench };
}

/* Tips priorizados: ALTA → MEDIA → FORTALEZA. Cada uno con dato y acción. */
function reportTips() {
  const A = reportAnalysis();
  const tips = [];
  const add = (level, title, dato, accion) => tips.push({ level, title, dato, accion });

  const ftA = totStat('FT_ATT'), ftM = totStat('FT_MADE');
  const thA = totStat('3PT_ATT'), thM = totStat('3PT_MADE');
  const fgM = totStat('2PT_MADE')+totStat('3PT_MADE');
  const fgA = totStat('2PT_ATT')+totStat('3PT_ATT');

  /* ── ALTA ── */
  if (ftA >= 5 && ftM/ftA < 0.50)
    add('alta', 'Tiros libres',
        `${ftM}/${ftA} (${pct1(ftM/ftA)}).`,
        'Cerrar cada práctica con 10 TL por jugador bajo fatiga.');

  if (A.tov > 15)
    add('alta', 'Pérdidas de balón',
        `${A.tov} pérdidas en el partido.`,
        'Dos series diarias de salida de presión 4v4 con conteo de pases.');

  const elim = S.players.filter(p => S.fouledOut[p]);
  if (elim.length)
    add('alta', 'Faltas que cuestan jugadores',
        `${elim.map(shortName).join(', ')} fuera por 5 faltas.`,
        'Trabajar defensa de pies sin manos y ayudas que no obliguen a chocar.');

  if (A.astTov !== null && A.astTov !== Infinity && A.astTov < 1.0)
    add('alta', 'Circulación de balón',
        `AST/TOV ${A.astTov.toFixed(2)} (${A.ast} asistencias, ${A.tov} pérdidas).`,
        'Regla en práctica: mínimo tres pases antes de tirar en ataque estático.');

  /* ── MEDIA ── */
  if (A.share !== null && A.share > 0.40)
    add('media', 'Dependencia de un anotador',
        `${shortName(A.topScorer)} aportó ${pts(A.topScorer)} de ${A.teamPts} (${pct1(A.share)}).`,
        'Diseñar dos jugadas para la segunda opción ofensiva.');

  if (A.inefficient.length)
    add('media', 'Volumen sin eficiencia',
        `${A.inefficient.map(p => `${shortName(p)} ${pct1(fgPct(p))} en ${fgAtt(p)} tiros`).join('; ')}.`,
        'Restringir su selección de tiro a zona pintada y tiro liberado.');

  if (thA === 0)
    add('media', 'Sin amenaza de triple',
        'Cero intentos de 3 puntos en todo el partido.',
        'Identificar dos tiradores y darles 50 triples de esquina por sesión.');
  else if (thM/thA < 0.25)
    add('media', 'Triple poco fiable',
        `${thM}/${thA} (${pct1(thM/thA)}) desde la línea de 3.`,
        'Reducir el triple a tiro de ritmo: solo tras pase extra.');

  const nearFO = S.players.filter(p => (S.stats[p].FOUL||0) >= 4 && !S.fouledOut[p]);
  if (nearFO.length)
    add('media', 'Al borde de la quinta falta',
        `${nearFO.map(p => `${shortName(p)} (${S.stats[p].FOUL} faltas)`).join(', ')}.`,
        'Plan de rotación para sentarlos al llegar a la cuarta falta.');

  if (A.orebPct !== null && A.orebPct < 0.20 && (A.ro+A.rd) >= 8)
    add('media', 'Rebote ofensivo',
        `${A.ro} de ${A.ro+A.rd} rebotes fueron ofensivos (${pct1(A.orebPct)}).`,
        'Asignar dos jugadores fijos al rebote de ataque en cada tiro.');

  if (A.bench.length)
    add('media', 'Rotación corta',
        `Sin minutos: ${A.bench.map(shortName).join(', ')}.`,
        'Reservarles un turno fijo por cuarto para sostener el ritmo.');

  /* ── FORTALEZAS ── */
  if (A.astTov !== null && (A.astTov === Infinity || A.astTov > 1.5))
    add('fortaleza', 'Cuidado del balón',
        `${A.tov} pérdidas, AST/TOV ${A.astTov === Infinity ? '—' : A.astTov.toFixed(2)}.`,
        'Mantener la misma lectura de pase en partidos cerrados.');

  if (ftA >= 5 && ftM/ftA >= 0.75)
    add('fortaleza', 'Tiro libre sólido',
        `${ftM}/${ftA} (${pct1(ftM/ftA)}).`,
        'Buscar contacto: el equipo convierte lo que gana en la línea.');

  if (fgA >= 10 && fgM/fgA >= 0.45)
    add('fortaleza', 'Selección de tiro',
        `${pct1(fgM/fgA)} en tiros de campo (${fgM}/${fgA}).`,
        'Seguir insistiendo en el tiro cerca del aro.');

  if (A.bestPPM)
    add('fortaleza', 'Mejor rendimiento por minuto',
        `${shortName(A.bestPPM.player)}: ${A.bestPPM.ppm.toFixed(2)} puntos por minuto.`,
        'Evaluar darle más minutos en tramos decisivos.');

  return tips;
}

function generateReport() {
  const T = TRACKER_ID;
  const rivalRaw = prompt('¿Cuántos puntos anotó el rival? (deja vacío si no lo sabes)', '');
  const rivalPts = rivalRaw !== null && rivalRaw.trim() !== '' ? parseInt(rivalRaw.trim(), 10) : null;
  const teamPts  = totalPts();
  const gn       = S.gameName;
  const dateStr  = new Date().toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const timeStr  = new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });

  /* ── Jugadores Destacados ── */
  const sorted  = [...S.players].sort((a,b) => pts(b)-pts(a));
  const topThree = sorted.filter(p => pts(p) > 0).slice(0, 3);

  /* ── Líder por columna (se resalta en la tabla) ── */
  const played = S.players.filter(p => (S.minutesPlayed[p]||0) > 0 || pts(p) > 0);
  const leaderOf = (fn, minVal = 1) => {
    let best = null, bv = -Infinity;
    played.forEach(p => { const v = fn(p); if (v !== null && v > bv) { bv = v; best = p; } });
    return (bv >= minVal) ? best : null;
  };
  const LEAD = {
    pts: leaderOf(p => pts(p)),
    reb: leaderOf(p => (S.stats[p].REB_OFF||0)+(S.stats[p].REB_DEF||0)),
    ast: leaderOf(p => S.stats[p].AST||0),
    val: leaderOf(p => valoracion(p), -Infinity),
    min: leaderOf(p => S.minutesPlayed[p]||0),
  };
  const lead = (p, k) => LEAD[k] === p ? ' class="lead-cell"' : '';

  const playerRowsHtml = S.players.map(p => {
    const s   = S.stats[p];
    const min = S.minutesPlayed[p] || 0;
    const noPlay = min === 0 && pts(p) === 0;
    let nota = '';
    if (noPlay)              nota = 'No jugó';
    else if (S.fouledOut[p]) nota = '⚠️ Eliminado (5F)';
    else if ((s.FOUL||0) >= 4) nota = '⚠️ 4 faltas';
    else if (p === topThree[0] && pts(p) > 0) nota = '⭐ MVP';

    const rowStyle = S.fouledOut[p] ? ' style="color:#a02020"' : (noPlay ? ' style="color:#6f675c"' : '');
    return `<tr${rowStyle}>
      <td>${p}${S.fouledOut[p] ? '*' : ''}</td>
      <td${lead(p,'min')}>${fmtMin(min)}</td>
      <td${lead(p,'pts')}><strong>${pts(p)}</strong></td>
      <td>${s['2PT_MADE']||0}/${s['2PT_ATT']||0}</td>
      <td>${s['3PT_MADE']||0}/${s['3PT_ATT']||0}</td>
      <td>${s['FT_MADE']||0}/${s['FT_ATT']||0}</td>
      <td>${pct1(fgPct(p))}</td>
      <td>${pct1(ftPct(p))}</td>
      <td style="${(s.TOV||0)>=5?'color:#a02020;font-weight:700':''}">${s.TOV||0}</td>
      <td${lead(p,'reb')}>${(s.REB_OFF||0)+(s.REB_DEF||0)}</td>
      <td${lead(p,'ast')}>${s.AST||0}</td>
      <td style="${(s.FOUL||0)>=4?'color:#a02020;font-weight:700':''}">${s.FOUL||0}</td>
      <td${lead(p,'val')}>${noPlay ? '--' : valoracion(p)}</td>
      <td style="font-size:0.8em;color:#6f675c">${nota}</td>
    </tr>`;
  }).join('');

  const topPlayersHtml = topThree.map((p, i) => {
    const s      = S.stats[p];
    const label  = i === 0 ? '⭐ MVP del partido' : `${i+1}° Anotador`;
    const medal  = ['🥇','🥈','🥉'][i] || '';
    const fg     = fgPct(p), ftp = ftPct(p), th3 = threePct(p);
    const bullets = [
      `${pts(p)} puntos anotados`,
      `${fmtMin(S.minutesPlayed[p]||0)} en cancha`,
      fg  !== null ? `${pct1(fg)} en tiros de campo` : null,
      th3 !== null && (s['3PT_ATT']||0) > 0 ? `${pct1(th3)} en triples` : null,
      ftp !== null && (s['FT_ATT']||0) > 0  ? `${pct1(ftp)} en tiros libres` : null,
      `${s.TOV||0} pérdidas`,
      `${s.FOUL||0} falta${(s.FOUL||0)!==1?'s':''}`,
    ].filter(Boolean);
    return `<div class="top-player rank-${i+1}">
      <div class="top-player-head">
        <span class="medal" aria-hidden="true">${medal}</span>
        <div>
          <div class="top-player-name">${i+1}. ${p} — <em>${label}</em></div>
          <div class="top-player-val">Valoración ${valoracion(p)}</div>
        </div>
      </div>
      <ul>${bullets.map(b=>`<li>${b}</li>`).join('')}</ul>
    </div>`;
  }).join('') || '<p>Sin datos de anotación registrados.</p>';

  const recsHtml = reportRecommendations().map(r => `<li>${r}</li>`).join('');

  /* ── Tips priorizados ── */
  const LEVELS = { alta:'Prioridad alta', media:'Prioridad media', fortaleza:'Fortaleza' };
  const tips = reportTips();
  const tipsHtml = tips.length
    ? tips.map(t => `<div class="tip tip-${t.level}">
        <div class="tip-head"><span class="tip-level">${LEVELS[t.level]}</span><span class="tip-title">${t.title}</span></div>
        <p class="tip-dato">${t.dato}</p>
        <p class="tip-accion"><strong>Acción:</strong> ${t.accion}</p>
      </div>`).join('')
    : `<div class="tip tip-fortaleza"><div class="tip-head"><span class="tip-level">Fortaleza</span><span class="tip-title">Partido parejo</span></div>
       <p class="tip-dato">No aparecieron focos rojos ni amarillos en los datos del partido.</p>
       <p class="tip-accion"><strong>Acción:</strong> Mantener el nivel de ejecución y seguir trabajando la unidad de equipo.</p></div>`;

  const A = reportAnalysis();
  const analysisRows = [
    ['Valoración más alta', (() => {
      const best = [...S.players].filter(p => (S.minutesPlayed[p]||0) > 0)
        .sort((a,b) => valoracion(b)-valoracion(a))[0];
      return best ? `${best} (${valoracion(best)})` : '--';
    })()],
    ['Puntos por minuto (líder)', A.bestPPM ? `${A.bestPPM.player} — ${A.bestPPM.ppm.toFixed(2)} PT/min` : '--'],
    ['Ratio AST/TOV del equipo', A.astTov === null ? '--' : (A.astTov === Infinity ? '∞' : A.astTov.toFixed(2)) +
      (A.astTov !== null && A.astTov !== Infinity ? (A.astTov > 1.5 ? ' ✅ fortaleza' : (A.astTov < 1.0 ? ' ⚠️ alarma' : '')) : ' ✅ fortaleza')],
    ['Dependencia del máximo anotador', A.share === null ? '--' :
      `${shortName(A.topScorer)} ${pct1(A.share)} de los puntos${A.share > 0.40 ? ' ⚠️' : ''}`],
    ['Rebote ofensivo %', A.orebPct === null ? '--' : `${pct1(A.orebPct)} (${A.ro} of / ${A.ro+A.rd} tot)`],
    ['Eficiencia vs volumen', A.inefficient.length
      ? A.inefficient.map(p => `${shortName(p)} ${pct1(fgPct(p))} en ${fgAtt(p)} tiros ⚠️`).join(' · ')
      : 'Sin casos de volumen ineficiente'],
    ['Rotación sin minutos', A.bench.length ? A.bench.map(shortName).join(', ') : 'Todos vieron cancha'],
  ].map(([k,v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');

  const ftA = totStat('FT_ATT'), ftM = totStat('FT_MADE');
  const thA = totStat('3PT_ATT'), thM = totStat('3PT_MADE');
  const teamFgM = totStat('2PT_MADE')+totStat('3PT_MADE');
  const teamFgA = totStat('2PT_ATT')+totStat('3PT_ATT');
  const hasFO = S.players.some(p => S.fouledOut[p]);
  const totalReb = totStat('REB_OFF')+totStat('REB_DEF');

  const outcome = rivalPts === null ? null
    : (teamPts > rivalPts ? 'win' : teamPts < rivalPts ? 'loss' : 'draw');
  const outcomeLabel = outcome === 'win' ? 'VICTORIA' : outcome === 'loss' ? 'DERROTA' : outcome === 'draw' ? 'EMPATE' : '';

  const scoreBlock = rivalPts !== null
    ? `<div class="score-block">
        <div class="score-team team-side"><div class="score-name">${T.team.toUpperCase()}</div><div class="score-pts">${teamPts}</div></div>
        <div class="score-vs">VS</div>
        <div class="score-team"><div class="score-name">RIVAL</div><div class="score-pts">${rivalPts}</div></div>
       </div>
       <div class="outcome outcome-${outcome}">${outcomeLabel}${outcome!=='draw'?` · ${teamPts-rivalPts>0?'+':''}${teamPts-rivalPts}`:''}</div>`
    : `<div class="score-block">
        <div class="score-team team-side"><div class="score-name">${T.team.toUpperCase()}</div><div class="score-pts">${teamPts}</div></div>
       </div>`;

  const kpiHtml = `<div class="kpi-row">
    <div class="kpi"><div class="kpi-val">${teamPts}</div><div class="kpi-lbl">PTS</div></div>
    <div class="kpi"><div class="kpi-val">${teamFgA>0 ? pct1(teamFgM/teamFgA) : '--'}</div><div class="kpi-lbl">FG%</div></div>
    <div class="kpi"><div class="kpi-val">${totalReb}</div><div class="kpi-lbl">REB</div></div>
    <div class="kpi"><div class="kpi-val">${totStat('AST')}</div><div class="kpi-lbl">AST</div></div>
  </div>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reporte — ${gn}</title>
<style>
${idStyles()}
  /* Portada */
  .cover{text-align:center;padding:10px 0 4px;border-bottom:1px solid var(--rule);margin-bottom:4px}
  .game-name{font-family:var(--serif);font-size:1.55rem;font-weight:700;color:var(--ink);
             letter-spacing:0.01em;line-height:1.25;background:none;padding:0;text-transform:none;
             margin:0}
  .cover-meta{font-size:0.74rem;color:var(--muted);margin-top:8px;line-height:1.6}
  /* Marcador */
  .score-block{display:flex;justify-content:center;align-items:center;gap:28px;margin:20px 0 10px;flex-wrap:wrap}
  .score-team{text-align:center;min-width:90px}
  .score-name{font-size:0.68rem;font-weight:800;letter-spacing:0.16em;color:var(--muted)}
  .team-side .score-name{color:var(--ink)}
  .score-pts{font-family:var(--serif);font-size:3.6rem;font-weight:700;color:var(--ink);line-height:1}
  .team-side{border-bottom:4px solid var(--team);padding-bottom:6px}
  .team-side .score-pts{color:var(--ink)}
  .score-vs{font-size:0.85rem;font-weight:700;color:var(--muted);letter-spacing:0.1em}
  .outcome{text-align:center;font-size:0.7rem;font-weight:800;letter-spacing:0.18em;
           padding:7px 18px;border-radius:2px;width:fit-content;margin:2px auto 4px;color:#fff}
  .outcome-win{background:#1a6b3c}.outcome-loss{background:#a02020}.outcome-draw{background:#5c5348}
  /* KPIs */
  .kpi-row{display:flex;gap:10px;margin:18px 0 26px;flex-wrap:wrap}
  .kpi{flex:1 1 92px;text-align:center;padding:14px 8px;background:var(--paper-2);
       border:1px solid var(--rule);border-top:3px solid var(--base);border-radius:2px}
  .kpi-val{font-family:var(--serif);font-size:1.75rem;font-weight:700;color:var(--ink);line-height:1}
  .kpi-lbl{font-size:0.62rem;font-weight:800;letter-spacing:0.16em;color:var(--muted);margin-top:5px}
  /* Tabla del equipo */
  .team-table{width:100%;border-collapse:collapse}
  .team-table td{padding:9px 12px;border-bottom:1px solid var(--rule)}
  .team-table td:first-child{color:var(--muted);width:55%}
  .team-table td:last-child{font-weight:700;font-size:1.02rem;font-family:var(--serif)}
  .team-table tr:last-child td{border-bottom:none}
  /* Tabla individual */
  .table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--rule);border-radius:2px}
  .stats-table{width:100%;min-width:760px;border-collapse:collapse;font-size:0.8rem}
  .stats-table th{background:var(--ink);color:#fff;font-weight:700;padding:7px 8px;text-align:center;
                  white-space:nowrap;font-size:0.64rem;letter-spacing:0.06em;text-transform:uppercase}
  .stats-table th:first-child{text-align:left}
  .stats-table td{padding:6px 8px;text-align:center;border-bottom:1px solid var(--rule);white-space:nowrap}
  .stats-table td:first-child{text-align:left;font-weight:600}
  .stats-table tr:nth-child(even) td{background:var(--paper-2)}
  .stats-table .lead-cell{background:var(--paper-2)!important;font-weight:700;
    box-shadow:inset 3px 0 0 var(--accent)}
  @supports (background:color-mix(in srgb,red 20%,#fff)){
    .stats-table .lead-cell{background:color-mix(in srgb,var(--accent) 20%,#fff)!important}
  }
  .stats-table .total-row td{background:var(--paper-2);font-weight:700;border-top:2px solid var(--ink)}
  .foul-note{font-size:0.74rem;color:#a02020;margin-top:8px}
  .lead-legend{font-size:0.7rem;color:var(--muted);margin-top:8px}
  /* Podio */
  .podium{display:flex;flex-direction:column;gap:12px}
  .top-player{border:1px solid var(--rule);border-left:4px solid var(--rule);border-radius:2px;
              padding:14px 16px;background:#fff}
  .top-player.rank-1{border-left-color:var(--base);background:var(--paper-2)}
  .top-player.rank-2{border-left-color:var(--accent)}
  .top-player.rank-3{border-left-color:var(--rule)}
  .top-player-head{display:flex;align-items:center;gap:12px;margin-bottom:8px}
  .medal{font-size:1.7rem;line-height:1;flex-shrink:0}
  .top-player-name{font-family:var(--serif);font-weight:700;font-size:1.05rem}
  .top-player-val{font-size:0.7rem;font-weight:700;letter-spacing:0.1em;color:var(--muted);
                  text-transform:uppercase;margin-top:2px}
  .top-player ul{padding-left:20px;columns:2;column-gap:24px}
  .top-player li{line-height:1.7;color:var(--text);break-inside:avoid}
  @media (max-width:520px){.top-player ul{columns:1}}
  /* Análisis */
  .analysis-table{width:100%;border-collapse:collapse;font-size:0.88rem}
  .analysis-table td{padding:9px 12px;border-bottom:1px solid var(--rule);vertical-align:top}
  .analysis-table td:first-child{color:var(--muted);width:42%}
  .analysis-table td:last-child{font-weight:600}
  .analysis-table tr:last-child td{border-bottom:none}
  /* Tips */
  .tips{display:flex;flex-direction:column;gap:12px}
  .tip{border:1px solid var(--rule);border-left:5px solid var(--rule);border-radius:2px;padding:13px 16px;background:#fff}
  .tip-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:6px}
  .tip-level{font-size:0.6rem;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;
             padding:3px 8px;border-radius:2px;color:#fff;white-space:nowrap}
  .tip-title{font-family:var(--serif);font-weight:700;font-size:1.02rem}
  .tip-dato{font-size:0.9rem;color:var(--text);line-height:1.6}
  .tip-accion{font-size:0.9rem;color:var(--muted);line-height:1.6;margin-top:3px}
  .tip-alta{border-left-color:#a02020}.tip-alta .tip-level{background:#a02020}
  .tip-media{border-left-color:#8a5a00}.tip-media .tip-level{background:#8a5a00}
  .tip-fortaleza{border-left-color:#1a6b3c}.tip-fortaleza .tip-level{background:#1a6b3c}
  /* Recomendaciones */
  .rec-list{padding-left:20px}
  .rec-list li{line-height:1.85;color:var(--text)}
</style>
</head>
<body>
<div class="page">
  <button class="print-btn" onclick="window.print()">🖨️ Guardar como PDF / Imprimir</button>

  ${idHeader('Reporte de partido', '')}

  <div class="cover">
    <h2 class="game-name">${gn}</h2>
    ${scoreBlock}
    <p class="cover-meta">${dateStr} · ${timeStr} · ${T.team} · ${T.league} · ${T.category}</p>
  </div>

  ${kpiHtml}

  <section>
    <h3>Resumen Ejecutivo</h3>
    <p>${reportSummaryText(rivalPts)}</p>
  </section>

  <section>
    <h3>Estadísticas Generales del Equipo</h3>
    <table class="team-table">
      <tr><td>Puntos totales</td><td>${teamPts}</td></tr>
      <tr><td>FG% (tiros de campo)</td><td>${teamFgA>0 ? pct1(teamFgM/teamFgA) : '--'}</td></tr>
      <tr><td>3PT% (triples)</td><td>${thA>0 ? pct1(thM/thA) : '--'} (${thM}/${thA})</td></tr>
      <tr><td>FT% (tiros libres)</td><td>${ftA>0 ? pct1(ftM/ftA) : '--'} (${ftM}/${ftA}) ${ftA>=5&&ftM/ftA<0.5?'⚠️':''}</td></tr>
      <tr><td>Rebotes totales</td><td>${totalReb} (Of: ${totStat('REB_OFF')} / Def: ${totStat('REB_DEF')})</td></tr>
      <tr><td>Asistencias totales</td><td>${totStat('AST')}</td></tr>
      <tr><td>Pérdidas de balón</td><td>${totStat('TOV')} ${totStat('TOV')>15?'⚠️':''}</td></tr>
      <tr><td>Robos / Bloqueos</td><td>${totStat('STL')} / ${totStat('BLK')}</td></tr>
      <tr><td>Faltas totales</td><td>${totStat('FOUL')}</td></tr>
      ${rivalPts!==null?`<tr><td>Diferencia final</td><td>${teamPts-rivalPts>0?'+':''}${teamPts-rivalPts} ${teamPts>rivalPts?'✅':'❌'}</td></tr>`:''}
    </table>
  </section>

  <section>
    <h3>Estadísticas Individuales</h3>
    <div class="table-scroll">
    <table class="stats-table">
      <thead><tr>
        <th>Jugador</th><th>MIN</th><th>PT</th>
        <th>2PT M/A</th><th>3PT M/A</th><th>TL M/A</th>
        <th>FG%</th><th>FT%</th>
        <th>TO</th><th>REB</th><th>AST</th><th>FALT</th><th>VAL</th><th>Notas</th>
      </tr></thead>
      <tbody>${playerRowsHtml}</tbody>
      <tfoot>
        <tr class="total-row">
          <td>TOTAL</td>
          <td>${fmtMin(totalMins())}</td>
          <td>${teamPts}</td>
          <td>${totStat('2PT_MADE')}/${totStat('2PT_ATT')}</td>
          <td>${totStat('3PT_MADE')}/${totStat('3PT_ATT')}</td>
          <td>${totStat('FT_MADE')}/${totStat('FT_ATT')}</td>
          <td>${teamFgA>0?pct1(teamFgM/teamFgA):'--'}</td>
          <td>${ftA>0?pct1(ftM/ftA):'--'}</td>
          <td>${totStat('TOV')}</td>
          <td>${totalReb}</td>
          <td>${totStat('AST')}</td>
          <td>${totStat('FOUL')}</td>
          <td>${S.players.reduce((n,p) => n + ((S.minutesPlayed[p]||0)>0 ? valoracion(p) : 0), 0)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
    </div>
    ${hasFO ? '<p class="foul-note">* Eliminado por 5 faltas</p>' : ''}
    <p class="lead-legend">VAL = valoración (PTS + REB + AST + STL + BLK − pérdidas − tiros fallados). Celda resaltada = líder del equipo en esa columna.</p>
  </section>

  <section>
    <h3>Jugadores Destacados</h3>
    <div class="podium">${topPlayersHtml}</div>
  </section>

  <section>
    <h3>Análisis del Partido</h3>
    <table class="analysis-table">${analysisRows}</table>
  </section>

  <section>
    <h3>Prioridades para la Próxima Práctica</h3>
    <div class="tips">${tipsHtml}</div>
  </section>

  <section>
    <h3>Recomendaciones para el Próximo Partido</h3>
    <ul class="rec-list">${recsHtml}</ul>
  </section>

  ${idFooter()}
</div>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
  else toast('Permite ventanas emergentes para ver el reporte');
}

/* ═══════════════════════════════════════════════════════════════════════════
   UI UTILS
═══════════════════════════════════════════════════════════════════════════ */
let _toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function haptic() { navigator.vibrate?.(12); }

/* ═══════════════════════════════════════════════════════════════════════════
   EVENT LISTENERS
═══════════════════════════════════════════════════════════════════════════ */
function bindEvents() {
  document.getElementById('gameName')?.addEventListener('change', e => {
    S.gameName = e.target.value; scheduleSave();
  });

  document.getElementById('btnToggleClock')?.addEventListener('click', toggleClock);
  document.getElementById('btnResetClock') ?.addEventListener('click', resetClock);

  document.getElementById('quarterSelector')?.addEventListener('click', e => {
    const b = e.target.closest('button[data-q]');
    if (!b) return;
    S.quarter = b.dataset.q;
    document.querySelectorAll('.qtr-sel button').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.q === S.quarter)
    );
    document.getElementById('clockQuarter').textContent = S.quarter;
    scheduleSave();
  });

  document.getElementById('playerList')?.addEventListener('click', e => {
    const pb = e.target.closest('.player-btn');
    if (pb) { selectPlayer(pb.dataset.player); return; }
    const cb = e.target.closest('.court-btn');
    if (cb) toggleCourt(cb.dataset.court);
  });

  document.getElementById('statGrid')?.addEventListener('click', e => {
    const b = e.target.closest('.stat-btn');
    if (b) logStat(b.dataset.stat);
  });

  document.getElementById('btnUndo')    ?.addEventListener('click', undoLast);
  document.getElementById('btnSave')    ?.addEventListener('click', manualSave);
  document.getElementById('btnLoad')    ?.addEventListener('click', manualLoad);
  document.getElementById('btnReport')    ?.addEventListener('click', generateReport);
  document.getElementById('btnNewGame')   ?.addEventListener('click', newGame);
  document.getElementById('btnHistorial') ?.addEventListener('click', openHistorial);
  document.getElementById('btnPlantillas')?.addEventListener('click', openTemplates);
  document.getElementById('btnAdd')     ?.addEventListener('click', addPlayer);
  document.getElementById('btnRemove')  ?.addEventListener('click', removePlayer);

  document.getElementById('btnTable')?.addEventListener('click', () => {
    const sec = document.getElementById('tableSection');
    if (!sec) return;
    sec.classList.toggle('hidden');
    if (!sec.classList.contains('hidden')) renderTable();
  });
  document.getElementById('btnCloseTable')?.addEventListener('click', () =>
    document.getElementById('tableSection')?.classList.add('hidden')
  );

  document.addEventListener('dblclick', e => e.preventDefault(), { passive:false });
}

/* ═══════════════════════════════════════════════════════════════════════════
   SERVICE WORKER
═══════════════════════════════════════════════════════════════════════════ */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('SW registrado'))
      .catch(e => console.warn('SW error:', e));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   PLANTILLAS DE EQUIPO — localStorage + URL sharing
═══════════════════════════════════════════════════════════════════════════ */
const TPL_KEY = 'mba_es15_tpl_v1';
let _tplCache = null;
let _defaultTplName = null;

function _loadTemplatesLocal() {
  try { return JSON.parse(localStorage.getItem(TPL_KEY) || '[]'); }
  catch(e) { return []; }
}
function _saveTemplatesLocal(templates) {
  localStorage.setItem(TPL_KEY, JSON.stringify(templates));
}


async function fbGetTemplates() {
  try {
    const res = await fetch(`${FB_BASE}/${FB_NODE}/templates.json`);
    if (!res.ok) throw new Error('offline');
    const data = await res.json();
    if (!data) return [];
    return Array.isArray(data) ? data : Object.values(data);
  } catch(e) {
    try { return JSON.parse(localStorage.getItem(TPL_KEY) || '[]'); } catch(_) { return []; }
  }
}

async function fbSaveTemplates(templates) {
  try { localStorage.setItem(TPL_KEY, JSON.stringify(templates)); } catch(_) {}
  try {
    await fetch(`${FB_BASE}/${FB_NODE}/templates.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templates)
    });
  } catch(e) { console.warn('Firebase templates save failed (offline?):', e); }
}

async function fbGetDefaultTemplate() {
  try {
    const res = await fetch(`${FB_BASE}/${FB_NODE}/defaultTemplate.json`);
    if (!res.ok) throw new Error('offline');
    const data = await res.json();
    return typeof data === 'string' ? data : null;
  } catch(e) {
    try { return localStorage.getItem(TPL_KEY + '_default') || null; } catch(_) { return null; }
  }
}

async function fbSetDefaultTemplate(name) {
  try {
    if (name) localStorage.setItem(TPL_KEY + '_default', name);
    else localStorage.removeItem(TPL_KEY + '_default');
  } catch(_) {}
  try {
    await fetch(`${FB_BASE}/${FB_NODE}/defaultTemplate.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(name)
    });
  } catch(e) { console.warn('Firebase default template save failed:', e); }
}

async function setDefaultTemplate(idx) {
  const t = _tplCache?.[idx];
  if (!t) return;
  const newDefault = (_defaultTplName === t.name) ? null : t.name;
  _defaultTplName = newDefault;
  await fbSetDefaultTemplate(newDefault);
  _renderTplList(_tplCache);
  toast(newDefault ? `⭐ "${newDefault}" es la plantilla predeterminada` : 'Plantilla predeterminada eliminada');
}


function _renderTplList(templates) {
  const list = document.getElementById('tplList');
  if (!templates.length) {
    list.innerHTML = '<p class="tpl-empty">No hay plantillas guardadas.<br>Guardá la nómina actual para crear la primera.</p>';
    return;
  }
  list.innerHTML = templates.map((t, i) => `
    <div class="tpl-row">
      <span class="tpl-name">${t.name}<small>(${t.players.length} jug.)</small></span>
      <button class="tpl-load-btn"  onclick="loadTemplate(${i})">Cargar</button>
      <button class="tpl-default-btn" onclick="setDefaultTemplate(${i})" title="${_defaultTplName === t.name ? 'Quitar predeterminada' : 'Establecer como predeterminada'}">${_defaultTplName === t.name ? '⭐' : '☆'}</button>
      <button class="tpl-share-btn" onclick="shareTemplate(${i})" title="Compartir link">📤</button>
      <button class="tpl-del-btn"   onclick="deleteTemplate(${i})">✕</button>
    </div>`).join('');
}

async function openTemplates() {
  const modal = document.getElementById('tplModal');
  modal.hidden = false;
  document.getElementById('tplList').innerHTML = '<p class="tpl-empty" style="opacity:.5">Cargando...</p>';
  [_tplCache, _defaultTplName] = await Promise.all([fbGetTemplates(), fbGetDefaultTemplate()]);
  _renderTplList(_tplCache);
}

function loadTemplate(idx) {
  const t = _tplCache?.[idx];
  if (!t) return;
  if (!confirm(`¿Cargar la plantilla "${t.name}"?\nEsto reemplazará la nómina actual (los stats del partido actual se conservan).`)) return;
  S.players = [...t.players];
  S.players.forEach(ensurePlayer);
  if (!S.players.includes(S.selected)) S.selected = S.players[0] || null;
  renderAll();
  scheduleSave();
  document.getElementById('tplModal').hidden = true;
  toast(`✓ Plantilla "${t.name}" cargada`);
}


async function deleteTemplate(idx) {
  if (!_tplCache?.[idx]) return;
  if (!confirm(`¿Eliminar la plantilla "${_tplCache[idx].name}"?`)) return;
  _tplCache.splice(idx, 1);
  await fbSaveTemplates(_tplCache);
  _renderTplList(_tplCache);
  toast('Plantilla eliminada');
}

async function saveCurrentAsTemplate() {
  const name = prompt('Nombre de la plantilla:');
  if (!name?.trim()) return;
  _tplCache = await fbGetTemplates();
  _tplCache.push({ name: name.trim(), players: [...S.players] });
  await fbSaveTemplates(_tplCache);
  _renderTplList(_tplCache);
  toast(`✓ Plantilla "${name.trim()}" guardada`);
}


function shareTemplate(idx) {
  const t = _tplCache?.[idx];
  if (!t) return;
  try {
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(t))));
    const url = location.origin + location.pathname + '?tpl=' + enc;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => toast('🔗 Link copiado — compartilo para importar en otro dispositivo'));
    } else {
      prompt('Copiá este link:', url);
    }
  } catch(e) { toast('Error al generar el link'); }
}

async function checkImportTemplate() {
  const param = new URLSearchParams(location.search).get('tpl');
  if (!param) return;
  try {
    const t = JSON.parse(decodeURIComponent(escape(atob(param))));
    if (!t.name || !Array.isArray(t.players)) return;
    const templates = await fbGetTemplates();
    if (!templates.find(x => x.name === t.name)) {
      templates.push(t);
      await fbSaveTemplates(templates);
      setTimeout(() => toast(`✓ Plantilla "${t.name}" importada automáticamente`), 800);
    }
    history.replaceState({}, '', location.pathname);
  } catch(e) { /* invalid param */ }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await appEnabled())) { fbLog('app_blocked'); showBlocked(); return; }
  checkImportTemplate();
  const hasSaved = loadSaved();
  if (!hasSaved) {
    // No saved game — apply default template if one is set
    const _defTplName = await fbGetDefaultTemplate();
    if (_defTplName) {
      const _defTemplates = await fbGetTemplates();
      const _defTpl = _defTemplates.find(t => t.name === _defTplName);
      if (_defTpl) {
        S.players = [..._defTpl.players];
        S.players.forEach(ensurePlayer);
        S.selected = S.players[0];
      }
    }
  }
  renderAll();
  bindEvents();
  startInterval();
  registerSW();
  fbLog('app_open', { players: S.players||[] });
  sessStart();
  liveStart();
});

/* ═══ LIVE-START ═══════════════════════════════════════════════════════════
   TRASPASO DE SESIÓN EN VIVO ENTRE COMPUTADORAS
   ---------------------------------------------------------------------------
   Fuente única: _tests/blocks/live.js  →  inyectado en los 8 app.js por
   _tests/build-trackers.mjs. NO editar esta región dentro de un app.js: se
   pierde en el siguiente build.

   Modelo: DUEÑO ÚNICO. Solo el dispositivo que figura como owner en
   /live/{FB_NODE}/owner escribe /live/{FB_NODE}/state. Cualquier otro queda en
   solo lectura. Por eso dos computadoras no se pueden pisar nunca.

   Nodo nuevo y separado (no toca historial, plantillas, kill switch ni
   telemetría):
     /live/{FB_NODE}
       rev        sube 1 en cada escritura de estado
       updatedAt  Date.now()
       owner      { deviceId, name, beat }
       handoff    { code, at } | null
       state      todo S MENOS history

   Qué NO viaja: la pila de deshacer (S.history), igual que hoy no se guarda en
   localStorage. El reloj siempre llega PAUSADO.

   Regla dura: esta capa jamás bloquea ni rompe el guardado local. save()
   escribe a localStorage primero y recién después llama a liveOnSave(), que va
   en su propio try/catch y no puede lanzar.
═══════════════════════════════════════════════════════════════════════════ */

const LIVE_BASE       = `${FB_BASE}/live/${FB_NODE}`;
const LIVE_POLL_MS    = 5000;    // sondeo
const LIVE_BEAT_MS    = 10000;   // latido del dueño
const LIVE_DEAD_MS    = 90000;   // sin latido por más de esto = dueño muerto
const LIVE_MIN_UP_MS  = 3000;    // mínimo entre subidas de estado
const LIVE_REQ_MS     = 8000;    // timeout de cada request
const LIVE_BACKUP_KEY = STORAGE_KEY + '_recuperado';
const LIVE_NAME_KEY   = 'bk_device_name';

/* Botones que SÍ funcionan en solo lectura (no modifican el partido). */
const LIVE_ALLOW_IDS = ['btnReport', 'btnHistorial', 'btnTable', 'btnCloseTable'];

/* Funciones que modifican el partido: se envuelven para que no hagan nada
   mientras esta compu está en solo lectura. */
const LIVE_GUARDED = [
  'logStat', 'toggleCourt', 'undoLast', 'toggleClock', 'resetClock',
  'addPlayer', 'removePlayer', 'newGame', 'manualLoad',
  'loadTemplate', 'saveCurrentAsTemplate', 'deleteTemplate', 'setDefaultTemplate',
];

const LIVE = {
  on:         false,      // el motor arrancó
  booting:    true,       // todavía no sé quién lleva el partido: no subo nada
  role:       'owner',    // 'owner' | 'observer'
  handingOff: false,      // soy dueño pero entregué: solo lectura con código a la vista
  readonly:   false,      // arranca usable: la app funciona igual que antes hasta
                          // que el arranque diga lo contrario (1s después)
  handoff:    null,       // { code, at } cuando YO estoy entregando
  ownerInfo:  null,       // último owner visto en la nube
  remote:     null,       // último nodo completo visto (solo cuando soy observador)
  rev:        0,
  net:        false,      // última operación de red salió bien
  failStreak: 0,          // fallos seguidos (evita que el aviso parpadee)
  dirty:      false,      // hubo un fallo de red desde la última confirmación
  lastPollOk: 0,
  lastUpOk:   0,
  lastUpTry:  0,
  upTimer:    null,
  myName:     '',
  lostNotified: false,
  backupSaved:  false,
  transferredTo: null,
  yielded:    false,      // cedí o perdí el control: no vuelvo a reclamarlo solo
};

/* ═══ RED ═════════════════════════════════════════════════════════════════ */
/* Toda la red de esta capa pasa por acá: nunca lanza, siempre cache:'no-store'. */
async function liveReq(path, init) {
  const ctl = new AbortController();
  const timer = setTimeout(() => { try { ctl.abort(); } catch(e) {} }, LIVE_REQ_MS);
  try {
    const r = await fetch(`${LIVE_BASE}${path}.json`, Object.assign(
      { cache: 'no-store', signal: ctl.signal }, init || {}));
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
    LIVE.net = true;
    LIVE.failStreak = 0;
    return { ok: true, data };
  } catch(e) {
    LIVE.net = false;
    LIVE.failStreak++;
    LIVE.dirty = true;      // no sé qué pasó allá afuera: verificar antes de escribir
    return { ok: false, data: null };
  } finally { clearTimeout(timer); }
}

function liveJson(method, body) {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

/* Nombre bonito del dispositivo: el que el admin ya asigna en /devices/{id}/name.
   Si no tiene, se muestra el modelo y el navegador ("Mac · Chrome"). */
async function liveLoadName() {
  let cached = '';
  try { cached = localStorage.getItem(LIVE_NAME_KEY) || ''; } catch(e) {}
  LIVE.myName = cached || `${DEV_INFO.device} · ${DEV_INFO.browser}`;
  try {
    const r = await fetch(`${FB_BASE}/devices/${DEV_ID}/name.json`, { cache: 'no-store' });
    const v = await r.json();
    if (v && typeof v === 'string' && v.trim()) {
      LIVE.myName = v.trim();
      try { localStorage.setItem(LIVE_NAME_KEY, LIVE.myName); } catch(e) {}
    }
  } catch(e) {}
}

/* ═══ ESTADO QUE VIAJA ════════════════════════════════════════════════════ */
/* Exactamente lo mismo que ya persiste save(): todo S MENOS history. */
function liveStatePayload() {
  const { history, ...st } = S;
  return st;
}

function liveScoreOf(st) {
  try {
    const s = (st && st.stats) || {};
    let n = 0;
    for (const p of Object.keys(s)) {
      const q = s[p] || {};
      n += (q['2PT_MADE'] || 0) * 2 + (q['3PT_MADE'] || 0) * 3 + (q['FT_MADE'] || 0);
    }
    return n;
  } catch(e) { return 0; }
}

function liveOwnerName(o) {
  if (!o) return 'otra compu';
  return (o.name && String(o.name).trim()) || 'otra compu';
}

function liveIsAlive(o) {
  return !!(o && o.deviceId && (Date.now() - (o.beat || 0) < LIVE_DEAD_MS));
}

function liveMinsSince(ms) {
  const m = Math.max(1, Math.round((Date.now() - (ms || 0)) / 60000));
  return m;
}

function liveHace(ms) {
  if (!ms) return 'nunca';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `hace ${s}s`;
  return `hace ${Math.round(s / 60)} min`;
}

/* ═══ SUBIDA (solo el dueño) ══════════════════════════════════════════════ */
async function liveUpload(force) {
  if (!LIVE.on || LIVE.booting || LIVE.role !== 'owner' || LIVE.readonly) return false;

  const now = Date.now();
  if (!force && now - LIVE.lastUpTry < LIVE_MIN_UP_MS) {
    /* Debounce: mínimo 3s entre subidas. Se reprograma una sola vez. */
    if (!LIVE.upTimer) {
      LIVE.upTimer = setTimeout(() => {
        LIVE.upTimer = null;
        liveUpload(false).catch(() => {});
      }, LIVE_MIN_UP_MS - (now - LIVE.lastUpTry) + 50);
    }
    return false;
  }
  LIVE.lastUpTry = now;

  /* SIEMPRE se verifica la propiedad antes de escribir el estado. Cuesta un GET
     chiquito cada 3s como mucho, y es lo único que cierra del todo la carrera:
     cualquier heurística de tiempo o de "hubo un fallo de red" deja una ventana
     por la que una subida pendiente le pisa el partido a la otra compu. */
  if (!(await liveConfirmarDueno())) return false;

  const rev  = (LIVE.rev || 0) + 1;
  const body = {
    rev,
    updatedAt: Date.now(),
    owner: { deviceId: DEV_ID, name: LIVE.myName, beat: Date.now() },
    state: liveStatePayload(),
  };
  const r = await liveReq('', liveJson('PATCH', body));
  if (r.ok) { LIVE.rev = rev; LIVE.lastUpOk = Date.now(); }
  liveRenderStatus();
  return r.ok;
}

/* Pregunta a Firebase si esta compu sigue siendo la dueña.
   true  = sí, puedo escribir.
   false = no puedo (o perdí la propiedad, o sigo sin señal). */
async function liveConfirmarDueno() {
  const chk = await liveReq('/owner');
  if (!chk.ok) { liveRenderStatus(); return false; }     // sigo sin señal
  LIVE.lastPollOk = Date.now();
  const o = chk.data;
  if (o && o.deviceId && o.deviceId !== DEV_ID) { liveLoseOwnership(o); return false; }
  LIVE.dirty = false;
  return true;
}

/* Gancho que llama save() DESPUÉS de haber escrito localStorage.
   No devuelve promesa ni lanza: el guardado local nunca depende de esto. */
function liveOnSave() {
  if (!LIVE.on || LIVE.booting || LIVE.role !== 'owner' || LIVE.readonly) return;
  try { Promise.resolve().then(() => liveUpload(false)).catch(() => {}); } catch(e) {}
}

async function liveBeat() {
  if (!LIVE.on || LIVE.booting || LIVE.role !== 'owner') return;
  /* Entregué el partido, o ya lo perdí: esta compu no vuelve a reclamarlo sola.
     Sin esto el latido le roba la propiedad a la compu que acaba de tomarlo. */
  if (LIVE.handingOff || LIVE.yielded) return;
  /* Si venimos de un corte, el latido esperaría a la confirmación del sondeo:
     escribir el owner a ciegas sería robarle el partido a quien lo tomó. */
  if (LIVE.dirty) return;
  /* Nunca se escribe el owner sin preguntar antes quién lo tiene. */
  if (!(await liveConfirmarDueno())) return;
  await liveReq('/owner', liveJson('PATCH', { deviceId: DEV_ID, name: LIVE.myName, beat: Date.now() }));
  liveRenderStatus();
}

/* ═══ SONDEO ══════════════════════════════════════════════════════════════ */
async function livePoll() {
  if (!LIVE.on || LIVE.booting) return;
  const asOwner = (LIVE.role === 'owner');

  /* El dueño solo necesita saber si dejó de serlo: pide el owner, que es chico.
     El observador pide el nodo entero porque necesita el estado para el banner. */
  const r = await liveReq(asOwner ? '/owner' : '');
  if (!r.ok) { liveRenderStatus(); return; }
  LIVE.lastPollOk = Date.now();

  if (asOwner) {
    const owner = r.data;
    if (owner && owner.deviceId && owner.deviceId !== DEV_ID) { liveLoseOwnership(owner); return; }
    LIVE.ownerInfo = owner || null;
    LIVE.dirty = false;              // confirmado: sigo llevando el partido
  } else {
    const node = r.data || {};
    LIVE.rev       = node.rev || 0;
    LIVE.ownerInfo = node.owner || null;
    LIVE.remote    = node;
    liveRenderBanner();
  }
  liveRenderStatus();
}

/* Perdí la propiedad. Si no la entregué yo, guardo mi copia local aparte:
   nunca se pierde nada en silencio. */
function liveLoseOwnership(newOwner) {
  const entregado = LIVE.handingOff;
  LIVE.role          = 'observer';
  LIVE.handingOff    = false;
  LIVE.yielded       = true;   // solo vuelve a ser dueña si el usuario lo pide
  LIVE.handoff       = null;
  LIVE.ownerInfo     = newOwner || null;
  LIVE.transferredTo = liveOwnerName(newOwner);
  liveSetReadonly(true);

  if (!entregado && !LIVE.lostNotified) {
    LIVE.lostNotified = true;
    try {
      localStorage.setItem(LIVE_BACKUP_KEY, JSON.stringify({
        savedAt: Date.now(), tracker: FB_NODE, state: liveStatePayload(),
      }));
      LIVE.backupSaved = true;
    } catch(e) { LIVE.backupSaved = false; }
  }
  liveRenderStatus();
  liveRenderBanner();
  liveModalTransferido(entregado);
}

/* ═══ HIDRATAR (misma lógica defensiva que loadSaved) ═════════════════════ */
function liveHydrate(raw) {
  if (!raw || typeof raw !== 'object') return false;
  let d = raw;
  try { d = migrateIfNeeded(raw); } catch(e) { d = raw; }
  S = {
    gameName:      d.gameName      ?? S.gameName,
    quarter:       d.quarter       ?? S.quarter,
    secsLeft:      d.secsLeft      ?? QUARTER_SECS,
    clockRunning:  false,                       // el reloj SIEMPRE llega pausado
    players:       d.players       ?? S.players,
    stats:         d.stats         ?? S.stats,
    minutesPlayed: d.minutesPlayed ?? S.minutesPlayed,
    onCourt:       d.onCourt       ?? [],
    fouledOut:     d.fouledOut     ?? {},
    selected:      d.selected      ?? (d.players?.[0] ?? S.players[0]),
    history:       [],                          // la pila de deshacer no viaja
  };
  S.players.forEach(ensurePlayer);
  /* A propósito NO se mezclan los DEFAULT_PLAYERS: la nómina que manda es la de
     la compu que venía llevando el partido (pudo haber sacado a alguien). */
  return true;
}

/* ═══ TOMAR EL CONTROL ════════════════════════════════════════════════════ */
async function liveTakeControl(code) {
  if (!LIVE.on) return { ok: false, error: 'La sesión en vivo no está activa.' };

  const r = await liveReq('');
  if (!r.ok) return { ok: false, error: 'Necesitas internet para tomar el control. Revisa la conexión y vuelve a intentar.' };

  const node  = r.data || {};
  const owner = node.owner || null;
  const mine  = !!(owner && owner.deviceId === DEV_ID);
  const alive = liveIsAlive(owner);

  if (alive && !mine) {
    const h = node.handoff;
    if (!h || !h.code) {
      return { ok: false, error: `El partido lo está llevando ${liveOwnerName(owner)} y no lo ha puesto en traspaso. Apreta "📲 Pasar a otra compu" en esa compu primero.` };
    }
    if (String(code || '').trim() !== String(h.code)) {
      return { ok: false, error: 'El código no coincide. Míralo otra vez en la otra compu.' };
    }
  }

  const rev  = (node.rev || 0) + 1;
  const now  = Date.now();
  const w = await liveReq('', liveJson('PATCH', {
    rev, updatedAt: now,
    owner: { deviceId: DEV_ID, name: LIVE.myName, beat: now },
    handoff: null,
  }));
  if (!w.ok) return { ok: false, error: 'No se pudo tomar el control. Revisa la conexión y vuelve a intentar.' };

  let hidratado = false;
  if (node.state && !mine) hidratado = liveHydrate(node.state);

  LIVE.rev           = rev;
  LIVE.booting       = false;
  LIVE.dirty         = false;
  LIVE.role          = 'owner';
  LIVE.handingOff    = false;
  LIVE.handoff       = null;
  LIVE.lostNotified  = false;
  LIVE.yielded       = false;   // el usuario lo pidió: vuelve a ser dueña activa
  LIVE.transferredTo = null;
  LIVE.lastPollOk    = Date.now();
  liveSetReadonly(false);

  save();                       // deja el partido en localStorage de esta compu
  try { renderAll(); } catch(e) {}
  liveRenderStatus();
  liveRenderBanner();
  return { ok: true, hidratado };
}

/* ═══ PASAR A OTRA COMPU ══════════════════════════════════════════════════ */
async function liveStartHandoff() {
  if (!LIVE.on)              { toast('La sesión en vivo no está activa'); return { ok:false }; }
  if (LIVE.role !== 'owner') { toast('Esta compu no lleva el partido'); return { ok:false }; }
  if (LIVE.handingOff)       { liveModalHandoff(LIVE.handoff && LIVE.handoff.code); return { ok:true }; }

  /* 1. Sube el estado final, forzado y sin debounce. */
  const subido = await liveUpload(true);
  if (!subido) {
    liveModalAviso('Sin internet', 'No pude subir el partido, así que no puedo pasarlo a otra compu. Conéctate y vuelve a intentar. Mientras tanto sigue registrando aquí: no se pierde nada.');
    return { ok: false };
  }

  /* 2. Código de 4 dígitos. */
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const w = await liveReq('/handoff', liveJson('PUT', { code, at: Date.now() }));
  if (!w.ok) {
    liveModalAviso('Sin internet', 'No pude generar el traspaso. Revisa la conexión y vuelve a intentar.');
    return { ok: false };
  }

  /* 3. Esta compu queda en solo lectura de inmediato: así no hay carrera. */
  LIVE.handoff    = { code, at: Date.now() };
  LIVE.handingOff = true;
  LIVE.yielded    = true;   // desde acá no reclama el partido por su cuenta
  liveSetReadonly(true);
  liveModalHandoff(code);
  liveRenderStatus();
  return { ok: true, code };
}

async function liveCancelHandoff() {
  if (!LIVE.handingOff) { liveCloseModal(); return; }
  /* Si la otra compu ya tomó el partido, cancelar no puede devolvérmelo.
     liveConfirmarDueno me pasa a solo lectura si ya lo perdí. */
  if (!(await liveConfirmarDueno())) {
    if (LIVE.role === 'owner') {
      liveModalAviso('Sin internet', 'No pude cancelar el traspaso porque no hay conexión. Vuelve a intentar en un momento.');
    } else {
      liveCloseModal();
    }
    return;
  }
  const w = await liveReq('/handoff', { method: 'DELETE' });
  if (!w.ok) {
    liveModalAviso('Sin internet', 'No pude cancelar el traspaso porque no hay conexión. Vuelve a intentar en un momento.');
    return;
  }
  LIVE.handoff    = null;
  LIVE.handingOff = false;
  LIVE.yielded    = false;
  liveSetReadonly(false);
  liveCloseModal();
  liveRenderStatus();
  toast('Traspaso cancelado — ya puedes seguir registrando aquí');
}

/* ═══ SOLO LECTURA ════════════════════════════════════════════════════════ */
function liveSetReadonly(v) {
  LIVE.readonly = !!v;
  if (LIVE.readonly) {
    /* El reloj no puede seguir corriendo en una compu que ya no lleva el partido. */
    try {
      if (S && S.clockRunning) { S.clockRunning = false; updateClockBtn(); }
    } catch(e) {}
  }
  try {
    const app = document.getElementById('app');
    if (app) app.classList.toggle('live-ro', LIVE.readonly);
    const gn = document.getElementById('gameName');
    if (gn) gn.readOnly = LIVE.readonly;
  } catch(e) {}
  liveRenderBanner();
}

function liveBlockedFeedback() {
  const quien = LIVE.handingOff
    ? 'Estás pasando el partido a otra compu'
    : `El partido lo lleva ${liveOwnerName(LIVE.ownerInfo)}`;
  toast(`🔒 Solo lectura — ${quien}. Toma el control para registrar aquí.`);
}

/* Envuelve las funciones que modifican el partido. En classic script las
   declaraciones de función son propiedades del objeto global, así que
   reasignarlas alcanza para interceptar cualquier llamada. */
function liveInstallGuards() {
  const g = (typeof window !== 'undefined') ? window : globalThis;
  LIVE_GUARDED.forEach(name => {
    const orig = g[name];
    if (typeof orig !== 'function' || orig.__liveGuarded) return;
    const wrapped = function(...args) {
      if (LIVE.readonly) { liveBlockedFeedback(); return; }
      return orig.apply(this, args);
    };
    wrapped.__liveGuarded = true;
    try { g[name] = wrapped; } catch(e) {}
  });
}

/* No alcanza con ignorar el clic: hay que atajarlo antes de que llegue a los
   listeners de la app y explicarle al entrenador por qué no responde. */
function liveInstallClickGuard() {
  document.addEventListener('click', e => {
    if (!LIVE.readonly) return;
    const t = e.target;
    if (!t || typeof t.closest !== 'function') return;
    if (t.closest('.live-ui')) return;                     // la UI de esta capa
    const el = t.closest('button, .player-btn, .stat-btn, .court-btn');
    if (!el) return;
    if (LIVE_ALLOW_IDS.indexOf(el.id) !== -1) return;      // Resumen / Historial / Tabla
    if (el.closest('#tableSection')) return;               // la tabla es solo lectura
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    liveBlockedFeedback();
  }, true);
}

/* ═══ UI ══════════════════════════════════════════════════════════════════ */
function liveInjectStyles() {
  if (document.getElementById('liveStyles')) return;
  const st = document.createElement('style');
  st.id = 'liveStyles';
  st.textContent = [
    '.live-dot{display:inline-flex;align-items:center;justify-content:center;background:#0a1628;border:1px solid #1e3a5f;border-radius:999px;width:26px;height:26px;padding:0;cursor:pointer;flex:0 0 auto}',
    '.live-dot i{width:10px;height:10px;border-radius:50%;background:#1e8449;display:block;flex:0 0 auto}',
    '.live-dot:focus-visible{outline:2px solid #f1c40f;outline-offset:2px}',
    '.live-dot.amber i{background:#f1c40f}.live-dot.blue i{background:#3b9ae1}',
    '.live-dot.amber{border-color:#6b5300}.live-dot.blue{border-color:#1d4e73}',
    '#liveBanner{display:none;flex-shrink:0;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 12px;background:#0f3460;border-bottom:1px solid #1e8449;color:#fff;font-size:.78rem;line-height:1.35}',
    '#liveBanner.amber{background:#3d2f05;border-bottom-color:#f1c40f}',
    '#liveBanner.show{display:flex}',
    '#liveBanner .lb-txt{flex:1 1 200px;min-width:0}',
    '#liveBanner .lb-strong{font-weight:800}',
    '#liveBanner .lb-sub{display:block;color:#a9c4de;font-size:.7rem;margin-top:2px}',
    '.live-btn{background:#1e8449;color:#fff;border-radius:10px;padding:9px 16px;font-size:.8rem;font-weight:800;min-height:40px;border:none;cursor:pointer}',
    '.live-btn.ghost{background:#16213e;color:#d0d0d0;border:1px solid #2b4a72}',
    '.live-btn.danger{background:#5c0a0a;color:#ffd7d7;border:1px solid #8b1a1a}',
    '.live-btn:active{transform:scale(.97)}',
    '.live-btn:focus-visible,#btnLiveHandoff:focus-visible{outline:2px solid #f1c40f;outline-offset:2px}',
    '@media (prefers-reduced-motion: reduce){.live-btn:active{transform:none}}',
    '#liveOverlay{position:fixed;inset:0;z-index:99998;background:rgba(10,22,40,.94);display:none;align-items:center;justify-content:center;padding:20px;overflow-y:auto}',
    '#liveOverlay.show{display:flex}',
    '.live-card{background:#16213e;border:1px solid #2b4a72;border-radius:16px;max-width:460px;width:100%;padding:22px;text-align:center;color:#fff;font-family:var(--font,system-ui)}',
    '.live-card h3{font-size:1.05rem;margin-bottom:8px;font-weight:800}',
    '.live-card p{font-size:.85rem;color:#c3d3e4;line-height:1.5;margin-bottom:14px}',
    '.live-code{font-size:4.2rem;font-weight:900;letter-spacing:.14em;color:#f1c40f;margin:10px 0 6px;font-variant-numeric:tabular-nums}',
    '.live-input{width:100%;background:#0a1628;border:2px solid #2b4a72;border-radius:12px;color:#fff;font-size:2.2rem;font-weight:900;text-align:center;letter-spacing:.2em;padding:12px;margin-bottom:12px;font-variant-numeric:tabular-nums}',
    '.live-input:focus{border-color:#f1c40f}',
    '.live-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:6px}',
    '.live-err{color:#ffb3b3;font-size:.82rem;min-height:20px;margin-bottom:8px;font-weight:600}',
    '.live-detail{text-align:left;font-size:.8rem;color:#c3d3e4;line-height:1.7}',
    '.live-detail b{color:#fff}',
    '#app.live-ro #statGrid,#app.live-ro #playerList,#app.live-ro #quarterSelector,',
    '#app.live-ro .hd-clock .icon-btn,#app.live-ro #btnUndo,#app.live-ro #btnSave,',
    '#app.live-ro #btnLoad,#app.live-ro #btnNewGame,#app.live-ro #btnPlantillas,',
    '#app.live-ro #btnAdd,#app.live-ro #btnRemove{opacity:.34;filter:grayscale(.75)}',
    '#app.live-ro #gameName{opacity:.6}',
    '@media (max-width:520px){.live-code{font-size:3rem}.live-card{padding:16px}}',
  ].join('\n');
  document.head.appendChild(st);
}

function liveInjectUI() {
  /* Indicador de sync: al principio de .hd-brand, que es lo único del header
     que se ve a cualquier ancho. Solo el punto de color, para no robarle
     espacio al nombre del partido; el detalle sale al tocarlo. */
  const brand = document.querySelector('.hd-brand');
  if (brand && !document.getElementById('liveDot')) {
    const d = document.createElement('button');
    d.id = 'liveDot';
    d.className = 'live-dot live-ui';
    d.type = 'button';
    d.setAttribute('aria-label', 'Estado de la sesión en vivo');
    d.innerHTML = '<i></i>';
    d.addEventListener('click', liveModalDetalle);
    brand.insertBefore(d, brand.firstChild);
  }

  /* Botón de traspaso en la barra de controles */
  const bar = document.querySelector('.ctrl-bar');
  if (bar && !document.getElementById('btnLiveHandoff')) {
    const b = document.createElement('button');
    b.id = 'btnLiveHandoff';
    b.className = 'ctrl-btn live-ui';
    b.type = 'button';
    b.textContent = '📲 Pasar a otra compu';
    b.addEventListener('click', () => { liveStartHandoff().catch(() => {}); });
    bar.appendChild(b);
  }

  /* Banner de sesión ajena */
  const app = document.getElementById('app');
  const hdr = document.getElementById('header');
  if (app && hdr && !document.getElementById('liveBanner')) {
    const ban = document.createElement('div');
    ban.id = 'liveBanner';
    ban.className = 'live-ui';
    hdr.insertAdjacentElement('afterend', ban);
  }

  /* Overlay de modales */
  if (!document.getElementById('liveOverlay')) {
    const ov = document.createElement('div');
    ov.id = 'liveOverlay';
    ov.className = 'live-ui';
    document.body.appendChild(ov);
  }
}

function liveRenderStatus() {
  const dot = document.getElementById('liveDot');
  if (!dot) return;
  dot.classList.remove('amber', 'blue');
  let titulo;
  if (LIVE.role === 'owner' && !LIVE.readonly) {
    if (liveSinConexion()) { dot.classList.add('amber'); titulo = 'Sin conexión — estás registrando local, no se pierde nada'; }
    else                   { titulo = 'Esta compu lleva el partido y está sincronizada'; }
  } else {
    dot.classList.add('blue');
    titulo = LIVE.handingOff
      ? 'Estás pasando el partido a otra compu'
      : 'Solo lectura — el partido lo lleva ' + liveOwnerName(LIVE.ownerInfo);
  }
  dot.title = titulo + '. Tócalo para ver el detalle.';
  dot.setAttribute('aria-label', titulo);

  const hb = document.getElementById('btnLiveHandoff');
  if (hb) {
    const sirve = (LIVE.role === 'owner');
    hb.style.opacity = sirve ? '' : '.34';
    hb.style.filter  = sirve ? '' : 'grayscale(.75)';
  }
  liveRenderBanner();
}

/* Dos fallos seguidos (unos 10s) antes de gritar "sin conexión": si no, el
   indicador parpadea con cualquier hipo del wifi del gimnasio. */
function liveSinConexion() { return LIVE.failStreak >= 2; }

function liveRenderBanner() {
  const ban = document.getElementById('liveBanner');
  if (!ban) return;

  if (LIVE.role === 'owner' && !LIVE.readonly) {
    if (liveSinConexion()) {
      ban.className = 'live-ui show amber';
      ban.innerHTML = '<div class="lb-txt"><span class="lb-strong">📴 Sin conexión — sigue registrando aquí.</span>' +
        '<span class="lb-sub">Todo se guarda en esta compu y se sube solo cuando vuelva el internet. ' +
        'Mientras no haya señal no puedes pasar el partido a otra compu.</span></div>';
    } else {
      ban.className = 'live-ui'; ban.innerHTML = '';
    }
    return;
  }

  if (LIVE.handingOff) {
    ban.className = 'live-ui show';
    ban.innerHTML = '<div class="lb-txt"><span class="lb-strong">📲 Pasando el partido a otra compu.</span>' +
      '<span class="lb-sub">Esta compu quedó en solo lectura para que nada se pise.</span></div>';
    const b = document.createElement('button');
    b.className = 'live-btn ghost live-ui';
    b.type = 'button';
    b.textContent = 'Ver el código';
    b.addEventListener('click', () => liveModalHandoff(LIVE.handoff && LIVE.handoff.code));
    ban.appendChild(b);
    return;
  }

  const o     = LIVE.ownerInfo;
  const alive = liveIsAlive(o);
  const st    = (LIVE.remote && LIVE.remote.state) || null;

  if (!o && !st) { ban.className = 'live-ui'; ban.innerHTML = ''; return; }

  const q     = (st && st.quarter) || '—';
  const marca = st ? liveScoreOf(st) + ' pts' : 'sin datos';
  const quien = liveOwnerName(o);

  ban.className = 'live-ui show';
  if (alive) {
    ban.innerHTML = '<div class="lb-txt"><span class="lb-strong">Partido en curso en ' + liveEsc(quien) +
      '</span> · ' + liveEsc(q) + ' · ' + liveEsc(marca) +
      '<span class="lb-sub">Esta compu está en solo lectura. Para registrar acá, toma el control.</span></div>';
  } else {
    ban.innerHTML = '<div class="lb-txt"><span class="lb-strong">' + liveEsc(quien) + ' lleva ' +
      liveMinsSince(o && o.beat) + ' min sin señal</span> · ' + liveEsc(q) + ' · ' + liveEsc(marca) +
      '<span class="lb-sub">Puedes continuar aquí sin código.</span></div>';
  }
  const b = document.createElement('button');
  b.className = 'live-btn live-ui';
  b.type = 'button';
  b.textContent = 'Continuar aquí';
  b.addEventListener('click', liveModalContinuar);
  ban.appendChild(b);
}

function liveEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ═══ MODALES ═════════════════════════════════════════════════════════════ */
function liveOverlay() { return document.getElementById('liveOverlay'); }

function liveCloseModal() {
  const ov = liveOverlay();
  if (!ov) return;
  ov.classList.remove('show');
  ov.innerHTML = '';
}

function liveCard(html) {
  const ov = liveOverlay();
  if (!ov) return null;
  ov.innerHTML = '<div class="live-card live-ui">' + html + '</div>';
  ov.classList.add('show');
  return ov.firstChild;
}

function liveAddBtn(card, texto, clase, fn) {
  let row = card.querySelector('.live-row');
  if (!row) { row = document.createElement('div'); row.className = 'live-row live-ui'; card.appendChild(row); }
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'live-btn live-ui' + (clase ? ' ' + clase : '');
  b.textContent = texto;
  b.addEventListener('click', fn);
  row.appendChild(b);
  return b;
}

function liveModalAviso(titulo, texto) {
  const c = liveCard('<h3>' + liveEsc(titulo) + '</h3><p>' + liveEsc(texto) + '</p>');
  if (c) liveAddBtn(c, 'Entendido', 'ghost', liveCloseModal);
}

/* 3.3 — pantalla de traspaso: código ENORME, una línea de instrucción y cancelar. */
function liveModalHandoff(code) {
  if (!code) return;
  const c = liveCard(
    '<h3>📲 Pasa el partido a la otra compu</h3>' +
    '<p>Abre el mismo tracker en la otra compu y escribe este código.</p>' +
    '<div class="live-code">' + liveEsc(code) + '</div>' +
    '<p>Mientras tanto esta compu queda en solo lectura, para que las dos no se pisen. El reloj llega pausado a la otra y el botón Deshacer arranca limpio allá.</p>'
  );
  if (!c) return;
  liveAddBtn(c, 'Cancelar traspaso', 'danger', () => { liveCancelHandoff().catch(() => {}); });
  liveAddBtn(c, 'Dejar el código a la vista', 'ghost', liveCloseModal);
}

/* 3.4 / F5 / F6 / F7 — pedir el código, o continuar sin él si el dueño murió. */
function liveModalContinuar() {
  const o      = LIVE.ownerInfo;
  const alive  = liveIsAlive(o);
  const quien  = liveOwnerName(o);

  if (!alive) {
    const c = liveCard(
      '<h3>Continuar el partido aquí</h3>' +
      '<p><b>' + liveEsc(quien) + '</b> lleva ' + liveMinsSince(o && o.beat) +
      ' min sin señal, así que puedes continuar sin código.</p>' +
      '<p>El reloj llega pausado y el botón Deshacer arranca limpio: la pila de deshacer no viaja entre computadoras.</p>' +
      '<div class="live-err" id="liveErr"></div>'
    );
    if (!c) return;
    liveAddBtn(c, 'Continuar aquí', '', async () => {
      const r = await liveTakeControl(null);
      if (r.ok) liveModalTomado();
      else liveSetErr(r.error);
    });
    liveAddBtn(c, 'Cancelar', 'ghost', liveCloseModal);
    return;
  }

  const c = liveCard(
    '<h3>Continuar el partido aquí</h3>' +
    '<p>El partido lo lleva <b>' + liveEsc(quien) + '</b>. Allá, apreta <b>📲 Pasar a otra compu</b> y escribe acá el código de 4 dígitos.</p>' +
    '<input class="live-input live-ui" id="liveCode" inputmode="numeric" maxlength="4" placeholder="0000" autocomplete="off">' +
    '<div class="live-err" id="liveErr"></div>'
  );
  if (!c) return;
  const inp = document.getElementById('liveCode');
  const enviar = async () => {
    const v = (document.getElementById('liveCode') || {}).value || '';
    liveSetErr('');
    const r = await liveTakeControl(v);
    if (r.ok) liveModalTomado();
    else liveSetErr(r.error);
  };
  if (inp) {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); enviar(); } });
    setTimeout(() => { try { inp.focus(); } catch(e) {} }, 60);
  }
  liveAddBtn(c, 'Tomar el control', '', enviar);
  liveAddBtn(c, 'Cancelar', 'ghost', liveCloseModal);
}

function liveSetErr(msg) {
  const e = document.getElementById('liveErr');
  if (e) e.textContent = msg || '';
}

function liveModalTomado() {
  const c = liveCard(
    '<h3>✅ Ya llevas el partido en esta compu</h3>' +
    '<p>Llegó todo: marcador, cuarto, reloj, nómina y estadísticas.</p>' +
    '<p><b>El reloj llega pausado</b> — dale play cuando arranque de nuevo. Y el botón Deshacer arranca limpio: la pila de deshacer no viaja entre computadoras.</p>'
  );
  if (c) liveAddBtn(c, 'Listo', '', liveCloseModal);
}

function liveModalTransferido(entregado) {
  const quien = liveEsc(LIVE.transferredTo || 'otra compu');
  let html;
  if (entregado) {
    html = '<h3>✅ Transferido a ' + quien + '</h3>' +
           '<p>Esta compu queda en solo lectura. Todo lo que registraste ya está allá.</p>';
  } else {
    html = '<h3>Otra compu tomó el partido</h3>' +
           '<p>Ahora lo lleva <b>' + quien + '</b> y esta compu queda en solo lectura.</p>' +
           (LIVE.backupSaved
             ? '<p>Tu versión de esta compu <b>quedó guardada aparte</b> en este navegador (<code>' + liveEsc(LIVE_BACKUP_KEY) + '</code>) y <b>no se subió</b>, para no pisar lo que lleva la otra. No se perdió nada.</p>'
             : '');
  }
  const c = liveCard(html + '<div class="live-err" id="liveErr"></div>');
  if (!c) return;
  liveAddBtn(c, 'Recuperar control', 'ghost', () => { liveCloseModal(); liveModalContinuar(); });
  liveAddBtn(c, 'Entendido', '', liveCloseModal);
}

/* 3.2 — detalle del indicador: quién lleva el partido y hace cuánto se subió. */
function liveModalDetalle() {
  const o = LIVE.ownerInfo;
  const yo = (o && o.deviceId === DEV_ID);
  const filas = [
    '<b>Esta compu:</b> ' + liveEsc(LIVE.myName),
    '<b>Lleva el partido:</b> ' + (LIVE.role === 'owner' && !LIVE.readonly
        ? 'esta compu'
        : liveEsc(yo ? 'esta compu' : liveOwnerName(o))),
    '<b>Estado:</b> ' + (LIVE.readonly ? 'solo lectura' : (LIVE.net ? 'sincronizado' : 'sin conexión, trabajando local')),
    '<b>Última subida:</b> ' + liveEsc(liveHace(LIVE.lastUpOk)),
    '<b>Última señal de la nube:</b> ' + liveEsc(liveHace(LIVE.lastPollOk)),
    '<b>Versión del partido:</b> rev ' + (LIVE.rev || 0),
  ];
  const c = liveCard('<h3>Sesión en vivo</h3><div class="live-detail">' + filas.join('<br>') + '</div>');
  if (c) liveAddBtn(c, 'Cerrar', 'ghost', liveCloseModal);
}

/* ═══ ARRANQUE ════════════════════════════════════════════════════════════ */
/* Lo llama el DOMContentLoaded DESPUÉS de appEnabled(): si el kill switch está
   apagado, la sesión en vivo ni se inicia. */
async function liveStart() {
  try {
    LIVE.on = true;
    liveInjectStyles();
    liveInjectUI();
    liveInstallGuards();
    liveInstallClickGuard();
    await liveLoadName();
    await liveBoot();
    setInterval(() => { livePoll().catch(() => {}); }, LIVE_POLL_MS);
    setInterval(() => { liveBeat().catch(() => {}); }, LIVE_BEAT_MS);
  } catch(e) {
    console.warn('Sesión en vivo desactivada:', e);
    LIVE.on = false;
    LIVE.booting = false;
    try { liveSetReadonly(false); } catch(_) {}
  }
}

async function liveBoot() {
  const r = await liveReq('');
  if (!r.ok) {
    LIVE.booting = false;
    /* Sin señal al abrir: sigo trabajando 100% local, como siempre.
       El sondeo reintenta solo. */
    LIVE.role = 'owner';
    liveSetReadonly(false);
    liveRenderStatus();
    return;
  }
  LIVE.lastPollOk = Date.now();
  const node  = r.data || {};
  LIVE.rev    = node.rev || 0;
  LIVE.remote = node;
  const owner = node.owner || null;
  LIVE.ownerInfo = owner;

  const mine  = !!(owner && owner.deviceId === DEV_ID);
  const libre = !owner || !owner.deviceId;

  if (libre || mine) {
    /* Sesión libre o mía: la tomo sin código y subo lo que tengo local. */
    LIVE.role = 'owner';
    liveSetReadonly(false);
    LIVE.booting = false;
    LIVE.dirty   = false;
    await liveUpload(true);
  } else {
    /* Hay una sesión de otra compu (viva o sin señal). No toco nada:
       el entrenador decide con el banner. */
    LIVE.role = 'observer';
    liveSetReadonly(true);
  }
  LIVE.booting = false;
  liveRenderStatus();
  liveRenderBanner();
}
/* ═══ LIVE-END ═══════════════════════════════════════════════════════════ */
