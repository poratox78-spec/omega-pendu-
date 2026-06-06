import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
files=['engine/littlejs.release.js','engine/viv_tac_module.js','src/viv_sim.js','src/viv_game.js']
esc=lambda s:s.replace('</script>','<\\/script>')
HEAD='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>VIVARIUM</title><style>html,body{margin:0;height:100%;background:#11151b;overflow:hidden;touch-action:none}canvas{display:block}</style></head><body>\n'
out=HEAD+''.join('<script>\n'+esc(open(f,encoding='utf-8').read())+'\n</script>\n' for f in files)+'</body></html>'
open('prototypes/vivarium.html','w',encoding='utf-8').write(out); print('built',len(out),'bytes')
