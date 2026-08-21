# -*- coding: utf-8 -*-
"""Injecte la « police de son » dans l'app (bloc idempotent OMEGADYS-SON, avant </body>) :
  - 3 TTF OmegaDys en base64 (blocs text/plain, chargés paresseusement par son_ui.js) ;
  - police/son_core.js (cœur sans DOM, parité CI) + police/son_ui.js (toggle dictée, OFF défaut).
Relancer après toute modif de son_core.js / son_ui.js / des TTF. Vérif : police/parity_son.js.
"""
import base64
import io
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app', 'omega-pendu.html')
BEGIN = '<!-- OMEGADYS-SON:BEGIN (généré par police/inject_fonts.py — ne pas éditer à la main) -->'
END = '<!-- OMEGADYS-SON:END -->'


def b64(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode('ascii')


def read(path):
    return io.open(path, encoding='utf-8').read()


def main():
    fonts = [('regular', 'OmegaDys-Regular.ttf'), ('light', 'OmegaDys-Light.ttf'),
             ('heavy', 'OmegaDys-Heavy.ttf')]
    parts = [BEGIN]
    for key, fn in fonts:
        parts.append('<script type="text/plain" id="omegadys-b64-%s">%s</script>'
                     % (key, b64(os.path.join(HERE, fn))))
    parts.append('<script id="omegadys-son-core">\n%s</script>' % read(os.path.join(HERE, 'son_core.js')))
    parts.append('<script id="omegadys-son-ui">\n%s</script>' % read(os.path.join(HERE, 'son_ui.js')))
    parts.append(END)
    block = '\n'.join(parts)

    html = read(APP)
    pat = re.compile(re.escape(BEGIN) + r'[\s\S]*?' + re.escape(END))
    if pat.search(html):
        html = pat.sub(lambda _: block, html)
        action = 'remplacé'
    else:
        idx = html.rindex('</body>')
        html = html[:idx] + block + '\n' + html[idx:]
        action = 'inséré'
    with io.open(APP, 'w', encoding='utf-8', newline='') as f:
        f.write(html)
    print('OK — bloc OMEGADYS-SON %s dans %s (%d octets)' % (action, APP, len(block)))


if __name__ == '__main__':
    main()
