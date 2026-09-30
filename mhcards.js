/* mh머니 트럼프 카드 — 뽑기 연출(뒤집기)과 수집 도감. 서버가 카드 id(H1~H13)를 정해 주고, 이 파일은 보여주기만 한다. */
(function () {
  'use strict';
  var TOTAL = 13;
  var CFG = { base: 'assets/cards/' };
  var FACE = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  function num(id) { var n = parseInt(String(id).replace(/\D/g, ''), 10); return n >= 1 && n <= TOTAL ? n : 0; }
  function label(id) { var n = num(id); return FACE[n] || String(n); }
  function src(id) { return CFG.base + 'H' + num(id) + '.webp'; }
  function back() { return CFG.base + 'back.webp'; }
  /* owned = 지금 가진 장수(쿠지에 넣은 건 뺀다), ever = 지금까지 한 번이라도 나온 카드(도감) */
  function owned(book, id) { var b = book && book[id]; return b ? Math.max(0, (b.given || 0) + (b.pending || 0) - (b.used || 0)) : 0; }
  function ever(book, id) { var b = book && book[id]; return b ? (b.given || 0) + (b.pending || 0) : 0; }
  function kinds(book) { var c = 0; for (var i = 1; i <= TOTAL; i++) if (ever(book, 'M' + i) > 0) c++; return c; }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var css = '' +
    '.mh-ov{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;' +
    'background:radial-gradient(ellipse at 50% 35%,rgba(30,90,168,.55),rgba(5,12,28,.94) 70%);color:#fff;font-family:inherit;-webkit-tap-highlight-color:transparent;animation:mhIn .25s ease}' +
    '@keyframes mhIn{from{opacity:0}to{opacity:1}}' +
    '.mh-t{font-size:18px;font-weight:800;letter-spacing:.02em;margin:0 0 4px;text-align:center;text-shadow:0 2px 10px rgba(0,0,0,.5)}' +
    '.mh-s{font-size:13px;opacity:.8;margin:0 0 14px;text-align:center;min-height:18px}' +
    '.mh-stage{perspective:1100px;width:min(62vw,290px,calc((100vh - 260px) * .66));aspect-ratio:400/604;position:relative;cursor:pointer;touch-action:manipulation}' +
    '.mh-card{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .8s cubic-bezier(.2,.8,.2,1);animation:mhBob 2.6s ease-in-out infinite}' +
    '.mh-card.flip{transform:rotateY(180deg);animation:none}' +
    '@keyframes mhBob{0%,100%{transform:translateY(0) rotateZ(-1.2deg)}50%{transform:translateY(-8px) rotateZ(1.2deg)}}' +
    '.mh-face,.mh-bk{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:5%;overflow:hidden;box-shadow:0 14px 40px rgba(0,0,0,.55),0 0 0 2px rgba(255,255,255,.35) inset}' +
    '.mh-face{transform:rotateY(180deg);background:#fff}' +
    '.mh-face img,.mh-bk img{width:100%;height:100%;display:block;object-fit:cover}' +
    '.mh-sheen{position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.75) 47%,rgba(255,235,160,.55) 53%,transparent 70%);transform:translateX(-120%);mix-blend-mode:screen;pointer-events:none}' +
    '.mh-card.flip .mh-sheen{animation:mhSheen 1.1s .55s ease-out 1 forwards}' +
    '@keyframes mhSheen{to{transform:translateX(120%)}}' +
    '.mh-glow{position:absolute;inset:-14%;border-radius:50%;background:radial-gradient(circle,rgba(255,220,120,.85),rgba(255,180,60,0) 62%);opacity:0;pointer-events:none;transform:scale(.6)}' +
    '.mh-card.flip ~ .mh-glow,.mh-glow.on{animation:mhGlow 1s .35s ease-out 1 forwards}' +
    '@keyframes mhGlow{0%{opacity:0;transform:scale(.6)}40%{opacity:1}100%{opacity:0;transform:scale(1.35)}}' +
    '.mh-new{position:absolute;top:-10px;right:-10px;z-index:3;background:#ffce2e;color:#5a3a00;font-weight:900;font-size:13px;padding:4px 10px;border-radius:999px;transform:rotate(8deg) scale(0);box-shadow:0 4px 12px rgba(0,0,0,.4)}' +
    '.mh-new.on{animation:mhPop .5s 1s cubic-bezier(.2,1.6,.4,1) forwards}' +
    '@keyframes mhPop{to{transform:rotate(8deg) scale(1)}}' +
    '.mh-info{margin-top:16px;text-align:center;min-height:52px}' +
    '.mh-nm{font-size:20px;font-weight:800}' +
    '.mh-dup{font-size:13px;opacity:.85;margin-top:2px}' +
    '.mh-bar{width:min(80vw,320px);height:8px;border-radius:99px;background:rgba(255,255,255,.18);margin:12px auto 0;overflow:hidden}' +
    '.mh-bar i{display:block;height:100%;background:linear-gradient(90deg,#5fb0ff,#ffce2e);border-radius:99px;transition:width .6s ease}' +
    '.mh-act{display:flex;gap:10px;margin-top:16px}' +
    '.mh-btn{font:inherit;font-weight:800;font-size:15px;border:0;border-radius:12px;padding:12px 22px;background:#1E5AA8;color:#fff;box-shadow:0 4px 0 #0d2547;cursor:pointer}' +
    '.mh-btn.sec{background:rgba(255,255,255,.16);box-shadow:none}' +
    '.mh-btn:active{transform:translateY(2px)}' +
    '.mh-hint{font-size:13px;opacity:.85;animation:mhBlink 1.4s ease-in-out infinite}' +
    '@keyframes mhBlink{50%{opacity:.35}}' +
    '.mh-conf{position:absolute;inset:0;overflow:hidden;pointer-events:none}' +
    '.mh-conf b{position:absolute;top:-20px;width:8px;height:14px;border-radius:2px;animation:mhFall linear forwards}' +
    '@keyframes mhFall{to{transform:translateY(105vh) rotate(720deg)}}' +
    '.mh-alb{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}' +
    '.mh-slot{position:relative;aspect-ratio:400/604;border-radius:6%;overflow:hidden;background:#dfe6f2;box-shadow:0 2px 6px rgba(0,0,0,.25)}' +
    '.mh-slot img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.mh-slot.no img{filter:grayscale(.35);opacity:.3}' +
    '.mh-slot.no.seen img{opacity:.5}' +
    '.mh-slot .n{position:absolute;left:0;right:0;bottom:6%;text-align:center;font-weight:900;font-size:clamp(14px,4.5vw,22px);color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.8)}' +
    '.mh-slot .c{position:absolute;top:4px;right:4px;background:#1E5AA8;color:#fff;font-size:12px;font-weight:800;padding:1px 7px;border-radius:99px;box-shadow:0 1px 4px rgba(0,0,0,.4)}' +
    '.mh-alb-h{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 6px;font-weight:800}' +
    '.mh-alb-h small{font-weight:600;opacity:.75}' +
    '.mh-alb-bar{height:8px;border-radius:99px;background:rgba(120,140,170,.3);margin:0 0 10px;overflow:hidden}' +
    '.mh-alb-bar i{display:block;height:100%;background:linear-gradient(90deg,#5fb0ff,#ffce2e)}' +
    '.mh-done{margin:10px 0 0;padding:8px 10px;border-radius:10px;background:linear-gradient(90deg,#ffe58a,#ffce2e);color:#5a3a00;font-weight:900;text-align:center}' +
    '.mh-pk{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;width:min(94vw,420px)}' +
    '.mh-pk .mh-slot{cursor:pointer}.mh-pk .mh-slot.sel{outline:3px solid #ffce2e;transform:translateY(-4px)}' +
    '.mh-pk .mh-slot.no{cursor:default}' +
    '.mh-pk .mh-slot .c.sc{background:#ffce2e;color:#5a3a00}' +
    '.mh-tray{display:flex;gap:8px;margin:12px 0 2px;min-height:56px;align-items:center}' +
    '.mh-tray i{width:38px;aspect-ratio:400/604;border-radius:5px;border:2px dashed rgba(255,255,255,.5);display:block;overflow:hidden}' +
    '.mh-tray i.f{border:2px solid #ffce2e}.mh-tray i img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.mh-btn[disabled]{opacity:.4}.mh-act{flex-wrap:wrap;justify-content:center}' +
    '@media (prefers-reduced-motion:reduce){.mh-card,.mh-hint{animation:none!important}.mh-card{transition:none}}';
  var styled = false;
  function ensureCss() { if (styled) return; styled = true; var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }

  function preload(ids) { (ids || []).concat(['back']).forEach(function (id) { var i = new Image(); i.src = id === 'back' ? back() : src(id); }); }

  function confetti(host) {
    if (reduced()) return;
    var box = document.createElement('div'); box.className = 'mh-conf';
    var cols = ['#ffce2e', '#5fb0ff', '#ff7a8a', '#8be28b', '#fff'];
    for (var i = 0; i < 36; i++) {
      var b = document.createElement('b');
      b.style.left = Math.random() * 100 + '%'; b.style.background = cols[i % cols.length];
      b.style.animationDuration = 1.6 + Math.random() * 1.4 + 's'; b.style.animationDelay = Math.random() * .5 + 's';
      box.appendChild(b);
    }
    host.appendChild(box); setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 3600);
  }

  /* 카드 뒤집기 연출. ids: ['H3','H11'…], opts: { book: 받기 전 도감(NEW 판정), title, onClose } */
  function reveal(ids, opts) {
    opts = opts || {}; ids = (ids || []).filter(num);
    if (!ids.length) { if (opts.onClose) opts.onClose(); return; }
    ensureCss(); preload(ids);
    var seen = {}; var have = {};
    for (var k = 1; k <= TOTAL; k++) have['M' + k] = owned(opts.book || {}, 'M' + k);
    var idx = 0, flipped = false, closed = false;
    var ov = document.createElement('div'); ov.className = 'mh-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', '카드 획득');
    document.body.appendChild(ov);
    function close() { if (closed) return; closed = true; if (ov.parentNode) ov.parentNode.removeChild(ov); if (opts.onClose) opts.onClose(); }
    function coll() { var c = 0; for (var i = 1; i <= TOTAL; i++) if (have['M' + i] > 0) c++; return c; }
    function draw() {
      var id = ids[idx]; flipped = false;
      ov.innerHTML = '';
      var t = document.createElement('p'); t.className = 'mh-t'; t.textContent = opts.title || (ids.length > 1 ? '카드 ' + (idx + 1) + ' / ' + ids.length : '카드를 받았어요!');
      var s = document.createElement('p'); s.className = 'mh-s'; s.innerHTML = '<span class="mh-hint">카드를 톡 눌러 뒤집어 보세요</span>';
      var st = document.createElement('div'); st.className = 'mh-stage';
      st.innerHTML = '<div class="mh-card"><div class="mh-bk"><img alt="카드 뒷면" src="' + esc(back()) + '"></div>' +
        '<div class="mh-face"><img alt="' + esc(label(id)) + ' 카드" src="' + esc(src(id)) + '"><div class="mh-sheen"></div></div></div><div class="mh-glow"></div><div class="mh-new">NEW!</div>';
      var info = document.createElement('div'); info.className = 'mh-info';
      var bar = document.createElement('div'); bar.className = 'mh-bar'; bar.innerHTML = '<i style="width:' + Math.round(coll() / TOTAL * 100) + '%"></i>';
      var act = document.createElement('div'); act.className = 'mh-act';
      ov.appendChild(t); ov.appendChild(s); ov.appendChild(st); ov.appendChild(info); ov.appendChild(bar); ov.appendChild(act);
      function doFlip() {
        if (flipped) return; flipped = true;
        var isNew = !have[id]; have[id] = (have[id] || 0) + 1;
        st.querySelector('.mh-card').classList.add('flip');
        if (isNew) st.querySelector('.mh-new').classList.add('on');
        st.querySelector('.mh-glow').classList.add('on');
        s.textContent = '';
        info.innerHTML = '<div class="mh-nm">' + esc(label(id)) + ' 카드</div><div class="mh-dup">' + (isNew ? '처음 만난 카드예요!' : '이미 있는 카드예요 · 지금 ' + have[id] + '장') + '</div>';
        bar.firstChild.style.width = Math.round(coll() / TOTAL * 100) + '%';
        var c = coll(); s.textContent = '수집 ' + c + ' / ' + TOTAL;
        if (isNew) try { navigator.vibrate && navigator.vibrate(30); } catch (e) {}
        if (c === TOTAL && isNew) { confetti(ov); info.innerHTML += '<div class="mh-done" style="margin-top:8px">🎉 13장 컴플리트!</div>'; }
        else if (isNew) confetti(ov);
        act.innerHTML = '';
        var last = idx >= ids.length - 1;
        var nb = document.createElement('button'); nb.type = 'button'; nb.className = 'mh-btn'; nb.textContent = last ? '확인' : '다음 카드';
        nb.addEventListener('click', function () { if (last) close(); else { idx++; draw(); } });
        act.appendChild(nb);
        if (!last) {
          var sk = document.createElement('button'); sk.type = 'button'; sk.className = 'mh-btn sec'; sk.textContent = '남은 카드 모두 열기';
          sk.addEventListener('click', function () { openAll(); }); act.appendChild(sk);
        }
      }
      st.addEventListener('click', doFlip);
      st.tabIndex = 0; st.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doFlip(); } });
    }
    function openAll() {
      ov.innerHTML = '';
      var rest = ids.slice(idx), newCount = 0;
      var t = document.createElement('p'); t.className = 'mh-t'; t.textContent = '받은 카드 ' + rest.length + '장';
      var grid = document.createElement('div'); grid.className = 'mh-alb'; grid.style.width = 'min(92vw,420px)';
      rest.forEach(function (id) {
        var isNew = !have[id]; have[id] = (have[id] || 0) + 1; if (isNew) newCount++;
        var d = document.createElement('div'); d.className = 'mh-slot';
        d.innerHTML = '<img alt="' + esc(label(id)) + '" src="' + esc(src(id)) + '">' + (isNew ? '<span class="c" style="background:#ffce2e;color:#5a3a00">NEW</span>' : '');
        grid.appendChild(d);
      });
      var s = document.createElement('p'); s.className = 'mh-s'; s.style.marginTop = '12px'; s.textContent = '수집 ' + coll() + ' / ' + TOTAL + (newCount ? ' · 새 카드 ' + newCount + '장' : '');
      var b = document.createElement('button'); b.type = 'button'; b.className = 'mh-btn'; b.textContent = '확인'; b.addEventListener('click', close);
      ov.appendChild(t); ov.appendChild(grid); ov.appendChild(s); ov.appendChild(b);
      if (newCount) confetti(ov);
    }
    draw();
  }

  /* 도감: el 안에 13칸 수집 화면을 그린다. onTap(id) 가 있으면 가진 카드를 눌렀을 때 호출 */
  function album(el, book, onTap) {
    ensureCss(); if (!el) return;
    var c = kinds(book);
    var h = '<div class="mh-alb-h"><span>내 트럼프 카드</span><small>' + c + ' / ' + TOTAL + '종</small></div>' +
      '<div class="mh-alb-bar"><i style="width:' + Math.round(c / TOTAL * 100) + '%"></i></div><div class="mh-alb">';
    for (var i = 1; i <= TOTAL; i++) {
      var id = 'M' + i, n = owned(book, id), ev = ever(book, id);
      h += '<div class="mh-slot ' + (n ? '' : ev ? 'no seen' : 'no') + '" data-id="' + id + '"><img alt="' + (n ? label(id) + ' 카드' : ev ? label(id) + ' 카드(도감)' : '아직 없는 카드') + '" loading="lazy" src="' + esc(src(id)) + '">' +
        (n > 1 ? '<span class="c">×' + n + '</span>' : '') + '' + '</div>';
    }
    h += '</div>' + (c === TOTAL ? '<div class="mh-done">🎉 13장 컴플리트!</div>' : '<p style="font-size:13px;opacity:.75;margin:10px 0 0">진한 카드는 지금 가진 카드, 흐린 카드는 도감에만 있어요. 숫자는 지금 가진 장수예요.</p>');
    el.innerHTML = h;
    el.onclick = function (e) {
      var slot = e.target.closest && e.target.closest('.mh-slot'); if (!slot) return;
      var id = slot.getAttribute('data-id'); if (!ever(book, id)) return;
      if (onTap) onTap(id); else view(id);
    };
  }

  /* 가진 카드 한 장을 크게 보기 */
  function view(id) {
    ensureCss(); if (!num(id)) return;
    var ov = document.createElement('div'); ov.className = 'mh-ov';
    ov.innerHTML = '<div class="mh-stage" style="cursor:default"><div class="mh-face" style="transform:none;position:absolute"><img alt="' + esc(label(id)) + ' 카드" src="' + esc(src(id)) + '"><div class="mh-sheen" style="animation:mhSheen 1.2s .2s ease-out 1 forwards"></div></div></div>' +
      '<div class="mh-act"><button type="button" class="mh-btn">닫기</button></div>';
    ov.querySelector('button').addEventListener('click', function () { document.body.removeChild(ov); });
    ov.addEventListener('click', function (e) { if (e.target === ov) document.body.removeChild(ov); });
    document.body.appendChild(ov);
  }


  /* 쿠지에 넣을 카드 고르기(연출). need 장을 고르면 onDone(ids) — 실제 차감은 서버가 mh머니로 처리한다 */
  function pick(book, need, opts) {
    ensureCss(); opts = opts || {};
    var sel = {}, cnt = 0;
    var ov = document.createElement('div'); ov.className = 'mh-ov';
    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    function draw() {
      var h = '<p class="mh-t">' + esc(opts.title || '쿠지에 넣을 카드를 골라 주세요') + '</p><p class="mh-s">' + cnt + ' / ' + need + '장 선택</p><div class="mh-pk">';
      for (var i = 1; i <= TOTAL; i++) {
        var id = 'M' + i, n = owned(book, id), u = sel[id] || 0;
        h += '<div class="mh-slot ' + (n ? '' : 'no') + (u ? ' sel' : '') + '" data-id="' + id + '"><img alt="' + label(id) + '" src="' + esc(src(id)) + '">' +
          (n ? '<span class="c' + (u ? ' sc' : '') + '">' + (u ? u + '/' : '') + n + '</span>' : '') + '</div>';
      }
      h += '</div><div class="mh-tray">';
      var chosen = []; Object.keys(sel).forEach(function (k) { for (var j = 0; j < sel[k]; j++) chosen.push(k); });
      for (var q = 0; q < need; q++) h += chosen[q] ? '<i class="f"><img alt="" src="' + esc(src(chosen[q])) + '"></i>' : '<i></i>';
      h += '</div><div class="mh-act"><button type="button" class="mh-btn sec" data-a="x">취소</button><button type="button" class="mh-btn sec" data-a="auto">자동으로 넣기</button><button type="button" class="mh-btn" data-a="ok"' + (cnt === need ? '' : ' disabled') + '>쿠지에 넣기</button></div>';
      ov.innerHTML = h;
    }
    ov.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (b) {
        if (b.getAttribute('data-a') === 'x') { close(); return; }
        if (b.getAttribute('data-a') === 'auto') {
          var pool = []; for (var i = 1; i <= TOTAL; i++) for (var j = 0; j < owned(book, 'M' + i); j++) pool.push('M' + i);
          for (var m = pool.length - 1; m > 0; m--) { var r = Math.floor(Math.random() * (m + 1)), t = pool[m]; pool[m] = pool[r]; pool[r] = t; }
          var ids2 = pool.slice(0, need); close(); if (opts.onDone) opts.onDone(ids2); return;
        }
        if (b.getAttribute('data-a') === 'ok' && cnt === need) { var ids = []; Object.keys(sel).forEach(function (k) { for (var j = 0; j < sel[k]; j++) ids.push(k); }); close(); if (opts.onDone) opts.onDone(ids); }
        return;
      }
      var sl = e.target.closest && e.target.closest('.mh-slot'); if (!sl) return;
      var id = sl.getAttribute('data-id'), n = owned(book, id), u = sel[id] || 0;
      if (!n) return;
      if (u < n && cnt < need) { sel[id] = u + 1; cnt++; } else if (u) { cnt -= u; sel[id] = 0; }
      draw();
    });
    draw(); document.body.appendChild(ov);
  }

  window.MH = { held: owned, pick: pick, init: function (o) { if (o && o.base) CFG.base = o.base; }, reveal: reveal, album: album, view: view, src: src, label: label, kinds: kinds, total: TOTAL, preload: function () { var a = []; for (var i = 1; i <= TOTAL; i++) a.push('M' + i); preload(a); } };
})();
