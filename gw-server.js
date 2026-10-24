/* 과수원피스 전용 서버(psb-gwasuwon) 연결 설정 — ev-client.js 보다 먼저 불러온다.
   사전 신청 페이지들만 이 서버를 쓴다. 쿠지(가게) 서버 psbjeju-kuji 는 쓰지 않는다.
   로그인 세션도 다른 서버와 섞이지 않게 키를 따로 쓴다. (Firebase 웹 설정값은 공개돼도 되는 값) */
window.EV_FB = {
  apiKey: 'AIzaSyBGt_Ue9DoI0DWDYwLtDlYdJTZrSer6aUM',
  authDomain: 'psb-gwasuwon.firebaseapp.com',
  projectId: 'psb-gwasuwon',
  appId: '1:468654844058:web:b8cfd7919f5843455dd723'
};
window.EV_SESSION_KEY = 'gw.staffSession';
