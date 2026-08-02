# -*- coding: utf-8 -*-
# Substrat ANGLAIS du moteur du pendu cognitif (app/omega-pendu.html) — équivalent du lex4-data FR.
# Produit le bloc OMEGA_LEX4 attendu par loadOmegaLex4() : { version, source, n_words, words:[{m,p,l,f,
# old,pld,g}], len_index:{"7":[i,...],...} }. Le moteur lit surtout m (mot), p (phono), f (fréquence) ;
# old/pld (distances de voisinage) secondaires -> 0 (null-safe). Colonnes psycholinguistiques FR non
# reproduites (le mode cheat-free par défaut ne les lit pas ; les modes phon ORANGE sont spécifiques FR).
#   + LETTER_FREQ_EN : fréquences de lettres anglaises (remplace LETTER_FREQ_FR en dur dans l'app).
# Sorties : lex4_en.json.gz (données, gitignoré) + lex4_en.b64 (embarquable) + letter_freq_en.json + stats.
#   Lancer : PYTHONUTF8=1 python dictee/build_lex4_en.py
import gzip, json, os, sys, base64, collections
from g2p_en_apply import g2p_en, real_phon               # comble le phon (kaikki/CMUdict ~53%) : vrai phon dico (morpho/US) SINON g2p — on CROISE
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
LEX = os.path.join(HERE, 'lex_en.tsv.gz')
# PARITÉ FRANÇAIS = lex4 pendu ATTESTÉ (freq>0), toutes longueurs (2-25). Le Lexique4 FR a une fréquence
# pour CHAQUE mot (la + basse ≈ 0,003) → AUCUN mot freq=0. L'EN avait 63 % de formes freq=0 (kaikki sans
# fréquence SUBTLEX) : MESURÉ 2026-08-02 qu'elles POLLUENT la cohorte/le declare du pendu (vote de lettres
# dilué par des candidats rares) → EN full 195k = 86,5 % vs EN attesté 71k = 92,0 % (+5,5 pts) vs FR 96,5 %.
# On garde donc, comme le FR, uniquement les mots À FRÉQUENCE (freq>0). ⚠️ Ce n'est PAS un « cut » de
# simplification : le CORRECTEUR garde ses 200k (lex_en.tsv, il lui faut les mots rares pour corriger) ;
# c'est SEULEMENT le lex4 du JEU qui s'aligne sur le design FR (attesté). Décision Rem 2026-08-02 (mesuré).
MINLEN, MAXLEN = 2, 25                                  # toutes longueurs utiles (comme le FR ; on écarte juste les lettres seules)

words = []
letter_tot = collections.Counter(); letter_wtot = 0.0
_p_src = 0; _p_real = 0; _p_gen = 0                                # phon : source dico · vrai phon morpho/US · g2p prédit
with gzip.open(LEX, 'rt', encoding='utf-8') as f:
    f.readline()
    for line in f:
        c = line.rstrip('\n').split('\t')
        if len(c) < 7: continue
        w = c[0]
        if not w.isalpha() or not w.isascii(): continue           # a-z pur
        if not (MINLEN <= len(w) <= MAXLEN): continue
        try: fr = int(c[6])
        except ValueError:
            try: fr = int(float(c[6]))
            except ValueError: fr = 0
        if fr <= 0: continue                                       # ATTESTÉ seulement (comme le FR) — les freq=0 polluent la cohorte (mesuré −5,5 pts)
        m = w.upper()
        # PHON : source (kaikki/CMUdict) si présent, SINON g2p généré -> couverture ~100% comme le FR
        # (Lexique4). La route phon vaut +52 pts au pendu ; ~47% des mots (rares/flexions/orthos GB) sont
        # absents des dicos de prononciation -> sans ce comblement leur route phon est MORTE (régression
        # mesurée 2026-08-02 : FR 100% phon vs EN 53% -> winrate uniforme 76% au lieu de ~parité FR).
        p = c[2] or ''
        if p:
            _p_src += 1
        else:
            rp = real_phon(w)                                     # étage 2-3 : vrai phon dico (morpho/US)
            if rp: p = rp; _p_real += 1
            else: p = g2p_en(w); _p_gen += 1                      # étage 4 : g2p prédit (rares/archaïques)
        words.append({'m': m, 'p': p, 'l': len(w), 'f': fr, 'old': 0, 'pld': 0, 'g': c[5] or ''})
        # fréquences de lettres = usage réel -> pondérées par la freq des mots ATTESTÉS (freq>0) seulement
        if fr > 0:
            for ch in w:
                letter_tot[ch] += fr; letter_wtot += fr

words.sort(key=lambda x: -x['f'])                                  # plus fréquents d'abord (comme Lexique)
len_index = collections.defaultdict(list)
for i, wd in enumerate(words):
    len_index[str(wd['l'])].append(i)

obj = {'version': 'en-v1', 'source': 'lex_en (kaikki + SUBTLEX)', 'n_words': len(words),
       'words': words, 'len_index': dict(len_index)}
raw = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
gz = gzip.compress(raw, 9)
b64 = base64.b64encode(gz)
open(os.path.join(HERE, 'lex4_en.json.gz'), 'wb').write(gz)
open(os.path.join(HERE, 'lex4_en.b64'), 'wb').write(b64)

# LETTER_FREQ_EN normalisé (somme = 1), 26 lettres
LF = {ch: round(letter_tot.get(ch, 0) / (letter_wtot or 1), 6) for ch in 'abcdefghijklmnopqrstuvwxyz'}
open(os.path.join(HERE, 'letter_freq_en.json'), 'w', encoding='utf-8').write(
    json.dumps(LF, ensure_ascii=False, indent=0))

print('=== lex4_en ===')
print('  mots (2-25 lettres, tout le vocabulaire réel, freq planchée) : %d' % len(words))
_p_cov = _p_src + _p_real + _p_gen
print('  phon : %d source dico + %d vrai phon morpho/US + %d g2p prédit = %d/%d (%.0f%%)'
      % (_p_src, _p_real, _p_gen, _p_cov, len(words), 100.0 * _p_cov / max(1, len(words))))
print('        phon RÉEL (dico+morpho) = %d/%d (%.0f%%) · g2p prédit = %.0f%%'
      % (_p_src + _p_real, len(words), 100.0 * (_p_src + _p_real) / max(1, len(words)),
         100.0 * _p_gen / max(1, len(words))))
print('  brut %.2f Mo · gzip %.2f Mo · base64 (embarqué) %.2f Mo' % (len(raw)/1e6, len(gz)/1e6, len(b64)/1e6))
dist = collections.Counter(w['l'] for w in words)
print('  par longueur :', {k: dist[k] for k in sorted(dist)})
top = sorted(LF.items(), key=lambda x: -x[1])[:8]
print('  LETTER_FREQ_EN top-8 :', [(k, round(v*100, 1)) for k, v in top])
print('  ex mots fréquents :', [w['m'] for w in words[:12]])
