/* ============================================================
   탐라 신 실시간 위치 — 공용 모듈 (스태프 페이지 + 참가자 앱이 같이 씀)
   ------------------------------------------------------------
   설계 원칙: 이력을 쌓지 않는다. 컬렉션엔 신 6명 문서 6개뿐이고, 매번
   "최신 값"으로 덮어쓴다. 정확한 좌표는 스태프 폰 안에서만 존재하고,
   여기 fuzz()를 거친 흐려진 값만 서버로 나간다.
   firebase-app-compat.js + firebase-firestore-compat.js + config.js가
   먼저 로드돼 있어야 한다. 로딩 실패/오프라인이면 db는 null로 남고
   모든 함수가 조용히 실패(false/빈 값)한다 — 이 기능이 없어도 앱의
   나머지 부분은 정상 동작해야 한다. */
window.TamnaLive = (function () {
  var C = window.TAMNA;
  var db = null;
  try {
    if (C.firebase && window.firebase && window.firebase.initializeApp) {
      var app = (window.firebase.apps && window.firebase.apps.length)
        ? window.firebase.app() : window.firebase.initializeApp(C.firebase);
      db = window.firebase.firestore(app);
    }
  } catch (e) { db = null; }

  var COL = (C.liveLocation && C.liveLocation.collection) || "tamna_gods_live";

  /* 진짜 좌표(lat,lng)를 반경 meters 안에서 무작위로 흐린다.
     면적 균등 분포가 되도록 sqrt(random)으로 반지름을 뽑는다. */
  function fuzz(lat, lng, meters) {
    var r = meters * Math.sqrt(Math.random());
    var theta = Math.random() * 2 * Math.PI;
    var dLat = (r * Math.cos(theta)) / 111320;
    var dLng = (r * Math.sin(theta)) / (111320 * Math.cos(lat * Math.PI / 180) || 1);
    return { lat: lat + dLat, lng: lng + dLng };
  }

  function toRad(d) { return d * Math.PI / 180; }
  function toDeg(r) { return r * 180 / Math.PI; }

  function distanceM(lat1, lng1, lat2, lng2) {
    var R = 6371000;
    var dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function bearingDeg(lat1, lng1, lat2, lng2) {
    var y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
    var x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }
  var DIRS = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
  function dirLabel(deg) { return DIRS[Math.round(deg / 45) % 8]; }
  function fmtDist(m) {
    if (m < 30) return "바로 근처";
    if (m < 1000) return Math.round(m / 10) * 10 + "m";
    return (m / 1000).toFixed(1) + "km";
  }

  /* 스태프 폰이 부른다. active=false면 lat/lng을 null로 덮어써서 지운다. */
  function setLive(godId, lat, lng, active, extra) {
    if (!db) return Promise.resolve(false);
    var data = { active: !!active, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() };
    if (extra) for (var k in extra) data[k] = extra[k];
    if (active) { data.lat = lat; data.lng = lng; } else { data.lat = null; data.lng = null; }
    return db.collection(COL).doc(godId).set(data, { merge: true })
      .then(function () { return true }).catch(function () { return false });
  }

  /* 참가자 앱이 부른다 — 신 6명 문서를 한 번에 읽는다. */
  function getAll() {
    if (!db) return Promise.resolve({});
    return db.collection(COL).get().then(function (snap) {
      var out = {};
      snap.forEach(function (d) { out[d.id] = d.data(); });
      return out;
    }).catch(function () { return {}; });
  }

  /* 스태프 페이지의 "전체 초기화" — 신 6명 문서를 전부 비활성화+null로 덮어쓴다.
     delete 권한은 아예 안 열어뒀다(규칙 참고) — update만으로 충분히 지워진다. */
  function clearAll() {
    if (!db || !window.firebase.firestore.FieldValue) return Promise.resolve(false);
    var batch = db.batch();
    (C.crew || []).forEach(function (c) {
      batch.set(db.collection(COL).doc(c.id),
        { active: false, lat: null, lng: null, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true });
    });
    return batch.commit().then(function () { return true }).catch(function () { return false });
  }

  return {
    hasDb: function () { return !!db; },
    fuzz: fuzz, distanceM: distanceM, bearingDeg: bearingDeg, dirLabel: dirLabel, fmtDist: fmtDist,
    setLive: setLive, getAll: getAll, clearAll: clearAll
  };
})();
