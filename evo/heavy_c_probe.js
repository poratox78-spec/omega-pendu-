// OMEGA — SONDE « C NEURONAL LOURD » (AUDIT_OMEGA §1.11 → arbitrage explicite de Rem).
// Question (la SEULE qui ouvre le chantier, §6.4 barrière de mérite) : une représentation qui
// MODÉLISE LES CORRÉLATIONS entre lettres révélées (self-attention sur le board, entraînée par
// prédiction masquée sur le lexique) bat-elle le n-gram GAP-AWARE (§1.10, plus proche voisin) sur
// l'OOV, à états de jeu IDENTIQUES (held-out OOV, top-1) ?
//   §1.11 a falsifié les modèles LÉGERS (maxent/GATE/POE = indépendance → sur-comptent les cues
//   corrélés). L'attention pèse les révélés CONJOINTEMENT (softmax + mixage de valeurs) = le seul
//   mécanisme qui peut, en principe, dépasser le plus-proche-voisin. On mesure AVANT de bâtir dans
//   le moteur (doctrine §1) : si Δ ≤ 0 robuste → C lourd falsifié, on s'arrête ; si Δ > 0 → on câble.
//
// Réutilise (§5 A1) : le split held-out OOV + la baseline gap-aware de learned_c_probe.js (le moteur
// §1.10), à la décimale, pour une comparaison appariée honnête.
//
// usage : node evo/heavy_c_probe.js [sampleSeed] [trainN] [epochs] [d] [lr]
'use strict';
const { loadEngine } = require('./fitness_harness.js');

const SAMPLE  = (+process.argv[2] || 99887) >>> 0;
const TRAIN_N = +process.argv[3] || 30000;   // sous-échantillon du lexique pour l'entraînement (vitesse)
const EPOCHS  = +process.argv[4] || 6;
const D       = +process.argv[5] || 48;      // dim du modèle
const LR      = +process.argv[6] || 0.01;    // pas Adam
const R       = 7;                            // portée des positions relatives (clamp)
const NREL    = 2 * R + 1;
const LMAX    = 15;                           // borne pour les features de position absolue (p, L-1-p)
const MASK    = 26;                           // token "position cachée / requête"
const VTOK    = 27;                           // 26 lettres + MASK(=null/contexte)
const NQ      = 3;                            // requêtes masquées par mot et par epoch

function rng(seed){ let s = seed>>>0; return ()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }

(async () => {
  const O = loadEngine(); if (O.loadLex) await O.loadLex(); O.setSeed(1); if (O.init) O.init();

  // ---- MÊME split held-out OOV que learned_c_probe.js (test identique → comparaison appariée) ----
  const data = O.evalIn(`(function(){
    const W=OMEGA_LEX4.words;
    let s=${SAMPLE}>>>0; const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
    const v=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&m.length>=7&&m.length<=12&&/^[A-Z]+$/.test(m)) v.push(i);}
    for(let i=v.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=v[i];v[i]=v[j];v[j]=t;}
    const testIdx=new Set(v.slice(0,400)); const testW=v.slice(0,400).map(i=>W[i].m);
    const train=[]; for(let i=0;i<W.length;i++){const m=W[i]&&W[i].m; if(m&&m.length>=4&&m.length<=15&&/^[A-Z]+$/.test(m)&&!testIdx.has(i)) train.push(m);}
    return {train, testW};
  })()`);
  let train = data.train; const testW = data.testW;
  // sous-échantillon déterministe du train (vitesse de sonde)
  { const rr = rng(SAMPLE ^ 0x1234); for(let i=train.length-1;i>0;i--){const j=Math.floor(rr()*(i+1));const t=train[i];train[i]=train[j];train[j]=t;} if(train.length>TRAIN_N) train = train.slice(0,TRAIN_N); }
  console.log('train='+train.length+' test='+testW.length+'  d='+D+' epochs='+EPOCHS+' lr='+LR+' seed='+SAMPLE);

  // ================== BASELINE gap-aware (copie fidèle de learned_c_probe.js / §1.10) ==================
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

  // ================== C LOURD : transformer NLAYERS blocs (cross-attn query→contexte) ==================
  // Données inutiles (20k≈83k, Δ≈−6) → capacité-bound, pas data-bound. Levier restant = PROFONDEUR :
  // empiler des blocs (query raffiné en cascade sur le contexte révélé fixe). Chaque bloc = MHA + FFN
  // résiduels (poids propres). Init seedée (§1). Gradient grad-checké (différences finies).
  const H    = +process.env.HEADS || 4;        // têtes d'attention
  const DH   = D / H; if (!Number.isInteger(DH)) throw new Error('D doit être divisible par HEADS');
  const DFF  = +process.env.DFF || 2*D;        // dim cachée FFN
  const NL   = +process.env.LAYERS || 2;       // profondeur (nombre de blocs)
  const ri = rng(SAMPLE ^ 0xABCDEF);
  const randn = () => { let u=0,v=0; while(u===0)u=ri(); while(v===0)v=ri(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
  const mat = (n, sd) => { const a=new Float64Array(n); for(let i=0;i<n;i++)a[i]=randn()*sd; return a; };
  const E    = mat(VTOK*D, 0.1);     // embeddings de token (lettre / MASK-null)
  const Prel = mat(NREL*D, 0.1);     // position relative clé→requête
  const Qp   = mat(LMAX*D, 0.1);     // feature requête : distance au bord gauche (p)
  const Qr   = mat(LMAX*D, 0.1);     // feature requête : distance au bord droit (L-1-p)
  // poids par bloc l : {Wq,Wk,Wv,Wo,W1,b1,W2,b2}
  const Lyr=[]; const params=[E,Prel,Qp,Qr];
  for(let l=0;l<NL;l++){ const o={ Wq:mat(D*D,1/Math.sqrt(D)),Wk:mat(D*D,1/Math.sqrt(D)),Wv:mat(D*D,1/Math.sqrt(D)),
      Wo:mat(D*D,1/Math.sqrt(D)),W1:mat(DFF*D,1/Math.sqrt(D)),b1:new Float64Array(DFF),W2:mat(D*DFF,1/Math.sqrt(DFF)),b2:new Float64Array(D) };
    Lyr.push(o); params.push(o.Wq,o.Wk,o.Wv,o.Wo,o.W1,o.b1,o.W2,o.b2); }
  const Wc=mat(26*D,1/Math.sqrt(D)), bc=new Float64Array(26);  // classifieur final
  params.push(Wc,bc);
  // gradients miroir (mêmes objets layer → tableaux de grad)
  function newGrads(){ const gLyr=[]; const g=[new Float64Array(E.length),new Float64Array(Prel.length),new Float64Array(Qp.length),new Float64Array(Qr.length)];
    for(let l=0;l<NL;l++){ const o={Wq:new Float64Array(D*D),Wk:new Float64Array(D*D),Wv:new Float64Array(D*D),Wo:new Float64Array(D*D),
      W1:new Float64Array(DFF*D),b1:new Float64Array(DFF),W2:new Float64Array(D*DFF),b2:new Float64Array(D)};
      gLyr.push(o); g.push(o.Wq,o.Wk,o.Wv,o.Wo,o.W1,o.b1,o.W2,o.b2); }
    g.push(new Float64Array(26*D),new Float64Array(26)); return {g,gLyr,gWc:g[g.length-2],gbc:g[g.length-1]}; }
  // Adam
  const mAd=params.map(p=>new Float64Array(p.length)), vAd=params.map(p=>new Float64Array(p.length));
  let adamT=0; const B1=0.9,B2=0.999,EPS=1e-8;
  function adamStep(grads){ adamT++; const c1=1-Math.pow(B1,adamT), c2=1-Math.pow(B2,adamT);
    for(let k=0;k<params.length;k++){ const p=params[k],gg=grads[k],m=mAd[k],v=vAd[k];
      for(let i=0;i<p.length;i++){ const gi=gg[i]; m[i]=B1*m[i]+(1-B1)*gi; v[i]=B2*v[i]+(1-B2)*gi*gi;
        p[i]-=LR*(m[i]/c1)/(Math.sqrt(v[i]/c2)+EPS); } } }
  const zerosLike=()=>params.map(p=>new Float64Array(p.length));

  const clampRel=(dlt)=>{ let r=dlt; if(r<-R)r=-R; else if(r>R)r=R; return r+R; };
  const clampL=(i)=>i<0?0:(i>=LMAX?LMAX-1:i);
  function matvec(M,x,dout,din){ const y=new Float64Array(dout); for(let o=0;o<dout;o++){ let s=0; const b=o*din; for(let i=0;i<din;i++)s+=M[b+i]*x[i]; y[o]=s; } return y; }
  const invSqDH=1/Math.sqrt(DH);

  // un BLOC : entrée query qin(D) + tokens (x partagés) → sortie z2(D). Renvoie cache pour backward.
  function blockFwd(qin, toks, P){
    const n=toks.length;
    const qf=matvec(P.Wq,qin,D,D);
    const K=[],V=[]; for(let t=0;t<n;t++){ K.push(matvec(P.Wk,toks[t].x,D,D)); V.push(matvec(P.Wv,toks[t].x,D,D)); }
    const ctx=new Float64Array(D); const attnAll=[];
    for(let h=0;h<H;h++){ const off=h*DH; const sc=new Float64Array(n); let mxs=-1e9;
      for(let t=0;t<n;t++){ let s=0; const tk=K[t]; for(let i=0;i<DH;i++)s+=qf[off+i]*tk[off+i]; s*=invSqDH; sc[t]=s; if(s>mxs)mxs=s; }
      let z=0; for(let t=0;t<n;t++){ sc[t]=Math.exp(sc[t]-mxs); z+=sc[t]; } for(let t=0;t<n;t++)sc[t]/=z;
      for(let t=0;t<n;t++){ const a=sc[t], tv=V[t]; for(let i=0;i<DH;i++)ctx[off+i]+=a*tv[off+i]; }
      attnAll.push(sc); }
    const a_att=matvec(P.Wo,ctx,D,D);
    const r1=new Float64Array(D); for(let i=0;i<D;i++)r1[i]=qin[i]+a_att[i];
    const hpre=matvec(P.W1,r1,DFF,D); for(let j=0;j<DFF;j++)hpre[j]+=P.b1[j];
    const hrel=new Float64Array(DFF); for(let j=0;j<DFF;j++)hrel[j]=hpre[j]>0?hpre[j]:0;
    const f=matvec(P.W2,hrel,D,DFF); for(let i=0;i<D;i++)f[i]+=P.b2[i];
    const z2=new Float64Array(D); for(let i=0;i<D;i++)z2[i]=r1[i]+f[i];
    return {z2, cache:{qin,qf,K,V,ctx,attnAll,r1,hpre,hrel,n}};
  }
  // backward d'un bloc : dz2 → {dqin, dx[t] accumulé}, + grads poids dans GP
  function blockBwd(dz2, cache, P, GP, dxAcc){
    const {qin,qf,K,V,ctx,attnAll,r1,hpre,hrel,n}=cache;
    const dr1=new Float64Array(D); for(let i=0;i<D;i++)dr1[i]=dz2[i]; const df=dz2;
    const dhrel=new Float64Array(DFF);
    for(let o=0;o<D;o++){ const b=o*DFF; const dfo=df[o]; GP.b2[o]+=dfo; for(let j=0;j<DFF;j++){ GP.W2[b+j]+=dfo*hrel[j]; dhrel[j]+=P.W2[b+j]*dfo; } }
    const dhpre=new Float64Array(DFF); for(let j=0;j<DFF;j++)dhpre[j]=hpre[j]>0?dhrel[j]:0;
    for(let o=0;o<DFF;o++){ const b=o*D; const dh=dhpre[o]; GP.b1[o]+=dh; for(let i=0;i<D;i++){ GP.W1[b+i]+=dh*r1[i]; dr1[i]+=P.W1[b+i]*dh; } }
    const dqin=new Float64Array(D); for(let i=0;i<D;i++)dqin[i]=dr1[i];   // résiduel 1
    const dctx=new Float64Array(D);
    for(let o=0;o<D;o++){ const b=o*D; const da=dr1[o]; for(let i=0;i<D;i++){ GP.Wo[b+i]+=da*ctx[i]; dctx[i]+=P.Wo[b+i]*da; } }
    const dqf=new Float64Array(D);
    const dK=Array.from({length:n},()=>new Float64Array(D)), dV=Array.from({length:n},()=>new Float64Array(D));
    for(let h=0;h<H;h++){ const off=h*DH; const attn=attnAll[h]; const dattn=new Float64Array(n);
      for(let t=0;t<n;t++){ let da=0; const tv=V[t]; for(let i=0;i<DH;i++)da+=dctx[off+i]*tv[off+i]; dattn[t]=da;
        const a=attn[t]; for(let i=0;i<DH;i++)dV[t][off+i]+=a*dctx[off+i]; }
      let sdot=0; for(let t=0;t<n;t++)sdot+=attn[t]*dattn[t];
      for(let t=0;t<n;t++){ const ds=attn[t]*(dattn[t]-sdot); const tk=K[t];
        for(let i=0;i<DH;i++){ dqf[off+i]+=ds*invSqDH*tk[off+i]; dK[t][off+i]+=ds*invSqDH*qf[off+i]; } } }
    for(let t=0;t<n;t++){ const xt=toks_ref[t].x; const dxt=dxAcc[t];
      for(let o=0;o<D;o++){ const b=o*D; const dko=dK[t][o], dvo=dV[t][o];
        for(let i=0;i<D;i++){ GP.Wk[b+i]+=xt[i]*dko; GP.Wv[b+i]+=xt[i]*dvo; dxt[i]+=P.Wk[b+i]*dko+P.Wv[b+i]*dvo; } } }
    for(let o=0;o<D;o++){ const b=o*D; const dq=dqf[o]; for(let i=0;i<D;i++){ GP.Wq[b+i]+=qin[i]*dq; dqin[i]+=P.Wq[b+i]*dq; } }
    return dqin;
  }
  let toks_ref=null;  // tokens du forward courant (partagés entre blocs pour dx)

  function forward(w, rev, p){
    const L=w.length;
    const u=new Float64Array(D); const eM=MASK*D, qpB=clampL(p)*D, qrB=clampL(L-1-p)*D;
    for(let i=0;i<D;i++) u[i]=E[eM+i]+Qp[qpB+i]+Qr[qrB+i];
    const toks=[];
    const pushTok=(tok,relIdx)=>{ const x=new Float64Array(D); const eB=tok*D, rB=relIdx*D;
      for(let i=0;i<D;i++)x[i]=E[eB+i]+Prel[rB+i]; toks.push({tok,relB:rB,eB,x}); };
    pushTok(MASK, R);
    for(let q=0;q<L;q++){ if(q===p||!rev[q])continue; pushTok(w.charCodeAt(q)-65, clampRel(q-p)); }
    let q=u; const caches=[];
    for(let l=0;l<NL;l++){ const r=blockFwd(q, toks, Lyr[l]); caches.push(r.cache); q=r.z2; }
    const z=q;
    const logits=new Float64Array(26); for(let y=0;y<26;y++){ let s=bc[y]; const b=y*D; for(let i=0;i<D;i++)s+=Wc[b+i]*z[i]; logits[y]=s; }
    let lm=-1e9; for(let y=0;y<26;y++)if(logits[y]>lm)lm=logits[y]; let zp=0; const prob=new Float64Array(26);
    for(let y=0;y<26;y++){ prob[y]=Math.exp(logits[y]-lm); zp+=prob[y]; } for(let y=0;y<26;y++)prob[y]/=zp;
    return {prob, z, u, toks, caches, p, L};
  }

  function backward(fwd, y, Gobj){
    const {g,gLyr,gWc,gbc}=Gobj;
    const [gE,gPrel,gQp,gQr]=g;
    const {prob,z,u,toks,caches,p,L}=fwd;
    const loss=-Math.log(Math.max(prob[y],1e-12));
    const dlog=new Float64Array(26); for(let k2=0;k2<26;k2++)dlog[k2]=prob[k2]-(k2===y?1:0);
    const dz=new Float64Array(D);
    for(let k2=0;k2<26;k2++){ const dl=dlog[k2]; gbc[k2]+=dl; const b=k2*D; for(let i=0;i<D;i++){ gWc[b+i]+=dl*z[i]; dz[i]+=dl*Wc[b+i]; } }
    const n=toks.length; const dxAcc=Array.from({length:n},()=>new Float64Array(D));
    toks_ref=toks;
    let dcur=dz;
    for(let l=NL-1;l>=0;l--){ dcur=blockBwd(dcur, caches[l], Lyr[l], gLyr[l], dxAcc); }
    // dcur = du (grad de l'entrée query u) ; dxAcc[t] = grad des embeddings token
    const eM=MASK*D, qpB=clampL(p)*D, qrB=clampL(L-1-p)*D;
    for(let i=0;i<D;i++){ gE[eM+i]+=dcur[i]; gQp[qpB+i]+=dcur[i]; gQr[qrB+i]+=dcur[i]; }
    for(let t=0;t<n;t++){ const tt=toks[t], dxt=dxAcc[t]; for(let i=0;i<D;i++){ gE[tt.eB+i]+=dxt[i]; gPrel[tt.relB+i]+=dxt[i]; } }
    return loss;
  }

  // ---- CONTRÔLE DE GRADIENT (différences finies) — GCHECK=1 ----
  if (process.env.GCHECK) {
    const w='ORDINATEUR'.slice(0,9), L=w.length; const rev=new Array(L); for(let q=0;q<L;q++)rev[q]=(q%2===0); rev[3]=false;
    const p=3, y=w.charCodeAt(p)-65;
    const Go=newGrads(); backward(forward(w,rev,p),y,Go); const Gf=Go.g;
    const names=['E','Prel','Qp','Qr']; for(let l=0;l<NL;l++) names.push('L'+l+'.Wq','L'+l+'.Wk','L'+l+'.Wv','L'+l+'.Wo','L'+l+'.W1','L'+l+'.b1','L'+l+'.W2','L'+l+'.b2'); names.push('Wc','bc');
    const eps=1e-5;
    for(let k=0;k<params.length;k++){ const P=params[k]; let maxrel=0;
      for(let t=0;t<Math.min(6,P.length);t++){ const idx=Math.floor((t*9973)%P.length); const o=P[idx];
        P[idx]=o+eps; const lp=-Math.log(Math.max(forward(w,rev,p).prob[y],1e-12));
        P[idx]=o-eps; const lm=-Math.log(Math.max(forward(w,rev,p).prob[y],1e-12)); P[idx]=o;
        const num=(lp-lm)/(2*eps), ana=Gf[k][idx]; const rel=Math.abs(num-ana)/(Math.abs(num)+Math.abs(ana)+1e-9);
        if(rel>maxrel)maxrel=rel; }
      console.log('  grad-check '+names[k].padEnd(7)+' max rel err = '+maxrel.toExponential(2)); }
    process.exit(0);
  }

  // ---- entraînement par prédiction masquée — MINI-BATCH (gradient moyenné + clip global) ----
  // Le pas-par-mot (batch≈3) est trop bruité : lr bas stagne, lr haut diverge. On moyenne le
  // gradient sur BATCH mots avant chaque pas Adam, + clip de norme → stable à lr raisonnable.
  const BATCH = +process.env.BATCH || 64;
  const CLIP  = +process.env.CLIP  || 5.0;
  function clipAndStep(Gf, qn){
    if(qn<=0) return; const inv=1/qn;
    let nrm=0; for(const g of Gf){ for(let i=0;i<g.length;i++){ g[i]*=inv; nrm+=g[i]*g[i]; } }
    nrm=Math.sqrt(nrm); if(nrm>CLIP){ const s=CLIP/nrm; for(const g of Gf) for(let i=0;i<g.length;i++)g[i]*=s; }
    adamStep(Gf);
  }
  const rt = rng(SAMPLE ^ 0xF00D);
  const order = train.map((_,i)=>i);
  for(let ep=0; ep<EPOCHS; ep++){
    for(let i=order.length-1;i>0;i--){const j=Math.floor(rt()*(i+1));const t=order[i];order[i]=order[j];order[j]=t;}
    let lsum=0, lcnt=0; let Go=newGrads(), qn=0, bw=0;
    for(let oi=0; oi<order.length; oi++){
      const w=train[order[oi]], L=w.length;
      const rho=0.2+0.6*rt(); const rev=new Array(L); let nrev=0; for(let q=0;q<L;q++){rev[q]=rt()<rho; if(rev[q])nrev++;}
      if(nrev===L){ rev[Math.floor(rt()*L)]=false; }
      let used=0;
      for(let k=0;k<L && used<NQ;k++){ const p=Math.floor(rt()*L); if(rev[p])continue; const y=w.charCodeAt(p)-65; if(y<0||y>=26)continue;
        const fwd=forward(w,rev,p); lsum+=backward(fwd,y,Go); lcnt++; used++; qn++; }
      bw++;
      if(bw>=BATCH){ clipAndStep(Go.g,qn); Go=newGrads(); qn=0; bw=0; }
    }
    if(qn>0) clipAndStep(Go.g,qn);
    process.stdout.write('  epoch '+(ep+1)+'/'+EPOCHS+'  loss '+(lsum/Math.max(lcnt,1)).toFixed(3)+'\n');
  }
  function heavyPred(w,rev,p){ const f=forward(w,rev,p); let a=-1,b=-1; for(let y=0;y<26;y++)if(f.prob[y]>a){a=f.prob[y];b=y;} return b; }

  // ================== ÉVAL held-out OOV, états de jeu identiques (top-1) ==================
  console.log('\nrev   gap-aware   C-lourd(attn)   Δ');
  for(const rho of [0.3,0.4,0.5]){
    let n=0,tg=0,th=0;
    let es=(SAMPLE^(Math.round(rho*100)))>>>0; const er=()=>{es=(es*1664525+1013904223)>>>0;return es/4294967296;};
    for(const w of testW){ const L=w.length; const rev=new Array(L); for(let q=0;q<L;q++)rev[q]=er()<rho;
      for(let p=0;p<L;p++){ if(rev[p])continue; const tgt=w.charCodeAt(p)-65; if(tgt<0||tgt>=26)continue; n++;
        if(gapPred(w,rev,p)===tgt)tg++; if(heavyPred(w,rev,p)===tgt)th++; } }
    const g=100*tg/n, h=100*th/n;
    console.log('  '+rho+'    '+g.toFixed(2)+'%      '+h.toFixed(2)+'%        '+(h-g>=0?'+':'')+(h-g).toFixed(2));
  }
  console.log('\n→ barrière de mérite (§6.4) : le C lourd ne se câble dans le moteur que si Δ > 0 ROBUSTE.');
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
