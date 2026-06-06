import re
UP='/root/.claude/uploads/03c5d55c-f8dc-4a2a-ad73-3808b538bd59/2765508e-vivarium.html'
b=re.findall(r'<script>\n(.*?)\n</script>', open(UP,encoding='utf-8').read(), re.S)
un=lambda s:s.replace('<\\/script>','</script>')
ljs,mod,sim,game=un(b[0]),un(b[1]),un(b[2]),un(b[3])
def rep(t,o,n,l):
    assert o in t and t.count(o)==1,'ANCHOR FAIL: '+l+' ('+str(t.count(o))+')'
    print('ok:',l); return t.replace(o,n)

# ===== GAME =====
game=rep(game,"if(typeof PostProcessPlugin!=='undefined'){ try{ new PostProcessPlugin(`",
         "if(!touchDev&&typeof PostProcessPlugin!=='undefined'){ try{ new PostProcessPlugin(`","bloom gate")
game=rep(game,"function gameInit(){ S=createVivSim(window.VIV_TAC); cameraScale=0.7; gravity=0;",
         "function gameInit(){ S=createVivSim(window.VIV_TAC); cameraScale=0.7; setGravity(vec2(0,0)); if(touchDev)S.cfg.adviseEvery=3;","throttle+gravity")
game=rep(game,"    ['— JOUEUR —'],['Vitesse joueur',1,8,.1,()=>cfg.playerSpeed,v=>cfg.playerSpeed=v],",
         "    ['— JOUEUR —'],['Vitesse joueur',1,8,.1,()=>cfg.playerSpeed,v=>cfg.playerSpeed=v],\n    ['Aimbot  0 off · 1 assist · 2 auto',0,2,1,()=>cfg.aimbot==null?1:cfg.aimbot,v=>cfg.aimbot=v],","aimbot row")
game=rep(game,"    if(u===S.playerU){ for(let i=0;i<24;i++){const a1=i/24*6.2832,a2=(i+1)/24*6.2832;drawLine(vec2(ux+Math.cos(a1)*(u.r+10),uy+Math.sin(a1)*(u.r+10)),vec2(ux+Math.cos(a2)*(u.r+10),uy+Math.sin(a2)*(u.r+10)),2.5,C('#bbffff'));} }",
         "    if(u===S.playerU){ drawPoly(circlePts(ux,uy-u.r*.5,u.r*1.08,18),C('#ffd24a',.5));\n      const pr=u.r+9+Math.sin(time*5)*2; for(let i=0;i<28;i++){const a1=i/28*6.2832,a2=(i+1)/28*6.2832;drawLine(vec2(ux+Math.cos(a1)*pr,uy+Math.sin(a1)*pr),vec2(ux+Math.cos(a2)*pr,uy+Math.sin(a2)*pr),3,C('#9dfff0'));}\n      const ay=uy+u.r+14+Math.sin(time*5)*2; drawPoly([vec2(ux,ay),vec2(ux-6,ay+9),vec2(ux+6,ay+9)],C('#9dfff0'),2,C('#06302a')); }","player marker")
game=rep(game,"  document.body.appendChild(cfgEl);",
         "  ['mousedown','mousemove','mouseup','pointerdown','pointermove','pointerup','touchstart','touchmove','wheel'].forEach(ev=>cfgEl.addEventListener(ev,e=>e.stopPropagation()));\n  document.body.appendChild(cfgEl);","cfg isolation")
mm_old="""  const mmS=120/Math.max(S.MW,S.MH),mx=ms.x-S.MW*mmS-12,my=12; drawRect(vec2(mx+S.MW*mmS/2,my+S.MH*mmS/2),vec2(S.MW*mmS+6,S.MH*mmS+6),C('#000',.5),0,1,true);
  for(const u of S.units){if(u.hp<=0)continue;drawRect(vec2(mx+(u.x/S.TILE)*mmS,my+(u.y/S.TILE)*mmS),vec2(3,3),C(S.TEAMCOL[u.team]),0,1,true);}
  for(const o of S.mobs){drawRect(vec2(mx+(o.x/S.TILE)*mmS,my+(o.y/S.TILE)*mmS),vec2(2,2),o.sp===2?C('#b3f'):o.sp===4?C('#a5a'):o.sp===1?C('#e83'):o.sp===3?C('#e0a040'):C('#9d6'),0,1,true);}"""
mm_new="""  const mmS=120/Math.max(S.MW,S.MH),mw=S.MW*mmS,mh=S.MH*mmS,mx=ms.x-mw-12,my=12,mcx=mx+mw/2,mcy=my+mh/2; drawRect(vec2(mcx,mcy),vec2(mw+6,mh+6),C('#000',.5),0,1,true);
  const pu2=S.playerU,WWm=S.MW*S.TILE,WHm=S.MH*S.TILE,MMX=x=>mcx+(S.tdel(pu2.x,x,WWm)/S.TILE)*mmS,MMY=y=>mcy+(S.tdel(pu2.y,y,WHm)/S.TILE)*mmS;
  if(pu2){ for(const o of S.mobs){if(o.hp<=0)continue;drawRect(vec2(MMX(o.x),MMY(o.y)),vec2(2,2),o.sp===2?C('#b3f'):o.sp===4?C('#a5a'):o.sp===1?C('#e83'):o.sp===3?C('#e0a040'):C('#9d6'),0,1,true);}
    for(const u of S.units){if(u.hp<=0||u===pu2)continue;drawRect(vec2(MMX(u.x),MMY(u.y)),vec2(3,3),C(S.TEAMCOL[u.team]),0,1,true);}
    drawRect(vec2(mcx,mcy),vec2(12,2),C('#ff3df0')); drawRect(vec2(mcx,mcy),vec2(2,12),C('#ff3df0')); drawRect(vec2(mcx,mcy),vec2(9,9),C('#000')); drawRect(vec2(mcx,mcy),vec2(7,7),C('#ff3df0')); drawRect(vec2(mcx,mcy),vec2(3,3),C('#fff')); }"""
game=rep(game,mm_old,mm_new,"minimap centered")

# ===== SIM =====
sim=rep(sim,"if(!intents||(adviseTick&1)===0){","if(!intents||(adviseTick%(S.cfg.adviseEvery||2)===0)){","cadence")
sim=rep(sim,"    unitHp:200, enemyHpStep:6, allyBuff:20, playerSpeed:3.4, unitSpeed:2.7,",
        "    unitHp:200, enemyHpStep:6, allyBuff:20, playerSpeed:3.4, unitSpeed:2.7, aimbot:1,","aimbot cfg")
aim_old="""    if(inp.aim){pu.aim=Math.atan2(inp.aim.y-pu.y,inp.aim.x-pu.x);
      const WWp=S.MW*TILE,WHp=S.MH*TILE;let bd=850,ba=null;
      const cns=(ox,oy)=>{const dx=tdel(pu.x,ox,WWp),dy=tdel(pu.y,oy,WHp),d=Math.hypot(dx,dy);if(d<bd&&d>1){const ang=Math.atan2(dy,dx);let da=((ang-pu.aim+9.42478)%6.28319)-3.14159;if(Math.abs(da)<0.55){bd=d;ba=ang;}}};
      for(const u of S.units){if(u.hp>0&&u.team!==pu.team)cns(u.x,u.y);}
      for(const o of S.mobs){if(o.hp>0)cns(o.x,o.y);}
      if(ba!=null){let da=((ba-pu.aim+9.42478)%6.28319)-3.14159;pu.aim+=da*0.85;}
    }
    if(pu.fireCD>0)pu.fireCD--;
    if(inp.fire&&pu.fireCD<=0)fire(pu,pu.aim,S.playerWpns[S.pwi]);"""
aim_new="""    const AB=(S.cfg.aimbot==null?1:S.cfg.aimbot),WWp=S.MW*TILE,WHp=S.MH*TILE; let autoFire=false;
    if(inp.aim)pu.aim=Math.atan2(inp.aim.y-pu.y,inp.aim.x-pu.x);
    if(AB===2){ let tg=null,bd=1100; for(const u of S.units){if(u.hp>0&&u.team!==pu.team){const d=Math.hypot(tdel(pu.x,u.x,WWp),tdel(pu.y,u.y,WHp));if(d<bd){bd=d;tg=u;}}}
      if(!tg){let md=900;for(const o of S.mobs){if(o.hp>0){const d=Math.hypot(tdel(pu.x,o.x,WWp),tdel(pu.y,o.y,WHp));if(d<md){md=d;tg=o;}}}}
      if(tg){pu.aim=Math.atan2(tdel(pu.y,tg.y,WHp),tdel(pu.x,tg.x,WWp));autoFire=true;}
    } else if(AB===1&&inp.aim){ let bd=850,ba=null;
      const cns=(ox,oy)=>{const dx=tdel(pu.x,ox,WWp),dy=tdel(pu.y,oy,WHp),d=Math.hypot(dx,dy);if(d<bd&&d>1){const ang=Math.atan2(dy,dx);let da=((ang-pu.aim+9.42478)%6.28319)-3.14159;if(Math.abs(da)<0.55){bd=d;ba=ang;}}};
      for(const u of S.units){if(u.hp>0&&u.team!==pu.team)cns(u.x,u.y);}
      for(const o of S.mobs){if(o.hp>0)cns(o.x,o.y);}
      if(ba!=null){let da=((ba-pu.aim+9.42478)%6.28319)-3.14159;pu.aim+=da*0.85;}
    }
    if(pu.fireCD>0)pu.fireCD--;
    if((inp.fire||autoFire)&&pu.fireCD<=0)fire(pu,pu.aim,S.playerWpns[S.pwi]);"""
sim=rep(sim,aim_old,aim_new,"aimbot updatePlayer")
sim=rep(sim,"S.t=0;S.reinforceCD=0;S.allyCD=0;S.losses=S.losses||0;","S.t=0;S.reinforceCD=0;S.allyCD=0;S.losses=S.losses||0;S.wins=S.wins||0;","init wins")
sim=rep(sim,"if(!a1 && S.reinforceCD<=0){ S.reinforceCD=180;","if(!a1 && a0 && S.reinforceCD<=0){ S.reinforceCD=180;","mutual-wipe guard")
sim=rep(sim,"inp[4]=Math.sin(Date.now()*.001+i)","inp[4]=Math.sin(S.t*.001+i)","det mob input")
sim=rep(sim,"    return best?{tgt:best,d:bd}:null;}",
  "    return best?{tgt:best,d:bd}:null;}\n"
  "  function buildGrid(){const CS=130,g=Object.create(null),mb=S.mobs,gw=Math.ceil(S.MW*TILE/CS),gh=Math.ceil(S.MH*TILE/CS);for(let i=0;i<mb.length;i++){const o=mb[i];if(o.hp<=0)continue;const cx=((o.x/CS)|0)%gw,cy=((o.y/CS)|0)%gh,k=cx*100003+cy;(g[k]||(g[k]=[])).push(o);}S._grid={g,CS,gw,gh,maxSp:((Math.min(gw,gh)-1)/2)|0};}\n"
  "  function gridNear(mx,my,r,cb){const G=S._grid;if(!G){const mb=S.mobs;for(let i=0;i<mb.length;i++)cb(mb[i]);return;}const CS=G.CS,g=G.g,gw=G.gw,gh=G.gh,cx=(mx/CS)|0,cy=(my/CS)|0,sp=Math.min(G.maxSp,Math.ceil(r/CS)+1);for(let dy=-sp;dy<=sp;dy++)for(let dx=-sp;dx<=sp;dx++){const wcx=((cx+dx)%gw+gw)%gw,wcy=((cy+dy)%gh+gh)%gh,a=g[wcx*100003+wcy];if(a)for(let i=0;i<a.length;i++)cb(a[i]);}}","grid funcs")
sim=rep(sim,"    for(const o of S.mobs){if(o.hp<=0||!pred('mob',o.sp))continue;const dx=tdel(mx,o.x,WWp),dy=tdel(my,o.y,WHp),d=Math.hypot(dx,dy);if(d>0.5&&d<bd){bd=d;best={x:mx+dx,y:my+dy,kind:'mob',ref:o};}}",
  "    gridNear(mx,my,bd,(o)=>{if(o.hp<=0||!pred('mob',o.sp))return;const dx=tdel(mx,o.x,WWp),dy=tdel(my,o.y,WHp),d=Math.hypot(dx,dy);if(d>0.5&&d<bd){bd=d;best={x:mx+dx,y:my+dy,kind:'mob',ref:o};}});","nearest grid")
sim=rep(sim,"let cx=0,cy=0,n=0;for(const o of S.mobs){if(o!==m&&o.sp===m.sp&&o.hp>0){const dd=Math.hypot(o.x-m.x,o.y-m.y);if(dd<160){cx+=o.x;cy+=o.y;n++;}}}",
  "let cx=0,cy=0,n=0;gridNear(m.x,m.y,160,(o)=>{if(o!==m&&o.sp===m.sp&&o.hp>0){const dd=Math.hypot(o.x-m.x,o.y-m.y);if(dd<160){cx+=o.x;cy+=o.y;n++;}}});","flocking grid")
sim=rep(sim,"if(!hit)for(const o of S.mobs){if(o.hp>0&&Math.hypot(p.x-o.x,p.y-o.y)<p.r+o.r){o.hp-=p.dmg;hit=true;break;}}",
  "if(!hit){let _H=null;gridNear(p.x,p.y,p.r+26,(o)=>{if(!_H&&o.hp>0&&Math.hypot(p.x-o.x,p.y-o.y)<p.r+o.r)_H=o;});if(_H){_H.hp-=p.dmg;hit=true;}}","proj grid")
sim=rep(sim,"    updatePlayer(inp);stepAdvisor();updateMobs();","    buildGrid();updatePlayer(inp);stepAdvisor();updateMobs();","buildGrid call")
sim=rep(sim,"if(S.reinforceCD===0){ resetSquad(1);","if(S.reinforceCD===0){ resetSquad(0);resetSquad(1);","manche win both")
sim=rep(sim,"if(S.allyCD===0){ resetSquad(0);","if(S.allyCD===0){ resetSquad(0);resetSquad(1);","manche loss both")
sim=rep(sim,"if(p.life<=0||wallAt(p.x,p.y)){S.proj.splice(i,1);continue;}",
        "if(p.life<=0||wallAt(p.x,p.y)){S.proj.splice(i,1);continue;} p.t=(p.t||0)+1; if(p.t>2&&terrainAt(p.x,p.y)===4&&Math.random()<0.3){S.fx.push({t:'hit',x:p.x,y:p.y});S.proj.splice(i,1);continue;}","cover absorbs fire")
sim=rep(sim,"function hurt(u,dmg){ if(u.down)return;","function hurt(u,dmg){ if(u.down)return; if(terrainAt(u.x,u.y)===4)dmg*=0.6;","cover dmg reduction")

# ===== MODULE =====
mod=rep(mod,"for(let k=0;k<n;k++){const a=ag[k],u=units[k]; a.x=u.x; a.y=u.y; a.hp=(u.hp>0?u.hp:-1);}",
        "for(let k=0;k<n;k++){const a=ag[k],u=units[k]; const _rsp=(a.hp<=0&&u.hp>0); a.x=u.x; a.y=u.y; a.hp=(u.hp>0?u.hp:-1);"
        " if(_rsp){ a.state='A';a.ord='A';a.preRS='A';a.revived=false;a.koTimer=0;a.rvTarget=null;a.rvCD=0;"
        "a.stCD=0;a.flCD=0;a.mzCD=0;a.supCD=0;a.pCD=0;a.sCD=0;a.relCD=0;a.gCD=0;a.sqCD=0;a.sqActive=false;"
        "a.path=[];a.pgx=-1;a.pgy=-1;a.sqTgt=null;a.pkPh=null;a.lockTarget=null;a.lockAge=0;"
        "a.vx=0;a.vy=0;a.prevX=a.x;a.prevY=a.y;a.hpSmooth=u.hp;a._coverFrames=0;a._wpScdPenalty=0;a._wpRelPenalty=0;a._memStuck=0;"
        "if(a.role){a.mag=a.role.mag;} } }","module respawn reset")
mod=rep(mod,"const bx=ag.map(a=>a.x), by=ag.map(a=>a.y);",
        "{let _al0=0,_al1=0;for(let k=0;k<n;k++){const a=ag[k];if(a&&a.hp>0){if(a.team===0)_al0++;else _al1++;}}"
        "if(brain.state!=='run'&&_al0>0&&_al1>0){brain.state='run';brain.winner=-1;}}\n      const bx=ag.map(a=>a.x), by=ag.map(a=>a.y);","module resume")
mod=rep(mod,"    const thresh=AIM_THRESH[a.rn]||Math.PI/5\n    if(aimErr>thresh){this._sDir(a,toL,Math.min(.38,.15+aimErr*.3));return}",
        "    const thresh=(dist<3.2?Math.PI/2:(AIM_THRESH[a.rn]||Math.PI/5))\n    if(aimErr>thresh){this._sDir(a,toL,Math.min(.6,.2+aimErr*.45));return}","melee fire gate")
mod=rep(mod,"if(dT<5&&(a.mag<=0||a.state==='RL'||a.sqActive)){","if(dT<5&&(a.mag<=0||a.state==='RL'||a.sqActive||dT<2.6)){","sidearm point-blank")

# ECOSYSTEM: evolved personality traits (aggression/flee-threshold/flock) derived from each mob's
# brain weights -> they evolve with the genes and gate real behavior (not just movement wiggle).
sim=rep(sim,"function _mk(sp,p){const d=MOBD[sp];S.mobs.push({sp,x:p.x,y:p.y,r:d.r,hp:d.hp,maxHp:d.hp,brain:breed(sp),spd:d.spd,dmg:d.dmg,dmgCD:0,_t:null,fit:0});}",
        "function _mk(sp,p){const d=MOBD[sp],br=breed(sp);let wa=0,wf=0,wk=0;for(let i=0;i<8;i++)wa+=br[i];for(let i=8;i<16;i++)wf+=br[i];for(let i=16;i<24;i++)wk+=br[i];const aggr=1+Math.tanh(wa*.3)*.4,flee=.26+Math.tanh(wf*.3)*.14,flock=1+Math.tanh(wk*.3)*.5;S.mobs.push({sp,x:p.x,y:p.y,r:d.r,hp:d.hp,maxHp:d.hp,brain:br,spd:d.spd,dmg:d.dmg,dmgCD:0,_t:null,fit:0,aggr,flee,flock});}","eco _mk traits")
sim=rep(sim,"(k,sp)=>k==='mob'&&sp===0,320)","(k,sp)=>k==='mob'&&sp===0,320*m.aggr)","eco aggr prey")
sim=rep(sim,"(k)=>k==='unit',360)","(k)=>k==='unit',360*m.aggr)","eco aggr intr")
sim=rep(sim,"if(m.hp<m.maxHp*.25){const dg","if(m.hp<m.maxHp*m.flee){const dg","eco flee thresh")
sim=rep(sim,"sp!==2&&sp!==4),520)","sp!==2&&sp!==4),520*m.aggr)","eco aggr apex")
sim=rep(sim,"const cf=m.sp===3?.006:.002;","const cf=(m.sp===3?.006:.002)*m.flock;","eco flock trait")

import os
os.makedirs('/home/user/work/vivarium/engine',exist_ok=True)
os.makedirs('/home/user/work/vivarium/src',exist_ok=True)
os.makedirs('/home/user/work/vivarium/prototypes',exist_ok=True)
for p,c in [('/tmp/littlejs.rel.js',ljs),('/tmp/vivmod.js',mod),('/tmp/mod.js',mod),('/tmp/viv_sim.js',sim),('/tmp/viv_game.js',game),
            ('/home/user/work/vivarium/engine/littlejs.release.js',ljs),('/home/user/work/vivarium/engine/viv_tac_module.js',mod),
            ('/home/user/work/vivarium/src/viv_sim.js',sim),('/home/user/work/vivarium/src/viv_game.js',game)]:
    open(p,'w',encoding='utf-8').write(c)
print('REBUILD COMPLETE')
