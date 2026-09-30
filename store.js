/* ============================================================
   저장 레이어 (2026-09-30 개편)
   ------------------------------------------------------------
   코인·미션·쿠지·단서·수령은 전부 서버(ev-client.js → Cloud Functions)가 기록한다.
   이 파일은 서버와 무관한 두 가지만 다룬다.
     1) 콘텐츠  : data.js 위에 관리자 화면이 덮어쓴 문구 (ggg_content)
     2) 기기 설정: 시간대 대사를 봤는지, 투표 선택, 나침반 목표 등 (ggg_prefs)
   예전 키(ggg_me / ggg_players)는 읽지도 지우지도 않는다 — 옛 참가자 기록은
   그대로 남겨 두고, 이전은 운영자가 판단한다. */

window.Store = (function () {

  var KEY_PREFS = "ggg_prefs";     // 기기 설정(서버에 없는 것만)
  var KEY_DATA  = "ggg_content";   // 관리자가 수정한 콘텐츠

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
     timetable/experiences/gpsPoints는 편집 UI가 아예 없으므로,
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

  /* ---------- 기기 설정 ---------- */
  function prefs() {
    var p = read(KEY_PREFS, null) || {};
    if (!p.votes) p.votes = {};
    if (!p.seenSchedule) p.seenSchedule = [];
    return p;
  }
  function savePrefs(p) { return write(KEY_PREFS, p); }

  return {
    loadContent: loadContent, saveContent: saveContent, resetContent: resetContent,
    prefs: prefs, savePrefs: savePrefs, normPhone: normPhone
  };
})();
