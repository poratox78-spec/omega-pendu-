// OMEGA — PARITÉ du C lourd : _neoHeavyCDist() du MOTEUR vs forward de RÉFÉRENCE (copie de heavy_c_probe.js).
// Garantit que le port moteur calcule EXACTEMENT le même réseau que celui entraîné (sinon le winrate est invalide).
// Protocole : états à UNE SEULE position cachée (rev = tout révélé sauf p) → _neoHeavyCDist agrège 1 position = sa
// distribution → comparable au forward(w,rev,p).prob de référence, élément par élément.
// Usage : node evo/heavy_c_parity.js <poids.json>
'use strict';
const fs=require('fs');
const { loadEngine } = require('./fitness_harness.js');

(async () => {
  const WPATH=process.argv[2]; const M=JSON.parse(fs.readFileSync(WPATH,'utf8'));
  const c=M.cfg, D=c.D,H=c.H,NL=c.NL,DFF=c.DFF,R=c.R,LMAX=c.LMAX,MASK=c.MASK, DH=D/H, invSqDH=1/Math.sqrt(DH);
  const clampRel=(d)=>{ let r=d; if(r<-R)r=-R; else if(r>R)r=R; return r+R; };
  const clampL=(i)=>i<0?0:(i>=LMAX?LMAX-1:i);
  const mv=(Mat,x,dout,din)=>{ const y=new Float64Array(dout); for(let o=0;o<dout;o++){ let s=0; const b=o*din; for(let i=0;i<din;i++)s+=Mat[b+i]*x[i]; y[o]=s; } return y; };
  // forward de RÉFÉRENCE (copie fidèle de heavy_c_probe.js, lisant M)
  function refProb(w, rev, p){
    const L=w.length; const u=new Float64Array(D), eM=MASK*D, qpB=clampL(p)*D, qrB=clampL(L-1-p)*D;
    for(let i=0;i<D;i++) u[i]=M.E[eM+i]+M.Qp[qpB+i]+M.Qr[qrB+i];
    const xs=[]; const push=(tok,relIdx)=>{ const x=new Float64Array(D),eB=tok*D,rB=relIdx*D; for(let i=0;i<D;i++)x[i]=M.E[eB+i]+M.Prel[rB+i]; xs.push(x); };
    push(MASK,R); for(let q=0;q<L;q++){ if(q===p||!rev[q])continue; push(w.charCodeAt(q)-65, clampRel(q-p)); }
    const n=xs.length; let qv=u;
    for(let l=0;l<NL;l++){ const P=M.Lyr[l]; const qf=mv(P.Wq,qv,D,D); const K=[],V=[];
      for(let t=0;t<n;t++){ K.push(mv(P.Wk,xs[t],D,D)); V.push(mv(P.Wv,xs[t],D,D)); }
      const ctx=new Float64Array(D);
      for(let h=0;h<H;h++){ const off=h*DH; const sc=new Float64Array(n); let mx=-1e9;
        for(let t=0;t<n;t++){ let s=0; const tk=K[t]; for(let i=0;i<DH;i++)s+=qf[off+i]*tk[off+i]; s*=invSqDH; sc[t]=s; if(s>mx)mx=s; }
        let z=0; for(let t=0;t<n;t++){ sc[t]=Math.exp(sc[t]-mx); z+=sc[t]; } for(let t=0;t<n;t++)sc[t]/=z;
        for(let t=0;t<n;t++){ const a=sc[t],tv=V[t]; for(let i=0;i<DH;i++)ctx[off+i]+=a*tv[off+i]; } }
      const aatt=mv(P.Wo,ctx,D,D); const r1=new Float64Array(D); for(let i=0;i<D;i++)r1[i]=qv[i]+aatt[i];
      const hpre=mv(P.W1,r1,DFF,D); for(let j=0;j<DFF;j++)hpre[j]+=P.b1[j];
      const hrel=new Float64Array(DFF); for(let j=0;j<DFF;j++)hrel[j]=hpre[j]>0?hpre[j]:0;
      const f=mv(P.W2,hrel,D,DFF); for(let i=0;i<D;i++)f[i]+=P.b2[i];
      const z2=new Float64Array(D); for(let i=0;i<D;i++)z2[i]=r1[i]+f[i]; qv=z2; }
    const lo=new Float64Array(26); for(let y=0;y<26;y++){ let s=M.bc[y]; const b=y*D; for(let i=0;i<D;i++)s+=M.Wc[b+i]*qv[i]; lo[y]=s; }
    let lm=-1e9; for(let y=0;y<26;y++)if(lo[y]>lm)lm=lo[y]; let zp=0; const pr=new Float64Array(26);
    for(let y=0;y<26;y++){ pr[y]=Math.exp(lo[y]-lm); zp+=pr[y]; } for(let y=0;y<26;y++)pr[y]/=zp; return pr;
  }

  const O=loadEngine(); await O.loadLex(); const ev=O.evalIn;
  ev('_neoHeavyC = '+fs.readFileSync(WPATH,'utf8')+';');
  const words=['ORDINATEUR','BONJOURS','MAISON','TRAVAILLE','CHANTENT','POISSON'];
  let maxdiff=0, top1match=0, ntests=0;
  for(const w of words){ const L=w.length;
    for(let p=0;p<L;p++){
      const rev=new Array(L).fill(true); rev[p]=false;
      // moteur : currentWord=w, revealedMask=rev, alreadyTried tout false → _neoHeavyCDist agrège la seule position p
      const engScore = ev(`(function(){ currentWord=${JSON.stringify(w)}; revealedMask=[${rev.map(b=>b?1:0).join(',')}].map(Boolean); alreadyTried=new Array(26).fill(false); var s=_neoHeavyCDist(); return s?Array.from(s):null; })()`);
      const ref = refProb(w, rev, p);
      if(!engScore){ console.log('  ENGINE null pour',w,p); continue; }
      let d=0, ar=-1,am=-1,br=-1,bm=-1; for(let x=0;x<26;x++){ d=Math.max(d,Math.abs(engScore[x]-ref[x])); if(ref[x]>am){am=ref[x];ar=x;} if(engScore[x]>bm){bm=engScore[x];br=x;} }
      if(ar===br) top1match++; ntests++; maxdiff=Math.max(maxdiff,d);
    }
  }
  console.log('parité moteur↔référence : '+ntests+' états · top-1 identique '+top1match+'/'+ntests+' · max |Δprob| = '+maxdiff.toExponential(2));
  console.log(maxdiff<1e-9 ? '✅ PARITÉ EXACTE — le port moteur calcule le même réseau.' : (maxdiff<1e-4?'~ proche (précision)':'❌ DIVERGENCE — port moteur faux, winrate invalide.'));
})().catch(e=>{ console.error('ERR', e&&e.stack||e); process.exit(1); });
