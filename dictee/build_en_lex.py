# -*- coding: utf-8 -*-
# Extracteur À L'ÉCHELLE : kaikki English Wiktextract JSONL -> maître lexical ANGLAIS.
# Mêmes trames que le FR (build_wikt_lex.py) MAIS extraction TOTALE : kaikki EST la base
# (pas de Lexique4 anglais libre), donc on ne filtre PAS vs un lexique existant.
#   Trames : word · POS(set) · IPA(General-American>RP>1re) · lemme · nombre · genre
#          + homophones (Wiktionary les liste) + formes fléchies (plural/past/comparatif/…).
# Sorties (dictee/) :
#   lex_en.tsv          : table de SURFACES (lemmes + formes fléchies dépliées), 1 ligne/surface
#                         surface \t POS_csv \t ipa \t lemme \t tags_csv \t genre
#   homophones_en.json  : { mot : [homophones...] } (groupes fusionnés, symétriques)
#   forms_en.tsv        : lemme \t POS \t (form:tag) csv   (table de flexion brute, référence)
#   + stats de couverture sur stdout (doctrine : MESURER d'abord).
# Rien n'est câblé dans un moteur ici : ça produit les assets + les chiffres.
#   Lancer : PYTHONUTF8=1 python dictee/build_en_lex.py kaikki-en.jsonl dictee
import json, sys, io, unicodedata, collections, os, gzip
sys.stdout.reconfigure(encoding='utf-8')
KAIKKI = sys.argv[1]
OUTDIR = sys.argv[2] if len(sys.argv) > 2 else 'dictee'

ALPHA = set("abcdefghijklmnopqrstuvwxyz")
def deacc(s):
    s = s.replace('œ','oe').replace('æ','ae')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
def ok_word(w):
    # lettres a-z (après déacc) + apostrophe/tiret internes ; len>=2 ; au moins une lettre.
    if len(w) < 2: return False
    core = w.replace("'", '').replace('’','').replace('-','')
    if not core: return False
    return all(deacc(c) in ALPHA for c in core)

# fréquence SUBTLEX-US optionnelle (registre sous-titres = comme Lexique FR) : --freq subtlex_us.json
FREQ = {}
if '--freq' in sys.argv:
    fp = sys.argv[sys.argv.index('--freq') + 1]
    try:
        _d = json.load(io.open(fp, encoding='utf-8'))
        for e in _d:
            w = (e.get('word') or '').strip().lower()
            if w: FREQ[w] = max(FREQ.get(w, 0), int(e.get('count') or 0))
    except Exception as ex:
        print('   [freq] non chargé (%s): %s' % (fp, ex), flush=True)
    print('   [freq] %d mots SUBTLEX chargés' % len(FREQ), flush=True)

# CMUdict optionnel (--cmu cmudict.dict) : secours phonologie (134k mots, formes fléchies incluses,
# que Wiktionary ne transcrit pas). ARPAbet -> IPA. Aligné sur la convention kaikki General-American.
ARPA2IPA = {'AA':'ɑ','AE':'æ','AH':'ʌ','AO':'ɔ','AW':'aʊ','AY':'aɪ','B':'b','CH':'tʃ','D':'d',
            'DH':'ð','EH':'ɛ','ER':'ɚ','EY':'eɪ','F':'f','G':'ɡ','HH':'h','IH':'ɪ','IY':'i',
            'JH':'dʒ','K':'k','L':'l','M':'m','N':'n','NG':'ŋ','OW':'oʊ','OY':'ɔɪ','P':'p',
            'R':'ɹ','S':'s','SH':'ʃ','T':'t','TH':'θ','UH':'ʊ','UW':'u','V':'v','W':'w','Y':'j',
            'Z':'z','ZH':'ʒ'}
def arpa_to_ipa(phones):
    out = []
    for ph in phones:
        st = ph[-1] if ph and ph[-1] in '012' else ''
        base = ph[:-1] if st else ph
        if base == 'AH' and st == '0': out.append('ə'); continue   # schwa non accentué
        out.append(ARPA2IPA.get(base, ''))
    return ''.join(out)
CMU = {}
if '--cmu' in sys.argv:
    cp = sys.argv[sys.argv.index('--cmu') + 1]
    for l in io.open(cp, encoding='utf-8'):
        l = l.rstrip('\n')
        if not l or l.startswith(';;;'): continue
        parts = l.split()
        w = parts[0].split('(')[0].lower()     # (2) = variante -> on garde la 1re vue
        if w in CMU or not ok_word(w): continue
        phones = parts[1:]
        if '#' in phones: phones = phones[:phones.index('#')]
        ipa = arpa_to_ipa(phones)
        if ipa: CMU[w] = ipa
    print('   [cmu] %d prononciations chargées' % len(CMU), flush=True)

# POS kaikki -> étiquette (on garde la granularité EN utile au correcteur/pendu)
POS2CG = {'noun':'NOUN','verb':'VERB','adj':'ADJ','adv':'ADV','pron':'PRON','prep':'PREP',
          'conj':'CONJ','det':'DET','num':'NUM','intj':'INTJ','article':'DET'}
# name = nom propre EXCLU ; locutions/affixes/symboles exclus. contraction GARDÉE (they're/don't
# = homophones + grammaire clés) -> traitée via filtre de surface, pas skippée.
SKIP_POS = {'name','phrase','proverb','prep_phrase','suffix','prefix','affix','symbol',
            'character','particle','circumfix','infix','punct'}

# Formes fléchies qui nous intéressent (le reste = alternatives/graphies -> table variants).
INFL_TAGS = {'plural','singular','comparative','superlative','past','past-participle',
             'present-participle','participle','third-person-singular','gerund','simple-past',
             'past participle','present participle','third-person singular','simple past'}

def clean_ipa(s):
    return (s or '').strip().strip('/[]').strip()

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

def homs_of(sounds):
    out = set()
    for s in sounds:
        h = s.get('homophone')
        if isinstance(h, str): out.add(h)
        h2 = s.get('homophones')
        if isinstance(h2, str): out.add(h2)
        elif isinstance(h2, list): out.update(x for x in h2 if isinstance(x, str))
    return out

def gender_of(r, cg):
    if cg != 'NOUN': return ''
    for h in (r.get('head_templates') or []):
        blob = str(h.get('args') or {}).lower()
        if 'feminine' in blob: return 'f'
        if 'masculine' in blob: return 'm'
    for sn in (r.get('senses') or []):
        for t in (sn.get('tags') or []):
            if t == 'feminine': return 'f'
            if t == 'masculine': return 'm'
    return ''

print('parse kaikki English (streaming)...', flush=True)
# surface (lower) -> record agrégé
agg = {}            # w -> {'pos':set,'ipa':str|None,'lem':set,'num':set,'gen':set}
homo_pairs = []     # (a,b) liens homophones
forms_rows = []     # (lemme, POS, "form:tag,form:tag")
seen_pos = collections.Counter()
n = raw_entries = 0
for line in io.open(KAIKKI, encoding='utf-8'):
    n += 1
    try: r = json.loads(line)
    except: continue
    p = r.get('pos')
    if p in SKIP_POS: continue
    cg = POS2CG.get(p)
    if not cg: continue
    w = (r.get('word') or '').strip().lower()
    if not w or not ok_word(w): continue
    raw_entries += 1
    rec = agg.get(w)
    if rec is None:
        rec = agg[w] = {'pos':set(),'ipa':None,'lem':set(),'num':set(),'gen':set()}
    rec['pos'].add(cg)
    seen_pos[cg] += 1
    sounds = r.get('sounds') or []
    if rec['ipa'] is None:
        ip = pick_ipa(sounds)
        if ip: rec['ipa'] = ip
    g = gender_of(r, cg)
    if g: rec['gen'].add(g)
    # homophones
    for h in homs_of(sounds):
        h = h.strip().lower()
        if h and h != w and ok_word(h):
            homo_pairs.append((w, h))
    # nombre (tags de l'entrée)
    t = set(r.get('tags') or [])
    if 'plural' in t: rec['num'].add('p')
    if 'singular' in t: rec['num'].add('s')
    # formes fléchies -> déplier en surfaces + table de flexion
    fl = r.get('forms') or []
    ftoks = []
    for f in fl:
        surf = (f.get('form') or '').strip().lower()
        tags = [x for x in (f.get('tags') or [])]
        if not surf or surf == '-' or not ok_word(surf): continue
        infl = [x for x in tags if x in INFL_TAGS]
        if not infl:
            continue  # 'alternative'/'canonical'/misc -> pas dans le maître fléchi
        # déplie la forme comme surface, lemme = w
        frec = agg.get(surf)
        if frec is None:
            frec = agg[surf] = {'pos':set(),'ipa':None,'lem':set(),'num':set(),'gen':set()}
        frec['pos'].add(cg)
        frec['lem'].add(w)
        if 'plural' in infl: frec['num'].add('p')
        ftoks.append('%s:%s' % (surf, '|'.join(infl)))
    if ftoks:
        forms_rows.append('%s\t%s\t%s' % (w, cg, ','.join(ftoks)))
print('   %d lignes · %d entrées retenues · %d surfaces uniques' % (n, raw_entries, len(agg)), flush=True)
print('   POS :', seen_pos.most_common(), flush=True)

# ---- homophones : fusion en groupes symétriques (union-find léger) ----
adj = collections.defaultdict(set)
for a, b in homo_pairs:
    adj[a].add(b); adj[b].add(a)
homo_out = {}
for w in adj:
    grp = sorted(x for x in adj[w] if x != w)
    if grp: homo_out[w] = grp
print('   homophones : %d mots avec >=1 homophone' % len(homo_out), flush=True)

# ---- écriture ----
os.makedirs(OUTDIR, exist_ok=True)
def lemma_of(w, rec):
    if rec['lem']:
        return sorted(rec['lem'])[0]
    return w

lex_lines = []
n_ipa = n_gen = n_infl = n_ipa_k = n_ipa_c = 0
for w in sorted(agg):
    rec = agg[w]
    if not rec['pos']: continue
    pos_csv = '|'.join(sorted(rec['pos']))
    ipa = rec['ipa'] or ''
    if ipa: n_ipa_k += 1
    elif CMU.get(w):                     # secours phonologie CMUdict
        ipa = CMU[w]; n_ipa_c += 1
    lem = lemma_of(w, rec)
    num = 'p' if rec['num'] == {'p'} else ('s' if rec['num'] == {'s'} else '')
    gen = (sorted(rec['gen'])[0] if len(rec['gen']) == 1 else '')
    tags = num
    freq = FREQ.get(w, 0)
    lex_lines.append('%s\t%s\t%s\t%s\t%s\t%s\t%d' % (w, pos_csv, ipa, lem, tags, gen, freq))
    if ipa: n_ipa += 1
    if gen: n_gen += 1
    if rec['lem']: n_infl += 1

io.open(os.path.join(OUTDIR, 'lex_en.tsv'), 'w', encoding='utf-8').write(
    'surface\tpos\tipa\tlemma\ttags\tgender\tfreq\n' + '\n'.join(lex_lines) + '\n')
io.open(os.path.join(OUTDIR, 'homophones_en.json'), 'w', encoding='utf-8').write(
    json.dumps(homo_out, ensure_ascii=False, sort_keys=True, indent=0))
io.open(os.path.join(OUTDIR, 'forms_en.tsv'), 'w', encoding='utf-8').write(
    '\n'.join(sorted(forms_rows)) + '\n')

# --- versions SCOPÉES gzippées (COMMITTÉES) : lignes à signal utile (ipa OU freq>0 OU homophone).
# Le .tsv complet reste gitignoré (régénérable, ~30 Mo, comme Lexique4 côté FR).
kept = set()
scoped = ['surface\tpos\tipa\tlemma\ttags\tgender\tfreq']
for ln in lex_lines:
    c = ln.split('\t')
    surf, ipa, fq = c[0], c[2], c[6]
    if ipa or (fq.isdigit() and int(fq) > 0) or surf in homo_out:
        scoped.append(ln); kept.add(surf)
gzip.open(os.path.join(OUTDIR, 'lex_en.tsv.gz'), 'wt', encoding='utf-8').write('\n'.join(scoped) + '\n')
scoped_forms = [r for r in forms_rows if r.split('\t', 1)[0] in kept]
gzip.open(os.path.join(OUTDIR, 'forms_en.tsv.gz'), 'wt', encoding='utf-8').write(
    '\n'.join(sorted(scoped_forms)) + '\n')

N = len(lex_lines) or 1
print('ÉCRIT :', flush=True)
print('   lex_en.tsv         : %d surfaces (%.0f%% avec IPA [kaikki %d + cmu %d], %d genre, %d formes fléchies)' %
      (len(lex_lines), 100*n_ipa/N, n_ipa_k, n_ipa_c, n_gen, n_infl), flush=True)
print('   homophones_en.json : %d mots' % len(homo_out), flush=True)
print('   forms_en.tsv       : %d lemmes fléchis' % len(forms_rows), flush=True)
print('   [committé] lex_en.tsv.gz : %d surfaces à signal utile · forms_en.tsv.gz : %d lemmes' %
      (len(scoped) - 1, len(scoped_forms)), flush=True)
