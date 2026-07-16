# -*- coding: utf-8 -*-
# Verrou de PARITÉ dev.sh ↔ .github/workflows/ci.yml.
#
#   dev.sh affiche « = ce que voit la CI » et son en-tête dit « miroir EXACT de ci.yml ». C'était FAUX : les deux
#   portent des listes de checks DUPLIQUÉES, qui dérivent en silence. Mesuré 2026-07-16 :
#     · dev.sh ne lançait PAS sw_probe.js — la garde du service worker (PR#178) n'était vérifiée qu'en CI, donc
#       « dev.sh vert » ne disait rien d'elle ;
#     · la CI lançait `node --check extension/popup.js` après la suppression du fichier → CI rouge alors que
#       dev.sh restait vert (PR#179).
#   Une affirmation en commentaire ne tient pas (cf. la même leçon sur `V` dans sw.js, ignoré 70 commits). Celle-ci
#   est donc CALCULÉE et vérifiée des deux côtés.
#
#   Principe : tout script (.py/.js) lancé d'un côté doit l'être de l'autre. Côté dev.sh on ne regarde QUE les
#   lignes passées par les wrappers `run`/`runsh` — un appel NU n'est pas compté comme un check (dev.sh n'a pas
#   `set -e` : son échec serait ignoré en silence), donc il ressortira ici comme un manque. C'est voulu.
#
#   Lancer : python3 dictee/ci_parity_probe.py
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
CI = os.path.join(ROOT, '.github', 'workflows', 'ci.yml')
DEV = os.path.join(ROOT, 'dev.sh')

# Asymétries LÉGITIMES, chacune motivée. Toute autre divergence casse ce check.
ALLOW_CI_ONLY = {}
ALLOW_DEV_ONLY = {
    'dictee/build_correcteur.js': "appelé DANS le runsh « correcteur AUTONOME (bake) » ; la CI a le même bake écrit autrement",
}


def scripts(text):
    """Chemins de scripts du dépôt réellement invoqués (on ignore ce qui n'existe pas : chemins temporaires)."""
    out = set()
    for m in re.finditer(r'[\w./-]+\.(?:py|js)', text):
        p = m.group(0).lstrip('./')
        if os.path.exists(os.path.join(ROOT, p)):
            out.add(p.replace('\\', '/'))
    return out


def main():
    ci_src = open(CI, encoding='utf-8').read()
    dev_src = open(DEV, encoding='utf-8').read()

    ci = set()
    for m in re.finditer(r'^\s+run:\s*(.+)$', ci_src, re.M):
        ci |= scripts(m.group(1))

    dev = set()
    for m in re.finditer(r'^\s*run(?:sh)?\s+"[^"]*"\s+(.+)$', dev_src, re.M):
        dev |= scripts(m.group(1))

    fail = []
    for f in sorted(ci - dev - set(ALLOW_CI_ONLY)):
        fail.append("lancé par la CI mais PAS par dev.sh (via run/runsh) : " + f
                    + "\n      ⇒ dev.sh peut être VERT pendant que la CI ÉCHOUE. Ajouter un `run` dans dev.sh.")
    for f in sorted(dev - ci - set(ALLOW_DEV_ONLY)):
        fail.append("lancé par dev.sh mais PAS par la CI : " + f
                    + "\n      ⇒ couverture locale illusoire (rien ne le garde sur une PR). Ajouter une étape à ci.yml.")

    # le compteur de dev.sh doit dire la VÉRITÉ : PASS/(PASS+FAIL), pas PASS/PASS (toujours « N/N »)
    if re.search(r'\$PASS/\$\(\(PASS\)\)', dev_src):
        fail.append("dev.sh affiche $PASS/$((PASS)) = toujours « N/N » : un total tautologique qui ne peut jamais "
                    "révéler un manque.\n      ⇒ utiliser $((PASS+FAIL)).")

    if fail:
        print('✗ PARITÉ dev.sh ↔ ci.yml KO :\n  ' + '\n  '.join(fail))
        return 1
    print('✓ parité dev.sh ↔ ci.yml : %d scripts lancés des DEUX côtés (%d asymétrie(s) motivée(s)).'
          % (len(ci & dev), len(ALLOW_CI_ONLY) + len(ALLOW_DEV_ONLY)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
