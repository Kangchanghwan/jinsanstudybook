/* 이진수 챌린지 - vanilla JS, 1920x1080 고정 무대 */
(function () {
'use strict';
var CFG = Object.assign({ API_URL: '', CLASS_COUNT: 8, GRADE: 2 }, window.GAME_CONFIG || {});
var DEBUG = /[?&]debug=1/.test(location.search);
// 디버그 전용: ?debug=1&api=<주소> 로 API 주소를 바꿔 모의 서버로 테스트할 수 있다.
if (DEBUG) { var apiQ = /[?&]api=([^&]*)/.exec(location.search); if (apiQ) CFG.API_URL = decodeURIComponent(apiQ[1]); }
// 선생님 설정 (settings 탭). 서버에서 못 받으면 기본값 유지.
var CFG_DEF = { s1: 8, s2: 8, s3: 5, s4: 60 };
CFG.stage = Object.assign({}, CFG_DEF);
var CFG_RANGE = { s1: [1, 15], s2: [1, 20], s3: [1, 11], s4: [20, 180] };
var CFG_KEY = { s1: 'stage1_count', s2: 'stage2_count', s3: 'stage3_count', s4: 'stage4_seconds' };
var VALS = [8, 4, 2, 1];
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

/* ---------- 유틸 ---------- */
function h(tag, attrs) {
  var e = document.createElement(tag);
  attrs = attrs || {};
  Object.keys(attrs).forEach(function (k) {
    var v = attrs[k];
    if (v == null || v === false) return;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v; // 정적 문자열 전용
    else if (k === 'style') e.setAttribute('style', v);
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  });
  for (var i = 2; i < arguments.length; i++) {
    var c = arguments[i];
    if (c == null || c === false) continue;
    if (Array.isArray(c)) c.forEach(function (x) { if (x) e.appendChild(x); });
    else e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function range(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(i); return r; }
function pop(n) { return n.toString(2).split('1').length - 1; }
function bits4(n) { return [(n >> 3) & 1, (n >> 2) & 1, (n >> 1) & 1, n & 1]; }
function sumBits(b) { return b.reduce(function (a, x, i) { return a + x * VALS[i]; }, 0); }
function eqText(b) { return b.map(function (x, i) { return x ? VALS[i] : 0; }).join(' + ') + ' = ' + sumBits(b); }
function fmt(n) { return Number(n).toLocaleString('ko-KR'); }
function later(fn, ms) { var t = setTimeout(fn, ms); cleanups.push(function () { clearTimeout(t); }); return t; }
var LS = {
  get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
function starsEl(n, total) {
  total = total || 3;
  var w = h('div', { class: 'stars' });
  for (var i = 0; i < total; i++) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 100 100');
    s.style.fill = i < n ? '#FFC800' : '#ddd';
    var u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    u.setAttribute('href', '#star'); s.appendChild(u); w.appendChild(s);
  }
  return w;
}
function icon(id, cls) {
  var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 100 100'); if (cls) s.setAttribute('class', cls);
  var u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#' + id); s.appendChild(u); return s;
}
function bulbSvg() {
  var w = document.createElement('div');
  w.innerHTML = '<svg viewBox="0 0 200 240"><g class="rays" stroke="#111" stroke-width="8" stroke-linecap="round"><path d="M100 4V-14M28 30L14 16M172 30L186 16M6 100H-14M194 100H214"/></g><path class="glass" d="M100 20C50 20 26 58 40 98c10 26 28 36 28 62h64c0-26 18-36 28-62 14-40-10-78-60-78z"/><path d="M70 70c0-14 10-24 22-28" stroke="#fff" stroke-width="10" stroke-linecap="round" fill="none" opacity=".8"/><rect x="66" y="162" width="68" height="52" rx="10" fill="#2F7BFF" stroke="#111" stroke-width="8"/><path d="M66 180h68M66 196h68" stroke="#111" stroke-width="6"/></svg>';
  return w.firstChild;
}

/* ---------- 무대 스케일 ---------- */
var stageEl = $('#stage');
var scale = 1;
function fit() {
  scale = Math.min(innerWidth / 1920, innerHeight / 1080);
  stageEl.style.transform = 'scale(' + scale + ')';
  stageEl.style.left = (innerWidth - 1920 * scale) / 2 + 'px';
  stageEl.style.top = (innerHeight - 1080 * scale) / 2 + 'px';
}
addEventListener('resize', fit); fit();
function stagePos(el) {
  var r = el.getBoundingClientRect(), s = stageEl.getBoundingClientRect();
  return { x: (r.left - s.left) / scale, y: (r.top - s.top) / scale, w: r.width / scale, h: r.height / scale };
}

/* ---------- 사운드 ---------- */
var muted = !!LS.get('binq.mute', false);
var ac = null;
function tone(f, d, type, vol, delay) {
  if (muted) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    var t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(vol || 0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.02);
  } catch (e) {}
}
var sfx = {
  click: function () { tone(520, 0.07, 'square', 0.06); },
  ok: function () { tone(660, 0.12, 'triangle', 0.15); tone(880, 0.18, 'triangle', 0.15, 0.1); },
  ng: function () { tone(200, 0.25, 'sawtooth', 0.1); tone(150, 0.25, 'sawtooth', 0.1, 0.12); },
  combo: function () { tone(660, 0.08, 'triangle', 0.14); tone(880, 0.08, 'triangle', 0.14, 0.08); tone(1100, 0.15, 'triangle', 0.14, 0.16); },
  tick: function () { tone(700, 0.1, 'square', 0.08); },
  up: function () { tone(784, 0.1, 'triangle', 0.1); tone(1175, 0.16, 'triangle', 0.1, 0.09); },
  go: function () { tone(1000, 0.35, 'square', 0.1); },
  fanfare: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.25, 'triangle', 0.15, i * 0.12); }); }
};
function renderMute() { var b = $('#mute'); b.textContent = muted ? '소리 꺼짐' : '소리 켜짐'; b.classList.toggle('off', muted); }
$('#mute').addEventListener('click', function () { muted = !muted; LS.set('binq.mute', muted); renderMute(); sfx.click(); });
renderMute();
document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.btn,.chip,.tab,.navbtn')) sfx.click(); }, true);

/* ---------- 화면 전환 ---------- */
var cleanups = [], curPage = '', miniMapEl = null, curIntroN = 0;
function show(id) {
  cleanups.forEach(function (f) { try { f(); } catch (e) {} }); cleanups = [];
  $('#banner').classList.remove('show'); $('#countdown').classList.remove('show');
  $$('.conf').forEach(function (c) { c.remove(); });
  $$('.page').forEach(function (p) { p.classList.toggle('on', p.id === 'pg-' + id); });
  curPage = id; miniMapEl = null; if (typeof RK !== 'undefined') RK.onPage(id);
  var pg = $('#pg-' + id); pg.innerHTML = ''; return pg;
}
function banner(title, sub, ms, cb) {
  var b = $('#banner'); $('.bt', b).textContent = title; $('.s', b).textContent = sub || '';
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  confetti(36); sfx.ok();
  later(function () { b.classList.remove('show'); if (cb) cb(); }, ms || 1400);
}
function confetti(n) {
  var cols = ['#FF4B3E', '#FFC800', '#2F7BFF', '#22C55E', '#FF7EB6'];
  for (var i = 0; i < n; i++) {
    var c = h('i', { class: 'conf' });
    c.style.left = Math.random() * 1880 + 'px'; c.style.background = cols[i % 5];
    c.style.animationDelay = Math.random() * 0.5 + 's'; if (i % 2) c.style.borderRadius = '50%';
    stageEl.appendChild(c); (function (x) { setTimeout(function () { x.remove(); }, 2600); })(c);
  }
}
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function dotsEl(total, done) {
  var d = h('div', { class: 'dots' });
  for (var i = 0; i < total; i++) d.appendChild(h('i', { class: i < done ? 'd' : i === done ? 'c' : '' }));
  return d;
}

/* ---------- 프로필 / 진행 저장 ---------- */
var P = null, prog = { best: {} };
function pid(p) { return p.cls + '-' + p.num + '-' + p.name; }
function loadProg() { prog = LS.get('binq.prog.' + pid(P), null) || { best: {} }; if (!prog.best) prog.best = {}; }
function saveProg() { LS.set('binq.prog.' + pid(P), prog); }
function totalScore() { var t = 0; for (var k in prog.best) t += prog.best[k].score; return t; }
function totalStars() { var t = 0; for (var k in prog.best) t += prog.best[k].stars; return t; }
function unlocked(n) { return true; }
function deviceId() { var d = LS.get('binq.dev', null); if (!d) { d = 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); LS.set('binq.dev', d); } return d; }
function whoText() { return CFG.GRADE + '학년 ' + P.cls + '반 ' + P.num + '번'; }

/* ---------- 설정(config) ---------- */
function clampCfg(c) {
  var out = {}, changed = false;
  Object.keys(CFG_KEY).forEach(function (k) {
    var n = Math.round(Number(c && c[CFG_KEY[k]]));
    if (c && c[CFG_KEY[k]] !== '' && c[CFG_KEY[k]] != null && isFinite(n)) out[k] = Math.min(CFG_RANGE[k][1], Math.max(CFG_RANGE[k][0], n));
  });
  Object.keys(out).forEach(function (k) { if (CFG.stage[k] !== out[k]) { CFG.stage[k] = out[k]; changed = true; } });
  return changed;
}
function applyConfig(c) {
  if (!clampCfg(c)) return;
  if (curPage === 'intro' && curIntroN) renderIntro(curIntroN);
  else if (curPage === 'map' && P) renderMap(true);
}
function apiUrl(action, extra) { return CFG.API_URL + (CFG.API_URL.indexOf('?') < 0 ? '?' : '&') + 'action=' + action + (extra || ''); }
function fetchConfig() {
  if (!CFG.API_URL) return Promise.resolve();
  return fetch(apiUrl('config')).then(function (r) { return r.json(); }).then(function (j) { if (j && j.ok && j.config) applyConfig(j.config); }).catch(function () {});
}

/* ---------- 준실시간 랭킹 폴러 (미니 랭킹 / 랭킹 화면 공용) ---------- */
var RK = {
  data: null, failed: false, inflight: false, fails: 0, timer: null, key: '', listeners: [],
  myRank: null, delta: 0, deltaAt: 0, lastToast: {}, updatedAt: 0, started: false,
  url: function () { return apiUrl('ranking', '&grade=' + CFG.GRADE + '&cls=' + P.cls + '&num=' + P.num + '&name=' + encodeURIComponent(P.name)); },
  start: function () {
    if (!CFG.API_URL || !P) return;
    var k = pid(P);
    if (RK.key !== k) { RK.data = null; RK.myRank = null; RK.delta = 0; RK.key = k; RK.failed = false; RK.fails = 0; }
    if (!RK.started) { RK.started = true; RK.schedule(0); }
    RK.render();
  },
  schedule: function (ms) {
    clearTimeout(RK.timer);
    if (ms == null) ms = Math.min(20000, 5000 * Math.pow(2, RK.fails)) * (RK.fails ? 1 : 1) + (RK.fails ? 0 : Math.random() * 1500);
    RK.timer = setTimeout(RK.tick, ms);
  },
  tick: function () {
    if (!RK.started) return;
    if (document.hidden || RK.inflight || !P) { RK.schedule(); return; }
    RK.poll().then(function () { RK.schedule(); });
  },
  now: function () { if (!RK.started || RK.inflight) return Promise.resolve(); return RK.poll().then(function () { RK.schedule(); }); },
  poll: function () {
    RK.inflight = true; var key = RK.key;
    return fetch(RK.url()).then(function (r) { return r.json(); }).then(function (j) {
      RK.inflight = false;
      if (key !== RK.key) return;
      if (!j || !j.ok) throw new Error('bad');
      RK.fails = 0; RK.failed = false; RK.updatedAt = Date.now();
      RK.ingest(j);
    }).catch(function () { RK.inflight = false; RK.failed = true; RK.fails = Math.min(RK.fails + 1, 3); RK.fire(); });
  },
  ingest: function (j) {
    var prev = RK.data, oldRank = RK.myRank, newRank = j.me ? j.me.rank : null;
    RK.data = j;
    if (j.config) applyConfig(j.config);
    if (oldRank != null && newRank != null && newRank !== oldRank) {
      RK.delta = oldRank - newRank; RK.deltaAt = Date.now();
      if (RK.delta > 0) sfx.up();
      if (RK.delta < 0) RK.overtake(prev, j, oldRank, newRank);
    } else if (oldRank != null && newRank === oldRank && Date.now() - RK.deltaAt > 6000) RK.delta = 0;
    RK.myRank = newRank;
    RK.render(); RK.fire();
  },
  overtake: function (prev, j, oldRank, newRank) {
    var seen = {};
    function reg(arr) { (arr || []).forEach(function (r) { seen[r.num + '|' + r.name] = r.rank; }); }
    reg(prev && prev.top); reg(prev && prev.ahead);
    var cands = (j.top || []).concat(j.ahead || []), done = {};
    for (var i = 0; i < cands.length; i++) {
      var r = cands[i], k = r.num + '|' + r.name;
      if (done[k] || r.rank >= newRank || (j.me && r.num === j.me.num && r.name === j.me.name)) continue;
      done[k] = 1;
      var was = seen[k];
      if (was == null || was > oldRank || was >= newRank) {
        var last = RK.lastToast[k] || 0;
        if (Date.now() - last < 10000) return;
        RK.lastToast[k] = Date.now(); RK.toast(r.name + '이(가) 추월!'); return;
      }
    }
  },
  toast: function (text) {
    var t = $('#rkToast'); if (!t) return;
    t.textContent = text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(RK.toastT); RK.toastT = setTimeout(function () { t.classList.remove('show'); }, 1500);
  },
  onPage: function (id) {
    var vis = !!CFG.API_URL && !!P && id !== 'entry' && id !== 'rank';
    var b = $('#rkBadge'); if (b) b.style.display = vis ? '' : 'none';
    var pop = $('#rkPop'); if (pop) pop.classList.remove('open');
    if (CFG.API_URL && P && id !== 'entry') RK.start();
    RK.render();
  },
  fire: function () { RK.listeners.forEach(function (f) { try { f(); } catch (e) {} }); },
  top5: function () { return (RK.data && RK.data.top || []).slice(0, 5); },
  rankText: function () {
    if (!RK.data) return RK.failed ? '순위 확인 중' : '순위 불러오는 중';
    return RK.myRank != null ? '내 순위 ' + RK.myRank + '위' : '내 순위 -';
  },
  deltaEl: function () {
    if (RK.delta === 0 || Date.now() - RK.deltaAt > 6000) return null;
    return h('span', { class: 'rkd ' + (RK.delta > 0 ? 'up' : 'down'), text: (RK.delta > 0 ? '▲' : '▼') + Math.abs(RK.delta) });
  },
  listEl: function (compact) {
    var box = h('div', { class: compact ? 'rkrow5' : 'rklist' }), me = P;
    var top = RK.top5();
    if (!top.length) box.appendChild(h('span', { class: 'rkempty', text: RK.data ? '아직 기록이 없어요' : '불러오는 중...' }));
    top.forEach(function (r) {
      var mine = me && r.num === me.num && r.name === me.name;
      box.appendChild(h('div', { class: 'rkit' + (mine ? ' me' : '') },
        h('div', { class: 'rkl1' }, h('b', { text: r.rank + '위' }), h('span', { class: 'rkn', text: r.name })), h('span', { class: 'rks', text: fmt(r.total) + '점' })));
    });
    return box;
  },
  render: function () {
    var b = $('#rkBadge');
    if (b && b.style.display !== 'none') {
      b.innerHTML = ''; b.appendChild(h('span', { class: 'rkt', text: RK.rankText() }));
      var d = RK.deltaEl(); if (d) b.appendChild(d);
      if (!d) { /* 지연 후 사라지게 */ }
    }
    var pop = $('#rkPop');
    if (pop && pop.classList.contains('open')) RK.fillPop(pop);
    if (miniMapEl && document.body.contains(miniMapEl)) RK.fillMap(miniMapEl);
    clearTimeout(RK.dT);
    if (RK.delta !== 0) RK.dT = setTimeout(RK.render, Math.max(200, 6100 - (Date.now() - RK.deltaAt)));
  },
  fillPop: function (pop) {
    pop.innerHTML = ''; pop.appendChild(h('div', { class: 'rkh', text: P.cls + '반 실시간 순위' }));
    pop.appendChild(RK.listEl(false));
    pop.appendChild(h('div', { class: 'rkme', text: RK.rankText() + (RK.data && RK.data.me ? '  ' + fmt(RK.data.me.total) + '점' : '') }));
  },
  fillMap: function (el) {
    el.innerHTML = '';
    var d = RK.deltaEl();
    el.appendChild(h('div', { class: 'rkh' }, '우리 반 실시간 순위', h('span', { class: 'rkmine', text: RK.rankText() }), d));
    el.appendChild(RK.listEl(true));
  }
};
document.addEventListener('visibilitychange', function () { if (!document.hidden && RK.started) RK.schedule(300); });

/* ---------- 기록 전송 ---------- */
function postRecord(rec) {
  return fetch(CFG.API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(rec) });
}
function flushQueue() {
  var q = LS.get('binq.queue', []);
  if (!q.length || !CFG.API_URL) return Promise.resolve();
  var chain = Promise.resolve(), rest = q.slice();
  q.forEach(function (rec) {
    chain = chain.then(function () { return postRecord(rec).then(function () { rest = rest.filter(function (r) { return r !== rec; }); }); });
  });
  return chain.then(function () { LS.set('binq.queue', rest); }, function () { LS.set('binq.queue', rest); throw new Error('queue'); });
}
function sendRecord(rec) {
  if (!CFG.API_URL) return Promise.resolve('off');
  return flushQueue().catch(function () {}).then(function () { return postRecord(rec); }).then(function () { return 'ok'; }, function () {
    var q = LS.get('binq.queue', []); q.push(rec); LS.set('binq.queue', q.slice(-30)); return 'fail';
  });
}

/* ---------- 1. 입장 ---------- */
var entryCls = 0, forceNew = false;
function renderEntry() {
  var pg = show('entry');
  var saved = LS.get('binq.profile', null);
  pg.appendChild(h('div', { class: 'title-wrap' },
    h('div', { class: 'bulbrow' }, ['1', '0', '1', '1'].map(function (x) { return h('div', { class: 'mini', text: x }); })),
    h('h1', { class: 'title', text: '이진수 챌린지' })));
  if (saved && !forceNew) {
    pg.appendChild(h('div', { class: 'card resume' },
      h('span', { class: 'pill bl', text: CFG.GRADE + '학년 ' + saved.cls + '반 ' + saved.num + '번' }),
      h('div', { class: 'who hd', text: saved.name }),
      h('div', { class: 'btns' },
        h('button', { class: 'btn red', id: 'btnResume', text: '이어하기', onclick: function () { P = saved; loadProg(); renderMap(); } }),
        h('button', { class: 'btn white', id: 'btnNew', text: '다른 사람으로 시작', onclick: function () { forceNew = true; renderEntry(); } }))));
    return;
  }
  entryCls = saved ? saved.cls : 0;
  var clsBox = h('div', { id: 'classes' });
  for (var i = 1; i <= CFG.CLASS_COUNT; i++) (function (i) {
    var b = h('button', { class: 'chip' + (i === entryCls ? ' sel' : ''), type: 'button', text: i + '반', 'data-cls': i, onclick: function () {
      entryCls = i; $$('.chip', clsBox).forEach(function (x) { x.classList.toggle('sel', +x.dataset.cls === i); });
    } }); clsBox.appendChild(b);
  })(i);
  var num = h('input', { class: 'field', id: 'num', inputmode: 'numeric', maxlength: 2, style: 'width:200px', placeholder: '번호', value: saved ? saved.num : '' });
  num.addEventListener('input', function () { num.value = num.value.replace(/\D/g, '').slice(0, 2); });
  var nm = h('input', { class: 'field', id: 'nm', maxlength: 10, placeholder: '이름', value: saved ? saved.name : '' });
  var err = h('div', { class: 'formerr', id: 'formerr' });
  function start() {
    var n = parseInt(num.value, 10), name = nm.value.trim();
    if (!(entryCls >= 1 && entryCls <= CFG.CLASS_COUNT)) { err.textContent = '반을 먼저 골라요'; return; }
    if (!(n >= 1 && n <= 40)) { err.textContent = '번호는 1부터 40 사이로 써요'; num.focus(); return; }
    if (name.length < 2 || name.length > 10) { err.textContent = '이름은 2글자부터 10글자까지 써요'; nm.focus(); return; }
    P = { cls: entryCls, num: n, name: name }; LS.set('binq.profile', P); forceNew = false; loadProg(); renderMap();
  }
  pg.appendChild(h('div', { class: 'card form' },
    h('label', { text: '학년' }), h('div', {}, h('span', { class: 'pill bl', text: CFG.GRADE + '학년' })),
    h('label', { text: '반' }), clsBox,
    h('label', { text: '번호' }), h('div', {}, num),
    h('label', { text: '이름' }), h('div', {}, nm)));
  pg.appendChild(err);
  pg.appendChild(h('div', { class: 'startrow', style: 'margin-top:6px' }, h('button', { class: 'btn red', id: 'btnStart', text: '게임 시작!', onclick: start })));
  nm.addEventListener('keydown', function (e) { if (e.key === 'Enter') start(); });
}

/* ---------- 2. 스테이지 맵 ---------- */
var STAGES = [
  { n: 1, name: '전구 켜기', ic: 'bulbIcon', sub: '전구로 수 만들기' },
  { n: 2, name: '카드 뒤집기', ic: 'cardIcon', sub: '점 카드로 수 만들기' },
  { n: 3, name: '나눗셈 사다리', ic: 'ladderIcon', sub: '2로 나누기' },
  { n: 4, name: '타임어택', ic: 'clockIcon', sub: '빠르게 변환하기' }
];
function stageTitle(s) { return s.n === 4 ? '타임어택 ' + CFG.stage.s4 + '초' : s.name; }
function renderMap(noFetch) {
  var pg = show('map');
  if (noFetch !== true) fetchConfig();
  pg.appendChild(h('div', { class: 'card topbar' },
    h('span', { class: 'pill bl', text: whoText() }), h('b', { style: 'font-size:44px', text: P.name }), h('span', { style: 'flex:1' }),
    '총점 ', h('b', { style: 'font-size:54px', id: 'mapTotal', text: fmt(totalScore()) }), '점 ',
    h('span', { class: 'pill', text: '별 ' + totalStars() + ' / 12' })));
  pg.appendChild(h('h2', { class: 'pagehead', text: '스테이지를 골라요' }));
  pg.appendChild(h('p', { class: 'pagesub', text: '노란 카드를 눌러서 도전!' }));
  var curN = 0;
  STAGES.forEach(function (s) { if (!curN && unlocked(s.n) && !prog.best[s.n]) curN = s.n; });
  var row = h('div', { class: 'stages' });
  STAGES.forEach(function (s) {
    var open = unlocked(s.n), best = prog.best[s.n], cleared = !!best, isCur = s.n === curN;
    var btn = h('button', { class: 'btn ' + (!open ? 'white' : cleared ? 'green' : 'red'), text: !open ? '잠김' : cleared ? '다시 하기' : '도전!', 'data-stage': s.n, disabled: !open });
    if (!open) btn.style.cssText = 'background:#ccc;color:#777';
    var card = h('div', { class: 'card st' + (isCur ? ' cur' : '') + (!open ? ' lock' : ''), 'data-stage': s.n },
      isCur ? h('div', { class: 'hand', text: '여기 눌러요!' }) : null,
      h('span', { class: 'no', style: !open ? 'background:#ccc' : '', text: 'STAGE ' + s.n }),
      icon(s.ic, 'ic'), h('h3', { text: stageTitle(s) }), h('p', { text: cleared ? '최고 ' + fmt(best.score) + '점' : s.sub }),
      starsEl(best ? best.stars : 0), btn);
    if (open) btn.addEventListener('click', function () { renderIntro(s.n); });
    row.appendChild(card);
  });
  pg.appendChild(row);
  var mini = h('div', { class: 'card rkmap', id: 'rkMap' });
  miniMapEl = mini; if (CFG.API_URL) { RK.fillMap(mini); } else mini.style.display = 'none';
  pg.appendChild(h('div', { class: 'maprow' },
    h('div', { class: 'mapbtns' },
    h('button', { class: 'btn white', id: 'btnWho', text: '사람 바꾸기', onclick: function () { forceNew = false; renderEntry(); } }),
    h('button', { class: 'btn blue', id: 'btnRank', text: '반 랭킹 보기', onclick: function () { renderRank(); } })), mini));
}

/* ---------- 3. 방법 안내 ---------- */
function introData(n) {
  return {
    1: ['전구를 눌러서 켜고 꺼요', ['전구는 <b>8, 4, 2, 1</b> 자릿값을 가져요', '켠 전구는 <b>1</b>, 끈 전구는 <b>0</b>', '켠 전구의 자릿값을 더해서 목표 수를 만들어요'], CFG.stage.s1 + '문제'],
    2: ['점 카드를 뒤집어요', ['카드에는 <b>8, 4, 2, 1</b>개의 점이 있어요', '앞면은 <b>1</b>, 뒷면은 <b>0</b>', '카드로 수를 만들고, 카드를 보고 수를 읽어요'], CFG.stage.s2 + '문제'],
    3: ['2로 계속 나눠요', ['몫이 <b>0</b>이 될 때까지 2로 나눠요', '나머지를 <b>아래에서 위로</b> 읽어요', '4자리가 되도록 앞에 0을 채워요'], CFG.stage.s3 + '문제'],
    4: [CFG.stage.s4 + '초 안에 많이 풀어요', ['이진수와 십진수를 빠르게 바꿔요', '연속으로 맞히면 <b>콤보</b> 점수가 올라요', '틀리면 콤보가 끊겨요'], CFG.stage.s4 + '초']
  }[n];
}
function renderIntro(n) {
  var pg = show('intro'), s = STAGES[n - 1], d = introData(n); curIntroN = n;
  var ul = h('ul', {}); d[1].forEach(function (t) { ul.appendChild(h('li', { html: t })); });
  pg.appendChild(h('div', { style: 'text-align:center;margin-top:10px' }, h('span', { class: 'pill', style: 'font-size:48px', text: 'STAGE ' + n + '  ' + d[2] })));
  pg.appendChild(h('div', { class: 'card intro' }, icon(s.ic, 'big'), h('div', {}, h('h2', { text: d[0] }), ul)));
  pg.appendChild(h('div', { class: 'introbtns' },
    h('button', { class: 'btn white', id: 'btnBack', text: '뒤로', onclick: renderMap }),
    h('button', { class: 'btn red', id: 'btnGo', text: '시작!', onclick: function () { ({ 1: startS1, 2: startS2, 3: startS3, 4: startS4 })[n](); } })));
}

/* ---------- 스테이지 공통 마무리 ---------- */
var BASE_PER_Q = { 1: 7.5, 2: 10, 3: 30 };
function finishStage(n, S) {
  var time = Math.round(S.time), score, stars, bonus = 0;
  if (n === 4) {
    var k4 = S.sec / 60; score = S.pts; stars = score >= Math.round(1500 * k4) ? 3 : score >= Math.round(800 * k4) ? 2 : 1;
  } else {
    bonus = Math.max(0, Math.round(BASE_PER_Q[n] * S.N) - time) * 2; score = S.pts + bonus;
    stars = S.wrong === 0 ? 3 : S.wrong <= 2 ? 2 : 1;
  }
  var prev = prog.best[n], isNew = !prev || score > prev.score;
  if (isNew || !prev) prog.best[n] = { score: Math.max(score, prev ? prev.score : 0), stars: Math.max(stars, prev ? prev.stars : 0) };
  else prog.best[n].stars = Math.max(stars, prev.stars);
  saveProg();
  var rec = { action: 'record', grade: CFG.GRADE, cls: P.cls, num: P.num, name: P.name, stage: n, score: score, correct: S.correct, wrong: S.wrong, time: time, combo: S.combo || 0, stars: stars, device: deviceId() };
  renderResult(n, { score: score, stars: stars, correct: S.correct, wrong: S.wrong, time: time, combo: S.combo || 0, bonus: bonus, isNew: isNew && !!prev }, rec);
}

/* ---------- 8. 결과 ---------- */
function renderResult(n, R, rec) {
  var pg = show('result');
  var sc = h('div', { class: 'big', id: 'resScore', text: '0' });
  var starBox = h('div', { id: 'resStars' });
  var status = h('span', { class: 'saved wait', id: 'saveStatus', text: '기록 저장 중...' });
  var statusBox = h('div', {}, status);
  var total = R.correct + R.wrong;
  pg.appendChild(h('div', { class: 'card resc' },
    h('div', { class: 'hd ttl' }, 'STAGE ' + n + ' ' + STAGES[n - 1].name + ' 결과', R.isNew ? h('span', { class: 'newrec', text: '신기록!' }) : null),
    starBox, sc, h('div', { style: 'font-size:36px;margin-top:-4px', text: '점' }),
    h('div', { class: 'stats' },
      h('div', {}, '정답', h('b', { text: String(R.correct) })),
      h('div', {}, '오답', h('b', { text: String(R.wrong) })),
      h('div', {}, '걸린 시간', h('b', { text: R.time + '초' })),
      h('div', {}, n === 4 ? '최고 콤보' : '시간 보너스', h('b', { text: n === 4 ? 'x' + R.combo : '+' + R.bonus })))
    , statusBox));
  var acts = h('div', { class: 'acts' },
    h('button', { class: 'btn blue', id: 'btnAgain', text: '다시 하기', onclick: function () { renderIntro(n); } }),
    h('button', { class: 'btn', id: 'btnMap', text: '스테이지 맵', onclick: renderMap }));
  if (n === 4) acts.appendChild(h('button', { class: 'btn red', id: 'btnRank2', text: '반 랭킹', onclick: renderRank }));
  pg.appendChild(acts);
  // 카운트업
  var t0 = performance.now(), dur = 1200;
  (function step(now) {
    if (!$('#resScore') || sc !== $('#resScore')) return;
    var p = Math.min(1, ((now || performance.now()) - t0) / dur);
    sc.textContent = fmt(Math.round(R.score * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step); else sc.textContent = fmt(R.score);
  })();
  var sb = starsEl(0); starBox.appendChild(sb); starBox.className = '';
  var svgs = $$('svg', sb);
  for (var i = 0; i < R.stars; i++) (function (i) {
    later(function () { svgs[i].style.fill = '#FFC800'; svgs[i].classList.add('pop'); sfx.ok(); }, 400 + i * 450);
  })(i);
  later(function () { sfx.fanfare(); confetti(40); }, 300);
  function setStatus(kind) {
    status.className = 'saved ' + kind[0]; status.textContent = kind[1];
    $$('.retry', statusBox).forEach(function (x) { x.remove(); });
    if (kind[0] === 'fail') statusBox.appendChild(h('button', { class: 'retry', id: 'btnRetry', text: '다시 시도', onclick: function () { send(); } }));
  }
  function send() {
    setStatus(['wait', '기록 저장 중...']);
    sendRecord(rec).then(function (r) {
      if (!$('#saveStatus')) return;
      if (r === 'ok') { setStatus(['', '저장 완료']); RK.now(); }
      else if (r === 'off') setStatus(['off', '기록 서버 미연결 (이 기기에만 저장)']);
      else setStatus(['fail', '저장 실패']);
    });
  }
  send();
}

/* ---------- Stage 1: 전구 켜기 ---------- */
function startS1() {
  var N1 = CFG.stage.s1, pg = show('s1'), targets = shuffle(range(1, 15)).slice(0, N1), qi = 0;
  var S = { pts: 0, correct: 0, wrong: 0, time: 0, extra: 0, N: N1 };
  var bits, target, locked, qWrong, clicks, qStart, wasOver;
  var goal = h('span', { class: 'card goal hd', id: 'goal' });
  var bulbsBox = h('div', { class: 'bulbs', id: 'bulbs' });
  var eq = h('div', { class: 'card eq hd', id: 'eq' });
  var dotsBox = h('div', { class: 'dots' }), pc = h('b', { class: 'hd', id: 'pc' });
  var hint = h('div', { class: 'hint', id: 'hint' });
  pg.style.paddingTop = '60px';
  pg.appendChild(h('div', { class: 'goalrow' }, h('span', { class: 't', text: '목표' }), goal, h('span', { class: 't', text: '을 만들어라!' })));
  pg.appendChild(bulbsBox); pg.appendChild(eq);
  pg.appendChild(h('div', { class: 'progress' }, '문제 ', dotsBox, pc));
  pg.appendChild(hint);
  var bulbBtns = [], bitEls = [];
  VALS.forEach(function (v, i) {
    var b = h('button', { class: 'bulb', type: 'button', 'data-i': i, 'aria-label': v + ' 전구', onclick: function () { toggle(i); } }, bulbSvg());
    var bit = h('div', { class: 'bit', text: '0' });
    bulbBtns.push(b); bitEls.push(bit);
    bulbsBox.appendChild(h('div', { class: 'bcol' }, b, h('div', { class: 'pv', text: String(v) }), bit));
  });
  function render() {
    var sum = sumBits(bits);
    bulbBtns.forEach(function (b, i) { b.classList.toggle('on', !!bits[i]); });
    bitEls.forEach(function (b, i) { b.textContent = bits[i]; b.style.color = bits[i] ? '#d99a00' : '#aaa'; });
    eq.innerHTML = '';
    bits.forEach(function (b, i) {
      eq.appendChild(h('span', { class: b ? '' : 'z', text: String(b ? VALS[i] : 0) }));
      if (i < 3) eq.appendChild(h('span', { style: 'margin:0 22px', text: '+' }));
    });
    eq.appendChild(h('span', { style: 'margin:0 22px', text: '=' }));
    eq.appendChild(h('span', { class: 'sum ' + (sum === target ? 'ok' : sum > target ? 'big' : 'no'), id: 'sum', text: String(sum) }));
  }
  function newQ() {
    target = targets[qi]; bits = [0, 0, 0, 0]; locked = false; qWrong = 0; clicks = 0; wasOver = false; qStart = performance.now();
    goal.textContent = target; hint.textContent = '전구를 눌러서 켜고 꺼요'; hint.className = 'hint';
    dotsBox.replaceWith(dotsBox = dotsEl(N1, qi)); pc.textContent = (qi + 1) + ' / ' + N1;
    render();
  }
  function toggle(i) {
    if (locked) return;
    bits[i] ^= 1; clicks++;
    var sum = sumBits(bits);
    if (sum > target) {
      if (!wasOver) { qWrong++; S.wrong++; sfx.ng(); }
      wasOver = true; hint.textContent = '너무 커요! 전구를 꺼 보세요'; hint.className = 'hint warnmsg'; replay(eq, 'shake');
    } else { wasOver = false; hint.textContent = '전구를 눌러서 켜고 꺼요'; hint.className = 'hint'; }
    render();
    if (sum === target) solve();
  }
  function solve() {
    locked = true; S.time += (performance.now() - qStart) / 1000;
    S.pts += qWrong === 0 ? 100 : 50; S.correct++; S.extra += Math.max(0, clicks - pop(target));
    dotsBox.replaceWith(dotsBox = dotsEl(N1, qi + 1));
    banner('정답!', eqText(bits), 1500, function () { qi++; if (qi >= N1) finishStage(1, S); else newQ(); });
  }
  newQ();
}

/* ---------- Stage 2: 카드 뒤집기 ---------- */
function dotsSvg(n) {
  var NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 100 130');
  var pos = { 1: [[50, 65]], 2: [[50, 38], [50, 92]], 4: [[30, 38], [70, 38], [30, 92], [70, 92]],
    8: [[30, 20], [70, 20], [30, 51], [70, 51], [30, 82], [70, 82], [30, 113], [70, 113]] }[n];
  pos.forEach(function (p) {
    var c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', n === 8 ? 10 : 13); c.setAttribute('fill', '#111'); s.appendChild(c);
  });
  return s;
}
function startS2() {
  var N2 = CFG.stage.s2, pg = show('s2'), targets = shuffle(range(1, 15)).slice(0, N2), qi = 0;
  while (targets.length < N2) { var cand = 1 + Math.floor(Math.random() * 15); if (cand !== targets[targets.length - 1]) targets.push(cand); }
  var typeArr = []; for (var ti = 0; ti < N2; ti++) typeArr.push(ti < Math.ceil(N2 / 2) ? 'A' : 'B');
  var types = shuffle(typeArr);
  var S = { pts: 0, correct: 0, wrong: 0, time: 0, N: N2 };
  var bits, target, type, locked, qWrong, qStart;
  var dotsBox = h('div', { class: 'dots' }), pc = h('b', { class: 'hd' });
  pg.style.paddingTop = '50px';
  var top = h('div', {}), cardsBox = h('div', { class: 'cards', id: 'cards' }), act = h('div', { class: 's2act' }), sol = h('div', { class: 'sol', id: 'sol' });
  pg.appendChild(top); pg.appendChild(cardsBox); pg.appendChild(sol); pg.appendChild(act);
  pg.appendChild(h('div', { class: 'progress' }, '문제 ', dotsBox, pc));
  var cardEls = [], bitEls = [];
  function drawCards(interactive) {
    cardsBox.innerHTML = ''; cardEls = []; bitEls = [];
    VALS.forEach(function (v, i) {
      var c = h('button', { class: 'fcard' + (interactive ? '' : ' static') + (bits[i] ? ' on' : ''), type: 'button', 'data-i': i, 'aria-label': v + '점 카드' },
        h('div', { class: 'fin' }, h('div', { class: 'ff front' }, dotsSvg(v)), h('div', { class: 'ff back' })));
      if (interactive) c.addEventListener('click', function () { if (locked) return; bits[i] ^= 1; refresh(); });
      var bit = h('div', { class: 'bit' });
      cardEls.push(c); bitEls.push(bit);
      cardsBox.appendChild(h('div', { class: 'ccol' }, c, h('div', { class: 'pv', text: String(v) }), bit));
    });
    refresh();
  }
  function refresh() {
    cardEls.forEach(function (c, i) { c.classList.toggle('on', !!bits[i]); });
    bitEls.forEach(function (b, i) { b.textContent = bits[i]; b.style.color = bits[i] ? '#d99a00' : '#aaa'; });
  }
  function newQ() {
    target = targets[qi]; type = types[qi]; locked = false; qWrong = 0; qStart = performance.now(); sol.textContent = ''; act.innerHTML = ''; act.style.display = ''; top.innerHTML = '';
    dotsBox.replaceWith(dotsBox = dotsEl(N2, qi)); pc.textContent = (qi + 1) + ' / ' + N2;
    if (type === 'A') {
      bits = [0, 0, 0, 0];
      top.appendChild(h('div', { class: 'goalrow' }, h('span', { class: 't', text: '목표' }), h('span', { class: 'card goal hd', id: 'goal', text: String(target) }), h('span', { class: 't', text: '을 만들어라!' })));
      top.appendChild(h('div', { class: 'qlab', text: '카드를 눌러 뒤집어요 (앞면 1, 뒷면 0)' }));
      drawCards(true);
      act.appendChild(h('button', { class: 'btn green', id: 'btnCheck', text: '확인', onclick: checkA }));
    } else {
      bits = bits4(target);
      top.appendChild(h('div', { class: 'goalrow' }, h('span', { class: 't', style: 'font-size:80px', text: '카드가 나타내는 수는?' })));
      top.appendChild(h('div', { class: 'qlab', text: '앞면은 1, 뒷면은 0이에요' }));
      drawCards(false);
      var opts = [target]; while (opts.length < 4) { var x = Math.floor(Math.random() * 16); if (opts.indexOf(x) < 0 && x !== 0) opts.push(x); }
      var ch = h('div', { class: 'choices', id: 'choices' });
      shuffle(opts).forEach(function (o) {
        ch.appendChild(h('button', { class: 'btn', type: 'button', 'data-v': o, text: String(o), onclick: function (ev) { pickB(o, ev.currentTarget); } }));
      });
      act.appendChild(ch);
    }
  }
  function correct() {
    locked = true; S.time += (performance.now() - qStart) / 1000;
    S.pts += qWrong === 0 ? 100 : 50; S.correct++;
    dotsBox.replaceWith(dotsBox = dotsEl(N2, qi + 1));
    banner('정답!', eqText(bits4(target)), 1500, function () { qi++; if (qi >= N2) finishStage(2, S); else newQ(); });
  }
  function wrong() {
    qWrong++; S.wrong++; sfx.ng(); sol.textContent = '풀이  ' + eqText(bits4(target)); replay(cardsBox, 'shake');
  }
  function checkA() {
    if (locked) return;
    if (sumBits(bits) === target) correct();
    else {
      wrong(); locked = true;
      later(function () { bits = [0, 0, 0, 0]; sol.textContent = ''; locked = false; refresh(); }, 2200);
    }
  }
  function pickB(v, btn) {
    if (locked || btn.classList.contains('ng')) return;
    if (v === target) correct(); else { btn.classList.add('ng'); wrong(); }
  }
  newQ();
}

/* ---------- Stage 3: 나눗셈 사다리 ---------- */
function startS3() {
  var N3 = CFG.stage.s3, pg = show('s3'), targets = shuffle(range(5, 15)).slice(0, N3), qi = 0;
  var S = { pts: 0, correct: 0, wrong: 0, time: 0, N: N3 };
  var N, ns, qs, rs, k, step, phase, readIdx, slots, qWrong, qStart, busy, usedR;
  pg.style.paddingTop = '50px';
  var goalBox = h('div', { class: 'goalrow' });
  var ladder = h('div', { class: 'card ladder', id: 'ladder' });
  var msg = h('div', { class: 'card msg', id: 's3msg' });
  var padBox = h('div', { class: 's3pad none', id: 's3pad' });
  var hintLine = h('div', { class: 'hintline', id: 's3hint' });
  var resBox = h('div', { class: 'card resrow', id: 's3res' });
  var dotsBox = h('div', { class: 'dots' }), pc = h('b', { class: 'hd' });
  pg.appendChild(goalBox);
  pg.appendChild(h('div', { class: 's3main' }, ladder, h('div', { class: 's3right' }, msg, padBox, hintLine, resBox)));
  pg.appendChild(h('div', { class: 'progress' }, '문제 ', dotsBox, pc));

  function newQ() {
    N = targets[qi]; ns = [N]; qs = []; rs = [];
    var x = N; while (x > 0) { qs.push(Math.floor(x / 2)); rs.push(x % 2); x = Math.floor(x / 2); ns.push(x); }
    k = rs.length; step = 0; phase = 'q'; readIdx = k - 1; slots = [null, null, null, null]; qWrong = 0; busy = false; usedR = []; hintLine.textContent = '';
    qStart = performance.now();
    goalBox.innerHTML = '';
    goalBox.appendChild(h('span', { class: 'card goal hd', style: 'font-size:90px;padding:0 44px', text: String(N) }));
    goalBox.appendChild(h('span', { class: 't', style: 'font-size:80px', text: '을 이진수로 바꿔요' }));
    dotsBox.replaceWith(dotsBox = dotsEl(N3, qi)); pc.textContent = (qi + 1) + ' / ' + N3;
    draw();
  }
  function draw() {
    // 사다리
    ladder.innerHTML = '';
    ladder.appendChild(h('div', { class: 'lt', text: '2로 나누기' }));
    var reading = phase === 'read' || phase === 'fill0' || phase === 'done';
    for (var i = 0; i <= step && i < k; i++) {
      var row = h('div', { class: 'lrow' }, h('span', { class: 'dv', text: '2' }), h('span', { class: 'par', text: ')' }), h('span', { class: 'dd', text: String(ns[i]) }), h('span', { class: 'dts', text: '···' }));
      var rDone = i < step || reading;
      if (rDone) {
        if (phase === 'read') {
          var pickable = !usedR[i] ;
          var b = h('button', { class: 'rr' + (rs[i] ? ' r1' : '') + (usedR[i] ? ' used' : ''), type: 'button', 'data-ri': i, text: String(rs[i]), onclick: function (ev) { pickR(+ev.currentTarget.dataset.ri, ev.currentTarget); } });
          row.appendChild(b);
        } else row.appendChild(h('span', { class: 'rr' + (rs[i] ? ' r1' : ''), text: String(rs[i]) }));
      } else row.appendChild(h('span', { class: 'slot' + (i === step && phase === 'r' ? ' act' : ''), id: i === step ? 'remSlot' : null, text: '?' }));
      ladder.appendChild(row);
    }
    // 몫 줄
    if (!reading) {
      if (phase === 'q') ladder.appendChild(h('div', { class: 'lrow' }, h('span', { class: 'dv' }), h('span', { class: 'par', text: ' ' }), h('span', { class: 'dd bare' }, h('span', { class: 'slot act', id: 'quoSlot', text: '?' }))));
      else if (qs[step] === 0) ladder.appendChild(h('div', { class: 'lrow' }, h('span', { class: 'dv' }), h('span', { class: 'par', text: ' ' }), h('span', { class: 'dd bare', text: '0' })));
    } else {
      ladder.appendChild(h('div', { class: 'lrow' }, h('span', { class: 'dv' }), h('span', { class: 'par', text: ' ' }), h('span', { class: 'dd bare', text: '0' })));
    }
    var arrow = h('div', { class: 'uparrow' + (phase === 'read' ? ' on' : '') });
    arrow.innerHTML = '<svg viewBox="0 0 60 300" preserveAspectRatio="none"><path d="M30 290V40M6 70L30 12l24 58" fill="none" stroke="#FF4B3E" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    ladder.appendChild(arrow);
    // 메시지/패드
    padBox.innerHTML = ''; padBox.className = 's3pad none';
    if (phase === 'q') {
      msg.textContent = ns[step] + ' ÷ 2 의 몫은?';
      padBox.className = 's3pad digits';
      range(0, 9).forEach(function (d) { padBox.appendChild(h('button', { class: 'btn', type: 'button', 'data-d': d, text: String(d), style: 'background:' + ['#fff', '#FFE27A', '#9CC2FF', '#9BE6B4'][d % 4], onclick: function () { answerQ(d); } })); });
    } else if (phase === 'r') {
      msg.textContent = ns[step] + ' ÷ 2 = ' + qs[step] + ' ··· 나머지는?';
      padBox.className = 's3pad rem';
      [0, 1].forEach(function (d) { padBox.appendChild(h('button', { class: 'btn ' + (d ? 'red' : 'blue'), type: 'button', 'data-d': d, text: String(d), onclick: function () { answerR(d); } })); });
    } else if (phase === 'read') {
      msg.textContent = '나머지를 아래에서 위로 읽어요! 맨 아래 나머지부터 눌러요';
    } else if (phase === 'fill0') {
      msg.textContent = '4자리로 맞추려면 앞에 0을 채워요';
      padBox.className = 's3pad one';
      padBox.appendChild(h('button', { class: 'btn green', id: 'btnFill0', type: 'button', text: '앞에 0 채우기', onclick: fill0 }));
    } else if (phase === 'done') {
      msg.textContent = N + ' = ' + slots.join('') + '(2)';
    }
    // 결과 칸
    resBox.innerHTML = '';
    resBox.appendChild(h('span', { text: '이진수' }));
    slots.forEach(function (v, i) { resBox.appendChild(h('span', { class: 'slot' + (v === null ? '' : ' fill' + (v ? ' b1' : '')), 'data-slot': i, text: v === null ? '' : String(v) })); });
    resBox.appendChild(h('span', { style: 'font-size:34px', text: '(2)' }));
  }
  function wrongMark(el, text) {
    qWrong++; S.wrong++; sfx.ng(); if (el) replay(el, 'shake'); hintLine.textContent = text;
  }
  function answerQ(d) {
    if (busy) return;
    var n = ns[step];
    if (d === qs[step]) { hintLine.textContent = ''; sfx.ok(); phase = 'r'; draw(); }
    else wrongMark($('#quoSlot'), n + ' 안에 2가 몇 번 들어갈까요? 2 × ? 가 ' + n + '을 넘지 않는 가장 큰 수를 찾아요');
  }
  function answerR(d) {
    if (busy) return;
    var n = ns[step];
    if (d === rs[step]) {
      hintLine.textContent = ''; sfx.ok();
      if (qs[step] === 0) { phase = 'read'; step = k - 1; draw(); }
      else { step++; phase = 'q'; draw(); }
    } else wrongMark($('#remSlot'), '나머지 = ' + n + ' - 2 × ' + qs[step] + ' = ?');
  }
  function pickR(i, btn) {
    if (busy || usedR[i]) return;
    if (i !== readIdx) { wrongMark(btn, '맨 아래 나머지부터, 아래에서 위로 읽어요!'); return; }
    busy = true; hintLine.textContent = ''; sfx.ok();
    var slotIdx = (4 - k) + (k - 1 - i), target = $('[data-slot="' + slotIdx + '"]', resBox);
    var from = stagePos(btn), to = stagePos(target);
    var chip = h('div', { class: 'chipfly rr' + (rs[i] ? ' r1' : ''), text: String(rs[i]), style: 'left:' + from.x + 'px;top:' + from.y + 'px' });
    stageEl.appendChild(chip);
    usedR[i] = true; btn.classList.add('used');
    requestAnimationFrame(function () { requestAnimationFrame(function () { chip.style.left = (to.x - 0) + 'px'; chip.style.top = (to.y - 0) + 'px'; }); });
    later(function () {
      chip.remove(); slots[slotIdx] = rs[i]; readIdx--; busy = false;
      if (readIdx < 0) { phase = k < 4 ? 'fill0' : 'done'; draw(); if (phase === 'done') finishQ(); } else draw();
    }, 650);
  }
  function fill0() {
    for (var i = 0; i < 4; i++) if (slots[i] === null) slots[i] = 0;
    phase = 'done'; draw(); finishQ();
  }
  function finishQ() {
    busy = true; S.time += (performance.now() - qStart) / 1000;
    S.pts += qWrong === 0 ? 100 : 50; S.correct++;
    dotsBox.replaceWith(dotsBox = dotsEl(N3, qi + 1));
    banner('정답!', N + ' = ' + slots.join('') + '(2)', 1700, function () { qi++; if (qi >= N3) finishStage(3, S); else newQ(); });
  }
  newQ();
}

/* ---------- Stage 4: 타임어택 ---------- */
function startS4() {
  var SEC = CFG.stage.s4, pg = show('s4'); pg.classList.remove('warn');
  var S = { pts: 0, correct: 0, wrong: 0, time: SEC, combo: 0, sec: SEC };
  var streak = 0, qType, ans, bits, locked = true, over = false, endAt = 0, buf = '';
  var score = h('span', { class: 'v', id: 'score', text: '0' }), okc = h('span', { class: 'v', id: 'okc', style: 'color:var(--green)', text: '0' }), ngc = h('span', { class: 'v', id: 'ngc', style: 'color:var(--red)', text: '0' });
  pg.appendChild(h('div', { class: 'hud' },
    h('div', { class: 'card' }, h('span', { text: '점수' }), score), h('div', { class: 'card' }, h('span', { text: '정답' }), okc), h('div', { class: 'card' }, h('span', { text: '오답' }), ngc)));
  var tfill = h('i', { id: 'tfill' }), tbar = h('div', { class: 'tbar', id: 'tbar' }, tfill), tnum = h('div', { class: 'tnum', id: 'tnum', text: String(SEC) });
  pg.appendChild(h('div', { class: 'timer' }, tbar, tnum));
  var combo = h('div', { class: 'combo dim', id: 'combo', text: 'COMBO' }), qlab = h('div', { class: 'lab', id: 'qlab' }), q = h('div', { class: 'q', id: 'q' }), fb = h('div', { class: 'fb', id: 'fb' });
  var padWrap = h('div', { class: 'padwrap', id: 'padwrap' });
  pg.appendChild(h('div', { class: 'play' }, h('div', { class: 'card qcard' }, combo, qlab, q, fb), padWrap));

  function mult() { return streak >= 6 ? 3 : streak >= 3 ? 2 : 1; }
  function updHud() {
    score.textContent = fmt(S.pts); okc.textContent = S.correct; ngc.textContent = S.wrong;
    if (streak > 0) { combo.textContent = streak + '연속  x' + mult(); combo.classList.remove('dim'); replay(combo, 'bump'); }
    else { combo.textContent = 'COMBO'; combo.classList.add('dim'); }
  }
  function newQ() {
    buf = ''; locked = false; fb.textContent = ''; fb.className = 'fb'; var prevAns = ans; do { ans = Math.floor(Math.random() * 16); } while (ans === prevAns); qType = Math.random() < 0.5 ? 'b2d' : 'd2b';
    padWrap.innerHTML = '';
    if (qType === 'b2d') {
      qlab.textContent = '이진수를 십진수로!';
      q.innerHTML = ''; q.appendChild(document.createTextNode(ans.toString(2).padStart(4, '0'))); q.appendChild(h('sub', { text: '(2)' })); q.appendChild(document.createTextNode(' = ?'));
      var pad = h('div', { class: 'pad' });
      range(0, 15).forEach(function (i) { pad.appendChild(h('button', { class: 'btn', type: 'button', 'data-n': i, text: String(i), style: 'background:' + ['#fff', '#FFE27A', '#9CC2FF', '#9BE6B4'][i % 4], onclick: function (ev) { answer(i, ev.currentTarget); } })); });
      padWrap.appendChild(pad);
    } else {
      bits = [0, 0, 0, 0];
      qlab.textContent = '십진수를 이진수로!';
      q.innerHTML = ''; q.appendChild(document.createTextNode(ans + ' = ?')); q.appendChild(h('sub', { text: '(2)' }));
      var tg = h('div', { class: 'pad bits' });
      VALS.forEach(function (v, i) {
        var b = h('button', { class: 'btn', type: 'button', 'data-i': i, text: '0', onclick: function () { if (locked) return; bits[i] ^= 1; b.textContent = bits[i]; b.classList.toggle('on', !!bits[i]); } });
        tg.appendChild(h('div', { class: 'tg' }, h('div', { class: 'pv', text: String(v) }), b));
      });
      padWrap.appendChild(tg);
      padWrap.appendChild(h('button', { class: 'btn green go', id: 'btnOk', type: 'button', text: '확인', onclick: function () { answer(parseInt(bits.join(''), 2), null); } }));
    }
  }
  function answer(n, btn) {
    if (locked || over) return; locked = true;
    if (n === ans) {
      streak++; S.combo = Math.max(S.combo, streak); var gain = 100 * mult(); S.pts += gain; S.correct++;
      fb.className = 'fb ok'; fb.textContent = '딩동! +' + gain; if (btn) btn.classList.add('ok');
      if (streak === 3 || streak === 6) sfx.combo(); else sfx.ok();
      updHud(); later(newQ, 350);
    } else {
      streak = 0; S.wrong++; sfx.ng();
      fb.className = 'fb ng'; fb.textContent = qType === 'b2d' ? ans.toString(2).padStart(4, '0') + '(2) = ' + ans : ans + ' = ' + ans.toString(2).padStart(4, '0') + '(2)';
      if (btn) btn.classList.add('ng'); replay(qcardEl(), 'shake'); updHud(); later(newQ, 800);
    }
  }
  function qcardEl() { return $('.qcard', pg); }
  function onKey(e) {
    if (locked || over) return;
    if (qType === 'b2d') {
      if (/^[0-9]$/.test(e.key)) { buf += e.key; fb.className = 'fb'; fb.textContent = '입력: ' + buf; if (buf.length >= 2 || parseInt(buf + '0', 10) > 15) { var v = parseInt(buf, 10); buf = ''; answer(v, v <= 15 ? $('[data-n="' + v + '"]', pg) : null); } }
      else if (e.key === 'Enter' && buf) { var v2 = parseInt(buf, 10); buf = ''; answer(v2, v2 <= 15 ? $('[data-n="' + v2 + '"]', pg) : null); }
      else if (e.key === 'Backspace') { buf = buf.slice(0, -1); fb.textContent = buf ? '입력: ' + buf : ''; }
    } else {
      if (/^[1-4]$/.test(e.key)) { var bt = $('[data-i="' + (+e.key - 1) + '"]', pg); if (bt) bt.click(); }
      else if (e.key === 'Enter') answer(parseInt(bits.join(''), 2), null);
    }
  }
  document.addEventListener('keydown', onKey); cleanups.push(function () { document.removeEventListener('keydown', onKey); });
  function tick() {
    var left = Math.max(0, Math.ceil((endAt - performance.now()) / 1000)), frac = Math.max(0, (endAt - performance.now()) / (SEC * 1000));
    var w = left <= 10;
    tnum.textContent = left; tfill.style.width = (frac * 100) + '%';
    tnum.classList.toggle('warn', w); tbar.classList.toggle('warn', w); pg.classList.toggle('warn', w);
    if (w && left !== tick.last && left > 0) sfx.tick(); tick.last = left;
    if (endAt - performance.now() <= 0) end();
  }
  function end() {
    if (over) return; over = true; locked = true;
    fb.className = 'fb ng'; fb.textContent = '시간 종료!'; sfx.go();
    later(function () { finishStage(4, S); }, 1000);
  }
  // 카운트다운 후 시작
  var cd = $('#countdown'), cdn = $('#cdnum'), c = 3;
  (function cdStep() {
    cdn.textContent = c; cd.classList.add('show'); replay(cdn, 'x'); cdn.style.animation = 'none'; void cdn.offsetWidth; cdn.style.animation = '';
    sfx.tick();
    if (c > 1) { c--; later(cdStep, 900); }
    else later(function () {
      cd.classList.remove('show'); sfx.go(); endAt = performance.now() + SEC * 1000; newQ(); updHud();
      var iv = setInterval(tick, 100); cleanups.push(function () { clearInterval(iv); }); tick();
    }, 900);
  })();
}

/* ---------- 9. 랭킹 ---------- */
function renderRank() {
  var pg = show('rank'), tab = 'cls', data = null, loading = false, failed = false, updated = '';
  pg.appendChild(h('h2', { class: 'pagehead', style: 'margin:-6px 0 0;font-size:68px', text: P.cls + '반 랭킹' }));
  var card = h('div', { class: 'card rankcard' }), body = h('div', { id: 'rankbody' }), tabs = h('div', { class: 'tabs' });
  var upd = h('span', { class: 'upd', id: 'rankUpd' });
  var tabBtns = {};
  [['cls', '우리 반 TOP 10'], ['vs', '반 대항전']].forEach(function (t) {
    tabBtns[t[0]] = h('button', { class: 'tab' + (t[0] === tab ? ' on' : ''), type: 'button', 'data-t': t[0], text: t[1], onclick: function () { tab = t[0]; $$('.tab', tabs).forEach(function (x) { x.classList.toggle('on', x.dataset.t === tab); }); draw(); } });
    tabs.appendChild(tabBtns[t[0]]);
  });
  tabs.appendChild(upd);
  card.appendChild(tabs); card.appendChild(body); pg.appendChild(card);
  pg.appendChild(h('a', { class: 'boardlink', id: 'boardLink', href: 'board.html?cls=' + P.cls, target: '_blank', rel: 'noopener', text: '선생님용 보드' }));
  pg.appendChild(h('div', { class: 'acts' },
    h('button', { class: 'btn blue', id: 'btnRefresh', text: '새로고침', onclick: function () { load(); } }),
    h('button', { class: 'btn', id: 'btnMap2', text: '스테이지 맵', onclick: renderMap })));
  var COLORS = ['#FF4B3E', '#FFC800', '#2F7BFF', '#22C55E', '#FF7EB6', '#9b7bff', '#ff9a3e', '#3ec9c9'];
  function isMe(r) { return r.num === P.num && r.name === P.name; }
  function row(r, i, me) {
    return h('div', { class: 'row' + (me ? ' me' : ''), 'data-k': r.num + '|' + r.name },
      h('span', { class: 'n', text: (r.rank || i + 1) <= 3 ? '' : String(r.rank || i + 1) }),
      (r.rank || i + 1) <= 3 ? h('span', { class: 'med ' + ['g', 's', 'br'][(r.rank || i + 1) - 1], text: String(r.rank || i + 1) }) : h('span', { class: 'medsp' }),
      h('span', { class: 'nm', text: r.num + '번 ' + r.name + (me ? '  (나)' : '') }),
      h('span', { class: 'st2', text: '별 ' + (r.stars || 0) }),
      h('span', { class: 'sc', text: fmt(r.total) }));
  }
  function draw() {
    var oldPos = {};
    $$('.row[data-k]', body).forEach(function (r) { oldPos[r.dataset.k] = r.getBoundingClientRect().top; });
    drawInner();
    $$('.row[data-k]', body).forEach(function (r) {
      var o = oldPos[r.dataset.k];
      if (o == null) return;
      var dy = (o - r.getBoundingClientRect().top) / scale;
      if (Math.abs(dy) < 2) return;
      r.style.transition = 'none'; r.style.transform = 'translateY(' + dy + 'px)';
      void r.offsetWidth; r.style.transition = 'transform .7s ease'; r.style.transform = '';
      r.classList.add(dy > 0 ? 'moveup' : 'movedown'); setTimeout(function () { r.classList.remove('moveup', 'movedown'); }, 1200);
    });
  }
  function drawInner() {
    body.innerHTML = '';
    if (!CFG.API_URL) {
      body.appendChild(h('div', { class: 'notice', id: 'offnotice', text: '기록 서버 미연결 - 이 기기에 저장된 내 기록만 보여요' }));
      body.appendChild(h('div', { class: 'hd', style: 'font-size:44px;margin:10px 0 8px', text: '내 기록 (' + P.name + ')' }));
      STAGES.forEach(function (s) {
        var b = prog.best[s.n];
        body.appendChild(h('div', { class: 'row localtbl' }, h('span', { class: 'nm', text: 'STAGE ' + s.n + '  ' + s.name }), h('span', { class: 'st2', text: b ? '별 ' + b.stars : '-' }), h('span', { class: 'sc', text: b ? fmt(b.score) : '미도전' })));
      });
      body.appendChild(h('div', { class: 'sepline' }));
      body.appendChild(h('div', { class: 'row me' }, h('span', { class: 'nm', text: '총점' }), h('span', { class: 'st2', text: '별 ' + totalStars() }), h('span', { class: 'sc', text: fmt(totalScore()) })));
      upd.textContent = ''; return;
    }
    if (loading && !data) { body.appendChild(h('div', { class: 'empty', text: '불러오는 중...' })); return; }
    if (failed && !data) { body.appendChild(h('div', { class: 'empty', text: '랭킹을 불러오지 못했어요. 새로고침을 눌러 보세요' })); return; }
    if (!data) return;
    upd.textContent = (failed ? '갱신 실패 - 이전 결과 ' : '') + (updated ? updated + ' 기준' : '');
    if (tab === 'cls') {
      var top = data.top || [];
      if (!top.length) body.appendChild(h('div', { class: 'empty', text: '아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!' }));
      top.slice(0, 10).forEach(function (r, i) { body.appendChild(row(r, i, isMe(r))); });
      if (data.me && data.me.rank > 10) { body.appendChild(h('div', { class: 'sepline' })); body.appendChild(row(data.me, 0, true)); }
    } else {
      var cl = {}; (data.classes || []).forEach(function (c) { cl[c.cls] = c; });
      var maxAvg = 1; (data.classes || []).forEach(function (c) { if (c.avg > maxAvg) maxAvg = c.avg; });
      body.appendChild(h('div', { style: 'font-size:30px;margin-bottom:6px', text: '반별 평균 총점 (' + CFG.GRADE + '학년)' }));
      for (var i = 1; i <= CFG.CLASS_COUNT; i++) {
        var c = cl[i] || { avg: 0, count: 0 }, w = c.count ? Math.max(12, c.avg / maxAvg * 70) : 0;
        body.appendChild(h('div', { class: 'barrow' + (i === P.cls ? ' me' : '') }, h('span', { class: 'cl', text: i + '반' + (i === P.cls ? ' 우리' : '') }),
          h('div', { class: 'bar', style: 'width:' + w + '%;background:' + COLORS[(i - 1) % 8] + (w ? '' : ';border-style:dashed;box-shadow:none;padding:0;width:0;border-width:0'), text: c.count ? fmt(Math.round(c.avg)) : '' }),
          h('span', { class: 'cn', text: c.count ? c.count + '명' : '참여 없음' })));
      }
    }
  }
  function onData() {
    if (!$('#rankbody')) return;
    data = RK.data; failed = RK.failed; loading = false;
    var d = RK.data && RK.data.updated ? new Date(RK.data.updated) : new Date();
    updated = (d.getHours() + '').padStart(2, '0') + ':' + (d.getMinutes() + '').padStart(2, '0') + ':' + (d.getSeconds() + '').padStart(2, '0');
    draw();
  }
  function load() {
    if (!CFG.API_URL) { draw(); return; }
    if (!data && RK.data) onData();
    else if (!data) { loading = true; draw(); }
    RK.now();
  }
  if (CFG.API_URL) { RK.listeners.push(onData); cleanups.push(function () { var i = RK.listeners.indexOf(onData); if (i >= 0) RK.listeners.splice(i, 1); }); }
  RK.start(); load();
}

/* ---------- 시작 ---------- */
(function () {
  var b = $('#rkBadge'), pop = $('#rkPop');
  if (b) b.addEventListener('click', function (e) { e.stopPropagation(); var o = !pop.classList.contains('open'); pop.classList.toggle('open', o); if (o) RK.fillPop(pop); });
  document.addEventListener('click', function (e) { if (pop && !e.target.closest('#rkPop,#rkBadge')) pop.classList.remove('open'); });
})();
fetchConfig();
renderEntry();
})();
