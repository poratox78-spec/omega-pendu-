#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OMEGA-Ω — interface graphique SIMPLE pour tester l'ASR local (voie B, sans Google).
Une fenêtre : choisis ton micro, clique « Enregistrer », le texte s'affiche, « Copier ».
Aucune installation en plus (tkinter est intégré à Python ; il faut juste torch/transformers/
soundfile déjà requis par asr_voix.py). Lance :

    python dictee/asr_voix_gui.py
"""
import os, sys, threading, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tkinter as tk
from tkinter import ttk, scrolledtext

try:
    import sounddevice as sd, soundfile as sf
except ImportError:
    print("Installe d'abord :  pip install sounddevice soundfile"); sys.exit(1)
import asr_voix as A

BG, FG, ACCENT, OK = '#faf7f0', '#1a1a1a', '#b5651d', '#2a7d2a'

class GUI:
    def __init__(self, root):
        self.root = root; self.ready = False
        root.title("OMEGA — test voix (local, sans Google)")
        root.configure(bg=BG); root.geometry("660x580")
        big = ('Segoe UI', 13); huge = ('Segoe UI', 15, 'bold')

        top = tk.Frame(root, bg=BG); top.pack(fill='x', padx=16, pady=(16, 6))
        tk.Label(top, text="Micro :", bg=BG, fg=FG, font=big).pack(side='left')
        self.mics = self._input_devices()
        self.mic_var = tk.StringVar(value=self.mics[0][1] if self.mics else '')
        ttk.Combobox(top, textvariable=self.mic_var, values=[n for _, n in self.mics],
                     state='readonly', width=46, font=('Segoe UI', 11)).pack(side='left', padx=8)

        dur = tk.Frame(root, bg=BG); dur.pack(fill='x', padx=16, pady=6)
        tk.Label(dur, text="Durée (s) :", bg=BG, fg=FG, font=big).pack(side='left')
        self.dur = tk.IntVar(value=5)
        tk.Spinbox(dur, from_=2, to=30, textvariable=self.dur, width=4, font=big).pack(side='left', padx=8)

        self.btn = tk.Button(root, text="🎤  Enregistrer", font=huge, bg=ACCENT, fg='white',
                             activebackground='#8f4f16', activeforeground='white', relief='flat',
                             height=2, command=self.on_record, state='disabled')
        self.btn.pack(fill='x', padx=16, pady=10)

        self.status = tk.Label(root, text="chargement du modèle… (~20 s la 1re fois)", bg=BG,
                               fg=ACCENT, font=('Segoe UI', 11, 'italic'))
        self.status.pack(fill='x', padx=16)

        tk.Label(root, text="Texte reconnu :", bg=BG, fg=FG, font=big, anchor='w').pack(fill='x', padx=16, pady=(10, 0))
        self.txt = scrolledtext.ScrolledText(root, height=6, font=('Segoe UI', 14), wrap='word',
                                             bg='white', fg=FG, relief='solid', bd=1, insertbackground=FG)
        self.txt.pack(fill='both', expand=True, padx=16, pady=6)

        bot = tk.Frame(root, bg=BG); bot.pack(fill='x', padx=16, pady=(0, 10))
        tk.Button(bot, text="📋 Copier", font=big, command=self.copy, relief='flat',
                  bg='#e8e2d5', fg=FG, activebackground='#d8d0bf').pack(side='left')
        self.details = tk.IntVar(value=0)
        tk.Checkbutton(bot, text="voir les détails (phonèmes → décodé)", variable=self.details, bg=BG,
                       fg=FG, font=('Segoe UI', 10), selectcolor=BG, activebackground=BG,
                       command=self._toggle).pack(side='left', padx=12)

        self.dbg = scrolledtext.ScrolledText(root, height=5, font=('Consolas', 10), wrap='word',
                                             bg='#f0ece3', fg='#444', relief='solid', bd=1)
        threading.Thread(target=self._load, daemon=True).start()

    def _input_devices(self):
        out = []
        try:
            for i, d in enumerate(sd.query_devices()):
                if d.get('max_input_channels', 0) > 0: out.append((i, '%d — %s' % (i, d['name'])))
        except Exception: pass
        return out or [(None, 'micro par défaut')]

    def _ui(self, fn): self.root.after(0, fn)
    def set_status(self, s, color=ACCENT): self._ui(lambda: self.status.config(text=s, fg=color))

    def _load(self):
        self.set_status("chargement de Whisper local… (télécharge ~460 Mo au 1er lancement)")
        try:
            A.whisper_load()   # moteur local (poids ouverts, PAS Google) — mesuré 98 %
        except Exception as e:
            self.set_status("Whisper indisponible (" + str(e) + ") — pip install faster-whisper", 'red'); return
        self.ready = True
        self._ui(lambda: self.btn.config(state='normal'))
        self.set_status("prêt — choisis ton micro et clique Enregistrer", OK)

    def on_record(self):
        if not self.ready: return
        self.btn.config(state='disabled')
        threading.Thread(target=self._record, daemon=True).start()

    def _record(self):
        try:
            sec = self.dur.get(); sel = self.mic_var.get(); dev = None
            for i, n in self.mics:
                if n == sel: dev = i; break
            self.set_status("🎤 parle maintenant… (%d s)" % sec, ACCENT)
            a = sd.rec(int(sec * 16000), samplerate=16000, channels=1, device=dev); sd.wait()
            path = os.path.join(tempfile.gettempdir(), 'omega_asr_gui.wav'); sf.write(path, a, 16000)
            self.set_status("traitement… (Whisper local)")
            text = A.whisper_transcribe(path)
            self._ui(lambda: self._show(text, []))
            self.set_status("prêt — reparle quand tu veux", OK)
        except Exception as e:
            self.set_status("erreur : " + str(e), 'red')
        finally:
            self._ui(lambda: self.btn.config(state='normal'))

    def _show(self, text, dbg):
        self.txt.delete('1.0', 'end'); self.txt.insert('1.0', text or '(rien capté — vérifie le micro)')
        self.dbg.delete('1.0', 'end'); self.dbg.insert('1.0', '\n'.join(dbg))

    def _toggle(self):
        if self.details.get(): self.dbg.pack(fill='both', padx=16, pady=(0, 12))
        else: self.dbg.pack_forget()

    def copy(self):
        self.root.clipboard_clear(); self.root.clipboard_append(self.txt.get('1.0', 'end').strip())
        self.set_status("copié ✓", OK)

def main():
    root = tk.Tk(); GUI(root); root.mainloop()

if __name__ == '__main__':
    main()
