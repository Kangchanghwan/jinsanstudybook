/**
 * 이진수 챌린지 기록 서버 (Google Apps Script 웹 앱) v2
 * 배포: 스프레드시트에 바인딩 -> 배포 > 웹 앱 (실행: 나, 액세스: 모든 사용자)
 * 처음 한 번 setup()을 실행해 records, settings 시트를 만든다. (이미 있으면 건드리지 않음)
 * 코드를 고친 뒤에는 배포 > 배포 관리 > 새 버전으로 다시 배포해야 반영된다.
 */
var SHEET_NAME = 'records';
var SETTINGS_SHEET = 'settings';
var HEADERS = ['시각', '학년', '반', '번호', '이름', '스테이지', '점수', '정답수', '오답수', '소요시간(초)', '최고콤보', '별', '기기ID'];
var MAX_CLASS = 10;
var CACHE_SECONDS = 5;        // 학년 랭킹 계산 결과 캐시 (실시간성)
var STALE_SECONDS = 60;       // 락을 못 잡았을 때 돌려줄 직전 결과 보관 시간
var CONFIG_CACHE_SECONDS = 10;
var RECENT_COUNT = 8;
var MAX_SCORE = 50000;

// 키, 기본값, 최소, 최대, 시트에 적을 설명
var SETTING_DEFS = [
  ['stage1_count', 8, 1, 15, '스테이지1 전구 켜기 문제 수 (1~15)'],
  ['stage2_count', 8, 1, 20, '스테이지2 카드 뒤집기 문제 수 (1~20)'],
  ['stage3_count', 5, 1, 11, '스테이지3 나눗셈 사다리 문제 수 (1~11)'],
  ['stage4_seconds', 60, 20, 180, '스테이지4 타임어택 제한 시간(초) (20~180)']
];

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  // settings 탭: 없을 때만 만든다 (이미 있으면 선생님이 고친 값을 보존)
  var st = ss.getSheetByName(SETTINGS_SHEET);
  if (!st) {
    st = ss.insertSheet(SETTINGS_SHEET);
    var rows = [['항목', '값', '설명']];
    SETTING_DEFS.forEach(function (d) { rows.push([d[0], d[1], d[4]]); });
    st.getRange(1, 1, rows.length, 3).setValues(rows);
    st.getRange(1, 1, 1, 3).setFontWeight('bold');
    st.setFrozenRows(1);
    st.setColumnWidth(1, 150); st.setColumnWidth(2, 80); st.setColumnWidth(3, 380);
  }
  return sh;
}

function getSheet_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  return sh || setup();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function toInt_(v) {
  var n = Number(v);
  return isFinite(n) ? Math.floor(n) : NaN;
}

function safeText_(s) {
  s = String(s);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/** settings 탭을 읽어 클램프한 설정을 돌려준다. 10초 캐시. 탭이 없거나 값이 이상하면 기본값. */
function getConfig_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('cfg');
  if (hit) {
    try { return JSON.parse(hit); } catch (e) {}
  }
  var cfg = {}, raw = {};
  SETTING_DEFS.forEach(function (d) { cfg[d[0]] = d[1]; });
  try {
    var st = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET);
    if (st && st.getLastRow() >= 2) {
      var vals = st.getRange(2, 1, st.getLastRow() - 1, 2).getValues();
      for (var i = 0; i < vals.length; i++) raw[String(vals[i][0]).trim()] = vals[i][1];
    }
  } catch (e) {}
  SETTING_DEFS.forEach(function (d) {
    var v = raw[d[0]];
    var n = (v === '' || v == null) ? NaN : Math.round(Number(v));
    if (isFinite(n)) cfg[d[0]] = Math.min(d[3], Math.max(d[2], n));
  });
  try { cache.put('cfg', JSON.stringify(cfg), CONFIG_CACHE_SECONDS); } catch (e) {}
  return cfg;
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action !== 'record') return json_({ ok: false, error: 'action' });
    var grade = toInt_(body.grade), cls = toInt_(body.cls), num = toInt_(body.num);
    var stage = toInt_(body.stage), score = toInt_(body.score);
    var name = String(body.name == null ? '' : body.name).trim();
    if (!(grade >= 1 && grade <= 3)) return json_({ ok: false, error: 'grade' });
    if (!(cls >= 1 && cls <= MAX_CLASS)) return json_({ ok: false, error: 'cls' });
    if (!(num >= 1 && num <= 40)) return json_({ ok: false, error: 'num' });
    if (name.length < 1 || name.length > 10) return json_({ ok: false, error: 'name' });
    if (!(stage >= 1 && stage <= 4)) return json_({ ok: false, error: 'stage' });
    if (!(score >= 0 && score <= MAX_SCORE)) return json_({ ok: false, error: 'score' });
    var correct = Math.max(0, toInt_(body.correct) || 0), wrong = Math.max(0, toInt_(body.wrong) || 0);
    var time = Math.max(0, toInt_(body.time) || 0), combo = Math.max(0, toInt_(body.combo) || 0);
    var stars = Math.min(3, Math.max(0, toInt_(body.stars) || 0));
    var device = String(body.device || '').slice(0, 40);

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      getSheet_().appendRow([new Date(), grade, cls, num, safeText_(name), stage, score, correct, wrong, time, combo, stars, safeText_(device)]);
    } finally {
      lock.releaseLock();
    }
    // 기록이 들어갔으니 학년 랭킹 캐시를 지워 다음 폴링에 바로 반영 (stale 캐시는 남겨 둔다)
    try { CacheService.getScriptCache().remove('rank_g' + grade); } catch (e2) {}
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** 시트 전체를 읽어 학년 학생별 총점(스테이지별 최고점 합)과 최근 기록을 계산한다. */
function compute_(grade) {
  var sh = getSheet_();
  var last = sh.getLastRow();
  var students = {}, recent = [];
  if (last >= 2) {
    var rows = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (Number(r[1]) !== grade) continue;
      var id = r[2] + '|' + r[3] + '|' + r[4];
      var s = students[id] || (students[id] = { cls: Number(r[2]), num: Number(r[3]), name: String(r[4]), sc: {}, st: {} });
      var stage = Number(r[5]), score = Number(r[6]), stars = Number(r[11]) || 0;
      if (!(stage in s.sc) || score > s.sc[stage]) s.sc[stage] = score;
      if (!(stage in s.st) || stars > s.st[stage]) s.st[stage] = stars;
      recent.push(i);
    }
    recent = recent.slice(-RECENT_COUNT).reverse().map(function (idx) {
      var r2 = rows[idx], t = r2[0], ts = '';
      try { ts = Utilities.formatDate(new Date(t), 'Asia/Seoul', 'HH:mm'); } catch (e) {}
      return { cls: Number(r2[2]), num: Number(r2[3]), name: String(r2[4]), stage: Number(r2[5]), score: Number(r2[6]), time: ts };
    });
  }
  var list = [];
  for (var k in students) {
    var st = students[k], total = 0, stars2 = 0, j;
    for (j in st.sc) total += st.sc[j];
    for (j in st.st) stars2 += st.st[j];
    list.push({ cls: st.cls, num: st.num, name: st.name, total: total, stars: stars2 });
  }
  return { list: list, recent: recent, updated: new Date().toISOString() };
}

/**
 * 학년 단위 랭킹 집계. 5초 캐시.
 * 캐시가 비었을 때는 스크립트 락을 3초까지 기다려 한 번만 계산하고,
 * 락을 못 잡으면 직전 결과(60초 보관 stale 캐시)를 돌려줘서 동시 계산 폭주를 막는다.
 */
function aggregate_(grade) {
  var cache = CacheService.getScriptCache();
  var key = 'rank_g' + grade, skey = 'rank_stale_g' + grade;
  var hit = cache.get(key);
  if (hit) {
    try { return JSON.parse(hit); } catch (e) {}
  }
  var lock = LockService.getScriptLock(), got = false;
  try { got = lock.tryLock(3000); } catch (e) { got = false; }
  if (!got) {
    var stale = cache.get(skey);
    if (stale) {
      try { return JSON.parse(stale); } catch (e) {}
    }
    // stale도 없으면 어쩔 수 없이 직접 계산 (드문 경우)
    return compute_(grade);
  }
  try {
    // 락을 기다리는 사이 다른 요청이 이미 계산했을 수 있다
    hit = cache.get(key);
    if (hit) {
      try { return JSON.parse(hit); } catch (e) {}
    }
    var result = compute_(grade);
    var str = JSON.stringify(result);
    try { cache.put(key, str, CACHE_SECONDS); cache.put(skey, str, STALE_SECONDS); } catch (e) {}
    return result;
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.action === 'config') return json_({ ok: true, config: getConfig_() });
    if (p.action !== 'ranking') return json_({ ok: false, error: 'action' });
    var grade = toInt_(p.grade) || 2, cls = toInt_(p.cls);
    var agg = aggregate_(grade);
    var inClass = agg.list.filter(function (s) { return s.cls === cls; });
    inClass.sort(function (a, b) { return b.total - a.total || a.num - b.num; });
    var ranked = inClass.map(function (s, i) { return { rank: i + 1, num: s.num, name: s.name, total: s.total, stars: s.stars }; });
    var me = null, ahead = [];
    if (p.num && p.name) {
      var mn = toInt_(p.num), mname = String(p.name).trim();
      for (var i = 0; i < ranked.length; i++) {
        if (ranked[i].num === mn && ranked[i].name === mname) { me = ranked[i]; ahead = ranked.slice(Math.max(0, i - 3), i); break; }
      }
    }
    var byCls = {};
    agg.list.forEach(function (s) {
      var c = byCls[s.cls] || (byCls[s.cls] = { cls: s.cls, sum: 0, count: 0 });
      c.sum += s.total; c.count++;
    });
    var classes = [];
    for (var c = 1; c <= MAX_CLASS; c++) {
      var x = byCls[c];
      classes.push({ cls: c, avg: x ? Math.round(x.sum / x.count) : 0, count: x ? x.count : 0 });
    }
    return json_({ ok: true, top: ranked.slice(0, 10), me: me, ahead: ahead, classes: classes, recent: agg.recent || [], config: getConfig_(), updated: agg.updated });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
