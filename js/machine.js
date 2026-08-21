/* =============================================================================
   machine.js — a machine is a stack of tile LAYERS that becomes ONE 2D rigid
   body (x, y, heading, height for hops) pivoting on its CENTRE OF MASS.
   Per-wheel grip + drive at each ground wheel's position, loaded by how close
   it sits to the centre of mass — so WHERE you bolt wheels and heavy blocks
   changes how it drives. Drag from your cross-section (width × height: long and
   low beats wide and tall). Impacts shear exposed parts off for real.
   Power: engines burn fuel and need breathing intakes; motors drain batteries;
   fans charge batteries from airflow; both at once = hybrid VROOM.
   ============================================================================= */
import { PARTS, CELL, fpOf, localCenterOf, facingDir, cellsOf, keyOf, parseKey, drawPart } from './parts.js';
import { PAL, rgba, shade, hex } from './palette.js';
import { shadow, rrect } from './draw.js';

const GRAV = 22;
const key = keyOf;
export const LAYER_LIFT = 0;         // full 2D: stacked layers draw flat, straight on top (a badge shows the count)

export const TUNE = {
  engP: 110,         // drive force per breathing engine
  motP: 72,          // drive force per powered motor
  boostP: 130,       // extra force while boosting (drains battery fast)
  fuelRate: 0.6,     // fuel units per second per engine at full throttle (a tank holds 100)
  motRate: 2.2,      // battery % per second per motor
  boostRate: 14,
  fanRate: 0.16,     // battery % per second per fan per unit speed
  dragBase: 0.012,
  dragArea: 0.008,   // per cross-section cell (width × height) — shape matters
  grip: 8.5,
  steerMax: 0.55,
  roll: 0.35,        // rolling drag per wheel
  landThresh: 40,    // impulse that shears on a belly-flop landing
  wallThresh: 20,
  shearScale: 1.0,
};

let nextId = 1;
export function makeMachine(owner, x, y){
  return {
    id: owner + ':' + (nextId++),
    owner, driver: null,
    x, y, a: 0, vx: 0, vy: 0, w: 0,          // pose (x,y = centre of mass) + velocity (w = angular)
    z: 0, vz: 0, air: false, zPrev: 0,       // height (hops!)
    parts: new Map(),                        // anchor "i,j,l" -> {type, rot}
    occ: new Map(),                          // every covered cell "i,j,l" -> anchor key
    fuel: 100, fuelMax: 100, batt: 100, grace: 2,   // fuelMax = 100 per tank; no shearing right after spawn/settle
    steer: 0, throttle: 0, boosting: false,
    // caches (rebuilt by refresh())
    mass: 1, invI: 1, wheels: [], engines: 0, freeIntakes: 0,
    motors: 0, fans: 0, freeFans: 0, wings: 0, tanks: 0, batts: 0, layers: 1, highWheels: 0,
    seatKey: null, frontal: 1, radius: 1, half: { x: 1, y: 1 }, boxC: { x: 0, y: 0 }, center: { x: 0, y: 0 },
    com: { x: 0, y: 0 }, comL: 0, balanceF: 0.5, cd: 0.05,
    remote: false, net: null,
    editing: false, squash: 0, landed: 0, steerVis: 0,
  };
}

// the starter machine everyone spawns with — hand-authored layout (fine grid, forward = up, layer 0)
export function starterLayout(){
  const p = new Map();
  p.set(key(-2, -4), { type: 'engine', rot: 0 }); p.set(key(0, -4), { type: 'intake', rot: 0 });
  p.set(key(-2, -2), { type: 'tank', rot: 0 });   p.set(key(0, -2), { type: 'frame', rot: 0 });
  p.set(key(-2, 0), { type: 'seat', rot: 0 });    p.set(key(0, 0), { type: 'frame', rot: 0 });
  p.set(key(-2, 2), { type: 'frame', rot: 0 });   p.set(key(0, 2), { type: 'frame', rot: 0 });
  p.set(key(-4, -4), { type: 'wheel', rot: 0 });  p.set(key(2, -4), { type: 'wheel', rot: 0 });
  p.set(key(-4, 2), { type: 'wheel', rot: 0 });   p.set(key(2, 2), { type: 'wheel', rot: 0 });
  return p;
}

/* wire format: [key, type, rot] (keys "i,j,l"; old "i,j" loads as layer 0) */
export function serializeParts(m){ return [...m.parts.entries()].map(([k, p]) => [k, p.type, p.rot]); }
export function loadParts(m, arr){
  m.parts.clear();
  for(const [k, type, rot] of arr){ if(!PARTS[type]) continue; const [i, j, l] = parseKey(k); m.parts.set(key(i, j, l), { type, rot: rot | 0 }); }
  refresh(m);
}

export function refresh(m){
  let mass = 0, engines = 0, motors = 0, fans = 0, freeFans = 0, wings = 0, tanks = 0, batts = 0, highWheels = 0;
  let sx = 0, sy = 0, sl = 0, maxL = 0;
  m.wheels = []; m.seatKey = null;
  m.occ.clear();
  let minI = 1e9, minJ = 1e9, maxI = -1e9, maxJ = -1e9;
  const colH = new Map();                    // column -> tallest layer index (cross-section)
  const frontCells = new Map();              // "column|layer" -> { j, type } of the frontmost cell (streamlining)
  for(const [k, p] of m.parts){
    const [i, j, l] = parseKey(k);
    const def = PARTS[p.type];
    mass += def.mass;
    const c = localCenterOf(i, j, p.type);
    sx += def.mass * c.x; sy += def.mass * c.y; sl += def.mass * l;
    if(l > maxL) maxL = l;
    for(const [ci, cj] of cellsOf(i, j, p.type, l)){
      m.occ.set(key(ci, cj, l), k);
      if(ci < minI) minI = ci; if(ci > maxI) maxI = ci; if(cj < minJ) minJ = cj; if(cj > maxJ) maxJ = cj;
      colH.set(ci, Math.max(colH.get(ci) ?? -1, l));
      const fk = ci + '|' + l, f = frontCells.get(fk); if(!f || cj < f.j) frontCells.set(fk, { j: cj, type: p.type });
    }
    if(p.type === 'seat' && !m.seatKey) m.seatKey = k;
    if(p.type === 'engine') engines++;
    if(p.type === 'motor') motors++;
    if(p.type === 'tank') tanks++;
    if(p.type === 'battery') batts++;
    if(p.type === 'wing') wings++;
    if(p.type === 'fan') fans++;
    if(p.type === 'wheel'){ if(l === 0) m.wheels.push({ k, lx: c.x, ly: c.y, steer: false, spin: 0, load: 0 }); else highWheels++; }
  }
  if(m.parts.size === 0){ m.mass = 1; return; }
  // breathing check needs the finished occupancy: every cell one step ahead of the
  // part's footprint (in its facing, same layer) must be open air
  let freeIntakes = 0;
  for(const [k, p] of m.parts){
    if(p.type !== 'intake' && p.type !== 'fan') continue;
    const [i, j, l] = parseKey(k);
    const d = facingDir(p.rot);
    let clear = true;
    for(const [ci, cj] of cellsOf(i, j, p.type, l)){
      const nk = key(ci + d[0], cj + d[1], l);
      if(m.occ.has(nk) && m.occ.get(nk) !== k){ clear = false; break; }
    }
    if(p.type === 'intake' && clear) freeIntakes++;
    if(p.type === 'fan' && clear) freeFans++;
  }
  m.mass = Math.max(1, mass);
  // centre of mass = the pivot for physics AND drawing
  m.com.x = sx / mass; m.com.y = sy / mass; m.comL = sl / mass;
  m.center.x = m.com.x; m.center.y = m.com.y;
  m.half.x = (maxI - minI + 1) / 2 * CELL; m.half.y = (maxJ - minJ + 1) / 2 * CELL;
  m.boxC.x = (minI + maxI) / 2 * CELL - m.center.x; m.boxC.y = (minJ + maxJ) / 2 * CELL - m.center.y;   // bbox centre, relative to the COM
  m.radius = Math.hypot(Math.abs(m.boxC.x) + m.half.x, Math.abs(m.boxC.y) + m.half.y);
  const ext = (m.half.x + m.half.y);
  m.invI = 1 / Math.max(0.4, m.mass * ext * ext / 6);
  m.engines = engines; m.motors = motors; m.fans = fans; m.freeFans = freeFans;
  m.tanks = tanks; m.batts = batts; m.wings = wings; m.freeIntakes = freeIntakes; m.highWheels = highWheels;
  m.fuelMax = tanks * 100; if(m.fuel > m.fuelMax) m.fuel = m.fuelMax;
  m.layers = maxL + 1;
  let xs = 0, streamlined = 0;
  for(const f of frontCells.values()){ if(PARTS[f.type].aero){ xs += 0.45; streamlined++; } else xs += 1; }
  m.streamlined = streamlined;
  m.frontal = Math.round((xs + wings * 2) * 10) / 10;   // cross-section: width × height in cells (aero-fronted ones count 0.45; wings stick out)
  m.cd = TUNE.dragBase + m.frontal * TUNE.dragArea;
  // wheel loads: the closer a ground wheel sits to the centre of mass, the more weight it carries
  let wsum = 0; for(const wh of m.wheels){ const d = Math.hypot(wh.lx - m.com.x, wh.ly - m.com.y); wh.load = 1 / (d + 0.5); wsum += wh.load; }
  let front = 0; for(const wh of m.wheels){ wh.load /= wsum || 1; wh.steer = wh.ly < m.center.y - 0.01; if(wh.ly < m.com.y) front += wh.load; }
  m.balanceF = m.wheels.length ? front : 0.5;
}

/* When the part grid changes, the centre of mass moves — shift the pose to match so the
   TILES stay exactly where they were in the world (the build never recenters).
   Capture c0 = {...m.center} BEFORE the change, call this after refresh(). */
export function anchorFix(m, c0){
  const dx = m.center.x - c0.x, dy = m.center.y - c0.y;
  const ca = Math.cos(m.a), sa = Math.sin(m.a);
  const wx = dx * ca - dy * sa, wy = dx * sa + dy * ca;
  m.x += wx; m.y += wy;
  if(m.net){ m.net.x += wx; m.net.y += wy; }
}

/* local (grid units, incl. centre offset) <-> world */
export function localToWorld(m, lx, ly, out = {}){
  const dx = lx - m.center.x, dy = ly - m.center.y;
  const ca = Math.cos(m.a), sa = Math.sin(m.a);
  out.x = m.x + dx * ca - dy * sa; out.y = m.y + dx * sa + dy * ca; return out;
}
export function worldToLocal(m, x, y, out = {}){
  const dx = x - m.x, dy = y - m.y;
  const ca = Math.cos(m.a), sa = Math.sin(m.a);
  out.x = dx * ca + dy * sa + m.center.x; out.y = -dx * sa + dy * ca + m.center.y; return out;
}
/* world position of a part (by its anchor key) */
export function cellWorld(m, k, out){
  const p = m.parts.get(k);
  const [i, j] = parseKey(k);
  const c = p ? localCenterOf(i, j, p.type) : { x: i * CELL, y: j * CELL };
  return localToWorld(m, c.x, c.y, out);
}
/* topmost occupied layer at a local cell (or -1) */
export function topAt(m, ci, cj){ for(let l = m.layers - 1; l >= 0; l--) if(m.occ.has(key(ci, cj, l))) return l; return -1; }

/* effective power right now (also drains tanks/batteries) */
function powerTick(m, dt){
  const th = Math.abs(m.throttle);
  let force = 0;
  const breathing = Math.min(m.engines, m.freeIntakes);
  if(breathing > 0 && m.tanks > 0 && m.fuel > 0){
    force += breathing * TUNE.engP;
    m.fuel = Math.max(0, m.fuel - breathing * TUNE.fuelRate * th * dt);
  }
  if(m.motors > 0 && m.batts > 0 && m.batt > 0){
    force += m.motors * TUNE.motP;
    m.batt = Math.max(0, m.batt - m.motors * TUNE.motRate * th * dt);
  }
  if(m.boosting && m.batts > 0 && m.batt > 0){
    force += TUNE.boostP;
    m.batt = Math.max(0, m.batt - TUNE.boostRate * dt);
  }
  const speed = Math.hypot(m.vx, m.vy);
  if(m.freeFans > 0 && m.batts > 0 && speed > 2)
    m.batt = Math.min(100, m.batt + m.freeFans * TUNE.fanRate * speed * dt);
  return force;
}

function applyForce(m, fx, fy, rx, ry, dt){
  m.vx += fx * dt / m.mass; m.vy += fy * dt / m.mass;
  m.w += (rx * fy - ry * fx) * m.invI * dt;
}

/* ---- physics step (only for machines this client simulates) -------------- */
export function stepMachine(m, world, dt, onImpact){
  if(m.parts.size === 0) return;
  m.grace = Math.max(0, m.grace - dt);
  m.squash = Math.max(0, m.squash - dt * 4);
  const drive = m.driver ? powerTick(m, dt) : (powerTick(m, dt), 0);
  const speed = Math.hypot(m.vx, m.vy);

  // height: follow the ground, launch off drop-offs, fall, land
  const gz = world.h(m.x, m.y);
  if(!m.air){
    if(gz < m.z - 0.25){ m.air = true; m.vz = Math.max(0, (m.z - m.zPrev) / dt) * 1.5; }   // the lip gives a lil kick
    else { m.zPrev = m.z; m.z = gz; }
  }
  if(m.air){
    m.vz -= GRAV * dt; m.z += m.vz * dt;
    if(m.z <= gz){
      m.z = gz; m.zPrev = gz; m.air = false;
      const down = -m.vz; m.vz = 0;
      m.squash = Math.min(1, down / 14); m.landed = down;
      const J = Math.max(0, down - 8) * m.mass * 0.6;
      if(J > TUNE.landThresh && onImpact && m.grace <= 0) onImpact(m, J, m.x, m.y);
    }
  }

  if(!m.air){
    const n = Math.max(1, m.wheels.length);
    const wingGrip = 1 + Math.min(1.2, m.wings * 0.10 * speed * 0.06);
    const steerA = m.steer * TUNE.steerMax / (1 + speed / 45);
    m.steerVis += (steerA - m.steerVis) * Math.min(1, dt * 14);
    for(const wh of m.wheels){
      const load = (m.mass * GRAV * wh.load) * 0.06;          // its share of the weight
      const dx = wh.lx - m.center.x, dy = wh.ly - m.center.y;
      const ca = Math.cos(m.a), sa = Math.sin(m.a);
      const rx = dx * ca - dy * sa, ry = dx * sa + dy * ca;
      const pvx = m.vx - m.w * ry, pvy = m.vy + m.w * rx;
      const aa = m.a + (wh.steer ? steerA : 0);
      const fx = Math.sin(aa), fy = -Math.cos(aa), sx = Math.cos(aa), sy = Math.sin(aa);
      const slip = pvx * sx + pvy * sy;
      const surf = world.gripAt ? world.gripAt(m.x + rx, m.y + ry) : 1;
      let gripF = -slip * TUNE.grip * wingGrip * surf;
      gripF = Math.max(-load * 3, Math.min(load * 3, gripF));
      applyForce(m, sx * gripF * m.mass * 0.25, sy * gripF * m.mass * 0.25, rx, ry, dt);
      const fSpeed = pvx * fx + pvy * fy;
      let driveF = (drive / n) * m.throttle - fSpeed * TUNE.roll;
      applyForce(m, fx * driveF, fy * driveF, rx, ry, dt);
      wh.spin += fSpeed / 0.29 * dt;
      wh.slip = Math.abs(slip); wh.surf = surf;
    }
  }

  // aero drag from your cross-section — long and low beats wide and tall
  const v2 = m.vx * m.vx + m.vy * m.vy;
  if(v2 > 0.01){
    const k = m.cd * Math.sqrt(v2) * dt / Math.max(1, m.mass * 0.4);
    m.vx -= m.vx * k; m.vy -= m.vy * k;
  }

  m.x += m.vx * dt; m.y += m.vy * dt; m.a += m.w * dt;
  m.w *= Math.pow(m.air ? 0.8 : 0.35, dt);
  if(m.air){ m.vx *= Math.pow(0.9, dt); m.vy *= Math.pow(0.9, dt); }

  wallHits(m, world, onImpact);
}

function wallHits(m, world, onImpact){
  const r = m.radius * 0.8;
  for(const wl of world.walls){
    if(m.z > wl.h) continue;
    const cx = Math.max(wl.x0, Math.min(wl.x1, m.x)), cy = Math.max(wl.y0, Math.min(wl.y1, m.y));
    const dx = m.x - cx, dy = m.y - cy, d2 = dx * dx + dy * dy;
    if(d2 > r * r) continue;
    let d = Math.sqrt(d2), nx, ny;
    if(d < 1e-4){
      const l = m.x - wl.x0, rr = wl.x1 - m.x, t = m.y - wl.y0, b = wl.y1 - m.y, mn = Math.min(l, rr, t, b);
      nx = mn === l ? -1 : mn === rr ? 1 : 0; ny = mn === t ? -1 : mn === b ? 1 : 0; d = 0;
    } else { nx = dx / d; ny = dy / d; }
    const pen = r - d;
    m.x += nx * pen; m.y += ny * pen;
    const vn = m.vx * nx + m.vy * ny;
    if(vn < 0){
      const J = -vn * m.mass;
      m.vx -= vn * nx * 1.4; m.vy -= vn * ny * 1.4;
      if(J > TUNE.wallThresh && onImpact) onImpact(m, J, cx, cy);
    }
  }
}

/* machine-vs-machine bump: push ME away, report impulse (both clients run this
   for their own machine, so nobody moves anyone else's body) */
export function bumpMachines(me, other, onImpact){
  if(!other.parts.size || Math.abs(me.z - other.z) > 0.8) return;
  const dx = me.x - other.x, dy = me.y - other.y;
  const r = (me.radius + other.radius) * 0.72;
  const d2 = dx * dx + dy * dy;
  if(d2 > r * r || d2 < 1e-6) return;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = r - d;
  me.x += nx * pen * 0.6; me.y += ny * pen * 0.6;
  const rvx = me.vx - (other.vx || 0), rvy = me.vy - (other.vy || 0);
  const vn = rvx * nx + rvy * ny;
  if(vn < 0){
    const J = -vn * me.mass * 0.8;
    me.vx -= vn * nx * 1.1; me.vy -= vn * ny * 1.1;
    if(J > 22 && onImpact) onImpact(me, J, other.x + nx * other.radius, other.y + ny * other.radius);
  }
}

/* ---- shearing: pick exposed parts near the hit and rip them off --------- */
export function shearParts(m, impulse, ax, ay){
  const local = worldToLocal(m, ax, ay);
  const n = Math.min(3, 1 + Math.floor(impulse / 60));
  const cands = [];
  for(const [k, p] of m.parts){
    const [i, j, l] = parseKey(k);
    const def = PARTS[p.type];
    if(impulse * TUNE.shearScale < def.shear * 2) continue;
    // exposed only: some covered cell has an open neighbour (sideways, above or below)
    let exposed = false;
    outer:
    for(const [ci, cj] of cellsOf(i, j, p.type, l))
      for(const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]){
        if(l + d[2] < 0){ continue; }
        if(!m.occ.has(key(ci + d[0], cj + d[1], l + d[2]))){ exposed = true; break outer; }
      }
    if(!exposed) continue;
    const c = localCenterOf(i, j, p.type);
    const dist = Math.hypot(c.x - local.x, c.y - local.y) + l * 0.2;
    cands.push({ k, p, dist, thresh: def.shear });
  }
  cands.sort((a, b) => a.dist - b.dist);
  const out = [];
  for(const c of cands.slice(0, 6)){
    if(out.length >= n) break;
    if(impulse * TUNE.shearScale > c.thresh * (1 + c.dist * 1.2)) out.push(c);
  }
  for(const c of out) m.parts.delete(c.k);
  // anything left floating (no support below) comes off too
  if(out.length){ refresh(m); dropFloaters(m, out); }
  return out;   // [{k, p:{type,rot}}]
}
/* remove specific parts (by anchor key) + anything left floating; returns everything that came off */
export function removePartKeys(m, keys){
  const out = [];
  for(const k of keys){ const p = m.parts.get(k); if(p){ m.parts.delete(k); out.push({ k, p }); } }
  if(out.length){ refresh(m); dropFloaters(m, out); }
  return out;
}
function dropFloaters(m, out){
  let changed = true;
  while(changed){
    changed = false;
    for(const [k, p] of m.parts){
      const [i, j, l] = parseKey(k); if(l === 0) continue;
      let held = false;
      for(const [ci, cj] of cellsOf(i, j, p.type, l)) if(m.occ.has(key(ci, cj, l - 1))){ held = true; break; }
      if(!held){ m.parts.delete(k); out.push({ k, p, dist: 9, thresh: 0 }); changed = true; }
    }
    if(changed) refresh(m);
  }
}

/* remote machines glide toward the last net pose */
export function netSync(m, dt){
  if(!m.remote || !m.net) return;
  const k = Math.min(1, dt * 10);
  m.x += (m.net.x - m.x) * k; m.y += (m.net.y - m.y) * k;
  let da = m.net.a - m.a; da = Math.atan2(Math.sin(da), Math.cos(da)); m.a += da * k;
  m.z += (m.net.z - m.z) * k;
}

/* ---- drawing --------------------------------------------------------------- */
export function drawMachine(ctx, m, zoom, t, ghostAlpha = 1, opts = {}){
  if(!m.parts.size) return;
  const lift = m.z * 0.5, sc = 1 + m.z * 0.03;
  if(ghostAlpha >= 1){
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.a);
    const k = Math.max(0.45, 1 - m.z * 0.06);
    shadow(ctx, m.boxC.x, m.boxC.y, (m.half.x + 0.12) * (0.7 + 0.3 * k), (m.half.y + 0.12) * (0.7 + 0.3 * k), 0.2 * k);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(m.x, m.y - lift); ctx.rotate(m.a);
  const sq = m.squash;
  ctx.scale(sc * (1 + sq * 0.12), sc * (1 - sq * 0.12));
  const spinning = m.freeFans > 0 && (m.vx * m.vx + m.vy * m.vy) > 4;
  // layer by layer, flat: the top tile covers what's under it; a lil badge says how tall the stack is
  const list = [...m.parts].map(([k, p]) => { const [i, j, l] = parseKey(k); return { k, p, i, j, l }; }).sort((a, b) => a.l - b.l);
  for(const { k, p, i, j, l } of list){
    const c = localCenterOf(i, j, p.type);
    ctx.save(); ctx.translate(c.x - m.center.x, c.y - m.center.y);
    let steer = 0;
    if(p.type === 'wheel' && l === 0){ const wh = m.wheels.find(w => w.k === k); if(wh && wh.steer) steer = m.steerVis; }
    drawPart(ctx, p.type, p.rot, zoom, ghostAlpha, spinning ? t * 12 : 0, steer);
    if(l > 0 && ghostAlpha >= 1){
      const [w, d] = fpOf(p.type).map(v => v * CELL);
      ctx.beginPath(); ctx.arc(w / 2 - 0.09, -d / 2 + 0.09, 0.085, 0, Math.PI * 2); ctx.fillStyle = hex(PAL.ink); ctx.fill();
      ctx.fillStyle = hex(PAL.paper); ctx.font = '900 0.12px Trebuchet MS, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(l + 1), w / 2 - 0.09, -d / 2 + 0.1);
    }
    ctx.restore();
  }
  // centre-of-mass marker (garage / build)
  if(opts.com){
    ctx.beginPath(); ctx.arc(0, 0, 0.16, 0, Math.PI * 2); ctx.fillStyle = hex(PAL.paper); ctx.fill(); ctx.lineWidth = 0.04; ctx.strokeStyle = hex(PAL.ink); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 0.16, -Math.PI / 2, 0); ctx.closePath(); ctx.fillStyle = hex(PAL.ink); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 0.16, Math.PI / 2, Math.PI); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
