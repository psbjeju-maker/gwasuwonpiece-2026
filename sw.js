/* 오프라인 대응 — 한 번 열어두면 신호가 없어도 QR이 열리고 채점까지 된다. */
var CACHE = "ggg-v23";
var FILES = [
  "./", "./index.html", "./style.css", "./data.js", "./assets.js", "./store.js", "./app.js", "./map.jpg",
  "./guide.html",
  "./fonts/SCDream4.woff", "./fonts/SCDream5.woff", "./fonts/SCDream7.woff",
  /* 2026-09-28 디자인 팩(AI 시안) — 정식 작화로 바꿔도 같은 파일명이면 이 목록은 그대로 */
  "./assets/characters/full_body.png", "./assets/characters/neutral.png", "./assets/characters/greeting.png",
  "./assets/characters/thinking.png", "./assets/characters/surprised.png",
  "./assets/characters/disappointed.png", "./assets/characters/success.png",
  "./assets/icons/home.png", "./assets/icons/mission.png", "./assets/icons/map.png",
  "./assets/icons/compass.png", "./assets/icons/ticket.png", "./assets/icons/vote.png",
  "./assets/icons/camera.png", "./assets/icons/shop.png", "./assets/icons/golden_tangerine.png",
  "./assets/icons/clue.png", "./assets/icons/treasure_chest.png", "./assets/icons/trophy.png",
  "./audio/opening.mp3", "./audio/ocean.mp3"
];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* 네트워크 우선, 실패하면 캐시. 쿼리(?q=A01)가 붙어도 index.html 로 응답한다. */
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  e.respondWith(
    fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        if (req.mode === "navigate") return caches.match("./index.html");
        return new Response("", { status: 504 });
      });
    })
  );
});
