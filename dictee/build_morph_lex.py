# -*- coding: utf-8 -*-
"""build_morph_lex.py — AUGMENTATION DU SPELLER depuis Morphalou 3.1 (ETAPE 3, 02/09/2026).

Apres GENDER_ACC (etape 2, gacc_lex_fr.tsv : 40 034 formes « connues mais jamais candidates »), Morphalou
(LGPL-LR, data_local/morphalou/, 976 570 formes flechies) comble le trou restant : 8 des 12 mots rares
mais corrects que « mot inconnu » marquait sur le corpus dys y sont (echafaudera, surfondu, petrifiantes,
moulurees, lampasse, caulinaires, omnisport, retombants).

Meme contrat que gacc : FreqOrtho 0 -> freq_milli 0 -> dans WORDS, jamais dans D2A/PHON (jamais candidat,
jamais concurrent). Base = asset COMMITE (git HEAD) UNION gacc_lex_fr.tsv (non circulaire). Filtres a la source :
  - categorie du LEMME (propagee : le CSV ne la porte que sur la ligne de lemme) parmi NOM/ADJ/VER/ADV ;
  - anti-masquage RAPIDE par deletions symetriques : aucun ajout a distance 1 d un mot FREQUENT (>= 1 occ/M
    Lexique4) — sinon la faute d un mot courant devient « valide » (dess->des, vermee->fermee, mesure).
DEUX sorties, MESUREES SEPAREMENT au moteur JS (A/B node deterministe, 1 998 phrases dys, 02/09) :
  morph_na_lex_fr.tsv  (NOM/ADJ/ADV, 81 042) : -9 marques inutiles, -1 fausse, +1 auto juste, 0 perdu ;
  morph_ver_lex_fr.tsv (VER, 384 869)       : -7 marques inutiles, 0 perdu — mais l asset passe de 1,07 a
                                               2,1 Mo gz et setLex de 0,95 a 1,58 s : decision de poids.
  python dictee/build_morph_lex.py            # regenere les deux TSV (Morphalou requis)
  python dictee/build_morph_lex.py --check    # forme des TSV commites (37 colonnes)
"""
import io, csv, gzip, subprocess, unicodedata, re, sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
OUT_NA = os.path.join(HERE, 'morph_na_lex_fr.tsv'); OUT_VER = os.path.join(HERE, 'morph_ver_lex_fr.tsv')

def generer():
    dea=lambda t:''.join(c for c in unicodedata.normalize('NFD',t) if unicodedata.category(c)!='Mn')
    base=set(l.split(chr(9))[0] for l in gzip.decompress(subprocess.run(['git','show','HEAD:extension/assets/speller.tsv.gz'],capture_output=True,cwd=ROOT).stdout).decode('utf-8').split(chr(10)) if l)
    base|=set(l.split(chr(9))[0] for l in io.open(os.path.join(HERE,'gacc_lex_fr.tsv'),encoding='utf-8'))
    based=set(dea(w) for w in base)
    freq=set()
    with io.open(os.environ.get('LEX4', os.path.join(ROOT,'data_local','Lexique4.tsv')),encoding='utf-8') as f:
        r=csv.reader(f,delimiter=chr(9)); H=next(r); ci={h.lower():i for i,h in enumerate(H)}
        cm=next(i for h,i in ci.items() if 'mot' in h); cf=next(i for h,i in ci.items() if 'freqortho' in h)
        for row in r:
            if len(row)<=max(cm,cf): continue
            try: fr=float((row[cf] or '0').replace(',','.'))
            except: fr=0.0
            if fr>=1.0: w=row[cm].strip().lower(); freq.add(w); freq.add(dea(w))
    def dels(w): return {w[:i]+w[i+1:] for i in range(len(w))}
    FD=set()
    for w in freq: FD|=dels(w)
    def masque(w):
        for x in (w,dea(w)):
            if x in freq or x in FD: return True
            dx=dels(x)
            if dx & freq or dx & FD: return True
        return False
    ok=re.compile(r"^[a-zà-ÿœæ'-]+$"); CAT={'Nom commun':'NOM','Adjectif qualificatif':'ADJ','Verbe':'VER','Adverbe':'ADV'}
    cat=None; lemme=None; rows={'NA':[], 'VER':[]}; seen=set()
    with io.open(os.path.join(ROOT,'data_local','morphalou','Morphalou3.1_CSV.csv'),encoding='utf-8',errors='replace') as fh:
        for l in fh:
            p=l.rstrip(chr(10)).split(';')
            if len(p)<12: continue
            if p[0].strip(): cat=p[2].strip() or cat; lemme=p[0].strip().lower()
            w=p[9].strip().lower()
            if not w or w in seen or not ok.match(w) or len(w)<3: continue
            if w in base or dea(w) in based: continue
            c=CAT.get(cat)
            if not c or masque(w): continue
            seen.add(w)
            g=(p[5].strip().lower()[:1] if c in ('NOM','ADJ') and p[5].strip() else (p[13].strip().lower()[:1] if len(p)>13 and c=='ADJ' else ''))
            g=g if g in ('m','f') else ''
            nb=p[11].strip().lower()[:1]; nb=nb if nb in ('s','p') else ''
            row=['']*37; row[0]=w; row[3]=lemme or w; row[4]=c; row[5]=c; row[6]=g; row[7]=nb; row[9]='0'; row[10]='0'; row[11]='0'
            rows['VER' if c=='VER' else 'NA'].append(chr(9).join(row))
    for k,fn in (('NA',OUT_NA),('VER',OUT_VER)):
        io.open(fn,'w',encoding='utf-8',newline=chr(10)).write(chr(10).join(rows[k])+chr(10))
        print('✓ %s : %d lignes -> %s' % (k, len(rows[k]), os.path.relpath(fn, ROOT)))


def main():
    if '--check' in sys.argv:
        ko = []
        for fn in (OUT_NA, OUT_VER):
            if not os.path.exists(fn):
                # le lot VER (384 869 lignes, ~15 Mo) n'est PAS commite tant que la decision de POIDS n'est pas prise
                # (asset x2, +0,6 s de chargement) : son absence est un etat connu, pas une derive.
                if fn == OUT_VER: print('· morph_lex : lot VER non commite (decision de poids en attente)'); continue
                ko.append(os.path.basename(fn) + ' absent'); continue
            bad = sum(1 for l in io.open(fn, encoding='utf-8') if len(l.rstrip(chr(10)).split(chr(9))) != 37)
            if bad: ko.append('%s : %d ligne(s) mal formee(s)' % (os.path.basename(fn), bad))
        if ko: print('✗ morph_lex : ' + ' ; '.join(ko)); return 1
        print('✓ morph_lex : NA %d lignes%s, 37 colonnes' % (sum(1 for _ in io.open(OUT_NA, encoding='utf-8')), (', VER %d lignes' % sum(1 for _ in io.open(OUT_VER, encoding='utf-8'))) if os.path.exists(OUT_VER) else '')); return 0
    if not os.path.exists(os.path.join(ROOT, 'data_local', 'morphalou', 'Morphalou3.1_CSV.csv')):
        print('✗ Morphalou absent (data_local/morphalou) : impossible de regenerer'); return 1
    generer(); return 0

if __name__ == '__main__':
    sys.exit(main())
