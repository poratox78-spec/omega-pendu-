# -*- coding: utf-8 -*-
u"""CE QUE VAUT LA VIRGULE POUR LA MORPHOLOGIE — la mesure que demandait l'intuition de Rem :
« ponctuation et orthographe sont liés ».

⚠️ VÉRIFIÉ AVANT DE CONSTRUIRE, et ça a déplacé la question. Le parseur de sujet `_np_subject`
BORNE DÉJÀ sa remontée aux frontières `_SEG['bb']`, et `_seg_info` met une frontière sur `[,;:()]`.
Le lien ponctuation→morphologie n'est donc PAS à construire : il est livré depuis longtemps. Ce
qui n'est pas mesuré, c'est ce qu'il COÛTE quand la virgule MANQUE — et c'est précisément le cas
d'un dys, qui sous-ponctue. D'où les trois conditions ci-dessous.

CE QU'ON MESURE, ET POURQUOI C'EST PROPRE. Une virgule n'est PAS un token pour `TOK` (lettres
seulement) : retirer les virgules du texte ne change NI les tokens, NI les étiquettes du tagger.
La SEULE chose qui bouge est le tableau de frontières. L'expérience isole donc exactement ce que
la virgule apporte comme signal morphologique, sans rien d'autre qui varie.

  (A) texte tel qu'écrit          — les virgules de l'auteur (état actuel, plafond de référence)
  (B) virgules RETIRÉES           — ce que voit le correcteur devant un texte dys non ponctué
  (C) virgules RE-PRÉDITES        — modèle `ponctDist` + les 5 règles d'Allô prof (PR#399)

  (A) − (B) = ce que la virgule VAUT.        (C) − (B) = ce que notre prédiction en REND.
  Si (A) − (B) est nul, l'intuition est fausse et il faut le dire.
  Si (C) − (B) est nul alors que (A) − (B) ne l'est pas, la piste est juste mais notre
  prédicteur n'est pas assez bon — et on saura QUE c'est lui le mur, pas l'idée.

VÉRITÉ TERRAIN : les dépendances d'UD (`nsubj`), pas notre propre jugement. On ne garde que les
verbes dont le sujet gold est un NOM ou un NOM PROPRE — c'est le seul terrain de `_np_subject`
(il s'abstient sur les pronoms, qui sont traités ailleurs).

    python dictee/virgule_morpho_probe.py
"""
import os, re, sys, json, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import correcteur_probe as C

UD = os.path.join(RACINE, 'data_local', 'ud_fr_gsd-train.conllu')
TOK = re.compile(r"[A-Za-zÀ-ÿœŒ'’\-]+")


def phrases_ud(limite=None):
    u"""Rend (texte, [(indice_verbe, indice_sujet_gold)]) — indices dans NOTRE tokenisation.

    ⚠️ LE POINT DÉLICAT : UD tokenise autrement que nous (« du » = « de » + « le », l'élision est
    séparée). On ne peut donc pas apparier par numéro de token. On réaligne par POSITION DE
    CARACTÈRE : chaque token UD porte sa forme, on avance dans le texte, et on note quel token À
    NOUS le contient. Un appariement approximatif ici fabriquerait de fausses erreurs et on
    conclurait sur du bruit.
    """
    out = []
    bloc = []
    with open(UD, encoding='utf-8') as f:
        for ligne in f:
            ligne = ligne.rstrip('\n')
            if not ligne.strip():
                if bloc:
                    r = _une_phrase(bloc)
                    if r: out.append(r)
                    bloc = []
                    if limite and len(out) >= limite: break
                continue
            if ligne.startswith('#'):
                if ligne.startswith('# text = '): bloc.append(('TEXTE', ligne[9:].strip()))
                continue
            ch = ligne.split('\t')
            if len(ch) < 8 or '-' in ch[0] or '.' in ch[0]: continue
            bloc.append((int(ch[0]), ch[1], ch[3], int(ch[6]) if ch[6].isdigit() else 0, ch[7]))
    if bloc:
        r = _une_phrase(bloc)
        if r: out.append(r)
    return out


def _une_phrase(bloc):
    texte = None
    toks = []
    for e in bloc:
        if e[0] == 'TEXTE': texte = e[1]
        else: toks.append(e)
    if not texte or not toks: return None
    # position caractère de chaque token UD dans le texte, en avançant sans revenir en arrière
    pos, curseur = {}, 0
    for (i, forme, upos, tete, rel) in toks:
        p = texte.find(forme, curseur)
        if p < 0: return None            # désynchronisation → on jette la phrase, on n'invente pas
        pos[i] = p
        curseur = p + len(forme)
    # nos tokens, avec leur intervalle de caractères
    nos = [(m.start(), m.end()) for m in TOK.finditer(texte)]
    def notre_index(p):
        for k, (a, b) in enumerate(nos):
            if a <= p < b: return k
        return None
    paires = []
    for (i, forme, upos, tete, rel) in toks:
        if rel != 'nsubj' or upos not in ('NOUN', 'PROPN'): continue
        if tete not in pos: continue
        iv, isj = notre_index(pos[tete]), notre_index(pos[i])
        if iv is None or isj is None or isj == iv: continue
        # ⚠️ ON GARDE LE SUJET POSTPOSÉ, marqué. Il est hors visée de `_np_subject` (qui ne remonte
        # que vers la GAUCHE), mais c'est justement la population que gouverne l'interrogatif :
        # « Les fleurs sont-elles chères ? », « Ainsi parlait Zarathoustra ». Les jeter, c'était
        # cacher le cas où le parseur va chercher un sujet À GAUCHE alors qu'il est À DROITE.
        # Voir dictee/ponct_morpho_probe.py, qui mesure exactement ça.
        paires.append((iv, isj, isj > iv))
    if not paires: return None
    return (texte, paires)


# ── LES TROIS CONDITIONS ──────────────────────────────────────────────────────────────────────
def sans_virgules(texte):
    return texte.replace(',', '')


_PREDITES = None
def virgules_predites(textes):
    u"""Appelle le MOTEUR LIVRÉ (modèle `ponctDist` + les 5 règles d'Allô prof), via Node, sur le
    texte SANS ses virgules. On ne réimplémente rien : c'est la sonde `virgule_alloprof_probe.js`
    qui exporte `moteurVirgule`, celui-là même qui tourne dans la saisie vocale."""
    global _PREDITES
    if _PREDITES is not None: return _PREDITES
    script = os.path.join(HERE, '_virgule_morpho_pont.js')
    with open(script, 'w', encoding='utf-8') as f:
        f.write(PONT)
    # ⚠️ PAS PAR STDOUT : `virgule_alloprof_probe.js` est une SONDE, elle journalise son propre
    # audit au chargement — le stdout n'est donc pas du JSON pur. On passe par un fichier.
    sortie = os.path.join(HERE, '_virgule_morpho_out.json')
    entree = json.dumps(textes, ensure_ascii=False)
    p = subprocess.run(['node', script, sortie], input=entree, capture_output=True, text=True,
                       encoding='utf-8', errors='replace', cwd=RACINE)
    os.unlink(script)
    if p.returncode != 0 or not os.path.exists(sortie):
        raise SystemExit('pont Node en échec :\n' + (p.stderr or '')[-2000:])
    with open(sortie, encoding='utf-8') as f: _PREDITES = json.load(f)
    os.unlink(sortie)
    return _PREDITES


PONT = r"""
'use strict';
// Pont : on fait tourner LE MOTEUR LIVRÉ (modèle + règles) et on rend, pour chaque phrase, les
// indices de mot APRÈS lesquels il pose une virgule. Aucune réimplémentation.
process.env.OMEGA_REGLES = '1';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const RACINE = process.cwd();
require(path.join(RACINE, 'extension', 'dys-core.js'));
const DC = global.DYSCORE;
DC.setPosHmm(JSON.parse(fs.readFileSync(path.join(RACINE, 'dictee', 'pos_hmm.json'), 'utf8')));
DC.setPonctLm(JSON.parse(zlib.gunzipSync(
  fs.readFileSync(path.join(RACINE, 'extension', 'assets', 'ponct-lm.json.gz'))).toString('utf8')));
const { moteurVirgule } = require(path.join(RACINE, 'dictee', 'virgule_alloprof_probe.js'));
let brut = '';
process.stdin.on('data', d => brut += d);
process.stdin.on('end', () => {
  const textes = JSON.parse(brut);
  const out = textes.map(t => {
    const mots = DC.toks(t) || [];
    if (mots.length < 3) return [];
    try { return Array.from(moteurVirgule(mots)).sort((a, b) => a - b); } catch (e) { return []; }
  });
  fs.writeFileSync(process.argv[2], JSON.stringify(out));
});
"""


def frontieres(texte, indices_virgule=None):
    u"""Construit le `_SEG` que verra le parseur. `indices_virgule` = indices de MOT après lesquels
    on INJECTE une virgule (condition C) ; None = on prend le texte tel quel."""
    if indices_virgule:
        mots = list(TOK.finditer(texte))
        coupes = sorted({mots[i].end() for i in indices_virgule if i < len(mots)}, reverse=True)
        for c in coupes: texte = texte[:c] + ',' + texte[c:]
    return C._seg_info(texte)


def mesure(cas, nom, seg_de):
    juste = repondu = total = 0
    for (texte, paires, pred) in cas:
        T = [m.group(0) for m in TOK.finditer(texte)]
        if not T: continue
        C._SEG = seg_de(texte, pred)
        tg = C.pos_tags(T)
        for (iv, isj) in [(a,b) for (a,b,post) in paires if not post]:
            total += 1
            s = C._np_subject(T, tg, iv)
            if s is None: continue
            repondu += 1
            if s.get('idx') == isj: juste += 1
    print(u'  %-34s juste %6.2f %% (%d/%d)   couverture %5.2f %% (%d/%d)'
          % (nom, 100.0 * juste / max(1, repondu), juste, repondu,
             100.0 * repondu / max(1, total), repondu, total))
    return juste, repondu, total


if __name__ == '__main__':
    if not os.path.exists(UD):
        raise SystemExit('UD absent (data_local/ud_fr_gsd-train.conllu) — sonde locale seulement.')
    brut = phrases_ud()
    # On ne garde que les phrases QUI ONT une virgule : ailleurs les trois conditions sont
    # identiques par construction et diluent la mesure jusqu'à la rendre illisible.
    brut = [(t, p) for (t, p) in brut if ',' in t]
    textes_nus = [sans_virgules(t) for (t, p) in brut]
    print(u'CE QUE VAUT LA VIRGULE POUR LE PARSEUR DE SUJET')
    print(u'  %d phrases UD à virgule · vérité terrain = dépendances nsubj (NOM/PROPN)\n' % len(brut))
    pred = virgules_predites(textes_nus)
    cas = [(t, p, pr) for (t, p), pr in zip(brut, pred)]

    a = mesure([(t, p, None) for (t, p, _) in cas], u'(A) virgules de l\'auteur',
               lambda t, _: frontieres(t))
    b = mesure(cas, u'(B) virgules RETIRÉES',
               lambda t, _: frontieres(sans_virgules(t)))
    c = mesure(cas, u'(C) virgules RE-PRÉDITES',
               lambda t, pr: frontieres(sans_virgules(t), pr))

    # ── (D) L'ORACLE AU MÊME RAPPEL QUE NOUS. C'est la condition qui dit CE QU'IL FAUT LEVER.
    # On prend les virgules DE L'AUTEUR (donc toutes justes) mais on n'en garde qu'une sur 8, soit
    # 12,5 % — le rappel mesuré de notre moteur (12,80 %). Sélection déterministe, jamais aléatoire.
    #   · si (D) ≈ (C) : nos virgules valent des virgules justes prises au hasard. Le seul levier
    #     est le RAPPEL — en trouver PLUS, peu importe lesquelles.
    #   · si (D) ≫ (C) : à rappel égal, l'auteur fait bien mieux. Nous trouvons donc les MAUVAISES
    #     — les faciles, celles qui ne bornent rien. Le levier est alors QUELLES virgules viser.
    def echantillon(texte, _):
        nu = sans_virgules(texte)
        idx, n = [], 0
        for i, m in enumerate(TOK.finditer(texte)):
            if texte[m.end():m.end() + 1] == ',':
                n += 1
                if n % 8 == 1: idx.append(i)
        return frontieres(nu, idx)
    d = mesure(cas, u'(D) ORACLE au MÊME rappel (1/8)', echantillon)

    # ── (E) QUELLES VIRGULES PORTENT ? La condition (D) dit que le levier est « lesquelles », pas
    # « combien ». On les identifie par ABLATION : on retire UNE virgule de l'auteur, et si une
    # décision de sujet passe de JUSTE à FAUSSE (ou à une abstention perdue), cette virgule-là
    # PORTAIT. On regarde ensuite à quoi elles ressemblent — et surtout combien NOUS en trouvons.
    portantes, inertes = [], []
    for (texte, paires, _pred) in cas:
        T = [m.group(0) for m in TOK.finditer(texte)]
        if not T: continue
        virg = [i for i, m in enumerate(TOK.finditer(texte))
                if texte[m.end():m.end() + 1] == ',']
        if not virg: continue
        tous = [i for i in virg]
        C._SEG = frontieres(sans_virgules(texte), tous)
        tg = C.pos_tags(T)
        ref = {}
        for (iv, isj) in [(a,b) for (a,b,post) in paires if not post]:
            s = C._np_subject(T, tg, iv)
            ref[iv] = (s.get('idx') if s else None)
        for v in virg:
            C._SEG = frontieres(sans_virgules(texte), [i for i in tous if i != v])
            porte = False
            for (iv, isj) in [(a,b) for (a,b,post) in paires if not post]:
                s = C._np_subject(T, tg, iv)
                apres = (s.get('idx') if s else None)
                # elle portait si sa présence donnait le BON sujet et son absence ne le donne plus
                if ref.get(iv) == isj and apres != isj: porte = True
            fiche = (T[v].lower(), T[v + 1].lower() if v + 1 < len(T) else '∅',
                     tg[v] if v < len(tg) else '?', tg[v + 1] if v + 1 < len(tg) else '?')
            (portantes if porte else inertes).append((texte, v, fiche))

    par_texte = {t: set(pr or []) for (t, _p, pr) in cas}
    trouvees = sum(1 for (texte, v, _f) in portantes if v in par_texte.get(texte, ()))
    trouv_in = sum(1 for (texte, v, _f) in inertes if v in par_texte.get(texte, ()))
    print(u'\n  ── (E) QUELLES VIRGULES PORTENT ? (ablation, une par une) ───────────────')
    print(u'  virgules de l\'auteur : %d · PORTANTES %d (%.1f %%) · inertes %d'
          % (len(portantes) + len(inertes), len(portantes),
             100.0 * len(portantes) / max(1, len(portantes) + len(inertes)), len(inertes)))
    print(u'  notre moteur en trouve : %d / %d PORTANTES (%.1f %%)  ·  %d / %d inertes (%.1f %%)'
          % (trouvees, len(portantes), 100.0 * trouvees / max(1, len(portantes)),
             trouv_in, len(inertes), 100.0 * trouv_in / max(1, len(inertes))))
    from collections import Counter
    cpos = Counter((f[2], f[3]) for (_t, _v, f) in portantes)
    cmot = Counter(f[1] for (_t, _v, f) in portantes)
    print(u'  profil POS (avant→après) : ' + ' · '.join('%s→%s %d' % (a, b, n)
          for (a, b), n in cpos.most_common(6)))
    print(u'  mot qui SUIT la virgule  : ' + ' · '.join('%s %d' % (m, n)
          for m, n in cmot.most_common(10)))

    print(u'\n  ── LECTURE ─────────────────────────────────────────────────────────────')
    j = lambda r: 100.0 * r[0] / max(1, r[1])
    dA, dC, dD = j(a) - j(b), j(c) - j(b), j(d) - j(b)
    # ⚠️⚠️ DÉCOMPOSER AVANT DE CONCLURE. Un gain de justesse peut venir de DEUX choses très
    # différentes : répondre MIEUX, ou répondre MOINS. Ici c'est presque tout du second — et ça
    # change ce qu'on doit en faire.
    print(u'  la virgule fait RÉPONDRE %d fois de moins : %d fautes évitées, %d justes perdues'
          % (b[1] - a[1], (b[1] - b[0]) - (a[1] - a[0]), max(0, b[0] - a[0])))
    print(u'  ⇒ la virgule est un FREIN, pas un accélérateur : elle n\'aide pas à TROUVER le')
    print(u'    sujet, elle empêche le parseur d\'en INVENTER un. Sous doctrine FP=0, c\'est')
    print(u'    exactement la monnaie qui compte.')
    print(u'  ce que la virgule VAUT        (A − B) : %+.2f pt de justesse' % dA)
    print(u'  ce que notre prédiction REND  (C − B) : %+.2f pt   =  %.0f %% du gain possible'
          % (dC, 100.0 * dC / dA if dA else 0))
    print(u'  ce qu\'un ORACLE au même rappel rendrait : %+.2f pt' % dD)
    if abs(dA) < 0.05:
        print(u'  ⇒ la virgule N\'APPORTE RIEN au parseur de sujet. L\'intuition est REFUSÉE par')
        print(u'    la mesure, et il faut le dire plutôt que de construire dessus.')
    elif dC < 0.25 * dA:
        print(u'  ⇒ L\'INTUITION EST CONFIRMÉE ET CHIFFRÉE : la virgule vaut %.1f pt au parseur.' % dA)
        print(u'    Mais notre moteur n\'en rend que %.0f %%. LE MUR EST LE PRÉDICTEUR.' % (100.0*dC/dA))
        if dD > 1.6 * dC:
            print(u'    Et l\'oracle au MÊME rappel rend %.1f× plus : nous ne trouvons pas les' % (dD/max(0.01, dC)))
            print(u'    virgules QUI BORNENT. Le levier est LESQUELLES viser, pas COMBIEN.')
        else:
            print(u'    À rappel égal l\'oracle ne fait pas mieux : nos virgules sont bonnes, il')
            print(u'    en manque simplement. Le levier est le RAPPEL (12,80 %% aujourd\'hui).')
    else:
        print(u'  ⇒ la chaîne TIENT : prédire la virgule rend une part réelle du gain.')
        print(u'    Reste à mesurer le PRIX (faux positifs) avant toute livraison.')
