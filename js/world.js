/* =============================================================================
   world.js — ONE hand-authored map. No generation, ever.
   The home circuit (Paddock GP) with a pit lane, Kris's Corner (the plaza),
   a ramp/jump playground, Lake Tomathy, and the other tracks out in the world.
   Ground height h(x,y) is analytic: flat + hand-placed ramps. Drawn every
   frame in vector (crisp at any zoom); only what's in view.
   ============================================================================= */
import { PAL, hex, shade, tint, rgba } from './palette.js';
import { box, disc, rrect, blob, art, shadow, label } from './draw.js';
import { buildTracks, drawTracks, SURF, GRIP, paintSurface, TRK, paddockPoint, paddockLength } from './tracks.js';
import { buildCorner, drawCorner } from './corner.js';

export const WORLD = {
  size: 1000,       // half-extent; the map is 2 km across (1 u ≈ 1.4 m)
  ramps: [],        // {x,y,w,d,h,dir}  dir: 0=up(-y) climbs toward -y, 1=+x, 2=+y, 3=-x  (high edge = that side)
  walls: [],        // {x0,y0,x1,y1,h,hex,hidden}
  pits: [],         // {x,y,w,d} — refuel + repair zones
  spawn: { x: 0, y: 37 },
  parking: [],      // starter machine spots
  tracks: [],       // registered tracks {id,name,color,closed,cps,start,length,type}
  pads: [],         // teleport pads in Kris's Corner {x,y,r,track,name,color}
  surfGrid: null,   // surface id grid for grip (SURF in tracks.js)
  trees: [], bushes: [], rocks: [], cones: [], patches: [],
  lake: { x: -82, y: 52, r: 17 },
  pitLane: null,
};

export function h(x, y){
  let z = 0;
  for(const r of WORLD.ramps){
    const lx = x - r.x, ly = y - r.y;
    if(Math.abs(lx) <= r.w / 2 && Math.abs(ly) <= r.d / 2){
      const t = r.dir === 0 ? (.5 - ly / r.d) : r.dir === 2 ? (ly / r.d + .5) : r.dir === 1 ? (lx / r.w + .5) : (.5 - lx / r.w);
      z = Math.max(z, t * r.h);
    }
  }
  return z;
}
WORLD.h = h;
export function surfaceAt(x, y){
  const S = WORLD.surfGrid; if(!S) return SURF.grass;
  const i = Math.floor((x + WORLD.size) / S.cell), j = Math.floor((y + WORLD.size) / S.cell);
  if(i < 0 || j < 0 || i >= S.n || j >= S.n) return SURF.grass;
  return S.data[j * S.n + i];
}
export function gripAt(x, y){ return GRIP[surfaceAt(x, y)] ?? 1; }
WORLD.gripAt = gripAt; WORLD.surfaceAt = surfaceAt;
export function inPit(x, y){ return WORLD.pits.some(p => Math.abs(x - p.x) <= p.w / 2 && Math.abs(y - p.y) <= p.d / 2); }
export function wall(x, y, w, d, ht, hex = PAL.wall, hidden = false){
  WORLD.walls.push({ x0: x - w / 2, y0: y - d / 2, x1: x + w / 2, y1: y + d / 2, h: ht, hex, hidden });
}

/* ---- build everything (data only; drawing is below) ------------------------------ */
export function buildWorld(){
  { const cell = 4, n = Math.ceil(WORLD.size * 2 / cell); WORLD.surfGrid = { cell, n, data: new Uint8Array(n * n) }; }
  // grass patches (hand-placed darker rounds — vector shading)
  WORLD.patches = [[-60, 20, 34], [90, -30, 26], [-130, -180, 40], [40, 100, 30], [150, 60, 36], [-40, -70, 22], [120, -190, 30], [-170, 90, 28], [60, 150, 24]];
  // the tracks (Paddock GP first), pads in Kris's Corner, surface grid
  buildTracks(WORLD, { wall });
  // Paddock pit lane: alongside the top straight, north of it
  const pitY = TRK.cy - TRK.hy - 12;
  WORLD.pitLane = { x: 0, y: pitY, w: 90, d: 9 };
  paintSurface(WORLD, [{ x: -30, y: pitY }, { x: -15, y: pitY }, { x: 0, y: pitY }, { x: 15, y: pitY }, { x: 30, y: pitY }], 18, SURF.asphalt);
  for(const px of [-28, 0, 28]) WORLD.pits.push({ x: px, y: pitY, w: 12, d: 8 });
  wall(0, pitY - 6.5, 96, 1.2, 1.1, PAL.pitWall);   // pit back wall
  // plaza (sand) + parking spots
  { const pp = []; for(let a = 0; a < 6.3; a += 0.25) for(let r = 0; r <= 26; r += 6) pp.push({ x: Math.cos(a) * r, y: 40 + Math.sin(a) * r }); paintSurface(WORLD, pp, 8, SURF.sand); }
  WORLD.parking = [[-6, 28], [6, 28], [-11, 34], [11, 34], [-6, 41], [6, 41], [0, 43], [0, 26]].map(([x, y]) => ({ x, y }));
  // Lake Tomathy (you CAN drive in. you will regret it.)
  { const L = WORLD.lake, pp = []; for(let a = 0; a < 6.3; a += 0.2) for(let r = 0; r <= L.r - 2; r += 4) pp.push({ x: L.x + Math.cos(a) * r, y: L.y + Math.sin(a) * r }); paintSurface(WORLD, pp, 6, SURF.water); }
  // ramp playground — east side (dir 0 = climbs toward -y/up; high edge is the top)
  WORLD.ramps.push(
    { x: 120, y: 74, w: 16, d: 26, h: 5, dir: 0 },     // big launch ramp: drive UP (north), fly off the top…
    { x: 120, y: 30, w: 16, d: 26, h: 5, dir: 2 },     // …onto the landing ramp facing back (JUMP GAP between)
    { x: 82, y: 110, w: 12, d: 16, h: 2.4, dir: 0 },   // small kicker
    { x: 160, y: 110, w: 20, d: 20, h: 3.2, dir: 3 },  // side ramp
  );
  // cones down the plaza edge + a slalom by the kicker
  for(let i = 0; i < 7; i++) WORLD.cones.push({ x: -30 + i * 3.2, y: 80 });
  for(let i = 0; i < 5; i++) WORLD.cones.push({ x: 60 + (i % 2 ? 3 : -3), y: 96 + i * 6 });
  // trees / bushes / rocks — hand-placed, kept off the racing lines
  WORLD.trees = [[-40, 12, 2.6], [-46, 20, 2.2], [44, 14, 2.4], [50, 24, 2.0], [-60, 70, 2.8], [-52, 84, 2.2], [40, 70, 2.4], [48, 84, 2.8], [60, 60, 2.0],
    [-110, 20, 3.0], [-118, 36, 2.4], [-104, 78, 2.6], [-96, 90, 2.2], [100, 130, 2.6], [130, 134, 2.2], [184, 96, 2.8], [188, 120, 2.4],
    [-20, -40, 2.0], [20, -40, 2.2], [0, -90, 2.6], [-28, -130, 2.4], [30, -132, 2.8], [-60, -110, 2.2], [64, -112, 2.4],
    [-150, -60, 3.0], [-152, -160, 2.6], [150, -60, 2.8], [150, -160, 2.4], [0, -210, 3.0], [-70, -212, 2.4], [70, -212, 2.6],
    [-140, 120, 2.8], [-120, 140, 2.2], [200, 20, 2.6], [210, 50, 2.4], [230, -40, 2.8], [-230, 30, 2.4], [-220, -30, 2.8], [-210, 110, 2.4]];
  WORLD.bushes = [[-34, 22, 1.0], [36, 22, 1.1], [-24, 66, 0.9], [28, 64, 1.0], [-42, 58, 0.9], [46, 48, 1.0], [-12, 88, 1.1], [14, 90, 0.9], [-70, 34, 1.2], [-100, 60, 1.0],
    [-96, 40, 0.9], [74, 40, 1.0], [78, 54, 0.9], [100, 16, 1.1], [140, 16, 1.0], [96, 88, 1.0], [146, 92, 0.9], [30, -50, 0.9], [-30, -50, 1.0], [6, -104, 0.9], [-90, -80, 1.0], [92, -82, 1.0]];
  WORLD.rocks = [[-66, 40, 1.2], [-98, 66, 0.9], [-70, 64, 0.8], [168, 40, 1.1], [174, 68, 0.9], [58, 130, 0.8], [-36, -160, 1.0], [38, -162, 0.9]];
  // a little life on the plaza: flower beds + benches by the statue
  WORLD.beds = [[-8, 22, 1.4], [8, 22, 1.4], [-17, 50, 1.3], [17, 50, 1.3], [0, 60, 1.4], [-20, 26, 1.2], [20, 26, 1.2]];
  WORLD.benches = [[-13.5, 22], [13.5, 22]];
  for(const [bx, by] of WORLD.benches) wall(bx, by, 2.2, 0.7, 0.8, PAL.leather, true);
  // Kris's Corner furniture + hidden walls
  buildCorner(WORLD, { wall });
  // perimeter walls + an infield block
  const S = WORLD.size;
  wall(0, -S, 2 * S, 2, 2); wall(0, S, 2 * S, 2, 2); wall(-S, 0, 2, 2 * S, 2); wall(S, 0, 2, 2 * S, 2);
  wall(0, -110, 10, 10, 1.6, PAL.block);
  return WORLD;
}

/* ---- drawing ----------------------------------------------------------------------- */
const vis = (view, x, y, r) => x + r > view.x0 && x - r < view.x1 && y + r > view.y0 && y - r < view.y1;
function hash2(i, j){ let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; h = h ^ (h >> 16); return ((h >>> 0) % 1000) / 1000; }

/* everything UNDER the machines */
export function drawWorld(ctx, view, zoom, t){
  // grass
  ctx.fillStyle = hex(PAL.grass);
  ctx.fillRect(view.x0 - 2, view.y0 - 2, view.x1 - view.x0 + 4, view.y1 - view.y0 + 4);
  for(const [px, py, pr] of WORLD.patches) if(vis(view, px, py, pr)){ ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fillStyle = hex(PAL.grassDark); ctx.fill(); }
  // sprinkles: little tufts + flowers on the grass (decoration only, deterministic)
  if(zoom > 9){
    const C = 5, i0 = Math.floor(view.x0 / C), i1 = Math.ceil(view.x1 / C), j0 = Math.floor(view.y0 / C), j1 = Math.ceil(view.y1 / C);
    if((i1 - i0) * (j1 - j0) < 4000){
      for(let i = i0; i <= i1; i++) for(let j = j0; j <= j1; j++){
        const r = hash2(i, j); if(r > 0.42) continue;
        const x = i * C + hash2(i + 7, j) * C, y = j * C + hash2(i, j + 7) * C;
        if(surfaceAt(x, y) !== SURF.grass) continue;
        if(Math.hypot(x, y - 40) < 28) continue;
        if(r < 0.3){   // tuft: three tiny blades
          ctx.strokeStyle = hex(PAL.grassDark); ctx.lineWidth = 0.08; ctx.lineCap = 'round';
          ctx.beginPath(); for(const d of [-0.25, 0, 0.25]){ ctx.moveTo(x + d, y + 0.15); ctx.lineTo(x + d * 1.6, y - 0.3); } ctx.stroke();
        } else if(!artAt(ctx, 'props/flower', x, y, 0.7, 0.7, zoom)){
          disc(ctx, x, y, 0.2, r < 0.36 ? PAL.flowerP : PAL.flowerW, 0); disc(ctx, x, y, 0.08, PAL.flowerC, 0);
        }
      }
    }
  }
  // Lake Tomathy
  { const L = WORLD.lake; if(vis(view, L.x, L.y, L.r + 2)){
    ctx.beginPath(); for(let a = 0; a <= 12; a++){ const an = a / 12 * Math.PI * 2, rr = L.r * (1 + 0.08 * Math.sin(an * 3 + 1)); const px = L.x + Math.cos(an) * rr, py = L.y + Math.sin(an) * rr; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath(); blob(ctx, PAL.water, 0.3, shade(PAL.water, .88));
    ctx.beginPath(); ctx.ellipse(L.x - 3, L.y - 2, L.r * 0.45, L.r * 0.3, 0.4, 0, Math.PI * 2); ctx.fillStyle = hex(PAL.waterDeep); ctx.fill();
    for(let i = 0; i < 4; i++){ const wx = L.x - 8 + i * 5 + Math.sin(t * 0.8 + i) * 0.6, wy = L.y + 4 - i * 3; ctx.strokeStyle = hex(tint(PAL.water, .5)); ctx.lineWidth = 0.18; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(wx - 1, wy); ctx.quadraticCurveTo(wx, wy - 0.5, wx + 1, wy); ctx.stroke(); }
    label(ctx, 'Lake Tomathy', L.x, L.y + L.r + 1.6, 0.9, PAL.blueDark);
  } }
  // plaza (sand) + flower beds + benches
  if(vis(view, 0, 40, 28)){
    disc(ctx, 0, 40, 26, PAL.plaza, 0.3);
    for(const [bx, by, br] of WORLD.beds){
      disc(ctx, bx, by, br, PAL.grassDark, 0.08, shade(PAL.plaza, .85));
      for(let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2 + bx, rr = br * (0.35 + 0.3 * ((i * 7) % 3) / 2);
        const fx = bx + Math.cos(a) * rr, fy = by + Math.sin(a) * rr;
        disc(ctx, fx, fy, 0.22, [PAL.flowerP, PAL.flowerW, PAL.red, PAL.pad][i % 4], 0); disc(ctx, fx, fy, 0.09, PAL.flowerC, 0); }
    }
    for(const [bx, by] of WORLD.benches){ box(ctx, bx - 1.1, by - 0.35, 2.2, 0.7, 0.2, PAL.leather, 0.06); box(ctx, bx - 1.0, by - 0.1, 2.0, 0.2, 0.08, shade(PAL.leather, .85), 0); }
  }
  // tracks
  drawTracks(ctx, view, zoom);
  // Paddock pit lane + pads
  { const L = WORLD.pitLane; if(vis(view, L.x, L.y, 50)){
    rrect(ctx, L.x - L.w / 2, L.y - L.d / 2, L.w, L.d, 2); blob(ctx, PAL.pitLane, 0.25);
    for(const px of [-28, 0, 28]){ rrect(ctx, px - 6, L.y - 4, 12, 8, 1.2); blob(ctx, PAL.pad, 0.12); label(ctx, 'PIT', px, L.y, 2.4, PAL.padDot); }
  } }
  // ramps: wedges with chevrons, a lip on the high edge
  for(const r of WORLD.ramps){
    if(!vis(view, r.x, r.y, Math.max(r.w, r.d))) continue;
    ctx.save(); ctx.translate(r.x, r.y);
    const rot = [0, Math.PI / 2, Math.PI, -Math.PI / 2][r.dir];     // after rotate: high edge is UP (-y), climb toward -y
    ctx.rotate(rot);
    const w = (r.dir % 2) ? r.d : r.w, d = (r.dir % 2) ? r.w : r.d;
    rrect(ctx, -w / 2, -d / 2, w, d, 0.8); blob(ctx, PAL.ramp, 0.25);
    const g = ctx.createLinearGradient(0, d / 2, 0, -d / 2); g.addColorStop(0, rgba(PAL.rampSkirt, 0)); g.addColorStop(1, rgba(tint(PAL.ramp, .35), 0.9));
    rrect(ctx, -w / 2, -d / 2, w, d, 0.8); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = hex(PAL.chevron); ctx.lineWidth = 0.7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for(let i = 1; i <= 3; i++){ const yy = d / 2 - i * d / 4; ctx.beginPath(); ctx.moveTo(-w * 0.28, yy + 1.6); ctx.lineTo(0, yy - 0.4); ctx.lineTo(w * 0.28, yy + 1.6); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-w / 2 + 0.4, -d / 2 + 0.2); ctx.lineTo(w / 2 - 0.4, -d / 2 + 0.2); ctx.strokeStyle = hex(PAL.rampSkirt); ctx.lineWidth = 0.5; ctx.stroke();   // the lip
    ctx.restore();
  }
  // teleport pads (Kris's Corner)
  for(const p of WORLD.pads){
    if(!vis(view, p.x, p.y, 8)) continue;
    disc(ctx, p.x, p.y, p.r + 0.5, PAL.paper, 0.1); disc(ctx, p.x, p.y, p.r, p.color, 0.08);
    disc(ctx, p.x, p.y, p.r * 0.55, tint(p.color, .3), 0); disc(ctx, p.x, p.y, p.r * 0.2, PAL.paper, 0);
    label(ctx, p.name, p.x, p.y + p.r + 1.5, 0.9, PAL.text, { bg: PAL.cream });
  }
  // rocks, bushes (canopy-less), cones
  for(const [x, y, r] of WORLD.rocks) if(vis(view, x, y, r)){ ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.75, 0.3, 0, Math.PI * 2); blob(ctx, PAL.rock, 0.08); disc(ctx, x - r * 0.25, y - r * 0.2, r * 0.3, tint(PAL.rock, .3), 0); }
  for(const [x, y, r] of WORLD.bushes) if(vis(view, x, y, r * 1.5)){
    shadow(ctx, x + 0.15, y + 0.2, r * 1.1, r * 0.9, 0.12);
    if(!artAt(ctx, 'props/bush', x, y, r * 2.4, r * 2.4, zoom)){
      for(const [dx, dy, rr] of [[-0.45, 0.15, 0.7], [0.45, 0.2, 0.65], [0, -0.3, 0.75], [0, 0.25, 0.6]]) disc(ctx, x + dx * r, y + dy * r, rr * r, PAL.bush, 0.06);
      disc(ctx, x - 0.2 * r, y - 0.45 * r, r * 0.28, tint(PAL.bush, .3), 0);
    }
  }
  for(const c of WORLD.cones) if(vis(view, c.x, c.y, 1)){
    shadow(ctx, c.x + 0.1, c.y + 0.12, 0.5, 0.4, 0.12);
    if(!artAt(ctx, 'props/cone', c.x, c.y, 1.1, 1.1, zoom)){ box(ctx, c.x - 0.5, c.y - 0.5, 1, 1, 0.2, PAL.cone, 0.05); disc(ctx, c.x, c.y, 0.3, tint(PAL.cone, .2), 0.04); disc(ctx, c.x, c.y, 0.12, PAL.coneStripe, 0); }
  }
  // visible walls
  for(const wl of WORLD.walls){
    if(wl.hidden) continue;
    const w = wl.x1 - wl.x0, d = wl.y1 - wl.y0;
    if(!vis(view, (wl.x0 + wl.x1) / 2, (wl.y0 + wl.y1) / 2, Math.max(w, d))) continue;
    rrect(ctx, wl.x0, wl.y0, w, d, Math.min(0.5, w / 2, d / 2)); blob(ctx, wl.hex || PAL.wall, 0.12);
  }
  // Kris's Corner + the cast
  drawCorner(ctx, view, zoom, t);
}
/* helper: Adam's art centred at (x,y); false = draw the fallback yourself */
function artAt(ctx, key, x, y, w, hh, zoom){ ctx.save(); ctx.translate(x, y); const ok = art(ctx, key, w, hh, zoom); ctx.restore(); return ok; }

/* everything OVER the machines: tree canopies (driving under trees is cute) */
export function drawCanopy(ctx, view, zoom){
  for(const [x, y, r] of WORLD.trees){
    if(!vis(view, x, y, r * 1.3)) continue;
    shadow(ctx, x + r * 0.35, y + r * 0.45, r * 1.05, r * 0.9, 0.16);
    if(!artAt(ctx, 'props/tree', x, y, r * 2.3, r * 2.3, zoom)){
      for(const [dx, dy, rr] of [[-0.45, 0.2, 0.62], [0.48, 0.22, 0.6], [0.05, -0.42, 0.62], [0, 0.05, 0.8]]) disc(ctx, x + dx * r, y + dy * r, rr * r, PAL.tree, 0.08);
      disc(ctx, x - 0.28 * r, y - 0.5 * r, r * 0.3, PAL.treeLight, 0);
      disc(ctx, x + 0.15 * r, y + 0.05 * r, r * 0.14, shade(PAL.tree, .85), 0);
    }
  }
}
