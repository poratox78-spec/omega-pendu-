#!/usr/bin/env bash
# dev.sh — vérifie en LOCAL que tout passe. Miroir de .github/workflows/ci.yml — et ce n'est plus une promesse
# en commentaire : dictee/ci_parity_probe.py (lancé ici ET en CI) ÉCHOUE si un script tourne d'un côté et pas
# de l'autre. Les deux listes avaient dérivé en silence (sw_probe absent en local, popup.js fantôme en CI).
# Aucune dépendance : Python 3.8+ (stdlib) et Node 18+, c'est tout.
# Usage : ./dev.sh            (tout)
#         ./dev.sh -q         (résumé seulement)
set -u
cd "$(dirname "$0")"
export PYTHONUTF8="${PYTHONUTF8:-1}"  # Windows : stdout cp1252 → UnicodeEncodeError sur l'Unicode (→ ✓ ≈) ; no-op sous Linux/macOS (déjà UTF-8)
Q="${1:-}"; PASS=0; FAIL=0; FAILED=()

run() { # run "nom" cmd...
  local name="$1"; shift
  if out=$("$@" 2>&1); then PASS=$((PASS+1)); [ "$Q" = "-q" ] || printf "  ✓ %s\n" "$name"
  else FAIL=$((FAIL+1)); FAILED+=("$name"); printf "  ✗ %s\n" "$name"; [ "$Q" = "-q" ] || printf "%s\n" "$out" | sed 's/^/      /' | tail -8; fi
}
runsh() { local name="$1"; shift  # pour une commande shell complète
  if out=$(bash -c "$1" 2>&1); then PASS=$((PASS+1)); [ "$Q" = "-q" ] || printf "  ✓ %s\n" "$name"
  else FAIL=$((FAIL+1)); FAILED+=("$name"); printf "  ✗ %s\n" "$name"; [ "$Q" = "-q" ] || printf "%s\n" "$out" | sed 's/^/      /' | tail -8; fi
}

echo "── Prérequis ──"
command -v python3 >/dev/null && echo "  python3 $(python3 --version 2>&1 | awk '{print $2}')" || { echo "  ✗ python3 introuvable (installe Python 3.8+)"; exit 2; }
command -v node    >/dev/null && echo "  node $(node --version)" || { echo "  ✗ node introuvable (installe Node 18+)"; exit 2; }

echo "── Python : dictée + correcteur (sans Lexique4.tsv) ──"
run "diag phrases"                 python3 dictee/diag_sentence.py
run "dictée SENT (app==json, 0 FP)" python3 dictee/sentences_parity.py
run "correcteur (batterie FP=0)"   python3 dictee/correcteur_probe.py
run "mover impératif (réf Python == cas)" python3 dictee/imperative_clitics.py
run "garde j'est être/avoir (recall --check)" python3 dictee/recall_probe.py --check
run "FP à l'échelle (UD 2500, garde régression)" python3 dictee/fp_scale_probe.py --check
run "FP speller à l'échelle (ortho affirmatif UD 2500, garde régression)" node dictee/speller_fp_scale_probe.js --check
run "held-out vocab neuf"          python3 dictee/eval_externe.py
run "boucle descendante (genre)"   python3 dictee/descending_probe.py
run "did-you-mean FALSIFIÉ"        python3 dictee/didyoumean_probe.py
run "tables g2p (depuis l'app)"    python3 dictee/build_g2p_tables.py
run "morpho md/mb (depuis l'app)"  python3 dictee/build_morpho.py
run "correction g2p (train)"       python3 dictee/build_g2p_corrections.py
run "décomposeur (held-out)"       python3 dictee/decompose.py --measure
run "p2g build"                    python3 dictee/build_p2g.py
run "p2g mesure (held-out)"        python3 dictee/p2g.py --measure
run "régression décompo+p2g"       python3 dictee/test_decompose.py
run "décompo 3 voies (corpus)"     python3 dictee/decompose_corpus.py --show
run "clôture paradigme conj"       python3 dictee/close_conj_paradigm.py --check
run "POS-tagger 155k (build_pos)"  python3 dictee/build_pos.py
run "assets extension (build)"     python3 extension/build_assets.py

echo "── Node : parité app/extension + syntaxe + standalone ──"
runsh "syntaxe bloc dictée+correcteur (app)" "node -e \"const fs=require('fs');const h=fs.readFileSync('app/omega-pendu.html','utf8');const i=h.indexOf('mode PHRASES');if(i<0)throw new Error('bloc dictée introuvable');const b=h.slice(h.lastIndexOf('<script>',i)+8,h.indexOf('</script>',i));new Function(b);\""
runsh "syntaxe bloc Décompose (app)"          "node -e \"const fs=require('fs');const h=fs.readFileSync('app/omega-pendu.html','utf8');const i=h.indexOf('🔤 DÉCOMPOSE — fiche');if(i<0)throw new Error('bloc décompose introuvable');const b=h.slice(h.lastIndexOf('<script>',i)+8,h.indexOf('</script>',i));new Function(b);\""
run "parité correcteur APP↔Python"  node dictee/parity_corr.js
run "parité POS-tagger HMM (Py==ext==app)" node dictee/parity_pos.js
run "speller app (décompresse+FP0)" node dictee/test_speller_app.js
run "vigilance accord sujet-verbe (orange mid-phrase)" node dictee/test_sv_vigilance.js
run "benchmark dys réel (messy: rappel+FP+mauvaises corr.)" node dictee/messy_probe.js --check
run "mover impératif (parité app==ext + corrections + FP0)" node dictee/imp_probe.js --check
run "parité extension dys-core↔Py"  node extension/parity_core.js
run "parité OS-sujet 3 moteurs (accord verbe orange)" node dictee/parity_os.js
run "speller ext ≡ app (vigilance comprise)" node extension/test_speller.js
runsh "syntaxe extension (4 fichiers)" "node --check extension/dys-core.js && node --check extension/content.js && node --check extension/background.js && node --check extension/sidepanel.js"
run "correcteur standalone"         node dictee/correcteur.js
runsh "correcteur AUTONOME (bake)"  "D=\$(mktemp -d); T=\"\$D/c.standalone.js\"; TW=\$(cygpath -m \"\$T\" 2>/dev/null || echo \"\$T\"); node dictee/build_correcteur.js \"\$TW\" && node -e \"const C=require(process.argv[1]);C.init().then(function(){var f=C.correct('une grosse fote');if(!f.find(function(x){return x.word==='fote'&&x.sugg==='faute';}))throw new Error('bake KO');if(C.correct('Le chat mange une pomme.').length)throw new Error('bake FP');});\" \"\$TW\"; rc=\$?; rm -rf \"\$D\"; exit \$rc"
run "smoke moteur (cheat-free+NEO)" node evo/ci_smoke.js
run "scrabidon — moteur plateau"    node dictee/scrabidon_probe.js

echo "── LIVRAISON ──"
run "zip extension FRAIS (octets == sources)" python3 extension/build_zip.py --check
run "service worker (version+empreinte, précache, purge)" node dictee/sw_probe.js
run "parité dev.sh ↔ ci.yml (anti-dérive)" python3 dictee/ci_parity_probe.py

echo "── OMEGA·KEY (dérivé crypto) ──"
run "omega-key crypto (entropie + gel listes + KAT Double Ratchet)" node omega-key/test_crypto.js

echo "──────────────────────────────────────────"
if [ "$FAIL" -eq 0 ]; then echo "✅ TOUT VERT — $PASS/$((PASS+FAIL)) checks (parité dev.sh↔CI vérifiée par ci_parity_probe)."; else
  echo "❌ $FAIL échec(s) sur $((PASS+FAIL)) : ${FAILED[*]}"; fi
echo "ℹ️  build_* régénèrent des fichiers suivis (assets gz, tables) ; un 'git status' peut montrer des diffs de mtime — sans conséquence, 'git checkout -- <fichier>' pour nettoyer."
exit $([ "$FAIL" -eq 0 ] && echo 0 || echo 1)
