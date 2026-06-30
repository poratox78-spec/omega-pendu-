# -*- coding: utf-8 -*-
# AUTO-GLOSSES depuis le WIKTIONNAIRE (fr.wiktionary.org, CC BY-SA — compatible avec nos données Lexique).
# Pour chaque forme-clé des groupes de confusables, récupère la 1re définition DE LA SECTION FRANÇAISE, nettoie le
# wikitext, tronque en gloss court. Lots de 50, cache du wikitext BRUT (dictee/glosses_cache.json, gitignoré → réextraction
# gratuite). Sortie : glosses_wiktionnaire.json {forme: gloss}. build_confusables.js l'utilise en REPLI (manuel prioritaire).
#   Usage : python3 dictee/build_glosses_wiktionnaire.py        (réseau au 1er run ; ensuite cache)
import json, os, re, time, urllib.request, urllib.parse
HERE = os.path.dirname(__file__)
API = 'https://fr.wiktionary.org/w/api.php'
UA = 'OMEGA-dys/1.0 (correcteur dys; recherche; +github.com/poratox78-spec/omega-pendu-)'

def fr_section(txt):                                      # ne garde que la section LANGUE FRANÇAISE (≠ codes ISO étrangers)
    m = re.search(r'==\s*\{\{langue\|fr\}\}\s*==', txt) or re.search(r'==\s*\{\{=fr=\}\}\s*==', txt)
    if not m: return ''
    start = m.end(); nxt = re.search(r'\n==\s*\{\{langue\|', txt[start:])
    return txt[start: start + nxt.start()] if nxt else txt[start:]

def clean_def(line):
    s = line[2:].strip()
    for _ in range(3): s = re.sub(r'\{\{[^{}]*\}\}', '', s)   # templates {{...}}
    s = re.sub(r'\[\[[^\]|]*\|([^\]]*)\]\]', r'\1', s)        # [[lien|texte]] -> texte
    s = re.sub(r'\[\[([^\]]*)\]\]', r'\1', s)                 # [[lien]] -> lien
    s = re.sub(r"'''?|<[^>]+>", '', s)
    s = re.sub(r'\s+', ' ', s).strip(" .,:;—-")
    s = re.split(r'(?<=[a-zéèêàùîç])\. ', s)[0].strip()       # 1re phrase
    if len(s) > 90: s = s[:88].rsplit(' ', 1)[0] + '…'
    return s

def first_def(raw):
    fr = fr_section(raw)
    for l in fr.split('\n'):
        s = l.strip()
        if s.startswith('# ') and not s.startswith('#*') and not s.startswith('# *'):
            g = clean_def(s)
            if len(g) >= 4: return g
    return None

conf = json.load(open(os.path.join(HERE, 'confusables.json'), encoding='utf-8'))
forms, seen = [], set()
for g in conf['groups']:
    fl = [f for f in g['forms'] if ' ' not in f and len(f) >= 3]
    keys = list(g.get('gloss') or {})
    # si gloss curé → ses clés ; sinon → les formes CANONIQUES (on saute les flexions dérivées d'une autre forme du groupe)
    targets = keys if keys else [f for f in fl if not any(o != f and f in (o + 's', o + 'x', o + 'e', o + 'es') for o in fl)]
    for f in targets:
        if f not in seen: seen.add(f); forms.append(f)
print('formes à glosser : %d' % len(forms))

CACHE = os.path.join(HERE, 'glosses_cache.json')          # {forme: wikitext brut ou None} — gitignoré
cache = json.load(open(CACHE, encoding='utf-8')) if os.path.exists(CACHE) else {}
todo = [f for f in forms if f not in cache]
print('en cache : %d · à récupérer : %d' % (len(forms) - len(todo), len(todo)))
for i in range(0, len(todo), 50):
    batch = todo[i:i + 50]
    q = {'action': 'query', 'format': 'json', 'prop': 'revisions', 'rvslots': 'main',
         'rvprop': 'content', 'titles': '|'.join(batch), 'formatversion': '2'}
    req = urllib.request.Request(API + '?' + urllib.parse.urlencode(q), headers={'User-Agent': UA})
    data = json.load(urllib.request.urlopen(req, timeout=30))
    for pg in data['query']['pages']:
        cache[pg['title']] = None if (pg.get('missing') or 'revisions' not in pg) else pg['revisions'][0]['slots']['main']['content']
    json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False)
    print('  lot %d-%d ok' % (i, i + len(batch))); time.sleep(0.3)

out = {}
for f in forms:
    raw = cache.get(f)
    if raw:
        g = first_def(raw)
        if g: out[f] = g
out['_attribution'] = 'Définitions : Wiktionnaire (fr.wiktionary.org), CC BY-SA 4.0'
json.dump(out, open(os.path.join(HERE, 'glosses_wiktionnaire.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('écrit glosses_wiktionnaire.json : %d glosses' % (len(out) - 1))
print('\n=== échantillon (dont ex-ratés mer/ver) ===')
for f in ['mer', 'ver', 'père', 'paire', 'cygne', 'éminent', 'imminent', 'conjoncture', 'amnistie', 'côte']:
    if out.get(f): print('  %-12s %s' % (f, out[f]))
