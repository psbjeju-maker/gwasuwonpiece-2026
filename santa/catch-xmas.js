/* ============================================================
   산타왔수다 귤 자르기 — 크리스마스 특별 업데이트 (2026-11-19)
   과수원피스 catch-rank.html 엔진을 복사해 규칙·점수는 그대로 두고 아래만 바꿨다.
   - 배경: 제주 겨울밤 + 눈 / 썩은 귤 -> 석탄(-30) / 황금귤 -> 산타귤(모자, +80)
   - 새 아이템: 선물 상자(베면 +2초, 판마다 최대 3개)
   - 칭호·결과 카드 문구, 결과 카드는 앱과 같은 흰 바탕·남색 테두리
   CatchGame.start(onDone) — onDone(score,isBest,{combo,rotten,bonus,gift})
   ============================================================ */
window.CatchGame = (function () {
  var BEST_KEY = "santa_catch_best";
  var S = { best: { "catch": 0 } };
  try { S.best["catch"] = +localStorage.getItem(BEST_KEY) || 0; } catch (e) {}

  var stage = document.getElementById("catchStage");
  var cv = document.getElementById("catchCv"), ctx = cv.getContext("2d"), raf = null;
  var onDone = null;

  function soundOn() { try { return localStorage.getItem("ggg_sound_on") !== "0"; } catch (e) { return true; } }
  function openStage(title) {
    stage.hidden = false;
    document.body.classList.add("catch-on");
    document.getElementById("catchTitle").textContent = title;
    var w = document.getElementById("catchWrap");
    var sc = w.clientWidth < 700 ? 1.6 : 2; cv.width = Math.round(w.clientWidth * sc); cv.height = Math.round(w.clientHeight * sc);
  }
  function stopGame() {
    if (raf) cancelAnimationFrame(raf); raf = null;
    cv.onpointerdown = null; cv.onpointermove = null; cv.onpointerup = null; cv.onpointercancel = null;
    stage.hidden = true;
    document.body.classList.remove("catch-on");
  }
  var _bufs = {}, _loading = {};
  function actx() { _actx = _actx || new (window.AudioContext || window.webkitAudioContext)(); if (_actx.state === "suspended") _actx.resume(); return _actx; }
  function loadSfx(n) {
    if (_loading[n]) return; _loading[n] = 1;
    try {
      fetch("../sfx/" + n + ".mp3").then(function (r) { return r.arrayBuffer(); })
        .then(function (b) { return new Promise(function (ok, no) { actx().decodeAudioData(b, ok, no); }); })
        .then(function (buf) { _bufs[n] = buf; }, function () { _loading[n] = 0; });
    } catch (e) { _loading[n] = 0; }
  }
  function sfx(name, vol) {
    if (!soundOn()) return;
    try {
      var b = _bufs[name]; if (!b) { loadSfx(name); return; }
      var c = actx(), s = c.createBufferSource(), g = c.createGain();
      g.gain.value = vol == null ? 0.75 : vol; s.buffer = b; s.connect(g); g.connect(c.destination); s.start();
    } catch (e) {}
  }
  function preloadSfx() { if (soundOn()) ["slice", "pop", "boom", "bonus", "fanfare"].forEach(loadSfx); }
  var _actx = null;
  function beep(freq, dur, type, vol) {
    if (!soundOn()) return;
    try {
      actx();
      var t0 = _actx.currentTime, osc = _actx.createOscillator(), g = _actx.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.35), t0 + dur);
      g.gain.setValueAtTime(vol == null ? 0.16 : vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g); g.connect(_actx.destination);
      osc.start(t0); osc.stop(t0 + dur);
    } catch (e) {}
  }

/* --- ① 황금귤 캐치 --- */
/* 이미지 에셋 슬롯 — PNG만 교체하면 자동 적용. 로드 실패/미완료면 도형 폴백으로 그린다. */
var CATCH_DIR='../assets/catch-game/';
var CATCH_IMG={};
['orange_small','orange_normal','orange_big','orange_king','orange_gold','orange_legend','orange_rotten',
 'cross_section','juice1','juice2','juice3','juice_rotten','spark_big','spark_small','ring','smoke',
 'deco_wall','deco_fence','deco_rockbush','deco_grass1','deco_grass2','deco_rocks','deco_sign','deco_blossom',
 'cloud1','cloud2','leaf1','leaf2','chest','glow'].forEach(function(n){
  var im=new Image(); im.src=CATCH_DIR+n+'.png'; CATCH_IMG[n]=im;
});
function cimg(n){var im=CATCH_IMG[n];return (im&&im.complete&&im.naturalWidth>0)?im:null}
/* 이미지를 (x,y) 중심에 반지름 r 기준 크기로 그린다 — 원본 비율 유지, 폭 기준 */
function drawImgC(im,x,y,w,rot,alpha){
  var h=w*im.naturalHeight/im.naturalWidth;
  ctx.save();ctx.translate(x,y);if(rot)ctx.rotate(rot);if(alpha!=null)ctx.globalAlpha=alpha;
  ctx.drawImage(im,-w/2,-h/2,w,h);ctx.restore();
}

/* 귤 종류 — 반지름/필요 타격수/점수/낙하속도 배율.
   kind 는 이미지 슬롯 이름과 1:1. 색은 이미지가 없을 때의 폴백. */
var CATCH_KIND={
  small: {r:27, need:1, val:8,   vMul:1.25, img:'orange_small',  c1:'#FFB347',c2:'#E0741B'},
  normal:{r:40, need:1, val:12,  vMul:1,    img:'orange_normal', c1:'#FFA83A',c2:'#D96A14'},
  big:   {r:52, need:2, val:26,  vMul:0.8,  img:'orange_big',    c1:'#FFA83A',c2:'#D96A14'},
  king:  {r:66, need:3, val:46,  vMul:0.6,  img:'orange_king',   c1:'#FF9F2E',c2:'#CF5F10'},
  gold:  {r:44, need:1, val:80,  vMul:0.85, img:'orange_gold',   c1:'#FFE27A',c2:'#E5A11C', gold:true, hat:true},
  gift:  {r:46, need:1, val:20,  vMul:0.9,  img:'_gift',         c1:'#C8102E',c2:'#8E0B20', gift:true},
  legend:{r:80, need:3, val:100, vMul:0.42, img:'orange_legend', c1:'#FFF0A8',c2:'#E5A11C', gold:true, legend:true, hat:true},
  rotten:{r:42, need:1, val:-30, vMul:0.95, img:'_coal',         c1:'#3A3A44',c2:'#141418', rotten:true, coal:true}
};
/* 구간(0~8초 / 8~20초 / 20~30초 피버)별 등장 확률표 — 합이 1이 아니어도 됨(가중치) */
var CATCH_TABLE=[
  {normal:0.62, small:0.30, big:0.06, rotten:0.02, gold:0.00, king:0.00},
  {normal:0.30, small:0.18, big:0.12, king:0.08, rotten:0.42, gold:0.05, gift:0.07},
  {normal:0.24, small:0.16, big:0.12, king:0.08, rotten:0.40, gold:0.16, gift:0.07}
];
function pickCatchKind(phase){
  var t=CATCH_TABLE[phase],sum=0,k;for(k in t)sum+=t[k];
  var r=Math.random()*sum;for(k in t){r-=t[k];if(r<=0)return k}
  return 'normal';
}
function segPointDist(p0,p1,cx,cy){
  var dx=p1.x-p0.x, dy=p1.y-p0.y, len2=dx*dx+dy*dy;
  if(len2===0)return Math.hypot(cx-p0.x,cy-p0.y);
  var t=Math.max(0,Math.min(1,((cx-p0.x)*dx+(cy-p0.y)*dy)/len2));
  return Math.hypot(cx-(p0.x+t*dx), cy-(p0.y+t*dy));
}
/* 점수별 한 줄 칭호 — 결과 카드 재미 요소 */
function catchRank(s){
  if(s>=1400)return '산타의 오른손';
  if(s>=900)return '루돌프급 손놀림';
  if(s>=450)return '귤 배달 요정';
  return '눈사람 견습생';
}

var _bgC=null,_vigC=null;
function gCatch(){
  preloadSfx();
  openStage('귤 자르기 · 크리스마스');
  var W=cv.width,H=cv.height,dur=30000;
  /* 화면 크기 보정 — 375css px 폰(W=750) 기준으로 오브젝트·글자 크기와 낙하 속도를 맞춘다 */
  var U=Math.max(0.8,Math.min(1.7,W/750)),V=Math.max(0.8,Math.min(1.7,H/1334));
  /* ---- 상태 ---- */
  var items=[],pieces=[],fx=[],sprites=[],flashes=[],popups=[],banners=[],trail=[];
  var score=0,combo=0,comboUntil=0,bestCombo=0,cnt={fruit:0,gold:0,rotten:0,gift:0};
  var snow=[];for(var si=0;si<70;si++)snow.push({x:Math.random()*W,y:Math.random()*H,r:(1.5+Math.random()*3.5)*U,v:(0.6+Math.random()*1.4)*V,d:Math.random()*6.28});
  var elapsed=0,last=null,spawnT=600,hitStop=0,shakeT=0,shakeMag=0,zoom=1;
  var lastPt=null,strokeKills=[],ildoAt=-9999,lastSliceSnd=0,guided=false;
  var rotWave=false,bonusSec=0,fever=false,legendSpawned=false,countdownShown=0,finished=false,endT=0,resultReady=false,resultT=0;
  var flashAlpha=0,flashColor='#FFF';
  var bg=makeBg();
  var clouds=[{x:W*0.2,y:H*0.16,w:W*0.34,s:0.012,im:'cloud1'},{x:W*0.75,y:H*0.09,w:W*0.28,s:0.008,im:'cloud2'}];

  function pt(e){var r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)*(W/r.width),y:(e.clientY-r.top)*(H/r.height)}}
  function phase(){return elapsed<8000?0:(fever?2:1)}

  /* ---- 배경: 해 질 무렵 제주 귤밭. 한 번만 오프스크린에 그려두고 매 프레임 복사만 한다 ---- */
  function makeBg(){
    if(_bgC&&_bgC.width===W&&_bgC.height===H&&_bgC._ok)return _bgC;var c=_bgC||document.createElement('canvas');_bgC=c;c.width=W;c.height=H;var g=c.getContext('2d');
    /* 제주 겨울밤 — 남색 하늘, 눈 덮인 한라산, 눈 쌓인 귤밭. 귤이 가장 밝게 보이도록 배경은 어둡고 차분하게 */
    var sky=g.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#0D1733');sky.addColorStop(0.45,'#1B2A57');sky.addColorStop(0.62,'#34497F');sky.addColorStop(1,'#1F2D55');
    g.fillStyle=sky;g.fillRect(0,0,W,H);
    var mx=W*0.76,my=H*0.17,mr=W*0.07;
    var mg=g.createRadialGradient(mx,my,mr*0.6,mx,my,mr*3.2);mg.addColorStop(0,'rgba(255,246,220,.30)');mg.addColorStop(1,'rgba(255,246,220,0)');
    g.fillStyle=mg;g.fillRect(0,0,W,H);
    g.fillStyle='#FFF4D6';g.beginPath();g.arc(mx,my,mr,0,7);g.fill();
    for(var i=0;i<40;i++){g.fillStyle='rgba(255,255,255,'+(0.25+Math.random()*0.5)+')';g.fillRect(Math.random()*W,Math.random()*H*0.45,2,2)}
    function mtn(){g.beginPath();g.moveTo(0,H*0.50);g.bezierCurveTo(W*0.25,H*0.46,W*0.42,H*0.36,W*0.56,H*0.37);g.bezierCurveTo(W*0.7,H*0.38,W*0.85,H*0.46,W,H*0.5);g.lineTo(W,H*0.62);g.lineTo(0,H*0.62);g.closePath()}
    g.fillStyle='#3A4C7E';mtn();g.fill();
    g.save();mtn();g.clip();g.fillStyle='#DCE6F7';g.beginPath();g.moveTo(W*0.30,H*0.43);
    g.bezierCurveTo(W*0.42,H*0.36,W*0.62,H*0.35,W*0.78,H*0.43);g.lineTo(W*0.70,H*0.425);g.lineTo(W*0.62,H*0.44);g.lineTo(W*0.54,H*0.425);g.lineTo(W*0.45,H*0.445);g.lineTo(W*0.38,H*0.43);g.closePath();g.fill();g.restore();
    var field=g.createLinearGradient(0,H*0.56,0,H);field.addColorStop(0,'#C9D6EE');field.addColorStop(1,'#8EA2CC');
    g.fillStyle=field;g.beginPath();g.moveTo(0,H*0.58);g.quadraticCurveTo(W*0.3,H*0.55,W*0.55,H*0.58);g.quadraticCurveTo(W*0.8,H*0.61,W,H*0.57);g.lineTo(W,H);g.lineTo(0,H);g.fill();
    /* 제주 돌담 — 검은 현무암을 평평한 둥근 돌로 쌓고 위에 눈. 그림 에셋(초록 덤불)은 겨울과 안 맞아 쓰지 않는다 */
    var wy=H*0.80,sh=H*0.045,sw=W*0.11,row,x0;
    for(row=0;row<3;row++){
      x0=row%2?-sw*0.5:-sw*0.1;
      for(var x=x0;x<W+sw;x+=sw*1.02){
        var y=wy+row*sh*0.95,ww=sw*(0.88+((x*7+row*13)%10)/60),hh=sh*(0.9+((x*3+row)%7)/40);
        g.fillStyle=row===0?'#2B3150':'#232945';
        g.beginPath();g.ellipse(x+ww/2,y,ww/2,hh/2,0,0,7);g.fill();
        g.fillStyle='rgba(120,135,180,.35)';g.beginPath();g.ellipse(x+ww*0.38,y-hh*0.18,ww*0.18,hh*0.12,0,0,7);g.fill();
      }
    }
    for(x=-sw*0.1;x<W+sw;x+=sw*1.02){var ww2=sw*0.95;g.fillStyle='#F2F6FF';g.beginPath();g.ellipse(x+ww2/2,wy-sh*0.42,ww2*0.5,sh*0.22,0,0,7);g.fill()}
    g.fillStyle='#C9D6EE';g.fillRect(0,wy+sh*2.4,W,H-(wy+sh*2.4));
    var haze=g.createLinearGradient(0,0,0,H);haze.addColorStop(0,'rgba(10,18,45,.10)');haze.addColorStop(0.6,'rgba(20,32,70,.28)');haze.addColorStop(1,'rgba(10,18,45,.45)');
    g.fillStyle=haze;g.fillRect(0,0,W,H);
    c._ok=true;
    return c;
  }

  /* ---- 생성 ---- */
  var giftN=0;
  function spawnFruit(kind,x){
    if(kind==='gift'){if(giftN>=3)kind='normal';else giftN++}
    var k=CATCH_KIND[kind];
    var speed=(2.0+Math.random()*1.2+elapsed/22000)*k.vMul*(fever?1.12:1)*V,r=k.r*U;
    items.push({kind:kind,k:k,x:x!=null?x:r+40+Math.random()*(W-2*r-80),y:-r-20,r:r,need:k.need,hits:0,val:k.val,
      v:speed,rot:(Math.random()-.5)*0.6,vr:(Math.random()-.5)*(k.legend?0.004:0.02),marks:[],wob:0,born:elapsed});
    if(k.legend){legendSpawned=true;banner('전설의 산타귤!','legend');sfx('bonus',0.6);
      for(var i=0;i<18;i++){var a=Math.random()*6.283;sprites.push({im:'spark_small',x:items[items.length-1].x,y:40,vx:Math.cos(a)*3,vy:Math.sin(a)*3+1,w:40+Math.random()*30,life:1,dec:0.02,add:true})}}
    else if(k.gold){banner('산타귤!','gold');beep(1200,0.12,'triangle',0.08)}
  }
  function doSpawn(){
    var p=phase(),n=1,kind;
    if(p===0){spawnT=560-elapsed/40}
    else if(p===1){spawnT=Math.max(300,470-(elapsed-8000)/60);if(Math.random()<0.3)n=2}
    else{spawnT=Math.max(230,340-(elapsed-20000)/80);n=Math.random()<0.55?2:(Math.random()<0.3?3:1)}
    /* 전설의 황금귤: 15~25초 사이 판마다 최대 1회, 매 스폰 5% */
    if(!legendSpawned&&elapsed>15000&&elapsed<25000&&Math.random()<0.05){spawnFruit('legend',W*0.3+Math.random()*W*0.4);return}
    /* 방금 나온 귤들과 겹치지 않게 — 후보 3개 중 상단 귤들과 가장 먼 x 를 고른다 */
    var base=60+Math.random()*(W-120),bestD=-1;
    for(var c=0;c<3;c++){var cx=60+Math.random()*(W-120),md=1e9;
      items.forEach(function(it){if(it.y<H*0.35)md=Math.min(md,Math.abs(it.x-cx))});
      if(md>bestD){bestD=md;base=cx}}
    for(var i=0;i<n;i++){
      kind=pickCatchKind(p);
      /* 여러 개 동시 등장은 한 번에 그어 다 자를 수 있게 옆으로 나란히 */
      var x=n===1?base:Math.max(70*U,Math.min(W-70*U,base+(i-(n-1)/2)*110*U));
      spawnFruit(kind,x);
    }
  }

  /* ---- 이펙트 ---- */
  function juice(x,y,ang,kind,n){
    var cols=kind==='rotten'?['#3A3A44','#5A5A66','#1E1E24']:(kind==='gift'?['#FFFFFF','#C8102E','#FFE0E5']:(CATCH_KIND[kind].gold?['#FFE27A','#FFC83A','#FFF6D0']:['#FFB53A','#FF8E1F','#FFE0A0']));
    for(var i=0;i<n;i++){
      var side=(i%2===0)?1:-1,a=ang+Math.PI/2*side+(Math.random()-.5)*1.1,sp=2.5+Math.random()*6;
      fx.push({x:x,y:y,vx:Math.cos(a)*sp*U,vy:(Math.sin(a)*sp-1)*U,l:1,c:cols[i%3],sz:(2.5+Math.random()*3.5)*U,dec:0.035+Math.random()*0.02});
    }
    var jn=kind==='rotten'?'smoke':kind==='gift'?'spark_small':'juice'+(1+Math.floor(Math.random()*3));
    sprites.push({im:jn,x:x,y:y,rot:ang,w:CATCH_KIND[kind].r*U*2.4,w1:CATCH_KIND[kind].r*U*4.2,life:1,dec:0.07,add:kind!=='rotten'});
    if(CATCH_KIND[kind].gold){for(var j=0;j<6;j++){var a2=Math.random()*6.283;sprites.push({im:'spark_small',x:x,y:y,vx:Math.cos(a2)*2.5,vy:Math.sin(a2)*2.5-1,w:26+Math.random()*24,life:1,dec:0.03,add:true})}}
  }
  /* 잘린 귤 반쪽 — 절단면(과육)이 보이며 양쪽으로 갈라져 날아간다 */
  function splitFruit(it,ang){
    [1,-1].forEach(function(side){
      var a=ang+Math.PI/2*side;
      pieces.push({x:it.x,y:it.y,vx:Math.cos(a)*(2.6+Math.random()*1.8),vy:Math.sin(a)*(2.6+Math.random()*1.8)-2,
        rot:it.rot,vr:side*(0.08+Math.random()*.08),r:it.r,k:it.k,cut:ang,side:side,life:1});
    });
  }
  function shake(mag,t){if(mag>shakeMag){shakeMag=mag;shakeT=t}}
  function stop(ms){hitStop=Math.max(hitStop,ms)}
  function flash(c,a){flashColor=c;flashAlpha=Math.max(flashAlpha,a)}
  function popText(x,y,txt,c,size){popups.push({x:x,y:y,txt:txt,c:c,size:size||22,life:1,vy:-0.7})}
  function banner(txt,type){banners.push({txt:txt,type:type,t:0})}

  /* ---- 콤보 ---- */
  function updateCombo(x,y){
    if(elapsed<comboUntil)combo++;else combo=1;
    comboUntil=elapsed+900;bestCombo=Math.max(bestCombo,combo);
    if(combo>=2){
      var bonus=(combo-1)*3;score+=bonus;
      beep(480+Math.min(combo,12)*55,0.08,'square',0.07+Math.min(combo,10)*0.008);
      if(combo===5||combo===10||combo===15)flash('#FFF4D0',0.35);
      if(combo%5===0&&bonusSec<15&&!finished){var add=Math.min(combo>=20?2:1,15-bonusSec);bonusSec+=add;dur+=add*1000;
        popText(70*U,125*U,'+'+add+'초','#7CFFB0',34);banner('콤보 보너스 +'+add+'초!','bonus');beep(1500,0.15,'triangle',0.1)}
      if(combo>=5)juice(x,y,Math.random()*6.283,'normal',3);
    }
  }
  /* ---- 슬라이스 판정 ---- */
  function slice(p0,p1){
    var ang=Math.atan2(p1.y-p0.y,p1.x-p0.x),killed=0,kx=0,ky=0,moveLen=Math.hypot(p1.x-p0.x,p1.y-p0.y);
    if(elapsed-lastSliceSnd>110&&moveLen>6){lastSliceSnd=elapsed;sfx('slice',0.3)}
    for(var i=items.length-1;i>=0;i--){var it=items[i];
      /* 손가락이 귤 안에 머무는 동안은 1회만 — 빠져나갔다가(inside=false) 다시 들어오면 재타격.
         왕귤은 한 스트로크로 왔다갔다 그어도 여러 번 베이게 하기 위함 */
      var near=segPointDist(p0,p1,it.x,it.y)<it.r+18*U;
      if(!near){it.inside=false;continue}
      if(it.inside||elapsed-(it.lastHit||-999)<70)continue;
      /* 여러 번 타격이 필요한 큰 귤(대/왕/전설)은 제자리 탭(클릭)으로는 안 잘리고
         실제로 스쳐 지나가는 슬라이스일 때만 타격 — 탭 연타로 깎이는 것 방지 */
      if(it.need>1&&moveLen<8*U)continue;
      it.inside=true;it.lastHit=elapsed;
      {
        guided=true;
        if(it.k.rotten){
          score=Math.max(0,score-30);combo=0;cnt.rotten++;
          juice(it.x,it.y,ang,'rotten',14);shake(9,18);stop(50);
          sprites.push({im:'smoke',x:it.x,y:it.y,w:it.r*3,w1:it.r*5,life:1,dec:0.03,vy:-0.6});
          sfx('boom',0.45);popText(it.x,it.y-it.r-10*U,'-30','#FFD9B0',26);
          banner(Math.random()<0.5?'석탄이다!':'나쁜 아이 판정!','rotten');
          items.splice(i,1);continue;
        }
        it.hits++;it.marks.push(ang-it.rot);it.wob=1;
        if(it.hits>=it.need){
          score+=it.val;cnt.fruit++;splitFruit(it,ang);juice(it.x,it.y,ang,it.kind,it.k.gold?14:9);
          killed++;kx+=it.x;ky+=it.y;
          if(it.k.gift){cnt.gift++;dur+=2000;bonusSec+=2;flash('#FFFFFF',0.3);sfx('bonus',0.55);banner('선물 상자 +2초!','bonus');popText(it.x,it.y-it.r-12,'+2초','#7CFFB0',34)}
          if(it.k.legend){
            cnt.gold++;stop(130);shake(16,26);flash('#FFE9A8',0.7);sfx('boom',0.5);sfx('fanfare',0.7);
            flashes.push({x:it.x,y:it.y,t:0,r0:it.r,r1:it.r*5,c:'255,215,120'});
            banner('전설의 산타귤!  +100','legendhit');
            for(var j=0;j<22;j++){var a=Math.random()*6.283,sp=3+Math.random()*5;sprites.push({im:Math.random()<0.5?'spark_small':'spark_big',x:it.x,y:it.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,w:30+Math.random()*40,life:1,dec:0.018,add:true,grav:true})}
          }else if(it.k.gold){
            cnt.gold++;stop(60);flash('#FFE9A8',0.35);sfx('bonus',0.5);
            flashes.push({x:it.x,y:it.y,t:0,r0:it.r*0.5,r1:it.r*3,c:'255,215,120'});
            popText(it.x,it.y-it.r-12,'+'+it.val,'#FFD84A',34);
          }else{
            sfx('pop',it.k.need>1?0.6:0.45);stop(it.k.need>1?40:18);
            if(it.k.need>1)shake(4,8);
            popText(it.x,it.y-it.r-10,'+'+it.val,'#FFF3D6',it.k.need>1?26:20);
          }
          updateCombo(it.x,it.y);
          items.splice(i,1);
        }else{
          juice(it.x,it.y,ang,it.kind,5);sfx('pop',0.3);stop(25);
          if(it.k.legend){shake(5,8);flashes.push({x:it.x,y:it.y,t:0,r0:it.r*0.3,r1:it.r*1.8,c:'255,225,150'})}
        }
      }
    }
    /* 일도양단 — 한 번의 손놀림으로 3개 이상을 거의 동시에 */
    if(killed>0){
      strokeKills.push({t:elapsed,n:killed,x:kx/killed,y:ky/killed});
      strokeKills=strokeKills.filter(function(s){return elapsed-s.t<150});
      var tot=0,sx=0,sy=0;strokeKills.forEach(function(s){tot+=s.n;sx+=s.x*s.n;sy+=s.y*s.n});
      if(tot>=3&&elapsed-ildoAt>400){
        ildoAt=elapsed;stop(90);flash('#E6FFF7',0.45);shake(7,12);
        sfx('boom',0.35);beep(220,0.25,'sawtooth',0.12);
        banners.push({txt:'일도양단!',type:'ildo',t:0,x:sx/tot,y:Math.max(140,sy/tot-60)});
        score+=15;
      }
    }
  }
  cv.onpointerdown=function(e){e.preventDefault();items.forEach(function(it){it.inside=false});strokeKills=[];lastPt=pt(e);trail=[{x:lastPt.x,y:lastPt.y,t:elapsed}];if(finished){if(resultReady)finishCatch(score,{combo:bestCombo,rotten:cnt.rotten,bonus:bonusSec,gift:cnt.gift});return}slice(lastPt,lastPt)};
  cv.onpointermove=function(e){if(!lastPt||finished)return;var p=pt(e);slice(lastPt,p);lastPt=p;trail.push({x:p.x,y:p.y,t:elapsed});if(trail.length>22)trail.shift()};
  cv.onpointerup=function(){lastPt=null;items.forEach(function(it){it.inside=false});strokeKills=[]};
  cv.onpointercancel=cv.onpointerup;

  /* ---- 크리스마스 소품 — 이미지 없이 평평한 도형 ---- */
  function drawHat(r){
    ctx.save();ctx.translate(r*0.05,-r*0.62);ctx.rotate(0.22);
    ctx.fillStyle='#D7263D';ctx.beginPath();ctx.moveTo(-r*0.62,0);ctx.quadraticCurveTo(-r*0.1,-r*1.15,r*0.78,-r*0.95);ctx.quadraticCurveTo(r*0.25,-r*0.55,r*0.62,0);ctx.closePath();ctx.fill();
    ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(r*0.82,-r*0.95,r*0.17,0,7);ctx.fill();
    rrect(-r*0.72,-r*0.14,r*1.44,r*0.3,r*0.15);ctx.fill();
    ctx.restore();
  }
  var COAL=[[1,0],[.8,.55],[.35,.95],[-.3,.85],[-.85,.5],[-.95,-.1],[-.6,-.7],[-.05,-.95],[.55,-.75]];
  function drawCoal(r){
    ctx.fillStyle='#2A2A33';ctx.beginPath();COAL.forEach(function(p,i){var x=p[0]*r,y=p[1]*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.fill();
    ctx.fillStyle='#4A4A57';ctx.beginPath();ctx.moveTo(-r*.6,-r*.7);ctx.lineTo(-r*.05,-r*.95);ctx.lineTo(r*.2,-r*.2);ctx.lineTo(-r*.5,-r*.1);ctx.closePath();ctx.fill();
    ctx.fillStyle='#6A6A78';ctx.beginPath();ctx.moveTo(r*.2,-r*.2);ctx.lineTo(r*.55,-r*.75);ctx.lineTo(r,0);ctx.lineTo(r*.45,r*.15);ctx.closePath();ctx.fill();
  }
  function drawGift(r){
    var s=r*1.55,t=-s/2+r*0.12;
    ctx.fillStyle='#C8102E';ctx.fillRect(-s/2,t,s,s);
    ctx.fillStyle='#A00D25';ctx.fillRect(-s/2,t,s,s*0.22);
    ctx.fillStyle='#FFFFFF';ctx.fillRect(-s*0.09,t,s*0.18,s);ctx.fillRect(-s/2,t+s*0.42,s,s*0.16);
    ctx.beginPath();ctx.ellipse(-s*0.2,t-s*0.05,s*0.2,s*0.11,-0.5,0,7);ctx.fill();
    ctx.beginPath();ctx.ellipse(s*0.2,t-s*0.05,s*0.2,s*0.11,0.5,0,7);ctx.fill();
  }
  /* ---- 그리기: 귤 ---- */
  function drawFruit(it){
    var im=cimg(it.k.img),r=it.r;
    ctx.save();ctx.translate(it.x,it.y);
    if(it.wob>0){var w=Math.sin(it.wob*18)*it.wob*0.12;ctx.rotate(w);ctx.scale(1+it.wob*0.08,1-it.wob*0.08)}
    if(it.k.gold){
      var pulse=0.85+Math.sin(elapsed/140)*0.15,ring=cimg('ring');
      ctx.globalCompositeOperation='lighter';
      if(ring)drawImgC(ring,0,0,r*2.9*pulse,elapsed/900,it.k.legend?0.9:0.7);
      else{ctx.fillStyle='rgba(255,220,120,'+(0.25*pulse)+')';ctx.beginPath();ctx.arc(0,0,r*1.45,0,7);ctx.fill()}
      ctx.globalCompositeOperation='source-over';
    }
    ctx.rotate(it.rot);
    if(it.k.coal)drawCoal(r);
    else if(it.k.gift)drawGift(r);
    else if(im){var w=r*2.15;var h=w*im.naturalHeight/im.naturalWidth;ctx.drawImage(im,-w/2,-h*0.54,w,h)}
    else{
      var g2=ctx.createRadialGradient(-r*.3,-r*.3,2,0,0,r);g2.addColorStop(0,it.k.c1);g2.addColorStop(1,it.k.c2);
      ctx.fillStyle=g2;ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill();
      if(!it.k.rotten){ctx.fillStyle='#3E8F5B';ctx.fillRect(-3,-r-9,6,10)}
      else{ctx.fillStyle='#5F7A3A';ctx.beginPath();ctx.arc(r*.3,-r*.2,r*.25,0,7);ctx.fill()}
    }
    if(it.k.hat)drawHat(r);
    /* 칼자국 — 잘린 만큼 어두운 홈 + 밝은 테두리, 큰 귤일수록 여러 줄이 쌓인다 */
    it.marks.forEach(function(a){
      ctx.save();ctx.rotate(a);ctx.lineCap='round';
      ctx.strokeStyle='rgba(120,40,0,.75)';ctx.lineWidth=Math.max(3,r*0.11);ctx.beginPath();ctx.moveTo(-r*0.8,0);ctx.lineTo(r*0.8,0);ctx.stroke();
      ctx.strokeStyle='rgba(255,240,200,.85)';ctx.lineWidth=Math.max(1.5,r*0.045);ctx.beginPath();ctx.moveTo(-r*0.78,-r*0.05);ctx.lineTo(r*0.78,-r*0.05);ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
    if(it.k.gold&&sprites.length<60&&Math.random()<0.15){var a=Math.random()*6.283,d=r*(0.9+Math.random()*0.5);sprites.push({im:'spark_small',x:it.x+Math.cos(a)*d,y:it.y+Math.sin(a)*d,vx:0,vy:-0.5,w:14+Math.random()*16,life:1,dec:0.05,add:true})}
  }
  /* 반쪽 — 원본 귤을 절단선 기준으로 클립 + 절단면(과육) 이미지 */
  function drawPiece(p){
    var im=cimg(p.k.img),cs=cimg('cross_section'),r=p.r;
    ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,p.life*1.6));ctx.translate(p.x,p.y);ctx.rotate(p.rot);
    var a=p.cut-p.rot+(p.side>0?0:Math.PI);
    ctx.save();
    ctx.beginPath();ctx.arc(0,0,r*1.15,a,a+Math.PI);ctx.closePath();ctx.clip();
    if(p.k.coal)drawCoal(r);else if(p.k.gift)drawGift(r);
    else if(im){var w=r*2.15,h=w*im.naturalHeight/im.naturalWidth;ctx.drawImage(im,-w/2,-h*0.54,w,h)}
    else{var pg=ctx.createRadialGradient(0,0,2,0,0,r);pg.addColorStop(0,p.k.c1);pg.addColorStop(1,p.k.c2);ctx.fillStyle=pg;ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill()}
    ctx.restore();
    /* 절단면: 반쪽 안쪽으로 살짝 밀어 넣어 보이게 */
    ctx.rotate(a);ctx.translate(0,r*0.22);ctx.scale(1,0.5);
    if(p.k.coal||p.k.gift){}
    else if(cs){if(p.k.gold){ctx.filter='brightness(1.15) saturate(0.8)'}ctx.drawImage(cs,-r*0.95,-r*0.95,r*1.9,r*1.9);ctx.filter='none'}
    else{ctx.fillStyle='#FFD98A';ctx.beginPath();ctx.arc(0,0,r*0.92,0,7);ctx.fill();ctx.strokeStyle='#F7A03A';ctx.lineWidth=2;
      for(var i=0;i<8;i++){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(i*0.785)*r*0.85,Math.sin(i*0.785)*r*0.85);ctx.stroke()}}
    ctx.restore();
  }
  function drawText(txt,x,y,size,color,stroke,weight){
    size=Math.round(size*U);
    ctx.font=(weight||800)+' '+size+'px SCDream, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    if(stroke){ctx.lineJoin='round';ctx.strokeStyle=stroke;ctx.lineWidth=size*0.14;ctx.strokeText(txt,x,y)}
    ctx.fillStyle=color;ctx.fillText(txt,x,y);
  }
  /* ---- HUD ---- */
  function drawHUD(left){
    var pct=Math.max(0,Math.min(1,left/30000)),barC=pct>0.5?'#4FC3A1':(pct>0.2?'#F5B331':'#F0605A');
    if(fever)barC='#FFD84A';
    ctx.save();
    var bh=Math.round(8*U),m=Math.round(24*U),f1=Math.round(15*U)+'px SCDream, sans-serif',f2=Math.round(40*U)+'px SCDream, sans-serif';
    ctx.fillStyle='rgba(0,0,0,.18)';ctx.fillRect(0,0,W,bh);
    ctx.fillStyle=barC;ctx.fillRect(0,0,W*pct,bh);
    var secs=Math.ceil(left/1000),hudC=fever?'#FFD84A':'#FFFFFF';
    ctx.textBaseline='alphabetic';
    ctx.textAlign='left';ctx.font='800 '+f1;ctx.fillStyle='rgba(255,255,255,.75)';ctx.fillText('TIME',m,40*U);
    ctx.font='800 '+f2;ctx.lineJoin='round';ctx.strokeStyle='rgba(60,30,0,.55)';ctx.lineWidth=6*U;ctx.strokeText(String(secs),m,80*U);
    ctx.fillStyle=secs<=5?'#F0605A':hudC;ctx.fillText(String(secs),m,80*U);
    ctx.textAlign='right';ctx.font='800 '+f1;ctx.fillStyle='rgba(255,255,255,.75)';ctx.fillText('SCORE',W-m,40*U);
    ctx.font='800 '+f2;var s=String(score);while(s.length<5)s='0'+s;
    ctx.strokeText(s,W-m,80*U);ctx.fillStyle=fever?'#FFD84A':'#F5B331';ctx.fillText(s,W-m,80*U);
    if(combo>=2&&elapsed<comboUntil+300){
      var k=Math.min(1,(comboUntil-elapsed+300)/300),sz=30+Math.min(combo,15)*2.2,pop=1+Math.max(0,1-(elapsed-(comboUntil-900))/120)*0.35;
      ctx.save();ctx.translate(W/2,115*U);ctx.scale(pop,pop);ctx.globalAlpha=Math.min(1,k*2);
      drawText(combo+' COMBO'+(combo>=5?'!':''),0,0,sz,combo>=10?'#FFD84A':(combo>=5?'#FF7A3D':'#FFFFFF'),'rgba(60,20,0,.7)');
      ctx.restore();
    }
    if(fever){/* 금빛 가장자리 비네트 */
      if(!_vigC||_vigC.width!==W||_vigC.height!==H){_vigC=_vigC||document.createElement('canvas');_vigC.width=W;_vigC.height=H;var vgx=_vigC.getContext('2d');
        var vg=vgx.createRadialGradient(W/2,H/2,H*0.35,W/2,H/2,H*0.75);vg.addColorStop(0,'rgba(255,200,80,0)');vg.addColorStop(1,'rgba(255,190,60,1)');vgx.fillStyle=vg;vgx.fillRect(0,0,W,H)}
      ctx.globalAlpha=0.22+Math.sin(elapsed/160)*0.06;ctx.drawImage(_vigC,0,0);ctx.globalAlpha=1;
    }
    ctx.restore();
  }
  function drawBanners(){
    banners.forEach(function(b){
      b.t+=16;var life=b.type==='ildo'?700:(b.type==='rotten'?800:(b.type==='fever'?1400:(b.type==='legendhit'?1600:900)));
      var p=b.t/life,ain=Math.min(1,b.t/90),aout=Math.max(0,Math.min(1,(life-b.t)/220));
      var sc=(b.type==='ildo'?1.6:1.15)-ain*(b.type==='ildo'?0.5:0.15),x=b.x||W/2,y=b.y||((b.type==='gold'||b.type==='rotten'||b.type==='legend')?H*0.26:H*0.36);
      ctx.save();ctx.globalAlpha=Math.min(ain,aout);ctx.translate(x,y);ctx.scale(sc,sc);
      var c={bonus:'#7CFFB0',gold:'#FFD84A',legend:'#FFE9A8',legendhit:'#FFE9A8',rotten:'#D9B38C',fever:'#FFD84A',ildo:'#DFFFF4',timeup:'#FFFFFF',cd:'#FFFFFF'}[b.type]||'#FFF';
      var sz={ildo:64,fever:60,legendhit:52,timeup:70,cd:150}[b.type]||44;
      drawText(b.txt,0,0,sz,c,'rgba(60,20,0,.8)');
      ctx.restore();
      b.dead=b.t>life;
    });
    banners=banners.filter(function(b){return !b.dead});
  }
  function drawTrail(){
    trail=trail.filter(function(p){return elapsed-p.t<130});
    if(trail.length<2)return;
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    for(var pass=0;pass<2;pass++){
      for(var i=1;i<trail.length;i++){
        var a0=trail[i-1],a1=trail[i],age=(elapsed-a1.t)/130,al=Math.max(0,1-age);
        if(pass===0){ctx.strokeStyle='rgba(170,205,255,'+(al*0.38).toFixed(2)+')';ctx.lineWidth=Math.max(3,26*al*U)}
        else{ctx.strokeStyle='rgba(255,255,255,'+(al*0.95).toFixed(2)+')';ctx.lineWidth=Math.max(1.2,9*al*U)}
        ctx.beginPath();ctx.moveTo(a0.x,a0.y);ctx.lineTo(a1.x,a1.y);ctx.stroke();
      }
    }
    ctx.restore();
  }
  function rrect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
  /* ---- 결과 카드 ---- */
  function drawResult(){
    var p=Math.min(1,resultT/420),ease=1-Math.pow(1-p,3),isBest=score>(S.best.catch||0);
    ctx.save();ctx.fillStyle='rgba(8,36,22,'+(0.55*ease)+')';ctx.fillRect(0,0,W,H);
    var cw=Math.min(W-80*U,640*U),ch=Math.min(H-160*U,(isBest?700:650)*U),cx=W/2,cy=H/2+(1-ease)*60;
    ctx.globalAlpha=ease;ctx.translate(cx,cy);
    ctx.fillStyle='#FFFFFF';ctx.strokeStyle='#0F4A2E';ctx.lineWidth=6*U;
    rrect(-cw/2,-ch/2,cw,ch,2);ctx.fill();ctx.stroke();
    var y=-ch/2+70*U;
    drawText('선물 배달 완료!',0,y,38,'#0F4A2E');y+=64*U;
    var rows=[['자른 귤',cnt.fruit+'개'],['산타귤',cnt.gold+'개'],['선물 상자',cnt.gift+'개'],['최고 콤보',bestCombo+' COMBO'],['석탄',cnt.rotten+'개']];
    ctx.textBaseline='middle';
    rows.forEach(function(r){
      ctx.textAlign='left';ctx.font='600 '+Math.round(24*U)+'px SCDream, sans-serif';ctx.fillStyle='#6B7186';ctx.fillText(r[0],-cw/2+44*U,y);
      ctx.textAlign='right';ctx.font='800 '+Math.round(28*U)+'px SCDream, sans-serif';ctx.fillStyle='#0F4A2E';ctx.fillText(r[1],cw/2-44*U,y);
      ctx.fillStyle='rgba(15,74,46,.14)';ctx.fillRect(-cw/2+44*U,y+24*U,cw-88*U,2);y+=56*U;
    });
    y+=18*U;drawText('최종 점수',0,y,20,'#6B7186',null,600);y+=58*U;
    drawText(score.toLocaleString(),0,y,66,'#C8102E');y+=56*U;
    drawText(catchRank(score),0,y,24,'#0F4A2E',null,600);y+=48*U;
    if(isBest){ctx.save();ctx.translate(0,y);ctx.scale(1+Math.sin(resultT/120)*0.04,1+Math.sin(resultT/120)*0.04);drawText('NEW RECORD!',0,0,32,'#F0605A','rgba(255,255,255,.9)');ctx.restore();y+=44*U}
    if(resultReady){ctx.globalAlpha=ease*(0.6+Math.sin(resultT/200)*0.4);drawText('화면을 눌러 계속하기',0,ch/2-40*U,20,'#6B7186',null,600)}
    ctx.restore();
  }

  /* ---- 메인 루프 ---- */
  function loop(now){
    if(last==null)last=now;
    var dt=Math.min(50,now-last);last=now;
    var frozen=hitStop>0;if(frozen)hitStop-=dt;
    var step=frozen?0:dt,mul=step/16;
    if(!finished){
      elapsed+=step;
      var left=Math.max(0,dur-elapsed);
      if(left<=0){finished=true;endT=0;banner('TIME UP!','timeup');sfx('bonus',0.6);lastPt=null}
      /* 피버 진입 */
      if(!rotWave&&elapsed>=8000){rotWave=true;banner('석탄 습격!','rotten');shake(8,16);sfx('boom',0.35)}
      if(!fever&&elapsed>=20000&&left<=10000){fever=true;banner('크리스마스 피버!','fever');flash('#FFE9A8',0.5);
        beep(660,0.12,'triangle',0.1);setTimeout(function(){beep(880,0.12,'triangle',0.1)},120);setTimeout(function(){beep(1320,0.2,'triangle',0.12)},240)}
      /* 마지막 5초 카운트다운 */
      var secs=Math.ceil(left/1000);
      if(secs<=5&&secs>=1&&secs!==countdownShown&&left>0){countdownShown=secs;banners.push({txt:String(secs),type:'cd',t:0,y:H*0.46});if(secs<=3)beep(secs===1?1100:800,0.12,'square',0.12)}
      spawnT-=step;if(spawnT<=0)doSpawn();
    }else{
      endT+=dt;resultT=Math.max(0,endT-900);
      if(endT>1300)resultReady=true;
      items.forEach(function(it){it.fade=(it.fade==null?1:it.fade)-dt/600});
      items=items.filter(function(it){return it.fade>0});
    }
    /* 물리 */
    items.forEach(function(it){it.y+=it.v*2.4*mul;it.rot+=it.vr*mul;if(it.wob>0)it.wob=Math.max(0,it.wob-0.06*mul)});
    items=items.filter(function(it){return it.y<H+it.r+40});
    pieces.forEach(function(p){p.x+=p.vx*mul;p.y+=p.vy*mul;p.vy+=0.22*mul;p.rot+=p.vr*mul;p.life-=0.016*mul});
    pieces=pieces.filter(function(p){return p.life>0&&p.y<H+120});if(pieces.length>40)pieces.splice(0,pieces.length-40);
    fx.forEach(function(p){p.x+=p.vx*2*mul;p.y+=p.vy*2*mul;p.vy+=0.17*mul;p.l-=p.dec*mul});
    fx=fx.filter(function(p){return p.l>0});if(fx.length>160)fx.splice(0,fx.length-160);
    sprites.forEach(function(s){if(s.vx)s.x+=s.vx*mul;if(s.vy)s.y+=s.vy*mul;if(s.grav)s.vy+=0.12*mul;s.life-=s.dec*mul});
    sprites=sprites.filter(function(s){return s.life>0});if(sprites.length>90)sprites.splice(0,sprites.length-90);
    flashes.forEach(function(f){f.t+=mul});flashes=flashes.filter(function(f){return f.t<18});
    popups.forEach(function(p){p.y+=p.vy*mul;p.life-=0.02*mul});popups=popups.filter(function(p){return p.life>0});
    clouds.forEach(function(c){c.x+=c.s*mul;if(c.x-c.w/2>W)c.x=-c.w/2});
    if(shakeT>0){shakeT-=mul;if(shakeT<=0)shakeMag=0}
    flashAlpha=Math.max(0,flashAlpha-0.06*mul);

    /* ---- 렌더 ---- */
    ctx.clearRect(0,0,W,H);
    ctx.drawImage(bg,0,0);
    snow.forEach(function(f){f.y+=f.v*(fever?1.8:1)*mul*1.6;f.d+=0.02*mul;f.x+=Math.sin(f.d)*0.6*mul;if(f.y>H+10){f.y=-10;f.x=Math.random()*W}});
    ctx.fillStyle='rgba(255,255,255,.85)';snow.forEach(function(f){ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,7);ctx.fill()});
    ctx.save();
    if(shakeT>0)ctx.translate((Math.random()-.5)*shakeMag*2,(Math.random()-.5)*shakeMag*2);
    /* 안내 문구 — 첫 슬라이스 전까지만 */
    if(!guided&&!finished&&elapsed>400){ctx.save();ctx.globalAlpha=0.6+Math.sin(elapsed/220)*0.3;drawText('슥— 베어보세요!',W/2,H*0.5,40,'#FFFFFF','rgba(60,20,0,.7)');ctx.restore()}
    pieces.forEach(drawPiece);
    items.forEach(function(it){if(it.fade!=null)ctx.globalAlpha=Math.max(0,it.fade);drawFruit(it);ctx.globalAlpha=1});
    /* 섬광 */
    flashes.forEach(function(f){var p=f.t/18,rad=f.r0+(f.r1-f.r0)*p;var fg=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,rad);
      fg.addColorStop(0,'rgba('+f.c+','+(0.9*(1-p))+')');fg.addColorStop(1,'rgba('+f.c+',0)');ctx.fillStyle=fg;ctx.beginPath();ctx.arc(f.x,f.y,rad,0,7);ctx.fill()});
    /* 스프라이트 이펙트(과즙 스플래시·스파크·연기) */
    sprites.forEach(function(s){var im=cimg(s.im);if(!im)return;var w=s.w1?s.w+(s.w1-s.w)*(1-s.life):s.w;
      ctx.globalCompositeOperation=s.add?'lighter':'source-over';drawImgC(im,s.x,s.y,w,s.rot||0,Math.max(0,s.life)*(s.add?0.95:0.85))});
    ctx.globalCompositeOperation='source-over';
    fx.forEach(function(p){ctx.globalAlpha=Math.max(0,p.l);ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,7);ctx.fill()});
    ctx.globalAlpha=1;
    drawTrail();
    popups.forEach(function(p){ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,p.life*1.5));var sc=1+Math.max(0,p.life-0.85)*2.5;ctx.translate(p.x,p.y);ctx.scale(sc,sc);drawText(p.txt,0,0,p.size,p.c,'rgba(60,20,0,.6)');ctx.restore()});
    ctx.restore();
    if(flashAlpha>0){ctx.globalAlpha=flashAlpha;ctx.fillStyle=flashColor;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1}
    if(!finished||endT<900)drawHUD(Math.max(0,dur-elapsed));
    drawBanners();
    if(finished&&endT>900)drawResult();
    raf=requestAnimationFrame(loop);
  }
  raf=requestAnimationFrame(loop);
}

  /* 원래 앱의 finishCatch 대신 — 최고 기록만 이 폰에 남기고 결과를 넘긴다 */
  function finishCatch(score, st) {
    stopGame();
    var isBest = score > (S.best["catch"] || 0);
    if (isBest) { S.best["catch"] = score; try { localStorage.setItem(BEST_KEY, String(score)); } catch (e) {} }
    sfx(isBest ? "fanfare" : "bonus", 0.7);
    if (onDone) onDone(score, isBest, st || {combo:0,rotten:0,bonus:0});
  }

  document.getElementById("catchClose").addEventListener("click", stopGame);

  return {
    start: function (cb) { onDone = cb || null; gCatch(); },
    close: stopGame
  };
})();
