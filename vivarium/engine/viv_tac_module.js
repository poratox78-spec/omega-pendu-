globalThis.VIV_TAC=(function(){
const ctx2d=new Proxy({},{get(t,p){if(p==='canvas')return{width:960,height:600};if(p==='measureText')return()=>({width:8});if(p==='createImageData'||p==='getImageData')return(w=1,h=1)=>({data:new Uint8ClampedArray((w*h||1)*4),width:w,height:h});if(p==='createRadialGradient'||p==='createLinearGradient'||p==='createPattern')return()=>({addColorStop(){}});return()=>{};},set(){return true;}});
function _mkCanvas(){return{width:960,height:600,clientWidth:960,clientHeight:600,style:{},getContext:()=>ctx2d,getBoundingClientRect:()=>({width:960,height:600,left:0,top:0,right:960,bottom:600}),addEventListener(){},removeEventListener(){},classList:{add(){},remove(){},toggle(){},contains:()=>false},toDataURL:()=>''};}
function _mkEl(){return new Proxy({style:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},dataset:{},value:'',textContent:'',innerHTML:'',checked:false,width:960,height:600,clientWidth:960,clientHeight:600,getContext:()=>ctx2d,getBoundingClientRect:()=>({width:960,height:600,left:0,top:0}),addEventListener(){},removeEventListener(){},appendChild(){},removeChild(){},remove(){},setAttribute(){},getAttribute:()=>null,querySelector:()=>_mkEl(),querySelectorAll:()=>[],click(){},focus(){},getElementsByTagName:()=>[]},{get(t,p){return p in t?t[p]:undefined;},set(t,p,v){t[p]=v;return true;}});}
const document={getElementById:id=>/cv|mm|canvas|chart|kill/i.test(id)?_mkCanvas():_mkEl(),createElement:t=>t==='canvas'?_mkCanvas():_mkEl(),querySelector:()=>_mkEl(),querySelectorAll:()=>[],addEventListener(){},removeEventListener(){},body:_mkEl(),documentElement:_mkEl(),createElementNS:()=>_mkEl(),getElementsByTagName:()=>[]};
const window={addEventListener(){},removeEventListener(){},innerWidth:960,innerHeight:600,devicePixelRatio:1,requestAnimationFrame:()=>0,cancelAnimationFrame(){},getComputedStyle:()=>({getPropertyValue:()=>''}),matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),location:{href:''},navigator:{vibrate(){}}};
const localStorage={_d:{},getItem(k){return this._d[k]??null;},setItem(k,v){this._d[k]=''+v;},removeItem(k){delete this._d[k];}};
const requestAnimationFrame=()=>0,cancelAnimationFrame=()=>{},performance={now:()=>Date.now()},devicePixelRatio=1,innerWidth=960,innerHeight=600,navigator={vibrate(){},userAgent:'x'};
const AudioContext=class{constructor(){this.destination={};this.currentTime=0;this.sampleRate=44100;}createOscillator(){return new Proxy({},{get:()=>()=>({})});}createGain(){return{gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}createBuffer(){return{getChannelData:()=>new Float32Array(1)};}createBufferSource(){return{buffer:null,connect(){},start(){},stop(){}};}createBiquadFilter(){return{type:'',frequency:{value:0,setValueAtTime(){}},connect(){}};}};
const setInterval=()=>0,setTimeout=()=>0,clearInterval=()=>{},clearTimeout=()=>{};
const webkitAudioContext=AudioContext,alert=()=>{},confirm=()=>true,matchMedia=()=>({matches:false,addEventListener(){},addListener(){}}),getComputedStyle=()=>({getPropertyValue:()=>''});


'use strict'

// [PATCH 5] Flag de debug : passer à true pour rethrow les exceptions de update()
// au lieu de les avaler silencieusement. Permet de voir la stack trace dans la console.
// Accessible aussi dynamiquement via : window.DEBUG_NO_CATCH = true
window.DEBUG_NO_CATCH = false

// ── UTILITAIRES ──────────────────────────────────────────
function safe(v,d=0){return Number.isFinite(v)?v:d}
function fixCanvas(cv){if(!cv)return;const r=cv.getBoundingClientRect();const w=Math.round(r.width)||cv.clientWidth||800;const h=Math.round(r.height)||cv.clientHeight||500;if(cv.width!==w)cv.width=w;if(cv.height!==h)cv.height=h}
const SOUND_EVENTS=[]
function _addSoundEvent(x,y,team,strength,frame){SOUND_EVENTS.push({x,y,team,strength,frame});if(SOUND_EVENTS.length>80)SOUND_EVENTS.shift()}
function getSoundTarget(a){let best=null,bScore=0;for(const s of SOUND_EVENTS){if(s.team===a.team)continue;const score=s.strength/(Math.hypot(s.x-a.x,s.y-a.y)+1);if(score>bScore){bScore=score;best=s}};return bScore>0.4?best:null}
// ─────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════
// PRNG
// ══════════════════════════════════════════════════════════
function mulberry32(a){
  return function(){
    a|=0;a=a+0x6D2B79F5|0
    let t=Math.imul(a^a>>>15,1|a)
    t=t+Math.imul(t^t>>>7,61|t)^t
    return((t^t>>>14)>>>0)/4294967296
  }
}

// ══════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════
const PRESETS={
  blitz:{agentsPerTeam:4,simSpeed:2,dayLen:1200,nightLen:400,jamFreq:1000,timeLimit:10800,asymmetric:false},
  standard:{agentsPerTeam:5,simSpeed:1,dayLen:2400,nightLen:1200,jamFreq:2000,timeLimit:0,asymmetric:false},
  simulation:{agentsPerTeam:5,simSpeed:1,dayLen:5400,nightLen:2700,jamFreq:4000,timeLimit:0,asymmetric:false},
  night:{agentsPerTeam:5,simSpeed:1,dayLen:9999,nightLen:100,jamFreq:2000,timeLimit:0,asymmetric:false},  // désactivé
  guerrilla:{agentsPerTeam:5,simSpeed:1,dayLen:2400,nightLen:1200,jamFreq:1500,timeLimit:0,asymmetric:true},
}

const CFG={
  mapSize:'medium',mode:'elim',agentsPerTeam:5,simSpeed:1,
  zoneWinScore:2000,timeLimit:0,
  coverBlock:52,dangerDecay:97,
  grenades:true,tracer:true,moral:true,phero:true,cmd:true,coverArc180:true,
  dayNight:false,dayLen:2400,nightLen:1200,
  jam:true,jamFreq:2000,jamDur:250,
  asymmetric:false,  // team A = standard, team B = guerrilla composition
  roles:{
    LEADER  :{hp:100,spdM:100,dmgM:100,magM:100,rngM:100},
    ASSAULT :{hp:100,spdM:100,dmgM:100,magM:100,rngM:100},
    FLANKER :{hp:100,spdM:100,dmgM:100,magM:100,rngM:100},
    SNIPER  :{hp:100,spdM:100,dmgM:100,magM:100,rngM:100},
    SUPPORT :{hp:100,spdM:100,dmgM:100,magM:100,rngM:100},
  }
}

// GUERRILLA COMPOSITION for team B in asymmetric mode
// More flankers, sniper, no leader — hit-and-run optimized
const GUERRILLA_COMP=['FLANKER','FLANKER','SNIPER','FLANKER','SUPPORT']

// ══════════════════════════════════════════════════════════
// MAP SIZES
// ══════════════════════════════════════════════════════════
const MAP_SIZES={small:{w:32,h:20},medium:{w:48,h:30},large:{w:64,h:40},huge:{w:208,h:130}}
const TILE=16

// ══════════════════════════════════════════════════════════
// ROLES — base stats
// ══════════════════════════════════════════════════════════
const HP_BASE={LEADER:120,ASSAULT:100,FLANKER:90,SNIPER:78,SUPPORT:115,DRONE:18}
// VIVARIUM SCALE NOTE: the advisor grid is 208×130 tiles (huge), ~4.3× the diagonal
// of the original Tactical default (48×30). The original rng values doubled as BOTH
// vision and fire range and were tuned for the small grid, so on the big map units
// only reacted when nearly touching. Retuned below:
//   rng  = VISION / ENGAGEMENT (detection) range — used by _canSee + utility. Scaled
//          ~2.2× so squads detect & start maneuvering at a sensible mid-map distance
//          (NOT the whole map: SNIPER 44/208 ≈ 21% width).
//   wrng = WEAPON FIRE range — SEPARATE concept (user requirement). Gates _tryFire so
//          a unit closes to within its weapon's effective reach before shooting, and
//          tracks each role's weapon: SNIPER (RAILGUN) fires far, SMG/FLANKER close.
const ROLES={
  LEADER :{lbl:'⌘',spd:.058,rng:28,wrng:18,fov:Math.PI*.65,sCD:22,bst:2,sprd:.06,dmg:16,mag:20,relT:55,strafe:true, grenadCD:350},
  ASSAULT:{lbl:'▲',spd:.055,rng:22,wrng:15,fov:Math.PI*.65,sCD:20,bst:3,sprd:.11,dmg:14,mag:25,relT:50,strafe:false,grenadCD:300},
  FLANKER:{lbl:'◈',spd:.082,rng:20,wrng:13,fov:Math.PI*.72,sCD:11,bst:2,sprd:.10,dmg:12,mag:20,relT:36,strafe:true, grenadCD:0},
  SNIPER :{lbl:'⊕',spd:.030,rng:44,wrng:36,fov:Math.PI*.36,sCD:55,bst:1,sprd:.022,dmg:36,mag:5, relT:80,strafe:false,grenadCD:0},
  SUPPORT:{lbl:'⊞',spd:.042,rng:24,wrng:15,fov:Math.PI*.62,sCD:26,bst:4,sprd:.08,dmg:11,mag:40,relT:70,strafe:true, grenadCD:250},
  DRONE  :{lbl:'⬡',spd:.095,rng:48,wrng: 0,fov:Math.PI*2.0,sCD:999,bst:0,sprd:0,  dmg:0, mag:-1,relT:999,strafe:false,grenadCD:0},
}
const RK=['LEADER','ASSAULT','FLANKER','SNIPER','SUPPORT']
const RK_ALL=['LEADER','ASSAULT','FLANKER','SNIPER','SUPPORT','DRONE']
// Sidearm stats (shared across all roles)
const SIDEARM={rng:4,dmg:9,sCD:18,bst:1,sprd:0.18,mag:8,relT:25}
const FORMATION=[[3,0],[1,2],[2,-3],[-3,0],[0,-1],[1,3],[-1,3]]
const AIM_THRESH={LEADER:Math.PI/6,ASSAULT:Math.PI/5,FLANKER:Math.PI/5,SNIPER:Math.PI/14,SUPPORT:Math.PI/4}
const LOCK_DUR=45
const TC=['#44aaff','#ff5555']

function getCR(rn){
  if(rn==='DRONE')return{...ROLES.DRONE,hp:HP_BASE.DRONE}
  const b=ROLES[rn],c=CFG.roles[rn]
  return{...b,
    hp:Math.round(HP_BASE[rn]*(c.hp/100)),
    spd:b.spd*(c.spdM/100),
    dmg:Math.max(1,Math.round(b.dmg*(c.dmgM/100))),
    mag:Math.max(1,Math.round(b.mag*(c.magM/100))),
    rng:b.rng*(c.rngM/100),
  }
}

// ══════════════════════════════════════════════════════════
// COMPARE MODE STATE
// ══════════════════════════════════════════════════════════
let COMPARE=false
let simA=null, simB=null
// Miroirs window.* : en script classique, un `let` top-level n'est pas sur window.
// Plusieurs features (visualiseur GOAP 3D, inspecteur d'agent, panneau journal) lisent
// window.simA/simB/COMPARE → on les synchronise explicitement.
function _syncWin(){window.simA=simA;window.simB=simB;window.COMPARE=COMPARE}
_syncWin()
// RNG seedé dédié au NN/RNN (déterminisme) : remplace Math.random() dans la couche
// d'apprentissage pour que deux runs au même seed soient reproductibles. Re-seedé à
// chaque nouvelle partie (doRestart) depuis le seed de la sim.
let _nnRng = mulberry32(0x9E3779B9)

// ══════════════════════════════════════════════════════════
// NEURAL NETWORK SYSTEM — shared across all Sim instances
// Architecture : 8 inputs × 8 hidden × 3 outputs per role
// Learning : online REINFORCE-lite with reward signal
// Persistence : localStorage auto-save every 300 sim-frames
// ══════════════════════════════════════════════════════════
const NN_IN=8, NN_HID=8, NN_OUT=3
const NN_W=NN_IN*NN_HID + NN_HID*NN_OUT  // 88 weights per role

// ── PER-TEAM LEARNED STATE ───────────────────────────────
// All persistent brain state (NN weights/Adam/baseline + GOAP RNN) is keyed by
// role+team so team 0 (player allies) and team 1 (adversary) have INDEPENDENT brains.
// wk(rn,team) builds the composite key. Both teams are present in NN.weights etc.
const NN_TEAMS=[0,1]
function wk(rn,team){ return rn+'_'+((team|0)===1?1:0) }
// VIVARIUM-namespaced localStorage prefix so a fresh visitor starts from zero and does
// NOT inherit the original Tactical project's shared saved weights.
const LS='viv_'
// Team-1 (adversary) learning EDGE: its reward magnitude is amplified so it sharpens
// faster than team 0 and difficulty diverges from the player over a run. Bounded for Adam stability.
const TEAM1_EDGE=1.6
function rewScale(team){ return (team|0)===1?TEAM1_EDGE:1 }

const NN={
  // One Float32Array of weights per role
  weights:{},
  updates:{},
  baseline:{},
  training:true,  // true=apprentissage actif, false=comportement figé
  lr:0.003,
  replayBuf:[],
  replayMax:1000,
  replayBatch:16,
  // Tracked metrics per role (EMA)
  gradNorm:{},   // EMA of gradient norm
  lossEMA:{},    // EMA of |advantage|
  // Adam optimizer state per role (m=1st moment, v=2nd moment)
  m:{}, v:{},
  adam_beta1:0.9, adam_beta2:0.999, adam_eps:1e-8,
  // How much NN output blends into static scoring (0→1 over ~2000 updates)
  // Keyed per team so each team's confidence ramp is independent.
  blendWeight(rn,team){ return Math.min(1, (this.updates[wk(rn,team)]||0)/2000) },

  init(){
    for(const rn of RK){
      for(const tm of NN_TEAMS){
        const kk=wk(rn,tm)
        this.m[kk]=new Float32Array(NN_W)
        this.v[kk]=new Float32Array(NN_W)
        this.weights[kk]=this._load(rn,tm)||this._randW()
        this.updates[kk]=this._loadInt(LS+'tacNN_upd_'+kk)||0
        this.baseline[kk]=parseFloat(localStorage.getItem(LS+'tacNN_bl_'+kk)||'0')||0
      }
    }
    this._renderPanel()
    const totalUpd=Object.values(this.updates).reduce((a,b)=>a+b,0)
    console.log('[NN] init — updates total:',totalUpd)
  },

  _randW(){
    const w=new Float32Array(NN_W)
    // Xavier initialization
    const scale=Math.sqrt(2/NN_IN)
    for(let i=0;i<NN_W;i++) w[i]=(_nnRng()*2-1)*scale
    return w
  },

  // Forward pass — tanh activation
  // Returns [engage_bias, retreat_bias, cover_bias] ∈ [-1,1]
  forward(rn, inp, team){
    const w=this.weights[wk(rn,team)]
    if(!w||!inp||inp.length!==NN_IN)return{out:new Float32Array(NN_OUT),h:new Float32Array(NN_HID)}
    const h=new Float32Array(NN_HID)
    let k=0
    for(let j=0;j<NN_HID;j++){
      let s=0; for(let i=0;i<NN_IN;i++) s+=inp[i]*w[k++]
      h[j]=Math.tanh(s)
    }
    const out=new Float32Array(NN_OUT)
    for(let j=0;j<NN_OUT;j++){
      let s=0; for(let i=0;i<NN_HID;i++) s+=h[i]*w[k++]
      out[j]=Math.tanh(s)
    }
    return{out,h}
  },

  // Build input vector from agent state
  // [hp_ratio, dist_enn, danger, ammo, allies, in_cover, aim_err, suppressed]
  buildInput(a, sim){
    const allE=sim.EC[a.team]
    const _bNonD=allE.filter(e=>e.rn!=='DRONE')
    const _bPool=_bNonD.length?_bNonD:allE
    const closE=(_bPool.length>0)?_bPool.reduce((b,e)=>Math.hypot(e.x-a.x,e.y-a.y)<Math.hypot(b.x-a.x,b.y-a.y)?e:b,_bPool[0]):null
    const dE=closE?Math.hypot(closE.x-a.x,closE.y-a.y):sim.MW
    const tx=Math.floor(a.x),ty=Math.floor(a.y)
    const dang=tx>=0&&ty>=0&&tx<sim.MW&&ty<sim.MH?sim.danger[ty][tx]/50:0
    const allyR=(sim.alive[a.team]||1)-1  // FIX: use cached popcount minus self (approx)
    const inCover=tx>=0&&ty>=0&&tx<sim.MW&&ty<sim.MH&&sim.map[ty][tx]===2?1:0
    const aimErr=closE?sim._ad(a.dir,Math.atan2(closE.y-a.y,closE.x-a.x))/Math.PI:0.5

    const eVelMag=closE?Math.min(1,Math.hypot(closE.vx||0,closE.vy||0)/.08):0
    const pressure=Math.min(1,sim.EC[a.team].length/(sim.alive[a.team]||1))
    const _hmAct=sim.hmActivity?Math.min(1,sim.hmActivity[ty*sim.MW+tx]*.5):0
    const _closC=sim.cov.length?sim.cov.reduce((b,n)=>{const d=Math.hypot(n.x-a.x,n.y-a.y);return d<b?d:b},99):8
    const _flkAng=closE?Math.min(1,sim._ad(closE.dir,Math.atan2(a.y-closE.y,a.x-closE.x))/Math.PI):0

    // Slots 4 et 7 varient par rôle — signal le plus pertinent pour chaque unité
    let _slot4=Math.min(1,allyR/5)*(1-pressure*.4)  // défaut: soutien allié
    let _slot7=(a.supCD>0?.4:0)+Math.min(.6,_flkAng) // défaut: supprimé+flanc

    if(a.rn==='SNIPER'){
      // Slot4: alliés en combat direct (besoin d'overwatch)
      const _allyFightN=sim.agents.filter(f=>f.team===a.team&&f.hp>0&&f!==a&&(f.state==='E'||f.state==='S')).length
      _slot4=Math.min(1,_allyFightN/3)
      // Slot7: qualité de la position (LOS + distance optimale)
      const _hasLOS=closE&&sim._canSee(a,closE)?1:0
      const _distOpt=closE?Math.max(0,1-Math.abs(dE-14)/8):0  // optimal 10-18 tiles
      _slot7=_hasLOS*.6+_distOpt*.4
    } else if(a.rn==='FLANKER'){
      // Slot4: score de position latérale (suis-je sur le flanc?)
      const _spawnX=a.team===0?3:sim.MW-3
      const _notBehindSpawn=a.team===0?(a.x>_spawnX+3?1:0):(a.x<_spawnX-3?1:0)
      _slot4=_flkAng*.7+_notBehindSpawn*.3  // angle mort + pas en spawn
      // Slot7: mobilité disponible (pas supprimé = peut manœuvrer)
      const _mobile=a.supCD<=0?1:0.2
      _slot7=_mobile*.6+Math.min(1,(a.hp/a.role.hp))*.4
    } else if(a.rn==='SUPPORT'){
      // Slot4: flanker allié proche (doit le couvrir)
      const _flkClose=sim.agents.filter(f=>f.team===a.team&&f.rn==='FLANKER'&&f.hp>0&&Math.hypot(f.x-closE?.x||0,f.y-closE?.y||0)<10).length
      _slot4=Math.min(1,_flkClose)*.8+(1-pressure*.4)*.2
      // Slot7: mag ratio (peut continuer la suppression?)
      _slot7=a.mag/a.role.mag
    } else if(a.rn==='LEADER'){
      // Slot4: alliés derrière lui (il doit être en avant)
      const _behindAllies=sim.agents.filter(f=>f.team===a.team&&f.hp>0&&f!==a&&
        (a.team===0?f.x<a.x:f.x>a.x)).length
      _slot4=Math.min(1,_behindAllies/3)  // bon si alliés sont derrière
      // Slot7: supprimé + est-il en avant?
      _slot7=(a.supCD>0?.3:0)+_slot4*.7
    }
    // ASSAULT: slots par défaut (généraliste pur)

    return new Float32Array([
      a.hp/a.role.hp,                              // 0: HP ratio
      1-Math.min(1,dE/a.role.rng),                 // 1: proximité ennemi
      Math.min(1,dang+_hmAct*.3),                  // 2: danger+heatmap
      a.mag/a.role.mag,                            // 3: ammo ratio
      _slot4,                                      // 4: rôle-spécifique
      (1-Math.min(1,_closC/8))*.6+inCover*.4,      // 5: cover combiné
      Math.max(aimErr,eVelMag*.3),                 // 6: aim error
      _slot7                                       // 7: rôle-spécifique
    ])
  },

  // Adam optimizer backprop — stable, momentum-based
  // Computes proper gradients via chain rule (tanh derivative)
  backprop(rn, inp, reward, sim, team){
    const kk=wk(rn,team)
    if(!rn||!inp||inp.length!==NN_IN||!this.weights[kk])return  // guard rn inconnu ou inp invalide
    // Team-1 (adversary) learning EDGE: it sharpens faster than team 0 so difficulty
    // diverges from the player over a run. Applied two ways (the LR term below is what
    // Adam does NOT normalize away per-step; the reward scaling shapes baseline/advantage
    // dynamics and the replay signal). Keep the raw (pre-edge) reward for the replay buffer
    // so the edge is applied once per replayed sample (not compounded on each replay).
    const _rawReward=reward
    const _edge=rewScale(team)
    reward=reward*_edge
    const w=this.weights[kk]
    const m=this.m[kk], v=this.v[kk]
    const{out,h}=this.forward(rn,inp,team)

    // Baseline subtraction (exponential moving avg)
    const bl=this.baseline[kk]
    this.baseline[kk]=bl*.97+(reward*.03)
    const adv=Math.max(-10,Math.min(10,reward-bl))  // clipped advantage

    const t=(this.updates[kk]||0)+1
    const b1=this.adam_beta1, b2=this.adam_beta2, eps=this.adam_eps
    // Bias-corrected LR (team-1 edge multiplies the effective LR — bounded: 0.003→0.0048,
    // well inside Adam's stable range, so the step size genuinely grows for the adversary).
    const lr_t=this.lr*_edge*Math.sqrt(1-Math.pow(b2,t))/(1-Math.pow(b1,t))

    // Compute gradients: ∂L/∂w = adv * input * dtanh(output)
    const grad=new Float32Array(NN_W)
    // Output layer: k = NN_IN*NN_HID..NN_W
    let k=NN_IN*NN_HID
    const dOut=new Float32Array(NN_HID)
    for(let j=0;j<NN_OUT;j++){
      const dtanh_o=1-out[j]*out[j]
      const err=adv*dtanh_o
      for(let i=0;i<NN_HID;i++){
        grad[k]=err*h[i]; dOut[i]+=err*w[k]; k++
      }
    }
    // Hidden layer: k = 0..NN_IN*NN_HID
    k=0
    for(let j=0;j<NN_HID;j++){
      const dtanh_h=1-h[j]*h[j]
      const err=dOut[j]*dtanh_h
      for(let i=0;i<NN_IN;i++){
        grad[k++]=err*inp[i]
      }
    }
    // Gradient clipping
    let gnorm=0;for(let i=0;i<NN_W;i++)gnorm+=grad[i]*grad[i];gnorm=Math.sqrt(gnorm)
    // Track EMA of gradient norm and loss proxy
    this.gradNorm[kk]=this.gradNorm[kk]?this.gradNorm[kk]*.95+gnorm*.05:gnorm
    this.lossEMA[kk]=this.lossEMA[kk]?this.lossEMA[kk]*.95+Math.abs(adv)*.05:Math.abs(adv)
    if(gnorm>2.0){const sc=2.0/gnorm;for(let i=0;i<NN_W;i++)grad[i]*=sc}
    // Adam update
    for(let i=0;i<NN_W;i++){
      m[i]=b1*m[i]+(1-b1)*grad[i]
      v[i]=b2*v[i]+(1-b2)*grad[i]*grad[i]
      w[i]+=lr_t*m[i]/(Math.sqrt(v[i])+eps)
      w[i]=Math.max(-4,Math.min(4,w[i]))
    }
    if(t%50===0&&t<2000){const ns=t<500?0.0015:0.0006;for(let i=0;i<NN_W;i++)w[i]+=(_nnRng()*2-1)*ns}
    this.updates[kk]=t
    // Store in replay buffer (carry team so replay trains the correct per-team brain)
    const _tm=(team|0)===1?1:0
    const _pri=Math.abs(adv)+0.01
    if(this.replayBuf.length<this.replayMax){this.replayBuf.push({rn,team:_tm,inp:inp.slice(),reward:_rawReward,priority:_pri})}
    else{let _mi=0,_mp=this.replayBuf[0].priority;for(let _ri=1;_ri<40&&_ri<this.replayBuf.length;_ri++){if(this.replayBuf[_ri].priority<_mp){_mp=this.replayBuf[_ri].priority;_mi=_ri}};this.replayBuf[_mi]={rn,team:_tm,inp:inp.slice(),reward:_rawReward,priority:_pri}}
  },

  // Called by Sim on relevant events
  onKill(shooter, sim){
    if(!this.training)return
    if(!shooter||!shooter.rn)return
    const inp=this.buildInput(shooter,sim)
    shooter._nnInp=inp
    this.backprop(shooter.rn,inp,+6.0,sim,shooter.team)
  },

  onHit(victim, sim){
    if(!this.training)return
    if(!victim||!victim.rn||victim.rn==='DRONE')return
    const inp=this.buildInput(victim,sim)
    victim._nnInp=inp
    this.backprop(victim.rn,inp,-1.5,sim,victim.team)
  },

  onDeath(victim, sim){
    if(!this.training)return
    if(!victim||!victim.rn||victim.rn==='DRONE')return
    const inp=victim._nnInp||this.buildInput(victim,sim)
    this.backprop(victim.rn,inp,-8.0,sim,victim.team)
  },

  // Survival reward tick — called every 120 frames per agent
  onSurvive(a, sim){
    if(!this.training)return
    const inp=this.buildInput(a,sim)
    a._nnInp=inp
    // Base survival reward
    let r=+0.08
    // Reward shaping: shaped intermediate rewards
    const tx=Math.floor(a.x),ty=Math.floor(a.y)
    const inCover=tx>=0&&ty>=0&&tx<sim.MW&&ty<sim.MH&&sim.map[ty]?.[tx]===2
    const danger=sim.danger[ty]?.[tx]||0
    // In cover under fire → small bonus (learning to use cover)
    if(inCover&&a.supCD>0) r+=0.08
    // Low HP but still alive in cover → survival bonus
    if(a.hp/a.role.hp<0.4&&inCover) r+=0.06
    // High danger zone → small penalty (learn to avoid)
    if(danger>20) r-=0.04
    // Has LOS → small engage bonus (learn to seek visibility)
    if(sim&&sim.EC[a.team].some(e=>sim._canSee(a,e))) r+=0.05
    if(sim){
      const _ec=sim.EC[a.team].filter(e=>e.rn!=='DRONE')
      if(_ec.length){
        const _e=_ec.reduce((b,e)=>Math.hypot(e.x-a.x,e.y-a.y)<Math.hypot(b.x-a.x,b.y-a.y)?e:b,_ec[0])
        const _dE2=Math.hypot(_e.x-a.x,_e.y-a.y)
        const _tx2=Math.floor(a.x),_ty2=Math.floor(a.y)
        const _inCov2=sim.map[_ty2]?.[_tx2]===2
        const _dang2=(_tx2>=0&&_ty2>=0&&_tx2<sim.MW&&_ty2<sim.MH)?sim.danger[_ty2][_tx2]/50:0
        if(sim._ad(_e.dir,Math.atan2(a.y-_e.y,a.x-_e.x))>(_e.role?.fov||Math.PI)*.6)
          r+=a.rn==='FLANKER'?0.12:0.05
        if(_dang2>0.7&&_dE2<8)r-=0.25
        if(_inCov2&&_dang2<0.4)r+=0.15
        if(!_inCov2&&_dang2>0.6)r-=0.20
        if(_dE2>8&&_dE2<16)r+=0.10
        if(_dE2<4)r-=0.10
        if(_dE2>20)r-=0.08
      }
    }
    // ── Reward shaping rôle-spécifique ─────────────────────────────
    if(sim){
      const _ec2=sim.EC[a.team].filter(e=>e.rn!=='DRONE')
      const _allies2=sim.agents.filter(f=>f.team===a.team&&f.hp>0&&f!==a&&f.rn!=='DRONE')
      const _allyFight2=_allies2.some(f=>f.state==='E'||f.state==='S'||f.state==='A')
      const _hasLOS2=_ec2.some(e=>sim._canSee(a,e))

      if(a.rn==='SNIPER'){
        // ++ Overwatch actif: allié combat + LOS dégagé + cover
        if(_allyFight2&&_hasLOS2&&sim.map[Math.floor(a.y)]?.[Math.floor(a.x)]===2) r+=0.25
        // ++ LOS seule + bonne distance (10-18 tiles)
        if(_ec2.length&&_hasLOS2){
          const _dSniper=Math.hypot(_ec2[0].x-a.x,_ec2[0].y-a.y)
          if(_dSniper>10&&_dSniper<18) r+=0.12
        }
        // -- Allié combat mais sniper sans LOS et loin: il est inutile
        if(_allyFight2&&!_hasLOS2) r-=0.18
        // -- Trop proche d'un ennemi (vulnérable, perd son avantage portée)
        if(_ec2.length&&Math.hypot(_ec2[0].x-a.x,_ec2[0].y-a.y)<8) r-=0.20
      }

      else if(a.rn==='FLANKER'){
        if(_ec2.length){
          const _eF=_ec2.reduce((b,e)=>Math.hypot(e.x-a.x,e.y-a.y)<Math.hypot(b.x-a.x,b.y-a.y)?e:b,_ec2[0])
          const _angFromEF=Math.atan2(a.y-_eF.y,a.x-_eF.x)
          const _fovDiffF=sim._ad(_eF.dir,_angFromEF)
          // ++ Dans l'angle mort ennemi (dos ou flanc)
          if(_fovDiffF>(_eF.role?.fov||Math.PI)*.6) r+=0.18
          // ++ En mouvement (vitesse = sa force)
          const _mvF=Math.hypot(a.vx||0,a.vy||0)
          if(_mvF>0.04) r+=0.08
          // -- Dans le cône frontal (va mourir)
          if(_fovDiffF<(_eF.role?.fov||Math.PI)*.25) r-=0.20
          // -- Derrière sa ligne de spawn (reculé trop loin)
          const _spawnXF=a.team===0?4:sim.MW-4
          if(a.team===0?a.x<_spawnXF:a.x>_spawnXF) r-=0.28
          // -- Statique en frontal (le pire cas)
          if(_fovDiffF<Math.PI*.3&&_mvF<0.02) r-=0.15
        }
      }

      else if(a.rn==='ASSAULT'){
        if(_ec2.length){
          const _dA=Math.hypot(_ec2[0].x-a.x,_ec2[0].y-a.y)
          // ++ Distance optimale 3-8 tiles (portée efficace)
          if(_dA>3&&_dA<8) r+=0.15
          // ++ Ennemi HP faible visible
          if(_ec2.some(e=>e.hp/e.role.hp<0.4)) r+=0.08
          // -- Trop loin (DPS gaspillé)
          if(_dA>a.role.rng) r-=0.10
        }
      }

      else if(a.rn==='LEADER'){
        // ++ Alliés derrière lui (il est en avant)
        const _behindL=_allies2.filter(f=>a.team===0?f.x<a.x:f.x>a.x).length
        r+=_behindL*0.06  // +0.06 par allié protégé
        // ++ Tient la position sous le feu (rôle absorbeur)
        if(a.supCD>0&&_hasLOS2) r+=0.10
        // -- Derrière tous ses alliés (abandonne son rôle)
        if(_behindL===0&&_allies2.length>1) r-=0.12
      }

      else if(a.rn==='SUPPORT'){
        if(_ec2.length){
          const _flkAlly=_allies2.find(f=>f.rn==='FLANKER'&&f.hp>0)
          // ++ Supprime l'ennemi que le flanker contourne
          if(_flkAlly&&_hasLOS2&&a.state==='S') r+=0.18
          // ++ Distance optimale 8-12 tiles
          const _dSup=Math.hypot(_ec2[0].x-a.x,_ec2[0].y-a.y)
          if(_dSup>7&&_dSup<13) r+=0.08
          // ++ Revive en cours
          if(a.state==='RV') r+=0.20
          // -- Trop proche d'un ennemi (pas son rôle)
          if(_dSup<5) r-=0.12
        }
      }
    }
    if(!a._rwMem)a._rwMem=[]
    a._rwMem.push(r);if(a._rwMem.length>10)a._rwMem.shift()
    const _dr=a._rwMem.reduce((s,v)=>s+v,0)/a._rwMem.length
    this.backprop(a.rn,inp,isNaN(_dr)?r:_dr*.6+r*.4,sim,a.team)
  },

  // Cover score bias from NN output[2] — blended with static score
  coverBias(a, sim){
    if(!a._nnInp) return 0
    const blend=this.blendWeight(a.rn,a.team)
    if(blend<0.02) return 0
    const{out}=this.forward(a.rn,a._nnInp,a.team)
    return out[2]*blend*8  // max ±8 pts influence
  },

  // Engage/retreat bias — modulates FSM thresholds
  engageBias(a){
    if(!a._nnInp) return 0
    const blend=this.blendWeight(a.rn,a.team)
    if(blend<0.02) return 0
    const{out}=this.forward(a.rn,a._nnInp,a.team)
    return out[0]*blend  // ∈ [-blend, +blend]
  },

  retreatBias(a){
    const base={SNIPER:0.10,SUPPORT:0.28,LEADER:0.18,ASSAULT:0.22,FLANKER:0.30}[a.rn]||0.22  // FLANKER hp faible → recule vite (mais vers flanc, pas spawn)  // sniper: moins craintif
    if(!a._nnInp) return base
    const blend=this.blendWeight(a.rn,a.team)
    if(blend<0.02) return base
    const{out}=this.forward(a.rn,a._nnInp,a.team)
    return Math.max(0.10,Math.min(0.45, base+out[1]*blend*0.12))
  },

  // ── PERSISTENCE ──────────────────────────────────
  save(){
    try{
      let totalUpd=0
      for(const rn of RK){
        for(const tm of NN_TEAMS){
          const kk=wk(rn,tm)
          const w=this.weights[kk]
          if(!w||w.length!==NN_W)continue
          localStorage.setItem(LS+'tacNN_'+kk, JSON.stringify(Array.from(w)))
          localStorage.setItem(LS+'tacNN_upd_'+kk, this.updates[kk]||0)
          localStorage.setItem(LS+'tacNN_bl_'+kk, this.baseline[kk]||0)
          if(this.m[kk]&&this.m[kk].length===NN_W)
            localStorage.setItem(LS+'tacNN_m_'+kk, JSON.stringify(Array.from(this.m[kk])))
          if(this.v[kk]&&this.v[kk].length===NN_W)
            localStorage.setItem(LS+'tacNN_v_'+kk, JSON.stringify(Array.from(this.v[kk])))
          totalUpd+=this.updates[kk]||0
        }
      }
      localStorage.setItem(LS+'tacNN_meta',JSON.stringify({ts:Date.now(),totalUpd,version:'1.1'}))
      const ts=new Date().toLocaleTimeString()
      const el=document.getElementById('nnSaveStatus')
      if(el)el.textContent='✓ '+ts+' ('+totalUpd.toLocaleString()+' upd)'
      return true
    }catch(e){
      const el=document.getElementById('nnSaveStatus')
      if(el)el.textContent='⚠ save error'
      return false
    }
  },

  _load(rn,team){
    const kk=wk(rn,team)
    try{
      const raw=localStorage.getItem(LS+'tacNN_'+kk)
      if(!raw)return null
      const arr=JSON.parse(raw)
      if(!Array.isArray(arr)||arr.length!==NN_W)return null
      if(arr.some(v=>!isFinite(v))){console.warn('[NN] poids corrompus',kk);return null}
      const rm=localStorage.getItem(LS+'tacNN_m_'+kk)
      const rv=localStorage.getItem(LS+'tacNN_v_'+kk)
      const rb=localStorage.getItem(LS+'tacNN_bl_'+kk)
      if(rm){try{const ma=JSON.parse(rm);if(ma.length===NN_W&&ma.every(isFinite))this.m[kk]=new Float32Array(ma)}catch(e){}}
      if(rv){try{const va=JSON.parse(rv);if(va.length===NN_W&&va.every(isFinite))this.v[kk]=new Float32Array(va)}catch(e){}}
      if(rb)this.baseline[kk]=parseFloat(rb)||0
      return new Float32Array(arr)
    }catch(e){console.warn('[NN] erreur chargement',kk,e);return null}
  },

  _loadInt(key){
    try{return parseInt(localStorage.getItem(key)||'0')||0}catch(e){return 0}
  },

  reset(){
    for(const rn of RK){
      for(const tm of NN_TEAMS){
        const kk=wk(rn,tm)
        this.weights[kk]=this._randW()
        this.updates[kk]=0
        this.baseline[kk]=0
        this.m[kk]=new Float32Array(NN_W)
        this.v[kk]=new Float32Array(NN_W)
        localStorage.removeItem(LS+'tacNN_'+kk)
        localStorage.removeItem(LS+'tacNN_upd_'+kk)
        localStorage.removeItem(LS+'tacNN_bl_'+kk)
        localStorage.removeItem(LS+'tacNN_m_'+kk)
        localStorage.removeItem(LS+'tacNN_v_'+kk)
      }
    }
    const el=document.getElementById('nnSaveStatus')
    if(el) el.textContent='poids réinitialisés'
    this._renderPanel()
  },

  // ── UI ────────────────────────────────────────────
  // Colors per role
  _roleColor:{LEADER:'#ffdd44',ASSAULT:'#44aaff',FLANKER:'#44ffcc',SNIPER:'#aa88ff',SUPPORT:'#ff9944'},

  _renderPanel(){
    const el=document.getElementById('nnBars')
    if(!el) return
    el.innerHTML=''
    for(const rn of RK){
      const upd0=this.updates[wk(rn,0)]||0
      const upd1=this.updates[wk(rn,1)]||0
      const conf=Math.min(1,upd0/2000)       // bar = team 0 (player allies)
      const conf1=Math.min(1,upd1/2000)       // value = team 1 (adversary)
      const col=this._roleColor[rn]||'#44aaff'
      el.innerHTML+=`<div class="nn-row">
        <span class="nn-lbl">${rn}</span>
        <div class="nn-bar-bg"><div class="nn-bar-fill" style="width:${Math.round(conf*100)}%;background:${col}"></div></div>
        <span class="nn-val" style="color:${col}">${Math.round(conf*100)}% / ${Math.round(conf1*100)}%</span>
      </div>`
    }
    const totalUpd=Object.values(this.updates).reduce((a,b)=>a+b,0)
    const udEl=document.getElementById('nnUpdates')
    if(udEl) udEl.textContent=`updates: ${totalUpd.toLocaleString()}`
    // Status badge
    const badge=document.getElementById('nnStatusBadge')
    const stxt=document.getElementById('nnStatusTxt')
    const hasData=Object.values(this.updates).some(v=>v>50)
    if(badge&&stxt){
      if(hasData){
        badge.style.borderColor='#2a6633';badge.style.color='#44dd88'
        stxt.textContent='APPRENTISSAGE ACTIF'
      } else {
        badge.style.borderColor='#2a3a44';badge.style.color='#445566'
        stxt.textContent='DÉMARRAGE'
      }
    }
    // Metrics: accuracy per role (from all sim instances)
    const metricsEl=document.getElementById('nnMetrics')
    if(metricsEl){
      let mHtml=''
      const sim=window.simA
      if(sim){
        const byRole={}
        for(const a of sim.agents){
          if(!byRole[a.rn])byRole[a.rn]={f:0,h:0}
          byRole[a.rn].f+=(a.shotsFired||0)
          byRole[a.rn].h+=(a.shotsHit||0)
        }
        for(const rn of RK){
          const s=byRole[rn]||{f:0,h:0}
          const acc=s.f>0?Math.round(s.h/s.f*100):0
          const col=this._roleColor[rn]||'#44aaff'
          mHtml+=`<div class="nn-row"><span class="nn-lbl" style="color:${col}">${rn.slice(0,4)}</span><div class="nn-bar-bg"><div class="nn-bar-fill" style="width:${acc}%;background:${col}"></div></div><span class="nn-val">${acc}%</span></div>`
        }
      }
      metricsEl.innerHTML=mHtml||'<span style="font-size:6px;color:#223344">—</span>'
    }
    // Metrics: gradient norm + loss EMA per role
    const lossEl=document.getElementById('nnLoss')
    if(lossEl){
      const avgGrad=Object.values(this.gradNorm).reduce((a,b)=>a+b,0)/Math.max(1,Object.values(this.gradNorm).length)
      const avgLoss=Object.values(this.lossEMA).reduce((a,b)=>a+b,0)/Math.max(1,Object.values(this.lossEMA).length)
      lossEl.textContent=`∇:${avgGrad.toFixed(2)} L:${avgLoss.toFixed(2)}`
      lossEl.style.color=avgGrad>1.5?'#ff6644':avgGrad>0.5?'#ffaa44':'#44aa66'
    }
    // Per-role grad norm in nnBars (append after confidence bars)
    const gradEl=document.getElementById('nnGradBars')
    if(gradEl){
      let gh=''
      for(const rn of RK){
        const gn=((this.gradNorm[wk(rn,0)]||0)+(this.gradNorm[wk(rn,1)]||0))/2
        const le=((this.lossEMA[wk(rn,0)]||0)+(this.lossEMA[wk(rn,1)]||0))/2
        const col=this._roleColor[rn]||'#44aaff'
        const pct=Math.min(100,Math.round(gn/2*100))
        const _gc=gn>1.5?'#ff6644':gn>0.5?'#ffaa44':col
        gh+='<div class="nn-row"><span class="nn-lbl" style="color:'+col+'">'+rn.slice(0,4)+'</span><div class="nn-bar-bg"><div class="nn-bar-fill" style="width:'+pct+'%;background:'+_gc+'"></div></div><span class="nn-val">'+gn.toFixed(2)+'</span></div>'
      }
      gradEl.innerHTML=gh
    }
    // Replay buffer size
    const repEl=document.getElementById('nnReplay')
    if(repEl) repEl.textContent=this.training?('buf:'+this.replayBuf.length+'/'+this.replayMax):'◉ EVAL - gelé'
    const jEl=document.getElementById('journalStats')
    if(jEl&&window.simA?.journal){
      const j=window.simA.journal
      const _jf=j.filter,_nf=j.filter(e=>e.t==='FIRE').length,_nh=j.filter(e=>e.t==='HIT').length,_nk=j.filter(e=>e.t==='KILL').length,_ns=j.filter(e=>e.t==='STATE').length
      jEl.textContent=j.length+' evt · '+_nf+' tirs · '+_nh+' hits · '+_nk+' kills · '+_ns+' trans'
    }
    const jL=document.getElementById('journalLive')
    if(jL&&window.simA?.journal){
      const last=window.simA.journal.slice(-5).reverse()
      jL.innerHTML=last.map(function(e){
        var col=e.t==='KILL'?'#ff5555':e.t==='HIT'?'#ffaa44':e.t==='STATE'?'#44aaff':e.t==='DETECT'?'#44ff88':'#334455'
        var d=e.t==='STATE'?(e.prev+'→'+e.next):e.t==='FIRE'?('d='+e.tdist):e.t==='HIT'?('-'+e.dmg+'hp'):e.t==='DETECT'?('snd '+e.dist):''
        return'<div style="color:'+col+'">['+e.f+'] '+e.t+' '+e.rn+'('+e.x+','+e.y+') '+d+'</div>'
      }).join('')
    }
    const slotsEl=document.getElementById('journalSlots')
    if(slotsEl)try{const m=JSON.parse(localStorage.getItem('tacJournal_manifest')||'[]');if(!m.length){slotsEl.innerHTML='<div style="font-size:5px;color:#1a2535">—</div>'}else{slotsEl.innerHTML=m.slice(0,3).map(function(s){var sc=s.final?'#44aa66':'#334455',sym=s.final?'●':'○';return'<div style="display:flex;gap:5px;padding:2px 0;border-bottom:1px solid #0a0f18"><span style="color:'+sc+';font-size:5px">'+sym+'</span><span style="color:#334455;flex:1;font-size:5px">seed '+s.seed+' · '+s.events+'evt</span><button onclick="_dlJ('+s.slot+')" style="font-size:5px;padding:1px 4px;background:none;border:1px solid #1a2535;color:#44aaff;cursor:pointer">↓</button></div>'}).join('')}}catch(e){}
    // Toolbar indicator
    const tbEl=document.getElementById('tbr-nn')
    if(tbEl){
      const totalConf=Object.values(this.updates).reduce((a,b)=>a+Math.min(1,b/2000),0)
      const pct=Math.round(totalConf/(RK.length*NN_TEAMS.length)*100)
      tbEl.textContent=(NN.training?'':'◉ ')+(pct>5?('NN '+pct+'%'):'')
      tbEl.style.color=pct>50?'#44dd88':pct>10?'#667744':'#2a4422'
    }
  },

  // Called every 300 frames from Sim.update
  // Mini-batch replay: sample 8 random transitions and backprop
  replayTrain(){
    if(!this.training)return
    if(this.replayBuf.length<16) return
    for(let i=0;i<this.replayBatch;i++){
      const t=this.replayBuf[Math.floor(_nnRng()*this.replayBuf.length)]
      if(t&&t.inp&&t.rn) this.backprop(t.rn,t.inp,t.reward,null,t.team)
    }
  },
  tick(frameN){
    if(frameN%300===0){
      if(this.training)this.save()
      this._renderPanel()
      if(window.simA)window.simA._saveJournal(false)
    }
    // Replay training every 60 frames
    if(frameN%60===0&&this.training)this.replayTrain()
    if(frameN%120===0)this._renderPanel()
  }
}

// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
// SFX — Synthèse audio (Web Audio API, sans fichiers)
// Portées de détection IA par arme (tiles)
// ══════════════════════════════════════════════════════════
const SOUND_RANGE={LEADER:8,ASSAULT:8,FLANKER:6,SNIPER:12,SUPPORT:10,SIDEARM:4,GRENADE:15,DRONE:0}
const SFX={
  ctx:null,vol:0.30,enabled:true,masterGain:null,
  init(){try{this.ctx=new(window.AudioContext||window.webkitAudioContext)();this.masterGain=this.ctx.createGain();this.masterGain.gain.value=this.vol;this.masterGain.connect(this.ctx.destination)}catch(e){this.enabled=false}},
  unlock(){if(!this.ctx)this.init();if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume()},
  _pan(x,mw){return Math.max(-1,Math.min(1,(x/(mw||1))*2-1))},
  _env(g,vol,atk,dec,sus,rel,t){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+atk);g.gain.linearRampToValueAtTime(sus,t+atk+dec);g.gain.linearRampToValueAtTime(0,t+atk+dec+rel)},
  _noise(dur){const b=this.ctx.createBuffer(1,Math.ceil(this.ctx.sampleRate*dur),this.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;const s=this.ctx.createBufferSource();s.buffer=b;return s},
  _shot(rn,x,mw){
    if(!this.enabled||!this.ctx||this.ctx.state!=='running')return
    const now=this.ctx.currentTime,pan=this.ctx.createStereoPanner()
    pan.pan.value=this._pan(x,mw);pan.connect(this.masterGain)
    const mn=(freq,q,ftype,dur,vol,atk,dec,sus,rel)=>{const n=this._noise(dur),f=this.ctx.createBiquadFilter(),ng=this.ctx.createGain();f.type=ftype;f.frequency.value=freq;if(q)f.Q.value=q;n.connect(f);f.connect(ng);ng.connect(pan);this._env(ng,vol,atk,dec,sus,rel,now);n.start(now);n.stop(now+dur)}
    const mk=(freq,type,dur,vol,atk,dec)=>{const o=this.ctx.createOscillator(),og=this.ctx.createGain();o.type=type;o.frequency.value=freq;o.connect(og);og.connect(pan);this._env(og,vol,atk,dec,0,0,now);o.start(now);o.stop(now+dur)}
    if(rn==='SNIPER'){mn(3200,0.8,'bandpass',0.12,0.9,0.001,0.03,0.05,0.08);mk(1800,'sawtooth',0.07,0.35,0.001,0.06)}
    else if(rn==='ASSAULT'){for(let bi=0;bi<3;bi++){const t2=now+bi*0.055,n2=this._noise(0.08),f2=this.ctx.createBiquadFilter(),bg=this.ctx.createGain();f2.type='bandpass';f2.frequency.value=1400;f2.Q.value=1.2;n2.connect(f2);f2.connect(bg);bg.connect(pan);this._env(bg,0.55,0.001,0.02,0.08,0.05,t2);n2.start(t2);n2.stop(t2+0.08)}}
    else if(rn==='FLANKER'){mn(1800,null,'highpass',0.07,0.5,0.001,0.01,0.04,0.05)}
    else if(rn==='SUPPORT'){mn(700,1.5,'lowpass',0.15,0.8,0.002,0.04,0.2,0.1);mk(120,'sine',0.1,0.28,0.002,0.08)}
    else if(rn==='SIDEARM'){mn(900,2,'bandpass',0.06,0.35,0.001,0.015,0.03,0.04)}
    else{mn(1800,1.0,'bandpass',0.10,0.6,0.001,0.025,0.06,0.07)}
  },
  explosion(x,mw){
    if(!this.enabled||!this.ctx||this.ctx.state!=='running')return
    const now=this.ctx.currentTime,pan=this.ctx.createStereoPanner()
    pan.pan.value=this._pan(x,mw);pan.connect(this.masterGain)
    const n=this._noise(0.6),g=this.ctx.createGain();n.connect(g);g.connect(pan);this._env(g,1.0,0.001,0.05,0.3,0.25,now);n.start(now);n.stop(now+0.6)
    const o=this.ctx.createOscillator(),og=this.ctx.createGain();o.type='sine';o.frequency.setValueAtTime(90,now);o.frequency.linearRampToValueAtTime(30,now+0.3);og.gain.setValueAtTime(0.45,now);og.gain.linearRampToValueAtTime(0,now+0.3);o.connect(og);og.connect(pan);o.start(now);o.stop(now+0.3)
  }
}


// ══ GOAP + MiniRNN — mémoire temporelle (depuis v33_fusion) ══
function MiniRNN() {
  this.mem = new Float32Array(4);
  this.w   = new Float32Array(16);
  for(var i=0;i<16;i++) this.w[i]=(_nnRng()*2-1)*0.3;
}
MiniRNN.prototype.update = function(reward, inp, rn, team){
  if(!inp||inp.length<4)return;
  // LR decreases as Adam matures: both optimizers converge together
  var _adamUpd=(rn&&NN&&NN.updates&&NN.updates[wk(rn,team)])?NN.updates[wk(rn,team)]:0;
  var _adamMat=Math.min(1,_adamUpd/2000);
  var lr=0.015*(1-_adamMat*0.7);
  for(var i=0;i<4;i++){
    var dtanh=1-this.mem[i]*this.mem[i];
    for(var j=0;j<4;j++){
      var _wi=i*4+j;            // FIX : vraie matrice 4x4 (avant (i+j)%16 → poids aliasés, 9/16 morts)
      this.w[_wi]+=lr*reward*inp[j]*dtanh;
      if(this.w[_wi]>2)this.w[_wi]=2;
      if(this.w[_wi]<-2)this.w[_wi]=-2;
    }
  }
};
MiniRNN.prototype.forward = function(inp){
  var out = new Float32Array(4);
  var _n=Math.min(4,inp.length);
  for(var i=0;i<4;i++){
    var s = this.mem[i]*0.5;
    for(var j=0;j<_n;j++) s += inp[j]*this.w[i*4+j];   // FIX : matrice 4x4 sans aliasing
    out[i] = Math.tanh(s);
  }
  this.mem = out;
  return out;
};

// Compute GOAP goal scores from existing NN input vector
// Reuses NN.buildInput() -- no duplicated state logic
function computeGOAPGoals(a, sim) {
  try {
    var inp = NN.buildInput(a, sim);
    return {
      survive:   Math.max(0, Math.min(1, (1-inp[0])*0.6 + inp[2]*0.4)),
      eliminate: Math.max(0, Math.min(1, inp[1]*0.7 + (1-inp[6])*0.3)),
      support:   Math.max(0, Math.min(1, inp[4])),
      position:  Math.max(0, Math.min(1, inp[5]*0.7 + inp[3]*0.3))
    };
  } catch(e) {
    _aiDbg(e,'goals');
    return {survive:0,eliminate:0,support:0,position:0};
  }
}

// Per-agent GOAP state (initialized on demand)
// RNN global store per role -- persisted in localStorage
var GOAP_RNN_STORE = {};
var GOAP_RNN_UPDATES = {};
var GOAP_RNN_ROLES = ['LEADER','ASSAULT','FLANKER','SNIPER','SUPPORT'];

function initGOAPStore(){
  // Per-team GOAP RNN store: each (role,team) pair has an independent persistent RNN.
  for(var _i=0;_i<GOAP_RNN_ROLES.length;_i++){
    for(var _t=0;_t<NN_TEAMS.length;_t++){
      var _kk=wk(GOAP_RNN_ROLES[_i],NN_TEAMS[_t]);
      GOAP_RNN_UPDATES[_kk]=0;
      GOAP_RNN_STORE[_kk]=new MiniRNN();
      try{
        var _raw=localStorage.getItem(LS+'tacRNN_'+_kk);
        var _upd=parseInt(localStorage.getItem(LS+'tacRNN_upd_'+_kk)||'0')||0;
        if(_raw){
          var _arr=JSON.parse(_raw);
          if(_arr&&_arr.length===16){
            GOAP_RNN_STORE[_kk].w=new Float32Array(_arr);
            GOAP_RNN_UPDATES[_kk]=_upd;
          }
        }
      }catch(_e){}
    }
  }
}

function saveGOAPStore(){
  try{
    for(var _i=0;_i<GOAP_RNN_ROLES.length;_i++){
      for(var _t=0;_t<NN_TEAMS.length;_t++){
        var _kk=wk(GOAP_RNN_ROLES[_i],NN_TEAMS[_t]);
        if(!GOAP_RNN_STORE[_kk])continue;
        localStorage.setItem(LS+'tacRNN_'+_kk,JSON.stringify(Array.from(GOAP_RNN_STORE[_kk].w)));
        localStorage.setItem(LS+'tacRNN_upd_'+_kk,GOAP_RNN_UPDATES[_kk]||0);
      }
    }
  }catch(_e){}
}

// Reset COMPLET du "cerveau" : NN principal + couche GOAP RNN (mémoire ET localStorage)
// + cerveaux des agents vivants + re-seed du RNG. Repart d'une IA vierge — utile pour
// une comparaison A/B propre (sinon l'historique appris persiste entre parties).
function resetBrain(){
  try{ NN.reset() }catch(_e){}                         // NN principal : poids+updates+tacNN_*
  for(var _bi=0;_bi<GOAP_RNN_ROLES.length;_bi++){
    for(var _bt=0;_bt<NN_TEAMS.length;_bt++){
      var _br=wk(GOAP_RNN_ROLES[_bi],NN_TEAMS[_bt]);
      // Résidus Adam (moments + baseline) que NN.reset ne purge pas du storage
      try{localStorage.removeItem(LS+'tacNN_m_'+_br);localStorage.removeItem(LS+'tacNN_v_'+_br);localStorage.removeItem(LS+'tacNN_bl_'+_br)}catch(_e){}
      // Couche GOAP RNN : store mémoire + localStorage
      try{GOAP_RNN_STORE[_br]=new MiniRNN();GOAP_RNN_UPDATES[_br]=0;localStorage.removeItem(LS+'tacRNN_'+_br);localStorage.removeItem(LS+'tacRNN_upd_'+_br)}catch(_e){}
    }
  }
  // Cerveaux des agents vivants : forcer un respawn depuis le store vierge
  try{[simA,simB].forEach(function(s){if(s&&s.agents)s.agents.forEach(function(a){a._goap=null})})}catch(_e){}
  // Re-seed du RNG NN/RNN (déterminisme)
  try{_nnRng=mulberry32(((simA&&simA.seed)>>>0)||1)}catch(_e){}
  // Feedback visuel
  try{var _el=document.getElementById('nnSaveStatus');if(_el)_el.textContent='cerveau réinitialisé'}catch(_e){}
  var _tb=document.getElementById('tbr-nn');if(_tb){_tb.textContent='IA RESET';_tb.style.color='#aa5533';setTimeout(function(){_tb.style.color='#2a4422'},1500)}
}

// ── MÉTRIQUES : mesurer l'apport réel de l'IA (win-rate / durée / kills) ──────
// GOAP par équipe pour un A/B test PROPRE : le mode 'A-ONLY' donne GOAP à ALPHA seulement.
// En match symétrique (mêmes styles), un win-rate ALPHA > 50% mesure DIRECTEMENT l'apport de
// GOAP, tout le reste étant identique. Modes cyclés : BOTH → A-ONLY → OFF.
var GOAP_TEAM = [true,true];   // [ALPHA, BRAVO]
var _goapMode = 0;             // 0=BOTH 1=A-ONLY 2=B-ONLY 3=OFF
var METRICS = {games:0,winA:0,winB:0,draw:0,durSum:0,killSum:0,sA:'',sB:''};
function _loadMetrics(){try{var r=localStorage.getItem('tacMetrics');if(r){var m=JSON.parse(r);for(var k in METRICS)if(m[k]!==undefined)METRICS[k]=m[k]}}catch(e){}}
function _saveMetrics(){try{localStorage.setItem('tacMetrics',JSON.stringify(METRICS))}catch(e){}}
function recordGame(sim){
  if(!sim)return;
  METRICS.games++;
  if(sim.winner===0)METRICS.winA++; else if(sim.winner===1)METRICS.winB++; else METRICS.draw++;
  METRICS.durSum+=sim.frame||0;
  METRICS.killSum+=sim.killCount?((sim.killCount[0]||0)+(sim.killCount[1]||0)):0;
  METRICS.sA=(CFG.teamStyle&&CFG.teamStyle[0])||'trained';
  METRICS.sB=(CFG.teamStyle&&CFG.teamStyle[1])||'trained';
  _saveMetrics(); renderMetrics();
}
function resetMetrics(){METRICS={games:0,winA:0,winB:0,draw:0,durSum:0,killSum:0,sA:'',sB:''};_saveMetrics();renderMetrics()}
function renderMetrics(){
  var el=document.getElementById('metricsBody'); if(!el)return;
  var g=METRICS.games||0, pct=function(n){return g?Math.round(n/g*100):0};
  var secs=g?Math.round(METRICS.durSum/g/60):0, mm=Math.floor(secs/60), ss=('0'+(secs%60)).slice(-2);
  var avgK=g?(METRICS.killSum/g).toFixed(1):'0';
  var _gu=0; try{for(var _gr=0;_gr<GOAP_RNN_ROLES.length;_gr++)for(var _gt=0;_gt<NN_TEAMS.length;_gt++)_gu+=GOAP_RNN_UPDATES[wk(GOAP_RNN_ROLES[_gr],NN_TEAMS[_gt])]||0}catch(_e){}
  var _gstate=_gu<100?'VIERGE':_gu<1000?'JEUNE':_gu<3000?'EN COURS':'MÛR';
  var _gcol=_gu<100?'#aa5533':_gu<1000?'#ffaa44':'#44aa66';
  var row=function(lbl,val,col){return '<div style="display:flex;justify-content:space-between"><span>'+lbl+'</span><span style="color:'+col+'">'+val+'</span></div>'};
  el.innerHTML=
    row('PARTIES',g,'#8899aa')+
    row('ALPHA ('+(METRICS.sA||'?')+')',METRICS.winA+' · '+pct(METRICS.winA)+'%','#44aaff')+
    row('BRAVO ('+(METRICS.sB||'?')+')',METRICS.winB+' · '+pct(METRICS.winB)+'%','#ff8844')+
    row('NULS',METRICS.draw+' · '+pct(METRICS.draw)+'%','#667788')+
    row('DURÉE MOY',mm+':'+ss,'#8899aa')+
    row('KILLS MOY',avgK,'#8899aa')+
    row('GOAP CERVEAU',_gu+' · '+_gstate,_gcol);
}
function toggleGOAP(){
  _goapMode=(_goapMode+1)%4;
  GOAP_TEAM = _goapMode===0?[true,true] : _goapMode===1?[true,false] : _goapMode===2?[false,true] : [false,false];
  // purge les cerveaux des agents dont l'équipe n'a plus GOAP
  try{[simA,simB].forEach(function(s){if(s&&s.agents)s.agents.forEach(function(a){if(!GOAP_TEAM[a.team])a._goap=null})})}catch(e){}
  var b=document.getElementById('btnGoapToggle');
  var lbl=['GOAP: BOTH','GOAP: A-ONLY','GOAP: B-ONLY','GOAP: OFF'][_goapMode];
  var col=_goapMode===3?'#aa5533':(_goapMode===1||_goapMode===2)?'#ffaa44':'#44aa66';
  if(b){b.textContent=lbl;b.style.color=col;b.style.borderColor=_goapMode===3?'#432':'#234'}
}

// Mode debug : tape AI_DEBUG=true dans la console pour faire remonter les erreurs avalées
// par les try/catch de la couche d'apprentissage (sinon invisibles — c'est ce qui avait
// masqué la couche GOAP dormante pendant longtemps).
var AI_DEBUG=false;
function _aiDbg(e,where){ if(AI_DEBUG)console.warn('[AI:'+where+']',(e&&e.message)||e) }

// EMA merge: agent weights -> role store (10% agent, 90% store)
function mergeAgentRNN(a){
  if(!a||!a._goap||!a._goap.rnn||!a.rn)return;
  var _kk=wk(a.rn,a.team);
  var _store=GOAP_RNN_STORE[_kk];
  if(!_store)return;
  for(var _i=0;_i<16;_i++){
    _store.w[_i]=_store.w[_i]*0.9+a._goap.rnn.w[_i]*0.1;
  }
  GOAP_RNN_UPDATES[_kk]=(GOAP_RNN_UPDATES[_kk]||0)+1;
}

// Spawn agent RNN from role store + small noise for diversity
function spawnAgentRNN(a){
  if(!a||!a.rn||!a._goap)return;
  var _store=GOAP_RNN_STORE[wk(a.rn,a.team)];
  if(!_store)return;
  for(var _i=0;_i<16;_i++){
    a._goap.rnn.w[_i]=_store.w[_i]+(_nnRng()-0.5)*0.04;
  }
}

// Adaptive blend cap: grows from 5 to 15 as RNN matures (0->500 updates)
function goapBlendCap(rn,team){
  var _kk=wk(rn,team);
  var _upd=GOAP_RNN_UPDATES[_kk]||0;
  var _mat=Math.min(1,_upd/500);
  var _base=5+_mat*10;
  // Adam signal 1: gradNorm eleve = Adam instable = RNN recule
  var _gn=(NN&&NN.gradNorm&&NN.gradNorm[_kk])?NN.gradNorm[_kk]:1;
  var _adamF=Math.max(0.3,1-Math.min(1,_gn/2)*0.5);
  // Adam signal 2: lossEMA eleve = domaine volatil = prudence
  var _le=(NN&&NN.lossEMA&&NN.lossEMA[_kk])?NN.lossEMA[_kk]:1;
  var _lossF=Math.max(0.5,1-Math.min(1,_le/5)*0.3);
  return _base*_adamF*_lossF;
}

function ensureGOAP(a) {
  if(!a._goap) {
    a._goap = {
      goals: {survive:0,eliminate:0,support:0,position:0},
      rnn: new MiniRNN(),
      rnnOut: new Float32Array(4),
      lastU: {}
    };
    spawnAgentRNN(a);
  }
  return a._goap;
}

// External GOAP update loop (runs every 80ms via setInterval)
// Safe: never called from sim hot path
// goapExternalTick supprimé : code mort (jamais appelé) — la couche GOAP tourne via
// goapSyncTick/_goapSyncSim. Il portait en plus l'ancien bug window.simA.

var GOAP_GOALS = ['survive','eliminate','support','position'];
var GOAP_COLORS_HEX = [0xff4444, 0xff8800, 0x44aaff, 0x44ffaa];
var GOAP_ACT_NAMES = ['RETREAT','COVER','AIM','FIRE','ADVANCE','FLANK','SUPPRESS','DISPERSE'];

// ---- THREE.JS BRAIN VISUALIZER ----
var GOAP3D = null;
window.goapAgent = null;

function loadThreeAndInit() {
  if(typeof THREE !== 'undefined') { initGOAP3D(); return; }
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.min.js';
  s.onload = function(){ initGOAP3D(); };
  s.onerror = function(){ console.warn('[V33] THREE.js unavailable'); };
  document.head.appendChild(s);
}

function initGOAP3D() {
  if(typeof THREE === 'undefined') return;
  var container = document.getElementById('goap-3d-container');
  if(!container) return;
  var W=320, H=210;
  var scene    = new THREE.Scene();
  var camera   = new THREE.PerspectiveCamera(55, W/H, 0.1, 600);
  camera.position.set(0, 12, 135);
  var renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  var dL = new THREE.DirectionalLight(0xffffff, 0.35);
  dL.position.set(0,60,90); scene.add(dL);

  // Goal nodes (top row)
  var goalNodes = [];
  for(var gi=0;gi<4;gi++){
    var mesh = new THREE.Mesh(
      new THREE.SphereGeometry(6,14,14),
      new THREE.MeshPhongMaterial({color:GOAP_COLORS_HEX[gi],emissive:GOAP_COLORS_HEX[gi],emissiveIntensity:0.25})
    );
    mesh.position.set((gi-1.5)*44,62,0);
    scene.add(mesh);
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(7.5,9.5,24),
      new THREE.MeshBasicMaterial({color:GOAP_COLORS_HEX[gi],side:THREE.DoubleSide,transparent:true,opacity:0.2})
    );
    ring.position.copy(mesh.position);
    scene.add(ring);
    goalNodes.push({mesh:mesh,ring:ring});
  }

  // Action nodes (2 rows)
  var actionNodes = [];
  for(var ai=0;ai<8;ai++){
    var row=Math.floor(ai/4), col=ai%4;
    var amesh = new THREE.Mesh(
      new THREE.SphereGeometry(4,12,12),
      new THREE.MeshPhongMaterial({color:0x223355,emissive:0x0a1525,emissiveIntensity:0.4})
    );
    amesh.position.set((col-1.5)*40, 8-row*42, 0);
    scene.add(amesh);
    var gIdx = Math.floor(ai/2);
    var gPos = goalNodes[gIdx].mesh.position;
    var pts=[new THREE.Vector3(gPos.x,gPos.y,gPos.z), new THREE.Vector3(amesh.position.x,amesh.position.y,amesh.position.z)];
    var lMat = new THREE.LineBasicMaterial({color:0x0a1a2a,transparent:true,opacity:0.3});
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lMat));
    actionNodes.push({mesh:amesh,name:GOAP_ACT_NAMES[ai],lMat:lMat});
  }

  // RNN memory nodes (middle)
  var rnnNodes = [];
  for(var ri=0;ri<4;ri++){
    var rmesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.8,10,10),
      new THREE.MeshBasicMaterial({color:0x2a2a66,transparent:true,opacity:0.65})
    );
    rmesh.position.set((ri-1.5)*20,30,18);
    scene.add(rmesh);
    rnnNodes.push(rmesh);
  }

  GOAP3D = {scene:scene,camera:camera,renderer:renderer,goalNodes:goalNodes,actionNodes:actionNodes,rnnNodes:rnnNodes,rotY:0};

  (function animG(){
    requestAnimationFrame(animG);
    updateGOAP3D();
    GOAP3D.rotY += 0.004;
    scene.rotation.y = Math.sin(GOAP3D.rotY)*0.22;
    renderer.render(scene,camera);
  })();
}

function updateGOAP3D(){
  if(!GOAP3D) return;
  var panel = document.getElementById('goap-panel');
  if(!panel || panel.style.display==='none') return;
  var a = window.goapAgent;
  var t = Date.now()*0.001;

  if(!a || a.hp<=0){
    for(var i=0;i<GOAP3D.goalNodes.length;i++)
      GOAP3D.goalNodes[i].mesh.scale.setScalar(0.5+Math.sin(t*0.6+i*1.2)*0.15);
    var lbl=document.getElementById('goap-agent-lbl');
    if(lbl){lbl.textContent='-- CLICK AGENT --';lbl.style.color='#334455';}
    return;
  }

  var g = a._goap;
  if(!g) return;

  var lbl2=document.getElementById('goap-agent-lbl');
  if(lbl2){
    lbl2.textContent=a.rn+' T'+(a.team===0?'A':'B')+' HP:'+Math.round(a.hp/a.role.hp*100)+'%';
    lbl2.style.color=a.team===0?'#44aaff':'#ff5555';
  }

  // Goal nodes scale = goal score
  var scores=[g.goals.survive||0,g.goals.eliminate||0,g.goals.support||0,g.goals.position||0];
  var maxGi=0;
  for(var si=1;si<4;si++){if(scores[si]>scores[maxGi])maxGi=si;}
  for(var gi2=0;gi2<4;gi2++){
    GOAP3D.goalNodes[gi2].mesh.scale.setScalar(0.55+scores[gi2]*2.4);
    GOAP3D.goalNodes[gi2].mesh.material.emissiveIntensity=gi2===maxGi?0.85:0.18;
    GOAP3D.goalNodes[gi2].ring.material.opacity=gi2===maxGi?0.55:0.12;
  }

  // Action nodes from utility
  var u=g.lastU||{};
  var uMap=[u.retreat||0,u.retreat||0,u.engage||0,u.suppress||0,u.approach||0,u.hunt||0,u.suppress||0,u.disperse||0];
  var maxU=1;
  for(var ui=0;ui<uMap.length;ui++){if(uMap[ui]>maxU)maxU=uMap[ui];}
  var stMap={E:'AIM',S:'SUPPRESS',R:'RETREAT',A:'ADVANCE',F:'FLANK',AM:'COVER',D:'DISPERSE',H:'AIM',RV:'COVER',KO:'RETREAT'};
  var curAct=stMap[a.state]||'';
  for(var ai2=0;ai2<8;ai2++){
    GOAP3D.actionNodes[ai2].mesh.scale.setScalar(Math.max(0.35,0.45+uMap[ai2]/maxU*1.7));
    var isA=GOAP3D.actionNodes[ai2].name===curAct;
    GOAP3D.actionNodes[ai2].mesh.material.color.setHex(isA?(a.team===0?0x44aaff:0xff5555):0x223355);
    GOAP3D.actionNodes[ai2].mesh.material.emissiveIntensity=isA?0.75:0.25;
  }

  // RNN nodes
  var rnn=g.rnnOut||new Float32Array(4);
  for(var ri2=0;ri2<4;ri2++){
    GOAP3D.rnnNodes[ri2].scale.setScalar(Math.max(0.35,0.45+Math.abs(rnn[ri2]||0)*1.6));
    GOAP3D.rnnNodes[ri2].material.color.setHex((rnn[ri2]||0)>0?0x3344aa:0x441122);
  }

  // Info bar
  var gNames=['SURVIVE','ELIM','SUPPORT','POS'];
  var e1=document.getElementById('goap-goal-lbl');
  var e2=document.getElementById('goap-state-lbl');
  var e3=document.getElementById('goap-rnn-lbl');
  if(e1)e1.textContent='GOAL:'+gNames[maxGi]+'('+scores[maxGi].toFixed(2)+')';
  if(e2)e2.textContent='STATE:'+a.state;
  if(e3){
    var rStr='';
    for(var rvi=0;rvi<4;rvi++){rStr+=(rnn[rvi]||0).toFixed(2);if(rvi<3)rStr+=',';}
    var _kk2=wk(a.rn,a.team);
    var _upd2=(a.rn&&GOAP_RNN_UPDATES)?GOAP_RNN_UPDATES[_kk2]||0:0;
    var _mat2=Math.min(100,Math.round(_upd2/5));
    var _gn2=(NN&&NN.gradNorm&&a.rn)?Math.round((NN.gradNorm[_kk2]||0)*100)/100:0;
    var _cap2=(typeof goapBlendCap==="function")?Math.round(goapBlendCap(a.rn,a.team)*10)/10:0;
    var _lr2=Math.round(0.015*(1-Math.min(1,((NN&&NN.updates&&a.rn)?NN.updates[_kk2]:0)/2000)*0.7)*1000)/1000;
    e3.textContent='MAT:'+_mat2+'% CAP:+/-'+_cap2+' GN:'+_gn2+' LR:'+_lr2;
  }
}

// Synced GOAP tick -- called from NN.tick every 4 frames
// Automatically follows simSpeed (no setInterval desync)
function goapSyncTick(){
  try{
    // FIX compare : traiter les DEUX sims pour qu'elles profitent à égalité du GOAP+RNN.
    // NB : on utilise les variables lexicales (simA/simB/COMPARE), PAS window.simA — en
    // script classique un `let` top-level n'est pas sur window, donc l'ancien garde
    // `if(!window.simA)return` sortait toujours → la couche GOAP/RNN était dormante.
    _goapSyncSim(simA);
    if(COMPARE&&simB)_goapSyncSim(simB);
  }catch(_e){_aiDbg(_e,'sync')}
}
function _goapSyncSim(sim){
  if(!sim||!sim.agents)return;
  for(var _i=0;_i<sim.agents.length;_i++){
    var _a=sim.agents[_i];
    if(!_a||_a.hp<=0||_a.rn==="DRONE")continue;
    if(!GOAP_TEAM[_a.team]){if(_a._goap)_a._goap=null;continue;}   // GOAP désactivé pour cette équipe
    var _g=ensureGOAP(_a);
    _g.goals=computeGOAPGoals(_a,sim);
    var _gs=_g.goals;
    // Step 1: RNN input = GOAP goals uniquement (espace perceptuel coherent)
    _g.rnnOut=_g.rnn.forward([_gs.survive,_gs.eliminate,_gs.support,_gs.position]);
    // Step 2: NN hidden = gate multiplicatif sur output RNN
    // Adam apprend QUOI exprimer, RNN apprend LA DYNAMIQUE -- espaces separes
    // h[i] in [-1,1] -> sigmoid gate in [0.27, 0.73] -> rescale *2
    try{
      if(NN.weights&&NN.weights[wk(_a.rn,_a.team)]){
        var _fwd=NN.forward(_a.rn,NN.buildInput(_a,sim),_a.team);
        if(_fwd&&_fwd.h&&_fwd.h.length>=4){
          var _gated=new Float32Array(4);
          for(var _gi=0;_gi<4;_gi++){
            var _gate=1/(1+Math.exp(-_fwd.h[_gi]*2.0));
            _gated[_gi]=_g.rnnOut[_gi]*(_gate*2.0);
          }
          _g.rnnOut=_gated;
          _g.nnHidden=_fwd.h;
        }
      }
    }catch(_fe){}
    _g.lastRnnInp=[_gs.survive,_gs.eliminate,_gs.support,_gs.position];
    if(_a._lastUtility)_g.lastU=_a._lastUtility;
  }
}

// Hook NN events + NN.tick for RNN training and sync
function setupGOAPHooks(){
  // Init persistent RNN store from localStorage
  initGOAPStore();
  // Wrap NN.save to also persist RNN weights
  var _os2=NN.save.bind(NN);
  NN.save=function(){
    var _r=_os2();
    saveGOAPStore();
    return _r;
  };
  // onKill: strong positive reward for shooter RNN
  var _ok=NN.onKill.bind(NN);
  NN.onKill=function(shooter,sim){
    _ok(shooter,sim);
    try{
      if(shooter&&shooter._goap&&shooter._goap.rnn&&shooter._goap.goals){
        var _gs=shooter._goap.goals;
        shooter._goap.rnn.update(+3.0*rewScale(shooter.team),[_gs.survive,_gs.eliminate,_gs.support,_gs.position],shooter.rn,shooter.team);
        mergeAgentRNN(shooter);
      }
    }catch(_e){}
  };
  // onDeath: strong negative reward for victim RNN
  var _od=NN.onDeath.bind(NN);
  NN.onDeath=function(victim,sim){
    _od(victim,sim);
    try{
      if(victim&&victim._goap&&victim._goap.rnn&&victim._goap.goals){
        var _gs=victim._goap.goals;
        victim._goap.rnn.update(-4.0*rewScale(victim.team),[_gs.survive,_gs.eliminate,_gs.support,_gs.position],victim.rn,victim.team);
        mergeAgentRNN(victim);
      }
    }catch(_e){}
  };
  // onHit: small negative for victim RNN
  var _oh=NN.onHit.bind(NN);
  NN.onHit=function(victim,sim){
    _oh(victim,sim);
    try{
      if(victim&&victim._goap&&victim._goap.rnn&&victim._goap.goals){
        var _gs=victim._goap.goals;
        victim._goap.rnn.update(-0.8*rewScale(victim.team),[_gs.survive,_gs.eliminate,_gs.support,_gs.position],victim.rn,victim.team);
      }
    }catch(_e){}
  };
  // onSurvive: small positive for alive agent RNN
  var _os=NN.onSurvive.bind(NN);
  NN.onSurvive=function(a,sim){
    _os(a,sim);
    try{
      if(a&&a._goap&&a._goap.rnn&&a._goap.goals){
        var _gs=a._goap.goals;
        a._goap.rnn.update(+0.4*rewScale(a.team),[_gs.survive,_gs.eliminate,_gs.support,_gs.position],a.rn,a.team);
      }
    }catch(_e){}
  };
  // Wrap NN.tick: synced GOAP update every 4 sim frames
  var _ot=NN.tick.bind(NN);
  NN.tick=function(frameN){
    _ot(frameN);
    if(frameN%4===0)goapSyncTick();
  };
}

function setupGOAPInteraction(){
  var cv=document.getElementById('cvA');
  if(!cv)return;
  cv.addEventListener('click',function(e){
    if(!window.simA||!simA.agents)return;
    if(simA.state==='end')return;
    var rect=cv.getBoundingClientRect();
    var mx=(e.clientX-rect.left)/simA.scale;
    var my=(e.clientY-rect.top)/simA.scale;
    var best=null,bd=9999;
    for(var i=0;i<simA.agents.length;i++){
      var ag=simA.agents[i];
      if(!ag||ag.hp<=0||ag.rn==='DRONE')continue;
      var d=Math.hypot(ag.x-mx,ag.y-my);
      if(d<bd){bd=d;best=ag;}
    }
    if(best&&bd<10){
      window.goapAgent=best;
      var panel=document.getElementById('goap-panel');
      if(panel){panel.style.display='flex';}
      if(!GOAP3D)loadThreeAndInit();
    }
  });
  document.addEventListener('keydown',function(e){
    if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'))return;
    if(e.code==='KeyG'){
      var panel=document.getElementById('goap-panel');
      if(!panel)return;
      var vis=panel.style.display==='flex';
      if(!vis){
        panel.style.display='flex';
        if(!window.goapAgent||window.goapAgent.hp<=0){
          if(window.simA&&simA.agents){
            for(var i=0;i<simA.agents.length;i++){
              if(simA.agents[i].hp>0&&simA.agents[i].rn!=='DRONE'){window.goapAgent=simA.agents[i];break;}
            }
          }
        }
        if(!GOAP3D)loadThreeAndInit();
      } else {
        // Cycle agents
        if(window.simA&&simA.agents){
          var alive=simA.agents.filter(function(a){return a.hp>0&&a.rn!=='DRONE';});
          if(!alive.length)return;
          var idx=alive.indexOf(window.goapAgent);
          window.goapAgent=alive[(idx+1)%alive.length];
        }
      }
    }
  });
}

// ── DRAWING HELPERS ──────────────────────────────────────
function hexA(hex, a){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

function _bodyPath(scx, rn, k, offset){
  const o=offset||0
  if(rn==='SNIPER'){
    scx.moveTo(9*k+o,o); scx.lineTo(2*k+o,-2.5*k-o); scx.lineTo(-6*k-o,-3*k-o)
    scx.lineTo(-5*k-o,o); scx.lineTo(-6*k-o,3*k+o); scx.lineTo(2*k+o,2.5*k+o)
  } else if(rn==='SUPPORT'){
    scx.moveTo(5*k+o,0); scx.lineTo(1.5*k+o,-7*k-o); scx.lineTo(-5*k-o,-7*k-o)
    scx.lineTo(-6.5*k-o,0); scx.lineTo(-5*k-o,7*k+o); scx.lineTo(1.5*k+o,7*k+o)
  } else if(rn==='FLANKER'){
    scx.moveTo(8*k+o,0); scx.lineTo(1.5*k+o,-3.5*k-o); scx.lineTo(-5*k-o,-4.5*k-o)
    scx.lineTo(-4*k-o,0); scx.lineTo(-5*k-o,4.5*k+o); scx.lineTo(1.5*k+o,3.5*k+o)
  } else if(rn==='LEADER'){
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3-Math.PI/2, r=(6+o)*k
      i===0?scx.moveTo(Math.cos(a)*r*1.3,Math.sin(a)*r):scx.lineTo(Math.cos(a)*r*1.3,Math.sin(a)*r)
    }
  } else {  // ASSAULT
    scx.moveTo(8*k+o,0); scx.lineTo(0,-6*k-o); scx.lineTo(-6*k-o,-5.5*k-o)
    scx.lineTo(-4*k-o,0); scx.lineTo(-6*k-o,5.5*k+o); scx.lineTo(0,6*k+o)
  }
  scx.closePath()
}

function _bodyHighlight(scx, rn, k){
  if(rn==='SNIPER'){scx.moveTo(7*k,0);scx.lineTo(2*k,-2*k);scx.lineTo(-3*k,-2.5*k);scx.lineTo(-3*k,-1*k)}
  else if(rn==='SUPPORT'){scx.moveTo(4*k,0);scx.lineTo(1*k,-6*k);scx.lineTo(-4*k,-6*k);scx.lineTo(-5*k,-3*k)}
  else if(rn==='LEADER'){scx.moveTo(6*k*1.3,-1.5*k);scx.lineTo(2*k,-5.5*k);scx.lineTo(-1*k,-5.5*k);scx.lineTo(-3*k,-2*k)}
  else if(rn==='FLANKER'){scx.moveTo(7*k,0);scx.lineTo(1*k,-3*k);scx.lineTo(-4*k,-4*k);scx.lineTo(-3*k,0)}
  else{scx.moveTo(7*k,0);scx.lineTo(0,-5.5*k);scx.lineTo(-5*k,-5*k);scx.lineTo(-3*k,-1*k)}
  scx.closePath()
}
// ─────────────────────────────────────────────────────────

// SIM CLASS — full self-contained simulation instance
// ══════════════════════════════════════════════════════════
class Sim{
  constructor(cvId,mmId,ui){
    this.cv=document.getElementById(cvId)
    this.cx=this.cv.getContext('2d')
    this.mm=document.getElementById(mmId)
    this.mmx=this.mm.getContext('2d')
    this.ui=ui          // {a0,a1,ms,seedD,jamL,nightL,scoreEl,kcId}
    this.kcv=document.getElementById(ui.kcId)
    this._waveOffCv=document.createElement('canvas');this._waveOffCtx=this._waveOffCv.getContext('2d')
    this.kcx=this.kcv.getContext('2d')
    this.offCV=null; this.offCX=null
    this.seed=0; this.rng=Math.random
    this.MW=48; this.MH=30
    this.init()
  }

  init(){
    // Engine state
    this.agents=[]; this.bullets=[]; this.deaths=[]; this.parts=[]; this.tracers=[]
    this.frame=0; this.state='run'; this.winner=-1; this.sqCD=[0,0]
    this.score=[0,0]; this.killCount=[0,0]; this.alive=[0,0]
    this.centroid=[{x:0,y:0},{x:0,y:0}]
    this.khist=[[],[]]
    this.EC=[[],[]]
    this.MORAL=[{d:0},{d:0}]
    this.CMD=[null,null]
    this.FOCUS=[null,null]
    this.BB=[{x:0,y:0,frame:0,conf:0},{x:0,y:0,frame:0,conf:0}]
    this.ZONES=[]; this.FLAGS=[]
    this.hudCD=0; this.uidC=0
    // Flash effect on kill
    this.flashKill=[0,0]
    this.floats=[]
    this.journal=[]  // combat journal for ML
    this.journalMax=8000

    // Day/night
    this.dnCycle=0

    // Jamming
    this.jamActive=false; this.jamTimer=0; this.jamTeam=-1

    // Map
    this.map=[]; this.danger=[]; this.cov=[]; this.phero=null
  }

  // ── RESIZE ──────────────────────────────────────
  
  resize(){
    const ms = MAP_SIZES[CFG.mapSize]
    this.MW = ms.w
    this.MH = ms.h

    const worldW = this.MW * TILE
    const worldH = this.MH * TILE

    // Use CSS pixels only — avoids WebView vs Chrome DPR inconsistency
    // reservedH: toolbar 40 + HUD 38 + footer 22 + statpanel 46 + margins 10
    const reservedH = 156
    const availH = Math.max(160, window.innerHeight - reservedH)
    const vw = Math.min(window.innerWidth, document.documentElement.clientWidth)
    // Portrait COMPARE: stack vertically, each sim uses full width
    const portraitCompare = COMPARE && vw < 600
    const maxW = vw * (COMPARE && !portraitCompare ? 0.48 : 0.99)
    const scale = Math.min(maxW / worldW, availH / worldH)

    const displayW = Math.floor(worldW * scale)
    const displayH = Math.floor(worldH * scale)

    // Canvas dimensions = CSS pixels (no DPR multiplication)
    // Both Chrome and WebView will render at the same logical resolution
    this.cv.width  = displayW
    this.cv.height = displayH
    this.cv.style.width  = displayW + "px"
    this.cv.style.height = displayH + "px"
    this.cv.style.display = "block"
    this.cx.setTransform(1, 0, 0, 1, 0, 0)  // reset any previous transform

    this.scale = scale

    this.offCV = document.createElement('canvas')
    this.offCV.width = worldW
    this.offCV.height = worldH
    this.offCX = this.offCV.getContext('2d')

    this.sceneCV = document.createElement('canvas')
    this.sceneCV.width = worldW
    this.sceneCV.height = worldH
    this.sceneCX = this.sceneCV.getContext('2d')

    // FIX bug1 : resize() recrée offCV vide. Si une map existe déjà (resize en cours
    // de partie : rotation mobile, barre d'adresse, reflow polices), on la repeint —
    // sinon le terrain disparaît jusqu'au prochain restart. Garde : map encore vide au
    // tout premier reset() (genWorld() la peindra juste après).
    if(this.map && this.map.length===this.MH && this.offCX) this._renderOff()
  }


  // ── RESET / SPAWN ────────────────────────────────
  reset(seed){
    this.seed=seed||Math.floor(Math.random()*999999)
    this.rng=mulberry32(this.seed)
    this.resize()
    this.init()
    this.BB[0]={x:this.MW-3,y:Math.floor(this.MH/2),frame:0,conf:100}  // FIX E: full conf at start
    this.BB[1]={x:3,y:Math.floor(this.MH/2),frame:0,conf:100}
    this.dnCycle=0; this.jamActive=false; this.jamTimer=0; this.jamTeam=-1
    this.genWorld(); this.initFlags(); this.initZones()
    this._waveOffCv.width=this.MW;this._waveOffCv.height=this.MH;this._waveImgData=this._waveOffCtx.createImageData(this.MW,this.MH)
    const N=CFG.agentsPerTeam
    for(let team=0;team<2;team++){
      const sx=team===0?2.5:this.MW-2.5, dir=team===0?0:Math.PI
      // Asymmetric: team B = guerrilla composition
      const comp=(CFG.asymmetric&&team===1)?GUERRILLA_COMP:null
      const _baseComp=comp||RK
      const _totalN=N>=5?N+1:N  // +1 drone si N>=5
      for(let i=0;i<_totalN;i++){
        const _isDrone=N>=5&&i===N  // slot supplémentaire = drone
        const rn=_isDrone?'DRONE':(_baseComp[i%_baseComp.length]), role=getCR(rn)
        this.agents.push({
          uid:this.uidC++,x:sx,y:Math.min(this.MH-3.5,Math.max(2.5,2.5+i*(this.MH-5)/(_totalN>1?_totalN-1:1))),
          dir,team,hp:role.hp,rn,role,
          sCD:Math.floor(this.rng()*role.sCD),
          stCD:0,flCD:0,mzCD:0,supCD:0,pCD:0,
          pgx:-1,pgy:-1,path:[],lx:sx,ly:2.5,
          state:'A',ord:'A',sqTgt:null,pkPh:null,revived:false,koTimer:0,rvTarget:null,rvCD:0,_wpScdPenalty:0,_wpScdMult:1,_wpRelPenalty:0,_coverFrames:0,
          mag:role.mag,relCD:0,preRS:'A',
          sqMag:SIDEARM.mag,sqCD:0,sqActive:false,  // sidearm
          gCD:Math.floor(this.rng()*(role.grenadCD||1)),
          isCmd:false,cmdAura:false,
          lockTarget:null,lockAge:0,
          trail:[],
          // Velocity (for bullet lead prediction)
          vx:0,vy:0,prevX:0,prevY:0,
          // Combat metrics
          shotsFired:0,shotsHit:0,
          // Guérilla fields
          disperseCD:0,
          ambushPos:null,
          patience:0,
          smoke:{charges:rn==='FLANKER'?2:rn==='ASSAULT'?1:0,active:false,x:0,y:0,timer:0,cd:0},
          // Buddy pairing for fire-and-move
          buddyId:-1,buddyRole:'fire',
          plan:[],planFrame:0,planPhase:0,personality:0,
          withdrawalRoute:null,withdrawalWP:0,
          medkit:rn==='SUPPORT'?{charges:3,cd:0,range:4,power:30}:null
        })
      }
      for(const a of this.agents) a.personality=this.rng()
    }
    if(this.ui.seedD){const _sd=document.getElementById(this.ui.seedD);if(_sd)_sd.textContent='SEED '+this.seed}
    const _ts=document.getElementById('tbr-seed');if(_ts)_ts.textContent='SEED '+this.seed
    if(this.ui.ms){const _rm=document.getElementById(this.ui.ms);if(_rm)_rm.textContent='COMBAT IN PROGRESS'}
  }

  // ── WORLD GEN — Symétrique miroir, zones tactiques ──
  genWorld(){
    const {MW,MH}=this
    // Init
    for(let y=0;y<MH;y++){
      this.map[y]=[];this.danger[y]=[]
      for(let x=0;x<MW;x++){this.map[y][x]=0;this.danger[y][x]=0}
    }
    // Bordures
    for(let x=0;x<MW;x++){this.map[0][x]=1;this.map[MH-1][x]=1}
    for(let y=0;y<MH;y++){this.map[y][0]=1;this.map[y][MW-1]=1}

    // Générateur par zone — map divisée en 3 colonnes
    // Col gauche [1..HW-1], col droite [HW+1..MW-2] (miroir), col centre [HW-2..HW+2]
    const HW=Math.floor(MW/2)

    // ── Biome aléatoire parmi 5 ─────────────────────────
    const BIOMES=['urban','desert','forest','industrial','snow']
    this.biome=BIOMES[Math.floor(this.rng()*BIOMES.length)]

    if(this.biome==='urban'){
      this._genUrban(HW)
    } else if(this.biome==='desert'){
      this._genDesert(HW)
    } else if(this.biome==='forest'){
      this._genForest(HW)
    } else if(this.biome==='industrial'){
      this._genCompound(HW)
    } else {
      // SNOW: tranchées défensives
      this._genTrenches(HW)
    }

    // ── Cover scatter symétrique ──────────────────────
    // Zone spawn (proche bords): cover légère pour protection initiale
    for(let i=0;i<Math.floor(MH/3);i++){
      const y=2+Math.floor(this.rng()*(MH-4))
      const xL=2+Math.floor(this.rng()*Math.floor(MW*.18))
      const xR=MW-3-Math.floor(this.rng()*Math.floor(MW*.18))
      if(this.map[y][xL]===0)this.map[y][xL]=2
      if(this.map[y][xR]===0)this.map[y][xR]=2
    }
    // Zone centrale: cover dense
    const cx=HW,density=Math.floor(MW*MH/55)
    for(let i=0;i<density;i++){
      const x=Math.floor(MW*.2)+Math.floor(this.rng()*Math.floor(MW*.6))
      const y=2+Math.floor(this.rng()*(MH-4))
      if(this.map[y][x]===0){
        this.map[y][x]=2
        // Mirror
        const mx2=MW-1-x
        if(mx2>0&&mx2<MW-1&&this.map[y][mx2]===0)this.map[y][mx2]=2
      }
    }
    // Corridors horizontaux garantis (lignes de flanc)
    for(const ry of [.2,.5,.8].map(r=>Math.floor(MH*r))){
      if(ry<1||ry>=MH-1)continue
      for(let x=1;x<MW-1;x++)if(this.map[ry][x]===1)this.map[ry][x]=0
    }
    // Corridor vertical central garanti (traverse toutes les tranchées)
    const vcx=Math.floor(MW/2)
    for(let y=1;y<MH-1;y++){
      if(this.map[y][vcx]===1)this.map[y][vcx]=0
      if(this.map[y][vcx-1]===1)this.map[y][vcx-1]=0  // 2 tiles de large
    }

    this._fixConn()
    // Spawn safe zone: 4 tiles from each side MUST be walkable
    // Safe spawn zone: 5 tiles libres de chaque côté + 2 tiles haut/bas
    for(let y=1;y<this.MH-1;y++){
      for(let x=1;x<6;x++) this.map[y][x]=0
      for(let x=this.MW-6;x<this.MW-1;x++) this.map[y][x]=0
    }
    // Bords haut/bas sur toute la largeur des zones de spawn
    for(let x=1;x<6;x++){this.map[1][x]=0;this.map[this.MH-2][x]=0}
    for(let x=this.MW-6;x<this.MW-1;x++){this.map[1][x]=0;this.map[this.MH-2][x]=0}
    const _wSz=this.MW*this.MH
    this.wU=new Float32Array(_wSz)
    this.wP=new Float32Array(_wSz)
    this.wNxt=new Float32Array(_wSz)
    this.hmActivity=new Float32Array(_wSz)  // kills+tirs (chaud)
    this.hmPresence=new Float32Array(_wSz)  // présence agents (froid/chaud par équipe)
    this._buildCov(); this._renderOff()
    this.phero=[
      Array.from({length:MH},()=>new Float32Array(MW)),
      Array.from({length:MH},()=>new Float32Array(MW)),
    ]
  }

  // Archétype URBAN: grille de bâtiments
  _genUrban(HW){
    const {MW,MH}=this
    const cellW=Math.floor(HW/3),cellH=Math.floor(MH/3)
    // Grille 3×3 sur la moitié gauche, miroir sur droite
    for(let row=0;row<3;row++) for(let col=0;col<3;col++){
      if(this.rng()<.35)continue  // cellule vide 35% du temps
      const x1=Math.max(5,1+col*cellW+1), y1=1+row*cellH+1
      const x2=x1+Math.floor(cellW*.7+this.rng()*cellW*.2)
      const y2=y1+Math.floor(cellH*.7+this.rng()*cellH*.2)
      // Forme aléatoire: plein, U, L
      const shape=Math.floor(this.rng()*3)
      this._genShape(shape,x1,y1,Math.min(x2,HW-2),Math.min(y2,MH-2))
      // Miroir
      this._mirrorX(x1,y1,Math.min(x2,HW-2),Math.min(y2,MH-2),MW)
    }
    // Bloc central unique
    const bx=HW-3,by=Math.floor(MH*.35),bx2=HW+2,by2=Math.floor(MH*.65)
    this._genShape(0,bx,by,bx2,by2)
  }

  // Archétype TRENCHES: murs horizontaux décalés
  _genTrenches(HW){
    const {MW,MH}=this
    const nLines=2+Math.floor(this.rng()*2)  // 2-3 lignes (moins dense)
    for(let i=0;i<nLines;i++){
      const y=2+Math.floor((i+1)*(MH-4)/(nLines+1))
      const len=Math.floor(MW*.14+this.rng()*MW*.10)  // plus courts: 6-11 tiles
      const gap=Math.floor(MW*.14+this.rng()*MW*.08)  // gaps plus larges: 6-10 tiles
      // Tranchée côté gauche
      const startX=5+Math.floor(this.rng()*Math.max(1,HW-len-gap-6))
      for(let x=startX;x<startX+len&&x<HW;x++) this.map[y][x]=1
      // Deuxième tranchée décalée (couvre le gap)
      const startX2=startX+len+gap
      for(let x=startX2;x<startX2+len&&x<HW;x++) this.map[y][x]=1
      // Miroir
      this._mirrorRow(y,MW)
    }
    // Cover clusters entre les tranchées
    for(let i=0;i<Math.floor(MH/3);i++){
      const x=2+Math.floor(this.rng()*(HW-4))
      const y=2+Math.floor(this.rng()*(MH-4))
      if(this.map[y][x]===0){this.map[y][x]=2;if(this.map[y][MW-1-x]===0)this.map[y][MW-1-x]=2}
    }
  }

  // Archétype COMPOUND: structures fermées
  _genCompound(HW){
    const {MW,MH}=this
    // 2 compounds par côté
    for(let i=0;i<2;i++){
      const y1=2+Math.floor(i*(MH-4)/2)+1
      const y2=y1+Math.floor(MH*.25+this.rng()*MH*.1)
      const x1=5+Math.floor(this.rng()*Math.max(1,Math.floor(HW*.35)-3))
      const x2=x1+Math.floor(HW*.28+this.rng()*HW*.12)
      this._room2(x1,y1,Math.min(x2,HW-2),Math.min(y2,MH-2))
      this._mirrorX(x1,y1,Math.min(x2,HW-2),Math.min(y2,MH-2),MW)
    }
    // Structure centrale (symétrique)
    const cy1=Math.floor(MH*.3),cy2=Math.floor(MH*.7)
    const cx1=HW-Math.floor(HW*.25),cx2=HW+Math.floor(HW*.25)
    this._room2(cx1,cy1,cx2,cy2)
  }

  // Biome DESERT: ruines éparses, beaucoup d'espace ouvert
  _genDesert(HW){
    const {MW,MH}=this
    // 3-5 ruines isolées par côté (murs L ou I)
    const nRuins=3+Math.floor(this.rng()*3)
    for(let i=0;i<nRuins;i++){
      const y1=3+Math.floor(this.rng()*(MH-6))
      const x1=5+Math.floor(this.rng()*(HW-10))
      const w=2+Math.floor(this.rng()*4), h=2+Math.floor(this.rng()*3)
      const shape=Math.floor(this.rng()*3)
      this._genShape(shape,x1,y1,Math.min(x1+w,HW-2),Math.min(y1+h,MH-2))
      this._mirrorX(x1,y1,Math.min(x1+w,HW-2),Math.min(y1+h,MH-2),MW)
    }
    // Rochers isolés (1-tile murs épars)
    const nRocks=Math.floor(MH*.6)
    for(let i=0;i<nRocks;i++){
      const x=5+Math.floor(this.rng()*(HW-7))
      const y=2+Math.floor(this.rng()*(MH-4))
      if(this.map[y][x]===0&&this.map[y][MW-1-x]===0){
        if(this.rng()<.4){this.map[y][x]=1;this.map[y][MW-1-x]=1}
        else{this.map[y][x]=2;this.map[y][MW-1-x]=2}
      }
    }
  }

  // Biome FOREST: rochers organiques et arbres clusters
  _genForest(HW){
    const {MW,MH}=this
    // Clusters de "rochers/arbres" — groups organiques
    const nClusters=4+Math.floor(this.rng()*3)
    for(let c2=0;c2<nClusters;c2++){
      const cx2=5+Math.floor(this.rng()*(HW-10))
      const cy2=3+Math.floor(this.rng()*(MH-6))
      const r=2+Math.floor(this.rng()*3)  // rayon du cluster
      for(let dy=-r;dy<=r;dy++){
        for(let dx=-r;dx<=r;dx++){
          if(dx*dx+dy*dy>r*r*.8)continue  // forme ronde approximative
          const fx=cx2+dx, fy=cy2+dy
          if(fx<5||fx>=HW-2||fy<2||fy>=MH-2)continue
          if(this.map[fy][fx]!==0)continue
          if(this.rng()<.55){
            const t=this.rng()<.4?1:2  // 40% mur (tronc) 60% cover (buisson)
            this.map[fy][fx]=t
            if(fx<MW-5&&this.map[fy][MW-1-fx]===0)this.map[fy][MW-1-fx]=t
          }
        }
      }
    }
    // Sentiers sinueux (forcer des gaps)
    for(let i=0;i<3;i++){
      const pathY=Math.floor(MH*(.2+i*.3))
      for(let x=1;x<MW-1;x++){
        if(this.map[pathY][x]===1&&this.rng()<.7)this.map[pathY][x]=0
      }
    }
  }

  // Forme générique: 0=plein mur, 1=U, 2=L
  _genShape(shape,x1,y1,x2,y2){
    if(x2<=x1+1||y2<=y1+1)return
    if(shape===0){
      // Bloc plein (murs extérieurs + intérieur vide)
      this._room2(x1,y1,x2,y2)
    } else if(shape===1){
      // U ouvert vers la droite
      for(let y=y1;y<=y2;y++)this.map[y][x1]=1
      for(let x=x1;x<=x2;x++){this.map[y1][x]=1;this.map[y2][x]=1}
    } else {
      // L
      for(let y=y1;y<=y2;y++)this.map[y][x1]=1
      for(let x=x1;x<=x2;x++)this.map[y1][x]=1
    }
  }

  _room2(x1,y1,x2,y2){
    const {MW,MH}=this
    x1=Math.max(1,x1);y1=Math.max(1,y1);x2=Math.min(MW-2,x2);y2=Math.min(MH-2,y2)
    if(x2<=x1||y2<=y1)return
    for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++)
      this.map[y][x]=(x===x1||x===x2||y===y1||y===y2)?1:0
    // Portes
    const mx=x1+Math.floor((x2-x1)/2),my=y1+Math.floor((y2-y1)/2)
    this.map[my][x1]=0;this.map[my][x2]=0;this.map[y1][mx]=0;this.map[y2][mx]=0
  }

  // Miroir X: copie une zone sur la droite (MW-1-x)
  _mirrorX(x1,y1,x2,y2,MW){
    for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++){
      const mx=MW-1-x
      if(mx>0&&mx<MW-1)this.map[y][mx]=this.map[y][x]
    }
  }
  // Miroir ligne Y
  _mirrorRow(y,MW){
    for(let x=1;x<MW-1;x++){
      const mx=MW-1-x
      if(this.map[y][x]===1&&this.map[y][mx]===0)this.map[y][mx]=1
    }
  }

  _room(x1,y1,x2,y2){this._room2(x1,y1,x2,y2)}

  _fixConn(){
    const {MW,MH}=this
    const vis=Array.from({length:MH},()=>new Uint8Array(MW))
    const q=[[1,1]];vis[1][1]=1;let h=0
    while(h<q.length){
      const [cx,cy]=q[h++]
      for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){
        const nx=cx+dx,ny=cy+dy
        if(nx<0||ny<0||nx>=MW||ny>=MH||vis[ny][nx])continue
        if(this.map[ny][nx]!==1){vis[ny][nx]=1;q.push([nx,ny])}
      }
    }
    for(let y=1;y<MH-1;y++) for(let x=1;x<MW-1;x++){
      if(this.map[y][x]===1||vis[y][x])continue
      let cx=x;while(cx>1){if(this.map[y][cx]===1)this.map[y][cx]=0;cx--}
      let cy=y;while(cy>1){if(this.map[cy][1]===1)this.map[cy][1]=0;cy--}
    }
  }

  _buildCov(){
    this.cov=[]
    for(let y=1;y<this.MH-1;y++) for(let x=1;x<this.MW-1;x++)
      if(this.map[y][x]===2) this.cov.push({x,y})
    // Conscience carte : champ de proximité à la couverture (BFS multi-source, plafonné).
    // coverField[y][x] = distance à la couverture la plus proche (0 = couvert, élevé = découvert).
    const MW=this.MW,MH=this.MH,CAP=8
    const cf=new Array(MH); for(let y=0;y<MH;y++)cf[y]=new Int8Array(MW).fill(CAP)
    const q=[]; for(const c of this.cov){cf[c.y][c.x]=0;q.push(c.x,c.y)}
    let head=0
    while(head<q.length){
      const x=q[head++],y=q[head++],nd=cf[y][x]+1
      if(nd>CAP)continue
      for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy
        if(nx<0||ny<0||nx>=MW||ny>=MH||this.map[ny][nx]===1)continue
        if(cf[ny][nx]>nd){cf[ny][nx]=nd;q.push(nx,ny)}
      }
    }
    this.coverField=cf
  }

  _renderOff(){
    const {MW,MH,offCX:cx}=this
    if(!cx)return
    const b=this.biome||'urban'
    const n=(x,y,m,r)=>((x*7+y*13+this.seed%97)%r)  // pseudo-noise

    // ── PALETTE PAR BIOME ────────────────────────────────
    const P={
      urban:    {s1:[9,10,12],  s2:[11,12,14], wall:[26,28,34], wallH:[30,33,40], cov:[14,22,10], covH:[22,38,16], grid:'rgba(255,255,255,0.018)', wCrk:'rgba(0,0,0,0.25)'},
      desert:   {s1:[22,16,8],  s2:[26,20,10], wall:[60,45,25], wallH:[68,52,30], cov:[45,35,20], covH:[55,44,26], grid:'rgba(255,220,140,0.015)',  wCrk:'rgba(180,130,60,0.35)'},
      forest:   {s1:[6,12,6],   s2:[8,15,7],   wall:[12,28,10], wallH:[16,36,13], cov:[18,42,14], covH:[24,52,18], grid:'rgba(80,160,80,0.015)',    wCrk:'rgba(20,60,15,0.3)'},
      industrial:{s1:[10,8,6],  s2:[13,10,8],  wall:[32,22,14], wallH:[40,28,18], cov:[55,32,10], covH:[65,40,14], grid:'rgba(200,120,50,0.018)',   wCrk:'rgba(120,60,20,0.35)'},
      snow:     {s1:[18,22,28], s2:[22,27,34], wall:[42,50,62], wallH:[50,58,72], cov:[30,45,58], covH:[38,54,68], grid:'rgba(180,220,255,0.022)',   wCrk:'rgba(120,160,200,0.2)'},
    }[b]||{s1:[9,10,12],s2:[11,12,14],wall:[26,28,34],wallH:[30,33,40],cov:[14,22,10],covH:[22,38,16],grid:'rgba(255,255,255,0.018)',wCrk:'rgba(0,0,0,0.25)'}

    // ── SOL ──────────────────────────────────────────────
    for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){
      const h=n(x,y,0,8), dark=(x+y)%2===0
      const [r,g,bv]=dark?P.s1:P.s2
      cx.fillStyle=`rgb(${r+h%3},${g+h%2},${bv+h%4})`
      cx.fillRect(x*TILE,y*TILE,TILE,TILE)
    }
    // Grille
    cx.strokeStyle=P.grid; cx.lineWidth=.5
    for(let x=0;x<=MW;x++){cx.beginPath();cx.moveTo(x*TILE,0);cx.lineTo(x*TILE,MH*TILE);cx.stroke()}
    for(let y=0;y<=MH;y++){cx.beginPath();cx.moveTo(0,y*TILE);cx.lineTo(MW*TILE,y*TILE);cx.stroke()}

    // ── TUILES ───────────────────────────────────────────
    for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){
      const t=this.map[y][x], px=x*TILE, py=y*TILE
      if(t===1){
        const ns=n(x,y,0,6)
        const [wr,wg,wb]=P.wall, [hr,hg,hb]=P.wallH
        // Base mur
        cx.fillStyle=`rgb(${wr+ns},${wg+ns},${wb+ns})`;cx.fillRect(px,py,TILE,TILE)
        // Bevel clair haut-gauche
        cx.fillStyle='rgba(255,255,255,0.06)';cx.fillRect(px,py,TILE,2)
        cx.fillStyle='rgba(255,255,255,0.04)';cx.fillRect(px,py,2,TILE)
        // Ombre bas-droite
        cx.fillStyle='rgba(0,0,0,0.35)';cx.fillRect(px,py+TILE-2,TILE,2)
        cx.fillStyle='rgba(0,0,0,0.25)';cx.fillRect(px+TILE-2,py,2,TILE)
        // Centre
        cx.fillStyle=`rgb(${hr+ns},${hg+ns},${hb+ns})`;cx.fillRect(px+2,py+2,TILE-4,TILE-4)
        // Détail spécifique biome
        if((x+y*MW+this.seed)%7===0){
          cx.strokeStyle=P.wCrk; cx.lineWidth=.8
          if(b==='snow'){
            // Flocon / craquelure glace
            cx.beginPath();cx.moveTo(px+4,py+4);cx.lineTo(px+TILE-4,py+TILE-4);cx.stroke()
            cx.beginPath();cx.moveTo(px+TILE-4,py+4);cx.lineTo(px+4,py+TILE-4);cx.stroke()
          } else if(b==='industrial'){
            // Rivet (cercle)
            cx.beginPath();cx.arc(px+TILE*.5,py+TILE*.5,1.5,0,Math.PI*2);cx.stroke()
          } else {
            cx.beginPath();cx.moveTo(px+3,py+3);cx.lineTo(px+TILE-3,py+TILE-3);cx.stroke()
          }
        }
      } else if(t===2){
        const ns=n(x,y,0,5)
        const [cr,cg,cb]=P.cov, [hr,hg,hb]=P.covH
        // Base cover
        cx.fillStyle=`rgb(${cr+ns},${cg+ns},${cb+ns})`;cx.fillRect(px,py,TILE,TILE)
        // Corps surélevé
        cx.fillStyle=`rgb(${hr+ns},${hg+ns},${hb+ns})`;cx.fillRect(px+1,py+1,TILE-2,TILE-3)
        // Highlight top
        cx.fillStyle='rgba(255,255,255,0.07)';cx.fillRect(px+2,py+2,TILE-4,2)
        // Ombre
        cx.fillStyle='rgba(0,0,0,0.4)';cx.fillRect(px+1,py+TILE-3,TILE-2,2)
        // Texture spécifique
        if(b==='snow'){
          // Petits points blancs = neige sur la cover
          cx.fillStyle='rgba(220,235,255,0.3)'
          for(let i=0;i<3;i++)cx.fillRect(px+3+i*4,py+3,2,1)
        } else if(b==='industrial'){
          // Bandes diagonales = tonneau/bidon
          cx.fillStyle='rgba(0,0,0,0.15)'
          for(let sy=2;sy<TILE-2;sy+=3)cx.fillRect(px+2,py+sy,TILE-4,1)
          // Cercle couvercle
          cx.strokeStyle='rgba(0,0,0,0.2)';cx.lineWidth=.8
          cx.beginPath();cx.arc(px+TILE/2,py+TILE/2,TILE/2-2,0,Math.PI*2);cx.stroke()
        } else if(b==='forest'){
          // Texture buisson: points verts
          cx.fillStyle='rgba(50,100,20,0.25)'
          cx.beginPath();cx.arc(px+TILE/2,py+TILE/2,TILE/2-1,0,Math.PI*2);cx.fill()
        } else if(b==='desert'){
          // Sac de sable: segments
          cx.fillStyle='rgba(120,90,40,0.2)'
          cx.beginPath();cx.ellipse(px+TILE/2,py+TILE/2,TILE/2-2,TILE/3,0,0,Math.PI*2);cx.fill()
        } else {
          // Urban: sacs de sable rayures
          cx.fillStyle='rgba(0,0,0,0.12)'
          for(let sy=3;sy<TILE-2;sy+=3)cx.fillRect(px+2,py+sy,TILE-4,1)
        }
      }
    }
  }

  pass(tx,ty){return tx>=0&&ty>=0&&tx<this.MW&&ty<this.MH&&this.map[ty][tx]!==1}

  initFlags(){
    this.FLAGS=[]
    if(CFG.mode!=='flag')return
    this.FLAGS=[{team:0,x:3,y:Math.floor(this.MH/2),prog:0},{team:1,x:this.MW-4,y:Math.floor(this.MH/2),prog:0}]
  }

  initZones(){
    this.ZONES=[]
    if(CFG.mode!=='zones')return
    for(const d of [{x:this.MW*.5,y:this.MH*.5,r:3.0,name:'C'},{x:this.MW*.25,y:this.MH*.5,r:2.5,name:'A'},{x:this.MW*.75,y:this.MH*.5,r:2.5,name:'B'}])
      this.ZONES.push({...d,ctrl:-1,prog:[0,0]})
  }

  // ── A* ──────────────────────────────────────────
  findPath(sx,sy,gx,gy){
    sx=Math.floor(sx);sy=Math.floor(sy);gx=Math.floor(gx);gy=Math.floor(gy)
    if(!this.pass(gx,gy)){const a=this._np(gx,gy);if(!a)return[];gx=a[0];gy=a[1]}
    if(!this.pass(sx,sy)){const a=this._np(sx,sy);if(!a)return[];sx=a[0];sy=a[1]}
    if(sx===gx&&sy===gy)return[]
    const K=(x,y)=>y*this.MW+x,gk=K(gx,gy)
    const gs=new Map(),cf=new Map(),open=[]
    // MinHeap pour open list — O(log n) au lieu de O(n log n)
    const heap={d:[],push(n){this.d.push(n);this._up(this.d.length-1)},
      pop(){const t=this.d[0];const l=this.d.pop();if(this.d.length){this.d[0]=l;this._dn(0)}return t},
      get length(){return this.d.length},
      _up(i){while(i>0){const p=(i-1)>>1;if(this.d[p].f<=this.d[i].f)break;[this.d[p],this.d[i]]=[this.d[i],this.d[p]];i=p}},
      _dn(i){const n=this.d.length;while(true){let s=i,l=2*i+1,r=2*i+2;if(l<n&&this.d[l].f<this.d[s].f)s=l;if(r<n&&this.d[r].f<this.d[s].f)s=r;if(s===i)break;[this.d[s],this.d[i]]=[this.d[i],this.d[s]];i=s}}
    }
    const push=(n)=>heap.push(n)
    // FLAT heuristic (reverted from toroidal): raw Euclidean to the goal on a bounded grid.
    gs.set(K(sx,sy),0);push({x:sx,y:sy,f:Math.hypot(gx-sx,gy-sy)})
    let it=0
    while(heap.length>0&&it++<3500){
      const c=heap.pop(),ck=K(c.x,c.y)
      if(ck===gk){
        const p=[{x:c.x,y:c.y}];let k=ck
        while(cf.has(k)){const q=cf.get(k);p.unshift(q);k=K(q.x,q.y)}
        p.shift();return this._smooth(p)
      }
      for(const [dx,dy,dc] of [[0,-1,1],[0,1,1],[-1,0,1],[1,0,1],[-1,-1,1.41],[1,-1,1.41],[-1,1,1.41],[1,1,1.41]]){
        const nx=c.x+dx,ny=c.y+dy
        if(!this.pass(nx,ny))continue
        if(dc>1&&(!this.pass(c.x+dx,c.y)||!this.pass(c.x,c.y+dy)))continue
        const _dc3=this.danger[ny][nx]||0
        let cost=dc*(this.map[ny][nx]===2?1.5:1)+Math.min(isFinite(_dc3)?_dc3*.05:0,1.5)
        // GAP-1: route AROUND apex/brute footprints (soft, not hard-walled — mobs move)
        if(this._mobSoft&&this._mobSoft[ny*this.MW+nx])cost+=6
        const _bb=this._pathBB
        if(_bb&&_bb.conf>25&&this._pathHasCover){
          const _dbe=Math.hypot(nx-_bb.x,ny-_bb.y)
          if(_dbe<8)cost+=_dbe<4?0.7:_dbe<6?0.35:0.1
        }
        if(this._pathEnemies){
          for(const _pe of this._pathEnemies){
            const _dpe=Math.hypot(nx-_pe.x,ny-_pe.y)
            if(_dpe<12){
              const _angT=Math.atan2(ny-_pe.y,nx-_pe.x)
              const _fovD=this._ad(_pe.dir,_angT)
              const _fovFrac=_fovD/Math.max(0.1,(_pe.role?.fov||Math.PI))
              if(_fovFrac<0.5){
                // Dans le cône: pénalité très forte = A* DOIT contourner
                const _fovMul=1-_fovFrac*2  // 1.0 au centre, 0.0 au bord du cône
                cost+=(_dpe<4?4.5:_dpe<7?2.8:_dpe<10?1.5:0.4)*_fovMul
              }
            }
          }
        }
        const ng=(gs.get(ck)||0)+cost,nk=K(nx,ny)
        if(!gs.has(nk)||ng<gs.get(nk)){
          gs.set(nk,ng);cf.set(nk,{x:c.x,y:c.y})
          push({x:nx,y:ny,f:ng+Math.hypot(gx-nx,gy-ny)})
        }
      }
    }
    return[]
  }

  _np(x,y){
    for(let r=1;r<6;r++) for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++)
      if(this.pass(x+dx,y+dy))return[x+dx,y+dy]
    return null
  }

  _smooth(p){
    if(p.length<3)return p
    const o=[p[0]]
    for(let i=1;i<p.length-1;i++){
      const a=o[o.length-1],b=p[i],c=p[i+1]
      if((b.x-a.x)!==(c.x-b.x)||(b.y-a.y)!==(c.y-b.y))o.push(b)
    }
    if(p.length)o.push(p[p.length-1])
    return o
  }

  // ── UTILS ────────────────────────────────────────
  _na(a){return((a%(Math.PI*2))+(Math.PI*2))%(Math.PI*2)}
  _ad(a,b){const d=this._na(a-b);return d>Math.PI?Math.PI*2-d:d}
  // ── TORUS HELPERS (DEPRECATED / UNUSED) ──────────────────────────────────
  // The toroidal retrofit was REVERTED: the advisor now reasons on a plain bounded
  // grid (its original, proven behavior). These helpers are kept defined but unused.
  // shortest wrapped delta a→b on an axis of modulus m
  _txd(a,b){let d=b-a;const m=this.MW;if(d>m*.5)d-=m;else if(d<-m*.5)d+=m;return d}
  _tyd(a,b){let d=b-a;const m=this.MH;if(d>m*.5)d-=m;else if(d<-m*.5)d+=m;return d}
  // wrapped euclidean distance between two points
  _tdist(ax,ay,bx,by){const dx=this._txd(ax,bx),dy=this._tyd(ay,by);return Math.hypot(dx,dy)}
  // wrapped bearing FROM (ax,ay) TO (bx,by) — short way across the torus seam
  _tbrg(ax,ay,bx,by){return Math.atan2(this._tyd(ay,by),this._txd(ax,bx))}
  _sDir(a,td,r=.14){const diff=((td-a.dir+Math.PI*3)%(Math.PI*2))-Math.PI;a.dir+=diff*r}

  // ── MOB PERCEPTION (GAP-1) ───────────────────────────────────────────────
  // Stamp dynamic creature threats as soft danger + soft path-obstacles each call.
  // CHEAP: clears ONLY the cells stamped last call, then stamps a small toroidal
  // neighborhood around each DANGEROUS mob. No O(mobs×grid) writes, no per-call
  // large allocations (buffers reused). Apex(sp2)/Brute(sp4) = high threat.
  _stampMobs(mobs){
    const MW=this.MW,MH=this.MH,N=MW*MH
    if(!this._mobDng||this._mobDng.length!==N){this._mobDng=new Float32Array(N);this._mobCells=[]}
    const md=this._mobDng,mc=this._mobCells,dgr=this.danger
    // 1) clear last call's footprint (and the soft-obstacle marks we set on the map).
    //    Subtract last call's value back out of this.danger so we never accumulate.
    for(let i=0;i<mc.length;i++){const k=mc[i],y=(k/MW)|0,x=k-y*MW
      if(dgr&&dgr[y]){const nv=dgr[y][x]-md[k];dgr[y][x]=nv>0?nv:0}
      md[k]=0; if(this._mobSoft&&this._mobSoft[k])this._mobSoft[k]=0}
    mc.length=0
    if(!mobs||!mobs.length)return
    if(!this._mobSoft||this._mobSoft.length!==N)this._mobSoft=new Uint8Array(N)
    for(let m=0;m<mobs.length;m++){
      const mob=mobs[m]; if(!mob)continue
      const sp=mob.sp|0
      if(sp===0)continue                       // grazer: harmless, ignore
      // threat weight: apex/brute HIGH, hunter medium, swarm low
      const hi=(sp===2||sp===4)
      const peak=hi?42:(sp===1?16:8)           // peak danger value (danger caps at 50)
      const mr=(mob.r||0.4)                     // footprint radius (tiles)
      const buf=hi?3.0:1.5                      // awareness buffer around footprint
      const reach=mr+buf
      const cx=mob.x,cy=mob.y
      const R=Math.ceil(reach)
      const cxi=Math.floor(cx),cyi=Math.floor(cy)
      for(let dy=-R;dy<=R;dy++){
        const ty=cyi+dy
        if(ty<0||ty>=MH)continue
        for(let dx=-R;dx<=R;dx++){
          // FLAT distance from this cell-center to the mob center (reverted from toroidal)
          const wx=(cxi+dx+0.5)-cx,wy=(cyi+dy+0.5)-cy
          const dist=Math.hypot(wx,wy)
          if(dist>reach)continue
          const tx=cxi+dx
          if(tx<0||tx>=MW)continue
          const k=ty*MW+tx
          // linear falloff from peak at center to 0 at reach; keep the max over mobs
          const v=peak*(1-dist/reach)
          if(md[k]===0)mc.push(k)        // first touch this call → record for clearing
          if(v>md[k])md[k]=v
          // mark tiles under the footprint as SOFT obstacles for pathing (apex/brute)
          if(hi&&dist<=mr+0.5)this._mobSoft[k]=1
        }
      }
    }
    // Add this call's mob danger into this.danger NOW so the SAME frame's AI tick
    // (which reads this.danger before the wave-field recompute) reacts to mobs.
    // update() re-adds the overlay after the recompute so it survives the rebuild.
    if(dgr)for(let i=0;i<mc.length;i++){const k=mc[i],y=(k/MW)|0,x=k-y*MW
      if(dgr[y]){const nv=dgr[y][x]+md[k];dgr[y][x]=nv>50?50:nv}}
  }

  _rc(x1,y1,x2,y2,pc=false){
    // FLAT raycast (reverted from toroidal): march straight along the raw delta.
    const MW=this.MW,MH=this.MH
    const dx=x2-x1,dy=y2-y1,st=Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))*3)
    if(!st)return true
    for(let i=1;i<st;i++){
      const t=i/st
      const tx=Math.floor(x1+dx*t),ty=Math.floor(y1+dy*t)
      if(tx<0||ty<0||tx>=MW||ty>=MH)return false
      const tile=this.map[ty][tx]
      if(tile===1)return false
      if(tile===2&&!pc)return false
    }
    return true
  }

  _canSee(a,b){
    // FLAT (reverted from toroidal): raw delta on the bounded grid.
    const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)
    const fm=this._fovMult(a.rn)
    // Night reduces FOV angle but NOT detection range
    // (agents can hear footsteps, detect movement)
    if(dist>a.role.rng)return false
    if(this._ad(Math.atan2(dy,dx),a.dir)>a.role.fov*fm)return false
    if(this._anySmoke){            // la fumée bloque la vision de TOUT LE MONDE (LOS coupée)
      const _steps=Math.max(2,Math.ceil(dist/2))
      for(let _s=1;_s<_steps;_s++){const _t=_s/_steps;if(this._isInSmoke(a.x+dx*_t,a.y+dy*_t))return false}
    }
    return this._rc(a.x,a.y,b.x,b.y,a.rn==='SNIPER')
  }

  _fovMult(rn){
    return 1  // jour/nuit supprimé
    if(!CFG.dayNight)return 1
    const nr=this.dnCycle>CFG.dayLen?(this.dnCycle-CFG.dayLen)/CFG.nightLen:0
    if(nr<0.15)return 1
    return rn==='SNIPER'?0.75:0.70
  }

  _stepTo(a,tx,ty,spd,enemy=null){
    const dx=tx-a.x,dy=ty-a.y,d=Math.hypot(dx,dy)
    if(d<.05)return true
    let moveSpd=spd
    if(enemy){
      const toEnemy=Math.atan2(enemy.y-a.y,enemy.x-a.x)
      const dEnemy=Math.hypot(enemy.x-a.x,enemy.y-a.y)
      if(dEnemy>2.5){
        // Loin: backpedal/strafe selon angle
        const toGoal=Math.atan2(dy,dx)
        const ang=Math.abs(((toEnemy-toGoal+Math.PI*3)%(Math.PI*2))-Math.PI)
        if(ang>Math.PI*0.6) moveSpd*=0.62      // dos → ralentir
        else if(ang>Math.PI*0.3) moveSpd*=0.82  // côté → léger
      }
      // Toujours face à l'ennemi
      this._sDir(a,toEnemy,.22)
    }
    const nx=a.x+(dx/d)*moveSpd,ny=a.y+(dy/d)*moveSpd
    if(this.pass(Math.floor(nx),Math.floor(ny))){a.x=nx;a.y=ny}
    else if(this.pass(Math.floor(nx),Math.floor(a.y))){a.x=nx}
    else if(this.pass(Math.floor(a.x),Math.floor(ny))){a.y=ny}
    return false
  }

  _fp(a,spd,lookAt=null){
    if(!a.path||!a.path.length)return true
    const wp=a.path[0],cx=wp.x+.5,cy=wp.y+.5
    if(Math.hypot(cx-a.x,cy-a.y)<.42){a.path.shift();if(!a.path.length)return true}
    if(a.path.length){
      const nwp=a.path.length>1?a.path[1]:a.path[0],lx=nwp.x+.5,ly=nwp.y+.5
      if(lookAt){
        // Toujours garder la face vers l'ennemi connu
        // Le déplacement se fait en strafe/backpedal via _stepTo(enemy)
        this._stepTo(a,cx,cy,spd,lookAt)
      } else {
        // Pas d'ennemi connu → orienter vers le prochain waypoint
        const td=Math.atan2(ly-a.y,lx-a.x)
        this._sDir(a,td,.18)
        this._stepTo(a,cx,cy,spd)
      }
    }
    return false
  }

  _rPath(a,gx,gy,force=false){
    const tgx=Math.floor(gx),tgy=Math.floor(gy)
    if(!force&&a.pgx===tgx&&a.pgy===tgy&&a.pCD>0){a.pCD--;return}
    a.pgx=tgx;a.pgy=tgy;a.pCD=15+Math.floor(this.rng()*12)
    const _use1v1=(this.alive[a.team]<=1&&this.EC[a.team].length<=1)
    this._pathBB=(!_use1v1&&this.BB[a.team]&&this.BB[a.team].conf>25)?this.BB[a.team]:null
    this._pathHasCover=this.cov.length>8
    this._pathEnemies=(!_use1v1&&this.EC[a.team].length>0&&this.EC[a.team].length<=4)?this.EC[a.team].filter(e=>e.rn!=='DRONE'):null
    a.path=this.findPath(a.x,a.y,gx,gy)
    this._pathBB=null;this._pathHasCover=false;this._pathEnemies=null
  }

  _sep(a){
    if(a.rn==='DRONE')return                                       // drone : no-clip (ne se sépare de rien)
    for(const f of this.agents){
      if(f===a||f.hp<=0||f.team!==a.team||f.rn==='DRONE')continue   // ...et il ne repousse personne
      const dx=a.x-f.x,dy=a.y-f.y,d=Math.hypot(dx,dy)
      if(d<1.3&&d>.01){a.x+=dx/d*.025;a.y+=dy/d*.025}
    }
  }

  _stuckChk(a){
    if(this.frame%80!==a.uid%80)return
    const m=Math.hypot(a.x-a.lx,a.y-a.ly);a.lx=a.x;a.ly=a.y
    if(m<0.5&&a.path&&a.path.length>0){
      a.path=[];a.pgx=-1;a.pgy=-1
      a._stuckCount=(a._stuckCount||0)+1
      if(a._stuckCount>=2){
        a._stuckCount=0;a._flankGoal=null;a._flankGoalFrame=0
        const rx=(this.rng()-.5)*4,ry=(this.rng()-.5)*4
        const nx=Math.max(2,Math.min(this.MW-3,Math.floor(a.x)+rx))
        const ny=Math.max(2,Math.min(this.MH-3,Math.floor(a.y)+ry))
        if(this.pass(Math.floor(nx),Math.floor(ny))){a.x+=rx*.3;a.y+=ry*.3}
      }
    } else if(m<0.5){
      // FIX bug2 : figé SANS chemin → le filet ci-dessus (qui exige a.path) l'ignorait,
      // d'où les dernières unités qui restent plantées. Après ~160 f d'immobilité, et
      // SEULEMENT si l'agent ne voit aucun ennemi (ne pas déranger un tir en couverture
      // légitime ; AM/D/RV/KO déjà exclus à l'appel), on relance un objectif vers
      // l'ennemi réel le plus proche pour casser le gel.
      a._noPathStuck=(a._noPathStuck||0)+1
      if(a._noPathStuck>=2){
        a._noPathStuck=0
        const en=this.EC[a.team]
        if(en&&en.length){
          const e=en.reduce((b,x)=>(Math.hypot(x.x-a.x,x.y-a.y)<Math.hypot(b.x-a.x,b.y-a.y)?x:b),en[0])
          if(!this._canSee(a,e)){
            const bb=this.BB[a.team];bb.x=e.x;bb.y=e.y;bb.conf=Math.max(bb.conf,25);bb.frame=this.frame
            a.state='A';a.stCD=0;a.path=[];a.pgx=-1;a.pgy=-1
          }
        }
      }
    } else if(m>1){a._stuckCount=0;a._noPathStuck=0}
  }

  _doStrafe(a,target){
    const dT=Math.hypot(target.x-a.x,target.y-a.y)
    if(dT<3)return  // trop proche → pas de strafe
    const toEnemy=Math.atan2(target.y-a.y,target.x-a.x)  // FLAT bearing (reverted from toroidal)
    // Garder la face vers l'ennemi
    this._sDir(a,toEnemy,.20)
    // Direction de strafe: perpendiculaire, alternée selon uid
    const side=(this.frame%180<90)?(1):(-1)
    const perpDir=toEnemy+Math.PI/2*side
    const strafeSpd=a.role.spd*(a.role.strafe?.70:.40)
    const sx=a.x+Math.cos(perpDir)*strafeSpd
    const sy=a.y+Math.sin(perpDir)*strafeSpd
    if(this.pass(Math.floor(sx),Math.floor(sy))){a.x=sx;a.y=sy}
    else{
      // Bloqué — essayer l'autre côté
      const sx2=a.x+Math.cos(toEnemy+Math.PI/2*(-side))*strafeSpd*.5
      const sy2=a.y+Math.sin(toEnemy+Math.PI/2*(-side))*strafeSpd*.5
      if(this.pass(Math.floor(sx2),Math.floor(sy2))){a.x=sx2;a.y=sy2}
    }
  }

  // ── COVER SCORING ─────────────────────────────────
  _scoreNode(a,n,enemy){
    let s=0
    const dN=Math.hypot(n.x-a.x,n.y-a.y),dE=Math.hypot(n.x-enemy.x,n.y-enemy.y)
    s-=dN*.35; s-=this.danger[n.y][n.x]*.5
    // Cover basé sur angle ennemi: bloque-t-il la ligne de tir?
    const eLOS=this._rc(n.x+.5,n.y+.5,enemy.x,enemy.y)
    if(!eLOS)s+=8; else s-=5
    // Peek naturel: tile adjacente avec LOS (sortir/rentrer organiquement)
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
      if(this.pass(Math.floor(n.x)+dx,Math.floor(n.y)+dy)&&!eLOS&&this._rc(Math.floor(n.x)+dx+.5,Math.floor(n.y)+dy+.5,enemy.x,enemy.y)){s+=5;break}
    }
    // Éviter clustering même angle ennemi
    const myAng=Math.atan2(n.y-enemy.y,n.x-enemy.x)
    for(const f of this.agents){if(f===a||f.team!==a.team||f.hp<=0)continue;if(this._ad(myAng,Math.atan2(f.y-enemy.y,f.x-enemy.x))<Math.PI*.25&&Math.hypot(f.x-enemy.x,f.y-enemy.y)<dE+4)s-=8}
    if(a.rn==='SNIPER'){s+=dE*.4;if(eLOS)s-=8}
    else if(a.rn==='ASSAULT'||a.rn==='LEADER'){s+=(16-dE)*.45}
    else if(a.rn==='FLANKER'){if(this._ad(enemy.dir||0,myAng)>(enemy.role?.fov||Math.PI)*.5)s+=7;s+=(12-dE)*.25}
    else{s+=(14-Math.abs(dE-5))*.3}
    // Couverture multi-menaces : ne pas se protéger d'un seul ennemi en s'exposant aux autres.
    const _foes=(this.EC&&this.EC[a.team])?this.EC[a.team]:null
    if(_foes&&_foes.length>1){let _chk=0
      for(const _f of _foes){
        if(_f===enemy||!_f||_f.hp<=0||_f.rn==='DRONE')continue
        if(Math.hypot(_f.x-n.x,_f.y-n.y)>16)continue
        s+=this._rc(n.x+.5,n.y+.5,_f.x,_f.y)?-4:4    // exposé à un 2e ennemi = malus
        if(++_chk>=2)break                            // cap perf : 2 menaces secondaires
      }
    }
    // Conscience carte : préférer une couverture "en grappe" (replis proches) à un bloc isolé.
    if(this.coverField){let _near=0
      for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
        const _nx=Math.floor(n.x)+dx,_ny=Math.floor(n.y)+dy
        if(_nx>=0&&_ny>=0&&_nx<this.MW&&_ny<this.MH&&this.coverField[_ny][_nx]<=1)_near++
      }
      s+=_near*0.7
    }
    s+=NN.coverBias(a,this)
    return s
  }

  _bestCover(a,enemy){
    if(!enemy||!this.cov.length||enemy.rn==='DRONE')return null
    let best=null,bs=-99999
    for(const n of this.cov){const s=this._scoreNode(a,n,enemy);if(s>bs){bs=s;best=n}}
    return best
  }
  _withdrawalRoute(a,enemy){
    if(!enemy||!this.cov.length||enemy.rn==='DRONE')return null
    const awayDir=Math.atan2(a.y-enemy.y,a.x-enemy.x)
    const scored=this.cov.map(n=>{
      const ang=Math.atan2(n.y-a.y,n.x-a.x)
      const awayScore=Math.cos(ang-awayDir)*3
      const distScore=Math.hypot(n.x-a.x,n.y-a.y)*.15
      const dangerPenalty=(this.danger[n.y]?.[n.x]||0)*.5
      // Bonus: cover qui a LOS vers ennemi = position de tir en retraite
      const hasAngle=enemy&&this._rc(n.x+.5,n.y+.5,enemy.x,enemy.y)
      const angleBonus=hasAngle?.8:0
      return{n,score:awayScore+distScore-dangerPenalty+angleBonus}
    }).filter(e=>e.score>0).sort((a,b)=>b.score-a.score)
    if(!scored.length)return null
    const wp1=scored[0]?.n,wp2=scored[Math.min(3,scored.length-1)]?.n
    const r=[]
    if(wp1)r.push({x:wp1.x+.5,y:wp1.y+.5})
    if(wp2&&wp2!==wp1)r.push({x:wp2.x+.5,y:wp2.y+.5})
    return r.length?r:null
  }

  // ── PARTICLES ─────────────────────────────────────
  _ps(x,y,t,n=1,dir=null){
    for(let i=0;i<n;i++){
      const a=this.rng()*Math.PI*2,s=.04+this.rng()*.2
      const life=t==='muzz'?8:t==='blood'?28:t==='sup'?20:t==='exp'?35:t==='spark'?12:55
      this.parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t,life,ml:life,dir})
    }
  }

  // ── ENEMY CACHE REBUILD ───────────────────────────
  _rebuildEC(){
    this.EC[0]=[]; this.EC[1]=[]
    for(const a of this.agents) if(a.hp>0&&a.hp>=0&&a.state!=='KO') this.EC[1-a.team].push(a)
  }

  // ── TARGET SELECTION ─────────────────────────────
  _scoreTarget(a,e){

    if(!e || e.hp <= 0) return -9999

    // 🔒 TARGET LOCK
    if(a.lockTarget && a.lockAge > 0 && a.lockTarget.hp > 0){
        if(e === a.lockTarget){
            a.lockAge--
            return 9999
        }
    }

    let score = 0
    const dx = e.x - a.x
    const dy = e.y - a.y
    const dist = Math.hypot(dx, dy)

    score += (1000 - dist)

    if(e.hp < 40) score += 120
    if(a.lockTarget === e) score += 80

    if(this._canSee(a,e)) score += 150

    const tx = Math.floor(e.x), ty = Math.floor(e.y)
    if(tx>=0 && ty>=0 && tx<this.MW && ty<this.MH){
        score -= this.danger[ty][tx] * 0.3
    }

    // assign lock
    if(!a.lockTarget || a.lockTarget !== e){
        a.lockTarget = e
        a.lockAge = 20
    }

    if(e.rn==='DRONE')score-=200  // drone: cible de basse priorité
    return score
}

  _selectTarget(a,visE){
    if(!visE.length)return null
    if(a.lockTarget&&a.lockTarget.hp>0&&visE.includes(a.lockTarget)&&a.lockAge<LOCK_DUR){a.lockAge++;return a.lockTarget}
    let best=null,bs=-999
    for(const e of visE){const s=this._scoreTarget(a,e);if(s>bs){bs=s;best=e}}
    a.lockTarget=best;a.lockAge=0;return best
  }

  _isFriendlyInLine(a,tgt){
    if(!tgt)return false
    for(const ally of this.agents){
      if(ally.team!==a.team||ally===a||ally.hp<=0||ally.rn==='DRONE')continue
      const dA=Math.hypot(ally.x-a.x,ally.y-a.y)
      if(dA>6||dA>Math.hypot(tgt.x-a.x,tgt.y-a.y))continue
      if((tgt.x-a.x)*(ally.x-a.x)+(tgt.y-a.y)*(ally.y-a.y)>0)return true
    }
    return false
  }

  _tryFire(a,target){
    if(!target||target.hp<=0)return
    if(this._isFriendlyInLine(a,target))return
    // Sidearm trigger: draw pistol if enemy < 5 tiles and primary empty/reloading
    const dT=Math.hypot(target.x-a.x,target.y-a.y)
    // WEAPON FIRE RANGE GATE (separate from vision/engagement rng): only commit the
    // primary weapon if the target is within its effective reach. The unit may still
    // SEE/approach the target (rng) from farther; it just won't waste the primary
    // beyond weapon range. Sidearm (handled below, <5 tiles) is exempt. SNIPER's long
    // wrng lets it open fire far earlier than SMG/FLANKER, tracking its weapon.
    const _wr=a.role.wrng||a.role.rng
    if(_wr>0&&dT>_wr&&!(dT<5&&(a.mag<=0||a.state==='RL'||a.sqActive)))return
    if(dT<5&&(a.mag<=0||a.state==='RL'||a.sqActive)){
      if(a.sqMag>0){
        a.sqActive=true
        a._fireId=(a._fireId||0)+1
        this._fire(a,target)
        return
      } else if(a.sqMag<=0&&a.sqActive){
        // Reload sidearm: fast
        if(a.sqRelCD===undefined||a.sqRelCD<=0){a.sqRelCD=SIDEARM.relT}
        else{a.sqRelCD--;if(a.sqRelCD<=0){a.sqMag=SIDEARM.mag;a.sqActive=false}}
        return
      }
    } else if(a.sqActive&&dT>=5){
      a.sqActive=false  // holster if enemy moved away
    }
    // Lead prediction: aim where target will be when bullet arrives
    const dist=Math.hypot(target.x-a.x,target.y-a.y)
    const spd=a.rn==='SNIPER'?.98:.70
    const tof=dist/spd
    const lx=Math.max(0,Math.min(this.MW-1,target.x+(target.vx||0)*tof))
    const ly=Math.max(0,Math.min(this.MH-1,target.y+(target.vy||0)*tof))
    const toL=Math.atan2(ly-a.y,lx-a.x)
    const aimErr=this._ad(a.dir,toL)
    const thresh=AIM_THRESH[a.rn]||Math.PI/5
    if(aimErr>thresh){this._sDir(a,toL,Math.min(.38,.15+aimErr*.3));return}
    this._fire(a,{...target,x:lx,y:ly})
  }

  // ── SQ COORDINATOR ───────────────────────────────
  _sqUpdate(team){
    const allies=this.agents.filter(a=>a.team===team&&a.hp>0&&a.rn!=='DRONE')
    const enemies=this.EC[team]
    if(!allies.length||!enemies.length)return
    for(const a of allies)a.ord='N'
    // Exclure drones du compte pour la convergence
    const _nonDroneEn=enemies.filter(e=>e.rn!=='DRONE')
    const _enemiesForLogic=_nonDroneEn.length?_nonDroneEn:enemies
    if(!_enemiesForLogic.length)return
    if(_enemiesForLogic.length===1){
      // Dernier ennemi: convergence FORCÉE même sans LOS (utilise BB)
      const lastE=_enemiesForLogic[0]
      this.FOCUS[team]=lastE
      for(const a of allies){
        a.sqTgt=lastE; a.ord='A'
        // Forcer BB vers sa position connue
        const bb=this.BB[team]
        if(bb.conf<30){bb.x=lastE.x;bb.y=lastE.y;bb.conf=50;bb.frame=this.frame}
      }
      return
    }
    const visE=_enemiesForLogic.filter(e=>allies.some(a=>this._canSee(a,e)))
    // Pas de LOS collectif → utiliser BB pour approche coordonnée
    if(!visE.length){
      const bb=this.BB[team]
      if(bb.conf>10){
        for(const a of allies){
          a.sqTgt=null
          if(a.rn==='FLANKER'){
            // Flanker proactif: contourner depuis BB même sans LOS
            a.ord='F'
            if(!a._flankGoal||!a._flankGoalFrame||(this.frame-a._flankGoalFrame)>150){
              const side=a.uid%2===0?1:-1
              // Utiliser BB direction si connue, sinon estimation
              const _bbDir=this.BB[a.team].frame&&(this.frame-this.BB[a.team].frame)<300?
                Math.atan2(a.y-bb.y,a.x-bb.x):Math.atan2(bb.y-a.y,bb.x-a.x)
              const _bkAng=_bbDir+Math.PI*.5+side*Math.PI*.4  // côté hors FOV estimé
              a._flankGoal={x:Math.max(2,Math.min(this.MW-3,bb.x+Math.cos(_bkAng)*8)),y:Math.max(2,Math.min(this.MH-3,bb.y+Math.sin(_bkAng)*8))}
              a._flankGoalFrame=this.frame
            }
          } else {a.ord='A'}
        }
      } else {for(const a of allies)a.ord='A'}
      return
    }
    const _visNonD=visE.filter(e=>e.rn!=='DRONE')
    const _visPool=_visNonD.length?_visNonD:visE
    const tgt=_visPool[0]?_visPool.reduce((b,e)=>e.hp<b.hp?e:b,_visPool[0]):null
    if(!tgt)return
    this.FOCUS[team]=tgt
    // ── BUDDY FIRE-AND-MOVE pairing ─────────────────
    const phase=Math.floor(this.frame/120)%2  // 120f — assez de temps pour contourner
    // Only reset buddy links if team composition changed
    const allyKey=allies.map(a=>a.uid).join(',')
    if(this._lastAllyKey&&this._lastAllyKey[team]===allyKey){
      // Same squad — update target only
      for(const a of allies){a.sqTgt=tgt}
    } else {
      if(!this._lastAllyKey)this._lastAllyKey={}
      this._lastAllyKey[team]=allyKey
      for(const a of allies){a.sqTgt=tgt;a.buddyId=-1}
    }
    // Link SUPPORT ↔ nearest FLANKER
    for(const sup of allies.filter(a=>a.rn==='SUPPORT')){
      const flk=allies.filter(a=>a.rn==='FLANKER').sort((a,b)=>Math.hypot(a.x-sup.x,a.y-sup.y)-Math.hypot(b.x-sup.x,b.y-sup.y))[0]
      if(flk){sup.buddyId=flk.uid;flk.buddyId=sup.uid}
    }
    const _enclircle=(allies.length>=2&&enemies.length>0)&&allies.some(f=>f.rn==='FLANKER')
    if(_enclircle&&tgt){
      const _bAng=Math.atan2(tgt.y-this.centroid[team].y,tgt.x-this.centroid[team].x)
      let _si=0
      const _mov=allies.filter(f=>f.rn!=='SNIPER'&&f.rn!=='SUPPORT')
      const _movLen=Math.max(1,_mov.length)
      for(const f of _mov){
        const _ang=_bAng+(_si/_mov.length-.5)*Math.PI*1.2
        const _r=7+this.rng()*3
        f._approachTarget=this._getEncirclePosition(tgt,_si,_movLen)
        _si++
      }
    } else {for(const f of allies)f._approachTarget=null}

    for(let i=0;i<allies.length;i++){
      const a=allies[i]; const isEven=i%2===0
      if(a.rn==='SNIPER'){
        // Sniper overwatch: S si alliés en combat OU ennemi visible
        const _sqAllyFight=allies.some(f=>f!==a&&(f.state==='E'||f.state==='S'||f.state==='A'))
        const _hasVis=this.EC[team].some(e=>this._canSee(a,e))
        a.ord=(_sqAllyFight||_hasVis)?'S':'A'
        a.buddyRole='fire'
      }
      else if(a.rn==='SUPPORT'){
        // Only suppress if a flanker is alive to benefit from it
        const hasFlanker=allies.some(f=>f.rn==='FLANKER'&&f.hp>0)
        a.ord=hasFlanker?'S':'A'; a.buddyRole='fire'
      }
      else if(a.rn==='FLANKER'){
        const hasBuddy=a.buddyId>=0
        // Flanker paired with support suppresses while support fires, then swaps
        a.buddyRole=hasBuddy?(phase===0?'move':'fire'):'move'
        a.ord=a.buddyRole==='fire'?'S':'F'
      } else {
        // ASSAULT/LEADER alternate fire/move by phase+index
        const fires=isEven===Boolean(phase)
        a.ord=fires?'S':'A'; a.buddyRole=fires?'fire':'move'
      }
    }
    if(this.EC[team].length>0&&this.frame%35===team)this._setupCrossfire(team)
  }

  _setupCrossfire(team){
    const enemies=this.EC[team].filter(e=>e.rn!=='DRONE')
    if(!enemies.length)return
    const cc=this.centroid[team]
    const tgt=enemies.reduce((b,e)=>Math.hypot(e.x-cc.x,e.y-cc.y)<Math.hypot(b.x-cc.x,b.y-cc.y)?e:b,enemies[0])
    const attackers=this.agents.filter(a=>a.team===team&&a.hp>0&&a.rn!=='DRONE'&&(a.state==='E'||a.state==='A'||a.state==='S')&&this._canSee(a,tgt))
    if(attackers.length<2)return
    const angs=attackers.map(a=>({a,ang:Math.atan2(tgt.y-a.y,tgt.x-a.x)}))
    for(let i=0;i<angs.length-1;i++)for(let j=i+1;j<angs.length;j++){
      if(this._ad(angs[i].ang,angs[j].ang)<Math.PI*.45){
        const mv=angs[j].a.rn==='FLANKER'?angs[j].a:angs[i].a.rn==='FLANKER'?angs[i].a:angs[j].a
        if(mv.stCD>0||mv.rn==='SUPPORT')continue
        const cAng=Math.atan2(tgt.y-mv.y,tgt.x-mv.x)+(mv.uid%2===0?Math.PI*.65:-Math.PI*.65)
        const d=6+this.rng()*2
        const gx=Math.max(2,Math.min(this.MW-3,tgt.x+Math.cos(cAng+Math.PI)*d))
        const gy=Math.max(2,Math.min(this.MH-3,tgt.y+Math.sin(cAng+Math.PI)*d))
        if(!this.pass(Math.floor(gx),Math.floor(gy)))continue
        mv._crossfireGoal={x:gx,y:gy,frame:this.frame}
        mv.stCD=0;mv.pgx=-1;mv.pgy=-1;this._rPath(mv,gx,gy)
        if(mv.path?.length)mv.stCD=25
        if(this.floats&&this.rng()<.2)this.floats.push({x:mv.x,y:mv.y-1.5,text:'X-FIRE',life:35,ml:35,col:'#ff8844',vy:-0.02})
        return
      }
    }
  }

  // ── GOAP-LITE PLAN GENERATOR ─────────────────────
  _planFor(a){
    const rn=a.rn,isGuerr=CFG.asymmetric&&a.team===1
    const allies=this.alive[a.team],pers=a.personality||.5,hpR=a.hp/a.role.hp
    const hasFlanker=this.agents.some(f=>f.team===a.team&&f.rn==='FLANKER'&&f.hp>0)
    let plan=[]

    if(rn==='SNIPER'){
      // Surplombant: chercher vantage → overwatch → repositionner si no LOS
      // Jamais en E prolongé (trop vulnérable), jamais en D (trop lent)
      plan=[
        {s:'AM',min:60+Math.floor(pers*40)},  // Chercher position overwatch
        {s:'S', min:80+Math.floor(pers*40)},  // Overwatch longue durée
        {s:'AM',min:50},                       // Repositionner si nécessaire
      ]
    }
    else if(rn==='FLANKER'){
      // Contourneur: chercher flanc → burst court → disperse → recommencer
      // JAMAIS plan de retraite vers arrière — F→burst→D→F
      plan=isGuerr?[
        {s:'F',min:30},                        // Chercher flanc (guérilla: vite)
        {s:'E',min:12+Math.floor(pers*10)},    // Burst très court
        {s:'D',min:45},                        // Disperse et repositionner
      ]:[
        {s:'F',min:40+Math.floor(pers*20)},   // Chercher flanc
        {s:'E',min:15+Math.floor(pers*12)},   // Burst court (HP faible → court)
        {s:'D',min:50},                        // Disperse (repositionnement)
        {s:'F',min:35},                        // Recommencer le flanc
      ]
    }
    else if(rn==='SUPPORT'){
      // Fixateur: suppression couvrant FLANKER → revive si KO → reprend
      plan=hasFlanker?[
        {s:'S',min:50+Math.floor(pers*30)},   // Suppression couvrant flanker
        {s:'A',min:15},                        // Avancer si flanker a percé
        {s:'S',min:40},                        // Reprendre suppression
      ]:[
        {s:'A',min:20},                        // Sans flanker: avancer avec l'équipe
        {s:'E',min:35+Math.floor(pers*20)},
        {s:'S',min:30},
      ]
    }
    else if(rn==='LEADER'){
      // Initiateur: avancer EN PREMIER → tenir la position → couvrir si allié R
      plan=[
        {s:'A',min:15},                        // Avancer rapidement
        {s:'E',min:50+Math.floor(pers*30)},   // Tenir et combattre (HP élevé)
        {s:'E',min:30},                        // Continuer (résistant)
      ]
    }
    else{  // ASSAULT: presseur
      // Fermer la distance → exploser le DPS → avancer encore
      plan=pers>.6?[
        {s:'A',min:20},                        // Avancer vite
        {s:'E',min:45},                        // DPS max à courte portée
        {s:'A',min:10},                        // Repositionner sur nouvelle cible
        {s:'E',min:40},
      ]:[
        {s:'A',min:25},
        {s:'E',min:40},
        {s:'A',min:15},
        {s:'E',min:35},
      ]
    }

    // Overrides urgents
    if(hpR<.35)plan=[{s:'R',min:50},{s:'A',min:20}]
    if(allies<=1)plan=[{s:'A',min:8},{s:'E',min:80}]
    a.plan=plan;a.planFrame=this.frame;a.planPhase=0
  }
  _planSuggest(a){
    if(!a.plan||!a.plan.length)return null
    if(a.planPhase>=a.plan.length)return null
    const step=a.plan[a.planPhase]
    if(this.frame-a.planFrame>=step.min){a.planPhase++;a.planFrame=this.frame;if(a.planPhase>=a.plan.length)a.plan=[];return null}
    return step.s
  }
  // ── CMD UPDATE ────────────────────────────────────
  _cmdUpdate(){
    if(!CFG.cmd)return
    const PRI=['LEADER','ASSAULT','SUPPORT','FLANKER','SNIPER']
    for(let t=0;t<2;t++){
      const alive=this.agents.filter(a=>a.team===t&&a.hp>0)
      let cmd=null
      for(const rn of PRI){cmd=alive.find(a=>a.rn===rn);if(cmd)break}
      this.CMD[t]=cmd
      for(const a of alive){
        a.isCmd=(a===cmd)
        a.cmdAura=!!(cmd&&a!==cmd&&Math.hypot(a.x-cmd.x,a.y-cmd.y)<8)
      }
    }
  }

  _auraSpd(a){return(a.cmdAura&&CFG.cmd)?1.10:1}

  _jlog(t,a,x={}){
    if(!this.journal)return
    if(this.journal.length>=this.journalMax)this.journal.shift()
    this.journal.push({f:this.frame,t,uid:a.uid,tm:a.team,rn:a.rn,
      x:+a.x.toFixed(2),y:+a.y.toFixed(2),dir:+a.dir.toFixed(3),
      st:a.state,hp:a.hp,mag:a.mag,...x})
  }

  // ── UTILITY SCORER ─────────────────────────────────
  // Returns a score map {engage, retreat, hunt, approach, ambush, suppress, disperse}
  // The highest-utility intention governs state transitions
  _utility(a, hasLOS, target, closE, hpR, dE){
    const u={}
    // Pré-calculé ici pour usage dans tout le bloc utility
    const _allyInCombat=this.agents.some(f=>f.team===a.team&&f.hp>0&&f!==a&&(f.state==='E'||f.state==='S'))
    const alliesN=this.alive[a.team]  // alive exclut déjà le drone
    const enemiesN=this.EC[a.team].length
    const localSuperiority=alliesN/(enemiesN||1)
    // Lone survivor: disable ambush, boost engage
    const isSolo=alliesN<=1  // = isSolo_ in tick context
    const inCover=this.map[Math.floor(a.y)]?.[Math.floor(a.x)]===2
    const _dlv=this.danger[Math.floor(a.y)]?.[Math.floor(a.x)]||0
    const dangerLocal=isFinite(_dlv)?_dlv:0

    // ENGAGE — modulé par rôle
    const _numAdv=Math.max(0,localSuperiority-1)*15
    // Bonus engage role-spécifiques
    let _roleEngageBonus=0
    if(a.rn==='LEADER'){
      // Leader engage plus si alliés derrière lui (il initie)
      const _allyBehind=this.agents.filter(f=>f.team===a.team&&f.hp>0&&f!==a&&
        (a.team===0?f.x<a.x:f.x>a.x)).length
      _roleEngageBonus=_allyBehind*8  // +8 par allié qu'il protège
    } else if(a.rn==='ASSAULT'){
      // Assault engage plus si ennemi proche (portée courte = efficace)
      _roleEngageBonus=dE<6?30:dE<a.role.rng?15:0
    } else if(a.rn==='SNIPER'){
      // Sniper engage seulement si allié en combat (overwatch) ou à bonne distance
      const _distOpt=dE>10&&dE<a.role.rng
      _roleEngageBonus=(_allyInCombat&&hasLOS)?25:(_distOpt&&hasLOS?15:-10)
    } else if(a.rn==='FLANKER'){
      // Flanker engage SEULEMENT si dans l'angle mort ennemi
      const _angMort=closE?this._ad(closE.dir,Math.atan2(a.y-closE.y,a.x-closE.x))>(closE.role?.fov||Math.PI)*.55:false
      _roleEngageBonus=_angMort?35:-20  // fort malus si pas dans l'angle mort
    } else if(a.rn==='SUPPORT'){
      // Support engage si flanker allié actif (suppression coordonnée)
      const _flkActive=this.agents.some(f=>f.team===a.team&&f.rn==='FLANKER'&&f.hp>0&&(f.state==='F'||f.state==='E'))
      _roleEngageBonus=_flkActive?20:5
    }
    u.engage = hasLOS
      ? (40 + hpR*30 + _numAdv + _roleEngageBonus - dangerLocal*1.5
         + NN.engageBias(a)*20 + (isSolo?20:0))
      : -50

    // RETREAT — want HP low, danger high, outnumbered
    u.retreat = (1-hpR)*60 + dangerLocal*2 + (localSuperiority<0.5?20:0)
      - (inCover?15:0)

    // AMBUSH — want phero enemy trace, cover available, no LOS yet
    // Flanker+Sniper preference
    // OP (Observation Post): FLANKER in 'fire' buddy role gets extra ambush utility
    const isOP=a.rn==='FLANKER'&&a.buddyRole==='fire'
    const ambushBonus=(a.rn==='FLANKER'||a.rn==='SNIPER')?25:0 + (isOP?15:0)
    // FIX 2: scan local max enemy phero in r=5, not just agent tile
    let pheroEnemy=0
    if(this.phero){
      const et=1-a.team,r=5
      for(let py=Math.max(0,Math.floor(a.y-r));py<=Math.min(this.MH-1,Math.floor(a.y+r));py++)
        for(let px=Math.max(0,Math.floor(a.x-r));px<=Math.min(this.MW-1,Math.floor(a.x+r));px++){
          const v=this.phero[et][py][px]||0; if(v>pheroEnemy)pheroEnemy=v
        }
    }
    // FIX 3b: no ambush when solo (need allies to cover withdrawal)
    u.ambush = (!hasLOS&&!isSolo)
      ? (pheroEnemy*35 + ambushBonus + (this.BB[a.team].conf>20?10:0) - 5)
      : -30

    // SUPPRESS — want ally flanker close to target, I have ammo
    const flkNear=this.agents.find(f=>f.team===a.team&&f.rn==='FLANKER'&&f.hp>0
      &&target&&Math.hypot(f.x-target.x,f.y-target.y)<8)
    // SNIPER overwatch: supprime si allié est en combat (E/S) même sans FLANKER
    const _sniperSuppress=a.rn==='SNIPER'&&hasLOS&&(_allyInCombat||a.ord==='S')
    u.suppress = (_sniperSuppress)
      ? 60 + (a.mag/a.role.mag)*25  // sniper en overwatch: haute priorité suppression
      : (hasLOS&&flkNear&&a.ord==='S')
        ? 55 + (a.mag/a.role.mag)*20
        : hasLOS&&a.rn==='SUPPORT'
          ? 35 + (a.mag/a.role.mag)*10
          : (hasLOS&&a.ord==='S'?30:0)

    // DISPERSE — réduit en 1v1 (ne pas fuir mutuellement)
    // et annulé si seul (doit toujours converger vers l'ennemi)
    // APPROACH/HUNT — fill utility for movement states
    const is1v1=enemiesN===1&&alliesN===1
    const _dBase=a.disperseCD>0?40+(a.disperseCD/60)*15:0
    u.disperse = is1v1 ? Math.min(_dBase,20)
               : alliesN<=1 ? 0
               : _dBase
    const _mirrorSniper=is1v1&&a.rn==='SNIPER'&&this.EC[a.team][0]?.rn==='SNIPER'
    const outnumbered=alliesN<enemiesN  // on est en infériorité → converger
    const jamPenalty=this.jamActive&&this.jamTeam===a.team
    // Boost approche: nuit + 1v1 + stalemate long
    const _nightBoost=0  // supprimé
    const _staleBoost=(this.frame-(this.lastKillFrame||0))>900?15:0  // >15s sans kill
    u.approach = !hasLOS ? (this.BB[a.team].conf>15?30:15)+(is1v1?35:0)+(outnumbered?20:0)+(jamPenalty?25:0)+(_mirrorSniper?40:0)+_nightBoost+_staleBoost : 0
    u.hunt     = !hasLOS ? (this.BB[a.team].conf<=15?22:10)+(is1v1?20:0)+(outnumbered?15:0)+(jamPenalty?15:0)+(_mirrorSniper?15:0) : 0

    // GOAP bias — additive, plafonnée par goapBlendCap (couplé Adam)
    try{if(a._goap&&a._goap.goals&&a._goap.rnnOut){var _g=a._goap.goals,_r=a._goap.rnnOut;var _mC=(typeof goapBlendCap==="function")?goapBlendCap(a.rn||"ASSAULT",a.team):15;var _c2=function(v){return Math.max(-_mC,Math.min(_mC,v))};u.retreat=(u.retreat||0)+_c2(_g.survive*12+(_r[0]||0)*5);u.engage=(u.engage||0)+_c2(_g.eliminate*13+(_r[1]||0)*7);u.approach=(u.approach||0)+_c2(_g.support*8+(_r[2]||0)*4);u.suppress=(u.suppress||0)+_c2(_g.position*9+(_r[3]||0)*5);u.ambush=(u.ambush||0)+_c2(_g.position*4)}}catch(_ge){}
    return u
  }

  // ══ PIPELINE IA: sense → perceive → decide → act ══════════════
  // Orchestrateur principal — 4 phases séparées
  _aiTick(a){
    this._senseTick(a)
    if(a.state==='RL'){this._actReload(a);return}
    const ctx=this._perceiveTick(a)
    if(!ctx)return
    this._decideTick(a,ctx)
    this._actTick(a,ctx)
    this._sep(a)
  }

  // ── PHASE 1: SENSE — capteurs, cooldowns, mémoire ──────────────
  // Mise à jour des timers, phéromones, trail, NN input
  _senseTick(a){
    if(a.rn==='DRONE'){this._droneTick(a);return}  // drone: comportement autonome
    a.sCD=Math.max(0,a.sCD-1);a.stCD=Math.max(0,a.stCD-1)
    a.flCD=Math.max(0,a.flCD-1);a.mzCD=Math.max(0,a.mzCD-1)
    if(!a._mem||this.frame%120===a.uid%120){
      const _mx=Math.floor(a.x),_my=Math.floor(a.y)
      if(a._mem&&Math.hypot(_mx-a._mem.x,_my-a._mem.y)<1.5&&a.state!=='AM'&&a.state!=='S')
        a._memStuck=(a._memStuck||0)+1
      else a._memStuck=Math.max(0,(a._memStuck||0)-1)
      a._mem={x:_mx,y:_my}
    }
    // Anti-camping: si immobile 3+ cycles en H → forcer A
    if((a._memStuck||0)>3&&a.state==='H'&&this.EC[a.team].length>0){a._memStuck=0;a.state='A';a.stCD=0}
    a.supCD=Math.max(0,(a.supCD||0)-1)
    // Medkit: SUPPORT soigne auto toutes les 60f si alliés blessés
    if(a.medkit){
      if(a.medkit.cd>0)a.medkit.cd--
      if(a.rn==='SUPPORT'&&a.medkit.cd<=0&&this.frame%60===a.uid%60)this._tryHeal(a)
    }
    // Smoke tick
    if(a.smoke){
      if(a.smoke.cd>0)a.smoke.cd--
      if(a.smoke.active){a.smoke.timer--;if(a.smoke.timer<=0)a.smoke.active=false}
    }
    a.disperseCD=Math.max(0,(a.disperseCD||0)-1)
    if((a._wpScdPenalty||0)>0)a._wpScdPenalty--
    if((a._wpRelPenalty||0)>0)a._wpRelPenalty--
    if(a.pCD>0)a.pCD--
    if(a.sqCD>0)a.sqCD=Math.max(0,a.sqCD-1)
    const _tx=Math.floor(a.x),_ty=Math.floor(a.y)
    if(this.map[_ty]&&this.map[_ty][_tx]===2){a._coverFrames=(a._coverFrames||0)+1}else{a._coverFrames=0}
    // No-hit repositioning: tracker shots fired depuis dernier hit
    {
      const sf=a.shotsFired||0, sh=a.shotsHit||0
      const sfPrev=a._prevSF||0, shPrev=a._prevSH||0
      // Si on a tiré depuis le dernier check
      if(sf>sfPrev){
        if(sh>shPrev){a._noHitFrames=0}  // hit → reset
        else a._noHitFrames=(a._noHitFrames||0)+(sf-sfPrev)  // tirs sans hit
        a._prevSF=sf; a._prevSH=sh
      } else {
        a._noHitFrames=(a._noHitFrames||0)+1  // frame sans tir
      }
      // Après 150 tirs/frames sans hit → repositionnement agressif
      if((a._noHitFrames||0)>150&&(a.state==='E'||a.state==='A')){
        a._noHitFrames=0; a.stCD=0; a.pgx=-1; a.pgy=-1
        a.path=[]; a.withdrawalRoute=null
        // Forcer approach vers EC centroid (pas cover locale)
        const enE=this.EC[a.team]
        if(enE.length){
          const ecx=enE.reduce((s,e)=>s+e.x,0)/enE.length
          const ecy=enE.reduce((s,e)=>s+e.y,0)/enE.length
          this.BB[a.team].x=ecx; this.BB[a.team].y=ecy
          this.BB[a.team].conf=70; this.BB[a.team].frame=this.frame
        }
        a.state='A'  // hunt vers centroid ennemi
      }
    }
    // Phéromone: marquer position courante
    if(CFG.phero){const tx=Math.floor(a.x),ty=Math.floor(a.y);if(this.pass(tx,ty))this.phero[a.team][ty][tx]=Math.min(1,this.phero[a.team][ty][tx]+.07)}
    // Trail pour lean visuel et velocity
    if(!a.trail)a.trail=[]
    a.trail.push({x:a.x,y:a.y});if(a.trail.length>6)a.trail.shift()
    a.vx=a.vx*.7+(a.x-a.prevX)*.3
    a.vy=a.vy*.7+(a.y-a.prevY)*.3
    a.prevX=a.x;a.prevY=a.y
    // NN input et survie reward
    if(!a._nnInp||this.frame%30===a.uid%30)a._nnInp=NN.buildInput(a,this)
    if(a.hpSmooth===undefined)a.hpSmooth=a.hp;else a.hpSmooth=a.hpSmooth*.72+a.hp*.28
    if(this.frame%120===a.uid%120)NN.onSurvive(a,this)
  if(a.state==='R'&&a.hp/a.role.hp<.18&&this.frame%12===a.uid%12)this._ps(a.x+(this.rng()-.5)*.3,a.y+(this.rng()-.5)*.3,'smoke',1)
  }

  // Gestion état RELOAD (traité avant perceive car bloque tout le reste)
  _actReload(a){
    // Sidearm interrupt: if enemy close and pistol available, don't wait
    if(a.sqMag>0&&this.EC[a.team].length&&a.state!=='RV'){
      const _ecR=this.EC[a.team].filter(e=>e.rn!=='DRONE')
      const _ecP=_ecR.length?_ecR:this.EC[a.team]
      if(_ecP.length){
        const cE=_ecP.reduce((b,e)=>Math.hypot(e.x-a.x,e.y-a.y)<Math.hypot(b.x-a.x,b.y-a.y)?e:b,_ecP[0])
        if(Math.hypot(cE.x-a.x,cE.y-a.y)<5)a.sqActive=true
      }  // draw sidearm
    }
    // Sidearm cooldown tick
    if(a.sqRelCD>0)a.sqRelCD=Math.max(0,a.sqRelCD-1)
    if(a.sqCD>0)a.sqCD=Math.max(0,a.sqCD-1)
    a.relCD=Math.max(0,a.relCD-1)
    if(a.relCD===0){a.mag=a.role.mag;a.state=a.preRS||'A';a._wpScdPenalty=0;a._wpRelPenalty=0}
    if(a.stCD<=0){
      const allE=this.EC[a.team]
      if(allE.length){const _allEF=allE.filter(e=>e.rn!=='DRONE');const _allEP=_allEF.length?_allEF:allE;const closE=_allEP.reduce((b,e)=>Math.hypot(e.x-a.x,e.y-a.y)<Math.hypot(b.x-a.x,b.y-a.y)?e:b,_allEP[0]);const cov=this._bestCover(a,closE);if(cov){this._rPath(a,cov.x+.5,cov.y+.5,true);a.stCD=40}}
    }
    this._fp(a,a.role.spd*.85*this._auraSpd(a));this._sep(a)
  }

  // ── PHASE 2: PERCEIVE — détection, ciblage, BB update ──────────
  // Retourne {allE,closE,visE,hasLOS,target,hpR,dE} ou null si rien à faire
  _perceiveTick(a){
    const allE=this.EC[a.team]
    if(!allE.length)return null
    const _nonDroneE=allE.filter(e=>e.rn!=='DRONE')
    const _pool=_nonDroneE.length?_nonDroneE:allE
    if(!_pool.length)return null
    const closE=_pool.reduce((b,e)=>Math.hypot(e.x-a.x,e.y-a.y)<Math.hypot(b.x-a.x,b.y-a.y)?e:b,_pool[0])
    const visE=allE.filter(e=>this._canSee(a,e))
    const hasLOS=visE.length>0
    const target=hasLOS?this._selectTarget(a,visE):null
    // Mettre à jour le Blackboard si contact
    if(target){
      const bb=this.BB[a.team]
      if(isFinite(target.x))bb.x=target.x
      if(isFinite(target.y))bb.y=target.y
      bb.frame=this.frame
      if(!this.jamActive||(this.jamTeam>=0&&this.jamTeam!==a.team)){
        bb.conf=100
        // RADIO TACITE: partager position à tous les alliés sans LOS
        for(const f of this.agents){
          if(f===a||f.team!==a.team||f.hp<=0||f.state==='KO')continue
          if(!this._canSee(f,target)&&isFinite(target.x)){
            const fb=this.BB[f.team]
            if(fb.conf<90){fb.x=target.x;fb.y=target.y;fb.frame=this.frame;fb.conf=Math.min(90,fb.conf+40)}
          }
        }
      }
    }
    // Détection sonore: ennemi très proche même sans LOS → BB partiel
    if(!hasLOS&&!this.jamActive){
      for(const e of allE){
        const d=Math.hypot(e.x-a.x,e.y-a.y)
        const sndRange=(e._lastShotRn&&SOUND_RANGE[e._lastShotRn])||5
        if(d<=sndRange){
          const bb=this.BB[a.team]
          if(bb.conf<60){bb.x=e.x;bb.y=e.y;bb.conf=60;bb.frame=this.frame;if(NN.training)this._jlog('DETECT',a,{euid:e.uid,ex:+e.x.toFixed(2),ey:+e.y.toFixed(2),dist:+d.toFixed(2)})}
          break
        }
      }
    }
    return{allE,closE,visE,hasLOS,target,hpR:a.hp/a.role.hp,dE:Math.hypot(closE.x-a.x,closE.y-a.y)}
  }

  // ── PHASE 3: DECIDE — transitions d'état via Utility AI + GOAP ──
  // Lit ctx, met à jour a.state selon priorités: retraite > utility > plan
  _decideTick(a,{hasLOS,target,closE,hpR,dE}){
    // LEADER en retraite collective: couvrir les alliés qui fuient
    if(a.state==='R'&&a.rn==='LEADER'&&hasLOS){
      const retreatingAllies=this.agents.filter(f=>f.team===a.team&&f.hp>0&&f!==a&&f.state==='R')
      if(retreatingAllies.length>=1&&hpR>.4){
        // LEADER prend position de couverture et supprime
        a.state='S';a.stCD=0;return
      }
    }
    // Refresh plan périodiquement
    if(this.frame%120===a.uid%15||(a.plan&&!a.plan.length&&this.frame%60===a.uid%60))this._planFor(a)
    // Lone survivor: forcer BB vers centroid ennemi
    // 1v1 SNIPER: forcer BB frais chaque frame vers ennemi
    if(this.EC[a.team].length===1&&this.EC[a.team][0]?.rn==='SNIPER'&&a.rn==='SNIPER'&&!hasLOS){
      const _se=this.EC[a.team][0]
      const bb2=this.BB[a.team]
      bb2.x=_se.x;bb2.y=_se.y;bb2.conf=70;bb2.frame=this.frame
    }
    if(this.alive[a.team]<=1&&!hasLOS&&this.EC[a.team].length){
      const ex=this.EC[a.team].reduce((s,e)=>s+e.x,0)/this.EC[a.team].length
      const ey=this.EC[a.team].reduce((s,e)=>s+e.y,0)/this.EC[a.team].length
      const bb=this.BB[a.team]
      if(bb.conf<40){bb.x=ex;bb.y=ey;bb.conf=50;bb.frame=this.frame}
    }
    // Priorité absolue: retraite HP critique
    const retreatThresh=NN.retreatBias(a)
    // Sniper 1v1: pas de retraite si HP > 10% (préférer engager au risque de mourir)
    const _is1v1r=this.EC[a.team].filter(e=>e.rn!=='DRONE').length<=1&&this.alive[a.team]<=1
    const _effThresh=_is1v1r&&a.rn==='SNIPER'?Math.min(retreatThresh,0.08):retreatThresh
    if(hpR<_effThresh&&a.state!=='R'&&a.state!=='RL'){a.state='R';a.stCD=0;a._rTimer=0;return}
    // Utility scorer + plan hint + personnalité
    if(a.state==='RL'||a.state==='RV'||a.state==='KO')return
    // En retraite: autoriser transition → S si LOS + allié qui avance + hp correct
    if(a.state==='R'){
      if(hasLOS&&hpR>.35&&this.alive[a.team]>1){
        // Un allié est-il en E/A/P ? Si oui, je peux le couvrir depuis ma position
        const advancingAlly=this.agents.find(f=>f.team===a.team&&f.hp>0&&f!==a&&(f.state==='E'||f.state==='A'||f.state==='P'))
        if(advancingAlly){
          // Transition vers S: je supprime pendant qu'un allié avance
          a.state='S';a.stCD=0;return
        }
      }
      return  // sinon bloquer les transitions normalement
    }
    const u=this._utility(a,hasLOS,target,closE,hpR,dE)
    try{if(a._goap)a._goap.lastU={engage:u.engage||0,retreat:u.retreat||0,approach:u.approach||0,suppress:u.suppress||0,hunt:u.hunt||0,disperse:u.disperse||0}}catch(_e){}
    // [PATCH 3] Ajout de F (FLANKER proactif) et R (RETREAT) au mapping pour que l'hystérésis
    // fonctionne sur tous les états. Sans F:'engage', un agent en F basculait sans seuil.
    const curU=u[{H:'hunt',A:'approach',E:'engage',S:'suppress',P:'engage',AM:'ambush',D:'disperse',F:'engage',R:'retreat'}[a.state]]||0
    const planSug=this._planSuggest(a)
    if(planSug){const pk={E:'engage',R:'retreat',AM:'ambush',S:'suppress',D:'disperse',A:'approach',H:'hunt',P:'engage'}[planSug];if(pk&&u[pk]!==undefined)u[pk]+=18}
    if(u.engage!==undefined)u.engage+=(a.personality||.5)*8
    const _style=(CFG.teamStyle&&CFG.teamStyle[a.team])||'trained'
    if(_style==='aggressive'){u.engage+=22;u.approach+=15;u.retreat-=18;u.ambush-=10}
    else if(_style==='defensive'){u.suppress+=20;u.retreat+=10;u.engage-=12;u.approach-=8}
    else if(_style==='guerrilla'){u.ambush+=25;u.disperse+=15;u.suppress+=10;u.engage-=15;u.approach-=10}
    const _nnB=NN.blendWeight(a.rn)
    if(_nnB>.30&&hpR>.35&&(hasLOS||this.BB[a.team].conf>30)&&this.EC[a.team].length>0){const _amp=Math.min(2.0,_nnB*2),_eB=NN.engageBias(a)*20*_amp;if(u.engage!==undefined)u.engage+=_eB;if(u.suppress!==undefined&&_eB<0)u.suppress-=_eB*.5}
    const best=Object.entries(u).reduce((b,e)=>e[1]>b[1]?e:b,['hunt',0])
    if(best[1]>curU+(_nnB>.30&&hpR>.35?12:15)){
      const ns={engage:'E',retreat:'R',ambush:'AM',suppress:'S',disperse:'D',approach:'A',hunt:'H'}[best[0]]
      if(ns&&ns!==a.state){
        this._jlog('STATE',a,{prev:a.state,next:ns,hasLOS:hasLOS?1:0,hpR:+hpR.toFixed(3),dE:+dE.toFixed(2),uE:+(u.engage||0).toFixed(1),uR:+(u.retreat||0).toFixed(1),uA:+(u.ambush||0).toFixed(1),uS:+(u.suppress||0).toFixed(1),uH:+(u.approach||0).toFixed(1),plan:a.planPhase})
        a.state=ns;a.stCD=0;a.ambushPos=null;a.patience=0;a.amShotsLeft=0
      }
    }
  }

  // ── PHASE 4: ACT — exécution de l'état courant ─────────────────
  // Switch propre sur a.state, utilise ctx en lecture seule
  _actTick(a,{hasLOS,target,closE,dE,hpR}){

    if(a.rn==='SUPPORT'&&a.state!=='RV'&&a.state!=='RL'){const _ko2=this.agents.find(f=>f.team===a.team&&f.state==='KO'&&!f.revived&&f.rn!=='DRONE'&&Math.hypot(f.x-a.x,f.y-a.y)<5)
          const _flkRdy=this.agents.some(f=>f.team===a.team&&f.rn==='FLANKER'&&f._flankReady&&f.hp>0)
          if(_flkRdy&&hasLOS&&a.state!=='RV'){a.state='S';a.stCD=0}
          else if(_ko2){a.state='RV';a.rvTarget=_ko2;a.rvCD=90;a.stCD=0}}
    if(a.state!=='AM'&&a.state!=='D'&&a.state!=='RV'&&a.state!=='KO')this._stuckChk(a)
    const aSpd=this._auraSpd(a)
    const bb=this.BB[a.team]

    switch(a.state){

      case 'H':
        if(!hasLOS&&a.stCD<=0){const _snd=getSoundTarget(a);if(_snd){const _bb=this.BB[a.team];if(_bb.conf<40){_bb.x=_snd.x;_bb.y=_snd.y;_bb.conf=30;_bb.frame=this.frame};a.state='A';a.stCD=0;break}}
        if(hasLOS){a.state='E';a.stCD=0;break}
        if(this.EC[a.team].length<=1){const _nk=this.frame-(this.lastKillFrame||0);if(_nk>480){a.state='A';a.stCD=0;break}}
        if(bb.conf>20&&this.frame-bb.frame<400){a.state='A';a.stCD=0;break}
        if(a.stCD<=0||!a.path||!a.path.length){
          const g=this._formGoal(a);this._rPath(a,g.x,g.y,true)
          if(a.path&&a.path.length)a.stCD=28+Math.floor(this.rng()*20)
          else{a.pgx=-1;a.pgy=-1;a.stCD=8+Math.floor(this.rng()*8)}
        }
        this._fp(a,a.role.spd*aSpd); break

      case 'A':
        if(hasLOS){a.state='E';a.stCD=0;break}
        if(bb.conf<5||this.frame-bb.frame>450){
          if(CFG.phero){const hot=this._pheroHot(1-a.team,a.x,a.y);if(hot){this._rPath(a,hot.x,hot.y,true);a.stCD=55;break}}
          const enE=this.EC[a.team]
          if(enE.length){
            const ecx=enE.reduce((s,e)=>s+e.x,0)/enE.length
            const ecy=enE.reduce((s,e)=>s+e.y,0)/enE.length
            this.BB[a.team].x=ecx;this.BB[a.team].y=ecy;this.BB[a.team].conf=30;this.BB[a.team].frame=this.frame
            break
          }
          a.state='H';a.stCD=0;break
        } else if(a.stCD<=0||!a.path||!a.path.length){
          // Approche par bond: viser _approachTarget (pincement) ou cover intermédiaire
          let _aDest={x:bb.x,y:bb.y}
          if(a._approachTarget){
            _aDest=a._approachTarget
          } else {
            const _bond=this._tacticalBond(a,bb)
            if(_bond)_aDest=_bond
          }
          this._rPath(a,_aDest.x,_aDest.y,true)
          if(a.path&&a.path.length)a.stCD=25+Math.floor(this.rng()*20)
          else{a.stCD=18;bb.conf=Math.max(0,bb.conf-30)}
        }
        if(this._fp(a,a.role.spd*aSpd)){
          if(!hasLOS){
            if(bb.conf>15)this._stepTo(a,bb.x,bb.y,a.role.spd*aSpd)
            else{bb.conf=0;a.state='H'}
          }
        }
        break

      case 'E':
        if(!hasLOS){a.state='A';a.stCD=0;break}
        if(!a.withdrawalRoute&&target){const route=this._withdrawalRoute(a,target);if(route){a.withdrawalRoute=route;a.withdrawalWP=0}}
        this._sDir(a,Math.atan2(target.y-a.y,target.x-a.x),.20)
        this._tryFire(a,target);this._tryGrenade(a,target)
        // Contact très rapproché (<3 tiles): orienter + tirer (sidearm inclus), skip mouvements
        if(dE<3){this._sDir(a,Math.atan2(target.y-a.y,target.x-a.x),.40);this._tryFire(a,target);break}
        if(a.ord==='S'){a.state='S';break}
        if(a.ord==='F'&&a.rn==='FLANKER'){a.state='P';a.stCD=0;break}
        // Smoke opportuniste (FLANKER sous feu frontal)
        if((a.rn==='FLANKER'||a.rn==='ASSAULT')&&a.smoke?.charges>0&&!a.smoke?.active)
          this._trySmoke(a)
        // Peek opportuniste: si en cover, tir court puis retour
        const _inCovPeek=this.map[Math.floor(a.y)]?.[Math.floor(a.x)]===2
        const _peekChance=a.rn==='FLANKER'?.06:a.rn==='SNIPER'?.03:a.rn==='ASSAULT'?.04:0
        if(_inCovPeek&&hasLOS&&this.rng()<_peekChance&&dE>4&&dE<a.role.rng*.9){
          a.state='P';a.pkPh=null;a.stCD=0;break
        }
        if(a.rn==='SNIPER'&&dE<9){const sc=this._bestCover(a,target);if(sc)this._rPath(a,sc.x+.5,sc.y+.5,true);else this._rPath(a,a.x-(target.x-a.x)*3,a.y-(target.y-a.y)*3,true);this._fp(a,a.role.spd*1.3);this._tryFire(a,target)}
        else if(a.rn==='ASSAULT'&&dE>4)this._stepTo(a,target.x,target.y,a.role.spd*.4*aSpd,target)
        else if(a.rn==='LEADER'&&dE>4){this._stepTo(a,target.x,target.y,a.role.spd*.35*aSpd,target);this._doStrafe(a,target)}
        else if(a.rn==='FLANKER'){
          // Mémoriser flankGoal 120f — pas de path-flipping si cible bouge
          if(a._crossfireGoal&&this.frame-a._crossfireGoal.frame<80){const cg=a._crossfireGoal;if(Math.hypot(a.x-cg.x,a.y-cg.y)>1.2){this._rPath(a,cg.x,cg.y);this._fp(a,a.role.spd*.9*aSpd);break}else a._crossfireGoal=null}
          if(!a._flankGoalFrame||this.frame-a._flankGoalFrame>120||!a._flankGoal){
            a._flankGoal=this._flankGoal(a,target); a._flankGoalFrame=this.frame
          }
          const _dfg=a._flankGoal?Math.hypot(a.x-a._flankGoal.x,a.y-a._flankGoal.y):99
          a._flankReady=_dfg<3.5
          if(a._flankReady){a.state='E';a.stCD=0}
          else{
            // Waypoint 2 phases: d'abord waypoint perpendiculaire (hors cône),
            // puis approche finale du dos ennemi
            if(!a._flankWP||this.frame-a._flankGoalFrame>120){
              // WP latéral: 90° hors du cône ennemi, entre nous et la cible finale
              const _eDir=target.dir
              const _side=a.uid%2===0?1:-1
              const _wpAng=_eDir+Math.PI*.5*_side
              const _wx=Math.max(2,Math.min(this.MW-3,target.x+Math.cos(_wpAng)*8))
              const _wy=Math.max(2,Math.min(this.MH-3,target.y+Math.sin(_wpAng)*8))
              a._flankWP={x:_wx,y:_wy}
            }
            const _dwp=a._flankWP?Math.hypot(a.x-a._flankWP.x,a.y-a._flankWP.y):99
            const _dest=_dwp>3?a._flankWP:a._flankGoal  // 1er le WP, puis la cible finale
            this._rPath(a,_dest.x,_dest.y)
            this._fp(a,a.role.spd*.62*aSpd,target)
          }
        }
        else if(a.rn==='SUPPORT'){
          const _koA=this.agents.find(f=>f.team===a.team&&f.state==='KO'&&!f.revived&&Math.hypot(f.x-a.x,f.y-a.y)<3.5)
          if(_koA){a.state='RV';a.rvTarget=_koA;a.rvCD=90;a.stCD=0;break}
          const supMinDist=this.agents.some(f=>f.team===a.team&&f.rn==='FLANKER'&&f.hp>0)?9:4
          if(dE>supMinDist){if(a.stCD<=0){const cov=this._bestCover(a,target);if(cov){this._rPath(a,cov.x+.5,cov.y+.5);a.stCD=40}}this._fp(a,a.role.spd*.4*aSpd,target);this._doStrafe(a,target)}  // face-enemy movement
          else this._doStrafe(a,target)
        }
        else this._doStrafe(a,target); break

      case 'S':
        if(!hasLOS){
          // SNIPER sans LOS: se repositionner vers un vantage avec vue
          if(a.rn==='SNIPER'&&a.stCD<=0){
            const _vp=this._sniperVantage(a)
            if(_vp){this._rPath(a,_vp.x,_vp.y,true);a.stCD=60}
          }
          if(!a.path||!a.path.length)a.state='A'
          else this._fp(a,a.role.spd*aSpd)
          break
        }
        this._sDir(a,Math.atan2(target.y-a.y,target.x-a.x),.15)
        this._tryFire(a,target)
        // Suppression zone: tirs de couverture légèrement dispersés
        if(this.rng()<.2){const _sf=a.shotsFired;this._fire(a,{x:target.x+(this.rng()-.5)*2.5,y:target.y+(this.rng()-.5)*2.5,team:target.team});a.shotsFired=_sf;this._ps(target.x,target.y,'sup',2)}
        // SNIPER overwatch: tirer aussi sur tout autre ennemi visible qui menace un allié
        if(a.rn==='SNIPER'){
          const visAllE=this.EC[a.team].filter(e=>e.rn!=='DRONE'&&this._canSee(a,e)&&e!==target)
          for(const _oe of visAllE){
            const _allyNear=this.agents.some(f=>f.team===a.team&&f.hp>0&&f!==a&&Math.hypot(f.x-_oe.x,f.y-_oe.y)<6)
            if(_allyNear){this._sDir(a,Math.atan2(_oe.y-a.y,_oe.x-a.x),.2);this._tryFire(a,_oe);break}
          }
        }
        this._tryGrenade(a,target)
        const flk=this.agents.find(f=>f.team===a.team&&f.rn==='FLANKER'&&f.hp>0)
        if((flk&&Math.hypot(flk.x-target.x,flk.y-target.y)<6)||!hasLOS)a.state='E'; break

      case 'F':  // FLANKER proactif sans LOS
        if(hasLOS){a.state='E';a.stCD=0;break}
        if(a._flankGoal){this._rPath(a,a._flankGoal.x,a._flankGoal.y);this._fp(a,a.role.spd*.65*aSpd)}
        else{a.state='A'}
        break
      case 'P':{
        // ── PEEK & SHOOT — 4 phases séquentielles ──────────
        // Phase mv: aller vers cover adjacent optimal (hors cône)
        // Phase aim: orienter, synchroniser tir
        // Phase fr: burst court (1-2 tirs), rester exposé min
        // Phase wb: retour en cover (preferSafe)
        if(!hasLOS&&!a.pkPh){a.state='A';break}
        if(!a.pkPh){a.pkPh='mv';a.stCD=0;a.pkShots=0}
        if(a.pkPh==='mv'){
          // Chercher cover adjacent avec vue partielle
          const nb=this._findBestNeighbor(a,target,false,a.rn==='FLANKER')
          if(nb&&a.stCD<=0){this._rPath(a,nb.x,nb.y,true);a.stCD=Math.floor(a.role.spd*-600+60)}
          const reached=Math.hypot(a.x-(a.pkDest?.x||a.x),a.y-(a.pkDest?.y||a.y))<.8
          if(this._fp(a,a.role.spd*1.15*aSpd)||a.stCD<=0){a.pkPh='aim';a.stCD=8}
        }
        else if(a.pkPh==='aim'){
          this._sDir(a,Math.atan2(target.y-a.y,target.x-a.x),.35)
          if(a.stCD<=0){a.pkPh='fr';a.stCD=a.rn==='SNIPER'?30:a.rn==='FLANKER'?12:20;a.pkShots=0}
        }
        else if(a.pkPh==='fr'){
          this._sDir(a,Math.atan2(target.y-a.y,target.x-a.x),.30)
          this._tryFire(a,target)
          a.pkShots=(a.pkShots||0)+1
          // FLANKER: 2 tirs max, SNIPER: 1 tir, autres: 3 tirs
          const maxShots=a.rn==='SNIPER'?1:a.rn==='FLANKER'?2:3
          if(a.pkShots>=maxShots||a.stCD<=0){a.pkPh='wb';a.stCD=18}
        }
        else if(a.pkPh==='wb'){
          // Retour vers cover sûr
          const nb2=this._findBestNeighbor(a,target,true,false)
          if(nb2&&a.stCD<=0){this._rPath(a,nb2.x,nb2.y,true);a.stCD=12}
          this._fp(a,a.role.spd*1.05*aSpd)
          if(a.stCD<=0){a.pkPh=null;a.state=a.rn==='FLANKER'?'F':'E'}
        }
        break}

      case 'AM':{
        if(hasLOS){
          this._sDir(a,Math.atan2(target.y-a.y,target.x-a.x),.35)
          this._tryFire(a,target);this._tryGrenade(a,target)
          if((a.rn==='FLANKER'||a.rn==='SNIPER')&&this.frame%15===0){
            const bb2=this.BB[a.team];bb2.x=target.x;bb2.y=target.y;bb2.conf=Math.min(100,bb2.conf+20);bb2.frame=this.frame
            for(const f of this.agents)if(f.team===a.team&&f.hp>0&&f!==a&&f.state==='H')f.state='A'
          }
          if(!a.amShotsLeft)a.amShotsLeft=3+Math.floor(this.rng()*3)
          a.amShotsLeft--
          if(a.amShotsLeft<=0){a.disperseCD=55;a.state='D';a.amShotsLeft=0}
          break
        }
        if(this.alive[a.team]<=1){
          // Sniper 1v1: si pas de LOS depuis longtemps → chercher vantage actif
          if(!hasLOS){
            a.patience=(a.patience||0)+1
            if(a.patience>80){  // ~1.3s sans contact → se repositionner
              a.patience=0;a.ambushPos=null
              // Se déplacer vers un nouveau point de visée (pas le spawn)
              const _cx=this.MW/2+(this.rng()-.5)*this.MW*.3
              const _cy=this.MH/2+(this.rng()-.5)*this.MH*.3
              this._rPath(a,Math.max(2,Math.min(this.MW-3,_cx)),Math.max(2,Math.min(this.MH-3,_cy)),true)
            }
          }
          a.state='A';a.stCD=0;break
        }
        const arrived=a.ambushPos&&Math.hypot(a.x-a.ambushPos.x,a.y-a.ambushPos.y)<1.0
        if(!arrived&&(!a.ambushPos||a.stCD<=0)){
          const pos=this._ambushPos(a)
          if(pos){a.ambushPos=pos;this._rPath(a,pos.x,pos.y,true);a.stCD=80}
          else{a.state='H';break}
        }
        if(arrived){
          this._sDir(a,this._ambushWatchDir(a),0.08)
          a.patience=(a.patience||0)+1
          if(a.patience>120){a.ambushPos=null;a.patience=0;a.state='H';a.stCD=0}
        } else {
          this._fp(a,a.role.spd*1.1*aSpd)
        }
        break
      }

      case 'RV':{
        const rv=a.rvTarget
        if(!rv||rv.state!=='KO'||rv.revived||rv.hp<0){a.state='A';a.rvTarget=null;a.rvCD=0;break}  // hp<0 = mort définitive
        if(Math.hypot(rv.x-a.x,rv.y-a.y)>1.0){this._rPath(a,rv.x,rv.y,true);this._fp(a,a.role.spd*.9)}
        else{a.rvCD=(a.rvCD||90)-1;this._sDir(a,Math.atan2(rv.y-a.y,rv.x-a.x),.5);this._ps(rv.x+(this.rng()-.5)*.5,rv.y+(this.rng()-.5)*.5,'sup',1);if(a.rvCD<=0){rv.hp=Math.floor(rv.role.hp*.28);rv.hpSmooth=rv.hp;rv.state='A';rv.revived=true;rv.stCD=0;rv.path=[];rv.mag=Math.floor(rv.role.mag*.5);rv._wpScdPenalty=0;rv._wpRelPenalty=0;rv._coverFrames=0;a.state='A';a.rvTarget=null;a.rvCD=0;this._ps(rv.x,rv.y,'sup',8);if(this.floats)this.floats.push({x:rv.x,y:rv.y-1,text:'REVIVE!',life:70,ml:70,col:'#44ff88',vy:-0.025})}}
        break
      }
      case 'D':{
        if(hasLOS&&target){
          this._tryFire(a,target)
          // En 1v1 avec LOS: sortir de D immédiatement pour engager
          const _d1v1=this.alive[a.team]<=1&&this.EC[a.team].length<=1
          if(_d1v1){a.state='E';a.stCD=0;break}
        }
        if(a.stCD<=0||!a.path||!a.path.length){
          const away=this._disperseGoal(a,closE)
          this._rPath(a,away.x,away.y,true)
          a.stCD=55
        }
        this._fp(a,a.role.spd*1.15*aSpd)
        if(this.frame%4===a.uid%4)this._ps(a.x,a.y,'spark',1)
        if(a.disperseCD<=0){a.state=this.EC[a.team].length?'A':'H';a.stCD=0;a._rTimer=0}
        break
      }

      case 'R':{
        // Smoke: couvrir la retraite si possible
        if(a.smoke?.charges>0&&!a.smoke.active)this._trySmoke(a)
        if(a.stCD<=0){
          const route=a.withdrawalRoute
          if(route&&a.withdrawalWP<route.length){
            const wp=route[a.withdrawalWP]
            this._rPath(a,wp.x,wp.y,true)
            if(Math.hypot(a.x-wp.x,a.y-wp.y)<1.5)a.withdrawalWP++
            a.stCD=20
          } else {
            a.withdrawalRoute=null
            // SNIPER: retraite = chercher vantage avec LOS, pas cover générique
            if(a.rn==='SNIPER'){
              const _vp=this._sniperVantage(a)
              if(_vp){this._rPath(a,_vp.x,_vp.y,true);a.stCD=40}
              else{this._rPath(a,a.x-(closE.x-a.x)*.5,a.y-(closE.y-a.y)*.5,true);a.stCD=25}
            }
            // FLANKER: retraite = repositionnement LATÉRAL vers flanc, pas vers spawn
            else if(a.rn==='FLANKER'){
              const _fp=this._flankRetreatGoal(a,closE)
              if(_fp){this._rPath(a,_fp.x,_fp.y,true);a.stCD=35}
              else{const rc=this._bestCover(a,closE);if(rc)this._rPath(a,rc.x+.5,rc.y+.5,true);a.stCD=25}
            }
            else{
              const rc=this._bestCover(a,closE)
              if(rc)this._rPath(a,rc.x+.5,rc.y+.5,true)
              else this._rPath(a,a.x-(closE.x-a.x),a.y-(closE.y-a.y),true)
              a.stCD=25
            }
          }
        }
        // Mouvement de retraite: sprint de base
        const rSpd=a.role.spd*(hpR<.25?.95:1.05)*aSpd  // blessé = plus lent
        // Si chemin vide → repositionnement immédiat
        if(!a.path||!a.path.length){a.stCD=0}
        // En retraite: garder l'ennemi en vue (backpedal face à lui)
        this._fp(a,rSpd,target||closE)
        // Tir en retraite: tirer PENDANT la fuite si LOS
        if(target&&hasLOS){
          this._sDir(a,Math.atan2(target.y-a.y,target.x-a.x),.12)
          this._tryFire(a,target)
          if(hpR>.3&&a.role.strafe) this._doStrafe(a,target)
        }
        const inCov=this.map[Math.floor(a.y)]?.[Math.floor(a.x)]===2
        const _exitR=Math.max(0.38,NN.retreatBias(a)+0.05)
        if(a.hp/a.role.hp>_exitR&&a.stCD<=0&&(inCov||!hasLOS)){
          // FLANKER: après retraite latérale → reprendre le flanc (pas H)
          if(a.rn==='FLANKER'&&this.EC[a.team].length>0){
            a.state='F';a._rTimer=0;a.stCD=0  // retour direct en mode flanking
          } else {
            a.state='H';a._rTimer=0
          }
          break
        }
        // SORTIE FORCÉE: 600f max en R
        a._rTimer=(a._rTimer||0)+1
        const _rMax=(this.alive[a.team]<=1&&this.EC[a.team].filter(e=>e.rn!=='DRONE').length<=1)?400:600
        if(a._rTimer>_rMax){
          a._rTimer=0
          if(!hasLOS){a.state='A';a.stCD=0}
          else{a.state='E';a.stCD=0}  // engagement désespéré
        }
        if(!hasLOS&&!this.EC[a.team].length){a.state='H';a.stCD=0;a._rTimer=0}
        break
      }
    }
  }

  _formGoal(a){
    const cx=this.centroid[a.team].x,cy=this.centroid[a.team].y
    const bb=this.BB[a.team]
    let tx=bb.conf>10?bb.x:(a.team===0?this.MW*.78:this.MW*.22),ty=bb.conf>10?bb.y:this.MH/2
    if(CFG.mode==='zones'){
      const mz=this.ZONES.filter(z=>z.ctrl!==a.team)
      if(mz.length){const z=mz.reduce((b,z)=>Math.hypot(z.x-cx,z.y-cy)<Math.hypot(b.x-cx,b.y-cy)?z:b);tx=z.x;ty=z.y}
    }
    const march=Math.atan2(ty-cy,tx-cx),perp=march+Math.PI/2
    const slot=Math.max(0,RK.indexOf(a.rn))  // DRONE=-1 → 0
    const [fwd,lat]=FORMATION[Math.min(slot,FORMATION.length-1)]
    const side=a.team===0?1:-1
    // FIX B: scale fwd by dist to target so lone agent pushes harder
    const distToTgt=Math.hypot(tx-cx,ty-cy)
    const fwdScale=Math.max(1,Math.min(4,distToTgt/5))
    return{x:Math.max(2,Math.min(this.MW-3,cx+Math.cos(march)*fwd*fwdScale+Math.cos(perp)*lat*side)),y:Math.max(2,Math.min(this.MH-3,cy+Math.sin(march)*fwd*fwdScale+Math.sin(perp)*lat*side))}
  }

  // Retraite flanker = aller sur le côté, hors du cône ennemi
  // Pas vers spawn, mais position perpendiculaire pour relancer le flanc
  _flankRetreatGoal(a,enemy){
    const side=a.uid%2===0?1:-1
    const toE=Math.atan2(enemy.y-a.y,enemy.x-a.x)
    // Direction perpendiculaire → hors du cône de visée ennemi
    const perpAng=toE+Math.PI/2*side
    const dist=8+this.rng()*4
    const fx=Math.max(2,Math.min(this.MW-3,a.x+Math.cos(perpAng)*dist))
    const fy=Math.max(2,Math.min(this.MH-3,a.y+Math.sin(perpAng)*dist))
    // Vérifier que la destination est hors du FOV ennemi
    const angFromE=Math.atan2(fy-enemy.y,fx-enemy.x)
    const fovDiff=this._ad(enemy.dir,angFromE)
    if(fovDiff>(enemy.role?.fov||Math.PI)*.5&&this.pass(Math.floor(fx),Math.floor(fy))){
      return{x:fx,y:fy}
    }
    // Fallback: côté opposé
    const perpAng2=toE-Math.PI/2*side
    const fx2=Math.max(2,Math.min(this.MW-3,a.x+Math.cos(perpAng2)*dist))
    const fy2=Math.max(2,Math.min(this.MH-3,a.y+Math.sin(perpAng2)*dist))
    return this.pass(Math.floor(fx2),Math.floor(fy2))?{x:fx2,y:fy2}:null
  }

  // Smoke — détecte si une position est dans un nuage de fumée allié ou ennemi
  _isInSmoke(x,y,teamOnly=-1){
    for(const ag of this.agents){
      if(!ag.smoke?.active) continue
      if(teamOnly>=0&&ag.team!==teamOnly) continue
      if(Math.hypot(ag.smoke.x-x,ag.smoke.y-y)<4) return true
    }
    return false
  }

  // Poser une grenade fumigène (FLANKER: retraite/flanc; ASSAULT: couverture fuite)
  _trySmoke(a){
    if(!a.smoke||a.smoke.charges<=0||a.smoke.active||a.smoke.cd>0) return false
    // FLANKER: fumer si danger élevé et ennemi proche
    const ec=this.EC[a.team].filter(e=>e.rn!=='DRONE')
    if(!ec.length) return false
    const closE=ec.reduce((b,e)=>Math.hypot(e.x-a.x,e.y-a.y)<Math.hypot(b.x-a.x,b.y-a.y)?e:b,ec[0])
    const dE=Math.hypot(closE.x-a.x,closE.y-a.y)
    const tx=Math.floor(a.x),ty=Math.floor(a.y)
    const dng=(this.danger[ty]?.[tx]||0)
    const shouldSmoke=(a.rn==='FLANKER'&&(dng>20||dE<5)&&a.hp/a.role.hp<.6)||
                      (a.rn==='ASSAULT'&&a.state==='R'&&dE<8)
    if(!shouldSmoke) return false
    a.smoke.active=true; a.smoke.x=a.x; a.smoke.y=a.y
    a.smoke.timer=115+Math.floor(this.rng()*20)  // ~2s (+1s)
    a.smoke.charges--; a.smoke.cd=400  // cooldown 6.7s
    this._ps(a.x,a.y,'smoke',6)  // particules visuelles immédiates
    if(this.floats)this.floats.push({x:a.x,y:a.y-1,text:'SMOKE',life:40,ml:40,col:'#aaaaaa',vy:-0.02})
    return true
  }

  _flankGoal(a,e){
    const side=a.uid%2===0?1:-1
    // Objectif: angle mort DERRIÈRE l'ennemi (dos = e.dir + PI)
    // Légèrement de côté pour contournement réaliste
    const backAng=e.dir+Math.PI+side*Math.PI*.45  // 81° derrière l'ennemi
    const fDist=6+this.rng()*3
    const fx=Math.max(2,Math.min(this.MW-3,e.x+Math.cos(backAng)*fDist))
    const fy=Math.max(2,Math.min(this.MH-3,e.y+Math.sin(backAng)*fDist))
    // Chercher cover dans l'angle mort de l'ennemi
    if(this.cov.length>4){
      let best=null,bs=99
      for(const n of this.cov){
        const d=Math.hypot(n.x-fx,n.y-fy)
        if(d>8)continue
        const dSelf=Math.hypot(n.x-a.x,n.y-a.y)
        if(dSelf<3)continue  // pas trop proche de nous
        // DOIT être dans l'angle mort (hors du FOV ennemi)
        const angFromE=Math.atan2(n.y-e.y,n.x-e.x)
        const fovDiff=this._ad(e.dir,angFromE)
        if(fovDiff<(e.role?.fov||Math.PI)*.5)continue  // encore dans le FOV → skip
        if(d<bs){bs=d;best=n}
      }
      if(best)return{x:best.x+.5,y:best.y+.5}
    }
    return{x:fx,y:fy}
  }

  _pheroHot(et,cx,cy,r=8){
    let best=null,bv=.05
    for(let y=Math.max(0,Math.floor(cy-r));y<=Math.min(this.MH-1,Math.floor(cy+r));y++)
      for(let x=Math.max(0,Math.floor(cx-r));x<=Math.min(this.MW-1,Math.floor(cx+r));x++){
        const v=this.phero[et][y][x]
        if(v>bv&&this.pass(x,y)){bv=v;best={x:x+.5,y:y+.5}}
      }
    return best
  }

  // Find best ambush position: cover tile with LOS potential on enemy pheromone corridor
  _ambushPos(a){
    if(!this.cov.length||!this.phero) return null
    const et=1-a.team
    let best=null,bs=-99
    for(const n of this.cov){
      // Phero value of enemy at this cover tile (enemy passes here)
      const py=this.phero[et][n.y]?.[n.x]||0
      if(py<0.04) continue  // no enemy trace here — skip
      // Prefer cover that isn't currently occupied by ally
      const occupied=this.agents.some(f=>f.team===a.team&&f.hp>0&&f!==a&&Math.hypot(f.x-n.x,f.y-n.y)<2)
      if(occupied) continue
      const dist=Math.hypot(n.x-a.x,n.y-a.y)
      const s=py*50 - dist*0.3 + (n.y>2&&n.y<this.MH-3?5:0)
      if(s>bs){bs=s;best={x:n.x+.5,y:n.y+.5}}
    }
    return best
  }

  // Direction to watch from ambush position — toward highest enemy phero
  _ambushWatchDir(a){
    if(!a.ambushPos||!this.phero) return a.dir
    const et=1-a.team
    let bx=0,by=0,bv=0
    const r=6
    for(let y=Math.max(0,Math.floor(a.y-r));y<=Math.min(this.MH-1,Math.floor(a.y+r));y++)
      for(let x=Math.max(0,Math.floor(a.x-r));x<=Math.min(this.MW-1,Math.floor(a.x+r));x++){
        const v=this.phero[et][y][x]||0
        if(v>bv){bv=v;bx=x+.5;by=y+.5}
      }
    return bv>0.04?Math.atan2(by-a.y,bx-a.x):a.dir
  }

  // Dispersal goal: random cover in opposite direction from enemy
  _droneTick(a){
    const bb=this.BB[a.team],enemies=this.EC[a.team],aSpd=this._auraSpd(a)
    let spotted=null
    for(const e of enemies){
      if(this._canSee(a,e)){
        spotted=e
        if(isFinite(e.x)){
          bb.x=e.x;bb.y=e.y;bb.conf=100;bb.frame=this.frame
          for(const f of this.agents){
            if(f===a||f.team!==a.team||f.hp<=0||f.state==='KO')continue
            const fb=this.BB[f.team];fb.x=e.x;fb.y=e.y;fb.frame=this.frame;fb.conf=98
          }
        }
        break
      }
    }
    if(a.hpSmooth===undefined)a.hpSmooth=a.hp;else a.hpSmooth=a.hpSmooth*.72+a.hp*.28
    const allies=this.agents.filter(f=>f.team===a.team&&f.hp>0&&f.rn!=='DRONE')
    const ac=allies.length?{x:allies.reduce((s,f)=>s+f.x,0)/allies.length,y:allies.reduce((s,f)=>s+f.y,0)/allies.length}:{x:a.x,y:a.y}
    // Fuite si ennemi trop proche
    let fleeing=false
    for(const e of enemies){
      if(Math.hypot(e.x-a.x,e.y-a.y)<5){
        const fx=Math.max(2,Math.min(this.MW-3,a.x-(e.x-a.x)*2)),fy=Math.max(2,Math.min(this.MH-3,a.y-(e.y-a.y)*2))
        this._rPath(a,fx,fy,true);this._fp(a,a.role.spd*1.6);a.state='R';fleeing=true;break
      }
    }
    if(!fleeing){
      if(spotted){
        const dE2=Math.hypot(spotted.x-a.x,spotted.y-a.y)
        if(dE2<9){const awX=Math.max(2,Math.min(this.MW-3,a.x-(spotted.x-a.x)/dE2*3)),awY=Math.max(2,Math.min(this.MH-3,a.y-(spotted.y-a.y)/dE2*3));this._stepTo(a,awX,awY,a.role.spd*1.4)}
        else this._sep(a)
        a.state='E'
        if(this.frame%8===a.uid%8)this._ps(a.x+(this.rng()-.5)*.4,a.y+(this.rng()-.5)*.4,'sup',1)
      } else if(bb.conf>20){
        if(a.stCD<=0||!a.path||!a.path.length){
          const ratio=0.6,sx2=Math.max(2,Math.min(this.MW-3,ac.x+(bb.x-ac.x)*ratio)),sy2=Math.max(2,Math.min(this.MH-3,ac.y+(bb.y-ac.y)*ratio))
          this._rPath(a,sx2,sy2,true);a.stCD=45
        }
        this._fp(a,a.role.spd*aSpd);a.state='A'
      } else {
        if(a.stCD<=0||!a.path||!a.path.length){
          const pa=(this.frame*.002+a.uid*Math.PI)%(Math.PI*2),pr=8
          this._rPath(a,Math.max(3,Math.min(this.MW-4,ac.x+Math.cos(pa)*pr)),Math.max(3,Math.min(this.MH-4,ac.y+Math.sin(pa)*pr)),true);a.stCD=60
        }
        this._fp(a,a.role.spd*aSpd);a.state='H'
      }
    }
  }

  // Trouver position d'overwatch pour le sniper
  // Priorité: LOS sur ennemi BB + distance optimale (10-18 tiles)
  // Medkit: SUPPORT soigne les alliés blessés à portée
  _tryHeal(a){
    if(!a.medkit||a.medkit.charges<=0||a.medkit.cd>0) return false
    const ec2=this.agents.filter(f=>f.team===a.team&&f.hp>0&&f!==a&&f.rn!=='DRONE')
    // Priorité: KO d'abord (revive passif 15HP), puis HP bas
    const koNear=ec2.find(f=>f.state==='KO'&&Math.hypot(f.x-a.x,f.y-a.y)<a.medkit.range*.7)
    if(koNear){
      koNear.hp=Math.min(koNear.role.hp*.35,koNear.hp+a.medkit.power)
      koNear.state='A';koNear.revived=true;koNear.stCD=0
      a.medkit.charges--;a.medkit.cd=200
      this._ps(koNear.x,koNear.y,'sup',5)
      if(this.floats)this.floats.push({x:koNear.x,y:koNear.y-1.5,text:'+KIT',life:50,ml:50,col:'#44ff88',vy:-0.02})
      return true
    }
    // Soigner allié HP bas à portée
    const wounded=ec2.filter(f=>f.hp/f.role.hp<.55&&Math.hypot(f.x-a.x,f.y-a.y)<a.medkit.range)
      .sort((a2,b2)=>a2.hp/a2.role.hp-b2.hp/b2.role.hp)
    if(wounded.length){
      const t=wounded[0]
      t.hp=Math.min(t.role.hp,t.hp+a.medkit.power)
      a.medkit.charges--;a.medkit.cd=180
      this._ps(t.x,t.y,'sup',4)
      if(this.floats)this.floats.push({x:t.x,y:t.y-1.5,text:`+${a.medkit.power}HP`,life:45,ml:45,col:'#66ffaa',vy:-0.02})
      return true
    }
    return false
  }

  _sniperVantage(a){
    const bb=this.BB[a.team]
    if(!bb||bb.conf<15)return null
    const allies=this.agents.filter(f=>f.team===a.team&&f.hp>0&&f!==a&&f.rn!=='DRONE')
    const allyCx=allies.length?allies.reduce((s,f)=>s+f.x,0)/allies.length:a.x
    const allyCy=allies.length?allies.reduce((s,f)=>s+f.y,0)/allies.length:a.y
    let best=null, bs=-999
    for(const n of this.cov){
      const dE=Math.hypot(n.x-bb.x,n.y-bb.y)
      if(dE<8||dE>20)continue  // trop proche ou trop loin
      // Vérifier LOS vers position ennemie BB
      if(!this._rc(n.x+.5,n.y+.5,bb.x,bb.y))continue  // pas de LOS vers ennemi
      const dSelf=Math.hypot(n.x-a.x,n.y-a.y)
      if(dSelf<2)continue
      // Bonus si position couvre les alliés (entre alliés et ennemi)
      const allyAng=Math.atan2(allyCy-n.y,allyCx-n.x)
      const enAng=Math.atan2(bb.y-n.y,bb.x-n.x)
      const coverage=Math.cos(this._ad(allyAng,enAng+Math.PI))
      let s=coverage*15-dSelf*.3-this.danger[n.y]?.[n.x]*.5
      // Pénaliser si allié occupe déjà un angle proche
      for(const ally of allies){
        if(Math.hypot(ally.x-n.x,ally.y-n.y)<3)s-=10
      }
      if(s>bs){bs=s;best=n}
    }
    return best?{x:best.x+.5,y:best.y+.5}:null
  }

  _getEncirclePosition(tgt,idx,total){
    const a2=Math.PI/(total+1)*(idx+1),dist=8
    return{x:Math.max(2,Math.min(this.MW-3,tgt.x+Math.cos(a2)*dist)),y:Math.max(2,Math.min(this.MH-3,tgt.y+Math.sin(a2)*dist))}
  }

  // Pathfinding local 1-tile — meilleure tile adjacente pour un objectif
  // preferSafe: pénalise danger | preferFlank: bonus si hors cône ennemi
  _findBestNeighbor(a, enemy, preferSafe=false, preferFlank=false){
    const dirs=[
      {dx:0,dy:0},{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},
      {dx:1,dy:1},{dx:-1,dy:-1},{dx:1,dy:-1},{dx:-1,dy:1}
    ]
    let best=null, bs=-Infinity
    for(const d of dirs){
      const nx=Math.floor(a.x)+d.dx, ny=Math.floor(a.y)+d.dy
      if(!this.pass(nx,ny)) continue
      let s=0
      // Cover bonus
      if(this.map[ny]?.[nx]===2) s+=0.5
      // Danger penalty (toujours)
      const dng=this.danger[ny]?.[nx]||0
      s-=dng*.012
      // Heatmap penalty (zone chaude)
      if(this.hmActivity) s-=(this.hmActivity[ny*this.MW+nx]||0)*.008
      if(preferSafe) s-=dng*.02
      if(enemy){
        const dE=Math.hypot(nx-enemy.x,ny-enemy.y)
        // LOS bonus
        if(this._rc(nx+.5,ny+.5,enemy.x,enemy.y)) s+=0.3
        // Distance optimale vs rôle
        s+=Math.max(0, 1-Math.abs(dE-a.role.rng*.6)/a.role.rng)*.2
        if(preferFlank&&enemy.role){
          // Bonus si hors cône FOV ennemi
          const angFromE=Math.atan2(ny-enemy.y,nx-enemy.x)
          const fovDiff=this._ad(enemy.dir,angFromE)
          if(fovDiff>(enemy.role.fov||Math.PI)*.55) s+=0.4
        }
      }
      if(s>bs){bs=s;best={x:nx+.5,y:ny+.5}}
    }
    return best
  }

  _tacticalBond(a,bb){
    if(!this.cov.length||!bb)return null
    const toEnemy=Math.atan2(bb.y-a.y,bb.x-a.x)
    const dE=Math.hypot(bb.x-a.x,bb.y-a.y)
    if(dE<5)return null
    const midX=a.x+Math.cos(toEnemy)*dE*.5, midY=a.y+Math.sin(toEnemy)*dE*.5
    let best=null,bs=99
    for(const n of this.cov){
      const dMid=Math.hypot(n.x-midX,n.y-midY)
      if(dMid>6)continue
      const dSelf=Math.hypot(n.x-a.x,n.y-a.y)
      if(dSelf<2)continue
      const angDiff=this._ad(Math.atan2(n.y-a.y,n.x-a.x),toEnemy)
      if(angDiff>Math.PI*.5)continue
      if(dMid<bs){bs=dMid;best=n}
    }
    return best?{x:best.x+.5,y:best.y+.5}:null
  }

  _disperseGoal(a, enemy){
    const awayDir=enemy?Math.atan2(a.y-enemy.y,a.x-enemy.x):this.rng()*Math.PI*2
    const spread=Math.PI*0.6  // ±54°
    const candidates=this.cov.filter(n=>{
      const d=Math.hypot(n.x-a.x,n.y-a.y)
      if(d<4||d>14) return false
      const ang=Math.atan2(n.y-a.y,n.x-a.x)
      return this._ad(ang,awayDir)<spread
    })
    if(candidates.length){
      const c=candidates[Math.floor(this.rng()*candidates.length)]
      return{x:c.x+.5,y:c.y+.5}
    }
    // Fallback: move away from enemy
    return{
      x:Math.max(2,Math.min(this.MW-3,a.x+Math.cos(awayDir)*8)),
      y:Math.max(2,Math.min(this.MH-3,a.y+Math.sin(awayDir)*8))
    }
  }

  _tryGrenade(a,target){
    if(!CFG.grenades||!a.role.grenadCD)return
    if(a.gCD>0){a.gCD--;return}
    const dE=Math.hypot(target.x-a.x,target.y-a.y)
    if(dE<3||dE>12)return
    const cl=this.agents.filter(e=>e.team!==a.team&&e.hp>0&&e.state!=='KO'&&Math.hypot(e.x-target.x,e.y-target.y)<3)
    if(!cl.length)return
    const _inCover=(target._coverFrames||0)>50
    if(!_inCover&&this.rng()>.15)return  // aléatoire si pas en cover
    const b={x:a.x,y:a.y,tx:target.x,ty:target.y,team:a.team,grenade:true,age:0,mx:90,vx:0,vy:0}
    this.bullets.push(b); a.gCD=a.role.grenadCD
    if(_inCover&&this.floats)this.floats.push({x:a.x,y:a.y-1,text:'FLUSH!',life:35,ml:35,col:'#ffaa44',vy:-0.02})
  }

  // ── FIRE ─────────────────────────────────────────
  _fire(a,b){
    // Sidearm mode: bypass primary cooldown/mag check
    if(a.sqActive){
      if(a.sqCD>0)return
      if(!b||!isFinite(b.x)||!isFinite(b.y))return
      if(a.sqMag<=0){a.sqActive=false;return}  // sidearm empty → fall through to reload
      a.shotsFired=(a.shotsFired||0)+1
      a.sqCD=SIDEARM.sCD;a.mzCD=4;a.sqMag--;a._lastShotRn='SIDEARM'
      SFX._shot('SIDEARM',a.x,this.MW)
      const ang=Math.atan2(b.y-a.y,b.x-a.x)  // FLAT sidearm aim (reverted from toroidal)
      this._ps(a.x+Math.cos(ang)*.5,a.y+Math.sin(ang)*.5,'muzz',2)
      const ba=ang+(this.rng()-.5)*SIDEARM.sprd
      this.bullets.push({x:a.x,y:a.y,vx:Math.cos(ba)*.55,vy:Math.sin(ba)*.55,
        team:a.team,dmg:SIDEARM.dmg,age:0,mx:22,grenade:false,
        trail:[{x:a.x,y:a.y}],_shooterId:a.uid,_fireId:a._fireId,_sq:true})
      return
    }
    if(a.sCD>0)return
    if(a.mag<=0){if(a.state!=='RL'){a.preRS=a.state;a.state='RL';a.relCD=a.role.relT;a.stCD=0;a.path=[]}return}
    if(!b||!isFinite(b.x)||!isFinite(b.y))return
    a.shotsFired=(a.shotsFired||0)+1
    this._jlog('FIRE',a,{tx:+b.x.toFixed(2),ty:+b.y.toFixed(2),tdist:+Math.hypot(b.x-a.x,b.y-a.y).toFixed(2)})
    SFX._shot(a.rn,a.x,this.MW);a._lastShotRn=a.rn
    const _sty=(CFG.teamStyle&&CFG.teamStyle[a.team])||'trained'
    const _scdMult=_sty==='aggressive'?.85:_sty==='guerrilla'?1.1:1.0
    const _wpM=(a._wpScdPenalty>0)?(a._wpScdMult||1):1
    a.sCD=Math.round(a.role.sCD*_scdMult*_wpM)
    a._coverFrames=0;a.mzCD=5;a.mag=Math.max(0,a.mag-a.role.bst)
    const ang=Math.atan2(b.y-a.y,b.x-a.x)  // FLAT aim (reverted from toroidal)
    this._ps(a.x+Math.cos(ang)*.6,a.y+Math.sin(ang)*.6,'muzz',4,ang)
    const spd=a.rn==='SNIPER'?.98:.70
    if(a.rn==='SNIPER'&&CFG.tracer)
      this.tracers.push({x1:a.x,y1:a.y,x2:a.x+Math.cos(ang)*a.role.rng,y2:a.y+Math.sin(ang)*a.role.rng,life:8,ml:8,team:a.team})
    for(let i=0;i<a.role.bst;i++){
      const ba=ang+(this.rng()-.5)*a.role.sprd*(a.supCD>0?1.5:1)   // suppression : -précision sous le feu
      _addSoundEvent(a.x,a.y,a.team,SOUND_RANGE[a.rn]||6,this.frame)
    this.bullets.push({x:a.x,y:a.y,vx:Math.cos(ba)*spd,vy:Math.sin(ba)*spd,team:a.team,dmg:a.role.dmg,age:0,mx:a.rn==='SNIPER'?95:55,grenade:false,trail:[{x:a.x,y:a.y}],_shooterId:a.uid,_fireId:a._fireId})
    }
  }

  // ── EXPLODE ──────────────────────────────────────
  _explode(gx,gy,team){
    this._ps(gx,gy,'exp',22)
    SFX.explosion(gx,this.MW)
    // Shockwave rings
    for(let w=0;w<3;w++) this.parts.push({x:gx,y:gy,t:'wave',mr:2.5+w*.9,life:14-w*3,ml:14-w*3,vx:0,vy:0})
    // Débris orange/rouge
    for(let i=0;i<8;i++){
      const a=this.rng()*Math.PI*2,spd=.08+this.rng()*.18
      this.parts.push({x:gx,y:gy,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,t:'ember',life:35+Math.floor(this.rng()*25),ml:60})
    }
    // Fumée persistante
    for(let i=0;i<5;i++){
      const a=this.rng()*Math.PI*2,spd=.015+this.rng()*.03
      this.parts.push({x:gx+(this.rng()-.5),y:gy+(this.rng()-.5),vx:Math.cos(a)*spd,vy:-Math.abs(Math.sin(a))*spd-.01,t:'smoke',life:90+Math.floor(this.rng()*60),ml:150})
    }
    const r=2.5
    for(let dy=-Math.ceil(r);dy<=Math.ceil(r);dy++) for(let dx=-Math.ceil(r);dx<=Math.ceil(r);dx++){
      const tx=Math.floor(gx)+dx,ty=Math.floor(gy)+dy
      if(tx<0||ty<0||tx>=this.MW||ty>=this.MH)continue
      if(Math.hypot(dx,dy)<=r){this.danger[ty][tx]=Math.min(this.danger[ty][tx]+22,50);if(this.wU){const _ek=ty*this.MW+tx;if(isFinite(this.wU[_ek]))this.wU[_ek]+=1.6}}
    }
    for(const a of this.agents){
      if(a.team===team||a.hp<=0)continue
      if(Math.hypot(a.x-gx,a.y-gy)<r){
        a.hp-=28+Math.floor(this.rng()*14);a.flCD=12
        if(a.hp>0){a.state='R';a.stCD=0;a.supCD=(a.supCD||0)+40}
        else{this._ps(a.x,a.y,a.team===0?'d0':'d1',12);this.deaths.push({x:a.x,y:a.y,team:a.team,age:0});if(this.hmActivity){const _kx=Math.floor(a.x),_ky=Math.floor(a.y);if(_kx>=0&&_ky>=0&&_kx<this.MW&&_ky<this.MH)this.hmActivity[_ky*this.MW+_kx]+=2.5}}
      }
    }
  }

  // ── MAIN UPDATE ───────────────────────────────────
  update(){
    if(this.state!=='run')return
    try{
    this.frame++

    // Populative cache
    this.alive[0]=0;this.alive[1]=0;this.centroid[0].x=0;this.centroid[0].y=0;this.centroid[1].x=0;this.centroid[1].y=0
    for(const a of this.agents){if(a.hp>0&&a.state!=='KO'&&a.rn!=='DRONE'){this.alive[a.team]++;this.centroid[a.team].x+=a.x;this.centroid[a.team].y+=a.y}}
    for(let t=0;t<2;t++){if(this.alive[t]>0){this.centroid[t].x/=this.alive[t];this.centroid[t].y/=this.alive[t]}}
    this._rebuildEC()
    if(++this.sqCD[0]>35){this._sqUpdate(0);this.sqCD[0]=0}
    if(++this.sqCD[1]>35){this._sqUpdate(1);this.sqCD[1]=0}
    // Global stalemate breaker: si 600f sans kill → forcer convergence
    if(!this.lastKillFrame) this.lastKillFrame=0
    const noKillFrames=this.frame-this.lastKillFrame
    if(noKillFrames>720&&this.frame%120===0){
      for(let t=0;t<2;t++){
        const alive=this.agents.filter(a=>a.team===t&&a.hp>0&&a.rn!=='DRONE')
        const enemies=this.EC[t]
        if(!alive.length||!enemies.length)continue
        const ecx=enemies.reduce((s,e)=>s+e.x,0)/enemies.length
        const ecy=enemies.reduce((s,e)=>s+e.y,0)/enemies.length
        // Forcer BB frais + approach pour tous
        this.BB[t].x=ecx; this.BB[t].y=ecy
        this.BB[t].conf=80; this.BB[t].frame=this.frame
        for(const a of alive){
          if(a.state==='H'||a.state==='A'){
            a.state='A'; a.stCD=0; a.pgx=-1; a.pgy=-1; a.path=[]
          }
        }
      }
    }
    // Day/night tick
    // dnCycle supprimé — jour permanent
    // Jamming
    if(CFG.jam){
      if(!this.jamActive){
        if(this.rng()<1/CFG.jamFreq){this.jamActive=true;this.jamTimer=Math.min(120,CFG.jamDur+Math.floor(this.rng()*CFG.jamDur*.5));this.jamTeam=this.rng()<.5?0:1;this.BB[this.jamTeam].conf=0}
      } else {
        this.jamTimer--; if(this.jamTeam>=0)this.BB[this.jamTeam].conf=Math.max(0,this.BB[this.jamTeam].conf*.85)
        if(this.jamTimer<=0){this.jamActive=false;this.jamTeam=-1}
      }
    }
    // BB decay
    // BB decay: plus lent la nuit (infos persistent plus longtemps dans l'obscurité)
    const _nightNow=false  // jour/nuit supprimé
    for(let _si=SOUND_EVENTS.length-1;_si>=0;_si--)if(this.frame-SOUND_EVENTS[_si].frame>180)SOUND_EVENTS.splice(_si,1)
    // ── HEATMAPS TACTIQUES UPDATE ─────────────────────────
    if(this.hmActivity){
      const _mww=this.MW,_mhh=this.MH,_szz=_mww*_mhh
      for(let _i=0;_i<_szz;_i++){this.hmActivity[_i]*=0.9996;this.hmPresence[_i]*=0.9994}
      if(this.frame%4===0){
        for(const _a of this.agents){
          if(_a.hp<=0||_a.rn==='DRONE')continue
          const _tx=Math.floor(_a.x),_ty=Math.floor(_a.y)
          if(_tx>=0&&_ty>=0&&_tx<_mww&&_ty<_mhh)
            this.hmPresence[_ty*_mww+_tx]+=_a.team===0?0.10:-0.10
        }
      }
      for(const _b of this.bullets){
        const _tx=Math.floor(_b.x),_ty=Math.floor(_b.y)
        if(_tx>=0&&_ty>=0&&_tx<_mww&&_ty<_mhh)this.hmActivity[_ty*_mww+_tx]+=0.06
      }
    }
    // BB decay adaptatif — info récente décroit plus lentement
    for(let _t=0;_t<2;_t++){
      const _b=this.BB[_t], _age=this.frame-_b.frame
      const _rate=_nightNow?(.04+_age*.00008):(.06+_age*.0001)
      _b.conf=Math.max(0,_b.conf-Math.min(_rate,.15))
    }
    // Universal BB fallback: if BB stale but enemies known, refresh toward centroid
    for(let t=0;t<2;t++){
      if(this.BB[t].conf<5&&this.EC[t].length>0){
        const ex=this.EC[t].reduce((s,e)=>s+e.x,0)/this.EC[t].length
        const ey=this.EC[t].reduce((s,e)=>s+e.y,0)/this.EC[t].length
        this.BB[t].x=ex;this.BB[t].y=ey;this.BB[t].conf=25;this.BB[t].frame=this.frame
      }
    }
    // Moral
    if(CFG.moral)for(let t=0;t<2;t++){if(this.MORAL[t].d>=2)for(const a of this.agents)if(a.team===t&&a.hp>0&&a.state==='H')a.state='A';this.MORAL[t].d=Math.max(0,this.MORAL[t].d-.004)}
    this._cmdUpdate()
    this._anySmoke=this.agents.some(a=>a.smoke&&a.smoke.active)   // perf : flag fumée pour _canSee
    // FIX équité : alterner l'ordre de traitement par frame pour qu'aucune équipe n'agisse
    // systématiquement en premier. team 0 (ALPHA) étant créée d'abord, elle sentait/décidait/TIRAIT
    // avant BRAVO à chaque frame → avantage du 1er tireur (~+4-8% de win-rate, le biais de camp observé).
    {const _ag=this.agents,_n=_ag.length;
     if(this.frame&1){for(let _i=_n-1;_i>=0;_i--){const a=_ag[_i];if(a.hp>0)this._aiTick(a)}}
     else{for(let _i=0;_i<_n;_i++){const a=_ag[_i];if(a.hp>0)this._aiTick(a)}}}
    for(const a of this.agents)if(a.smoke?.active&&a.hp<=0){a.smoke.timer--;if(a.smoke.timer<=0)a.smoke.active=false}
    // Bullets
    for(let i=this.bullets.length-1;i>=0;i--){
      const b=this.bullets[i]
      if(b.grenade){
        const dx=b.tx-b.x,dy=b.ty-b.y,d=Math.hypot(dx,dy)
        b.x+=dx/(d||1)*.3;b.y+=dy/(d||1)*.3;b.age++
        if(d<.5||(this.pass(Math.floor(b.x),Math.floor(b.y))===false)||b.age>b.mx){this._explode(b.x,b.y,b.team);this.bullets.splice(i,1);continue}
        continue
      }
      if(!isFinite(b.vx)||!isFinite(b.vy)){this.bullets.splice(i,1);continue}
      // Trail tracking
      if(b.trail){b.trail.push({x:b.x,y:b.y});if(b.trail.length>4)b.trail.shift()}
      b.x+=b.vx;b.y+=b.vy;b.age++
      if(!isFinite(b.x)||!isFinite(b.y)){this.bullets.splice(i,1);continue}
      const tx=Math.floor(b.x),ty=Math.floor(b.y)
      if(tx<0||ty<0||tx>=this.MW||ty>=this.MH||b.age>b.mx){this.bullets.splice(i,1);continue}
      const tile=this.map[ty][tx]
      if(tile===1){
        // Impact sur mur: étincelles
        this._ps(b.x,b.y,'spark',2)
        this.bullets.splice(i,1);continue
      }
      if(tile===2&&this.rng()<CFG.coverBlock/100){
        // Cover directionnel (180°) : un ennemi accroupi SUR cette tuile n'est protégé que si la
        // balle vient de son arc frontal ; flanc/dos = la couverture ne sert à rien (récompense le flanc).
        // Tuile de cover SANS agent dessus = obstacle terrain → bloque dans tous les sens (360°).
        let _blk=true
        if(CFG.coverArc180){
          for(const _oc of this.agents){
            if(_oc.hp<=0||_oc.team===b.team)continue
            if(Math.floor(_oc.x)===tx&&Math.floor(_oc.y)===ty){
              const _bang=Math.atan2(b.vy,b.vx)
              const _df=Math.abs(((_oc.dir-_bang+Math.PI*3)%(Math.PI*2))-Math.PI)
              if(_df<Math.PI*0.5)_blk=false   // balle ~même sens que le cap = touche de dos/flanc → pas protégé
              break
            }
          }
        }
        if(_blk){this.bullets.splice(i,1);continue}
      }
      let hit=false
      for(const a of this.agents){
        if(a.team===b.team)continue
        if(a.state==='KO'){if(Math.hypot(a.x-b.x,a.y-b.y)<.5){a.hp=-1;a.state='H';this.deaths.push({x:a.x,y:a.y,team:a.team,age:0,rn:a.rn,dir:a.dir});this.score[b.team]+=50;this.killCount[b.team]++;this.lastKillFrame=this.frame;if(this.floats)this.floats.push({x:a.x,y:a.y-1,text:'FINISH',life:45,ml:45,col:TC[b.team],vy:-0.02});this.bullets.splice(i,1);hit=true;break};continue}
        // [PATCH 1] Bloc de dessin parasite (référençait scx/px/py non définis dans ce scope) supprimé.
        // Le rendu KO est correctement géré dans _drawShape lors du draw().
      if(a.hp<=0)continue
        if(Math.hypot(a.x-b.x,a.y-b.y)<.5){
          const _dmg=b.dmg+Math.floor(this.rng()*8)
          a.hp-=_dmg;a.flCD=8
          const _dist2=Math.hypot(a.x-(b.x-(b.vx||0)),a.y-(b.y-(b.vy||0)))
          if(a.rn==='SNIPER'&&_dist2<6&&!b.grenade){a._wpScdPenalty=180;a._wpScdMult=2.5;if(this.floats)this.floats.push({x:a.x,y:a.y-1,text:'SCOPE!',life:40,ml:40,col:'#ffdd44',vy:-0.022})}
          if(a.rn==='SUPPORT'&&!b.grenade){const _ang=Math.atan2(b.vy||0,b.vx||0);const _df=Math.abs(((a.dir-_ang+Math.PI*3)%(Math.PI*2))-Math.PI);if(_df<Math.PI*0.4){a._wpRelPenalty=120;if(this.floats)this.floats.push({x:a.x,y:a.y-1,text:'PACK!',life:40,ml:40,col:'#44aaff',vy:-0.022})}}
          NN.onHit(a,this)
          const shJ=this.agents.find(ag=>ag.uid===b._shooterId)
          if(shJ)this._jlog('HIT',shJ,{vuid:a.uid,vrn:a.rn,vx:+a.x.toFixed(2),vy:+a.y.toFixed(2),dmg:_dmg,vhp:Math.max(0,a.hp),dist:+Math.hypot(a.x-shJ.x,a.y-shJ.y).toFixed(2)})
          // Track hit for shooter accuracy metric
          if(b._shooterId!==undefined&&b._fireId!==undefined){
            const sh=this.agents.find(ag=>ag.uid===b._shooterId)
            if(sh){
              // Only count one hit per fire group (burst = 1 accurate hit)
              if(sh._lastHitFireId!==b._fireId){
                sh._lastHitFireId=b._fireId
                sh.shotsHit=(sh.shotsHit||0)+1
              }
            }
          }
          if(a.hp>0){a.supCD=(a.supCD||0)+20;for(const f of this.agents)if(f.team===a.team&&f.hp>0&&f!==a&&Math.hypot(f.x-a.x,f.y-a.y)<10&&f.state==='H')f.state='A'}
          // FIX bug3 : victime EN COUVERTURE touchée hors de son arc frontal (flanc/dos =
          // couverture inutile) → elle casse la couverture et se repositionne vers la menace,
          // au lieu de rester sitting duck. Le flanc garde l'avantage (1ers tirs déjà passés),
          // et elle ne "tourne" pas en restant plantée : elle bouge. Combat frontal non affecté.
          if(a.hp>0&&(a._coverFrames||0)>30&&shJ){
            const _toSh=Math.atan2(shJ.y-a.y,shJ.x-a.x)
            const _dAng=Math.abs(((a.dir-_toSh+Math.PI*3)%(Math.PI*2))-Math.PI)  // écart cap ↔ tireur
            if(_dAng>Math.PI*0.55){                       // tireur sur le flanc / l'arrière
              a._coverFrames=0
              const _bb=this.BB[a.team];if(_bb.conf<60){_bb.x=shJ.x;_bb.y=shJ.y;_bb.conf=55;_bb.frame=this.frame}
              if(a.state!=='R'&&a.state!=='E'&&a.state!=='RV'){a.state='A';a.stCD=0;a.path=[];a.pgx=-1;a.pgy=-1}
              if(this.floats)this.floats.push({x:a.x,y:a.y-1,text:'FLANKED!',life:35,ml:35,col:'#ffaa33',vy:-0.02})
            }
          }
          this._ps(a.x,a.y,'blood',5)
          // Impact sparks toward shooter
          this._ps(a.x,a.y,'spark',3)
          const ax=Math.max(0,Math.min(this.MW-1,Math.floor(a.x))),ay=Math.max(0,Math.min(this.MH-1,Math.floor(a.y)))
          if(this.wU){const _k=ay*this.MW+ax;if(isFinite(this.wU[_k])){this.wU[_k]+=0.8;if(ay>0)this.wU[_k-this.MW]+=0.3;if(ay<this.MH-1)this.wU[_k+this.MW]+=0.3;if(ax>0)this.wU[_k-1]+=0.3;if(ax<this.MW-1)this.wU[_k+1]+=0.3}}
          this.danger[ay][ax]+=5;if(ay>0)this.danger[ay-1][ax]+=2;if(ay<this.MH-1)this.danger[ay+1][ax]+=2
          if(a.hp<=0){
            NN.onDeath(a,this)
            this._ps(a.x,a.y,a.team===0?'d0':'d1',18)
            // REVIVE: passer en KO si SUPPORT allié vivant et pas encore revived
            const _hasSup=!a.revived&&this.agents.some(f=>f.team===a.team&&f.hp>0&&f.hp>=0&&f.rn==='SUPPORT'&&f.state!=='KO'&&f.state!=='RV')
            if(_hasSup&&a.rn!=='DRONE'){
              a.hp=0; a.state='KO'; a.koTimer=0
            } else {
              this.deaths.push({x:a.x,y:a.y,team:a.team,age:0,rn:a.rn,dir:a.dir})
            // [PATCH 2] Utilise shJ (résolu via b._shooterId plus haut, ligne ~4100) au lieu d'un
            // find par proximité qui pouvait récompenser un allié passant près de la victime.
            const shooterA=shJ
            if(shooterA) NN.onKill(shooterA,this)  // NN: positive reward for kill
            if(a.state!=='KO'){this.score[b.team]+=CFG.mode==='zones'?10:100;this.killCount[b.team]++;this.lastKillFrame=this.frame}
            if(shJ&&a.state!=='KO')this._jlog('KILL',shJ,{vuid:a.uid,vrn:a.rn,vtm:a.team,vx:+a.x.toFixed(2),vy:+a.y.toFixed(2),dist:+Math.hypot(a.x-shJ.x,a.y-shJ.y).toFixed(2),a0:this.alive[0],a1:this.alive[1]})
            this.khist[b.team].push(this.frame)
            this.MORAL[a.team].d+=1
            this.flashKill[b.team]=8
            // Kill float text
            if(this.floats) this.floats.push({x:a.x,y:a.y-1,text:'+KILL',life:55,ml:55,col:TC[b.team],vy:-0.025})
            // FIX 6: dispersal signal centered on SHOOTER position (not victim)
            // "mass, strike, disperse" — shooter and nearby allies reposition
            const shooterPos=shooterA?{x:shooterA.x,y:shooterA.y}:{x:b.x-b.vx*10,y:b.y-b.vy*10}
            for(const f of this.agents){
              if(f.team===b.team&&f.hp>0&&Math.hypot(f.x-shooterPos.x,f.y-shooterPos.y)<12){
                // Pas de disperse si 1v1 (les deux fuiraient mutuellement)
                const _is1v1d=this.alive[f.team]<=1||this.EC[f.team].length<=1
                if(!_is1v1d)f.disperseCD=Math.max(f.disperseCD||0, 55+Math.floor(this.rng()*20))
              }
            }
            const lkpX=b.x-b.vx*12,lkpY=b.y-b.vy*12
            for(const f of this.agents)if(f.team===a.team&&f.hp>0&&Math.hypot(f.x-a.x,f.y-a.y)<15)
              if(!this.jamActive||(this.jamTeam>=0&&this.jamTeam!==a.team)){this.BB[a.team].x=lkpX;this.BB[a.team].y=lkpY;this.BB[a.team].frame=this.frame;this.BB[a.team].conf=80}
            } // fin else mort définitive
          }
          this.bullets.splice(i,1);hit=true;break
        }
      }
      if(hit)continue
    }
    // Flags
    if(CFG.mode==='flag') for(const f of this.FLAGS){
      const near=this.agents.filter(a=>a.team!==f.team&&a.hp>0&&Math.hypot(a.x-f.x,a.y-f.y)<1.8)
      if(near.length){f.prog=Math.min(180,f.prog+near.length*.6);if(f.prog>=180){this._end(1-f.team,'FLAG')}}
      else f.prog=Math.max(0,f.prog-.5)
    }
    // Zones
    if(CFG.mode==='zones') for(const z of this.ZONES){
      for(let t=0;t<2;t++){
        let n=0;for(const a of this.agents)if(a.team===t&&a.hp>0&&Math.hypot(a.x-z.x,a.y-z.y)<z.r)n++
        if(n>0)z.prog[t]=Math.min(150,z.prog[t]+n*.6);else z.prog[t]=Math.max(0,z.prog[t]-.5)
      }
      for(let t=0;t<2;t++)if(z.prog[t]>=150&&z.prog[t]>z.prog[1-t])z.ctrl=t
      if(z.ctrl>=0)this.score[z.ctrl]+=1
    }
    for(let t=0;t<2;t++)if(CFG.mode==='zones'&&this.score[t]>=CFG.zoneWinScore)this._end(t,'ZONES')
    // Particles
    for(let i=this.parts.length-1;i>=0;i--){
      const p=this.parts[i];p.x+=p.vx;p.y+=p.vy;p.vx*=.86;p.vy*=.86;p.life--
      if(p.life<=0)this.parts.splice(i,1)
    }
    for(let i=this.tracers.length-1;i>=0;i--){this.tracers[i].life--;if(this.tracers[i].life<=0)this.tracers.splice(i,1)}
    // Wave field (OMEGA stepWave pattern)
    if(this.wU){
      const WC2=0.18,WD=0.88,MW=this.MW,MH=this.MH,wU=this.wU,wP=this.wP,wNxt=this.wNxt
      for(let j=0;j<MH;j++){
        const jw=j*MW,juw=((j-1+MH)%MH)*MW,jdw=((j+1)%MH)*MW
        for(let i=0;i<MW;i++){
          if(this.map[j][i]===1){wNxt[jw+i]=0;continue}
          const k=jw+i,L=wU[jw+(i-1+MW)%MW],R=wU[jw+(i+1)%MW],U=wU[juw+i],D=wU[jdw+i]
          wNxt[k]=(2*wU[k]-wP[k]+WC2*(L+R+U+D-4*wU[k]))*WD
        }
      }
      const N2=MW*MH
      for(let k=0;k<N2;k++){wP[k]=wU[k];wU[k]=isFinite(wNxt[k])?wNxt[k]:0}
      for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){const _wv=wU[y*MW+x];this.danger[y][x]=isFinite(_wv)?Math.min(50,Math.max(0,_wv)*10):0}
    } else {
      const d=CFG.dangerDecay/100
      const dd=d
      for(let y=0;y<this.MH;y++)for(let x=0;x<this.MW;x++)this.danger[y][x]*=dd
    }
    // ── MOB DANGER OVERLAY (GAP-1) ── the wU wave-field branch above REBUILDS
    // this.danger from scratch, wiping the mob contribution that _stampMobs wrote.
    // Re-add it here (only cells stamped this call → O(stamped)). The non-wU branch
    // merely decays danger, so the original stamp survives there and we must NOT
    // double-add — hence this is gated on this.wU.
    if(this.wU&&this._mobDng&&this._mobCells&&this._mobCells.length){
      const md=this._mobDng,mc=this._mobCells,MW=this.MW
      for(let i=0;i<mc.length;i++){const k=mc[i],y=(k/MW)|0,x=k-y*MW
        const v=md[k]; if(v>0){const nv=this.danger[y][x]+v; this.danger[y][x]=nv>50?50:nv}}
    }
    // Phero decay
    if(CFG.phero&&this.frame%3===0){const _pd=.946;for(let t=0;t<2;t++)for(let y=0;y<this.MH;y++)for(let x=0;x<this.MW;x++)this.phero[t][y][x]*=_pd}
    // Deaths
    for(const d of this.deaths)d.age++
    this.deaths=this.deaths.filter(d=>d.age<500)
    for(const a of this.agents){
      if(a.state!=='KO')continue
      a.koTimer=(a.koTimer||0)+1
      if(a.koTimer>300){
        // Mort définitive — CRITICAL: mettre hp=-1 pour stopper la boucle
        a.hp=-1; a.state='H'  // hp=-1 → ignoré par tous les filtres hp>0
        this.deaths.push({x:a.x,y:a.y,team:a.team,age:0,rn:a.rn,dir:a.dir})
        this.killCount[1-a.team]++;this.score[1-a.team]+=50;this.lastKillFrame=this.frame
        if(this.floats)this.floats.push({x:a.x,y:a.y-1,text:'KO',life:40,ml:40,col:'#555',vy:-0.015})
      }
    }
    // Flash decay
    for(let t=0;t<2;t++)this.flashKill[t]=Math.max(0,this.flashKill[t]-1)
    // Float texts tick
    if(this.floats){for(let i=this.floats.length-1;i>=0;i--){const f=this.floats[i];f.y+=f.vy;f.life--;if(f.life<=0)this.floats.splice(i,1)}}
    // NN auto-save tick
    NN.tick(this.frame)
    // Time limit
    if(CFG.timeLimit>0&&this.frame>=CFG.timeLimit)this._end(this.score[0]>=this.score[1]?0:1,'TEMPS')
    // Elim
    if(CFG.mode==='elim'&&(!this.alive[0]||!this.alive[1]))
      this._end(this.alive[0]?0:this.alive[1]?1:-1,'ELIM')
    // Throttled HUD
    if(--this.hudCD<=0){this.hudCD=20;this._updateHUD()}
    // GOAP 3D update géré par updateGOAP3D() dans la RAF de initGOAP3D
    }catch(_ue){
      // [PATCH 5] Si window.DEBUG_NO_CATCH actif, on rethrow pour voir la vraie erreur en dev.
      if(typeof window!=='undefined' && window.DEBUG_NO_CATCH) throw _ue
      console.error('[UPDATE CRASH]',_ue.message);if(_ue.stack)_ue.stack.split('\n').slice(1,8).forEach(l=>console.error(l.trim()))
    }
  }

  _end(winner,reason){
    if(this.state!=='run')return
    this.state='end'; this.winner=winner
    if(NN.training)NN.save()
    const w=winner===0?'ALPHA':winner===1?'BRAVO':'DRAW'
    const el=document.getElementById(this.ui.ms)
    if(el)el.textContent=`[ ${w} WINS — ${reason} ]`
    // NN: end-of-game reward — reinforce survivors of winning team
    for(const a of this.agents){
      if(a.hp<=0||a.rn==='DRONE')continue  // drone: pas de NN
      const reward=a.team===winner?+2.0:-1.5
      const _inp=a._nnInp||NN.buildInput(a,this)
      if(_inp&&_inp.length===NN_IN)NN.backprop(a.rn,_inp,reward,this,a.team)
    }
    NN.save()
    this._saveScore()
    this._saveJournal(true)
    recordGame(this)
    if(COMPARE)updateCmpStats()
  }

  _updateHUD(){
    const {alive,CMD,killCount,frame,score}=this
    const el0=document.getElementById(this.ui.a0),el1=document.getElementById(this.ui.a1)
    const ko0=this.agents.filter(a=>a.team===0&&a.state==='KO').length
    const ko1=this.agents.filter(a=>a.team===1&&a.state==='KO').length
    const dr0=this.agents.some(a=>a.team===0&&a.rn==='DRONE'&&a.hp>0)
    const dr1=this.agents.some(a=>a.team===1&&a.rn==='DRONE'&&a.hp>0)
    if(el0)el0.textContent=alive[0]+' alive'+(dr0?' ⬡':'')+(ko0?' ⊘'+ko0:'')+(CMD[0]&&CFG.cmd?' ♛ '+CMD[0].role.lbl:'')
    if(el1)el1.textContent=alive[1]+' alive'+(dr1?' ⬡':'')+(ko1?' ⊘'+ko1:'')+(CMD[1]&&CFG.cmd?' ♛ '+CMD[1].role.lbl:'')
    const jl=document.getElementById(this.ui.jamL),nl=document.getElementById(this.ui.nightL)
    if(jl)jl.style.display=this.jamActive?'flex':'none'
    if(nl)nl.style.display='none'
    const se=document.getElementById(this.ui.scoreEl)
    if(se){se.style.display=CFG.mode==='zones'?'flex':'none';se.textContent=`α${score[0]} β${score[1]}`}
    // HUD jour/nuit supprimé
    // ── STAT PANEL update ────────────────────────────
    if(this.ui.statPfx){
      const pfx=this.ui.statPfx
      // Kills
      const k0=document.getElementById(pfx+'0'),k1=document.getElementById(pfx+'1')
      if(k0)k0.textContent='K:'+killCount[0]
      if(k1)k1.textContent='K:'+killCount[1]
      // Accuracy per team (shots hit / shots fired)
      for(let t=0;t<2;t++){
        const key=t===0?'acc0':'acc1'
        const el=document.getElementById(pfx.replace('Kills','Acc')+t)
        if(!el)continue
        let sf=0,sh=0
        for(const a of this.agents)if(a.team===t){sf+=(a.shotsFired||0);sh+=(a.shotsHit||0)}
        el.textContent='ACC:'+(sf>0?Math.round(sh/sf*100)+'%':'—')
      }
      // Avg HP per team
      for(let t=0;t<2;t++){
        const el=document.getElementById(pfx.replace('Kills','Hp')+t)
        if(!el)continue
        const living=this.agents.filter(a=>a.team===t&&a.hp>0&&a.role&&a.role.hp>0&&a.rn!=='DRONE')
        if(!living.length){el.textContent='HP:—';continue}
        const avgHp=Math.round(living.reduce((s,a)=>s+a.hp/a.role.hp,0)/living.length*100)
        el.textContent='HP:'+avgHp+'%'
      }
      // Time
      const ft=document.getElementById(pfx.replace('Kills','Frame'))
      if(ft){const s=Math.floor(frame/60);ft.textContent='T:'+(s<60?s+'s':Math.floor(s/60)+'m'+s%60+'s')}
      // NN confidence
      const nn=document.getElementById(pfx.replace('Kills','NN'))
      if(nn){
        const avgConf=Math.round(RK.reduce((s,rn)=>s+Math.min(1,(((NN.updates[wk(rn,0)]||0)+(NN.updates[wk(rn,1)]||0))/2)/2000),0)/RK.length*100)
        nn.textContent='NN:'+avgConf+'%'
        nn.style.color=avgConf>50?'#44dd88':avgConf>10?'#667744':'#334455'
      }
    }
  }

  _saveScore(){
    try{
      const arr=JSON.parse(localStorage.getItem('tacScores')||'[]')
      arr.unshift({winner:this.winner===0?'ALPHA':this.winner===1?'BRAVO':'DRAW',kills0:this.killCount[0],kills1:this.killCount[1],frames:this.frame,seed:this.seed,date:Date.now()})
      arr.splice(5);localStorage.setItem('tacScores',JSON.stringify(arr))
    }catch(e){}
  }

  _saveJournal(final=false){
    if(!this.journal||!this.journal.length)return
    try{
      let idx=parseInt(localStorage.getItem('tacJournal_idx')||'0')
      if(final){idx=(idx+1)%3;localStorage.setItem('tacJournal_idx',idx)}
      const payload=JSON.stringify({seed:this.seed,frames:this.frame,date:Date.now(),final,kills:[this.killCount[0],this.killCount[1]],winner:this.winner,events:this.journal})
      localStorage.setItem('tacJournal_'+idx,payload)
      const manifest=JSON.parse(localStorage.getItem('tacJournal_manifest')||'[]')
      const entry={slot:idx,seed:this.seed,frames:this.frame,date:Date.now(),final,events:this.journal.length}
      const ei=manifest.findIndex(m=>m.slot===idx)
      if(ei>=0)manifest[ei]=entry;else manifest.push(entry)
      localStorage.setItem('tacJournal_manifest',JSON.stringify(manifest.sort((a,b)=>b.date-a.date)))
    }catch(e){console.warn('Journal save:',e.message)}
  }

  // ── DRAW ─────────────────────────────────────────
  draw(){
    if(!this.sceneCV) return
    const scx=this.sceneCX, cx=this.cx, s=this.scale||1
    const MW=this.MW, MH=this.MH, W=MW*TILE, H=MH*TILE, frame=this.frame

    // All drawing on scene canvas (native resolution, no scale)
    scx.clearRect(0,0,W,H)

    // ── MAP ──────────────────────────────────────────────
    if(this.offCV) scx.drawImage(this.offCV,0,0)

    // ── WAVE FIELD (zero-GC putImageData, OMEGA pattern) ──────────
    if(this.wU&&this._waveImgData){
      const wpx=this._waveImgData.data,MW=this.MW,MH=this.MH
      for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
        const v=Math.tanh(this.wU[y*MW+x]*4),k=(y*MW+x)<<2
        if(v>0.04){wpx[k]=220;wpx[k+1]=55;wpx[k+2]=0;wpx[k+3]=(v*60)|0}
        else if(v<-0.04){wpx[k]=0;wpx[k+1]=100;wpx[k+2]=210;wpx[k+3]=((-v)*40)|0}
        else{wpx[k+3]=0}
      }
      this._waveOffCtx.putImageData(this._waveImgData,0,0)
      scx.save();scx.globalAlpha=0.65;scx.imageSmoothingEnabled=false
      scx.drawImage(this._waveOffCv,0,0,MW*TILE,MH*TILE);scx.restore()
    }

        // ── PHEROMONES ────────────────────────────────────────
    if(CFG.phero) for(let t=0;t<2;t++){
      const col=t===0?'68,170,255':'255,85,85'  // team phero
      for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){
        const v=this.phero[t][y][x]
        if(v>.08){scx.fillStyle=`rgba(${col},${(v*.1).toFixed(3)})`;scx.fillRect(x*TILE,y*TILE,TILE,TILE)}
      }
    }

    // ── SMOKE GRENADES ───────────────────────────────────────
    for(const a of this.agents){
      if(!a.smoke?.active)continue
      const sx=a.smoke.x*TILE,sy=a.smoke.y*TILE
      const sr=4*TILE, prog=Math.min(1,a.smoke.timer/135)   // 0→1 fade
      // Multicouches volumétriques
      for(let layer=0;layer<3;layer++){
        const lr=sr*(0.6+layer*.25),la=prog*(0.18-layer*.05)
        const sg=scx.createRadialGradient(sx,sy,0,sx,sy,lr)
        sg.addColorStop(0,`rgba(${180+layer*15},${180+layer*15},${200+layer*10},${la})`)
        sg.addColorStop(.5,`rgba(160,165,185,${la*.6})`)
        sg.addColorStop(1,'rgba(140,145,165,0)')
        scx.fillStyle=sg
        scx.beginPath();scx.arc(sx,sy,lr,0,Math.PI*2);scx.fill()
      }
      // Particules tourbillonnantes
      for(let i=0;i<4;i++){
        const pa=(frame*.02+i*Math.PI/2)%(Math.PI*2)
        const px2=sx+Math.cos(pa)*sr*.4, py2=sy+Math.sin(pa)*sr*.35
        const pg=scx.createRadialGradient(px2,py2,0,px2,py2,TILE*1.2)
        pg.addColorStop(0,'rgba(200,205,215,.12)');pg.addColorStop(1,'rgba(200,205,215,0)')
        scx.fillStyle=pg;scx.beginPath();scx.arc(px2,py2,TILE*1.2,0,Math.PI*2);scx.fill()
      }
    }
    // ── FOV CONES ────────────────────────────────────────
    // FOV cones: hidden at night (FOW handles it), capped at 80px visually
    if(true){  // NVG supprimé — plein jour
      scx.save()
      for(const a of this.agents){
        if(a.hp<=0)continue
        const fm=this._fovMult(a.rn)
        const r=Math.min(a.role.rng*TILE*.35*fm,80)
        scx.globalAlpha=.03;scx.fillStyle=TC[a.team]
        const px=a.x*TILE,py=a.y*TILE
        scx.beginPath();scx.moveTo(px,py)
        for(let i=0;i<=12;i++){const ang=a.dir-a.role.fov*fm+(a.role.fov*2*fm/12)*i;scx.lineTo(px+Math.cos(ang)*r,py+Math.sin(ang)*r)}
        scx.closePath();scx.fill()
      }
      scx.restore()
    }

    // ── ZONES ─────────────────────────────────────────────
    if(CFG.mode==='zones') for(const z of this.ZONES){
      const px=z.x*TILE, py=z.y*TILE, r=z.r*TILE
      scx.save()
      scx.globalAlpha=z.ctrl>=0?.12:.04; scx.fillStyle=z.ctrl>=0?TC[z.ctrl]:'#334455'
      scx.beginPath(); scx.arc(px,py,r,0,Math.PI*2); scx.fill()
      scx.globalAlpha=z.ctrl>=0?.65:.2; scx.strokeStyle=z.ctrl>=0?TC[z.ctrl]:'#334455'
      scx.lineWidth=1.5; scx.setLineDash([3,3])
      scx.beginPath(); scx.arc(px,py,r,0,Math.PI*2); scx.stroke(); scx.setLineDash([])
      for(let t=0;t<2;t++){
        if(!z.prog[t]) continue
        const prog=z.prog[t]/150; scx.globalAlpha=.7; scx.strokeStyle=TC[t]; scx.lineWidth=2.5
        scx.beginPath(); scx.arc(px,py,r+4,-Math.PI/2+t*Math.PI,-Math.PI/2+t*Math.PI+Math.PI*prog); scx.stroke()
      }
      scx.globalAlpha=.45; scx.fillStyle=z.ctrl>=0?TC[z.ctrl]:'#334455'
      scx.font='7px Share Tech Mono'; scx.textAlign='center'; scx.fillText(z.name,px,py+r+10)
      scx.restore()
    }

    // ── INTEL BB ──────────────────────────────────────────
    scx.save(); scx.setLineDash([2,4])
    for(let t=0;t<2;t++){
      const b=this.BB[t]; if(b.conf<5) continue
      const alpha=Math.min(1,b.conf/100)*.7
      scx.globalAlpha=alpha; scx.strokeStyle='#ccbb00'; scx.lineWidth=1.2
      scx.beginPath(); scx.arc(b.x*TILE,b.y*TILE,7,0,Math.PI*2); scx.stroke()
      scx.globalAlpha=alpha*.2
      scx.beginPath(); scx.arc(b.x*TILE,b.y*TILE,7+(frame%40)*.3,0,Math.PI*2); scx.stroke()
    }
    scx.setLineDash([]); scx.restore()

    // ── FLAGS ─────────────────────────────────────────────
    if(CFG.mode==='flag') for(const f of this.FLAGS){
      const px=f.x*TILE, py=f.y*TILE, col=TC[f.team]
      scx.save(); scx.fillStyle=col; scx.globalAlpha=.18+Math.sin(frame*.08)*.08
      scx.beginPath(); scx.moveTo(px,py-9); scx.lineTo(px+7,py); scx.lineTo(px,py+9); scx.lineTo(px-7,py); scx.closePath(); scx.fill()
      scx.globalAlpha=.9; scx.strokeStyle=col; scx.lineWidth=1.5; scx.stroke()
      if(f.prog>0){scx.globalAlpha=.8; scx.strokeStyle='#fff'; scx.lineWidth=2; scx.beginPath(); scx.arc(px,py,11,-Math.PI/2,-Math.PI/2+Math.PI*2*(f.prog/180)); scx.stroke()}
      scx.restore()
    }

    // ── TRACERS ───────────────────────────────────────────
    scx.save(); scx.lineWidth=1.5
    for(const t of this.tracers){
      scx.globalAlpha=(t.life/t.ml)*.8; scx.strokeStyle=TC[t.team]
      scx.shadowBlur=8; scx.shadowColor=scx.strokeStyle
      scx.beginPath(); scx.moveTo(t.x1*TILE,t.y1*TILE); scx.lineTo(t.x2*TILE,t.y2*TILE); scx.stroke()
      scx.shadowBlur=0
    }
    scx.restore()

    // ── BULLET TRAILS + BULLETS ───────────────────────────
    scx.save()
    // render effects

for(const b of this.bullets){
      if(b.grenade){
        scx.save(); scx.translate(b.x*TILE,b.y*TILE); scx.rotate(frame*.15)
        scx.fillStyle='#ff9900'; scx.globalAlpha=.92
        scx.beginPath(); scx.arc(0,0,3.5,0,Math.PI*2); scx.fill()
        scx.fillStyle='#ffcc44'; scx.globalAlpha=.55; scx.fillRect(-1.5,-1.5,3,3)
        scx.restore()
      } else {
        const bx=b.x*TILE,by=b.y*TILE,bvx=b.vx*TILE,bvy=b.vy*TILE
        const bang=Math.atan2(b.vy,b.vx)
        const bspd=Math.hypot(b.vx,b.vy)
        const teamCol0=b.team===0?'#44aaff':'#ff5555'
        const trailLen=b._sq?2:4

        // ── TRACER TRAIL long et lumineux ──────────────────
        if(b.trail&&b.trail.length>1){
          scx.save(); scx.lineCap='round'
          for(let i=0;i<b.trail.length-1;i++){
            const t0=b.trail[i],t1=b.trail[i+1]
            const a=(i+1)/b.trail.length
            // Lueur large
            scx.globalAlpha=a*.12; scx.strokeStyle=teamCol0; scx.lineWidth=5
            scx.beginPath();scx.moveTo(t0.x*TILE,t0.y*TILE);scx.lineTo(t1.x*TILE,t1.y*TILE);scx.stroke()
            // Core fin
            scx.globalAlpha=a*.55; scx.strokeStyle=b._sq?'#ff9900':teamCol0; scx.lineWidth=1.2
            scx.beginPath();scx.moveTo(t0.x*TILE,t0.y*TILE);scx.lineTo(t1.x*TILE,t1.y*TILE);scx.stroke()
          }
          scx.restore()
        }

        // ── CORE BALLE ─────────────────────────────────────
        scx.save(); scx.translate(bx,by); scx.rotate(bang)
        // Lueur radiale
        const grd=scx.createRadialGradient(0,0,0,0,0,7)
        grd.addColorStop(0, b._sq?'rgba(255,150,0,.4)':hexA(teamCol0,.35))
        grd.addColorStop(1, 'rgba(0,0,0,0)')
        scx.fillStyle=grd; scx.beginPath(); scx.arc(0,0,7,0,Math.PI*2); scx.fill()
        // Corps ovoïde de la balle
        scx.shadowBlur=b._sq?6:8; scx.shadowColor=b._sq?'#ff8800':teamCol0
        const bLen=b._sq?3:b.dmg>20?6:4
        scx.fillStyle=b._sq?'#ffaa44':hexA(teamCol0,.95)
        scx.beginPath(); scx.ellipse(0,0,bLen,1.0,0,0,Math.PI*2); scx.fill()
        // Coeur blanc
        scx.fillStyle='rgba(255,255,255,.7)'; scx.shadowBlur=0
        scx.beginPath(); scx.ellipse(0,0,bLen*.5,.5,0,0,Math.PI*2); scx.fill()
        scx.restore()
      }
    }
    scx.shadowBlur=0; scx.restore()

    // ── PARTICLES ─────────────────────────────────────────
    scx.save()
    for(const p of this.parts){
      const a=p.life/p.ml
      scx.globalAlpha=a
      if(p.t==='ember'){
        // Débris incandescent
        const er=1.5*a
        scx.fillStyle=`rgba(${255},${Math.floor(100+80*a)},20,${a})`
        scx.beginPath(); scx.arc(p.x*TILE,p.y*TILE,er,0,Math.PI*2); scx.fill()
      } else if(p.t==='smoke'){
        // Fumée: disque gris qui grossit en s'estompant
        const sr=TILE*(1-a)*.7+.5
        scx.globalAlpha=a*.18
        scx.fillStyle=`rgb(${80+Math.floor(40*(1-a))},${80+Math.floor(40*(1-a))},${90+Math.floor(30*(1-a))})`
        scx.beginPath(); scx.arc(p.x*TILE,p.y*TILE,sr,0,Math.PI*2); scx.fill()
        scx.globalAlpha=a
      } else if(p.t==='muzz'){
        // Flash directionnel: cône de feu dans la direction du tir
        const mDir=p.dir||0
        const mR=6*a, mLen=12*a
        scx.save(); scx.translate(p.x*TILE,p.y*TILE); scx.rotate(mDir)
        // Cône principal
        scx.shadowBlur=20; scx.shadowColor='rgba(255,180,40,.8)'
        const mg=scx.createRadialGradient(0,0,0,mLen*.5,0,mLen)
        mg.addColorStop(0,'rgba(255,240,120,'+a*1+')')
        mg.addColorStop(.4,'rgba(255,140,20,'+a*.7+')')
        mg.addColorStop(1,'rgba(255,50,0,0)')
        scx.fillStyle=mg
        scx.beginPath();scx.moveTo(0,0);scx.arc(0,0,mLen,-Math.PI*.28,Math.PI*.28);scx.closePath();scx.fill()
        // Coeur blanc chaud
        scx.fillStyle=`rgba(255,255,240,${a*.9})`; scx.shadowBlur=5; scx.shadowColor='#fff'
        scx.beginPath(); scx.ellipse(mLen*.25,0,mLen*.25,mR*.35,0,0,Math.PI*2); scx.fill()
        // Anneaux latéraux
        scx.fillStyle=`rgba(255,200,80,${a*.5})`; scx.shadowBlur=0
        scx.beginPath(); scx.arc(0,0,mR*.6,0,Math.PI*2); scx.fill()
        scx.restore(); scx.shadowBlur=0
      } else if(p.t==='blood'){
        const ba=p.life/p.ml
        // Éclaboussure dynamique
        scx.fillStyle=`rgba(${140+Math.floor(40*ba)},${Math.floor(10*ba)},${Math.floor(10*ba)},${ba*.9})`
        const br=ba>0.6?(1.5+p.life*.08):(1+ba)
        scx.beginPath(); scx.ellipse(p.x*TILE,p.y*TILE,br,br*.6,Math.atan2(p.vy,p.vx),0,Math.PI*2); scx.fill()
        // Traînée
        if(ba<0.7){
          scx.strokeStyle=`rgba(120,5,5,${ba*.4})`; scx.lineWidth=.5
          scx.beginPath(); scx.moveTo(p.x*TILE,p.y*TILE); scx.lineTo((p.x-p.vx*3)*TILE,(p.y-p.vy*3)*TILE); scx.stroke()
        }
      } else if(p.t==='spark'){
        scx.strokeStyle='#ffee88'; scx.lineWidth=1.2
        scx.beginPath(); scx.moveTo(p.x*TILE,p.y*TILE); scx.lineTo((p.x-p.vx*3)*TILE,(p.y-p.vy*3)*TILE); scx.stroke()
      } else if(p.t==='wave'){
        // Shockwave expanding ring
        const prog=1-a
        const r=prog*(p.mr||3)*TILE
        if(r>1){
          scx.strokeStyle=`rgba(255,${180+Math.floor(75*a)},80,1)`
          scx.lineWidth=Math.max(.5,2*(1-prog))
          scx.shadowBlur=6*a; scx.shadowColor='rgba(255,150,50,.8)'
          scx.beginPath(); scx.arc(p.x*TILE,p.y*TILE,r,0,Math.PI*2); scx.stroke()
          scx.shadowBlur=0
        }
      } else if(p.t==='exp'){
        const r=(1-a)*TILE*2.5
        scx.strokeStyle=`rgba(255,${80+Math.floor(120*a)},0,1)`;scx.lineWidth=1.5
        scx.beginPath(); scx.arc(p.x*TILE,p.y*TILE,r,0,Math.PI*2); scx.stroke()
      } else if(p.t==='sup'){
        scx.fillStyle='#ffaa00'; scx.fillRect(p.x*TILE,p.y*TILE,2,2)
      } else {
        scx.fillStyle=p.t==='d0'?'#44aaff':'#ff5555'
        scx.beginPath(); scx.arc(p.x*TILE,p.y*TILE,2,0,Math.PI*2); scx.fill()
      }
      scx.globalAlpha=1
    }


    // ── HEATMAP TACTIQUE ──────────────────────────────────
    if(this._showHeatmap&&this.hmActivity&&this._hmImgData){
      const _hpx=this._hmImgData.data,_mw=this.MW,_mh=this.MH
      for(let y=0;y<_mh;y++) for(let x=0;x<_mw;x++){
        const k=(y*_mw+x)<<2,act=Math.min(1,this.hmActivity[y*_mw+x]*.8),pr=this.hmPresence[y*_mw+x]
        if(act>0.04||Math.abs(pr)>0.04){
          _hpx[k]=Math.min(255,(act*255+(pr<0?(-pr)*120:0)))|0
          _hpx[k+1]=Math.min(255,act*160)|0
          _hpx[k+2]=Math.min(255,(pr>0?pr*200:0)+(act>.1?0:25))|0
          _hpx[k+3]=Math.min(155,(act*200+Math.abs(pr)*110))|0
        } else {_hpx[k+3]=0}
      }
      const _offC=document.createElement('canvas');_offC.width=_mw;_offC.height=_mh
      _offC.getContext('2d').putImageData(this._hmImgData,0,0)
      scx.save();scx.globalAlpha=0.5;scx.imageSmoothingEnabled=true
      scx.drawImage(_offC,0,0,_mw*TILE,_mh*TILE);scx.restore()
    }
    scx.restore()

    // ── DEATHS ────────────────────────────────────────────
    scx.save()
    for(const d of this.deaths){
      const a=Math.max(0,1-d.age/600)
      const px=d.x*TILE, py=d.y*TILE
      const dAge=d.age/600
      // Mare de sang qui s'étend avec le temps
      const poolR=Math.min(8,1.5+d.age*.025)
      scx.globalAlpha=a*.35
      // Ellipse sang avec dégradé
      const bloodGrd=scx.createRadialGradient(px,py+1,0,px,py+1,poolR)
      bloodGrd.addColorStop(0,'rgba(120,5,5,.8)')
      bloodGrd.addColorStop(.6,'rgba(80,3,3,.4)')
      bloodGrd.addColorStop(1,'rgba(60,2,2,0)')
      scx.fillStyle=bloodGrd
      scx.beginPath(); scx.ellipse(px,py+1.5,poolR,poolR*.55,0,0,Math.PI*2); scx.fill()
      // Corps tombé — silhouette détaillée selon le rôle
      scx.globalAlpha=a*.65
      scx.save(); scx.translate(px,py); scx.rotate((d.dir||0)+Math.PI/2)
      // Ombre du corps
      scx.fillStyle='rgba(0,0,0,.3)'
      scx.beginPath(); scx.ellipse(1,2,7,3,0,0,Math.PI*2); scx.fill()
      // Corps aplati équipe-coloré
      scx.fillStyle=hexA(TC[d.team],.4)
      scx.beginPath(); scx.ellipse(0,0,6,2.8,0,0,Math.PI*2); scx.fill()
      // Bras étendus
      scx.strokeStyle=hexA(TC[d.team],.3); scx.lineWidth=2; scx.lineCap='round'
      scx.beginPath(); scx.moveTo(-2,-1); scx.lineTo(-5,-4); scx.stroke()
      scx.beginPath(); scx.moveTo(-2,1); scx.lineTo(-4,4); scx.stroke()
      // Casque tombé
      scx.fillStyle='rgba(0,0,0,.35)'
      scx.beginPath(); scx.arc(5,0,2.5,0,Math.PI*2); scx.fill()
      scx.fillStyle=hexA(TC[d.team],.45)
      scx.beginPath(); scx.arc(4.5,-.3,2.2,0,Math.PI*2); scx.fill()
      scx.restore()
    }
    scx.restore()

    // ── AGENTS ────────────────────────────────────────────
    for(const a of this.agents){
      if(a.hp<=0) continue
      const px=a.x*TILE, py=a.y*TILE, col=TC[a.team]

      // Lean from movement direction
      let lean=0
      if(a.trail&&a.trail.length>=3){
        const t0=a.trail[0], tn=a.trail[a.trail.length-1]
        const mvDir=Math.atan2(tn.y-t0.y,tn.x-t0.x)
        const perpDiff=((mvDir-a.dir+Math.PI*3)%(Math.PI*2))-Math.PI
        lean=perpDiff*.12
      }

      scx.save(); scx.translate(px,py)

      // Trail (enhanced for DISPERSE sprint)
      if(a.trail&&a.trail.length>1){
        const isSprint=a.state==='D'
        scx.save()
        scx.globalAlpha=isSprint?.24:.1
        scx.strokeStyle=col; scx.lineWidth=isSprint?5:3; scx.lineCap='round'
        scx.beginPath(); scx.moveTo((a.trail[0].x-a.x)*TILE,(a.trail[0].y-a.y)*TILE)
        for(let k=1;k<a.trail.length;k++) scx.lineTo((a.trail[k].x-a.x)*TILE,(a.trail[k].y-a.y)*TILE)
        scx.stroke(); scx.restore()
      }

      // Aim line
      if(a.lockTarget&&a.lockTarget.hp>0&&(a.state==='E'||a.state==='S'||a.state==='AM')){
        const toE=Math.atan2(a.lockTarget.y-a.y,a.lockTarget.x-a.x)
        const aimErr=this._ad(a.dir,toE)
        const thresh=AIM_THRESH[a.rn]||Math.PI/5
        const aligned=aimErr<thresh
        const toEx=(a.lockTarget.x-a.x)*TILE, toEy=(a.lockTarget.y-a.y)*TILE
        scx.save()
        if(aligned){
          // Pulsing solid line
          scx.globalAlpha=.25+Math.sin(frame*.3)*.1
          scx.strokeStyle=col; scx.lineWidth=1; scx.setLineDash([3,4])
          scx.beginPath(); scx.moveTo(0,0); scx.lineTo(toEx,toEy); scx.stroke()
          // Dot at target
          scx.setLineDash([]); scx.globalAlpha=.5; scx.fillStyle=col
          scx.beginPath(); scx.arc(toEx,toEy,2,0,Math.PI*2); scx.fill()
        } else {
          // Misaligned: show current aim dir in red + gap arc
          const aimDist=Math.hypot(toEx,toEy)
          scx.globalAlpha=.15; scx.strokeStyle='#ff5533'; scx.lineWidth=.8; scx.setLineDash([2,5])
          scx.beginPath(); scx.moveTo(0,0); scx.lineTo(Math.cos(a.dir)*aimDist*.7,Math.sin(a.dir)*aimDist*.7); scx.stroke()
          scx.setLineDash([])
          // Gap arc
          scx.globalAlpha=.1; scx.strokeStyle='#ff5533'; scx.lineWidth=1
          const arcR=Math.min(22,aimDist*.3)
          const a1=Math.min(a.dir,toE), a2=Math.max(a.dir,toE)
          if(a2-a1<Math.PI){scx.beginPath(); scx.arc(0,0,arcR,a1,a2); scx.stroke()}
        }
        scx.restore()
      }

      // AMBUSH state: pulsing ring + watch ray
      if(a.state==='AM'){
        const pulse=.45+Math.sin(frame*.15)*.25
        scx.save()
        scx.globalAlpha=pulse*.45; scx.strokeStyle='#ff8844'; scx.lineWidth=2
        scx.setLineDash([4,3])
        scx.beginPath(); scx.arc(0,0,12,0,Math.PI*2); scx.stroke()
        scx.setLineDash([])
        const wd=this._ambushWatchDir(a)
        scx.globalAlpha=pulse*.3; scx.strokeStyle='#ff8844'; scx.lineWidth=1; scx.setLineDash([3,6])
        scx.beginPath(); scx.moveTo(0,0); scx.lineTo(Math.cos(wd)*20,Math.sin(wd)*20); scx.stroke()
        scx.setLineDash([])
        scx.restore()
      }

      // CMD aura
      if(a.isCmd&&CFG.cmd){
        scx.globalAlpha=.12+Math.sin(frame*.06)*.06; scx.fillStyle='#ffdd44'
        scx.beginPath(); scx.arc(0,0,11,0,Math.PI*2); scx.fill()
        scx.globalAlpha=.5; scx.strokeStyle='#ffdd44'; scx.lineWidth=1; scx.setLineDash([2,3])
        scx.beginPath(); scx.arc(0,0,11,0,Math.PI*2); scx.stroke(); scx.setLineDash([])
        scx.globalAlpha=1
      }
      if(a.cmdAura&&CFG.cmd){scx.globalAlpha=.07+Math.sin(frame*.05+a.uid)*.03;scx.fillStyle=col;scx.beginPath();scx.arc(0,0,9,0,Math.PI*2);scx.fill();scx.globalAlpha=1}
      if(a.supCD>0){scx.globalAlpha=.1+Math.sin(frame*.4)*.05;scx.fillStyle='#ffaa00';scx.beginPath();scx.arc(0,0,8,0,Math.PI*2);scx.fill();scx.globalAlpha=1}
      if(a.state==='RL'){
        const prog=1-(a.relCD/a.role.relT)
        scx.strokeStyle='rgba(80,80,100,0.3)';scx.lineWidth=2.5
        scx.beginPath();scx.arc(0,0,9,0,Math.PI*2);scx.stroke()
        scx.strokeStyle='#bb55ff';scx.lineWidth=2.5;scx.globalAlpha=.95
        scx.shadowBlur=5;scx.shadowColor='#aa44ff'
        scx.beginPath();scx.arc(0,0,9,-Math.PI/2,-Math.PI/2+Math.PI*2*prog);scx.stroke()
        scx.shadowBlur=0;scx.globalAlpha=1
      }
      if(this._fovMult(a.rn)>1){scx.globalAlpha=.18;scx.fillStyle='#22ff88';scx.beginPath();scx.arc(0,0,10,0,Math.PI*2);scx.fill();scx.globalAlpha=1}

      if(a.flCD>0){
        const _hp=1-a.flCD/12, _hr=6+_hp*16, _ha=a.flCD/12*.7
        scx.globalAlpha=_ha; scx.strokeStyle='rgba(255,180,80,0.9)'; scx.lineWidth=2-_hp
        scx.beginPath(); scx.arc(0,0,_hr,0,Math.PI*2); scx.stroke()
        scx.fillStyle='rgba(255,80,80,.2)'; scx.beginPath(); scx.arc(0,0,8,0,Math.PI*2); scx.fill()
        scx.globalAlpha=1
      }

      // Agent body with lean
      scx.save()
      const _pl=.5+Math.sin(this.frame*.12+a.uid)*.5
      const _hpCrit=a.hp/a.role.hp<.20
      const _sb=a.mzCD>0?20:a.state==='E'?7+_pl*4:a.state==='R'?(_hpCrit?14+_pl*6:5):a.state==='AM'?9+_pl*5:3
      const _sc=a.state==='R'?(_hpCrit?'#ff2200':'#ff7700'):a.state==='AM'?'#ff8844':col
      scx.shadowBlur=_sb; scx.shadowColor=_sc
      scx.rotate(a.dir+lean)
      const _fp2=a.state==='R'?(.5+Math.sin(this.frame*.5+a.uid*1.7)*.5):0
      const fc=a.flCD>0?'#ffffff':a.state==='R'?('rgba(255,'+(80+(_fp2*80)|0)+',0,1)'):a.state==='S'?'#ffff44':a.state==='P'?'#44ffcc':a.state==='RL'?'#aa44ff':a.state==='AM'?'#ff8844':a.state==='D'?'#44ffaa':col
      scx.fillStyle=fc
      this._drawShape(scx,a.rn,a.state,col,frame)
      scx.shadowBlur=0
      // Gun barrel highlight
      scx.fillStyle='rgba(255,255,255,.8)'; scx.fillRect(5,-1,3,2)
      scx.restore()
      scx.restore() // end translate

      // HP bar — segmentée, style militaire
      const hpSmooth=(a.hpSmooth!==undefined?a.hpSmooth:a.hp)
      const hpRatio=Math.max(0,hpSmooth)/a.role.hp
      const hpCol=hpRatio>.6?'#22dd44':hpRatio>.3?'#ffaa00':'#ff2222'
      const barW=18, barH=3, barX=px-9, barY=py-16
      // Fond
      scx.fillStyle='#050709'; scx.fillRect(barX-1,barY-1,barW+2,barH+2)
      scx.fillStyle='#0d1018'; scx.fillRect(barX,barY,barW,barH)
      // Remplissage avec gradient de couleur
      const fillW=Math.max(0,barW*hpRatio)
      if(fillW>0){
        const grad=scx.createLinearGradient(barX,barY,barX+fillW,barY)
        grad.addColorStop(0,hpCol);grad.addColorStop(1,hpRatio>.6?'#55ff77':hpRatio>.3?'#ffcc44':'#ff5555')
        scx.fillStyle=grad; scx.fillRect(barX,barY,fillW,barH)
      }
      // Séparateurs de segments (5 segments)
      scx.fillStyle='rgba(0,0,0,0.5)'
      for(let s=1;s<5;s++) scx.fillRect(barX+Math.floor(barW*s/5),barY,1,barH)
      // Flash dégâts
      if(a.flCD>0){scx.fillStyle=`rgba(255,60,60,${a.flCD/12*.7})`;scx.fillRect(barX,barY,barW,barH)}

      // Medkit charges (SUPPORT)
      if(a.medkit&&a.medkit.charges>0){
        const mkW=4, mkGap=2, mkTotal=3
        for(let mi=0;mi<mkTotal;mi++){
          const filled=mi<a.medkit.charges
          scx.fillStyle=filled?'#44ff88':'#0d1a12'
          scx.fillRect(px-7+mi*(mkW+mkGap),py-14,mkW,2)
        }
      }
      // Smoke charges (FLANKER/ASSAULT)
      if(a.smoke&&a.smoke.charges>0&&!a.smoke.active){
        const swMax=a.rn==='FLANKER'?2:1
        for(let si=0;si<swMax;si++){
          scx.fillStyle=si<a.smoke.charges?'#aaaacc':'#0d0d1a'
          scx.fillRect(px+2+si*5,py-14,4,2)
        }
      }
      // Mag bar — primary or sidearm
      scx.fillStyle='#12152a'; scx.fillRect(px-8,py-11,16,1.5)
      if(a.sqActive){
        // Sidearm: orange bar
        scx.fillStyle='#ff8800'
        scx.fillRect(px-8,py-11,16*(a.sqMag/SIDEARM.mag),1.5)
      } else {
        scx.fillStyle=a.mag/a.role.mag>.4?'#3377ff':'#ff6600'
        scx.fillRect(px-8,py-11,16*(a.mag/a.role.mag),1.5)
      }

      // State label
      const aggLabel=a.personality>.7?'!':a.personality<.3?'?':''
      const sc=a.sqActive?'🔫':a.state==='S'?'⊕':a.state==='R'?'↩':a.state==='P'?'⤴':a.state==='RL'?'↺':a.state==='A'?'→':a.state==='AM'?'◎':a.state==='D'?'↝':''
      scx.globalAlpha=.55; scx.fillStyle=a.isCmd&&CFG.cmd?'#ffdd44':col
      scx.font='7px Share Tech Mono'; scx.textAlign='center'
      scx.fillText((a.isCmd&&CFG.cmd?'♛ ':'')+a.role.lbl+sc+(aggLabel||''),px,py+17)
      scx.globalAlpha=1
    }

    // ── KILL FLOATS ───────────────────────────────────────
    if(this.floats) for(const f of this.floats){
      scx.save()
      scx.globalAlpha=f.life/f.ml
      scx.font=`bold ${8+Math.floor((1-f.life/f.ml)*4)}px Share Tech Mono`
      scx.fillStyle=f.col||'#fff'; scx.textAlign='center'
      scx.shadowBlur=5; scx.shadowColor=f.col||'#fff'
      scx.fillText(f.text,f.x*TILE,f.y*TILE)
      scx.shadowBlur=0; scx.restore()
    }

    // ── NIGHT ATMOSPHERE ──────────────────────────────────
    const isN=false; const nr=0  // jour/nuit supprimé
    const dr=isN?0:this.dnCycle/CFG.dayLen
    const ov=Math.max(0,nr>.9?1:nr>.7?(nr-.7)/.2:dr>.9?(1-dr)/.1*.3:0)
    if(ov>0){
      if(isN&&ov>.2){
        scx.save()
        // Stars
        scx.globalAlpha=Math.min(1,(ov-.2)/.8)*.4; scx.fillStyle='#fff'
        for(let i=0;i<60;i++){
          const sx=((i*173+this.seed%100)%MW)*TILE+(i*31)%TILE
          const sy=((i*97+this.seed%50)%(MH*.55))*TILE+(i*17)%TILE
          const sz=i%6===0?1.5:i%3===0?1:.5
          scx.fillRect(sx|0,sy|0,sz,sz)
        }
        // Moon glow
        const moonX=W*.78, moonY=H*.1
        const moonR=TILE*1.4
        const mg=scx.createRadialGradient(moonX,moonY,0,moonX,moonY,moonR*4)
        mg.addColorStop(0,'rgba(180,210,255,.18)'); mg.addColorStop(.5,'rgba(120,160,255,.06)'); mg.addColorStop(1,'rgba(0,0,0,0)')
        scx.globalAlpha=Math.min(1,(ov-.2)/.8)*.7
        scx.fillStyle=mg; scx.beginPath(); scx.arc(moonX,moonY,moonR*4,0,Math.PI*2); scx.fill()
        // Moon disc
        scx.globalAlpha=Math.min(1,(ov-.2)/.8)*.5; scx.fillStyle='#ddeeff'
        scx.shadowBlur=14; scx.shadowColor='#aaccff'
        scx.beginPath(); scx.arc(moonX,moonY,moonR,0,Math.PI*2); scx.fill()
        scx.shadowBlur=0; scx.restore()
      }
      // Dark overlay
      scx.fillStyle=`rgba(5,10,35,${Math.min(.55,ov*.6)})`; scx.fillRect(0,0,W,H)
    }

    // ── JAM SCANLINES ─────────────────────────────────────
    if(this.jamActive){
      scx.save(); scx.globalAlpha=.03+Math.sin(frame*.4)*.012
      scx.fillStyle=this.jamTeam===0?'#44aaff':'#ff5555'
      for(let y=0;y<H;y+=4) scx.fillRect(0,y,W,1.5)
      scx.globalAlpha=.32+Math.sin(frame*.3)*.12; scx.fillStyle=this.jamTeam===0?'#44aaff':'#ff5555'
      scx.font='8px Share Tech Mono'; scx.textAlign='center'
      scx.fillText('◈ BROUILLAGE '+(this.jamTeam===0?'ALPHA':'BRAVO'),W/2,12)
      scx.restore()
    }

    // ── KILL FLASH ────────────────────────────────────────
    for(let t=0;t<2;t++){
      if(this.flashKill[t]>0){
        const fl=this.flashKill[t]/8
        scx.fillStyle=TC[t]; scx.globalAlpha=fl*.18; scx.fillRect(0,0,W,H)
        scx.globalAlpha=1
      }
    }

    // ── FOW (night vision masking) ─────────────────────────
    if(ov>.1){
      const str=Math.min(.5,ov*.6)
      scx.save()
      scx.fillStyle=`rgba(0,0,10,${str})`; scx.fillRect(0,0,W,H)
      scx.globalCompositeOperation='destination-out'
      for(const a of this.agents){
        if(a.hp<=0) continue
        const fm=this._fovMult(a.rn)
        const r=a.role.rng*TILE*.95*fm  // légèrement plus large pour voir les coins
        const grad=scx.createRadialGradient(a.x*TILE,a.y*TILE,0,a.x*TILE,a.y*TILE,r)
        grad.addColorStop(0,`rgba(0,0,0,${str})`); grad.addColorStop(.6,`rgba(0,0,0,${str*.5})`); grad.addColorStop(1,'rgba(0,0,0,0)')
        scx.fillStyle=grad; scx.beginPath(); scx.arc(a.x*TILE,a.y*TILE,r,0,Math.PI*2); scx.fill()
      }
      scx.globalCompositeOperation='source-over'; scx.restore()
    }

    // ── END SCREEN ────────────────────────────────────────
    if(this.state==='end'){
      scx.save()
      scx.fillStyle='rgba(0,0,0,.74)'; scx.fillRect(0,0,W,H)
      const ecol=this.winner>=0?TC[this.winner]:'#fff'
      const etxt=this.winner===0?'ALPHA WINS':this.winner===1?'BRAVO WINS':'DRAW'
      scx.fillStyle=ecol; scx.shadowBlur=40; scx.shadowColor=ecol
      scx.font=`bold ${Math.max(20,Math.floor(W/18))}px Share Tech Mono`; scx.textAlign='center'
      scx.fillText(etxt,W/2,H/2-14)
      scx.shadowBlur=0; scx.fillStyle='#445566'; scx.font='10px Share Tech Mono'
      scx.fillText(`α ${this.killCount[0]} kills  β ${this.killCount[1]} kills`,W/2,H/2+4)
      scx.fillStyle='#223344'; scx.font='9px Share Tech Mono'
      scx.fillText(`seed ${this.seed} · CLICK restart`,W/2,H/2+20)
      scx.restore()
    }

    // ══ COMPOSITE TO DISPLAY CANVAS ═══════════════════════
    cx.clearRect(0,0,this.cv.width,this.cv.height)
    cx.save()
    cx.scale(s,s)

    // Chromatic aberration during JAM (screen blend triple-draw)
    if(this.jamActive&&this.sceneCV){
      cx.drawImage(this.sceneCV,0,0)
      const shift=2.2+Math.sin(frame*.18)*1.2
      const jamStr=Math.min(.22,(this.jamTimer||0)/(CFG.jamDur||250)*.30)
      if(jamStr>.02){
        cx.globalCompositeOperation='screen'
        cx.globalAlpha=jamStr
        cx.drawImage(this.sceneCV,shift,0)
        cx.globalAlpha=jamStr*.7
        cx.drawImage(this.sceneCV,-shift,shift*.3)
        cx.globalCompositeOperation='source-over'
        cx.globalAlpha=1
      }
    } else {
      cx.drawImage(this.sceneCV,0,0)
    }

    cx.restore()
    const _vw=this.cv.width,_vh=this.cv.height
    // Vignette teintée par biome
    const _bvCol={urban:[0,0,0],desert:[20,8,0],forest:[0,10,0],industrial:[15,5,0],snow:[0,5,15]}[this.biome]||[0,0,0]
    const _vg=cx.createRadialGradient(_vw/2,_vh/2,_vh*.28,_vw/2,_vh/2,_vh*.82)
    _vg.addColorStop(0,'rgba(0,0,0,0)')
    _vg.addColorStop(0.6,`rgba(${_bvCol[0]},${_bvCol[1]},${_bvCol[2]},0.08)`)
    _vg.addColorStop(1,`rgba(${_bvCol[0]},${_bvCol[1]},${_bvCol[2]},0.50)`)
    cx.fillStyle=_vg; cx.fillRect(0,0,_vw,_vh)
    this._drawMinimap()
    this._drawKillChart()
  }

  _drawShape(scx,rn,state,teamCol,frame){
    const cr=state==='AM'||state==='S'  // accroupi
    const run=state==='D'||state==='A'  // sprint
    const aim=state==='E'||state==='S'  // visée
    const k=cr?.78:1
    const fc=scx.fillStyle, oa=scx.globalAlpha
    const col=teamCol||fc
    const bob=Math.sin(frame*.18)  // animation respiration
    const stepOsc=Math.sin(frame*.28)  // oscillation marche

    // ── DRONE ──────────────────────────────────────────────
    if(rn==='DRONE'){
      const rot=(frame*.012)%(Math.PI*2)
      // Ombre
      scx.save(); scx.globalAlpha=oa*.12; scx.fillStyle='#000'
      scx.beginPath(); scx.ellipse(1,4,7,3.5,0,0,Math.PI*2); scx.fill(); scx.restore()
      // Corps central hexagonal
      scx.save()
      scx.shadowBlur=16; scx.shadowColor=col
      scx.strokeStyle=col; scx.lineWidth=1.2; scx.fillStyle=fc
      scx.beginPath()
      for(let i=0;i<6;i++){const a=i*Math.PI/3+Math.PI/6;scx.lineTo(Math.cos(a)*5,Math.sin(a)*5)}
      scx.closePath(); scx.fill(); scx.stroke()
      // Centre caméra
      scx.fillStyle='rgba(0,0,0,.6)'; scx.beginPath(); scx.arc(0,0,2.5,0,Math.PI*2); scx.fill()
      scx.fillStyle=Math.sin(frame*.09)>.0?col:'rgba(255,0,0,.9)'
      scx.beginPath(); scx.arc(0,0,1.2,0,Math.PI*2); scx.fill()
      scx.shadowBlur=0; scx.restore()
      // 4 bras + rotors
      for(let i=0;i<4;i++){
        const ra=i*Math.PI/2+Math.PI/4+rot*.5
        const rx=Math.cos(ra)*6.5, ry=Math.sin(ra)*6.5
        // Bras
        scx.strokeStyle='rgba(255,255,255,.25)'; scx.lineWidth=1
        scx.beginPath(); scx.moveTo(Math.cos(ra)*3.5,Math.sin(ra)*3.5); scx.lineTo(rx,ry); scx.stroke()
        // Rotor (arc animé)
        scx.strokeStyle=hexA?hexA(col,.5):`${col}88`; scx.lineWidth=1.5
        scx.beginPath()
        scx.arc(rx,ry,2.8,rot*2,rot*2+Math.PI*1.4); scx.stroke()
        scx.beginPath()
        scx.arc(rx,ry,2.8,rot*2+Math.PI,rot*2+Math.PI*2.4); scx.stroke()
      }
      return
    }

    // ── OMBRE AU SOL ──────────────────────────────────────
    scx.save()
    scx.globalAlpha=oa*.20; scx.fillStyle='#000'
    const sh=cr?2:3
    scx.beginPath(); scx.ellipse(sh,5*k,7*k,3*k,0,0,Math.PI*2); scx.fill()
    scx.restore()

    // ── JAMBES / BASE ─────────────────────────────────────
    if(!cr){
      scx.save(); scx.fillStyle='rgba(0,0,0,.45)'
      const legY=4*k, legW=2*k, legH=4*k
      if(run){
        // Jambes en mouvement — alterné
        scx.fillRect(-legW-2+stepOsc*1.5, legY, legW, legH*(1+Math.abs(stepOsc)*.3))
        scx.fillRect(legW+stepOsc*.5,   legY, legW, legH*(1-Math.abs(stepOsc)*.2))
      } else {
        // Stance stable légèrement écartée
        scx.fillRect(-legW*1.5, legY, legW, legH)
        scx.fillRect(legW*.5,   legY, legW, legH)
      }
      // Genouillères (ASSAULT et FLANKER)
      if(rn==='ASSAULT'||rn==='FLANKER'){
        scx.fillStyle='rgba(255,255,255,.08)'
        scx.fillRect(-legW*1.5,legY+1,legW,1.5)
        scx.fillRect(legW*.5,legY+1,legW,1.5)
      }
      scx.restore()
    }

    // ── ÉQUIPEMENT DOS (avant corps) ──────────────────────
    scx.save()
    if(rn==='SUPPORT'){
      // Pack lourd arrondi
      scx.fillStyle='rgba(20,20,30,0.85)'
      scx.beginPath()
      if(scx.roundRect)scx.roundRect(-8*k,-5*k,6*k,10*k,2)
      else scx.rect(-8*k,-5*k,6*k,10*k)
      scx.fill()
      // Sangles
      scx.strokeStyle='rgba(80,60,40,.5)'; scx.lineWidth=1
      scx.beginPath(); scx.moveTo(-5*k,-4*k); scx.lineTo(-5*k,4*k); scx.stroke()
      // Croix rouge
      scx.fillStyle='rgba(220,30,30,.85)'
      scx.fillRect(-6.5*k,-1.2*k,3*k,.9*k)
      scx.fillRect(-5.3*k,-2.2*k,.9*k,3*k)
      // Poches
      scx.fillStyle='rgba(255,255,255,.05)'
      scx.fillRect(-7.5*k,1.5*k,4*k,2.5*k)
    } else if(rn==='SNIPER'){
      // Bipied replié
      scx.strokeStyle='rgba(0,0,0,.5)'; scx.lineWidth=1.5
      scx.beginPath(); scx.moveTo(4*k,1.5*k); scx.lineTo(4*k,4*k); scx.lineTo(6*k,5*k); scx.stroke()
      scx.beginPath(); scx.moveTo(4*k,1.5*k); scx.lineTo(4*k,4*k); scx.lineTo(2*k,5*k); scx.stroke()
    } else if(rn==='LEADER'){
      // Antenne radio
      scx.strokeStyle='rgba(255,220,60,.35)'; scx.lineWidth=1.2
      scx.beginPath(); scx.moveTo(-5*k,-5*k); scx.lineTo(-5*k,-9*k); scx.stroke()
      scx.fillStyle='rgba(255,220,60,.5)'; scx.beginPath(); scx.arc(-5*k,-9*k,1.3,0,Math.PI*2); scx.fill()
      // Radio boite
      scx.fillStyle='rgba(0,0,0,.4)'; scx.fillRect(-8*k,-2*k,4*k,5*k)
      scx.strokeStyle='rgba(255,220,60,.2)'; scx.lineWidth=.5
      scx.strokeRect(-8*k,-2*k,4*k,5*k)
    } else if(rn==='FLANKER'){
      // Petite poche latérale
      scx.fillStyle='rgba(0,0,0,.3)'; scx.fillRect(-5*k,-2*k,3*k,3*k)
    }
    scx.restore()

    // ── CORPS PRINCIPAL ───────────────────────────────────
    // Couche ombre (décalée légèrement)
    scx.fillStyle='rgba(0,0,0,.35)'
    scx.beginPath()
    _bodyPath(scx,rn,k+.5,1)
    scx.fill()

    // Couche couleur principale
    scx.fillStyle=fc
    scx.beginPath()
    _bodyPath(scx,rn,k,0)
    scx.fill()

    // Détails du gilet / équipement (sur le corps)
    scx.save()
    // Plaques gilet
    scx.fillStyle='rgba(255,255,255,.07)'
    if(rn==='LEADER'){
      scx.fillRect(-1*k,-3*k,3*k,6*k)  // plaque frontale
      scx.strokeStyle='rgba(255,255,255,.1)'; scx.lineWidth=.5
      scx.strokeRect(-1*k,-3*k,3*k,6*k)
    } else if(rn==='ASSAULT'){
      scx.fillRect(-1*k,-2.5*k,3*k,5*k)
      scx.strokeStyle='rgba(255,255,255,.08)'; scx.lineWidth=.5
      scx.strokeRect(-1*k,-2.5*k,3*k,5*k)
    }
    // Bandeau / insigne équipe
    scx.fillStyle=hexA?hexA(col,.3):`${col}4d`
    if(rn==='FLANKER'||rn==='ASSAULT'){
      scx.fillRect(-2*k,-1*k,1.5*k,2*k)  // patch équipe
    }
    // Highlight bord éclairé haut-gauche
    scx.fillStyle='rgba(255,255,255,.13)'
    scx.beginPath()
    _bodyHighlight(scx,rn,k)
    scx.fill()
    scx.restore()

    // ── BRAS / ÉPAULES ────────────────────────────────────
    scx.save()
    scx.fillStyle='rgba(0,0,0,.35)'
    // Épaule avant (droite = vers l'ennemi)
    const armY = aim ? -1.5*k : -2*k
    scx.beginPath(); scx.arc(4*k, armY, 2*k, 0, Math.PI*2); scx.fill()
    scx.fillStyle='rgba(255,255,255,.06)'
    scx.beginPath(); scx.arc(4*k, armY, 2*k, -Math.PI*.7, -Math.PI*.1); scx.fill()
    scx.restore()

    // ── CASQUE ────────────────────────────────────────────
    const headX = rn==='SNIPER'?5*k : rn==='LEADER'?3*k : 3.5*k
    const headR = rn==='SUPPORT'?3.2*k : rn==='LEADER'?3.2*k : 2.6*k
    const bobHead = bob*.4*k

    scx.save()
    // Coque casque
    scx.fillStyle='rgba(0,0,0,.3)'
    scx.beginPath(); scx.arc(headX+.5, bobHead+.5, headR, 0, Math.PI*2); scx.fill()
    // Corps casque couleur
    scx.fillStyle=fc
    scx.beginPath(); scx.arc(headX, bobHead, headR, 0, Math.PI*2); scx.fill()
    // Bord casque
    scx.strokeStyle='rgba(0,0,0,.25)'; scx.lineWidth=.8
    scx.beginPath(); scx.arc(headX, bobHead, headR, Math.PI*.1, Math.PI*.9); scx.stroke()
    // Visière colorée équipe
    scx.fillStyle=col; scx.globalAlpha=oa*.7
    scx.beginPath()
    scx.arc(headX+headR*.35, bobHead, headR*.75, -Math.PI*.5, Math.PI*.5); scx.fill()
    // Reflet visière (glare)
    scx.fillStyle='rgba(255,255,255,.35)'; scx.globalAlpha=oa*.55
    scx.beginPath()
    scx.arc(headX+headR*.15, bobHead-headR*.2, headR*.35, -Math.PI*.4, Math.PI*.15); scx.fill()
    // Accessoire casque par rôle
    scx.globalAlpha=oa
    if(rn==='SNIPER'){
      // Scope monté casque
      scx.strokeStyle='rgba(150,200,255,.4)'; scx.lineWidth=1.2
      scx.beginPath(); scx.moveTo(headX+headR,bobHead-headR*.5); scx.lineTo(headX+headR+4,bobHead-headR*.5); scx.stroke()
      scx.fillStyle='rgba(100,180,255,.5)'; scx.beginPath(); scx.arc(headX+headR+4,bobHead-headR*.5,1.5,0,Math.PI*2); scx.fill()
    } else if(rn==='LEADER'){
      // Insigne commandement
      scx.fillStyle='rgba(255,220,50,.6)'
      for(let i=0;i<3;i++){scx.fillRect(headX-headR*.4+i*1.4,bobHead-headR-.5,.8,1.5)}
    } else if(rn==='FLANKER'){
      // Visière tactique
      scx.fillStyle='rgba(100,255,200,.15)'
      scx.beginPath(); scx.arc(headX+headR*.3,bobHead+headR*.1,headR*.6,-Math.PI*.5,Math.PI*.5); scx.fill()
    }
    scx.restore()

    // ── ARME DÉTAILLÉE ────────────────────────────────────
    scx.save()
    const aimDip = aim ? 1.5*k : 0
    scx.translate(0, aimDip)

    if(rn==='SNIPER'){
      // Corps long
      scx.fillStyle='rgba(15,15,20,.9)'; scx.fillRect(1*k,-1.2*k,12*k,2.2*k)
      // Rail picatinny
      scx.strokeStyle='rgba(255,255,255,.12)'; scx.lineWidth=.6
      for(let ri=0;ri<5;ri++) scx.strokeRect((2+ri*1.8)*k,-1.2*k,1.2*k,0.6*k)
      // Scope
      scx.fillStyle='rgba(20,20,30,.95)'; scx.fillRect(5*k,-2*k,4*k,1.2*k)
      scx.fillStyle='rgba(100,180,255,.3)'; scx.fillRect(5.2*k,-1.9*k,3.6*k,.8*k)
      // Détente
      scx.fillStyle='rgba(0,0,0,.5)'; scx.fillRect(2*k,1*k,1.2*k,2*k)
      // Canon
      scx.fillStyle='rgba(10,10,15,.9)'; scx.fillRect(10*k,-.5*k,6*k,1*k)
      // Suppressor
      scx.fillStyle='rgba(20,20,25,.9)'; scx.fillRect(13*k,-1*k,3*k,2*k)
      // Crosse
      scx.fillStyle='rgba(40,30,20,.8)'; scx.fillRect(-3*k,-1*k,3*k,2*k)
      scx.fillStyle='rgba(60,45,30,.6)'; scx.fillRect(-2.8*k,-.8*k,2.6*k,1.6*k)
    } else if(rn==='ASSAULT'){
      // Corps M4-style
      scx.fillStyle='rgba(15,15,20,.9)'; scx.fillRect(.5*k,-1.4*k,10*k,2.6*k)
      // Grip avant
      scx.fillStyle='rgba(30,25,20,.8)'; scx.fillRect(5*k,1.2*k,1.5*k,3*k)
      // Chargeur courbé
      scx.fillStyle='rgba(25,22,18,.9)'
      scx.beginPath(); scx.moveTo(3*k,1.3*k); scx.lineTo(5*k,1.3*k); scx.lineTo(5.5*k,5*k); scx.lineTo(2.5*k,4.8*k); scx.closePath(); scx.fill()
      // Canon
      scx.fillStyle='rgba(10,10,15,.9)'; scx.fillRect(9*k,-.4*k,4*k,.8*k)
      // Détente
      scx.fillStyle='rgba(0,0,0,.5)'; scx.fillRect(2.5*k,.8*k,1*k,2*k)
      // Rail haut
      scx.strokeStyle='rgba(255,255,255,.08)'; scx.lineWidth=.5
      for(let ri=0;ri<4;ri++) scx.strokeRect((1+ri*2)*k,-1.4*k,1.5*k,.5*k)
      // Crosse
      scx.fillStyle='rgba(20,18,15,.85)'; scx.fillRect(-2.5*k,-.8*k,3*k,1.6*k)
    } else if(rn==='FLANKER'){
      // SMG compact type MP5/UMP
      scx.fillStyle='rgba(15,15,20,.9)'; scx.fillRect(.5*k,-1.2*k,8*k,2.2*k)
      // Chargeur droit
      scx.fillStyle='rgba(20,18,15,.9)'; scx.fillRect(3*k,1*k,1.5*k,4*k)
      // Canon court
      scx.fillStyle='rgba(10,10,15,.9)'; scx.fillRect(7.5*k,-.35*k,3*k,.7*k)
      // Poignée pistol
      scx.fillStyle='rgba(30,25,20,.85)'; scx.fillRect(1*k,.8*k,2*k,3.5*k)
      // Détente
      scx.fillStyle='rgba(0,0,0,.5)'; scx.fillRect(1.8*k,.8*k,.8*k,1.8*k)
      // Crosse pliée
      scx.strokeStyle='rgba(20,20,25,.8)'; scx.lineWidth=1.5
      scx.beginPath(); scx.moveTo(-.5*k,-1*k); scx.lineTo(-2.5*k,-1.8*k); scx.stroke()
      scx.beginPath(); scx.moveTo(-.5*k,1*k); scx.lineTo(-2.5*k,1.8*k); scx.stroke()
    } else if(rn==='SUPPORT'){
      // LMG type M249
      scx.fillStyle='rgba(15,15,20,.9)'; scx.fillRect(.5*k,-2*k,9*k,3.8*k)
      // Box chargeur
      scx.fillStyle='rgba(25,22,18,.9)'; scx.fillRect(2*k,1.8*k,4*k,4*k)
      scx.strokeStyle='rgba(255,255,255,.06)'; scx.lineWidth=.5
      scx.strokeRect(2*k,1.8*k,4*k,4*k)
      // Bipied
      scx.strokeStyle='rgba(0,0,0,.5)'; scx.lineWidth=1.2
      scx.beginPath(); scx.moveTo(5*k,1.8*k); scx.lineTo(4*k,5*k); scx.stroke()
      scx.beginPath(); scx.moveTo(5*k,1.8*k); scx.lineTo(6*k,5*k); scx.stroke()
      // Canon lourd
      scx.fillStyle='rgba(10,10,15,.9)'; scx.fillRect(8.5*k,-.5*k,5*k,1*k)
      // Dissipateur thermique
      scx.strokeStyle='rgba(255,255,255,.08)'; scx.lineWidth=.6
      for(let ri=0;ri<4;ri++){scx.beginPath();scx.moveTo((5+ri*.8)*k,-2*k);scx.lineTo((5+ri*.8)*k,1.8*k);scx.stroke()}
      // Poignée
      scx.fillStyle='rgba(30,25,20,.85)'; scx.fillRect(1*k,1.5*k,1.8*k,3.5*k)
    } else { // LEADER
      // PDW / P90 type
      scx.fillStyle='rgba(15,15,20,.9)'; scx.fillRect(.5*k,-1.5*k,9*k,2.8*k)
      // Chargeur transparent horizontal sur le dessus
      scx.fillStyle='rgba(50,40,30,.7)'; scx.fillRect(1.5*k,-2.2*k,5*k,1*k)
      scx.fillStyle='rgba(255,200,50,.1)'; scx.fillRect(1.7*k,-2.1*k,4.6*k,.6*k)
      // Canon
      scx.fillStyle='rgba(10,10,15,.9)'; scx.fillRect(8.5*k,-.4*k,3.5*k,.8*k)
      // Grip
      scx.fillStyle='rgba(30,25,20,.85)'; scx.fillRect(1*k,.8*k,2*k,3*k)
      // Détente
      scx.fillStyle='rgba(0,0,0,.5)'; scx.fillRect(1.8*k,.8*k,.8*k,1.5*k)
      // Rail
      scx.strokeStyle='rgba(255,220,50,.12)'; scx.lineWidth=.5
      for(let ri=0;ri<3;ri++) scx.strokeRect((1+ri*2)*k,-1.5*k,1.5*k,.5*k)
    }

    // Highlight canon (reflet métallique)
    scx.strokeStyle='rgba(255,255,255,.12)'; scx.lineWidth=.5
    scx.beginPath()
    const barrelLen=rn==='SNIPER'?15:rn==='SUPPORT'?12:rn==='ASSAULT'?11:9
    scx.moveTo(1*k,-1.1*k); scx.lineTo(barrelLen*k,-1.1*k); scx.stroke()

    scx.restore()

    // ── FLASH DÉGÂTS ─────────────────────────────────────
    // (géré à l'extérieur via a.flCD)

    scx.fillStyle=fc; scx.globalAlpha=oa
  }

  // Helper: contours corps par rôle
  // (défini comme fonction globale pour éviter redéfinition dans la boucle)

  _drawMinimap(){
    const mmcx=this.mmx,mw=this.mm.width,mh=this.mm.height
    const scx=mw/this.MW,scy=mh/this.MH
    mmcx.clearRect(0,0,mw,mh)
    mmcx.fillStyle='rgba(5,8,14,.88)';mmcx.fillRect(0,0,mw,mh)
    // Map
    for(let y=0;y<this.MH;y++)for(let x=0;x<this.MW;x++){
      const t=this.map[y][x]
      if(t===1){mmcx.fillStyle='#1c2230';mmcx.fillRect(x*scx,y*scy,scx,scy)}
      else if(t===2){mmcx.fillStyle='#1a2c14';mmcx.fillRect(x*scx,y*scy,scx,scy)}
    }
    // BB intel
    for(let t=0;t<2;t++){
      const b=this.BB[t];if(b.conf<10)continue
      mmcx.fillStyle='rgba('+(t===0?'68,170,255':'255,85,85')+','+b.conf/100*.5+')'
      mmcx.beginPath();mmcx.arc(b.x*scx,b.y*scy,2.5,0,Math.PI*2);mmcx.fill()
    }
    // Agents
    for(const a of this.agents){
      if(a.hp<=0)continue
      mmcx.fillStyle=TC[a.team]
      mmcx.fillRect(a.x*scx-1,a.y*scy-1,2.5,2.5)
    }
  }

  _initHist(){const L=200,CH=4;this._hBuf=new Float32Array(CH*L);this._hHead=0;this._hLen=L;this._hCH=CH;this._hFull=false}
  _sampleHist(){
    if(!this._hBuf)this._initHist()
    const b=this._hBuf,h=this._hHead,L=this._hLen
    let ha=0,hb=0,na=0,nb=0
    for(const a of this.agents){if(a.hp<=0)continue;if(a.team===0){ha+=a.hp/a.role.hp;na++}else{hb+=a.hp/a.role.hp;nb++}}
    b[0*L+h]=Math.min(1,this.killCount[0]/Math.max(1,this.agents.length*.5))
    b[1*L+h]=Math.min(1,this.killCount[1]/Math.max(1,this.agents.length*.5))
    b[2*L+h]=na>0?ha/na:0; b[3*L+h]=nb>0?hb/nb:0
    this._hHead=(h+1)%L; if(this._hHead===0)this._hFull=true
  }
  _drawKillChart(){
    if(!this.kcv)return
    const K=this.kcv,kcx=this.kcx,W2=K.width,H2=K.height
    kcx.clearRect(0,0,W2,H2)
    if(!this._hBuf)this._initHist()
    if(this.frame%12===0)this._sampleHist()
    const b=this._hBuf,L=this._hLen,n=this._hFull?L:this._hHead
    if(n<2)return
    const cols=['rgba(68,170,255,.9)','rgba(255,85,85,.9)','rgba(68,200,100,.5)','rgba(255,100,100,.5)']
    for(let ch=0;ch<this._hCH;ch++){
      kcx.beginPath();kcx.strokeStyle=cols[ch];kcx.lineWidth=ch<2?1.5:1
      for(let i=0;i<n;i++){
        const si=(this._hHead-n+i+L)%L,v=isFinite(b[ch*L+si])?b[ch*L+si]:0
        const px=i/(n-1)*W2,py=H2*(1-v*.9)
        i===0?kcx.moveTo(px,py):kcx.lineTo(px,py)
      }
      kcx.stroke()
    }
  }
}

// ══════════════════════════════════════════════════════════
// COMPARE STATS
// ══════════════════════════════════════════════════════════
function updateCmpStats(){
  if(!simA||!simB)return
  const stats=document.getElementById('cmpStats')
  stats.classList.toggle('visible',COMPARE)
  if(!COMPARE||!simA||!simB)return
  const fmt=sim=>{
    const w=sim.winner===0?'ALPHA':sim.winner===1?'BRAVO':sim.state==='run'?'—':'DRAW'
    const col=sim.winner===0?'#44aaff':sim.winner===1?'#ff5555':'#8899aa'
    const secs=Math.floor(sim.frame/60),m=Math.floor(secs/60),s=(secs%60).toString().padStart(2,'0')
    return{w,col,kills:`${sim.killCount[0]}–${sim.killCount[1]}`,dur:`${m}:${s}`}
  }
  const a=fmt(simA),b=fmt(simB)
  const _gid=id=>document.getElementById(id)
  ;['cmpWinA','cmpWinB','cmpKillsA','cmpKillsB','cmpDurA','cmpDurB','fillAlpha0','fillBravo0','fillDur0'].forEach(id=>{if(!_gid(id))return})
  if(_gid('cmpWinA')){_gid('cmpWinA').textContent=a.w;_gid('cmpWinA').style.color=a.col}
  if(_gid('cmpWinB')){_gid('cmpWinB').textContent=b.w;_gid('cmpWinB').style.color=b.col}
  if(_gid('cmpKillsA'))_gid('cmpKillsA').textContent='kills: '+a.kills
  if(_gid('cmpKillsB'))_gid('cmpKillsB').textContent='kills: '+b.kills
  if(_gid('cmpDurA'))_gid('cmpDurA').textContent='dur: '+a.dur
  if(_gid('cmpDurB'))_gid('cmpDurB').textContent='dur: '+b.dur
  // Bars
  // FIX 2: proper comparative bars — left=simA, right=simB from center
  const maxKa=Math.max(1,simA.killCount[0],simB.killCount[0])
  const maxKb=Math.max(1,simA.killCount[1],simB.killCount[1])
  const maxD=Math.max(1,simA.frame,simB.frame)
  // Alpha kills bar: simA fills from left, simB fills from right
  if(_gid('fillAlpha0')){
    _gid('fillAlpha0').style.left='0'
    _gid('fillAlpha0').style.width=Math.round(simA.killCount[0]/maxKa*50)+'%'
  }
  if(_gid('fillAlpha1')){
    _gid('fillAlpha1').style.right='0';_gid('fillAlpha1').style.left='auto'
    _gid('fillAlpha1').style.width=Math.round(simB.killCount[0]/maxKa*50)+'%'
  }
  // Bravo kills bar
  if(_gid('fillBravo0')){
    _gid('fillBravo0').style.left='0'
    _gid('fillBravo0').style.width=Math.round(simA.killCount[1]/maxKb*50)+'%'
  }
  if(_gid('fillBravo1')){
    _gid('fillBravo1').style.right='0';_gid('fillBravo1').style.left='auto'
    _gid('fillBravo1').style.width=Math.round(simB.killCount[1]/maxKb*50)+'%'
  }
  // Duration bar
  if(_gid('fillDur0'))_gid('fillDur0').style.width=Math.round(simA.frame/maxD*50)+'%'
  if(_gid('fillDur1')){_gid('fillDur1').style.right='0';_gid('fillDur1').style.left='auto';_gid('fillDur1').style.width=Math.round(simB.frame/maxD*50)+'%'}
}

// ══════════════════════════════════════════════════════════
// LAYOUT
// ══════════════════════════════════════════════════════════
function setCompare(on){
  COMPARE=on
  document.getElementById('wrapB').style.display=on?'flex':'none'
  document.getElementById('cmpDiv').style.display=on?'block':'none'
  document.getElementById('btnCompare').classList.toggle('act',on)
  document.getElementById('cmpStats').classList.toggle('visible',on)
  if(on){
    if(!simB){
      simB=new Sim('cvB','mmB',{a0:'a0B',a1:'a1B',ms:'msB',seedD:'seedDB',jamL:'jamLB',nightL:'nightLB',scoreEl:'scoreB',kcId:'killChartB'})
      // Use different seed for B
      const seedA=simA?simA.seed:0
      simB.reset(seedA+1)
    }
  }
  // Resize both sims after compare toggle
  if(simA)simA.resize()
  if(simB)simB.resize()
  _syncWin()
  if(simA&&simB)updateCmpStats()
}

// ══════════════════════════════════════════════════════════
// MAIN LOOP
// ══════════════════════════════════════════════════════════
window._dlJ=function(slot){try{const raw=localStorage.getItem('tacJournal_'+slot);if(!raw)return;const d=JSON.parse(raw);const b=new Blob([raw],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='journal_'+d.seed+'_'+d.date+'.json';a.click()}catch(e){alert(e.message)}}

let _lastTs=0,_acc=0,_rafId=null,_startMs=0
const STEP_MS=1000/60
const MAX_STEPS=4

function loop(ts){
  if(_lastTs===0)_lastTs=ts
  const dt=Math.min(ts-_lastTs,100)
  _lastTs=ts;_acc+=dt
  let steps=0
  while(_acc>=STEP_MS&&steps<MAX_STEPS*CFG.simSpeed){
    for(let i=0;i<CFG.simSpeed;i++){
      try{if(simA)simA.update()}catch(e){console.error('[tick]',e.message)}
      try{if(COMPARE&&simB)simB.update()}catch(e){}
    }
    _acc-=STEP_MS;steps++
  }
  try{if(simA)simA.draw()}catch(e){console.warn('[draw] simA:',e.message)}
  try{if(COMPARE&&simB)simB.draw()}catch(e){console.warn('[draw] simB:',e.message)}
  if(COMPARE)updateCmpStats()
  if(simA&&simA.frame===0&&ts-_startMs>4000){console.warn('[WATCHDOG] reset');_startMs=ts;_lastTs=0;_acc=0;simA.reset();if(simB)simB.reset()}
  _rafId=requestAnimationFrame(loop)
}

function startLoop(){if(_rafId){cancelAnimationFrame(_rafId);_rafId=null};_lastTs=0;_acc=0;_startMs=performance.now();_rafId=requestAnimationFrame(loop)}

// ══════════════════════════════════════════════════════════
// CONFIG UI
// ══════════════════════════════════════════════════════════
const ROLE_PARAMS=[
  {key:'hp',   label:'HP',   min:30, max:300, step:10, def:100, unit:''},
  {key:'spdM', label:'VIT',  min:50, max:200, step:5,  def:100, unit:'%'},
  {key:'dmgM', label:'DMG',  min:50, max:300, step:5,  def:100, unit:'%'},
  {key:'magM', label:'MAG',  min:25, max:300, step:10, def:100, unit:'%'},
  {key:'rngM', label:'RNG',  min:50, max:200, step:5,  def:100, unit:'%'},
]

function buildRoleTable(){
  const tbody=document.getElementById('rTblBody')
  for(const rn of RK){
    const tr=document.createElement('tr')
    let html=`<td class="rl">${rn}</td>`
    for(const p of ROLE_PARAMS){
      const id=`rp_${rn}_${p.key}`
      html+=`<td><div style="display:flex;align-items:center;gap:3px"><input type="range" id="${id}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.def}" style="width:40px;height:2px;accent-color:#44aaff;cursor:pointer"><span id="${id}v" style="width:22px;font-size:6.5px;color:#44aaff;text-align:right">${p.def}${p.unit}</span></div></td>`
    }
    tr.innerHTML=html; tbody.appendChild(tr)
    for(const p of ROLE_PARAMS){
      const el=document.getElementById(`rp_${rn}_${p.key}`), vEl=document.getElementById(`rp_${rn}_${p.key}v`)
      el.addEventListener('input',()=>vEl.textContent=el.value+p.unit)
    }
  }
}

function bindSl(id,vid,unit='',pre=''){
  const el=document.getElementById(id),vEl=document.getElementById(vid)
  if(!el||!vEl)return
  const fmt=v=>pre+(+v===0&&unit===''?'∞':v+unit)
  el.addEventListener('input',()=>vEl.textContent=fmt(el.value))
}

function applyPreset(name){
  const p=PRESETS[name]; if(!p)return
  Object.assign(CFG,p)
  // Sync inputs
  if(p.agentsPerTeam!==undefined){const el=document.getElementById('cfgAgents');if(el){el.value=p.agentsPerTeam;document.getElementById('cfgAgentsV').textContent=p.agentsPerTeam}}
  if(p.simSpeed!==undefined){const el=document.getElementById('cfgSpeed');if(el){el.value=p.simSpeed;document.getElementById('cfgSpeedV').textContent=p.simSpeed}}
  if(p.dayLen!==undefined){const el=document.getElementById('cfgDayLen');if(el){el.value=p.dayLen;document.getElementById('cfgDayLenV').textContent=p.dayLen}}
  if(p.nightLen!==undefined){const el=document.getElementById('cfgNightLen');if(el){el.value=p.nightLen;document.getElementById('cfgNightLenV').textContent=p.nightLen}}
  if(p.jamFreq!==undefined){const el=document.getElementById('cfgJamFreq');if(el){el.value=p.jamFreq;document.getElementById('cfgJamFreqV').textContent=p.jamFreq}}
  if(p.timeLimit!==undefined){const el=document.getElementById('cfgTimeLimit');if(el){el.value=p.timeLimit;document.getElementById('cfgTimeLimitV').textContent=p.timeLimit===0?'∞':p.timeLimit}}
  if(p.asymmetric!==undefined){const el=document.getElementById('cfgAsym');if(el)el.checked=p.asymmetric}
}

function readCFG(){
  const ms=document.querySelector('input[name=mapSize]:checked')?.value;if(ms)CFG.mapSize=ms
  const mode=document.querySelector('input[name=mode]:checked')?.value;if(mode)CFG.mode=mode
  CFG.agentsPerTeam=+(document.getElementById('cfgAgents')?.value||5)
  CFG.simSpeed=+(document.getElementById('cfgSpeed')?.value||1)
  CFG.zoneWinScore=+(document.getElementById('cfgZoneWin')?.value||2000)
  CFG.timeLimit=+(document.getElementById('cfgTimeLimit')?.value||0)
  CFG.coverBlock=+(document.getElementById('cfgCover')?.value||52)
  CFG.dangerDecay=+(document.getElementById('cfgDecay')?.value||97)
  CFG.grenades=!!document.getElementById('cfgGrenades')?.checked
  CFG.coverArc180=!!document.getElementById('cfgCoverArc')?.checked
  CFG.tracer=!!document.getElementById('cfgTracer')?.checked
  CFG.moral=!!document.getElementById('cfgMoral')?.checked
  CFG.teamStyle=[document.getElementById('styleA')?.value||'trained',document.getElementById('styleB')?.value||'trained']
  CFG.phero=!!document.getElementById('cfgPhero')?.checked
  CFG.cmd=!!document.getElementById('cfgCmd')?.checked
  CFG.dayNight=false  // désactivé
  CFG.dayLen=+(document.getElementById('cfgDayLen')?.value||2400)
  CFG.nightLen=+(document.getElementById('cfgNightLen')?.value||1200)
  CFG.jam=!!document.getElementById('cfgJam')?.checked
  CFG.jamFreq=+(document.getElementById('cfgJamFreq')?.value||2000)
  CFG.asymmetric=!!document.getElementById('cfgAsym')?.checked
  for(const rn of RK) for(const p of ROLE_PARAMS){
    const v=+(document.getElementById(`rp_${rn}_${p.key}`)?.value||p.def)
    CFG.roles[rn][p.key]=v
  }
}

function saveCFG(){
  try{
    const data={
      mapSize:CFG.mapSize, mode:CFG.mode,
      agentsPerTeam:CFG.agentsPerTeam, simSpeed:CFG.simSpeed,
      coverBlock:CFG.coverBlock, dangerDecay:CFG.dangerDecay,
      zoneWinScore:CFG.zoneWinScore, timeLimit:CFG.timeLimit,
      grenades:CFG.grenades, tracer:CFG.tracer, moral:CFG.moral,
      phero:CFG.phero, cmd:CFG.cmd,
      dayNight:CFG.dayNight, dayLen:CFG.dayLen, nightLen:CFG.nightLen,
      jam:CFG.jam, jamFreq:CFG.jamFreq,
      asymmetric:CFG.asymmetric,
      teamStyle:CFG.teamStyle,
      roles:CFG.roles,
      ts:Date.now()
    }
    localStorage.setItem('tacCFG',JSON.stringify(data))
    const el=document.getElementById('cfgSaveStatus');if(el){el.textContent='✓ sauvegardé';setTimeout(()=>{el.textContent=''},2000)}
  }catch(e){}
}

function loadCFG(){
  try{
    const raw=localStorage.getItem('tacCFG')
    if(!raw)return false
    const d=JSON.parse(raw)
    // Peupler les champs du formulaire depuis les données sauvées
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v}
    const chk=(id,v)=>{const el=document.getElementById(id);if(el)el.checked=!!v}
    const rad=(name,v)=>{const el=document.querySelector('input[name='+name+'][value='+v+']');if(el)el.checked=true}
    if(d.mapSize)rad('mapSize',d.mapSize)
    if(d.mode)rad('mode',d.mode)
    set('cfgAgents',d.agentsPerTeam||5)
    set('cfgSpeed',d.simSpeed||1)
    set('cfgCover',d.coverBlock||52)
    set('cfgDecay',d.dangerDecay||97)
    set('cfgZoneWin',d.zoneWinScore||2000)
    set('cfgTimeLimit',d.timeLimit||0)
    chk('cfgGrenades',d.grenades)
    chk('cfgTracer',d.tracer)
    chk('cfgMoral',d.moral)
    chk('cfgPhero',d.phero)
    chk('cfgCmd',d.cmd)
    chk('cfgDayNight',d.dayNight)
    set('cfgDayLen',d.dayLen||2400)
    set('cfgNightLen',d.nightLen||1200)
    chk('cfgJam',d.jam)
    set('cfgJamFreq',d.jamFreq||2000)
    chk('cfgAsym',d.asymmetric)
    if(d.teamStyle){
      const sa=document.getElementById('styleA'),sb=document.getElementById('styleB')
      if(sa)sa.value=d.teamStyle[0]||'trained'
      if(sb)sb.value=d.teamStyle[1]||'trained'
    }
    if(d.roles){
      for(const rn of RK) for(const p of ROLE_PARAMS){
        if(d.roles[rn]&&d.roles[rn][p.key]!==undefined){
          const el=document.getElementById('rp_'+rn+'_'+p.key)
          if(el)el.value=d.roles[rn][p.key]
        }
      }
    }
    // Mettre à jour les labels des sliders
    document.querySelectorAll('input[type=range]').forEach(sl=>{
      sl.dispatchEvent(new Event('input'))
    })
    return true
  }catch(e){return false}
}

function resetCFGForm(){
  for(const rn of RK) for(const p of ROLE_PARAMS){
    const el=document.getElementById(`rp_${rn}_${p.key}`), vEl=document.getElementById(`rp_${rn}_${p.key}v`)
    if(el){el.value=p.def;vEl.textContent=p.def+p.unit}
  }
}

function refreshScores(){
  const tbody=document.getElementById('scoresTblBody'); tbody.innerHTML=''
  let scores=[];try{scores=JSON.parse(localStorage.getItem('tacScores')||'[]')}catch(e){}
  if(!scores.length){tbody.innerHTML='<tr><td colspan="5" style="color:#223344;padding:5px">—</td></tr>';return}
  scores.forEach((s,i)=>{
    const secs=Math.floor(s.frames/60),m=Math.floor(secs/60),sec=(secs%60).toString().padStart(2,'0')
    const col=s.winner==='ALPHA'?'#44aaff':s.winner==='BRAVO'?'#ff5555':'#666'
    tbody.innerHTML+='<tr><td style="color:#334455">'+(i+1)+'</td><td style="color:'+col+'">'+s.winner+'</td><td>'+s.kills0+'-'+s.kills1+'</td><td>'+m+':'+sec+'</td><td style="color:#2a3a44">'+(s.seed||'?')+'</td></tr>'
  })
}

function doRestart(newSeed){
  readCFG()
  const seed=newSeed?0:simA?.seed||0
  simA.reset(seed)
  if(COMPARE&&simB) simB.reset(seed?0:simB.seed)
  _nnRng=mulberry32((simA.seed>>>0)||1)   // re-seed NN/RNN → reproductible au même seed
  _syncWin()
  document.getElementById('panel').classList.remove('open')
}

function initUI(){
  buildRoleTable()
  loadCFG()  // charger config sauvegardée
  bindSl('cfgAgents','cfgAgentsV');bindSl('cfgSpeed','cfgSpeedV')
  bindSl('cfgZoneWin','cfgZoneWinV');bindSl('cfgTimeLimit','cfgTimeLimitV','')
  bindSl('cfgCover','cfgCoverV','%');bindSl('cfgDecay','cfgDecayV','%')
  bindSl('cfgDayLen','cfgDayLenV');bindSl('cfgNightLen','cfgNightLenV')
  bindSl('cfgJamFreq','cfgJamFreqV')

  // Panel close uniquement (open géré par showConfig/showAnalyzer)
  document.getElementById('panel-close').addEventListener('click',()=>document.getElementById('panel').classList.remove('open'))

  // ── TOGGLE CONFIG / ANALYSER ──────────────────────────────────
  let analyzerMode=false
  const cfgSections=['cfgPresets','cfgMap','cfgSim','cfgStyle','cfgRoles','cfgTools','cfgNN','cfgScores']

  function showConfig(){
    analyzerMode=false
    document.getElementById('analyzerSection').style.display='none'
    document.getElementById('cfgActions').style.display='flex'
    document.getElementById('panel-head').querySelector('span').textContent='⚙ CONFIGURATION v1.0'
    cfgSections.forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=''})
    localStorage.setItem('tacLastPanel','config')
    refreshScores()
  }
  function showAnalyzer(){
    analyzerMode=true
    document.getElementById('analyzerSection').style.display='block'
    document.getElementById('cfgActions').style.display='none'
    document.getElementById('panel-head').querySelector('span').textContent='📊 ANALYSER TACTIQUE'
    cfgSections.forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none'})
    localStorage.setItem('tacLastPanel','analyser')  // mémoriser dernier panel
    azLoad()
  }

  document.getElementById('btnAnalyze').addEventListener('click',()=>{
    document.getElementById('panel').classList.add('open')
    showAnalyzer()
  })
  document.getElementById('btnCfg').addEventListener('click',()=>{
    const panel=document.getElementById('panel')
    if(panel.classList.contains('open')&&!analyzerMode){panel.classList.remove('open');return}
    panel.classList.add('open')
    showConfig()
  })

  // ── ANALYSER LOGIC ────────────────────────────────────────────
  document.getElementById('azRefresh').addEventListener('click',azLoad)
  document.getElementById('azImportBtn').addEventListener('click',()=>document.getElementById('azFileIn').click())
  document.getElementById('azFileIn').addEventListener('change',function(){
    const f=this.files[0]; if(!f)return
    const r=new FileReader()
    r.onload=ev=>{try{azAnalyze(JSON.parse(ev.target.result))}catch(e){alert('Erreur JSON: '+e.message)}}
    r.readAsText(f); this.value=''
  })

  function azLoad(){
    const el=document.getElementById('azSlots')
    try{
      const m=JSON.parse(localStorage.getItem('tacJournal_manifest')||'[]')
      if(!m.length){el.innerHTML='<div style="font-size:7px;color:#1a2535">Aucun journal — lancez une partie</div>';return}
      el.innerHTML=m.slice(0,3).map(s=>{
        const d=new Date(s.date),ts=d.getHours()+':'+String(d.getMinutes()).padStart(2,'0')
        const sc2=s.final?'#44aa66':'#ffaa44', sym=s.final?'●':'○'
        return'<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #0a0f18"><span style="color:'+sc2+';font-size:8px">'+sym+'</span><span style="flex:1;font-size:7px;color:#445566">seed '+s.seed+' · '+s.events+'evt · '+ts+'</span><button onclick="azLoadSlot('+s.slot+')" style="font-size:7px;padding:2px 8px;background:none;border:1px solid #1a2535;color:#44aaff;cursor:pointer;font-family:inherit">ANALYSER</button><button onclick="azDl('+s.slot+')" style="font-size:7px;padding:2px 6px;background:none;border:1px solid #1a2535;color:#556677;cursor:pointer;font-family:inherit">↓</button></div>'
      }).join('')
    }catch(e){el.innerHTML='<div style="color:#ff3333;font-size:7px">'+e.message+'</div>'}
  }

  window.azLoadSlot=function(slot){
    try{const raw=localStorage.getItem('tacJournal_'+slot);if(raw)azAnalyze(JSON.parse(raw))}catch(e){alert(e.message)}
  }
  window.azDl=function(slot){
    try{
      const raw=localStorage.getItem('tacJournal_'+slot);if(!raw)return
      const d=JSON.parse(raw),b=new Blob([raw],{type:'application/json'})
      const a=document.createElement('a');a.href=URL.createObjectURL(b)
      a.download='journal_'+d.seed+'_'+d.date+'.json';a.click()
    }catch(e){}
  }

  function azAnalyze(data){
    document.getElementById('azAnalysis').style.display='block'
    const ev=data.events||[]
    const fires=ev.filter(e=>e.t==='FIRE'), hits=ev.filter(e=>e.t==='HIT')
    const kills=ev.filter(e=>e.t==='KILL'), states=ev.filter(e=>e.t==='STATE')
    const detects=ev.filter(e=>e.t==='DETECT')
    const dur=Math.floor((data.frames||0)/60)
    const acc=fires.length>0?(hits.length/fires.length*100).toFixed(1):0
    const w=data.winner===0?'ALPHA':data.winner===1?'BRAVO':'DRAW'
    const wc=data.winner===0?'#44aaff':data.winner===1?'#ff5555':'#667788'

    // Vue d'ensemble
    document.getElementById('azOverview').innerHTML=[
      [dur+'s','DURÉE'],['<span style="color:'+wc+'">'+w+'</span>','VAINQUEUR'],
      [(data.kills||[0,0])[0]+'/'+((data.kills||[0,0])[1]),'KILLS α/β'],
      [acc+'%','PRÉCISION'],[ev.length,'ÉVÉNEMENTS'],[states.length,'TRANSITIONS']
    ].map(([v,l])=>`<div class="az-stat"><span class="az-stat-v">${v}</span><span class="az-stat-l">${l}</span></div>`).join('')

    // Rôles
    const rnIco={LEADER:'⌘',ASSAULT:'▲',FLANKER:'◈',SNIPER:'⊕',SUPPORT:'⊞'}
    const rnData={}
    Object.keys(rnIco).forEach(r=>rnData[r]={f:0,h:0,k:0,d:0})
    fires.forEach(e=>{if(rnData[e.rn])rnData[e.rn].f++})
    hits.forEach(e=>{if(rnData[e.rn])rnData[e.rn].h++})
    kills.forEach(e=>{if(rnData[e.rn])rnData[e.rn].k++;if(rnData[e.vrn])rnData[e.vrn].d++})
    document.getElementById('azRoles').innerHTML=Object.entries(rnData).map(([r,d])=>{
      const a2=d.f>0?(d.h/d.f*100).toFixed(0):0
      const kd=d.d>0?(d.k/d.d).toFixed(1):'∞'
      const col=a2>40?'#33cc55':a2>20?'#ffaa44':'#ff5533'
      return'<div class="nn-row"><span class="nn-lbl">'+rnIco[r]+'</span><div class="nn-bar-bg"><div class="nn-bar-fill" style="width:'+a2+'%;background:'+col+'"></div></div><span class="nn-val">'+a2+'% K/D:'+kd+'</span></div>'
    }).join('')

    // Erreurs
    const errs=[]
    const eW=states.filter(e=>e.next==='E'&&e.hpR<0.25)
    if(eW.length)errs.push(['ENGAGE PRÉCAIRE ×'+eW.length,eW.length+' engagement(s) HP < 25% — retraite conseillée',[...new Set(eW.map(e=>e.rn))].join(',')])
    const rLate=states.filter(e=>e.next!=='R'&&(e.hpR||1)<0.20&&!['R','RL'].includes(e.prev))
    if(rLate.length)errs.push(['RETRAITE TARDIVE ×'+rLate.length,rLate.length+' cas HP < 20% sans retraite',[...new Set(rLate.map(e=>e.rn))].join(',')])
    const badAcc=Object.entries(rnData).filter(([r,d])=>d.f>10&&d.h/d.f<0.05).map(([r])=>r)
    if(badAcc.length)errs.push(['POSITIONNEMENT ×'+badAcc.length,'ACC < 5% sur 10+ tirs: '+badAcc.join(', '),badAcc.join(',')])
    const lostC=states.filter(e=>e.prev==='E'&&e.next==='A')
    if(lostC.length>5)errs.push(['CONTACT PERDU ×'+lostC.length,lostC.length+' pertes de contact depuis ENGAGE',[...new Set(lostC.map(e=>e.rn))].join(',')])
    const failAm=states.filter(e=>e.prev==='AM'&&e.next==='H')
    if(failAm.length)errs.push(['EMBUSCADE ÉCHOUÉE ×'+failAm.length,failAm.length+' embuscade(s) sans contact',[...new Set(failAm.map(e=>e.rn))].join(',')])
    document.getElementById('azErrors').innerHTML=errs.length
      ? errs.map(([t,d,r])=>`<div class="az-err"><span style="color:#ff5533;font-size:6px;letter-spacing:1px">${t}</span><div style="margin-top:2px;color:#667788">${d}</div><div style="font-size:6px;color:#445566">Rôles: ${r}</div></div>`).join('')
      : '<div style="color:#33cc55;font-size:7px">✓ Aucune erreur majeure</div>'

    // Bonnes décisions
    const goods=[]
    const retOK=states.filter(e=>e.next==='R'&&(e.hpR||1)>0.15&&(e.hpR||1)<0.35)
    if(retOK.length)goods.push(['RETRAITE OPPORTUNE ×'+retOK.length,retOK.length+' retraite(s) bien timées (15-35% HP)'])
    const suppOK=states.filter(e=>e.next==='S'&&(e.uS||0)>40)
    if(suppOK.length)goods.push(['SUPPRESSION COORD. ×'+suppOK.length,suppOK.length+' suppression(s) utility > 40'])
    const closeK=kills.filter(e=>(e.dist||99)<5)
    if(closeK.length)goods.push(['KILLS RAPPROCHÉS ×'+closeK.length,closeK.length+' kill(s) < 5 tiles — bonne agressivité'])
    document.getElementById('azGoods').innerHTML=goods.length
      ? goods.map(([t,d])=>`<div class="az-ok"><span style="color:#33cc55;font-size:6px;letter-spacing:1px">${t}</span><div style="margin-top:2px;color:#556677">${d}</div></div>`).join('')
      : '<div style="color:#334455;font-size:7px">— Aucune décision remarquable</div>'

    // Transitions
    const tm={}
    states.forEach(e=>{const k=e.prev+'→'+e.next;if(!tm[k])tm[k]={n:0,hp:0,dist:0,los:0};tm[k].n++;tm[k].hp+=(e.hpR||0);tm[k].dist+=(e.dE||0);tm[k].los+=(e.hasLOS||0)})
    document.getElementById('azTrans').innerHTML=Object.entries(tm).sort((a,b)=>b[1].n-a[1].n).slice(0,8).map(([k,v])=>{
      const[f,t]=k.split('→');const n=v.n
      const tc=t==='R'?'#ff7700':t==='E'?'#33cc55':t==='AM'?'#ff8844':'#44aaff'
      return'<div class="az-tr"><span style="color:#44aaff;width:20px">'+f+'</span><span style="color:#667788">→</span><span style="color:'+tc+';width:24px">'+t+'</span><span style="color:#556677;flex:1">×'+n+' HP:'+(v.hp/n*100).toFixed(0)+'% dist:'+(v.dist/n).toFixed(1)+' LOS:'+(v.los/n*100).toFixed(0)+'%</span></div>'
    }).join('')

    // Scénarios
    const sc=[]
    if(errs.find(e=>e[0].startsWith('ENGAGE PRÉCAIRE')))sc.push('Testez seed '+data.seed+' en asymetrique - IA en inferiorite avec engagements risques')
    if(errs.find(e=>e[0].startsWith('CONTACT PERDU')))sc.push('🏙 Réduisez la map (SMALL) — les contacts distants causent les pertes de LOS')
    if(failAm&&failAm.length>2)sc.push('🌙 Mode NUIT + GUÉRILLA — améliorez le placement des embuscades')
    if(kills.length>0&&kills.reduce((s,k)=>s+(k.dist||8),0)/kills.length<5)sc.push('⚔ Mode BLITZ + FLANKER vs SNIPER — combats rapprochés dominants')
    document.getElementById('azScenarios').innerHTML=sc.length
      ? sc.map(s=>`<div class="az-scen">${s}</div>`).join('')
      : '<div style="color:#334455;font-size:7px">Jouez plus de parties pour générer des scénarios</div>'

    // NN state
    const icons2={LEADER:'⌘',ASSAULT:'▲',FLANKER:'◈',SNIPER:'⊕',SUPPORT:'⊞'}
    document.getElementById('azNN').innerHTML=Object.keys(icons2).map(rn=>{
      const upd0=parseInt(localStorage.getItem(LS+'tacNN_upd_'+wk(rn,0))||'0')
      const upd1=parseInt(localStorage.getItem(LS+'tacNN_upd_'+wk(rn,1))||'0')
      const upd=upd0+upd1
      const bl=Math.min(100,(upd0/2000*100)).toFixed(0)      // bar = team 0 (player)
      const bl1=Math.min(100,(upd1/2000*100)).toFixed(0)     // team 1 (adversary)
      return`<div class="nn-row"><span class="nn-lbl">${icons2[rn]}</span>
        <div class="nn-bar-bg"><div class="nn-bar-fill" style="width:${bl}%;background:#aa44ff"></div></div>
        <span class="nn-val">${upd}upd ${bl}/${bl1}%</span></div>`
    }).join('')
  }

  // Restart buttons
  document.getElementById('btnNewSeed').addEventListener('click',()=>doRestart(true))
  document.getElementById('btnSameSeed').addEventListener('click',()=>doRestart(false))

  // Compare toggle
  document.getElementById('btnCompare').addEventListener('click',()=>setCompare(!COMPARE))

  // Apply
  document.getElementById('applyBtn').addEventListener('click',()=>{readCFG();saveCFG();doRestart(true)})
  // Audio unlock + toggle
  document.addEventListener('click',()=>SFX.unlock(),{once:true})
  document.addEventListener('touchstart',()=>SFX.unlock(),{once:true,passive:true})
  document.getElementById('btnHeat')?.addEventListener('click',()=>{const on=!(simA&&simA._showHeatmap);if(simA)simA._showHeatmap=on;if(simB)simB._showHeatmap=on;document.getElementById('btnHeat')?.classList.toggle('hm-on',on)})
  document.getElementById('btnSleep')?.addEventListener('click',()=>{if(SV.active)SV.exit();else SV.enter()})
  document.getElementById('btnSound')?.addEventListener('click',()=>{
    SFX.unlock();SFX.enabled=!SFX.enabled
    const b=document.getElementById('btnSound')
    if(b){b.textContent=SFX.enabled?'🔊':'🔇';b.style.opacity=SFX.enabled?'1':'0.4'}
  })
  document.getElementById('resetCfgBtn').addEventListener('click',resetCFGForm)
  document.getElementById('clearScores').addEventListener('click',()=>{localStorage.removeItem('tacScores');refreshScores()})

  // NN controls
  document.getElementById('btnNNMode')?.addEventListener('click',()=>{
    NN.training=!NN.training
    const btn=document.getElementById('btnNNMode'),badge=document.getElementById('nnModeBadge')
    const isTrain=NN.training
    if(btn){btn.textContent=isTrain?'⚙ TRAIN':'◉ EVAL';btn.style.color=isTrain?'#44aaff':'#44ff88';btn.style.borderColor=isTrain?'#335577':'#336644'}
    if(badge){badge.textContent=isTrain?'TRAIN':'EVAL';badge.style.color=isTrain?'#44aaff':'#44ff88';badge.style.borderColor=isTrain?'#335577':'#336644'}
    NN._renderPanel()
  })
  document.getElementById('btnNNReset').addEventListener('click',()=>{if(confirm('Réinitialiser TOUT le cerveau IA (NN principal + GOAP RNN) ? Repart d\'une IA vierge.')){resetBrain()}})
  document.getElementById('btnBrainReset').addEventListener('click',()=>{if(confirm('Réinitialiser TOUT le cerveau IA (NN principal + GOAP RNN) ? Repart d\'une IA vierge.')){resetBrain()}})
  _loadMetrics(); renderMetrics();
  document.getElementById('btnGoapToggle').addEventListener('click',toggleGOAP)
  document.getElementById('btnMetricsReset').addEventListener('click',()=>{if(confirm('Remettre les métriques à zéro ?'))resetMetrics()})
  document.getElementById('btnJournalExport')?.addEventListener('click',()=>{
    const sim=window.simA; if(!sim?.journal?.length){alert('Journal vide - lancez une partie dabord');return}
    const blob=new Blob([JSON.stringify({seed:sim.seed,frames:sim.frame,kills:sim.killCount,meta:{FIRE:'tx,ty,tdist',HIT:'vuid,vrn,vx,vy,dmg,vhp,dist',KILL:'vuid,vrn,vtm,vx,vy,dist,a0,a1',STATE:'prev,next,hasLOS,hpR,dE,uE,uR,uA,uS,uH,plan',DETECT:'euid,ex,ey,dist'},events:sim.journal})],{type:'application/json'})
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob)
    a.download=`journal_${sim.seed}_${Date.now()}.json`; a.click()
  })
  document.getElementById('btnNNLoad').addEventListener('click',()=>{NN.init();const el=document.getElementById('nnSaveStatus');if(el)el.textContent='Rechargé ✓'})
  // Export NN weights as downloadable JSON
  document.getElementById('btnNNExport')?.addEventListener('click',()=>{
    const data={weights:{},updates:{},baseline:{},version:'v1.1',date:new Date().toISOString()}
    for(const rn of RK){
      for(const tm of NN_TEAMS){
        const kk=wk(rn,tm)
        data.weights[kk]=Array.from(NN.weights[kk]||[])
        data.updates[kk]=NN.updates[kk]||0
        data.baseline[kk]=NN.baseline[kk]||0
      }
    }
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a')
    a.href=url;a.download='tacNN_weights_'+Date.now()+'.json';a.click()
    URL.revokeObjectURL(url)
    const el=document.getElementById('nnSaveStatus');if(el)el.textContent='Exporté ✓'
  })
  // Import NN weights from JSON file
  document.getElementById('btnNNImport')?.addEventListener('click',()=>{
    document.getElementById('nnImportFile')?.click()
  })
  document.getElementById('nnImportFile')?.addEventListener('change',e=>{
    const file=e.target.files?.[0]; if(!file)return
    const reader=new FileReader()
    reader.onload=ev=>{
      try{
        const data=JSON.parse(ev.target.result)
        for(const rn of RK){
          for(const tm of NN_TEAMS){
            const kk=wk(rn,tm)
            // Accept new per-team keys; fall back to legacy role-only keys (apply to both teams).
            const src=data.weights?.[kk]?kk:(data.weights?.[rn]?rn:null)
            if(src){
              const arr=data.weights[src]
              if(arr.length===NN_W){
                NN.weights[kk]=new Float32Array(arr)
                NN.updates[kk]=data.updates?.[src]||0
                NN.baseline[kk]=data.baseline?.[src]||0
                if(!NN.m[kk])NN.m[kk]=new Float32Array(NN_W)
                if(!NN.v[kk])NN.v[kk]=new Float32Array(NN_W)
              }
            }
          }
        }
        NN.save(); NN._renderPanel()
        const el=document.getElementById('nnSaveStatus');if(el)el.textContent='Importé ✓ '+file.name
      }catch(err){alert('Erreur import: '+err.message)}
    }
    reader.readAsText(file)
    e.target.value=''
  })

  // Presets
  document.querySelectorAll('.preset-btn').forEach(btn=>btn.addEventListener('click',()=>{applyPreset(btn.dataset.preset)}))

  // Keyboard
  document.addEventListener('keydown',e=>{
    if(e.code==='Space'&&!document.getElementById('panel').classList.contains('open')){e.preventDefault();doRestart(true)}
    if(e.code==='KeyR')doRestart(false)
    if(e.code==='KeyD'){
      const d=document.getElementById('dbgOverlay')
      if(d){d.style.display=d.style.display==='none'?'block':'none'}
      else{
        const el=document.createElement('div')
        el.id='dbgOverlay'
        el.style.cssText='position:fixed;bottom:60px;left:8px;background:rgba(0,0,0,.85);color:#44aaff;font-size:9px;padding:6px 10px;z-index:999;font-family:monospace;pointer-events:none;line-height:1.6'
        el.innerHTML='DEBUG'
        document.body.appendChild(el)
      }
    }
  })

  // Click restart on end
  document.getElementById('cvA').addEventListener('click',()=>{if(simA?.state==='end')doRestart(true)})
  document.getElementById('cvB').addEventListener('click',()=>{if(simB?.state==='end')doRestart(false)})
}

// ══════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════
NN.init()  // load weights from localStorage or randomize

// Responsive: re-resize canvas on window resize
window.addEventListener('resize',()=>{fixCanvas(document.getElementById('cvA'));if(COMPARE)fixCanvas(document.getElementById('cvB'));if(simA)simA.resize();if(COMPARE&&simB)simB.resize()})

initUI()
simA=new Sim('cvA','mmA',{a0:'a0A',a1:'a1A',ms:'msA',seedD:'seedDA',jamL:'jamLA',nightL:'nightLA',scoreEl:'scoreA',kcId:'killChartA',statPfx:'statKillsA'})
simA.reset()
_nnRng=mulberry32((simA.seed>>>0)||1)   // seed initial NN/RNN aligné sur la partie
_syncWin()
startLoop()
setupGOAPHooks()
setTimeout(setupGOAPInteraction,400)

// [PATCH 4] Fonction selectBestTarget(self, enemies) supprimée :
// — Jamais référencée nulle part (code mort).
// — Utilisait des champs inexistants : e.alive (les agents ont .hp), self.fov (ils ont .role.fov).
// La sélection de cible réelle se fait dans Sim._selectTarget / Sim._scoreTarget.


// ── AUTO-RESTART — relance automatique après fin de partie ───────
// ══════════════════════════════════════════════════════════
// SCREENSAVER MODE
// ══════════════════════════════════════════════════════════
const SV={
  active:false,wakeLock:null,
  styles:['trained','aggressive','defensive','guerrilla'],

  async enter(){
    this.active=true
    document.body.classList.add('screensaver')
    const btn=document.getElementById('btnSleep')
    if(btn){btn.textContent='✕ QUITTER';btn.classList.add('sv-on')}
    try{if(navigator.wakeLock)this.wakeLock=await navigator.wakeLock.request('screen')}catch(e){}
    this._randomizeConfig()
    this._rafLoop()
  },

  exit(){
    this.active=false
    document.body.classList.remove('screensaver')
    const btn=document.getElementById('btnSleep')
    if(btn){btn.textContent='🌙 VEILLE';btn.classList.remove('sv-on')}
    try{if(this.wakeLock)this.wakeLock.release()}catch(e){}
    this.wakeLock=null
  },

  _randomizeConfig(){
    const s=this.styles
    CFG.teamStyle=[s[Math.floor(Math.random()*s.length)],s[Math.floor(Math.random()*s.length)]]
    const sa=document.getElementById('styleA'),sb=document.getElementById('styleB')
    if(sa)sa.value=CFG.teamStyle[0]
    if(sb)sb.value=CFG.teamStyle[1]
  },

  _rafLoop(){
    if(!this.active)return
    const sim=window.simA
    if(sim){
      const aa=sim.agents?.filter(a=>a.team===0&&a.hp>0)
      const ab=sim.agents?.filter(a=>a.team===1&&a.hp>0)
      const hpa=aa?.length?Math.round(aa.reduce((s,a)=>s+a.hp/a.role.hp,0)/aa.length*100):0
      const hpb=ab?.length?Math.round(ab.reduce((s,a)=>s+a.hp/a.role.hp,0)/ab.length*100):0
      const ai=document.getElementById('sv-a-info'),bi=document.getElementById('sv-b-info')
      if(ai)ai.textContent='K:'+(sim.killCount?.[0]||0)+' HP:'+hpa+'%'
      if(bi)bi.textContent='HP:'+hpb+'% K:'+(sim.killCount?.[1]||0)
      const sc=document.getElementById('sv-seed')
      const tc=document.getElementById('sv-timer')
      const nn=document.getElementById('sv-nn')
      if(sc)sc.textContent='SEED '+(sim.seed||'—')
      if(tc){const fr=sim.frame||0,s2=Math.floor(fr/60),m=Math.floor(s2/60);tc.textContent=m+':'+(s2%60).toString().padStart(2,'0')}
      if(nn){const tot=Object.values(NN.updates||{}).reduce((a,b)=>a+b,0);nn.textContent='NN '+tot.toLocaleString()+' UPD • BLEND '+(Math.round(Math.min(100,tot/100)))+'%'}
    }
    requestAnimationFrame(()=>this._rafLoop())
  }
}

document.addEventListener('visibilitychange',()=>{
  if(SV.active&&document.visibilityState==='visible'&&!SV.wakeLock)
    navigator.wakeLock?.request('screen').then(wl=>SV.wakeLock=wl).catch(()=>{})
})

;(function(){
  // Auto-restart — combinaison state==='end' + label check + cooldown timestamp
  let _lastRestart=0, _restarting=false

  function _isEnd(sim){return !!(sim&&sim.state==='end')}

  function _labelEnd(id){
    const el=document.getElementById(id)
    return !!(el&&!el.textContent.includes('COMBAT IN PROGRESS'))
  }

  function _done(){
    const aEnd=_isEnd(window.simA)||_labelEnd('msA')
    const bEnd=!window.COMPARE||_isEnd(window.simB)||_labelEnd('msB')
    return aEnd&&bEnd
  }

  function _tryRestart(){
    if(_restarting)return
    if(!_done())return
    const now=Date.now()
    if(now-_lastRestart<2500)return  // cooldown anti-boucle
    _restarting=true
    setTimeout(()=>{
      if(window.SV&&SV.active)SV._randomizeConfig()
      document.getElementById('btnNewSeed')?.click()
      _lastRestart=Date.now()
      setTimeout(()=>{_restarting=false},1500)
    },1200)
  }

  // Polling permanent (jamais clearInterval)
  setInterval(_tryRestart,400)

  // Fallback RAF — jamais throttlé sur Android même en arrière-plan
  let _rafLast=0
  function _raf(ts){
    if(ts-_rafLast>800){_rafLast=ts;_tryRestart()}
    requestAnimationFrame(_raf)
  }
  requestAnimationFrame(_raf)
})()
;function createAdvisor(seed){
  CFG.agentsPerTeam=5; CFG.asymmetric=false; CFG.timeLimit=0; CFG.mode='elim'; CFG.mapSize='huge';
  const brain=new Sim('cvA','mmA',{a0:'a0A',a1:'a1A',ms:'msA',seedD:'seedDA',jamL:'jamLA',nightL:'nightLA',scoreEl:'scoreA',kcId:'killChartA',statPfx:'statKillsA'});
  brain.reset(seed||((Math.random()*1e6)|0));
  const ag=brain.agents.filter(a=>a.rn!=='DRONE');
  return {
    MW:brain.MW, MH:brain.MH, roster:ag.map(a=>({team:a.team,rn:a.rn,hp:a.hp})),
    advise(arena,units,mobs){
      const MW=brain.MW,MH=brain.MH;
      for(let y=0;y<MH;y++)for(let x=0;x<MW;x++) brain.map[y][x]=arena[y*MW+x]|0;
      brain._buildCov&&brain._buildCov();
      const n=Math.min(ag.length,units.length);
      for(let k=0;k<n;k++){const a=ag[k],u=units[k]; a.x=u.x; a.y=u.y; a.hp=(u.hp>0?u.hp:-1);}
      const bx=ag.map(a=>a.x), by=ag.map(a=>a.y);
      // GAP-1: perceive creatures as dynamic threats / soft obstacles BEFORE the
      // brain ticks, so positioning/pathing/cover-scoring react to them this frame.
      brain._stampMobs(mobs);
      brain.update();
      const out=[];
      for(let k=0;k<ag.length;k++){const a=ag[k];
        // FLAT movement delta (reverted from toroidal): raw displacement this tick.
        const dx=a.x-bx[k],dy=a.y-by[k],d=Math.hypot(dx,dy);
        let fire=false,aim=a.dir||0;
        for(const b of brain.bullets){if(b&&b._shooterId===a.uid&&(b.age||0)<=1){fire=true;aim=Math.atan2(b.vy||0,b.vx||0);break;}}
        out.push({state:a.state,dx:d>0.001?dx/d:0,dy:d>0.001?dy/d:0,aim,fire,alive:a.hp>0});
      }
      return out;
    }
  };
}
return { createAdvisor, Sim, NN };
})();
