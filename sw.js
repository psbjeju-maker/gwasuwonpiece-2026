/* 오프라인 대응 — 한 번 열어두면 신호가 없어도 QR이 열리고 채점까지 된다. */
var CACHE = "ggg-v13";
var FILES = [
  "./", "./index.html", "./style.css", "./data.js", "./store.js", "./app.js", "./gold.png", "./map.jpg",
  "./guide.html",
  "./icons/ic_home.png", "./icons/ic_progress.png", "./icons/ic_rewards.png",
  "./icons/ic_market.png", "./icons/ic_mission.png", "./icons/ic_treasure.png",
  "./icons/ic_cosplay.png", "./icons/ic_photo.png", "./icons/ic_stage.png",
  "./captain/exp_default.jpg", "./captain/exp_happy.jpg", "./captain/exp_smile.jpg",
  "./captain/exp_wink.jpg", "./captain/exp_think.jpg", "./captain/exp_fighting.jpg",
  "./captain/exp_found.jpg", "./captain/exp_surprise.jpg", "./captain/exp_search.jpg",
  "./captain/exp_tease.jpg", "./captain/exp_sulk.jpg", "./captain/exp_warn.jpg",
  "./audio/opening.mp3", "./audio/ocean.mp3",
  "./captain/full_body.jpg"
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
