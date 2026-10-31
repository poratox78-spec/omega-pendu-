/* LE MOTEUR DE CALCUL EXISTE EN DEUX COPIES — elles doivent être la MÊME.
 *
 * `extension/calc_dys.js` (l'outil RAPIDE, qui donne la réponse) et `calc_dys.js` à la racine
 * (chargé par la page /calcul du site, qui montre COMMENT on l'obtient). Un fichier recopié sans
 * garde est exactement ce qui a coûté 134 diagnostics de dictée le 2026-08-25 : le portage se fait,
 * personne ne le revérifie, et les deux moteurs partent en silence.
 *
 * La sonde ne se contente PAS de comparer les octets. Elle interroge le moteur sur des entrées et
 * vérifie ses SORTIES — parce qu'une copie fidèle d'un moteur cassé reste cassée.
 *
 *     node dictee/calc_dys_probe.js      # code de sortie ≠ 0 si divergence ou régression
 */
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.dirname(__dirname);
const A = path.join(RACINE, 'calc_dys.js'), B = path.join(RACINE, 'extension', 'calc_dys.js');
const echec = [];

/* ── 1. les deux copies, octet pour octet ───────────────────────────────────────────────────── */
const oa = fs.readFileSync(A), ob = fs.readFileSync(B);
if (!oa.equals(ob)) {
  echec.push('les deux copies de calc_dys.js DIVERGENT (' + oa.length + ' vs ' + ob.length + ' octets)\n' +
             '  → copier extension/calc_dys.js vers calc_dys.js (l\'extension fait foi).');
}

/* ── 2. aucun eval : le moteur tourne dans une extension à <all_urls> ────────────────────────── */
const src = oa.toString('utf8');
if (/(^|[^\w.])eval\s*\(/.test(src) || /new\s+Function\s*\(/.test(src)) {
  echec.push('`eval` ou `new Function` dans calc_dys.js — interdit : saisie utilisateur dans une ' +
             'extension à <all_urls>, et le Store le refuserait.');
}

require(B);
const C = globalThis.CALCDYS;
if (!C) { console.log('✗ CALCDYS non exporté'); process.exit(1); }
/* un export renommé doit rendre un message, pas une pile d'appels : la sonde doit dire CE QUI
   manque, sinon celui qui la lit part chercher au mauvais endroit. */
const ATTENDUS = ['enLettres', 'groupe', 'positions', 'lire', 'calcule', 'versNombre',
                  'poseAddition', 'poseSoustraction', 'poseMultiplication', 'poseDivision', 'lireSaisie', 'positionsDecimales', 'detailSaisie'];
const absents = ATTENDUS.filter(f => typeof C[f] !== 'function');
if (absents.length) {
  console.log('✗ moteur de calcul : export(s) manquant(s) — ' + absents.join(', '));
  process.exit(1);
}

/* ── 3. aller-retour chiffres ↔ lettres. Le test le plus fort disponible, et gratuit : si
 *      `enLettres` ou `versNombre` bouge d'un cheveu, un des 20 001 nombres le dit. ───────────── */
let ko = 0, exemple = null;
for (let n = 0; n <= 20000; n++) {
  const mots = C.enLettres(n);
  if (C.versNombre(mots) !== n) { ko++; if (!exemple) exemple = n + ' → ' + JSON.stringify(mots) + ' → ' + C.versNombre(mots); }
}
for (const n of [80, 81, 91, 97, 71, 999999, 1000000, 2300000, 1234567, 1000000000]) {
  if (C.versNombre(C.enLettres(n)) !== n) { ko++; if (!exemple) exemple = String(n); }
}
if (ko) echec.push('aller-retour lettres↔chiffres : ' + ko + ' échec(s), ex. ' + exemple);

/* saisies humaines réelles, y compris les REFUS (on n'invente pas un nombre à partir d'une phrase) */
for (const [txt, att] of [['trois cent cinq', 305], ['quatre-vingt-dix-sept', 97], ['soixante et onze', 71],
                          ['mille deux cents', 1200], ['QUATRE VINGT DIX NEUF', 99], ['septante-deux', 72],
                          ['zéro', 0], ['patate', null], ['', null], ['trois cent cinq euros', null]]) {
  const r = C.versNombre(txt);
  if (r !== att) echec.push('versNombre(' + JSON.stringify(txt) + ') = ' + r + ', attendu ' + att);
}

/* ── 4. les quatre poses, vérifiées contre l'arithmétique nue ────────────────────────────────── */
let nAdd = 0, nSou = 0, nMul = 0, nDiv = 0, negatif = null;
for (let a = 0; a <= 700; a += 1) {
  for (let b = 0; b <= 700; b += 37) {
    const p = C.poseAddition(a, b);
    if (p.resultat !== a + b) echec.push('poseAddition(' + a + ',' + b + ')');
    else nAdd++;

    const m = C.poseMultiplication(a, b);
    if (m.resultat !== a * b || m.lignes.reduce((s, l) => s + l.decale, 0) !== a * b)
      echec.push('poseMultiplication(' + a + ',' + b + ')');
    else nMul++;

    if (b <= a) {
      const s = C.poseSoustraction(a, b);
      if (s.resultat !== a - b) echec.push('poseSoustraction(' + a + ',' + b + ')');
      else nSou++;
      /* ⭐ L'INVARIANT PÉDAGOGIQUE — la RETENUE ADDITIVE, celle de l'école française : la retenue
         s'ajoute au chiffre du BAS, le chiffre du HAUT n'est jamais diminué. L'autre méthode
         (retrancher en haut) fait apparaître « il reste −1 » sur 502 − 347, et un nombre négatif
         au milieu d'une soustraction de CE1 est exactement la confusion que la page existe pour
         éviter. Le négatif ne naissait PAS dans le moteur mais dans l'affichage — le tester sur
         les valeurs stockées ne l'aurait pas vu (essayé, la sonde restait verte). Ce qui distingue
         vraiment les deux méthodes, c'est cette signature-là :
             aEffectif ∈ { a, a+10 }   et   bAvecEmprunt === b + empruntEntrant                  */
      for (const c of s.colonnes) {
        const ha = c.a || 0, hb = c.b || 0;
        if (negatif) break;
        if (c.aEffectif !== ha && c.aEffectif !== ha + 10)
          negatif = a + ' − ' + b + ' : le chiffre du haut a été DIMINUÉ (' + ha + ' → ' +
                    c.aEffectif + ') — c’est la méthode qui affiche des négatifs.';
        else if (c.bAvecEmprunt !== hb + c.empruntEntrant)
          negatif = a + ' − ' + b + ' : la retenue ne se pose pas sur le chiffre du bas — ' +
                    JSON.stringify(c);
        else if (c.pose < 0 || c.aEffectif < 0 || c.bAvecEmprunt < 0)
          negatif = a + ' − ' + b + ' : valeur négative stockée — ' + JSON.stringify(c);
      }
    }
    if (b > 0) {
      const d = C.poseDivision(a, b);
      const q = Math.floor(a / b);
      const lus = d.etapes.filter(e => e.ecrit).map(e => e.chiffre).join('');
      if (d.quotient !== q || d.reste !== a - q * b || Number(lus) !== q ||
          d.quotient * d.diviseur + d.reste !== a) echec.push('poseDivision(' + a + ',' + b + ')');
      else nDiv++;
    }
  }
}
if (negatif) echec.push('méthode de soustraction : ' + negatif);

/* ── 5. les refus. Un moteur qui invente une réponse est pire qu'un moteur muet. ─────────────── */
for (const [nom, val] of [['poseSoustraction(5,9)', C.poseSoustraction(5, 9)],
                          ['poseDivision(5,0)', C.poseDivision(5, 0)],
                          ['calcule("patate")', C.calcule('patate')],
                          ['calcule("1/0")', C.calcule('1/0')]]) {
  if (val !== null) echec.push(nom + ' devrait REFUSER (null), il rend ' + JSON.stringify(val));
}

/* ── 6. la page du site n'appelle QUE ce que le moteur exporte. La leçon des assets « livrés mais
 *      jamais chargés » : un renommage passe le diff, la parité d'octets, et casse la page. ──── */
const page = fs.readFileSync(path.join(RACINE, 'calcul.html'), 'utf8');
if (!/<script src="calc_dys\.js"><\/script>/.test(page))
  echec.push('calcul.html ne charge plus calc_dys.js');
const appels = new Set();
let mm, re = /\bC\.([A-Za-z_$][\w$]*)/g;
while ((mm = re.exec(page))) appels.add(mm[1]);
for (const f of appels) if (typeof C[f] !== 'function') echec.push('calcul.html appelle C.' + f + '() — absent du moteur');

/* ── 7. L'ONGLET NOMBRES (liste n° 212) : ce que le panneau affiche pour une saisie de tous les jours.
 *      Chaque cas a été vu faux, puis réparé : « 12,5 » s'affichait « 1 2,5 », « 3x4 » était
 *      refusé, « 12+ » criait à l'erreur pendant la frappe. ──────────────────────────────────── */
const _ns = (s) => String(s).replace(/[\s\u00a0\u202f]/g, ' ');
for (const [src, g] of [['12,5', '12,5'], ['1,25', '1,25'], ['1 000,50', '1 000,50'], ['-12,5', '-12,5'], ['12,50+3,20', '15,7'],
                        ['3x4', '12'], ['3 x 4', '12'], ['3X4', '12'], ['12:4', '3'], ['12+5=', '17'], ['1000000', '1 000 000'],
                        ['trois cent cinq', '305'], ['quatre-vingt-dix-sept', '97'], ['12,', '12']]) {
  const r = C.lireSaisie(src);
  if (r.etat !== 'ok' || _ns(C.groupe(r.brut)) !== g) echec.push('saisie « ' + src + ' » : attendu ' + g + ', rendu ' + JSON.stringify(r));
}
for (const src of ['12+', '(2+3', '12*', '5-']) if (C.lireSaisie(src).etat !== 'attente') echec.push('saisie « ' + src + ' » : un calcul en cours n\'est pas une erreur');
for (const src of ['1/0', 'bonjour', '1.2.3', '12 chats']) if (C.lireSaisie(src).etat !== 'erreur') echec.push('saisie « ' + src + ' » : doit être refusée');
if (C.lireSaisie('').etat !== 'vide') echec.push('saisie vide');
{
  const pos = C.positions(-12.5);
  if (pos.map(x => x.chiffre).join('') !== '12') echec.push('positions(-12,5) : chiffres ' + pos.map(x => x.chiffre).join(''));
  if (C.positions(1)[0].nom !== 'unité' || C.positions(0)[0].nom !== 'unité' || C.positions(2)[0].nom !== 'unités') echec.push('positions : singulier de l\'unité');
  if (C.positions(10)[0].nom !== 'dizaine' || C.positions(1000000)[0].nom !== 'million') echec.push('positions : singulier des rangs');
  if (C.positions(2e15)[0].nom !== 'billiards') echec.push('positions : rang du billiard');
  const dec = C.positionsDecimales('12.05');
  if (dec.length !== 2 || dec[0].nom !== 'dixième' || dec[1].nom !== 'centièmes' || dec[1].vaut !== '0,05') echec.push('positionsDecimales(12,05) : ' + JSON.stringify(dec));
}

/* ── 8. VERSION A DE L'ONGLET (liste n° 298) : le chemin sous le résultat. Chaque valeur montrée est recalculée ici. ── */
{
  const d = (s) => C.detailSaisie(s), ns = (x) => String(x).replace(/[\s  ]/g, ' ');
  const A = d('1234 + 567');
  if (ns(A.affichage) !== '1 801' || A.etapes.join('|') !== '4 + 7 = 11 : je pose 1, je retiens 1.|3 + 6 + 1 = 10 : je pose 0, je retiens 1.|2 + 5 + 1 = 8 : je pose 8.|Il reste 1 : je le descends.') echec.push('addition posée : ' + JSON.stringify(A.etapes));
  if (A.grille.colonnes !== 4 || A.grille.lignes[0].type !== 'retenue') echec.push('addition posée : grille');
  const S = d('502 - 347');
  if (S.affichage !== '155' || S.etapes.join('|') !== '2 − 7, je ne peux pas : 12 − 7 = 5. Je retiens 1.|4 + 1 = 5. 0 − 5, je ne peux pas : 10 − 5 = 5. Je retiens 1.|3 + 1 = 4. 5 − 4 = 1.') echec.push('soustraction posée : ' + JSON.stringify(S.etapes));
  if (JSON.stringify(S).indexOf('-1') >= 0) echec.push('soustraction posée : un négatif affiché');
  const M = d('12 x 34');
  if (M.affichage !== '408' || M.etapes.join('|') !== "12 × 4 = 48.|12 × 3 = 36 ; décalé de 1 rang : 360.|J'additionne : 48 + 360 = 408.") echec.push('multiplication posée : ' + JSON.stringify(M.etapes));
  const V = d('245 : 3');
  if (ns(V.affichage) !== '81, reste 2' || V.etapes[V.etapes.length - 1] !== 'Vérification : 81 × 3 + 2 = 245.') echec.push('division posée : ' + JSON.stringify(V));
  const P = d('20 % de 150 €');
  if (P.type !== 'pourcent' || P.affichage !== '30 €' || P.lettres !== 'trente euros' || P.etapes.join('|') !== "1 % de 150 € : 150 ÷ 100 = 1,50 €.|20 %, c'est 20 fois plus : 1,50 × 20 = 30 €." || P.duo[0].valeur !== '120 €' || P.duo[1].valeur !== '180 €') echec.push('pourcentage : ' + JSON.stringify(P));
  if (d('20% de 150').affichage !== '30' || d('20 % de 150').duo[0].texte !== 'si on retire 20 %') echec.push('pourcentage sans euros');
  const E = d('3,50 € + 1,20 €');
  if (E.affichage !== '4,70 €' || E.lettres !== 'quatre euros soixante-dix' || E.etapes.join('|') !== 'Les centimes : 50 + 20 = 70.|Les euros : 3 + 1 = 4.') echec.push('euros : ' + JSON.stringify(E));
  const E2 = d('2,80 € + 1,50 €');
  if (E2.affichage !== '4,30 €' || E2.etapes[1] !== '100 centimes font 1 € : je pose 30 centimes, je retiens 1 €.') echec.push('euros, retenue : ' + JSON.stringify(E2));
  const T = d('1 h 45 + 30 min');
  if (T.affichage !== '2 h 15' || T.lettres !== 'deux heures et quinze minutes' || T.etapes.join('|') !== 'Les minutes : 45 + 30 = 75 min.|60 min font 1 h : 75 min = 1 h 15.|Les heures : 1 h + 1 h 15 = 2 h 15.') echec.push('durée : ' + JSON.stringify(T));
  if (d('1 h 05').affichage !== '1 h 05' || d('1 h').lettres !== 'une heure' || d('30 min - 1 h').etat !== 'erreur') echec.push('durée : formes simples');
  if (d('12,5').type !== 'nombre' || d('12+').etat !== 'attente' || d('').etat !== 'vide' || d('bonjour').etat !== 'erreur') echec.push('detailSaisie : mêmes états que lireSaisie');
}

if (echec.length) {
  console.log('✗ moteur de calcul :');
  echec.slice(0, 12).forEach(e => console.log('  ✗ ' + e));
  if (echec.length > 12) console.log('  … et ' + (echec.length - 12) + ' autre(s)');
  process.exit(1);
}
console.log('✓ moteur de calcul : 2 copies identiques · 20 011 allers-retours lettres↔chiffres · ' +
            nAdd + ' additions, ' + nSou + ' soustractions (0 étape négative), ' + nMul +
            ' multiplications, ' + nDiv + ' divisions · 4 refus tenus · ' + appels.size +
            ' fonctions appelées par la page, toutes présentes.');
