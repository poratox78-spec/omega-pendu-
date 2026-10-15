# -*- coding: utf-8 -*-
"""Extrait du Wiktionnaire français (kaikki.org, Wiktextract, CC BY-SA) → dictee/wikt_lex_fr.tsv (lignes au schéma Lexique4, 37 colonnes).

Né en juillet 2026 (#131 : 46 018 mots absents de Lexique4, flood « mot inconnu » −56 %). ⭐ 15/10/2026 (liste n° 7 et 10) : l'extrait
avait trois mois ; « agentique », « upcyclées », le nom « rissole » manquaient (« agentique » → argentique en orange, « une rissole » →
rissolée EN ROUGE). Rafraîchi sur le dump du 14/10/2026 — UNION avec l'extrait de juillet (aucun mot retiré), ajouts triés.

Ce qui entre : un mot d'une entrée française (nom, verbe, adjectif, adverbe… ; jamais un nom propre, une locution, un affixe), toutes
lettres a-z une fois désaccentué, ABSENT du dictionnaire du produit (extension/assets/speller.tsv.gz), et qui n'est PAS à une édition
d'un mot fréquent (≥ 1/M) — sinon il masquerait une faute (« la garde edit-1 », #131) ; pas de forme en « -è » final dont le jumeau en
« -é » existe (coquilles de la source, liste n° 5b). Le dump de 2026 liste chaque forme fléchie comme une entrée (« form-of ») :
671 512 formes verbales inconnues du dictionnaire, presque toutes de verbes que la table de conjugaison connaît déjà — une forme
fléchie n'entre que si son lemme est lui-même nouveau (« upcyclées » ← upcycler). Fréquence au plancher 0,05/M : jamais dominant au tri.

  python dictee/build_wikt_lex.py <kaikki.jsonl[.gz]> [--ecrire]     stats, et avec --ecrire réécrit dictee/wikt_lex_fr.tsv (union)
  python dictee/build_wikt_lex.py --check                             garde (dev.sh + CI) : fichier bien formé, sans doublon, et les
                                                                      mots-témoins du 15/10 câblés dans speller.tsv.gz
  python dictee/build_wikt_lex.py <kaikki> --variantes               mesure : écrit wikt_lex_fr.tsv.L (lemmes seuls) et .F (+ formes des
                                                                      lemmes nouveaux) à côté, hors dépôt
Lexique4 : $LEX4 ou data_local/Lexique4.tsv(.xz) ; speller : extension/assets/speller.tsv.gz."""
import collections, gzip, io, json, lzma, os, re, sys, unicodedata
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'wikt_lex_fr.tsv')
SPELLER = os.path.join(ROOT, 'extension', 'assets', 'speller.tsv.gz')
TEMOINS = ('agentique', 'upcyclées', 'rissole')   # liste n° 7 et 10 ; « rissole » doit être connu comme NOM (col. Cgram) dans l'extrait
NC = 37
CI = {'Mot': 0, 'Phono_IPA': 2, 'Lemme': 3, 'Cgram': 4, 'CgramOrtho': 5, 'Genre': 6, 'Nombre': 7, 'FreqMot': 9, 'FreqOrtho': 10, 'FreqLemme': 11}
FLOOR = '0'   # ⭐ 15/10/2026 : connu-seulement (dans WORDS, jamais candidat ni concurrent au tri) — le contrat des lots Morphalou ; l'extrait de juillet reste à 0,05 (candidat)
ALPHA = set('abcdefghijklmnopqrstuvwxyz')
POS2CG = {'noun': 'NOM', 'verb': 'VER', 'adj': 'ADJ', 'adv': 'ADV', 'pron': 'PRO', 'prep': 'PRE', 'conj': 'CON', 'det': 'ART', 'num': 'ADJ', 'intj': 'ONO', 'article': 'ART'}
SKIP_POS = {'name', 'phrase', 'proverb', 'prep_phrase', 'suffix', 'prefix', 'affix', 'symbol', 'character', 'contraction', 'particle', 'circumfix', 'infix', 'punct'}

def deacc(s):
    s = s.replace('œ', 'oe').replace('æ', 'ae')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
def ok_word(w): return len(w) >= 2 and all(deacc(c) in ALPHA for c in w)
def ouvrir(p):
    if p.endswith('.gz'): return gzip.open(p, 'rt', encoding='utf-8')
    if p.endswith('.xz'): return lzma.open(p, 'rt', encoding='utf-8')
    return io.open(p, encoding='utf-8')

SEUIL_GARDE = int(os.environ.get('SEUIL_GARDE', '100'))     # edit-1 d'un mot ≥ 0,1/M (milli) → refusé — mesuré le 15/10/2026 : à 1/M, 3 fautes dys masquées de plus
SEUIL_GARDE2 = int(os.environ.get('SEUIL_GARDE2', '1000'))  # ⭐ à DEUX lettres d'un mot ≥ 1/M → refusé (platform / plateforme, osti / hostie, farpaitement / parfaitement : 4 fautes dys masquées mesurées)
SEUIL_JUMEAU = int(os.environ.get('SEUIL_JUMEAU', '100'))   # jumeau d'accent d'un mot connu ≥ 0,1/M (milli) → refusé ; « rissole » / rissolé (0,019/M) passe
def lire_speller():
    """mots du produit → (connus, natures, fréquents ≥ 0,1/M, squelettes sans accent) ; speller.tsv.gz : mot \\t freq_milli \\t POS"""
    connus, natures, freq, squel, del2 = set(), {}, set(), {}, set()
    with gzip.open(SPELLER, 'rt', encoding='utf-8') as f:
        for l in f:
            p = l.rstrip('\n').split('\t')
            if len(p) < 2 or not p[0]: continue
            connus.add(p[0]); natures[p[0]] = p[2] if len(p) > 2 else ''
            try: fm = int(p[1])
            except ValueError: fm = 0
            d = deacc(p[0]); squel[d] = max(squel.get(d, 0), fm)   # squelette sans accent → fréquence (milli) du jumeau connu le plus fréquent
            if fm >= SEUIL_GARDE: freq.add(d)
            if fm >= SEUIL_GARDE2: del2.update(deletions2(d))      # distance 2 par suppressions symétriques (SymSpell) : lev(a, b) ≤ 2 ⇒ une suppression ≤ 2 commune
    return connus, natures, freq, squel, del2

def deletions2(w):
    out = {w}
    for i in range(len(w)):
        d1 = w[:i] + w[i + 1:]; out.add(d1)
        for j in range(len(d1)): out.add(d1[:j] + d1[j + 1:])
    return out

def lire_ancien():
    rows = {}
    if os.path.exists(OUT):
        for l in io.open(OUT, encoding='utf-8'):
            l = l.rstrip('\n')
            if l: rows[l.split('\t')[0]] = l
    return rows

AB = 'abcdefghijklmnopqrstuvwxyz'
def e1(w):
    S = [(w[:i], w[i:]) for i in range(len(w) + 1)]
    return set([a + b[1:] for a, b in S if b] + [a + c + b[1:] for a, b in S if b for c in AB] + [a + c + b for a, b in S for c in AB] + [a + b[1] + b[0] + b[2:] for a, b in S if len(b) > 1])

# ⭐ 15/10/2026 — le Wiktionnaire enregistre aussi des VARIANTES, des archaïsmes et des fautes courantes comme entrées (« québecois »,
# « poètesse », « pluspart », « carricature ») : mesuré, 40 corrections justes perdues sur les corpus dys quand elles deviennent « connues ».
# Une entrée ne compte que si l'un de ses sens est ordinaire (ni variante, ni faute, ni archaïque, ni rare, ni abréviation).
TAGS_ECARTES = {'misspelling', 'alt-of', 'obsolete', 'archaic', 'dated', 'rare', 'nonstandard', 'erroneous', 'abbreviation', 'initialism', 'acronym', 'form-of'}
def sens_ordinaire(r):
    for s in (r.get('senses') or []):
        if s.get('alt_of') or s.get('form_of'): continue
        if set(s.get('tags') or []) & TAGS_ECARTES: continue
        g = ' '.join(s.get('glosses') or [])
        if re.match(u'^(Variante|Faute|Erreur|Graphie|Orthographe|Ancienne|Vieille|Mauvaise)', g): continue
        return True
    return False

def extraire(kaikki, connus, freq, squel, del2):
    agg = {}; n = 0
    with ouvrir(kaikki) as f:
        for line in f:
            n += 1
            try: r = json.loads(line)
            except ValueError: continue
            if r.get('lang_code', 'fr') != 'fr': continue
            p = r.get('pos')
            if p in SKIP_POS: continue
            cg = POS2CG.get(p)
            if not cg: continue
            w = (r.get('word') or '').strip()
            if not w or not ok_word(w) or w != w.lower(): continue
            rec = agg.get(w)
            if rec is None: rec = agg[w] = {'pos': set(), 'gen': set(), 'ipa': None, 'num': set(), 'lemme': False, 'fo': set()}
            rec['pos'].add(cg)
            # ⭐ 15/10/2026 : le dump liste chaque forme fléchie comme une entrée (« form-of », 671 512 formes verbales inconnues du
            # dictionnaire, presque toutes de verbes déjà connus par la table de conjugaison) — on ne garde une forme fléchie que si son
            # lemme est lui-même NOUVEAU (« upcyclées » ← upcycler) ; un lemme (entrée sans « form-of ») est toujours candidat
            if 'form-of' in (r.get('tags') or []):
                for s0 in (r.get('senses') or []):
                    for fo in (s0.get('form_of') or []):
                        if fo.get('word'): rec['fo'].add(fo['word'].strip().lower())
            elif sens_ordinaire(r): rec['lemme'] = True
            if cg == 'NOM':
                for h in (r.get('head_templates') or []):
                    for v in (h.get('args') or {}).values():
                        sv = str(v)
                        if sv in ('m', 'f'): rec['gen'].add(sv)
                        elif sv in ('mf', 'mf?'): rec['gen'].add('e')
            if rec['ipa'] is None:
                for s in (r.get('sounds') or []):
                    ip = (s.get('ipa') or '').strip().strip('/[]').strip()
                    if ip: rec['ipa'] = ip; break
            t = r.get('tags') or []
            if 'plural' in t: rec['num'].add('p')
            if 'singular' in t: rec['num'].add('s')
    print('   %d lignes lues · %d surfaces françaises' % (n, len(agg)))
    ajout, d_connu, d_risque, d_coquille, d_forme, d_jumeau, d_variante, d_risque2 = {}, 0, 0, 0, 0, 0, 0, 0
    lemmes_neufs = set(w for w, r in agg.items() if r['lemme'] and w not in connus)
    for w, rec in agg.items():
        if w in connus: d_connu += 1; continue
        if not rec['lemme']:
            if not any(fo in lemmes_neufs for fo in rec['fo']): d_forme += 1; continue   # forme d'un lemme connu, ou d'une variante écartée
        if w.endswith('è') and (w[:-1] + 'é') in connus: d_coquille += 1; continue   # liste n° 5b
        if squel.get(deacc(w), 0) >= SEUIL_JUMEAU: d_jumeau += 1; continue   # ⭐ 15/10 : jumeau d'accent d'un mot connu (≥ 0,01/M) — l'accent oublié est LA faute dys (22 pertes mesurées) ; « rissole » / rissolé (0,009/M) passe
        if any(x in freq for x in e1(deacc(w))): d_risque += 1; continue
        if any(x in del2 for x in deletions2(deacc(w))): d_risque2 += 1; continue   # ⭐ à deux lettres d'un mot ≥ 1/M
        ajout[w] = rec
    d_variante = sum(1 for w, r in agg.items() if w not in connus and not r['lemme'] and not r['fo'])
    print('   déjà au dictionnaire : %d · variantes/fautes/archaïsmes écartés : %d · formes de lemmes connus ou écartés : %d · jumeaux d\'accent (≥ %g/M) : %d · garde edit-1 (≥ %g/M) : %d · garde edit-2 (≥ %g/M) : %d · coquilles « -è » : %d · AJOUTABLES : %d'
          % (d_connu, d_variante, d_forme, SEUIL_JUMEAU / 1000.0, d_jumeau, SEUIL_GARDE / 1000.0, d_risque, SEUIL_GARDE2 / 1000.0, d_risque2, d_coquille, len(ajout)))
    print('   dont lemmes : %d · formes de lemmes nouveaux : %d' % (sum(1 for r in ajout.values() if r['lemme']), sum(1 for r in ajout.values() if not r['lemme'])))
    return ajout

def ligne(w, rec):
    cg = 'NOM' if 'NOM' in rec['pos'] else ('VER' if 'VER' in rec['pos'] else ('ADJ' if 'ADJ' in rec['pos'] else sorted(rec['pos'])[0]))
    g = rec['gen']; g = list(g)[0] if (rec['pos'] == {'NOM'} and len(g) == 1 and list(g)[0] in ('m', 'f')) else ''
    nb = 'p' if rec['num'] == {'p'} else ('s' if rec['num'] == {'s'} else '')
    row = [''] * NC
    row[CI['Mot']] = w; row[CI['Phono_IPA']] = rec['ipa'] or ''; row[CI['Lemme']] = w
    row[CI['Cgram']] = cg; row[CI['CgramOrtho']] = cg; row[CI['Genre']] = g; row[CI['Nombre']] = nb
    row[CI['FreqMot']] = row[CI['FreqOrtho']] = row[CI['FreqLemme']] = FLOOR
    return '\t'.join(row)

def check():
    ko = []
    rows = [l.rstrip('\n') for l in io.open(OUT, encoding='utf-8') if l.strip()]
    mots = [r.split('\t')[0] for r in rows]
    if len(set(mots)) != len(mots): ko.append('doublons : %d' % (len(mots) - len(set(mots))))
    mal = [m for r, m in zip(rows, mots) if r.count('\t') != NC - 1 or not ok_word(m) or m != m.lower()]
    if mal: ko.append('%d ligne(s) mal formée(s) (ex. %s)' % (len(mal), ', '.join(mal[:3])))
    connus = lire_speller()[0]
    absents = [m for m in mots[:200] + mots[-200:] if m not in connus]   # câblage : un échantillon aux deux bouts du fichier
    if absents: ko.append('%d mot(s) de l\'extrait absents de speller.tsv.gz (ex. %s) — régénérer le dictionnaire' % (len(absents), ', '.join(absents[:3])))
    if ko:
        print('✗ wikt_lex_fr.tsv : ' + ' ; '.join(ko)); sys.exit(1)
    print('✓ extrait Wiktionnaire : %d mots, sans doublon, 37 colonnes, câblés dans speller.tsv.gz' % len(rows))

if __name__ == '__main__':
    if '--check' in sys.argv: check(); sys.exit(0)
    kaikki = [a for a in sys.argv[1:] if not a.startswith('--')][0]
    connus, natures, freq, squel, del2 = lire_speller()
    print('1) dictionnaire du produit : %d mots connus · %d à ≥ %g/M (garde edit-1) · %d suppressions pour la garde edit-2' % (len(connus), len(freq), SEUIL_GARDE / 1000.0, len(del2)))
    print('2) extraction kaikki…')
    ajout = extraire(kaikki, connus, freq, squel, del2)
    pos = collections.Counter(c for r in ajout.values() for c in r['pos'])
    print('   natures ajoutées :', pos.most_common())
    for t in TEMOINS: print('   témoin « %s » : %s' % (t, 'ajouté (%s)' % '/'.join(sorted(ajout[t]['pos'])) if t in ajout else ('déjà connu' if t in connus else 'ABSENT du dump')))
    if '--ecrire' in sys.argv or '--variantes' in sys.argv:
        # l'extrait de juillet reste tel quel, dans son ordre (diff lisible : des ajouts seulement) ; les ajouts suivent, triés
        anciens = [l.rstrip('\n') for l in io.open(OUT, encoding='utf-8') if l.strip()] if os.path.exists(OUT) else []
        deja = set(l.split('\t')[0] for l in anciens)
        neufs = sorted(w for w in ajout if w not in deja)
        def ecrire(p, mots):
            io.open(p, 'w', encoding='utf-8', newline='\n').write('\n'.join(anciens + [ligne(w, ajout[w]) for w in mots]) + '\n')
            print('3) écrit %s : %d → %d lignes (+%d)' % (p, len(anciens), len(anciens) + len(mots), len(mots)))
        if '--variantes' in sys.argv:   # mesure : L = lemmes seuls, F = lemmes + formes des lemmes nouveaux (fichiers à côté, hors dépôt)
            ecrire(OUT + '.L', [w for w in neufs if ajout[w]['lemme']]); ecrire(OUT + '.F', neufs)
        else: ecrire(OUT, neufs)
