/* ============================================================
   저장 레이어
   ------------------------------------------------------------
   지금은 브라우저 localStorage 만 쓴다. (인터넷 없이도 동작)
   나중에 Firebase 를 붙이려면 아래 FIREBASE 설정만 채우면 되고,
   게임 코드(app.js)는 손대지 않아도 된다.
   ============================================================ */

window.Store = (function () {

  /* Firebase 설정을 넣으면 서버 동기화가 켜진다. 비워두면 로컬 전용. */
  var FIREBASE = null;
  /* 예시:
     var FIREBASE = {
       apiKey: "...", authDomain: "...", projectId: "...", appId: "..."
     };
  */

  var KEY_ME    = "ggg_me";        // 내 진행 상태
  var KEY_ALL   = "ggg_players";   // 참가자 전체 (로컬 테스트/관리자용)
  var KEY_DATA  = "ggg_content";   // 관리자가 수정한 콘텐츠
  var queue     = [];              // 서버 전송 대기열

  function read(k, def) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }
  function normPhone(p) { return String(p || "").replace(/[^0-9]/g, ""); }

  /* ---------- 콘텐츠 (관리자 수정분이 있으면 그걸 우선) ---------- */
  /* 관리자 화면에서 실제로 편집 가능한 항목만 저장된 값을 쓴다.
     timetable/experiences/missions/gpsPoints는 편집 UI가 아예 없으므로,
     브라우저에 예전 전체 스냅샷이 남아있어도 항상 최신 data.js 값을 그대로 쓴다. */
  var EDITABLE_KEYS = ["settings", "quizzes", "votes", "introQuest", "scheduleQuests", "missions"];
  function loadContent() {
    var base = JSON.parse(JSON.stringify(window.GAME_DATA));
    var edited = read(KEY_DATA, null);
    if (!edited || !edited.settings) return base;
    var out = JSON.parse(JSON.stringify(base));
    for (var i = 0; i < EDITABLE_KEYS.length; i++) {
      var k = EDITABLE_KEYS[i];
      if (edited[k]) out[k] = edited[k];
    }
    return out;
  }
  function saveContent(obj) { return write(KEY_DATA, obj); }
  function resetContent()   { try { localStorage.removeItem(KEY_DATA); } catch (e) {} }

  /* ---------- 참가자 ---------- */
  function newId() {
    return "P" + Date.now().toString(36).toUpperCase() +
           Math.random().toString(36).slice(2, 5).toUpperCase();
  }

  function blank() {
    return {
      pid: newId(), nickname: "", name: "", phone: "",
      createdAt: Date.now(),
      found: [], letters: [], nextTargetId: null,
      cleared: false, clearedAt: 0,
      rewardIssued: false, rewardNo: "",
      missionsDone: [],
      votes: {}
    };
  }

  function me()        { return read(KEY_ME, null); }
  function saveMe(s)   { write(KEY_ME, s); syncOne(s); return s; }
  function clearMe()   { try { localStorage.removeItem(KEY_ME); } catch (e) {} }

  function register(nick, name, phone) {
    var s = blank();
    s.nickname = nick; s.name = name; s.phone = normPhone(phone);
    saveMe(s);
    return s;
  }

  /* 전화번호로 이어하기 — 같은 기기에 기록이 남아있을 때만 복구된다.
     Firebase 를 붙이면 다른 기기에서도 복구된다. */
  function restore(phone) {
    var all = read(KEY_ALL, {});
    var key = normPhone(phone);
    if (all[key]) { write(KEY_ME, all[key]); return all[key]; }
    return null;
  }

  /* ---------- 전체 목록 (관리자) ---------- */
  function syncOne(s) {
    if (!s || !s.phone) return;
    var all = read(KEY_ALL, {});
    all[s.phone] = s;
    write(KEY_ALL, all);
    if (!FIREBASE) return;
    queue.push(s);
    flush();
  }
  /* 남의 기록만 갱신한다. 내 진행 상태(KEY_ME)는 건드리지 않는다. */
  function updatePlayer(p) {
    if (!p || !p.phone) return;
    var all = read(KEY_ALL, {});
    all[p.phone] = p;
    write(KEY_ALL, all);
    var m = me();
    if (m && m.phone === p.phone) write(KEY_ME, p);
  }

  function players() {
    var all = read(KEY_ALL, {});
    return Object.keys(all).map(function (k) { return all[k]; })
      .sort(function (a, b) { return b.createdAt - a.createdAt; });
  }
  function removePlayer(phone) {
    var all = read(KEY_ALL, {});
    delete all[normPhone(phone)];
    write(KEY_ALL, all);
    var m = me();
    if (m && m.phone === normPhone(phone)) clearMe();
  }
  function wipePlayers() {
    try { localStorage.removeItem(KEY_ALL); localStorage.removeItem(KEY_ME); } catch (e) {}
  }

  /* ---------- 서버 동기화 (Firebase 붙였을 때만) ---------- */
  var online = navigator.onLine;
  window.addEventListener("online",  function () { online = true;  flush(); notify(); });
  window.addEventListener("offline", function () { online = false; notify(); });

  function notify() {
    if (typeof window.onNetChange === "function") window.onNetChange(online, queue.length);
  }
  function flush() {
    if (!FIREBASE || !online || !queue.length) return;
    /* Firebase 를 붙이는 자리.
       여기서 queue 를 Firestore 로 보내고 성공하면 비운다.
       지금은 설정이 없으므로 아무것도 하지 않는다. */
  }

  return {
    hasServer: function () { return !!FIREBASE; },
    isOnline:  function () { return online; },
    pending:   function () { return queue.length; },
    loadContent: loadContent, saveContent: saveContent, resetContent: resetContent,
    me: me, saveMe: saveMe, clearMe: clearMe,
    register: register, restore: restore, normPhone: normPhone,
    players: players, updatePlayer: updatePlayer,
    removePlayer: removePlayer, wipePlayers: wipePlayers
  };
})();
