# -*- coding: utf-8 -*-
# Génère une FICHE DE VALIDATION TERRAIN imprimable (HTML autonome) à partir de sentences.json.
# But : faire passer la dictée à de vrais élèves (dys) et MESURER l'accord entre le diagnostic
# de l'outil et le jugement de l'orthophoniste (doctrine §4 : le juge est humain ; §1 : falsifiable).
#
# Sortie : dictee/validation_terrain.html — 3 parties (saut de page entre chaque) :
#   A. Protocole examinateur + métadonnées élève (anonymisé)
#   B. Feuille EXAMINATEUR : 30 phrases à dicter + grille de relevé/comparaison (expert vs outil)
#   C. Feuille ÉLÈVE : lignes vierges numérotées (police lisible dys) — SANS le texte cible (c'est une dictée)
#   D. Synthèse : profil de stade + calcul du taux d'accord expert↔outil
#
# Régénérer : python3 dictee/build_validation_sheet.py
# Données : Lexique 4 (New et al. 2026, lexique.org) — CC BY-SA 4.0. Fiche dérivée = CC BY-SA 4.0.
import json, os, html
from diag_sentence import FAM2STAGE, STAGE_ORDER

HERE = os.path.dirname(os.path.abspath(__file__))
SENT = json.load(open(os.path.join(HERE, 'sentences.json'), encoding='utf-8'))

# Libellés lisibles (alignés sur l'app : LBL) + ordre par stade développemental.
FAM_LBL = {
    'voisee_sourde': 'sourde/sonore (p/b, t/d…)',
    'inversion':     'inversion de lettres',
    'ajout':         'lettre en trop',
    'surface':       'graphie plausible (sonne pareil)',
    'accent':        'accent',
    'muette':        'lettre muette',
    'homophone':     'homophone lexical',
    'accord':        'accord (genre/nombre/verbal)',
    'omission':      'mot oublié',
    'mot_en_trop':   'mot en trop',
}
STAGE_LBL = {
    'phonologique':     'phonologique — le SON',
    'alphabetique':     'alphabétique — écrit « comme ça sonne »',
    'lexical':          'lexical — orthographe du mot',
    'morphosyntaxique': 'morphosyntaxique — la GRAMMAIRE',
}
TRAP_ORDER = ['voisee_sourde', 'inversion', 'ajout', 'surface', 'accent', 'muette', 'homophone', 'accord']


def esc(s): return html.escape(str(s))


def build():
    out = []
    out.append('''<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Dictée diagnostique OMEGA — fiche de validation terrain</title>
<style>
 :root{ --ink:#1a1a1a; --line:#bbb; --soft:#f3efe4; }
 *{ box-sizing:border-box; }
 body{ font-family:"Trebuchet MS",Verdana,sans-serif; color:var(--ink); line-height:1.45; max-width:900px; margin:0 auto; padding:24px; }
 h1{ font-size:22px; margin:.2em 0; } h2{ font-size:18px; border-bottom:2px solid var(--ink); padding-bottom:3px; margin-top:1.4em; }
 h3{ font-size:15px; margin:.8em 0 .3em; }
 .small{ font-size:12px; color:#555; } .muted{ color:#666; }
 .meta{ display:grid; grid-template-columns:1fr 1fr; gap:8px 22px; margin:10px 0; }
 .meta div{ border-bottom:1px solid var(--line); padding:6px 2px; }
 .consigne{ background:var(--soft); border-left:4px solid #2a6f97; padding:10px 14px; border-radius:6px; }
 .phrase{ break-inside:avoid; margin:14px 0; padding-bottom:6px; border-bottom:1px dashed var(--line); }
 .ph-head{ font-weight:bold; } .ph-text{ font-size:17px; margin:3px 0; }
 .ph-traps{ font-size:11px; color:#666; } .ph-traps b{ color:#444; }
 table{ border-collapse:collapse; width:100%; font-size:12px; margin-top:6px; }
 th,td{ border:1px solid var(--line); padding:5px 6px; vertical-align:top; text-align:left; }
 th{ background:var(--soft); } td.fill{ height:26px; }
 .lignes div{ border-bottom:1.4px solid #999; height:34px; }
 .eleve{ font-family:Verdana,Tahoma,sans-serif; letter-spacing:.04em; word-spacing:.12em; }
 .eleve .ph-num{ font-weight:bold; font-size:15px; }
 .legend{ font-size:12px; columns:2; } .legend li{ margin:2px 0; }
 .stade-grid th, .stade-grid td{ text-align:center; }
 .box{ border:1.5px solid var(--ink); border-radius:8px; padding:10px 14px; }
 @media print{ body{ padding:0; max-width:none; } .pagebreak{ break-before:page; } a{ color:inherit; text-decoration:none; } }
 .pagebreak{ break-before:page; }
</style></head><body>''')

    # ---------- A. Protocole + métadonnées ----------
    out.append('<h1>Dictée diagnostique OMEGA — fiche de validation terrain</h1>')
    out.append('<p class="small">Objectif : confronter le diagnostic automatique (outil) au jugement de l\'orthophoniste, '
               'sur de vraies copies, pour <b>valider ou falsifier</b> le diagnostic par famille d\'erreur et par stade développemental. '
               'Corpus : 30 phrases graduées (10 faciles · 10 moyennes · 10 difficiles). '
               'Données : Lexique 4 (New et&nbsp;al. 2026, lexique.org) — CC&nbsp;BY-SA&nbsp;4.0.</p>')

    out.append('<h2>Consignes examinateur</h2>')
    out.append('<div class="consigne"><ol>'
               '<li><b>Anonymiser</b> : n\'inscrire qu\'un code élève (pas de nom). Recueillir l\'accord parental/du tuteur.</li>'
               '<li><b>Dicter</b> chaque phrase normalement (énoncé entier, puis répétition lente). L\'élève écrit sur la <i>feuille élève</i> '
               '(lignes vierges, il ne voit jamais le texte cible).</li>'
               '<li><b>Adapter au besoin</b> : on peut arrêter à un palier de difficulté (facile / moyen / difficile) selon le niveau.</li>'
               '<li><b>Diagnostiquer en aveugle</b> : sur la <i>feuille examinateur</i>, pour chaque mot fauté, noter le mot cible, '
               'ce que l\'élève a écrit, la <b>famille d\'erreur (votre jugement)</b> et le <b>stade</b>. '
               'Ne pas regarder l\'outil à ce stade.</li>'
               '<li><b>Comparer ensuite</b> : saisir la copie dans l\'app (bouton « ✍️ Dictée diag »), reporter la famille donnée par '
               'l\'outil et cocher <b>accord oui/non</b>. Reporter le total dans la synthèse (partie D).</li>'
               '</ol></div>')

    out.append('<h3>Métadonnées élève (anonymisé)</h3>')
    out.append('<div class="meta">'
               '<div>Code élève : </div><div>Date : </div>'
               '<div>Âge / classe : </div><div>Examinateur : </div>'
               '<div>Diagnostic connu (dyslexie / dysorthographie / autre / aucun) : </div>'
               '<div>Aménagements (police, temps majoré…) : </div>'
               '</div>')

    out.append('<h3>Familles d\'erreur &amp; stades (aide-mémoire)</h3>')
    out.append('<ul class="legend">')
    for st in STAGE_ORDER:
        fams = [f for f in TRAP_ORDER if FAM2STAGE.get(f) == st]
        labs = ', '.join(FAM_LBL[f] for f in fams)
        out.append(f'<li><b>{esc(STAGE_LBL[st])}</b> : {esc(labs)}</li>')
    out.append('<li class="muted">hors-stade : mot oublié, mot en trop (attention / lexique)</li>')
    out.append('</ul>')

    # ---------- B. Feuille examinateur ----------
    out.append('<div class="pagebreak"></div>')
    out.append('<h2>Feuille EXAMINATEUR — phrases à dicter &amp; relevé</h2>')
    out.append('<p class="small">Pour chaque mot fauté : remplir une ligne. « Stade » : ph (phonologique) · al (alphabétique) · '
               'lx (lexical) · ms (morphosyntaxique). « Outil » + « Accord » se remplissent après passage dans l\'app.</p>')
    cur = None
    for i, e in enumerate(SENT):
        if e['d'] != cur:
            cur = e['d']
            out.append(f'<h3>Niveau : {esc(cur)}</h3>')
        traps = ' · '.join(FAM_LBL.get(t, t) for t in e['traps'])
        out.append('<div class="phrase">')
        out.append(f'<div class="ph-head">Phrase {i+1}</div>')
        out.append(f'<div class="ph-text">« {esc(e["text"])} »</div>')
        out.append(f'<div class="ph-traps"><b>Pièges exerçables&nbsp;:</b> {esc(traps)}</div>')
        out.append('<table><tr>'
                   '<th style="width:18%">mot cible</th><th style="width:20%">écrit par l\'élève</th>'
                   '<th style="width:24%">famille (expert)</th><th style="width:8%">stade</th>'
                   '<th style="width:22%">famille (outil)</th><th style="width:8%">accord ?</th></tr>')
        for _ in range(2):
            out.append('<tr><td class="fill"></td><td></td><td></td><td></td><td></td><td></td></tr>')
        out.append('</table></div>')

    # ---------- C. Feuille élève ----------
    out.append('<div class="pagebreak"></div>')
    out.append('<h2 class="eleve">Feuille ÉLÈVE — dictée</h2>')
    out.append('<p class="small eleve">Écris chaque phrase sur la ligne qui porte son numéro. Prends ton temps.</p>')
    out.append('<div class="eleve lignes">')
    for i in range(len(SENT)):
        out.append(f'<div><span class="ph-num">{i+1}.</span></div>')
        if (i + 1) % 12 == 0 and i + 1 < len(SENT):
            out.append('</div><div class="pagebreak"></div><div class="eleve lignes">')
    out.append('</div>')

    # ---------- D. Synthèse ----------
    out.append('<div class="pagebreak"></div>')
    out.append('<h2>Synthèse — profil de stade &amp; accord expert↔outil</h2>')

    out.append('<h3>Profil de stade (nombre d\'erreurs par stade)</h3>')
    out.append('<table class="stade-grid"><tr><th>stade</th>'
               '<th>phonologique</th><th>alphabétique</th><th>lexical</th><th>morphosyntaxique</th>'
               '<th>hors-stade</th></tr>'
               '<tr><td>n erreurs (expert)</td><td></td><td></td><td></td><td></td><td></td></tr>'
               '<tr><td>n erreurs (outil)</td><td></td><td></td><td></td><td></td><td></td></tr></table>')
    out.append('<p class="small">Stade de l\'élève = bande la plus <b>en amont</b> où il bute encore (on maîtrise de bas en haut). '
               'Stade expert : <span class="muted">________________</span> · Stade outil : <span class="muted">________________</span> · '
               'concordent ? oui / non</p>')

    out.append('<h3>Taux d\'accord (validation du diagnostic)</h3>')
    out.append('<div class="box">'
               '<p>Nombre total d\'erreurs relevées : <b>______</b></p>'
               '<p>Erreurs où famille (expert) = famille (outil) : <b>______</b></p>'
               '<p>→ <b>Taux d\'accord</b> = ______ / ______ = <b>______ %</b></p>'
               '<p class="small">Cible interne (synthétique) = 100 % par famille. Un écart en terrain réel '
               'pointe une famille à revoir (rappeler le mot fauté + la famille expert).</p></div>')

    out.append('<h3>Observations qualitatives (cas où l\'outil se trompe)</h3>')
    out.append('<div class="lignes"><div></div><div></div><div></div></div>')

    out.append('<p class="small muted" style="margin-top:18px">Fiche générée par <code>dictee/build_validation_sheet.py</code> '
               'à partir de <code>dictee/sentences.json</code>. Licence : CC&nbsp;BY-SA&nbsp;4.0 (données Lexique&nbsp;4, '
               'New et&nbsp;al. 2026). Régénérer : <code>python3 dictee/build_validation_sheet.py</code>.</p>')

    out.append('</body></html>')
    return '\n'.join(out)


if __name__ == '__main__':
    htmlout = build()
    dest = os.path.join(HERE, 'validation_terrain.html')
    open(dest, 'w', encoding='utf-8').write(htmlout)
    print(f'écrit : {dest}  ({len(htmlout)} octets, {len(SENT)} phrases)')
