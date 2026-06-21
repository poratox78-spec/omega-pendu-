// dys-core.js — MOTEUR correcteur dys, COPIE VERBATIM du moteur de app/omega-pendu.html (correcteur).
// Sans DOM, sans UI : utilisable dans un content-script, un worker ou Node. Parité avec le probe Python
// (dictee/correcteur_probe.py) — vérifiée par extension/parity_core.js. Lexiques chargés depuis les assets
// de l'extension (loadLex, fetch+DecompressionStream) ou injectés directement (setLex, pour Node/tests).
// Données dérivées Lexique 4 → CC BY-SA 4.0.
(function (global) {
  'use strict';

  // ===== normalisation =====
  function deacc(s){return s.normalize('NFD').replace(/[̀-ͯ]/g,'');}
  function toks(s){return (s.match(/[A-Za-zÀ-ÿœŒ']+/g)||[]);}

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
  var STAGE_FAM={voisee_sourde:'phonologique',inversion:'phonologique',ajout:'phonologique',surface:'alphabetique',accent:'alphabetique',muette:'lexical',homophone:'lexical',accord:'morphosyntaxique'};
  var STAGE_ORDER=['phonologique','alphabetique','lexical','morphosyntaxique'];
  var STAGE_LBL={phonologique:'phonologique (le son)',alphabetique:'alphabétique (écrit au son)',lexical:'lexical (orthographe du mot)',morphosyntaxique:'morphosyntaxique (grammaire)'};
  var STAGE_MSG={phonologique:'travaille le SON (conscience phonémique) : sourde/sonore, inversions, lettres en trop.',alphabetique:'écrit « comme ça sonne » : passer du son à l’orthographe conventionnelle (accents, graphies).',lexical:'orthographe du MOT : lettres muettes, homophones lexicaux.',morphosyntaxique:'GRAMMAIRE : accords en genre/nombre/verbal (le palier le plus tardif).'};
  function stageOfFact(types){var best=-1;(types||[]).forEach(function(t){var st=STAGE_FAM[t];if(st){var k=STAGE_ORDER.indexOf(st);if(k>best)best=k;}});return best<0?null:STAGE_ORDER[best];}
  function developmental(F){var c={},tot=0,i;for(i=0;i<STAGE_ORDER.length;i++)c[STAGE_ORDER[i]]=0;F.forEach(function(f){var st=stageOfFact(f.types);if(st){c[st]++;tot++;}});if(!tot)return null;for(i=0;i<STAGE_ORDER.length;i++)if(c[STAGE_ORDER[i]]>0)return{stade:STAGE_ORDER[i]};return null;}
  var REMED={
    voisee_sourde:'Sourde/sonore : pose la main sur ta gorge — b, d, g, v, z, j FONT vibrer ; p, t, k, f, s, ch non. Allonge le son avant d’écrire.',
    inversion:'Inversion de lettres : découpe le mot en SYLLABES et écris-les dans l’ordre (ta-bleau), en suivant du doigt de gauche à droite.',
    ajout:'Lettres en trop : relis en COMPTANT les sons que tu entends — un son = une lettre attendue, pas plus.',
    surface:'Écrit « comme ça sonne » : compare au mot MODÈLE (carte-mot). Un même son a plusieurs graphies (/s/ → s, ss, c, ç).',
    accent:'Accents : é (fermé) et è/ê (ouvert) ne sonnent pas pareil. Dis le mot à voix haute pour choisir l’accent.',
    muette:'Lettre muette finale : trouve un mot de la MÊME FAMILLE où on l’entend (petit→petitE, tard→tardIf, chant→chantEr).',
    homophone:'Homophones : REMPLACE par un mot test (a→avait, et→et puis, son→le sien). Si la phrase tient encore, c’est la bonne forme.',
    accord:'Accord : repère QUI COMMANDE (le sujet, le déterminant) et accorde en genre/nombre (les chats → jouENT ; la voiture → bleuE).'
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
  var GENDER_MAP={},GENDER_PURE={},ADJP={};var CONJ_F={},CONJ_C={};
  function _applyVdc(vd){(vd.v||[]).forEach(function(w){COMMON_VERBS[w]=1;});GENDER_MAP=vd.g||{};GENDER_PURE=vd.gn||{};ADJP=vd.a||{};var cj=vd.cj||{};CONJ_F=cj.f||{};CONJ_C=cj.c||{};}
  function _applyGenderRelaxed(txt){var lines=txt.split('\n');for(var k=0;k<lines.length;k++){var ln=lines[k];if(!ln)continue;var p=ln.split('\t');if(p.length<2)continue;if(GENDER_PURE[p[0]]===undefined)GENDER_PURE[p[0]]=(p[1]==='1'?'f':'m');}}
  function lexicalGender(T,idx){if(!GENDER_MAP)return null;var j,w,g;
    for(j=idx-1;j>=Math.max(0,idx-3);j--){w=T[j].toLowerCase();if(NUM_PRON[w]||PREP[deacc(w)])break;g=GENDER_MAP[deacc(w)];if(g==='m'||g==='f')return[T[j],g];}
    for(j=idx+1;j<Math.min(T.length,idx+3);j++){w=T[j].toLowerCase();if(NUM_PRON[w]||PREP[deacc(w)])break;g=GENDER_MAP[deacc(w)];if(g==='m'||g==='f')return[T[j],g];}
    return null;}
  var MODAL={};("veux veut veulent peux peut peuvent dois doit doivent va vais vas vont faut sais sait aime aimes aiment adore espere souhaite prefere preferent vient viens allons allez laisse laissent semble ose pour sans afin de").split(/\s+/).forEach(function(w){MODAL[w]=1;});
  var CAUX={};Object.keys(AUX_ETRE).forEach(function(k){CAUX[k]=1;});Object.keys(AUX_AVOIR).forEach(function(k){CAUX[k]=1;});
  function cprev(T,i){return i>0?deacc(T[i-1].toLowerCase()):null;}
  var VSTOP={};['ne','me','te','se','le','la','les',"l'",'en','y','que','qu','qui','si','ou','et','ni','car','or','ce','ces','de','des','du'].forEach(function(w){VSTOP[w]=1;});Object.keys(NUM_DET).forEach(function(w){VSTOP[w]=1;});Object.keys(NUM_PRON).forEach(function(w){VSTOP[w]=1;});
  function vlike(T,i){if(i<0||i>=T.length)return false;if(isVerb(T,i))return true;var w=deacc(T[i].toLowerCase());if(VSTOP[w])return false;return !!COMMON_VERBS[w]&&!(i>0&&NUM_DET[T[i-1].toLowerCase()]);}
  function cpl(T,j){if(j<0||j>=T.length)return false;var dw=deacc(T[j].toLowerCase());if(!/[sx]$/.test(dw))return false;return j>0&&NUM_DET[T[j-1].toLowerCase()]==='pl';}
  function rEer(T,i){var w=T[i],lw=w.toLowerCase(),f;if(lw.indexOf("'")>=0)return null;if(/é$/.test(lw))f=[w,w.slice(0,-1)+'er'];else if(/er$/.test(deacc(lw))&&lw.length>3)f=[w.slice(0,-2)+'é',w];else return null;if(!COMMON_VERBS[deacc(f[1].toLowerCase())])return null;if(i===0)return null;var praw=T[i-1].toLowerCase();if(praw==='à')return f[1];var p=cprev(T,i);if(CAUX[p])return f[0];if(PREP[p]||MODAL[p])return f[1];return null;}
  function rSon(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='son'&&lw!=='sont')return null;if(i===0)return 'son';var pl=T[i-1].toLowerCase();if(vlike(T,i-1)||PREP[deacc(pl)]||pl==='et'||pl==='ou'||pl==='ni')return 'son';if(pl==='ils'||pl==='elles'||cpl(T,i-1))return 'sont';return null;}
  function rOn(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='on'&&lw!=='ont')return null;var p=cprev(T,i);if(p==='ils'||p==='elles'||cpl(T,i-1))return 'ont';var nx=i+1<T.length?T[i+1].toLowerCase():'';if(/és?$/.test(nx)||/ées?$/.test(nx)||isParticiple(T,i+1))return 'ont';if(vlike(T,i+1))return 'on';return null;}
  var INVAR_NOUN={pays:1,temps:1,prix:1,poids:1,corps:1,fois:1,mois:1,cas:1,bras:1,dos:1,nez:1,choix:1,voix:1,croix:1,bois:1,univers:1,succes:1,progres:1,repas:1,avis:1,sens:1,cours:1,concours:1,discours:1,jus:1,tas:1,os:1,puits:1,bus:1,virus:1,tennis:1,colis:1,devis:1,permis:1,compromis:1,paradis:1,velours:1,dais:1};
  var MAIS_STOP={pas:1,plus:1,moins:1,point:1,rien:1,tout:1,tres:1,jamais:1,surtout:1,aussi:1,encore:1,toujours:1,comment:1,pourquoi:1,peu:1,trop:1,bien:1,non:1,oui:1,si:1,assez:1,enfin:1,donc:1,car:1,alors:1,ici:1,la:1};
  function rLeur(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='leur'&&lw!=='leurs')return null;if(i+1>=T.length)return null;if(vlike(T,i+1))return 'leur';var dn=deacc(T[i+1].toLowerCase());if(INVAR_NOUN[dn])return 'leur';return /[sx]$/.test(dn)?'leurs':'leur';}
  function rA(T,i){if(deacc(T[i].toLowerCase())!=='a')return null;var p=cprev(T,i);if(p==='il'||p==='elle'||p==='on'||p==='qui'||p==='ca'||p==='c')return 'a';if(i+1<T.length&&isParticiple(T,i+1))return 'a';if(vlike(T,i-1))return 'à';return null;}
  function rEt(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='et'&&lw!=='est')return null;var p=cprev(T,i);if(!(p==='il'||p==='elle'||p==='on'||p==='c'||p==='ce'||p==='ca'||p==='qui'))return null;if(i+1<T.length&&(isParticiple(T,i+1)||!(T[i+1].toLowerCase() in NUM_DET)))return 'est';return null;}
  function rPeu(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='peu'&&lw!=='peux'&&lw!=='peut')return null;var p=cprev(T,i);if(p==='je'||p==='tu')return 'peux';if(p==='il'||p==='elle'||p==='on'||p==='qui')return 'peut';if(p==='un'||p==='de'||p==='tres'||p==='si'||p==='trop'||p==='assez'||p==='bien'||p==='plus'||p==='tout'||p==='aussi'||p==='y')return 'peu';return null;}
  function rCe(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='ce'&&lw!=='se')return null;if(i+1>=T.length)return null;var nd=deacc(T[i+1].toLowerCase());if(nd==='qui'||nd==='que'||nd==='dont')return 'ce';if(CAUX[nd]||nd==='sont'||nd==='est')return null;var isv=vlike(T,i+1),isn=!!GENDER_MAP[nd];if(isv&&!isn)return 'se';if(isn&&!isv)return 'ce';return null;}
  function rMais(T,i){if(deacc(T[i].toLowerCase())!=='mais'||i+1>=T.length)return null;
    var nx=T[i+1].toLowerCase(),dn=deacc(nx);
    if(MAIS_STOP[dn])return null;   // adverbe/mot-outil homographe d'un nom (« mais pas »/« mais comment ») → conjonction, pas « mes »
    if(PREP[dn]||NUM_DET[nx]||NUM_PRON[dn]||vlike(T,i+1))return null;
    return GENDER_PURE[dn]?ckeepcase(T[i],'mes'):null;}
  function rJest(T,i){if(deacc(T[i].toLowerCase())!=="j'est"||i+1>=T.length)return null;   // « j'est » jamais valide
    var dn=deacc(T[i+1].toLowerCase());
    return (NUM_DET[T[i+1].toLowerCase()]||dn==='ete'||dn==='eu')?ckeepcase(T[i],"j'ai"):null;}   // j'est un/le… ou j'est été/eu → j'ai (avoir)
  function rCai(T,i){return deacc(T[i].toLowerCase())==="c'ai"?ckeepcase(T[i],"c'est"):null;}   // « c'ai » jamais valide (avoir au lieu d'être) → c'est
  var SUBJ_PRON={je:['1','s'],tu:['2','s'],il:['3','s'],elle:['3','s'],on:['3','s'],ils:['3','p'],elles:['3','p']};
  var CLITIC={};['ne','me','te','se','le','la','les','lui','leur','y','en','nous','vous',"l'","m'","t'","s'","n'"].forEach(function(w){CLITIC[w]=1;});
  function svReads(w){var s=CONJ_F[deacc(w.toLowerCase())];if(!s)return[];var r=[],a=s.split('|'),k,f;for(k=0;k<a.length;k++){f=a[k].split(';');if(f.length===4)r.push(f);}return r;}
  function svSubject(T,i){var j=i-1,st=0;while(j>=0&&st<3&&CLITIC[deacc(T[j].toLowerCase())]){j--;st++;}if(j<0)return null;return SUBJ_PRON[deacc(T[j].toLowerCase())]||null;}
  function svAgrees(reads,per,nb){var k;if(per==='3'){for(k=0;k<reads.length;k++)if(reads[k][2]===per&&(reads[k][3]===nb||reads[k][3]==='x'))return true;return false;}for(k=0;k<reads.length;k++)if(reads[k][2]===per)return true;return false;}
  function rAccordSV(T,i){if(T[i].toLowerCase().indexOf("'")>=0)return null;var reads=svReads(T[i]);if(!reads.length)return null;var pn=svSubject(T,i);if(!pn)return null;var per=pn[0],nb=pn[1];
    if(deacc(T[i].toLowerCase())==='peut'&&i+1<T.length&&deacc(T[i+1].toLowerCase())==='etre')return null;
    if(svAgrees(reads,per,nb))return null;var lem=null,k,mts={},uni=true;for(k=0;k<reads.length;k++){if(lem===null)lem=reads[k][0];else if(lem!==reads[k][0])uni=false;mts[reads[k][1]]=1;}
    if(!uni||lem===null)return null;var mt=mts['ind:pre']?'ind:pre':reads[0][1];var slots=(CONJ_C[lem]||{})[mt];if(!slots)return null;var sugg=slots[per+nb];if(!sugg)return null;
    if(!svAgrees(svReads(sugg),per,nb))return null;return sugg;}
  var CONJ_WORDS={};('et ou ni mais car donc or que qu qui quand comme si lorsque puisque dont lequel laquelle lesquels lesquelles').split(' ').forEach(function(w){CONJ_WORDS[w]=1;});
  function svNounSubjNum(T,i){var j=i-1,st=0;while(j>=0&&st<2&&CLITIC[deacc(T[j].toLowerCase())]){j--;st++;}
    for(var k=j;k>=0;k--){var w=deacc(T[k].toLowerCase());if(NUM_PRON[w])return null;
      if(NUM_DET[T[k].toLowerCase()]){if(k>0&&PREP[deacc(T[k-1].toLowerCase())])continue;return [NUM_DET[T[k].toLowerCase()]==='pl'?'p':'s',k];}}return null;}
  function rAccordSVnoun(T,i){if(T[i].toLowerCase().indexOf("'")>=0||T[i].toLowerCase()==='à')return null;
    if(i>0&&NUM_DET[T[i-1].toLowerCase()])return null;if(svSubject(T,i)!=null)return null;
    var reads=svReads(T[i]),p3=[],k;for(k=0;k<reads.length;k++)if(reads[k][2]==='3')p3.push(reads[k]);if(!p3.length)return null;
    var sub=svNounSubjNum(T,i);if(!sub)return null;var nb=sub[0],dk=sub[1];
    if(nb!=='p'||dk!==0||i-dk<2)return null;
    for(var m=dk+1;m<i;m++){var tk=T[m],dw=deacc(tk.toLowerCase());
      if(tk.toLowerCase().indexOf("'")>=0||PREP[dw]||NUM_DET[tk.toLowerCase()]||NUM_PRON[dw]||CONJ_WORDS[dw])return null;
      if(m>dk+1&&svReads(tk).length)return null;}
    for(k=0;k<p3.length;k++)if(p3[k][3]==='p'||p3[k][3]==='x')return null;
    var lem=null,uni=true,mts={};for(k=0;k<p3.length;k++){if(lem===null)lem=p3[k][0];else if(lem!==p3[k][0])uni=false;mts[p3[k][1]]=1;}
    if(!uni||lem===null)return null;var mt=mts['ind:pre']?'ind:pre':p3[0][1];var slots=(CONJ_C[lem]||{})[mt];if(!slots)return null;var sugg=slots['3'+nb];if(!sugg)return null;
    var sr=svReads(sugg),okk=false;for(k=0;k<sr.length;k++)if(sr[k][2]==='3'&&(sr[k][3]===nb||sr[k][3]==='x'))okk=true;if(!okk)return null;return sugg;}
  var DET_G={un:'m',une:'f',le:'m',la:'f',ce:'m',cet:'m',cette:'f',mon:'m',ma:'f',ton:'m',ta:'f',son:'m',sa:'f'};
  var DET_A={'un|f':'une','une|m':'un','le|f':'la','la|m':'le','ce|f':'cette','cet|f':'cette','cette|m':'ce','mon|f':'ma','ma|m':'mon','ton|f':'ta','ta|m':'ton','son|f':'sa','sa|m':'son'};
  function ckeepcase(src,sg){var c=src.charAt(0);return (c!==c.toLowerCase())?sg.charAt(0).toUpperCase()+sg.slice(1):sg;}
  function rDetGenre(T,i){var lw=deacc(T[i].toLowerCase());if(!DET_G[lw]||T[i].toLowerCase().indexOf("'")>=0)return null;if(i+1>=T.length)return null;
    var gd=DET_G[lw],nr=T[i+1].toLowerCase();if(nr.indexOf("'")>=0)return null;var nd=deacc(nr);if(nd.length<2||!/^[a-z]+$/.test(nd))return null;
    if((lw==='son'||lw==='mon'||lw==='ton')&&/^[aeiouyh]/.test(nd))return null;   // son/mon/ton OBLIGATOIRES devant voyelle/h (son amie, son Histoire) — pas un FP
    var gn=GENDER_PURE[nd];if(gn!=='m'&&gn!=='f')return null;if(gn===gd)return null;var sg=DET_A[lw+'|'+gn];return sg?ckeepcase(T[i],sg):null;}
  var CRULES=[['accord grammatical (é/er)',rEer],['son/sont',rSon],['on/ont',rOn],['leur/leurs',rLeur],['a/à',rA],['et/est',rEt],['peu/peux/peut',rPeu],['ce/se',rCe],['mais/mes',rMais],["j'est/j'ai",rJest],["c'ai/c'est",rCai],['accord sujet-verbe',rAccordSV],['accord sujet-verbe',rAccordSVnoun],['genre déterminant',rDetGenre]];
  function correctText(text){var T=toks(text),out=[];for(var i=0;i<T.length;i++){for(var r=0;r<CRULES.length;r++){var dec=CRULES[r][1](T,i);if(dec!=null&&dec.toLowerCase()!==T[i].toLowerCase()){out.push({i:i,word:T[i],sugg:dec,name:CRULES[r][0]});break;}}}return out;}

  // ===== Correcteur ORTHOGRAPHIQUE (non-mots/accents/typos) — VERBATIM app (miroir dictee/speller_probe.py) =====
  // Seule différence vs app : loadSpellerLex fetch l'asset gzip (extension) au lieu de lire le bloc DOM speller-lex-gz.
  function deaccS(s){return s.replace(/œ/g,'oe').replace(/Œ/g,'OE').replace(/æ/g,'ae').replace(/Æ/g,'AE').normalize('NFD').replace(/[̀-ͯ]/g,'');}
  function isAlphaS(s){for(var i=0;i<s.length;i++){var c=deaccS(s[i]).toLowerCase();if(c<'a'||c>'z')return false;}return true;}
  function phonKey(s){s=s.toLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae').replace(/ç/g,'s');s=deaccS(s);
    s=s.replace(/ph/g,'f').replace(/sch/g,'ch').replace(/th/g,'t').replace(/ch/g,'§').replace(/gn/g,'¤');
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
  var SELIDE={l:1,m:1,t:1,s:1,n:1,d:1,c:1,j:1},SVOW={a:1,e:1,i:1,o:1,u:1,y:1,h:1};
  function _applySpellerTSV(txt){SP.WORDS=new Set();var lines=txt.split('\n');
    for(var k=0;k<lines.length;k++){var ln=lines[k];if(!ln)continue;var pr=ln.split('\t');if(pr.length<2)continue;
      var w=pr[0],fr=parseInt(pr[1],10)/1000;SP.WORDS.add(w);SP.FREQ[w]=fr;if(pr[2])SP.POS[w]=pr[2];
      var d=deaccS(w);(SP.D2A[d]||(SP.D2A[d]=[])).push(w);
      if(fr>=0.1){var pk=phonKey(w);(SP.PHON[pk]||(SP.PHON[pk]=[])).push(w);}}
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
  function sGender(w){var dw=deaccS(w);if((SP.POS[w]||'').indexOf('A')>=0){var a=ADJP[dw];if(a)return a[0];}var g=GENDER_PURE[dw]||GENDER_MAP[dw];return (g==='m'||g==='f')?g:null;}
  function sCtxGender(T,idx){if(!T||idx==null)return null;for(var j=idx-1;j>=Math.max(0,idx-4);j--){var t=deaccS(T[j].toLowerCase());if(SCOPULA[t])continue;if(DET_G[t])return DET_G[t];var g=GENDER_PURE[t];if(g==='m'||g==='f')return g;}return null;}
  function sCtxNumber(T,idx){if(!T||idx==null)return null;for(var j=idx-1;j>=Math.max(0,idx-4);j--){var t=deaccS(T[j].toLowerCase());if(SDET_NUM[t])return SDET_NUM[t];}return null;}
  function spellToken(tok,atStart,T,idx){
    if(!SP.ready)return null;var low=tok.toLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae');if(low.length<2||!isAlphaS(low))return null;
    if(SP.WORDS.has(low))return null;                                  // mot valide → couche grammaire
    if(tok[0]!==tok[0].toLowerCase()&&!atStart)return null;            // nom propre (majuscule hors début)
    var d=deaccS(low);
    if(!/[aeiouy]/.test(d))return null;                               // pas de voyelle → sigle/abréviation (www, qcm) — on n'invente pas
    if(low.length>2&&SELIDE[low[0]]&&SVOW[deaccS(low[1])[0]]){var rest=low.slice(1);
      if(SP.WORDS.has(rest))return['flag',(low[0]==='q'?"qu'":low[0]+"'")+rest];}
    var cand={},i,j,w,arr;arr=SP.D2A[d]||[];for(i=0;i<arr.length;i++){w=arr[i];cand[w]=[2,SP.FREQ[w]];}
    var e1=sEdits1(d);for(i=0;i<e1.length;i++){var a2=SP.D2A[e1[i]];if(a2)for(j=0;j<a2.length;j++){w=a2[j];if(!cand[w]||cand[w][0]<1)cand[w]=[1,SP.FREQ[w]];}}
    var pa=SP.PHON[phonKey(low)]||[];for(i=0;i<pa.length&&i<8;i++){w=pa[i];if(Math.abs(deaccS(w).length-d.length)>1)continue;if(!cand[w])cand[w]=[0,SP.FREQ[w]];}   // garde-longueur : un candidat phonétique trop éloigné (trist→tristesse, autent→hautaine) ne compte pas
    var keys=Object.keys(cand);if(!keys.length)return null;var pk=phonKey(low);
    var cg=sCtxGender(T,idx),cn=sCtxNumber(T,idx);                     // accord du contexte (grammaire)
    var expPos=null;                                                   // POS attendu (désambiguïse l'accent : élève/élevé)
    if(T&&idx>0){var pt=deaccS(T[idx-1].toLowerCase());if(DET_G[pt]||SDET_NUM[pt])expPos='N';else if(SADVERB[pt])expPos='A';}
    function pm(x){return (expPos&&(SP.POS[x]||'').indexOf(expPos)>=0)?1:0;}
    function gm(x){var g=sGender(x);return (cg&&g&&g===cg)?1:0;}       // bonus genre (jamais pénalité)
    function nm(x){return (cn&&((cn==='p')===/[sx]$/.test(deaccS(x))))?1:0;}
    keys.sort(function(x,y){var ax=cand[x][0]===2?1:0,ay=cand[y][0]===2?1:0;if(ax!==ay)return ay-ax;
      var qx=pm(x),qy=pm(y);if(qx!==qy)return qy-qx;
      var gx=gm(x),gy=gm(y);if(gx!==gy)return gy-gx;
      if(cand[x][0]===1&&cand[y][0]===0&&cand[x][1]>=10*cand[y][1])return -1;   // dominance : un edits1 (tier1) ≫10× plus fréquent écrase un phonétique (tier0) — autent→autant, pas hautain
      if(cand[y][0]===1&&cand[x][0]===0&&cand[y][1]>=10*cand[x][1])return 1;
      var px=phonKey(x)===pk?1:0,py=phonKey(y)===pk?1:0;if(px!==py)return py-px;
      var nx=nm(x),ny=nm(y);if(nx!==ny)return ny-nx;return cand[y][1]-cand[x][1];});
    var w1=keys[0],p1=cand[w1][0],f1=cand[w1][1];
    if(tok[0]!==tok[0].toLowerCase()&&deaccS(w1)!==d)return null;   // capitalisé : seule la restauration d'accent
    if(cg&&(SP.POS[w1]||'').indexOf('A')>=0){var ad=ADJP[deaccS(w1)];if(ad&&ad[0]!==cg&&cand[ad[1]]&&sGender(ad[1])===cg)return['flag',ad[1]];}
    if(f1<0.1)return null;
    var f2=keys.length>1?cand[keys[1]][1]:0,accentOnly=(p1===2&&deaccS(w1)===d),dominant=(f1>=1.0&&(f2===0||f1>=5*f2));
    if(d.length>=3&&accentOnly&&dominant)return['auto',w1];
    var na=0;for(i=0;i<keys.length;i++)if(cand[keys[i]][0]===2)na++;
    if(d.length>=3&&p1===2&&f1>=1.0&&na===1)return['auto',w1];
    return (d.length>=4&&f1>=1.0)?['flag',w1]:null;}   // durcir : assez long ET candidat fréquent — sinon on s'abstient (moins, mais juste)
  function spellText(text){var T=toks(text),out=[];for(var i=0;i<T.length;i++){var r=spellToken(T[i],i===0,T,i);
    if(r&&r[1]!==T[i].toLowerCase())out.push({i:i,word:T[i],sugg:r[1],name:'orthographe',tier:r[0]});}
    if(SP.ready){var done={};out.forEach(function(f){done[f.i]=1;});   // élision-espace : « c est »→« c'est », « qu il »→« qu'il »
      var er=/[A-Za-zÀ-ÿœŒ']+/g,em,P=[];while((em=er.exec(text)))P.push([em.index,em.index+em[0].length,em[0]]);
      for(var i=0;i<P.length-1;i++){if(done[i]||done[i+1])continue;
        if(!/^\s+$/.test(text.slice(P[i][1],P[i+1][0])))continue;
        var a=P[i][2].toLowerCase(),b=P[i+1][2].toLowerCase(),vow=/^[aeiouyh]/.test(deaccS(b));
        if(a==='aujourd'&&b==='hui'){out.push({i:i,word:P[i][2],sugg:P[i][2]+"'hui",name:'élision',tier:'flag',span:2});done[i]=done[i+1]=1;}
        else if(vow&&SP.WORDS.has(deaccS(b))&&((a.length===1&&'cjldmtns'.indexOf(a)>=0)||a==='qu')){out.push({i:i,word:P[i][2],sugg:P[i][2]+"'"+b,name:'élision',tier:'flag',span:2});done[i]=done[i+1]=1;}}
      out.sort(function(x,y){return x.i-y.i;});}
    return out;}

  // ===== couche dys au-dessus des flags (nom de règle → famille → stade) =====
  function flagsToFacts(flags){return (flags||[]).map(function(f){var n=f.name||'';
    var t=/accord|genre/.test(n)?'accord':(/orthographe|[ée]lision/.test(n)?'surface':'homophone');return {types:[t]};});}
  function diagnose(text){var flags=correctText(text);var facts=flagsToFacts(flags);var dev=developmental(facts);var rem=remedFams(facts);
    return {flags:flags,stade:dev?dev.stade:null,stadeLbl:dev?STAGE_LBL[dev.stade]:null,stadeMsg:dev?STAGE_MSG[dev.stade]:null,
            remed:rem?rem.fams.map(function(t){return REMED[t];}):[]};}
  function spell(text){return SP.ready?spellText(text):[];}                                  // flags orthographe (auto/flag) seuls
  function diagnoseAll(text){var gf=correctText(text),sf=SP.ready?spellText(text):[];        // grammaire + orthographe fusionnés + stade
    var byTok={};gf.forEach(function(f){byTok[f.i]=f;});sf.forEach(function(f){if(byTok[f.i]==null)byTok[f.i]=f;});   // grammaire prioritaire par token (parité app)
    var flags=Object.keys(byTok).map(function(k){return byTok[k];}).sort(function(a,b){return a.i-b.i;});
    var _cov={};flags.forEach(function(f){if(f.span===2)_cov[f.i+1]=1;});flags=flags.filter(function(f){return !_cov[f.i];});   // un token couvert par une élision (span 2) ne compte pas 2× (parité AUDIT #4)
    var facts=flagsToFacts(flags),dev=developmental(facts),rem=remedFams(facts);
    return {flags:flags,grammar:gf,spell:sf,stade:dev?dev.stade:null,stadeLbl:dev?STAGE_LBL[dev.stade]:null,stadeMsg:dev?STAGE_MSG[dev.stade]:null,
            remed:rem?rem.fams.map(function(t){return REMED[t];}):[]};}

  // ===== chargement lexiques =====
  var _ready=false,_loading=null;
  function setLex(vd,genderRelaxedText,spellerTSV){_applyVdc(vd||{});if(genderRelaxedText)_applyGenderRelaxed(genderRelaxedText);if(spellerTSV)_applySpellerTSV(spellerTSV);_ready=true;}
  function loadLex(urls){            // urls = { vdc:url, genderRelaxed:url(.gz), speller:url(.gz) }
    if(urls&&urls.speller)loadSpellerLex(urls.speller);   // orthographe : additif, indépendant (SP.ready quand prêt)
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

  global.DYSCORE={
    correctText:correctText, diagnose:diagnose, developmental:developmental, remedFams:remedFams,
    flagsToFacts:flagsToFacts, REMED:REMED, STAGE_LBL:STAGE_LBL, STAGE_MSG:STAGE_MSG, STAGE_FAM:STAGE_FAM,
    spell:spell, spellText:spellText, diagnoseAll:diagnoseAll, loadSpellerLex:loadSpellerLex,
    spellerReady:function(){return SP.ready;},
    toks:toks, deacc:deacc, loadLex:loadLex, setLex:setLex, isReady:function(){return _ready;}
  };
})(typeof self!=='undefined'?self:(typeof globalThis!=='undefined'?globalThis:this));
