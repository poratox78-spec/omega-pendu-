// ════════════════════════════════════════════════════════════════════════
//  OMEGA·KEY — RELAIS MINIMAL (boîte aux lettres éphémère)
//  Ne transporte que du CHIFFRÉ OMEGA. Ne voit jamais le clair.
//  Déploiement gratuit en 2 min : https://dash.deno.com → New Playground →
//  coller ce fichier → Save & Deploy. L'URL obtenue (https://xxxx.deno.dev)
//  est à coller dans OMEGA·KEY (champ « URL du relais »).
//
//  API :
//    POST /r/{salon}   body {id, m}        -> stocke le message (TTL 1 h)
//    GET  /r/{salon}?since={ms}            -> { msgs:[{mid,id,m,ts}], now }
//
//  Stockage : Deno KV (intégré, gratuit, expiration auto). Aucune config.
//  Le code de salon = simple adresse de rendez-vous, PAS un secret : la
//  confidentialité vient du chiffrement OMEGA, pas du relais.
// ════════════════════════════════════════════════════════════════════════

const kv = await Deno.openKv();
const TTL_MS = 3_600_000;          // 1 h : livraison asynchrone possible dans cette fenêtre
const MAX_MSG = 200_000;           // garde-fou taille (octets base64)

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const match = url.pathname.match(/^\/r\/([A-Za-z0-9_-]{1,64})$/);
  if (!match) {
    return new Response("OMEGA relay — POST/GET /r/{salon}", { headers: CORS });
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
    return json({ ok: true, ts });
  }

  if (req.method === "GET") {
    const since = Number(url.searchParams.get("since") || "0") || 0;
    const msgs: unknown[] = [];
    for await (const entry of kv.list<{ mid: string; id: string; m: string; ts: number }>({ prefix: ["room", room] })) {
      if (entry.value.ts >= since) msgs.push(entry.value);
    }
    msgs.sort((a, b) => (a as { ts: number }).ts - (b as { ts: number }).ts);
    return json({ msgs, now: Date.now() });
  }

  return json({ error: "method" }, 405);
});
