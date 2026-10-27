/* 박서방 제주지점 디지털 쿠지 — 접속 설정

   ⚠️ apiKey 는 비밀번호가 아니다. Firebase 웹 설정값은 원래 브라우저에 공개되는 값이고,
      실제 보안은 firestore.rules 가 담당한다. 이 파일이 유출돼도 규칙이 막는다. */

export const FB_CONFIG = {
  apiKey: "AIzaSyBGt_Ue9DoI0DWDYwLtDlYdJTZrSer6aUM",
  authDomain: "psb-gwasuwon.firebaseapp.com",
  projectId: "psb-gwasuwon",
  appId: "1:468654844058:web:b8cfd7919f5843455dd723"
};

/* 매장. 지금은 제주지점 하나뿐이지만 문서 구조는 여러 매장을 받을 수 있게 해뒀다
   (질문지 Q38 "다른 지점 확장 여부 — 아직 모르겠음") */
export const SHOP_ID = 'seller1';

/* shops/{shopId} 문서는 로그인해야 읽을 수 있다(직원 명단이 들어있어서).
   손님용 현황판(board.html)은 로그인이 없으므로 매장 이름을 여기 따로 박아둔다.
   비밀도 아니고(간판에 이미 적혀 있다) 자주 안 바뀌니 상수로 충분하다. */
export const SHOP_NAME = '셀러 쿠지';

/* 대여용 — 번호(PIN) 하나로 입장한다. 번호는 계정 비밀번호 'sk-번호' 로 변환돼 서버가 직접 확인한다. */
export const SELLER_EMAIL = 'seller1@psb-gwasuwon.web.app';

/* Firebase Hosting 배포 전, 매장 PC(serve.py)에서 열 때 쓰는 사설 IP.
   인쇄물 QR 이 이 주소를 담아야 같은 와이파이의 손님 폰에서 실제로 열린다.
   ⚠️ location.origin 을 그대로 쓰면 "localhost"가 그대로 QR 에 박혀서
   폰이 자기 자신을 가리키게 된다 — 찍어도 절대 안 열린다(2026-08-14 실사용 중 발견).
   배포 뒤에는 이 값 자체가 필요 없어진다(퍼블릭 origin 이 항상 맞으므로). */
export const LAN_FALLBACK = 'http://192.168.219.200:8000';

/* 로그인은 진짜 이메일 주소로 한다 (사장님 계정 = psbjeju@makernhobby.com).
   가짜 도메인을 쓰면 비밀번호를 잊었을 때 되찾을 방법이 없다.
   매장 태블릿은 한 번 로그인하면 계속 유지되므로 매번 칠 일도 없다. */
export const LOGIN_HINT = 'seller1@psb-gwasuwon.web.app';

/* 손님 모드(화면 잠금) 풀 때 쓰는 번호. 로그인 비밀번호와는 다르다 — 이건 진짜
   보안 경계가 아니라 "직원이 한 번 더 확인했다"는 절차용이다(실제 보안은
   Firestore 규칙이 담당하고, 이 화면은 이미 로그인된 채로 잠겨 있을 뿐이다).
   매장에서 하루에도 몇 번씩 치니 계정 비밀번호보다 짧고 외우기 쉬운 걸로 둔다. */
export const UNLOCK_PIN = '9999';

/* 상품 사진은 Firestore 문서에 직접 담는다.
   Firebase Storage 는 카드 등록(Blaze)을 요구해서 안 쓴다.
   문서 한도가 1MB 라 가로·세로 긴 쪽을 800px 로 줄이고 여유를 둬 상한을 건다.
   ⚠️ 픽셀이 크면 구형 폰 브라우저가 캔버스에서 죽는다. 그래서 크기를 코드로 강제한다. */
export const PHOTO_MAX_PX = 800;
export const PHOTO_MAX_BYTES = 900000;
export const BANNER_MAX_PX = 1600;   // 판 배너는 A3 인쇄까지 가므로 크게

/* 배경음악도 같은 이유(Storage 는 Blaze 요구)로 Firestore 문서에 통째로 담는다.
   사진과 달리 오디오는 화면에서 다시 압축할 방법이 없어서, 파일 그대로
   base64 로 넣었을 때 문서 한도(1MB)를 넘기면 그냥 거절하고 사장님이
   직접 짧은 루프·저비트레이트로 줄여 다시 올리게 안내한다. */
export const AUDIO_MAX_BYTES = 900000;

export const COL = {
  shops: 'shops',
  sets:  'sets',
  draws: 'draws',
  images: 'images',   // sets/{setId}/images/{tierKey}
  vault:  'vault',    // sets/{setId}/vault/{seal|cost}
  audio:  'audio'     // shops/{shopId}/audio/bgm
};
