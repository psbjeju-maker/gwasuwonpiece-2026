/* ============================================================
   탐라문화제 연계 홍보 —「선원 수배령 WANTED」 설정 파일
   ------------------------------------------------------------
   여기 값만 고치면 앱 내용이 바뀐다. 코드는 건드릴 필요 없음.
   ============================================================ */

window.TAMNA = {

  /* ---------- 기본 ---------- */
  title: "선원 수배령",
  subtitle: "탐라문화제 × 과수원피스",
  festivalName: "탐라문화제",
  festivalDates: "2026.10.17(금) ~ 10.21(화)",
  boothName: "메이커앤하비 · 박서방 부스",
  boothWhere: "(부스 위치 확정되면 여기 적기)",

  /* 본편 행사 */
  mainEventName: "과수원피스 STAMPEDE",
  mainEventDate: "2026-10-31T10:00:00+09:00",
  mainEventPlace: "금능석물원",
  drawTime: "10월 31일(토) 15:30",
  preorderUrl: "https://psbjeju-maker.github.io/gwasuwonpiece-2026/apply.html",
  guideUrl: "https://psbjeju-maker.github.io/gwasuwonpiece-2026/guide.html",

  /* ---------- 금화 경제 ---------- */
  gold: {
    crew: 100,          // 선원 1명 발견
    crewAll: 300,       // 6인 전원 체포 보너스
    todayMultiplier: 2, // 오늘의 선원 배수
    photo: 150,         // 4컷 포토 완성 (1일 1회)
    sns: 300,           // SNS 인증 (1일 1회)
    attend: 50,         // 일일 출석
    perfect: 200,       // 5일 개근
    preorder: 500,      // 사전예매 인증
    purchase: 200       // 부스 구매 인증 (1일 1회)
  },

  /* 미니게임 일일 체감 — [횟수 이하, 지급률] */
  gameDecay: [[5, 1.0], [15, 0.4], [9999, 0.1]],
  gameMax: 50,          // 게임 1회 최대 금화

  /* ---------- 승선권 ---------- */
  ticket: {
    name: "승선권",
    cost: 500,
    max: 5
  },

  /* ---------- 수배 선원 6인 ----------
     photo : 이미지 경로 (없으면 실루엣 + 이름 이니셜로 자동 표시)
     code  : 코스어 명찰 QR 에 들어갈 코드. 대소문자 구분 안 함.
     bounty: 현상금(금화). 비우면 gold.crew 사용
     day   : "오늘의 선원"으로 지정되는 날짜 (YYYY-MM-DD)
  */
  crew: [
    { id: "CREW1", name: "선원 1", code: "CREW1", photo: "", desc: "정보 없음 — 목격 시 즉시 촬영할 것", day: "2026-10-17" },
    { id: "CREW2", name: "선원 2", code: "CREW2", photo: "", desc: "정보 없음 — 목격 시 즉시 촬영할 것", day: "2026-10-18" },
    { id: "CREW3", name: "선원 3", code: "CREW3", photo: "", desc: "정보 없음 — 목격 시 즉시 촬영할 것", day: "2026-10-19" },
    { id: "CREW4", name: "선원 4", code: "CREW4", photo: "", desc: "정보 없음 — 목격 시 즉시 촬영할 것", day: "2026-10-20" },
    { id: "CREW5", name: "선원 5", code: "CREW5", photo: "", desc: "정보 없음 — 목격 시 즉시 촬영할 것", day: "2026-10-21" },
    { id: "CREW6", name: "선원 6", code: "CREW6", photo: "", desc: "정보 없음 — 목격 시 즉시 촬영할 것", day: "2026-10-21" }
  ],

  /* ---------- 스태프 확인 코드 (부스에서 스태프가 보여주는 QR) ---------- */
  staffCodes: {
    sns:      "SNS-OK",
    preorder: "PRE-OK",
    purchase: "BUY-OK"
  },

  /* ---------- 프로토타입 모드 ----------
     true 면 QR 없이 화면에서 바로 코드 입력·데모 버튼으로 테스트할 수 있다.
     실제 행사 때는 false 로 바꿀 것. */
  demoMode: true
};
