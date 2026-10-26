/* 미션 QR 스캐너 (2026-10-05) — 스태프가 보여 주는 행사 미션 QR을 찍어 미션 완료.
   MQScan.open({ hint, onToken(token), parse(text)→token|'', badHint, onManual() }) / MQScan.tokenFrom(text)
   2026-10-10: 방문 스탬프·쿠폰 등 다른 QR 에도 쓰도록 parse/badHint, 카메라 실패 대비 '코드로 입력'(onManual) 버튼 추가.
   카메라: BarcodeDetector 가 있으면 그걸, 없으면 jsqr.js 를 그때 불러 쓴다. */
(function () {
  'use strict';
  var css = '.mqs{position:fixed;inset:0;z-index:9000;background:#000;display:flex;align-items:center;justify-content:center}' +
    '.mqs video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}' +
    '.mqs__f{position:relative;width:min(68vw,300px);aspect-ratio:1;border-radius:18px;box-shadow:0 0 0 100vmax rgba(0,0,0,.5);border:4px solid var(--color-accent,#F5B331)}' +
    '.mqs__h{position:absolute;left:20px;right:20px;top:calc(18px + env(safe-area-inset-top,0px));color:#fff;text-align:center;font-size:16px;font-weight:700;text-shadow:0 1px 4px rgba(0,0,0,.6)}' +
    '.mqs__b{position:absolute;left:0;right:0;bottom:calc(28px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;gap:10px}' +
    '.mqs__x,.mqs__m{min-width:140px;min-height:52px;border-radius:999px;border:1px solid rgba(255,255,255,.5);background:rgba(0,0,0,.6);color:#fff;font:inherit;font-size:17px;font-weight:700}';
  var root = null, stream = null, raf = 0, det = null, cv = null, cx = null, done = false, opts = null;
  var BASE = ((document.currentScript && document.currentScript.src) || '').replace(/[^\/]*$/, ''); // staff/ 하위 페이지에서도 jsqr.js 를 찾게

  function tokenFrom(t) {
    t = String(t || '').trim();
    var m = /[?&]mq=([A-Za-z0-9]+)/.exec(t);
    if (m) return m[1].toUpperCase();
    return /^[A-Za-z0-9]{10}$/.test(t) ? t.toUpperCase() : '';
  }
  function build() {
    if (root) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    root = document.createElement('div'); root.className = 'mqs'; root.hidden = true;
    root.innerHTML = '<video playsinline muted></video><div class="mqs__f"></div><p class="mqs__h"></p><div class="mqs__b"><button class="mqs__m" type="button" hidden>코드로 입력</button><button class="mqs__x" type="button">닫기</button></div>';
    document.body.appendChild(root);
    root.querySelector('.mqs__x').addEventListener('click', stop);
    root.querySelector('.mqs__m').addEventListener('click', function () { var f = opts && opts.onManual; stop(); if (f) f(); });
  }
  function hint(t) { root.querySelector('.mqs__h').textContent = t; }
  function stop() {
    cancelAnimationFrame(raf); raf = 0;
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    if (root) root.hidden = true;
  }
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve();
    return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = BASE + 'jsqr.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  }
  function found(text) {
    var tok = (opts && opts.parse ? opts.parse : tokenFrom)(text);
    if (!tok) { hint((opts && opts.badHint) || '미션 QR이 아니에요. 스태프가 보여 주는 QR을 비춰 주세요.'); return false; }
    done = true;
    try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {}
    stop();
    if (opts && opts.onToken) opts.onToken(tok);
    return true;
  }
  function tick() {
    if (done || !stream) return;
    var v = root.querySelector('video');
    if (v.readyState >= 2) {
      if (det) {
        det.detect(v).then(function (c) { if (c && c.length && found(c[0].rawValue)) return; raf = requestAnimationFrame(tick); },
          function () { det = null; loadJsQR().then(function () { raf = requestAnimationFrame(tick); }, function () {}); });
        return;
      }
      if (window.jsQR) {
        var w = v.videoWidth, h = v.videoHeight, sc = Math.min(1, 640 / Math.max(w, h));
        cv.width = Math.round(w * sc); cv.height = Math.round(h * sc);
        cx.drawImage(v, 0, 0, cv.width, cv.height);
        var d = cx.getImageData(0, 0, cv.width, cv.height), r = jsQR(d.data, d.width, d.height, { inversionAttempts: 'dontInvert' });
        if (r && r.data && found(r.data)) return;
      }
    }
    raf = requestAnimationFrame(tick);
  }
  function open(o) {
    build(); opts = o || {}; done = false;
    hint(opts.hint || '스태프가 보여 주는 미션 QR을 네모 안에 맞춰 주세요');
    root.querySelector('.mqs__m').hidden = !opts.onManual;
    root.hidden = false;
    cv = cv || document.createElement('canvas'); cx = cx || cv.getContext('2d', { willReadFrequently: true });
    det = null;
    try { if ('BarcodeDetector' in window) det = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { det = null; }
    var jq = det ? Promise.resolve() : loadJsQR();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { hint('이 브라우저는 카메라를 쓸 수 없어요. 폰 카메라 앱으로 QR을 찍어 주세요.'); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(function (s) {
      if (root.hidden) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s; var v = root.querySelector('video'); v.srcObject = s; v.muted = true; v.play().catch(function () {});
      jq.then(function () { raf = requestAnimationFrame(tick); }, function () { hint('스캐너를 불러오지 못했어요. 폰 카메라 앱으로 찍어 주세요.'); });
    }, function () { hint('카메라 권한이 필요해요. 허용하거나 폰 카메라 앱으로 QR을 찍어 주세요.'); });
  }
  window.MQScan = { open: open, stop: stop, tokenFrom: tokenFrom };
})();
