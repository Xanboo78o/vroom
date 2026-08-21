/* =============================================================================
   skin.js — paint + decals on parts (livery v1).
   A part record is { type, rot, c?, f?, d? }:
     c = whole-block colour (hex)           f = 6 face colours [+x,-x,+y,-y,+z,-z] (hex|null)
     d = decals on the TOP face [{ t:'txt'|'shape'|'logo', k, x, y, s, a, c, f }]
         x,y = centre on the top face as fractions (canvas right / canvas down, part's own
         frame, may exceed 0..1 when a decal spans neighbours); s = height in world units;
         a = eighth-turns; c = colour; f = font index (txt).
   applySkin() swaps CACHED materials by reference (never mutates .color), and draws the
   decals of one part into one CanvasTexture quad on its top face. Canvas up = machine
   forward (+z), canvas right = machine -x — the same convention as Adam's SVG top faces.
   ============================================================================= */
import * as THREE from 'three';
import { PARTS, mat, lineMat, shade, fpOf, CELLXZ } from './parts.js';
import { PAL, hex } from './palette.js';

export const FONTS = ["'Trebuchet MS', 'Comic Sans MS', system-ui, sans-serif", "Impact, 'Arial Black', sans-serif", "'Courier New', monospace"];
export const SHAPES = ['stripe', 'dstripe', 'chev', 'circle', 'ring', 'star', 'flame', 'tri'];
export const LOGOS = ['bread', 'dillons', 'coral', 'plowval', 'kr'];
const SKIN_KEYS = ['c', 'f', 'd'];
const PPU = 128 / CELLXZ;                 // canvas pixels per world unit

export function skinOf(p){
  const o = {};
  if(p.c != null) o.c = p.c;
  if(p.f) o.f = p.f.slice();
  if(p.d && p.d.length) o.d = p.d.map(d => ({ ...d }));
  return Object.keys(o).length ? o : undefined;
}
export function copyPart(src){
  const p = { type: src.type, rot: src.rot | 0 };
  const s = skinOf(src); if(s) Object.assign(p, s);
  return p;
}
export function hasSkin(p){ return SKIN_KEYS.some(k => p[k] != null && (k !== 'd' || p.d.length)); }

/* paint + decals onto a built part mesh (the wrap returned by buildPartMesh) — idempotent */
export function applySkin(wrap, p){
  const def = PARTS[p.type]; if(!def) return;
  const base = def.color;
  const colour = p.c ?? base;
  wrap.traverse(o => {
    if(o.userData.hex !== base) return;
    if(o.isLineSegments){ o.material = lineMat(shade(colour, .72)); return; }
    if(!o.isMesh) return;
    if(p.f && o.geometry.type === 'BoxGeometry') o.material = p.f.map(h => mat(h ?? colour));
    else o.material = mat(colour);
  });
  // decals: one canvas quad on the top face
  const inner = wrap.children[0];
  const old = inner && inner.getObjectByName('decal');
  if(old){ inner.remove(old); if(old.material.map) old.material.map.dispose(); old.material.dispose(); old.geometry.dispose(); }
  if(!inner || !p.d || !p.d.length) return;
  const [fw, fd] = fpOf(p.type);
  const W = fw * 128, H = fd * 128;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  for(const d of p.d) drawDecal(ctx, d, W, H);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const box = new THREE.Box3().setFromObject(inner);
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(fw * CELLXZ * 0.985, fd * CELLXZ * 0.985),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  quad.name = 'decal'; quad.renderOrder = 1;
  // inner is rotated by rot; the decal lives in the part's own frame, so undo nothing: same rotation as the art quad
  quad.rotation.set(-Math.PI / 2, 0, Math.PI);
  const lp = inner.worldToLocal(new THREE.Vector3(0, box.max.y, 0)); // box is world-ish (wrap at origin when built) — fall back
  quad.position.y = (isFinite(lp.y) ? lp.y : box.max.y) + 0.018;
  inner.add(quad);
}

export function disposeSkin(wrap){
  const inner = wrap && wrap.children[0];
  const old = inner && inner.getObjectByName('decal');
  if(old){ inner.remove(old); if(old.material.map) old.material.map.dispose(); old.material.dispose(); old.geometry.dispose(); }
}

/* ---- drawing ----------------------------------------------------------------- */
export function drawDecal(ctx, d, W, H){
  const px = d.s * PPU;                       // decal height in px
  const cx = d.x * W, cy = d.y * H;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-(d.a || 0) * Math.PI / 4);      // eighth-turns, counter-clockwise on the canvas
  const c = hex(d.c ?? PAL.red), e = hex(shade(d.c ?? PAL.red, .7));
  if(d.t === 'txt') drawText(ctx, String(d.k || '?'), px, c, e, FONTS[d.f || 0]);
  else if(d.t === 'shape') drawShape(ctx, d.k, px, c, e);
  else if(d.t === 'logo') drawLogo(ctx, d.k, px, c);
  ctx.restore();
}
function drawText(ctx, txt, px, c, e, font){
  ctx.font = `bold ${px}px ${font}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1, px * 0.09); ctx.strokeStyle = e;
  ctx.strokeText(txt, 0, 0);
  ctx.fillStyle = c; ctx.fillText(txt, 0, 0);
}
function drawShape(ctx, k, px, c, e){
  const h = px / 2;
  ctx.fillStyle = c; ctx.strokeStyle = e; ctx.lineWidth = Math.max(1, px * 0.06); ctx.lineJoin = 'round';
  ctx.beginPath();
  switch(k){
    case 'stripe': ctx.rect(-h * 0.35, -h, h * 0.7, px); break;
    case 'dstripe': ctx.rect(-h * 0.9, -h, h * 0.5, px); ctx.rect(h * 0.4, -h, h * 0.5, px); break;
    case 'chev': ctx.moveTo(-h, h); ctx.lineTo(0, -h); ctx.lineTo(h, h); ctx.lineTo(h * 0.45, h); ctx.lineTo(0, -h * 0.2); ctx.lineTo(-h * 0.45, h); ctx.closePath(); break;
    case 'circle': ctx.arc(0, 0, h, 0, Math.PI * 2); break;
    case 'ring': ctx.arc(0, 0, h, 0, Math.PI * 2); ctx.arc(0, 0, h * 0.62, 0, Math.PI * 2, true); break;
    case 'star': for(let i = 0; i < 10; i++){ const r = i % 2 ? h * 0.45 : h; const a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); break;
    case 'flame': ctx.moveTo(0, -h); ctx.bezierCurveTo(h * 0.9, -h * 0.3, h * 0.7, h * 0.6, 0, h); ctx.bezierCurveTo(-h * 0.7, h * 0.6, -h * 0.9, -h * 0.3, 0, -h); ctx.moveTo(0, -h * 0.3); ctx.bezierCurveTo(h * 0.35, 0, h * 0.3, h * 0.5, 0, h * 0.55); ctx.bezierCurveTo(-h * 0.3, h * 0.5, -h * 0.35, 0, 0, -h * 0.3); break;
    case 'tri': ctx.moveTo(0, -h); ctx.lineTo(h, h); ctx.lineTo(-h, h); ctx.closePath(); break;
    default: ctx.rect(-h, -h, px, px);
  }
  ctx.fill('evenodd'); ctx.stroke();
}
function badge(ctx, w, h, bg, fg, txt, font = FONTS[0], fs = h * 0.55){
  ctx.fillStyle = hex(bg); ctx.strokeStyle = hex(shade(bg, .7)); ctx.lineWidth = Math.max(1, h * 0.08);
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.25); ctx.fill(); ctx.stroke();
  ctx.fillStyle = hex(fg); ctx.font = `bold ${fs}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(txt, 0, h * 0.04);
}
function drawLogo(ctx, k, px, c){
  switch(k){
    case 'bread': {   // a loaf + BREAD
      ctx.fillStyle = '#d9a35c'; ctx.strokeStyle = '#a8733a'; ctx.lineWidth = px * 0.05;
      ctx.beginPath(); ctx.roundRect(-px * 0.7, -px * 0.28, px * 1.4, px * 0.56, px * 0.22); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f3d9a6'; ctx.beginPath(); ctx.roundRect(-px * 0.55, -px * 0.12, px * 1.1, px * 0.22, px * 0.1); ctx.fill();
      ctx.fillStyle = '#6b4a24'; ctx.font = `bold ${px * 0.26}px ${FONTS[1]}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BREAD', 0, px * 0.02);
      break; }
    case 'dillons': badge(ctx, px * 1.8, px * 0.6, PAL.pad, PAL.text, "DILLON'S", FONTS[1], px * 0.36);
      ctx.fillStyle = hex(PAL.wheel); ctx.beginPath(); ctx.arc(px * 1.05, 0, px * 0.24, 0, 7); ctx.fill();
      ctx.fillStyle = hex(PAL.hub); ctx.beginPath(); ctx.arc(px * 1.05, 0, px * 0.1, 0, 7); ctx.fill(); break;
    case 'coral': {
      ctx.strokeStyle = hex(PAL.coral); ctx.lineWidth = px * 0.14; ctx.lineCap = 'round';
      for(const [a, l] of [[-0.9, 0.9], [-0.3, 1], [0.3, 0.95], [0.9, 0.85]]){ ctx.beginPath(); ctx.moveTo(0, px * 0.5); ctx.lineTo(Math.sin(a) * px * 0.5 * l, px * 0.5 - Math.cos(a) * px * 0.9 * l); ctx.stroke(); }
      ctx.strokeStyle = hex(PAL.coral2); ctx.lineWidth = px * 0.08; ctx.beginPath(); ctx.moveTo(0, px * 0.5); ctx.lineTo(0, -px * 0.45); ctx.stroke();
      break; }
    case 'plowval': badge(ctx, px * 2.0, px * 0.6, PAL.plow, PAL.paper, 'PLOWVAL', FONTS[1], px * 0.4); break;
    case 'kr': default: {
      ctx.font = `bold ${px}px ${FONTS[0]}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = px * 0.12; ctx.strokeStyle = hex(PAL.paper); ctx.strokeText('kRacing', 0, 0);
      ctx.fillStyle = hex(c ? PAL.red : PAL.red); ctx.fillText('kRacing', 0, 0);
      break; }
  }
}

/* small preview for tray buttons */
const ICON_CACHE = new Map();
export function decalIcon(d){
  const key = JSON.stringify(d);
  if(ICON_CACHE.has(key)) return ICON_CACHE.get(key);
  const cv = document.createElement('canvas'); cv.width = cv.height = 56;
  const ctx = cv.getContext('2d');
  const fit = { ...d, x: 0.5, y: 0.5, a: 0, s: (d.t === 'logo' ? 22 : d.t === 'txt' ? 30 : 36) / PPU };
  drawDecal(ctx, fit, 56, 56);
  const url = cv.toDataURL(); ICON_CACHE.set(key, url); return url;
}
