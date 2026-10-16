# -*- coding: utf-8 -*-
"""⭐ 16/10/2026 (liste n° 39) — PARITÉ du g2p du moteur : extension/assets/g2p.js (= app `_DECL2`, Node avec les tables de
conjugaison comme l'app) ≡ dictee/decompose.g2p_moteur (la référence Python), pas à pas (graphème, phonème) ; et BATTERIE de mots
publics à prononciation attendue (les règles de la liste n° 39 : ill, ail/eil, ti, glissement i, e ouvert/fermé, ou/u, x, sc…).
La comparaison normalise ɔ → o (comme la clé de son du speller) : le choix o/ɔ n'est pas tranché par ces règles.

  python dictee/g2p_parity_probe.py            # échantillon de 3 000 mots de phono_homophones.json (seed fixe) + batterie
  python dictee/g2p_parity_probe.py --check    # idem, code de sortie 1 au premier écart (CI, dev.sh)
  python dictee/g2p_parity_probe.py --all      # tous les mots de phono_homophones.json (114 007)
"""
import io, json, os, random, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import decompose as D

ACC = {'é': 'e', 'è': 'ɛ', 'ê': 'ɛ', 'ë': 'ɛ', 'à': 'a', 'â': 'a', 'ä': 'a', 'ô': 'o', 'ö': 'o', 'î': 'i', 'ï': 'i', 'û': 'y', 'ù': 'y', 'ü': 'y', 'ÿ': 'i', 'ç': 's'}
# (mot, prononciation attendue) — mots publics, IPA du moteur + overlay d'accents, muets exclus, ɔ écrit o.
BATTERIE = [
    ('fille', 'fij'), ('ville', 'vil'), ('tranquille', 'tʁɑ̃kil'), ('million', 'miljɔ̃'), ('famille', 'famij'), ('aiguille', 'ɛɡij'),
    ('travail', 'tʁavaj'), ('détails', 'detaj'), ('soleil', 'solɛj'), ('abeille', 'abɛj'), ('accueil', 'akœj'), ('orgueil', 'oʁɡœj'),
    ('cueillir', 'kœjiʁ'), ('fauteuil', 'fotœj'), ('fenouil', 'fənuj'), ('œil', 'œj'), ('oeil', 'œj'), ('feuille', 'fœj'), ('grenouille', 'ɡʁənuj'),
    ('nation', 'nasjɔ̃'), ('attention', 'atɑ̃sjɔ̃'), ('question', 'kɛstjɔ̃'), ('initial', 'inisjal'), ('essentiel', 'esɑ̃sjɛl'), ('ambitieux', 'ɑ̃bisjø'),
    ('maître', 'mɛtʁ'), ('boîte', 'bwat'), ('goût', 'ɡu'), ('où', 'u'), ('coeur', 'kœʁ'), ('cœur', 'kœʁ'), ('oeuf', 'œf'),
    ('plié', 'plije'), ('lié', 'lje'), ('accomplie', 'akɔ̃pli'), ('amies', 'ami'), ('ouvrier', 'uvʁije'), ('papier', 'papje'),
    ('première', 'pʁəmjɛʁ'), ('ouvrière', 'uvʁijɛʁ'), ('premiers', 'pʁəmje'), ('divers', 'divɛʁ'), ('vers', 'vɛʁ'), ('fers', 'fɛʁ'),
    ('mercredi', 'mɛʁkʁədi'), ('sera', 'səʁa'), ('terre', 'tɛʁ'), ('jouera', 'ʒuʁa'), ('vienne', 'vjɛn'), ('allient', 'ali'), ('vient', 'vjɛ̃'),
    ('voyage', 'vwajaʒ'), ('payer', 'peje'), ('pays', 'pɛi'), ('appuyer', 'apɥije'), ('examen', 'ɛɡzamɛ̃'), ('taxe', 'taks'), ('annexe', 'anɛks'),
    ('deuxième', 'døzjɛm'), ('cheval', 'ʃəval'), ('petit', 'pəti'), ('secret', 'səkʁɛ'), ('espace', 'ɛspas'), ('sec', 'sɛk'), ('leçon', 'ləsɔ̃'),
    ('emmener', 'ɑ̃məne'), ('femme', 'fam'), ('vitesse', 'vitɛs'), ('joue', 'ʒu'), ('oui', 'wi'), ('pingouin', 'pɛ̃ɡwɛ̃'), ('actuel', 'aktɥɛl'),
    ('muet', 'mɥɛ'), ('tuer', 'tɥe'), ('cruel', 'kʁyɛl'), ('escalier', 'ɛskalje'), ('science', 'sjɑ̃s'), ('patient', 'pasjɑ̃'), ('client', 'klijɑ̃'), ('vient', 'vjɛ̃'), ('bientôt', 'bjɛ̃to'), ('remerciement', 'ʁəmɛʁsimɑ̃'),
    ('manger', 'mɑ̃ʒe'), ('mangé', 'mɑ̃ʒe'), ('dessert', 'desɛʁ'), ('lettre', 'lɛtʁ'), ('belle', 'bɛl'), ('appeler', 'apəle'), ('demain', 'dəmɛ̃'),
    ('illégal', 'ileɡal'), ('bouillie', 'buji'), ('crient', 'kʁi'), ('oubliée', 'ublije'), ('compagnie', 'kɔ̃paɲi'), ('accompagniez', 'akɔ̃paɲe'),
]

def norm(s):
    return s.replace('ɔ', 'o')

def py_steps(w):
    return [[s['g'], s['ph']] for s in D.g2p(w, accents=False, seg=D.SEG_MOTEUR)]

def py_display(w):
    out = ''
    for g, ph in py_steps(w):
        if ph == '?' and g in ACC: ph = ACC[g]
        if ph and ph != '∅' and ph != '?': out += ph
    return out

def main():
    check = '--check' in sys.argv; allw = '--all' in sys.argv
    n = 3000
    if '--n' in sys.argv: n = int(sys.argv[sys.argv.index('--n') + 1])
    words = sorted(w for w in D.W2P if w.isalpha())
    if not words:
        print('[g2p-parité] phono_homophones.json absent — rien à comparer'); return 0
    if not allw:
        rnd = random.Random(39); words = rnd.sample(words, min(n, len(words)))
    words = sorted(set(words) | {w for w, _ in BATTERIE})
    tmp_in = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8'); json.dump(words, tmp_in); tmp_in.close()
    tmp_out = tmp_in.name + '.out'
    try:
        r = subprocess.run(['node', os.path.join(HERE, 'g2p_parity_node.js'), tmp_in.name, tmp_out], capture_output=True, text=True, encoding='utf-8')
        if r.returncode != 0:
            print('[g2p-parité] node a échoué :', (r.stderr or r.stdout).strip()[:400]); return 1
        js = json.load(io.open(tmp_out, encoding='utf-8'))
    finally:
        for p in (tmp_in.name, tmp_out):
            try: os.remove(p)
            except OSError: pass
    ecarts = []; cles = []
    for w in words:
        e = js.get(w) or {}; a = e.get('s'); b = py_steps(w)
        if a is None or [[g, norm(p)] for g, p in a] != [[g, norm(p)] for g, p in b]:
            ecarts.append((w, a, b))
        if e.get('k') is not None and e['k'] != D.g2p_moteur_cle(w):   # clé de son du speller : dys-core sonKey ≡ decompose.g2p_moteur_cle
            cles.append((w, e['k'], D.g2p_moteur_cle(w)))
    bat = []
    for w, att in BATTERIE:
        got = py_display(w)
        if norm(got) != norm(att): bat.append((w, att, got))
    print(f"[g2p-parité] JS ≡ Python sur {len(words)} mots : {len(words) - len(ecarts)} identiques, {len(ecarts)} écarts · clé de son (dys-core sonKey ≡ g2p_moteur_cle) {len(cles)} écarts · batterie {len(BATTERIE) - len(bat)}/{len(BATTERIE)}")
    for w, a, b in cles[:10]:
        print(f"   clé  {w:18s} JS={a!r:24s} Py={b!r}")
    for w, a, b in ecarts[:25]:
        print(f"   écart  {w:18s} JS={''.join(p for _, p in (a or []))!r:24s} Py={''.join(p for _, p in b)!r}")
    for w, att, got in bat:
        print(f"   batterie  {w:16s} attendu {att!r:18s} obtenu {got!r}")
    if check and (ecarts or bat or cles):
        print('[g2p-parité] ROUGE'); return 1
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
