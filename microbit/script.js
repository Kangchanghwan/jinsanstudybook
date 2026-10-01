/* micro:bit 수업 자료 — 이미지 라이트박스 + MakeCode 임베드 + 단계 페이지
   외부 라이브러리 없이 바닐라 JS만 사용한다. */
(function () {
  'use strict';

  /* ==========================================================
     이미지 라이트박스
     블록 코드 글씨가 작아 확대 없이는 읽기 어렵다.
     클릭 -> 어두운 배경 위에 원본 크기로 표시.
     다시 클릭하거나 ESC 로 닫는다. 원본이 화면보다 크면 스크롤된다.
     ========================================================== */
  var box = null;
  var boxImg = null;
  var closeBtn = null;
  var lastTrigger = null;

  function buildLightbox() {
    box = document.createElement('div');
    box.className = 'lightbox';
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', '이미지 확대 보기');

    closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'lightbox-close';
    closeBtn.textContent = '닫기 (ESC)';

    boxImg = document.createElement('img');
    boxImg.alt = '';

    box.appendChild(boxImg);
    document.body.appendChild(box);
    document.body.appendChild(closeBtn);
    closeBtn.hidden = true;

    box.addEventListener('click', closeLightbox);
    closeBtn.addEventListener('click', closeLightbox);
  }

  function openLightbox(img) {
    if (!box) buildLightbox();
    boxImg.src = img.currentSrc || img.src;
    boxImg.alt = img.alt || '';
    box.hidden = false;
    closeBtn.hidden = false;
    box.scrollTop = 0;
    box.scrollLeft = 0;
    document.body.classList.add('lb-open');
    closeBtn.focus();
  }

  function closeLightbox() {
    if (!box || box.hidden) return;
    box.hidden = true;
    closeBtn.hidden = true;
    boxImg.removeAttribute('src');
    document.body.classList.remove('lb-open');
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
  }

  document.addEventListener('click', function (e) {
    var fig = e.target.closest ? e.target.closest('.shot') : null;
    if (!fig || fig.classList.contains('print-only')) return;
    var img = fig.querySelector('img');
    if (!img) return;
    lastTrigger = fig;
    openLightbox(img);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
  });

  /* 확대 가능한 이미지에 키보드 접근성 부여 */
  document.addEventListener('DOMContentLoaded', function () {
    var shots = document.querySelectorAll('.shot:not(.print-only)');
    for (var i = 0; i < shots.length; i++) {
      var s = shots[i];
      s.tabIndex = 0;
      s.setAttribute('role', 'button');
      s.setAttribute('aria-label', '이미지 크게 보기');
      s.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          lastTrigger = this;
          openLightbox(this.querySelector('img'));
        }
      });
    }
  });

  /* ==========================================================
     MakeCode 임베드
     <div class="mc" data-share="S…" data-name="…"> 안에서
     - 블록 코드 iframe 은 "보기 전용"이다. CSS 로 pointer-events 를 막아
       학생이 안의 "편집" 버튼을 눌러 MakeCode 편집기를 열 수 없게 한다.
     - sandbox 에 allow-popups 를 주지 않아 새 창도 열리지 않는다.
     - [시뮬레이터] 탭(기본 프로젝트만): 처음 눌렀을 때만 iframe 을 만든다(무거워서).
     - [크게 보기]: 높이를 화면의 86% 로 늘였다 줄였다 한다.
     ========================================================== */
  var MC = 'https://makecode.microbit.org/';
  var SANDBOX = 'allow-scripts allow-same-origin';

  function mcFrame(wrap, view) {
    var share = wrap.getAttribute('data-share');
    var name = wrap.getAttribute('data-name') || '';
    var slot = wrap.querySelector('.mc-frame');
    var frame = slot.querySelector('iframe[data-view="' + view + '"]');
    if (frame) return frame;

    frame = document.createElement('iframe');
    frame.setAttribute('data-view', view);
    if (view === 'sim') {
      frame.src = MC + '---run?id=' + share;
      frame.title = name + ' 시뮬레이터';
    } else {
      frame.src = MC + '---codeembed#pub:' + share;
      frame.title = name + ' 블록 코드';
      frame.tabIndex = -1;
    }
    frame.setAttribute('sandbox', SANDBOX);
    slot.appendChild(frame);
    return frame;
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : null;
    if (!t) return;

    var tab = t.closest('[data-mc-view]');
    if (tab) {
      var wrap = tab.closest('.mc');
      var view = tab.getAttribute('data-mc-view');
      var tabs = wrap.querySelectorAll('[data-mc-view]');
      for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.toggle('is-on', tabs[i] === tab);
        tabs[i].setAttribute('aria-selected', tabs[i] === tab ? 'true' : 'false');
      }
      var frames = wrap.querySelectorAll('.mc-frame iframe');
      for (var j = 0; j < frames.length; j++) frames[j].hidden = true;
      mcFrame(wrap, view).hidden = false;
      return;
    }

    var tall = t.closest('[data-mc-tall]');
    if (tall) {
      var mc = tall.closest('.mc');
      var on = mc.classList.toggle('mc--tall');
      tall.textContent = on ? '작게 보기' : '크게 보기';
      if (on && mc.scrollIntoView) mc.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  });

  /* 페이지가 열리면 블록 코드 iframe 을 확인한다.
     HTML 에 이미 있으면 sandbox 만 맞추고, 없으면 만든다. */
  document.addEventListener('DOMContentLoaded', function () {
    var wraps = document.querySelectorAll('.mc[data-share]');
    for (var i = 0; i < wraps.length; i++) {
      var f = mcFrame(wraps[i], 'blocks');
      f.setAttribute('sandbox', SANDBOX);
      f.tabIndex = -1;
    }
  });

  /* ==========================================================
     단계 페이지 (마퀸 프로젝트)
     <main class="detail-main"> 안의 <section class="step" id="s1" data-title="소개">
     들을 한 번에 하나만 보여 준다. 위에는 단계 탭, 아래에는 이전/다음 버튼을
     자동으로 만든다. 주소의 #s3 처럼 해시로 단계를 기억하므로 뒤로 가기와
     다른 페이지에서의 링크(p7-….html#s3)가 그대로 동작한다.
     JS 가 꺼져 있거나 인쇄할 때는 모든 단계가 순서대로 다 보인다.
     ========================================================== */
  var STEP_OFFSET = 74;

  function initSteps() {
    var main = document.querySelector('.detail-main');
    if (!main) return;
    var steps = main.querySelectorAll('.step[id]');
    if (steps.length < 2) return;

    var byId = {};
    var order = [];
    for (var i = 0; i < steps.length; i++) {
      byId[steps[i].id] = steps[i];
      order.push(steps[i].id);
    }

    function titleOf(step) { return step.getAttribute('data-title') || step.id; }

    /* 위쪽 단계 탭 */
    var nav = document.createElement('nav');
    nav.className = 'stepnav';
    nav.setAttribute('aria-label', '프로젝트 단계');
    var ol = document.createElement('ol');
    var links = [];
    for (var k = 0; k < order.length; k++) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + order[k];
      a.setAttribute('data-step-link', order[k]);
      var n = document.createElement('span');
      n.className = 'stepnav-n';
      n.textContent = String(k + 1);
      a.appendChild(n);
      a.appendChild(document.createTextNode(titleOf(byId[order[k]])));
      li.appendChild(a);
      ol.appendChild(li);
      links.push(a);
    }
    nav.appendChild(ol);
    steps[0].parentNode.insertBefore(nav, steps[0]);

    /* 각 단계 아래 이전/다음 버튼 */
    for (var m = 0; m < order.length; m++) {
      var foot = document.createElement('div');
      foot.className = 'stepfoot';

      if (m > 0) {
        var prev = document.createElement('a');
        prev.className = 'stepbtn stepbtn--prev';
        prev.href = '#' + order[m - 1];
        prev.textContent = '← 이전 · ' + titleOf(byId[order[m - 1]]);
        foot.appendChild(prev);
      } else {
        foot.appendChild(document.createElement('span'));
      }

      var count = document.createElement('span');
      count.className = 'stepcount';
      count.textContent = (m + 1) + ' / ' + order.length;
      foot.appendChild(count);

      if (m < order.length - 1) {
        var next = document.createElement('a');
        next.className = 'stepbtn stepbtn--next';
        next.href = '#' + order[m + 1];
        next.textContent = '다음 · ' + titleOf(byId[order[m + 1]]) + ' →';
        foot.appendChild(next);
      } else {
        var home = document.createElement('a');
        home.className = 'stepbtn stepbtn--next';
        home.href = 'index.html';
        home.textContent = '프로젝트 목록으로 →';
        foot.appendChild(home);
      }
      byId[order[m]].appendChild(foot);
    }

    function fromHash() {
      var id = (location.hash || '').replace('#', '');
      return byId[id] ? id : order[0];
    }

    function show(id, scroll) {
      for (var i = 0; i < order.length; i++) {
        var on = order[i] === id;
        byId[order[i]].classList.toggle('is-on', on);
        links[i].classList.toggle('is-on', on);
        if (on) links[i].setAttribute('aria-current', 'step');
        else links[i].removeAttribute('aria-current');
      }
      if (scroll) {
        /* 단계 탭이 보이도록 단계 시작 위치에서 탭 높이만큼 위로 (CSS scroll-margin-top 과 같은 값) */
        var top = byId[id].getBoundingClientRect().top + window.pageYOffset - STEP_OFFSET;
        window.scrollTo(0, top < 0 ? 0 : top);
      }
    }

    main.classList.add('steps-on');

    /* #s3 처럼 단계 주소로 바로 들어오면 브라우저가 load 가 끝날 때까지
       그 요소로 계속 점프하려 한다(다른 단계가 숨겨지기 전 높이 기준이라 위치가 틀어진다).
       load 가 끝날 때까지 id 를 잠시 떼어 두어 브라우저 점프를 막고, 우리가 직접 맞춘다. */
    var startId = fromHash();
    for (var q = 0; q < order.length; q++) byId[order[q]].removeAttribute('id');
    function restoreIds() {
      for (var q = 0; q < order.length; q++) byId[order[q]].id = order[q];
    }
    if (document.readyState === 'complete') restoreIds();
    else window.addEventListener('load', function () { setTimeout(restoreIds, 0); });

    show(startId, !!location.hash);

    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      var id = a.getAttribute('href').slice(1);
      if (!byId[id]) return;
      e.preventDefault();
      if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
      show(id, true);
    });

    window.addEventListener('popstate', function () { show(fromHash(), true); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSteps);
  else initSteps();

})();
