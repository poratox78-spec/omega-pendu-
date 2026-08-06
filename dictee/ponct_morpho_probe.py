# -*- coding: utf-8 -*-
u"""LE POINT ET LE POINT D'INTERROGATION FACE À LA MORPHOLOGIE — la suite demandée par Rem :
« y a pas que les virgules […] si forme interrogative sujet et verbe peuvent être inversés donc
faut pousser l'étude ».

`virgule_morpho_probe.py` a mesuré la virgule (+9,94 pt, mais comme FREIN). Cette sonde-ci fait le
même travail pour les deux autres marques, et sur la population que la première avait ÉCARTÉE.

╔══ ÉTUDE 1 — LE POINT ════════════════════════════════════════════════════════════════════════╗
⚠️ PIÈGE DE CONCEPTION, ET IL AURAIT FAUSSÉ TOUT LE RÉSULTAT. Sur UD, chaque phrase est isolée :
son point FINAL ne borne rien, puisqu'il n'y a rien après. Mesurer « avec / sans point » sur des
phrases isolées aurait donné ~0 et on aurait conclu que le point ne sert à rien — alors qu'on
aurait seulement mesuré un artefact du corpus.
On RECOLLE donc K phrases consécutives en un paragraphe. C'est exactement ce que produit un dys
qui n'met pas ses points : un texte au fil de l'eau. La question devient alors la bonne — quand
deux phrases se touchent sans point, le parseur va-t-il chercher le sujet dans la phrase d'AVANT ?

╔══ ÉTUDE 2 — L'INTERROGATIF ET LE SUJET INVERSÉ ══════════════════════════════════════════════╗
⭐ C'EST LE POINT DE REM, ET MA PREMIÈRE SONDE L'AVAIT LITTÉRALEMENT JETÉ : elle écartait les
sujets POSTPOSÉS (`isj > iv`) en les disant « hors visée du parseur ». Or `_np_subject` ne remonte
que vers la GAUCHE. Devant « Les fleurs sont-elles chères ? » ou « Ainsi parlait Zarathoustra »,
le sujet est À DROITE — et le parseur, lui, va tout de même chercher à gauche. S'il TROUVE quelque
chose, il rend un sujet FAUX, et toutes les règles d'accord qui s'appuient dessus héritent de
l'erreur. C'est un faux positif silencieux, exactement ce que la doctrine FP=0 interdit.
On mesure donc : combien de sujets sont postposés · le parseur s'abstient-il ou invente-t-il ·
et le « ? » suffit-il à les repérer.

    python dictee/ponct_morpho_probe.py
"""
import os, re, sys, json, subprocess
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import correcteur_probe as C
import virgule_morpho_probe as V

TOK = V.TOK
K_COLLE = 3          # nombre de phrases recollées en un paragraphe (étude 1)


# ── PONT VERS LE MOTEUR LIVRÉ : marques TYPÉES (point vs virgule) ────────────────────────────
PONT = r"""
'use strict';
// On demande au moteur LIVRÉ ses marques AVEC LEUR TYPE. `ponctDist` rend [_, p_virgule, p_point]
// et la livraison tranche par le plus grand puis compare au seuil de son type (0,70 point /
// 0,50 virgule). On relit ces seuils dans la sonde qui les extrait du fichier publié — jamais
// codés en dur ici, sinon on mesurerait notre propre copie.
process.env.OMEGA_REGLES = '1';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const RACINE = process.cwd();
require(path.join(RACINE, 'extension', 'dys-core.js'));
const DC = global.DYSCORE;
DC.setPosHmm(JSON.parse(fs.readFileSync(path.join(RACINE, 'dictee', 'pos_hmm.json'), 'utf8')));
DC.setPonctLm(JSON.parse(zlib.gunzipSync(
  fs.readFileSync(path.join(RACINE, 'extension', 'assets', 'ponct-lm.json.gz'))).toString('utf8')));
const A = require(path.join(RACINE, 'dictee', 'virgule_alloprof_probe.js'));
const S = A.SEUILS;
let brut = '';
process.stdin.on('data', d => brut += d);
process.stdin.on('end', () => {
  const textes = JSON.parse(brut);
  const out = textes.map(t => {
    const mots = DC.toks(t) || [];
    if (mots.length < 3) return [];
    const tg = DC.posTags(mots) || [];
    const r = [];
    let dep = 0;
    for (let i = 0; i < mots.length - 1; i++) {
      const d = DC.ponctDist(mots, tg, i, dep);
      if (!d) { dep++; continue; }
      const pt = d[2] > d[1];
      if (d[1] > (pt ? S.point : S.virgule) || d[2] > (pt ? S.point : S.virgule)) {
        r.push([i, pt ? '.' : ',']); dep = 0;
      } else dep++;
    }
    return r;
  });
  fs.writeFileSync(process.argv[2], JSON.stringify(out));
});
"""


def marques_predites(textes):
    script = os.path.join(HERE, '_ponct_morpho_pont.js')
    sortie = os.path.join(HERE, '_ponct_morpho_out.json')
    with open(script, 'w', encoding='utf-8') as f: f.write(PONT)
    p = subprocess.run(['node', script, sortie], input=json.dumps(textes, ensure_ascii=False),
                       capture_output=True, text=True, encoding='utf-8', errors='replace',
                       cwd=RACINE)
    os.unlink(script)
    if p.returncode != 0 or not os.path.exists(sortie):
        raise SystemExit('pont Node en échec :\n' + (p.stderr or '')[-2000:])
    with open(sortie, encoding='utf-8') as f: r = json.load(f)
    os.unlink(sortie)
    return r


def injecte(texte, marques):
    u"""Insère les marques prédites APRÈS les mots indiqués, pour que `_seg_info` les voie."""
    if not marques: return texte
    ends = [m.end() for m in TOK.finditer(texte)]
    for (i, mk) in sorted(marques, key=lambda x: -x[0]):
        if i < len(ends): texte = texte[:ends[i]] + mk + texte[ends[i]:]
    return texte


# ══ ÉTUDE 1 — LE POINT ════════════════════════════════════════════════════════════════════════
def etude_point(brut):
    u"""Recolle K phrases, puis compare : points de l'auteur / points retirés / points re-prédits."""
    paras = []
    for k in range(0, len(brut) - K_COLLE + 1, K_COLLE):
        bloc = brut[k:k + K_COLLE]
        texte, paires, decal = '', [], 0
        for (t, ps) in bloc:
            if texte: texte += ' '
            for (iv, isj, post) in ps:
                if not post: paires.append((iv + decal, isj + decal))
            decal += len(TOK.findall(t))
            texte += t
        if paires: paras.append((texte, paires))
    # on n'étudie que les paragraphes qui contiennent VRAIMENT une frontière interne
    paras = [(t, p) for (t, p) in paras if len(re.findall(r'[.!?]', t)) >= 2]
    nus = [re.sub(r'[.!?]', '', t) for (t, _p) in paras]
    pred = marques_predites(nus)

    print(u'\n╔══ ÉTUDE 1 — LE POINT ' + u'═' * 56)
    print(u'  %d paragraphes de %d phrases UD recollées (le texte d\'un dys qui ne ponctue pas)'
          % (len(paras), K_COLLE))

    def passe(nom, fab):
        juste = repondu = total = 0
        for idx, (texte, paires) in enumerate(paras):
            T = [m.group(0) for m in TOK.finditer(texte)]
            C._SEG = C._seg_info(fab(texte, idx))
            tg = C.pos_tags(T)
            for (iv, isj) in paires:
                total += 1
                s = C._np_subject(T, tg, iv)
                if s is None: continue
                repondu += 1
                if s.get('idx') == isj: juste += 1
        print(u'  %-32s juste %6.2f %% (%d/%d)   couverture %5.2f %%'
              % (nom, 100.0 * juste / max(1, repondu), juste, repondu,
                 100.0 * repondu / max(1, total)))
        return juste, repondu, total

    a = passe(u'(A) points de l\'auteur', lambda t, i: t)
    b = passe(u'(B) points RETIRÉS', lambda t, i: re.sub(r'[.!?]', '', t))
    c = passe(u'(C) points RE-PRÉDITS', lambda t, i: injecte(nus[i], [m for m in pred[i] if m[1] == '.']))
    j = lambda r: 100.0 * r[0] / max(1, r[1])
    print(u'  ── le point fait RÉPONDRE %d fois de moins : %d fautes évitées, %d justes perdues'
          % (b[1] - a[1], (b[1] - b[0]) - (a[1] - a[0]), max(0, b[0] - a[0])))
    print(u'  ── ce que le POINT vaut (A − B) : %+.2f pt · ce que nous en rendons (C − B) : %+.2f pt'
          % (j(a) - j(b), j(c) - j(b)))
    return j(a) - j(b), j(c) - j(b)


# ══ ÉTUDE 2 — L'INTERROGATIF ET LE SUJET INVERSÉ ══════════════════════════════════════════════
def etude_interro(brut):
    print(u'\n╔══ ÉTUDE 2 — L\'INTERROGATIF ET LE SUJET INVERSÉ ' + u'═' * 31)
    n_ante = n_post = 0
    invente = abstient = 0
    q_post = q_tot = 0
    profil = Counter()
    ex = []
    for (texte, paires) in brut:
        T = [m.group(0) for m in TOK.finditer(texte)]
        if not T: continue
        C._SEG = C._seg_info(texte)
        tg = C.pos_tags(T)
        interro = texte.rstrip().endswith('?')
        if interro: q_tot += 1
        for (iv, isj, post) in paires:
            if not post: n_ante += 1; continue
            n_post += 1
            if interro: q_post += 1
            s = C._np_subject(T, tg, iv)
            if s is None: abstient += 1
            else:
                invente += 1
                profil[('?' if interro else '—')] += 1
                if len(ex) < 6:
                    ex.append(u'%s  ⟶ le parseur dit « %s », le vrai sujet est « %s »'
                              % (texte[:78], T[s['idx']], T[isj]))
    tot = n_ante + n_post
    print(u'  sujets NOM/PROPN : %d · ANTÉPOSÉS %d (%.1f %%) · POSTPOSÉS %d (%.1f %%)'
          % (tot, n_ante, 100.0*n_ante/max(1, tot), n_post, 100.0*n_post/max(1, tot)))
    print(u'  sur les POSTPOSÉS, le parseur : s\'abstient %d (%.1f %%) · INVENTE un sujet à gauche %d (%.1f %%)'
          % (abstient, 100.0*abstient/max(1, n_post), invente, 100.0*invente/max(1, n_post)))
    print(u'  ⚠️ ces %d inventions sont des FAUX POSITIFS SILENCIEUX : toute règle d\'accord' % invente)
    print(u'     qui s\'appuie sur ce sujet hérite de l\'erreur.')
    print(u'  postposés dans une phrase à « ? » : %d / %d (%.1f %%)   [phrases interrogatives : %d]'
          % (q_post, n_post, 100.0*q_post/max(1, n_post), q_tot))
    print(u'  inventions : %d en phrase « ? » · %d HORS interrogatif'
          % (profil.get('?', 0), profil.get(u'—', 0)))
    if ex:
        print(u'  exemples d\'invention :')
        for e in ex: print(u'    ' + e)
    return n_post, invente, q_post


if __name__ == '__main__':
    if not os.path.exists(V.UD):
        raise SystemExit('UD absent (data_local/) — sonde locale seulement.')
    brut = V.phrases_ud()
    print(u'LE POINT ET LE « ? » FACE À LA MORPHOLOGIE — %d phrases UD' % len(brut))
    etude_point(brut)
    etude_interro(brut)
