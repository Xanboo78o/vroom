/* =============================================================================
   parts.js — the Lego catalog.
   Grid: x/z cells are CELLXZ wide (fine grid), y layers are CELLY tall.
   Every part covers a FOOTPRINT of cells (fp: [w,d]) — frames come in
   1x1 / 2x2 / 3x3, everything else is 2x2. That's how you shape an F1 nose,
   a rally hatch, or a boxy Ford.
   Flat fill + edges in a darker shade of the same fill (the style).
   ============================================================================= */
import * as THREE from 'three';
import { artTex } from './art.js';

export const CELLXZ = 0.3;               // fine grid step in x/z
export const CELLY = 0.6;                // one build layer tall
const C = 0.6;                           // geometry unit (a 2x2 part is C wide)

// darker shade of a hex color (the no-black-outline rule)
export function shade(hex, f = 0.78){
  const r = ((hex >> 16) & 255) * f, g = ((hex >> 8) & 255) * f, b = (hex & 255) * f;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

const MATS = new Map();
export function mat(hex){
  if(!MATS.has(hex)) MATS.set(hex, new THREE.MeshLambertMaterial({ color: hex }));
  return MATS.get(hex);
}
const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });
const LINE_MATS = new Map();
function lineMat(hex){
  if(!LINE_MATS.has(hex)) LINE_MATS.set(hex, new THREE.LineBasicMaterial({ color: hex }));
  return LINE_MATS.get(hex);
}

// box with vector edges
export function vbox(w, h, d, hex, edgeF = 0.72){
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(w, h, d);
  g.add(new THREE.Mesh(geo, mat(hex)));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(shade(hex, edgeF))));
  return g;
}
export function vcyl(r, len, hex, seg = 12, edgeF = 0.72){
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(r, r, len, seg);
  g.add(new THREE.Mesh(geo, mat(hex)));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), lineMat(shade(hex, edgeF))));
  return g;
}

/* Part defs.
   fp      — footprint in grid cells [w, d]; every part is 1 layer tall
   mass    — light influence only (shape+mechanisms, not weight yet)
   facing  — part cares about its yaw rotation (needs clear air)
   shear   — impulse needed to knock it off (wheels pop easiest)                */
/* Categories — the inner rings of the catalog. Adding one here + `cat:` on parts is
   all it takes; the ring menu lays itself out. Order = clockwise from the top. */
export const CATS = [
  { id: 'frame',    label: 'FRAMES',   color: 0xaab4c0 },
  { id: 'wheel',    label: 'WHEELS',   color: 0x4a4f57 },
  { id: 'seat',     label: 'SEATS',    color: 0xe8574f },
  { id: 'engine',   label: 'ENGINE',   color: 0xe69a3c },
  { id: 'electric', label: 'ELECTRIC', color: 0x46c2a5 },
  { id: 'aero',     label: 'AERO',     color: 0x5aa7e0 },
];

export const PARTS = {
  frame1: {
    label: '1×1', key: '1', cat: 'frame', fp: [1, 1], mass: 0.3, color: 0xaab4c0, shear: 26,
    build(){ return vbox(C * .5, C, C * .5, 0xaab4c0); }
  },
  frame: {
    label: '2×2', key: '2', cat: 'frame', fp: [2, 2], mass: 1.0, color: 0xaab4c0, shear: 30,
    build(){ return vbox(C, C, C, 0xaab4c0); }
  },
  frame3: {
    label: '3×3', key: '3', cat: 'frame', fp: [3, 3], mass: 2.2, color: 0xaab4c0, shear: 36,
    build(){ return vbox(C * 1.5, C, C * 1.5, 0xaab4c0); }
  },
  seat: {
    label: 'SEAT', key: '4', cat: 'seat', fp: [2, 2], mass: 0.8, color: 0xe8574f, shear: 34,
    build(){
      const g = new THREE.Group();
      const base = vbox(C * .9, C * .35, C * .9, 0xe8574f); base.position.y = -C * .28; g.add(base);
      const back = vbox(C * .9, C * .75, C * .28, 0xe8574f); back.position.set(0, C * .12, -C * .3); g.add(back);
      return g;
    }
  },
  wheel: {
    label: 'WHEEL', key: '5', cat: 'wheel', fp: [2, 2], mass: 0.9, color: 0x4a4f57, shear: 16,   // pops off easiest
    build(){
      const g = new THREE.Group();
      const tire = vcyl(C * .48, C * .45, 0x4a4f57, 14); tire.rotation.z = Math.PI / 2; g.add(tire);
      const hub = vcyl(C * .2, C * .48, 0xd8b13c, 8); hub.rotation.z = Math.PI / 2; g.add(hub);
      return g;
    }
  },
  engine: {
    label: 'ENGINE', key: '6', cat: 'engine', fp: [2, 2], mass: 1.6, color: 0xe69a3c, shear: 40,
    build(){
      const g = new THREE.Group();
      g.add(vbox(C * .92, C * .7, C * .92, 0xe69a3c));
      for(let i = 0; i < 3; i++){
        const p = vcyl(C * .09, C * .3, 0xc57d22, 8);
        p.position.set((i - 1) * C * .26, C * .45, 0); g.add(p);
      }
      return g;
    }
  },
  tank: {
    label: 'FUEL', key: '7', cat: 'engine', fp: [2, 2], mass: 1.2, color: 0xb9c94e, shear: 34,
    build(){
      const g = new THREE.Group();
      const t = vcyl(C * .42, C * .86, 0xb9c94e, 12); t.rotation.x = Math.PI / 2; g.add(t);
      const cap = vcyl(C * .12, C * .16, 0x94a33a, 8); cap.position.y = C * .4; g.add(cap);
      return g;
    }
  },
  intake: {
    label: 'INTAKE', key: '8', cat: 'engine', fp: [2, 2], mass: 0.6, color: 0x5aa7e0, shear: 26, facing: true,
    build(){
      const g = new THREE.Group();
      const body = vbox(C * .8, C * .8, C * .55, 0x5aa7e0); body.position.z = -C * .1; g.add(body);
      const mouth = vbox(C * .62, C * .62, C * .3, 0x3f83b8); mouth.position.z = C * .25; g.add(mouth);
      return g;
    }
  },
  battery: {
    label: 'BATT', key: '9', cat: 'electric', fp: [2, 2], mass: 1.3, color: 0x46c2a5, shear: 34,
    build(){
      const g = new THREE.Group();
      g.add(vbox(C * .85, C * .75, C * .85, 0x46c2a5));
      const tip = vbox(C * .3, C * .18, C * .3, 0x2f9c82); tip.position.y = C * .45; g.add(tip);
      return g;
    }
  },
  motor: {
    label: 'MOTOR', key: '0', cat: 'electric', fp: [2, 2], mass: 1.1, color: 0x9b6fd6, shear: 36,
    build(){
      const g = new THREE.Group();
      const b = vcyl(C * .38, C * .8, 0x9b6fd6, 12); b.rotation.z = Math.PI / 2; g.add(b);
      const band = vcyl(C * .41, C * .2, 0x7d51b8, 12); band.rotation.z = Math.PI / 2; g.add(band);
      return g;
    }
  },
  fan: {
    label: 'FAN', key: '', cat: 'electric', fp: [2, 2], mass: 0.7, color: 0x6fd6d0, shear: 24, facing: true,
    build(){
      const g = new THREE.Group();
      const ring = vcyl(C * .44, C * .22, 0x6fd6d0, 14); ring.rotation.x = Math.PI / 2; g.add(ring);
      const blades = new THREE.Group();
      for(let i = 0; i < 4; i++){
        const bl = vbox(C * .1, C * .36, C * .06, 0x4db3ad);
        bl.rotation.z = i * Math.PI / 2;
        bl.translateY(C * .19);
        blades.add(bl);
      }
      blades.name = 'spin';                       // main.js spins this while charging
      g.add(blades);
      return g;
    }
  },
  wing: {
    label: 'WING', key: '', cat: 'aero', fp: [2, 2], mass: 0.5, color: 0xeef1f4, shear: 22, facing: true,
    build(){
      const g = new THREE.Group();
      const plane = vbox(C * 1.0, C * .12, C * .5, 0xeef1f4); plane.position.y = C * .2; g.add(plane);
      const strutL = vbox(C * .08, C * .4, C * .08, 0xc9ced4); strutL.position.set(-C * .35, -C * .05, 0); g.add(strutL);
      const strutR = strutL.clone(); strutR.position.x = C * .35; g.add(strutR);
      return g;
    }
  },
};

export const PART_ORDER = ['frame1', 'frame', 'frame3', 'seat', 'wheel', 'engine',
  'tank', 'intake', 'battery', 'motor', 'fan', 'wing'];

export function fpOf(type){ return PARTS[type].fp || [2, 2]; }

// machine-local center (pre-center-offset) of a part anchored at cell (x,y,z)
export function localCenterOf(x, y, z, type){
  const [w, d] = fpOf(type);
  return new THREE.Vector3((x + (w - 1) / 2) * CELLXZ, y * CELLY, (z + (d - 1) / 2) * CELLXZ);
}

// build a display mesh for one placed part (rot = quarter-turns around Y)
export function buildPartMesh(type, rot = 0){
  const def = PARTS[type];
  const g = def.build();
  // Adam's SVG as the top face (the game is viewed from above)
  const tex = artTex(type);
  if(tex){
    const [fw, fd] = fpOf(type);
    const box = new THREE.Box3().setFromObject(g);
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(fw * CELLXZ * 0.985, fd * CELLXZ * 0.985),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    quad.rotation.set(-Math.PI / 2, 0, Math.PI);   // svg "up" = machine forward
    quad.position.y = box.max.y + 0.012;
    g.add(quad);
  }
  g.rotation.y = rot * Math.PI / 2;
  const wrap = new THREE.Group();
  wrap.add(g);
  // invisible full-footprint hitbox: hovering ANYWHERE over a part's cells hits that part
  // (meshes are smaller than their footprint — without this the ray falls through to the layer below)
  const [fw, fd] = fpOf(type);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(fw * CELLXZ, CELLY, fd * CELLXZ), HIT_MAT);
  hit.name = 'hit';
  wrap.add(hit);
  return wrap;
}

// facing direction of a rotated part, in grid steps
export function facingDir(rot){
  return [[0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0]][rot & 3];
}
