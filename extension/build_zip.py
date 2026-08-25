# -*- coding: utf-8 -*-
# Construit omega-correcteur-dys.zip (l'extension téléchargeeable du site) depuis extension/ — et, en mode
# --check, vérifie que le zip COMMITÉ est FRAIS (mêmes fichiers, mêmes octets que les sources).
# Audit 07/2026 : le zip distribué avait 53 commits de retard (fixes FP non livrés) et AUCUNE garde.
#   python3 extension/build_zip.py            → (re)génère le zip à la racine du repo
#   python3 extension/build_zip.py --check    → sort 1 si le zip ne correspond pas aux sources (mode CI)
#   python3 extension/build_zip.py --store    → paquet de SOUMISSION Chrome Web Store (manifest à la racine,
#                                               non commité : artefact de publication, cf. extension/STORE.md)
import gzip, io, json, os, sys, zipfile

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
ZIP  = os.path.join(ROOT, 'omega-correcteur-dys.zip')          # zip du SITE (à dézipper → « extension non empaquetée »)
STORE_ZIP = os.path.join(ROOT, 'omega-correcteur-dys-store.zip')  # zip du CHROME WEB STORE (manifest.json à la RACINE)

# fichiers LIVRÉS (le zip = ce qu'un utilisateur installe ; les harnais de dev restent hors zip)
# popup.html/popup.js RETIRÉS : depuis 0.3.0 l'icône ouvre le PANNEAU (default_popup enlevé du manifest) → le popup
# était devenu INJOIGNABLE, et ses réglages (taille de texte, sombre) livrés en code mort. Ils vivent dans le panneau.
# micro.html/micro.js : page d'AUTORISATION MICRO ouverte dans un vrai onglet — le side panel ne peut
# pas afficher l'invite (contexte « offscreen »). Sans elles dans le zip, la dictée reste muette.
FILES = ['manifest.json', 'content.js', 'content.css', 'dys-core.js', 'calc_dys.js', 'background.js', 'sidepanel.html', 'sidepanel.js', 'son_panel.js', 'micro.html', 'micro.js', 'README.md']
EXCLUDE_DIRS = set()

def shipped():
    out = []
    for f in FILES:
        out.append(('extension/' + f, os.path.join(HERE, f)))
    for sub in ('assets', 'icons'):
        d = os.path.join(HERE, sub)
        for name in sorted(os.listdir(d)):
            p = os.path.join(d, name)
            if os.path.isfile(p):
                out.append(('extension/%s/%s' % (sub, name), p))
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

def build_store():
    """Paquet de SOUMISSION au Chrome Web Store. Deux différences avec le zip du site, toutes les deux
    imposées par le Store : (1) `manifest.json` doit être à la RACINE du zip (pas sous `extension/`, sinon
    « Manifest file is missing or unreadable ») ; (2) on ne livre pas `README.md` (instructions d'install
    manuelle : sans objet une fois publié, et le Store n'aime pas les fichiers non utilisés)."""
    entries = [(arc[len('extension/'):], path) for arc, path in shipped()
               if not arc.endswith('/README.md')]
    with zipfile.ZipFile(STORE_ZIP, 'w', zipfile.ZIP_DEFLATED) as z:
        for arc, path in entries:
            zi = zipfile.ZipInfo(arc, date_time=(2026, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            with open(path, 'rb') as f:
                data = f.read()
            if arc.endswith(TEXT_EXT):
                data = data.replace(b'\r\n', b'\n')
            z.writestr(zi, data)
    names = zipfile.ZipFile(STORE_ZIP).namelist()
    assert 'manifest.json' in names, 'manifest.json doit être à la racine du zip Store'
    mo = json.loads(zipfile.ZipFile(STORE_ZIP).read('manifest.json').decode('utf-8'))
    for n in ('16', '32', '48', '128'):
        assert mo.get('icons', {}).get(n) in names, 'icône %s manquante dans le paquet' % n
    assert len(mo['description']) <= 132, 'description manifeste > 132 caractères (refus du Store)'
    print('paquet Store écrit :', STORE_ZIP,
          '(%d fichiers, %.1f Mo, version %s)' % (len(names), os.path.getsize(STORE_ZIP) / 1e6, mo['version']))
    return 0


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
    if '--check' in sys.argv:   sys.exit(check())
    elif '--store' in sys.argv: sys.exit(build_store())
    else:                       sys.exit(build() or 0)
