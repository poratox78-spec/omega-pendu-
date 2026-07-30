#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OMEGA-Ω — ASR local « voie B » (sans Google). PROTOTYPE (expérimental, hors build/CI).

Chaîne :  audio WAV  ->  wav2vec2-french-phonemizer (phonèmes IPA + pauses)  ->  OMEGA :
  1. récupération lexicale : homophones exacts + proximité de prononciation sur les 214 k du speller
  2. grammaire : décodage Viterbi trigramme (os-subj-lm)
  3. ponctuation PROSODIQUE : les silences (timing wav2vec2) posent points/virgules
  4. parseur de sujet MODE-CONFIANCE : accord son/sont, adj/participe (flips de genre gratuits à l'oral)
  5. correcteur rouge FP=0 + majuscules
Mesuré sur voix propre (TTS) : 13,6 % (phonèmes bruts) -> 76,9 % de mots justes.

Dépendances LOCALES (NON embarquables navigateur -> pour le web, voie A/Web Speech) :
    pip install torch transformers soundfile
    (micro, optionnel)  pip install sounddevice
Le modèle acoustique (~378 Mo, licence MIT) se télécharge au 1er lancement (cache HuggingFace).

Usage :
    python dictee/asr_voix.py  mon_audio.wav
    python dictee/asr_voix.py  --record 6            # 6 s depuis le micro par défaut
    python dictee/asr_voix.py  mon_audio.wav --show  # montre les étapes intermédiaires
"""
import os, sys, math, gzip, json, pickle, tempfile, argparse
import numpy as np
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import decompose as D
import correcteur_probe as C
from correcteur_probe import deacc

MODEL = 'Cnam-LMSSC/wav2vec2-french-phonemizer'
SPELLER = os.path.join(HERE, '..', 'extension', 'assets', 'speller.tsv.gz')
LM_PATH = os.path.join(HERE, 'os_subj_lm.json.gz')
FR_MS = 20                       # ~20 ms / frame (wav2vec2 base)
COMMA_MS, PERIOD_MS = 190, 750   # seuils de silence (virgule ~320 ; POINT ~1000+ : au-dessus de 750 pour ne PAS couper sur une respiration intra-phrase ~500 ms qui ferait un faux « ? »)
STRIDE = 320                     # échantillons par frame wav2vec2 (20 ms @ 16 kHz) : frame -> position audio
QRISE = 4.0                      # demi-tons : fin de phrase qui MONTE d'au moins ça -> « ? » (mesuré : questions +9/+17, affirmations <+4,5)

# ── IPA (vocab du modèle) -> SAMPA OMEGA ──
IPA2O = {'a': 'a', 'ɑ': 'a', 'ɐ': 'a', 'ɒ': 'O', 'e': 'e', 'ɛ': 'E', 'ɜ': 'E', 'ə': '°', 'i': 'i', 'ɪ': 'i',
         'ɨ': 'i', 'o': 'o', 'ɔ': 'O', 'u': 'u', 'ʊ': 'u', 'y': 'y', 'ø': '2', 'œ': '9', 'ʌ': '9', 'b': 'b',
         'd': 'd', 'f': 'f', 'ɡ': 'g', 'g': 'g', 'k': 'k', 'l': 'l', 'm': 'm', 'n': 'n', 'p': 'p', 's': 's',
         't': 't', 'v': 'v', 'z': 'z', 'ʃ': 'S', 'ʒ': 'Z', 'ŋ': 'G', 'ɲ': 'N', 'r': 'R', 'ɹ': 'R', 'ɾ': 'R',
         'ʁ': 'R', 'j': 'j', 'w': 'w', 'ɥ': '8', 'ʲ': 'j', 'ʍ': 'w', 'ç': 's', 'x': 'k', 'θ': 's', 'ð': 'z',
         'β': 'b', 'ɣ': 'g', 'ɬ': 'l'}
NAS = {'O': '§', 'a': '@', 'E': '5', '9': '1', 'e': '5', '2': '1'}
DROP = {'ː', 'ʔ', 'h', '[UNK]', '[PAD]', '1', ''}

def die(msg):
    print(msg); sys.exit(1)

# ── modèle acoustique ──
def load_am():
    try:
        import torch
        from transformers import Wav2Vec2ForCTC, AutoProcessor
    except ImportError:
        die("Il manque torch/transformers. Installe :\n    pip install torch transformers soundfile")
    print('… chargement du modèle acoustique (télécharge ~378 Mo au 1er lancement)', file=sys.stderr)
    proc = AutoProcessor.from_pretrained(MODEL)
    am = Wav2Vec2ForCTC.from_pretrained(MODEL); am.eval()
    return torch, proc, am

# ── index de prononciation (homophones + voisins) sur les 214 k du speller ──
def build_index():
    cache = os.path.join(tempfile.gettempdir(), 'omega_asr_pron_v2.pkl')
    if os.path.exists(cache):
        return pickle.load(open(cache, 'rb'))
    print('… construction de l’index de prononciation (une fois)', file=sys.stderr)
    def g2p_sampa(w):
        out = []
        for s in D.g2p(w):
            ph = s.get('ph')
            if not ph or ph == '∅': continue
            for ch in ph:
                if ch == '̃':
                    if out: out[-1] = NAS.get(out[-1], out[-1])
                elif ch == 'ʲ': out.append('j')
                elif ch == 'ː': pass
                else:
                    o = IPA2O.get(ch)
                    if o: out.append(o)
        return ''.join(out)
    FREQ = {}; POS = {}
    with gzip.open(SPELLER, 'rt', encoding='utf-8') as f:
        for line in f:
            p = line.rstrip('\n').split('\t')
            if len(p) >= 2:
                try: FREQ[p[0]] = int(p[1])
                except ValueError: pass
                if len(p) >= 3: POS[p[0]] = p[2]
    PH2W = defaultdict(list)
    for w in FREQ:
        ph = D.W2P.get(w) or g2p_sampa(w)
        if ph: PH2W[ph].append(w)
    for w, ph in D.W2P.items():
        if w not in FREQ and ph: PH2W[ph].append(w)
    PH2W = dict(PH2W)
    pickle.dump((PH2W, FREQ, POS), open(cache, 'wb'))
    return PH2W, FREQ, POS

# ── modèle de langue (trigramme os-subj-lm) ──
def load_lm():
    LM = json.load(gzip.open(LM_PATH, 'rt', encoding='utf-8'))
    UNI = dict(LM['uni']); NTOK = float(LM['N']); V = len(UNI) + 1
    def _m(x): return {k: v for k, v in x} if isinstance(x, list) else dict(x or {})
    BF = {k: _m(v) for k, v in _m(LM.get('bf', {})).items()}
    TF = {k: _m(v) for k, v in _m(LM.get('tf', {})).items()}
    def lu(w): return math.log((UNI.get(w, 0) + 0.5) / (NTOK + 0.5 * V))
    def l2(w, p1):
        d = BF.get(p1)
        if d and w in d: return math.log((d[w] + 0.4) / (sum(d.values()) + 0.4 * V))
        return lu(w) - 0.7
    def l3(w, p2, p1):
        d = TF.get(p2 + '\t' + p1)
        if d and w in d: return math.log((d[w] + 0.4) / (sum(d.values()) + 0.4 * V))
        return l2(w, p1) - 0.7
    return lu, l2, l3

# ── globals initialisés dans main() ──
TORCH = PROC = AM = None
PH2W = FREQ = POS = BYLEN = None
LU = L2 = L3 = None
PAD = BAR = None

def _is_adjlike(h):   # un adjectif/participe (pour ne jamais muer un adj en NOM/VERBE de même son)
    return ('A' in (POS.get(h, '') if POS else '')) or h.lower().endswith(
        ('é', 'és', 'ée', 'ées', 'i', 'is', 'ie', 'ies', 'u', 'us', 'ue', 'ues'))

def lev(a, b, cap=2):
    la, lb = len(a), len(b)
    if abs(la - lb) > cap: return cap + 1
    pv = list(range(lb + 1))
    for i in range(1, la + 1):
        cur = [i] + [0] * lb; mn = i
        for j in range(1, lb + 1):
            cur[j] = min(pv[j] + 1, cur[j - 1] + 1, pv[j - 1] + (a[i - 1] != b[j - 1])); mn = min(mn, cur[j])
        if mn > cap: return cap + 1
        pv = cur
    return pv[lb]

_RC = {}
def cands(seg, A=6, K=18):
    if seg in _RC: return _RC[seg]
    L = len(seg); res = {}
    for dl in range(-2, 3):
        for ph in BYLEN.get(L + dl, ()):
            d = lev(seg, ph, 2)
            if d <= 2:
                for w in PH2W[ph]:
                    if w not in res or d < res[w]: res[w] = d
    if not res:
        out = [(seg, -9.0)]
    else:
        lst = sorted(res.items(), key=lambda x: (x[1], -math.log(FREQ.get(x[0], 1) + 1)))[:K]
        out = [(w, -A * d) for w, d in lst]
    _RC[seg] = out; return out

def viterbi(seq):                      # décodage trigramme (émission + LM)
    beam = {('<s>', '<s>'): (0.0, ['<s>', '<s>'])}
    for cs in seq:
        nb = {}
        for (p2, p1), (sc, path) in beam.items():
            for sp, em in cs:
                v = sc + em + L3(sp, p2, p1); nk = (p1, sp)
                if nk not in nb or v > nb[nk][0]: nb[nk] = (v, path + [sp])
        beam = nb or beam
    return max(beam.values(), key=lambda x: x[0])[1][2:]

def _f0(a, sr=16000, win=.04, hop=.01, fmin=75, fmax=350):   # pitch par autocorrélation (zéro modèle)
    w = int(win * sr); h = int(hop * sr); out = []
    for i in range(0, max(0, len(a) - w), h):
        fr = a[i:i + w].astype(float); fr = (fr - fr.mean()) * np.hanning(w)
        if np.sqrt((fr ** 2).mean()) < .006: out.append(0.); continue
        ac = np.correlate(fr, fr, 'full')[w - 1:]
        lo = int(sr / fmax); hi = min(int(sr / fmin), len(ac) - 1)
        if hi <= lo: out.append(0.); continue
        lag = lo + int(np.argmax(ac[lo:hi]))
        out.append(sr / lag if lag > 0 and ac[lag] > .3 * ac[0] else 0.)
    return np.array(out)

def _pitch_rise(a):                    # montée de pitch en fin de segment (demi-tons ; >0 = monte)
    v = _f0(a); v = v[v > 0]
    if len(v) < 6: return 0.
    m = len(v); tail = v[-max(3, m // 5):]; body = v[:-max(3, m // 5)]
    if not len(body) or np.median(body) <= 0: return 0.
    return 12 * math.log2(np.median(tail) / np.median(body))

def transcribe(wav):                   # -> [(sampa_mot, silence_avant_frames, frame_début, frame_fin)]
    import soundfile as sf
    a, sr = sf.read(wav)
    if getattr(a, 'ndim', 1) > 1: a = a.mean(1)
    iv = PROC(a.astype('float32'), sampling_rate=16000, return_tensors='pt').input_values
    with TORCH.no_grad(): lg = AM(iv).logits[0]
    ids = lg.argmax(-1).tolist()
    def to_sampa(cids):
        toks = []; prev = None
        for i in cids:
            if i != prev: toks.append(PROC.tokenizer.convert_ids_to_tokens(i)); prev = i
        out = []
        for t in toks:
            if t == '̃':
                if out: out[-1] = NAS.get(out[-1], out[-1])
            elif t in DROP: continue
            else:
                o = IPA2O.get(t)
                if o: out.append(o)
        return ''.join(out)
    words = []; cur = []; sil = 0; hasbar = False; before = 0; fi = 0; cstart = None
    for i in ids:
        if i == PAD or i == BAR:
            sil += 1
            if i == BAR: hasbar = True
        else:
            if sil > 0 and hasbar:
                if cur: words.append((to_sampa(cur), before, cstart, fi))
                cur = []; before = sil; cstart = None
            sil = 0; hasbar = False
            if cstart is None: cstart = fi
            cur.append(i)
        fi += 1
    if cur: words.append((to_sampa(cur), before, cstart, fi))
    return [(w, b, s, e) for w, b, s, e in words if w]

# ── parseur de sujet MODE-CONFIANCE (cf. asr-phon-route) ──
PLURAL_DET = getattr(C, 'PLURAL_DET', {'les', 'des', 'ces', 'mes', 'tes', 'ses', 'nos', 'vos', 'leurs'})
def num_form(w): return 'p' if (len(deacc(w)) > 2 and deacc(w).endswith(('s', 'x'))) else 's'
def gen_form(w):
    b = w.lower().rstrip('sx')
    if b.endswith(('é', 'i', 'u')): return 'm'
    if b.endswith('e'): return 'f'
    return 'm'
def same_lemma(a, b):
    da, db = deacc(a), deacc(b); p = 0
    for x, y in zip(da, db):
        if x == y: p += 1
        else: break
    return p >= 3 and p >= min(len(da), len(db)) - 2
def homophones(w):
    ph = D.W2P.get(w.lower())
    return [h for h in PH2W.get(ph, [])] if ph else []

def agree(words):
    text = ' '.join(words)
    C._SEG = C._seg_info(text); T = C.toks(text)
    try: tg = C.pos_tags(T)
    except Exception: tg = None
    out = list(T)
    for i, w in enumerate(T):
        if "'" in w or not w[:1].isalpha(): continue
        H = [h for h in homophones(w) if same_lemma(w, h)]
        if len(set(H)) <= 1: continue
        dw = deacc(w.lower())
        if D.W2P.get(w.lower()) == 's§' and dw in ('son', 'sons', 'sont'):
            plur = False
            try:
                sj = C._np_subject(T, tg, i)
                if sj and sj.get('n') == 'p': plur = True
            except Exception: pass
            if not plur:
                for j in range(i - 1, max(-1, i - 6), -1):
                    if deacc(T[j].lower()) in PLURAL_DET or C.is_plural_noun(T, j): plur = True; break
            if plur and 'sont' in H and i + 1 < len(T): out[i] = 'sont'
            continue
        lw = w.lower()   # adjectif tagué, OU participe -é (marque muette), OU participe -i/-u tagué VERB.
        is_adjpp = (tg and i < len(tg) and tg[i] == 'ADJ') or lw.endswith(('é', 'és', 'ée', 'ées')) \
            or (tg and i < len(tg) and tg[i] == 'VERB' and lw.endswith(('i', 'is', 'ie', 'ies', 'u', 'us', 'ue', 'ues')))
        if not is_adjpp: continue   # les verbes présents (-e/-es : joue, prépare) -> laissés au correcteur (sujet-verbe)
        num = gen = None
        if i >= 1 and tg and i - 1 < len(tg) and tg[i - 1] == 'NOUN':
            num = num_form(T[i - 1])
            try: gen = C._noun_gender(T[i - 1], num, full=True)
            except Exception: gen = None
        elif i >= 1 and tg and i - 1 < len(tg) and tg[i - 1] == 'VERB':
            try:
                sj = C._np_subject(T, tg, i - 1)
                if sj: num, gen = sj.get('n'), sj.get('g')
            except Exception: pass
        if gen not in ('m', 'f') and i >= 1: gen = D.GENDER.get(deacc(T[i - 1].lower()))
        if not num: continue
        cand = [h for h in H if _is_adjlike(h) and num_form(h) == num and (gen not in ('m', 'f') or gen_form(h) == gen)]
        if cand and out[i] not in cand:
            out[i] = max(cand, key=lambda h: FREQ.get(h, 1))
    return [x.lower() for x in out]

def correcteur(words, it=2):           # correcteur rouge FP=0
    t = ' '.join(words)
    for _ in range(it):
        cr = C.correct(t)
        if not cr: break
        T = C.toks(t)
        for idx, ty, su, nm in cr:
            if idx < len(T): T[idx] = su
        t = ' '.join(x for x in T if x.isalpha() or "'" in x)
    return t.lower().split()

def assemble(words, pauses):           # ponctuation prosodique (virgules) + majuscule de tête
    parts = []
    for k, w in enumerate(words):
        if k > 0 and k < len(pauses) and pauses[k] * FR_MS >= COMMA_MS: parts.append(',')
        parts.append(w)
    text = ' '.join(parts).replace(' ,', ',')
    return text[:1].upper() + text[1:] if text else text

def run(wav, dbg=None):
    import soundfile as sf
    raw = transcribe(wav)
    if not raw: return ''
    a, _ = sf.read(wav)
    if getattr(a, 'ndim', 1) > 1: a = a.mean(1)
    a = a.astype('float32')
    # découpe en phrases sur les grosses pauses (niveau point)
    sents, cur = [], []
    for w in raw:
        if cur and w[1] * FR_MS >= PERIOD_MS: sents.append(cur); cur = []
        cur.append(w)
    if cur: sents.append(cur)
    if dbg is not None:
        dbg.append('phonèmes : ' + ' '.join(w[0] for w in raw))
        dbg.append('pauses ms: ' + str([w[1] * FR_MS for w in raw]))
    out = []
    for sent in sents:
        phs = [w[0] for w in sent]; pauses = [w[1] for w in sent]
        dec = viterbi([cands(w) for w in phs])
        if dbg is not None: dbg.append('décodé   : ' + ' '.join(dec))
        dec = agree(dec)
        dec = correcteur(dec)
        pz = pauses[:len(dec)] + [0] * max(0, len(dec) - len(pauses))
        # PITCH -> « ? » : si la fin de la phrase monte assez (mesuré sur l'audio de la phrase)
        span = a[sent[0][2] * STRIDE: sent[-1][3] * STRIDE]
        rise = _pitch_rise(span)
        term = '?' if rise >= QRISE else '.'
        if dbg is not None: dbg.append('  pitch %+.1f 1/2t -> %s' % (rise, term))
        out.append(assemble(dec, pz) + term)
    return ' '.join(out)

def list_devices():
    try: import sounddevice as sd
    except ImportError: die("pip install sounddevice")
    print('Périphériques d’ENTRÉE (utilise le numéro avec --device N) :')
    for i, d in enumerate(sd.query_devices()):
        if d['max_input_channels'] > 0: print('  %2d  %s' % (i, d['name']))

def record(sec, device=None):
    try: import sounddevice as sd, soundfile as sf
    except ImportError:
        die("Pour --record : pip install sounddevice soundfile\n(ou passe un fichier WAV en argument)")
    dev = sd.query_devices(device)['name'] if device is not None else 'micro par défaut'
    print('🎤 parle maintenant (%d s) — %s…' % (sec, dev), file=sys.stderr)
    a = sd.rec(int(sec * 16000), samplerate=16000, channels=1, device=device); sd.wait()
    path = os.path.join(tempfile.gettempdir(), 'omega_asr_rec.wav')
    sf.write(path, a, 16000); return path

def init():
    """Charge le modèle acoustique + l'index + le LM (une fois). Réutilisable par l'interface graphique."""
    global TORCH, PROC, AM, PH2W, FREQ, POS, BYLEN, LU, L2, L3, PAD, BAR
    if AM is not None: return
    TORCH, PROC, AM = load_am()
    PAD = PROC.tokenizer.pad_token_id
    BAR = PROC.tokenizer.convert_tokens_to_ids('|')
    PH2W, FREQ, POS = build_index()
    BYLEN = defaultdict(list)
    for ph in PH2W: BYLEN[len(ph)].append(ph)
    LU, L2, L3 = load_lm()

def main():
    ap = argparse.ArgumentParser(description="OMEGA ASR local (voie B, sans Google)")
    ap.add_argument('wav', nargs='?', help='fichier audio WAV (16 kHz mono de préférence)')
    ap.add_argument('--record', type=float, metavar='SEC', help='enregistrer SEC secondes du micro')
    ap.add_argument('--device', type=int, metavar='N', help='numéro du micro (voir --list-devices)')
    ap.add_argument('--list-devices', action='store_true', help='lister les micros disponibles et quitter')
    ap.add_argument('--show', action='store_true', help='montrer les étapes intermédiaires')
    args = ap.parse_args()
    if args.list_devices: list_devices(); return
    wav = record(args.record, args.device) if args.record else args.wav
    if not wav: die("Donne un fichier WAV, ou --record SEC.")
    if not os.path.exists(wav): die("Fichier introuvable : " + wav)
    init()
    dbg = [] if args.show else None
    text = run(wav, dbg=dbg)
    if dbg:
        for l in dbg: print('  ' + l)
    print('\n' + text + '\n')

if __name__ == '__main__':
    main()
