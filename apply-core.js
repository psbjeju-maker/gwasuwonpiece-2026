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
      close:  "2026-10-05T23:59",
      result: "10월 10일(금)까지"
    },
    stage: {
      open:   "2026-10-01T20:00",   // 10월 1일 오후 8시
      close:  "2026-10-24T23:59"
    }
  };

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
    var prefix = { booth:"B", stage:"S" }[type] || "A";
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

  function el(id){ return document.getElementById(id); }
  function show(id){ var e = el(id); if (e) e.classList.add("on"); }
  function hide(id){ var e = el(id); if (e) e.classList.remove("on"); }

  /* 신청 성공 직후 호출 — 실패해도(오프라인 등) 신청 자체엔 영향 없도록 조용히 무시한다. */
  function notify(data){
    if (!KAKAO_WEBHOOK_URL) return;
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
    db: db, COL: COL, SCHEDULE: SCHEDULE, STAGE_LIMIT: STAGE_LIMIT,
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
