/* ============================================================
   과수원피스 — 중앙 에셋 매핑 + NPC 대사
   ------------------------------------------------------------
   지금 들어있는 PNG는 디자인 팩(2026-09-28)의 AI 시안이다(개발 미리보기용).
   작가 정식 이미지가 오면 assets/ 안의 같은 파일명·같은 캔버스 규격(표정·아이콘
   512×512, 전신 1024×1536)으로 덮어쓰기만 하면 된다. 경로가 바뀌면 BASE만 고친다.
   ============================================================ */
window.ASSETS = (function () {
  var BASE = "assets/";

  var NPC_NAME = "항해 기록관";   // 이름 확정 전 임시 표기

  var CHAR = {
    full_body:    BASE + "characters/full_body.png",
    neutral:      BASE + "characters/neutral.png",
    greeting:     BASE + "characters/greeting.png",
    thinking:     BASE + "characters/thinking.png",
    surprised:    BASE + "characters/surprised.png",
    disappointed: BASE + "characters/disappointed.png",
    success:      BASE + "characters/success.png"
  };

  /* 표정마다 여백·자세가 조금씩 달라서 눈높이를 맞추는 보정값(같은 슬롯 기준).
     정식 작화로 바뀌면 여기 값만 다시 맞춘다. */
  var CHAR_FIX = {
    neutral: "", greeting: "", thinking: "", surprised: "", disappointed: "", success: ""
  };

  var ICON = {
    home: "icons/home.png", mission: "icons/mission.png", map: "icons/map.png",
    compass: "icons/compass.png", ticket: "icons/ticket.png", vote: "icons/vote.png",
    camera: "icons/camera.png", shop: "icons/shop.png",
    golden_tangerine: "icons/golden_tangerine.png", clue: "icons/clue.png",
    treasure_chest: "icons/treasure_chest.png", trophy: "icons/trophy.png"
  };
  Object.keys(ICON).forEach(function (k) { ICON[k] = BASE + ICON[k]; });

  /* 예전 귤선장 이미지 경로 → 새 표정. data.js나 관리자 화면에 옛 값이 남아 있어도
     깨지지 않게 여기서 한 번에 바꿔 준다. */
  var LEGACY = {
    "captain/full_body.jpg": "full_body",
    "captain/exp_default.jpg": "neutral",
    "captain/exp_smile.jpg": "neutral",
    "captain/exp_wink.jpg": "greeting",
    "captain/exp_search.jpg": "thinking",
    "captain/exp_happy.jpg": "success",
    "captain/exp_found.jpg": "success",
    "captain/exp_fighting.jpg": "greeting",
    "captain/exp_tease.jpg": "greeting",
    "captain/exp_think.jpg": "thinking",
    "captain/exp_warn.jpg": "thinking",
    "captain/exp_surprise.jpg": "surprised",
    "captain/exp_sulk.jpg": "disappointed"
  };

  /* "neutral" 같은 표정 키, 옛 captain/ 경로, 새 PNG 경로 무엇이 와도 표정 키로 돌려준다 */
  function exprKey(v) {
    if (!v) return "neutral";
    if (CHAR[v]) return v;
    if (LEGACY[v]) return LEGACY[v];
    for (var k in CHAR) if (CHAR[k] === v) return k;
    return "neutral";
  }
  function charSrc(v) { return CHAR[exprKey(v)]; }

  /* 표정 6개는 대화가 뜨기 전에 미리 받아 둔다(전신은 필요한 화면에서만) */
  function preloadExpressions() {
    ["neutral", "greeting", "thinking", "surprised", "disappointed", "success"].forEach(function (k) {
      var im = new Image(); im.src = CHAR[k];
    });
  }

  /* 상황별 대사 — 디자인 지시서 §6 표 그대로. {nickname} 같은 자리는 app.js가 채운다. */
  var LINES = {
    firstVisit:      { expr: "greeting",     text: "왔구나! 네 이름부터 항해일지에 적어 둘게.",              btn: "항해일지 작성" },
    registered:      { expr: "neutral",      text: "{nickname}, 준비됐지? 오늘의 모험을 시작해 보자.",       btn: "모험 시작하기" },
    revisit:         { expr: "greeting",     text: "다시 왔네! 이어서 모험해 볼까?",                        btn: "이어서 하기" },
    missionGuide:    { expr: "neutral",      text: "마음에 드는 미션부터 골라 봐. 완료 확인은 현장 스태프에게 부탁해 줘.", btn: "미션 보기" },
    waiting:         { expr: "thinking",     text: "확인을 기다리고 있어. 완료되면 기록에 반영할게.",         btn: "확인" },
    missionDone:     { expr: "success",      text: "해냈네! 항해일지에 기록했어.",                          btn: "계속하기" },
    treasureGuide:   { expr: "thinking",     text: "나침반으로 다음 단서를 확인해 봐. 가까이 가면 다시 알려줄게.", btn: "나침반 보기" },
    needLocation:    { expr: "neutral",      text: "주변 단서를 찾으려면 현재 위치가 필요해.",               btn: "위치 허용하기" },
    locating:        { expr: "thinking",     text: "아직 위치를 확인하고 있어. 잠시 뒤 다시 확인해 줘.",      btn: "다시 확인" },
    clueFound:       { expr: "surprised",    text: "찾았다! 다음 단서도 확인해 보자.",                      btn: "단서 확인" },
    clueAlready:     { expr: "neutral",      text: "이 단서는 이미 기록해 뒀어. 다음 장소로 가 볼까?",        btn: "나침반 보기" },
    wrongFinal:      { expr: "disappointed", text: "조금 아쉬워! 모은 단서를 다시 살펴보자.",                btn: "다시 도전" },
    needPass:        { expr: "neutral",      text: "이 모험은 패스가 필요해. 안내를 확인해 줘.",             btn: "패스 안내" },
    voteSaved:       { expr: "success",      text: "네 선택을 기록했어. 참여해 줘서 고마워!",                btn: "확인" },
    finalDone:       { expr: "success",      text: "보물을 찾아냈어! 수령 코드를 스태프에게 보여주면 돼.",     btn: "수령 코드 보기" },
    coinGot:         { expr: "success",      text: "코인을 받았어! 쿠지에서 써 봐.",                        btn: "계속하기" },
    kujiOpen:        { expr: "greeting",     text: "코인이 모이면 디지털 쿠지에 도전해 봐. 결과는 바로 보여줄게.", btn: "쿠지 하기" },
    saveFailed:      { expr: "thinking",     text: "기록을 저장하지 못했어. 연결을 확인하고 다시 시도해 줘.",  btn: "다시 시도" }
  };

  return {
    BASE: BASE, NPC_NAME: NPC_NAME, CHAR: CHAR, CHAR_FIX: CHAR_FIX, ICON: ICON,
    LINES: LINES, exprKey: exprKey, charSrc: charSrc, preloadExpressions: preloadExpressions
  };
})();
