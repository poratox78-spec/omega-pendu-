/* La LISTE du bot de modération (08/10/2026) — écrite à la main, à relire et à compléter par le streamer.
 *
 * Les mots sont écrits SANS accent, en minuscules : le détecteur ramène chaque message à cette forme (et démasque les
 * chiffres, les lettres espacées, les lettres doublées, les sons) avant de comparer. Familles :
 *   haine    : insultes racistes, homophobes, sexistes, validistes — la priorité de la modération ;
 *   menace   : appels à la violence ou au suicide ;
 *   insulte  : insultes qui visent une personne ;
 *   leger    : moqueries courantes (idiot, nul, noob…) — ÉTEINTES par défaut, le streamer décide ;
 *   juron    : jurons (merde, putain…) — IGNORÉS par défaut : tous les chats jurent, ce n'est pas viser quelqu'un.
 * « seul: false » : un mot qui a aussi un sens innocent (con ↔ qu'on, pédale de vélo, raton laveur, autiste…) n'est
 * signalé que dans une tournure qui vise quelqu'un (« t'es … », « sale … », « espèce de … », « gros … »).
 * Les EXPRESSIONS (plusieurs mots) sont comparées sur le message entier, ramené à la même forme.
 */
var LISTE_INSULTES = {
  mots: {
    // haine — racisme
    negre: 'haine', negresse: 'haine', negro: 'haine', bougnoule: 'haine', bougnoul: 'haine', bicot: 'haine',
    youpin: 'haine', youpine: 'haine', youtre: 'haine', chinetoque: 'haine', niakoue: 'haine', bamboula: 'haine',
    melon: ['haine', false], raton: ['haine', false], bride: ['haine', false], crouille: 'haine', crouillat: 'haine',
    // relues une par une en juillet 2026 pour l'argot d'OMEGA (dictee/build_argot_lex.py, DROP_GLOSS) : le Wiktionnaire
    // ne les marque PAS comme injures — « nèg », le mépris racialisé « zoulette », le validisme « coto », « débilos », « gneugneu »
    neg: 'haine', zoulette: 'haine', coto: 'haine', debilos: 'haine', gneugneu: 'haine',
    // haine — homophobie, transphobie
    pede: 'haine', pd: 'haine', tarlouze: 'haine', tantouze: 'haine', tafiole: 'haine', gouine: 'haine',
    travelo: 'haine', tapette: ['haine', false], pedale: ['haine', false], fiotte: 'haine',
    // haine — validisme
    gogol: 'haine', mongol: ['haine', false], triso: 'haine', trisomique: ['haine', false], attarde: ['haine', false],
    autiste: ['haine', false], handicape: ['haine', false],
    // insultes
    connard: 'insulte', connards: 'insulte', connasse: 'insulte', conasse: 'insulte', conard: 'insulte', conne: ['insulte', false],
    con: ['insulte', false], salope: 'insulte', salopes: 'insulte', salop: 'insulte', salaud: 'insulte', salauds: 'insulte',
    enfoire: 'insulte', enfoiree: 'insulte', encule: 'insulte', enculee: 'insulte', enculer: 'insulte', batard: 'insulte',
    batarde: 'insulte', pute: 'insulte', putes: 'insulte', petasse: 'insulte', pouffiasse: 'insulte', grognasse: 'insulte',
    abruti: 'insulte', abrutie: 'insulte', debile: ['insulte', false], cretin: 'insulte', cretine: 'insulte',
    imbecile: 'insulte', couillon: 'insulte', ducon: 'insulte', trouduc: 'insulte', branleur: 'insulte', branleuse: 'insulte',
    merdeux: 'insulte', merdeuse: 'insulte', raclure: 'insulte', ordure: ['insulte', false], pourriture: ['insulte', false],
    cassos: 'insulte', fdp: 'insulte', ntm: 'insulte', nique: ['insulte', false], niquer: ['insulte', false],
    ptn: 'juron', tg: 'leger', gueule: ['insulte', false],
    // moqueries (éteintes par défaut)
    idiot: ['leger', false], idiote: ['leger', false], nul: ['leger', false], nulle: ['leger', false], noob: ['leger', false],
    bouffon: ['leger', false], clown: ['leger', false], boloss: 'leger', bolosse: 'leger', teube: 'leger',
    // jurons (ignorés par défaut)
    merde: 'juron', putain: 'juron', bordel: 'juron', chier: 'juron', foutre: 'juron', zut: 'juron',
  },
  expressions: {
    'fils de pute': 'insulte', 'fille de pute': 'insulte', 'trou du cul': 'insulte', 'nique ta mere': 'insulte',
    'ta gueule': 'insulte', 'ferme ta gueule': 'insulte', 'va te faire foutre': 'insulte', 'va te faire enculer': 'insulte',
    'sous merde': 'insulte', 'sale arabe': 'haine', 'sale noir': 'haine', 'sale juif': 'haine', 'sale chinois': 'haine',
    'sale noire': 'haine', 'sale juive': 'haine', 'sale gay': 'haine', 'sale gouine': 'haine', 'sale pede': 'haine',
    'suicide toi': 'menace', 'suicides toi': 'menace', 'va te suicider': 'menace', 'va mourir': 'menace',
    'je vais te tuer': 'menace', 'je vais te buter': 'menace', 'je vais te retrouver': 'menace', 'kys': 'menace',
    'kill yourself': 'menace', 'va crever': 'menace', 'tu vas crever': 'menace', 'je sais ou tu habites': 'menace',
  },
  // ce qui, juste AVANT un mot, montre qu'il vise quelqu'un (pour les mots « seul: false »)
  visent: ['t es', 'tes', 'tu es', 't es un', 't es une', 'tes un', 'tes une', 'tu es un', 'tu es une', 'sale', 'sales',
    'espece de', 'especes de', 'gros', 'grosse', 'pauvre', 'bande de', 'vous etes', 'vous etes des', 'ta gueule',
    'ferme la', 'toi le', 'toi la', 'c est qu un', 'c est qu une', 'quel gros', 'quelle grosse'],
  // volontairement ABSENTS : « un », « une », « les », « ce »… — « une pédale de vélo », « les autistes ont droit à… »
};
if (typeof module !== 'undefined') module.exports = LISTE_INSULTES;
