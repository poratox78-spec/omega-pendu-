/* SONDE RÉPÉTITION ESPACÉE (chantier ③) — extrait le bloc PUR /* SRS-PUR-DEBUT..FIN * / du monolithe
 * et vérifie les INVARIANTS du planificateur Leitner. Le bloc est pur (état entrant → état sortant,
 * `now` passé en paramètre) : ce qui se teste ici est EXACTEMENT ce qui tourne dans la page — pas une
 * copie. La glue localStorage/Date vit hors marqueurs et se vérifie au banc navigateur (comportement).
 */
'use strict';
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'omega-pendu.html'), 'utf8');
const m = html.match(/\/\* SRS-PUR-DEBUT \*\/([\s\S]*?)\/\* SRS-PUR-FIN \*\//);
if (!m) { console.log('SRS KO — marqueurs SRS-PUR absents du monolithe'); process.exit(1); }
/* eslint-disable no-eval */
(0, eval)(m[1]);   // eval INDIRECT (portée globale, hors strict) : les déclarations du bloc deviennent accessibles ici
const { _srsNext, _srsDue, _srsMotRe, _srsChoisir, _srsMaj } = globalThis;

let ko = 0;
const attend = (nom, cond) => { if (!cond) { ko++; console.log('  ✗ ' + nom); } };

/* ① transitions Leitner */
attend('échec → boîte 1 (2 min), depuis n importe où',
  _srsNext(0, false).b === 1 && _srsNext(3, false).b === 1 && _srsNext(1, false).delai === 2 * 60e3);
attend('réussites → 1j, 3j, 7j', _srsNext(1, true).b === 2 && _srsNext(1, true).delai === 24 * 3600e3
  && _srsNext(2, true).delai === 3 * 24 * 3600e3 && _srsNext(3, true).b === 4);
attend('réussite en boîte 4 → appris (null)', _srsNext(4, true) === null);

/* ② dus triés du plus ancien au plus récent, seuil respecté */
const S1 = { a: { due: 300 }, b: { due: 100 }, c: { due: 900 } };
attend('dus triés + seuil', JSON.stringify(_srsDue(S1, 500)) === '["b","a"]' && _srsDue(S1, 50).length === 0);

/* ③ frontières de mot : « porte » ≠ « porter »/« portes », l élision compte comme frontière */
attend('frontière stricte', _srsMotRe('porte').test('la porte est là') && !_srsMotRe('porte').test('il va porter')
  && !_srsMotRe('porte').test('les portes') && _srsMotRe('arbre').test("l'arbre est grand")
  && _srsMotRe('fenêtre').test('La fenêtre est ouverte.'));

/* ④ choix de phrase : mot dû le PLUS ANCIEN d abord ; null si aucune phrase ne le contient */
const pool = [{ text: 'La porte est fermée.' }, { text: 'Le chat dort.' }];
const S2 = { chat: { due: 200 }, porte: { due: 100 } };
attend('plus ancien d abord', _srsChoisir(pool, S2, 500).mot === 'porte');
attend('repli sur le suivant', _srsChoisir([{ text: 'Le chat dort.' }], S2, 500).mot === 'chat');
attend('null si introuvable', _srsChoisir([{ text: 'Rien ici.' }], S2, 500) === null);

/* ⑤ cycle complet _srsMaj : échec → b1 ; réussite implicite quand le mot dû est dans la phrase ;
      l OMISSION bloque la validation ; 4 réussites espacées → appris */
let r = _srsMaj({}, { fenêtre: 1 }, {}, 'La fenêtre est ouverte.', 1000);
attend('entrée sur substitution', r.S['fenêtre'] && r.S['fenêtre'].b === 1 && r.S['fenêtre'].due === 1000 + 2 * 60e3);
r = _srsMaj(r.S, {}, {}, 'La fenêtre est ouverte.', r.S['fenêtre'].due + 1);
attend('réussite due → boîte 2', r.S['fenêtre'].b === 2 && r.infos[0].ok === true);
r = _srsMaj(r.S, {}, { 'fenêtre': 1 }, 'La fenêtre est ouverte.', r.S['fenêtre'].due + 1);
attend('omission ≠ réussite (boîte inchangée)', r.S['fenêtre'].b === 2 && r.infos.length === 0);
r = _srsMaj(r.S, {}, {}, 'La fenêtre brille.', r.S['fenêtre'].due + 1);
r = _srsMaj(r.S, {}, {}, 'La fenêtre claque.', r.S['fenêtre'].due + 1);
r = _srsMaj(r.S, {}, {}, 'La fenêtre s\'ouvre.', r.S['fenêtre'].due + 1);
attend('4 réussites espacées → appris (retiré)', !('fenêtre' in r.S) && r.infos[0] && r.infos[0].b === 5);
r = _srsMaj({ chat: { b: 2, due: 500, vu: 1, ko: 1 } }, { chat: 1 }, {}, 'Le chat dort.', 1000);
attend('rechute → retour boîte 1', r.S.chat.b === 1);
attend('mot absent de la phrase = pas touché',
  JSON.stringify(_srsMaj({ chien: { b: 1, due: 10 } }, {}, {}, 'Le chat dort.', 100).S.chien.b) === '1');

if (ko) { console.log('SRS KO — ' + ko + ' invariant(s) cassé(s).'); process.exit(1); }
console.log('SRS OK — planificateur Leitner : transitions, tri des dus, frontières de mot, cycle complet (échec→b1, 4 réussites→appris, omission bloquante).');
