# VIVARIUM — build & sources

Squad cover-shooter in a living creature ecosystem (LittleJS, single-file build).

## Structure (single source of truth = these files)
- `engine/littlejs.release.js` — LittleJS engine (MIT)
- `engine/viv_tac_module.js`   — embedded "Tactical" squad-AI brain (VIV_TAC)
- `src/viv_sim.js`             — pure simulation (engine-agnostic, testable headless)
- `src/viv_game.js`            — LittleJS render/HUD/input (+ embedded base64 sprite atlases)

## Build
`python3 build.py` → assembles `prototypes/vivarium.html` (open in a browser).

## Recovery (if a dev container wipes /tmp)
`python3 rebuild.py` reconstructs all source edits from the trusted uploaded build, then `python3 build.py`.
