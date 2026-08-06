#!/usr/bin/env node
/**
 * question_bench.js — LE BANC DE LA DÉTECTION DE QUESTION, sur du français réel.
 *
 * POURQUOI. La règle en place est une LISTE DE MOTS. Mesurée sur les formes que Rem a nommées,
 * elle fait 5/10 : elle rate TOUTE l'interro-négative (« Ne viens-tu pas ? », « N'as-tu pas
 * vu ? », « ... n'est-ce pas ? ») et toute l'inversion nue (« Viens-tu demain ? »). Elle ne les
 * rate pas par manque de vocabulaire : elle les rate parce qu'UNE LISTE NE VOIT PAS UNE
 * STRUCTURE. « verbe + clitique sujet postposé » est un fait de PARTIES DU DISCOURS.
 * Or on charge déjà le tagger HMM (`pos-hmm.json.gz`) sur les deux surfaces vocales — et la
 * ponctuation ne l'appelait pas.
 *
 * CE QUE MESURE CE BANC, et pourquoi il est construit comme ça :
 *  · POSITIFS = phrases réelles finissant par « ? » ;
 *  · NÉGATIFS = phrases réelles finissant par « . » ou « ! » ;
 *  · ⭐ NÉGATIFS FRAGMENTS = morceaux pris APRÈS une virgule dans des phrases NON interrogatives.
 *    C'est le piège propre à la dictée : Google peut rendre un segment qui commence au milieu
 *    d'une phrase (« ... quelle heure il est »), et une règle ancrée sur la tête s'y trompe.
 *    On ne fragmente QUE des non-questions : le fragment d'une question serait ambigu, et un
 *    label ambigu fabrique un résultat, il ne le mesure pas.
 *
 * LA MÉTRIQUE EST ASYMÉTRIQUE, et c'est voulu : un « ? » en trop se voit et se paie, un « . »
 * à la place d'un « ? » se répare d'un caractère. On regarde donc la PRÉCISION d'abord.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const RACINE = path.join(__dirname, '..');
const D = path.join(RACINE, 'data_local');

// ⚠️ Ce banc vit sur `data_local/` (gitignoré, licences NC ou volume) : il ne tourne PAS en CI.
// Le garde-fou anti-régression, lui, est `proso_probe.js`, qui embarque ses cas en dur.
function lignesUD(f) {
  const out = [];
  if (!fs.existsSync(f)) return out;
  for (const l of fs.readFileSync(f, 'utf8').split('\n'))
    if (l.startsWith('# text = ')) out.push(l.slice(9).trim());
  return out;
}
function lignesJsonl(f, champ) {
  const out = [];
  if (!fs.existsSync(f)) return out;
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    try { const o = JSON.parse(l); const v = o[champ]; if (v) out.push(String(v).trim()); } catch (e) {}
  }
  return out;
}

function corpus() {
  let brut = [];
  brut = brut.concat(lignesUD(path.join(D, 'ud_fr_gsd-train.conllu')));
  brut = brut.concat(lignesJsonl(path.join(D, 'corpus_gec_fr.jsonl'), 'good'));
  brut = brut.concat(lignesJsonl(path.join(D, 'wicopaco_realword_sents.jsonl'), 'before'));
  brut = brut.concat(lignesJsonl(path.join(D, 'corpus_multi1000.jsonl'), 'good'));

  const vus = new Set(), cas = [];
  for (const t of brut) {
    if (t.length < 10 || t.length > 300) continue;
    if (vus.has(t)) continue;
    vus.add(t);
    const der = t.slice(-1);
    if (der === '?') cas.push({ t: t.slice(0, -1).trim(), q: true, src: 'phrase' });
    else if (der === '.' || der === '!') {
      cas.push({ t: t.slice(0, -1).trim(), q: false, src: 'phrase' });
      // ⭐ FRAGMENT : ce que Google rend quand il coupe au milieu. Négatif par construction.
      const v = t.indexOf(', ');
      if (v > 8 && t.length - v > 25)
        cas.push({ t: t.slice(v + 2, -1).trim(), q: false, src: 'fragment' });
    }
  }
  return cas;
}

/* ── LES DEUX RÈGLES, TOUTES DEUX EXTRAITES D'UN FICHIER RÉEL ────────────────────────────
   Jamais de reconstitution de mémoire : l'ancienne vient de `git show`, la nouvelle du fichier
   de travail. Si l'une des deux change, le banc change avec elle. */
function fin(s, i) { let j = s.indexOf('{', i), p = 0;
  for (let k = j; k < s.length; k++) { if (s[k] === '{') p++; else if (s[k] === '}') { p--; if (!p) return k + 1; } } }

function regleDe(src, DC) {
  function lv(n) { const m = new RegExp('\\bvar\\s+' + n + '\\s*=').exec(src);
    return m ? src.slice(m.index, src.indexOf(';', m.index) + 1) : null; }
  /* ⚠️ TOUTE VARIABLE UTILISÉE PAR `estQuestion` DOIT ÊTRE ICI. Le 2026-08-06, l'ajout de `QEUPH`
     (le « t » euphonique) n'y était pas : la fonction levait une ReferenceError, le `catch` plus
     bas la transformait en « pas une question », et le banc affichait un score INCHANGÉ pour un
     code pourtant modifié. C'est exactement la faute que la garde CI existe pour empêcher —
     mesurer autre chose que la livraison, sans le savoir. Le compteur d'exceptions ajouté en bas
     rend désormais la panne visible au lieu de la déguiser en résultat. */
  const noms = ['QW', 'CLIT', 'QINV', 'QINV_Q', 'QINCISE', 'QPAROLE', 'QADV', 'QTAG', 'QEUPH',
                'QEQ', 'QEQ2', 'QEQ3', 'QPARTPAROLE', 'QSEUL', 'QVERBAL', 'QNEG1', 'QNEG2'];
  const bouts = noms.map(lv).filter(Boolean);
  const i = src.indexOf('function estQuestion(');
  if (i < 0) throw new Error('estQuestion introuvable');
  bouts.push(src.slice(i, fin(src, i)), 'return estQuestion;');
  return new Function('DC', bouts.join('\n'))(DC);
}

module.exports = { corpus, regleDe };

/* ── EXÉCUTION ──────────────────────────────────────────────────────────────────────────── */
if (require.main === module) {
  const cas = corpus();
  const nq = cas.filter(c => c.q).length;
  console.log('banc : ' + cas.length + ' cas · ' + nq + ' questions · ' + (cas.length - nq) +
              ' non-questions (dont ' + cas.filter(c => c.src === 'fragment').length + ' fragments)');

  // le tagger, comme parity_pos.js le charge
  require(path.join(RACINE, 'extension', 'dys-core.js'));
  const DC = global.DYSCORE;
  DC.setPosHmm(JSON.parse(fs.readFileSync(path.join(RACINE, 'dictee', 'pos_hmm.json'), 'utf8')));

  const regles = [];
  /* AVANT : la dernière version de la page où la règle était encore une LISTE DE MOTS.
     ⚠️ Ma 1re version lisait `HEAD:saisie-vocale.html` — mais HEAD désigne MON PROPRE commit dès
     que la livraison est faite, et le banc affichait alors « avant = après », c'est-à-dire une
     comparaison vide qui a l'air d'un résultat. On REMONTE donc l'historique du fichier jusqu'à
     la dernière révision dont `estQuestion` n'a pas la route interro-négative (`QNEG1`) : c'est
     une définition par le CONTENU, elle survit aux merges et aux squash. */
  try {
    const shas = cp.execFileSync('git', ['log', '--format=%H', '--', 'saisie-vocale.html'],
                                 { cwd: RACINE, encoding: 'utf8', maxBuffer: 64 << 20 })
                   .split('\n').filter(Boolean);
    let av = null, sha = null;
    for (const s of shas.slice(0, 40)) {
      const src = cp.execFileSync('git', ['show', s + ':saisie-vocale.html'],
                                  { cwd: RACINE, encoding: 'utf8', maxBuffer: 64 << 20 });
      if (src.indexOf('function estQuestion(') < 0) continue;
      if (src.indexOf('QNEG1') < 0) { av = src; sha = s.slice(0, 7); break; }
    }
    if (av) regles.push(['avant ' + sha + ' (liste)', regleDe(av, DC)]);
    else console.log('(aucune révision antérieure sans QNEG1 dans les 40 dernières)');
  } catch (e) { console.log('(version d\'avant indisponible : ' + e.message + ')'); }
  regles.push(['LIVRÉE (tagger POS)',
               regleDe(fs.readFileSync(path.join(RACINE, 'saisie-vocale.html'), 'utf8'), DC)]);

  for (const [nom, f] of regles) {
    let vp = 0, fp = 0, fn = 0, nerr = 0, err1 = '';
    const exFP = [], exFN = [];
    for (const c of cas) {
      let r = false;
      /* ⚠️ ON COMPTE LES EXCEPTIONS AU LIEU DE LES DÉGUISER. Avaler l'erreur en silence rendait
         un score PLAUSIBLE pour une fonction qui ne tournait pas (variable non extraite) : on
         croyait mesurer la livraison, on mesurait « jamais une question ». */
      try { r = !!f(c.t); } catch (e) { r = false; nerr++; if (!err1) err1 = e.message; }
      if (r && c.q) vp++;
      else if (r && !c.q) { fp++; if (exFP.length < 8) exFP.push('[' + c.src + '] ' + c.t.slice(0, 82)); }
      else if (!r && c.q) { fn++; if (exFN.length < 6) exFN.push(c.t.slice(0, 82)); }
    }
    const prec = vp + fp ? 100 * vp / (vp + fp) : 100;
    const rapp = 100 * vp / nq;
    // ⚠️ Node ne gère PAS les largeurs façon printf (%-26s) : il les imprime telles quelles.
    // Ma première version affichait « %-26s précision %6.2f % (NaN/96.55) » — illisible et
    // trompeur (le NaN n'était pas un bug de calcul, juste un format non substitué).
    console.log('\n' + nom.padEnd(24) + ' précision ' + prec.toFixed(2) + ' % (' + vp + '/' + (vp + fp) +
                ')   rappel ' + rapp.toFixed(2) + ' % (' + vp + '/' + nq + ')');
    if (nerr) console.log('   ⛔ ' + nerr + ' EXCEPTION(S) — LE SCORE CI-DESSUS NE VEUT RIEN DIRE : ' + err1);
    if (exFP.length) { console.log('   FAUSSES QUESTIONS :'); exFP.forEach(x => console.log('     ' + x)); }
    if (exFN.length) { console.log('   questions ratées (échantillon) :'); exFN.forEach(x => console.log('     ' + x)); }
  }
}
