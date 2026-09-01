/* ============================================================
   황금 귤을 찾아라 — 게임 로직
   ============================================================ */
(function () {

  var D  = Store.loadContent();     // 콘텐츠 (관리자 수정분 우선)
  var S  = null;                    // 내 진행 상태
  var CUR = null;                   // 지금 풀고 있는 GPS 지점
  var wrongCount = 0;

  var LETTERS = [];                 // 최종 '질문'을 한 글자씩 쪼갠 배열 (모으면 질문이 완성된다)

  /* ---------- 도우미 ---------- */
  function $(id) { return document.getElementById(id); }
  function pointById(id) {
    var list = D.gpsPoints || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function norm(s) {
    return String(s || "")
      .replace(/\s+/g, "")
      .replace(/[^\p{L}\p{N}]/gu, "")
      .toLowerCase()
      .normalize("NFC");
  }
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg; t.classList.add("on");
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("on"); }, 2400);
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

  /* ---------- 오프닝 시네마 (등록 전, 귤선장 전신 등장) ----------
     introQuest.line을 타이핑 연출로 보여주고, 선택지를 고르면 그 path가
     missionPaths(§data.js)와 짝지어져 등록 직후 미션 안내 순서를 바꾼다.
     "건너뛰기"는 언제든 가능하고, path 없이 등록하면 기본 순서로 진행된다. */
  var Cinema = (function () {
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var pickedPath = null;
    var typing = null;
    var started = false;

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
      typeInto($("cineText"), c.next || "", function () { $("cineNext").style.display = ""; });
    }

    function finish() {
      if (typing) typing.skip();
      var el = $("cine");
      el.classList.add("hide");
      $("introForm").classList.add("show");
      setTimeout(function () { el.style.display = "none"; }, 550);
    }

    function start() {
      if (started) return;
      started = true;
      var q = D.introQuest;
      if (!q || !q.line) { finish(); return; }
      $("cineChoices").innerHTML = "";
      $("cineNext").style.display = "none";
      typeInto($("cineText"), q.line, function () { showChoices(q.choices); });

      $("cine").addEventListener("click", function (e) {
        if (e.target.closest("#cineSkip, #cineNext, .cine-choices")) return;
        if (typing) typing.skip();
      });
      $("cineNext").addEventListener("click", finish);
      $("cineSkip").addEventListener("click", finish);
    }

    function getPath() { return pickedPath; }

    return { start: start, getPath: getPath };
  })();

  /* ---------- 퀘스트 대화 ----------
     questLine(text, opts): opts.choices가 있으면 선택형(결과는 재미 요소일 뿐 진행에 영향 없음),
     없으면 확인 버튼으로 닫는 단문형. opts.onOk는 확인 버튼을 눌렀을 때 호출된다. */
  function questLine(text, opts) {
    opts = opts || {};
    $("questWho").textContent = opts.who || (D.settings && D.settings.questWho) || "귤선장";
    var av = $("questAvatar");
    var avatarSrc = opts.avatar || (D.settings && D.settings.questAvatar) || "";
    var card = av.parentNode.parentNode; /* .quest-card */
    if (avatarSrc) { av.src = avatarSrc; card.classList.remove("no-avatar"); }
    else { av.removeAttribute("src"); card.classList.add("no-avatar"); }
    $("questText").textContent = text;
    var choicesEl = $("questChoices");
    choicesEl.innerHTML = "";
    var okBtn = $("questOk");
    if (opts.choices && opts.choices.length) {
      okBtn.style.display = "none";
      opts.choices.forEach(function (c) {
        var b = document.createElement("button");
        b.className = "btn ghost";
        b.textContent = c.label;
        b.addEventListener("click", function () { if (c.onPick) c.onPick(); else closeQuest(); });
        choicesEl.appendChild(b);
      });
    } else {
      okBtn.style.display = "";
      okBtn.onclick = function () { closeQuest(); if (opts.onOk) opts.onOk(); };
    }
    $("questOverlay").classList.add("on");
  }
  function closeQuest() { $("questOverlay").classList.remove("on"); }

  /* 미션 완료·시간대 이벤트처럼 "확인만 누르면 되는" 짧은 대사용 헬퍼 */
  function showQuestLine(text, avatar) {
    if (!text) return;
    questLine(text, { avatar: avatar });
  }

  function checkScheduleQuests() {
    var list = D.scheduleQuests || [];
    if (!list.length) return;
    S.seenSchedule = S.seenSchedule || [];
    var nm = nowMin(), changed = false, toShow = null, toShowAvatar = null;
    list.forEach(function (q) {
      if (S.seenSchedule.indexOf(q.id) >= 0) return;
      if (nm >= timeToMin(q.time)) {
        S.seenSchedule.push(q.id);
        changed = true;
        if (!toShow) { toShow = q.line; toShowAvatar = q.avatar; } /* 한 번에 여러 개가 밀려있어도 한 개씩만 보여준다 */
      }
    });
    if (changed) Store.saveMe(S);
    if (toShow) showQuestLine(toShow, toShowAvatar);
  }
  var NAV_SCREENS = { scHome: 1, scMissions: 1, scMain: 1, scRewards: 1 };
  var NAV_ORDER   = { scHome: 0, scMissions: 1, scMain: 1.5, scRewards: 2 };
  var lastNavOrder = 0;
  function show(id) {
    var all = document.querySelectorAll(".screen");
    for (var i = 0; i < all.length; i++) all[i].classList.remove("on");
    var el = $(id);
    el.classList.add("on");
    window.scrollTo(0, 0);

    /* 홈 · 진행상황 · 보상 사이는 방향성 있는 슬라이드로 전환한다(뒤로/앞으로 느낌) */
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
      var navId = (id === "scMain") ? "scMissions" : id; // 보물찾기 탭도 '진행상황' 버튼 강조
      var btns = nav.querySelectorAll(".navbtn");
      for (var j = 0; j < btns.length; j++) {
        btns[j].classList.toggle("on", btns[j].dataset.nav === navId);
      }
    } else {
      nav.style.display = "none";
    }
  }
  function moveTabIndicator(barId, indId, onId) {
    var bar = $(barId), ind = $(indId), on = $(onId);
    if (!bar || !ind || !on) return;
    var br = bar.getBoundingClientRect(), r = on.getBoundingClientRect();
    ind.style.width = r.width + "px";
    ind.style.transform = "translateX(" + (r.left - br.left - 4) + "px)";
  }
  function showTab(id) {
    /* 미션/보물찾기 탭 전환 — 화면은 바뀌지만 진행상황 영역 안에 있다는 느낌을 준다 */
    show(id);
    var onMission = id === "scMissions";
    ["tabMission", "tabTreasure"].forEach(function (b) { $(b) && $(b).classList.toggle("on", b === "tabMission" ? onMission : !onMission); });
    ["tabMission2", "tabTreasure2"].forEach(function (b) { $(b) && $(b).classList.toggle("on", b === "tabMission2" ? onMission : !onMission); });
    requestAnimationFrame(function () {
      moveTabIndicator("tabbar1", "tabInd1", onMission ? "tabMission" : "tabTreasure");
      moveTabIndicator("tabbar2", "tabInd2", onMission ? "tabMission2" : "tabTreasure2");
    });
  }
  function hasLetter(li) {
    for (var i = 0; i < S.letters.length; i++) if (S.letters[i].li === li) return true;
    return false;
  }
  function uniqueLetterCount() {
    var seen = {};
    for (var i = 0; i < S.letters.length; i++) seen[S.letters[i].li] = 1;
    return Object.keys(seen).length;
  }

  /* ---------- 지도(홈 화면 미리보기용 — 행사장 사진만 보여준다) ---------- */
  function mapBase() {
    return D.settings.mapImage ? '<img src="' + D.settings.mapImage + '" alt="행사장 지도">' : "";
  }

  /* ---------- GPS 나침반 ----------
     지도 X마커 대신, 아직 못 찾은 지점 중 가장 가까운 곳을 나침반이 가리킨다.
     도착 인정 반경 안에 들어오면 자동으로 그 지점의 퀴즈가 뜬다. */
  var GEO = {
    watchId: null, tracking: false,
    pos: null,            // { lat, lng, accuracy }
    heading: null, hasHeading: false,
    arrivedId: null        // 마지막으로 자동 트리거된 지점(중복 팝업 방지)
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

  /* 아직 못 찾았고 좌표가 설정된 지점 중 하나를 무작위로 골라 계속 가리킨다.
     한 번 고른 지점(S.nextTargetId)은 참가자별로 고정되고, 그 지점을 찾으면
     (또는 관리자가 수동 지급해서 이미 찾은 상태가 되면) 다음 호출에서 새로 무작위 배정한다. */
  function pickNewTarget() {
    var pts = (D.gpsPoints || []).filter(function (p) {
      return !hasLetter(p.li) && p.lat != null && p.lng != null;
    });
    if (!pts.length) { S.nextTargetId = null; return null; }
    var pick = pts[Math.floor(Math.random() * pts.length)];
    S.nextTargetId = pick.id;
    Store.saveMe(S);
    return pick;
  }
  function nextTarget() {
    if (S.nextTargetId) {
      var cur = pointById(S.nextTargetId);
      if (cur && !hasLetter(cur.li) && cur.lat != null && cur.lng != null) return cur;
    }
    return pickNewTarget();
  }

  function unsetPointCount() {
    return (D.gpsPoints || []).filter(function (p) { return p.lat == null || p.lng == null; }).length;
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
      GEO.tracking = true;
      renderCompassGate();
      GEO.watchId = navigator.geolocation.watchPosition(function (pos) {
        GEO.pos = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        updateCompass();
      }, function (err) {
        $("compassStatus") && ($("compassStatus").textContent = "위치 확인 오류: " + err.message);
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

  function updateCompass() {
    if (!$("compassDist")) return;
    var target = nextTarget();
    var needle = $("compassNeedle"), dial = $("compassDial");

    if (!target) {
      $("compassDist").textContent = "—";
      var doneAll = uniqueLetterCount() >= LETTERS.length && LETTERS.length > 0;
      var unset = unsetPointCount();
      $("compassStatus").textContent = doneAll
        ? "글자를 전부 모았습니다!"
        : (unset ? ("아직 위치가 설정되지 않은 단서가 " + unset + "개 있습니다. 스태프에게 문의하세요")
                 : "안내할 단서가 없습니다. 스태프에게 문의하세요");
      dial.classList.remove("arrived");
      return;
    }

    if (!GEO.pos) {
      $("compassDist").textContent = "—";
      $("compassStatus").textContent = "위치 확인 중…";
      return;
    }

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
      $("compassStatus").textContent = "도착! 잠시 후 퀴즈가 뜹니다";
    } else {
      dial.classList.remove("arrived");
      if (GEO.arrivedId === target.id) GEO.arrivedId = null;
      var accNote = (GEO.pos.accuracy && GEO.pos.accuracy > 30)
        ? (" · GPS 오차 약 ±" + Math.round(GEO.pos.accuracy) + "m") : "";
      $("compassStatus").textContent = GEO.hasHeading
        ? ("나침반을 따라가세요" + accNote)
        : ("방향 센서를 찾지 못했어요. 목표까지 방위 " + Math.round(brg) + "°" + accNote);
    }
  }

  /* ---------- 홈(허브) ---------- */
  function timeToMin(t) {
    var p = t.split(":"); return (+p[0]) * 60 + (+p[1]);
  }
  function nowMin() {
    var d = new Date(); return d.getHours() * 60 + d.getMinutes();
  }

  /* 자동 완료 미션(auto 필드) — 보물찾기 클리어/투표 참여 등 앱이 스스로 아는 상태만 자동 체크한다 */
  function syncAutoMissions() {
    var list = D.missions || [], changed = false;
    S.missionsDone = S.missionsDone || [];
    S.votes = S.votes || {};
    list.forEach(function (m) {
      if (!m.auto) return;
      var already = S.missionsDone.indexOf(m.id) >= 0;
      var earned = (m.auto === "treasureClear") ? !!S.cleared
        : (m.auto.indexOf("vote:") === 0) ? !!S.votes[m.auto.slice(5)]
        : false;
      if (earned && !already) { S.missionsDone.push(m.id); changed = true; if (m.line) showQuestLine(m.line, m.avatar); }
    });
    if (changed) Store.saveMe(S);
  }

  function ticketsEarned(doneCount) {
    var tiers = D.ticketTiers || [], best = 0;
    tiers.forEach(function (t) { if (doneCount >= t.need && t.tickets > best) best = t.tickets; });
    return best;
  }

  /* ---------- 실시간 투표 ---------- */
  function voteState(v) {
    var n = nowMin(), open = timeToMin(v.opensAt), close = timeToMin(v.closesAt);
    if (n < open) return { state: "before", mins: open - n };
    if (n < close) return { state: "open", mins: close - n };
    return { state: "closed", mins: 0 };
  }
  function renderVoteCards() {
    var html = "";
    Object.keys(D.votes || {}).forEach(function (id) {
      var v = D.votes[id], st = voteState(v), myPick = (S.votes || {})[id];
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
        '<div class="vc-top"><h4>' + v.title + '</h4>' + statusHtml + '</div>' +
        '<p class="vc-time">' + v.opensAt + ' ~ ' + v.closesAt + '</p></div>';
    });
    $("voteCards").innerHTML = html || '<p class="maphint" style="margin:0">예정된 투표가 없습니다</p>';
    $("voteCards").querySelectorAll("[data-vote]").forEach(function (el) {
      el.addEventListener("click", function () { openVote(el.dataset.vote); });
    });
  }
  function openVote(id) {
    var v = (D.votes || {})[id];
    if (!v) return;
    var st = voteState(v), myPick = (S.votes || {})[id];
    $("voteTitle").textContent = v.title;
    $("voteWhen").textContent = v.opensAt + " ~ " + v.closesAt;

    var body = "";
    if (st.state === "before") {
      body = '<div class="votewait"><div class="votewait-num">' + st.mins + '</div><p>분 후 투표가 시작됩니다<br>조금만 기다려주세요!</p></div>';
    } else if (st.state === "closed") {
      body = '<p class="maphint" style="margin:0">투표가 종료되었습니다</p>';
    } else if (myPick) {
      var picked = (v.candidates || []).filter(function (c) { return c.id === myPick; })[0];
      body = '<div class="votedone">✅ <b>' + (picked ? picked.label : myPick) + '</b>에 투표했습니다<br>결과는 무대에서 발표됩니다</div>';
    } else if (!v.candidates || !v.candidates.length) {
      body = '<p class="maphint" style="margin:0">아직 후보가 등록되지 않았습니다. 잠시 후 다시 확인해주세요</p>';
    } else {
      body = '<div class="votelist">';
      v.candidates.forEach(function (c) {
        body += '<button class="voteopt" data-cand="' + c.id + '">' +
          (v.mode === "number" ? '<span class="vnum">' + c.label + '</span>' : '<span class="vname">' + c.label + '</span>') +
          '</button>';
      });
      body += '</div>';
    }
    $("voteBody").innerHTML = body;
    $("voteBody").querySelectorAll("[data-cand]").forEach(function (el) {
      el.addEventListener("click", function () { submitVote(id, el.dataset.cand); });
    });
    show("scVote");
  }
  function submitVote(sessionId, candId) {
    S.votes = S.votes || {};
    S.votes[sessionId] = candId;
    syncAutoMissions();
    Store.saveMe(S);
    toast("투표했습니다!");
    openVote(sessionId);
  }
  /* 해적 HUD + 현재 퀘스트 배너 — 홈을 게임 화면처럼 만든다 */
  function renderHud() {
    if (!$("hudName")) return;
    syncAutoMissions();
    var got = uniqueLetterCount(), all = LETTERS.length;
    var mDone = (S.missionsDone || []).length, mAll = (D.missions || []).length;

    $("hudName").textContent = S.nickname || "이름 없는 해적";
    $("hudMeta").textContent = "미션 " + mDone + " / " + mAll
      + " · 응모티켓 " + ticketsEarned(mDone) + "장";

    $("qbTitle").textContent = D.settings.title || "황금 귤을 찾아라";
    $("qbSub").textContent = S.cleared
      ? "보물을 손에 넣었다! 보상을 받아가라"
      : "나침반을 따라가 단서를 모아라";
    var pct = all ? got / all : 0;
    $("qbBar").style.transform = "scaleX(" + pct + ")";
    $("qbFoot").textContent = "단서 " + got + " / " + all;
    $("qbPct").textContent = Math.round(pct * 100) + "%";
  }

  function renderHome() {
    if ($("homeTitle")) $("homeTitle").textContent = D.settings.title || "황금 귤을 찾아라";
    if ($("homeSub")) $("homeSub").textContent = D.settings.subtitle || "";
    renderHud();
    checkScheduleQuests();

    var now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    var list = D.timetable || [], liveIdx = -1;
    for (var i = 0; i < list.length; i++) {
      var start = timeToMin(list[i].time);
      var end = (i + 1 < list.length) ? timeToMin(list[i + 1].time) : start + 1440;
      if (nowMin >= start && nowMin < end) liveIdx = i;
    }
    var th = "";
    for (var j = 0; j < list.length; j++) {
      th += '<div class="trow' + (j === liveIdx ? ' live' : '') + '">' +
        '<span class="time">' + list[j].time + '</span>' +
        '<span class="ttl">' + list[j].title + '</span>' +
        (j === liveIdx ? '<span class="livebadge">LIVE</span>' : '') + '</div>';
    }
    $("timetable").innerHTML = th;

    renderVoteCards();

    var eh = "";
    (D.experiences || []).forEach(function (e, i) {
      var ic = /^data:image\//.test(e.icon) || /\.(png|jpg|jpeg|webp|svg)$/i.test(e.icon)
        ? '<img class="ic" src="' + e.icon + '" alt="">'
        : '<span class="ic">' + e.icon + '</span>';
      var isTab = e.link && e.link.indexOf("tab:") === 0;
      var goLabel = isTab ? "바로 가기 →" : "자세히 보기 →";
      /* tab: 내부 이동은 버튼(JS로 화면 전환), 외부 링크는 진짜 <a href>로 렌더링한다.
         아티팩트 샌드박스는 window.open() 팝업은 막지만 <a target="_blank"> 클릭은 프레임이 가로채서 새 탭으로 잘 열어준다. */
      var goEl = "";
      if (e.link) {
        if (isTab) {
          goEl = '<button type="button" class="expcard-go" data-link="' + e.link + '">' + goLabel + '</button>';
        } else {
          goEl = '<a class="expcard-go" href="' + e.link + '" target="_blank" rel="noopener">' + goLabel + '</a>';
        }
      }
      eh += '<div class="expcard" data-idx="' + i + '">' +
        ic + '<h4>' + e.title + '</h4><p>' + e.desc + '</p>' + goEl +
      '</div>';
    });
    $("expgrid").innerHTML = eh;
    $("expgrid").querySelectorAll("button.expcard-go").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var target = btn.dataset.link.slice(4);
        if (target === "scMissions") { renderMissions(); showTab("scMissions"); }
        else if (target === "scMain") { renderMain(); showTab("scMain"); }
      });
    });

    $("homeMapBox").innerHTML = mapBase();
  }

  /* ---------- 미션 ---------- */
  /* 등록 시 고른 대화 경로(S.missionPath)에 맞춰 미션 안내 순서를 바꾼다.
     경로에 없는 미션은 원래 순서 그대로 뒤에 붙는다 — 종류·개수는 항상 동일하다. */
  function orderedMissions() {
    var all = D.missions || [];
    var order = S && S.missionPath && D.missionPaths && D.missionPaths[S.missionPath];
    if (!order) return all;
    var byId = {}; all.forEach(function (m) { byId[m.id] = m; });
    var used = {}, out = [];
    order.forEach(function (id) { if (byId[id] && !used[id]) { out.push(byId[id]); used[id] = 1; } });
    all.forEach(function (m) { if (!used[m.id]) out.push(m); });
    return out;
  }

  function renderMissions() {
    syncAutoMissions();
    var list = orderedMissions();
    var done = S.missionsDone || [];
    $("mNow").textContent = done.length;
    $("mAll").textContent = list.length;
    $("mBar").style.transform = "scaleX(" + (list.length ? (done.length / list.length) : 0) + ")";

    var html = "";
    list.forEach(function (m) {
      var ok = done.indexOf(m.id) >= 0;
      var action = (!ok && m.auto === "reaction")
        ? '<button type="button" class="mgo" data-mid="' + m.id + '">도전하기 →</button>'
        : "";
      html += '<div class="mitem' + (ok ? ' done' : '') + '">' +
        '<div class="chk">' + (ok ? '✓' : '') + '</div>' +
        '<div class="tx"><h4>' + m.name + '</h4><p>' + m.desc + '</p>' + action + '</div></div>';
    });
    $("mlist").innerHTML = html;
    $("mlist").querySelectorAll(".mgo").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        openReaction(btn.dataset.mid);
      });
    });
  }

  /* ---------- 반응속도게임 (모바일 자동판정 미션) ---------- */
  var REACT_ROUNDS = 3, reactState = null;
  function openReaction(mid) {
    reactState = { mid: mid, round: 0, times: [], timer: null, armed: false, goAt: 0 };
    $("reactDoneBox").style.display = "none";
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
    var avg = Math.round(reactState.times.reduce(function (a, b) { return a + b; }, 0) / reactState.times.length);
    $("reactPad").className = "reactpad done";
    $("reactPadTxt").textContent = "완료!";
    $("reactAvg").textContent = "평균 반응속도 " + avg + "ms";
    $("reactDoneBox").style.display = "block";
  }
  function claimReaction() {
    if (!reactState) return;
    S.missionsDone = S.missionsDone || [];
    var isNew = S.missionsDone.indexOf(reactState.mid) < 0;
    if (isNew) S.missionsDone.push(reactState.mid);
    Store.saveMe(S);
    var mid = reactState.mid;
    reactState = null;
    toast("반응속도게임 완료!");
    renderMissions();
    showTab("scMissions");
    if (isNew) {
      var m = (D.missions || []).filter(function (x) { return x.id === mid; })[0];
      if (m && m.line) showQuestLine(m.line, m.avatar);
    }
  }

  /* ---------- 관리자(숨김 진입) ----------
     이 기기(브라우저)에 저장된 데이터만 다룬다. 백엔드가 없으므로
     여기서 등록한 투표 후보는 이 화면을 연 기기에만 저장되고,
     다른 참가자 폰에는 자동으로 전달되지 않는다(§ 운영 문서 참고). */
  function saveVotesEdit() {
    Store.saveContent({ settings: D.settings, quizzes: D.quizzes, votes: D.votes });
  }
  function renderAdmin() {
    var vh = "";
    Object.keys(D.votes || {}).forEach(function (vid) {
      var v = D.votes[vid];
      vh += '<div class="rewardcard"><h4 style="margin:0 0 10px;color:var(--gold-l)">' + v.title + '</h4>';
      (v.candidates || []).forEach(function (c) {
        vh += '<div style="display:flex;justify-content:space-between;align-items:center;margin:5px 0;font-size:13.5px">' +
          '<span>' + c.label + '</span>' +
          '<button type="button" class="btn ghost" style="padding:4px 10px;font-size:11.5px" data-rmcand="' + vid + '|' + c.id + '">삭제</button></div>';
      });
      vh += '<div style="display:flex;gap:8px;margin-top:10px">' +
        '<input type="text" id="admInput_' + vid + '" placeholder="' + (v.mode === "number" ? "번호" : "닉네임") + '" ' +
        'style="flex:1;min-width:0;padding:9px;border-radius:9px;border:1px solid var(--panel-line);background:#0c2233;color:#fff">' +
        '<button type="button" class="btn gold" style="padding:9px 16px" data-addcand="' + vid + '">추가</button></div></div>';
    });
    $("adminVotes").innerHTML = vh;
    $("adminVotes").querySelectorAll("[data-addcand]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var vid = btn.dataset.addcand, input = $("admInput_" + vid);
        var val = input.value.trim();
        if (!val) return;
        var v = D.votes[vid];
        v.candidates = v.candidates || [];
        v.candidates.push({ id: "c" + Date.now().toString(36), label: val });
        saveVotesEdit();
        renderAdmin();
      });
    });
    $("adminVotes").querySelectorAll("[data-rmcand]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var parts = btn.dataset.rmcand.split("|"), vid = parts[0], cid = parts[1];
        D.votes[vid].candidates = (D.votes[vid].candidates || []).filter(function (c) { return c.id !== cid; });
        saveVotesEdit();
        renderAdmin();
      });
    });

    var players = Store.players(), ph = "";
    players.forEach(function (p) {
      var mDone = (p.missionsDone || []).length;
      ph += '<div class="mitem"><div class="tx"><h4>' + (p.nickname || "이름없음") + '</h4>' +
        '<p>' + (p.phone || "") + ' · 미션 ' + mDone + '개 · ' + (p.cleared ? "보물찾기 완료" : "진행중") + '</p></div></div>';
    });
    $("adminPlayers").innerHTML = ph || '<p class="maphint" style="margin:0">이 기기에서 등록된 참가자가 없습니다</p>';
  }

  /* ---------- 내 보상 ---------- */
  function renderRewards() {
    syncAutoMissions();
    var mAll = (D.missions || []).length, mDone = (S.missionsDone || []).length;
    var tiers = D.ticketTiers || [];
    var tickets = ticketsEarned(mDone);
    $("rwMissionBar").style.transform = "scaleX(" + (mAll ? (mDone / mAll) : 0) + ")";

    var nextTier = tiers.filter(function (t) { return mDone < t.need; })[0];
    var statusTxt = "미션 " + mDone + " / " + mAll + " 완료";
    if (tickets > 0) statusTxt += " — 응모티켓 " + tickets + "장 획득! 스태프에게 요청하세요";
    else if (nextTier) statusTxt += " — " + (nextTier.need - mDone) + "개 더 하면 응모티켓 " + nextTier.tickets + "장";
    $("rwMissionStatus").textContent = statusTxt;

    var ladder = "";
    tiers.forEach(function (t) {
      ladder += '<span class="tierchip' + (mDone >= t.need ? ' on' : '') + '">' + t.need + '개 → 티켓 ' + t.tickets + '장</span>';
    });
    $("rwTierLadder").innerHTML = ladder;

    var cleared = !!S.cleared;
    $("rwTreasureStatus").textContent = cleared
      ? (S.rewardIssued ? "골드 티켓을 이미 수령했습니다" : "황금 귤을 찾았습니다! 골드 티켓을 받아가세요")
      : "아직 진행중이에요 (" + uniqueLetterCount() + " / " + LETTERS.length + " 단서)";
    $("btnRewardCoupon").style.display = cleared ? "block" : "none";
    $("btnRewardGo").style.display = cleared ? "none" : "block";
  }

  /* ---------- 메인 화면 ---------- */
  function renderMain() {
    var got = uniqueLetterCount(), all = LETTERS.length;
    $("pgNow").textContent = got;
    $("pgAll").textContent = all;
    $("pgBar").style.transform = "scaleX(" + (all ? (got / all) : 0) + ")";
    $("foundCnt").textContent = S.found.length;
    $("whoAmI").textContent = S.nickname || "";

    var pouch = $("pouch"), html = "";
    for (var i = 0; i < S.letters.length; i++) {
      html += '<div class="chip" style="animation-delay:' + (i * 0.03) + 's">' + S.letters[i].char + '</div>';
    }
    for (var j = S.letters.length; j < all; j++) html += '<div class="chip empty">?</div>';
    pouch.innerHTML = html;

    $("btnFinal").textContent = S.cleared
      ? "골드 티켓 다시 보기"
      : ((got >= all && all > 0) ? "글자를 다 모았다! 답 맞히기" : "모은 글자로 답 맞히기");

    renderCompassGate();
    updateCompass();
  }

  /* ---------- 퀴즈 ---------- */
  function openPointQuiz(p) {
    if (!p) { toast("알 수 없는 지점입니다"); showTab("scMain"); return; }
    if (D.settings.gameOpen === false) { toast("게임이 잠시 중단되었습니다"); showTab("scMain"); return; }
    if (hasLetter(p.li)) {
      toast("이미 찾은 곳입니다");
      renderMain(); showTab("scMain"); return;
    }
    CUR = p; wrongCount = 0;
    var quiz = D.quizzes[p.q] || { qn: "(문제가 아직 등록되지 않았습니다)", a: [] };
    $("qZone").textContent = p.flavor || "";
    $("qCode").textContent = p.id;
    $("qText").textContent = quiz.qn;
    $("qInput").value = "";
    $("qWrong").textContent = "";
    show("scQuiz");
    setTimeout(function () { $("qInput").focus(); }, 250);
  }

  function submitQuiz() {
    if (!CUR) return;
    var quiz = D.quizzes[CUR.q];
    var v = norm($("qInput").value);
    if (!v) return;
    var ok = false;
    if (quiz) for (var i = 0; i < quiz.a.length; i++) if (norm(quiz.a[i]) === v) ok = true;

    if (!ok) {
      wrongCount++;
      var card = $("qCard");
      card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
      $("qWrong").textContent = wrongCount >= 3
        ? "잘 모르겠으면 근처 스태프에게 물어보세요"
        : "다시 한 번!";
      $("qInput").select();
      return;
    }
    grant(CUR);
  }

  /* ---------- 보상 지급 ---------- */
  function grant(p) {
    S.found.push(p.id);
    S.letters.push({ li: p.li, char: LETTERS[p.li], at: Date.now() });
    Store.saveMe(S);

    var left = LETTERS.length - uniqueLetterCount();
    $("rsBurst").textContent = "QUEST CLEAR";
    $("rsBig").textContent = LETTERS[p.li];
    $("rsBig").className = "big";
    $("rsTitle").textContent = "단서 「" + LETTERS[p.li] + "」 획득!";
    $("rsDesc").textContent = left > 0 ? "남은 글자 " + left + "개" : "글자를 전부 모았습니다!";
    show("scResult");

    /* 글자를 다 모았으면 결과 버튼을 최종 도전으로 */
    var done = uniqueLetterCount() >= LETTERS.length && LETTERS.length > 0;
    $("btnResultOk").textContent = done ? "마지막 문제 풀러 가기" : "나침반으로 돌아가기";
    $("btnResultOk").dataset.go = done ? "final" : "main";
  }

  /* ---------- 미션 QR 완료 ----------
     스태프가 완료를 확인한 뒤 명찰의 QR을 보여주면, 참가자가 자기 폰으로 찍어서 즉시 완료 처리한다. */
  function missionByQr(code) {
    var list = D.missions || [];
    for (var i = 0; i < list.length; i++) if (list[i].qr === code) return list[i];
    return null;
  }
  function openMissionQR(code) {
    var m = missionByQr(code);
    if (!m) { toast("알 수 없는 미션 QR입니다"); renderHome(); show("scHome"); return; }
    S.missionsDone = S.missionsDone || [];
    if (S.missionsDone.indexOf(m.id) >= 0) {
      toast("이미 완료 처리된 미션입니다");
      renderMissions(); showTab("scMissions");
      return;
    }
    S.missionsDone.push(m.id);
    Store.saveMe(S);

    $("rsBurst").textContent = "MISSION CLEAR";
    $("rsBig").textContent = "✓";
    $("rsBig").className = "big ev";
    $("rsTitle").textContent = m.name + " 완료!";
    $("rsDesc").textContent = m.line || m.desc || "";
    show("scResult");
    $("btnResultOk").textContent = "미션 목록으로";
    $("btnResultOk").dataset.go = "missions";
  }

  /* 단서로 뿌릴 글자 = 최종 '질문'에서 공백·문장부호를 뺀 글자들.
     참가자는 지점을 돌며 질문 글자를 모으고, 완성된 질문의 '답'을 입력한다.
     그래서 지점 수는 정답 글자 수가 아니라 이 질문 글자 수와 같아야 한다. */
  function clueChars() {
    var q = (D.quizzes && D.quizzes.final && D.quizzes.final.qn) || "";
    return q.replace(/[\s?!.,·:;"'()\-—‘’“”]/g, "").split("");
  }

  /* ---------- 최종 ---------- */
  function openFinal() {
    /* 질문 자체가 수집 대상이므로 여기서 질문을 그대로 띄우지 않는다 */
    $("fnQ").textContent = "모은 글자를 조합하면 질문이 됩니다. 그 질문의 답을 적어주세요.";
    var chips = "", shuffled = S.letters.slice();
    for (var i = 0; i < shuffled.length; i++) chips += '<div class="chip">' + shuffled[i].char + '</div>';
    if (!shuffled.length) chips = '<p style="color:#9fb6d0;font-size:13px;margin:0">아직 모은 글자가 없습니다</p>';
    $("fnChips").innerHTML = chips;
    var got = uniqueLetterCount(), all = LETTERS.length;
    $("fnCount").textContent = got >= all
      ? "글자를 전부 모았습니다"
      : got + " / " + all + " — 다 모으지 않아도 도전할 수 있습니다";
    $("fnInput").value = ""; $("fnWrong").textContent = "";
    show("scFinal");
    setTimeout(function () { $("fnInput").focus(); }, 250);
  }

  function submitFinal() {
    var v = norm($("fnInput").value);
    if (!v) return;
    var list = [D.settings.finalAnswer].concat(D.settings.finalAliases || []);
    var ok = false;
    for (var i = 0; i < list.length; i++) if (norm(list[i]) === v) ok = true;

    if (!ok) {
      $("fnWrong").textContent = "아직 아니에요. 다시 한 번!";
      var c = $("fnInput"); c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake");
      c.select();
      return;
    }
    if (!S.cleared) {
      S.cleared = true;
      S.clearedAt = Date.now();
      S.rewardNo = S.pid.slice(1, 7);
      syncAutoMissions();
      Store.saveMe(S);
    }
    var t = $("tangerine");
    t.classList.remove("open");
    $("tapMe").style.display = "";
    show("scOpen");
  }

  function openTangerine() {
    var t = $("tangerine");
    if (t.classList.contains("open")) return;
    t.classList.add("open");
    $("tapMe").style.display = "none";
    setTimeout(renderCoupon, 950);
  }

  function renderCoupon() {
    var st = D.settings;
    $("cpAnswer").textContent = "정답 — " + st.finalAnswer;
    $("cpTitle").textContent = st.rewardTitle || "골드 티켓";
    $("cpWho").textContent = S.nickname + " 해적";
    $("cpNo").textContent = "No. " + (S.rewardNo || "------");
    var d = new Date(S.clearedAt || Date.now());
    $("cpAt").textContent =
      d.getFullYear() + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + ("0" + d.getDate()).slice(-2) +
      " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
    $("cpNote").textContent = st.rewardDesc || "";
    $("couponCard").classList.toggle("used", !!S.rewardIssued);
    show("scCoupon");
  }

  /* ---------- 네트워크 배지 ---------- */
  window.onNetChange = function (online) {
    $("netBadge").classList.toggle("show", !online);
  };

  /* ---------- 시작 ---------- */
  function boot() {
    LETTERS = clueChars();

    $("introTitle").textContent = D.settings.title || "황금 귤을 찾아라";
    $("introSub").textContent = D.settings.subtitle || "";
    document.title = D.settings.title || "황금 귤을 찾아라";

    S = Store.me();
    var params = new URLSearchParams(location.search);
    var mcode = (params.get("m") || "").toUpperCase();

    if (!Store.isOnline()) $("netBadge").classList.add("show");

    if (!S) {
      if (mcode) sessionStorage.setItem("ggg_pending_m", mcode);
      Sound.want("opening");
      show("scIntro");
      Cinema.start();
      return;
    }
    if (!S.missionsDone) S.missionsDone = []; // 이전 버전 참가자 호환
    Sound.want("ocean");
    renderMain();
    if (mcode) { openMissionQR(mcode); }
    else { renderHome(); show("scHome"); }
  }
  Sound.init();

  /* 홈 화면을 계속 안 들어가도 시간대 대사는 놓치지 않도록 1분마다 확인(등록 전이면 조용히 건너뜀) */
  setInterval(function () { if (S) checkScheduleQuests(); }, 60000);

  /* ---------- 이벤트 연결 ---------- */
  $("btnJoin").addEventListener("click", function () {
    var nick  = $("inNick").value.trim();
    var phone = $("inPhone").value.trim();
    if (!nick)  { toast("닉네임을 입력해 주세요"); $("inNick").focus(); return; }
    if (Store.normPhone(phone).length < 10) { toast("전화번호를 정확히 입력해 주세요"); $("inPhone").focus(); return; }

    S = Store.register(nick, phone);
    if (Cinema.getPath()) { S.missionPath = Cinema.getPath(); Store.saveMe(S); }
    Sound.want("ocean");
    renderMain();
    var pendingM = sessionStorage.getItem("ggg_pending_m");
    sessionStorage.removeItem("ggg_pending_m");
    if (pendingM) { openMissionQR(pendingM); }
    else { renderHome(); show("scHome"); toast("항해를 시작합니다"); }
  });

  $("btnRestore").addEventListener("click", function () {
    var phone = $("inPhone").value.trim();
    if (Store.normPhone(phone).length < 10) { toast("전화번호를 입력한 뒤 눌러 주세요"); $("inPhone").focus(); return; }
    var found = Store.restore(phone);
    if (!found) { toast("이 기기에 저장된 기록이 없습니다"); return; }
    S = found; if (!S.missionsDone) S.missionsDone = [];
    Sound.want("ocean");
    renderMain();
    var pendingM = sessionStorage.getItem("ggg_pending_m");
    sessionStorage.removeItem("ggg_pending_m");
    if (pendingM) { openMissionQR(pendingM); }
    else { renderHome(); show("scHome"); toast("이어서 진행합니다"); }
  });

  /* ---------- 홈 / 진행상황 / 보상 내비게이션 ---------- */
  $("btnGoProgress").addEventListener("click", function () { renderMissions(); showTab("scMissions"); });
  $("tabMission").addEventListener("click", function () { renderMissions(); showTab("scMissions"); });
  $("tabTreasure").addEventListener("click", function () { renderMain(); showTab("scMain"); });
  $("tabMission2").addEventListener("click", function () { renderMissions(); showTab("scMissions"); });
  $("tabTreasure2").addEventListener("click", function () { renderMain(); showTab("scMain"); });

  document.querySelectorAll("#navbar .navbtn").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = b.dataset.nav;
      if (id === "scHome") { renderHome(); show("scHome"); }
      else if (id === "scMissions") { renderMissions(); showTab("scMissions"); }
      else if (id === "scRewards") { renderRewards(); show("scRewards"); }
    });
  });

  $("btnRewardCoupon").addEventListener("click", function () { renderCoupon(); });
  $("btnRewardGo").addEventListener("click", function () { renderMain(); showTab("scMain"); });
  $("btnVoteBack").addEventListener("click", function () { renderHome(); show("scHome"); });

  $("inPhone").addEventListener("input", function (e) {
    var v = e.target.value.replace(/[^0-9]/g, "").slice(0, 11);
    if (v.length > 7)      v = v.slice(0, 3) + "-" + v.slice(3, 7) + "-" + v.slice(7);
    else if (v.length > 3) v = v.slice(0, 3) + "-" + v.slice(3);
    e.target.value = v;
  });

  $("btnAnswer").addEventListener("click", submitQuiz);
  $("qInput").addEventListener("keydown", function (e) { if (e.key === "Enter") submitQuiz(); });
  $("btnQuizBack").addEventListener("click", function () { renderMain(); showTab("scMain"); });

  $("btnResultOk").addEventListener("click", function () {
    if (this.dataset.go === "missions") { renderMissions(); showTab("scMissions"); return; }
    renderMain();
    if (this.dataset.go === "final") openFinal(); else showTab("scMain");
  });

  $("btnFinal").addEventListener("click", function () {
    if (S && S.cleared) renderCoupon(); else openFinal();
  });
  $("btnFinalAnswer").addEventListener("click", submitFinal);
  $("fnInput").addEventListener("keydown", function (e) { if (e.key === "Enter") submitFinal(); });
  $("btnFinalBack").addEventListener("click", function () { renderMain(); showTab("scMain"); });

  $("tangerine").addEventListener("click", openTangerine);
  $("scOpen").addEventListener("click", openTangerine);
  $("btnCouponBack").addEventListener("click", function () { renderMain(); showTab("scMain"); });

  $("btnHowScan").addEventListener("click", function () {
    toast("나침반이 가리키는 방향으로 걸어가면, 도착했을 때 자동으로 퀴즈가 뜹니다");
  });
  $("btnCompassStart") && $("btnCompassStart").addEventListener("click", startCompass);

  $("reactPad").addEventListener("click", tapReactPad);
  $("btnReactFinish").addEventListener("click", claimReaction);
  $("btnReactBack").addEventListener("click", function () {
    reactState = null;
    renderMissions(); showTab("scMissions");
  });

  /* ---------- 관리자 숨김 진입: HUD 배지를 5번 연속 탭 ---------- */
  var crestTaps = 0, crestTimer = null;
  if ($("hudCrest")) {
    $("hudCrest").addEventListener("click", function () {
      crestTaps++;
      clearTimeout(crestTimer);
      crestTimer = setTimeout(function () { crestTaps = 0; }, 1500);
      if (crestTaps >= 5) {
        crestTaps = 0;
        var pin = window.prompt("관리자 PIN");
        if (pin === null) return;
        if (pin === (D.settings.adminPin || "6842")) { renderAdmin(); show("scAdmin"); }
        else toast("PIN이 올바르지 않습니다");
      }
    });
  }
  $("btnAdminBack").addEventListener("click", function () { renderHome(); show("scHome"); });
  $("btnAdminWipe").addEventListener("click", function () {
    if (!window.confirm("이 기기에 저장된 모든 참가자 기록을 삭제할까요? 되돌릴 수 없습니다.")) return;
    Store.wipePlayers();
    toast("삭제되었습니다");
    location.reload();
  });

  /* ---------- 오프라인 대응 ---------- */
  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  boot();
})();
