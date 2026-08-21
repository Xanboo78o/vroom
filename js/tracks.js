/* =============================================================================
   tracks.js — every track, hand-authored (no generation):
     PADDOCK GP     the home circuit: rounded rectangle + pit lane       [centre]
     L8TER          Adam's custom GP (traced from his SVG), pit + extra  [east]
     SWITCHBACK GP  the tight technical one (hairpins, chicane)          [west]
     THE BOWL       big flat oval                                        [south]
     OTTERBEND      flowing wide MotoGP layout                           [north]
     LOST WOODS     gravel rally stage, point-to-point                   [south-east]
   A track is a centreline (Catmull-Rom through hand points) + a width. Canvas
   strokes it: shoulder, surface, kerbs where it bends, centre dashes, a checker
   start line, a name sign, checkpoints, and a TELEPORT PAD in Kris's Corner.
   Surfaces are painted into a grip grid (asphalt / gravel / sand / grass).
   ============================================================================= */
import { PAL, hex, shade } from './palette.js';
import { rrect, blob, disc, label } from './draw.js';
import { L8TER } from './adamtrack.js';

export const SURF = { grass: 0, asphalt: 1, gravel: 2, sand: 3, water: 4 };
export const GRIP = [0.78, 1.0, 0.70, 0.62, 0.3];

export const TRK = { cx: 0, cy: -110, hx: 105, hy: 62, r: 38, w: 13 };   // Paddock GP geometry (world.js uses it too)
export function paddockLength(){ const { hx, hy, r } = TRK; return 4 * (hx - r) + 4 * (hy - r) + 2 * Math.PI * r; }
export function paddockPoint(t){            // t in [0,1) around the loop, starts mid top edge, clockwise on screen
  const { cx, cy, hx, hy, r } = TRK;
  const sX = 2 * (hx - r), sY = 2 * (hy - r), arc = Math.PI * r / 2, total = 2 * sX + 2 * sY + 4 * arc;
  let d = (((t % 1) + 1) % 1) * total;
  if(d < sX) return { x: cx - (hx - r) + d, y: cy - hy }; d -= sX;
  if(d < arc){ const a = d / r; return { x: cx + (hx - r) + Math.sin(a) * r, y: cy - hy + r - Math.cos(a) * r }; } d -= arc;
  if(d < sY) return { x: cx + hx, y: cy - hy + r + d }; d -= sY;
  if(d < arc){ const a = d / r; return { x: cx + hx - r + Math.cos(a) * r, y: cy + (hy - r) + Math.sin(a) * r }; } d -= arc;
  if(d < sX) return { x: cx + (hx - r) - d, y: cy + hy }; d -= sX;
  if(d < arc){ const a = d / r; return { x: cx - (hx - r) - Math.sin(a) * r, y: cy + hy - r + Math.cos(a) * r }; } d -= arc;
  if(d < sY) return { x: cx - hx, y: cy + hy - r - d }; d -= sY;
  const a = d / r; return { x: cx - hx + r - Math.cos(a) * r, y: cy - hy + r - Math.sin(a) * r };
}

export const TRACKS = [
  { id: 'paddock', name: 'PADDOCK GP', color: PAL.blueDark, type: 'gp', closed: true, width: TRK.w, surface: 'asphalt', analytic: true },
  { id: 'l8ter', name: 'L8TER', color: PAL.red, type: 'gp', closed: true, width: 13, surface: 'asphalt',
    pts: L8TER.loop, startIdx: L8TER.startIdx, pit: L8TER.pit, extra: L8TER.extra },
  { id: 'switchback', name: 'SWITCHBACK GP', color: PAL.blue, type: 'gp', closed: true, width: 12, surface: 'asphalt',
    pts: [[-560, -170], [-430, -170], [-380, -150], [-350, -110], [-340, -80], [-360, -58], [-400, -70], [-440, -90], [-470, -62],
          [-455, -30], [-480, -10], [-462, 30], [-400, 42], [-350, 22], [-330, 60], [-345, 96], [-400, 102], [-480, 92], [-540, 62],
          [-572, 12], [-582, -60], [-586, -120]], startIdx: 0 },
  { id: 'bowl', name: 'THE BOWL', color: PAL.pad, type: 'oval', closed: true, width: 18, surface: 'asphalt',
    oval: { cx: 0, cy: 330, hx: 150, hy: 70, r: 60 } },
  { id: 'otterbend', name: 'OTTERBEND', color: PAL.batt, type: 'moto', closed: true, width: 16, surface: 'asphalt',
    pts: [[-220, -380], [-160, -330], [-80, -312], [0, -330], [80, -322], [150, -340], [210, -400], [220, -470], [180, -530],
          [100, -560], [20, -542], [-40, -500], [-100, -520], [-170, -560], [-232, -522], [-242, -450]], startIdx: 2 },
  { id: 'lostwoods', name: 'LOST WOODS', color: PAL.armadillo, type: 'rally', closed: false, width: 9, surface: 'gravel',
    pts: [[250, 200], [300, 230], [360, 222], [400, 262], [430, 320], [480, 342], [540, 312], [590, 332], [620, 392], [600, 450],
          [540, 472], [480, 442], [440, 482], [460, 542], [520, 582], [600, 602], [680, 572], [720, 502]], startIdx: 0 },
];

/* ---- curves ------------------------------------------------------------------- */
/* centripetal Catmull-Rom through pts, resampled to ~step spacing */
export function catmull(raw, closed, step = 1.4){
  const P = raw.map(p => ({ x: p[0], y: p[1] }));
  const n = P.length, out = [];
  // open curves get phantom end points (extrapolated) so the ends don't collapse to (0,0)
  const get = i => {
    if(closed) return P[((i % n) + n) % n];
    if(i < 0) return { x: 2 * P[0].x - P[1].x, y: 2 * P[0].y - P[1].y };
    if(i > n - 1) return { x: 2 * P[n - 1].x - P[n - 2].x, y: 2 * P[n - 1].y - P[n - 2].y };
    return P[i];
  };
  const segs = closed ? n : n - 1;
  for(let s = 0; s < segs; s++){
    const p0 = get(s - 1), p1 = get(s), p2 = get(s + 1), p3 = get(s + 2);
    const tj = (a, b, t) => Math.pow(Math.hypot(b.x - a.x, b.y - a.y), 0.5) + t;
    const t0 = 0, t1 = tj(p0, p1, t0), t2 = tj(p1, p2, t1), t3 = tj(p2, p3, t2);
    const N = Math.max(6, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step * 1.5));
    for(let k = 0; k < N; k++){
      const t = t1 + (t2 - t1) * k / N;
      const A1 = lerpP(p0, p1, (t1 - t) / (t1 - t0 || 1), (t - t0) / (t1 - t0 || 1));
      const A2 = lerpP(p1, p2, (t2 - t) / (t2 - t1 || 1), (t - t1) / (t2 - t1 || 1));
      const A3 = lerpP(p2, p3, (t3 - t) / (t3 - t2 || 1), (t - t2) / (t3 - t2 || 1));
      const B1 = lerpP(A1, A2, (t2 - t) / (t2 - t0 || 1), (t - t0) / (t2 - t0 || 1));
      const B2 = lerpP(A2, A3, (t3 - t) / (t3 - t1 || 1), (t - t1) / (t3 - t1 || 1));
      out.push(lerpP(B1, B2, (t2 - t) / (t2 - t1 || 1), (t - t1) / (t2 - t1 || 1)));
    }
  }
  if(!closed) out.push({ ...P[n - 1] });
  return resample(out, closed, step);
}
function lerpP(a, b, wa, wb){ return { x: a.x * wa + b.x * wb, y: a.y * wa + b.y * wb }; }
function resample(pts, closed, step){
  const src = closed ? [...pts, pts[0]] : pts;
  let L = 0; const cum = [0];
  for(let i = 1; i < src.length; i++){ L += Math.hypot(src[i].x - src[i - 1].x, src[i].y - src[i - 1].y); cum.push(L); }
  const n = Math.max(8, Math.round(L / step)), out = [];
  let j = 0;
  for(let k = 0; k < (closed ? n : n + 1); k++){
    const d = Math.min(L, k / n * L);
    while(j < cum.length - 2 && cum[j + 1] < d) j++;
    const t = (d - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
    out.push({ x: src[j].x + (src[j + 1].x - src[j].x) * t, y: src[j].y + (src[j + 1].y - src[j].y) * t });
  }
  return { pts: out, L };
}
// tangent + left normal per sample
function frames(pts, closed){
  const out = [], n = pts.length;
  for(let i = 0; i < n; i++){
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n], p = pts[i];
    const pa = closed || i > 0 ? a : p, pb = closed || i < n - 1 ? b : p;
    const tx = pb.x - pa.x, ty = pb.y - pa.y, L = Math.hypot(tx, ty) || 1;
    out.push({ tx: tx / L, ty: ty / L, nx: -ty / L, ny: tx / L });
  }
  return out;
}
function curvature(pts, fr, closed){
  const n = pts.length, out = new Float32Array(n);
  for(let i = 0; i < n; i++){
    if(!closed && (i === 0 || i === n - 1)) continue;
    const a = fr[(i - 1 + n) % n], b = fr[(i + 1) % n];
    const da = Math.atan2(a.tx * b.ty - a.ty * b.tx, a.tx * b.tx + a.ty * b.ty);
    const p1 = pts[(i + 1) % n], p0 = pts[(i - 1 + n) % n];
    out[i] = da / (Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1);
  }
  return out;
}
function ovalPoints(O){
  const { cx, cy, hx, hy, r } = O, pts = [];
  const sX = 2 * (hx - r), sY = 2 * (hy - r), arc = Math.PI * r / 2, total = 2 * sX + 2 * sY + 4 * arc;
  const n = Math.round(total / 1.4);
  for(let i = 0; i < n; i++){
    let d = i / n * total;
    if(d < sX){ pts.push({ x: cx - (hx - r) + d, y: cy - hy }); continue; } d -= sX;
    if(d < arc){ const a = d / r; pts.push({ x: cx + (hx - r) + Math.sin(a) * r, y: cy - hy + r - Math.cos(a) * r }); continue; } d -= arc;
    if(d < sY){ pts.push({ x: cx + hx, y: cy - hy + r + d }); continue; } d -= sY;
    if(d < arc){ const a = d / r; pts.push({ x: cx + hx - r + Math.cos(a) * r, y: cy + (hy - r) + Math.sin(a) * r }); continue; } d -= arc;
    if(d < sX){ pts.push({ x: cx + (hx - r) - d, y: cy + hy }); continue; } d -= sX;
    if(d < arc){ const a = d / r; pts.push({ x: cx - (hx - r) - Math.sin(a) * r, y: cy + hy - r + Math.cos(a) * r }); continue; } d -= arc;
    if(d < sY){ pts.push({ x: cx - hx, y: cy + hy - r - d }); continue; } d -= sY;
    const a = d / r; pts.push({ x: cx - hx + r - Math.cos(a) * r, y: cy - hy + r - Math.sin(a) * r });
  }
  return { pts, L: total };
}

/* paint a ribbon's footprint into the surface grid */
export function paintSurface(W, pts, width, id){
  const S = W.surfGrid; if(!S) return;
  const half = width / 2 + 1;
  for(const p of pts){
    for(let dx = -half; dx <= half; dx += S.cell / 2) for(let dy = -half; dy <= half; dy += S.cell / 2){
      if(dx * dx + dy * dy > half * half) continue;
      const i = Math.floor((p.x + dx + W.size) / S.cell), j = Math.floor((p.y + dy + W.size) / S.cell);
      if(i < 0 || j < 0 || i >= S.n || j >= S.n) continue;
      S.data[j * S.n + i] = id;
    }
  }
}

/* ---- build: geometry + registration ------------------------------------------- */
const BUILT = [];      // per track: everything drawTracks needs
export function buildTracks(W, { wall }){
  let padI = 0;
  for(const T of TRACKS){
    let pts, L;
    if(T.analytic){ const n = Math.round(paddockLength() / 1.4); pts = []; for(let i = 0; i < n; i++) pts.push(paddockPoint(i / n)); L = paddockLength(); }
    else if(T.oval){ ({ pts, L } = ovalPoints(T.oval)); }
    else ({ pts, L } = catmull(T.pts, T.closed));
    const closed = !!T.closed;
    const fr = frames(pts, closed), curv = curvature(pts, fr, closed);
    const B = { T, pts, fr, closed, kerbs: [], pit: null, extra: null, start: null, finish: null, sign: null };
    // kerbs: red/cream strips along both edges where it bends (asphalt only)
    if(T.surface !== 'gravel'){
      const n = pts.length, thr = 0.011, kw = 1.1;
      for(const side of [-1, 1]){
        let i = 0;
        while(i < n){
          if(Math.abs(curv[i]) < thr){ i++; continue; }
          let j = i; while(j < n && Math.abs(curv[j]) >= thr) j++;
          if(j - i >= 4){
            const line = [];
            for(let s = Math.max(0, i - 2); s <= Math.min(n - 1, j + 1); s++){ const p = pts[s], f = fr[s], c = side * (T.width / 2 + kw / 2 - 0.15); line.push({ x: p.x + f.nx * c, y: p.y + f.ny * c }); }
            B.kerbs.push(line);
          }
          i = j;
        }
      }
    }
    paintSurface(W, pts, T.width + 3.6, SURF[T.surface] ?? SURF.asphalt);
    // start / finish
    let si = 0;
    if(T.startIdx != null && T.pts){ const sp = T.pts[T.startIdx]; let bd = 1e9; pts.forEach((p, i) => { const d = Math.hypot(p.x - sp[0], p.y - sp[1]); if(d < bd){ bd = d; si = i; } }); }
    const sP = pts[si], sF = fr[si];
    B.start = { x: sP.x, y: sP.y, f: sF };
    const heading = Math.atan2(sF.tx, -sF.ty);
    const start = { x: sP.x - sF.tx * 6, y: sP.y - sF.ty * 6, a: heading };
    // checkpoints
    const n = pts.length, cps = [], rad = T.width / 2 + 5;
    if(closed){ for(let k = 0; k < 6; k++){ const p = pts[(si + Math.round(k * n / 6)) % n]; cps.push({ x: p.x, y: p.y, r: rad }); } }
    else { for(const f of [0, 0.25, 0.5, 0.75, 1]){ const p = pts[Math.min(n - 1, Math.round(f * (n - 1)))]; cps.push({ x: p.x, y: p.y, r: rad }); } }
    if(!closed){ const e = pts[n - 1], ef = fr[n - 1]; B.finish = { x: e.x, y: e.y, f: ef }; }
    // name sign beside the start, on the right (a hidden wall so you can't park on it)
    const bx = sP.x - sF.nx * (T.width / 2 + 8), by = sP.y - sF.ny * (T.width / 2 + 8);
    B.sign = { x: bx, y: by };
    wall(bx, by, 4.4, 1.2, 1.2, PAL.ink, true);
    // pit lane + extra section (L8ter)
    if(T.pit){ const s = catmull(T.pit, false); B.pit = s.pts;
      const f2 = frames(s.pts, false), mi = Math.floor(s.pts.length / 2), m = s.pts[mi];
      B.pitPad = { x: m.x, y: m.y, a: Math.atan2(f2[mi].tx, -f2[mi].ty) };
      W.pits.push({ x: m.x, y: m.y, w: 12, d: 12 });
      paintSurface(W, s.pts, 7, SURF.asphalt); }
    if(T.extra){ const pe = T.extra.map(([x, y]) => [x, y]);
      for(const e of [0, pe.length - 1]){ let bd = 1e9, bp = null; for(const p of pts){ const d = Math.hypot(p.x - pe[e][0], p.y - pe[e][1]); if(d < bd){ bd = d; bp = p; } } pe[e] = [bp.x, bp.y]; }
      const s = catmull(pe, false); B.extra = s.pts; paintSurface(W, s.pts, T.width + 3.6, SURF.asphalt); }
    // register
    W.tracks.push({ id: T.id, name: T.name, color: T.color, closed, cps, start, length: L, type: T.type });
    // teleport pad in Kris's Corner
    const px = -35 + padI * 10, py = 64; padI++;
    W.pads.push({ x: px, y: py, r: 2.6, track: T.id, name: T.name, color: T.color });
    BUILT.push(B);
  }
}

/* ---- drawing -------------------------------------------------------------------- */
function stroke(ctx, pts, closed, width, colorHex, dash = null){
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for(let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if(closed) ctx.closePath();
  ctx.lineWidth = width; ctx.strokeStyle = hex(colorHex); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
}
function inView(B, view){
  // cheap: bbox of samples (cached)
  if(!B.bb){ let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for(const p of B.pts){ if(p.x < x0) x0 = p.x; if(p.x > x1) x1 = p.x; if(p.y < y0) y0 = p.y; if(p.y > y1) y1 = p.y; }
    for(const ex of [B.extra, B.pit]) if(ex) for(const p of ex){ if(p.x < x0) x0 = p.x; if(p.x > x1) x1 = p.x; if(p.y < y0) y0 = p.y; if(p.y > y1) y1 = p.y; }
    B.bb = { x0: x0 - 20, y0: y0 - 20, x1: x1 + 20, y1: y1 + 20 }; }
  return !(B.bb.x1 < view.x0 || B.bb.x0 > view.x1 || B.bb.y1 < view.y0 || B.bb.y0 > view.y1);
}
export function drawTracks(ctx, view, zoom){
  const vis = BUILT.filter(B => inView(B, view));
  // shoulders first (all), then surfaces, so joins/overlaps read right
  for(const B of vis){
    const gravel = B.T.surface === 'gravel';
    stroke(ctx, B.pts, B.closed, B.T.width + 3.6, gravel ? PAL.gravelEdge : PAL.shoulder);
    if(B.extra) stroke(ctx, B.extra, false, B.T.width + 3.6, PAL.shoulder);
    if(B.pit) stroke(ctx, B.pit, false, 7 + 2.4, PAL.shoulder);
  }
  for(const B of vis){
    const gravel = B.T.surface === 'gravel';
    stroke(ctx, B.pts, B.closed, B.T.width, gravel ? PAL.gravel : PAL.asphalt);
    if(B.extra) stroke(ctx, B.extra, false, B.T.width, PAL.asphalt);
    if(B.pit){ stroke(ctx, B.pit, false, 7, PAL.pitLane);
      const p = B.pitPad; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); rrect(ctx, -3.5, -6, 7, 12, 1.2); blob(ctx, PAL.pad, 0.12); label(ctx, 'PIT', 0, 0, 2.2, PAL.padDot); ctx.restore(); }
  }
  for(const B of vis){
    // kerbs: cream base + red dashes
    for(const line of B.kerbs){ stroke(ctx, line, false, 1.1, PAL.kerbCream); stroke(ctx, line, false, 1.1, PAL.kerbRed, [1.4, 1.4]); }
    // centre dashes
    if(B.T.surface !== 'gravel' && zoom > 6){ stroke(ctx, B.pts, B.closed, 0.35, PAL.dash, [2.2, 4.4]); if(B.extra) stroke(ctx, B.extra, false, 0.35, PAL.dash, [2.2, 4.4]); }
    // start line: checkers across + two red posts
    startLine(ctx, B.start, B.T.width);
    if(B.finish) startLine(ctx, B.finish, B.T.width, PAL.checker);
    // name sign
    const s = B.sign; label(ctx, B.T.name, s.x, s.y, 1.6, PAL.paper, { bg: B.T.color });
  }
}
function startLine(ctx, st, width, postHex = PAL.red){
  const f = st.f, sq = width / 8;
  ctx.save(); ctx.translate(st.x, st.y); ctx.rotate(Math.atan2(f.ty, f.tx));   // x axis = along the track
  for(let i = 0; i < 8; i++) for(let j = 0; j < 2; j++){
    ctx.fillStyle = hex((i + j) % 2 ? PAL.checker : PAL.checkerDark);
    ctx.fillRect(-sq + j * sq, -width / 2 + i * sq, sq, sq);
  }
  for(const s of [-1, 1]) disc(ctx, 0, s * (width / 2 + 1.6), 0.6, postHex, 0.08);
  ctx.restore();
}
