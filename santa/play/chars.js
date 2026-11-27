/* 아이용 게임 캐릭터: 얼굴 카드(200x200)와 사진 장식(300x350)을 같은 부품으로 그린다. */
(function(){
'use strict';
function C(x,y,r,f,e){ return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+f+'"'+(e||'')+'/>'; }
function E(x,y,rx,ry,f,rot,e){ return '<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+f+'"'+(rot?' transform="rotate('+rot+' '+x+' '+y+')"':'')+(e||'')+'/>'; }
function P(d,f,e){ return '<path d="'+d+'" fill="'+(f||'none')+'"'+(e||'')+'/>'; }
function S(d,c,w,e){ return '<path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"'+(e||'')+'/>'; }
var LINE=' stroke="#e3dfe6" stroke-width="3"';
function both(fn){ return fn(-1)+fn(1); }

/* ── 목에 두르는 것: 턱선을 따라 둥글게. (cx,y)=양 끝 높이, w=반폭, d=처짐, t=두께 ── */
function curve(cx,y,w,d){ return 'M'+(cx-w)+' '+y+'Q'+cx+' '+(y+d*2)+' '+(cx+w)+' '+y; }
function at(cx,y,w,d,u){ return [cx-w+2*w*u, y+4*d*u*(1-u)]; }
function scarf(cx,y,w,d,t,col,stripe,dark){
  var m=curve(cx,y,w,d), k=t/34;
  var p=at(cx,y,w,d,.7), x=p[0], q=p[1];
  function tail(dx,rot,len,c){
    var h='<g transform="translate('+(x+dx*k)+' '+q+') rotate('+rot+') scale('+k+')">';
    h+=P('M-13 0Q-18 '+(len*.55)+' -15 '+len+'Q0 '+(len+9)+' 15 '+len+'Q18 '+(len*.5)+' 12 0Z',c);
    h+=S('M-14 '+(len-17)+'Q0 '+(len-9)+' 15 '+(len-17),stripe,7);
    for(var i=-10;i<=10;i+=7) h+=S('M'+i+' '+(len+4)+'q'+(i*.12)+' 6 '+(i*.2)+' 11',c,4.5);
    return h+'</g>';
  }
  return tail(-9,16,44,dark)+tail(9,-14,52,col)+
    S(m,dark,t+5)+S(m,col,t)+
    S(m,stripe,t-2,' stroke-dasharray="'+(7*k)+' '+(21*k)+'" style="stroke-linecap:butt"')+
    S(curve(cx,y-t*.24,w-6*k,d),'#fff',4*k,' opacity=".35"')+
    E(x,q+2*k,17*k,19*k,col,-22,' stroke="'+dark+'" stroke-width="'+(2.5*k)+'"')+
    S('M'+(x-9*k)+' '+(q-8*k)+'Q'+(x+2*k)+' '+(q+2*k)+' '+(x-3*k)+' '+(q+15*k),dark,3*k);
}
function bell(cx,y,w,d,t,col){
  var k=t/34, b=y+d+t*.2;
  return S(curve(cx,y,w,d),col,t*.46)+S(curve(cx,y-3*k,w-4*k,d),'#fff',3*k,' opacity=".4"')+
    '<g transform="translate('+cx+' '+(b+17*k)+') scale('+k+')">'+C(0,0,20,'#FFC62E',' stroke="#C98F00" stroke-width="3"')+S('M-18 -4Q0 4 18 -4','#C98F00',3)+C(0,8,4.5,'#7A5600')+S('M0 11v8','#7A5600',3)+C(-8,-10,4,'#fff',' opacity=".75"')+'</g>';
}
function bow(cx,y,w,d,t,col,dark){
  var k=t/34, b=y+d;
  return S(curve(cx,y,w,d),dark,t*.3)+'<g transform="translate('+cx+' '+(b+8*k)+') scale('+k+')">'+
    P('M-6 6Q-18 30 -30 36L-14 34L-10 44Q-2 26 4 8Z',dark)+P('M6 6Q18 30 30 36L14 34L10 44Q2 26 -4 8Z',dark)+
    P('M0 0C-20 -30 -58 -26 -52 0C-58 26 -20 30 0 0Z',col,' stroke="'+dark+'" stroke-width="3"')+
    P('M0 0C20 -30 58 -26 52 0C58 26 20 30 0 0Z',col,' stroke="'+dark+'" stroke-width="3"')+
    S('M-14 -4Q-30 -12 -40 -6M14 -4Q30 -12 40 -6',dark,3)+E(0,0,13,15,col,0,' stroke="'+dark+'" stroke-width="3"')+'</g>';
}
function beads(cx,y,w,d,t,cols,heart){
  var k=t/34, h='', n=13;
  for(var i=0;i<=n;i++){ var p=at(cx,y,w,d,i/n); h+=C(p[0],p[1],10.5*k,cols[i%cols.length],' stroke="rgba(0,0,0,.12)" stroke-width="'+(1.5*k)+'"')+C(p[0]-3.5*k,p[1]-3.5*k,3*k,'#fff',' opacity=".85"'); }
  if(heart) h+='<g transform="translate('+cx+' '+(y+d+24*k)+') scale('+k+')">'+P('M0 20C-30 0 -22 -22 -9 -18Q-2 -16 0 -9Q2 -16 9 -18C22 -22 30 0 0 20Z',heart,' stroke="#fff" stroke-width="3"')+'</g>';
  return h;
}
function lei(cx,y,w,d,t,cols){
  var k=t/34, h=S(curve(cx,y,w,d),'#3FA66B',9*k), n=8;
  for(var i=0;i<=n;i++){
    var p=at(cx,y,w,d,i/n), c=cols[i%cols.length], s=(i%2?15:18)*k;
    for(var a=0;a<5;a++){ var an=a*1.2566+i; h+=C(p[0]+Math.cos(an)*s*.62,p[1]+Math.sin(an)*s*.62,s*.55,c); }
    h+=C(p[0],p[1],s*.45,'#FFE066');
  }
  return h;
}
function beard(){
  var h='', pts=[[76,236,20],[82,264,23],[97,290,25],[122,308,27],[150,316,29],[178,308,27],[203,290,25],[218,264,23],[224,236,20]];
  pts.forEach(function(p){ h+=C(p[0],p[1],p[2]+3,'#dcd8e2'); });
  var base='M70 232Q96 268 122 262Q150 252 178 262Q204 268 230 232Q226 300 150 320Q74 300 70 232Z';
  pts.forEach(function(p){ h+=C(p[0],p[1],p[2],'#fff'); }); h+=P(base,'#fff');
  h+=S('M104 286q10 10 22 6M174 292q12 4 22 -8M138 300q12 8 24 0','#dcd8e2',4);
  var mus=function(s){ return P('M150 244C'+(150+s*18)+' 226 '+(150+s*52)+' 232 '+(150+s*56)+' 254Q'+(150+s*68)+' 252 '+(150+s*66)+' 240Q'+(150+s*74)+' 270 '+(150+s*42)+' 270Q'+(150+s*16)+' 272 150 256Z','#fff',' stroke="#dcd8e2" stroke-width="3"'); };
  return h+both(mus);
}
function neck(n,cx,y,w,d,t){
  if(!n) return '';
  if(n[0]==='scarf') return scarf(cx,y,w,d,t,n[1],n[2],n[3]);
  if(n[0]==='bell') return bell(cx,y,w,d,t,n[1]);
  if(n[0]==='bow') return bow(cx,y,w,d,t,n[1],n[2]);
  if(n[0]==='beads') return beads(cx,y,w,d,t,n[1],n[2]);
  if(n[0]==='lei') return lei(cx,y,w,d,t,n[1]);
  return '';
}

/* ── 얼굴 카드 부품 ── */
function eyes(y,dx){ dx=dx||23; return both(function(s){ var x=100+s*dx; return E(x,y,7,8.5,'#2b2230')+C(x+2.6,y-3.2,3,'#fff')+C(x-2.4,y+3,1.4,'#fff'); }); }
function cheeks(y,dx){ dx=dx||39; return both(function(s){ return E(100+s*dx,y,11,7.5,'#FF7F9A',0,' opacity=".45"'); }); }
function smile(y,c){ return S('M90 '+y+'Q95 '+(y+8)+' 100 '+y+'Q105 '+(y+8)+' 110 '+y,c||'#5a3040',3.6); }
function nose(y,c,rx){ return E(100,y,rx||7,5,c||'#5a3040'); }
function head(c){ return E(100,108,66,61,c); }
function shine(){ return E(70,74,15,8,'#fff',-32,' opacity=".28"'); }

/* ── 머리띠 + 귀 (사진 장식) ── */
function band(c){ return S('M66 142Q74 56 150 52Q226 56 234 142',c,11); }
function pair(fn){ return both(function(s){ return '<g transform="translate('+(150+s*62)+' 66) scale('+s+' 1) rotate(16)">'+fn()+'</g>'; }); }
function roundEar(o,i){ return function(){ return C(0,0,30,o)+C(0,3,17,i); }; }
function pointEar(o,i){ return function(){ return P('M-28 20Q-18 -40 6 -42Q24 -30 30 18Q0 32 -28 20Z',o)+P('M-14 14Q-8 -22 5 -26Q16 -16 17 13Q1 20 -14 14Z',i); }; }
function longEar(o,i){ return function(){ return E(0,-22,21,50,o,0,LINE)+E(0,-20,10,35,i); }; }
function flopEar(o){ return function(){ return P('M-14 -6Q30 -22 38 22Q44 66 20 70Q2 70 2 36Q-2 12 -14 -6Z',o); }; }
function whiskers(c){ return both(function(s){ return S('M'+(150+s*34)+' 214l'+(s*40)+' -8M'+(150+s*34)+' 224l'+(s*42)+' 3',c,4); }); }
function blush(){ return both(function(s){ return E(150+s*56,212,19,12,'#FF7F9A',0,' opacity=".38"'); }); }
function dotNose(c,r){ return E(150,205,r||17,(r||17)*.72,c)+E(143,200,(r||17)*.3,(r||17)*.18,'#fff',-20,' opacity=".75"'); }

var RED=['scarf','#E8384F','#fff','#B71F34'], BLUE=['scarf','#3E8BFF','#FFE066','#2563C9'], MINT=['scarf','#2FBF8F','#fff','#1D8F6A'],
    PINKS=['scarf','#FF7BAC','#FFF3B0','#D9517F'], YEL=['scarf','#FFC62E','#7A4BD6','#D69C00'], PUR=['scarf','#8E63E8','#BFF3E4','#6640BC'];

var LIST=[];
function add(k,name,face,top,nk){ LIST.push({k:k,name:name,face:face,top:top,neck:nk}); }

add('santa','산타',
  function(){ return C(100,112,58,'#FFD9B8')+'<g transform="translate(-2 -36) scale(.68)">'+beard()+'</g>'+eyes(103,20)+cheeks(118,35)+E(100,121,9,7.5,'#F29C86')+
    P('M44 82Q50 22 106 20Q154 20 170 60Q180 82 170 98Q162 80 156 82Z','#E8384F')+S('M36 84Q100 64 164 84','#dcd8e2',27)+S('M36 84Q100 64 164 84','#fff',22)+C(170,100,15,'#fff',LINE); },
  function(){ return P('M66 100Q72 24 158 20Q226 22 250 70Q266 104 256 132Q240 88 208 74Q228 88 234 100Z','#E8384F')+S('M60 104Q150 70 240 104','#dcd8e2',37)+S('M60 104Q150 70 240 104','#fff',31)+C(256,138,22,'#fff',LINE)+blush()+beard(); },
  null);

add('rudolph','루돌프',
  function(){ var a=both(function(s){ return S('M'+(100+s*30)+' 62Q'+(100+s*44)+' 40 '+(100+s*46)+' 18M'+(100+s*41)+' 42Q'+(100+s*58)+' 42 '+(100+s*68)+' 28','#8A5A2B',10); });
    return a+both(function(s){ return E(100+s*66,88,15,25,'#B87A46',s*52)+E(100+s*66,88,7,15,'#FFC9A8',s*52); })+head('#B87A46')+E(100,138,35,25,'#F0C9A0')+eyes(104)+cheeks(124,45)+C(100,128,14,'#FF3B47')+C(95,123,4.5,'#fff')+smile(150)+shine(); },
  function(){ return band('#8A5A2B')+both(function(s){ return S('M'+(150+s*42)+' 68Q'+(150+s*62)+' 40 '+(150+s*60)+' 14M'+(150+s*55)+' 40Q'+(150+s*80)+' 40 '+(150+s*96)+' 22','#8A5A2B',13); })+
    pair(function(){ return E(18,18,17,28,'#B87A46',50)+E(18,18,8,17,'#FFC9A8',50); })+blush()+dotNose('#FF3B47',21); },
  ['bell','#E8384F']);

add('snowman','눈사람',
  function(){ return head('#fff').replace('/>',LINE+'/>')+P('M46 76Q54 18 100 18Q146 18 154 76Z','#2FBF8F')+S('M42 78Q100 58 158 78','#d6e4ee',27)+S('M42 78Q100 58 158 78','#fff',22)+C(100,16,14,'#fff',LINE)+eyes(106)+cheeks(125)+P('M98 116L142 128Q142 134 98 132Q90 124 98 116Z','#FF9230')+smile(143)+neck(RED,100,150,48,13,22); },
  function(){ return P('M66 104Q74 16 150 16Q226 16 234 104Z','#2FBF8F')+S('M150 34v52M112 44l-12 48M188 44l12 48','#fff',6,' opacity=".5"')+S('M58 106Q150 74 242 106','#dcd8e2',35)+S('M58 106Q150 74 242 106','#fff',29)+C(150,20,20,'#fff',LINE)+blush()+P('M146 194L204 208Q204 216 146 216Q134 206 146 194Z','#FF9230'); },
  RED);

add('bear','곰돌이',
  function(){ return both(function(s){ return C(100+s*47,56,24,'#C98A52')+C(100+s*47,58,13,'#F4C99B'); })+head('#C98A52')+E(100,134,31,23,'#FBE3C4')+eyes(104)+cheeks(124,44)+nose(124,'#4a2c1a',10)+smile(137,'#4a2c1a')+shine(); },
  function(){ return band('#8d5a30')+pair(roundEar('#C98A52','#F4C99B'))+blush()+dotNose('#5a3720'); }, BLUE);

add('rabbit','토끼',
  function(){ return both(function(s){ return E(100+s*28,44,17,42,'#fff',s*13,LINE)+E(100+s*28,46,8,29,'#FFB3CB',s*13); })+E(100,118,62,55,'#fff',0,LINE)+eyes(114)+cheeks(134)+nose(131,'#FF6F9C',7)+smile(139)+neck(['bow','#FF7BAC','#D9517F'],100,162,36,9,20); },
  function(){ return band('#ffb3cb')+pair(longEar('#fff','#FFB3CB'))+blush()+dotNose('#FF7BAC',13)+whiskers('#fff'); }, ['bow','#FF7BAC','#D9517F']);

add('cat','야옹이',
  function(){ return both(function(s){ return P('M'+(100+s*60)+' 100Q'+(100+s*72)+' 30 '+(100+s*52)+' 34Q'+(100+s*32)+' 42 '+(100+s*14)+' 56Z','#FFB45C')+P('M'+(100+s*53)+' 76Q'+(100+s*60)+' 44 '+(100+s*50)+' 46L'+(100+s*28)+' 60Z','#FFC9D4'); })+head('#FFB45C')+S('M100 52v18M84 56l4 14M116 56l-4 14','#E8862A',6)+E(100,136,29,19,'#FFF2DE')+eyes(106)+cheeks(126,45)+nose(127,'#FF6F8A',7)+smile(135)+both(function(s){ return S('M'+(100+s*44)+' 136l'+(s*30)+' -4M'+(100+s*44)+' 146l'+(s*30)+' 5','#fff',3); })+neck(['bell','#3E8BFF'],100,162,38,8,20); },
  function(){ return band('#e8862a')+pair(pointEar('#FFB45C','#FFC9D4'))+blush()+dotNose('#FF6F8A',13)+whiskers('#fff'); }, ['bell','#3E8BFF']);

add('puppy','강아지',
  function(){ return head('#FFE3B8')+E(124,96,21,24,'#D99A5B',-14)+both(function(s){ return P('M'+(100+s*40)+' 56Q'+(100+s*88)+' 52 '+(100+s*82)+' 116Q'+(100+s*76)+' 140 '+(100+s*62)+' 126Q'+(100+s*58)+' 92 '+(100+s*40)+' 56Z','#B9773C'); })+E(100,136,30,22,'#fff')+eyes(103)+cheeks(125,43)+nose(124,'#3b2418',11)+P('M92 142Q100 166 108 142Z','#FF7F9A')+smile(138,'#3b2418')+neck(MINT,100,158,44,10,20); },
  function(){ return band('#b9773c')+pair(flopEar('#B9773C'))+blush()+dotNose('#3b2418'); }, MINT);

add('panda','판다',
  function(){ return both(function(s){ return C(100+s*48,56,23,'#33303a'); })+head('#fff').replace('/>',LINE+'/>')+both(function(s){ return E(100+s*26,106,19,22,'#33303a',s*-24); })+both(function(s){ return C(100+s*24,104,7.5,'#fff')+C(100+s*23,105,4.5,'#14121a'); })+cheeks(130,44)+nose(128,'#33303a',9)+smile(140,'#33303a')+neck(['bow','#2FBF8F','#1D8F6A'],100,162,36,9,20); },
  function(){ return band('#33303a')+pair(roundEar('#33303a','#55505e'))+blush()+dotNose('#33303a',15); }, ['bow','#2FBF8F','#1D8F6A']);

add('tiger','아기 호랑이',
  function(){ return both(function(s){ return C(100+s*48,58,22,'#FF9E2C')+C(100+s*48,60,11,'#FFF0D6'); })+head('#FF9E2C')+S('M100 52v22M82 55l5 16M118 55l-5 16M40 100l18 4M42 120l17 -1M160 100l-18 4M158 120l-17 -1','#4b2a12',6)+E(100,137,31,21,'#fff')+eyes(105)+cheeks(125,43)+nose(128,'#6b2f2f',9)+smile(139)+neck(PUR,100,158,44,10,20); },
  function(){ return band('#4b2a12')+pair(roundEar('#FF9E2C','#FFF0D6'))+blush()+dotNose('#8a3a3a',14)+whiskers('#fff'); }, PUR);

add('fox','여우',
  function(){ return both(function(s){ return P('M'+(100+s*62)+' 96Q'+(100+s*76)+' 22 '+(100+s*54)+' 28Q'+(100+s*30)+' 40 '+(100+s*12)+' 56Z','#F4762D')+P('M'+(100+s*55)+' 72Q'+(100+s*62)+' 40 '+(100+s*52)+' 42L'+(100+s*28)+' 58Z','#4b2a12'); })+head('#F4762D')+P('M35 114Q70 108 100 134Q130 108 165 114Q156 168 100 169Q44 168 35 114Z','#fff')+eyes(105)+cheeks(128,45)+nose(133,'#33222a',9)+smile(143)+neck(YEL,100,160,42,9,20); },
  function(){ return band('#c9551a')+pair(pointEar('#F4762D','#4b2a12'))+blush()+dotNose('#33222a',14)+whiskers('#fff'); }, YEL);

add('frog','개구리',
  function(){ return both(function(s){ return C(100+s*35,62,27,'#6FD35B')+C(100+s*35,61,17,'#fff')+C(100+s*34,63,10,'#2b2230')+C(100+s*34+3,59,3.6,'#fff'); })+E(100,118,68,52,'#6FD35B')+cheeks(126,45)+S('M70 128Q100 158 130 128','#2f6b24',5)+C(93,108,2.6,'#2f6b24')+C(107,108,2.6,'#2f6b24')+neck(['bow','#E8384F','#B71F34'],100,160,38,9,20); },
  function(){ return band('#4cb23c')+both(function(s){ var x=150+s*58; return C(x,62,34,'#6FD35B')+C(x,61,22,'#fff')+C(x,64,12,'#2b2230')+C(x+4,59,4.5,'#fff'); })+blush(); }, ['bow','#E8384F','#B71F34']);

add('penguin','펭귄',
  function(){ return head('#37496e')+P('M100 82C80 58 46 70 48 108C48 148 76 168 100 168C124 168 152 148 152 108C154 70 120 58 100 82Z','#fff')+eyes(107,22)+cheeks(127,36)+P('M84 124Q100 114 116 124Q108 142 100 142Q92 142 84 124Z','#FFAA22')+shine()+neck(PINKS,100,158,46,11,20); },
  function(){ return S('M60 150Q50 40 150 36Q250 40 240 150','#37496e',34)+C(108,46,14,'#fff')+C(192,46,14,'#fff')+C(110,48,7,'#2b2230')+C(190,48,7,'#2b2230')+P('M132 62Q150 54 168 62Q158 80 150 80Q142 80 132 62Z','#FFAA22')+blush(); }, PINKS);

add('pig','꿀꿀이',
  function(){ return both(function(s){ return P('M'+(100+s*60)+' 90Q'+(100+s*74)+' 34 '+(100+s*46)+' 40Q'+(100+s*28)+' 48 '+(100+s*22)+' 56Z','#FF9DB8'); })+head('#FFB9CD')+eyes(102,28)+cheeks(122,47)+E(100,126,24,17,'#FF8FAE')+E(92,126,4,6.5,'#B7476A')+E(108,126,4,6.5,'#B7476A')+smile(150,'#B7476A')+shine()+neck(BLUE,100,162,40,8,19); },
  function(){ return band('#ff8fae')+pair(pointEar('#FF9DB8','#FFC9D9'))+blush()+E(150,205,27,19,'#FF8FAE')+E(141,205,4.5,7,'#B7476A')+E(159,205,4.5,7,'#B7476A'); }, ['beads',['#FF7BAC','#fff'],'#E8384F']);

add('chick','삐약이',
  function(){ return S('M100 52Q92 30 78 30M100 52Q102 28 112 22M100 52Q112 38 124 40','#FFB100',6)+head('#FFDF3D')+eyes(102,25)+cheeks(122,42)+P('M86 116Q100 106 114 116L100 124Z','#FF9230')+P('M86 118L100 134L114 118L100 124Z','#E87410')+shine()+neck(['bow','#3E8BFF','#2563C9'],100,158,38,10,20); },
  function(){ return band('#ffb100')+S('M150 56Q140 18 116 18M150 56Q154 14 170 6M150 56Q170 30 192 32','#FFCE1F',11)+C(150,56,15,'#FFDF3D')+blush()+P('M130 200Q150 186 170 200L150 210Z','#FF9230')+P('M130 204L150 224L170 204L150 212Z','#E87410'); }, ['bow','#3E8BFF','#2563C9']);

add('koala','코알라',
  function(){ return both(function(s){ return C(100+s*58,70,31,'#A9AEBB')+C(100+s*58,72,19,'#F4E6EA'); })+head('#A9AEBB')+eyes(103,30)+cheeks(125,45)+E(100,117,16,23,'#454350')+E(94,108,5,7,'#fff',0,' opacity=".4"')+smile(148)+neck(YEL,100,160,42,9,20); },
  function(){ return band('#8b909e')+pair(function(){ return C(6,2,36,'#A9AEBB')+C(6,4,22,'#F4E6EA'); })+blush()+E(150,204,18,24,'#454350'); }, YEL);

add('monkey','원숭이',
  function(){ return both(function(s){ return C(100+s*66,108,22,'#9A6035')+C(100+s*66,108,12,'#FFD9B8'); })+head('#9A6035')+P('M100 84C86 64 56 72 56 104Q56 112 60 118Q46 160 100 162Q154 160 140 118Q144 112 144 104C144 72 114 64 100 84Z','#FFD9B8')+eyes(104,21)+cheeks(126,36)+C(95,124,2.6,'#7a4a28')+C(105,124,2.6,'#7a4a28')+S('M82 138Q100 156 118 138','#7a4a28',4.5)+neck(['lei',['#FF7BAC','#fff','#FF9230']],100,164,40,9,24); },
  function(){ return band('#7a4a28')+both(function(s){ return C(150+s*96,150,30,'#9A6035')+C(150+s*96,150,17,'#FFD9B8'); })+S('M150 56Q142 30 164 26','#7a4a28',9)+blush(); }, ['lei',['#FF7BAC','#fff','#FF9230']]);

add('lion','사자',
  function(){ var m=''; for(var i=0;i<14;i++){ var a=i*.4488; m+=C(100+Math.cos(a)*62,106+Math.sin(a)*60,20,'#E8862A'); } return m+C(100,106,66,'#E8862A')+both(function(s){ return C(100+s*38,70,15,'#FFC95C'); })+E(100,112,52,49,'#FFC95C')+E(100,134,25,18,'#FFF0D0')+eyes(104,21)+cheeks(124,34)+nose(126,'#6b3a1a',9)+smile(137,'#6b3a1a'); },
  function(){ var m=''; [[56,170],[50,134],[60,100],[80,74],[110,56],[150,48],[190,56],[220,74],[240,100],[250,134],[244,170]].forEach(function(p){ m+=C(p[0],p[1],23,'#E8862A'); }); return m+pair(roundEar('#FFC95C','#FFF0D0'))+blush()+dotNose('#6b3a1a',15)+whiskers('#fff'); }, ['bell','#8E63E8']);

add('hamster','햄찌',
  function(){ return both(function(s){ return C(100+s*45,58,18,'#F2A65A')+C(100+s*45,60,9,'#FFC9D4'); })+head('#F2A65A')+P('M34 112Q66 100 84 120Q100 96 116 120Q134 100 166 112Q160 169 100 169Q40 169 34 112Z','#FFF4E4')+eyes(101)+cheeks(134,43)+nose(124,'#FF6F8A',6)+smile(131)+'<rect x="94" y="140" width="12" height="11" rx="3" fill="#fff" stroke="#d8cdbb" stroke-width="2"/>'+neck(MINT,100,162,40,8,19); },
  function(){ return band('#d98a3d')+pair(roundEar('#F2A65A','#FFC9D4'))+blush()+both(function(s){ return E(150+s*60,222,26,18,'#FFD9A8',0,' opacity=".55"'); })+dotNose('#FF6F8A',11)+whiskers('#fff'); }, ['beads',['#FFC62E','#FF9230'],null]);

add('unicorn','유니콘',
  function(){ return both(function(s){ return P('M'+(100+s*52)+' 82Q'+(100+s*64)+' 30 '+(100+s*40)+' 38L'+(100+s*24)+' 54Z','#fff',LINE); })+head('#fff').replace('/>',LINE+'/>')+P('M88 54L100 6L112 54Z','#FFC62E')+S('M93 38l15 -6M90 50l20 -8','#fff',3.5)+C(70,60,17,'#FF9EC4')+C(52,80,14,'#B69CFF')+C(90,54,13,'#8ED8FF')+C(44,102,11,'#8ED8FF')+S('M62 106Q74 94 86 106M114 106Q126 94 138 106','#2b2230',5)+cheeks(124)+smile(134)+neck(['beads',['#B69CFF','#8ED8FF','#FF9EC4'],'#FF5D8F'],100,160,42,9,20); },
  function(){ return band('#b69cff')+P('M132 66L150 2L168 66Z','#FFC62E')+S('M138 48l22 -9M135 62l29 -12','#fff',5)+pair(pointEar('#fff','#FFC9D4'))+C(96,70,17,'#FF9EC4')+C(118,58,15,'#8ED8FF')+C(190,62,16,'#B69CFF')+C(212,76,12,'#FF9EC4')+blush(); }, ['beads',['#B69CFF','#8ED8FF','#FF9EC4'],'#FF5D8F']);

add('dino','아기 공룡',
  function(){ return P('M62 62L72 26L90 52L102 16L116 52L134 28L142 64Z','#FF9230')+head('#58C9A0')+E(100,138,40,24,'#BDF0DA')+eyes(100,27)+cheeks(122,46)+C(90,126,3,'#2a6b52')+C(110,126,3,'#2a6b52')+S('M76 140Q100 158 124 140','#2a6b52',4.5)+P('M86 147l5 9l5 -6Z','#fff')+P('M104 150l5 6l5 -9Z','#fff')+shine(); },
  function(){ return S('M62 138Q66 54 150 50Q234 54 238 138','#58C9A0',24)+[[78,86,-48],[108,56,-22],[150,44,0],[192,56,22],[222,86,48]].map(function(p){ return '<path d="M-16 6L0 -32L16 6Z" fill="#FF9230" transform="translate('+p[0]+' '+p[1]+') rotate('+p[2]+')"/>'; }).join('')+blush(); }, ['scarf','#FF9230','#FFF3B0','#D96C10']);

add('tangerine','귤 요정',
  function(){ return C(100,112,62,'#FF9E1F')+P('M100 54Q108 22 142 26Q136 54 100 54Z','#3FA66B')+S('M102 52Q116 40 132 34','#2c7d4d',3)+S('M100 55Q96 40 88 36','#7a4a1f',7)+[[62,92],[74,78],[138,84],[148,106],[56,120],[130,152],[74,150]].map(function(p){ return C(p[0],p[1],2.2,'#E57A00'); }).join('')+eyes(108)+cheeks(128)+smile(132)+shine()+neck(['lei',['#FFB8D2','#FFFFFF','#FF8FB8']],100,164,38,9,22); },
  function(){ return S('M150 78Q146 50 132 40','#7a4a1f',11)+C(150,66,34,'#FF9E1F')+P('M150 36Q166 -2 214 8Q204 50 150 36Z','#3FA66B')+S('M156 34Q178 20 198 16','#2c7d4d',4)+C(139,62,5,'#2b2230')+C(163,62,5,'#2b2230')+S('M142 76Q151 85 160 76','#2b2230',4)+blush(); }, ['lei',['#FFB8D2','#FFFFFF','#FF8FB8']]);

add('berry','딸기 요정',
  function(){ return P('M100 172C54 156 30 116 38 86C46 56 80 56 100 66C120 56 154 56 162 86C170 116 146 156 100 172Z','#FF4D6A')+P('M100 70Q74 74 62 54Q82 58 84 46Q94 56 100 36Q106 56 116 46Q118 58 138 54Q126 74 100 70Z','#3FA66B')+[[60,92],[140,92],[68,142],[132,142],[100,154],[100,88],[52,112],[148,112]].map(function(p){ return E(p[0],p[1],2.6,4,'#FFE066'); }).join('')+eyes(110)+cheeks(130)+smile(134); },
  function(){ return band('#3FA66B')+P('M150 92Q104 96 82 60Q112 66 116 36Q138 54 150 16Q162 54 184 36Q188 66 218 60Q196 96 150 92Z','#3FA66B')+C(86,96,19,'#FF4D6A')+C(214,96,19,'#FF4D6A')+blush(); }, ['beads',['#FF4D6A','#fff'],'#FF4D6A']);

add('star','반짝 별',
  function(){ return P('M100 20Q110 20 118 42L128 68L156 70Q182 72 176 90Q173 98 154 114L134 130L142 158Q148 182 130 180Q122 179 100 164Q78 179 70 180Q52 182 58 158L66 130L46 114Q27 98 24 90Q18 72 44 70L72 68L82 42Q90 20 100 20Z','#FFD23F',' stroke="#EAA900" stroke-width="5" stroke-linejoin="round"')+eyes(100,20)+cheeks(118,33)+smile(121); },
  function(){ return band('#EAA900')+[[84,66,1],[150,40,1.35],[216,66,1]].map(function(p){ return '<path d="M0 -30L9 -10L31 -8L14 7L19 29L0 17L-19 29L-14 7L-31 -8L-9 -10Z" fill="#FFD23F" stroke="#EAA900" stroke-width="4" stroke-linejoin="round" transform="translate('+p[0]+' '+p[1]+') scale('+p[2]+')"/>'; }).join('')+blush(); }, ['beads',['#FFD23F','#fff'],'#FFD23F']);

add('astro','우주 탐험가',
  function(){ return S('M146 58L162 28','#8a93a8',6)+C(164,24,10,'#FF5D5D')+E(100,106,72,68,'#fff',0,LINE)+E(100,110,54,48,'#2F3E73')+E(100,116,43,38,'#FFD9B8')+eyes(112,18)+cheeks(128,28)+smile(132)+S('M62 90Q76 70 100 68','#fff',6,' opacity=".6"')+neck(['bow','#FF9230','#D96C10'],100,168,36,7,18); },
  function(){ return S('M48 196Q30 36 150 32Q270 36 252 196','#fff',26)+S('M62 190Q48 52 150 48Q252 52 238 190','#2F3E73',7)+S('M206 46L232 14','#8a93a8',8)+C(236,12,13,'#FF5D5D')+C(52,176,20,'#3E8BFF')+C(248,176,20,'#3E8BFF'); }, ['bow','#FF9230','#D96C10']);

add('alien','외계인 친구',
  function(){ return both(function(s){ return S('M'+(100+s*22)+' 62Q'+(100+s*30)+' 34 '+(100+s*46)+' 28','#5FBF4A',7)+C(100+s*48,26,11,'#FFE066'); })+P('M100 52C150 52 170 82 164 108C156 142 124 170 100 170C76 170 44 142 36 108C30 82 50 52 100 52Z','#9BE86B')+both(function(s){ return E(100+s*27,106,17,22,'#23203a',s*-22)+C(100+s*24,97,6,'#fff')+C(100+s*31,113,2.6,'#fff'); })+cheeks(136,34)+smile(142,'#2f6b24'); },
  function(){ return band('#5FBF4A')+both(function(s){ return S('M'+(150+s*40)+' 60Q'+(150+s*52)+' 26 '+(150+s*80)+' 22','#5FBF4A',10)+C(150+s*84,22,19,'#FFE066')+C(150+s*78,16,6,'#fff'); })+blush(); }, ['beads',['#9BE86B','#FFE066'],null]);

add('octopus','문어',
  function(){ var l=''; [[46,146,-1],[72,162,-1],[100,168,1],[128,162,1],[154,146,1]].forEach(function(p){ l+=S('M'+p[0]+' '+(p[1]-24)+'Q'+p[0]+' '+(p[1]+16)+' '+(p[0]+p[2]*18)+' '+(p[1]+8),'#FF7A6B',23); }); return l+E(100,96,64,60,'#FF7A6B')+eyes(104,22)+cheeks(122,40)+E(100,128,8,9,'#a8352c')+E(72,64,15,8,'#fff',-32,' opacity=".35"'); },
  function(){ return P('M60 108Q56 14 150 14Q244 14 240 108Q150 70 60 108Z','#FF7A6B')+[[62,106,-1],[240,106,1]].map(function(p){ return S('M'+p[0]+' '+(p[1]-8)+'Q'+(p[0]+p[2]*8)+' 168 '+(p[0]+p[2]*34)+' 160','#FF7A6B',24); }).join('')+C(126,56,9,'#2b2230')+C(174,56,9,'#2b2230')+C(129,52,3.5,'#fff')+C(177,52,3.5,'#fff')+E(150,72,7,8,'#a8352c')+blush(); }, ['beads',['#8ED8FF','#fff'],null]);

function faceSvg(c,attr){ return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"'+(attr||'')+'>'+c.face()+'</svg>'; }
function photoSvg(c,attr,guide){
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 350"'+(attr||'')+'>'+
    (guide?'<ellipse cx="150" cy="178" rx="74" ry="98" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="10 10" opacity=".85"/>':'')+
    c.top()+neck(c.neck,150,262,100,24,34)+'</svg>';
}
window.CHARS={list:LIST,face:faceSvg,photo:photoSvg};
})();
