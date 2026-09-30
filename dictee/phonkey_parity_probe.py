# -*- coding: utf-8 -*-
u"""PARITÉ DE LA CLÉ PHONÉTIQUE — Python (speller_probe.phon_key) ↔ JS (phonKey de dys-core, de l'app, de l'app anglaise).

NÉE D'UNE DIVERGENCE MESURÉE (28/09/2026). Sur tout mot en « oeu/œu », les moteurs ne donnaient pas la même clé :
« cœur » → "koer" en Python (« oeu » était remplacé APRÈS « eu », donc jamais), "ser" en JS (« oeu » → e AVANT le c, qui
devenait doux : /s/). Les candidats phonétiques du speller différaient entre la référence et le produit — « seur » trouvait
« sœur » dans le produit, pas dans la référence ; « ker » ne trouvait « cœur » nulle part — et aucun banc ne comparait la clé.

La clé juste : « oeu » prend la classe « e » (/kœʁ/ ≈ "ker", /sœʁ/ ≈ "ser") APRÈS le choix dur/doux du c et du g, parce que le
c était écrit devant un o : il reste /k/ (cœur, écœurant). « œ » sans u (cœlacanthe, fœtus) n'est PAS traité ici : sa clé ne
bouge pas, et elle doit rester la même des deux côtés.

Vérifie : ① les quatre copies (Python + trois JS) donnent la même clé sur toute la liste ; ② les clés ATTENDUES.
    python3 dictee/phonkey_parity_probe.py        # sort 1 au moindre écart
"""
import json, os, subprocess, sys

if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from speller_probe import phon_key

ATTENDU = {u'cœur': u'ker', u'coeur': u'ker', u'sœur': u'ser', u'soeur': u'ser', u'vœu': u'v', u'voeu': u'v',
           u'nœud': u'ned', u'noeud': u'ned', u'œuf': u'ef', u'oeuf': u'ef', u'bœuf': u'bef', u'boeuf': u'bef',
           u'mœurs': u'mer', u'moeurs': u'mer', u'œuvre': u'evr', u'oeuvre': u'evr', u'écœurant': u'eker2',
           u'manœuvre': u'manevr', u'sœurs': u'ser', u'vœux': u'v',
           u'ker': u'ker', u'keur': u'ker', u'seur': u'ser',            # graphies dys : elles doivent retrouver cœur et sœur
           u'cœlacanthe': u'koelak2t', u'coelacanthe': u'koelak2t',   # œ SANS u ; le t devant le e muet ÉCRIT est gardé (30/09/2026)
           u'cette': u'set', u'séte': u'set', u'fête': u'fet', u'fêtes': u'fet', u'reste': u'rest'}   # ⭐ 30/09/2026 : plus de clé vide (« cette » = « sais » = « »)
AUTRES = [u'chœur', u'Cœur', u'CŒUR', u'œil', u'queue', u'feu', u'peur', u'goéland', u'coexister', u'faute', u'leçon', u'noix']
MOTS = list(ATTENDU) + AUTRES
FICHIERS = ['extension/dys-core.js', 'app/omega-pendu.html', 'app/omega-pendu-en.html']

JS = r"""
const fs = require('fs'), vm = require('vm');
const [mots, fichiers] = JSON.parse(process.argv[1]);
const prendre = (src, nom) => { const i = src.indexOf('function ' + nom + '('); if (i < 0) return null;
  let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return null; };
const out = {};
for (const f of fichiers) {
  const src = fs.readFileSync(f, 'utf8'), a = prendre(src, 'deaccS'), b = prendre(src, 'phonKey');
  if (!a || !b) { out[f] = null; continue; }
  const ctx = {}; vm.createContext(ctx); vm.runInContext(a + '\n' + b + '\nthis.k = phonKey;', ctx);
  out[f] = mots.map(w => ctx.k(w));
}
console.log(JSON.stringify(out));
"""


def main():
    r = subprocess.run(['node', '-e', JS, json.dumps([MOTS, FICHIERS])], capture_output=True, text=True, encoding='utf-8', cwd=ROOT)
    if r.returncode != 0:
        print(u'✗ CLÉ PHONÉTIQUE : node a échoué\n' + (r.stderr or '')[-400:])
        return 1
    js = json.loads(r.stdout)
    ko = []
    for f in FICHIERS:
        if js.get(f) is None: ko.append(u'%s : phonKey ou deaccS introuvable' % f)
    py = [phon_key(w) for w in MOTS]
    for k, w in enumerate(MOTS):
        cles = {u'python': py[k]}
        for f in FICHIERS:
            if js.get(f) is not None: cles[f] = js[f][k]
        if len(set(cles.values())) > 1:
            ko.append(u'« %s » : les moteurs divergent %s' % (w, json.dumps(cles, ensure_ascii=False)))
        elif w in ATTENDU and py[k] != ATTENDU[w]:
            ko.append(u'« %s » : clé "%s", attendue "%s"' % (w, py[k], ATTENDU[w]))
    if ko:
        print(u'✗ CLÉ PHONÉTIQUE : %d écart(s)' % len(ko))
        for x in ko: print(u'   ' + x)
        return 1
    print(u'✓ CLÉ PHONÉTIQUE : Python ≡ dys-core ≡ app ≡ app anglaise sur %d mots, %d clés attendues tenues (cœur → ker, sœur → ser, ker → ker)'
          % (len(MOTS), len(ATTENDU)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
