/* ============================================================
   저장 레이어
   ------------------------------------------------------------
   localStorage(기기별 저장, 오프라인에서도 항상 됨) + Firestore(서버,
   골드 티켓을 나중에 메이커앤하비 매장에서도 확인/상환하려면 필수) 둘 다 쓴다.
   Firestore 연결이 없거나 오프라인이면 조용히 로컬 전용으로만 동작한다
   (게임 진행 자체는 절대 막히지 않는다 — §PRODUCT.md 오프라인 우선 원칙).

   psbjeju-kuji 프로젝트를 재사용하되(이미 배포·인증 경험 있음), 컬렉션은
   완전히 분리(gwasuwonpiece_players)해서 쿠지 데이터와 안 섞인다.
   보안 규칙은 Desktop\쿠지시스템\firestore.rules 에 추가해뒀다 —
   `firebase deploy --only firestore:rules`로 배포해야 실제로 열린다. */

window.Store = (function () {

  var FIREBASE = {
    apiKey: "AIzaSyBqmT2UBPpbSixiyju8CCpONoNnov959Ts",
    authDomain: "psbjeju-kuji.firebaseapp.com",
    projectId: "psbjeju-kuji",
    storageBucket: "psbjeju-kuji.firebasestorage.app",
    messagingSenderId: "627012765686",
    appId: "1:627012765686:web:41178983d00eb37fd029d7"
  };
  var COL = "gwasuwonpiece_players"; // 참가자 문서 ID = 정규화된 전화번호

  /* index.html/admin.html이 firebase-app-compat.js + firebase-firestore-compat.js를
     먼저 로드해줘야 window.firebase가 있다. 스크립트 로딩이 실패하거나(오프라인 등)
     설정이 비어있으면 db는 null로 남고, 아래 모든 서버 동기화 코드는 조용히 스킵된다. */
  var db = null;
  try {
    if (FIREBASE && window.firebase && window.firebase.initializeApp) {
      var fbApp = window.firebase.apps && window.firebase.apps.length
        ? window.firebase.app() : window.firebase.initializeApp(FIREBASE);
      db = window.firebase.firestore(fbApp);
    }
  } catch (e) { db = null; }

  var KEY_ME    = "ggg_me";        // 내 진행 상태
  var KEY_ALL   = "ggg_players";   // 참가자 전체 (로컬 캐시 — 이 기기에서 본 사람만)
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
      pid: newId(), nickname: "", phone: "",
      createdAt: Date.now(),
      pass: false, passAt: 0,      // 항해 패스 구입 확인 여부(스태프 QR)
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

  function register(nick, phone) {
    var s = blank();
    s.nickname = nick; s.phone = normPhone(phone);
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
    if (!db) return;
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
    if (!db || !online || !queue.length) return;
    var batch = queue; queue = [];
    notify();
    batch.forEach(function (s) {
      db.collection(COL).doc(s.phone).set(s, { merge: true }).catch(function () {
        queue.push(s); // 실패(오프라인 전환 등) 시 다음 flush 때 재시도
      });
    });
  }

  /* ---------- 서버 직접 조회 (다른 기기 — 특히 메이커앤하비 매장 PC용) ----------
     전부 Promise. db가 없으면(오프라인/설정없음) 항상 null로 resolve한다. */
  function fetchRemote(phone) {
    if (!db) return Promise.resolve(null);
    return db.collection(COL).doc(normPhone(phone)).get()
      .then(function (doc) { return doc.exists ? doc.data() : null; })
      .catch(function () { return null; });
  }
  /* 메이커앤하비에서 골드 티켓 상환 확인 시 쓴다 — 서버 문서에 바로 기록한다.
     이 기기 로컬 캐시에 같은 참가자가 있으면 그것도 같이 갱신한다. */
  function issueRemote(phone) {
    if (!db) return Promise.reject(new Error("서버에 연결돼 있지 않습니다"));
    var key = normPhone(phone);
    var patch = { rewardIssued: true, rewardIssuedAt: Date.now() };
    return db.collection(COL).doc(key).set(patch, { merge: true }).then(function () {
      var all = read(KEY_ALL, {});
      if (all[key]) {
        all[key].rewardIssued = true; all[key].rewardIssuedAt = patch.rewardIssuedAt;
        write(KEY_ALL, all);
      }
      var m = me();
      if (m && m.phone === key) { m.rewardIssued = true; m.rewardIssuedAt = patch.rewardIssuedAt; write(KEY_ME, m); }
    });
  }
  /* 스태프가 참가자 문서의 일부 필드만 고쳐준다(항해 패스 수동 개시 등).
     서버·로컬 캐시·내 기록을 한꺼번에 맞춘다. */
  function patchRemote(phone, fields) {
    if (!db) return Promise.reject(new Error("서버에 연결돼 있지 않습니다"));
    var key = normPhone(phone);
    return db.collection(COL).doc(key).set(fields, { merge: true }).then(function () {
      var all = read(KEY_ALL, {});
      if (all[key]) {
        for (var k in fields) if (fields.hasOwnProperty(k)) all[key][k] = fields[k];
        write(KEY_ALL, all);
      }
      var m = me();
      if (m && m.phone === key) {
        for (var k2 in fields) if (fields.hasOwnProperty(k2)) m[k2] = fields[k2];
        write(KEY_ME, m);
      }
    });
  }

  /* 행사 종료 후 개인정보 파기용(§개인정보 안내문). 이 기기가 아는 참가자만 지울 수 있다 —
     이 기기가 한 번도 못 본 참가자(다른 스태프 폰에서만 접속한 사람)까지 완전히 지우려면
     Firebase 콘솔이나 `firebase firestore:delete gwasuwonpiece_players -r`로 컬렉션 전체를
     한 번 더 정리해야 한다. wipePlayers()가 로컬 캐시를 지우기 전에 이 기기가 아는 만큼만 먼저 호출한다. */
  function deleteRemote(phone) {
    if (!db) return Promise.resolve();
    return db.collection(COL).doc(normPhone(phone)).delete().catch(function () {});
  }
  /* 이 기기에 기록이 없어도(폰을 바꿨거나 앱을 새로 깔았거나) 서버에서 복구한다.
     동기 restore()가 실패했을 때 app.js가 이어서 호출한다. */
  function restoreRemote(phone) {
    return fetchRemote(phone).then(function (data) {
      if (!data) return null;
      write(KEY_ME, data);
      var all = read(KEY_ALL, {}); all[data.phone] = data; write(KEY_ALL, all);
      return data;
    });
  }

  return {
    hasServer: function () { return !!db; },
    isOnline:  function () { return online; },
    pending:   function () { return queue.length; },
    loadContent: loadContent, saveContent: saveContent, resetContent: resetContent,
    me: me, saveMe: saveMe, clearMe: clearMe,
    register: register, restore: restore, restoreRemote: restoreRemote, normPhone: normPhone,
    players: players, updatePlayer: updatePlayer,
    removePlayer: removePlayer, wipePlayers: wipePlayers,
    fetchRemote: fetchRemote, issueRemote: issueRemote, patchRemote: patchRemote,
    deleteRemote: deleteRemote
  };
})();
