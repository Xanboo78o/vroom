/* =============================================================================
   draw.js — canvas helpers in WORLD units (the ctx is already scaled by zoom)
   + the little particle system (puffs, dust, sparks). Flat fills, darker-shade
   outlines, round joins everywhere: that's the cute.
   ============================================================================= */
import { PAL, hex, shade, rgba } from './palette.js';
import { raster } from './art.js';

export function rrect(ctx, x, y, w, h, r){
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}
/* fill + outline in a darker shade. lw in world units. */
export function blob(ctx, fillHex, lw = 0.06, strokeHex = null){
  ctx.fillStyle = hex(fillHex); ctx.fill();
  if(lw > 0){ ctx.lineWidth = lw; ctx.strokeStyle = hex(strokeHex == null ? shade(fillHex) : strokeHex); ctx.lineJoin = 'round'; ctx.stroke(); }
}
export function box(ctx, x, y, w, h, r, fillHex, lw = 0.06){ rrect(ctx, x, y, w, h, r); blob(ctx, fillHex, lw); }
export function disc(ctx, x, y, r, fillHex, lw = 0.06){ ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); blob(ctx, fillHex, lw); }

/* Adam's art, fitted inside a w×h box centred on the origin (caller translated/rotated).
   zoom = px per unit (to pick the raster bucket). Returns false when there's no art. */
export function art(ctx, key, w, h, zoom, alpha = 1){
  const px = Math.max(w, h) * zoom;
  const cv = raster(key, Math.max(8, px));
  if(!cv) return false;
  const ar = cv.width / cv.height;
  let dw = w, dh = h;
  if(ar > w / h) dh = w / ar; else dw = h * ar;
  if(alpha < 1){ ctx.save(); ctx.globalAlpha *= alpha; }
  ctx.drawImage(cv, -dw / 2, -dh / 2, dw, dh);
  if(alpha < 1) ctx.restore();
  return true;
}

/* the one light in the world: a soft sun from the top-left. Everything shades the same way. */
export const LIGHT = { dx: 0.16, dy: 0.2 };   // a shadow falls just this far (×object size)
/* soft contact shadow: a tight radial fade hugging the object's base — it reads as SITTING on the
   ground, giving figure-ground pop, instead of a hard grey smudge floating beside it. */
export function shadow(ctx, x, y, rx, ry, a = 0.24){
  const ox = x + LIGHT.dx * ry, oy = y + LIGHT.dy * ry;
  const R = Math.max(rx, ry, 0.001);
  const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, R);
  g.addColorStop(0, rgba(PAL.shadow, a));
  g.addColorStop(0.5, rgba(PAL.shadow, a * 0.55));
  g.addColorStop(1, rgba(PAL.shadow, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

/* text in world units (font scales with zoom), optional pill background */
export function label(ctx, text, x, y, size, colorHex = PAL.text, opts = {}){
  ctx.save();
  ctx.translate(x, y);
  if(opts.rot) ctx.rotate(opts.rot);
  ctx.font = `${opts.weight || 800} ${size}px ${opts.font || "'Trebuchet MS', system-ui, sans-serif"}`;
  ctx.textAlign = opts.align || 'center'; ctx.textBaseline = 'middle';
  if(opts.bg != null){
    const w = ctx.measureText(text).width + size * 0.9, h = size * 1.5;
    rrect(ctx, -w / 2, -h / 2, w, h, h / 2); blob(ctx, opts.bg, size * 0.08);
  }
  ctx.fillStyle = hex(colorHex);
  ctx.fillText(text, 0, size * 0.06);
  ctx.restore();
}

/* ---- particles ------------------------------------------------------------- */
export const FX = { list: [] };
export function puff(x, y, { vx = 0, vy = 0, r = 0.25, grow = 0.6, life = 0.6, color = 0xffffff, alpha = 0.55, z = 0, gravity = 0, vz = 0 } = {}){
  if(FX.list.length > 400) FX.list.shift();
  FX.list.push({ x, y, vx, vy, r, grow, life, max: life, color, alpha, z, vz, gravity });
}
export function burst(x, y, n, color, speed = 4, r = 0.12){
  for(let i = 0; i < n; i++){
    const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
    puff(x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, r, grow: 0.05, life: 0.35 + Math.random() * 0.3, color, alpha: 0.9, vz: 3 + Math.random() * 4, gravity: 22 });
  }
}
export function stepFX(dt){
  const L = FX.list;
  for(let i = L.length - 1; i >= 0; i--){
    const p = L[i];
    p.life -= dt; if(p.life <= 0){ L.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
    p.r += p.grow * dt;
    if(p.gravity){ p.vz -= p.gravity * dt; p.z = Math.max(0, p.z + p.vz * dt); }
  }
}
export function drawFX(ctx){
  for(const p of FX.list){
    const k = p.life / p.max;
    ctx.beginPath(); ctx.arc(p.x, p.y - p.z * 0.5, p.r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(p.color, p.alpha * k); ctx.fill();
  }
}
