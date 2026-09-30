/* ══════════════════════════════════════════════════════════
   효과음 — Pixabay 무료 음원 5개 (2026-08-13 사장님이 직접 고름)

   ⚠️ 볼륨을 일부러 낮게 잡았다. "소리 너무 크면 안 된다"는 사장님 지시라
      매장에서 실제로 크게 들리면 아래 VOLUME 값만 낮추면 된다.

   bgm.mp3 는 뽑기 판에 들어가는 순간부터 조용히 깔리는 분위기 브금이다.
   봉인지를 미는 동작과는 상관없이 화면이 떠 있는 동안 계속 돈다(loop).
   처음엔 "종이 밀 때만" 나오게 했다가, 그보다 화면 전체에 은은하게 깔리는
   쪽이 낫다는 사장님 의견으로 바꿨다 (2026-08-13).

   모바일 브라우저는 사용자가 화면을 만지기 전에는 소리를 막는다.
   뽑기 화면은 로그인·세트 선택 등 이미 손가락으로 눌러야 들어오므로 문제없다.
   ══════════════════════════════════════════════════════════ */

const FILES = {
  low: 'assets/sfx/reveal_low.mp3',
  mid: 'assets/sfx/reveal_mid.mp3',
  top: 'assets/sfx/reveal_top.mp3',
  rainbow: 'assets/sfx/reveal_rainbow.mp3',   // 무지개 등급 전용 — 강보다 한 단계 더 화려하게 (2026-08-14)
  bgm: 'assets/sfx/bgm.mp3',
  tap: 'assets/sfx/tap.mp3',
};
const VOLUME = { low: .5, mid: .6, top: .75, rainbow: .8, bgm: .16, tap: .3 };

const cache = {};
function el(name) {
  if (!cache[name]) {
    const a = new Audio(FILES[name]);
    a.preload = 'auto';
    a.volume = VOLUME[name];
    cache[name] = a;
  }
  return cache[name];
}

const MUTE_KEY = 'kuji_sfx_off';
let muted = localStorage.getItem(MUTE_KEY) === '1';
export function isMuted() { return muted; }
export function setMuted(v) {
  muted = !!v;
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  if (muted) stopBgm();
}

export function playTap() {
  if (muted) return;
  const a = el('tap');
  a.currentTime = 0;
  a.play().catch(() => {});   // 자동재생이 막혀도 화면은 계속 돌아야 한다
}

/* 번호판 조작음(선택·취소·한도 안내·확정). 짧아서 연타해도 겹쳐 울리게 복제해서 튼다. */
const UI = { select: .5, deselect: .45, limit: .5, confirm: .55 };
const uiCache = {};
export function playUi(name) {
  if (muted || !UI[name]) return;
  try {
    if (!uiCache[name]) { uiCache[name] = new Audio('assets/sfx/ui_' + name + '.mp3'); uiCache[name].preload = 'auto'; }
    const a = uiCache[name].cloneNode();
    a.volume = UI[name];
    a.play().catch(() => {});
  } catch (e) {}
}

/* 등급 강도(약/중/강/무지개)에 맞는 공개음. 라스트원도 강도가 '강'으로 넘어오므로 그대로 탄다. */
export function playReveal(power) {
  if (muted) return;
  const key = power === '무지개' ? 'rainbow' : power === '강' ? 'top' : (power === '중' ? 'mid' : 'low');
  const a = el(key);
  a.currentTime = 0;
  a.play().catch(() => {});
}

/* 뽑기 판 배경음. 화면에 들어가면 시작하고, 나가면 멈춘다.
   여러 장을 연달아 뽑거나 봉인지를 밀어도 끊기지 않고 계속 돈다. */
let bgmPlaying = false;
export function startBgm() {
  if (muted || bgmPlaying) return;
  const a = el('bgm');
  a.loop = true;
  a.volume = VOLUME.bgm;
  a.play().catch(() => {});
  bgmPlaying = true;
}
/* 뚝 끊기면 거슬려서 짧게 페이드아웃한다 */
export function stopBgm() {
  if (!bgmPlaying) return;
  bgmPlaying = false;
  const a = el('bgm');
  const base = VOLUME.bgm, steps = 8;
  let i = 0;
  const t = setInterval(() => {
    i++;
    a.volume = Math.max(0, base * (1 - i / steps));
    if (i >= steps) { clearInterval(t); a.pause(); a.currentTime = 0; a.volume = base; }
  }, 35);
}

/* 사장님이 관리 화면에서 직접 올린 브금(2026-09-14). 올려둔 게 있으면 그걸,
   없으면 기본 bgm.mp3 를 쓴다. 손님이 뽑기 화면에 들어와 있는 중에
   교체값이 뒤늦게 도착해도(로그인 직후 Firestore 를 비동기로 읽으므로)
   자연스럽게 갈아 끼우도록, 재생 중이면 잠깐 멈췄다 새 곡으로 다시 튼다. */
let bgmSrcKey = null;
export function setBgmSource(dataUrl) {
  const src = dataUrl || FILES.bgm;
  if (bgmSrcKey === src) return;
  bgmSrcKey = src;
  const a = el('bgm');
  const wasPlaying = bgmPlaying;
  if (wasPlaying) { bgmPlaying = false; a.pause(); }
  a.src = src;
  a.load();
  if (wasPlaying) startBgm();
}
