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
  var STAGE_FAM={voisee_sourde:'phonologique',inversion:'phonologique',ajout:'phonologique',surface:'alphabetique',accent:'alphabetique',segmentation:'alphabetique',majuscule:'alphabetique',muette:'lexical',homophone_lex:'lexical',homophone:'lexical',homophone_gram:'morphosyntaxique',accord:'morphosyntaxique',personne:'morphosyntaxique',participe:'morphosyntaxique'};   // homophone LEXICAL (ver/vert)=lexical ; GRAMMATICAL (a/à, son/sont)=morphosyntaxique ; 'homophone' nu = repli lexical ; segmentation/majuscule = conventions (alphabétique)
  var STAGE_ORDER=['phonologique','alphabetique','lexical','morphosyntaxique'];
  var STAGE_LBL={phonologique:'phonologique (le son)',alphabetique:'alphabétique (écrit au son)',lexical:'lexical (orthographe du mot)',morphosyntaxique:'morphosyntaxique (grammaire)'};
  var STAGE_MSG={phonologique:'le mot n’est pas encore bien ENTENDU — on travaille le son avant l’orthographe.',alphabetique:'le son est juste, la graphie non — c’est le palier des accents et des graphies.',lexical:'la graphie du MOT lui-même : lettres muettes, et homophones que le SENS tranche (ver/vert/verre).',morphosyntaxique:'le palier le plus tardif : les accords, et les homophones que seule la grammaire tranche (a/à, son/sont).'};
  function stageOfFact(types){var best=-1;(types||[]).forEach(function(t){var st=STAGE_FAM[t];if(st){var k=STAGE_ORDER.indexOf(st);if(k>best)best=k;}});return best<0?null:STAGE_ORDER[best];}
  function developmental(F){var c={},tot=0,i;for(i=0;i<STAGE_ORDER.length;i++)c[STAGE_ORDER[i]]=0;F.forEach(function(f){var st=stageOfFact(f.types);if(st){c[st]++;tot++;}});if(!tot)return null;for(i=0;i<STAGE_ORDER.length;i++)if(c[STAGE_ORDER[i]]>0)return{stade:STAGE_ORDER[i]};return null;}
  // ⭐ CHAQUE CONSEIL PART DU MOT RÉEL (refonte 26/08/2026). Avant, c'étaient des phrases de manuel identiques
  // pour tout le monde — « Majuscule : une phrase commence TOUJOURS par une majuscule… » — alors que le moteur
  // CONNAÎT le mot écrit et sa correction : le correcteur les jetait littéralement une ligne avant l'affichage
  // (`{types:[fm]}`, sans `word` ni `sugg`). Un conseil qui ne cite pas la faute qu'il commente ne s'adresse à
  // personne, et sa longueur le rend illisible pour un dys. Chaque entrée est donc une FONCTION (écrit, attendu)
  // qui nomme la faute puis donne UNE action ; appelée sans argument elle rend la règle générale (profil de
  // session, où aucun mot n'est en jeu). ⛔ Texte BRUT : les 3 sorties échappent elles-mêmes.
  function _rd(e, a) {                       // le segment qui DIFFÈRE : préfixe et suffixe communs retirés
    e = String(e || ''); a = String(a || ''); if (!e || !a) return null;
    var m = Math.min(e.length, a.length), p = 0, s = 0;
    while (p < m && e.charAt(p) === a.charAt(p)) p++;
    while (s < m - p && e.charAt(e.length - 1 - s) === a.charAt(a.length - 1 - s)) s++;
    return { e: e.slice(p, e.length - s), a: a.slice(p, a.length - s), p: p };
  }
  function _pr(e, a) { return (e && a) ? ('« ' + e + ' » → « ' + a + ' » : ') : ''; }
  function _lt(x) { return (x.length > 1 ? 'les lettres « ' : 'la lettre « ') + x + ' »'; }
  var _VOY='aeiouyàâäéèêëîïôöùûü';
  function _mm(x,y){                        // deux lettres de MÊME NATURE (voyelle/voyelle ou consonne/consonne)
    if(!x||!y)return false;
    var a=x.charAt(0).toLowerCase(),b=y.charAt(0).toLowerCase();
    if(!/[a-zà-öø-ÿ]/.test(a)||!/[a-zà-öø-ÿ]/.test(b))return false;
    return (_VOY.indexOf(a)>=0)===(_VOY.indexOf(b)>=0);
  }
  var _VIBRE = { b:1, d:1, g:1, v:1, z:1, j:1 };                       // consonnes VOISÉES : la gorge vibre
  function _ervk(w){w=String(w||'').toLowerCase();return /er$/.test(w)?'er':/ez$/.test(w)?'ez':/é(e|s|es)?$/.test(w)?'é':null;}   // NATURE d'une finale de 1er groupe : -er / -ez / -é(e)(s) — le test « mordre » ne vaut qu'entre DEUX natures (audit 11/09/2026)
  var _HSUB = { a:'avait', 'à':'avait', et:'et puis', est:'était', son:'mon', sont:'étaient', on:'il',
                ont:'avaient', ou:'ou bien', 'où':'à quel endroit', ces:'ces …-là', ses:'les siens',
                ce:'cela', se:'lui-même', sa:'la sienne', 'ça':'cela', mais:'pourtant', mes:'les miens',
                peu:'un peu', peut:'pouvait', 'la':'le', 'là':'ici', 'ni':'et pas', 'n’y':'n’y en',
                /* « sait » : la forme d'épreuve est celle de SAVOIR. « le train savait arrêté » ne se
                   dit pas → c'est « s'est ». Sans cette entrée le conseil tombait sur le générique. */
                sait:'savait', sais:'savais',
                /* « c'est » = « cela est » (audit 11/09/2026) : « Elle cela est trompé » ne se dit pas → c'est « s'est ».
                   Sans cette entrée le conseil tombait sur le générique « a→avait, et→et puis, son→mon ». */
                "c'est":'cela est' };
  var REMED={
    voisee_sourde:function(e,a){var d=_rd(e,a);
      if(d&&d.e.length===1&&d.a.length===1){var x=d.e.toLowerCase(),y=d.a.toLowerCase(),v=_VIBRE[y]?y:(_VIBRE[x]?x:null);
        if(v)return _pr(e,a)+'« '+v+' » fait vibrer la gorge, « '+(v===y?x:y)+' » non. Pose ta main dessus et allonge le son.';}
      return _pr(e,a)+'pose la main sur ta gorge — b, d, g, v, z, j vibrent ; p, t, k, f, s, ch non.';},
    inversion:function(e,a){var d=_rd(e,a);
      if(d&&d.e.length===2&&d.a.length===2&&d.e.charAt(0)===d.a.charAt(1)&&d.e.charAt(1)===d.a.charAt(0))
        return _pr(e,a)+'« '+d.a.charAt(0)+' » et « '+d.a.charAt(1)+' » sont inversées. Suis du doigt, de gauche à droite.';
      return _pr(e,a)+'des lettres ont changé de place — découpe en syllabes et écris-les dans l’ordre.';},
    ajout:function(e,a){var d=_rd(e,a);
      if(d&&d.a===''&&d.e)return _pr(e,a)+_lt(d.e)+(d.e.length>1?' sont':' est')+' en trop. Compte les sons que tu entends.';
      return _pr(e,a)+'relis en COMPTANT les sons — un son entendu = une lettre attendue, pas plus.';},
    // l'ordre compte : une INSERTION (pome→pomme) n'est pas une substitution de graphème. Comparer
    // bêtement les caractères au point de divergence donnait « ce son s’écrit m, pas e » — absurde.
    surface:function(e,a){var d=_rd(e,a);
      // ⭐ AUDIT 11/09/2026 (vrai Chrome) : « aujourdhui » sans suggestion arrivait ici avec e === a, et la carte parlait
      // d'ACCENTS (« les accents s'entendent ») — il manque une apostrophe. Un inconnu sans réponse n'a qu'un conseil : relire.
      if(e&&a&&String(e).toLowerCase()===String(a).toLowerCase())return '« '+e+' » n’est pas dans le dictionnaire : relis-le lettre à lettre (une lettre ou une apostrophe manque peut-être), ou cherche-le.';
      // « avont → avons » (même audit) disait « ce son s'écrit s, pas t » : ce n'est pas un SON, c'est la terminaison de « nous ».
      if(d&&d.e==='t'&&d.a==='s'&&/ont$/i.test(e)&&/ons$/i.test(a))return _pr(e,a)+'-ons, c’est « nous » ; -ont, c’est « ils ». Ici c’est la terminaison du verbe, pas un son.';
      if(d&&d.e===''&&d.a){
        if(d.a.length===1&&a.charAt(d.p-1)===d.a)return _pr(e,a)+'ici la consonne « '+d.a+' » est DOUBLE.';
        return _pr(e,a)+'il manque '+_lt(d.a)+'.';}
      if(d&&d.a===''&&d.e){
        if(d.e.length===1&&e.charAt(d.p-1)===d.e)return _pr(e,a)+'ici la consonne « '+d.e+' » ne se double PAS.';
        return _pr(e,a)+_lt(d.e)+(d.e.length>1?' sont':' est')+' en trop.';}
      // segments COURTS : « fote → faute » est o→au, pas o→a. Au-delà de 3 lettres l'écart n'est plus
      // un graphème mais du bruit (sertin→certain donnerait « sert »→« certa ») : on retombe alors
      // sur le premier caractère qui diffère, qui reste juste.
      // GARDE : ne promettre « ce son s’écrit X » que si les deux lettres sont de MÊME NATURE. Sans elle,
      // « ozo → oiseau » affirmait « ce son s’écrit i, pas z » — une consonne contre une voyelle : les
      // deux mots sont trop éloignés pour qu’un seul graphème explique l’écart. Là, la règle générale.
      if(d&&d.e&&d.a&&d.e.length<=3&&d.a.length<=3&&_mm(d.e,d.a))return _pr(e,a)+'ici ce son s’écrit « '+d.a+' », pas « '+d.e+' ».';
      if(d&&_mm(e.charAt(d.p),a.charAt(d.p)))return _pr(e,a)+'ici ce son s’écrit « '+a.charAt(d.p)+' », pas « '+e.charAt(d.p)+' ».';
      return _pr(e,a)+'même son, autre graphie — compare au mot modèle (/s/ → s, ss, c, ç).';},
    accent:function(e,a){var ch=[],circ=0,i;
      if(e&&a&&e.length===a.length)for(i=0;i<e.length;i++)if(e.charAt(i)!==a.charAt(i)){ch.push(e.charAt(i)+'→'+a.charAt(i));if(/[âîôû]/i.test(a.charAt(i)))circ++;}
      /* ⭐ CIRCONFLEXE (audit 11/09/2026) : « chateau → château » disait « é ferme, è ouvre » — le circonflexe sur a, i, o, u
         ne s'ENTEND pas, on ne peut pas « le dire à voix haute ». Il se mémorise : lettre disparue (hospital → hôpital). */
      if(ch.length&&circ===ch.length)return _pr(e,a)+ch.slice(0,3).join(', ')+'. Le circonflexe ne s’entend pas : il garde la trace d’une lettre disparue (hospital → hôpital). Photographie le mot.';
      if(ch.length)return _pr(e,a)+ch.slice(0,3).join(', ')+'. Dis-le à voix haute — é ferme, è/ê ouvre.';
      return _pr(e,a)+'les accents s’entendent — é ferme, è/ê ouvre. Dis le mot à voix haute avant de choisir.';},
    muette:function(e,a){var d=_rd(e,a);
      if(d&&d.e===''&&d.a)return _pr(e,a)+_lt(d.a)+' ne s’entend pas. Cherche un mot de la même famille où on l’entend.';
      return _pr(e,a)+'lettre muette — trouve un mot de la même famille où on l’entend (petit → petite).';},
    homophone_gram:function(e,a){var k=e?String(e).toLowerCase():'',sub=_HSUB[k];
      if(sub&&a)return _pr(e,a)+'essaie « '+sub+' » à la place — si la phrase ne tient plus, c’est « '+a+' ».';
      return _pr(e,a)+'remplace par une forme sûre (a→avait, et→et puis, son→mon) — si la phrase tient, garde-la.';},
    homophone_lex:function(e,a){
      return _pr(e,a)+'ici c’est le SENS qui décide — remplace par un mot de la même famille (verre→du verre, vert→verdure).';},
    homophone:function(e,a){return REMED.homophone_gram(e,a);},
    personne:function(e,a){
      var le=(e||'').toLowerCase(),la=(a||'').toLowerCase();
      if(le&&la&&/(er|ir|re|oir)$/.test(la)&&!/(er|ir|re|oir)$/.test(le))
        return _pr(e,a)+'après « je vais », « je dois », « je peux »…, le verbe reste à l’INFINITIF.';
      if(le&&la&&la.length===le.length+1&&la.slice(0,-1)===le&&/s$/.test(la))
        return _pr(e,a)+'avec « je » ou « tu », ce verbe prend un -s.';
      if(le&&la&&/(sse|sses|ienne|iennes|asse|fasse|fasses)$/.test(la))
        return _pr(e,a)+'après « il faut que », le verbe passe au SUBJONCTIF.';
      return _pr(e,a)+'le verbe se conjugue avec SA personne — « il » n’a pas la même terminaison.';},
    /* ⭐ LE PARTICIPE A SA PROPRE FAMILLE (26/08/2026). Avant, « il est arrive » → « arrivé » était
       classé ACCENT — parce que `_corrFam` teste la désaccentuation AVANT le nom de la règle — et la
       carte enseignait « e→é, dis-le à voix haute, é ferme è ouvre ». C'est faux : ce n'est pas un
       accent, c'est un participe après auxiliaire. On enseignait la mauvaise chose. */
    participe:function(e,a){var d=_rd(e,a);
      if(d&&/^e$/i.test(d.e)&&/^é$/i.test(d.a))
        return _pr(e,a)+'après un auxiliaire, le verbe prend sa forme de PARTICIPE en -é, jamais celle du présent en -e.';
      if(d&&/^e$/i.test(d.e)&&/^é(e|s|es)$/i.test(d.a))
        return _pr(e,a)+'deux choses à la fois : le PARTICIPE en -é, et l’ACCORD « '+d.a.slice(1)+' ».';
      /* ⛔ ne pas promettre « -é » sur un participe qui n'en a pas : cueilli, venu, parti, pris.
         On ne parle d'accent QUE si le segment manquant en porte un. */
      if(d&&d.e===''&&/^é/i.test(d.a))
        return _pr(e,a)+'il manque « '+d.a+' » : l’accent du participe, et son accord.';
      if(d&&d.e===''&&/^(e|s|es)$/i.test(d.a))
        return _pr(e,a)+'il manque « '+d.a+' » : le participe s’ACCORDE ici.';
      if(d&&d.a===''&&/^(e|s|es)$/i.test(d.e))
        return _pr(e,a)+'le participe ne s’accorde PAS ici : le « '+d.e+' » est en trop.';
      /* repli EXACT : ne pas promettre « -é », qui est faux pour « écrite », « prise », « mise ». */
      return _pr(e,a)+'c’est un PARTICIPE : il s’accorde avec le SUJET après « être », et avec le COD placé AVANT après « avoir ».';},
    accord:function(e,a){var d=_rd(e,a);
      // ⭐ -er / -é : le TEST DU 3e GROUPE, et rien d'autre. « manger/mangé » sont homophones, pas
      // « mordre/mordu » — c'est le test que tout le monde apprend, et il tranche à coup sûr. Il
      // passe AVANT l'accord générique, qui disait « repère qui commande » sur une terminaison.
      // ⭐ AUDIT 11/09/2026 (vrai Chrome) : « clé → clés » passait ici, et la carte disait « remplace le verbe par mordre »
      // — sur un NOM. Le test ne vaut que si la finale CHANGE DE NATURE (-er ↔ -é/-ée/-és/-ées ↔ -ez) : un -s ajouté à
      // « clé » est un pluriel, pas un infinitif. Gardé par dictee/textes_probe.js.
      var ke=_ervk(e),ka=_ervk(a);
      if(ke&&ka&&ke!==ka)
        return _pr(e,a)+'remplace le verbe par « mordre » — si « mordre » sonne juste c’est l’infinitif -er, si c’est « mordu » c’est le participe -é'+((ke==='ez'||ka==='ez')?', si c’est « mordez » c’est -ez (vous)':'')+'.';
      if(d&&d.e===''&&d.a==='nt')return _pr(e,a)+'le sujet est au PLURIEL, il manque le « nt » du verbe.';
      if(d&&d.a===''&&d.e==='nt')return _pr(e,a)+'le sujet est au SINGULIER, le « nt » est en trop.';
      if(d&&d.e===''&&(d.a==='s'||d.a==='x'))return _pr(e,a)+'il manque le « '+d.a+' » du pluriel — regarde ce qui commande.';
      if(d&&d.a===''&&(d.e==='s'||d.e==='x'))return _pr(e,a)+'ici c’est le singulier, le « '+d.e+' » est en trop.';
      if(d&&d.e===''&&d.a==='es')return _pr(e,a)+'il manque « es » : le féminin ET le pluriel — cherche qui commande.';
      if(d&&d.e===''&&d.a==='e')return _pr(e,a)+'il manque le « e » du féminin — cherche qui commande l’accord.';
      return _pr(e,a)+'repère QUI COMMANDE (déterminant, sujet) et accorde en genre et en nombre.';},
    segmentation:function(e,a){
      if(a&&(a.indexOf('’')>=0||a.indexOf("'")>=0))return _pr(e,a)+'l’article est élidé, il faut l’apostrophe.';
      if(a&&a.indexOf(' ')>0)return _pr(e,a)+'ce sont DEUX mots, il faut l’espace.';
      return _pr(e,a)+'mot collé — sépare avec l’apostrophe (lhopital → l’hôpital) ou l’espace (ducou → du coup).';},
    liaison:function(e,a){var d=_rd(e,a);
      if(d&&d.a===''&&d.e.length===1)return _pr(e,a)+'le « '+d.e+' » que tu entends appartient au mot d’avant, il ne s’écrit pas ici.';
      return _pr(e,a)+'le son entre deux mots (les‿z‿amis) appartient au PREMIER — écris « les amis ».';},
    majuscule:function(e,a){
      if(e&&a)return _pr(e,a)+(/^[A-ZÀ-ÖØ-Þ]/.test(a)?'début de phrase ou nom propre, il faut la capitale.'
                                                     :'ce n’est pas un début de phrase, pas de capitale ici.');
      return 'Majuscule : une phrase commence par une capitale, les noms propres aussi.';}
  };
  // le conseil d'une famille, nourri par un fait REPRÉSENTATIF (le premier de cette famille) ; sans fait → règle générale
  // …et si aucun mot n'est en jeu (profil de session), la phrase commence la ligne : on la capitalise.
  function remedTip(t,f){var fn=REMED[t];if(!fn)return '';var s=fn(f&&f.ecrit,f&&f.mot);
    return (s&&s.charAt(0)!=='«')?s.charAt(0).toUpperCase()+s.slice(1):s;}
  /* ⭐ LA REMÉDIATION NE FILTRE PLUS SUR LE SEUL STADE (01/09/2026, signalé par Rem : « il manque les
     conjugaisons dans les explications des fautes »).
     Elle ne retenait que les familles dont STAGE_FAM[t] égale le stade diagnostiqué. Or ce stade est,
     par CONSTRUCTION, la bande la plus EN AMONT où l'élève bute encore (diag_sentence.py:322 :
     « on maîtrise de bas en haut ») — c'est VOULU et ce n'est pas ce qu'on change ici. Mais comme une
     seule faute d'accent suffit à fixer ce stade, TOUTE explication de conjugaison ou d'accord
     disparaissait avec lui. Mesuré dans l'extension réelle : « je suis allez » + une faute d'accent,
     donc UNE faute de chaque — stade alphabétique, rémédiation [accent] SEULE, « participe » perdu.
     Sur 200 phrases dys réelles : 51 faits sur 224 (23 %) sans aucune explication, dont participe (11),
     homophone_gram (15), accord (8), ponctuation (11), style (6).
     Le stade reste INCHANGÉ ; on montre les familles de TOUS les stades présents, celles du stade
     diagnostiqué EN TÊTE (l'ordre porte la priorité pédagogique, le filtre ne la portait plus).
     ⚠️ `remedBlock` n'imprime PAS le nom du stade (il est dans son propre bloc) : aucun titre ne se
     retrouve en contradiction avec les familles listées. Vérifié avant d'écrire. */
  function remedFams(F){var dev=developmental(F);if(!dev)return null;var seen={},rep={},parStade={};
    (F||[]).forEach(function(f){(f.types||[]).forEach(function(t){var st=STAGE_FAM[t];
      if(!st||seen[t])return;seen[t]=1;rep[t]=f;(parStade[st]=parStade[st]||[]).push(t);});});
    var out=(parStade[dev.stade]||[]).slice();
    for(var i=0;i<STAGE_ORDER.length;i++){var s=STAGE_ORDER[i];
      if(s!==dev.stade&&parStade[s])out=out.concat(parStade[s]);}
    return out.length?{stade:dev.stade,fams:out,rep:rep}:null;}

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
  var _GACC={};   // genre ACCENTUÉ (assets/gender-acc.json.gz, miroir app gacc-lex-gz) — consulté INCONDITIONNELLEMENT par _nounGender, comme GENDER_ACC en Python. Table À PART, jamais unionnée dans GENDER_PURE.
  function _applyVdc(vd){BCLF=vd.bclf||null;(vd.v||[]).forEach(function(w){COMMON_VERBS[w]=1;});GENDER_MAP=vd.g||{};GENDER_PURE=vd.gn||{};ADJP=vd.a||{};var cj=vd.cj||{};CONJ_F=cj.f||{};CONJ_C=cj.c||{};_fillReg3pl(CONJ_C,CONJ_F);NOUN_PLURAL={};(vd.gp||[]).forEach(function(w){NOUN_PLURAL[w]=1;});var _GOE={soeur:'f',soeurs:'f',coeur:'m',coeurs:'m',oeuf:'m',oeufs:'m',oeuvre:'f',oeuvres:'f',boeuf:'m',boeufs:'m',voeu:'m',voeux:'m',noeud:'m',noeuds:'m',oeil:'m',moeurs:'f',manoeuvre:'f',manoeuvres:'f',oeillet:'m',oeillets:'m',oesophage:'m',foetus:'m'};for(var _goeK in _GOE)if(GENDER_PURE[_goeK]===undefined)GENDER_PURE[_goeK]=_GOE[_goeK];}   // GENRE noms en œ manquants du lexique gn (débloque « mon soeur »→ma sœur). FP=0, union. Miroir app + Python.
  // PRÉNOMS + GENRE (assets/prenoms.tsv.gz, DÉRIVÉ du blob prenoms-gz de l'app par build_assets).
  // nom -> [genre, tete_de_phrase_interdite]. Débloque « Marie est venu »→venue. Miroir app + Python.
  var PRENOMS={};
  function _applyPrenoms(txt){var lines=txt.split(/\r?\n/);for(var k=0;k<lines.length;k++){var ln=lines[k];if(!ln)continue;var p=ln.split('	');if(p.length>=3)PRENOMS[p[0]]=[p[1],p[2]==='1'];}}
  function _applyGenderRelaxed(txt){var lines=txt.split('\n');for(var k=0;k<lines.length;k++){var ln=lines[k];if(!ln)continue;var p=ln.split('\t');if(p.length<2)continue;if(GENDER_PURE[p[0]]===undefined)GENDER_PURE[p[0]]=(p[1]==='1'?'f':'m');}}
  function _applyGaccLex(jsonText){try{_GACC=JSON.parse(jsonText)||{};}catch(e){}}
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
  // PARTICIPE en -é dont l'infinitif -er est ABSENT de COMMON_VERBS (12 415 entrées) mais PRÉSENT dans le
  // lexique du speller (214 683 formes, ACCENTUÉ, avec POS). Mesuré : « les sucs destiné » restait sans flag
  // parce que « destiner » manque à COMMON_VERBS ; idem « tronquer ». Le trou d'accord du participe épithète
  // est donc LEXICAL, pas logique — rPpEpithetNum fonctionne déjà (« les contrats signé »→signés).
  // ⚠️ RÉSERVÉ À rPpEpithetNum. Mesuré sur scan UD : étendre le lexique verbal GLOBALEMENT fait passer
  // rule_flexion_er de 1 à 4 FP (gravité→graviter, surgelé→surgeler) et rule_pp_etre de 7 à 9 — ces règles
  // s'appuient sur l'étroitesse de COMMON_VERBS pour écarter les NOMS en -é. rPpEpithetNum, elle, reste à
  // 0 FP : ses gardes (déterminant PLURIEL + nom à gauche + genre connu + ruptures de segment) suffisent.
  // On ne reconstruit PAS l'infinitif en désaccentué : SP.WORDS est accentué, donc « arrêté »→« arrêter »
  // se trouve tel quel. Si le speller n'est pas chargé, on retombe sur _isPpl seul — aucune régression.
  function _isPplWideEr(w){var lw=w.toLowerCase();
    if(lw.charAt(lw.length-1)!=='é')return false;
    if(!(SP&&SP.ready&&SP.WORDS&&SP.POS))return false;
    var inf=lw.slice(0,-1)+'er';
    return SP.WORDS.has(inf)&&(SP.POS[inf]||'').indexOf('V')>=0;}
  var PLURAL_DET={};'les des ces leurs mes tes ses nos vos quels quelles plusieurs certains certaines quelques aux'.split(' ').forEach(function(w){PLURAL_DET[w]=1;});
  var VSTOP={};['ne','me','te','se','le','la','les',"l'",'en','y','que','qu','qui','si','ou','et','ni','car','or','ce','ces','de','des','du','lui'].forEach(function(w){VSTOP[w]=1;});   /* 'lui' (12/09/2026) : VERB_LEX le connaît (luire) → « lui a apeller »→à, casse — miroir Python VLIKE_STOP */Object.keys(NUM_DET).forEach(function(w){VSTOP[w]=1;});Object.keys(NUM_PRON).forEach(function(w){VSTOP[w]=1;});
  function vlike(T,i){if(i<0||i>=T.length)return false;if(isVerb(T,i))return true;var w=deacc(T[i].toLowerCase());if(VSTOP[w])return false;if(!COMMON_VERBS[w])return false;
    if(i>0&&(NUM_DET[T[i-1].toLowerCase()]||{du:1,au:1,aux:1}[T[i-1].toLowerCase()])){   /* du/au/aux (12/09/2026) : contractions = déterminants, « du travaille a permises » ne lit plus un verbe — miroir Python */                                          // « le porte » reste un NOM…
      // …SAUF « CE » ÉCRIT POUR « SE » (mesuré 22/08, parité Python vlike). « Il CE met a pousser » : la
      // garde déterminant tue la lecture VERBALE, et la cascade suit — vlike(met)=false → rA ne tranche
      // plus → la garde a/à de rEer ne tire pas → « pousser » devient « poussé », un mot JUSTE cassé.
      // Test LOCAL (pas d'appel à rCe : elle appelle vlike, ce serait récursif) : un PRONOM SUJET juste
      // avant le « ce » ⇒ « se » pronominal, jamais un déterminant (« il lit ce livre » garde la garde).
      if(!(deacc(T[i-1].toLowerCase())==='ce'&&i>1&&SUBJ_PRON[deacc(T[i-2].toLowerCase())]))return false;
    }
    return true;}
  function cpl(T,j){if(j<0||j>=T.length)return false;var dw=deacc(T[j].toLowerCase());if(!/[sx]$/.test(dw))return false;return j>0&&NUM_DET[T[j-1].toLowerCase()]==='pl';}
  var NOUN_E={};'marche traite combine cote passe arrete carre depute employe invite expose resume communique delegue prive defile abonne'.split(' ').forEach(function(w){NOUN_E[w]=1;});
  // ---- PRIMITIVE PARTAGÉE : CANONICALISER CE QU'ON ÉMET ----------------------------------------
  // Une règle qui FABRIQUE une forme par concaténation part du mot tel qu'il a été SAISI — donc avec
  // ses accents manquants. « il a ecouter » -> « ecouté », qui n'existe pas. Mesuré : 5 non-mots
  // fabriqués par la seule règle -é/-er (ecouté, controlé, reparé, preferé, repeté). 22 sites du
  // moteur fabriquent ainsi une forme ; un seul passait par un canonicaliseur avant ce commit.
  function _canonW(w,supposeFautif){
    if(!supposeFautif&&SP&&SP.ready&&SP.WORDS&&SP.WORDS.has(w.toLowerCase()))return w;   // ⚠ NE JAMAIS TOUCHER UN MOT DÉJÀ CORRECT. Sans ce test, « marché » (correct) est remplacé par « marche » (homographe déaccentué PLUS FRÉQUENT) : mesuré, FP 301 -> 977 et 68 tokens cassés. Le canonicaliseur RÉPARE un accent manquant, il ne rejuge pas une orthographe valide.
    var a=(SP&&SP.D2A)?SP.D2A[deacc(w.toLowerCase())]:null;   // formes dont la version déaccentuée est celle saisie
    if(!a||!a.length)return w;
    if(!supposeFautif&&a.length!==1)return w;   // en mode DÉFAUT on exige UNE SEULE candidate : sinon on arbitrerait entre rivaux, ce qui n'est plus de la réparation d'accent (mesuré : « le plus fréquent » y coûte +2 FP sur 14 450). En mode supposeFautif la règle a déjà tranché par le contexte, l'arbitrage par fréquence est légitime.
    var c=a[0];
    return (w.charAt(0)===w.charAt(0).toUpperCase()&&w.charAt(0)!==w.charAt(0).toLowerCase())?c.charAt(0).toUpperCase()+c.slice(1):c;}
  // DEUX MODES, et la différence est réelle — ne pas la gommer :
  //   défaut          le mot est pris tel qu'il est écrit ; s'il est valide on n'y touche pas
  //                   (« marché » ne doit pas devenir « marche »).
  //   supposeFautif   la règle a DÉJÀ établi par son contexte que la forme est fautive ; le mot peut
  //                   être « valide » et néanmoins mal accentué (« il a repare » : « repare » existe,
  //                   mais après un auxiliaire c'est « réparé » qu'il faut).
  function _emit(src,fn,supposeFautif){var c=fn(_canonW(src,supposeFautif));   // transformation appliquée au radical CANONIQUE, puis on n'émet QUE si le résultat est un mot connu
    if(SP&&SP.ready&&SP.WORDS&&!SP.WORDS.has(c.toLowerCase()))return null;return c;}
  function rEer(T,i){
    if(i>=2){var _pse=deacc(T[i-1].toLowerCase());
      if((_pse==='sais'||_pse==='sait')&&(function(){var _p2=deacc(T[i-2].toLowerCase());return _p2==='il'||_p2==='elle'||_p2==='on';})()&&(_isPpl(T[i])||_SAIS_PPU[deacc(T[i].toLowerCase())]))return null;}   // « il sais trompé » = frame s'est (orange saisVig) — ne pas fabriquer « sait tromper » ; « je sais nagé »→nager reste corrigé
var w=T[i],lw=w.toLowerCase(),f;if(lw.indexOf("'")>=0)return null;if(/é$/.test(lw))f=[w,w.slice(0,-1)+'er'];else if(/er$/.test(deacc(lw))&&lw.length>3)f=[w.slice(0,-2)+'é',w];else return null;if(NOUN_E[deacc(f[0].toLowerCase())])return null;if(!COMMON_VERBS[deacc(f[1].toLowerCase())])return null;if(i===0)return null;var praw=T[i-1].toLowerCase();if(praw==='à'||T[i-1]==='A'){if(rA(T,i-1)==='a')return null;   // CASCADE DE DEUX ROUGES : « statue À CONSERVÉ » recevait « à »→« a » ET « conservé »→« conserver » → « a conserver », faute FABRIQUÉE. Si le correcteur juge lui-même ce « à » faux, l'ancre ne vaut rien → abstention (miroir Python rule_e_er)
    return _emit(w,function(x){return /é$/.test(x.toLowerCase())?x.slice(0,-1)+'er':x;});}var p=cprev(T,i);if(CAUX[p]){
      // ⭐ « a » ÉCRIT POUR « à » (mesuré 22/08 sur gold dys RÉEL, parité Python rule_e_er) : le scripteur dys
      // confond a/à (3e forme la plus souvent erronée, Bodard 2020). « tout en pensent A bronzer », « il se met
      // A pousser » : ce « a » lu comme AUXILIAIRE rendait le participe, alors que c'est une PRÉPOSITION.
      // On s'en remet à rA (LA règle a/à, 100 % sur ce corpus) et à elle SEULE. ⚠️ MESURÉ ET REJETÉ :
      // trancher en plus par la structure (proposition ayant déjà un verbe conjugué) répare 2 cas de plus
      // mais coûte 14 FAUX POSITIFS à l'échelle (FP UD 1,44 % -> 2,00 %) — ne pas refaire.
      if(i>0&&deacc(T[i-1].toLowerCase())==='a'&&rA(T,i-1)==='à')return f[1];   // rule_a_aa tranche : PRÉPOSITION → infinitif ; sinon comportement d'origine (participe) — « mon frère a manger »→mangé reste corrigé
      return _emit(w,function(x){return /er$/.test(deacc(x.toLowerCase()))?x.slice(0,-2)+'é':x;});}if(PREP[p]){if(GENDER_MAP[deacc(f[0].toLowerCase())])return null;return f[1];}if(MODAL[p])return f[1];return null;}   // direction INFINITIF laissée telle quelle : la canonicaliser coûte +5 FP mesurés (« accord grammatical (é/er) » 25->29) pour zéro non-mot évité — le prix est dans la direction PARTICIPE, pas ici
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
  function rFlexionEr(T,i){
    if(i>=2){var _psf=deacc(T[i-1].toLowerCase());
      if((_psf==='sais'||_psf==='sait')){var _p2f=deacc(T[i-2].toLowerCase());
        if((_p2f==='il'||_p2f==='elle'||_p2f==='on')&&(_isPpl(T[i])||_SAIS_PPU[deacc(T[i].toLowerCase())]))return null;}}   // « il sais trompé » = frame s'est (l'orange saisVig parle) — corriger vers « tromper » ressuscitait sais→sait en cascade ; « je sais nagé »→nager reste corrigé (prev-prev = je)
var w=T[i],lw=w.toLowerCase();
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
    else if(praw==='à'||T[i-1]==='A'||T[i-1]==='À'){if(rA(T,i-1)==='a')return null;tgt='inf';}   // MÊME CASCADE que rEer : si le correcteur juge lui-même ce « à » faux (« statue à conservé »→« a »), l'ancre ne vaut rien — proposer l'infinitif fabriquerait « a conserver » (miroir Python rule_flexion_er)
    else if(_AUX_AV[p]||praw==="j'ai"){
      // ⭐ MÊME GARDE QUE rEer (22/08, parité Python rule_flexion_er) : le scripteur dys écrit « a »
      // pour « à ». « tout en pensent A bronzer » : ce « a » lu comme AUXILIAIRE rendait le participe,
      // alors que c'est une PRÉPOSITION. Les DEUX règles partageaient l'angle mort ; mesuré sur le
      // PIPELINE complet (dictee/dys_pipeline_probe.py) : mots CASSÉS 30 -> 26 sur texte dys réel.
      if(i>0&&deacc(T[i-1].toLowerCase())==='a'&&rA(T,i-1)==='à')tgt='inf';else tgt='part';}
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
  /* INFINITIF DE BUT — « Je suis allé à la plage mangé des champignons » → manger.
     Signalé par Rem le 2026-08-11. `rFlexionEr` décide d'après le token IMMÉDIATEMENT à gauche
     (« à », auxiliaire, modal…) ; ici le voisin est « plage » et elle s'abstient : le gouverneur
     (« allé ») est séparé du verbe par un complément de DESTINATION.

     ⚠️ LE PIÈGE QUI DONNE SA FORME À LA RÈGLE, c'est le participe ADJECTIVAL :
        « Je suis rentré à la maison épuisé. »        épuisé = ADJECTIF, surtout pas « épuiser »
        « Il est allé à la fête déguisé en pirate. »  déguisé = ADJECTIF
     TROIS gardes cumulées, chacune née d'un faux positif MESURÉ sur 14 450 phrases correctes :
       ① le mot en -é est un VERBE PUR — colonne POS du lexique speller, ACCENTUÉE : « mangé » V,
          « cherché » V, mais « épuisé » AV, « déguisé » ANV, « tracé » NV, « passé » ANV. C'est ce
          qui écarte l'attribut sans avoir à deviner ;
       ② il est suivi d'un DÉTERMINANT (objet direct) — un adjectif attribut ne l'est jamais ;
       ③ le verbe de mouvement doit être LICENCIÉ : forme finie d'aller, ou participe précédé de son
          auxiliaire ÊTRE. Sans ça « d'une part … indiqué le », « Le parti … appelé les » et
          « les sorties … marché du » tiraient : ce sont des NOMS homographes.
     MESURÉ : 4 cibles sur 4, 0 piège sur 4, et **1 seul tir sur 14 450 phrases UD correctes** —
     « Ran va-t-elle épousé le docteur ? », une VRAIE faute du corpus. Donc FP = 0.
     ⚠️ LIMITE ASSUMÉE : on ne traverse que la destination (préposition + déterminant + nom), 6 tokens
     au plus, et on s'arrête sur toute conjonction ou auxiliaire. Un complément long fait abstenir. */
  var _BUT_MOUV={};('alle allee alles allees venu venue venus venues parti partie partis parties '+
    'monte montee montes montees sorti sortie sortis sorties rentre rentree rentres rentrees '+
    'retourne retournee revenu revenue revenus revenues entre entree passe passee couru '+
    'vais vas va allons allez vont allais allait allions alliez allaient irai iras ira irons irez iront').split(' ').forEach(function(w){_BUT_MOUV[w]=1;});
  var _BUT_ALLER={};'vais vas va allons allez vont allais allait allions alliez allaient irai iras ira irons irez iront'.split(' ').forEach(function(w){_BUT_ALLER[w]=1;});
  var _BUT_ETRE={};'suis es est sommes etes sont etais etait etions etiez etaient sera serai seras serons serez seront'.split(' ').forEach(function(w){_BUT_ETRE[w]=1;});
  var _BUT_DET={};("le la les l' un une des du mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs ce cet cette ces quelques plusieurs").split(' ').forEach(function(w){_BUT_DET[w]=1;});
  var _BUT_STOP={};('et ou mais donc car ni que qu qui quand si parce a as ai ont avons avez avais avait suis es est sommes etes sont etais etait ete').split(' ').forEach(function(w){_BUT_STOP[w]=1;});
  function rInfBut(T,i){var w=T[i],lw=w.toLowerCase();
    if(!SP.ready||lw.indexOf("'")>=0||i===0||!/é$/.test(lw))return null;
    var pos=SP.POS[lw]||'';                                                      // ① VERBE PUR (ni NOM ni ADJECTIF)
    if(pos.indexOf('V')<0||pos.indexOf('N')>=0||pos.indexOf('A')>=0)return null;
    var inf=_inf1(w);if(inf===null||deacc(inf)===deacc(lw))return null;
    if(i+1>=T.length||!_BUT_DET[deacc(T[i+1].toLowerCase())])return null;        // ② objet direct derrière
    var k=i-1,vus=0;
    while(k>=0&&vus<6){var brut=T[k].toLowerCase(),g=deacc(brut);
      if(brut==='à'){k--;vus++;continue;}                                        // « à » PRÉPOSITION : la désaccentuation la confond avec l'auxiliaire « a », on lit le token BRUT
      if(_BUT_MOUV[g]){                                                          // ③ gouverneur LICENCIÉ, sinon c'est un nom homographe
        if(_BUT_ALLER[g])return ckeepcase(w,inf);
        return (k>0&&_BUT_ETRE[deacc(T[k-1].toLowerCase())])?ckeepcase(w,inf):null;}
      if(_BUT_STOP[g])return null;
      k--;vus++;}
    return null;}
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
  /* ⚠️ `skip` EXISTE À CAUSE D'UN BUG MESURÉ (audit 2026-08-11) : la branche « prédicat » de
     rSonSont cherche « son + PARTICIPE », mais ce balayage comptait le participe VISÉ comme verbe
     fini et faisait abstenir. La règle ne tirait donc QUE si le tagger se TROMPAIT sur ce participe
     (« partis »→NOUN : tire ; « venus »→VERB : abstient) — améliorer le tagger DIMINUAIT le rappel.
     L'appelant passe la case de son prédicat. Miroir Python. */
  /* BORNES DE PROPOSITION PRÉDITES (canal « pb », 31/08/2026) — miroir Python _pred_bounds.
     Le texte dys ne ponctue pas : sans virgule, _SEG.bb est vide et la garde verbe-présence balaie la
     phrase ENTIÈRE — les cadres son/sont, et/est, peu/peut abstiennent. MESURÉ (or UD nsubj, phase-mesure
     du chantier bornes) : des OUVERTURES à LISTES FERMÉES rendent la garde à PARITÉ avec les virgules de
     l'AUTEUR (rappel 42,3 % vs 42,5 · spécificité 78,9 % vs 74,1) pour zéro poids. Canal SÉPARÉ de bb
     (bb = ponctuation de l'AUTEUR, ~40 gardes FP=0 calibrées dessus) ; posé par correctText/diagnoseAll
     seulement, consommé par la seule _clauseNoFiniteVerb. */
  var _PB_SUB1={quand:1,lorsque:1,puisque:1,quoique:1,car:1,si:1,comme:1};
  var _PB_SUB1_ELID=["lorsqu'","puisqu'","quoiqu'"];
  var _PB_SUB2={alors:1,tandis:1,parce:1,bien:1,afin:1,avant:1,'après':1,pendant:1,depuis:1,tant:1,'dès':1};
  var _PB_COORD={et:1,ou:1,mais:1};
  var _PB_CONJ_ADV={puis:1,ensuite:1,cependant:1,toutefois:1,'néanmoins':1,enfin:1};
  function _predBounds(T,seg){
    var n=T.length,tg=posTags(T),pb=[],j,i;
    for(i=0;i<n;i++)pb.push(false);
    var finSeen=!!(tg&&(tg[0]==='VERB'||tg[0]==='AUX'));
    var va=[],ahead=false;
    for(i=0;i<n;i++)va.push(false);
    for(j=n-1;j>=0;j--){va[j]=ahead;if(tg&&(tg[j]==='VERB'||tg[j]==='AUX'))ahead=true;if(j<seg.ss.length&&seg.ss[j])ahead=tg?(tg[j]==='VERB'||tg[j]==='AUX'):false;}
    for(i=1;i<n;i++){
      if((i<seg.ss.length&&seg.ss[i])||(i<seg.bb.length&&seg.bb[i]))finSeen=false;
      var lw=T[i].toLowerCase(),lw2=i+1<n?T[i+1].toLowerCase():'';
      var prevTag=(tg&&i-1<tg.length)?tg[i-1]:null;
      var b=false;
      if(_PB_SUB1[lw]||_PB_SUB1_ELID.some(function(p){return lw.indexOf(p)===0;}))b=true;
      else if(_PB_SUB2[lw]&&(lw2==='que'||lw2.indexOf("qu'")===0))b=true;
      else if(lw==='qui'&&(finSeen||prevTag==='NOUN'||prevTag==='PROPN'||prevTag==='PRON'||prevTag==='NUM'))b=true;
      else if((lw==='dont'||lw==='où'||lw==='que'||lw.indexOf("qu'")===0)&&(finSeen||prevTag==='NOUN'||prevTag==='PROPN'))b=true;
      else if(_PB_CONJ_ADV[lw]&&finSeen&&va[i])b=true;
      else if(_PB_COORD[lw]&&finSeen&&va[i]){
        var nx=lw2?deacc(lw2):'';
        var subjNet=!!SUBJ_PRON[nx]||(lw2&&_ELIDED_PRON.test(lw2))||(tg&&i+2<n&&tg[i+1]==='DET'&&(tg[i+2]==='NOUN'||tg[i+2]==='PROPN'||tg[i+2]==='ADJ'||tg[i+2]==='NUM'));
        if(subjNet)b=true;
      }
      if(b){pb[i]=true;finSeen=false;}
      if(tg&&(tg[i]==='VERB'||tg[i]==='AUX'))finSeen=true;
    }
    return pb;
  }
  var BCLF=null;   // canal GROUPE : classifieur de bornes 169 poids (cle « bclf » du payload vdc-lex, build_bornes_clf.py — held-out P 85,1 %/R 49,6 % @0,5)
  /* _groupBounds — miroir Python _group_bounds, CONTRAT du build : etat (last_b, vu_verbe), reset sur
     ss[i] ; features tg-1/tg0/w=/w-1=/ELIDQU/ELIDPRON/vu_verbe/dist/vu_verbe&DET ; seuil en LOG-ODDS
     (p >= tau ⟺ z >= ln(tau/(1-tau)), = 0 pour 0,5 — sigmoide monotone, decisions identiques).
     Consomme par le SEUL lo-scan de _npSubject (+0,92 pt sujet mesure, 0 juste perdue). */
  function _groupBounds(T,seg){
    if(!BCLF)return null;var tg=posTags(T);if(!tg)return null;
    var W=BCLF.w,n=T.length,tau=BCLF.tau||0.5,zt=(tau===0.5)?0:Math.log(tau/(1-tau));
    var gb=[],i;for(i=0;i<n;i++)gb.push(false);
    var lastB=0,vuV=(tg[0]==='VERB'||tg[0]==='AUX');
    for(i=1;i<n;i++){
      if(i<seg.ss.length&&seg.ss[i]){lastB=i;vuV=false;}
      var lw=T[i].toLowerCase(),lw0=T[i-1].toLowerCase();
      var z=BCLF.b+(W['tg-1='+tg[i-1]]||0)+(W['tg0='+tg[i]]||0)+(W['w='+lw]||0)+(W['w-1='+lw0]||0);
      if(lw.indexOf("qu'")===0)z+=W['w=ELIDQU']||0;
      if(_ELIDED_PRON.test(lw))z+=W['w=ELIDPRON']||0;
      if(vuV)z+=W['vu_verbe']||0;
      var d=i-lastB;
      z+=W[d<=1?'dist=1':d===2?'dist=2':d<=5?'dist=3-5':d<=10?'dist=6-10':'dist=11+']||0;
      if(vuV&&tg[i]==='DET')z+=W['vu_verbe&DET']||0;
      if(z>=zt){gb[i]=true;lastB=i;vuV=false;}
      if(tg[i]==='VERB'||tg[i]==='AUX')vuV=true;
    }
    return gb;
  }
  function _clauseNoFiniteVerb(T,i,skip){var n=T.length,lo=0,hi=n,j;   // verbe-présence via le TAGGER HMM (contexte : élèves/table→NOUN) ; repli svReads si modèle absent
    var _pb=_SEG?_SEG.pb:null;   // bornes PRÉDITES (canal listes fermées, 31/08) — consommées ICI SEULEMENT : elles rétrécissent la fenêtre de la garde (mesuré : parité avec les virgules de l'auteur, 42,3 %/78,9 % vs 42,5/74,1)
    if(_SEG){for(j=i;j>0;j--){if((j<_SEG.bb.length&&_SEG.bb[j])||(_pb&&j<_pb.length&&_pb[j])){lo=j;break;}}for(j=i+1;j<n;j++){if((j<_SEG.bb.length&&_SEG.bb[j])||(_pb&&j<_pb.length&&_pb[j])){hi=j;break;}}}
    var tg=posTags(T);
    if(tg){for(j=lo;j<hi;j++){if(j!==i&&j!==skip&&(tg[j]==='VERB'||tg[j]==='AUX'))return false;}return true;}
    for(j=lo;j<hi;j++){if(j!==i&&j!==skip&&svReads(T[j].toLowerCase()).length)return false;}
    return true;}
  /* -s/-x qui n'est PAS une marque de pluriel : « son fils », « son corps », « son prix » restent
     des possessifs. Même contenu que _OS_INVAR. */
  var _SON_INVAR={};('prix cours corps temps bois pays mois bras dos cas choix croix voix noix toux '+
    'poids concours discours parcours secours univers divers pervers avis colis permis compromis '+
    'bus autobus jus repas tapis souris brebis puits gaz nez riz fils').split(' ')
    .forEach(function(w){_SON_INVAR[w]=1;});
  function rSon(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='son'&&lw!=='sont')return null;   // tranché par CE QUI SUIT : son=det+nom sg ; sont=être 3pl+prédicat ; abstention sinon (FP=0)
    var nxt=i+1<T.length?deacc(T[i+1].toLowerCase()):'';
    var _nxr=i+1<T.length?T[i+1].toLowerCase():'';
    var nxtNounSg=_nounGate(nxt)&&!(/s$/.test(nxt)||/x$/.test(nxt))&&_nxr!=='là'&&_nxr!=='çà';   // NOM SG derrière = posterior §3 `_nounGate` (P(NOM)≥τ ∧ P(VER)<ε), PAS GENDER_PURE brut : « bien »/« à »/« de » y figurent (note, homographes) → FP « …et… sont bien décidées »→son ; _nounGate les écarte, garde chien/frère/ami. « là »/« çà » accentués = adverbes, exclus.
    var _pp0=_prevPron(T,i);   // _prevPron : « qu'ils son partis » porte son sujet dans le token élidé (miroir Python)
    var pluralSubj=(_pp0==='ils'||_pp0==='elles')||cplBefore(T,i)||cpl(T,i-1);
    if(!pluralSubj){for(var j=i-1;j>i-9&&j>=0;j--){if(_SEG&&(j+1)<_SEG.bb.length&&_SEG.bb[j+1])break;if(PLURAL_DET[deacc(T[j].toLowerCase())]){pluralSubj=true;break;}}}
    if(lw==='sont'){var _sp=_pp0;if(_sp==='il'||_sp==='elle'||_sp==='on'||_sp==='ils'||_sp==='elles'||_sp==='je'||_sp==='tu'||_sp==='nous'||_sp==='vous')return null;   // après un PRONOM SUJET (même élidé « qu'il »), « sont » est le VERBE (« il sont là »), jamais le possessif ; laisse rIlIls corriger il→ils
      if(pluralSubj)return null;if(nxtNounSg)return 'son';return null;}
    if((_pp0==='ils'||_pp0==='elles')&&nxt&&!nxtNounSg)return 'sont';
    // PILOTE analyse — sujet NOM : pluriel avant + « son » suivi d'une PRÉP (ou « en ») + pas déterminant/prép avant + AUCUN verbe fini → sont
    if(pluralSubj&&(PREP[nxt]||nxt==='en')&&!NUM_DET[cprev(T,i)]&&!PREP[cprev(T,i)]&&_clauseNoFiniteVerb(T,i,i+1))return 'sont';
    if(i+1<T.length&&pluralSubj&&!NUM_DET[cprev(T,i)]&&!PREP[cprev(T,i)]&&_ppBase(T[i+1])!==null&&/[sx]$/.test(nxt)&&_clauseNoFiniteVerb(T,i,i+1))return 'sont';
    /* ⭐ ADJECTIF PLURIEL (« les chiens son gentils »→sont). L'exclusion des adjectifs était MESURÉE
       (« son ancienne équipe », « son style, » = possessif + nom homographe d'adjectif). On ne la
       rouvre que là où le doute tombe, par un FAIT STRUCTUREL plus fort que le tagger : le possessif
       « son » est TOUJOURS suivi d'un nom SINGULIER. Un mot marqué pluriel derrière lui exclut donc
       le possessif — sauf si son -s/-x n'est pas une marque de pluriel (« son fils », « son corps »,
       « son prix »), d'où la liste des INVARIABLES.
       ⚠️ Le tagger étiquetait « contents » et « malades » NOUN, parce que le « son » fautif le poussait
       à lire un déterminant : son contexte est empoisonné par la faute elle-même. Le fait structurel,
       lui, ne l'est pas. Miroir Python rule_son_sont. */
    if(i+1<T.length&&pluralSubj&&!NUM_DET[cprev(T,i)]&&!PREP[cprev(T,i)]&&/[sx]$/.test(nxt)
       &&!_SON_INVAR[deacc(nxt)]&&_clauseNoFiniteVerb(T,i,i+1)){
      var _tgs=posTags(T),_apr=(_tgs&&i+2<_tgs.length)?_tgs[i+2]:null;
      if(_apr!=='NOUN'&&_apr!=='PROPN')return 'sont';}   // « les enfants son partis »→sont
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
  /* ⭐ FP ROUGE MESURÉ EN PRODUCTION (26/08/2026) : « Dans ses statistiques on voit bien. » —
     français parfaitement correct — devenait « ses statistiques ONT voit bien », appliqué D'OFFICE.
     Cause : `cpl(T,i-1)` ne demande qu'un PLURIEL juste avant « on », sans vérifier qu'il s'agit du
     SUJET. Ici le pluriel est dans un groupe PRÉPOSITIONNEL (« Dans ses statistiques »), donc « on »
     est bien le sujet. La carte l'affichait déjà sans que rien n'en tire la conséquence : son propre
     test de substitution rendait « ses statistiques avaient voit bien », qui ne se dit pas.
     Cette garde ne peut que RETIRER une correction, jamais en ajouter. */
  var _PREP_SUJ_EXT={selon:1,parmi:1,chez:1,malgre:1,durant:1,concernant:1,via:1,envers:1};   // prépositions absentes de PREP — FP préexistant mesuré 31/08 : « SELON les experts on peut venir »→ont ; la garde ne peut que RETIRER une correction (direction sûre). Miroir Python.
  var _AVOIR_IDIOM={faim:1,soif:1,peur:1,froid:1,chaud:1,raison:1,tort:1,besoin:1,envie:1,sommeil:1,honte:1,mal:1};   // « avoir X » figés : « on X » sans verbe n'est jamais correct (rOn). Miroir Python.
  var _A_NU_STOP={};('lieu droit recours tendance obligation valeur cours effet acces confiance conscience affaire trait egard part charge coeur hate rendez interet vocation pouvoir peine '+
    'priori posteriori contrario fortiori minima maxima peu quant ans heures euros metres kilometres millions milliards').split(' ').forEach(function(w){_A_NU_STOP[w]=1;});   // bare-nouns d'avoir hors _AVOIR_IDIOM (mesurés UD : a lieu ×13…) + latins + unités. Miroir Python.
  function _plurSousPrep(T,i){
    var j,d=-1;
    for(j=i-1;j>=0&&j>=i-3;j--){
      if(_SEG&&j+1<_SEG.bb.length&&_SEG.bb[j+1])return false;      // frontière → autre proposition
      var w=deacc(T[j].toLowerCase());
      if(NUM_DET[w]==='pl'){d=j;break;}}
    if(d<1)return false;
    var _dp=deacc(T[d-1].toLowerCase());
    return !!PREP[_dp]||!!_PREP_SUJ_EXT[_dp];}
  function rOn(T,i){
    if(deacc(T[i].toLowerCase())==='ont'&&i+2<T.length){var _po=T[i+1].toLowerCase();
      if((_po==='sur'||_po==='sous'||_po==='contre'||_po==='entre')&&_isPpl(T[i+2]))return null;}   // « ils ont contre attaqué » : composé COUPÉ (mot coupé dys) — corriger ont→on cassait la phrase (conflit lu à la carto) ; 0 occurrence sur 16 950 correct
var lw=deacc(T[i].toLowerCase());if(lw!=='on'&&lw!=='ont')return null;
    if(_SEG&&i<_SEG.hy.length&&_SEG.hy[i])return null;   // « avait-on », « peut-on » : trait d'union → pronom inversé
    if(lw==='ont'){var _tgo=posTags(T),_so=_tgo?_npSubject(T,_tgo,i):null;   // « on » est un PRONOM SUJET : il ne peut PAS suivre un sujet NOMINAL. « La direction ont modifier » ne peut pas devenir « La direction ON modifier » — impossible en français. Ce test passe AVANT tous les autres, sinon le raccourci « mot suivant en -e » tranche le premier (« L'équipe ont rencontre » → « on rencontre »).
      if(_so&&_so.idx===i-1){if(_so.n==='p')return null;return ckeepcase(T[i],'a');}
      var _cib=(i===0)||(_SEG&&i<_SEG.bb.length&&_SEG.bb[i]);
      if(!_so&&i>0&&!_cib){var _el=T[i-1].toLowerCase().match(/^l['’](.+)$/);   // ÉLISION : « L'équipe » est UN SEUL token, donc _npSubject n'y voit aucun déterminant et s'abstient. Or « l' » est TOUJOURS singulier (« les » ne s'élide jamais) — l'information est là, elle est juste collée.
        var _lft=i>=2?deacc(T[i-2].toLowerCase()):'';   // MESURÉ : sans garde, cette branche coûte 4 FP sur UD (« de l'auteur, ont été publiées » sujet POSTPOSÉ, « de l'homme, ont été unanimes » incise, « et l'étalonnage ont été » coordination, « de l'album ont eu lieu » écran prépositionnel). Les quatre sont exactement ce que _npSubject garde déjà ⇒ on lui EMPRUNTE ses gardes au lieu d'en inventer.
        if(_el&&!_LELID_STOP[deacc(_el[1])]&&!PREP[_lft]&&_lft!=='et'&&_lft!=='ou'&&_lft!=='ni'){var _pe=NOUN_POST&&NOUN_POST[deacc(_el[1])];if(_pe&&_pe[0]>=PL_TAU_M)return ckeepcase(T[i],'a');}}}   // nom confiant après « l' » ⇒ sujet nominal singulier ⇒ « a ». Stop-liste : « l'un / l'autre / l'on » ne sont pas des noms-têtes.   // tête du GN COLLÉE au verbe (idx===i-1) : exigence qui écarte l'écran « de N » (« l'ensemble DES PARTICIPANTS ont », usage toléré), piège mesuré de cette famille. Sujet nominal SINGULIER → l'auxiliaire est « a » (avoir 3sg). Débloque aussi le BLOCAGE MUTUEL : « ont modifier » n'était corrigible d'aucun côté ; « a » posé, la règle du participe tire au tour suivant.
    var nx=i+1<T.length?T[i+1].toLowerCase():'';if(/e$/.test(nx)&&!/ée$/.test(nx)&&svReads(nx).length)return 'on';
    // TÊTE de proposition (i==0 ou frontière avant) : le sujet à GAUCHE est d'une AUTRE proposition — contexte gauche INVALIDE (FP WiCoPaCo « …données. On pouvait… »)
    var ci=(i===0)||(_SEG&&i<_SEG.bb.length&&_SEG.bb[i]);
    if(!ci){
      var p=cprev(T,i);var pr=i>0?deacc(T[i-1].toLowerCase()):'';var glued=(pr.indexOf("'")>=0)&&(/ils$/.test(pr)||/elles$/.test(pr));
      if(p==='ils'||p==='elles'||glued||(cpl(T,i-1)&&!_plurSousPrep(T,i)))return 'ont';
      if(i+1<T.length&&_isPpl(T[i+1]))return 'ont';
      // ⭐ IDIOME D'AVOIR après sujet pluriel À DISTANCE (31/08, transposition du pilote son/sont) :
      // « Les enfants de Paul on faim » → ont. « on + faim/soif/peur… » n'existe JAMAIS en français
      // correct — liste FERMÉE, jamais le cas général « on + nom » (FP construisible : incise « et on,
      // avec le temps, … »). Preuve de pluriel = cplBefore ; ceinture : aucun verbe fini dans la fenêtre.
      if(_AVOIR_IDIOM[deacc(nx)]&&cplBefore(T,i)&&_clauseNoFiniteVerb(T,i))return 'ont';
    }
    if(vlike(T,i+1)){
      if(lw==='ont'){
        if(_looksPpl(T[i+1]))return null;   // « ont conclu/suivi/déduit/orchestré » = avoir 3pl + participe, jamais « on » (FP WiCoPaCo)
        if(_pluralLeft(T,i))return null;    // sujet pluriel coordonné/relatif (« l'état et le gouvernement ont », « …qui…ont ») → « ont » correct (FP WiCoPaCo)
      }
      return 'on';
    }
    return null;}
  var _LELID_STOP={un:1,une:1,autre:1,autres:1,on:1,uns:1};   // « l'un et l'autre ont… » : pronoms indéfinis, pas des noms-têtes de sujet singulier
  var INVAR_NOUN={pays:1,temps:1,prix:1,poids:1,corps:1,fois:1,mois:1,cas:1,bras:1,dos:1,nez:1,choix:1,voix:1,croix:1,bois:1,univers:1,succes:1,progres:1,repas:1,avis:1,sens:1,cours:1,concours:1,discours:1,jus:1,tas:1,os:1,puits:1,bus:1,virus:1,tennis:1,colis:1,devis:1,permis:1,compromis:1,paradis:1,velours:1,dais:1};
  var MAIS_STOP={pas:1,plus:1,moins:1,point:1,rien:1,tout:1,tres:1,jamais:1,surtout:1,aussi:1,encore:1,toujours:1,comment:1,pourquoi:1,peu:1,trop:1,bien:1,non:1,oui:1,si:1,assez:1,enfin:1,donc:1,car:1,alors:1,ici:1,la:1};
  var DET_SKIP={plus:1,moins:1,tres:1,bien:1,trop:1,assez:1,aussi:1,si:1,autre:1,autres:1,meme:1,propre:1,seul:1,seule:1,tel:1,telle:1,certain:1,certaine:1,tout:1,toute:1,grand:1,grande:1,petit:1,petite:1,gros:1,grosse:1,beau:1,bel:1,belle:1,bon:1,bonne:1,nouveau:1,nouvel:1,nouvelle:1,premier:1,premiere:1,dernier:1,derniere:1,jeune:1,vieux:1,vieil:1,vieille:1,long:1,longue:1,large:1,simple:1,super:1,superbe:1,primaire:1,double:1,triple:1,sous:1,pour:1,contre:1,par:1,sans:1,avec:1,entre:1,vers:1,mi:1,demi:1,semi:1,pseudo:1,quasi:1,ex:1,porte:1,montre:1,des:1,les:1,de:1,le:1};
  function rLeur(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='leur'&&lw!=='leurs')return null;if(i+1>=T.length)return null;if(vlike(T,i+1))return 'leur';var dn=deacc(T[i+1].toLowerCase());if(INVAR_NOUN[dn])return 'leur';
    // ⭐ L'ANCRE DOIT ÊTRE FIABLE (audit 2026-08-22) : cette règle lit le NOMBRE sur l'orthographe du nom suivant, or sur du texte dys c'est justement l'orthographe qui n'est pas fiable.
    //  ① nom INCONNU (« leur payss », « lèurs tigec ») : le -s final n'est pas une marque de pluriel, c'est du bruit → abstention.
    //  ② FAUX pluriel (« leur français ») : INVAR_NOUN ignore les noms en -ais/-ois → test MORPHOLOGIQUE (le singulier doit exister au lexique) au lieu d'une liste qui grandirait. Miroir Python rule_leur_leurs.
    if(!_wordKnown(dn))return null;
    if(/[sx]$/.test(dn)){var _sgl=/aux$/.test(dn)?dn.slice(0,-3)+'al':dn.slice(0,-1);if(!_wordKnown(_sgl))return null;}   // ② -s non morphologique → on ne sait pas (proposer « leur » ajoutait un FP sur « leurs Français ») → abstention
    /* ⚠️ CONFLIT DE DIRECTION (miroir app + Python). « leurs tige » : cette règle disait
       « leurs »→« leur » pendant que `rNounPlural` disait « tige »→« tiges ». Deux tokens
       DIFFÉRENTS, donc les deux rouges s'appliquaient : résultat « leur tiges », une faute
       fabriquée. Mesuré sur 99 désaccords déterminant↔nom appariés : le gold corrige le NOM
       59 fois contre 12 le déterminant. On laisse la main au nom, mais seulement si
       `rNounPlural` tire vraiment — sinon on perdrait la correction au lieu de la déplacer. */
    if(lw==='leurs'&&!/[sx]$/.test(dn)&&rNounPlural(T,i+1))return null;
    return /[sx]$/.test(dn)?'leurs':'leur';}
  var _PP_NOUN_HOMO={mort:1,fait:1,part:1,point:1};   // noms homographes d'un participe → « à » PRÉPOSITION (condamnée à mort, tout à fait, à part, à point) ; le tagger tranche NOM vs VERB
  var _PRON_INV={il:1,elle:1,on:1,ils:1,elles:1,je:1,tu:1,nous:1,vous:1,ce:1,ca:1};   // sujets qui s'INVERSENT après le verbe
  // ⭐ CE GARDE NE VÉRIFIAIT PAS CE QU'IL NOMMAIT. Son commentaire dit « pronom sujet en i-1 INVERSÉ »,
  // mais il lui suffisait d'un VERBE deux mots avant : « modifierait · l'article · a » était lu comme une
  // inversion, et toute la règle a/à se taisait dès qu'un nom suivait un verbe. Un PROXY à la place de la
  // condition réelle. On exige désormais que i-1 soit vraiment un pronom sujet (ou un trait d'union).
  function _aaInverted(T,i){if(i-2<0)return false;var hy=(_SEG&&_SEG.hy)?_SEG.hy:[];
    if(i-1<hy.length&&hy[i-1])return true;   // « a-t-il » : le trait d'union PROUVE l'inversion
    return vlike(T,i-2)&&!!_PRON_INV[deacc(T[i-1].toLowerCase())];}   // « avait il a faim » (dys, trait d'union omis)
  // ⭐ L'ANCRE AVANT NE VOYAIT PAS À TRAVERS UNE ÉLISION. Le test « mot d'avant connu du lexique »
  // (qui écarte l'anglais « for a Dream ») recevait le TOKEN BRUT : « l'article », « de l'école »,
  // « l'assiette » sont absents du lexique → la règle « a + nom nu » se taisait. Mesuré au moteur :
  //   « modifierait l'article a reception » MUET   /   « modifierait cet article a reception » TIRE
  //   « rentré de l'école a vélo »        MUET   /   « rentré du collège a vélo »        TIRE
  // C'est la cécité qui fait S'ABSTENIR (cf. « 46 listes fermées aveugles ») — réparable sans risque.
  // Et elle RESSERRE aussi : la liste d'exclusion des pronoms ne voyait pas « qu'il / s'il / lorsqu'elle ».
  var _RE_ELIDE_ANCRE=/^(?:l|d|j|m|t|s|c|n|qu|lorsqu|puisqu|quoiqu|jusqu)['’](.+)$/;
  function rA(T,i){if(deacc(T[i].toLowerCase())!=='a')return null;if(T[i]===T[i].toUpperCase()&&T[i]!==T[i].toLowerCase())return null;if(i+2<T.length&&deacc(T[i+1].toLowerCase())==='t'&&['il','elle','on','ils','elles'].indexOf(deacc(T[i+2].toLowerCase()))>=0)return null;/* « a-t-il/elle/on » : -t- euphonique = INVERSION → « a » = verbe avoir, jamais « à » */if(i>0&&i+1<T.length&&deacc(T[i-1].toLowerCase())==='tout'&&deacc(T[i+1].toLowerCase())==='fait')return null;/* locution « tout à fait » : « à » invariable, jamais « a » */
    var pb=(_SEG&&i<_SEG.bb.length)?_SEG.bb[i]:false;var tg=posTags(T);var p=cprev(T,i);   // POS PLEINE-PHRASE : sépare les FAUX participes (nom homographe / -ment nominal) du vrai participe → tue les FP à→a par élimination
    var pel=i>0?_ELIDED_PRON.exec(T[i-1].toLowerCase()):null;if(pel)p=deacc(pel[1]);   // « Lorsqu'il à faim » : le sujet vit DANS le token élidé ; le préfixe (qu'/s'/lorsqu'…) prouve un sujet PRÉVERBAL → le test d'inversion « avait-il » ne s'applique pas
    if(!pb&&(p==='il'||p==='elle'||p==='on'||p==='qui'||p==='ca'||p==='c')&&(pel||!_aaInverted(T,i)))return 'a';   // sujet 3sg net (pas à travers une virgule, pas inversé « avait-il ») → avoir
    if(i+1<T.length&&_isPpl(T[i+1])&&!/ee$/.test(deacc(T[i+1].toLowerCase()))){var dn=deacc(T[i+1].toLowerCase()),nt=(tg&&i+1<tg.length)?tg[i+1]:'';if(!(_PP_NOUN_HOMO[dn]&&nt==='NOUN'))return 'a';}   // « a + participe » → AVOIR, jamais « à ». Écarte -ée FÉMININ (« à durée » reste prép) ET le nom-homographe tagué NOM (« condamnée à mort », « tout à fait »)
    if(i+2<T.length&&/ment$/.test(deacc(T[i+1].toLowerCase()))&&(tg&&i+1<tg.length&&tg[i+1]==='ADV')&&_isPpl(T[i+2]))return 'a';   // « a + ADVERBE(-ment) RÉEL + participe » ; exige POS=ADV → exclut « à l'emplacement », « à l'effondrement » (NOM en -ment)
    if(!pb&&vlike(T,i-1)){var pv=i>0&&NOUN_POST?NOUN_POST.get(deacc(T[i-1].toLowerCase())):null;if(pv&&pv[0]>=PL_TAU_M&&pv[1]<PL_EPS_M)return null;return 'à';}
    // ⭐ « a » devant NOM NU (31/08, chantier a→à — miroir Python) : AVOIR exige un déterminant
    // (« rentré cher moi a vélo »→à). Sur UD 14 450, les seuls « a + nom nu » corrects = idiomes
    // d'avoir (a lieu/besoin/droit…) → stop-listes fermées ; latins, chiffres, ancre avant fiable
    // (écarte « for a Dream »), nom propre après exclu (différé). Mesuré : 0 FP UD, +2 strict gold.
    if(T[i]==='a'&&i>0&&!pb&&i+1<T.length&&!_aaInverted(T,i)){
      var _dn2=deacc(T[i+1].toLowerCase()),_pw2=deacc(T[i-1].toLowerCase()),_c1=T[i+1].charAt(0);var _el2=_RE_ELIDE_ANCRE.exec(_pw2);if(_el2)_pw2=_el2[1];
      if(_nounGate(_dn2)&&_dn2.length>=3&&!_AVOIR_IDIOM[_dn2]&&!_A_NU_STOP[_dn2]
         &&!(_c1===_c1.toUpperCase()&&_c1!==_c1.toLowerCase())
         &&['il','elle','on','ils','elles','je','tu','nous','vous','qui','ca','c','y','en'].indexOf(_pw2)<0
         &&(_wordKnown(_pw2)||GENDER_MAP[_pw2])
         &&!/\d/.test(T[i-1])
         &&!(_SEG&&i<_SEG.dig.length&&_SEG.dig[i])
         &&!(_SEG&&i+1<_SEG.dig.length&&_SEG.dig[i+1]))return 'à';
    }
    return null;}
  var _ET_ADV={},_ET_PREP={};
  'tres si tout toute bien plus trop assez vraiment deja encore fort peu moins aussi'.split(' ').forEach(function(w){_ET_ADV[w]=1;});
  'au aux du des de a en par pour sur sous dans avec sans vers chez entre'.split(' ').forEach(function(w){_ET_PREP[w]=1;});
  function rEt(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='et'&&lw!=='est')return null;
    if(_SEG&&i<_SEG.bb.length&&_SEG.bb[i])return null;   // frontière avant (« elle, et … ») → pas de sujet net
    var p=cprev(T,i);
    if(!(p==='il'||p==='elle'||p==='on'||p==='c'||p==='ce'||p==='ca'||p==='qui')){
      /* SUJET NOMINAL (« Ce chien et gentil. ») — muet jusqu'au 26/08/2026. La garde d'origine
         exigeait un PRONOM, ce qui protégeait de « le roi, et … ». Élargi au seul cas où le doute
         tombe : DÉTERMINANT + NOM avant, ADJECTIF après. Quatre gardes nées de FP MESURÉS sur UD :
           · préposition contractée après « et » (« et AUX Contes ») ;
           · l'attribut suivi d'un DÉTERMINANT (« et bien sûr LA Vierge » = énumération) ;
           · un VERBE CONJUGUÉ déjà dans la proposition (« …SONT le norrois ET l'anglais ») ;
           · le tagger étiquette PROPN une graphie désaccentuée (« frere ») → accepté en minuscule.
         Après gardes : 0 tir sur les 2 500 phrases UD, FP à l'échelle inchangé (1,40 %), census dys
         inchangé (301/301). Miroir Python rule_et_est. */
      if(lw!=='et')return null;
      var _tg=posTags(T);
      if(!_tg||i===0||i+1>=T.length)return null;
      if(_tg[i-1]!=='NOUN'&&_tg[i-1]!=='PROPN')return null;
      if(_tg[i-1]==='PROPN'){var _c1=T[i-1].charAt(0);if(_c1!==_c1.toLowerCase())return null;}
      if(i<2||!(deacc(T[i-2].toLowerCase()) in NUM_DET))return null;
      var _j=i+1,_n1=deacc(T[_j].toLowerCase());
      if(_ET_PREP[_n1])return null;
      if(_ET_ADV[_n1]&&_j+1<T.length)_j++;
      if(_j>=T.length||_tg[_j]!=='ADJ')return null;
      if(_j+1<T.length&&(deacc(T[_j+1].toLowerCase()) in NUM_DET))return null;
      if(!_clauseNoFiniteVerb(T,i))return null;
      return 'est';
    }
    if(i+1<T.length){var _na=deacc(T[i+1].toLowerCase());if(_na==='il'||_na==='elle'||_na==='on'||_na==='ils'||_na==='elles'||_na==='je'||_na==='tu'||_na==='nous'||_na==='vous'||_na==='moi'||_na==='toi'||_na==='lui'||_na==='eux'||_na==='soi')return null;}   // « il et elle », « lui et moi » : pronom sujet après « et » → sujet COORDONNÉ, jamais « est » (« il est elle » agrammatical)
    if(i+1<T.length){var c0=T[i+1].charAt(0);if(c0!==c0.toLowerCase()&&c0===c0.toUpperCase())return null;}   // « et Bob », « et Chris » → nom propre → conjonction
    if(i+1<T.length&&(isParticiple(T,i+1)||!(T[i+1].toLowerCase() in NUM_DET)))return 'est';return null;}
  var _CLAUSE_PRON={il:1,elle:1,ils:1,elles:1,on:1,je:1,tu:1,nous:1,vous:1};
  function rEstEtClause(T,i){   // « est » + NOUVELLE PROPOSITION (pronom sujet + verbe : « la plage est c'était cool ») → « et ». Miroir rule_est_et_clause (Python). ORANGE (vig).
    if(deacc(T[i].toLowerCase())!=='est'||i+1>=T.length||i===0)return null;
    if(_SEG&&i<_SEG.hy.length&&(_SEG.hy[i]||(i+1<_SEG.hy.length&&_SEG.hy[i+1])))return null;   // « est-il ? »
    var p=cprev(T,i);if(p==='il'||p==='elle'||p==='on'||p==='c'||p==='ce'||p==='ca'||p==='qui'||p==='qu'||p==='y'||p==='ne'||p==='n')return null;
    var nx=T[i+1].toLowerCase().replace(/’/g,"'"),m=/^(c|j)'(.+)$/.exec(nx);
    if(m)return (m[1]==='c'&&/^[eé]/.test(m[2]))?{sugg:ckeepcase(T[i],'et'),vig:1}:null;   // c'est / c'était — pas j'
    if(_CLAUSE_PRON[deacc(nx)]&&i+2<T.length){var n2=T[i+2].toLowerCase();if(n2!=='qui'&&n2!=='que'&&n2!=='qu'&&n2!=='même'){var tg=posTags(T);if(!tg||i+2>=tg.length||(tg[i+2]!=='VERB'&&tg[i+2]!=='AUX'))return null;return {sugg:ckeepcase(T[i],'et'),vig:1};}}   // « est il POUR… ? » (inversion sans trait d'union) : le pronom doit être SUIVI D'UN VERBE
    return null;}
  /* « de nouveau », « de loin », « de suite »… : locutions ADVERBIALES après « peut ». Le mot qui
     suit « de » y est un adverbe/adjectif, pas un nom quantifié — « peut » y reste le verbe. */
  var _PEU_LOC={};('nouveau loin suite pres cote force justesse memoire naissance nature bonne '+
    'mauvaise plus moins mieux trop rien tout toute').split(' ').forEach(function(w){_PEU_LOC[w]=1;});
  function rPeu(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='peu'&&lw!=='peux'&&lw!=='peut')return null;var p=cprev(T,i);if(p==='je'||p==='tu')return 'peux';if(p==='il'||p==='elle'||p==='on'||p==='qui')return 'peut';if(p==='un'||p==='de'||p==='tres'||p==='si'||p==='trop'||p==='assez'||p==='bien'||p==='plus'||p==='tout'||p==='aussi'||p==='y')return 'peu';
    /* ⭐ LE CRÉNEAU DU VERBE EST-IL DÉJÀ PRIS ? La règle ne regardait que le mot d'AVANT. Or « peut »
       est un VERBE : si la proposition en porte déjà un fini, « peut » ne peut pas l'être — c'est
       l'adverbe « peu ».
         « Il y A peut de monde »   → « a » occupe le créneau    → peu
         « Il RESTE peut de temps » → « reste » l'occupe          → peu
         « Il peut de nouveau marcher » · « il peut de temps en temps venir » → créneau libre → abstention
       ⚠️ Le « de » suivant ne suffit PAS comme garde : « de temps en temps » a lui aussi de+NOM.
       D'où la liste fermée des LOCUTIONS adverbiales. Miroir Python rule_peu. */
    if((lw==='peut'||lw==='peux')&&i+1<T.length&&deacc(T[i+1].toLowerCase())==='de'
       &&!(i+2<T.length&&_PEU_LOC[deacc(T[i+2].toLowerCase())])
       &&!_clauseNoFiniteVerb(T,i))return 'peu';
    return null;}
  // « ke/ge/ce/se + suis/serai/serais/fus » : sujet de 1re pers. mal écrit devant ÊTRE 1sg à initiale CONSONNE. Séquence
  // IMPOSSIBLE en français → FP=0 STRUCTUREL (0/2500+14450 UD). me/te/le exclus (« je me suis ») ; voyelle ai/étais → 2e temps.
  function rJeSubject(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='ke'&&lw!=='ge'&&lw!=='ce'&&lw!=='se')return null;if(i+1>=T.length)return null;var nd=deacc(T[i+1].toLowerCase());if(nd==='suis'||nd==='serai'||nd==='serais'||nd==='fus')return ckeepcase(T[i],'je');return null;}
  var _E_PPL_STOP={};('cause envie affaire affaires confiance honte hate chance peine conscience connaissance tendance coutume estime importance influence crainte cure grace force partie suite tete course prise charge').split(' ').forEach(function(w){_E_PPL_STOP[w]=1;});   // locutions « avoir + nom NU » : jamais un participe

  /* Verbes dont l'auxiliaire est ÊTRE et dont le présent 3sg finit en -e. « entre » est ABSENT :
     c'est d'abord une PRÉPOSITION (« il est entre deux chaises » est correct). */
  var _PPL_ETRE_VERBES={};'arrive tombe monte remonte reste rentre retourne passe repasse demeure'
    .split(' ').forEach(function(w){_PPL_ETRE_VERBES[w]=1;});
  function rEPpl(T,i){var w=T[i],lw=w.toLowerCase(),dl=deacc(lw);   // AUXILIAIRE + verbe au PRÉSENT en -e → PARTICIPE en -é (« ont trouve »→trouvé). Le dys écrit la forme qu'il ENTEND ; après un auxiliaire une forme FINIE est structurellement impossible. La règle é/er ne voyait que -é↔-er, jamais le présent nu.
    if(lw.indexOf("'")>=0||!/e$/.test(dl)||/é$/.test(lw)||/ée$/.test(lw))return null;
    if(dl.length<4)return null;
    if(SP&&SP.ready&&SP.WORDS&&!SP.WORDS.has(lw))return null;   // MOT CORRECTEMENT ÉCRIT seulement. Les formes FAUTIVES (« a verifie ») sont déjà traitées par le speller, qui a le lexique ACCENTUÉ et rend « vérifié » ; ici on n'a que le radical tel quel, donc sur un mot fautif on produirait un NON-MOT (« ecouté »).
    if(!COMMON_VERBS[deacc((w.slice(0,-1)+'er').toLowerCase())])return null;   // vrai verbe du 1er groupe, jeu CURÉ — le commentaire de la règle é/er documente qu'élargir au lexique 155k fait monter les FP (53→74 sur UD) : on ne rouvre pas ça
    /* ÊTRE + verbe de la LISTE FERMÉE : les gardes « nom homographe » ne s'appliquent PAS. Après
       « est », un nom NU est impossible (« il est tombe », « il est reste ») — c'est justement ce qui
       rend le participe certain. Sans l'exemption, la tombe / le reste / la passe bloquaient 4 des
       5 cas (mesuré). Miroir Python rule_e_ppl. */
    var _etrePp=(i>0&&AUX_ETRE[deacc(T[i-1].toLowerCase())]&&_PPL_ETRE_VERBES[dl]);
    if(!_etrePp&&(NOUN_E[dl]||_E_PPL_STOP[dl]))return null;
    if(GENDER_PURE[dl]!==undefined&&!_etrePp){var nx=(i+1<T.length)?deacc(T[i+1].toLowerCase()):'';   // NOM homographe (commande, place, garde, écoute…) : après un auxiliaire un nom NU n'existe qu'en LOCUTION ; un vrai complément exige un DÉTERMINANT, qui est AUDIBLE donc fiable
      if(!NUM_DET[nx]&&!DET_G[nx])return null;}
    if(PREP[dl]||MODAL[dl])return null;   // mot-outil homographe (« a ENTRE autres participé ») : « entre » est une préposition, pas un verbe
    if(i===0)return null;
    /* AVOIR, ET ÊTRE POUR LES SEULS VERBES QUI SE CONJUGUENT AVEC LUI. L'exclusion d'ÊTRE était
       MESURÉE (« est infecte », « est sèche », « est célèbre », « est égale » : l'essentiel des
       70 FP). On ne la rouvre pas en grand : liste FERMÉE de verbes de mouvement/état, dont aucun
       des quatre FP historiques ne fait partie — exclus par construction.
       ⛔ Tenté et refusé avant : le tagger (rend VERB sur « seche » et « celebre ») et ADJ_LEX
       (17 257 entrées, contient « fatigue », « arrive », « fixe » : il ne discrimine rien). */
    if(!AUX_AVOIR[deacc(T[i-1].toLowerCase())]&&!_etrePp)return null;   // AVOIR SEULEMENT. Après ÊTRE, une forme en -e est presque toujours un ADJECTIF (« est infecte », « est sèche », « est célèbre », « est égale ») : mesuré, ÊTRE apportait l'essentiel des 70 FP.
    if(T[i-1].toLowerCase().indexOf('à')>=0)return null;   // « à » se DÉACCENTUE en « a » : sans ce test la préposition passait pour l'auxiliaire et « à BASE de » devenait « à basé de » (11 FP à elle seule)
    if(i-1>0&&T[i-1].charAt(0)!==T[i-1].charAt(0).toLowerCase())return null;   // « A » MAJUSCULE n'est pas le verbe avoir : titre étranger (« A Place For Paedophiles ») ou sigle coupé au point (« Bubendorff S.A. installe »)
    if(w.charAt(0)!==w.charAt(0).toLowerCase())return null;   // un participe après avoir n'est pas capitalisé en cours de phrase
    if(i>=2&&CAUX[deacc(T[i-2].toLowerCase())])return null;   // « est a base de » : ÊTRE suivi de AVOIR-3sg est impossible — ce « a » est un « à » mal accentué
    /* Après ÊTRE le participe S'ACCORDE avec le sujet (« ils sont tombé » resterait faux) : on lit
       le pronom sujet, cas dys courant. Après AVOIR il est invariable. */
    var _suf='';
    if(_etrePp&&i>=2)_suf=({il:'',on:'',elle:'e',ils:'s',elles:'es',nous:'s',vous:'s'})[deacc(T[i-2].toLowerCase())]||'';
    var _sg=_emit(w,function(x){return x.slice(0,-1)+'é'+_suf;},true);   // PRIMITIVE PARTAGÉE, mode « forme déjà établie fautive par le contexte » : « il a repare » -> « réparé » (et non « reparé », qui existe mais n'est pas le mot voulu)
    if(_sg===null)return null;
    return ckeepcase(w,_sg);}
  function rDesDes(T,i){if(deacc(T[i].toLowerCase())!=='des')return null;if(i+1>=T.length)return null;   // « des » écrit pour « dès ». Deux formes seulement dans les 50 cas mesurés, toutes deux STRUCTURELLEMENT IMPOSSIBLES en français ⇒ FP=0 par construction.
    var nr=T[i+1],nd2=deacc(nr.toLowerCase());
    if(nd2==='que')return ckeepcase(T[i],'dès');                       // « des » est de+les, un déterminant pluriel ; « que » n'est pas un nom
    if(/^l['’]./.test(nr.toLowerCase()))return ckeepcase(T[i],'dès');   // un déterminant ne peut pas être suivi d'un autre déterminant élidé
    return null;}
  function rCe(T,i){var lw=deacc(T[i].toLowerCase());if(lw!=='ce'&&lw!=='se')return null;if(i+1>=T.length)return null;var nd=deacc(T[i+1].toLowerCase());
    if(nd==='qui'||nd==='que'||nd==='dont'||nd==='qu'||nd==="qu'")return ckeepcase(T[i],'ce');   // ce qui/que/dont (+ élidé qu')
    if(CAUX[nd]||nd==='sont'||nd==='est')return null;
    if(CLITIC[nd])return null;                                                   // clitique/ne → se pronominal / ce impersonnel → abstention
    if(NUM_DET[nd])return null;                                                  // ce/se + déterminant → abstention
    if(/ant$/.test(nd)&&nd.length>4)return null;                                 // participe présent → se réfléchi
    var isv=vlike(T,i+1),isn=!!GENDER_MAP[nd];
    if(isv&&!isn)return ckeepcase(T[i],'se');
    var tg=posTags(T);if(!tg||i+1>=tg.length)return (isn&&!isv)?ckeepcase(T[i],'ce'):null;       // sans tagger : repli nom-pur → ce
    if(isn&&!isv&&tg[i+1]!=='VERB'&&tg[i+1]!=='AUX')return ckeepcase(T[i],'ce');                 // nom PUR confirmé (pas verbe au tagger) → ce ; sinon (« il se document[e] ») → ne pas forcer « ce »
    if(lw==='se'){if(tg[i+1]==='NOUN')return ckeepcase(T[i],'ce');
      if(!/ant$/.test(nd)&&_nounGate(nd))return ckeepcase(T[i],'ce');return null;}   // LE TAGGER EST CONTAMINÉ PAR LA FAUTE ELLE-MÊME : dans « Se matin, la livraison est arrivée » il étiquette « matin » VERB, parce que « se » prédit un verbe. Un tagger conditionné sur le token fautif ne peut pas arbitrer la faute de ce token. Le posterior NOUN_POST est SANS CONTEXTE (prior lexical) donc immunisé : matin/jour/soir/moment = P(NOM) 1000‰ et P(VER) 0‰, tandis que livre/porte/marche/ferme restent ambigus et continuent de s'abstenir.                            // se + NOM → ce
    if((tg[i+1]==='VERB'||tg[i+1]==='AUX')){var p=_prevPron(T,i);if(p==='il'||p==='elle'||p==='on'||p==='je'||p==='tu'||p==='ils'||p==='elles'||p==='qui')return ckeepcase(T[i],'se');}   // ce + VERBE + SUJET pronom (même élidé « Puisqu'il ce regarde ») → se (sinon ce impersonnel)
    return null;}
  // « je/tu + c'est/ces/ses/sait » → « sais » (savoir) : suites IMPOSSIBLES en français correct → FP=0 (0/16951 UD). « il/on c'est » reste ambigu → non couvert. Miroir app.
  function rSais(T,i){var d=deacc(T[i].toLowerCase());if(d!=="c'est"&&d!=='ces'&&d!=='ses'&&d!=='sait')return null;if(_SEG&&i<_SEG.bb.length&&_SEG.bb[i])return null;
    var p=cprev(T,i);if(p==='je'||p==='tu')return ckeepcase(T[i],'sais');
    /* ⭐ « sait » + PARTICIPE PASSÉ → « s'est ». Le commentaire d'origine disait « il/on + sait reste
       AMBIGU », vrai en général — mais pas devant un participe : SAVOIR ne prend jamais un participe
       passé pour complément. « il sait nager » (infinitif) et « il sait la réponse » (nom) restent du
       savoir ; « le train sait arrêté », « il sait levé » ne peuvent être que « s'est ».
       ⚠️ NE PAS garder avec COMMON_VERBS/VERB_LEX : ils contiennent aussi « nager » et « compter »
       (mesuré). Le bon test est l'INFINITIF. Miroir Python rule_sais. */
    if(d==='sait'&&i+1<T.length){var _n=T[i+1];
      if((_ppBase(_n)!==null||IRR_PP[deacc(_n.toLowerCase())])&&!_isInfinitive(_n))return ckeepcase(T[i],"s'est");}
    return null;}
  function rCesSest(T,i){var d=deacc(T[i].toLowerCase());if(d!=='ces'&&d!=='cet')return null;
    /* « ces/cet » APRÈS un pronom sujet = faute certaine (un déterminant ne suit jamais un sujet nu) ;
       graphies dys du /sɛ/ de « s'est » (audit rappel PR#505 : « elle ces marier à l'age de vingt ans »).
       On ne propose s'est que devant MATIÈRE VERBALE (participe ou infinitif -er connu) — « elle, ces
       amis… » (nominal) reste hors-jeu. La cascade finit le travail : s'est+marier→marié (rEtreInfEr)
       puis l'accord participe. 0 tir/16 950 phrases correctes. */
    if(_SEG&&i<_SEG.bb.length&&_SEG.bb[i])return null;
    var p=cprev(T,i),_nomOK=false;
    if(!(p==='il'||p==='elle'||p==='on')){
      // branche sujets NOMINAUX (« Paul ces blessé », « la voisine ces trompé ») : mot plein tagué
      // NOUN/PROPN devant. Les 4 tirs du flood étaient TOUS « cet été » → « été » exclu (être n'est
      // pas pronominal, « s'est été » n'existe pas).
      if(i<1)return null;
      var _pvt=deacc(T[i-1].toLowerCase());
      var _FONCT={de:1,du:1,des:1,a:1,au:1,aux:1,le:1,la:1,les:1,un:1,une:1,et:1,ou:1,ni:1,que:1,qui:1,dans:1,sur:1,sous:1,avec:1,sans:1,pour:1,par:1,en:1,vers:1,chez:1};
      if(_FONCT[_pvt])return null;
      var _tgc=posTags(T);if(!_tgc||(_tgc[i-1]!=='NOUN'&&_tgc[i-1]!=='PROPN'))return null;
      _nomOK=true;
    }
    var j=i+1;while(j<T.length&&j<=i+3&&PPMID[deacc(T[j].toLowerCase())])j++;
    if(j>=T.length)return null;
    var w=T[j].toLowerCase();
    if(_nomOK&&deacc(w)==='ete')return null;
    var infEr=/^[a-zà-ÿ]{4,}er$/.test(w)&&!!CONJ_C[deacc(w)];
    if(!_isPpl(T[j])&&!(_nomOK&&_SAIS_PPU[deacc(w)])&&!infEr)return null;
    var c=T[i].charAt(0);return c!==c.toLowerCase()?"S'est":"s'est";}
  function rCestSest(T,i){if(deacc(T[i].toLowerCase())!=="c'est")return null;if(_SEG&&i<_SEG.bb.length&&_SEG.bb[i])return null;var p=_prevPron(T,i);/* _prevPron : lit aussi le pronom élidé (« Puisqu'elle c'est levée »→s'est) */if(!(p==='il'||p==='elle'||p==='on'))return null;var j=i+1;while(j<T.length&&j<=i+3&&PPMID[deacc(T[j].toLowerCase())])j++;if(j<T.length&&_isPpl(T[j])){var c=T[i].charAt(0);return c!==c.toLowerCase()?"S'est":"s'est";}return null;}   // [il/elle/on (même élidé)]+c'est(+adverbe)+participe → s'est (« elle c'est bien amusée »). FP=0.
  var _SA_NONNOUN={je:1,tu:1,il:1,elle:1,on:1,ils:1,elles:1,nous:1,vous:1,y:1,en:1,ne:1};   // ne peuvent jamais suivre le possessif « sa »

  /* ── ou/où — MIROIR de correcteur_probe.rule_ou_ou. MESURÉ le 2026-08-25 sur le corpus dys réel :
     11 vraies fautes sur 23 occurrences de « ou » (48 %), la famille la plus DENSE du corpus, et
     couverture ZÉRO jusqu'ici (REGLES_FR §2 la classait « carte enseignante » : signalée, sans
     suggestion). ORANGE : un accent change le SENS de la phrase, l'auteur tranche.
     TROIS CADRES, chacun mesuré à 0 faux positif sur 121 phrases UD correctes contenant « ou » :
       F1  « ou » + PRONOM SUJET .................... « ou il été », « ou je serai »
       F2  nom de LIEU/TEMPS DÉTERMINÉ + « ou » ..... « dans le cas ou », « un garage ou trouve »
       F5  INVERSION : « ou » + forme verbale + pronom sujet ... « ou été tu »
     ⛔ CADRES MESURÉS ET REFUSÉS : « ou »+VERBE CONJUGUÉ (14 FP/121 — les homographes nom/verbe la
     tuent : « insolent ou VIOLENT », « le catch ou LUTTE ») · tête de proposition + verbe, LE seul
     cas que couvre LanguageTool (2 FP pour +1 faute) · le sens inverse « où »→« ou » (trop lâche).
     ⭐ Les trois gardes viennent chacune d'un FP MESURÉ, jamais d'une intuition. */
  var _OU_PRON={je:1,tu:1,il:1,elle:1,on:1,nous:1,vous:1,ils:1,elles:1};
  var _OU_DET={le:1,la:1,les:1,un:1,une:1,des:1,ce:1,cet:1,cette:1,ces:1,mon:1,ma:1,mes:1,ton:1,ta:1,tes:1,son:1,sa:1,ses:1,notre:1,nos:1,votre:1,vos:1,leur:1,leurs:1,du:1,au:1,aux:1};
  var _OU_PREP={};('de du des d à a en par pour sans sur dans avec chez vers sous entre').split(' ').forEach(function(w){_OU_PREP[deacc(w)]=1;});
  var _OU_NOM={};('cas jour jours moment moments endroit endroits lieu lieux ville villes pays region regions maison maisons garage garages centre centres epoque annee annees instant instants heure heures minute minutes seconde periode siecle monde point points mesure etat situation salle chambre bureau ecole classe rue village quartier zone place piece etage terrain jardin champ foret riviere mer plage montagne hopital magasin restaurant hotel').split(' ').forEach(function(w){_OU_NOM[w]=1;});
  function _ouFini(w){var r=svReads(w),k;for(k=0;k<r.length;k++){var m=String(r[k][1]).split(':')[0];if(m==='ind'||m==='sub'||m==='cnd'||m==='cond'||m==='imp')return true;}return false;}
  function _ouVerbal(w){var r=svReads(w),k;for(k=0;k<r.length;k++){var m=String(r[k][1]).split(':')[0];if(m==='ind'||m==='sub'||m==='cnd'||m==='cond'||m==='imp'||m==='par'||m==='inf')return true;}return false;}
  /* ⛔ GARDE 3 (FP mesuré) : « Ou on est patriote, ou on est traître » — un AUTRE « ou » suivi d'un
     pronom sujet signe la CORRÉLATIVE, donc l'alternative, jamais la relative. */
  function _ouCorrel(T,i){var k;for(k=0;k<T.length;k++)if(k!==i&&deacc(T[k].toLowerCase())==='ou'&&k+1<T.length&&_OU_PRON[T[k+1].toLowerCase()])return true;return false;}
  /* ⛔ GARDE 2 (FP mesuré) : le verbe d'une relative a un SUJET, il n'est jamais précédé d'une
     PRÉPOSITION. Sans elle « une maison DE retraite » passait — « retraite » se lit comme le verbe
     « retraiter ». C'est la garde qui a fait tomber le dernier faux positif. */
  function _ouClauseVerbe(T,i){var k,fin=Math.min(T.length,i+7);for(k=i+1;k<fin;k++){if(_ouFini(T[k].toLowerCase())&&!(k>0&&_OU_PREP[deacc(T[k-1].toLowerCase())]))return true;}return false;}
  function rOuOu(T,i){
    if(deacc(T[i].toLowerCase())!=='ou'||T[i].toLowerCase()==='où')return null;
    var n=T.length;
    if(i+1<n&&_OU_PRON[T[i+1].toLowerCase()]&&!_ouCorrel(T,i))return {sugg:ckeepcase(T[i],'où'),vig:1};
    /* ⛔ GARDE 1 (FP mesuré) : le nom de lieu doit porter SON déterminant. « camarade DE classe ou
       une personne » est une coordination, pas une relative — « de » n'est pas un déterminant. */
    if(i>=2&&_OU_NOM[deacc(T[i-1].toLowerCase())]&&_OU_DET[T[i-2].toLowerCase()]&&_ouClauseVerbe(T,i))return {sugg:ckeepcase(T[i],'où'),vig:1};
    if(i+2<n&&_OU_PRON[T[i+2].toLowerCase()]&&_ouVerbal(T[i+1].toLowerCase())&&!_ouCorrel(T,i))return {sugg:ckeepcase(T[i],'où'),vig:1};
    return null;}
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
  var _MOIS={janvier:1,fevrier:1,mars:1,avril:1,mai:1,juin:1,juillet:1,aout:1,septembre:1,octobre:1,novembre:1,decembre:1};
  var _MAI_DATE_LEFT={en:1,de:1,du:1,des:1,depuis:1,jusqu:1,mi:1,debut:1,fin:1,courant:1,entre:1,avant:1,apres:1,vers:1,le:1,ce:1,cet:1,cette:1,au:1,aux:1,pour:1,d:1,premier:1,premiere:1,dernier:1,er:1,ler:1,et:1,ou:1,ni:1,que:1,qui:1,dont:1,si:1,comme:1,puis:1};   // contextes où « mai » est le MOIS. « er » y figure parce que le tokeniseur jette les chiffres : « le 1er mai » arrive comme [le, er, mai].
  var _MAI_OPEN={};('je tu il elle on nous vous ils elles ce ca cela ceci le la les un une des mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs cet cette ces ne n pas plus rien jamais aussi encore toujours cependant pourtant surtout enfin donc alors ici y en tout tous chacun personne quelques certains beaucoup peu').split(' ').forEach(function(w){_MAI_OPEN[w]=1;});   // ouvertures de proposition : « mais » introduit une SECONDE proposition
  function rMaiMais(T,i){if(deacc(T[i].toLowerCase())!=='mai')return null;
    if(i===0)return null;                                            // en tête : « Mai 68 » ; et une conjonction a besoin d'une proposition AVANT
    if(_SEG&&i<_SEG.bb.length&&_SEG.bb[i])return null;               // début de proposition
    if(i+1>=T.length)return null;                                    // rien à droite : pas de seconde proposition
    var p=deacc(T[i-1].toLowerCase());if(_MAI_DATE_LEFT[p]||_MOIS[p])return null;   // « en mai », « le 1er mai », « avril mai »
    var nr=T[i+1],n=deacc(nr.toLowerCase());if(_MOIS[n])return null;                // « mai juin juillet »
    if(!(_MAI_OPEN[n]||/^(l|j|c|n|s|qu)['’]/i.test(nr)))return null;   // ÉLISION : « l'équipe » est UN SEUL token — sans ce test on perdait 10 des 92 cas (même angle mort que la règle on/ont). Le déterminant est là, juste collé.
    var lo=0,z;if(_SEG){for(z=i;z>0;z--){if(z<_SEG.bb.length&&_SEG.bb[z]){lo=z;break;}}}
    for(z=lo;z<i;z++)if(vlike(T,z))return ckeepcase(T[i],'mais');    // une CONJONCTION joint deux propositions : il faut un verbe conjugué à GAUCHE, dans la même proposition. Écarte « Paris, mai 1968 : la révolution » (aucun verbe), que UD ne contient pas mais qui passerait sans ça.
    return null;}
  var MET_LEFT_SUBJ={il:1,elle:1,on:1,ce:1,ca:1,qui:1,celui:1,celle:1,chacun:1,nul:1,quiconque:1};var MET_RIGHT_CLAUSE={je:1,tu:1,il:1,elle:1,on:1,nous:1,vous:1,ils:1,elles:1,ce:1,ca:1,"j'ai":1,"j'avais":1,"j'aurai":1,"j'aurais":1};function rMetMais(T,i){var d=deacc(T[i].toLowerCase());if(d==='met'){if(T[i].charAt(0)!==T[i].charAt(0).toLowerCase()||i===0)return null;var pm=cprev(T,i);if(pm==null||MET_LEFT_SUBJ[pm]||CLITIC[pm])return null;var tgm=posTags(T);if(tgm&&i-1<tgm.length&&(tgm[i-1]==='NOUN'||tgm[i-1]==='PROPN'||tgm[i-1]==='DET'||tgm[i-1]==='NUM'))return null;if(_headText(T[i-1]).charAt(0)!==_headText(T[i-1]).charAt(0).toLowerCase())return null;var nn=(i+1<T.length?deacc(T[i+1].toLowerCase()):null);if(nn&&MET_RIGHT_CLAUSE[nn])return ckeepcase(T[i],'mais');return null;}if(d!=='mais')return null;if(_SEG&&i<_SEG.bb.length&&_SEG.bb[i])return null;var p=cprev(T,i);if(p==='je'||p==='tu')return 'mets';if(p==='il'||p==='on')return 'met';if(p==='ils')return 'mettent';return null;}   // je/tu/il/on/ils = clitiques sujets PURS (jamais objet de prép) + « mais » → forme de METTRE. FP=0. elle/elles exclus (pronom disjoint : « derrière elle mais… »).
  /* ── ÉLISION FUSIONNÉE : l'apostrophe non écrite (« jai »→« j'ai »). Le dys colle les deux mots.
     Quatre conditions CUMULÉES, et c'est leur INTERSECTION qui vaut :
       ① le mot écrit est INCONNU du lexique — elle écarte à elle seule « jetais » (imparfait de JETER)
          et « quelle » (« quelle heure ») ;
       ② il commence par un proclitique élidable ;
       ③ le reste commence par une VOYELLE ou un h — l'élision n'existe que là ;
       ④ le reste appartient à une LISTE FERMÉE de mots qui suivent réellement une élision.
     ⛔ MESURÉ : sans la garde NOM PROPRE, 104 FP sur les 2 500 phrases correctes — « Charles »→
        « C'harles » (harles est un canard), « San »→« S'an », « Nantes »→« N'antes ». Vérifier la casse
        du RESTE ne suffisait pas : dans « Charles » le reste est en minuscule.
     ⛔ Sans ④, le lexique entier laissait passer « avoie », « aria », « uke ». Et « m »/« t » sont
        RETIRÉS des proclitiques : « mai » et « tai » sont des mots réels.
     Miroir Python rule_elision_fusionnee. */
  var _FUS_PRE=['qu','j','s','c','n','d','l'];
  var _FUS_VOY={},_FUS_APRES={};
  'aeiouyhàâäéèêëîïôöùûü'.split('').forEach(function(c){_FUS_VOY[c]=1;});
  ('ai as a ait avait avais avaient ont avons avez est es etait etais etaient ete etre eu '+
   'il ils elle elles on en un une autre autres ici ailleurs aujourd hui heure heures '+
   'homme hommes ami amis amie amies ecole ecoles enfant enfants annee annees argent eau '+
   'air arbre arbres animal animaux idee idees image images objet objets oeuf oeufs '+
   'histoire histoires hopital ordinateur oreille oiseau oiseaux').split(' ')
   .forEach(function(w){_FUS_APRES[w]=1;});
  function rElisionFusionnee(T,i){
    var w=T[i],lw=w.toLowerCase();
    if(lw.indexOf("'")>=0||lw.indexOf('’')>=0||lw.length<3)return null;
    if(!SP||!SP.ready||!SP.WORDS)return null;
    if(SP.WORDS.has(lw)||SP.WORDS.has(deaccS(lw)))return null;                       // ① mot connu
    var c0=w.charAt(0);
    if(c0!==c0.toLowerCase()&&!(i===0||(_SEG&&i<_SEG.ss.length&&_SEG.ss[i])))return null;   // NOM PROPRE
    for(var k=0;k<_FUS_PRE.length;k++){var pre=_FUS_PRE[k];
      if(lw.indexOf(pre)!==0)continue;                                               // ②
      var rest=w.slice(pre.length);
      if(rest.length<2||rest.charAt(0)!==rest.charAt(0).toLowerCase())return null;
      if(!_FUS_VOY[deaccS(rest.charAt(0).toLowerCase())])return null;                // ③
      return _FUS_APRES[deaccS(rest.toLowerCase())]?ckeepcase(w,pre+"'"+rest):null;  // ④
    }
    return null;}
  function rMais(T,i){if(deacc(T[i].toLowerCase())!=='mais'||i+1>=T.length)return null;
    /* « Mais … » en tête de phrase est presque toujours une CONJONCTION — mais pas quand un NOM
       PLURIEL SUJET suit immédiatement (« Mais amis sont venus » = « Mes amis »). On lève l'abstention
       de tête UNIQUEMENT dans ce cadre : nom pluriel + VERBE CONJUGUÉ juste après, ce qui en fait le
       sujet. « Mais bon », « Mais oui », « Mais chers amis » restent écartés par les gardes existantes.
       Miroir Python rule_mais_mes. */
    var _tete=(i===0)||(_SEG&&i<_SEG.ss.length&&_SEG.ss[i]);
    if(_tete&&!(i+2<T.length&&svReads(T[i+2]).length))return null;
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
  var ETRE_PP={alle:1,allee:1,alles:1,allees:1,venu:1,venue:1,venus:1,venues:1,parti:1,partie:1,partis:1,parties:1,arrive:1,arrivee:1,arrives:1,arrivees:1,devenu:1,devenue:1,devenus:1,devenues:1,revenu:1,revenue:1,revenus:1,revenues:1,tombe:1,tombee:1,tombes:1,tombees:1,parvenu:1,parvenue:1,parvenus:1,parvenues:1,intervenu:1,intervenue:1,intervenus:1,intervenues:1,survenu:1,survenue:1,survenus:1,survenues:1,redevenu:1,redevenue:1,redevenus:1,redevenues:1};   // participes de verbes d'ÊTRE (liste CLOSE ; familles #8 ajoutées, flood UD=0)
  var PART_ART={le:1,la:1,"l'":1,les:1,un:1,une:1};   // article après « de » → partitif avoir
  function rJest(T,i){if(deacc(T[i].toLowerCase())!=="j'est"||i+1>=T.length)return null;   // « j'est » jamais valide → FP=0 structurel
    var nl=T[i+1].toLowerCase(),dn=deacc(nl);
    if(NUM_DET[nl]||dn==='ete'||dn==='eu'||dn==='du'||dn==='des')return ckeepcase(T[i],"j'ai");   // déterminant / été-eu / partitif du-des → j'ai
    if(nl==="de"||nl==="d'"){var _n2=i+2<T.length?T[i+2]:'',_c0=_n2[0]||'';if(PART_ART[_n2.toLowerCase()]||(_c0&&_c0.toLowerCase()!==_c0.toUpperCase()&&_c0===_c0.toLowerCase()))return ckeepcase(T[i],"j'ai");return null;}   // possession → j'ai (de la peine / de tomates=nom commun) ; « de Paris » (nom propre) = origine « je suis de… » → abstention
    if(CADJ[dn]||ETRE_PP[dn])return ckeepcase(T[i],"je suis");   // adjectif pur ou participe d'être → je suis
    if(_isPpl(T[i+1]))return ckeepcase(T[i],"j'ai");
    var _mz=dn.match(/^(.*?)(?:ez|er)$/);if(_mz&&_mz[1].length>=2){var _pp=_mz[1]+'é';   // BLOCAGE MUTUEL « j'est mangez » : rJest attend un participe, la règle -ez/-é attend un auxiliaire correct → aucune ne démarre. Or « j'est » n'est JAMAIS valide : si le mot suivant est une forme verbale en -ez/-er, l'auxiliaire visé est certain. On tranche ; l'itération du pipeline corrige -ez ensuite. FP=0 conservé (« j'est » toujours fautif ; ETRE_PP sépare je suis / j'ai).
      if(_isPpl(_pp))return ckeepcase(T[i],ETRE_PP[deacc(_pp)]?"je suis":"j'ai");}   // participe d'AVOIR (pris/mangé/vu…) → j'ai (ceux d'être sont déjà traités)
    return null;}   // sinon (de+nom propre…) → abstention
  function rCai(T,i){return deacc(T[i].toLowerCase())==="c'ai"?ckeepcase(T[i],"c'est"):null;}   // « c'ai » jamais valide (avoir au lieu d'être) → c'est
  // Élision fautive DEVANT CONSONNE → de-élide (FP=0 structurel : élidé valide seulement devant voyelle). Clitiques
  // DÉTERMINISTES (j'/n'/m'/d'/c'/qu') = parité triviale (aucun lexique) ; t'/s'/l'/h/y exclus (ambigus / h muet « l'homme »). Miroir correcteur_probe.rule_elide.
  var ELIDE={"j'":"je","n'":"ne","m'":"me","d'":"de","c'":"ce","qu'":"que"},ECONS="bcdfgjklmnpqrstvwxz",ELIDE_STOP={"n'roll":1,"m'sieur":1,"m'dame":1,"m'ame":1,"c'te":1}   /* ⚠️ LISTE UNIQUE (audit 2026-08-11), miroir de _ELIDE_STOP (Python). rElide et rDeselide font le MÊME travail et avaient DEUX listes d'exceptions divergentes : « n'roll » n'était que dans l'une, « m'dame/m'ame » que dans l'autre. Mesuré : « rock n'roll » -> « rock ne roll », « c'te histoire » -> « ce te ». */;
  function rElide(T,i){var w=T[i],lw=w.toLowerCase();if(ELIDE_STOP[lw])return null;for(var pre in ELIDE){if(lw.indexOf(pre)===0){var rest=w.slice(pre.length),c0=rest.charAt(0);if(rest&&c0===c0.toLowerCase()&&c0!==c0.toUpperCase()&&ECONS.indexOf(deacc(c0.toLowerCase()))>=0)return ckeepcase(w,ELIDE[pre]+' '+rest);return null;}}return null;}
  var SUBJ_PRON={je:['1','s'],tu:['2','s'],il:['3','s'],elle:['3','s'],on:['3','s'],ils:['3','p'],elles:['3','p']};
  var CLITIC={};['ne','me','te','se','le','la','les','lui','leur','y','en','nous','vous',"l'","m'","t'","s'","n'"].forEach(function(w){CLITIC[w]=1;});
  function svReads(w){var s=CONJ_F[deacc(w.toLowerCase())];if(!s)return[];var r=[],a=s.split('|'),k,f;for(k=0;k<a.length;k++){f=a[k].split(';');if(f.length===4)r.push(f);}return r;}
  function _fillReg3pl(cjc,cjf){var _REG3PL=[['ind:imp','ait','aient'],['cnd:pre','ait','aient'],['ind:fut','ra','ront']];for(var lem in cjc){for(var t=0;t<_REG3PL.length;t++){var mt=_REG3PL[t][0],s3=_REG3PL[t][1],p3=_REG3PL[t][2],slot=cjc[lem][mt];if(!slot)continue;var f3s=slot['3s'];if(Array.isArray(f3s))f3s=f3s[0];if(!f3s||slot['3p']||f3s.slice(-s3.length)!==s3)continue;var f3p=f3s.slice(0,-s3.length)+p3;slot['3p']=f3p;var key=deacc(f3p.toLowerCase()),rd=lem+';'+mt+';3;p',cur=cjf[key];if(!cur)cjf[key]=rd;else if(cur.indexOf(rd)<0)cjf[key]=cur+'|'+rd;}}}   // CLÔTURE 3PL RÉGULIÈRE déterministe (imparfait/conditionnel -ait→-aient · futur -ra→-ront, 0 exception) : build_cgram droppe l'imparfait 3pl + cnd/fut partiels (filtre HF). Miroir Python + app.
  var _ELIDED_PRON=/^(?:qu|s|n|c|j|l|d|m|t|puisqu|lorsqu|quoiqu)['’](il|ils|elle|elles|on|je|tu|nous|vous)$/;   // « qu'il », « s'ils » : le pronom sujet vit DANS le token élidé (miroir Python _ELIDED_PRON)
  function _prevPron(T,i){if(i<=0)return null;var m=_ELIDED_PRON.exec(T[i-1].toLowerCase());return m?deacc(m[1]):cprev(T,i);}   // pronom sujet EFFECTIF avant i : lit aussi le pronom PORTÉ par un token élidé (« Lorsqu'il à faim », « Puisqu'elle c'est levée » — 5 règles à liste propre le rataient, mesuré 30/08/2026). Miroir Python _prev_pron.
  function svSubject(T,i){var j=i-1,st=0;while(j>=0&&st<3&&CLITIC[deacc(T[j].toLowerCase())]){j--;st++;}if(j<0)return null;if(_SEG){for(var m=j+1;m<=i&&m<_SEG.bb.length;m++)if(_SEG.bb[m])return null;}var _me=_ELIDED_PRON.exec(T[j].toLowerCase());if(_me)return SUBJ_PRON[deacc(_me[1])]||null;return SUBJ_PRON[deacc(T[j].toLowerCase())]||null;}
  function svAgrees(reads,per,nb){var k;if(per==='3'){for(k=0;k<reads.length;k++)if(reads[k][2]===per&&(reads[k][3]===nb||reads[k][3]==='x'))return true;return false;}for(k=0;k<reads.length;k++)if(reads[k][2]===per)return true;return false;}
  var _V3PL_SURE={sont:1,ont:1,vont:1,font:1};   // 3e pluriel irréguliers non ambigus
  var _SAIS_PPU={perdu:1,vu:1,eu:1,venu:1,revenu:1,devenu:1,tenu:1,retenu:1,connu:1,recu:1,battu:1,mordu:1,rendu:1,vendu:1,entendu:1,repondu:1,defendu:1,descendu:1,couru:1,apercu:1,cru:1,bu:1,lu:1,su:1,pu:1,vecu:1,fondu:1,confondu:1,suspendu:1,attendu:1,obtenu:1,contenu:1,soutenu:1,parvenu:1,survenu:1,intervenu:1};
  function rAccordSV(T,i){if(T[i].toLowerCase().indexOf("'")>=0)return null;if(/(é|és|ée|ées)$/.test(T[i].toLowerCase()))return null;var reads=svReads(T[i]);if(!reads.length)return null;
    var _dsv=deacc(T[i].toLowerCase());
    if(_dsv==='sais'||_dsv==='sait'){var _js=i+1;while(_js<T.length&&_js<=i+3&&PPMID[deacc(T[_js].toLowerCase())])_js++;
      if(_js<T.length&&(_isPpl(T[_js])||_SAIS_PPU[deacc(T[_js].toLowerCase())]))return null;}   // sais/sait + PARTICIPE = frame « s'est » (l'orange saisVig parle) — corriger l'accord ici écrivait « il sait tromper » (conflit lu à la carto) ; coût 0 sur correct (l'accord 3s passe déjà)
var pn=svSubject(T,i);if(!pn)return null;var per=pn[0],nb=pn[1];
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
  /* SUJET POSTPOSÉ **SINGULIER** — jumeau de `_postposePlural`, qui ne savait dire que « pluriel ».
     Conséquence mesurée sur la phrase de Rem « les billevesées QUE RESSASSAIT cet aréopage » : le mode
     postposé ne pouvant pas répondre « singulier », les routes génériques votaient PLURIEL d'après
     l'antécédent (`billevesées`) et proposaient « ressassaient ». Faux, et sur du français correct.
     ⭐ POURQUOI C'EST SÛR, ET SEULEMENT DANS UNE RELATIVE EN « QUE » : l'objet du verbe y est DÉJÀ
     l'antécédent relativisé, donc un groupe nominal placé APRÈS le verbe ne peut être que le SUJET.
     Les autres déclencheurs du mode postposé (adverbe, préposition en tête) n'ont pas cette garantie
     — « Ainsi mangeait une pomme » y serait un objet — donc on ne leur ouvre PAS le verdict singulier. */
  var _POST_SG={};("le la l' un une ce cet cette mon ma ton ta son sa notre votre leur chaque").split(' ').forEach(function(w){_POST_SG[w]=1;});
  function _postposeSingulier(T,tg,k,hi){if(k>=hi)return false;
    var d0=deacc(T[k].toLowerCase());if(!_POST_SG[d0])return false;
    for(var m=k+1;m<Math.min(hi,k+5);m++){if(m<tg.length&&(tg[m]==='NOUN'||tg[m]==='PROPN'))return true;
      if(PREP[deacc(T[m].toLowerCase())])return false;}
    return false;}
  function _verbOrHomograph(tg,T,i){if(i>=tg.length)return false;if(tg[i]==='VERB'||tg[i]==='AUX')return true;
    var d=deacc(T[i].toLowerCase());if(_INVAR_COLOR[d])return false;   // couleur/matière invariable (« des gants crème », « bleu marine ») → jamais un verbe
    if(GENDER_MAP[d]||ADJP[d]||_EPICENE_ADJ[d]||PREP[d])return false;   // adj épicène homographe (« conforme »/« calme ») = « qui est-ce qui ? » → l'adjectif, pas le verbe
    if(i>0&&(NUM_DET[T[i-1].toLowerCase()]||PREP[deacc(T[i-1].toLowerCase())]))return false;return svReads(T[i]).length>0;}
  function rPostpose(T,i){var lw=T[i].toLowerCase();if(lw.indexOf("'")>=0||lw==='à')return null;   // accord SUJET-VERBE à sujet POSTPOSÉ (inversion) : ordre changé → scan AVANT. FP=0 mesuré. Miroir Python rule_accord_postpose.
    if(/(é|és|ée|ées)$/.test(lw))return null;
    if(i>0&&NUM_DET[T[i-1].toLowerCase()]!==undefined)return null;
    if(i>0&&PREP[deacc(T[i-1].toLowerCase())])return null;
    if(i>0&&deacc(T[i-1].toLowerCase())==='ci')return null;   // « ci-joint/ci-inclus/ci-annexé » = adverbial INVARIABLE, pas un verbe postposé
    if(deacc(T[i].toLowerCase())==='compte'&&i>0&&/^(tient|tiens|tenons|tenez|tiennent|tenu|tenais|tenait|tenaient|tenir|rend|rends|rendons|rendez|rendent|rendu|rendait|rendaient|rendre|prend|prends|prennent|prenons|prenez|pris|prendre)$/.test(deacc(T[i-1].toLowerCase())))return null;   // locution « tenir/rendre/prendre compte » : compte = NOM
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
      if(_ELIDED_PRON.test(T[k].toLowerCase()))return null;   // pronom sujet ÉLIDÉ (« alors QU'IL reste 35 minutes ») : sujet avant → pas une inversion (FP dys réel 2026-08-22, miroir Python)
      if(dk==='et'||dk==='ou'||dk==='ni')return null;
      if((dk==='l'||T[k].toLowerCase().slice(0,2)==="l'")&&(k===lo||!PREP[deacc(T[k-1].toLowerCase())]))return null;}
    var lem0=p3[0][0],ss=_SEG?_SEG.ss:null;
    if(!(lo===0||(ss&&lo<ss.length&&ss[lo])))return null;
    if(i===lo){if(!_UNACC[deacc(lem0)])return null;}
    else{var head=deacc(T[lo].toLowerCase());/* ⭐ « là » (adverbe) ≠ « la » (déterminant) — deacc les CONFOND, comme « à »/« a » gardé plus haut.
        Sans ceci « La foule attendait l'arrivée des coureurs. » ouvrait une inversion et imposait
        « attendaient » en AUTO : du texte JUSTE réécrit en faute, en silence. L'adverbe exige sa forme
        ÉCRITE accentuée ; tg[lo]==='ADV' reste juste à côté pour les vrais adverbes. */
        var _advOK=_INV_ADV[head]&&!(head==='la'&&T[lo].toLowerCase()!=='là');
        if(!(PREP[head]||_INV_WH[head]||_INV_WH[T[lo].toLowerCase()]||_advOK||(lo<tg.length&&tg[lo]==='ADV')||head==='comme'||head==='quand'||head==='lorsque'))return null;}
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
    var reads=svReads(T[i]),p3=[],k;for(k=0;k<reads.length;k++)if(reads[k][2]==='3')p3.push(reads[k]);
    // ⭐ GARDE p3 ASSOUPLIE, EN LISTE FERMÉE (31/08, miroir Python) : es/as/vas = exclusivement 2e pers.
    // sing., lemme univoque — derrière un sujet nominal c'est un verbe mal accordé (« Marie es gentille »).
    // ⛔ La relaxation GÉNÉRALE « toutes lectures 1re/2e » a été MESURÉE-FALSIFIÉE (~9 FP réels/UD 14450 :
    // « conditions REMPLIES »→remplient, « moines CÉLÈBRES »→célèbrent…) ; les -ais sont déjà couverts
    // par rAisAit. Créneau verbal libre en ceinture ; participe suivant exempté (« étais PARTI »).
    var _p12=!p3.length&&['es','as','vas'].indexOf(deacc(T[i].toLowerCase()))>=0&&_clauseNoFiniteVerb(T,i,(i+1<T.length&&_isPpl(T[i+1]))?i+1:undefined);
    if(!p3.length&&!_p12)return null;
    if((i>=1&&FULL_AUX[deacc(T[i-1].toLowerCase())])||(i>=2&&FULL_AUX[deacc(T[i-2].toLowerCase())]))return null;   // temps composé/passif
    var tg=posTags(T);if(!tg||!_verbOrHomograph(tg,T,i))return null;   // T[i]=verbe en contexte ; filet homographe PARTAGÉ (verbe raté par l'émission HMM), borné par les gardes structure ci-dessous
    var _vs=i;while(_vs-1>=0&&CLITIC[deacc(T[_vs-1].toLowerCase())])_vs--;var subj=_npSubject(T,tg,_vs);if(!subj)return null;var nb=subj.n,hk=subj.idx,dk=subj.det;   // sauter les clitiques objets avant le verbe (« nous parviendra ») pour atteindre le sujet
    var ddet=deacc(subj.dtxt.toLowerCase());
    if(nb==='s'){var _hn=deacc(T[hk].toLowerCase());if(/[sx]$/.test(_hn)&&!_INVAR_S[_hn]&&_wordKnown(/aux$/.test(_hn)?_hn.slice(0,-3)+'al':_hn.slice(0,-1)))return null;}   // « LE pilotes sont » : déterminant singulier + nom à forme plurielle → déterminant suspect → abstention (miroir Python)
    else if(nb==='p'){var _hp=deacc(T[hk].toLowerCase());if(!/[sx]$/.test(_hp)&&!rNounPlural(T,hk))return null;}   // SYMÉTRIQUE (trouvé par le générateur de fautes) : déterminant PLURIEL contredit par un nom SINGULIER (« Les signe … EST », « les couple A »). Discriminant = la règle du nom sait-elle réparer ? Si oui (« les enfant JOUE » → enfants) le pluriel est confirmé et on continue ; sinon la contradiction reste ouverte → abstention. Miroir Python rule_accord_sv_noun
    if(subj.dtxt!==''&&!NUM_DET[ddet]&&!_QUANT_PL[ddet]&&!_QUANT_SG[ddet])return null;         // déterminant sujet DOIT être connu (au/aux/du de PP, mistag → abstention). Raccourci PRÉNOM (dtxt vide, sans déterminant par nature) exempté (31/08, miroir Python)
    if(_COLL_HEAD[deacc(subj.htxt.toLowerCase())])return null;                     // nom collectif/quantité → accord complément → abstention
    var hc=T[hk].charAt(0);if(!subj.elid&&subj.dtxt!==''&&(tg[hk]==='PROPN'||(hk>0&&hc===hc.toUpperCase()&&hc!==hc.toLowerCase())))return null;   // nom-tête propre/titre — EXEMPTÉ : le raccourci PRÉNOM, son nombre est fiable par construction (« Marie es gentille »→est, 31/08, miroir Python)
    var lo=0,j;if(_SEG){for(j=i;j>0;j--){if(j<_SEG.bb.length&&_SEG.bb[j]){lo=j;break;}}}
    for(var m=lo;m<i;m++){var _lm=T[m].toLowerCase();if(_lm.indexOf("qu'")===0||_lm.indexOf("qu’")===0)return null;}   // RELATIVE ÉLIDÉE « qu' » → abstention (élision bénigne « de l'X »/clitique « m'/s' » tolérée ; que/qui/dont pleins gardés par CONJ_WORDS)
    if(!vig)for(m=lo;m<dk;m++){if(tg[m]!=='ADV')return null;}                   // sujet EN TÊTE de proposition (adverbes antéposés seulement) ; RETIRÉ en mode vig (orange couvre le mid-phrase)
    // ⭐ RELATIVE EN « qui » — ouverte CONTRE PREUVE (parité dictee/correcteur_probe.py).
    // « qui » est un pronom relatif SUJET : son verbe s'accorde OBLIGATOIREMENT avec l'antécédent.
    // Si ce verbe porte le MÊME NOMBRE que le nom-tête trouvé, la relative CORROBORE ce nom-tête —
    // contrainte grammaticale vérifiée sur le texte, pas heuristique de distance. Sans corroboration
    // (« la liste des villages qui COMPOSENT … est longue » : tête sg, relative pl) -> abstention.
    // MESURÉ : rappel de la famille 0 % -> 2,7 % (cas d'or UD), et signalements à l'échelle
    // INCHANGÉS (7 avant, 7 après, dont 6 sont de vraies fautes du corpus).
    var _qi=[],_qm;for(_qm=hk+1;_qm<i;_qm++)if(deacc(T[_qm].toLowerCase())==='qui')_qi.push(_qm);
    if(_qi.length===1){
      var _q=_qi[0],_ok=true,_m2;
      for(_m2=hk+1;_m2<i;_m2++){var _d2=deacc(T[_m2].toLowerCase());
        if(/[,;:()\[\]«»"]/.test(T[_m2])){_ok=false;break;}
        if(_d2==='et'||_d2==='ou'||_d2==='ni'){_ok=false;break;}
        if(_m2!==_q&&CONJ_WORDS[_d2]){_ok=false;break;}
        if(/^qu['’]/.test(T[_m2].toLowerCase())){_ok=false;break;}}
      if(_ok){
        var _vr=-1;for(_m2=_q+1;_m2<i;_m2++){ if(CLITIC[deacc(T[_m2].toLowerCase())])continue;
          if(tg&&_m2<tg.length&&(tg[_m2]==='VERB'||tg[_m2]==='AUX'))_vr=_m2; break; }
        if(_vr>=0){
          var _rr=svReads(T[_vr]).filter(function(r){return r[2]==='3';});
          if(_rr.length&&_rr.every(function(r){return r[3]===nb||r[3]==='x';})){
            if(p3.some(function(r){return r[3]===nb||r[3]==='x';}))return null;   // déjà d'accord
            var _lems={};p3.forEach(function(r){_lems[r[0]]=1;});
            var _lk=Object.keys(_lems);if(_lk.length!==1)return null;
            var _mts=p3.map(function(r){return r[1];});
            var _mt=(_mts.indexOf('ind:pre')>=0)?'ind:pre':_mts[0];
            if(_mt==='ind:pas')return null;
            var _sg=(CONJ_C[_lk[0]]&&CONJ_C[_lk[0]][_mt])?CONJ_C[_lk[0]][_mt]['3'+nb]:null;
            if(!_sg)return null;
            if(!svReads(_sg).some(function(r){return r[2]==='3'&&(r[3]===nb||r[3]==='x');}))return null;
            return _sg;
          }
        }
      }
    }
    for(m=hk+1;m<i;m++){var tk=T[m],dw=deacc(tk.toLowerCase());                // garde structure nom-tête → verbe : compléments prépositionnels SEULEMENT
      if(CONJ_WORDS[dw])return null;                                           // coordination/relative
      if(/[,;:()\[\]«»"]/.test(tk))return null;                               // ponctuation
      if(/\d/.test(tk))return null;                                           // désignation alphanumérique
      if((tg[m]==='VERB'||tg[m]==='AUX')&&!(/(é|és|ée|ées)$/.test(T[m].toLowerCase())&&!(m>0&&tg[m-1]==='AUX')))return null;   // verbe FINI intercalé = sous-phrase → abstention ; participe-épithète (non précédé d'aux) toléré (miroir _npSubject)
      if(NUM_DET[tk.toLowerCase()]&&!PREP[dw]&&!(m>0&&PREP[deacc(T[m-1].toLowerCase())]))return null;}   // 2e GN non prépositionnel
    for(k=0;k<p3.length;k++)if(p3[k][3]===nb||p3[k][3]==='x')return null;      // déjà d'accord (p3 vide en _p12 : une forme 1re/2e n'est jamais d'accord avec un sujet nominal)
    var _src=p3.length?p3:reads;                                               // _p12 : lemme/temps lus sur les lectures 1re/2e (cible 3·nb, validée ci-dessous). Miroir Python.
    var lem=null,uni=true,mts={};for(k=0;k<_src.length;k++){if(lem===null)lem=_src[k][0];else if(lem!==_src[k][0])uni=false;mts[_src[k][1]]=1;}
    if(!uni||lem===null)return null;var mt=mts['ind:pre']?'ind:pre':_src[0][1];if(mt==='ind:pas'&&!vig)return null;var slots=(CONJ_C[lem]||{})[mt];if(!slots)return null;var sugg=slots['3'+nb];if(!sugg)return null;
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
    var hk=subj.idx,dk=subj.det,ddet=deacc(subj.dtxt.toLowerCase());
    if(!NUM_DET[ddet]&&!_QUANT_SG[ddet])return null;
    if(_COLL_HEAD[deacc(subj.htxt.toLowerCase())])return null;
    var hc=T[hk].charAt(0);if(!subj.elid&&(tg[hk]==='PROPN'||(hk>0&&hc===hc.toUpperCase()&&hc!==hc.toLowerCase())))return null;
    var lo=0,j;if(_SEG){for(j=i;j>0;j--){if(j<_SEG.bb.length&&_SEG.bb[j]){lo=j;break;}}}
    for(var m=lo;m<i;m++){if(_elidKind(T[m])==='pron')return null;}
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
    var _dsf=deacc(T[i].toLowerCase());
    if(_dsf==='sais'||_dsf==='sait'){var _jsf=i+1;while(_jsf<T.length&&_jsf<=i+3&&PPMID[deacc(T[_jsf].toLowerCase())])_jsf++;
      if(_jsf<T.length&&(_isPpl(T[_jsf])||_SAIS_PPU[deacc(T[_jsf].toLowerCase())]))return null;}   // sais/sait + PARTICIPE = frame « s'est » → l'orange saisVig parle, l'accord se tait (conflit « il sait tromper » lu à la carto)

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
    else if(q==='la'&&nxt==='plupart'){qend=lo+1;var c2=(lo+2<T.length)?deacc(T[lo+2].toLowerCase()):'',c3=(lo+3<T.length)?deacc(T[lo+3].toLowerCase()):'';nb=(c2==='du'||(c2==='de'&&(c3==='la'||c3==='l')))?'s':'p';}   // « la plupart DU temps » (sing) ≠ « la plupart DES gens » (plur)
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
  var _coordSubjW={};'je tu il elle on ils elles nous vous ça ca ce c cela ceci qui que dont'.split(' ').forEach(function(w){_coordSubjW[w]=1;});
  function _vnum3(w){var rs=svReads(w),ns={},k;for(k=0;k<rs.length;k++)if(rs[k][2]==='3'&&(rs[k][1]==='ind:pre'||rs[k][1]==='ind:imp'))ns[rs[k][3]]=1;if(!ns.s&&!ns.p)return null;return (ns.p&&!ns.s)?'p':((ns.s&&!ns.p)?'s':null);}
  function rAccordVerbCoord(T,i){   // récupère le sujet via le VERBE COORDONNÉ (idée Rem : le sujet est dans le verbe frère) — miroir Python rule_accord_verb_coord, FP=0
    var w=T[i].toLowerCase();
    if(w.indexOf("'")>=0||/(é|és|ée|ées)$/.test(w))return null;
    var tg=posTags(T);if(!tg||!_verbOrHomograph(tg,T,i))return null;
    var rd=svReads(T[i]),r2=[],k;for(k=0;k<rd.length;k++)if(rd[k][2]==='3'&&(rd[k][1]==='ind:pre'||rd[k][1]==='ind:imp'))r2.push(rd[k]);
    if(!r2.length)return null;
    var vn2=_vnum3(T[i]);if(vn2===null)return null;
    if(i>0&&(NUM_DET[T[i-1].toLowerCase()]!==undefined||PREP[deacc(T[i-1].toLowerCase())]))return null;
    if((i>=1&&FULL_AUX[deacc(T[i-1].toLowerCase())])||(i>=2&&FULL_AUX[deacc(T[i-2].toLowerCase())]))return null;
    var lo=0,j;if(_SEG){for(j=i;j>0;j--){if(j<_SEG.bb.length&&_SEG.bb[j]){lo=j;break;}}}
    var ci=null;for(k=i-1;k>=lo;k--){var dk=deacc(T[k].toLowerCase());if(dk==='et'||dk==='ou'||dk==='ni'){ci=k;break;}}
    if(ci===null)return null;
    for(var m=ci+1;m<i;m++){if(NUM_DET[T[m].toLowerCase()]!==undefined||_coordSubjW[deacc(T[m].toLowerCase())])return null;if(_elidKind(T[m])==='det')return null;if(_ELIDED_PRON.test(T[m].toLowerCase()))return null;}   // PRONOM ÉLIDÉ = un NOUVEAU sujet lui aussi : « … et lorsqu'elle dort » ouvre sa propre proposition (FP mesuré 30/08/2026 sur français CORRECT : dort → dorment) — même motif que la garde 'det', jamais propagée à cette règle sœur
    var v1=null;for(k=ci-1;k>=lo;k--){
      if(!/(é|és|ée|ées)$/.test(T[k].toLowerCase())&&_verbOrHomograph(tg,T,k)&&_vnum3(T[k])!==null){v1=k;break;}
      var d=deacc(T[k].toLowerCase());if(GENDER_MAP[d]||ADJP[d])break;
    }
    if(v1===null)return null;
    var n1=_vnum3(T[v1]);if(n1===null||n1===vn2)return null;
    var mt='ind:imp';for(k=0;k<r2.length;k++)if(r2[k][1]==='ind:pre'){mt='ind:pre';break;}
    var sl=(CONJ_C[r2[0][0]]||{})[mt]||{},sug=sl['3'+n1];
    return (sug&&sug.toLowerCase()!==w)?sug:null;
  }
  var _REL_STOP={};('que qui quoi dont je tu il elle on ils elles nous vous ce ca ça cela ceci me te se le la les lui leur y en '+
    'et ou ni mais or car donc ne pas plus moins tres bien des dès lors depuis parce afin tandis alors pendant apres avant sans pour').split(' ').forEach(function(w){_REL_STOP[w]=1;});
  function _relFinBetween(T,tg,a,b){   // verbe fini embarqué dans ]a,b[ : discriminant relatif-objet (2 verbes) vs complétif (1 verbe)
    for(var k=a+1;k<b;k++){var wk=T[k].toLowerCase();if(/(é|és|ée|ées)$/.test(wk))continue;
      if(_verbOrHomograph(tg,T,k)){var rd=svReads(T[k]);for(var z=0;z<rd.length;z++){var mt=rd[z][1];if(mt==='ind:pre'||mt==='ind:imp'||mt==='ind:fut'||mt==='cnd:pre'||mt==='sub:pre')return true;}}}
    return false;
  }
  function rAccordRelObj(T,i){   // récupère le sujet via une RELATIVE-OBJET « que » (famille sujet non-adjacent, après #207) — miroir Python rule_accord_rel_obj, FP=0
    var w=T[i].toLowerCase();
    if(w.indexOf("'")>=0||/(é|és|ée|ées)$/.test(w))return null;
    var tg=posTags(T);if(!tg||!_verbOrHomograph(tg,T,i))return null;
    var rd=svReads(T[i]),r2=[],k;for(k=0;k<rd.length;k++)if(rd[k][2]==='3'&&(rd[k][1]==='ind:pre'||rd[k][1]==='ind:imp'))r2.push(rd[k]);
    if(!r2.length||_vnum3(T[i])!=='s')return null;                                         // cible = verbe 3sg (dir. audible : pluriel manquant)
    if(i>0&&(NUM_DET[T[i-1].toLowerCase()]!==undefined||PREP[deacc(T[i-1].toLowerCase())]))return null;
    if((i>=1&&FULL_AUX[deacc(T[i-1].toLowerCase())])||(i>=2&&FULL_AUX[deacc(T[i-2].toLowerCase())]))return null;   // passé composé
    var q=null;for(k=i-1;k>=0;k--){var wk=T[k].toLowerCase();
      if(wk==='que'||wk==="qu'"||wk==='qu'||wk==='dont'||wk==='où'||wk.indexOf("qu'")===0){q=k;break;}   // « où » ACCENTUÉ = relatif (≠ « ou » conjonction)
      var dk=deacc(wk);if(dk==='et'||dk==='ou'||dk==='ni'||dk==='mais'||dk==='car'||dk==='donc'||dk==='or')break;}
    if(q===null||q<2||q>=i-1)return null;
    if(_SEG&&_SEG.bb){for(var kb=q+1;kb<=i&&kb<_SEG.bb.length;kb++)if(_SEG.bb[kb])return null;}   // #B1 : ancre et verbe dans la MÊME proposition — frontière (virgule) entre les deux = dislocation → abstention
    if(!_relFinBetween(T,tg,q,i))return null;
    var ant=T[q-1].toLowerCase(),det=T[q-2].toLowerCase();
    if(!PLURAL_DET[det]||_REL_STOP[ant])return null;
    // « DES » est AMBIGU : article pluriel OU « de+les » d'un COMPLÉMENT (« la liste DES choses que… »),
    // où la TÊTE est le nom d'avant, au singulier. FP mesuré sans cette garde. Miroir Python.
    if(det==='des'&&q>=3&&tg&&(tg[q-3]==='NOUN'||tg[q-3]==='PROPN'))return null;                                       // antécédent = dét PLURIEL audible + nom réel
    var mt='ind:imp';for(k=0;k<r2.length;k++)if(r2[k][1]==='ind:pre'){mt='ind:pre';break;}
    var sl=(CONJ_C[r2[0][0]]||{})[mt]||{},sug=sl['3p'];
    return (sug&&sug.toLowerCase()!==w)?sug:null;
  }
  function rAccordIncise(T,i){   // accord SV quand une INCISE sépare le sujet du verbe (famille non-adjacent, après #210) — miroir Python rule_accord_incise, FP=0
    var w=T[i].toLowerCase();
    if(w.indexOf("'")>=0||/(é|és|ée|ées)$/.test(w))return null;
    if(!_SEG)return null;var bb=_SEG.bb,ss=_SEG.ss;
    if(i>=bb.length||!bb[i]||ss[i])return null;                                            // V juste après une virgule (frontière ≠ début de phrase)
    var tg=posTags(T);if(!tg||!_verbOrHomograph(tg,T,i))return null;
    var rd=svReads(T[i]),r2=[],k;for(k=0;k<rd.length;k++)if(rd[k][2]==='3'&&(rd[k][1]==='ind:pre'||rd[k][1]==='ind:imp'))r2.push(rd[k]);
    if(!r2.length||_vnum3(T[i])!=='s')return null;
    if(i>0&&(NUM_DET[T[i-1].toLowerCase()]!==undefined||PREP[deacc(T[i-1].toLowerCase())]))return null;
    if((i>=1&&FULL_AUX[deacc(T[i-1].toLowerCase())])||(i>=2&&FULL_AUX[deacc(T[i-2].toLowerCase())]))return null;
    var m=null;for(k=i-1;k>0;k--){if(ss[k])return null;if(bb[k]){m=k;break;}}               // virgule d'OUVERTURE de l'incise
    if(m===null||m<2||(i-m)>7)return null;
    var im=T[m].toLowerCase();                                                             // incise commence par un mot FONCTIONNEL (sinon = énumération)
    if(!(PREP[deacc(im)]||(m<tg.length&&(tg[m]==='ADP'||tg[m]==='ADV'||tg[m]==='SCONJ'))||/(é|és|ée|ées)$/.test(im)))return null;
    var lo=0;for(k=m-1;k>0;k--){if(bb[k]){lo=k;break;}}                                     // début de la proposition-sujet
    if(!PLURAL_DET[deacc(T[lo].toLowerCase())])return null;                                 // ANCRE : dét PLURIEL audible EN TÊTE
    var hasnoun=false;
    for(k=lo+1;k<m;k++){
      if((k<tg.length&&(tg[k]==='NOUN'||tg[k]==='PROPN'))||GENDER_PURE[deacc(T[k].toLowerCase())])hasnoun=true;
      if(k<tg.length&&(tg[k]==='VERB'||tg[k]==='AUX'))return null;                          // verbe fini avant l'incise → GN = objet → abstention
    }
    if(!hasnoun)return null;
    var mt='ind:imp';for(k=0;k<r2.length;k++)if(r2[k][1]==='ind:pre'){mt='ind:pre';break;}
    var sl=(CONJ_C[r2[0][0]]||{})[mt]||{},sug=sl['3p'];
    return (sug&&sug.toLowerCase()!==w)?sug:null;
  }
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
  function _isInfinitive(w){var d=deacc(w.toLowerCase());return !!COMMON_VERBS[d]&&(/er$/.test(d)||/ir$/.test(d)||/re$/.test(d)||/oir$/.test(d))&&svReads(w).length===0;}   // vrai infinitif = AUCUNE lecture finie (« nombre »/« offre » = formes conjuguées en -re → pas des infinitifs)
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
  var _EPICENE_NOUN={};('absentes absinthe absinthes accessoiriste accessoiristes accro accros accusateur acolyte acrobate acrobates actionnaire actionnaires activiste activistes adepte admirateur admirateurs ado ados adulte adultere adulteres adultes adversaire adversaires agent aide aigle albinos alcoolique alcooliques alcoolo alcoolos alpiniste amour amours analyste anarchiste anarchistes anesthesiste anesthesistes anonyme anthropologue anthropologues antiquaire antiquaires appli applis arbitre arbitres archeologue archeologues architecte architectes ardoise aria aristocrate aristocrates artiste artistes astronaute astronautes athee athees athlete athletes aube aubergiste aubergistes aubes aurore auteur autochtone autochtones automatique automatiques automne automobiliste automobilistes auxiliaire auxiliaires aventurier aveugle baba babas babine banane banque barbare barbares barbe barbes barjo barjos barjot barjots basket baskets basque bassiste bassistes baston baume baumes bavard beige beiges beigne beneficiaire beneficiaires benevole benevoles beta bi bibliothecaire bibliothecaires bicoque bicoques bienvenu biologiste biologistes black blacks blond blonds bobo boche boches boheme boire boires bolchevik bolcheviks bonhomme bordure borgne bossu botaniste botanistes boucle boucles bouddhiste bouffe bouffes boule boules boum bourge bourges bourre bourres boutique boutiques brave bretzel bretzels brutes bulle bureaucrate bureaucrates buveur cab cache caches camarade camee camionneur caniche cannelle capitaine capitaliste carpe carpes cartouche cartouches casier casiers casse casses catho catholique catholiques cathos catin catins cave celibataire centenaire cerise champagne charmeur chauffard chauve cheerleader cheerleaders chef chevre chevres chimiste chimistes chine choregraphe choregraphes choriste choristes chose choses chronique chroniques chum chums cineaste cineastes cinquieme cinquiemes claque classique clone clope coach coca cocas coche coke cokes collabo collabos collegue collegues colo coloc colocataire colocataires colocs colos com combi comique comiques commissaire commissaires commodore communiste communistes compatriote complice complices comptable comptables concepteur concessionnaire concessionnaires concierge condisciple contribuable contribuables convive convives copilote copilotes coquille cosmetique cosmonaute cosmonautes costumier coupable coupables couple couples cours couturiere createur creme crepe crepes critique critiques cycliste cyclistes cynique cyniques dactylo dactylos dealer debile debiles debriefings democrate democrates dentiste dentistes der dermatologue dermatologues dernier destinataire destinataires detective deuxieme deuxiemes diabetique diabetiques dingo dingue dingues diplomate diplomates disco discos divisionnaire divisionnaires dixieme dixiemes doberman doc docs docteur dodo domestique domestiques doudou doudous drole droles echangiste echangistes ecolo ecologiste ecologistes ecrivain egocentrique egocentriques egoiste elastique elastiques eleve eleves elfe enfant enseigne enseignes entrepreneur enzyme enzymes ermite esclave esclaves escroc espace espaces eveque ex excentrique exhibitionniste exhibitionnistes exorciste exorcistes expert exterminateur externe externes extra extraterrestre extraterrestres extremiste extremistes faible faibles fan fanatique fanatiques fans fasciste fascistes fat faune faunes faussaire faux feministe feministes fidele fideles filleul filleuls filou filous fin finale finales finaliste finalistes fins flasque fleche fleches flemmard fleuriste fleuristes foi fonctionnaire fonctionnaires forcene fossette fossettes fou foudre foudres fourbe freelance freelances fugitif fusilier gaffe gaffes gaillard gang gangs garde gardes gauche geek geeks gens geologue geologues geometre geometres gerant geste gestionnaire gestionnaires gite glace glaces gone gosse gourmand gouverneur graphique graves greffe greviste grevistes grossiste grossistes groupie guide guides guitariste gymnaste gymnastes gyneco gynecologue gynecologues gynecos hacker hadji heretique heretiques hetero heteros hippie hippies holding holdings homicide homologue hote huitieme huitiemes humanitaire humoriste humoristes hybride hymne hymnes hypocrite hypocrites hysterique iceberg idealiste idealistes iles imbecile imbeciles incendiaire incendiaires inceste indic indigene indigenes infidele infideles infirme ingenieur insolent instit instits intello inter interface interfaces interimaire interimaires intermediaire intermediaires interne interprete interpretes inutile invalide invalides ivrogne jacques jade jaguar jarre jarres jeune job jobs jonquille jonquilles journaliste journalistes juge junior juniors juste jute kamikaze kine kines lache laches laque laques legume libraire libraires lights limes liquide litre livre livres lobbyiste lobbyistes locataire locataires louche louches lune lunes magistrat magneto magnetos magnum maire maires malade mambo manche manches mangue maniaque maniaques manucure marine marines mariole marioles marionnettiste marionnettistes marque martyre martyres masque mateur mateurs matricule matte mecene medecin memoire memoires mercenaire mercenaires merci mercis meteorite meteorites meteorologue meteorologues meteque meteques micro militaire militaires millionnaire millionnaires mime mimes minable minables minettes ministre ministres mire miserable miserables missionnaire missionnaires mode modele mome momes mort moule moules mousse mystique mystiques nationaliste nationalistes naze negro neurologue neurologues neuvieme neuviemes noble nobles nomade nomades notable notables notaire nounou nounous novice novices nudiste nudistes obese obeses officier ombre ombres oncologue oncologues opportuniste opportunistes optimiste optimistes orange orbe orbes ordinaire orque orques otage otages pacifiste pacifistes page pages paillasse paillasses pamplemousse para parachutiste parachutistes parallele parano paranoiaque paranoiaques paranos paras paria parias part partenaire partenaires parties party passe passes pasteur pathologiste pathologistes patriote patriotes pauvre paysagiste paysagistes pediatre pedicure pedophile peintre peintres pendule pendules pensionnaire pensionnaires people perceur periode periodes philanthrope philanthropes philo philos philosophe philosophes photographe photographes physique physiques pianiste pianistes pickpocket pipe pipes pique piques pirate pirates pire plastique platine plume plumes poele polar politique politiques polygraphe polygraphes pompe pompes pompiste pompistes ponte poste postes pote potes pouf pouffiasse pousse pratique pratiques pretexte prime primes privilegie pro proc proche proches procs procureur prof profane professeur profs proprietaire proprietaires proprio pros protagoniste proxenete psy psychanalyste psychanalystes psychiatre psychologue psychopathe psychotique psys pub publicitaire publicitaires pubs pupille pupilles pyromane pyromanes quadrille quadrilles quatrieme quatriemes raciste racistes rade rades radio rapace rapaces rasta rastas realiste rebelle receptionniste recidiviste recidivistes reclame relache remise remises renne rennes responsable responsables retardataire retardataires revolutionnaire revolutionnaires rhino riche ridicule ripoux robot rocker romantique romantiques rose roses russe rustre sadique sadiques sage salamandre salamandres salope salopes samba sangle sangles sarcophage sarcophages sauce sauna saunas scenariste scenaristes sceptique schizophrene schizophrenes schnock schnocks schtroumpf schtroumpfs scientifique scientifiques scientologue scientologues script sculpteur secouriste secouristes secretaire secretaires semblable senior seniors separatiste septieme septiemes silicone simples sitcom sitcoms sixieme sixiemes skinhead skipper snob snobs socialiste socialistes solde soldes soliste solistes solitaire somme sommes somnambule somnambules soprano sopranos souillon souillons source sources spartiate spartiates spatule specialiste specialistes stagiaire stagiaires standardiste standardistes stations styliste stylistes subalterne subalternes sudiste sudistes suicidaire suicidaires suspense suspenses taf tank tapas tartare tartares tata tatas telegraphe telepathe telepathes tempo tendre teneurs terroriste terroristes therapeute tire titulaire titulaires tome tomes tortionnaire tortionnaires toubib tour touriste touristes tours toxicomane toxicomanes trader traders trampoline tripode troisieme troisiemes trompette trompettes trouble trouduc typhoide typhoides ultra ultras universitaire urgentiste urgentistes vague vampire vampires van vanne vannes vans vapeur vase vases ventriloque ventriloques vestiaire veterinaire veterinaires veto video videos vigile vigiles violoniste violonistes virtuose virtuoses visionnaire visionnaires vivre voile voiles volontaire zombie zombies zoom').split(' ').forEach(function(w){_EPICENE_NOUN[w]=1;});   // noms épicènes (la médecin/la juge) — miroir Python, dérivé build_epicene_noun.py
  /* GENRE PERDU PAR LA DÉSACCENTUATION — miroir EXACT de correcteur_probe.GENDER_ACC_COLL.
     GENDER_PURE est DÉSACCENTUÉE : elle perd tout nom dont la clé nue est partagée avec un
     masculin — « âme » (amé), « affaire » (affairé), « lettre » (lettré) en sont ABSENTS alors
     qu'ils n'ont rien d'ambigu (mesuré : 8 manquants sur 52 noms très courants, 3 par cette cause).
     ⚠️ SOUS-ENSEMBLE « COLLISION » SEULEMENT. La table accentuée BRUTE contient aussi des adjectifs
     antéposés lus comme noms (futur, grand, premier, nouveau) que la curation avait écartés EXPRÈS ;
     les rétablir coûtait 3 FP immédiats sur le scan UD (« une futur maman »→un, « la troisième
     division »→le, « sur le papier »→la). Ce qui sépare un gain d'un dégât n'est pas le mot, c'est
     la CAUSE de son absence : clé PARTAGÉE = on répare une perte ; curation = on ne la défait pas.
     713 entrées, rappel 0→217 mesuré, faux positifs INCHANGÉS (banc dictee/gender_coll_probe.py). */
  var _GCOLL={};
  ('acotylédone acquéreresse acquéréresse aetite affaire aie aiguité aiguïté aile ailes aine aines ainée ainées aié ajoute ajoutes amnistie amnisties ampoule analyse analyses angoisse angoisses ansérine arenaria arénaria arêtes attache attaches azalea azaléa aétite aîle aîles aînée aînées baillée baraque beethovenienne beethovénienne belière benoite benoîte blinde blindes blépharoptose blépharoptôse boette boiteuse botte bottes boète boëte boëtte boîteuse bride broche broches brulée brûlée burèle bâillée bélière béroé cablée caille caline came cames carre carres chainetière chaineuse chainière chale charge chargeure chargeüre chasse chasses chaînetière chaîneuse chaînière cheilalgie cheiline cheilite cheilophagie chordes châsse châsses chéilalgie chéiline chéilite chéilophagie cicerole cicérole cire cires cliche cliches coacquéreresse coacquéréresse cochaine cochaîne combine combines commandite confœderation confœderations confœdération confœdérations corepraxie corépraxie cote cotes cotière couche coule coules coupe coupes crotte crottes crottés crènelure crénelure cubanite cubanité cuirasse cuirasses cure cures câblée câline côte côtes côtière demeure demeures deva devanagari devanâgari donnes doyenne dracéna drogue drogues drolichonne drèche drêche drôlichonne débauche débauches défroque défroques dégoutante dégoutantes dégoûtante dégoûtantes déprime déprimes dérive dérives dévanagari dîme egyptienne egyptiennes enchainée enchaînée engrelure engrêlure enveloppe enveloppes envoutée envoûtée equatorienne ethiopienne ethiopiennes euménide faines faitière faitières faîtière faîtières fenière fibrille file files forte fortuite fortuité fortune forêt forêts fosse fosses fourre fourres foène foènes foéneuse foêne foëne foënes foëneuse franchise franchises frappe frenette frénette fénière fêle gailleterie gaillèterie gaités gaze gazes gaîtés gemara georgienne gitologie glycère gobeleterie gobelèterie gouvernes grenetière grippe grippes grènetière grèserie gréserie gémara générale générales géorgienne gêne gênerale gênerales gênes gîtologie gödelisation gödélisation habenula habénula halette herpes hespéride hâlette hétérogenèse hétérogénèse indiscipline infortune infortunes insulte insultes invite invites israélienne israéliennes israëlienne israëliennes je jeuneuse jeûneuse koweitienne koweïtienne lactogenèse lactogénèse laisse laisses lame legionella lettre lettres levuride lienterie lientérie lisse lisses lone loupe loupes ltee ltée lève légionella lévuride lône maitresse maitresses maitrise maitrises malaguena malagueña mangeure mangeures mangeüre mangeüres manière manières maniére maniéres maraichine maraîchine marche marches marie marketeuse markéteuse masse masses mastoptose mastoptôse maîtresse maîtresses maîtrise maîtrises medias mehalla miche miches mifépristone moere moire moise moère moëre mure murisserie mère médaille médailles méhalla mélanogenèse mélanogénèse mémé mémés métagenèse métagénèse mûre mûrisserie nacre nègrerie négrerie néphroptose néphroptôse névrose névroses offense offenses oligocranie oligocrânie onychoptose onychoptôse opanke opanké orchidoptose orchidoptôse ore paragoge paragogé parente parentes parenté parentés parisianite parisianité paume paumes pedante pedantes pelletisation pellétisation phrase phrases phrénoptose phrénoptôse planque plies poire pole polycopie polycopies polygenèse polygenèses polygénèse pouille pouilles praline pralines presse presses pretintaille prieure proctoptose proctoptôse préretraites préteuse prétintaille prêteuse psorenterie psorentérie ptose ptôse puinée puînée pâte pâtes pèquenotte pète pédante pédantes péone péquenotte pêche pêches quiche quinte rapeuse rate rateleuse rates reaganienne recepée reclinaison recluserie recépée redowa rejudaïsation relève relèves renette reparure resultante retourne retournes retraite retraites robinetière robinétière roue ruche ruse ruses râpe râpes râpeuse râteleuse réaganienne réales réclinaison récluserie rédowa réforme réformes réjudaïsation rémiz rénette réparure résine résultante révolte révoltes saute sautes schizonoia schizonoïa seephirot seephiroth sefirot sefiroth seghia seguia seguidilla semidine senestre sephirot sephiroth serge sonde sondes soul soularde soulonne sourat soûlarde soûlonne soûrat soûtras surette syncheilie synchéilie syngenèse syngénèse séephirot séephiroth séfirot séfiroth séghia séguia séguidilla sémidine sénestre séphirot séphiroth sûrette sûtra tare tares tarsoptose tarsoptôse tatillonnerie tectogenèse tectogénèse thailandaise thaïlandaise thrombogenèse thrombogénèse thébaine thébaïne tiare tierce tierces trace traces trainée traite traites traitresse transgenèse transgénèse traînée traîtresse tâtillonnerie tèterelle téterelle vade vancouveroise vancouveroises vancouvéroise vancouvéroises vedika velelle vertèbre vertèbres voceratrice vocératrice voute voutes voûte voûtes vue vuë védika vélelle vénus vüe willemite willémite wurtzite würtzite zee âme écrouteuse écroûteuse égyptienne égyptiennes élastéidose élastéïdose électrogenèse électrogénèse émanche épaule équatorienne érycine éthiopienne éthiopiennes étoile').split(' ').forEach(function(w){_GCOLL[w]='f';});
  ('abelia abélia acaride acaridé accelerando accélérando aceratherium acotylédoné acéphale acéphalé acérathérium acétabule affairé affait affaît affutoir affûtoir agamide agamidé agariciné agaricé age ages agonothète agônothète ainé ainés aitres ajouté ajoutés albuginé allegretto allégretto amnistié amnistiés ampoulé amé analysé analysés ancylotherium ancylothérium angoissé angoissés anoplotherium anoplothérium ansériné antebois antébois aoul aoutage aouteron aoutien aouts aoûl aoûtage aoûteron aoûtien aoûts aretes arrière arrières arriéré arriérés atabeg atman attaché attachés atâbeg avenage avénage aîné aînés aîtres baraqué batard batards beat beethovenien beethovénien behavioriste bembécide bembécidé besoar beurre beurres beurré beurrés bledard blindé blindés blédard boitage boiton botté bottés bouge bougé boutefas boutéfas boîtage boîton bretailleur bridé broché brochés brulement bruloir brulon brulé brulés brélage brétailleur brêlage brûlement brûloir brûlon brûlé brûlés bucrane bucrâne burelé bâtard bâtards béat béhavioriste béroe bésoar ca cabecilla cablé cablés cabécilla caillé calin calins camé camés capre carabe carabé carré carrés cedrela centesimo centésimo cereus ces chainage chainetier chaineur chainier chamæleon chamæleons chamæléon chamæléons chargé chassé chassés chaînage chaînetier chaîneur chaînier cheiroptère chermes chermès cheroub cherub chordé chordés choriambe chorïambe châle chéiroptère chéroub chérub cinescope cingle cinglé cinéscope ciré cirés cliché clichés cloitre cloitres cloître cloîtres coi coindivisaire cointéressé combiné combinés commandité copartage copartagé corynebacterium corynébactérium costume costumé coticé cotier couché coulé coulés coupé coupés coï coïndivisaire coïntéressé crambe crambé craniotabès crollé crolé crotté cryptomeria cryptoméria cuirassé cuirassés curé curés cystidé câble câbles câlin câlins câpre cèdrela céréus cés côtier côté côtés cœmetiere cœmetieres cœmetière cœmetières deleatur demeuré demeurés demodex dep devoirant dime diplôme diplômes diplômé diplômés divorce divorces divorcé divorcés diène diéne dong donnés double doubles doublé doublés doyenné dracena drogué drogués drolichon drôlichon débauché débauchés défroqué défroqués dégoutants dégoûtants dégrenage dégrénage déléatur démodex dép déprimé déprimés dérivé dérivés désagrègement désagrégement déséquilibre déséquilibres déséquilibré déséquilibrés déva dévoirant dông ebe echeveria echovirus efendi egyptien egyptiens elaeis eleis elzevier elzévier encroutement encroûtement enfaiteau enfaitement enfaîteau enfaîtement enfutage enfûtage enterobacter entérobacter entête entêté enveloppé enveloppés epyornis equatorien equatoriens equisetum ethiopien ethiopiens euménidé euryapside euryapsidé exequatur exéquatur faite faitier faînes faîte faîtier femelot fenian fibrillé filé filés flagelle flagelles flagellé flagellés foret forets fortuné forté fossé fossés fourré fourrés foéneur foëneur franchisé franchisés frappé fute futes futier futé futés fémelot fénian fêlé fûtier galeriste galériste gazé gazés genipa gitage glycéré gnathobdellides gnathobdellidés gouteron goutéron gouvernés grade grades gradé gradés greffes greffés grenetier grippé grippés grènetier guatemaltèque guatémaltèque gène gènes génipa général généraux géomarketing géomarkéting gêneral gêneraux gîtage haloir hedysarum herpès hespéridé hyposcenium hyposcénium hâloir hédysarum iberus ibérus ichneumonides ichneumonidés ilien ilotage impensé impérial incendies incendiés indiscipliné infortuné infortunés insulté insultés interocepteur intime intimé intérocepteur invité invités israélien israéliens israëlien israëliens jaleo jaléo juges jugés jé kalanchoe kalanchoé karateka karatéka kenyan kharidjite khâridjite koweitien koweïtien kényan labié laissé laissés lamé legato leonurus lepas lepidosiren lettré lettrés levé liserage lissé lissés lisérage loupé loupés lumpenproletariat lumpenprolétariat légato léonurus lépas lépidosiren léporide léporidé macronucleus macronucléus maerl maitre maitres malikisme malot maraichin maraîchin marbre marbré marché marchés marié marketeur markéteur massé massés mat mats maërl maître maîtres melaena melæna menin mere meuble meubles meublé meublés miché michés mifepristone minoen minoën moderato modérato moiré molle mollé momignard monilethrix moniléthrix moïse mulleroblastome mulléroblastome murissage muron mycobacterium mycobactérium mâcre mâlikisme mâlot mât mâts mème mèmes médaillé médaillés médias mélaena mélæna ménin métacone métacône mômignard mûrissage mûron nacré naufrage naufrages naufragé naufragés negundo nelombo nelumbo nemalion netsuke netsuké nife nifé nirvanien nirvanisme nirvânien nirvânisme nocebo nocébo numerus numérus négundo nélombo nélumbo némalion névrosé névrosés offensé offensés onguicule onguiculé ophiuride ophiuridé ophiuridés paleoniscus paléoniscus pampero pampéro panache panaché paneliste panéliste paquis paseo passeriforme passériforme paséo paumé paumés pedestrian pedestrianisme pedum peigne peigné pelagos penard persea perséa pete phlebovirus phlébovirus phrasé phrasés pie pié planqué pliés poiré polycopié polycopiés polygénèses pomerium pomérium pouillé pouillés pracrit prakrit praliné pralinés pressé pressés prieuré pronuclei pronucleus pronucléi pronucléus protonema protonéma protéide protéidé prâcrit prâkrit préretraités préteur préteurs prêteur prêteurs pterygotus ptérygotus puiné pulque pulqué puntillero puntilléro puîné pyroceram pyrocéram pâquis pâté pâtés pèperin péché péchés pédestrian pédestrianisme pédum pélagos pénard péperin pôle qat quadruple quadruplé quechua quiché quindecemvir quindécemvir quinqueporte quinquéporte quinté quéchua qât rapeur raphidé rassérènement rassérénement raté ratés reaganien reales rechampi rechampis rechampissage reclusoir recru recrû relevé relevés remboitement remboîtement rempiètement rempiétement renfaitage renfaîtage requisit reticulatum retourné retournés retraité retraités reversoir revoir rhade rhadé rhynchobdellides rhynchobdellidés ricercare ricercaré robinetier robinétier rongeure rongeüre roule roulé roué ruché rusé rusés râpeur râpé râpés règlementarisme réaganien réchampi réchampis réchampissage réclusoir réformé réformés réglementarisme réquisit résiné réticulatum réversoir révolté révoltés rêvoir sable sablé sacre sacres sacré sacrés salvé sauté sautés scorpionide scorpionidé secam secréteur segard senestrochère serapeum serapéum sergé seringuero setier sextuple sextuplé sinistre sinistres sinistré sinistrés sondé sondés souffle souffles soufflé soufflés souimanga soulard soussigne soussigné soutras souïmanga soûl soûlard soûtra special sphingides sphingidés spécial stomodeum stomodéum stoupa stoûpa sucre sucres sucré sucrés suicide suicides suicidé suicidés surmoule surmoulé sutra syrphides syrphidés sécam sécréteur ségard sénestrochère sérapeum sérapéum séringuéro sétier tabanides tabanidés taconeos taconéos taré tarés tatillon tatillonnage tatillonnement tchetchène tchétchène tefilin teocali teocalli tephilin teraphim theobroma thète théatralisme théobroma théâtralisme thête tiaré tiercé tiercés timbre timbré tokelau tokélau tracé tracés traitres traité traités traîtres tremble tremblé tremens triple triples triplé triplés trécheur trémens trêcheur tâtillonnage tâtillonnement téfilin téocali téocalli téphilin téraphim vadé vancouverois vancouvérois vedanta velarium venus vertébré vertébrés viet vinifera viniféra vipereau vipéreau viêt vocero vocéro volkameria volkaméria voutain voûtain vélarium vêdanta ximenia ximénia zar zebi zelanti zina zindiq zindîq zinâ zygopteris zygoptéris zâr zèle zébi zée zélanti zélé âge âges âtman ça èbe échevéria échinide échinidé échovirus écroutage écroutement écroûtage écroûtement éfendi égyptien égyptiens élaeis éléis émanché épaulé épyornis équatorien équatoriens équisetum éryciné éthiopien éthiopiens étoilé évènementiel événementiel îlien îlotage öre œnothera œnothéra').split(' ').forEach(function(w){_GCOLL[w]='m';});
  function rDetGenre(T,i){var lw=deacc(T[i].toLowerCase());if(!DET_G[lw]||T[i].toLowerCase().indexOf("'")>=0)return null;if(i+1>=T.length)return null;
    if(_POSS_DET[lw]&&_ART_BLOCK[cprev(T,i)])return null;   // possessif précédé d'un article = NOM homographe (« un son », « le ton », « du son ») → jamais possessif → abstention (FP WiCoPaCo « un son stéréo »→sa)
    var gd=DET_G[lw],nr=T[i+1].toLowerCase();if(nr.indexOf("'")>=0)return null;var nd=deacc(nr);if(nd.length<2||!/^[a-z]+$/.test(nd))return null;
    if((lw==='son'||lw==='mon'||lw==='ton')&&/^[aeiouyh]/.test(nd))return null;   // son/mon/ton OBLIGATOIRES devant voyelle/h (son amie, son Histoire) — pas un FP
    var c0=T[i+1].charAt(0);if(c0!==c0.toLowerCase())return null;var hi=i+1;   // nom propre/étranger capitalisé → abstention (FP) ; hi = indice du NOM-TÊTE (défaut = mot suivant)
    var _pp=NOUN_POST&&NOUN_POST.get(nd);if((lw==='quel'||lw==='quelle')&&!(_pp&&_pp[0]>=PL_TAU_M)){var tgq=posTags(T);if(tgq&&i+2<T.length&&i+1<tgq.length&&tgq[i+1]==='ADJ'&&T[i+2].toLowerCase().indexOf("'")<0&&T[i+2].charAt(0)===T[i+2].charAt(0).toLowerCase()){hi=i+2;_pp=NOUN_POST&&NOUN_POST.get(deacc(T[hi].toLowerCase()));}}if(hi===i+1&&DET_SKIP[nd])return null;var _tgd=posTags(T);if(_tgd&&hi<_tgd.length&&_tgd[hi]==='ADJ'&&((hi+1<_tgd.length&&_tgd[hi+1]==='NOUN')||(hi+2<_tgd.length&&_tgd[hi+2]==='NOUN')))return null;if(!(_pp&&_pp[0]>=PL_TAU_M))return null;   // « quel/quelle + ADJECTIF antéposé + nom » : saut d'un adjectif sûr → nom-tête. GARDE §3 genre RELAXÉE : NOM confiant (P(NOM)≥τ) ; garde verbe levée (sans toucher _nounGate, partagé pluriel) — mot après déterminant = NOM même si verbe-homographe (recall +6 pts, FP 0,09→0,10/1000, gender_levers_ud.py)
    if(_EPICENE_NOUN[deacc(T[hi].toLowerCase())])return null;var gn=_GCOLL[T[hi].toLowerCase()]||GENDER_PURE[deacc(T[hi].toLowerCase())];if(gn!=='m'&&gn!=='f')return null;if(gn===gd)return null;var sg=DET_A[lw+'|'+gn];return sg?ckeepcase(T[i],sg):null;}
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
  // ⭐⭐⭐ CANAL TEXTE DE LA PONCTUATION (`ponct-lm.json.gz`, 182 Ko compressé).
  // POURQUOI IL EXISTE : la saisie vocale ne posait de marque QU'AUX FRONTIÈRES DE SEGMENT de
  // Google. Or Google ne coupe qu'aux pauses >= 600 ms, et les virgules françaises vivent vers
  // 350 ms (mesuré sur 47 locuteurs) : elles sont DANS les segments, là où on ne posait rien.
  // ⭐ Ce canal-ci n'a besoin d'AUCUNE ancre temporelle — il lit le texte que Google rend, tel
  // quel. C'est le seul des trois morceaux qui soit livrable dans un navigateur.
  // FORME : tables conditionnelles à REPLI (5 niveaux, du plus spécifique au plus général), la
  // même forme que `os-subj-lm`. Il rend une DISTRIBUTION {rien, virgule, point}, pas une
  // décision : c'est elle qu'on combine ensuite avec l'audio là où l'audio a le droit de parler.
  // MESURÉ : 2 411 124 entrées brutes -> 22 275 après élagage, pour une perte quasi nulle
  // (virgule F1 0,270 -> 0,269 · point 0,470 -> 0,464). La raison mérite d'être retenue : un
  // contexte dominé par « rien » ne sert à RIEN, « rien » étant déjà le défaut.
  var _PLM=null;
  function setPonctLm(o){ _PLM=(o&&o.niv&&o.niv.length)?o:null; }
  function loadPonctLm(url){return (async function(){try{var gz=await (await fetch(url)).arrayBuffer();
    var st=new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'));
    setPonctLm(JSON.parse(await new Response(st).text()));return true;}catch(e){return false;}})();}
  function ponctReady(){ return !!_PLM; }
  // Les mêmes clés que le constructeur Python — toute divergence ici rendrait le modèle muet.
  function _plmCles(mots,tg,i,depuis){
    var g=(mots[i]||'').toLowerCase(), d=(i+1<mots.length?mots[i+1]:'</s>').toLowerCase();
    var pg2=(i>0?tg[i-1]:'<s>'), pg=tg[i]||'X';
    var pd=(i+1<tg.length?tg[i+1]:'</s>'), pd2=(i+2<tg.length?tg[i+2]:'</s>');
    var loin=(depuis>=6?'L':(depuis>=3?'M':'C')), S=String.fromCharCode(31);   // MEME separateur que le constructeur Python.
    // ⚠️ Ecrit fromCharCode(31) et NON le caractere brut : un caractere de controle
    // INVISIBLE dans le source est un piege — un editeur ou un linter peut le manger,
    // et le modele deviendrait muet SANS message d'erreur (toutes les cles collisionnent).
    return [ g+S+d+S+loin,
             pg2+S+pg+S+pd+S+pd2+S+d,
             pg+S+pd+S+d,
             pg2+S+pg+S+pd+S+pd2+S+loin,
             pg+S+pd+S+loin ]; }
  // -> [p_rien, p_virgule, p_point] ; null si le modèle n'est pas chargé (dégradation douce).
  function ponctDist(mots,tg,i,depuis){
    if(!_PLM) return null;
    var cs=_plmCles(mots,tg,i,depuis),k,c,v,s;
    for(k=0;k<cs.length && k<_PLM.niv.length;k++){
      v=_PLM.niv[k][cs[k]];
      if(v){ s=v[0]+v[1]+v[2]; if(s>=(_PLM.mini||10)) return [v[0]/s,v[1]/s,v[2]/s]; } }
    c=_PLM.pri; s=c[0]+c[1]+c[2]; return s?[c[0]/s,c[1]/s,c[2]/s]:null; }

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // ⭐⭐⭐ L'ANCRE TEMPORELLE — après quel MOT tombe chaque pause, et combien elle dure.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // CE QU'ELLE DÉBLOQUE. La saisie vocale ne posait de marque qu'aux FRONTIÈRES DE SEGMENT de
  // Google. Or Google ne coupe qu'au-delà de ~600 ms, et la virgule française vit vers 350 ms
  // (mesuré deux fois indépendamment : 47 locuteurs en juillet, puis le lit joint). Les virgules
  // sont DANS les segments, là où l'on ne savait pas viser.
  //
  // ⭐ ET ELLE N'A PAS BESOIN DE L'HORLOGE DE GOOGLE — c'est le point qui débloque tout.
  // On a longtemps buté sur « deux moteurs sans horloge commune » : Google a les mots, notre
  // capture a le temps, et les `ftimes` datent l'ARRIVÉE des résultats (la latence), pas la
  // parole. Le mur était réel tant qu'on cherchait à RECALER les deux horloges. Ici on ne recale
  // rien : on aligne LA SUITE DE MOTS sur LE SIGNAL. L'horloge de Google devient sans objet.
  //
  // COMMENT, SANS AUCUN MODÈLE : on connaît les mots (Google les donne), donc leur nombre de
  // SYLLABES ; le signal donne les BLOCS DE PAROLE séparés par des pauses. On répartit alors les
  // mots sur les blocs par programmation dynamique, en minimisant l'écart entre les syllabes
  // attendues et la durée observée. Chaque frontière de bloc désigne un mot.
  //
  // ⚠️ CE N'EST PAS LE « PRORATA DE SYLLABES » MESURÉ-RÉFUTÉ (54 % de placement, 2026-08-04) :
  // celui-là répartissait les mots sur la durée TOTALE sans regarder où l'on se taisait. Ici les
  // pauses découpent d'abord, et l'alignement ne fait que remplir les blocs. Répartir ≠ aligner.
  //
  // ⚠️ SEUL, CET ALIGNEUR EST MAUVAIS, ET ON LE SAIT : 44 % de placement exact sur 90 clips lus,
  // 1/12 sur la voix de Rem. Il n'est utilisable QUE combiné au canal texte, qui le recale d'un
  // mot et REFUSE ses propositions illégales — mesuré F1 0,220 -> 0,309 (lit) et 0,333 -> 0,480
  // (voix de Rem). L'audio apporte une preuve que le texte n'a pas (quelqu'un s'est tu) ; le
  // texte apporte une légalité que l'audio ignore. Ni l'un ni l'autre ne suffit.

  // Le nombre de syllabes d'un mot français : les GROUPES DE VOYELLES ÉCRITES, moins le « e »
  // final muet. Approximation assumée — mesurée contre le comptage lexical exact (Lexique) :
  // légèrement moins bon sur la voix de Rem, légèrement meilleur sur le lit. L'écart ne justifie
  // pas d'embarquer un lexique phonétique pour cet usage-là.
  var _VOY_SYL=/[aeiouyàâäéèêëîïôöûüùœ]+/gi;
  function ponctSyll(mot){
    var m=String(mot||'').toLowerCase().replace(/^['’-]+|['’-]+$/g,'');
    if(!m) return 0;
    var n=(m.match(_VOY_SYL)||[]).length;
    if(n>1 && /e$/.test(m) && !/(ee|ie|ue|oe)$/.test(m)) n--;      // « table » = 1, pas 2
    return Math.max(1,n); }

  // Découpe la timeline en BLOCS DE PAROLE séparés par des pauses >= `minMs`.
  // ⚠️ La timeline du navigateur est ÉCHANTILLONNÉE À 30 ms sur une fenêtre de 21 ms — 9 ms sur
  // 30 ne sont jamais regardées. Vérifié que ça ne change rien : sur 93 clips, la chaîne complète
  // fait F1 0,309 sur cette grille contre 0,303 sur une enveloppe continue à 10 ms. Les pauses
  // qui nous intéressent durent >= 190 ms, soit au moins 6 échantillons.
  function ponctBlocs(tl,thr,minMs){
    if(!tl||!tl.length) return [];
    var pas=(tl.length>1?Math.max(1,tl[1].t-tl[0].t):30), kmin=Math.max(1,Math.round((minMs||190)/pas));
    var blocs=[],i=0,deb=0,n=tl.length;
    while(i<n){
      if(tl[i].r<thr){
        var j=i; while(j<n && tl[j].r<thr) j++;
        if((j-i)>=kmin){ if(i>deb) blocs.push([deb,i]); deb=j; }
        i=j;
      } else i++;
    }
    if(deb<n) blocs.push([deb,n]);
    return blocs; }

  // -> [[indice du mot après lequel la pause tombe, durée de la pause en ms, INSTANT de fin de
  //     parole avant la pause]]
  // ⭐ LE TROISIÈME CHAMP EST CE QUI REND LA QUESTION POSSIBLE À L'INTÉRIEUR D'UN SEGMENT.
  // Sans lui, l'appelant sait QU'une phrase se ferme mais pas QUAND — donc il ne peut pas mesurer
  // la montée de F0 sur les derniers instants, et la 4e forme interrogative du BDL (l'ordre
  // AFFIRMATIF, « Tu pars dans un mois ? », que seule l'intonation signale) reste invisible.
  // C'est un oubli de la première version : elle créait des fins de phrase internes qui ne
  // pouvaient être QUE des points.
  function ponctAncre(mots,tl,thr,minMs){
    if(!mots||mots.length<2||!tl||!tl.length) return [];
    var blocs=ponctBlocs(tl,thr,minMs); if(blocs.length<2) return [];
    var pas=(tl.length>1?Math.max(1,tl[1].t-tl[0].t):30);
    var syl=[],tot=0,i;
    for(i=0;i<mots.length;i++){ syl[i]=ponctSyll(mots[i]); tot+=syl[i]; }
    if(!tot) return [];
    // attendu par bloc = sa part de la DURÉE DE PAROLE, ramenée au total connu de syllabes.
    // Auto-calibré par énoncé : le rapport durée/syllabe est celui de CE locuteur, ce jour-là.
    // (Mesuré : cette remise à l'échelle fait passer le placement exact de 26 % à 44 % — un
    // détecteur peut avoir un gain systématique sans avoir un biais de forme.)
    var dur=[],sd=0;
    for(i=0;i<blocs.length;i++){ dur[i]=blocs[i][1]-blocs[i][0]; sd+=dur[i]; }
    if(!sd) return [];
    var att=[]; for(i=0;i<blocs.length;i++) att[i]=dur[i]/sd*tot;
    // programmation dynamique : couper la suite de mots en autant de groupes CONTIGUS qu'il y a
    // de blocs, en minimisant l'écart aux syllabes attendues. Un groupe peut être vide (une
    // respiration crée un bloc sans qu'aucun mot ne lui appartienne en propre).
    var n=mots.length,m=blocs.length,cum=[0],k,j,ip;
    for(i=0;i<n;i++) cum[i+1]=cum[i]+syl[i];
    var INF=Infinity,co=[],pre=[];
    for(j=0;j<=m;j++){ co[j]=[]; pre[j]=[]; for(i=0;i<=n;i++){ co[j][i]=INF; pre[j][i]=0; } }
    co[0][0]=0;
    for(j=1;j<=m;j++) for(i=0;i<=n;i++) for(ip=0;ip<=i;ip++){
      if(co[j-1][ip]===INF) continue;
      var c=co[j-1][ip]+Math.abs((cum[i]-cum[ip])-att[j-1]);
      if(c<co[j][i]){ co[j][i]=c; pre[j][i]=ip; } }
    var coupes=[]; i=n;
    for(j=m;j>0;j--){ ip=pre[j][i]; if(j>1) coupes.push(ip); i=ip; }
    coupes.reverse();
    var out=[];
    for(k=0;k<coupes.length;k++){
      var iw=coupes[k]-1;                      // dernier mot du groupe
      if(iw<0||iw>=n-1) continue;
      // ⚠️ la durée d'une pause est le TROU ENTRE DEUX BLOCS CONSÉCUTIFS, jamais la n-ième
      // entrée d'une liste de silences : les silences de début et de fin d'enregistrement ne
      // séparent aucun bloc, et les apparier par indice décale tout d'un cran (bug mesuré,
      // il faisait tomber le score à 0/12).
      if(k+1>=blocs.length) break;
      // l'INSTANT où la parole s'arrête = l'horodatage de la dernière trame du bloc. C'est ce
      // repère qui permet de lire la mélodie juste avant la pause.
      var _tf=tl[Math.max(0,Math.min(tl.length-1,blocs[k][1]-1))].t;
      out.push([iw,(blocs[k+1][0]-blocs[k][1])*pas,_tf]);
    }
    return out; }


  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // ⭐⭐⭐ LES RÈGLES DE VIRGULE — source : Allô prof (« La virgule », « Le coordonnant »).
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // POURQUOI DES RÈGLES ET PAS UN MEILLEUR MODÈLE. Audit mesuré sur les exemples de la source :
  // le moteur STATISTIQUE () en trouvait 3 sur 50 — il ne connaît AUCUNE des familles
  // décrites par la grammaire. Et son plafond n'est pas un réglage : F1 0,21 contre 0,83 pour la
  // littérature. Une couche de règles explicites est le seul levier qui tienne dans ce qu'on
  // embarque. ⇒ 3/50 -> 14/50, ET la justesse sur corpus réel MONTE (50,53 -> 52,02 %).
  //
  // MESURÉ (dictee/virgule_regles_probe.js — 11 304 phrases écrites par des humains) :
  //     modèle seul      justesse 50,53 %   rappel 10,97 %
  //     modèle + règles  justesse 52,02 %   rappel 12,80 %   ⭐ meilleur sur les DEUX axes
  //     « éléments à ne pas séparer » (sujet/prédicat, verbe/CD…) : 7/7 respectés, avant comme après.
  //
  // ⚠️ CE QUI REND CES RÈGLES LIVRABLES, CE SONT LEURS GARDES, PAS LEURS LISTES. La règle brute
  // « virgule avant le coordonnant » fait 31 % de justesse : elle pose une virgule devant chaque
  // « donc » et « aussi », qui sont d'abord des ADVERBES. Chaque garde ci-dessous a été ajoutée
  // parce qu'une mesure l'a exigée, jamais par précaution abstraite.
/* ── R1 : LES COORDONNANTS QUI PRENNENT UNE VIRGULE DEVANT ───────────────────────────────
   Liste FERMÉE, reprise mot pour mot des deux fiches. `et`, `ou`, `ni` en sont EXCLUS — la
   source est catégorique, et c'est déjà la règle `COORD` livrée pour la frontière de segment. */
var COORD_AVANT = new Set(('mais car or puis voire donc alors ainsi aussi cependant toutefois ' +
  'néanmoins pourtant ensuite enfin').split(' '));
/* Les coordonnants en PLUSIEURS mots — testés sur la suite, pas sur un seul token. */
var COORD_AVANT_LOC = [
  ["c'est-à-dire"], ['autrement', 'dit'], ['à', 'savoir'], ['par', 'contre'],
  ['par', 'conséquent'], ['en', 'conséquence'], ["c'est", 'pourquoi'], ['en', 'effet'],
  ['de', 'plus'], ['en', 'outre'], ['par', 'exemple'],
];
/* ── R2 : LES COORDONNANTS QUI PRENNENT UNE VIRGULE APRÈS, EN TÊTE DE PHRASE ────────────── */
var COORD_TETE = new Set(('ainsi alors donc ensuite enfin cependant toutefois néanmoins ' +
  'pourtant aussi').split(' '));
var COORD_TETE_LOC = [
  ['par', 'contre'], ['tout', "d'abord"], ['par', 'conséquent'], ['en', 'conséquence'],
  ['en', 'effet'], ['de', 'plus'], ['en', 'outre'], ['par', 'exemple'], ['en', 'somme'],
  ['tout', 'de', 'même'], ['en', 'revanche'], ['en', 'premier', 'lieu'],
];
/* ── R3 : L'INTERJECTION ET L'INCIDENTE EN TÊTE ──────────────────────────────────────────
   Allô prof : « On détache habituellement une interjection par une ou deux virgules » (« Zut,
   j'ai encore oublié mes clés ! ») et « Une phrase incidente ou un groupe incident » (« Selon
   moi, la présentation ne durera pas longtemps »).
   LISTES FERMÉES, et c'est ce qui les rend sûres : aucun de ces mots n'est ambigu EN TÊTE. */
var INTERJ = new Set(('zut ah oh eh hé ben bref tiens tenez écoute écoutez bravo hélas ouf ' +
  'chut mince flûte').split(' '));
var INCIDENT_LOC = [
  ['selon', 'moi'], ['selon', 'lui'], ['selon', 'elle'], ['selon', 'nous'], ['selon', 'eux'],
  ['à', 'mon', 'avis'], ['il', 'me', 'semble'], ['bien', 'sûr'], ['bien', 'entendu'],
  ['sans', 'doute'], ['à', 'vrai', 'dire'], ['en', 'réalité'], ['en', 'fait'], ['au', 'fond'],
  ['après', 'tout'], ['en', 'principe'], ['à', 'première', 'vue'], ['en', 'revanche'],
];
var INCIDENT_ADV = new Set(('heureusement malheureusement évidemment naturellement ' +
  'apparemment visiblement effectivement franchement honnêtement personnellement ' +
  'curieusement étonnamment premièrement deuxièmement troisièmement').split(' '));

/* ── R4 : LES CORRÉLATIONS ───────────────────────────────────────────────────────────────
   Allô prof : « On place une virgule avant un terme répété qui introduit une idée de
   comparaison, de choix ou de corrélation » — autant… autant, soit… soit, tantôt… tantôt,
   plus… plus, moins… moins, tel… tel. La virgule va AVANT LA SECONDE occurrence. */
var CORREL = new Set(('autant soit tantôt plus moins tel telle').split(' '));

/* ── R5 : LES COORDONNANTS RÉPÉTÉS PLUS DE DEUX FOIS ─────────────────────────────────────
   Allô prof : « On place une virgule avant les coordonnants et, ou et ni lorsqu'ils sont
   répétés PLUS DE DEUX FOIS. Remarque : on ne place AUCUNE virgule avant le premier. »
   (« Je n'aime ni la crème glacée, ni le sorbet, ni le yogourt glacé. »)
   ⚠️⚠️ RESTREINT À « NI » APRÈS MESURE, et c'est une relecture de la source, pas un recul.
   « Répétés plus de deux fois » ne veut PAS dire « apparaît trois fois dans la phrase » : ça veut
   dire RÉPÉTÉ DEVANT CHAQUE ÉLÉMENT (« ni… ni… ni »). Appliqué à `et` et `ou`, le comptage brut
   a produit exactement les faux positifs qu'on pouvait prévoir en relisant mieux — « au Nouveau
   Brunswick, et dans l'Est de l'Ontario, et dans le Nord » : trois `et` de coordination
   ordinaire, aucune insistance. Justesse mesurée 51,80 % -> 49,52 % avec les trois ; restaurée
   en gardant `ni` seul. Et les DEUX exemples de la source pour cette règle sont avec `ni`.
   (« Le gardien ouvrira et les portes et les fenêtres » est donné SANS virgule, sous
   « emplacement du coordonnant ».) */
var REPETABLE = new Set(['ni']);

/* Les CONJONCTIONS de coordination pures — jamais des adverbes, donc exemptes de la garde
   « suit un verbe ». La coupure est celle de la source, qui donne la classe de chaque mot. */
var CONJ_PURE = {};
('mais car or voire').split(' ').forEach(function (w) { CONJ_PURE[w] = 1; });
/* Conjonctions qui, PLACÉES AVANT un adverbe-coordonnant, en font une LOCUTION (« mais aussi »,
   « et ensuite ») : la frontière de proposition est alors avant la conjonction, pas après. */
var COORD_PREC = {};
('mais et ou ni car or voire').split(' ').forEach(function (w) { COORD_PREC[w] = 1; });

var VERBAL = { VERB: 1, AUX: 1 };
var pvNorm = w => String(w || '').toLowerCase().replace(/[’ʼ]/g, "'");   /* ⚠️ RENOMMÉ depuis `norm` le 2026-08-24 : l'app a DÉJÀ un `norm` — un normaliseur PHONÉTIQUE (ph→f, qu→k) dont dépend la classification d'orthographe. Ce bloc étant porté tel quel dans l'app, son `var norm` ÉCRASAIT l'autre au chargement et 134 diagnostics de dictée basculaient de « surface » à « autre ». Sorti par la garde de parité DICTÉE Python↔JS, pas par la relecture. Nom unique des deux côtés pour que le miroir app↔extension reste octet pour octet. */

/* ⚠️ `DC.toks` NE SÉPARE PAS L'ÉLISION : « qu'il » est UN token, pas « qu' » + « il ». Tester
   l'égalité avec "qu'" ne matche donc JAMAIS, et « Alors qu'il se baladait » recevait une virgule
   alors que c'est une SUBORDONNÉE. On teste le PRÉFIXE. */
var estQue = w => { var x = pvNorm(w); return x === 'que' || x.indexOf("qu'") === 0; };
function locA(mots, i, loc) {           // la locution commence-t-elle au mot i ?
  for (var k = 0; k < loc.length; k++) if (pvNorm(mots[i + k]) !== loc[k]) return false;
  return true;
}
function longueurCoord(mots, i) {       // 0 si pas un coordonnant ; sinon sa longueur en mots
  if (COORD_AVANT.has(pvNorm(mots[i]))) return 1;
  for (var l of COORD_AVANT_LOC) if (locA(mots, i, l)) return l.length;
  return 0;
}
function longueurTete(mots, i) {
  if (COORD_TETE.has(pvNorm(mots[i]))) return 1;
  for (var l of COORD_TETE_LOC) if (locA(mots, i, l)) return l.length;
  return 0;
}

/* ⛔ LA VIRGULE INTERDITE — primitive PARTAGÉE (22/08/2026).
   POURQUOI : mesurer une virgule contre un gold (UD) est invalide — la virgule française est
   souvent FACULTATIVE, et une virgule juste mais non annotée y compte comme une faute. Le juge à
   trois classes (`dictee/ponct_juge_probe.js`) sépare obligatoire / facultative / INTERDITE, et
   seules les INTERDITES sont des fautes : une virgule manquante se lit, « manger du, chocolat »
   casse la phrase.
   MESURÉ dès la première passe du juge : le chemin vocal livré filtrait bien « après déterminant/
   préposition » (liste `_PASAPRES`, dupliquée chez lui) mais PAS « devant et/ou/ni » → 9 virgules
   interdites sur 616. D'où cette primitive : UNE seule définition de l'interdit, pour la saisie
   vocale ET pour tout futur câblage dictée/correcteur.
   Conservatrice par construction : uniquement de la STRUCTURE, jamais du sens. Ce qu'on ne sait
   pas prouver interdit est déclaré FACULTATIF. */
var PONCT_PASAPRES = {};
("le la les un une des du de d au aux a en dans sur sous par pour avec sans chez vers depuis " +
 "pendant selon entre mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs ce cet " +
 "cette ces chaque aucun aucune plusieurs quel quelle quels quelles")
  .split(' ').forEach(function (w) { PONCT_PASAPRES[w] = 1; });
var PONCT_PASDEVANT = { et: 1, ou: 1, ni: 1 };   // Allô prof : pas de virgule devant « et/ou/ni »
function ponctInterdit(mots, tg, i) {
  tg = tg || [];
  if (i < 0 || i >= mots.length - 1) return 'fin de phrase';
  if (PONCT_PASAPRES[pvNorm(mots[i])]) return 'après déterminant/préposition';
  if (PONCT_PASDEVANT[pvNorm(mots[i + 1])]) {
    // ⚠️ EXCEPTION MESURÉE (garde CI proso_probe, R5 d'Allô prof) : un coordonnant RÉPÉTÉ est une
    // ÉNUMÉRATION, et elle prend la virgule — « Béatrice ne peut ni parler, NI manger, NI bouger ».
    // Interdire en bloc « devant et/ou/ni » cassait ces deux cas : la répétition fait la différence.
    var _c = pvNorm(mots[i + 1]), _n = 0;
    for (var _k = 0; _k < mots.length; _k++) if (pvNorm(mots[_k]) === _c) _n++;
    if (_n < 2) return 'devant et/ou/ni';
  }
  if (tg[i] === 'AUX' && VERBAL[tg[i + 1]] === 1) return 'entre auxiliaire et participe';
  if (tg[i] === 'PRON' && VERBAL[tg[i + 1]] === 1) return 'entre pronom sujet et verbe';
  if (tg[i] === 'DET' || tg[i] === 'ADP') return 'après déterminant/préposition (POS)';
  return null;
}

/* `deja` = les indices qui portent DÉJÀ une marque (posées par le modèle statistique et, dans la
   saisie vocale, par l'ancre audio). Les règles en ont besoin — voir le filtre final. */
function ponctReglesVirgule(mots,_tg,deja){
  var tg=_tg||posTags(mots)||[], out=new Set();
  // R2 — coordonnant EN TÊTE : virgule APRÈS.
  var nT = longueurTete(mots, 0);
  // ⚠️ « alors QUE », « ainsi QUE » sont des SUBORDONNANTS, pas des coordonnants : la fiche
  // « subordination » de Rem le dit, et la virgule y serait une faute.
  if (nT && !estQue(mots[nT]) && mots.length > nT + 2)
    out.add(nT - 1);
  // R1 — coordonnant ENTRE DEUX PHRASES : virgule AVANT.
  for (var i = 1; i < mots.length - 1; i++) {
    var n = longueurCoord(mots, i);
    if (!n) continue;
    if (estQue(mots[i + n])) continue;   // « alors que », « ainsi que » : SUBORDONNANTS
    // ⛔ GARDE 0a — « DE PLUS » N'EST UN ORGANISATEUR QUE SEUL. Suivi d'un adjectif, d'un adverbe,
    // d'un nombre ou de « de », c'est le COMPARATIF : « la direction de PLUS GRANDE diffusivité »,
    // « en présence de PLUS DE journalistes ». Mesuré 22/08 sur 40 tirs UD : 3 des 8 vraies fautes
    // des règles venaient de là. « De plus, l'appartenance… » (suivi d'un déterminant) reste juste.
    if (n === 2 && pvNorm(mots[i]) === 'de' && pvNorm(mots[i + 1]) === 'plus') {
      var _ta = tg[i + 2], _ma = pvNorm(mots[i + 2] || '');
      if (_ta === 'ADJ' || _ta === 'ADV' || _ta === 'NUM' || _ma === 'de' || _ma === "d'" || /^\d/.test(_ma)) continue;
    }
    // ⛔ GARDE 0b — UN ADVERBE-COORDONNANT PRÉCÉDÉ D'UNE CONJONCTION FORME UNE LOCUTION, pas une
    // frontière : « mais AUSSI », « et ENSUITE », « ou ALORS ». La virgule irait AVANT la
    // conjonction, jamais entre les deux — « Bubber Miley mais , aussi Bix Beiderbecke » est une
    // faute que la règle fabriquait. Mesuré : 3 des 8 vraies fautes sur 40 tirs UD.
    if (i > 0 && CONJ_PURE[pvNorm(mots[i])] !== 1 && COORD_PREC[pvNorm(mots[i - 1])] === 1) continue;
    // ⭐ LA GARDE : il faut un VERBE CONJUGUÉ AVANT et APRÈS. Sans elle, « il est aussi grand »
    // et « la pomme et la poire » recevraient une virgule. C'est ce qui sépare la COORDINATION
    // DE PHRASES (que la règle vise) d'un simple adverbe dans un groupe.
    // ⛔ GARDE 1 — LE MOT SUIT-IL IMMÉDIATEMENT UN VERBE ? Alors c'est un ADVERBE DANS la
    // proposition, pas un coordonnant entre deux phrases. Mesuré : c'est la cause de la majorité
    // des faux positifs (« Ils deviennent ALORS les Paladins », « la direction est DONC la
    // direction », « On en retrouve AUSSI un peu »).
    // ⭐ MAIS ELLE NE VAUT QUE POUR LES ADVERBES, et c'est LA SOURCE qui donne la coupure : la
    // fiche « Le coordonnant » classe les coordonnants PAR CLASSE DE MOTS — « Adverbe : ainsi,
    // alors, donc, aussi, cependant, toutefois, enfin, ensuite, en effet » d'un côté ;
    // « Conjonction de coordination : mais, car, or, c'est-à-dire, soit » de l'autre. Une
    // CONJONCTION n'est jamais un adverbe : elle SUIT légitimement un verbe. La garde appliquée
    // à `car` supprimait la virgule que la source donne elle-même en exemple (« Le chien se
    // repose, car il est épuisé » : `repose` est un verbe, donc `car` était rejeté).
    if (CONJ_PURE[pvNorm(mots[i])] !== 1 && VERBAL[tg[i - 1]] === 1) continue;
    // ⛔ GARDE 2 — UNE NOUVELLE PROPOSITION COMMENCE-T-ELLE APRÈS ? Il faut un SUJET puis un
    // VERBE dans les mots qui suivent : c'est ce qui fait la coordination DE PHRASES, seule visée
    // par la règle. « pas de faire du profit, mais d'habiter » coordonne deux infinitifs, pas
    // deux phrases — la source ne demande pas de virgule là.
    var suj = -1;
    for (var k = i + n; k < Math.min(mots.length, i + n + 4); k++)
      if (tg[k] === 'PRON' || tg[k] === 'NOUN' || tg[k] === 'PROPN' || tg[k] === 'DET') { suj = k; break; }
    if (suj < 0) continue;
    var vAp = false;
    for (var k = suj + 1; k < Math.min(mots.length, suj + 5); k++) if (VERBAL[tg[k]] === 1) { vAp = true; break; }
    var vAv = false;
    for (var k = 0; k < i; k++) if (VERBAL[tg[k]] === 1) { vAv = true; break; }
    if (vAv && vAp) out.add(i - 1);
  }

  // ── R3 : INTERJECTION / INCIDENTE EN TÊTE. Listes fermées — c'est ce qui les rend sûres :
  // aucun de ces mots n'est ambigu quand il OUVRE la phrase.
  if (INTERJ.has(pvNorm(mots[0])) && mots.length > 2) out.add(0);
  if (INCIDENT_ADV.has(pvNorm(mots[0])) && mots.length > 2) out.add(0);
  for (var l of INCIDENT_LOC)
    if (locA(mots, 0, l) && mots.length > l.length + 1) { out.add(l.length - 1); break; }

  // ── R4 : CORRÉLATIONS — la virgule va AVANT LA SECONDE occurrence, jamais avant la première.
  for (var i = 2; i < mots.length - 1; i++) {
    var w = pvNorm(mots[i]);
    if (!CORREL.has(w)) continue;
    var vu = false;
    for (var k = 0; k < i - 1; k++) if (pvNorm(mots[k]) === w) { vu = true; break; }
    // ⚠️ « plus » et « moins » sont D'ABORD des adverbes ordinaires (« plus grand », « de plus en
    // plus ») : on n'accepte la corrélation que si la première occurrence OUVRE la phrase, ce qui
    // est la forme décrite par la source (« Moins je fais de sport, moins j'ai d'énergie »).
    if (vu && ((w !== 'plus' && w !== 'moins') || pvNorm(mots[0]) === w)) out.add(i - 1);
  }

  // ── R5 : « ni / et / ou » RÉPÉTÉS PLUS DE DEUX FOIS. La source est précise sur les deux
  // bouts : virgule avant les suivants, AUCUNE avant le premier.
  for (var c of REPETABLE) {
    var pos = [];
    for (var i = 0; i < mots.length; i++) if (pvNorm(mots[i]) === c) pos.push(i);
    if (pos.length < 3) continue;
    for (var k = 1; k < pos.length; k++) if (pos[k] > 0) out.add(pos[k] - 1);
  }

  // ⛔⛔ FILTRE FINAL — ON N'EMPILE PAS DEUX DÉTACHEMENTS. Une virgule de règle qui vient se coller
  // CONTRE une marque déjà posée produit « Alors, demain, je ne sais pas » : deux détachements
  // consécutifs pour un seul mot. C'est la garde CI (prise libre de Rem) qui l'a sorti, et c'est
  // la doctrine : un texte SUR-ponctué coûte plus cher à un dys qu'un texte sous-ponctué. La
  // règle « virgule après le coordonnant en tête » est juste, mais elle suppose que le
  // coordonnant est SEUL en tête — pas suivi d'un complément lui-même détaché.
  if (deja) {
    var aDeja = function (i) { return deja.has ? deja.has(i) : !!deja[i]; };
    out.forEach(function (i) { if (aDeja(i - 1) || aDeja(i + 1)) out.delete(i); });
  }
  // ⛔⛔ PORTE FINALE — UNE RÈGLE NE DOIT JAMAIS ÉMETTRE UNE VIRGULE INTERDITE. Le juge à trois
  // classes en a sorti une (« …particulièrement faibles AVEC , par exemple litres » : virgule après
  // une préposition, parce que « par exemple » est un organisateur légitime mais pas ici). Plutôt
  // que d'ajouter une exception par cas, on fait passer TOUTE sortie par la primitive partagée.
  out.forEach(function (i) { if (ponctInterdit(mots, tg, i)) out.delete(i); });
  return out;
}

/* ⭐⭐ DÉTECTION DE QUESTION — DÉPLACÉE ICI depuis sidepanel.js/saisie-vocale.html (2026-08-24).
   Elle y vivait EN DOUBLE et n'existait NI dans dys-core NI dans l'app : le correcteur ne pouvait donc
   pas signaler un « ? » manquant, alors que le banc lui donne 96,67 % de précision (58/60,
   `node dictee/question_bench.js`). Le code est repris VERBATIM (mêmes regex, mêmes gardes) ; seuls les
   appels `DC.toks`/`DC.posTags` deviennent locaux. Les deux surfaces vocales délèguent désormais ici,
   donc `voix_parite_probe` continue de les comparer — sur une délégation identique. */
var QW=/^(est-ce|qu'est|où|comment|pourquoi|quand|combien|quel|quelle|quels|quelles|lequel|laquelle)(?![a-zà-ÿœ])/i;   // interrogatifs FORTS en tête (lookahead car \b casse après « où »)
// ⭐⭐ DÉTECTION DE QUESTION — version MESURÉE (l'ancienne règle « interrogatif en tête » faisait
// 45,5 % de précision : 79 faux sur 145, sur 48 653 phrases réelles). Nouvelle règle : 100 %,
// 0 faux sur 60 998 échantillons. Le BDL confirme la cause principale : L'INTERROGATION
// INDIRECTE NE PREND PAS DE « ? » (« Je me demande à quelle heure. »). ⚠️ La règle s'ancre sur
// la TÊTE DU SEGMENT : le dégât arrive quand Google coupe AU MILIEU de l'énoncé et rend un
// segment « quelle heure il est » — l'ancienne règle y posait un « ? » sur une subordonnée.
// L'inversion SEULE a été
// mesurée et refusée (69,4 %) — lue uniquement APRÈS un interrogatif. Le PITCH reste le seul
// canal pour l'interrogation par INTONATION (« Tu pars dans un mois ? ») : les deux se complètent.
// ⭐⭐⭐ DÉTECTION DE QUESTION PAR LES PARTIES DU DISCOURS (2026-08-05).
// L'ancienne version était une LISTE DE MOTS. Passée sur les formes que Rem a nommées, elle
// faisait 5/10 : elle ratait TOUTE l'interro-négative (« Ne viens-tu pas ? », « N'as-tu pas
// vu ? », « … n'est-ce pas ? ») et toute l'inversion nue (« Viens-tu demain ? »). Pas par
// manque de vocabulaire : parce qu'UNE LISTE NE VOIT PAS UNE STRUCTURE. « verbe + clitique
// sujet postposé » est un fait de PARTIES DU DISCOURS — et le tagger HMM était déjà chargé
// ici (`pos-hmm.json.gz`), la ponctuation ne l'appelait simplement jamais.
//
// L'INVERSION SEULE AVAIT ÉTÉ MESURÉE ET REFUSÉE (69,4 %). Ses deux familles d'échec sont
// connues et TOUTES DEUX décidables avec les étiquettes :
//   · inversion STYLISTIQUE (« peut-être est-elle partie ») -> adverbe ANTÉPOSÉ, liste fermée ;
//   · INCISE de citation (« je viendrai, dit-il ») -> ⭐ un VERBE CONJUGUÉ précède déjà.
//     C'est cette garde-là qui rend l'inversion utilisable.
//
// MESURÉ sur 72 498 cas réels (UD FR GSD + WiCoPaCo + GEC + multi1000), dont 27 145 FRAGMENTS
// de milieu de phrase — le piège propre à la dictée, où Google coupe où il veut :
//     ancienne (liste de mots)   précision 96,55 %   rappel  8,92 %
//     ⭐ celle-ci (tagger)       précision 95,83 %   rappel 14,65 %
// +64 % de rappel pour UN faux positif de plus en valeur absolue (2 contre 1 sur 72 498).
// Et sur les 2 restants : « Doit-on hériter de ceux qu'on assassine » EST une question, écrite
// avec un point dans le corpus (titre) ; l'autre est un fragment dont le déclencheur
// (« Non seulement … ») est hors du fragment. Aucun n'est réparable sans deviner.
//
// DÉGRADATION DOUCE : si le tagger n'est pas prêt, `posTags` rend null, les gardes verbales
// ne s'arment pas et on retombe sur les seules routes lexicales. Aucune exception.
var CLIT='je|tu|il|elle|on|ils|elles';
// ⚠️ NOUS et VOUS EXCLUS de l'inversion nue — c'était déjà écrit dans les notes de juillet
// (« l'impératif prend moi/toi/lui/nous/vous/y/en ») et le banc l'a confirmé sans pitié :
// « Abonnez-vous dès maintenant » était compté comme une question. Ils redeviennent sûrs
// APRÈS un interrogatif, où l'impératif est impossible.
var QINV=new RegExp("([A-Za-zÀ-ÿœ']+)-(?:t-)?("+CLIT+")(?![-\\w])",'i');
var QINV_Q=new RegExp("([A-Za-zÀ-ÿœ']+)-(?:t-)?("+CLIT+"|nous|vous)(?![-\\w])",'i');
/* ⭐ INVERSION SANS TRAIT D'UNION (02/09/2026, rapport de Rem : « la ponctuation ne marche pas en forme
   interrogative »). Le scripteur dys écrit « veux tu venir », « as tu fini », « qu'allons nous faire »,
   « est ce que » : AUCUNE n'était vue, et le correcteur proposait alors un POINT au bout de la question.
   Sans trait d'union, le tagger ne peut plus garder (« je pense tu as raison » ressemble à « pense-tu ») :
   la garde est la CONJUGAISON — la forme doit être un verbe conjugué QUI S'ACCORDE avec le clitique
   (« pense » n'est pas 2ᵉ personne, « Marie elle vient » n'a pas de verbe), et seulement EN TÊTE, après
   un interrogatif, après « que/qu' », ou avec le « t » euphonique. nous/vous restent réservés aux têtes
   interrogatives : « allez vous coucher » est un impératif réfléchi. Mesuré sur le banc `question_bench`. */
var QINV_S=new RegExp("([A-Za-zÀ-ÿœ']+)\\s+(?:t\\s+)?("+CLIT+"|nous|vous)(?![-\\w])",'i');
var QEUPH_S=/[A-Za-zÀ-ÿœ']+\s+t\s+(?:il|elle|on|ils|elles)(?![-\w])/i;   // « a t il », « y a t il » : le « t » seul n'existe pas ailleurs
var QUEHEAD=/^\s*qu(?:e(?![a-zà-ÿœ'’])|['’])/i;   // « que faisons-nous », « qu'allons-nous » : en tête, « que/qu' » ouvre l'inversion à nous/vous comme un interrogatif
var CLIT_PERS={je:['1','s'],tu:['2','s'],il:['3','s'],elle:['3','s'],on:['3','s'],nous:['1','p'],vous:['2','p'],ils:['3','p'],elles:['3','p']};
function _invSansTrait(ms,mots,qw){
  var v=ms[1].replace(/^(?:n|j|t|s|m|qu|l|d|c)['’]/i,''), cl=ms[2].toLowerCase(), pn=CLIT_PERS[cl];
  if(!pn||!v||v.indexOf("'")>=0||v.indexOf('’')>=0)return false;
  if((cl==='nous'||cl==='vous')&&!qw&&!/^qu['’]/i.test(ms[1])&&!(ms.index>0&&/^que$/i.test(mots[0]||'')))return false;
  var r=svReads(v); if(!r.length)return false;
  return svAgrees(r,pn[0],pn[1]);
}
// l'incise EN TÊTE de fragment (« disent-ils, … ») : la garde « verbe avant » ne peut pas la
// voir puisque le fragment COMMENCE par elle. Sa signature est la virgule qui la referme.
// ⛔ INCISE EN TÊTE (« disent-ils, peuvent jouer… »). ⚠️ Ma 1re garde cherchait la VIRGULE qui
// la referme : elle marche sur du texte écrit — donc sur le banc — mais **un segment vocal
// n'a AUCUNE ponctuation**, elle y serait INERTE. La garde CI l'a montré. Il faut une
// signature qui survive à l'absence de ponctuation : les VERBES DE PAROLE, liste fermée, et
// seulement quand l'inversion est en TÊTE (ailleurs, la garde « verbe déjà conjugué » suffit).
// Coût assumé : « Dis-tu vrai ? » est perdu — forme rare, et le pitch la rattrape.
var QINCISE=new RegExp("^\\s*[A-Za-zÀ-ÿœ']+-(?:t-)?("+CLIT+")\\s*,",'i');
var QPAROLE=/^(dit|dis|disent|disait|répondit|repondit|répond|repond|ajouta|ajoute|demanda|s['’]écria|secria|fit|reprit|poursuivit|murmura|songea|expliqua|précisa|precisa|lança|lanca|conclut|renchérit|rencherit)$/i;
var QADV=/^\s*(?:peut-être|sans doute|ainsi|aussi|à peine|a peine|du moins|encore|en vain|toujours est-il|aussi bien|tout au plus|rarement|jamais|non seulement)\b/i;
var QTAG=/\bn['’]est[-\s]ce\s+pas\s*$/i;
// ⚠️ ANCRÉ EN TÊTE : sans l'ancre, « se demandant quand est-ce qu'il va sortir » (interrogation
// INDIRECTE, que le BDL exclut explicitement du « ? ») redevenait une question.
var QEQ=/^\s*est[-\s]ce\s+(?:que|qu['’])/i;
var QEQ3=/^\s*est[-\s]ce(?!\s+qu)(?![a-zà-ÿœ])/i;   // « est-ce possible ? » : en TETE, « est-ce » n'a pas d'emploi non interrogatif
var QEQ2=/^\s*[a-zà-ÿœ']+\s+est[-\s]ce\s+(?:que|qu['’])/i;
var QW_PREP=/^\s*(?:à|a|de|d['’]|par|pour|avec|sur|dans|en|chez|vers|depuis|selon)\s+(?:quoi|qui|quel|quelle|quels|quelles|lequel|laquelle|lesquels|lesquelles)(?![a-zà-ÿœ])/i;   // interrogatif precede de sa preposition : « a quoi penses-tu ? »
var QSEUL=/^(qu['’]est|comment|pourquoi|combien)(?![a-zà-ÿœ])/i;
var QPRON=/^(lequel|laquelle|lesquels|lesquelles)(?![a-zà-ÿœ])/i;   // pronom interrogatif SUJET (garde anti-relatif : verbe juste apres)
var QEUPH=/[A-Za-zÀ-ÿœ']+-t-(?:il|elle|on|ils|elles)(?![-\w])/i;   // « t » euphonique : 74/74 inversions dans UD, ancrage ORTHOGRAPHIQUE (tient la ou le tagger lache)
var QPARTPAROLE=/^\s*(?:affirmé|précisé|precise|déclaré|declare|ajouté|ajoute|expliqué|explique|indiqué|indique|souligné|souligne|conclu|poursuivi|répondu|repondu|confié|confie|assuré|assure|estimé|estime|noté|note|rappelé|rappele|lancé|lance|martelé|martele|insisté|insiste|dit|écrit|ecrit)(?![a-zà-ÿœ])/i;   // participes de parole = incise au temps compose. ⚠️ PAS de  apres une lettre accentuee : en JS \w=[A-Za-z0-9_], donc la frontiere n'existe jamais et la regex ne matche RIEN (echec SILENCIEUX, deja paye)
var QVERBAL={VERB:1,AUX:1};
// le « ne » de la négation, collé (n') ou non, AVANT le verbe inversé ; et sa seconde moitié APRÈS
var QNEG1=/(^|[\s'’])(?:ne\s|n['’])/i;
var QNEG2=/^\s*(?:pas|plus|jamais|rien|gu[èe]re|personne|aucun|aucune)\b/i;
/* ⭐ LA COUPE DE LONGUEUR EST UNE CONTRAINTE DE FORME VOCALE QUI FUYAIT DANS LE CORRECTEUR.
   `estQuestion` a DEUX consommateurs qui ne courent pas le même risque :
     · la SAISIE VOCALE (sidepanel.js) écrit la marque DIRECTEMENT (`mk='?'`, `fin=…?'?':'.'`) ;
       elle ne voit que des FRAGMENTS courts, où la coupe à 12 ne mord presque jamais ;
     · le CORRECTEUR (`_questionScan`) n'émet qu'en `tier:'vigilance'` — ORANGE, proposé, jamais
       appliqué en silence ; et il voit des PHRASES ENTIÈRES, où la coupe mord tout le temps.
   Mesuré sur `question_bench.js` (positifs = phrases finissant par « ? », négatifs = « . »/« ! »
   plus des FRAGMENTS pris après une virgule), toutes gardes en place :
     coupe 12 : précision 96,67 %  rappel 18,47 %      coupe 20 : précision 91,95 %  rappel 25,48 %
     coupe 16 : précision 91,46 %  rappel 23,89 %      coupe 30 : précision 84,62 %  rappel 28,03 %
   La voix GARDE 12 (comportement identique, prouvé par une mesure inchangée) ; le correcteur passe
   à 20 : +22 questions trouvées contre +5 suggestions oranges de trop, sur tout le corpus.
   ⚠️ RÉFUTÉ EN CHEMIN : sortir les marques « non ambiguës » (t euphonique, n'est-ce pas) AVANT la
   coupe fait tomber la précision à 47,55 % — le « -t-il » attrape le discours rapporté (« … »,
   a-t-il affirmé), et ce sont les gardes d'incise qui s'en occupent, plus bas. */
var QMOTS_VOIX=12, QMOTS_CORR=20;
function estQuestion(t,maxMots){
  if(!t) return false;
  var mots=toks(t);
  if(!mots||!mots.length||mots.length>(maxMots||QMOTS_VOIX)) return false;   // au-delà : titre ou subordonnée
  if(QTAG.test(t)) return true;
  // ⭐ ÉLISION : `toks` garde l'apostrophe dans le token, donc « n'as-tu » donne « n'as » —
  // une forme que le modèle (appris sur UD, qui SÉPARE les clitiques) n'a jamais vue. Il ne la
  // tague pas VERB, la garde verbale ne s'arme pas, et « N'as-tu pas vu le film ? » retombait
  // en affirmative. On tague une COPIE dont le clitique élidé est retiré : les INDICES sont
  // préservés, donc tout le reste de la fonction est inchangé.
  var motsTag=mots.map(function(w){ return w.replace(/^(?:n|j|t|s|m|qu|l|d|c)['’]/i,'') || w; });
  var tg=null;
  function tag(i){ if(tg===null) tg=posTags(motsTag)||[]; return tg[i]; }
  var qw=QW.test(t)||QW_PREP.test(t);   // « a quoi penses-tu » : la tete interrogative peut etre precedee de sa preposition
  var m=((qw||QUEHEAD.test(t))?QINV_Q:QINV).exec(t);
  var sansTrait=false;   // inversion SANS trait d'union (graphie dys) : gardée par la conjugaison, pas par le tagger
  if(!m){var ms=QINV_S.exec(t); if(ms&&_invSansTrait(ms,mots,qw)){m=ms;sansTrait=true;}}
  // ⭐ ROUTE INTERRO-NÉGATIVE, indépendante du tagger. « n'as-tu pas … » : `toks` rend le token
  // « n'as », et même dé-élidé en « as » le modèle l'étiquette PROPN en tête (mesuré) — « as »
  // y est trop rare comme auxiliaire dans UD. La garde verbale ne s'arme pas et la question
  // retombait en affirmative. Or le cadre « ne … pas » ENCADRANT un clitique sujet POSTPOSÉ
  // n'existe qu'à l'interrogatif : l'affirmative met le clitique AVANT (« tu n'as pas vu »),
  // jamais après. C'est de l'ORDRE DES MOTS, ça ne demande aucun tagger.
  if(m && QNEG1.test(t) && QNEG2.test(t.slice(m.index+m[0].length)) && !QADV.test(t)) return true;
  if(m && !QINCISE.test(t)){
    var iv=toks(t.slice(0,m.index)).length;
    // incise en tête sans ponctuation : un VERBE DE PAROLE inversé au tout début
    if(iv===0 && QPAROLE.test(m[1])) return false;
    if(QPARTPAROLE.test(t.slice(m.index+m[0].length))) return false;   // « … », a-t-il affirmé » : l'auxiliaire est inverse, le verbe de parole est le PARTICIPE qui suit
    // ⭐ SANS LE TAGGER : le « t » euphonique (fait d'orthographe) et l'interrogatif en tete
    // (l'imperatif y est impossible). Mesure 2026-08-06 : le tagger lit « a/ADP » dans
    // « a-t-il raison » et « devrions/NOUN » dans « ou devrions-nous » — la regle avait raison,
    // c'est sa confirmation qui echouait. Les GARDES, elles, restent toutes.
    if((!sansTrait&&QVERBAL[tag(iv)]===1) || QEUPH.test(t) || (sansTrait&&QEUPH_S.test(t)) || qw || iv===0 || (sansTrait&&iv===1&&/^que$/i.test(mots[0]))){   // sans trait : jamais la route du tagger seul   // iv===0 : inversion EN TETE — l'imperatif prend moi/toi/nous/vous, jamais je/tu/il/elle/on/ils/elles
      if(QADV.test(t)) return false;                      // inversion stylistique
      for(var k=0;k<iv;k++) if(QVERBAL[tag(k)]===1) return false;   // incise : proposition déjà close
      return true;
    }
  }
  if(QEQ.test(t)) return true;
  if(QEQ3.test(t)) return true;   // « est-ce possible ? » — sans « que »
  if(qw && QEQ2.test(t)) return true;
  // dernier recours : l'interrogatif seul en ordre affirmatif (4e forme du BDL, celle que
  // seule l'INTONATION signale). Le tagger ferme le FP que la liste ne voyait pas :
  // l'interrogation INDIRECTE enchaîne un GN plein (« comment UNE PERSONNE a obtenu… »).
  if(QPRON.test(t) && t.indexOf(',')<0 && QVERBAL[tag(1)]===1) return true;   // « Lequel est le plus grand ? » ; le relatif, lui, porte un clitique (« laquelle lui repond »)
  if(!QSEUL.test(t) || t.indexOf(',')>=0) return false;
  if(CLIT_PERS[(mots[1]||'').toLowerCase()])return true;   // « pourquoi tu pleures » : le tagger lit « tu/DET », le clitique sujet tranche seul
  return tag(1)!=='DET';
}


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
      var e=em[lw];
      if(e===undefined){var _me=_ELID_DET.exec(lw);if(_me)e=em[_me[1]];}   // DÉTERMINANT ÉLIDÉ : « l'article » est UN token pour nous, DEUX pour le modèle (appris sur UD, qui les sépare). Hors-vocabulaire il retombait sur le backoff SUFFIXE puis sur le prior « majuscule → PROPN » — et comme Viterbi est GLOBAL, une seule forme collée DÉGRADE l'étiquetage de TOUTE la phrase. L'émission d'un « l'X » est celle de X.
      if(e!==undefined)return (t in e)?e[t]:FL;
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
  function _nounGate(dn){var p=NOUN_POST&&NOUN_POST.get(dn.replace(/œ/g,'oe'));return !!p&&p[0]>=PL_TAU_M&&p[1]<PL_EPS_M;}   // NOUN_POST clavé 'oe' → normaliser la ligature (comme _GOE/deaccS)
  function _nounGateN(dn){var p=NOUN_POST&&NOUN_POST.get(dn.replace(/œ/g,'oe'));return !!p&&p[0]>=PL_TAU_M;}   // variante SANS veto verbal : réservée aux déterminants pluriels non ambigus (voir rNounPlural)
  // Les DEUX familles d'exceptions du pluriel français, en listes CLOSES (on les apprend par cœur
  // à l'école, elles ne s'étendent pas) :
  //   -OU qui prend -X : bijou caillou chou genou hibou joujou pou   (les autres -ou prennent -s)
  //   -AIL qui fait -AUX : bail corail émail soupirail travail vantail vitrail
  // Sans elles le moteur produisait un FAUX pluriel — « des travail » → « travails », « des corail »
  // → « corails » — ce qui est pire que se taire. Elles passent AVANT le +s par défaut, et l'ancre
  // du posterior reste le juge final (hiboux/travaux/coraux y sont tous à 1000 ‰).
  // « email » SANS accent est laissé de côté : c'est le courriel, son pluriel est « emails ».
  var _PL_OUX={bijou:1,caillou:1,chou:1,genou:1,hibou:1,joujou:1,pou:1};
  var _PL_AILAUX={bail:1,corail:1,"émail":1,soupirail:1,travail:1,vantail:1,vitrail:1};
  // SUPPLÉTIFS non ambigus (morpho impossible : œil→yeux) → ROUGE FP=0 ; miroir Python _PL_SUPPL
  var _PL_SUPPL={oeil:'yeux',madame:'mesdames',mademoiselle:'mesdemoiselles',monsieur:'messieurs',bonhomme:'bonshommes',gentilhomme:'gentilshommes'};
  function pluralizeNoun(n){var dn=deacc(n.toLowerCase()).replace(/œ/g,'oe'),lw=n.toLowerCase(),cands=[];   // dn clé 'oe' (NOUN_POST/_PL_SUPPL clavés oe ; « œil » ET « oeil »)
    if(_PL_SUPPL[dn])return ckeepcase(n,_PL_SUPPL[dn]);                                            // supplétif (œil/oeil→yeux) certain → bypass ancre
    if(_PL_OUX[dn])cands.push(n+'x');                                                             // les sept en -oux, AVANT le +s
    if(_PL_AILAUX[lw])cands.push(n.slice(0,-3)+'aux');                                            // travail→travaux (forme ACCENTUÉE pour séparer émail/email)
    cands.push(n+'s');
    if(/al$/.test(dn))cands.push(n.slice(0,-2)+'aux');                                            // cheval→chevaux (bals vérifié d'abord)
    if(/au$|eu$/.test(dn))cands.push(n+'x');                                                      // oiseau/jeu→+x
    for(var k=0;k<cands.length;k++){var p=NOUN_POST.get(deacc(cands[k].toLowerCase()).replace(/œ/g,'oe'));if(p&&p[0]>=PL_ANCHOR_M)return cands[k];}return null;}   // ancre clavée 'oe'
  function rNounPlural(T,i){if(!NOUN_POST||i===0)return null;
    var _pd=deacc(T[i-1].toLowerCase()),_card=!!CARD[_pd];   // cardinal ≥2 (« cinq kilo »→kilos) = déterminant pluriel NON AMBIGU → mêmes gardes ROUGES (l'ANCRE de pluralizeNoun tue « cinq sestieri/minima ») ; miroir Python
    if(!PLURAL_DET[_pd]&&!_card)return null;
    var n=T[i],c0=n.charAt(0);if(!/[A-Za-zÀ-ÿœŒæÆ]/.test(c0)||c0!==c0.toLowerCase())return null;   // propre/capitalisé
    var dn=deacc(n.toLowerCase());if(dn.length<3||/[sxz]$/.test(dn)||NOUN_PL_STOP[dn])return null;
    if(_card){if(n.indexOf("'")>=0)return null;                                 // élision (« quatre d'entre eux ») = pas un nom compté
      if(CARDINV[dn]||CARD[dn]||CARDSTOP[dn])return null;                       // cible = autre nombre/invariable/préfixe (« cent trente »)
      if(_SEG&&_SEG.hy&&_SEG.hy[i])return null;}                               // ordinal composé (« dix-septième »)
    // GARDE §3 : P(NOM)≥0,5 ∧ P(VER)<0,01 (exclut porte/livre verbe + rouge ADJ-dom).
    // MAIS après un déterminant pluriel NON AMBIGU (des/ces/mes/tes/ses/nos/vos, cardinal — jamais pronoms),
    // un verbe CONJUGUÉ est impossible : le déterminant EST le contexte grammatical, et il est
    // AUDIBLE donc fiable. Le veto P(VER) y est redondant — il bloquait « des moule », « des porte ».
    // « les » et « leurs » restent gardés : ce sont AUSSI des pronoms (« il les porte »).
    var _sur=(_card||(_pd!=='les'&&_pd!=='leurs'));
    if(!(_sur?_nounGateN(dn):_nounGate(dn)))return null;
    var nx=i+1<T.length?T[i+1]:'';
    if(nx&&nx.charAt(0)===nx.charAt(0).toLowerCase()&&/^[A-Za-zÀ-ÿ]+$/.test(nx)){var dnx=deacc(nx.toLowerCase());var pp=NOUN_POST.get(dnx);
      if(pp&&pp[0]>=PL_TAU_M&&!ADJP[dnx])return null;}                                        // nom composé (nom+nom ; adj « français » → pas un composé)
    var pl=pluralizeNoun(n);return (pl&&deacc(pl.toLowerCase())!==dn)?pl:null;}
  // Sens INVERSE (plur→sing) : déterminant SINGULIER (classe fermée) collé à un nom pluriel = TOUJOURS une faute → FP=0 par construction. Miroir rule_noun_singular.
  var _SING_DET={un:1,une:1,le:1,la:1,ce:1,cet:1,cette:1,mon:1,ma:1,ton:1,ta:1,son:1,sa:1,chaque:1,du:1,au:1};
  var _SG_STOP={};('ananas avis bois bras bus cabas cas choix colis compas compromis concours corps courroux cours croix dais deces devis discours dos doux engrais epoux faux fils flux fois fracas gaz heros houx index jus laps larynx lilas mars matelas mets mois nez noix os ours paix paradis parcours pays permis pharynx poids prix progres puits reflux relais remords repas roux sas secours sens silex succes tas taux temps tennis toux univers velours virus voix').split(' ').forEach(function(w){_SG_STOP[w]=1;});   // invariants -s/-x (sing==plur) : la singularisation naïve donne un autre lexème → piège
  var _PL_OUX_PL={bijoux:1,cailloux:1,choux:1,genoux:1,hiboux:1,joujoux:1,poux:1};
  function desingularizeNoun(n){var dn=deacc(n.toLowerCase()),cands=[];   // inverse ancré : -aux→-al, -x→∅, -s→∅ ; ne renvoie QUE si la forme sing. est un NOM confiant
    if(/aux$/.test(dn)&&dn.length>4)cands.push(n.slice(0,-3)+'al');
    if(/eaux$|eux$/.test(dn)||_PL_OUX_PL[deacc((n.slice(0,-1)+'x').toLowerCase())])cands.push(n.slice(0,-1));
    if(/s$/.test(dn))cands.push(n.slice(0,-1));
    for(var k=0;k<cands.length;k++){var p=NOUN_POST.get(deacc(cands[k].toLowerCase()));if(p&&p[0]>=PL_TAU_M&&p[1]<PL_EPS_M)return cands[k];}return null;}
  // Adjectifs ANTÉPOSÉS du français — classe FERMÉE (c'est ce qui rend la traversée sûre). Formes
  // déaccentuées ; le déterminant en tête porte déjà le nombre. Miroir EXACT de correcteur_probe.py.
  var _ADJ_ANTE={};('grand grande grands grandes petit petite petits petites gros grosse grosses '
    +'beau bel belle beaux belles joli jolie jolis jolies jeune jeunes vieux vieil vieille vieilles '
    +'nouveau nouvel nouvelle nouveaux nouvelles bon bonne bons bonnes mauvais mauvaise mauvaises '
    +'long longue longs longues court courte haut haute meilleur meilleure meilleurs meilleures '
    +'moindre seul seule seuls seules meme memes autre autres premier premiere premiers premieres '
    +'dernier derniere derniers dernieres prochain prochaine ancien ancienne propre propres '
    +'pauvre pauvres vrai vraie vrais vraies simple simples double demi demie plein pleine '
    +'gentil gentille brave braves cher chere chers cheres').split(' ').forEach(function(w){_ADJ_ANTE[w]=1;});
  function rNounSing(T,i){if(!NOUN_POST)return null;
    var _pre='';
    if(_elidKind(T[i])==='det'){if(!/s$/.test(deacc(_headText(T[i]).toLowerCase())))return null;_pre=T[i].slice(0,T[i].length-_headText(T[i]).length);T=T.slice();T[i]=_headText(T[i]);}
    // ÉCRAN ADJECTIF (miroir Python) : « la grande boites » / « le vieux fauteuils » passaient au
    // travers alors que « la boites » était corrigé — le déterminant devait être COLLÉ au nom.
    // L'adjectif ANTÉPOSÉ est une CLASSE FERMÉE : on la franchit sans ouvrir la porte, UN seul mot,
    // et il doit être DANS la liste. FP=0 revérifié par scan UD (3 déclenchements avant ET après).
    else if(!(i>=2 && _ADJ_ANTE[deacc(T[i-1].toLowerCase())] && _SING_DET[deacc(T[i-2].toLowerCase())])
            && (i===0||!_SING_DET[deacc(T[i-1].toLowerCase())]))return null;   // déterminant SINGULIER juste avant (et posterior chargé)
    if(_SEG&&i<_SEG.dig.length&&_SEG.dig[i])return null;                                              // NOMBRE-écran (« le 25 mars », « le 100 mètres ») → abstention
    var n=T[i],c0=n.charAt(0);if(!/[A-Za-zÀ-ÿœŒæÆ]/.test(c0)||c0!==c0.toLowerCase())return null;           // propre/capitalisé
    var dn=deacc(n.toLowerCase());if(dn.length<4||!/[sx]$/.test(dn)||_SG_STOP[dn]||NOUN_PL_STOP[dn])return null;
    // ⛔ « AU/DU + pluriel apparent » (22/08, parité Python rule_noun_singular) : « au »/« du » ne précèdent
    // JAMAIS un pluriel — si le nom en a l'air, c'est le DÉTERMINANT qui est faux (« au chevaux » = « aux
    // chevaux »). Dé-pluraliser CASSE un mot juste : 2 des 10 casses d'accord sur le gold dys réel.
    // Abstention SIMPLE, mesurée meilleure que les variantes riches : cassés 26→24, FP échelle 1,44→1,40 %,
    // et ZÉRO asset (une règle au/aux qui répare exigerait cgram_plural.json, 68 Ko, absent des 2 moteurs JS).
    if(i>0&&(deacc(T[i-1].toLowerCase())==='au'||deacc(T[i-1].toLowerCase())==='du'))return null;   // pluriel apparent ; invariant/piège
    var nx=i+1<T.length?T[i+1]:'';
    if(nx&&nx.charAt(0)===nx.charAt(0).toLowerCase()&&/^[A-Za-zÀ-ÿ]+$/.test(nx)){var dnx=deacc(nx.toLowerCase());var pp=NOUN_POST.get(dnx);   // nom composé : nom + NOM confiant NON-verbe → abstention
      if(pp&&pp[0]>=PL_TAU_M&&pp[1]<PL_EPS_M&&!ADJP[dnx])return null;}
    if(_nounGate(dn)){var sg=desingularizeNoun(n);if(sg&&deacc(sg.toLowerCase())!==dn)return _pre+sg;}       // VOIE FRÉQUENTIELLE : pluriel NOM-dominant → « une voitures »→voiture
    if(/s$/.test(dn)&&NOUN_PLURAL[dn]&&GENDER_PURE[dn.slice(0,-1)]!==undefined){                       // VOIE RELÂCHÉE : pluriel homographe verbal (« la boites »=boiter 3sg) tranché par dét sing + tagger + lexique
      if(_SEG&&i+1<_SEG.hy.length&&_SEG.hy[i+1])return null;                                           // composé à trait d'union (« la sous-famille »)
      var _tgS=posTags(T);if(_tgS&&i<_tgS.length&&_tgS[i]==='NOUN')return {sugg:n.slice(0,-1),vig:1};}    // -s retiré. ORANGE (à vérifier) : direction ambiguë (la boîte OU les boîtes ?) — décision Rem. Miroir app.
    return null;}
  // === ponctuation/majuscules (sens & contexte) : couche segments + majuscule début de phrase (parité correcteur_probe.py) ===
  var _SEG=null,ABBREV={};'m mme mlle mr dr pr me mgr st ste etc cf ex vs no nos art av bd env fig vol ed p pp al co inc ave apr jc subsp ssp var sp spp gen fam'.split(' ').forEach(function(w){ABBREV[w]=1;});
  function _segInfo(text){var ss=[],bb=[],hy=[],cap=[],dig=[],re=/[A-Za-zÀ-ÿœŒ'’ʼ]+/g,m,prev=0,s;while((m=re.exec(text))){var gap=text.slice(prev,m.index);s=/[.!?…]/.test(gap);ss.push(s);bb.push(s||/[,;:()«»"–—\n]/.test(gap));hy.push(gap.indexOf('-')>=0);cap.push((gap.indexOf('.')>=0&&/\s/.test(gap))&&gap.indexOf('..')<0&&!/\d/.test(gap)&&!(gap.indexOf('.')>=0&&!/\s/.test(gap)&&/^(com|net|org|fr|io|co|eu|de|uk|be|ca|ch|us|info|edu|gov|biz|tv|me|app)$/i.test(m[0])))   /* MAJUSCULE : seulement après un POINT + espace ; PAS ! ? … (interjection « Ah! comme », inversion « viendra-t-il? je », suspension = ~100% FP mesuré banc OQLF/BDL) ni domaine collé « oqlf.gouv ». ss/bb gardent s (bornes de proposition). */;dig.push(/\d/.test(gap));prev=m.index+m[0].length;}return {ss:ss,bb:bb,hy:hy,cap:cap,dig:dig};}
  // C : run-on (ponctuation manquante entre 2 propositions) — VIGILANCE (vert) ; conservateur, anti-inversion (trait d'union)
  var RPRON={je:['1','s'],tu:['2','s'],il:['3','s'],elle:['3','s'],on:['3','s'],nous:['1','p'],vous:['2','p'],ils:['3','p'],elles:['3','p']},RCONJ={};'et ou ni mais car donc or que qu qui dont quand lorsque comme si puisque quoique lequel laquelle pour sans a'.split(' ').forEach(function(w){RCONJ[w]=1;});
  function _isFinite(w){var r=svReads(w),k;for(k=0;k<r.length;k++){var md=r[k][1].split(':')[0];if(md==='ind'||md==='sub'||md==='cnd'||md==='cond'||md==='imp')return true;}return false;}
  function runonText(text){var T=toks(text),seg=_segInfo(text),out=[],i;for(i=2;i<T.length-1;i++){var pn=RPRON[deacc(T[i].toLowerCase())];if(!pn)continue;if(seg.bb[i]||seg.hy[i])continue;if(RCONJ[deacc(T[i-1].toLowerCase())])continue;if(T[i-1].toLowerCase().indexOf("'")>=0||T[i].toLowerCase().indexOf("'")>=0)continue;/* ⭐ DEUX VERROUS DESSERRÉS (01/09/2026, signalé par Rem sur usage réel). Le détecteur ne parlait       ni sur « j'est été à la plage vous mangé » ni sur aucun run-on utile :       (5) il exigeait un verbe fini COLLÉ à gauche du pronom — or un run-on finit par un COMPLÉMENT           (« à la plage ‖ vous »). On demande désormais qu'un verbe fini existe QUELQUE PART dans la           proposition de gauche, depuis la dernière borne : c'est la vraie question (la proposition           d'avant a-t-elle son verbe ?), pas la position du mot.       (6) il exigeait que le verbe de droite ACCORDE DÉJÀ avec le pronom — donc il ne parlait que là           où il n'y a RIEN à corriger. « mangé » ne se lit jamais en 2e pers. plur. : muet pile au           moment où il servirait. On accepte donc aussi une forme que `rFlexionEr` saurait fléchir           (`_inf1` non nul) : c'est exactement le cas « la virgule manque ET le verbe est à corriger ».       ⚠️ Cette couche ne fabrique JAMAIS de mot : elle propose un signe de ponctuation, en ORANGE. */      var _finG=false,_j;      for(_j=i-1;_j>=0;_j--){if(seg.bb[_j]||seg.ss[_j])break;if(_isFinite(T[_j])){_finG=true;break;}}      if(!_finG)continue;
      /* ⚠️ un verbe fini JUSTE avant le pronom = clitique OBJET (« Alain peut vous proposer ») ou
         sujet INVERSÉ (« Pourquoi avez vous décidé ») — jamais le début d'une proposition. Mesuré :
         ces deux formes sont les seules du motif sur les 2 500 phrases correctes de fp_scale. */
      if(_isFinite(T[i-1]))continue;      var _dr=_isFinite(T[i+1]),_flechissable=(typeof _inf1==='function')&&_inf1(T[i+1])!==null;      if(!_dr&&!_flechissable)continue;      if(_dr&&!svAgrees(svReads(T[i+1]),pn[0],pn[1])&&!_flechissable)continue;out.push({a:T[i-1],b:T[i]});}return out;}
  function rCapital(T,i){if(!_SEG||i>=_SEG.cap.length||!_SEG.cap[i])return null;var w=T[i],c=w.charAt(0);if(c.toUpperCase()===c)return null;if(i>0&&ABBREV[deacc(T[i-1].toLowerCase())])return null;if(i>0&&deacc(T[i-1].toLowerCase()).length===1)return null;return c.toUpperCase()+w.slice(1);}
  // === confusion d'USAGE être↔avoir + auxiliaire MAL ORTHOGRAPHIÉ (parité dictee/correcteur_probe.py) ===
  var AVOIR_IDIOM={};'faim soif sommeil raison tort envie besoin peur'.split(' ').forEach(function(w){AVOIR_IDIOM[w]=1;});
  var AUX_ETRE_PP={};'alle allee alles allees venu venue venus venues arrive arrivee arrives arrivees parti partie partis parties devenu devenue devenus devenues revenu revenue revenus revenues reste restee restes restees ne nee nes nees mort morte morts mortes decede decedee decedes decedees reparti repartie repartis reparties tombe tombee tombes tombees parvenu parvenue parvenus parvenues intervenu intervenue intervenus intervenues survenu survenue survenus survenues redevenu redevenue redevenus redevenues'.split(' ').forEach(function(w){AUX_ETRE_PP[w]=1;});
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
    if(lem.avoir&&AUX_ETRE_PP[nxt]){if(nxt.slice(0,4)==='tomb'&&i+2<T.length){var _cd=deacc(T[i+2].toLowerCase());if(_cd==='la'||_cd==='le'||_cd==='les'||_cd==='sa'||_cd==='son'||_cd==='ses'||_cd==='ma'||_cd==='mon'||_cd==='mes'||_cd==='une'||_cd==='un'||_cd==='des'||/^l'/.test(T[i+2].toLowerCase()))return null;}   // « il a tombé la veste » : COD → tomber transitif familier, on s'abstient
      return ((CONJ_C.etre||{})[mt]||{})[per+nb]||null;}return null;}
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
  function rDeselide(T,i){var w=T[i],lw=w.toLowerCase();if(lw==="m'sieur"||lw==="m'dame"||lw==="m'ame"||lw==="n'roll"||lw==="c'te")   /* ⚠️ LISTE UNIQUE (audit 2026-08-11) : rElide et rDeselide font le MÊME travail et avaient DEUX listes d'exceptions différentes — « n'roll » n'était que dans celle de rElide. Mesuré : « rock n'roll » -> « rock ne roll ». Miroir de _ELIDE_STOP (Python). */return null;   // élision inversée dys → rétablir (FP=0)
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
  var PP_INVAR_ALWAYS={voulu:1,pu:1,du:1};   // voulu/pu/dû : régissent un infinitif élidé → TOUJOURS invariable (Grevisse)
  var TEMPORAL_ANT={};('fois jour jours journee journees matin matinee soir soiree annee annees semaine semaines mois heure heures an ans nuit nuits instant instants moment moments epoque epoques minute minutes seconde secondes hiver ete automne printemps siecle siecles').split(' ').forEach(function(w){TEMPORAL_ANT[w]=1;});   // antécédent temporel → « que » circonstant, pas COD
  /* « que » écrit sans apostrophe donne le token « qu » : les deux valent. */
  function _qq(w){var d=deacc(String(w).toLowerCase());return d==='que'||d==='qu';}
  function rPpAvoirCod(T,i){var lw=T[i].toLowerCase();if(lw.indexOf("'")>=0)return null;
    var base=_ppBase(T[i]);if(base===null){base=(IRR_PP[deacc(lw)]!==undefined?IRR_PP[deacc(lw)]:null);}if(base===null)return null;
    if(PP_COD_STOP[deacc(base)])return null;if(/^(vu|entendu|senti|regarde|ecoute|apercu|laisse|envoye|fait)$/.test(deacc(base))&&i+1<T.length&&COMMON_VERBS[deacc(T[i+1].toLowerCase())])return null;
    if(PP_INVAR_ALWAYS[deacc(base)])return null;                     // voulu/pu/dû → invariable
    if(i+1<T.length&&(T[i+1].toLowerCase()==='à'||deacc(T[i+1].toLowerCase())==='de'||deacc(T[i+1].toLowerCase())==="d'")&&i+2<T.length&&_isInfinitive(T[i+2]))return null;   // PP + à/de + INFINITIF → invariable
    var a=-1,aje=false,k;for(k=i-1;k>=0&&k>i-4;k--){var tk=T[k].toLowerCase(),dk=deacc(tk);if(AVOIR_AUX[dk]){a=k;break;}if(AVOIR_JE[tk]){a=k;aje=true;break;}if(PPMID[dk])continue;return null;}
    if(a<0)return null;
    var q=-1;
    if(aje){if(a-1<0||!_qq(T[a-1]))return null;q=a-1;}
    else{var bk=a-1;while(bk>=0&&(deacc(T[bk].toLowerCase())==='ne'||deacc(T[bk].toLowerCase())==='n'))bk--;if(bk<0)return null;var tb=T[bk].toLowerCase();
      if(QUE_SUBJ[tb]){q=bk;}
      else if(COD_SUBJ[deacc(tb)]){if(bk-1<0||!_qq(T[bk-1]))return null;q=bk-1;}
      /* ⭐ APOSTROPHE MANQUANTE — le cas dys par excellence. « Les fleurs que J AI cueilli » : le
         tokeniseur rend « j » et « ai » séparés et la règle ne reconnaissait plus « j'ai ». Mesuré
         le 26/08/2026 : avec l'apostrophe elle corrige (cueilli→cueillies), sans elle est MUETTE —
         et un dys écrit précisément sans apostrophes. « que j ai <participe> » n'est jamais du
         français correct : la structure est certaine. Miroir Python rule_pp_avoir_cod. */
      else if(tb==='j'||tb==='qu'||tb==='l'||tb==='d'){if(bk-1<0||!_qq(T[bk-1]))return null;q=bk-1;}
      else return null;}
    var lo=0,jj;if(_SEG){for(jj=q;jj>0;jj--){if(jj<_SEG.bb.length&&_SEG.bb[jj]){lo=jj;break;}}}
    var tg=posTags(T);if(!tg)return null;
    var det=-1,noun=-1,_elidAnt=false,m=q-1;
    while(m>=lo){var dm=deacc(T[m].toLowerCase());if(_elidKind(T[m])==='det'){det=m;noun=m;_elidAnt=true;break;}if(T[m].toLowerCase().indexOf("'")>=0)return null;if(PREP[dm])return null;if(m<tg.length&&(tg[m]==='DET'||NUM_DET[dm])){det=m;break;}if(m<tg.length&&(tg[m]==='NOUN'||tg[m]==='PROPN')){noun=m;m--;continue;}if(m<tg.length&&(tg[m]==='ADJ'||tg[m]==='ADV'||tg[m]==='NUM')){m--;continue;}return null;}
    if(det<0||noun<0)return null;
    var mm=det-1;while(mm>lo&&mm<tg.length&&tg[mm]==='ADV')mm--;
    if(mm>=lo&&PREP[deacc(T[mm].toLowerCase())])return null;
    if(mm>=lo){var dmm=deacc(T[mm].toLowerCase());if(dmm==='et'||dmm==='ou'||dmm==='ni')return null;}
    var _ant=_elidAnt?_headText(T[noun]):T[noun],nd=deacc(_ant.toLowerCase());if(COMPLETIVE_ANT[nd])return null;if(TEMPORAL_ANT[nd])return null;   // antécédent temporel → « que » circonstant, pas COD
    var dd=_elidAnt?null:deacc(T[det].toLowerCase());if(!_elidAnt&&!NUM_DET[dd])return null;var nb=_elidAnt?'s':(NUM_DET[dd]==='pl'?'p':'s');
    var g=_nounGender(_ant,nb,true);if(g!=='m'&&g!=='f')return null;   // Fix C : antécédent confirmé → GENDER_MAP OK
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
  var _A1AUXPL={sont:1,etaient:1,furent:1,seront:1};   // #A1 : aux ÊTRE 3e-pers PLURIEL AUDIBLE (etes exclu = vouvoiement sing.)
  /* « ce matin », « le lendemain », « la semaine »… : un COMPLÉMENT DE TEMPS, jamais un sujet
     postposé. Liste FERMÉE — « la reprise » n'en fait pas partie et reste protégée. */
  var _NOMS_TEMPS={};('matin matins matinee matinees soir soirs soiree soirees midi minuit jour jours '+
    'journee journees semaine semaines mois an ans annee annees nuit nuits weekend week-end printemps '+
    'ete automne hiver lundi mardi mercredi jeudi vendredi samedi dimanche veille lendemain saison '+
    'saisons moment moments instant instants fois siecle siecles decennie decennies').split(' ')
    .forEach(function(w){_NOMS_TEMPS[w]=1;});
  function _detDeTemps(T,j){return (j+1<T.length)&&!!_NOMS_TEMPS[deacc(T[j+1].toLowerCase())];}
  function rPpEtre(T,i){var lw=T[i].toLowerCase();if(lw.indexOf("'")>=0)return null;
    var base=_ppBase(T[i]);if(base===null)return null;
    if(/^(vu|entendu|senti|regarde|ecoute|apercu|laisse|envoye|fait)$/.test(deacc(base))&&i+1<T.length&&COMMON_VERBS[deacc(T[i+1].toLowerCase())])return null;   // « s'est vu/fait/laissé + INFINITIF » → PP INVARIABLE (piège Voltaire)
    var a=-1,k;for(k=i-1;k>=0&&k>i-4;k--){var dk=deacc(T[k].toLowerCase());if(PPE_AUX[dk]){a=k;break;}if(PPMID[dk])continue;return null;}
    if(a<0)return null;var auxNum=PPE_AUXP[deacc(T[a].toLowerCase())]?'p':'s';
    var _a1refl=false;for(var _kr=Math.max(0,a-2);_kr<a;_kr++){var _dr=deacc(T[_kr].toLowerCase());if(_dr==='se'||_dr==='s'){_a1refl=true;break;}}   // #A1 : verbe pronominal (« se sont … ») → PP potentiellement invariable → A1 s'abstient
    var info=null,sk=-1;for(k=a-1;k>=0&&k>a-3;k--){var d2=deacc(T[k].toLowerCase());if(d2==='ne'||d2==='n')continue;info=PPE_SUBJ[d2];sk=k;break;}
    if(!info&&a>=1){var _mel=_ELIDED_PRON.exec(T[a-1].toLowerCase());if(_mel){info=PPE_SUBJ[deacc(_mel[1])];sk=a-1;}}   // pronom élidé avant l'aux : le LIRE — il porte personne+genre+nombre (« Je crois qu'elle est parti »→partie ; mesuré muet 30/08/2026). qu'on/qu'vous → absent de PPE_SUBJ → prudence ci-dessous. Miroir Python.
    if(!info){                                                                   // pas de sujet PRONOM → sujet NOM via le VRAI PARSEUR (miroir rule_pp_etre)
      if(a>=1&&_elidKind(T[a-1])==='pron')return null;   // PRONOM élidé non lisible (« qu'on », « n'… ») → le vrai sujet est le clitique, prudence. AVANT : veto EN BLOC sur l'apostrophe, qui écartait aussi le DÉTERMINANT élidé (« l'origine est discuté ») — l'angle mort mesuré.
      var tgp=posTags(T);
      if(!tgp||i>=tgp.length||(tgp[i]!=='VERB'&&tgp[i]!=='ADJ'))return null;     // participe RÉEL (tagger)
      /* sujet POSTPOSÉ (« est annoncée la reprise ») → abstention. EXEMPTION MESURÉE le 26/08/2026 :
         un COMPLÉMENT DE TEMPS n'est jamais un sujet postposé. En bloc, la garde rendait MUET
         l'accord par PRÉNOM (« Marie est venu CE MATIN. »). Miroir app rPpEtre. */
      if(i+1<tgp.length&&tgp[i+1]==='DET'&&!_detDeTemps(T,i+1))return null;
      var sj=_npSubject(T,tgp,a);
      if(sj===null){if(auxNum==='p'&&_ppCoordSubject(T,tgp,a)==='p'){var gcp=(/e$/.test(lw)&&!/é$/.test(lw))?'f':'m',sgp=base+(gcp==='f'?'es':'s');return sgp.toLowerCase()!==lw?ckeepcase(T[i],sgp):null;}
        if(!_a1refl&&_A1AUXPL[deacc(T[a].toLowerCase())]&&/é$/.test(lw)&&deacc(lw)===deacc(base))return ckeepcase(T[i],base+'s');   // #A1 : sujet non résolu, aux pluriel audible → nombre seul (masc gardé)
        return null;}   // sujet COORDONNÉ « X et Y sont » → pluriel, genre écrit gardé (miroir Python)
      if(sj.n!==auxNum)return null;                                            // nombre du sujet ≠ aux → sujet mal identifié → abstention
      if(a-sj.idx>5)return null;                                                // sujet trop loin de l'aux → abstention (FP)
      for(var kk=sj.idx+1;kk<a;kk++){if(T[kk].charAt(0)!==T[kk].charAt(0).toLowerCase()&&kk<tgp.length&&(tgp[kk]==='NOUN'||tgp[kk]==='PROPN'))return null;}   // nom propre entre sujet et aux → ambigu (FP)
      if(sj.g!=='m'&&sj.g!=='f'){if(sj.n==='p'&&!_a1refl&&/é$/.test(lw)&&deacc(lw)===deacc(base))return ckeepcase(T[i],base+'s');return null;}   // #A1 : sujet pluriel parsé, genre inconnu (épicène) → nombre seul (masc gardé)
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
  var _COLL_HEAD={};'plupart majorite minorite nombre total partie moitie tiers quart ensemble reste quantite foule multitude infinite poignee kyrielle dizaine douzaine quinzaine vingtaine trentaine quarantaine cinquantaine soixantaine centaine millier million milliard brochette tapee flopee sorte espece genre bande groupe tas serie masse nuee troupe ribambelle cohorte myriade pleiade armee meute horde essaim tripotee ramassis foultitude palanquee'.split(' ').forEach(function(w){_COLL_HEAD[w]=1;});
  var _NP_BREAK={};'que qu qui dont quand lorsque puisque parce comme si car mais donc or quoique lequel laquelle lesquels lesquelles'.split(' ').forEach(function(w){_NP_BREAK[w]=1;});
  function _adjEstem(lw){var s;if(/x$/.test(lw))s=lw.slice(0,-1);else if(/s$/.test(lw)&&!/ss$/.test(lw))s=lw.slice(0,-1);else s=lw;return (/e$/.test(s)&&!/é$/.test(s))?s:null;}
  function _nounGender(w,num,full){var _ga=_GACC[w.toLowerCase()];if(_ga==='m'||_ga==='f')return _ga;   // forme ACCENTUÉE exacte (Morphalou inclus), miroir app/correcteur_probe.py, INCONDITIONNEL
    var d=deacc(w.toLowerCase());function src(x){var g=GENDER_PURE[x];if(g==='m'||g==='f')return g;if(full){g=GENDER_MAP[x];if(g==='m'||g==='f')return g;}return null;}var g=src(d);if(g)return g;if(num!=='p'||NOUN_INVAR_S[d])return null;if(/x$/.test(d)&&d.length>2){g=src(d.slice(0,-1))||src(d.slice(0,-1)+'u');if(g==='m'||g==='f')return g;}if(/s$/.test(d)&&d.length>2){g=src(d.slice(0,-1));if(g==='m'||g==='f')return g;}return null;}   // full=true (Fix C) : antécédent [dét+NOM] confirmé → retombe sur GENDER_MAP (noms homographes pomme/ferme), sinon FP
  var _COLLECTIF={};('plupart majorite minorite moitie ensemble totalite reste nombre quantite foule dizaine douzaine centaine millier tas infinite serie groupe partie').split(' ').forEach(function(w){_COLLECTIF[w]=1;});
  var _ELID_DET=/^l['’](.+)$/i, _ELID_PRON=/['’](ils|elles|il|elle|on|je|tu|nous|vous)$/;
  function _headText(tok){var m=_ELID_DET.exec(tok.toLowerCase());   // PRIMITIVE : le NOM porté par un token, élision décollée (« L'allégation » → « allégation »). La majuscule d'un nom élidé en tête de phrase appartient au DÉTERMINANT, pas au nom : tester tok.charAt(0) pour écarter un nom PROPRE écartait donc tout nom commun élidé (8 divergences mesurées sur l'adjectif épithète).
    return m?tok.slice(tok.length-m[1].length):tok;}
  function _elidKind(tok){var t=tok.toLowerCase();   // PRIMITIVE PARTAGÉE : que cache un token à apostrophe ? 'pron' (qu'ils, s'il) | 'det' (l'équipe) | null. Sans elle, les règles posent un veto EN BLOC sur l'apostrophe — ce qui écarte les pronoms élidés (souhaité) MAIS AUSSI les déterminants élidés (angle mort mesuré : 41 divergences par elision_probe).
    if(_ELID_PRON.test(deacc(t)))return 'pron';
    if(_ELID_DET.test(t))return 'det';
    return (t.indexOf("'")>=0||t.indexOf('’')>=0)?'pron':null;}   // autre contraction (d', qu', n') : prudence, on garde le veto
  // ⭐ PROPOSITION RELATIVE EN « qui » — le résiduel que Rem pointait.
  // « les villages QUI COMPOSENT la commune est très ancien » : en remontant depuis « est », on
  // sort à la première frontière VERBALE (« composent ») et on retient « la commune », qui est le
  // COMPLÉMENT du verbe de la relative. `qui` est pourtant dans _NP_BREAK — on ne l'atteint jamais.
  // MESURÉ AVANT, sur les cas isolés par l'ANNOTATION UD (nsubj séparé de son verbe par une
  // relative + leurre de nombre) : FP 0/33 mais **rappel 0 % (23 muets sur 23)**.
  // RÈGLE DE STRUCTURE, pas de distance : « qui » est un pronom relatif SUJET, son antécédent est
  // FORCÉMENT à gauche. Donc si un « qui » précède ce verbe (à travers les seuls CLITIQUES), tout
  // ce qu'on a ramassé depuis appartient à la relative -> on le jette et on reprend à sa gauche.
  // ⚠️ On n'accepte QUE des clitiques entre les deux : un mot plein romprait la preuve.
  var _QUI_CLIT={ne:1,y:1,en:1,se:1,me:1,te:1,le:1,la:1,les:1,lui:1,leur:1,nous:1,vous:1,"n'":1,"s'":1,"m'":1,"t'":1,"l'":1};
  function _quiRelAvant(T,j,lo){
    for(var k=j-1;k>=j-3;k--){
      if(k<lo)return -1;
      var w=deacc(T[k].toLowerCase());
      if(w==='qui')return k;
      if(!_QUI_CLIT[w]&&!_QUI_CLIT[T[k].toLowerCase()])return -1;
    }
    return -1; }
  function _npSubject(T,tg,a){if(deacc(String(T[a]||'').toLowerCase()).indexOf("qu'")===0)return null;   /* MARQUEUR FUSIONNE DANS LE VERBE : « les possibilites qu'offrent les domaines » — le token EST « qu'offrent », le balayage part de a-1 et ne le voit jamais. Un verbe en « qu' » est celui d'une RELATIVE/SUBORDONNEE : sujet a DROITE (inversion) ou le relatif lui-meme. Remonter a gauche rend un sujet FAUX → abstention (FP=0). Mesure par dictee/ponct_morpho_probe.py. */var lo=0,j;if(_SEG){for(j=a;j>0;j--){if(j<_SEG.bb.length&&_SEG.bb[j]){lo=j;break;}}}
    /* SUJET = PRÉNOM NU (« Marie est venu » → venue) — miroir app + correcteur_probe. Un prénom n'a pas
       de déterminant : le balayage [dét + nom-tête] ne le voyait jamais. ⚠️ Abstention sur COORDINATION
       (mesuré : 3 FP sur UD 2500, le prénom fermait une énumération donc le sujet réel est PLURIEL) et
       neutralisation en TÊTE de proposition pour les prénoms marqués (Pierre m. / la pierre f.). */
    var _pg=PRENOMS[T[a-1]];
    if(_pg&&a-1>=lo&&/^[A-ZÀ-Þ]/.test(T[a-1])){var _co=false;
      for(j=lo;j<a-1;j++){var _dj=deacc(T[j].toLowerCase());if(_dj==='et'||_dj==='ou'||_dj==='ni'||_dj==='and'){_co=true;break;}}
      if(!_co&&!(a-1===lo&&_pg[1]))return{idx:a-1,det:a-1,dtxt:'',htxt:T[a-1],elid:false,g:_pg[0],n:'s'};}
    var detIdx=-1,_sp=false,_elid=false;for(j=a-1;j>=lo;j--){var dj=deacc(T[j].toLowerCase()),tgj=(tg&&j<tg.length)?tg[j]:null;if(dj==='et'||dj==='ou'||dj==='ni')return null;if(_NP_BREAK[dj]||dj.indexOf("qu'")===0)break;   /* ⭐ TEST DE PRÉFIXE = BUG CORRIGÉ : `toks` ne sépare pas l'élision, « qu'offrent » est UN token, donc _NP_BREAK (que/qu) ne matchait JAMAIS et la coupure de relative était INERTE sur toute forme élidée. Le parseur remontait dans la proposition amont et rendait un sujet FAUX (« les possibilités qu'offrent les domaines » → il répondait « possibilités ») ; toute règle d'accord qui s'y appuie héritait de l'erreur = FP SILENCIEUX. Mesuré par dictee/ponct_morpho_probe.py. Seul « que » s'élide en « qu' » → préfixe exact. */
      if(_ELID_DET.test(T[j].toLowerCase())){   // DÉCOLLER L'ÉLISION — ce test passe AVANT la frontière VERBALE : sur un token COLLÉ le tagger est contaminé (il étiquette « l'entreprise » VERB dans « l'entreprise ne présentais pas »). Le GENRE du lexique, sans contexte, décide plus bas. : « l'équipe » est UN SEUL token, donc ni le tagger ni les listes de déterminants n'y voient de déterminant — le parseur s'abstenait, et avec lui toutes les règles d'accord. Or « l' » est TOUJOURS singulier (« les » ne s'élide jamais) : l'information EST là, simplement collée.
        if(detIdx<0||_sp){detIdx=j;_sp=false;_elid=true;}
        continue;}
     if(tgj==='VERB'||tgj==='AUX'){if(/(é|és|ée|ées)$/.test(T[j].toLowerCase())&&!(j-1>=lo&&tg&&j-1<tg.length&&tg[j-1]==='AUX'))continue;var _qr=_quiRelAvant(T,j,lo);if(_qr>=0){detIdx=-1;_sp=false;_elid=false;j=_qr;continue;}break;}if(NUM_PRON[dj])break;if(T[j].toLowerCase().indexOf("'")>=0&&/(ils|elles|il|elle|on|je|tu|nous|vous)$/.test(dj))break;   // PRONOM COLLÉ (« qu'ils ont fait », « s'ils », « lorsqu'elle ») : le sujet EST ce pronom, pas un GN — sinon on remontait chercher un déterminant plus à gauche et on prenait le pronom lui-même pour nom-tête
      var _pj=(PREP[dj]||dj==='en'||(T[j].toLowerCase().indexOf("'")>=0&&dj.charAt(0)==='d'));if(_pj)_sp=true;   // « de/du/des/au/aux/en/d' » : lien qui RATTACHE le GN de gauche à celui de droite. « en » MANQUAIT de PREP — « avec un cercle EN SON CENTRE ont été érigées » prenait « centre » pour sujet.
      if(tgj==='DET'||NUM_DET[dj]){if(detIdx<0||_sp){detIdx=j;_sp=_pj;_elid=false;}}}   // On remonte au déterminant le PLUS À GAUCHE, mais SEULEMENT à travers un lien « de » — c'est POUR ÇA que la remontée existe (« les enfants DE la voisine » a sa tête à GAUCHE). Sans la condition, « Ce matin la livraison est arrivée » remonte de « la » à « Ce » et prend « matin » pour sujet (FP mesuré). Un 2e GN à gauche SANS lien « de » est ADVERBIAL, pas le sujet. Et une préposition CONTRACTÉE (du/des/au/aux) qui sert d'ancre reste « molle » (_sp gardé vrai) : elle ouvre un complément, donc un vrai déterminant plus à gauche doit pouvoir la remplacer (« les autorités DU Sahara ont » → tête « autorités », pas « Sahara »).   // On remonte au déterminant le PLUS À GAUCHE — mais SEULEMENT à travers un lien « de ». C'est pour ça que la remontée existe : « les enfants DE la voisine » a sa tête à GAUCHE. Sans la condition, « Ce matin la livraison est arrivée » remonte de « la » à « Ce » et prend « matin » pour sujet → « est arrivé » (FP mesuré). Un second GN à gauche SANS lien « de » est un GN ADVERBIAL (« ce matin », « la semaine dernière »), pas le sujet ⇒ on garde le déterminant le plus PROCHE du verbe.
    if(detIdx<0)return null;
    if(PREP[deacc(T[detIdx].toLowerCase())]&&detIdx-1>=lo&&tg&&detIdx-1<tg.length&&(tg[detIdx-1]==='NOUN'||tg[detIdx-1]==='PROPN'))return null;   // Un déterminant qui est AUSSI une préposition contractée (du/des/au/aux) et qui suit un NOM ouvre un COMPLÉMENT, pas le sujet : « de nombreux pouvoirs DU GOUVERNEUR ont été délégués », « 50 000 Allemands DU WARTHELAND ont péri ». Aucun vrai déterminant plus à gauche ⇒ la remontée ne peut pas réparer ⇒ abstention.
    if(detIdx-1>=lo&&PREP[deacc(T[detIdx-1].toLowerCase())])return null;
    if(_elid){var _h=_ELID_DET.exec(T[detIdx].toLowerCase())[1];   // « l'équipe » : le déterminant ET la tête sont le MÊME token
      var _g=_nounGender(_h,'s')||GENDER_PURE[deacc(_h)];
      if(_g!=='m'&&_g!=='f')return null;   // genre inconnu → on ne sait pas rendre le déterminant → abstention
      return {idx:detIdx,det:detIdx,g:_g,n:'s',elid:true,dtxt:(_g==='f'?'la':'le'),htxt:_h};}
    var head=-1;for(var k=detIdx+1;k<a;k++){var dk=deacc(T[k].toLowerCase());if(PREP[dk]||(T[k].toLowerCase().indexOf("'")>=0&&dk.charAt(0)==='d'))break;
      if(CARD[dk]||(tg&&k<tg.length&&tg[k]==='NUM'))continue;   // NUMÉRAL = quantifieur, pas la tête : « ces VINGT quatre équipes sont réparties » rendait la tête « vingt » (masc. dans GENDER_PURE) → « répartis » sur un sujet féminin CORRECT. Bug PARTAGÉ par toutes les règles d'accord à sujet nominal (miroir Python _np_subject)
      if((tg&&k<tg.length&&(tg[k]==='NOUN'||tg[k]==='PROPN'))||(dk in GENDER_PURE)){head=k;break;}}
    if(head<0)return null;
    if(_COLLECTIF[deacc(T[head].toLowerCase())])return null;   // NOM COLLECTIF (« la plupart ONT gardé », « la majorité sont ») : l'accord se fait au SENS, singulier ET pluriel sont corrects ⇒ abstention
    var ddet=deacc(T[detIdx].toLowerCase()),num;
    if(NUM_DET[ddet])num=NUM_DET[ddet]==='pl'?'p':'s';
    else if(_QUANT_PL[ddet])num='p';
    else if(_QUANT_SG[ddet])num='s';
    else{var dh0=deacc(T[head].toLowerCase());if(NOUN_INVAR_S[dh0])return null;num=/[sx]$/.test(dh0)?'p':'s';}
    var g=_nounGender(T[head],num)||ADJ_DETM[ddet]||(ADJ_DETF[ddet]?'f':null);
    return {idx:head,det:detIdx,g:g||'?',n:num,elid:false,dtxt:T[detIdx],htxt:T[head]};}
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
  var _ADJ_INVAR_LOC={};('dernier cri|grand public|grand angle|grand ouvert|nouveau ne|moyen age').split('|').forEach(function(w){_ADJ_INVAR_LOC[w]=1;});   // locutions figées : adjectif INVARIABLE
  var _ADV_ADJ_INVAR={plein:1,haut:1,large:1,fort:1,bas:1,net:1,clair:1,court:1,droit:1,franc:1};   // adjectifs employés ADVERBIALEMENT → invariables
  function _adjAccOk(lw,d){var e=ADJP[d];if(!e)return true;var alt=e[1],p=ADJP[deacc(alt.toLowerCase())],ka=p?p[1]:null;if(ka===null)return true;return lw===ka.toLowerCase()||lw===alt.toLowerCase();}   // permissif (miroir Python) : bloque teinté≠teint/teinte, tolère paires asymétriques
  var _INVAR_COLOR={};'creme marine saumon emeraude turquoise kaki bordeaux ivoire ebene moutarde brique ocre indigo azur cerise framboise lavande prune olive caramel chocolat noisette paille sable bronze cuivre acajou corail grenat aubergine abricot peche citron lilas anthracite ardoise taupe champagne rouille safran pistache amande menthe crevette nacre perle'.split(' ').forEach(function(w){_INVAR_COLOR[w]=1;});   // couleurs/matières dérivées de nom = INVARIABLES (miroir Python _INVAR_COLOR)
  var _EPICENE_ADJ={};('abolitionniste abominable abordable aborigene absurde academique acariatre acceptable accessible accessoire acerbe acetique acide acoustique acre acrobatique acrylique activiste adaptable admirable admissible adorable adulte adultere adventiste adverse aerodynamique aeronautique aeroportuaire affable agile agnostique agraire agreable agricole aigre aimable ajustable alchimique alcoolique aleatoire alerte algebrique algorithmique alimentaire allegorique allegre allergique alphabetique alphanumerique altruiste alveolaire ambidextre ambulatoire amene amiable amnesique amniotique amorphe amovible amphibie ample amyotrophique anachronique anaerobie analgesique analogique analogue analphabete analytique anaphylactique anarchique anarchiste anatomique androgyne androide anecdotique anemique anesthesique angelique anglophone angulaire annexe anniversaire annulaire anonyme anorexique antagoniste antarctique anthropologique antiacide antiallergique antiatomique antibiotique anticommuniste anticonformiste antidemocratique antidopage antidrogue antiemeute antifasciste antifongique antinucleaire antipathique antipatriotique antipsychotique antique antirabique antisemite antiseptique antiterroriste antitetanique anxiolytique aortique apache apathique apatride aphasique aphone aphrodisiaque apocalyptique apocryphe apolitique apostolique applicable appreciable apre apte aquatique arabe arabique arable arbitraire arboricole archaique archeologique arctique aride aristocrate aristocratique arithmetique aromatique arthritique articulaire artistique ascetique asiate asiatique asthmatique astigmate astrologique astrometrique astronomique asymetrique asymptomatique atavique athee atheiste athletique atlantique atmospherique atomique atroce atteignable attribuable atypique audible auguste auriculaire aurifere austere authentique autiste autistique autobiographique autochtone autocratique autodidacte autoerotique autographe automatique automobile autonome autoritaire auxiliaire avare aveugle aviaire avide axillaire azteque azyme bacteriologique baisable balaise baleze balistique balkanique balneaire balsamique balte baltique bancaire baptiste barbare barge barje barometrique baroque basilaire basilique basique basque bebete begue begueule beige belge belliciste beneficiaire benefique benevole berbere bete biblique bicolore bielorusse bigame biliaire bilingue binaire biochimique biodegradable bioelectrique biogenetique biogenique biographique biologique biometrique biomoleculaire bionique biotechnologique biotique bipede biplace bipolaire bizarre bizarroide blamable blanchatre blasphematoire bleme bleuatre blondasse boheme bolchevique bonasse bonhomme bordelique borgne borique bosniaque botanique botulique bouddhique bouddhiste bouffe boulimique bravache brave britannique bronchique brunatre brusque bubonique bucolique budgetaire bulgare bureaucratique burgonde burlesque buvable cabalistique cadaverique calcaire calme calorifique canaille cancerigene candide caniculaire canonique capable capillaire capitaliste caracteristique caraibe carbonique cardiaque cardiovasculaire carliste carnivore cartographique cassable cataclysmique catalytique catastrophique catatonique categorique cathare cathartique cathodique catholique cauchemardesque caustique cave celebre celebrissime celibataire cellulaire celte celtique centenaire centieme centrifuge centripete centriste ceramique chamanique champetre chaotique charismatique charitable chaste chauve chevaleresque chiche chiite chimerique chimique chlorhydrique choledoque chouette chromatique chromosomique chronique chronologique chypriote cinematographique cinetique cinquieme circulaire circulatoire citrique civique classique claustrophobe climatique clinique clownesque cocasse cochleaire colerique colique colonialiste combinatoire comble combustible comestible comique commercialisable commode communautaire communiste comparable compatible compensatoire complementaire complexe complice composite comprehensible comptable concave concentrique concevable condamnable conforme conformiste confortable conique connexe considerable consommable constructible consulaire contestable contestataire contradictoire contraire controlable convenable convertible convexe coranique coriace coronaire corporatiste corruptible corse cosmetique cosmique cosmologique cosmopolite coupable courbe crade credible credule crematoire creole crepusculaire cricoide criminalistique critiquable critique croate croyable cruciforme cryogene cryptique cubique cubiste culinaire cultivable cuneiforme cupide curable curve cyanhydrique cybernetique cyclable cyclique cyclothymique cylindrique cynique cyrillique cystique dace dantesque debile debonnaire decapotable decelable deductible defaitiste defavorable defendable deficitaire degueulasse delectable deletere demagogue demissionnaire democrate democratique demographique demoniaque demontable dense dentaire deontologique depilatoire deplorable depressionnaire deraisonnable derisoire dermique desagreable desertique desinvolte desirable despotique detachable detectable detestable deuxieme diabetique diabolique diagnostique dialectique diaphane diaphoretique diaphragmatique diastolique didactique dietetique diffamatoire difficile difforme digeste digne dilatoire dingue diplomate diplomatique dirigeable discernable disciplinaire discretionnaire discriminatoire discutable disparate disponible dissemblable dithyrambique diuretique diurne divinatoire divisible divisionnaire dixieme docile docte documentaire dogmatique domestique domiciliaire dommageable dorique double douceatre douzieme dramatique drastique drole druidique durable dynamique dynastique dyslexique ecarlate ecclesiastique echangeable eclectique ecologique ecologiste econome economique ectopique ectoplasmique effacable efficace effroyable egalitaire egocentrique egoiste eidetique ejectable elastique electrique electrochimique electrogene electrolytique electromagnetique electronique electrostatique elementaire eligible eliminatoire elitiste elliptique emblematique embryonnaire emerite emissaire empathique emphatique empirique encyclopedique endemique endocrine endogene endoscopique endothermique energetique energique enieme enigmatique enorme enthousiaste enviable envisageable enzymatique ephemere epidemiologique epidemique epidermique epigastrique epigenetique epileptique epique episodique epistolaire epouvantable equestre equitable equivoque erectile ergonomique erogene erotique erratique escamotable esclavagiste esclave esoterique espiegle esthetique estimable etanche etatique ethique ethnique ethylique etique etirable etrange etrusque eugenique euphorique evangelique evitable evolutionnaire evolutionniste excedentaire excentrique excusable execrable executable executoire exemplaire existentialiste exothermique exotique expeditionnaire expiatoire explicable explicite exploitable exploratoire expressionniste exsangue extatique extensible externe extralucide extraordinaire extrascolaire extraterrestre extravehiculaire extreme extremiste facile factice fadasse fade faible faillible faisable famelique fanatique fantaisiste fantasmagorique fantasmatique fantasque fantastique fantomatique farouche fasciste faste fastoche fataliste fatidique fauve favorable febrile feerique femelle feministe ferme feroce ferroviaire fertile fetichiste fetide fiable fidele fiduciaire filiforme filmique finaliste fissible fissile fixe flasque flegmatique flexible fluorhydrique folatre foldingue folklorique folliculaire fondamentaliste fongique forfaitaire formidable fortiche fossile fourbe fractionnaire fragile fragmentaire francophone frappadingue fratricide frele frenetique frequentable friable frigide frigorifique frivole fruste fugace fumasse fumigene funebre funeraire funeste futile futuriste gaelique galactique galvanique gargantuesque gastrique gastronomique gauche gauchiste gaulliste genealogique generaliste generique genetique genialissime genocidaire geodesique geographique geologique geomagnetique geometrique geopolitique geosynchrone geothermique gerable geriatrique germanique germanophone gestionnaire gigantesque gigogne glabre glaciaire glandulaire glauque globulaire glycemique gnostique godiche gonflable gore gothique grabataire gracile grandiose graphique graphologique grave gravimetrique gravissime gregaire grele greviste grisatre grotesque guatemalteque guerissable gynecologique habile habitable haissable hallucinatoire hallucinogene harmonique hebdomadaire hebraique hedoniste hellene hellenique hemeralope hemolytique hemophile hemorragique hemostatique hepatique herbivore hereditaire heretique hermaphrodite hermetique heroique heteroclite heterogene heuristique hierarchique hilare hippie hippique hirsute hispanique histologique holographique homeopathique homerique homicide hommasse homogene homonyme homophobe hongre honnete honorable honoraire honorifique horaire horrible horrifique hostile huitieme humaniste humanitaire humble humide humoriste humoristique hybride hydraulique hydrique hydrochlorique hydroelectrique hydrologique hydroponique hydrostatique hygienique hyoide hyperbare hyperbolique hypersensible hypertrophique hypnotique hypoallergenique hypocondriaque hypocrite hypodermique hypoglycemique hypothecaire hypothermique hypothetique hysterique iambique iberique iconique iconoclaste idealiste identifiable identique identitaire ideologique idiopathique idoine idyllique ignare ignifuge ignoble iliaque illegitime illicite illisible illogique illusoire illustre illustrissime imaginable imaginaire imbattable imbecile imberbe imbuvable immangeable immanquable immature immense immeuble immobile immonde immuable immunitaire impalpable imparable impardonnable impassible impayable impeccable impenetrable impensable imperceptible imperialiste imperissable impermeable imperturbable impie impitoyable implacable implicite impopulaire imposable impossible impraticable imprenable impressionnable impressionniste imprevisible improbable imprononcable impropre improuvable impudique imputable inabordable inacceptable inaccessible inadmissible inalienable inalterable inamovible inapplicable inapte inattaquable inatteignable inaudible inavouable incalculable incapable incassable incendiaire incollable incolore incommensurable incommode incomparable incompatible incomprehensible incompressible inconcevable inconciliable inconfortable inconsolable incontestable incontournable incontrolable incorrigible incorruptible incredule increvable incroyable inculte incurable indechiffrable indecrottable indefectible indefendable indefinissable indelebile indemne indeniable independantiste indescriptible indesirable indestructible indetectable indicible indigene indigeste indigne indiscernable indiscutable indispensable indisponible indissociable indissoluble individualiste indivisible indocile indolore indomptable indubitable inebranlable ineffable inefficace inegalable ineligible ineluctable inemployable inenvisageable inepte inepuisable inequitable inerte inestimable inevitable inexcusable inexorable inexplicable inexploitable inexprimable inextinguible inextricable infaillible infaisable infame infantile infatigable infertile infidele infime infirme inflammable inflammatoire inflexible influencable informatique informe infranchissable infrarouge infrequentable infroissable ingerable inhabitable inimaginable inimitable ininflammable inintelligible inique initiatique injectable injoignable injouable injuste injustifiable inlassable innombrable innommable inodore inoperable inorganique inoubliable inoxydable inqualifiable inratable insaisissable insalubre insane insatiable insecticide insensible inseparable insigne insipide insolite insoluble insolvable insomniaque insondable insoupconnable insoutenable instable insubmersible insulaire insupportable insurmontable intangible intarissable integre integriste intelligible intenable intense interchangeable interimaire intermediaire interminable interne interplanetaire interstellaire intime intimiste intolerable intouchable intraduisible intraitable intramusculaire intrepide intrinseque introuvable inusable inutile inutilisable invalide invariable invendable inverifiable inverse invincible inviolable invisible invivable involontaire invraisemblable invulnerable ionique irascible ironique irraisonnable irrealisable irrealiste irrecevable irreconciliable irrecuperable irreductible irrefutable irremediable irremplacable irreparable irrepressible irreprochable irresistible irrespirable irresponsable irreversible irrevocable irritable isabelle ischemique islamique islamiste isocele isolationniste isomere isometrique isotopique israelite italique ivre jacobite jaunatre jaune jetable jeune joignable jouable journalistique jubilatoire judaique judiciaire jugulaire jurassique juridique juste justifiable juvenile karmique kilometrique kurde kystique lache laconique lacrymogene lactique lacunaire laique lamentable large larvaire lavable laxiste legendaire legitime leste lethargique liberable libertaire libre licite lige limbique liminaire limpide lineaire linguistique liquide lisible lisse litteraire liturgique livide livresque logarithmique logique logistique lombaire loquace louable louche loufoque lourdingue lubrique lucide ludique lugubre lunaire lunatique lymphatique lyrique lysergique macabre machiavelique machiste maconnique macrobiotique macroscopique magique magnanime magnetique magnifique maigre maitrisable majoritaire majuscule malade malcommode male malefique malhabile malhonnete malingre malleable malpropre mammaire mandibulaire mandingue mangeable maniable maniaque manifeste manipulable maousse mapuche maritime marxiste masochiste mastoide masturbatoire materialiste mathematique mature maure mauresque maussade mauve maxillaire mecanique meconnaissable mediatique mediocre mediumnique medullaire megalomane melancolique melodique melodramatique memorable meprisable mercantile mercenaire merdique meritoire mesenterique mesozoique messianique mesurable metabolique metallique metallurgique metaphorique metaphysique metastatique meteorique meteorologique methodique methodiste metrique meuble microscopique mievre migratoire militaire militariste millenaire milliardaire millieme millionieme millionnaire mimetique minable mince mineralogique minimaliste minime minoritaire minuscule mirifique misanthrope miserable misogyne missionnaire mixte mnemonique mnemotechnique mobile moche moderne moderniste modeste modifiable modique modulaire moindre moite moldave moleculaire monastique monetaire mongoloide monochrome monogame monolithique monomaniaque monosyllabique monotheiste monotone morbide more morne morose morphologique mortuaire moscovite mousse multicolore multiforme multimilliardaire multimillionnaire multiple multitache musculaire mutagene mutique myope mystique mythique mythologique narcissique narcotique nase nationaliste naturaliste naturiste nautique navigable naze necessaire necrologique necrophile necrotique nefaste negligeable negociable negre negroide neolithique neurasthenique neurologique neuromusculaire neurotoxique neutre neutronique neuvieme nevralgique nevrotique nihiliste nitrique noble nocturne noiratre nomade nombriliste nordique nordiste nostalgique notable notoire nubile nucleaire nucleique nudiste nuisible nullissime numerique obese obligataire obligatoire oblique obscene observable obsolete occulte oceanique oceanographique octogenaire oculaire offshore olympique omnivore ondulatoire onirique ontologique onzieme opaque operable operatoire ophtalmique opiniatre opportuniste opposable optimiste optique orange oratoire orbitaire ordinaire organique orgasmique orgiaque originaire ornithologique orthodoxe orthographique orthopedique osmotique ostentatoire oubliable ouvrable ovale pacifique pacifiste paisible pale paleolithique palmaire palpable pancreatique panoramique papillaire parabolique paradisiaque parallele paralympique paralytique paramilitaire paranoiaque paranoide paraplegique parapsychologique parasitaire pardonnable parlementaire parodique parricide passable passible paternaliste pathetique pathogene pathologique patibulaire patraque patriote patriotique pauvre payable pecuniaire pedagogique pedestre pediatrique pedophile pendable penible penitentiaire pensable pepere perceptible peremptoire perenne perfectionniste perfide pericardique periodique peripherique periscolaire periscopique perissable permeable perpendiculaire perplexe perse persique perspicace pessimiste petrolifere phallique pharmaceutique pharmacologique philanthropique philharmonique philosophe philosophique phobique phonetique phonique photoelectrique photogenique photographique photosensible photovoltaique phreatique physiologique physique pietre pigmentaire pirate pire piscicole pitoyable pittoresque pituitaire placentaire placide planetaire plantaire plasmatique plastique plate platonique plausible pleutre pliable pneumonique poetique polaire polemique politique polygame polyglotte polymorphe polytechnique pompette populaire populiste pornographique portable portuaire possible posthume postiche postmoderne postoperatoire potable pourpre pragmatique praticable pratique prealable precaire precoce preferable prehensile prehistorique prejudiciable preliminaire premonitoire preoperatoire preparatoire presbyte prescolaire presentable presidentiable previsible primaire prime prioritaire probable probatoire probe problematique proche prodigue profane profitable programmable progressiste proletaire prolifique prolixe pronostique prophetique prophylactique propice propre prosaique prospere proteique protestataire prothetique protocolaire provisoire prude prussique psychanalytique psychedelique psychiatrique psychique psychologique psychopathique psychorigide psychosomatique psychotique psychotrope pubere publiable publicitaire pudique pugnace pulmonaire pulsatile punissable pupillaire pusillanime putride pyroclastique pyrotechnique quadruple quantifiable quantique quarantenaire quatorzieme quatrieme quelconque quetaine quintuple quinzieme quitte rabbinique rachitique raciste racontable radiculaire radiologique radiophonique raide raisonnable rance rapace rapide rare rarissime rauque reactionnaire realisable realiste rebelle recevable rechargeable reche recidiviste reciproque recommandable reconnaissable rectangulaire rectiligne recuperable recyclable redevable redhibitoire redoutable reflexe reformiste refractaire regardable reglable reglementaire regrettable relativiste remarquable remboursable remplacable renouvelable rentable reparable reperable reprehensible respectable respirable respiratoire responsable retardataire reticulaire retractable retrograde reveche reversible revisionniste revolutionnaire rhetorique riche richissime ridicule rigide risible robuste rocambolesque rogatoire rogue romanesque romantique rosatre rose rosse rouge rougeatre rude rudimentaire runique rupestre russe rustique rustre rythmique sabbatique sacrilege sadique sadomasochiste sagace sage salace sale salivaire salubre salutaire sanguinaire sanitaire saoudite saphique sarcastique sarde sardonique satanique sataniste satellitaire satirique saumatre sauvage scandinave scaphoide scatologique scenique sceptique schematique schizophrenique sciatique scientifique scientiste scolaire secondaire secourable seculaire securitaire sedentaire sedimentaire seizieme semblable semite senile sensible separatiste septieme septique serbe serenissime serviable servile severe sexiste siderurgique signaletique simiesque similaire simple simpliste sincere sinistre sioniste sismique sixieme slave slovaque sobre sociable socialiste sociologique socratique sodique soignable solaire solidaire solide solitaire soluble solvable somatique sombre sommaire somnifere sonique sonore soporifique sordide sortable souhaitable souple sovietique spartiate spasmodique specifique spectaculaire spherique splendide sporadique squelettique stable stagiaire stationnaire statique statistique statutaire stellaire stereophonique sterile steroide stoique stone strategique stroboscopique stupide suave subalterne subatomique sublime submersible subsidiaire subsonique sudoripare suicidaire suisse sulfurique superbe supersonique supplementaire supportable supreme surrealiste susceptible svelte sylvestre symbiotique symbolique symetrique sympathique symphonique symptomatique synaptique synchrone syndicaliste synonyme syntaxique synthetique syphilitique systematique systemique systolique tacite taciturne tactile tactique talmudique tangible tannique tantrique taoiste tartare tarte tatare tchecoslovaque tcheque technique technologique tectonique telechargeable telegenique telegraphique telemetrique telepathique telephonique telescopique tellurique temeraire temporaire tenable tenace tendre tentaculaire terne terrestre terrible terrigene terroriste tertiaire testamentaire testiculaire tetraplegique teutonique textile thematique theologique theorique therapeutique thermique thermonucleaire thoracique thrace tiede timide tissulaire titanesque titulaire tokyoite tolerable tonique topographique torride torve totalitaire touristique toxicologique toxique tracable traditionaliste traduisible tragique traitable tranquille transatlantique transferable transgenique transitoire translucide transmissible transportable transverse traumatique travailliste treizieme trentenaire trentieme triangulaire tributaire tricolore tricuspide trigonometrique triple trisomique triste troisieme tropique trouvable tsariste tsigane tubulaire typique typographique tyrannique tzigane ulnaire ultime ultramoderne ultrasensible ultrasonique unanime unicellulaire unieme uniforme unique unisexe unitaire universitaire urinaire urique usuraire utile utilisable utilitaire utopique vache vague valable valide vampirique vandale variable vasculaire vaste veloce vendable venerable ventriculaire verdatre veridique verifiable veritable vernaculaire versatile vesiculaire vestimentaire veterinaire vetuste veule viable vibratoire vide vierge vigile vingtieme vinicole visible visionnaire viticole vivable vivace volage volatile volcanique volontaire volubile vorace vraisemblable vulgaire vulnerable xenophobe xiphoide yemenite yougoslave zoologique zoophile zygomatique').split(' ').forEach(function(w){_EPICENE_ADJ[w]=1;});   // LISTE CLOSE (déacc) d'adjectifs ÉPICÈNES — miroir exact du Python (dérivée Lexique4 via build_epicene.py, genre=='e' ∪ hand-list). -s pluriel MUET → accord de NOMBRE audible-safe. FP=0 sur 14450+2500.
  function rAdjNumber(T,i){var w=T[i],lw=w.toLowerCase(),d=deacc(lw);   // accord de NOMBRE de l'épithète ÉPICÈNE après déterminant PLURIEL (« les contrats fragile »→fragiles). Épicène + liste close → jamais de flip de genre ni de nom/verbe. -s muet = audible-safe.
    if(lw.indexOf("'")>=0||w.charAt(0)!==w.charAt(0).toLowerCase())return null;
    if(!_EPICENE_ADJ[d])return null;
    if(i<2||!PLURAL_DET[deacc(T[i-2].toLowerCase())])return null;
    var tg=posTags(T);if(!tg||i>=tg.length||tg[i]!=='ADJ'||tg[i-1]!=='NOUN')return null;
    // garde svReads retirée : tagger ADJ + _EPICENE_ADJ (adjectif connu) tranchent l'homographe verbal → +s muet reste juste
    var nx=(i+1<T.length)?deacc(T[i+1].toLowerCase()):'';
    if(nx==='de'||nx==='et'||nx==='ou'||nx==='ni'||nx==='que')return null;if(_SEG&&(i+1)<_SEG.bb.length&&_SEG.bb[i+1])return null;            // locution figée / coordination distributive
    if(i>=3&&(deacc(T[i-2].toLowerCase())==='des'||deacc(T[i-2].toLowerCase())==='aux')&&(tg[i-3]==='NOUN'||tg[i-3]==='PROPN'))return null;   // « N des N adj » : l'adj porte sur la tête
    return ckeepcase(w,w+'s');}
  var _FEM_SG_DET={une:1,la:1,cette:1,sa:1,ma:1,ta:1};
  var _GUERE_DET={la:1,une:1,cette:1,sa:1,ma:1,ta:1,notre:1,votre:1,leur:1,en:1};
  function rGuere(T,i){
    // « pendant la guère » → guerre (enquête des 22, texte2 dys réel) : « guère » est un ADVERBE —
    // précédé d'un déterminant (ou de « en »), c'est toujours le NOM guerre. Miroir Python.
    if(deacc(T[i].toLowerCase())!=='guere')return null;
    if(i===0||!_GUERE_DET[deacc(T[i-1].toLowerCase())])return null;
    return ckeepcase(T[i],'guerre');}
  var _AUXSG={taux:1,chaux:1,faux:1,aux:1};
  var _ADJINV={marron:1,orange:1,kaki:1,turquoise:1,creme:1,prune:1,cerise:1,olive:1,moutarde:1,pastel:1,bordeaux:1,marine:1,design:1,standard:1,record:1,bidon:1,chic:1,choc:1,hardcore:1,rock:1,punk:1,pop:1,jazz:1,folk:1,metal:1,techno:1,disco:1,vintage:1,light:1,live:1,open:1,offshore:1,online:1,quel:1,quelle:1,quels:1,quelles:1};   // + anglicismes invariables et interrogatifs (flood différentiel)
  function rAdjAux(T,i){
    // « de petit tuyaux souterrain » → petits/souterrains (enquête des 22, texte1 dys réel) :
    // un nom en -aux/-eaux est un pluriel NON-AMBIGU (hors taux/chaux/faux) — l'adjectif ADJACENT
    // au singulier est désaccordé. Tagger ADJ+NOUN, frontière _SEG, invariables exclus,
    // candidat vérifié au lexique. Miroir Python.
    var w=T[i],lw=w.toLowerCase();
    if(lw.indexOf("'")>=0||w.charAt(0)!==w.charAt(0).toLowerCase()||lw.length<3)return null;
    var lc=lw.charAt(lw.length-1);if(lc==='s'||lc==='x'||lc==='z')return null;
    if(_ADJINV[deacc(lw)])return null;
    var tg=posTags(T);if(!tg||i>=tg.length||tg[i]!=='ADJ')return null;
    var v=-1;
    for(var q=0;q<2;q++){var j=q===0?i-1:i+1;
      if(j<0||j>=T.length)continue;
      var vw=T[j],dv=deacc(vw.toLowerCase());
      if(vw.charAt(0)!==vw.charAt(0).toLowerCase())continue;
      if(!/aux$/.test(dv)||dv.length<4||_AUXSG[dv])continue;
      if(j>=tg.length||tg[j]!=='NOUN')continue;
      if(_SEG){var a=Math.min(i,j),b=Math.max(i,j),coupe=false;
        for(var m=a+1;m<=b&&m<_SEG.bb.length;m++)if(_SEG.bb[m])coupe=true;
        if(coupe)continue;}
      if(j===i-1&&j>=2){var _dprec=deacc(T[j-1].toLowerCase());if(_dprec==='de'||_dprec==="d'"||_dprec==='des'||_dprec==='du')continue;}   // « le nombre DE niveaux total » : l'adj postposé modifie la TÊTE (flood)
      v=j;break;}
    if(v<0)return null;
    var cands=[lw+'s',lw+'x'];
    for(var c=0;c<2;c++){if(SP&&SP.ready&&SP.WORDS&&SP.WORDS.has(cands[c]))return ckeepcase(w,cands[c]);}
    return null;}
  function rSaVit(T,i){
    // « sa vit » → sa vie (enquête des 22, texte5) : possessif fém. + forme uniquement verbale =
    // le nom homophone. « il la vit partir » : LA exclu (pronom objet + passé simple). Miroir Python.
    if(deacc(T[i].toLowerCase())!=='vit')return null;
    if(i===0)return null;var p=deacc(T[i-1].toLowerCase());
    if(p!=='sa'&&p!=='ma'&&p!=='ta')return null;
    return ckeepcase(T[i],'vie');}
  /* PARTICIPE PRÉSENT après « en » (03/09/2026) : « tout en pensent a bronzer » → pensant, « En rentrent de vacance » → rentrant.
     « en » y est la préposition du gérondif : après « tout », ou en tête de segment. Ailleurs « en » est un clitique
     (« ils en pensent du bien ») et on se tait. Verbes du 1er groupe seulement (forme finie → lemme -er → -ant), orange. */
  function gerondifVig(T,i){if(!CONJ_F||i<1)return null;var w=T[i],lw=w.toLowerCase();if(lw.indexOf("'")>=0||!/^[a-zà-ÿ]+$/.test(lw))return null;
    if(deacc(T[i-1].toLowerCase())!=='en')return null;var p2=(i>=2)?deacc(T[i-2].toLowerCase()):'';
    var initial=(i-1===0)||(_SEG&&i-1<_SEG.bb.length&&_SEG.bb[i-1]);if(!initial&&p2!=='tout')return null;
    if(w.charAt(0)!==lw.charAt(0))return null;                                          /* « En Écosse » : nom propre */
    if(_SEG&&_SEG.dig&&i<_SEG.dig.length&&_SEG.dig[i])return null;                      /* « en 1659, confirme » : le tokeniseur a mangé le nombre */
    var _npg=NOUN_POST?(typeof NOUN_POST.get==='function'?NOUN_POST.get(deacc(lw)):NOUN_POST[deacc(lw)]):null;if(_npg&&_npg[0]>=100)return null;   /* « En seconde », « en tête », « en date » : noms homographes */
    var r=svReads(w);if(!r.length)return null;var lem=null,k,okT=false;for(k=0;k<r.length;k++){if(lem&&lem!==r[k][0])return null;lem=r[k][0];var md=r[k][1].split(':');if((md[0]==='ind')&&(md[1]==='pre'||md[1]==='imp'))okT=true;}
    if(!okT)return null;                                                                   /* présent/imparfait seulement : « En découleront » (futur) est une inversion correcte */
    if(!lem||!/er$/.test(lem)||lem==='aller')return null;if(/(ant|ent)$/.test(deacc(lw))&&!/ent$/.test(lw))return null;
    return ckeepcase(w,lem.slice(0,-2)+'ant');}
  function sestPpVig(T,i){
    /* ORANGE « elle s'est marié » → mariée ? (enquête des 22, texte3 : c'est→s'est corrigé en
       cascade mais l'accord ne suivait pas). PRONOMINAL = zone à pièges, donc JAMAIS rouge :
       COI invariables (dit/permis/demandé/imaginé…), participe+INFINITIF invariable (« s'est vu
       confier »), COD postposé invariable (« s'est acheté une robe ») → gardes fermées. */
    var w=T[i],lw=w.toLowerCase();
    if(lw.indexOf("'")>=0||w.charAt(0)!==w.charAt(0).toLowerCase())return null;
    if(i<2)return null;
    /* FORME FINIE après « s'est » (03/09/2026) : « elle s'est mariaient » → mariée. Le scripteur a conjugué là où il fallait le
       participe. 1er groupe seulement, lemme unique, sujet elle/il juste avant (négation enjambée), orange. */
    if(CONJ_F&&deacc(T[i-1].toLowerCase())==="s'est"&&!_isPpl(w)&&_isFinite(w)){var _rf=svReads(w),_lm=null,_k;for(_k=0;_k<_rf.length;_k++){if(_lm&&_lm!==_rf[_k][0]){_lm=null;break;}_lm=_rf[_k][0];}
      var _s2=deacc(T[i-2].toLowerCase());if((_s2==='ne'||_s2==="n'")&&i>=3)_s2=deacc(T[i-3].toLowerCase());
      if(_lm&&/er$/.test(_lm)&&(_s2==='elle'||_s2==='il'))return ckeepcase(w,_lm.slice(0,-2)+(_s2==='elle'?'ée':'é'));}
    var lc=lw.charAt(lw.length-1);if(lc!=='é'&&lc!=='i'&&lc!=='u')return null;
    if(!_isPpl(w))return null;
    var _pv1=deacc(T[i-1].toLowerCase());
    if(_pv1!=="s'est"&&_pv1!=="c'est")return null;   // « elle C'EST marié » (texte3) : la vigilance tourne AVANT la cascade c'est→s'est — le cadre l'accepte (jamais présent sur du correct)
    var p2=deacc(T[i-2].toLowerCase());if((p2==='ne'||p2==="n'")&&i>=3)p2=deacc(T[i-3].toLowerCase());
    if(p2!=='elle')return null;
    var d=deacc(lw);
    if(d==='dit'||d==='fait'||d==='vu'||d==='rendu'||d==='laisse'||d==='demande'||d==='imagine'||d==='jure'||d==='donne')return null;   // + se donner (COD postposé idiomatique : « s'est donné jusqu'à mi-août » — flood)
    var nx=(i+1<T.length)?deacc(T[i+1].toLowerCase()):'';
    if(nx==='compte')return null;
    if(nx&&/er$/.test(nx)&&CONJ_C[nx])return null;
    if(nx==='une'||nx==='la'||nx==='le'||nx==='les'||nx==='un'||nx==='des'||nx==='du'||nx==='son'||nx==='sa'||nx==='ses'||nx==='leur'||nx==='leurs'||nx==='de'||nx==="d'")return null;
    var tgt=_ppAccord(lw,'s','f');if(!tgt||tgt===lw)return null;
    return ckeepcase(w,tgt);}
  /* ORANGE « je fini », « tu mange », « tu a » — LA PERSONNE DU VERBE (26/08/2026).
     Trou trouvé par le crible des explications : rien ne se déclenchait sur « Il faut que tu fini ».
     Mesuré avant portage : 0 FP sur les 25 752 formes CORRECTES de la table (5 926 lemmes), 0 sur les
     2 500 phrases UD, et 10 vraies fautes attrapées sur 139 occurrences de je/tu du corpus dys réel
     (tu a→as ×4, je sui→suis, je vai→vais ×2, tu revien→reviens, tu refuse→refuses, me permet→permets).
     ⭐ AUTORITÉ = CONJ_C (lemme→temps→slot→forme), JAMAIS CONJ_F seule : la table des lectures porte
     315 incohérences sur 71 566, dont « as » déclaré 1re personne — sans cette précaution la règle
     proposait « je as ». Deux autres gardes nées de FP mesurés : le mot examiné ne doit pas être un
     CLITIQUE (« je lui » → « je luis », seul FP du corpus UD), et une forme conjuguée juste avant le
     pronom signale une INVERSION (« as-tu mange » → aurait proposé « manges »). */
  var _PERS_SUBJ=/^(faut|faille|fallait|veux|veut|voulons|voulez|veulent|souhaite|souhaites|desire|exige|doute|doutes|aimerais|voudrais|permets|permet|interdit|empeche|avant|bien|pour|afin|quoique|jusqu|sans)$/;
  function _persSlot(lem,t,s){var v=((CONJ_C[lem]||{})[t]||{})[s];return v?deacc(v.toLowerCase()):null;}
  /* ORANGE « je vais mange », « je dois fini » — L'INFINITIF APRÈS UN SEMI-AUXILIAIRE (26/08/2026).
     Second trou trouvé par le crible. Mesuré avant portage : 0 FP sur les 35 556 couples
     semi-auxiliaire + infinitif CORRECT, 0 sur les 2 500 phrases UD, 1 vraie prise sur le corpus
     dys réel (« va te la raconté » → raconter).
     ⭐ Trois gardes, chacune née d'un FP MESURÉ, pas d'une intuition :
       · `compte` a été RETIRÉ des semi-auxiliaires (« le réseau compte 20 routes » → router) : un
         verbe qui prend un objet direct n'a rien à faire dans cette liste ;
       · la désaccentuation rend « à » homographe de « a » → « peut à tout moment » proposait
         « avoir » ; d'où la liste fermée de mots-outils ;
       · le participe se rejoint par sa forme en -s (« fini » → « finis » → finir), mais cette route
         attrapait « peuvent par » → partir : prépositions et adverbes courants fermés aussi. */
  var _FAIRE_SEMI={fais:1,fait:1,faisons:1,faites:1,font:1,fit:1,firent:1,faisait:1,faisaient:1,fera:1,feront:1,ferait:1,feraient:1};
  var _SEMI_AUX={fais:1,fait:1,faisons:1,faites:1,font:1,fit:1,firent:1,faisait:1,faisaient:1,fera:1,feront:1,ferait:1,feraient:1,   /* faire + infinitif (« le fit ramenais » → ramener, 03/09/2026) */
    vais:1,vas:1,va:1,allons:1,allez:1,vont:1,allais:1,allait:1,allions:1,alliez:1,allaient:1,
    irai:1,iras:1,ira:1,irons:1,irez:1,iront:1,veux:1,veut:1,voulons:1,voulez:1,veulent:1,voulais:1,voulait:1,
    voulions:1,vouliez:1,voulaient:1,voudrais:1,voudrait:1,voudrions:1,dois:1,doit:1,devons:1,devez:1,doivent:1,
    devais:1,devait:1,devions:1,deviez:1,devaient:1,devrai:1,devra:1,devrons:1,peux:1,peut:1,pouvons:1,pouvez:1,
    peuvent:1,pouvais:1,pouvait:1,pouvions:1,pouviez:1,pouvaient:1,pourrai:1,pourra:1,pourrons:1,
    /* ⛔ SAVOIR RETIRÉ (26/08/2026) : « sait » est bien plus souvent un « s'est » mal écrit qu'un
       semi-auxiliaire. « Le train sait arrete en gare » recevait « sait arrêter » — une
       proposition FAUSSE sur une vraie faute. Et « je sais nager » n'avait jamais besoin de la
       règle : l'infinitif y est déjà correct. Miroir Python _SEMI_AUX. */
    faut:1,fallait:1,faudra:1,faudrait:1};
  var _INF_OUTILS={a:1,'à':1,en:1,y:1,de:1,du:1,des:1,le:1,la:1,les:1,ce:1,se:1,ne:1,que:1,qui:1,si:1,ou:1,
    'où':1,et:1,est:1,par:1,pour:1,sans:1,sous:1,sur:1,vers:1,dans:1,chez:1,avec:1,entre:1,contre:1,depuis:1,
    apres:1,avant:1,plus:1,moins:1,tout:1,tous:1,bien:1,mieux:1,trop:1,puis:1,donc:1,alors:1,ainsi:1,aussi:1,
    encore:1,jamais:1,toujours:1};
  /* ORANGE « Les enfants on mange » → ont (26/08/2026). Troisième trou trouvé par le crible.
     ⚠️ LE PLUS DANGEREUX DES TROIS, et la première version était MAUVAISE : « un GN pluriel plus
     haut dans la phrase » donnait 3 FP sur 4 déclenchements du corpus dys réel — « dans ses
     statistiques on voit », « entre amis on a mangé » sont du français CORRECT. Trois gardes, toutes
     nées d'un FP mesuré :
       · le déterminant pluriel doit être le SUJET : collé (det + nom + « on »), pas plus loin ;
       · il ne doit PAS être introduit par une préposition (« dans ses statistiques… ») ;
       · aucune FRONTIÈRE entre lui et « on » — le tokeniseur jette la ponctuation, donc on lit
         `_SEG.bb`, sans quoi « Les enfants, on mange ! » (apostrophe) et « des juristes (on disait
         alors…) » (parenthèse, seul FP restant sur UD) se déclenchaient.
     Après gardes : 0 FP sur 2 500 phrases UD, 0 sur le corpus dys réel, 1 vraie prise
     (« des écologiste qui on montrais » → ont). */
  var _ON_DETPL={les:1,des:1,ces:1,mes:1,tes:1,ses:1,nos:1,vos:1,leurs:1,plusieurs:1,certains:1,certaines:1,quelques:1};
  var _ON_PREP={de:1,du:1,des:1,dans:1,en:1,sur:1,sous:1,avec:1,entre:1,par:1,pour:1,chez:1,vers:1,'à':1,a:1,
    sans:1,depuis:1,selon:1,parmi:1,contre:1,malgre:1,pendant:1};
  var _ON_CLIT={le:1,la:1,les:1,lui:1,leur:1,y:1,en:1,me:1,te:1,se:1,nous:1,vous:1,l:1,m:1,t:1,s:1,ne:1,n:1};
  var _ON_REL={ou:1,dont:1,que:1,qu:1};   // relatifs qui ouvrent une proposition à sujet « on »
  function onOntVig(T,i){
    if(deacc(String(T[i]||'').toLowerCase())!=='on')return null;
    if(!_SEG||_SEG.bb[i])return null;                       // frontière juste avant « on » → apostrophe/incise
    var nx=deacc(String(T[i+1]||'').toLowerCase());
    if(!nx||_ON_CLIT[nx])return null;                       // « Le chat on le voit » est correct
    if(!CONJ_F||(!CONJ_F[nx]&&!CONJ_F[nx+'s']))return null; // le mot d'après doit être un verbe
    /* ⭐ RELATIVE : « où » et « dont » ouvrent une proposition dont « on » est le SUJET —
       « les endroits où on va », « les auteurs dont on cite les livres » sont CORRECTS (2 FP trouvés
       par la batterie de PARITÉ). `qui` reste HORS liste : « qui on montrais » est une vraie faute. */
    var d=-1,j;
    for(j=i-1;j>=0&&j>=i-3;j--){
      if(_SEG.bb[j+1]&&j+1<=i)return null;                  // une frontière s'est glissée entre les deux
      if(_ON_REL[deacc(String(T[j]).toLowerCase()).replace(/['’]$/,'')])return null;
      if(_ON_DETPL[deacc(String(T[j]).toLowerCase())]){d=j;break;}}
    if(d<0||d===i-1)return null;                            // il faut un NOM entre le déterminant et « on »
    if(d>0&&(_ON_PREP[deacc(String(T[d-1]).toLowerCase())]||_PREP_SUJ_EXT[deacc(String(T[d-1]).toLowerCase())]))return null;   // « SELON les experts on peut » : préposition hors liste (même garde que _plurSousPrep, 31/08)
    return 'ont';}
  function semiInfVig(T,i){
    if(!CONJ_F)return null;
    var w=T[i];if(!w)return null;
    var lw=deacc(w.toLowerCase());
    if(!/^[a-z'-]+$/.test(lw)||CLITIC[lw])return null;
    if(_INF_OUTILS[lw]||_INF_OUTILS[w.toLowerCase()])return null;
    var j=i-1,st=0;
    while(j>=0&&st<3&&CLITIC[deacc(T[j].toLowerCase())]){j--;st++;}
    if(j<0||!_SEMI_AUX[deacc(T[j].toLowerCase())])return null;
    /* « faire » : « fait référence », « fait date », « fait la fête » — le mot qui suit est un NOM homographe d'une forme verbale.
       Pour ce gouverneur-là, on exige un verbe PUR : posterior nom (noun-post) < 100 ‰, sinon on se tait (03/09/2026). */
    if(_FAIRE_SEMI[deacc(T[j].toLowerCase())]){var _npx=NOUN_POST?(typeof NOUN_POST.get==='function'?NOUN_POST.get(lw):NOUN_POST[lw]):null;if(_npx&&_npx[0]>=100)return null;}
    /* ⭐ le semi-auxiliaire est-il DANS une relative ? « les endroits où on va coûte cher » : « va »
       ferme la relative, « coûte » est le verbe de la principale — ce n'est pas un infinitif attendu.
       FP trouvé par la batterie de PARITÉ. « que » reste HORS liste (« je crois que je vais mange »
       est une vraie faute qu'on veut garder). */
    var _r;
    for(_r=j-1;_r>=0&&_r>=j-3;_r--){var _rw=deacc(T[_r].toLowerCase());
      if(_rw==='ou'||_rw==='dont')return null;}
    var rw=(CONJ_F[lw]||'').split('|');
    if(!CONJ_F[lw])rw=(CONJ_F[lw+'s']||'').split('|');   // le participe passe par sa forme en -s
    if(!rw.length||!rw[0])return null;
    var out=null,m,a;
    for(m=0;m<rw.length;m++){a=rw[m].split(';');
      if(a.length!==4)continue;
      if(deacc(a[0].toLowerCase())===lw)return null;     // c'est DÉJÀ l'infinitif
      if(out&&out!==a[0])return null;                    // plusieurs lemmes → abstention
      out=a[0];}
    return out;}
  function persVig(T,i){
    if(!CONJ_F||!CONJ_C)return null;
    var w=T[i];if(!w)return null;
    var lw=deacc(w.toLowerCase());
    if(!/^[a-z']+$/.test(lw))return null;
    if(CLITIC[lw])return null;                                   // « je lui » n'est pas « je luis »
    var j=i-1,st=0;
    while(j>=0&&st<3&&CLITIC[deacc(T[j].toLowerCase())]){j--;st++;}
    if(j<0)return null;
    var p=deacc(T[j].toLowerCase());
    var per=(p==='je')?'1':((p==='tu')?'2':null);
    if(!per)return null;
    if(j>0){var av=deacc(T[j-1].toLowerCase());
      if(NUM_DET[av])return null;                                // « le je », « le tu » : pas un sujet
      if(CONJ_F[av])return null;}                                // forme conjuguée avant = INVERSION
    var sub=false;
    if(j>0&&/^(que|qu)$/.test(deacc(T[j-1].toLowerCase()).replace(/['’]$/,''))){
      for(var k=j-2;k>=0&&k>=j-5;k--)if(_PERS_SUBJ.test(deacc(T[k].toLowerCase()))){sub=true;break;}}
    var temps=sub?'sub:pre':'ind:pre',r,a,m;
    var rw=(CONJ_F[lw]||'').split('|');
    for(m=0;m<rw.length;m++){a=rw[m].split(';');
      if(a.length===4&&_persSlot(a[0],a[1],per+'s')===lw)return null;}   // déjà juste à cette personne
    var cand=lw+'s',rc=(CONJ_F[cand]||'').split('|'),out=null;
    if(!CONJ_F[cand])return null;
    for(m=0;m<rc.length;m++){a=rc[m].split(';');
      if(a.length!==4||a[3]!=='s'||a[2]!==per)continue;
      if(_persSlot(a[0],a[1],per+'s')!==cand)continue;            // lecture incohérente : ignorée
      var vrai=((CONJ_C[a[0]]||{})[temps]||{})[per+'s']||((CONJ_C[a[0]]||{})[a[1]]||{})[per+'s'];
      if(!vrai)continue;
      if(out&&out!==vrai)return null;                            // deux lemmes en désaccord → abstention
      out=vrai;}
    return (out&&deacc(out.toLowerCase())!==lw)?out:null;}
  function jInfVig(T,i){
    /* ORANGE « J'aimer beaucoup » (enquête des 22, texte6) : j' + INFINITIF -er n'est jamais
       valide (l'élision exige une forme conjuguée) ; le TEMPS voulu est inconnu (gold imparfait)
       → orange avec le présent 1s comme direction, jamais imposée. */
    var w=T[i],lw=w.toLowerCase();
    if(!/^j['’]/.test(lw))return null;
    var reste=deacc(lw.slice(2));
    if(reste.length<4||!/er$/.test(reste)||!CONJ_C[reste])return null;
    var slots=(CONJ_C[reste]||{})['ind:pre'];var p1=slots&&slots['1s'];if(!p1)return null;
    return /^[aeiouhéèê]/.test(p1)?(w.slice(0,2)+p1):((w.charAt(0)==='J'?'Je ':'je ')+p1);}
  var _QUI_PRON_CONS={je:1,tu:1};   // PAS nous/vous : clitiques OBJET (« qui vous accueille », « qui nous permet » — FP lus au flood)
  function rQuiQue(T,i){
    // « le film qui j'ai vu » → que (croisement Excuse My French) : un relatif SUJET ne précède jamais un
    // autre sujet. v1 = pronoms à consonne + j' ; « qui il »→qu'il vit dans l'élision-espace du speller.
    // Gardes : pas de préposition avant qui (« avec qui il » : 46/46 cas corrects), antécédent NOM. Miroir Python.
    if(deacc(T[i].toLowerCase())!=='qui'||i<1||i+1>=T.length)return null;
    var nx=T[i+1].toLowerCase().replace(/\u2019/g,"'");
    if(!(_QUI_PRON_CONS[deacc(nx)]||nx.indexOf("j'")===0))return null;
    var p=deacc(T[i-1].toLowerCase());
    if(T[i-1].indexOf("'")>=0||PREP[p]||p==='ce'||p==='celui'||p==='celle'||p==='ceux'||p==='celles'||p==='et'||p==='ou'||p==='ni'||p==='mais')return null;
    var tg=posTags(T);if(!tg||i-1>=tg.length||(tg[i-1]!=='NOUN'&&tg[i-1]!=='PROPN'))return null;
    return ckeepcase(T[i],'que');}
  function rAiAit(T,i){
    // « hier il mangeai une pomme » → mangeait (croisement EMF) : il/elle/on + forme en -ai = toujours -ait
    // (le /ɛ/ entendu). Exclut -rai (futur 1s). 0 occurrence du cadre sur 16 950 correctes. Miroir Python.
    var w=T[i],lw=w.toLowerCase();
    if(lw.indexOf("'")>=0||w.charAt(0)!==w.charAt(0).toLowerCase()||lw.length<5)return null;
    if(!/ai$/.test(lw)||/rai$/.test(lw))return null;
    if(i<1)return null;
    var _kai=i-1,p=deacc(T[_kai].toLowerCase());if((p==='ne'||p==="n'")&&i>=2){_kai=i-2;p=deacc(T[_kai].toLowerCase());}
    var _mai=_ELIDED_PRON.exec(T[_kai].toLowerCase());if(_mai)p=deacc(_mai[1]);   // « puisqu'il mangeai » : le sujet vit dans le token élidé (miroir Python)
    if(p!=='il'&&p!=='elle'&&p!=='on')return null;
    var cible=lw.slice(0,-2)+'ait',rd=svReads(cible),ok=false;
    for(var k=0;k<rd.length;k++)if(rd[k][1].indexOf('ind:imp')===0&&rd[k][2]==='3')ok=true;
    if(!ok)return null;
    if(!(SP&&SP.ready&&SP.WORDS&&/V/.test(SP.POS[lw]||''))&&!CONJ_C[deacc(lw.slice(0,-2))+'er'])return null;
    return ckeepcase(w,cible);}
  function _verbeFini(lw){var rd=svReads(lw);for(var k=0;k<rd.length;k++){var mt=rd[k][1]||'';if(mt.indexOf('ind')===0||mt.indexOf('cnd')===0||mt.indexOf('sub')===0)return true;}return false;}
  function rPpEpithetFem(T,i){var w=T[i],lw=w.toLowerCase();
    // sœur SINGULIER-FÉMININ de rPpEpithetNum (audit rappel dys PR#505 : « une femme cultivé » ×3) — mêmes
    // gardes + « fois » (« une fois emprisonné, Michael… » : l'accord suit le sujet), coordination dans le GN
    // (« un exercice ou une devinette proposé » : accord de proximité litigieux) et ADP GÉNÉRALISÉE en i-3
    // (« le sommet SUR la biodiversité organisé », « PAR la suite condamné » : la tête est au-delà du GN).
    // Flood 16 950 phrases correctes : 3 tirs, TOUS de vraies fautes du corpus (patinoire situé, postérité
    // laissé, émission diffusé). Marques MUETTES seulement (é→ée, i→ie : homophones), doctrine d'audibilité.
    if(lw.indexOf("'")>=0||w.charAt(0)!==w.charAt(0).toLowerCase())return null;
    var _lc=lw.charAt(lw.length-1);if((_lc!=='é'&&_lc!=='i')||!_isPpl(w))return null;
    if(i<2||!_FEM_SG_DET[deacc(T[i-2].toLowerCase())])return null;
    if(deacc(T[i-1].toLowerCase())==='fois')return null;
    var tg=posTags(T);if(!tg||i>=tg.length||(tg[i]!=='VERB'&&tg[i]!=='ADJ')||tg[i-1]!=='NOUN')return null;
    if(_SEG&&i<_SEG.bb.length&&_SEG.bb[i])return null;
    // (pas de garde APRÈS, contrairement à la plurielle : « une femme cultivé, bienveillante » — l'accord
    // vaut devant la virgule ; re-flood sans la garde : toujours 3 tirs, tous de vraies fautes)
    var nx=(i+1<T.length)?deacc(T[i+1].toLowerCase()):'';
    if(nx==='de'||nx==='ou'||nx==='ni'||nx==='que')return null;
    if(nx==='et'){
      // ENQUÊTE DES 22 : lever l'abstention-coordination SEULEMENT si la sœur est DÉJÀ marquée
      // féminin (« cultivé et [bien] veillante ») — les couleurs composées restent protégées.
      var jj=i+2;while(jj<T.length&&jj<=i+3&&{bien:1,mal:1,tres:1,tout:1,si:1,plus:1,toujours:1}[deacc(T[jj].toLowerCase())])jj++;
      var okS=false;
      if(jj<T.length){var sd=T[jj].toLowerCase(),sufs=['ée','ante','ente','euse','ive','elle','ère','ienne'];
        for(var sq=0;sq<sufs.length;sq++){if(sd.length>=sufs[sq].length&&sd.slice(-sufs[sq].length)===sufs[sq]){okS=true;break;}}}
      if(!okS)return null;}
    for(var k=Math.max(0,i-5);k<i-1;k++){var dk=deacc(T[k].toLowerCase());if(dk==='ou'||dk==='et'||dk==='ni')return null;}
    if(i>=3&&tg[i-3]==='ADP')return null;
    var g=_nounGender(T[i-1],'s',true);if(g!=='f')return null;
    var tgt=_ppAccord(lw,'s','f');return tgt!==lw?ckeepcase(w,tgt):null;}
  function rPpEpithetNum(T,i){var w=T[i],lw=w.toLowerCase();
    if(lw.indexOf("'")>=0||w.charAt(0)!==w.charAt(0).toLowerCase())return null;
    var _lc=lw.charAt(lw.length-1);if((_lc!=='é'&&_lc!=='i')||!(_isPpl(w)||_isPplWideEr(w)))return null;
    if(i<2||!PLURAL_DET[deacc(T[i-2].toLowerCase())])return null;
    var tg=posTags(T);if(!tg||i>=tg.length||(tg[i]!=='VERB'&&tg[i]!=='ADJ')||tg[i-1]!=='NOUN')return null;
    if(_SEG&&i<_SEG.bb.length&&_SEG.bb[i])return null;
    if(_SEG&&(i+1)<_SEG.bb.length&&_SEG.bb[i+1])return null;
    var nx=(i+1<T.length)?deacc(T[i+1].toLowerCase()):'';
    if(nx==='de'||nx==='et'||nx==='ou'||nx==='ni'||nx==='que')return null;
    if(i>=3&&(deacc(T[i-3].toLowerCase())==='de'||deacc(T[i-3].toLowerCase())==="d'")&&tg[i-3]==='ADP')return null;
    if(i>=3&&(deacc(T[i-2].toLowerCase())==='des'||deacc(T[i-2].toLowerCase())==='aux')&&(tg[i-3]==='NOUN'||tg[i-3]==='PROPN'))return null;
    var g=_nounGender(T[i-1],'p',true);if(g!=='m'&&g!=='f')return null;
    var tgt=_ppAccord(lw,'p',g);return tgt!==lw?ckeepcase(w,tgt):null;}
  function rAdjEpithet(T,i){var _el=(i>=1&&_elidKind(T[i-1])==='det');
    if(_SEG&&i<_SEG.bb.length&&_SEG.bb[i])return null;
    if(i<2&&!_el)return null;var w=T[i],lw=w.toLowerCase();
    if(lw.indexOf("'")>=0||w.charAt(0)!==w.charAt(0).toLowerCase())return null;
    var d=deacc(lw);
    if(!ADJP[d]||_adjEstem(lw)!==null)return null;                                   // inconnu / épicène → pas de genre
    if(!_adjAccOk(lw,d))return null;                                                 // collision d'accent déacc (« teinté »≠paire teint/teinte)
    if(d==='tout'||d==='tous'||d==='toute'||d==='toutes')return null;
    if(i+1<T.length){var nx=deacc(T[i+1].toLowerCase());if(nx==='de'||nx==='et'||nx==='ou'||nx==='ni')return null;if((deacc(lw)==='bon'||deacc(lw)==='meilleur')&&nx==='marche')return null;if(_ADJ_INVAR_LOC[d+' '+nx])return null;}   // figé + coordination + locution invariable
    var tg=posTags(T);if(!tg||i>=tg.length||tg[i]!=='ADJ')return null;
    if(_ADV_ADJ_INVAR[d]&&i+1<tg.length&&(tg[i+1]==='DET'||tg[i+1]==='VERB'||tg[i+1]==='ADJ'||_elidKind(T[i+1])==='det'))return null;   // emploi ADVERBIAL invariable (« plein les yeux »/« haut placées »)
    if(tg[i-1]!=='NOUN'&&!_el)return null;if(_COLOR_ADJ[deacc(lw)]&&i+1<tg.length&&(tg[i+1]==='ADJ'||tg[i+1]==='NOUN'))return null;
    if(_headText(T[i-1]).charAt(0)!==_headText(T[i-1]).charAt(0).toLowerCase())return null;                 // nom propre
    var dn=deacc(_headText(T[i-1]).toLowerCase()),g=GENDER_PURE[dn];
    if((g!=='m'&&g!=='f')||_SG_STOP[dn])return null;                                  // genre connu ET pas invariant
    var num=_el?'s':(i>=2?_EPI_ART[deacc(T[i-2].toLowerCase())]:null);
    if(!num)return null;                                                             // nombre non net → abstention
    var _rv=svReads(w),_kv;for(_kv=0;_kv<_rv.length;_kv++)if(_rv[_kv][2]==='3'&&_rv[_kv][3]===num)return null;   // VERBE lu comme épithète : « La taupe COURT pour semer » → « courte » (le tagger dit ADJ après [DET NOUN]). Discriminant = l'ACCORD : lecture verbale 3e pers. accordée avec le sujet = verbe de la phrase. Rappel préservé quand le verbe n'accorde pas (« les situations critique »). Miroir Python rule_adj_epithet
    var sugg=_adjAgree(w,g,num);return sugg.toLowerCase()!==lw?ckeepcase(T[i],sugg):null;}
  /* ===== chantier REGLES_FR 1-8 (2026-08-12) — VERBATIM app ; chaque cadre MESURÉ (proto8 : tirs UD lus un à un) ===== */
  var _NEG_NEXT={pas:1,jamais:1,rien:1,guere:1,point:1,personne:1,aucun:1,aucune:1};   // « plus » EXCLU : comparatif (8 FP/10 mesurés)
  var _NEG_AUXV={a:1,ai:1,as:1,avons:1,avez:1,ont:1,est:1,es:1,etes:1,etait:1,etais:1,etaient:1,etions:1,etiez:1,avait:1,avais:1,avaient:1,avions:1,aviez:1,aura:1,aurai:1,auras:1,aurons:1,aurez:1,auront:1,aurait:1,aurais:1,auraient:1,aurions:1,auriez:1};   // formes à VOYELLE seulement (n' licite)
  var _NEG_SUJ={je:1,tu:1,il:1,elle:1,on:1,ils:1,elles:1,nous:1,vous:1};
  var _NEG_ELIDE={"c'est":"ce n'est","c'etait":"ce n'était","c'etaient":"ce n'étaient","j'ai":"je n'ai","j'avais":"je n'avais","j'aurai":"je n'aurai","j'aurais":"je n'aurais","j'etais":"je n'étais","t'as":"tu n'as","t'es":"tu n'es"};
  var _AGE_PREV={son:1,ton:1,mon:1,leur:1,notre:1,votre:1,cet:1,un:1,quel:1,bel:1};
  function rAgeAcc(T,i){var w=T[i];if(w!==w.toLowerCase())return null;   // « l'Age d'Or » (titre) = l'unique tir du flood 16 950 → minuscule STRICT
    var em=w.match(/^([ld])['’](ages?)$/);
    if(em)return em[1]+"'"+(em[2]==='age'?'âge':'âges');                 // « l'age » : UN token (toks garde l'élision)
    if((w!=='age'&&w!=='ages')||i<1)return null;
    if(!_AGE_PREV[T[i-1].toLowerCase()])return null;                     // « age » (pièce de charrue) : réel mais rarissime → contexte déterminant exigé
    return w==='age'?'âge':'âges';}
  function rCetaitEtait(T,i){var m=T[i].match(/^([CcSs])(['’])[ée]tais$/);if(!m)return null;
    return m[1]+m[2]+'était';}                                           // après c'/s' (= ce/se), la 1re personne n'existe pas — 0 tir/16 950 (audit rappel dys)
  var _AVOIR_CONJ={a:1,as:1,ont:1,ai:1,avons:1,avez:1,avait:1,avais:1,avaient:1,aura:1,auront:1,aurait:1,auraient:1,eut:1,eurent:1};
  function rAvoirFini(T,i){if(i<1)return null;var w=T[i];if(w!==w.toLowerCase())return null;
    if(w.length<4||!/^[a-zà-ÿ]+(it|is)$/.test(w))return null;
    var pv=T[i-1].toLowerCase().replace(/’/g,"'"),ap=pv.lastIndexOf("'");if(ap>=0)pv=pv.slice(ap+1);   // « l'a finit » → a
    if(!_AVOIR_CONJ[pv])return null;
    if(!svReads(w).length)return null;                                   // forme FINIE connue (CONJ_F ne contient QUE les temps finis)
    if(_isPpl(w))return null;                                            // « il a construit/dit » : déjà participe → correct
    var part=w.slice(0,-1);
    if(!_isPpl(part))return null;                                        // le participe tronqué doit EXISTER (grandit→grandi) — LA garde qui rend le flood propre (1 tir = vraie faute UD « il a réagit »)
    return part;}
  function rEtreInfEr(T,i){if(i<1)return null;var w=T[i];if(w!==w.toLowerCase())return null;
    if(w.length<4||!/^[a-zà-ÿ]+er$/.test(w))return null;
    var pv=T[i-1].toLowerCase().replace(/’/g,"'");
    if(pv!=="s'est"&&pv!=="s'était")return null;                         // v1 : le réfléchi SEUL (« s'est marier ») — 0 tir/16 950 ; « est/sont + -er » attendra sa propre mesure
    if(!CONJ_C[deacc(w)])return null;                                    // infinitif -er CONNU des tables → le participe régulier -é existe par morphologie
    var suj=(i>=2)?deacc(T[i-2].toLowerCase()):'';                        // le sujet immédiat accorde : « elle s'est marier » → mariée (le choix du genre ne change pas le TIR, juste la suggestion)
    var _gn2=(suj==='elle')?'f':((i>=2&&suj!=='il'&&suj!=='on')?_nounGender(T[i-2],'s',true):null);   // sujet NOMINAL : « la voisine s'est marier » → mariée (genre du nom ; 0 occurrence s'est+inf sur 16 950 correct)
    return w.slice(0,-2)+(_gn2==='f'?'ée':'é');}
  function rNegNe(T,i){if(i+1>=T.length)return null;var lw=T[i].toLowerCase(),d=deacc(lw);
    var nx=deacc(T[i+1].toLowerCase()),n2=i+2<T.length?deacc(T[i+2].toLowerCase()):'';
    if(d==='y'){if(!(_NEG_AUXV[nx]&&i>=1&&deacc(T[i-1].toLowerCase())==='il'&&_NEG_NEXT[n2]))return null;   // « il y a pas » → « il n'y a pas »
      if(n2==='pas'&&i+3<T.length&&deacc(T[i+3].toLowerCase())==='mal')return null;return "n'y";}
    if(!_NEG_NEXT[nx])return null;
    if(T[i+1].charAt(0)!==T[i+1].charAt(0).toLowerCase())return null;   // « …allaite.. Rien n'est » : négation capitalisée = phrase SUIVANTE (flood)
    if(_SEG&&i+1<_SEG.bb.length&&_SEG.bb[i+1])return null;              // frontière de proposition entre verbe et négation
    if(nx==='pas'&&n2==='mal')return null;                                             // « pas mal (de) » : locution sans ne
    if(_SEG&&((i<_SEG.hy.length&&_SEG.hy[i])||(i+1<_SEG.hy.length&&_SEG.hy[i+1])))return null;   // inversion « a-t-il pas »
    if(_NEG_ELIDE[d])return ckeepcase(T[i],_NEG_ELIDE[d]);
    if(lw.indexOf("'")>=0)return null;
    if(i<1)return null;
    if(!_NEG_AUXV[d]&&!_verbeFini(lw))return null;   // croisement EMF : verbe FINI (« je vais jamais », « je vois rien »), plus seulement l'auxiliaire
    var pv=deacc(T[i-1].toLowerCase()),ap=pv.lastIndexOf("'");if(ap>=0)pv=pv.slice(ap+1);   // qu'on / l'on / lorsqu'il → sujet nu
    if(!_NEG_SUJ[pv])return null;
    if(i>=2){var p2=T[i-2].toLowerCase();if(deacc(p2)==='ne'||p2==="n'")return null;}
    return ((/^[aeiouyh]/.test(d))?"n'":'ne ')+T[i];}   // n' devant voyelle/h, « ne » sinon (« je vais jamais » → ne vais)
  var _SICOND={aurais:'avais',aurait:'avait',aurions:'avions',auriez:'aviez',auraient:'avaient',serais:'étais',serait:'était',serions:'étions',seriez:'étiez',seraient:'étaient'};
  var _SI_SAVOIR={sais:1,sait:1,savais:1,savait:1,savent:1,savoir:1,demande:1,demandes:1,demandent:1,demandait:1,demander:1,demandez:1,demandons:1,ignore:1,ignorent:1,ignorait:1,dis:1,dit:1,dire:1,disait:1,voir:1,vois:1,voit:1,comprendre:1,devine:1,deviner:1,verifier:1,verifie:1,regarde:1,regarder:1};
  var _SI_CONJ={et:1,mais:1,car:1,alors:1,comme:1,meme:1,ou:1};
  function rSiCond(T,i){var lw=T[i].toLowerCase(),d=deacc(lw),pre='';
    var m=d.match(/^j'(.+)$/);if(m){pre=lw.slice(0,2);d=m[1];}
    if(!_SICOND[d])return null;
    for(var j=i-1;j>=0&&j>=i-3;j--){var pj=deacc(T[j].toLowerCase());
      var estSi=(pj==='si'),estSil=/^s'ils?$/.test(pj);
      if(estSi||estSil){
        if(j>0&&_SI_SAVOIR[deacc(T[j-1].toLowerCase())])return null;                   // interrogation indirecte : « je ne sais pas si je serais »
        if(!((j===0)||(_SEG&&j<_SEG.bb.length&&_SEG.bb[j])||(j>0&&_SI_CONJ[deacc(T[j-1].toLowerCase())])))return null;   // protase = tête de proposition
        var sg=_SICOND[d];return ckeepcase(T[i],pre?pre+sg:sg);}
      if(!_NEG_SUJ[pj]&&pj!=='ne'&&pj!=='y'&&pj!=='en')return null;}                   // seul un sujet court entre « si » et le verbe
    return null;}
  function rQuelQue(T,i){var d=deacc(T[i].toLowerCase());if(d!=='quelque'&&d!=='quelques')return null;
    if(i+1>=T.length)return null;var v=deacc(T[i+1].toLowerCase());
    if(v!=='soit'&&v!=='soient'&&v!=='fut'&&v!=='fussent')return null;
    var pl=(v==='soient'||v==='fussent'),fem=false;
    if(i+2<T.length){var d2=deacc(T[i+2].toLowerCase());if(d2==='la'||d2==='sa'||d2==='ma'||d2==='ta'||d2==='cette'||d2==='une')fem=true;}
    return ckeepcase(T[i],pl?(fem?'quelles que':'quels que'):(fem?'quelle que':'quel que'));}
  var _QUI_PREP={avec:1,a:1,pour:1,chez:1,contre:1,sans:1,sur:1,sous:1,vers:1,envers:1,par:1,entre:1,derriere:1,devant:1,apres:1,selon:1,de:1,dont:1};
  function rQuiPron(T,i){if(deacc(T[i].toLowerCase())!=='qui')return null;
    if(T[i].charAt(0)==='Q')return null;                                               // « Qui il a choisi ? » interrogatif oral
    if(i<1||i+1>=T.length)return null;
    var px=deacc(T[i+1].toLowerCase());if(px!=='il'&&px!=='ils'&&px!=='elle'&&px!=='elles'&&px!=='on')return null;
    var pv=deacc(T[i-1].toLowerCase());
    if(_QUI_PREP[pv]||_SI_SAVOIR[pv])return null;                                      // « avec qui il est ami » / « je sais qui il est »
    // ⭐ « QUI ON » = « QUI ONT » (mesuré 22/08 sur gold dys réel, parité Python rule_qui_pron) : le
    // scripteur dys écrit « on » pour « ont ». Fusionner en « qu'on » DÉTRUIT le « qui » du gold ET
    // masque la vraie faute — c'était la plus grosse famille de casses sur UNE règle (5 sur 36).
    // DISCRIMINANT : un relatif SUJET a un antécédent PLURIEL (déterminant/cardinal/pronom pluriel dans
    // les 5 tokens précédents). « ce qu'on fait », « je crois qu'on peut » n'en ont pas. ABSTENTION
    // seulement — jamais de nouvelle suggestion. Mesuré : mots CASSÉS 36 -> 32, réparations 398 -> 401.
    if(px==='on'){for(var _k=i-1;_k>=Math.max(0,i-5);_k--){var _d=deacc(T[_k].toLowerCase());
      if(PLURAL_DET[_d]||CARD[_d]||_d==='ceux'||_d==='celles'||_d==='tous'||_d==='toutes'
         ||_d==='plusieurs'||_d==='certains'||_d==='certaines')return null;}}
    var sugg="qu'"+T[i+1];
    if(pv==='ce')return {sugg:sugg,span:2};                                            // « ce qui il » : jamais correct → rouge
    return {sugg:sugg,span:2,vig:1};}
  var _QDONT_GOUV={besoin:1,envie:1,peur:1,honte:1};
  var _QDONT_MID={je:1,tu:1,il:1,elle:1,on:1,ils:1,elles:1,nous:1,vous:1,ne:1,en:1,y:1,a:1,ai:1,as:1,avons:1,avez:1,ont:1,avait:1,avais:1,avaient:1,aura:1,aurai:1,auront:1,aurait:1};
  function rQueDont(T,i){var lw=T[i].toLowerCase(),rest=null;
    if(lw!=='que'){var m=lw.match(/^qu'(.+)$/);if(!m)return null;rest=m[1];var dr=deacc(rest);
      if(dr!=='il'&&dr!=='elle'&&dr!=='on'&&dr!=='ils'&&dr!=='elles'&&dr!=='en')return null;}
    if(i<1)return null;var tg=posTags(T);                                              // ANTÉCÉDENT nominal exigé : « je crois que j'ai besoin » = complétive correcte
    if(!(deacc(T[i-1].toLowerCase())==='ce'||(tg&&i-1<tg.length&&tg[i-1]==='NOUN')))return null;
    for(var k=(rest?i:i+1);k<T.length&&k<=i+4;k++){var g=deacc(T[k].toLowerCase());
      if(k>i&&_QDONT_GOUV[g]){
        if(k+1<T.length){var nn=T[k+1].toLowerCase();if(deacc(nn)==='de'||/^d'/.test(nn))return null;}   // « que j'ai besoin DE toi » : le de est là → correct
        return {sugg:rest?ckeepcase(T[i],'dont '+rest):ckeepcase(T[i],'dont'),vig:1};}
      if(k>i&&!_QDONT_MID[g]&&!/^j'/.test(T[k].toLowerCase()))return null;}
    return null;}
  var _PRET_COP={est:1,es:1,suis:1,sont:1,sommes:1,etes:1,etait:1,etais:1,etaient:1,semble:1,semblent:1,parait:1,paraissent:1,reste:1,restent:1,tout:1,toute:1,tous:1,toutes:1,pas:1,presque:1,deja:1,enfin:1,etre:1,toujours:1,jamais:1};
  var _PRET_DET={la:1,le:1,les:1,un:1,une:1,des:1,du:1,ma:1,mon:1,mes:1,sa:1,son:1,ses:1,notre:1,nos:1,votre:1,vos:1,leur:1,leurs:1,cette:1,ces:1,cet:1};
  function rPresPret(T,i){var lw=T[i].toLowerCase();
    var dur=(lw==='prêt'||lw==='prêts'),mou=(lw==='prête'||lw==='prêtes');
    if(!dur&&!mou)return null;
    if(mou&&(i<1||!_PRET_COP[deacc(T[i-1].toLowerCase())]))return null;                // « elle prête de l'argent » = verbe prêter
    if(i+2>=T.length||deacc(T[i+1].toLowerCase())!=='de')return null;
    var w2=T[i+2].toLowerCase(),d2=deacc(w2);
    if(!_PRET_DET[d2]&&!/^l'/.test(w2))return null;
    if((d2==='le'||d2==='la'||d2==='les')&&i+3<T.length){var tg=posTags(T);if(tg&&i+3<tg.length&&tg[i+3]==='VERB')return null;}   // « prêt de le faire » : clitique+inf, pas un lieu
    return {sugg:'près',vig:1};}
  var _DAV_PREV={pas:1,plus:1,point:1,guere:1,aucun:1,sans:1,peu:1};
  function rDavantage(T,i){if(T[i].toLowerCase()!=="d'avantage")return null;
    if(i>=1&&_DAV_PREV[deacc(T[i-1].toLowerCase())])return null;                       // « il n'y a pas d'avantage » : lecture nominale légitime
    if(i+1<T.length){var nn=T[i+1].toLowerCase();
      if(deacc(nn)!=='que'&&!/^qu'/.test(nn)&&!(_SEG&&i+1<_SEG.bb.length&&_SEG.bb[i+1]))return null;}   // fin de proposition ou « que » seulement
    return {sugg:'davantage',vig:1};}
  var _ANT_ADJ={fatiguant:'fatigant',convainquant:'convaincant',provoquant:'provocant',communiquant:'communicant',negligeant:'négligent',differant:'différent',excellant:'excellent',precedant:'précédent',equivalant:'équivalent',influant:'influent',naviguant:'navigant'};
  var _ANT_POS={le:1,la:1,les:1,un:1,une:1,des:1,ce:1,cet:1,cette:1,ces:1,son:1,sa:1,ses:1,mon:1,ma:1,mes:1,tres:1,plus:1,moins:1,si:1,aussi:1,trop:1,fort:1,vraiment:1,assez:1,est:1,es:1,sont:1,suis:1,sommes:1,etes:1,etait:1,etais:1,etaient:1,semble:1,semblent:1,parait:1,reste:1,restent:1};
  function rAntAdj(T,i){var adj=_ANT_ADJ[deacc(T[i].toLowerCase())];if(!adj)return null;
    if(i<1)return null;
    if(!_ANT_POS[deacc(T[i-1].toLowerCase())]){var tg=posTags(T);                      // après un NOM : épithète seulement si FIN de proposition (« l'année précédant la guerre » = participe + complément → silence)
      var fin=(i+1>=T.length)||(_SEG&&i+1<_SEG.bb.length&&_SEG.bb[i+1]);
      if(!(tg&&i-1<tg.length&&tg[i-1]==='NOUN'&&fin))return null;}
    if(_SEG&&i<_SEG.bb.length&&_SEG.bb[i])return null;                                 // « …, provoquant … » : participe après virgule
    for(var j=i-3;j<i;j++)if(j>=0&&deacc(T[j].toLowerCase())==='en')return null;       // gérondif « en le précédant »
    return {sugg:ckeepcase(T[i],adj),vig:1};}
  var _VC_NUM={un:1,deux:1,trois:1,quatre:1,cinq:1,six:1,sept:1,huit:1,neuf:1,dix:1,onze:1,douze:1,treize:1,quatorze:1,quinze:1,seize:1,vingt:1,trente:1,quarante:1,cinquante:1,soixante:1,cent:1,cents:1,mille:1,million:1,millions:1,milliard:1,milliards:1,et:1,pour:1};
  var _VC_MULT={deux:1,trois:1,quatre:1,cinq:1,six:1,sept:1,huit:1,neuf:1};
  function rVingtCent(T,i){var d=deacc(T[i].toLowerCase());if(d!=='vingt'&&d!=='cent')return null;
    if(i<1||i+1>=T.length)return null;var nx=deacc(T[i+1].toLowerCase());
    if(_VC_NUM[nx]||!/[sx]$/.test(nx))return null;                                     // nom PLURIEL exigé après → tue dates et ordinaux
    if(_SEG&&i+1<_SEG.hy.length&&_SEG.hy[i+1])return null;                             // « quatre-vingt-dix »
    var pv=deacc(T[i-1].toLowerCase());
    if(d==='vingt'){if(pv!=='quatre'||!(_SEG&&i<_SEG.hy.length&&_SEG.hy[i]))return null;return T[i]+'s';}
    if(!_VC_MULT[pv])return null;
    if(i>=2){var p2=deacc(T[i-2].toLowerCase());if(p2==='mille'||p2==='mil')return null;}   // « mille neuf cent » (millésime)
    return T[i]+'s';}
  var CRULES=[['élision inversée',rDeselide],['être (ête)',rEteEtre],['accord grammatical (é/er)',rEer],['-e/-é (participe)',rEPpl],['accord participe',rPpEtre],['accord participe (COD avoir)',rPpAvoirCod],['accord participe (dont)',rPpAvoirDont],['accord adjectif',rAdjAttr],['accord adjectif épithète',rAdjEpithet],['accord adjectif épithète',rAdjNumber],['accord participe épithète',rPpEpithetNum],['accord adjectif épithète',rAdjAux],['accord participe épithète',rPpEpithetFem],['terminaison -er/-é/-ez/-ai',rFlexionEr],['infinitif de but',rInfBut],['impératif',rImperatif],['son/sont',rSon],['on/ont',rOn],['leur/leurs',rLeur],['a/à',rA],['et/est',rEt],['est/et (proposition)',rEstEtClause],['peu/peux/peut',rPeu],['sujet je',rJeSubject],['sais/sait',rSais],['ce/se',rCe],['des/dès',rDesDes],["c'est/s'est",rCestSest],["c'est/s'est",rCesSest],['ça/sa',rCaSa],['ou/où',rOuOu],['met/mais',rMetMais],['mai/mais',rMaiMais],['mais/mes',rMais],['élision fusionnée',rElisionFusionnee],['du/de',rDuDe],['du/dû',rDuDu],['sur/sûr',rSurSur],['la/là',rLaLa],['guère/guerre',rGuere],['vit/vie',rSaVit],["j'est/j'ai",rJest],["c'ai/c'est",rCai],['élision',rElide],['accord sujet-verbe',rAccordSV],['accord sujet-verbe',rIlIls],['accord sujet-verbe',rAccordSVrecover],['accord sujet-verbe',rAccordSVnoun],['accord sujet-verbe',rAisAit],['accord sujet-verbe',rAiAit],['accord sujet-verbe',rAccordSVquant],['accord sujet-verbe',rAccordSVrelatif],['accord sujet-verbe',rAccordSVcoord],['accord sujet-verbe',rAccordSVinfinitif],['accord sujet-verbe',rPostpose],['accord sujet-verbe',rAccordVerbCoord],['accord sujet-verbe',rAccordRelObj],['accord sujet-verbe',rAccordIncise],['genre déterminant',rDetGenre],['accord tout',rTout],['accord pluriel nom',rNounPlural],['accord singulier nom',rNounSing],['usage être/avoir',rAuxUsage],['aux mal orthographié',rAuxMisspell],['accent (âge)',rAgeAcc],["étais après c'/s'",rCetaitEtait],['participe après avoir',rAvoirFini],["participe après s'est",rEtreInfEr],['négation',rNegNe],['si + conditionnel',rSiCond],['quel que soit',rQuelQue],["qu'il (élision)",rQuiPron],['que/dont',rQueDont],['qui/que',rQuiQue],['près/prêt',rPresPret],['davantage',rDavantage],['adjectif en -ant/-ent',rAntAdj],['vingt/cent',rVingtCent],['majuscule',rCapital]];
  /* ⭐ SCINDÉ EN DEUX (2026-08-11) pour avoir la MÊME STRUCTURE QUE L'APP : `correctTokens(T)`
     travaille sur un TABLEAU de tokens, `correctText` n'est qu'une enveloppe qui tokenise. Sans ce
     point d'entrée par tokens, la PYRAMIDE était impossible ici — on ne pouvait pas faire tourner la
     grammaire sur des tokens déjà nettoyés par l'orthographe. C'est ce qui manquait à `diagnoseAll`. */
  // FAMILLES « À VÉRIFIER » SUR TEXTE DYS (2026-08-22) — MESURÉ (dictee/dys_precision_probe.py, 1 726 paires dys réelles) : genre
  // déterminant 58 %, leur/leurs 64 %, accord du participe 43 %, ce/se 0/2 de corrections JUSTES — le reste « corrige » du texte juste
  // (« La pont »→Le, « leur payss »→leurs, « fut créée »→créé). Une règle dont le contexte dys pollue l'ancre n'a pas le droit de
  // s'APPLIQUER d'office : orange (clic), pas rouge. Les familles à 100 % (participe après avoir, majuscule, a/à, adjectif
  // épithète, singulier du nom) restent rouges. MIROIR Python : correcteur_probe.VIG_FAMILIES (parité extension/parity_core.js).
  var _VIG_FAM={'genre déterminant':1,'leur/leurs':1,'accord participe':1,'ce/se':1};
  var _SUBJ_PRON={il:1,elle:1,ils:1,elles:1,on:1,je:1,tu:1,nous:1,vous:1};
  var _INVAR_S={};('pays francais anglais bras temps corps repas mois fois bois choix voix prix croix noix nez gaz tas cas avis colis puits tapis radis souris fils cours discours secours concours parcours mars dos os heros marais palais relais jus autobus bus virus refus').split(' ').forEach(function(w){_INVAR_S[w]=1;});
  var _COLL_BARE=null;   // clé nue → nb d'entrées _GCOLL partageant la clé (jumeau accentué) — construit à la 1re demande (après _GCOLL)
  function _wordKnown(d){return !!(SP&&SP.WORDS&&(SP.WORDS.has(d)||(SP.D2A&&SP.D2A[d]&&SP.D2A[d].length)))||GENDER_PURE[d]==='m'||GENDER_PURE[d]==='f';}
  function _tierOf(T,i,name,sugg){   // MIROIR de correcteur_probe.tier_of — sous-cas SÛRS (rouge) des familles à vérifier ; sinon orange
    if(!_VIG_FAM[name])return 'auto';var n=T.length;
    if(name==='leur/leurs'){if(i+1>=n)return 'vigilance';var dn=deacc(T[i+1].toLowerCase());
      if(/s$/.test(sugg.toLowerCase())){if(_INVAR_S[dn]||!/[sx]$/.test(dn))return 'vigilance';var sg=/aux$/.test(dn)?dn.slice(0,-3)+'al':dn.slice(0,-1);if(_INVAR_S[sg])return 'vigilance';return _wordKnown(sg)?'auto':'vigilance';}
      // « leurs »→« leur » corrige le DÉTERMINANT : direction MINORITAIRE (12 contre 59, le gold corrige le NOM). Repli ROUGE conservé (garde produit « il range leurs livre », banc navigateur réel) SAUF PREUVE DE PLURIEL : un verbe 3e pers. PLURIELLE après le groupe (« Leurs racine ls DÉFENDENT ») montre que le GN est bien pluriel → c'est le NOM qui a perdu son -s → orange. Miroir Python tier_of.
      for(var _j=i+2;_j<Math.min(n,i+6);_j++){var _rr=svReads(T[_j]),_q;for(_q=0;_q<_rr.length;_q++)if(_rr[_q][2]==='3'&&_rr[_q][3]==='p')return 'vigilance';}
      return (_wordKnown(dn)&&!/[sx]$/.test(dn))?'auto':'vigilance';}
    if(name==='genre déterminant'){if(i+1>=n)return 'vigilance';var nx=T[i+1].toLowerCase();if(nx!==deacc(nx))return 'auto';
      return 'vigilance';}   // nom NU : mesuré 7/12 sur texte dys (« La pont », « Le sole » = nom mal écrit qui existe) → orange
    if(name==='accord participe'){for(var j=i-1;j>=Math.max(0,i-3);j--){var t=deacc(T[j].toLowerCase());if(_SUBJ_PRON[t])return 'auto';if(PRENOMS[T[j]])return 'auto';}return 'vigilance';}
    return 'vigilance';}
  function correctTokens(T){var out=[];for(var i=0;i<T.length;i++){for(var r=0;r<CRULES.length;r++){var dec=CRULES[r][1](T,i);if(dec==null)continue;var _sg=(typeof dec==='object')?dec.sugg:dec,_vg=(typeof dec==='object'&&dec.vig)?'vigilance':null,_sp=(typeof dec==='object'&&dec.span>=2)?dec.span:null;if(_sg!==T[i]&&(CRULES[r][0]==='majuscule'||_sg.toLowerCase()!==T[i].toLowerCase())){var _f={i:i,word:T[i],sugg:_sg,name:CRULES[r][0],tier:_vg||_tierOf(T,i,CRULES[r][0],_sg)};if(_vg)_f.vigRule=1;if(_sp)_f.span=_sp;out.push(_f);break;}}}return out;}   /* ⭐ LE ROUGE DE LA GRAMMAIRE EST PORTÉ PAR LE FLAG (audit 2026-08-11, miroir app). Avant tier=null : content.js n'applique que `tier==='auto'`, donc l'extension ne corrigeait JAMAIS la grammaire alors que l'app la coche par défaut — le même texte était corrigé sur le site et seulement signalé ici. {sugg,vig:1} → 'vigilance' (orange) ; sinon rouge, et il le DIT. */
  function correctText(text){text=String(text).replace(/[’ʼ]/g,"'");_SEG=_segInfo(text);var _Tpb=toks(text);_SEG.pb=_predBounds(_Tpb,_SEG);return correctTokens(_Tpb);}   // enveloppe : grammaire sur le texte brut (miroir app) + bornes prédites (canal pb)

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
      else if(ch==='h'){}else if(ch==='x')res+=(j===s.length-1?'':'ks');   /* -x FINAL MUET (noix/prix/voix/choix) ; interne = ks (taxi) */else if(ch==='z'||ch==='s')res+='s';else if(ch==='y')res+='i';else if(ch==='w')res+='v';else res+=ch;}
    s=res.replace(/¤/g,'nj');var out='';for(var k=0;k<s.length;k++){if(s[k]!==out[out.length-1])out+=s[k];}s=out;
    while(s.length&&'est'.indexOf(s[s.length-1])>=0)s=s.slice(0,-1);return s;}
  function sEdits1(d){var res={},i,ci,c,a,b,sp=[];for(i=0;i<=d.length;i++)sp.push([d.slice(0,i),d.slice(i)]);
    for(var k=0;k<sp.length;k++){a=sp[k][0];b=sp[k][1];if(b)res[a+b.slice(1)]=1;if(b.length>1)res[a+b[1]+b[0]+b.slice(2)]=1;
      for(ci=0;ci<26;ci++){c=String.fromCharCode(97+ci);res[a+c+b]=1;if(b)res[a+c+b.slice(1)]=1;}}return Object.keys(res);}
  var SP={ready:false,loading:null,WORDS:null,FREQ:{},D2A:{},PHON:{},POS:{}};
  var SELIDE={l:1,m:1,t:1,s:1,n:1,d:1,c:1,j:1},_SELIDE_ACC={l:1,d:1,j:1,c:1,s:1},SVOW={a:1,e:1,i:1,o:1,u:1,y:1,h:1};   // _SELIDE_ACC = préfixes SÛRS pour restauration d'accent (m'/t'/n' exclus)
  // tokens courts NON-FRANÇAIS à ne JAMAIS corriger : mots anglais fréquents dans du texte FR (titres/orgs) que le speller
  // accentuait à tort (the→thé, world→…) + « er » = résidu d'ordinal « 1er » (le chiffre effacé laisse « er »→« ère »).
  // Aucun n'entre en collision avec un mot français (mais/or/on/en/a/ni exclus). Miroir app.
  var _SPELL_KEEP={the:1,and:1,of:1,with:1,is:1,are:1,was:1,were:1,this:1,that:1,from:1,they:1,you:1,your:1,its:1,new:1,world:1,er:1};
  function _applySpellerTSV(txt){SP.WORDS=new Set();var lines=txt.split('\n');
    for(var k=0;k<lines.length;k++){var ln=lines[k];if(!ln)continue;var pr=ln.split('\t');if(pr.length<2)continue;
      var w=pr[0],fr=parseInt(pr[1],10)/1000;SP.WORDS.add(w);SP.FREQ[w]=fr;if(pr[2])SP.POS[w]=pr[2];
      if(fr>0){var d=deaccS(w);(SP.D2A[d]||(SP.D2A[d]=[])).push(w);}   // porte EXACTE : seule la fréquence 0 (gacc) est connue-seulement ; ≥ 0,01 retirait 26 % du lexique de BASE et cassait les suggestions « mot inconnu » (mesuré en A/B node)   // ⭐ connu-seulement : sous KNOWN_ONLY le mot est dans WORDS (plus « inconnu ») mais JAMAIS candidat — l'A/B navigateur perdait 3 justes par concurrence d'unicité (miroir Python KNOWN_ONLY_FREQ)
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
  // PREUVE DE PLURIEL élargie (22/08/2026, parité Python speller_probe.DET_NUM) — sans elle le classement retombait
  // sur la FRÉQUENCE BRUTE, et la forme de base étant presque toujours plus fréquente que la fléchie, le speller
  // ENLEVAIT la marque de pluriel (« jourss »→jour, « less »→le) que la grammaire remettait ensuite. `sNMatch`
  // existait déjà et était CORRECT — il n'avait jamais la preuve. Pluriel NON AMBIGU seulement (jamais de singulier).
  // Cardinaux ≥2 = même liste/sémantique que CARD (déterminant pluriel non ambigu, FP=0 mesuré à l'échelle UD).
  'deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize vingt trente quarante cinquante soixante cent cents mille tous toutes plusieurs quelques certains certaines divers diverses nombreux nombreuses differents differentes'.split(' ').forEach(function(w){SDET_NUM[w]='p';});
  var SCOPULA={};('est sont suis es sommes etes etait etaient etais sera seront serai soit fut furent parait paraissait semble semblait devient deviennent reste restent').split(' ').forEach(function(w){SCOPULA[w]=1;});
  var SADVERB={};('tres si trop assez bien plus tout aussi moins fort peu').split(' ').forEach(function(w){SADVERB[w]=1;});
  var SAUXAV={};("a ai as ont avons avez avait avaient aura auront aurai aurais aurait eu ete j'ai j'est j'avais j'aurai").split(' ').forEach(function(w){SAUXAV[w]=1;});
  var SSUBJP={};('je tu il elle on ils elles nous vous').split(' ').forEach(function(w){SSUBJP[w]=1;});
  function sGender(w){var dw=deaccS(w);if((SP.POS[w]||'').indexOf('A')>=0){var a=ADJP[dw];if(a)return a[0];}var g=GENDER_PURE[dw]||GENDER_MAP[dw];return (g==='m'||g==='f')?g:null;}
  function _homophoneEdit1(low){var d=deaccS(low),pk=phonKey(low),e1=sEdits1(d),i,j;for(i=0;i<e1.length;i++){var a=SP.D2A[e1[i]];if(!a)continue;for(j=0;j<a.length;j++){var w=a[j];if(w!==low&&(SP.FREQ[w]||0)>=1.0&&/V/.test(SP.POS[w]||'')&&phonKey(w)===pk)return true;}}return false;}   // un VERBE du lexique à 1 édition et de même clé phonétique existe (aboit→aboie) : la soudure « a + verbe » s'efface devant lui
  var SCTX_STOP={};('qui que qu dont ou où et ni mais car donc or puis si lorsque quand comme').split(' ').forEach(function(w){SCTX_STOP[w]=1;});   // frontière de proposition : le genre de « un » ne traverse pas « qui » (« un chien qui aboit »→aboie, pas about). Miroir Python CTX_STOP.
  function sCtxGender(T,idx){if(!T||idx==null)return null;for(var j=idx-1;j>=Math.max(0,idx-4);j--){var t=deaccS(T[j].toLowerCase());if(SCOPULA[t])continue;if(SCTX_STOP[t])return null;if(t==='peu'||t==='peux'||(DET_G[t]&&j+1<T.length&&(deaccS(T[j+1].toLowerCase())==='peu'||deaccS(T[j+1].toLowerCase())==='peux')))continue;if(DET_G[t])return DET_G[t];
    if(!SP.WORDS.has(T[j].toLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae')))continue;   // ancre de genre = un VRAI mot écrit : un token fautif (« tres ») porte un genre pollué (GENDER_PURE déacc ← « trés » nom) → on continue vers le déterminant
    var g=GENDER_PURE[t];if((g==='m'||g==='f')&&!(j>0&&DET_G[deaccS(T[j-1].toLowerCase())]))continue;if(g==='m'||g==='f')return g;}return null;}
  function sCtxNumber(T,idx){if(!T||idx==null)return null;var back=null,bdist=99,j;
    for(j=idx-1;j>=Math.max(0,idx-4);j--){var t=deaccS(T[j].toLowerCase());if(SDET_NUM[t]){back=SDET_NUM[t];bdist=idx-j;break;}}
    if(back!==null&&bdist===1)return back;   // déterminant COLLÉ = preuve la plus forte
    // PREUVE VERS L'AVANT (22/08/2026, parité Python _ctx_number) : pour un DÉTERMINANT ou un ADJECTIF, la marque de
    // nombre est portée par le NOM QUI SUIT (« pettits TUYAUX », « leusr TIGES »). Restreinte pour ne créer AUCUN risque :
    // token immédiatement suivant seulement · NOM connu (tag N) au pluriel MORPHOLOGIQUE (singulier attesté au lexique)
    // · JAMAIS un mot-outil (« il mangee DES pommes » ne doit pas mettre le VERBE au pluriel) · renvoie 'p' seulement.
    if(idx+1<T.length){var nx=T[idx+1].toLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae');
      if(!SDET_NUM[deaccS(nx)]&&SP.WORDS.has(nx)&&(SP.POS[nx]||'').indexOf('N')>=0&&/[sx]$/.test(nx)){
        var sgs=/aux$/.test(nx)?[nx.slice(0,-3)+'al',nx.slice(0,-1)]:[nx.slice(0,-1)];   // -aux a DEUX singuliers (cheval/tuyau)
        for(j=0;j<sgs.length;j++){if(SP.WORDS.has(sgs[j]))return 'p';}}}
    return back;}
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
function subseq(a,b){var i=0;for(var k=0;k<b.length;k++){if(i<a.length&&a[i]===b[k])i++;}return i===a.length;}   // a est-il une SOUS-SUITE de b ? (miroir de l'app)
function _slipMot(a,b){if(a===b)return false;                                          // GLISSEMENT MOTEUR : les mêmes LETTRES, seul l'ORDRE ou un REDOUBLEMENT diffère (entrées DÉACCENTUÉES). Miroir app.
    if(a.split('').sort().join('')===b.split('').sort().join(''))return true;            // transposition : jmaais→jamais, acceuil→accueil, toujorus→toujours
    if(Math.abs(a.length-b.length)!==1)return false;
    var L=a.length>b.length?a:b,S=a.length>b.length?b:a,k;
    for(k=0;k<L.length;k++)if(L.slice(0,k)+L.slice(k+1)===S&&(L.charAt(k)===L.charAt(k-1)||L.charAt(k)===L.charAt(k+1)))return true;   // redoublement : grannd→grand, beaucooup→beaucoup, vinngt→vingt (charAt(-1)==='' donc k=0 est sûr)
    return false;}
function _levB(a,b,max){if(Math.abs(a.length-b.length)>max)return max+1;var pr=[],cu=[],i,j;for(j=0;j<=b.length;j++)pr[j]=j;for(i=1;i<=a.length;i++){cu[0]=i;var bst=i;for(j=1;j<=b.length;j++){var v=Math.min(pr[j]+1,cu[j-1]+1,pr[j-1]+(a.charAt(i-1)===b.charAt(j-1)?0:1));cu[j]=v;if(v<bst)bst=v;}if(bst>max)return max+1;for(j=0;j<=b.length;j++)pr[j]=cu[j];}return pr[b.length];}   // distance d'édition BORNÉE
  function spellTokenCore(tok,atStart,T,idx){
    if(!SP.ready)return null;var low=tok.toLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae');if(low.length<2||!isAlphaS(low))return null;
    if(udHas(low))return null;                                       // dictionnaire utilisateur -> mot valide
    var _AFIX={"trés":"très","celà":"cela","içi":"ici","idéé":"idée","écolé":"école","fléche":"flèche","moï":"moi","verité":"vérité"};if(_AFIX[low])return["auto",_AFIX[low]];
    /* ⭐ FORMES NUES QUI POLLUENT LE LEXIQUE (audit 11/09/2026 : « Ma mere » → orange « Mon », le speller muet). `mere` EST une entrée
       de Lexique4 (NOM m, 6,66/M — sous-titres) à côté de `mère` (630/M) : le speller se tait sur un mot « connu ». Recensé : 13 formes
       qui ne sont un mot sous AUCUNE graphie (1990 comprise), 0 fois en minuscules sur 14 450 phrases UD, 16 fois dans le corpus dys
       (mere 8, age 5, reparer 2, ame 1) toutes corrigées par le gold vers la sœur accentuée. MINUSCULES SEULEMENT : « Ame V », « Special »,
       « l'Age d'Or » existent en majuscule dans du français correct. Exclus : cote, sacre, prive, voila… (mots valides), maitre, ile,
       gout (graphies rectifiées de 1990). Miroir Python _AFIX_MIN. */
    var _AFIX_MIN={"mere":"mère","age":"âge","ame":"âme","reparer":"réparer","bebe":"bébé","moitie":"moitié","repondre":"répondre","repondu":"répondu","reponds":"réponds","envoye":"envoyé","special":"spécial","camera":"caméra","enfoire":"enfoiré"};if(tok===low&&_AFIX_MIN[low])return["auto",_AFIX_MIN[low]];
    /* LE « e » MUET DU FUTUR/CONDITIONNEL (audit rappel dys PR#505 : « je ne t'oublirais jamais » ×4) :
       non-mot en r+terminaison dont stem+er est un verbe des tables → réinsérer le e muet (oublirais→
       oublierais). AUDIBILITÉ : le scripteur a ENTENDU le R (/ubliʁɛ/) — « oubliais » (distance 1 aussi)
       n'a PAS ce son ; la reconstruction sonore prime. Radical ≥ 4 (« tetra »→tetera via téter = l'unique
       tir du flood 16 950). L'élision est déballée par spellToken (l'oublirais → oublirais). */
    if(!SP.WORDS.has(low)){var _fm=low.match(/^([a-zà-ÿ]{4,})r(ai|as|a|ons|ez|ont|ais|ait|aient)$/);
      if(_fm&&CONJ_C[deacc(_fm[1]+'er')]&&(SP.FREQ[_fm[1]+'er']||0)>=1.0){var _fc=_fm[1]+'e'+'r'+_fm[2];   // GARDE (11/09/2026, mesurée) : le verbe reconstruit doit être COURANT (≥1/M). Recensement sur tout le dys local : 8 tirs justes (oublirais/oublirait/oublirez, oublier 77/M) contre 2 faux (« revérrons »→revérerons, révérer 0/M, alors que reverrons est à l'accent près ; « fautra »→fautera, fauter 0,05/M) — le seuil sépare parfaitement, 0 tir sur 2 500 UD. Miroir app + Python.
        if(CONJ_F[deacc(_fc)])return["auto",_fc];}}

    var _OEL={soeur:"sœur",soeurs:"sœurs",coeur:"cœur",coeurs:"cœurs",choeur:"chœur",choeurs:"chœurs",oeuf:"œuf",oeufs:"œufs",oeuvre:"œuvre",oeuvres:"œuvres",boeuf:"bœuf",boeufs:"bœufs",oeil:"œil",voeu:"vœu",voeux:"vœux",noeud:"nœud",noeuds:"nœuds",moeurs:"mœurs",manoeuvre:"manœuvre",manoeuvres:"manœuvres",oeillet:"œillet",oeillets:"œillets",oesophage:"œsophage",foetus:"fœtus"};
    if(_OEL[low]&&tok.indexOf('œ')<0&&tok.indexOf('Œ')<0)return['flag',_OEL[low]];   // LIGATURE œ : « soeur »→« sœur ». Liste FERMÉE oe=œ → FP=0. Garde : pas de re-flag si déjà écrit avec œ. Miroir app.
    if(SP.WORDS.has(low))return null;                                  // mot valide → couche grammaire
    // ⛔ PRÉNOM ÉCRIT EN MINUSCULE (22/08, parité Python speller_probe + app) : la garde « nom propre »
    // exige une MAJUSCULE hors début de phrase — elle ne protège rien chez un scripteur dys, qui n'en met
    // pas. Mesuré sur le pipeline (dys_pipeline_probe) : « isis »→« ici » ; mots CASSÉS 26 -> 20 sur texte
    // dys réel, à coût NUL (réparations, GEC, FP échelle inchangés). La table PRENOMS existe DÉJÀ dans les
    // 3 moteurs pour l'accord — on la RÉUTILISE (doctrine §5). La garde ne voit que des tokens DÉJÀ inconnus
    // des 211 k formes : qu'ils soient en plus un prénom attesté en fait un nom, pas un typo.
    if(low.length>=3&&PRENOMS[low.charAt(0).toUpperCase()+low.slice(1)])return null;
    if((low.charAt(0)==='à'||low.charAt(0)==='a')&&low.length>=3){var _rsd=low.slice(1);
      if(SP.WORDS.has(_rsd)&&/V/.test(SP.POS[_rsd]||'')&&!/(er|re|ir)$/.test(_rsd)
         &&!SP.WORDS.has(low.charAt(0)+low.charAt(1)+low.slice(1))   // le REDOUBLEMENT prime : « aporté »→apporté (couche DC), pas « a porté »
         &&!_homophoneEdit1(low)){   // et un VRAI MOT à une édition, de MÊME SON, prime aussi (2026-08-22, texte dys) : « aboit » = aboie /abwa/ (1 édition, verbe), pas « a boit » — Python (sans soudure) rend aboie
        /* SOUDURE à/a+VERBE (enquête des 22, texte3 réel : « àeu »→a eu, « àfinit »→a finit puis
           la grammaire accorde finit→fini en cascade). Le reste doit être une forme CONJUGUÉE ou
           un participe — jamais un infinitif (« atendre » = attendre, pas « a tendre »). */
        return ['vigilance','a '+_rsd];}}
    if(_SPELL_KEEP[low])return null;                                   // mot anglais fréquent / résidu d'ordinal (« the »/« er ») → ne pas corriger (FP sur texte FR à mots anglais)
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
    /* ⛔ SECOURS DISTANCE 2 — RETIRÉ le 2026-08-11 : MESURÉ NUISIBLE. NE PAS LE REMETTRE.
     Livré le matin même sur la foi de WiCoPaCo (+26 justes / −4 = +21). Test différentiel le soir,
     moteur AVEC vs SANS (contrôle : « dispaître » diffère bien), sur 1 360 phrases dys/GEC
     APPARIÉES : il ajoute **0 correction juste et 4 fausses** (reamné→ramené, etvous→tous,
     brêmoise→remise, œcur→reçu — le dys écrit « cœur », on lui propose « reçu »), plus **26
     marques ORANGE sur du texte CORRECT** (subsp→sûrs, defining→définis, israel→irréel).
     ⭐ DOCTRINE DE REM : « une faute est une faute, point ; il faut MAXIMISER LE ROUGE pour
     DIMINUER L'ORANGE ». Ce secours ne produit QUE de l'orange, et zéro justesse sur la
     population cible. Son seul gain est sur WiCoPaCo — registre Wikipédia, juge déjà connu
     comme trompeur ici. Un gain sur un juge trompeur ne paie pas 26 oranges sur du texte juste. */
    var keys=Object.keys(cand);if(!keys.length)return null;var pk=phonKey(low);
    var inpAud=/é$/.test(low);                                        // AUDIBILITÉ : finale /e/ (é) écrite = entendue (fiable). Miroir app.
    var cg=sCtxGender(T,idx),cn=sCtxNumber(T,idx);                     // accord du contexte (grammaire)
    var expPos=null;                                                   // POS attendu (désambiguïse l'accent : élève/élevé)
    if(T&&idx>0){var pt=deaccS(T[idx-1].toLowerCase());if(DET_G[pt]||SDET_NUM[pt])expPos='N';else if(SADVERB[pt])expPos='A';
      else if(SCOPULA[pt])expPos='VA';else if(SAUXAV[pt]||SSUBJP[pt])expPos='V';}   // copule = attribut POSSIBLE : V OU A (« je suis trist »→triste, pas seulement « je suis allé ») — audit 07/2026   // CONTEXTE VERBAL : après aux/copule/pronom-sujet → candidat VERBE (pri→pris, pleu→pleut). Bonus, jamais pénalité → FP-sûr.
    function pm(x){if(!expPos)return 0;var ps=SP.POS[x]||'';for(var q=0;q<expPos.length;q++)if(ps.indexOf(expPos.charAt(q))>=0)return 1;return 0;}   // expPos peut être multi-POS ('VA' après copule)
    function gm(x){var g=sGender(x);return (cg&&g&&g===cg)?1:0;}       // bonus genre (jamais pénalité)
    function sInvarS(x){var w=x.toLowerCase();if(!/[sxz]$/.test(w))return false;   // NOM/ADJ INVARIABLE en -s/-x/-z : sa forme est la MEME au singulier et au pluriel (noix, voix, prix, croix, choix, temps, bras, heureux) => compatible avec un determinant SINGULIER. Sans ca, le filtre de nombre lisait le -x final comme une marque de pluriel et ecartait « noix » apres « la/une » (« la nois »→fois au lieu de noix).
      var st=w.slice(0,-1);if(SP.WORDS&&SP.WORDS.has(st)&&/[NA]/.test(SP.POS[st]||''))return false;   // le radical est lui-meme un NOM/ADJ => la forme EST un pluriel (chats/chat, bijoux/bijou, boites/boite)
      if(/aux$/.test(w)&&SP.WORDS&&SP.WORDS.has(w.slice(0,-3)+'al'))return false;   // pluriel en -aux d'un nom en -al (journaux/journal, chevaux/cheval)
      if(w==='yeux'||w==='cieux'||w==='aieux'||w==='æieux'||w==='aïeux')return false;   // pluriels irreguliers (radical introuvable)
      return true;}
    function nmP(x){return sInvarS(x)?null:/[sx]$/.test(deaccS(x));}   // nombre PORTE par la forme : null = invariable (compatible des deux cotes)
    // Un « -s » final n'est une marque de PLURIEL que sur un NOM ou un ADJECTIF ; sur un VERBE c'est la 2e
    // personne du SINGULIER (« tu viens »), le bonus de nombre n'a rien à y faire. ⚠️ HONNÊTETÉ : garde MESURÉE
    // INERTE sur le corpus dys réel (chiffres identiques avec et sans) — gardée parce que le raisonnement est
    // FAUX sans elle, pas parce qu'elle gagne. Gains du jour préservés : les/jours/petits/tiges… sont N ou A.
    function nm(x){if(!cn)return 0;var ps=SP.POS[x]||'';if(ps.indexOf('V')>=0&&ps.indexOf('N')<0&&ps.indexOf('A')<0)return 0;var p=nmP(x);return (p===null||((cn==='p')===p))?1:0;}
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
      var nx=nm(x),ny=nm(y);if(nx!==ny)return ny-nx;
      return cand[y][1]-cand[x][1];});
    var w1=keys[0],p1=cand[w1][0],f1=cand[w1][1];
    /* DÉTERMINANT : le GENRE du NOM SUIVANT domine la fréquence (doctrine aide-frappe ②, enquête
       des 22, texte6 réel : « dans uen maison » proposait « un ») — si le candidat retenu est un
       déterminant genré, que le nom qui suit porte un genre PUR opposé et que le jumeau de
       l'autre genre est aussi candidat, le jumeau gagne. */
    var _DPAIR={un:'une',une:'un',le:'la',la:'le',ce:'cette',cette:'ce',cet:'cette'};
    if(_DPAIR[deaccS(w1)]&&T&&idx!=null&&idx+1<T.length){
      var _nw=T[idx+1].toLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae');
      if(SP.WORDS.has(_nw)){                                     // POS clairsemée (« maison » sans entrée) : sGender pur suffit, null → pas d'échange
        var _ng=sGender(_nw),_dg=DET_G[deaccS(w1)],_pr=_DPAIR[deaccS(w1)];
        if(_ng&&_dg&&_ng!==_dg&&DET_G[deaccS(_pr)]===_ng){
          var _dl=deaccS(low),_dp=deaccS(_pr);
          var _ana=_dl.split('').sort().join('')===_dp.split('').sort().join('');   // « uen »/« une » : anagramme — la transposition n'est pas dans edits1
          if(cand[_pr]||_ana||sEd1(_dl,_dp)){w1=_pr;if(cand[_pr]){p1=cand[_pr][0];f1=cand[_pr][1];}else{p1=1;f1=SP.FREQ[_pr]||0;}}}}}
/* OMISSION — NE PAS RACCOURCIR CE QUE L'UTILISATEUR A DÉJÀ RACCOURCI. Miroir exact de l'app.
     La faute dys la plus courante est d'OMETTRE des lettres, et le moteur répondait parfois par un mot
     PLUS COURT que la saisie (« afreuses »→affreux au lieu d'affreuses). Mesuré sur 6 000 non-mots
     WiCoPaCo : 135 réponses plus courtes, dont 114 où le BON mot était DÉJÀ candidat = re-classement.
     ⚠️ Discriminateur = le COÛT, pas la fréquence : (a) sous-suite, (b) MÊME initiale, (c) strictement
     plus proche que la réponse courante. Ainsi : +55 réparés, 0 cassé. Ne change que la CIBLE. */
    if(deaccS(w1).length<d.length){var _cc=_levB(d,deaccS(w1),9),_bs=null,_bd=0,_k2;
      for(_k2=0;_k2<keys.length;_k2++){var _c2=keys[_k2],_dc=deaccS(_c2),_dl=_dc.length-d.length;
        if(_dl<=0||_dl>=_cc||_dc.charAt(0)!==d.charAt(0)||!subseq(d,_dc))continue;
        if(_bs===null||_dl<_bd||(_dl===_bd&&cand[_c2][1]>cand[_bs][1])){_bs=_c2;_bd=_dl;}}
      if(_bs){w1=_bs;p1=cand[w1][0];f1=cand[w1][1];}}
    
    if(tok[0]!==tok[0].toLowerCase()&&deaccS(w1)!==d)return null;   // capitalisé : seule la restauration d'accent
    if(cg&&(SP.POS[w1]||'').indexOf('A')>=0){var ad=ADJP[deaccS(w1)];if(ad&&ad[0]!==cg&&cand[ad[1]]&&sGender(ad[1])===cg)return['flag',ad[1]];}
    if(f1<0.1)return null;
    var f2=keys.length>1?cand[keys[1]][1]:0,accentOnly=(p1===2&&deaccS(w1)===d),dominant=(f1>=1.0&&(f2===0||f1>=5*f2));
    if(d.length>=3&&accentOnly&&dominant)return['auto',w1];
    var na=0;for(i=0;i<keys.length;i++)if(cand[keys[i]][0]===2)na++;
    if(d.length>=3&&p1===2&&f1>=1.0&&na===1)return['auto',w1];
    /* GLISSEMENT MOTEUR — quand toutes les LETTRES sont là, le mot n'est pas en doute : on AFFIRME.
       Miroir EXACT de l'app. Deux conditions CUMULÉES, c'est leur intersection qui vaut :
         ① le lexique n'offre qu'UN SEUL candidat → le choix n'est pas un pari ;
         ② l'écart n'est qu'un ORDRE de lettres ou un REDOUBLEMENT → un doigt a glissé.
       MESURÉ : 24 tirs / 24 justes sur 474 phrases dys/GEC appariées ; sur 14 450 phrases CORRECTES,
       8 tirs et tous sur de VRAIES fautes du corpus ⇒ FP = 0 littéral.
       ⚠️ ① SEULE tire 65 fois sur ces 14 450 phrases et réécrit des mots ÉTRANGERS en silence
       (flight→light, kommune→commune) : c'est ② qui les écarte tous.
       Ici l'enjeu est plus grand que dans l'app : « auto » est appliqué EN SILENCE À LA FRAPPE. */
    if(keys.length===1&&d.length>=4&&f1>=1.0&&_slipMot(d,deaccS(w1)))return['auto',w1];
    var _aux=false;if(T){var _z=idx-1;while(_z>=0){var _dz=deaccS(T[_z].toLowerCase());if(SAUXAV[_dz]||SCOPULA[_dz]){_aux=true;break;}if(_dz==='ne'||_dz==='n'||_dz==='pas'||_dz==='plus'||_dz==='jamais'||_dz==='bien'||_dz==='tres'||_dz==='deja'||_dz==='toujours'||_dz==='y'||_dz==='en'||_dz==='tout'){_z--;continue;}break;}}
    if(_aux&&/e$/.test(w1)&&!/é$/.test(w1)){var _pe=w1.slice(0,-1)+'é';if(cand[_pe]&&cand[_pe][1]>=1.0)return['flag',_pe];}   // PARTICIPE APRÈS AUXILIAIRE avoir/être : le dys écrit le PRÉSENT (-e) là où l'aux impose le PARTICIPE (-é) du MÊME verbe — « il a manje/manjé »→mangé. Ne touche QUE le présent -e (jamais pris/fait/vu en -s/-t/-u) ⇒ FP=0.
    var _cgd=(T&&idx>0)?DET_G[deaccS(T[idx-1].toLowerCase())]:null;   // GENRE du DETERMINANT immediat (audible, fiable) — pas la marche arriere sCtxGender, qui peut lire un genre POLLUE sur un mot-outil (« des » porte un genre dans le lexique relache)
    if(expPos){var _b=null,_bf=0;for(i=0;i<keys.length;i++){var _cw=keys[i];   // CONTEXTE-FIRST : candidat édit-1/accent + MÊME clé phonétique + POS attendu + NOMBRE du contexte → flag même court/non-dominant (pri→pris, von→vont, pleu→pleut ; respecte le nombre)
      if(cand[_cw][0]>=1&&phonKey(_cw)===pk&&pm(_cw)&&(!inpAud||fin_aud(_cw))&&(expPos.indexOf('V')>=0||!cn||nmP(_cw)===null||((cn==='p')===nmP(_cw)))&&(!_cgd||!sGender(_cw)||sGender(_cw)===_cgd)&&cand[_cw][1]>_bf){_b=_cw;_bf=cand[_cw][1];}}   // AUDIBILITÉ : saisie à finale audible (é) → context-first ne re-choisit QUE des candidats à finale audible (manjé→mangé). Miroir app.
      if(_b&&_bf>=1.0&&!(pm(w1)&&cand[w1][0]>=1&&cand[w1][1]>=20*_bf))return['flag',_b];}   // GARDE DE DOMINANCE (2026-08-22) : si le vainqueur du tri colle déjà au POS et est ≫20× plus fréquent, la ré-sélection phonétique ne le détrône pas (« un chein »→chien, pas « chin » 3/M) — même garde que le tri, parité Python (qui rend chien)
    if(!(d.length>=4&&f1>=1.0))return null;
    // CONFIANCE : n'AFFIRMER (rouge) que si sûr — accent pur, OU édit-1 gardant la 1re lettre, SEUL de son rang, dominant.
    // Sinon VIGILANCE orange « à vérifier » (n'impose pas un mauvais mot : courrir→courrier, ceuille→feuille). Mesuré sur dictées réelles.
    var firstOk=deaccS(w1).charAt(0)===d.charAt(0),nTop=0;for(i=0;i<keys.length;i++)if(cand[keys[i]][0]===p1)nTop++;
    var finalS=(p1>=1&&deaccS(w1).length===d.length+1&&deaccS(w1).slice(0,d.length)===d&&/[sx]$/.test(deaccS(w1)));   // faute dys « lettre finale muette » : candidat = original + s/x final (préfixe commun) → SÛR (FP=0 mesuré sur 2500 phrases UD ; dehor→dehors, alor→alors, moin→moins…) donc APPLIQUÉ, pas vigilance
    /* SUBSTITUTION DE LA CONSONNE FINALE : ne jamais AFFIRMER. C'est là que les patronymes se
       séparent (Durand/Durant, Renaud/Renault) et que la finale muette porte le sens (poids/pois).
       « durand » cochait firstOk+nTop===1+dominant et partait APPLIQUÉ en silence. Mesuré :
       0 correction de ce type sur les 46 appliquées des 2 500 phrases UD, 0 vraie faute dys
       démotée sur 14. On retire une AFFIRMATION, pas un signalement : reste en orange. */
    var _wd=deaccS(w1),_subFin=(d.length===_wd.length&&d.length>=4&&d!==_wd
      &&d.slice(0,-1)===_wd.slice(0,-1)&&'aeiouy'.indexOf(d.slice(-1))<0&&'aeiouy'.indexOf(_wd.slice(-1))<0);
    var confident=accentOnly||finalS||(!_subFin&&p1>=1&&firstOk&&nTop===1&&dominant);
    return [confident?'flag':'vigilance',w1];}
  // MOVER SYNTAXIQUE de l'impératif — placement des pronoms clitiques (MIROIR de dictee/imperative_clitics.moves) → span:N
    // ===== DICTIONNAIRE UTILISATEUR (miroir de l'app) =====
  // Mêmes gardes que l'app, mais le STOCKAGE diffère par nature : l'app a localStorage (une origine),
  // l'extension doit suivre l'utilisateur sur TOUS les sites -> `chrome.storage.local`, qui est ASYNC.
  // dys-core reste SYNCHRONE (parité/tests Node) : il ne détient qu'un Set, que content.js remplit au
  // démarrage (udSet) et repersiste à chaque ajout. Ne fait que RETIRER des signalements -> FP=0 sans objet.
  var _UD=new Set();
  function udNorm(w){ return (w||'').toLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae').trim(); }
  function udSet(list){ _UD=new Set((list||[]).map(udNorm)); return _UD.size; }
  function udAll(){ return Array.from(_UD); }
  function udHas(w){ var n=udNorm(w); return _UD.has(n)||_UD.has(deaccS(n)); }
  function udAdd(w){ var n=udNorm(w); if(!n)return false; _UD.add(n); return true; }
  function udDel(w){ _UD.delete(udNorm(w)); }

  // ===== TÉMOIN AUDIBLE (miroir app) : la lettre finale MUETTE s'ENTEND dans un mot de la MÊME
  // FAMILLE — grand/grandE, long/lonGUe, amoureux/amoureuSE. Table produite par
  // `dictee/build_famille.py` (aucune ressource externe) ; plancher de fréquence 5 sur le témoin,
  // sinon on affichait « chat -> chaté » / « chocolat -> chocolate ». Alternance du -x bornée aux
  // motifs réguliers du genre, sinon on fabriquait de FAUSSES familles (« prix -> prise »).
  var _FAM={"accord":"accorde","affreux":"affreuse","affront":"affronter","allemand":"allemande","amoureux":"amoureuse","appart":"appartement","apport":"apporté","arrêt":"arrête","avant":"avantage","avocat":"avocate","bloc":"bloqué","blond":"blonde","cent":"centaine","chanceux":"chanceuse","chant":"chante","chat":"chaton","chaud":"chaude","choc":"choqué","client":"cliente","command":"commande","comment":"commentaire","confort":"confortable","contact":"contacté","correct":"correctement","courageux":"courageuse","coût":"coûte","creux":"creuse","curieux":"curieuse","célibat":"célibataire","dangereux":"dangereuse","dent":"dentiste","deux":"deuxième","différent":"différente","direct":"directe","document":"documentaire","doux":"douce","drag":"dragon","droit":"droite","délicat":"délicate","délicieux":"délicieuse","emprunt":"emprunté","exact":"exacte","froid":"froide","front":"frontière","fréquent":"fréquente","furieux":"furieuse","goût":"goûte","grand":"grande","gratuit":"gratuite","group":"groupe","géant":"géante","généreux":"généreuse","habit":"habite","haut":"haute","heureux":"heureuse","idiot":"idiote","immédiat":"immédiatement","impatient":"impatiente","indic":"indice","infect":"infecté","innocent":"innocente","intelligent":"intelligente","jaloux":"jalouse","joyeux":"joyeuse","lent":"lentement","loup":"loupé","lourd":"lourde","malheureux":"malheureuse","merveilleux":"merveilleuse","mystérieux":"mystérieuse","nerveux":"nerveuse","nombreux":"nombreuses","patient":"patiente","permanent":"permanente","petit":"petite","poignard":"poignardé","port":"porte","post":"poste","profit":"profite","profond":"profonde","prudent":"prudente","précieux":"précieuse","présent":"présente","prêt":"prête","puissant":"puissante","quart":"quartier","rapport":"rapporte","regard":"regarde","rejet":"rejeté","relax":"relaxe","religieux":"religieuse","report":"reporter","respect":"respecte","récent":"récente","saut":"saute","second":"seconde","souhait":"souhaite","sport":"sportif","stand":"standard","supplément":"supplémentaire","support":"supporte","suspect":"suspecte","sénat":"sénateur","sérieux":"sérieuse","tard":"tarder","tort":"torture","tout":"toute","trac":"trace","trad":"tradition","transport":"transporter","vent":"vente","écart":"écarte","éclat":"éclate","époux":"épouse"};
  function famHint(w){
    w=(w||'').toLowerCase(); var t=_FAM[w];
    // RÈGLE (pas un témoin) : le son /mɑ̃/ final s'écrit TOUJOURS « -ment ». Vérifié : 435 mots en
    // -ment contre 5 en -men sans t (abdomen, amen, examen, gentlemen, spécimen), tous en /mɛn/.
    if(!t && /ment$/.test(w) && w.length>5)
      return 'Le t de « -ment » ne s’entend jamais, mais tous les mots en -ment le prennent.';
    if(!t) return '';
    return 'Le ' + w.charAt(w.length-1) + ' muet s’entend dans « ' + t + ' » (même famille).';
  }
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
  // ----- VOIE '' de spellUnknown : ÉQUIPER d'une suggestion des « mot inconnu » DÉJÀ soulignés -----
  // ENQUÊTE 04/09/2026 (88 fautes réelles à ce palier, sur 1 140 ratés du pipeline) : la cause dominante
  // d'absence de suggestion est la distance d'édition ≥ 2 (83/90), PAS les gardes. Deux générateurs,
  // mêmes pools, zéro asset nouveau — S6 ÉLISION (tête d/l/j/n/m/t/s/c/qu + reste corrigé) PRIORITAIRE,
  // puis S4 CLÉ PHONÉTIQUE À DISTANCE 1 (edits1 sur la CLÉ, lookup PHON, classement fréquence).
  // Mesuré : top-1 32/88 · propose sur 60/88 · UD ~33/96 mots inconnus équipés (la fatigue reste
  // DERRIÈRE le clic : AUCUNE marque nouvelle, on n'équipe que des soulignés existants) · coût ~0 ms.
  // ÉCARTÉS par l'enquête (ne pas rebrancher sans nouvelle mesure) : S1 edit-2 (104 ms/token, 60 % de
  // fatigue UD) · S5 mot-collé (2 vrais cas). Miroir Python : speller_probe.spell_unknown (_su_elision/_su_phon_e1).
  function _suElision(low){var heads=[];
    if(SELIDE[low[0]]&&low.length>=4)heads.push([low[0],low.slice(1)]);
    if(low.slice(0,2)==='qu'&&low.length>=5)heads.push(['qu',low.slice(2)]);
    for(var hi=0;hi<heads.length;hi++){var h=heads[hi][0],rest=heads[hi][1],dr=deaccS(rest),hits={},ord=[],i,j,w,a;
      a=SP.D2A[dr]||[];for(i=0;i<a.length;i++){w=a[i];if(hits[w]==null){hits[w]=[2,SP.FREQ[w]||0];ord.push(w);}}
      a=SP.PHON[phonKey(rest)]||[];for(i=0;i<a.length;i++){w=a[i];if(Math.abs(deaccS(w).length-dr.length)<=2&&hits[w]==null){hits[w]=[1,SP.FREQ[w]||0];ord.push(w);}}
      var e1=sEdits1(dr);for(i=0;i<e1.length;i++){a=SP.D2A[e1[i]];if(a)for(j=0;j<a.length;j++){w=a[j];if(hits[w]==null){hits[w]=[0,SP.FREQ[w]||0];ord.push(w);}}}
      ord.sort(function(x,y){return hits[y][0]-hits[x][0]||hits[y][1]-hits[x][1];});   // tri stable → départage = ordre d'insertion (D2A > phon > edits1), comme le miroir Python
      for(i=0;i<ord.length;i++){w=ord[i];if(SVOW[deaccS(w).charAt(0)]&&(SP.FREQ[w]||0)>=0.1)return h+"'"+w;}}
    return null;}
  function _suPhonE1(low){var hits={},best=null,bf=-1,i,j,e1=sEdits1(phonKey(low));
    for(i=0;i<e1.length;i++){var a=SP.PHON[e1[i]];if(a)for(j=0;j<a.length;j++){var w=a[j];if(hits[w]==null){hits[w]=1;var f=SP.FREQ[w]||0;if(f>bf){bf=f;best=w;}}}}   // > strict : à fréquence égale le premier inséré gagne (miroir Python)
    return best;}
function spellUnknown(tok,atStart,T,idx){
    if(!SP.ready)return null;
    var low=tok.toLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae');
    if(low.length<3||!isAlphaS(low))return null;
    if(SP.WORDS.has(low)||SP.WORDS.has(deaccS(low)))return null;            // mot connu (ou connu sans accents)
    if(udHas(low))return null;                                              // dictionnaire utilisateur (prénom/jargon)
    if(_SPELL_KEEP[low])return null;                                       // mot anglais fréquent / résidu d'ordinal (the/er) → ni corrigé ni signalé « inconnu »
    if(tok[0]!==tok[0].toLowerCase())return null;                          // majuscule → possible nom propre (Nathalie/Bordeaux) même en début de phrase → on ne flague pas (prudence)
    if(tok===tok.toUpperCase()&&tok.length>=2)return null;                  // acronyme tout-capitale
    var d=deaccS(low);
    if(!/[aeiouy]/.test(d)||/^[ivxlcdm]+$/.test(d))return null;             // sigle sans voyelle / chiffre romain
    var best=null,bf=-1,ba=-1,arr=(SP.D2A[d]||[]).slice(),i,j,w,a;          // candidat best-effort (accents + phonétique + édit-1), même initiale
    var pa=SP.PHON[phonKey(low)]||[];for(i=0;i<pa.length;i++)arr.push(pa[i]);
    var e1=sEdits1(d);for(i=0;i<e1.length;i++){a=SP.D2A[e1[i]];if(a)for(j=0;j<a.length;j++)arr.push(a[j]);}
    var _iaU=/é$/.test(low);                                               // AUDIBILITÉ (orange) : saisie à finale /e/ (é) → proposer l'audible (afolé→affolé), PAS le muet plus fréquent. Miroir app. Orange hors FP=0.
    var _pkU=phonKey(low),_bh=-1;                                          // AUDIBILITÉ (doctrine) : le dys écrit ce qu'il ENTEND. Un candidat HOMOPHONE passe avant un candidat seulement proche à l'œil — sinon « koi » se corrige en « ko » (fréquent, muet) au lieu de « quoi » (homophone). La garde de même première LETTRE écartait justement k/qu, c/qu, f/ph : on l'ouvre quand la clé phonétique est IDENTIQUE.
    for(i=0;i<arr.length;i++){w=arr[i];var _hm=phonKey(w)===_pkU?1:0;if(!_hm&&deaccS(w).charAt(0)!==d.charAt(0))continue;var _au=(_iaU&&/(é|ée|és|ées|er|ez|ai|ais|ait)$/.test(w))?1:0,_fq=SP.FREQ[w]||0;if(_hm>_bh||(_hm===_bh&&(_au>ba||(_au===ba&&_fq>bf)))){_bh=_hm;ba=_au;bf=_fq;best=w;}}   // clé : audibilité d'abord (si saisie audible), puis fréquenceba=_au;bf=_fq;best=w;}}
    if(best&&T&&idx!=null&&idx+1<T.length){                              // DÉTERMINANT : le genre du NOM SUIVANT domine la fréquence (« uen maison »→une) — même règle que le noyau, pour la voie best-effort
      var _dp2={un:'une',une:'un',le:'la',la:'le',ce:'cette',cette:'ce',cet:'cette'}[deaccS(best)];
      if(_dp2&&DET_G[deaccS(best)]){var _nw2=T[idx+1].toLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae');
        if(SP.WORDS.has(_nw2)){var _ng2=sGender(_nw2);
          if(_ng2&&_ng2!==DET_G[deaccS(best)]&&DET_G[deaccS(_dp2)]===_ng2){
            var _da2=deaccS(low).split('').sort().join('')===deaccS(_dp2).split('').sort().join('');
            if(_da2||sEd1(deaccS(low),deaccS(_dp2)))best=_dp2;}}}}
    if(best&&best!==low)return best;
    var _g=_suElision(low)||_suPhonE1(low);                                 // VOIE '' : équiper le souligné existant (S6 puis S4) — orange AU CLIC, jamais une marque nouvelle
    return (_g&&_g!==low)?_g:'';                                            // '' = inconnu sans suggestion fiable (simple alerte)
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
  function _plu(w){var d=deaccS(w);if(_PL_SUPPL[d])return _PL_SUPPL[d];if(_PL_OUX[d])return w+'x';if(_PL_AILAUX[w])return w.slice(0,-3)+'aux';if(/al$/.test(d))return w.slice(0,-2)+'aux';if(/(eau|au|eu)$/.test(d))return w+'x';return w+'s';}   // orange : réutilise les listes closes irrégulières + supplétifs (miroir rouge) → « des bail »→baux, « des œil »→yeux
  /* DISTILLATION INVERSE mou->squelette (2026-08-21) : le juge B2 tait ~2/3 de la fatigue
     « accord pluriel » — sa compétence est RE-CRISTALLISÉE ici en carte logistique locale
     (dictee/distill_pluriel.py : 6 137 oranges étiquetées par le juge + 6 000 justes GÉNÉRÉES
     par le squelette — sans elles la carte ne peut pas apprendre à garder « les propriétaire »).
     Mesuré sur held-out disjoint de tout entraînement : 19/19 oranges justes dys GARDÉES
     (seuil 0.9, la plus proche menacée à p=0.79), ~53 % de la fatigue tue — pour TOUS, sans
     opt-in, sans modèle téléchargé. Le juge opt-in reste au-dessus et en tait davantage. */
  var PLURIEL_TAIS={"prior": 1.49, "lr": {"tok=pre": 2.495, "pv=les": 0.217, "pv2=kalinskaya": 0.703, "nx=inscriptions": 0.703, "detPL": -3.534, "tok=symetrie": -0.213, "pv2=symetries": -0.213, "nx=continues": -0.213, "pv=des": -1.555, "pv2=dans": -1.867, "nx=nous": -0.878, "tok=ecouter": 1.51, "pv2=a": 3.108, "nx=carmine": 0.352, "tok=eco": 3.489, "pv=anciens": 0.281, "pv2=les": 2.082, "nx=paysans": 0.281, "tok=tige": -0.453, "pv2=passer": -0.455, "nx=dans": -0.341, "pv2=essai": -0.198, "nx=definitifs": -0.198, "tok=meme": -0.236, "pv2=portant": -0.212, "nx=noms": -0.275, "tok=propriete": -1.249, "pv2=<>": -0.493, "debut": -0.493, "tok=crypto": 1.204, "pv=certains": 0.395, "pv2=commercialiser": 1.204, "tok=odeur": -0.217, "nx=de": -1.101, "tok=famille": -0.257, "pv=publics": -0.625, "nx=avec": 0.305, "tok=nouvelle": 0.269, "pv2=contre": -1.311, "tok=singerie": 0.225, "pv=qu'une": 2.266, "pv2=heritages": 0.225, "tok=auquel": 1.596, "pv=obediences": 0.852, "nx=s'opposent": 0.607, "tok=super": 3.718, "pv2=apres": -0.219, "nx=heros": 0.702, "tok=plein": -1.427, "pv=frisons": -0.296, "pv2=petits": -0.834, "nx=le": -1.474, "tok=decision": -0.329, "pv2=entacher": -0.158, "nx=prises": -0.261, "tok=resultat": -1.084, "nx=ne": -0.398, "tok=verbe": -0.226, "pv=mes": -3.871, "tok=bac": -1.118, "pv=une": 1.695, "nx=moins": -0.742, "detSG": 3.185, "tok=matin": 0.802, "pv=le": 0.261, "pv2=des": 2.481, "nx=elle": -0.317, "pv=d'une": 4.242, "pv2=pieces": 0.37, "tok=personne": -0.508, "pv2=cote": -0.336, "nx=que": -0.355, "tok=chimique": -1.203, "pv=etudes": -0.435, "nx=et": -0.506, "pv2=sur": -0.927, "tok=frein": -0.328, "pv2=dont": -1.63, "nx=a": -0.218, "tok=feminine": -0.822, "pv=champions": -0.801, "pv2=clubs": -0.801, "tok=dextrane": -0.179, "nx=amphiphiles": -0.179, "tok=royale": 0.167, "pv=cour": 0.167, "pv2=la": -0.398, "pv2=avec": -0.439, "tok=determinant": 0.559, "pv2=sont": -0.746, "nx=boire": 0.181, "tok=fleur": -0.456, "nx=qui": -0.858, "pv2=le": -0.944, "tok=burgonde": 0.211, "pv=un": -0.18, "pv2=textes": 0.211, "tok=fille": -0.514, "pv2=eaux": 0.32, "tok=meticuleuse": -0.439, "pv=generations": -0.439, "tok=chercheur": -0.813, "pv2=selon": -1.099, "tok=moment": -0.736, "pv2=fois": 0.395, "pv2=faire": 0.899, "tok=centaine": -0.608, "tok=mimique": -0.67, "pv=exactes": -0.67, "pv2=theatrales": -0.67, "nx=jonglerie": -0.67, "pv2=maintenant": -0.248, "pv=ses": -4.95, "pv2=et": 0.798, "nx=sont": -1.53, "tok=reanimateur": 0.484, "pv=l'anesthesiste": 0.384, "pv2=d'urgence": 0.396, "pv=la": 0.873, "tok=tunique": -0.197, "nx=officielles": -0.186, "tok=pire": -0.224, "pv2=dicta": -0.152, "nx=conseils": -0.184, "pv2=par": -0.434, "nx=ont": -0.55, "tok=chercher": 3.217, "pv2=vont": 1.332, "tok=libre": -1.769, "pv=poudre": -1.161, "nx=aura": -1.324, "tok=premier": -0.604, "tok=condition": -0.944, "pv2=voir": -0.202, "nx=memes": -0.183, "pv=visiteurs": -0.545, "tok=debut": 1.981, "pv=cette": 1.37, "tok=espece": -1.709, "tok=radio": 0.232, "pv=appels": -0.527, "pv2=vaisseaux": -0.483, "nx=est": 1.176, "pv2=chez": -1.119, "tok=arracher": 1.072, "pv2=pour": 2.291, "pv2=comme": -1.24, "nx=ils": -1.005, "tok=race": -0.164, "pv=ces": -3.023, "nx=blasees": -0.16, "tok=chasseur": -0.161, "nx=avaient": -0.2, "tok=immobiliser": 0.417, "pv2=de": 3.778, "pv=ce": -0.887, "tok=protestant": -0.272, "pv2=gaffe": -0.162, "tok=soir": 0.938, "pv2=partage": -0.292, "nx=d'entrainement": -0.292, "tok=cupide": -0.418, "pv=uns": 0.448, "nx=chez": -1.063, "tok=vetement": -0.372, "pv2=avoir": -0.307, "nx=transperces": -0.161, "tok=moyen": -1.344, "tok=initiant": -1.14, "pv2=en": 3.716, "tok=experience": -0.185, "nx=afin": -0.574, "tok=occupation": -0.415, "pv=objectifs": -0.402, "pv2=leurs": 3.091, "tok=gin": -0.694, "pv=trois": -2.143, "nx=tonics": -0.191, "pvNUM": -1.918, "tok=haute": -0.813, "tok=heure": -1.364, "pv2=passe": -0.231, "pv2=tel": -0.886, "tok=avril": 2.392, "nx=une": -0.276, "tok=grillon": -0.597, "pv2=loin": -0.19, "nx=chantaient": -0.19, "pv=notre": 0.624, "pv2=debuts": 0.172, "nx=petit": 1.811, "tok=angle": -0.308, "pv2=remousser": -0.215, "nx=d'un": 0.343, "tok=conduite": -0.24, "pv2=l'appartement": -0.24, "nx=d'eau": 0.388, "tok=abeille": -0.294, "pv2=vue": -0.165, "nx=chargees": -0.179, "pv2=hemiorganiques": -0.199, "tok=sarcomere": -0.204, "pv2=egaux": -0.204, "tok=genre": -1.232, "pv=flibustieres": -0.556, "pv2=boites": -0.556, "nx=spotify": -0.556, "tok=landier": -0.603, "nx=ta": -0.603, "tok=manuscrit": -1.508, "tok=annee": -0.256, "nx=jusqu'a": 1.489, "tok=richement": -0.594, "pv=palefreniers": -0.594, "pv2=deux": -0.523, "nx=vetus": -0.728, "tok=saucisson": -0.157, "pv2=d'antivoliser": -0.157, "nx=pur": -0.157, "pv2=traverse": -0.209, "nx=un": 0.51, "tok=peu": 1.176, "pv2=formes": 1.23, "tok=important": -0.415, "pv=buttage": 0.205, "pv2=un": -1.329, "tok=soustraire": -1.224, "tok=edaphiquement": 1.649, "pv=stations": 0.53, "pv2=trois": -0.33, "tok=femme": -1.767, "tok=atelectasie": -0.997, "pv=radiologiques": -0.997, "pv2=majeures": -0.997, "nx=epanchement": -0.997, "nx=pas": -0.436, "tok=abstraire": 0.952, "tok=communication": -0.767, "nx=implicites": -0.165, "tok=depot": -0.528, "tok=contact": -0.245, "pv=tout": 0.337, "pv2=jours": -0.385, "tok=forte": -0.532, "pv=ponctuations": -0.418, "nx=moyenne": -0.386, "tok=prairie": -0.437, "tok=consequence": -0.44, "tok=commune": -1.085, "tok=directeur": 0.488, "pv=l'ancien": 0.742, "pv2=inspirations": 0.521, "pv=nos": -4.762, "tok=periode": -0.152, "pv2=celebres": 0.41, "tok=chemin": -0.499, "pv2=ouvre": -0.154, "tok=element": -0.435, "pv2=pres": -0.217, "pv2=d'une": 1.875, "pv=quelques": -1.029, "tok=grand": -0.453, "pv2=retrouvee": -0.154, "nx=eleves": -0.202, "pv2=ames": 0.16, "nx=la": -0.609, "tok=constaterent": 0.596, "pv=hommes": 0.291, "tok=puissance": -0.203, "pv2=l'annee": -0.177, "tok=cle": -1.603, "pv2=modeles": -1.501, "nx=n'est": -1.188, "pv=leur": 0.23, "tok=cornet": -1.652, "pv2=son": -0.786, "tok=telle": -1.149, "pv=mediatiques": -0.641, "pv2=artistes": -0.641, "tok=salut": 0.499, "tok=population": -0.555, "pv2=peches": 0.151, "pv2=que": -0.79, "tok=dextrorsum": 0.604, "pv=spires": 0.604, "nx=celui": 0.451, "tok=mini": 6.562, "pv2=poulailler": 0.315, "nx=tables": 0.968, "tok=ancien": 0.273, "tok=plongeon": -0.277, "pv2=poisson": -0.277, "nx=ressemblent": -0.277, "pv2=beaucoup": -0.19, "tok=regime": -1.789, "tok=bloc": -1.385, "nx=du": -0.707, "tok=petite": -0.818, "tok=gousse": -0.168, "pv2=ecrasez": -0.168, "nx=d'ail": -0.168, "tok=brassant": 0.407, "tok=idee": -1.184, "tok=eurent": 0.653, "pv=ennemis": 0.653, "nx=peur": 0.653, "tok=main": -1.683, "tok=autre": -1.554, "pv2=toutes": -1.333, "tok=salle": -0.318, "pv2=meme": 0.626, "tok=planifier": 0.665, "nx=femelle": -0.185, "pv2=voyages": -0.68, "tok=artiste": -0.848, "tok=rembourser": 1.608, "pv2=pourrait": 1.608, "nx=qu'en": 1.608, "tok=siecle": -0.177, "pv=neuvieme": -0.405, "pv2=dix": 1.563, "nx=temoignent": 0.266, "pv2=noms": 0.249, "tok=bastion": -0.237, "pv2=mais": 0.823, "tok=galenique": 0.36, "pv=d'inspiration": 0.36, "pv2=ouvrages": 0.371, "tok=equipement": -0.689, "pv=d'ebarbage": -0.663, "pv2=volets": -0.663, "nx=special": -0.663, "pv2=reprises": 0.162, "tok=isotonique": -0.331, "pv=contractions": -0.331, "tok=etre": -0.607, "pv2=voix": 0.475, "pv=toute": 0.309, "pv2=ans": 0.425, "pv2=autres": 0.286, "tok=enfant": -1.161, "tok=audition": -0.22, "nx=solennelles": -0.18, "nx=aux": 0.912, "nx=se": -0.28, "pv2=mains": 1.044, "tok=seul": -0.353, "pv=d'un": 3.178, "nx=coup": 0.166, "tok=maintenir": 0.792, "nx=praticables": 0.599, "tok=probleme": -0.338, "pv2=concernant": -0.226, "pv2=portes": 0.725, "tok=compromission": -0.167, "pv2=pur": 0.257, "nx=politiques": -0.339, "tok=histoire": 0.442, "pv2=surtout": -0.57, "tok=comprehensible": 0.35, "pv=n'est": 1.099, "pv2=gromelot": 0.35, "pv=sa": 1.402, "tok=langue": -0.402, "tok=tirailleur": -0.522, "nx=marocains": -0.595, "nx=furent": -0.47, "tok=particule": -0.461, "tok=descendant": -0.557, "pv=leurs": -3.92, "nx=e": 1.978, "tok=mere": 0.15, "pv2=pouvoir": 1.184, "nx=mais": 0.159, "pv2=devant": 0.62, "tok=voici": 1.229, "pv2=importe": 1.229, "tok=momie": 0.273, "pv=vieille": 0.434, "pv2=qu'une": 0.686, "tok=methode": -0.575, "tok=froide": -0.669, "pv=d'eau": -1.079, "pv2=affusions": 1.016, "pv2=plus": -0.816, "tok=godasse": -0.174, "nx=les": -0.413, "tok=foirage": -0.275, "nx=monumentaux": -0.275, "tok=carole": -0.494, "pv=femmes": -0.89, "pv2=jeunes": -1.292, "nx=airs": -0.567, "tok=lundi": 3.327, "pv=ukrainiens": 0.207, "tok=voir": 0.437, "nx=tous": 1.078, "pv2=tous": -1.183, "tok=stock": -0.245, "pv2=encore": -0.811, "nx=americains": 0.247, "tok=tout": 4.042, "tok=intro": 1.398, "pv2=urbains": 0.245, "nx=urbains": 2.323, "nx=gens": -0.215, "tok=long": 0.487, "tok=semi": 3.137, "pv=zones": 0.462, "nx=urbaines": 0.462, "pv2=pourtant": -0.54, "nx=s'obstinent": -0.155, "tok=tour": 0.348, "pv=nouvelle": -0.745, "nx=chic": -0.252, "tok=pente": -0.245, "tok=profondeur": -0.196, "tok=paupiere": -0.518, "nx=quand": 0.295, "tok=jeunesse": -0.3, "tok=glaciale": -0.25, "pv=pluie": 0.369, "pv2=toits": 0.369, "nx=penetrant": 0.369, "tok=communiste": -0.248, "pv2=campagne": -0.185, "tok=toute": 0.897, "pv=eaux": 1.074, "pv2=ses": 2.752, "tok=utiliser": 1.138, "pv2=majorite": 1.204, "tok=voisin": -0.361, "tok=allumer": 0.282, "nx=car": 1.355, "tok=vieille": -0.175, "tok=compagnon": -0.361, "pv2=parmi": -1.375, "tok=vertu": -0.231, "tok=voila": 1.97, "pv2=dire": 0.76, "nx=permet": -0.952, "tok=galerie": -0.375, "nx=sous": 1.069, "tok=cerf": -0.315, "pv2=bois": 0.178, "pv2=pas": 0.967, "nx=qualites": -0.315, "tok=economique": -0.425, "pv=crises": -0.425, "nx=financiere": -0.425, "pv2=depend": 0.543, "nx=batteries": 0.783, "tok=voyageur": -0.516, "tok=apparition": -0.588, "pv=electrodes": -0.655, "nx=d'une": 0.222, "tok=photo": -2.189, "tok=actuel": 0.371, "pv=nom": -0.296, "pv2=nouveau": 0.366, "nx=navarin": 0.371, "tok=indienne": -0.542, "pv=nature": 0.211, "tok=pauvre": -1.881, "tok=discretement": 0.999, "pv=armes": 0.999, "pv2=vos": 1.115, "tok=caractere": -0.583, "tok=partie": 0.381, "pv2=episser": -0.162, "nx=plus": -1.21, "pv2=sauver": 0.171, "nx=cassettes": 0.171, "tok=sol": 0.722, "pv2=jaunes": 0.338, "tok=budgetaire": -0.686, "pv=d'equilibre": -0.686, "pv2=lois": -0.686, "nx=existent": -0.686, "tok=alouette": -0.679, "tok=rotir": 1.466, "tok=culturelle": -0.628, "pv=d'unification": -0.905, "pv2=domaines": -0.878, "tok=personnel": -0.772, "tok=regate": -0.686, "tok=physique": 0.461, "pv=corps": 0.461, "nx=emotionnel": 0.482, "tok=esthetique": -0.655, "pv=plusieurs": -0.894, "nx=cette": -0.432, "tok=lettre": -0.898, "tok=fin": 0.777, "tok=merveille": -0.169, "pv2=pays": 0.518, "tok=chef": -0.253, "pv2=apparences": 0.19, "tok=pseudo": 3.548, "nx=terroristes": 0.653, "nx=dont": -0.665, "tok=policier": -0.344, "tok=ville": -0.519, "tok=sainte": -0.597, "pv=d'histoire": -0.597, "pv2=passages": -0.597, "pv2=j'ai": -0.173, "pv2=arbres": -0.57, "nx=aussitot": 0.291, "tok=transformer": 1.783, "nx=especes": -0.234, "tok=ensemble": 0.933, "pv=cousant": 0.638, "tok=librement": 0.938, "pv=l'interpretent": 0.65, "pv2=plusieurs": 2.679, "tok=reuf": -0.343, "pv=ptits": -0.343, "tok=cordon": -0.161, "pv2=unis": 0.313, "tok=novembre": 1.994, "nx=m": 0.542, "tok=belle": -0.724, "nx=dames": -0.437, "tok=sensation": 0.631, "pv=phantosmies": 0.773, "tok=vivant": -0.664, "nx=l'occasion": -0.507, "tok=client": -0.39, "nx=je": -0.22, "tok=militant": 1.404, "tok=petit": -1.276, "pv2=maree": -0.225, "nx=bateaux": 0.422, "tok=scientifique": -0.736, "tok=armee": -0.914, "pv=parapolitiques": -0.63, "pv2=organes": -0.63, "nx=conseil": -0.63, "tok=solution": -0.23, "nx=permettant": -1.286, "tok=pouvoir": -0.431, "nx=rapportees": -0.169, "pv=cet": 0.831, "tok=jambe": -0.441, "tok=entreprise": -0.761, "pv=japonais": -0.607, "pv2=nos": 0.87, "nx=par": 0.814, "pv2=font": -0.446, "tok=croissance": 0.19, "pv2=ecotypes": 0.15, "pv2=regions": 0.487, "nx=fait": 0.161, "tok=medicastre": -0.181, "pv2=reputation": -0.181, "nx=italiens": -0.24, "tok=anticancereuse": -0.36, "pv=actions": -0.636, "tok=office": -0.247, "pv2=celebrer": -0.201, "pv=dixieme": -0.156, "pv2=sa": 0.456, "tok=conseil": -0.944, "nx=pour": -0.429, "tok=levre": -0.635, "tok=individuel": -0.496, "pv=classements": -0.496, "pv2=autant": 1.318, "nx=angulariser": 1.318, "tok=veritable": -0.331, "tok=savoir": 1.875, "pv=mon": 1.136, "pv2=avait": -0.505, "tok=vice": 2.656, "pv2=dernieres": 0.907, "nx=s'y": -0.23, "pv2=sous": -1.132, "tok=croupier": -0.167, "pv2=demeurant": -0.167, "nx=d'elections": -0.167, "tok=contenu": -0.185, "tok=ingredient": -0.413, "nx=juges": -0.197, "tok=chaud": -0.569, "pv=marrons": -0.569, "tok=legere": -0.269, "tok=hotel": -0.155, "tok=langage": 0.725, "pv2=muets": -0.693, "tok=conf": 1.434, "pv2=organisant": 1.434, "nx=calls": 1.434, "tok=ecraser": 1.435, "tok=parcoururent": 1.19, "pv2=eclairs": 1.211, "tok=ancetre": -0.68, "pv=tes": -1.664, "nx=anglais": -0.559, "tok=seringue": -0.51, "pv2=moutons": 0.504, "tok=historien": -0.266, "nx=n'ont": -0.596, "pv=flinta": -0.23, "nx=lesbiennes": -0.23, "tok=succursale": -0.2, "nx=lancent": -0.2, "tok=graphiste": 0.328, "pv=peintre": 0.328, "pv2=metiers": 0.328, "nx=photographe": 0.328, "pv=conditions": -0.17, "pv2=memes": 0.267, "nx=lesion": 0.274, "pv=vendredi": 0.751, "tok=pharmaceutique": -0.402, "pv=industries": -0.402, "nx=chimique": -0.402, "tok=caisse": 0.483, "tok=forcee": -0.899, "pv=d'abstinence": -0.899, "pv2=annees": -0.504, "pv2=clients": 0.543, "pv2=mots": -0.999, "tok=tenant": 0.187, "pv2=dolmance": -0.18, "nx=l'une": -0.18, "tok=effort": -0.446, "nx=marines": -0.192, "tok=essai": -0.28, "tok=papier": -0.172, "pv=imagination": 0.215, "nx=ni": 0.344, "tok=site": -0.393, "pv=meilleurs": -0.432, "pv2=cas": -0.251, "pv=jeune": 0.238, "pv=cuisses": 0.312, "tok=face": 1.449, "nx=rouge": 0.516, "tok=media": -0.699, "nx=aient": -0.194, "tok=inconnu": -1.743, "tok=folie": 0.32, "tok=comedien": -0.182, "pv2=trouver": -0.4, "tok=vegetation": -0.656, "nx=n'a": 0.336, "tok=demi": 7.335, "nx=perils": 0.152, "tok=dernier": -0.558, "tok=scotch": 1.132, "pv2=adorait": -0.535, "nx=terriers": 1.132, "tok=ante": -0.331, "pv=mots": -1.88, "tok=retourner": 1.019, "nx=remplies": 1.019, "pv2=toutefois": -0.165, "nx=grafignures": -0.165, "tok=phenomene": -0.274, "tok=couleur": -1.511, "pv2=levres": 0.337, "tok=conservant": 0.581, "tok=vendredi": 3.114, "pv=cops": 0.548, "nx=j'etais": 0.606, "tok=calcul": -0.484, "pv2=peu": -0.331, "tok=grace": 2.327, "pv=jours": 0.788, "tok=lesion": -0.165, "pv2=favoriser": -0.236, "pv2=gastros": 0.18, "tok=grande": -0.702, "nx=lois": -0.366, "tok=noce": -0.32, "tok=observer": 0.906, "tok=severe": -0.718, "pv=couilles": 0.263, "pv=immunitaire": 0.554, "pv2=metabolique": 0.554, "tok=version": 0.258, "pv2=amis": 1.479, "tok=sport": -0.619, "tok=viol": 0.2, "pv2=psychotraumatologiques": 0.2, "tok=endroit": -0.748, "nx=qu'il": 0.886, "tok=stimuli": 1.393, "pv=derniers": -0.427, "tok=homme": -0.852, "tok=visage": 0.153, "tok=encephalographie": 0.295, "pv=neuroradiologiques": 0.295, "pv2=examens": 0.295, "nx=gazeuse": 0.295, "tok=operation": -0.279, "pv2=reconnaitre": -0.245, "tok=milieu": 0.667, "pv=jusqu'au": 2.399, "pv=son": 0.53, "pv=petit": 0.835, "tok=flexion": 0.633, "pv=squats": 0.633, "pv2=six": -0.517, "nx=equipes": -0.234, "tok=comparant": 0.754, "tok=poil": -0.383, "tok=dimanche": -1.028, "tok=confortable": -0.586, "pv=pieces": -1.038, "nx=situe": -0.586, "pv2=fait": -0.418, "tok=migraine": -0.606, "nx=deux": -0.567, "tok=frotter": 0.599, "tok=cafe": -0.733, "pv2=alcools": 0.161, "tok=science": 1.216, "tok=circonscription": -0.257, "tok=circonstance": -0.719, "tok=boulimique": -0.185, "pv2=bonbons": -0.185, "tok=hair": 1.854, "pv2=elles": 1.347, "tok=video": -2.027, "nx=non": 0.387, "tok=aout": 2.432, "pv=vos": -1.831, "pv2=mirari": 1.448, "tok=clair": -0.851, "pv=bleu": 0.738, "pv2=saphirs": -0.851, "tok=socialiste": -0.694, "tok=sante": -0.554, "pv=aliments": -0.554, "nx=dits": -0.609, "nx=ses": -0.516, "tok=micro": 6.575, "nx=algues": 0.594, "tok=quatrieme": -0.465, "tok=mouvement": -0.559, "pv2=certaines": 1.067, "tok=gauche": 0.393, "nx=d'echantillon": -0.262, "pv2=toute": -0.859, "pv2=maisons": 0.152, "tok=blancheur": 0.174, "pv2=quenottes": 0.243, "pv2=americains": 0.312, "tok=geant": -0.485, "pv=escargot": -0.412, "nx=d'afrique": -0.412, "tok=blanche": 0.57, "tok=tropicale": 0.447, "pv=l'aube": 0.532, "pv2=instants": 0.447, "tok=metier": 0.759, "nx=long": -0.583, "tok=dent": -0.989, "tok=sodium": -0.528, "pv=canaux": -0.528, "nx=indispensables": -0.528, "pv2=dessus": 0.666, "tok=prevoir": 0.384, "tok=extra": 1.509, "nx=terrestres": 0.915, "nx=zephirii": -0.158, "tok=africaine": -0.8, "pv=d'ascendance": -0.8, "pv2=personnes": -1.066, "tok=franco": 1.663, "pv=troupes": 0.501, "nx=espagnoles": 0.501, "tok=irrealiste": -1.136, "pv=c'est": 1.247, "pv2=golgoths": -1.136, "nx=estime": -2.243, "tok=vendeen": 0.287, "pv=griffon": 0.287, "nx=epagneule": 0.287, "pv2=partis": 0.349, "nx=nombre": 0.253, "tok=tournant": -0.278, "pv=elements": -0.715, "tok=terrain": -0.294, "tok=miel": 1.024, "pv=pommes": 0.298, "tok=malade": 0.587, "pv=bete": 0.174, "nx=folies": -0.18, "pv=dents": -0.237, "tok=restaurant": -0.327, "pv=wagons": -0.437, "nx=entrant": -0.437, "nx=breton": -1.107, "tok=college": -0.891, "nx=etc": -0.332, "tok=eau": -1.157, "pv=basaltes": 0.905, "nx=ardechoise": 0.905, "tok=maison": -0.885, "tok=convoi": -0.577, "pv=convois": -0.526, "nx=administratif": -0.526, "tok=raisin": -0.787, "pv=produits": 0.267, "tok=pesant": 0.689, "pv=cent": -0.179, "nx=d'anchois": 0.293, "tok=petrole": -0.212, "pv2=desessencier": -0.212, "pv2=observer": -0.19, "tok=pommier": 0.248, "pv=poirier": 0.298, "nx=marronnier": 0.298, "tok=chiffon": -0.633, "pv=blancs": -0.971, "pv2=tissus": -0.59, "pv=ventas": 0.884, "nx=proche": 0.884, "tok=pere": -0.537, "pv2=prendre": -0.178, "pv2=fonctions": -0.607, "tok=cellule": -0.735, "tok=arbre": -0.795, "pv2=lorsque": -0.417, "tok=janvier": 1.917, "pv=decembre": 0.407, "nx=termitait": 0.407, "tok=drap": -0.221, "pv2=fin": -0.199, "tok=ouvrier": -0.548, "nx=occupes": -0.51, "nx=resistantes": -0.278, "tok=avion": -1.04, "nx=troncs": 0.436, "tok=transport": -0.652, "tok=soigner": 0.54, "nx=comme": 0.494, "tok=difficulte": -0.294, "pv2=presente": -0.335, "tok=picturale": 0.446, "pv=arts": 0.446, "nx=architecturale": 0.446, "tok=tribu": -1.799, "pv2=shiwas": -1.655, "nx=indienne": -1.612, "tok=ternaire": 0.163, "tok=derniere": -0.458, "pv2=descendait": -0.194, "tok=mot": -0.531, "tok=culpabiliser": 0.455, "pv2=sans": 3.413, "nx=assure": 0.474, "tok=commun": -0.682, "pv=onnes": -0.606, "pv2=per": -0.606, "tok=couvert": -1.909, "pv=passage": -1.225, "pv2=membres": 0.857, "tok=marron": 0.535, "pv=reprises": 0.535, "tok=fonction": -0.684, "nx=recompenses": -0.299, "pv=grande": 0.679, "tok=montagne": -0.637, "nx=basses": -0.332, "tok=convulsion": 0.198, "pv=gigantesque": 0.198, "tok=detail": -0.221, "tok=amish": 1.909, "pv=communautes": 0.693, "tok=service": -0.673, "tok=remercier": 0.414, "tok=foret": -0.45, "pv=taches": -0.299, "tok=joie": 0.468, "tok=fumee": -0.182, "nx=on": 0.371, "tok=diffuser": 0.716, "nx=aupres": 0.307, "pv=voie": 0.166, "pv2=enfants": 1.243, "tok=acide": 0.442, "pv2=produire": -0.393, "nx=responsables": 0.402, "pv2=seulement": -0.187, "tok=auteur": -0.857, "pv2=vu": -0.329, "tok=creer": 1.246, "pv2=faudrait": 0.81, "pv=ans": -1.134, "tok=exterminant": 0.963, "tok=argument": -0.498, "nx=tres": -0.95, "tok=ecole": -0.172, "pv2=plupart": -0.696, "pv2=theatre": -0.191, "tok=bonne": -0.516, "tok=protuberance": -0.174, "pv2=spectroscope": -0.174, "nx=solaires": -0.174, "pv2=cordes": 0.407, "pv=vague": 0.173, "tok=supporter": -0.238, "pv2=preconjugales": -0.161, "nx=traditionnels": -0.229, "tok=acetate": -0.815, "pv=phenylethanol": -0.815, "pv2=polaires": -0.743, "tok=porteuse": 0.473, "pv=cinglante": 0.473, "pv2=chroniques": 0.473, "tok=allee": -0.167, "pv2=entend": 0.93, "tok=deplacement": -0.263, "tok=forcat": -0.252, "tok=maintenance": 0.517, "pv=d'entretien": 0.517, "pv2=couts": 0.538, "tok=tradition": -0.248, "tok=phalange": -0.176, "pv2=specifiquement": -0.176, "nx=proximales": -0.176, "nx=dieu": 1.374, "tok=universite": 0.346, "tok=spartiate": 0.267, "pv=l'armee": 0.267, "pv2=decennies": 0.434, "nx=va": 0.483, "tok=touchant": 0.406, "tok=son": -2.402, "pv2=cirages": 0.599, "nx=dentifrices": 0.599, "tok=monsieur": 1.033, "pv=erreurs": 0.562, "nx=milch": 0.562, "tok=troisieme": 0.61, "pv2=lors": -0.189, "pv=objets": 0.408, "tok=acteur": -0.362, "tok=riche": -0.37, "pv2=ainsi": -0.264, "nx=voluptes": -0.164, "tok=emballer": 0.699, "tok=prelevement": -0.553, "pv2=pel": -0.166, "nx=sociaux": -0.166, "tok=pale": -0.441, "pv2=l'un": 1.605, "pv2=seneque": -0.171, "tok=matiere": -0.236, "tok=rejoindre": 0.892, "pv=vie": 0.446, "tok=breviaire": -1.67, "nx=manuscrit": -1.67, "tok=rural": 0.153, "pv=foyer": 0.153, "nx=grace": -0.274, "tok=apparence": -0.292, "nx=restaient": -0.48, "tok=lendemain": 1.101, "pv2=vers": -0.66, "tok=relation": -0.482, "tok=bigot": 0.451, "tok=sentiment": 0.312, "tok=radar": -1.287, "pv=ecrans": -1.287, "tok=semblablement": 0.186, "pv=quatre": -0.601, "nx=drape": 0.186, "nx=anciens": -0.714, "pv=culottes": -0.17, "tok=chouette": 0.344, "pv=canepetiere": 0.329, "pv2=outarde": 0.329, "nx=cheveche": 0.329, "tok=bon": 1.176, "pv=mener": 0.574, "nx=train": 0.574, "nx=jour": 0.414, "tok=passage": -0.334, "tok=ciel": 2.733, "nx=auxquelles": -0.281, "tok=entendre": 1.585, "nx=dire": 0.227, "tok=etablissement": -0.33, "tok=deambulant": 0.361, "pv=qu'alexandre": 0.361, "nx=es": -0.191, "nx=finales": 0.162, "nx=doivent": 0.211, "pv=allemands": 0.829, "pv2=goncourt": 0.196, "tok=defaut": 0.444, "tok=support": -0.287, "pv2=spitter": -0.163, "tok=gastro": 0.677, "pv=organes": 0.677, "nx=intestinaux": 0.677, "tok=rapport": -0.233, "pv2=etablit": -0.275, "tok=recueillir": 0.7, "pv2=du": 0.454, "pv2=conditions": 0.645, "tok=septembre": 1.942, "pv=samedi": 0.92, "pv2=nonnes": 0.451, "pv=toits": 0.533, "nx=glaciale": 0.638, "tok=film": -0.239, "tok=suspendant": 0.52, "tok=million": -0.424, "pv2=ou": 0.303, "tok=fine": -0.194, "nx=line": -0.187, "tok=vaste": 0.688, "pv=certain": 0.755, "pv2=boulevards": 0.688, "tok=categorie": -0.167, "nx=periurbaines": -0.216, "tok=semblant": 0.537, "tok=proie": -0.84, "pv=proteines": -0.848, "pv2=interagissantes": -0.848, "tok=acier": -0.621, "tok=colonne": -0.252, "tok=peintre": 0.348, "pv2=souvent": -0.591, "nx=figuratifs": -0.182, "tok=localiser": 1.482, "tok=rurale": -0.217, "pv2=affecte": -0.217, "tok=compassion": -0.587, "pv=suscitent": -0.587, "pv2=mutins": -0.587, "tok=orthokeratologie": 0.341, "pv=annees": 0.576, "tok=frappant": 1.133, "pv=murs": 0.831, "tok=vie": -0.203, "pv2=heures": 0.87, "tok=blog": -0.211, "tok=absolue": -1.188, "pv=virulence": -1.188, "tok=contraindre": 2.217, "nx=siestes": 0.28, "tok=exclure": -1.333, "tok=election": -0.415, "nx=etaient": -0.731, "tok=brisure": -0.252, "tok=echalote": -0.181, "pv2=recolte": -0.181, "tok=dissociation": -0.238, "pv=symptomes": -0.238, "pv2=certains": 0.673, "pv2=depuis": -0.448, "tok=contraction": -0.816, "pv=femtech": -0.591, "tok=administration": 0.156, "pv2=telegraphiste": -0.21, "nx=exigent": -0.21, "tok=aile": -0.906, "pv=facon": 0.536, "pv2=fenetres": 0.461, "nx=phenix": 0.461, "tok=etroit": -0.306, "pv=adjectifs": -0.306, "tok=fruit": -0.622, "tok=sortie": 0.311, "tok=profond": -0.827, "tok=dechet": -0.454, "tok=calmer": 0.971, "pv2=faut": 3.64, "pv=d'afrique": 0.719, "pv2=cinemas": 0.439, "tok=neuve": -0.608, "pv=belges": -0.162, "nx=carrosserie": -0.608, "tok=cotoyer": -0.153, "tok=quai": -0.4, "nx=populations": -0.175, "pv=productions": 0.359, "nx=liberiennes": 0.359, "tok=geographique": 0.261, "pv=nord": 0.619, "pv2=poles": 0.512, "pv=jeunes": -0.718, "nx=operateurs": -0.399, "tok=pierre": -0.361, "pv2=mehul": -0.196, "nx=regles": -0.196, "tok=fusion": -0.826, "pv=cuisines": -0.826, "pv2=premieres": -1.039, "tok=pied": -0.245, "tok=membre": -0.815, "tok=besoin": -0.378, "pv2=si": -0.573, "tok=caresser": 1.414, "pv2=pouviez": 1.414, "nx=commente": 1.414, "tok=vent": -0.677, "tok=quel": 1.35, "pv=idees": 0.576, "pv=staeliens": 0.184, "pv2=cahiers": 0.184, "nx=sera": 0.208, "tok=capacite": -0.211, "pv=essais": 0.993, "tok=envoyer": 1.798, "tok=partition": -0.179, "tok=information": -0.189, "tok=audio": 0.66, "pv=enregistrements": -0.599, "tok=projet": -1.069, "nx=russe": 0.328, "tok=gouvernement": -0.215, "pv2=patriotiques": 0.16, "tok=sole": -0.387, "tok=inviter": 2.032, "tok=curiosite": 0.367, "pv=autre": 0.692, "nx=voilees": -1.134, "tok=inadvertance": -0.152, "pv2=corriger": -0.191, "nx=ces": -0.675, "tok=etrier": -0.234, "nx=petits": -0.336, "tok=lacher": -0.245, "pv2=fallu": -0.409, "nx=bien": -0.569, "tok=agent": -0.28, "pv2=general": -0.195, "pv2=neuf": -0.193, "tok=jetat": 0.739, "pv2=mitoyennete": -0.178, "tok=radotage": -0.172, "nx=lui": -0.887, "pv2=tuer": -0.379, "tok=moteur": -0.262, "pv=manœuvres": -0.54, "nx=coupe": -0.54, "tok=belge": -0.411, "pv=cotes": -0.392, "nx=chef": 0.307, "tok=cime": -0.189, "tok=art": -0.678, "pv=bretons": -0.678, "pv2=musees": -0.678, "nx=japonais": -0.574, "tok=licenciable": -0.544, "pv=autres": -0.309, "tok=prochain": 0.931, "tok=canadienne": -0.924, "pv=communes": -0.59, "tok=tir": 0.819, "tok=elegant": -0.463, "tok=diner": -0.231, "tok=jetant": 1.307, "tok=etang": -0.277, "pv2=finistere": -0.277, "nx=palavasiens": -0.277, "tok=gorger": 0.66, "tok=dixieme": 0.482, "pv=huit": 0.558, "pv2=est": 0.861, "nx=couvert": 0.581, "tok=fichier": -0.732, "tok=mal": 0.763, "pv2=demineurs": 0.309, "nx=ca": 0.893, "pv=premiers": -0.274, "nx=remorques": 0.389, "tok=nord": 1.546, "pv=directions": -0.8, "nx=nord": -0.8, "pv2=ensemble": 0.226, "nx=organismes": 2.086, "pv2=revele": 0.617, "nx=varices": 0.617, "pv2=subir": -0.196, "pv2=reconnaissaient": -0.16, "tok=pronatrice": 0.166, "pv=foulee": 0.166, "nx=vers": 0.731, "pv=mig": 0.876, "nx=cri": 0.324, "tok=subsidiairement": 0.246, "pv=j'offre": 0.246, "pv2=frais": 0.291, "nx=d'en": 0.577, "nx=montagnes": -0.244, "tok=maladie": -0.773, "pv=arrets": -0.586, "tok=imiter": 1.028, "tok=association": 1.154, "tok=mecanisme": -0.189, "pv2=demonte": -0.161, "nx=d'horlogerie": -0.161, "tok=effet": -0.617, "tok=gond": -0.207, "pv2=moins": -0.28, "pv2=l'une": -0.255, "tok=seule": -0.261, "pv=actuelles": 0.522, "nx=hydrophiles": -0.225, "tok=inciter": 0.408, "tok=differente": -0.322, "tok=bouclier": -0.182, "pv2=peter": -0.362, "tok=dessin": -0.549, "pv=graphomotrices": -0.649, "pv2=activites": -0.597, "tok=intervention": -0.398, "pv2=villages": 0.396, "tok=decorer": 1.994, "nx=active": -0.566, "tok=steeple": -0.318, "nx=raisonnables": -0.318, "pv=jouets": -0.654, "tok=prioritaire": -0.938, "pv=insertion": -0.938, "pv2=champs": 0.349, "pv=vies": 0.744, "nx=prisonnier": 0.744, "tok=domaine": -0.521, "tok=enseignante": -0.583, "pv2=couper": -0.158, "nx=mec": -0.22, "pv=deux": -1.098, "tok=poison": -0.171, "tok=difficile": 0.503, "nx=d'avoir": 0.779, "tok=delirante": 0.247, "pv=joie": 0.302, "nx=l'envahit": 0.247, "tok=emulsion": -0.552, "pv=peintures": -0.587, "tok=aphteuse": 0.151, "pv=fievre": 0.151, "pv2=compter": -0.305, "tok=soupesant": -0.247, "nx=charcot": -0.247, "pv2=voila": -0.204, "tok=jeep": -0.234, "nx=americain": 0.365, "tok=qualite": -0.655, "nx=son": -0.921, "tok=naissance": 0.268, "tok=remplacer": 1.6, "pv2=hesiter": 0.942, "tok=buveur": -0.255, "nx=ma": -0.183, "tok=rouvrit": -0.333, "pv2=puis": 1.189, "tok=body": 0.3, "pv=influenceuses": 0.3, "pv2=geniales": 0.3, "nx=positive": 0.31, "tok=fonctionnaire": -0.778, "pv2=serrer": -0.286, "pv2=eu": -0.47, "tok=victime": -0.654, "tok=cœur": 1.041, "nx=assez": -0.531, "tok=maxi": 2.286, "nx=trimarans": 2.878, "pv=bleuets": 0.421, "nx=dit": 0.329, "tok=retard": 0.61, "tok=usurpation": -0.205, "pv2=reel": -0.205, "nx=d'identite": -0.205, "tok=longue": 0.441, "tok=agriculteur": -0.29, "tok=medoc": -0.217, "tok=retournant": 0.358, "pv2=alors": -0.455, "pv=mammiferes": 0.171, "tok=sejour": 0.376, "tok=grassette": -0.996, "pv2=employees": -0.996, "tok=correspondant": -0.976, "tok=technique": -0.328, "pv=premiere": 0.783, "tok=analyste": 0.694, "pv=treize": 0.898, "pv2=kevin": 0.898, "tok=mince": 1.62, "nx=pies": 1.322, "pv2=organise": -1.504, "nx=camps": -1.504, "nx=meme": 0.369, "pv2=outre": -0.382, "nx=pouvaient": -0.244, "tok=pot": -0.387, "pv=seul": 0.397, "tok=chien": -0.901, "tok=integrer": 0.455, "pv=principal": 0.735, "pv2=quelques": 1.837, "tok=samedi": 2.87, "nx=matin": -0.278, "tok=marcher": 0.923, "pv=marron": 0.323, "pv2=heritiers": 0.323, "tok=vert": 0.293, "pv=samovars": 0.973, "pv=cultivateurs": -0.297, "tok=vache": -0.211, "pv2=animale": -0.25, "tok=flore": -0.257, "tok=cheminee": -0.291, "nx=soudees": -0.265, "tok=fidele": -0.219, "tok=aider": 2.442, "nx=olivia": 0.374, "tok=toupie": -0.51, "pv=camions": -0.51, "nx=transportant": -0.51, "pv=deuxieme": 1.348, "pv2=soixante": -1.186, "nx=entre": -0.276, "tok=haut": 2.761, "nx=places": 1.733, "nx=capables": -0.502, "pv=reponses": -0.32, "tok=tarbouche": -0.287, "pv2=etienne": -0.287, "tok=karstique": -0.558, "pv=reseaux": -0.558, "tok=bouchon": -0.427, "pv2=visite": -0.632, "pv=confidences": 1.076, "pv2=taille": -0.181, "tok=gonzesse": -0.172, "pv2=point": -0.251, "pv2=howland": -0.25, "pv=contrevents": 0.286, "tok=motif": -0.265, "tok=architecte": -0.174, "pv2=dirigea": -0.168, "nx=new": -0.168, "tok=douce": 1.196, "pv2=terre": -0.156, "tok=ronce": -0.366, "tok=vainqueur": -1.469, "pv=fois": -0.278, "tok=huitante": 0.297, "pv=eptante": 0.297, "pv2=prononcent": 0.297, "nx=nonante": 0.297, "tok=expression": 0.494, "pv2=noirs": 0.244, "pv2=vient": 0.672, "nx=moi": 0.672, "tok=notion": -0.204, "nx=floues": -0.305, "pv2=machines": 0.599, "tok=seance": -0.235, "pv2=refacturer": -0.235, "tok=larme": -0.568, "tok=volet": -0.528, "tok=entremetteur": -0.302, "pv=jambes": -0.325, "nx=grecs": -0.21, "pv2=modernes": 0.278, "tok=devoir": -0.418, "tok=saison": -0.175, "tok=cherubin": -0.181, "nx=sels": 0.234, "tok=sang": 0.256, "pv=bouffes": 1.222, "tok=employe": -0.244, "tok=lancer": 0.515, "pv2=rendant": -0.204, "nx=latines": -0.204, "nx=faire": 2.289, "pv2=envers": -0.23, "tok=lumiere": -1.307, "pv2=s'ecriaient": -0.176, "nx=andalouses": -0.176, "pv2=emprunte": 0.266, "nx=bottes": 0.266, "tok=stade": -0.158, "tok=flamme": -0.268, "pv2=ces": 2.408, "nx=gachis": -0.528, "pv2=toujours": -0.271, "tok=onzieme": 1.309, "tok=senteur": -0.174, "pv2=melaient": -0.174, "pv2=geantes": 0.386, "tok=hypothese": 0.156, "pv=quelle": 1.812, "pv2=callosites": 0.182, "nx=explicative": 0.182, "tok=beta": 2.049, "pv2=pinenes": 0.748, "nx=pinenes": 1.654, "pv2=points": -0.565, "nx=represente": -0.628, "tok=epagneule": 0.287, "pv=vendeen": 0.287, "pv2=griffon": 0.287, "nx=bretonne": 0.287, "tok=droit": -0.745, "tok=eplucher": 0.567, "nx=presidents": 1.755, "tok=riviere": -0.361, "pv2=berges": 0.166, "tok=inferieure": -0.219, "pv2=leur": -1.011, "tok=exercice": -0.996, "pv=crunchs": -0.962, "tok=jpg": 0.521, "pv=images": 1.176, "tok=italienne": 0.808, "pv=allemande": 0.426, "pv2=experiences": 0.436, "tok=campagne": -0.29, "nx=ce": 0.16, "tok=foi": -1.001, "pv=ma": -0.338, "tok=objectif": -0.452, "pv2=soutient": -0.248, "tok=tel": -0.693, "pv=apiacees": -0.486, "pv2=ombelliferes": -0.486, "pv2=l'histoire": 1.108, "nx=aimes": 1.108, "tok=originaire": -0.212, "pv=lamiacees": -1.073, "tok=amour": -0.945, "pv2=mettre": -0.465, "pv2=utilise": -0.288, "pv2=effet": -0.403, "tok=mon": 2.631, "tok=fort": -0.438, "pv=details": -0.566, "nx=ennuyeux": -0.566, "pv2=donner": -0.295, "pv2=pourchasses": 0.167, "nx=pieges": 0.167, "pv=personnes": 0.88, "tok=fantome": -0.329, "pv2=seuls": -0.219, "nx=peuvent": -0.386, "pv2=coordonnees": 0.157, "nx=trouvaille": -0.186, "tok=carbone": -0.785, "pv=emissions": -0.232, "tok=doigt": -1.191, "tok=gravat": -0.189, "tok=hypocrisie": 0.187, "pv=deplorable": 0.187, "tok=stearique": -0.389, "pv=acides": -0.431, "pv2=dentifrices": 0.4, "nx=tissus": 0.4, "tok=entier": -0.538, "tok=colombienne": 0.436, "pv=pre": 0.436, "pv2=l'ere": 0.436, "tok=facon": -0.397, "nx=hommes": -0.153, "tok=rempart": -0.219, "tok=collectif": -1.386, "pv=interet": -0.606, "pv=cd": 0.815, "nx=coloniale": 0.397, "tok=predicateur": -0.342, "tok=folle": -0.765, "pv=homme": -0.544, "nx=infideles": -0.256, "tok=char": -0.296, "tok=numero": -0.501, "tok=antifoulard": -0.496, "pv2=bien": 1.25, "pv=qu'un": 1.426, "pv2=simples": 0.494, "nx=selon": -0.598, "tok=madame": 0.648, "pv=amies": -0.886, "pv2=bonnes": -0.886, "tok=commission": -0.343, "pv=betes": 0.362, "nx=etre": 0.919, "tok=electro": 2.731, "pv=appareils": 0.406, "nx=medicaux": 0.225, "tok=simple": -0.221, "tok=limitant": 0.896, "pv=molecules": 0.896, "nx=l'œdeme": 0.896, "tok=commentaire": -0.806, "pv2=litres": 0.455, "nx=peut": -0.33, "tok=studieusement": 0.619, "pv=journees": 0.619, "tok=accessoire": -0.243, "tok=tumeur": -0.156, "pv2=analyses": 0.378, "tok=bain": 0.2, "pv=huitieme": 1.979, "nx=rayons": -0.173, "tok=crayon": 0.644, "pv=feutre": 0.736, "pv2=graphiques": 0.736, "tok=perte": -0.289, "pv2=reduire": -0.34, "nx=parasites": -0.258, "tok=criaillerie": -0.456, "tok=beau": -0.253, "pv=spatules": -1.137, "pv2=orteils": -1.137, "nx=temps": -0.409, "tok=liaison": -0.212, "tok=frire": 0.958, "pv2=faites": 1.112, "tok=citation": -0.208, "nx=abondent": -0.208, "pv=d'inconduite": -0.677, "tok=mort": -1.016, "pv2=compte": 0.425, "nx=gardes": 0.599, "tok=touchable": -0.602, "pv=suisses": -0.602, "pv2=francs": -1.251, "pv2=assurement": -0.235, "tok=nourrisson": -0.289, "tok=cochon": -0.409, "pv=rires": -0.487, "nx=grouinant": -0.487, "tok=retour": 0.402, "tok=test": -0.194, "pv2=tels": -1.125, "tok=ordre": -0.261, "tok=bloquant": 0.507, "tok=msn": 0.691, "pv=contacts": 0.691, "tok=glacee": -0.513, "pv=fideles": -0.513, "nx=d'horreur": -0.513, "tok=prealable": -0.418, "pv=decoloniaux": -0.418, "tok=dejeuner": 0.588, "nx=intime": 0.588, "tok=jardin": -0.226, "pv2=piqua": -0.173, "tok=source": -0.867, "tok=open": 0.617, "pv=versions": -0.158, "tok=allonger": -0.755, "tok=soupconner": 1.525, "nx=cela": 1.312, "tok=quotidien": 0.503, "pv=miracle": 0.503, "pv2=petit": 0.503, "tok=contemporain": 0.805, "pv=l'art": 0.269, "pv2=derniers": 0.285, "nx=presente": 0.233, "pv2=populeuses": 0.985, "nx=monstres": 0.985, "pv2=date": -0.514, "nx=debuts": -0.514, "tok=acquisition": -0.169, "pv2=systematiquement": -0.169, "nx=anterieures": -0.169, "tok=terme": -1.405, "pv2=entre": -1.514, "pv=meme": 0.872, "tok=empechant": 0.689, "pv2=oiseaux": -0.459, "tok=bel": 0.983, "tok=methionine": 0.417, "pv=soufres": 0.417, "pv2=amines": 0.857, "tok=parfaite": -1.021, "tok=queue": -0.235, "pv=porte": -1.071, "tok=sujet": -0.382, "tok=capteur": -0.324, "tok=contester": 1.097, "nx=conformement": 1.097, "pv2=attend": -0.189, "pv=ancien": 0.703, "pv2=brevete": 0.664, "pv=minoritaires": -0.747, "nx=nombreux": -0.781, "pv2=porte": -0.215, "tok=infiniment": 0.292, "pv=oiseuses": 0.292, "pv2=reflexions": 0.292, "nx=repetees": 0.285, "tok=general": 0.65, "tok=maitre": -0.415, "nx=passe": -0.628, "pv=passe": -1.223, "nx=auquel": -1.223, "tok=nonchalamment": 0.299, "pv=andalouses": 0.299, "pv2=brunes": 0.299, "nx=bercees": 0.299, "tok=generation": 0.466, "pv=l'eau": 0.802, "tok=echue": -0.379, "pv=roubles": -0.379, "pv2=mille": -0.896, "tok=lecture": -0.477, "tok=trempant": 0.562, "tok=cour": -0.313, "tok=certain": 1.212, "tok=bastingage": -0.17, "pv2=garnissaient": -0.17, "nx=repandaient": -0.17, "pv=heures": -0.813, "tok=frai": -0.768, "tok=fondamental": 0.51, "pv=lettres": 0.915, "pv2=belles": 0.993, "tok=caledonien": -0.563, "pv=iles": -0.563, "tok=travail": -0.241, "tok=appel": -0.26, "pv=portes": 0.214, "tok=violence": 0.232, "pv=fouilles": 0.16, "tok=bale": -0.242, "pv2=decordeler": -0.242, "tok=morne": -0.289, "nx=corbillards": -0.289, "nx=locales": -0.217, "tok=station": -0.35, "pv2=ailes": -1.016, "nx=toute": -0.658, "pv2=instruments": -0.578, "tok=dommage": -0.183, "tok=smart": -0.173, "nx=contracts": -0.173, "tok=arc": 1.48, "tok=mercredi": 0.757, "tok=preuve": -0.78, "tok=sur": 0.353, "pv=cinq": 0.865, "tok=clic": -1.313, "pv=simple": -1.261, "nx=dessus": -0.761, "tok=moustachue": 0.212, "pv=l'otarie": 0.212, "pv2=sables": 0.222, "tok=critere": -0.376, "pv=magyarophones": -0.283, "tok=communaute": -0.273, "nx=d'esclaves": -0.192, "pv2=venaient": -0.158, "pv=seances": -0.31, "tok=evolution": -0.668, "tok=esperer": 0.777, "pv2=laisse": 2.527, "nx=laisse": 0.777, "pv2=collegues": 0.873, "tok=breuvage": 0.206, "nx=irlandais": 0.206, "tok=suite": 0.318, "tok=fosse": -0.405, "tok=action": -0.352, "tok=speciale": 1.553, "pv=yeux": -1.138, "nx=cuticules": 0.68, "tok=vision": 0.99, "tok=graffiti": -0.177, "pv2=dechiffrant": -0.177, "pv2=finalement": -0.196, "tok=repoussant": 0.727, "nx=l'allocortex": 0.727, "pv=paons": 0.457, "nx=belle": 0.457, "tok=varier": -0.157, "nx=leurs": -0.176, "tok=rallye": 1.293, "nx=paper": 1.293, "pv2=conceptions": 0.2, "tok=americain": -0.514, "pv=webcomics": -0.735, "tok=historique": 0.245, "pv=resultat": 0.155, "tok=garcon": -0.277, "pv2=crepuscule": -0.172, "nx=bouchers": -0.172, "tok=passerelle": -0.271, "pv2=mirant": -0.271, "tok=concept": -0.201, "pv2=cours": 0.157, "nx=chaises": 1.107, "pv=noyaux": -0.805, "nx=essentielles": -0.37, "tok=local": -0.481, "pv=halles": -0.481, "tok=livrer": 0.451, "tok=azeri": -0.586, "pv=orientaux": -0.586, "pv2=dialectes": -0.586, "pv2=voraces": -0.177, "nx=supportent": -0.177, "tok=patience": -0.6, "pv=ayes": -0.6, "tok=plafond": -0.331, "nx=anes": -0.158, "tok=negre": -0.924, "pv=raciaux": -0.655, "pv2=marqueurs": -0.655, "nx=devient": -0.655, "pv2=dents": 0.484, "tok=nature": -0.28, "tok=vampire": -0.249, "tok=donnee": -0.626, "nx=interieures": -0.299, "tok=ange": -0.319, "pv2=especes": 0.924, "nx=annee": 0.211, "tok=maitriser": 0.538, "nx=indique": 0.843, "tok=orme": -0.733, "pv=divers": -0.662, "nx=saule": -0.682, "nx=gelees": -0.211, "nx=montent": -0.257, "tok=euro": 1.345, "pv2=mobilisation": 1.427, "nx=manifestations": 1.427, "tok=directe": 0.181, "pv=caduques": -0.477, "tok=tristement": 0.486, "pv=belerent": 0.486, "tok=punir": -0.155, "pv2=sait": -0.244, "pv=chaque": 0.448, "nx=lesions": 0.95, "tok=fauteuil": -0.169, "tok=fuir": 0.693, "tok=ouvrir": 0.996, "pv=apartes": 0.475, "nx=allemandes": 0.426, "pv2=regler": -0.158, "nx=internationaux": -0.232, "pv=jeux": -0.832, "tok=signaler": 0.83, "tok=clientele": 0.164, "pv=certaine": -1.018, "tok=epoque": -0.181, "pv=l'espace": 1.248, "pv2=travaux": 0.868, "tok=contour": -0.818, "pv=speciale": -0.801, "pv2=pieds": -0.45, "tok=cheval": -3.111, "pv2=surs": -1.194, "tok=onde": -0.232, "tok=separer": 0.932, "pv=missionnaires": -0.281, "pv2=nomment": 0.366, "tok=nouveau": 2.215, "tok=vitrine": -0.163, "pv2=discount": -0.185, "nx=hurlaient": -0.185, "tok=connexion": -0.271, "tok=depression": -0.341, "nx=jointives": -0.306, "tok=compter": 1.306, "pv2=peux": 1.306, "tok=principale": 0.564, "nx=attraction": 0.825, "pv2=fortement": -0.166, "tok=lande": -0.165, "tok=considerer": 1.206, "pv2=egalement": 1.081, "tok=voleur": -0.186, "tok=junior": -0.778, "tok=pleine": -0.341, "tok=interet": -0.924, "tok=cyclable": -1.075, "pv=piste": -1.075, "pv2=promeneurs": -1.075, "nx=crottoirs": -1.075, "tok=assiette": -1.24, "nx=reservent": -1.24, "tok=repondant": 0.21, "pv=furibonds": 0.21, "pv2=aboiements": 0.21, "tok=instruction": -0.466, "tok=etat": -0.86, "tok=septieme": 0.245, "tok=chiite": -0.176, "pv2=sunnitiser": -0.176, "tok=artisan": -0.55, "tok=chatier": -0.329, "pv2=je": -0.421, "tok=delice": -0.358, "nx=qu'on": -0.55, "tok=consultation": -0.202, "tok=sacro": 0.665, "pv=articulations": 0.665, "nx=iliaques": 0.665, "tok=semaine": 0.28, "tok=reciter": 1.28, "tok=accueillir": 0.41, "tok=evenement": -0.435, "tok=masquant": 0.249, "pv=rapeux": 0.249, "pv2=murs": 0.601, "nx=depuis": 0.312, "tok=autorite": -0.887, "pv=veritable": 0.486, "tok=ovalbumine": -0.86, "pv=foisonnantes": -0.86, "pv2=proprietes": -0.812, "nx=produits": 0.232, "nx=francais": -0.46, "tok=impedimenta": 0.906, "pv=coulisses": 0.416, "tok=meilleur": -0.665, "pv=lueur": 0.167, "nx=egalement": 0.247, "tok=moine": -0.695, "tok=islamiste": -0.208, "pv2=aussi": -0.45, "pv2=arts": -0.48, "tok=large": -0.194, "pv=cordes": 0.153, "nx=suspension": 0.748, "pv2=jardins": 0.335, "nx=avant": -0.223, "tok=trou": -0.151, "tok=patissier": -0.165, "nx=appeles": -0.165, "pv2=lance": 1.239, "tok=exceptionnellement": 0.438, "pv=menstruels": 0.438, "pv2=saignements": 0.474, "nx=abondants": 0.438, "tok=nettete": -0.361, "pv=parfaite": 0.404, "pv2=change": -0.263, "tok=laicisation": -0.194, "pv2=multiplie": -0.357, "tok=phase": -0.322, "nx=plats": -0.349, "tok=physicien": 0.181, "nx=etranges": -0.244, "pv=autos": 1.036, "nx=faites": 0.893, "tok=vitesse": -0.259, "tok=lievre": 0.345, "pv=noms": 1.506, "nx=variable": 0.605, "tok=progression": -0.806, "pv=references": -0.806, "tok=fortune": -0.424, "tok=propylique": -0.668, "pv=cupreines": -0.668, "pv2=superieurs": -0.668, "nx=amylique": -0.668, "tok=egalite": 0.885, "pv=salaires": 0.885, "pv=d'ailleurs": -0.712, "pv2=tudesques": -0.712, "nx=estimables": -0.712, "pv2=poissons": 0.539, "tok=reflexion": -0.27, "pv2=mois": -1.162, "tok=plier": 0.385, "pv=troisieme": 1.035, "nx=kiosques": 0.707, "pv=vraie": 0.201, "tok=toit": -0.244, "pv2=secrets": 0.561, "nx=vicieux": 0.621, "tok=principe": -0.764, "nx=feministes": 1.456, "tok=circulation": -0.68, "pv=viscerales": -0.68, "nx=respiration": -0.68, "tok=anticellulite": -0.607, "pv=allies": -0.607, "pv2=meilleurs": -0.607, "tok=tournoi": -0.219, "nx=s'est": 0.38, "tok=noisette": -0.651, "pv=cafes": -0.651, "nx=rinces": -0.651, "tok=barrant": 0.627, "pv=cretes": 0.627, "nx=l'horizon": 0.627, "pv2=travers": -0.608, "pv=rapports": 0.901, "nx=philosophiques": 0.396, "tok=representer": 1.314, "tok=generale": 0.672, "pv=d'anesthesie": 0.299, "pv2=indications": 0.299, "tok=osteo": 0.55, "pv=fixes": 0.274, "pv2=insertions": 0.274, "nx=fibreuses": 0.274, "tok=moustache": -0.165, "pv2=grivelle": -0.161, "tok=jeter": 1.414, "tok=accentuation": -0.667, "pv=nettete": -0.667, "pv2=teintes": -0.667, "nx=filtres": -0.667, "tok=bureau": 0.667, "pv=mesures": 0.635, "nx=adapte": 0.635, "tok=chanson": -0.285, "tok=cinq": 3.377, "pv=profonds": 0.473, "pv2=neuronaux": 0.473, "pv=cinquieme": 0.428, "pv=etais": 0.34, "pv2=sortes": -1.75, "tok=sauvage": -0.156, "tok=octobre": 1.316, "tok=cavite": -0.191, "pv=seule": 0.456, "tok=envahisseur": -0.165, "tok=poupette": -0.246, "pv2=possede": -0.183, "tok=analytique": 0.567, "pv=principes": 0.567, "nx=transcendentale": 0.567, "pv2=se": 1.435, "nx=bouter": 1.435, "pv2=force": 0.815, "nx=quoi": 0.847, "tok=prerogative": -0.404, "tok=connaissance": -0.223, "nx=theoriques": -0.327, "tok=ludique": 0.594, "pv2=distinctes": 0.355, "tok=chut": 0.867, "nx=prolonges": 1.096, "tok=secourir": 0.928, "tok=diviser": 0.893, "nx=toujours": 0.243, "nx=semaines": -0.272, "tok=publication": -0.168, "tok=beneficiaire": -0.471, "tok=joueur": -0.151, "pv2=analyse": -0.256, "tok=courte": -0.684, "pv=l'arme": -0.684, "tok=lieu": 0.373, "pv2=piquets": -0.598, "tok=formation": -0.317, "pv=epluchees": 0.271, "pv2=pre": 0.271, "nx=lavees": 0.271, "pv2=blancs": -1.363, "nx=n'y": 0.492, "pv2=elle": -0.292, "pv2=gauche": 0.232, "tok=neo": 3.513, "pv=politiques": 0.288, "nx=liberales": -0.497, "tok=organe": -0.489, "pv2=aubepines": 0.463, "pv=tirailleurs": 0.552, "nx=colore": 0.552, "tok=maximum": 0.491, "pv=semaines": 0.491, "nx=trois": 0.396, "tok=marneuse": 0.291, "pv=d'argile": 0.291, "pv2=couvertes": 0.291, "nx=jaunatre": 0.291, "pv2=durant": 0.703, "nx=prochaines": 0.563, "tok=craignant": 1.468, "tok=diablement": 0.459, "pv=hanches": 1.239, "pv2=connait": -0.263, "nx=classiques": -0.381, "pv=dumas": -0.29, "tok=affranchir": 0.395, "tok=halon": -0.322, "pv2=differencier": -0.307, "nx=labyrinthiques": -0.17, "pv2=enfin": -0.298, "tok=cadavre": -0.655, "nx=j'aimerais": -0.565, "pv2=celle": -0.166, "pv2=parents": 0.548, "pv2=fleurs": -0.291, "nx=proces": 0.409, "pv2=age": -0.23, "tok=pro": 2.114, "tok=romaine": 0.255, "pv=l'eglise": 0.255, "pv2=eglises": 0.516, "nx=jouit": 0.255, "tok=billet": -0.402, "tok=rendre": 3.568, "pv2=peut": 3.527, "nx=visibles": 0.272, "tok=outarde": 0.703, "pv=oiseaux": -0.27, "nx=canepetiere": 0.703, "tok=dentale": -0.222, "pv2=consonnes": -0.222, "tok=cordial": 0.285, "pv=m'encouragent": 0.285, "pv2=gueules": 0.285, "nx=visqueux": 0.285, "pv2=lettres": 0.161, "tok=agile": -0.68, "pv=gouttieres": -0.68, "pv=tel": 0.75, "nx=serait": 0.377, "tok=creancier": -0.175, "nx=soient": -0.203, "pv=marque": 0.156, "pv2=suivait": -0.271, "tok=mont": -0.446, "tok=hurlant": 1.263, "pv=bebes": 1.263, "nx=resultats": -0.26, "tok=jete": 0.293, "pv=j'ai": 0.293, "pv2=doigts": 0.48, "nx=mon": 0.258, "tok=proprietaire": -0.408, "nx=noir": 1.078, "tok=emploi": -0.218, "nx=para": -0.165, "tok=restriction": -0.22, "tok=pontage": 0.378, "pv=cardiaques": -0.42, "pv2=valves": 0.378, "nx=coronarien": 0.378, "tok=pence": -1.973, "pv=six": -1.973, "pv=plumes": 0.431, "tok=aspect": -0.207, "tok=alterite": 0.485, "pv=nulle": 0.485, "pv2=moments": -1.674, "pv=brusque": 0.648, "pv2=d'un": 0.929, "pv2=peres": -0.209, "nx=mamans": -0.247, "tok=pivotement": 0.4, "pv=suivant": 0.4, "pv2=mouvements": -0.499, "nx=apiquage": 0.4, "pv=vivants": 0.363, "pv2=organismes": 0.363, "nx=microflore": 0.363, "pv2=rend": -0.387, "nx=plutot": -0.439, "tok=desir": -0.453, "tok=arrivee": 0.392, "pv2=d'apres": -0.185, "tok=mangue": -1.68, "pv2=professeurs": 0.537, "nx=humaines": -0.304, "tok=abreviation": -0.282, "pv=maras": -0.282, "tok=camp": -0.492, "pv=katibas": -0.481, "tok=echangerent": 0.665, "pv=capitaines": 0.665, "nx=force": 0.665, "nx=notamment": -0.444, "tok=aspirine": -0.576, "pv=plaquettaires": -0.576, "pv2=antiagregants": -0.576, "tok=empecher": 1.586, "nx=d'agir": 0.513, "tok=parole": -1.09, "tok=assidument": 0.297, "pv=frequente": 0.297, "pv2=articles": 0.341, "tok=gateau": -0.59, "nx=pollueurs": 1.026, "pv2=offre": -0.211, "pv2=amorcer": 1.493, "tok=paquebot": -2.868, "tok=salon": -1.635, "pv2=sourires": -1.435, "nx=peuple": -1.435, "pv=retranchements": 0.928, "nx=mai": 0.928, "pv=quelque": 1.632, "nx=meres": -0.861, "nx=doit": -0.52, "pv=nouveau": 0.372, "tok=enjolivure": 0.466, "pv=enjolivement": 0.466, "pv2=substantifs": 0.466, "tok=joyeusement": 0.399, "pv=s'envolent": 0.399, "pv2=feuilles": -0.454, "nx=annonce": 0.276, "tok=tele": 0.798, "pv=plateaux": -1.042, "tok=soutenir": 0.409, "tok=moderne": -0.823, "pv2=galeries": -0.45, "tok=lecon": -0.217, "pv2=donne": -0.216, "tok=genou": -1.581, "pv2=helicos": -1.581, "tok=oreille": -0.493, "pv2=frotter": -0.212, "tok=califat": -0.259, "pv2=saintonge": -0.18, "pv=bruit": 0.41, "pv2=aucun": 0.722, "tok=suivant": 0.382, "pv=constellations": 0.242, "pv2=nouvelles": 0.713, "nx=l'ordre": 0.242, "tok=gazelle": -0.186, "tok=instrument": -0.737, "pv=verillons": -0.605, "nx=compose": -0.605, "tok=manquant": 1.11, "pv=faubourgs": 1.11, "tok=social": 0.73, "nx=democraties": 1.555, "tok=animal": -0.611, "pv=d'agneau": -0.611, "pv2=abats": -1.223, "tok=anxiete": 0.455, "pv=hysterie": 0.455, "pv2=diverses": -0.33, "pv=feuilles": -0.265, "pv2=cents": 0.582, "tok=gram": 0.676, "pv=gros": 0.676, "nx=eau": -0.757, "tok=stand": 1.488, "nx=upeurs": 1.488, "pv2=femmes": -0.372, "tok=special": -0.269, "pv=virtuels": -1.28, "pv2=aperos": -0.633, "nx=confinement": -0.633, "pv2=debucher": -0.26, "pv=vosgiens": 0.561, "pv2=supporters": 0.561, "tok=extreme": 0.59, "tok=pression": -0.623, "nx=d'ou": -0.21, "tok=ami": -0.657, "pv2=c'etait": -0.462, "nx=chinois": -0.462, "tok=algue": -0.593, "tok=fevrier": 1.718, "nx=tour": 0.355, "nx=beaute": -1.5, "pv2=carioles": 0.243, "pv2=deposez": 0.151, "nx=mangues": 0.151, "tok=round": -0.247, "pv2=exemple": -0.52, "tok=cinglante": 0.426, "nx=porteuse": 0.426, "tok=vigneron": -0.306, "tok=auto": 3.769, "nx=mutilations": 2.327, "pv2=raisons": -0.642, "nx=parce": 1.405, "tok=marchandise": -0.447, "pv2=qu'on": 2.971, "tok=autonomie": -0.701, "pv=points": -1.225, "nx=territoriaux": -0.701, "tok=corridor": -0.185, "pv2=longea": -0.185, "nx=traversa": -0.185, "nx=eventuelles": -0.173, "tok=nourriture": 0.612, "pv=herbes": 0.612, "nx=premiere": 0.612, "pv=pieds": -1.324, "tok=exposant": 0.471, "tok=mai": -0.364, "pv=suivants": 0.257, "pv2=signes": 0.286, "nx=mental": 0.257, "tok=mauricien": -0.637, "pv=reunionnais": -0.637, "pv2=actuels": -0.637, "tok=carbonyle": -0.643, "pv=groupes": -1.374, "pv2=maneges": 0.172, "nx=aubert": 0.172, "pv=conventions": 0.474, "nx=linguistiques": 0.474, "tok=siderurgiste": -0.173, "pv2=qu'alarmer": -0.173, "tok=rouge": 0.844, "nx=sabbatiques": 0.316, "tok=secteur": -0.182, "tok=griffon": -1.036, "nx=vendeen": -1.036, "tok=cerebral": 0.51, "pv=tronc": 0.565, "pv2=jusqu'au": 0.353, "tok=francaise": -0.266, "pv=l'entreprise": 0.33, "nx=chabloz": 0.33, "pv2=chevrettes": -0.915, "nx=enveloppees": -0.957, "pv=l'eloquence": 0.541, "tok=sud": 1.936, "pv=landes": 0.311, "nx=ouest": 0.364, "tok=opportunement": 1.748, "pv=fumigations": 1.748, "pv=tourterelles": -0.644, "tok=digestive": -0.595, "pv2=œufs": 0.166, "tok=tuba": -2.212, "pv2=palmes": -2.161, "tok=millieme": 0.31, "nx=partie": 0.302, "tok=proportion": -0.19, "tok=quintal": -0.56, "pv=choux": -0.56, "pv2=gros": -0.57, "pv2=contexte": -0.171, "nx=jardins": -0.171, "tok=corriger": 1.094, "tok=rafale": -0.175, "pv=souvenirs": -0.365, "tok=ouest": 1.51, "pv=sud": 0.533, "pv2=landes": -1.04, "tok=intention": 0.501, "tok=centrale": 0.707, "pv=d'asie": -0.321, "tok=amie": 0.521, "pv=belle": 0.583, "tok=gadje": -0.189, "pv2=forains": -0.189, "pv2=elements": 0.368, "tok=emotionnelle": -0.707, "pv=distinctes": -0.707, "pv2=phases": -0.681, "nx=mentale": -0.707, "tok=enqueteur": -0.216, "pv2=livrent": -0.161, "nx=incarnes": -0.161, "tok=appartenance": -0.208, "pv=l'agitation": 0.667, "pv2=possedants": 0.667, "nx=reveille": 0.667, "nx=femmises": -0.46, "tok=decennie": -0.208, "nx=parties": 0.605, "tok=irlandaise": -1.217, "nx=italienne": -0.648, "tok=quart": -1.914, "pv2=prelevez": 0.231, "nx=spheres": 0.21, "tok=placer": 0.563, "pv2=roues": 0.567, "tok=prononcer": 1.91, "pv2=tambour": 0.67, "nx=parleurs": 2.622, "pv2=animaux": 1.114, "nx=beaux": 0.152, "tok=cuir": -0.449, "tok=construction": 1.096, "pv=maisons": 1.233, "tok=camion": -0.32, "pv2=demolie": -0.17, "pv=d'action": 0.658, "pv2=anticoagulants": 0.658, "tok=motoneige": -0.501, "tok=hiver": -0.584, "tok=format": -0.846, "pv=volantes": -0.846, "tok=trophee": -1.645, "tok=public": 0.398, "pv2=generations": 0.318, "pv2=deblablater": -0.22, "pv=matiere": 0.215, "pv=adenylique": 0.286, "pv2=acide": 0.286, "nx=guanylique": 0.286, "tok=injure": 0.411, "pv=supreme": 0.599, "pv2=allopathes": 0.599, "pv2=d'identifier": -0.174, "tok=creation": -0.221, "pv=emeutes": -0.298, "tok=preoccupation": -0.155, "pv2=nord": -0.162, "nx=mercantiles": -0.162, "tok=systematique": 0.306, "pv=l'emploi": 0.306, "pv2=terrassements": 0.306, "tok=nul": 0.201, "pv2=blagues": 0.201, "pv2=ecourter": -0.388, "pv=roues": 0.456, "pv2=quatre": -0.4, "nx=modele": 0.456, "pv=barbe": 0.261, "pv2=longue": 0.261, "nx=postiche": 0.261, "pv2=devrait": 0.764, "pv2=trente": 0.225, "tok=connaitre": 1.187, "tok=prophete": -0.419, "nx=c": -0.19, "pv2=l'animation": -1.216, "nx=journees": -1.216, "tok=poing": -0.343, "pv=noirs": 0.554, "pv2=stappers": 0.508, "tok=tractopelle": -0.17, "pv2=jour": -0.184, "tok=canepetiere": 0.383, "pv=outarde": 0.383, "nx=chouette": 0.383, "tok=appeler": 1.394, "nx=vieilles": 0.954, "pv=costarmoricains": 0.223, "tok=rapatrier": 0.798, "tok=kite": -0.376, "pv2=francaises": -0.376, "nx=surfers": -0.376, "tok=ardechoise": 0.292, "pv=eau": 0.292, "pv2=basaltes": 0.292, "nx=naturellement": 0.292, "pv=t'es": -0.751, "pv2=brancardiers": -0.751, "tok=oleique": 0.835, "nx=butyrique": 0.835, "tok=tourment": -0.224, "tok=production": 0.353, "nx=biomasse": 0.505, "tok=etalon": -0.704, "pv=cales": -0.68, "tok=molecule": -0.444, "pv2=appliquee": -0.151, "nx=miroirs": -0.151, "nx=bas": 0.29, "tok=fourmi": -0.175, "pv2=consommer": -0.152, "pv2=comprend": -0.17, "pv2=chauffer": -0.184, "pv2=rues": -1.43, "nx=premieres": 0.848, "pv=votre": 0.25, "pv2=cinq": -1.118, "tok=hyper": 2.22, "pv2=evenements": 0.46, "tok=infidele": -0.256, "pv=ayants": -0.494, "tok=hyperparathyroidie": 0.298, "pv=parathyroidiens": 0.298, "pv2=adenomes": 0.298, "nx=primaire": 0.298, "pv2=ternaire": -0.159, "nx=relevant": -0.159, "tok=interrompant": 0.397, "tok=saint": -0.464, "tok=mitaine": 0.368, "pv=miton": 0.368, "pv2=onguents": 0.368, "nx=dernier": -0.579, "pv=cache": -0.654, "tok=bizouner": 0.535, "nx=presquement": 0.535, "tok=planter": 0.347, "nx=directement": 0.347, "tok=servir": 0.751, "tok=preferee": 0.169, "nx=aimants": 2.325, "pv=gratte": 0.934, "nx=flamboyants": 0.491, "pv=l'appui": 0.612, "pv2=affaires": -0.999, "tok=diversement": 0.487, "pv=argiles": 0.487, "nx=nuancees": 0.487, "tok=esprit": -0.857, "pv2=successifs": 0.184, "pv2=foule": -0.168, "tok=frere": -0.39, "pv2=rochelle": -0.155, "nx=durivaud": -0.155, "tok=biographie": -0.17, "nx=simultanees": -0.17, "tok=obstetricien": -0.201, "pv2=precisement": -0.201, "tok=polychrome": -0.815, "pv=d'orfevrerie": -0.815, "pv2=modes": -0.815, "tok=inferieur": -0.414, "pv=brioveriens": -0.414, "tok=adoptant": -0.677, "pv=ha": 0.494, "pv=presse": 0.288, "pv2=medias": 0.37, "nx=television": 0.288, "pv=carriquirri": -0.914, "pv2=prix": -0.94, "nx=toro": -0.914, "pv=termes": -0.718, "tok=karma": -1.502, "pv2=habitants": -1.406, "tok=couchant": -0.462, "pv=rayons": -0.5, "pv2=etaient": 0.808, "pv2=uns": 0.201, "tok=candidature": -0.507, "nx=certainement": -0.507, "tok=complet": 0.197, "pv=denoyage": 0.197, "tok=lutherienne": -0.428, "pv=hymnologies": -0.428, "tok=coureur": 0.652, "nx=automobile": 0.614, "tok=citoyen": -0.44, "tok=drag": 1.485, "nx=queens": 1.485, "pv=cles": -0.88, "pv2=travailleurs": -0.88, "nx=soignant": -0.88, "nx=tant": -1.487, "tok=cardiaque": -0.25, "pv=activites": -1.1, "pv2=planteurs": 2.618, "nx=alertes": 2.618, "tok=vivante": 0.361, "pv=l'intensite": 0.361, "tok=vedette": -0.202, "pv2=jouent": -0.202, "tok=trieuse": -0.354, "nx=assortissent": -0.354, "pv=salades": 0.51, "nx=epluchees": 0.51, "tok=grandeur": -0.884, "pv2=regarder": -0.216, "tok=recolter": 0.626, "pv=surfaces": 0.636, "nx=nu": 0.636, "tok=stagnante": -1.039, "pv2=remous": -0.536, "tok=strategie": 0.301, "tok=pli": -1.455, "nx=charmant": -1.455, "tok=hindoue": -0.637, "pv=civilisations": -0.637, "nx=confuceenne": -0.637, "tok=enjolivement": -0.593, "tok=galet": -0.223, "tok=plant": -0.163, "tok=laconiquement": 0.306, "pv=laches": 0.306, "pv2=brefs": 0.306, "nx=donnees": -0.233, "tok=abordage": -0.197, "pv2=eviter": -0.355, "tok=intense": 0.356, "pv=magnetique": 0.356, "pv2=d'activite": 0.356, "nx=toutes": 1.593, "tok=oleoduc": -0.154, "pv2=prenez": -0.154, "pv=climatiques": -0.628, "pv2=aleas": -0.628, "pv2=luxurieuse": -0.218, "tok=baissee": 0.488, "pv=tete": 0.488, "pv2=tiges": 0.488, "tok=automobiliste": -0.281, "tok=plat": -0.326, "nx=soir": 1.454, "pv2=couleurs": 0.405, "pv2=deforme": -0.169, "tok=distribuer": 1.443, "pv2=doit": 1.443, "pv=bousculade": 0.247, "tok=manger": -0.617, "pv=os": -0.398, "nx=froid": -0.398, "tok=trapeze": 0.171, "pv2=proximales": 0.171, "pv=parties": 0.832, "pv2=physiquement": 0.572, "nx=invisibles": 0.572, "tok=clownesque": 0.229, "pv=l'expression": 0.229, "pv2=indignes": -0.203, "tok=ideal": -0.223, "pv2=distinguer": -0.369, "nx=types": -0.223, "tok=singuliere": -1.141, "tok=mauvaise": -0.253, "nx=notes": -0.218, "tok=retenir": 1.2, "pv2=put": 1.2, "tok=laiteuse": 0.179, "pv=blancheur": 0.386, "tok=record": -0.599, "pv=niveaux": -0.599, "nx=cerise": -0.65, "pv2=gravissaient": -0.169, "nx=pierreux": -0.169, "nx=differentes": -0.321, "tok=porc": -0.699, "pv2=moi": 1.137, "tok=polycarburant": -0.447, "pv=vehicules": -0.822, "nx=langues": -0.268, "pv2=connaitre": -0.15, "nx=etrangeres": -0.156, "tok=salee": 0.83, "pv=viande": 0.282, "pv2=porcs": 0.32, "pv=equipement": 0.364, "pv2=d'ebarbage": 0.364, "tok=examina": 1.116, "pv2=l'autre": 0.989, "pv2=hommes": 0.666, "tok=lecher": 0.807, "pv=mamelles": -0.403, "nx=labourage": -0.403, "pv=exhibe": 0.628, "pv2=effets": 0.677, "tok=disposition": -0.514, "tok=menacant": 0.712, "pv=adversaires": 0.661, "nx=clivante": 0.661, "pv2=ni": 0.456, "tok=decembre": 3.036, "pv2=territoire": 1.101, "nx=janvier": 1.101, "tok=houppier": -0.202, "pv2=versant": -0.202, "pv2=vends": 0.371, "nx=tremblantes": -0.21, "tok=moulin": -0.209, "pv2=remplacant": -0.209, "pv2=madonna": -0.174, "nx=convoques": 0.199, "tok=cigarette": -0.789, "pv=bannettes": -0.59, "tok=redressant": -1.145, "pv=squares": 0.911, "nx=o": 0.911, "tok=dorsale": -1.004, "pv=rames": -0.388, "nx=notopode": -0.388, "tok=plomb": -0.201, "tok=aliment": -0.213, "pv2=donnees": 0.608, "pv=nerfs": 0.251, "nx=suite": 0.251, "nx=general": 0.419, "tok=nom": 1.316, "nx=chauffeurs": -0.204, "pv2=blick": -0.155, "tok=nudite": -0.632, "pv=quarts": -0.632, "nx=smurfaient": -0.632, "pv2=bordant": -0.256, "nx=constituent": -0.169, "tok=ouverture": -1.715, "pv=cabinets": -0.492, "tok=muet": -0.789, "pv=laisser": -0.789, "pv2=recuperer": -0.206, "tok=fantastique": 0.36, "pv=image": 0.36, "pv2=anterieures": 0.36, "tok=avant": 4.928, "nx=trains": 0.7, "pv=demi": 0.561, "tok=douze": 2.479, "nx=principaux": -0.596, "tok=standard": -1.825, "pv=radiographies": -0.46, "tok=inauguration": -0.417, "pv=efforts": -0.683, "tok=particularite": 0.245, "pv=syllabes": 0.453, "pv2=separer": -0.281, "nx=completement": 0.332, "tok=eteter": -0.179, "pv2=comparez": -0.193, "nx=deployees": -0.193, "tok=centimetre": -0.937, "tok=album": -0.775, "tok=dresser": 1.664, "tok=definition": -0.544, "pv2=publie": -0.226, "tok=recommencer": 0.627, "pv2=parties": 0.311, "nx=regroupant": -0.214, "tok=mode": -0.367, "pv=dernier": -1.128, "pv2=mig": 0.632, "tok=croisant": -1.228, "tok=imagination": -0.186, "pv2=maitres": 0.331, "tok=employer": 2.251, "pv2=pussent": 0.893, "nx=ici": 0.166, "tok=minuit": 2.789, "tok=poirier": 0.328, "nx=pommier": 0.328, "tok=coller": 0.598, "pv=onze": 0.777, "tok=dispositif": -0.321, "pv2=paysans": 0.157, "pv2=reexpedie": 1.377, "tok=poussiere": -0.502, "tok=phenylalanine": 0.441, "pv=aromatiques": 0.441, "tok=pizza": -0.256, "tok=cannelle": -1.026, "tok=dramatique": 0.34, "tok=coquillage": -0.173, "pv2=etale": -0.153, "tok=lombard": -0.744, "nx=piemontais": -0.744, "pv2=services": -0.714, "tok=marronnier": -0.705, "pv=pommier": -0.705, "pv2=poirier": -0.705, "tok=unique": 0.225, "tok=papillon": 0.2, "pv=laiches": 1.026, "pv=qu'en": 0.928, "pv2=roulieres": 0.928, "tok=jeu": -0.828, "pv2=nattes": 0.235, "tok=footage": -0.455, "tok=primate": -0.215, "nx=singes": -0.215, "tok=soldat": -1.15, "nx=belges": 0.412, "tok=accent": -0.211, "pv2=champions": 0.48, "tok=national": 0.277, "pv=plans": -0.459, "nx=anne": -0.246, "tok=facade": -0.304, "pv2=embellit": -0.304, "tok=metadonnee": -0.245, "tok=consul": 0.36, "pv=oncles": 0.36, "pv2=grands": -0.311, "pv=cas": 0.164, "nx=rare": 0.422, "tok=puce": -0.722, "tok=confort": -0.589, "tok=severement": 1.044, "pv=autochtones": 0.447, "nx=punis": 0.447, "tok=apercevant": 0.407, "nx=bert": 0.407, "tok=flic": -0.208, "tok=pardon": -0.207, "pv2=gagner": -0.304, "tok=serrure": 0.345, "pv=antique": 0.345, "tok=courant": -0.94, "nx=maison": -0.482, "tok=frequentation": -0.245, "pv2=rapports": -0.591, "pv=tests": -0.389, "nx=tels": -0.303, "nx=vous": 0.327, "tok=veuve": -0.478, "pv=nommees": -0.43, "nx=girard": -0.43, "tok=souffrance": -0.234, "pv2=suffisamment": -0.234, "pv=etoiles": 0.58, "nx=siecle": 0.799, "tok=correction": -0.171, "pv2=faisait": -0.559, "nx=indiquees": -0.171, "tok=piqueur": -0.225, "tok=basse": 0.425, "pv=taille": 0.515, "pv2=pantalons": 0.478, "tok=bienfait": -0.169, "nx=minutes": 0.718, "tok=ordure": -0.209, "tok=thriller": -0.177, "pv2=normalement": -0.297, "tok=paritaire": -0.587, "pv=ministres": -0.587, "nx=respectant": -0.587, "tok=juif": -0.634, "tok=indigene": -0.344, "tok=matelot": -0.372, "nx=s'occuperent": -0.257, "tok=traitement": 0.321, "pv2=emprunter": -0.21, "pv=genres": -0.151, "tok=parquet": -0.289, "tok=candidat": -0.394, "nx=devront": -0.356, "tok=couverture": 0.515, "tok=tabou": -0.156, "pv2=detabouiser": -0.156, "tok=lardon": -0.164, "pv2=mele": -0.164, "nx=frits": -0.164, "tok=proposee": -0.699, "pv=regnes": -0.699, "tok=prophetie": -0.57, "nx=ordinaires": -0.717, "tok=empreinte": -0.241, "tok=berrichon": -0.208, "pv2=disent": -0.423, "tok=rare": -2.383, "pv=d'en": 0.354, "pv2=creanciers": 0.16, "tok=terrassier": -0.182, "pv2=regardais": -0.209, "nx=travailler": 0.196, "tok=episode": -0.322, "tok=expedier": 0.941, "tok=immense": -0.178, "tok=epaisse": -1.099, "pv=euros": -1.117, "pv2=d'origine": -0.172, "nx=communaux": -0.172, "tok=boutique": -0.324, "tok=pissenlit": -0.206, "pv2=anachronismes": -1.963, "nx=trudeau": -1.963, "tok=paysage": -0.702, "tok=caracteristique": -0.283, "pv=aoc": -0.648, "nx=reputes": -0.648, "pv2=autels": -1.657, "nx=jeux": 0.541, "tok=speculation": -0.247, "tok=araignee": -0.227, "tok=sexuelle": 0.171, "nx=tout": -0.814, "tok=pepere": -0.181, "pv2=voiture": -0.213, "pv2=malgre": -0.535, "pv2=chretiens": 1.017, "nx=premiers": 1.017, "tok=objet": -0.176, "pv2=integre": -0.341, "pv2=cite": -0.197, "pv=interactions": -0.477, "nx=permanent": -0.477, "tok=froid": -0.862, "pv=l'air": 0.621, "pv2=parfums": 0.621, "tok=sanguine": 0.284, "pv=cornaline": 0.284, "tok=montrer": 1.474, "pv2=devait": 1.152, "tok=suspension": 0.346, "pv=large": 0.346, "tok=remplissant": -0.729, "tok=bete": -0.766, "tok=impossible": -0.166, "pv=d'ecole": 0.834, "pv2=resultats": -0.431, "tok=confinement": 0.387, "pv=special": 0.322, "pv2=virtuels": 0.322, "nx=enfants": -0.165, "tok=alpha": 0.906, "pv2=isoprenes": 0.906, "tok=tantrisme": 0.625, "pv=vedas": 0.625, "tok=cancan": -0.266, "nx=j'suis": -0.266, "tok=cool": 1.132, "pv=aspects": 0.525, "tok=coquin": -0.218, "tok=disgracieusement": 0.204, "pv=ouvertes": 0.204, "tok=magnanime": -0.824, "pv=mains": -0.824, "tok=egyptien": -0.591, "pv=antiquites": -0.591, "nx=d'accorder": -0.591, "pv=girondins": 0.431, "pv=etrangeres": -1.18, "tok=consecutive": -0.701, "pv=subsistances": -0.701, "nx=frondeurs": -0.197, "tok=etranger": -0.827, "nx=informatiques": -0.5, "nx=reproches": 0.775, "tok=niveleuse": 0.154, "pv2=tonnes": 0.154, "nx=blanche": 0.162, "tok=tuer": 0.785, "tok=tenir": 1.125, "pv=naturelles": -0.746, "pv2=proteines": -0.746, "tok=fermeture": 0.182, "tok=sac": -0.486, "pv=affaires": -1.012, "nx=bic": -0.486, "tok=colline": -0.203, "tok=proposition": -0.476, "tok=miserable": -0.346, "tok=condamner": 1.175, "pv2=veines": 0.369, "tok=jugerent": 0.619, "pv=medecins": 0.619, "pv2=quand": -0.643, "nx=peu": 0.181, "tok=cicatrice": -0.208, "pv2=ce": -1.854, "tok=requerant": 0.606, "pv=resolutions": 0.203, "nx=l'aide": 0.606, "tok=seigneur": -0.273, "tok=interieur": -0.188, "pv2=admire": -0.188, "nx=cuir": -0.188, "tok=definir": 0.617, "tok=remettre": 1.306, "tok=inculte": 0.228, "pv=region": 0.618, "tok=debattirent": 0.872, "pv=cents": 0.872, "nx=longuement": 0.872, "pv=champs": 1.173, "pv=chutes": -0.692, "nx=temporaires": -0.692, "tok=tuile": -1.868, "pv2=poeles": -1.673, "tok=furieusement": 0.654, "pv=communistes": 0.873, "nx=antihitleriens": 0.654, "tok=prematurement": 0.565, "pv=roussies": 0.565, "nx=l'arrivee": 0.565, "pv2=d'amener": -0.207, "pv=metiers": 0.627, "nx=graphiste": 0.627, "tok=gonflant": 0.475, "tok=reduire": 0.999, "tok=port": -1.035, "tok=plate": 0.362, "tok=restant": 0.454, "nx=assises": 1.036, "tok=rever": 1.177, "nx=ami": -0.211, "tok=caroube": -0.153, "tok=muqueuse": -0.259, "tok=echanger": 0.383, "tok=aimer": 0.963, "tok=laitiere": 0.45, "pv=l'industrie": 0.672, "pv2=sucreries": 0.45, "tok=apiculteur": -0.193, "pv=ostreiculteurs": 0.46, "pv=sucre": 0.284, "nx=theorique": 0.352, "tok=exemplaire": 0.489, "pv=match": 0.489, "pv2=magasins": -0.716, "tok=lipide": -0.213, "pv2=correctement": -0.213, "pv=bacoulous": -0.56, "nx=chanteurs": -0.599, "nx=ouvres": 0.271, "tok=digestif": -0.178, "tok=symptome": -0.18, "pv2=soulager": -0.18, "nx=associes": -0.18, "tok=politicien": -0.168, "tok=determiner": 0.785, "pv2=reconnait": -0.166, "nx=phases": -0.166, "tok=uniformement": 0.446, "pv=anterieures": 0.446, "nx=vertes": 0.446, "tok=tissu": -0.634, "pv=actancielles": 0.479, "tok=priorite": -0.799, "pv=spatiaux": -0.799, "pv=signes": -0.583, "nx=velotypie": -0.583, "tok=climatique": 0.594, "pv=d'obstruction": 0.594, "pv2=modalites": 0.594, "tok=abord": -0.356, "tok=mariage": -0.291, "tok=jalapine": -0.418, "pv=resines": -0.418, "tok=dominante": -0.168, "pv2=zairiser": -0.168, "nx=industrielles": -0.257, "pv2=periurbaniser": -0.188, "pv2=pleins": -2.761, "tok=morphologiquement": 0.316, "pv=indifferentiables": 0.316, "pv2=biotypes": 0.316, "tok=relative": -0.719, "pv=d'humidite": -0.719, "pv2=mesures": -0.339, "nx=realisees": -0.719, "tok=signification": 0.279, "pv=profonde": 0.279, "nx=historique": 0.337, "pv2=films": 0.302, "pv2=ecoles": -0.706, "tok=audit": -0.694, "pv=dus": -0.694, "pv2=droits": -0.662, "nx=college": -0.694, "pv=albums": -0.54, "nx=autour": -0.634, "tok=speculateur": -0.218, "pv2=s'emballer": -0.197, "tok=cancer": -0.732, "pv=dependants": -0.682, "pv2=hormono": -0.682, "nx=testiculaire": -0.682, "pv=dechets": -1.495, "tok=ennemi": -0.443, "pv=purs": -0.652, "pv2=detruire": 0.215, "nx=teintes": 0.215, "tok=ligure": 0.304, "pv=piemontais": 0.304, "pv2=lombard": 0.304, "nx=emilien": 0.304, "tok=eclat": -0.263, "pv=couleurs": -0.385, "nx=d'rire": -0.385, "pv2=haricots": 0.189, "nx=actuel": 0.189, "tok=tech": 0.384, "pv=pro": 0.384, "pv2=societes": 0.384, "tok=paysan": -0.329, "tok=frapper": 1.936, "pv2=allait": 0.975, "pv2=cependant": -0.307, "pv2=fonction": -0.698, "tok=ramener": 1.24, "tok=clairiere": -0.241, "pv=veines": -1.572, "tok=exemple": -2.011, "pv=mille": -1.312, "tok=degager": 0.36, "tok=graphisme": -0.154, "pv2=oubliez": -0.154, "nx=mochissimes": -0.154, "tok=europeenne": -0.646, "tok=lecteur": -0.238, "tok=beaute": -0.735, "pv=conseils": -0.541, "tok=foie": -0.507, "pv=pharmaceutique": -0.493, "pv2=industries": -0.493, "tok=lupin": -0.207, "pv2='desamertumer'": -0.207, "tok=aristocrate": -0.234, "pv2=dyadiciser": -0.154, "nx=triadiques": -0.154, "pv=abat": -0.555, "pv=j'etais": -0.514, "tok=degenerative": -0.569, "pv=d'arthrite": -0.569, "pv2=lesions": -0.569, "pv2=embaumait": -0.152, "nx=bleues": -0.297, "pv=pommiers": -0.565, "pv2=production": -0.16, "nx=stockees": -0.16, "tok=consulter": 0.817, "tok=maigre": 0.395, "pv=vieux": -1.095, "tok=rugbymen": 0.668, "nx=beauvaisiens": 0.668, "tok=defendre": 0.568, "nx=poussent": 0.568, "pv2=lui": 0.335, "tok=ruban": -0.604, "tok=compagne": -0.162, "pv2=ete": -0.222, "nx=fideles": -0.157, "tok=influenceur": -0.229, "pv2=ostrogoths": -0.229, "nx=quebecois": 0.373, "tok=collection": -0.183, "pv=d'apprentissage": -0.442, "pv2=algorithmes": -0.442, "pv=l'evolution": 0.277, "pv2=memeticiens": 0.277, "pv=sapeurs": -0.742, "tok=journee": -0.357, "nx=livres": -0.244, "nx=n'etaient": -1.493, "tok=apprenant": -0.195, "pv2=d'aider": -0.195, "pv=tribus": 0.456, "nx=africaines": 0.456, "pv=impliquent": 0.384, "tok=socialiser": 0.53, "tok=signature": -0.523, "pv=chansons": -1.083, "pv2=filles": 0.615, "nx=remontent": -0.199, "tok=nervation": -0.16, "pv2=voyait": -0.231, "nx=palmees": -0.16, "tok=gazeuse": 0.305, "pv=encephalographie": 0.305, "pv2=neuroradiologiques": 0.305, "nx=arteriographie": 0.305, "pv2=grecs": -1.101, "nx=furieux": -1.163, "pv=demeure": -0.662, "pv2=ongules": -0.662, "tok=chenille": -0.597, "tok=inconvenient": -0.152, "tok=financiere": -0.683, "pv=economique": -0.683, "pv2=crises": -0.683, "nx=energetique": -0.683, "tok=ingenieur": -0.728, "pv2=besoins": 0.576, "pv2=cles": -0.871, "pv2=qu'un": 0.638, "tok=ave": 0.686, "pv=cinquante": 1.29, "nx=maria": 0.686, "tok=minorant": 0.715, "tok=quelle": 1.59, "pv=catimini": 0.523, "nx=joie": 0.523, "tok=kil": 1.477, "tok=bonneteau": -1.41, "pv=classes": -0.528, "tok=finesse": 0.262, "pv2=traits": 0.443, "nx=oranges": 0.822, "tok=publique": 0.278, "pv=l'ignorance": 0.278, "pv2=relisant": 0.278, "pv2=passions": 0.294, "tok=dirigeable": -0.885, "pv=tendances": -0.272, "nx=intemporelles": -0.493, "pv=creneaux": -0.564, "tok=comprimant": 0.405, "tok=byzantine": 0.802, "pv=l'epoque": 0.802, "pv2=militants": 0.585, "pv=port": 0.746, "nx=semblables": 0.504, "pv=isooleique": 0.296, "pv2=l'acide": 0.296, "pv2=inutilement": -0.196, "nx=salles": 0.81, "tok=loci": -0.678, "nx=situes": -1.275, "pv2=mon": 0.231, "tok=indetermination": 0.362, "pv=boises": 0.362, "pv2=massifs": 0.362, "tok=brutal": 0.207, "pv=air": 0.207, "tok=fragrance": -0.165, "pv2=reinventer": -0.165, "nx=preuve": -0.165, "tok=cumulation": 0.359, "pv=sporation": 0.359, "pv2=types": -0.195, "nx=gregation": 0.359, "tok=mission": -0.161, "tok=votant": 0.2, "pv2=perturbent": 1.016, "tok=supe": 0.881, "nx=rieures": 0.881, "pv2=mordiller": 1.043, "nx=bras": 1.504, "pv2=effectuer": -0.176, "pv=d'ordre": 0.243, "pv2=concessions": 0.243, "tok=apprenti": -0.678, "pv=maconniques": -0.678, "pv2=grades": -0.678, "nx=compagnon": -0.678, "tok=colere": -0.153, "pv=expressions": -0.469, "nx=naturee": -0.469, "tok=hospitaliere": -0.714, "pv=d'urgence": -0.714, "nx=peres": -0.557, "tok=linguistique": 0.228, "pv=structure": 0.256, "tok=resineuse": -0.68, "pv=note": -0.68, "pv2=sacrifiees": -0.68, "nx=forestiere": -0.68, "tok=sculpture": -0.346, "tok=juin": 1.849, "tok=superieure": -1.078, "pv=partie": 0.201, "pv=d'vne": -0.643, "pv2=nymphes": -0.643, "nx=proportionnee": -0.643, "tok=notable": -0.17, "pv2=l'attitude": -0.172, "pv=amis": 0.444, "tok=feutre": -0.694, "pv=graphiques": -0.694, "nx=crayon": -0.694, "tok=canal": -1.531, "tok=paleo": 1.521, "nx=neolithiques": 1.521, "pv2=gangs": 0.18, "pv2=offrait": -0.169, "tok=corsaire": -0.423, "pv2=chevaux": -0.52, "pv2=unifier": -0.151, "nx=categories": -0.151, "tok=etonner": 0.433, "pv=nourritures": 0.177, "pv2=choses": 0.422, "tok=lamentation": -0.197, "pv2=funebre": -0.197, "tok=confuceenne": 0.288, "pv=hindoue": 0.288, "pv2=civilisations": 0.303, "nx=musulmane": 0.288, "tok=rectifier": 0.36, "tok=millier": -0.218, "tok=reedifier": 1.769, "pv2=dut": 1.769, "tok=surprendre": 0.703, "tok=negociation": -0.245, "nx=sale": -0.177, "tok=peur": 1.135, "pv2=francais": 0.219, "nx=pendant": 0.708, "pv=cavalier": -0.681, "tok=decider": 0.418, "pv2=bouts": 0.222, "pv=archers": 0.187, "tok=denoncer": 1.047, "pv=societes": 0.505, "nx=tech": 0.505, "pv=pensees": 1.276, "pv=parlers": 0.37, "nx=occitans": 0.37, "tok=expliquer": 0.402, "nx=d'ailleurs": 0.402, "nx=dynamiques": -0.155, "tok=madrasa": -1.632, "pv2=batiments": -1.438, "tok=bar": -1.463, "pv2=agricoles": -1.463, "tok=gencive": -0.3, "tok=immobile": -1.464, "pv2=laisser": -0.189, "nx=s'engager": -0.166, "tok=ton": -0.625, "pv2=c'etaient": -0.185, "pv=mesaventures": 1.13, "nx=dommageables": 1.13, "tok=hierarchie": -0.188, "pv2=aplanir": -0.188, "nx=traditionnelles": -0.188, "pv2=surface": -0.182, "tok=vendeuse": -0.579, "pv2=huit": -1.094, "pv2=because": -0.165, "pv=malteries": 0.494, "tok=veterinaire": 0.265, "pv=specialises": 0.265, "nx=curateur": 0.265, "tok=choisir": -0.151, "pv2=d'aller": -0.151, "pv=locaux": -0.618, "pv2=jus": -0.618, "tok=fiction": -0.483, "pv=science": -0.483, "tok=gentlemen": -0.642, "tok=obstinement": 0.923, "tok=opposant": 0.581, "pv=prives": 0.585, "pv2=litiges": 0.585, "tok=present": -1.386, "pv=pensaient": -1.377, "tok=gosse": -0.273, "nx=aimeront": -0.273, "tok=transporter": 0.255, "tok=socio": 0.659, "pv=dynamiques": 0.659, "nx=hydrologiques": 0.659, "tok=substantif": -0.187, "tok=neuf": 2.402, "pv2=regroupe": 0.265, "nx=autres": 2.402, "pv=salles": 0.841, "nx=element": 0.371, "nx=chamonix": -1.119, "tok=habitant": -0.829, "pv2=sombres": 0.264, "nx=bleuatre": -0.476, "nx=francaises": -0.208, "pv=bonne": -1.396, "tok=redevable": -0.208, "pv2=contraindre": -0.208, "tok=coordinative": -0.278, "pv=fonctions": -0.278, "pv=portables": -0.371, "pv2=pc": -0.371, "tok=symbole": -0.231, "pv=bas": -0.383, "nx=chair": -0.383, "tok=fluo": 0.294, "pv=ampoules": 0.28, "nx=compactes": 0.735, "tok=createur": 1.553, "pv2=celebre": 1.436, "nx=rice": 0.828, "tok=visiteur": -0.245, "pv2=aide": -0.344, "pv2=aime": -0.164, "nx=techniques": -0.164, "tok=conservateur": -0.291, "tok=visiter": 0.662, "nx=payer": 0.662, "pv=musclors": -0.365, "tok=odieuse": -0.176, "pv2=balourde": -0.176, "nx=toiles": -0.176, "pv2=traiter": -0.189, "tok=arterielle": 0.282, "pv=tension": 0.581, "pv2=muscles": 0.282, "tok=observation": -0.489, "nx=me": -0.453, "pv2=quittait": -0.201, "tok=pensee": -0.162, "pv=foncent": 0.559, "tok=hurlement": -0.219, "nx=revolutions": 0.831, "tok=touriste": -0.192, "pv=serbes": -0.47, "pv=especes": -0.35, "nx=zelandais": 1.373, "nx=contact": 0.252, "pv=specialistes": -0.193, "pv2=larmes": -0.579, "tok=electriquement": 0.306, "pv=chargees": 0.306, "pv2=particules": 0.306, "nx=purent": -0.215, "nx=droits": -0.153, "pv=articules": 0.287, "pv2=fleaux": 0.287, "tok=nitrique": 0.257, "pv=d'acide": 0.707, "pv2=gouttes": 0.257, "tok=streusel": -0.186, "pv2=cuire": -0.186, "pv=relisons": -0.673, "nx=rate": 0.165, "tok=outil": -0.195, "pv=carrosserie": 0.411, "pv2=neuve": 0.411, "nx=luxe": 0.411, "tok=femelle": -1.404, "pv=male": -0.476, "nx=tandis": -0.476, "nx=porte": 0.626, "pv=inusuelles": -0.704, "nx=extremement": -0.712, "pv2=s'aggrave": 1.516, "tok=vendit": 1.3, "tok=inspecta": 1.955, "pv2=prince": 1.745, "pv2=œuvres": -2.708, "nx=annees": -0.28, "tok=parurent": 1.243, "pv=ecraignes": 0.521, "nx=suspectes": 0.521, "tok=saunier": -0.598, "nx=eux": -0.598, "pv2=guide": -0.17, "tok=nerf": -0.391, "tok=soin": -0.3, "pv=melanges": -0.408, "nx=dmf": -0.408, "pv2=qualites": -0.323, "tok=gigantesque": -1.523, "pv=longueur": -1.558, "nx=l'enjambee": -1.558, "tok=entretenir": 0.545, "tok=usager": -0.172, "tok=monture": -0.178, "pv=publiques": -0.532, "pv2=repousse": -0.225, "tok=entortillant": -0.316, "tok=peau": -0.419, "pv2=qu'en": 1.165, "pv=universites": -0.585, "tok=miton": -0.516, "pv=onguents": -0.516, "nx=mitaine": -0.516, "nx=cœurs": 0.189, "pv2=soit": -0.176, "nx=jettent": -0.161, "pv2=nourrissons": -0.195, "tok=civile": 0.378, "pv=l'aviation": 0.297, "pv2=retraites": 0.339, "tok=exigence": -0.152, "pv2=precise": -0.152, "tok=malique": -0.151, "pv=fumarique": 0.332, "pv2=carboxyliques": 0.332, "nx=oxalique": 0.332, "pv=telle": 0.181, "pv2=venus": 1.11, "nx=eclateront": 1.367, "pv2=franchissant": -0.311, "tok=esclave": -1.184, "tok=fibre": -0.435, "pv=armees": -0.585, "pv=pneus": -0.948, "pv2=famille": -0.183, "pv=relations": -0.83, "nx=prive": -0.49, "nx=telles": 0.418, "tok=abimer": 0.555, "pv=plastiques": 0.295, "nx=l'exposition": 0.295, "nx=successives": -0.178, "tok=bienvenue": -0.698, "pv=rythmees": -0.698, "pv2=choregraphies": -0.698, "tok=baiser": -0.201, "nx=coupables": -0.201, "pv=applications": 0.744, "nx=public": 0.767, "tok=photographier": -0.152, "pv2=pusse": -0.152, "tok=attaquant": 0.176, "tok=puissant": 0.346, "nx=fripons": 0.712, "tok=garantie": -0.159, "pv2=place": -0.2, "nx=prevues": -0.159, "tok=interpreter": 0.712, "pv2=ensuite": -0.277, "tok=trapu": 0.473, "pv=court": 0.473, "tok=proposer": 1.347, "tok=bolchevique": -0.406, "pv=partis": -0.406, "pv2=torrents": -0.571, "pv2=charges": 1.221, "nx=ligne": 1.059, "tok=diesel": -0.716, "pv=motorisations": -0.716, "pv=jesuites": -0.571, "nx=d'ithos": -0.571, "pv2=pourquoi": -0.453, "tok=nuage": -0.266, "pv2=tenue": 1.534, "tok=enrober": 1.119, "tok=mammifere": -0.208, "nx=hydraulistes": -0.591, "tok=entree": 0.293, "tok=vendre": 0.236, "pv2=comptait": -0.252, "pv=barbares": 0.485, "nx=politie": 0.485, "pv2=marches": 0.281, "nx=modifies": -0.212, "tok=temperature": -0.191, "pv2=bidons": 0.195, "pv2=rouges": 0.351, "pv=substantifs": -0.515, "nx=enjolivure": -0.515, "tok=clignoteur": 0.227, "pv=rond": 0.227, "tok=grassement": 0.197, "pv=peu": -1.248, "tok=egoutter": 1.565, "pv=fromages": 0.496, "nx=marche": 0.941, "tok=luisance": -0.232, "pv=fragrances": -0.41, "pv=blanc": 0.753, "pv2=apprehende": -0.304, "tok=enorme": -0.63, "pv=fetes": -0.717, "tok=suivre": 0.637, "pv=nourrices": -0.571, "pv2=fameuses": -0.571, "nx=designant": -0.571, "pv2=belges": 0.366, "tok=survint": 0.677, "pv=esprits": 0.677, "nx=l'abominable": 0.677, "tok=phobique": -0.319, "tok=personnage": -0.158, "nx=futiles": 0.73, "tok=albumine": -0.17, "nx=isotonise": -0.17, "tok=kanji": -0.484, "pv2=lisent": -0.484, "pv=huiles": 0.718, "nx=s'il": 1.029, "tok=butineur": -0.173, "tok=detailler": 0.66, "tok=poussant": -0.213, "pv2=yahve": -0.213, "pv2=j'invite": -0.183, "tok=celibataire": -0.312, "tok=proche": -0.744, "tok=decoratrice": 0.298, "pv=plisseuse": 0.298, "pv2=talents": 0.298, "nx=couturiere": 0.298, "pv2=visiter": 0.281, "pv2=mesurer": -0.182, "pv=salons": 0.503, "tok=oui": -0.162, "tok=degingandee": -1.446, "tok=payer": 0.38, "nx=mimetiques": 1.301, "tok=picotement": -0.176, "nx=chelous": -0.176, "tok=saisissant": 0.503, "pv=stages": 0.503, "tok=purifier": -0.196, "pv2=citadins": -0.196, "tok=comptable": -0.585, "pv=d'expert": -0.585, "nx=monsieur": -1.383, "nx=ensemble": -1.404, "pv=irlandaise": 0.382, "pv2=communautes": 0.382, "nx=chinoise": 0.382, "pv=avives": -0.384, "nx=enflees": -0.384, "nx=generation": -0.563, "tok=propre": -0.385, "nx=ogres": -0.238, "pv2=recensant": -0.24, "nx=dates": -0.264, "tok=collage": -0.367, "pv=rebracs": -0.367, "tok=volontaire": -0.578, "tok=veiller": 0.573, "tok=medicale": 0.239, "pv=visite": 0.239, "nx=tension": 0.239, "tok=romantique": -1.002, "tok=mener": 0.824, "nx=bon": 0.306, "pv=officielles": 0.193, "pv2=relations": 0.193, "tok=oublier": 0.515, "tok=possibilite": -0.727, "tok=brossant": 0.658, "pv=chanteurs": -0.731, "pv2=sodebo": 0.876, "tok=dossier": -0.233, "pv2=vingt": -0.432, "tok=lopin": -0.541, "tok=humide": -1.04, "pv=d'ombre": -1.253, "pv2=coins": -1.04, "nx=grouillaient": -1.04, "nx=postes": 0.74, "tok=militaire": -0.223, "pv=noces": 0.216, "tok=audiovisuel": -0.337, "pv=regies": -0.337, "tok=accastillage": -0.193, "pv2=comparait": -0.193, "tok=regionale": -1.382, "pv=coutume": -1.382, "nx=orgues": -0.152, "tok=merci": 0.605, "pv=choses": 1.525, "nx=portent": -0.205, "tok=ridant": -1.28, "pv=craintes": 0.362, "tok=calmement": 0.908, "pv=vingt": 0.908, "pv2=caracteres": -0.606, "tok=ecart": -0.342, "tok=pathologiquement": 0.306, "pv=mithridatises": 0.306, "pv2=rats": 0.306, "nx=agressifs": 0.306, "tok=frenetique": 0.388, "pv=l'exaltation": 0.388, "pv2=combattans": 0.388, "pv2=rendement": 0.671, "nx=typiquement": -0.164, "tok=maire": -1.998, "pv=absolus": 0.45, "tok=laisser": 2.043, "pv2=jamais": 1.306, "nx=seuls": 0.743, "pv=lampassettes": 0.472, "nx=cachemire": 0.472, "tok=enrichir": 0.32, "tok=nomen": -0.367, "pv=seuls": -0.367, "pv=agrumes": 0.243, "nx=cyprien": 0.626, "tok=clocher": -0.27, "nx=bavards": -0.27, "tok=entreprendre": 0.888, "tok=supprimer": -0.377, "tok=docteur": 0.219, "tok=ail": 1.247, "pv=linguine": 1.247, "tok=obliquement": 0.68, "tok=formalite": -0.407, "nx=permettent": -0.241, "pv2=rarete": 0.388, "tok=eclosion": 0.18, "tok=enveloppante": 0.491, "pv=l'action": 0.491, "tok=culture": -0.564, "nx=pogroms": -0.3, "pv=anatoliens": 0.513, "pv2=plateaux": 0.513, "nx=elevee": 0.513, "pv=filets": 0.756, "pv=bermudas": 0.939, "nx=framboise": 0.939, "pv2=pretres": 0.2, "pv=films": -0.723, "nx=repos": 0.158, "pv=pouvoir": 0.214, "tok=natif": -0.824, "pv=l'un": 0.179, "pv2=docteurs": -0.814, "nx=d'allemagne": -0.814, "nx=cents": 1.671, "pv=l'œil": 0.714, "pv2=vifs": 0.714, "pv=perfectionnements": -0.273, "tok=cordonnet": -0.156, "tok=ovisme": 0.814, "pv=theories": 0.814, "tok=rouston": -0.201, "pv2=grattant": -0.201, "pv2=chairs": 0.155, "tok=architecturale": 0.378, "pv=picturale": 0.378, "nx=sculpturale": 0.378, "nx=glaciaux": -0.222, "pv=pantophobies": 1.009, "tok=exploit": -0.213, "tok=briser": 0.485, "pv2=prepare": -0.261, "tok=livreur": -0.575, "tok=traitant": 0.961, "pv=main": 0.217, "pv2=pratique": -0.312, "tok=renseignement": -0.278, "tok=pur": 1.401, "pv2=ritals": -0.32, "nx=jus": -0.32, "tok=distinction": -0.665, "tok=repetition": -0.191, "nx=peyrade": 2.809, "tok=dominicain": -0.414, "pv=toxicomane": 0.366, "tok=collaboration": -0.583, "pv=metaux": -0.583, "tok=gilet": -0.184, "nx=jaunes": -0.364, "tok=penalement": 0.746, "pv=physiques": 0.746, "tok=insertion": 0.312, "pv2=differents": -0.774, "nx=prioritaire": 0.312, "tok=nationale": 0.261, "pv=gloire": 0.221, "pv=bon": 0.731, "tok=attendre": 0.548, "tok=pret": -0.979, "tok=start": 1.59, "nx=uppeurs": 1.59, "tok=synonyme": -0.421, "pv=playoffs": -0.421, "tok=microflore": 0.301, "pv=flore": 0.301, "pv2=vivants": 0.318, "nx=faune": 0.301, "tok=desillusionnee": 0.249, "pv=jeunesse": 0.272, "pv2=quelle": 0.661, "nx=villes": -0.155, "tok=sou": -1.647, "pv=amasses": -1.094, "nx=handicapees": -0.193, "nx=idee": 0.487, "tok=automate": -0.55, "pv=creatures": -0.55, "nx=robot": -0.55, "tok=bougre": -0.526, "pv=entier": 0.406, "pv2=dates": 0.406, "pv=arches": 1.093, "pv2=coup": -0.221, "pv2=lequel": -0.314, "tok=tutoyant": -0.87, "nx=parmi": -0.379, "pv2=instant": -0.184, "nx=bedaines": -0.184, "nx=semi": -0.806, "pv2=reaction": 0.215, "pv=renonculinees": 0.986, "tok=lanceole": 0.195, "pv=hamecon": 0.195, "pv=extreme": 0.346, "pv2=etudes": 0.413, "tok=embrouiller": 0.414, "nx=paradoxaux": -0.15, "tok=guerrier": -0.231, "pv2=s'endorment": -0.231, "tok=chiffrement": 0.586, "pv=l'aboutissement": 0.247, "pv2=discours": 0.223, "tok=contemporaine": 0.294, "pv=francaise": 0.294, "pv2=l'historiographie": 0.294, "nx=admet": 0.294, "pv=medecin": 0.349, "pv=anciennes": -0.524, "pv2=populaires": -1.286, "tok=poussoir": -0.151, "pv2=contreplaque": -0.151, "nx=effets": -0.942, "nx=germaniques": 0.799, "pv=datations": -0.553, "nx=effectuees": -0.553, "tok=brouillard": -0.206, "pv2=d'avec": -0.206, "pv2=sanifier": -0.264, "pv2=deja": -0.299, "tok=recouvrit": 1.182, "pv2=on": 1.182, "nx=fontainebleausiens": -0.397, "pv2=graver": -0.176, "pv2=qu'a": 1.206, "tok=fil": -1.522, "pv2=intacts": -1.522, "nx=regulierement": -1.522, "pv=misumene": 0.436, "pv2=taches": -0.43, "nx=pachygnatha": 0.436, "tok=journal": -0.556, "pv2=sectaires": -1.592, "nx=pointe": -1.592, "pv2=vite": -0.171, "nx=vibrants": -0.233, "tok=edition": 0.172, "nx=sympathiques": 1.24, "pv2=mixez": -0.358, "pv2=dieux": -1.219, "nx=explique": -1.285, "tok=compagnie": -0.28, "pv2=il": 1.374, "tok=nazi": -1.428, "pv2=premiers": -1.428, "tok=changement": -0.194, "tok=regardant": 0.407, "pv=buts": -1.089, "tok=soumettre": -0.151, "tok=lestant": -1.414, "tok=grasse": 0.924, "pv=gens": 0.924, "pv2=meubles": 1.432, "pv=macreuses": -0.355, "tok=decapiter": 1.134, "pv2=transborder": -0.175, "tok=marquise": -0.703, "tok=vaincre": 0.365, "tok=horizontale": -0.403, "pv=etablissements": 0.245, "nx=universitaires": 0.245, "tok=jolie": -0.19, "nx=valenciennes": -0.19, "pv2=emploierait": -0.179, "tok=nulle": 0.932, "pv2=puisqu'entre": 0.932, "nx=alterite": 0.932, "tok=savant": -1.49, "pv=doyens": -0.652, "tok=soignant": -0.904, "pv=personnel": -0.904, "nx=enseignants": -0.904, "pv2=redisent": -0.169, "nx=d'alexandre": -0.169, "tok=sortant": -0.69, "nx=kg": -0.417, "tok=silence": 0.224, "pv=juste": 0.159, "pv2=adieux": 0.159, "nx=hijiki": -0.264, "tok=matant": -1.13, "tok=autorisant": 0.453, "nx=jouent": -0.227, "tok=rapage": -0.342, "tok=margarique": 0.299, "pv=butyrique": 0.299, "pv2=oleique": 0.299, "nx=donnent": 0.248, "tok=mobile": 0.537, "pv=provinciaux": 0.763, "tok=soudant": 0.395, "pv2=pretes": 0.825, "nx=confidences": 0.825, "nx=lueur": 0.872, "nx=tires": -0.205, "pv2=minutes": 0.447, "pv=morales": 0.612, "nx=publics": -0.439, "tok=sauvat": 1.127, "tok=inerte": -0.741, "pv=git": -0.741, "pv2=nœuds": -0.741, "tok=garrigue": -0.19, "pv2=vulgaire": -0.19, "pv=coupe": -1.04, "pv=arrieres": 0.179, "nx=politique": 0.301, "pv=habitants": 0.739, "pv=pousse": -0.528, "pv2=voyageur": -0.188, "nx=uniques": -0.188, "tok=archi": 1.639, "pv2=places": 1.639, "nx=riches": 1.552, "nx=pagnolesques": -0.178, "pv=plantes": -0.682, "nx=permettaient": -0.682, "tok=transparente": 0.207, "nx=becs": 0.807, "tok=existant": -0.997, "pv=differences": -0.346, "tok=alimentaire": 0.469, "pv=d'hyperglycemie": 0.469, "pv2=epreuves": 0.469, "tok=mutisme": 0.886, "pv=questions": 0.886, "nx=employe": 0.886, "tok=aguerrie": 0.485, "pv=plongeuse": 0.485, "pv2=profondeurs": 0.52, "tok=parallele": -1.206, "pv=d'additionneurs": -0.595, "pv2=taxer": 0.504, "tok=celeste": 0.294, "tok=approvisionner": 1.282, "pv2=village": 1.282, "pv2=lasurat": -0.21, "pv=choix": -0.607, "pv2=surfaces": -0.558, "tok=profession": 0.999, "pv2=tarbes": -0.234, "tok=porterent": 1.289, "pv=inquietudes": 1.158, "pv=egarements": 0.731, "pv2=mes": 1.933, "nx=communication": 0.731, "pv=arriere": -0.66, "pv2=arriere": -0.66, "pv2=idees": 0.459, "nx=lourdes": -0.16, "tok=precipiter": 0.527, "tok=television": 0.452, "pv=radio": 0.452, "pv2=presse": 0.331, "tok=fendre": -0.221, "pv2=l'egyptienne": -0.221, "tok=volcanisme": 0.608, "pv=pression": 0.608, "tok=meilleure": 0.501, "nx=table": 0.62, "tok=devant": 0.25, "pv=d'affaires": 0.25, "nx=centimetres": 0.418, "pv=sauvegardes": -0.412, "tok=allemande": 0.975, "pv=anglaise": 0.407, "pv2=litteratures": 0.407, "pv2=attrape": -0.181, "pv=ombre": -0.683, "pv2=debits": -0.683, "nx=hotu": -0.683, "pv=signaux": 0.444, "nx=mono": 0.444, "tok=hieratique": 0.444, "pv=hieroglyphique": 0.444, "pv2=d'ecriture": 0.444, "tok=convention": -0.21, "nx=paraissent": -0.21, "tok=regarder": 1.429, "pv2=molle": 0.888, "tok=menu": -0.347, "tok=pommette": -0.174, "nx=saillantes": -0.172, "tok=feroce": 0.29, "pv=inertes": 0.29, "pv2=dehors": 0.29, "tok=suppliant": 0.382, "pv=pleurant": 0.382, "pv2=bras": 0.452, "pv2=zorros": 0.19, "tok=donneur": 1.137, "pv=interventions": 1.137, "tok=democrate": -0.206, "tok=perissable": 0.237, "pv=bousiller": 0.265, "tok=numeriser": 1.337, "pv=poignets": -0.35, "nx=directes": -0.264, "tok=yak": 0.661, "pv=dimos": 0.661, "tok=armenien": 0.481, "pv=turc": 0.481, "pv2=langues": 0.481, "tok=voyant": -0.291, "nx=paroi": 0.411, "pv=oraux": -0.682, "pv2=phonemes": -0.682, "tok=nourrir": 0.619, "tok=distinguant": 0.364, "pv=allemandes": 0.364, "pv2=sentinelles": 0.364, "tok=morceau": 0.192, "tok=concitoyen": -0.178, "pv=quarante": 0.182, "tok=pepe": -0.967, "pv=merci": -0.967, "tok=alternativement": 0.312, "pv=d'andrinople": 0.312, "pv2=depots": 0.325, "tok=enzyme": -0.159, "tok=chaude": -0.682, "nx=habilement": -0.682, "pv=mauvaise": 0.211, "tok=imbecile": -0.271, "tok=age": 0.229, "tok=elevee": 0.39, "pv2=anatoliens": 0.39, "tok=habitude": -0.539, "nx=chevaleresques": -0.247, "pv2=plantes": -0.477, "nx=apparaissent": -0.548, "tok=pate": -0.182, "nx=optimisees": -0.182, "tok=recueil": 0.915, "pv=orfraies": 0.915, "nx=jusque": 0.91, "tok=infailliblement": 0.682, "pv=confondent": 0.682, "tok=importance": 0.199, "tok=electeur": -0.165, "tok=agenesique": 0.594, "pv=d'hybridite": 0.594, "nx=hagards": -0.161, "tok=inseparable": -1.325, "pv=maniere": -1.325, "tok=altitude": -0.196, "pv2=pouvez": 1.16, "pv=rachistes": -0.225, "tok=diriger": 0.674, "pv=affluents": 0.596, "nx=chiens": -0.168, "nx=facons": -0.219, "pv=vote": 0.545, "pv=nœuds": -0.617, "tok=comedie": 0.293, "pv=russes": 0.293, "pv2=poupees": 0.293, "nx=euro": 0.293, "pv=l'ere": 0.255, "nx=colombienne": 0.255, "pv=techniques": 0.677, "nx=immunologiques": 0.677, "pv=faciles": 0.544, "tok=referma": 1.626, "nx=lentement": 1.626, "tok=pluriel": -0.284, "tok=durement": 0.579, "pv=lorrains": 0.579, "nx=touches": 0.579, "tok=the": -0.37, "pv=roses": -0.407, "pv2=sensibilite": 0.258, "tok=accouchement": -0.159, "nx=glaciaires": -0.237, "pv2=garde": 1.069, "nx=devaient": 1.069, "tok=volumique": 0.994, "pv2=termes": 0.228, "pv2=relevez": -0.186, "pv=populations": 0.733, "tok=aquatique": -0.421, "pv=renoncules": -0.421, "nx=dominants": -0.311, "tok=chapelain": -0.214, "tok=courtisan": -0.2, "tok=essuyer": 0.858, "pv2=bruler": -0.228, "pv=voyages": -0.937, "nx=corporels": -0.937, "pv=societe": 0.226, "pv2=violettes": -1.41, "tok=imprevue": 0.5, "pv=l'attaque": 0.5, "pv2=s'appellent": 0.5, "tok=hieroglyphique": 0.268, "pv=d'ecriture": 0.268, "pv2=systemes": 0.562, "nx=hieratique": 0.268, "tok=carbo": 1.433, "pv2=l'echange": 1.433, "nx=hydrates": 1.433, "pv=metropoles": 0.3, "pv2=grandes": 0.3, "nx=tactiles": -0.338, "tok=carlin": 0.207, "nx=croisieres": 0.614, "pv2=resiphonner": -0.189, "nx=dechets": -0.189, "pv2=orchestrer": -0.185, "tok=molasse": -0.292, "nx=couvertes": -0.299, "pv=tensions": -0.652, "tok=coronarien": -0.77, "pv=pontage": -0.77, "pv2=cardiaques": -0.77, "nx=doux": -1.043, "pv=seules": -0.577, "tok=decoupure": -0.208, "nx=defensives": -0.259, "pv=interieurs": -0.422, "pv=anglais": -0.3, "pv=litigieuses": 0.22, "pv2=marchandises": 0.22, "nx=difference": 0.22, "pv=invitant": -0.518, "nx=enrage": 0.555, "pv=legislatives": -1.23, "nx=continuelles": -0.366, "tok=annexant": -0.177, "pv2=ryukyu": -0.177, "pv=aucune": 0.846, "nx=n'egale": 0.407, "pv2=elections": -0.606, "tok=liqueur": -0.58, "nx=fortes": -0.6, "tok=asseoir": 0.286, "pv=nu": -0.675, "pv2=sol": -0.675, "nx=surfaces": -0.717, "tok=debarrasser": 1.684, "tok=sinusite": -0.232, "pv=campagnardes": -0.495, "nx=sortir": 0.23, "tok=glop": -0.496, "pv=glop": -0.496, "nx=voltes": 0.261, "tok=prestation": -0.442, "tok=clerc": -0.222, "pv=ligne": -0.55, "nx=transparentes": -0.225, "pv=oviductes": -0.279, "tok=coronal": 1.049, "pv=chorions": 1.049, "nx=anti": -0.193, "tok=meunier": -1.536, "tok=degre": -0.333, "nx=variant": -0.333, "pv=cheveux": -0.725, "nx=blancs": 0.19, "tok=echantillon": -0.313, "tok=verticale": -0.383, "pv=anglophones": -0.383, "tok=achetant": -0.165, "nx=jouant": -0.165, "pv=ressorts": 0.966, "pv2=pulsions": -0.798, "tok=proteome": -0.766, "pv=genome": -0.766, "tok=dorade": -0.233, "pv2=harponner": -0.233, "nx=lorsqu'elles": 0.893, "tok=inscription": -0.326, "tok=transformant": 0.605, "tok=deconcerter": 0.881, "tok=officinal": 0.311, "pv=polygonate": 0.311, "pv2=communs": 0.344, "nx=grenouillet": 0.311, "pv2=integration": 1.181, "nx=championnes": 1.181, "tok=interaction": -0.216, "pv2=integrant": -0.155, "pv=initiatives": 0.367, "nx=esperanto": 0.367, "nx=enflee": -0.215, "tok=mescaline": 0.317, "pv=classiques": 0.317, "pv2=hallucinogenes": 0.317, "nx=psilocybine": 0.317, "tok=detecteur": -0.247, "nx=perimetriques": -0.247, "pv=bicots": -0.576, "tok=visioconference": 0.498, "pv=combine": 0.498, "pv2=l'holoportation": 0.498, "pv=saunier": 0.182, "pv2=bail": 0.182, "nx=machine": 1.113, "tok=horizontalement": 0.298, "pv=disposes": 0.298, "pv2=trouve": 1.459, "tok=clore": -0.638, "pv2=reverduriser": -0.19, "tok=demander": 1.767, "pv2=aller": 1.767, "pv2=partys": -0.647, "pv=d'hemoclasie": -0.544, "pv=marees": 0.93, "tok=hetero": -1.153, "tok=apporter": 0.344, "tok=secondaire": -0.639, "pv=enseignements": -0.361, "nx=s'arretant": -2.842, "tok=sonneur": -0.454, "tok=fondre": 0.764, "pv2=va": 2.522, "pv=catalogue": 0.403, "pv2=tuiles": 0.403, "nx=enchere": 0.403, "pv=couts": -0.481, "nx=cq": -0.481, "pv=successives": 0.199, "pv2=enveloppes": 0.199, "tok=carrosserie": 0.293, "pv=neuve": 0.293, "nx=grand": 0.345, "nx=moyen": 0.216, "tok=retrouvaille": -0.328, "pv=exemplaire": 0.414, "pv2=match": 0.414, "nx=but": 0.414, "tok=male": -0.972, "tok=tracteur": -0.75, "pv=tonnes": -0.699, "nx=prochain": 2.198, "nx=nuages": -0.245, "pv=haute": 0.403, "tok=completement": 0.722, "pv=recueillir": 0.722, "pv=platines": 0.848, "pv2=n'attaquent": 0.175, "nx=espece": 0.175, "tok=laser": -0.672, "pv=d'onde": -0.672, "pv2=longueurs": -0.672, "tok=surprise": 0.277, "nx=haut": 0.575, "tok=traire": 1.03, "pv=chevaux": 0.235, "tok=prescripteur": -0.725, "pv=nouveaux": -0.725, "tok=marecage": -0.453, "tok=curateur": 0.304, "pv=veterinaire": 0.304, "pv2=specialises": 0.304, "nx=registraire": 0.304, "tok=arenite": 0.501, "pv=lutites": 0.501, "pv2=granulometriques": 0.501, "pv2=reliant": -0.156, "nx=gisements": -0.156, "tok=separant": 0.428, "tok=total": 0.389, "pv=d'importation": 0.389, "pv2=taxes": 0.389, "pv2=habilement": -0.255, "tok=applaudissement": -0.259, "pv2=hourvari": -0.166, "nx=ressemblaient": -0.166, "pv2=changer": -0.159, "tok=monstre": -0.198, "nx=marins": -0.154, "nx=soumis": -0.191, "pv=detenus": 0.295, "nx=nationales": -0.269, "nx=sakhalar": 0.44, "pv=vert": -1.771, "nx=blanches": -0.558, "tok=joli": -0.431, "pv=anons": -0.431, "nx=gracieux": -0.431, "tok=reconnaitre": 0.379, "pv=tropicaux": 0.208, "pv2=recifs": 0.208, "tok=feu": 1.103, "tok=milli": 0.154, "nx=juste": 0.154, "pv=universalistes": 0.157, "nx=territoriales": 0.157, "pv=fleches": 0.547, "tok=laissant": 0.615, "nx=vaguer": 0.615, "nx=receptions": 0.566, "pv2=centralisant": -0.246, "pv2=arrosant": 0.548, "nx=alimentaires": -0.17, "pv=parure": 0.293, "pv2=dimanches": 0.322, "nx=robes": 0.293, "tok=energetique": 0.292, "pv=financiere": 0.292, "pv2=economique": 0.292, "nx=alimentaire": 0.292, "pv2=delicats": 0.223, "nx=tatouages": 0.223, "pv=neuf": 0.631, "pv2=l'an": 0.543, "nx=jungiens": -0.204, "pv=prenotions": 1.034, "nx=supporters": 1.444, "tok=mineure": -0.832, "pv2=alphabets": -0.832, "nx=l'introduction": 0.21, "nx=rochers": -0.488, "tok=pop": 1.044, "pv2=pique": 1.044, "nx=corns": 1.044, "tok=leger": 0.555, "pv=l'armement": 0.461, "pv2=vivres": 0.461, "tok=chance": -0.387, "tok=borique": 0.286, "pv=chlorique": 0.286, "pv2=chromique": 0.286, "nx=acetique": 0.286, "tok=juillet": 1.642, "pv2=infames": -1.478, "pv2=possedable": -0.198, "nx=intellectuelles": -0.198, "tok=crut": 0.927, "pv=pur": -0.646, "pv2=saucissons": -0.646, "nx=lesquels": -0.716, "tok=miracle": 0.233, "pv2=balles": 0.247, "nx=quotidien": 0.247, "pv2=amener": -0.219, "pv2=statues": 0.555, "pv2=rappelait": -0.18, "pv2=coussinets": -0.531, "nx=denses": -0.531, "tok=moleculaire": -0.842, "pv=biologie": -0.842, "pv2=genetiques": -0.842, "tok=but": -1.383, "pv2=suivants": -1.418, "tok=trousser": 1.323, "nx=n'existent": -1.447, "pv=leucinoses": 0.219, "tok=passant": -1.183, "pv=imperceptible": 0.157, "nx=d'epaule": 0.157, "pv=d'air": -0.36, "pv2=parcelles": -0.36, "tok=hedoniste": 0.467, "pv=utilitaire": 0.467, "pv2=ordinaire": 0.467, "pv2=debordement": -0.158, "tok=courante": -0.403, "pv2=n'osait": 1.602, "pv=respiratoires": 0.307, "pv2=voies": 0.307, "pv=quartiers": 0.572, "pv2=ulceres": 0.651, "tok=isolement": 0.947, "pv=gregaires": 0.947, "tok=omission": -0.23, "pv2=cathegorie": -0.172, "nx=volontaires": -0.172, "nx=meridionaux": -0.611, "pv=economies": -0.335, "pv2=sanglantes": -1.413, "pv=reglages": 0.184, "tok=chanoinesse": -0.157, "pv2=annee": -0.157, "nx=elisaient": -0.157, "nx=muet": 0.901, "tok=longuement": 0.338, "pv=debattirent": 0.338, "nx=collectif": -0.543, "nx=reagissent": -0.22, "tok=breuil": -0.419, "tok=nombril": -1.635, "pv=mouvements": -0.839, "nx=pivotement": -0.839, "tok=populiste": -1.324, "pv=dangereux": -1.324, "tok=musette": -0.808, "pv=valses": -0.472, "nx=confirme": -0.217, "tok=chemisette": -0.321, "pv2=scooters": 0.153, "nx=invente": 0.153, "tok=essentiel": 0.278, "pv=s'avere": 0.278, "pv=principaux": -0.483, "nx=croix": -0.483, "tok=siderurgique": 0.222, "tok=pigeon": -0.167, "tok=pote": -0.181, "tok=traiter": 0.845, "tok=damnable": 0.371, "pv=projet": 0.371, "pv2=damnables": 0.371, "tok=empereur": -0.275, "tok=poli": 1.408, "pv2=bouche": 1.408, "nx=ons": 1.408, "nx=romains": -0.196, "nx=cookies": -0.466, "nx=aquatiques": -0.208, "tok=renvoyant": 0.427, "pv=evenements": 0.747, "pv=enfants": -0.655, "pv=sons": 0.565, "nx=enregistres": 0.565, "nx=delegues": 1.769, "pv=cochons": 0.636, "tok=reunion": -0.179, "nx=litteraires": -0.18, "nx=d'affilee": 0.789, "nx=terrifiants": -0.153, "tok=saisir": -0.713, "pv2=veulent": -0.178, "tok=brevet": -1.466, "nx=elementaire": -1.466, "nx=messes": -0.176, "tok=rapprocher": 0.674, "pv=pisse": -1.192, "tok=ougandaise": -0.966, "pv=nationales": -0.966, "pv2=compagnies": -1.549, "pv=loupe": -0.631, "nx=masse": -0.631, "tok=precedant": 0.613, "nx=l'epreuve": 0.613, "pv=bondieusards": 0.966, "tok=horde": -0.262, "nx=fanatisees": -0.262, "tok=exerese": 0.646, "pv=ectomies": 0.646, "nx=totale": 0.646, "pv=cruciferes": -0.195, "tok=ventriculaire": -0.921, "pv=d'assistance": -0.921, "pv2=dispositifs": -0.758, "pv=gammes": 0.465, "pv2=revue": -0.169, "tok=hysterie": -0.586, "pv=diverses": -1.354, "pv2=pathologies": -0.586, "nx=anxiete": -0.586, "pv=nuances": -0.671, "nx=restent": -0.165, "tok=panorama": -1.695, "pv=etudiantes": 0.736, "nx=socialistes": 0.296, "tok=these": -0.307, "pv2=nous": -0.274, "pv=colles": -1.234, "pv2=profils": -1.234, "nx=redoutables": -0.177, "tok=scolaire": -1.245, "pv=d'internat": -1.245, "pv2=fermai": -0.165, "tok=numeration": 0.901, "tok=totale": 0.385, "pv=exerese": 0.385, "pv2=ectomies": 0.385, "pv=corniches": -0.549, "nx=hissait": -0.549, "tok=restreindre": 1.383, "pv2=voulu": 1.383, "pv=seuils": -0.542, "pv2=valeurs": -0.542, "pv2=d'eviter": -0.243, "nx=emouvantes": -0.167, "tok=suivante": 1.178, "pv=l'annee": 1.702, "pv=faisceaux": 0.6, "nx=arrogamment": 0.6, "tok=couvrant": 0.786, "tok=tailler": 0.561, "pv=version": -0.97, "pv2=etoiles": -0.859, "tok=glanage": 0.177, "pv2=vignobles": 0.177, "nx=plaintes": 0.593, "tok=lien": -0.531, "tok=bupreste": -0.409, "pv=insectes": -0.409, "nx=agrile": -0.409, "nx=dite": 0.401, "nx=lumineuses": -0.186, "pv=rouges": -0.612, "nx=cœur": -0.612, "tok=telomere": -0.179, "tok=fulminant": 0.306, "pv=l'or": 0.306, "pv2=potables": 0.306, "nx=dissous": 0.306, "tok=troupe": -0.177, "pv2=laquelle": -0.214, "pv2=retrouver": 1.095, "pv=traitat": 0.597, "tok=javelle": -0.174, "tok=benzine": 0.307, "pv=grasses": 0.307, "pv2=matieres": 0.307, "nx=sulfure": 0.307, "pv=mobilisations": 0.284, "nx=palestiniennes": 0.284, "tok=globe": 0.448, "pv=journalistes": 0.448, "nx=trotteuses": 0.448, "pv=esclaves": -0.483, "nx=notre": -0.488, "pv=neuropathiques": 0.276, "nx=ligamentaires": 0.276, "tok=inuit": -0.798, "pv=jouteuses": -0.798, "tok=bleu": 0.482, "pv=course": 0.482, "pv2=semi": 0.482, "tok=inclusive": 0.175, "pv=grammaire": 0.175, "tok=cousant": -0.736, "pv=dix": 0.219, "tok=camaieu": -0.765, "pv=venitiennes": -0.765, "pv2=draperies": -0.765, "tok=toiture": -0.232, "pv=equipages": -0.687, "pv=accoutrements": -0.546, "nx=stevie": -0.546, "tok=casser": 0.422, "nx=asseyez": -0.369, "pv2=compris": 0.602, "pv2=attendre": -0.234, "tok=alienant": 0.311, "pv=pere": 0.311, "pv=haut": 0.212, "tok=exportation": -0.87, "pv2=qu'avec": -0.197, "nx=hier": -0.176, "pv=d'innocents": 0.191, "pv2=millions": 0.191, "nx=grandeur": 0.191, "tok=mayonnaise": -0.385, "pv=bulots": -0.385, "tok=problematique": -0.667, "tok=franc": -0.344, "nx=finalistes": 0.166, "nx=confiantes": -0.353, "pv=glycogenolyses": -0.422, "nx=ornees": -1.197, "tok=anticiper": 1.18, "pv2=mieux": 1.166, "tok=droite": -1.612, "pv2=maire": -0.411, "pv=plaine": 0.279, "pv2=vaste": 0.279, "nx=capricieusement": 0.279, "pv=tonique": 0.376, "pv2=inconvenients": 0.376, "tok=sub": 0.448, "pv=compactes": 0.448, "pv2=calcaires": 0.448, "nx=lithographiques": 0.448, "tok=respecter": 0.36, "tok=engin": -0.466, "pv=premieres": -0.442, "tok=psychopathe": -0.257, "nx=megalomanes": -0.257, "pv=residuels": 0.505, "pv2=reactifs": 0.505, "tok=punch": -0.153, "tok=bio": 1.524, "nx=procedes": 1.524, "tok=pneu": -1.458, "pv2=boulons": -1.458, "nx=eclata": -1.458, "tok=zouker": -0.484, "tok=parisien": -0.505, "pv=congres": -0.505, "nx=maeline": -0.505, "pv2=assechent": -0.252, "pv=nonnes": 0.45, "nx=septembre": 0.518, "tok=clou": -0.187, "nx=colossales": -0.185, "tok=hisser": 1.447, "pv2=flamme": 1.447, "nx=d'acquisition": -0.308, "pv=volte": -0.983, "nx=prodigieuses": -0.983, "tok=baudremoine": -0.158, "pv2=fume": -0.158, "tok=caoutchouc": 0.549, "pv=chenilles": 0.549, "nx=faibles": -0.666, "pv=classe": 0.224, "pv=naks": -0.21, "tok=recouvrant": 1.087, "tok=possible": 0.263, "tok=malaria": 0.233, "pv=ancienne": 0.474, "tok=catholique": -0.163, "tok=citadin": -1.0, "pv2=postes": -0.956, "pv=keratotomies": -0.301, "tok=amazone": -0.187, "pv2=repartition": -0.187, "nx=preventives": -0.303, "tok=miniere": -0.667, "pv=d'exploitation": -0.667, "pv2=permis": -0.667, "nx=viennent": -0.667, "tok=utilisant": 0.384, "tok=visible": -0.705, "pv=pattes": -0.766, "nx=specialement": 0.557, "pv2=coiffeurs": -1.445, "nx=couteaux": -1.445, "pv=parisiennes": 0.549, "pv2=cuilleres": 0.549, "pv2=disaient": -0.358, "tok=refondre": 1.234, "pv2=fondre": 1.234, "nx=humains": -0.477, "pv=faces": 0.753, "tok=fabriquer": 1.164, "nx=inadaptes": -0.162, "tok=depolitiser": 1.22, "pv=cavites": 1.151, "pv=munitions": -0.779, "nx=operees": -0.779, "pv2=mener": 0.282, "tok=tranchant": 0.176, "tok=automobile": 0.604, "pv=coureur": -0.911, "nx=championne": 0.66, "tok=germanisation": -0.195, "pv2=animaliers": -1.581, "tok=communiquer": 0.426, "nx=s'etranglait": -1.788, "pv=finlandais": 0.302, "pv2=chercheurs": 0.302, "nx=aalto": 0.302, "tok=repousser": 0.437, "tok=cherte": 0.568, "pv=physiocrates": 0.568, "nx=foisonne": 0.568, "tok=automatique": -0.497, "pv=d'arrosage": -0.885, "pv2=gicleurs": -0.885, "nx=generales": -0.19, "tok=accueillant": -0.355, "pv=lieux": -0.355, "nx=scientifiques": 1.413, "pv=grosse": 0.445, "pv2=m'envoyer": -0.203, "tok=ferrant": 0.165, "pv=marechal": 0.165, "nx=exercaient": -0.232, "tok=solubilite": -0.425, "pv=superphosphates": -0.425, "nx=g": -0.425, "tok=barriere": -0.466, "pv=gestes": -1.022, "tok=ticket": 0.218, "tok=adopter": 0.332, "tok=inclure": -1.709, "tok=chlorhydrique": 0.45, "pv2=hydrates": 0.45, "pv=originales": 0.363, "nx=interessantes": 0.363, "tok=anatomie": 0.455, "pv=hippotomie": 0.455, "tok=moustique": -0.367, "pv2=sabots": 0.438, "pv2=viennent": 0.961, "tok=chromique": -0.42, "nx=chlorique": -0.42, "pv=douves": -0.632, "nx=disons": -0.408, "pv2=abat": -0.201, "pv=morceaux": -0.987, "tok=memoire": 0.759, "tok=subir": 1.388, "pv=bals": -0.336, "tok=deparasiter": 1.067, "nx=realiser": 1.067, "tok=solaire": -0.817, "pv=d'ambre": -0.817, "pv2=tubes": -0.817, "tok=symbolisant": 0.219, "nx=l'union": 0.219, "tok=longitudinalement": 0.628, "pv=pliees": 0.628, "pv=cracoviennes": 0.708, "nx=quoique": 0.708, "tok=tomate": -0.307, "tok=drole": 0.255, "nx=herisses": -0.238, "tok=musulmane": 0.456, "pv=confuceenne": 0.456, "pv2=hindoue": 0.456, "tok=prenant": 0.362, "nx=vendredi": 0.287, "pv=criminelles": -0.616, "pv2=statistiques": -0.616, "tok=zakat": -0.429, "pv=impots": -0.429, "pv2=car": -0.428, "pv2=demandes": 0.267, "nx=cessez": -0.198, "tok=volatil": -1.306, "pv=cher": -0.683, "nx=dedient": -0.727, "pv2=capotes": 0.275, "tok=rude": -1.575, "tok=expiat": 1.303, "pv2=qui": 1.199, "pv2=sommant": -0.156, "tok=immediate": 0.301, "pv=d'hypersensibilite": 0.301, "pv2=cutanes": 0.301, "tok=tortueuse": 0.249, "pv=flexible": 0.249, "pv2=souple": 0.249, "tok=chansonner": 0.309, "tok=vegetal": 0.162, "pv=compose": 0.162, "nx=vraiment": -0.29, "tok=exterieur": -0.219, "pv=tetons": 0.795, "tok=combler": 0.541, "tok=italien": -0.215, "nx=l'un": 0.679, "pv2=herisse": -0.201, "tok=solo": -0.357, "pv=danseurs": -0.918, "pv=collections": -0.312, "tok=tragique": -0.637, "tok=enormement": 0.422, "pv=d'oiseaux": 0.422, "pv2=guerir": -0.278, "pv=terrasses": -1.197, "nx=l'exquisite": -1.197, "tok=attitude": -0.157, "nx=surprotectrices": -0.157, "tok=familier": -0.224, "nx=videos": 0.544, "tok=cocaine": 0.327, "pv2=poisons": 0.327, "nx=morphine": 0.327, "pv=dates": -0.624, "pv2=quinze": -0.667, "tok=renouveler": 0.558, "tok=turc": 0.531, "nx=armenien": 0.531, "pv2=valeur": -0.233, "pv=gorgones": 0.726, "nx=ecrite": 0.726, "pv=agres": 0.823, "tok=populisme": 0.152, "pv2=souterrains": 0.152, "tok=resistant": -0.633, "pv=assemblages": -0.633, "pv=muscles": -1.214, "pv=mauvais": 0.275, "tok=dur": -0.621, "pv=triment": -0.621, "pv2=bougres": -0.621, "nx=d'ombre": 0.32, "tok=irrecevable": -0.428, "pv=demandeurs": -0.428, "nx=vibratoires": -0.23, "pv2=soupers": 0.317, "nx=bourgeois": 1.149, "pv=d'echanges": -0.909, "pv2=capacites": -0.909, "nx=incluent": -0.909, "pv2=angles": 0.403, "pv2=polyreactivite": 0.959, "nx=anticorps": 0.959, "pv2=carbone": -0.152, "nx=biogeniques": -0.152, "nx=nes": 1.329, "pv=nations": 0.568, "tok=epreuve": 0.555, "tok=primaire": -0.595, "pv=hyperparathyroidie": -0.689, "pv2=parathyroidiens": -0.689, "nx=entraine": -0.689, "tok=malin": -0.57, "pv=d'etre": -1.263, "pv2=m'admirent": -0.488, "tok=casier": -0.165, "pv=ministeres": -1.123, "tok=universel": -0.71, "pv=raisonne": -0.71, "pv2=dictionnaire": -0.71, "nx=d'histoire": -0.71, "pv=etudiants": -0.389, "tok=colonial": -0.272, "nx=attaques": 1.422, "pv=adrenalines": -0.215, "tok=epee": -0.493, "tok=nonante": 1.059, "nx=neuvieme": 1.059, "pv=angles": -0.571, "nx=ethnique": -0.571, "nx=funeraires": -0.515, "nx=match": 1.064, "nx=psychiques": -0.27, "nx=honte": 0.164, "tok=adaptant": 0.257, "nx=dues": -0.276, "tok=censee": -0.596, "nx=unifier": -0.596, "pv=peuples": 0.769, "nx=pratiques": -0.172, "tok=museliere": -0.558, "pv=cretins": -0.558, "pv2=villes": -0.659, "nx=d'interdire": 0.306, "nx=colocataires": 0.84, "tok=potentiel": -0.294, "nx=differents": -0.294, "pv2=proviennent": -0.163, "nx=examines": -0.163, "tok=scandale": -0.231, "tok=desorganiser": 0.588, "tok=forniquant": 0.793, "pv=forets": 0.318, "tok=sec": -0.708, "pv=d'orage": -0.708, "pv2=episodes": -0.708, "tok=geometrique": 0.185, "pv=decoupage": 0.185, "tok=amener": 0.345, "tok=liberer": 1.285, "pv=responsabilites": -0.552, "nx=educative": -0.552, "nx=vivants": -0.29, "tok=negative": 1.073, "pv=d'electricite": 0.331, "pv2=grains": 0.356, "tok=tartrique": -0.456, "pv=biacides": -0.456, "tok=recuperer": 0.538, "tok=stylo": -0.229, "pv2=remprunter": -0.229, "tok=jaune": 0.59, "pv2=cinquante": 0.607, "tok=redempteur": -0.25, "tok=ecolo": -0.199, "pv2=escarcelle": -0.199, "tok=bouse": -0.188, "pv2=fienter": -0.188, "nx=tombaient": -0.188, "tok=brevete": -0.395, "nx=ancien": -0.395, "pv=chaussures": -0.661, "tok=bilaterale": 0.38, "pv=l'incision": 0.38, "nx=africains": 0.367, "tok=filmant": -0.931, "tok=top": 0.782, "tok=professionnel": -0.225, "pv=roulent": 0.22, "pv2=cyclos": 0.22, "nx=d'agrandir": 0.211, "tok=pure": 0.904, "pv=certitudes": 0.904, "nx=precises": -0.33, "tok=biomasse": -0.69, "pv=production": -0.69, "tok=bœuf": -0.511, "pv=arrete": -0.511, "nx=bugranes": -0.511, "tok=observant": 1.178, "nx=logements": 0.203, "nx=tacticien": -1.571, "pv=parfait": -0.73, "nx=hors": -0.73, "tok=engageant": 0.379, "tok=envahir": 0.285, "pv=eurasiatiques": 0.285, "pv2=cromagnoides": 0.285, "nx=l'afrique": 0.285, "tok=capable": -0.441, "pv=grecs": -0.441, "nx=d'organiser": -0.441, "tok=neveu": -0.412, "pv2=treize": -0.412, "nx=d'endormissement": -0.195, "pv2=scission": -0.44, "pv=d'avril": -0.509, "tok=robuste": 0.688, "nx=tetu": 0.688, "tok=delivrer": 0.34, "nx=efficacement": 0.34, "pv2=dente": -0.478, "tok=derviche": -0.258, "pv=rouge": -0.56, "pv2=purulentes": 1.217, "tok=janseniste": 0.526, "pv=jardins": 0.578, "nx=convertie": 0.578, "pv=auxquelles": -0.685, "pv2=extremes": -0.685, "tok=acheter": 1.127, "pv2=vais": 1.127, "nx=costume": 0.781, "tok=gagner": 0.463, "pv=l'important": 0.774, "tok=autoentrepreneur": -0.434, "pv=dires": -0.434, "pv=lesions": -0.578, "pv=quel": 0.665, "pv2=queerlibs": 0.255, "nx=d'accu": -0.437, "pv=l'an": 0.52, "nx=d'alu": -0.215, "tok=bresilienne": 0.288, "pv=l'economie": 0.288, "pv2=camionneurs": 0.288, "tok=monophysite": 0.261, "pv=nestorienne": 0.261, "nx=grecque": 0.261, "tok=sedative": -0.625, "pv2=compresses": -0.625, "tok=maree": -0.21, "nx=dedicace": -0.21, "tok=approchant": 0.555, "pv=examens": 0.555, "pv=jaune": 0.4, "pv2=soleils": 0.4, "tok=initier": -0.332, "pv2=troisieme": -0.64, "nx=endossent": -0.64, "tok=labourage": 0.462, "pv=genre": 0.77, "pv2=mamelles": 0.462, "nx=voient": -1.443, "tok=flanc": -0.789, "tok=petrie": 0.462, "pv=hivers": 0.462, "nx=quelques": 1.377, "tok=parapet": -0.166, "pv2=pleuvent": -0.166, "nx=sautent": -0.166, "tok=pourboire": -0.577, "nx=ceinture": -0.577, "tok=mouture": -0.681, "pv=miserable": -0.681, "pv2=secs": -0.681, "pv2=reperes": 0.411, "nx=hallucinations": 0.411, "tok=flecher": 1.771, "tok=chat": -1.627, "tok=asthme": 0.295, "pv=bronchite": 0.295, "pv2=toux": 0.295, "nx=maux": 0.295, "tok=international": 0.253, "pv2=merengue": 0.253, "nx=tricolore": 0.253, "pv=genes": 0.783, "nx=metaboliseur": 0.783, "nx=lunettes": 1.299, "nx=soucieux": -0.294, "tok=naguere": -1.104, "pv2=jouets": -0.883, "pv2=rubans": 0.385, "nx=comte": 0.385, "pv2=aquariums": 0.405, "pv=femme": -1.154, "nx=seront": -1.159, "pv=presqu'iles": -0.316, "nx=quiberon": -0.316, "pv=etriers": 0.579, "tok=sylphide": -0.201, "pv2=joue": -0.201, "tok=administratif": -0.576, "pv=convoi": -0.576, "pv2=convois": -0.576, "tok=mondialement": 0.654, "pv=enormes": 0.336, "nx=sagement": 0.336, "nx=protestants": 1.095, "tok=passing": 1.467, "pv2=volees": 1.467, "nx=shots": 1.467, "tok=juste": -0.567, "pv=adieux": -0.567, "nx=ciel": -0.567, "tok=chomedu": -0.22, "nx=agites": -0.22, "tok=obstacle": -0.171, "tok=pecheur": -0.236, "pv2=condamner": -0.236, "tok=filet": -0.213, "tok=pagode": -0.312, "tok=multi": 0.305, "pv=nucleaires": 0.305, "pv2=piles": 0.305, "nx=usages": 0.305, "pv2=tickets": 0.408, "nx=chose": 0.852, "tok=lente": -0.64, "pv=allures": -0.64, "nx=pleurants": -1.454, "tok=payant": -0.34, "nx=mieux": 0.528, "pv=ski": 0.233, "nx=perissent": 0.185, "pv2=ecarte": -0.218, "pv2=fermenter": -0.229, "tok=eloigner": 0.505, "nx=rapidement": 0.505, "tok=squeezant": 0.584, "pv=l'epine": 0.418, "tok=ecologiste": -0.167, "pv2=conduira": -0.167, "nx=cet": -0.167, "tok=docilement": 0.823, "pv=calibres": 0.823, "pv=tatars": -0.722, "pv2=cantons": -0.722, "nx=convertis": -0.722, "tok=orteil": -0.157, "pv2=degeler": -0.157, "nx=chantants": 0.478, "tok=souffrir": 0.328, "pv=journaux": 0.833, "nx=candide": 0.833, "nx=brunies": -0.562, "pv=caricaturistes": 0.319, "tok=megaptere": -0.176, "tok=conferant": 0.613, "nx=l'infroissabilite": 0.613, "pv=tiers": 0.488, "pv=l'insuline": 0.359, "pv2=principales": 0.359, "tok=photographe": 0.355, "pv=graphiste": 0.305, "pv2=peintre": 0.305, "nx=sculpteurice": 0.305, "tok=bebete": -0.296, "pv2=truc": -0.296, "nx=effrayantes": -0.296, "pv=parois": 0.36, "nx=rigides": 0.36, "pv2=cela": -0.183, "tok=agenda": -0.157, "nx=minuscules": -0.157, "pv=projectiles": 0.747, "tok=steriliser": 1.042, "pv=existences": -0.253, "nx=contour": 0.873, "tok=oncle": -0.427, "tok=trier": -0.291, "pv2=urbain": -0.199, "tok=trainer": 1.053, "pv=nul": 0.368, "pv2=doubles": 0.368, "nx=d'aller": 0.368, "pv2=ajoutez": -0.175, "nx=ecrasees": -0.175, "tok=favorable": -0.767, "pv2=fortunes": -0.767, "tok=patre": -0.192, "nx=descendit": -0.192, "tok=educative": 0.277, "pv=sociale": 0.277, "pv2=responsabilites": 0.277, "tok=polyptere": -0.178, "pv2=puisque": -0.178, "nx=pourtant": -0.178, "pv2=remplacer": 1.43, "pv2=d'eradiquer": 0.214, "tok=antispeciste": -0.244, "pv2=viande": -0.244, "tok=ciblant": 0.296, "pv=informationnelles": 0.296, "pv2=offensives": 0.296, "nx=l'image": 0.296, "pv=speciaux": 0.163, "tok=escamoter": 0.935, "tok=quantite": 0.664, "pv=boulevards": 1.175, "nx=vaste": 1.175, "tok=specialisation": -0.263, "pv2=accentuer": -0.263, "tok=almohade": 0.368, "pv=almoravide": 0.368, "pv2=architectures": 0.368, "tok=malfaisante": 0.374, "pv=l'autorite": 0.374, "pv2=freres": 0.374, "nx=differente": 0.404, "tok=jardinier": -0.153, "tok=taxi": 1.142, "tok=amateur": -0.613, "nx=c'etait": -0.613, "tok=curieusement": 0.515, "nx=ralait": 0.157, "nx=dipole": 0.257, "tok=hypothetique": -1.431, "tok=plage": 0.308, "pv=adapte": 0.308, "pv2=bureau": 0.308, "nx=braille": 0.308, "tok=clivante": -0.656, "pv=strategie": -0.656, "pv2=adversaires": -0.656, "nx=reservee": 0.662, "tok=sbire": -0.16, "tok=abdo": -0.163, "pv2=bon": -0.163, "nx=d'acier": -0.163, "pv2=facheuses": -0.578, "nx=bourgeoises": -0.578, "tok=pria": 1.451, "nx=qualifies": -0.407, "pv=accidents": 0.255, "nx=delirants": 0.255, "tok=chopant": -1.356, "tok=spectre": -0.171, "pv2=conjointement": -0.171, "nx=qu'ont": -0.171, "tok=anterieur": -0.284, "pv=arcs": -0.284, "nx=impermeables": 0.205, "tok=hemoculture": -0.263, "nx=confirment": -0.263, "tok=buisson": -0.337, "tok=preserver": 1.11, "pv=audit": -0.978, "pv2=dus": -0.978, "tok=toucher": 0.934, "nx=s'appliquant": 0.934, "pv2=tout": -0.236, "tok=biologique": -0.761, "pv=d'alimentation": -0.761, "tok=antibrouillard": -0.534, "pv=feux": -0.534, "nx=arriere": -0.534, "pv2=michetonnes": -0.224, "tok=cet": 0.795, "pv=courses": 0.795, "tok=geline": -0.32, "pv=appellations": -0.32, "pv=plaintes": 0.732, "pv=immigres": 0.463, "nx=europeens": 0.463, "tok=explicative": 0.412, "pv=hypothese": 0.412, "tok=habitat": -0.192, "pv=l'hydrotimetre": 0.388, "pv2=photoelectriques": 0.388, "pv=fort": -0.631, "tok=chlorique": 0.263, "pv=chromique": 0.263, "pv2=acides": 0.678, "nx=borique": 0.263, "tok=jouissant": 0.576, "nx=bacheliers": 0.475, "tok=comparable": 0.373, "tok=reseau": -0.198, "tok=faiseur": -0.3, "nx=d'haubergeons": -0.3, "tok=magnetique": 0.277, "pv=d'activite": 0.277, "nx=intense": 0.277, "pv=besoins": -0.996, "pv=soins": -0.744, "pv=neutres": 0.797, "nx=reconnu": 0.797, "tok=indexer": 1.182, "pv2=puisse": 1.182, "tok=innombrable": -0.182, "pv2=bassesse": -0.182, "nx=crasses": -0.182, "tok=hegirien": 0.774, "pv=calendriers": 0.774, "tok=renforcer": 1.408, "pv2=reproduisent": 1.408, "nx=couterait": 1.408, "pv=carboxyliques": 0.162, "nx=solubles": 0.162, "tok=robot": -0.674, "pv=automate": -0.674, "pv2=creatures": -0.674, "nx=clone": -0.674, "tok=etamine": -0.292, "nx=entieres": -0.337, "tok=localite": -0.333, "nx=traversees": -0.244, "tok=trouvaille": 1.081, "pv=derniere": 0.33, "tok=reperer": 0.305, "pv=exercent": 0.712, "pv2=battu": -0.192, "tok=cantate": -1.43, "nx=gott": -1.43, "pv=anarchistes": -0.428, "nx=juniauds": -0.428, "tok=deballer": 0.531, "pv=racines": 0.895, "nx=odoriferantes": 0.895, "pv=clients": 0.288, "tok=inedit": -0.744, "pv=fiascos": -0.744, "tok=clubmen": -0.303, "tok=retrouver": 0.34, "nx=qu'une": 0.34, "tok=affaitement": 0.449, "pv=sociales": 0.449, "pv2=institutions": 0.449, "tok=former": 1.213, "nx=allaient": -0.165, "tok=fantaisie": -0.155, "pv=callosites": 0.372, "nx=hypothese": 0.372, "nx=migraine": 0.572, "tok=patient": -0.167, "tok=branlant": 0.356, "pv=wharf": 0.356, "tok=coton": -0.525, "pv=jupons": -0.525, "pv=eglises": 0.243, "nx=rupestres": 0.243, "pv=accroche": 0.59, "tok=extraire": -0.667, "pv2=halogenes": 0.299, "nx=v": 0.299, "nx=palliatifs": -0.219, "tok=metabolique": -0.669, "pv=ageotypes": -0.669, "nx=immunitaire": -0.669, "pv=larmes": -0.393, "tok=epave": -0.185, "pv2=recueillir": -0.185, "tok=celte": 0.37, "pv=ennemies": 0.37, "pv2=sectes": 0.386, "tok=filasse": -0.915, "nx=frisottants": -0.915, "pv2=sante": -0.324, "pv2=apprecie": -0.177, "nx=cultivees": -0.177, "tok=adulte": -0.38, "nx=font": -0.17, "pv=pare": 0.331, "pv2=pistes": 0.331, "pv2=retrecir": -0.189, "tok=arrosant": 0.35, "pv2=applications": 0.296, "nx=securisees": 0.296, "nx=mme": -0.535, "tok=passee": 0.568, "pv=l'alerte": 0.568, "pv2=pouvait": 0.894, "tok=paradisier": -0.19, "pv=conspirationnistes": 0.353, "nx=trump": 0.353, "tok=brosser": 1.384, "tok=gorgonzola": -0.22, "nx=debout": -0.729, "pv2=paniers": 0.33, "tok=revoir": 0.23, "tok=essayent": 0.289, "pv=dominantes": 0.289, "pv2=positions": 0.289, "tok=etendue": -0.693, "nx=d'euros": -0.154, "pv2=capturees": 0.172, "nx=clan": 0.172, "pv=fortunes": -0.242, "pv=second": 0.172, "pv2=tomber": -0.179, "nx=octogones": -0.179, "pv=mesure": 0.355, "pv2=hebreux": 0.355, "pv=comptable": 0.45, "pv2=d'expert": 0.45, "tok=detruire": 0.52, "pv2=inflammatoires": -0.797, "pv2=college": 1.244, "nx=protonotaires": 1.244, "tok=eviter": 1.505, "pv2=ne": 1.149, "pv2=d'ailleurs": -0.151, "nx=majeures": -0.151, "tok=vastitude": -0.303, "nx=salees": -0.303, "tok=dudit": -0.687, "pv=manants": -0.687, "pv2=sujets": -0.687, "nx=village": -0.687, "tok=surclasser": 1.464, "pv2=bretagne": 1.537, "pv2=promener": -0.298, "pv=criteres": -0.694, "nx=helas": 1.658, "pv=nucleations": -0.304, "pv=d'aout": -0.976, "pv2=creneaux": 0.171, "pv2=anthropometrique": 1.008, "nx=toxicodependantes": -0.274, "tok=designant": 0.52, "pv2=supporte": -0.203, "nx=sales": -0.171, "tok=hutte": -0.364, "tok=trappiste": -0.179, "pv=silence": 0.187, "nx=regnait": 0.187, "pv=arbres": -0.485, "nx=poussaient": -0.485, "tok=bousiller": -0.182, "pv=issirent": -0.412, "pv2=passereaux": -0.412, "pv=aucun": 0.287, "nx=reglementaire": 0.287, "tok=reguliere": -0.183, "nx=negociations": -0.183, "pv=couchant": -0.831, "pv2=rayons": -0.831, "tok=theorique": 0.199, "pv=violence": 0.199, "pv2=commencer": -0.217, "tok=follement": 0.362, "pv=s'agiterent": 0.362, "pv=mougous": -0.453, "pv2=denrees": 0.445, "pv=attachees": 0.176, "tok=toison": -0.23, "tok=deployer": -0.277, "tok=paner": -0.255, "tok=mental": 0.492, "pv=emotionnel": 0.492, "pv2=physique": 0.492, "tok=sauverent": 1.288, "tok=javellisation": 0.38, "pv=d'hygiene": 0.38, "nx=desinfection": 0.38, "tok=azuree": 0.21, "pv=d'amarante": 0.21, "tok=aeronef": -0.19, "nx=communiquaient": -0.19, "nx=echangistes": -0.275, "tok=parcourant": 0.6, "tok=instrumentaire": -0.679, "pv=d'officier": -0.679, "pv=ventricules": -0.609, "tok=mega": 1.443, "pv2=davis": 1.443, "nx=projets": 1.443, "tok=pequiste": 0.369, "pv=l'electoralisme": 0.369, "pv2=uzbek": -0.289, "nx=tribaux": -0.289, "tok=cartouche": -0.197, "pv2=trainant": -0.26, "tok=canonnier": -0.165, "pv2=flot": -0.165, "nx=donnaient": -0.165, "tok=meriter": 0.715, "tok=publier": 0.347, "pv2=grappes": 0.216, "tok=enchere": -0.751, "pv2=catalogue": -0.751, "tok=rangeant": 0.275, "pv=cerveaux": -0.658, "tok=artistiquement": 0.29, "pv=mazouteux": 0.29, "pv2=chiffons": 0.29, "nx=disposes": 0.29, "tok=polonaise": -0.376, "pv=revolutions": -0.376, "pv2=d'eau": 0.263, "pv2=l'oubli": -0.18, "nx=pres": -0.448, "tok=stable": -0.733, "pv=d'argent": -0.733, "pv2=apports": -0.733, "tok=eparpilla": -0.196, "pv2=vent": -0.196, "tok=partitif": 0.502, "pv=l'article": 0.502, "nx=pose": 0.502, "tok=dependu": -0.602, "pv=pendu": -0.602, "pv2=bicots": 0.56, "tok=anneau": 0.298, "pv=imperiaux": 0.298, "pv2=insignes": 0.298, "nx=epee": 0.298, "nx=disponibles": -0.88, "tok=baleinier": -0.696, "pv=categories": -0.696, "nx=barge": -0.696, "pv=lampons": 0.72, "nx=spirituels": 0.72, "tok=desagreable": 0.373, "pv=parodie": 0.373, "pv2=criardes": 0.373, "tok=promenade": -0.469, "tok=revetement": -0.163, "pv2=pose": -0.409, "pv=branches": -0.301, "tok=gothique": -0.295, "pv=univers": -0.295, "pv2=aigri": -0.16, "tok=decrire": 0.312, "tok=hypo": 0.717, "nx=thetiques": 0.717, "pv=ricaneurs": 0.302, "pv2=parisiens": 0.302, "tok=pendu": -0.795, "nx=dependu": -0.795, "tok=octaedre": -0.164, "pv2=constitue": -0.164, "nx=agit": -0.164, "pv=etages": -0.36, "pv=breviaire": -1.237, "nx=conserve": -1.237, "pv=designs": 0.186, "nx=futuristes": 0.186, "tok=legat": -0.176, "nx=reunissent": -0.176, "pv=nageoires": -0.616, "pv2=petites": -0.616, "nx=caudale": -0.616, "pv=bat": -0.511, "pv2=assujettissait": -0.174, "pv=malices": -0.57, "nx=spirituelles": -0.57, "tok=anemone": -0.551, "pv=fleuristes": -0.551, "pv2=reprenant": -0.178, "pv2=forestieres": 0.28, "tok=dosage": 0.163, "pv2=hiv": 0.163, "tok=defaire": -0.192, "tok=torpide": 0.483, "pv=d'evolution": 0.483, "pv2=brucelliens": 0.483, "tok=chauffer": 0.383, "pv2=complexite": -0.151, "nx=dentaires": -0.151, "pv=cote": 0.231, "pv2=asperges": 0.231, "nx=boulangers": -0.202, "pv=entraineurs": -0.359, "tok=turbo": -1.681, "tok=recevoir": 2.144, "nx=remplace": 0.886, "tok=chomeur": -1.516, "pv=tous": -1.516, "tok=errata": 1.751, "pv2=l'ensemble": 0.868, "pv=secs": 0.38, "pv2=pois": 0.357, "nx=mouture": 0.38, "pv2=disparaissait": -0.196, "pv=d'auguste": 0.797, "pv2=courtisans": 0.797, "pv2=souffrir": -0.154, "tok=lycopodine": -0.402, "pv=types": -0.402, "pv=lievre": 0.332, "nx=cameleon": 0.332, "tok=reveiller": 0.496, "tok=residuelle": -0.869, "pv=d'anhydrite": -0.869, "pv2=baguettes": -0.869, "nx=demeurent": -0.869, "tok=kanak": -0.462, "tok=balourdise": 0.332, "pv2=compositions": 0.332, "pv=yak": -0.697, "pv2=dimos": -0.697, "nx=affectueuses": -0.277, "pv=composites": -0.766, "pv=burgers": 0.377, "pv2=mini": 0.377, "nx=scottie": 0.377, "tok=autorisation": -0.197, "pv2=desenabler": -0.197, "tok=retirer": 0.359, "pv2=dedaignant": -0.296, "pv2=remarqua": -0.232, "tok=inattendu": -0.409, "pv2=teinte": -0.168, "pv=pluralistes": -0.656, "pv2=regimes": -0.656, "tok=imperial": -1.271, "pv=balaierons": 0.347, "nx=decedes": -0.334, "tok=insigne": -0.194, "pv2=remet": -0.193, "pv=avions": -0.674, "nx=desillusionnee": 0.164, "tok=rustre": -0.308, "tok=volant": -0.415, "pv2=renommer": -0.157, "nx=deputes": -0.157, "tok=cou": -1.381, "tok=baigneur": -0.471, "pv=mecs": -0.425, "nx=zen": -0.425, "pv=homopteres": -0.556, "nx=boys": 1.502, "tok=biologie": 0.308, "pv=genetiques": 0.308, "pv2=spores": 0.308, "nx=moleculaire": 0.308, "tok=boote": -0.43, "pv=u": -0.43, "nx=criminels": -0.43, "pv=m": -0.783, "tok=retro": 0.343, "pv=hepatiques": 0.343, "nx=apparait": 0.278, "tok=voler": -0.604, "nx=vingt": -0.604, "tok=tiede": -0.212, "nx=d'enroulement": -0.162, "nx=geants": -0.163, "tok=mardi": 1.435, "pv2=d'aboutir": 1.414, "pv=abords": 0.977, "tok=adar": 0.429, "tok=eleveur": -0.206, "tok=fortification": -0.775, "tok=allemand": -0.337, "pv=nationalismes": -0.337, "nx=belles": 0.544, "nx=reponse": 0.866, "pv2=messieurs": -0.167, "tok=surnommee": 0.574, "pv=oceanides": 0.574, "nx=æa": 0.574, "nx=fourches": -0.239, "pv=blesses": -0.703, "tok=devora": 0.787, "nx=maches": -0.207, "nx=camarades": -0.327, "tok=remarquerent": 0.734, "nx=qu'othon": 0.734, "pv2=montagnes": 0.451, "nx=rua": 0.165, "nx=inerte": -0.71, "tok=assise": -0.54, "pv=talons": -0.54, "pv2=sepultures": -0.517, "pv=fenetres": -0.542, "pv2=incluant": 0.155, "nx=ombres": 0.155, "pv2=claires": -1.466, "nx=tendu": -1.466, "tok=bonapartiste": -0.775, "pv2=gants": -0.775, "pv=saucissons": 0.517, "nx=porc": 0.517, "tok=plisseuse": 0.666, "pv=talents": 0.666, "nx=decoratrice": 0.666, "tok=controler": 0.331, "tok=samsarique": -0.7, "pv=l'ocean": -0.7, "pv2=phenomenes": -0.7, "tok=republicain": -0.306, "pv=ecole": 0.441, "tok=rencontrer": 0.517, "tok=reglementaire": 0.367, "pv=texte": 0.367, "pv=deambulations": 0.272, "nx=nocturnes": 0.272, "tok=hasard": -0.161, "tok=privilege": -0.156, "pv2=l'entretemps": -0.156, "tok=aimable": 0.954, "pv=employees": -0.518, "nx=grassette": -0.518, "pv=d'essangeage": -0.698, "pv2=seances": -0.698, "pv=mattak": -0.6, "pv2=entrailles": -0.6, "pv2=osages": 0.159, "tok=mono": 0.32, "pv=audio": 0.32, "pv2=signaux": 0.32, "tok=strophe": -0.24, "pv=trempes": 0.314, "pv2=carbures": 0.314, "nx=chatelard": 0.48, "pv2=lancent": 1.446, "pv2=couplets": 0.153, "pv2=l'opulence": -0.154, "nx=succeder": -0.154, "tok=techno": 1.516, "nx=optimistes": 1.516, "tok=entrepreneur": -0.277, "nx=dopes": -0.277, "tok=houspiller": 0.591, "tok=zoo": 0.626, "pv=transformations": 0.626, "nx=geographiques": 0.626, "tok=sterling": 0.393, "pv=livres": 0.393, "pv=hypothyroidies": -0.321, "tok=gouverner": 0.338, "tok=baton": -0.476, "tok=chapelet": -1.431, "pv2=macabres": -1.431, "pv=piges": 0.931, "pv=bateaux": -0.367, "nx=brusques": -0.174, "pv2=couvraient": -0.186, "nx=brillait": -0.18, "tok=tribunal": -1.573, "tok=biodegradable": -0.916, "pv=biosourcee": -0.916, "nx=chirimen": -0.581, "nx=qu'un": 0.341, "pv2=completement": -0.182, "tok=coucher": 0.71, "tok=craindre": -0.97, "tok=abstraite": -0.703, "pv=l'une": -0.703, "pv2=paralleles": -0.703, "pv=reguliers": -0.806, "tok=tricolore": 0.52, "pv=international": 0.52, "pv2=l'ancien": 0.52, "tok=desinfection": 0.497, "pv=javellisation": 0.497, "pv2=d'hygiene": 0.497, "nx=bleu": -0.891, "pv=consul": 0.245, "pv2=oncles": 0.245, "pv=deudeuches": 1.213, "tok=bizarre": -0.277, "nx=constructions": -0.277, "tok=caudale": -0.658, "pv=dorsale": -0.658, "pv2=nageoires": -0.329, "pv2=arrondit": -0.153, "pv=teintes": -0.582, "nx=accentuation": -0.582, "tok=decourager": 0.594, "tok=indiquer": 0.254, "pv2=protons": -0.242, "tok=convenable": 0.447, "pv=costume": 0.447, "pv2=seul": 0.231, "tok=barge": -0.734, "pv=baleinier": -0.734, "nx=bateau": -0.734, "nx=tremper": 0.17, "tok=champignon": -0.354, "tok=floraison": -0.26, "nx=changent": -0.26, "tok=prothese": 0.249, "pv=velotypie": 0.292, "pv2=francaise": 0.292, "nx=auditive": 0.292, "tok=sanglante": 0.212, "pv=guerre": 0.212, "tok=bougie": -0.185, "tok=permanent": 0.318, "pv=dipole": 0.318, "pv2=interactions": 0.318, "tok=ronde": 0.567, "pv=trepasses": 0.527, "pv=plages": -0.342, "nx=situee": -0.342, "tok=epistemologie": -0.544, "pv=savoirs": -0.544, "tok=grabon": -1.054, "pv2=eteinte": -0.166, "nx=infernales": -0.166, "tok=resolu": 0.33, "pv=h": 0.232, "tok=velaire": -0.272, "pv=n": -0.272, "tok=mature": -0.676, "pv=mures": -0.676, "nx=developed": -0.676, "pv=revenues": -0.672, "pv2=lames": -0.672, "tok=afro": 1.54, "pv=pernods": -0.445, "pv=zairois": 0.214, "pv2=fonctionnaires": 0.214, "nx=scrupuleux": 0.214, "tok=infectee": 0.219, "pv=poule": 0.219, "tok=farouchement": 0.301, "pv=coudes": 0.301, "pv2=jusqu'aux": 0.301, "nx=babines": -0.211, "pv=tabouret": 0.173, "pv=œufs": -0.249, "pv2=banaux": 0.398, "nx=bureau": 0.398, "nx=d'acolyte": -0.182, "pv2=quitter": -0.17, "tok=atmosphere": -0.688, "pv=biogeochimiques": -0.688, "pv2=reservoirs": -0.688, "nx=oceans": -0.688, "pv=modalites": 0.742, "pv=mages": -0.762, "pv2=faux": -0.762, "tok=probable": 0.243, "pv=danger": 0.243, "tok=negatif": 0.852, "pv2=socialistes": 0.421, "pv2=misere": -0.505, "tok=immunitaire": 0.3, "pv=metabolique": 0.3, "pv2=ageotypes": 0.3, "nx=hepatique": 0.3, "pv2=naissent": 0.294, "nx=torpeurs": 0.294, "tok=revelation": -0.151, "pv2=debout": -0.151, "nx=joints": -0.182, "tok=additionnant": -0.733, "tok=editer": 1.262, "tok=solemnite": -0.684, "pv=avecques": -0.684, "nx=tenant": -0.684, "tok=bic": -0.604, "pv=sac": -0.604, "nx=cahiers": -0.604, "pv=futals": -0.579, "tok=catimini": 1.509, "nx=quelle": 1.509, "pv2=semblable": -0.166, "pv=d'apport": -0.716, "nx=pav": -0.716, "tok=notifier": 1.129, "tok=chomage": -0.454, "pv=allocations": -0.454, "tok=tension": -0.665, "pv=halogenes": -0.665, "pv2=lampes": -0.665, "nx=reseau": -0.665, "tok=detourner": 0.386, "tok=politicard": -0.158, "tok=vaguement": 0.287, "pv=coniques": 0.287, "nx=entrevues": 0.287, "tok=analphabete": -0.165, "nx=actuels": -0.165, "pv=cameriers": -1.055, "pv=croques": -0.35, "pv=rosees": -0.536, "nx=lie": -0.536, "tok=detacher": 0.682, "tok=sympa": -0.445, "pv=prix": -0.445, "tok=logo": -1.633, "tok=eclore": 0.319, "pv=fait": 0.319, "pv2=lentes": 0.319, "tok=blanc": 0.342, "tok=relancerent": 0.634, "nx=l'assaut": 0.634, "tok=tennismen": -0.233, "tok=brume": -0.162, "pv=croque": -0.756, "nx=deviennent": -0.756, "nx=fiction": 1.6, "tok=resorcine": 0.471, "pv=orcine": 0.471, "pv2=polyphenols": 0.471, "tok=erotique": -0.153, "pv2=haleine": -0.153, "tok=arithmetique": -1.466, "pv=mediete": -1.466, "tok=ethnique": 0.392, "pv=geographique": 0.392, "nx=romantiques": -0.234, "tok=chevrotante": -1.179, "pv=voix": -1.179, "nx=entonnent": -1.179, "tok=descendue": -0.361, "pv=tumeurs": -0.361, "tok=hostilite": -0.198, "tok=resterent": 0.672, "pv=campagnols": 0.672, "nx=incredules": 0.672, "tok=resoudre": 0.337, "tok=emotionnel": 0.182, "pv=raisonnement": 0.182, "tok=plaindre": -0.254, "tok=americaine": -1.142, "pv=littorales": -0.51, "pv2=carcinologiques": -0.51, "pv=masquant": 0.308, "pv2=rapeux": 0.308, "pv2=soir": -0.278, "nx=m'ont": -0.168, "tok=venezuelien": -0.418, "pv=presidents": -0.418, "tok=entassant": 0.51, "pv=obseques": 1.048, "tok=productiviste": -0.338, "pv2=b": -0.219, "nx=fibres": -0.219, "nx=parler": 0.178, "pv=brevete": 0.268, "pv=mini": -1.162, "pv=medias": 0.668, "nx=nees": -0.177, "tok=grouper": 0.867, "pv=thes": -0.68, "tok=envisager": 0.829, "tok=cyanhydrique": 0.498, "pv=acide": 0.498, "pv2=hemotoxiques": 0.498, "nx=legers": -0.262, "tok=errante": 0.222, "tok=compositeur": -0.431, "tok=malotru": -0.168, "tok=accessible": -0.582, "pv=impressions": -0.582, "tok=dithyrambe": -0.159, "pv=vieil": 0.216, "nx=devina": 0.216, "pv2=d'algues": 0.62, "nx=finissant": 0.283, "pv2=horreur": 0.254, "nx=mesures": 0.254, "pv=ovimbundu": 1.12, "tok=drop": 1.133, "pv2=passant": 1.133, "nx=goals": 1.133, "pv=assurances": -0.419, "tok=exception": -0.152, "nx=d'incompetence": -0.152, "tok=supprimant": 0.324, "pv=adresses": -0.549, "tok=chevauchant": 0.458, "tok=conserver": 0.72, "tok=endormir": 0.666, "pv=d'escalier": -0.57, "nx=l'escalier": -0.57, "pv2=fosses": -1.648, "tok=interessant": 0.314, "pv=neuroendocriniens": 0.314, "pv2=synergiques": 0.314, "nx=occupation": -0.218, "pv=menaces": 0.79, "tok=latino": 0.454, "pv=pays": 1.278, "pv=suppletifs": -0.832, "nx=encadres": -0.832, "nx=taxes": -0.868, "pv2=l'instant": -0.173, "nx=canadiens": -0.173, "pv2=pourriture": -0.271, "tok=masculinite": -0.611, "pv=conjointement": -0.611, "pv2=interrogent": -0.611, "tok=arrogamment": 0.487, "pv=marcher": 0.487, "pv2=faisceaux": 0.487, "nx=gros": 1.77, "pv=l'historiographie": 0.365, "nx=contemporaine": 0.365, "nx=facilement": -0.361, "tok=securite": -0.399, "pv=doubles": -0.504, "nx=tonic": -0.504, "tok=portrait": -0.16, "pv=millionieme": 0.182, "tok=caler": 1.379, "tok=rosier": -0.192, "nx=festonnent": -0.192, "pv=fontaines": 0.483, "nx=roubles": 0.276, "tok=cervelle": -0.165, "pv2=ouvrir": -0.165, "tok=statistique": 0.53, "pv=l'etude": 0.53, "tok=chretienne": 0.345, "pv=l'apologetique": 0.345, "pv2=separement": -0.157, "tok=euh": 0.824, "tok=admettre": 0.374, "tok=directive": -0.204, "pv2=mechant": -0.204, "nx=transsirent": -0.25, "tok=envoyant": 0.378, "pv=bourreaux": -0.284, "tok=touristique": -0.505, "pv=complexes": -0.505, "tok=minimum": -0.667, "pv=pinces": -0.667, "pv=rideaux": -0.671, "pv=boutons": -0.463, "tok=orcine": 0.573, "pv=polyphenols": 0.573, "nx=resorcine": 0.573, "tok=rucher": -0.22, "pv2=diviser": -0.15, "nx=limitant": -0.15, "tok=sifilet": -1.465, "pv2=paradisiers": -1.465, "nx=s'attache": -1.465, "pv=zeus": -0.843, "pv=pleurnicheries": -0.271, "pv=douces": 0.198, "tok=passablement": 0.366, "nx=fat": 0.366, "nx=aveugles": 0.319, "tok=emission": -0.176, "pv2=traversaient": -0.176, "nx=sportives": -0.176, "nx=affrontaient": -0.173, "tok=blanchatre": -0.544, "pv=suivantes": -0.544, "pv=d'offres": 0.355, "pv2=appels": 0.355, "tok=genial": 0.188, "pv2=courges": 0.188, "tok=deception": -0.399, "pv=utilitaires": -0.551, "pv2=vehicules": -0.551, "tok=funebre": 0.517, "pv=l'instrument": 0.517, "pv2=besoigneuses": 0.517, "pv=arteriels": -0.553, "tok=bleuatre": 0.492, "pv=inerte": 0.492, "pv2=git": 0.492, "pv=piliers": 0.213, "nx=guetres": 0.585, "pv2=serums": 0.444, "pv=artisans": -0.161, "tok=clinique": 0.498, "pv=l'examen": 0.498, "pv=cananeens": 0.449, "tok=traduction": 0.439, "pv2=humains": 0.439, "nx=jouissent": -0.153, "pv=reformateurs": 0.559, "tok=capitonner": 0.663, "pv=convives": 0.722, "nx=contens": 0.722, "tok=aidant": 0.523, "pv2=resserrer": -0.195, "pv2=d'ivoire": -0.161, "tok=meurtrissant": -1.058, "nx=paleontologiques": -0.415, "tok=boucher": -0.6, "nx=charcutiers": -0.6, "tok=nickel": -0.712, "pv=chambres": -0.712, "tok=declasser": 0.988, "pv=d'echographie": 0.251, "pv2=appareils": 0.251, "tok=jachere": -0.159, "pv2=saisonniere": -0.159, "nx=florales": -0.159, "tok=tranquillite": 0.183, "pv=matieres": 0.613, "nx=actives": 0.613, "tok=titrant": 0.361, "pv=molles": 0.361, "pv=militaires": -0.533, "tok=putain": -0.294, "pv=crayons": -0.294, "nx=biper": 0.215, "nx=d'iriomote": -1.547, "pv=trotte": -0.343, "pv=laissaient": -1.685, "pv2=foutu": -0.157, "tok=diastase": 0.293, "pv=chimiques": 0.293, "pv2=substances": 0.293, "nx=zymase": 0.293, "tok=disponible": -0.17, "pv=valeurs": -0.17, "tok=ruinant": -0.194, "pv2=concurrents": -0.194, "pv=epaules": 0.757, "nx=barbe": 0.757, "tok=epousaille": -0.152, "pv2=liberatrices": -0.152, "nx=populaires": -0.152, "pv2=entendre": 1.263, "pv=stationnaires": -0.911, "tok=orienter": 1.151, "pv2=comment": 1.151, "tok=effaroucher": 0.345, "tok=mixeur": -0.156, "pv2=lise": -0.184, "pv2=savourait": -0.279, "tok=detruisit": 1.25, "tok=sportif": -0.533, "nx=nimois": -0.533, "nx=cathedrants": -0.655, "tok=regaler": 0.785, "pv2=bal": 0.785, "pv2=s'amorcer": -0.162, "nx=publiques": -0.162, "pv=hummocks": 0.979, "pv=concepts": 1.373, "tok=mouiller": 0.945, "nx=rebelles": -0.321, "tok=phare": -0.561, "pv=instruments": 0.377, "nx=rapides": 0.377, "tok=archaique": -0.397, "pv=periodes": -0.397, "pv=vibrantes": 0.33, "nx=murmurer": 0.33, "pv=foie": 0.298, "pv=gram": 0.431, "pv2=germes": 0.431, "tok=butyrique": 0.253, "pv=oleique": 0.253, "nx=margarique": 0.253, "tok=cachemire": 0.308, "pv2=lampassettes": 0.308, "nx=fines": 0.624, "nx=madrigalesques": -0.186, "pv2=metaphores": 0.173, "nx=folle": -0.205, "tok=championne": 0.529, "pv=automobile": 0.499, "pv2=coureur": 0.499, "pv=mi": 0.345, "nx=j'entame": 0.345, "pv=defi": 1.058, "pv=l'epoustouflante": 0.575, "tok=pousser": 0.818, "pv2=noix": 0.207, "pv=sciences": -0.632, "pv2=algues": -0.776, "pv2=merdasse": -0.485, "tok=intrinsequement": 0.294, "pv=monotheistes": 0.294, "pv2=religions": 0.294, "nx=intolerantes": 0.294, "tok=lard": 0.662, "pv=foies": 0.662, "pv2=d'aise": -0.152, "nx=plissees": -0.152, "tok=sarkozyste": -0.523, "nx=bernard": -0.523, "pv=tables": -0.614, "pv=hemotoxiques": 0.533, "nx=cyanhydrique": 0.533, "pv=oreillers": -0.522, "pv=intellectuelles": -0.589, "pv2=facultes": -0.589, "pv=quatrieme": 0.553, "nx=myriapodes": -0.341, "pv2=jouer": -0.172, "nx=interregionaux": -0.172, "pv=docteur": 0.178, "tok=indeniable": 0.17, "pv=fief": 0.17, "pv=decerebres": -0.725, "pv2=stylistes": -0.725, "nx=christian": -0.725, "pv2=l'appliquera": 1.117, "pv2=choisir": -0.163, "nx=biosolaires": -0.163, "tok=fla": 1.788, "tok=signer": 0.317, "tok=oriental": 0.85, "tok=capsien": 0.287, "pv=l'homme": 0.287, "nx=fera": 0.287, "tok=conjointement": 0.253, "pv=interrogent": 0.253, "nx=masculinite": 0.253, "pv=strings": -0.681, "nx=fendus": -0.681, "tok=radier": -0.318, "tok=excrement": -0.154, "pv2=considere": -0.154, "pv=permanent": 0.344, "pv2=dipole": 0.344, "nx=induit": 0.344, "tok=psychique": 0.426, "pv=d'excitation": 0.426, "nx=venu": -0.184, "tok=qualifier": 0.622, "pv=gants": -0.225, "tok=gobant": 0.344, "pv=prononces": -0.599, "pv2=incendiaires": -0.599, "pv=eurent": 0.499, "pv2=convives": 0.499, "tok=recoller": 0.375, "pv=sequences": 1.355, "tok=habilement": 0.299, "pv=chaude": 0.299, "nx=canalises": 0.299, "pv2=monegasques": 0.356, "nx=intelligent": 0.356}, "seuil": 0.9};
  var _PLT_NUM={};'deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize vingt trente quarante cinquante soixante cent cents mille plusieurs quelques'.split(' ').forEach(function(w){_PLT_NUM[w]=1;});
  var _PLT_DPL={};'les des ces ses mes tes nos vos leurs aux quelques plusieurs certains certaines'.split(' ').forEach(function(w){_PLT_DPL[w]=1;});
  var _PLT_DSG={};"le la un une ce cet cette mon ton son ma ta sa notre votre leur au du chaque tout toute l'".split(' ').forEach(function(w){_PLT_DSG[w]=1;});
  var _PLT_VPL={};'sont ont etaient seront furent vont font peuvent doivent'.split(' ').forEach(function(w){_PLT_VPL[w]=1;});
  function _taisCarte(T,i,M){
    function w(k){return (k>=0&&k<T.length)?deacc(T[k].toLowerCase()):'<>';}
    var f=['tok='+w(i),'pv='+w(i-1),'pv2='+w(i-2),'nx='+w(i+1)],k;
    if(i>=1&&(/^[0-9]+$/.test(T[i-1])||_PLT_NUM[w(i-1)]))f.push('pvNUM');
    if(i>=2&&(/^[0-9]+$/.test(T[i-2])||_PLT_NUM[w(i-2)]))f.push('pv2NUM');
    if(i<=1)f.push('debut');
    for(k=1;k<=2;k++){if(_PLT_DPL[w(i-k)])f.push('detPL');if(_PLT_DSG[w(i-k)])f.push('detSG');}
    if(_PLT_VPL[w(i+1)]||_PLT_VPL[w(i+2)])f.push('vbPL');
    var z=M.prior;for(k=0;k<f.length;k++){var v=M.lr[f[k]];if(v!==undefined)z+=v;}
    return 1/(1+Math.exp(-z))>M.seuil;}
  function plTaisCarte(T,i){return _taisCarte(T,i,PLURIEL_TAIS);}
  /* famille SV distillée (distill_vig.py) : seule des 3 candidates a passé les portes SÛR
     (justes générées held-out 614/614) ET UTILE (>=5 tues) ; genre et ou/où REFUSÉES chiffrées
     (rendement nul sur held-out). */
  var SV_TAIS={"prior": -3.347, "lr": {"tok=traversent": -0.305, "pv=en": 0.276, "pv2=l'autre": -0.241, "pv2=votre": -0.212, "tok=portent": -1.207, "pv2=du": -0.441, "nx=une": -1.422, "tok=refletent": -0.163, "tok=visitent": -0.206, "pv=premiere": -0.165, "pv2=cette": -1.914, "tok=lachent": -0.289, "pv=assez": -0.151, "pv2=policiere": -0.151, "nx=du": 0.527, "tok=celebrent": -1.402, "pv2=homme": -0.233, "nx=est": -0.907, "pv=ne": -0.741, "nx=de": -0.898, "tok=disposent": -0.708, "pv2=le": 0.476, "tok=designent": -0.784, "nx=en": -0.866, "tok=occupent": -0.383, "nx=la": -0.419, "tok=troublent": -0.212, "tok=critiquent": -0.339, "pv=reflexion": -0.211, "pv2=de": 0.249, "nx=elle": 0.569, "tok=gravent": -1.032, "nx=a": -0.2, "tok=contrent": -2.02, "tok=emergent": 0.82, "pv=blainville": -0.186, "tok=sombrent": -0.731, "nx=qui": -0.157, "tok=consistent": -1.626, "pv=principe": -0.154, "tok=quittent": -0.426, "tok=peut": -0.296, "pv2=des": 0.179, "detPL": -0.181, "tok=donnent": -1.435, "pv2=la": 0.167, "tok=bernent": -0.215, "pv2=confiance": -0.215, "nx=rien": 1.255, "tok=offrent": -0.652, "pv2=les": -0.617, "nx=encore": -0.77, "tok=comportent": -0.781, "tok=developpe": -0.152, "nx=son": -1.212, "tok=indique": -0.261, "tok=ajoute": -0.269, "pv=y": -1.028, "nx=des": 0.616, "pv=se": -1.155, "nx=dans": -0.552, "tok=passent": -1.311, "tok=entrent": -2.971, "tok=concernent": -0.283, "nx=essentiellement": -0.284, "tok=changent": -0.318, "tok=manifestent": -0.19, "pv2=ne": 0.427, "nx=que": -0.462, "tok=trouvent": 0.276, "tok=liguent": -0.344, "pv2=victoire": -0.174, "tok=veillent": -0.408, "pv=l'avant": 0.257, "tok=voisinent": -0.255, "pv=plus": 0.401, "tok=nomment": -0.203, "tok=avait": 0.672, "pv=rebelles": 0.994, "nx=ete": 1.65, "tok=indifferent": 2.85, "pv=homme": 0.535, "tok=trouve": -0.266, "tok=augmentent": -0.382, "pv=vent": -0.428, "tok=poussent": -0.418, "tok=couvrent": -0.315, "pv=maison": -0.353, "tok=sont": 5.452, "pv2=structure": 0.433, "tok=determinent": -0.331, "pv=point": -0.237, "nx=l'horizontalite": -0.184, "tok=puissent": -0.767, "pv2=l'homme": -0.172, "tok=possede": -0.473, "nx=cinq": -0.203, "nx=avec": -0.494, "tok=transforment": -0.186, "nx=certaines": -0.304, "tok=figurent": -0.473, "nx=les": -0.473, "nx=un": -1.039, "nx=sur": -0.615, "tok=chosent": -0.434, "pv=grand": -0.713, "pv2=pas": 1.203, "nx=mais": -0.354, "tok=monnaient": -0.323, "pv=porte": -0.323, "pv2=mon": -0.379, "tok=eprouve": -0.279, "tok=pilotent": -0.306, "pv=l'onde": -0.182, "tok=existent": -0.674, "tok=representent": -0.9, "pv=nationale": -0.31, "pv=vie": -0.333, "tok=ont": 3.899, "pv=primaire": -0.673, "pv2=production": -0.695, "nx=double": -0.621, "pv=cerfeuil": 0.624, "nx=leurs": 0.222, "tok=repose": -0.299, "tok=causent": -0.355, "pv=d'ou": 3.362, "pv2=faible": 0.642, "nx=l'eparpillement": 0.733, "pv=lutte": -0.164, "pv=peinture": -0.165, "nx=et": 0.87, "tok=presentent": -0.228, "pv2=ce": -0.645, "tok=frappent": -0.163, "tok=lissent": -0.516, "tok=laissent": -0.794, "tok=commence": -0.708, "pv=travaux": -0.286, "pv=autre": -0.331, "pv2=une": -0.578, "nx=ce": -0.774, "pv=realite": -0.183, "tok=dominent": -0.152, "pv2=voix": -0.487, "tok=indiquent": -0.492, "pv=famille": 0.887, "pv2=notre": -0.165, "tok=pourrait": -0.227, "tok=modifie": -0.168, "pv=entreprises": -0.586, "pv2=certaines": -0.314, "nx=leur": 0.726, "tok=represente": -0.94, "tok=chambrent": -0.281, "tok=pretent": -0.621, "nx=aussi": 0.576, "tok=livrent": -0.579, "tok=lance": 1.108, "pv=systemes": 1.108, "nx=roquettes": 1.108, "nx=notamment": -0.377, "tok=impliquent": -0.373, "nx=t": -0.345, "nx=comme": -0.726, "pv=sol": -0.502, "nx=sous": 0.267, "pv2=deux": 1.507, "pv2NUM": -0.305, "pv=peche": 0.29, "nx=bivalves": 0.315, "pv=machine": -0.157, "nx=egalement": 0.402, "pv=jour": 1.356, "tok=signent": -0.565, "tok=renvoient": -0.387, "tok=restent": -1.396, "nx=tres": -1.2, "tok=liberent": -0.164, "tok=souffrent": 1.133, "pv=neurofeedback": 1.394, "tok=produit": 1.154, "pv=e": 0.599, "nx=<>": 2.915, "tok=coulent": -0.248, "pv=chaleur": -0.17, "tok=presente": -0.928, "pv=nez": 0.298, "pv=science": -0.191, "tok=est": 3.566, "pv=serre": 1.0, "nx=preconisee": 1.0, "nx=cette": -0.586, "tok=reunissent": 1.564, "pv2=desquels": 1.499, "tok=surveillent": -0.152, "pv2=<>": -1.088, "nx=par": -1.376, "debut": -1.088, "tok=apporte": 0.719, "nx=donc": -0.728, "tok=possedent": -1.076, "nx=plus": -1.564, "tok=devenait": -0.157, "pv=gravures": -0.157, "nx=surtout": -0.253, "nx=pendant": -0.168, "tok=continue": -0.392, "tok=signalent": -0.276, "tok=masquent": 0.87, "pv=d'un": 2.545, "pv2=calcul": -0.663, "pv=d'une": 0.675, "tok=modelent": -0.746, "pv2=vitesse": -0.548, "nx=pour": 0.676, "tok=depassent": -0.52, "tok=forment": -1.207, "pv=plate": -0.284, "tok=voyage": 0.882, "pv2=l'illusion": 0.882, "tok=occupe": -0.241, "tok=vienne": -0.53, "pv2=haitienne": 1.06, "tok=constituent": -0.931, "pv=vignes": 0.911, "tok=rencontrent": -0.547, "tok=remontent": 0.944, "pv=sante": 1.597, "tok=souhaitent": -0.383, "pv2=l'etat": -0.151, "tok=reposent": -0.626, "tok=demande": -0.479, "tok=semblent": -0.828, "nx=etre": 1.476, "tok=ressemblait": 1.109, "pv=ca": 2.204, "pv2=fois": 0.96, "tok=doublent": -0.308, "pv=corporelles": -0.172, "pv=te": -0.35, "pv2=patron": -0.192, "tok=occasionnent": -0.268, "pv=habitants": -0.999, "tok=frequentent": -0.414, "tok=analysent": -0.42, "pv2=l'objet": -0.736, "tok=comptent": -1.133, "pv=personnes": 0.264, "tok=groupent": -0.573, "pv2=pres": -0.36, "tok=semble": -0.731, "tok=controle": 0.565, "pv2=partisans": 0.715, "pv=voix": -0.212, "pv2=en": 0.502, "nx=celle": -0.169, "tok=limitent": -0.293, "tok=amenent": -0.231, "pv=difference": -0.185, "pv2=peu": 1.071, "tok=arrive": 0.513, "tok=secretent": -0.245, "tok=apportent": -0.42, "pv=route": 0.531, "nx=toute": -0.223, "nx=toujours": -0.574, "tok=exercent": -0.41, "pv=soude": -0.169, "tok=penetrent": -0.36, "tok=arrivent": -0.807, "tok=font": 0.879, "pv=massage": 0.812, "pv2=chaque": 1.42, "pv2=navire": -0.228, "nx=actuellement": -0.244, "pv=monde": -0.575, "nx=ou": 0.596, "pv=litterature": 0.62, "nx=elles": 0.51, "tok=internent": -0.637, "pv=medecine": -0.24, "nx=josh": -0.21, "tok=grisent": -0.598, "tok=classent": -0.253, "tok=puisse": -0.393, "tok=cassent": -0.517, "tok=venaient": 1.453, "pv=l'ane": 1.453, "pv2=derriere": 1.453, "pv2=quelques": -0.758, "tok=montrent": -0.166, "pv2=mere": -0.22, "tok=partagent": 1.044, "tok=necessite": -0.263, "pv=biofiltres": -0.19, "tok=tentent": -0.481, "tok=composent": -0.403, "tok=ballent": -0.2, "nx=entre": -0.344, "tok=statuent": -0.218, "pv2=changee": -0.218, "pv=territoires": 0.368, "pv2=leurs": 1.408, "nx=bien": 0.627, "pv2=que": -1.05, "pv=femmes": -0.206, "nx=etait": -0.212, "tok=liquident": -0.474, "nx=alors": -0.976, "tok=resultent": -0.169, "tok=decide": -0.377, "pv=messieurs": -0.183, "pv=l'air": -0.358, "tok=completent": -0.342, "tok=pincent": -0.244, "pv2=espagnol": -0.163, "tok=rappelle": -0.189, "pv2=grande": -0.23, "tok=retrouve": -0.261, "tok=precisent": -0.287, "tok=doivent": 1.387, "pv2=priere": -0.61, "tok=accorde": -0.221, "pv2=principale": 0.626, "tok=etait": 2.876, "pv=flamines": 0.625, "nx=designe": 0.625, "tok=croient": 1.128, "pv=hommes": 1.502, "nx=avoir": 0.412, "pv=petit": -0.345, "pv2=d'un": 1.316, "tok=existe": -0.713, "pv=contactologiques": -0.301, "pv2=solutions": -0.301, "vbPL": 1.816, "pv=temoins": -0.151, "pv2=par": -0.234, "tok=complexent": -0.711, "tok=pratiquent": -0.545, "pv2=bonne": -0.154, "tok=cuitent": -0.155, "pv=terre": -0.155, "pv2=rappeneau": -0.819, "tok=rappellent": -0.472, "tok=flottent": -0.231, "tok=menacent": -0.239, "tok=persistent": -0.204, "pv=temps": 0.646, "pv2=gros": -0.179, "nx=apres": -0.381, "nx=diverses": -0.191, "tok=moyennent": -0.684, "nx=annuelle": -0.218, "tok=soit": -0.268, "pv2=qui": 0.538, "tok=exigent": -0.555, "nx=beaucoup": -0.664, "tok=fit": -0.238, "pv=nature": -0.395, "pv=autorites": -0.248, "nx=toutefois": 0.527, "tok=remonte": -0.399, "tok=cherchent": -0.29, "tok=partent": 1.841, "pv=main": 1.04, "nx=ensemble": 1.135, "tok=a": 1.713, "pv=options": 1.202, "tok=expedient": 1.448, "nx=c'est": 0.998, "tok=vaut": 1.105, "pv=public": -0.166, "tok=revelent": -0.256, "tok=separent": -0.164, "tok=marchent": -0.556, "tok=faisaient": 2.157, "pv=sort": 1.571, "nx=grand": 1.595, "tok=demeurent": -0.89, "nx=eux": -0.302, "pv=s'y": -0.435, "nx=guere": -0.179, "tok=enseignent": -0.202, "pv2=nature": 0.669, "tok=expliquent": -0.212, "pv=terme": -0.167, "pv2=terme": -0.151, "tok=aurait": -0.208, "pv=operations": -0.208, "pv2=quatre": -0.306, "tok=postent": -0.451, "tok=defilaient": 2.506, "pv=l'autre": 0.662, "pv2=apres": 1.184, "nx=plusieurs": -0.391, "tok=ressemble": -0.544, "pv2=certains": -0.725, "tok=distinguent": -0.164, "tok=declarent": -0.227, "tok=sechent": -0.433, "pv2=non": -0.189, "tok=ressemblent": -0.677, "pv=eaux": 1.339, "tok=envoient": -0.403, "pv=forte": -0.155, "pv2=plus": 0.402, "tok=exposent": -0.213, "pv=grosse": -0.249, "tok=organisent": -0.511, "pv=diable": -0.153, "pv=memes": 0.23, "pv2=pratique": 0.205, "tok=prosperent": 0.904, "pv=tres": -0.512, "pv2=industrie": -0.399, "pv=l'homme": 0.483, "tok=participent": 1.463, "pv=classe": -0.181, "tok=situent": -0.188, "tok=marient": -0.583, "tok=realisent": -0.154, "tok=distingue": -0.194, "pv=pays": -0.21, "tok=planent": -0.345, "pv2=gens": -0.235, "nx=lui": -0.444, "tok=transportent": -0.197, "pv=foi": -0.182, "pv2=officier": -0.151, "pv=dogecoin": -0.576, "pv2=pieces": -0.63, "nx=d'utiliser": -0.576, "pv=auteurs": -0.255, "pv2=derniers": -0.171, "tok=signifie": -0.365, "pv=bonsais": -0.17, "tok=compliquent": -0.163, "nx=certains": 0.812, "pv2=saint": -0.295, "nx=sa": 0.251, "tok=risque": 1.224, "pv2=raison": 1.572, "pv=grande": 1.462, "pv=parades": -0.542, "tok=affectent": -0.309, "pv2=cet": -0.667, "nx=d'une": -0.362, "pv=comptable": -0.285, "tok=louvoie": -0.265, "pv=gens": -0.303, "pv=membrane": -0.156, "tok=affairent": -0.176, "tok=parent": 1.455, "tok=cherche": -0.332, "pv2=ses": -0.861, "nx=quelques": -0.334, "tok=fonctionnent": 0.41, "pv=inalienable": -0.206, "pv2=frontiere": -0.206, "tok=peuplent": -0.244, "tok=permet": -0.461, "tok=tournent": -0.503, "tok=provoquera": -0.2, "pv=pastorales": -0.2, "pv2=activites": -0.2, "nx=l'enfrichement": -0.2, "nx=deux": -0.697, "tok=cranent": -0.178, "tok=sanctionnent": -0.177, "pv=roi": -0.177, "tok=remplient": -0.276, "pv=lemoine": 0.706, "pv2=cardinal": 0.706, "tok=gagnent": -0.348, "tok=parlent": -0.711, "pv=l'eau": 0.608, "pv2=comme": -0.928, "tok=normalise": -0.342, "pv=figuier": 0.88, "tok=regroupent": -0.281, "tok=developpent": -0.394, "pv2=mot": -0.223, "nx=devant": -0.329, "tok=revele": -0.198, "tok=liront": 1.515, "pv=plume": 1.515, "tok=pousse": -0.222, "tok=prenne": -0.707, "pv=vegetaux": -0.224, "tok=boitent": -0.286, "tok=herse": 1.273, "pv=appele": 1.273, "pv2=grattoir": 1.273, "nx=ouest": 0.673, "tok=arbore": -0.234, "tok=planchent": -0.165, "pv=l'autel": -0.849, "pv2=communaute": 0.246, "nx=aujourd'hui": -0.352, "tok=appellent": -0.17, "nx=deja": -0.224, "tok=chargent": -0.481, "pv=particuliers": -0.188, "pv2=appartements": -0.515, "pv=taureau": 0.579, "pv=banlieue": -0.674, "nx=s'abattent": -0.616, "tok=induisent": 1.166, "pv=createur": 1.166, "tok=provoquent": -0.517, "pv=confusion": 1.375, "nx=tout": 0.69, "tok=court": 1.431, "pv=tout": 1.16, "pv2=arretent": 1.431, "tok=peuvent": 3.21, "pv=houle": 1.244, "pv2=nom": -0.196, "pv=lois": -0.233, "tok=fassent": -0.339, "nx=ca": -0.243, "tok=constitue": -0.416, "pv=soleil": -0.218, "tok=sanglotent": -0.205, "pv=courant": -0.171, "tok=demandent": -0.36, "tok=affirment": -0.185, "pv=lexemes": -0.174, "tok=garde": 2.334, "pv2=mises": 0.942, "pv=avant": -0.199, "tok=etudient": -0.23, "tok=pistent": -0.278, "nx=d'athletisme": -0.191, "tok=bouchent": -0.611, "pv2=point": -0.451, "nx=trou": -0.323, "pv=militaire": -0.18, "tok=signifient": -0.498, "tok=marbrent": -0.156, "pv=chasseur": -0.156, "pv2=gloire": -0.182, "nx=represente": -0.182, "pv2=sans": -0.396, "nx=jamais": -0.286, "nx=trop": -0.443, "tok=doutent": -0.332, "nx=scientifique": -0.332, "tok=passe": 1.179, "pv=maitres": 1.179, "nx=fins": 1.179, "pv=petite": -0.346, "tok=confirment": -0.378, "pv=menu": -0.246, "pv=halloween": 0.256, "nx=parfois": 0.18, "pv=cours": 1.347, "pv2=peuple": -0.256, "pv=president": -0.151, "tok=touchent": -0.621, "tok=inversent": -0.471, "pv=sens": -0.256, "tok=plantent": -0.326, "pv=taille": -0.34, "pv2=famille": -0.389, "tok=presse": 1.993, "pv=tabacs": 2.169, "tok=fait": 2.713, "pv2=plaisants": -0.185, "tok=vaguent": -0.338, "pv=peu": -0.245, "pv=jours": 0.539, "tok=aiguillent": -0.273, "nx=ces": -0.163, "nx=vers": -0.574, "tok=frequente": -0.324, "pv=grele": 0.168, "tok=titrent": -0.461, "pv2=monde": -0.404, "tok=terrent": -0.236, "pv=vieille": -0.179, "pv=l'olympe": 0.506, "nx=poetise": 0.506, "tok=predominent": -0.302, "pv=l'enthousiasme": -0.154, "pv2=mentale": -0.154, "tok=desirent": -0.471, "pv=remplacement": -0.343, "pv2=grand": -0.272, "pv2=ma": -0.42, "tok=plastiquent": -0.586, "pv=matiere": -0.214, "tok=debite": -0.16, "pv2=tres": -0.255, "tok=multiplie": -0.184, "nx=mille": 1.18, "tok=utilise": -0.673, "pv=sprev": -0.238, "pv2=guides": -0.238, "nx=accueilli": -0.238, "tok=envoie": -0.185, "nx=trois": -0.341, "tok=pourront": 0.821, "pv=mediatique": -0.304, "pv2=couverture": -0.304, "pv=plaines": -0.269, "pv=l'empire": -0.951, "pv2=l'empereur": -0.951, "nx=requis": -0.951, "pv=morgue": -0.443, "tok=peinent": -0.178, "tok=meritent": -0.423, "pv=bois": -1.356, "pv=couleur": -0.247, "tok=assure": -0.192, "nx=qu'il": -0.663, "tok=travaille": -0.204, "pv2=plusieurs": -0.231, "pv2=hommes": 0.621, "nx=je": -0.332, "nx=tous": -0.36, "tok=entrainent": -0.514, "tok=modifient": -0.28, "nx=assez": 0.83, "pv2=meme": 0.159, "tok=marinent": -0.415, "pv2=enfants": -0.18, "tok=different": -0.254, "pv=femme": 0.5, "tok=consiste": 0.618, "tok=utilisent": -0.171, "tok=marquent": -0.552, "nx=parmi": -0.262, "tok=touche": 1.17, "pv=d'interet": 1.123, "pv2=taux": 1.262, "nx=permis": -0.883, "pv=l'auteur": -0.172, "tok=beneficient": -0.182, "tok=differe": -0.38, "tok=etage": 0.949, "pv2=matraque": 0.949, "pv2=l'argent": -0.209, "pv=pratiques": -0.667, "pv=captifs": 0.488, "pv2=ennemis": 0.488, "nx=appele": 0.488, "tok=risquent": -0.396, "pv=filtre": 1.086, "nx=d'integrer": -0.162, "tok=mouche": 1.408, "pv=attrape": 1.408, "pv=cyclamen": 0.257, "tok=recolte": -0.156, "pv=agriculteurs": -0.156, "tok=continuent": -0.675, "tok=remplacent": -0.157, "tok=designe": -0.156, "tok=disparaisse": -0.227, "tok=imposent": -0.176, "pv2=travail": -0.182, "tok=mesurent": -0.3, "pv2=dans": 1.168, "pv=tete": -0.296, "pv=societe": -0.171, "pv=couronne": 0.333, "nx=neutriflores": 0.333, "pv=biogaz": -0.817, "tok=escortent": -0.185, "pv=police": -0.278, "pv=ans": -0.18, "nx=plutot": -0.155, "pv=jeunes": -0.227, "tok=proposent": -0.768, "nx=justement": -0.174, "nx=avant": 0.195, "nx=selon": -0.209, "pv=produits": -0.217, "pv2=bons": -0.155, "tok=laboure": -0.233, "pv=closiers": -0.233, "tok=greve": 2.219, "nx=vite": -0.202, "tok=entre": 2.758, "pv=enfants": 0.715, "tok=conserve": -0.572, "pv2=raviolis": -0.507, "tok=insurgent": 1.023, "pv=ver": 1.023, "nx=qu'une": 1.023, "pv=l'industrie": 1.513, "pv2=arts": 1.513, "pv=voisin": 0.261, "pv2=pays": 0.182, "nx=comptabilises": 0.261, "pv=mort": -0.151, "pv=l'horizon": 1.216, "pv2=samedi": -0.212, "pv2=troupeaux": -0.153, "pv=textes": -0.281, "pv2=mes": 0.256, "pv=hierarque": 0.29, "tok=racontent": -0.165, "tok=placent": -0.863, "pv2=mise": -0.403, "pv2=tete": -0.241, "pv=hausse": -0.322, "pv=occasions": -0.666, "tok=retirent": -0.22, "pv2=principe": -0.409, "pv2=travaux": 1.034, "nx=ainsi": 0.679, "tok=connaisse": -0.556, "pv=siliceuses": -0.306, "pv2=landes": -0.306, "tok=grise": 3.151, "pv=flanelle": 1.295, "tok=positivent": -0.171, "tok=force": 1.51, "nx=non": 1.298, "tok=affute": -0.249, "pv=artisans": -0.249, "pv=sites": 0.773, "pv=fleurs": 0.553, "tok=strident": 1.302, "pv=cri": 1.302, "nx=debagoulant": -0.263, "tok=retrouvent": -0.229, "nx=principalement": -0.216, "pv2=cuisson": 0.974, "nx=conserver": 0.974, "tok=viennent": 3.279, "pv2=mer": 1.227, "pv=puits": -0.153, "tok=annonce": -0.263, "pv2=autre": 0.471, "tok=attirent": -0.26, "pv=mots": -0.569, "nx=peu": 0.183, "nx=point": -0.161, "tok=ressuscitent": -0.179, "pv=pendu": -0.179, "tok=regardent": -0.339, "tok=bronchent": -0.154, "pv=chene": -0.154, "pv2=vie": -0.315, "tok=relevent": -0.259, "tok=lignent": -0.449, "nx=soit": -0.207, "tok=cristallisent": -0.177, "pv2=derniere": -0.176, "tok=valent": 1.426, "pv=chirurgien": -0.202, "nx=ensuite": -0.334, "pv=jeu": -0.198, "tok=dresse": -0.152, "tok=equilibrent": -0.239, "pv=rapport": -0.176, "tok=contribuent": -0.213, "nx=ne": 0.784, "pv=harmoniciens": -0.6, "nx=l'octave": -0.6, "nx=gele": 0.954, "nx=dix": -0.209, "nx=ils": -0.465, "tok=offre": -0.252, "nx=materialisee": 0.316, "tok=soulignent": -0.21, "tok=avivent": -0.193, "pv=rouge": 1.066, "tok=deploient": -0.152, "tok=brisent": -0.198, "pv=aisselles": -0.417, "tok=coupent": -0.228, "pv2=jolie": -0.156, "tok=figure": 1.05, "tok=bouche": 1.487, "pv=amuse": 1.334, "nx=maintenant": -0.19, "pv2=gestion": -0.208, "pv=coefficients": 0.279, "nx=definis": 0.279, "pv=trop": -0.279, "tok=vont": 1.494, "pv=n'y": -0.387, "pv=insectivores": 0.402, "pv2=oiseaux": 1.204, "nx=indiscutable": 0.402, "nx=situe": -0.323, "pv=locuteurs": 0.295, "tok=doit": 0.409, "pv=appareils": -0.472, "tok=quitte": -0.152, "pv=britannique": 0.25, "pv2=colombie": 0.25, "nx=reels": 0.25, "tok=elevent": -0.378, "pv2=pere": -0.378, "nx=qu'elle": -0.378, "pv=naturelle": 2.265, "pv2=maniere": 1.229, "pv2=nouvelle": -0.177, "pv=ciel": -0.219, "pv=territoriaux": -0.895, "pv2=projets": -0.895, "nx=vu": -0.895, "tok=dominait": -0.272, "pv=ruminaient": -0.272, "tok=activent": -0.196, "pv=ville": -0.274, "pv2=centre": -0.184, "pv=chevelures": 1.071, "pv=murs": -0.579, "nx=raye": -0.164, "tok=invitent": -0.442, "pv2=jean": -0.152, "pv=capital": -0.223, "nx=jouent": -0.223, "tok=roulent": -0.151, "pv=raison": 0.98, "pv=clones": 0.728, "nx=s'auto": 0.633, "tok=roussent": -0.255, "pv=prairie": -0.243, "pv2=petite": -0.199, "pv2=proposition": -0.248, "nx=concessionnaire": -0.248, "tok=dispute": -0.246, "pv2=journees": 1.279, "tok=provoque": -0.234, "tok=pouvait": 0.966, "pv=l'on": 1.117, "pv2=d'ou": 1.117, "nx=decouvrir": 1.117, "pv2=au": -0.379, "tok=voilent": -0.492, "nx=moins": -0.221, "pv=cour": -0.384, "nx=prevue": 0.373, "pv=tuileries": 0.935, "pv=poches": -0.356, "nx=considere": -0.356, "tok=sombre": 1.383, "tok=profitent": 1.346, "pv=larges": 1.405, "pv=gouvernement": -0.266, "tok=deposent": -0.153, "tok=porte": 1.495, "pv2=precedes": 0.587, "nx=lanterne": 0.587, "tok=avantagent": -0.354, "pv=gros": 0.994, "pv2=sur": -0.28, "tok=pensent": -0.16, "pv=interne": 0.784, "tok=chassent": -0.417, "pv=france": -0.304, "pv=filles": -0.181, "nx=davantage": -0.288, "tok=effectuent": -0.173, "pv=geant": 0.476, "pv2=l'argus": 0.476, "pv=images": -0.221, "pv2=vos": -0.306, "pv2=langue": -0.207, "tok=suggerent": -0.252, "pv2=terre": 1.206, "nx=entendre": 1.121, "pv=longue": -0.268, "tok=diffusent": -0.222, "tok=plongent": -0.181, "pv2=kennedy": -0.181, "tok=sonnent": -0.162, "pv=tifinagh": -0.575, "pv2=caracteres": -0.575, "pv=l'impression": 1.059, "tok=insolent": 2.402, "pv=sourire": 1.224, "pv2=petit": 0.868, "tok=estiment": -0.193, "tok=compte": 0.881, "tok=illustrent": -0.219, "pv=charentes": -0.177, "tok=bravent": -0.198, "pv=vieux": -0.186, "tok=cadrent": -0.316, "tok=reculent": -0.215, "pv2=flaque": -0.152, "nx=generalement": -0.427, "tok=gardent": -0.395, "pv=oves": -0.329, "pv2=reliefs": -0.329, "nx=particulierement": -0.93, "tok=comporte": -0.444, "pv=livret": -0.234, "pv2=humaine": 0.343, "tok=conjuguent": 2.351, "pv2=forte": 2.351, "nx=dont": -0.159, "tok=dit": 2.181, "pv2=ordres": 0.463, "nx=napoleon": 0.463, "tok=couchent": -0.231, "tok=classe": 1.009, "pv=chaussures": -0.192, "tok=commercent": -0.508, "pv=important": -0.174, "tok=change": -0.207, "nx=place": -0.227, "tok=circulent": -0.187, "pv2=soi": 0.262, "nx=possibles": 0.262, "nx=fournir": -0.435, "pv=administrateurs": -1.018, "pv=euilles": -0.197, "tok=structurent": -0.337, "tok=feront": 1.634, "pv2=jusqu'en": 1.634, "nx=respiratoire": -0.225, "pv2=partenaire": -0.358, "nx=impregne": -0.358, "pv=esprits": -0.6, "nx=pire": -0.6, "tok=soient": 1.099, "nx=affichees": 1.248, "tok=auront": 0.915, "pv=la": 2.059, "pv2=jour": 1.477, "tok=taillent": -0.736, "pv=moyenne": -0.201, "pv=deux": -0.81, "pvNUM": -0.81, "tok=varient": -0.422, "pv=regard": 1.003, "pv=os": -0.155, "tok=courent": -0.355, "tok=listent": -0.152, "pv2=autres": 0.386, "pv2=chiens": -0.4, "tok=laisse": -0.687, "tok=entende": -0.156, "tok=commandent": -0.283, "tok=soulevent": -0.266, "pv2=prise": 0.962, "tok=assurent": -0.166, "nx=jusqu'a": -0.19, "tok=exploite": -0.151, "pv=progressions": -0.151, "tok=daignent": -0.155, "pv=popeline": 0.786, "pv2=anciens": 0.839, "pv=recentes": -0.36, "pv=secteurs": -0.378, "nx=priori": -0.378, "pv=copie": 0.246, "pv2=leur": 0.721, "nx=invites": 0.246, "nx=bientot": -0.203, "tok=violentent": -0.432, "pv=devideuses": -0.714, "tok=disparaitront": -0.592, "pv=abonnes": -0.592, "tok=tombent": -0.593, "tok=reside": -0.498, "pv=panhard": -0.159, "pv2=chez": 0.551, "tok=trompe": -0.205, "pv=rugbyman": -0.178, "pv2=labruyere": -0.754, "nx=fait": -0.856, "nx=l'auteur": -0.738, "pv=blageon": 1.52, "pv=pare": 0.821, "pv=motopropulseur": 0.357, "nx=donnes": 0.357, "pv2=prochaine": -0.17, "tok=portait": -0.425, "pv2=imperieux": -0.425, "tok=fleurissaient": 1.042, "pv=d'ionie": 1.042, "pv2=volute": 1.042, "tok=habillent": 0.752, "pv2=sombres": 0.804, "pv=ch": -0.598, "pv2=t": -0.598, "tok=controlent": 1.385, "pv=postlevee": 1.385, "tok=coutent": -0.333, "pv2=ca": -0.171, "pv=dechets": 0.836, "nx=celui": -0.272, "tok=amende": 1.572, "pv2=augmentes": 1.572, "pv=encore": 1.295, "pv2=l'illegitimite": -0.37, "nx=l'illegitimite": -0.37, "pv=libre": -1.015, "pv2=stabulation": -1.015, "pv=chef": -0.158, "tok=regarde": -0.196, "pv=d'abondance": -0.154, "pv2=vaches": -0.154, "nx=tranquillement": -0.154, "pv2=squelettiques": 0.528, "nx=repete": 0.528, "tok=foulent": -0.162, "nx=couverte": 0.654, "tok=necessitent": -0.229, "tok=demarrent": -0.153, "tok=grimace": 1.599, "pv=curieuse": 1.599, "tok=lancent": -0.454, "tok=approchent": -0.453, "pv=menuisier": 1.155, "nx=connaitre": 1.155, "tok=devaient": 0.997, "pv=emancipation": -0.21, "pv=duquel": 0.604, "pv2=cours": 0.591, "tok=voyagent": -0.674, "pv2=viol": -0.775, "pv=phenomene": -0.166, "pv=portes": 0.91, "nx=arretee": 0.91, "pv=l'histoire": -0.171, "tok=terminent": -0.272, "tok=seront": 3.067, "nx=taxes": 1.165, "nx=chez": -0.293, "pv=doigts": -0.197, "tok=vehiculent": -0.512, "pv2=pneumatiques": -0.346, "nx=doit": -0.413, "pv2=additionnel": 0.485, "tok=affichent": -0.216, "tok=accompagnent": -0.211, "tok=affecte": -0.196, "pv=occidentalistes": -0.566, "pv=astrocytes": -0.15, "tok=ressemblaient": 1.302, "pv2=barrant": 1.302, "tok=souligne": -0.345, "nx=l'importance": -0.162, "pv2=cour": 0.768, "nx=l'odeur": 0.768, "tok=rebutent": -0.173, "pv=jargon": -0.173, "tok=propose": -0.238, "tok=serait": 1.061, "pv=l'universite": 1.21, "nx=liee": 1.21, "pv=soins": -0.292, "nx=pris": -1.492, "pv2=bousculade": -0.167, "pv=œil": 0.454, "pv=sismotheres": 1.551, "tok=herissent": -0.189, "nx=d'en": -0.192, "pv=accord": -0.231, "nx=signe": 0.324, "tok=refusent": -0.18, "pv=souvent": -1.2, "pv=l'etude": -0.275, "tok=affirme": -0.273, "nx=qu'un": -0.157, "pv=d'autrui": 0.555, "pv2=affaires": 0.555, "pv=part": 0.272, "nx=tellement": 0.16, "tok=provient": -0.172, "pv=arabes": -0.172, "pv2=marches": -0.74, "tok=prisent": -0.217, "pv=boursiers": -0.529, "nx=laisse": -0.529, "pv=unites": 0.81, "pv2=jeune": -0.164, "pv2=archaique": -0.594, "tok=caracterisent": -0.228, "tok=tente": 1.261, "pv2=toiles": 1.261, "pv=auxquels": 1.811, "pv2=couleurs": 1.811, "nx=seront": 0.639, "nx=legerement": -0.256, "nx=tant": -0.401, "pv=ferme": -0.31, "pv=arbres": -0.156, "tok=eleve": 0.651, "nx=controler": 0.651, "pv=monocotyledones": -1.549, "nx=depuis": -0.272, "pv=zen": 0.233, "pv2=bouddhisme": 0.233, "tok=troquent": -0.172, "nx=rapidement": -0.184, "pv=cost": -0.164, "pv2=low": -0.164, "pv=agathe": 0.765, "nx=touchable": 0.765, "tok=durent": 1.248, "pv=sac": 1.248, "nx=essuyer": 1.248, "pv=dimension": 0.205, "pv2=dont": -0.313, "pv2=vente": -0.177, "pv=materiaux": 0.464, "pv2=divers": 0.464, "nx=montre": 0.464, "pv=sang": 1.511, "pv=collectif": -0.182, "pv=series": 0.661, "pv=janvier": 0.248, "nx=apparues": 0.248, "nx=ceux": -0.173, "pv=race": 1.201, "nx=langue": 1.201, "tok=conservent": -0.214, "nx=eut": -0.164, "pv2=compte": -0.152, "tok=joue": -0.197, "pv2=coucha": -0.197, "pv=mariachis": 0.675, "nx=directement": -0.318, "tok=labourent": 1.469, "pv=precedent": 1.469, "nx=d'etre": -0.153, "tok=interpellent": -0.178, "tok=supportent": -0.25, "tok=evitent": -0.191, "pv=sein": -1.004, "nx=l'indice": -1.004, "tok=tiraient": 1.348, "pv2=signature": 0.499, "tok=permettent": 1.256, "pv=standard": 1.256, "pv2=craniographie": 1.256, "pv=gomez": 0.458, "pv2=selena": 0.458, "nx=recemment": 0.458, "tok=appliquent": 1.121, "pv=d'affichage": 1.121, "pv2=panneau": 1.121, "pv=donation": -0.192, "tok=reposaient": 1.453, "pv=cotes": 1.453, "pv=d'ergosterol": 0.337, "pv2=phosphate": 0.337, "nx=activables": 0.337, "pv=ethniques": 0.477, "pv2=criteres": 0.477, "nx=contraire": 0.477, "tok=empechent": -0.192, "pv=viennent": -0.165, "pv=d'ucclois": -0.602, "pv2=triclee": -0.602, "nx=gagne": -0.602, "pv=l'energie": 0.789, "nx=preuve": 0.562, "pv2=gendarmerie": 0.487, "nx=rendus": 0.487, "tok=peinturent": -0.26, "tok=arrangent": -0.279, "pv=ballon": -0.279, "tok=dirige": -0.155, "pv=araucaniennes": -0.155, "pv2=tribus": -0.155, "pv2=nos": 0.298, "tok=connaissent": 1.26, "pv=industriels": 1.26, "pv2=produits": 1.26, "tok=declare": -0.179, "tok=delire": 1.218, "pv2=chamelle": 1.218, "nx=emplissaient": 1.218, "pv=m'a": 0.868, "pv2=journal": 0.868, "nx=qu'en": 0.777, "pv2=aiguilles": 0.846, "tok=pratique": 0.69, "pv=maniere": 0.966, "tok=rebellent": -0.19, "tok=massent": -0.265, "pv=joints": -0.222, "tok=afflue": -0.183, "tok=comprenne": -0.276, "nx=facilement": -0.172, "tok=couplent": -0.372, "nx=homosexuel": -0.372, "tok=ejacule": -0.203, "pv2=instruments": -0.173, "tok=donne": 0.984, "tok=modelait": -0.289, "pv2=avant": 0.83, "tok=allait": 1.513, "pv=mere": 1.294, "pv2=madame": 1.513, "nx=s'appliquer": 0.76, "pv=chaises": 0.753, "nx=robe": 0.753, "tok=precise": 1.602, "pv=pantieres": 1.602, "tok=centrent": -0.473, "tok=appartiennent": 1.301, "pv=animaux": 1.301, "nx=on": -0.168, "tok=confit": 1.554, "pv=kumquat": 1.554, "pv2=duquel": 1.654, "nx=dissemines": 1.654, "pv=premier": -0.159, "tok=tienne": -0.202, "tok=remplissent": 1.62, "pv2=d'auteur": 1.62, "tok=diminuent": -0.388, "tok=contienne": -0.232, "nx=aucun": -0.216, "pv=billard": 1.043, "tok=accouraient": 2.1, "pv=fideles": 2.1, "nx=chaque": -0.167, "nx=tandis": -0.187, "tok=obliquent": -0.168, "pv2=couleur": -0.156, "pv=lumieres": 1.094, "nx=contraste": 1.094, "pv=nuit": -0.177, "tok=rejoigne": -0.208, "tok=manque": -0.195, "pv2=decouvertes": -0.193, "tok=melange": 1.264, "pv2=coagulation": 1.264, "nx=qu'on": -0.199, "pv=crus": -0.394, "nx=precise": -0.394, "pv=m'ont": 0.749, "pv2=architrave": 0.749, "nx=gagner": 0.749, "pv=vin": -0.281, "nx=observateur": 1.178, "pv=semi": -0.153, "pv=trucs": -0.335, "nx=dire": -0.335, "tok=rejette": -0.201, "pv=aclots": -0.191, "pv2=cerfs": -0.191, "pv=allemandes": -1.065, "pv2=aigles": -1.065, "pv=remorque": -0.19, "pv=l'einstein": -0.164, "pv=nuits": 0.519, "nx=fort": 0.641, "tok=expriment": -0.317, "tok=declenche": -0.17, "nx=fortement": -0.193, "tok=demarchent": -0.18, "pv=telle": -0.18, "pv=oblations": -0.259, "pv2=pin": -0.154, "tok=rentent": -0.331, "tok=barbe": 3.412, "pv=sainte": 0.719, "pv=shuswap": 0.313, "tok=affluent": 1.349, "pv=raviolis": -0.212, "pv=extremement": -0.16, "pv=secs": 0.469, "pv2=terreins": 0.469, "nx=excellent": 0.469, "tok=supporte": -0.2, "pv=fascines": -1.353, "tok=coute": 1.634, "pv=apparences": 1.484, "tok=achete": -0.467, "pv=secousse": 1.3, "pv=l'arene": 0.36, "nx=interdite": 0.36, "pv=d'etat": 0.677, "tok=vinrent": 1.923, "pv=brash": 1.923, "pv2=cycliste": 0.859, "pv=l'ecran": 0.228, "nx=dites": 0.333, "pv=varietes": -0.428, "pv=bijoux": -0.161, "nx=laure": -0.161, "tok=emprunte": -0.176, "pv=batteries": 1.02, "pv=betel": 0.221, "tok=chinent": -0.189, "nx=me": 0.862, "tok=appelle": -0.304, "pv=unis": -0.187, "pv2=etats": -0.187, "pv=double": -0.214, "tok=alterent": -0.183, "nx=representes": 1.189, "pv=format": 1.293, "pv2=volantes": 1.293, "pv=patient": -0.268, "tok=concerne": -0.239, "pv=cathedrale": -0.174, "nx=l'angelus": -0.174, "pv=aines": 0.646, "nx=contrebalancee": 0.646, "tok=ardent": 1.417, "pv=desir": 1.417, "nx=consideree": 0.799, "tok=rentrent": -0.155, "pv=surface": -0.16, "nx=l'appelation": -0.171, "nx=sont": 0.491, "tok=domestiquent": -0.471, "pv=non": 0.935, "tok=disent": 1.445, "pv=ressources": -0.34, "nx=rire": -0.34, "pv=indiennes": 0.927, "pv2=societes": 0.927, "nx=sexualisees": 0.927, "tok=suintent": 1.283, "pv=desquelles": 1.329, "pv2=long": 1.329, "pv=brabe": 0.193, "nx=metamorphoses": 0.193, "pv2=nappe": -0.153, "tok=plainent": -0.207, "pv=courageux": 1.125, "nx=tenter": 1.099, "tok=cache": 1.273, "pv=bonnet": 1.273, "nx=oreilles": 1.273, "pv=perlite": 0.277, "tok=avaient": 1.007, "pv=nimes": -0.171, "nx=allume": -0.171, "pv=narcisses": 0.971, "pv=russe": 0.174, "pv2=propagande": 0.174, "pv=demission": -0.181, "nx=memes": -0.181, "pv=benzene": -1.079, "tok=clignotent": -0.159, "pv2=fort": -0.161, "pv=chaume": 0.186, "nx=fixes": 0.186, "tok=defassent": -0.196, "pv2=fils": -0.245, "pv=scandal": 1.383, "pv2=for": 1.383, "pv=kamechliye": 0.264, "tok=dispose": -0.188, "tok=excite": -0.395, "pv=dettes": -0.395, "pv2=major": -0.226, "pv2=militants": 1.502, "pv2=montants": 1.048, "nx=cochere": 1.048, "pv=observations": 0.388, "tok=chantent": -0.188, "pv=bienseances": -0.69, "tok=glissent": -0.187, "pv=stereodescripteurs": 0.164, "nx=ecrits": 0.164, "tok=veulent": 1.321, "nx=subitement": 0.764, "tok=evoluent": -0.159, "nx=ville": -0.373, "pv=sacree": -0.391, "pv2=chapelle": -0.391, "pv=halles": -0.172, "pv=d'enderlein": 0.426, "tok=reclame": 0.633, "pv=aides": -0.587, "pv=gauche": 0.848, "pv2=croisillonnage": 0.85, "nx=poutre": 0.85, "pv=revendications": 0.489, "nx=exclue": 0.489, "tok=gueulent": -0.156, "tok=semblaient": 1.532, "pv=cafe": 1.419, "pv=d'outre": 0.984, "pv=industrielles": 0.537, "pv2=sources": 0.537, "pv=dilatation": 0.46, "pv=centre": 0.582, "tok=prepare": -0.23, "tok=conduisent": 1.037, "pv2=autorite": 1.037, "pv2=colo": 0.705, "pv=araignees": -0.202, "tok=apprennent": 1.524, "pv=chamberland": -0.218, "pv=vite": -0.535, "pv2=jambes": -0.535, "pv=villages": -0.192, "tok=dribblent": -0.195, "pv2=restoroutes": 0.421, "tok=acceptent": -0.196, "pv=n'ont": 0.724, "pv2=remedes": 0.724, "nx=qu'empirer": 0.724, "tok=fabrique": -0.158, "pv=hanches": 0.719, "pv=tamoul": 0.169, "tok=militent": -0.157, "pv=privee": -0.157, "pv=ruysdael": -0.244, "pv2=jacques": -0.309, "nx=participe": -0.244, "tok=exploitent": -0.152, "pv=chauvinisme": -0.152, "tok=seraient": 1.119, "nx=eliminees": 1.119, "pv=l'edifice": -0.485, "pv=passivites": 1.351, "pv=tiennent": 1.311, "tok=sentaient": 1.55, "pv=frame": 0.714, "pv=migrants": 0.184, "nx=partis": 0.184, "pv2=unique": -0.311, "nx=pousses": -0.311, "pv=electrique": 0.206, "nx=situees": 0.206, "tok=signe": 2.441, "pv2=mains": 1.45, "pv=vapeur": 0.201, "tok=prouvera": -0.183, "pv2=ovaires": -0.183, "pv=racistes": 0.797, "pv2=propos": 0.797, "pv=twerkeuses": 0.261, "tok=combattent": 1.07, "pv=filiale": 1.07, "pv2=l'amitie": 1.001, "nx=faiblement": 1.07, "tok=concentrent": -0.213, "tok=exaltent": 1.713, "pv=sexes": 1.713, "pv=batailles": 0.724, "nx=revolu": 0.724, "pv=marchands": 0.47, "pv2=navires": 0.47, "nx=incendiee": 0.47, "pv=feuilles": 0.779, "tok=huilent": -0.221, "pv2=rendement": -0.177, "nx=regional": -0.322, "pv2=jeunes": -0.198, "tok=pompent": -0.19, "pv2=aspiratoire": -0.19, "pv=type": 1.218, "pv2=alfa": 1.218, "pv2=syntaxique": 0.408, "tok=remplace": -0.203, "pv=flatulences": -0.203, "nx=l'encens": -0.203, "nx=gravement": -0.711, "pv=tice": 0.463, "pv2=ju": 0.463, "nx=be": 0.463, "tok=tombe": 1.067, "pv2=mysteres": 1.067, "nx=l'ame": 1.067, "pv=emblavures": -0.151, "pv=l'inde": -0.258, "nx=l'exemple": -0.185, "pv=mercure": 1.581, "tok=pourvoyaient": -0.327, "pv2=largeot": -0.327, "pv=laterales": -0.35, "pv2=nefs": -0.35, "tok=chante": -0.252, "tok=defilent": -0.224, "pv=gildes": -0.153, "tok=baignent": -0.167, "pv=couvercle": -0.167, "nx=depassees": 0.911, "pv=chanvre": 0.856, "pv=sentene": 0.462, "pv=bregin": 0.332, "pv=bouche": 0.198, "pv=koulaks": -0.399, "nx=entraine": -0.399, "pv=confederation": 1.712, "tok=stylent": -0.267, "pv=bon": -0.267, "pv2=braillarde": 1.695, "pv=logement": -0.197, "pv=symboles": 0.215, "pv=viscosite": 0.161, "tok=charge": 1.334, "pv=cotoyer": -0.582, "pv=nomme": 1.106, "pv2=hameau": 1.106, "nx=richard": 1.106, "pv=aspergillaire": 0.223, "pv2=risque": 0.223, "pv=mola": 0.277, "pv2=d'ugo": 0.277, "pv=zebres": -0.282, "nx=s'attaquer": -0.282, "tok=suffit": 1.07, "pv=soignee": 1.07, "pv2=trempe": 1.07, "pv=secourisme": 0.752, "nx=indispensable": 0.752, "pv=lalibela": 0.237, "tok=enduit": 1.144, "pv2=revetues": 1.144, "pv=betteraves": 1.082, "tok=sillonne": -0.166, "pv=vaisseaux": -0.166, "pv=frace": -0.192, "pv=democratie": 1.207, "pv=barbe": 0.248, "nx=traitees": 0.248, "pv=voyageur": 0.981, "pv=deshiberner": -0.637, "pv=horizons": 1.115, "nx=presentant": 1.115, "pv=senateurs": -0.162, "pv=radio": 0.249, "pv2=signal": 0.249, "pv=latentes": -0.996, "pv2=hyposideremies": -0.996, "nx=venues": -0.996, "pv=allemande": 0.208, "pv2=camomille": 0.208, "nx=sialagogues": 0.208, "tok=etoilent": -0.183, "tok=brise": 0.936, "tok=verifie": -0.184, "pv=peseuses": -0.184, "nx=s'ils": -0.184, "pv2=bureau": 0.991, "nx=d'impatience": 0.991, "pv=flamboyante": 1.585, "tok=construisent": 0.79, "pv=moi": 1.178, "nx=voulu": 1.178, "pv=panneaux": 0.925, "pv=obliquement": -0.66, "pv2=jetes": -0.66, "pv=vieillissement": 0.799, "pv=toiture": -0.341, "nx=developpe": -0.341, "tok=deviennent": 1.311, "pv=tente": 1.311, "nx=palatiaux": 1.311, "pv2=gimelans": -0.209, "pv=kan": -0.331, "nx=diskan": -0.331, "pv2=travaillent": 1.33, "tok=corroborent": -0.164, "pv=vichy": -0.164, "pv=l'operation": -0.172, "pv2=necessite": -0.556, "nx=c'etait": 1.178, "pv=resultats": -0.192, "pv2=derisoire": -0.332, "nx=crayons": -0.332, "tok=attentent": -0.177, "pv2=processus": -0.177, "pv=certains": 1.429, "pv=ecouter": -0.177, "tok=pourraient": 0.941, "pv=epoxydes": 0.941, "pv2=motifs": 0.941, "tok=rendent": 1.486, "nx=s'aplliquer": 0.754, "pv=l'aisance": 0.19, "pv=messages": -0.202, "nx=donne": -0.202, "nx=defendre": 1.141, "tok=habitent": 1.258, "pv=sublime": 1.407, "pv2=reve": 1.407, "pv=dnipro": 0.195, "pv2=strategique": 0.195, "nx=retombes": 0.195, "tok=faudra": 0.905, "nx=punies": 0.199, "pv=shrana": -0.17, "pv=ouvrages": -0.156, "nx=chacun": -0.156, "tok=naissent": 0.689, "tok=ranimaient": 1.546, "pv2=puis": 1.546}, "seuil": 0.5};
  function svTaisCarte(T,i){return _taisCarte(T,i,SV_TAIS);}
  function pluralVig(T,tg,i){
    if(!tg||i>=tg.length)return null;
    var w=deaccS(T[i].toLowerCase());
    if(w.length<3||/[sxz]$/.test(w))return null;                       // déjà pluriel/invariable
    if(tg[i]!=='NOUN'&&tg[i]!=='ADJ')return null;
    if(T[i].indexOf("'")>=0)return null;                             /* ÉLISION → ABSTENTION (signalé par Rem, 2026-08-11).
       « Les girolles QU'ELLE avait cueillies → qu'elles », « les livres QU'IL m'a rendus → qu'ils »,
       et même « M'A → m'as » : un token élidé (qu'elle, m'a, l'école) n'est JAMAIS un nom à accorder
       avec le déterminant de l'antécédent — le pronom après « qu' » est le SUJET de la relative, son
       nombre est indépendant. Le HMM le tague NOUN (suffixe inconnu) et la branche PLDET collait un
       -s. La branche CARDINAL avait déjà cette garde ; celle-ci manquait. Doctrine élision : faire
       ABSTENIR une liste fermée est net-PROTECTEUR. */
    var c0=T[i][0];if(c0&&c0!==c0.toLowerCase())return null;           // nom propre
    for(var j=i-1;j>=0&&j>=i-4;j--){var dj=deaccS(T[j].toLowerCase());
      if(PLDET[dj]){
        if(svReads(T[i]).length||_COLOR_ADJ[w]||_INVAR_COLOR[w])return null;   // verbe mistagué NOUN (« les chats mangent »→mangents) ou couleur INVARIABLE (« yeux marron », « gants crème ») → jamais pluralisés (miroir garde CARD ci-dessous + sets couleur)
        var pl=_plu(T[i].toLowerCase());return pl!==T[i].toLowerCase()?ckeepcase(T[i],pl):null;}
      if(CARD[dj]){                                                    // cardinal ≥2 + nom singulier → pluriel (à vérifier)
        if(T[i].indexOf("'")>=0)return null;                          // élision (« quatre d'entre eux », « tous deux s'élèvent ») = pas un nom compté
        if(CARDINV[w]||CARD[w]||CARDSTOP[w]||NOUN_PL_STOP[w])return null;   // cible = autre nombre (« cent trente »)/invariable/préfixe (super, tout)/pluriel latin (« cinq minima »)
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
  function saisVig(T,i){var w=T[i].toLowerCase();if(w!=='sais'&&w!=='sait')return null;
    /* ORANGE enseignante : [il/elle/on] + sais/sait (+adverbe) + PARTICIPE réel → « s'est ? »
       (« il sais trompé de chemin »). L'INFINITIF reste hors-jeu — « elle sait marier les
       saveurs » est légitime : trancher sait/s'est devant un infinitif exige la sémantique
       (mur assumé, modèle NB réfuté : 29 « sait » dans UD, il promptait sur « sait nager »).
       0 tir/16 950 phrases correctes. */
    if(_SEG&&i<_SEG.bb.length&&_SEG.bb[i])return null;
    var p=cprev(T,i);if(!(p==='il'||p==='elle'||p==='on'))return null;
    var j=i+1;while(j<T.length&&j<=i+3&&PPMID[deacc(T[j].toLowerCase())])j++;
    if(j>=T.length||!(_isPpl(T[j])||_SAIS_PPU[deacc(T[j].toLowerCase())]))return null;   // -u fréquents (perdu/vu/connu…) : hors _isPpl strict (anti-noms), sûrs dans CE frame
    return "s'est";}
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
  // VIGILANCE ORANGE « accord genre à vérifier » — miroir app. Flip de genre adjectif épithète (audible, hors FP=0
  // : ~8 vrais FP/14450 homographes nom/rattachement) → « qui est-ce qui, il ou elle ? » à confirmer. Réutilise ADJP.
  var _ADVQ_G={peu:1,si:1,plus:1,moins:1,tres:1,trop:1,tout:1,toute:1,aussi:1,assez:1,bien:1,fort:1,plutot:1,tellement:1,mal:1};
  function _accOkG(lw,d){var e=ADJP[d];if(!e)return false;var alt=e[1],p=ADJP[deacc(alt.toLowerCase())],ka=p?p[1]:null;
    if(ka===null)return false;return lw===ka.toLowerCase()||lw===alt.toLowerCase();}
  function _adjAgreeG(w,gender,num){var d=deacc(w.toLowerCase()),e=ADJP[d];if(!e)return w;var base=(e[0]===gender)?w:e[1];
    if(num==='p'){var db=deacc(base.toLowerCase()),lc=db.charAt(db.length-1);if(lc==='s'||lc==='x'){}else if(db.slice(-2)==='al')base=base.slice(0,-2)+'aux';else if(db.slice(-3)==='eau')base=base+'x';else base=base+'s';}return base;}
  function genreAdjVig(T,i,tg){var _el=(i>=1&&_elidKind(T[i-1])==='det');
    if(_SEG&&i<_SEG.bb.length&&_SEG.bb[i])return null;
    if(i<2&&!_el)return null;var w=T[i],lw=w.toLowerCase();
    if(lw.indexOf("'")>=0||w.charAt(0)!==w.charAt(0).toLowerCase())return null;
    var d=deacc(lw);
    if(!ADJP[d]||_adjEstem(lw)===null)return null;
    if(_EPICENE_ADJ[d])return null;
    if(!_accOkG(lw,d))return null;
    if(d==='tout'||d==='tous'||d==='toute'||d==='toutes')return null;
    if(!tg||i>=tg.length||tg[i]!=='ADJ')return null;
    if(tg[i-1]!=='NOUN'&&!_el)return null;
    if(_ADVQ_G[deacc(T[i-1].toLowerCase())])return null;
    if(i+1<tg.length&&tg[i+1]==='NOUN')return null;
    if(i+1<T.length){var nx=deacc(T[i+1].toLowerCase());if(nx==='de'||nx==='et'||nx==='ou'||nx==='ni'||nx==='que')return null;}
    if(_COLOR_ADJ[d]&&i+1<tg.length&&(tg[i+1]==='ADJ'||tg[i+1]==='NOUN'))return null;
    if(_headText(T[i-1]).charAt(0)!==_headText(T[i-1]).charAt(0).toLowerCase())return null;
    var dn=deacc(_headText(T[i-1]).toLowerCase()),g=GENDER_PURE[dn];
    if((g!=='m'&&g!=='f')||_SG_STOP[dn])return null;
    var num=_el?'s':(i>=2?_EPI_ART[deacc(T[i-2].toLowerCase())]:null);
    if(!num)return null;
    var sugg=_adjAgreeG(w,g,num);return sugg.toLowerCase()!==lw?sugg:null;}
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
  // ⭐ LE BON INSTRUMENT À LA PLACE DU PROXY. Le filet homographe de `_osVerbCtx` demandait « est-ce
  // un nom ? » à une table de GENRE de 4 178 entrées — or `noun-post` répond exactement à cette
  // question sur 83 356 mots : P(NOM) contre P(VERBE) en ‰, et elle est DÉJÀ CHARGÉE par le moteur.
  // « écorce » y vaut [975, 23] et passait quand même : « une dure écorce qui met le bois tendre »
  // recevait un orange « écorcent » (mesuré 4 fois au produit sur le corpus dys).
  // Le seuil de la règle a/à (PL_EPS_M : P(VER) < 1 ‰) est trop strict ici et laisserait passer
  // écorce. On exige un nom NET — ce qui laisse INTACTS les homographes vraiment ambigus
  // (ferme [389,472], porte [716,284], marche [383,617]) et les mots ABSENTS de la table, dont
  // « circule », le cas que ce filet existe pour rattraper. Référence : flood 25/3943 et rappel
  // 106/153 INCHANGÉS après la pose. Miroir dictee/os_subject_probe.py.
  var OS_NOUN_TAU=900, OS_NOUN_EPS=50;
  // ⭐ COLLISION D'ACCENT (02/09). Les lectures verbales (svReads/CONJ) sont keyées DÉSACCENTUÉES : « adhérent »
  // tombe sur la clé de « adhèrent » et passe pour un verbe ; idem côté, gène, mûre, précédent... 24 mots
  // courants mesurés. Table EXACTE générée par dictee/build_non_verbe_acc.py (Morphalou) — ne pas éditer à la main.
  var _NON_VERBE_ACC={'adhérent':1,'châsse':1,'châsses':1,'côte':1,'côtes':1,'côté':1,'côtés':1,'faîtes':1,'gène':1,'gènes':1,'indifférent':1,'mûre':1,'mûres':1,'précédent':1,'réversions':1,'érigérons':1};
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
  var _OS_INVAR={};('prix cours corps temps bois pays mois bras dos cas choix croix voix noix toux poids '+
    'concours discours parcours secours univers divers pervers avis colis permis compromis '+
    'bus autobus jus repas tapis souris brebis puits gaz nez riz').split(' ')
    .forEach(function(w){_OS_INVAR[w]=1;});
  function _osNumAt(F,k){if(_osElidedSing(F[k]))return 's';if(k>0){var dd=deacc(F[k-1]);if(_osNumPl[dd]||_osPlDet2[dd]||_osPlPhrase[dd])return 'p';
    /* « De trains passent » : « de/d' » en TÊTE de segment + nom en -s/-x = pluriel indéfini (03/09/2026) */
    if((dd==='de'||dd==="d'")&&(k-1===0||(_SEG&&k-1<_SEG.bb.length&&_SEG.bb[k-1]))&&/[sx]$/.test(deacc(F[k]))&&!_OS_INVAR[deacc(F[k])])return 'p';
   if(NUM_DET[dd]!==undefined){var _n=deacc(F[k]);
      /* ⭐ Le -s/-x ne prouve un PLURIEL que si le mot n'est pas INVARIABLE. Sans ce test, le « x »
         de « prix » écrasait le déterminant « Le », pourtant sans ambiguïté, et l'orange proposait
         « Le prix SONT fixé par la loi ». Miroir Python _num_at. */
      return (NUM_DET[dd]==='pl'||(/[sx]$/.test(_n)&&!_OS_INVAR[_n]))?'p':'s';}}return null;}
  function _osCoordPlural(F,vi){var lo=0,j,k,d;if(_SEG){for(j=vi;j>0;j--){if(j<_SEG.bb.length&&_SEG.bb[j]){lo=j;break;}}}for(k=vi-1;k>lo;k--){var _dk=deacc(F[k]);if((_dk==='et'||_dk==='puis')&&k+1<vi){var inpp=false;for(d=1;d<=3;d++){if(k-d>=lo){var dq=deacc(F[k-d]);if(dq==='de'||dq==='des'||dq==='du'||dq==="d'"){inpp=true;break;}}}if(!inpp)return true;}}return false;}   // sujet COORDONNÉ « N et N » (hors PP « de X et Y ») → PLURIEL
  /* LA RELATIVE EN « qui » (03/09/2026, mesuré dans Chrome sur le corpus dys : +1 juste, −10 inutiles, 0 fausse ; texte
     correct 49 → 40 marques, aucune nouvelle). « les villages QUI composent la commune SONT » : le sujet de « sont » est
     l'ANTÉCÉDENT « villages », pas « commune » ; « un groupe de chercheurs QUI traquent » : le sujet est « chercheurs ».
     Les routes R1-R3 lisaient le voisin le plus proche et se trompaient de proposition. Si un « qui » précède le verbe
     dans les 8 tokens (même segment, sans et/ou/mais/que/dont entre les deux), le nombre vient de l'antécédent — qui doit
     le porter LUI-MÊME (un repli de 3 mots en arrière tombait à côté : « FIRA-AER qui », « architékete … qui »). */
  function _osRelAnt(F,vi){var lo=0,j;if(_SEG){for(j=vi;j>0;j--){if(j<_SEG.bb.length&&_SEG.bb[j]){lo=j;break;}}}
    for(j=vi-1;j>lo&&j>=vi-8;j--){var d=deacc(F[j]);if(d==='qui')return j-1;if(d==='et'||d==='ou'||d==='mais'||d==='que'||d==="qu'"||d==='dont')return -1;}return -1;}
  function _osAntNum(F,ant){
    if(ant>=2&&NUM_DET[F[ant-1]]!==undefined){var _d2=deacc(F[ant-2]);if(_d2==='de'||_d2==='des'||_d2==='du'||_d2==="d'")return null;}   // « les nations de la FIRA-AER qui » : l'antécédent est un COMPLÉMENT, la tête est avant → rattachement ambigu, on se tait
    var x=_osNumAt(F,ant);if(x)return x;
    if(ant>0){var _dp=deacc(F[ant-1]),_np=deacc(F[ant]);if((_dp==='de'||_dp==="d'")&&/[sx]$/.test(_np)&&!_OS_INVAR[_np])return 'p';}   // partitif « de chercheurs », « de pays » (invariable exclu)
    return null;}
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
  function _osPronBefore(F,vi){var j=vi-1,st=0;while(j>=0&&st<4&&CLITIC[deacc(F[j])]){j--;st++;}if(j<0)return null;var _e=_ELIDED_PRON.exec(F[j]);if(_e)return deacc(_e[1]);   /* « Alors qu'il reste » : le pronom sujet vit DANS le token élidé (03/09/2026) */
    return SUBJ_PRON[deacc(F[j])]||null;}
  function _osGuardOk(F,vi){var w=F[vi];   // gardes STRUCTURELLES (miroir rAccordSVnoun/rAisAit) perdues au port OS → floodaient sur passé composé/participe/sujet-pronom. Mesuré registre chat : flood 3,5%→0%, recall inchangé. Indépendantes du sujet-OS.
    if(w.indexOf("'")>=0)return false;                                             // verbe élidé (n'est…) → autre structure
    if(/(é|és|ée|ées)$/.test(w))return false;                                      // PARTICIPE (contacté, embrassé) : accord ADJECTIVAL, pas verbal
    if(vi>0&&NUM_DET[F[vi-1]]!==undefined)return false;                            // déterminant avant → T[vi] = NOM
    if(vi>0&&PREP[deacc(F[vi-1])])return false;                                    // préposition avant → nom homographe
    if((vi>=1&&FULL_AUX[deacc(F[vi-1])])||(vi>=2&&FULL_AUX[deacc(F[vi-2])]))return false;   // temps composé (aux + participe : « ont contacté », « a montré »)
    if(_osPronBefore(F,vi)!==null)return false;                                    // sujet pronom net (je/elle…) → « je ne me trompe », « elle m'a… »
    return true;}
  var _osAdvAcc={};'là ici ainsi alors ensuite aussi puis enfin bientôt partout dedans dehors dessus dessous'.split(' ').forEach(function(w){_osAdvAcc[w]=1;});   // adverbes frontaux d'inversion ACCENTUÉS (là≠la : toks garde les accents)
  var _osInvWh={};'que qu ou combien comment quand pourquoi quel quelle quels quelles'.split(' ').forEach(function(w){_osInvWh[w]=1;});   // interrogatifs (déaccentués : ou=où) = _INV_WH
  function _osVerbCtx(tg,F,vi){if(vi>=tg.length)return false;if(_NON_VERBE_ACC[F[vi]])return false;if(tg[vi]==='VERB'||tg[vi]==='AUX')return true;   // GATE POS + filet homographe ÉTROIT (NOUN/X seul, pas ADJ/PROPN=flood jeune/Bee) — miroir Python _verb_ctx : +1 recall/0 flood
    if(tg[vi]!=='NOUN'&&tg[vi]!=='X')return false;var d=deacc(F[vi]);
    if(GENDER_MAP[d]||ADJP[d]||PREP[d])return false;var _np=NOUN_POST?NOUN_POST.get(d):null;if(_np&&_np[0]>=OS_NOUN_TAU&&_np[1]<=OS_NOUN_EPS)return false;
    if(vi>0&&(NUM_DET[F[vi-1]]!==undefined||PREP[deacc(F[vi-1])]))return false;return svReads(F[vi]).length>0;}
  function _osRPostpose(F,vi,tg){var lo=0,j;if(_SEG){for(j=vi;j>0;j--){if(j<_SEG.bb.length&&_SEG.bb[j]){lo=j;break;}}}   // SUJET POSTPOSÉ (inversion, idée Rem #198) — miroir _R_postpose : trigger accent-aware + scan APRÈS le verbe, 0 flood
    var acc=F[lo],d=deacc(acc);
    /* RELATIVE OBJET, détectée LOCALEMENT (miroir app) : _SEG.bb ne marque PAS « que » comme
       frontière de proposition, donc `lo` restait sur le déterminant de l'antécédent. */
    var _rel=false;for(var _r=vi-1;_r>=0&&_r>=vi-3;_r--){var _dr=deacc(F[_r]);
      if(_dr==='que'||_dr==="qu'"){_rel=true;lo=_r;break;}
      if(!(_dr==='ne'||_dr==="n'"||(_r<tg.length&&tg[_r]==='ADV')))break;}
    if(_rel){acc=F[lo];d=deacc(acc);}
    if(!(_rel||_osAdvAcc[acc]||(lo<tg.length&&tg[lo]==='ADV')||_osInvWh[acc]||_osInvWh[d]||(PREP[d]&&acc!=='a'&&acc!=='la')||acc==='comme'||acc==='quand'||acc==='lorsque'))return null;
    for(var k=lo;k<vi;k++){var dk=deacc(F[k]);
      if(dk==='il'||dk==='elle'||dk==='elles'||dk==='ils'||dk==='ce'||dk==='c'||dk==='on'||dk==='ca'||dk==='cela'||dk==='ceci'||dk==='qui'||dk==='dont'||dk==='je'||dk==='tu'||dk==='nous'||dk==='vous'||dk==='lequel'||dk==='laquelle'||dk==='lesquels'||dk==='lesquelles')return null;
      if(dk==='et'||dk==='ou'||dk==='ni')return null;}
    var hi=F.length;if(_SEG){for(j=vi+1;j<F.length;j++){if(j<_SEG.bb.length&&_SEG.bb[j]){hi=j;break;}}}
    var kk=vi+1;while(kk<hi&&kk<tg.length&&(tg[kk]==='ADV'||((tg[kk]==='VERB'||tg[kk]==='ADJ')&&/(é|és|ée|ées)$/.test(F[kk]))))kk++;
    if(_postposePlural(F,tg,kk,hi))return [0.03,0.97];
    if(_rel&&_postposeSingulier(F,tg,kk,hi))return [0.97,0.03];   // le sujet postposé SINGULIER peut se défendre contre un antécédent pluriel
    return null;}
  function _osCoordVerbe(F,vi,vn,f3s,f3p,tg){var j=vi-1,st=0;while(j>=0&&st<3&&CLITIC[deacc(F[j])]){j--;st++;}
    if(j<0)return undefined;var _c=F[j];if(_c!=='et'&&_c!=='ou'&&_c!=='puis'&&_c!=='mais')return undefined;   /* token BRUT : « où » désaccentué serait pris pour « ou » (vu sur « où se trouve le forum ») */
    var lo=0,q;if(_SEG){for(q=j;q>0;q--){if(q<_SEG.bb.length&&_SEG.bb[q]){lo=q;break;}}}
    for(q=j-1;q>=lo&&q>=j-12;q--){var w=F[q];if(w.indexOf("'")>=0||/(é|és|ée|ées)$/.test(w))continue;var _tq=(tg&&q<tg.length)?tg[q]:'';if(_tq!=='VERB'&&_tq!=='AUX'){if(_tq!=='NOUN'&&_tq!=='PROPN'||!NOUN_POST)continue;var _nq=(typeof NOUN_POST.get==='function')?NOUN_POST.get(deacc(w)):NOUN_POST[deacc(w)];if(_nq&&_nq[0]>=100)continue;}   /* sans table noun-post, pas de surcharge du tagger (parité) */   /* le tagger tranche l'homographe (« contre », « vents ») ; un verbe PUR que le tagger rate (« remporta ») passe par noun-post */
      var r=svReads(w);if(!r.length){if(_tq==='VERB'&&w.length>3&&/[a-zà-ÿ]a$/.test(w)){r=[[w,'ind:pas','3','s']];}else continue;}else if(!_isFinite(w))continue;   /* passé simple 3s en -a (« remporta ») absent des tables : lu 3s */
      var rv=svReads(F[vi]),a,b,ok=false,nbs={};for(a=0;a<r.length;a++){nbs[r[a][3]]=1;for(b=0;b<rv.length;b++)if(r[a][2]===rv[b][2]&&(r[a][3]===rv[b][3]||r[a][3]==='x'||rv[b][3]==='x'))ok=true;}
      if(ok)return null;                                        // même sujet possible : rien à dire
      if(nbs.s&&!nbs.p)return vn==='s'?null:f3s;if(nbs.p&&!nbs.s)return vn==='p'?null:f3p;return null;}
    return undefined;}
  function osVerbVig(T,i,tg){if(!_OSLM)return null;
    var F=[],m;for(m=0;m<T.length;m++)F.push(T[m].toLowerCase());
    if(!_osGuardOk(F,i))return null;
    var vi=_osVinfo(T[i]);if(!vi)return null;var vn=vi[2],f3s=vi[3],f3p=vi[4];if(vn==='?'||!f3s||!f3p)return null;
    if(!tg||!_osVerbCtx(tg,F,i))return null;   // GATE POS + filet homographe étroit (miroir _verb_ctx)
    /* LE PARSEUR DE SUJET D'ABORD (03/09/2026, mesuré dans Chrome : famille 2/15/9 → 2/10/9, 0 fausse en plus, texte correct
       49 → 35 marques sans nouvelle). Si le parseur de la règle rouge (_npSubject : [dét + nom-tête] à gauche du verbe,
       compléments « de X » enjambés, relatives coupées) trouve un GN sujet, son nombre est LA voix structurelle — avant la
       route postposée (« Que la lumière du Bouddha éclaire » n'est pas une inversion) et avant les voisins R1-R3 (« le taux de
       mortalité est »). Il se tait devant une coordination « N et N » entre la tête et le verbe (« ovins et caprins … devront »). */
    /* COORDINATION DE VERBES (03/09/2026) : « remporta six victoires ET encaisse trois défaites », « ferait fuir les talents ET
       empêcherait » — le verbe qui suit et/ou/puis/mais reprend le sujet du verbe fini précédent du même segment. Les voisins
       R1-R3 (et le parseur) lisaient l'objet du premier verbe (« victoires » → pluriel) : faux. Si les deux formes partagent
       une lecture (personne, nombre), on se tait ; sinon on propose la forme du même nombre que le premier verbe. */
    var _cv=_osCoordVerbe(F,i,vn,f3s,f3p,tg);if(_cv!==undefined)return _cv;
    if(tg){var _np=null;try{_np=_npSubject(T,tg,i);}catch(e){_np=null;}
      if(_np&&(_np.n==='s'||_np.n==='p')&&!_osCoordPlural(F,i)&&_osRelAnt(F,i)<0){   /* une relative en « qui » entre la tête et le verbe : la route relative parle (03/09/2026) */var _dsn=[_osVote(_np.n,0.9),_osR4(F,i,f3s,f3p)],_wsn=[Math.abs(_dsn[0][0]-_dsn[0][1])+1e-6,(Math.abs(_dsn[1][0]-_dsn[1][1])+1e-6)*0.4];
        var _Zn=_wsn[0]+_wsn[1],_psn=(_wsn[0]*_dsn[0][0]+_wsn[1]*_dsn[1][0])/_Zn,_ppn=(_wsn[0]*_dsn[0][1]+_wsn[1]*_dsn[1][1])/_Zn,_rnn=_psn>=_ppn?'s':'p',_rcn=Math.abs(_psn-_ppn);
        if(_rcn<_OS_TAU||_rnn===vn)return null;return _rnn==='p'?f3p:f3s;}}
    if(tg){var _pp=_osRPostpose(F,i,tg);if(_pp!==null){var _pn=_pp[0]>=_pp[1]?'s':'p',_pc=Math.abs(_pp[0]-_pp[1]);if(_pc<_OS_TAU||_pn===vn)return null;return _pn==='p'?f3p:f3s;}}   // sujet postposé : mode dédié DOMINE
    var _ant=_osRelAnt(F,i),ds,ws=[],q;
    if(_ant>=0){var _an=_osAntNum(F,_ant);if(!_an)return null;ds=[_osVote(_an,0.9),_osR4(F,i,f3s,f3p)];}   // relative : l'antécédent EST le sujet ; s'il ne porte pas son nombre, on se tait
    else ds=[_osR1(F,i),_osR2(F,i),_osR3(F,i),_osR4(F,i,f3s,f3p)];
    for(q=0;q<ds.length;q++)ws[q]=Math.abs(ds[q][0]-ds[q][1])+1e-6;ws[ds.length-1]*=0.4;   // LM (R4) DÉ-PONDÉRÉ : biaisé-fréquence sing., ne doit pas écraser les routes structurelles concordantes (récupère « les livreurs accepte→acceptent »)
    if(_osCoordPlural(F,i)){ds.push([0.02,0.98]);var mw=0;for(q=0;q<ws.length;q++)if(ws[q]>mw)mw=ws[q];ws.push(mw+1.0);}   // route COORDINATION : « N et N » → pluriel, poids fort (tue les floods « la suède et la russie signent »→signe)
    var Zw=0,ps=0,pp=0;for(q=0;q<ds.length;q++)Zw+=ws[q];for(q=0;q<ds.length;q++){ps+=ws[q]*ds[q][0];pp+=ws[q]*ds[q][1];}ps/=Zw;pp/=Zw;var rn=ps>=pp?'s':'p',rc=Math.abs(ps-pp);
    if(rc<_OS_TAU||rn===vn)return null;
    return rn==='p'?f3p:f3s;}
  function osProbe(text){text=String(text).replace(/[’ʼ]/g,"'");_SEG=_segInfo(text);var T=toks(text),tg=posTags(T)||[],out=[],i,s;for(i=0;i<T.length;i++){s=osVerbVig(T,i,tg);if(s&&s.toLowerCase()!==T[i].toLowerCase())out.push({i:i,word:T[i],sugg:s});}return out;}   // sonde OS-seule (parité vs os_subject_probe.py)
  // ANGLICISMES franglais NON-MOTS (miroir app) → ORANGE, priorité speller. Faux-amis homographes EXCLUS (flood mesuré).
  var _ANGLICISME={checker:'vérifier',booker:'réserver',forwarder:'transférer',canceller:'annuler',uploader:'téléverser',downloader:'télécharger',deadline:'échéance',spoiler:'divulgâcher',brainstorming:'remue-méninges'};
  function spellText(text,capital){text=String(text).replace(/[’ʼ]/g,"'");_SEG=_segInfo(text);var T=toks(text),out=[],_tg=null;for(var i=0;i<T.length;i++){
    if(/^(n')?ête$/i.test(T[i])){continue;}   // « ête » → réservé à la règle grammaire rEteEtre (contexte) ; on court-circuite TOUTES les couches speller (ortho + mot-inconnu) pour éviter le double flag « ête→est ». Miroir app.
    var _an=_ANGLICISME[T[i].toLowerCase()];if(_an){out.push({i:i,word:T[i],sugg:ckeepcase(T[i],_an),name:'anglicisme',tier:'vigilance'});continue;}   // anglicisme → ORANGE, court-circuite le speller
    if(T[i]==='Mr'||T[i]==='Mrs'){out.push({i:i,word:T[i],sugg:T[i]==='Mr'?'M.':'Mme',name:'abréviation',tier:'vigilance'});continue;}   // « Mr/Mrs »→« M./Mme » (miroir app)
    if(/^opportunités?$/i.test(T[i])){var _n1=(i+1<T.length)?T[i+1].toLowerCase():'';if(_n1==='de'||/^d'/.test(_n1)){out.push({i:i,word:T[i],sugg:ckeepcase(T[i],/s$/i.test(T[i])?'occasions':'occasion'),name:'anglicisme',tier:'vigilance'});continue;}}   // faux-ami « opportunité de »→« occasion » (miroir app), ORANGE
    var r=spellToken(T[i],i===0,T,i),pushed=false;
    if(r&&r[1]!==T[i].toLowerCase()){out.push({i:i,word:T[i],sugg:ckeepcase(T[i],r[1]),name:'orthographe',tier:r[0]});pushed=true;}
    if(!pushed){var u=spellUnknown(T[i],i===0,T,i);if(u!==null){out.push({i:i,word:T[i],sugg:(u||T[i]),name:'mot inconnu',tier:'vigilance'});pushed=true;}}
    if(!pushed){var h=homoVig(T,i);if(h){out.push({i:i,word:T[i],sugg:ckeepcase(T[i],h),name:'homophone à vérifier',tier:'vigilance'});pushed=true;}}
    if(!pushed){if(_tg===null)_tg=posTags(T)||[];var gv=genreAdjVig(T,i,_tg);if(gv&&gv.toLowerCase()!==T[i].toLowerCase()){out.push({i:i,word:T[i],sugg:ckeepcase(T[i],gv),name:'accord genre à vérifier',tier:'vigilance'});pushed=true;}}   // genre adjectif épithète (« qui est-ce qui, il ou elle ? ») — audible, hors FP=0 → orange
    if(!pushed){if(_tg===null)_tg=posTags(T)||[];var pv=pluralVig(T,_tg,i);if(pv&&!plTaisCarte(T,i)){out.push({i:i,word:T[i],sugg:pv,name:'accord pluriel à vérifier',tier:'vigilance'});pushed=true;}}
    if(!pushed){if(_tg===null)_tg=posTags(T)||[];var pe=participeEtreVig(T,_tg,i);if(pe){out.push({i:i,word:T[i],sugg:pe,name:'accord participe à vérifier',tier:'vigilance'});pushed=true;}}
    if(!pushed){if(_tg===null)_tg=posTags(T)||[];if(_tg[i]==='VERB'||_tg[i]==='AUX'){var sva=rAccordSVnoun(T,i,true);   // ACCORD SUJET-VERBE mid-phrase (rouge = sujet en tête FP=0 ; orange = le reste). DOCTRINE : doute → orange, jamais silence. Fusion grammaire-prioritaire : le rouge gagne au même token.
      if(sva&&sva.toLowerCase()!==T[i].toLowerCase()&&!svTaisCarte(T,i)){out.push({i:i,word:T[i],sugg:ckeepcase(T[i],sva),name:'accord sujet-verbe à vérifier',tier:'vigilance'});pushed=true;}}}
    /* ORDRE (03/09/2026, mesure) : une faute de FORME (« vont cherchait » → chercher, « s'est mariaient » → mariée) est plus
       fondamentale qu'une faute de NOMBRE ; ces deux règles passaient APRÈS l'orange de nombre, qui les faisait taire (« vont
       cherchait » → cherchaient, FAUSSE, alors que semiInfVig proposait le mot juste). Elles passent d'abord. */
    if(!pushed){var gv2=gerondifVig(T,i);if(gv2&&gv2.toLowerCase()!==T[i].toLowerCase()){out.push({i:i,word:T[i],sugg:gv2,name:'participe présent après « en » à vérifier',tier:'vigilance'});pushed=true;}}
    if(!pushed){var spv=sestPpVig(T,i);if(spv){out.push({i:i,word:T[i],sugg:spv,name:'accord participe à vérifier',tier:'vigilance'});pushed=true;}}   // « elle s'est marié » → mariée ? (pronominal = orange)
    if(!pushed){var siv=semiInfVig(T,i);if(siv){out.push({i:i,word:T[i],sugg:siv,name:'infinitif après semi-auxiliaire à vérifier',tier:'vigilance'});pushed=true;}}   // « je vais mange » → manger ? (orange)
    if(!pushed){if(_tg===null)_tg=posTags(T)||[];var iv=imparfaitVig(T,i,_tg);if(iv&&iv.toLowerCase()!==T[i].toLowerCase()){out.push({i:i,word:T[i],sugg:ckeepcase(T[i],iv),name:'accord verbe à vérifier',tier:'vigilance'});pushed=true;}}   // -ais/-ait/-aient homophone, gouverneur relâché (résiduel orange)
    if(!pushed){if(_tg===null)_tg=posTags(T)||[];var osv=osVerbVig(T,i,_tg);if(osv&&osv.toLowerCase()!==T[i].toLowerCase()){out.push({i:i,word:T[i],sugg:ckeepcase(T[i],osv),name:'accord verbe à vérifier',tier:'vigilance'});pushed=true;}}   // OS-sujet : accord de nombre, sujet arbitré par l'OS + LM (résiduel « de N »)
    if(!pushed){var cv=cesVig(T,i);if(cv){out.push({i:i,word:T[i],sugg:ckeepcase(T[i],cv),name:'ces/ses à vérifier',tier:'vigilance'});pushed=true;}}
    if(!pushed){var sv2=saisVig(T,i);if(sv2){out.push({i:i,word:T[i],sugg:sv2,name:"sait/s'est à vérifier",tier:'vigilance'});pushed=true;}}   // participe seulement — l'infinitif est le mur assumé   // carte chaud-froid ces/ses — l'auteur tranche, l'encart enseigne
    if(!pushed){var jiv=jInfVig(T,i);if(jiv){out.push({i:i,word:T[i],sugg:jiv,name:'conjugaison après je à vérifier',tier:'vigilance'});pushed=true;}}   // « J'aimer » → j'aime ? (temps inconnu = orange)
    if(!pushed){var pv=persVig(T,i);if(pv){out.push({i:i,word:T[i],sugg:pv,name:'personne du verbe à vérifier',tier:'vigilance'});pushed=true;}}   // « je fini » → finis ? « tu a » → as ? (orange : la personne, jamais imposée)
    if(!pushed){var oov=onOntVig(T,i);if(oov){out.push({i:i,word:T[i],sugg:oov,name:'on/ont après un sujet pluriel à vérifier',tier:'vigilance'});pushed=true;}}   // « Les enfants on mange » → ont ? (orange)
    if(!pushed){var ov=ouVig(T,i);if(ov)out.push({i:i,word:T[i],sugg:ov,name:'ou/où à vérifier',tier:'vigilance'});}}   // ckeepcase : préserver la MAJUSCULE (« Ecole »→« École »)
    if(SP.ready){var done={};out.forEach(function(f){done[f.i]=1;});   // élision-espace : « c est »→« c'est », « qu il »→« qu'il »
      var er=/[A-Za-zÀ-ÿœŒ'’ʼ]+/g,em,P=[];while((em=er.exec(text)))P.push([em.index,em.index+em[0].length,em[0]]);
      for(var i=0;i<P.length-1;i++){if(done[i]||done[i+1])continue;
        if(!/^\s+$/.test(text.slice(P[i][1],P[i+1][0])))continue;
        var a=P[i][2].toLowerCase(),b=P[i+1][2].toLowerCase(),vow=/^[aeiouyh]/.test(deaccS(b));
        if(a==='aujourd'&&b==='hui'){out.push({i:i,word:P[i][2],sugg:P[i][2]+"'hui",name:'élision',tier:'flag',span:2});done[i]=done[i+1]=1;}
        else if(vow&&SP.WORDS.has(deaccS(b))&&((a.length===1&&'cjldmtns'.indexOf(a)>=0)||a==='qu')){out.push({i:i,word:P[i][2],sugg:P[i][2]+"'"+b,name:'élision',tier:'flag',span:2});done[i]=done[i+1]=1;}
        else if((a==='de'||a==='à')&&(b==='le'||b==='les')&&i+2<P.length&&!done[i+2]&&/^\s+$/.test(text.slice(P[i+1][1],P[i+2][0]))){   // CONTRACTION obligatoire « de le pain »→du, « à le marché »→au (croisement EMF) — garde : NOM au tagger, pas un infinitif (« de le visiter » : 67/67 cas corrects), pas de voyelle après « le » (élision)
          var c3=P[i+2][2],d3=deaccS(c3.toLowerCase()),_tgc=posTags(T)||[];
          if(c3.charAt(0)===c3.charAt(0).toLowerCase()&&c3.indexOf("'")<0&&!(b==='le'&&/^[aeiouyh]/.test(d3))&&_tgc[i+2]==='NOUN'&&!/(er|ir|re|oir)$/.test(d3)){   // toute finale d'INFINITIF exclue (le tagger prenait « transporter/définir/haïr/sortir » pour des noms : 13 FP lus au flood)
            var ctr=(a==='de'?(b==='le'?'du':'des'):(b==='le'?'au':'aux'));
            out.push({i:i,word:P[i][2]+' '+P[i+1][2],sugg:ckeepcase(P[i][2],ctr),name:'contraction',tier:'flag',span:2});done[i]=done[i+1]=1;}}
        else if(a==='qui'&&(b==='il'||b==='elle'||b==='on'||b==='ils'||b==='elles')&&i>0&&!done[i-1]){   // « le film qui il a vu »→qu'il (croisement EMF) : relatif sujet + sujet = jamais ; garde : pas de préposition avant (« avec qui il »)
          var pq=deaccS(P[i-1][2].toLowerCase());
          if(!PREP[pq]&&P[i-1][2].indexOf("'")<0&&pq!=='ce'&&pq!=='celui'&&pq!=='celle'&&pq!=='ceux'&&pq!=='celles'){
            out.push({i:i,word:P[i][2]+' '+P[i+1][2],sugg:ckeepcase(P[i][2],"qu'")+P[i+1][2],name:'élision',tier:'flag',span:2});done[i]=done[i+1]=1;}}
        // sujet « je » mal écrit + AVOIR/ÊTRE 1sg à initiale VOYELLE → « j'ai/j'étais » (« ke ai », « ce avais »). Séquence IMPOSSIBLE (FP=0). Miroir app.
        else if(vow&&(a==='ke'||a==='ge'||a==='ce'||a==='se')&&/^(ai|avais|aurai|aurais|etais|eus|eusse|aie)$/.test(deaccS(b))){out.push({i:i,word:P[i][2],sugg:(/^[A-ZÀ-Ö]/.test(P[i][2])?"J'":"j'")+b,name:'élision',tier:'flag',span:2});done[i]=done[i+1]=1;}}
      // RÉPÉTITION de mot : « le le »→« le » (mot adjacent IDENTIQUE, écart BLANC). FP=0 mesuré (0/2500 UD) : denylist des doublements légitimes (nous nous, très très, oui oui…) + 2e mot non-capitalisé (nom propre redoublé « Bora Bora ») ; le trait d'union (« cha-cha ») est déjà exclu par l'écart-blanc.
      var _REPOK={nous:1,vous:1,si:1,non:1,oui:1,tres:1,bien:1,la:1,ha:1,he:1,ho:1,hi:1,eh:1,hein:1,na:1,tut:1,cha:1};
      for(var ri=0;ri<P.length-1;ri++){if(done[ri]||done[ri+1])continue;
        if(!/^\s+$/.test(text.slice(P[ri][1],P[ri+1][0])))continue;var ra=P[ri][2],rb=P[ri+1][2];
        if(ra.toLowerCase()!==rb.toLowerCase()||/^[A-ZÀ-Ö]/.test(rb)||_REPOK[deaccS(ra.toLowerCase())])continue;
        out.push({i:ri,word:ra,sugg:ra,name:'répétition',tier:'flag',span:2});done[ri]=done[ri+1]=1;}
      // MOT COUPÉ (fusion) : préfixe bien/mal détaché (« bien veillante »→bienveillante, audit rappel
      // dys PR#505 ×2). La soudure doit être au LEXIQUE, B RARE seul (les légitimes « bien fait »,
      // « mal intentionnés », « bien être » ont tous un B fréquent — 9 FP lus au flood naïf) et la
      // soudure ≥ 4× plus fréquente que B. Avec ces gardes : 0 tir/16 950 phrases correctes.
      var _FUS_AUX={a:1,as:1,ont:1,ai:1,avons:1,avez:1,avait:1,avais:1,avaient:1,aura:1,auront:1,aurait:1,auraient:1,est:1,sont:1,etait:1,etaient:1,suis:1,es:1,sommes:1,etes:1};
      var _FUS_PREF={sur:1,sous:1,contre:1,entre:1};
      for(var fi=0;fi<P.length-1;fi++){if(done[fi]||done[fi+1])continue;
        if(!/^\s+$/.test(text.slice(P[fi][1],P[fi+1][0])))continue;
        var fa=P[fi][2],fb=P[fi+1][2];
        if(fa!==fa.toLowerCase()||fb!==fb.toLowerCase())continue;
        if(!/^[a-zà-ÿ]{4,}$/.test(fb))continue;
        var ff=null;
        if(fa==='bien'||fa==='mal'){
          // adverbes : B RARE exigé (les légitimes « bien fait/mal intentionnés » ont un B fréquent)
          var _f1=fa+fb;
          if(SP.ready&&SP.WORDS.has(_f1)&&(SP.FREQ[fb]||0)<=0.05&&(SP.FREQ[_f1]||0)>=(SP.FREQ[fb]||0)*4)ff=_f1;
        }else if(_FUS_PREF[fa]&&fi>=1&&_FUS_AUX[deaccS(P[fi-1][2].toLowerCase())]&&_isPpl(fb)){
          // CADRE aux + préfixe + PARTICIPE (« il a sur estimé ») : une préposition n'existe pas là —
          // composé coupé quasi certain. 0 tir/16 950. Trait d'abord (sous-estimé), soudure sinon
          // (surestimé). Cadre DET+préfixe RÉFUTÉ (« la contre culture » légitime, 3 tirs lus).
          var _ft=fa+'-'+fb,_fs=fa+fb;
          if(SP.ready&&SP.WORDS.has(_ft))ff=_ft;else if(SP.ready&&SP.WORDS.has(_fs))ff=_fs;
        }
        if(!ff)continue;
        out.push({i:fi,word:fa,sugg:ff,name:'mot coupé',tier:'flag',span:2});done[fi]=done[fi+1]=1;}
      // ESPACEMENT français : deux mots COLLÉS par une ponctuation → on insère l'espace. FP=0 mesuré (0/2500 UD). Le POINT « . » est EXCLU (URLs « Zappos.com », abréviations) ; les chiffres ne sont pas capturés par le regex-mot → nombres/heures (« 1,2 », « 17:30 ») saufs d'office. Virgule = espace APRÈS ; « ; : ? ! » = espace AVANT+APRÈS (typo FR).
      for(var si=0;si<P.length-1;si++){if(done[si]||done[si+1])continue;
        var sgap=text.slice(P[si][1],P[si+1][0]);if(!/^[,;:?!]$/.test(sgap))continue;var sw1=P[si][2],sw2=P[si+1][2];
        out.push({i:si,word:sw1,sugg:(sgap===','?sw1+', '+sw2:sw1+' '+sgap+' '+sw2),name:'espacement',tier:'flag',span:2});done[si]=done[si+1]=1;}
      // TRAIT D'UNION manquant dans une LOCUTION FIGÉE non-ambiguë (« au dessus »→« au-dessus », « là bas »→« là-bas », « ci joint »→« ci-joint »). FP=0 mesuré : liste CURÉE d'expressions dont la forme sans trait n'a AUCUNE lecture correcte (les ambiguës « peut être »=verbe, « belle mère »=adj+nom sont EXCLUES). Clé = deacc(« w1 w2 ») → forme canonique accentuée.
      var _HYPHLOC={'au dessus':'au-dessus','au dessous':'au-dessous','au dela':'au-delà','la bas':'là-bas','la haut':'là-haut','la dessus':'là-dessus','la dessous':'là-dessous','la dedans':'là-dedans','ci dessus':'ci-dessus','ci dessous':'ci-dessous','ci contre':'ci-contre','ci joint':'ci-joint','ci jointe':'ci-jointe','ci apres':'ci-après','ci git':'ci-gît','par dessus':'par-dessus','par dessous':'par-dessous','week end':'week-end','week ends':'week-ends','porte monnaie':'porte-monnaie'};
      /* ⭐ LA LOCUTION FIGÉE PRIME SUR UNE DEVINETTE À UN MOT (2026-08-24, mesuré).
         `done` est amorcé depuis les suggestions MOT-À-MOT du speller, et toutes les règles span-2
         lui cèdent. Pour une liste CURÉE dont la forme espacée n'a AUCUNE lecture correcte, c'est la
         mauvaise priorité : 4 des 19 locutions étaient étouffées, dont « week end » qui recevait
         « geek ». Et quand la devinette est juste elle reste PARTIELLE — « au dela » donnait « delà »
         (accent réparé, trait d'union manqué) là où la locution rend « au-delà », les deux d'un coup.
         ⇒ la locution passe QUAND le seul obstacle est un flag d'ORTHOGRAPHE à un mot ; elle s'efface
         toujours devant une autre règle span-2 (élision, contraction, mot coupé…), qui a son propre
         cadre et n'est pas une devinette. Les flags à un mot en conflit sont RETIRÉS : en laisser un
         proposerait « geek » et « week-end » sur le même mot. */
      var _hlSeul=function(k){var n=0,i2;for(i2=0;i2<out.length;i2++)if(out[i2].i===k){if((out[i2].span||1)>=2)return false;n++;}return n>0;};
      for(var hli=0;hli<P.length-1;hli++){
        if(!/^\s+$/.test(text.slice(P[hli][1],P[hli+1][0])))continue;
        var hlk=deaccS(P[hli][2].toLowerCase())+' '+deaccS(P[hli+1][2].toLowerCase()),hlv=_HYPHLOC[hlk];if(!hlv)continue;
        if(done[hli]||done[hli+1]){
          if(!((!done[hli]||_hlSeul(hli))&&(!done[hli+1]||_hlSeul(hli+1))))continue;   // un span-2 occupe la place → on n'y touche pas
          out=out.filter(function(f){return f.i!==hli&&f.i!==hli+1;});                  // sinon : on retire les devinettes à un mot
        }
        if(P[hli][2][0]!==P[hli][2][0].toLowerCase())hlv=hlv.charAt(0).toUpperCase()+hlv.slice(1);
        out.push({i:hli,word:P[hli][2],sugg:hlv,name:"trait d'union",tier:'flag',span:2});done[hli]=done[hli+1]=1;}
      // PLÉONASMES / redondances (catégorie Grammalecte « redondances », liste CLOSE non-ambiguë) → ORANGE « à vérifier », JAMAIS de retrait d'office (resserrement stylistique). FP-safe (orange + liste fermée). Fenêtre 3 puis 2 mots, séparés par du BLANC pur.
      var _PLEO={"au jour d'aujourd'hui":"aujourd'hui","monter en haut":"monter","descendre en bas":"descendre","sortir dehors":"sortir","reculer en arriere":"reculer","avancer en avant":"avancer","prevoir a l'avance":"prévoir","comme par exemple":"par exemple","voire meme":"voire","puis ensuite":"ensuite","car en effet":"car"};
      for(var qi=0;qi<P.length-1;qi++){if(done[qi])continue;var qfound=null,qlen=0;
        for(var qn=Math.min(3,P.length-qi);qn>=2;qn--){var qok=true;
          for(var qk=0;qk<qn-1;qk++)if(!/^\s+$/.test(text.slice(P[qi+qk][1],P[qi+qk+1][0]))){qok=false;break;}
          if(!qok)continue;var qseq=[];for(var qk2=0;qk2<qn;qk2++)qseq.push(deaccS(P[qi+qk2][2].toLowerCase()));
          var qv=_PLEO[qseq.join(' ')];if(qv){qfound=qv;qlen=qn;break;}}
        if(!qfound)continue;var qbusy=false;for(var qk3=0;qk3<qlen;qk3++)if(done[qi+qk3]){qbusy=true;break;}if(qbusy)continue;
        if(P[qi][2][0]!==P[qi][2][0].toLowerCase())qfound=qfound.charAt(0).toUpperCase()+qfound.slice(1);
        out.push({i:qi,word:text.slice(P[qi][0],P[qi+qlen-1][1]),sugg:qfound,name:'pléonasme',tier:'vigilance',span:qlen});for(var qk4=0;qk4<qlen;qk4++)done[qi+qk4]=1;}
      // ORDINAUX (miroir app) : « 1ère/2ème »→« 1re/2e » (suffixe précédé d'un CHIFFRE ; garde « l'ère »/« même »). ORANGE.
      var _ORD={ere:'re',eres:'res',eme:'e',emes:'es',ieme:'e',iemes:'es'};
      for(var di=0;di<P.length;di++){var _os=_ORD[deaccS(P[di][2].toLowerCase())];
        if(_os&&P[di][0]>0&&/[0-9]/.test(text.charAt(P[di][0]-1))){
          for(var dj=out.length-1;dj>=0;dj--)if(out[dj].i===di&&(out[dj].span==null||out[dj].span<2))out.splice(dj,1);   // l'ordinal PRIME sur un « mot inconnu » posé sur « ème » (toks a jeté le chiffre)
          out.push({i:di,word:P[di][2],sugg:_os,name:'nombre',tier:'vigilance'});done[di]=1;}}
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
    else if(/^virgule$|point d.interrogation/.test(n))t='ponctuation';   // ⭐ miroir app : la ponctuation n'est ni un homophone ni du style
    else if(/espace|^virgule|ponctuation|mot coup|trait d.union/i.test(n))t='ponctuation';   // ⭐ miroir app : « espace après la virgule » tombait dans le `else` final = homophone
    else if(/contraction/i.test(n))t='contraction';
    else if(/typographie|nombre|anglicisme|abr[ée]viation|pl[ée]onasme/.test(n))t='style';   // catégories STYLE (élargissement 07/2026) : name-based AVANT les heuristiques accent/segmentation → famille neutre HORS-STADE (miroir _corrFam app ; sinon pléonasme/anglicisme… tombaient en 'homophone_gram' = morphosyntaxique à tort)
    else if(/^sais\/sait$|c'est\/s'est|^son\/sont$|^on\/ont$|^et\/est$|^a\/à$|^ce\/se$|^la\/là$|^peu\/peux\/peut$|^mais\/mes$|^leur\/leurs$|^sais\/sait$/.test(n))t='homophone_gram';   // miroir app : le NOM avant les heuristiques de forme
    else if(/participe/.test(n))t='participe';   // miroir app : le NOM avant l'heuristique d'accent
    else if(/terminaison -er/.test(n))t='accord';   // ⭐ audit 11/09/2026 : -er/-é est un ACCORD de forme verbale (test « mordre »), il tombait en homophone_gram → « remplace par a→avait »
    else if(w&&sg&&w.toLowerCase()!==sg.toLowerCase()&&deacc(w.toLowerCase())===deacc(sg.toLowerCase()))t='accent';   // ⭐ un « mot inconnu » SANS suggestion (w === sg) n'est pas un accent (audit 11/09 : aujourdhui)
    else if((sg.indexOf("'")>=0&&w.indexOf("'")<0)||(sg.indexOf(' ')>=0&&w.indexOf(' ')<0))t='segmentation';   // apostrophe/espace ajouté (élision, espacement)
    else if(/^on\/ont/.test(n))t='homophone_gram';   // miroir app
    else if(/infinitif après semi/.test(n))t='personne';   // miroir app
    else if(/personne du verbe/.test(n))t='personne';   // miroir app
    else if(/accord|genre/.test(n))t='accord';
    else if(/orthograph|[ée]lision|surface|inconnu/.test(n))t='surface';     // mot inconnu / graphie → alphabétique
    else t='homophone_gram';                                                 // homophones du correcteur (a/à, son/sont, ou/où) = GRAMMATICAUX → morphosyntaxique
    return {types:[t],mot:sg,ecrit:w};});}   // ⭐ le mot ÉCRIT et sa correction VOYAGENT jusqu'au conseil (miroir app)
  function diagnose(text){var flags=correctText(text);var facts=flagsToFacts(flags);var dev=developmental(facts);var rem=remedFams(facts);
    return {flags:flags,stade:dev?dev.stade:null,stadeLbl:dev?STAGE_LBL[dev.stade]:null,stadeMsg:dev?STAGE_MSG[dev.stade]:null,
            remed:rem?rem.fams.map(function(t){return remedTip(t,rem.rep[t]);}):[]};}
  function spell(text){return SP.ready?spellText(text):[];}                                  // flags orthographe (auto/flag) seuls
  // HINT CONTEXTUEL (identique app) : homophone = test de substitution fenêtré ±2 mots ; accord = gouverneur réel. Texte BRUT (content.js échappe).
  var _HPROBE={'a/à':['avait','« a » (verbe avoir)','« à » (préposition)'],'et/est':['était','« est » (verbe être)','« et » (= et puis)'],'son/sont':['étaient','« sont » (verbe être)','« son » (le sien)'],'on/ont':['avaient','« ont » (verbe avoir)','« on » (pronom)'],'met/mais':['mettait','« met » (verbe mettre)','« mais » (= pourtant)'],'ça/sa':['cela','« ça » (= cela)','« sa » (la sienne)'],'mais/mes':['tes','« mes » (à moi)','« mais » (= pourtant)'],'peu/peux/peut':['pouvait','« peut/peux » (verbe pouvoir)','« peu » (= pas beaucoup)'],"c'est/s'est":['cela est','« c\'est » (= cela est)','« s\'est » (il se … : verbe pronominal)']};
  function _suggVerbNum(w){var rd=svReads(w),hp=false,hs=false,k;for(k=0;k<rd.length;k++){if(rd[k][2]!=='3')continue;if(rd[k][3]==='p'||rd[k][3]==='x')hp=true;else if(rd[k][3]==='s')hs=true;}return (hp&&!hs)?'pl':((hs&&!hp)?'sg':null);}   // nombre de la forme SUGGÉRÉE lue comme verbe 3e pers. ('pl'/'sg'/null) — détecte le gouverneur ARRIÈRE contradictoire (miroir app)
  var _CARD_PL={deux:1,trois:1,quatre:1,cinq:1,six:1,sept:1,huit:1,neuf:1,dix:1,onze:1,douze:1,treize:1,quatorze:1,quinze:1,seize:1,vingt:1,trente:1,quarante:1,cinquante:1,soixante:1,cent:1,cents:1,mille:1,plusieurs:1,quelques:1};   // cardinaux ≥ 2 (mots) : gouverneur PLURIEL du nom qui suit (miroir app)
  // ⭐ -er / -é (audit 11/09/2026) : ces corrections n'avaient AUCUN 💡 — la branche accord les exclut (le gouverneur n'y dit rien) et famHint rend ''.
  // Le test que tout le monde apprend, fenêtré sur la phrase de l'élève : « mordre » (infinitif) / « mordu » (participe) / « mordez » (-ez). Miroir app _erHint.
  function _erHint(f,T,i){var n=f.name||'';if(!/é\/er|terminaison -er/.test(n))return '';var sg=(f.sugg||'').toLowerCase(),km=/^(.*?)(er|ez|ées|és|ée|é)$/.exec(sg);if(!km)return '';
    var pk=km[2]==='er'?'mordre':km[2]==='ez'?'mordez':'mordu',a=Math.max(0,i-2),b=Math.min(T.length,i+3),w=T.slice(a,b);w[i-a]=pk;
    var me=km[2]==='er'?('infinitif « '+sg+' » (-er)'):km[2]==='ez'?('« '+sg+' » (-ez, vous)'):('participe « '+sg+' » (-'+km[2]+')'),oth=km[2]==='er'?('participe « '+km[1]+'é » (-é)'):('infinitif « '+km[1]+'er » (-er)');
    return 'Astuce : remplace par « '+pk+' ». « '+(a>0?'…':'')+w.join(' ')+(b<T.length?'…':'')+' » se dit ? oui → '+me+' · non → '+oth+'.';}
  function ctxHint(f,T){var i=f.i;if(typeof i!=='number'||!T||i>=T.length)return '';
    var h=_HPROBE[f.name];if(!h){var eh=_erHint(f,T,i);if(eh)return eh;}
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
      if(!g&&i>0&&_CARD_PL[deacc(T[i-1].toLowerCase())]){g=T[i-1];lab='pluriel';}   // ⭐ audit 11/09/2026 : « huit heure » — le CARDINAL d'à côté commande, pas le « ma » six mots plus haut que remontait governorNumber
      if(!g){var gn=governorNumber(T,i,isVerb(T,i)||isParticiple(T,i));
        if(gn){var svn=_suggVerbNum(f.sugg||'');if(svn&&svn!==gn[1])return '';
          if(gn[1]==='sg'&&/nom/.test(n)&&/[sx]$/i.test(f.sugg||'')&&!/[sx]$/i.test(f.word||''))return '';   // un NOM mis au pluriel par la règle, un gouverneur arrière au singulier : l'indice serait contradictoire → silence (miroir app)   // sujet POSTPOSÉ/coordonné (rPostpose…) : contrôleur EN AVANT ; gouverneur arrière contredit la suggestion (nombre ≠) → pas d'indice contradictoire (miroir app _accHint)
          g=gn[0];lab=(gn[1]==='pl'?'pluriel':'singulier');}}
      if(g)return 'C\'est « '+g+' » ('+lab+') qui commande → on accorde « '+(f.sugg||'')+' ».';}
    return famHint(f.sugg||'');}   // dernier recours : témoin de famille / règle -ment (n'écrase aucun indice existant)
  // TYPOGRAPHIE (catégorie Grammalecte) — flags ANCRÉS CARACTÈRE (guillemets droits " → «/», points de suspension ... → …). Miroir app _typoScan. ORANGE. FP-safe : garde chiffre (pouces 5"), contexte ouvrant/fermant. content.js applyOne gère la branche {cs,ce}.
  function _typoScan(text){var out=[],m,re1=/\.{3,}/g;
    while((m=re1.exec(text))){var _p=text[m.index-1]||'',_n=text[m.index+m[0].length]||'';if(/[0-9]/.test(_p)&&/[0-9]/.test(_n))continue;
      out.push({cs:m.index,ce:m.index+m[0].length,from:m[0],sugg:'…',name:'typographie',tier:'vigilance',typo:1});}
    for(var i=0;i<text.length;i++){if(text[i]!=='"')continue;var nx=text[i+1]||'',pv=text[i-1]||'';
      if(/[0-9]/.test(pv)||/[0-9]/.test(nx))continue;
      var wa=/[A-Za-zÀ-ÿœŒ]/.test(nx),wb=/[A-Za-zÀ-ÿœŒ]/.test(pv);
      if(wa&&!wb)out.push({cs:i,ce:i+1,from:'"',sugg:'« ',name:'typographie',tier:'vigilance',typo:1});
      else if(wb&&!wa)out.push({cs:i,ce:i+1,from:'"',sugg:' »',name:'typographie',tier:'vigilance',typo:1});}
        /* ⭐⭐ LES DEUX PREMIÈRES RÈGLES ROUGES DE PONCTUATION DU CORRECTEUR (tout le reste ici est orange).
       POURQUOI CELLES-CI PEUVENT ÊTRE ROUGES ALORS QUE LA VIRGULE SYNTAXIQUE NE LE SERA JAMAIS :
       « où faut-il une virgule » est un JUGEMENT — mesuré 51,98 % de justesse sur 11 304 phrases
       humaines, et la source elle-même écrit « on place GÉNÉRALEMENT une virgule ». Aucun réglage ne
       fera de ça du FP=0. « L'espace autour de la virgule QUI EST LÀ est-il bien placé » est une tout
       autre question : MÉCANIQUE, décidable sur la chaîne seule, sans grammaire ni contexte.
       ⇒ C'est la SEULE couche de ponctuation qui peut atteindre FP=0 — et elle l'atteint.
       MESURÉ : 0 faux positif sur 14 450 phrases UD correctes (les 2 seuls déclenchements y sont de
       VRAIES fautes de typo du corpus : « Warner Bros . La musique », « Dorra Zarrouk,née le »),
       et 156 cas réels attrapés sur 139 593 paires bad/good.
       ⚠️ On ne touche QUE « , » et « . ». Le français demande une espace AVANT « ; : ! ? » », et les
       usages divergent (France/Québec) : ces marques-là ne sont pas mécaniques, elles restent dehors. */
    var re3=/([A-Za-zÀ-ÿœŒ0-9\)\]»])[ 	]+([,.])(?![.\d])/g;
    while((m=re3.exec(text))){
      out.push({cs:m.index,ce:m.index+m[0].length,from:m[0],sugg:m[1]+m[2],name:'espace avant la ponctuation',tier:'auto',typo:1});}
    var re4=/([a-zà-ÿœ]),([A-Za-zÀ-ÿœŒ])/g;
    while((m=re4.exec(text))){
      var _a=m.index; while(_a>0&&!/\s/.test(text[_a-1]))_a--;
      var _b=m.index; while(_b<text.length&&!/\s/.test(text[_b]))_b++;
      /* ⚠️ ON TESTE LE MOT ENTIER, pas une fenêtre de N caractères. Première version : ±14 caractères
         autour de la virgule — trop court pour « https://exemple.fr/a,b » (le schéma est 20 caractères
         plus loin), et la garde CI l'a sorti. Un « : », un « / » ou un « @ » dans le mot qui contient la
         virgule = adresse, chemin ou URL : la virgule y est un séparateur technique, pas une ponctuation. */
      if(/[:\/@]/.test(text.slice(_a,_b)))continue;
      out.push({cs:m.index,ce:m.index+m[0].length,from:m[0],sugg:m[1]+', '+m[2],name:'espace après la virgule',tier:'auto',typo:1});}
        var re5=/,[ 	]*,+/g;   /* VIRGULE DOUBLÉE — mesuré 0 sur 14 450 phrases UD correctes, et observé dans la vraie prise vocale de Rem (« je sais pas comment,, on va le faire »).
       ⚠️ UNIQUEMENT « ,, ». On avait d'abord visé « toute ponctuation doublée » : 15 déclenchements sur du français CORRECT, tous légitimes — « av. J.-C., », « etc., », « Martine B., », « Next..., ».
       Le point d'abréviation suivi d'une virgule est du bon français ; la virgule doublée, jamais. */
    while((m=re5.exec(text))){
      out.push({cs:m.index,ce:m.index+m[0].length,from:m[0],sugg:',',name:'virgule doublée',tier:'auto',typo:1});}
        var re6=/(\S)[ 	]{2,}(\S)/g;   /* ESPACE DOUBLE ENTRE DEUX MOTS — mesuré 0 occurrence sur 14 450 phrases UD CORRECTES, et 95 cas réels sur 139 593 paires bad/good. FP=0 par construction : le français n'a jamais deux espaces entre deux mots.
       ⚠️ Le `(\S)` initial EXCLUT l'indentation : une ligne qui COMMENCE par des espaces n'est pas touchée. On répare un espacement entre MOTS, pas une mise en page. */
    while((m=re6.exec(text))){
      out.push({cs:m.index,ce:m.index+m[0].length,from:m[0],sugg:m[1]+' '+m[2],name:'espace double',tier:'auto',typo:1});}
    return out;}
  /* ⭐ SÉPARÉE DE `_typoScan` À DESSEIN. Cette couche-là est MÉCANIQUE (décidable sur la chaîne
     seule, sans grammaire) — c'est exactement ce qui lui permet d'être FP=0 et d'être rejouée
     ISOLÉMENT par `dictee/typo_probe.js`. Le « ? » manquant, lui, a besoin du tagger POS via
     `estQuestion` : le mettre dans `_typoScan` cassait l'isolement de la sonde ET la propriété
     qui fait la valeur de cette couche. Il vit donc à côté, et `diagnoseAll` concatène. */
  /* ⭐⭐ VIRGULE MANQUANTE — étape ③ de PR#561, jamais faite jusqu'ici.
     Les règles R1–R5 d'Allô prof (`ponctReglesVirgule`) et la porte du juge à trois classes
     (`ponctInterdit`) n'étaient appelées QUE par les deux surfaces VOCALES. Ce sont pourtant des
     règles PUREMENT TEXTUELLES : signature (mots, tg, deja), aucun audio.
     PRIX MESURÉ (`node dictee/virgule_reel_probe.js`, 11 304 phrases écrites par des humains) :
     justesse 50,6 pour cent, rappel 11,0 — et surtout ZÉRO virgule INTERDITE, « ne pas séparer » 7/7.
     Ce 50 SOUS-ESTIME : la virgule française est souvent FACULTATIVE et le corpus compte comme faute
     une virgule juste mais non annotée — PR#561 l'a vérifié à l'œil, 32/40 correctes.
     ⇒ ORANGE (`tier:'vigilance'`), jamais imposé, exclu de « tout corriger ». Une virgule change le
     découpage de la phrase : l'auteur garde le dernier mot.
     ⭐ ANCRÉE DANS L'ESPACE ENTRE DEUX MOTS, pas sur un mot. `_renderView` ne peint les flags ancrés
     caractère que dans les GAPS (`_typoGapHtml`) — une virgule s'insère justement là, elle est donc
     peignable, contrairement au « ? » de fin de phrase qui s'ancre en fin de token et reste muet à
     l'écran (leçon payée le même jour : un flag compté et non peint fait MENTIR le compteur).
     ⛔ GARDE TRAIT D'UNION, appliquée ICI et pas dans la primitive. `toks` coupe sur le trait d'union
     (« sous-espèce » → sous, espèce) et `ponctReglesVirgule(mots,tg,deja)` est la SEULE primitive du
     moteur à ne jamais recevoir `seg` : les 16 autres usages de `_SEG.hy` la protègent, pas elle.
     On la garde au point d'appel — la voix, qui appelle la même primitive, reste inchangée. */
  function _virguleScan(text){
    var out=[];
    if(!text||typeof ponctReglesVirgule!=='function')return out;
    var re=/[A-Za-zÀ-ÿœŒ'’ʼ]+/g,m,P=[];while((m=re.exec(text)))P.push([m.index,m.index+m[0].length,m[0]]);
    if(P.length<3)return out;
    var mots=P.map(function(p){return p[2].replace(/[’ʼ]/g,"'");}),seg=_segInfo(text),k;
    var deja={};for(k=0;k<P.length;k++)if(seg.bb[k])deja[k-1]=1;   // une marque est DÉJÀ posée après le mot k-1
    var tg=null;try{tg=posTags(mots);}catch(e){}
    var idx=null;try{idx=ponctReglesVirgule(mots,tg,deja);}catch(e){return out;}
    if(!idx||!idx.forEach)return out;
    idx.forEach(function(i){
      if(i<0||i+1>=P.length)return;
      if(seg.bb[i+1])return;                                  // marque déjà présente
      if(seg.hy[i+1])return;                                  // ⛔ composé : « sous-espèce » ne se coupe pas
      var cs=P[i][1],ce=P[i+1][0],gap=text.slice(cs,ce);
      if(!gap||/[^ \t]/.test(gap))return;                     // seulement un blanc simple entre les deux mots
      out.push({cs:cs,ce:ce,from:gap,sugg:','+gap,name:'virgule',tier:'vigilance',typo:1});
    });
    return out;}

  function _questionScan(text){var out=[];
    /* « ? » MANQUANT — la seule ponctuation SYNTAXIQUE qu'on puisse proposer aujourd'hui, parce que
     c'est la seule dont on connaisse le prix : `estQuestion` fait 96,67 % de précision (58/60,
     `node dictee/question_bench.js`) et 95,83 % sur 72 498 cas réels dont 27 145 FRAGMENTS. À comparer
     aux 50,6 % de la virgule syntaxique, qui reste dehors pour cette raison (cf. le pavé ci-dessus).
     ⚠️ Elle vivait EN DOUBLE dans les deux surfaces VOCALES et dans AUCUN moteur : quelqu'un qui ÉCRIT
     « viens-tu demain » sans « ? » n'avait rien, alors qu'on savait le détecter depuis PR#385/#398.
     ORANGE et jamais imposé : ajouter un « ? » change le SENS, l'auteur garde le dernier mot.
     ⚠️ On ne touche QUE la phrase terminée par un POINT ou par RIEN. Un « ! » ou un « … » est un choix
     d'auteur (question rhétorique, suspension) — on ne le contredit pas. */
  var _qre=/[^.!?…]+(?:[.!?…]+|$)/g,_qm;
  while((_qm=_qre.exec(text))){
    var _qs=_qm[0],_qfin=_qs.replace(/\s+$/,''),_qlast=_qfin.slice(-1);
    if(!_qfin)continue;
    if(_qlast!=='.'&&/[.!?…]/.test(_qlast))continue;            // ! … ? déjà là ou voulus
    var _qcorps=(_qlast==='.')?_qfin.slice(0,-1):_qfin;
    /* ⭐ POINT FINAL MANQUANT (01/09/2026, demandé par Rem). MESURÉ AVANT D'ÉCRIRE :
       · 39 % des productions réellement dys (gold_claude, 28/72) n'ont AUCUNE ponctuation finale —
         contre 2 % sur les 1 720 paires SYNTHÉTIQUES du même chargeur. Facteur VINGT : les bancs
         actuels sont structurellement aveugles à ce manque, comme ils l'étaient au run-on.
       ⛔ MAIS une règle naïve est INUTILISABLE : simulé sur 707 préfixes de frappe (150 phrases
         correctes coupées mot à mot), elle parlerait sur **79 %** des états intermédiaires — le
         correcteur réclamerait un point à presque chaque touche. Pendant la frappe, TOUTE phrase
         est inachevée ; ce n'est pas une faute, c'est un texte en cours.
       ⇒ DÉCLENCHEUR : dernier segment, 3 mots minimum, verbe conjugué, et le dernier caractère
         n'est pas déjà une ponctuation (`;` `:` `,`).
         ⚠️ J'avais d'abord exigé que l'auteur ait DÉJÀ PONCTUÉ AILLEURS. Rem en a douté, avec raison :
         ce n'est pas une propriété linguistique mais un PROXY pour « il a fini d'écrire » — la même
         erreur que `bb` comme proxy de « frontière de proposition ». Coût mesuré : 14 des 28 cas
         réels perdus (50 %), et précisément les textes SANS aucune ponctuation — les scripteurs les
         plus faibles. Retirée. La vraie source des 55 tirs sur fp_scale était ailleurs : 41 d'entre
         eux finissent par `;` ou `:`, déjà ponctués. La garde juste coûte 0 cas réel.
         Couverture après correction : 28/28 des cas réels. Fatigue : 0/333 sentences.json. */
    if(_qcorps.trim()&&!estQuestion(_qcorps.trim(),QMOTS_CORR)&&_qlast!=='.'
        &&_qm.index+_qs.length>=text.length              // DERNIER segment du texte
        &&';:,'.indexOf(_qlast)<0                        // ; : , sont déjà une ponctuation
        &&_qcorps.trim().split(/\s+/).length>=3){        // pas un fragment d'un mot ou deux
      var _pe=_qm.index+_qfin.length;
      out.push({cs:_pe,ce:_pe,from:'',sugg:'.',name:'point final',tier:'vigilance',typo:1});
      continue;
    }
    if(!_qcorps.trim()||!estQuestion(_qcorps.trim(),QMOTS_CORR))continue;
    /* ⛔ ON N'ÉMET QUE SUR UNE PHRASE TERMINÉE PAR UN POINT — contrainte de RENDU, pas de grammaire :
       `_renderView` ne peint les flags ancrés caractère que dans les ESPACES ENTRE MOTS
       (`_typoGapHtml`), ce qui est juste pour tout ce que cette couche gérait (espaces, virgule
       doublée, guillemets, …) — ça vit toujours entre ou après les mots. Un « ? » proposé en fin de
       phrase NON ponctuée s'ancre sur la DERNIÈRE LETTRE d'un mot : VÉRIFIÉ EN NAVIGATEUR RÉEL, le
       compteur annonçait « 1 correction » et l'écran ne montrait RIEN. Une correction comptée et
       invisible est une interface qui MENT — pire que l'abstention (cf. la garde « aucune copie
       n'annonce un succès qu'elle ignore »). ⇒ tant que le rendu ne sait pas peindre une insertion
       en fin de token, la règle se tait là plutôt que de compter dans le vide. */
    if(_qlast==='.'){
      var _qp=_qm.index+_qfin.length-1;                          // le point EXISTE : substitution, il se peint
      out.push({cs:_qp,ce:_qp+1,from:'.',sugg:' ?',name:"point d'interrogation",tier:'vigilance',typo:1});
    } else {
      /* ⭐ PHRASE SANS PONCTUATION FINALE — le cas du scripteur dys, et celui où la règle se taisait.
         Ce n'était pas un choix de grammaire : `_typoGapHtml` ne savait pas peindre une insertion dans
         l'espace VIDE qui suit le dernier mot, donc le compteur annonçait une correction que l'écran ne
         montrait pas. Le rendu sait le faire désormais (voir _typoGapHtml) : on émet une INSERTION
         (cs===ce) en fin de segment. Reste en VIGILANCE : la ponctuation change le sens, l'auteur tranche. */
      var _qe=_qm.index+_qfin.length;
      out.push({cs:_qe,ce:_qe,from:'',sugg:' ?',name:"point d'interrogation",tier:'vigilance',typo:1});
    }
  }
    return out;}

  /* ⚠️ LA PYRAMIDE MANQUAIT ICI (corrigé le 2026-08-11). Ce pipeline — celui que `content.js` appelle
   vraiment — lançait `correctText(text)` sur le texte BRUT, alors que le site fait tout autre chose
   dans `_computeCorrs` : il applique d'abord l'ORTHOGRAPHE aux tokens, puis fait tourner la
   grammaire sur les tokens NETTOYÉS, en CASCADE jusqu'au point fixe (4 passes).
   ⭐ La parité 3 moteurs ne pouvait pas le voir : elle compare `correctText`, c'est-à-dire le
   REGISTRE DE RÈGLES — pas le PIPELINE. Deux moteurs peuvent avoir exactement les mêmes règles et
   ne pas corriger les mêmes phrases.
   Ce que ça donnait, MESURÉ sur 621 paires dys/GEC : 2 corrections que SEULE l'extension produisait,
   et les DEUX étaient FAUSSES parce que la grammaire s'appliquait au mot mal orthographié —
     « contre les vènt »  -> l'extension écrivait « vènts » (le site corrige vènt->vent PUIS vents)
     « La tigés »         -> l'extension écrivait « tigé »  (le site corrige tigés->tiges)
   Une faute appliquée EN SILENCE dans le champ de l'utilisateur : le pire cas possible. */
  function diagnoseAll(text){
    var sf=SP.ready?spellText(text):[];
    _SEG=_segInfo(text);var _T=toks(text),_Tc=_T.slice();
    sf.forEach(function(f){if(f.span!==2&&f.tier!=='vigilance'&&f.sugg&&/^[A-Za-zÀ-ÿ']+$/.test(f.sugg))_Tc[f.i]=f.sugg;});   // PYRAMIDE : la grammaire voit les tokens nettoyés par l'ortho
    _SEG.pb=_predBounds(_Tc,_SEG);   // bornes prédites sur les tokens NETTOYÉS (les tags y sont plus fiables) — même choix que la sonde pipeline Python
    var _cur=_Tc.slice(),_gbt={},_it,_gf2,_gj,_g2,_add;
    for(_it=0;_it<4;_it++){_gf2=correctTokens(_cur);_add=false;                                   // CASCADE : la grammaire re-tourne sur ses PROPRES corrections jusqu'au point fixe
      for(_gj=0;_gj<_gf2.length;_gj++){_g2=_gf2[_gj];if(_gbt[_g2.i]!=null)continue;_gbt[_g2.i]=_g2;_add=true;
        if((_g2.span==null||_g2.span<2)&&_g2.tier!=='vigilance'&&_g2.sugg&&/^[A-Za-zÀ-ÿ']+$/.test(_g2.sugg))_cur[_g2.i]=_g2.sugg;}
      if(!_add)break;}
    var gf=Object.keys(_gbt).map(function(k){return _gbt[k];});
    gf.forEach(function(f){f.word=_T[f.i];});                                                     // le mot AFFICHÉ reste celui de l'utilisateur, pas la version nettoyée
var byTok={};gf.forEach(function(f){byTok[f.i]=f;});sf.forEach(function(f){if(byTok[f.i]==null)byTok[f.i]=f;
      else if(f.span>=2&&(byTok[f.i].span==null||byTok[f.i].span<2)&&byTok[f.i].tier!=='vigilance'&&typeof f.sugg==='string'&&typeof byTok[f.i].sugg==='string'&&typeof f.word==='string'&&f.sugg.slice(0,f.word.length)===f.word){f.sugg=byTok[f.i].sugg+f.sugg.slice(f.word.length);byTok[f.i]=f;}});   // COLLISION grammaire mono-mot (majuscule) sur le 1er mot d'un span:2 speller → FUSIONNER (parité app _computeCorrs), sinon l'espace/tiret est perdu
    var flags=Object.keys(byTok).map(function(k){return byTok[k];}).sort(function(a,b){return a.i-b.i;});
    var _cov={};flags.forEach(function(f){if(f.span===2)_cov[f.i+1]=1;});flags=flags.filter(function(f){return !_cov[f.i];});   // un token couvert par une élision (span 2) ne compte pas 2× (parité AUDIT #4)
    var _Tt=toks(text);flags.forEach(function(f){var hh=ctxHint(f,_Tt);if(hh)f.hint=hh;});   // hint contextuel par correction (affiché AU CLIC dans content.js)
    var facts=flagsToFacts(flags),dev=developmental(facts),rem=remedFams(facts);
    var _typ=_typoScan(text).concat(_questionScan(text)).concat(_virguleScan(text));_typ.forEach(function(f){f.word=f.from;});   // typo ancrée caractère, orange, HORS facts/stade (pas une faute de stade) ; ajoutée aux flags pour rendu+clic
    return {flags:flags.concat(_typ),grammar:gf,spell:sf,stade:dev?dev.stade:null,stadeLbl:dev?STAGE_LBL[dev.stade]:null,stadeMsg:dev?STAGE_MSG[dev.stade]:null,
            remed:rem?rem.fams.map(function(t){return remedTip(t,rem.rep[t]);}):[]};}

  // ===== chargement lexiques =====
  var _ready=false,_loading=null;
  function setLex(vd,genderRelaxedText,spellerTSV){_applyVdc(vd||{});if(genderRelaxedText)_applyGenderRelaxed(genderRelaxedText);if(spellerTSV)_applySpellerTSV(spellerTSV);_ready=true;}
  var _PREN_L=false;
  async function loadPrenoms(url){
    if(_PREN_L)return;_PREN_L=true;
    try{var gz=await (await fetch(url)).arrayBuffer();
      var st=new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'));
      _applyPrenoms(await new Response(st).text());}catch(e){}}
  function setPrenoms(txt){_applyPrenoms(txt);}   // injection directe (Node/tests, parité)
  function setGaccLex(jsonText){_applyGaccLex(jsonText);}   // injection directe (Node/tests, parité)
  var _GACC_L=false;
  async function loadGaccLex(url){
    if(_GACC_L)return;_GACC_L=true;
    try{var gz=await (await fetch(url)).arrayBuffer();
      var st=new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'));
      _applyGaccLex(await new Response(st).text());}catch(e){}}
  function loadLex(urls){            // urls = { vdc:url, genderRelaxed:url(.gz), speller:url(.gz), pos:url(.gz), nom:url(.gz), gacc:url(.gz) }
    if(urls&&urls.speller)loadSpellerLex(urls.speller);   // orthographe : additif, indépendant (SP.ready quand prêt)
    if(urls&&urls.nom)loadNounPost(urls.nom);             // posterior §3 du pluriel du nom (noun-post) : additif, indépendant
    if(urls&&urls.hmm)loadPosHmm(urls.hmm);               // POS-tagger HMM (pos-hmm.json.gz) : additif, indépendant
    if(urls&&urls.osLm)loadOsLm(urls.osLm);
    if(urls&&urls.prenoms)loadPrenoms(urls.prenoms);         // genre des PRÉNOMS : additif, indépendant               // LM OS-sujet (os-subj-lm.json.gz) : additif, orange accord verbe
    if(urls&&urls.gacc)loadGaccLex(urls.gacc);            // genre ACCENTUÉ complet (Morphalou) : additif, indépendant
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
  function complete(prefix,prev,prev2){
    if(!SP.ready)return [];var p=deaccS(String(prefix).toLowerCase());if(p.length<2||!isAlphaS(p))return [];
    if(_compKeys===null)_compKeys=Object.keys(SP.D2A).sort();
    var lo=0,hi=_compKeys.length,mid;while(lo<hi){mid=(lo+hi)>>1;if(_compKeys[mid]<p)lo=mid+1;else hi=mid;}
    var out=[],i=lo,k,forms,w;
    while(i<_compKeys.length&&_compKeys[i].slice(0,p.length)===p){forms=SP.D2A[_compKeys[i]];
      for(k=0;k<forms.length;k++){w=forms[k];if(deaccS(w).length>p.length&&(SP.FREQ[w]||0)>=1)out.push(w);}i++;if(out.length>800)break;}   // PLANCHER FRÉQUENCE (≥1) : l'aide-frappe ne propose que des mots courants ; sur une faute (pome) → vide → la correction prend le relais. Miroir app.
    // CLASSEMENT (miroir app) : fréquence, puis bigramme, puis CATÉGORIE et ACCORD. Le bigramme exige
    // d'avoir VU la paire exacte (nul sur les pronoms) ; la catégorie, elle, GÉNÉRALISE.
    var _pw=(prev||'').toLowerCase().replace(/[’ʼ]/g,"'");
    var _row=(typeof _OSLM!=='undefined'&&_OSLM&&_OSLM.bf&&_pw)?_OSLM.bf[_pw]:null;
    var _SUBJP={je:1,tu:1,il:1,elle:1,on:1,nous:1,vous:1,ils:1,elles:1,"j'":1,"n'":1};
    var _expV=!!_SUBJP[_pw];
    var _PERS={nous:/ons$/,vous:/ez$/,ils:/ent$/,elles:/ent$/,tu:/[sx]$/,
               je:/[esx]$/,"j'":/[esx]$/,il:/(e|t|a|d)$/,elle:/(e|t|a|d)$/,on:/(e|t|a|d)$/};
    var _pers=_PERS[_pw]||null;
    var _p2=(prev2||'').toLowerCase().replace(/[’ʼ]/g,"'");
    var _HEAD={'':1,et:1,ou:1,mais:1,donc:1,car:1,que:1,qu:1,"qu'":1,qui:1,quand:1,si:1,lorsque:1,puis:1};
    var _sure=(_pw==='nous'||_pw==='vous')?!!_HEAD[_p2]:!!_pers;
    if((_pw==='nous'||_pw==='vous')&&!_sure)_pers=null;        // clitique OBJET (« il NOUS regarde ») : aucun signal
    var _DET1={le:1,la:1,un:1,une:1,ce:1,cet:1,cette:1,mon:1,ma:1,ton:1,ta:1,son:1,sa:1,notre:1,votre:1,leur:1,"l'":1},
        _DETN={les:1,des:1,ces:1,mes:1,tes:1,ses:1,nos:1,vos:1,leurs:1,quelques:1,plusieurs:1};
    var _sg=!!_DET1[_pw],_pl=!!_DETN[_pw];
    function _realPl(w){ return /s$/.test(w)&&SP.WORDS.has(w.slice(0,-1)); }   // SP.WORDS est un Set (.has)
    function _cscore(w){ var s=Math.log(1+(SP.FREQ[w]||0));
      if(_row){ var b=_row[w]; if(b)s+=Math.log(1+b)*1.5; }
      if(_expV){ var pos=SP.POS[w]||'';
        if(pos.indexOf('V')>=0)s+=1.2;
        if(/(er|ir|re)$/.test(w))s-=1.6;                       // « je manger » : impossible
        if(_pers){ if(_pers.test(w))s+=2.2; else if(_sure)s-=1.8; }   // personne : motif NON exhaustif -> souple
      }
      if(_sg&&_realPl(w))s-=4;                                 // nombre : test par le LEXIQUE (exact) -> contrainte DURE
      else if(_pl){ if(/[sx]$/.test(w))s+=1.2;
        else if(SP.WORDS.has(w+'s'))s-=4; }
      return s; }
    out.sort(function(a,b){return _cscore(b)-_cscore(a);});
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
    posTags:posTags, setPosHmm:setPosHmm, loadPosHmm:loadPosHmm, setOsLm:setOsLm, loadOsLm:loadOsLm, setPrenoms:setPrenoms, loadPrenoms:loadPrenoms, setGaccLex:setGaccLex, loadGaccLex:loadGaccLex, osProbe:osProbe, cesProbe:cesProbe,
    toks:toks, deacc:deacc, loadLex:loadLex, setLex:setLex, isReady:function(){return _ready;}, lexSize:function(){return (SP&&SP.WORDS)?SP.WORDS.size:null;},
    vigText:vigText, loadConfusables:loadConfusables, setConfusables:setConfusables, runonText:runonText,
    udSet:udSet, udAll:udAll, udHas:udHas, udAdd:udAdd, udDel:udDel,  // dictionnaire utilisateur (content.js persiste dans chrome.storage.local)
    // phonKey EXISTAIT depuis toujours mais n'était pas exposé — la clé phonétique du speller,
    // celle qui rapproche « aveunir » de « avenir ». Exportée pour le jeu « Double-Sens », qui
    // s'en sert à l'ENVERS du correcteur : lui doit TROUVER le mot parmi 214 000 (donc FP=0 et
    // silence dans le doute) ; le jeu CONNAÎT déjà la cible et ne compare que deux mots.
    phonKey:phonKey,
    // canal TEXTE de la ponctuation (saisie vocale) — chargement EXPLICITE :
    // content.js, qui tourne sur toutes les pages, ne paie pas les 182 Ko.
    setPonctLm:setPonctLm, loadPonctLm:loadPonctLm, ponctReady:ponctReady, ponctDist:ponctDist,
    // ⭐ L'ANCRE TEMPORELLE — elle vit ICI et non dans les deux pages, pour que le site et
    // l'extension partagent LA MÊME décision par construction, pas par recopie surveillée.
    ponctSyll:ponctSyll, ponctBlocs:ponctBlocs, ponctAncre:ponctAncre,
    ponctReglesVirgule:ponctReglesVirgule,ponctInterdit:ponctInterdit,
    estQuestion:estQuestion
  };
})(typeof self!=='undefined'?self:(typeof globalThis!=='undefined'?globalThis:this));
