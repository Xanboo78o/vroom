/* =============================================================================
   world.js — ONE hand-authored map. No generation, ever.
   A circuit with a pit lane, an open plaza, and a ramp playground.
   Ground height h(x,z) is analytic: flat + hand-placed ramps/plateaus.
   ============================================================================= */
import * as THREE from 'three';
import { shade, mat, vbox } from './parts.js';

export const WORLD = {
  size: 320,
  ramps: [],        // {x,z,w,d,h,dir}  dir: 0=+z climbs, 1=+x, 2=-z, 3=-x
  plateaus: [],     // {x,z,w,d,h} flat tops with hard edges (use ramps to get up)
  walls: [],        // AABBs {min:V3, max:V3, hex}
  pits: [],         // XZ rects {x,z,w,d} — refuel + repair zones
  checkpoints: [],  // ordered gates {x,z,r}; [0] is start/finish
  spawn: new THREE.Vector3(6, 0, 34),
  parking: [],      // starter machine spots
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
  return y;
}
WORLD.h = h;

export function inPit(x, z){
  return WORLD.pits.some(p => Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2);
}

/* ---- the track centerline: rounded rectangle, hand-tuned ----------------- */
const TRK = { cx: 0, cz: -110, hx: 105, hz: 62, r: 38, w: 13 };

function trackPoint(t){       // t in [0,1) around the loop, starts mid top edge
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

function ribbon(scene, width, hex, y, from = 0, to = 1, segs = 160){
  const pos = [], idx = [];
  for(let i = 0; i <= segs; i++){
    const t = from + (to - from) * (i / segs);
    const p = trackPoint(((t % 1) + 1) % 1);
    const p2 = trackPoint((((t + 0.002) % 1) + 1) % 1);
    const dir = p2.sub(p).normalize();
    const nx = -dir.z, nz = dir.x;
    pos.push(p.x + nx * width / 2, y, p.z + nz * width / 2,
             p.x - nx * width / 2, y, p.z - nz * width / 2);
    if(i < segs){ const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, mat(hex));
  scene.add(mesh);
  return mesh;
}

function wall(x, z, w, ht, d, hex = 0xd9a0a0){
  WORLD.walls.push({ min: new THREE.Vector3(x - w / 2, 0, z - d / 2), max: new THREE.Vector3(x + w / 2, ht, z + d / 2), hex });
}

/* ---- build everything ---------------------------------------------------- */
export function buildWorld(scene){
  // sky + light — bright, flat, saturated
  scene.background = new THREE.Color(0xbfe3f2);
  scene.fog = new THREE.Fog(0xbfe3f2, 260, 520);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa8c98a, 1.05));
  const sun = new THREE.DirectionalLight(0xfff4d6, 0.55);
  sun.position.set(80, 140, 60); scene.add(sun);

  // ground — big flat grass with hand-placed darker patches (vector shading)
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size * 2, WORLD.size * 2), mat(0x9ec96f));
  gnd.rotation.x = -Math.PI / 2; scene.add(gnd);
  const patches = [[-60, 20, 34], [90, -30, 26], [-130, -180, 40], [40, 100, 30], [150, 60, 36], [-40, -70, 22], [120, -190, 30]];
  for(const [px, pz, pr] of patches){
    const p = new THREE.Mesh(new THREE.CircleGeometry(pr, 22), mat(0x92bd63));
    p.rotation.x = -Math.PI / 2; p.position.set(px, 0.01, pz); scene.add(p);
  }

  // circuit: shoulder ribbon (lighter), asphalt, center dashes
  ribbon(scene, TRK.w + 3.6, 0x7f8894, 0.02);
  ribbon(scene, TRK.w, 0x555e69, 0.03);
  for(let i = 0; i < 40; i++) ribbon(scene, 0.5, 0xe8e4d8, 0.04, i / 40, i / 40 + 0.006);

  // start/finish line + gantry at t=0 (mid top edge)
  const sf = trackPoint(0);
  const line = vbox(1.6, 0.06, TRK.w, 0xf2efe6); line.position.set(sf.x, 0.05, sf.z); scene.add(line);
  const postL = vbox(1, 7, 1, 0xe8574f), postR = vbox(1, 7, 1, 0xe8574f);
  postL.position.set(sf.x, 3.5, sf.z - TRK.w / 2 - 2); postR.position.set(sf.x, 3.5, sf.z + TRK.w / 2 + 2);
  const banner = vbox(2.4, 1.6, TRK.w + 5, 0xe8574f); banner.position.set(sf.x, 6.6, sf.z);
  scene.add(postL, postR, banner);

  // checkpoints: start + one per side (order matters for lap validity)
  WORLD.checkpoints = [
    { x: sf.x, z: sf.z, r: 11 },
    { x: TRK.cx + TRK.hx, z: TRK.cz, r: 13 },
    { x: TRK.cx, z: TRK.cz - TRK.hz, r: 13 },
    { x: TRK.cx - TRK.hx, z: TRK.cz, r: 13 },
  ];

  // pit lane: alongside the top straight, north of it
  const pitZ = TRK.cz + TRK.hz + 12;
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(90, 9), mat(0x6b7480));
  lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0.03, pitZ); scene.add(lane);
  for(const px of [-28, 0, 28]){
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), mat(0xe0c23e));
    pad.rotation.x = -Math.PI / 2; pad.position.set(px, 0.045, pitZ); scene.add(pad);
    const padEdge = new THREE.Mesh(new THREE.RingGeometry(0, 1, 4), mat(0xb89f2c)); // corner dots read as vector
    padEdge.visible = false; scene.add(padEdge);
    WORLD.pits.push({ x: px, z: pitZ, w: 12, d: 8 });
  }
  wall(0, pitZ + 6.5, 96, 1.1, 1.2, 0xd0d6dd);   // pit back wall

  // plaza spawn + parking spots
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(26, 30), mat(0xc9bfa8));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.02, 40); scene.add(plaza);
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
    const mesh = new THREE.Mesh(geo, mat(0xd8935a));
    scene.add(mesh);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: shade(0xd8935a) }));
    scene.add(edge);
    // side skirts so it doesn't float
    const skirt = new THREE.Mesh(geo.clone(), mat(0xc07c44));
    skirt.scale.set(1, 1, 1); skirt.position.y = -0.05; scene.add(skirt);
  }

  // cones down the plaza edge (props, hand-placed)
  for(let i = 0; i < 7; i++){
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 10), mat(0xe8804f));
    cone.position.set(-30 + i * 3.2, 0.6, 70); scene.add(cone);
  }

  // perimeter walls
  const S = WORLD.size;
  wall(0, -S, 2 * S, 2, 2); wall(0, S, 2 * S, 2, 2);
  wall(-S, 0, 2, 2, 2 * S); wall(S, 0, 2, 2, 2 * S);
  // a couple of obstacles on the infield
  wall(0, -110, 10, 1.6, 10, 0xc9a44a);

  // draw walls
  for(const wl of WORLD.walls){
    const w = wl.max.x - wl.min.x, ht = wl.max.y, d = wl.max.z - wl.min.z;
    const b = vbox(w, ht, d, wl.hex || 0xd9a0a0);
    b.position.set((wl.min.x + wl.max.x) / 2, ht / 2, (wl.min.z + wl.max.z) / 2);
    scene.add(b);
  }

  return WORLD;
}
