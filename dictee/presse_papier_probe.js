#!/usr/bin/env node
/* UN BOUTON QUI DIT « ✓ COPIÉ » SANS SAVOIR EST PIRE QU'UN BOUTON MUET.
 *
 * D'OÙ VIENT CE CHECK. En fermant la famille des `catch` vides (#455 micro, #456 actifs), les
 * boutons « Copier » se sont révélés porteurs d'une faute plus grave que le silence : ils
 * AFFIRMAIENT le succès. Deux causes qui se combinent, et la première rend la seconde invisible :
 *
 *   ① `navigator.clipboard.writeText()` rend une PROMESSE. Le `try/catch` SYNCHRONE qui
 *      l'entourait n'attrape que l'ABSENCE d'API — jamais un REFUS du navigateur (page non
 *      focalisée, permission bloquée, contexte non sécurisé). Ce rejet-là partait en promesse non
 *      gérée : le repli `execCommand` n'était même pas atteint.
 *   ② L'étiquette « ✓ Copié » était posée juste après, INCONDITIONNELLEMENT. Copie refusée ⇒ le
 *      bouton dit « copié », le presse-papier contient encore autre chose, l'utilisateur colle son
 *      texte d'AVANT. Sur OMEGA·KEY c'était une passphrase ou un message chiffré.
 *
 * CE QU'ON VÉRIFIE ICI — le mécanisme, pas l'étiquette (une étiquette, ça se renomme) :
 *   A. aucun `catch` VIDE ni `.catch(()=>{})` sur le résultat de `writeText` ;
 *   B. le résultat de `writeText` est CONSOMMÉ — `await` devant, ou `.then(`/`.catch(` derrière.
 *      Sans ça, aucun code ne peut savoir si la copie a eu lieu : la faute ② redevient possible.
 *
 * ⚠️ Toute exception s'inscrit dans `_TOLERE` AVEC SA RAISON — sinon ce check finit contourné
 * en silence, comme tous les checks qu'on peut taire.
 *
 *   node dictee/presse_papier_probe.js      # code de sortie ≠ 0 si une copie ment
 */
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.dirname(__dirname);

/* Sites tolérés VOLONTAIREMENT — la raison est obligatoire. Clé : 'fichier:extrait'. */
const _TOLERE = {};

/* `dictee/` est exclu : ce sont les harnais et les sondes (dont celle-ci, qui parle abondamment de
   `clipboard.writeText`), pas du code livré à l'utilisateur. Si un jour une PAGE y atterrit, la
   retirer de cette liste. Fichiers couverts aujourd'hui : les 5 qui écrivent dans le presse-papier
   — saisie-vocale, les deux monolithes, le panneau de l'extension, OMEGA·KEY. */
const IGNORE = new Set(['.git', 'node_modules', '.claude', 'data_local', 'dictee']);
function fichiers(dir, out) {
  out = out || [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || IGNORE.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fichiers(p, out);
    else if (/\.(html|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

const VIDE = /^(?:\s*catch\s*\([^)]*\)\s*\{\s*\}|\s*\.catch\s*\(\s*(?:function\s*\([^)]*\)|\([^)]*\)|[A-Za-z_$][\w$]*)\s*=?>?\s*\{\s*\}\s*\))/;

/* Les COMMENTAIRES parlent de `clipboard.writeText` — ce fichier-ci le fait abondamment, et les
   sources aussi depuis qu'on y documente la faute. Une sonde qui lit sa propre prose mesure la
   documentation, pas le code. On blanchit donc les commentaires en PRÉSERVANT les décalages.
   (`//` ignoré s'il suit « : » — sinon toute URL https:// masquerait la fin de sa ligne.) */
function sansCommentaires(s) {
  const t = s.split('');
  for (let k = 0; k < s.length - 1; k++) {
    if (s[k] === '/' && s[k + 1] === '*') {
      const f = s.indexOf('*/', k + 2), fin = f < 0 ? s.length : f + 2;
      for (let j = k; j < fin; j++) if (t[j] !== '\n') t[j] = ' ';
      k = fin - 1;
    } else if (s[k] === '/' && s[k + 1] === '/' && s[k - 1] !== ':') {
      let f = s.indexOf('\n', k); if (f < 0) f = s.length;
      for (let j = k; j < f; j++) t[j] = ' ';
      k = f - 1;
    }
  }
  return t.join('');
}

let echec = false, vus = 0;

for (const p of fichiers(RACINE)) {
  const rel = path.relative(RACINE, p).replace(/\\/g, '/');
  const brut = fs.readFileSync(p, 'utf8');
  const src = sansCommentaires(brut);
  let i = -1;
  while ((i = src.indexOf('clipboard.writeText', i + 1)) >= 0) {
    vus++;
    const avant = src.slice(Math.max(0, i - 40), i);
    const apres = src.slice(i, i + 320);
    const extrait = brut.slice(i, i + 60).replace(/\s+/g, ' ');
    if (_TOLERE[rel + ':' + extrait]) continue;

    // A. l'échec est-il avalé ? (on cherche un catch vide dans la foulée de l'appel)
    const fin = apres.indexOf(')') >= 0 ? apres.slice(apres.indexOf(')') + 1) : apres;
    const avale = VIDE.test(fin) || /\.catch\s*\(\s*(?:function\s*\(\s*\w*\s*\)|\(\s*\w*\s*\)|\w+)\s*=?>?\s*\{\s*\}\s*\)/.test(apres);

    // B. le résultat est-il consommé ?
    // `await navigator.clipboard.writeText(…)` : entre `await` et l'appel il y a le chemin d'objet.
    const consomme = /\bawait\s+[\w.$]*$/.test(avant) || /\.then\s*\(/.test(apres) || /\.catch\s*\(/.test(apres);

    if (avale || !consomme) {
      echec = true;
      console.log('    ✗ %s : %s', rel, extrait);
      if (avale) console.log('        l\'échec est AVALÉ (catch vide) → le bouton annoncera « copié » sans savoir');
      if (!consomme) console.log('        le résultat n\'est CONSOMMÉ nulle part (ni await, ni .then/.catch)');
    }
  }
}

console.log('  %d appel(s) à clipboard.writeText inspecté(s)', vus);
if (!vus) { console.log('    ✗ AUCUN appel trouvé — la sonde ne mesure plus rien (chemins ou nom d\'API changés ?)'); process.exit(1); }
if (echec) {
  console.log('      Attendre la promesse et n\'annoncer le succès QU\'APRÈS — ou inscrire le site');
  console.log('      dans _TOLERE avec sa raison.');
  process.exit(1);
}
console.log('  ✓ aucune copie n\'annonce un succès qu\'elle ne connaît pas');
