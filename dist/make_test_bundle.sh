#!/usr/bin/env bash
# make_test_bundle.sh — assemble le bundle de TEST du correcteur dys (2 versions : extension Chrome + app pendu).
# Régénère les assets de l'extension depuis l'app (parité garantie), puis produit dist/omega-correcteur-dys-test.zip.
#   bash dist/make_test_bundle.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$(mktemp -d)/omega-correcteur-dys-test"
ZIP="$ROOT/dist/omega-correcteur-dys-test.zip"

# 1) assets de l'extension EN PHASE avec l'app (POS-tagger 155k + lexiques embarqués) — parité par construction
python3 "$ROOT/dictee/build_pos.py"
python3 "$ROOT/extension/build_assets.py"

# 2) staging : notice + extension (runtime, sans scripts dev) + app autonome
mkdir -p "$STAGE/extension/assets" "$STAGE/app"
cp "$ROOT/dist/LISEZ-MOI-TEST.md" "$STAGE/LISEZ-MOI-TEST.md"
for f in manifest.json dys-core.js content.js content.css popup.html popup.js README.md; do
  cp "$ROOT/extension/$f" "$STAGE/extension/$f"
done
cp "$ROOT"/extension/assets/{vdc-lex.json,gender-relaxed.tsv.gz,speller.tsv.gz,pos-abstain.txt.gz,noun-post.txt.gz} "$STAGE/extension/assets/"
cp "$ROOT/app/omega-pendu.html" "$STAGE/app/omega-pendu.html"

# 3) zip
rm -f "$ZIP"
( cd "$(dirname "$STAGE")" && zip -r -q -9 "$ZIP" omega-correcteur-dys-test )
unzip -tq "$ZIP" >/dev/null && echo "✅ $ZIP ($(du -h "$ZIP" | cut -f1))"
rm -rf "$(dirname "$STAGE")"
