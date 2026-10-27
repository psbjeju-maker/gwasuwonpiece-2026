# 셀러 쿠지 (대여용) — 과수원피스 서버(psb-gwasuwon) 전용

박서방 쿠지(psbjeju-kuji)와 완전 별개. 이 폴더는 복사본이며 원본 파일은 수정하지 않았다.
입장 번호: **9999** (뽑기 화면 번호도 동일). 상점 ID `seller1`.

## 서버 준비 (한 번만, Firebase 콘솔 psb-gwasuwon)
1. Authentication → 로그인 방법 → **이메일/비밀번호 사용 설정**
2. Authentication → 사용자 추가: `seller1@psb-gwasuwon.web.app` / 비밀번호 `sk-9999` → 생성된 **UID 복사**
3. Firestore → 컬렉션 `shops` → 문서 ID `seller1`
   - name (string) 셀러 쿠지
   - active (boolean) true
   - owners (array) [위 UID]
   - staff (array) []

번호를 바꾸려면 2번 계정 비밀번호를 `sk-새번호`로 바꾸고 draw.html의 DRAW_PIN, config.js UNLOCK_PIN도 같이 바꾼다.
규칙(firestore.rules)은 psb-gwasuwon에 이미 같은 쿠지 규칙이 있어 수정 불필요.

## 열기
game/seller-kuji/make.html (쿠지 만들기) · draw.html (뽑기) · admin.html (관리·정산)
수수료 정산은 admin.html 매출에서 계산.
