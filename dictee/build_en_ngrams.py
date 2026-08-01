# -*- coding: utf-8 -*-
# N-grammes ORTHO (caractères) et PHON (phonèmes IPA) de l'anglais, depuis lex_en.tsv.
# But : phonotactique/graphotactique EN (orthographe profonde) -> scorer les candidats du
# speller, canal phonétique (dys écrit ce qu'il entend), pendu (fréquence des séquences).
#   ORTHO : surfaces lettres pures, marqueurs de bord ^…$, bi+trigrammes de caractères.
#   PHON  : IPA segmentée en phonèmes (stress/longueur retirés, affriquées t͡ʃ gardées entières),
#           marqueurs de bord, bi+trigrammes de phonèmes.
# Pondération : TYPE (chaque mot 1×) par défaut ; --freq <tsv:mot\tf> pour pondérer par fréquence.
# Sorties : ngrams_ortho_en.json.gz, ngrams_phon_en.json.gz
#   { "n1":{sym:count}, "n2":{"a b":count}, "n3":{"a b c":count}, "phonemes":[...], "meta":{...} }
#   Lancer : PYTHONUTF8=1 python dictee/build_en_ngrams.py dictee/lex_en.tsv dictee
import sys, io, os, json, gzip, unicodedata, collections

LEX = sys.argv[1]
OUTDIR = sys.argv[2] if len(sys.argv) > 2 else 'dictee'
# pondération : TYPE par défaut (chaque mot 1×, phonotactique robuste) ; --freq lit la colonne
# freq (SUBTLEX) de lex_en.tsv (token, meilleur pour scorer la plausibilité d'un candidat).
USE_FREQ = '--freq' in sys.argv

BOUND = '^'; END = '$'
# suprasegmentaux / marques à retirer de l'IPA
STRIP = set("ˈˌ.ˑ|‖/[]() ​'ʼ‿-")
LONG = 'ː'      # longueur -> on la colle au phonème précédent (voyelle longue distincte)
TIES = '͜͡'   # ͡ ͜ tie bars d'affriquée

def _bare(x): return ''.join(c for c in x if unicodedata.category(c) != 'Mn' and c != LONG)
# vrais phonèmes anglais écrits en 2 symboles (Wiktionary n'y met pas toujours le tie bar) :
# diphtongues + affriquées -> fusionnées en une unité (comparaison sur symbole dé-longé/dé-diacritisé).
MERGE2 = {('a','ɪ'),('a','ʊ'),('ɔ','ɪ'),('o','ʊ'),('e','ɪ'),  # diphtongues GA (FACE/PRICE/CHOICE/GOAT/MOUTH)
          ('ə','ɹ'),('ə','r'),                                # schwa rhotique -> ɚ (butter, doctor)
          ('t','ʃ'),('d','ʒ')}                                # affriquées

def seg_ipa(s):
    """IPA -> liste de phonèmes. Combinants/longueur collés à la base ; tie bar fusionne la base
    suivante ; diphtongues/affriquées 2-symboles fusionnées (inventaire anglais)."""
    out = []; cur = ''; merge_next = False
    for ch in s:
        if ch in STRIP:
            if cur: out.append(cur); cur = ''
            merge_next = False
            continue
        cat = unicodedata.category(ch)
        if ch in TIES:
            cur += ch; merge_next = True; continue
        if cat == 'Mn' or ch == LONG:      # diacritique/nasalisation/longueur -> colle
            cur += ch; continue
        # base
        if cur == '':
            cur = ch
        elif merge_next:
            cur += ch; merge_next = False
        else:
            out.append(cur); cur = ch
    if cur: out.append(cur)
    # passe de fusion : diphtongues/affriquées 2-symboles -> une unité
    merged = []; i = 0
    while i < len(out):
        if i + 1 < len(out) and (_bare(out[i]), _bare(out[i+1])) in MERGE2:
            merged.append(out[i] + out[i+1]); i += 2
        else:
            merged.append(out[i]); i += 1
    return merged

# --- inventaire phonémique anglais canonique (~40, General-American) ---
# Wiktionary/CMU mélangent dialectes, allophones (t̪ d̚), marques de ton, modificateurs et fuites
# d'enPR (ā ē). On normalise chaque phonème vers l'inventaire GA (strip diacritiques + variantes).
EN_PHON = {'i','ɪ','ɛ','æ','ɑ','ɔ','ʊ','u','ʌ','ə','ɚ',            # monophtongues
           'eɪ','aɪ','ɔɪ','oʊ','aʊ',                              # diphtongues
           'p','b','t','d','k','ɡ','tʃ','dʒ','f','v','θ','ð',      # consonnes
           's','z','ʃ','ʒ','h','m','n','ŋ','l','ɹ','j','w'}
NORM = {'əɹ':'ɚ','ər':'ɚ','ɝ':'ɚ','ɜ':'ɚ','ɾ':'t','ʔ':'t','ɫ':'l','g':'ɡ','r':'ɹ',
        'ɒ':'ɑ','ä':'ɑ','ɐ':'ʌ','ɘ':'ə','ɵ':'oʊ','o':'oʊ','e':'ɛ','ɨ':'ɪ','ᵻ':'ɪ',
        'ʉ':'u','ʍ':'w','ʋ':'v','ç':'h','ɦ':'h','x':'k','q':'k','ʈ':'t','ɖ':'d','y':'i',
        'ø':'ə','ā':'eɪ','ē':'i','ī':'aɪ','ō':'oʊ','ū':'u','ɵ̈':'oʊ','ɪ̈':'ɪ','ʲ':None,
        'əʊ':'oʊ','ɪə':'ɪ','ɛə':'ɛ','ʊə':'ʊ'}
def _canon(p):
    # strip marques combinantes (Mn), modificateurs (Lm/Sk), longueur, ton, tilde
    b = ''.join(c for c in p if unicodedata.category(c) not in ('Mn','Lm','Sk') and c not in "ː:~ˑ")
    if not b: return None
    if b in EN_PHON: return b
    if b in NORM: return NORM[b]
    return None       # symbole hors-inventaire -> ignoré (mot compté sur le reste)

def add_ngrams(seq, w1, w2, w3, weight):
    toks = [BOUND] + seq + [END]
    for x in toks:
        w1[x] += weight
    for i in range(len(toks)-1):
        w2['%s %s' % (toks[i], toks[i+1])] += weight
    for i in range(len(toks)-2):
        w3['%s %s %s' % (toks[i], toks[i+1], toks[i+2])] += weight

def deacc(s):
    s = s.replace('œ','oe').replace('æ','ae')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

o1 = collections.Counter(); o2 = collections.Counter(); o3 = collections.Counter()
p1 = collections.Counter(); p2 = collections.Counter(); p3 = collections.Counter()
n_o = n_p = 0
with io.open(LEX, encoding='utf-8') as f:
    f.readline()  # header
    for line in f:
        c = line.rstrip('\n').split('\t')
        if len(c) < 3: continue
        surf, ipa = c[0], c[2]
        wt = 1.0
        if USE_FREQ and len(c) >= 7:
            try: wt = max(1.0, float(c[6]))   # plancher 1 : présent = compte au moins 1×
            except: wt = 1.0
        # ORTHO : lettres pures (déacc), sans apostrophe/tiret
        letters = [ch for ch in deacc(surf) if ch.isalpha()]
        if len(letters) >= 2:
            add_ngrams(letters, o1, o2, o3, wt); n_o += 1
        # PHON : segmente puis normalise vers l'inventaire GA (~40)
        if ipa:
            ph = [x for x in (_canon(y) for y in seg_ipa(ipa)) if x]
            if len(ph) >= 2:
                add_ngrams(ph, p1, p2, p3, wt); n_p += 1

def dump(name, u1, u2, u3, nsurf, kind):
    obj = {'n1': dict(u1), 'n2': dict(u2), 'n3': dict(u3),
           'meta': {'kind': kind, 'surfaces': nsurf, 'weight': ('freq' if USE_FREQ else 'type'),
                    'n1_types': len(u1), 'n2_types': len(u2), 'n3_types': len(u3)}}
    raw = json.dumps(obj, ensure_ascii=False).encode('utf-8')
    gz = gzip.compress(raw, 9)
    io.open(os.path.join(OUTDIR, name), 'wb').write(gz)
    print('   %s : %d surfaces · n1=%d n2=%d n3=%d · %.2f Mo gz' %
          (name, nsurf, len(u1), len(u2), len(u3), len(gz)/1e6), flush=True)

print('inventaire des phonèmes :', sorted(p1.keys())[:60], '...', flush=True)
dump('ngrams_ortho_en.json.gz', o1, o2, o3, n_o, 'ortho')
dump('ngrams_phon_en.json.gz',  p1, p2, p3, n_p, 'phon')
print('phonèmes distincts (n1) : %d' % len([k for k in p1 if k not in (BOUND, END)]), flush=True)
