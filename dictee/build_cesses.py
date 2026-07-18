# -*- coding: utf-8 -*-
# BAKER du modèle « carte chaud-froid » ces/ses (vigilance-enseignante). POS-FREE : contexte de mots seulement
# (mot avant, 2 mots après, position) → aucune dépendance tagger. Log-ratios Naive-Bayes ces vs ses, élagués.
# Sert de TRIGGER : |score|>τ ET désaccord avec l'écrit → « ces ou ses ? » + encart pédagogique (jamais de réécriture).
#   Source : treebank UD French-GSD (CC BY-SA 4.0), champ « # text » (MÊME source que os_subj_lm). On EXCLUT du train
#   les phrases de dictee/fp_scale_corpus.txt (= jeu de fatigue held-out) pour un taux de déclenchement honnête.
#   Sortie : dictee/ces_ses_model.json  { prior, lr:{feature: log-ratio} }  (~2 Ko, inliné dans les 3 moteurs).
#   Reproductible : python dictee/build_cesses.py
import os, re, json, math
from collections import Counter
HERE = os.path.dirname(os.path.abspath(__file__))
UD = os.path.join(HERE, '..', 'data_local', 'ud_fr_gsd-train.conllu')
FP = os.path.join(HERE, 'fp_scale_corpus.txt')
OUT = os.path.join(HERE, 'ces_ses_model.json')
PRUNE_LR, PRUNE_CNT = 0.4, 3

TOK = re.compile(r"[a-zA-Zà-ÿœæ'\-]+")
def tk(s): return [w.lower() for w in TOK.findall(s.replace('’', "'"))]
fp_norm = set(' '.join(tk(l)) for l in open(FP, encoding='utf-8') if l.strip())

def feats(forms, i):                                   # POS-FREE : mot avant · 2 mots après · position (même format que les 3 moteurs)
    return ['nx='  + (forms[i+1] if i+1 < len(forms) else '</s>'),
            'nx2=' + (forms[i+2] if i+2 < len(forms) else '</s>'),
            'pv='  + (forms[i-1] if i > 0 else '<s>'),
            'pos=' + ('deb' if i <= 1 else 'mil')]

cnt = {'ces': Counter(), 'ses': Counter()}; n = {'ces': 0, 'ses': 0}; kept_sent = 0
for l in open(UD, encoding='utf-8'):
    if not l.startswith('# text ='): continue
    forms = tk(l.split('=', 1)[1])
    if ' '.join(forms) in fp_norm: continue            # held-out fatigue → hors train
    kept_sent += 1
    for i, f in enumerate(forms):
        if f in ('ces', 'ses'):
            n[f] += 1
            for x in feats(forms, i): cnt[f][x] += 1

V = len(set(cnt['ces']) | set(cnt['ses'])) + 1
prior = math.log((n['ces'] + 1) / (n['ses'] + 1))
def lr(x): return math.log((cnt['ces'][x] + 0.5) / (n['ces'] + 0.5*V)) - math.log((cnt['ses'][x] + 0.5) / (n['ses'] + 0.5*V))
kept = {x: round(lr(x), 4) for x in set(cnt['ces']) | set(cnt['ses'])
        if abs(lr(x)) > PRUNE_LR and (cnt['ces'][x] + cnt['ses'][x]) >= PRUNE_CNT}
model = {'prior': round(prior, 4), 'tau': 2.5, 'lr': kept,
         'src': 'UD French-GSD (CC BY-SA 4.0)', 'prune': [PRUNE_LR, PRUNE_CNT]}
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(model, f, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
print("modèle ces/ses baké : %s" % OUT)
print("  phrases UD train (hors held-out) : %d | ces=%d ses=%d" % (kept_sent, n['ces'], n['ses']))
print("  features élaguées : %d | taille : %d octets" % (len(kept), os.path.getsize(OUT)))
