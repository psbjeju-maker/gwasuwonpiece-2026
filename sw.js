/* 오프라인 대응 — 한 번 열어두면 신호가 없어도 QR이 열리고 채점까지 된다. */
var CACHE = "ggg-v35";
var FILES = [
  "./", "./index.html", "./style.css", "./data.js", "./assets.js", "./store.js", "./qr.js", "./ev-client.js", "./mhcards.js", "./kujiboard.js", "./seal.js", "./sfx.js", "./app.js", "./catch.js", "./map.jpg",
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
  /* 황금귤 캐치 미션 */
  "./assets/catch-game/orange_small.png", "./assets/catch-game/orange_normal.png", "./assets/catch-game/orange_big.png", "./assets/catch-game/orange_king.png", "./assets/catch-game/orange_gold.png", "./assets/catch-game/orange_legend.png", "./assets/catch-game/orange_rotten.png", "./assets/catch-game/cross_section.png", "./assets/catch-game/juice1.png", "./assets/catch-game/juice2.png", "./assets/catch-game/juice3.png", "./assets/catch-game/juice_rotten.png", "./assets/catch-game/spark_big.png", "./assets/catch-game/spark_small.png", "./assets/catch-game/ring.png", "./assets/catch-game/smoke.png", "./assets/catch-game/deco_wall.png", "./assets/catch-game/deco_fence.png", "./assets/catch-game/deco_rockbush.png", "./assets/catch-game/deco_grass1.png", "./assets/catch-game/deco_grass2.png", "./assets/catch-game/deco_rocks.png", "./assets/catch-game/deco_sign.png", "./assets/catch-game/deco_blossom.png", "./assets/catch-game/cloud1.png", "./assets/catch-game/cloud2.png", "./assets/catch-game/leaf1.png", "./assets/catch-game/leaf2.png", "./assets/catch-game/chest.png", "./assets/catch-game/glow.png",
  "./sfx/slice.mp3", "./sfx/pop.mp3", "./sfx/boom.mp3", "./sfx/bonus.mp3", "./sfx/fanfare.mp3",
  "./audio/opening.mp3", "./audio/ocean.mp3",
  /* mh머니 트럼프 카드 */
  "./assets/cards/back.webp", "./assets/cards/H1.webp", "./assets/cards/H2.webp", "./assets/cards/H3.webp", "./assets/cards/H4.webp", "./assets/cards/H5.webp", "./assets/cards/H6.webp", "./assets/cards/H7.webp", "./assets/cards/H8.webp", "./assets/cards/H9.webp", "./assets/cards/H10.webp", "./assets/cards/H11.webp", "./assets/cards/H12.webp", "./assets/cards/H13.webp",
  "./assets/sfx/reveal_low.mp3", "./assets/sfx/reveal_mid.mp3", "./assets/sfx/reveal_top.mp3", "./assets/sfx/reveal_rainbow.mp3", "./assets/sfx/ui_confirm.mp3", "./assets/sfx/ui_select.mp3"
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
