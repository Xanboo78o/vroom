/* =============================================================================
   world.js — ONE hand-authored map. No generation, ever.
   A circuit with a pit lane, an open plaza, and a ramp playground.
   Ground height h(x,z) is analytic: flat + hand-placed ramps/plateaus.
   ============================================================================= */
import * as THREE from 'three';
import { shade, mat, vbox } from './parts.js';
import { PAL } from './palette.js';
import { initTiles, tileMat } from './tiles.js';
import { buildProps } from './props.js';
import { buildCritters } from './critters.js';
import { buildTracks, SURF, GRIP } from './tracks.js';

export const WORLD = {
  size: 1000,       // half-extent; the map is 2 km across (1 u ≈ 1.4 m)
  ramps: [],        // {x,z,w,d,h,dir}  dir: 0=+z climbs, 1=+x, 2=-z, 3=-x
  plateaus: [],     // {x,z,w,d,h} flat tops with hard edges (use ramps to get up)
  walls: [],        // AABBs {min:V3, max:V3, hex}
  pits: [],         // XZ rects {x,z,w,d} — refuel + repair zones
  checkpoints: [],  // ordered gates {x,z,r}; [0] is start/finish
  spawn: new THREE.Vector3(0, 0, 46),
  parking: [],      // starter machine spots
  anim: [],         // props with update(t, dt) — stepped from main's loop
  surfaces: [],     // (x,z) -> y|null extra height functions (banked ovals…)
  tracks: [],       // registered tracks {id,name,color,closed,cps,start,length,type}
  pads: [],         // teleport pads in Kris's Corner {x,z,r,track}
  surfGrid: null,   // surface id grid for grip (see SURF in tracks.js)
};

export function h(x, z){
  let y = 0;
  for(const r of WORLD.ramps){
    const lx = x - r.x, lz = z - r.z;
    if(Math.abs(lx) <= r.w / 2 && Math.abs(lz) <= r.d / 2){
      const t = r.dir === 0 ? (lz / r.d + .5) : r.dir === 2 ? (.5 - lz / r.d)
              : r.dir === 1 ? (lx / r.w + .5) : (.5 - lx / r.w);
      y = Math.max(y, t * r.h);
    }
  }
  for(const p of WORLD.plateaus){
    if(Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2) y = Math.max(y, p.h);
  }
  for(const f of WORLD.surfaces){ const v = f(x, z); if(v != null && v > y) y = v; }
  return y;
}
WORLD.h = h;

/* surface under a point → grip multiplier (asphalt 1, gravel, sand, grass) */
export function surfaceAt(x, z){
  const S = WORLD.surfGrid; if(!S) return SURF.grass;
  const i = Math.floor((x + WORLD.size) / S.cell), j = Math.floor((z + WORLD.size) / S.cell);
  if(i < 0 || j < 0 || i >= S.n || j >= S.n) return SURF.grass;
  return S.data[j * S.n + i];
}
export function gripAt(x, z){ return GRIP[surfaceAt(x, z)] ?? 1; }
WORLD.gripAt = gripAt; WORLD.surfaceAt = surfaceAt;

export function inPit(x, z){
  return WORLD.pits.some(p => Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2);
}

/* ---- the track centerline: rounded rectangle, hand-tuned ----------------- */
export const TRK = { cx: 0, cz: -110, hx: 105, hz: 62, r: 38, w: 13 };
export function trackLength(){ const { hx, hz, r } = TRK; return 2 * 2 * (hx - r) + 2 * 2 * (hz - r) + 4 * Math.PI * r / 2; }

export function trackPoint(t){       // t in [0,1) around the loop, starts mid top edge
  const { cx, cz, hx, hz, r } = TRK;
  const straightX = 2 * (hx - r), straightZ = 2 * (hz - r), arc = Math.PI * r / 2;
  const total = 2 * straightX + 2 * straightZ + 4 * arc;
  let d = t * total;
  const P = new THREE.Vector3();
  // top edge (z = cz + hz), heading +x, from cx - (hx-r)
  if(d < straightX){ P.set(cx - (hx - r) + d, 0, cz + hz); return P; } d -= straightX;
  if(d < arc){ const a = d / r; P.set(cx + (hx - r) + Math.sin(a) * r, 0, cz + hz - r + Math.cos(a) * r); return P; } d -= arc;
  if(d < straightZ){ P.set(cx + hx, 0, cz + hz - r - d); return P; } d -= straightZ;
  if(d < arc){ const a = d / r; P.set(cx + hx - r + Math.cos(a) * r, 0, cz - (hz - r) - Math.sin(a) * r); return P; } d -= arc;
  if(d < straightX){ P.set(cx + (hx - r) - d, 0, cz - hz); return P; } d -= straightX;
  if(d < arc){ const a = d / r; P.set(cx - (hx - r) - Math.sin(a) * r, 0, cz - hz + r - Math.cos(a) * r); return P; } d -= arc;
  if(d < straightZ){ P.set(cx - hx, 0, cz - hz + r + d); return P; } d -= straightZ;
  const a = d / r; P.set(cx - hx + r - Math.cos(a) * r, 0, cz + hz - r + Math.sin(a) * r); return P;
}

function ribbon(scene, width, hex, y, from = 0, to = 1, segs = 160, tile = null, tileLen = 4){
  const pos = [], idx = [], uv = [];
  const L = trackLength();
  for(let i = 0; i <= segs; i++){
    const t = from + (to - from) * (i / segs);
    const p = trackPoint(((t % 1) + 1) % 1);
    const p2 = trackPoint((((t + 0.002) % 1) + 1) % 1);
    const dir = p2.sub(p).normalize();
    const nx = -dir.z, nz = dir.x;
    pos.push(p.x + nx * width / 2, y, p.z + nz * width / 2,
             p.x - nx * width / 2, y, p.z - nz * width / 2);
    const v = t * L / tileLen;
    uv.push(0, v, 1, v);
    if(i < segs){ const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, tile ? tileMat(tile, hex) : mat(hex));
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

/* red/cream kerb strips along both asphalt edges over the four arcs (visual only) */
function kerbs(scene){
  const { hx, hz, r } = TRK;
  const L = trackLength();
  const sX = 2 * (hx - r), sZ = 2 * (hz - r), arc = Math.PI * r / 2;
  const spans = [[sX, sX + arc], [sX + arc + sZ, sX + 2 * arc + sZ], [2 * sX + 2 * arc + sZ, 2 * sX + 3 * arc + sZ], [2 * sX + 3 * arc + 2 * sZ, 2 * sX + 4 * arc + 2 * sZ]];
  const kw = 1.1;
  for(const [d0, d1] of spans){
    for(const side of [-1, 1]){
      const segs = 28;
      const pos = [], col = [], idx = [];
      for(let i = 0; i <= segs; i++){
        const t = (d0 + (d1 - d0) * i / segs) / L;
        const p = trackPoint(t % 1), p2 = trackPoint((t + 0.002) % 1);
        const dir = p2.sub(p).normalize(); const nx = -dir.z, nz = dir.x;
        const cx = p.x + nx * side * (TRK.w / 2 + kw / 2 - 0.15), cz = p.z + nz * side * (TRK.w / 2 + kw / 2 - 0.15);
        pos.push(cx + nx * kw / 2, 0.07, cz + nz * kw / 2, cx - nx * kw / 2, 0.07, cz - nz * kw / 2);
        const c = new THREE.Color(((i >> 1) & 1) ? PAL.kerbCream : PAL.kerbRed);
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        if(i < segs){ const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
      m.receiveShadow = true; scene.add(m);
    }
  }
}

export function wall(x, z, w, ht, d, hex = PAL.wall, hidden = false){
  WORLD.walls.push({ min: new THREE.Vector3(x - w / 2, 0, z - d / 2), max: new THREE.Vector3(x + w / 2, ht, z + d / 2), hex, hidden });
}

/* ---- build everything ---------------------------------------------------- */
export function buildWorld(scene, renderer){
  // sky + lights live in light.js now (initLight) — this is just the ground truth
  initTiles(renderer);
  { const cell = 4, n = Math.ceil(WORLD.size * 2 / cell); WORLD.surfGrid = { cell, n, data: new Uint8Array(n * n) }; }
  const paint = (pts, width, id) => { const S = WORLD.surfGrid, half = width / 2 + 1;
    for(const p of pts) for(let dx = -half; dx <= half; dx += 2) for(let dz = -half; dz <= half; dz += 2){
      if(dx * dx + dz * dz > half * half) continue;
      const i = Math.floor((p.x + dx + WORLD.size) / S.cell), j = Math.floor((p.z + dz + WORLD.size) / S.cell);
      if(i >= 0 && j >= 0 && i < S.n && j < S.n) S.data[j * S.n + i] = id; } };

  // ground — big flat grass with hand-placed darker patches (vector shading)
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size * 2, WORLD.size * 2), tileMat('grass', PAL.grass, (WORLD.size * 2) / 6));
  gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; scene.add(gnd);
  const patches = [[-60, 20, 34], [90, -30, 26], [-130, -180, 40], [40, 100, 30], [150, 60, 36], [-40, -70, 22], [120, -190, 30]];
  for(const [px, pz, pr] of patches){
    const p = new THREE.Mesh(new THREE.CircleGeometry(pr, 22), tileMat('grass', PAL.grassDark, pr / 3));
    p.rotation.x = -Math.PI / 2; p.position.set(px, 0.01, pz); p.receiveShadow = true; scene.add(p);
  }

  // circuit: shoulder ribbon (lighter), asphalt, kerbs, center dashes
  ribbon(scene, TRK.w + 3.6, PAL.shoulder, 0.02, 0, 1, 160, 'shoulder', 3);
  ribbon(scene, TRK.w, PAL.asphalt, 0.03, 0, 1, 160, 'asphalt', 4);
  kerbs(scene);
  { const tp = []; for(let i = 0; i < 240; i++) tp.push(trackPoint(i / 240)); paint(tp, TRK.w + 3.6, SURF.asphalt); }
  for(let i = 0; i < 40; i++) ribbon(scene, 0.5, PAL.dash, 0.04, i / 40, i / 40 + 0.006, 4);

  // start/finish: checkered line painted on the road (no banner — top-down view)
  const sf = trackPoint(0);
  const sq = TRK.w / 8;
  for(let i = 0; i < 8; i++) for(let j = 0; j < 2; j++){
    if((i + j) % 2 === 0) continue;
    const c = new THREE.Mesh(new THREE.PlaneGeometry(sq, sq), mat(PAL.checker));
    c.rotation.x = -Math.PI / 2; c.receiveShadow = true;
    c.position.set(sf.x - sq / 2 + j * sq, 0.05, sf.z - TRK.w / 2 + sq / 2 + i * sq);
    scene.add(c);
  }
  const postL = vbox(1, 2.4, 1, PAL.red), postR = vbox(1, 2.4, 1, PAL.red);
  postL.position.set(sf.x, 1.2, sf.z - TRK.w / 2 - 2); postR.position.set(sf.x, 1.2, sf.z + TRK.w / 2 + 2);
  scene.add(postL, postR);

  // checkpoints: start + one per side (order matters for lap validity)
  WORLD.checkpoints = [
    { x: sf.x, z: sf.z, r: 11 },
    { x: TRK.cx + TRK.hx, z: TRK.cz, r: 13 },
    { x: TRK.cx, z: TRK.cz - TRK.hz, r: 13 },
    { x: TRK.cx - TRK.hx, z: TRK.cz, r: 13 },
  ];
  WORLD.tracks.push({ id: 'paddock', name: 'PADDOCK GP', color: PAL.blueDark, closed: true, cps: WORLD.checkpoints,
    start: { x: sf.x - 6, z: sf.z, yaw: Math.PI / 2 }, length: trackLength(), type: 'gp' });
  { const px = -35, pz = 64;   // its teleport pad in Kris's Corner (the other tracks add theirs in tracks.js)
    const disc = new THREE.Mesh(new THREE.CircleGeometry(3, 24), mat(PAL.blueDark)); disc.rotation.x = -Math.PI / 2; disc.position.set(px, 0.04, pz); disc.receiveShadow = true; scene.add(disc);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3, 3.5, 24), mat(PAL.paper)); ring.rotation.x = -Math.PI / 2; ring.position.set(px, 0.045, pz); scene.add(ring);
    WORLD.pads.push({ x: px, z: pz, r: 3, track: 'paddock' }); }

  // pit lane: alongside the top straight, north of it
  const pitZ = TRK.cz + TRK.hz + 12;
  paint([{ x: -30, z: pitZ }, { x: -15, z: pitZ }, { x: 0, z: pitZ }, { x: 15, z: pitZ }, { x: 30, z: pitZ }], 18, SURF.asphalt);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(90, 9), tileMat('asphalt', PAL.pitLane, 1));
  lane.material.map.repeat.set(90 / 4, 9 / 4);
  lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0.03, pitZ); lane.receiveShadow = true; scene.add(lane);
  for(const px of [-28, 0, 28]){
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), mat(PAL.pad));
    pad.rotation.x = -Math.PI / 2; pad.position.set(px, 0.045, pitZ); pad.receiveShadow = true; scene.add(pad);
    WORLD.pits.push({ x: px, z: pitZ, w: 12, d: 8 });
  }
  wall(0, pitZ + 6.5, 96, 1.1, 1.2, PAL.pitWall);   // pit back wall

  // plaza spawn + parking spots
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(26, 30), tileMat('sand', PAL.plaza, 52 / 6));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.02, 40); plaza.receiveShadow = true; scene.add(plaza);
  { const pp = []; for(let a = 0; a < 6.3; a += 0.25) for(let r = 0; r <= 26; r += 6) pp.push({ x: Math.cos(a) * r, z: 40 + Math.sin(a) * r }); paint(pp, 8, SURF.sand); }
  WORLD.parking = [[-8, 30], [8, 30], [-14, 44], [14, 44], [0, 52], [-8, 58], [8, 58], [0, 22]]
    .map(([x, z]) => new THREE.Vector3(x, 1.2, z));

  // ramp playground — east side
  WORLD.ramps.push(
    { x: 120, z: 30, w: 16, d: 26, h: 5, dir: 0 },     // big launch ramp (climb +z)
    { x: 120, z: 74, w: 16, d: 26, h: 5, dir: 2 },     // landing ramp facing back (JUMP GAP between)
    { x: 82, z: 110, w: 12, d: 16, h: 2.4, dir: 0 },   // small kicker
    { x: 160, z: 110, w: 20, d: 20, h: 3.2, dir: 3 },  // side ramp
  );
  WORLD.plateaus.push({ x: 120, z: 52, w: 16, d: 18, h: 0 }); // the gap floor (flat, just visual grass)
  // render ramps as wedges
  for(const r of WORLD.ramps){
    const geo = new THREE.BufferGeometry();
    const x0 = r.x - r.w / 2, x1 = r.x + r.w / 2, z0 = r.z - r.d / 2, z1 = r.z + r.d / 2;
    // low edge / high edge by dir
    const hz = (za) => r.dir === 0 ? (za - z0) / r.d * r.h : r.dir === 2 ? (z1 - za) / r.d * r.h : 0;
    const hx = (xa) => r.dir === 1 ? (xa - x0) / r.w * r.h : r.dir === 3 ? (x1 - xa) / r.w * r.h : 0;
    const H = (xa, za) => Math.max(hz(za), hx(xa));
    const v = [x0, H(x0, z0), z0, x1, H(x1, z0), z0, x1, H(x1, z1), z1, x0, H(x0, z1), z1];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setIndex([0, 2, 1, 0, 3, 2]); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat(PAL.ramp));
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: shade(PAL.ramp) }));
    scene.add(edge);
    // side skirts so it doesn't float
    const skirt = new THREE.Mesh(geo.clone(), mat(PAL.rampSkirt));
    skirt.scale.set(1, 1, 1); skirt.position.y = -0.05; skirt.castShadow = true; scene.add(skirt);
    // up-slope chevron stripes so the ramp reads from above
    const along = r.dir === 0 || r.dir === 2;          // slope runs along z?
    const span = along ? r.d : r.w;
    const slope = Math.atan2(r.h, span);
    for(let i = 1; i <= 3; i++){
      const f = (r.dir === 0 || r.dir === 1) ? i / 4 : 1 - i / 4;
      const sx2 = along ? r.x : (x0 + f * r.w);
      const sz2 = along ? (z0 + f * r.d) : r.z;
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(along ? r.w * 0.6 : 0.7, along ? 0.7 : r.d * 0.6), mat(PAL.chevron));
      stripe.rotation.x = -Math.PI / 2; stripe.receiveShadow = true;
      stripe.rotation.y = 0;
      if(along) stripe.rotation.x += (r.dir === 0 ? 1 : -1) * slope * 0.9;
      else stripe.rotation.z = (r.dir === 1 ? -1 : 1) * slope * 0.9;
      stripe.position.set(sx2, H(sx2, sz2) + 0.06, sz2);
      scene.add(stripe);
    }
  }

  // cones down the plaza edge (props, hand-placed)
  for(let i = 0; i < 7; i++){
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 10), mat(PAL.cone));
    cone.castShadow = cone.receiveShadow = true;
    cone.position.set(-30 + i * 3.2, 0.6, 80); scene.add(cone);
  }

  // perimeter walls
  const S = WORLD.size;
  wall(0, -S, 2 * S, 2, 2); wall(0, S, 2 * S, 2, 2);
  wall(-S, 0, 2, 2, 2 * S); wall(S, 0, 2, 2, 2 * S);
  // a couple of obstacles on the infield
  wall(0, -110, 10, 1.6, 10, PAL.block);

  // the other tracks (L8ter, Switchback, the Bowl, Otterbend, Lost Woods) + teleport pads
  buildTracks(scene, { WORLD, wall, h });
  // Kris's Corner: props (boards, statue, booth, grandstand) + the cast
  buildProps(scene, { trackPoint, TRK, wall, WORLD });
  buildCritters(scene, { wall, WORLD });

  // draw walls
  for(const wl of WORLD.walls){
    if(wl.hidden) continue;
    const w = wl.max.x - wl.min.x, ht = wl.max.y, d = wl.max.z - wl.min.z;
    const b = vbox(w, ht, d, wl.hex || PAL.wall);
    b.position.set((wl.min.x + wl.max.x) / 2, ht / 2, (wl.min.z + wl.max.z) / 2);
    scene.add(b);
  }

  return WORLD;
}
