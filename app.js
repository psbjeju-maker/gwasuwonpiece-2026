/* ============================================================
   황금 귤을 찾아라 — 게임 로직
   ============================================================ */
(function () {

  var D  = Store.loadContent();     // 콘텐츠 (관리자 수정분 우선)
  var S  = null;                    // 내 진행 상태
  var CUR = null;                   // 지금 풀고 있는 QR
  var wrongCount = 0;

  var LETTERS = [];                 // 최종 정답을 한 글자씩 쪼갠 배열

  /* ---------- 도우미 ---------- */
  function $(id) { return document.getElementById(id); }
  function qrById(id) {
    for (var i = 0; i < D.qrcodes.length; i++) if (D.qrcodes[i].id === id) return D.qrcodes[i];
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

  /* ---------- 지도 ---------- */
  function mapSVG() {
    var z = D.zones, s = "";
    s += '<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="행사장 지도">';
    s += '<defs>';
    s += '<linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">';
    s += '<stop offset="0" stop-color="#16405f"/><stop offset="1" stop-color="#0d2a45"/></linearGradient>';
    s += '<pattern id="tree" width="16" height="16" patternUnits="userSpaceOnUse">';
    s += '<circle cx="8" cy="8" r="3.4" fill="#2f6b4a" opacity=".85"/></pattern>';
    s += '</defs>';
    s += '<rect width="400" height="300" fill="url(#gr)"/>';

    /* 감귤밭 (E·F 구역) */
    s += '<path d="M232 4 H396 V132 Q320 118 262 78 Q236 58 232 4 Z" fill="#1c4a38" opacity=".9"/>';
    s += '<path d="M232 4 H396 V132 Q320 118 262 78 Q236 58 232 4 Z" fill="url(#tree)" opacity=".55"/>';
    /* 꽃길 (F) */
    s += '<path d="M330 8 Q368 22 392 16" stroke="#c9713f" stroke-width="9" fill="none" opacity=".75" stroke-linecap="round"/>';
    /* 산책로 */
    s += '<path d="M212 214 Q252 168 288 122 Q318 82 356 44" stroke="#e0cba0" stroke-width="7" fill="none" opacity=".5" stroke-linecap="round" stroke-dasharray="1 11"/>';
    /* 광장 D */
    s += '<ellipse cx="256" cy="141" rx="52" ry="34" fill="#1d4666" opacity=".95"/>';
    /* 마켓 텐트 C */
    for (var i = 0; i < 5; i++) {
      var tx = 160 + i * 24;
      s += '<path d="M' + tx + ' 214 l14 -18 l14 18 Z" fill="#2b6ea8" opacity=".9"/>';
    }
    s += '<rect x="158" y="212" width="122" height="6" rx="2" fill="#22557f" opacity=".9"/>';
    /* 본관 B */
    s += '<rect x="76" y="140" width="66" height="42" rx="5" fill="#c9762e" opacity=".92"/>';
    s += '<rect x="76" y="140" width="66" height="12" rx="5" fill="#e0913f" opacity=".95"/>';
    /* 비닐하우스 G */
    s += '<path d="M126 100 h60 a30 30 0 0 0 -60 0 Z" fill="#3a4a57" opacity=".95"/>';
    s += '<rect x="126" y="99" width="60" height="26" rx="3" fill="#33424e" opacity=".95"/>';
    /* 과수원피스 로고 A */
    s += '<circle cx="74" cy="232" r="30" fill="#1d4666" opacity=".95"/>';
    s += '<path d="M68 244 v-20 a6 6 0 0 1 12 0 v20 Z" fill="#9aa7b3" opacity=".9"/>';
    s += '<circle cx="74" cy="216" r="7" fill="#9aa7b3" opacity=".9"/>';
    /* 입구 */
    s += '<path d="M28 276 h44" stroke="#d9a441" stroke-width="4" stroke-linecap="round"/>';
    s += '<text x="50" y="292" fill="#d9a441" font-size="11" text-anchor="middle" font-family="sans-serif">입구</text>';

    /* 구역 라벨 */
    Object.keys(z).forEach(function (k) {
      var Z = z[k], x = Z.x * 4, y = Z.y * 3;
      s += '<text x="' + x + '" y="' + (y - 20) + '" fill="#7fa0bd" font-size="10.5" ' +
           'text-anchor="middle" font-family="sans-serif" letter-spacing="1">' + k + ' · ' + Z.name + '</text>';
    });

    s += '</svg>';
    return s;
  }

  function mapBase() {
    return D.settings.mapImage
      ? '<img src="' + D.settings.mapImage + '" alt="행사장 지도">'
      : mapSVG();
  }

  function renderMap() {
    var box = $("mapBox");
    var html = mapBase();

    /* 찾은 곳 */
    for (var i = 0; i < S.found.length; i++) {
      var q = qrById(S.found[i]);
      if (!q) continue;
      html += '<div class="pin found" style="left:' + q.x + '%;top:' + q.y + '%">🍊</div>';
    }
    /* X 표시 */
    for (var j = 0; j < S.marks.length; j++) {
      var m = qrById(S.marks[j]);
      if (!m || S.found.indexOf(m.id) >= 0) continue;
      html += '<div class="pin mark" style="left:' + m.x + '%;top:' + m.y + '%">✕</div>';
    }
    box.innerHTML = html;

    var live = S.marks.filter(function (id) { return S.found.indexOf(id) < 0; });
    $("mapHint").innerHTML = live.length
      ? '<b>X</b> 표시된 곳 근처에 QR이 있습니다'
      : 'QR을 하나 찾아 찍으면 다음 위치가 표시됩니다';
  }

  /* 다음에 안내할 QR 3곳 — 같은 구역 먼저, 그다음 인접 구역 */
  function nearbyFor(q) {
    var zone = D.zones[q.zone];
    var order = [q.zone].concat(zone ? zone.near : []);
    var picked = [];
    for (var z = 0; z < order.length && picked.length < 3; z++) {
      var pool = D.qrcodes.filter(function (c) {
        return c.zone === order[z] && c.id !== q.id &&
               S.found.indexOf(c.id) < 0 && picked.indexOf(c.id) < 0;
      });
      /* 섞기 */
      for (var i = pool.length - 1; i > 0; i--) {
        var r = Math.floor(Math.random() * (i + 1));
        var t = pool[i]; pool[i] = pool[r]; pool[r] = t;
      }
      for (var k = 0; k < pool.length && picked.length < 3; k++) picked.push(pool[k].id);
    }
    if (picked.length < 3) {
      var rest = D.qrcodes.filter(function (c) {
        return S.found.indexOf(c.id) < 0 && picked.indexOf(c.id) < 0;
      });
      for (var m = 0; m < rest.length && picked.length < 3; m++) picked.push(rest[m].id);
    }
    return picked;
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
      if (earned && !already) { S.missionsDone.push(m.id); changed = true; }
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
  /* 항해사 HUD + 현재 퀘스트 배너 — 홈을 게임 화면처럼 만든다 */
  function renderHud() {
    if (!$("hudName")) return;
    syncAutoMissions();
    var got = uniqueLetterCount(), all = LETTERS.length;
    var mDone = (S.missionsDone || []).length, mAll = (D.missions || []).length;

    $("hudName").textContent = S.nickname || "이름 없는 항해사";
    $("hudMeta").textContent = "미션 " + mDone + " / " + mAll
      + " · 응모티켓 " + ticketsEarned(mDone) + "장";

    $("qbTitle").textContent = D.settings.title || "황금 귤을 찾아라";
    $("qbSub").textContent = S.cleared
      ? "보물을 손에 넣었다! 보상을 받아가라"
      : "숨은 QR을 찾아 단서를 모아라";
    var pct = all ? got / all : 0;
    $("qbBar").style.transform = "scaleX(" + pct + ")";
    $("qbFoot").textContent = "단서 " + got + " / " + all;
    $("qbPct").textContent = Math.round(pct * 100) + "%";
  }

  function renderHome() {
    if ($("homeTitle")) $("homeTitle").textContent = D.settings.title || "황금 귤을 찾아라";
    if ($("homeSub")) $("homeSub").textContent = D.settings.subtitle || "";
    renderHud();

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
  function renderMissions() {
    syncAutoMissions();
    var list = D.missions || [];
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
    if (S.missionsDone.indexOf(reactState.mid) < 0) S.missionsDone.push(reactState.mid);
    Store.saveMe(S);
    reactState = null;
    toast("반응속도게임 완료!");
    renderMissions();
    showTab("scMissions");
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
    $("shardCnt").textContent = S.shards ? "황금 조각 " + S.shards + "개" : "";

    var pouch = $("pouch"), html = "";
    for (var i = 0; i < S.letters.length; i++) {
      html += '<div class="chip" style="animation-delay:' + (i * 0.03) + 's">' + S.letters[i].char + '</div>';
    }
    for (var j = S.letters.length; j < all; j++) html += '<div class="chip empty">?</div>';
    pouch.innerHTML = html;

    $("btnFinal").textContent = S.cleared
      ? "골드 티켓 다시 보기"
      : ((got >= all && all > 0) ? "글자를 다 모았다! 답 맞히기" : "모은 글자로 답 맞히기");

    renderMap();
  }

  /* ---------- 퀴즈 ---------- */
  function openQuiz(id) {
    var q = qrById(id);
    if (!q) { toast("알 수 없는 QR입니다"); showTab("scMain"); return; }
    if (D.settings.gameOpen === false) { toast("게임이 잠시 중단되었습니다"); showTab("scMain"); return; }

    if (S.found.indexOf(id) >= 0) {
      toast("이미 찾은 곳입니다");
      renderMain(); showTab("scMain"); return;
    }
    CUR = q; wrongCount = 0;
    var quiz = D.quizzes[q.q] || { qn: "(문제가 아직 등록되지 않았습니다)", a: [] };
    $("qZone").textContent = (D.zones[q.zone] ? D.zones[q.zone].name : q.zone);
    $("qCode").textContent = q.id;
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
  function grant(q) {
    S.found.push(q.id);
    var big = "", burst = "QUEST CLEAR", title = "", desc = "", isEvent = false;

    if (q.type === "letter" || q.type === "duplicate") {
      if (hasLetter(q.li)) {
        /* 이미 가진 글자 — 중복 QR을 만난 경우 */
        S.shards++;
        isEvent = true;
        big = "✨"; burst = "이미 찾은 글자";
        title = "「" + LETTERS[q.li] + "」 은 이미 가지고 있어요";
        desc = "대신 황금 귤 조각을 하나 얻었습니다. (총 " + S.shards + "개)";
      } else {
        S.letters.push({ li: q.li, char: LETTERS[q.li], at: Date.now() });
        big = LETTERS[q.li];
        title = "단서 「" + LETTERS[q.li] + "」 획득!";
        var left = LETTERS.length - uniqueLetterCount();
        desc = left > 0 ? "남은 글자 " + left + "개" : "글자를 전부 모았습니다!";
      }
    } else {
      isEvent = true;
      var ev = D.events[q.ev] || { name: "이벤트", icon: "✨", text: "" };
      big = ev.icon;
      burst = "이벤트";
      title = ev.name;
      desc = q.evText || ev.text || "";
      S.events.push(q.id);

      if (q.ev === "lucky") {
        var missing = [];
        for (var i = 0; i < LETTERS.length; i++) if (!hasLetter(i)) missing.push(i);
        if (missing.length) {
          var pick = missing[Math.floor(Math.random() * missing.length)];
          S.letters.push({ li: pick, char: LETTERS[pick], at: Date.now() });
          big = LETTERS[pick]; isEvent = false;
          title = "행운의 감귤 — 「" + LETTERS[pick] + "」 획득!";
          desc = "남은 글자 " + (LETTERS.length - uniqueLetterCount()) + "개";
        } else {
          S.shards++;
          desc = "이미 글자를 다 모았네요. 황금 귤 조각을 드립니다.";
        }
      } else if (q.ev === "shard") {
        S.shards++;
        desc = (desc ? desc + " " : "") + "(총 " + S.shards + "개)";
      }
    }

    S.marks = nearbyFor(q);
    Store.saveMe(S);

    $("rsBurst").textContent = burst;
    $("rsBig").textContent = big;
    $("rsBig").className = "big" + (isEvent ? " ev" : "");
    $("rsTitle").textContent = title;
    $("rsDesc").textContent = desc;
    show("scResult");

    /* 글자를 다 모았으면 결과 버튼을 최종 도전으로 */
    var done = uniqueLetterCount() >= LETTERS.length && LETTERS.length > 0;
    $("btnResultOk").textContent = done ? "마지막 문제 풀러 가기" : "지도로 돌아가기";
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
    $("rsDesc").textContent = m.desc || "";
    show("scResult");
    $("btnResultOk").textContent = "미션 목록으로";
    $("btnResultOk").dataset.go = "missions";
  }

  /* ---------- 최종 ---------- */
  function openFinal() {
    var fq = D.quizzes.final || {};
    $("fnQ").textContent = fq.qn || "모은 글자를 조합하면?";
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
    $("cpWho").textContent = S.nickname + " 항해사";
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
    LETTERS = String(D.settings.finalAnswer || "").split("");

    $("introTitle").textContent = D.settings.title || "황금 귤을 찾아라";
    $("introSub").textContent = D.settings.subtitle || "";
    document.title = D.settings.title || "황금 귤을 찾아라";

    S = Store.me();
    var params = new URLSearchParams(location.search);
    var qid = (params.get("q") || "").toUpperCase();
    var mcode = (params.get("m") || "").toUpperCase();

    if (!Store.isOnline()) $("netBadge").classList.add("show");

    if (!S) {
      if (qid) sessionStorage.setItem("ggg_pending", qid);
      if (mcode) sessionStorage.setItem("ggg_pending_m", mcode);
      show("scIntro");
      return;
    }
    if (!S.missionsDone) S.missionsDone = []; // 이전 버전 참가자 호환
    renderMain();
    if (qid) { openQuiz(qid); }
    else if (mcode) { openMissionQR(mcode); }
    else { renderHome(); show("scHome"); }
  }

  /* ---------- 이벤트 연결 ---------- */
  $("btnJoin").addEventListener("click", function () {
    var nick  = $("inNick").value.trim();
    var name  = $("inName").value.trim();
    var phone = $("inPhone").value.trim();
    if (!nick)  { toast("닉네임을 입력해 주세요"); $("inNick").focus(); return; }
    if (!name)  { toast("이름을 입력해 주세요");   $("inName").focus(); return; }
    if (Store.normPhone(phone).length < 10) { toast("전화번호를 정확히 입력해 주세요"); $("inPhone").focus(); return; }

    S = Store.register(nick, name, phone);
    renderMain();
    var pending = sessionStorage.getItem("ggg_pending");
    var pendingM = sessionStorage.getItem("ggg_pending_m");
    sessionStorage.removeItem("ggg_pending");
    sessionStorage.removeItem("ggg_pending_m");
    if (pending) { openQuiz(pending); }
    else if (pendingM) { openMissionQR(pendingM); }
    else { renderHome(); show("scHome"); toast("항해를 시작합니다"); }
  });

  $("btnRestore").addEventListener("click", function () {
    var phone = $("inPhone").value.trim();
    if (Store.normPhone(phone).length < 10) { toast("전화번호를 입력한 뒤 눌러 주세요"); $("inPhone").focus(); return; }
    var found = Store.restore(phone);
    if (!found) { toast("이 기기에 저장된 기록이 없습니다"); return; }
    S = found; if (!S.missionsDone) S.missionsDone = [];
    renderMain();
    var pending = sessionStorage.getItem("ggg_pending");
    var pendingM = sessionStorage.getItem("ggg_pending_m");
    sessionStorage.removeItem("ggg_pending");
    sessionStorage.removeItem("ggg_pending_m");
    if (pending) { openQuiz(pending); }
    else if (pendingM) { openMissionQR(pendingM); }
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
    toast("휴대폰 카메라 앱으로 QR을 비추면 바로 열립니다");
  });

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
        if (pin === (D.settings.adminPin || "")) { renderAdmin(); show("scAdmin"); }
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
