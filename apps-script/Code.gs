/**
 * 이진수 챌린지 기록 서버 (Google Apps Script 웹 앱)
 * 배포: 스프레드시트에 바인딩 -> 배포 > 웹 앱 (실행: 나, 액세스: 모든 사용자)
 * 처음 한 번 setup()을 실행해 records 시트를 만든다.
 */
var SHEET_NAME = 'records';
var HEADERS = ['시각', '학년', '반', '번호', '이름', '스테이지', '점수', '정답수', '오답수', '소요시간(초)', '최고콤보', '별', '기기ID'];
var MAX_CLASS = 10;
var CACHE_SECONDS = 20;

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
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
    if (!(score >= 0 && score <= 10000)) return json_({ ok: false, error: 'score' });
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
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** 학년 전체 학생의 총점(스테이지별 최고점 합)을 계산한다. 20초 캐시. */
function aggregate_(grade) {
  var cache = CacheService.getScriptCache();
  var key = 'rank_g' + grade;
  var hit = cache.get(key);
  if (hit) {
    try { return JSON.parse(hit); } catch (e) {}
  }
  var sh = getSheet_();
  var last = sh.getLastRow();
  var students = {};
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
    }
  }
  var list = [];
  for (var k in students) {
    var st = students[k], total = 0, stars2 = 0, j;
    for (j in st.sc) total += st.sc[j];
    for (j in st.st) stars2 += st.st[j];
    list.push({ cls: st.cls, num: st.num, name: st.name, total: total, stars: stars2 });
  }
  var result = { list: list, updated: new Date().toISOString() };
  try { cache.put(key, JSON.stringify(result), CACHE_SECONDS); } catch (e) {}
  return result;
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.action !== 'ranking') return json_({ ok: false, error: 'action' });
    var grade = toInt_(p.grade) || 2, cls = toInt_(p.cls);
    var agg = aggregate_(grade);
    var inClass = agg.list.filter(function (s) { return s.cls === cls; });
    inClass.sort(function (a, b) { return b.total - a.total || a.num - b.num; });
    var ranked = inClass.map(function (s, i) { return { rank: i + 1, num: s.num, name: s.name, total: s.total, stars: s.stars }; });
    var me = null;
    if (p.num && p.name) {
      var mn = toInt_(p.num), mname = String(p.name).trim();
      for (var i = 0; i < ranked.length; i++) {
        if (ranked[i].num === mn && ranked[i].name === mname) { me = ranked[i]; break; }
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
    return json_({ ok: true, top: ranked.slice(0, 10), me: me, classes: classes, updated: agg.updated });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
