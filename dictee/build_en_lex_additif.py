# -*- coding: utf-8 -*-
"""AJOUT PUR au lexique anglais (chantier ③, 16/09/2026) — les mots VALIDES que la recette de portée avait écartés.

POURQUOI. rescope_en.py garde une surface si : IPA | fréquence SUBTLEX > 0 | homophone | forme fléchie d'un lemme gardé.
Un mot DÉRIVÉ (causal + -ly = causally, mitigate + -or = mitigator, co- + written) qui n'a ni IPA sur Wiktionary ni
fréquence dans les sous-titres tombait. Mesuré sur 175 237 mots d'anglais édité (PUD + GUM) : 244 soulignés orange sur
des mots justes (0,14 %), souvent avec une mauvaise cible (causally -> casually).

LA RÈGLE COMPLÉTÉE, pas des cas patchés ([[completude-lexiques-doctrine]]) — on ajoute une surface absente si, dans le
kaikki courant, c'est une entrée RÉELLE et COURANTE (POS lexical, pas un nom propre, pas une graphie « misspelling/eye
dialect », un sens au moins sans étiquette obsolète/archaïque/rare/non standard) ET que son étymologie Wiktionary la DÉRIVE
PAR UN SUFFIXE STANDARD (-ly, -ness, -er/-or, -al, -ity, -ive, -ment, -tion, -able…) de mots déjà gardés :
« causal + -ly », « mitigate + -or », « torsion + -al ». La source nomme la base, ce n'est pas un stemming maison.
Ses formes fléchies (pluriel, prétérit…) entrent avec elle. Aucune ligne existante n'est modifiée ni retirée.

⚠️ MESURÉ AVANT DE RESSERRER (16/09/2026, règle large « IPA ou toute dérivation d'un mot gardé ») : 200 100 surfaces
candidates, 320 313 lignes (le lexique doublait, 1,9 -> 3,8 Mo), dominées par les préfixes productifs (non- 9 819,
anti-, pre-, inter-, sub-, over-, hyper-…) et des termes techniques à IPA (bacteriohopanepolyol). Gain : 244 -> 164 mots
justes soulignés sur 175 237 mots édités. Coût : UNE correction ROUGE FAUSSE de plus sur le banc Wikipédia (« beggining »
-> biggening, mot rare ajouté ; attendu beginning) et un rouge JFLEG perdu. Un mot rare à une ou deux lettres d'un mot
courant masque la faute et fournit une mauvaise cible : c'est la colonne qui viole FP=0. D'où : suffixes de bases
fréquentes seulement, pas de préfixes, pas d'IPA seule.

  PYTHONUTF8=1 python dictee/build_en_lex_additif.py <kaikki-en.jsonl> [--freq subtlex_us.json] [--dry]
Sorties : dictee/lex_en.tsv.gz (lignes ajoutées en fin, colonnes identiques), dictee/forms_en.tsv.gz (lemmes ajoutés),
          data_local/en/lex_en_additions.tsv (la liste des ajouts, pour lecture).
"""
import collections, gzip, io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
KAIKKI = sys.argv[1]
DRY = '--dry' in sys.argv

# ---- mêmes lectures des entrées que build_en_lex.py (recopiées : ce module s'exécute à l'import)
POS2CG = {'noun': 'NOUN', 'verb': 'VERB', 'adj': 'ADJ', 'adv': 'ADV', 'pron': 'PRON', 'prep': 'PREP',
          'conj': 'CONJ', 'det': 'DET', 'num': 'NUM', 'intj': 'INTJ', 'article': 'DET'}
SKIP_POS = {'name', 'phrase', 'proverb', 'prep_phrase', 'suffix', 'prefix', 'affix', 'symbol',
            'character', 'particle', 'circumfix', 'infix', 'punct'}
INFL_TAGS = {'plural', 'singular', 'comparative', 'superlative', 'past', 'past-participle',
             'present-participle', 'participle', 'third-person-singular', 'gerund', 'simple-past',
             'past participle', 'present participle', 'third-person singular', 'simple past'}
_MS_PREFIX = ('misspelling of', 'common misspelling', 'rare misspelling', 'eye dialect of',
              'informal spelling of', 'nonstandard spelling of', 'nonstandard form of')


def clean_ipa(s): return (s or '').strip().strip('/[]').strip()


def pick_ipa(sounds):
    ga = rp = first = None
    for s in sounds:
        ip = clean_ipa(s.get('ipa'))
        if not ip: continue
        if first is None: first = ip
        tags = s.get('tags') or []
        if 'General-American' in tags and ga is None: ga = ip
        if 'Received-Pronunciation' in tags and rp is None: rp = ip
    return ga or rp or first


def is_misspelling(r):
    senses = r.get('senses') or []
    if not senses: return False
    for sn in senses:
        if 'misspelling' in (sn.get('tags') or []): continue
        gl = ' '.join(sn.get('glosses') or []).strip().lower()
        if gl.startswith(_MS_PREFIX): continue
        return False
    return True


FREQ = {}
if '--freq' in sys.argv:
    fp = sys.argv[sys.argv.index('--freq') + 1]
    try:
        d = json.load(io.open(fp, encoding='utf-8'))
        for it in (d if isinstance(d, list) else d.get('words', [])):
            w = (it.get('word') or '').lower()
            if w: FREQ[w] = max(FREQ.get(w, 0), int(it.get('count') or 0))
        print('   [freq] %d mots SUBTLEX' % len(FREQ), flush=True)
    except Exception as ex:
        print('   [freq] non chargé :', ex, flush=True)

OK_SURF = re.compile(r"^[a-z]{3,}$")               # minuscules a-z seulement : le speller ne touche jamais une majuscule
# modèles d'étymologie DÉRIVATIONNELS : anciens noms (suffix/prefix/affix/compound) et arbre « ety » avec code :af/:com/:suf/:pre
DERIV_OLD = {'suffix', 'prefix', 'affix', 'compound', 'confix', 'suf', 'pre', 'af', 'com', 'prefixsuffix', 'univerbation', 'blend'}
DERIV_ETY = {':af', ':affix', ':suf', ':suffix', ':pre', ':prefix', ':com', ':compound', ':con', ':confix', ':univ', ':univerbation'}

LEX = os.path.join(HERE, 'lex_en.tsv.gz'); FORMS = os.path.join(HERE, 'forms_en.tsv.gz')
lines = gzip.open(LEX, 'rt', encoding='utf-8').read().split('\n')
header, rows = lines[0], [l for l in lines[1:] if l]
known = {r.split('\t', 1)[0] for r in rows}
print('lexique actuel : %d surfaces' % len(known), flush=True)


def _base(v):
    v = (v or '').strip().lower()
    v = re.sub(r'<[^>]*>', '', v)                        # « -ly<id:adverbial> »
    v = v.split(':')[-1] if v.startswith(('frm:', 'enm:', 'la:', 'fr:')) else v
    if v.startswith('-') or v.endswith('-'): return None   # affixe, pas une base
    return v if OK_SURF.match(v) else None


def _affix(v):
    v = re.sub(r'<[^>]*>', '', (v or '').strip().lower())
    if v.startswith('-') and not v.endswith('-'): return 'suffixe'
    if v.endswith('-'): return 'prefixe'
    return None


def _suffix_name(v):
    return re.sub(r'<[^>]*>', '', (v or '').strip().lower()).strip('-')


def derivations(r):
    """Chaque modèle d'étymologie dérivationnel -> (bases nommées, sortes d'affixes, suffixes nommés).
    Anciens modèles : `suffix` (2 = base, 3 = suffixe SANS tiret), `prefix` (2 = préfixe sans tiret, 3 = base), `affix` /
    `compound` / `confix` (les affixes portent leur tiret : « -ly », « co- ») ; arbre `ety` : code :suf / :pre / :af / :com."""
    out = []
    for t in (r.get('etymology_templates') or []):
        nm, a = (t.get('name') or ''), (t.get('args') or {})
        bases, affixes, sufs = set(), set(), set()
        if nm in ('suffix', 'suf'):
            b = _base(a.get('2'))
            if b: bases.add(b)
            affixes.add('suffixe'); sufs.add(_suffix_name(a.get('3')))
        elif nm in ('prefix', 'pre'):
            b = _base(a.get('3'))
            if b: bases.add(b)
            affixes.add('prefixe')
        elif nm in DERIV_OLD or (nm == 'ety' and (a.get('2') or '') in DERIV_ETY):
            code = (a.get('2') or '') if nm == 'ety' else ''
            if code in (':pre', ':prefix'): affixes.add('prefixe')
            ks = ('3', '4', '5', '6', '7') if nm == 'ety' else ('2', '3', '4', '5')
            for k in ks:
                v = a.get(k)
                if not v: continue
                kind = _affix(v)
                if kind == 'suffixe': affixes.add(kind); sufs.add(_suffix_name(v))
                elif kind == 'prefixe': affixes.add(kind)
                else:
                    b = _base(v)
                    if b: bases.add(b)
            if code in (':suf', ':suffix'): affixes.add('suffixe')
        else:
            continue
        if bases: out.append((bases, affixes, sufs))
    return out


# Un dérivé n'entre que s'il est de l'anglais COURANT : au moins un sens sans étiquette obsolète/archaïque/rare/non
# standard/dialectal et dont la glose n'est pas « obsolete/archaic/alternative/dated/rare … form/spelling of ».
# ⚠️ MESURÉ (16/09) sans ce filtre : « marrest », « marreth » (formes archaïques), « valueable » (graphie obsolète),
# « biggening » entraient — et « biggening » devenait la cible ROUGE fausse de « beggining » (attendu beginning) ; six
# fautes d'apprenants de JFLEG (valueable, deedly, safetiness…) devenaient des « mots ». La colonne rouge est celle qui
# viole FP=0 : un mot qui n'est plus en usage n'a rien à faire dans un correcteur pour dys.
_NONCURRENT_TAGS = {'obsolete', 'archaic', 'dated', 'rare', 'nonstandard', 'dialectal', 'misspelling', 'eye-dialect',
                    'proscribed', 'uncommon', 'obsolete-spelling', 'alternative', 'alt-of', 'form-of'}
_NONCURRENT_GLOSS = ('obsolete', 'archaic', 'alternative form of', 'alternative spelling of', 'dated', 'rare form',
                     'rare spelling', 'nonstandard', 'misspelling', 'eye dialect', 'former name', 'superseded')


def is_current(r):
    for sn in (r.get('senses') or []):
        tags = set(sn.get('tags') or [])
        if tags & _NONCURRENT_TAGS: continue
        gl = ' '.join(sn.get('glosses') or []).strip().lower()
        if not gl or gl.startswith(_NONCURRENT_GLOSS): continue
        return True
    return False


# Les suffixes DÉRIVATIONNELS standard de l'anglais (ceux des manuels : adverbes, noms d'agent et de qualité, adjectifs,
# verbes). ⚠️ MESURÉ (16/09) sans cette liste : 77 820 candidats dont « henhood », « staplelike », « needlet », « tentmate »,
# « shindiggery » — des formations productives (-like, -let, -y, -ery, composés) que personne n'écrit, qui gonflaient le
# lexique de 37 % et fournissaient 9 mauvaises cibles de plus au banc Wikipédia.
STD_SUFFIXES = {'ly', 'ness', 'er', 'or', 'ist', 'ism', 'al', 'ial', 'ity', 'ty', 'ive', 'ous', 'ious', 'ful', 'less', 'ment',
                'ation', 'tion', 'sion', 'ion', 'ize', 'ise', 'ify', 'fy', 'ic', 'ical', 'ant', 'ent', 'ance', 'ence', 'ancy',
                'ency', 'able', 'ible', 'ability', 'ibility', 'ship', 'ish', 'ward', 'wards', 'wise', 'ese', 'an', 'ian', 'ary',
                'ory', 'ure', 'age', 'dom', 'hood', 'ling', 'ate', 'en', 'ed', 'ing', 'ally', 'ically', 'ization', 'isation'}


def why_of(r):
    """« derive:causal » si une dérivation par un suffixe STANDARD part de bases déjà gardées (pas de préfixe, pas de composé)."""
    if not is_current(r): return ''
    for bases, affixes, sufs in derivations(r):
        if 'prefixe' in affixes or 'suffixe' not in affixes: continue
        if not sufs or not sufs <= STD_SUFFIXES: continue
        if not all(b in known for b in bases): continue
        return 'derive:' + ','.join(sorted(bases)) + '+' + ','.join(sorted(sufs))
    return ''


adds = {}
seen = 0
with io.open(KAIKKI, encoding='utf-8') as f:
    for ln in f:
        seen += 1
        if seen % 250000 == 0: print('   … %d entrées' % seen, flush=True)
        try: r = json.loads(ln)
        except Exception: continue
        if (r.get('lang_code') or 'en') != 'en': continue
        w = (r.get('word') or '').strip()
        if not OK_SURF.match(w) or w in known: continue
        p = r.get('pos') or ''
        if p in SKIP_POS: continue
        cg = POS2CG.get(p)
        if cg not in ('NOUN', 'VERB', 'ADJ', 'ADV'): continue
        if is_misspelling(r): continue
        ipa = pick_ipa(r.get('sounds') or [])
        why = why_of(r)
        if not why: continue
        e = adds.setdefault(w, {'pos': set(), 'ipa': '', 'why': set(), 'forms': set()})
        e['pos'].add(cg); e['why'].add(why)
        if ipa and not e['ipa']: e['ipa'] = ipa
        for fm in (r.get('forms') or []):
            form = (fm.get('form') or '').strip().lower(); tags = set(fm.get('tags') or [])
            if OK_SURF.match(form) and form != w and (tags & INFL_TAGS) and form not in known:
                e['forms'].add((form, ','.join(sorted(tags & INFL_TAGS))))

print('entrées lues : %d · ajouts candidats : %d' % (seen, len(adds)), flush=True)
print('   dont avec une IPA sur Wiktionary : %d' % sum(1 for e in adds.values() if e['ipa']), flush=True)

new_rows, new_forms, listing = [], [], []
for w in sorted(adds):
    e = adds[w]
    new_rows.append('\t'.join([w, '|'.join(sorted(e['pos'])), e['ipa'], w, '', '', str(FREQ.get(w, 0))]))
    listing.append('%s\t%s\t%s\t%s' % (w, '|'.join(sorted(e['pos'])), e['ipa'] or '-', ';'.join(sorted(e['why']))))
    fl = sorted(e['forms'])
    if fl:
        new_forms.append('%s\t%s\t%s' % (w, sorted(e['pos'])[0], ','.join('%s:%s' % (fm, tg) for fm, tg in fl)))
        for fm, tg in fl:
            if fm not in adds:
                new_rows.append('\t'.join([fm, '|'.join(sorted(e['pos'])), '', w, tg, '', str(FREQ.get(fm, 0))]))
print('lignes ajoutées au lexique : %d (dont formes fléchies : %d) · lemmes ajoutés à forms_en : %d' % (len(new_rows), len(new_rows) - len(adds), len(new_forms)), flush=True)

out_list = os.path.join(HERE, '..', 'data_local', 'en', 'lex_en_additions.tsv')
io.open(out_list, 'w', encoding='utf-8').write('\n'.join(listing) + '\n')
print('liste des ajouts :', out_list, flush=True)
if DRY:
    print('(--dry : rien d\'écrit dans dictee/)'); sys.exit(0)

gzip.open(LEX, 'wt', encoding='utf-8').write(header + '\n' + '\n'.join(rows + new_rows) + '\n')
if new_forms:
    fl = gzip.open(FORMS, 'rt', encoding='utf-8').read().rstrip('\n').split('\n')
    gzip.open(FORMS, 'wt', encoding='utf-8').write('\n'.join(fl + new_forms) + '\n')
print('✓ dictee/lex_en.tsv.gz : %d -> %d surfaces' % (len(rows), len(rows) + len(new_rows)), flush=True)
