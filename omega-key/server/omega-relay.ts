// ════════════════════════════════════════════════════════════════════════
//  OMEGA·KEY — RELAIS MINIMAL (boîte aux lettres éphémère)
//  Ne transporte que du CHIFFRÉ OMEGA (et des clés PUBLIQUES de handshake).
//  Ne voit jamais le clair ni aucune clé privée.
//  Déploiement gratuit en 2 min : https://dash.deno.com → New Playground →
//  coller ce fichier → Save & Deploy. L'URL obtenue (https://xxxx.deno.dev)
//  est à coller dans OMEGA·KEY (champ « URL du relais »).
//
//  API :
//    POST /r/{salon}   body {id, m}        -> stocke le message (TTL 1 h)
//    GET  /r/{salon}?since={ms}            -> { msgs:[{mid,id,m,ts}], now }   (POLL, repli)
//    GET  /sse/{salon}?since={ms}          -> text/event-stream (TEMPS RÉEL, kv.watch)
//
//  Stockage : Deno KV (intégré, gratuit, expiration auto). Aucune config.
//  Le code de salon = simple adresse de rendez-vous, PAS un secret : la
//  confidentialité vient du chiffrement OMEGA, pas du relais. Le handshake DH
//  ne transite QUE des clés PUBLIQUES (préfixe « HS: ») — un intercepteur qui
//  les substituerait est détecté côté client par le NUMÉRO DE SÉCURITÉ.
// ════════════════════════════════════════════════════════════════════════

const kv = await Deno.openKv();
const TTL_MS = 3_600_000;          // 1 h : livraison asynchrone possible dans cette fenêtre
const MAX_MSG = 200_000;           // garde-fou taille (octets base64)

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

type Msg = { mid: string; id: string; m: string; ts: number };

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

// Liste les messages d'un salon dont ts >= since, triés par ts croissant.
async function listSince(room: string, since: number): Promise<Msg[]> {
  const out: Msg[] = [];
  for await (const e of kv.list<Msg>({ prefix: ["room", room] })) {
    if (e.value.ts >= since) out.push(e.value);
  }
  out.sort((a, b) => a.ts - b.ts);
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);

  // ── SSE temps réel : GET /sse/{salon}?since={ms} ───────────────────────
  const sse = url.pathname.match(/^\/sse\/([A-Za-z0-9_-]{1,64})$/);
  if (sse && req.method === "GET") {
    const room = sse[1];
    let since = Number(url.searchParams.get("since") || "0") || 0;
    const enc = new TextEncoder();
    let alive = true;
    let reader: ReadableStreamDefaultReader<unknown> | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (o: unknown) => {
          try { controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`)); }
          catch { alive = false; }
        };
        // rattrapage du backlog (messages déjà présents depuis `since`)
        for (const m of await listSince(room, since)) { send(m); if (m.ts >= since) since = m.ts + 1; }
        send({ ready: true });

        // garde-en-vie (anti-coupure proxy) toutes les 25 s
        const ka = setInterval(() => {
          if (!alive) { clearInterval(ka); return; }
          try { controller.enqueue(enc.encode(`: ping\n\n`)); } catch { alive = false; clearInterval(ka); }
        }, 25_000);

        // surveille le « tip » du salon : il bouge à chaque nouveau message
        (async () => {
          try {
            const watch = kv.watch([["room-tip", room]]);
            reader = watch.getReader();
            while (alive) {
              const { done } = await reader.read();
              if (done || !alive) break;
              for (const m of await listSince(room, since)) { send(m); if (m.ts >= since) since = m.ts + 1; }
            }
          } catch { /* flux terminé */ }
          clearInterval(ka);
          try { controller.close(); } catch { /* déjà fermé */ }
        })();
      },
      cancel() { alive = false; try { reader?.cancel(); } catch { /* */ } },
    });

    return new Response(stream, {
      headers: { ...CORS, "content-type": "text/event-stream", "cache-control": "no-cache", "x-accel-buffering": "no" },
    });
  }

  // ── boîte aux lettres : POST/GET /r/{salon} ────────────────────────────
  const match = url.pathname.match(/^\/r\/([A-Za-z0-9_-]{1,64})$/);
  if (!match) {
    return new Response("OMEGA relay — POST/GET /r/{salon} · GET /sse/{salon} (temps réel)", { headers: CORS });
  }
  const room = match[1];

  if (req.method === "POST") {
    let body: { id?: unknown; m?: unknown };
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
    if (typeof body.m !== "string" || body.m.length === 0 || body.m.length > MAX_MSG) {
      return json({ error: "bad msg" }, 400);
    }
    const ts = Date.now();
    const mid = crypto.randomUUID();
    await kv.set(
      ["room", room, ts, mid],
      { mid, id: typeof body.id === "string" ? body.id.slice(0, 64) : "", m: body.m, ts },
      { expireIn: TTL_MS },
    );
    // bump du « tip » → réveille les flux SSE de ce salon (kv.watch)
    await kv.set(["room-tip", room], ts, { expireIn: TTL_MS });
    return json({ ok: true, ts });
  }

  if (req.method === "GET") {
    const since = Number(url.searchParams.get("since") || "0") || 0;
    return json({ msgs: await listSince(room, since), now: Date.now() });
  }

  return json({ error: "method" }, 405);
});
