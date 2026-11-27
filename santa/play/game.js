(function(){
'use strict';
var $=function(i){return document.getElementById(i);};
function show(id){ document.querySelectorAll('.scr').forEach(function(s){s.classList.toggle('on',s.id===id);}); $('app').classList.toggle('playing',id==='sg'); $('app').classList.toggle('nosnd',id==='s3'||id==='s4'); }
function lsGet(k){ try{return localStorage.getItem(k);}catch(e){return null;} }
function lsSet(k,v){ try{localStorage.setItem(k,v);}catch(e){} }
function buzz(p){ if(navigator.vibrate) try{navigator.vibrate(p);}catch(e){} }
function rnd(a,b){ return a+Math.random()*(b-a); }
function pickOne(a){ return a[(Math.random()*a.length)|0]; }
function repop(el){ el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }

var LIST=CHARS.list, BYKEY={}; LIST.forEach(function(c){BYKEY[c.k]=c;});
function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=(Math.random()*(i+1))|0, t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

/* 친구 뽑기: 25명이 다 나올 때까지 같은 친구가 다시 안 나온다 */
var deck=[], met=[];
try{ deck=JSON.parse(lsGet('santa_play_deck')||'[]'); met=JSON.parse(lsGet('santa_play_met')||'[]'); }catch(e){}
deck=deck.filter(function(k){return BYKEY[k];}); met=met.filter(function(k){return BYKEY[k];});
var cur=LIST[0], lastKey='';
function draw(){
  if(!deck.length){ deck=shuffle(LIST.map(function(c){return c.k;})); if(deck[deck.length-1]===lastKey) deck.unshift(deck.pop()); }
  lastKey=deck.pop(); cur=BYKEY[lastKey];
  if(met.indexOf(lastKey)<0) met.push(lastKey);
  lsSet('santa_play_deck',JSON.stringify(deck)); lsSet('santa_play_met',JSON.stringify(met));
}

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

/* ───────── 시작 화면: 친구들이 번갈아 나온다 ───────── */
var peek=shuffle(LIST.slice()), pi=0;
function peekNext(){ if(!$('s0').classList.contains('on')) return; $('startArt').innerHTML=CHARS.face(peek[pi++%peek.length]); }
peekNext(); setInterval(peekNext,900);
var best=+lsGet('santa_play_best')||0;
function paintBest(){ $('s0best').innerHTML=best?'최고 기록 <em>'+best+'점</em>':''; }
paintBest();

/* ───────── 게임 ───────── */
var cv=$('cv'),ctx=cv.getContext('2d'),W=0,H=0,DPR=1,G=null;
var DUR=+(new URLSearchParams(location.search).get('t'))||10;
function resize(){ DPR=Math.min(window.devicePixelRatio||1,2); W=cv.clientWidth; H=cv.clientHeight; cv.width=W*DPR; cv.height=H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0); }
window.addEventListener('resize',function(){ if(G) resize(); });
function rr(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function circle(x,y,r,c){ ctx.fillStyle=c; ctx.beginPath(); ctx.arc(x,y,r,0,6.2832); ctx.fill(); }
function ellipse(x,y,rx,ry,c,rot){ ctx.fillStyle=c; ctx.beginPath(); ctx.ellipse(x,y,rx,ry,rot||0,0,6.2832); ctx.fill(); }
function starPath(r){ ctx.beginPath(); for(var i=0;i<10;i++){ var a=-1.5708+i*.62832, q=i%2?r*.5:r; ctx.lineTo(Math.cos(a)*q,Math.sin(a)*q); } ctx.closePath(); }
function heartPath(s){ ctx.beginPath(); ctx.moveTo(0,s*.8); ctx.bezierCurveTo(-s*1.5,-s*.15,-s*.6,-s*1.15,0,-s*.4); ctx.bezierCurveTo(s*.6,-s*1.15,s*1.5,-s*.15,0,s*.8); ctx.closePath(); }
function cuteFace(y,s){ circle(-s,y,s*.32,'#2b2230'); circle(s,y,s*.32,'#2b2230'); circle(-s+s*.1,y-s*.1,s*.11,'#fff'); circle(s+s*.1,y-s*.1,s*.11,'#fff'); ctx.strokeStyle='#2b2230'; ctx.lineWidth=Math.max(1.6,s*.2); ctx.lineCap='round'; ctx.beginPath(); ctx.arc(0,y+s*.25,s*.38,.35,2.8); ctx.stroke(); ellipse(-s*1.7,y+s*.55,s*.42,s*.26,'rgba(255,90,130,.45)'); ellipse(s*1.7,y+s*.55,s*.42,s*.26,'rgba(255,90,130,.45)'); }

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

function startGame(){
  SND.wake(); SND.stop(); show('sg'); resize();
  G={left:DUR,score:0,shown:0,bx:W/2,tx:W/2,px:W/2,sq:0,happy:0,items:[],fx:[],spawn:0,lastX:W/2,combo:0,since:9,count:1.5,step:4,fever:false,sec:-1,shake:0,starIn:rnd(1.5,3),last:performance.now(),run:true};
  $('score').textContent='0'; $('tbar').style.width='100%'; $('sec').textContent=DUR; $('sec').classList.remove('hurry'); $('hint').style.opacity=1; $('count').textContent='';
  var mine=G; requestAnimationFrame(function(t){ loop(t,mine); });
}
function pt(e){ var r=cv.getBoundingClientRect(); return e.clientX-r.left; }
['pointerdown','pointermove'].forEach(function(n){ cv.addEventListener(n,function(e){ if(!G) return; G.tx=pt(e); e.preventDefault(); },{passive:false}); });
function say(txt,x,y,col,size){ G.fx.push({type:'txt',x:x,y:y,t:0,txt:txt,col:col,size:size||32,life:.8}); }
function sparks(x,y,c,n){
  for(var i=0;i<n;i++){ var a=rnd(3.4,6.0), v=rnd(150,380); G.fx.push({type:'bit',x:x,y:y,t:0,dx:Math.cos(a)*v,dy:Math.sin(a)*v,c:i%3?c:pickOne(CS),shape:i%3,rot:rnd(0,6),life:.65}); }
  G.fx.push({type:'ring',x:x,y:y,t:0,life:.35,c:'#fff'});
}
function spawnItem(star){
  var reach=W*.55, x=Math.max(34,Math.min(W-34,G.lastX+rnd(-reach,reach))); G.lastX=x;
  var pg=1-G.left/DUR;
  G.items.push({kind:star?'star':pickOne(KINDS),c:pickOne(COLORS),x:x,y:-34,v:(300+150*pg)*rnd(.88,1.12),r:rnd(-.25,.25),ph:rnd(0,6)});
}
function loop(now,mine){
  if(G!==mine||!G.run) return;
  var dt=Math.min((now-G.last)/1000,.05); G.last=now;
  var playing=G.count<=0;
  if(!playing){
    /* 3 · 2 · 1 */
    G.count-=dt; var st=Math.ceil(G.count/.5);
    if(st!==G.step&&st>0){ G.step=st; $('count').textContent=st; repop($('count')); SND.play('count'); }
    if(G.count<=0){ $('count').textContent='시작!'; repop($('count')); SND.play('go'); SND.music(false); setTimeout(function(){ $('count').textContent=''; $('hint').style.opacity=0; },600); }
  } else {
    G.left-=dt; G.since+=dt;
    if(!G.fever&&G.left<=Math.min(3,DUR*.35)){ G.fever=true; flash(); SND.play('fever'); SND.music(true); say('선물 소나기!',W/2,H*.36,'#FFE066',44); }
    var s=Math.max(0,Math.ceil(G.left));
    if(s!==G.sec){ G.sec=s; $('sec').textContent=s; if(s<=3&&s>0){ $('sec').classList.add('hurry'); SND.play('tick'); } }
    G.spawn-=dt; if(G.spawn<=0){ G.spawn=G.fever?.15:.3; spawnItem(false); }
    G.starIn-=dt; if(G.starIn<=0){ G.starIn=G.fever?.7:rnd(1.8,2.8); spawnItem(true); }
    if(G.since>1.1) G.combo=0;
  }
  G.bx+=(G.tx-G.bx)*Math.min(1,dt*18);
  var lean=Math.max(-.22,Math.min(.22,(G.bx-G.px)*.012)); G.px=G.bx;
  var bw=Math.min(128,W*.32), by=H-98;
  G.sq=Math.max(0,G.sq-dt*5); G.happy-=dt; G.shake=Math.max(0,G.shake-dt*4);
  for(var i=G.items.length-1;i>=0;i--){
    var it=G.items[i]; it.y+=it.v*dt; it.ph+=dt*6;
    if(it.y>by-bw*.25&&it.y<by+bw*.3&&Math.abs(it.x-G.bx)<bw*.5+18){
      var isStar=it.kind==='star', add=isStar?30:10;
      G.combo=G.since<1.1?G.combo+1:1; G.since=0; G.sq=1; G.happy=.35;
      sparks(it.x,by-bw*.15,isStar?'#FFD23F':it.kind==='gyul'?'#FF9E1F':it.kind==='heart'?'#FF5D8F':it.c,isStar?22:10);
      say('+'+add,it.x,by-bw*.3,isStar?'#FFE066':'#fff',isStar?48:32);
      if(isStar){ G.shake=1; SND.play('star'); buzz(30); } else { SND.play('catch',G.combo-1); buzz(10); }
      if(G.combo%5===0){ add+=20; say(G.combo+'콤보! +20',W/2,H*.45,'#FFE066',40); SND.play('combo'); }
      G.score+=add; $('score').textContent=G.score; var sc_=$('score'); sc_.classList.remove('bump'); void sc_.offsetWidth; sc_.classList.add('bump');
      G.items.splice(i,1);
    } else if(it.y>H+50) G.items.splice(i,1);
  }
  ctx.save();
  scene(now,G.fever);
  if(G.shake>0) ctx.translate(rnd(-5,5)*G.shake,rnd(-5,5)*G.shake);
  G.items.forEach(function(it){ ctx.save(); ctx.translate(it.x,it.y); ctx.rotate(it.r+Math.sin(it.ph)*.18); ctx.scale(1.08,1.08); ITEM[it.kind](it.c); ctx.restore(); });
  bag(G.bx,by,bw,G.sq,G.happy,lean,now);
  for(var j=G.fx.length-1;j>=0;j--){
    var f=G.fx[j]; f.t+=dt; if(f.t>=f.life){ G.fx.splice(j,1); continue; }
    var k=f.t/f.life;
    ctx.save(); ctx.globalAlpha=Math.max(0,1-k*k);
    if(f.type==='bit'){ f.x+=f.dx*dt; f.y+=(f.dy+f.t*620)*dt; ctx.translate(f.x,f.y); ctx.rotate(f.rot+f.t*7); ctx.fillStyle=f.c; if(f.shape===0){ starPath(9); ctx.fill(); } else if(f.shape===1){ heartPath(7); ctx.fill(); } else circle(0,0,5,f.c); }
    else if(f.type==='ring'){ ctx.strokeStyle=f.c; ctx.lineWidth=6*(1-k); ctx.beginPath(); ctx.arc(f.x,f.y,14+62*k,0,6.2832); ctx.stroke(); }
    else { var sz=f.size*(k<.2?.6+k*2.6:1.12-Math.min(.12,(k-.2)*.6)), tx=Math.max(70,Math.min(W-70,f.x)), ty=f.y-k*70; if(f.size>=40&&Math.abs(f.x-W/2)<1) tx=W/2; ctx.font='800 '+sz+'px Paperlogy,sans-serif'; ctx.textAlign='center'; ctx.lineJoin='round'; ctx.lineWidth=7; ctx.strokeStyle='#2B2F6B'; ctx.strokeText(f.txt,tx,ty); ctx.fillStyle=f.col; ctx.fillText(f.txt,tx,ty); }
    ctx.restore();
  }
  ctx.restore();
  $('tbar').style.width=Math.max(0,G.left/DUR*100)+'%';
  if(G.left<=0){
    G.run=false; var sc=G.score; SND.stop(); SND.play('end'); $('count').textContent='끝!'; repop($('count'));
    setTimeout(function(){ if(G===mine){ G=null; $('count').textContent=''; toScore(sc); } },900); return;
  }
  requestAnimationFrame(function(t){ loop(t,mine); });
}

/* ───────── 점수 → 상자 ───────── */
function starIcon(on){ return '<svg viewBox="0 0 24 24"><path d="'+STARP+'" fill="'+(on?'#FFD23F':'#E9E2CF')+'" stroke="'+(on?'#EAA900':'#DAD1B9')+'" stroke-width="1.4" stroke-linejoin="round"/></svg>'; }
var BOX='<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">'+
  '<rect x="32" y="88" width="136" height="100" rx="18" fill="#E8384F"/><rect x="90" y="88" width="20" height="100" fill="#FFC62E"/>'+
  '<circle cx="72" cy="134" r="7" fill="#3a1020"/><circle cx="128" cy="134" r="7" fill="#3a1020"/><circle cx="74.500" cy="131.500" r="2.500" fill="#fff"/><circle cx="130.500" cy="131.500" r="2.500" fill="#fff"/><ellipse cx="58" cy="152" rx="11" ry="7" fill="#ffb3c0" opacity=".75"/><ellipse cx="142" cy="152" rx="11" ry="7" fill="#ffb3c0" opacity=".75"/><path d="M88 152q12 16 24 0" fill="none" stroke="#3a1020" stroke-width="5" stroke-linecap="round"/>'+
  '<g class="lid"><rect x="22" y="62" width="156" height="36" rx="16" fill="#FF5D6E"/><rect x="90" y="62" width="20" height="36" fill="#FFC62E"/>'+
  '<path d="M100 62C74 20 38 22 46 46Q54 66 100 62ZM100 62C126 20 162 22 154 46Q146 66 100 62Z" fill="#FFC62E" stroke="#E5A800" stroke-width="3"/><circle cx="100" cy="60" r="11" fill="#FFD95C" stroke="#E5A800" stroke-width="3"/></g></svg>';
var lastScore=0, lastStars=1, round=0, opening=false;
function toScore(n){
  var mine=++round; opening=false; lastScore=n; lastStars=n>=320?3:(n>=180?2:1);
  var isNew=n>best&&best>0; if(n>best){ best=n; lsSet('santa_play_best',n); paintBest(); }
  $('boxArt').className='box'; $('boxArt').innerHTML=BOX; $('pts').textContent='0'; $('rank').textContent=''; $('newRec').classList.remove('on');
  var st=$('stars'); st.innerHTML=''; for(var i=0;i<3;i++){ var e=document.createElement('i'); e.innerHTML=starIcon(false); st.appendChild(e); }
  show('s1');
  var t0=performance.now(), dur=900, lastTick=0;
  (function up(now){
    if(mine!==round) return;
    var k=Math.min(1,(now-t0)/dur); $('pts').textContent=Math.round(n*(1-Math.pow(1-k,2)));
    if(k<1){ if(now-lastTick>60){ lastTick=now; SND.play('point',k); } requestAnimationFrame(up); return; }
    for(var i=0;i<lastStars;i++) (function(i){ setTimeout(function(){ if(mine!==round) return; var e=st.children[i]; e.innerHTML=starIcon(true); e.className='on'; SND.play('ding',i); burst(e,8,60); },180+i*300); })(i);
    setTimeout(function(){ if(mine!==round) return; $('rank').textContent=['잘했어요!','우와, 대단해요!','선물 왕이에요!'][lastStars-1]; repop($('rank')); if(isNew) $('newRec').classList.add('on'); if(lastStars===3||isNew) confetti(50); },180+lastStars*300);
  })(t0);
}
function openBox(){
  if(opening) return; opening=true; SND.wake(); var mine=round, b=$('boxArt');
  b.classList.add('opening'); SND.play('drum'); buzz([20,60,20,60,40]);
  setTimeout(function(){ if(mine!==round) return; b.classList.remove('opening'); b.classList.add('burst'); SND.play('open'); burst(b,26,190); },850);
  setTimeout(function(){ if(mine!==round) return; reveal(); },1150);
}
function reveal(){
  draw();
  $('resArt').innerHTML=CHARS.face(cur);
  $('resName').textContent=cur.name+' 등장!';
  $('resMeta').textContent=lastScore+'점 · 만난 친구 '+met.length+'/'+LIST.length;
  show('s2'); flash(); repop($('resArt')); repop($('resName')); confetti(70);
  setTimeout(function(){ burst($('resArt'),20,180); },120);
}
/* 친구를 누르면 폴짝 */
$('resArt').onclick=function(){ var e=this; e.classList.remove('pop','hop'); void e.offsetWidth; e.classList.add('hop'); SND.wake(); SND.play('boing'); burst(e,12,150); };

/* ───────── 사진 ───────── */
var stream=null, shotBlob=null, camTurn=0, busy=false;
function stopCam(){ camTurn++; if(stream){ stream.getTracks().forEach(function(t){t.stop();}); stream=null; } }
function openCam(){
  stopCam(); var turn=camTurn; busy=false;
  show('s3'); $('camTip').textContent='얼굴을 가운데 맞춰요';
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
  var v=document.querySelector('#cam video'), PW=900, PH=1050, BH=230;
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
    x.fillStyle='#E8384F'; x.fillRect(0,PH,PW,8);
    x.textAlign='center'; x.textBaseline='alphabetic';
    x.fillStyle='#fff'; x.font='800 84px Paperlogy,sans-serif'; x.fillText('산타왔수다',PW/2,PH+104);
    x.fillStyle='#FFC62E'; x.font='800 46px Paperlogy,sans-serif'; x.fillText('12월 12일(토)~13일(일)',PW/2,PH+160);
    x.fillStyle='#fff'; x.font='800 34px Paperlogy,sans-serif'; x.fillText('중문 컨벤션 제2센터',PW/2,PH+206);
    if(r[3]){ var lh=64, lw=r[3].width*lh/r[3].height; x.drawImage(r[3],PW-lw-26,PH+22,lw,lh); }
    c.toBlob(function(b){ shotBlob=b; $('shotImg').src=URL.createObjectURL(b); stopCam(); show('s4'); busy=false; },'image/jpeg',.92);
  });
}
function save(){
  if(!shotBlob) return;
  var ua=navigator.userAgent||'', ios=/iPhone|iPad|iPod/i.test(ua);
  var f; try{ f=new File([shotBlob],'santa.jpg',{type:'image/jpeg'}); }catch(e){}
  /* 아이폰: 공유창의 "이미지 저장"이 가장 확실하다 */
  if(ios&&f&&navigator.canShare&&navigator.canShare({files:[f]})){ navigator.share({files:[f]}).catch(function(){}); return; }
  /* 안드로이드·PC: 바로 내려받는다 */
  var url=URL.createObjectURL(shotBlob), a=document.createElement('a'); a.href=url; a.download='santa.jpg'; document.body.appendChild(a); a.click();
  setTimeout(function(){ a.remove(); URL.revokeObjectURL(url); },4000);
  var t=$('saveTip'); if(t){ t.textContent='저장했어요! 갤러리·다운로드에서 봐요'; }
}

/* ───────── 버튼 ───────── */
function tap(fn){ return function(){ SND.wake(); SND.play('tap'); fn(); }; }
function again(){ round++; startGame(); }
$('bStart').onclick=tap(startGame);
$('bOpen').onclick=openBox;
$('boxArt').onclick=openBox;
$('bRetry').onclick=tap(again);
$('bAgain').onclick=tap(again);
$('bAgain2').onclick=tap(again);
$('bPhoto').onclick=tap(openCam);
$('bShot').onclick=capture;
$('bSave').onclick=save;
$('bRe').onclick=tap(openCam);
$('snd').innerHTML=SND.icon();
$('snd').onclick=function(){ SND.toggle(); this.innerHTML=SND.icon(); };
if(!SND.ok) $('snd').style.display='none';
document.addEventListener('visibilitychange',function(){
  if(document.hidden){ stopCam(); SND.stop(); }
  else if(G&&G.run){ G.last=performance.now(); if(G.count<=0) SND.music(G.fever); }
  else if($('s3').classList.contains('on')) openCam();
});
document.addEventListener('touchmove',function(e){ if(e.target.tagName!=='IMG') e.preventDefault(); },{passive:false});
window.__game={state:function(){return G;},toScore:toScore,reveal:reveal};
})();
