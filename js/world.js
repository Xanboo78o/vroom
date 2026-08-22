/* =============================================================================
   world.js — ONE hand-authored map. No generation, ever.
   THE PADDOCK is home: the pit lane on the Paddock GP main straight, a concrete
   apron with painted bays (your machine parks here), a row of garages, Kris's
   Corner (the cast) on the apron, teleport pads to every track, Lake Tomathy
   to the west, the ramp/jump playground to the east. The other tracks live out
   in the world. Ground height h(x,y) is analytic: flat + hand-placed ramps.
   Every surface is TEXTURED (tiles.js) and drawn in vector every frame.
   ============================================================================= */
import { PAL, hex, shade, tint, rgba } from './palette.js';
import { box, disc, rrect, blob, art, shadow, label } from './draw.js';
import { buildTracks, drawTracks, SURF, GRIP, paintSurface, TRK } from './tracks.js';
import { buildCorner, drawCorner } from './corner.js';
import { initTiles, pat } from './tiles.js';
import { buildGarage, drawGarage } from './garage.js';

export const WORLD = {
  size: 1000,       // half-extent; the map is 2 km across (1 u ≈ 1.4 m)
  ramps: [],        // {x,y,w,d,h,dir}  dir: 0 = climbs toward -y (high edge at the top), 1 = +x, 2 = +y, 3 = -x
  walls: [],        // {x0,y0,x1,y1,h,hex,hidden}
  pits: [],         // {x,y,w,d} — refuel + repair zones
  spawn: { x: 0, y: -215 },
  parking: [],      // starter machine spots (the painted bays)
  tracks: [],       // registered tracks {id,name,color,closed,cps,start,length,type}
  pads: [],         // teleport pads {x,y,r,track,name,color}
  surfGrid: null,   // surface id grid for grip (SURF in tracks.js)
  trees: [], bushes: [], rocks: [], cones: [], patches: [], beds: [],
  lake: { x: -92, y: -214, r: 16 },
  pitLane: { x: 0, y: -184, w: 90, d: 9 },
  apron: { x: 0, y: -214, w: 100, d: 36 },
  garages: [], bays: [],
  menuCam: { x: -6, y: -212 },
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
function paintRect(x, y, w, d, id){ const pts = []; for(let px = x - w / 2; px <= x + w / 2; px += 3) for(let py = y - d / 2; py <= y + d / 2; py += 3) pts.push({ x: px, y: py }); paintSurface(WORLD, pts, 2, id); }

/* ---- build everything (data only; drawing is below) ------------------------------ */
export function buildWorld(){
  { const cell = 4, n = Math.ceil(WORLD.size * 2 / cell); WORLD.surfGrid = { cell, n, data: new Uint8Array(n * n) }; }
  WORLD.patches = [[-60, -300, 34], [90, -30, 26], [-130, -180, 40], [40, 100, 30], [150, 60, 36], [-40, -70, 22], [120, -290, 30], [-170, 90, 28], [60, 150, 24], [-190, -250, 36], [230, -230, 30]];
  // the tracks (Paddock GP first) + teleport pads in a row at the apron's south edge
  buildTracks(WORLD, { wall, padAt: i => ({ x: -25 + i * 10, y: -200 }) });
  // pit lane on the main straight + the yellow pads + the pit wall
  const L = WORLD.pitLane;
  paintRect(L.x, L.y, L.w, L.d + 2, SURF.asphalt);
  for(const px of [-28, 0, 28]) WORLD.pits.push({ x: px, y: L.y, w: 12, d: 8 });
  wall(-27, L.y - 6.5, 40, 1.2, 1.1, PAL.pitWall); wall(27, L.y - 6.5, 40, 1.2, 1.1, PAL.pitWall);   // pit wall, a gap in the middle to walk through
  // the paddock apron (concrete) + painted bays (your machine parks here) + garages
  const A = WORLD.apron; paintRect(A.x, A.y, A.w, A.d, SURF.asphalt);
  WORLD.bays = []; for(let i = 0; i < 8; i++) WORLD.bays.push({ x: -38.5 + i * 11, y: -225, w: 5, d: 6.5 });
  WORLD.parking = WORLD.bays.map(b => ({ x: b.x, y: b.y }));
  const roofs = [PAL.red, PAL.blue, PAL.batt, PAL.pad, PAL.motor, PAL.cone];
  WORLD.garages = []; for(let i = 0; i < 6; i++){ const gx = -40 + i * 16; WORLD.garages.push({ x: gx, y: -236, w: 11, d: 8, color: roofs[i], n: i + 1 }); wall(gx, -236, 11, 8, 2.4, PAL.garage, true); }
  // Lake Tomathy (you CAN drive in. you will regret it.)
  { const K = WORLD.lake, pp = []; for(let a = 0; a < 6.3; a += 0.2) for(let r = 0; r <= K.r - 2; r += 4) pp.push({ x: K.x + Math.cos(a) * r, y: K.y + Math.sin(a) * r }); paintSurface(WORLD, pp, 6, SURF.water); }
  // ramp playground — east of the apron (dir 0 climbs toward -y: drive north, fly off the top)
  WORLD.ramps.push(
    { x: 105, y: -196, w: 16, d: 26, h: 5, dir: 0 },    // launch ramp: up and off…
    { x: 105, y: -240, w: 16, d: 26, h: 5, dir: 2 },    // …over the GAP onto the landing ramp
    { x: 78, y: -254, w: 12, d: 16, h: 2.4, dir: 0 },   // small kicker
    { x: 136, y: -250, w: 20, d: 20, h: 3.2, dir: 3 },  // side ramp
  );
  for(let i = 0; i < 5; i++) WORLD.cones.push({ x: 90 + (i % 2 ? 2.5 : -2.5), y: -236 - i * 6 });   // slalom
  for(let i = 0; i < 4; i++) WORLD.cones.push({ x: 48 + i * 3, y: -190.5 });                      // pit exit cones
  // flower beds on the apron
  WORLD.beds = [[-44, -226, 1.3], [44, -226, 1.3], [-44, -203, 1.3], [44, -203, 1.3]];
  // trees / bushes / rocks — hand-placed, off the racing lines
  WORLD.trees = [[-54, -250, 2.6], [-40, -252, 2.2], [-26, -250, 2.8], [-12, -252, 2.3], [2, -250, 2.7], [16, -252, 2.2], [30, -250, 2.8], [44, -252, 2.4], [58, -250, 2.6],
    [-112, -234, 3.0], [-118, -204, 2.4], [-100, -238, 2.4], [-76, -236, 2.2], [-114, -190, 2.6], [-74, -194, 2.0],
    [72, -216, 2.4], [150, -214, 2.6], [156, -232, 2.2], [160, -200, 2.8],
    [-20, -40, 2.0], [20, -40, 2.2], [0, -90, 2.6], [-28, -130, 2.4], [30, -132, 2.8], [-60, -110, 2.2], [64, -112, 2.4],
    [-150, -60, 3.0], [-152, -160, 2.6], [150, -60, 2.8], [150, -160, 2.4], [-140, -240, 2.8], [-160, -280, 2.4], [200, -290, 2.6], [220, -250, 2.4],
    [230, -40, 2.8], [-230, 30, 2.4], [-220, -30, 2.8], [200, 20, 2.6], [-60, 60, 2.6], [60, 60, 2.4], [0, 120, 2.8]];
  WORLD.bushes = [[-58, -232, 1.0], [-58, -194, 1.1], [58, -232, 1.0], [58, -194, 0.9], [-52, -246, 0.9], [52, -246, 0.9], [-8, -247, 1.0], [10, -247, 0.9],
    [-104, -222, 1.0], [-80, -200, 0.9], [120, -214, 1.1], [122, -228, 0.9], [92, -266, 1.0], [30, -50, 0.9], [-30, -50, 1.0], [-90, -80, 1.0], [92, -82, 1.0]];
  WORLD.rocks = [[-108, -206, 1.2], [-78, -226, 0.9], [124, -244, 1.1], [148, -186, 0.9], [-36, -160, 1.0], [38, -162, 0.9]];
  // Kris's Corner (the cast + furniture) + hidden walls
  buildCorner(WORLD, { wall });
  // THE GARAGE (press B): build pads = aero tunnels, test loop, pads both ways
  buildGarage(WORLD, { wall });
  // perimeter walls + an infield block
  const S = WORLD.size;
  wall(0, -S, 2 * S, 2, 2); wall(0, S, 2 * S, 2, 2); wall(-S, 0, 2, 2 * S, 2); wall(S, 0, 2, 2 * S, 2);
  wall(0, -110, 10, 10, 1.6, PAL.block);
  initTiles();
  return WORLD;
}

/* ---- drawing ----------------------------------------------------------------------- */
const vis = (view, x, y, r) => x + r > view.x0 && x - r < view.x1 && y + r > view.y0 && y - r < view.y1;
function hash2(i, j){ let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; h = h ^ (h >> 16); return ((h >>> 0) % 1000) / 1000; }
function artAt(ctx, key, x, y, w, hh, zoom){ ctx.save(); ctx.translate(x, y); const ok = art(ctx, key, w, hh, zoom); ctx.restore(); return ok; }
function treeBlob(ctx, x, y, r){
  for(const [dx, dy, rr] of [[-0.45, 0.2, 0.62], [0.48, 0.22, 0.6], [0.05, -0.42, 0.62], [0, 0.05, 0.8]]) disc(ctx, x + dx * r, y + dy * r, rr * r, PAL.tree, 0.08);
  // leaf texture: darker + lighter dots
  for(let i = 0; i < 9; i++){ const a = i * 2.4, rr = r * (0.25 + 0.45 * ((i * 7) % 5) / 4); disc(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, r * 0.13, i % 3 ? shade(PAL.tree, .86) : PAL.treeLight, 0); }
  disc(ctx, x - 0.3 * r, y - 0.5 * r, r * 0.26, PAL.treeLight, 0);
}

/* everything UNDER the machines */
export function drawWorld(ctx, view, zoom, t){
  // grass (textured)
  ctx.fillStyle = pat(ctx, 'grass', zoom);
  ctx.fillRect(view.x0 - 2, view.y0 - 2, view.x1 - view.x0 + 4, view.y1 - view.y0 + 4);
  for(const [px, py, pr] of WORLD.patches) if(vis(view, px, py, pr)){ ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fillStyle = pat(ctx, 'grassDark', zoom); ctx.fill(); }
  // flowers on the grass (decoration only, deterministic)
  if(zoom > 9){
    const C = 6, i0 = Math.floor(view.x0 / C), i1 = Math.ceil(view.x1 / C), j0 = Math.floor(view.y0 / C), j1 = Math.ceil(view.y1 / C);
    if((i1 - i0) * (j1 - j0) < 4000){
      for(let i = i0; i <= i1; i++) for(let j = j0; j <= j1; j++){
        const r = hash2(i, j); if(r > 0.16) continue;
        const x = i * C + hash2(i + 7, j) * C, y = j * C + hash2(i, j + 7) * C;
        if(surfaceAt(x, y) !== SURF.grass) continue;
        if(!artAt(ctx, 'props/flower', x, y, 0.7, 0.7, zoom)){
          for(let k = 0; k < 5; k++){ const a = k / 5 * Math.PI * 2; disc(ctx, x + Math.cos(a) * 0.13, y + Math.sin(a) * 0.13, 0.11, r < 0.08 ? PAL.flowerP : PAL.flowerW, 0); }
          disc(ctx, x, y, 0.08, PAL.flowerC, 0);
        }
      }
    }
  }
  // Lake Tomathy
  { const K = WORLD.lake; if(vis(view, K.x, K.y, K.r + 2)){
    ctx.beginPath(); for(let a = 0; a <= 14; a++){ const an = a / 14 * Math.PI * 2, rr = K.r * (1 + 0.08 * Math.sin(an * 3 + 1)); const px = K.x + Math.cos(an) * rr, py = K.y + Math.sin(an) * rr; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath(); ctx.fillStyle = pat(ctx, 'water', zoom); ctx.fill(); ctx.lineWidth = 0.4; ctx.strokeStyle = hex(PAL.plaza); ctx.stroke();
    for(let i = 0; i < 4; i++){ const wx = K.x - 8 + i * 5 + Math.sin(t * 0.8 + i) * 0.6, wy = K.y + 4 - i * 3; ctx.strokeStyle = rgba(0xffffff, 0.6); ctx.lineWidth = 0.16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(wx - 1, wy); ctx.quadraticCurveTo(wx, wy - 0.5, wx + 1, wy); ctx.stroke(); }
    label(ctx, 'Lake Tomathy', K.x, K.y + K.r + 1.6, 0.9, PAL.paper, { bg: PAL.blueDark });
  } }
  // the paddock apron: concrete + painted bays + "KRIS'S CORNER" on the ground
  { const A = WORLD.apron; if(vis(view, A.x, A.y, 70)){
    rrect(ctx, A.x - A.w / 2, A.y - A.d / 2, A.w, A.d, 1.2); ctx.fillStyle = pat(ctx, 'concrete', zoom); ctx.fill(); ctx.lineWidth = 0.35; ctx.strokeStyle = hex(shade(PAL.concrete, .78)); ctx.stroke();
    ctx.lineWidth = 0.22; ctx.strokeStyle = rgba(PAL.bay, 0.85);
    WORLD.bays.forEach((b, i) => { rrect(ctx, b.x - b.w / 2, b.y - b.d / 2, b.w, b.d, 0.2); ctx.stroke(); label(ctx, String(i + 1), b.x, b.y + b.d / 2 - 0.8, 0.9, PAL.bay); });
    ctx.save(); ctx.globalAlpha = 0.3; label(ctx, "KRIS'S CORNER", 0, -206.5, 2.2, PAL.paper, { font: "Impact, 'Arial Black', sans-serif", weight: 900 }); ctx.restore();
    // painted hatching at the apron's far ends + rubber smudges (the place is USED)
    ctx.save(); ctx.beginPath(); rrect(ctx, A.x - A.w / 2, A.y - A.d / 2, A.w, A.d, 1.2); ctx.clip();
    ctx.strokeStyle = rgba(PAL.pad, 0.55); ctx.lineWidth = 0.35; ctx.lineCap = 'butt';
    for(const sx of [-1, 1]) for(let k = -9; k <= 9; k++){ const bx = sx * (A.w / 2 - 4) + k * 1.2; ctx.beginPath(); ctx.moveTo(bx - 2, A.y - A.d / 2); ctx.lineTo(bx + 2, A.y - A.d / 2 + 4); ctx.moveTo(bx - 2, A.y + A.d / 2 - 4); ctx.lineTo(bx + 2, A.y + A.d / 2); ctx.stroke(); }
    ctx.strokeStyle = rgba(PAL.edgeLine, 0.7); ctx.lineWidth = 0.3; for(const sx of [-1, 1]){ ctx.beginPath(); ctx.moveTo(sx * (A.w / 2 - 8), A.y - A.d / 2); ctx.lineTo(sx * (A.w / 2 - 8), A.y - A.d / 2 + 4); ctx.moveTo(sx * (A.w / 2 - 8), A.y + A.d / 2 - 4); ctx.lineTo(sx * (A.w / 2 - 8), A.y + A.d / 2); ctx.stroke(); }
    // faint tire skids (thin streaks, not blobs — they read as marks on the ground, not shadows)
    ctx.strokeStyle = rgba(0x33363d, 0.14); ctx.lineWidth = 0.18; ctx.lineCap = 'round';
    for(const [mx, my, mw, ma] of [[-30, -219, 3.2, 0.3], [-12, -218, 4, -0.2], [14, -221, 2.6, 0.5], [24, -208, 4.4, 0.1], [-20, -206, 3.4, -0.4], [40, -198, 4, 0.2], [-42, -199, 3.2, -0.3]]){
      ctx.save(); ctx.translate(mx, my); ctx.rotate(ma); ctx.beginPath(); ctx.moveTo(-mw / 2, -0.12); ctx.lineTo(mw / 2, -0.12); ctx.moveTo(-mw / 2, 0.12); ctx.lineTo(mw / 2, 0.12); ctx.stroke(); ctx.restore(); }
    ctx.restore();
    for(const [bx, by, br] of WORLD.beds){
      disc(ctx, bx, by, br, shade(PAL.trunk, .9), 0.08, shade(PAL.trunk, .7)); disc(ctx, bx, by, br * 0.8, PAL.grassDark, 0);
      for(let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2 + bx, rr = br * (0.3 + 0.3 * ((i * 7) % 3) / 2);
        const fx = bx + Math.cos(a) * rr, fy = by + Math.sin(a) * rr;
        disc(ctx, fx, fy, 0.2, [PAL.flowerP, PAL.flowerW, PAL.red, PAL.pad][i % 4], 0); disc(ctx, fx, fy, 0.08, PAL.flowerC, 0); }
    }
    // garages: roof + door strip on the south face + number
    for(const g of WORLD.garages){
      shadow(ctx, g.x + 0.3, g.y + 0.4, g.w / 2 + 0.2, g.d / 2 + 0.2, 0.18);
      box(ctx, g.x - g.w / 2, g.y - g.d / 2, g.w, g.d, 0.3, PAL.garage, 0.1);
      box(ctx, g.x - g.w / 2 + 0.5, g.y - g.d / 2 + 0.5, g.w - 1, 1.6, 0.15, g.color, 0.06);          // team stripe
      box(ctx, g.x - g.w / 2 + 0.8, g.y + g.d / 2 - 1.3, g.w - 1.6, 1.0, 0.12, PAL.garageDoor, 0.05);  // roller door (south)
      for(let k = 0; k < 5; k++){ ctx.fillStyle = rgba(shade(PAL.garageDoor, .8), 0.8); ctx.fillRect(g.x - g.w / 2 + 0.9, g.y + g.d / 2 - 1.2 + k * 0.2, g.w - 1.8, 0.06); }
      label(ctx, String(g.n), g.x, g.y + 0.2, 2.2, shade(PAL.garage, .75), { font: "Impact, 'Arial Black', sans-serif", weight: 900 });
    }
  } }
  // tracks
  drawTracks(ctx, view, zoom);
  drawGarage(ctx, view, zoom, t);
  // pit lane + pads + pit boxes (painted)
  { const L = WORLD.pitLane; if(vis(view, L.x, L.y, 50)){
    rrect(ctx, L.x - L.w / 2, L.y - L.d / 2, L.w, L.d, 1); ctx.fillStyle = pat(ctx, 'pit', zoom); ctx.fill();
    ctx.lineWidth = 0.25; ctx.strokeStyle = rgba(PAL.edgeLine, 0.9); ctx.stroke();
    for(const px of [-28, 0, 28]){ rrect(ctx, px - 6, L.y - 4, 12, 8, 0.6); blob(ctx, PAL.pad, 0.14); label(ctx, 'PIT', px, L.y, 2.4, PAL.padDot, { font: "Impact, 'Arial Black', sans-serif", weight: 900 }); }
    ctx.setLineDash([1.5, 1]); ctx.lineWidth = 0.2; ctx.strokeStyle = rgba(PAL.edgeLine, 0.7); ctx.beginPath(); ctx.moveTo(L.x - L.w / 2, L.y + 3.6); ctx.lineTo(L.x + L.w / 2, L.y + 3.6); ctx.stroke(); ctx.setLineDash([]);   // pit speed line
  } }
  // ramps: wedges with chevrons, a lip on the high edge, asphalt grain
  for(const r of WORLD.ramps){
    if(!vis(view, r.x, r.y, Math.max(r.w, r.d))) continue;
    ctx.save(); ctx.translate(r.x, r.y);
    const rot = [0, Math.PI / 2, Math.PI, -Math.PI / 2][r.dir];     // after rotate: high edge is UP (-y), climb toward -y
    ctx.rotate(rot);
    const w = (r.dir % 2) ? r.d : r.w, d = (r.dir % 2) ? r.w : r.d;
    rrect(ctx, -w / 2, -d / 2, w, d, 0.35); blob(ctx, PAL.ramp, 0.25);
    const g = ctx.createLinearGradient(0, d / 2, 0, -d / 2); g.addColorStop(0, rgba(PAL.rampSkirt, 0.15)); g.addColorStop(1, rgba(tint(PAL.ramp, .3), 0.9));
    rrect(ctx, -w / 2, -d / 2, w, d, 0.35); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = pat(ctx, 'asphalt', zoom); ctx.globalCompositeOperation = 'multiply'; rrect(ctx, -w / 2, -d / 2, w, d, 0.35); ctx.fill(); ctx.restore();
    ctx.strokeStyle = hex(PAL.chevron); ctx.lineWidth = 0.7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for(let i = 1; i <= 3; i++){ const yy = d / 2 - i * d / 4; ctx.beginPath(); ctx.moveTo(-w * 0.28, yy + 1.6); ctx.lineTo(0, yy - 0.4); ctx.lineTo(w * 0.28, yy + 1.6); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-w / 2 + 0.2, -d / 2 + 0.25); ctx.lineTo(w / 2 - 0.2, -d / 2 + 0.25); ctx.strokeStyle = hex(PAL.rampSkirt); ctx.lineWidth = 0.5; ctx.stroke();   // the lip
    ctx.restore();
  }
  // teleport pads
  for(const p of WORLD.pads){
    if(!vis(view, p.x, p.y, 8)) continue;
    disc(ctx, p.x, p.y, p.r + 0.4, PAL.paper, 0.08, shade(PAL.concrete, .8)); disc(ctx, p.x, p.y, p.r, p.color, 0.08);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.6, 0, Math.PI * 2); ctx.lineWidth = 0.25; ctx.strokeStyle = rgba(0xffffff, 0.7); ctx.stroke();
    disc(ctx, p.x, p.y, p.r * 0.22, PAL.paper, 0);
    label(ctx, p.name, p.x, p.y - p.r - 1.2, 0.8, PAL.paper, { bg: shade(p.color, .85) });
  }
  // rocks, bushes, cones
  for(const [x, y, r] of WORLD.rocks) if(vis(view, x, y, r)){ ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.75, 0.3, 0, Math.PI * 2); blob(ctx, PAL.rock, 0.08); disc(ctx, x - r * 0.25, y - r * 0.2, r * 0.3, tint(PAL.rock, .3), 0); disc(ctx, x + r * 0.3, y + r * 0.25, r * 0.18, shade(PAL.rock, .85), 0); }
  for(const [x, y, r] of WORLD.bushes) if(vis(view, x, y, r * 1.5)){
    shadow(ctx, x + 0.15, y + 0.2, r * 1.1, r * 0.9, 0.14);
    if(!artAt(ctx, 'props/bush', x, y, r * 2.4, r * 2.4, zoom)){
      for(const [dx, dy, rr] of [[-0.45, 0.15, 0.7], [0.45, 0.2, 0.65], [0, -0.3, 0.75], [0, 0.25, 0.6]]) disc(ctx, x + dx * r, y + dy * r, rr * r, PAL.bush, 0.06);
      for(let i = 0; i < 6; i++){ const a = i * 2.1; disc(ctx, x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.4, r * 0.14, i % 2 ? shade(PAL.bush, .85) : tint(PAL.bush, .3), 0); }
    }
  }
  for(const c of WORLD.cones) if(vis(view, c.x, c.y, 1)){
    shadow(ctx, c.x + 0.1, c.y + 0.12, 0.5, 0.4, 0.14);
    if(!artAt(ctx, 'props/cone', c.x, c.y, 1.1, 1.1, zoom)){ box(ctx, c.x - 0.5, c.y - 0.5, 1, 1, 0.12, PAL.cone, 0.05); disc(ctx, c.x, c.y, 0.32, tint(PAL.cone, .15), 0.04); disc(ctx, c.x, c.y, 0.2, PAL.coneStripe, 0); disc(ctx, c.x, c.y, 0.1, PAL.cone, 0); }
  }
  // visible walls
  for(const wl of WORLD.walls){
    if(wl.hidden) continue;
    const w = wl.x1 - wl.x0, d = wl.y1 - wl.y0;
    if(!vis(view, (wl.x0 + wl.x1) / 2, (wl.y0 + wl.y1) / 2, Math.max(w, d))) continue;
    rrect(ctx, wl.x0, wl.y0, w, d, Math.min(0.3, w / 2, d / 2)); blob(ctx, wl.hex || PAL.wall, 0.12);
  }
  // Kris's Corner + the cast
  drawCorner(ctx, view, zoom, t);
}

/* everything OVER the machines: tree canopies (driving under trees is cute) */
export function drawCanopy(ctx, view, zoom){
  for(const [x, y, r] of WORLD.trees){
    if(!vis(view, x, y, r * 1.3)) continue;
    shadow(ctx, x + r * 0.35, y + r * 0.45, r * 1.05, r * 0.9, 0.18);
    if(!artAt(ctx, 'props/tree', x, y, r * 2.3, r * 2.3, zoom)) treeBlob(ctx, x, y, r);
  }
}
