/* =============================================================================
   paint.js — the livery editor v1 (inside build mode, P toggles).
   Left-edge strip: factory swatch + 24 palette swatches + a decal tray (text with
   3 fonts, shapes, parody logos). Click = paint a block, Shift-click = one face,
   hold = spray across blocks. Pick a decal → it follows the cursor → scroll = size,
   R = rotate, click = stamp (TOP faces only in v1), X = undo last, Esc = drop.
   Nothing here touches geometry/occ/center, so the build never jumps.
   ============================================================================= */
import * as THREE from 'three';
import { PARTS, fpOf, localCenterOf, CELLXZ, CELLY } from './parts.js';
import { cellsOf } from './machine.js';
import { applySkin, drawDecal, decalIcon, SHAPES, LOGOS, FONTS } from './skin.js';
import { PAL, SWATCHES, hex, shade } from './palette.js';

const key = (x, y, z) => x + ',' + y + ',' + z;
export const PAINT = {
  on: false, hex: SWATCHES[0], tool: 'brush', dec: null,   // dec = { t, k, s, a, c, f }
  down: false, dirty: new Set(), hover: null,               // hover = { m, k, face, point }
  _scene: null, _hl: null, _fq: null, _pv: null, _pvCanvas: null, _pvTex: null, _pvKey: '',
};

/* ---- DOM ------------------------------------------------------------------- */
export function initPaint(scene){
  PAINT._scene = scene;
  if(document.getElementById('paint')) return;
  const root = document.createElement('div'); root.id = 'paint'; root.style.display = 'none';
  root.innerHTML = `<div class="ptitle">PAINT</div><div id="sw"></div>
    <div class="ptitle">DECALS</div>
    <div id="dtext"><input id="dtxt" maxlength="8" placeholder="TEXT" autocomplete="off"><div id="fonts"></div><button id="dtxtBtn" class="dbtn txt">AB</button></div>
    <div id="dshapes"></div><div id="dlogos"></div>`;
  document.body.appendChild(root);
  const sw = root.querySelector('#sw');
  const fac = document.createElement('div'); fac.className = 'sw fac on'; fac.title = 'factory (strip paint)'; fac.onclick = () => pickSwatch(null, fac);
  sw.appendChild(fac);
  for(const h of SWATCHES){
    const d = document.createElement('div'); d.className = 'sw'; d.style.background = hex(h); d.style.borderColor = hex(shade(h, .7));
    d.onclick = () => pickSwatch(h, d); sw.appendChild(d);
  }
  const fonts = root.querySelector('#fonts');
  FONTS.forEach((f, i) => { const b = document.createElement('button'); b.className = 'fchip' + (i === 0 ? ' on' : ''); b.textContent = 'Aa'; b.style.fontFamily = f; b.dataset.f = i;
    b.onclick = () => { [...fonts.children].forEach(c => c.classList.remove('on')); b.classList.add('on'); if(PAINT.dec && PAINT.dec.t === 'txt'){ PAINT.dec.f = i; refreshPreview(true); } }; fonts.appendChild(b); });
  root.querySelector('#dtxtBtn').onmousedown = e => { e.preventDefault(); const t = (root.querySelector('#dtxt').value || 'kR').slice(0, 8); holdDecal({ t: 'txt', k: t, f: +(fonts.querySelector('.on') || {}).dataset?.f || 0 }); };
  root.querySelector('#dtxt').addEventListener('keydown', e => { if(e.key === 'Enter'){ root.querySelector('#dtxtBtn').onmousedown(e); root.querySelector('#dtxt').blur(); } e.stopPropagation(); });
  const shapes = root.querySelector('#dshapes');
  for(const k of SHAPES){ const b = document.createElement('button'); b.className = 'dbtn'; b.title = k; b.style.backgroundImage = `url(${decalIcon({ t: 'shape', k, c: PAL.red })})`; b.onmousedown = e => { e.preventDefault(); holdDecal({ t: 'shape', k }); }; shapes.appendChild(b); }
  const logos = root.querySelector('#dlogos');
  for(const k of LOGOS){ const b = document.createElement('button'); b.className = 'dbtn'; b.title = k; b.style.backgroundImage = `url(${decalIcon({ t: 'logo', k, c: PAL.red })})`; b.onmousedown = e => { e.preventDefault(); holdDecal({ t: 'logo', k }); }; logos.appendChild(b); }
  // highlight + preview meshes
  PAINT._hl = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: PAL.blue, transparent: true, opacity: 0.35, depthTest: false }));
  PAINT._hl.visible = false; PAINT._hl.renderOrder = 5; scene.add(PAINT._hl);
  PAINT._fq = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: PAL.blue, transparent: true, opacity: 0.5, depthTest: false, side: THREE.DoubleSide }));
  PAINT._fq.visible = false; PAINT._fq.renderOrder = 6; scene.add(PAINT._fq);
  PAINT._pvCanvas = document.createElement('canvas'); PAINT._pvCanvas.width = 512; PAINT._pvCanvas.height = 256;
  PAINT._pvTex = new THREE.CanvasTexture(PAINT._pvCanvas); PAINT._pvTex.colorSpace = THREE.SRGBColorSpace;
  const pvq = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial({ map: PAINT._pvTex, transparent: true, depthTest: false, opacity: 0.9 }));
  pvq.rotation.set(-Math.PI / 2, 0, Math.PI);
  const spin = new THREE.Group(); spin.add(pvq);
  const pv = new THREE.Group(); pv.add(spin); pv.visible = false; pv.renderOrder = 7;
  PAINT._pv = pv; PAINT._pvSpin = spin; PAINT._pvQuad = pvq; scene.add(pv);
}
function pickSwatch(h, el){
  PAINT.hex = h; PAINT.tool = 'brush'; PAINT.dec = null; PAINT._pv.visible = false;
  document.querySelectorAll('#sw .sw').forEach(d => d.classList.toggle('on', d === el));
  if(h != null && PAINT.dec) PAINT.dec.c = h;
}
function holdDecal(d){
  PAINT.tool = 'decal';
  PAINT.dec = { s: 0.6, a: 0, c: PAINT.hex ?? PAL.red, ...(PAINT.dec && PAINT.dec.t === d.t ? { s: PAINT.dec.s, a: PAINT.dec.a } : {}), ...d };
  refreshPreview(true);
}
export function setPaint(on){
  PAINT.on = !!on;
  const el = document.getElementById('paint'); if(el) el.style.display = on ? 'flex' : 'none';
  if(!on){ PAINT.down = false; PAINT.dec = null; PAINT.tool = 'brush'; hideHelpers(); }
}
function hideHelpers(){ if(PAINT._hl) PAINT._hl.visible = false; if(PAINT._fq) PAINT._fq.visible = false; if(PAINT._pv) PAINT._pv.visible = false; }
export function dropDecal(){ if(!PAINT.dec) return false; PAINT.dec = null; PAINT.tool = 'brush'; if(PAINT._pv) PAINT._pv.visible = false; return true; }
export function rotateDecal(){ if(!PAINT.dec) return false; PAINT.dec.a = (PAINT.dec.a + 1) & 7; return true; }
export function scaleDecal(dy){ if(!PAINT.dec) return false; PAINT.dec.s = THREE.MathUtils.clamp(PAINT.dec.s * (dy > 0 ? 1 / 1.12 : 1.12), 0.15, 3); refreshPreview(false); return true; }

function refreshPreview(redraw){
  const d = PAINT.dec; if(!d) return;
  const k = JSON.stringify({ t: d.t, k: d.k, c: d.c, f: d.f });
  if(redraw || k !== PAINT._pvKey){
    PAINT._pvKey = k;
    const ctx = PAINT._pvCanvas.getContext('2d'); ctx.clearRect(0, 0, 512, 256);
    drawDecal(ctx, { ...d, x: 0.5, y: 0.5, a: 0, s: 200 / (128 / CELLXZ) }, 512, 256);  // 200px tall in a 512x256 canvas
    PAINT._pvTex.needsUpdate = true;
  }
  PAINT._pvQuad.scale.set(d.s * 256 / 200 * 2 / 2, d.s * 256 / 200, 1);   // quad is 2x1 → width 2·(s·1.28)/2… keep aspect of the canvas
  PAINT._pvQuad.scale.set(d.s * 1.28, d.s * 1.28, 1);
}

/* ---- hover ----------------------------------------------------------------- */
const _lp = new THREE.Vector3(), _n = new THREE.Vector3(), _w = new THREE.Vector3();
function faceOf(wrap, hit, type, rot){
  const [fw, fd] = fpOf(type);
  wrap.worldToLocal(_lp.copy(hit.point));
  const hx = fw * CELLXZ / 2, hy = CELLY / 2, hz = fd * CELLXZ / 2;
  const ax = Math.abs(_lp.x) / hx, ay = Math.abs(_lp.y) / hy, az = Math.abs(_lp.z) / hz;
  if(ax >= ay && ax >= az) _n.set(Math.sign(_lp.x) || 1, 0, 0);
  else if(ay >= az) _n.set(0, Math.sign(_lp.y) || 1, 0);
  else _n.set(0, 0, Math.sign(_lp.z) || 1);
  // into the part's own (rotated) frame: undo rot quarter-turns about Y
  const th = -rot * Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
  const px = Math.round(_n.x * c + _n.z * s), pz = Math.round(-_n.x * s + _n.z * c), py = _n.y;
  const idx = px > 0 ? 0 : px < 0 ? 1 : py > 0 ? 2 : py < 0 ? 3 : pz > 0 ? 4 : 5;
  return { idx, n: _n.clone(), half: [hx, hy, hz] };
}

/* per frame while paint is on. returns true if hovering a part */
export function paintHover(m, ray, shift){
  PAINT.hover = null; hideHelpers();
  if(!m || !m.group) return false;
  const hits = ray.intersectObjects(m.group.children, true).filter(h => h.object.isMesh);
  let o = hits.length ? hits[0].object : null;
  while(o && !o.userData.cellKey) o = o.parent;
  if(!o){ if(PAINT.dec) { PAINT._pv.visible = false; } return false; }
  const k = o.userData.cellKey, p = m.parts.get(k); if(!p) return false;
  const face = faceOf(o, hits[0], p.type, p.rot);
  PAINT.hover = { m, k, p, face, point: hits[0].point.clone(), wrap: o };
  if(PAINT.tool === 'decal' && PAINT.dec){
    // preview rides the hit point, flat on the machine's plane
    PAINT._pv.visible = true;
    PAINT._pv.position.copy(hits[0].point).add(_w.set(0, 0.03, 0).applyQuaternion(m.quat));
    PAINT._pv.quaternion.copy(m.quat);
    PAINT._pvSpin.rotation.y = PAINT.dec.a * Math.PI / 4;
    refreshPreview(false);
    if(PAINT.down) {}     // stamping is click-only
    return true;
  }
  const [fw, fd] = fpOf(p.type);
  o.updateMatrixWorld();
  if(shift){
    PAINT._fq.visible = true;
    const [hx, hy, hz] = face.half;
    _w.copy(face.n).multiply(_lp.set(hx + 0.01, hy + 0.01, hz + 0.01));
    PAINT._fq.position.copy(o.localToWorld(_w.clone()));
    PAINT._fq.quaternion.copy(m.quat);
    const sx = face.n.x ? fd * CELLXZ : fw * CELLXZ, sy = face.n.y ? fd * CELLXZ : CELLY;
    PAINT._fq.scale.set(sx, sy, 1);
    // orient the quad to the face normal (in machine frame)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), face.n);
    PAINT._fq.quaternion.copy(m.quat).multiply(q);
  } else {
    PAINT._hl.visible = true;
    PAINT._hl.position.copy(o.localToWorld(_w.set(0, 0, 0)));
    PAINT._hl.quaternion.copy(m.quat);
    PAINT._hl.scale.set(fw * CELLXZ + 0.02, CELLY + 0.02, fd * CELLXZ + 0.02);
    if(PAINT.down && !shift) brush(m, k, p, false);   // spray
  }
  return true;
}

function brush(m, k, p, faceOnly){
  const h = PAINT.hex;
  let changed = false;
  if(faceOnly && PAINT.hover){
    const i = PAINT.hover.face.idx;
    if(h == null){ if(p.f){ delete p.f; changed = true; } }
    else { if(!p.f) p.f = [null, null, null, null, null, null]; if(p.f[i] !== h){ p.f[i] = h; changed = true; } }
  } else {
    if(h == null){ if(p.c != null || p.f){ delete p.c; delete p.f; changed = true; } }
    else if(p.c !== h || p.f){ p.c = h; delete p.f; changed = true; }
  }
  if(changed) reskin(m, k);
}
function reskin(m, k){
  const p = m.parts.get(k);
  const mesh = m.group.children.find(c => c.userData.cellKey === k);
  if(mesh && p) applySkin(mesh, p);
  PAINT.dirty.add(m.id);
}

/* click */
export function paintDown(m, shift){
  PAINT.down = true;
  const hv = PAINT.hover; if(!hv || hv.m !== m) return;
  if(PAINT.tool === 'decal' && PAINT.dec) stampDecal(m, hv.point, PAINT.dec);
  else brush(m, hv.k, hv.p, !!shift);
}
export function paintUp(){ PAINT.down = false; }

/* X: strip paint on the hovered part, or pop the last decal under the cursor */
export function paintStrip(m){
  const hv = PAINT.hover; if(!hv || hv.m !== m) return false;
  const p = hv.p; let changed = false;
  if(p.d && p.d.length){ p.d.pop(); if(!p.d.length) delete p.d; changed = true; }
  else if(p.c != null || p.f){ delete p.c; delete p.f; changed = true; }
  if(changed) reskin(m, hv.k);
  return changed;
}

/* stamp a decal at a world point: every exposed top face it overlaps gets its piece */
export function stampDecal(m, worldPt, dec, opts = { mirror: false }){
  const ml = m.group.worldToLocal(worldPt.clone()).add(m.center);      // grid-local (cell centres at i·CELLXZ)
  const s = dec.s;
  let n = 0;
  for(const [k, p] of m.parts){
    const [x, y, z] = k.split(',').map(Number);
    const [fw, fd] = fpOf(p.type);
    // exposed from above?
    let exposed = true;
    for(const [cx, cy, cz] of cellsOf(x, y, z, p.type)) if(m.occ.has(key(cx, cy + 1, cz))){ exposed = false; break; }
    if(!exposed) continue;
    const c = localCenterOf(x, y, z, p.type);
    const dx = ml.x - c.x, dz = ml.z - c.z;
    if(Math.abs(dx) > fw * CELLXZ / 2 + s * 0.71 || Math.abs(dz) > fd * CELLXZ / 2 + s * 0.71) continue;
    if(Math.abs(ml.y - c.y) > CELLY * 1.5) continue;
    // into the part's own frame (undo rot), then canvas fractions (canvas right = -x, canvas down = -z)
    const th = p.rot * Math.PI / 2, co = Math.cos(th), si = Math.sin(th);
    const px = dx * co - dz * si, pz = dx * si + dz * co;
    const entry = { t: dec.t, k: dec.k, x: +(0.5 - px / (fw * CELLXZ)).toFixed(3), y: +(0.5 - pz / (fd * CELLXZ)).toFixed(3), s: +s.toFixed(3), a: (dec.a - 2 * p.rot) & 7, c: dec.c };
    if(dec.t === 'txt') entry.f = dec.f || 0;
    (p.d || (p.d = [])).push(entry);
    reskin(m, k); n++;
  }
  return n;
}
