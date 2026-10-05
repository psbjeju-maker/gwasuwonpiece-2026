/* 박서방 행사 서버 클라이언트 (탐라문화제 · 과수원피스 · 스태프 콘솔 공용)
   ------------------------------------------------------------
   - 코인·결과·재고는 전부 서버(Cloud Functions)가 정한다. 여기는 "요청"만 보낸다.
   - 사용: <script src="ev-client.js"></script> 후 EV.state('gwasu') 등.
   - apiKey 는 비밀이 아니다(Firebase 웹 설정값은 원래 공개). 보안은 서버가 담당한다.
   - 관리자·스태프 PIN 은 이 파일에 없다. PIN 은 서버 비밀값이며, 로그인하면 12시간짜리 세션 토큰만 받는다. */
(function () {
  'use strict';
  var FB = {
    apiKey: 'AIzaSyBqmT2UBPpbSixiyju8CCpONoNnov959Ts',
    authDomain: 'psbjeju-kuji.firebaseapp.com',
    projectId: 'psbjeju-kuji',
    appId: '1:627012765686:web:41178983d00eb37fd029d7'
  };
  var REGION = 'asia-northeast3';
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var SESSION_KEY = 'ev.staffSession';

  function load(src) {
    return new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = function () { no(new Error('sdk-load-failed')); };
      document.head.appendChild(s);
    });
  }

  function emu() {
    try {
      var m = /[?&]evemu=(\d)/.exec(location.search);
      if (m) { if (m[1] === '1') localStorage.setItem('ev.emu', '1'); else localStorage.removeItem('ev.emu'); }
      var o = /[?&]evoff=(\d+)/.exec(location.search); // 포트 오프셋(에뮬레이터를 2개 띄울 때)
      if (o) localStorage.setItem('ev.emuoff', o[1]);
      return localStorage.getItem('ev.emu') === '1' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    } catch (e) { return false; }
  }

  var booted = null;
  function boot() {
    if (booted) return booted;
    booted = (async function () {
      await load(SDK + 'firebase-app-compat.js');
      await Promise.all([load(SDK + 'firebase-auth-compat.js'), load(SDK + 'firebase-functions-compat.js'), load(SDK + 'firebase-firestore-compat.js')]);
      if (!firebase.apps.length) {
        firebase.initializeApp(FB);
        if (emu()) { // 개발용: 로컬 에뮬레이터(127.0.0.1)에 연결 — ?evemu=1 로 켜고 ?evemu=0 으로 끈다
          var off = +(localStorage.getItem('ev.emuoff') || 0);
          firebase.auth().useEmulator('http://127.0.0.1:' + (9099 + off), { disableWarnings: true });
          firebase.app().functions(REGION).useEmulator('127.0.0.1', 5001 + off);
          firebase.firestore().useEmulator('127.0.0.1', 8080 + off);
        }
      }
      return firebase;
    })();
    booted.catch(function () { booted = null; });
    return booted;
  }

  /* 참가자 호출은 익명 로그인이 필요하다(스태프 세션 호출은 불필요) */
  async function ensureAnon() {
    var fb = await boot();
    var a = fb.auth();
    if (!a.currentUser) {
      await new Promise(function (ok) {
        var un = a.onAuthStateChanged(function () { un(); ok(); });
      });
    }
    if (!a.currentUser) await a.signInAnonymously();
    return fb;
  }

  /* 서버 오류를 화면용으로 정리: { code, reason, hint, details, message } */
  function norm(e) {
    var code = String((e && e.code) || 'unknown').replace('functions/', '');
    var d = (e && e.details) || {};
    var reason = String((e && e.message) || '');
    return {
      code: code, reason: reason, hint: d.hint || '', details: d,
      message: d.hint || (/^[a-z-]+$/.test(reason) ? messageFor(reason, code) : reason) || '잠시 후 다시 시도해 주세요.',
      retryable: code === 'unavailable' || code === 'deadline-exceeded' || code === 'internal' || code === 'unknown'
    };
  }
  function messageFor(reason, code) {
    var m = {
      'not-registered': '먼저 닉네임과 번호로 등록해 주세요.',
      'pass-required': '항해 패스 확인이 필요해요. 스태프에게 패스를 보여주세요.',
      'not-enough-coins': '코인이 부족해요.',
      'sold-out': '준비된 상품이 모두 소진되었어요.',
      'kuji-disabled': '쿠지가 아직 열려 있지 않아요.',
      'play-limit': '맛보기 횟수를 모두 사용했어요.',
      'mission-disabled': '지금 열려 있지 않은 미션이에요.',
      'staff-verify-required': '스태프 확인이 필요한 미션이에요.',
      'phone-registered': '이미 등록된 번호예요. 전화번호로 이어서 하거나 스태프에게 문의해 주세요.',
      'recover-locked': '닉네임을 여러 번 잘못 입력했어요. 스태프에게 문의해 주세요.',
      'config-missing': '행사 설정이 아직 준비되지 않았어요.',
      'event-disabled': '지금은 열려 있지 않아요.',
      'cost-not-set': '쿠지 필요 코인이 아직 정해지지 않았어요.',
      'no-paid-plays': '유료 쿠지 이용권이 없어요.',
      'paid-disabled': '유료 쿠지가 켜져 있지 않아요.',
      'clue-locked': '잠시 후 다시 시도해 주세요.',
      'clues-required': '필요한 단서를 먼저 모아 주세요.',
      'limit-not-set': '보물 수령 조건이 아직 준비되지 않았어요.',
      'person-limit': '받을 수 있는 보물 수를 채웠어요.',
      'card-id-required': '지급한 카드 종류를 선택해 주세요.',
      'already-given': '이미 지급된 결과예요.',
      'no-tier': '아직 보상을 받을 단계에 도달하지 못했어요.'
    };
    if (m[reason]) return m[reason];
    if (code === 'unauthenticated') return '로그인 정보가 없어요. 새로고침해 주세요.';
    if (code === 'permission-denied') return '권한이 없어요.';
    if (code === 'resource-exhausted') return '시도가 너무 많아요. 잠시 후 다시 해 주세요.';
    return '';
  }

  async function raw(name, data, needAuth) {
    try {
      var fb = needAuth ? await ensureAnon() : await boot();
      var r = await fb.app().functions(REGION).httpsCallable(name, { timeout: 20000 })(data || {});
      return r.data;
    } catch (e) { throw norm(e); }
  }

  /* 요청 번호: 같은 동작을 재전송해도 서버가 한 번만 처리하도록, 결과를 받을 때까지 같은 번호를 쓴다 */
  function newId() {
    var a = new Uint8Array(12); (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function pendingId(key) {
    var k = 'ev.rid.' + key;
    try { var v = localStorage.getItem(k); if (v) return v; v = newId(); localStorage.setItem(k, v); return v; } catch (e) { return newId(); }
  }
  function clearId(key) { try { localStorage.removeItem('ev.rid.' + key); } catch (e) {} }

  /* 요청 번호를 알아서 붙이고, 확정된 응답(성공 또는 재시도 무의미한 거절)이면 번호를 폐기한다 */
  async function withRid(key, name, data, needAuth) {
    var id = pendingId(key);
    try {
      var r = await raw(name, Object.assign({}, data, { requestId: id }), needAuth);
      clearId(key); return r;
    } catch (e) {
      if (!e.retryable) clearId(key);
      throw e;
    }
  }

  function session() { try { return sessionStorage.getItem(SESSION_KEY) || ''; } catch (e) { return ''; } }
  function staff(name, data) {
    var s = session();
    if (!s) return Promise.reject({ code: 'permission-denied', message: '스태프 로그인이 필요해요.', retryable: false, details: {} });
    return raw(name, Object.assign({}, data, { session: s }), false).catch(function (e) {
      if (e.code === 'permission-denied' && /로그인/.test(e.reason || '')) { try { sessionStorage.removeItem(SESSION_KEY); } catch (x) {} }
      throw e;
    });
  }

  /* passRequiredFrom(시각) 이후에는 서버 설정과 상관없이 패스 필요로 본다 */
  function effCfg(c) { if (c && c.passRequiredFrom && Date.now() >= c.passRequiredFrom) { c = Object.assign({}, c); c.passRequired = true; } return c; }

  window.EV = {
    /* ---- 참가자 ---- */
    register: function (nickname, phone) { return raw('registerParticipant', { nickname: nickname, phone: phone }, true); },
    recover: function (phone, nickname) { return raw('recoverParticipant', { phone: phone, nickname: nickname }, true); },
    state: function (eventId) { return raw('getState', { eventId: eventId }, true).then(function (s) { if (s && s.cfg) s.cfg = effCfg(s.cfg); return s; }); },
    claimMission: function (eventId, missionId, tier) { return withRid('m.' + eventId + '.' + missionId + (tier ? '.t' + tier : ''), 'claimMission', tier ? { eventId: eventId, missionId: missionId, tier: tier } : { eventId: eventId, missionId: missionId }, true); },
    playKuji: function (eventId, source, number, cardIds) {
      var d = { eventId: eventId, source: source || 'coin' }; if (number) d.number = number;
      if (cardIds && cardIds.length) d.cardIds = cardIds;
      return withRid('k.' + eventId + '.' + (source || 'coin') + (number ? '.n' + number : ''), 'playKuji', d, true);
    },
    kujiBoard: function (eventId) { return raw('kujiBoard', { eventId: eventId }, true); },
    /* 스태프가 참가자 폰에 PIN 을 눌러 확인 → 미션 카드 지급 (SNS 인증 등) */
    confirmMission: function (eventId, missionId, pin) { return withRid('c.' + eventId + '.' + missionId, 'confirmMission', { eventId: eventId, missionId: missionId, pin: pin }, true); },
    /* 부스에 붙은 미션 QR 을 참가자가 직접 찍음 → 스태프 없이 완료 */
    claimMissionQr: function (eventId, token, missionId) { return withRid('q.' + eventId + '.' + missionId, 'claimMissionQr', { eventId: eventId, token: token, missionId: missionId }, true); },
    /* 매표소에서 산 항해 패스 카드(1장 1회)를 찍어 패스를 켠다 */
    /* 최종 질문 정답 도전 → 맞히면 보너스 쿠지 이용권 */
    submitFinal: function (eventId, answer) { return raw('submitFinal', { eventId: eventId, answer: answer }, true); },
    /* 운영자가 넘기는 진행 단계·공지 (실시간) */
    onLive: function (eventId, cb) {
      boot().then(function (fb) { fb.firestore().doc('evLive/' + eventId).onSnapshot(function (d) { cb(d.exists ? d.data() : null); }, function () {}); }, function () {});
    },
    /* 명예의 전당 공개본 (실시간) */
    onHonor: function (eventId, cb) {
      boot().then(function (fb) {
        fb.firestore().collection('hallOfFamePublic').where('eventId', '==', eventId).onSnapshot(function (q) {
          cb(q.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; }));
        }, function () {});
      }, function () {});
    },
    claimPassCard: function (eventId, token) { return raw('claimPassCard', { eventId: eventId, token: token }, true); },
    submitClue: function (eventId, clueId, answer) { return raw('submitClue', { eventId: eventId, clueId: clueId, answer: answer }, true); },
    claimTreasure: function (eventId, code) { return withRid('t.' + eventId, 'claimTreasure', { eventId: eventId, answer: code }, true); },
    /* ---- 스태프 / 관리자 ---- */
    pinLogin: async function (pin, role) {
      var r = await raw('pinLogin', { pin: pin, role: role || 'staff' }, false);
      try { sessionStorage.setItem(SESSION_KEY, r.session); sessionStorage.setItem(SESSION_KEY + '.info', JSON.stringify({ role: r.role, exp: r.expiresAt })); } catch (e) {}
      return r;
    },
    logout: function () { try { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY + '.info'); } catch (e) {} },
    sessionInfo: function () { try { var i = JSON.parse(sessionStorage.getItem(SESSION_KEY + '.info') || 'null'); return session() && i && i.exp > Date.now() ? i : null; } catch (e) { return null; } },
    /* 행사 공개 설정(evCfg) 읽기 — 누구나 읽을 수 있는 문서 */
    readCfg: async function (eventId) { var fb = await boot(); var d = await fb.firestore().doc('evCfg/' + eventId).get(); return d.exists ? effCfg(d.data()) : null; },
    hasSession: function () { return !!session(); },
    staff: staff,
    newId: newId,
    norm: norm
  };
})();
