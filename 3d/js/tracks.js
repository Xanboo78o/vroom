/* =============================================================================
   tracks.js — the launch tracks, all hand-authored (no generation):
     L8TER          Adam's custom GP (his SVG), pit lane + optional extra section
     SWITCHBACK GP  the tight technical one (hairpins, chicane)        [west]
     THE BOWL       steeply banked oval                                [south]
     OTTERBEND      flowing wide MotoGP layout                         [north]
     LOST WOODS     gravel rally stage, point-to-point, split times    [south-east]
   + the existing rounded-rect circuit (PADDOCK GP) registered from world.js.
   Every track: centreline (Catmull-Rom through hand points, or an analytic rounded
   rect for the oval) → shoulder + surface ribbons, kerbs on the bends, start line,
   checkpoints, a name board, a TELEPORT PAD in Kris's Corner, and a surface id
   painted into the grip grid (asphalt / gravel). Banking feeds WORLD.h().
   ============================================================================= */
import * as THREE from 'three';
import { vbox, mat } from './parts.js';
import { PAL } from './palette.js';
import { tileMat } from './tiles.js';
import { textTex, easel } from './props.js';
import { L8TER } from './adamtrack.js';

export const SURF = { grass: 0, asphalt: 1, gravel: 2, sand: 3 };
export const GRIP = [0.78, 1.0, 0.70, 0.62];

export const TRACKS = [
  { id: 'l8ter', name: 'L8TER', color: PAL.red, type: 'gp', closed: true, width: 13, surface: 'asphalt',
    pts: L8TER.loop, startIdx: L8TER.startIdx, pit: L8TER.pit, extra: L8TER.extra },
  { id: 'switchback', name: 'SWITCHBACK GP', color: PAL.blue, type: 'gp', closed: true, width: 12, surface: 'asphalt',
    pts: [[-560, -170], [-430, -170], [-380, -150], [-350, -110], [-340, -80], [-360, -58], [-400, -70], [-440, -90], [-470, -62],
          [-455, -30], [-480, -10], [-462, 30], [-400, 42], [-350, 22], [-330, 60], [-345, 96], [-400, 102], [-480, 92], [-540, 62],
          [-572, 12], [-582, -60], [-586, -120]], startIdx: 0 },
  { id: 'bowl', name: 'THE BOWL', color: PAL.pad, type: 'oval', closed: true, surface: 'asphalt',
    oval: { cx: 0, cz: 330, hx: 150, hz: 70, r: 60, w: 18, bank: 5 } },
  { id: 'otterbend', name: 'OTTERBEND', color: PAL.batt, type: 'moto', closed: true, width: 16, surface: 'asphalt',
    pts: [[-220, -380], [-160, -330], [-80, -312], [0, -330], [80, -322], [150, -340], [210, -400], [220, -470], [180, -530],
          [100, -560], [20, -542], [-40, -500], [-100, -520], [-170, -560], [-232, -522], [-242, -450]], startIdx: 2 },
  { id: 'lostwoods', name: 'LOST WOODS', color: PAL.armadillo, type: 'rally', closed: false, width: 9, surface: 'gravel',
    pts: [[250, 200], [300, 230], [360, 222], [400, 262], [430, 320], [480, 342], [540, 312], [590, 332], [620, 392], [600, 450],
          [540, 472], [480, 442], [440, 482], [460, 542], [520, 582], [600, 602], [680, 572], [720, 502]], startIdx: 0 },
];

let API = null;           // { WORLD, wall, h }
const _v = new THREE.Vector3();

/* ---- geometry helpers ----------------------------------------------------------- */
function sampleCurve(pts, closed){
  const vs = pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(vs, closed, 'centripetal', 0.5);
  const L = curve.getLength();
  const n = Math.max(40, Math.ceil(L / 1.4));
  const sp = curve.getSpacedPoints(n);
  if(closed) sp.pop();                       // last == first
  return { pts: sp, L, curve };
}
// tangent + left normal per sample
function frames(pts, closed){
  const out = [];
  for(let i = 0; i < pts.length; i++){
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    const p = pts[i];
    const pa = closed || i > 0 ? a : p, pb = closed || i < pts.length - 1 ? b : p;
    const tx = pb.x - pa.x, tz = pb.z - pa.z, L = Math.hypot(tx, tz) || 1;
    out.push({ tx: tx / L, tz: tz / L, nx: -tz / L, nz: tx / L });
  }
  return out;
}
// curvature magnitude per sample (radians per unit length)
function curvature(pts, fr, closed){
  const out = new Float32Array(pts.length);
  for(let i = 0; i < pts.length; i++){
    if(!closed && (i === 0 || i === pts.length - 1)) continue;
    const a = fr[(i - 1 + pts.length) % pts.length], b = fr[(i + 1) % pts.length];
    const da = Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz);
    const L = pts[(i + 1) % pts.length].distanceTo(pts[(i - 1 + pts.length) % pts.length]) || 1;
    out[i] = da / L;
  }
  return out;
}
/* ribbon through sampled points; y(i, side) optional per-vertex height; returns mesh */
function ribbon(scene, pts, fr, closed, width, material, yFn, tileLen = 4, offset = 0){
  const pos = [], uv = [], idx = [], n = pts.length;
  let dist = 0;
  for(let i = 0; i < n; i++){
    const p = pts[i], f = fr[i];
    if(i) dist += p.distanceTo(pts[i - 1]);
    const c = offset;                                            // lateral offset of the ribbon centre
    const yl = yFn ? yFn(i, c + width / 2) : 0, yr = yFn ? yFn(i, c - width / 2) : 0;
    pos.push(p.x + f.nx * (c + width / 2), yl, p.z + f.nz * (c + width / 2),
             p.x + f.nx * (c - width / 2), yr, p.z + f.nz * (c - width / 2));
    const v = dist / tileLen; uv.push(0, v, 1, v);
  }
  const segs = closed ? n : n - 1;
  for(let i = 0; i < segs; i++){ const a = i * 2, b = ((i + 1) % n) * 2; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, material); mesh.receiveShadow = true; scene.add(mesh);
  return mesh;
}
/* red/cream kerb strips where the track bends */
function kerbs(scene, pts, fr, curv, closed, width, yFn){
  const n = pts.length, thr = 0.011, kw = 1.1;
  for(const side of [-1, 1]){
    let i = 0;
    while(i < n){
      if(Math.abs(curv[i]) < thr){ i++; continue; }
      let j = i; while(j < n && Math.abs(curv[j]) >= thr) j++;
      if(j - i >= 4){
        const pos = [], col = [], idx = [];
        let k = 0;
        for(let s = Math.max(0, i - 2); s <= Math.min(n - 1, j + 1); s++, k++){
          const p = pts[s], f = fr[s];
          const c = side * (width / 2 + kw / 2 - 0.15);
          const y0 = (yFn ? yFn(s, c + kw / 2) : 0) + 0.05, y1 = (yFn ? yFn(s, c - kw / 2) : 0) + 0.05;
          pos.push(p.x + f.nx * (c + kw / 2), y0, p.z + f.nz * (c + kw / 2), p.x + f.nx * (c - kw / 2), y1, p.z + f.nz * (c - kw / 2));
          const cc = new THREE.Color(((k >> 1) & 1) ? PAL.kerbCream : PAL.kerbRed); col.push(cc.r, cc.g, cc.b, cc.r, cc.g, cc.b);
          if(k){ const a = (k - 1) * 2, b = k * 2; idx.push(a, b, a + 1, a + 1, b, b + 1); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setIndex(idx); g.computeVertexNormals();
        const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.receiveShadow = true; scene.add(m);
      }
      i = j;
    }
  }
}
function startLine(scene, p, f, width, y = 0){
  const sq = width / 8;
  for(let i = 0; i < 8; i++) for(let j = 0; j < 2; j++){
    if((i + j) % 2 === 0) continue;
    const c = new THREE.Mesh(new THREE.PlaneGeometry(sq, sq), mat(PAL.checker));
    c.rotation.x = -Math.PI / 2; c.rotation.z = -Math.atan2(f.tx, f.tz);
    const lat = -width / 2 + sq / 2 + i * sq, lon = -sq / 2 + j * sq;
    c.position.set(p.x + f.nx * lat + f.tx * lon, y + 0.05, p.z + f.nz * lat + f.tz * lon); c.receiveShadow = true; scene.add(c);
  }
  for(const s of [-1, 1]){ const post = vbox(1, 2.4, 1, PAL.red); post.position.set(p.x + f.nx * s * (width / 2 + 2), y + 1.2, p.z + f.nz * s * (width / 2 + 2)); scene.add(post); }
}
/* paint a ribbon's footprint into the surface grid */
function paintSurface(pts, width, id){
  const W = API.WORLD, S = W.surfGrid; if(!S) return;
  const half = width / 2 + 1;
  for(const p of pts){
    for(let dx = -half; dx <= half; dx += S.cell / 2) for(let dz = -half; dz <= half; dz += S.cell / 2){
      if(dx * dx + dz * dz > half * half) continue;
      const i = Math.floor((p.x + dx + W.size) / S.cell), j = Math.floor((p.z + dz + W.size) / S.cell);
      if(i < 0 || j < 0 || i >= S.n || j >= S.n) continue;
      S.data[j * S.n + i] = id;
    }
  }
}

/* ---- the oval: analytic rounded rect with banking ----------------------------------- */
function ovalPoint(O, t){
  const { cx, cz, hx, hz, r } = O;
  const sX = 2 * (hx - r), sZ = 2 * (hz - r), arc = Math.PI * r / 2, total = 2 * sX + 2 * sZ + 4 * arc;
  let d = ((t % 1) + 1) % 1 * total; const P = new THREE.Vector3();
  if(d < sX){ P.set(cx - (hx - r) + d, 0, cz + hz); return P; } d -= sX;
  if(d < arc){ const a = d / r; P.set(cx + (hx - r) + Math.sin(a) * r, 0, cz + hz - r + Math.cos(a) * r); return P; } d -= arc;
  if(d < sZ){ P.set(cx + hx, 0, cz + hz - r - d); return P; } d -= sZ;
  if(d < arc){ const a = d / r; P.set(cx + hx - r + Math.cos(a) * r, 0, cz - (hz - r) - Math.sin(a) * r); return P; } d -= arc;
  if(d < sX){ P.set(cx + (hx - r) - d, 0, cz - hz); return P; } d -= sX;
  if(d < arc){ const a = d / r; P.set(cx - (hx - r) - Math.sin(a) * r, 0, cz - hz + r - Math.cos(a) * r); return P; } d -= arc;
  if(d < sZ){ P.set(cx - hx, 0, cz - hz + r + d); return P; } d -= sZ;
  const a = d / r; P.set(cx - hx + r - Math.cos(a) * r, 0, cz + hz - r + Math.sin(a) * r); return P;
}
// banking height at (x,z) — null off the track. Outside edge rises `bank`, blended in over the arcs.
function ovalHeight(O, x, z){
  const lx = x - O.cx, lz = z - O.cz;
  const qx = Math.max(-(O.hx - O.r), Math.min(O.hx - O.r, lx)), qz = Math.max(-(O.hz - O.r), Math.min(O.hz - O.r, lz));
  const dx = lx - qx, dz = lz - qz, d = Math.hypot(dx, dz);     // distance to the inner rect
  const s = d - O.r;                                             // signed lateral from the centreline (+ = outside)
  const hw = O.w / 2 + 1.8;                                      // shoulders included
  if(s < -hw || s > hw) return null;
  const onArc = dx !== 0 && dz !== 0;
  let k;
  if(onArc) k = 1;
  else {  // straight: blend in over the last 30 u before the arc
    const along = dx === 0 ? (O.hx - O.r) - Math.abs(lx) : (O.hz - O.r) - Math.abs(lz);   // distance to the arc start
    k = Math.max(0, 1 - along / 30);
  }
  const u = Math.max(0, Math.min(1, s / O.w + 0.5));
  return O.bank * u * u * k + 0.03;
}

/* ---- build -------------------------------------------------------------------------- */
export function buildTracks(scene, api){
  API = api;
  const W = api.WORLD;
  W.tracks = W.tracks || []; W.pads = W.pads || []; W.surfaces = W.surfaces || [];
  let padI = 0;
  for(const T of TRACKS){
    let pts, fr, closed = T.closed, yFn = null, L;
    if(T.oval){
      const O = T.oval; closed = true;
      const n = 360; pts = []; for(let i = 0; i < n; i++) pts.push(ovalPoint(O, i / n));
      L = 2 * 2 * (O.hx - O.r) + 2 * 2 * (O.hz - O.r) + 2 * Math.PI * O.r;
      fr = frames(pts, true);
      yFn = (i, lat) => { const p = pts[i], f = fr[i]; return ovalHeight(O, p.x + f.nx * lat, p.z + f.nz * lat) ?? 0; };
      W.surfaces.push((x, z) => ovalHeight(O, x, z));
      T.width = O.w;
    } else {
      const s = sampleCurve(T.pts, closed); pts = s.pts; L = s.L; fr = frames(pts, closed);
    }
    const curv = curvature(pts, fr, closed);
    const surfTile = T.surface === 'gravel' ? 'gravel' : 'asphalt';
    const surfHex = T.surface === 'gravel' ? 0x9a8a6a : PAL.asphalt;
    ribbon(scene, pts, fr, closed, T.width + 3.6, tileMat(T.surface === 'gravel' ? 'gravel' : 'shoulder', T.surface === 'gravel' ? 0xb3a37c : PAL.shoulder), yFn ? (i, l) => yFn(i, l) - 0.015 : null, 3);
    ribbon(scene, pts, fr, closed, T.width, tileMat(surfTile, surfHex), yFn, 4);
    if(T.surface !== 'gravel') kerbs(scene, pts, fr, curv, closed, T.width, yFn);
    if(T.surface !== 'gravel'){   // centre dashes
      const n = pts.length; for(let i = 0; i < n; i += 10){ if(!closed && i + 3 >= n) break; const seg = []; for(let k = 0; k < 4 && (closed || i + k < n); k++) seg.push(pts[(i + k) % n]); if(seg.length > 1) ribbon(scene, seg, frames(seg, false), false, 0.5, mat(PAL.dash), yFn ? (ii, l) => yFn((i + ii) % n, l) + 0.012 : null, 4); }
    }
    paintSurface(pts, T.width + 3.6, SURF[T.surface] ?? SURF.asphalt);
    // start / finish
    let si = 0;
    if(T.startIdx != null && T.pts){ const sp = T.pts[T.startIdx]; let bd = 1e9; pts.forEach((p, i) => { const d = Math.hypot(p.x - sp[0], p.z - sp[1]); if(d < bd){ bd = d; si = i; } }); }
    if(T.oval) si = 0;
    const sP = pts[si], sF = fr[si], sY = yFn ? yFn(si, 0) : 0;
    startLine(scene, sP, sF, T.width, sY);
    const yaw = Math.atan2(sF.tx, sF.tz);
    const start = { x: sP.x - sF.tx * 6, z: sP.z - sF.tz * 6, yaw };
    // checkpoints
    const n = pts.length, cps = [];
    const rad = T.width / 2 + 5;
    if(closed){ for(let k = 0; k < 6; k++){ const p = pts[(si + Math.round(k * n / 6)) % n]; cps.push({ x: p.x, z: p.z, r: rad }); } }
    else { for(const f of [0, 0.25, 0.5, 0.75, 1]){ const p = pts[Math.min(n - 1, Math.round(f * (n - 1)))]; cps.push({ x: p.x, z: p.z, r: rad }); } }
    if(!closed){ const e = pts[n - 1], ef = fr[n - 1]; for(const s2 of [-1, 1]){ const post = vbox(1, 2.4, 1, PAL.checker); post.position.set(e.x + ef.nx * s2 * (T.width / 2 + 2), 1.2, e.z + ef.nz * s2 * (T.width / 2 + 2)); scene.add(post); } }
    // name board beside the start, on the right
    const bx = sP.x - sF.nx * (T.width / 2 + 8), bz = sP.z - sF.nz * (T.width / 2 + 8);
    const board = easel(4, 1.6, textTex({ w: 512, h: 200, bg: T.color, fg: PAL.paper, lines: [T.name], size: 90, font: "Impact, 'Arial Black', sans-serif" }), PAL.ink);
    board.position.set(bx, W.h(bx, bz), bz); scene.add(board);
    api.wall(bx, bz, 4.4, 1.2, 1.2, PAL.ink, true);
    // pit lane + extra section (L8ter)
    if(T.pit){ const s = sampleCurve(T.pit, false); const f2 = frames(s.pts, false);
      ribbon(scene, s.pts, f2, false, 7, tileMat('asphalt', PAL.pitLane), null, 4);
      const m = s.pts[Math.floor(s.pts.length / 2)]; const pad = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), mat(PAL.pad)); pad.rotation.x = -Math.PI / 2; pad.rotation.z = -Math.atan2(f2[Math.floor(s.pts.length / 2)].tx, f2[Math.floor(s.pts.length / 2)].tz); pad.position.set(m.x, 0.045, m.z); pad.receiveShadow = true; scene.add(pad);
      W.pits.push({ x: m.x, z: m.z, w: 12, d: 12 });
      paintSurface(s.pts, 7, SURF.asphalt); }
    if(T.extra){ const pe = T.extra.map(([x, z]) => [x, z]);
      // snap both ends onto the loop
      for(const e of [0, pe.length - 1]){ let bd = 1e9, bp = null; for(const p of pts){ const d = Math.hypot(p.x - pe[e][0], p.z - pe[e][1]); if(d < bd){ bd = d; bp = p; } } pe[e] = [bp.x, bp.z]; }
      const s = sampleCurve(pe, false); const f2 = frames(s.pts, false);
      ribbon(scene, s.pts, f2, false, T.width + 3.6, tileMat('shoulder', PAL.shoulder), null, 3, 0);
      ribbon(scene, s.pts, f2, false, T.width, tileMat('asphalt', PAL.asphalt), () => 0.002, 4);
      paintSurface(s.pts, T.width + 3.6, SURF.asphalt); }
    // register
    W.tracks.push({ id: T.id, name: T.name, color: T.color, closed, cps, start, length: L, type: T.type });
    // teleport pad in Kris's Corner
    const px = -25 + padI * 10, pz = 64; padI++;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(3, 24), mat(T.color)); disc.rotation.x = -Math.PI / 2; disc.position.set(px, 0.04, pz); disc.receiveShadow = true; scene.add(disc);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3, 3.5, 24), mat(PAL.paper)); ring.rotation.x = -Math.PI / 2; ring.position.set(px, 0.045, pz); scene.add(ring);
    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.6), new THREE.MeshLambertMaterial({ map: textTex({ w: 512, h: 120, bg: PAL.cream, fg: PAL.text, lines: [T.name], size: 64 }), flatShading: true }));
    lbl.rotation.x = -Math.PI / 2; lbl.position.set(px, 0.06, pz + 4.6); lbl.receiveShadow = true; scene.add(lbl);
    W.pads.push({ x: px, z: pz, r: 3, track: T.id });
  }
}
