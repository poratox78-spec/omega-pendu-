# OMEGA·KEY — Mémoire technique (handoff Claude Code)

> **But de ce document :** donner à un agent (Claude Code) ou à un dev tout le
> contexte pour reprendre, vérifier et faire évoluer OMEGA·KEY sans relire
> l'historique. Architecture, cryptographie, décisions, tests, limites, pistes.

**Build de référence :** `app/omega-key.html` — v0.16 — MD5 `fd89d3ba68494ac9f4af5de2876d8c20` (~201 Ko).
**Relais :** `server/omega-relay.ts` (Deno Deploy + Deno KV).
**Daté :** 03/06/2026.

---

## 1. Vue d'ensemble & philosophie

OMEGA·KEY est un **dérivé applicatif** du moteur cognitif OMEGA-Ω. Il réutilise le
substrat OMEGA (graine sémantique `MASTER_SEED`, dynamiques) comme **source
d'identité/entropie et habillage**, mais **délègue tout le chiffrement à
WebCrypto** (primitives standard). Aucune crypto maison.

- **Fichier unique** : tout (HTML + CSS + JS module) dans `app/omega-key.html`.
  S'ouvre hors-ligne. Le `<script type="module">` est en fin de `<body>` ;
  les handlers sont exposés sur `window.*`.
- **Pas de dépendance, pas de build** : pas de bundler, pas de npm. On édite le
  HTML directement.
- **Réseau optionnel** : seul le relais (chat sans copier-coller) parle au réseau,
  et il ne voit que du chiffré.

Trois couches **indépendantes** : (1) clé partagée par passphrase, (2) Double
Ratchet DH, (3) transport relais. Le secret vient de (1)+(2), pas de (3).

---

## 2. Architecture du fichier

Ordre approximatif dans `app/omega-key.html` :

1. **`<head>` / CSS** : thème terminal cyberpunk (IBM Plex Mono + Share Tech Mono,
   fond `--bg #010810`, accents `--cyan #00d4ff` / `--green #00ff9f` / `--amber`),
   overlays scanlines (`body::before/::after`), grille `.main-grid`.
2. **Corps UI** : panneaux (`.panel`, `.panel-full`), onglets (clé partagée,
   passphrase, P2P), carte conversation, blocs ratchet/relais.
3. **Moteur OMEGA réutilisé** : graine, dynamiques, `seedFingerprint`,
   `rebuildSemanticSpace`, etc. (hérité, non critique pour la crypto).
4. **Crypto WebCrypto** : dérivation de clé, AES-GCM, HKDF/HMAC, ECDH, ratchet.
5. **Génération de passphrases** : `WORDLIST_FR`, `SYLL_FR`, `SYLL_SAFE`, tirage
   sans biais.
6. **Couche chat** (`chatSend`, `chatReceiveCipher`, `chatRender`, persistance).
7. **Couche relais** (`relayToggle`, `relayPoll`, `relaySend`, dédup).
8. **P2P WebRTC** (héritage : échange de seed ; **non utilisé** pour le chat —
   voir Décisions §4).

### Conventions
- Routage de chiffrement par **réassignation `window`** :
  `window.encryptMsg = encryptMsgDR` / `window.decryptMsg = decryptMsgDR`.
  ⚠ **Toujours appeler `window.encryptMsg()`** (pas le bare `encryptMsg`) pour
  bénéficier du routage DR→FS→standard ; le bare identifiant pointe la fonction
  standard d'origine (piège de portée module).
- Champs DOM **scratch** réutilisés par la couche chat : `#enc-plain`,
  `#enc-cipher`, `#dec-result` (l'ancien formulaire 2-colonnes est `display:none`
  mais ses éléments restent dans le DOM comme zone de travail).

---

## 3. Cryptographie (détaillé)

### 3.1 Dérivation de clé (racine de confidentialité)
- `deriveSharedKey` : **PBKDF2-SHA256, 310 000 itérations**, sel = `#pbkdf-salt`
  (peut être public), sortie **AES-256-GCM** (`extractable`).
- **Sel recommandé : unique par conversation.** Le bouton `↺ ALÉATOIRE` (`genSalt`)
  génère un sel CSPRNG **96 bits** à communiquer au pair (canal en clair OK). Le sel
  par défaut `OMEGA-KEY-2026` est conservé pour rétro-compat mais **déclenche un
  avertissement** à la dérivation : un sel constant partagé par tous les utilisateurs
  permet un **précalcul** (passphrase→clé) réutilisable et donne la même clé à deux
  paires ayant la même passphrase. PBKDF2 reste favorable au GPU → privilégier des
  passphrases longues (cf. §3.2) ; un KDF mémoire-dur (Argon2id) serait supérieur mais
  n'est pas exposé par WebCrypto.
- Empreinte de clé = 8 premiers octets d'un hash, en hex `aa:bb:…` — sert à
  **comparer visuellement** que les deux côtés ont la même clé.

### 3.2 Génération de passphrases (entropie exacte, sans biais modulo)
- `WORDLIST_FR` : **4096 mots** (= 2¹²) français, extraits du lexique OMEGA
  (NOM/ADJ, 4–8 lettres, 2–3 syllabes, a–z, préfixe-4 unique façon EFF),
  classés par fréquence. Tirage par **tranches de 12 bits** sur
  `crypto.getRandomValues` → **0 biais** (vérifié χ² ≈ 3967, df 4095).
- `SYLL_FR` : **256 syllabes** ouvertes CV (= 2⁸), phonotactique FR (vérifié
  uniforme χ² ≈ 310, df 255). 3 syllabes/pseudo-mot = 24 bits.
- `SYLL_SAFE` : **128 syllabes** sans cluster (= 2⁷), utilisées **après** une
  syllabe nasale (`NAS=/(?:ein|ion|on|an|in)$/`) → 0 jonction nasale→cluster sur
  160 000 essais. Entropie variable mais **exacte** (7 ou 8 bits selon contexte).
- Ancienne `buildPassphrase` (8 bits/mot + biais modulo) **remplacée** ; ne pas
  réintroduire.

### 3.3 Forward secrecy — cliquet symétrique (mode `🔐 FS`)
- Hash ratchet symétrique : chaque message avance la clé via HMAC.
  Donne **FS du passé uniquement** (pas de post-compromission). Direction
  séparée par `senderId` aléatoire ; anti-rejeu par cliquet en avant.
- Suffisant si on ne veut pas le handshake DH, mais **inférieur** au Double Ratchet.

### 3.4 Double Ratchet DH (mode `🔗 RATCHET DH`, recommandé)
- **ECDH P-256** (WebCrypto). `KDF_RK` = HKDF (64 B, via `hkdf` RFC5869 du
  fichier) ; `KDF_CK` = HMAC ; clé de message = HKDF.
- **Bootstrap** : échange unique des clés publiques ("code d'init"). Rôle
  déterminé par **comparaison des pubkeys** (plus petite = ancre Bob, plus grande
  = Alice). Authentifié par la **racine = clé partagée** (un MITM sans la
  passphrase échoue).
- **Format de message** : `'DR:' + b64( header[pub65|PN4|N4] | iv12 | ct )`.
- **Out-of-order** : clés sautées gardées jusqu'à `MAX_SKIP = 1000`.
- Fonctions préfixées `_dr*` ; état `_drState` / `_drAnchor`.
- **Routage** : `encryptMsgDR` → (si pas de session) `encryptMsgFS` → (si FS off)
  `_originalEncrypt` (AES-GCM standard). Idem en déchiffrement.

### 3.5 Relais (transport)
- API : `POST /r/{salon}` `{id,m}` ; `GET /r/{salon}?since={ms}` → `{msgs,now}`.
- Stockage **Deno KV**, clé `["room",room,ts,mid]`, **`expireIn` 1 h** (asynchrone
  possible dans la fenêtre). Taille max 200 000 car. CORS `*`.
- Client : **suppression d'écho par le chiffré émis** (`_relaySent`), pas par le
  champ `id` — un tiers du salon qui usurpe l'`id` ne peut donc plus masquer les
  messages du pair ; **dédup transport par `mid`** ; curseur `since` = `now`
  serveur ; **sondage 1,5 s**. (`id` est encore posté mais **n'est plus de
  confiance** côté réception.)
- **Anti-rejeu tous modes** : `chatReceiveCipher` rejette tout chiffré déjà accepté
  (`_recvSeen`, mémorisé après déchiffrement réussi). Comble l'absence d'anti-rejeu
  du mode AES-GCM seul ; en FS/DR le rejeu était déjà rejeté cryptographiquement.
  Les deux ensembles sont **bornés** (`_trackBounded`, cap 400) → pas de fuite mémoire.
- Le relais ne voit que `m` (chiffré OMEGA). Aucune clé n'y transite.

---

## 4. Décisions clés (et pourquoi)

| # | Décision | Raison |
|---|----------|--------|
| D1 | **Relais** plutôt que WebRTC pour le chat | Contenu aussi sûr (E2E des deux côtés). WebRTC P2P échoue souvent sur mobile/CGNAT sans TURN ; relais HTTPS marche partout + asynchrone. Meilleur facilité×fiabilité. WebRTC expose aussi l'IP des pairs. |
| D2 | **Double Ratchet DH** plutôt que PSK statique | Un PSK statique seul ne donne **pas** de forward secrecy (cf. TLS 1.3 `psk_ke` vs `psk_dhe_ke`, RFC 9257/8446). Le cliquet symétrique seul = FS passé sans PCS. Le DH ratchet (Signal, Perrin/Marlinspike) injecte de la fraîcheur → FS + PCS, asynchrone. |
| D3 | **WebCrypto** pour toute la crypto | Primitives standard auditées ; OMEGA ne fournit que l'entropie/identité, jamais d'algo maison. |
| D4 | **Tirage par tranches de bits** (pas de modulo) | Élimine le biais de modulo dans la génération de passphrases (entropie exacte, vérifiée χ²). |
| D5 | `localStorage` **enrobé try/catch** | Fichier autonome → `localStorage` OK en usage réel ; en aperçu sandbox il peut être bloqué → ne jamais planter, dégrader en mémoire seule. |
| D6 | Couche chat = **habillage** du moteur | `chatSend/Receive` n'appellent que `window.encryptMsg/decryptMsg` → le routage standard/FS/DR est conservé sans duplication. |

---

## 5. UI / UX

- **Conversation** : fil de bulles (out vert/droite, in cyan/gauche, 14 px lisible
  mobile), badge de mode, `Entrée`=envoyer / `Maj+Entrée`=newline.
- **Indicateur d'envoi** : `✓ copié` (presse-papier OK) / `⚠ copie manuelle`
  (bloqué) / `→ envoyé` (via relais) / `⚠ échec envoi`.
- **Auto-collage** : `onpaste` sur la zone de réception → déchiffrement auto.
- **Persistance** : fil → `localStorage` `omega_key_chat_v1` (en clair), restauré
  au boot ; réglages relais → `omega_relay`.
- **Responsive (v16)** : la grille `.main-grid` était figée en 2 colonnes sans
  media query → débordement à droite sur mobile. **Correctif** : `@media
  (max-width:720px){ .main-grid{grid-template-columns:1fr} }` + `min-width:0` sur
  les items de grille (`.main-grid>*`, `.panel`, `.vocab-heat`, `.enc-grid`) +
  `.share-row{flex-wrap:wrap}`. Cause = items de grille `min-width:auto` qui
  refusent de rétrécir sous une chaîne insécable.

---

## 6. Tests effectués (tous headless, Node)

> Méthode : extraire le `<script>` du HTML → `node --check` ; pour la logique,
> simuler le DOM/fetch/localStorage et exécuter les fonctions réelles extraites.

- **Syntaxe** : `node --check` sur le script à chaque version. OK.
- **Passphrases** : χ² uniformité — mots (χ²≈3967/df4095), syllabes (χ²≈310/df255) ;
  0 biais modulo ; 0 jonction nasale→cluster sur 160 000 essais.
- **Double Ratchet** (prototype `/tmp/dr_proto.js` **et** moteur extrait du
  fichier) : ping-pong + ratchet DH, out-of-order (skipped keys), tamper rejeté,
  rejeu rejeté, healing PCS — OK.
- **Couche chat** (DOM simulé) : envoi/réception → bulles out/in, `✓ copié`,
  persistance + restauration après reload, effacement (fil + storage), garde
  anti-échec (pas de clé → pas de bulle fantôme). OK.
- **Relais bout-en-bout** : vrai serveur HTTP mock (même API) + **2 clients
  isolés** (contextes `vm`) utilisant les fonctions relais réelles → B reçoit les
  messages de A, A ignore son propre écho (par le **chiffré émis**, pas par `id`),
  dédup par `mid`, curseur `since` incrémental. OK.
- **Anti-usurpation `id` + anti-rejeu** (7/7) : l'écho propre est supprimé sans
  dépendre d'`id` ; un message du pair passe même si un tiers usurpe l'`id` ; un
  chiffré rejoué est rejeté ; deux chiffrés distincts pour le même clair restent
  acceptés (aucun faux positif) ; bornage mémoire à 400. OK.

**Ce qui n'est pas testé automatiquement** : le rendu visuel réel (à confirmer
navigateur/mobile), le relais Deno réel (Deno non disponible dans le harnais — le
mock réplique l'API), le parcours UI complet bout-à-bout sur 2 appareils.

---

## 7. Limites connues & réserves

- **Fil local en clair** (`localStorage`) — pour la reprise. Sur appareil partagé :
  Effacer, ou implémenter chiffré-au-repos (voir Pistes).
- **Code de salon = adresse, pas secret** — protège le contenu via la clé OMEGA,
  pas via l'obscurité du salon.
- **Métadonnées relais** (salon/horaires/tailles) visibles du relais → auto-héberger.
- **Handshake DH encore manuel** (copier-coller du code d'init une fois) — le
  relais n'achemine pas ce handshake (voir Pistes).
- **Zéroïsation RAM** non garantie en JS.
- **Non audité** par un tiers — projet expérimental.

---

## 8. Pistes / TODO (priorisées)

1. **Handshake DH sur le relais** → établissement 100 % sans copier-coller
   (faire transiter le code d'init via un type de message `dr-init` dédié, ignoré
   du fil de conversation).
2. **Temps réel sans sondage** : SSE ou `Deno.openKv().watch()` côté relais +
   `EventSource` côté client, en remplacement du polling 1,5 s.
3. **Chiffré-au-repos du fil** : chiffrer `omega_key_chat_v1` sous une clé dérivée
   de la passphrase ; déverrouillage à l'ouverture. Alternative : **mode éphémère**
   (aucune persistance).
4. **Nettoyage `WORDLIST_FR`** : éliminer quelques formes plurielles/variantes
   douteuses ; figer la liste (hash) pour reproductibilité.
5. **Tests automatisés / CI** : extraire les harnais headless en `test/` Node ;
   ajouter un `node --check` + suites passphrase/DR/relais en CI GitHub.
6. **TURN optionnel** si on veut réactiver WebRTC en complément du relais.
7. **Vérif d'empreinte assistée** (mots-empreinte / QR) pour comparer les clés
   sans lire 16 hex.

---

## 9. Carte des fichiers & build/test

```
omega-key/
  README.md
  LICENSE                MIT (code)
  NOTICE.md              attribution Lexique (données passphrases, CC BY-SA 4.0)
  app/omega-key.html     build v0.16 (fichier unique)
  server/omega-relay.ts  relais Deno Deploy + Deno KV
  docs/RAPPORT_MODE_EMPLOI.html   rapport/mode d'emploi (HTML stylé)
  docs/MEMOIRE_TECHNIQUE.md       ce document
  docs/GUIDE_chat_relais.md       guide pas-à-pas déploiement + liaison + test
```

**Vérifier le JS du build** (extraire le script puis check) :
```bash
python3 -c "import re;s=open('app/omega-key.html',encoding='utf-8').read();\
import sys;sc=re.findall(r'<script(?![^>]*\\bsrc=)[^>]*>(.*?)</script>',s,re.S);\
open('/tmp/k.js','w').write('\\n'.join(sc))"
node --check /tmp/k.js
```

**Discipline d'édition** (héritée d'OMEGA) : prototyper sur copie jetable dans
`/tmp/` ; ne pas modifier le build sans raison ; vérifier après chaque patch
(`node --check` + simulation ciblée). Les chaînes insécables (chiffré, empreinte)
doivent rester `word-break/overflow-wrap`.

**Déployer le relais** : voir `docs/GUIDE_chat_relais.md` §1 (Deno Deploy,
2 min, Deno KV intégré, rien à configurer).

---

## 10. Licences

- **Code** : MIT (`LICENSE`).
- **Données de passphrases** (`WORDLIST_FR`, `SYLL_FR`, `SYLL_SAFE`) **dérivées de
  Lexique** (Boris New & Christophe Pallier, lexique.org), diffusé **CC BY-SA 4.0** :
  attribution obligatoire (`NOTICE.md`) et **partage à l'identique (ShareAlike)**
  pour cette partie (l'usage commercial est autorisé sous ces conditions).
  Pour passer ces listes sous une licence **non-SA**, **régénérer depuis une source au
  domaine public ou sous licence permissive** (ex. listes EFF Diceware), sans
  données dérivées de Lexique.
