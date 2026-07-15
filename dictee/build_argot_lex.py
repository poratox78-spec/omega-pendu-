# -*- coding: utf-8 -*-
# Extrait un lexique d'ARGOT CONTEMPORAIN + ANGLICISMES depuis le Wiktionnaire FR (via kaikki.org, CC BY-SA)
# → dictee/argot_lex.tsv (mot<TAB>freq_milli<TAB>POS). Destiné à la WHITELIST du speller (l'extension vit sur
# Twitch/Discord = argot dense ; le speller FP=0 flaggerait « askip/bg/crush… » comme non-mots = faux positifs).
#
#   Émission COMPLÈTE voulue (Rem : « les types, les genres et tout ») : le TSV porte le POS (type) ; kaikki porte
#   aussi genre (senses[].tags masculine/feminine) + IPA (sounds[].ipa) + pluriels (forms) → phase 2 (genre→gdet-lex,
#   POS→tagger). Ici v1 = whitelist speller (POS inclus).
#
#   ⚠️ FILTRES ANTI-RÉGRESSION (règle Rem : « si on a des doublons mal orthographiés on les garde pas ») :
#     (1) ACCENTS RETIRÉS : jamais une forme = un mot ACCENTUÉ existant sans ses accents (« etre »=être, « besef »=bésef)
#         → masquerait la correction d'un typo dys ultra-courant (perte de recall).
#     (2) DOUBLON D'ORTHOGRAPHE : le Wiktionnaire marque ces variantes `alt-of` + alternative/obsolete/misspelling
#         (« blogguer » = *alternative form of bloguer*, « etre » = *obsolete spelling of être*) → EXCLUS.
#         MAIS on GARDE `alt-of` + `abbreviation` (« bg » = *abbreviation of beau gosse*, bjr, ajd) = abréviations
#         légitimes, PAS des fautes. (Un filtre edit-1 naïf a été essayé puis REJETÉ : il jetait askip→skip,
#         bg→bu, bjr→bar, crush→crash — des mots DIFFÉRENTS, pas des doublons. 120/146 tués pour rien.)
#     (5) SUPPLÉMENT CURÉ (argot_curated.tsv) : le dump EN/French rate le gaming pur (noob/tryhard/spawn) ET
#         les acronymes du handicap. MESURÉ sur le corpus réel de Rem : « dys » était corrigé en « dis » (ROUGE) —
#         un outil POUR les dys qui casse le mot « dys ». Mêmes gardes appliquées à la liste curée.
#     (4) VULGARITÉ / INSULTE / DISCRIMINATION — Rem, 2026-07-15 : « pas de vulgarité ou d'insulte c'est plus
#         sûr, à part ceux qui existent dans le dictionnaire ; je n'accepte aucun de raciste ou discriminant ».
#       a. tags Wiktionnaire `vulgar` / `derogatory` → JETÉ (anglaiser, enconner, ptn, tg, puta, tana, tartir…)
#       b. SAUF si le mot EXISTE AU DICTIONNAIRE (l'exception de Rem) : `bœuf` (ox, beef) et `nœud` (knot) ne sont
#          candidats QUE pour leur LIGATURE œ manquante — `boeuf`/`noeud` sont déjà dans le speller. Mots
#          parfaitement standards portant un sens argotique secondaire. Signal automatique : forme œ→oe ∈ speller.
#       c. ⚠️ LES TAGS NE SUFFISENT PAS — mesuré : `nèg` (= « alternative form of nègre ») n'est tagué NI vulgar
#          NI derogatory. Se fier aux tags = laisser passer l'injure raciste. Seule la GLOSE la révèle → liste
#          DROP_GLOSS, relue une par une, chaque entrée motivée. Le validisme (coto=COTOREP, débilos, gneugneu)
#          est jeté au même titre : outil POUR les dys, il ne véhicule pas d'insulte au handicap.
#     (3) COLLISION MESURÉE (COLLIDE) : mot d'argot observé comme FAUTE RÉELLE dans les corpus → l'ajouter
#         tuerait une correction qui marche aujourd'hui. Mesuré sur 185 364 paires (WiCoPaCo + GEC + dys) :
#         « lea » = 4/4 un typo pour la/les → jeté. Les 140 autres : ZÉRO collision réelle (le voisinage edit-1
#         d'un mot fréquent — 99/141 en ont un — est du risque THÉORIQUE, le corpus le réfute).
#
#   Usage : KAIKKI=/chemin/kaikki-fr.jsonl LEX4=/chemin/Lexique4.tsv python3 dictee/build_argot_lex.py
#   (kaikki : télécharger l'extraction frwiktionary sur kaikki.org/frwiktionary — le dump EN/French marche aussi
#    mais rate le gaming pur : clutch/tryhard/noob/spawn/lag → à compléter par une petite liste curée.)
import os, sys, json, gzip, unicodedata, re, collections
HERE = os.path.dirname(__file__)
KAIKKI = os.environ.get('KAIKKI', os.path.join(HERE, '..', 'kaikki-fr.jsonl'))
LEX4 = os.environ.get('LEX4', '/tmp/lex4/Lexique4.tsv')        # BASE hors-repo (Lexique 4)
WIKT = os.path.join(HERE, 'wikt_lex_fr.tsv')                     # augmentation Wiktionnaire déjà livrée
OUT = os.path.join(HERE, 'argot_lex.tsv')
POSMAP = {'noun': 'N', 'adj': 'A', 'verb': 'V', 'adv': 'R', 'intj': 'I', 'name': 'N', 'pron': 'O'}
# Sortie n°2 = argot_rows.tsv, schéma Lexique4 37 col (pendant EXACT de wikt_rows.tsv dans build_wikt_lex.py) :
# c'est le SEUL chemin d'intégration — tous les build_* consomment un Lexique4 augmenté, rien n'est bricolé à côté.
OUT_L4 = os.path.join(HERE, 'argot_rows.tsv')
CURATED = os.path.join(HERE, 'argot_curated.tsv')   # (5) supplément curé à la main (gaming + handicap)
CG = {'N': 'NOM', 'A': 'ADJ', 'V': 'VER', 'R': 'ADV', 'I': 'INT', 'O': 'PRO'}
NC = 37
CI = {'Mot': 0, 'Phono_IPA': 2, 'Lemme': 3, 'Cgram': 4, 'CgramOrtho': 5, 'Genre': 6, 'Nombre': 7,
      'FreqMot': 9, 'FreqOrtho': 10, 'FreqLemme': 11}
FLOOR = '0.05'   # plancher : passe MINFREQ du speller sans jamais dominer un vrai mot comme candidat
TIGHT = {'slang', 'internet', 'text-messaging', 'neologism'}   # tags SERRÉS (pas "informal"/"colloquial" = trop large)
COLLIDE = {'lea'}   # (3) collisions MESURÉES avec un vrai typo du corpus — voir l'en-tête
BAD_TAGS = {'vulgar', 'derogatory'}   # (4a) signal Wiktionnaire

# (4c) ce que les tags RATENT — glose lue une par une, motif obligatoire. Aucune de ces entrées n'est taguée.
DROP_GLOSS = {
    # RACISTE / DISCRIMINANT — refus net de Rem, aucune exception
    'nèg':      'injure raciste — « alternative form of nègre » (NON tagué par le Wiktionnaire)',
    'coto':     'validisme — abrév. de COTOREP (commission handicap) retournée en insulte',
    'débilos':  'validisme — de « débile » (« dumb, idiotic »)',
    'gneugneu': 'validisme — imite moqueusement le parler des personnes handicapées',
    'zoulette': 'mépris de classe/racialisé — « femme des banlieues »',
    'tox':      'stigmatise les personnes addictes — « druggie »',
    # VULGAIRE / SEXUEL / SCATO que les tags ratent
    'bouillaver': 'sexuel cru', 'charo': 'sexuel cru', 'emproser': 'sexuel cru',
    'empétarder': 'sexuel cru', 'endauffer': 'sexuel cru', 'enviander': 'sexuel cru',
    'pachole': 'sexuel cru', 'soupeur': 'sexuel/scato', 'boob': 'anatomie crue',
    'tartir': 'scato/grossier — « to shit ; to piss off »',
    'mrd': 'juron (= merde) — pas au dictionnaire sous cette forme',
}

def deacc(s): return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def main():
    if not os.path.exists(KAIKKI):
        print(f"kaikki introuvable ({KAIKKI}) — voir kaikki.org/frwiktionary"); return 1
    # « déjà connu » se mesure sur la BASE (Lexique4 + wikt_lex_fr), PAS sur le speller LIVRÉ : celui-ci contient
    # déjà nos ajouts précédents → le script ne verrait que le résidu et se viderait à chaque run (mesuré : 109→40
    # au 2e passage). La base, elle, ne bouge pas ⇒ sortie REPRODUCTIBLE, et l'exception « au dictionnaire »
    # (bœuf/nœud via boeuf/noeud) reste vraie puisqu'ils sont dans Lexique4.
    if not os.path.exists(LEX4):
        print(f"Lexique4 introuvable ({LEX4}) — LEX4=/chemin/Lexique4.tsv (hors-repo)"); return 1
    have = set(); deacc_acc = set()
    for src in (LEX4, WIKT):
        for l in open(src, encoding='utf-8'):
            w = l.split('\t', 1)[0].lower().strip()
            if not w or w.startswith('1_'): continue        # en-tête Lexique4
            have.add(w)
            if deacc(w) != w: deacc_acc.add(deacc(w))       # squelettes déacc des mots accentués → anti-typo
    cand = {}; filtered = 0; dbl = 0; coll = 0; bad = {}
    for line in open(KAIKKI, encoding='utf-8'):
        try: e = json.loads(line)
        except Exception: continue
        w = e.get('word', '')
        if not re.fullmatch(r"[a-zàâäéèêëîïôöùûüçœ]{2,15}", w) or w in have: continue
        pos = POSMAP.get(e.get('pos', ''), '')
        if not pos: continue
        tagsets = [set(t.lower() for t in s.get('tags', [])) for s in e.get('senses', [])]
        if not any(t in TIGHT for ts in tagsets for t in ts): continue
        # (2) DOUBLON D'ORTHOGRAPHE : variante marquée alt-of + alternative/obsolete/misspelling → JETÉ (blogguer=bloguer,
        #     etre=être). MAIS alt-of + abbreviation = abréviation légitime → GARDÉE (bg=beau gosse, bjr, ajd).
        if any(('alt-of' in ts) and (ts & {'alternative', 'obsolete', 'misspelling'}) and ('abbreviation' not in ts) for ts in tagsets):
            dbl += 1; continue
        if deacc(w) == w and w in deacc_acc: filtered += 1; continue   # (1) accents retirés
        if w in COLLIDE: coll += 1; continue                           # (3) collision mesurée avec un typo réel
        # (4) vulgarité/insulte/discrimination — sauf mot DÉJÀ au dictionnaire (bœuf/nœud : ligature œ manquante)
        in_dict = w.replace('œ', 'oe') in have
        if w in DROP_GLOSS: bad[w] = DROP_GLOSS[w]; continue             # (4c) refus net, tags insuffisants
        if any(ts & BAD_TAGS for ts in tagsets) and not in_dict:         # (4a/4b)
            bad[w] = 'tag ' + ','.join(sorted(set().union(*tagsets) & BAD_TAGS)); continue
        if w in cand: continue
        # « les types, les genres et tout et tout » (Rem) : POS + genre + IPA + lemme, pris à la source
        un = set().union(*tagsets) if tagsets else set()
        g = ('m' if 'masculine' in un else 'f' if 'feminine' in un else '') if pos == 'N' else ''
        if 'masculine' in un and 'feminine' in un: g = ''      # épicène/ambigu → pas de genre (FP=0)
        nb = 'p' if ('plural' in un and 'singular' not in un) else ('s' if 'singular' in un else '')
        ipa = next((s.get('ipa', '') for s in e.get('sounds', []) if s.get('ipa')), '')
        cand[w] = (pos, g, nb, ipa.strip('/[] '), (e.get('lemma') or w))
    # (5) SUPPLÉMENT CURÉ : le dump rate le gaming pur et les acronymes du handicap (« dys » était corrigé en
    # « dis » — mesuré sur le corpus réel de Rem). MÊMES gardes : accent-retiré + collision-typo + pas de vulgarité.
    cur = 0
    if os.path.exists(CURATED):
        for l in open(CURATED, encoding='utf-8'):
            if l.startswith('#') or not l.strip(): continue
            p = l.rstrip('\n').split('\t')
            w = p[0].strip()
            if w in have or w in cand: continue
            if deacc(w) == w and w in deacc_acc: filtered += 1; continue
            if w in COLLIDE or w in DROP_GLOSS: bad[w] = 'curé mais rejeté par une garde'; continue
            cand[w] = (p[1].strip(), (p[2].strip() if len(p) > 2 else ''), '', '', w)
            cur += 1
    rows = sorted((w, v[0]) for w, v in cand.items())
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('# Argot/anglicismes contemporains — Wiktionnaire FR via kaikki.org (CC BY-SA). Whitelist speller : mot<TAB>freq_milli<TAB>POS.\n')
        f.write('# freq=1 (basse) : mot CONNU (plus flaggé non-mot) mais candidat de correction faible. Filtre anti-typo appliqué. RELIRE avant injection FP=0.\n')
        for w, p in rows: f.write(f'{w}\t1\t{p}\n')
    # sortie n°2 : lignes au schéma Lexique4 → `cat Lexique4.tsv wikt_lex_fr.tsv argot_rows.tsv` = source du build
    # ⚠️ LIGATURE œ : le lexique speller la stocke en `oe` (soeur/coeur/boeuf) et le MOTEUR normalise œ→oe avant
    # de consulter SP.WORDS (dys-core `deaccS` + lookup L796). `build_speller_lex` jette d'ailleurs tout mot hors
    # a-z (NFD ne décompose PAS œ : c'est une lettre, pas un o accentué) → sans ce mapping, frœur partait en
    # silence. bœuf/nœud sont déjà couverts par boeuf/noeud ⇒ dédupliqués par le build (freq réelle conservée).
    with open(OUT_L4, 'w', encoding='utf-8', newline='') as f:
        for w, (p, g, nb, ipa, lem) in sorted(cand.items()):
            row = [''] * NC
            row[CI['Mot']] = w.replace('œ', 'oe'); row[CI['Phono_IPA']] = ipa; row[CI['Lemme']] = lem.replace('œ', 'oe')
            row[CI['Cgram']] = CG[p]; row[CI['CgramOrtho']] = CG[p]; row[CI['Genre']] = g; row[CI['Nombre']] = nb
            row[CI['FreqMot']] = FLOOR; row[CI['FreqOrtho']] = FLOOR; row[CI['FreqLemme']] = FLOOR
            f.write('\t'.join(row) + '\r\n')
    ng = sum(1 for v in cand.values() if v[1]); ni = sum(1 for v in cand.values() if v[3])
    print(f"écrit {OUT_L4} : {len(cand)} lignes schéma Lexique4 (genre : {ng}, IPA : {ni})")
    print(f"écrit {OUT} : {len(rows)} termes | jetés : {dbl} doublons (alt-of), {filtered} accents-retirés, {coll} collisions-typo, {len(bad)} vulgaire/insulte/discriminant | +{cur} curés | POS : {dict(collections.Counter(p for _, p in rows))}")
    print("\n=== JETÉS pour vulgarité / insulte / discrimination (%d) ===" % len(bad))
    for w, why in sorted(bad.items()): print(f"  {w:<13}{why}")
    return 0

if __name__ == '__main__':
    sys.exit(main())
