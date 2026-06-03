# OMEGA·KEY — Guide : chat chiffré entre deux appareils (sans copier-coller)

**Version visée :** OMEGA_KEY_v15.html · **Relais :** omega-relay.ts
**Daté :** 03/06/2026

Ce guide explique comment **lier deux instances** d'OMEGA·KEY pour discuter en
chiffré, sans copier-coller, via un petit relais. Il inclut un **protocole de
test** à exécuter quand tu auras deux appareils sous la main.

---

## 0. Vue d'ensemble — trois couches indépendantes

```
   APPAREIL A                      RELAIS (Deno)                 APPAREIL B
  ┌───────────┐   chiffré OMEGA   ┌─────────────┐  chiffré OMEGA ┌───────────┐
  │  message  │ ───POST /r/salon─▶│  file 1 h    │◀──GET ?since──│  sondage  │
  │  en clair │                   │ (ne voit que │  (1,5 s)       │  → clair  │
  └───────────┘                   │  du chiffré) │                └───────────┘
        ▲                          └─────────────┘                      ▲
        └─── clé OMEGA (passphrase) + Ratchet DH ─── le clair n'existe QUE sur A et B
```

1. **Clé partagée** (confidentialité) — dérivée d'une **passphrase** commune (PBKDF2 → AES-256-GCM).
2. **Ratchet DH** (optionnel — forward secrecy + post-compromission) — à établir une fois.
3. **Liaison relais** (transport) — ne véhicule que le **chiffré** ; ne voit jamais le clair.

Le secret vient des couches 1–2 (OMEGA), **pas** du relais. Le relais peut donc
être public/non fiable sans compromettre le contenu.

---

## 1. Déployer le relais (gratuit, ~2 min, une seule fois)

1. Va sur **https://dash.deno.com** (compte gratuit, connexion GitHub/Google).
2. **New Playground**.
3. Efface le contenu d'exemple, **colle tout `omega-relay.ts`**.
4. **Save & Deploy**.
5. Note l'URL obtenue, du type **`https://nom-xxxx.deno.dev`**. C'est ton « URL du relais ».

> Le relais utilise **Deno KV** (intégré, rien à configurer). Les messages
> expirent automatiquement au bout d'**1 h**. Aucune donnée en clair n'y transite.

Vérification rapide (navigateur) : ouvrir `https://…deno.dev/r/test` doit
renvoyer `{"msgs":[],"now":…}`. Si oui, le relais tourne.

---

## 2. Établir la clé partagée — **des deux côtés**

Les deux appareils doivent aboutir à **la même clé AES**. Méthode :

1. **Convenir d'une passphrase commune.** Soit tu en génères une forte dans
   l'onglet **🎲 PASSPHRASE** (Mots réels ou Pseudo-mots), soit vous en choisissez
   une ensemble. **Transmets-la une seule fois par un canal sûr** (de vive voix,
   en personne…), jamais par le canal du chat.
2. Sur **chaque** appareil : onglet **🔑 PARTAGÉE**
   - champ **PHRASE** = la passphrase commune,
   - champ **SEL** = **le même des deux côtés** (laisser `OMEGA-KEY-2026` convient),
   - **🔑 DÉRIVER CLÉ COMMUNE**.
3. Vérifie que l'**empreinte de clé** affichée est **identique** sur les deux
   appareils. Si oui → même clé → vous pouvez vous chiffrer mutuellement.

> Raccourci : dans l'onglet 🎲 PASSPHRASE, **🔑 DÉRIVER LA CLÉ AES** remplit et
> dérive directement ; l'autre appareil entre la même phrase en 🔑 PARTAGÉE.

À ce stade, le chat fonctionne déjà (AES-GCM sous la clé commune). Pour la
**forward secrecy + post-compromission**, voir §5 (optionnel).

---

## 3. Connecter la liaison relais — **des deux côtés**

Dans la carte **💬 CONVERSATION CHIFFRÉE**, bloc **🔌 LIAISON DIRECTE (relais)** :

1. **URL du relais** = l'URL Deno de l'étape 1 (la même des deux côtés).
2. **Code de salon** = une chaîne convenue ensemble (3–64 car., `A-Z a-z 0-9 _ -`),
   ex. `salon-7421`. **Identique des deux côtés.**
3. **🔌 SE CONNECTER** sur les deux appareils.

Le statut passe à « ✓ Lié au salon … — réception auto (1,5 s) ». Les réglages
sont mémorisés localement (repris au prochain lancement).

---

## 4. Discuter

- Écris dans le champ message, **▶** (ou **Entrée**). La bulle affiche **« → envoyé »**.
- Les messages du correspondant **apparaissent tout seuls** (sondage 1,5 s),
  déchiffrés.
- Le fil est **conservé en clair localement** (reprise au rechargement).
  **🗑 Effacer** le supprime, fil + stockage.

Hors liaison (non connecté), l'app retombe sur le mode **copier-coller** : le
chiffré est copié automatiquement, à transmettre par tout canal.

---

## 5. (Optionnel, recommandé) Ratchet DH — forward secrecy + post-compromission

Donne : même si une clé est compromise, le **passé reste secret** (FS) et la
session **se ressoigne** (PCS). Bloc **🔗 SESSION RATCHET DH** :

1. Pré-requis : clé partagée déjà dérivée (§2).
2. Sur **chaque** appareil : **1 · GÉNÉRER MON CODE D'INIT**.
3. **Échanger les deux codes d'init** (les coller mutuellement dans **2 · CODE
   D'INIT DU PAIR**). ⚠ **Ce premier échange est encore manuel** (copier-coller
   du code d'init), car le relais n'achemine aujourd'hui que les messages, pas
   ce handshake. Une fois fait, **tous les messages suivants sont automatiques**.
4. **3 · ÉTABLIR LA SESSION** des deux côtés. Le badge de la conversation passe à
   **« 🔗 RATCHET DH »**. À partir de là, le chat via relais bénéficie de FS+PCS.

> Amélioration possible (à demander) : faire passer aussi le code d'init par le
> relais → établissement 100 % sans copier-coller.

---

## 6. Protocole de test (à exécuter quand tu as deux appareils / onglets)

Tu peux tester avec **deux onglets** du même navigateur, ou deux appareils.

| # | Étape | Résultat attendu |
|---|-------|------------------|
| 1 | Déployer le relais ; ouvrir `…/r/test` | `{"msgs":[],"now":…}` |
| 2 | Sur A et B : dériver la clé (même passphrase + même sel) | **empreinte de clé identique** sur A et B |
| 3 | Sur A et B : même URL relais + même code de salon → Se connecter | statut « ✓ Lié … » des deux côtés |
| 4 | A écrit « bonjour » → ▶ | bulle A « → envoyé » ; **≤ 2 s** plus tard, « bonjour » apparaît chez B (bulle reçue) |
| 5 | B répond « salut » | apparaît chez A automatiquement |
| 6 | Mauvais sel ou mauvaise passphrase sur B | les messages **n'apparaissent pas / erreur déchiffrement** chez B (clés différentes) |
| 7 | B met un **autre code de salon** | plus aucun message ne passe (salons isolés) |
| 8 | Recharger A | le fil **réapparaît** (persistance locale) |
| 9 | (option) Établir Ratchet DH (§5) puis rechater | badge « 🔗 RATCHET DH » ; messages toujours OK |
| 10 | Couper le wifi de B 30 s pendant que A envoie, puis reconnecter B | B **rattrape** le message (TTL relais 1 h) |

Si une étape échoue, voir §7.

---

## 7. Dépannage

- **`…/r/test` ne répond pas / erreur** → relais mal déployé. Re-vérifier le
  Playground Deno (Save & Deploy), réessayer l'URL exacte (https, sans slash final superflu).
- **Connecté mais rien ne passe** → URL **ou** code de salon différents entre A et
  B ; corrige pour qu'ils soient identiques.
- **« Déchiffrement échoué » à la réception** → clés différentes : refaire §2 avec
  **exactement** la même passphrase **et** le même sel ; comparer les empreintes.
- **Messages en double / dans le désordre** → ne devrait pas arriver (dédup +
  ordre). Si Ratchet DH actif, l'ordre strict par expéditeur peut rejeter un
  message très en retard ; renvoyer.
- **CORS** : le relais renvoie `access-control-allow-origin: *`, donc OK depuis un
  fichier local ou n'importe quel domaine. Si bloqué, vérifier que tu utilises bien
  l'URL Deno (pas une autre).

---

## 8. Sécurité — garanties et limites (à connaître)

**Protégé :**
- **Contenu** : chiffré de bout en bout (AES-GCM-256 ; + Ratchet DH → FS + post-compromission). Le relais ne voit **jamais** le clair.
- **Intégrité** : tag GCM → tout message altéré est rejeté.

**Non protégé / réserves honnêtes :**
- **Métadonnées côté relais** : le relais voit le **salon**, les **horaires** et les
  **tailles** des messages (pas le contenu). Mitige en **hébergeant toi-même** le
  relais (TTL court, effacement auto à 1 h).
- **Code de salon = adresse, pas secret** : qui le connaît peut lire le chiffré du
  salon ou y spammer — mais **ne peut rien déchiffrer** sans la clé OMEGA.
- **Fil stocké en clair localement** (pour la reprise) : sur appareil partagé,
  utiliser **🗑 Effacer** ; éviter sur un poste non fiable.
- **La passphrase doit transiter par un canal sûr séparé** (jamais par le chat).
- **Effacement mémoire** : en JavaScript, on ne peut pas garantir l'effacement des
  anciennes clés en RAM (limite du navigateur).

---

## Annexe — détails techniques

**API du relais**
- `POST /r/{salon}` body `{ "id": "<id émetteur>", "m": "<chiffré base64>" }` → `{ ok, ts }`
- `GET  /r/{salon}?since={ms}` → `{ "msgs":[ {mid,id,m,ts} ], "now": <ms> }`
- TTL message : 1 h (Deno KV `expireIn`). Taille max : 200 000 car.

**Modes de chiffrement (badge de la conversation)**
- `🔒 AES-GCM 256` : clé partagée seule (pas de FS).
- `🔐 FS` : cliquet symétrique (toggle Forward Secrecy).
- `🔗 RATCHET DH` : forward secrecy + post-compromission (recommandé).

**Persistance locale** (`localStorage`)
- `omega_key_chat_v1` : le fil de conversation (en clair).
- `omega_relay` : { url, salon } pour reconnexion rapide.

**Client : logique relais**
- Identifiant aléatoire par session → on **ignore ses propres** messages.
- Déduplication par `mid` ; curseur `since` = horloge serveur renvoyée.
- Sondage toutes les **1,5 s** (robuste sur mobile ; SSE/`kv.watch` possible plus tard).
