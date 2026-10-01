/* 번호 뽑기판 + 봉인지 연출 (참가자 앱용, 일반 <script>)
   KB.open({
     eventId, source,
     board():   Promise<{n, picked:[번호], voids:[번호]}>,
     play(no):  Promise<{play, wallet}>           // 서버 playKuji(number) 호출
     onResult(r), onError(e), onCancel()
   })
   흐름: 번호판(100개씩 페이지, 번호 이동) → 번호 선택 → 열기 → 봉인지 떼기(왼→오) → 결과 화면은 앱이 이어서 보여준다. */
(function () {
  var PER = 100, CSS_ID = 'kb-css';
  var mods = null;
  function loadMods() {
    if (!mods) mods = Promise.all([import('./seal.js'), import('./sfx.js')]).then(function (m) { return { seal: m[0].KujiSeal, sfx: m[1] }; }).catch(function () { return null; });
    return mods;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function css() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style'); st.id = CSS_ID;
    st.textContent =
      '.kb{position:fixed;inset:0;z-index:9500;display:flex;flex-direction:column;align-items:center;overflow:auto;padding:14px 12px 22px;color:#fff;font-family:inherit;-webkit-tap-highlight-color:transparent;' +
      'background:radial-gradient(ellipse at 50% 20%,rgba(30,90,168,.6),rgba(5,12,28,.97) 72%)}' +
      '.kb-w{width:min(96vw,460px)}' +
      '.kb-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 4px}' +
      '.kb-t{font-size:19px;font-weight:900;margin:0}' +
      '.kb-x{font:inherit;font-size:22px;line-height:1;border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:10px;width:38px;height:38px;cursor:pointer}' +
      '.kb-s{margin:0 0 10px;font-size:13px;opacity:.8}' +
      '.kb-bar{display:flex;align-items:center;gap:6px;margin:0 0 8px}' +
      '.kb-bar b{flex:1;text-align:center;font-size:15px}' +
      '.kb-b{font:inherit;font-weight:800;font-size:14px;border:0;border-radius:10px;padding:9px 14px;background:rgba(255,255,255,.16);color:#fff;cursor:pointer}' +
      '.kb-b:disabled{opacity:.35;cursor:default}' +
      '.kb-main{background:#1E5AA8;box-shadow:0 4px 0 #0d2547;font-size:16px;padding:13px 20px}' +
      '.kb-jump{display:flex;gap:6px;margin:0 0 10px}' +
      '.kb-jump input{flex:1;min-width:0;font:inherit;font-size:16px;padding:9px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff}' +
      '.kb-g{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin:0 0 10px}' +
      '.kb-n{font:inherit;font-weight:800;font-size:clamp(10px,3vw,14px);aspect-ratio:1;padding:0;border:0;border-radius:7px;background:#f4f7fb;color:#153E76;cursor:pointer;font-variant-numeric:tabular-nums}' +
      '.kb-n.tk{background:rgba(255,255,255,.1);color:rgba(255,255,255,.28);text-decoration:line-through;cursor:default}' +
      '.kb-n.vd{visibility:hidden}' +
      '.kb-n.sel{background:#ffce2e;color:#5a3a00;outline:3px solid #fff;transform:scale(1.12);position:relative;z-index:1}' +
      '.kb-f{display:flex;gap:8px;position:sticky;bottom:0;padding:8px 0 0}' +
      '.kb-f .kb-main{flex:1}' +
      '.kb-err{min-height:20px;margin:0 0 6px;font-size:13px;font-weight:700;color:#ffb4b4}' +
      '.kb-stage{position:relative;width:min(92vw,420px);aspect-ratio:9/13;border-radius:16px;overflow:hidden;box-shadow:0 20px 50px -18px #000,0 0 0 1px #ffffff18 inset;margin:8px auto 12px}' +
      '.kb-c{text-align:center}';
    document.head.appendChild(st);
  }

  var RANK = function (n) { n = String(n || '').replace(/\s/g, ''); return n.indexOf('하이') >= 0 ? 0 : n.indexOf('프리미엄') >= 0 ? 1 : n.indexOf('피규어') >= 0 ? 2 : 3; };
  /* 상 이름 → 봉인지 연출(등급 글자·강도) */
  function sealItem(play, opts) {
    var img = (typeof play.image === 'string' && /^(https?:\/\/|data:image\/(jpeg|png|webp);base64,)/.test(play.image)) ? play.image : '';
    if (play.kind === 'blank') {
      return { label: '꽝', name: play.name || '꽝', img: '', power: '약' };
    }
    if (play.kind === 'coin') {
      return { label: 'mh머니', name: 'mh머니 카드 ' + ((play.cards && play.cards.length) || 1) + '장', img: '', power: '약' };
    }
    var r = RANK(play.name);
    var pw = r === 0 ? '무지개' : r === 1 ? '강' : r === 2 ? '중' : '강';
    var lab = r === 3 ? '당첨' : 'ABC'.charAt(r) + ' 상';
    return { label: lab, name: play.name || '', img: img, power: pw };
  }

  function open(opts) {
    css();
    var st = { n: 0, picked: {}, voids: {}, page: 0, sel: 0, busy: false, seal: null, done: false };
    var ov = document.createElement('div'); ov.className = 'kb'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="kb-w" id="kbw"></div>';
    document.body.appendChild(ov);
    var box = ov.firstChild;
    var M = null; loadMods().then(function (m) { M = m; });

    function ui(name) { try { if (M && M.sfx.playUi) M.sfx.playUi(name); } catch (e) {} }
    function close() {
      if (st.seal) { try { st.seal.destroy(); } catch (e) {} st.seal = null; }
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }
    function avail() { var a = []; for (var i = 1; i <= st.n; i++) if (!st.picked[i] && !st.voids[i]) a.push(i); return a; }
    function pages() { return Math.max(1, Math.ceil(st.n / PER)); }

    function apply(b) {
      st.n = b.n || 0; st.picked = {}; st.voids = {};
      (b.picked || []).forEach(function (x) { st.picked[x] = 1; });
      (b.voids || []).forEach(function (x) { st.voids[x] = 1; });
      if (st.sel && (st.picked[st.sel] || st.voids[st.sel] || st.sel > st.n)) st.sel = 0;
    }

    function draw(msg) {
      var a = avail(), p = st.page, lo = p * PER + 1, hi = Math.min(st.n, lo + PER - 1);
      var h = '<div class="kb-h"><h2 class="kb-t">' + esc(opts.title || '번호를 골라 주세요') + '</h2><button class="kb-x" type="button" data-a="x" aria-label="닫기">×</button></div>' +
        '<p class="kb-s">전체 ' + st.n + '번 중 <b>' + a.length + '개</b>가 남았어요 · 마음에 드는 번호를 눌러 주세요</p>' +
        '<div class="kb-bar"><button class="kb-b" type="button" data-a="prev"' + (p <= 0 ? ' disabled' : '') + '>◀</button><b>' + lo + ' ~ ' + hi + '번 (' + (p + 1) + '/' + pages() + ')</b>' +
        '<button class="kb-b" type="button" data-a="next"' + (p >= pages() - 1 ? ' disabled' : '') + '>▶</button></div>' +
        '<div class="kb-jump"><input id="kbj" type="number" inputmode="numeric" min="1" max="' + st.n + '" placeholder="번호로 바로 가기"><button class="kb-b" type="button" data-a="jump">이동</button><button class="kb-b" type="button" data-a="rand">랜덤</button></div>' +
        '<div class="kb-g">';
      for (var i = lo; i <= hi; i++) {
        var cls = 'kb-n' + (st.voids[i] ? ' vd' : st.picked[i] ? ' tk' : '') + (st.sel === i ? ' sel' : '');
        h += '<button type="button" class="' + cls + '" data-n="' + i + '"' + ((st.picked[i] || st.voids[i]) ? ' disabled' : '') + ' aria-label="' + i + '번' + (st.picked[i] ? ' 이미 열림' : '') + '">' + i + '</button>';
      }
      h += '</div><p class="kb-err" id="kbe">' + esc(msg || '') + '</p>' +
        '<div class="kb-f"><button class="kb-b kb-main" type="button" data-a="go"' + (st.sel && !st.busy ? '' : ' disabled') + '>' + (st.sel ? st.sel + '번 열기' : '번호를 골라 주세요') + '</button></div>';
      box.innerHTML = h;
    }

    function refresh(msg) {
      return opts.board().then(function (b) { apply(b); draw(msg); }, function (e) { draw((e && e.message) || '번호판을 불러오지 못했어요.'); });
    }

    function pick(no) {
      if (!no || no < 1 || no > st.n || st.picked[no] || st.voids[no]) return;
      st.sel = no; st.page = Math.floor((no - 1) / PER); ui('select'); draw();
    }

    function stage(play, r) {
      st.done = false;
      box.className = 'kb-w kb-c';
      box.innerHTML = '<p class="kb-s" style="margin:0 0 4px">' + esc((play.number ? play.number + '번' : '') + ' 봉인지를 왼쪽에서 오른쪽으로 쭉 밀어 뜯어 주세요') + '</p>' +
        '<div class="kb-stage" id="kbs"></div><div class="kb-f"><button class="kb-b" type="button" data-a="skip" style="flex:1">건너뛰기</button></div>';
      loadMods().then(function (m) {
        if (!m || !document.getElementById('kbs')) return finish(r);
        M = m;
        var seal = m.seal.mount(document.getElementById('kbs')); st.seal = seal;
        var it = sealItem(play, opts);
        seal.onDone = function () {
          if (st.done) return; st.done = true;
          var top = it.power !== '약';
          if (top) {
            box.querySelector('.kb-f').innerHTML = '<button class="kb-b kb-main" type="button" data-a="fin">🎉 결과 보기</button>';
          } else setTimeout(function () { finish(r); }, 700);
        };
        seal.load({ label: it.label, name: it.name, img: it.img, power: it.power });
        seal.resize && seal.resize();
      });
      st.pending = r;
    }
    function finish(r) {
      if (st.finished) return; st.finished = true;
      close(); if (opts.onResult) opts.onResult(r);
    }

    function go() {
      if (!st.sel || st.busy) return;
      st.busy = true; ui('confirm'); draw('열고 있어요…');
      var no = st.sel;
      Promise.resolve(opts.play(no)).then(function (r) {
        st.busy = false;
        if (!r || !r.play) { close(); if (opts.onResult) opts.onResult(r); return; }
        stage(r.play, r);
      }, function (e) {
        st.busy = false;
        var why = e && e.reason;
        if (why === 'number-taken' || why === 'number-void') {
          st.sel = 0; ui('limit');
          refresh((e && e.message) || '다른 번호를 골라 주세요.');
        } else { close(); if (opts.onError) opts.onError(e); }
      });
    }

    ov.addEventListener('click', function (e) {
      var t = e.target; if (!t || !t.closest) return;
      var nb = t.closest('[data-n]');
      if (nb && !st.busy) { pick(parseInt(nb.getAttribute('data-n'), 10)); return; }
      var ab = t.closest('[data-a]'); if (!ab) return;
      var a = ab.getAttribute('data-a');
      if (a === 'x') { if (!st.busy) { close(); if (opts.onCancel) opts.onCancel(); } }
      else if (a === 'prev') { st.page = Math.max(0, st.page - 1); draw(); }
      else if (a === 'next') { st.page = Math.min(pages() - 1, st.page + 1); draw(); }
      else if (a === 'jump') {
        var v = parseInt((document.getElementById('kbj') || {}).value, 10);
        if (!v || v < 1 || v > st.n) { draw('1 ~ ' + st.n + ' 사이 번호를 넣어 주세요.'); return; }
        if (st.picked[v] || st.voids[v]) { st.page = Math.floor((v - 1) / PER); st.sel = 0; draw(v + '번은 이미 열린 번호예요.'); return; }
        pick(v);
      }
      else if (a === 'rand') { var av = avail(); if (av.length) pick(av[Math.floor(Math.random() * av.length)]); }
      else if (a === 'go') go();
      else if (a === 'skip') { if (st.seal) st.seal.skip(); else finish(st.pending); }
      else if (a === 'fin') finish(st.pending);
    });
    ov.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.id === 'kbj') { e.preventDefault(); var b = ov.querySelector('[data-a="jump"]'); if (b) b.click(); }
    });

    refresh().then(function () { loadMods(); });
    return { close: close };
  }

  /* 스태프 PIN 확인 창 — 스태프가 참가자 폰에 직접 PIN 을 눌러 SNS 인증 같은 미션을 확인한다
     KB.askPin({ title, desc, extra(html), submit(pin) → Promise, onDone(r), onCancel() }) */
  function askPin(o) {
    css();
    var ov = document.createElement('div'); ov.className = 'kb'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.style.justifyContent = 'center';
    ov.innerHTML = '<div class="kb-w"><div class="kb-h"><h2 class="kb-t">' + esc(o.title || '스태프 확인') + '</h2><button class="kb-x" type="button" data-a="x" aria-label="닫기">×</button></div>' +
      '<p class="kb-s">' + esc(o.desc || '스태프가 확인하고 PIN 을 입력해 주세요.') + '</p>' + (o.extra || '') +
      '<div class="kb-jump"><input id="kbpin" type="password" inputmode="numeric" autocomplete="off" maxlength="12" placeholder="스태프 PIN" aria-label="스태프 PIN"><button class="kb-b kb-main" type="button" data-a="ok" style="padding:9px 18px">확인</button></div>' +
      '<p class="kb-err" id="kbpe"></p></div>';
    document.body.appendChild(ov);
    var inp = ov.querySelector('#kbpin'), err = ov.querySelector('#kbpe'), busy = false;
    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    function ok() {
      if (busy) return; var v = inp.value.trim();
      if (!v) { err.textContent = 'PIN 을 입력해 주세요.'; return; }
      busy = true; err.textContent = '확인 중…';
      Promise.resolve(o.submit(v)).then(function (r) { close(); if (o.onDone) o.onDone(r); },
        function (e) { busy = false; inp.value = ''; err.textContent = (e && e.message) || '확인하지 못했어요.'; if (e && e.retryable) err.textContent = '연결이 불안정해요. 다시 눌러 주세요.'; });
    }
    ov.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-a]'); if (!t) return;
      var a = t.getAttribute('data-a');
      if (a === 'x') { if (!busy) { close(); if (o.onCancel) o.onCancel(); } } else if (a === 'ok') ok();
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 60);
    return { close: close };
  }

  window.KB = { open: open, askPin: askPin, sealItem: sealItem };
})();
