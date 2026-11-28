/* 홍보용(시청 거리) 번호 뽑기. 시간·점수 규칙은 11-25 확정값 그대로. */
(function(){
'use strict';
var API='https://asia-northeast3-psbjeju-kuji.cloudfunctions.net/';
var $=function(i){return document.getElementById(i);};
var NOSND=['sg','s5','s6'];
function show(id){ document.querySelectorAll('.scr').forEach(function(s){s.classList.toggle('on',s.id===id);}); $('app').classList.toggle('playing',id==='sg'); $('app').classList.toggle('nosnd',NOSND.indexOf(id)>-1); }
function api(fn,data){
  return fetch(API+fn,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:data||{}})})
    .then(function(r){ return r.json().catch(function(){ return {error:{message:'연결이 안 돼요'}}; }); })
    .then(function(j){ if(j.error){ var e=new Error(j.error.message||'다시 해 주세요'); e.status=j.error.status; throw e; } return j.result; },
          function(){ throw new Error('인터넷 연결을 확인해 주세요'); });
}
var tt; function toast(m,ms){ var t=$('toast'); t.textContent=m; t.classList.add('on'); clearTimeout(tt); tt=setTimeout(function(){t.classList.remove('on');},ms||2200); }
function lsGet(k){ try{return localStorage.getItem(k);}catch(e){return null;} }
function lsSet(k,v){ try{localStorage.setItem(k,v);}catch(e){} }
function buzz(p){ if(navigator.vibrate) try{navigator.vibrate(p);}catch(e){} }
function rnd(a,b){ return a+Math.random()*(b-a); }
function pickOne(a){ return a[(Math.random()*a.length)|0]; }
function repop(el){ el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }

var LIST=CHARS.list;
function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=(Math.random()*(i+1))|0, t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
var deck=[], cur=LIST[0];
function draw(){ if(!deck.length) deck=shuffle(LIST.slice()); cur=deck.pop(); return cur; }

/* ───────── 화면 효과 ───────── */
var CS=['#E8384F','#FFC62E','#2FBF8F','#3E8BFF','#B69CFF','#FF7BAC'];
var STARP='M12 1.5l3 6.600 7.200.800-5.400 4.900 1.500 7.100-6.300-3.700-6.300 3.700 1.500-7.100L1.800 8.900 9 8.100z';
var HEARTP='M12 21C-4 10 4 0 12 7C20 0 28 10 12 21z';
function shapeSvg(c,s){
  var k=(Math.random()*4)|0, in_=k===0?'<path d="'+STARP+'" fill="'+c+'"/>':k===1?'<path d="'+HEARTP+'" fill="'+c+'"/>':k===2?'<circle cx="12" cy="12" r="8" fill="'+c+'"/>':'<rect x="7" y="3" width="10" height="18" rx="3" fill="'+c+'"/>';
  return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24">'+in_+'</svg>';
}
function confetti(n){
  for(var i=0;i<(n||50);i++){ var d=document.createElement('i'); d.className='conf'; d.innerHTML=shapeSvg(CS[i%CS.length],rnd(12,24)|0); d.style.left=rnd(0,100)+'vw'; d.style.setProperty('--dx',rnd(-60,60)+'px'); d.style.animationDuration=rnd(1.6,3.2)+'s'; d.style.animationDelay=rnd(0,.5)+'s'; document.body.appendChild(d); setTimeout(function(x){x.remove();},4000,d); }
}
function burst(el,n,dist){
  var r=el.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
  for(var i=0;i<n;i++){ var d=document.createElement('i'), a=i/n*6.283+rnd(-.2,.2), l=rnd(dist*.55,dist); d.className='spark'; d.innerHTML=shapeSvg(CS[i%CS.length],rnd(16,34)|0); d.style.left=cx+'px'; d.style.top=cy+'px'; d.style.setProperty('--x',Math.cos(a)*l+'px'); d.style.setProperty('--y',Math.sin(a)*l+'px'); document.body.appendChild(d); setTimeout(function(x){x.remove();},900,d); }
}
function flash(){ var d=document.createElement('i'); d.className='flash'; document.body.appendChild(d); setTimeout(function(){d.remove();},400); }

/* ───────── 설정 ─────────
   선물 +1점 · 금색 선물 +3점 · 해골 −4점 · 시계 +2초 / T1점 이상 1번, T2점 이상 2번 뽑기 */
var QS=new URLSearchParams(location.search), T1=+QS.get('need')||30, T2=+QS.get('need2')||55, DUR=+QS.get('t')||20, PRACTICE=QS.get('practice')==='1';

var cv=$('cv'),ctx=cv.getContext('2d'),W=0,H=0,DPR=1,G=null;
function resize(){ DPR=Math.min(window.devicePixelRatio||1,2); W=cv.clientWidth; H=cv.clientHeight; cv.width=W*DPR; cv.height=H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0); }
window.addEventListener('resize',function(){ if(G) resize(); });
function rr(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function circle(x,y,r,c){ ctx.fillStyle=c; ctx.beginPath(); ctx.arc(x,y,r,0,6.2832); ctx.fill(); }
function ellipse(x,y,rx,ry,c,rot){ ctx.fillStyle=c; ctx.beginPath(); ctx.ellipse(x,y,rx,ry,rot||0,0,6.2832); ctx.fill(); }
function starPath(r){ ctx.beginPath(); for(var i=0;i<10;i++){ var a=-1.5708+i*.62832, q=i%2?r*.5:r; ctx.lineTo(Math.cos(a)*q,Math.sin(a)*q); } ctx.closePath(); }
function heartPath(s){ ctx.beginPath(); ctx.moveTo(0,s*.8); ctx.bezierCurveTo(-s*1.5,-s*.15,-s*.6,-s*1.15,0,-s*.4); ctx.bezierCurveTo(s*.6,-s*1.15,s*1.5,-s*.15,0,s*.8); ctx.closePath(); }
function cuteFace(y,s){ circle(-s,y,s*.32,'#2b2230'); circle(s,y,s*.32,'#2b2230'); circle(-s+s*.1,y-s*.1,s*.11,'#fff'); circle(s+s*.1,y-s*.1,s*.11,'#fff'); ctx.strokeStyle='#2b2230'; ctx.lineWidth=Math.max(1.6,s*.2); ctx.lineCap='round'; ctx.beginPath(); ctx.arc(0,y+s*.25,s*.38,.35,2.8); ctx.stroke(); ellipse(-s*1.7,y+s*.55,s*.42,s*.26,'rgba(255,90,130,.45)'); ellipse(s*1.7,y+s*.55,s*.42,s*.26,'rgba(255,90,130,.45)'); }
window.addEventListener('resize',function(){ if(G) resize(); });

/* 떨어지는 것들 */
var ITEM={
  gift:function(c){ ctx.fillStyle=c; rr(-21,-17,42,38,9); ctx.fill(); ctx.fillStyle='#fff'; ctx.fillRect(-4,-17,8,10); ellipse(-10,-22,10,7,'#fff',-.5); ellipse(10,-22,10,7,'#fff',.5); circle(0,-18,5,'#FFE066'); cuteFace(3,7.5); },
  candy:function(c){ ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(-14,0); ctx.lineTo(-31,-13); ctx.lineTo(-31,13); ctx.closePath(); ctx.moveTo(14,0); ctx.lineTo(31,-13); ctx.lineTo(31,13); ctx.fill(); circle(0,0,20,c); ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(0,0,14,3.4,4.6); ctx.stroke(); cuteFace(1,6.5); },
  gyul:function(){ circle(0,2,22,'#FF9E1F'); ellipse(10,-21,11,6,'#2f9a5c',-.5); ctx.fillStyle='#7a4a1f'; ctx.fillRect(-2,-24,4,7); ellipse(-10,-8,6,3.5,'rgba(255,255,255,.4)',-.6); cuteFace(3,7.5); },
  heart:function(){ heartPath(24); ctx.fillStyle='#FF5D8F'; ctx.fill(); ellipse(-13,-10,6,4,'rgba(255,255,255,.55)',-.6); cuteFace(-1,6.5); },
  star:function(){ circle(0,0,36,'rgba(255,240,150,.38)'); starPath(31); ctx.fillStyle='#FFD23F'; ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=3.5; ctx.lineJoin='round'; ctx.stroke(); cuteFace(2,6.5); }
};
var KINDS=['gift','gift','candy','gyul','heart'], COLORS=['#E8384F','#2FBF8F','#3E8BFF','#8E63E8','#FF7BAC'];

/* 받는 주머니: 눈이 있는 친구 */
function bag(x,y,w,sq,happy,lean,now){
  ctx.save(); ctx.translate(x,y+w*.55); ctx.rotate(lean); ctx.scale(1+sq*.14,1-sq*.16); ctx.translate(0,-w*.55);
  ellipse(0,w*.58,w*.46,w*.08,'rgba(30,80,50,.22)');
  ctx.fillStyle='#E8384F'; ctx.beginPath(); ctx.moveTo(-w*.46,-w*.1); ctx.bezierCurveTo(-w*.68,w*.3,-w*.54,w*.58,-w*.24,w*.58); ctx.lineTo(w*.24,w*.58); ctx.bezierCurveTo(w*.54,w*.58,w*.68,w*.3,w*.46,-w*.1); ctx.closePath(); ctx.fill();
  var u=w*.075;
  if(happy>0){ ctx.strokeStyle='#3a1020'; ctx.lineWidth=u*.55; ctx.lineCap='round'; [-1,1].forEach(function(s){ ctx.beginPath(); ctx.arc(s*u*2.1,w*.22,u*.75,3.5,5.9); ctx.stroke(); }); ctx.fillStyle='#3a1020'; ctx.beginPath(); ctx.arc(0,w*.29,u*1.2,0,3.1416); ctx.fill(); ellipse(0,w*.29+u*.75,u*.6,u*.35,'#FF8FA8'); }
  else { var blink=(now%2600)<120; [-1,1].forEach(function(s){ ellipse(s*u*2.1,w*.21,u*.72,blink?u*.12:u*.9,'#3a1020'); if(!blink) circle(s*u*2.1+u*.25,w*.21-u*.3,u*.28,'#fff'); }); ctx.strokeStyle='#3a1020'; ctx.lineWidth=u*.5; ctx.lineCap='round'; ctx.beginPath(); ctx.arc(0,w*.28,u*.8,.4,2.75); ctx.stroke(); }
  [-1,1].forEach(function(s){ ellipse(s*u*3.9,w*.32,u*1.05,u*.65,'rgba(255,190,200,.6)'); });
  ellipse(0,-w*.1,w*.46,w*.09,'#8f1830');
  ctx.strokeStyle='#fff'; ctx.lineWidth=w*.15; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(-w*.5,-w*.13); ctx.quadraticCurveTo(0,w*.1,w*.5,-w*.13); ctx.stroke();
  ctx.restore();
}

function cloud(x,y,s){ ctx.fillStyle='rgba(255,255,255,.85)'; [[0,0,22],[24,-10,27],[52,0,21],[26,6,25]].forEach(function(p){ ctx.beginPath(); ctx.arc(x+p[0]*s,y+p[1]*s,p[2]*s,0,6.2832); ctx.fill(); }); }
function scene(now,fever){
  var g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,fever?'#7B4BD6':'#4FB4F5'); g.addColorStop(1,fever?'#FF9EC4':'#C9ECFF');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  var span=W+160;
  cloud((now*.012)%span-90,H*.2,1); cloud((now*.007+W*.7)%span-90,H*.4,.75); cloud((now*.016+W*.35)%span-90,H*.58,.55);
  for(var i=0;i<14;i++){ var tw=.35+.65*Math.abs(Math.sin(now*.004+i)); ctx.save(); ctx.translate((i*97)%W,90+(i*131)%(H*.55)); ctx.globalAlpha=tw*(fever?1:.55); starPath(fever?9:6); ctx.fillStyle=fever?'#FFE066':'#fff'; ctx.fill(); ctx.restore(); }
  ctx.globalAlpha=1;
  ellipse(W*.15,H+30,W*.75,115,'#8FDB86'); ellipse(W*.92,H+42,W*.7,120,'#72C96F'); ctx.fillStyle='#72C96F'; ctx.fillRect(0,H-26,W,26);
  for(var f=0;f<7;f++){ var fx=(f*.151+.05)*W, fy=H-20-(f*37)%30; for(var p=0;p<5;p++) circle(fx+Math.cos(p*1.2566)*5,fy+Math.sin(p*1.2566)*5,3.8,f%2?'#fff':'#FFC9DD'); circle(fx,fy,3,'#FFD23F'); }
}

function skull(){
  circle(0,-3,24,'rgba(60,10,60,.35)');
  ctx.fillStyle='#fff'; ctx.strokeStyle='#2A1838'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(0,-3,19,2.45,.69); ctx.lineTo(11,21); ctx.lineTo(-11,21); ctx.closePath(); ctx.fill(); ctx.stroke();
  ellipse(-7.5,-2,6,7,'#2A1838',.25); ellipse(7.5,-2,6,7,'#2A1838',-.25); circle(-6.5,-3,2,'#FF4D5E'); circle(6.5,-3,2,'#FF4D5E');
  ctx.fillStyle='#2A1838'; ctx.beginPath(); ctx.moveTo(0,5); ctx.lineTo(-3.5,11); ctx.lineTo(3.5,11); ctx.fill();
  ctx.lineWidth=1.8; ctx.beginPath(); [-5,0,5].forEach(function(x){ ctx.moveTo(x,14); ctx.lineTo(x,21); }); ctx.stroke();
}
function clock(){
  circle(0,0,27,'rgba(125,255,196,.35)'); circle(-13,-18,7,'#2FD694'); circle(13,-18,7,'#2FD694'); circle(0,0,22,'#2FD694'); circle(0,0,17,'#fff');
  ctx.strokeStyle='#0F4A2E'; ctx.lineWidth=3; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-11); ctx.moveTo(0,0); ctx.lineTo(8,4); ctx.stroke();
}
var COL=['#E8384F','#2FBF8F','#3E8BFF','#8E63E8','#FF7BAC','#FF9230'];

function goalHtml(sc){ return '<b class="'+(sc>=T1?'on':'')+'">'+T1+'점 1번</b> · <b class="'+(sc>=T2?'on':'')+'">'+T2+'점 2번</b> 뽑기'; }
function startGame(){
  SND.stop(); show('sg'); resize();
  G={left:DUR,el:0,score:0,bx:W/2,tx:W/2,px:W/2,sq:0,happy:0,sad:0,items:[],fx:[],spawn:0,count:1.5,step:4,fever:false,sec:-1,shake:0,t1:false,t2:false,last:performance.now(),run:true};
  $('score').textContent='0점'; $('tbar').style.width='100%'; $('sec').textContent=DUR; $('sec').classList.remove('hurry'); $('goal').innerHTML=goalHtml(0); $('hint').style.opacity=1; $('count').textContent='';
  var mine=G; requestAnimationFrame(function(t){ loop(t,mine); });
}
function pt(e){ var r=cv.getBoundingClientRect(); return e.clientX-r.left; }
['pointerdown','pointermove'].forEach(function(n){ cv.addEventListener(n,function(e){ if(!G) return; G.tx=pt(e); e.preventDefault(); },{passive:false}); });
function say(txt,x,y,col,size){ G.fx.push({type:'txt',x:x,y:y,t:0,txt:txt,col:col,size:size||32,life:.65}); }
function sparks(x,y,c,n){
  for(var i=0;i<n;i++){ var a=rnd(3.4,6.0), v=rnd(150,360); G.fx.push({type:'bit',x:x,y:y,t:0,dx:Math.cos(a)*v,dy:Math.sin(a)*v,c:c,shape:i%3,rot:rnd(0,6),life:.5}); }
  G.fx.push({type:'ring',x:x,y:y,t:0,life:.3,c:c});
}
function sky(now,fever){
  var g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,fever?'#3B1466':'#162463'); g.addColorStop(1,fever?'#B0488F':'#4A74C9');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  for(var i=0;i<22;i++){ var tw=.3+.7*Math.abs(Math.sin(now*.003+i)); ctx.save(); ctx.translate((i*97)%W,100+(i*131)%(H*.66)); ctx.globalAlpha=tw*(fever?.9:.6); starPath(i%4?3.5:7); ctx.fillStyle='#FFF3B0'; ctx.fill(); ctx.restore(); }
  ctx.globalAlpha=1;
  ellipse(W*.15,H+30,W*.75,108,'#3E9C72'); ellipse(W*.92,H+42,W*.7,114,'#2F845F'); ctx.fillStyle='#2F845F'; ctx.fillRect(0,H-26,W,26);
  for(var f=0;f<7;f++){ var fx=(f*.151+.05)*W, fy=H-20-(f*37)%30; circle(fx,fy,3.4,f%2?'#FFE066':'#fff'); circle(fx,fy,8,f%2?'rgba(255,224,102,.22)':'rgba(255,255,255,.18)'); }
}
function loop(now,mine){
  if(G!==mine||!G.run) return;
  var dt=Math.min((now-G.last)/1000,.05); G.last=now;
  var playing=G.count<=0;
  if(!playing){
    G.count-=dt; var st=Math.ceil(G.count/.5);
    if(st!==G.step&&st>0){ G.step=st; $('count').textContent=st; repop($('count')); SND.play('count'); }
    if(G.count<=0){ $('count').textContent='시작!'; repop($('count')); SND.play('go'); SND.music(false); setTimeout(function(){ $('count').textContent=''; $('hint').style.opacity=0; },600); }
  } else {
    G.left-=dt; G.el+=dt;
    if(!G.fever&&G.left<=5){ G.fever=true; SND.music(true); say('마지막 힘내요!',W/2,H*.34,'#FFE066',38); }
    var s=Math.max(0,Math.ceil(G.left));
    if(s!==G.sec){ G.sec=s; $('sec').classList.toggle('hurry',s<=5&&s>0); if(s<=5&&s>0) SND.play('tick'); }
  }
  var pg=Math.min(1,G.el/DUR);   /* 진행도: 갈수록 빠르고 해골이 많아진다 */
  if(playing){ G.spawn-=dt; if(G.spawn<=0){
    G.spawn=.42-.2*pg; var r=Math.random(), kind='gift';
    var sk=.3+.14*pg; if(r<sk) kind='skull'; else if(r<sk+.04) kind='clock'; else if(r<sk+.04+.08) kind='gold';
    G.items.push({x:30+Math.random()*(W-60),y:-30,v:(280+280*pg)*(.85+Math.random()*.3),s:kind==='gold'?46:38,look:pickOne(KINDS),c:pickOne(COL),kind:kind,r:Math.random()*.6-.3,vr:Math.random()*2-1});
  } }
  G.bx+=(G.tx-G.bx)*Math.min(1,dt*16);
  var lean=Math.max(-.22,Math.min(.22,(G.bx-G.px)*.012)); G.px=G.bx;
  var bw=Math.min(84,W*.21), by=H-92;
  G.sq=Math.max(0,G.sq-dt*5); G.happy-=dt; G.shake=Math.max(0,G.shake-dt*4);
  for(var i=G.items.length-1;i>=0;i--){
    var it=G.items[i]; it.y+=it.v*dt; it.r+=it.vr*dt;
    if(playing&&it.y>by-bw*.15&&it.y<by+bw*.3&&Math.abs(it.x-G.bx)<bw*.5+it.s*.25){
      G.sq=1;
      if(it.kind==='clock'){ G.left+=2; say('+2초',it.x,by-bw*.35,'#7DFFC4',34); sparks(it.x,by-8,'#7DFFC4',10); SND.play('combo'); buzz(20); }
      else {
        var add=it.kind==='skull'?-4:(it.kind==='gold'?3:1); G.score=Math.max(0,G.score+add);
        $('score').textContent=G.score+'점'; $('goal').innerHTML=goalHtml(G.score);
        var b=$('score'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
        say((add>0?'+':'')+add,it.x,by-bw*.35,add<0?'#FF6B7A':(add>1?'#FFE066':'#fff'),add===1?30:42);
        if(add<0){ G.shake=1; G.happy=0; sparks(it.x,by-8,'#FF6B7A',10); SND.play('bad'); buzz([40,30,40]); }
        else { G.happy=.3; sparks(it.x,by-8,add>1?'#FFD23F':'#fff',add>1?16:7); if(add>1) SND.play('star'); else SND.play('catch',Math.min(9,G.score%10)); buzz(12); }
        if(!G.t1&&G.score>=T1){ G.t1=true; toast('1번 뽑기 달성!'); SND.play('fever'); }
        if(!G.t2&&G.score>=T2){ G.t2=true; toast('2번 뽑기 달성!!'); SND.play('fever'); }
      }
      G.items.splice(i,1);
    } else if(it.y>H+40) G.items.splice(i,1);
  }
  ctx.save();
  sky(now,G.fever);
  if(G.shake>0) ctx.translate(rnd(-3,3)*G.shake,rnd(-3,3)*G.shake);
  G.items.forEach(function(it){
    ctx.save(); ctx.translate(it.x,it.y); ctx.rotate(it.r*(it.kind==='gift'?1:.35));
    if(it.kind==='skull') skull(); else if(it.kind==='clock') clock(); else if(it.kind==='gold'){ ctx.scale(.88,.88); ITEM.star(); } else { ctx.scale(.9,.9); ITEM[it.look](it.c); }
    ctx.restore();
  });
  bag(G.bx,by,bw,G.sq,G.happy,lean,now);
  for(var j=G.fx.length-1;j>=0;j--){
    var f=G.fx[j]; f.t+=dt; if(f.t>=f.life){ G.fx.splice(j,1); continue; }
    var k=f.t/f.life;
    ctx.save(); ctx.globalAlpha=Math.max(0,1-k*k);
    if(f.type==='bit'){ f.x+=f.dx*dt; f.y+=(f.dy+f.t*620)*dt; ctx.translate(f.x,f.y); ctx.rotate(f.rot+f.t*7); ctx.fillStyle=f.c; if(f.shape===0){ starPath(7); ctx.fill(); } else if(f.shape===1){ heartPath(5.5); ctx.fill(); } else circle(0,0,4,f.c); }
    else if(f.type==='ring'){ ctx.strokeStyle=f.c; ctx.lineWidth=5*(1-k); ctx.beginPath(); ctx.arc(f.x,f.y,12+46*k,0,6.2832); ctx.stroke(); }
    else { var sz=f.size*(k<.2?.6+k*2.6:1.1), tx=Math.max(70,Math.min(W-70,f.x)), ty=f.y-k*60; if(f.size===38) tx=W/2; ctx.font='800 '+sz+'px Paperlogy,sans-serif'; ctx.textAlign='center'; ctx.lineJoin='round'; ctx.lineWidth=6; ctx.strokeStyle='#1B1440'; ctx.strokeText(f.txt,tx,ty); ctx.fillStyle=f.col; ctx.fillText(f.txt,tx,ty); }
    ctx.restore();
  }
  ctx.restore();
  $('tbar').style.width=Math.max(0,Math.min(100,G.left/DUR*100))+'%'; $('sec').textContent=Math.max(0,Math.ceil(G.left));
  if(G.left<=0){
    G.run=false; var sc=G.score; SND.stop(); SND.play('end'); $('count').textContent='끝!'; repop($('count'));
    setTimeout(function(){ if(G===mine){ G=null; $('count').textContent=''; endGame(sc); } },900); return;
  }
  requestAnimationFrame(function(t){ loop(t,mine); });
}

/* ───────── 서버 상태 ───────── */
var PID=lsGet('santa_promo_pid')||'', mineNow=null, taken={}, sel=0, total=500, poll=null, picking=false, picksLeft=0, gameLeft=1, starting=false;
function reset(){ lsSet('santa_promo_pid',''); PID=''; mineNow=null; gameLeft=1; picksLeft=0; toast('처음부터 다시 해요'); goHome(); }
function paintHome(){
  $('s0sub').innerHTML='<em>'+T1+'점</em> 이면 1번<br><em>'+T2+'점</em> 이면 2번 뽑기!'+(PRACTICE?'<br><span style="font-size:19px;opacity:.7">연습 중 · 몇 번이든 해요</span>':'');
  $('bStart').textContent=(PRACTICE||gameLeft>0)?(picksLeft>0?'번호 뽑으러 가기!':'미션 시작!'):'사진 찍고 한 번 더!';
  if(!PRACTICE&&picksLeft>0) $('bStart').textContent='번호 뽑으러 가기!';
  $('bMine').style.display=mineNow&&mineNow.picks.length?'block':'none';
}
function goHome(){ clearInterval(poll); paintHome(); show('s0'); }
function beginGame(){
  if(PRACTICE){ startGame(); return; }
  if(starting) return; starting=true;
  var join=PID?Promise.resolve():api('promoJoin',{}).then(function(r){ PID=r.pid; lsSet('santa_promo_pid',PID); });
  join.then(function(){ return api('promoStart',{pid:PID}); }).then(function(r){ starting=false; gameLeft=r.gameLeft; startGame(); })
  .catch(function(e){
    starting=false;
    if(e.status==='NOT_FOUND'){ reset(); return; }
    if(e.status==='FAILED_PRECONDITION'){ gameLeft=0; toast('사진을 보여주면 번호를 드려요'); goHome(); return; }
    toast(e.message);
  });
}

/* ───────── 점수 화면 ───────── */
var round=0;
function endGame(sc){
  var tier=sc>=T2?2:(sc>=T1?1:0), mine=++round, btn=$('bMNext');
  draw(); $('mArt').innerHTML=CHARS.face(cur); $('mArt').firstChild.style.cssText='width:min(46vw,190px,24vh)';
  $('pts').textContent='0'; $('mTitle').textContent=''; $('mSub').textContent=''; btn.style.visibility='hidden'; btn.disabled=false; show('s1');
  function next(text,fn){ btn.textContent=text; btn.onclick=tap(fn); btn.style.visibility='visible'; }
  function again(){ if(PRACTICE||gameLeft>0) next('다시 도전!',beginGame); else next('사진 찍고 한 번 더!',newShot); }
  function done(){
    if(!tier){ $('mTitle').innerHTML='아깝다!'; $('mSub').innerHTML=T1+'점 이상이면 뽑기!'; repop($('mTitle')); SND.play('lose'); again(); return; }
    SND.play('open'); confetti(tier===2?90:50); burst($('mArt'),22,180);
    $('mTitle').innerHTML=tier===2?'대단해요! <em>2번!</em>':'미션 <em>성공!</em>'; repop($('mTitle'));
    if(PRACTICE){ $('mSub').textContent='연습 중이라 뽑기는 안 해요'; again(); return; }
    send();
  }
  /* 성공 신고. 인터넷이 끊기면 점수를 버리지 않고 다시 보낸다 */
  function send(){
    $('mSub').textContent='잠깐만요…'; btn.style.visibility='hidden';
    api('promoMission',{pid:PID,tier:tier}).then(function(r){
      if(mine!==round) return;
      picksLeft=r.picksLeft; gameLeft=r.gameLeft; $('mSub').innerHTML='뽑기 <em>'+r.picksLeft+'번</em>'; next('번호 뽑으러 가기!',goBoard);
    }).catch(function(e){
      if(mine!==round) return;
      if(e.status==='NOT_FOUND') reset();
      else if(e.status==='FAILED_PRECONDITION'){ toast(e.message); sync(); }
      else { $('mSub').textContent=e.message; next('다시 보내기',send); }
    });
  }
  var t0=performance.now(), last=0;
  (function up(now){
    if(mine!==round) return;
    var k=Math.min(1,(now-t0)/800); $('pts').textContent=Math.round(sc*(1-Math.pow(1-k,2)));
    if(k<1){ if(now-last>60){ last=now; SND.play('point',k); } requestAnimationFrame(up); return; }
    done();
  })(t0);
}

/* ───────── 번호판 ───────── */
function paint(){
  var g=$('grid'), html='';
  if(!g.children.length){ for(var i=1;i<=total;i++) html+='<button class="t" data-n="'+i+'">'+i+'</button>'; g.innerHTML=html; }
  var cnt=0;
  if(sel&&taken[sel]) sel=0;
  Array.prototype.forEach.call(g.children,function(b){ var n=+b.dataset.n, x=!!taken[n]; if(x) cnt++; b.classList.toggle('x',x); b.disabled=x; b.classList.toggle('sel',n===sel&&!x); });
  $('left').textContent=total-cnt;
  $('leftSub').textContent='번호를 골라요 · 뽑기 '+picksLeft+'번 남음';
  $('bPick').textContent=sel?sel+'번 뽑기!':'아무 번호나 뽑기!';
}
function take(b){
  total=b.total; taken={}; b.taken.forEach(function(n){taken[n]=1;});
  if(b.mine){ mineNow=b.mine; picksLeft=b.mine.picksLeft; gameLeft=b.mine.gameLeft; }
}
function loadBoard(){ return api('promoBoard',{pid:PID}).then(function(b){ take(b); paint(); return b; }); }
/* 서버 상태에 맞는 화면으로 */
function sync(){
  api('promoBoard',{pid:PID}).then(function(b){
    take(b);
    if(!b.mine){ reset(); return; }
    if(picksLeft>0) goBoard(); else if(b.mine.picks.length) showResult(b.mine,true); else goHome();
  }).catch(function(e){ toast(e.message); goHome(); });
}
$('grid').addEventListener('click',function(e){ var b=e.target.closest('.t'); if(!b||b.disabled) return; var n=+b.dataset.n; sel=(sel===n?0:n); SND.wake(); SND.play('tap'); paint(); });
function goBoard(){
  show('s2'); sel=0; $('bPick').disabled=false; loadBoard().catch(function(e){ toast(e.message); });
  clearInterval(poll); poll=setInterval(function(){ if(!$('s2').classList.contains('on')) return; loadBoard().catch(function(){}); },4000);
}

/* ───────── 뽑기 ───────── */
var BOX='<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">'+
  '<rect x="32" y="88" width="136" height="100" rx="18" fill="#E8384F"/><rect x="90" y="88" width="20" height="100" fill="#FFC62E"/>'+
  '<circle cx="72" cy="134" r="7" fill="#3a1020"/><circle cx="128" cy="134" r="7" fill="#3a1020"/><circle cx="74.500" cy="131.500" r="2.500" fill="#fff"/><circle cx="130.500" cy="131.500" r="2.500" fill="#fff"/><ellipse cx="58" cy="152" rx="11" ry="7" fill="#ffb3c0" opacity=".75"/><ellipse cx="142" cy="152" rx="11" ry="7" fill="#ffb3c0" opacity=".75"/><path d="M88 152q12 16 24 0" fill="none" stroke="#3a1020" stroke-width="5" stroke-linecap="round"/>'+
  '<g class="lid"><rect x="22" y="62" width="156" height="36" rx="16" fill="#FF5D6E"/><rect x="90" y="62" width="20" height="36" fill="#FFC62E"/>'+
  '<path d="M100 62C74 20 38 22 46 46Q54 66 100 62ZM100 62C126 20 162 22 154 46Q146 66 100 62Z" fill="#FFC62E" stroke="#E5A800" stroke-width="3"/><circle cx="100" cy="60" r="11" fill="#FFD95C" stroke="#E5A800" stroke-width="3"/></g></svg>';
function doPick(){
  if(picking) return; picking=true; $('bPick').disabled=true; clearInterval(poll);
  $('wait').innerHTML=BOX; show('s3'); SND.wake(); SND.play('drum');
  var t0=Date.now();
  api('promoPick',{pid:PID,n:sel||0}).then(function(r){
    setTimeout(function(){ showResult(r); },Math.max(0,1300-(Date.now()-t0)));
  }).catch(function(e){
    picking=false; $('bPick').disabled=false;
    if(e.status==='ALREADY_EXISTS') toast('앗, 방금 다른 사람이 뽑았어요!');
    else if(e.status==='NOT_FOUND'){ reset(); return; }
    else if(e.status==='FAILED_PRECONDITION'){ toast('미션을 먼저 해요'); goHome(); return; }
    else toast(e.message);
    goBoard();
  });
}
/* 당첨 피규어: 반프레스토 15종 중 하나. 상품 코드로 정해서 다시 열어도 같은 피규어 */
var FIGS=[['luffy','원피스 몽키 D 루피'],['zoro','원피스 롤로노아 조로'],['sanji','원피스 상디'],['shanks','원피스 샹크스'],['buggy','원피스 버기'],
['enel','원피스 에넬'],['gojo','주술회전 고죠 사토루'],['aizen','블리치 아이젠 소스케'],['hitsu','블리치 히츠가야 토시로'],['broly','드래곤볼 브로리'],
['itachi','나루토 우치하 이타치'],['zenitsu','귀멸의 칼날 젠이츠'],['rem','Re:제로 렘'],['rimuru','전생슬 리무루'],['frieren','장송의 프리렌']];
function figOf(code){ var h=0; String(code).split('').forEach(function(c){ h=(h*31+c.charCodeAt(0))>>>0; }); return FIGS[h%FIGS.length]; }
function showResult(r,quiet){
  picking=false; clearInterval(poll);
  var ps=r.picks||[], win=null, last=ps[ps.length-1];
  ps.forEach(function(k){ if(k.win&&(!win||k.name==='피규어')) win=k; });
  picksLeft=r.picksLeft||0; gameLeft=r.gameLeft||0; mineNow={picks:ps};
  var justWin=last&&last.win;
  draw(); $('rArt').innerHTML=CHARS.face(cur); $('rArt').firstChild.style.cssText='width:min(40vw,170px,20vh)';
  $('rNo').textContent=ps.map(function(k){return k.n+'번';}).slice(-4).join(' · ');
  $('rCode').innerHTML=win?'<div class="code pop">'+win.code+'</div>':'';
  if(win&&win.name!=='피규어'){ $('rTitle').innerHTML='<em>간식</em> 당첨!'; $('rMsg').textContent='이 화면을 보여주고 간식 받아요!'; }
  else if(win){ var f=figOf(win.code); $('rArt').innerHTML='<img src="fig/'+f[0]+'.jpg" alt="" style="width:min(62vw,250px,30vh);border-radius:18px;border:4px solid #fff;box-shadow:0 6px 18px rgba(0,0,0,.25)">';
    $('rTitle').innerHTML='<em>'+f[1]+'</em><br>피규어 당첨!!'; $('rMsg').textContent='이 화면을 보여주고 피규어 받아요!'; }
  else if(last&&last.retry&&gameLeft>0){ $('rTitle').innerHTML='<em>게임 한 번 더!</em>'; $('rMsg').textContent='게임 한 번 더 하면 뽑기가 또 생겨요!'; }
  else { $('rTitle').innerHTML='<em>꽝!</em>'; $('rMsg').textContent='그날 와서 더 좋은 상품 뽑아요!'; }
  $('bMore').style.display=picksLeft>0?'block':'none'; $('bMore').textContent='한 번 더 뽑기! ('+picksLeft+'번)';
  $('bGame').style.display=(picksLeft<=0&&gameLeft>0)?'block':'none';
  $('bExtra').style.display=(picksLeft<=0&&gameLeft<=0)?'block':'none';
  show('s4'); repop($('rTitle')); repop($('rArt'));
  if(quiet) return;
  if(justWin){ flash(); SND.play('open'); confetti(110); setTimeout(function(){ burst($('rArt'),30,210); },120); }
  else if(last&&last.retry){ SND.play('open'); confetti(40); }
  else SND.play('lose');
}

/* ───────── 사진 ───────── */
var stream=null, shotBlob=null, camTurn=0, busy=false;
function stopCam(){ camTurn++; if(stream){ stream.getTracks().forEach(function(t){t.stop();}); stream=null; } }
function openCam(){
  stopCam(); var turn=camTurn; busy=false;
  show('s5'); $('camTip').textContent='얼굴을 가운데 맞춰요';
  var cam=$('cam'); cam.innerHTML='';
  function fallback(){ if(turn!==camTurn) return; cam.innerHTML='<div class="ph">'+CHARS.face(cur)+'</div>'; $('camTip').textContent='사진 대신 카드로 만들어요'; }
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ fallback(); return; }
  navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:1280}},audio:false}).then(function(s){
    if(turn!==camTurn){ s.getTracks().forEach(function(t){t.stop();}); return; }
    stream=s; var v=document.createElement('video'); v.setAttribute('playsinline',''); v.muted=true; v.autoplay=true; v.srcObject=s; cam.appendChild(v); v.play().catch(function(){});
    cam.insertAdjacentHTML('beforeend',CHARS.photo(cur,' class="ov"',true));
  }).catch(fallback);
}
function loadImg(src){ return new Promise(function(res){ var i=new Image(); i.onload=function(){res(i);}; i.onerror=function(){res(null);}; i.src=src; }); }
function svgImg(svg){ return loadImg('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)); }
function capture(){
  if(busy) return; busy=true;
  var v=document.querySelector('#cam video'), PW=900, PH=1050, BH=300;
  var c=document.createElement('canvas'); c.width=PW; c.height=PH+BH; var x=c.getContext('2d');
  var ready=(document.fonts&&document.fonts.load)?document.fonts.load('800 60px Paperlogy'):Promise.resolve();
  Promise.all([ready, svgImg(CHARS.photo(cur,' width="'+PW+'" height="'+PH+'"')), v?Promise.resolve(null):svgImg(CHARS.face(cur,' width="700" height="700"')), loadImg('../img/mhlogo.png')]).then(function(r){
    SND.play('shutter'); flash();
    if(v&&v.videoWidth){
      var vw=v.videoWidth, vh=v.videoHeight, tr=PW/PH, sw=vw, sh=vw/tr; if(sh>vh){ sh=vh; sw=vh*tr; }
      x.save(); x.translate(PW,0); x.scale(-1,1); x.drawImage(v,(vw-sw)/2,(vh-sh)/2,sw,sh,0,0,PW,PH); x.restore();
      if(r[1]) x.drawImage(r[1],0,0,PW,PH);
    } else { x.fillStyle='#DDF3FF'; x.fillRect(0,0,PW,PH); if(r[2]) x.drawImage(r[2],100,170,700,700); }
    x.fillStyle='#0F4A2E'; x.fillRect(0,PH,PW,BH);
    x.fillStyle='#E8384F'; x.fillRect(0,PH,PW,10);
    x.textAlign='center'; x.textBaseline='alphabetic';
    x.fillStyle='#FFC62E'; x.font='800 76px Paperlogy,sans-serif'; x.fillText('12월 12일',PW/2,PH+94);
    x.fillStyle='#fff'; x.font='800 124px Paperlogy,sans-serif'; x.fillText('산타왔수다',PW/2,PH+216);
    x.font='800 34px Paperlogy,sans-serif'; x.fillText('12일(토)~13일(일) · 중문 컨벤션 제2센터',PW/2,PH+274);
    if(r[3]){ var lh=46, lw=r[3].width*lh/r[3].height; x.drawImage(r[3],PW-lw-24,PH+30,lw,lh); }
    c.toBlob(function(b){ shotBlob=b; $('shotImg').src=URL.createObjectURL(b); stopCam(); show('s6'); busy=false; },'image/jpeg',.92);
  });
}
function newShot(){ draw(); openCam(); }
function save(){
  if(!shotBlob) return;
  var ua=navigator.userAgent||'', ios=/iPhone|iPad|iPod/i.test(ua);
  var f; try{ f=new File([shotBlob],'santa.jpg',{type:'image/jpeg'}); }catch(e){}
  if(ios&&f&&navigator.canShare&&navigator.canShare({files:[f]})){ navigator.share({files:[f]}).catch(function(){}); return; }
  var url=URL.createObjectURL(shotBlob), a=document.createElement('a'); a.href=url; a.download='santa.jpg'; document.body.appendChild(a); a.click();
  setTimeout(function(){ a.remove(); URL.revokeObjectURL(url); },4000);
  toast('저장했어요! 갤러리에서 봐요');
}

/* ───────── 번호 넣기 ───────── */
var typed='', sending=false;
function paintSlots(){ Array.prototype.forEach.call($('slots').children,function(s,i){ s.textContent=typed[i]||''; s.classList.toggle('f',!!typed[i]); }); }
function openCode(){ typed=''; sending=false; paintSlots(); show('s7'); }
$('keys').innerHTML=['1','2','3','4','5','6','7','8','9','','0','⌫'].map(function(k){ return k?'<button data-k="'+k+'">'+k+'</button>':'<span></span>'; }).join('');
$('keys').addEventListener('click',function(e){
  var b=e.target.closest('button'); if(!b||sending) return; SND.wake(); SND.play('tap');
  var k=b.dataset.k;
  if(k==='⌫') typed=typed.slice(0,-1); else if(typed.length<4) typed+=k;
  paintSlots(); if(typed.length===4) redeem();
});
function wrongCode(msg){ sending=false; typed=''; paintSlots(); var s=$('slots'); s.classList.remove('no'); void s.offsetWidth; s.classList.add('no'); SND.play('bad'); toast(msg); }
function redeem(){
  sending=true; var code=typed;
  if(PRACTICE){ goHome(); return; }
  var join=PID?Promise.resolve():api('promoJoin',{}).then(function(r){ PID=r.pid; lsSet('santa_promo_pid',PID); });
  join.then(function(){ return api('promoRedeem',{pid:PID,code:code}); }).then(function(r){
    sending=false; gameLeft=r.gameLeft; SND.play('open'); confetti(50); toast('도전권을 받았어요!'); beginGame();
  }).catch(function(e){ if(e.status==='NOT_FOUND') reset(); else wrongCode(e.message); });
}

/* ───────── 버튼 ───────── */
function tap(fn){ return function(){ SND.wake(); SND.play('tap'); fn(); }; }
$('bStart').onclick=tap(function(){
  if(!PRACTICE&&picksLeft>0) goBoard(); else if(PRACTICE||gameLeft>0) beginGame(); else newShot();
});
$('bMine').onclick=tap(function(){ api('promoBoard',{pid:PID}).then(function(b){ take(b); if(b.mine) showResult(b.mine,true); }).catch(function(e){ toast(e.message); }); });
$('bPick').onclick=doPick;
$('bMore').onclick=tap(goBoard);
$('bGame').onclick=tap(beginGame);
$('bExtra').onclick=tap(newShot);
$('bShot').onclick=capture;
$('bToCode').onclick=tap(openCode);
$('bSave').onclick=save;
$('bRe').onclick=tap(openCam);
$('bBackShot').onclick=tap(function(){ show('s6'); });
$('rArt').onclick=$('mArt').onclick=function(){ var e=this; e.classList.remove('pop','hop'); void e.offsetWidth; e.classList.add('hop'); SND.wake(); SND.play('boing'); burst(e,12,140); };
$('snd').innerHTML=SND.icon();
$('snd').onclick=function(){ SND.toggle(); this.innerHTML=SND.icon(); };
if(!SND.ok) $('snd').style.display='none';
document.addEventListener('visibilitychange',function(){
  if(document.hidden){ stopCam(); SND.stop(); }
  else if(G&&G.run){ G.last=performance.now(); if(G.count<=0) SND.music(G.fever); }
  else if($('s5').classList.contains('on')) openCam();
});
document.addEventListener('touchmove',function(e){ if(e.target.tagName!=='IMG'&&!(e.target.closest&&e.target.closest('.grid'))) e.preventDefault(); },{passive:false});

/* 시작 화면: 친구들이 번갈아 나온다 */
var peek=shuffle(LIST.slice()), pi=0;
function peekNext(){ if(!$('s0').classList.contains('on')) return; $('startArt').innerHTML=CHARS.face(peek[pi++%peek.length]); }
peekNext(); setInterval(peekNext,900);
paintHome();
/* 이미 뽑은 폰이면 결과를, 뽑기 권리만 있으면 번호판을 바로 보여준다 */
if(PID&&!PRACTICE) api('promoBoard',{pid:PID}).then(function(b){
  if(!$('s0').classList.contains('on')) return;
  if(!b.mine){ lsSet('santa_promo_pid',''); PID=''; return; }
  take(b);
  if(picksLeft>0) goBoard(); else if(b.mine.picks.length) showResult(b.mine,true); else paintHome();
}).catch(function(){});
window.__game={state:function(){return G;}};
})();
