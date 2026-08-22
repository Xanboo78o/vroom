/* =============================================================================
   gadgets.js — the stuff gadgets leave in the WORLD: oil slicks + banana peels
   (grip × 0.2 / 0.15, fade), caltrops (puncture a wheel: flat till Q / pit),
   smoke clouds (hide you on everyone else's screen), tow ropes (springs between
   a hook and another machine). Room toggle: off = pure racing (main.js gates it).
   ============================================================================= */
import { PAL, hex, rgba } from './palette.js';
import { cellWorld, TUNE } from './machine.js';

export const GAD = { puddles: [], caltrops: [], clouds: [], ropes: new Map() };
export function addPuddle(d){ GAD.puddles.push({ ...d, t: d.t ?? (d.kind === 'peel' ? 40 : 25) }); }
export function addCaltrop(d){ if(!GAD.caltrops.some(c => c.id === d.id)) GAD.caltrops.push({ ...d }); }
export function popCaltrop(id){ const i = GAD.caltrops.findIndex(c => c.id === id); if(i >= 0) GAD.caltrops.splice(i, 1); }
export function addCloud(d){ GAD.clouds.push({ ...d, t0: d.t ?? 5, t: d.t ?? 5, r0: d.r }); }
export function slipAt(x, y){ let k = 1; for(const p of GAD.puddles){ const dx = x - p.x, dy = y - p.y; if(dx * dx + dy * dy < p.r * p.r) k = Math.min(k, p.kind === 'peel' ? 0.15 : 0.2); } return k; }

export function stepGadgets(dt, machines, simMine, onFlat){
  for(let i = GAD.puddles.length - 1; i >= 0; i--){ const p = GAD.puddles[i]; p.t -= dt; if(p.t <= 0) GAD.puddles.splice(i, 1); }
  for(let i = GAD.clouds.length - 1; i >= 0; i--){ const c = GAD.clouds[i]; c.t -= dt; c.x += c.vx * dt; c.y += c.vy * dt; c.r = c.r0 * (1 + (1 - c.t / c.t0) * 1.4); if(c.t <= 0) GAD.clouds.splice(i, 1); }
  // caltrops puncture the wheels of machines I simulate
  if(GAD.caltrops.length) for(const m of machines.values()){
    if(!simMine(m) || m.air || !m.parts.size) continue;
    for(const wh of m.wheels){
      if(wh.p.flat) continue;
      const W = cellWorld(m, wh.k);
      for(let i = GAD.caltrops.length - 1; i >= 0; i--){ const c = GAD.caltrops[i]; if(Math.hypot(W.x - c.x, W.y - c.y) < 0.6){ wh.p.flat = true; wh.flat = true; GAD.caltrops.splice(i, 1); if(onFlat) onFlat(m, wh, c); break; } }
    }
  }
}
export function drawPuddles(ctx){
  for(const p of GAD.puddles){
    const a = Math.min(1, p.t / 4);
    if(p.kind === 'peel'){
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.id.length * 0.7); ctx.globalAlpha = a;
      ctx.beginPath(); ctx.moveTo(-0.5, 0); ctx.quadraticCurveTo(0, 0.7, 0.55, -0.2); ctx.quadraticCurveTo(0.1, 0.25, -0.4, -0.35); ctx.closePath();
      ctx.fillStyle = hex(PAL.banana); ctx.fill(); ctx.lineWidth = 0.05; ctx.strokeStyle = hex(PAL.bananaDark); ctx.stroke(); ctx.restore(); continue;
    }
    ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.75, 0.4, 0, 7); ctx.fillStyle = rgba(PAL.oil, 0.75 * a); ctx.fill();
    ctx.beginPath(); ctx.ellipse(p.x - p.r * 0.25, p.y - p.r * 0.2, p.r * 0.3, p.r * 0.12, 0.4, 0, 7); ctx.fillStyle = rgba(0x9fdcf7, 0.35 * a); ctx.fill();
  }
  for(const c of GAD.caltrops){
    ctx.save(); ctx.translate(c.x, c.y); ctx.strokeStyle = hex(PAL.caltrop); ctx.lineWidth = 0.06; ctx.lineCap = 'round';
    for(let i = 0; i < 4; i++){ const a = i * Math.PI / 2 + 0.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 0.28, Math.sin(a) * 0.28); ctx.stroke(); }
    ctx.restore();
  }
}
/* clouds: thick for everyone else, see-through for whoever made them */
export function drawClouds(ctx, me){
  for(const c of GAD.clouds){
    const a = Math.min(1, c.t / 1.2) * (c.owner === me ? 0.3 : 0.93);
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fillStyle = rgba(PAL.smoke, a); ctx.fill();
    ctx.beginPath(); ctx.arc(c.x - c.r * .3, c.y - c.r * .25, c.r * .5, 0, 7); ctx.fillStyle = rgba(0xfafaf5, a * 0.6); ctx.fill();
  }
}
/* ropes: {id, from: mid, k (hook key), to: mid, len} — each client pulls the machines IT simulates */
export function stepRopes(dt, machines, simMine){
  for(const r of GAD.ropes.values()){
    const A = machines.get(r.from), B = machines.get(r.to);
    if(!A || !B || !A.parts.size || !B.parts.size || !A.parts.has(r.k)){ GAD.ropes.delete(r.id); continue; }
    const a = cellWorld(A, r.k), b = { x: B.x, y: B.y };
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if(d <= r.len || d < 1e-3) continue;
    const nx = dx / d, ny = dy / d, stretch = Math.min(3, d - r.len);
    if(simMine(A)) pull(A, a, nx, ny, stretch, dt);
    if(simMine(B)) pull(B, b, -nx, -ny, stretch, dt);
  }
}
function pull(m, at, nx, ny, stretch, dt){
  let F = stretch * TUNE.ropeK * m.mass;
  const vn = m.vx * nx + m.vy * ny; if(vn < 0) F += -vn * m.mass * 2.5;   // damp moving away
  const fx = nx * F, fy = ny * F, rx = at.x - m.x, ry = at.y - m.y;
  m.vx += fx * dt / m.mass; m.vy += fy * dt / m.mass; m.w += (rx * fy - ry * fx) * m.invI * dt * 0.5;
}
export function drawRopes(ctx, machines){
  for(const r of GAD.ropes.values()){
    const A = machines.get(r.from), B = machines.get(r.to); if(!A || !B || !A.parts.has(r.k)) continue;
    const a = cellWorld(A, r.k); const d = Math.hypot(B.x - a.x, B.y - a.y); const sag = Math.max(0, r.len - d) * 0.25;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + B.x) / 2, (a.y + B.y) / 2 + sag, B.x, B.y);
    ctx.lineWidth = 0.09; ctx.strokeStyle = hex(PAL.rope); ctx.lineCap = 'round'; ctx.stroke();
    ctx.lineWidth = 0.03; ctx.strokeStyle = rgba(0x6b4e33, 0.6); ctx.stroke();
  }
}
