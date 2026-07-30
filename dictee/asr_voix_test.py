#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OMEGA-Ω — banc de TEST VOIX visuel (voie B, sans Google). Lis le texte affiché, clique
« Démarrer », parle, clique « Arrêter » : l'interface montre le texte reconnu, le score
mot-à-mot (vert/rouge) et la mélodie (le pitch monte-t-il sur tes questions ?).
Le WAV est sauvegardé pour analyse fine. Aucune ligne de commande (double-clic du lanceur).
"""
import os, sys, threading, tempfile, re
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import tkinter as tk
from tkinter import ttk, scrolledtext
try:
    import sounddevice as sd, soundfile as sf
except ImportError:
    print("Installe d'abord :  pip install sounddevice soundfile"); sys.exit(1)
import asr_voix as A

REF = ["Salut, comment tu vas aujourd'hui ?",
       "Les enfants jouent dans le jardin.",
       "Tu viens jouer avec nous ce soir ?",
       "Je voulais te proposer une nouvelle partie.",
       "Les bouteilles sont chères, mais le café est bon.",
       "On se retrouve demain matin, d'accord ?",
       "Il fait beau, alors nous sortons nous promener.",
       "Merci beaucoup, à très bientôt."]
SR = 16000
BG, FG, ACCENT, OK, RED = '#faf7f0', '#1a1a1a', '#b5651d', '#2a7d2a', '#c0392b'

def words_of(t): return re.findall(r"[a-zà-ÿœ']+", t.lower())

def f0(a, sr=SR, win=.04, hop=.01, fmin=75, fmax=350):
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

def seg_trends(a):
    """Découpe la voix en segments (silences) et rend la pente de pitch (demi-tons) en fin de chacun."""
    f = f0(a); v = f > 0; n = len(f); segs = []; i = 0
    while i < n:
        if v[i]:
            j = i; gap = 0
            while j < n and gap < 12:            # tolère ≤120 ms de trou dans un segment
                gap = gap + 1 if not v[j] else 0; j += 1
            segs.append((i, j)); i = j
        else: i += 1
    out = []
    for s, e in segs:
        vv = f[s:e]; vv = vv[vv > 0]
        if len(vv) < 6: continue
        m = len(vv); tail = vv[-max(3, m // 5):]; body = vv[:-max(3, m // 5)]
        d = 12 * np.log2(np.median(tail) / np.median(body)) if len(body) and np.median(body) > 0 else 0.
        out.append(d)
    return out

class GUI:
    def __init__(self, root):
        self.root = root; self.ready = False; self.stream = None; self.frames = []
        root.title("OMEGA — test de ta voix (local, sans Google)")
        root.configure(bg=BG); root.geometry("720x760")
        big = ('Segoe UI', 12); huge = ('Segoe UI', 15, 'bold')

        tk.Label(root, text="1) Lis ce texte à voix haute (fais les pauses, monte la voix sur les questions) :",
                 bg=BG, fg=FG, font=('Segoe UI', 12, 'bold'), anchor='w', wraplength=680, justify='left').pack(fill='x', padx=16, pady=(14, 4))
        reft = tk.Text(root, height=9, font=('Segoe UI', 14), wrap='word', bg='#fffdf8', fg=FG, relief='solid', bd=1)
        for k, s in enumerate(REF): reft.insert('end', '%d.  %s\n' % (k + 1, s))
        reft.config(state='disabled'); reft.pack(fill='x', padx=16, pady=4)

        row = tk.Frame(root, bg=BG); row.pack(fill='x', padx=16, pady=(8, 4))
        tk.Label(row, text="Micro :", bg=BG, fg=FG, font=big).pack(side='left')
        self.mics = self._mics()
        self.mic_var = tk.StringVar(value=self.mics[0][1] if self.mics else '')
        ttk.Combobox(row, textvariable=self.mic_var, values=[n for _, n in self.mics],
                     state='readonly', width=44, font=('Segoe UI', 10)).pack(side='left', padx=8)

        self.btn = tk.Button(root, text="🎤  Démarrer", font=huge, bg=ACCENT, fg='white',
                             activebackground='#8f4f16', activeforeground='white', relief='flat',
                             height=2, command=self.toggle, state='disabled')
        self.btn.pack(fill='x', padx=16, pady=8)
        self.status = tk.Label(root, text="chargement du modèle… (~20 s la 1re fois)", bg=BG,
                               fg=ACCENT, font=('Segoe UI', 11, 'italic'))
        self.status.pack(fill='x', padx=16)

        tk.Label(root, text="Texte reconnu (vert = juste, rouge = raté) :", bg=BG, fg=FG,
                 font=big, anchor='w').pack(fill='x', padx=16, pady=(10, 0))
        self.out = scrolledtext.ScrolledText(root, height=5, font=('Segoe UI', 14), wrap='word',
                                             bg='white', fg=FG, relief='solid', bd=1)
        self.out.tag_config('ok', foreground=OK); self.out.tag_config('no', foreground=RED, underline=1)
        self.out.pack(fill='x', padx=16, pady=6)
        self.score = tk.Label(root, text='', bg=BG, fg=FG, font=('Segoe UI', 13, 'bold'), anchor='w')
        self.score.pack(fill='x', padx=16)

        tk.Label(root, text="Mélodie — le pitch monte-t-il sur tes questions ?", bg=BG, fg=FG,
                 font=big, anchor='w').pack(fill='x', padx=16, pady=(8, 0))
        self.pitch = scrolledtext.ScrolledText(root, height=9, font=('Consolas', 11), wrap='word',
                                               bg='#f0ece3', fg=FG, relief='solid', bd=1)
        self.pitch.pack(fill='both', expand=True, padx=16, pady=(4, 12))
        threading.Thread(target=self._load, daemon=True).start()

    def _mics(self):
        out = []
        try:
            for i, d in enumerate(sd.query_devices()):
                if d.get('max_input_channels', 0) > 0: out.append((i, '%d — %s' % (i, d['name'])))
        except Exception: pass
        return out or [(None, 'micro par défaut')]

    def _ui(self, fn): self.root.after(0, fn)
    def set_status(self, s, c=ACCENT): self._ui(lambda: self.status.config(text=s, fg=c))

    def _load(self):
        try: A.init()
        except Exception as e: self.set_status("erreur de chargement : " + str(e), 'red'); return
        self.ready = True
        self._ui(lambda: self.btn.config(state='normal'))
        self.set_status("prêt — clique « Démarrer » et lis le texte", OK)

    def _dev(self):
        sel = self.mic_var.get()
        for i, n in self.mics:
            if n == sel: return i
        return None

    def toggle(self):
        if self.stream is None: self._start()
        else: self._stop()

    def _start(self):
        try:
            self.frames = []
            def cb(indata, n, t, status): self.frames.append(indata.copy())
            self.stream = sd.InputStream(samplerate=SR, channels=1, device=self._dev(), callback=cb)
            self.stream.start()
            self.btn.config(text="⏹  Arrêter", bg=RED)
            self.set_status("🎤 enregistrement… lis le texte, puis clique « Arrêter »", RED)
        except Exception as e:
            self.stream = None; self.set_status("micro impossible : " + str(e), 'red')

    def _stop(self):
        try:
            self.stream.stop(); self.stream.close()
        except Exception: pass
        self.stream = None
        self.btn.config(text="🎤  Démarrer", bg=ACCENT, state='disabled')
        self.set_status("traitement…")
        threading.Thread(target=self._process, daemon=True).start()

    def _process(self):
        try:
            if not self.frames:
                self.set_status("rien enregistré — vérifie le micro", 'red')
                self._ui(lambda: self.btn.config(state='normal')); return
            a = np.concatenate(self.frames)[:, 0].astype('float32')
            path = os.path.join(tempfile.gettempdir(), 'omega_asr_rec.wav')
            sf.write(path, a, SR)
            text = A.run(path)
            trends = seg_trends(a)
            self._ui(lambda: self._show(text, trends, path))
            self.set_status("prêt — tu peux recommencer", OK)
        except Exception as e:
            self.set_status("erreur : " + str(e), 'red')
        finally:
            self._ui(lambda: self.btn.config(state='normal'))

    def _show(self, text, trends, path):
        # texte reconnu, coloré vs référence (sac de mots)
        ref = words_of(' '.join(REF)); rec = words_of(text)
        from collections import Counter
        pool = Counter(ref); ok = 0
        self.out.config(state='normal'); self.out.delete('1.0', 'end')
        for w in rec:
            good = pool.get(w, 0) > 0
            if good: pool[w] -= 1; ok += 1
            self.out.insert('end', w + ' ', 'ok' if good else 'no')
        self.out.config(state='disabled')
        self.score.config(text="Mots justes : %d / %d  (%d%%)   ·   WAV : %s"
                          % (ok, len(ref), round(100 * ok / max(1, len(ref))), path))
        # mélodie : trends alignés aux phrases de référence (par ordre) si le compte colle
        self.pitch.delete('1.0', 'end')
        def arrow(d): return '⬆ monte' if d > 1 else ('⬇ descend' if d < -1 else '→ plat')
        if len(trends) == len(REF):
            good = 0
            for k, (s, d) in enumerate(zip(REF, trends)):
                q = s.rstrip().endswith('?')
                hit = (q and d > 1) or (not q and d <= 1)
                good += hit
                self.pitch.insert('end', '%d. %-6s  ta voix: %-9s (%+.1f 1/2t)  %s\n'
                                  % (k + 1, '?' if q else '.', arrow(d), d, '✓' if hit else '✗'))
            self.pitch.insert('end', '\nQuestions détectées par le pitch : %d/%d\n' % (
                sum(1 for s, d in zip(REF, trends) if s.rstrip().endswith('?') and d > 1),
                sum(1 for s in REF if s.rstrip().endswith('?'))))
        else:
            self.pitch.insert('end', 'segments voix détectés : %d (attendu %d) — lis les 8 phrases avec une pause nette entre chacune.\n\n' % (len(trends), len(REF)))
            for k, d in enumerate(trends): self.pitch.insert('end', 'segment %d : %s (%+.1f)\n' % (k + 1, arrow(d), d))

def main():
    root = tk.Tk(); GUI(root); root.mainloop()

if __name__ == '__main__':
    main()
