# -*- coding: utf-8 -*-
# VOLET LLM (opt-in, EN LIGNE) — correcteur dys par modèle de contexte. OFF par défaut.
# ============================================================================================
# Pourquoi : les 3 fronts (correcteur, décodeur, trexquant) butent — MESURÉ — sur le CONTEXTE.
# Les vraies fautes dys sont surtout des vrais-mots mal employés (« je sui dan le voiture, et j'est
# bouliées mais lunettes ») que les règles FP=0 ne touchent pas. Seul un modèle de contexte (LLM)
# les corrige. Plafond démontré : LLM 6/6 vs règles 0/6 sur cette phrase.
#
# DOCTRINE / vie privée : le correcteur dys promet « hors-ligne, aucune donnée envoyée ». Un LLM en
# ligne CASSE cette promesse → ce module est **OFF par défaut**, **opt-in explicite** (il faut fournir
# une clé), et destiné à un mode déclaré dans l'UI (consentement). Sans clé : aucun appel réseau.
#
# Config (env) — endpoint OpenAI-compatible (Anthropic, OpenAI, local, etc.) :
#   LLM_API_URL   (ex. https://api.openai.com/v1/chat/completions)
#   LLM_API_KEY   (la clé de l'UTILISATEUR — jamais committée)
#   LLM_MODEL     (ex. gpt-4o-mini, claude-..., un modèle local…)
# Lancer :  python3 dictee/llm_correcteur.py --demo        (montre le prompt ; appelle si clé présente)
#           python3 dictee/llm_correcteur.py "phrase"      (corrige une phrase, si clé)
#           python3 dictee/llm_correcteur.py --eval        (mesure récall/FP sur le GEC, si clé)
import os, sys, json, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
GEC = os.path.join(HERE, 'corpus_gec_fr.jsonl')

# ---- le prompt = le cœur du volet (dys-aware, conservateur, sortie structurée) ----
SYSTEM = (
    "Tu es un correcteur orthographique et grammatical du français, spécialisé pour les troubles de "
    "l'écrit (dyslexie, dysorthographie). On te donne le texte d'un élève. Règles STRICTES :\n"
    "- Corrige UNIQUEMENT les vraies fautes : orthographe, accents, lettres muettes, accord (genre/nombre), "
    "conjugaison, homophones grammaticaux, mots phonétiquement déformés (ex. « bouliées »→« oublié »).\n"
    "- NE REFORMULE PAS, ne change ni le style, ni l'ordre des mots, ni la ponctuation correcte. "
    "Ne « complète » pas la phrase. Si un mot est déjà juste, n'y touche pas.\n"
    "- Conserve la casse et la segmentation autant que possible.\n"
    "- Pour CHAQUE mot corrigé, donne : le mot tel qu'écrit, le mot correct, et la FAMILLE d'erreur parmi : "
    "accent, muette, accord, conjugaison, homophone, phonetique, autre.\n"
    "Réponds UNIQUEMENT en JSON strict, sans texte autour :\n"
    '{"corrige": "<la phrase entièrement corrigée>", '
    '"fautes": [{"ecrit": "<mot tapé>", "correct": "<mot corrigé>", "famille": "<famille>"}]}'
)

DEMO = [
    "je sui dan le voiture, et j'est bouliées mais lunettes",
    "Les enfant joue dans le jardin et il sont content.",
    "je voudrai un café s'il vous plait",
]


def _cfg():
    return os.environ.get('LLM_API_URL'), os.environ.get('LLM_API_KEY'), os.environ.get('LLM_MODEL', 'gpt-4o-mini')


def correct(text, temperature=0.0, timeout=30):
    """-> dict {corrige, fautes:[{ecrit,correct,famille}]}. Lève si pas de clé (OFF par défaut)."""
    url, key, model = _cfg()
    if not (url and key):
        raise RuntimeError("OFF par défaut : définir LLM_API_URL + LLM_API_KEY (clé utilisateur) pour activer le volet LLM.")
    body = json.dumps({
        "model": model, "temperature": temperature,
        "messages": [{"role": "system", "content": SYSTEM},
                     {"role": "user", "content": "Texte de l'élève :\n" + text}],
        "response_format": {"type": "json_object"},
    }).encode('utf-8')
    req = urllib.request.Request(url, data=body, method='POST',
                                 headers={'Content-Type': 'application/json',
                                          'Authorization': 'Bearer ' + key})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        resp = json.loads(r.read().decode('utf-8'))
    content = resp['choices'][0]['message']['content']
    out = json.loads(content)
    out.setdefault('fautes', []); out.setdefault('corrige', text)
    return out


def _eval():
    """Mesure sur le GEC (si clé) : récall des fautes in-périmètre + FP sur les phrases correctes.
    À comparer aux règles (eval_gec.py). Le test cardinal RESTE FP=0 sur le `good`."""
    import diag_sentence as D
    if not os.path.exists(GEC):
        print(f"corpus GEC absent ({GEC})."); return 1
    PAIRS = [json.loads(l) for l in open(GEC, encoding='utf-8') if l.strip()]
    fp = det = tot = 0
    for p in PAIRS:
        # (1) FP : le LLM touche-t-il du texte CORRECT ?
        try:
            g = correct(p['good'])
            fp += sum(1 for f in g.get('fautes', []) if f.get('ecrit', '').lower() != f.get('correct', '').lower())
        except Exception as e:
            print("err good:", e); return 1
        # (2) récall : sur le bad, retrouve-t-il les substitutions du gold ?
        b = correct(p['bad'])
        fixed = {f.get('ecrit', '').lower(): f.get('correct', '').lower() for f in b.get('fautes', [])}
        for op, gg, bb in D.align(D.toks(p['good']), D.toks(p['bad'])):
            if op != 'sub' or gg.lower() == bb.lower():
                continue
            tot += 1
            if fixed.get(bb.lower()) == gg.lower():
                det += 1
    print(f"=== LLM sur GEC ({len(PAIRS)} paires) ===")
    print(f"  FAUX POSITIFS sur le `good` (cardinal) : {fp}")
    print(f"  récall fautes (toutes familles)        : {det}/{tot}")
    print("  (à comparer aux règles : eval_gec.py. Le LLM vise le RÉCALL ; surveiller le FP.)")
    return 0


def main():
    args = sys.argv[1:]
    url, key, model = _cfg()
    status = f"clé={'OUI' if key else 'NON (OFF)'} · url={'OUI' if url else 'NON'} · modèle={model}"
    if not args or args[0] == '--demo':
        print("=== VOLET LLM correcteur dys (opt-in, en ligne) ===")
        print("  config :", status)
        print("\n--- PROMPT SYSTÈME (le cœur du volet) ---\n" + SYSTEM)
        if not key:
            print("\n  [OFF] aucune clé → aucun appel réseau. Définir LLM_API_URL + LLM_API_KEY pour activer.")
            print("  Démo des phrases (corrigées par le LLM une fois activé) :")
            for s in DEMO:
                print("   •", s)
            return 0
        for s in DEMO:
            try:
                out = correct(s)
                print(f"\n  « {s} »\n   → « {out['corrige']} »")
                for f in out['fautes']:
                    print(f"      {f.get('ecrit')} → {f.get('correct')}  [{f.get('famille')}]")
            except Exception as e:
                print("  erreur:", e)
        return 0
    if args[0] == '--eval':
        return _eval()
    out = correct(' '.join(args))
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
