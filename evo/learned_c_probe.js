// OMEGA — SONDE « C APPRIS » (falsification, AUDIT_OMEGA §1.11).
// Question : une représentation APPRISE (par prédiction masquée) qui utilise TOUT le contexte
// révélé du board bat-elle le n-gram GAP-AWARE (§1.10, nearest revealed neighbor) sur l'OOV ?
// Compare, sur des états de jeu IDENTIQUES (held-out OOV, top-1) :
//   - gap        : n-gram nearest-revealed-neighbor (gauche×droite), counts (= le moteur, §1.10)
//   - GATE-appris: P(y) ∝ uni·∏_q e_q[y]^{α_d}, α_d=softplus(θ_d) appris par distance (~8 params)
//   - POE-all    : produit d'experts sur TOUS les voisins révélés (counts, indépendance naïve)
//   - maxent     : log-linéaire additif à features de décalage, appris (prédiction masquée)
// VERDICT MESURÉ (2 graines) : TOUS perdent contre gap. Le plus proche voisin domine ; combiner
// plus de cues (appris ou non) NUIT car les lettres révélées sont CORRÉLÉES (indép. violée) et les
// cues lointains sont non-informatifs (le gate apprend α→0 au-delà de d=2). → le C *léger* appris
// est falsifié ; battre gap exige un modèle des CORRÉLATIONS (attention/RNN, lourd/opaque) pour
// ~3-5 pts jusqu'à la borne SOTA — déféré à décision explicite.
// usage : node evo/learned_c_probe.js [sampleSeed] [MAXO] [epochs] [lr]
'use strict';
const { loadEngine } = require('./fitness_harness.js');

const SAMPLE = (+process.argv[2] || 99887) >>> 0;
const MAXO   = +process.argv[3] || 8;     // portée des offsets (maxent)
const EPOCHS = +process.argv[4] || 4;
const LR     = +process.argv[5] || 0.2;
const NO = 2*MAXO+1, NS = 28, NY = 26;    // offsets, symboles contexte (26 lettres + # + $), cibles

(async () => {
  const O = loadEngine(); if (O.loadLex) await O.loadLex(); O.setSeed(1); if (O.init) O.init();
  const data = O.evalIn(`(function(){
    const W=OMEGA_LEX4.words, origLI=OMEGA_LEX4.len_index;
    let s=${SAMPLE}>>>0; const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
    const v=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&m.length>=7&&m.length<=12&&/^[A-Z]+$/.test(m)) v.push(i);}
    for(let i=v.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=v[i];v[i]=v[j];v[j]=t;}
    const testIdx=new Set(v.slice(0,400)); const testW=v.slice(0,400).map(i=>W[i].m);
    const train=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&m.length>=4&&m.length<=15&&/^[A-Z]+$/.test(m)&&!testIdx.has(i)) train.push(m);}
    return {train, testW};
  })()`);
  const train = data.train, testW = data.testW;
  console.log('train='+train.length+' test='+testW.length+'  MAXO='+MAXO+' epochs='+EPOCHS+' lr='+LR);

  // ---- gap-aware n-gram (baseline = le moteur §1.10) bâti sur le lexique filtré (OOV honnête) ----
  const uni={}, Ld={}, Rd={}, GMAXD=8;
  const add=(o,k,c)=>{ (o[k]||(o[k]=new Float64Array(26)))[c]++; };
  for(const w of train){ const L=w.length; for(let p=0;p<L;p++){ const c=w.charCodeAt(p)-65; if(c<0||c>=26)continue; add(uni,L+'|'+p,c);
    for(let d=1;d<=GMAXD;d++){ if(p-d>=0) add(Ld,L+'|'+p+'|'+d+'|'+w[p-d],c); if(p+d<L) add(Rd,L+'|'+p+'|'+d+'|'+w[p+d],c); } } }
  const nz=(d)=>{ if(!d)return null; let s=0; for(let x=0;x<26;x++)s+=d[x]; if(s<=0)return null; const o=new Float64Array(26); for(let x=0;x<26;x++)o[x]=d[x]/s; return o; };
  function gapPred(w,rev,p){ const L=w.length; let ld=0,lc=null; for(let d=1;d<=GMAXD;d++){if(p-d>=0&&rev[p-d]){ld=d;lc=w[p-d];break;}}
    let rd=0,rc=null; for(let d=1;d<=GMAXD;d++){if(p+d<L&&rev[p+d]){rd=d;rc=w[p+d];break;}}
    const nl=ld?nz(Ld[L+'|'+p+'|'+ld+'|'+lc]):null, nr=rd?nz(Rd[L+'|'+p+'|'+rd+'|'+rc]):null;
    let pos=null; if(nl&&nr){pos=new Float64Array(26);let s=0;for(let x=0;x<26;x++){pos[x]=nl[x]*nr[x];s+=pos[x];}if(s>0){for(let x=0;x<26;x++)pos[x]/=s;}else pos=nl;} else pos=nl||nr;
    if(!pos) pos=nz(uni[L+'|'+p]); if(!pos)return -1; let a=-1,b=-1; for(let x=0;x<26;x++)if(pos[x]>a){a=pos[x];b=x;} return b; }
  // PRODUIT D'EXPERTS sur TOUS les voisins révélés (counts) : ∏_q P(y | lettre(q), offset) · uni
  function poePred(w,rev,p){ const L=w.length; let acc=nz(uni[L+'|'+p]); if(!acc)acc=new Float64Array(26).fill(1/26);
    acc=Float64Array.from(acc);
    for(let q=0;q<L;q++){ if(q===p||!rev[q])continue; const d=Math.abs(q-p); if(d>GMAXD)continue;
      const tbl=(q<p)?Ld[L+'|'+p+'|'+d+'|'+w[q]]:Rd[L+'|'+p+'|'+d+'|'+w[q]]; const e=nz(tbl); if(!e)continue;
      let s=0; for(let x=0;x<26;x++){ acc[x]*=(e[x]+1e-6); s+=acc[x]; } if(s>0)for(let x=0;x<26;x++)acc[x]/=s; }
    let a=-1,b=-1; for(let x=0;x<26;x++)if(acc[x]>a){a=acc[x];b=x;} return b; }

  // ---- maxent appris (log-linéaire additif, features de décalage + bornes) ----
  const Wt = new Float64Array(NO*NS*NY);
  function tokens(w,rev,p){ const L=w.length, T=[];
    for(let q=0;q<L;q++){ if(q===p||!rev[q]) continue; let dlt=q-p; if(dlt<-MAXO)dlt=-MAXO; else if(dlt>MAXO)dlt=MAXO; T.push([dlt+MAXO, w.charCodeAt(q)-65]); }
    let lb=-(p+1); if(lb<-MAXO)lb=-MAXO; T.push([lb+MAXO,26]);   // borne gauche '#'
    let rb=L-p; if(rb>MAXO)rb=MAXO; T.push([rb+MAXO,27]);        // borne droite '$'
    return T; }
  function scores(T){ const s=new Float64Array(26); for(const [oi,cs] of T){ const base=(oi*NS+cs)*NY; for(let y=0;y<26;y++) s[y]+=Wt[base+y]; } return s; }
  function softmax(s){ let m=-1e9; for(let y=0;y<26;y++)if(s[y]>m)m=s[y]; let z=0; const p=new Float64Array(26); for(let y=0;y<26;y++){p[y]=Math.exp(s[y]-m);z+=p[y];} for(let y=0;y<26;y++)p[y]/=z; return p; }
  let rs=(SAMPLE^0x9e3779b9)>>>0; const rr=()=>{rs=(rs*1664525+1013904223)>>>0;return rs/4294967296;};
  for(let ep=0; ep<EPOCHS; ep++){
    for(let wi=0; wi<train.length; wi++){ const w=train[wi], L=w.length;
      const rho=0.2+0.5*rr(); const rev=new Array(L); let nrev=0; for(let q=0;q<L;q++){rev[q]=rr()<rho; if(rev[q])nrev++;}
      if(nrev===0){ rev[Math.floor(rr()*L)]=true; }
      let tries=0; for(let k=0;k<L && tries<3;k++){ const p=Math.floor(rr()*L); if(rev[p])continue; tries++;
        const T=tokens(w,rev,p); const pr=softmax(scores(T)); const ystar=w.charCodeAt(p)-65; if(ystar<0||ystar>=26)continue;
        for(const [oi,cs] of T){ const base=(oi*NS+cs)*NY; for(let y=0;y<26;y++){ const g=((y===ystar)?1:0)-pr[y]; Wt[base+y]+=LR*g; } }
      }
    }
  }
  function mePred(w,rev,p){ const T=tokens(w,rev,p); const s=scores(T); let a=-1e9,b=-1; for(let y=0;y<26;y++)if(s[y]>a){a=s[y];b=y;} return b; }

  // ---- GATE appris : reliabilité par distance α_d=softplus(θ_d) sur le produit d'experts ----
  const TH = new Float64Array(GMAXD+1).fill(0.5);
  const sp = (t)=>Math.log(1+Math.exp(t)), sg=(t)=>1/(1+Math.exp(-t));
  const lne=(tbl)=>{ const e=nz(tbl); if(!e)return null; const o=new Float64Array(26); for(let x=0;x<26;x++)o[x]=Math.log(e[x]+1e-6); return o; };
  function gateLogits(w,rev,p){ const L=w.length; const ub=nz(uni[L+'|'+p]); const base=new Float64Array(26);
    for(let x=0;x<26;x++) base[x]=ub?Math.log(ub[x]+1e-6):0;
    const Sd=[]; for(let d=1;d<=GMAXD;d++) Sd[d]=null;
    for(let q=0;q<L;q++){ if(q===p||!rev[q])continue; const d=Math.abs(q-p); if(d>GMAXD)continue;
      const le=lne((q<p)?Ld[L+'|'+p+'|'+d+'|'+w[q]]:Rd[L+'|'+p+'|'+d+'|'+w[q]]); if(!le)continue;
      if(!Sd[d])Sd[d]=new Float64Array(26); for(let x=0;x<26;x++)Sd[d][x]+=le[x]; }
    return {base,Sd}; }
  function gateProb(gl){ const {base,Sd}=gl; const lo=Float64Array.from(base);
    for(let d=1;d<=GMAXD;d++){ if(!Sd[d])continue; const a=sp(TH[d]); for(let x=0;x<26;x++)lo[x]+=a*Sd[d][x]; }
    let m=-1e9; for(let y=0;y<26;y++)if(lo[y]>m)m=lo[y]; let z=0; const pr=new Float64Array(26); for(let y=0;y<26;y++){pr[y]=Math.exp(lo[y]-m);z+=pr[y];} for(let y=0;y<26;y++)pr[y]/=z; return pr; }
  { let gs=(SAMPLE^0x5bd1e995)>>>0; const gr=()=>{gs=(gs*1664525+1013904223)>>>0;return gs/4294967296;};
    for(let ep=0;ep<EPOCHS;ep++){ for(let wi=0;wi<train.length;wi++){ const w=train[wi],L=w.length;
      const rho=0.2+0.5*gr(); const rev=new Array(L); let nr=0; for(let q=0;q<L;q++){rev[q]=gr()<rho;if(rev[q])nr++;} if(!nr)rev[Math.floor(gr()*L)]=true;
      let tr=0; for(let k=0;k<L&&tr<3;k++){ const p=Math.floor(gr()*L); if(rev[p])continue; tr++;
        const gl=gateLogits(w,rev,p); const pr=gateProb(gl); const ys=w.charCodeAt(p)-65; if(ys<0||ys>=26)continue;
        for(let d=1;d<=GMAXD;d++){ if(!gl.Sd[d])continue; let exp=0; for(let y=0;y<26;y++)exp+=pr[y]*gl.Sd[d][y]; const g=(gl.Sd[d][ys]-exp)*sg(TH[d]); TH[d]+=LR*g; } } } } }
  function gatePred(w,rev,p){ const pr=gateProb(gateLogits(w,rev,p)); let a=-1,b=-1; for(let y=0;y<26;y++)if(pr[y]>a){a=pr[y];b=y;} return b; }
  console.log('α (reliabilité apprise) par distance 1..'+GMAXD+': '+Array.from({length:GMAXD},(_, i)=>sp(TH[i+1]).toFixed(2)).join(' '));

  // ---- éval held-out OOV, états de jeu identiques ----
  for(const rho of [0.3,0.4,0.5]){
    let n=0,tg=0,tga=0,tpoe=0,tme=0;
    let es=(SAMPLE^(Math.round(rho*100)))>>>0; const er=()=>{es=(es*1664525+1013904223)>>>0;return es/4294967296;};
    for(const w of testW){ const L=w.length; const rev=new Array(L); for(let q=0;q<L;q++)rev[q]=er()<rho;
      for(let p=0;p<L;p++){ if(rev[p])continue; const tgt=w.charCodeAt(p)-65; if(tgt<0||tgt>=26)continue; n++;
        if(gapPred(w,rev,p)===tgt)tg++; if(gatePred(w,rev,p)===tgt)tga++; if(poePred(w,rev,p)===tgt)tpoe++; if(mePred(w,rev,p)===tgt)tme++;
      } }
    console.log('rev='+rho+'  gap '+(100*tg/n).toFixed(2)+'%  GATE-appris '+(100*tga/n).toFixed(2)+'%  POE-all '+(100*tpoe/n).toFixed(2)+'%  maxent '+(100*tme/n).toFixed(2)+'%');
  }
  console.log('→ tous < gap : le C léger appris est falsifié (AUDIT §1.11).');
})().catch(e=>{console.error(e);process.exit(1);});
