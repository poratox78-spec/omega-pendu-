# -*- coding: utf-8 -*-
"""omega_edit — éditer le monolithe sans retomber dans les pièges connus.

POURQUOI CE FICHIER EXISTE. Journée du 2026-08-03 : cinq pièges se sont répétés en éditant
`app/omega-pendu.html` (10,9 Mo) et `extension/dys-core.js`. Quatre sont MÉCANIQUES, donc
automatisables — les voici, encodés une fois pour toutes.

① FINS DE LIGNE (2 fois). Lire en mode texte puis écrire avec `newline=''` CONVERTIT tout le
   fichier CRLF → LF. `imp_probe.js` compare app ↔ extension OCTET PAR OCTET : la parité casse,
   et le diff devient illisible (26 000 lignes « modifiées »). Il faut lire ET écrire en
   `newline=''` — alors les `\\r\\n` restent dans la chaîne, et les ancres doivent les contenir.

② ZONE COMPARÉE (2 fois). `imp_probe.js` extrait « var _IMPVOW= » → fin de `_impMoves` et exige
   que l'app et l'extension soient IDENTIQUES sur cette tranche. Tout bloc inséré là — même
   correct — casse la parité s'il ne va pas dans les deux fichiers à l'identique.

③ LIGNE INERTE (1 fois). Ajouter `+'<div…>';` APRÈS le `;` qui termine une chaîne `innerHTML`
   donne du JS parfaitement VALIDE (unaire `+` sur une chaîne) et parfaitement SANS EFFET.
   Aucune erreur, aucun élément créé, et on cherche longtemps.

④ Le 5e piège (merger avec la CI rouge) n'est pas mécanique : c'est de la discipline.
   Le 4e (`navigator` absent sous Node) est couvert par `dictee/bake_probe.js`.

USAGE
    import sys; sys.path.insert(0, 'tools')
    from omega_edit import edit
    edit('app/omega-pendu.html', ancre, remplacement)     # lève si un piège est détecté

Chaque garde peut être levée explicitement (`autoriser_zone_parite=True`, `autoriser_inerte=True`)
— mais il faut le DIRE, ce qui force à savoir ce qu'on fait.
"""
import io
import os
import re

# Fichiers dont une tranche est comparée octet par octet entre l'app et l'extension.
_ZONE = {
    'omega-pendu.html': ('var _IMPVOW=', 'return out;}'),
    'dys-core.js': ('var _IMPVOW=', 'return out;}'),
}


class PiegeEdition(Exception):
    """Un piège connu a été détecté — le fichier n'a PAS été modifié."""


def lire(chemin):
    """Lit en préservant les fins de ligne. Renvoie (texte, séparateur)."""
    texte = io.open(chemin, encoding='utf-8', newline='').read()
    return texte, ('\r\n' if '\r\n' in texte else '\n')


def _zone_parite(chemin, texte):
    """(début, fin) de la tranche comparée octet-à-octet, ou None."""
    base = os.path.basename(chemin)
    bornes = _ZONE.get(base)
    if not bornes:
        return None
    a = texte.find(bornes[0])
    if a < 0:
        return None
    depart = texte.find('function _impMoves', a)
    f = texte.find(bornes[1], depart if depart >= 0 else a)
    return (a, f + len(bornes[1])) if f >= 0 else None


def _inerte(texte, position, nouveau):
    """Insertion APRÈS la fin d'une chaîne innerHTML → JS valide mais sans effet (piège ③)."""
    if "+'" not in nouveau and '+"' not in nouveau:
        return False
    avant = texte[max(0, position - 400):position]
    # dernière ligne non vide avant le point d'insertion
    lignes = [l for l in avant.split('\n') if l.strip()]
    if not lignes:
        return False
    derniere = lignes[-1].rstrip()
    # « …'; » = la chaîne est CLOSE : tout `+'…'` qui suit est une expression morte
    return bool(re.search(r"['\"]\s*;\s*$", derniere))


def edit(chemin, ancre, nouveau, autoriser_zone_parite=False, autoriser_inerte=False):
    """Remplace `ancre` par `nouveau`, une seule fois, en refusant les pièges connus.

    Les séparateurs de ligne de `ancre` et `nouveau` sont adaptés à ceux du fichier : on peut
    donc écrire ses chaînes avec de simples '\\n' sans se soucier des CRLF.
    """
    texte, nl = lire(chemin)
    if nl == '\r\n':                                   # ① adapter les ancres au fichier
        ancre = ancre.replace('\r\n', '\n').replace('\n', '\r\n')
        nouveau = nouveau.replace('\r\n', '\n').replace('\n', '\r\n')

    n = texte.count(ancre)
    if n != 1:
        raise PiegeEdition('ancre trouvée %d fois (il en faut exactement 1) dans %s' % (n, chemin))

    pos = texte.index(ancre)

    if not autoriser_zone_parite:                      # ② zone comparée octet-à-octet
        z = _zone_parite(chemin, texte)
        if z and z[0] <= pos < z[1]:
            raise PiegeEdition(
                'insertion DANS la zone comparée octet-à-octet (« var _IMPVOW= » → fin de _impMoves) '
                'de %s : imp_probe.js va casser. Place le bloc AVANT cette zone, ou passe '
                'autoriser_zone_parite=True si tu portes le MÊME code dans les deux moteurs.' % chemin)

    if not autoriser_inerte and _inerte(texte, pos, nouveau):   # ③ ligne morte après innerHTML
        raise PiegeEdition(
            'la ligne précédente termine une chaîne (…\';) : un « +\'…\' » ajouté ici est du JS '
            'VALIDE mais INERTE — rien ne sera créé. Crée le nœud en JS (document.createElement) '
            'ou insère AVANT le \';\'. (autoriser_inerte=True pour passer outre.)')

    crlf_avant = texte.count('\r\n')
    sortie = texte.replace(ancre, nouveau, 1)

    tmp = chemin + '.tmp'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(sortie)   # ① newline='' des DEUX côtés
    os.replace(tmp, chemin)

    relu, _ = lire(chemin)
    crlf_apres = relu.count('\r\n')
    perdus = crlf_avant - crlf_apres + nouveau.count('\r\n') - ancre.count('\r\n')
    if perdus:                                          # ① filet : la conversion a-t-elle eu lieu ?
        raise PiegeEdition('fins de ligne ALTÉRÉES (%+d CRLF) — le fichier a été converti, '
                           'la parité octet-à-octet va casser.' % -perdus)
    return True


if __name__ == '__main__':
    # Auto-test : on rejoue les trois pièges du 2026-08-03 sur des fichiers jetables.
    import tempfile, sys
    d = tempfile.mkdtemp()
    ok = []

    p1 = os.path.join(d, 'dys-core.js')
    io.open(p1, 'w', encoding='utf-8', newline='').write(
        "var a=1;\r\n  var _IMPVOW=/x/;\r\n  function _impMoves(t){var out=[];\r\n  return out;}\r\n  var z=2;\r\n")
    try:
        edit(p1, '  function _impMoves(t){var out=[];', '  var BLOC=1;\n  function _impMoves(t){var out=[];')
        ok.append('✗ ② zone comparée NON détectée')
    except PiegeEdition as e:
        ok.append('✓ ② zone comparée refusée' if 'octet-à-octet' in str(e) else '✗ ② mauvais message')

    p2 = os.path.join(d, 'x.html')
    io.open(p2, 'w', encoding='utf-8', newline='').write(
        "  el.innerHTML='<b>a</b>'\r\n   +'<i>b</i>';\r\n  document.body.appendChild(el);\r\n")
    try:
        edit(p2, '  document.body.appendChild(el);', "   +'<div id=\"z\"></div>';\n  document.body.appendChild(el);")
        ok.append('✗ ③ ligne inerte NON détectée')
    except PiegeEdition as e:
        ok.append('✓ ③ ligne inerte refusée' if 'INERTE' in str(e) else '✗ ③ mauvais message')

    p3 = os.path.join(d, 'y.js')
    io.open(p3, 'w', encoding='utf-8', newline='').write("ligne1\r\nligne2\r\nligne3\r\n")
    edit(p3, 'ligne2', 'ligne2bis\nligne2ter')
    brut = io.open(p3, 'rb').read()
    ok.append('✓ ① CRLF préservés' if brut.count(b'\r\n') == 4 and b'\n' not in brut.replace(b'\r\n', b'')
              else '✗ ① CRLF altérés (%d)' % brut.count(b'\r\n'))

    for l in ok:
        print('  ' + l)
    print('✅ omega_edit : 3/3 pièges couverts' if all(l.startswith('✓') for l in ok)
          else '❌ omega_edit : auto-test en échec')
    sys.exit(0 if all(l.startswith('✓') for l in ok) else 1)
