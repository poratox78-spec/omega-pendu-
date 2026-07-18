// dys-core.js — MOTEUR correcteur dys, COPIE VERBATIM du moteur de app/omega-pendu.html (correcteur).
// Sans DOM, sans UI : utilisable dans un content-script, un worker ou Node. Parité avec le probe Python
// (dictee/correcteur_probe.py) — vérifiée par extension/parity_core.js. Lexiques chargés depuis les assets
// de l'extension (loadLex, fetch+DecompressionStream) ou injectés directement (setLex, pour Node/tests).
// Données dérivées Lexique 4 → CC BY-SA 4.0.
(function (global) {
  'use strict';

  // ===== normalisation =====
  function deacc(s){return s.normalize('NFD').replace(/[̀-ͯ]/g,'');}
  function toks(s){return (s.match(/[A-Za-zÀ-ÿœŒ'’ʼ]+/g)||[]).map(function(w){return w.replace(/[’ʼ]/g,"'");});}   // apostrophe TYPOGRAPHIQUE ’ ≡ ' : token normalisé pour le moteur (remplacement 1:1 → index alignés)

  // ===== sets & helpers (port diag_sentence.py) — VERBATIM app =====
  var NUM_DET={le:'sg',la:'sg',un:'sg',une:'sg',ce:'sg',cet:'sg',cette:'sg',mon:'sg',ton:'sg',son:'sg',ma:'sg',ta:'sg',sa:'sg',notre:'sg',votre:'sg',leur:'sg',les:'pl',des:'pl',ces:'pl',mes:'pl',tes:'pl',ses:'pl',nos:'pl',vos:'pl',leurs:'pl'};
  var NUM_PRON={je:'sg',tu:'sg',il:'sg',elle:'sg',on:'sg',nous:'pl',vous:'pl',ils:'pl',elles:'pl'};
  var PREP={de:1,'à':1,a:1,du:1,des:1,au:1,aux:1,sur:1,dans:1,par:1,pour:1,avec:1,sans:1,sous:1,chez:1,vers:1,'près':1,pres:1,travers:1,'malgré':1,malgre:1,'dès':1,entre:1,depuis:1,contre:1};
  function governorNumber(T,idx,skipPP){for(var j=idx-1;j>=0;j--){var w=T[j].toLowerCase();if(NUM_PRON[w])return[T[j],NUM_PRON[w]];if(NUM_DET[w]){if(skipPP&&j>0&&PREP[deacc(T[j-1].toLowerCase())])continue;return[T[j],NUM_DET[w]];}}return null;}
  var VERB_FORMS={dort:1,jouent:1,boit:1,court:1,lit:1,met:1,mangeons:1,ecrit:1,chantent:1,repetent:1,creuse:1,porte:1,prennent:1,sont:1,vend:1,eteignent:1,galopent:1,faut:1,finisses:1,etudient:1,tombent:1,est:1,aurait:1,restions:1,cachait:1,quittent:1,calme:1,attendaient:1,furent:1,poursuivirent:1,avons:1,a:1};
  var VERB_SUF=['ons','ez','aient','ait','erent','irent','issent'];var NOTVERB={longtemps:1,ensemble:1,vraiment:1,souvent:1,comment:1,patiemment:1,rapidement:1};
  function isVerb(T,idx){if(idx<0||idx>=T.length)return false;var w=deacc(T[idx].toLowerCase());var known=VERB_FORMS[w]||(!NOTVERB[w]&&w.length>3&&VERB_SUF.some(function(s){return w.slice(-s.length)===s;}));if(!known)return false;return !(idx>0&&NUM_DET[T[idx-1].toLowerCase()]);}
  var AUX_ETRE={est:1,sont:1,furent:1,fut:1,etait:1,etaient:1,sera:1,seront:1,suis:1,es:1,sommes:1,etes:1,soit:1};
  var AUX_AVOIR={a:1,ont:1,avons:1,avez:1,ai:1,as:1,avait:1,avaient:1,aurait:1,aura:1,auront:1,aurais:1,eu:1};
  var PART_FORMS={arrive:1,arrives:1,arrivee:1,arrivees:1,peint:1,peints:1,peinte:1,peintes:1,cueilli:1,cueillie:1,cueillis:1,cueillies:1,trouve:1,trouves:1,trouvee:1,trouvees:1,prefere:1,preferes:1,preferee:1,preferees:1,abandonne:1,abandonnes:1,abandonnee:1,abandonnees:1};
  function isParticiple(T,idx){return idx>=0&&idx<T.length&&!!PART_FORMS[deacc(T[idx].toLowerCase())];}
  function findAux(T,idx){for(var j=idx-1;j>=Math.max(0,idx-4);j--){var w=deacc(T[j].toLowerCase());if(AUX_ETRE[w])return'etre';if(AUX_AVOIR[w])return'avoir';}return null;}
  var GEN_DET={le:'m',un:'m',ce:'m',cet:'m',mon:'m',ton:'m',son:'m',au:'m',du:'m',la:'f',une:'f',cette:'f',ma:'f',ta:'f',sa:'f'};
  function governorGender(T,idx){for(var j=idx-1;j>=0;j--){var w=T[j].toLowerCase();if(GEN_DET[w])return[T[j],GEN_DET[w]];if(NUM_DET[w]||NUM_PRON[w])return null;}return null;}
  function findCodAntepose(T,idx){for(var j=idx-1;j>=Math.max(0,idx-5);j--){var w=T[j].toLowerCase();if(w==='que'||w.slice(0,3)==="qu'"){if(j===0)return null;var gg=governorGender(T,j),gn=governorNumber(T,j,false);return[T[j-1],gg?gg[1]:null,gn?gn[1]:null];}}return null;}

  // ===== couche dys (stades + remédiation) — VERBATIM app =====
  var STAGE_FAM={voisee_sourde:'phonologique',inversion:'phonologique',ajout:'phonologique',surface:'alphabetique',accent:'alphabetique',segmentation:'alphabetique',majuscule:'alphabetique',muette:'lexical',homophone_lex:'lexical',homophone:'lexical',homophone_gram:'morphosyntaxique',accord:'morphosyntaxique'};   // homophone LEXICAL (ver/vert)=lexical ; GRAMMATICAL (a/à, son/sont)=morphosyntaxique ; 'homophone' nu = repli lexical ; segmentation/majuscule = conventions (alphabétique)
  var STAGE_ORDER=['phonologique','alphabetique','lexical','morphosyntaxique'];
  var STAGE_LBL={phonologique:'phonologique (le son)',alphabetique:'alphabétique (écrit au son)',lexical:'lexical (orthographe du mot)',morphosyntaxique:'morphosyntaxique (grammaire)'};
  var STAGE_MSG={phonologique:'travaille le SON (conscience phonémique) : sourde/sonore, inversions, lettres en trop.',alphabetique:'écrit « comme ça sonne » : passer du son à l’orthographe conventionnelle (accents, graphies).',lexical:'orthographe du MOT : lettres muettes, homophones LEXICAUX (ver/vert/verre).',morphosyntaxique:'GRAMMAIRE : accords en genre/nombre/verbal ET homophones grammaticaux (a/à, son/sont) — le palier le plus tardif.'};
  function stageOfFact(types){var best=-1;(types||[]).forEach(function(t){var st=STAGE_FAM[t];if(st){var k=STAGE_ORDER.indexOf(st);if(k>best)best=k;}});return best<0?null:STAGE_ORDER[best];}
  function developmental(F){var c={},tot=0,i;for(i=0;i<STAGE_ORDER.length;i++)c[STAGE_ORDER[i]]=0;F.forEach(function(f){var st=stageOfFact(f.types);if(st){c[st]++;tot++;}});if(!tot)return null;for(i=0;i<STAGE_ORDER.length;i++)if(c[STAGE_ORDER[i]]>0)return{stade:STAGE_ORDER[i]};return null;}
  var REMED={
    voisee_sourde:'Sourde/sonore : pose la main sur ta gorge — b, d, g, v, z, j FONT vibrer ; p, t, k, f, s, ch non. Allonge le son avant d’écrire.',
    inversion:'Inversion de lettres : découpe le mot en SYLLABES et écris-les dans l’ordre (ta-bleau), en suivant du doigt de gauche à droite.',
    ajout:'Lettres en trop : relis en COMPTANT les sons que tu entends — un son = une lettre attendue, pas plus.',
    surface:'Écrit « comme ça sonne » : compare au mot MODÈLE (carte-mot). Un même son a plusieurs graphies (/s/ → s, ss, c, ç).',
    accent:'Accents : é (fermé) et è/ê (ouvert) ne sonnent pas pareil. Dis le mot à voix haute pour choisir l’accent.',
    muette:'Lettre muette finale : trouve un mot de la MÊME FAMILLE où on l’entend (petit→petitE, tard→tardIf, chant→chantEr).',
    homophone_gram:'Homophones grammaticaux (a/à, et/est, son/sont, ces/ses…) : REMPLACE par une forme sûre — si ça tient, c’est un VERBE. a→avait (sinon à) · et→et puis (sinon est→était) · son→mon/ton (sinon sont→étaient) · on→il (sinon ont→avaient) · ces→ces …-là (sinon ses→les siens).',
    homophone_lex:'Homophones lexicaux (ver/vers/vert/verre, sceau/seau) : c’est le SENS qui décide, pas la grammaire. Remplace par un mot de la même FAMILLE ou un synonyme (verre→du verre, vert→verdure, vers→direction, sceau→sceller).',
    homophone:'Homophones grammaticaux : REMPLACE par une forme sûre (a→avait, et→et puis, son→mon/ton). Si la phrase tient, c’est la bonne forme.',
    accord:'Accord : repère QUI COMMANDE (le sujet, le déterminant) et accorde en genre/nombre (les chats → jouENT ; la voiture → bleuE).',
    segmentation:'Découpage : un mot à voyelle « colle » à l’article/pronom élidé → sépare avec l’apostrophe (lhopital → l’hôpital, dargen → d’argent, cetait → c’était). Et « ducou » = deux mots (du coup).',
    majuscule:'Majuscule : une phrase commence TOUJOURS par une majuscule (et les noms propres aussi). Repère le début (après un point) et mets la capitale.'
  };
  function remedFams(F){var dev=developmental(F);if(!dev)return null;var seen={},out=[];(F||[]).forEach(function(f){(f.types||[]).forEach(function(t){if(STAGE_FAM[t]===dev.stade&&!seen[t]){seen[t]=1;out.push(t);}});});return out.length?{stade:dev.stade,fams:out}:null;}

  // ===== correcteur (règles homophones + accord + genre) — VERBATIM app =====
  var COMMON_VERBS={};("suis es est sommes etes sont etais etait etions etiez etaient sera seront fut furent serait soit "
    +"ai as a avons avez ont avais avait avaient aura auront aurait eu vais vas va allons allez vont allais allait ira iront alle aille "
    +"fais fait faisons faites font faisait fera fasse dis dit disons dites disent disait dira peux peut pouvons pouvez peuvent pouvait pourra pu puisse "
    +"veux veut voulons voulez veulent voulait voudra voulu veuille dois doit devons devez doivent devait devra du doive sais sait savons savez savent savait saura su sache "
    +"vois voit voyons voyez voient voyait verra vu voie viens vient venons venez viennent venait viendra venu vienne prends prend prenons prenez prennent prenait prendra pris prenne "
    +"mets met mettons mettez mettent mettait mettra mis mette mange mangent mangeons mangez mangeait parle parlent parlez parlait aime aiment aimez aimait donne donnent donnez "
    +"trouve trouvent regarde regardent joue jouent jouez jouait porte portent cherche cherchent pense pensent reste restent passe passent arrive arrivent entre entrent monte montent "
    +"tombe tombent tombait chante chantent court courent boit boivent lit lisent ecrit ecrivent dort dorment finit finissent etudie etudient quitte quittent calme creuse vend vendent").split(/\s+/).forEach(function(w){if(w)COMMON_VERBS[w]=1;});
  var GENDER_MAP={},GENDER_PURE={},ADJP={},NOUN_PLURAL={};var CONJ_F={},CONJ_C={};
  function _applyVdc(vd){(vd.v||[]).forEach(function(w){COMMON_VERBS[w]=1;});GENDER_MAP=vd.g||{};GENDER_PURE=vd.gn||{};ADJP=vd.a||{};var cj=vd.cj||{};CONJ_F=cj.f||{};CONJ_C=cj.c||{};_fillReg3pl(CONJ_C,CONJ_F);NOUN_PLURAL={};(vd.gp||[]).forEach(function(w){NOUN_PLURAL[w]=1;});var _GOE={soeur:'f',soeurs:'f',coeur:'m',coeurs:'m',oeuf:'m',oeufs:'m',oeuvre:'f',oeuvres:'f',boeuf:'m',boeufs:'m',voeu:'m',voeux:'m',noeud:'m',noeuds:'m',oeil:'m',moeurs:'f',manoeuvre:'f',manoeuvres:'f',oeillet:'m',oeillets:'m',oesophage:'m',foetus:'m'};for(var _goeK in _GOE)if(GENDER_PURE[_goeK]===undefined)GENDER_PURE[_goeK]=_GOE[_goeK];}   // GENRE noms en œ manquants du lexique gn (débloque « mon soeur »→ma sœur). FP=0, union. Miroir app + Python.
  function _applyGenderRelaxed(txt){var lines=txt.split('\n');for(var k=0;k<lines.length;k++){var ln=lines[k];if(!ln)continue;var p=ln.split('\t');if(p.length<2)continue;if(GENDER_PURE[p[0]]===undefined)GENDER_PURE[p[0]]=(p[1]==='1'?'f':'m');}}
  function lexicalGender(T,idx){if(!GENDER_MAP)return null;var j,w,g;
    for(j=idx-1;j>=Math.max(0,idx-3);j--){w=T[j].toLowerCase();if(NUM_PRON[w]||PREP[deacc(w)])break;g=GENDER_MAP[deacc(w)];if(g==='m'||g==='f')return[T[j],g];}
    for(j=idx+1;j<Math.min(T.length,idx+3);j++){w=T[j].toLowerCase();if(NUM_PRON[w]||PREP[deacc(w)])break;g=GENDER_MAP[deacc(w)];if(g==='m'||g==='f')return[T[j],g];}
    return null;}
  var MODAL={};("veux veut veulent peux peut peuvent dois doit doivent va vais vas vont faut sais sait aime aimes aiment adore espere souhaite prefere preferent vient viens allons allez laisse laissent semble ose pour sans afin de devons devez pouvons pouvez voulons voulez").split(/\s+/).forEach(function(w){MODAL[w]=1;});
  var CAUX={};Object.keys(AUX_ETRE).forEach(function(k){CAUX[k]=1;});Object.keys(AUX_AVOIR).forEach(function(k){CAUX[k]=1;});
  function cprev(T,i){return i>0?deacc(T[i-1].toLowerCase()):null;}
  function _isPpl(w){var lw=w.toLowerCase(),d=deacc(lw),stem,inf;   // participe RÉEL (infinitif reconstruit ∈ lexique verbal) ≠ nom en -é/-ée
    if(IRREG_PART[d]||d==='ete'||d==='eu')return true;
    if(/ées$/.test(lw)){stem=deacc(lw.slice(0,-3));inf='er';}
    else if(/ée$/.test(lw)){stem=deacc(lw.slice(0,-2));inf='er';}
    else if(/és$/.test(lw)){stem=deacc(lw.slice(0,-2));inf='er';}
    else if(/é$/.test(lw)){stem=deacc(lw.slice(0,-1));inf='er';}
    else if(/is$/.test(d)){stem=deacc(lw.slice(0,-2));inf='ir';}
    else if(/i$/.test(d)){stem=deacc(lw.slice(0,-1));inf='ir';}
    else return false;
    return stem.length>=2&&!!COMMON_VERBS[stem+inf];}
  var PLURAL_DET={};'les des ces leurs mes tes ses nos vos quels quelles plusieurs certains certaines quelques aux'.split(' ').forEach(function(w){PLURAL_DET[w]=1;});
  var VSTOP={};['ne','me','te','se','le','la','les',"l'",'en','y','que','qu','qui','si','ou','et','ni','car','or','ce','ces','de','des','du'].forEach(function(w){VSTOP[w]=1;});Object.keys(NUM_DET).forEach(function(w){VSTOP[w]=1;});Object.keys(NUM_PRON).forEach(function(w){VSTOP[w]=1;});
  function vlike(T,i){if(i<0||i>=T.length)return false;if(isVerb(T,i))return true;var w=deacc(T[i].toLowerCase());if(VSTOP[w])return false;return !!COMMON_VERBS[w]&&!(i>0&&NUM_DET[T[i-1].toLowerCase()]);}
  function cpl(T,j){if(j<0||j>=T.length)return false;var dw=deacc(T[j].toLowerCase());if(!/[sx]$/.test(dw))return false;return j>0&&NUM_DET[T[j-1].toLowerCase()]==='pl';}
  var NOUN_E={};'marche traite combine cote passe arrete carre depute employe invite expose resume communique delegue prive defile abonne'.split(' ').forEach(function(w){NOUN_E[w]=1;});
  function rEer(T,i){var w=T[i],lw=w.toLowerCase(),f;if(lw.indexOf("'")>=0)return null;if(/é$/.test(lw))f=[w,w.slice(0,-1)+'er'];else if(/er$/.test(deacc(lw))&&lw.length>3)f=[w.slice(0,-2)+'é',w];else return null;if(NOUN_E[deacc(f[0].toLowerCase())])return null;if(!COMMON_VERBS[deacc(f[1].toLowerCase())])return null;if(i===0)return null;var praw=T[i-1].toLowerCase();if(praw==='à'||T[i-1]==='A')return f[1];var p=cprev(T,i);if(CAUX[p])return f[0];if(PREP[p]){if(GENDER_MAP[deacc(f[0].toLowerCase())])return null;return f[1];}if(MODAL[p])return f[1];return null;}
  // -er/-é/-ez/-ai (verbe 1er groupe) tranché par le GOUVERNEUR (test mordre/mordu) — MIROIR de correcteur_probe.rule_flexion_er (parité)
  var _AUX_AV={avoir:1,avais:1,avaient:1,etre:1,ete:1,etais:1,etait:1,etaient:1,etions:1,etiez:1,serai:1,seras:1,serez:1,serons:1,soient:1,sois:1};Object.keys(AUX_AVOIR).forEach(function(k){_AUX_AV[k]=1;});Object.keys(AUX_ETRE).forEach(function(k){_AUX_AV[k]=1;});   // participe : avoir ET être (« je suis allez »→allé, « a été fabriquer »→fabriqué)
  var _FLEX_CLITIC={se:1,me:1,te:1};   // clitiques réfléchis PURS sautés pour trouver le vrai gouverneur (« veut se séparer »). le/la/les EXCLUS (ambigus déterminant)
  var _CAUS={faire:1,fait:1,fais:1,faisait:1,faisaient:1,font:1,fera:1,feront:1,ferait:1};   // causatif « faire + INFINITIF » → infinitif (si le mot suivant est un verbe -er)
  var _INF_GOV={de:1,pour:1,sans:1,afin:1};
  var _FLEX_STOP={};'assez chez rez nez mai quai vrai gai essai delai balai geai bai lai quinquennat'.split(' ').forEach(function(w){_FLEX_STOP[w]=1;});
  var NOUN_EE={};'fumee pensee entree arrivee portee duree montee annee idee allee vallee poupee epee assemblee tournee poignee rentree traversee chaussee gelee flambee plongee rangee nuitee veillee bouchee gorgee cuilleree'.split(' ').forEach(function(w){NOUN_EE[w]=1;});
  var _FLEX_ADV={};'deja bien toujours jamais pas plus vraiment encore aussi souvent probablement enfin vite trop meme presque tres tout peut-etre'.split(' ').forEach(function(w){_FLEX_ADV[w]=1;});
  function _inf1(w){var lw=w.toLowerCase(),d=deacc(lw),inf;
    if(/ées$/.test(lw))inf=lw.slice(0,-3)+'er';else if(/ée$/.test(lw))inf=lw.slice(0,-2)+'er';
    else if(/és$/.test(lw))inf=lw.slice(0,-2)+'er';else if(/é$/.test(lw))inf=lw.slice(0,-1)+'er';
    else if(/erai$/.test(d))inf=lw.slice(0,-2);
    else if(/ez$/.test(d)&&d.length>3)inf=lw.slice(0,-2)+'er';
    else if(/er$/.test(d)&&d.length>3)inf=lw;else return null;
    return (inf.length>=4&&COMMON_VERBS[deacc(inf)])?inf:null;}
  function _catE(x){var d=deacc(x);if(/(ées|ée|és|é)$/.test(x))return 'part';if(/erai$/.test(d)||/ai$/.test(d))return 'fut1';if(/ez$/.test(d))return 'p2pl';if(/er$/.test(d))return 'inf';return null;}
  function rFlexionEr(T,i){var w=T[i],lw=w.toLowerCase();
    if(lw.indexOf("'")>=0||i===0)return null;
    if(w.charAt(0)!==w.charAt(0).toLowerCase()&&!(_SEG&&i<_SEG.ss.length&&_SEG.ss[i]))return null;
    var nx=(i+1<T.length)?deacc(T[i+1].toLowerCase()):null;
    if(_SEG&&i+1<_SEG.hy.length&&_SEG.hy[i+1]&&nx!=='vous')return null;
    var inf=_inf1(w);if(inf===null)return null;
    var d=deacc(lw);if(NOUN_E[d]||_FLEX_STOP[d]||NOUN_EE[d])return null;
    var stem=inf.slice(0,-2),forms={inf:inf,part:stem+'é',p2pl:stem+'ez',fut1:inf+'ai'},cur=_catE(lw);
    var praw=T[i-1].toLowerCase(),p=deacc(praw),tgt;
    var hypv=(nx==='vous'&&_SEG&&i+1<_SEG.hy.length&&_SEG.hy[i+1]);
    if(hypv)tgt='p2pl';
    else if(praw==='à'||T[i-1]==='A'||T[i-1]==='À')tgt='inf';
    else if(_AUX_AV[p]||praw==="j'ai")tgt='part';
    else if(_INF_GOV[p]||MODAL[p]||_CAUS[p])tgt='inf';
    else if(praw==='vous'){var subj=(i===1)||(_SEG&&i-1<_SEG.bb.length&&_SEG.bb[i-1])||(i>=2&&deacc(T[i-2].toLowerCase())==='que');if(!subj)return null;tgt='p2pl';}
    else if(praw==='je'){var _fm={demain:1,bientot:1,prochain:1,prochaine:1,prochains:1,prochaines:1,ulterieurement:1,dorenavant:1,desormais:1,tantot:1};if(!T.some(function(t){return _fm[deacc(t.toLowerCase())];}))return null;tgt='fut1';}
    else if(p==='plait'&&i>=2&&deacc(T[i-2].toLowerCase())==='vous')tgt='p2pl';   // « s'il vous plaît, cherché »→cherchez
    else{var g=i-1;while(g>0&&(_FLEX_ADV[deacc(T[g].toLowerCase())]||_FLEX_CLITIC[deacc(T[g].toLowerCase())]))g--;if(g<0)return null;var dg=deacc(T[g].toLowerCase()),graw=T[g].toLowerCase();if(graw!=='à'&&(_AUX_AV[dg]||graw==="j'ai"))tgt='part';else if(_INF_GOV[dg]||MODAL[dg]||_CAUS[dg])tgt='inf';else return null;}
    if(cur===tgt)return null;
    if(/(és|ées)$/.test(lw)&&(tgt==='inf'||tgt==='p2pl'||tgt==='fut1'))return null;
    if(/ée$/.test(lw)&&tgt!=='part')return null;
    var sugg=forms[tgt];if(deacc(sugg)===d)return null;
    return ckeepcase(w,sugg);}
  // IMPÉRATIF (motifs LOCAUX, FP≈0) — MIROIR correcteur_probe.rule_imperatif : -s euphonique en/y, pas de -s (trait d'union + pronom), irréguliers jamais valides
  var _IMP_PRON={moi:1,toi:1,lui:1,le:1,la:1,les:1,leur:1};
  var _IMP_IRR={soyions:'soyons',ayions:'ayons',soyiez:'soyez',ayiez:'ayez'};
  function rImperatif(T,i){var w=T[i],lw=w.toLowerCase(),d=deacc(lw);
    if(lw.indexOf("'")>=0)return null;
    if(_IMP_IRR[d]){var s=_IMP_IRR[d];return (w.charAt(0)!==w.charAt(0).toLowerCase())?s.charAt(0).toUpperCase()+s.slice(1):s;}
    var nx=(i+1<T.length)?deacc(T[i+1].toLowerCase()):null;
    if(!(_SEG&&i+1<_SEG.hy.length&&_SEG.hy[i+1]))return null;
    if(i>0&&(deacc(T[i-1].toLowerCase())==='ne'||T[i-1].toLowerCase()==="n'"||T[i-1].toLowerCase()==='n’'))return null;
    if(nx==='en'||nx==='y'){
      if(_SEG&&i+2<_SEG.hy.length&&_SEG.hy[i+2])return null;
      if(d==='va')return w+'s';
      if(/e$/.test(lw)&&!/es$/.test(lw)&&COMMON_VERBS[deacc(lw)])return w+'s';
      return null;}
    if(_IMP_PRON[nx]&&/es$/.test(lw)&&/e$/.test(lw.slice(0,-1))&&COMMON_VERBS[deacc(lw.slice(0,-1))])return w.slice(0,-1);
    return null;}
  var PLURAL_MARK={ils:1,elles:1,nous:1,vous:1,les:1,des:1,ces:1,mes:1,tes:1,ses:1,nos:1,vos:1,leurs:1,plusieurs:1,quelques:1,certains:1,certaines:1,deux:1,trois:1,quatre:1,cinq:1,six:1,sept:1,huit:1,neuf:1,dix:1,plupart:1};
  var CLAUSE_BREAK={et:1,ou:1,mais:1,car:1,donc:1,or:1,ni:1,que:1,qui:1,quand:1,lorsque:1,puisque:1,comme:1,si:1,'.':1,',':1,';':1,':':1,'!':1,'?':1};
  function cplBefore(T,i){for(var j=i-1;j>=Math.max(0,i-6);j--){var w=deacc(T[j].toLowerCase());if(CLAUSE_BREAK[w])break;if(PLURAL_MARK[w])return true;}return false;}
  function _clauseNoFiniteVerb(T,i){var n=T.length,lo=0,hi=n,j;   // verbe-présence via le TAGGER HMM (contexte : élèves/table→NOUN) ; repli svReads si modèle absent
    if(_SEG){for(j=i;j>0;j--){if(j<_SEG.bb.length&&_SEG.bb[j]){lo=j;break;}}for(j=i+1;j<n;j++){if(j<_SEG.bb.length&&_SEG.bb[j]){hi=j;break;}}}
    var tg=posTags(T);
    if(tg){for(j=lo;j<hi;j++){if(j!==i&&(tg[j]==='VERB'||tg[j]==='AUX'))return false;}return true;}
    for(j=lo;j<hi;j++){if(j!==i&&svReads(T[j].toLowerCase()).length)return false;}
    return true;}
  function rSon(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='son'&&lw!=='sont')return null;   // tranché par CE QUI SUIT : son=det+nom sg ; sont=être 3pl+prédicat ; abstention sinon (FP=0)
    var nxt=i+1<T.length?deacc(T[i+1].toLowerCase()):'';
    var _nxr=i+1<T.length?T[i+1].toLowerCase():'';
    var nxtNounSg=_nounGate(nxt)&&!(/s$/.test(nxt)||/x$/.test(nxt))&&_nxr!=='là'&&_nxr!=='çà';   // NOM SG derrière = posterior §3 `_nounGate` (P(NOM)≥τ ∧ P(VER)<ε), PAS GENDER_PURE brut : « bien »/« à »/« de » y figurent (note, homographes) → FP « …et… sont bien décidées »→son ; _nounGate les écarte, garde chien/frère/ami. « là »/« çà » accentués = adverbes, exclus.
    var pluralSubj=(cprev(T,i)==='ils'||cprev(T,i)==='elles')||cplBefore(T,i)||cpl(T,i-1);
    if(!pluralSubj){for(var j=i-1;j>i-9&&j>=0;j--){if(_SEG&&(j+1)<_SEG.bb.length&&_SEG.bb[j+1])break;if(PLURAL_DET[deacc(T[j].toLowerCase())]){pluralSubj=true;break;}}}
    if(lw==='sont'){var _sp=cprev(T,i);if(_sp==='il'||_sp==='elle'||_sp==='on'||_sp==='ils'||_sp==='elles'||_sp==='je'||_sp==='tu'||_sp==='nous'||_sp==='vous')return null;   // après un PRONOM SUJET, « sont » est le VERBE (« il sont là »), jamais le possessif ; laisse rIlIls corriger il→ils
      if(pluralSubj)return null;if(nxtNounSg)return 'son';return null;}
    if((cprev(T,i)==='ils'||cprev(T,i)==='elles')&&nxt&&!nxtNounSg)return 'sont';
    // PILOTE analyse — sujet NOM : pluriel avant + « son » suivi d'une PRÉP (ou « en ») + pas déterminant/prép avant + AUCUN verbe fini → sont
    if(pluralSubj&&(PREP[nxt]||nxt==='en')&&!NUM_DET[cprev(T,i)]&&!PREP[cprev(T,i)]&&_clauseNoFiniteVerb(T,i))return 'sont';
    if(i+1<T.length&&pluralSubj&&!NUM_DET[cprev(T,i)]&&!PREP[cprev(T,i)]&&_ppBase(T[i+1])!==null&&/[sx]$/.test(nxt)&&_clauseNoFiniteVerb(T,i))return 'sont';   // « les enfants son partis »→sont
    return null;}
  var IRREG_PART={eu:1,pu:1,du:1,su:1,vu:1,lu:1,tenu:1,venu:1,devenu:1,revenu:1,voulu:1,valu:1,fallu:1,connu:1,reconnu:1,paru:1,apparu:1,disparu:1,couru:1,recu:1,mort:1,fait:1,refait:1,dit:1,redit:1,ecrit:1,decrit:1,mis:1,remis:1,permis:1,promis:1,pris:1,appris:1,compris:1,surpris:1,ouvert:1,offert:1,couvert:1,souffert:1,peri:1,acquis:1,conquis:1,assis:1,vecu:1,plu:1,cru:1,bu:1,tu:1};
  var _PP_U_EXTRA={abattu:1,accouru:1,advenu:1,apercu:1,appartenu:1,attendu:1,battu:1,chu:1,combattu:1,conclu:1,concu:1,confondu:1,contenu:1,convaincu:1,convenu:1,corrompu:1,cousu:1,debattu:1,dechu:1,decu:1,defendu:1,deplu:1,depourvu:1,descendu:1,detendu:1,detenu:1,elu:1,emu:1,entendu:1,entretenu:1,etendu:1,exclu:1,fendu:1,fondu:1,foutu:1,interrompu:1,intervenu:1,maintenu:1,mordu:1,obtenu:1,parcouru:1,parvenu:1,pendu:1,percu:1,perdu:1,pondu:1,pourvu:1,pretendu:1,prevenu:1,prevu:1,promu:1,reapparu:1,recousu:1,redevenu:1,reelu:1,relu:1,rendu:1,repandu:1,repondu:1,resolu:1,retenu:1,revendu:1,revu:1,rompu:1,secouru:1,soutenu:1,souvenu:1,survecu:1,survenu:1,suspendu:1,tendu:1,tondu:1,tordu:1,vaincu:1,vendu:1,vetu:1};   /* PP -u accord (SÉPARÉ d'IRREG_PART pour garder l'abstention « j'est entendu ») */
  // GARDE anti-FP (abstention seule) : participe passé au sens LARGE — -u/-i/-is/-it/-é des verbes -re/-oir/-ire/-uire
  // que _isPpl (strict, anti-noms) écarte. Miroir _looks_ppl (correcteur_probe). Ne JAMAIS s'en servir pour DÉCIDER une correction.
  function _looksPpl(w){if(_isPpl(w))return true;var lw=w.toLowerCase(),d=deacc(lw);if(d.length<3)return false;
    if(IRREG_PART[d])return true;
    if(/(ées|és|ée|é)$/.test(lw))return true;   // participe -é (orchestré) même si l'infinitif -er manque du lexique
    if(/us$/.test(d))d=d.slice(0,-1);
    if(/u$/.test(d)&&(COMMON_VERBS[d.slice(0,-1)+'re']||COMMON_VERBS[d+'re']||COMMON_VERBS[d.slice(0,-1)+'oir']))return true;   // vendu→vendre, conclu→conclure, voulu→vouloir
    if(/(is|it)$/.test(d)){var b=d.slice(0,-2);if(COMMON_VERBS[b+'re']||COMMON_VERBS[b+'ire']||COMMON_VERBS[b+'uire']||COMMON_VERBS[b+'endre']||COMMON_VERBS[b+'ettre']||COMMON_VERBS[b+'aire'])return true;}   // commis/pris/déduit/écrit/dit/fait
    if(/i$/.test(d)&&COMMON_VERBS[d.slice(0,-1)+'re'])return true;   // suivi→suivre
    return false;}
  var _PLURAL_CUE={et:1,ni:1,ils:1,elles:1,qui:1,ceux:1,celles:1,lesquels:1,lesquelles:1};
  // évidence d'un sujet PLURIEL/coordonné/relatif à GAUCHE (garde ont→on), sans franchir de frontière de proposition. Miroir _plural_left.
  function _pluralLeft(T,i){var j=i-1;for(var k=0;k<7;k++){if(j<0)return false;var wj=deacc(T[j].toLowerCase());
    if(_PLURAL_CUE[wj]||cpl(T,j))return true;
    if(_SEG&&j<_SEG.bb.length&&_SEG.bb[j])return false;j--;}return false;}
  function rOn(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='on'&&lw!=='ont')return null;
    if(_SEG&&i<_SEG.hy.length&&_SEG.hy[i])return null;   // « avait-on », « peut-on » : trait d'union → pronom inversé
    var nx=i+1<T.length?T[i+1].toLowerCase():'';if(/e$/.test(nx)&&!/ée$/.test(nx)&&svReads(nx).length)return 'on';
    // TÊTE de proposition (i==0 ou frontière avant) : le sujet à GAUCHE est d'une AUTRE proposition — contexte gauche INVALIDE (FP WiCoPaCo « …données. On pouvait… »)
    var ci=(i===0)||(_SEG&&i<_SEG.bb.length&&_SEG.bb[i]);
    if(!ci){
      var p=cprev(T,i);var pr=i>0?deacc(T[i-1].toLowerCase()):'';var glued=(pr.indexOf("'")>=0)&&(/ils$/.test(pr)||/elles$/.test(pr));
      if(p==='ils'||p==='elles'||glued||cpl(T,i-1))return 'ont';
      if(i+1<T.length&&_isPpl(T[i+1]))return 'ont';
    }
    if(vlike(T,i+1)){
      if(lw==='ont'){
        if(_looksPpl(T[i+1]))return null;   // « ont conclu/suivi/déduit/orchestré » = avoir 3pl + participe, jamais « on » (FP WiCoPaCo)
        if(_pluralLeft(T,i))return null;    // sujet pluriel coordonné/relatif (« l'état et le gouvernement ont », « …qui…ont ») → « ont » correct (FP WiCoPaCo)
      }
      return 'on';
    }
    return null;}
  var INVAR_NOUN={pays:1,temps:1,prix:1,poids:1,corps:1,fois:1,mois:1,cas:1,bras:1,dos:1,nez:1,choix:1,voix:1,croix:1,bois:1,univers:1,succes:1,progres:1,repas:1,avis:1,sens:1,cours:1,concours:1,discours:1,jus:1,tas:1,os:1,puits:1,bus:1,virus:1,tennis:1,colis:1,devis:1,permis:1,compromis:1,paradis:1,velours:1,dais:1};
  var MAIS_STOP={pas:1,plus:1,moins:1,point:1,rien:1,tout:1,tres:1,jamais:1,surtout:1,aussi:1,encore:1,toujours:1,comment:1,pourquoi:1,peu:1,trop:1,bien:1,non:1,oui:1,si:1,assez:1,enfin:1,donc:1,car:1,alors:1,ici:1,la:1};
  var DET_SKIP={plus:1,moins:1,tres:1,bien:1,trop:1,assez:1,aussi:1,si:1,autre:1,autres:1,meme:1,propre:1,seul:1,seule:1,tel:1,telle:1,certain:1,certaine:1,tout:1,toute:1,grand:1,grande:1,petit:1,petite:1,gros:1,grosse:1,beau:1,bel:1,belle:1,bon:1,bonne:1,nouveau:1,nouvel:1,nouvelle:1,premier:1,premiere:1,dernier:1,derniere:1,jeune:1,vieux:1,vieil:1,vieille:1,long:1,longue:1,large:1,simple:1,super:1,superbe:1,primaire:1,double:1,triple:1,sous:1,pour:1,contre:1,par:1,sans:1,avec:1,entre:1,vers:1,mi:1,demi:1,semi:1,pseudo:1,quasi:1,ex:1,porte:1,montre:1,des:1,les:1,de:1,le:1};
  function rLeur(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='leur'&&lw!=='leurs')return null;if(i+1>=T.length)return null;if(vlike(T,i+1))return 'leur';var dn=deacc(T[i+1].toLowerCase());if(INVAR_NOUN[dn])return 'leur';return /[sx]$/.test(dn)?'leurs':'leur';}
  var _PP_NOUN_HOMO={mort:1,fait:1,part:1,point:1};   // noms homographes d'un participe → « à » PRÉPOSITION (condamnée à mort, tout à fait, à part, à point) ; le tagger tranche NOM vs VERB
  function _aaInverted(T,i){if(i-2<0)return false;var hy=(_SEG&&_SEG.hy)?_SEG.hy:[];return vlike(T,i-2)||(i-1<hy.length&&hy[i-1]);}   // pronom sujet en i-1 INVERSÉ (« avait-il à cela ») → pas un sujet PRÉVERBAL de « a » (FP à→a)
  function rA(T,i){if(deacc(T[i].toLowerCase())!=='a')return null;if(T[i]===T[i].toUpperCase()&&T[i]!==T[i].toLowerCase())return null;
    var pb=(_SEG&&i<_SEG.bb.length)?_SEG.bb[i]:false;var tg=posTags(T);var p=cprev(T,i);   // POS PLEINE-PHRASE : sépare les FAUX participes (nom homographe / -ment nominal) du vrai participe → tue les FP à→a par élimination
    if(!pb&&(p==='il'||p==='elle'||p==='on'||p==='qui'||p==='ca'||p==='c')&&!_aaInverted(T,i))return 'a';   // sujet 3sg net (pas à travers une virgule, pas inversé « avait-il ») → avoir
    if(i+1<T.length&&_isPpl(T[i+1])&&!/ee$/.test(deacc(T[i+1].toLowerCase()))){var dn=deacc(T[i+1].toLowerCase()),nt=(tg&&i+1<tg.length)?tg[i+1]:'';if(!(_PP_NOUN_HOMO[dn]&&nt==='NOUN'))return 'a';}   // « a + participe » → AVOIR, jamais « à ». Écarte -ée FÉMININ (« à durée » reste prép) ET le nom-homographe tagué NOM (« condamnée à mort », « tout à fait »)
    if(i+2<T.length&&/ment$/.test(deacc(T[i+1].toLowerCase()))&&(tg&&i+1<tg.length&&tg[i+1]==='ADV')&&_isPpl(T[i+2]))return 'a';   // « a + ADVERBE(-ment) RÉEL + participe » ; exige POS=ADV → exclut « à l'emplacement », « à l'effondrement » (NOM en -ment)
    if(!pb&&vlike(T,i-1)){var pv=i>0&&NOUN_POST?NOUN_POST.get(deacc(T[i-1].toLowerCase())):null;if(pv&&pv[0]>=PL_TAU_M&&pv[1]<PL_EPS_M)return null;return 'à';}return null;}
  function rEt(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='et'&&lw!=='est')return null;
    if(_SEG&&i<_SEG.bb.length&&_SEG.bb[i])return null;   // frontière avant (« elle, et … ») → pas de sujet net
    var p=cprev(T,i);if(!(p==='il'||p==='elle'||p==='on'||p==='c'||p==='ce'||p==='ca'||p==='qui'))return null;
    if(i+1<T.length){var _na=deacc(T[i+1].toLowerCase());if(_na==='il'||_na==='elle'||_na==='on'||_na==='ils'||_na==='elles'||_na==='je'||_na==='tu'||_na==='nous'||_na==='vous'||_na==='moi'||_na==='toi'||_na==='lui'||_na==='eux'||_na==='soi')return null;}   // « il et elle », « lui et moi » : pronom sujet après « et » → sujet COORDONNÉ, jamais « est » (« il est elle » agrammatical)
    if(i+1<T.length){var c0=T[i+1].charAt(0);if(c0!==c0.toLowerCase()&&c0===c0.toUpperCase())return null;}   // « et Bob », « et Chris » → nom propre → conjonction
    if(i+1<T.length&&(isParticiple(T,i+1)||!(T[i+1].toLowerCase() in NUM_DET)))return 'est';return null;}
  function rPeu(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='peu'&&lw!=='peux'&&lw!=='peut')return null;var p=cprev(T,i);if(p==='je'||p==='tu')return 'peux';if(p==='il'||p==='elle'||p==='on'||p==='qui')return 'peut';if(p==='un'||p==='de'||p==='tres'||p==='si'||p==='trop'||p==='assez'||p==='bien'||p==='plus'||p==='tout'||p==='aussi'||p==='y')return 'peu';return null;}
  // « ke/ge/ce/se + suis/serai/serais/fus » : sujet de 1re pers. mal écrit devant ÊTRE 1sg à initiale CONSONNE. Séquence
  // IMPOSSIBLE en français → FP=0 STRUCTUREL (0/2500+14450 UD). me/te/le exclus (« je me suis ») ; voyelle ai/étais → 2e temps.
  function rJeSubject(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='ke'&&lw!=='ge'&&lw!=='ce'&&lw!=='se')return null;if(i+1>=T.length)return null;var nd=deacc(T[i+1].toLowerCase());if(nd==='suis'||nd==='serai'||nd==='serais'||nd==='fus')return ckeepcase(T[i],'je');return null;}
  function rCe(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='ce'&&lw!=='se')return null;if(i+1>=T.length)return null;var nd=deacc(T[i+1].toLowerCase());
    if(nd==='qui'||nd==='que'||nd==='dont'||nd==='qu'||nd==="qu'")return 'ce';   // ce qui/que/dont (+ élidé qu')
    if(CAUX[nd]||nd==='sont'||nd==='est')return null;
    if(CLITIC[nd])return null;                                                   // clitique/ne → se pronominal / ce impersonnel → abstention
    if(NUM_DET[nd])return null;                                                  // ce/se + déterminant → abstention
    if(/ant$/.test(nd)&&nd.length>4)return null;                                 // participe présent → se réfléchi
    var isv=vlike(T,i+1),isn=!!GENDER_MAP[nd];
    if(isv&&!isn)return 'se';
    var tg=posTags(T);if(!tg||i+1>=tg.length)return (isn&&!isv)?'ce':null;       // sans tagger : repli nom-pur → ce
    if(isn&&!isv&&tg[i+1]!=='VERB'&&tg[i+1]!=='AUX')return 'ce';                 // nom PUR confirmé (pas verbe au tagger) → ce ; sinon (« il se document[e] ») → ne pas forcer « ce »
    if(lw==='se')return (tg[i+1]==='NOUN')?'ce':null;                            // se + NOM → ce
    if((tg[i+1]==='VERB'||tg[i+1]==='AUX')){var p=cprev(T,i);if(p==='il'||p==='elle'||p==='on'||p==='je'||p==='tu'||p==='ils'||p==='elles'||p==='qui')return 'se';}   // ce + VERBE + SUJET pronom → se (sinon ce impersonnel)
    return null;}
  // « je/tu + c'est/ces/ses/sait » → « sais » (savoir) : suites IMPOSSIBLES en français correct → FP=0 (0/16951 UD). « il/on c'est » reste ambigu → non couvert. Miroir app.
  function rSais(T,i){var d=deacc(T[i].toLowerCase());if(d!=="c'est"&&d!=='ces'&&d!=='ses'&&d!=='sait')return null;if(_SEG&&i<_SEG.bb.length&&_SEG.bb[i])return null;var p=cprev(T,i);return (p==='je'||p==='tu')?ckeepcase(T[i],'sais'):null;}
  function rCestSest(T,i){if(deacc(T[i].toLowerCase())!=="c'est")return null;if(_SEG&&i<_SEG.bb.length&&_SEG.bb[i])return null;var p=cprev(T,i);if(!(p==='il'||p==='elle'||p==='on'))return null;var j=i+1;while(j<T.length&&j<=i+3&&PPMID[deacc(T[j].toLowerCase())])j++;if(j<T.length&&_isPpl(T[j])){var c=T[i].charAt(0);return c!==c.toLowerCase()?"S'est":"s'est";}return null;}   // [il/elle/on]+c'est(+adverbe)+participe → s'est (« elle c'est bien amusée »). FP=0.
  var _SA_NONNOUN={je:1,tu:1,il:1,elle:1,on:1,ils:1,elles:1,nous:1,vous:1,y:1,en:1,ne:1};   // ne peuvent jamais suivre le possessif « sa »
  function rCaSa(T,i){var lw=deacc(T[i].toLowerCase());   // ça↔sa. sa+clitique→ça (un clitique n'est pas un nom) ; ça+NOM confiant→sa/son (ça ne précède jamais un nom nu). FP=0 (garde nom stricte P(NOM)≥τ∧P(VER)<ε). « sa va » non couvert.
    if(lw==='sa'){if(T[i]===T[i].toUpperCase()&&T[i]!==T[i].toLowerCase())return null;if(i+1<T.length){var _nt=T[i+1].toLowerCase(),_nd=deacc(_nt);if(CLITIC[_nd]||_SA_NONNOUN[_nd]||_nt.indexOf("'")>=0)return ckeepcase(T[i],'ça');}return null;}
    if(lw==='ca'){
      if(T[i]===T[i].toUpperCase()&&T[i]!==T[i].toLowerCase())return null;   // « CA » sigle → abstention
      if(i+1>=T.length)return null;
      if(_SEG&&(i+1)<_SEG.bb.length&&_SEG.bb[i+1])return null;   // frontière « ça, X » → abstention
      if(T[i+1].toLowerCase().indexOf("'")>=0)return null;
      var nd=deacc(T[i+1].toLowerCase()),pp=NOUN_POST&&NOUN_POST.get(nd);
      if(!(pp&&pp[0]>=PL_TAU_M&&pp[1]<PL_EPS_M))return null;   // NOM confiant ET pas verbe-homographe (« ça marche »=verbe)
      if('aeiouyh'.indexOf(T[i+1].charAt(0).toLowerCase())>=0)return ckeepcase(T[i],'son');   // voyelle/h → son
      var g=GENDER_PURE[nd];if(g==='f')return ckeepcase(T[i],'sa');if(g==='m')return ckeepcase(T[i],'son');return null;}
    return null;}
  var MET_LEFT_SUBJ={il:1,elle:1,on:1,ce:1,ca:1,qui:1,celui:1,celle:1,chacun:1,nul:1,quiconque:1};var MET_RIGHT_CLAUSE={je:1,tu:1,il:1,elle:1,on:1,nous:1,vous:1,ils:1,elles:1,ce:1,ca:1,"j'ai":1,"j'avais":1,"j'aurai":1,"j'aurais":1};function rMetMais(T,i){var d=deacc(T[i].toLowerCase());if(d==='met'){if(T[i].charAt(0)!==T[i].charAt(0).toLowerCase()||i===0)return null;var pm=cprev(T,i);if(pm==null||MET_LEFT_SUBJ[pm]||CLITIC[pm])return null;var tgm=posTags(T);if(tgm&&i-1<tgm.length&&(tgm[i-1]==='NOUN'||tgm[i-1]==='PROPN'||tgm[i-1]==='DET'||tgm[i-1]==='NUM'))return null;if(T[i-1].charAt(0)!==T[i-1].charAt(0).toLowerCase())return null;var nn=(i+1<T.length?deacc(T[i+1].toLowerCase()):null);if(nn&&MET_RIGHT_CLAUSE[nn])return ckeepcase(T[i],'mais');return null;}if(d!=='mais')return null;if(_SEG&&i<_SEG.bb.length&&_SEG.bb[i])return null;var p=cprev(T,i);if(p==='je'||p==='tu')return 'mets';if(p==='il'||p==='on')return 'met';if(p==='ils')return 'mettent';return null;}   // je/tu/il/on/ils = clitiques sujets PURS (jamais objet de prép) + « mais » → forme de METTRE. FP=0. elle/elles exclus (pronom disjoint : « derrière elle mais… »).
  function rMais(T,i){if(deacc(T[i].toLowerCase())!=='mais'||i+1>=T.length)return null;
    if(i===0||(_SEG&&i<_SEG.ss.length&&_SEG.ss[i]))return null;   // « Mais … » en tête de phrase = conjonction, jamais « mes »
    var nx=T[i+1].toLowerCase(),dn=deacc(nx);
    if(MAIS_STOP[dn])return null;   // adverbe/mot-outil homographe d'un nom (« mais pas »/« mais comment ») → conjonction, pas « mes »
    if(PREP[dn]||NUM_DET[nx]||NUM_PRON[dn]||vlike(T,i+1))return null;
    return (_nounGate(dn)&&(/s$/.test(dn)||/x$/.test(dn)))?ckeepcase(T[i],'mes'):null;}   // NOM (posterior §3 `_nounGate`, pas GENDER_PURE brut) ET PLURIEL : « mes » possessif PLURIEL → « mes attention »/« mes budget » (sg) agrammatical (FP « raffinée mais attention »→mes) ; vrais catches pluriels (mes lunettes/parents/yeux)
  // « du » (=de+le) + ARTICLE (la/l') = impossible → « de » (« du la ferme »→de la). FP=0 (scan UD). Faute dys du/de.
  function rDuDe(T,i){if(deacc(T[i].toLowerCase())!=='du'||i+1>=T.length)return null;var nl=T[i+1].toLowerCase();return (nl==='la'||nl.indexOf("l'")===0||nl.indexOf('l’')===0)?ckeepcase(T[i],'de'):null;}
  function rDuDu(T,i){if(deacc(T[i].toLowerCase())!=='du'||T[i].toLowerCase().indexOf("'")>=0||i+1>=T.length)return null;if(!_isInfinitive(T[i+1]))return null;for(var k=i-1;k>=0&&k>i-4;k--){var tk=T[k].toLowerCase(),dk=deacc(tk);if(AVOIR_AUX[dk]||AVOIR_JE[tk])return ckeepcase(T[i],'dû');if(PPMID[dk])continue;return null;}return null;}   // « avoir + du + INFINITIF » → dû (participe de devoir) ; partitif du+NOM intact ⇒ FP=0
  var _ETRE_SUR={est:1,es:1,suis:1,sommes:1,etes:1,sont:1,etais:1,etait:1,etions:1,etiez:1,etaient:1,sera:1,serai:1,seras:1,serait:1,serais:1,soit:1};
  function rSurSur(T,i){if(deacc(T[i].toLowerCase())!=='sur'||T[i].toLowerCase().indexOf("'")>=0)return null;var p=cprev(T,i);if(!_ETRE_SUR[p]&&p!=='bien')return null;var n=(i+1<T.length?deacc(T[i+1].toLowerCase()):null);if(n==='de'||n==="d'"||n==='que'||n==="qu'"||n==null)return ckeepcase(T[i],'sûr');if(_SEG&&i+1<_SEG.bb.length&&_SEG.bb[i+1])return ckeepcase(T[i],'sûr');return null;}   // « être/bien + sur + de/que/fin » → sûr (adjectif) ; prép « sur »+GN intacte ⇒ FP=0
  function rLaLa(T,i){if(deacc(T[i].toLowerCase())!=='la'||T[i].toLowerCase().indexOf("'")>=0)return null;if(!_ETRE_SUR[cprev(T,i)])return null;var n=(i+1<T.length?deacc(T[i+1].toLowerCase()):null);if(n==null||(_SEG&&i+1<_SEG.bb.length&&_SEG.bb[i+1]))return ckeepcase(T[i],'là');return null;}   // « être + la + fin de proposition » → là (adverbe) ; article « la »+nom intact ⇒ FP=0
  var CADJ={content:1,contente:1,contents:1,contentes:1,malade:1,malades:1,triste:1,tristes:1,heureux:1,heureuse:1,heureuses:1,pret:1,prete:1,prets:1,pretes:1,libre:1,libres:1,seul:1,seule:1,seuls:1,seules:1,fier:1,fiere:1,fiers:1,fieres:1};   // adj prédicatifs purs (liste CLOSE = parité 3 moteurs)
  var ETRE_PP={alle:1,allee:1,alles:1,allees:1,venu:1,venue:1,venus:1,venues:1,parti:1,partie:1,partis:1,parties:1,arrive:1,arrivee:1,arrives:1,arrivees:1,devenu:1,devenue:1,devenus:1,devenues:1,revenu:1,revenue:1,revenus:1,revenues:1};   // participes de verbes d'ÊTRE (liste CLOSE)
  var PART_ART={le:1,la:1,"l'":1,les:1,un:1,une:1};   // article après « de » → partitif avoir
  function rJest(T,i){if(deacc(T[i].toLowerCase())!=="j'est"||i+1>=T.length)return null;   // « j'est » jamais valide → FP=0 structurel
    var nl=T[i+1].toLowerCase(),dn=deacc(nl);
    if(NUM_DET[nl]||dn==='ete'||dn==='eu'||dn==='du'||dn==='des')return ckeepcase(T[i],"j'ai");   // déterminant / été-eu / partitif du-des → j'ai
    if(nl==="de"||nl==="d'"){var _n2=i+2<T.length?T[i+2]:'',_c0=_n2[0]||'';if(PART_ART[_n2.toLowerCase()]||(_c0&&_c0.toLowerCase()!==_c0.toUpperCase()&&_c0===_c0.toLowerCase()))return ckeepcase(T[i],"j'ai");return null;}   // possession → j'ai (de la peine / de tomates=nom commun) ; « de Paris » (nom propre) = origine « je suis de… » → abstention
    if(CADJ[dn]||ETRE_PP[dn])return ckeepcase(T[i],"je suis");   // adjectif pur ou participe d'être → je suis
    if(_isPpl(T[i+1]))return ckeepcase(T[i],"j'ai");   // participe d'AVOIR (pris/mangé/vu…) → j'ai (ceux d'être sont déjà traités)
    return null;}   // sinon (de+nom propre…) → abstention
  function rCai(T,i){return deacc(T[i].toLowerCase())==="c'ai"?ckeepcase(T[i],"c'est"):null;}   // « c'ai » jamais valide (avoir au lieu d'être) → c'est
  // Élision fautive DEVANT CONSONNE → de-élide (FP=0 structurel : élidé valide seulement devant voyelle). Clitiques
  // DÉTERMINISTES (j'/n'/m'/d'/c'/qu') = parité triviale (aucun lexique) ; t'/s'/l'/h/y exclus (ambigus / h muet « l'homme »). Miroir correcteur_probe.rule_elide.
  var ELIDE={"j'":"je","n'":"ne","m'":"me","d'":"de","c'":"ce","qu'":"que"},ECONS="bcdfgjklmnpqrstvwxz",ELIDE_STOP={"n'roll":1,"m'sieur":1};
  function rElide(T,i){var w=T[i],lw=w.toLowerCase();if(ELIDE_STOP[lw])return null;for(var pre in ELIDE){if(lw.indexOf(pre)===0){var rest=w.slice(pre.length),c0=rest.charAt(0);if(rest&&c0===c0.toLowerCase()&&c0!==c0.toUpperCase()&&ECONS.indexOf(deacc(c0.toLowerCase()))>=0)return ckeepcase(w,ELIDE[pre]+' '+rest);return null;}}return null;}
  var SUBJ_PRON={je:['1','s'],tu:['2','s'],il:['3','s'],elle:['3','s'],on:['3','s'],ils:['3','p'],elles:['3','p']};
  var CLITIC={};['ne','me','te','se','le','la','les','lui','leur','y','en','nous','vous',"l'","m'","t'","s'","n'"].forEach(function(w){CLITIC[w]=1;});
  function svReads(w){var s=CONJ_F[deacc(w.toLowerCase())];if(!s)return[];var r=[],a=s.split('|'),k,f;for(k=0;k<a.length;k++){f=a[k].split(';');if(f.length===4)r.push(f);}return r;}
  function _fillReg3pl(cjc,cjf){var _REG3PL=[['ind:imp','ait','aient'],['cnd:pre','ait','aient'],['ind:fut','ra','ront']];for(var lem in cjc){for(var t=0;t<_REG3PL.length;t++){var mt=_REG3PL[t][0],s3=_REG3PL[t][1],p3=_REG3PL[t][2],slot=cjc[lem][mt];if(!slot)continue;var f3s=slot['3s'];if(Array.isArray(f3s))f3s=f3s[0];if(!f3s||slot['3p']||f3s.slice(-s3.length)!==s3)continue;var f3p=f3s.slice(0,-s3.length)+p3;slot['3p']=f3p;var key=deacc(f3p.toLowerCase()),rd=lem+';'+mt+';3;p',cur=cjf[key];if(!cur)cjf[key]=rd;else if(cur.indexOf(rd)<0)cjf[key]=cur+'|'+rd;}}}   // CLÔTURE 3PL RÉGULIÈRE déterministe (imparfait/conditionnel -ait→-aient · futur -ra→-ront, 0 exception) : build_cgram droppe l'imparfait 3pl + cnd/fut partiels (filtre HF). Miroir Python + app.
  function svSubject(T,i){var j=i-1,st=0;while(j>=0&&st<3&&CLITIC[deacc(T[j].toLowerCase())]){j--;st++;}if(j<0)return null;if(_SEG){for(var m=j+1;m<=i&&m<_SEG.bb.length;m++)if(_SEG.bb[m])return null;}return SUBJ_PRON[deacc(T[j].toLowerCase())]||null;}
  function svAgrees(reads,per,nb){var k;if(per==='3'){for(k=0;k<reads.length;k++)if(reads[k][2]===per&&(reads[k][3]===nb||reads[k][3]==='x'))return true;return false;}for(k=0;k<reads.length;k++)if(reads[k][2]===per)return true;return false;}
  var _V3PL_SURE={sont:1,ont:1,vont:1,font:1};   // 3e pluriel irréguliers non ambigus
  function rAccordSV(T,i){if(T[i].toLowerCase().indexOf("'")>=0)return null;if(/(é|és|ée|ées)$/.test(T[i].toLowerCase()))return null;var reads=svReads(T[i]);if(!reads.length)return null;var pn=svSubject(T,i);if(!pn)return null;var per=pn[0],nb=pn[1];
    if(per==='3'&&nb==='s'&&_V3PL_SURE[deacc(T[i].toLowerCase())]){var _pp=i>0?deacc(T[i-1].toLowerCase()):'';if((_pp==='ne'||_pp==='n')&&i>1)_pp=deacc(T[i-2].toLowerCase());if(_pp==='il'||_pp==='elle')return null;}   // « il/elle » + verbe SÛR 3pl → rIlIls fixe le pronom (pas le verbe)
    if(deacc(T[i].toLowerCase())==='peut'&&i+1<T.length&&deacc(T[i+1].toLowerCase())==='etre')return null;
    if(svAgrees(reads,per,nb))return null;
    if((i>=1&&FULL_AUX[deacc(T[i-1].toLowerCase())])||(i>=2&&FULL_AUX[deacc(T[i-2].toLowerCase())]))return null;   // temps composé/passif (aux+participe) → T[i]=participe, pas un verbe fini à accorder
    var lem=null,k,mts={},uni=true;for(k=0;k<reads.length;k++){if(lem===null)lem=reads[k][0];else if(lem!==reads[k][0])uni=false;mts[reads[k][1]]=1;}
    if(!uni||lem===null)return null;var mt=mts['ind:pre']?'ind:pre':reads[0][1];if(mt==='ind:pas')return null;var slots=(CONJ_C[lem]||{})[mt];if(!slots)return null;var sugg=slots[per+nb];if(!sugg)return null;
    if(!svAgrees(svReads(sugg),per,nb))return null;return sugg;}
  function rIlIls(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='il'&&lw!=='elle')return null;   // AUDIBILITÉ sur le SUJET : « il/elle » + verbe SÛR 3pl → « s » de ils/elles muet (lâché par le dys), verbe audible fiable → corriger le PRONOM. « il sont »→« ils sont ». FP=0. Miroir Python/app.
    if(i>0&&(['et','ou','ni'].indexOf(deacc(T[i-1].toLowerCase()))>=0||T[i-1].indexOf(',')>=0))return null;   // sujet coordonné → pluriel déjà correct
    var j=i+1;if(j<T.length&&(deacc(T[j].toLowerCase())==='ne'||deacc(T[j].toLowerCase())==='n'))j++;
    if(j>=T.length||!_V3PL_SURE[deacc(T[j].toLowerCase())])return null;
    return ckeepcase(T[i],lw==='il'?'ils':'elles');}
  // « le pronom PLURIEL est révélateur » (Rem) : ils/elles + verbe mal conjugué ABSENT du lexique (« elles sente ») →
  // radical+ent = forme 3p confirmée → on corrige. FP=0 (cf. correcteur_probe.rule_accord_sv_recover).
  function rAccordSVrecover(T,i){if(T[i].toLowerCase().indexOf("'")>=0)return null;if(/(é|és|ée|ées)$/.test(T[i].toLowerCase()))return null;
    var dw=deacc(T[i].toLowerCase());if(dw.length<4||svReads(T[i]).length)return null;
    var pn=svSubject(T,i);if(!pn||pn[0]!=='3'||pn[1]!=='p')return null;
    if((i>=1&&FULL_AUX[deacc(T[i-1].toLowerCase())])||(i>=2&&FULL_AUX[deacc(T[i-2].toLowerCase())]))return null;
    var bases=[];if(/es$/.test(dw))bases.push(dw.slice(0,-2));if(/e$/.test(dw))bases.push(dw.slice(0,-1));
    for(var b=0;b<bases.length;b++){var cand=bases[b]+'ent';if(cand===dw)continue;var r=svReads(cand),lems={},n=0,k;
      for(k=0;k<r.length;k++)if(r[k][2]==='3'&&r[k][3]==='p'&&!lems[r[k][0]]){lems[r[k][0]]=1;n++;}   // n=='p' STRICT : -ent≠pluriel (vient/tient=3sg ; famille venir corrompue dans Lexique) → 0 mauvaise correction
      if(n===1)return ckeepcase(T[i],cand);}
    return null;}
  var CONJ_WORDS={};('et ou ni mais car donc or que qu qui quand comme si lorsque puisque dont lequel laquelle lesquels lesquelles').split(' ').forEach(function(w){CONJ_WORDS[w]=1;});
  // accord sujet-VERBE à sujet NOM via le VRAI PARSEUR _npSubject (sujet ÉLOIGNÉ, mots-écrans « de X ») — MIROIR correcteur_probe.rule_accord_sv_noun, FP=0
  var _POST_PL={};'les des ces mes tes ses nos vos leurs plusieurs quelques certains certaines divers diverses maints maintes deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize vingt trente quarante cinquante soixante cent cents mille'.split(' ').forEach(function(w){_POST_PL[w]=1;});   // déterminants pluriels ouvrant un sujet postposé (set explicite partagé mot-à-mot Py/app/ext)
  var _UNACC={};'arriver venir revenir rester demeurer exister subsister survenir surgir apparaitre disparaitre naitre tomber entrer sortir partir passer figurer suivre resulter decouler compter regner circuler'.split(' ').forEach(function(w){_UNACC[w]=1;});
  var _INV_WH={};'que qu ou combien comment quand pourquoi quel quelle quels quelles'.split(' ').forEach(function(w){_INV_WH[w]=1;});
  var _INV_ADV={};'ainsi ici la alors ensuite aussi puis enfin bientot partout dedans dehors dessus dessous'.split(' ').forEach(function(w){_INV_ADV[w]=1;});
  function _postposePlural(T,tg,k,hi){if(k>=hi)return false;var d0=deacc(T[k].toLowerCase()),num=null;if(_POST_PL[d0])num=true;else if(NUM_DET[T[k].toLowerCase()]!==undefined)num=(NUM_DET[T[k].toLowerCase()]==='pl');else return false;if(!num)return false;for(var m=k+1;m<Math.min(hi,k+5);m++){if(m<tg.length&&(tg[m]==='NOUN'||tg[m]==='PROPN'))return true;if(PREP[deacc(T[m].toLowerCase())])return false;}return false;}
  // Filet homographe PARTAGÉ (miroir Python _verb_or_homograph) : T[i] est-il un VERBE en contexte pour les règles
  // d'accord SV ? VERB/AUX net, OU forme finie ratée par l'émission HMM (~2 % des formes) — connue (svReads) mais NI nom
  // (GENDER_MAP) NI adj (ADJP) NI préposition (PREP), et pas précédée d'un dét/prép. Homographes-noms (gêne/reste) → false.
  function _verbOrHomograph(tg,T,i){if(i>=tg.length)return false;if(tg[i]==='VERB'||tg[i]==='AUX')return true;
    var d=deacc(T[i].toLowerCase());if(GENDER_MAP[d]||ADJP[d]||PREP[d])return false;
    if(i>0&&(NUM_DET[T[i-1].toLowerCase()]||PREP[deacc(T[i-1].toLowerCase())]))return false;return svReads(T[i]).length>0;}
  function rPostpose(T,i){var lw=T[i].toLowerCase();if(lw.indexOf("'")>=0||lw==='à')return null;   // accord SUJET-VERBE à sujet POSTPOSÉ (inversion) : ordre changé → scan AVANT. FP=0 mesuré. Miroir Python rule_accord_postpose.
    if(/(é|és|ée|ées)$/.test(lw))return null;
    if(i>0&&NUM_DET[T[i-1].toLowerCase()]!==undefined)return null;
    if(i>0&&PREP[deacc(T[i-1].toLowerCase())])return null;
    if((i>=1&&FULL_AUX[deacc(T[i-1].toLowerCase())])||(i>=2&&FULL_AUX[deacc(T[i-2].toLowerCase())]))return null;
    if(svSubject(T,i)!=null)return null;
    var reads=svReads(T[i]),p3=[],k;for(k=0;k<reads.length;k++)if(reads[k][2]==='3')p3.push(reads[k]);if(!p3.length)return null;
    var hasS=false,hasPX=false;for(k=0;k<p3.length;k++){if(p3[k][3]==='s')hasS=true;if(p3[k][3]==='p'||p3[k][3]==='x')hasPX=true;}
    if(!hasS||hasPX)return null;
    var tg=posTags(T);if(!tg||!_verbOrHomograph(tg,T,i))return null;
    var lo=0,hi=T.length,j;
    if(_SEG){for(j=i;j>0;j--){if(j<_SEG.bb.length&&_SEG.bb[j]){lo=j;break;}}for(j=i+1;j<T.length;j++){if(j<_SEG.bb.length&&_SEG.bb[j]){hi=j;break;}}}
    if(_npSubject(T,tg,i)!=null)return null;
    for(k=lo;k<i;k++){var dk=deacc(T[k].toLowerCase());
      if(dk==='il'||dk==='ce'||dk==='c'||dk==='on'||dk==='ca'||dk==='cela'||dk==='ceci'||dk==='qui'||dk==='dont'||dk==='lequel'||dk==='laquelle'||dk==='lesquels'||dk==='lesquelles')return null;
      if(dk==='et'||dk==='ou'||dk==='ni')return null;
      if((dk==='l'||T[k].toLowerCase().slice(0,2)==="l'")&&(k===lo||!PREP[deacc(T[k-1].toLowerCase())]))return null;}
    var lem0=p3[0][0],ss=_SEG?_SEG.ss:null;
    if(!(lo===0||(ss&&lo<ss.length&&ss[lo])))return null;
    if(i===lo){if(!_UNACC[deacc(lem0)])return null;}
    else{var head=deacc(T[lo].toLowerCase());if(!(PREP[head]||_INV_WH[head]||_INV_WH[T[lo].toLowerCase()]||_INV_ADV[head]||(lo<tg.length&&tg[lo]==='ADV')||head==='comme'||head==='quand'||head==='lorsque'))return null;}
    k=i+1;while(k<hi&&k<tg.length&&(tg[k]==='ADV'||((tg[k]==='VERB'||tg[k]==='ADJ')&&/(é|és|ée|ées)$/.test(T[k].toLowerCase()))))k++;
    if(!_postposePlural(T,tg,k,hi))return null;
    var lemset={};for(k=0;k<p3.length;k++)lemset[p3[k][0]]=1;if(Object.keys(lemset).length!==1)return null;
    var lem=p3[0][0],mts={};for(k=0;k<p3.length;k++)mts[p3[k][1]]=1;var mt=mts['ind:pre']?'ind:pre':(mts['ind:imp']?'ind:imp':p3[0][1]);
    if(mt==='ind:pas')return null;
    var sugg=((CONJ_C[lem]||{})[mt]||{})['3p'];if(!sugg)return null;
    var sr=svReads(sugg),ok=false;for(k=0;k<sr.length;k++)if(sr[k][2]==='3'&&(sr[k][3]==='p'||sr[k][3]==='x'))ok=true;if(!ok)return null;
    return sugg;}
  function rAccordSVnoun(T,i,vig){var lw=T[i].toLowerCase();if(lw.indexOf("'")>=0||lw==='à')return null;
    if(deacc(lw)==='a'&&i+1<T.length){var _dn=deacc(T[i+1].toLowerCase());if(_dn==='la'||_dn==='le'||_dn==='les'||_dn.slice(0,2)==="l'")return null;}   // « a » + article défini (la/le/les/l') → préposition « à » trop plausible → a→ont s'abstient ; indéfini reste. Miroir Python/app.
    // vig=true : jumeau ORANGE (retire la garde clause-init) pour la vigilance sujet-verbe mid-phrase
    if(/(é|és|ée|ées)$/.test(lw))return null;                                  // participe → accord adjectival
    if(i>0&&NUM_DET[T[i-1].toLowerCase()])return null;                         // dét juste avant → T[i] = nom
    if(i>0&&PREP[deacc(T[i-1].toLowerCase())])return null;                     // verbe fini jamais gouverné par de/des/par/à… → nom homographe
    var di=deacc(lw);
    if(di==='peut'&&i+1<T.length&&deacc(T[i+1].toLowerCase())==='etre')return null;              // peut-être
    if((di==='est'||di==='ai')&&i>0&&/^(nord|sud|ouest)$/.test(deacc(T[i-1].toLowerCase())))return null;   // « nord-est » cardinal
    if(i>0&&/^\d+$/.test(T[i-1]))return null;                                  // désignation « 20 a »
    if(i>0){var pv=T[i-1];if(pv.length>=2&&pv===pv.toUpperCase()&&pv!==pv.toLowerCase())return null;}       // sigle « WR a »
    if(svSubject(T,i)!=null)return null;                                       // sujet pronom net → règle pronom
    var reads=svReads(T[i]),p3=[],k;for(k=0;k<reads.length;k++)if(reads[k][2]==='3')p3.push(reads[k]);if(!p3.length)return null;
    if((i>=1&&FULL_AUX[deacc(T[i-1].toLowerCase())])||(i>=2&&FULL_AUX[deacc(T[i-2].toLowerCase())]))return null;   // temps composé/passif
    var tg=posTags(T);if(!tg||!_verbOrHomograph(tg,T,i))return null;   // T[i]=verbe en contexte ; filet homographe PARTAGÉ (verbe raté par l'émission HMM), borné par les gardes structure ci-dessous
    var _vs=i;while(_vs-1>=0&&CLITIC[deacc(T[_vs-1].toLowerCase())])_vs--;var subj=_npSubject(T,tg,_vs);if(!subj)return null;var nb=subj.n,hk=subj.idx,dk=subj.det;   // sauter les clitiques objets avant le verbe (« nous parviendra ») pour atteindre le sujet
    var ddet=deacc(T[dk].toLowerCase());
    if(!NUM_DET[ddet]&&!_QUANT_PL[ddet]&&!_QUANT_SG[ddet])return null;         // déterminant sujet DOIT être connu (au/aux/du de PP, mistag → abstention)
    if(_COLL_HEAD[deacc(T[hk].toLowerCase())])return null;                     // nom collectif/quantité → accord complément → abstention
    var hc=T[hk].charAt(0);if(tg[hk]==='PROPN'||(hk>0&&hc===hc.toUpperCase()&&hc!==hc.toLowerCase()))return null;   // nom-tête propre/titre
    var lo=0,j;if(_SEG){for(j=i;j>0;j--){if(j<_SEG.bb.length&&_SEG.bb[j]){lo=j;break;}}}
    for(var m=lo;m<i;m++){var _lm=T[m].toLowerCase();if(_lm.indexOf("qu'")===0||_lm.indexOf("qu’")===0)return null;}   // RELATIVE ÉLIDÉE « qu' » → abstention (élision bénigne « de l'X »/clitique « m'/s' » tolérée ; que/qui/dont pleins gardés par CONJ_WORDS)
    if(!vig)for(m=lo;m<dk;m++){if(tg[m]!=='ADV')return null;}                   // sujet EN TÊTE de proposition (adverbes antéposés seulement) ; RETIRÉ en mode vig (orange couvre le mid-phrase)
    for(m=hk+1;m<i;m++){var tk=T[m],dw=deacc(tk.toLowerCase());                // garde structure nom-tête → verbe : compléments prépositionnels SEULEMENT
      if(CONJ_WORDS[dw])return null;                                           // coordination/relative
      if(/[,;:()\[\]«»"]/.test(tk))return null;                               // ponctuation
      if(/\d/.test(tk))return null;                                           // désignation alphanumérique
      if((tg[m]==='VERB'||tg[m]==='AUX')&&!(/(é|és|ée|ées)$/.test(T[m].toLowerCase())&&!(m>0&&tg[m-1]==='AUX')))return null;   // verbe FINI intercalé = sous-phrase → abstention ; participe-épithète (non précédé d'aux) toléré (miroir _npSubject)
      if(NUM_DET[tk.toLowerCase()]&&!PREP[dw]&&!(m>0&&PREP[deacc(T[m-1].toLowerCase())]))return null;}   // 2e GN non prépositionnel
    for(k=0;k<p3.length;k++)if(p3[k][3]===nb||p3[k][3]==='x')return null;      // déjà d'accord
    var lem=null,uni=true,mts={};for(k=0;k<p3.length;k++){if(lem===null)lem=p3[k][0];else if(lem!==p3[k][0])uni=false;mts[p3[k][1]]=1;}
    if(!uni||lem===null)return null;var mt=mts['ind:pre']?'ind:pre':p3[0][1];if(mt==='ind:pas'&&!vig)return null;var slots=(CONJ_C[lem]||{})[mt];if(!slots)return null;var sugg=slots['3'+nb];if(!sugg)return null;
    var sr=svReads(sugg),okk=false;for(k=0;k<sr.length;k++)if(sr[k][2]==='3'&&(sr[k][3]===nb||sr[k][3]==='x'))okk=true;if(!okk)return null;return sugg;}
  // accord sujet-VERBE en PERSONNE : verbe imparfait écrit en 1re/2e pers. sing. (-ais) sous sujet-NOM 3e pers. sing. → -ait.
  // Comble le trou de rAccordSVnoun (qui ne prend QUE p==3). -ais/-ait homophones. MIROIR correcteur_probe.rule_ais_ait, FP=0.
  function rAisAit(T,i){var lw=T[i].toLowerCase();if(lw.indexOf("'")>=0||!/ais$/.test(deacc(lw)))return null;
    var reads=svReads(T[i]),imp=[],has3=false,k;
    for(k=0;k<reads.length;k++){var rk=reads[k];if(rk[2]==='3')has3=true;if((rk[2]==='1'||rk[2]==='2')&&rk[3]==='s'&&rk[1].indexOf('imp')>=0&&rk[1].indexOf('ind')>=0)imp.push(rk);}
    if(!imp.length||has3)return null;
    if(svSubject(T,i)!=null)return null;
    if((i>=1&&FULL_AUX[deacc(T[i-1].toLowerCase())])||(i>=2&&FULL_AUX[deacc(T[i-2].toLowerCase())]))return null;
    var tg=posTags(T);if(!tg||!_verbOrHomograph(tg,T,i))return null;
    var subj=_npSubject(T,tg,i);if(!subj||subj.n!=='s')return null;
    var hk=subj.idx,dk=subj.det,ddet=deacc(T[dk].toLowerCase());
    if(!NUM_DET[ddet]&&!_QUANT_SG[ddet])return null;
    if(_COLL_HEAD[deacc(T[hk].toLowerCase())])return null;
    var hc=T[hk].charAt(0);if(tg[hk]==='PROPN'||(hk>0&&hc===hc.toUpperCase()&&hc!==hc.toLowerCase()))return null;
    var lo=0,j;if(_SEG){for(j=i;j>0;j--){if(j<_SEG.bb.length&&_SEG.bb[j]){lo=j;break;}}}
    for(var m=lo;m<i;m++){if(T[m].indexOf("'")>=0||T[m].indexOf('’')>=0)return null;}
    for(m=lo;m<dk;m++){if(tg[m]!=='ADV')return null;}
    for(m=hk+1;m<i;m++){var tkw=T[m],dw=deacc(tkw.toLowerCase());
      if(CONJ_WORDS[dw])return null;
      if(/[,;:()\[\]«»"]/.test(tkw))return null;
      if(tg[m]==='VERB'||tg[m]==='AUX')return null;
      if(NUM_DET[tkw.toLowerCase()]&&!PREP[dw]&&!(m>0&&PREP[deacc(T[m-1].toLowerCase())]))return null;}
    var lem=null,uni=true;for(k=0;k<imp.length;k++){if(lem===null)lem=imp[k][0];else if(lem!==imp[k][0])uni=false;}
    if(!uni||lem===null)return null;
    var slots=(CONJ_C[lem]||{})['ind:imp'];if(!slots)return null;var sugg=slots['3s'];if(!sugg||sugg===lw)return null;
    var sr2=svReads(sugg),ok2=false;for(k=0;k<sr2.length;k++)if(sr2[k][2]==='3'&&(sr2[k][3]==='s'||sr2[k][3]==='x'))ok2=true;if(!ok2)return null;return sugg;}
  // accord sujet-VERBE à sujet PRONOM/QUANTIFIEUR indéfini — MIROIR correcteur_probe.rule_accord_sv_quant, FP=0
  var _QP_SG={};'chacun chacune quiconque personne rien aucun aucune nul nulle'.split(' ').forEach(function(w){_QP_SG[w]=1;});_QP_SG["quelqu'un"]=1;
  var _DISTRIB_AMBIG={};'chacun chacune aucun aucune nul nulle'.split(' ').forEach(function(w){_DISTRIB_AMBIG[w]=1;});  // tolérance sing/plur « chacun/aucun/nul de(s)/d' + pluriel » (Grévisse) → abstention. PAS personne/rien (strict sing)
  var _QP_PL={};'certains certaines plusieurs tous toutes'.split(' ').forEach(function(w){_QP_PL[w]=1;});
  var _QP_DE_PL={};'plupart beaucoup peu bien tas tant nombre'.split(' ').forEach(function(w){_QP_DE_PL[w]=1;});
  var _QP_GAP_OK={entre:1,en:1};Object.keys(PREP).forEach(function(w){_QP_GAP_OK[w]=1;});
  function _svFinish(T,i,per,nb,p3){var k;for(k=0;k<p3.length;k++)if(p3[k][3]===nb||p3[k][3]==='x')return null;
    var lem=null,uni=true,mts={};for(k=0;k<p3.length;k++){if(lem===null)lem=p3[k][0];else if(lem!==p3[k][0])uni=false;mts[p3[k][1]]=1;}
    if(!uni||lem===null)return null;var mt=mts['ind:pre']?'ind:pre':p3[0][1];if(mt==='ind:pas')return null;var slots=(CONJ_C[lem]||{})[mt];if(!slots)return null;var sugg=slots[per+nb];if(!sugg)return null;
    var sr=svReads(sugg),okk=false;for(k=0;k<sr.length;k++)if(sr[k][2]===per&&(sr[k][3]===nb||sr[k][3]==='x'))okk=true;return okk?sugg:null;}
  function rAccordSVquant(T,i){var lw=T[i].toLowerCase();if(lw.indexOf("'")>=0||lw==='à')return null;
    if(/(é|és|ée|ées)$/.test(lw))return null;
    if(i>0&&PREP[deacc(T[i-1].toLowerCase())])return null;
    if(deacc(lw)==='peut'&&i+1<T.length&&deacc(T[i+1].toLowerCase())==='etre')return null;
    var reads=svReads(T[i]),p3=[],k;for(k=0;k<reads.length;k++)if(reads[k][2]==='3')p3.push(reads[k]);if(!p3.length)return null;
    if((i>=1&&FULL_AUX[deacc(T[i-1].toLowerCase())])||(i>=2&&FULL_AUX[deacc(T[i-2].toLowerCase())]))return null;
    var tg=posTags(T);if(!tg||!_verbOrHomograph(tg,T,i))return null;
    var lo=0,j;if(_SEG){for(j=i;j>0;j--){if(j<_SEG.bb.length&&_SEG.bb[j]){lo=j;break;}}}
    var q=deacc(T[lo].toLowerCase()),nxt=(lo+1<T.length)?deacc(T[lo+1].toLowerCase()):'',qend=lo,nb;
    if(_DISTRIB_AMBIG[q]&&(nxt==='de'||nxt==='des'||(lo+1<T.length&&/^d['’]/.test(T[lo+1].toLowerCase()))))return null;   // « chacun/aucun/nul de(s)/d' + pluriel » : sing OU plur admis → abstention (FP=0)
    if(_QP_SG[q])nb='s';
    else if(_QP_PL[q])nb='p';
    else if(_QP_DE_PL[q]){if(nxt==='de'||nxt==='des'||nxt==='d'||(lo+1<T.length&&T[lo+1].toLowerCase().indexOf("'")>=0&&nxt.charAt(0)==='d'))nb='p';else return null;}
    else if(q==='la'&&nxt==='plupart'){nb='p';qend=lo+1;}
    else if((q==='tout'||q==='toute')&&(nxt==='le'||nxt==='la')){nb='s';qend=lo+1;}
    else return null;
    var seenPrep=false;
    for(var m=qend+1;m<i;m++){var dm=deacc(T[m].toLowerCase()),tk=T[m].toLowerCase();
      if(CLITIC[dm]||dm==='ne'||dm==='n')continue;
      if(_QP_GAP_OK[dm]||(tk.indexOf("'")>=0&&dm.charAt(0)==='d')){seenPrep=true;continue;}
      if(seenPrep&&(NUM_DET[tk]||tg[m]==='DET'||tg[m]==='NOUN'||tg[m]==='PROPN'||tg[m]==='PRON'||tg[m]==='ADJ'||tg[m]==='NUM'))continue;
      return null;}
    return _svFinish(T,i,'3',nb,p3);}
  // accord sujet-VERBE dans une relative « QUI » — MIROIR correcteur_probe.rule_accord_sv_relatif, FP=0
  var _REL_ANT={moi:['1','s'],toi:['2','s'],lui:['3','s'],elle:['3','s'],soi:['3','s'],nous:['1','p'],vous:['2','p'],eux:['3','p'],elles:['3','p'],ce:['3','s'],celui:['3','s'],celle:['3','s'],ceux:['3','p'],celles:['3','p']};
  function rAccordSVrelatif(T,i){var lw=T[i].toLowerCase();if(lw.indexOf("'")>=0||lw==='à')return null;
    if(/(é|és|ée|ées)$/.test(lw))return null;
    var reads=svReads(T[i]);if(!reads.length)return null;
    var tg=posTags(T);if(!tg||!_verbOrHomograph(tg,T,i))return null;
    var j=i-1;while(j>=0&&(CLITIC[deacc(T[j].toLowerCase())]||deacc(T[j].toLowerCase())==='ne'||deacc(T[j].toLowerCase())==='n'))j--;
    if(j<0||deacc(T[j].toLowerCase())!=='qui')return null;
    var qk=j;if(qk===0)return null;
    var ant=deacc(T[qk-1].toLowerCase()),per,nb,k;
    if(_REL_ANT[ant]){per=_REL_ANT[ant][0];nb=_REL_ANT[ant][1];}
    else{per='3';var det=-1,noun=-1,lo=0,jj;if(_SEG){for(jj=qk;jj>0;jj--){if(jj<_SEG.bb.length&&_SEG.bb[jj]){lo=jj;break;}}}
      var m=qk-1;
      while(m>=lo){var dm=deacc(T[m].toLowerCase());
        if(T[m].toLowerCase().indexOf("'")>=0)return null;
        if(PREP[dm])return null;
        if(tg[m]==='DET'||NUM_DET[dm]||_QUANT_PL[dm]||_QUANT_SG[dm]){det=m;break;}
        if(tg[m]==='NOUN'||tg[m]==='PROPN'){noun=m;m--;continue;}
        if(tg[m]==='ADJ'||tg[m]==='ADV'||tg[m]==='NUM'){m--;continue;}
        return null;}
      if(det<0||noun<0)return null;
      if(tg[noun]==='PROPN'||(noun>0&&T[noun].charAt(0)!==T[noun].charAt(0).toLowerCase()))return null;   // antécédent PROPRE/TITRE (« la revue Les Facettes qui ») = nombre non fiable → abstention (même garde que rAccordSVnoun)
      var mm=det-1;while(mm>lo&&tg[mm]==='ADV')mm--;
      if(mm>=lo&&PREP[deacc(T[mm].toLowerCase())])return null;
      if(mm>=lo&&['et','ou','ni'].indexOf(deacc(T[mm].toLowerCase()))>=0)return null;
      var dd=deacc(T[det].toLowerCase());
      if(NUM_DET[dd])nb=NUM_DET[dd]==='pl'?'p':'s';else if(_QUANT_PL[dd])nb='p';else if(_QUANT_SG[dd])nb='s';else return null;}
    for(k=0;k<reads.length;k++)if(reads[k][2]===per&&(reads[k][3]===nb||reads[k][3]==='x'))return null;
    var lem=null,uni=true,mts={};for(k=0;k<reads.length;k++){if(lem===null)lem=reads[k][0];else if(lem!==reads[k][0])uni=false;mts[reads[k][1]]=1;}
    if(!uni||lem===null)return null;var mt=mts['ind:pre']?'ind:pre':reads[0][1];if(mt==='ind:pas')return null;var slots=(CONJ_C[lem]||{})[mt];if(!slots)return null;var sugg=slots[per+nb];if(!sugg)return null;
    var sr=svReads(sugg),okk=false;for(k=0;k<sr.length;k++)if(sr[k][2]===per&&(sr[k][3]===nb||sr[k][3]==='x'))okk=true;return okk?sugg:null;}
  // accord sujet-VERBE à sujets COORDONNÉS — MIROIR correcteur_probe.rule_accord_sv_coord, FP=0
  var _COORD_PRON={moi:'1',nous:'1',toi:'2',vous:'2',lui:'3',elle:'3',soi:'3',eux:'3',elles:'3'};
  function rAccordSVcoord(T,i){var lw=T[i].toLowerCase();if(lw.indexOf("'")>=0||lw==='à')return null;
    if(/(é|és|ée|ées)$/.test(lw))return null;
    if(i>0&&PREP[deacc(T[i-1].toLowerCase())])return null;
    if(deacc(lw)==='peut'&&i+1<T.length&&deacc(T[i+1].toLowerCase())==='etre')return null;
    var reads=svReads(T[i]);if(!reads.length)return null;
    var tg=posTags(T);if(!tg||!_verbOrHomograph(tg,T,i))return null;
    var lo=0,j;if(_SEG){for(j=i;j>0;j--){if(j<_SEG.bb.length&&_SEG.bb[j]){lo=j;break;}}}
    var conjuncts=[[]],hasSep=false,m;
    for(m=lo;m<i;m++){var dm=deacc(T[m].toLowerCase());
      if(dm==='et'||dm==='ni'){conjuncts.push([]);hasSep=true;continue;}
      if(dm==='ou'||dm==='mais'||dm==='car'||dm==='donc'||dm==='or'||dm==='que'||dm==='qu'||dm==='qui')return null;
      if(T[m].toLowerCase().indexOf("'")>=0)return null;
      if(tg[m]==='VERB'||tg[m]==='AUX'||PREP[dm])return null;
      conjuncts[conjuncts.length-1].push(m);}
    if(!hasSep||conjuncts.length<2)return null;
    var perRank=3,hasCommon=false,c,cj,q;
    for(c=0;c<conjuncts.length;c++){cj=conjuncts[c];if(!cj.length)return null;
      var first=deacc(T[cj[0]].toLowerCase());
      if(cj.length===1&&_COORD_PRON[first]){perRank=Math.min(perRank,parseInt(_COORD_PRON[first]));hasCommon=true;continue;}
      if(tg[cj[0]]==='DET'||NUM_DET[T[cj[0]].toLowerCase()]){var hasN=false;for(q=0;q<cj.length;q++)if(tg[cj[q]]==='NOUN'||tg[cj[q]]==='PROPN')hasN=true;if(!hasN)return null;hasCommon=true;continue;}
      if(tg[cj[0]]==='PROPN'){var allP=true;for(q=0;q<cj.length;q++)if(tg[cj[q]]!=='PROPN')allP=false;if(allP)continue;}
      return null;}
    if(!hasCommon)return null;
    var per=''+perRank,nb='p',k;
    for(k=0;k<reads.length;k++)if(reads[k][2]===per&&(reads[k][3]===nb||reads[k][3]==='x'))return null;
    var lem=null,uni=true,mts={};for(k=0;k<reads.length;k++){if(lem===null)lem=reads[k][0];else if(lem!==reads[k][0])uni=false;mts[reads[k][1]]=1;}
    if(!uni||lem===null)return null;var mt=mts['ind:pre']?'ind:pre':reads[0][1];if(mt==='ind:pas')return null;var slots=(CONJ_C[lem]||{})[mt];if(!slots)return null;var sugg=slots[per+nb];if(!sugg)return null;
    var sr=svReads(sugg),okk=false;for(k=0;k<sr.length;k++)if(sr[k][2]===per&&(sr[k][3]===nb||sr[k][3]==='x'))okk=true;return okk?sugg:null;}
  // accord sujet-VERBE à sujet INFINITIF — MIROIR correcteur_probe.rule_accord_sv_infinitif, FP=0
  function _isInfinitive(w){var d=deacc(w.toLowerCase());return !!COMMON_VERBS[d]&&(/er$/.test(d)||/ir$/.test(d)||/re$/.test(d)||/oir$/.test(d));}
  function rAccordSVinfinitif(T,i){var lw=T[i].toLowerCase();if(lw.indexOf("'")>=0||lw==='à')return null;
    if(/(é|és|ée|ées)$/.test(lw))return null;
    var reads=svReads(T[i]),hasP3=false,k;for(k=0;k<reads.length;k++)if(reads[k][2]==='3')hasP3=true;if(!hasP3)return null;
    if(i>0&&PREP[deacc(T[i-1].toLowerCase())])return null;
    var tg=posTags(T);if(!tg||!_verbOrHomograph(tg,T,i))return null;
    var lo=0,j;if(_SEG){for(j=i;j>0;j--){if(j<_SEG.bb.length&&_SEG.bb[j]){lo=j;break;}}}
    var s=lo;while(s<i&&tg[s]==='ADV')s++;
    if(s>=i||!_isInfinitive(T[s]))return null;
    var coordInf=false;
    for(var m=s+1;m<i;m++){var dm=deacc(T[m].toLowerCase());
      if((dm==='et'||dm==='ou')&&m+1<i&&_isInfinitive(T[m+1])){coordInf=true;continue;}
      if(T[m].toLowerCase().indexOf("'")>=0)return null;
      if(NUM_PRON[dm]||SUBJ_PRON[dm])return null;
      if(_isInfinitive(T[m]))continue;
      if(tg[m]==='VERB'||tg[m]==='AUX')return null;
      if(CONJ_WORDS[dm])return null;}
    var nb=coordInf?'p':'s';
    var reads3=[];for(k=0;k<reads.length;k++)if(reads[k][2]==='3')reads3.push(reads[k]);
    return _svFinish(T,i,'3',nb,reads3);}
  var DET_G={un:'m',une:'f',le:'m',la:'f',ce:'m',cet:'m',cette:'f',mon:'m',ma:'f',ton:'m',ta:'f',son:'m',sa:'f',quel:'m',quelle:'f'};
  var DET_A={'un|f':'une','une|m':'un','le|f':'la','la|m':'le','ce|f':'cette','cet|f':'cette','cette|m':'ce','mon|f':'ma','ma|m':'mon','ton|f':'ta','ta|m':'ton','son|f':'sa','sa|m':'son','quel|f':'quelle','quelle|m':'quel'};
  function ckeepcase(src,sg){var c=src.charAt(0);return (c!==c.toLowerCase())?sg.charAt(0).toUpperCase()+sg.slice(1):sg;}
  // GARDE du genre §3 : le NOM-test passe par _nounGate(NOUN_POST) — même posterior que le pluriel (l'ancien SET pos-abstain est supprimé).
  var _POSS_DET={mon:1,ma:1,ton:1,ta:1,son:1,sa:1},_ART_BLOCK={un:1,une:1,le:1,la:1,les:1,du:1,des:1,au:1,aux:1,ce:1,cet:1,cette:1,ces:1,mon:1,ma:1,mes:1,ton:1,ta:1,tes:1,son:1,sa:1,ses:1,notre:1,nos:1,votre:1,vos:1,leur:1,leurs:1};   // le français n'empile JAMAIS article + possessif
  function rDetGenre(T,i){var lw=deacc(T[i].toLowerCase());if(!DET_G[lw]||T[i].toLowerCase().indexOf("'")>=0)return null;if(i+1>=T.length)return null;
    if(_POSS_DET[lw]&&_ART_BLOCK[cprev(T,i)])return null;   // possessif précédé d'un article = NOM homographe (« un son », « le ton », « du son ») → jamais possessif → abstention (FP WiCoPaCo « un son stéréo »→sa)
    var gd=DET_G[lw],nr=T[i+1].toLowerCase();if(nr.indexOf("'")>=0)return null;var nd=deacc(nr);if(nd.length<2||!/^[a-z]+$/.test(nd))return null;
    if((lw==='son'||lw==='mon'||lw==='ton')&&/^[aeiouyh]/.test(nd))return null;   // son/mon/ton OBLIGATOIRES devant voyelle/h (son amie, son Histoire) — pas un FP
    var c0=T[i+1].charAt(0);if(c0!==c0.toLowerCase())return null;var hi=i+1;   // nom propre/étranger capitalisé → abstention (FP) ; hi = indice du NOM-TÊTE (défaut = mot suivant)
    var _pp=NOUN_POST&&NOUN_POST.get(nd);if((lw==='quel'||lw==='quelle')&&!(_pp&&_pp[0]>=PL_TAU_M)){var tgq=posTags(T);if(tgq&&i+2<T.length&&i+1<tgq.length&&tgq[i+1]==='ADJ'&&T[i+2].toLowerCase().indexOf("'")<0&&T[i+2].charAt(0)===T[i+2].charAt(0).toLowerCase()){hi=i+2;_pp=NOUN_POST&&NOUN_POST.get(deacc(T[hi].toLowerCase()));}}if(hi===i+1&&DET_SKIP[nd])return null;if(!(_pp&&_pp[0]>=PL_TAU_M))return null;   // « quel/quelle + ADJECTIF antéposé + nom » : saut d'un adjectif sûr → nom-tête. GARDE §3 genre RELAXÉE : NOM confiant (P(NOM)≥τ) ; garde verbe levée (sans toucher _nounGate, partagé pluriel) — mot après déterminant = NOM même si verbe-homographe (recall +6 pts, FP 0,09→0,10/1000, gender_levers_ud.py)
    var gn=GENDER_PURE[deacc(T[hi].toLowerCase())];if(gn!=='m'&&gn!=='f')return null;if(gn===gd)return null;var sg=DET_A[lw+'|'+gn];return sg?ckeepcase(T[i],sg):null;}
  var TOUT_EXTRA={avant:1,apres:1,'après':1,en:1,comme:1,selon:1,sauf:1,envers:1,durant:1,pendant:1,hormis:1,outre:1,moyennant:1,suivant:1,concernant:1};   // + PREP + NUM_DET : mots après lesquels « tout » n'est PAS un déterminant
  function rTout(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='tout'&&lw!=='toute')return null;if(i+2>=T.length)return null;   // tout/toute (SING.) + déterminant + nom → accord genre×nombre → tous/toutes/tout/toute. FP=0 (le quantifieur flottant est tjrs pluriel). Gardes prép/dét/idiome/frontière.
    var num=NUM_DET[deacc(T[i+1].toLowerCase())];if(!num)return null;
    if(_SEG&&(i+1)<_SEG.bb.length&&_SEG.bb[i+1])return null;
    var p=cprev(T,i);if(PREP[p]||NUM_DET[p]||TOUT_EXTRA[p])return null;
    if(T[i+2].toLowerCase().indexOf("'")>=0)return null;
    var nd=deacc(T[i+2].toLowerCase());var pp=NOUN_POST&&NOUN_POST.get(nd);if(!(pp&&pp[0]>=PL_TAU_M))return null;
    var g=GENDER_PURE[nd];if(g!=='m'&&g!=='f')return null;
    var target=(num==='pl')?(g==='m'?'tous':'toutes'):(g==='m'?'tout':'toute');
    return target!==lw?ckeepcase(T[i],target):null;}
  // accord PLURIEL du NOM — MÊME logique que correcteur_probe.rule_noun_plural (parité). GARDE §3 = posterior P(POS|forme) en ‰ (asset noun-post).
  var NOUN_POST=null;   // form_déacc -> [nom‰, ver‰] (depuis FreqMot du TSV) ; remplace nbhomog : tire ssi P(NOM)≥0.5 ∧ P(VER)<0.01
  var PL_TAU_M=500,PL_EPS_M=10,PL_ANCHOR_M=300;   // P(NOM)≥0.5 / P(VER)<0.01 / ancre 0.3 (mesuré ε=0.01 : +3 récup. ami/voiture/faute, +1 FP UD)
  function _applyNounPost(t){NOUN_POST=new Map();var L=t.split('\n');for(var i=0;i<L.length;i++){var p=L[i].split('\t');if(p.length>=3)NOUN_POST.set(p[0],[+p[1],+p[2]]);}}
  function loadNounPost(url){return (async function(){try{var gz=await (await fetch(url)).arrayBuffer();
    var st=new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'));
    _applyNounPost(await new Response(st).text());return true;}catch(e){return false;}})();}
  // ---------- POS-tagger HMM (bigramme + Viterbi) — NATURE par le CONTEXTE. MÊME modèle + MÊME algo que Python (parité exacte).
  var _HMM=null;
  function setPosHmm(obj){_HMM=(obj&&obj.tags)?obj:null;}
  function loadPosHmm(url){return (async function(){try{var gz=await (await fetch(url)).arrayBuffer();
    var st=new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'));
    setPosHmm(JSON.parse(await new Response(st).text()));return true;}catch(e){return false;}})();}
  function loadOsLm(url){return (async function(){try{var gz=await (await fetch(url)).arrayBuffer();   // LM OS-sujet (os-subj-lm.json.gz) : setOsLm hoisté (défini plus bas)
    var st=new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'));
    setOsLm(JSON.parse(await new Response(st).text()));return true;}catch(e){return false;}})();}
  var _tgCache=(typeof WeakMap!=='undefined')?new WeakMap():null;   // mémoïsation du POS-tagger par RÉFÉRENCE de tableau : une passe correctTokens = ~40 règles × n tokens réutilisaient 1 Viterbi RECALCULÉ → O(n²) ; le cache le calcule 1× par tableau → O(n), sortie STRICTEMENT identique (Viterbi déterministe, T jamais muté en place)
  function posTags(T){
    if(_tgCache&&T){var _cc=_tgCache.get(T);if(_cc!==undefined)return _cc;}
    var M=_HMM;if(!M||!M.tags||!T||!T.length)return null;
    var tags=M.tags,tr=M.trans,em=M.emit,suf=M.suf,pri=M.prior,FL=M.floor;
    function lt(a,b){var r=tr[a];return (r&&b in r)?r[b]:FL;}
    function cap(w){return w.charAt(0)!==w.charAt(0).toLowerCase();}
    function le(t,w){
      var lw=w.toLowerCase();
      if((t==='PUNCT'||t==='SYM')&&/[a-zà-ÿ]/i.test(lw))return -100.0;
      var e=em[lw];if(e!==undefined)return (t in e)?e[t]:FL;
      for(var k=4;k>=2;k--){if(lw.length>=k){var sf=lw.slice(-k);if(suf[sf]!==undefined){var d=suf[sf];return ((t in d)?d[t]:FL)+((cap(w)&&t==='PROPN')?0.0953:0);}}}
      return ((t in pri)?pri[t]:FL)+((cap(w)&&t==='PROPN')?1.0986:0);
    }
    var n=T.length,V=[{}],bk=[{}],i,j,t,pt;
    for(i=0;i<tags.length;i++){t=tags[i];V[0][t]=lt('<s>',t)+le(t,T[0]);bk[0][t]='<s>';}
    for(i=1;i<n;i++){V.push({});bk.push({});
      for(j=0;j<tags.length;j++){t=tags[j];var et=le(t,T[i]),best=-1e18,bp=null;
        for(var b=0;b<tags.length;b++){pt=tags[b];var sc=V[i-1][pt]+lt(pt,t);if(sc>best){best=sc;bp=pt;}}
        V[i][t]=best+et;bk[i][t]=bp;}}
    var best2=-1e18,bt=null;
    for(i=0;i<tags.length;i++){t=tags[i];var sc2=V[n-1][t]+lt(t,'</s>');if(sc2>best2){best2=sc2;bt=t;}}
    var seq=[bt];for(i=n-1;i>0;i--)seq.push(bk[i][seq[seq.length-1]]);
    var _r=seq.reverse();if(_tgCache&&T)_tgCache.set(T,_r);return _r;
  }
  var PLURAL_DET={les:1,des:1,ces:1,mes:1,tes:1,ses:1,nos:1,vos:1,leurs:1};   // classe fermée (parité NUM_DET pluriel)
  var NOUN_PL_STOP={minima:1,maxima:1,media:1,data:1,extra:1,intra:1,euros:1,quanta:1,addenda:1,errata:1,curricula:1,strata:1};
  function _nounGate(dn){var p=NOUN_POST&&NOUN_POST.get(dn);return !!p&&p[0]>=PL_TAU_M&&p[1]<PL_EPS_M;}
  function pluralizeNoun(n){var dn=deacc(n.toLowerCase()),cands=[n+'s'];                  // pluriel ANCRÉ dans le POSTERIOR (part NOM≥30 %)
    if(/al$/.test(dn))cands.push(n.slice(0,-2)+'aux');if(/au$|eu$/.test(dn))cands.push(n+'x');
    for(var k=0;k<cands.length;k++){var p=NOUN_POST.get(deacc(cands[k].toLowerCase()));if(p&&p[0]>=PL_ANCHOR_M)return cands[k];}return null;}
  function rNounPlural(T,i){if(!NOUN_POST||i===0||!PLURAL_DET[deacc(T[i-1].toLowerCase())])return null;
    var n=T[i],c0=n.charAt(0);if(!/[A-Za-zÀ-ÿ]/.test(c0)||c0!==c0.toLowerCase())return null;   // propre/capitalisé
    var dn=deacc(n.toLowerCase());if(dn.length<3||/[sxz]$/.test(dn)||NOUN_PL_STOP[dn])return null;
    if(!_nounGate(dn))return null;                                                            // GARDE §3 : P(NOM)≥0.5 ∧ P(VER)<0.01 (exclut porte/livre verbe + rouge ADJ-dom + « les » pronom)
    var nx=i+1<T.length?T[i+1]:'';
    if(nx&&nx.charAt(0)===nx.charAt(0).toLowerCase()&&/^[A-Za-zÀ-ÿ]+$/.test(nx)){var dnx=deacc(nx.toLowerCase());var pp=NOUN_POST.get(dnx);
      if(pp&&pp[0]>=PL_TAU_M&&!ADJP[dnx])return null;}                                        // nom composé (nom+nom ; adj « français » → pas un composé)
    var pl=pluralizeNoun(n);return (pl&&deacc(pl.toLowerCase())!==dn)?pl:null;}
  // Sens INVERSE (plur→sing) : déterminant SINGULIER (classe fermée) collé à un nom pluriel = TOUJOURS une faute → FP=0 par construction. Miroir rule_noun_singular.
  var _SING_DET={un:1,une:1,le:1,la:1,ce:1,cet:1,cette:1,mon:1,ma:1,ton:1,ta:1,son:1,sa:1,chaque:1,du:1,au:1};
  var _SG_STOP={};('ananas avis bois bras bus cabas cas choix colis compas compromis concours corps courroux cours croix dais deces devis discours dos doux engrais epoux faux fils flux fois fracas gaz heros houx index jus laps larynx lilas mars matelas mets mois nez noix os ours paix paradis parcours pays permis pharynx poids prix progres puits reflux relais remords repas roux sas secours sens silex succes tas taux temps tennis toux univers velours virus voix').split(' ').forEach(function(w){_SG_STOP[w]=1;});   // invariants -s/-x (sing==plur) : la singularisation naïve donne un autre lexème → piège
  function desingularizeNoun(n){var dn=deacc(n.toLowerCase()),cands=[];   // inverse ancré : -aux→-al, -x→∅, -s→∅ ; ne renvoie QUE si la forme sing. est un NOM confiant
    if(/aux$/.test(dn)&&dn.length>4)cands.push(n.slice(0,-3)+'al');
    if(/x$/.test(dn))cands.push(n.slice(0,-1));
    if(/s$/.test(dn))cands.push(n.slice(0,-1));
    for(var k=0;k<cands.length;k++){var p=NOUN_POST.get(deacc(cands[k].toLowerCase()));if(p&&p[0]>=PL_TAU_M&&p[1]<PL_EPS_M)return cands[k];}return null;}
  function rNounSing(T,i){if(!NOUN_POST||i===0||!_SING_DET[deacc(T[i-1].toLowerCase())])return null;   // déterminant SINGULIER juste avant (et posterior chargé)
    if(_SEG&&i<_SEG.dig.length&&_SEG.dig[i])return null;                                              // NOMBRE-écran (« le 25 mars », « le 100 mètres ») → abstention
    var n=T[i],c0=n.charAt(0);if(!/[A-Za-zÀ-ÿ]/.test(c0)||c0!==c0.toLowerCase())return null;           // propre/capitalisé
    var dn=deacc(n.toLowerCase());if(dn.length<4||!/[sx]$/.test(dn)||_SG_STOP[dn]||NOUN_PL_STOP[dn])return null;   // pluriel apparent ; invariant/piège
    var nx=i+1<T.length?T[i+1]:'';
    if(nx&&nx.charAt(0)===nx.charAt(0).toLowerCase()&&/^[A-Za-zÀ-ÿ]+$/.test(nx)){var dnx=deacc(nx.toLowerCase());var pp=NOUN_POST.get(dnx);   // nom composé : nom + NOM confiant NON-verbe → abstention
      if(pp&&pp[0]>=PL_TAU_M&&pp[1]<PL_EPS_M&&!ADJP[dnx])return null;}
    if(_nounGate(dn)){var sg=desingularizeNoun(n);if(sg&&deacc(sg.toLowerCase())!==dn)return sg;}       // VOIE FRÉQUENTIELLE : pluriel NOM-dominant → « une voitures »→voiture
    if(/s$/.test(dn)&&NOUN_PLURAL[dn]&&GENDER_PURE[dn.slice(0,-1)]!==undefined){                       // VOIE RELÂCHÉE : pluriel homographe verbal (« la boites »=boiter 3sg) tranché par dét sing + tagger + lexique
      if(_SEG&&i+1<_SEG.hy.length&&_SEG.hy[i+1])return null;                                           // composé à trait d'union (« la sous-famille »)
      var _tgS=posTags(T);if(_tgS&&i<_tgS.length&&_tgS[i]==='NOUN')return {sugg:n.slice(0,-1),vig:1};}    // -s retiré. ORANGE (à vérifier) : direction ambiguë (la boîte OU les boîtes ?) — décision Rem. Miroir app.
    return null;}
  // === ponctuation/majuscules (sens & contexte) : couche segments + majuscule début de phrase (parité correcteur_probe.py) ===
  var _SEG=null,ABBREV={};'m mme mlle mr dr pr me mgr st ste etc cf ex vs no nos art av bd env fig vol ed p pp al co inc ave apr jc subsp ssp var sp spp gen fam'.split(' ').forEach(function(w){ABBREV[w]=1;});
  function _segInfo(text){var ss=[],bb=[],hy=[],cap=[],dig=[],re=/[A-Za-zÀ-ÿœŒ'’ʼ]+/g,m,prev=0,s;while((m=re.exec(text))){var gap=text.slice(prev,m.index);s=/[.!?…]/.test(gap);ss.push(s);bb.push(s||/[,;:()«»"–—\n]/.test(gap));hy.push(gap.indexOf('-')>=0);cap.push(s&&gap.indexOf('..')<0&&!/\d/.test(gap)&&!(gap.indexOf('.')>=0&&!/\s/.test(gap)&&/^(com|net|org|fr|io|co|eu|de|uk|be|ca|ch|us|info|edu|gov|biz|tv|me|app)$/i.test(m[0])));dig.push(/\d/.test(gap));prev=m.index+m[0].length;}return {ss:ss,bb:bb,hy:hy,cap:cap,dig:dig};}
  // C : run-on (ponctuation manquante entre 2 propositions) — VIGILANCE (vert) ; conservateur, anti-inversion (trait d'union)
  var RPRON={je:['1','s'],tu:['2','s'],il:['3','s'],elle:['3','s'],on:['3','s'],nous:['1','p'],vous:['2','p'],ils:['3','p'],elles:['3','p']},RCONJ={};'et ou ni mais car donc or que qu qui dont quand lorsque comme si puisque quoique lequel laquelle pour sans a'.split(' ').forEach(function(w){RCONJ[w]=1;});
  function _isFinite(w){var r=svReads(w),k;for(k=0;k<r.length;k++){var md=r[k][1].split(':')[0];if(md==='ind'||md==='sub'||md==='cnd'||md==='cond'||md==='imp')return true;}return false;}
  function runonText(text){var T=toks(text),seg=_segInfo(text),out=[],i;for(i=2;i<T.length-1;i++){var pn=RPRON[deacc(T[i].toLowerCase())];if(!pn)continue;if(seg.bb[i]||seg.hy[i])continue;if(RCONJ[deacc(T[i-1].toLowerCase())])continue;if(T[i-1].toLowerCase().indexOf("'")>=0||T[i].toLowerCase().indexOf("'")>=0)continue;if(!_isFinite(T[i-1])||!_isFinite(T[i+1]))continue;if(!svAgrees(svReads(T[i+1]),pn[0],pn[1]))continue;out.push({a:T[i-1],b:T[i]});}return out;}
  function rCapital(T,i){if(!_SEG||i>=_SEG.cap.length||!_SEG.cap[i])return null;var w=T[i],c=w.charAt(0);if(c.toUpperCase()===c)return null;if(i>0&&ABBREV[deacc(T[i-1].toLowerCase())])return null;if(i>0&&deacc(T[i-1].toLowerCase()).length===1)return null;return c.toUpperCase()+w.slice(1);}
  // === confusion d'USAGE être↔avoir + auxiliaire MAL ORTHOGRAPHIÉ (parité dictee/correcteur_probe.py) ===
  var AVOIR_IDIOM={};'faim soif sommeil raison tort envie besoin peur'.split(' ').forEach(function(w){AVOIR_IDIOM[w]=1;});
  var AUX_ETRE_PP={};'alle allee alles allees venu venue venus venues arrive arrivee arrives arrivees parti partie partis parties devenu devenue devenus devenues revenu revenue revenus revenues reste restee restes restees ne nee nes nees mort morte morts mortes decede decedee decedes decedees reparti repartie repartis'.split(' ').forEach(function(w){AUX_ETRE_PP[w]=1;});
  var FULL_AUX={};'suis es est sommes etes sont etais etait etions etiez etaient fus fut fumes futes furent serai seras sera serons serez seront serais serait serions seriez seraient sois soit soyons soyez soient fusse fusses fussions fussiez fussent ai as a avons avez ont avais avait avions aviez avaient eus eut eumes eutes eurent aurai auras aura aurons aurez auront aurais aurait aurions auriez auraient aie aies ait ayons ayez aient eusse eusses eussions eussiez eussent'.split(' ').forEach(function(w){FULL_AUX[w]=1;});
  var NON_AUX={};'avec avant apres dans pour sur sous vers chez sans mais donc alors aussi tres plus tout tous leur leurs cette cela elle elles entre selon ainsi'.split(' ').forEach(function(w){NON_AUX[w]=1;});
  function rAuxUsage(T,i){if(T[i].toLowerCase().indexOf("'")>=0)return null;var reads=svReads(T[i]);if(!reads.length)return null;
    var lem={},k;for(k=0;k<reads.length;k++)lem[reads[k][0]]=1;if(!lem.etre&&!lem.avoir)return null;
    var pn=svSubject(T,i);if(!pn&&i>0){var pv=deacc(T[i-1].toLowerCase());
      if(pv==='nous'){for(k=0;k<reads.length;k++)if(reads[k][2]==='1'&&reads[k][3]==='p'){pn=['1','p'];break;}}
      else if(pv==='vous'){for(k=0;k<reads.length;k++)if(reads[k][2]==='2'&&reads[k][3]==='p'){pn=['2','p'];break;}}}
    if(!pn)return null;var per=pn[0],nb=pn[1];if(!svAgrees(reads,per,nb))return null;if(per==='1'&&nb==='s')return null;
    var mts={};for(k=0;k<reads.length;k++)mts[reads[k][1]]=1;var mt=mts['ind:pre']?'ind:pre':(mts['ind:imp']?'ind:imp':null);if(!mt)return null;
    var nxt=i+1<T.length?deacc(T[i+1].toLowerCase()):'';var age=(lem.etre&&(nxt==='ans'||nxt==='an'));
    if(lem.etre&&(AVOIR_IDIOM[nxt]||age))return ((CONJ_C.avoir||{})[mt]||{})[per+nb]||null;
    if(lem.avoir&&AUX_ETRE_PP[nxt])return ((CONJ_C.etre||{})[mt]||{})[per+nb]||null;return null;}
  function svLev(a,b){if(Math.abs(a.length-b.length)>2)return 9;var prev=[],cur,ja,jb;for(jb=0;jb<=b.length;jb++)prev[jb]=jb;for(ja=1;ja<=a.length;ja++){cur=[ja];for(jb=1;jb<=b.length;jb++)cur[jb]=Math.min(prev[jb]+1,cur[jb-1]+1,prev[jb-1]+(a.charAt(ja-1)!==b.charAt(jb-1)?1:0));prev=cur;}return prev[b.length];}
  function svAuxTargets(per,nb){var out=[],vs=['etre','avoir'],ms=['ind:pre','ind:imp'],vi,mi,f;for(vi=0;vi<2;vi++)for(mi=0;mi<2;mi++){f=((CONJ_C[vs[vi]]||{})[ms[mi]]||{})[per+nb];if(f)out.push([deacc(f),vs[vi],f]);}return out;}
  function rAuxMisspell(T,i){if(T[i].toLowerCase().indexOf("'")>=0)return null;var w=deacc(T[i].toLowerCase());if(w.length<3||!/^[a-zà-ÿœæ]+$/.test(w))return null;if(FULL_AUX[w]||NON_AUX[w])return null;
    var pn=svSubject(T,i),k;if(!pn&&i>0){var pv=deacc(T[i-1].toLowerCase());if(pv==='nous')pn=['1','p'];else if(pv==='vous')pn=['2','p'];}
    if(!pn)return null;var per=pn[0],nb=pn[1];   // « je » (1sg) : cibles courtes avoir (ai) déjà écartées (len<4) → on autorise les longues (suis/étais) : « je sui »→suis
    var reads=svReads(T[i]);if(reads.length&&svAgrees(reads,per,nb))return null;
    var tg=svAuxTargets(per,nb),bd=9,bf=null,bv=null,d;for(k=0;k<tg.length;k++){if(tg[k][0].length<4)continue;d=svLev(w,tg[k][0]);if(d<bd){bd=d;bf=tg[k][2];bv=tg[k][1];}else if(d===bd&&tg[k][1]!==bv)bv='AMBIG';}
    if(!bf||bd>1||bv==='AMBIG')return null;if(reads.length&&bd>1)return null;if(w===deacc(bf.toLowerCase()))return null;return bf;}
  // a/à, on/ont, son/sont, mais/mes, et/est, ce/se, peu = homophones À RÔLE GRAMMATICAL → tranchés EN ROUGE par la grammaire (sujet, accord, segments, pronoms collés, cadre auxiliaire), pas en « vigilance verte ». FP=0 par cadre syntaxique forcé.
  var DESEL={j:'je',n:'ne',m:'me',t:'te',s:'se',d:'de',c:'ce',qu:'que'},DESELV={};'aeiouyàâäéèêëîïôöùûühœæ'.split('').forEach(function(c){DESELV[c]=1;});
  function rDeselide(T,i){var w=T[i],lw=w.toLowerCase();if(lw==="m'sieur"||lw==="m'dame"||lw==="m'ame")return null;   // élision inversée dys → rétablir (FP=0)
    var m=lw.match(/^(qu|[jnmtsdcl])'(.+)$/);if(!m)return null;var pre=m[1],rest=w.slice(pre.length+1),c0=rest.charAt(0);
    if(!c0||DESELV[c0.toLowerCase()]||c0.toLowerCase()===c0.toUpperCase()||c0===c0.toUpperCase())return null;
    if(pre==='l'){var g=GENDER_PURE[deacc(rest.toLowerCase())]||GENDER_MAP[deacc(rest.toLowerCase())];if(g!=='m'&&g!=='f')return null;return ckeepcase(w,(g==='m'?'le':'la')+' '+rest);}
    return ckeepcase(w,DESEL[pre]+' '+rest);}
  // « ête » (non-mot) → être/êtes/es/été. Le SON ne tranche pas (« trés→très » = même échange d'aperture qu'on VEUT ;
  // « ête→été » qu'on ne veut PAS) → seul le CONTEXTE tranche (littérature : rescorage LM ; LanguageTool défère le
  // non-mot à l'humain). Version locale du confusion-set : avoir→été, vous→êtes, tu→es, modal/prép→être ; sinon ORANGE.
  var ETRE_CONJ={je:'suis',tu:'es',il:'est',elle:'est',on:'est',nous:'sommes',vous:'êtes',ils:'sont',elles:'sont'};
  function rEteEtre(T,i){var w=T[i],m=w.toLowerCase().match(/^(n')?ête$/);if(!m)return null;var pre=m[1]||'';
    function keep(core){return ckeepcase(w,pre+core);}
    var p=i>0?deacc(T[i-1].toLowerCase()):'',praw=i>0?T[i-1].toLowerCase():'';
    if(AVOIR_AUX[p]||AVOIR_JE[praw])return keep('été');            // avoir + été (« j'ai été »)
    if(ETRE_CONJ[p])return keep(ETRE_CONJ[p]);                     // pronom sujet → conjugaison d'être (il→est, vous→êtes…)
    if(MODAL[p]||PREP[p])return keep('être');                      // infinitif (« veux/de/pour être »)
    return {sugg:pre+'être',vig:1};}                               // contexte ambigu → ORANGE « être ? » (à vérifier)
  var PPMID={ne:1,n:1,pas:1,plus:1,jamais:1,y:1,en:1,se:1,s:1,deja:1,toujours:1,aussi:1,bien:1,encore:1,tous:1,toutes:1,tout:1};
  // Accord du PARTICIPE PASSÉ (-er) avec le SUJET après ÊTRE — MIROIR de correcteur_probe.rule_pp_etre (parité)
  var PPE_AUX={},PPE_AUXP={},PPE_SUBJ={il:['s','m'],elle:['s','f'],ils:['p','m'],elles:['p','f'],nous:['p','?'],je:['s','?'],tu:['s','?']};
  'suis es est sommes etes sont etais etait etions etiez etaient sera seras serez serons seront sois soit soyons soyez soient fut furent serais serait'.split(' ').forEach(function(w){PPE_AUX[w]=1;});
  'sommes etes sont etions etiez etaient soyons soyez soient serons serez seront furent'.split(' ').forEach(function(w){PPE_AUXP[w]=1;});
  var PP_IRR_CONS={mort:1,ne:1},PP_STOP={};'plus bus jus obus abus virus campus sus pus rebus blocus us refus talus surplus processus consensus'.split(' ').forEach(function(w){PP_STOP[w]=1;});
  function _ppBase(w){var lw=w.toLowerCase(),d=deacc(lw),m,cut,base;
    if(PP_STOP[d])return null;
    var inf=_inf1(w);if(inf)return inf.slice(0,-2)+'é';
    if((m=/(ies|ie|is|i)$/.exec(lw))){cut={ies:3,ie:2,is:2,i:1}[m[1]];base=lw.slice(0,-cut)+'i';return COMMON_VERBS[deacc(base+'r')]?base:null;}
    if((m=/(ues|ue|us|u)$/.exec(lw))){cut={ues:3,ue:2,us:2,u:1}[m[1]];base=lw.slice(0,-cut)+'u';return (IRREG_PART[deacc(base)]||_PP_U_EXTRA[deacc(base)])?base:null;}
    if((m=/(es|s|e)$/.exec(lw))){cut={es:2,s:1,e:1}[m[1]];if(PP_IRR_CONS[deacc(lw.slice(0,-cut))])return lw.slice(0,-cut);}
    return PP_IRR_CONS[d]?lw:null;}
  /* === Accord du PARTICIPE PASSÉ avec AVOIR + COD ANTÉPOSÉ (relatif « que ») — miroir rule_pp_avoir_cod (parité) === */
  var AVOIR_AUX={ai:1,as:1,a:1,avons:1,avez:1,ont:1,avais:1,avait:1,avions:1,aviez:1,avaient:1,aurai:1,auras:1,aura:1,aurons:1,aurez:1,auront:1,aurais:1,aurait:1,aurions:1,auriez:1,auraient:1};
  var AVOIR_JE={"j'ai":1,"j'avais":1,"j'aurai":1,"j'aurais":1};
  var QUE_SUBJ={"qu'il":1,"qu'elle":1,"qu'on":1,"qu'ils":1,"qu'elles":1};
  var COD_SUBJ={je:1,tu:1,il:1,elle:1,on:1,nous:1,vous:1,ils:1,elles:1};
  var PP_COD_STOP={menti:1,ri:1,souri:1,plu:1,deplu:1,nui:1,suffi:1,dormi:1,regne:1,existe:1,marche:1,vecu:1,couru:1,coute:1,valu:1,pese:1,dure:1,reussi:1,echoue:1,appartenu:1,resiste:1,survecu:1,nage:1,voyage:1,travaille:1,circule:1,evolue:1,rode:1,erre:1,parle:1,repondu:1,telephone:1,obei:1,ressemble:1,renonce:1,participe:1,assiste:1,succede:1,procede:1,remedie:1,convenu:1,menace:1,songe:1,reve:1,fallu:1,pu:1};
  var COMPLETIVE_ANT={fait:1,faits:1,idee:1,idees:1,preuve:1,preuves:1,nouvelle:1,nouvelles:1,espoir:1,espoirs:1,crainte:1,craintes:1,peur:1,peurs:1,certitude:1,certitudes:1,conviction:1,convictions:1,impression:1,impressions:1,sentiment:1,sentiments:1,hypothese:1,hypotheses:1,theorie:1,principe:1,principes:1,regle:1,regles:1,condition:1,conditions:1,promesse:1,promesses:1,garantie:1,garanties:1,risque:1,risques:1,chance:1,chances:1,possibilite:1,probabilite:1,sensation:1,sensations:1,illusion:1,illusions:1,pensee:1,pensees:1,reve:1,reves:1,souvenir:1,souvenirs:1,doute:1,doutes:1,soupcon:1,signe:1,signes:1,raison:1,raisons:1,espere:1};
  function _ppAccord(base,nb,g){if(nb==='s')return g==='m'?base:base+'e';if(g==='m')return base.charAt(base.length-1)==='s'?base:base+'s';return base+'es';}
  var IRR_PP={};(function(){var B="écrit décrit fait refait dit redit conduit construit produit détruit instruit cuit ouvert offert couvert découvert souffert peint éteint atteint joint craint pris mis appris compris surpris repris assis acquis conquis requis entendu perdu vendu rendu attendu défendu descendu tendu mordu tordu cousu résolu vu revu lu relu tenu obtenu retenu soutenu détenu maintenu connu reconnu vaincu convaincu aperçu déçu conçu perçu parcouru".split(' ');for(var x=0;x<B.length;x++){var b=B[x],fs=[b,b+'e',(b.charAt(b.length-1)==='s'?b:b+'s'),b+'es'];for(var y=0;y<fs.length;y++){var kk=deacc(fs[y]);if(IRR_PP[kk]===undefined)IRR_PP[kk]=b;}}})();
  function rPpAvoirCod(T,i){var lw=T[i].toLowerCase();if(lw.indexOf("'")>=0)return null;
    var base=_ppBase(T[i]);if(base===null){base=(IRR_PP[deacc(lw)]!==undefined?IRR_PP[deacc(lw)]:null);}if(base===null)return null;
    if(PP_COD_STOP[deacc(base)])return null;if(/^(vu|entendu|senti|regarde|ecoute|apercu|laisse|envoye)$/.test(deacc(base))&&i+1<T.length&&COMMON_VERBS[deacc(T[i+1].toLowerCase())])return null;
    var a=-1,aje=false,k;for(k=i-1;k>=0&&k>i-4;k--){var tk=T[k].toLowerCase(),dk=deacc(tk);if(AVOIR_AUX[dk]){a=k;break;}if(AVOIR_JE[tk]){a=k;aje=true;break;}if(PPMID[dk])continue;return null;}
    if(a<0)return null;
    var q=-1;
    if(aje){if(a-1<0||deacc(T[a-1].toLowerCase())!=='que')return null;q=a-1;}
    else{var bk=a-1;while(bk>=0&&(deacc(T[bk].toLowerCase())==='ne'||deacc(T[bk].toLowerCase())==='n'))bk--;if(bk<0)return null;var tb=T[bk].toLowerCase();if(QUE_SUBJ[tb]){q=bk;}else if(COD_SUBJ[deacc(tb)]){if(bk-1<0||deacc(T[bk-1].toLowerCase())!=='que')return null;q=bk-1;}else return null;}
    var lo=0,jj;if(_SEG){for(jj=q;jj>0;jj--){if(jj<_SEG.bb.length&&_SEG.bb[jj]){lo=jj;break;}}}
    var tg=posTags(T);if(!tg)return null;
    var det=-1,noun=-1,m=q-1;
    while(m>=lo){var dm=deacc(T[m].toLowerCase());if(T[m].toLowerCase().indexOf("'")>=0)return null;if(PREP[dm])return null;if(m<tg.length&&(tg[m]==='DET'||NUM_DET[dm])){det=m;break;}if(m<tg.length&&(tg[m]==='NOUN'||tg[m]==='PROPN')){noun=m;m--;continue;}if(m<tg.length&&(tg[m]==='ADJ'||tg[m]==='ADV'||tg[m]==='NUM')){m--;continue;}return null;}
    if(det<0||noun<0)return null;
    var mm=det-1;while(mm>lo&&mm<tg.length&&tg[mm]==='ADV')mm--;
    if(mm>=lo&&PREP[deacc(T[mm].toLowerCase())])return null;
    if(mm>=lo){var dmm=deacc(T[mm].toLowerCase());if(dmm==='et'||dmm==='ou'||dmm==='ni')return null;}
    var nd=deacc(T[noun].toLowerCase());if(COMPLETIVE_ANT[nd])return null;
    var dd=deacc(T[det].toLowerCase());if(!NUM_DET[dd])return null;var nb=NUM_DET[dd]==='pl'?'p':'s';
    var g=_nounGender(T[noun],nb,true);if(g!=='m'&&g!=='f')return null;   // Fix C : antécédent confirmé → GENDER_MAP OK
    if(i<tg.length&&tg[i]==='NOUN')return null;
    var sugg=_ppAccord(base,nb,g);
    return sugg.toLowerCase()!==lw?ckeepcase(T[i],sugg):null;
  }
  /* === Participe passé avec AVOIR + « dont » (COI) ⇒ INVARIABLE — miroir rule_pp_avoir_dont (parité) ===
     « dont » = complément « de » ⇒ verbe intransitif-de ⇒ jamais de COD ⇒ participe invariable. Whitelist = FP=0. */
  var PP_DONT_DE={parle:1,reve:1,doute:1,joui:1,profite:1,beneficie:1,herite:1,dispose:1,temoigne:1,raffole:1,decoule:1,resulte:1,accouche:1};
  var ETRE_FORMS_DONT={suis:1,es:1,est:1,sommes:1,etes:1,sont:1,etais:1,etait:1,etions:1,etiez:1,etaient:1,fus:1,fut:1,fumes:1,serai:1,seras:1,sera:1,serons:1,serez:1,seront:1,sois:1,soit:1,soient:1,ete:1};
  function _tokConjIs(tok,forms){var d=deacc(tok.toLowerCase());if(forms[d])return true;if(tok.indexOf("'")>=0){var p=tok.toLowerCase().split("'");return !!forms[deacc(p[p.length-1])];}return false;}
  function rPpAvoirDont(T,i){var lw=T[i].toLowerCase();if(lw.indexOf("'")>=0)return null;
    var base=_ppBase(T[i]);if(base===null){base=(IRR_PP[deacc(lw)]!==undefined?IRR_PP[deacc(lw)]:null);}if(base===null)return null;
    if(!PP_DONT_DE[deacc(base)])return null;
    if(deacc(base)===deacc(lw))return null;
    var a=-1,k;for(k=i-1;k>=0&&k>i-4;k--){var tk=T[k],dk=deacc(tk.toLowerCase());
      if(dk==='ete'||_tokConjIs(tk,ETRE_FORMS_DONT))return null;
      if(_tokConjIs(tk,AVOIR_AUX)){a=k;break;}
      if(PPMID[dk])continue;
      return null;}
    if(a<0)return null;
    var lo=0,jj;if(_SEG){for(jj=a;jj>0;jj--){if(jj<_SEG.bb.length&&_SEG.bb[jj]){lo=jj;break;}}}
    for(k=a-1;k>=lo;k--){var d2=deacc(T[k].toLowerCase());if(d2==='que'||T[k].toLowerCase().indexOf("qu'")===0)return null;if(d2==='dont')return ckeepcase(T[i],base);}
    return null;
  }
  function _ppCoordSubject(T,tg,a){var lo=0,jj;if(_SEG){for(jj=a;jj>0;jj--){if(jj<_SEG.bb.length&&_SEG.bb[jj]){lo=jj;break;}}}
    var cjs=[[]],hasSep=false,m;
    for(m=lo;m<a;m++){var dm=deacc(T[m].toLowerCase());
      if(dm==='et'||dm==='ni'){cjs.push([]);hasSep=true;continue;}
      if(dm==='ou'||dm==='mais'||dm==='car'||dm==='donc'||dm==='or'||dm==='que'||dm==='qu'||dm==='qui')return null;
      if(T[m].toLowerCase().indexOf("'")>=0)return null;
      if(m>=tg.length||tg[m]==='VERB'||tg[m]==='AUX'||PREP[dm])return null;
      cjs[cjs.length-1].push(m);}
    if(!hasSep||cjs.length<2)return null;
    for(var c=0;c<cjs.length;c++){var cj=cjs[c];if(!cj.length)return null;var first=deacc(T[cj[0]].toLowerCase());
      if(cj.length===1&&_COORD_PRON[first])continue;
      if(tg[cj[0]]==='DET'||NUM_DET[T[cj[0]].toLowerCase()]){var hn=false,k;for(k=0;k<cj.length;k++)if(tg[cj[k]]==='NOUN'||tg[cj[k]]==='PROPN')hn=true;if(!hn)return null;continue;}
      var allNP=true,k2;for(k2=0;k2<cj.length;k2++)if(tg[cj[k2]]!=='NOUN'&&tg[cj[k2]]!=='PROPN'&&tg[cj[k2]]!=='ADJ')allNP=false;
      if((tg[cj[0]]==='NOUN'||tg[cj[0]]==='PROPN')&&allNP)continue;
      return null;}
    return 'p';}   // sujet coordonné « X et Y sont » → pluriel (MIROIR _pp_coord_subject)
  function rPpEtre(T,i){var lw=T[i].toLowerCase();if(lw.indexOf("'")>=0)return null;
    var base=_ppBase(T[i]);if(base===null)return null;
    var a=-1,k;for(k=i-1;k>=0&&k>i-4;k--){var dk=deacc(T[k].toLowerCase());if(PPE_AUX[dk]){a=k;break;}if(PPMID[dk])continue;return null;}
    if(a<0)return null;var auxNum=PPE_AUXP[deacc(T[a].toLowerCase())]?'p':'s';
    var info=null,sk=-1;for(k=a-1;k>=0&&k>a-3;k--){var d2=deacc(T[k].toLowerCase());if(d2==='ne'||d2==='n')continue;info=PPE_SUBJ[d2];sk=k;break;}
    if(!info){                                                                   // pas de sujet PRONOM → sujet NOM via le VRAI PARSEUR (miroir rule_pp_etre)
      if(a>=1&&T[a-1].indexOf("'")>=0)return null;                              // pronom élidé (« qu'elle soit emmenée ») → abstention (FP)
      var tgp=posTags(T);
      if(!tgp||i>=tgp.length||(tgp[i]!=='VERB'&&tgp[i]!=='ADJ'))return null;     // participe RÉEL (tagger)
      if(i+1<tgp.length&&tgp[i+1]==='DET')return null;                          // sujet POSTPOSÉ (« est annoncée la reprise ») → abstention (FP)
      var sj=_npSubject(T,tgp,a);
      if(sj===null){if(auxNum==='p'&&_ppCoordSubject(T,tgp,a)==='p'){var gcp=(/e$/.test(lw)&&!/é$/.test(lw))?'f':'m',sgp=base+(gcp==='f'?'es':'s');return sgp.toLowerCase()!==lw?ckeepcase(T[i],sgp):null;}return null;}   // sujet COORDONNÉ « X et Y sont » → pluriel, genre écrit gardé (miroir Python)
      if((sj.g!=='m'&&sj.g!=='f')||sj.n!==auxNum)return null;
      if(a-sj.idx>5)return null;                                                // sujet trop loin de l'aux → abstention (FP)
      for(var kk=sj.idx+1;kk<a;kk++){if(T[kk].charAt(0)!==T[kk].charAt(0).toLowerCase()&&kk<tgp.length&&(tgp[kk]==='NOUN'||tgp[kk]==='PROPN'))return null;}   // nom propre entre sujet et aux → ambigu (FP)
      var sg2=base+({sm:'',sf:'e',pm:'s',pf:'es'}[sj.n+sj.g]);
      return sg2.toLowerCase()!==lw?ckeepcase(T[i],sg2):null;
    }
    if(_SEG&&sk<_SEG.hy.length&&_SEG.hy[sk])return null;
    var num=info[0],gen=info[1];if(num!==auxNum)return null;var _refl=(deacc(T[sk].toLowerCase())==='se')||(sk>=1&&PPE_SUBJ[deacc(T[sk-1].toLowerCase())]);if(_refl&&i+1<T.length){var _tgn=posTags(T);if(_tgn&&i+1<_tgn.length&&(_tgn[i+1]==='NOUN'||_tgn[i+1]==='DET'))return null;}   // pronominal réfléchi COI + COD après → PP INVARIABLE
    if(gen==='?')gen=(deacc(lw.slice(-1)==='s'?lw.slice(0,-1):lw)===deacc(base)+'e')?'f':'m';
    var sugg=base+({sm:'',sf:'e',pm:'s',pf:'es'}[num+gen]);
    return sugg.toLowerCase()!==lw?ckeepcase(T[i],sugg):null;}
  // Accord de l'ADJECTIF ATTRIBUT après ÊTRE (sujet PRONOM ou NOM via VRAI PARSEUR de tête de GN) — MIROIR de correcteur_probe (parité)
  var ADJ_STOP={};'sur certain seul meme propre sacre pauvre grand ancien drole'.split(' ').forEach(function(w){ADJ_STOP[w]=1;});
  var ADJ_DETM={le:'m',un:'m',ce:'m',cet:'m'},ADJ_DETF={la:1,une:1,cette:1,ma:1,ta:1,sa:1};
  var ADJ_MID={};'ne n pas plus jamais guere point tres si tout toute tous toutes bien aussi trop peu assez plutot moins deja toujours encore vraiment fort'.split(' ').forEach(function(w){ADJ_MID[w]=1;});
  var NOUN_INVAR_S={};'cours corps temps prix bois pays mois bras dos nez puits univers fois poids sens tas repas concours discours parcours secours velours jus os gaz choix croix voix noix faux toux'.split(' ').forEach(function(w){NOUN_INVAR_S[w]=1;});
  var _QUANT_PL={};'plusieurs quelques certains certaines divers diverses maints maintes differents differentes beaucoup moults deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize vingt trente quarante cinquante soixante cent cents mille'.split(' ').forEach(function(w){_QUANT_PL[w]=1;});
  var _QUANT_SG={};'chaque aucun aucune nul nulle chacun chacune'.split(' ').forEach(function(w){_QUANT_SG[w]=1;});
  var _COLL_HEAD={};'plupart majorite minorite nombre total partie moitie tiers quart ensemble reste quantite foule multitude infinite poignee kyrielle dizaine douzaine quinzaine vingtaine trentaine quarantaine cinquantaine soixantaine centaine millier million milliard brochette tapee flopee sorte espece genre'.split(' ').forEach(function(w){_COLL_HEAD[w]=1;});
  var _NP_BREAK={};'que qu qui dont quand lorsque puisque parce comme si car mais donc or quoique lequel laquelle lesquels lesquelles'.split(' ').forEach(function(w){_NP_BREAK[w]=1;});
  function _adjEstem(lw){var s;if(/x$/.test(lw))s=lw.slice(0,-1);else if(/s$/.test(lw)&&!/ss$/.test(lw))s=lw.slice(0,-1);else s=lw;return (/e$/.test(s)&&!/é$/.test(s))?s:null;}
  function _nounGender(w,num,full){var d=deacc(w.toLowerCase());function src(x){var g=GENDER_PURE[x];if(g==='m'||g==='f')return g;if(full){g=GENDER_MAP[x];if(g==='m'||g==='f')return g;}return null;}var g=src(d);if(g)return g;if(num!=='p'||NOUN_INVAR_S[d])return null;if(/x$/.test(d)&&d.length>2){g=src(d.slice(0,-1))||src(d.slice(0,-1)+'u');if(g==='m'||g==='f')return g;}if(/s$/.test(d)&&d.length>2){g=src(d.slice(0,-1));if(g==='m'||g==='f')return g;}return null;}   // full=true (Fix C) : antécédent [dét+NOM] confirmé → retombe sur GENDER_MAP (noms homographes pomme/ferme), sinon FP
  function _npSubject(T,tg,a){var lo=0,j;if(_SEG){for(j=a;j>0;j--){if(j<_SEG.bb.length&&_SEG.bb[j]){lo=j;break;}}}
    var detIdx=-1;for(j=a-1;j>=lo;j--){var dj=deacc(T[j].toLowerCase()),tgj=(tg&&j<tg.length)?tg[j]:null;if(dj==='et'||dj==='ou'||dj==='ni')return null;if(_NP_BREAK[dj])break;if(tgj==='VERB'||tgj==='AUX'){if(/(é|és|ée|ées)$/.test(T[j].toLowerCase())&&!(j-1>=lo&&tg&&j-1<tg.length&&tg[j-1]==='AUX'))continue;break;}if(NUM_PRON[dj])break;if(tgj==='DET'||NUM_DET[dj])detIdx=j;}
    if(detIdx<0)return null;
    if(detIdx-1>=lo&&PREP[deacc(T[detIdx-1].toLowerCase())])return null;
    var head=-1;for(var k=detIdx+1;k<a;k++){var dk=deacc(T[k].toLowerCase());if(PREP[dk]||(T[k].toLowerCase().indexOf("'")>=0&&dk.charAt(0)==='d'))break;if((tg&&k<tg.length&&(tg[k]==='NOUN'||tg[k]==='PROPN'))||(dk in GENDER_PURE)){head=k;break;}}
    if(head<0)return null;
    var ddet=deacc(T[detIdx].toLowerCase()),num;
    if(NUM_DET[ddet])num=NUM_DET[ddet]==='pl'?'p':'s';
    else if(_QUANT_PL[ddet])num='p';
    else if(_QUANT_SG[ddet])num='s';
    else{var dh0=deacc(T[head].toLowerCase());if(NOUN_INVAR_S[dh0])return null;num=/[sx]$/.test(dh0)?'p':'s';}
    var g=_nounGender(T[head],num)||ADJ_DETM[ddet]||(ADJ_DETF[ddet]?'f':null);
    return {idx:head,det:detIdx,g:g||'?',n:num};}
  function _adjAgree(w,gender,num){var lw=w.toLowerCase();var stem=_adjEstem(lw);
    if(stem!==null)return num==='p'?stem+'s':stem;
    var p=ADJP[deacc(lw)],g=p[0],alt=p[1];var base=(g===gender)?w:alt;
    if(num==='p'){var db=deacc(base.toLowerCase());if(/[sx]$/.test(db)){}else if(/al$/.test(db))base=base.slice(0,-2)+'aux';else if(/eau$/.test(db))base=base+'x';else base=base+'s';}
    return base;}
  function rAdjAttr(T,i){var w=T[i],lw=w.toLowerCase();if(lw.indexOf("'")>=0)return null;var d=deacc(lw);
    if(!ADJP[d]||ADJ_STOP[d])return null;if(/ee$/.test(deacc(ADJP[d][1]))&&!/e$/.test(d))return null;
    var tg=posTags(T);if(!tg||i>=tg.length||tg[i]!=='ADJ')return null;
    if(i+1<T.length&&(tg[i+1]==='NOUN'||tg[i+1]==='PROPN'))return null;   // adjectif ÉPITHÈTE d'un nom suivant → abstention
    var a=-1,k;for(k=i-1;k>=0&&k>i-4;k--){var dk=deacc(T[k].toLowerCase());if(PPE_AUX[dk]){a=k;break;}if(ADJ_MID[dk])continue;return null;}
    if(a<1)return null;
    if(_SEG&&(a-1)<_SEG.hy.length&&_SEG.hy[a-1])return null;
    var auxNum=PPE_AUXP[deacc(T[a].toLowerCase())]?'p':'s';
    var epi=_adjEstem(lw)!==null;
    var sp=deacc(T[a-1].toLowerCase()),gender,num;
    if(sp==='il'||sp==='elle'||sp==='ils'||sp==='elles'){gender=(sp==='elle'||sp==='elles')?'f':'m';num=(sp==='ils'||sp==='elles')?'p':'s';}
    else{var subj=_npSubject(T,tg,a);if(!subj)return null;num=subj.n;gender=subj.g;if(gender==='?'){if(!epi)return null;gender='m';}}
    if(num!==auxNum)return null;
    var sugg=_adjAgree(w,gender,num);return sugg.toLowerCase()!==lw?ckeepcase(T[i],sugg):null;}
  // Accord de l'ADJECTIF ÉPITHÈTE ([article + nom genre connu + adj]) — MIROIR rule_adj_epithet (parité). FP=0 très gardé.
  var _EPI_ART={le:'s',la:'s',les:'p',un:'s',une:'s',des:'p',ce:'s',cet:'s',cette:'s',ces:'p',du:'s'};
  var _COLOR_ADJ={bleu:1,vert:1,gris:1,blanc:1,noir:1,brun:1,violet:1,jaune:1,rouge:1,rose:1,orange:1,marron:1,roux:1,blond:1,pourpre:1,mauve:1,beige:1,fauve:1};   // couleur composée/dérivée = INVARIABLE
  function rAdjEpithet(T,i){if(i<2)return null;var w=T[i],lw=w.toLowerCase();
    if(lw.indexOf("'")>=0||w.charAt(0)!==w.charAt(0).toLowerCase())return null;
    var d=deacc(lw);
    if(!ADJP[d]||_adjEstem(lw)!==null)return null;                                   // inconnu / épicène → pas de genre
    if(d==='tout'||d==='tous'||d==='toute'||d==='toutes')return null;
    if(i+1<T.length){var nx=deacc(T[i+1].toLowerCase());if(nx==='de'||nx==='et'||nx==='ou'||nx==='ni')return null;if((deacc(lw)==='bon'||deacc(lw)==='meilleur')&&nx==='marche')return null;}   // figé + coordination distributive
    var tg=posTags(T);if(!tg||i>=tg.length||tg[i]!=='ADJ'||tg[i-1]!=='NOUN')return null;if(_COLOR_ADJ[deacc(lw)]&&i+1<tg.length&&(tg[i+1]==='ADJ'||tg[i+1]==='NOUN'))return null;
    if(T[i-1].charAt(0)!==T[i-1].charAt(0).toLowerCase())return null;                 // nom propre
    var dn=deacc(T[i-1].toLowerCase()),g=GENDER_PURE[dn];
    if((g!=='m'&&g!=='f')||_SG_STOP[dn])return null;                                  // genre connu ET pas invariant
    var num=_EPI_ART[deacc(T[i-2].toLowerCase())];
    if(!num)return null;                                                             // nombre non net → abstention
    var sugg=_adjAgree(w,g,num);return sugg.toLowerCase()!==lw?ckeepcase(T[i],sugg):null;}
  var CRULES=[['élision inversée',rDeselide],['être (ête)',rEteEtre],['accord grammatical (é/er)',rEer],['accord participe',rPpEtre],['accord participe (COD avoir)',rPpAvoirCod],['accord participe (dont)',rPpAvoirDont],['accord adjectif',rAdjAttr],['accord adjectif épithète',rAdjEpithet],['terminaison -er/-é/-ez/-ai',rFlexionEr],['impératif',rImperatif],['son/sont',rSon],['on/ont',rOn],['leur/leurs',rLeur],['a/à',rA],['et/est',rEt],['peu/peux/peut',rPeu],['sujet je',rJeSubject],['sais/sait',rSais],['ce/se',rCe],["c'est/s'est",rCestSest],['ça/sa',rCaSa],['met/mais',rMetMais],['mais/mes',rMais],['du/de',rDuDe],['du/dû',rDuDu],['sur/sûr',rSurSur],['la/là',rLaLa],["j'est/j'ai",rJest],["c'ai/c'est",rCai],['élision',rElide],['accord sujet-verbe',rAccordSV],['accord sujet-verbe',rIlIls],['accord sujet-verbe',rAccordSVrecover],['accord sujet-verbe',rAccordSVnoun],['accord sujet-verbe',rAisAit],['accord sujet-verbe',rAccordSVquant],['accord sujet-verbe',rAccordSVrelatif],['accord sujet-verbe',rAccordSVcoord],['accord sujet-verbe',rAccordSVinfinitif],['accord sujet-verbe',rPostpose],['genre déterminant',rDetGenre],['accord tout',rTout],['accord pluriel nom',rNounPlural],['accord singulier nom',rNounSing],['usage être/avoir',rAuxUsage],['aux mal orthographié',rAuxMisspell],['majuscule',rCapital]];
  function correctText(text){text=String(text).replace(/[’ʼ]/g,"'");_SEG=_segInfo(text);var T=toks(text),out=[];for(var i=0;i<T.length;i++){for(var r=0;r<CRULES.length;r++){var dec=CRULES[r][1](T,i);if(dec==null)continue;var _sg=(typeof dec==='object')?dec.sugg:dec,_vg=(typeof dec==='object'&&dec.vig)?'vigilance':null;if(_sg!==T[i]&&(CRULES[r][0]==='majuscule'||_sg.toLowerCase()!==T[i].toLowerCase())){out.push({i:i,word:T[i],sugg:_sg,name:CRULES[r][0],tier:_vg});break;}}}return out;}   // {sugg,vig:1} → tier vigilance (orange) ; string = rouge

  // ===== Correcteur ORTHOGRAPHIQUE (non-mots/accents/typos) — VERBATIM app (miroir dictee/speller_probe.py) =====
  // Seule différence vs app : loadSpellerLex fetch l'asset gzip (extension) au lieu de lire le bloc DOM speller-lex-gz.
  function deaccS(s){return s.replace(/œ/g,'oe').replace(/Œ/g,'OE').replace(/æ/g,'ae').replace(/Æ/g,'AE').normalize('NFD').replace(/[̀-ͯ]/g,'');}
  function isAlphaS(s){for(var i=0;i<s.length;i++){var c=deaccS(s[i]).toLowerCase();if(c<'a'||c>'z')return false;}return true;}
  function phonKey(s){s=s.toLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae').replace(/ç/g,'s');s=deaccS(s);
    s=s.replace(/oin(?![aeiouy])/g,'w1').replace(/ien(?![aeiouy])/g,'j1').replace(/(?:ain|aim|ein|eim|in|im|yn|ym|un|um)(?![aeiouymn])/g,'1').replace(/(?:an|am|en|em)(?![aeiouymn])/g,'2').replace(/(?:on|om)(?![aeiouymn])/g,'3');   // NASALES → classe unique (MIROIR speller_probe.phon_key)
    s=s.replace(/ph/g,'f').replace(/sch/g,'ch').replace(/th/g,'t').replace(/ch(?=[bcdfgjklmnpqrstvwxz])/g,'k').replace(/ch/g,'§').replace(/gn/g,'¤');
    s=s.replace(/qu/g,'k').replace(/gu/g,'g').replace(/eau/g,'o').replace(/aux/g,'o').replace(/au/g,'o');
    s=s.replace(/oeu/g,'e').replace(/ou/g,'u').replace(/eu/g,'e').replace(/ai/g,'e').replace(/ei/g,'e').replace(/ay/g,'e').replace(/ey/g,'e').replace(/oi/g,'wa');
    var res='';for(var j=0;j<s.length;j++){var ch=s[j],nx=s[j+1]||'';
      if(ch==='c')res+=('eiy§'.indexOf(nx)>=0?'s':'k');else if(ch==='g')res+=('eiy'.indexOf(nx)>=0?'j':'g');
      else if(ch==='h'){}else if(ch==='x')res+='ks';else if(ch==='z'||ch==='s')res+='s';else if(ch==='y')res+='i';else if(ch==='w')res+='v';else res+=ch;}
    s=res.replace(/¤/g,'nj');var out='';for(var k=0;k<s.length;k++){if(s[k]!==out[out.length-1])out+=s[k];}s=out;
    while(s.length&&'est'.indexOf(s[s.length-1])>=0)s=s.slice(0,-1);return s;}
  function sEdits1(d){var res={},i,ci,c,a,b,sp=[];for(i=0;i<=d.length;i++)sp.push([d.slice(0,i),d.slice(i)]);
    for(var k=0;k<sp.length;k++){a=sp[k][0];b=sp[k][1];if(b)res[a+b.slice(1)]=1;if(b.length>1)res[a+b[1]+b[0]+b.slice(2)]=1;
      for(ci=0;ci<26;ci++){c=String.fromCharCode(97+ci);res[a+c+b]=1;if(b)res[a+c+b.slice(1)]=1;}}return Object.keys(res);}
  var SP={ready:false,loading:null,WORDS:null,FREQ:{},D2A:{},PHON:{},POS:{}};
  var SELIDE={l:1,m:1,t:1,s:1,n:1,d:1,c:1,j:1},_SELIDE_ACC={l:1,d:1,j:1,c:1,s:1},SVOW={a:1,e:1,i:1,o:1,u:1,y:1,h:1};   // _SELIDE_ACC = préfixes SÛRS pour restauration d'accent (m'/t'/n' exclus)
  function _applySpellerTSV(txt){SP.WORDS=new Set();var lines=txt.split('\n');
    for(var k=0;k<lines.length;k++){var ln=lines[k];if(!ln)continue;var pr=ln.split('\t');if(pr.length<2)continue;
      var w=pr[0],fr=parseInt(pr[1],10)/1000;SP.WORDS.add(w);SP.FREQ[w]=fr;if(pr[2])SP.POS[w]=pr[2];
      var d=deaccS(w);(SP.D2A[d]||(SP.D2A[d]=[])).push(w);
      if(fr>=0.1){var pk=phonKey(w);(SP.PHON[pk]||(SP.PHON[pk]=[])).push(w);}}
    ['postulée','postulées','entretint','entretinrent','armet','armets'].forEach(function(w){SP.WORDS.add(w);});   // MOTS VALIDES manquants du lexique que le speller éditait à tort (« mauvais candidat sur mot valide » : postulée→postulé, entretint→entretient, armet→arme) → protégés (SP.WORDS.has ⇒ ni correction ni vigilance). FP=0 : vrais mots FR ; liste extensible.
    var sf=function(a,b){return SP.FREQ[b]-SP.FREQ[a];};
    for(var dd in SP.D2A)SP.D2A[dd].sort(sf);for(var pp in SP.PHON)SP.PHON[pp].sort(sf);SP.ready=true;}
  function loadSpellerLex(url){          // extension : fetch l'asset gzip (≠ app : bloc DOM). Parse VERBATIM.
    if(SP.ready)return Promise.resolve(true);if(SP.loading)return SP.loading;
    SP.loading=(async function(){try{
      var gz=await (await fetch(url)).arrayBuffer();
      var st=new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'));
      _applySpellerTSV(await new Response(st).text());return true;
    }catch(e){SP.ready=false;return false;}})();return SP.loading;}
  // VOIE GRAMMAIRE dans le speller (accord genre/nombre du contexte) — miroir Python/app
  var SDET_NUM={le:'s',la:'s',un:'s',une:'s',ce:'s',cet:'s',cette:'s',mon:'s',ma:'s',ton:'s',ta:'s',son:'s',sa:'s',les:'p',des:'p',ces:'p',mes:'p',tes:'p',ses:'p',nos:'p',vos:'p',leurs:'p'};
  var SCOPULA={};('est sont suis es sommes etes etait etaient etais sera seront serai soit fut furent parait paraissait semble semblait devient deviennent reste restent').split(' ').forEach(function(w){SCOPULA[w]=1;});
  var SADVERB={};('tres si trop assez bien plus tout aussi moins fort peu').split(' ').forEach(function(w){SADVERB[w]=1;});
  var SAUXAV={};("a ai as ont avons avez avait avaient aura auront aurai aurais aurait eu ete j'ai j'est j'avais j'aurai").split(' ').forEach(function(w){SAUXAV[w]=1;});
  var SSUBJP={};('je tu il elle on ils elles nous vous').split(' ').forEach(function(w){SSUBJP[w]=1;});
  function sGender(w){var dw=deaccS(w);if((SP.POS[w]||'').indexOf('A')>=0){var a=ADJP[dw];if(a)return a[0];}var g=GENDER_PURE[dw]||GENDER_MAP[dw];return (g==='m'||g==='f')?g:null;}
  function sCtxGender(T,idx){if(!T||idx==null)return null;for(var j=idx-1;j>=Math.max(0,idx-4);j--){var t=deaccS(T[j].toLowerCase());if(SCOPULA[t])continue;if(DET_G[t])return DET_G[t];
    if(!SP.WORDS.has(T[j].toLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae')))continue;   // ancre de genre = un VRAI mot écrit : un token fautif (« tres ») porte un genre pollué (GENDER_PURE déacc ← « trés » nom) → on continue vers le déterminant
    var g=GENDER_PURE[t];if(g==='m'||g==='f')return g;}return null;}
  function sCtxNumber(T,idx){if(!T||idx==null)return null;for(var j=idx-1;j>=Math.max(0,idx-4);j--){var t=deaccS(T[j].toLowerCase());if(SDET_NUM[t])return SDET_NUM[t];}return null;}
  function sEd1(a,b){var la=a.length,lb=b.length;if(Math.abs(la-lb)>1)return false;   // distance d'édition ≤ 1 (bornée)
    if(la===lb){var n=0;for(var k=0;k<la;k++)if(a[k]!==b[k]&&++n>1)return false;return true;}
    var s=la<lb?a:b,l=la<lb?b:a,i=0,j=0,sk=0;
    while(i<s.length&&j<l.length){if(s[i]===l[j]){i++;j++;}else{if(++sk>1)return false;j++;}}return true;}
  function spellToken(tok,atStart,T,idx){                                  // élision : « d'othographes » = 1 token → on analyse le RESTE
    var em=tok.match(/^([A-Za-zÀ-ÿ]{1,2})['’](.+)$/),pk;
    if(em&&((pk=em[1].toLowerCase()).length===1&&SELIDE[pk]||pk==='qu')){
      var rc=spellTokenCore(em[2],false,T,idx);if(!rc)return null;
      var rem=deaccS(em[2].toLowerCase()),sug=deaccS(rc[1].toLowerCase());
      if(!SVOW[sug[0]])return null;                                        // l'/d' exige une voyelle/h après : « l'aramel »→« caramel » casserait l'élision → abstention
      if(rc[0]!=='auto'&&rem!==sug&&!sEd1(rem,sug))return null;            // conservateur : phonétique distant (othographe→autographe) = faux ami → abstention
      return [rc[0],em[1]+"'"+rc[1]];}
    return spellTokenCore(tok,atStart,T,idx);}
  // ÉLONGATION (« trèèès »→très) : un run de ≥3 lettres identiques n'existe dans AUCUN mot FR valide → non-mot SÛR.
  // On collapse chaque run ≥3 vers 1 OU 2 lettres et on garde les formes du lexique (triées par fréquence). FP=0 mesuré (UD).
  function sCollapse(low){
    var g=[],k; for(k=0;k<low.length;k++){ if(g.length&&g[g.length-1][0]===low[k])g[g.length-1][1]++; else g.push([low[k],1]); }
    var has=false; for(k=0;k<g.length;k++)if(g[k][1]>=3)has=true; if(!has)return null;
    var combos=[''],nc,a,b; for(k=0;k<g.length;k++){ var ch=g[k][0],c=g[k][1],opts=c>=3?[ch,ch+ch]:[new Array(c+1).join(ch)]; nc=[];
      for(a=0;a<combos.length;a++)for(b=0;b<opts.length;b++)nc.push(combos[a]+opts[b]); combos=nc; if(combos.length>64)return null; }
    var seen={},cs=[]; for(k=0;k<combos.length;k++){ var cw=combos[k]; if(cw!==low&&SP.WORDS.has(cw)&&!seen[cw]){seen[cw]=1;cs.push(cw);} }
    if(!cs.length)return null; cs.sort(function(x,y){return (SP.FREQ[y]||0)-(SP.FREQ[x]||0);}); return cs;
  }
  function spellTokenCore(tok,atStart,T,idx){
    if(!SP.ready)return null;var low=tok.toLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae');if(low.length<2||!isAlphaS(low))return null;
    var _AFIX={"trés":"très","celà":"cela","içi":"ici","idéé":"idée","écolé":"école","fléche":"flèche","moï":"moi","verité":"vérité"};if(_AFIX[low])return["auto",_AFIX[low]];
    var _OEL={soeur:"sœur",soeurs:"sœurs",coeur:"cœur",coeurs:"cœurs",choeur:"chœur",choeurs:"chœurs",oeuf:"œuf",oeufs:"œufs",oeuvre:"œuvre",oeuvres:"œuvres",boeuf:"bœuf",boeufs:"bœufs",oeil:"œil",voeu:"vœu",voeux:"vœux",noeud:"nœud",noeuds:"nœuds",moeurs:"mœurs",manoeuvre:"manœuvre",manoeuvres:"manœuvres",oeillet:"œillet",oeillets:"œillets",oesophage:"œsophage",foetus:"fœtus"};
    if(_OEL[low]&&tok.indexOf('œ')<0&&tok.indexOf('Œ')<0)return['flag',_OEL[low]];   // LIGATURE œ : « soeur »→« sœur ». Liste FERMÉE oe=œ → FP=0. Garde : pas de re-flag si déjà écrit avec œ. Miroir app.
    if(SP.WORDS.has(low))return null;                                  // mot valide → couche grammaire
    if(tok[0]!==tok[0].toLowerCase()&&!atStart)return null;            // nom propre (majuscule hors début)
    var d=deaccS(low);
    if(!/[aeiouy]/.test(d))return null;                               // pas de voyelle → sigle/abréviation (www, qcm) — on n'invente pas
    if(/(.)\1\1/.test(low)&&!(tok===tok.toUpperCase()&&tok.length>=2)&&!/^[ivxlcdm]+(e|es|eme|emes|er|ers)?$/.test(d)){   // ÉLONGATION (pas acronyme AAA, pas chiffre romain VIII)
      var _ec=sCollapse(low);if(_ec)return _ec.length===1?['auto',_ec[0]]:['flag',_ec[0]];}
    var _dw=null,_df=0;for(var _q=1;_q<low.length-1;_q++){if('bcdfglmnprst'.indexOf(deaccS(low[_q]))<0)continue;var _cd=low.slice(0,_q+1)+low[_q]+low.slice(_q+1);var _f=SP.WORDS.has(_cd)?(SP.FREQ[_cd]||0):0;if(_f>=3&&_f>_df){_dw=_cd;_df=_f;}}if(_dw)return['flag',_dw];   // DOUBLE-CONSONNE simplifiée (laisé→laissé, pome→pomme, carote→carotte) = faute dys fréquente → restauration PRIORITAIRE. FP=0 UD 2500. Miroir Python/app.
    var _isPPacc=(/ées$/.test(low)&&SP.WORDS.has(low.slice(0,-2)))||(/(ée|és)$/.test(low)&&SP.WORDS.has(low.slice(0,-1)));   // participe ACCORDÉ (dallées→dallé connu) = mot valide, PAS une fusion d'élision → ne pas couper en d'/l' (FP « dallées→d'allées »). Miroir app/Python.
    if(!_isPPacc&&low.length>2&&SELIDE[low[0]]&&SVOW[deaccS(low[1])[0]]){var rest=low.slice(1),cw=(SP.WORDS.has(rest)&&rest.length>=5&&(SP.FREQ[rest]||0)>=1.0)?rest:null;   // reste COMMUN (≥5 lettres, freq≥1) sinon coïncidence nom propre/étranger (Sabu→S'abu abu/3, maven→m'aven aven/4, tai→t'ai ai/2, Mamadou amadou/0.19) → pas d'élision inventée ; « Lannée »→L'année préservé (année commun)
      if(cw===null&&_SELIDE_ACC[low[0]]&&rest.length>=4){var _acc=SP.D2A[deaccS(rest)]||[];for(var _k=0;_k<_acc.length;_k++){var _w=_acc[_k];if(SVOW[deaccS(_w)[0]]&&(SP.FREQ[_w]||0)>=2.0&&(cw===null||SP.FREQ[_w]>(SP.FREQ[cw]||0)))cw=_w;}}   // restauration d'accent (lhopital→l'hôpital) — préfixes sûrs
      if(cw&&!(low[0]==='c'&&'ei'.indexOf(deaccS(cw)[0])<0))return['flag',low[0]+"'"+cw];}   // c' seulement devant e/i
    var cand={},i,j,w,arr;arr=SP.D2A[d]||[];for(i=0;i<arr.length;i++){w=arr[i];cand[w]=[2,SP.FREQ[w]];}
    var e1=sEdits1(d);for(i=0;i<e1.length;i++){var a2=SP.D2A[e1[i]];if(a2)for(j=0;j<a2.length;j++){w=a2[j];if(!cand[w]||cand[w][0]<1)cand[w]=[1,SP.FREQ[w]];}}
    var pa=SP.PHON[phonKey(low)]||[];for(i=0;i<pa.length&&i<8;i++){w=pa[i];if(Math.abs(deaccS(w).length-d.length)>2||deaccS(w).charAt(0)!==d.charAt(0))continue;if(!cand[w])cand[w]=[0,SP.FREQ[w]];}   // garde-longueur (Δ≤2)+MÊME initiale : laisse le multi-édit silencieux (ortografe→orthographe) ; bloque trist→tristesse (Δ4)/autent→hautaine (initiale)
    var keys=Object.keys(cand);if(!keys.length)return null;var pk=phonKey(low);
    var inpAud=/é$/.test(low);                                        // AUDIBILITÉ : finale /e/ (é) écrite = entendue (fiable). Miroir app.
    var cg=sCtxGender(T,idx),cn=sCtxNumber(T,idx);                     // accord du contexte (grammaire)
    var expPos=null;                                                   // POS attendu (désambiguïse l'accent : élève/élevé)
    if(T&&idx>0){var pt=deaccS(T[idx-1].toLowerCase());if(DET_G[pt]||SDET_NUM[pt])expPos='N';else if(SADVERB[pt])expPos='A';
      else if(SCOPULA[pt])expPos='VA';else if(SAUXAV[pt]||SSUBJP[pt])expPos='V';}   // copule = attribut POSSIBLE : V OU A (« je suis trist »→triste, pas seulement « je suis allé ») — audit 07/2026   // CONTEXTE VERBAL : après aux/copule/pronom-sujet → candidat VERBE (pri→pris, pleu→pleut). Bonus, jamais pénalité → FP-sûr.
    function pm(x){if(!expPos)return 0;var ps=SP.POS[x]||'';for(var q=0;q<expPos.length;q++)if(ps.indexOf(expPos.charAt(q))>=0)return 1;return 0;}   // expPos peut être multi-POS ('VA' après copule)
    function gm(x){var g=sGender(x);return (cg&&g&&g===cg)?1:0;}       // bonus genre (jamais pénalité)
    function nm(x){return (cn&&((cn==='p')===/[sx]$/.test(deaccS(x))))?1:0;}
    function fin_aud(x){return /(é|ée|és|ées|er|ez|ai|ais|ait)$/.test(x)?1:0;}   // finale AUDIBLE /e/ vs -e/-es MUET
    keys.sort(function(x,y){var ax=cand[x][0]===2?1:0,ay=cand[y][0]===2?1:0;if(ax!==ay)return ay-ax;
      var qx=pm(x),qy=pm(y);if(qx!==qy){   // bonus POS gardé par la DOMINANCE de fréquence : un rival édit/accent ≫20× plus fréquent écrase le bonus (Lexique pollué : « trés » N 18/M ne bat plus « très » 1435/M ; « jamal » vs « jamais »)
        if(qx>qy&&cand[y][0]>=1&&cand[y][1]>=20*cand[x][1])return 1;
        if(qy>qx&&cand[x][0]>=1&&cand[x][1]>=20*cand[y][1])return -1;
        return qy-qx;}
      var gx=gm(x),gy=gm(y);if(gx!==gy){   // même garde sur le bonus GENRE (entrées de genre polluées)
        if(gx>gy&&cand[y][0]>=1&&cand[y][1]>=20*cand[x][1])return 1;
        if(gy>gx&&cand[x][0]>=1&&cand[x][1]>=20*cand[y][1])return -1;
        return gy-gx;}
      if(inpAud){var fax=fin_aud(x),fay=fin_aud(y);if(fax!==fay)return fay-fax;}   // AUDIBILITÉ : saisie à finale /e/ écrite (é) → préférer finale AUDIBLE au -e MUET, AVANT la dominance de fréquence
      if(cand[x][0]===1&&cand[y][0]===0&&cand[x][1]>=10*cand[y][1])return -1;   // dominance : un edits1 (tier1) ≫10× plus fréquent écrase un phonétique (tier0) — autent→autant, pas hautain
      if(cand[y][0]===1&&cand[x][0]===0&&cand[y][1]>=10*cand[x][1])return 1;
      var px=phonKey(x)===pk?1:0,py=phonKey(y)===pk?1:0;if(px!==py){if(px>py&&cand[y][0]>=1&&cand[y][1]>=20*cand[x][1])return 1;if(py>px&&cand[x][0]>=1&&cand[x][1]>=20*cand[y][1])return -1;return py-px;}   // AUDIBILITÉ finale muette : garde de dominance (phonKey strippe 'est' pas 'd' → « accort »(0) matche « accor » pas « accord »(975) ; un rival ≫20× plus fréquent écrase le junk rare) — restaure -d/-t/-s muet
      var nx=nm(x),ny=nm(y);if(nx!==ny)return ny-nx;return cand[y][1]-cand[x][1];});
    var w1=keys[0],p1=cand[w1][0],f1=cand[w1][1];
    if(tok[0]!==tok[0].toLowerCase()&&deaccS(w1)!==d)return null;   // capitalisé : seule la restauration d'accent
    if(cg&&(SP.POS[w1]||'').indexOf('A')>=0){var ad=ADJP[deaccS(w1)];if(ad&&ad[0]!==cg&&cand[ad[1]]&&sGender(ad[1])===cg)return['flag',ad[1]];}
    if(f1<0.1)return null;
    var f2=keys.length>1?cand[keys[1]][1]:0,accentOnly=(p1===2&&deaccS(w1)===d),dominant=(f1>=1.0&&(f2===0||f1>=5*f2));
    if(d.length>=3&&accentOnly&&dominant)return['auto',w1];
    var na=0;for(i=0;i<keys.length;i++)if(cand[keys[i]][0]===2)na++;
    if(d.length>=3&&p1===2&&f1>=1.0&&na===1)return['auto',w1];
    var _aux=false;if(T){var _z=idx-1;while(_z>=0){var _dz=deaccS(T[_z].toLowerCase());if(SAUXAV[_dz]||SCOPULA[_dz]){_aux=true;break;}if(_dz==='ne'||_dz==='n'||_dz==='pas'||_dz==='plus'||_dz==='jamais'||_dz==='bien'||_dz==='tres'||_dz==='deja'||_dz==='toujours'||_dz==='y'||_dz==='en'||_dz==='tout'){_z--;continue;}break;}}
    if(_aux&&/e$/.test(w1)&&!/é$/.test(w1)){var _pe=w1.slice(0,-1)+'é';if(cand[_pe]&&cand[_pe][1]>=1.0)return['flag',_pe];}   // PARTICIPE APRÈS AUXILIAIRE avoir/être : le dys écrit le PRÉSENT (-e) là où l'aux impose le PARTICIPE (-é) du MÊME verbe — « il a manje/manjé »→mangé. Ne touche QUE le présent -e (jamais pris/fait/vu en -s/-t/-u) ⇒ FP=0.
    if(expPos){var _b=null,_bf=0;for(i=0;i<keys.length;i++){var _cw=keys[i];   // CONTEXTE-FIRST : candidat édit-1/accent + MÊME clé phonétique + POS attendu + NOMBRE du contexte → flag même court/non-dominant (pri→pris, von→vont, pleu→pleut ; respecte le nombre)
      if(cand[_cw][0]>=1&&phonKey(_cw)===pk&&pm(_cw)&&(!inpAud||fin_aud(_cw))&&(expPos.indexOf('V')>=0||!cn||((cn==='p')===/[sx]$/.test(deaccS(_cw))))&&cand[_cw][1]>_bf){_b=_cw;_bf=cand[_cw][1];}}   // AUDIBILITÉ : saisie à finale audible (é) → context-first ne re-choisit QUE des candidats à finale audible (manjé→mangé). Miroir app.
      if(_b&&_bf>=1.0)return['flag',_b];}
    if(!(d.length>=4&&f1>=1.0))return null;
    // CONFIANCE : n'AFFIRMER (rouge) que si sûr — accent pur, OU édit-1 gardant la 1re lettre, SEUL de son rang, dominant.
    // Sinon VIGILANCE orange « à vérifier » (n'impose pas un mauvais mot : courrir→courrier, ceuille→feuille). Mesuré sur dictées réelles.
    var firstOk=deaccS(w1).charAt(0)===d.charAt(0),nTop=0;for(i=0;i<keys.length;i++)if(cand[keys[i]][0]===p1)nTop++;
    var finalS=(p1>=1&&deaccS(w1).length===d.length+1&&deaccS(w1).slice(0,d.length)===d&&/[sx]$/.test(deaccS(w1)));   // faute dys « lettre finale muette » : candidat = original + s/x final (préfixe commun) → SÛR (FP=0 mesuré sur 2500 phrases UD ; dehor→dehors, alor→alors, moin→moins…) donc APPLIQUÉ, pas vigilance
    var confident=accentOnly||finalS||(p1>=1&&firstOk&&nTop===1&&dominant);
    return [confident?'flag':'vigilance',w1];}
  // MOVER SYNTAXIQUE de l'impératif — placement des pronoms clitiques (MIROIR de dictee/imperative_clitics.moves) → span:N
  var _IMPVOW=/[aeiouyàâäéèêëîïôöùûüh]/i,_IMPCOD3={le:1,la:1,les:1},_IMPCOI3={lui:1,leur:1},_IMPADVP={en:1,y:1},_IMPWEAK={me:1,te:1,se:1,nous:1,vous:1},_IMPNOTV={a:1,as:1,ai:1,ont:1,est:1,es:1,sont:1,fut:1,eut:1,aura:1,sera:1},_IMPCLI="(?:t'en|m'en|s'en|t'y|m'y|m'|t'|s'|l'|me|te|se|nous|vous|moi|toi|lui|leur|les|le|la|en|y)";
  function _impV(w){return !!COMMON_VERBS[deacc(w.toLowerCase())];}
  function _impUn(p){var m=/^([mts])'(en|y)$/.exec(p.toLowerCase());return m?[{m:'me',t:'te',s:'se'}[m[1]],m[2]]:[p];}
  function _impCap(o,n){return (o.charAt(0)!==o.charAt(0).toLowerCase())?n.charAt(0).toUpperCase()+n.slice(1):n;}
  function _impAff(verb,pros){pros=pros.map(function(p){return p.toLowerCase();}).sort(function(a,b){function k(p){return _IMPCOD3[p]?0:_IMPADVP[p]?2:1;}return k(a)-k(b);});
    var norm=[];for(var i=0;i<pros.length;i++){var p=pros[i],nx=pros[i+1];if(p==='me')p=_IMPADVP[nx]?"m'":'moi';else if(p==='te')p=_IMPADVP[nx]?"t'":'toi';norm.push(p);}
    var out=verb;for(i=0;i<norm.length;i++)out+=(i>0&&norm[i-1].slice(-1)==="'")?norm[i]:'-'+norm[i];return out;}
  function _impNeg(pros,verb,neg2){pros=pros.map(function(p){p=p.toLowerCase();return p==='moi'?'me':p==='toi'?'te':p;}).sort(function(a,b){function k(p){return _IMPWEAK[p]?0:_IMPCOD3[p]?1:_IMPCOI3[p]?2:p==='y'?3:4;}return k(a)-k(b);});
    var seq=pros.concat([verb]),res=[];for(var i=0;i<seq.length;i++){var t=seq[i],nx=seq[i+1],l=t.toLowerCase();res.push((nx&&_IMPVOW.test(deacc(nx.charAt(0)))&&(l==='me'||l==='te'||l==='se'||l==='le'||l==='la'))?l.charAt(0)+"'":t);}
    var ne=_IMPVOW.test(deacc(res[0].charAt(0)))?"n'":"ne",s=ne;for(i=0;i<res.length;i++)s+=(s.slice(-1)==="'")?res[i]:' '+res[i];return s+' '+neg2;}
  function _impMoves(text){var out=[],taken=[],q=text.indexOf('?')>=0,rx,m;
    function free(a,b){for(var k=a;k<b;k++)if(taken[k])return false;return true;}
    function mark(a,b){for(var k=a;k<b;k++)taken[k]=true;}
    function push(a,b,repl,nm){if(free(a,b)&&repl!==text.slice(a,b)){out.push([a,b,repl,nm]);mark(a,b);}}
    if(!q){rx=new RegExp("\\b(?:[Nn]e\\s+|[Nn]'\\s*)([A-Za-zÀ-ÿ]+)((?:-"+_IMPCLI+")+)\\s+(pas|plus|jamais|rien|point)\\b","g");
      while((m=rx.exec(text))){var verb=m[1],chain=m[2],neg2=m[3];if(!_impV(verb))continue;var pros=[];chain.split('-').filter(Boolean).forEach(function(p){pros=pros.concat(_impUn(p));});push(m.index,m.index+m[0].length,_impCap(m[0],_impNeg(pros,verb,neg2)),'impératif (pronom)');}}
    rx=new RegExp("\\b([A-Za-zÀ-ÿ]+)((?:-"+_IMPCLI+"){2,3})(?![A-Za-zÀ-ÿ'])","g");
    while((m=rx.exec(text))){var verb=m[1],chain=m[2];if(!_impV(verb))continue;var pros=[];chain.split('-').filter(Boolean).forEach(function(p){pros=pros.concat(_impUn(p));});push(m.index,m.index+m[0].length,_impCap(m[0],_impAff(verb,pros)),'impératif (pronom)');}
    rx=new RegExp("\\b([A-Za-zÀ-ÿ]+)\\s+(les|le|la)\\s+(moi|toi|lui|nous)\\b","g");
    while((m=rx.exec(text))){var verb=m[1],dv=deacc(verb.toLowerCase());if(!_impV(verb)||/ant$/.test(verb.toLowerCase())||_IMPNOTV[dv]||dv.length<3)continue;push(m.index,m.index+m[0].length,_impCap(m[0],_impAff(verb,[m[2],m[3]])),'impératif (pronom)');}
    rx=/(^|[.!?…]\s+)([A-Za-zÀ-ÿ]+)\s+(moi|toi)\b(?![-'’]?\s*(?:même|meme))/g;
    while((m=rx.exec(text))){var verb=m[2],dv=deacc(verb.toLowerCase());if(!_impV(verb)||/ant$/.test(verb.toLowerCase())||_IMPNOTV[dv]||dv.length<3)continue;var a=m.index+m[1].length,b=m.index+m[0].length,repl=_impCap(verb,verb+'-'+m[3].toLowerCase());push(a,b,repl,'impératif (pronom)');}
    rx=/(^|[.!?…]\s+)([Mm]e|[Tt]e)\s+([A-Za-zà-ÿ]+)\b/g;
    while((m=rx.exec(text))){var pron=m[2].toLowerCase(),verb=m[3];if(!_impV(verb)||/ant$/.test(verb.toLowerCase()))continue;var ton=pron==='me'?'moi':'toi',a=m.index+m[1].length,b=m.index+m[0].length;push(a,b,_impCap(m[2],verb+'-'+ton),'impératif (pronom)');}
    out.sort(function(a,b){return a[0]-b[0];});return out;}
  // ===== COUCHE VIGILANCE (portée de l'app, à l'identique — audit 07/2026 : l'extension avait 4 couches de retard,
  //       test_speller échouait au HEAD ; mêmes fonctions, mêmes données, même ordre de chaîne que l'app) =====
function spellUnknown(tok,atStart,T,idx){
    if(!SP.ready)return null;
    var low=tok.toLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae');
    if(low.length<3||!isAlphaS(low))return null;
    if(SP.WORDS.has(low)||SP.WORDS.has(deaccS(low)))return null;            // mot connu (ou connu sans accents)
    if(tok[0]!==tok[0].toLowerCase())return null;                          // majuscule → possible nom propre (Nathalie/Bordeaux) même en début de phrase → on ne flague pas (prudence)
    if(tok===tok.toUpperCase()&&tok.length>=2)return null;                  // acronyme tout-capitale
    var d=deaccS(low);
    if(!/[aeiouy]/.test(d)||/^[ivxlcdm]+$/.test(d))return null;             // sigle sans voyelle / chiffre romain
    var best=null,bf=-1,ba=-1,arr=(SP.D2A[d]||[]).slice(),i,j,w,a;          // candidat best-effort (accents + phonétique + édit-1), même initiale
    var pa=SP.PHON[phonKey(low)]||[];for(i=0;i<pa.length;i++)arr.push(pa[i]);
    var e1=sEdits1(d);for(i=0;i<e1.length;i++){a=SP.D2A[e1[i]];if(a)for(j=0;j<a.length;j++)arr.push(a[j]);}
    var _iaU=/é$/.test(low);                                               // AUDIBILITÉ (orange) : saisie à finale /e/ (é) → proposer l'audible (afolé→affolé), PAS le muet plus fréquent. Miroir app. Orange hors FP=0.
    for(i=0;i<arr.length;i++){w=arr[i];if(deaccS(w).charAt(0)!==d.charAt(0))continue;var _au=(_iaU&&/(é|ée|és|ées|er|ez|ai|ais|ait)$/.test(w))?1:0,_fq=SP.FREQ[w]||0;if(_au>ba||(_au===ba&&_fq>bf)){ba=_au;bf=_fq;best=w;}}
    return (best&&best!==low)?best:'';                                      // '' = inconnu sans suggestion fiable (simple alerte)
  }
  // VIGILANCE homophone : mot VALIDE mais probablement mal employé, dans un contexte SERRÉ → souligné orange « à vérifier »
  // (non affirmatif). Gardes étroites pour éviter les emplois légitimes (« la mer », « le fer », « papa »).
  function homoVig(T,i){var w=deaccS(T[i].toLowerCase());if(w!=='mer'&&w!=='fer'&&w!=='pa')return null;
    var p=i>0?deaccS(T[i-1].toLowerCase()):'';
    if(w==='mer'&&(p==='ma'||p==='ta'||p==='sa'||p==='notre'||p==='votre'||p==='leur'))return 'mère';   // « ma mer »→mère (≠ « la/en/une mer »)
    if(w==='fer'&&(p==='comment'||p==='pour'||p==='rien'||p==='quoi'))return 'faire';                    // « comment fer »→faire (≠ « le/du/en fer »)
    if(w==='pa'&&(p==='ne'||p==='n'||p==='sais'||p==='sait'||p==='peux'||p==='peut'||p==='veux'||p==='veut'||p==='est'||p==='es'||p==='suis'||p==='vais'||p==='va'))return 'pas';   // « sais pa »/« ne … pa »→pas
    return null;}
  // ACCORD PLURIEL (vigilance) : nom/adjectif au SINGULIER dans un GN introduit par un déterminant PLURIEL
  // (les/des/ces/mes…) → « accord pluriel à vérifier » (orange, non affirmatif). Direction de Rem (dys).
  var PLDET={les:1,des:1,ces:1,mes:1,tes:1,ses:1,nos:1,vos:1,leurs:1,plusieurs:1,quelques:1,certains:1,certaines:1,divers:1,diverses:1,autres:1};
  // CARDINAUX ≥2 : forcent le pluriel du nom compté (« cinq kilo »→kilos, « soixante mètre »→mètres). ~0,06 % FP à
  // l'échelle UD (loanwords minima/sestieri, composés à trait d'union), donc VIGILANCE orange, pas ROUGE.
  var CARD={deux:1,trois:1,quatre:1,cinq:1,six:1,sept:1,huit:1,neuf:1,dix:1,onze:1,douze:1,treize:1,quatorze:1,quinze:1,seize:1,vingt:1,trente:1,quarante:1,cinquante:1,soixante:1,cent:1,cents:1,mille:1};
  var CARDINV={cent:1,cents:1,mille:1,vingt:1,vingts:1,million:1,millions:1,milliard:1,milliards:1,demi:1,tiers:1};   // invariables/déjà-pluriel comme CIBLE → pas de +s naïf
  var CARDSTOP={super:1,tout:1,tous:1,toute:1,toutes:1,mi:1,semi:1};   // préfixes/adverbes invariables collés au cardinal → jamais cible d'accord
  function _plu(w){if(/al$/.test(w))return w.slice(0,-2)+'aux';if(/(eau|au|eu)$/.test(w))return w+'x';return w+'s';}
  function pluralVig(T,tg,i){
    if(!tg||i>=tg.length)return null;
    var w=deaccS(T[i].toLowerCase());
    if(w.length<3||/[sxz]$/.test(w))return null;                       // déjà pluriel/invariable
    if(tg[i]!=='NOUN'&&tg[i]!=='ADJ')return null;
    var c0=T[i][0];if(c0&&c0!==c0.toLowerCase())return null;           // nom propre
    for(var j=i-1;j>=0&&j>=i-4;j--){var dj=deaccS(T[j].toLowerCase());
      if(PLDET[dj]){var pl=_plu(T[i].toLowerCase());return pl!==T[i].toLowerCase()?ckeepcase(T[i],pl):null;}
      if(CARD[dj]){                                                    // cardinal ≥2 + nom singulier → pluriel (à vérifier)
        if(T[i].indexOf("'")>=0)return null;                          // élision (« quatre d'entre eux », « tous deux s'élèvent ») = pas un nom compté
        if(CARDINV[w]||CARD[w]||CARDSTOP[w])return null;              // cible = autre nombre (« cent trente »)/invariable/préfixe (super, tout)
        if(_SEG&&_SEG.hy&&_SEG.hy[i])return null;                      // « dix-septième » (ordinal composé au trait d'union)
        if(svReads(T[i]).length)return null;                          // le mot est aussi une forme verbale connue → prudence (mal taggé)
        var plc=_plu(T[i].toLowerCase());return plc!==T[i].toLowerCase()?ckeepcase(T[i],plc):null;}
      if(tg[j]==='VERB'||tg[j]==='AUX'||tg[j]==='ADP'||tg[j]==='PUNCT'||PREP[dj])break;   // sorti du GN
      if(tg[j]!=='NOUN'&&tg[j]!=='ADJ'&&tg[j]!=='DET')break;
    }
    return null;}
  var _OUV={};'est sont etait etaient sera seront es vas va vais allons allez vont habite habites habitent habitait vis vit vivent'.split(' ').forEach(function(x){_OUV[x]=1;});
  function ouVig(T,i){if(T[i].toLowerCase()!=='ou'||i+1>=T.length)return null;var nx=deacc(T[i+1].toLowerCase());
    return (_OUV[nx]||nx==='se'||nx==='ce'||nx==='je'||nx==='tu'||nx==='il'||nx==='elle'||nx==='nous'||nx==='vous'||nx==='ils'||nx==='elles')?'où':null;}   // + « ou » + pronom sujet (ou je/il/tu…) → où probable (relatif/interrogatif) ; 'on' EXCLU (« ou on…, ou on… » either/or). ORANGE (à vérifier), 0 faux sur 2500 UD.   // « ce » = graphie dys fréquente de « se » (« ou ce trouve la gare »)
  // ACCORD PARTICIPE après ÊTRE 3pl (« les élèves sont arrivé »→arrivés) → VIGILANCE orange. Miroir app : participe (VERB,
  // hors nom/adj homographe -té) après sont/étaient/furent/êtes → accord pluriel. Gardes mesurées : pronominal/être-immédiat/homographe.
  // ===== VIGILANCE-ENSEIGNANTE ces/ses (carte chaud-froid POS-free, baké dictee/ces_ses_model.json ; miroir dictee/cesses_probe.py) =====
  // NE corrige JAMAIS — TRIGGER : |score|>tau ET la carte DESACCORDE l'ecrit -> « ces ou ses ? » (l'auteur tranche, l'encart enseigne). tau serre = pas de fatigue.
  var CESSES_MODEL={"lr":{"nx2=</s>":-1.2058,"nx2=années":1.5686,"nx2=au":-1.03,"nx2=aux":-1.03,"nx2=avec":-1.197,"nx2=ce":-1.6766,"nx2=dans":-1.4483,"nx2=de":-0.7072,"nx2=en":-1.3401,"nx2=est":0.5206,"nx2=et":-0.8556,"nx2=il":-2.5639,"nx2=le":-1.3401,"nx2=les":0.47,"nx2=mais":-0.6862,"nx2=n'ont":1.3679,"nx2=ne":1.8788,"nx2=ont":0.8701,"nx2=par":0.7802,"nx2=peuvent":2.4666,"nx2=pour":-0.8293,"nx2=qui":0.7802,"nx2=se":1.2248,"nx2=sur":-2.4387,"nx2=un":-1.6766,"nx2=une":1.1166,"nx2=à":-1.3957,"nx2=étaient":1.0578,"nx=activités":-0.5191,"nx=affaires":-1.6766,"nx=amis":-2.5639,"nx=armes":0.7802,"nx=autres":-1.6766,"nx=avions":0.7802,"nx=clients":-2.2956,"nx=cours":-1.6766,"nx=coéquipiers":-1.6766,"nx=derniers":3.9329,"nx=dernières":1.5686,"nx=dessins":-1.6766,"nx=deux":1.3679,"nx=débuts":-2.9495,"nx=enfants":-2.1286,"nx=essais":-1.6766,"nx=fonctions":-1.3401,"nx=habitants":-2.4387,"nx=idées":-0.578,"nx=liens":-0.578,"nx=limites":-1.6766,"nx=membres":-1.3401,"nx=nouveaux":2.4666,"nx=nouvelles":0.6058,"nx=négociations":2.2152,"nx=origines":-1.6766,"nx=parents":-2.5639,"nx=partisans":-1.6766,"nx=plans":0.7802,"nx=plus":-1.6766,"nx=portes":-2.1286,"nx=poèmes":-1.9279,"nx=premiers":-2.1286,"nx=propres":-2.8662,"nx=prédécesseurs":-1.6766,"nx=recherches":-1.9279,"nx=relations":-1.6766,"nx=romans":-1.6766,"nx=régions":2.4666,"nx=services":-0.8293,"nx=trois":0.8571,"nx=troupes":-1.6766,"nx=yeux":-1.9279,"nx=écrits":-0.578,"nx=études":-1.8509,"nx=îles":2.2152,"nx=œuvres":-2.5639,"pos=deb":0.7308,"pos=mil":-0.6877,"pv=<s>":0.9915,"pv=après":-0.578,"pv=avec":-2.4387,"pv=chez":0.7802,"pv=des":0.7802,"pv=durant":0.7802,"pv=dès":-1.6766,"pv=entre":1.7357,"pv=et":-4.1733,"pv=faire":-1.6766,"pv=fait":-1.6766,"pv=mais":-0.578,"pv=par":-1.3401,"pv=pas":-2.1286,"pv=pendant":-1.6766,"pv=pour":-0.7766,"pv=pris":-1.6766,"pv=si":0.7802,"pv=toutes":-1.0657,"pv=à":-1.6232},"prior":-0.6587,"prune":[0.4,3],"src":"UD French-GSD (CC BY-SA 4.0)","tau":2.5};
  function _cesFeats(F,i){var n=F.length;return ['nx='+(i+1<n?F[i+1]:'</s>'),'nx2='+(i+2<n?F[i+2]:'</s>'),'pv='+(i>0?F[i-1]:'<s>'),'pos='+(i<=1?'deb':'mil')];}
  function _cesScore(F,i){var s=CESSES_MODEL.prior,fs=_cesFeats(F,i),k;for(k=0;k<fs.length;k++){if(CESSES_MODEL.lr[fs[k]]!==undefined)s+=CESSES_MODEL.lr[fs[k]];}return s;}
  function cesVig(T,i){var w=T[i].toLowerCase();if(w!=='ces'&&w!=='ses')return null;var F=[],m;for(m=0;m<T.length;m++)F.push(T[m].toLowerCase());var s=_cesScore(F,i),pred=s>=0?'ces':'ses';return (Math.abs(s)>CESSES_MODEL.tau&&pred!==w)?pred:null;}
  function cesProbe(text){text=String(text).replace(/[’ʼ]/g,"'");var T=toks(text),out=[],i,r;for(i=0;i<T.length;i++){r=cesVig(T,i);if(r&&r!==T[i].toLowerCase())out.push({i:i,word:T[i],sugg:r});}return out;}
  function participeEtreVig(T,tg,i){
    if(!tg||i<1||i>=tg.length||tg[i]!=='VERB')return null;
    var w=T[i];if(!/é$/.test(w.toLowerCase()))return null;
    var dd=deacc(w.toLowerCase());if(dd.length<4||GENDER_PURE[dd])return null;
    var a=-1;for(var j=i-1;j>=0&&j>=i-2;j--){var dj=deacc(T[j].toLowerCase());
      if(dj==='sont'||dj==='etaient'||dj==='furent'||dj==='seront'||dj==='etes'){a=j;break;}
      if(tg[j]!=='ADV')return null;}
    if(a<1)return null;
    var pvw=T[a-1].toLowerCase();if(deacc(pvw)==='se'||pvw.indexOf("'")>=0)return null;
    var fem=false;for(var k=a-1;k>=0&&k>=a-4;k--){var dk=deacc(T[k].toLowerCase());if(dk==='elles'){fem=true;break;}if(dk==='ils')break;}
    return w+(fem?'es':'s');}
  // VIGILANCE accord IMPARFAIT (personne+nombre), gate AUDIBLE : verbe imparfait + gouverneur RELÂCHÉ en désaccord +
  // forme correcte HOMOPHONE (-ais/-ait/-aient /ɛ/) → orange. Résiduel (sujet non parsable). MIROIR app + scratchpad. 0 flood/2500 UD.
  var _NEGV={pas:1,plus:1,jamais:1,rien:1,point:1};
  function _govRelax(T,i){var lo=0,j;if(_SEG){for(j=i;j>0;j--){if(j<_SEG.bb.length&&_SEG.bb[j]){lo=j;break;}}}
    var jj=i-1,s=0;while(jj>=lo&&s<3&&(CLITIC[deacc(T[jj].toLowerCase())]||_NEGV[deacc(T[jj].toLowerCase())])){jj--;s++;}
    if(jj>=lo){var pw=deacc(T[jj].toLowerCase());if(SUBJ_PRON[pw])return SUBJ_PRON[pw];}
    for(var k=i-1;k>=lo;k--){var dk=deacc(T[k].toLowerCase());
      if(CONJ_WORDS[dk])return null;
      if(SUBJ_PRON[dk])return SUBJ_PRON[dk];
      if(k>0&&NUM_DET[T[k-1].toLowerCase()]){var nb=(NUM_DET[T[k-1].toLowerCase()]==='pl'||/[sx]$/.test(dk))?'p':'s';return['3',nb];}}
    return null;}
  function imparfaitVig(T,i,tg){var lw=T[i].toLowerCase();if(lw.indexOf("'")>=0||lw.length<3)return null;
    var reads=svReads(T[i]),imp=[],k;for(k=0;k<reads.length;k++){var rk=reads[k];if(rk[1].indexOf('imp')>=0&&rk[1].indexOf('ind')>=0)imp.push(rk);}
    if(!imp.length)return null;
    if((i>=1&&FULL_AUX[deacc(T[i-1].toLowerCase())])||(i>=2&&FULL_AUX[deacc(T[i-2].toLowerCase())]))return null;
    if(i>0&&NUM_DET[T[i-1].toLowerCase()])return null;
    if(i>0&&PREP[deacc(T[i-1].toLowerCase())])return null;
    if(!tg||i>=tg.length||(tg[i]!=='VERB'&&tg[i]!=='AUX'))return null;
    if(i+1<T.length&&SUBJ_PRON[deacc(T[i+1].toLowerCase())])return null;
    var pn=_govRelax(T,i);if(!pn)return null;var per=pn[0],nb=pn[1];
    for(k=0;k<imp.length;k++)if(imp[k][2]===per&&(imp[k][3]===nb||imp[k][3]==='x'))return null;
    var lem=null,uni=true;for(k=0;k<imp.length;k++){if(lem===null)lem=imp[k][0];else if(lem!==imp[k][0])uni=false;}
    if(!uni||lem===null)return null;
    var slots=(CONJ_C[lem]||{})['ind:imp'];if(!slots)return null;var sugg=slots[per+nb];if(!sugg||sugg===lw)return null;
    if(phonKey(sugg)!==phonKey(lw))return null;
    return sugg;}
  // ===== OS-SUJET (chantier « accord par arbitrage du sujet ») — LM porte-confiance + 4 routes + mix OS μ=r/(1+r) =====
  // MIROIR dictee/os_subject_probe.py. ORANGE « accord verbe à vérifier » sur le RÉSIDUEL (sujet non parsable finement,
  // « de N » inclus) que le rouge/imparfaitVig ne touchent pas. Le LM (R4) porte la CONFIANCE qui rend le gating utile.
  var _OSLM=null, _OS_TAU=0.85;
  function setOsLm(m){
    if(!m||!m.uni){_OSLM=null;return;}
    function sums(tab){var s={},k,w,t;for(k in tab){t=0;for(w in tab[k])t+=tab[k][w];s[k]=t;}return s;}
    _OSLM={uni:m.uni,N:m.N,tf:m.tf,tb:m.tb,bf:m.bf,bb:m.bb,sTF:sums(m.tf),sTB:sums(m.tb),sBF:sums(m.bf),sBB:sums(m.bb),Vu:Object.keys(m.uni).length+1};
  }
  function _osPuni(w){return ((_OSLM.uni[w]||0)+0.5)/(_OSLM.N+0.5*_OSLM.Vu);}
  function _osPfwd(w,p2,p1){var L=_OSLM,key=p2+'\t'+p1,d=L.tf[key],db=L.bf[p1];
    return 0.6*(d?((d[w]||0)/L.sTF[key]):0)+0.3*(db?((db[w]||0)/L.sBF[p1]):0)+0.1*_osPuni(w);}
  function _osPbwd(w,n1,n2){var L=_OSLM,key=n1+'\t'+n2,d=L.tb[key],db=L.bb[n1];
    return 0.6*(d?((d[w]||0)/L.sTB[key]):0)+0.3*(db?((db[w]||0)/L.sBB[n1]):0)+0.1*_osPuni(w);}
  function _osLsc(w,p2,p1,n1,n2){return Math.log(0.5*_osPfwd(w,p2,p1)+0.5*_osPbwd(w,n1,n2)+1e-12);}
  function _osVote(x,c){return x==='s'?[0.5+0.5*c,0.5-0.5*c]:(x==='p'?[0.5-0.5*c,0.5+0.5*c]:[0.5,0.5]);}
  function _osElidedSing(w){return w.slice(0,2)==="l'";}   // « l'X » = déterminant élidé le/la (jamais les) → sujet SINGULIER (token collé que les routes rataient → elles remontaient à un pluriel lointain)
  var _osNumPl={};'deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize vingt trente quarante cinquante soixante cent cents mille plusieurs'.split(' ').forEach(function(w){_osNumPl[w]=1;});   // déterminants numéraux cardinaux ≥2 + « plusieurs » → sujet PLURIEL (« trois enfants qui vivent » ne floode plus ; « sept équipes décideront » attrapé)
  var _osPlDet2={},_osPlPhrase={};'des certains certaines quelques divers diverses maints maintes'.split(' ').forEach(function(w){_osPlDet2[w]=1;});'nombreux nombreuses beaucoup plupart'.split(' ').forEach(function(w){_osPlPhrase[w]=1;});   // déterminants PLURIELS hors numéraux + « de nombreux/beaucoup/plupart » → sujet PLURIEL (PAS « nombre »)
  function _osNumAt(F,k){if(_osElidedSing(F[k]))return 's';if(k>0){var dd=deacc(F[k-1]);if(_osNumPl[dd]||_osPlDet2[dd]||_osPlPhrase[dd])return 'p';if(NUM_DET[dd]!==undefined)return (NUM_DET[dd]==='pl'||/[sx]$/.test(deacc(F[k])))?'p':'s';}return null;}
  function _osCoordPlural(F,vi){var lo=0,j,k,d;if(_SEG){for(j=vi;j>0;j--){if(j<_SEG.bb.length&&_SEG.bb[j]){lo=j;break;}}}for(k=vi-1;k>lo;k--){if(deacc(F[k])==='et'&&k+1<vi){var inpp=false;for(d=1;d<=3;d++){if(k-d>=lo){var dq=deacc(F[k-d]);if(dq==='de'||dq==='des'||dq==='du'||dq==="d'"){inpp=true;break;}}}if(!inpp)return true;}}return false;}   // sujet COORDONNÉ « N et N » (hors PP « de X et Y ») → PLURIEL
  function _osR1(F,vi){for(var k=vi-1;k>=0;k--){var x=_osNumAt(F,k);if(x)return _osVote(x,0.85);}return [0.5,0.5];}
  function _osR2(F,vi){var k=vi-1,last=null;while(k>=0){var x=_osNumAt(F,k);if(x){last=x;var d2=(k-2>=0)?deacc(F[k-2]):'';if(k-2>=0&&(d2==='de'||d2==='des'||d2==='du'||d2==="d'")){k-=2;continue;}return _osVote(last,0.9);}k--;}return last?_osVote(last,0.7):[0.5,0.5];}
  function _osR3(F,vi){for(var k=vi-1;k>=0;k--){var x=_osNumAt(F,k);if(x){if(!_osElidedSing(F[k])&&k-2>=0&&PREP[deacc(F[k-2])])continue;return _osVote(x,0.85);}}return [0.5,0.5];}
  function _osR4(F,vi,f3s,f3p){if(!f3s||!f3p)return [0.5,0.5];
    var p2=vi>=2?F[vi-2]:'<s>',p1=vi>=1?F[vi-1]:'<s>',n1=vi+1<F.length?F[vi+1]:'</s>',n2=vi+2<F.length?F[vi+2]:'</s>';
    var ss=_osLsc(f3s,p2,p1,n1,n2),sp=_osLsc(f3p,p2,p1,n1,n2),mx=Math.max(ss,sp),es=Math.exp(ss-mx),ep=Math.exp(sp-mx),Z=es+ep;return [es/Z,ep/Z];}
  function _osMix(ds){var i,ws=[],Z=0,ps=0,pp=0;for(i=0;i<ds.length;i++){ws[i]=Math.abs(ds[i][0]-ds[i][1])+1e-6;Z+=ws[i];}for(i=0;i<ds.length;i++){ps+=ws[i]*ds[i][0];pp+=ws[i]*ds[i][1];}ps/=Z;pp/=Z;return [ps>=pp?'s':'p',Math.abs(ps-pp)];}
  function _osVinfo(form){var rd=svReads(form),p3=[],k;for(k=0;k<rd.length;k++)if(rd[k][2]==='3')p3.push(rd[k]);
    if(!p3.length)return null;var lem=p3[0][0],mts={};for(k=0;k<p3.length;k++)mts[p3[k][1]]=1;var mt=mts['ind:pre']?'ind:pre':p3[0][1];
    var nums={};for(k=0;k<p3.length;k++)if(p3[k][1]===mt)nums[p3[k][3]]=1;
    var vn=(nums.s&&!nums.p)?'s':((nums.p&&!nums.s)?'p':'?');var sl=(CONJ_C[lem]||{})[mt]||{};return [lem,mt,vn,sl['3s'],sl['3p']];}
  function _osPronBefore(F,vi){var j=vi-1,st=0;while(j>=0&&st<4&&CLITIC[deacc(F[j])]){j--;st++;}return j>=0?(SUBJ_PRON[deacc(F[j])]||null):null;}
  function _osGuardOk(F,vi){var w=F[vi];   // gardes STRUCTURELLES (miroir rAccordSVnoun/rAisAit) perdues au port OS → floodaient sur passé composé/participe/sujet-pronom. Mesuré registre chat : flood 3,5%→0%, recall inchangé. Indépendantes du sujet-OS.
    if(w.indexOf("'")>=0)return false;                                             // verbe élidé (n'est…) → autre structure
    if(/(é|és|ée|ées)$/.test(w))return false;                                      // PARTICIPE (contacté, embrassé) : accord ADJECTIVAL, pas verbal
    if(vi>0&&NUM_DET[F[vi-1]]!==undefined)return false;                            // déterminant avant → T[vi] = NOM
    if(vi>0&&PREP[deacc(F[vi-1])])return false;                                    // préposition avant → nom homographe
    if((vi>=1&&FULL_AUX[deacc(F[vi-1])])||(vi>=2&&FULL_AUX[deacc(F[vi-2])]))return false;   // temps composé (aux + participe : « ont contacté », « a montré »)
    if(_osPronBefore(F,vi)!==null)return false;                                    // sujet pronom net (je/elle…) → « je ne me trompe », « elle m'a… »
    return true;}
  function osVerbVig(T,i,tg){if(!_OSLM)return null;
    var F=[],m;for(m=0;m<T.length;m++)F.push(T[m].toLowerCase());
    if(!_osGuardOk(F,i))return null;
    var vi=_osVinfo(T[i]);if(!vi)return null;var vn=vi[2],f3s=vi[3],f3p=vi[4];if(vn==='?'||!f3s||!f3p)return null;
    if(!tg||i>=tg.length||(tg[i]!=='VERB'&&tg[i]!=='AUX'))return null;   // GATE POS : écarte les noms/adj homographes de verbes (« la côte », « influent », « la pêche ») = vrais FP. Mesuré −17 flood/−2 recall. MIROIR os_subject_probe.detect.
    var ds=[_osR1(F,i),_osR2(F,i),_osR3(F,i),_osR4(F,i,f3s,f3p)],ws=[],q;for(q=0;q<ds.length;q++)ws[q]=Math.abs(ds[q][0]-ds[q][1])+1e-6;ws[3]*=0.4;   // LM (R4) DÉ-PONDÉRÉ : biaisé-fréquence sing., ne doit pas écraser les routes structurelles concordantes (récupère « les livreurs accepte→acceptent »)
    if(_osCoordPlural(F,i)){ds.push([0.02,0.98]);var mw=0;for(q=0;q<ws.length;q++)if(ws[q]>mw)mw=ws[q];ws.push(mw+1.0);}   // route COORDINATION : « N et N » → pluriel, poids fort (tue les floods « la suède et la russie signent »→signe)
    var Zw=0,ps=0,pp=0;for(q=0;q<ds.length;q++)Zw+=ws[q];for(q=0;q<ds.length;q++){ps+=ws[q]*ds[q][0];pp+=ws[q]*ds[q][1];}ps/=Zw;pp/=Zw;var rn=ps>=pp?'s':'p',rc=Math.abs(ps-pp);
    if(rc<_OS_TAU||rn===vn)return null;
    return rn==='p'?f3p:f3s;}
  function osProbe(text){text=String(text).replace(/[’ʼ]/g,"'");_SEG=_segInfo(text);var T=toks(text),tg=posTags(T)||[],out=[],i,s;for(i=0;i<T.length;i++){s=osVerbVig(T,i,tg);if(s&&s.toLowerCase()!==T[i].toLowerCase())out.push({i:i,word:T[i],sugg:s});}return out;}   // sonde OS-seule (parité vs os_subject_probe.py)
  function spellText(text,capital){text=String(text).replace(/[’ʼ]/g,"'");_SEG=_segInfo(text);var T=toks(text),out=[],_tg=null;for(var i=0;i<T.length;i++){
    if(/^(n')?ête$/i.test(T[i])){continue;}   // « ête » → réservé à la règle grammaire rEteEtre (contexte) ; on court-circuite TOUTES les couches speller (ortho + mot-inconnu) pour éviter le double flag « ête→est ». Miroir app.
    var r=spellToken(T[i],i===0,T,i),pushed=false;
    if(r&&r[1]!==T[i].toLowerCase()){out.push({i:i,word:T[i],sugg:ckeepcase(T[i],r[1]),name:'orthographe',tier:r[0]});pushed=true;}
    if(!pushed){var u=spellUnknown(T[i],i===0,T,i);if(u!==null){out.push({i:i,word:T[i],sugg:(u||T[i]),name:'mot inconnu',tier:'vigilance'});pushed=true;}}
    if(!pushed){var h=homoVig(T,i);if(h){out.push({i:i,word:T[i],sugg:ckeepcase(T[i],h),name:'homophone à vérifier',tier:'vigilance'});pushed=true;}}
    if(!pushed){if(_tg===null)_tg=posTags(T)||[];var pv=pluralVig(T,_tg,i);if(pv){out.push({i:i,word:T[i],sugg:pv,name:'accord pluriel à vérifier',tier:'vigilance'});pushed=true;}}
    if(!pushed){if(_tg===null)_tg=posTags(T)||[];var pe=participeEtreVig(T,_tg,i);if(pe){out.push({i:i,word:T[i],sugg:pe,name:'accord participe à vérifier',tier:'vigilance'});pushed=true;}}
    if(!pushed){if(_tg===null)_tg=posTags(T)||[];if(_tg[i]==='VERB'||_tg[i]==='AUX'){var sva=rAccordSVnoun(T,i,true);   // ACCORD SUJET-VERBE mid-phrase (rouge = sujet en tête FP=0 ; orange = le reste). DOCTRINE : doute → orange, jamais silence. Fusion grammaire-prioritaire : le rouge gagne au même token.
      if(sva&&sva.toLowerCase()!==T[i].toLowerCase()){out.push({i:i,word:T[i],sugg:ckeepcase(T[i],sva),name:'accord sujet-verbe à vérifier',tier:'vigilance'});pushed=true;}}}
    if(!pushed){if(_tg===null)_tg=posTags(T)||[];var iv=imparfaitVig(T,i,_tg);if(iv&&iv.toLowerCase()!==T[i].toLowerCase()){out.push({i:i,word:T[i],sugg:ckeepcase(T[i],iv),name:'accord verbe à vérifier',tier:'vigilance'});pushed=true;}}   // -ais/-ait/-aient homophone, gouverneur relâché (résiduel orange)
    if(!pushed){if(_tg===null)_tg=posTags(T)||[];var osv=osVerbVig(T,i,_tg);if(osv&&osv.toLowerCase()!==T[i].toLowerCase()){out.push({i:i,word:T[i],sugg:ckeepcase(T[i],osv),name:'accord verbe à vérifier',tier:'vigilance'});pushed=true;}}   // OS-sujet : accord de nombre, sujet arbitré par l'OS + LM (résiduel « de N »)
    if(!pushed){var cv=cesVig(T,i);if(cv){out.push({i:i,word:T[i],sugg:ckeepcase(T[i],cv),name:'ces/ses à vérifier',tier:'vigilance'});pushed=true;}}   // carte chaud-froid ces/ses — l'auteur tranche, l'encart enseigne
    if(!pushed){var ov=ouVig(T,i);if(ov)out.push({i:i,word:T[i],sugg:ov,name:'ou/où à vérifier',tier:'vigilance'});}}   // ckeepcase : préserver la MAJUSCULE (« Ecole »→« École »)
    if(SP.ready){var done={};out.forEach(function(f){done[f.i]=1;});   // élision-espace : « c est »→« c'est », « qu il »→« qu'il »
      var er=/[A-Za-zÀ-ÿœŒ']+/g,em,P=[];while((em=er.exec(text)))P.push([em.index,em.index+em[0].length,em[0]]);
      for(var i=0;i<P.length-1;i++){if(done[i]||done[i+1])continue;
        if(!/^\s+$/.test(text.slice(P[i][1],P[i+1][0])))continue;
        var a=P[i][2].toLowerCase(),b=P[i+1][2].toLowerCase(),vow=/^[aeiouyh]/.test(deaccS(b));
        if(a==='aujourd'&&b==='hui'){out.push({i:i,word:P[i][2],sugg:P[i][2]+"'hui",name:'élision',tier:'flag',span:2});done[i]=done[i+1]=1;}
        else if(vow&&SP.WORDS.has(deaccS(b))&&((a.length===1&&'cjldmtns'.indexOf(a)>=0)||a==='qu')){out.push({i:i,word:P[i][2],sugg:P[i][2]+"'"+b,name:'élision',tier:'flag',span:2});done[i]=done[i+1]=1;}
        // sujet « je » mal écrit + AVOIR/ÊTRE 1sg à initiale VOYELLE → « j'ai/j'étais » (« ke ai », « ce avais »). Séquence IMPOSSIBLE (FP=0). Miroir app.
        else if(vow&&(a==='ke'||a==='ge'||a==='ce'||a==='se')&&/^(ai|avais|aurai|aurais|etais|eus|eusse|aie)$/.test(deaccS(b))){out.push({i:i,word:P[i][2],sugg:(/^[A-ZÀ-Ö]/.test(P[i][2])?"J'":"j'")+b,name:'élision',tier:'flag',span:2});done[i]=done[i+1]=1;}}
      // RÉPÉTITION de mot : « le le »→« le » (mot adjacent IDENTIQUE, écart BLANC). FP=0 mesuré (0/2500 UD) : denylist des doublements légitimes (nous nous, très très, oui oui…) + 2e mot non-capitalisé (nom propre redoublé « Bora Bora ») ; le trait d'union (« cha-cha ») est déjà exclu par l'écart-blanc.
      var _REPOK={nous:1,vous:1,si:1,non:1,oui:1,tres:1,bien:1,la:1,ha:1,he:1,ho:1,hi:1,eh:1,hein:1,na:1,tut:1,cha:1};
      for(var ri=0;ri<P.length-1;ri++){if(done[ri]||done[ri+1])continue;
        if(!/^\s+$/.test(text.slice(P[ri][1],P[ri+1][0])))continue;var ra=P[ri][2],rb=P[ri+1][2];
        if(ra.toLowerCase()!==rb.toLowerCase()||/^[A-ZÀ-Ö]/.test(rb)||_REPOK[deaccS(ra.toLowerCase())])continue;
        out.push({i:ri,word:ra,sugg:ra,name:'répétition',tier:'flag',span:2});done[ri]=done[ri+1]=1;}
      // ESPACEMENT français : deux mots COLLÉS par une ponctuation → on insère l'espace. FP=0 mesuré (0/2500 UD). Le POINT « . » est EXCLU (URLs « Zappos.com », abréviations) ; les chiffres ne sont pas capturés par le regex-mot → nombres/heures (« 1,2 », « 17:30 ») saufs d'office. Virgule = espace APRÈS ; « ; : ? ! » = espace AVANT+APRÈS (typo FR).
      for(var si=0;si<P.length-1;si++){if(done[si]||done[si+1])continue;
        var sgap=text.slice(P[si][1],P[si+1][0]);if(!/^[,;:?!]$/.test(sgap))continue;var sw1=P[si][2],sw2=P[si+1][2];
        out.push({i:si,word:sw1,sugg:(sgap===','?sw1+', '+sw2:sw1+' '+sgap+' '+sw2),name:'espacement',tier:'flag',span:2});done[si]=done[si+1]=1;}
      // TRAIT D'UNION manquant dans une LOCUTION FIGÉE non-ambiguë (« au dessus »→« au-dessus », « là bas »→« là-bas », « ci joint »→« ci-joint »). FP=0 mesuré : liste CURÉE d'expressions dont la forme sans trait n'a AUCUNE lecture correcte (les ambiguës « peut être »=verbe, « belle mère »=adj+nom sont EXCLUES). Clé = deacc(« w1 w2 ») → forme canonique accentuée.
      var _HYPHLOC={'au dessus':'au-dessus','au dessous':'au-dessous','au dela':'au-delà','la bas':'là-bas','la haut':'là-haut','la dessus':'là-dessus','la dessous':'là-dessous','la dedans':'là-dedans','ci dessus':'ci-dessus','ci dessous':'ci-dessous','ci contre':'ci-contre','ci joint':'ci-joint','ci jointe':'ci-jointe','ci apres':'ci-après','ci git':'ci-gît','par dessus':'par-dessus','par dessous':'par-dessous','week end':'week-end','week ends':'week-ends','porte monnaie':'porte-monnaie'};
      for(var hli=0;hli<P.length-1;hli++){if(done[hli]||done[hli+1])continue;
        if(!/^\s+$/.test(text.slice(P[hli][1],P[hli+1][0])))continue;
        var hlk=deaccS(P[hli][2].toLowerCase())+' '+deaccS(P[hli+1][2].toLowerCase()),hlv=_HYPHLOC[hlk];if(!hlv)continue;
        if(P[hli][2][0]!==P[hli][2][0].toLowerCase())hlv=hlv.charAt(0).toUpperCase()+hlv.slice(1);
        out.push({i:hli,word:P[hli][2],sugg:hlv,name:"trait d'union",tier:'flag',span:2});done[hli]=done[hli+1]=1;}
      var mv=_impMoves(text);
      for(var mi=0;mi<mv.length;mi++){var A=mv[mi][0],Bx=mv[mi][1],ki=-1,kj=-1;
        for(var k=0;k<P.length;k++){if(P[k][0]>=A&&P[k][1]<=Bx){if(ki<0)ki=k;kj=k;}}
        if(ki<0)continue;var busy=false;for(k=ki;k<=kj;k++)if(done[k]){busy=true;break;}if(busy)continue;
        out.push({i:ki,word:text.slice(P[ki][0],P[kj][1]),sugg:mv[mi][2],name:mv[mi][3],tier:'flag',span:kj-ki+1});for(k=ki;k<=kj;k++)done[k]=1;}
      out.sort(function(x,y){return x.i-y.i;});}
    if(capital&&T.length>=2&&/^[a-zà-ÿœ]/.test(T[0])&&!out.some(function(f){return f.i===0;}))out.push({i:0,word:T[0],sugg:T[0].charAt(0).toUpperCase()+T[0].slice(1),name:'majuscule initiale à vérifier',tier:'vigilance'});   // capital=true (correcteur SEULEMENT, pas en direct) : 1er mot minuscule sans autre correction → ORANGE
    return out;}

  // ===== couche dys au-dessus des flags (nom de règle → famille → stade) =====
  function flagsToFacts(flags){return (flags||[]).map(function(f){var n=f.name||'',w=f.word||'',sg=String(f.sugg||''),t;
    // classification IDENTIQUE à _corrFam de l'app (flag → famille → stade)
    if(/majuscule/.test(n))t='majuscule';                                    // convention → alphabétique
    else if(/r[ée]p[ée]tition/.test(n))t='repetition';                       // lapsus → hors-stade
    else if(w&&sg&&deacc(w.toLowerCase())===deacc(sg.toLowerCase()))t='accent';
    else if((sg.indexOf("'")>=0&&w.indexOf("'")<0)||(sg.indexOf(' ')>=0&&w.indexOf(' ')<0))t='segmentation';   // apostrophe/espace ajouté (élision, espacement)
    else if(/accord|genre/.test(n))t='accord';
    else if(/orthograph|[ée]lision|surface|inconnu/.test(n))t='surface';     // mot inconnu / graphie → alphabétique
    else t='homophone_gram';                                                 // homophones du correcteur (a/à, son/sont, ou/où) = GRAMMATICAUX → morphosyntaxique
    return {types:[t]};});}
  function diagnose(text){var flags=correctText(text);var facts=flagsToFacts(flags);var dev=developmental(facts);var rem=remedFams(facts);
    return {flags:flags,stade:dev?dev.stade:null,stadeLbl:dev?STAGE_LBL[dev.stade]:null,stadeMsg:dev?STAGE_MSG[dev.stade]:null,
            remed:rem?rem.fams.map(function(t){return REMED[t];}):[]};}
  function spell(text){return SP.ready?spellText(text):[];}                                  // flags orthographe (auto/flag) seuls
  // HINT CONTEXTUEL (identique app) : homophone = test de substitution fenêtré ±2 mots ; accord = gouverneur réel. Texte BRUT (content.js échappe).
  var _HPROBE={'a/à':['avait','« a » (verbe avoir)','« à » (préposition)'],'et/est':['était','« est » (verbe être)','« et » (= et puis)'],'son/sont':['étaient','« sont » (verbe être)','« son » (le sien)'],'on/ont':['avaient','« ont » (verbe avoir)','« on » (pronom)'],'met/mais':['mettait','« met » (verbe mettre)','« mais » (= pourtant)'],'ça/sa':['cela','« ça » (= cela)','« sa » (la sienne)'],'mais/mes':['tes','« mes » (à moi)','« mais » (= pourtant)'],'peu/peux/peut':['pouvait','« peut/peux » (verbe pouvoir)','« peu » (= pas beaucoup)']};
  function _suggVerbNum(w){var rd=svReads(w),hp=false,hs=false,k;for(k=0;k<rd.length;k++){if(rd[k][2]!=='3')continue;if(rd[k][3]==='p'||rd[k][3]==='x')hp=true;else if(rd[k][3]==='s')hs=true;}return (hp&&!hs)?'pl':((hs&&!hp)?'sg':null);}   // nombre de la forme SUGGÉRÉE lue comme verbe 3e pers. ('pl'/'sg'/null) — détecte le gouverneur ARRIÈRE contradictoire (miroir app)
  function ctxHint(f,T){var i=f.i;if(typeof i!=='number'||!T||i>=T.length)return '';
    var h=_HPROBE[f.name];
    if(h){var a=Math.max(0,i-2),b=Math.min(T.length,i+3),win=T.slice(a,b);win[i-a]=h[0];
      return 'Astuce : remplace par « '+h[0]+' ». « '+(a>0?'…':'')+win.join(' ')+(b<T.length?'…':'')+' » se dit ? oui → '+h[1]+' · non → '+h[2]+'.';}
    var n=f.name||'';
    if(n.indexOf('ces/ses')>=0)return '« ces » = ces choses-là, on montre (ces livres) ; « ses » = les siens, à lui ou elle (il range ses livres). Qui possède ?';   // carte chaud-froid : l'auteur tranche, l'encart enseigne
    if(/\(dont\)/.test(n))return '« dont » reprend un complément avec « de » : le participe passé reste invariable (les fleurs dont il a parlé).';   // AVANT le gouverneur : « dont » = participe INVARIABLE, pas d'accord (sinon indice contradictoire)
    if(/\(COD/.test(n))return 'Avec « avoir », le participe s\'accorde avec le COD placé AVANT (les fleurs que j\'ai cueillies) — pas avec le sujet.';   // gouverneur = COD antéposé, pas le sujet
    if(/tout/.test(n))return '« tout » s\'accorde avec le nom qui SUIT (tous les jours, toutes les nuits).';   // s'accorde avec ce qui suit, pas avec un mot d'avant
    if((/accord/.test(n)&&!/é\/er|grammatical|dont|COD|tout/.test(n))||/genre/.test(n)){
      var g=null,lab='';
      if(/genre/.test(n)){var gg=governorGender(T,i);if(gg){g=gg[0];lab=gg[1]==='f'?'féminin':'masculin';}}
      if(!g){var gn=governorNumber(T,i,isVerb(T,i)||isParticiple(T,i));
        if(gn){var svn=_suggVerbNum(f.sugg||'');if(svn&&svn!==gn[1])return '';   // sujet POSTPOSÉ/coordonné (rPostpose…) : contrôleur EN AVANT ; gouverneur arrière contredit la suggestion (nombre ≠) → pas d'indice contradictoire (miroir app _accHint)
          g=gn[0];lab=(gn[1]==='pl'?'pluriel':'singulier');}}
      if(g)return 'C\'est « '+g+' » ('+lab+') qui commande → on accorde « '+(f.sugg||'')+' ».';}
    return '';}
  function diagnoseAll(text){var gf=correctText(text),sf=SP.ready?spellText(text):[];        // grammaire + orthographe fusionnés + stade
    var byTok={};gf.forEach(function(f){byTok[f.i]=f;});sf.forEach(function(f){if(byTok[f.i]==null)byTok[f.i]=f;
      else if(f.span>=2&&(byTok[f.i].span==null||byTok[f.i].span<2)&&byTok[f.i].tier!=='vigilance'&&typeof f.sugg==='string'&&typeof byTok[f.i].sugg==='string'&&typeof f.word==='string'&&f.sugg.slice(0,f.word.length)===f.word){f.sugg=byTok[f.i].sugg+f.sugg.slice(f.word.length);byTok[f.i]=f;}});   // COLLISION grammaire mono-mot (majuscule) sur le 1er mot d'un span:2 speller → FUSIONNER (parité app _computeCorrs), sinon l'espace/tiret est perdu
    var flags=Object.keys(byTok).map(function(k){return byTok[k];}).sort(function(a,b){return a.i-b.i;});
    var _cov={};flags.forEach(function(f){if(f.span===2)_cov[f.i+1]=1;});flags=flags.filter(function(f){return !_cov[f.i];});   // un token couvert par une élision (span 2) ne compte pas 2× (parité AUDIT #4)
    var _Tt=toks(text);flags.forEach(function(f){var hh=ctxHint(f,_Tt);if(hh)f.hint=hh;});   // hint contextuel par correction (affiché AU CLIC dans content.js)
    var facts=flagsToFacts(flags),dev=developmental(facts),rem=remedFams(facts);
    return {flags:flags,grammar:gf,spell:sf,stade:dev?dev.stade:null,stadeLbl:dev?STAGE_LBL[dev.stade]:null,stadeMsg:dev?STAGE_MSG[dev.stade]:null,
            remed:rem?rem.fams.map(function(t){return REMED[t];}):[]};}

  // ===== chargement lexiques =====
  var _ready=false,_loading=null;
  function setLex(vd,genderRelaxedText,spellerTSV){_applyVdc(vd||{});if(genderRelaxedText)_applyGenderRelaxed(genderRelaxedText);if(spellerTSV)_applySpellerTSV(spellerTSV);_ready=true;}
  function loadLex(urls){            // urls = { vdc:url, genderRelaxed:url(.gz), speller:url(.gz), pos:url(.gz), nom:url(.gz) }
    if(urls&&urls.speller)loadSpellerLex(urls.speller);   // orthographe : additif, indépendant (SP.ready quand prêt)
    if(urls&&urls.nom)loadNounPost(urls.nom);             // posterior §3 du pluriel du nom (noun-post) : additif, indépendant
    if(urls&&urls.hmm)loadPosHmm(urls.hmm);               // POS-tagger HMM (pos-hmm.json.gz) : additif, indépendant
    if(urls&&urls.osLm)loadOsLm(urls.osLm);               // LM OS-sujet (os-subj-lm.json.gz) : additif, orange accord verbe
    if(_ready)return Promise.resolve(true);
    if(_loading)return _loading;
    _loading=(async function(){
      try{
        var vd=await (await fetch(urls.vdc)).json();_applyVdc(vd);
        if(urls.genderRelaxed){
          var gz=await (await fetch(urls.genderRelaxed)).arrayBuffer();
          var st=new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'));
          _applyGenderRelaxed(await new Response(st).text());
        }
        _ready=true;return true;
      }catch(e){_ready=false;return false;}
    })();
    return _loading;
  }

  // ===== COMPLÉTION (aide-frappe) — mots plus longs pour un préfixe. HORS PARITÉ (suggestion d'UI, pas un flag FP=0).
  // Réutilise le speller accentué SP (D2A = déacc→formes accentuées, déjà trié fréquence). Identique app.
  var _compKeys=null;
  function complete(prefix){
    if(!SP.ready)return [];var p=deaccS(String(prefix).toLowerCase());if(p.length<2||!isAlphaS(p))return [];
    if(_compKeys===null)_compKeys=Object.keys(SP.D2A).sort();
    var lo=0,hi=_compKeys.length,mid;while(lo<hi){mid=(lo+hi)>>1;if(_compKeys[mid]<p)lo=mid+1;else hi=mid;}
    var out=[],i=lo,k,forms,w;
    while(i<_compKeys.length&&_compKeys[i].slice(0,p.length)===p){forms=SP.D2A[_compKeys[i]];
      for(k=0;k<forms.length;k++){w=forms[k];if(deaccS(w).length>p.length&&(SP.FREQ[w]||0)>=1)out.push(w);}i++;if(out.length>800)break;}   // PLANCHER FRÉQUENCE (≥1) : l'aide-frappe ne propose que des mots courants ; sur une faute (pome) → vide → la correction prend le relais. Miroir app.
    out.sort(function(a,b){return (SP.FREQ[b]||0)-(SP.FREQ[a]||0);});
    var seen={},res=[];for(i=0;i<out.length&&res.length<6;i++){if(!seen[out[i]]){seen[out[i]]=1;res.push(out[i]);}}
    return res;}
  // ===== couche VERTE « vigilance » (confusables) — n'AFFIRME pas → hors FP=0 ; HORS PARITÉ. Identique à l'app.
  // Le contexte ne sert QU'À ATTÉNUER (sûr) ; on ne pousse JAMAIS une autre forme (le modèle peut être confidemment faux).
  var _CONFBF=null,_CONFW=4;
  function setConfusables(j){_CONFW=(j&&j.win)||4;_CONFBF={};((j&&j.groups)||[]).forEach(function(g){g.forms.forEach(function(f){if(f.indexOf(' ')<0)_CONFBF[f.toLowerCase()]=g;});});}
  function loadConfusables(url){return fetch(url).then(function(r){return r.json();}).then(function(j){setConfusables(j);return true;}).catch(function(){return false;});}
  function _vigSc(g,f,ctx){var s=(g.prior&&g.prior[f]!=null)?g.prior[f]:0,c=g.ctx&&g.ctx[f],fl=(g.floor&&g.floor[f]!=null)?g.floor[f]:0,i;if(c)for(i=0;i<ctx.length;i++)s+=(c[ctx[i]]!=null?c[ctx[i]]:fl);return s;}
  function _vigOne(word,ctx){if(!_CONFBF)return null;var lw=word.toLowerCase(),g=_CONFBF[lw];if(!g)return null;
    if(g.prior){var r=Object.keys(g.prior).map(function(f){return [f,_vigSc(g,f,ctx)];}).sort(function(a,b){return b[1]-a[1];});
      if(r.length>=2&&r[0][0]===lw&&(r[0][1]-r[1][1])>3)return null;}   // ATTÉNUE : contexte confirme nettement la forme écrite → pas de marque
    return g.forms.filter(function(f){return f.indexOf(' ')<0;}).map(function(f){return (g.gloss&&g.gloss[f])?f+' ('+g.gloss[f]+')':f;}).join(' · ');}
  function vigText(text){if(!_CONFBF)return [];var T=toks(text),out=[],seen={},i,j,a,b,ctx,info,lw;
    for(i=0;i<T.length;i++){lw=T[i].toLowerCase();if(seen[lw])continue;ctx=[];a=Math.max(0,i-_CONFW);b=Math.min(T.length-1,i+_CONFW);
      for(j=a;j<=b;j++)if(j!==i)ctx.push(T[j].toLowerCase());
      info=_vigOne(T[i],ctx);if(info){seen[lw]=1;out.push({word:T[i],info:info});}}
    return out;}
  global.DYSCORE={
    correctText:correctText, diagnose:diagnose, developmental:developmental, remedFams:remedFams,
    flagsToFacts:flagsToFacts, REMED:REMED, STAGE_LBL:STAGE_LBL, STAGE_MSG:STAGE_MSG, STAGE_FAM:STAGE_FAM,
    spell:spell, spellText:spellText, diagnoseAll:diagnoseAll, loadSpellerLex:loadSpellerLex,
    spellerReady:function(){return SP.ready;}, complete:complete,
    setNounPost:_applyNounPost, loadNounPost:loadNounPost,
    posTags:posTags, setPosHmm:setPosHmm, loadPosHmm:loadPosHmm, setOsLm:setOsLm, loadOsLm:loadOsLm, osProbe:osProbe, cesProbe:cesProbe,
    toks:toks, deacc:deacc, loadLex:loadLex, setLex:setLex, isReady:function(){return _ready;}, lexSize:function(){return (SP&&SP.WORDS)?SP.WORDS.size:null;},
    vigText:vigText, loadConfusables:loadConfusables, setConfusables:setConfusables, runonText:runonText
  };
})(typeof self!=='undefined'?self:(typeof globalThis!=='undefined'?globalThis:this));
