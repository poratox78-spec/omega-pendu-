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
⭐ Conjugaison 3 (12/10/2026) : le passé simple d'être et d'avoir entre aussi. Il donnait des « fut / furent » faux quand le sujet est
loin ; la carte des silences de l'accord sujet-verbe (svTaisCarte, JS) connaît désormais tous les temps d'être et d'avoir.

⭐ Conjugaison 8 (12/10/2026) : les lectures FANTÔMES retirées. Lexique range plusieurs formes sur une ligne avec un seul champ
personne / nombre : la table `f` portait des lectures que rien ne confirme — « vus » lu « voir, présent je / tu » (→ « ils on vus le
film » recevait « vus → voit » en rouge), « dit » lu futur, « j'as », « je parles », « tu suis » lu être. Une lecture est retirée quand
MORPHALOU (variantes accentuées du lemme réunies) ne donne pas cette forme pour cette case ET que la table `c` y porte une autre forme
(pas une variante y/i ni peux/puis) — Morphalou n'écrit qu'une fois une forme partagée par deux personnes (« sortais » : tu seulement),
la table seule ne suffit pas non plus. Verbes à double conjugaison (asseoir : assois / assieds…) jamais touchés.

⭐ Conjugaison 14 (13/10/2026) : la table COMPLÈTE. Rem : un verbe est un verbe, un temps est un temps — la rareté n'est pas une raison
d'exclure (elle nous a déjà coûté cher). Donc : TOUS les verbes de Morphalou entrent (5 926 → la table connaissait ceux de Lexique) ; le
passé simple à toutes les personnes et pour tous les verbes (plus de seuil de fréquence) ; le subjonctif imparfait (qu'il mangeât) et
l'impératif (mange, mangeons, mangez) entrent comme temps. Ce qui reste, et pourquoi (jamais la rareté) : une forme que le dictionnaire
du produit ne connaît pas comme VERBE n'est pas lue (« fraise » de fraser : un nom) ; quand deux verbes partagent une forme, la fréquence
DÉPARTAGE les deux lectures (« étaient » reste à être) ; l'impératif n'ajoute pas de lecture (ses formes sont celles du présent et du
subjonctif : il sert de table) ; le subjonctif imparfait n'ajoute une lecture qu'à une forme nouvelle (« fût » et « fut » ont la même clé
désaccentuée : le passé simple garde la sienne) ; deux lemmes à une seule clé désaccentuée (réformer / reformer) restent hors de la
table (la clé ne peut porter qu'un paradigme).

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
         ('conditional', 'present'): 'cnd:pre', ('subjunctive', 'present'): 'sub:pre', ('indicative', 'simplePast'): 'ind:pas',
         ('subjunctive', 'imperfect'): 'sub:imp', ('imperative', 'present'): 'imp:pre'}   # ⭐ conjugaison 14 : + subjonctif imparfait, impératif
PS_PERS = {'1s', '2s', '3s', '1p', '2p', '3p'}   # ⭐ conjugaison 14 : passé simple, toutes les personnes
PS_FMIN = 0                            # ⭐ conjugaison 14 : plus de seuil de fréquence (un verbe est un verbe)
PS_SANS = set()                        # ⭐ conjugaison 3 : être et avoir entrent (fus / fut / furent, eus / eut / eurent) — la carte des silences sait les lire
PERS = {'firstPerson': '1', 'secondPerson': '2', 'thirdPerson': '3'}
NOMB = {'singular': 's', 'plural': 'p'}
ARCH = set()                           # ⭐ conjugaison 14 : les verbes archaïques ou défectifs entrent aussi (ouïr, choir, gésir…)
VARL = set('asseoir rasseoir surseoir messeoir seoir saillir assaillir tressaillir faillir defaillir bruire frire clore eclore gesir ouir '
           'choir echoir dechoir paitre repaitre braire traire'.split())   # ⭐ conjugaison 8 : double conjugaison (assois / assieds…)
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass


def deacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


NPOST = json.load(io.open(os.path.join(HERE, 'cgram_noun_post.json'), encoding='utf-8'))   # ⭐ conjugaison 14 : P(nom), P(verbe) en ‰ par forme désaccentuée


sfq, skey = {}, {}                     # ⭐ conjugaison 14 : fréquence de chaque forme du dictionnaire, formes par clé désaccentuée
for _l in gzip.open(SPELLER, 'rt', encoding='utf-8'):
    _q = _l.rstrip('\n').split('\t')
    if len(_q) >= 2 and _q[1].isdigit():
        sfq[_q[0]] = int(_q[1]); skey.setdefault(deacc(_q[0]), []).append(_q[0])


def charger():
    spos, lfreq = {}, {}
    for l in gzip.open(SPELLER, 'rt', encoding='utf-8'):
        q = l.rstrip('\n').split('\t')
        if len(q) >= 3: spos[q[0]] = q[2]
        if len(q) >= 2 and q[1].isdigit():
            d = deacc(q[0]); lfreq[d] = max(lfreq.get(d, 0), int(q[1]))
    mor, ppl, lemmes, lem, tous = {}, set(), {}, None, {}
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
            tous.setdefault(deacc(lem), {}).setdefault(k, {}).setdefault(PERS[c[15]] + NOMB[c[11]], set()).add(deacc(form.lower()))   # conjugaison 8 : tout Morphalou, collisions comprises
            slot = mor.setdefault(deacc(lem), {}).setdefault(k, {}).setdefault(PERS[c[15]] + NOMB[c[11]], [])
            if form not in slot: slot.append(form)
    for k, v in lemmes.items():
        if len(v) > 1: mor.pop(k, None)                         # collision désaccentuée
    for k in ARCH: mor.pop(k, None)
    globals()['spos'] = spos
    return mor, ppl, spos, lfreq, tous


def completer(cj, mor, ppl, spos, lfreq):
    C, F = cj['c'], cj['f']; cases = lect = 0
    for l in mor:                                                  # ⭐ conjugaison 14 : TOUS les verbes de Morphalou
        if l not in C: C[l] = {}
    for l in [x for x in C if x in mor]:
        for k, d in mor[l].items():
            if k == 'ind:pas' and (l in PS_SANS or lfreq.get(l, 0) < PS_FMIN): continue
            if l == 'ouir' and k in ('ind:fut', 'cnd:pre'): continue   # ⭐ conjugaison 14 : « orrai, orra » (ouïr) sonnent « aurai, aura » — le dys qui écrit « orrai » veut avoir ; jamais lu
            for pn, forms in d.items():
                if k == 'ind:pas' and pn not in PS_PERS: continue
                if pn in C[l].get(k, {}): continue                 # case remplie : on n'y touche pas
                ok = []
                pres = {deacc(x.lower()) for x in C[l].get('ind:pre', {}).values()} if k == 'ind:pas' else set()
                for fo in forms:
                    if 'V' not in spos.get(fo.lower(), '') or fo.lower() in ppl: continue
                    if (NPOST.get(deacc(fo.lower())) or [0, 1000])[1] < 10: continue
                    if any(g != fo.lower() and 'V' not in spos.get(g, '') and sfq.get(g, 0) > sfq.get(fo.lower(), 0) for g in skey.get(deacc(fo.lower()), ())): continue   # ⭐ conjugaison 14 : la clé désaccentuée appartient d'abord à un mot NON verbal plus fréquent (« pâtent » de pâter → « patent », l'adjectif) — la fréquence départage deux mots écrits pareil, elle n'exclut pas un verbe   # ⭐ conjugaison 14 : forme que l'usage ne lit jamais comme VERBE (P(verbe) < 1 %, cgram_noun_post.json) — « piétons » de piéter, « habitat » d'habiter (subjonctif imparfait), « contrat » : un nom, pas une lecture verbale
                    if deacc(fo.lower()) in pres: continue   # passé simple = présent du même verbe (« dis », « finis », « finit ») : deux lectures → « nous dis » ne serait plus corrigé
                    old = F.get(deacc(fo.lower()))
                    if old is None or all(x.split(';')[0] == l or lfreq.get(x.split(';')[0], 0) < lfreq.get(l, 0) for x in old.split('|')):
                        ok.append(fo)
                if not ok: continue
                C[l].setdefault(k, {})[pn] = ok[0]; cases += 1
                if k == 'imp:pre': continue                  # ⭐ conjugaison 14 : l'impératif sert de table, ses formes sont déjà lues (présent, subjonctif)
                for fo in ok:
                    if k == 'sub:imp' and F.get(deacc(fo.lower())) is not None: continue   # « fût » / « fut » : même clé — le passé simple garde la sienne
                    key = deacc(fo.lower()); r = '%s;%s;%s;%s' % (l, k, pn[0], pn[1]); old = F.get(key)
                    if old is None: F[key] = r; lect += 1
                    elif r not in old.split('|'): F[key] = old + '|' + r; lect += 1
    return cases, lect


def fantomes(cj, tous):
    u"""⭐ Conjugaison 8 : retire de `f` les lectures que ni Morphalou ni la table `c` ne confirment (voir l'en-tête). Rend le nombre retiré."""
    C, F = cj['c'], cj['f']; n = 0
    for k in list(F):
        garde = []
        for r in F[k].split('|'):
            x = r.split(';')
            if len(x) != 4: garde.append(r); continue
            l, t, pp, nb = x
            m = (tous.get(l) or {}).get(t)
            slots = [pp + nb] if nb != 'x' else [pp + 's', pp + 'p']
            cf = [deacc(C[l][t][s_].lower()) for s_ in slots if (C.get(l) or {}).get(t, {}).get(s_)]
            if (not m or any(k in m.get(s_, ()) for s_ in slots) or not cf or k in cf or l in VARL
                    or any(f.replace('y', 'i') == k.replace('y', 'i') or {f, k} == {'peux', 'puis'} for f in cf)):
                garde.append(r)
            else: n += 1
        if len(garde) != len(F[k].split('|')):
            if garde: F[k] = '|'.join(garde)
            else: del F[k]
    return n


def remplissage(C):
    return {k: round(100.0 * sum(len(C[l].get(k, {})) for l in C) / ((3 if k == 'imp:pre' else 6) * len(C)), 1) for k in ('ind:pre', 'ind:imp', 'ind:fut', 'cnd:pre', 'sub:pre', 'ind:pas', 'sub:imp', 'imp:pre')}


def main():
    if not os.path.exists(MOR): raise SystemExit('Morphalou introuvable : ' + MOR)
    mor, ppl, spos, lfreq, tous = charger()
    for fn in ('cgram_conj.json', 'cgram_hf.json'):
        p = os.path.join(HERE, fn)
        raw = io.open(p, encoding='utf-8', newline='').read()
        d = json.loads(raw)
        if json.dumps(d, ensure_ascii=False, separators=(',', ':')) != raw:
            raise SystemExit('%s : la sérialisation ne rend pas les mêmes octets — réécrire changerait des octets qu on n a pas touchés' % fn)
        cj = d if fn == 'cgram_conj.json' else d['cj']
        avant = remplissage(cj['c'])
        cases, lect = completer(cj, mor, ppl, spos, lfreq)
        fant = fantomes(cj, tous)
        out = json.dumps(d, ensure_ascii=False, separators=(',', ':'))
        print('%-16s +%d case(s), +%d lecture(s), -%d fantôme(s) · remplissage %s → %s%s' % (fn, cases, lect, fant, avant, remplissage(cj['c']), ' (dry)' if DRY else ''))
        if out != raw and not DRY:
            io.open(p, 'w', encoding='utf-8', newline='').write(out)
    if not DRY:
        print('→ relancer : python3 dictee/inject_vdc.py && python3 extension/build_assets.py')
    return 0


if __name__ == '__main__':
    sys.exit(main())
