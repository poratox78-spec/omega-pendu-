/* b2_moteur.js — le CORPS MOU dans le navigateur (WebGPU maison, ZÉRO dépendance).
 *
 * Exécute le char-transformer B2 (14,45 M int8, data_local/b2_web.bin exporté par
 * dictee/b2_export_web.py) et rend le MÊME score que les sondes Python : log-prob moyen par
 * caractère. C'est le moteur des greffes juge-aval (sait/s'est+inf, ponctuation, vigilance) :
 * il COMPARE des candidats fabriqués par le squelette, il ne produit jamais rien.
 *
 * Parité : chaque étape reproduit PyTorch au bit de conception près —
 *   LayerNorm eps 1e-5 · attention causale 1/sqrt(48), softmax en ligne · GELU exact (erf,
 *   approx Abramowitz-Stegun 7.1.26, |ε|<1,5e-7) · poids int8 déquantifiés par LIGNE de sortie.
 * Le fichier .bin porte cfg + vocab : un ré-entraînement = un nouveau .bin, ce moteur ne bouge pas.
 *
 * API : B2JUGE.charger(url) → {ok, cfg, ms} · B2JUGE.score(s) → Promise<number> · B2JUGE.dispo()
 */
'use strict';
(function () {
  var G = null;   // état : {device, cfg, v2i, pipes, bufs, poids, emb (f32 CPU), zeros}

  var WGSL_MATMUL = [
    'struct U { T:u32, N:u32, K:u32, gelu:u32 };',
    '@group(0) @binding(0) var<uniform> u:U;',
    '@group(0) @binding(1) var<storage,read> X:array<f32>;',
    '@group(0) @binding(2) var<storage,read> W:array<u32>;',      // int8 packé 4/mot, (N,K) ligne-major
    '@group(0) @binding(3) var<storage,read> S:array<f32>;',      // échelle par ligne N
    '@group(0) @binding(4) var<storage,read> B:array<f32>;',      // biais (zéros si absent)
    '@group(0) @binding(5) var<storage,read_write> Y:array<f32>;',
    'fn sb(w:u32, j:u32) -> f32 { return f32((i32(w >> (j*8u)) << 24u) >> 24u); }',
    'fn erf_(x:f32) -> f32 { let s = sign(x); let a = abs(x);',
    '  let t = 1.0/(1.0+0.3275911*a);',
    '  let y = 1.0 - (((((1.061405429*t - 1.453152027)*t) + 1.421413741)*t - 0.284496736)*t + 0.254829592)*t*exp(-a*a);',
    '  return s*y; }',
    '@compute @workgroup_size(8,8) fn main(@builtin(global_invocation_id) g:vec3<u32>) {',
    '  let n = g.x; let t = g.y;',
    '  if (n >= u.N || t >= u.T) { return; }',
    '  var acc = 0.0; let kw = u.K/4u;',
    '  for (var i = 0u; i < kw; i = i+1u) {',
    '    let w = W[n*kw + i]; let x0 = t*u.K + i*4u;',
    '    acc = acc + X[x0]*sb(w,0u) + X[x0+1u]*sb(w,1u) + X[x0+2u]*sb(w,2u) + X[x0+3u]*sb(w,3u);',
    '  }',
    '  var y = acc*S[n] + B[n];',
    '  if (u.gelu == 1u) { y = 0.5*y*(1.0 + erf_(y*0.7071067811865476)); }',
    '  Y[t*u.N + n] = y;',
    '}'].join('\n');

  var WGSL_LN = [
    'struct U { T:u32, D:u32 };',
    '@group(0) @binding(0) var<uniform> u:U;',
    '@group(0) @binding(1) var<storage,read> X:array<f32>;',
    '@group(0) @binding(2) var<storage,read> W:array<f32>;',
    '@group(0) @binding(3) var<storage,read> B:array<f32>;',
    '@group(0) @binding(4) var<storage,read_write> Y:array<f32>;',
    '@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) g:vec3<u32>) {',
    '  let t = g.x; if (t >= u.T) { return; }',
    '  var m = 0.0;',
    '  for (var i = 0u; i < u.D; i = i+1u) { m = m + X[t*u.D+i]; }',
    '  m = m / f32(u.D);',
    '  var v = 0.0;',
    '  for (var i = 0u; i < u.D; i = i+1u) { let d = X[t*u.D+i]-m; v = v + d*d; }',
    '  let r = inverseSqrt(v/f32(u.D) + 1e-5);',
    '  for (var i = 0u; i < u.D; i = i+1u) { Y[t*u.D+i] = (X[t*u.D+i]-m)*r*W[i] + B[i]; }',
    '}'].join('\n');

  var WGSL_ATT = [                                                 // softmax causale en ligne (flash scalaire)
    'struct U { T:u32, D:u32, H:u32, hd:u32 };',
    '@group(0) @binding(0) var<uniform> u:U;',
    '@group(0) @binding(1) var<storage,read> QKV:array<f32>;',     // (T, 3D) : q | k | v
    '@group(0) @binding(2) var<storage,read_write> Y:array<f32>;', // (T, D)
    '@compute @workgroup_size(4,4) fn main(@builtin(global_invocation_id) g:vec3<u32>) {',
    '  let tq = g.x; let h = g.y;',
    '  if (tq >= u.T || h >= u.H) { return; }',
    '  let sc = inverseSqrt(f32(u.hd));',
    '  var acc : array<f32, 64>;',
    '  for (var j = 0u; j < u.hd; j = j+1u) { acc[j] = 0.0; }',
    '  var m = -3.0e38; var s = 0.0;',
    '  let q0 = tq*3u*u.D + h*u.hd;',
    '  for (var tk = 0u; tk <= tq; tk = tk+1u) {',
    '    let k0 = tk*3u*u.D + u.D + h*u.hd;',
    '    var d = 0.0;',
    '    for (var j = 0u; j < u.hd; j = j+1u) { d = d + QKV[q0+j]*QKV[k0+j]; }',
    '    d = d*sc;',
    '    let mn = max(m, d); let fa = exp(m-mn); let fb = exp(d-mn);',
    '    let v0 = tk*3u*u.D + 2u*u.D + h*u.hd;',
    '    for (var j = 0u; j < u.hd; j = j+1u) { acc[j] = acc[j]*fa + fb*QKV[v0+j]; }',
    '    s = s*fa + fb; m = mn;',
    '  }',
    '  for (var j = 0u; j < u.hd; j = j+1u) { Y[tq*u.D + h*u.hd + j] = acc[j]/s; }',
    '}'].join('\n');

  var WGSL_ADD = [
    'struct U { n:u32 };',
    '@group(0) @binding(0) var<uniform> u:U;',
    '@group(0) @binding(1) var<storage,read> A:array<f32>;',
    '@group(0) @binding(2) var<storage,read_write> Y:array<f32>;',
    '@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) g:vec3<u32>) {',
    '  if (g.x < u.n) { Y[g.x] = Y[g.x] + A[g.x]; }',
    '}'].join('\n');

  function dispo() { return typeof navigator !== 'undefined' && !!navigator.gpu; }

  function buf(dev, arr, usage) {
    var b = dev.createBuffer({ size: (arr.byteLength + 3) & ~3, usage: usage, mappedAtCreation: true });
    new Uint8Array(b.getMappedRange()).set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength));
    b.unmap(); return b;
  }
  function bufVide(dev, octets) {
    // COPY_DST obligatoire : sans lui, queue.writeBuffer(X) est REJETÉ en validation (erreur
    // asynchrone, silencieuse dans le flux) et le modèle calcule sur des zéros. Payé une fois.
    return dev.createBuffer({ size: octets, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
  }
  function uni(dev, vals) {
    var a = new Uint32Array(vals);
    return buf(dev, a, GPUBufferUsage.UNIFORM);
  }

  async function charger(url) {
    var t0 = Date.now();
    if (!dispo()) return { ok: false, raison: 'webgpu-absent' };
    var ad = await navigator.gpu.requestAdapter();
    if (!ad) return { ok: false, raison: 'webgpu-adaptateur-nul' };
    var dev = await ad.requestDevice();
    var rep = await fetch(url, { cache: 'reload' });                       // piège cache appris sur l'EN
    if (!rep.ok) return { ok: false, raison: 'poids-' + rep.status };
    var bin = await rep.arrayBuffer();
    var dv = new DataView(bin);
    var hlen = dv.getUint32(0, true);
    var head = JSON.parse(new TextDecoder().decode(new Uint8Array(bin, 4, hlen)));
    var base = (4 + hlen + 3) & ~3;
    var cfg = head.cfg;
    var v2i = {}; head.chars.forEach(function (c, i) { v2i[c] = i; });
    var V = head.chars.length;

    var poids = {};                                                        // offsets portés par l'en-tête (source unique)
    head.tenseurs.forEach(function (tn) {
      tn._off = base + tn.off;
      tn._n = tn.shape.reduce(function (a, b) { return a * b; }, 1);
      poids[tn.name] = tn;
    });
    function f32De(name) { var t = poids[name]; return new Float32Array(bin, t._off, t._n); }
    function gpuI8(name) { var t = poids[name]; return buf(dev, new Uint8Array(bin, t._off, t._n), GPUBufferUsage.STORAGE); }
    function gpuF32(name) { return buf(dev, f32De(name), GPUBufferUsage.STORAGE); }

    // l'embedding se déquantifie UNE fois côté CPU (gather trivial) ; il reste int8 côté GPU pour les logits
    var embQ = new Int8Array(bin, poids['emb.weight']._off, poids['emb.weight']._n);
    var embS = f32De('emb.weight.scale');
    var emb = new Float32Array(V * cfg.DM);
    for (var r = 0; r < V; r++) for (var c = 0; c < cfg.DM; c++) emb[r * cfg.DM + c] = embQ[r * cfg.DM + c] * embS[r];
    var pos = f32De('pos.weight');

    var mods = {
      mm: dev.createShaderModule({ code: WGSL_MATMUL }),
      ln: dev.createShaderModule({ code: WGSL_LN }),
      at: dev.createShaderModule({ code: WGSL_ATT }),
      ad: dev.createShaderModule({ code: WGSL_ADD }),
    };
    for (var mk in mods) {                                                 // un shader qui ne compile pas rend des dispatchs MUETS — on refuse de démarrer aveugle
      var inf = await mods[mk].getCompilationInfo();
      var errs = (inf.messages || []).filter(function (m) { return m.type === 'error'; });
      if (errs.length) return { ok: false, raison: 'wgsl-' + mk + ': ' + errs.map(function (m) { return 'L' + m.lineNum + ':' + m.message; }).join(' | ') };
    }
    dev.pushErrorScope('validation');
    function pipe(mod) { return dev.createComputePipeline({ layout: 'auto', compute: { module: mod, entryPoint: 'main' } }); }
    var pipes = { mm: pipe(mods.mm), ln: pipe(mods.ln), at: pipe(mods.at), ad: pipe(mods.ad) };
    var verr = await dev.popErrorScope();
    if (verr) return { ok: false, raison: 'pipeline: ' + verr.message };

    var CTX = cfg.CTX, DM = cfg.DM, FF = cfg.FF;
    var bufs = {
      X: bufVide(dev, CTX * DM * 4), H: bufVide(dev, CTX * DM * 4),
      QKV: bufVide(dev, CTX * 3 * DM * 4), PROJ: bufVide(dev, CTX * DM * 4),
      FFH: bufVide(dev, CTX * FF * 4), LOG: bufVide(dev, CTX * V * 4),
      LECT: dev.createBuffer({ size: CTX * V * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }),
      ZDM: buf(dev, new Float32Array(DM), GPUBufferUsage.STORAGE),         // biais zéro (logits)
      ZV: buf(dev, new Float32Array(V), GPUBufferUsage.STORAGE),
    };
    var W = { blocs: [] };
    for (var l = 0; l < cfg.NL; l++) {
      var p = 'blocs.' + l + '.';
      W.blocs.push({
        ln1w: gpuF32(p + 'ln1.weight'), ln1b: gpuF32(p + 'ln1.bias'),
        ln2w: gpuF32(p + 'ln2.weight'), ln2b: gpuF32(p + 'ln2.bias'),
        qkvW: gpuI8(p + 'att.in_proj_weight'), qkvS: gpuF32(p + 'att.in_proj_weight.scale'), qkvB: gpuF32(p + 'att.in_proj_bias'),
        prW: gpuI8(p + 'att.out_proj.weight'), prS: gpuF32(p + 'att.out_proj.weight.scale'), prB: gpuF32(p + 'att.out_proj.bias'),
        f1W: gpuI8(p + 'ff.0.weight'), f1S: gpuF32(p + 'ff.0.weight.scale'), f1B: gpuF32(p + 'ff.0.bias'),
        f2W: gpuI8(p + 'ff.2.weight'), f2S: gpuF32(p + 'ff.2.weight.scale'), f2B: gpuF32(p + 'ff.2.bias'),
      });
    }
    W.lnfw = gpuF32('lnf.weight'); W.lnfb = gpuF32('lnf.bias');
    W.embW = gpuI8('emb.weight'); W.embS = gpuF32('emb.weight.scale');

    G = { dev: dev, cfg: cfg, v2i: v2i, V: V, pipes: pipes, bufs: bufs, W: W, emb: emb, pos: pos };
    return { ok: true, cfg: cfg, ms: Date.now() - t0 };
  }

  function passeMM(enc, T, N, K, gelu, X, Wq, S, B, Y) {
    var d = G.dev, p = G.pipes.mm;
    var bg = d.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: uni(d, [T, N, K, gelu]) } },
      { binding: 1, resource: { buffer: X } }, { binding: 2, resource: { buffer: Wq } },
      { binding: 3, resource: { buffer: S } }, { binding: 4, resource: { buffer: B } },
      { binding: 5, resource: { buffer: Y } }] });
    var c = enc.beginComputePass(); c.setPipeline(p); c.setBindGroup(0, bg);
    c.dispatchWorkgroups(Math.ceil(N / 8), Math.ceil(T / 8)); c.end();
  }
  function passeLN(enc, T, D, X, Wf, Bf, Y) {
    var d = G.dev, p = G.pipes.ln;
    var bg = d.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: uni(d, [T, D]) } },
      { binding: 1, resource: { buffer: X } }, { binding: 2, resource: { buffer: Wf } },
      { binding: 3, resource: { buffer: Bf } }, { binding: 4, resource: { buffer: Y } }] });
    var c = enc.beginComputePass(); c.setPipeline(p); c.setBindGroup(0, bg);
    c.dispatchWorkgroups(Math.ceil(T / 64)); c.end();
  }
  function passeATT(enc, T) {
    var d = G.dev, p = G.pipes.at, cfg = G.cfg;
    var bg = d.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: uni(d, [T, cfg.DM, cfg.NH, cfg.DM / cfg.NH]) } },
      { binding: 1, resource: { buffer: G.bufs.QKV } }, { binding: 2, resource: { buffer: G.bufs.PROJ } }] });
    var c = enc.beginComputePass(); c.setPipeline(p); c.setBindGroup(0, bg);
    c.dispatchWorkgroups(Math.ceil(T / 4), Math.ceil(cfg.NH / 4)); c.end();
  }
  function passeADD(enc, n, A, Y) {
    var d = G.dev, p = G.pipes.ad;
    var bg = d.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: uni(d, [n]) } },
      { binding: 1, resource: { buffer: A } }, { binding: 2, resource: { buffer: Y } }] });
    var c = enc.beginComputePass(); c.setPipeline(p); c.setBindGroup(0, bg);
    c.dispatchWorkgroups(Math.ceil(n / 64)); c.end();
  }

  async function score(s) {
    if (!G) throw new Error('B2JUGE.charger() d abord');
    var cfg = G.cfg, DM = cfg.DM, FF = cfg.FF, V = G.V;
    var ids = [];
    for (var i = 0; i < s.length && i < cfg.CTX; i++) ids.push(G.v2i[s[i]] !== undefined ? G.v2i[s[i]] : 0);
    var T = ids.length;
    if (T < 3) return -99.0;
    var x = new Float32Array(T * DM);                                      // emb + pos, côté CPU
    for (var t = 0; t < T; t++)
      for (var c2 = 0; c2 < DM; c2++) x[t * DM + c2] = G.emb[ids[t] * DM + c2] + G.pos[t * DM + c2];
    G.dev.queue.writeBuffer(G.bufs.X, 0, x);

    var enc = G.dev.createCommandEncoder();
    for (var l = 0; l < cfg.NL; l++) {
      var b = G.W.blocs[l];
      passeLN(enc, T, DM, G.bufs.X, b.ln1w, b.ln1b, G.bufs.H);
      passeMM(enc, T, 3 * DM, DM, 0, G.bufs.H, b.qkvW, b.qkvS, b.qkvB, G.bufs.QKV);
      passeATT(enc, T);                                                    // QKV → PROJ (T×DM)
      passeMM(enc, T, DM, DM, 0, G.bufs.PROJ, b.prW, b.prS, b.prB, G.bufs.H);
      passeADD(enc, T * DM, G.bufs.H, G.bufs.X);
      passeLN(enc, T, DM, G.bufs.X, b.ln2w, b.ln2b, G.bufs.H);
      passeMM(enc, T, FF, DM, 1, G.bufs.H, b.f1W, b.f1S, b.f1B, G.bufs.FFH);
      passeMM(enc, T, DM, FF, 0, G.bufs.FFH, b.f2W, b.f2S, b.f2B, G.bufs.PROJ);
      passeADD(enc, T * DM, G.bufs.PROJ, G.bufs.X);
    }
    passeLN(enc, T, DM, G.bufs.X, G.W.lnfw, G.W.lnfb, G.bufs.H);
    passeMM(enc, T, V, DM, 0, G.bufs.H, G.W.embW, G.W.embS, G.bufs.ZV, G.bufs.LOG);
    enc.copyBufferToBuffer(G.bufs.LOG, 0, G.bufs.LECT, 0, T * V * 4);
    G.dev.queue.submit([enc.finish()]);

    await G.bufs.LECT.mapAsync(GPUMapMode.READ, 0, T * V * 4);
    var lg = new Float32Array(G.bufs.LECT.getMappedRange(0, T * V * 4).slice(0));
    G.bufs.LECT.unmap();
    var somme = 0;                                                         // log_softmax + gather en JS (V=278)
    for (var t2 = 1; t2 < T; t2++) {
      var o = (t2 - 1) * V, mx = -Infinity;
      for (var j = 0; j < V; j++) if (lg[o + j] > mx) mx = lg[o + j];
      var se = 0;
      for (var j2 = 0; j2 < V; j2++) se += Math.exp(lg[o + j2] - mx);
      somme += lg[o + ids[t2]] - mx - Math.log(se);
    }
    return somme / (T - 1);
  }

  if (typeof window !== 'undefined') window.B2JUGE = { charger: charger, score: score, dispo: dispo };
})();
