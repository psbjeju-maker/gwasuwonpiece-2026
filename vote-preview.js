/* 투표 화면 미리보기 (?votepreview=1) — 서버 없이 모양과 흐름만 눌러 본다. 실제 서비스에서는 불리지 않는다. */
(function () {
  var teams = ['솔라미♡스마일', '미쿠도 해피할로윈!', '가나힛루', '저 하늘의 빛나는 별, 가장 빛나는 나!', '미안', '프로젝트 39', '너 중독된거야', '레벨업', '설거지의악마', '고길동의 하루', 'H']
    .map(function (n, i) { return { no: i + 1, name: n }; });
  var S = { status: 'open', live: false, my: null, counts: { 1: 14, 2: 9, 3: 21, 4: 3, 5: 17, 6: 5, 7: 0, 8: 11, 9: 2, 10: 8, 11: 1 } };
  var m = /[?&]vptop=([\d,]+)/.exec(location.search);
  if (m) m[1].split(',').forEach(function (n, k) { S.counts[+n] = 40 - k * 5; });
  function top() {
    return teams.map(function (t) { return { no: t.no, name: t.name, count: S.counts[t.no] || 0 }; })
      .filter(function (t) { return t.count > 0; }).sort(function (a, b) { return b.count - a.count || a.no - b.no; }).slice(0, 3);
  }
  function get() {
    var o = { title: '무대 인기투표', status: S.status, teams: teams, live: S.status === 'open' && S.live, myTeam: S.my };
    if (S.status === 'published') o.counts = S.counts; else if (o.live) o.top = top();
    return o;
  }
  var fail = function (m) { var e = new Error(m); e.reason = 'x'; return e; };
  window.VPREVIEW = {
    call: function (n, d) {
      return new Promise(function (ok, no) {
        setTimeout(function () {
          if (n === 'voteGet') return ok(get());
          if (S.status !== 'open') return no(fail('지금은 투표 시간이 아니에요'));
          if (n === 'voteCast') { if (S.my) S.counts[S.my]--; S.my = d.team; S.counts[d.team] = (S.counts[d.team] || 0) + 1; return ok({ ok: true }); }
          if (n === 'voteCancel') { if (S.my) S.counts[S.my]--; S.my = null; return ok({ ok: true }); }
          no(fail('?'));
        }, 120);
      });
    }
  };
  var bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:6px;top:6px;z-index:99;display:flex;gap:4px;flex-wrap:wrap;max-width:60vw';
  [['시작 전', 'ready', 0], ['투표 중(순위 숨김)', 'open', 0], ['순위 공개', 'open', 1], ['마감', 'closed', 0], ['결과 공개', 'published', 0]].forEach(function (b) {
    var x = document.createElement('button');
    x.textContent = b[0]; x.style.cssText = 'font-size:11px;padding:4px 6px;border-radius:6px;background:#222;color:#fff;opacity:.8';
    x.onclick = function () { S.status = b[1]; S.live = !!b[2]; };
    bar.appendChild(x);
  });
  document.body.appendChild(bar);
})();
