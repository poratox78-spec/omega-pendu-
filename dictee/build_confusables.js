'use strict';
// GÉNÈRE dictee/confusables.json — la couche VERTE « vigilance » du correcteur (≠ rouge FP=0).
// Le vert n'AFFIRME PAS une faute : il signale un mot CONFUSABLE et propose les possibilités (avec un gloss de sens),
// ordonnées par le CONTEXTE (modèle log-odds depuis UD). Comme il ne corrige pas, FP=0 ne s'applique pas — le signal
// « sens » (bruité) est ENFIN à sa place : suggérer, pas trancher. Inspiré du double soulignement de BonPatron.
//
// Sortie : { win, groups:[ {forms:[...], gloss:{f:"…"}, prior:{f:logfreq}, ctx:{f:{mot:poids}} } ] }
//   score(f|contexte) = prior[f] + Σ_{w∈ctx} ctx[f][w] ;  on ORDONNE les formes par score (jamais d'assertion).
//   Les formes absentes d'UD gardent gloss+possibilités, sans indice contexte (prior/ctx omis).
//   Corpus UD hors-repo (data_local/, cf. evo/evo_o2_homophone_context.js).   Usage : node dictee/build_confusables.js
const fs=require('fs'), path=require('path');
const CONLLU=path.join(__dirname,'..','data_local','ud_fr_gsd-train.conllu');
const WIN=4, LAMBDA=0.5, MINF=3, TOPK=25;

// --- LISTE CURÉE : confusables LEXICAUX/SÉMANTIQUES français (les vrais pièges ; PAS les mots-outils déjà gérés en rouge) ---
const CURATED=[
  {forms:['père','pères','paire','paires','pair','pairs'], gloss:{'père':'le parent','paire':'deux choses (une ~ de)','pair':'égal · nombre pair · semblable (par les ~s)'}},
  {forms:['mer','mère','mères','maire','maires'], gloss:{'mer':"l'étendue d'eau",'mère':'le parent','maire':'élu municipal'}},
  {forms:['ver','vers','vert','verts','verre','verres'], gloss:{'ver':"l'animal",'vers':'direction · en poésie','vert':'la couleur','verre':'le récipient'}},
  {forms:['compte','comptes','conte','contes','comte','comtes'], gloss:{'compte':'calcul · (compter)','conte':'le récit','comte':'le noble'}},
  {forms:['cours','court','courent','cour','cours'], gloss:{'cours':'leçon · flux','court':'bref · (courir)','cour':"espace · tribunal"}},
  {forms:['pain','pains','pin','pins'], gloss:{'pain':"l'aliment",'pin':"l'arbre"}},
  {forms:['sceau','sceaux','seau','seaux','sot','sots','saut','sauts'], gloss:{'sceau':'le cachet','seau':'le récipient','sot':'idiot','saut':'le bond'}},
  {forms:['voie','voies','voix','vois','voit'], gloss:{'voie':'le chemin','voix':'le son · le vote','vois':'(voir, je/tu)','voit':'(voir, il)'}},
  {forms:['foi','fois','foie'], gloss:{'foi':'la croyance','fois':"l'occurrence",'foie':"l'organe"}},
  {forms:['temps','tant','t’en','tend','tends'], gloss:{'temps':'la durée · la météo','tant':'tellement','t’en':"(tu t'en…)"}},
  {forms:['mois','moi'], gloss:{'mois':'la période','moi':'le pronom'}},
  {forms:['toi','toit','toits'], gloss:{'toi':'le pronom','toit':'la couverture'}},
  {forms:['très','trait','traits'], gloss:{'très':"l'intensif",'trait':'ligne · caractéristique'}},
  {forms:['vin','vins','vingt','vingts','vain','vains','vint'], gloss:{'vin':'la boisson','vingt':'le nombre 20','vain':'inutile','vint':'(venir, passé)'}},
  {forms:['tante','tantes','tente','tentes'], gloss:{'tante':'la parente','tente':"l'abri · (tenter)"}},
  {forms:['date','dates','datte','dattes'], gloss:{'date':'le jour','datte':'le fruit'}},
  {forms:['cane','canes','canne','cannes'], gloss:{'cane':'la femelle du canard','canne':'le bâton'}},
  {forms:['cor','cors','corps'], gloss:{'cor':'instrument · durillon','corps':"l'organisme"}},
  {forms:['chaîne','chaînes','chêne','chênes'], gloss:{'chaîne':'les maillons','chêne':"l'arbre"}},
  {forms:['amande','amandes','amende','amendes'], gloss:{'amande':'le fruit','amende':'la sanction'}},
  {forms:['ancre','ancres','encre','encres'], gloss:{'ancre':'la marine','encre':"l'écriture"}},
  {forms:['autel','autels','hôtel','hôtels'], gloss:{'autel':'le religieux','hôtel':"l'hébergement"}},
  {forms:['balade','balades','ballade','ballades'], gloss:{'balade':'la promenade','ballade':'le poème · la chanson'}},
  {forms:['champ','champs','chant','chants'], gloss:{'champ':'le terrain','chant':'la mélodie'}},
  {forms:['cou','cous','coup','coups','coût','coûts'], gloss:{'cou':'partie du corps','coup':'le choc','coût':'le prix'}},
  {forms:['dessein','desseins','dessin','dessins'], gloss:{'dessein':"l'intention",'dessin':"l'image"}},
  {forms:['mal','maux','mâle','mâles','malle','malles'], gloss:{'mal':'la douleur','mâle':'le masculin','malle':'le coffre'}},
  {forms:['mur','murs','mûr','mûrs','mûre','mûres'], gloss:{'mur':'la paroi','mûr':'arrivé à maturité','mûre':'le fruit · la couleur'}},
  {forms:['pause','pauses','pose','poses'], gloss:{'pause':"l'arrêt",'pose':'la posture · (poser)'}},
  {forms:['tache','taches','tâche','tâches'], gloss:{'tache':'la salissure','tâche':'le travail'}},
  {forms:['sang','sans','cent','cents','s’en','c’en'], gloss:{'sang':'le liquide vital','sans':'la privation','cent':'le nombre 100','s’en':"(s'en aller)"}},
  {forms:['plutôt','plus tôt'], gloss:{'plutôt':'de préférence','plus tôt':'avant dans le temps'}},
  // — élargissement curé depuis phono_homophones (candidats minés par build_confusables_auto.py, triés à la main) —
  {forms:['faim','fin','fins','feint','feints'], gloss:{'faim':"l'appétit",'fin':'≠ début · subtil','feint':'simulé (feindre)'}},
  {forms:['cœur','coeur','cœurs','chœur','choeur','chœurs'], gloss:{'cœur':"l'organe · le centre",'coeur':"l'organe · le centre",'chœur':'la chorale','choeur':'la chorale'}},
  {forms:['point','points','poing','poings'], gloss:{'point':'le ~ (.) · pas du tout','poing':'la main fermée'}},
  {forms:['salle','salles','sale','sales'], gloss:{'salle':'la pièce','sale':'≠ propre'}},
  {forms:['boulot','boulots','bouleau','bouleaux'], gloss:{'boulot':'le travail (fam.)','bouleau':"l'arbre"}},
  {forms:['plan','plans','plant','plants'], gloss:{'plan':'le projet · le schéma','plant':'le jeune végétal'}},
  {forms:['censé','censée','censés','sensé','sensée','sensés'], gloss:{'censé':'supposé (~ faire)','sensé':'raisonnable'}},
  {forms:['cygne','cygnes','signe','signes'], gloss:{'cygne':"l'oiseau",'signe':'le geste · le symbole'}},
  {forms:['cuir','cuirs','cuire'], gloss:{'cuir':'la matière','cuire':'(faire ~)'}},
  {forms:['gène','gènes','gêne','gênes'], gloss:{'gène':'le ~ (ADN)','gêne':'le malaise · (gêner)'}},
  {forms:['repaire','repaires','repère','repères'], gloss:{'repaire':'la cachette','repère':'le point de référence'}},
  {forms:['martyr','martyrs','martyre','martyres'], gloss:{'martyr':'la personne','martyre':'le supplice'}},
  {forms:['palais','palet','palets'], gloss:{'palais':'le château · la bouche','palet':'le disque (jeu)'}},
  {forms:['selle','selles','sel','sels','scelle','scelles'], gloss:{'selle':'(cheval)','sel':'le condiment','scelle':'(sceller)'}},
  {forms:['teint','teints','thym','tain'], gloss:{'teint':'la couleur (peau)','thym':"l'herbe",'tain':'le ~ du miroir'}},
  {forms:['mante','mantes','menthe','menthes'], gloss:{'mante':'la ~ religieuse','menthe':'la plante'}},
  {forms:['héraut','hérauts','héros'], gloss:{'héraut':'le messager','héros':'le brave'}},
  // — PARONYMES (confusables VISUELS, ≠ homophones ; curés + validés contre cgram_pos : présence + fréquence) —
  {forms:['allusion','allusions','illusion','illusions'], gloss:{'allusion':'le sous-entendu (faire ~ à)','illusion':'la chose fausse · le mirage'}},
  {forms:['éminent','éminente','éminents','imminent','imminente','imminents'], gloss:{'éminent':'remarquable, supérieur','imminent':'tout proche (qui va arriver)'}},
  {forms:['conjecture','conjectures','conjoncture','conjonctures'], gloss:{'conjecture':'la supposition','conjoncture':'la situation du moment'}},
  {forms:['effraction','effractions','infraction','infractions'], gloss:{'effraction':'entrée par force','infraction':'la violation de la loi'}},
  {forms:['évoquer','évoque','évoqué','invoquer','invoque','invoqué'], gloss:{'évoquer':'rappeler, mentionner','invoquer':"appeler à l'aide · citer un motif"}},
  {forms:['consommer','consomme','consommé','consumer','consume','consumé'], gloss:{'consommer':'utiliser, manger','consumer':'brûler, détruire'}},
  {forms:['inclinaison','inclinaisons','inclination','inclinations'], gloss:{'inclinaison':"la pente, l'angle",'inclination':'le penchant, le goût'}},
  {forms:['prolongation','prolongations','prolongement','prolongements'], gloss:{'prolongation':'de durée (temps)','prolongement':"d'espace · la suite"}},
  {forms:['original','originale','originaux','originel','originelle','originels'], gloss:{'original':'inédit, singulier','originel':"d'origine (le péché ~)"}},
  {forms:['littéral','littérale','littoral','littoraux'], gloss:{'littéral':'au sens exact, mot à mot','littoral':'le bord de mer'}},
  {forms:['éruption','éruptions','irruption','irruptions'], gloss:{'éruption':'volcan · boutons','irruption':'entrée soudaine'}},
  {forms:['partial','partiale','partiaux','partiel','partielle','partiels'], gloss:{'partial':'pas neutre, de parti pris','partiel':'incomplet, une partie'}},
  {forms:['temporel','temporelle','temporaire','temporaires'], gloss:{'temporel':'relatif au temps','temporaire':'provisoire, momentané'}},
  {forms:['notable','notables','notoire','notoires'], gloss:{'notable':'remarquable (un ~)','notoire':'connu de tous'}},
  {forms:['cote','cotes','côte','côtes'], gloss:{'cote':'la cotation, la mesure','côte':"le bord de mer · l'os · la pente"}},
  {forms:['roder','rode','rodé','rôder','rôde','rôdé'], gloss:{'roder':'mettre au point','rôder':'errer, traîner'}},
  {forms:['pécheur','pécheurs','pêcheur','pêcheurs'], gloss:{'pécheur':'qui commet une faute','pêcheur':'qui pêche le poisson'}},
  {forms:['recouvrer','recouvré','recouvrir','recouvert'], gloss:{'recouvrer':'récupérer, retrouver','recouvrir':'couvrir entièrement'}},
  {forms:['vénéneux','vénéneuse','venimeux','venimeuse'], gloss:{'vénéneux':'plante/champignon toxique','venimeux':'animal à venin'}},
];

function buildModel(){
  if(!fs.existsSync(CONLLU)){ console.error('UD absent (data_local/) — confusables.json gardera gloss+possibilités SANS indice contexte.'); return null; }
  const sents=[]; let cur=[];
  for(const line of fs.readFileSync(CONLLU,'utf8').split('\n')){
    if(line===''){ if(cur.length){sents.push(cur);cur=[];} continue; }
    if(line[0]==='#') continue;
    const c=line.split('\t'); if(c.length<5||c[0].includes('-')||c[0].includes('.')) continue;
    cur.push(c[1].toLowerCase());
  }
  if(cur.length)sents.push(cur);
  const isWord = w => /[a-zà-öù-ÿœæ]/i.test(w) && /^[a-zà-öù-ÿœæ'’-]+$/i.test(w);
  const allForms=new Set(); CURATED.forEach(g=>g.forms.forEach(f=>{ if(f.indexOf(' ')<0) allForms.add(f); }));
  const freq=new Map(), ctx=new Map(), tot=new Map(); const V=new Set();
  for(const s of sents){ for(let i=0;i<s.length;i++){ const w=s[i];
    if(allForms.has(w)){ freq.set(w,(freq.get(w)||0)+1); if(!ctx.has(w))ctx.set(w,new Map()); const cm=ctx.get(w); let t=0;
      for(let j=Math.max(0,i-WIN);j<=Math.min(s.length-1,i+WIN);j++){ if(j===i)continue; const cw=s[j]; if(!isWord(cw))continue; cm.set(cw,(cm.get(cw)||0)+1); V.add(cw); t++; } tot.set(w,(tot.get(w)||0)+t); } } }
  return {sents, freq, ctx, tot, Vn:V.size};
}

const M=buildModel();
// NB propre compact : prior[f]=log freq · floor[f]=log P(mot inconnu|f) · top[f]={mot:log P(mot|f)} (les co-occurrents)
// score(f|ctx)=prior[f]+Σ_w (top[f][w] sinon floor[f]) → tout mot du contexte compte (vu = poids, non-vu = plancher).
const out={win:WIN, note:'Couche VERTE (vigilance, n\'affirme pas → hors FP=0). score(f|ctx)=prior[f]+Σ_w(ctx[f][w] ?? floor[f]) ; ordonne les possibilités. build: dictee/build_confusables.js', groups:[]};
for(const g of CURATED){
  const grp={forms:g.forms, gloss:g.gloss};
  if(M){
    const present=g.forms.filter(f=>f.indexOf(' ')<0 && (M.freq.get(f)||0)>=MINF);
    if(present.length>=2){
      grp.prior={}; grp.floor={}; grp.ctx={};
      for(const f of present){
        const cm=M.ctx.get(f)||new Map(), tf=M.tot.get(f)||0;
        grp.prior[f]=+Math.log((M.freq.get(f)||0)+LAMBDA).toFixed(3);
        grp.floor[f]=+Math.log(LAMBDA/(tf+LAMBDA*M.Vn)).toFixed(3);
        const top=[...cm.entries()].sort((a,b)=>b[1]-a[1]).slice(0,TOPK);  // co-occurrents les plus fréquents
        grp.ctx[f]=Object.fromEntries(top.map(([w,c])=>[w, +Math.log((c+LAMBDA)/(tf+LAMBDA*M.Vn)).toFixed(3)]));
      }
    }
  }
  out.groups.push(grp);
}
const dst=path.join(__dirname,'confusables.json');
fs.writeFileSync(dst, JSON.stringify(out));
const withCtx=out.groups.filter(g=>g.ctx).length;
console.error(`écrit ${dst} · ${out.groups.length} groupes confusables · ${withCtx} avec indice contexte (UD)`);

// ---------- DÉMO : ordonnancement + atténuation (la même fonction que portera l'UI) ----------
if(M){
  function score(grp, f, ctxWords){ let s=grp.prior[f]; const c=grp.ctx[f], fl=grp.floor[f]; for(const w of ctxWords) s += (c[w]!==undefined?c[w]:fl); return s; }
  function rank(grp, ctxWords){ return Object.keys(grp.prior).map(f=>[f,score(grp,f,ctxWords)]).sort((a,b)=>b[1]-a[1]); }
  const byForm={}; out.groups.forEach(g=>{ if(g.ctx) Object.keys(g.prior).forEach(f=>byForm[f]=g); });
  const demos=['il porte une paire de lunettes','il parle à son père','le mois de mai','pense à moi',
               'un verre de vin','il a bu du vin','la mer est calme','sa mère est là','un conte pour enfants','le compte est bon'];
  const tok=s=>s.toLowerCase().split(/\s+/);
  let ok=0,tot=0;
  console.error('\nDÉMO (🟢 on souligne, on PROPOSE l\'ordre — jamais d\'assertion ; ✓ = tête = mot écrit) :');
  for(const d of demos){ const T=tok(d);
    for(let i=0;i<T.length;i++){ const g=byForm[T[i]]; if(!g)continue;
      const cw=T.filter((_,j)=>j!==i); const r=rank(g,cw); if(r.length<2)continue;
      const written=T[i], top=r[0][0]; const correct=top===written; tot++; if(correct)ok++;
      const atten = (correct && (r[0][1]-r[1][1])>3) ? ' [contexte confirme → atténuer]' : '';
      console.error(`  ${correct?'✓':'·'} « ${d} » · 🟢 ${written} → ${r.slice(0,4).map(x=>x[0]).join(' > ')}${atten}`);
    }
  }
  console.error(`\n  ordre cohérent (tête = mot réellement écrit) : ${ok}/${tot} (indice, pas verdict — l'utilisateur tranche)`);
}
