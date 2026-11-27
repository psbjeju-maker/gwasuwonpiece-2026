/* 효과음·배경음: 파일 없이 Web Audio로 바로 만든다. */
(function(){
'use strict';
var AC=window.AudioContext||window.webkitAudioContext, ac=null, out=null, on=true, timer=null;
try{ on=localStorage.getItem('santa_play_snd')!=='0'; }catch(e){}
function wake(){
  if(!AC) return;
  if(!ac){ ac=new AC(); out=ac.createGain(); out.gain.value=on?1:0; out.connect(ac.destination); }
  if(ac.state==='suspended') ac.resume();
}
/* 음 하나: f→to 로 미끄러질 수 있다. at 은 지금부터 몇 초 뒤 */
function tone(f,dur,type,vol,at,to){
  if(!ac||!on) return;
  var t=ac.currentTime+(at||0), o=ac.createOscillator(), g=ac.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(f,t); if(to) o.frequency.exponentialRampToValueAtTime(to,t+dur);
  g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol||.2,t+.012); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t+dur+.02);
}
function noise(dur,vol,at,hz){
  if(!ac||!on) return;
  var n=Math.floor(ac.sampleRate*dur), b=ac.createBuffer(1,n,ac.sampleRate), d=b.getChannelData(0);
  for(var i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
  var s=ac.createBufferSource(), g=ac.createGain(), fl=ac.createBiquadFilter(), t=ac.currentTime+(at||0);
  fl.type='bandpass'; fl.frequency.value=hz||1800; s.buffer=b; g.gain.value=vol||.2; s.connect(fl); fl.connect(g); g.connect(out); s.start(t);
}
var PENTA=[523,587,659,784,880,1047,1175,1319,1568,1760];
var SFX={
  tap:function(){ tone(660,.09,'triangle',.18,0,990); },
  catch:function(combo){ var f=PENTA[Math.min(combo,PENTA.length-1)]; tone(f,.13,'triangle',.22,0,f*1.25); },
  star:function(){ [1047,1319,1568,2093].forEach(function(f,i){ tone(f,.2,'sine',.2,i*.055); }); },
  combo:function(){ tone(784,.1,'square',.07); tone(1175,.18,'square',.07,.08); },
  count:function(){ tone(660,.18,'triangle',.25); },
  go:function(){ tone(1320,.35,'triangle',.28,0,1760); },
  fever:function(){ [523,659,784,1047,1319].forEach(function(f,i){ tone(f,.14,'square',.08,i*.06); }); },
  tick:function(){ tone(1500,.04,'square',.05); },
  end:function(){ [784,784,1047].forEach(function(f,i){ tone(f,i===2?.5:.14,'triangle',.24,i*.15); }); },
  point:function(p){ tone(500+p*900,.045,'triangle',.11); },
  ding:function(i){ var f=[880,1175,1568][i]||1568; tone(f,.35,'sine',.28); tone(f*2,.3,'sine',.09,.02); },
  drum:function(){ for(var i=0;i<14;i++) noise(.06,.12+i*.014,i*.055,500+i*60); },
  open:function(){ noise(.25,.35,0,2600); tone(300,.25,'triangle',.25,0,1200); [1047,1319,1568,2093,1568,2093].forEach(function(f,i){ tone(f,.24,'triangle',.18,.12+i*.09); }); },
  boing:function(){ tone(300,.28,'sine',.28,0,820); },
  shutter:function(){ noise(.05,.5,0,3200); noise(.07,.4,.09,1500); }
};
/* 게임 중 배경음 (짧은 반복 멜로디) */
var MEL=[523,0,659,784,880,784,659,0, 587,0,698,880,784,0,659,587], BASS=[262,262,349,392];
function music(fast){
  stopMusic(); if(!ac) return;
  var i=0;
  timer=setInterval(function(){
    var m=MEL[i%MEL.length]; if(m) tone(fast?m*1.122:m,.13,'triangle',.075);
    if(i%4===0) tone(BASS[(i/4)%BASS.length],.22,'sine',.13);
    if(i%2===1) noise(.03,.045,0,6000);
    i++;
  },fast?125:170);
}
function stopMusic(){ clearInterval(timer); timer=null; }
function icon(){
  return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2B2F6B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#2B2F6B"/>'+
    (on?'<path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>':'<path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>')+'</svg>';
}
window.SND={
  wake:wake,
  play:function(n,a){ if(SFX[n]) SFX[n](a); },
  music:music, stop:stopMusic, icon:icon,
  toggle:function(){ on=!on; wake(); if(out) out.gain.value=on?1:0; try{ localStorage.setItem('santa_play_snd',on?'1':'0'); }catch(e){} if(on) SFX.tap(); },
  ok:!!AC
};
})();
