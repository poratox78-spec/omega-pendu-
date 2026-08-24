# -*- coding: utf-8 -*-
# b2_compress_probe.py — ENTRAÎNER = COMPRESSER : le modèle B2 comprime-t-il le lexique
# mieux qu'un compresseur classique, et l'écriture PHONÉTIQUE est-elle plus compressible
# que l'orthographe ?
#
# Pourquoi c'est la bonne question : l'entropie croisée d'un modèle de langue EST une taille
# compressée (−log2 p = bits). On a donc deux bouts comparables — un compresseur (gzip) et un
# modèle (B2, char-transformer 14,45 M) — sur EXACTEMENT le même contenu.
#
# ⚠️ MÉTRIQUE = BITS PAR MOT, pas bits/caractère. Comparer des bits/caractère entre orthographe
# et phonétique serait FAUX : les chaînes phonétiques sont plus courtes et n'ont pas le même
# alphabet. Seul « combien de bits pour coder CES mots-là » est comparable.
#
# ⚠️ CONTAMINATION ASSUMÉE : B2 est entraîné sur du français, donc ces mots sont dans son
# entraînement. Le chiffre ortho est un PLAFOND optimiste. Le point du banc n'est pas le
# niveau absolu mais l'ÉCART ortho/phono et l'écart B2/gzip.
#
# Lancer : python3 dictee/b2_compress_probe.py [n_mots]
import os, sys, io, json, gzip, math, random

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
DATA = os.environ.get('OMEGA_DATA', os.path.join(ROOT, 'data_local'))


def paires(n, seed=1):
    """(mot, phono SAMPA) depuis l'index homophones — mêmes mots des deux côtés."""
    p = os.path.join(HERE, 'phono_homophones.json')
    if not os.path.exists(p):
        print('  phono_homophones.json absent — banc ignoré.'); return []
    idx = json.load(io.open(p, encoding='utf-8'))
    out = []
    for phon, mots in idx.items():
        if not phon or not mots: continue
        for m in (mots if isinstance(mots, list) else [mots]):
            if isinstance(m, str) and m.isalpha() and 2 <= len(m) <= 14:
                out.append((m.lower(), phon))
    out.sort()
    random.Random(seed).shuffle(out)
    return out[:n]


def bits_gzip(txt):
    return len(gzip.compress(txt.encode('utf-8'), 9)) * 8


def bits_brut(txt, alpha):
    return len(txt) * math.log2(max(2, alpha))


def bits_b2(txt, ck, dev):
    """−Σ log2 p(c_t | c_<t), par fenêtres de CTX. Le 1er caractère de chaque fenêtre est
    facturé log2(V) (il n'a pas de contexte) : surcoût négligeable et HONNÊTE."""
    import torch, torch.nn.functional as F
    from b2_train import CharT
    chars = ck['chars']; V = len(chars)
    i2 = {c: i for i, c in enumerate(chars)}
    ids = [i2[c] for c in txt if c in i2]
    hors = len(txt) - len(ids)
    m = CharT(V, ck['cfg']).to(dev); m.load_state_dict(ck['model']); m.eval()
    CTX = ck['cfg']['CTX']
    tot = 0.0
    with torch.no_grad():
        for a in range(0, len(ids), CTX):
            w = ids[a:a + CTX]
            if len(w) < 2: 
                tot += math.log2(V) * len(w); continue
            t = torch.tensor([w], device=dev)
            lg = m(t)[0, :-1]
            lp = F.log_softmax(lg.float(), -1)
            tot += -(lp.gather(1, t[0, 1:, None]).sum().item()) / math.log(2)
            tot += math.log2(V)                      # 1er caractère de la fenêtre
    return tot, hors, len(ids)


def main(n=4000):
    import torch
    ck_p = None
    for f in ('b2_model_14m_cu.pt', 'b2_model_14m.pt', 'b2_model.pt'):
        q = os.path.join(DATA, f)
        if os.path.exists(q): ck_p = q; break
    if ck_p is None:
        print('  modèle B2 absent de %s — banc ignoré.' % DATA); return 0
    pr = paires(n)
    if not pr: return 0
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    ck = torch.load(ck_p, map_location='cpu', weights_only=False)

    print('ENTRAÎNER = COMPRESSER — %d mots, modèle %s (%s)' % (len(pr), os.path.basename(ck_p), dev))
    print('  métrique = BITS PAR MOT pour coder LES MÊMES mots (pas bits/caractère).\n')
    res = {}
    # SEPARATEUR = ESPACE, jamais un saut de ligne : le vocabulaire de B2 (278 caracteres,
    # appris sur du francais) ne contient PAS le caractere de saut de ligne. Une 1re version
    # joignait les mots par un saut de ligne -> les 3 999 separateurs etaient hors-vocabulaire,
    # donc SUPPRIMES : le modele voyait un seul bloc de mots colles, sans frontieres, ce qui
    # gonflait ses bits et le faisait paraitre nul (52,2 bits/mot = le codage brut).
    # L'INSTRUMENT, pas le modele.
    for nom, txt in (('ORTHOGRAPHE', ' '.join(m for m, _ in pr)),
                     ('PHONÉTIQUE (SAMPA)', ' '.join(p for _, p in pr))):
        alpha = len(set(txt))
        b2, hors, nid = bits_b2(txt, ck, dev)
        r = {'car': len(txt), 'brut': bits_brut(txt, alpha), 'gzip': bits_gzip(txt), 'b2': b2, 'hors': hors}
        res[nom] = r
        N = len(pr)
        print('  %s  (%d caractères, %.1f/mot%s)' % (nom, r['car'], r['car'] / N,
              '' if not hors else ', %d hors-vocabulaire IGNORÉS' % hors))
        print('     brut (log2 alphabet) : %7.1f bits/mot' % (r['brut'] / N))
        print('     gzip -9              : %7.1f bits/mot   (×%.2f)' % (r['gzip'] / N, r['brut'] / r['gzip']))
        print('     B2 (14,45 M)         : %7.1f bits/mot   (×%.2f)   %s' % (
              r['b2'] / N, r['brut'] / r['b2'],
              'B2 GAGNE ×%.2f sur gzip' % (r['gzip'] / r['b2']) if r['b2'] < r['gzip'] else
              'gzip gagne ×%.2f' % (r['b2'] / r['gzip'])))
        print()
    o, p = res['ORTHOGRAPHE'], res['PHONÉTIQUE (SAMPA)']
    N = len(pr)
    print('  ── ORTHO vs PHONO, à contenu identique ──')
    print('     gzip : phono %.1f contre ortho %.1f bits/mot  → phono %s (%.0f %%)' % (
          p['gzip'] / N, o['gzip'] / N,
          'MOINS cher' if p['gzip'] < o['gzip'] else 'PLUS cher',
          abs(100.0 * (p['gzip'] - o['gzip']) / o['gzip'])))
    print('     B2   : phono %.1f contre ortho %.1f bits/mot  → phono %s (%.0f %%)' % (
          p['b2'] / N, o['b2'] / N,
          'MOINS cher' if p['b2'] < o['b2'] else 'PLUS cher',
          abs(100.0 * (p['b2'] - o['b2']) / o['b2'])))
    print()
    # ── L'ÉCART ORTHO/PHONO N'EST PAS QUE DE LA REDONDANCE : LA PHONO PERD DE L'INFORMATION ──
    # La forme sonore FUSIONNE les homophones (« ver/vers/vert/verre »). Elle est donc moins
    # chère en partie parce qu'elle en DIT MOINS, pas seulement parce qu'elle est plus régulière.
    # Le coût de cette perte est mesurable : log2(taille du groupe d'homophones) bits par mot —
    # c'est exactement ce qu'il faudrait re-payer pour remonter à la bonne graphie.
    idx = json.load(io.open(os.path.join(HERE, 'phono_homophones.json'), encoding='utf-8'))
    perdu = 0.0
    for m, ph in pr:
        g = idx.get(ph) or []
        perdu += math.log2(max(1, len(g) if isinstance(g, list) else 1))
    ecart = (o['gzip'] - p['gzip']) / N
    print('  ── mais la PHONO PERD de l information (elle fusionne les homophones) ──')
    print('     ecart gzip ortho-phono ...................... %5.2f bits/mot' % ecart)
    print('     dont INFORMATION PERDUE (log2 homophones) ... %5.2f bits/mot  (%.0f %% de l ecart)'
          % (perdu / N, 100.0 * (perdu / N) / max(1e-9, ecart)))
    print('     => REDONDANCE reellement retiree ............ %5.2f bits/mot  (%.0f %%)'
          % (ecart - perdu / N, 100.0 * (ecart - perdu / N) / max(1e-9, ecart)))
    print('     Lecture : ce que l ORTHOGRAPHE francaise depense EN PLUS du son, et qui n est pas')
    print('     recuperable par la phonetique seule. C est le cout que paie un scripteur dys.')
    print()
    # ── CONTRÔLE : le vrai régime d'un modèle de langue, c'est le TEXTE SUIVI ──
    # Une liste de mots en ordre aléatoire est le PIRE cas pour B2 (aucun contexte de phrase) et
    # le MEILLEUR cas pour gzip (redondance de sous-chaînes entre mots). Sans ce contrôle, on
    # conclurait à tort que « B2 ne sait presque rien ».
    # fp_scale_corpus est du VRAI HELD-OUT : `b2_data.py` l'exclut explicitement de
    # l'entrainement (« Held-out EXCLUS : les phrases de fp_scale »). Le chiffre ci-dessous
    # n'est donc pas de la memorisation. La LISTE DE MOTS, elle, n'est pas held-out (les mots
    # du lexique sont dans le corpus d'entrainement) : son chiffre ortho est OPTIMISTE.
    fp = os.path.join(HERE, 'fp_scale_corpus.txt')
    if os.path.exists(fp):
        phr = [l.strip() for l in io.open(fp, encoding='utf-8') if l.strip()][:400]
        t = ' '.join(phr)
        gb, bb = bits_gzip(t), bits_b2(t, ck, dev)[0]
        print('  ── CONTROLE sur TEXTE SUIVI (400 phrases UD French, %d caracteres) ──' % len(t))
        print('     gzip -9    : %5.2f bits/caractere' % (gb / len(t)))
        print('     B2         : %5.2f bits/caractere   %s' % (bb / len(t),
              'B2 GAGNE x%.2f' % (gb / bb) if bb < gb else 'gzip gagne x%.2f' % (bb / gb)))
        print('     (rappel liste de mots : B2 %.2f b/c contre gzip %.2f b/c)'
              % (o['b2'] / o['car'], o['gzip'] / o['car']))
        print()
    print('  ⚠️ B2 est entraîné sur du français ORTHOGRAPHIQUE : le SAMPA lui est HORS DISTRIBUTION.')
    print('     Son chiffre phono mesure cela, pas la compressibilité intrinsèque du phonétique —')
    print('     c est la ligne GZIP qui répond à « le phonétique est-il plus régulier ? ».')
    return 0


if __name__ == '__main__':
    sys.exit(main(int(sys.argv[1]) if len(sys.argv) > 1 else 4000))
