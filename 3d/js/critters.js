/* =============================================================================
   critters.js — the cast, in their plaza spots (pre-"houses" update):
     TOMATHY  horse-sized duck, orange beak, brown leather saddle + saddle bag (Jimothy inside),
              next to his bread-logo golf cart (30 xTP/h, bread-independent)
     JIMOTHY  the goob raccoon, asleep in the saddle bag — mrrp, chirps, a lil blep
     DILLON   armadillo, runs DILLON'S tire shop, 24/7, rolls a tire back and forth
     CORVAL   otter, ALWAYS holding his coral, beside PLOWVAL the plow
   All primitives in the palette, idle animations via WORLD.anim, hidden walls so
   you can't drive through the big ones. No behaviours/sounds yet.
   ============================================================================= */
import * as THREE from 'three';
import { vbox, vcyl, shade } from './parts.js';
import { PAL } from './palette.js';
import { textTex } from './props.js';

let API = null;
function place(scene, obj, x, z, ry = 0){ obj.position.set(x, API.WORLD.h(x, z), z); obj.rotation.y = ry; scene.add(obj); return obj; }

/* ---- Tomathy (+ Jimothy in the bag) ------------------------------------------- */
function makeTomathy(){
  const g = new THREE.Group();
  const body = vbox(1.3, 1.1, 2.2, PAL.duck); body.position.set(0, 1.25, 0); g.add(body);
  const tail = vbox(0.6, 0.4, 0.5, PAL.duck); tail.position.set(0, 1.45, -1.3); tail.rotation.x = -0.5; g.add(tail);
  const neck = new THREE.Group(); neck.position.set(0, 1.6, 0.95);
  const neckM = vbox(0.5, 0.9, 0.5, PAL.duck); neckM.position.y = 0.45; neck.add(neckM);
  const head = vbox(0.6, 0.55, 0.7, PAL.duck); head.position.set(0, 1.0, 0.12); neck.add(head);
  const beak = vbox(0.35, 0.2, 0.55, PAL.beak); beak.position.set(0, 0.9, 0.6); neck.add(beak);
  for(const sx of [-1, 1]){ const eye = vbox(0.08, 0.08, 0.08, PAL.mask); eye.position.set(sx * 0.31, 1.1, 0.3); neck.add(eye); }
  g.add(neck);
  for(const sx of [-1, 1]){ const leg = vcyl(0.12, 0.7, PAL.beak, 8); leg.position.set(sx * 0.35, 0.35, 0.1); g.add(leg);
    const foot = vbox(0.45, 0.08, 0.5, PAL.beak); foot.position.set(sx * 0.35, 0.04, 0.25); g.add(foot); }
  const saddle = vbox(0.9, 0.12, 0.8, PAL.leather); saddle.position.set(0, 1.86, -0.1); g.add(saddle);
  const cantle = vbox(0.9, 0.25, 0.15, PAL.leather); cantle.position.set(0, 1.98, -0.5); g.add(cantle);
  for(const sx of [-1, 1]){ const strap = vbox(0.08, 1.0, 0.1, shade(PAL.leather, .8)); strap.position.set(sx * 0.68, 1.3, -0.1); g.add(strap); }
  // saddle bag on the left flank, Jimothy inside
  const bag = vbox(0.45, 0.45, 0.5, shade(PAL.leather, .9)); bag.position.set(-0.87, 1.35, -0.5); g.add(bag);
  const jim = makeJimothy(); jim.position.set(-0.87, 1.58, -0.5); jim.rotation.y = -Math.PI / 2; g.add(jim);
  g.userData.anim = { body, neck, tail, jim };
  return g;
}
function makeJimothy(){
  const g = new THREE.Group();
  const body = vbox(0.34, 0.22, 0.4, PAL.raccoon); body.position.set(0, 0.11, 0); g.add(body);
  const head = vbox(0.22, 0.18, 0.2, PAL.raccoon); head.position.set(0, 0.22, 0.22); g.add(head);
  const maskB = vbox(0.24, 0.07, 0.06, PAL.mask); maskB.position.set(0, 0.25, 0.31); g.add(maskB);
  for(const sx of [-1, 1]){ const ear = vbox(0.06, 0.06, 0.04, PAL.mask); ear.position.set(sx * 0.08, 0.33, 0.2); g.add(ear); }
  for(let i = 0; i < 3; i++){ const seg = vbox(0.1, 0.1, 0.12, i % 2 ? PAL.mask : PAL.raccoon); seg.position.set(0.12 + i * 0.06, 0.08 + i * 0.05, -0.22 - i * 0.08); g.add(seg); }
  g.userData.anim = { body, head };
  return g;
}
function makeCart(){
  const g = new THREE.Group();
  const chassis = vbox(1.0, 0.4, 1.7, PAL.duck); chassis.position.y = 0.45; g.add(chassis);
  const bench = vbox(0.9, 0.3, 0.5, PAL.leather); bench.position.set(0, 0.8, -0.2); g.add(bench);
  const roof = vbox(1.1, 0.08, 1.6, PAL.paper); roof.position.y = 1.55; g.add(roof);
  for(const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ const post = vbox(0.06, 0.9, 0.06, PAL.paper); post.position.set(sx * 0.5, 1.08, sz * 0.75); g.add(post); }
  for(const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ const w = vcyl(0.22, 0.18, PAL.wheel, 10); w.rotation.z = Math.PI / 2; w.position.set(sx * 0.55, 0.22, sz * 0.6); g.add(w); }
  const breadTex = textTex({ w: 256, h: 128, bg: 0xd9a35c, fg: 0x6b4a24, lines: ['BREAD'], size: 60, font: "Impact, 'Arial Black', sans-serif" });
  const side = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.35), new THREE.MeshLambertMaterial({ map: breadTex, flatShading: true }));
  side.position.set(-0.51, 0.5, 0); side.rotation.y = -Math.PI / 2; g.add(side);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshLambertMaterial({ map: breadTex, flatShading: true }));
  top.position.set(0, 1.6, 0); top.rotation.set(-Math.PI / 2, 0, Math.PI); g.add(top);
  return g;
}

/* ---- Dillon + the shop --------------------------------------------------------- */
function tireStack(n){ const g = new THREE.Group(); for(let i = 0; i < n; i++){ const t = vcyl(0.4, 0.25, PAL.wheel, 12); t.position.y = 0.125 + i * 0.26; g.add(t); const h = vcyl(0.15, 0.27, PAL.hub, 8); h.position.y = 0.125 + i * 0.26; g.add(h); } return g; }
function makeDillons(){
  const g = new THREE.Group();
  const counter = vbox(3.0, 1.1, 1.2, PAL.pad); counter.position.set(0, 0.55, 0); g.add(counter);
  for(const sx of [-1, 1]){ const p = vbox(0.12, 2.3, 0.12, PAL.ink); p.position.set(sx * 1.45, 1.15, -0.5); g.add(p); }
  for(let i = 0; i < 5; i++){ const a = vbox(0.62, 0.06, 1.1, i % 2 ? PAL.paper : PAL.red); a.position.set(-1.24 + i * 0.62, 2.3, -0.1); a.rotation.x = 0.26; g.add(a); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7), new THREE.MeshLambertMaterial({ map: textTex({ w: 512, h: 160, bg: PAL.pad, fg: PAL.text, lines: ["DILLON'S  24/7"], size: 64, font: "Impact, 'Arial Black', sans-serif" }), flatShading: true }));
  sign.position.set(0, 1.7, 0.62); sign.rotation.x = -0.35; g.add(sign);
  const s1 = tireStack(3); s1.position.set(-1.9, 0, 0.3); g.add(s1);
  const s2 = tireStack(2); s2.position.set(1.9, 0, 0.5); g.add(s2);
  return g;
}
function makeDillon(){
  const g = new THREE.Group();
  const shell = vbox(0.5, 0.35, 0.7, PAL.armadillo); shell.position.set(0, 0.33, 0); g.add(shell);
  for(let i = 0; i < 3; i++){ const band = vbox(0.52, 0.08, 0.1, PAL.armadilloDark); band.position.set(0, 0.4, -0.2 + i * 0.2); g.add(band); }
  const head = vbox(0.22, 0.2, 0.3, PAL.armadillo); head.position.set(0, 0.25, 0.45); g.add(head);
  const snout = vbox(0.12, 0.12, 0.15, PAL.armadilloDark); snout.position.set(0, 0.2, 0.65); g.add(snout);
  const tail = vcyl(0.05, 0.5, PAL.armadilloDark, 6); tail.rotation.x = Math.PI / 2; tail.position.set(0, 0.18, -0.55); g.add(tail);
  const legs = [];
  for(const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ const l = vbox(0.1, 0.18, 0.1, PAL.armadilloDark); l.position.set(sx * 0.18, 0.09, sz * 0.22); g.add(l); legs.push(l); }
  g.userData.anim = { legs };
  return g;
}

/* ---- Corval + PLOWVAL ----------------------------------------------------------- */
function makeCorval(){
  const g = new THREE.Group();
  const body = vbox(0.4, 0.7, 0.35, PAL.otter); body.position.set(0, 0.45, 0); g.add(body);
  const belly = vbox(0.26, 0.45, 0.06, PAL.otterBelly); belly.position.set(0, 0.42, 0.2); g.add(belly);
  const head = vbox(0.34, 0.3, 0.3, PAL.otter); head.position.set(0, 0.95, 0.02); head.name = 'head'; g.add(head);
  const muzzle = vbox(0.2, 0.14, 0.12, PAL.otterBelly); muzzle.position.set(0, -0.05, 0.2); head.add(muzzle);
  const nose = vbox(0.08, 0.06, 0.06, PAL.mask); nose.position.set(0, 0.0, 0.27); head.add(nose);
  for(const sx of [-1, 1]){ const ear = vbox(0.08, 0.08, 0.05, PAL.otter); ear.position.set(sx * 0.15, 0.17, 0); head.add(ear); }
  const tail = vbox(0.16, 0.12, 0.6, PAL.otter); tail.position.set(0, 0.06, -0.45); g.add(tail);
  const arms = new THREE.Group(); arms.position.set(0, 0.7, 0.15);
  for(const sx of [-1, 1]){ const a = vbox(0.1, 0.35, 0.1, PAL.otter); a.position.set(sx * 0.22, -0.15, 0.1); a.rotation.x = -0.9; arms.add(a); }
  // THE CORAL
  const coral = new THREE.Group(); coral.position.set(0, -0.2, 0.4);
  const stem = vcyl(0.05, 0.3, PAL.coral, 6); stem.position.y = 0.1; coral.add(stem);
  for(const [x, r] of [[-0.08, 0.4], [0.0, 0.0], [0.09, -0.45]]){ const b = vbox(0.06, 0.22, 0.06, PAL.coral2); b.position.set(x, 0.28, 0); b.rotation.z = r; coral.add(b); }
  arms.add(coral);
  g.add(arms);
  g.userData.anim = { arms, head };
  return g;
}
function makePlowval(){
  const g = new THREE.Group();
  const chassis = vbox(1.2, 0.5, 2.0, PAL.plow); chassis.position.y = 0.55; g.add(chassis);
  const cab = vbox(1.0, 0.7, 0.9, PAL.plow); cab.position.set(0, 1.15, -0.35); g.add(cab);
  const glass = vbox(0.9, 0.35, 0.92, shade(PAL.paper, .95)); glass.position.set(0, 1.25, -0.35); g.add(glass);
  for(const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ const w = vcyl(0.3, 0.25, PAL.wheel, 10); w.rotation.z = Math.PI / 2; w.position.set(sx * 0.68, 0.3, sz * 0.7); g.add(w); }
  for(const sx of [-1, 1]){ const arm = vbox(0.1, 0.1, 0.8, PAL.ink); arm.position.set(sx * 0.4, 0.5, 1.3); g.add(arm); }
  const blade = vbox(1.8, 0.6, 0.15, PAL.blade); blade.position.set(0, 0.35, 1.7); blade.rotation.x = -0.35; g.add(blade);
  const beacon = vbox(0.15, 0.15, 0.15, PAL.beacon); beacon.position.set(0, 1.58, -0.35); g.add(beacon);
  const name = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.32), new THREE.MeshLambertMaterial({ map: textTex({ w: 512, h: 180, bg: PAL.plow, fg: PAL.paper, lines: ['PLOWVAL'], size: 90, font: "Impact, 'Arial Black', sans-serif" }), flatShading: true }));
  name.rotation.set(-Math.PI / 2, 0, Math.PI); name.position.set(0, 1.52, -0.35); g.add(name);
  g.userData.anim = { beacon };
  return g;
}

/* ---- place the cast ---------------------------------------------------------------- */
export function buildCritters(scene, api){
  API = api;
  const { wall, WORLD } = api;
  // Tomathy + cart (west side of the plaza)
  const tom = place(scene, makeTomathy(), -19, 36, Math.PI / 2);
  wall(-19, 36, 2.4, 2.4, 1.6, PAL.duck, true);
  const cart = place(scene, makeCart(), -21, 43, Math.PI / 2);
  wall(-21, 43, 1.9, 1.7, 1.2, PAL.duck, true);
  // Dillon's (east)
  place(scene, makeDillons(), 21, 36, -Math.PI / 2);
  wall(21, 36, 1.4, 2.4, 4.2, PAL.pad, true);
  const dil = place(scene, makeDillon(), 19.2, 33.5, 0);
  const tire = vcyl(0.35, 0.25, PAL.wheel, 12); tire.rotation.x = Math.PI / 2; tire.position.set(19.2, 0.35, 34.4); scene.add(tire);
  // PLOWVAL + Corval (south-east)
  place(scene, makePlowval(), 18, 57, -Math.PI * 0.75);
  wall(18, 57, 2.6, 1.8, 2.6, PAL.plow, true);
  const cor = place(scene, makeCorval(), 15, 54, -Math.PI * 0.6);
  // idle animations
  const A = tom.userData.anim, J = A.jim.userData.anim, D = dil.userData.anim, Cv = cor.userData.anim;
  WORLD.anim.push({ update(t){
    A.body.position.y = 1.25 + Math.sin(t * 1.6) * 0.03;
    A.neck.rotation.y = Math.sin(t * 0.7) * 0.35;
    A.tail.rotation.y = Math.sin(t * 3.1) * 0.2;
    J.body.scale.y = 1 + Math.sin(t * 2.2) * 0.06;
    J.head.rotation.x = Math.sin(t * 2.2) * 0.05;
    const z = 34.4 + Math.sin(t * 0.8) * 0.6; tire.position.z = z; tire.rotation.y = (z / 0.35);
    dil.position.z = z - 0.9 + Math.sin(t * 0.8) * 0.1;
    D.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 6 + i * 1.5) * 0.3 * Math.abs(Math.cos(t * 0.8)); });
    Cv.arms.rotation.x = -0.3 + Math.sin(t * 0.6) * 0.3;
    Cv.head.rotation.z = Math.sin(t * 0.9) * 0.12;
  } });
}
