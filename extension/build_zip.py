# -*- coding: utf-8 -*-
# Construit omega-correcteur-dys.zip (l'extension téléchargeeable du site) depuis extension/ — et, en mode
# --check, vérifie que le zip COMMITÉ est FRAIS (mêmes fichiers, mêmes octets que les sources).
# Audit 07/2026 : le zip distribué avait 53 commits de retard (fixes FP non livrés) et AUCUNE garde.
#   python3 extension/build_zip.py            → (re)génère le zip à la racine du repo
#   python3 extension/build_zip.py --check    → sort 1 si le zip ne correspond pas aux sources (mode CI)
import gzip, io, os, sys, zipfile

TEXT_EXT = ('.js', '.css', '.html', '.json', '.md', '.txt')

def norm(name, data):
    """Comparaison/écriture INDÉPENDANTE de la plateforme : le texte est normalisé en LF (un zip construit
    sous Windows (CRLF) doit rester frais face à un checkout CI Linux (LF)) ; les .gz sont comparés sur leur
    CONTENU décompressé (l'en-tête gzip embarque mtime/OS → régénérer les assets change les octets, pas le contenu)."""
    if name.endswith('.gz'):
        try: return gzip.decompress(data)
        except Exception: return data
    if name.endswith(TEXT_EXT):
        return data.replace(b'\r\n', b'\n')
    return data

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ZIP  = os.path.join(ROOT, 'omega-correcteur-dys.zip')

# fichiers LIVRÉS (le zip = ce qu'un utilisateur installe ; les harnais de dev restent hors zip)
# popup.html/popup.js RETIRÉS : depuis 0.3.0 l'icône ouvre le PANNEAU (default_popup enlevé du manifest) → le popup
# était devenu INJOIGNABLE, et ses réglages (taille de texte, sombre) livrés en code mort. Ils vivent dans le panneau.
FILES = ['manifest.json', 'content.js', 'content.css', 'dys-core.js', 'background.js', 'sidepanel.html', 'sidepanel.js', 'README.md']
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
                data = f.read()
            if arc.endswith(TEXT_EXT):
                data = data.replace(b'\r\n', b'\n')                       # livraison en LF quel que soit l'OS de build
            z.writestr(zi, data)
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
            if norm(arc, z.read(arc)) != norm(arc, open(path, 'rb').read()):
                bad.append('PÉRIMÉ (contenu ≠ source) : ' + arc)
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
