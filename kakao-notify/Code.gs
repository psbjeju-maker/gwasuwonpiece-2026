/* ══════════════════════════════════════════════════════════════
   과수원피스 부스/무대 신청 → 카카오톡 "나에게 보내기" 알림
   Google Apps Script (script.google.com) 에 붙여넣고 웹앱으로 배포한다.
   자세한 순서는 같은 폴더의 "설정법.md" 참고.
   ══════════════════════════════════════════════════════════════ */

/* apply-core.js 가 신청 성공 직후 이 웹앱 URL로 POST 요청을 보낸다. */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    sendKakaoToMe(buildMessage(data));
  } catch (err) {
    // 알림 실패는 신청 자체와 무관하니 조용히 넘어간다. 필요하면 아래 줄 주석 풀고 로그 확인.
    // Logger.log(String(err));
  }
  return ContentService.createTextOutput("ok");
}

function buildMessage(d) {
  var typeLabel = d.type === "stage" ? "🎤 무대 신청" : "🏴 부스 신청";
  var lines = [typeLabel + " 도착!"];
  lines.push((d.teamName || d.name || "이름 없음"));
  if (d.name && d.teamName) lines.push("대표자: " + d.name);
  if (d.zone) lines.push("존: " + d.zone);
  if (d.tables) lines.push("테이블: " + d.tables + "개");
  if (d.genre) lines.push("종목: " + d.genre);
  if (d.phone) lines.push("연락처: " + d.phone);
  if (d.code) lines.push("접수번호: " + d.code);
  return lines.join("\n");
}

/* ---------- 카카오 "나에게 보내기" ---------- */
function sendKakaoToMe(text) {
  var accessToken = getAccessToken_();
  var templateObject = {
    object_type: "text",
    text: text,
    link: {
      web_url: "https://psbjeju-maker.github.io/gwasuwonpiece-2026/admin.html",
      mobile_web_url: "https://psbjeju-maker.github.io/gwasuwonpiece-2026/admin.html"
    }
  };
  UrlFetchApp.fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
    method: "post",
    headers: { Authorization: "Bearer " + accessToken },
    payload: { template_object: JSON.stringify(templateObject) },
    muteHttpExceptions: true
  });
}

function getAccessToken_() {
  var props = PropertiesService.getScriptProperties();
  var restKey = props.getProperty("KAKAO_REST_KEY");
  var refreshToken = props.getProperty("KAKAO_REFRESH_TOKEN");
  var res = UrlFetchApp.fetch("https://kauth.kakao.com/oauth/token", {
    method: "post",
    payload: {
      grant_type: "refresh_token",
      client_id: restKey,
      refresh_token: refreshToken
    },
    muteHttpExceptions: true
  });
  var json = JSON.parse(res.getContentText());
  if (json.error) throw new Error("카카오 토큰 갱신 실패: " + JSON.stringify(json));
  if (json.refresh_token) {
    // 카카오가 가끔 새 refresh_token을 같이 내려준다 — 받으면 갱신해서 저장.
    props.setProperty("KAKAO_REFRESH_TOKEN", json.refresh_token);
  }
  return json.access_token;
}

/* ---------- 최초 설정 1회용 ----------
   "설정법.md"의 3단계에서 받은 인가코드(code)를 아래 함수 실행으로 refresh token으로
   바꿔서 저장한다. REST_KEY / REDIRECT_URI / AUTH_CODE를 채운 뒤
   Apps Script 편집기에서 이 함수만 선택해서 "실행" 누르면 된다(딱 한 번만). */
function 최초설정_실행하세요() {
  var REST_KEY     = "여기에 카카오 REST API 키";
  var REDIRECT_URI = "https://developers.kakao.com/tool/demo/oauth"; // 설정법.md 2단계에서 등록한 것과 동일해야 함
  var AUTH_CODE    = "여기에 3단계에서 받은 인가코드(code=... 뒷부분)";

  var res = UrlFetchApp.fetch("https://kauth.kakao.com/oauth/token", {
    method: "post",
    payload: {
      grant_type: "authorization_code",
      client_id: REST_KEY,
      redirect_uri: REDIRECT_URI,
      code: AUTH_CODE
    },
    muteHttpExceptions: true
  });
  var json = JSON.parse(res.getContentText());
  Logger.log(json); // 실행 후 "실행 기록"에서 결과 확인

  if (json.error) {
    Logger.log("실패 — 인가코드가 만료됐을 수 있음(10분 이내 유효). 설정법.md 3단계부터 다시.");
    return;
  }
  var props = PropertiesService.getScriptProperties();
  props.setProperty("KAKAO_REST_KEY", REST_KEY);
  props.setProperty("KAKAO_REFRESH_TOKEN", json.refresh_token);
  Logger.log("저장 완료! 이제 testSend() 함수를 실행해서 카톡이 오는지 확인해 보세요.");
}

/* 설정이 잘 됐는지 확인용 — 실행하면 내 카톡에 테스트 메시지가 온다. */
function testSend() {
  sendKakaoToMe("✅ 과수원피스 알림 설정 테스트입니다. 이 메시지가 보이면 성공!");
}
