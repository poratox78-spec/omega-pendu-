// Juge léger : lexique du produit, candidats d'un mot, traits (écrit, candidat). Partagé par la fabrique d'entraînement et les bancs.
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
module.exports = function (R) {
  const D = require(path.join(R, 'extension', 'charger_node.js'))({ ext: path.join(R, 'extension') });
  const son = D.sonKey, ph = (s) => D.phonKey(s).replace(/É$/, ''), dec = D.deacc;
  const low = (s) => String(s || '').toLowerCase().replace(/[’ʼ]/g, "'");
  const F = new Map();
  for (const l of zlib.gunzipSync(fs.readFileSync(path.join(R, 'extension', 'assets', 'speller.tsv.gz'))).toString('utf8').split('\n')) { const p = l.split('\t'); if (p.length >= 2) { const f = +p[1]; if (f >= 1) F.set(p[0], f); } }
  const parPh = new Map(), parDebut = new Map(), parLen = new Map(), add = (m, k, w) => { const a = m.get(k); if (a) a.push(w); else m.set(k, [w]); };
  for (const w of F.keys()) { const d = dec(w); add(parPh, ph(w), w); add(parDebut, d.slice(0, Math.min(4, d.length)), w); add(parLen, d.length + ':' + d[0], w); }
  function lev(a, b, max) { const n = a.length, m = b.length; if (Math.abs(n - m) > max) return max + 1; let p = Array(m + 1).fill(0).map((_, j) => j); for (let i = 1; i <= n; i++) { const c = [i]; let best = i; for (let j = 1; j <= m; j++) { c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (c[j] < best) best = c[j]; } if (best > max) return max + 1; p = c; } return p[m]; }
  const GR = [["a", "à"], ["et", "est", "es"], ["ou", "où"], ["son", "sont"], ["ces", "ses", "c'est", "s'est"], ["ce", "se"], ["la", "là", "l'a"], ["ma", "m'a"], ["ta", "t'a"], ["sa", "ça"], ["on", "ont"], ["mes", "mais", "met"], ["du", "dû"], ["leur", "leurs"], ["ni", "n'y"], ["si", "s'y"], ["soi", "soit"], ["dont", "donc"], ["tout", "tous"], ["peu", "peut", "peux"], ["par", "part"], ["sur", "sûr"], ["quand", "quant"], ["qu'elle", "quelle", "quel"], ["sans", "sens", "cent"], ["dans", "en"], ["en", "an"]];
  const GRP = new Map(); for (const g of GR) for (const x of g) GRP.set(x, (GRP.get(x) || []).concat(g));
  const connu = (w) => F.has(w) || F.has(w.split("'").pop());
  // Les fins qu'on confond à racine égale. La clé de son du moteur les sépare (parler/parlé) ou les rate (parle/parlent) : liste fermée, le dictionnaire dit si le mot existe.
  const FINS = [['er', 'é', 'ée', 'és', 'ées', 'ez', 'ai', 'ais', 'ait', 'aient'], ['', 's', 'e', 'es', 'x'], ['e', 'es', 'ent'], ['i', 'is', 'it', 'ie', 'ies', 'ir'], ['u', 'us', 'ut', 'ue', 'ues'], ['t', 'ent']];
  function fins(nu) { const out = []; for (const C of FINS) { let s = null; for (const x of C) if (x && nu.length > x.length + 1 && nu.endsWith(x) && (s === null || x.length > s.length)) s = x; if (s === null) { if (!C.includes('')) continue; s = ''; } const r = nu.slice(0, nu.length - s.length); for (const t of C) if (t !== s && F.has(r + t) && !out.includes(r + t)) out.push(r + t); } return out; }
  const memoF = new Map(), finsM = (a) => { let v = memoF.get(a); if (!v) { v = new Set(fins(a)); memoF.set(a, v); } return v; };
  // Ligne 383 (« lettres dansantes ») : clé = 1re lettre + lettres du milieu triées + dernière, sans accents. L'anagramme d'un mot inconnu = le mot le plus
  // fréquent du lexique qui a la même clé (et pas le même mot sans ses accents). Un candidat de plus, et un trait : « mêmes lettres ».
  const cleDanse = (d) => (d.length >= 4 && /^[a-zœæ]+$/.test(d) ? d[0] + d.slice(1, -1).split('').sort().join('') + d[d.length - 1] : null);
  const IDXA = new Map(), mieux = (f, x, g, y) => f > g || (f === g && x < y);   // à fréquence égale, l'ordre alphabétique (comme _jgAnaStep du produit)
  for (const [w, f] of F) { const d = dec(w), k = cleDanse(d); if (!k) continue; const e = IDXA.get(k); if (!e) { IDXA.set(k, [[w, f, d], null]); continue; }
    if (mieux(f, w, e[0][1], e[0][0])) { if (e[0][2] !== d) e[1] = e[0]; e[0] = [w, f, d]; } else if (e[0][2] !== d && (!e[1] || mieux(f, w, e[1][1], e[1][0]))) e[1] = [w, f, d]; }
  function anag(nu) { const d = dec(low(nu)), k = cleDanse(d), e = k && IDXA.get(k); if (!e) return null; if (e[0][2] !== d) return e[0][0]; return e[1] ? e[1][0] : null; }
  const danse = (a, b) => { const x = dec(a), y = dec(b), k = cleDanse(x); return k && x !== y && k === cleDanse(y) ? 1 : 0; };
  // Ligne 399 : 8e trait « lettres probables » = les chances de faute par lettre (WiCoPaCo, dictee/juge_lettres.json). Chemin d'édition le moins coûteux
  // de l'écrit au candidat, sans accents (coût d'une édition = 4,5 − sa valeur) ; trait = MOYENNE des valeurs de ses éditions (0 sans édition).
  // Pour un mot écrit INCONNU seulement (0 sinon) : WiCoPaCo ne compte que des non-mots, et sur tous les mots le trait déplaçait les marques du juge.
  // _jgLetT et _jgLet sont copiés tels quels de dys-core.js : mêmes calculs dans le même ordre, donc le même nombre à l'entraînement et au produit.
  function _jgLetT(V){var A='abcdefghijklmnopqrstuvwxyz',T={s:new Float64Array(676),t:new Float64Array(676)},x,v;
    for(x=0;x<676;x++){v=V['s:'+A[(x/26)|0]+'>'+A[x%26]];T.s[x]=v===undefined?-4:v;v=V['t:'+A[(x/26)|0]+A[x%26]];T.t[x]=v===undefined?-4:v;}
    ['d:','dd:','i:','ii:'].forEach(function(p){['','$'].forEach(function(f){var a=new Float64Array(26);for(var k=0;k<26;k++){var w=V[p+A[k]+f];a[k]=w===undefined?-4:w;}T[p+f]=a;});});
    return T;}
  function _jgLet(a,b,T){if(a===b)return 0;var n=a.length,m=b.length,W=m+1,C=new Float64Array((n+1)*W),S=new Float64Array((n+1)*W),N=new Float64Array((n+1)*W),ca=[],cb=[],i,j,k;
    for(i=0;i<n;i++){k=a.charCodeAt(i)-97;ca.push(k>=0&&k<26?k:-1);}for(j=0;j<m;j++){k=b.charCodeAt(j)-97;cb.push(k>=0&&k<26?k:-1);}
    for(i=0;i<=n;i++)for(j=0;j<=m;j++){if(!i&&!j)continue;var o=i*W+j,bc=Infinity,bs=0,bn=0,q,v,c,x,y;
      if(i&&j){q=o-W-1;if(a[i-1]===b[j-1]){bc=C[q];bs=S[q];bn=N[q];}else{x=ca[i-1];y=cb[j-1];v=x<0||y<0?-4:T.s[x*26+y];c=C[q]+4.5-v;if(c<bc){bc=c;bs=S[q]+v;bn=N[q]+1;}}}
      if(j){q=o-1;y=cb[j-1];v=y<0?-4:T[((j>1&&b[j-2]===b[j-1])||(j<m&&b[j]===b[j-1])?'dd:':'d:')+(j===m?'$':'')][y];c=C[q]+4.5-v;if(c<bc){bc=c;bs=S[q]+v;bn=N[q]+1;}}
      if(i){q=o-W;x=ca[i-1];v=x<0?-4:T[((i>1&&a[i-2]===a[i-1])||(i<n&&a[i]===a[i-1])?'ii:':'i:')+(i===n?'$':'')][x];c=C[q]+4.5-v;if(c<bc){bc=c;bs=S[q]+v;bn=N[q]+1;}}
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]&&a[i-1]!==a[i-2]){q=o-2*W-2;x=cb[j-2];y=cb[j-1];v=x<0||y<0?-4:T.t[x*26+y];c=C[q]+4.5-v;if(c<bc){bc=c;bs=S[q]+v;bn=N[q]+1;}}
      C[o]=bc;S[o]=bs;N[o]=bn;}
    k=n*W+m;return N[k]?Math.round(S[k]/N[k]*100)/100:0;}
  const LTV = (() => { try { return JSON.parse(fs.readFileSync(path.join(R, 'dictee', 'juge_lettres.json'), 'utf8')).v; } catch (e) { return null; } })(), LTT = LTV && _jgLetT(LTV);
  const lettres = (a, b) => (LTT ? _jgLet(a, b, LTT) : 0);
  const nuW = (w) => { const m = /^([a-zà-ÿ]{1,3}')(.+)$/.exec(w); return m ? m[2] : w; };   // le mot sans son élision, comme _jgTr : le trait ne vaut que pour un mot écrit inconnu
  function cands(w0, max = 16) {
    const w = low(w0), m = /^([a-zà-ÿ]{1,3}')(.+)$/.exec(w), pre = m ? m[1] : '', nu = m ? m[2] : w, d = dec(nu), S = new Map();
    const ajoute = (c) => { if (c !== nu && !S.has(c)) S.set(c, F.get(c) || 0); };
    (GRP.get(w) || []).forEach((c) => { if (c !== w) S.set(c, 1e9); });
    if (nu.length >= 2) {
      const garde = (c) => { if (c !== nu && !S.has(c) && F.has(c)) S.set(c, 1e6 + F.get(c)); };   // le top 16 ne les coupe pas
      fins(nu).forEach(garde); (parPh.get(ph(nu)) || []).filter((c) => dec(c) === d).forEach(garde); (parDebut.get(d.slice(0, 4)) || []).filter((c) => dec(c) === d).forEach(garde); (parLen.get(d.length + ':' + d[0]) || []).filter((c) => dec(c) === d).forEach(garde);
      (parPh.get(ph(nu)) || []).forEach(ajoute);
      if (d.length >= 4) (parDebut.get(d.slice(0, 4)) || []).forEach((c) => { if (lev(dec(c), d, 3) <= 3) ajoute(c); });
      for (let n = d.length - 1; n <= d.length + 1; n++) for (const c of (parLen.get(n + ':' + d[0]) || [])) { if (lev(dec(c), d, 1) <= 1) ajoute(c); }
      if (!connu(nu) && d.length >= 3) for (let n = d.length - 2; n <= d.length + 2; n++) for (const c of (parLen.get(n + ':' + d[0]) || [])) { if (lev(dec(c), d, 2) <= 2) ajoute(c); }
    }
    if (!connu(w)) { const an = anag(nu); if (an && an !== nu) S.set(an, 2e9); }   // ligne 383 : l'anagramme passe devant, le top 16 ne la coupe pas
    return Array.from(S.entries()).sort((a, b) => b[1] - a[1]).slice(0, max).map((x) => (x[1] === 1e9 ? x[0] : pre + x[0]));
  }
  // Traits d'une paire (écrit w, candidat c) : même son large, même son strict ou même famille de fin, distance, accent seul, fréquence du candidat (log), mêmes lettres (ligne 383),
  // lettres probables (ligne 399).
  function traits(w0, c0) {
    const w = low(w0), c = low(c0), a = w.split("'").pop(), b = c.split("'").pop();
    return [ph(a) === ph(b) ? 1 : 0, son(a) === son(b) || finsM(a).has(b) ? 1 : 0, Math.min(3, lev(dec(a), dec(b), 3)), dec(a) === dec(b) ? 1 : 0, Math.round(Math.log2(1 + (F.get(b) || 0))), danse(a, b), connu(nuW(w)) ? 0 : lettres(dec(a), dec(b))];
  }
  return { D, F, low, dec, ph, son, lev, GR, GRP, connu, cands, fins, traits, anag, danse, cleDanse, lettres, LTV };
};
