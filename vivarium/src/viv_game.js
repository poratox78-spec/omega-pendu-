'use strict';
// ===== VIVARIUM — couche RENDU/INPUT (LittleJS) ; lit la SIM pure (createVivSim) =====
(function(){
let S=null;
// ---- contrôles MOBILE : twin-stick flottant + bouton grenade (ergonomique, auto-fire) ----
const touchDev=(typeof window!=='undefined')&&(('ontouchstart' in window)||(navigator&&navigator.maxTouchPoints>0));
let tMove=null,tAim=null,tNade=false,tTap=false,tSwitch=false,tAbility=false,lastL=0,lastR=0; const STK=64,DEAD=6;
function abilityBtn(){const ms=(typeof mainCanvasSize!=='undefined')?mainCanvasSize:{x:800,y:600};return{x:ms.x/2,y:ms.y-74,r:42};}
function scl(){ return (typeof mainCanvasSize!=='undefined'&&innerWidth)?(mainCanvasSize.x/innerWidth):1; }
function nadeBtn(){ const ms=(typeof mainCanvasSize!=='undefined')?mainCanvasSize:{x:800,y:600}; return {x:ms.x-78,y:ms.y-78,r:46}; }
if(touchDev){
  const ts=e=>{ if(e.target&&e.target.tagName&&e.target.tagName!=='CANVAS')return; e.preventDefault(); const sc=scl(),ms=mainCanvasSize,T=e.changedTouches,now=(typeof time!=='undefined'?time:0);
    for(let i=0;i<T.length;i++){ const t=T[i],x=t.clientX*sc,y=t.clientY*sc;
      if(S&&(S.state==='title'||S.state==='runover')){ tTap=true; continue; }
      if(S&&S.state==='fight'){const ab=abilityBtn();if(Math.hypot(x-ab.x,y-ab.y)<ab.r){tAbility=true;continue;}}
      if(x<ms.x/2){ if(now-lastL<0.30)tSwitch=true; lastL=now; if(!tMove)tMove={id:t.identifier,ox:x,oy:y,cx:x,cy:y}; }   // gauche : 2×tap = arme
      else { if(now-lastR<0.30)tNade=true; lastR=now; if(!tAim)tAim={id:t.identifier,ox:x,oy:y,cx:x,cy:y}; }            // droite : 2×tap = grenade
    }
  };
  const tm=e=>{ if(e.target&&e.target.tagName&&e.target.tagName!=='CANVAS')return; e.preventDefault(); const sc=scl(),T=e.changedTouches; for(let i=0;i<T.length;i++){const t=T[i]; if(tMove&&t.identifier===tMove.id){tMove.cx=t.clientX*sc;tMove.cy=t.clientY*sc;} if(tAim&&t.identifier===tAim.id){tAim.cx=t.clientX*sc;tAim.cy=t.clientY*sc;}} };
  const te=e=>{ const T=e.changedTouches; for(let i=0;i<T.length;i++){const t=T[i]; if(tMove&&t.identifier===tMove.id)tMove=null; if(tAim&&t.identifier===tAim.id)tAim=null;} };
  window.addEventListener('touchstart',ts,{passive:false}); window.addEventListener('touchmove',tm,{passive:false});
  window.addEventListener('touchend',te); window.addEventListener('touchcancel',te);
}
function drawPad(o,hex){ if(!o)return; drawRect(vec2(o.ox,o.oy),vec2(STK*2,STK*2),C('#ffffff',.07),0,1,true); let dx=o.cx-o.ox,dy=o.cy-o.oy,l=Math.hypot(dx,dy); if(l>STK){dx=dx/l*STK;dy=dy/l*STK;} drawRect(vec2(o.ox+dx,o.oy+dy),vec2(40,40),C(hex,.55),0,1,true); }
function C(hex,a){ const n=parseInt(hex.slice(1),16); return rgb(((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255,a==null?1:a); }
const COL={ wall:C('#2a3340'),wallL:C('#3c4a5a'),cover:C('#5a96d2',.16),coverL:C('#78b4e6',.5),
  floor:C('#161b22'),grass:C('#243a20'),water:C('#163a55'),rock:C('#343640'),bush:C('#2f6a2f'),
  ally:C('#46e8ff'),enemy:C('#ff5a3c'),white:C('#ffffff'),
  grazer:C('#99dd66'),hunter:C('#cc6633'),apex:C('#aa33aa'),apexEn:C('#cc2222'),swarm:C('#e0a040'),brute:C('#8a4a5a') };
const BIOMEG=[C('#2a4422'),C('#1c3216'),C('#34342a'),C('#1e3a30')]; // herbe: plaines/forêt/rocheux/marais
const BIOMEF=[C('#161f15'),C('#121a0f'),C('#1e1e18'),C('#12201c')]; // sol/biome
let SPR=null; const VIVSHEET='data:image/png;base64,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';
const LASB='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAA2CAYAAAAVvbNoAAACdklEQVR42nXVT0gUYRjH8adTlyDo1CWCOikSqDuCUUQHDxEdPBQEdSiI6OAhoiiKivBQEBiRENHBQ0SIBwPXnd0UKwsNLY0tTLYw0bA098/8352ZfXpf7EcPwbzwYeH7vuz78s4sS6RGQ7q4M5W1elLZytg/Vo/uep529Re3tmXtgpFzwv/prucpZVpXDdPykuh5as1Zi6mcVdZu5T13uhiGl2ZdB03Pk9p/FZacKArjOpeCOJad2kxnGfyoziA7qcMtgB3WGWRXBy/PQ6mqtvpLdnUmOw9rQZ1Bdn0FH2DFjxlkJyNrT8KSGzPIrrYrv4YFJ2aQXX/TKBTsmEF2as1aGZirxAyyq4PbzyFfjhhk11cwADOliEF29VjspzC1HjHIrg7u9MHE74hBdnVw+xGMr0UMsutFvTD2K2SQnTbe7Q0jP0MG2dUVOHfAXAkZZNdX0A1DP0IG2ckw7eswuBwyyK4fy2UYWKoxyE6tpnMBni3WGGTXV9AFT77XGGSn5ox1FvoWagyyU3PWOg2Pv9UYZCcj45yAh1+rDLJTi2kfgweFKoPsZAxbnXBvvsogu7qCymG4+6XKILv+tXTA7bkqg+xqO/sAdH8OGGRXb6a1F25+Chhkp+Z0OQXX8gGD7NSUKe6BKx8DBtmpZchugIuzAYPs1DRc3g3nZ3wG2ckYXN8BXe99BtmpMb26Hc5N+wyyU3t/ZRucmfIZZKfG/tUtcOqdzyA70f3CZjg56THIrv9eNsHxCY9BdpLj6FuPgZJG5xuPIXHRkXGPIXHRoVcuQ+KijpcuQ+Kig2MuQ+KifSNWaf+oy1riorYX9o32EZf1p+x/AKpjl6rTKgNOAAAALXRFWHRTb2Z0d2FyZQBieS5ibG9vZGR5LmNyeXB0by5pbWFnZS5QTkcyNEVuY29kZXKoBn/uAAAAAElFTkSuQmCC';
const LASR='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAA2CAYAAAAVvbNoAAACbUlEQVR42nXVQUiTcRjH8adTlyDo1KWLndohcNv7vpuIuxgIeTCQEAyEPOwg4cGDgqAgIuTBYKCQKOZB3d61yGiI4dDEykrNcJTSaMlGlqNmLDVa8vQ+0A8egveFD2Pf/8Pe9/3vHSP6d8RNszdmWYvCNs2JmGm2YI3uVlScjQUCC/FAoPw/6bJOUdPsti3ryI2skzO967w5EK/7+w/319fLz7q6fqLJOkUtax9K+fyfk3KZfxWLJ7qTM52H8vExg+4ylIXfpRKD7jK0A85pGHQnOxDYgqNCgUF3ubsNONzbY9Cd4pa1CqVcjkF3cnZ2GX5kswy6kx0MpuAgk2HQXS58Dr5vbzPoLlswC9/SaQbdZeg+FDY3GXSXoWn4urbGoLvc3T34srrKoLt80ih8Xllh0J2cx3UY8ktLDLrL0B3IpVIMupPzwN+G3fl5Bt3J+WX0w6dkkkF3+Vp64OPsLIPuZBtGF2QSCQbdKWoYHfAhFmPQXX53t2BnaopBdxkKw/vJSQbdZZ9uwrvxcQbdKWYYNyA9Osqguwxdh62REQbdZZ+uwdtIhEF3sn2+q/BmaIhBd7L9/iuwMTjIoLucLgRrAwMMutOMYVTBq74+Bt1pprLSDy97ehh0p2mv9zK86O5m0J2iXu8leN7ZyaA7RX2+i7DS0cGgu1z4BVhub2fQnSY8nvPwtK2NQXcaCwbPwWI4zKA7DXs8ZyDV2sqgO0WITsNCSwuD7vL3cgqeNDcz6E76mG9qYiC3Y66xkcF1KNnQwOA69Li+nsF16FFdHYPr0MPaWgbXoURNTfFBKMTCdSheVdWbqK5medX9Lwgkf09Sr51zAAAALXRFWHRTb2Z0d2FyZQBieS5ibG9vZGR5LmNyeXB0by5pbWFnZS5QTkcyNEVuY29kZXKoBn/uAAAAAElFTkSuQmCC';
const TOWN='data:image/png;base64,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';
const BOLT='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAeCAYAAADOziUSAAABvUlEQVR42qWVv0oDQRDGp7BIEdDSQjCFvZYWgvgEPoKPkEewtdCYKCgo4h8sRJEgkouEiBEiGhCUIASxSGORRsQmRZp1vz1ms7eeyW5uYIrsJr/75puZC5ERQY4WywVa9U387nyNxjUIhzfbJEbNYIuKClRap2kc1PZT4iPIeGXrakoDdXn40DidEOJ9ySsBVMoK9BIpERc+oN7bgqjujoUwKSgRjFWVCnTX72KeNnHYrswkU6UaIMk4/HqcS6ZqFFj3dV53EJNgw9q4wJdcYM3LSQUq5+mQ7OCnJFblC2NVf7wyB/bhKO3UQWyJVibtwVjpvdTTf5ISoplxyk41LRrHFIGqkks5WlYweSme/bJblxUdaGC2P/1Ff9jPPYnqDvFurmAssqwMl66g3lNflV5y1Mpzphohv/AZDIc1zzToOzIi6AYUmlDIb12EvtggPEybLz2n/wK183ohbZURn+QLglwCPqgVqw/xaVigbC7VVIWyY30aFHGz16k4+mSHPXsolX2KfVMMVMbvt9sQZvoU+X90CS4Hhps+XW/QrBeIF7+2F/VJrYtvsF8wf2Sf7E4aivx9imsA1svHp19Spwf0Vz7tHwAAAC10RVh0U29mdHdhcmUAYnkuYmxvb2RkeS5jcnlwdG8uaW1hZ2UuUE5HMjRFbmNvZGVyqAZ/7gAAAABJRU5ErkJggg==';
function buildSprites(){ try{ if(SPR||typeof tile!=='function'||typeof textureInfos==='undefined'||!textureInfos[0])return;
  const T=(c,r)=>tile(vec2(c,r),16,0);
  SPR={ LEADER:T(0,8),ASSAULT:T(2,8),FLANKER:T(4,7),SNIPER:T(4,9),SUPPORT:T(0,7),enemy:T(3,7),
        mob:[T(0,9),T(2,10),T(1,9),T(0,10),T(2,9)],
        laserB:tile(vec2(0,0),vec2(9,54),1), laserR:tile(vec2(0,0),vec2(9,54),2), bolt:tile(vec2(0,0),vec2(19,30),3),
        grass:tile(vec2(0,0),16,4), flower:tile(vec2(1,0),16,4), bush:tile(vec2(5,0),16,4), tree:tile(vec2(4,0),16,4), wall:tile(vec2(4,6),16,4) }; }catch(e){SPR=null;} }
// poly transformé (pré-calculé en monde, pas de dépendance au transform de drawPoly)
function tpts(local,x,y,ang,sc){ const c=Math.cos(ang),s=Math.sin(ang),o=[]; for(let i=0;i<local.length;i+=2){ const lx=local[i]*sc,ly=local[i+1]*sc; o.push(vec2(x+lx*c-ly*s, y+lx*s+ly*c)); } return o; }
function circlePts(cx,cy,r,n){ const o=[]; n=n||20; for(let i=0;i<n;i++){const a=i/n*6.2832;o.push(vec2(cx+Math.cos(a)*r,cy+Math.sin(a)*r));} return o; }
function starPts(cx,cy,r,spikes){ const o=[]; for(let i=0;i<spikes*2;i++){const a=i/(spikes*2)*6.2832,rr=(i%2===0)?r:r*.6;o.push(vec2(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr));} return o; }
const CHEV=[1,0, -.85,-.85, -.35,0, -.85,.85];   // chevron allié (pointe +x)
const DIAM=[1,0, 0,-1, -1,0, 0,1];               // losange ennemi

function fxSpawn(){ let _mz=0;
  for(const f of S.fx){
    if(typeof ParticleEmitter!=='undefined'){ try{
      if(f.t==='muzzle') new ParticleEmitter(vec2(f.x,f.y),f.a,4,.05,120,.5,0,C('#ffee66'),C('#ff9933'),C('#ffee66',0),C('#ff9933',0),.22,4,.5,5,0,1,1,0,0,.2,.4,0,1);
      else if(f.t==='hit') new ParticleEmitter(vec2(f.x,f.y),0,3,.05,140,3.14,0,C('#ffffff'),C('#cde0ee'),C('#ffffff',0),C('#cde0ee',0),.18,3,0,4);
      else if(f.t==='boom') new ParticleEmitter(vec2(f.x,f.y),0,90,.08,500,3.14,0,C('#ffcc44'),C('#ff5522'),C('#ffcc44',0),C('#ff2200',0),.5,16,1,6,0,.94,1,0,0,.2,.5,0,1);
      else if(f.t==='die') new ParticleEmitter(vec2(f.x,f.y),0,8,.08,180,3.14,0,C(f.col||'#fff'),C(f.col||'#fff'),C(f.col||'#fff',0),C(f.col||'#fff',0),.5,7,0,4);
      else if(f.t==='pickup') new ParticleEmitter(vec2(f.x,f.y),0,6,.08,120,3.14,0,f.core?C('#ff66ff'):C('#66ff99'),f.core?C('#ff66ff'):C('#66ff99'),C('#ffffff',0),C('#ffffff',0),.5,5,0,3);
    }catch(e){} }
    if(AUDIO){ try{
      if(f.t==='muzzle'){ if(_mz<2&&sndShot){sndShot.play(vec2(f.x,f.y),.3);_mz++;} }
      else if(f.t==='hit'&&sndHit) sndHit.play(vec2(f.x,f.y),.35);
      else if(f.t==='boom'&&sndBoom) sndBoom.play(vec2(f.x,f.y));
      else if(f.t==='die'&&sndDie) sndDie.play(vec2(f.x,f.y),.5);
      else if(f.t==='pickup'&&sndPickup) sndPickup.play(vec2(f.x,f.y));
    }catch(e){} }
  }
}
let sndShot,sndHit,sndBoom,sndDie,sndPickup; const AUDIO=true;
let cfgEl=null, menuEl=null, roleEl=null;
function vivMenuToggle(){ if(!menuEl)return; const op=menuEl.style.display==='none'; menuEl.style.display=op?'flex':'none'; if(!op)cfgEl.style.display='none'; }
function buildMenus(){
  if(typeof document==='undefined'||menuEl)return; const cfg=S.cfg;
  const mkBtn=(label,fn,col)=>{const b=document.createElement('button');b.textContent=label;b.style.cssText='padding:12px 14px;font:15px monospace;background:'+(col||'#16202c')+';color:#fff;border:1px solid #3a4a5a;border-radius:8px;cursor:pointer;text-align:left';b.addEventListener('click',fn);b.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();fn();},{passive:false});return b;};
  // ===== MENU PRINCIPAL (classique) =====
  menuEl=document.createElement('div');
  menuEl.style.cssText='position:fixed;inset:0;display:none;z-index:99998;background:rgba(8,11,16,.85);align-items:center;justify-content:center;font:14px monospace';
  menuEl.addEventListener('touchstart',e=>e.stopPropagation(),{passive:false});
  const box=document.createElement('div'); box.style.cssText='background:#10161f;border:1px solid #2a3a4a;border-radius:12px;padding:22px;min-width:250px;display:flex;flex-direction:column;gap:10px';
  const ttl=document.createElement('div');ttl.textContent='VIVARIUM';ttl.style.cssText='font:bold 26px monospace;color:#fff;text-align:center;margin-bottom:6px';box.appendChild(ttl);
  box.appendChild(mkBtn('\u25B6  Reprendre',()=>{menuEl.style.display='none';cfgEl.style.display='none';}));
  box.appendChild(mkBtn('\u2699  Reglages',()=>{menuEl.style.display='none';cfgEl.style.display='block';}));
  box.appendChild(mkBtn('\u21BB  Recommencer',()=>{menuEl.style.display='none';cfgEl.style.display='none';S.state='runover';S.deploy();},'#2a1a1a'));
  const hint=document.createElement('div');hint.innerHTML='<div style="color:#789;font-size:11px;margin-top:8px;max-width:230px;line-height:1.5">PC: ZQSD - souris - clic tir - G grenade - F arme - E capacite - C menu<br>Mobile: 2 sticks - 2xtap droite grenade - 2xtap gauche arme</div>';box.appendChild(hint);
  menuEl.appendChild(box); document.body.appendChild(menuEl);
  // ===== SOUS-MENU REGLAGES (sliders [STA]) =====
  cfgEl=document.createElement('div');
  cfgEl.style.cssText='position:fixed;top:0;right:0;width:270px;max-height:100%;overflow-y:auto;background:rgba(10,14,20,.97);color:#fff;font:12px monospace;padding:10px;z-index:99999;display:none;border-left:2px solid #2a3a4a;-webkit-overflow-scrolling:touch';
  cfgEl.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true}); cfgEl.addEventListener('touchmove',e=>e.stopPropagation(),{passive:true});
  cfgEl.appendChild(mkBtn('\u2190  Retour',()=>{cfgEl.style.display='none';menuEl.style.display='flex';},'#1a2230'));
  const head=document.createElement('div'); head.innerHTML='<b style="color:#fff">REGLAGES [STA]</b><div style="color:#789;margin:4px 0 8px">PV/spawn = au prochain renfort</div>'; cfgEl.appendChild(head);
  const rows=[
    ['— JOUEUR —'],['Vitesse joueur',1,8,.1,()=>cfg.playerSpeed,v=>cfg.playerSpeed=v],
    ['Arme joueur dmg',5,80,1,()=>cfg.player.dmg,v=>cfg.player.dmg=v],['Arme joueur cadence',3,40,1,()=>cfg.player.cd,v=>cfg.player.cd=v],
    ['— ESCOUADE —'],['PV unites',80,500,10,()=>cfg.unitHp,v=>cfg.unitHp=v],['Vitesse IA',1,6,.1,()=>cfg.unitSpeed,v=>cfg.unitSpeed=v],
    ['Escalade PV ennemi/niv',0,60,5,()=>cfg.enemyHpStep,v=>cfg.enemyHpStep=v],['Bonus PV/niveau',0,80,5,()=>cfg.allyBuff,v=>cfg.allyBuff=v],
    ['Bouclier max',0,150,10,()=>cfg.shield,v=>cfg.shield=v],['Regen bouclier',.2,4,.2,()=>cfg.shRegen,v=>cfg.shRegen=v],
    ['— ARMES ROLES (dmg) —'],['LEADER',5,100,1,()=>cfg.wpn.LEADER.dmg,v=>cfg.wpn.LEADER.dmg=v],['ASSAULT',5,100,1,()=>cfg.wpn.ASSAULT.dmg,v=>cfg.wpn.ASSAULT.dmg=v],
    ['FLANKER',5,100,1,()=>cfg.wpn.FLANKER.dmg,v=>cfg.wpn.FLANKER.dmg=v],['SNIPER',5,150,1,()=>cfg.wpn.SNIPER.dmg,v=>cfg.wpn.SNIPER.dmg=v],['SUPPORT',5,100,1,()=>cfg.wpn.SUPPORT.dmg,v=>cfg.wpn.SUPPORT.dmg=v],
    ['— FAUNE —'],['Grazer PV',20,200,5,()=>cfg.mob[0].hp,v=>cfg.mob[0].hp=v],['Hunter PV',40,400,10,()=>cfg.mob[1].hp,v=>cfg.mob[1].hp=v],['Hunter dmg',2,40,1,()=>cfg.mob[1].dmg,v=>cfg.mob[1].dmg=v],
    ['Apex PV',100,1500,50,()=>cfg.mob[2].hp,v=>cfg.mob[2].hp=v],['Apex dmg',5,80,1,()=>cfg.mob[2].dmg,v=>cfg.mob[2].dmg=v],['Grazers/spawn',0,12,1,()=>cfg.spawn.g,v=>cfg.spawn.g=v],['Hunters/spawn',0,8,1,()=>cfg.spawn.h,v=>cfg.spawn.h=v],
    ['— GRENADE —'],['Rayon',40,220,5,()=>cfg.gren.r,v=>cfg.gren.r=v],['Degats',20,200,5,()=>cfg.gren.dmg,v=>cfg.gren.dmg=v],['Cooldown',20,150,5,()=>cfg.gren.cd,v=>cfg.gren.cd=v],
    ['— CAMERA —'],['Camera zoom',.4,1.5,.05,()=>cameraScale,v=>cameraScale=v]
  ];
  for(const r of rows){
    if(r.length===1){ const h=document.createElement('div'); h.textContent=r[0]; h.style.cssText='color:#fff;margin:9px 0 2px;font-weight:bold'; cfgEl.appendChild(h); continue; }
    const lab=r[0],mn=r[1],mx=r[2],st=r[3],get=r[4],set=r[5];
    const w=document.createElement('div'); w.style.margin='3px 0';
    const top=document.createElement('div'); top.style.cssText='display:flex;justify-content:space-between';
    const nm=document.createElement('span'); nm.textContent=lab; const val=document.createElement('span'); val.style.color='#fff'; val.textContent=get();
    top.appendChild(nm); top.appendChild(val);
    const sl=document.createElement('input'); sl.type='range'; sl.min=mn; sl.max=mx; sl.step=st; sl.value=get(); sl.style.width='100%';
    sl.addEventListener('input',()=>{ const v=parseFloat(sl.value); set(v); val.textContent=v; });
    w.appendChild(top); w.appendChild(sl); cfgEl.appendChild(w);
  }
  document.body.appendChild(cfgEl);
  // ===== ÉCRAN CHOIX DE RÔLE =====
  roleEl=document.createElement('div');
  roleEl.style.cssText='position:fixed;inset:0;display:none;z-index:99998;background:rgba(8,11,16,.92);align-items:center;justify-content:center;font:14px monospace';
  roleEl.addEventListener('touchstart',e=>e.stopPropagation(),{passive:false});
  const rbox=document.createElement('div'); rbox.style.cssText='background:#10161f;border:1px solid #2a3a4a;border-radius:12px;padding:22px;display:flex;flex-direction:column;gap:8px;max-width:320px';
  const rt=document.createElement('div');rt.textContent='CHOISIS TON ROLE';rt.style.cssText='font:bold 20px monospace;color:#fff;text-align:center;margin-bottom:8px';rbox.appendChild(rt);
  const roles=[['LEADER','equilibre + grenades'],['ASSAULT','cadence elevee'],['FLANKER','rapide + fumigene'],['SNIPER','perforant longue portee'],['SUPPORT','soigne/reanime + fusil']];
  for(const rd of roles){const r=rd[0],desc=rd[1];const b=document.createElement('button');b.innerHTML='<b>'+r+'</b> <span style=\"color:#bbb\">- '+desc+'</span>';b.style.cssText='padding:11px;font:13px monospace;background:#16202c;color:#fff;border:1px solid #3a4a5a;border-radius:8px;cursor:pointer;text-align:left';const pick=()=>{S.playerRole=r;roleEl.style.display='none';menuEl.style.display='none';S.deploy();};b.addEventListener('click',pick);b.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();pick();},{passive:false});rbox.appendChild(b);}
  roleEl.appendChild(rbox); document.body.appendChild(roleEl);
  // ===== bouton MENU (haut-gauche) =====
  const btn=document.createElement('button'); btn.textContent='\u2630'; btn.title='Menu (C)';
  btn.style.cssText='position:fixed;top:8px;left:8px;z-index:99997;width:48px;height:48px;font-size:24px;background:#16202c;color:#fff;border:1px solid #3a4a5a;border-radius:8px;cursor:pointer;pointer-events:auto;touch-action:manipulation';
  btn.addEventListener('click',vivMenuToggle); btn.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();vivMenuToggle();},{passive:false});
  document.body.appendChild(btn);
}
function gameInit(){ S=createVivSim(window.VIV_TAC); cameraScale=0.7; gravity=0; if(touchDev)S.cfg.adviseEvery=3;
  if(AUDIO&&typeof Sound!=='undefined'){ try{
    sndShot=new Sound([.22,.06,420,0,.02,.05,1]); sndHit=new Sound([.3,.1,200,0,.02,.05,4]);
    sndBoom=new Sound([.7,.3,90,.02,.2,.4,4]); sndDie=new Sound([.4,.1,160,.02,.1,.2,1]);
    sndPickup=new Sound([.35,.05,520,0,.04,.1,0]);
  }catch(e){} }
  if(!touchDev&&typeof PostProcessPlugin!=='undefined'){ try{ new PostProcessPlugin(`
    void mainImage(out vec4 c, vec2 p){
      vec2 uv=p/iResolution.xy; vec3 col=texture(iChannel0,uv).rgb; vec3 b=vec3(0.0);
      for(int i=0;i<8;i++){ float a=float(i)*0.7853982; vec2 o=vec2(cos(a),sin(a))/iResolution.xy*2.5; b+=max(texture(iChannel0,uv+o).rgb-0.6,0.0); }
      col+=b*0.35; c=vec4(col,1.0);
    }`, true); }catch(e){} }
  buildSprites();
  buildMenus();
}
function gameUpdate(){
  let mvx=0,mvy=0;
  if(keyIsDown('KeyW')||keyIsDown('KeyZ')||keyIsDown('ArrowUp'))mvy++;
  if(keyIsDown('KeyS')||keyIsDown('ArrowDown'))mvy--;
  if(keyIsDown('KeyA')||keyIsDown('KeyQ')||keyIsDown('ArrowLeft'))mvx--;
  if(keyIsDown('KeyD')||keyIsDown('ArrowRight'))mvx++;
  const inp={ move:{x:mvx,y:mvy}, aim:{x:mousePos.x,y:mousePos.y}, fire:mouseIsDown(0),
    grenade:keyWasPressed('KeyG'), switchWeapon:keyWasPressed('KeyF'), ability:keyWasPressed('KeyE'), deploy:(mouseWasPressed(0)||keyWasPressed('Enter')||keyWasPressed('Space')) };
  if(touchDev){ const pu=S.playerU; inp.move={x:0,y:0}; inp.fire=false;
    if(tMove){ const dx=tMove.cx-tMove.ox,dy=tMove.cy-tMove.oy; if(Math.hypot(dx,dy)>DEAD) inp.move={x:dx,y:-dy}; }
    if(tAim&&pu){ const dx=tAim.cx-tAim.ox,dy=tAim.cy-tAim.oy; if(Math.hypot(dx,dy)>DEAD){ inp.aim={x:pu.x+dx,y:pu.y-dy}; inp.fire=true; } }
    if(tNade){ inp.grenade=true; tNade=false; } if(tSwitch){ inp.switchWeapon=true; tSwitch=false; } if(tAbility){ inp.ability=true; tAbility=false; } if(tTap){ inp.deploy=true; tTap=false; }
  }
  if(keyWasPressed('KeyC'))vivMenuToggle();
  if((S.state==='title'||S.state==='runover')&&inp.deploy&&roleEl){ roleEl.style.display='flex'; inp.deploy=false; }
  S.update(inp);
  fxSpawn();
  if(S.playerU&&S.state!=='title') cameraPos=vec2(S.playerU.x,S.playerU.y);
}
function hpbar(x,y,w,hpf,col){ drawRect(vec2(x,y),vec2(w,4),C('#000')); drawRect(vec2(x-w/2+(w*hpf)/2,y),vec2(w*hpf,4),col); }
function gameRender(){
  if(!S||S.state==='title'||(S.state==='runover'&&!S.units.length)) return;
  if(!S.arena||!S.playerU) return;
  const T=S.TILE,MW=S.MW,MH=S.MH,tr=S.world?S.world.terrain:null,pu=S.playerU;
  const WWp=MW*T,WHp=MH*T, RX=x=>pu.x+S.tdel(pu.x,x,WWp), RY=y=>pu.y+S.tdel(pu.y,y,WHp);
  // terrain : lookup WRAPPÉ autour du joueur (monde toroïdal, sans couture)
  if(tr){ const ptx=Math.floor(pu.x/T),pty=Math.floor(pu.y/T);
    const sx=Math.ceil(mainCanvasSize.x/2/cameraScale/T)+1, sy=Math.ceil(mainCanvasSize.y/2/cameraScale/T)+1;
    const BT=SPR?[WHITE,C('#c2e0a6'),C('#d4c6a4'),C('#a2c2ac')]:null;
    const SZ=vec2(T,T),SZf=vec2(T+0.5,T+0.5),SZtr=vec2(T*1.5,T*1.5),SZbu=vec2(T*1.05,T*1.05),_pp=vec2(),_wat=C('#2f6f9a'),_wallM=C('#cdd4da');
    for(let dy=-sy;dy<=sy;dy++)for(let dx=-sx;dx<=sx;dx++){
      const wtx=S.wrapv(ptx+dx,MW)|0, wty=S.wrapv(pty+dy,MH)|0, t=tr[wty*MW+wtx], bm=(S.world.biome?S.world.biome[wty*MW+wtx]:0);
      _pp.x=(ptx+dx)*T+T/2; _pp.y=(pty+dy)*T+T/2;
      if(SPR&&SPR.grass){ const hsh=((wtx*73856093)^(wty*19349663))>>>0;
        if(t===2){ drawTile(_pp,SZ,SPR.grass,BT[bm]); _wat.a=.46+.08*Math.sin(time*2+wtx+wty); drawRect(_pp,SZ,_wat); }
        else if(t===3||t===5){ drawTile(_pp,SZ,SPR.wall,bm===3?_wallM:WHITE); }
        else { drawTile(_pp,SZf,(hsh&7)===0?SPR.flower:SPR.grass,BT[bm]);
          if(t===4){ if(bm===1)drawTile(_pp,SZtr,SPR.tree); else drawTile(_pp,SZbu,SPR.bush); } }
      } else { const px=_pp.x,py=_pp.y;
        let c=BIOMEF[bm],sz=T; if(t===1)c=BIOMEG[bm];else if(t===2)c=COL.water;else if(t===3)c=COL.rock;else if(t===4){c=COL.bush;sz=T-5;}else if(t===5)c=COL.wall;
        drawRect(vec2(px,py),vec2(sz,sz),c);
        if(t===2)drawRect(vec2(px,py),vec2(T,T),C('#3a7faa',.12+.06*Math.sin(time*2+wtx+wty)));
      }
    }
  }
  if(S.objType==='zone'&&S.zone){ const z=S.zone,zx=RX(z.x),zy=RY(z.y),pts=circlePts(zx,zy,z.r,28); for(let i=0;i<pts.length;i++)drawLine(pts[i],pts[(i+1)%pts.length],2,C('#78c8ff',.6)); }
  for(const L of S.loot){ const lx=RX(L.x),ly=RY(L.y),lc=L.type==='core'?'#ffd24a':'#44ff99';
    drawPoly(circlePts(lx,ly,9,8),C(lc,.3)); drawRect(vec2(lx,ly),vec2(L.type==='core'?9:6,L.type==='core'?9:6),C(lc),time*3); drawRect(vec2(lx,ly),vec2(3,3),C('#fff',.85)); }
  for(const sm of S.smokes){ const rr=sm.r*Math.min(1,sm.life/40); drawPoly(circlePts(RX(sm.x),RY(sm.y),rr,16),C('#9aa6b0',Math.min(.38,sm.life/300*.45))); }
  for(const g of S.nades){ const gx=RX(g.x),gy=RY(g.y);
    if(g.flash>0){ const rr=S.cfg.gren.r*(1.05-g.flash/12); drawRect(vec2(RX(g.tx),RY(g.ty)),vec2(rr*2,rr*2),C('#ffaa28',g.flash/12*.55)); }
    else { drawRect(vec2(gx,gy),vec2(8,4),C('#000',.35)); drawRect(vec2(gx,gy+(g.z||0)),vec2(7,7),C('#d2dcc4')); }
  }
  for(const p of S.proj){ const px=RX(p.x),py=RY(p.y),pc=p.team===0?'#3cc6ff':'#ff6a3c',pa=Math.atan2(p.vy,p.vx);
    drawPoly(circlePts(px,py,p.r+5,8),C(pc,.26));
    drawLine(vec2(px-Math.cos(pa)*p.r,py-Math.sin(pa)*p.r),vec2(px+Math.cos(pa)*p.r*1.6,py+Math.sin(pa)*p.r*1.6),3,C(pc));
    drawRect(vec2(px,py),vec2(2.6,2.6),C('#ffffff',.95)); }
  for(const m of S.mobs){ const en=m.hp<m.maxHp*.3,mx=RX(m.x),my=RY(m.y);
    const base=m.sp===0?'#7fe06a':m.sp===1?'#ff8a3c':m.sp===3?'#ffd24a':m.sp===4?'#c060d0':(en?'#ff4d4d':'#d65cff');
    drawPoly(circlePts(mx,my,m.r*1.55,10),C(base,.15));
    if(m.sp===0)drawPoly(circlePts(mx,my,m.r,12),C(base),2,C('#0c2a0a'));
    else if(m.sp===1||m.sp===3){const dir=Math.atan2((m._t?m._t.y-m.y:0),(m._t?m._t.x-m.x:1));drawPoly(tpts([1,0,-.85,-.7,-.4,0,-.85,.7],mx,my,dir,m.r),C(base),2,C('#3a1a08'));}
    else if(m.sp===4)drawPoly(tpts([1,0,.5,-.87,-.5,-.87,-1,0,-.5,.87,.5,.87],mx,my,0,m.r),C(base),2.5,C('#2a0a30'));
    else drawPoly(starPts(mx,my,m.r,9),C(base),3,C('#2a0a30'));
    drawRect(vec2(mx,my),vec2(m.r*.42,m.r*.42),C('#fff',.55));
    if(m.sp===4)drawText('BRUTE',vec2(mx,my+m.r+9),10,C('#fff'),2.5,C('#000'));
    else if(m.sp===2)drawText(en?'APEX ENRAGE':'APEX',vec2(mx,my+m.r+10),11,C('#fff'),2.5,C('#000'));
    hpbar(mx,my+m.r+5,(m.sp===2||m.sp===4)?46:16,Math.max(0,m.hp/m.maxHp),C(base));
  }
  for(const u of S.units){ if(u.hp<=0&&!u.down)continue; const ally=u.team===0,ux=RX(u.x),uy=RY(u.y),gc=ally?'#46e8ff':'#ff5a3c';
    if(u.down){ drawPoly(circlePts(ux,uy,u.r,10),C('#3a3a3a'),2,C(ally?'#5af':'#f85')); drawText('!',vec2(ux,uy),13,C('#fff'),2.5,C('#000')); hpbar(ux,uy+u.r+6,26,1-u.downT/420,C('#fa4')); continue; }
    drawPoly(circlePts(ux,uy,u.r*1.55,10),C(gc,ally?.2:.22));
    if(u===S.playerU){ const pr=u.r+8+Math.sin(time*5)*2; for(let i=0;i<26;i++){const a1=i/26*6.2832,a2=(i+1)/26*6.2832;drawLine(vec2(ux+Math.cos(a1)*pr,uy+Math.sin(a1)*pr),vec2(ux+Math.cos(a2)*pr,uy+Math.sin(a2)*pr),2.5,C('#9dfff0'));} }
    drawPoly(tpts(ally?CHEV:DIAM,ux,uy,u.aim,u.r*1.15),C(gc),2,C('#ffffff'));
    drawRect(vec2(ux,uy),vec2(u.r*.5,u.r*.5),C('#fff',.65));
    drawLine(vec2(ux,uy),vec2(ux+Math.cos(u.aim)*24,uy+Math.sin(u.aim)*24),2,C(ally?'#bdf':'#fdb'));
    if(ally)drawText(u.rn[0],vec2(ux,uy-u.r-7),9,C('#cfeaff'),2.5,C('#000'));
    hpbar(ux,uy+u.r+6,26,Math.max(0,u.hp/u.maxHp),C(gc));
    if(u.shMax>0){const sf=Math.max(0,u.sh/u.shMax);drawRect(vec2(ux,uy+u.r+11),vec2(26,3),C('#0a1626'));if(sf>0)drawRect(vec2(ux-13+13*sf,uy+u.r+11),vec2(26*sf,3),C('#5cdcff'));}
  }
}
function gameRenderPost(){
  if(!S)return; const ms=mainCanvasSize;
  if(S.state==='title'||(S.state==='runover')){ drawTextScreen('VIVARIUM',vec2(ms.x/2,ms.y/2-50),46,C('#fff'),5,C('#000')); drawTextScreen('Escouade vivante · monde hostile',vec2(ms.x/2,ms.y/2),16,C('#fff'),3,C('#000')); drawTextScreen(S.state==='runover'?('RUN TERMINÉE — '+S.runMissions+' mission(s)'):'',vec2(ms.x/2,ms.y/2-86),18,C('#fff'),3,C('#000')); drawTextScreen('[Entrée] / [clic] : déployer',vec2(ms.x/2,ms.y/2+40),18,C('#fff'),3,C('#000')); drawTextScreen(touchDev?'MOBILE : sticks · 2×tap droite=grenade · 2×tap gauche=arme · bouton CAP=capacité':'ZQSD · souris · clic tir · G grenade · F arme · E capacité',vec2(ms.x/2,ms.y/2+70),13,C('#fff'),3,C('#000')); return; }
  // HUD escouade — minimaliste : icône rôle + barre PV (symboles, pas de texte)
  const blues=S.units.filter(u=>u.team===0); const PX=12, bw=72; let y=14;
  drawRect(vec2(PX+52,14+blues.length*11+4),vec2(120,18+blues.length*22),C('#0a0e14',.42),0,1,true);
  drawTextScreen('◆ '+S.mission+'   ⚑ '+(S.wins||0)+'   ✖ '+(S.losses||0),vec2(PX,y),13,C('#fff'),3,C('#000'),'left'); y+=16;
  for(const u of blues){ const me=(u===S.playerU);
    if(SPR){ drawTile(vec2(PX+9,y+7),vec2(18,18),SPR[u.rn]||SPR.ASSAULT,u.hp>0?WHITE:C('#666'),0,false,undefined,undefined,true); }
    const hpf=Math.max(0,u.hp/u.maxHp);
    drawRect(vec2(PX+24+bw/2,y+5),vec2(bw,8),C('#000',.55),0,1,true);
    if(hpf>0)drawRect(vec2(PX+24+(bw*hpf)/2,y+5),vec2(bw*hpf,8),u.down?C('#d2a83a'):(hpf>.3?C('#3fcf5a'):C('#df7a33')),0,1,true);
    if(u.shMax>0&&u.sh>0){const sf=u.sh/u.shMax;drawRect(vec2(PX+24+(bw*sf)/2,y+11),vec2(bw*sf,2),C('#7fe0ff'),0,1,true);}
    if(me)drawTextScreen('▸',vec2(PX+20,y+4),12,C('#fff'),3,C('#000'),'left');
    y+=22;
  }
  // minimap
  const mmS=120/Math.max(S.MW,S.MH),mx=ms.x-S.MW*mmS-12,my=12; drawRect(vec2(mx+S.MW*mmS/2,my+S.MH*mmS/2),vec2(S.MW*mmS+6,S.MH*mmS+6),C('#000',.5),0,1,true);
  for(const u of S.units){if(u.hp<=0)continue;drawRect(vec2(mx+(u.x/S.TILE)*mmS,my+(u.y/S.TILE)*mmS),vec2(3,3),C(S.TEAMCOL[u.team]),0,1,true);}
  for(const o of S.mobs){drawRect(vec2(mx+(o.x/S.TILE)*mmS,my+(o.y/S.TILE)*mmS),vec2(2,2),o.sp===2?C('#b3f'):o.sp===4?C('#a5a'):o.sp===1?C('#e83'):o.sp===3?C('#e0a040'):C('#9d6'),0,1,true);}
  if(S.bannerT>0&&S.banner) drawTextScreen(S.banner,vec2(ms.x/2,58),20,C('#fff'),4,C('#000'));
  if(S.world&&S.playerU){const hb=Math.round(S.heat*10);let g='';for(let i=0;i<10;i++)g+=(i<hb?'▮':'▯');drawTextScreen('☠ '+g,vec2(ms.x/2,ms.y-18),13,S.heat>.6?C('#ff9a7a'):C('#fff'),3,C('#000'));}
  drawTextScreen('▸ '+(S.playerWpns?S.playerWpns[S.pwi].name:''),vec2(12,ms.y-16),13,C('#fff'),3,C('#000'),'left');
  if(touchDev){ drawPad(tMove,'#46e8ff'); drawPad(tAim,'#ff5a3c'); const ab=abilityBtn(); drawRect(vec2(ab.x,ab.y),vec2(ab.r*2,ab.r*2),C('#2a8a6a',.4),0,1,true); drawTextScreen('CAP',vec2(ab.x,ab.y),18,C('#fff'),3,C('#000')); }
}
engineInit(gameInit, gameUpdate, ()=>{}, gameRender, gameRenderPost, [VIVSHEET,LASB,LASR,BOLT,TOWN]);
})();
