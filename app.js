/* ============================================================
   황금 귤을 찾아라 — 게임 로직 (2026-09-30 개편)
   ------------------------------------------------------------
   미션 → mh머니 카드 → 디지털 쿠지 → 결과/상품 → 다음 미션.
   코인·미션·쿠지·단서·수령은 전부 서버(EV = ev-client.js)가 정하고 기록한다.
   이 파일은 "요청을 보내고, 서버가 준 값만 화면에 그린다".
   금액·수량·확률·정답을 여기서 계산하거나 판정하지 않는다.
   ============================================================ */
(function () {

  var EVENT = "gwasu";
  var D  = Store.loadContent();     // 콘텐츠 (관리자 수정분 우선)
  var P  = Store.prefs();           // 기기 설정: votes / seenSchedule / nextTargetId / missionPath
  var ST = null;                    // 서버 상태(EV.state) — 이 앱의 유일한 진실
  var CFG = {};                     // 서버 공개 설정(ST.cfg)
  var CUR = null;                   // 지금 풀고 있는 GPS 지점
  var wrongCount = 0;
  var A = window.ASSETS;
  var heroMode = null;              // "registered" / "revisit" / null
  var pendingClaims = {};           // 서버 응답을 못 받은 미션 코인 요청(다시 시도용)
  var REC_KEY = "ggg_rec_pending";  // 복구 코드를 저장했다고 확인하기 전까지만 보관(세션)

  /* ---------- 도우미 ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function lineText(key, vars) {
    var t = (A.LINES[key] && A.LINES[key].text) || "";
    return t.replace(/\{(\w+)\}/g, function (_, k) { return (vars && vars[k] != null) ? String(vars[k]) : ""; });
  }
  function setNpc(img, expr) {
    if (!img) return;
    var k = A.exprKey(expr);
    img.src = A.CHAR[k];
    img.style.transform = A.CHAR_FIX[k] || "";
  }
  function pointById(id) {
    var list = D.gpsPoints || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg; t.classList.add("on");
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("on"); }, 2600);
  }
  function setMsg(id, text) {
    var el = $(id); if (!el) return;
    el.textContent = text || "";
    el.hidden = !text;
  }
  function coinName() { return (CFG && CFG.coinName) || "mh머니"; }
  function applyCoinName() {
    var els = document.querySelectorAll(".coinname");
    for (var i = 0; i < els.length; i++) els[i].textContent = coinName();
  }

  /* 서버·네트워크 오류를 화면용으로 통일한다. 연결 자체가 안 된 경우(SDK/로그인)는 network */
  function errInfo(e) {
    e = e || {};
    if (!e.code || /^auth\//.test(e.code) || e.message === "sdk-load-failed") {
      return { reason: "network", retryable: true, details: {},
        message: "연결할 수 없어요. 인터넷 연결을 확인하고 다시 시도해 주세요." };
    }
    return e;
  }
  function errText(e) {
    e = errInfo(e);
    if (e.retryable && e.reason !== "network") return "연결이 불안정해요. 잠시 뒤 같은 버튼을 다시 눌러 주세요. (같은 요청은 중복 처리되지 않아요)";
    return e.message || "잠시 후 다시 시도해 주세요.";
  }

  function fmtTime(v) {
    if (v == null || v === "") return "";
    var ms = null;
    if (typeof v === "number") ms = v < 1e12 ? v * 1000 : v;
    else if (typeof v === "string") ms = Date.parse(v);
    else if (v._seconds != null) ms = v._seconds * 1000;
    else if (v.seconds != null) ms = v.seconds * 1000;
    else if (typeof v.toMillis === "function") ms = v.toMillis();
    if (ms == null || isNaN(ms)) return "";
    var d = new Date(ms);
    return ("0" + (d.getMonth() + 1)).slice(-2) + "." + ("0" + d.getDate()).slice(-2) + " " +
      ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }

  /* ---------- 배경음악 ----------
     오프닝(선술집풍)은 등록 화면에서, 바다소리는 등록을 마치고 항해가 시작되면 흐른다.
     iOS/크롬은 사용자 제스처 없이 오디오 재생을 막으므로, 화면 아무 곳이나 처음 터치할 때 잠금을 푼다. */
  var Sound = (function () {
    var KEY = "ggg_sound_on";
    var on = true;
    try { var saved = localStorage.getItem(KEY); if (saved !== null) on = saved === "1"; } catch (e) {}
    var opening = $("bgmOpening"), ocean = $("bgmOcean");
    var unlocked = false, pendingTrack = null;
    var fadeTimers = {};

    function fade(el, to, ms) {
      if (!el) return;
      clearInterval(fadeTimers[el.id]);
      var from = el.volume, start = Date.now();
      if (to > 0 && el.paused) { try { el.play().catch(function () {}); } catch (e) {} }
      fadeTimers[el.id] = setInterval(function () {
        var t = Math.min(1, (Date.now() - start) / ms);
        el.volume = from + (to - from) * t;
        if (t >= 1) {
          clearInterval(fadeTimers[el.id]);
          if (to === 0) el.pause();
        }
      }, 40);
    }

    function playTrack(which) {
      if (!on) { pendingTrack = which; return; }
      if (!unlocked) { pendingTrack = which; return; }
      pendingTrack = null;
      if (which === "opening") { fade(ocean, 0, 500); opening.volume = 0; fade(opening, 0.55, 900); }
      else if (which === "ocean") { fade(opening, 0, 700); ocean.volume = 0; fade(ocean, 0.35, 1200); }
      else if (which === "off") { fade(opening, 0, 500); fade(ocean, 0, 500); }
    }

    function unlock() {
      if (unlocked) return;
      unlocked = true;
      if (pendingTrack) playTrack(pendingTrack);
    }

    function setToggleUI() {
      var b = $("soundToggle");
      if (!b) return;
      b.textContent = on ? "🔊" : "🔇";
      b.setAttribute("aria-pressed", on ? "true" : "false");
    }

    function toggle() {
      on = !on;
      try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) {}
      setToggleUI();
      if (!on) { fade(opening, 0, 300); fade(ocean, 0, 300); }
      else { unlock(); playTrack(currentIntent); }
    }

    var currentIntent = "off"; // 마지막으로 요청된 트랙(음소거 해제 시 다시 튼다)
    function want(which) { currentIntent = which; playTrack(which); }

    function init() {
      setToggleUI();
      ["pointerdown", "touchend", "keydown"].forEach(function (ev) {
        document.addEventListener(ev, unlock, { once: true, passive: true });
      });
      var btn = $("soundToggle");
      if (btn) btn.addEventListener("click", toggle);
    }

    return { init: init, want: want };
  })();

  /* ---------- 오프닝 시네마 (등록 전, 항해 기록관 전신 등장) ----------
     introQuest.line을 타이핑 연출로 보여주고, 선택지를 고르면 그 path가
     missionPaths(§data.js)와 짝지어져 미션 안내 순서를 바꾼다.
     "건너뛰기"는 언제든 가능하고, path 없이 등록하면 기본 순서로 진행된다. */
  var Cinema = (function () {
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var pickedPath = null;
    var typing = null;
    var pager = null;
    var started = false;

    function splitPages(text) {
      return String(text || "").split(/\n\s*\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    }

    function typeInto(el, text, onDone) {
      if (typing) typing.skip();
      if (reduceMotion || !text) { el.textContent = text || ""; if (onDone) onDone(); return; }
      el.textContent = "";
      el.classList.add("typing");
      var i = 0;
      var handle = { timer: null };
      function step() {
        i++;
        el.textContent = text.slice(0, i);
        if (i >= text.length) { el.classList.remove("typing"); typing = null; if (onDone) onDone(); return; }
        handle.timer = setTimeout(step, 24);
      }
      handle.skip = function () {
        clearTimeout(handle.timer);
        el.textContent = text;
        el.classList.remove("typing");
        typing = null;
        if (onDone) onDone();
      };
      typing = handle;
      step();
    }

    function playPages(el, text, onAllDone) {
      var pages = splitPages(text);
      var idx = 0;
      function playCurrent() {
        el.classList.remove("more");
        typeInto(el, pages[idx], function () {
          idx++;
          if (idx < pages.length) el.classList.add("more");
          else { pager = null; if (onAllDone) onAllDone(); }
        });
      }
      if (!pages.length) { pager = null; if (onAllDone) onAllDone(); return; }
      pager = { tapAdvance: function () {
        if (typing) { typing.skip(); return; }
        if (idx < pages.length) playCurrent();
      } };
      playCurrent();
    }

    function showChoices(list) {
      var choicesEl = $("cineChoices");
      choicesEl.innerHTML = "";
      $("cineNext").style.display = "none";
      (list || []).forEach(function (c) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "btn ghost"; b.textContent = c.label;
        b.addEventListener("click", function () { pick(c); });
        choicesEl.appendChild(b);
      });
    }

    function pick(c) {
      pickedPath = c.path || null;
      $("cineChoices").innerHTML = "";
      var cap = $("cineCap");
      cap.classList.remove("react"); void cap.offsetWidth; cap.classList.add("react");
      playPages($("cineText"), c.next || "", function () { $("cineNext").style.display = "block"; });
    }

    function finish() {
      if (typing) typing.skip();
      pager = null;
      var el = $("cine");
      el.classList.add("hide");
      document.body.classList.remove("in-cine");
      document.body.appendChild($("soundToggle"));
      $("introForm").classList.add("show");
      setTimeout(function () { el.style.display = "none"; $("inNick").focus({ preventScroll: true }); }, 380);
    }

    function start() {
      if (started) return;
      started = true;
      var q = D.introQuest;
      if (!q || !q.line) { finish(); return; }
      document.body.classList.add("in-cine");
      $("cine").appendChild($("soundToggle"));
      $("cineWho").textContent = A.NPC_NAME;
      $("cineNext").textContent = A.LINES.firstVisit.btn;
      $("cineChoices").innerHTML = "";
      $("cineNext").style.display = "none";
      playPages($("cineText"), q.line, function () { showChoices(q.choices); });

      $("cine").addEventListener("click", function (e) {
        if (e.target.closest("#cineSkip, #cineNext, .cine-choices")) return;
        if (pager) pager.tapAdvance();
      });
      $("cineNext").addEventListener("click", finish);
      $("cineSkip").addEventListener("click", finish);
    }

    function getPath() { return pickedPath; }

    return { start: start, getPath: getPath };
  })();

  /* ---------- 퀘스트 대화 ---------- */
  var questReturnFocus = null;
  function questLine(text, opts) {
    opts = opts || {};
    $("questWho").textContent = opts.who || A.NPC_NAME;
    var av = $("questAvatar");
    var card = av.parentNode;
    if (opts.noAvatar) { av.removeAttribute("src"); card.classList.add("no-avatar"); }
    else { setNpc(av, opts.expr || opts.avatar || (D.settings && D.settings.questAvatar) || "neutral"); av.alt = A.NPC_NAME; card.classList.remove("no-avatar"); }
    $("questText").textContent = text;
    var choicesEl = $("questChoices");
    choicesEl.innerHTML = "";
    var okBtn = $("questOk");
    if (opts.choices && opts.choices.length) {
      okBtn.style.display = "none";
      opts.choices.forEach(function (c) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "btn ghost";
        b.textContent = c.label;
        b.addEventListener("click", function () { if (c.onPick) c.onPick(); else closeQuest(); });
        choicesEl.appendChild(b);
      });
    } else {
      okBtn.style.display = "";
      okBtn.textContent = opts.okLabel || "확인";
      okBtn.onclick = function () { closeQuest(); if (opts.onOk) opts.onOk(); };
    }
    var ov = $("questOverlay");
    if (!ov.classList.contains("on")) questReturnFocus = document.activeElement;
    ov.classList.add("on");
    setTimeout(function () {
      var f = (opts.choices && opts.choices.length) ? choicesEl.querySelector("button") : okBtn;
      if (f) f.focus({ preventScroll: true });
    }, 30);
  }
  function closeQuest() {
    $("questOverlay").classList.remove("on");
    if (questReturnFocus && questReturnFocus.focus && document.contains(questReturnFocus)) {
      try { questReturnFocus.focus({ preventScroll: true }); } catch (e) {}
    }
    questReturnFocus = null;
  }
  document.addEventListener("keydown", function (e) {
    var ov = $("questOverlay");
    if (!ov.classList.contains("on")) return;
    if (e.key === "Escape") {
      var ok = $("questOk");
      if (ok.style.display !== "none") { e.preventDefault(); ok.click(); }
    } else if (e.key === "Tab") {
      var f = Array.prototype.filter.call(ov.querySelectorAll("button"), function (b) { return b.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  function showQuestLine(text, avatar) {
    if (!text) return;
    questLine(text, { avatar: avatar });
  }

  /* ---------- 시간 ---------- */
  function timeToMin(t) {
    var p = t.split(":"); return (+p[0]) * 60 + (+p[1]);
  }
  function nowMin() {
    var d = new Date(); return d.getHours() * 60 + d.getMinutes();
  }

  function checkScheduleQuests() {
    var list = D.scheduleQuests || [];
    if (!list.length || !ST) return;
    var nm = nowMin(), changed = false, toShow = null, toShowAvatar = null;
    list.forEach(function (q) {
      if (P.seenSchedule.indexOf(q.id) >= 0) return;
      if (nm >= timeToMin(q.time)) {
        P.seenSchedule.push(q.id);
        changed = true;
        if (!toShow) { toShow = q.line; toShowAvatar = q.avatar; }
      }
    });
    if (changed) Store.savePrefs(P);
    if (toShow) showQuestLine(toShow, toShowAvatar);
  }

  /* ---------- 화면 전환 ---------- */
  var NAV_SCREENS = { scHome: 1, scMissions: 1, scMain: 1, scKuji: 1, scCards: 1 };
  var NAV_ORDER   = { scHome: 0, scMissions: 1, scMain: 1.5, scKuji: 2, scCards: 3 };
  var CODEBAR_SCREENS = { scHome: 1, scMissions: 1, scMain: 1, scKuji: 1, scCards: 1, scPass: 1 };
  var lastNavOrder = 0;
  function show(id) {
    var all = document.querySelectorAll(".screen");
    for (var i = 0; i < all.length; i++) all[i].classList.remove("on");
    var el = $(id);
    el.classList.add("on");
    window.scrollTo(0, 0);

    if (NAV_SCREENS[id]) {
      var order = NAV_ORDER[id];
      el.style.animation = (order >= lastNavOrder)
        ? "slideInRight .32s cubic-bezier(.22,.9,.3,1)"
        : "slideInLeft .32s cubic-bezier(.22,.9,.3,1)";
      lastNavOrder = order;
    } else {
      el.style.animation = "";
    }

    var nav = $("navbar");
    if (NAV_SCREENS[id]) {
      nav.style.display = "flex";
      var navId = (id === "scMain") ? "scMissions" : id;
      var btns = nav.querySelectorAll(".navbtn");
      for (var j = 0; j < btns.length; j++) {
        btns[j].classList.toggle("on", btns[j].dataset.nav === navId);
      }
    } else {
      nav.style.display = "none";
    }
    document.body.classList.toggle("has-nav", !!NAV_SCREENS[id]);
    $("codeBar").hidden = !(CODEBAR_SCREENS[id] && ST && ST.participant);
    document.body.classList.toggle("has-codebar", !$("codeBar").hidden);

    var snd = $("soundToggle");
    if (id === "scHome") $("homeSoundSlot").appendChild(snd);
    else if (snd.parentNode !== document.body && !(id === "scIntro" && $("cine").style.display !== "none")) document.body.appendChild(snd);
  }
  function moveTabIndicator(barId, indId, onId) {
    var bar = $(barId), ind = $(indId), on = $(onId);
    if (!bar || !ind || !on) return;
    var br = bar.getBoundingClientRect(), r = on.getBoundingClientRect();
    ind.style.width = r.width + "px";
    ind.style.transform = "translateX(" + (r.left - br.left - 4) + "px)";
  }
  function showTab(id) {
    show(id);
    var onMission = id === "scMissions";
    ["tabMission", "tabTreasure"].forEach(function (b) { $(b) && $(b).classList.toggle("on", b === "tabMission" ? onMission : !onMission); });
    ["tabMission2", "tabTreasure2"].forEach(function (b) { $(b) && $(b).classList.toggle("on", b === "tabMission2" ? onMission : !onMission); });
    requestAnimationFrame(function () {
      moveTabIndicator("tabbar1", "tabInd1", onMission ? "tabMission" : "tabTreasure");
      moveTabIndicator("tabbar2", "tabInd2", onMission ? "tabMission2" : "tabTreasure2");
    });
  }

  /* ---------- 서버 상태 ---------- */
  var refreshing = null;
  function refresh() {
    if (refreshing) return refreshing;
    refreshing = EV.state(EVENT).then(function (s) {
      refreshing = null;
      ST = s;
      CFG = s.cfg || {};
      applyCoinName();
      updateCodeBar();
      return s;
    }, function (e) { refreshing = null; throw errInfo(e); });
    return refreshing;
  }
  function updateCodeBar() {
    var p = ST && ST.participant;
    $("codeBarVal").textContent = p ? p.code : "------";
    $("codeBarNick").textContent = p ? p.nickname : "";
  }
  function passRequired() { return !!(CFG && CFG.passRequired); }
  function hasPass() { return !passRequired() || !!(ST && ST.pass && ST.pass.active); }
  function wallet() { return (ST && ST.wallet) || {}; }
  function coins() { return wallet().coins || 0; }
  function missionCount(id) { return ((ST && ST.missions && ST.missions[id]) || {}).count || 0; }
  function cfgMission(id) { return (CFG.missions && CFG.missions[id]) || null; }

  /* ---------- 지도(홈 화면 미리보기용) ---------- */
  function mapBase() {
    return D.settings.mapImage ? '<img src="' + D.settings.mapImage + '" alt="행사장 지도">' : "";
  }

  /* ---------- 보물찾기(단서) 상태 ---------- */
  function treasure() { return ST && ST.treasure ? ST.treasure : null; }
  function clueIds() {
    var c = (CFG.treasure && CFG.treasure.clues) || {};
    return Object.keys(c).sort();
  }
  function solvedMap() {
    var m = {}, T = treasure();
    if (T && T.clues) T.clues.forEach(function (id) { m[id] = 1; });
    return m;
  }
  function isSolved(p) { return !!solvedMap()[p.q]; }
  function clueText(clueId) {
    var c = CFG.treasure && CFG.treasure.clues && CFG.treasure.clues[clueId];
    if (c && c.text) return c.text;
    var q = D.quizzes && D.quizzes[clueId];
    return q ? q.qn : "(문제가 아직 등록되지 않았습니다)";
  }
  function clueNumber(clueId) {
    var ids = clueIds(), i = ids.indexOf(clueId);
    return i >= 0 ? i + 1 : "";
  }

  /* ---------- GPS 나침반 ----------
     아직 못 푼 지점 중 하나를 나침반이 가리킨다. 도착 인정 반경 안이면 그 지점의 문제가 뜬다.
     정답 판정은 서버가 한다. */
  var GEO = {
    watchId: null, tracking: false,
    pos: null,
    heading: null, hasHeading: false,
    arrivedId: null
  };

  function toRad(d) { return d * Math.PI / 180; }
  function toDeg(r) { return r * 180 / Math.PI; }
  function haversineDistance(lat1, lon1, lat2, lon2) {
    var R = 6371000;
    var dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function bearingTo(lat1, lon1, lat2, lon2) {
    var phi1 = toRad(lat1), phi2 = toRad(lat2), dLam = toRad(lon2 - lon1);
    var y = Math.sin(dLam) * Math.cos(phi2);
    var x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLam);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }
  function radiusFor(p) { return p.radius || D.settings.gpsRadius || 15; }

  function pickNewTarget() {
    var pts = (D.gpsPoints || []).filter(function (p) {
      return !isSolved(p) && p.lat != null && p.lng != null;
    });
    if (!pts.length) { P.nextTargetId = null; Store.savePrefs(P); return null; }
    var pick = pts[Math.floor(Math.random() * pts.length)];
    P.nextTargetId = pick.id;
    Store.savePrefs(P);
    return pick;
  }
  function nextTarget() {
    if (P.nextTargetId) {
      var cur = pointById(P.nextTargetId);
      if (cur && !isSolved(cur) && cur.lat != null && cur.lng != null) return cur;
    }
    return pickNewTarget();
  }

  function unsetPointCount() {
    return (D.gpsPoints || []).filter(function (p) { return !isSolved(p) && (p.lat == null || p.lng == null); }).length;
  }

  function onOrientation(e) {
    var heading = null;
    if (typeof e.webkitCompassHeading === "number") heading = e.webkitCompassHeading;
    else if (e.absolute === true && typeof e.alpha === "number") heading = (360 - e.alpha) % 360;
    else if (e.type === "deviceorientationabsolute" && typeof e.alpha === "number") heading = (360 - e.alpha) % 360;
    if (heading !== null && !isNaN(heading)) {
      GEO.heading = heading; GEO.hasHeading = true;
      updateCompass();
    }
  }

  function renderCompassGate() {
    var gate = $("compassGate"), wrap = $("compassWrap");
    if (!gate) return;
    var started = GEO.tracking;
    gate.style.display = started ? "none" : "";
    wrap.style.display = started ? "" : "none";
  }

  function startCompass() {
    if (GEO.tracking) return;
    if (!navigator.geolocation) {
      toast("이 기기는 위치 확인을 지원하지 않아요");
      return;
    }
    var beginWatch = function () {
      GEO.tracking = true; GEO.err = null;
      $("gateErr").hidden = true;
      renderCompassGate();
      GEO.watchId = navigator.geolocation.watchPosition(function (pos) {
        GEO.pos = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        GEO.err = null;
        updateCompass();
      }, function (err) {
        GEO.err = err && err.code;
        if (GEO.err === 1) {
          try { navigator.geolocation.clearWatch(GEO.watchId); } catch (e) {}
          GEO.watchId = null; GEO.tracking = false;
          $("gateErr").textContent = "위치 권한이 꺼져 있어요. 브라우저(또는 휴대폰) 설정에서 이 사이트의 위치 접근을 허용한 뒤 다시 눌러 주세요.";
          $("gateErr").hidden = false;
          renderCompassGate();
          return;
        }
        updateCompass();
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 });
      window.addEventListener("deviceorientationabsolute", onOrientation);
      window.addEventListener("deviceorientation", onOrientation);
      updateCompass();
    };
    var needsIOSPerm = typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function";
    if (needsIOSPerm) {
      DeviceOrientationEvent.requestPermission().then(beginWatch).catch(beginWatch);
    } else {
      beginWatch();
    }
  }

  function setTip(expr, text) {
    setNpc($("treasureTipImg"), expr);
    $("compassStatus").textContent = text;
  }

  function updateCompass() {
    if (!$("compassDist") || !treasure()) return;
    var target = nextTarget();
    var needle = $("compassNeedle"), dial = $("compassDial");

    if (!target) {
      $("compassDist").textContent = "—";
      dial.classList.add("nofix");
      var ids = clueIds(), sm = solvedMap();
      var doneAll = ids.length > 0 && ids.every(function (id) { return sm[id]; });
      var unset = unsetPointCount();
      if (doneAll) setTip("success", "단서를 전부 모았어! 보물 캡슐을 찾으면 코드를 입력해 봐.");
      else setTip("thinking", unset
        ? ("아직 위치가 설정되지 않은 단서가 " + unset + "개 있어. 스태프에게 문의해 줘.")
        : "지금 안내할 단서가 없어. 스태프에게 문의해 줘.");
      dial.classList.remove("arrived");
      return;
    }

    if (!GEO.pos) {
      $("compassDist").textContent = "—";
      dial.classList.add("nofix");
      if (GEO.err === 2) setTip("thinking", "위치를 찾지 못했어. 하늘이 트인 곳에서 잠시 기다려 줘.");
      else if (GEO.err === 3) setTip("thinking", "위치 확인이 늦어지고 있어. 잠시 뒤 다시 확인해 줘.");
      else setTip("thinking", lineText("locating"));
      return;
    }
    dial.classList.toggle("nofix", !GEO.hasHeading);

    var dist = haversineDistance(GEO.pos.lat, GEO.pos.lng, target.lat, target.lng);
    var brg = bearingTo(GEO.pos.lat, GEO.pos.lng, target.lat, target.lng);
    var r = radiusFor(target);

    $("compassDist").textContent = dist < 1000 ? (Math.round(dist) + "m") : ((dist / 1000).toFixed(2) + "km");

    if (GEO.hasHeading) {
      needle.style.transform = "rotate(" + ((brg - GEO.heading + 360) % 360) + "deg)";
    }

    if (dist <= r) {
      dial.classList.add("arrived");
      var onMain = $("scMain").classList.contains("on");
      if (onMain && GEO.arrivedId !== target.id && D.settings.gameOpen !== false) {
        GEO.arrivedId = target.id;
        openPointQuiz(target);
      }
      setTip("surprised", "도착했어! 잠시 후 퀴즈가 떠.");
    } else {
      dial.classList.remove("arrived");
      if (GEO.arrivedId === target.id) GEO.arrivedId = null;
      var accNote = (GEO.pos.accuracy && GEO.pos.accuracy > 30)
        ? (" (GPS 오차 약 ±" + Math.round(GEO.pos.accuracy) + "m)") : "";
      if (GEO.hasHeading) setTip("thinking", lineText("treasureGuide") + accNote);
      else setTip("thinking", "방향 센서를 찾지 못했어. 북쪽 기준 " + Math.round(brg) + "° 방향이야." + accNote);
    }
  }

  /* ---------- 미션 코인 요청 ---------- */
  var claimBusy = {};
  function claimMessage(r) {
    var n = r && r.awarded ? Number(r.awarded) : 0;
    if (n > 0) return "+" + n + " " + coinName() + "을(를) 받았어요";
    switch (r && r.reason) {
      case "reward-not-set": return "이 미션의 코인은 아직 정해지지 않았어요. 현장 공지를 확인해 주세요.";
      case "cooldown": return "잠시 뒤에 다시 도전할 수 있어요.";
      case "daily-cap": return "오늘 받을 수 있는 코인을 모두 받았어요.";
      case "already-rewarded": return "이미 코인을 받은 미션이에요.";
      default: return "이번에는 받은 코인이 없어요.";
    }
  }
  /* cb(err, result) — 실패하면 pendingClaims에 남겨 다시 시도할 수 있게 한다 */
  function bookCopy() { return JSON.parse(JSON.stringify((ST && ST.cardBook) || {})); }
  function claimMission(mid, cb, tier) {
    if (claimBusy[mid]) return;
    claimBusy[mid] = true;
    var before = bookCopy();
    EV.claimMission(EVENT, mid, tier).then(function (r) {
      claimBusy[mid] = false;
      delete pendingClaims[mid];
      if (ST && ST.wallet && r && r.coins != null) ST.wallet.coins = r.coins;
      var fresh = refresh().catch(function () {});
      var cards = r && r.cards;
      if (cards && cards.length && window.MH) MH.reveal(cards, { book: before, title: coinName() + " 카드를 받았어요!", onClose: function () { fresh.then(function () { cb(null, r); }); } });
      else fresh.then(function () { cb(null, r); });
    }, function (e) {
      claimBusy[mid] = false;
      e = errInfo(e);
      if (e.reason === "pass-required") { cb(e); return; }
      if (e.retryable) pendingClaims[mid] = true;
      cb(e);
    });
  }
  function claimFailText(e) {
    return errText(e) + (e && e.reason === "pass-required" ? "" : " 다시 시도할 수 있어요.");
  }

  /* ---------- 미션 ---------- */
  function orderedMissions() {
    var all = D.missions || [];
    var order = P.missionPath && D.missionPaths && D.missionPaths[P.missionPath];
    if (!order) return all;
    var byId = {}; all.forEach(function (m) { byId[m.id] = m; });
    var used = {}, out = [];
    order.forEach(function (id) { if (byId[id] && !used[id]) { out.push(byId[id]); used[id] = 1; } });
    all.forEach(function (m) { if (!used[m.id]) out.push(m); });
    return out;
  }
  function visibleMissions() {
    return orderedMissions().filter(function (m) {
      var c = cfgMission(m.id);
      return c && c.enabled !== false;
    });
  }
  function voteIdOf(m) { return m.auto && m.auto.indexOf("vote:") === 0 ? m.auto.slice(5) : null; }

  function renderMissions() {
    var list = visibleMissions();
    var done = list.filter(function (m) { return missionCount(m.id) > 0; }).length;
    $("mNow").textContent = done;
    $("mAll").textContent = list.length;
    $("mBar").style.transform = "scaleX(" + (list.length ? (done / list.length) : 0) + ")";
    setMsg("missionErr", "");

    var html = "";
    list.forEach(function (m) {
      var c = cfgMission(m.id) || {};
      var cnt = missionCount(m.id), ok = cnt > 0;
      var inApp = m.auto === "catch" || m.auto === "reaction";
      var vid = voteIdOf(m);
      var how = "", action = "";

      if (c.verify === "staff") {
        var again = m.id === "m11";
        how = ok ? (again ? "새 게시물을 올리면 또 받을 수 있어요" : "") : "스태프 확인 · 참가코드를 보여주세요";
        if ((!ok || again) && window.KB) action = '<button type="button" class="mgo" data-staffpin="' + m.id + '">스태프 확인 (PIN)</button>';
      } else if (inApp) {
        if (pendingClaims[m.id]) action = '<button type="button" class="mgo" data-retry="' + m.id + '">코인 받기 다시 시도</button>';
        else action = '<button type="button" class="mgo" data-mid="' + m.id + '">' + (ok ? "다시 도전" : "도전하기") + '</button>';
      } else if (vid) {
        var picked = P.votes[vid];
        if (ok) how = "";
        else if (picked) action = '<button type="button" class="mgo" data-votecoin="' + m.id + '">코인 받기</button>';
        else action = '<button type="button" class="mgo" data-votego="' + vid + '">투표하러 가기</button>';
      } else if (!ok) {
        how = "스태프 확인 · 참가코드를 보여주세요";
        if (window.KB) action = '<button type="button" class="mgo" data-staffpin="' + m.id + '">스태프 확인 (PIN)</button>';
      }
      var state = '<span class="mstate ' + (ok ? 'done">완료' : 'todo">시작 전') + '</span>' +
        (how ? '<span class="mhow">' + how + '</span>' : '');
      html += '<div class="mitem' + (ok ? ' done' : '') + '">' +
        '<div class="chk" aria-hidden="true">' + (ok ? '✓' : '') + '</div>' +
        '<div class="tx"><h4>' + esc(m.name) + '</h4><p>' + esc(m.desc) + '</p>' + state +
        (action ? '<br>' + action : '') + '</div></div>';
    });
    $("mlist").innerHTML = html || '<p class="maphint" style="margin:0">지금 열려 있는 미션이 없어요</p>';

    $("mlist").querySelectorAll(".mgo").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (btn.dataset.mid) {
          var mm = (D.missions || []).filter(function (x) { return x.id === btn.dataset.mid; })[0];
          if (mm && mm.auto === "catch") openCatch(mm.id);
          else openReaction(btn.dataset.mid);
        } else if (btn.dataset.retry) {
          btn.disabled = true;
          finishClaim(btn.dataset.retry, "");
        } else if (btn.dataset.votecoin) {
          btn.disabled = true;
          finishClaim(btn.dataset.votecoin, "");
        } else if (btn.dataset.votego) {
          openVote(btn.dataset.votego);
        } else if (btn.dataset.staffpin) {
          askStaffPin(btn.dataset.staffpin);
        }
      });
    });
  }

  /* 스태프가 참가자 폰에 PIN 을 눌러 확인 → 카드 지급 */
  function askStaffPin(mid) {
    var before = bookCopy();
    KB.askPin({
      title: "스태프 확인",
      desc: "스태프가 미션을 확인했다면 PIN 을 입력해 주세요. 카드가 바로 지급돼요.",
      submit: function (pin) { return EV.confirmMission(EVENT, mid, pin); },
      onDone: function (r) {
        var fresh = refresh().catch(function () {}).then(function () { renderMissions(); renderHud(); });
        var cards = (r && (r.cards || (r.play && r.play.cards))) || [];
        if (cards.length && window.MH) MH.reveal(cards, { book: before, title: coinName() + " 카드를 받았어요!", onClose: function () { fresh.then(function () { renderMissions(); renderHud(); }); } });
        else { toast("스태프 확인 완료"); }
      }
    });
  }

  /* 코인 요청 → 결과 안내 → 미션 목록. 실패하면 화면을 그대로 두고 다시 시도하게 한다. */
  function finishClaim(mid, prefix, tier) {
    claimMission(mid, function (e, r) {
      renderMissions(); renderHud();
      if (e) {
        if (e.reason === "pass-required") { showPassGate(); return; }
        setMsg("missionErr", claimFailText(e));
        showTab("scMissions");
        return;
      }
      showTab("scMissions");
      questLine((prefix || "") + claimMessage(r),
        { expr: r && r.awarded > 0 ? A.LINES.coinGot.expr : "neutral", okLabel: A.LINES.missionDone.btn });
    }, tier);
  }

  /* ---------- 황금귤 캐치 (앱 안 미션, catch.js) ---------- */
  function openCatch(mid) {
    if (!window.CatchGame) { toast("게임을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요"); return; }
    window.CatchGame.start(function (score, isBest) {
      var tier = score >= 7000 ? 3 : score >= 5000 ? 2 : score >= 3000 ? 1 : 0;
      var pre = score + "점" + (isBest ? ", 신기록! " : "! ");
      if (!tier) {
        showTab("scMissions");
        questLine(pre + "3,000점부터 코인을 받을 수 있어요. (3,000점 1개 · 5,000점 2개 · 7,000점 3개)", { expr: "neutral", okLabel: A.LINES.missionDone.btn });
        return;
      }
      finishClaim(mid, pre, tier);
    });
  }

  /* ---------- 반응속도게임 ---------- */
  var REACT_ROUNDS = 3, reactState = null;
  function openReaction(mid) {
    reactState = { mid: mid, round: 0, times: [], timer: null, armed: false, goAt: 0 };
    $("reactDoneBox").style.display = "none";
    setMsg("reactErr", "");
    startReactRound();
    show("scReaction");
  }
  function startReactRound() {
    var pad = $("reactPad"), txt = $("reactPadTxt");
    reactState.round++;
    $("reactRound").textContent = "라운드 " + reactState.round + " / " + REACT_ROUNDS;
    pad.className = "reactpad wait";
    txt.textContent = "기다리세요…";
    reactState.armed = false;
    clearTimeout(reactState.timer);
    var delay = 1200 + Math.random() * 2000;
    reactState.timer = setTimeout(function () {
      if (!reactState) return;
      reactState.armed = true;
      reactState.goAt = Date.now();
      pad.className = "reactpad go";
      txt.textContent = "지금 터치!";
    }, delay);
  }
  function tapReactPad() {
    if (!reactState) return;
    var pad = $("reactPad"), txt = $("reactPadTxt");
    if (!reactState.armed) {
      clearTimeout(reactState.timer);
      pad.className = "reactpad early";
      txt.textContent = "너무 빨랐어요! 다시…";
      setTimeout(function () { if (reactState) startReactRound(); }, 700);
      return;
    }
    var ms = Date.now() - reactState.goAt;
    reactState.times.push(ms);
    pad.className = "reactpad hit";
    txt.textContent = ms + "ms";
    if (reactState.round >= REACT_ROUNDS) setTimeout(finishReaction, 700);
    else setTimeout(startReactRound, 900);
  }
  function finishReaction() {
    if (!reactState) return;
    var avg = Math.round(reactState.times.reduce(function (a, b) { return a + b; }, 0) / reactState.times.length);
    $("reactPad").className = "reactpad done";
    $("reactPadTxt").textContent = "완료!";
    $("reactAvg").textContent = "평균 반응속도 " + avg + "ms";
    $("reactDoneBox").style.display = "block";
  }
  function claimReaction() {
    if (!reactState) return;
    var mid = reactState.mid, btn = $("btnReactFinish");
    btn.disabled = true; setMsg("reactErr", "");
    claimMission(mid, function (e, r) {
      btn.disabled = false;
      if (e) {
        if (e.reason === "pass-required") { showPassGate(); return; }
        setMsg("reactErr", claimFailText(e));
        return;
      }
      reactState = null;
      renderMissions(); renderHud();
      showTab("scMissions");
      questLine(claimMessage(r), { expr: r && r.awarded > 0 ? A.LINES.coinGot.expr : "neutral", okLabel: A.LINES.missionDone.btn });
    });
  }

  /* ---------- 실시간 투표 ----------
     투표 선택은 이 기기에만 남는다(서버 집계 없음). 서버가 하는 건 "투표 미션 코인"뿐. */
  function voteState(v) {
    var n = nowMin(), open = timeToMin(v.opensAt), close = timeToMin(v.closesAt);
    if (n < open) return { state: "before", mins: open - n };
    if (n < close) return { state: "open", mins: close - n };
    return { state: "closed", mins: 0 };
  }
  function renderVoteCards() {
    var html = "";
    Object.keys(D.votes || {}).forEach(function (id) {
      var v = D.votes[id], st = voteState(v), myPick = P.votes[id];
      var statusHtml;
      if (st.state === "before") {
        statusHtml = '<span class="votestate wait">시작까지 ' + st.mins + '분</span>';
      } else if (st.state === "open") {
        statusHtml = myPick
          ? '<span class="votestate done">투표 완료</span>'
          : '<span class="votestate live">투표 진행중 · 참여하기</span>';
      } else {
        statusHtml = '<span class="votestate end">투표 종료</span>';
      }
      html += '<div class="votecard" data-vote="' + id + '">' +
        '<div class="vc-top"><h4>' + esc(v.title) + '</h4>' + statusHtml + '</div>' +
        '<p class="vc-time">' + v.opensAt + ' ~ ' + v.closesAt + '</p></div>';
    });
    $("voteCards").innerHTML = html || '<p class="maphint" style="margin:0">예정된 투표가 없습니다</p>';
    $("voteCards").querySelectorAll("[data-vote]").forEach(function (el) {
      el.addEventListener("click", function () { openVote(el.dataset.vote); });
    });
  }
  function voteMissionOf(sessionId) {
    var list = D.missions || [];
    for (var i = 0; i < list.length; i++) if (list[i].auto === "vote:" + sessionId) return list[i];
    return null;
  }
  function openVote(id) {
    var v = (D.votes || {})[id];
    if (!v) return;
    var st = voteState(v), myPick = P.votes[id];
    $("voteTitle").textContent = v.title;
    $("voteWhen").textContent = v.opensAt + " ~ " + v.closesAt;
    setMsg("voteErr", "");

    var body = "";
    if (st.state === "before") {
      body = '<div class="votewait"><div class="votewait-num">' + st.mins + '</div><p>분 후 투표가 시작됩니다<br>조금만 기다려주세요!</p></div>';
    } else if (st.state === "closed") {
      body = '<p class="maphint" style="margin:0">투표가 종료되었습니다</p>';
    } else if (myPick) {
      var picked = (v.candidates || []).filter(function (c) { return c.id === myPick; })[0];
      body = '<div class="votedone">✅ <b>' + esc(picked ? picked.label : myPick) + '</b>을(를) 골랐어요<br>결과는 무대에서 발표됩니다</div>';
      var vm = voteMissionOf(id);
      if (vm && cfgMission(vm.id) && cfgMission(vm.id).enabled !== false && missionCount(vm.id) === 0) {
        body += '<button class="btn primary" id="btnVoteCoin" type="button" style="margin-top:12px">' + esc(coinName()) + ' 받기</button>';
      }
    } else if (!v.candidates || !v.candidates.length) {
      body = '<p class="maphint" style="margin:0">아직 후보가 등록되지 않았습니다. 잠시 후 다시 확인해주세요</p>';
    } else {
      body = '<div class="votelist">';
      v.candidates.forEach(function (c) {
        body += '<button class="voteopt" data-cand="' + c.id + '">' +
          (v.mode === "number" ? '<span class="vnum">' + esc(c.label) + '</span>' : '<span class="vname">' + esc(c.label) + '</span>') +
          '</button>';
      });
      body += '</div>';
    }
    $("voteBody").innerHTML = body;
    $("voteBody").querySelectorAll("[data-cand]").forEach(function (el) {
      el.addEventListener("click", function () { submitVote(id, el.dataset.cand); });
    });
    var vc = $("btnVoteCoin");
    if (vc) vc.addEventListener("click", function () { claimVoteCoin(id, vc); });
    show("scVote");
  }
  function claimVoteCoin(sessionId, btn) {
    var vm = voteMissionOf(sessionId);
    if (!vm) return;
    if (btn) btn.disabled = true;
    setMsg("voteErr", "");
    claimMission(vm.id, function (e, r) {
      if (btn) btn.disabled = false;
      if (e) {
        if (e.reason === "pass-required") { showPassGate(); return; }
        setMsg("voteErr", claimFailText(e));
        return;
      }
      openVote(sessionId);
      renderHud();
      questLine(claimMessage(r), { expr: r && r.awarded > 0 ? A.LINES.coinGot.expr : "neutral", okLabel: A.LINES.voteSaved.btn });
    });
  }
  function submitVote(sessionId, candId) {
    P.votes[sessionId] = candId;
    Store.savePrefs(P);
    var vm = voteMissionOf(sessionId);
    if (vm && cfgMission(vm.id) && cfgMission(vm.id).enabled !== false && missionCount(vm.id) === 0) {
      claimVoteCoin(sessionId, null);
    } else {
      openVote(sessionId);
    }
  }

  /* ---------- 홈 ---------- */
  function renderHud() {
    if (!$("hudName") || !ST) return;
    var list = visibleMissions();
    var mDone = list.filter(function (m) { return missionCount(m.id) > 0; }).length, mAll = list.length;
    $("hudName").textContent = ST.participant ? ST.participant.nickname : "나";
    $("qbTitle").textContent = D.settings.title || "황금 귤을 찾아라";

    $("mDoneNum").textContent = mDone;
    $("mAllNum").textContent = mAll;
    $("coinNum").textContent = coins();
    $("topCoins").textContent = coins();
    $("kjCoins").textContent = coins();
    var dots = "";
    if (mAll <= 16) for (var i = 0; i < mAll; i++) dots += '<i' + (i < mDone ? ' class="on"' : '') + '></i>';
    $("mDots").innerHTML = dots;

    var T = treasure();
    $("treasureSub").textContent = T ? ("단서 " + (T.clues || []).length + " / " + clueIds().length) : "곧 열려요";
    var left = mAll - mDone;
    $("missionSub").textContent = mAll === 0 ? "곧 열려요" : (left > 0 ? ("남은 미션 " + left + "개") : "미션을 모두 해 봤어요");
    $("kujiSub").textContent = coinName() + " " + coins() + "개 · 결과는 바로 나와요";
    applyCoinName();
    renderShortcuts();
  }

  function renderShortcuts() {
    var has = {
      secMap: !!(D.settings && D.settings.mapImage),
      secTime: !!(D.timetable && D.timetable.length),
      secVote: !!(D.votes && Object.keys(D.votes).length)
    };
    document.querySelectorAll("#shortcuts [data-jump]").forEach(function (b) { b.hidden = !has[b.dataset.jump]; });
    ["secMap", "secTime", "secVote"].forEach(function (id) { $(id).hidden = !has[id]; });
    $("voteCards").hidden = !has.secVote;
    $("timetable").hidden = !has.secTime;
  }

  function renderHome() {
    renderHud();
    checkScheduleQuests();

    var now = new Date(), nm = now.getHours() * 60 + now.getMinutes();
    var list = D.timetable || [], liveIdx = -1;
    for (var i = 0; i < list.length; i++) {
      var start = timeToMin(list[i].time);
      var end = (i + 1 < list.length) ? timeToMin(list[i + 1].time) : start + 1440;
      if (nm >= start && nm < end) liveIdx = i;
    }
    var th = "";
    for (var j = 0; j < list.length; j++) {
      th += '<div class="trow' + (j === liveIdx ? ' live' : '') + '">' +
        '<span class="time">' + list[j].time + '</span>' +
        '<span class="ttl">' + esc(list[j].title) + '</span>' +
        (j === liveIdx ? '<span class="livebadge">LIVE</span>' : '') + '</div>';
    }
    $("timetable").innerHTML = th;

    renderVoteCards();
    renderNextUp();
    $("homeMapBox").innerHTML = mapBase();
  }

  function renderNextUp() {
    if (!$("hero")) return;
    var list = visibleMissions(), next = null;
    for (var i = 0; i < list.length; i++) {
      var c = cfgMission(list[i].id) || {};
      if (missionCount(list[i].id) === 0 && c.verify !== "staff") { next = list[i]; break; }
    }
    var goNext = function () { heroMode = null; go("scMissions"); };
    var key = heroMode === "registered" ? "registered" : heroMode === "revisit" ? "revisit" : "missionGuide";
    var text = lineText(key, { nickname: ST && ST.participant ? ST.participant.nickname : "" });
    var btn = A.LINES[key].btn;
    if (key === "missionGuide") {
      text = next ? ("다음은 ‘" + next.name + "’ 어때? 코인을 모으면 쿠지에 도전할 수 있어.") : lineText("kujiOpen");
      btn = next ? A.LINES.missionGuide.btn : A.LINES.kujiOpen.btn;
      if (!next) goNext = function () { go("scKuji"); };
    }
    $("heroLine").textContent = text.trim();
    setNpc($("heroNpc"), A.LINES[key].expr);
    $("heroGo").textContent = btn;
    $("heroGo").onclick = goNext;
  }

  /* ---------- 보물찾기 화면 ---------- */
  function renderMain() {
    var T = treasure();
    $("treasureOff").hidden = !!T;
    $("treasureBody").hidden = !T;
    if (!T) return;

    var ids = clueIds(), sm = solvedMap();
    var got = (T.clues || []).length, all = ids.length;
    $("pgNow").textContent = got;
    $("pgAll").textContent = all;
    $("pgBar").style.transform = "scaleX(" + (all ? (got / all) : 0) + ")";
    $("pgNote").textContent = T.minClues != null
      ? ("보물 수령에 필요한 단서: " + T.minClues + "개")
      : "보물 수령에 필요한 단서 수는 현장 공지를 확인해 주세요.";

    var html = "";
    ids.forEach(function (id, i) {
      html += '<div class="chip' + (sm[id] ? '' : ' empty') + '">' + (sm[id] ? (i + 1) : "?") + '</div>';
    });
    $("pouch").innerHTML = html;

    /* 구역별 보물 현황 — 서버가 준 값만 그대로 */
    var zones = T.zones || {}, zcfg = (CFG.treasure && CFG.treasure.zones) || {}, zh = "";
    Object.keys(zones).forEach(function (z) {
      zh += '<div class="zrow"><span>' + esc((zcfg[z] && zcfg[z].name) || z) + '</span><b>' +
        Number(zones[z].found || 0) + ' / ' + Number(zones[z].total || 0) + '</b></div>';
    });
    $("zoneCard").hidden = !zh;
    $("zoneList").innerHTML = zh;

    /* 내 보물 수령 목록 */
    var ch = "";
    (T.claims || []).forEach(function (c, i) {
      ch += '<div class="claimrow"><div><b>' + esc(c.itemName || "보물") + '</b><small>' + statusLabel(c.status) +
        ' · ' + esc(c.pickupCode || "") + '</small></div>' +
        '<button type="button" class="mgo" data-claim="' + i + '">코드 보기</button></div>';
    });
    $("claimList").innerHTML = ch;
    $("claimList").querySelectorAll("[data-claim]").forEach(function (b) {
      b.addEventListener("click", function () {
        var c = (T.claims || [])[+b.dataset.claim];
        if (c) showPickup({ name: c.itemName || "보물", pickup: { code: c.pickupCode, status: c.status } }, "보물", "cards-treasure");
      });
    });

    renderCompassGate();
    updateCompass();
  }

  /* ---------- 문제(단서) ---------- */
  function openPointQuiz(p) {
    if (!p) { toast("알 수 없는 지점입니다"); showTab("scMain"); return; }
    if (D.settings.gameOpen === false) { toast("게임이 잠시 중단되었습니다"); showTab("scMain"); return; }
    if (isSolved(p)) {
      toast(lineText("clueAlready"));
      renderMain(); showTab("scMain"); return;
    }
    CUR = p; wrongCount = 0;
    $("qZone").textContent = p.flavor || "";
    $("qCode").textContent = "단서 " + clueNumber(p.q);
    $("qText").textContent = clueText(p.q);
    $("qInput").value = "";
    $("qWrong").textContent = "";
    $("btnAnswer").disabled = false;
    show("scQuiz");
    setTimeout(function () { $("qInput").focus(); }, 250);
  }

  var quizBusy = false;
  function submitQuiz() {
    if (!CUR || quizBusy) return;
    var v = $("qInput").value.trim();
    if (!v) return;
    var p = CUR;
    quizBusy = true; $("btnAnswer").disabled = true; $("qWrong").textContent = "";
    EV.submitClue(EVENT, p.q, v).then(function (r) {
      quizBusy = false; $("btnAnswer").disabled = false;
      if (r && r.ok) {
        return refresh().catch(function () {}).then(function () { grant(p, r); });
      }
      wrongCount++;
      var card = $("qCard");
      card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
      $("qWrong").textContent = wrongCount >= 3
        ? "잘 모르겠으면 근처 스태프에게 물어보세요"
        : "다시 한 번!";
      $("qInput").select();
    }, function (e) {
      quizBusy = false; $("btnAnswer").disabled = false;
      e = errInfo(e);
      if (e.reason === "pass-required") { showPassGate(); return; }
      $("qWrong").textContent = errText(e);
    });
  }

  /* ---------- 결과 화면 ---------- */
  function playTangerineReveal(text, onReveal) {
    var fruit = $("tgrFruit");
    fruit.className = "tgr-fruit";
    $("tgrText").textContent = text;
    setTimeout(function () { fruit.classList.add("crack"); }, 350);
    setTimeout(function () { fruit.classList.add("opening"); }, 530);
    setTimeout(function () { fruit.classList.add("paperup"); }, 850);
    setTimeout(function () { fruit.classList.add("unfurl"); if (onReveal) onReveal(); }, 1250);
    setTimeout(function () { fruit.classList.add("glow"); }, 1400);
  }
  function resultBase(o) {
    $("rsBurst").textContent = o.burst || "";
    if (o.big) { $("rsBig").style.display = ""; $("rsBig").textContent = o.big; $("rsBig").className = "big ev"; }
    else $("rsBig").style.display = "none";
    $("tgrBox").classList.toggle("show", !!o.tgr);
    $("rsTitle").textContent = o.title || "";
    $("rsDesc").textContent = o.desc || "";
    var pi = $("rsPrizeImg"); if (pi) { pi.hidden = true; pi.style.display = "none"; pi.removeAttribute("src"); }
    $("rsNpc").hidden = true;
    $("rsPickup").hidden = true;
  }

  function grant(p, r) {
    var T = treasure(), got = T && T.clues ? T.clues.length : (r && r.count) || 0, all = clueIds().length;
    var need = T && T.minClues != null ? T.minClues : null;
    var enough = need != null && got >= need;
    resultBase({ burst: "", tgr: true });
    show("scResult");
    playTangerineReveal(String(clueNumber(p.q)), function () {
      $("rsTitle").textContent = "단서 " + clueNumber(p.q) + " 획득!";
      $("rsDesc").textContent = "모은 단서 " + got + " / " + all;
      setNpc($("rsNpcImg"), A.LINES.clueFound.expr);
      $("rsNpcText").textContent = enough
        ? "필요한 단서를 모았어! 보물 캡슐을 찾으면 코드를 입력해 봐."
        : lineText("clueFound");
      $("rsNpc").hidden = false;
    });
    $("btnResultOk").textContent = "나침반으로 돌아가기";
    $("btnResultOk").dataset.go = "main";
  }

  /* ---------- 수령 코드 ---------- */
  function statusLabel(s) {
    return s === "given" ? "수령완료" : s === "void" ? "취소됨" : "수령대기";
  }
  function qrDataUrl(text) {
    try {
      var q = qrcode(0, "M"); q.addData(String(text)); q.make();
      return q.createDataURL(6, 2);
    } catch (e) { return ""; }
  }
  function fillPickup(name, pickup, kindLabel) {
    var code = String(pickup.code || "");
    $("rsKind").textContent = "PICKUP CODE";
    $("rsItem").textContent = name;
    $("rsWho").textContent = (ST && ST.participant ? ST.participant.nickname + " 해적 · 참가코드 " + ST.participant.code : "") +
      (kindLabel ? " · " + kindLabel : "");
    $("rsCode").textContent = code.length === 8 ? (code.slice(0, 4) + " " + code.slice(4)) : code;
    var src = code ? qrDataUrl(code) : "";
    $("rsQr").src = src;
    $("rsQr").parentNode.hidden = !src;
    $("rsPickup").classList.toggle("used", pickup.status === "given");
    $("rsStamp").textContent = pickup.status === "given" ? "수령 완료" : pickup.status === "void" ? "취소됨" : "";
    $("rsPickup").classList.toggle("void", pickup.status === "void");
    $("rsPickup").hidden = false;
  }
  /* play: { name, pickup:{code,status} } */
  function showPickup(play, kindLabel, back) {
    resultBase({ burst: "PICKUP", tgr: false, title: play.name || "", desc: "" });
    if (play.pickup && play.pickup.code) fillPickup(play.name || "", play.pickup, kindLabel);
    show("scResult");
    $("btnResultOk").textContent = "닫기";
    $("btnResultOk").dataset.go = back === "cards-treasure" ? "main" : "cards";
  }

  /* ---------- 디지털 쿠지 ---------- */
  var kujiBusy = false;
  function renderKuji() {
    var w = wallet(), K = CFG.kuji || {};
    $("kjCoins").textContent = coins();
    var cost = w.kujiCost != null ? w.kujiCost : K.cost;
    var open = K.enabled !== false;
    $("kjCost").textContent = !open ? "쿠지는 아직 열려 있지 않아요"
      : cost == null ? "1회에 필요한 코인은 현장 공지를 확인해 주세요"
      : ("1회 " + cost + "코인");
    $("btnPlayKuji").disabled = kujiBusy || !open || cost == null;
    var paid = w.paidPlays || 0;
    $("btnPlayPaid").hidden = !(paid > 0);
    $("btnPlayPaid").textContent = "유료 이용권으로 뽑기 (" + paid + "장)";
    $("btnPlayPaid").disabled = kujiBusy;
    $("kjPaidNote").hidden = !K.paidEnabled;
    $("btnKujiToMission").hidden = true;
    setMsg("kjErr", "");
    applyCoinName();
  }
  function kujiError(e) {
    e = errInfo(e);
    var d = e.details || {};
    switch (e.reason) {
      case "pass-required": showPassGate(); return;
      case "not-enough-coins":
        setMsg("kjErr", "코인이 부족해요." + (d.need != null && d.have != null ? " (필요 " + d.need + " · 보유 " + d.have + ")" : "") + " 코인은 차감되지 않았어요.");
        $("btnKujiToMission").hidden = false;
        return;
      case "sold-out":
        setMsg("kjErr", "준비된 상품이 모두 소진되었어요. 코인은 차감되지 않았어요.");
        return;
      default:
        setMsg("kjErr", errText(e));
    }
  }
  /* 번호 뽑기판 모드(cfg.kuji.pickNumber): 번호 선택 → 봉인지 연출 → 결과. 아니면 예전처럼 바로 뽑기 */
  function startKuji(source, cardIds) {
    if (kujiBusy) return;
    if (!(CFG.kuji && CFG.kuji.pickNumber && window.KB)) { doKuji(source, cardIds); return; }
    kujiBusy = true; setMsg("kjErr", "");
    $("btnPlayKuji").disabled = true; $("btnPlayPaid").disabled = true;
    var bookBefore = bookCopy();
    KB.open({
      title: "쿠지 번호를 골라 주세요",
      board: function () { return EV.kujiBoard(EVENT); },
      play: function (n) { return EV.playKuji(EVENT, source, n, cardIds); },
      onResult: function (r) {
        kujiBusy = false;
        kujiBookBefore = bookBefore;
        if (ST && ST.wallet && r.wallet) {
          ST.wallet.coins = r.wallet.coins; ST.wallet.paidPlays = r.wallet.paidPlays; ST.wallet.playCount = r.wallet.playCount;
        }
        refresh().catch(function () {}).then(function () { showKujiResult(r.play, r.duplicate, true); });
      },
      onError: function (e) { kujiBusy = false; renderKuji(); kujiError(e); },
      onCancel: function () { kujiBusy = false; renderKuji(); }
    });
  }
  function doKuji(source, cardIds) {
    if (kujiBusy) return;
    kujiBusy = true; setMsg("kjErr", "");
    $("btnPlayKuji").disabled = true; $("btnPlayPaid").disabled = true;
    var bookBefore = bookCopy();
    EV.playKuji(EVENT, source, null, cardIds).then(function (r) {
      kujiBusy = false;
      kujiBookBefore = bookBefore;
      if (ST && ST.wallet && r.wallet) {
        ST.wallet.coins = r.wallet.coins; ST.wallet.paidPlays = r.wallet.paidPlays; ST.wallet.playCount = r.wallet.playCount;
      }
      return refresh().catch(function () {}).then(function () { showKujiResult(r.play, r.duplicate); });
    }, function (e) {
      kujiBusy = false;
      renderKuji();
      kujiError(e);
    });
  }
  var kujiBookBefore = {};
  /* 번호판 모드는 봉인지 연출을 이미 봤으므로 귤 까기 연출은 건너뛴다(연출·카드 겹침 방지) */
  function revealStep(text, cb, skip) { if (skip) cb(); else playTangerineReveal(text, cb); }
  function showKujiResult(play, dup, skipTgr) {
    if (!play) { renderKuji(); return; }
    if (play.kind === "coin") { showCoinResult(play, dup, skipTgr); return; }
    var special = play.kind === "special";
    resultBase({ burst: "KUJI", tgr: !skipTgr });
    show("scResult");
    if (dup) toast("이미 처리된 결과예요. 다시 보여 드릴게요");
    revealStep(special ? "특별" : "카드", function () {
      $("rsTitle").textContent = special ? "특별 상품 당첨!" : "직접 만든 트럼프 카드!";
      $("rsDesc").textContent = play.name || "";
      var pim = $("rsPrizeImg"), pu = play.image;
      if (pim && special && typeof pu === "string" && /^(https?:\/\/|data:image\/(jpeg|png|webp);base64,)/.test(pu)) { pim.src = pu; pim.hidden = false; pim.style.display = "block"; }
      if (play.demo) {
        $("rsDesc").textContent = (play.name || "") + " — 맛보기 결과예요. 수령 코드는 없어요.";
      } else if (play.pickup && play.pickup.code) {
        fillPickup(play.name || "", play.pickup, special ? "특별 상품" : "카드");
      }
      setNpc($("rsNpcImg"), special ? "surprised" : "success");
      $("rsNpcText").textContent = play.demo ? "맛보기 결과야. 진짜 쿠지는 코인을 모아서 도전해 봐!"
        : "수령 코드를 스태프에게 보여주면 받을 수 있어. 코드는 ‘내 카드’에서 다시 볼 수 있어.";
      $("rsNpc").hidden = false;
    }, skipTgr);
    $("btnResultOk").textContent = "확인";
    $("btnResultOk").dataset.go = "kuji";
  }

  function showCoinResult(play, dup, skipTgr) {
    var n = play.coinReward || (play.cards && play.cards.length) || 1;
    resultBase({ burst: "KUJI", tgr: !skipTgr });
    show("scResult");
    if (dup) toast("이미 처리된 결과예요. 다시 보여 드릴게요");
    revealStep("카드", function () {
      $("rsTitle").textContent = "아쉽! 대신 " + coinName() + " " + n + "장";
      $("rsDesc").textContent = "다음 미션으로 카드를 더 모아 쿠지에 또 도전해요.";
      $("rsNpcText").textContent = "카드 3장이면 쿠지 한 번! 도감을 채워 보자.";
      setNpc($("rsNpcImg"), "success");
      $("rsNpc").hidden = false;
      if (play.cards && play.cards.length && window.MH) {
        setTimeout(function () { MH.reveal(play.cards, { book: kujiBookBefore, title: coinName() + " 카드를 받았어요!" }); }, skipTgr ? 300 : 1800);
      }
    }, skipTgr);
    $("btnResultOk").textContent = "확인";
    $("btnResultOk").dataset.go = "kuji";
  }

  /* ---------- 내 카드 ---------- */
  function renderCards() {
    setMsg("cardsErr", "");
    var plays = (ST && ST.plays) || [], book = (ST && ST.cardBook) || {};
    var nameOf = {};
    plays.forEach(function (p) { if (p.cardId && p.name && !nameOf[p.cardId]) nameOf[p.cardId] = p.name; });

    var bh = "";
    if (window.MH) MH.album($("cardBook"), book);
    Object.keys(book).forEach(function (id) {
      if (/^M\d+$/.test(id)) return;
      var b = book[id] || {};
      bh += '<div class="cbrow"><span class="cbname">' + esc(nameOf[id] || id) + '</span>' +
        '<span class="cbst">' +
        '<em class="st pending">수령대기 ' + (b.pending || 0) + '</em>' +
        '<em class="st given">수령완료 ' + (b.given || 0) + '</em></span></div>';
    });
    if (window.MH) { if (bh) $("cardBook").insertAdjacentHTML("beforeend", bh); }
    else $("cardBook").innerHTML = bh || '<p class="maphint" style="margin:0">아직 받은 카드가 없어요. 쿠지에 도전해 보세요!</p>';

    var specials = plays.filter(function (p) { return p.kind === "special" && p.status !== "void" && !p.demo; });
    var sh = "";
    specials.forEach(function (p) {
      var st = p.pickup ? p.pickup.status : "pending";
      sh += '<div class="cbrow"><span class="cbname">' + esc(p.name || "특별 상품") + '</span>' +
        '<span class="cbst"><em class="st ' + (st === "given" ? "given" : "pending") + '">' + statusLabel(st) + '</em></span></div>';
    });
    $("specialList").innerHTML = sh || '<p class="maphint" style="margin:0">아직 특별 상품은 없어요</p>';

    var sorted = plays.slice().sort(function (a, b) {
      var ta = Date.parse(fmtIso(a.createdAt)) || 0, tb = Date.parse(fmtIso(b.createdAt)) || 0;
      return tb - ta;
    });
    var ph = "";
    sorted.forEach(function (p, i) {
      var st = p.status === "void" ? "void" : (p.pickup ? p.pickup.status : "pending");
      ph += '<div class="playrow"><div class="pl-main"><b>' + esc(p.name || "결과") + '</b>' +
        '<small>' + esc(fmtTime(p.createdAt)) + (p.demo ? ' · 맛보기' : '') + '</small></div>' +
        (p.demo ? '' : '<div class="pl-side"><em class="st ' + (st === "given" ? "given" : st === "void" ? "void" : "pending") + '">' + statusLabel(st) + '</em>' +
          (p.pickup && p.pickup.code && st !== "void" ? '<button type="button" class="mgo" data-play="' + i + '">코드 보기</button>' : '') + '</div>') +
        '</div>';
    });
    $("playList").innerHTML = ph || '<p class="maphint" style="margin:0">쿠지 기록이 없어요</p>';
    $("playList").querySelectorAll("[data-play]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = sorted[+b.dataset.play];
        if (p) showPickup(p, p.kind === "special" ? "특별 상품" : "카드", "cards");
      });
    });
  }
  function fmtIso(v) {
    if (v == null) return "";
    if (typeof v === "number") return new Date(v < 1e12 ? v * 1000 : v).toISOString();
    if (typeof v === "string") return v;
    if (v._seconds != null) return new Date(v._seconds * 1000).toISOString();
    if (v.seconds != null) return new Date(v.seconds * 1000).toISOString();
    return "";
  }

  /* ---------- 보물 캡슐 코드 ---------- */
  var claimTBusy = false;
  function submitTreasureCode() {
    if (claimTBusy) return;
    var code = $("tcInput").value.trim();
    if (!code) { setMsg("tcMsg", "캡슐 안의 코드를 입력해 주세요."); return; }
    claimTBusy = true; $("btnClaimTreasure").disabled = true; setMsg("tcMsg", "");
    EV.claimTreasure(EVENT, code).then(function (r) {
      claimTBusy = false; $("btnClaimTreasure").disabled = false;
      if (r && r.ok && r.claim) {
        $("tcInput").value = "";
        return refresh().catch(function () {}).then(function () {
          renderMain();
          setNpc($("rsNpcImg"), "success");
          showPickup({ name: r.claim.itemName || "보물", pickup: { code: r.claim.pickupCode, status: r.claim.status } }, "보물", "cards-treasure");
          $("rsTitle").textContent = "보물을 찾았어요!";
          $("rsDesc").textContent = r.claim.itemName || "";
          $("rsNpcText").textContent = lineText("finalDone");
          $("rsNpc").hidden = false;
        });
      }
      var why = r && r.reason;
      setMsg("tcMsg", why === "already-found" ? "이미 다른 참가자가 찾은 보물이에요."
        : "코드가 맞지 않아요. 캡슐 안의 코드를 다시 확인해 주세요.");
    }, function (e) {
      claimTBusy = false; $("btnClaimTreasure").disabled = false;
      e = errInfo(e);
      if (e.reason === "pass-required") { showPassGate(); return; }
      setMsg("tcMsg", errText(e));
    });
  }

  /* ---------- 항해 패스 게이트 ---------- */
  function showPassGate() {
    $("passLine").textContent = lineText("needPass");
    $("passSub").textContent = "항해 패스 " + (D.settings.passPrice || "6,000원") + " · 부스 체험비는 따로 없어요";
    $("passDesk").textContent = D.settings.passDeskName || "매표소";
    $("passCode").textContent = ST && ST.participant ? ST.participant.code : "------";
    setMsg("passErr", "");
    show("scPass");
  }

  /* 화면 이동: 캐시로 먼저 그리고, 서버 상태를 다시 받아 오면 한 번 더 그린다 */
  var RENDER = { scHome: renderHome, scMissions: renderMissions, scMain: renderMain, scKuji: renderKuji, scCards: renderCards };
  function go(id) {
    if (!hasPass()) { showPassGate(); return; }
    var r = RENDER[id];
    r();
    if (id === "scMissions" || id === "scMain") showTab(id); else show(id);
    refresh().then(function () {
      if (!hasPass()) { showPassGate(); return; }
      if ($(id).classList.contains("on")) { if (id !== "scKuji" || !kujiBusy) r(); renderHud(); }
    }).catch(function () {});
  }
  function enterApp(msg) {
    updateCodeBar();
    if (!hasPass()) { showPassGate(); return; }
    renderHome(); show("scHome");
    if (msg) toast(msg);
  }

  /* ---------- 네트워크 배지 ---------- */
  function setNet() { $("netBadge").classList.toggle("show", !navigator.onLine); }
  window.addEventListener("online", setNet);
  window.addEventListener("offline", setNet);

  /* ---------- 시작 ---------- */
  function showIntro() {
    Sound.want("opening");
    show("scIntro");
    Cinema.start();
    if (window.EV && EV.readCfg) EV.readCfg(EVENT).then(function (c) { if (c) { CFG = c; applyCoinName(); } }).catch(function () {});
  }
  function bootFail(e) {
    e = errInfo(e);
    $("bootMsg").textContent = e.retryable ? (e.message || "연결할 수 없어요.") : (e.message || "지금은 열려 있지 않아요.");
    $("btnBootRetry").hidden = false;
    show("scBoot");
  }
  function pendingRecovery() {
    try { return JSON.parse(sessionStorage.getItem(REC_KEY) || "null"); } catch (e) { return null; }
  }
  function showCodeScreen(rec) {
    $("ccCode").textContent = rec.code || "------";
    $("btnCodeOk").disabled = false;
    show("scCode");
  }

  function boot() {
    A.preloadExpressions();
    $("introTitle").textContent = D.settings.title || "황금 귤을 찾아라";
    $("introSub").textContent = D.settings.subtitle || "";
    document.title = D.settings.title || "황금 귤을 찾아라";
    setNet();
    $("btnBootRetry").hidden = true;
    $("bootMsg").textContent = "항해일지를 불러오는 중…";
    show("scBoot");

    var params = new URLSearchParams(location.search);
    var legacyQr = params.get("m") || params.get("p");

    refresh().then(function () {
      var rec = pendingRecovery();
      if (rec) { showCodeScreen(rec); return; }
      heroMode = "revisit";
      Sound.want("ocean");
      enterApp();
      if (legacyQr) toast("미션 확인은 스태프에게 참가코드를 보여주세요");
    }, function (e) {
      if (e && e.reason === "not-registered") { showIntro(); return; }
      bootFail(e);
    });
  }
  Sound.init();

  setInterval(function () { if (ST && hasPass() && $("scHome").classList.contains("on")) checkScheduleQuests(); }, 60000);

  /* ---------- 이벤트 연결 ---------- */
  function fmtPhoneInput(e) {
    var v = e.target.value.replace(/[^0-9]/g, "").slice(0, 11);
    if (v.length > 7)      v = v.slice(0, 3) + "-" + v.slice(3, 7) + "-" + v.slice(7);
    else if (v.length > 3) v = v.slice(0, 3) + "-" + v.slice(3);
    e.target.value = v;
  }
  $("inPhone").addEventListener("input", fmtPhoneInput);
  $("inRecPhone").addEventListener("input", fmtPhoneInput);
  $("btnBootRetry").addEventListener("click", boot);

  $("btnShowRecover").addEventListener("click", function () {
    $("registerBox").hidden = true; $("recoverBox").hidden = false;
    if ($("inPhone").value && !$("inRecPhone").value) $("inRecPhone").value = $("inPhone").value;
    setMsg("recErr", "");
  });
  $("btnHideRecover").addEventListener("click", function () {
    $("recoverBox").hidden = true; $("registerBox").hidden = false;
  });

  $("btnJoin").addEventListener("click", function () {
    var nick  = $("inNick").value.trim();
    var phone = $("inPhone").value.trim();
    setMsg("joinErr", "");
    if (!nick)  { setMsg("joinErr", "닉네임을 입력해 주세요"); $("inNick").focus(); return; }
    if (Store.normPhone(phone).length < 10) { setMsg("joinErr", "전화번호를 정확히 입력해 주세요"); $("inPhone").focus(); return; }
    var btn = this;
    btn.disabled = true; btn.textContent = "기록하는 중…";
    EV.register(nick, phone).then(function (r) {
      btn.disabled = false; btn.textContent = "항해일지에 기록하기";
      if (Cinema.getPath()) { P.missionPath = Cinema.getPath(); Store.savePrefs(P); }
      heroMode = "registered";
      Sound.want("ocean");
      if (!r.existing) {
        var rec = { code: r.code };
        try { sessionStorage.setItem(REC_KEY, JSON.stringify(rec)); } catch (e) {}
        refresh().catch(function () {}).then(function () { showCodeScreen(rec); });
      } else {
        refresh().then(function () { enterApp("이미 등록된 참가자예요. 이어서 진행합니다"); }, function (e) { setMsg("joinErr", errText(e)); });
      }
    }, function (e) {
      btn.disabled = false; btn.textContent = "항해일지에 기록하기";
      e = errInfo(e);
      if (e.reason === "phone-registered") {
        $("registerBox").hidden = true; $("recoverBox").hidden = false;
        $("inRecPhone").value = phone;
        setMsg("recErr", "이미 등록된 번호예요. 아래 버튼을 눌러 이어서 진행하세요.");
        return;
      }
      setMsg("joinErr", errText(e));
    });
  });

  $("btnRecover").addEventListener("click", function () {
    var phone = $("inRecPhone").value.trim();
    setMsg("recErr", "");
    var rnick = $("inRecNick").value.trim();
    if (!rnick) { setMsg("recErr", "닉네임을 입력해 주세요"); return; }
    if (Store.normPhone(phone).length < 10) { setMsg("recErr", "전화번호를 정확히 입력해 주세요"); return; }
    var btn = this;
    btn.disabled = true; btn.textContent = "확인하는 중…";
    EV.recover(phone, rnick).then(function (r) {
      if (!r || !r.ok) {
        btn.disabled = false; btn.textContent = "이어서 하기";
        setMsg("recErr", (r && r.error) || "번호와 닉네임이 맞지 않아요. 다시 확인해 주세요.");
        return;
      }
      return refresh().then(function () {
        btn.disabled = false; btn.textContent = "이어서 하기";
        heroMode = "revisit"; Sound.want("ocean");
        enterApp("이어서 진행합니다");
      });
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = "이어서 하기";
      setMsg("recErr", errText(e));
    });
  });

  $("btnCodeOk").addEventListener("click", function () {
    var btn = this;
    btn.disabled = true;
    refresh().then(function () {
      try { sessionStorage.removeItem(REC_KEY); } catch (e) {}
      enterApp("항해를 시작합니다");
    }, function (e) {
      btn.disabled = false;
      toast(errText(e));
    });
  });

  $("btnPassAgain").addEventListener("click", function () {
    var btn = this;
    btn.disabled = true; btn.textContent = "확인하는 중…";
    setMsg("passErr", "");
    refresh().then(function () {
      btn.disabled = false; btn.textContent = "패스 등록했어요 (다시 확인)";
      if (hasPass()) enterApp("항해 패스가 확인됐어요");
      else setMsg("passErr", "아직 패스가 확인되지 않았어요. 스태프에게 참가코드를 보여주세요.");
    }, function (e) {
      btn.disabled = false; btn.textContent = "패스 등록했어요 (다시 확인)";
      setMsg("passErr", errText(e));
    });
  });

  /* ---------- 내비게이션 ---------- */
  $("goTreasure").addEventListener("click", function () { heroMode = null; go("scMain"); });
  $("goMissions").addEventListener("click", function () { heroMode = null; go("scMissions"); });
  $("statsStrip").addEventListener("click", function () { go("scMissions"); });
  $("goKuji").addEventListener("click", function () { go("scKuji"); });
  $("btnTopCoins").addEventListener("click", function () { go("scKuji"); });
  document.querySelectorAll("#shortcuts [data-jump]").forEach(function (b) {
    b.addEventListener("click", function () {
      var t = $(b.dataset.jump);
      if (t) t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });
  });
  $("tabMission").addEventListener("click", function () { go("scMissions"); });
  $("tabTreasure").addEventListener("click", function () { go("scMain"); });
  $("tabMission2").addEventListener("click", function () { go("scMissions"); });
  $("tabTreasure2").addEventListener("click", function () { go("scMain"); });

  document.querySelectorAll("#navbar .navbtn").forEach(function (b) {
    b.addEventListener("click", function () { go(b.dataset.nav); });
  });

  $("btnVoteBack").addEventListener("click", function () { go("scHome"); });

  $("btnAnswer").addEventListener("click", submitQuiz);
  $("qInput").addEventListener("keydown", function (e) { if (e.key === "Enter") submitQuiz(); });
  $("btnQuizBack").addEventListener("click", function () { go("scMain"); });

  $("btnResultOk").addEventListener("click", function () {
    var to = this.dataset.go;
    if (to === "kuji") go("scKuji");
    else if (to === "cards") go("scCards");
    else go("scMain");
  });

  $("btnPlayKuji").addEventListener("click", function () {
    var w = wallet(), K = CFG.kuji || {}, cost = w.kujiCost != null ? w.kujiCost : K.cost, bk = bookCopy(), have = 0;
    Object.keys(bk).forEach(function (k) { if (/^M\d+$/.test(k)) have += MH.held(bk, k); });
    if (window.MH && MH.pick && cost > 0 && cost <= 10 && have >= cost && !kujiBusy) MH.pick(bk, cost, { title: "쿠지에 넣을 카드 " + cost + "장을 골라 주세요", onDone: function (ids) { startKuji("coin", ids); } });
    else startKuji("coin");
  });
  $("btnPlayPaid").addEventListener("click", function () { startKuji("paid"); });
  $("btnKujiToMission").addEventListener("click", function () { go("scMissions"); });
  $("btnCardsRefresh").addEventListener("click", function () {
    var btn = this; btn.disabled = true;
    refresh().then(function () { btn.disabled = false; renderCards(); }, function (e) { btn.disabled = false; setMsg("cardsErr", errText(e)); });
  });

  $("btnClaimTreasure").addEventListener("click", submitTreasureCode);
  $("tcInput").addEventListener("keydown", function (e) { if (e.key === "Enter") submitTreasureCode(); });

  $("btnHowScan").addEventListener("click", function () {
    toast("나침반이 가리키는 방향으로 걸어가면, 도착했을 때 자동으로 문제가 뜹니다");
  });
  $("btnCompassStart") && $("btnCompassStart").addEventListener("click", startCompass);

  $("reactPad").addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapReactPad(); } });
  $("reactPad").addEventListener("click", tapReactPad);
  $("btnReactFinish").addEventListener("click", claimReaction);
  $("btnReactBack").addEventListener("click", function () {
    if (reactState) clearTimeout(reactState.timer);
    reactState = null;
    go("scMissions");
  });

  /* ---------- 오프라인 대응 ---------- */
  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  boot();
})();
