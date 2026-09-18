#!/usr/bin/env node
/* LA PAGE DU CORRECTEUR ANGLAIS — garde CI de en/correcteur-outil.html (18/09/2026).
 *
 * POURQUOI. Le 18/09 la page a repris le modèle SEMI-DIRECT du correcteur français (saisie surlignée pendant la frappe, texte
 * corrigé avec les corrections sûres déjà faites, carte appliquer / annuler / ignorer, compteur, navigation, aide-frappe,
 * barre d'outils). en_page_wiring_probe.js vérifie que les RÈGLES arrivent à la page ; rien ne vérifiait ce que la page FAIT
 * de leurs marques. Or c'est là que se logent les défauts qu'aucun banc du moteur ne voit : « with out » -> « without out »
 * (la marque couvrait deux mots, le rendu n'en remplaçait qu'un), un rendu qui modifie le texte tapé (arrivé côté français,
 * #644-648), un « aucune faute » affiché avant que le dictionnaire soit chargé (arrivé côté français, 14/09).
 *
 * MÊMES CONTRAINTES que voix_en_probe.js :
 *  ① on EXTRAIT les fonctions du fichier LIVRÉ (équilibrage d'accolades) et on les fait TOURNER avec le vrai moteur ;
 *  ② on regarde ce qu'elles PRODUISENT (texte corrigé, HTML, propositions), pas leurs constantes ;
 *  ③ les attendus viennent d'ailleurs que du code testé : phrases inventées au résultat connu, invariants (« le rendu de la
 *     saisie est le texte tapé, au caractère près »), liste indépendante de mots à ne jamais proposer.
 * ⚠️ CE QUE CETTE SONDE NE VOIT PAS : le DOM. Curseur conservé, Entrée, Ctrl+Z, carte à l'écran, 375 px — vérifiés à la main
 * dans un vrai navigateur (frappe réelle) le 18/09/2026, à refaire quand ce code-là change.
 *
 *   node dictee/correcteur_en_page_probe.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(RACINE, 'en', 'correcteur-outil.html'), 'utf8');
const moteurSrc = fs.readFileSync(path.join(__dirname, 'corrector_en.js'), 'utf8');
const C = require(path.join(__dirname, 'corrector_en.js'));
const bad = []; let nTests = 0;
const ok = (cond, msg) => { nTests++; if (!cond) bad.push(msg); };

function bloc(entete) {
  const i = src.indexOf(entete); if (i < 0) throw new Error('introuvable dans la livraison : ' + entete);
  let j = src.indexOf('{', i), p = 0;
  for (let k = j; k < src.length; k++) { if (src[k] === '{') p++; else if (src[k] === '}') { p--; if (!p) return src.slice(i, k + 1); } }
  throw new Error('accolades non fermées : ' + entete);
}
function ligneVar(nom) {
  const m = new RegExp('\\bvar\\s+' + nom + '\\s*=').exec(src); if (!m) throw new Error('introuvable dans la livraison : var ' + nom);
  const f = /;[ \t]*(?:\/\/[^\n]*)?\r?\n/.exec(src.slice(m.index));
  if (!f) throw new Error('fin de déclaration introuvable : var ' + nom);
  return src.slice(m.index, m.index + f.index + 1);
}
const code = [
  bloc('function esc('), bloc('var WHY={') + ';', bloc('var WHY_PAIR={') + ';', bloc('function whyOf('),
  ligneVar('MAX_CAR'), ligneVar('SEUIL_COMP'), ligneVar('_on'), bloc('var LABEL={') + ';',
  bloc('function cleDe('), bloc('function parDefaut('), bloc('function remplacement('), bloc('function calcule('),
  bloc('function titreDe('), bloc('function balise('), bloc('function vueSaisie('), bloc('function debutDePhrase('),
  bloc('function segments('), bloc('function texteDe('), bloc('function zonesProtegees('), bloc('function dansZone('),
  bloc('function editeSegments('), bloc('function typographie('), bloc('function vueCorrigee('), bloc('function lisibilite('),
  bloc('function compteurHtml('), bloc('function puce('), bloc('function listesHtml('), bloc('function pourquoiHtml('),
  ligneVar('_COMP_STOP'), ligneVar('_tri'), bloc('function triFreq('), bloc('function completions('),
  ligneVar('_WCH'), bloc('function motSousCurseur('),
  // harnais (pas une règle) : poser l'état que les clics posent dans la page
  'function etat(o){ _on=o.on||{}; _off=o.off||{}; _ign=o.ign||{}; _choix=o.choix||{}; _UD=o.ud||{}; _typoOff=!!o.typoOff; }',
  'function sansLexique(f){ var g=LEX; LEX=null; try{ return f(); } finally { LEX=g; } }',
].join('\n') + '\nreturn { calcule, remplacement, vueSaisie, segments, texteDe, typographie, vueCorrigee, compteurHtml, listesHtml, pourquoiHtml, completions, motSousCurseur, etat, sansLexique, LABEL, MAX_CAR };';
const A = C.loadAllNode(__dirname);
const F = new Function('C', 'LEX', 'CONFUS', 'BASEMAP', code)(C, A.lex, A.ctx.confus, A.ctx.basemap);

const nu = h => h.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const copie = S => S.map(g => ({ s: g.s, f: g.f }));
/* le texte corrigé d'une phrase, tel que la page le donne à « 📋 Copy » : corrections par défaut + ponctuation */
function corrige(text, sansTypo) { const S = F.segments(text, F.calcule(text)); if (!sansTypo) F.typographie(S); return F.texteDe(S); }

// ── ① INVARIANTS, sur des phrases fautives inventées (les cas de garde de la parité), du texte édité (PUD) et, en local, JFLEG ──
const textes = [];
for (const f of ['parity_en_cases.txt', 'parity_en_corpus.txt'])
  textes.push(...fs.readFileSync(path.join(__dirname, f), 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#')));
const nCommit = textes.length;
const JF = path.join(RACINE, 'data_local', 'en', 'jfleg', 'dev.src');
if (fs.existsSync(JF)) textes.push(...fs.readFileSync(JF, 'utf8').split(/\r?\n/).filter(Boolean));
textes.push('Tom & Jerry <b>is</b> "fun" , and its 3 < 5 alot', 'I recieve it.\nShe dont know ,and he go.\n', '  leading spaces and the the end  ');
let nMarques = 0, nMarquesCommit = 0, nTypoEdite = 0, invKo = 0;
F.etat({});
textes.forEach((t, idx) => {
  const L = F.calcule(t); nMarques += L.length; if (idx < nCommit) nMarquesCommit += L.length;
  const dit = (quoi) => { invKo++; if (invKo <= 6) bad.push('invariant « ' + quoi + ' » rompu sur : ' + t.slice(0, 90)); };
  if (nu(F.vueSaisie(t, L)) !== t) dit('le rendu de la saisie est le texte tapé, au caractère près');
  const S = F.segments(t, L);
  if (nu(F.vueCorrigee(S)) !== F.texteDe(S)) dit('le corrigé affiché est le corrigé copié');
  const S2 = copie(S), n = F.typographie(S2);
  if (nu(F.vueCorrigee(S2)) !== F.texteDe(S2)) dit('après la ponctuation, le corrigé affiché est encore le corrigé copié');
  if (C.tokenize(F.texteDe(S2)).join(' ') !== C.tokenize(F.texteDe(S)).join(' ')) dit('la ponctuation ne touche aucune lettre');
  if (F.typographie(copie(S2)) !== 0) dit('la ponctuation converge (une seconde passe ne trouve plus rien)');
  if (idx >= 92 && idx < nCommit) nTypoEdite += n;                              // PUD = texte ÉDITÉ : toute retouche y est suspecte
  // rien d'appliqué -> le corrigé EST le texte tapé
  const off = {}; L.forEach(f => { off[f.key] = 1; }); F.etat({ off: off });
  if (F.texteDe(F.segments(t, F.calcule(t))) !== t) dit('tout annulé, le corrigé est le texte tapé');
  F.etat({});
});
nTests += 6;
/* Plancher sur les textes COMMITTÉS seulement (171 marques le 18/09/2026) : le premier jet exigeait 300 marques, chiffre mesuré
   en local avec JFLEG — absent de la CI, qui a rougi. Un plancher se fonde sur ce que la CI voit. */
ok(nMarquesCommit >= 150, 'trop peu de marques sur les textes committés pour que les invariants prouvent quelque chose (' + nMarquesCommit + ')');
ok(nTypoEdite <= 2, 'la couche de ponctuation retouche du texte ÉDITÉ (PUD) : ' + nTypoEdite + ' retouches');

// ── ② CE QUE LE TEXTE CORRIGÉ DOIT ÊTRE — phrases inventées, résultat connu ──
[['She left with out a word.', 'She left without a word.', 'une marque de DEUX mots (span:2) remplace les deux'],
 ['Their is a problem and I recieve alot of mail.', 'There is a problem and I receive a lot of mail.', 'les corrections sûres sont faites, à la casse du mot tapé'],
 ['This is more better than a information.', 'This is better than information.', 'un mot en trop part avec son espace'],
 ['Hello ,how are you ? I said ,,no. Two  spaces here.', 'Hello, how are you? I said, no. Two spaces here.', 'la ponctuation s\'emboîte : il faut itérer'],
 ['Write to mailto:someone or see http://example.com/a,b and joe:smith@example.com now.', 'Write to mailto:someone or see http://example.com/a,b and joe:smith@example.com now.', 'une adresse n\'est pas de la ponctuation de phrase'],
].forEach(([t, att, quoi]) => { const vu = corrige(t); ok(vu === att, quoi + ' — « ' + t + ' » -> « ' + vu + ' » (attendu « ' + att + ' »)'); });
// l'orange n'est PAS appliqué d'office ; un clic « Apply » (l'état _on) l'applique
{ const t = 'I saw two childrens there.', L = F.calcule(t), f = L.find(x => x.word === 'childrens');
  ok(f && f.cls === 'orange' && !f.on && corrige(t) === t, 'une suggestion orange ne doit pas être appliquée d\'office : « ' + corrige(t) + ' »');
  if (f) { const on = {}; on[f.key] = 1; F.etat({ on: on }); ok(corrige(t) === 'I saw two children there.', 'orange + Apply -> appliqué : « ' + corrige(t) + ' »'); F.etat({}); } }
// annuler une correction sûre, l'ignorer, « It's a word », choisir dans une vigilance
{ const t = 'I recieve mail.', f = F.calcule(t)[0], k = {}; k[f.key] = 1;
  F.etat({ off: k }); ok(corrige(t) === t && F.calcule(t).length === 1, 'Undo : la correction reste listée mais n\'est plus faite');
  F.etat({ ign: k }); ok(F.calcule(t).length === 0, 'Ignore : la marque disparaît');
  F.etat({}); }
{ const t = 'My freind likes the blorfing game.', f = F.calcule(t).find(x => x.word === 'blorfing');
  ok(!!f && f.rule === 'spelling', 'cas de test : « blorfing » devrait être un mot inconnu souligné');
  F.etat({ ud: { blorfing: 1 } }); ok(!F.calcule(t).some(x => x.word === 'blorfing') && F.calcule(t).some(x => x.word === 'freind'), 'It\'s a word : le mot n\'est plus souligné, les autres le restent'); F.etat({}); }
{ const t = 'we saw a witch last night', f = F.calcule(t).find(x => x.word === 'witch');
  ok(!!f && f.info && !f.on && corrige(t) === t, 'vigilance : rien n\'est appliqué tant que l\'utilisateur n\'a pas choisi');
  if (f) { const ch = {}; ch[f.key] = 'which'; F.etat({ choix: ch }); ok(corrige(t) === 'we saw a which last night', 'vigilance + « Use which » -> appliqué : « ' + corrige(t) + ' »');
    ch[f.key] = 'pas-un-membre-du-groupe'; F.etat({ choix: ch }); ok(corrige(t) === t, 'un choix hors du groupe proposé ne doit rien appliquer'); F.etat({}); } }
// segments() sur des corrections FABRIQUÉES : les cas que le moteur ne produit pas à la demande
function fab(text, mot, extra) { const cs = text.indexOf(mot); return Object.assign({ cs: cs, ce: cs + mot.length, word: mot, sugg: '', cls: 'red', del: false, info: false, rule: 'spelling', key: mot + '|x', on: true, n: 0 }, extra); }
{ const t1 = 'It rained. A information is missing.';
  ok(F.texteDe(F.segments(t1, [fab(t1, 'A', { del: true })])) === 'It rained. Information is missing.', 'le mot retiré ouvrait la phrase : le suivant prend la majuscule — « ' + F.texteDe(F.segments(t1, [fab(t1, 'A', { del: true })])) + ' »');
  const t2 = 'I like the the, really.', f2 = fab(t2, 'the,', { del: true }); f2.word = 'the'; f2.ce = f2.cs + 3;
  ok(F.texteDe(F.segments(t2, [f2])) === 'I like the, really.', 'rien à retirer derrière le mot : on retire l\'espace de devant — « ' + F.texteDe(F.segments(t2, [f2])) + ' »');
  const t3 = 'so RECIEVE it';
  ok(F.texteDe(F.segments(t3, [fab(t3, 'RECIEVE', { sugg: 'receive' })])) === 'so RECEIVE it', 'un mot tout en capitales garde ses capitales');
  const t4 = 'go on the the';
  const f4 = fab(t4, 'the', { del: true }); f4.cs = 10; f4.ce = 13;
  ok(F.texteDe(F.segments(t4, [f4])) === 'go on the', 'mot retiré en fin de texte : pas d\'espace orpheline — « ' + F.texteDe(F.segments(t4, [f4])) + ' »'); }

// ── ③ LES LISTES : jamais « aucune faute » sans dictionnaire ──
{ const h0 = F.listesHtml(false, 'Their is a problem.', [], 0);
  ok(/Loading the dictionary/.test(h0) && !/No mistakes/.test(h0), 'dictionnaire pas encore chargé : la page doit le DIRE, pas annoncer « No mistakes found »');
  const propre = 'The cat sat on the mat.', L = F.calcule(propre);
  ok(L.length === 0 && /No mistakes found/.test(F.listesHtml(true, propre, L, 0)), 'texte propre : « No mistakes found »');
  ok(!/No mistakes/.test(F.listesHtml(true, propre, L, 2)) && /punctuation/.test(F.listesHtml(true, propre, L, 2)), 'des retouches de ponctuation seules : pas de « No mistakes found »');
  const long = 'word '.repeat(F.MAX_CAR / 5 + 10);
  ok(/Text too long/.test(F.listesHtml(true, long, [], 0)) && !/No mistakes/.test(F.listesHtml(true, long, [], 0)), 'texte trop long : le dire, sans « No mistakes found »');
  const t = 'Their is a problem and two childrens.', L2 = F.calcule(t), h = F.listesHtml(true, t, L2, 0);
  ok(/Applied/.test(h) && /To check/.test(h) && /Irregular plural/.test(h), 'listes « Applied » et « To check » (avec l\'étiquette de la règle)');
  ok(/1<\/b> sure/.test(F.compteurHtml(t, L2)) && /1<\/b> to check/.test(F.compteurHtml(t, L2)), 'compteur sûres / à vérifier : ' + nu(F.compteurHtml(t, L2)));
  F.etat({ ign: { 'x|y': 1 } }); ok(/ignored/.test(F.listesHtml(true, propre, [], 0)) && /restore/.test(F.listesHtml(true, propre, [], 0)), 'des ignorées : on doit pouvoir les rétablir'); F.etat({}); }

// ── ④ AIDE-FRAPPE ──
{ const c = F.completions('bec');
  ok(c[0] === 'because' && c.length <= 6 && c.indexOf('bec') < 0, 'bec -> because en tête, 6 au plus : ' + c.join(' '));
  ok(F.completions('Bec')[0] === 'Because', 'la majuscule du mot tapé est gardée');
  ok(F.completions('recie').length === 0, 'un préfixe fautif ne propose rien (la correction prend le relais) : ' + F.completions('recie').join(' '));
  ok(F.completions('abitu').length === 0, 'plancher de fréquence : « abitu » n\'a derrière lui que des mots rarissimes (abitur, abiturient : 0 occurrence dans SUBTLEX) — ne rien proposer : ' + F.completions('abitu').join(' '));
  ok(F.completions('here').length === 0, '« here » est déjà un mot courant : pas de « hereby » : ' + F.completions('here').join(' '));
  ok(F.completions('the').indexOf('there') >= 0 && F.completions('the').indexOf('they') >= 0, '« the » -> there, they… : ' + F.completions('the').join(' '));
  ok(F.completions('t').length === 0 && F.completions('').length === 0 && F.completions('3d').length === 0, 'rien sous 2 lettres ni sur autre chose que des lettres');
  ok(F.sansLexique(() => F.completions('bec')).length === 0, 'sans dictionnaire : aucune proposition (et pas d\'exception)');
  /* Liste INDÉPENDANTE de la page : des mots que SUBTLEX (sous-titres de films) donne pour très courants et qu'un outil
     d'école ne doit jamais PROPOSER. On essaie tous leurs préfixes de 2 lettres ou plus. */
  const JAMAIS = ['shit', 'fuck', 'fucking', 'bitch', 'asshole', 'ass', 'damn', 'goddamn', 'bullshit', 'bastard', 'crap', 'dick', 'pussy', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'cunt', 'cock', 'tits', 'piss', 'porn', 'sexy', 'rape', 'hell', 'retard', 'motherfucker'];
  const fuites = [];
  for (const w of JAMAIS) for (let k = 2; k < w.length; k++) { const c2 = F.completions(w.slice(0, k)); for (const x of c2) if (JAMAIS.indexOf(x) >= 0 && fuites.indexOf(x) < 0) fuites.push(x); }
  ok(fuites.length === 0, 'l\'aide-frappe PROPOSE des grossièretés : ' + fuites.join(', '));
  ok(F.completions('sh').indexOf('she') >= 0 && F.completions('as').indexOf('ask') >= 0, 'le filtre ne doit pas vider les préfixes : sh -> ' + F.completions('sh').join(' ') + ' · as -> ' + F.completions('as').join(' '));
  const m = F.motSousCurseur('I recie today', 7); ok(m.word === 'recie' && m.start === 2 && m.end === 7, 'mot sous le curseur : ' + JSON.stringify(m)); }

// ── ⑤ LA PAGE : les outils sont là, le mode d'emploi les nomme, chaque règle a son étiquette ──
for (const id of ['in', 'out', 'copy', 'prev', 'next', 'lists', 'why', 'cardpop', 'complete', 'clear', 't-theme', 't-cb', 't-lis', 'readaloud'])
  ok(new RegExp('id="' + id + '"').test(src), 'élément absent de la page : #' + id);
ok(/id="in" contenteditable="true"/.test(src), 'la zone de saisie n\'est plus un contenteditable (le surlignage vit sur le texte)');
ok(!/id="check"/.test(src), 'le bouton « Check » est revenu : la page est semi-directe');
const modeEmploi = (/<details class="tip howto">([\s\S]*?)<\/details>/.exec(src) || [])[1] || '';
for (const mot of ['card', 'apply · undo · ignore', 'why', 'Copy', '◂ ▸', 'complete', 'Tab', 'Ctrl+Z', 'Theme', 'Colour-blind', 'Readable font', 'Read aloud'])
  ok(modeEmploi.indexOf(mot) >= 0, 'le mode d\'emploi (ⓘ) ne nomme plus « ' + mot + ' » — un outil sans mode d\'emploi');
const iA = moteurSrc.indexOf('function analyzeText('), corps = moteurSrc.slice(iA, moteurSrc.indexOf('\n}\n', iA));
const regles = [...new Set([...corps.matchAll(/rule:'([a-z0-9-]+)'/g)].map(m => m[1]))];
ok(regles.length >= 18, 'règles d\'analyzeText introuvables (la garde des étiquettes serait muette)');
for (const r of regles) ok(!!F.LABEL[r], 'règle sans étiquette dans la page (la carte afficherait son nom de code) : ' + r);
for (const r of Object.keys(F.LABEL)) ok(regles.indexOf(r) >= 0, 'étiquette sans règle dans le moteur : ' + r);
// la lecture à voix haute : pas de promesse « rien ne quitte l'appareil », et l'information est dans le ⓘ (décision du 15/09/2026)
const boutonLire = (/<button id="readaloud"[^>]*>/.exec(src) || [''])[0];
ok(boutonLire.length > 0 && !/nothing leaves|stays on your device|offline|not sent|nothing is sent/i.test(boutonLire), 'le bouton « Read aloud » promet de nouveau que rien ne quitte l\'appareil : faux sans voix anglaise installée — ' + boutonLire);
ok(/online voice/.test(modeEmploi) && /Google/.test(modeEmploi), 'le ⓘ ne dit plus que la lecture peut passer par une voix en ligne');
ok(/localService/.test(src), 'la lecture ne préfère plus une voix installée sur l\'appareil');
// … et la page Confidentialité dit la même chose : l'exception de la lecture, et ce que le correcteur garde sur l'appareil
{ const conf = fs.readFileSync(path.join(RACINE, 'en', 'confidentialite.html'), 'utf8');
  ok(/id="readaloud"/.test(conf) && /may read with an online voice/.test(conf), 'en/confidentialite.html ne dit plus l\'exception de la lecture à voix haute (voix en ligne sans voix anglaise installée)');
  ok(!/that stays local too/.test(conf), 'en/confidentialite.html affirme de nouveau que la lecture à voix haute « stays local » — faux sans voix anglaise installée');
  ok(/personal dictionary/.test(conf) && /omega_en_ud/.test(src), 'le dictionnaire personnel (« It\'s a word ») est gardé sur l\'appareil : la page Confidentialité doit le dire'); }
/* semi-direct : la PREMIÈRE analyse attend les cinq actifs (arrivés ou en échec) — sinon le premier rendu est celui d'un moteur à
   moitié chargé, et un moteur d'une visite précédente (service worker « cache d'abord ») garderait des tables bâties sur du vide */
ok(/var _restants=5;/.test(src) && (src.match(/\.then\(_arrive\)/g) || []).length === 3, 'les cinq actifs ne décomptent plus tous avant la première analyse (3 chaînes .then(_arrive) attendues : les 3 JSON par _optionnel, les fautes attestées, les bases verbales)');
ok((src.match(/_optionnel\('\.\.\/dictee\//g) || []).length === 3, 'le compte des actifs optionnels a changé : ajuster _restants (et cette garde)');
ok(/function _pretMaintenant\(\)\{ if\(_pret\) return; _pret=true;[^}]*planifier\(0\); \}/.test(src), 'à l\'arrivée du dernier actif, la page ne se déclare plus prête ou ne relance plus l\'analyse');
ok(/setTimeout\(_pretMaintenant, 8000\)/.test(src), 'plus de filet : un actif qui ne répond jamais laisserait la page sur « Loading… » pour toujours');
ok(/pret=!!LEX && _pret/.test(src), 'run() analyse de nouveau avant que tous les actifs soient arrivés');

// ── ⑥ CONTRASTE des traits sur leur fond (WCAG 1.4.11, ≥ 3) — thème sombre, clair, et palette daltonien dans les deux ──
{ const css = fs.readFileSync(path.join(RACINE, 'site.css'), 'utf8');
  const fondSombre = (/:root\{[^}]*--bg-3:(#[0-9a-f]{6})/i.exec(css) || [])[1], fondClair = (/:root\[data-theme="light"\]\{[^}]*--bg-3:(#[0-9a-f]{6})/i.exec(css) || [])[1];
  ok(!!fondSombre && !!fondClair, 'fonds --bg-3 introuvables dans site.css');
  const lum = h => { const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const jeux = [['sombre', /\.card\{[^}]*\}/, fondSombre], ['clair', /:root\[data-theme="light"\] \.card\{[^}]*\}/, fondClair],
                ['sombre daltonien', /\n  \.card\.cb\{[^}]*\}/, fondSombre], ['clair daltonien', /:root\[data-theme="light"\] \.card\.cb\{[^}]*\}/, fondClair]];
  let nJetons = 0;
  for (const [nom, re, fond] of jeux) { const b = (re.exec(src) || [''])[0];
    for (const m of b.matchAll(/--c-(sur|verif|ok|vig):(#[0-9a-f]{6})/gi)) { nJetons++; const c = contraste(m[2], fond || '#000000');
      ok(c >= 3, 'contraste insuffisant : trait « ' + m[1] + ' » ' + m[2] + ' sur ' + fond + ' (' + nom + ') = ' + c.toFixed(2)); } }
  ok(nJetons === 14, 'jetons de couleur des marques introuvables (' + nJetons + '/14) : la garde du contraste serait muette'); }

console.log('PAGE DU CORRECTEUR ANGLAIS — ' + textes.length + ' textes (' + nCommit + ' committés' + (textes.length - nCommit > 3 ? ', JFLEG en local' : '') + '), ' + nMarques + ' marques, ' + nTypoEdite + ' retouche(s) de ponctuation sur le texte édité');
if (bad.length) { console.log('  ✗ ' + bad.length + ' contrôle(s) en échec sur ' + nTests + ' :'); bad.forEach(b => console.log('    – ' + b)); if (invKo > 6) console.log('    … et ' + (invKo - 6) + ' autre(s) invariant(s) rompu(s)'); process.exit(1); }
console.log('  ✓ ' + nTests + ' contrôles : le rendu ne change pas le texte tapé, le corrigé affiché est le corrigé copié, cartes et listes, aide-frappe, mode d\'emploi, étiquettes, contraste');
