# -*- coding: utf-8 -*-
# Loader prêt-à-l'emploi : récupère de VRAIES paires (phrase erronée → corrigée) FRANÇAISES depuis un corpus
# ouvert de correction grammaticale, pour (a) valider le correcteur sur données indépendantes, (b) nourrir la
# boucle descendante (GRAMMAIRE_DOUBLE_VOIE.md).
#
# Source par défaut : juancavallotti/multilingual-gec (HF) — ~67 000 phrases FR, synthétiques (Tatoeba corrompu).
#   doc : https://huggingface.co/datasets/juancavallotti/multilingual-gec
# Autres sources repérées : GitHub Typo Corpus (multilingue, vraies typos), Lang-8 nettoyé.
#
# ⚠️ ÉGRESS : dans la session cloud, l'hôte `datasets-server.huggingface.co` n'est PAS dans l'allowlist
#    réseau (curl → « Host not in allowlist » ; WebFetch → 403). Ce script tourne là où l'égress l'autorise
#    (machine de Rem, ou allowlist ajoutée). Sortie : dictee/corpus_gec_fr.jsonl (un objet {bad,good} par ligne).
import json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATASET = os.environ.get('GEC_DATASET', 'juancavallotti/multilingual-gec')
CONFIG = os.environ.get('GEC_CONFIG', 'default')
SPLIT = os.environ.get('GEC_SPLIT', 'train')
N = int(os.environ.get('GEC_N', '500'))
OUT = os.path.join(HERE, 'corpus_gec_fr.jsonl')
API = "https://datasets-server.huggingface.co/rows?dataset={d}&config={c}&split={s}&offset={o}&length={l}"


def _fr(row):
    """Heuristique : ne garder que les lignes françaises (champ langue, sinon mots-outils typiques)."""
    lang = str(row.get('language') or row.get('lang') or '').lower()
    if lang:
        return lang.startswith('fr')
    txt = ' '.join(str(v) for v in row.values()).lower()
    return any(f' {w} ' in ' '+txt+' ' for w in ('le', 'la', 'les', 'des', 'est', 'une'))


def _pair(row):
    """Repère (erroné, corrigé) quels que soient les noms de colonnes."""
    keys = {k.lower(): k for k in row}
    bad = next((row[keys[k]] for k in ('input', 'source', 'src', 'erroneous', 'incorrect', 'sentence') if k in keys), None)
    good = next((row[keys[k]] for k in ('output', 'target', 'tgt', 'correct', 'correction', 'corrected') if k in keys), None)
    return (bad, good) if bad and good else None


def main():
    got = 0
    with open(OUT, 'w', encoding='utf-8') as out:
        for off in range(0, N, 100):
            url = API.format(d=DATASET, c=CONFIG, s=SPLIT, o=off, l=min(100, N - off))
            try:
                with urllib.request.urlopen(url, timeout=30) as r:
                    data = json.load(r)
            except Exception as e:
                print(f"[gec] échec réseau à offset {off} : {e}")
                print("      (égress probablement bloqué — ajouter datasets-server.huggingface.co à l'allowlist)")
                break
            rows = [x.get('row', x) for x in data.get('rows', [])]
            if not rows:
                break
            for row in rows:
                if not _fr(row):
                    continue
                p = _pair(row)
                if p and p[0] != p[1]:
                    out.write(json.dumps({'bad': p[0], 'good': p[1]}, ensure_ascii=False) + '\n')
                    got += 1
    print(f"[gec] {got} paires FR écrites → {OUT}" if got else "[gec] aucune paire écrite (voir égress ci-dessus).")
    return 0 if got else 1


if __name__ == '__main__':
    sys.exit(main())
