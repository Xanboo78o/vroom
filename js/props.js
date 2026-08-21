/* =============================================================================
   props.js — Kris's Corner's furniture: text boards ("easels" leaning 40° so the
   top-down camera can read them), Adam's BILLBOARDS (assets/billboards/list.json),
   the LAUGH sign, the LIVE board, the statue of Kris ("got lost. got found."),
   the commentary booth with Kris in it, and the grandstand. All primitives in the
   palette, all cast/receive real shadows. T hot-reloads billboard art.
   ============================================================================= */
import * as THREE from 'three';
import { vbox, vcyl, mat, shade } from './parts.js';
import { PAL, hex } from './palette.js';

export const PROPS = { boards: [], arts: [], live: { set: null, draw: null }, kris: null };
const LEAN = THREE.MathUtils.degToRad(40);
let API = null;   // { trackPoint, TRK, wall, WORLD } from world.js (passed in to avoid an import cycle)

/* ---- canvas text texture ------------------------------------------------------ */
export function textTex({ w = 512, h = 256, bg = PAL.cream, fg = PAL.text, lines = [''], font = "'Trebuchet MS', system-ui, sans-serif", size = 0, weight = 'bold', draw = null }){
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d');
  x.fillStyle = hex(bg); x.fillRect(0, 0, w, h);
  x.strokeStyle = hex(shade(bg, .72)); x.lineWidth = Math.max(4, h * 0.03); x.strokeRect(x.lineWidth / 2, x.lineWidth / 2, w - x.lineWidth, h - x.lineWidth);
  if(draw) draw(x, w, h);
  else {
    const fs = size || Math.min(h * 0.5 / lines.length, w / (Math.max(...lines.map(l => l.length)) * 0.62));
    x.fillStyle = hex(fg); x.font = `${weight} ${fs}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach((l, i) => x.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.15));
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/* a board leaning toward the camera: posts + frame + the face. top edge toward -z (screen up) */
export function easel(w, h, tex, frameHex = PAL.ink){
  const g = new THREE.Group();
  const postH = 0.9;
  for(const sx of [-1, 1]){ const p = vcyl(0.08, postH, shade(frameHex, .9), 8); p.position.set(sx * (w / 2 - 0.15), postH / 2, 0); g.add(p); }
  const tilt = new THREE.Group(); tilt.position.y = postH; tilt.rotation.x = -(Math.PI / 2 - LEAN); // lean back toward -z
  const frame = vbox(w + 0.3, h + 0.3, 0.12, frameHex); frame.position.set(0, h / 2, -0.07); tilt.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, flatShading: true }));
  face.position.set(0, h / 2, 0.001); face.receiveShadow = true; face.name = 'face';
  tilt.add(face);
  g.add(tilt);
  g.userData.face = face;
  return g;
}
function place(scene, obj, x, z, ry = 0){ obj.position.set(x, API.WORLD.h(x, z), z); obj.rotation.y = ry; scene.add(obj); return obj; }

/* ---- billboards: Adam's art or parody placeholders ---------------------------- */
const PLACEHOLDERS = [
  () => textTex({ bg: PAL.pad, fg: PAL.text, lines: ["DILLON'S", '24/7 · never sleeps'], font: "Impact, 'Arial Black', sans-serif" }),
  () => textTex({ bg: 0xd9a35c, fg: 0x6b4a24, lines: ['BREAD'], size: 150, font: "Impact, 'Arial Black', sans-serif" }),
  () => textTex({ bg: PAL.otterBelly, fg: PAL.otter, lines: ['coral facts', 'by Corval'] }),
  () => textTex({ bg: PAL.plow, fg: PAL.paper, lines: ['PLOWVAL', 'we plow.'], font: "Impact, 'Arial Black', sans-serif" }),
  () => textTex({ bg: PAL.cream, fg: PAL.red, lines: ['kRacing'], size: 140 }),
];
function boardTex(i){
  const a = PROPS.arts; if(a.length) return a[i % a.length];
  return PLACEHOLDERS[i % PLACEHOLDERS.length]();
}
export function reloadBillboards(){
  fetch('./assets/billboards/list.json?t=' + Date.now()).then(r => r.ok ? r.json() : []).catch(() => []).then(list => {
    if(!Array.isArray(list) || !list.length){ PROPS.arts = []; redress(); return; }
    let pending = list.length; const arts = new Array(list.length);
    list.forEach((f, i) => {
      const img = new Image();
      img.onload = () => { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const x = cv.getContext('2d');
        x.fillStyle = hex(PAL.cream); x.fillRect(0, 0, 512, 256);
        const s = Math.min(512 / img.width, 256 / img.height), w = img.width * s, h = img.height * s;
        x.drawImage(img, (512 - w) / 2, (256 - h) / 2, w, h);
        const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; arts[i] = t; if(--pending === 0){ PROPS.arts = arts.filter(Boolean); redress(); } };
      img.onerror = () => { if(--pending === 0){ PROPS.arts = arts.filter(Boolean); redress(); } };
      img.src = './assets/billboards/' + f + '?t=' + Date.now();
    });
  });
}
function redress(){
  PROPS.boards.forEach((b, i) => { const face = b.userData.face; const old = face.material.map; face.material.map = boardTex(i); face.material.needsUpdate = true; if(old && !PROPS.arts.includes(old)) old.dispose(); });
}

/* ---- Kris (the block-guy recipe in hoodie blue) -------------------------------- */
export function makeKris(color = PAL.hoodie, stone = null){
  const g = new THREE.Group();
  const C = stone || color, skin = stone || PAL.skin, legs = stone || PAL.legs, cap = stone || shade(color, .85);
  const body = vbox(0.42, 0.55, 0.3, C); body.position.y = 0.62; g.add(body);
  const head = vbox(0.34, 0.3, 0.3, skin); head.position.y = 1.06; head.name = 'head'; g.add(head);
  const capM = vbox(0.38, 0.12, 0.34, cap); capM.position.y = 1.24; head.add(capM); capM.position.y = 0.18;
  const legL = vbox(0.16, 0.36, 0.2, legs); legL.position.set(-0.11, 0.18, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.11; g.add(legR);
  const armL = vbox(0.12, 0.4, 0.16, stone || shade(color, .88)); armL.position.set(-0.29, 0.68, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.29; g.add(armR);
  if(!stone){ // headset + mic + mug
    const band = vbox(0.4, 0.06, 0.06, PAL.ink); band.position.set(0, 0.3, 0); head.add(band);
    const cup = vbox(0.08, 0.14, 0.14, PAL.ink); cup.position.set(-0.2, 0, 0); head.add(cup);
    const mic = vbox(0.04, 0.04, 0.2, PAL.ink); mic.position.set(-0.12, -0.08, 0.18); head.add(mic);
    const mug = vcyl(0.06, 0.12, PAL.paper, 8); mug.position.set(0.3, 0.9, 0.12); g.add(mug);
  }
  return g;
}

/* ---- build everything ---------------------------------------------------------- */
export function buildProps(scene, api){
  API = api;
  const { trackPoint, TRK, wall } = api;

  // statue of Kris — plinth + stone Kris + plaque readable from above
  const statue = new THREE.Group();
  const plinth = vbox(1.6, 0.9, 1.6, PAL.plinth); plinth.position.y = 0.45; statue.add(plinth);
  const kris = makeKris(null, PAL.stone); kris.scale.setScalar(1.5); kris.position.y = 0.9; kris.getObjectByName('head').rotation.x = 0.25; statue.add(kris);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.42), new THREE.MeshLambertMaterial({ map: textTex({ w: 512, h: 160, bg: PAL.border, fg: PAL.text, lines: ['got lost. got found.'], size: 52, weight: '800' }), flatShading: true }));
  plaque.rotation.set(-Math.PI / 2, 0, Math.PI); plaque.position.set(0, 0.91, 0.45); plaque.receiveShadow = true; statue.add(plaque);
  place(scene, statue, 0, 16);
  wall(0, 16, 1.8, 2.6, 1.8, PAL.plinth, true);

  // LAUGH — Kris's one rule
  place(scene, easel(2.0, 0.9, textTex({ w: 512, h: 230, bg: PAL.red, fg: PAL.cream, lines: ['LAUGH'], size: 150, font: "Impact, 'Arial Black', sans-serif" }), PAL.redDark), 8, 17);
  // LIVE board — the daily, later
  const live = easel(4, 2, textTex({ bg: PAL.cream, fg: PAL.text, lines: ['DAILY', 'coming soon'], size: 70 }));
  place(scene, live, -9, 17);
  PROPS.live.set = draw => { const face = live.userData.face; const old = face.material.map; face.material.map = textTex({ draw }); face.material.needsUpdate = true; if(old) old.dispose(); };

  // grandstand + billboard on top, by the start line
  const gs = new THREE.Group();
  for(let i = 0; i < 4; i++){ const step = vbox(20, 0.6, 1.5, PAL.stand); step.position.set(0, 0.3 + i * 0.6, -2.25 + i * 1.5); gs.add(step); }
  const rail = vbox(20, 0.3, 0.15, PAL.red); rail.position.set(0, 2.55, 2.9); gs.add(rail);
  place(scene, gs, -52, -25);
  wall(-52, -25, 20, 2.7, 6, PAL.stand, true);
  const gsBoard = easel(6, 3, null); gsBoard.position.set(-52, 2.4, -22.8); scene.add(gsBoard); PROPS.boards.push(gsBoard);

  // commentary booth — open-topped so Kris reads from above
  const booth = new THREE.Group();
  for(const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ const post = vbox(0.15, 3, 0.15, PAL.ink); post.position.set(sx * 1.2, 1.5, sz * 0.9); booth.add(post); }
  const floor = vbox(2.6, 0.15, 2.0, PAL.stand); floor.position.y = 3; booth.add(floor);
  for(const [x, z, w, d] of [[0, -0.95, 2.6, 0.1], [-1.25, 0, 0.1, 2], [1.25, 0, 0.1, 2]]){ const r = vbox(w, 0.6, d, PAL.border); r.position.set(x, 3.38, z); booth.add(r); }
  const desk = vbox(2.2, 0.1, 0.5, PAL.leather); desk.position.set(0, 3.5, 0.55); booth.add(desk);
  const krisB = makeKris(PAL.hoodie); krisB.position.set(0, 3.08, -0.1); krisB.rotation.y = Math.PI; // faces the track (+z→ booth at z -26 looks toward -48 = -z, so face -z)
  krisB.rotation.y = 0;
  booth.add(krisB); PROPS.kris = krisB;
  place(scene, booth, -66, -26);
  wall(-66, -26, 2.8, 3.2, 2.2, PAL.ink, true);
  api.WORLD.anim.push({ update(t){ const h = krisB.getObjectByName('head'); h.rotation.y = Math.sin(t * 0.35) * 0.5; h.rotation.x = 0.05 + Math.sin(t * 1.7) * 0.04; } });

  // billboards along the straights (easels all face the same way: top toward -z)
  const spots = [];
  for(const t of [0.05, 0.10, 0.15, 0.20]){ const p = trackPoint(t); spots.push([p.x, p.z - 11]); }          // top straight, infield side
  for(const t of [0.55, 0.60, 0.65, 0.70]){ const p = trackPoint(t); spots.push([p.x, p.z - 11]); }          // bottom straight, outside
  spots.push([-14, 64], [14, 64]);                                                                           // plaza
  for(const [x, z] of spots){ const b = easel(6, 3, null); place(scene, b, x, z); PROPS.boards.push(b); wall(x, z, 6.4, 1.2, 1.2, PAL.ink, true); }
  PROPS.boards.forEach((b, i) => { b.userData.face.material.map = boardTex(i); b.userData.face.material.needsUpdate = true; });
  reloadBillboards();
}
