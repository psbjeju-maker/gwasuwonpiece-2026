/* ══════════════════════════════════════════════════════════
   봉인지 떼기 연출 — 박서방 제주지점 디지털 쿠지

   이치방쿠지 기본 룰을 따른다 (2026-08-13 사장님 확정)
     · 제비는 가로로 놓인다. 화면 가운데에 들어간다
     · 봉인지는 왼쪽에서 오른쪽으로 뗀다. 이게 정석이다
     · 떼는 동안 밑에서 등급이 먼저 드러나고, 다 떼면 상품이 공개된다

   등급 색은 등급 '이름'이 아니라 '연출 강도'가 정한다.
   그래서 등급을 몇 개로 만들든(A~J든 가나다든) 그대로 돌아간다.

   쓰는 법
     const seal = KujiSeal.mount(document.getElementById('stage'));
     seal.load({ label:'A 상', name:'루피 피규어', img:'data:image/...', power:'강' });
     seal.onDone = () => { ... };   // 다 떼고 공개까지 끝났을 때
     seal.skip();                   // 연출 건너뛰고 즉시 공개
     seal.destroy();                // 화면을 떠날 때 (rAF 루프를 멈춘다)
   ══════════════════════════════════════════════════════════ */

import * as Sfx from './sfx.js';

export const KujiSeal = (() => {
  "use strict";

  /* 연출 강도 프리셋. 관리자에서 등급마다 약/중/강/무지개를 고를 수 있고,
     안 골랐으면 상위상(top)은 강, 나머지는 약으로 본다.
     무지개는 강보다 한 단계 위 — 가장 귀한 상품 한둘에만 쓰라고 사장님이 요청(2026-08-14). */
  const POWER = {
    무지개: { glow:null, spark:null, particles:220, flare:1.15, bloom:1.25, ring:3, rainbow:true },
    강: { glow:[255,205,70],  spark:[255,236,170], particles:150, flare:1.00, bloom:1.00, ring:2 },
    중: { glow:[190,120,255], spark:[228,196,255], particles:105, flare:0.68, bloom:0.80, ring:2 },
    약: { glow:[110,175,255], spark:[200,228,255], particles: 55, flare:0.30, bloom:0.50, ring:1 },
  };

  const clamp  = (v,a,b) => v<a?a:v>b?b:v;
  const OPEN_AT = 0.60;   // 봉인지를 이만큼(60%) 이상 뜯으면 다 열린다
  const easeOut= t => 1-Math.pow(1-t,3);
  const easeIO = t => t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;

  /* 무지개 등급용 — 시간에 따라 색상환을 계속 돈다(채도·명도 최대) */
  function hueRgb(deg){
    const h=((deg%360)+360)%360/60, c=1, x=c*(1-Math.abs(h%2-1));
    const rgb = h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];
    return rgb.map(v=>Math.round(v*255));
  }
  function glowOf(G){ return G.rainbow ? hueRgb(performance.now()/6) : G.glow; }
  function sparkOf(G){ return G.rainbow ? hueRgb(performance.now()/6+140) : G.spark; }

  /* 조명은 좌상단. 되접힌 면의 법선을 (k, √(1−k²)) 로 두고
     k=0(가장 높이 들린 정점) → k=1(수직으로 서는 지점) 으로 감쇠시킨다. */
  const LX=-0.331, LZ=0.944;
  const FRONT=[247,244,236];   // 봉인지 앞면(인쇄면)
  const BACK =[228,222,208];   // 봉인지 뒷면(접착면)
  const PAD=6, STEP=4;

  function shade(k){
    const nz=Math.sqrt(Math.max(0,1-k*k));
    return Math.max(0, LX*k + LZ*nz);
  }
  function backColor(k, extra){
    // 접착면의 옅은 광택 — 정점 부근에 완만한 스페큘러 하나
    const spec = 0.17*Math.exp(-Math.pow((k-0.34)/0.20,2));
    const l = clamp(0.30 + shade(k)*0.80 + spec + (extra||0), 0, 1.25);
    return `rgb(${Math.round(BACK[0]*l)},${Math.round(BACK[1]*l)},${Math.round(BACK[2]*l)})`;
  }

  function mount(host){
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    host.style.position = host.style.position || 'relative';
    host.style.touchAction = 'none';
    host.appendChild(cv);
    const ctx = cv.getContext('2d');

    let MW=0, MH=0, raf=0, alive=true;
    const CARD = {x:0,y:0,w:0,h:0};
    let item = { label:'', name:'', img:'', power:'약' };
    let pic = null;

    const S = { progress:0, dragging:false, grabOff:0, pointerY:.5, bulge:0,
                wobA:0, wobV:0, vx:0, lastX:0, auto:null, revealed:false, rt:0,
                sparks:[], flash:0 };

    const api = { onDone:null, onProgress:null };

    function fx(){ return POWER[item.power] || POWER.약; }
    const W = () => CARD.w, H = () => CARD.h;

    function resize(){
      const r = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio||1, 2);
      MW = Math.round(r.width); MH = Math.round(r.height);
      cv.width = Math.round(MW*dpr); cv.height = Math.round(MH*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      // 제비는 실물처럼 가로로 길다. 화면 가운데 살짝 위에 놓는다.
      CARD.w = Math.round(MW*0.90);
      CARD.h = Math.round(CARD.w*0.44);
      CARD.x = Math.round((MW-CARD.w)/2);
      CARD.y = Math.round(MH*0.46 - CARD.h/2);
    }
    window.addEventListener('resize', resize);

    function reset(){
      Object.assign(S,{progress:0,dragging:false,bulge:0,wobA:0,wobV:0,vx:0,
        auto:null,revealed:false,rt:0,flash:0});
      S.sparks.length = 0;
    }

    function load(next){
      item = Object.assign({ label:'', name:'', img:'', power:'약' }, next||{});
      pic = null;
      if(item.img){
        const im = new Image();
        im.onload = () => { pic = im; };
        im.src = item.img;
      }
      reset();
    }

    /* ── 봉인지 분리선 — 거의 직선. 손가락 근처의 완만한 볼록과 미세한 탄성만 허용 ── */
    function baseEdge(){ return PAD + S.progress*(W()-PAD*2); }
    function frontAt(y){
      const b=baseEdge(), h=H(), t=y/h;
      const taper = 0.45 + 0.55*Math.sin(Math.PI*t);   // 위아래 끝은 조금 뒤처진다
      const dy = t - S.pointerY;
      const bulge = S.bulge*Math.exp(-dy*dy*7);
      const gentle = Math.sin(t*2.1+1.3)*1.5;          // 아주 완만한 불규칙(±1.5px)
      const spring = S.wobA*Math.sin(t*1.7+0.4);
      return b + (bulge+gentle+spring)*taper;
    }

    /* ── 입력 — 좌에서 우로 ── */
    function pt(e){ const r=host.getBoundingClientRect(); return {x:e.clientX-r.left, y:e.clientY-r.top}; }
    function onDown(e){
      if(S.revealed || S.auto) return;
      host.setPointerCapture(e.pointerId);
      const p=pt(e), cx=p.x-CARD.x, cy=p.y-CARD.y;
      S.dragging=true; S.grabOff=cx-baseEdge();
      S.pointerY=clamp(cy/H(),0,1); S.lastX=cx; S.vx=0;
    }
    function onMove(e){
      if(!S.dragging) return;
      const p=pt(e), cx=p.x-CARD.x, cy=p.y-CARD.y;
      S.vx=cx-S.lastX; S.lastX=cx;
      S.pointerY=clamp(cy/H(),0,1);
      S.wobV += S.vx*0.22;
      S.progress=clamp((cx-S.grabOff-PAD)/(W()-PAD*2),0,1);
      if(api.onProgress) api.onProgress(S.progress);
      if(S.progress>=OPEN_AT) onUp();   // 60% 이상 뜯으면 손을 안 놔도 나머지는 알아서 끝낸다
    }
    function onUp(){
      if(!S.dragging) return;
      S.dragging=false;
      // 60% 이상 뜯었으면 나머지는 알아서 끝낸다(끝까지 안 끌어도 다 열린다). 그 미만이면 그대로 둔다.
      if(S.progress>=OPEN_AT && !S.auto) S.auto={from:S.progress,to:1,t:0,dur:0.24,then:reveal};
    }
    host.addEventListener('pointerdown', onDown);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerup', onUp);
    host.addEventListener('pointercancel', onUp);

    function reveal(){
      S.revealed=true; S.rt=0; S.flash=1;
      Sfx.playReveal(item.power);   // 배경음은 그대로 깔린 채로, 공개음만 위에 얹는다
      const G=fx(), cx=MW*.5, cy=MH*.44;
      for(let i=0;i<G.particles;i++){
        const a=Math.random()*Math.PI*2, sp=60+Math.random()*440;
        S.sparks.push({ x:cx+(Math.random()-.5)*MW*.6, y:cy+(Math.random()-.5)*MH*.4,
          vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-40,
          life:0, max:.7+Math.random()*1.1, r:1+Math.random()*2.6 });
      }
      if(G.rainbow){
        S.stars=[]; S.conf=[]; S.rings=[0,.16,.32,.56].map(d=>({d}));
        for(let i=0;i<46;i++){
          const a=Math.random()*Math.PI*2, rr=(.12+Math.random()*.5)*Math.min(MW,MH)*1.1;
          S.stars.push({ x:MW*.5+Math.cos(a)*rr*.9, y:MH*.40+Math.sin(a)*rr*1.05,
            s:5+Math.random()*13, ph:Math.random()*6.28, sp:2.2+Math.random()*4, hue:Math.random()*360 });
        }
        for(let i=0;i<110;i++){
          S.conf.push({ x:Math.random()*MW, y:-Math.random()*MH*.9-10, vy:130+Math.random()*220,
            sw:Math.random()*6.28, sws:1.5+Math.random()*2.5, w:5+Math.random()*7, h:9+Math.random()*10,
            rot:Math.random()*6.28, vr:(Math.random()-.5)*9, hue:Math.random()*360 });
        }
      }
      if(api.onDone) setTimeout(()=>{ if(alive && api.onDone) api.onDone(); }, 900);
    }
    // 바쁠 때 직원이 쓴다. 봉인지를 건너뛰고 바로 공개한다.
    function skip(){ if(!S.revealed){ S.progress=1; S.auto=null; reveal(); } }

    function update(dt){
      if(S.auto){
        S.auto.t+=dt;
        const k=clamp(S.auto.t/S.auto.dur,0,1);
        S.progress=S.auto.from+(S.auto.to-S.auto.from)*easeIO(k);
        if(k>=1){ const th=S.auto.then; S.auto=null; if(th) th(); }
      }
      // 미세한 탄성 — 진폭을 작게 묶어 출렁임이 아니라 '떨림'으로만 남긴다
      S.wobV += (-96*S.wobA - 14*S.wobV)*dt;
      S.wobA  = clamp(S.wobA + S.wobV*dt, -3.2, 3.2);
      S.bulge += ((S.dragging?9:0)-S.bulge)*Math.min(1,dt*9);
      if(!S.dragging) S.vx*=0.86;
      if(S.revealed){
        S.rt+=dt; S.flash=Math.max(0,S.flash-dt*4.5);
        for(let i=S.sparks.length-1;i>=0;i--){
          const p=S.sparks[i];
          p.life+=dt; p.vy+=320*dt; p.vx*=.985; p.vy*=.985;
          p.x+=p.vx*dt; p.y+=p.vy*dt;
          if(p.life>p.max) S.sparks.splice(i,1);
        }
        if(S.conf) for(const c of S.conf){
          c.y+=c.vy*dt; c.sw+=c.sws*dt; c.x+=Math.sin(c.sw)*38*dt; c.rot+=c.vr*dt;
          if(c.y>MH+20){ c.y=-20; c.x=Math.random()*MW; }
        }
      }
    }

    function roundRect(x,y,w,h,r){
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(x,y,w,h,r); else ctx.rect(x,y,w,h);
    }

    function drawBg(){
      const G=fx(), [r,g,b]=glowOf(G), p=S.progress;
      ctx.fillStyle='#080a0f'; ctx.fillRect(0,0,MW,MH);
      const boost=S.revealed ? 1+G.bloom*Math.exp(-S.rt*3.2)*1.6 : 1;
      const a=(0.08+p*0.62)*boost, rad=(MH*.18+p*MH*.55)*boost;
      const gr=ctx.createRadialGradient(MW*.5,MH*.44,0,MW*.5,MH*.44,rad);
      gr.addColorStop(0,`rgba(${r},${g},${b},${clamp(a*.8,0,1)})`);
      gr.addColorStop(.45,`rgba(${r},${g},${b},${clamp(a*.28,0,1)})`);
      gr.addColorStop(1,`rgba(${r},${g},${b},0)`);
      ctx.fillStyle=gr; ctx.fillRect(0,0,MW,MH);
    }

    /* 제비 카드 — 봉인지 아래. 떼는 만큼 등급이 왼쪽부터 드러난다 */
    function drawCard(){
      const G=fx(), [r,g,b]=glowOf(G);
      ctx.save();
      roundRect(CARD.x,CARD.y,CARD.w,CARD.h,10); ctx.clip();
      const cg=ctx.createLinearGradient(CARD.x,CARD.y,CARD.x,CARD.y+CARD.h);
      cg.addColorStop(0,'#141a26'); cg.addColorStop(1,'#0b0f18');
      ctx.fillStyle=cg; ctx.fillRect(CARD.x,CARD.y,CARD.w,CARD.h);
      const al=clamp(S.progress*1.5,0,1);
      if(al>0.01){
        ctx.save();
        ctx.globalAlpha=al;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.font=`900 ${Math.round(CARD.h*0.46)}px "Pretendard","Malgun Gothic",sans-serif`;
        ctx.shadowColor=`rgba(${r},${g},${b},.95)`; ctx.shadowBlur=22;
        ctx.fillStyle=`rgb(${r},${g},${b})`;
        ctx.fillText(item.label, CARD.x+CARD.w*.5, CARD.y+CARD.h*.5);
        ctx.restore();
      }
      ctx.strokeStyle='rgba(255,255,255,.10)'; ctx.lineWidth=1;
      ctx.strokeRect(CARD.x+.5,CARD.y+.5,CARD.w-1,CARD.h-1);
      ctx.restore();
    }

    /* 봉인지.
       종이는 온전한 사각형 한 장이며 절대 찢어지지 않는다.
       접착면에서 분리된 부분은 반지름 R의 U턴으로 되접혀, 뒷면(접착면)을 위로 향한 채 누워 있다.
       그리는 것은 (1) 아직 붙어있는 앞면 (2) 되접힌 뒷면 (3) U턴 롤 (4) 그림자 — 이 넷뿐이다. */
    function drawSeal(){
      const w=W(), h=H();
      ctx.save();
      roundRect(CARD.x,CARD.y,CARD.w,CARD.h,10); ctx.clip();
      ctx.translate(CARD.x,CARD.y);

      const Rmax=Math.min(24.4, h*0.30), FORE=0.336;
      const geo=[];
      for(let y=0;y<=h+STEP;y+=STEP){
        const e=frontAt(Math.min(y,h));
        const s=Math.max(0,e-PAD);                 // 접착면에서 분리된 길이
        const R=Math.min(Rmax, s/Math.PI);         // 짧게 벗겨졌을 땐 작게 말린다
        const flat=Math.max(0, s-Math.PI*R);       // U턴 뒤로 눕는 평평한 구간
        geo.push({ y, e, R, backEnd: e - flat*FORE });
      }

      // 1) 되접힌 면이 접착면에 드리우는 그림자
      const off=Rmax*0.55+4;
      for(let i=0;i<geo.length-1;i++){
        const G=geo[i];
        if(G.e-G.backEnd<0.5) continue;
        ctx.fillStyle='rgba(0,0,0,.34)';
        // 반투명이라 스트립을 겹치지 않는다 (겹치면 줄무늬가 생긴다)
        ctx.fillRect(G.backEnd+off*0.5, G.y+off*0.35, G.e-G.backEnd, STEP);
      }
      // 2) 되접힌 뒷면 — 왼쪽 끝일수록 더 들려 조명을 받는다
      for(let i=0;i<geo.length-1;i++){
        const G=geo[i], bw=G.e-G.backEnd;
        if(bw<0.5) continue;
        const bg=ctx.createLinearGradient(G.backEnd,0,G.e,0);
        bg.addColorStop(0,   backColor(0.02, 0.05));
        bg.addColorStop(.55, backColor(0.10, 0.01));
        bg.addColorStop(1,   backColor(0.00, 0));
        ctx.fillStyle=bg; ctx.fillRect(G.backEnd, G.y, bw, STEP+1);
      }
      // 종이 원래 끝(단면) — 얇은 밝은 선 하나
      ctx.beginPath();
      for(let i=0;i<geo.length;i++){
        const G=geo[i];
        if(G.e-G.backEnd<0.5){ ctx.moveTo(G.backEnd,G.y); continue; }
        i===0 ? ctx.moveTo(G.backEnd,G.y) : ctx.lineTo(G.backEnd,G.y);
      }
      ctx.strokeStyle='rgba(255,252,244,.55)'; ctx.lineWidth=1.1; ctx.stroke();

      // 3) 아직 붙어있는 앞면 — 온전한 사각형의 나머지
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(geo[0].e,0);
      for(let i=1;i<geo.length;i++) ctx.lineTo(geo[i].e, Math.min(geo[i].y,h));
      ctx.lineTo(w+2,h); ctx.lineTo(w+2,-2); ctx.closePath();
      ctx.clip();
      const fg=ctx.createLinearGradient(0,0,w*.4,h);
      fg.addColorStop(0,`rgb(${FRONT[0]},${FRONT[1]},${FRONT[2]})`);
      fg.addColorStop(.6,'rgb(238,234,224)');
      fg.addColorStop(1,'rgb(226,221,209)');
      ctx.fillStyle=fg; ctx.fillRect(0,0,w,h);
      if(S.progress<0.06){
        ctx.globalAlpha=(0.06-S.progress)/0.06*0.75;
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#8d8878';
        ctx.font=`700 ${Math.round(Math.min(w*.055,15))}px "Pretendard","Malgun Gothic",sans-serif`;
        ctx.fillText('밀어서 떼기  →', w*.5, h*.5);
        ctx.globalAlpha=1;
      }
      ctx.restore();

      if(S.progress>0.001){
        // 4) U턴 롤이 앞면에 드리우는 그림자
        for(let i=0;i<geo.length-1;i++){
          const G=geo[i], x0=G.e+G.R, sw=G.R*1.1+8;
          const sg=ctx.createLinearGradient(x0,0,x0+sw,0);
          sg.addColorStop(0,'rgba(0,0,0,.42)');
          sg.addColorStop(.45,'rgba(0,0,0,.16)');
          sg.addColorStop(1,'rgba(0,0,0,0)');
          ctx.fillStyle=sg; ctx.fillRect(x0,G.y,sw,STEP);
        }
        // 5) U턴 롤 — 정점에서 밝고, 수직으로 서는 오른쪽 끝에서 어둡다
        for(let i=0;i<geo.length-1;i++){
          const G=geo[i];
          if(G.R<0.4) continue;
          const rg=ctx.createLinearGradient(G.e,0,G.e+G.R,0);
          [0,0.18,0.36,0.56,0.74,0.88,1].forEach(k => rg.addColorStop(k, backColor(k,0)));
          ctx.fillStyle=rg; ctx.fillRect(G.e,G.y,G.R,STEP+1);
        }
        // 롤이 접착면과 만나는 선 — 얇고 어둡게
        ctx.beginPath();
        for(let i=0;i<geo.length;i++){
          const G=geo[i], x=G.e+G.R;
          i===0 ? ctx.moveTo(x,G.y) : ctx.lineTo(x, Math.min(G.y,h));
        }
        ctx.strokeStyle='rgba(60,54,42,.55)'; ctx.lineWidth=1; ctx.stroke();
      }
      ctx.restore();
    }


    /* ── 무지개(A상) 공개 연출: 회전 광선 · 충격파 링 · 반짝이 별 · 색종이 · 무지개 글자 ── */
    const easeBack = t => { const c=1.70158; return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); };
    const rgbS = a => `rgb(${a[0]},${a[1]},${a[2]})`;
    function rbBack(){
      const t=S.rt, cx=MW*.5, cy=MH*.40, appear=easeOut(clamp(t/.8,0,1));
      const R=Math.hypot(MW,MH)*.62*appear;
      ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.translate(cx,cy);
      for(let layer=0;layer<2;layer++){
        const n=layer?10:18, dir=layer?-1:1, wd=layer?.34:.5;
        for(let i=0;i<n;i++){
          const a=dir*t*(layer?.28:.42)+i/n*Math.PI*2, hw=Math.PI/n*wd;
          const [r,g,b]=hueRgb(i*360/n+t*90+layer*40);
          const gr=ctx.createRadialGradient(0,0,0,0,0,R);
          const al=(layer?.30:.46)*(0.8+0.2*Math.sin(t*3+i));
          gr.addColorStop(0,`rgba(${r},${g},${b},${al})`);
          gr.addColorStop(.55,`rgba(${r},${g},${b},${al*.4})`);
          gr.addColorStop(1,`rgba(${r},${g},${b},0)`);
          ctx.fillStyle=gr; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,R,a-hw,a+hw); ctx.closePath(); ctx.fill();
        }
      }
      const hr=Math.min(MW,MH)*(.30+.03*Math.sin(t*4))*appear;
      const hg=ctx.createRadialGradient(0,0,0,0,0,hr);
      hg.addColorStop(0,'rgba(255,255,255,.85)'); hg.addColorStop(.35,'rgba(255,255,255,.28)'); hg.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(0,0,hr,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    function rbFront(){
      const t=S.rt, cx=MW*.5, cy=MH*.40;
      ctx.save(); ctx.globalCompositeOperation='lighter';
      for(const rg of S.rings||[]){
        const age=(t-rg.d)/1.15; if(age<=0||age>=1) continue;
        const rr=easeOut(age)*MW*.95, al=(1-age)*(1-age);
        ctx.lineWidth=Math.max(1,9*(1-age));
        if(ctx.createConicGradient){
          const cg=ctx.createConicGradient(t*2,cx,cy);
          for(let i=0;i<=6;i++) cg.addColorStop(i/6,`rgba(${hueRgb(i*60).join(',')},${al})`);
          ctx.strokeStyle=cg;
        } else ctx.strokeStyle=`rgba(${hueRgb(t*200).join(',')},${al})`;
        ctx.beginPath(); ctx.arc(cx,cy,rr,0,Math.PI*2); ctx.stroke();
      }
      for(const st of S.stars||[]){
        const tw=Math.max(0,Math.sin(t*st.sp+st.ph)); if(tw<.05) continue;
        const sz=st.s*tw*clamp(t/.5,0,1), [r,g,b]=hueRgb(st.hue+t*60);
        ctx.fillStyle=`rgba(255,255,255,${.9*tw})`;
        ctx.beginPath();
        ctx.moveTo(st.x,st.y-sz); ctx.quadraticCurveTo(st.x,st.y,st.x+sz*.55,st.y);
        ctx.quadraticCurveTo(st.x,st.y,st.x,st.y+sz); ctx.quadraticCurveTo(st.x,st.y,st.x-sz*.55,st.y);
        ctx.quadraticCurveTo(st.x,st.y,st.x,st.y-sz); ctx.fill();
        ctx.fillStyle=`rgba(${r},${g},${b},${.35*tw})`;
        ctx.beginPath(); ctx.arc(st.x,st.y,sz*.55,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      for(const c of S.conf||[]){
        const [r,g,b]=hueRgb(c.hue+t*40), sq=Math.abs(Math.cos(c.rot*.7));
        ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.rot); ctx.scale(1,.35+.65*sq);
        ctx.fillStyle=`rgba(${r},${g},${b},.92)`; ctx.fillRect(-c.w/2,-c.h/2,c.w,c.h);
        ctx.restore();
      }
      const vg=ctx.createRadialGradient(cx,MH*.5,MH*.30,cx,MH*.5,MH*.78);
      vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.55)');
      ctx.fillStyle=vg; ctx.fillRect(0,0,MW,MH);
    }
    function rbLabel(fs,x,y){
      const t=S.rt, pop=easeBack(clamp((t-.10)/.55,0,1)), lfs=Math.max(1,Math.round(fs*2.25*pop));
      ctx.save(); ctx.globalAlpha=clamp((t-.08)/.18,0,1); ctx.textAlign='center'; ctx.textBaseline='alphabetic';
      ctx.font=`900 ${lfs}px "Pretendard","Malgun Gothic",sans-serif`;
      const tw=ctx.measureText(item.label).width;
      const gr=ctx.createLinearGradient(x-tw/2,0,x+tw/2,0);
      for(let i=0;i<=6;i++) gr.addColorStop(i/6,rgbS(hueRgb(i*60+t*170)));
      ctx.lineJoin='round'; ctx.lineWidth=Math.max(4,lfs*.11); ctx.strokeStyle='rgba(20,10,40,.92)';
      ctx.strokeText(item.label,x,y);
      ctx.shadowColor=rgbS(hueRgb(t*140)); ctx.shadowBlur=30+12*Math.sin(t*6);
      ctx.fillStyle=gr; ctx.fillText(item.label,x,y);
      ctx.shadowBlur=0;
      ctx.lineWidth=Math.max(1.5,lfs*.035); ctx.strokeStyle='rgba(255,255,255,.95)'; ctx.strokeText(item.label,x,y);
      const sx=x-tw*.8+((t*.9)%1.6)*tw*1.1, sg=ctx.createLinearGradient(sx-tw*.12,0,sx+tw*.12,0);
      sg.addColorStop(0,'rgba(255,255,255,0)'); sg.addColorStop(.5,'rgba(255,255,255,.9)'); sg.addColorStop(1,'rgba(255,255,255,0)');
      ctx.globalCompositeOperation='lighter'; ctx.fillStyle=sg; ctx.fillText(item.label,x,y);
      ctx.restore();
    }
    function rbPlate(lines,fs,y0){
      const t=S.rt; let mw=0; lines.forEach(l=>{ mw=Math.max(mw,ctx.measureText(l).width); });
      const pw=Math.min(MW*.94,mw+fs*1.6), ph=fs*1.25*lines.length+fs*.55, x=MW*.5-pw/2, y=y0-fs*.95;
      ctx.save(); ctx.shadowBlur=0;
      roundRect(x,y,pw,ph,ph*.28);
      ctx.fillStyle='rgba(10,8,26,.66)'; ctx.fill();
      const bg=ctx.createLinearGradient(x,0,x+pw,0);
      for(let i=0;i<=6;i++) bg.addColorStop(i/6,rgbS(hueRgb(i*60-t*150)));
      ctx.lineWidth=3; ctx.strokeStyle=bg; ctx.stroke();
      ctx.restore();
    }

    function drawReveal(){
      const G=fx(), [r,g,b]=glowOf(G), [sr,sg,sb]=sparkOf(G);
      if(G.rainbow) rbBack();
      if(G.flare>0){
        const k=clamp(S.rt/.5,0,1), al=G.flare*(0.85*Math.exp(-S.rt*1.6)+0.12);
        ctx.save(); ctx.globalCompositeOperation='lighter';
        const fw=MW*(.35+easeOut(k)*.75);
        const lg=ctx.createLinearGradient(MW*.5-fw,0,MW*.5+fw,0);
        lg.addColorStop(0,'rgba(255,255,255,0)');
        lg.addColorStop(.5,`rgba(${sr},${sg},${sb},${al})`);
        lg.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=lg; ctx.fillRect(0,MH*.40-2.2,MW,4.4);
        for(let i=0;i<G.ring;i++){
          const rr=MW*(.22+i*.18)*(1+easeOut(k)*.5);
          ctx.strokeStyle=`rgba(${r},${g},${b},${al*.35})`; ctx.lineWidth=1.2;
          ctx.beginPath(); ctx.arc(MW*.5,MH*.40,rr,0,Math.PI*2); ctx.stroke();
        }
        ctx.restore();
      }

      const k=clamp((S.rt-.06)/.40,0,1), e=easeOut(k);
      if(pic && k>0){
        const pop=1+0.05*Math.exp(-S.rt*5)*Math.sin(S.rt*22);
        ctx.save();
        ctx.globalAlpha=e;
        const box=Math.min(MW*.76,MH*.42)*(0.86+0.14*e)*pop;
        const s=Math.min(box/pic.naturalWidth, box/pic.naturalHeight);
        const w=pic.naturalWidth*s, h=pic.naturalHeight*s;
        const bob=G.rainbow ? Math.sin(S.rt*2.4)*MH*.008 : 0;
        ctx.drawImage(pic, MW*.5-w/2, MH*.40-h/2+bob, w, h);
        ctx.restore();
      }

      ctx.save(); ctx.globalCompositeOperation='lighter';
      for(const p of S.sparks){
        const t=p.life/p.max, al=(1-t)*(1-t);
        ctx.fillStyle=`rgba(${sr},${sg},${sb},${al})`;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(1-t*.4),0,Math.PI*2); ctx.fill();
      }
      ctx.restore();

      if(k>0){
        const fs=Math.round(Math.min(MW*.105,MH*.05));
        if(G.rainbow) rbLabel(fs, MW*.5, MH*.70);
        else {
        ctx.save();
        ctx.globalAlpha=e*.92; ctx.textAlign='center';
        ctx.font=`800 ${Math.round(fs*1.2)}px "Pretendard","Malgun Gothic",sans-serif`;
        ctx.fillStyle=`rgb(${r},${g},${b})`;
        ctx.shadowColor=`rgba(${r},${g},${b},.9)`; ctx.shadowBlur=18;
        ctx.fillText(item.label, MW*.5, MH*.70);
        ctx.restore();
        }
        ctx.save();
        ctx.globalAlpha=e; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.font=`800 ${fs}px "Pretendard","Malgun Gothic",sans-serif`;
        ctx.shadowColor='rgba(0,0,0,.8)'; ctx.shadowBlur=10;
        ctx.fillStyle='#fff';
        // 상품명이 길면 두 줄로 접는다 (폰 폭이 좁다)
        const maxw=MW*.86;
        let lines=[item.name];
        if(ctx.measureText(item.name).width>maxw){
          const sp=item.name.lastIndexOf(' ', Math.floor(item.name.length*0.62));
          if(sp>0) lines=[item.name.slice(0,sp), item.name.slice(sp+1)];
        }
        if(G.rainbow) rbPlate(lines,fs,MH*.78);
        lines.forEach((ln,i)=>ctx.fillText(ln, MW*.5, MH*.78+i*fs*1.25));
        ctx.restore();
      }
      if(G.rainbow) rbFront();
      if(S.flash>0){ ctx.fillStyle=`rgba(255,255,255,${S.flash*.9})`; ctx.fillRect(0,0,MW,MH); }
    }

    // 밀라는 신호. 손가락 점이 좌에서 우로 흐른다.
    function drawHint(){
      if(S.progress>0.06 || S.revealed) return;
      const a=(0.06-S.progress)/0.06;
      const t=(performance.now()%1600)/1600;
      ctx.save();
      ctx.globalAlpha=a*(0.30+0.45*Math.sin(t*Math.PI));
      ctx.fillStyle='#fff';
      ctx.beginPath();
      ctx.arc(CARD.x+CARD.w*(0.10+0.55*t), CARD.y+CARD.h*.5, 13, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    let last=performance.now();
    function frame(now){
      if(!alive) return;
      const dt=Math.min(.032,(now-last)/1000); last=now;
      update(dt);
      ctx.clearRect(0,0,MW,MH);
      drawBg();
      // 다 뗀 뒤에는 제비가 물러나고 상품이 그 자리에 올라온다
      const exit = S.revealed ? clamp(S.rt/0.32,0,1) : 0;
      if(exit<1){
        ctx.save();
        if(exit>0){ const e=easeOut(exit); ctx.globalAlpha=1-e; ctx.translate(0, e*MH*0.10); }
        drawCard(); drawSeal(); drawHint();
        ctx.restore();
      }
      if(S.revealed){
        const shake = fx().rainbow ? 10*Math.exp(-S.rt*6) : 0;
        if(shake>.15){ ctx.save(); ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake); drawReveal(); ctx.restore(); }
        else drawReveal();
      }
      raf=requestAnimationFrame(frame);
    }

    function destroy(){
      alive=false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onUp);
      if(cv.parentNode) cv.parentNode.removeChild(cv);
    }

    resize();
    raf=requestAnimationFrame(t=>{ last=t; frame(t); });

    Object.assign(api, { load, reset, skip, destroy, resize,
                         get progress(){ return S.progress; },
                         get revealed(){ return S.revealed; } });
    return api;
  }

  /* 관리자에서 등급마다 강도를 안 골랐을 때. 상위상(top)이면 강, 아니면 약. */
  function powerOf(tier, byTier){
    const v = (byTier||{})[tier.key];
    if(v==='약'||v==='중'||v==='강'||v==='무지개') return v;
    return tier.top ? '강' : '약';
  }

  return { mount, powerOf, POWER };
})();
