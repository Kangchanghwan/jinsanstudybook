/* 이진수 챌린지 - 선생님 설정 페이지 (링크 없음, 주소를 아는 사람만) */
(function () {
'use strict';
var CFG = Object.assign({ API_URL: '' }, window.GAME_CONFIG || {});
var DEBUG = /[?&]debug=1/.test(location.search);
// 디버그 전용: ?debug=1&api=<주소> 로 API 주소를 바꿔 모의 서버로 테스트할 수 있다.
if (DEBUG) { var apiQ = /[?&]api=([^&]*)/.exec(location.search); if (apiQ) CFG.API_URL = decodeURIComponent(apiQ[1]); }
var $ = function (s) { return document.querySelector(s); };
function h(tag, attrs) {
  var e = document.createElement(tag); attrs = attrs || {};
  Object.keys(attrs).forEach(function (k) {
    var v = attrs[k]; if (v == null || v === false) return;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  });
  for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c == null || c === false) continue; if (Array.isArray(c)) c.forEach(function (x) { e.appendChild(x); }); else e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
  return e;
}

var KEY_STORE = 'binq.adm';
var DEF = { s1: { on: 1, bits: 4, count: 8 }, s2: { on: 1, bits: 4, count: 8 }, s3: { on: 1, bits: 4, count: 5 }, s4: { on: 1, bits: 4, sec: 60 } };
var NAMES = { 1: '전구 켜기', 2: '카드 뒤집기', 3: '나눗셈 사다리', 4: '타임어택' };
var state = null, key = '';

function s3Range(b) { return [Math.max(5, Math.pow(2, b - 1)), Math.pow(2, b) - 1]; }
function capOf(n, b) {
  var max = Math.pow(2, b) - 1;
  if (n === 1) return Math.min(30, max);
  if (n === 2) return 30;
  var r = s3Range(b); return Math.min(20, r[1] - r[0] + 1);
}
function rangeText(n, b) {
  var max = Math.pow(2, b) - 1;
  if (n === 3) { var r = s3Range(b); return '문제 숫자 범위 ' + r[0] + ' ~ ' + r[1]; }
  return '문제 숫자 범위 ' + (n === 4 || n === 1 || n === 2 ? 1 : 0) + ' ~ ' + max;
}
function clampState(st) {
  [1, 2, 3, 4].forEach(function (n) {
    var o = st['s' + n];
    o.bits = Math.min(8, Math.max(3, o.bits));
    if (n === 4) o.sec = Math.min(180, Math.max(20, o.sec));
    else o.count = Math.min(capOf(n, o.bits), Math.max(1, o.count));
  });
}
function fromConfig(c) {
  var st = JSON.parse(JSON.stringify(DEF));
  function num(v) { var n = Math.round(Number(v)); return (v === '' || v == null || !isFinite(n)) ? NaN : n; }
  [1, 2, 3, 4].forEach(function (n) {
    var o = st['s' + n], p = 'stage' + n + '_', v;
    v = num(c[p + 'enabled']); if (!isNaN(v)) o.on = v === 0 ? 0 : 1;
    v = num(c[p + 'bits']); if (!isNaN(v)) o.bits = v;
    if (n === 4) { v = num(c.stage4_seconds); if (!isNaN(v)) o.sec = v; }
    else { v = num(c[p + 'count']); if (!isNaN(v)) o.count = v; }
  });
  clampState(st); return st;
}
function toSettings(st) {
  var s = {};
  [1, 2, 3, 4].forEach(function (n) {
    var o = st['s' + n]; s['stage' + n + '_enabled'] = o.on ? 1 : 0; s['stage' + n + '_bits'] = o.bits;
    if (n === 4) s.stage4_seconds = o.sec; else s['stage' + n + '_count'] = o.count;
  });
  return s;
}

/* ---------- 서버 통신 ---------- */
function post(obj) {
  return fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify(obj) }).then(function (r) { return r.json(); });
}
function postBlind(obj) { return fetch(CFG.API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(obj) }); }
function getConfig() {
  return fetch(CFG.API_URL + (CFG.API_URL.indexOf('?') < 0 ? '?' : '&') + 'action=config').then(function (r) { return r.json(); }).then(function (j) { if (!j || !j.ok) throw new Error('bad'); return j.config; });
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* ---------- 화면 ---------- */
function showView(name) { $('#keyview').hidden = name !== 'key'; $('#setview').hidden = name !== 'set'; }
function askKey(msg) {
  showView('key'); $('#keyerr').textContent = msg || ''; var i = $('#keyinp'); i.value = ''; i.focus();
}
function tryKey(k) {
  if (!CFG.API_URL) { askKey('기록 서버 주소가 설정되어 있지 않아요'); return; }
  $('#keyerr').textContent = '확인 중...';
  post({ action: 'adminCheck', key: k }).then(function (j) {
    if (j && j.ok && j.config) { key = k; try { sessionStorage.setItem(KEY_STORE, k); } catch (e) {} state = fromConfig(j.config); renderRows(); showView('set'); }
    else { try { sessionStorage.removeItem(KEY_STORE); } catch (e) {} key = ''; askKey('키가 올바르지 않습니다'); }
  }).catch(function () { showView('key'); $('#keyerr').textContent = '서버에 연결하지 못했어요. 잠시 뒤 다시 해 보세요'; });
}

function renderRows() {
  var box = $('#rows'); box.innerHTML = '';
  [1, 2, 3, 4].forEach(function (n) {
    var o = state['s' + n];
    var sw = h('button', { class: 'sw ' + (o.on ? 'on' : 'off'), type: 'button', 'data-sw': n, text: o.on ? '켜짐' : '꺼짐', onclick: function () { o.on = o.on ? 0 : 1; renderRows(); } });
    var chips = h('div', { class: 'chips' });
    for (var b = 3; b <= 8; b++) (function (b) {
      chips.appendChild(h('button', { class: 'chip' + (o.bits === b ? ' sel' : ''), type: 'button', 'data-bits': n + '-' + b, text: String(b), onclick: function () { o.bits = b; clampState(state); renderRows(); } }));
    })(b);
    var stepper;
    if (n === 4) {
      stepper = h('div', { class: 'stepper' },
        h('button', { class: 'sb', type: 'button', 'data-dec': n, text: '\u2212', disabled: o.sec <= 20, onclick: function () { o.sec = Math.max(20, o.sec - 10); renderRows(); } }),
        h('span', { class: 'val', 'data-val': n, text: o.sec + '초' }),
        h('button', { class: 'sb', type: 'button', 'data-inc': n, text: '+', disabled: o.sec >= 180, onclick: function () { o.sec = Math.min(180, o.sec + 10); renderRows(); } }));
    } else {
      var cap = capOf(n, o.bits);
      stepper = h('div', { class: 'stepper' },
        h('button', { class: 'sb', type: 'button', 'data-dec': n, text: '\u2212', disabled: o.count <= 1, onclick: function () { o.count = Math.max(1, o.count - 1); renderRows(); } }),
        h('span', { class: 'val', 'data-val': n, text: o.count + '문제' }),
        h('button', { class: 'sb', type: 'button', 'data-inc': n, text: '+', disabled: o.count >= cap, onclick: function () { o.count = Math.min(cap, o.count + 1); renderRows(); } }));
    }
    var cnt = n === 4 ? '제한 시간 (20~180초, 10초 단위)' : '문제 수 (최대 ' + capOf(n, o.bits) + ')';
    box.appendChild(h('div', { class: 'card adm-card strow' + (o.on ? '' : ' disabled'), 'data-stage': n },
      h('div', {}, sw),
      h('div', { class: 'nm' }, 'STAGE ' + n + '  ' + NAMES[n]),
      h('div', { class: 'ctl' }, h('div', { class: 'lbl', text: '비트 수 (3~8)' }), chips, h('div', { class: 'rng', text: rangeText(n, o.bits) })),
      h('div', { class: 'ctl' }, h('div', { class: 'lbl', text: cnt }), stepper)));
  });
}

function save() {
  $('#saveerr').textContent = ''; $('#saveok').textContent = '';
  var any = [1, 2, 3, 4].some(function (n) { return state['s' + n].on; });
  if (!any) { $('#saveerr').textContent = '스테이지를 하나 이상 켜 주세요'; return; }
  clampState(state);
  var settings = toSettings(state), btn = $('#btnSave'); btn.disabled = true;
  $('#saveok').textContent = '저장 중...';
  function done(cfg) {
    btn.disabled = false; state = fromConfig(cfg); renderRows(); $('#saveerr').textContent = '';
    $('#saveok').textContent = '저장 완료! 학생이 다음에 시작하는 스테이지부터 적용돼요';
  }
  function fail(msg) { btn.disabled = false; $('#saveok').textContent = ''; $('#saveerr').textContent = msg; }
  post({ action: 'saveSettings', key: key, settings: settings }).then(function (j) {
    if (j && j.ok && j.config) done(j.config);
    else if (j && j.error === 'auth') { try { sessionStorage.removeItem(KEY_STORE); } catch (e) {} btn.disabled = false; $('#saveok').textContent = ''; askKey('키가 올바르지 않습니다'); }
    else fail('저장하지 못했어요 (' + (j && j.error || '알 수 없음') + ')');
  }).catch(function () {
    // 응답을 못 읽는 환경(CORS 등): 응답 없이 보내고, 잠시 뒤 설정을 읽어 반영됐는지 확인
    postBlind({ action: 'saveSettings', key: key, settings: settings }).then(function () { return sleep(1500); }).then(getConfig).then(function (cfg) {
      var got = toSettings(fromConfig(cfg)), same = Object.keys(settings).every(function (k) { return got[k] === settings[k]; });
      if (same) done(cfg); else fail('저장을 확인하지 못했어요. 키가 맞는지, 잠시 뒤 다시 시도해 보세요');
    }).catch(function () { fail('서버에 연결하지 못했어요'); });
  });
}

function init() {
  $('#keybtn').addEventListener('click', function () { var v = $('#keyinp').value.trim(); if (v) tryKey(v); });
  $('#keyinp').addEventListener('keydown', function (e) { if (e.key === 'Enter') { var v = e.target.value.trim(); if (v) tryKey(v); } });
  $('#btnSave').addEventListener('click', save);
  $('#btnDef').addEventListener('click', function () { $('#defAsk').hidden = false; $('#btnDef').hidden = true; });
  $('#defNo').addEventListener('click', function () { $('#defAsk').hidden = true; $('#btnDef').hidden = false; });
  $('#defYes').addEventListener('click', function () {
    state = JSON.parse(JSON.stringify(DEF)); renderRows(); $('#defAsk').hidden = true; $('#btnDef').hidden = false;
    $('#saveok').textContent = '기본값을 채웠어요. 저장을 눌러야 적용돼요'; $('#saveerr').textContent = '';
  });
  // 해시(#k=키) -> sessionStorage 로 옮기고 주소창에서는 지운다
  var m = /[#&]k=([^&]*)/.exec(location.hash), k = '';
  if (m) { try { k = decodeURIComponent(m[1]); } catch (e) { k = m[1]; } try { sessionStorage.setItem(KEY_STORE, k); } catch (e) {} }
  if (location.hash) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
  if (!k) { try { k = sessionStorage.getItem(KEY_STORE) || ''; } catch (e) {} }
  if (k) tryKey(k); else askKey('');
}
init();
})();
