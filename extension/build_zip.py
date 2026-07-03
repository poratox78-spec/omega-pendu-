# -*- coding: utf-8 -*-
# Construit omega-correcteur-dys.zip (l'extension téléchargeeable du site) depuis extension/ — et, en mode
# --check, vérifie que le zip COMMITÉ est FRAIS (mêmes fichiers, mêmes octets que les sources).
# Audit 07/2026 : le zip distribué avait 53 commits de retard (fixes FP non livrés) et AUCUNE garde.
#   python3 extension/build_zip.py            → (re)génère le zip à la racine du repo
#   python3 extension/build_zip.py --check    → sort 1 si le zip ne correspond pas aux sources (mode CI)
import io, os, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ZIP  = os.path.join(ROOT, 'omega-correcteur-dys.zip')

# fichiers LIVRÉS (le zip = ce qu'un utilisateur installe ; les harnais de dev restent hors zip)
FILES = ['manifest.json', 'content.js', 'content.css', 'dys-core.js', 'popup.html', 'popup.js', 'README.md']
EXCLUDE_DIRS = set()

def shipped():
    out = []
    for f in FILES:
        out.append(('extension/' + f, os.path.join(HERE, f)))
    adir = os.path.join(HERE, 'assets')
    for name in sorted(os.listdir(adir)):
        p = os.path.join(adir, name)
        if os.path.isfile(p):
            out.append(('extension/assets/' + name, p))
    return out

def build():
    entries = shipped()
    with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED) as z:
        for arc, path in entries:
            zi = zipfile.ZipInfo(arc, date_time=(2026, 1, 1, 0, 0, 0))   # horodatage FIXE → zip reproductible
            zi.compress_type = zipfile.ZIP_DEFLATED
            with open(path, 'rb') as f:
                z.writestr(zi, f.read())
    print('zip écrit :', ZIP, '(%d fichiers)' % len(entries))

def check():
    if not os.path.exists(ZIP):
        print('✗ zip absent :', ZIP); return 1
    entries = dict(shipped())
    bad = []
    with zipfile.ZipFile(ZIP) as z:
        names = set(z.namelist())
        for arc, path in entries.items():
            if arc not in names:
                bad.append('MANQUANT dans le zip : ' + arc); continue
            if z.read(arc) != open(path, 'rb').read():
                bad.append('PÉRIMÉ (octets ≠ source) : ' + arc)
        for n in names:
            if n not in entries:
                bad.append('EN TROP dans le zip (pas une source livrée) : ' + n)
    if bad:
        print('✗ ZIP EXTENSION PAS FRAIS — régénérer avec : python3 extension/build_zip.py')
        for b in bad: print('   ', b)
        return 1
    print('✓ zip extension frais : %d fichiers == sources' % len(entries))
    return 0

if __name__ == '__main__':
    sys.exit(check() if '--check' in sys.argv else (build() or 0))
