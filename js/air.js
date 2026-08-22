/* =============================================================================
   air.js — AIR THAT BEHAVES LIKE AIR. A small lattice-Boltzmann fluid (D2Q9)
   runs over each LAYER of a machine in its own frame: air streams in from the
   front (−y = forward), bounces off the real shapes (squares, the nose/wedge/
   curve triangles and arcs, your drawn PANEL polygons), speeds up around edges,
   stalls in front of blunt blocks, sheds wakes and vortices behind them.
   Out of it we take, per block, the FORCE the air puts on it (momentum it
   bounces back) — that is the block's air load, in "equivalent exposed cells"
   (a flat 1-cell plate facing the wind = 1). The wind speed only scales it:
   load × q(W) vs the block's shear = does it rip off. The whole machine's
   downstream force = its drag (m.cd). The tunnel particles ride the velocity
   field. Fixed lattice speed, so it's shape-only and always stable.
   ============================================================================= */
import { PARTS, CELL, parseKey, cellsOf, pointInPoly } from './parts.js';
import { TUNE } from './machine.js';

const R = 4;                       // lattice nodes per grid cell
const MARGIN = 5, WAKE = 9;        // cells of free air around / behind
const U0 = 0.09, TAU = 0.54;       // inlet speed (lattice units), relaxation (viscosity)
const EX = [0, 1, 0, -1, 0, 1, -1, -1, 1], EY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
const Wt = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
const OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];

/* is this node (part-local, unrotated, cell units, forward = −v) inside the part's shape? */
function inShape(def, p, u, v, w, d){
  const hw = w / 2, hd = d / 2;
  if(Math.abs(u) > hw || Math.abs(v) > hd) return false;
  const a = def.aero || (def.panel ? 'panel' : null);
  if(a === 'nose') return Math.abs(u) <= hw * (v + hd) / d;
  if(a === 'wedge') return (u + hw) <= (v + hd);                       // hypotenuse top-left → bottom-right
  if(a === 'curve') { const dx = u + hw, dy = v - hd; return dx * dx + dy * dy <= d * d; }
  if(a === 'banana') { const dx = u / hw, dy = (v + hd * 0.2) / hd; return dx * dx + dy * dy <= 1; }
  if(def.fin) return Math.abs(u) <= 0.18 * w * (v + hd) / d + 0.05;
  if(def.wheel || def.rotor || def.fan){ const rx = hw - 0.3, ry = hd - 0.3; const qx = Math.max(0, Math.abs(u) - rx), qy = Math.max(0, Math.abs(v) - ry); return qx * qx + qy * qy <= 0.09; }   // rounded
  if(def.antenna || def.flag || def.hinge) return u * u + v * v <= 0.12;   // tiny
  return true;
}

export function partsHash(m){
  let h = '';
  for(const [k, p] of m.parts) h += k + ':' + p.type + ':' + p.rot + (p.cfg && p.cfg.cells ? ':' + p.cfg.cells.length + ':' + (p.cfg.poly || []).join('') : '') + ';';
  return h;
}

/* one lattice = one layer of one machine */
function makeLattice(m, layer){
  let minI = 1e9, minJ = 1e9, maxI = -1e9, maxJ = -1e9;
  for(const [k, p] of m.parts){ const [i, j, l] = parseKey(k); for(const [ci, cj] of cellsOf(i, j, p.type, l, p)){ if(ci < minI) minI = ci; if(ci > maxI) maxI = ci; if(cj < minJ) minJ = cj; if(cj > maxJ) maxJ = cj; } }
  const x0 = minI - MARGIN - 0.5, y0 = minJ - MARGIN - 0.5;            // cell coordinate of the domain's top-left edge
  const nx = (maxI - minI + 1 + 2 * MARGIN) * R, ny = (maxJ - minJ + 1 + MARGIN + WAKE) * R;
  const N = nx * ny;
  const L = { layer, x0, y0, nx, ny, N, solid: new Uint8Array(N), part: new Int32Array(N).fill(-1), keys: [],
    f: Array.from({ length: 9 }, () => new Float32Array(N)), g: Array.from({ length: 9 }, () => new Float32Array(N)),
    ux: new Float32Array(N), uy: new Float32Array(N), rho: new Float32Array(N), F: [], load: [], loadRaw: [], steps: 0, avg: [], drag: 0 };
  // rasterize the parts of this layer
  const list = [...m.parts].filter(([k, p]) => (p.l || 0) === layer);
  list.forEach(([k, p], idx) => {
    L.keys.push(k); L.F.push([0, 0]); L.avg.push(0); L.load.push(0); L.loadRaw.push(0);
    const def = PARTS[p.type]; const [i, j] = parseKey(k);
    if(p.cfg && p.cfg.cells){   // PANEL: its polygon, in cell units relative to the anchor cell centre
      const poly = p.cfg.poly; let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; for(const [x, y] of poly){ if(x < bx0) bx0 = x; if(x > bx1) bx1 = x; if(y < by0) by0 = y; if(y > by1) by1 = y; }
      for(let gy = Math.floor((j + by0 - y0) * R); gy <= Math.ceil((j + by1 - y0) * R); gy++) for(let gx = Math.floor((i + bx0 - x0) * R); gx <= Math.ceil((i + bx1 - x0) * R); gx++){
        if(gx < 0 || gy < 0 || gx >= nx || gy >= ny) continue;
        const cx = x0 + (gx + 0.5) / R - i, cy = y0 + (gy + 0.5) / R - j;
        if(pointInPoly(cx, cy, poly)){ const n = gy * nx + gx; L.solid[n] = 1; L.part[n] = idx; } }
      return;
    }
    const [w, d] = def.fp || [2, 2]; const cxm = i + (w - 1) / 2, cym = j + (d - 1) / 2;   // part centre, cell units
    const rot = p.rot & 3, ca = Math.cos(-rot * Math.PI / 2), sa = Math.sin(-rot * Math.PI / 2);
    const ext = Math.max(w, d) / 2 + 0.5;
    for(let gy = Math.floor((cym - ext - y0) * R); gy <= Math.ceil((cym + ext - y0) * R); gy++) for(let gx = Math.floor((cxm - ext - x0) * R); gx <= Math.ceil((cxm + ext - x0) * R); gx++){
      if(gx < 0 || gy < 0 || gx >= nx || gy >= ny) continue;
      const dx = x0 + (gx + 0.5) / R - cxm, dy = y0 + (gy + 0.5) / R - cym;
      const u = dx * ca - dy * sa, v = dx * sa + dy * ca;                  // un-rotate into the part's frame
      if(inShape(def, p, u, v, w, d)){ const n = gy * nx + gx; L.solid[n] = 1; L.part[n] = idx; } }
  });
  // start everything at the free stream
  for(let n = 0; n < N; n++){ for(let i = 0; i < 9; i++) L.f[i][n] = feq(i, 1, 0, U0); L.rho[n] = 1; L.ux[n] = 0; L.uy[n] = U0; }
  return L;
}
function feq(i, rho, ux, uy){ const eu = EX[i] * ux + EY[i] * uy, uu = ux * ux + uy * uy; return Wt[i] * rho * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * uu); }

/* one lattice step: collide, stream (bounce-back on solids, collecting the force), boundaries */
function stepLattice(L){
  const { nx, ny, N, solid, part, f, g, F } = L;
  for(const Fi of F){ Fi[0] = 0; Fi[1] = 0; }
  const inv = 1 / TAU;
  // collision
  for(let n = 0; n < N; n++){
    if(solid[n]) continue;
    let rho = 0, ux = 0, uy = 0;
    for(let i = 0; i < 9; i++){ const v = f[i][n]; rho += v; ux += v * EX[i]; uy += v * EY[i]; }
    if(!(rho > 0.2 && rho < 5)){ rho = 1; ux = 0; uy = U0; for(let i = 0; i < 9; i++) f[i][n] = feq(i, 1, 0, U0); }   // never NaN
    ux /= rho; uy /= rho;
    L.rho[n] = rho; L.ux[n] = ux; L.uy[n] = uy;
    const uu = ux * ux + uy * uy;
    for(let i = 0; i < 9; i++){ const eu = EX[i] * ux + EY[i] * uy; const fe = Wt[i] * rho * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * uu); f[i][n] += (fe - f[i][n]) * inv; }
  }
  // per-part inflow: how hard the moving air impinges on each of a part's EXPOSED faces
  // (momentum flux ρ·u_n², u_n = the air's speed INTO the face). Fast air on an exposed front =
  // big load; a part sitting in a slow wake = tiny. Read from the velocity field, which is honest.
  for(const lr of L.loadRaw) {} L.loadRaw.fill(0);
  // streaming (bounce-back on solids keeps the fluid honest; force = whole-body drag)
  for(let y = 0; y < ny; y++) for(let x = 0; x < nx; x++){
    const n = y * nx + x;
    if(solid[n]) continue;
    for(let i = 0; i < 9; i++){
      const tx = x + EX[i], ty = y + EY[i];
      if(tx < 0 || tx >= nx || ty < 0 || ty >= ny){ g[i][n] = f[i][n]; continue; }   // edges: handled below
      const t = ty * nx + tx;
      if(solid[t]){
        g[OPP[i]][n] = f[i][n]; const pi = part[t];
        if(pi >= 0){ F[pi][0] += 2 * f[i][n] * EX[i]; F[pi][1] += 2 * f[i][n] * EY[i];
          if(i < 5){ const un = L.ux[n] * EX[i] + L.uy[n] * EY[i]; if(un > 0) L.loadRaw[pi] += un * un * L.rho[n]; } }   // air at n heading INTO the solid t
      } else g[i][t] = f[i][n];
    }
  }
  // boundaries: inlet (top row) = free stream; outlet (bottom) + sides = copy the neighbour
  for(let x = 0; x < nx; x++){ const n = x; for(let i = 0; i < 9; i++) g[i][n] = feq(i, 1, 0, U0); const b = (ny - 1) * nx + x, b2 = (ny - 2) * nx + x; for(let i = 0; i < 9; i++) g[i][b] = g[i][b2]; }
  for(let y = 0; y < ny; y++){ const l = y * nx, r = y * nx + nx - 1; for(let i = 0; i < 9; i++){ g[i][l] = g[i][l + 1]; g[i][r] = g[i][r - 1]; } }
  // swap
  for(let i = 0; i < 9; i++){ const t = f[i]; f[i] = g[i]; g[i] = t; }
  L.steps++;
  // averages (vortex shedding flickers, so we smooth). load = impinging-air per part; drag =
  // the net downstream force on the WHOLE body (summing all parts is honest for a closed body).
  const k = L.steps < 80 ? 1 / L.steps : 1 / 80;
  L.load.forEach((_, idx) => { L.load[idx] += (L.loadRaw[idx] - L.load[idx]) * k; L.avg[idx] += (L.F[idx][1] - L.avg[idx]) * k; });
  let net = 0; for(const Fi of L.F) net += Fi[1]; L.drag += (net - L.drag) * k;
}

/* reference: the downstream force on ONE 1×1 solid cell, in a domain with the SAME margins a
   real part sits in — so blockage matches and a part's load comes out in real "frontal cells"
   (a 1-cell face into the wind ≈ 1, a 2-wide frame ≈ 2). Computed once. */
let F1 = null;
function reference(){
  if(F1) return F1;
  const nx = (1 + 2 * MARGIN) * R, ny = (1 + MARGIN + WAKE) * R, N = nx * ny;
  const L = { nx, ny, N, solid: new Uint8Array(N), part: new Int32Array(N).fill(-1), f: Array.from({ length: 9 }, () => new Float32Array(N)), g: Array.from({ length: 9 }, () => new Float32Array(N)), ux: new Float32Array(N), uy: new Float32Array(N), rho: new Float32Array(N), F: [[0, 0]], load: [0], loadRaw: [0], steps: 0, avg: [0], drag: 0 };
  const cx = MARGIN * R, cy = MARGIN * R;      // the cell sits MARGIN in from the front, centred across
  for(let y = cy; y < cy + R; y++) for(let x = cx; x < cx + R; x++){ const n = y * nx + x; L.solid[n] = 1; L.part[n] = 0; }
  for(let n = 0; n < N; n++) for(let i = 0; i < 9; i++) L.f[i][n] = feq(i, 1, 0, U0);
  for(let s = 0; s < 420; s++) stepLattice(L);
  F1 = { drag: Math.max(1e-4, L.drag), load: Math.max(1e-6, L.load[0]) }; return F1;
}

/* ---- the machine's air: lattices per layer, rebuilt when the build changes ---- */
export function airOf(m){
  const h = partsHash(m);
  if(!m.air2 || m.air2.hash !== h){
    const layers = Math.min(4, m.layers || 1);
    m.air2 = { hash: h, L: Array.from({ length: layers }, (_, l) => makeLattice(m, l)), ready: false };
  }
  return m.air2;
}
/* advance the sim a few steps (called every frame in the tunnel) */
export function stepAir(m, steps = 3){
  const A = airOf(m);
  for(const L of A.L) for(let s = 0; s < steps; s++) stepLattice(L);
  A.ready = A.L[0].steps > 120;
  if(A.ready) publish(m, A);
  return A;
}
/* run it to a steady state right now (on the track after a shear; ~20 ms) */
export function settleAir(m, target = 220){
  const A = airOf(m);
  while(A.L[0].steps < target) for(const L of A.L) stepLattice(L);
  A.ready = true; publish(m, A); return A;
}
/* write the results onto the machine: per-part air load (exposed-cell units) + the drag */
function publish(m, A){
  const f1 = reference();
  const loads = new Map(); let drag = 0;
  for(const L of A.L){ L.keys.forEach((k, idx) => {
    const def = PARTS[m.parts.get(k).type];
    const disc = (def.aero || def.fin) ? 0.45 : 1;    // a smooth shape SHEDS the flow instead of stagnating — it survives faster air
    loads.set(k, (loads.get(k) || 0) + L.load[idx] / f1.load * disc);
  }); drag += Math.max(0, L.drag) / f1.drag; }
  m.airLoad = loads; m.airHash = A.hash; m.frontalAir = Math.round(drag * 10) / 10;
  m.cd = TUNE.dragBase + (m.frontalAir + (m.wings || 0) * 2) * TUNE.dragArea;   // the real drag: what the air actually pushes back with
}
/* velocity of the air at a machine-local point (grid units), on a layer — for the particles.
   Returns {x, y} in "free-stream = 1" units, or null off the lattice. */
export function sampleAir(m, lx, ly, layer, out = {}){
  const A = m.air2; if(!A) return null;
  const L = A.L[Math.min(layer, A.L.length - 1)];
  const gx = (lx / CELL - L.x0) * R - 0.5, gy = (ly / CELL - L.y0) * R - 0.5;
  if(gx < 0 || gy < 0 || gx >= L.nx - 1 || gy >= L.ny - 1) return null;
  const x0 = gx | 0, y0 = gy | 0, tx = gx - x0, ty = gy - y0;
  const n00 = y0 * L.nx + x0, n10 = n00 + 1, n01 = n00 + L.nx, n11 = n01 + 1;
  const s = (a, b, c, d) => (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  out.x = s(L.ux[n00], L.ux[n10], L.ux[n01], L.ux[n11]) / U0; out.y = s(L.uy[n00], L.uy[n10], L.uy[n01], L.uy[n11]) / U0;
  out.solid = L.solid[n00] | L.solid[n10] | L.solid[n01] | L.solid[n11];
  out.rho = s(L.rho[n00], L.rho[n10], L.rho[n01], L.rho[n11]);
  return out;
}
export const AIR_R = R;
