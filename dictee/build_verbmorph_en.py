# -*- coding: utf-8 -*-
# build_verbmorph_en.py — map des VERBES IRRÉGULIERS régularisés (erreur dys/L2 : runned->ran, goed->went,
# teached->taught…). Sortie : verbmorph_en.json = { forme_erreur : [passe, participe] }.
# Les formes kaikki (forms_en) se sont révélées trop bruitées pour ça (formes dialectales listées en tête,
# ex. « teuk » pour take ; fuite du lemme dans les « past »). On utilise donc une TABLE CANONIQUE curée des
# irréguliers courants (vérité linguistique, ensemble borné ~130 verbes = complétude, PAS simplification) ;
# on GÉNÈRE la forme régularisée (lemma+ed, e-drop / y->ied / doublement CVC) et on ne la garde comme erreur
# que si elle n'est PAS un vrai mot au sens NON-verbal (lex_en) -> FP=0 (ex. « seed »=NOUN écarté).
#   Lancer : PYTHONUTF8=1 python dictee/build_verbmorph_en.py
import gzip, io, os, json, sys
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))

# lemme -> [passe, participe passe] (canonique, anglais standard)
IRREG = {
 'begin':['began','begun'],'break':['broke','broken'],'bring':['brought','brought'],'build':['built','built'],
 'buy':['bought','bought'],'catch':['caught','caught'],'choose':['chose','chosen'],'come':['came','come'],
 'cost':['cost','cost'],'cut':['cut','cut'],'draw':['drew','drawn'],'drink':['drank','drunk'],
 'drive':['drove','driven'],'eat':['ate','eaten'],'fall':['fell','fallen'],'feel':['felt','felt'],
 'find':['found','found'],'fly':['flew','flown'],'forget':['forgot','forgotten'],'forgive':['forgave','forgiven'],
 'get':['got','gotten'],'give':['gave','given'],'go':['went','gone'],'grow':['grew','grown'],
 'hang':['hung','hung'],'have':['had','had'],'hear':['heard','heard'],'hide':['hid','hidden'],
 'hit':['hit','hit'],'hold':['held','held'],'hurt':['hurt','hurt'],'keep':['kept','kept'],
 'know':['knew','known'],'lay':['laid','laid'],'lead':['led','led'],'leave':['left','left'],
 'lend':['lent','lent'],'let':['let','let'],'lose':['lost','lost'],'make':['made','made'],
 'mean':['meant','meant'],'meet':['met','met'],
 'read':['read','read'],'ride':['rode','ridden'],'ring':['rang','rung'],'rise':['rose','risen'],
 'run':['ran','run'],'say':['said','said'],'see':['saw','seen'],'sell':['sold','sold'],
 'send':['sent','sent'],'set':['set','set'],'shake':['shook','shaken'],'shoot':['shot','shot'],
 'show':['showed','shown'],'shut':['shut','shut'],'sing':['sang','sung'],'sink':['sank','sunk'],
 'sit':['sat','sat'],'sleep':['slept','slept'],'speak':['spoke','spoken'],'spend':['spent','spent'],
 'stand':['stood','stood'],'steal':['stole','stolen'],'stick':['stuck','stuck'],'strike':['struck','struck'],
 'swear':['swore','sworn'],'sweep':['swept','swept'],'swim':['swam','swum'],'swing':['swung','swung'],
 'take':['took','taken'],'teach':['taught','taught'],'tear':['tore','torn'],'tell':['told','told'],
 'think':['thought','thought'],'throw':['threw','thrown'],'understand':['understood','understood'],
 'wear':['wore','worn'],'weep':['wept','wept'],'win':['won','won'],
 'wind':['wound','wound'],'write':['wrote','written'],'bite':['bit','bitten'],'blow':['blew','blown'],
 'freeze':['froze','frozen'],'light':['lit','lit'],'spread':['spread','spread'],'spin':['spun','spun'],
 'split':['split','split'],'spring':['sprang','sprung'],'feed':['fed','fed'],'fight':['fought','fought'],
 'flee':['fled','fled'],'seek':['sought','sought'],'shrink':['shrank','shrunk'],'slide':['slid','slid'],
 'beat':['beat','beaten'],'bend':['bent','bent'],'deal':['dealt','dealt'],'stink':['stank','stunk'],
}
# NB : verbes RETIRES car leur -ed régularisé est une forme VALIDE (FP) : cost(costed), quit(quitted),
# put(putted=golf), wet(wetted), bet(betted), sweat(sweated), shine(shined), hang(hanged), light(lighted),
# wind(winded), kneel(kneeled), dig(digged), burst(bursted). La garde freq>0 ci-dessous les rattraperait
# aussi, mais on les écarte à la source par prudence.

VOW = set('aeiou')
def reg_ed(w):
    if w.endswith('e'): return w + 'd'
    if len(w) >= 2 and w[-1] == 'y' and w[-2] not in VOW: return w[:-1] + 'ied'
    if len(w) >= 3 and w[-1] not in VOW and w[-1] not in 'wxy' and w[-2] in VOW and w[-3] not in VOW:
        return w + w[-1] + 'ed'
    return w + 'ed'
def err_forms(w):
    out = {reg_ed(w), w + 'ed'}
    if len(w) >= 2 and w[-1] == 'y' and w[-2] not in VOW: out.add(w[:-1] + 'ied')
    return {e for e in out if len(e) >= 4}

# PROTECT = formes-erreur à écarter (FP) : celles qui ont un sens NON-verbal (seed=NOUN, leaded=ADJ,
# runed=ADJ). Les verbes dont le -ed régularisé est une VARIANTE VERBALE valide (wetted, lighted, putted…)
# sont déjà retirés de IRREG à la source ; les -ed restants (teached, catched, taked…) sont TOUJOURS des
# erreurs, donc on n'applique PAS de garde freq (qui virerait ces vraies erreurs présentes dans le corpus).
NONVERB = {'NOUN', 'ADJ', 'ADV', 'PRON', 'DET', 'PREP', 'CONJ', 'INTJ', 'NUM', 'PROPN', 'PART'}
PROTECT = set()
with gzip.open(os.path.join(HERE, 'lex_en.tsv.gz'), 'rt', encoding='utf-8') as f:
    next(f)
    for ln in f:
        c = ln.rstrip('\n').split('\t')
        if len(c) < 4: continue
        s = c[0].lower()
        if s.isascii() and s.isalpha() and (set((c[1] or '').upper().split('|')) & NONVERB):
            PROTECT.add(s)

morph = {}
for lemma, (past, pp) in IRREG.items():
    for e in err_forms(lemma):
        if e in PROTECT or e in (past, pp, lemma): continue   # vrai mot (non-verbal ou attesté) / deja correct
        if e not in morph: morph[e] = [past, pp]

morph = {k: morph[k] for k in sorted(morph)}
io.open(os.path.join(HERE, 'verbmorph_en.json'), 'w', encoding='utf-8').write(
    json.dumps(morph, ensure_ascii=False, separators=(',', ':')))
print('verbmorph_en.json : %d verbes irreguliers -> %d formes-erreur' % (len(IRREG), len(morph)))
ex = ['runned', 'goed', 'buyed', 'teached', 'taked', 'catched', 'thinked', 'eated', 'comed', 'writed',
      'speaked', 'breaked', 'flied', 'swimmed', 'drinked', 'knowed', 'gived', 'sended', 'builded', 'seed']
print('exemples :', {e: morph.get(e, '(ecarte)') for e in ex})
