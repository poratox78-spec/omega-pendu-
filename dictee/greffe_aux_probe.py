# -*- coding: utf-8 -*-
u"""GREFFE juge-aval AUXILIAIRE MANQUANT — issue de la RÉFUTATION de la vigilance-perplexité
ouverte (perplex_omission_probe : trouées et intactes indistinguables à tout seuil). La forme qui
SURVIT à la réfutation : le cadre FERMÉ. Les 2 omissions réelles du corpus dys sont « manque a »
(« elle _ grandi ») ; le moteur y est MUET (vérifié). Le squelette détecte [pronom]+PARTICIPE
sans auxiliaire, fabrique le candidat avec l'auxiliaire de la personne (a/ai/as/ont… ; être pour
les verbes de mouvement), le juge B2 COMPARE — il ne produit jamais.
Bancs held-out purs (fp_scale + côtés corrigés dys — jamais vus à l'entraînement) :
  · CORRECT : cadre détecté sur texte correct → préférer le candidat = FP.
  · FAUTÉ   : phrases correctes [pronom]+AUX+participe, auxiliaire RETIRÉ → le juge doit le
              remettre (rappel) — l'inverse exact de la faute.
  · RÉEL    : les 2 omissions vraies du corpus apparié, texte brut fautes incluses.
  python dictee/greffe_aux_probe.py [modele.pt]"""
import os, sys, io, re, json

import torch
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from b2_train import CharT
import correcteur_probe as C

FP_SCALE = os.path.join(HERE, 'fp_scale_corpus.txt')
TAUS = (0.0, 0.01, 0.02, 0.04, 0.08)
AUX_AVOIR = {u'je': u'ai', u'tu': u'as', u'il': u'a', u'elle': u'a', u'on': u'a',
             u'nous': u'avons', u'vous': u'avez', u'ils': u'ont', u'elles': u'ont'}
AUX_ETRE = {u'je': u'suis', u'tu': u'es', u'il': u'est', u'elle': u'est', u'on': u'est',
            u'nous': u'sommes', u'vous': u'êtes', u'ils': u'sont', u'elles': u'sont'}
PRON = u'|'.join(AUX_AVOIR)
RX_SANS = re.compile(u"\\b(" + PRON + u") ([a-zà-ÿ]{3,}(?:ées|ée|és|é|ies|ie|is|i|ues|ue|us|u))\\b", re.I)
RX_AVEC = re.compile(u"\\b(" + PRON + u") (a|ai|as|ont|avons|avez|est|sont|suis|es|sommes|êtes) ([a-zà-ÿ]{3,}(?:ées|ée|és|é|ies|ie|is|i|ues|ue|us|u))\\b", re.I)

def est_ppl(w):
    return C._is_ppl(w)

def aux_pour(pron, part):
    d = C.deacc(part.lower())
    etre = d in C.AUX_ETRE_PP or d.rstrip(u's').rstrip(u'e') in C.AUX_ETRE_PP
    return (AUX_ETRE if etre else AUX_AVOIR)[pron.lower()]

def cas_sans(s):
    u"""cadre écrit « pronom + participe » (aux absent) → (écrit, candidat) ou None."""
    mm = RX_SANS.search(s)
    if not mm or not est_ppl(mm.group(2)): return None
    try: aux = aux_pour(mm.group(1), mm.group(2))
    except KeyError: return None
    cand = s[:mm.end(1)] + u' ' + aux + s[mm.end(1):]
    return s, cand, mm.group(1), mm.group(2)

def cas_avec(s):
    u"""cadre correct « pronom + aux + participe » → (fauté sans aux, candidat=original)."""
    mm = RX_AVEC.search(s)
    if not mm or not est_ppl(mm.group(3)): return None
    faute = s[:mm.end(1)] + s[mm.end(2):]          # retire « aux » (l'espace pronom-aux part avec)
    return faute, s, mm.group(1), mm.group(3)

def main():
    fmod = sys.argv[1] if len(sys.argv) > 1 else 'b2_model_14m.pt'
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    ck = torch.load(os.path.join(ROOT, 'data_local', fmod), map_location='cpu', weights_only=False)
    chars = ck['chars']; v2i = {c: i for i, c in enumerate(chars)}
    CTX = ck['cfg']['CTX']
    m = CharT(len(chars), ck['cfg']).to(dev); m.load_state_dict(ck['model']); m.eval()

    def score(s):
        ids = [v2i.get(c, 0) for c in s][:CTX]
        if len(ids) < 3: return -99.0
        t = torch.tensor([ids], device=dev)
        with torch.no_grad():
            lp = F.log_softmax(m(t)[0, :-1].float(), -1)
            return lp.gather(1, t[0, 1:, None]).mean().item()

    held = [l.strip() for l in io.open(FP_SCALE, encoding='utf-8') if l.strip()]
    for fn in ('faiblesses.jsonl', 'dictees_gold.jsonl'):
        p = os.path.join(ROOT, 'data_local', 'dys_reel', fn)
        if os.path.exists(p):
            for l in io.open(p, encoding='utf-8'):
                if l.strip(): held.append(json.loads(l).get('fixed', ''))
    held = [s.replace(u'’', u"'") for s in held if s]

    fp_cas = [c for c in (cas_sans(s) for s in held) if c]
    rc_cas = [c for c in (cas_avec(s) for s in held) if c]
    print(u'held-out %d phrases · cadres CORRECT %d · FAUTÉ %d' % (len(held), len(fp_cas), len(rc_cas)))

    d_fp = [(score(c[1]) - score(c[0]), c) for c in fp_cas]
    d_rc = [(score(c[1]) - score(c[0]), c) for c in rc_cas]
    print(u'\n  τ      FP (candidat préféré sur correct)   rappel (aux remis)')
    for tau in TAUS:
        nfp = sum(1 for d, _ in d_fp if d > tau)
        nrc = sum(1 for d, _ in d_rc if d > tau)
        print(u'  %.2f   %3d/%3d (%5.1f %%)                  %3d/%3d (%5.1f %%)'
              % (tau, nfp, len(d_fp), 100.0 * nfp / max(len(d_fp), 1),
                 nrc, len(d_rc), 100.0 * nrc / max(len(d_rc), 1)))
    print(u'\n── FP à τ=0.02 (le juge insérerait un aux sur du correct) ──')
    for d, c in sorted(d_fp, key=lambda x: -x[0])[:6]:
        if d > 0.02: print(u'  Δ=%+.3f  %s+%s · « %s »' % (d, c[2], c[3], c[0][:75]))
    print(u'── ratés de rappel à τ=0.02 ──')
    for d, c in sorted(d_rc, key=lambda x: x[0])[:6]:
        if d <= 0.02: print(u'  Δ=%+.3f  %s+%s · « %s »' % (d, c[2], c[3], c[0][:75]))

    # ── RÉEL : les omissions du corpus dys (texte brut) ──
    reels = [u"j'aimais beaucoup ma gran mère, c'était une femme cultivé et bien veillante, toujours de bonne humeur. Elle grandi pendant la guerre",
             u"elle a grandi pendant la gerre . elle sais marier a l'age de vingt ans"]
    for r in reels:
        c = cas_sans(r)
        if c:
            d = score(c[1]) - score(c[0])
            print(u'\nRÉEL : Δ=%+.3f → %s · « %s »' % (d, u'l aux est remis ✓' if d > 0.02 else u'RATE ✗', c[1][:90]))
        else:
            print(u'\nRÉEL : cadre non détecté · « %s »' % r[:70])

if __name__ == '__main__':
    main()
