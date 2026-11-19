/* 보물찾기 연출 레이어 — 눈·파티클·흔들림·플래시·효과음·진동 */
(function(){
  var cv, ctx, W=0, H=0, DPR=1, parts=[], snow=[], raf=0, on=false, rain=0;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COLS = { conf:['#C8102E','#E8344E','#0F4A2E','#2E8B57','#FFFFFF','#F2C14E'], gold:['#FFE27A','#F2C14E','#FFF6D0','#FFFFFF'], spark:['#FFFFFF','#FFF3C4'], dust:['#E9E3D6'] };

  /* 소리 */
  var AC=null, buf={};
  function ac(){ try{ if(!AC){ var C=window.AudioContext||window.webkitAudioContext; if(!C) return null; AC=new C(); } if(AC.state==='suspended') AC.resume(); }catch(e){ return null; } return AC; }
  function load(n){ var a=ac(); if(!a||buf[n]) return; buf[n]='…';
    fetch('../sfx/'+n+'.mp3').then(function(r){ return r.arrayBuffer(); })
      .then(function(b){ return new Promise(function(ok,no){ a.decodeAudioData(b,ok,no); }); })
      .then(function(d){ buf[n]=d; }).catch(function(){ delete buf[n]; }); }
  function sfx(n,v){ var a=ac(), b=buf[n]; if(!a) return; if(!b||b==='…') return load(n);
    try{ var s=a.createBufferSource(), g=a.createGain(); g.gain.value=v==null?.5:v; s.buffer=b; s.connect(g); g.connect(a.destination); s.start(); }catch(e){} }
  function prime(){ ['pop','boom','bonus','fanfare'].forEach(load); }
  function buzz(p){ if(navigator.vibrate) try{ navigator.vibrate(p); }catch(e){} }

  /* 캔버스 */
  function mount(){
    if(cv) return;
    cv=document.createElement('canvas'); cv.id='fxc';
    cv.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:21;pointer-events:none;display:none';
    document.body.appendChild(cv); ctx=cv.getContext('2d');
    window.addEventListener('resize', size);
  }
  function size(){ if(!cv) return; DPR=Math.min(2,window.devicePixelRatio||1); W=innerWidth; H=innerHeight; cv.width=W*DPR; cv.height=H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0); }
  function start(){
    mount(); size(); cv.style.display='block'; parts=[]; snow=[];
    for(var i=0;i<(RM?20:60);i++) snow.push({x:Math.random()*W,y:Math.random()*H,r:1+Math.random()*2.6,v:.35+Math.random()*.9,w:Math.random()*6});
    if(!on){ on=true; raf=requestAnimationFrame(loop); }
  }
  function stop(){ on=false; cancelAnimationFrame(raf); parts=[]; rain=0; if(cv){ ctx.clearRect(0,0,W,H); cv.style.display='none'; } }

  function burst(x,y,n,kind,o){
    o=o||{}; var cols=o.cols||COLS[kind]||COLS.conf; if(RM) n=Math.ceil(n/3);
    for(var i=0;i<n;i++){
      var a=(o.up? -Math.PI/2+(Math.random()-.5)*(o.spread||1.6) : Math.random()*Math.PI*2), sp=(o.sp||6)*(.45+Math.random()*.8);
      parts.push({k:kind,x:x+(Math.random()-.5)*(o.w||0),y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,g:kind==='dust'?-.02:(kind==='spark'?.12:.2),
        life:0,max:(o.life||70)*(.7+Math.random()*.6),s:kind==='dust'?10+Math.random()*14:(kind==='spark'?2+Math.random()*2.5:6+Math.random()*6),
        rot:Math.random()*6,vr:(Math.random()-.5)*.4,c:cols[Math.floor(Math.random()*cols.length)]});
    }
  }
  function confettiRain(ms){ rain=Date.now()+ms; }

  function loop(){
    if(!on) return;
    ctx.clearRect(0,0,W,H);
    // 눈
    ctx.fillStyle='rgba(255,255,255,.75)';
    for(var i=0;i<snow.length;i++){ var f=snow[i]; f.y+=f.v; f.w+=.02; f.x+=Math.sin(f.w)*.35; if(f.y>H+4){ f.y=-4; f.x=Math.random()*W; } ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,7); ctx.fill(); }
    // 위에서 쏟아지는 색종이
    if(rain && Date.now()<rain && Math.random()<.7) parts.push({k:'conf',x:Math.random()*W,y:-10,vx:(Math.random()-.5)*1.5,vy:2+Math.random()*2,g:.04,life:0,max:220,s:6+Math.random()*6,rot:Math.random()*6,vr:(Math.random()-.5)*.3,c:COLS.gold.concat(COLS.conf)[Math.floor(Math.random()*10)]});
    for(var j=parts.length-1;j>=0;j--){
      var p=parts[j]; p.life++; if(p.life>p.max){ parts.splice(j,1); continue; }
      p.vx*=p.k==='conf'?.985:.96; p.vy=p.vy*(p.k==='conf'?.985:.96)+p.g; p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr;
      var t=1-p.life/p.max; ctx.globalAlpha=Math.min(1,t*1.6);
      if(p.k==='conf'){ ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.scale(1,Math.cos(p.rot*2)); ctx.fillStyle=p.c; ctx.fillRect(-p.s/2,-p.s/4,p.s,p.s/2); ctx.restore(); }
      else if(p.k==='dust'){ ctx.globalAlpha=t*.5; ctx.fillStyle=p.c; ctx.beginPath(); ctx.arc(p.x,p.y,p.s*(1.6-t*.6),0,7); ctx.fill(); }
      else { ctx.fillStyle=p.c; ctx.beginPath(); ctx.arc(p.x,p.y,p.s*t+.5,0,7); ctx.fill(); }
    }
    ctx.globalAlpha=1;
    raf=requestAnimationFrame(loop);
  }

  /* 화면 효과 */
  function shake(el,amp,ms){ if(RM||!el||!el.animate) return; amp=amp||8; var k=[]; for(var i=0;i<8;i++){ var f=1-i/8; k.push({transform:'translate('+((Math.random()-.5)*2*amp*f)+'px,'+((Math.random()-.5)*2*amp*f)+'px)'}); } k.push({transform:'none'}); el.animate(k,{duration:ms||380}); }
  function punch(el){ if(RM||!el||!el.animate) return; el.animate([{transform:'scale(1.07)'},{transform:'scale(1)'}],{duration:520,easing:'cubic-bezier(.2,.8,.2,1)'}); }
  function flash(color,ms){ var d=document.createElement('div'); d.style.cssText='position:fixed;inset:0;z-index:22;pointer-events:none;background:'+(color||'#fff'); document.body.appendChild(d);
    var a=d.animate?d.animate([{opacity:1},{opacity:0}],{duration:ms||420,easing:'ease-out'}):null; setTimeout(function(){ d.remove(); },ms||420); }
  function center(el){ var r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,top:r.top,w:r.width,h:r.height}; }

  window.HuntFX={start:start,stop:stop,burst:burst,rain:confettiRain,shake:shake,punch:punch,flash:flash,sfx:sfx,buzz:buzz,prime:prime,center:center};
  document.addEventListener('pointerdown', function once(){ prime(); document.removeEventListener('pointerdown',once); });
})();
