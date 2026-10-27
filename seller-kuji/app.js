/* ══════════════════════════════════════════════════════════
   공통 — Firebase 연결 · 로그인 · 사진 · 봉인 해시

   모든 화면이 이 파일 하나를 부른다.
   Firebase 는 최신 모듈(ESM) 방식으로 CDN 에서 직접 가져온다. 빌드 도구가 필요 없다.
   ══════════════════════════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  addDoc, query, where, onSnapshot, runTransaction, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

import { FB_CONFIG, SHOP_ID, SHOP_NAME, SELLER_EMAIL, LOGIN_HINT, LAN_FALLBACK, COL,
         PHOTO_MAX_PX, PHOTO_MAX_BYTES, BANNER_MAX_PX, AUDIO_MAX_BYTES } from './config.js';

const app  = initializeApp(FB_CONFIG);
export const db   = getFirestore(app);
export const auth = getAuth(app);

export { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
         addDoc, query, where, onSnapshot, runTransaction, serverTimestamp, increment,
         SHOP_ID, SHOP_NAME, COL };

/* ─────────────── 작은 것들 ─────────────── */
export const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

export const won = n => (Number(n) || 0).toLocaleString('ko-KR') + '원';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 손님 폰에서 실제로 열려야 하는 주소(QR·안내 문구용).
   ⚠️ location.origin 을 그대로 쓰면 "localhost"가 QR 에 박혀서 폰이 자기
   자신을 가리키게 된다 — 매장 PC 화면에서만 맞고 폰에서는 절대 안 열린다. */
export function publicOrigin() {
  const h = location.hostname;
  return (h === 'localhost' || h === '127.0.0.1') ? LAN_FALLBACK : location.origin;
}

/* 알림. window.alert 은 쓰지 않는다 — 브라우저를 멈춰 세워서
   매장 태블릿이 먹통이 되고 자동화도 막힌다. */
let toastTimer = null;
export function toast(msg, ok = true) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast ' + (ok ? 'ok' : 'bad');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('ok', 'bad'), 3500);
}

/* ─────────────── 로그인 ───────────────
   진짜 이메일 주소로 로그인한다. 비밀번호는 입력한 것을 그대로 넘긴다.
   ⚠️ 비밀번호는 코드 어디에도 적지 않는다. 확인은 Firebase 가 한다.
   매장 태블릿은 한 번 로그인하면 유지되므로 매번 칠 일은 없다. */
export { LOGIN_HINT };

export function signIn(email, password) {
  return signInWithEmailAndPassword(auth, SELLER_EMAIL, 'sk-' + String(password || '').trim());
}
export function logout() { return signOut(auth); }

/* 로그인한 사람이 이 매장에서 무엇을 할 수 있는지.
   역할은 shops/{shopId} 문서의 owners·staff 목록으로 정한다.
   (이메일 이름으로 역할을 정하면 계정을 새로 팔 때마다 코드를 고쳐야 한다) */
export const ROLE = { none:'none', staff:'staff', owner:'owner' };

export async function roleOf(user, shopId = SHOP_ID) {
  if (!user) return { role: ROLE.none, shop: null };
  const snap = await getDoc(doc(db, COL.shops, shopId));
  if (!snap.exists()) return { role: ROLE.none, shop: null };
  const shop = { id: snap.id, ...snap.data() };
  const uid = user.uid;
  const role = (shop.owners || []).includes(uid) ? ROLE.owner
             : (shop.staff  || []).includes(uid) ? ROLE.staff
             : ROLE.none;
  return { role, shop };
}
export const ROLE_NAME = { owner:'셀러', staff:'직원', none:'권한 없음' };

/* 화면마다 이걸 부르면 로그인 상태가 바뀔 때 알아서 다시 그린다.
   cb({ user, role, shop }) */
export function watchAuth(cb) {
  return onAuthStateChanged(auth, async user => {
    if (!user) return cb({ user: null, role: ROLE.none, shop: null });
    try {
      const { role, shop } = await roleOf(user);
      cb({ user, role, shop });
    } catch (e) {
      console.error(e);
      cb({ user, role: ROLE.none, shop: null });
    }
  });
}

/* ─────────────── 상품 사진 ───────────────
   고른 파일을 줄여 문자열로 바꾼다. 용량이 넘치면 화질을 낮춰 다시 시도한다. */
export function shrinkPhoto(file, maxPx = PHOTO_MAX_PX) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const r = Math.min(1, maxPx / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width  = Math.max(1, Math.round(img.width  * r));
      cv.height = Math.max(1, Math.round(img.height * r));
      const g = cv.getContext('2d');
      g.fillStyle = '#fff';                    // 투명 PNG 가 검게 나오지 않게 흰 바탕부터
      g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(img, 0, 0, cv.width, cv.height);
      let q = 0.82, out = cv.toDataURL('image/jpeg', q);
      while (out.length > PHOTO_MAX_BYTES && q > 0.4) {
        q -= 0.12;
        out = cv.toDataURL('image/jpeg', q);
      }
      if (out.length > PHOTO_MAX_BYTES) return reject(new Error('사진이 너무 큽니다'));
      resolve({ data: out, w: cv.width, h: cv.height, bytes: out.length });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했습니다')); };
    img.src = url;
  });
}
export const shrinkBanner = file => shrinkPhoto(file, BANNER_MAX_PX);

/* 세트에 올려둔 사진을 등급별로 가져온다. { A:['data:image/...', ...], BANNER:[...] }
   등급 하나에 "택1" 상품처럼 사진을 여러 장 올릴 수 있다 — 항상 배열로 준다.
   예전 문서(단일 사진, {data:...})도 배열 [data] 로 감싸서 그대로 읽힌다. */
export async function loadPhotos(setId) {
  try {
    const snap = await getDocs(collection(db, COL.sets, setId, COL.images));
    const map = {};
    snap.forEach(d => {
      const v = d.data();
      const arr = Array.isArray(v.photos) ? v.photos.filter(Boolean) : (v.data ? [v.data] : []);
      if (arr.length) map[d.id] = arr;
    });
    return map;
  } catch (e) {
    return {};      // 사진을 못 불러와도 화면 자체는 떠야 한다
  }
}
export function savePhotos(setId, tierKey, dataUrls) {
  return setDoc(doc(db, COL.sets, setId, COL.images, tierKey), { photos: dataUrls });
}
export function removePhoto(setId, tierKey) {
  return deleteDoc(doc(db, COL.sets, setId, COL.images, tierKey));
}

/* ─────────────── 배경음악 ───────────────
   쿠지 세트(setId)마다 뽑기 판 배경음을 따로 둔다 — "이 쿠지엔 이 노래" 식으로
   사장님이 세트별로 고를 수 있게 해달라는 요청(2026-09-14). 세트에 안 올려뒀으면
   sfx.js 의 기본 곡(bgm.mp3)이 그대로 나간다.
   사진과 달리 오디오는 브라우저에서 다시 압축할 방법이 없어서, 파일을 있는
   그대로 읽어 문서 한도만 넘는지 본다. 넘으면 거절하고 사장님이 직접 짧게
   자르거나 낮은 비트레이트로 다시 내보내 올리게 안내 문구를 준다. */
export function readAudioFile(file, maxBytes = AUDIO_MAX_BYTES) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('audio/')) return reject(new Error('오디오 파일이 아닙니다'));
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result;
      if (data.length > maxBytes) {
        reject(new Error(`파일이 너무 큽니다(약 ${(data.length / 1024 / 1024).toFixed(1)}MB) — `
          + `30~60초 정도 짧은 루프로 자르거나 mp3 64~96kbps 정도로 낮춰 다시 올려주세요`));
        return;
      }
      resolve({ data, bytes: data.length, name: file.name });
    };
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다'));
    reader.readAsDataURL(file);
  });
}
export async function loadBgm(setId) {
  try {
    const snap = await getDoc(doc(db, COL.sets, setId, COL.audio, 'bgm'));
    return snap.exists() ? snap.data() : null;   // { data, bytes, name } | null
  } catch (e) {
    return null;   // 못 불러와도 기본 브금으로 화면은 떠야 한다
  }
}
export function saveBgm(setId, data, name, bytes) {
  return setDoc(doc(db, COL.sets, setId, COL.audio, 'bgm'), { data, name, bytes });
}
export function removeBgm(setId) {
  return deleteDoc(doc(db, COL.sets, setId, COL.audio, 'bgm'));
}

/* 등급 하나에 사진이 여러 장이면 정사각형 한 칸 안에 균등한 격자(콜라주)로,
   한 장뿐이면 그냥 꽉 채운 사진 한 장으로 보여준다. 장수를 늘리고 줄여도
   레이아웃이 자동으로 다시 짜인다 — cols = ceil(sqrt(장수)).
   cls 에 넘긴 클래스(.tpic, .p-pic 등)가 정사각형 크기·모서리를 그대로 잡아준다.
   칸마다 object-fit:cover로 꽉 채우면 사람 얼굴 같은 게 잘려 흉해서(사장님 지적,
   2026-09-10), .pgcell로 감싸 contain으로 사진 전체가 다 보이게 한다 —
   호출하는 화면(board.html·poster.html)은 각자 ".pgcell{background:#fff}" 같은
   칸 배경 스타일만 맞춰주면 된다. */
export function photoGridHTML(list, cls) {
  const arr = (list || []).filter(Boolean);
  if (!arr.length) return '';
  if (arr.length === 1) return `<img class="${cls}" src="${arr[0]}">`;
  const cols = Math.ceil(Math.sqrt(arr.length));
  const cells = arr.map(u => `<div class="pgcell"><img src="${u}"></div>`).join('');
  return `<div class="${cls} photogrid" style="--pg-cols:${cols}">${cells}</div>`;
}

/* ─────────────── 봉인 ───────────────
   "판매를 시작하기 전에 순서를 정했고 중간에 못 바꿨다" 를 수학으로 증명한다.

     1. 세트를 만들 때 뽑기 순서(order)를 섞고 난수(salt)를 뽑는다
     2. sealHash = SHA-256(salt + JSON(order)) 만 공개 문서에 박는다
     3. salt·order 는 vault/seal 에 숨겨 마감 전까지 아무도 못 본다
     4. 마감하면 salt·order 를 공개한다 → 손님이 직접 해시를 다시 계산해 대조할 수 있다

   ⚠️ crypto.subtle(브라우저 표준 SHA-256)은 https·localhost 에서만 동작한다.
      매장 컴퓨터·태블릿은 보통 http://192.168.x.x 같은 사설 IP로 접속하는데,
      그 주소에서는 crypto.subtle 이 조용히 undefined 가 되고 아무 반응도 없이 죽는다
      (2026-08-13 실제로 "쿠지 만들기"를 눌러도 아무 일도 안 일어나던 원인이 이것이었다).
      그래서 SHA-256 을 직접 계산한다. Python hashlib 로 5가지 경우(빈 문자열·영문·한글·
      1000자 긴 문자열 등)를 대조해 정확성을 검증했다. */
// sha256() 은 32비트 단어 8개를 뱉는다 — 단어당 16진수 8자리
const wordsToHex = words => [...words].map(w => (w >>> 0).toString(16).padStart(8, '0')).join('');
// makeSalt() 는 바이트 배열이다 — 바이트당 16진수 2자리 (단어용 toHex 와 섞어 쓰면 안 된다)
const bytesToHex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');

const SHA256_K = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
];
function sha256(bytes) {
  let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const len = bytes.length;
  const padded = Math.ceil((len + 9) / 64) * 64;
  const buf = new Uint8Array(padded);
  buf.set(bytes);
  buf[len] = 0x80;
  const dv = new DataView(buf.buffer);
  const bitLen = len * 8;
  dv.setUint32(padded - 4, bitLen >>> 0, false);
  dv.setUint32(padded - 8, Math.floor(bitLen / 0x100000000), false);
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let chunk = 0; chunk < padded; chunk += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(chunk + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15] >>> 3);
      const s1 = rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    let [a,b,c,d,e,f,g,h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA256_K[i] + w[i]) | 0;
      const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
    }
    H = [H[0]+a|0, H[1]+b|0, H[2]+c|0, H[3]+d|0, H[4]+e|0, H[5]+f|0, H[6]+g|0, H[7]+h|0];
  }
  return H;
}

export async function sealHash(salt, order) {
  const bytes = new TextEncoder().encode(salt + JSON.stringify(order));
  return wordsToHex(sha256(bytes));
}

export function makeSalt() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return bytesToHex(a);
}

/* 뽑기 순서를 섞는다. Fisher–Yates + 암호학적 난수.
   Math.random() 은 예측 가능해서 공정성을 주장할 수 없다. */
export function shuffle(list) {
  const a = list.slice();
  const r = new Uint32Array(a.length);
  crypto.getRandomValues(r);
  for (let i = a.length - 1; i > 0; i--) {
    const j = r[i] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ─────────────── 세트 계산 ───────────────
   확률은 저장하지 않는다. 수량에서 언제든 나오고, 저장하면 어긋날 여지만 생긴다.
   ⚠️ 손님 화면에는 확률을 띄우지 않는다 (질문지 Q23 비공개). */
export const leftOf   = s => (s.total || 0) - (s.soldCount || 0);
export const leftTier = (s, key) => {
  const t = (s.tiers || []).find(x => x.key === key);
  return t ? t.qty - ((s.soldByTier || {})[key] || 0) : 0;
};
export const chanceOf = (s, key) => {
  const t = (s.tiers || []).find(x => x.key === key);
  return (t && s.total) ? (t.qty / s.total * 100) : 0;
};
