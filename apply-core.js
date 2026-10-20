/* ══════════════════════════════════════════════════════════════
   참가 신청 공통 코드 — apply-booth.html / apply-stage.html
   저장: Firestore  psbjeju-kuji · gwasuwonpiece_applications
   문서 ID = "<종목>_<숫자만 남긴 전화번호>" → 같은 번호로 다시 내면 덮어씀
   ══════════════════════════════════════════════════════════════ */
window.Apply = (function () {

  /* ── 접수 일정 (여기만 고치면 두 신청 페이지에 모두 반영됩니다) ──
     형식은 "YYYY-MM-DDTHH:MM" (24시간). 이 시각이 되면 안내와 신청서가
     자동으로 열리고, 마감 시각이 지나면 자동으로 닫힙니다. */
  var SCHEDULE = {
    booth: {
      open:   "2026-09-08T10:00",
      close:  "2026-10-30T23:59",   // 추가 모집 마감 (10/20 사장님: 30일까지 연장)
      result: "10월 10일(토)까지",    // 1차 신청자 결과 안내
      extraFrom:   "2026-10-06T00:00", // 이 시각부터 '추가 모집' 표기
      extraResult: "신청 후 개별 연락"  // 추가 모집 신청자 결과 안내 (10/30까지 상시 접수)
    },
    stage: {
      open:   "2026-10-01T20:00",   // 10월 1일 오후 8시
      close:  "2026-10-30T23:59"   // 10/20 연장
    },
    bus: {
      open:   "2026-10-19T00:00",   // 셔틀버스 신청
      close:  "2026-10-30T23:59"    // 행사 전날까지
    },
    presale: {
      open:   "2026-10-17T00:00",   // 항해 패스 사전 판매 시작일 — 필요하면 이 날짜만 고치면 됨
      close:  "2026-10-30T23:59"    // 행사 전날까지
    }
  };

  var BUS_LIMIT = 30;               // 셔틀버스 전체 좌석(시청+남녕고 합산)
  var STAGE_LIMIT = 10;             // 노래·댄스 합쳐 선착순 확정 인원
  var EVENT_DAY   = "2026-10-31";   // 행사 당일 — D-day 표시 기준

  var FIREBASE = {
    apiKey: "AIzaSyBqmT2UBPpbSixiyju8CCpONoNnov959Ts",
    authDomain: "psbjeju-kuji.firebaseapp.com",
    projectId: "psbjeju-kuji",
    storageBucket: "psbjeju-kuji.firebasestorage.app",
    messagingSenderId: "627012765686",
    appId: "1:627012765686:web:41178983d00eb37fd029d7"
  };
  var COL = "gwasuwonpiece_applications";

  /* ── 카카오 알림(사장님에게 "나에게 보내기") ──
     kakao-notify/설정법.md 대로 Google Apps Script를 배포한 뒤,
     여기 배포된 웹앱 URL만 붙여넣으면 신청이 들어올 때마다 카톡으로 온다.
     비워두면(기본값) 아무 일도 안 하고 조용히 넘어간다 — 신청 자체는 이 값과 무관하게 항상 정상 저장됨. */
  var KAKAO_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyU9PKs_J3ObrkRQ2AQr3jGLONxq6T_VIB0LnIkSBNAC42dRcyPIk2EjXmRUIJG5qyWoA/exec";

  var db = null;
  try {
    if (window.firebase && window.firebase.initializeApp) {
      var app = (window.firebase.apps && window.firebase.apps.length)
        ? window.firebase.app() : window.firebase.initializeApp(FIREBASE);
      db = window.firebase.firestore(app);
    }
  } catch (e) { db = null; }

  /* ── 날짜 ── */
  var WD = ["일","월","화","수","목","금","토"];
  function parse(v){ return new Date(String(v).replace(" ", "T")); }
  function fmtDate(v){
    var d = parse(v);
    return (d.getMonth()+1) + "월 " + d.getDate() + "일(" + WD[d.getDay()] + ")";
  }
  function fmtTime(v){
    var d = parse(v), h = d.getHours(), m = d.getMinutes();
    var ampm = h < 12 ? "오전" : "오후";
    var hh = h % 12; if (hh === 0) hh = 12;
    return ampm + " " + hh + "시" + (m ? " " + m + "분" : "");
  }
  function fmtFull(v){ return fmtDate(v) + " " + fmtTime(v); }

  /* 접수 창 상태: "before" | "open" | "closed" */
  function windowState(key){
    var sc = SCHEDULE[key], now = Date.now();
    if (now < parse(sc.open).getTime())  return "before";
    if (now > parse(sc.close).getTime()) return "closed";
    return "open";
  }

  /* 오픈까지 남은 시간 문구 (없으면 빈 문자열) */
  function untilText(key){
    var ms = parse(SCHEDULE[key].open).getTime() - Date.now();
    if (ms <= 0) return "";
    var m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d > 0) return "오픈까지 " + d + "일 " + (h % 24) + "시간";
    if (h > 0) return "오픈까지 " + h + "시간 " + (m % 60) + "분";
    return "오픈까지 " + Math.max(1, m) + "분";
  }

  /* ── 전화번호 ── */
  function normPhone(p){ return String(p||"").replace(/[^0-9]/g,""); }
  function validPhone(p){
    var n = normPhone(p);
    return n.length >= 10 && n.length <= 11 && n.indexOf("01") === 0;
  }

  /* ── 검증 ── */
  function fieldOf(el){ return el.closest(".f") || el.closest(".agree"); }

  function check(form, rules){
    var firstBad = null;
    rules.forEach(function(r){
      var nm = r[0], kind = r[1], ok = true, el;
      if (kind === "radio" || kind === "check") {
        var list = form.querySelectorAll('[name="'+nm+'"]');
        el = list[0];
        ok = Array.prototype.some.call(list, function(x){ return x.checked; });
        var box = fieldOf(el);
        if (box) box.classList.toggle("invalid", !ok);
      } else {
        el = form.querySelector('[name="'+nm+'"]');
        var v = (el.value || "").trim();
        ok = (kind === "phone") ? validPhone(v) : v.length > 0;
        var b2 = fieldOf(el);
        if (b2) b2.classList.toggle("invalid", !ok);
        el.classList.toggle("bad", !ok);
      }
      if (!ok && !firstBad) firstBad = el;
    });
    if (firstBad) {
      (fieldOf(firstBad) || firstBad).scrollIntoView({ behavior:"smooth", block:"center" });
      try { firstBad.focus({ preventScroll:true }); } catch (e) {}
    }
    return !firstBad;
  }

  /* 입력을 고치면 오류 표시 해제 */
  function liveClear(form){
    ["input","change"].forEach(function(ev){
      form.addEventListener(ev, function(e){
        var box = fieldOf(e.target);
        if (box) box.classList.remove("invalid");
        if (e.target.classList) e.target.classList.remove("bad");
      });
    });
  }

  /* ── 접수번호 ── */
  function receipt(type, phone){
    var prefix = { booth:"B", stage:"S", bus:"T" }[type] || "A";
    return prefix + "-" + normPhone(phone).slice(-4) + "-" +
           Date.now().toString(36).slice(-3).toUpperCase();
  }

  /* ── 무대 정원 세기 ──
     slot === "wait" 인 건은 대기, 그 외는 확정 자리를 차지한다.
     관리자가 미선정(rejected) 처리한 건은 자리를 비워준다. */
  function countStage(){
    if (!db) return Promise.reject(new Error("no-db"));
    return db.collection(COL).where("type","==","stage").get().then(function(snap){
      var main = 0, wait = 0;
      snap.forEach(function(d){
        var r = d.data() || {};
        if (r.status === "rejected") return;
        if (r.slot === "wait") wait++; else main++;
      });
      return { main: main, wait: wait, limit: STAGE_LIMIT };
    });
  }

  /* ── 버스 좌석 세기 ── 반려(rejected) 건은 빼고, 같은 번호 재신청은 본인 건을 빼고 센다 */
  function countBus(exceptId){
    if (!db) return Promise.reject(new Error("no-db"));
    return db.collection(COL).where("type","==","bus").get().then(function(snap){
      var taken = 0;
      snap.forEach(function(d){
        var r = d.data() || {};
        if (r.status === "rejected" || d.id === exceptId) return;
        taken += Number(r.people) || 1;
      });
      return { taken: taken, left: Math.max(0, BUS_LIMIT - taken), limit: BUS_LIMIT };
    });
  }

  /* ── 행사까지 D-day ── */
  function dday(){
    var t = new Date(EVENT_DAY + "T00:00:00");
    var n = new Date();
    var today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    var d = Math.round((t - today) / 86400000);
    if (d > 0)   return { n: d, text: d + "일 남음" };
    if (d === 0) return { n: 0, text: "오늘!" };
    return { n: d, text: "행사 종료" };
  }

  /* 화면의 [data-dday] 자리에 D-day 를 채운다 */
  function paintDday(){
    var v = dday();
    document.querySelectorAll("[data-dday]").forEach(function(e){
      e.textContent = v.text;
    });
  }

  /* 오픈까지 남은 일수 (D-n 형태) */
  function openDday(key){
    var t = parse(SCHEDULE[key].open);
    var n = new Date();
    var a = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    var b = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    var d = Math.round((a - b) / 86400000);
    return d > 0 ? "D-" + d : "오늘";
  }

  /* ── 중복 신청 막기 ──
     문서 ID가 type_전화번호라 같은 번호는 원래 한 건으로 덮이지만, "안 된 줄 알고" 다시 누르면
     상태(선정)·접수번호·접수시각이 새 값으로 초기화되고 알림도 또 갔다.
     → 이미 있으면 멈추고 알려준 뒤, "내용 고쳐서 다시 내기"를 눌렀을 때만 덮는다(상태·번호·시각은 유지). */
  function mineKey(type){ return "gwasu_apply_" + type; }
  function remember(type, data){
    try { localStorage.setItem(mineKey(type), JSON.stringify({ code: data.code, at: data.createdAt })); } catch (e) {}
  }
  function recall(type){
    try { return JSON.parse(localStorage.getItem(mineKey(type)) || "null"); } catch (e) { return null; }
  }
  function whenTxt(iso){
    var d = new Date(iso); if (isNaN(d)) return "";
    return (d.getMonth()+1) + "월 " + d.getDate() + "일 " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
  }
  function guard(type, data, form){
    return db.collection(COL).doc(type + "_" + data.phone).get().then(function(s){
      var prev = s.exists ? (s.data() || {}) : null;
      if (!prev) return null;
      if (!form._editOk) throw { dup: prev };
      data.status    = prev.status || "pending";
      data.createdAt = prev.createdAt || data.createdAt;
      data.code      = prev.code || data.code;
      data.updatedAt = new Date().toISOString();
      data.edited    = true;
      return prev;
    });
  }
  /* 이미 신청한 경우 안내 + 수정 버튼. resubmit: 버튼 눌렀을 때 다시 제출할 함수 */
  function showDup(msg, prev, form){
    msg.innerHTML = "<b>이미 접수된 신청이 있어요.</b> " +
      (prev.createdAt ? whenTxt(prev.createdAt) + " 접수" : "") +
      (prev.code ? " · 접수번호 <b>" + prev.code + "</b>" : "") +
      "<br>다시 신청하지 않으셔도 됩니다. 내용을 바꾸려는 경우에만 아래 버튼을 눌러 주세요." +
      '<br><button type="button" class="dup-edit" style="margin-top:10px;font:inherit;padding:8px 14px;border:1px solid currentColor;background:transparent;border-radius:4px;cursor:pointer">내용 고쳐서 다시 내기</button>';
    msg.classList.add("show");
    msg.querySelector(".dup-edit").addEventListener("click", function(){
      form._editOk = true;
      if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event("submit", { cancelable: true }));
    });
  }
  /* 이 폰에서 이미 낸 적이 있으면 폼 위에 알려준다 */
  function paintMine(type, form){
    var m = recall(type); if (!m || !form) return;
    var b = document.createElement("div");
    b.className = "form-msg show";
    b.style.cssText = "margin:0 0 16px;border:1px solid currentColor";
    b.innerHTML = "이 폰에서 이미 신청하셨어요" + (m.at ? " (" + whenTxt(m.at) + ")" : "") +
      (m.code ? " · 접수번호 <b>" + m.code + "</b>" : "") + ". 다시 내지 않으셔도 됩니다.";
    form.insertBefore(b, form.firstChild);
  }

  function el(id){ return document.getElementById(id); }
  function show(id){ var e = el(id); if (e) e.classList.add("on"); }
  function hide(id){ var e = el(id); if (e) e.classList.remove("on"); }

  /* 신청 성공 직후 호출 — 실패해도(오프라인 등) 신청 자체엔 영향 없도록 조용히 무시한다. */
  function notify(data){
    if (!KAKAO_WEBHOOK_URL) return;
    if (data && data.edited) data = Object.assign({}, data, { name: "[수정] " + (data.name || "") });
    try {
      fetch(KAKAO_WEBHOOK_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(data)
      }).catch(function(){});
    } catch (e) {}
  }

  return {
    db: db, COL: COL, SCHEDULE: SCHEDULE, STAGE_LIMIT: STAGE_LIMIT, BUS_LIMIT: BUS_LIMIT, countBus: countBus,
    guard: guard, showDup: showDup, remember: remember, paintMine: paintMine,
    fmtDate: fmtDate, fmtTime: fmtTime, fmtFull: fmtFull,
    windowState: windowState, untilText: untilText,
    dday: dday, paintDday: paintDday, openDday: openDday,
    normPhone: normPhone, validPhone: validPhone,
    check: check, liveClear: liveClear, receipt: receipt,
    countStage: countStage,
    el: el, show: show, hide: hide, notify: notify,
    netErr: function(){
      return "접수가 되지 않았습니다. 인터넷 연결을 확인하고 다시 눌러 주세요. " +
        "계속 안 되면 <a href='https://litt.ly/psb_jeju' target='_blank' rel='noopener'>박서방 제주지점 SNS</a>로 " +
        "DM 주시거나 <a href='tel:064-742-0083'>064-742-0083</a>으로 전화 주시면 직접 접수해 드립니다.";
    }
  };
})();
