/* =============================================================================
   garage.js — THE GARAGE: where you go when you press B. A concrete floor with
   four build pads (one per player) — each pad is an AERO TUNNEL: air streams
   front→back over your machine while you build, bends around your blocks, gets
   sucked into breathing intakes/fans, and a live readout paints mass / drag /
   cross-section / front-rear balance / layers. Around it: a small all-terrain
   TEST LOOP (asphalt with a bump → gravel → sand → grass with a puddle), timed
   like any track. A pad takes you back to the paddock; the paddock has a pad here.
   ============================================================================= */
import { PAL, hex, shade, tint, rgba } from './palette.js';
import { box, disc, rrect, blob, label, shadow } from './draw.js';
import { SURF, paintSurface, catmull } from './tracks.js';
import { pat } from './tiles.js';
import { worldToLocal, localToWorld, topAt } from './machine.js';
import { CELL, keyOf, parseKey, PARTS, facingDir } from './parts.js';

export const GARAGE = {
  x: -330, y: 420,
  zone: { x0: -420, y0: 345, x1: -240, y1: 495 },
  floor: { x: -330, y: 420, w: 70, d: 30 },
  pads: [],            // {x,y,w,d}
  loop: null, segs: [],
  bump: [],
  puddle: { x: -388, y: 447, r: 3.2 },
  exit: { x: -330, y: 452 },
  flow: [], spawnT: 0,
};
for(let i = 0; i < 4; i++) GARAGE.pads.push({ x: -351 + i * 14, y: 420, w: 10, d: 16 });
const LOOP_PTS = [[-395, 420], [-388, 390], [-365, 372], [-330, 366], [-295, 372], [-272, 390], [-265, 420], [-272, 450], [-295, 468], [-330, 474], [-365, 468], [-388, 450]];
const SEGS = [[0, 0.33, 'asphalt'], [0.33, 0.58, 'gravel'], [0.58, 0.83, 'sand'], [0.83, 1, 'grass']];
export const LOOP_W = 9;

export function inGarage(x, y){ const z = GARAGE.zone; return x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1; }
export function padOf(m){ return GARAGE.pads.find(p => Math.abs(m.x - p.x) < p.w / 2 + 1 && Math.abs(m.y - p.y) < p.d / 2 + 1) || null; }

export function buildGarage(W, { wall }){
  const F = GARAGE.floor;
  // floor + pads are asphalt-grip concrete
  const pts = []; for(let px = F.x - F.w / 2; px <= F.x + F.w / 2; px += 3) for(let py = F.y - F.d / 2; py <= F.y + F.d / 2; py += 3) pts.push({ x: px, y: py }); paintSurface(W, pts, 2, SURF.asphalt);
  // the test loop: sampled, split into surface segments, painted
  const s = catmull(LOOP_PTS, true); GARAGE.loop = s;
  const n = s.pts.length;
  GARAGE.segs = SEGS.map(([a, b, surf]) => ({ from: Math.floor(a * n), to: Math.min(n, Math.ceil(b * n) + 1), surf }));
  for(const sg of GARAGE.segs){ if(sg.surf === 'grass') continue; paintSurface(W, s.pts.slice(sg.from, sg.to), LOOP_W, SURF[sg.surf]); }
  { const P = GARAGE.puddle, pp = []; for(let a = 0; a < 6.3; a += 0.5) for(let r = 0; r <= P.r - 1; r += 1.5) pp.push({ x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r }); paintSurface(W, pp, 2, SURF.water); }
  // a bump on the top straight (two wedges back to back)
  GARAGE.bump = [{ x: -349, y: 369, w: 6, d: 10, h: 1.0, dir: 1 }, { x: -343, y: 369, w: 6, d: 10, h: 1.0, dir: 3 }];
  W.ramps.push(...GARAGE.bump);
  // timed like a track
  const cps = []; for(let k = 0; k < 4; k++){ const p = s.pts[Math.round(k * n / 4) % n]; cps.push({ x: p.x, y: p.y, r: LOOP_W / 2 + 4 }); }
  const p0 = s.pts[0], p1 = s.pts[1]; const a0 = Math.atan2(p1.x - p0.x, -(p1.y - p0.y));
  W.tracks.push({ id: 'testloop', name: 'TEST LOOP', color: PAL.stand, closed: true, cps, start: { x: p0.x, y: p0.y, a: a0 }, length: s.L, type: 'test' });
  // hub pseudo-tracks (no laps): the paddock + the garage
  W.tracks.push({ id: 'home', name: 'PADDOCK', color: PAL.blueDark, closed: false, cps: [], start: { x: W.spawn.x, y: W.spawn.y, a: 0 }, length: 0, type: 'hub' });
  W.tracks.push({ id: 'garage', name: 'GARAGE', color: PAL.ink, closed: false, cps: [], start: { x: GARAGE.x, y: GARAGE.y + 12, a: 0 }, length: 0, type: 'hub' });
  W.pads.push({ x: GARAGE.exit.x, y: GARAGE.exit.y, r: 2.6, track: 'home', name: 'PADDOCK', color: PAL.blueDark });
  W.pads.push({ x: 35, y: -200, r: 2.6, track: 'garage', name: 'GARAGE', color: PAL.ink });
  // cones marking the grass leg
  const g = GARAGE.segs[3]; W.cones = W.cones || [];
  for(let i = g.from; i < g.to; i += 6){ const p = s.pts[i], q = s.pts[(i + 1) % n]; const tx = q.x - p.x, ty = q.y - p.y, L = Math.hypot(tx, ty) || 1; const nx = -ty / L, ny = tx / L; W.cones.push({ x: p.x + nx * LOOP_W / 2, y: p.y + ny * LOOP_W / 2 }, { x: p.x - nx * LOOP_W / 2, y: p.y - ny * LOOP_W / 2 }); }
  W.trees.push([-410, 360, 2.6], [-250, 362, 2.4], [-412, 480, 2.8], [-248, 482, 2.4], [-330, 340, 2.6], [-300, 342, 2.2]);
  W.bushes.push([-400, 400, 1.0], [-260, 440, 1.0], [-330, 494, 0.9], [-300, 492, 1.0], [-360, 490, 0.9]);
}

/* ---- drawing (under the machines) ----------------------------------------------- */
function strokePts(ctx, pts, width, style, cap = 'round', dash = null){
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for(let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.lineWidth = width; ctx.strokeStyle = typeof style === 'number' ? hex(style) : style; ctx.lineCap = cap; ctx.lineJoin = 'round'; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
}
export function drawGarage(ctx, view, zoom, t){
  const z = GARAGE.zone; if(view.x1 < z.x0 || view.x0 > z.x1 || view.y1 < z.y0 || view.y0 > z.y1) return;
  const s = GARAGE.loop, n = s.pts.length;
  // the loop: shoulder, then each surface leg
  const closedPts = [...s.pts, s.pts[0]];
  strokePts(ctx, closedPts, LOOP_W + 2.4, pat(ctx, 'shoulder', zoom));
  for(const sg of GARAGE.segs){
    const pts = s.pts.slice(sg.from, Math.min(n, sg.to + 1)); if(sg.to >= n) pts.push(s.pts[0]);
    if(sg.surf === 'grass'){ strokePts(ctx, pts, LOOP_W, pat(ctx, 'grass', zoom), 'butt'); strokePts(ctx, pts, LOOP_W, rgba(0xffffff, 0.55), 'butt', [1.5, 2.5]); continue; }
    if(sg.surf === 'asphalt') strokePts(ctx, pts, LOOP_W, PAL.edgeLine, 'butt');
    strokePts(ctx, pts, sg.surf === 'asphalt' ? LOOP_W - 0.5 : LOOP_W, pat(ctx, sg.surf, zoom), 'butt');
  }
  // puddle
  { const P = GARAGE.puddle; ctx.beginPath(); ctx.ellipse(P.x, P.y, P.r, P.r * 0.8, 0.3, 0, Math.PI * 2); ctx.fillStyle = pat(ctx, 'water', zoom); ctx.fill(); ctx.lineWidth = 0.25; ctx.strokeStyle = hex(PAL.waterDeep); ctx.stroke(); }
  // start line of the loop
  { const p = s.pts[0], q = s.pts[1]; const tx = q.x - p.x, ty = q.y - p.y, L = Math.hypot(tx, ty) || 1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(ty, tx)); const sq = LOOP_W / 6; for(let i = 0; i < 6; i++) for(let j = 0; j < 2; j++){ ctx.fillStyle = hex((i + j) % 2 ? PAL.checker : PAL.checkerDark); ctx.fillRect(-sq + j * sq, -LOOP_W / 2 + i * sq, sq, sq); } ctx.restore(); }
  // floor
  const F = GARAGE.floor;
  rrect(ctx, F.x - F.w / 2, F.y - F.d / 2, F.w, F.d, 1); ctx.fillStyle = pat(ctx, 'concrete', zoom); ctx.fill(); ctx.lineWidth = 0.35; ctx.strokeStyle = hex(shade(PAL.concrete, .75)); ctx.stroke();
  label(ctx, 'GARAGE', F.x, F.y - F.d / 2 - 2.2, 2.4, PAL.paper, { bg: PAL.ink, font: "Impact, 'Arial Black', sans-serif", weight: 900 });
  // the pads: aero tunnels (grille at the front, mesh at the back, arrows)
  GARAGE.pads.forEach((p, i) => {
    rrect(ctx, p.x - p.w / 2, p.y - p.d / 2, p.w, p.d, 0.5); blob(ctx, shade(PAL.concrete, .72), 0.12, shade(PAL.concrete, .55));
    rrect(ctx, p.x - p.w / 2 + 0.4, p.y - p.d / 2 + 0.4, p.w - 0.8, p.d - 0.8, 0.35); ctx.lineWidth = 0.08; ctx.strokeStyle = rgba(0xffffff, 0.25); ctx.stroke();
    // front grille (top) + back mesh (bottom)
    for(let k = 0; k < 8; k++){ box(ctx, p.x - p.w / 2 + 0.8 + k * ((p.w - 1.6) / 8), p.y - p.d / 2 + 0.6, (p.w - 1.6) / 8 - 0.2, 1.0, 0.1, PAL.ink, 0.03); }
    ctx.strokeStyle = rgba(PAL.ink, 0.6); ctx.lineWidth = 0.05; for(let k = 0; k < 6; k++){ ctx.beginPath(); ctx.moveTo(p.x - p.w / 2 + 0.8, p.y + p.d / 2 - 1.8 + k * 0.25); ctx.lineTo(p.x + p.w / 2 - 0.8, p.y + p.d / 2 - 1.8 + k * 0.25); ctx.stroke(); }
    ctx.fillStyle = rgba(0xffffff, 0.35); for(const sx of [-1, 1]) for(let k = 0; k < 3; k++){ const ax = p.x + sx * (p.w / 2 - 0.5), ay = p.y - 3 + k * 3; ctx.beginPath(); ctx.moveTo(ax - 0.3, ay - 0.4); ctx.lineTo(ax, ay); ctx.lineTo(ax + 0.3, ay - 0.4); ctx.lineTo(ax, ay + 0.2); ctx.closePath(); ctx.fill(); }
    label(ctx, 'AERO TUNNEL ' + (i + 1), p.x, p.y - p.d / 2 - 1.1, 0.7, PAL.paper, { bg: PAL.ink });
  });
}

/* ---- the air: particles that stream over the machine on its pad ------------------- */
export function stepFlow(dt, m){
  const pad = padOf(m); const F = GARAGE.flow;
  if(!pad){ F.length = 0; return; }
  GARAGE.spawnT -= dt;
  while(GARAGE.spawnT <= 0 && F.length < 90){ GARAGE.spawnT += 0.03; F.push({ x: pad.x - pad.w / 2 + 0.6 + Math.random() * (pad.w - 1.2), y: pad.y - pad.d / 2 + 1.8, vx: 0, vy: 7 + Math.random() * 2, trail: [], life: 1, suck: false }); }
  const L = {};
  for(let i = F.length - 1; i >= 0; i--){
    const p = F[i];
    if(p.suck){ p.life -= dt * 4; if(p.life <= 0) F.splice(i, 1); continue; }
    p.trail.push(p.x, p.y); if(p.trail.length > 16) p.trail.splice(0, 2);
    // look ahead into the machine's grid
    worldToLocal(m, p.x, p.y + 0.35, L);
    const ci = Math.round(L.x / CELL), cj = Math.round(L.y / CELL);
    const top = topAt(m, ci, cj);
    if(top >= 0){
      const ak = m.occ.get(keyOf(ci, cj, top)); const part = m.parts.get(ak);
      const breathes = part && (part.type === 'intake' || part.type === 'fan') && part.rot === 0 && m.freeIntakes + m.freeFans > 0;
      if(breathes && Math.abs(L.y / CELL - (parseKey(ak)[1] - 0.5)) < 1.2){ p.suck = true; p.vx = p.vy = 0; continue; }
      // go around: away from the centre of mass, faster the taller the stack
      const side = L.x < m.com.x ? -1 : 1;
      p.vx += side * (26 + top * 10) * dt; p.vy = Math.max(2.5, p.vy - 20 * dt);
    } else { p.vx *= Math.pow(0.05, dt); p.vy += (8 - p.vy) * Math.min(1, dt * 3); }
    // wings push the air down (drawn as a little dip): nothing physical here, just vibes
    p.x += p.vx * dt; p.y += p.vy * dt;
    if(p.y > pad.y + pad.d / 2 - 1.2 || p.x < pad.x - pad.w / 2 + 0.3 || p.x > pad.x + pad.w / 2 - 0.3) F.splice(i, 1);
  }
}
export function drawFlow(ctx){
  ctx.lineWidth = 0.07; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for(const p of GARAGE.flow){
    if(p.trail.length < 4) continue;
    ctx.strokeStyle = rgba(p.suck ? PAL.intake : 0xffffff, p.suck ? 0.9 * p.life : 0.55);
    ctx.beginPath(); ctx.moveTo(p.trail[0], p.trail[1]); for(let k = 2; k < p.trail.length; k += 2) ctx.lineTo(p.trail[k], p.trail[k + 1]); ctx.lineTo(p.x, p.y); ctx.stroke();
    if(p.suck){ ctx.beginPath(); ctx.arc(p.x, p.y, 0.25 * (1 - p.life) + 0.08, 0, 7); ctx.fillStyle = rgba(PAL.intake, 0.6 * p.life); ctx.fill(); }
  }
}
/* the readout painted on the pad's footer */
export function drawReadout(ctx, m){
  const pad = padOf(m); if(!pad) return;
  const lines = [
    'MASS ' + m.mass.toFixed(1) + '  ·  LAYERS ' + m.layers + (m.highWheels ? '  ·  ' + m.highWheels + ' wheel' + (m.highWheels > 1 ? 's' : '') + ' off the ground!' : ''),
    'DRAG ' + m.cd.toFixed(3) + '  ·  X-SECTION ' + m.frontal + ' cells' + (m.wings ? '  ·  WINGS ' + m.wings : ''),
    'WEIGHT F/R ' + Math.round(m.balanceF * 100) + ' / ' + Math.round((1 - m.balanceF) * 100) + (m.freeIntakes < m.engines ? '  ·  an engine can\'t breathe' : ''),
  ];
  lines.forEach((tx, i) => label(ctx, tx, pad.x, pad.y + 3.4 + i * 0.95, 0.56, PAL.paper, { bg: i === 2 && m.freeIntakes < m.engines ? PAL.redDark : PAL.ink }));
}
