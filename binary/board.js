/* 이진수 챌린지 - 선생님용 실시간 랭킹 보드 (프로젝터용, 3초 폴링) */
(function () {
'use strict';
var CFG = Object.assign({ API_URL: '', CLASS_COUNT: 10, GRADE: 2 }, window.GAME_CONFIG || {});
var DEBUG = /[?&]debug=1/.test(location.search);
if (DEBUG) { var apiQ = /[?&]api=([^&]*)/.exec(location.search); if (apiQ) CFG.API_URL = decodeURIComponent(apiQ[1]); }
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
function h(tag, attrs) {
  var e = document.createElement(tag); attrs = attrs || {};
  Object.keys(attrs).forEach(function (k) {
    var v = attrs[k]; if (v == null || v === false) return;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k === 'style') e.setAttribute('style', v);
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  });
  for (var i = 2; i < arguments.length; i++) {
    var c = arguments[i]; if (c == null || c === false) continue;
    if (Array.isArray(c)) c.forEach(function (x) { if (x) e.appendChild(x); }); else e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}
function fmt(n) { return Number(n).toLocaleString('ko-KR'); }
var stageEl = $('#stage'), scale = 1;
function fit() {
  scale = Math.min(innerWidth / 1920, innerHeight / 1080);
  stageEl.style.transform = 'scale(' + scale + ')';
  stageEl.style.left = (innerWidth - 1920 * scale) / 2 + 'px';
  stageEl.style.top = (innerHeight - 1080 * scale) / 2 + 'px';
}
addEventListener('resize', fit); fit();

var timers = [];
function clearAll() { timers.forEach(function (t) { clearTimeout(t); clearInterval(t); }); timers = []; }
function getCls() { var m = /[?&]cls=(\d+)/.exec(location.search); var c = m ? parseInt(m[1], 10) : 0; return c >= 1 && c <= CFG.CLASS_COUNT ? c : 0; }

$('#btnFull').addEventListener('click', function () {
  if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
});
$('#btnPick').addEventListener('click', function () { history.replaceState(null, '', 'board.html' + (DEBUG ? location.search.replace(/[?&]cls=\d+/, '').replace(/^&/, '?') : '')); route(); });

function route() {
  clearAll();
  var cls = getCls();
  $('#bd-pick').classList.toggle('on', !cls); $('#bd-main').classList.toggle('on', !!cls);
  $('#btnPick').style.display = cls ? '' : 'none';
  if (!cls) renderPick(); else renderBoard(cls);
}

function renderPick() {
  var pg = $('#bd-pick'); pg.innerHTML = '';
  pg.appendChild(h('h2', { class: 'pagehead', style: 'font-size:110px;margin-top:150px', text: '어느 반 랭킹을 띄울까요?' }));
  var box = h('div', { id: 'bdClasses' });
  for (var i = 1; i <= CFG.CLASS_COUNT; i++) (function (i) {
    box.appendChild(h('button', { class: 'btn blue', type: 'button', 'data-cls': i, text: i + '반', onclick: function () {
      var q = location.search.replace(/[?&]cls=\d+/, '').replace(/^&/, '?');
      history.replaceState(null, '', 'board.html' + (q ? q + '&' : '?') + 'cls=' + i); route();
    } }));
  })(i);
  pg.appendChild(box);
  if (!CFG.API_URL) pg.appendChild(h('div', { class: 'notice', style: 'width:1000px;margin:40px auto', text: '기록 서버가 연결되지 않았어요' }));
}

var COLORS = ['#FF4B3E', '#FFC800', '#2F7BFF', '#22C55E', '#FF7EB6', '#9b7bff', '#ff9a3e', '#3ec9c9', '#8bc34a', '#795548'];
function renderBoard(cls) {
  var pg = $('#bd-main'); pg.innerHTML = '';
  var clock = h('div', { class: 'bdclock', id: 'bdClock' }), cnt = h('div', { class: 'bdcount', id: 'bdCount', text: '참여 - 명' });
  pg.appendChild(h('div', { class: 'bdhead' }, h('h1', { class: 'bdtitle', id: 'bdTitle', text: cls + '반 실시간 랭킹' }), h('div', { class: 'bdinfo' }, clock, cnt)));
  var list = h('div', { class: 'card bdlist', id: 'bdList' }), bars = h('div', { class: 'card bdbars', id: 'bdBars' });
  pg.appendChild(h('div', { class: 'bdmain' }, list, bars));
  var ticker = h('div', { class: 'card bdticker', id: 'bdTicker' });
  pg.appendChild(ticker);
  function tickClock() { var d = new Date(); clock.textContent = (d.getHours() + '').padStart(2, '0') + ':' + (d.getMinutes() + '').padStart(2, '0') + ':' + (d.getSeconds() + '').padStart(2, '0'); }
  tickClock(); timers.push(setInterval(tickClock, 1000));

  var rows = {}, prevRank = {}, vals = {}, first = true, inflight = false, failed = false, lastTickerKey = '';
  var ROW_H = 62;
  var statusEl = h('div', { class: 'bdstatus', id: 'bdStatus' });
  pg.appendChild(statusEl);
  list.appendChild(h('div', { class: 'bdlisthd', text: cls + '반 TOP 10' }));
  var rowsBox = h('div', { class: 'bdrows', id: 'bdRows' }); list.appendChild(rowsBox);
  var emptyEl = h('div', { class: 'empty', style: 'margin-top:200px', text: '아직 기록이 없어요. 첫 번째 주인공은 누구?' });
  rowsBox.appendChild(emptyEl);

  function countUp(el, from, to) {
    var t0 = performance.now(), dur = 800;
    (function step(now) {
      if (!document.body.contains(el)) return;
      var p = Math.min(1, ((now || performance.now()) - t0) / dur);
      el.textContent = fmt(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    })();
  }
  function applyTop(top) {
    emptyEl.style.display = top.length ? 'none' : '';
    var keys = {};
    top.forEach(function (r, i) {
      var k = r.num + '|' + r.name; keys[k] = 1;
      var el = rows[k], isNew = !el;
      if (isNew) {
        var medal = h('span', { class: 'bdrank' });
        el = h('div', { class: 'bdrow', 'data-k': k }, medal, h('span', { class: 'bdnm', text: r.num + '번 ' + r.name }), h('span', { class: 'bdst', text: '별 ' + (r.stars || 0) }), h('span', { class: 'bdsc', text: '0' }));
        el.style.top = (i * ROW_H + (first ? 0 : 0)) + 'px';
        rowsBox.appendChild(el); rows[k] = el; vals[k] = 0;
      }
      var rk = el.firstChild;
      rk.className = 'bdrank' + (r.rank <= 3 ? ' med ' + ['g', 's', 'br'][r.rank - 1] : '');
      rk.textContent = String(r.rank);
      $('.bdst', el).textContent = '별 ' + (r.stars || 0);
      var scEl = $('.bdsc', el);
      if (vals[k] !== r.total) { countUp(scEl, vals[k], r.total); if (!isNew || !first) flash(el); vals[k] = r.total; }
      var pr = prevRank[k];
      var newTop = (isNew && !first) || (pr != null && pr !== r.rank);
      var targetTop = i * ROW_H;
      if (isNew) { el.style.opacity = '0'; el.style.top = targetTop + 'px'; requestAnimationFrame(function () { el.style.opacity = '1'; }); }
      else el.style.top = targetTop + 'px';
      if (pr != null && pr !== r.rank) flash(el, pr > r.rank ? 'up' : 'down');
      else if (isNew && !first) flash(el, 'up');
      prevRank[k] = r.rank;
    });
    Object.keys(rows).forEach(function (k) {
      if (!keys[k]) { var e = rows[k]; e.style.opacity = '0'; delete rows[k]; delete prevRank[k]; delete vals[k]; setTimeout(function () { e.remove(); }, 700); }
    });
  }
  function flash(el, dir) { el.classList.remove('flash', 'fup', 'fdown'); void el.offsetWidth; el.classList.add('flash'); if (dir) el.classList.add(dir === 'up' ? 'fup' : 'fdown'); }
  function applyBars(classes) {
    var cl = {}; (classes || []).forEach(function (c) { cl[c.cls] = c; });
    var max = 1; (classes || []).forEach(function (c) { if (c.avg > max) max = c.avg; });
    if (!bars.firstChild) {
      bars.appendChild(h('div', { class: 'bdlisthd', text: '반 대항전 (평균 총점)' }));
      for (var i = 1; i <= CFG.CLASS_COUNT; i++) bars.appendChild(h('div', { class: 'bdbar' + (i === cls ? ' me' : ''), 'data-c': i },
        h('span', { class: 'cl', text: i + '반' }), h('div', { class: 'tr' }, h('div', { class: 'bar', style: 'background:' + COLORS[(i - 1) % 10] })), h('span', { class: 'av', text: '0' })));
    }
    for (var j = 1; j <= CFG.CLASS_COUNT; j++) {
      var row = $('[data-c="' + j + '"]', bars), c = cl[j] || { avg: 0, count: 0 };
      var bar = $('.bar', row); bar.style.width = (c.count ? Math.max(3, c.avg / max * 100) : 0) + '%';
      var av = $('.av', row), nv = c.count ? c.avg : 0, ov = Number(row.dataset.v || 0);
      if (ov !== nv) { countUp(av, ov, nv); row.dataset.v = nv; }
      if (!c.count) av.textContent = '-';
      row.title = c.count + '명';
    }
  }
  function applyTicker(recent) {
    var arr = (recent || []).slice();
    arr = arr.filter(function (r) { return r.cls === cls; }).concat(arr.filter(function (r) { return r.cls !== cls; })).slice(0, 5);
    var key = JSON.stringify(arr);
    if (key === lastTickerKey) return; lastTickerKey = key;
    ticker.innerHTML = '';
    ticker.appendChild(h('div', { class: 'tklab', text: '방금 기록' }));
    if (!arr.length) ticker.appendChild(h('span', { class: 'tkempty', text: '아직 기록이 없어요' }));
    arr.forEach(function (r, i) {
      ticker.appendChild(h('div', { class: 'tkit' + (r.cls === cls ? ' mine' : '') + (i === 0 ? ' fresh' : ''), 'data-cls': r.cls },
        h('span', { text: r.cls + '반 ' + r.num + '번 ' + r.name }), h('b', { text: 'STAGE ' + r.stage + '  ' + fmt(r.score) + '점' })));
    });
  }
  function poll() {
    if (document.hidden || inflight) return;
    if (!CFG.API_URL) { statusEl.textContent = '기록 서버 미연결'; return; }
    inflight = true;
    fetch(CFG.API_URL + (CFG.API_URL.indexOf('?') < 0 ? '?' : '&') + 'action=ranking&grade=' + CFG.GRADE + '&cls=' + cls)
      .then(function (r) { return r.json(); }).then(function (j) {
        inflight = false;
        if (!j || !j.ok) throw new Error('bad');
        failed = false; statusEl.textContent = '';
        applyTop(j.top || []); applyBars(j.classes); applyTicker(j.recent);
        var mine = (j.classes || []).filter(function (c) { return c.cls === cls; })[0];
        cnt.textContent = '참여 ' + (mine ? mine.count : 0) + '명';
        first = false;
      }).catch(function () { inflight = false; failed = true; statusEl.textContent = '연결 재시도 중...'; });
  }
  poll(); timers.push(setInterval(poll, 3000));
  var vis = function () { if (!document.hidden) poll(); };
  document.addEventListener('visibilitychange', vis);
  timers.push({ }); // placeholder (clearTimeout on object is a no-op)
}
route();
})();
