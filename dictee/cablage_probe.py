# -*- coding: utf-8 -*-
# GARDE « FAIT, BIEN FAIT, JAMAIS CÂBLÉ » (liste n° 411, 06/11/2026).
#
#   Rem (06/11, paraphrase) : attention aux liaisons, des choses faites et bien faites n'ont jamais été câblées. Mesuré le même
#   jour : 11 scripts du dépôt savaient se vérifier (`--check`) et AUCUN banc ne les lançait — ni dev.sh, ni la CI. L'un d'eux
#   aurait vu que la table des noms propres du début de phrase (dictee/noms_tete.txt, littéral NP46 des deux moteurs) avait
#   pris du retard sur son script depuis le 17/10 : 15 noms propres marqués à tort, 135 entrées devenues inutiles. Personne ne
#   l'a vu, parce qu'un contrôle qu'on ne lance pas ne peut pas échouer (même famille que la batterie aveugle du 01/09).
#
#   Ce que vérifie la garde : tout script .py / .js du dépôt qui a un mode `--check` est LANCÉ avec `--check` par dev.sh (lignes
#   `run` / `runsh`) ou par la CI (lignes `run:`), ou figure dans EXEMPTS avec sa raison. Un commentaire qui NOMME le script ne
#   compte pas (le cas de build_prenoms.py, nommé dans ci.yml et lancé nulle part). Une exemption qui ne sert plus (fichier
#   disparu, ou script désormais lancé) fait aussi échouer : la liste reste vraie.
#
#   Lancer : python3 dictee/cablage_probe.py            (sortie 1 si un contrôle n'est câblé nulle part)
#            python3 dictee/cablage_probe.py --dev F --ci G   (autres fichiers de bancs : pour falsifier la garde)
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
DOSSIERS = ['', 'dictee', 'extension', 'tools', 'word', 'app', 'ia']

# Scripts à `--check` qu'aucun banc ne lance, chacun pour une raison écrite. Toute autre absence casse la garde.
EXEMPTS = {
    'dictee/b2_export_web.py': "outil local : il recharge un modèle .pt rangé dans data_local/ ; rien de ce qu'il produit n'est livré",
    'dictee/export_batterie.py': "moteur Python débranché (ligne 25b) : dictee/batterie_correcteur.json est devenu la SOURCE, éditée à la main ; ⛔ ne pas relancer l'export sans --check : il écraserait la source",
    'dictee/export_recall.py': "moteur Python débranché (ligne 25b) : dictee/recall_comportements.json est devenu la SOURCE, éditée à la main ; ⛔ ne pas relancer l'export sans --check : il écraserait la source",
    'dictee/export_couverture.py': "moteur Python débranché (ligne 25b) : le JSON exporté ne suit plus le Python, le produit le rejoue seul",
    'dictee/export_gender_coll.py': "moteur Python débranché (ligne 25b) : le JSON exporté ne suit plus le Python, le produit le rejoue seul",
    'dictee/sujet_relative_probe.py': "mesure du moteur Python débranché (ligne 25b) : elle ne dit rien du produit",
    'dictee/recall_probe.py': "moteur Python débranché (ligne 25b) : remplacé au banc par dictee/recall_produit.js (dev.sh l'annonce en tête)",
    'dictee/fp_scale_probe.py': "moteur Python débranché (ligne 25b) : remplacé au banc par dictee/fp_scale_produit.js",
    'dictee/gender_coll_probe.py': "moteur Python débranché (ligne 25b) : remplacé au banc par dictee/gender_coll_produit.js",
}

RE_CHECK = re.compile(r"""['"]--check['"]""")


def scripts_a_check():
    out = []
    for d in DOSSIERS:
        base = os.path.join(ROOT, d)
        if not os.path.isdir(base):
            continue
        for f in sorted(os.listdir(base)):
            if not f.endswith(('.py', '.js')) or f == os.path.basename(__file__):
                continue
            p = os.path.join(base, f)
            try:
                s = open(p, encoding='utf-8').read()
            except (UnicodeDecodeError, OSError):
                continue
            if RE_CHECK.search(s):
                out.append((d + '/' + f) if d else f)
    return out


def lignes_lancees(dev_src, ci_src):
    """Les lignes qui LANCENT quelque chose : `run`/`runsh` de dev.sh, `run:` de la CI (commentaires exclus)."""
    L = [m.group(1) for m in re.finditer(r'^\s*run(?:sh)?\s+"[^"]*"\s+(.+)$', dev_src, re.M)]
    L += [m.group(1) for m in re.finditer(r'^\s+run:\s*(.+)$', ci_src, re.M)]
    # un bloc `run: |` de la CI : ses lignes suivantes plus indentées sont des commandes
    for m in re.finditer(r'^(\s+)run:\s*\|\s*\n((?:\1\s+.*\n?)+)', ci_src, re.M):
        L += [l.strip() for l in m.group(2).split('\n') if l.strip() and not l.strip().startswith('#')]
    return L


def main(argv):
    dev = argv[argv.index('--dev') + 1] if '--dev' in argv else os.path.join(ROOT, 'dev.sh')
    ci = argv[argv.index('--ci') + 1] if '--ci' in argv else os.path.join(ROOT, '.github', 'workflows', 'ci.yml')
    L = lignes_lancees(open(dev, encoding='utf-8').read(), open(ci, encoding='utf-8').read())
    tous = scripts_a_check()
    fail, ok = [], 0
    for s in tous:
        lance = any(s in l and '--check' in l for l in L)
        if s in EXEMPTS:
            if lance:
                fail.append('exemption périmée : %s est lancé avec --check, retirer son entrée de EXEMPTS' % s)
            continue
        if lance:
            ok += 1
        else:
            fail.append('%s a un mode --check que NI dev.sh NI la CI ne lance : le contrôle existe et ne peut pas échouer.\n'
                        '      ⇒ ajouter `run "…" … %s --check` à dev.sh (et l\'étape à ci.yml), ou une entrée motivée dans EXEMPTS.' % (s, s))
    for s in sorted(EXEMPTS):
        if not os.path.exists(os.path.join(ROOT, s)):
            fail.append('exemption périmée : %s n\'existe plus, retirer son entrée de EXEMPTS' % s)
    if len(tous) < 40:
        fail.append('seulement %d scripts à --check trouvés : la recherche ne lit plus le dépôt ?' % len(tous))
    if fail:
        print('✗ CÂBLAGE DES CONTRÔLES KO :\n  ' + '\n  '.join(fail))
        return 1
    print('✓ câblage : %d scripts à --check, %d lancés avec --check par dev.sh ou la CI, %d exemptés pour une raison écrite.'
          % (len(tous), ok, len(EXEMPTS)))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
