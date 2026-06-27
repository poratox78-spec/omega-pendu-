# OMEGA-Ω — A cognitive architecture for French Hangman

> *🇫🇷 [Version française](README.md)*
>
> *How a machine can play Hangman by **reasoning** rather than **reading the answer**.*

OMEGA-Ω is a French Hangman engine (words ≥ 7 letters) built not as a dictionary
lookup, but as a **cognitive architecture** under a founding constraint —
**"cognition > oracle"**: no module reads the hidden word anywhere except at the revealed positions.

## Result at a glance

| Regime | Success | Note |
|---|---|---|
| Cheat-free cognition only | ~90% | without reading the dictionary to score a letter |
| **+ emergent declaration (NEO)**, in-lexicon | **97.5% – 98.8%** | on par with the best lexical solvers |
| Out-of-lexicon (Trexquant-style), phon→ortho | **~70%** | on par with good solvers, the word being *heard* |
| Out-of-lexicon **fully cheat-free** (gap-aware, *without* reading the sound) | **~64%** | pure cognition on a novel word — SOTA band |
| Out-of-lexicon, ortho only | ~22% | a real weakness: sub-lexical generalization |
| Oracle ceiling (full lexicon) | 98.7% | the target *excluded* by doctrine |

> *Honesty note: the 97.5% cheat-free holds for **letter-scoring** (no dictionary lookup to pick a letter). The "assembled" declaration path reads the **sound** of the target word (`w.p`, "word heard" premise, legitimate in dictation); for **fully** cheat-free play with no reading of the word at all, enable the board-derived cohort (report §17.5).*
>
> *✓ **Stats re-verified (06/2026)** by running the engine's own bench (`_omega_trexquant_bench`, 3 seeds, in-app): in-lexicon **~99%**, OOV **gap-aware 64% — stable across the 3 seeds** (SOTA band; good soundless solvers 65-68%). Independent measurement, consistent with the table.*

The contribution is **not** a winrate record (lexical solvers match the in-lexicon
score) — it's a **method**: measure before believing, falsify before keeping,
distinguish cognition from oracle; and a mapping of what generalizes (the
phon→ortho sequence) and what hits walls (concept capacity).

### Head-to-head on the same OOV game (measured 06/2026)

A *controlled* comparison — same out-of-lexicon words, same seeds (12345/777/2024), budget 6 —
re-running the real engine **and** a standalone n-gram baseline on the identical set:

| Solver (same OOV game) | Success |
|---|---|
| n-gram baseline (trigram + backoff) | 46.7% |
| OMEGA — lexical cohort, held-out | 24% |
| **OMEGA — cognition (gap-aware), cheat-free** | **64%** |

**What this actually validates:**

- ✅ **The method beats a clean statistical baseline** on French OOV (+17 pts, same game). Direct validation of the cognitive contribution.
- ✅ **Reproducible** (64% stable 3/3 seeds) and **cheat-free** (the baseline, by contrast, fully exploits the dictionary).
- ⚠️ **Honest ceiling**: my baseline is a standard trigram, *not* SOTA ML (trained LSTM/transformer). A heavier model would narrow the gap. So "beats standard solvers": **proven**. "Beats the very best ML": **untested** (you'd have to run one).

**And the resources point** — it's fair, and that's where it counts. The solvers reaching 65-68% are networks trained on GPU, with a training pipeline and a massive corpus. OMEGA reaches 64% in a single HTML file, no training, no GPU, in a browser tab. So the right framing isn't "it wins more", it's: **performance comparable to the best, at a fraction of the resources — and clearly superior to standard solvers.** That is defensible and measured.

> **Verdict:** method validated as reproducible, cheat-free, measurably better than a standard baseline, and competitive with heavy ML at an incomparable cost. The only remaining "no" — *strictly* beating the best ML — would require a duel against a real network, which I can't set up here.

## Run the application

Open **`app/omega-pendu.html`** in any browser. Self-contained monolithic app
(code + lexicon inlined), no server, no dependency.

> ⚠️ **At startup, every switch is OFF** (the engine then plays at ≈ 2.6%). Click
> **"⚙️ Optimal config"** (cheat-free preset, report §8.3) **before** ▶ Start / ▶▶ Auto.

- **▶ Start** runs a game (typed word, or random if empty).
- **⚙️ Optimal config** activates the reference cheat-free configuration (≈ 97.5% in-lexicon).
- The switch panel composes the cognitive configuration (ortho/phon routes, OS, bPC, declarations…).
- **🎯 Trexquant mode (out-of-lexicon)**: when ON, each new game removes the drawn word
  from the internal dictionary (cohort and recall blind) → watch OMEGA solve a **truly novel word**
  by phon→ortho generalization. Lexicon restored on the next turn.
- **Bench → 🎯 Trexquant** panel: measures the out-of-lexicon success rate over a batch of words.

## Documents

- **`docs/MEMOIRE.html`** — the research & engineering memoir (thesis, architecture, method,
  positive **and** negative results, related work, references). *The document to read / publish.*
- **`docs/rapport-mode-emploi.html`** — the reference report & user manual (switches,
  regimes, anti-cheating framework, status & limits).
- **`notes/`** — sourced session notes: the NEO system (changelog, brick-by-brick decomposition,
  mute-route crossing) and the documented negative result (falsified M3_d reconnection).

## Also in this repo — OMEGA·KEY

The [**`omega-key/`**](omega-key/) folder contains a derived project: an **end-to-end encrypted messenger**
in a single HTML file (French passphrases, AES-GCM-256, Double Ratchet DH, optional relay).
It reuses the OMEGA substrate as a source of identity/entropy and delegates all cryptography to WebCrypto.
See [`omega-key/README.md`](omega-key/README.md) and the report [`omega-key/docs/RAPPORT_MODE_EMPLOI.html`](omega-key/docs/RAPPORT_MODE_EMPLOI.html).

## Also in this repo — Dyslexia corrector (dictation + extension)

OMEGA's **dual route** applied to writing: an offline **dyslexia corrector** (grammar + spelling for
non-words/accents/typos, **FP=0**, in **parity** Python ↔ app ↔ extension), with **type-ahead** (accented
completion of the current word) and a **learning loop** (unified dys profile → adaptive dictation → progress curve).
- In the `app/omega-pendu.html` app: **🩹 Corrector** and **✍️ Diag dictation** panels.
- Everywhere on the web: [`extension/`](extension/) (Chrome MV3) — see [`extension/README.md`](extension/README.md).
- Roadmap & status: [`DICTEE_ROADMAP.md`](DICTEE_ROADMAP.md) · journal: [`dictee/JOURNAL.md`](dictee/JOURNAL.md).

## Doctrine & method

- **Cap §43 (cognition > oracle)**: cognitive modules read `currentWord` only at revealed
  positions (bottom-up = deciding). Post-game learning (top-down) sees the full word.
- **Lexicon**: forbidden in letter-scoring; allowed for *cohort DECLARE* (board-derived)
  and post-game learning. The `A1/A2/A3` switches (lexical frequency injection) are OFF.
- **R66**: no module enabled by default without a falsification test (bypass + paired statistics,
  multi-seed, deterministic harness).

## Architecture (summary)

A dual Möbius pipeline on a **hyperdimensional** substrate (HRR/VSA, 1024D concept / 512D lexical);
five bottom-up levels M1→M5; **dual route** orthographic + phonological (SAMPA) arbitrated by an OS;
M3_d concept in **bidirectional predictive coding**; emergent declarations (recall / assembled phon→ortho /
cohort). Details in the memoir.

## References

1. Coltheart, M., Rastle, K., Perry, C., Langdon, R., & Ziegler, J. (2001). *DRC: A Dual Route Cascaded Model of Visual Word Recognition and Reading Aloud.* Psychological Review, 108(1), 204–256.
2. Frady, E. P., Kent, S. J., Olshausen, B. A., & Sommer, F. T. (2020). *Resonator Networks…* Neural Computation, 32(12).
3. Kanerva, P. (2009). *Hyperdimensional Computing…* Cognitive Computation, 1(2), 139–159.
4. McClelland, J. L., McNaughton, B. L., & O'Reilly, R. C. (1995). *Why There Are Complementary Learning Systems in the Hippocampus and Neocortex.* Psychological Review, 102(3), 419–457.
5. Plate, T. A. (1995). *Holographic Reduced Representations.* IEEE Transactions on Neural Networks, 6(3), 623–641.
6. Qiu, S., Bhattacharyya, S., Coyle, D., & Dora, S. (2025). *Deep Predictive Coding with Bi-directional Propagation for Classification and Reconstruction.* Neural Networks, 191, 107785.

## Credits

Direction and design: **Rem**. Engineering assistance and writing: **Claude (Anthropic)**.

## License

Dual regime:

- **Code** (engine, UI, written docs): © Rem — under **MIT** (see [`LICENSE`](LICENSE)).
- **Lexical data** (Lexique base embedded in `app/omega-pendu.html`):
  **Creative Commons Attribution – ShareAlike 4.0 (CC BY-SA 4.0)**, © New, Pallier et al.,
  [www.lexique.org](https://www.lexique.org). **Attribution required · ShareAlike mandatory.**

See the [`NOTICE`](NOTICE) file for full attribution.

> Reuse: free, **including commercial**, with attribution **and** sharing of derivatives
> under CC BY-SA 4.0. To move the app to a non-SA license (e.g. pure MIT), you'd have to
> replace the lexical base with a compatible source.

---
*Snapshot as of 2026-06-03 · build phase47 (cognitive engine phase46).*


## Also in this repo

- [**`dictee/`**](dictee/) — **diagnostic dictation** (targeting *dyslexia / writing disorders*) built on OMEGA's dual route: sentence dictation, multi-label diagnosis (accent · voiced/voiceless · silent · insertion · inversion · homophone · agreement · surface) + remediation. Integrated in `app/omega-pendu.html` ("✍️ Diag dictation" panel). See [`dictee/README.md`](dictee/README.md), [`DICTEE_ROADMAP.md`](DICTEE_ROADMAP.md).
- [**`evo/`**](evo/) — *exploratory workstream*: OMEGA learns to code (copying itself; Hangman serves as a fitness test). See [`evo/EVO_ROADMAP.md`](evo/EVO_ROADMAP.md).
- Cross-cutting audit: `CLAUDE.md` (§ Project audit).
