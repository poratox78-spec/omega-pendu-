'use strict';
// ===== VIVARIUM — SIMULATION PURE (engine-agnostic, testable headless) =====
// Aucune dépendance DOM/canvas. Le rendu (LittleJS) lit S.* et S.fx ; l'input est injecté.
// Convention : coords libres (le rendu gère l'orientation). 1 unité sim = 1 px de référence.
function createVivSim(VIV_TAC){
  const TILE=24, TEAMCOL=['#46e8ff','#ff5a3c'];
  const wrapv=(v,m)=>{v=v%m;return v<0?v+m:v;};                          // wrap dans [0,m)
  const tdel=(a,b,m)=>{let d=(b-a)%m;if(d>m/2)d-=m;else if(d<-m/2)d+=m;return d;}; // delta toroïdal (plus court)
  const WPN={ LEADER:{dmg:19,bst:2,sprd:.06,spd:9,cd:15,r:5,life:80,name:'FUSIL-A'},ASSAULT:{dmg:16,bst:3,sprd:.12,spd:9,cd:14,r:5,life:80,name:'AUTO'},FLANKER:{dmg:14,bst:2,sprd:.10,spd:9.5,cd:9,r:4,life:70,name:'SMG'},SNIPER:{dmg:46,bst:1,sprd:.02,spd:14,cd:36,r:6,life:120,type:'pierce',name:'RAILGUN'},SUPPORT:{dmg:11,bst:5,sprd:.05,spd:8.5,cd:19,r:4,life:80,type:'spread',name:'EPANDEUR'} };
  const PLWPN={dmg:20,bst:2,sprd:.05,spd:11,cd:9,r:5,life:90,name:'PLASMA'};
  const PLWPN2={dmg:9,bst:5,sprd:.11,spd:9,cd:17,r:4,life:70,type:'spread',name:'FUSIL'};
  const SEC={LEADER:{dmg:30,bst:1,sprd:.04,spd:13,cd:26,r:5,life:110,type:'pierce',name:'DMR'},ASSAULT:{dmg:9,bst:5,sprd:.12,spd:9,cd:16,r:4,life:70,type:'spread',name:'FUSIL-P'},FLANKER:{dmg:24,bst:2,sprd:.05,spd:12,cd:13,r:5,life:90,name:'SMG-LOURD'},SNIPER:{dmg:14,bst:4,sprd:.13,spd:9,cd:14,r:4,life:70,type:'spread',name:'SECONDAIRE'},SUPPORT:{dmg:18,bst:3,sprd:.10,spd:9.5,cd:15,r:4,life:80,name:'CARABINE'}};
  const NIN=16,NHID=10,WLEN=NIN*NHID+NHID*2;
  const MOBD={0:{r:10,hp:55,spd:1.5,dmg:5},1:{r:13,hp:120,spd:1.95,dmg:11},2:{r:24,hp:480,spd:1.3,dmg:26},3:{r:8,hp:35,spd:2.4,dmg:5},4:{r:18,hp:300,spd:1.05,dmg:22}};
  function randW(){const w=new Float32Array(WLEN);for(let i=0;i<WLEN;i++)w[i]=Math.random()*2-1;return w;}
  function crossW(a,b,m){m=m||.1;const c=new Float32Array(WLEN);const cut=(Math.random()*WLEN)|0;for(let i=0;i<WLEN;i++)c[i]=(i<cut?a[i]:b[i])+(Math.random()*2-1)*m;return c;}
  function recordGene(sp,brain,fit){const pool=S.genes&&S.genes[sp];if(!pool)return;pool.push({brain,fit});pool.sort((a,b)=>b.fit-a.fit);if(pool.length>12)pool.length=12;}
  function breed(sp){const pool=S.genes&&S.genes[sp];if(pool&&pool.length>=2&&Math.random()<0.7){const a=pool[(Math.random()*Math.min(5,pool.length))|0].brain,b=pool[(Math.random()*Math.min(5,pool.length))|0].brain;return crossW(a,b);}return randW();}
  function runBrain(inp,w){const h=new Float32Array(NHID);let k=0;for(let i=0;i<NHID;i++){let s=0;for(let j=0;j<NIN;j++)s+=inp[j]*w[k++];h[i]=Math.tanh(s);}let ox=0,oy=0;for(let i=0;i<NHID;i++){ox+=h[i]*w[k++];oy+=h[i]*w[k++];}return[Math.tanh(ox),Math.tanh(oy)];}

  const S={ TILE,TEAMCOL,state:'title',mission:1,runMissions:0,buffHp:0,objType:'elim',capture:0,
    MW:0,MH:0,arena:null,zone:null, units:[],mobs:[],proj:[],nades:[],loot:[], playerU:null,
    banner:'',bannerT:0, fx:[], nadeCD:0 };
  // [STA] tous les nombres réglables (le config panel écrira ici ; WPN/PLWPN/MOBD partagés par référence)
  S.wrapv=wrapv; S.tdel=tdel;
  S.cfg={ wpn:WPN, player:PLWPN, mob:MOBD,
    unitHp:200, enemyHpStep:6, allyBuff:20, playerSpeed:3.4, unitSpeed:2.7, aimbot:1,
    gren:{cd:200,r:100,dmg:80}, zone:{r:140,cap:.5}, spawn:{g:24,h:13,apexFrom:2}, shield:60, shRegen:1.2, shDelay:120 };
  S.pwi=0; S.playerWpns=[PLWPN,PLWPN2]; S.heat=0; S.wmTick=0; S.playerRole='LEADER';
  let advisor=null,intents=null,adviseTick=0,extractT=0;

  function buildArena(){
    let seed=S.mission*9301+49297; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;};
    const MW=S.MW,MH=S.MH,a=S.arena;
    for(let y=0;y<MH;y++)for(let x=0;x<MW;x++)a[y*MW+x]=(x===0||y===0||x>=MW-1||y>=MH-1)?1:0;
    const nW=(MW*MH*0.03)|0; for(let i=0;i<nW;i++){const x=2+((rnd()*(MW-4))|0),y=2+((rnd()*(MH-4))|0);a[y*MW+x]=1;if(rnd()<.5)a[y*MW+Math.min(MW-2,x+1)]=1;}
    for(let y=1;y<MH-1;y++)for(let x=1;x<MW-1;x++){if(a[y*MW+x]!==0)continue;if(a[y*MW+x+1]===1||a[y*MW+x-1]===1||a[(y+1)*MW+x]===1||a[(y-1)*MW+x]===1){if(rnd()<.45)a[y*MW+x]=2;}}
  }
  // ===== MONDE (substrat C : terrain/biome, découplé de la grille tactique) =====
  const TERR={FLOOR:0,GRASS:1,WATER:2,ROCK:3,BUSH:4,WALL:5};
  function buildWorld(){
    const MW=S.MW,MH=S.MH,tr=new Uint8Array(MW*MH),bt=new Uint8Array(MW*MH);
    let seed=S.mission*9301+49297; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;};
    const CELL=16, DOOR=5, gx=Math.max(2,Math.round(MW/CELL)), gy=Math.max(2,Math.round(MH/CELL)), cw=MW/gx, ch=MH/gy;
    // biome par cellule : 4 quadrants permutés (régions cohérentes) — 0 plaines,1 forêt,2 rocheux,3 marais
    const perm=[0,1,2,3]; for(let i=3;i>0;i--){const j=(rnd()*(i+1))|0;const t=perm[i];perm[i]=perm[j];perm[j]=t;}
    const cellBiome=[]; for(let cj=0;cj<gy;cj++)for(let ci=0;ci<gx;ci++){const q=(ci<gx/2?0:1)+(cj<gy/2?0:2);cellBiome[cj*gx+ci]=perm[q];}
    // terrain de base + map biome par tuile
    for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){const ci=Math.min(gx-1,(x/cw)|0),cj=Math.min(gy-1,(y/ch)|0),bb=cellBiome[cj*gx+ci];bt[y*MW+x]=bb;
      const r=rnd();let t=0;
      if(bb===0)t=r<.45?1:0; else if(bb===1)t=r<.55?1:0; else if(bb===2)t=r<.18?1:0; else t=r<.30?1:(r<.42?2:0);
      tr[y*MW+x]=t;}
    // murs salles-à-portes (densité selon biome) + >=2 sorties
    const setRock=(x,y)=>{if(x>=0&&y>=0&&x<MW&&y<MH)tr[y*MW+x]=3;};
    for(let cj=0;cj<gy;cj++)for(let ci=0;ci<gx;ci++){const bb=cellBiome[cj*gx+ci],wp=bb===2?.35:bb===3?.62:.45;
      const W={N:rnd()>wp,S:rnd()>wp,E:rnd()>wp,Wst:rnd()>wp};let op=[!W.N,!W.S,!W.E,!W.Wst].filter(v=>v).length;const dirs=['N','S','E','Wst'];while(op<2){const d=dirs[(rnd()*4)|0];if(W[d]){W[d]=false;op++;}}
      const x0=Math.round(ci*cw),x1=Math.round((ci+1)*cw)-1,y0=Math.round(cj*ch),y1=Math.round((cj+1)*ch)-1,dH=((x0+x1)/2)|0,dV=((y0+y1)/2)|0;
      if(W.N)for(let x=x0;x<=x1;x++)if(Math.abs(x-dH)>DOOR/2)setRock(x,y0);
      if(W.S)for(let x=x0;x<=x1;x++)if(Math.abs(x-dH)>DOOR/2)setRock(x,y1);
      if(W.Wst)for(let y=y0;y<=y1;y++)if(Math.abs(y-dV)>DOOR/2)setRock(x0,y);
      if(W.E)for(let y=y0;y<=y1;y++)if(Math.abs(y-dV)>DOOR/2)setRock(x1,y);
    }
    // mares d'eau (plus en marais) + buissons (plus en forêt)
    const nW=3+((rnd()*3)|0);for(let i=0;i<nW;i++){const cx=4+((rnd()*(MW-8))|0),cy=4+((rnd()*(MH-8))|0),sz=2+((rnd()*2)|0);for(let dy=-sz;dy<=sz;dy++)for(let dx=-sz;dx<=sz;dx++){const x=cx+dx,y=cy+dy;if(x>0&&y>0&&x<MW-1&&y<MH-1&&dx*dx+dy*dy<=sz*sz&&tr[y*MW+x]!==3)tr[y*MW+x]=2;}}
    for(let y=1;y<MH-1;y++)for(let x=1;x<MW-1;x++){const t=tr[y*MW+x],bb=bt[y*MW+x];if(t===0||t===1){const nr=(tr[y*MW+x+1]===3||tr[y*MW+x-1]===3||tr[(y+1)*MW+x]===3||tr[(y-1)*MW+x]===3);if(nr&&rnd()<(bb===1?.5:.25))tr[y*MW+x]=4;else if(bb===1&&rnd()<.08)tr[y*MW+x]=4;}}
    S.world={W:MW,H:MH,terrain:tr,biome:bt,ox:0,oy:0,TILE};
    const a=S.arena;for(let i=0;i<MW*MH;i++){const t=tr[i];a[i]=(t===3||t===5)?1:(t===4?2:0);}
  }
  function terrainAt(px,py){const tx=(px/TILE)|0,ty=(py/TILE)|0;if(tx<0||ty<0||tx>=S.MW||ty>=S.MH)return 5;return S.world?S.world.terrain[ty*S.MW+tx]:0;}
  function wallAt(px,py){const tx=(px/TILE)|0,ty=(py/TILE)|0;if(tx<0||ty<0||tx>=S.MW||ty>=S.MH)return true;return S.arena[ty*S.MW+tx]===1;}
  function snapFree(px,py){for(let r=0;r<12;r++)for(let aa=0;aa<8;aa++){const ang=aa/8*6.2832,x=px+Math.cos(ang)*r*TILE,y=py+Math.sin(ang)*r*TILE;if(!wallAt(x,y))return{x,y};}return{x:px,y:py};}
  function clearArea(cx,cy,rad){const MW=S.MW,MH=S.MH;for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++){const x=cx+dx,y=cy+dy;if(x<0||y<0||x>=MW||y>=MH||dx*dx+dy*dy>rad*rad)continue;const i=y*MW+x,t=S.world.terrain[i];if(t===3||t===4||t===5)S.world.terrain[i]=1;const t2=S.world.terrain[i];S.arena[i]=(t2===3||t2===5)?1:(t2===4?2:0);}}
  function unstick(e){if(wallAt(e.x,e.y)){const p=snapFree(e.x,e.y);e.x=p.x;e.y=p.y;}}
  function _mk(sp,p){const d=MOBD[sp];S.mobs.push({sp,x:p.x,y:p.y,r:d.r,hp:d.hp,maxHp:d.hp,brain:breed(sp),spd:d.spd,dmg:d.dmg,dmgCD:0,_t:null,fit:0});}
  const PREF={0:[0,3],1:[1],2:[2],3:[3,1],4:[2]};
  function spawnMob(sp){let best=null;const pf=PREF[sp]||[];for(let t=0;t<6;t++){const p=snapFree((2+Math.random()*(S.MW-4))*TILE,(2+Math.random()*(S.MH-4))*TILE);if(!best)best=p;const bb=S.world?S.world.biome[((p.y/TILE)|0)*S.MW+((p.x/TILE)|0)]:0;if(pf.indexOf(bb)>=0){best=p;break;}}_mk(sp,best);}
  function spawnMobFar(sp){const pu=S.playerU;let best=null,bd=-1;for(let t=0;t<8;t++){const p=snapFree((2+Math.random()*(S.MW-4))*TILE,(2+Math.random()*(S.MH-4))*TILE);const dd=pu?Math.hypot(tdel(pu.x,p.x,S.MW*TILE),tdel(pu.y,p.y,S.MH*TILE)):0;if(dd>bd){bd=dd;best=p;}}_mk(sp,best);}
  function inSmoke(x,y){const WWp=S.MW*TILE,WHp=S.MH*TILE;for(const sm of S.smokes){if(Math.hypot(tdel(x,sm.x,WWp),tdel(y,sm.y,WHp))<sm.r)return true;}return false;}
  function hurt(u,dmg){ if(u.down)return; if(terrainAt(u.x,u.y)===4)dmg*=0.6; if(u.sh>0){const ab=Math.min(u.sh,dmg);u.sh-=ab;dmg-=ab;} if(dmg>0)u.hp-=dmg; u.shCD=S.cfg.shDelay; if(u.hp<=0){u.down=true;u.hp=0;u.sh=0;u.downT=420;} }
  function resetSquad(team){ const pu=S.playerU,Wp=S.MW*TILE; const exA=Math.round(S.MW*0.12)*TILE,exB=Math.round(S.MW*0.88)*TILE;
    // l'\u00e9quipe perdante red\u00e9ploie \u00e0 son extr\u00e9mit\u00e9 ; team0 \u00e0 gauche, team1 \u00e0 l'oppos\u00e9 du joueur
    const ex=(team===0)?exA:((pu&&Math.abs(tdel(pu.x,exA,Wp))>Math.abs(tdel(pu.x,exB,Wp)))?exA:exB);
    const lst=S.units.filter(u=>u.team===team),N=Math.max(1,lst.length);
    lst.forEach((u,i)=>{ const ty=Math.round(((i+0.5)/N)*(S.MH-2))+1; const sp=snapFree(ex,ty*TILE);
      const hp=(team===1?S.cfg.unitHp+S.mission*S.cfg.enemyHpStep:S.cfg.unitHp+S.buffHp);
      u.x=sp.x;u.y=sp.y;u.hp=hp;u.maxHp=hp;u.sh=S.cfg.shield;u.shMax=S.cfg.shield;u.shCD=0;u.fireCD=0;u.down=false;u.downT=0;u.medCD=0;u.smCD=0; }); }
  function spawnEnemySquad(){ resetSquad(1); }
  function worldMind(){ S.heat=Math.max(0,S.heat-0.05);
    const fauna=S.mobs.filter(o=>o.hp>0).length, target=(34+Math.min(S.mission*2,26))+Math.round(S.heat*22);
    if(fauna<target){ const n=Math.min(3,target-fauna); for(let i=0;i<n;i++){ const r=Math.random(); let sp; if(S.heat>0.6)sp=r<.4?3:r<.7?1:r<.9?4:2; else sp=r<.5?0:r<.8?3:1; spawnMobFar(sp); } }
  }
  function fire(u,ang,wp){const w=wp||WPN[u.rn]||WPN.ASSAULT;const pr=w.type==='pierce'?3:0;for(let b=0;b<w.bst;b++){let a;if(w.type==='spread')a=ang+(b-(w.bst-1)/2)*0.13+(Math.random()-.5)*w.sprd;else a=ang+(Math.random()-.5)*w.sprd;S.proj.push({x:u.x+Math.cos(a)*u.r,y:u.y+Math.sin(a)*u.r,vx:Math.cos(a)*w.spd,vy:Math.sin(a)*w.spd,r:w.r,dmg:w.dmg,team:u.team,life:w.life,pierce:pr});}u.fireCD=w.cd;S.fx.push({t:'muzzle',x:u.x+Math.cos(ang)*u.r,y:u.y+Math.sin(ang)*u.r,a:ang});}

  S.deploy=function(){
    if(S.state==='runover'){S.mission=1;S.buffHp=0;S.runMissions=0;S.wins=0;S.losses=0;}
    advisor=VIV_TAC.createAdvisor();S.MW=advisor.MW;S.MH=advisor.MH;S.arena=new Uint8Array(S.MW*S.MH);buildWorld();
    S.units=[];S.mobs=[];S.proj=[];S.nades=[];S.loot=[];S.smokes=[];S.nadeCD=0;S.capture=0;intents=null;S.heat=0;S.wmTick=0;S.genes={0:[],1:[],2:[],3:[],4:[]};
    S.t=0;S.reinforceCD=0;S.allyCD=0;S.losses=S.losses||0;S.wins=S.wins||0;
    const _tc={0:0,1:0};const _per={0:advisor.roster.filter(r=>r.team===0).length,1:advisor.roster.filter(r=>r.team===1).length};advisor.roster.forEach((rr)=>{const left=rr.team===0;const i5=_tc[rr.team]++,N=Math.max(1,_per[rr.team]);const tx=Math.round(S.MW*(left?0.12:0.88)),ty=Math.round(((i5+0.5)/N)*(S.MH-2))+1;const sp=snapFree(tx*TILE,ty*TILE);const hp=(rr.team===1?S.cfg.unitHp+S.mission*S.cfg.enemyHpStep:S.cfg.unitHp+S.buffHp);S.units.push({team:rr.team,rn:rr.rn,x:sp.x,y:sp.y,hp,maxHp:hp,r:13,aim:0,fireCD:0,sh:S.cfg.shield,shMax:S.cfg.shield,shCD:0,down:false,downT:0,medCD:0,smCD:0});});
    S.units.forEach(u=>clearArea(Math.round(u.x/TILE),Math.round(u.y/TILE),3));
    S.playerU=S.units.find(u=>u.team===0&&u.rn===S.playerRole)||S.units.find(u=>u.team===0); if(S.playerU){S.playerU.isPlayer=true; S.playerWpns=[S.cfg.wpn[S.playerU.rn]||PLWPN, SEC[S.playerU.rn]||PLWPN2]; S.pwi=0;}
    const g=S.cfg.spawn.g+S.mission,h=S.cfg.spawn.h+((S.mission/2)|0),sw=14+S.mission*2;for(let i=0;i<g;i++)spawnMob(0);for(let i=0;i<h;i++)spawnMob(1);for(let i=0;i<sw;i++)spawnMob(3);if(S.mission>=S.cfg.spawn.apexFrom)spawnMob(2);if(S.mission>=3)spawnMob(4);
    S.state='fight';S.banner='SURVIE — NIVEAU '+S.mission;S.bannerT=160;
  };
  function throwNade(){if(S.nadeCD>0||!S.playerU)return;const pu=S.playerU;let tx=pu.x+Math.cos(pu.aim)*180,ty=pu.y+Math.sin(pu.aim)*180,bd=1e9;for(const u of S.units){if(u.hp>0&&u.team===1){const d=Math.hypot(u.x-pu.x,u.y-pu.y);if(d<bd){bd=d;tx=u.x;ty=u.y;}}}for(const o of S.mobs){if(o.hp>0){const d=Math.hypot(o.x-pu.x,o.y-pu.y);if(d<bd){bd=d;tx=o.x;ty=o.y;}}}const dist=Math.hypot(tdel(pu.x,tx,S.MW*TILE),tdel(pu.y,ty,S.MH*TILE));S.nades.push({sx:pu.x,sy:pu.y,x:pu.x,y:pu.y,tx,ty,t:0,fuse:Math.max(34,Math.min(64,dist/6))|0,flash:0,team:0,z:0,peak:Math.min(60,16+dist/5)});S.nadeCD=S.cfg.gren.cd;}

  function nearest(mx,my,pred,maxd){let best=null,bd=maxd||1e9;const pu=S.playerU,WWp=S.MW*TILE,WHp=S.MH*TILE;
    const cons=(ax,ay,kind,ref)=>{const dx=tdel(mx,ax,WWp),dy=tdel(my,ay,WHp),d=Math.hypot(dx,dy);if(d<bd){bd=d;best={x:mx+dx,y:my+dy,kind,ref};}};
    if(pred('unit')&&pu&&pu.hp>0)cons(pu.x,pu.y,'unit',pu);
    for(const u of S.units){if(u.hp<=0||u===pu||!pred('unit'))continue;cons(u.x,u.y,'unit',u);}
    gridNear(mx,my,bd,(o)=>{if(o.hp<=0||!pred('mob',o.sp))return;const dx=tdel(mx,o.x,WWp),dy=tdel(my,o.y,WHp),d=Math.hypot(dx,dy);if(d>0.5&&d<bd){bd=d;best={x:mx+dx,y:my+dy,kind:'mob',ref:o};}});
    return best?{tgt:best,d:bd}:null;}
  function buildGrid(){const CS=130,g=Object.create(null),mb=S.mobs,gw=Math.ceil(S.MW*TILE/CS),gh=Math.ceil(S.MH*TILE/CS);for(let i=0;i<mb.length;i++){const o=mb[i];if(o.hp<=0)continue;const cx=((o.x/CS)|0)%gw,cy=((o.y/CS)|0)%gh,k=cx*100003+cy;(g[k]||(g[k]=[])).push(o);}S._grid={g,CS,gw,gh,maxSp:((Math.min(gw,gh)-1)/2)|0};}
  function gridNear(mx,my,r,cb){const G=S._grid;if(!G){const mb=S.mobs;for(let i=0;i<mb.length;i++)cb(mb[i]);return;}const CS=G.CS,g=G.g,gw=G.gw,gh=G.gh,cx=(mx/CS)|0,cy=(my/CS)|0,sp=Math.min(G.maxSp,Math.ceil(r/CS)+1);for(let dy=-sp;dy<=sp;dy++)for(let dx=-sp;dx<=sp;dx++){const wcx=((cx+dx)%gw+gw)%gw,wcy=((cy+dy)%gh+gh)%gh,a=g[wcx*100003+wcy];if(a)for(let i=0;i<a.length;i++)cb(a[i]);}}

  function updatePlayer(inp){const pu=S.playerU;if(!pu||pu.hp<=0)return; unstick(pu);
    const mx=inp.move?inp.move.x:0,my=inp.move?inp.move.y:0,m=Math.hypot(mx,my);
    if(m>0){const spd=S.cfg.playerSpeed*(terrainAt(pu.x,pu.y)===2?.5:1),WWp=S.MW*TILE,WHp=S.MH*TILE,nx=wrapv(pu.x+(mx/m)*spd,WWp),ny=wrapv(pu.y+(my/m)*spd,WHp);if(!wallAt(nx,pu.y))pu.x=nx;if(!wallAt(pu.x,ny))pu.y=ny;}
    const AB=(S.cfg.aimbot==null?1:S.cfg.aimbot),WWp=S.MW*TILE,WHp=S.MH*TILE; let autoFire=false;
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
    if((inp.fire||autoFire)&&pu.fireCD<=0)fire(pu,pu.aim,S.playerWpns[S.pwi]);
    if(pu.smCD>0)pu.smCD--;
    if(inp.ability&&pu.smCD<=0&&(pu.rn==='FLANKER'||pu.rn==='ASSAULT')){S.smokes.push({x:pu.x,y:pu.y,r:95,life:300});pu.smCD=360;}
    if(pu.rn==='SUPPORT'){const WWp=S.MW*TILE,WHp=S.MH*TILE; if(pu.medCD>0)pu.medCD--; let did=false;
      for(const al of S.units){if(al.team===pu.team&&al.down&&Math.hypot(tdel(pu.x,al.x,WWp),tdel(pu.y,al.y,WHp))<110){if(pu.medCD<=0){al.down=false;al.hp=Math.round(al.maxHp*.4);al.sh=0;al.downT=0;pu.medCD=240;S.fx.push({t:'pickup',x:al.x,y:al.y});}did=true;break;}}
      if(!did){let w=null,wd=130;for(const al of S.units){if(al===pu||al.team!==pu.team||al.hp<=0||al.down)continue;if(al.hp<al.maxHp){const d=Math.hypot(tdel(pu.x,al.x,WWp),tdel(pu.y,al.y,WHp));if(d<wd){wd=d;w=al;}}}if(w)w.hp=Math.min(w.maxHp,w.hp+0.5);}
    }
  }
  function stepAdvisor(){adviseTick++;
    if(!intents||(adviseTick%(S.cfg.adviseEvery||2)===0)){const us=S.units.map(u=>({team:u.team,x:u.x/TILE,y:u.y/TILE,hp:u.hp>0?u.hp:0}));const mb=[];for(const o of S.mobs){if(o.hp>0)mb.push({x:o.x/TILE,y:o.y/TILE,r:o.r/TILE,dmg:o.dmg,sp:o.sp});}try{intents=advisor.advise(S.arena,us,mb);}catch(e){}}
    const its=intents||[];
    for(let k=0;k<S.units.length;k++){const u=S.units[k],it=its[k];if(!u||u.hp<=0||u===S.playerU)continue; unstick(u);
      if(u.fireCD>0)u.fireCD--;
      if(it){const spd=S.cfg.unitSpeed*(terrainAt(u.x,u.y)===2?.5:1),WWp=S.MW*TILE,WHp=S.MH*TILE;const px=u.x,py=u.y;const nx=wrapv(u.x+it.dx*spd,WWp),ny=wrapv(u.y+it.dy*spd,WHp);if(!wallAt(nx,u.y))u.x=nx;if(!wallAt(u.x,ny))u.y=ny;
      if(u.x===px&&u.y===py&&(Math.abs(it.dx)+Math.abs(it.dy)>0.05)){u._sl=u._sl||1;const sx=wrapv(u.x-it.dy*u._sl*spd,WWp),sy=wrapv(u.y+it.dx*u._sl*spd,WHp);if(!wallAt(sx,u.y))u.x=sx;if(!wallAt(u.x,sy))u.y=sy;if(u.x===px&&u.y===py)u._sl=-u._sl;}
      u.aim=it.aim;if(it.fire&&u.fireCD<=0)fire(u,it.aim);}
      const WWa=S.MW*TILE,WHa=S.MH*TILE; let dgm=null,dgd=85; for(const o of S.mobs){if(o.hp>0&&(o.sp===2||o.sp===4)){const d=Math.hypot(tdel(u.x,o.x,WWa),tdel(u.y,o.y,WHa));if(d<dgd){dgd=d;dgm=o;}}}
      if(dgm){const ang=Math.atan2(tdel(dgm.y,u.y,WHa),tdel(dgm.x,u.x,WWa)),spd=S.cfg.unitSpeed,nx=wrapv(u.x+Math.cos(ang)*spd,WWa),ny=wrapv(u.y+Math.sin(ang)*spd,WHa);if(!wallAt(nx,u.y))u.x=nx;if(!wallAt(u.x,ny))u.y=ny;}
      if(u.fireCD<=0&&(!it||!it.fire)){let mb=null,md=300;for(const o of S.mobs){if(o.hp<=0)continue;const d=Math.hypot(tdel(u.x,o.x,WWa),tdel(u.y,o.y,WHa));if(d<md){md=d;mb=o;}}if(mb){u.aim=Math.atan2(tdel(u.y,mb.y,WHa),tdel(u.x,mb.x,WWa));fire(u,u.aim);}}
      if((u.rn==='FLANKER'||u.rn==='ASSAULT')){const WWp=S.MW*TILE,WHp=S.MH*TILE; if(u.smCD>0)u.smCD--; else { let nr=false; for(const e of S.units){if(e.hp>0&&e.team!==u.team&&Math.hypot(tdel(u.x,e.x,WWp),tdel(u.y,e.y,WHp))<320){nr=true;break;}} if(nr){S.smokes.push({x:u.x,y:u.y,r:95,life:300});u.smCD=540;} } }
      if(u.rn==='LEADER'){ if(u.nadeCD>0)u.nadeCD--; else { let bx=0,by=0,bd=240,fd=false; for(const e of S.units){if(e.hp>0&&e.team!==u.team){const d=Math.hypot(e.x-u.x,e.y-u.y);if(d<bd){bd=d;bx=e.x;by=e.y;fd=true;}}} for(const o of S.mobs){if(o.hp>0){const d=Math.hypot(o.x-u.x,o.y-u.y);if(d<bd){bd=d;bx=o.x;by=o.y;fd=true;}}} if(fd){const dst=Math.hypot(tdel(u.x,bx,S.MW*TILE),tdel(u.y,by,S.MH*TILE));S.nades.push({sx:u.x,sy:u.y,x:u.x,y:u.y,tx:bx,ty:by,t:0,fuse:Math.max(34,Math.min(64,dst/6))|0,flash:0,team:u.team,z:0,peak:Math.min(60,16+dst/5)});u.nadeCD=300;} } }
      if(u.rn==='SUPPORT'){const WWp=S.MW*TILE,WHp=S.MH*TILE; if(u.medCD>0)u.medCD--;
        let dn=null,dd=420; const pu=S.playerU; if(pu&&pu.team===u.team&&pu.down){dn=pu;dd=Math.hypot(tdel(u.x,pu.x,WWp),tdel(u.y,pu.y,WHp));} else { for(const al of S.units){if(al.team===u.team&&al.down){const d=Math.hypot(tdel(u.x,al.x,WWp),tdel(u.y,al.y,WHp));if(d<dd){dd=d;dn=al;}}} }
        if(dn){ if(dd<110){ if(u.medCD<=0){dn.down=false;dn.hp=Math.round(dn.maxHp*0.4);dn.sh=0;dn.downT=0;u.medCD=240;S.fx.push({t:'pickup',x:dn.x,y:dn.y});} }
          else { const ang=Math.atan2(tdel(u.y,dn.y,WHp),tdel(u.x,dn.x,WWp)),spd=S.cfg.unitSpeed,nx=wrapv(u.x+Math.cos(ang)*spd,WWp),ny=wrapv(u.y+Math.sin(ang)*spd,WHp);if(!wallAt(nx,u.y))u.x=nx;if(!wallAt(u.x,ny))u.y=ny;u.aim=ang; } }
        else{let w=null,wd=130;for(const al of S.units){if(al===u||al.team!==u.team||al.hp<=0||al.down)continue;if(al.hp<al.maxHp){const d=Math.hypot(tdel(u.x,al.x,WWp),tdel(u.y,al.y,WHp));if(d<wd){wd=d;w=al;}}}if(w)w.hp=Math.min(w.maxHp,w.hp+0.5);}
      }
    }
  }
  function updateMobs(){
    for(let i=S.mobs.length-1;i>=0;i--){const m=S.mobs[i];if(m.hp<=0){recordGene(m.sp,m.brain,m.fit||0);S.heat=Math.min(1,S.heat+0.005);S.fx.push({t:'die',x:m.x,y:m.y,col:m.sp===2?'#b3f':m.sp===4?'#a5a':m.sp===3?'#e0a040':'#9d6'});if(m.sp===2||m.sp===4)S.loot.push({x:m.x,y:m.y,type:'core',life:900});else if(Math.random()<.4)S.loot.push({x:m.x,y:m.y,type:'hp',life:600});S.mobs.splice(i,1);continue;}if(m.dmgCD>0)m.dmgCD--; m.fit=(m.fit||0)+0.002; unstick(m);
      let gx=0,gy=0,has=false,fleeing=false;m._t=null;
      if(m.sp===0){const th=nearest(m.x,m.y,(k,sp)=>k==='unit'||(k==='mob'&&sp>=1),170);if(th){gx=-(th.tgt.x-m.x);gy=-(th.tgt.y-m.y);has=true;fleeing=true;}}
      else if(m.sp===1||m.sp===3){const prey=nearest(m.x,m.y,(k,sp)=>k==='mob'&&sp===0,320),intr=nearest(m.x,m.y,(k)=>k==='unit',360);let t=prey;if(intr&&(!prey||intr.d<prey.d))t=intr;if(m.hp<m.maxHp*.25){const dg=nearest(m.x,m.y,(k,sp)=>k==='unit'||(k==='mob'&&sp===2),200);if(dg){gx=-(dg.tgt.x-m.x);gy=-(dg.tgt.y-m.y);fleeing=true;has=true;}}else if(t){gx=t.tgt.x-m.x;gy=t.tgt.y-m.y;has=true;m._t=t.tgt;}}
      else {const t=nearest(m.x,m.y,(k,sp)=>k==='unit'||(k==='mob'&&sp!==2&&sp!==4),520);if(t){gx=t.tgt.x-m.x;gy=t.tgt.y-m.y;has=true;m._t=t.tgt;}}
      const inp=new Float32Array(16);if(has){const d=Math.hypot(gx,gy)||1;inp[0]=gx/d;inp[1]=gy/d;inp[2]=m.hp/m.maxHp;inp[3]=fleeing?1:0;inp[4]=Math.sin(S.t*.001+i);}
      const out=runBrain(inp,m.brain);let mvx=out[0]*.6,mvy=out[1]*.6;if(has){const d=Math.hypot(gx,gy)||1;mvx+=(gx/d)*.7;mvy+=(gy/d)*.7;}
      if(m.sp===1||m.sp===3){const cf=m.sp===3?.006:.002;let cx=0,cy=0,n=0;gridNear(m.x,m.y,160,(o)=>{if(o!==m&&o.sp===m.sp&&o.hp>0){const dd=Math.hypot(o.x-m.x,o.y-m.y);if(dd<160){cx+=o.x;cy+=o.y;n++;}}});if(n){cx/=n;cy/=n;mvx+=(cx-m.x)*cf;mvy+=(cy-m.y)*cf;}}
      const mag=Math.hypot(mvx,mvy)||1;mvx/=mag;mvy/=mag;const espd=((m.sp===2&&m.hp<m.maxHp*.3)?m.spd*1.4:m.spd)*(terrainAt(m.x,m.y)===2?.5:1);const WWp=S.MW*TILE,WHp=S.MH*TILE,nx=wrapv(m.x+mvx*espd,WWp),ny=wrapv(m.y+mvy*espd,WHp);if(!wallAt(nx,m.y))m.x=nx;if(!wallAt(m.x,ny))m.y=ny;
      if(m.sp!==0&&!fleeing&&m.dmgCD<=0&&m._t){if(Math.hypot(m._t.x-m.x,m._t.y-m.y)<m.r+16){m.dmgCD=30;m.fit=(m.fit||0)+m.dmg*0.3;if(m._t.ref){const wasUp=!m._t.ref.down;hurt(m._t.ref,m.dmg);if(wasUp&&m._t.ref.down)m.fit+=18;}}}
    }
    const gz=S.mobs.filter(o=>o.sp===0&&o.hp>0).length;if(gz<3&&Math.random()<.03)spawnMob(0);
  }
  function updateProj(){for(let i=S.proj.length-1;i>=0;i--){const p=S.proj[i];p.x+=p.vx;p.y+=p.vy;p.life--;if(p.life<=0||wallAt(p.x,p.y)){S.proj.splice(i,1);continue;} p.t=(p.t||0)+1; if(p.t>2&&terrainAt(p.x,p.y)===4&&Math.random()<0.3){S.fx.push({t:'hit',x:p.x,y:p.y});S.proj.splice(i,1);continue;}let hit=false;for(const u of S.units){if(u.hp<=0||u.team===p.team)continue;if(Math.hypot(p.x-u.x,p.y-u.y)<p.r+u.r){if(!(inSmoke(u.x,u.y)&&Math.random()<0.5))hurt(u,p.dmg);hit=true;break;}}if(!hit){let _H=null;gridNear(p.x,p.y,p.r+26,(o)=>{if(!_H&&o.hp>0&&Math.hypot(p.x-o.x,p.y-o.y)<p.r+o.r)_H=o;});if(_H){_H.hp-=p.dmg;hit=true;}}if(hit){S.fx.push({t:'hit',x:p.x,y:p.y}); if(p.pierce>0){p.pierce--;p.dmg*=.85;}else S.proj.splice(i,1);}}}
  function updateNades(){if(S.nadeCD>0)S.nadeCD--;for(let i=S.nades.length-1;i>=0;i--){const g=S.nades[i];if(g.flash>0){g.flash--;if(g.flash<=0)S.nades.splice(i,1);continue;}g.t++;const kk=Math.min(1,g.t/g.fuse);g.x=g.sx+(g.tx-g.sx)*kk;g.y=g.sy+(g.ty-g.sy)*kk;g.z=Math.sin(kk*3.14159)*g.peak;if(g.t>=g.fuse){g.flash=10;g.z=0;S.fx.push({t:'boom',x:g.tx,y:g.ty});for(const u of S.units){if(u.hp>0&&u.team!==g.team&&Math.hypot(u.x-g.tx,u.y-g.ty)<S.cfg.gren.r)hurt(u,S.cfg.gren.dmg);}for(const o of S.mobs){if(o.hp>0&&Math.hypot(o.x-g.tx,o.y-g.ty)<S.cfg.gren.r)o.hp-=S.cfg.gren.dmg;}}}}
  function updateLoot(){for(let i=S.loot.length-1;i>=0;i--){const L=S.loot[i];L.life--;if(L.life<=0){S.loot.splice(i,1);continue;}const pu=S.playerU;if(pu&&pu.hp>0&&Math.hypot(L.x-pu.x,L.y-pu.y)<26){if(L.type==='core'){pu.maxHp+=20;pu.hp=Math.min(pu.maxHp,pu.hp+20);}else{pu.hp=Math.min(pu.maxHp,pu.hp+35);}S.fx.push({t:'pickup',x:L.x,y:L.y,core:L.type==='core'});S.loot.splice(i,1);}}}
  function checkWin(){
    S.t=(S.t||0)+1;
    if(S.t%3600===0){ S.mission++; S.buffHp+=S.cfg.allyBuff; S.banner='⚠️ MENACE NIVEAU '+S.mission; S.bannerT=170; }   // escalade dans la durée
    const a0=S.units.some(u=>u.team===0&&(u.hp>0||u.down)), a1=S.units.some(u=>u.team===1&&(u.hp>0||u.down));
    // ENNEMI an\u00e9anti -> il (perdant) red\u00e9ploie, ton escouade (gagnante) garde ses PV
    if(!a1 && a0 && S.reinforceCD<=0){ S.reinforceCD=180; S.wins=(S.wins||0)+1; S.banner='✅ MANCHE GAGNÉE — '+S.wins; S.bannerT=130; }
    if(S.reinforceCD>0){ S.reinforceCD--; if(S.reinforceCD===0){ resetSquad(0);resetSquad(1); S.banner='⚠️ NOUVELLE ESCOUADE ENNEMIE'; S.bannerT=140; } }
    // TON escouade an\u00e9antie -> TOI (perdant) red\u00e9ploies, l'ennemi (gagnant) garde son \u00e9tat. pas de game over.
    if(!a0 && (S.allyCD||0)<=0){ S.allyCD=180; S.losses=(S.losses||0)+1; S.banner='💀 MANCHE PERDUE — '+S.losses; S.bannerT=130; }
    if((S.allyCD||0)>0){ S.allyCD--; if(S.allyCD===0){ resetSquad(0);resetSquad(1); S.banner='🔄 ESCOUADE REDÉPLOYÉE'; S.bannerT=140; } }
  }
  S.update=function(inp){ inp=inp||{}; S.fx.length=0;
    if(inp.deploy&&(S.state==='title'||S.state==='runover')){S.deploy();return;}
    if(S.bannerT>0&&S.bannerT<99999)S.bannerT--;
    if(S.state!=='fight')return;
    if(inp.grenade)throwNade(); if(inp.switchWeapon)S.pwi=(S.pwi+1)%S.playerWpns.length;
    buildGrid();updatePlayer(inp);stepAdvisor();updateMobs();updateProj();updateNades();updateLoot();for(const u of S.units){if(u.down){if(--u.downT<=0){u.down=false;u.hp=0;}}else if(u.hp>0){if(u.shCD>0)u.shCD--;else if(u.sh<u.shMax)u.sh=Math.min(u.shMax,u.sh+S.cfg.shRegen);}}for(let i=S.smokes.length-1;i>=0;i--){if(--S.smokes[i].life<=0)S.smokes.splice(i,1);}S.wmTick++;if(S.wmTick%90===0)worldMind();checkWin();
  };
  return S;
}
if(typeof module!=='undefined'&&module.exports)module.exports={createVivSim};
if(typeof window!=='undefined')window.createVivSim=createVivSim;
