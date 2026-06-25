> ⚠️ **AVERTISSEMENT SÉCURITÉ — projet expérimental NON audité cryptographiquement.** Ne pas l'utiliser pour de vrais secrets ; pour des enjeux critiques, utiliser un outil audité (Signal).

# OMEGA·KEY

> Messagerie chiffrée de bout en bout dans **un seul fichier HTML**. Passphrases
> françaises prononçables, AES-GCM-256, Double Ratchet à clés éphémères, et chat
> **sans copier-coller** via un relais minimal. Aucune dépendance, aucun serveur
> propriétaire obligatoire.

Dérivé applicatif du moteur cognitif **OMEGA-Ω** : OMEGA fournit l'identité et
l'entropie ; **toute la cryptographie repose sur la WebCrypto API** standard du
navigateur. Aucun algorithme maison.

---

## Démarrage rapide

1. **Ouvre l'app** : `app/omega-key.html` dans un navigateur (fonctionne hors-ligne).
2. **Dérive une clé partagée** : onglet *🔑 PARTAGÉE* → même passphrase + même sel
   des deux côtés → empreintes de clé identiques.
3. **Discute** : carte *💬 CONVERSATION CHIFFRÉE*. Sans liaison, le chiffré se copie
   tout seul (à transmettre). Avec liaison relais, les messages circulent
   automatiquement.

Chat automatique (sans copier-coller) :

1. Déploie le relais (`server/omega-relay.ts`) sur **Deno Deploy** (gratuit, ~2 min).
2. Dans l'app, bloc *🔌 LIAISON DIRECTE (relais)* : même URL + même code de salon
   des deux côtés → **Se connecter**.

Guide pas-à-pas complet (déploiement, liaison, **protocole de test**) :
[`docs/GUIDE_chat_relais.md`](docs/GUIDE_chat_relais.md).

---

## Fonctionnalités

- 🎲 **Passphrases FR** prononçables — mots réels (12 bits/mot) ou pseudo-mots
  (8 bits/syllabe, lissage anti-grappe nasale), **entropie exacte sans biais modulo**.
- 🔑 **Clé partagée** — PBKDF2-SHA256 (310k) → AES-256-GCM, empreinte vérifiable.
- 🔐 **Forward secrecy** — cliquet symétrique.
- 🔗 **Double Ratchet DH** — ECDH P-256, forward secrecy **+ post-compromission**.
- 💬 **Conversation** — fil de bulles, `✓ copié`, auto-collage, reprise locale, responsive.
- 🔌 **Relais** — chat sans copier-coller, transport éphémère ne voyant que du chiffré.

---

## Structure du dépôt

```
app/omega-key.html            build (fichier unique, v0.17)
server/omega-relay.ts         relais Deno Deploy + Deno KV (éphémère, CORS)
docs/RAPPORT_MODE_EMPLOI.html  rapport / mode d'emploi (HTML stylé)
docs/MEMOIRE_TECHNIQUE.md      mémoire technique détaillée (archi, crypto, décisions, tests, pistes)
docs/GUIDE_chat_relais.md      guide déploiement + liaison + test
LICENSE                        MIT (code)
NOTICE.md                      attribution Lexique (données passphrases, CC BY-SA 4.0)
```

---

## Sécurité (résumé)

**Protégé** : contenu chiffré E2E (AES-GCM-256 ; + Ratchet DH → FS + post-compromission) ;
intégrité (tag GCM). Le relais ne voit **jamais** le clair.

**Réserves honnêtes** : le relais voit des métadonnées (salon/horaires/tailles) →
auto-héberger ; le code de salon est une adresse, **pas un secret** ; le fil est
**chiffré au repos** (AES-GCM, clé dérivée de la passphrase — re-saisir la passphrase
le déverrouille) ; la passphrase doit transiter par un canal sûr séparé, et **le
numéro de sécurité** se compare hors-bande contre un intercepteur ; **projet
expérimental non audité** — pour des enjeux critiques, préférer un outil audité (Signal).

Détails : `docs/RAPPORT_MODE_EMPLOI.html` §8 et `docs/MEMOIRE_TECHNIQUE.md` §7.

---

## Pour Claude Code / développeurs

Pas de build, pas de bundler : on édite `app/omega-key.html` directement.

**Vérifier le JS du build :**
```bash
python3 -c "import re;s=open('app/omega-key.html',encoding='utf-8').read();\
sc=re.findall(r'<script(?![^>]*\\bsrc=)[^>]*>(.*?)</script>',s,re.S);\
open('/tmp/k.js','w').write('\\n'.join(sc))"
node --check /tmp/k.js
```

**Tests crypto** (entropie passphrases · gel des listes · round-trip AES-GCM · KAT Double Ratchet · numéro de sécurité) :
```bash
node omega-key/test_crypto.js     # 33 assertions ; aussi lancé en CI via dev.sh
```

**Discipline** : prototyper sur copie `/tmp/` jetable ; vérifier après chaque
patch (`node --check` + simulation DOM ciblée) ; garder les chaînes insécables en
`word-break`/`overflow-wrap`.

**Conventions clés** (détaillées dans `docs/MEMOIRE_TECHNIQUE.md`) :
- Toujours appeler `window.encryptMsg()` / `window.decryptMsg()` (routage DR→FS→standard).
- La couche chat est un *habillage* du moteur (champs scratch `#enc-plain/#enc-cipher/#dec-result`).
- `localStorage` toujours enrobé `try/catch`.

**Fait** : tests crypto **automatisés en CI** (`omega-key/test_crypto.js`, 37 assertions) · **gel des hashes** de listes · **numéro de sécurité (SAS) anti-MITM** sur le ratchet DH (comparable hors-bande) · **historique chiffré au repos** (AES-GCM, clé HKDF dérivée de la passphrase) · **relais temps réel (SSE, `kv.watch`)** + **handshake DH automatique** (échange des clés publiques d'init via le relais, ratchet sans copier-coller — la substitution est détectée par le SAS).

> ⚠️ **Le temps réel + handshake exigent de REDÉPLOYER le relais** (`server/omega-relay.ts` a un nouvel endpoint `GET /sse/{salon}`). Le client **détecte automatiquement** un relais sans SSE et **retombe sur le poll** (1,5 s) — donc rien ne casse en attendant le redéploiement.

**TODO priorisés** (voir mémoire §8) : padding des tailles (métadonnées) ; nonce GCM par compteur (avec versionnage du format).

---

## Licence

Code sous **MIT** (`LICENSE`). Les listes de mots/syllabes embarquées sont
**dérivées de Lexique** (CC BY-SA 4.0) → attribution obligatoire + partage à
l'identique (ShareAlike) pour cette partie ; usage commercial autorisé sous ces
conditions. Voir `NOTICE.md`.
