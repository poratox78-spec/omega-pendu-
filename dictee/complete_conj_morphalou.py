# -*- coding: utf-8 -*-
u"""La table de conjugaison des RÈGLES complétée par Morphalou 3.1 — présent, imparfait, futur, conditionnel, subjonctif, passé simple (12/10/2026).

Constat (question de Rem : « on en est où de la conjugaison ? ») : le dictionnaire d'orthographe (~711 000 formes) est enrichi au
Wiktionnaire et à Morphalou, mais la table qui dit quelle forme va avec quel sujet (cgram_conj.json, référence Python ; cgram_hf.json,
embarquée app → extension) vient de Lexique 4 SEUL : elle ne garde que les formes rencontrées dans des textes. Remplie à 42,6 %
(présent 94,5 · imparfait 42,5 · futur 41,2 · conditionnel 28,8) ; le moteur, rustines de chargement comprises, ne reconnaissait que
41,3 % des formes Morphalou de ses propres verbes. Une case vide fait taire la règle : « nous expliquerait » restait sans
« expliquerions ».

Ce script REMPLIT LES CASES VIDES des verbes déjà connus, aux quatre temps mesurés sans fausse alerte (3 corpus dys : 0 écart ; UD
14 450 : 0). Il ne modifie JAMAIS une case remplie. Gardes, chacune vue en mesurant :
  · la forme est attestée VERBE au dictionnaire du produit (POS V de extension/assets/speller.tsv.gz) et n'est pas un participe passé ;
  · lemmes désaccentués en COLLISION écartés (réformer / reformer, pécher / pêcher : une seule clé, deux paradigmes) ;
  · verbes archaïques ou défectifs écartés (ouïr : « orrai » → « orront ») ;
  · une forme déjà lue pour un AUTRE verbe ne reçoit la nouvelle lecture que si ce verbe est plus fréquent (« saurons » : savoir passe
    devant saurer ; « étaient » reste à être, jamais à étayer).
⭐ Conjugaison 2 (12/10/2026) : + subjonctif présent et passé simple. Ils réveillaient des lectures douteuses — gardes posées DANS la
règle de la personne (sujFlexVig ≡ rule_sujet_flexion : majuscule au milieu de la phrase, subjonctif seul sans « que », participe ou
passé simple je / tu derrière un sujet nominal, « nous / vous » complément devant un sujet inversé) — et ici, pour le passé simple :
seulement je / il / ils (« tu mangeas », « nous mangeâmes », « vous mangeâtes » sont rares à l'écrit et tombaient sur des noms propres :
« Duras », « Carras »), et seulement pour un verbe courant (fréquence du dictionnaire ≥ 1 000 : « houa », houer, dehors).
Le passé simple d'être et d'avoir (fut, furent, eut) reste dehors : il donne des « fut / furent » faux quand le sujet est loin.

Sources hors dépôt : data_local/morphalou/Morphalou3.1_CSV.csv (ATILF/CNRS, LGPL-LR — voir donnees.html). Sérialisation identique à
build_cgram.py (compact, ensure_ascii=False), aller-retour vérifié octet à octet avant d'écrire. Idempotent.
    python3 dictee/complete_conj_morphalou.py [--dry]
    → puis : python3 dictee/inject_vdc.py && python3 extension/build_assets.py
"""
import gzip, io, json, os, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MOR = os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv')
SPELLER = os.path.join(ROOT, 'extension', 'assets', 'speller.tsv.gz')
DRY = '--dry' in sys.argv
TEMPS = {('indicative', 'present'): 'ind:pre', ('indicative', 'imperfect'): 'ind:imp', ('indicative', 'future'): 'ind:fut',
         ('conditional', 'present'): 'cnd:pre', ('subjunctive', 'present'): 'sub:pre', ('indicative', 'simplePast'): 'ind:pas'}
PS_PERS = {'1s', '3s', '3p'}          # passé simple : je, il, ils
PS_FMIN = 1000                         # passé simple : verbe courant (fréquence du dictionnaire du produit)
PS_SANS = {'etre', 'avoir'}            # fut, furent, eut : chantier suivant
PERS = {'firstPerson': '1', 'secondPerson': '2', 'thirdPerson': '3'}
NOMB = {'singular': 's', 'plural': 'p'}
ARCH = set('ouir choir echoir dechoir gesir chaloir occire issir seoir messeoir poindre querir ester ferir accroire'.split())
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass


def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def charger():
    spos, lfreq = {}, {}
    for l in gzip.open(SPELLER, 'rt', encoding='utf-8'):
        q = l.rstrip('\n').split('\t')
        if len(q) >= 3: spos[q[0]] = q[2]
        if len(q) >= 2 and q[1].isdigit():
            d = deacc(q[0]); lfreq[d] = max(lfreq.get(d, 0), int(q[1]))
    mor, ppl, lemmes, lem = {}, set(), {}, None
    with io.open(MOR, encoding='utf-8') as f:
        for l in f:
            c = l.rstrip('\n').split(';')
            if len(c) < 16: continue
            if c[0]:
                lem = c[0].lower() if c[2] == 'Verbe' else None
                if lem: lemmes.setdefault(deacc(lem), set()).add(lem)
            if lem is None or ' ' in lem or "'" in lem: continue
            form = c[9].strip()
            if c[12] == 'participle' and c[14] == 'past': ppl.add(form.lower())
            k = TEMPS.get((c[12], c[14]))
            if not k or c[15] not in PERS or c[11] not in NOMB or not form or ' ' in form: continue
            slot = mor.setdefault(deacc(lem), {}).setdefault(k, {}).setdefault(PERS[c[15]] + NOMB[c[11]], [])
            if form not in slot: slot.append(form)
    for k, v in lemmes.items():
        if len(v) > 1: mor.pop(k, None)                         # collision désaccentuée
    for k in ARCH: mor.pop(k, None)
    return mor, ppl, spos, lfreq


def completer(cj, mor, ppl, spos, lfreq):
    C, F = cj['c'], cj['f']; cases = lect = 0
    for l in [x for x in C if x in mor]:
        for k, d in mor[l].items():
            if k == 'ind:pas' and (l in PS_SANS or lfreq.get(l, 0) < PS_FMIN): continue
            for pn, forms in d.items():
                if k == 'ind:pas' and pn not in PS_PERS: continue
                if pn in C[l].get(k, {}): continue                 # case remplie : on n'y touche pas
                ok = []
                for fo in forms:
                    if 'V' not in spos.get(fo.lower(), '') or fo.lower() in ppl: continue
                    old = F.get(deacc(fo.lower()))
                    if old is None or all(x.split(';')[0] == l or lfreq.get(x.split(';')[0], 0) < lfreq.get(l, 0) for x in old.split('|')):
                        ok.append(fo)
                if not ok: continue
                C[l].setdefault(k, {})[pn] = ok[0]; cases += 1
                for fo in ok:
                    key = deacc(fo.lower()); r = '%s;%s;%s;%s' % (l, k, pn[0], pn[1]); old = F.get(key)
                    if old is None: F[key] = r; lect += 1
                    elif r not in old.split('|'): F[key] = old + '|' + r; lect += 1
    return cases, lect


def remplissage(C):
    return {k: round(100.0 * sum(len(C[l].get(k, {})) for l in C) / (6 * len(C)), 1) for k in ('ind:pre', 'ind:imp', 'ind:fut', 'cnd:pre', 'sub:pre', 'ind:pas')}


def main():
    if not os.path.exists(MOR): raise SystemExit('Morphalou introuvable : ' + MOR)
    mor, ppl, spos, lfreq = charger()
    for fn in ('cgram_conj.json', 'cgram_hf.json'):
        p = os.path.join(HERE, fn)
        raw = io.open(p, encoding='utf-8', newline='').read()
        d = json.loads(raw)
        if json.dumps(d, ensure_ascii=False, separators=(',', ':')) != raw:
            raise SystemExit('%s : la sérialisation ne rend pas les mêmes octets — réécrire changerait des octets qu on n a pas touchés' % fn)
        cj = d if fn == 'cgram_conj.json' else d['cj']
        avant = remplissage(cj['c'])
        cases, lect = completer(cj, mor, ppl, spos, lfreq)
        out = json.dumps(d, ensure_ascii=False, separators=(',', ':'))
        print('%-16s +%d case(s), +%d lecture(s) · remplissage %s → %s%s' % (fn, cases, lect, avant, remplissage(cj['c']), ' (dry)' if DRY else ''))
        if out != raw and not DRY:
            io.open(p, 'w', encoding='utf-8', newline='').write(out)
    if not DRY:
        print('→ relancer : python3 dictee/inject_vdc.py && python3 extension/build_assets.py')
    return 0


if __name__ == '__main__':
    sys.exit(main())
