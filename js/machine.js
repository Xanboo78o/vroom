/* =============================================================================
   machine.js — a machine is a stack of tile LAYERS that becomes a 2D rigid
   body (x, y, heading, height for hops) pivoting on its CENTRE OF MASS — plus,
   behind every HINGE, a SEGMENT that swings around that hinge (trailers).
   Per-wheel grip + drive at each ground wheel's position, loaded by how close
   it sits to the centre of mass — so WHERE you bolt wheels and heavy blocks
   changes how it drives. Drag from your cross-section. Impacts shear exposed
   parts off for real. Every block hooks a real system here:
     engines (breath · turbo · jet thrust) · motors · brakes (per-wheel, harshness)
     thrusters (rocket/ion) · rotors · pistons · panels (skin = armour + aero)
     wheels (3 sizes × 4 compounds, flats) · gadgets are in main.js (world stuff).
   m.act = Map(partKey -> amount) — what the driver's keys / the logic wires are
   asking each block to do THIS frame (main.js fills it).
   ============================================================================= */
import { PARTS, CELL, fpOf, localCenterOf, facingDir, cellsOf, keyOf, parseKey, drawPart, massOf, COMPOUNDS, compoundOf, ALIASES } from './parts.js';
import { PAL, rgba, shade, hex } from './palette.js';
import { shadow, rrect } from './draw.js';

const GRAV = 22;
const key = keyOf;
export const LAYER_LIFT = 0;         // full 2D: stacked layers draw flat, straight on top (a badge shows the count)

export const TUNE = {
  engP: 110,         // drive force per engine power unit
  motP: 72,          // drive force per powered motor
  boostP: 130,       // extra force while boosting (drains battery fast)
  thrustP: 230,      // rocket force per thrust unit (ion = 0.3)
  brakeP: 260,       // brake force per wheel-share at 100 %
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
  rotorT: 0.9,       // reaction torque while a rotor spins up
  punchV: 9,         // piston wall-kick speed
  ropeK: 26,         // tow rope spring (per unit stretch, per unit mass)
  hingeLimit: 1.5,   // rad either side
};

let nextId = 1;
export function makeMachine(owner, x, y){
  return {
    id: owner + ':' + (nextId++),
    owner, driver: null,
    x, y, a: 0, vx: 0, vy: 0, w: 0,          // pose (x,y = centre of mass of the main body) + velocity (w = angular)
    z: 0, vz: 0, air: false, zPrev: 0,       // height (hops!)
    parts: new Map(),                        // anchor "i,j,l" -> {type, rot, cfg?, ...runtime}
    occ: new Map(),                          // every covered cell "i,j,l" -> anchor key
    fuel: 100, fuelMax: 100, batt: 100, battMax: 100, grace: 2,   // fuelMax/battMax = Σ of what you bolted on; no shearing right after spawn/settle
    steer: 0, throttle: 0, boosting: false,
    act: new Map(),                          // partKey -> amount this frame (keys + wires), filled by main.js
    // caches (rebuilt by refresh())
    mass: 1, invI: 1, wheels: [], engines: 0, freeIntakes: 0,
    motors: 0, fans: 0, freeFans: 0, wings: 0, tanks: 0, batts: 0, layers: 1, highWheels: 0,
    engineNeeds: 0, enginePower: 0, engineBurn: 0, turbos: 0, freeTurbos: 0, solarFree: 0, fins: 0,
    eng: [], brakes: [], thrusters: [], rotors: [], pistons: [], gadgets: [], hooks: [], sensors: [], gates: [], decor: [],
    spikes: [], rams: [], bumpers: [], panels: 0, jets: 0,
    segs: [],                                // [0] = main body, then one per swinging hinge
    seatKey: null, frontal: 1, radius: 1, half: { x: 1, y: 1 }, boxC: { x: 0, y: 0 }, center: { x: 0, y: 0 },
    com: { x: 0, y: 0 }, comL: 0, balanceF: 0.5, cd: 0.05,
    remote: false, net: null,
    editing: false, squash: 0, landed: 0, steerVis: 0,
    acc: { x: 0, y: 0 }, pvx: 0, pvy: 0,     // smoothed local acceleration (antenna wobble)
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
  p.set(key(-1, 4), { type: 'brake', rot: 0 });
  return p;
}

/* wire format: [key, type, rot, cfg?] (keys "i,j,l"; old "i,j" loads as layer 0) */
export function serializeParts(m){ return [...m.parts.entries()].map(([k, p]) => p.cfg ? [k, p.type, p.rot, p.cfg] : [k, p.type, p.rot]); }
export function loadParts(m, arr){
  m.parts.clear();
  for(let [k, type, rot, cfg] of arr){
    if(ALIASES[type]){ const [t2, comp] = ALIASES[type]; type = t2; cfg = { ...(cfg || {}), compound: comp }; }
    if(!PARTS[type]) continue; const [i, j, l] = parseKey(k); const p = { type, rot: rot | 0 }; if(cfg) p.cfg = cfg; m.parts.set(key(i, j, l), p); }
  refresh(m);
}
/* the config of a placed part, with the def's defaults underneath */
export function cfgOf(p){ const def = PARTS[p.type]; const c = p.cfg || {}; return {
  bind: c.bind ?? def.bind ?? null, fwd: c.fwd ?? 'KeyW', rev: c.rev ?? 'KeyS', amount: c.amount ?? def.amount ?? 1, compound: compoundOf(p),
  wheels: c.wheels || null, out: c.out || [], thr: c.thr ?? def.thr ?? 0, op: c.op ?? def.op ?? '>', text: c.text ?? '', color: c.color ?? null, clip: c.clip ?? 'honk' }; }

export function refresh(m){
  let mass = 0, engines = 0, motors = 0, fans = 0, freeFans = 0, wings = 0, tanks = 0, batts = 0, highWheels = 0;
  let needs = 0, power = 0, burn = 0, fuelMax = 0, battMax = 0, fins = 0, turbos = 0, panels = 0, jets = 0;
  let sl = 0, maxL = 0;
  const oldSegs = m.segs;
  m.wheels = []; m.seatKey = null;
  m.eng = []; m.brakes = []; m.thrusters = []; m.rotors = []; m.pistons = []; m.gadgets = []; m.hooks = []; m.sensors = []; m.gates = []; m.decor = [];
  m.spikes = []; m.rams = []; m.bumpers = [];
  m.occ.clear();
  let minI = 1e9, minJ = 1e9, maxI = -1e9, maxJ = -1e9;
  const frontCells = new Map();              // "column|layer" -> { j, type } of the frontmost cell (streamlining)
  for(const [k, p] of m.parts){
    const [i, j, l] = parseKey(k);
    const def = PARTS[p.type];
    const pm = massOf(p.type, p); mass += pm; p.m = pm;
    const c = localCenterOf(i, j, p.type, p); p.lx = c.x; p.ly = c.y; p.l = l;
    sl += pm * l;
    if(l > maxL) maxL = l;
    for(const [ci, cj] of cellsOf(i, j, p.type, l, p)){
      m.occ.set(key(ci, cj, l), k);
      if(ci < minI) minI = ci; if(ci > maxI) maxI = ci; if(cj < minJ) minJ = cj; if(cj > maxJ) maxJ = cj;
      const fk = ci + '|' + l, f = frontCells.get(fk); if(!f || cj < f.j) frontCells.set(fk, { j: cj, type: p.type });
    }
    // runtime state every placed part carries
    if(def.ammo != null && p.ammo == null) p.ammo = def.ammo;
    if(p.spool == null) p.spool = 0; if(p.spin == null) p.spin = 0; if(p.rs == null) p.rs = 0; if(p.ext == null) p.ext = 0; p.on = p.on || 0;
    if(p.type === 'seat' && !m.seatKey) m.seatKey = k;
    if(def.engine){ engines++; needs += def.engine.needs; power += def.engine.power; burn += def.engine.burn; if(def.engine.jet) jets++; m.eng.push({ k, p, ...def.engine }); }
    if(def.motor){ motors++; m.eng.push({ k, p, motor: true, power: 1, burn: 0, needs: 0 }); }
    if(def.brake) m.brakes.push({ k, p });
    if(def.thrust) m.thrusters.push({ k, p, ...def.thrust });
    if(def.rotor) m.rotors.push({ k, p });
    if(def.piston) m.pistons.push({ k, p });
    if(def.gadget) m.gadgets.push({ k, p, kind: def.gadget });
    if(def.hook) m.hooks.push({ k, p });
    if(def.sensor) m.sensors.push({ k, p, kind: def.sensor });
    if(def.gate) m.gates.push({ k, p, kind: def.gate });
    if(def.antenna || def.flag || def.horn || def.text) m.decor.push({ k, p });
    if(def.spikes) m.spikes.push({ k, p }); if(def.ram) m.rams.push({ k, p }); if(def.bumper) m.bumpers.push({ k, p });
    if(def.panel) panels++;
    if(def.fuel){ tanks++; fuelMax += def.fuel; }
    if(def.batt){ batts++; battMax += def.batt; }
    if(p.type === 'wing') wings++;
    if(p.type === 'fan') fans++;
    if(def.turbo) turbos++;
    if(def.fin) fins++;
    if(def.wheel){ const comp = def.compound ? COMPOUNDS[compoundOf(p)] : def.wheel; if(l === 0) m.wheels.push({ k, p, lx: c.x, ly: c.y, steer: false, spin: 0, load: 0, road: comp.road, off: comp.off, canSteer: def.wheel.steer, gk: def.wheel.k || 1, spiked: !!comp.spiked, compound: def.compound ? compoundOf(p) : null, drive: 0, brake: 0, seg: 0 }); else highWheels++; }
  }
  if(m.parts.size === 0){ m.mass = 1; m.segs = []; return; }
  // breathing check needs the finished occupancy: every cell one step ahead of the
  // part's footprint (in its facing, same layer) must be open air
  let freeIntakes = 0, freeTurbos = 0, solarFree = 0;
  for(const [k, p] of m.parts){
    const def = PARTS[p.type];
    const [i, j, l] = parseKey(k);
    if(def.solar){   // solar wants SKY: nothing stacked on any of its cells
      let open = true; for(const [ci, cj] of cellsOf(i, j, p.type, l, p)) if(m.occ.has(key(ci, cj, l + 1))){ open = false; break; }
      if(open) solarFree++;
    }
    if(p.type !== 'intake' && p.type !== 'fan' && !def.turbo) continue;
    const d = facingDir(p.rot);
    let clear = true;
    for(const [ci, cj] of cellsOf(i, j, p.type, l, p)){
      const nk = key(ci + d[0], cj + d[1], l);
      if(m.occ.has(nk) && m.occ.get(nk) !== k){ clear = false; break; }
    }
    if(p.type === 'intake' && clear) freeIntakes++;
    if(p.type === 'fan' && clear) freeFans++;
    if(def.turbo && clear) freeTurbos++;
  }
  // ---- segments: the main body + whatever swings behind each hinge ----
  buildSegs(m, oldSegs);
  const root = m.segs[0];
  m.mass = Math.max(1, mass);
  // centre of mass of the MAIN body = the pivot for physics AND drawing
  m.com.x = root.com.x; m.com.y = root.com.y; m.comL = sl / mass;
  m.center.x = m.com.x; m.center.y = m.com.y;
  m.half.x = (maxI - minI + 1) / 2 * CELL; m.half.y = (maxJ - minJ + 1) / 2 * CELL;
  m.boxC.x = (minI + maxI) / 2 * CELL - m.center.x; m.boxC.y = (minJ + maxJ) / 2 * CELL - m.center.y;   // bbox centre, relative to the COM
  m.radius = root.radius;
  m.invI = 1 / Math.max(0.4, root.I);
  m.engines = engines; m.motors = motors; m.fans = fans; m.freeFans = freeFans;
  m.tanks = tanks; m.batts = batts; m.wings = wings; m.freeIntakes = freeIntakes; m.highWheels = highWheels;
  m.engineNeeds = needs; m.enginePower = power; m.engineBurn = burn; m.turbos = turbos; m.freeTurbos = freeTurbos; m.solarFree = solarFree; m.fins = fins; m.panels = panels; m.jets = jets;
  m.fuelMax = fuelMax; if(m.fuel > m.fuelMax) m.fuel = m.fuelMax;
  m.battMax = battMax; if(m.batt > m.battMax) m.batt = m.battMax;
  m.layers = maxL + 1;
  let xs = 0, streamlined = 0;
  for(const f of frontCells.values()){ if(PARTS[f.type].aero){ xs += 0.45; streamlined++; } else xs += 1; }
  m.streamlined = streamlined;
  m.frontal = Math.round((xs + wings * 2) * 10) / 10;   // cross-section: width × height in cells (aero-fronted ones count 0.45; wings stick out)
  m.cd = TUNE.dragBase + m.frontal * TUNE.dragArea;
  // wheel loads: the closer a ground wheel sits to ITS segment's centre of mass, the more weight it carries
  for(const s of m.segs){
    let wsum = 0; for(const wh of s.wheels){ const d = Math.hypot(wh.lx - s.com.x, wh.ly - s.com.y); wh.load = 1 / (d + 0.5); wsum += wh.load; }
    for(const wh of s.wheels) wh.load /= wsum || 1;
  }
  let front = 0; for(const wh of root.wheels){ wh.steer = wh.canSteer && wh.ly < m.center.y - 0.01; if(wh.ly < m.com.y) front += wh.load; }
  m.balanceF = root.wheels.length ? front : 0.5;
  // ground wheels: the root's carry the car; a trailer's carry the trailer (physics per segment)
  for(const wh of m.wheels) wh.flat = !!wh.p.flat;
}

/* rigid neighbours of a part (shared edge on its layer, or a cell straight above/below),
   minus the joint across each hinge's FRONT face */
function neighbours(m, k, p, jointPairs){
  const [i, j, l] = parseKey(k); const out = new Set();
  for(const [ci, cj] of cellsOf(i, j, p.type, l, p))
    for(const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]){
      if(l + d[2] < 0) continue;
      const nk = m.occ.get(key(ci + d[0], cj + d[1], l + d[2]));
      if(nk && nk !== k && !jointPairs.has(k + '>' + nk)) out.add(nk);
    }
  return out;
}
function buildSegs(m, oldSegs){
  // joint pairs: hinge -> the part touching its front cell (both directions)
  const jointPairs = new Set(), hinges = [];
  for(const [k, p] of m.parts){
    if(!PARTS[p.type].hinge) continue;
    const [i, j, l] = parseKey(k); const d = facingDir(p.rot);
    const fk = m.occ.get(key(i + d[0], j + d[1], l));
    if(fk && fk !== k){ jointPairs.add(k + '>' + fk); jointPairs.add(fk + '>' + k); hinges.push({ k, p, front: fk }); }
  }
  const segOf = new Map();
  const flood = (startK, idx) => { const st = [startK]; segOf.set(startK, idx); while(st.length){ const k = st.pop(); const p = m.parts.get(k); for(const nk of neighbours(m, k, p, jointPairs)) if(!segOf.has(nk)){ segOf.set(nk, idx); st.push(nk); } } };
  const rootK = m.seatKey || m.parts.keys().next().value;
  const segs = [{ idx: 0, parent: -1, hingeKey: null, pivot: null, rel: 0, wrel: 0, keys: [] }];
  flood(rootK, 0);
  // every hinge whose front is still free starts a new segment (queue handles chains)
  let changed = true;
  while(changed){
    changed = false;
    for(const h of hinges){
      if(!segOf.has(h.k) || segOf.has(h.front)) continue;
      const idx = segs.length; const old = oldSegs && oldSegs.find(s => s.hingeKey === h.k);
      segs.push({ idx, parent: segOf.get(h.k), hingeKey: h.k, pivot: { x: h.p.lx, y: h.p.ly }, rel: old ? old.rel : 0, wrel: old ? old.wrel : 0, keys: [] });
      flood(h.front, idx); changed = true;
    }
  }
  for(const [k] of m.parts) if(!segOf.has(k)) segOf.set(k, 0);   // stragglers ride with the body
  for(const [k, p] of m.parts){ p.seg = segOf.get(k); segs[p.seg].keys.push(k); }
  // per-segment mass, centre, inertia, wheels, bounds
  for(const s of segs){
    let mass = 0, sx = 0, sy = 0, minI = 1e9, minJ = 1e9, maxI = -1e9, maxJ = -1e9;
    for(const k of s.keys){ const p = m.parts.get(k); mass += p.m; sx += p.m * p.lx; sy += p.m * p.ly;
      const [i, j, l] = parseKey(k); for(const [ci, cj] of cellsOf(i, j, p.type, l, p)){ if(ci < minI) minI = ci; if(ci > maxI) maxI = ci; if(cj < minJ) minJ = cj; if(cj > maxJ) maxJ = cj; } }
    s.mass = Math.max(0.2, mass); s.com = { x: sx / (mass || 1), y: sy / (mass || 1) };
    s.half = { x: (maxI - minI + 1) / 2 * CELL, y: (maxJ - minJ + 1) / 2 * CELL };
    s.boxC = { x: (minI + maxI) / 2 * CELL, y: (minJ + maxJ) / 2 * CELL };   // bbox centre, local
    const about = s.idx === 0 ? s.com : s.pivot;
    s.radius = Math.hypot(Math.abs(s.boxC.x - about.x) + s.half.x, Math.abs(s.boxC.y - about.y) + s.half.y);
    const ext = s.half.x + s.half.y;
    // inertia: root about its COM; a child about its pivot (parallel axis)
    const dPiv = s.idx === 0 ? 0 : Math.hypot(s.com.x - s.pivot.x, s.com.y - s.pivot.y);
    s.I = Math.max(0.4, s.mass * ext * ext / 6 + s.mass * dPiv * dPiv);
    s.wheels = m.wheels.filter(w => w.p.seg === s.idx); for(const w of s.wheels) w.seg = s.idx;
  }
  m.segs = segs;
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

/* local (grid units, incl. centre offset) <-> world, MAIN body frame */
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
/* absolute heading of a segment (root = m.a; children add their swing) */
export function segAngle(m, s){ return s.idx === 0 ? m.a : segAngle(m, m.segs[s.parent]) + s.rel; }
export function segW(m, s){ return s.idx === 0 ? m.w : segW(m, m.segs[s.parent]) + s.wrel; }
/* local -> world through a segment's swing (children pivot around their hinge) */
export function segLocalToWorld(m, s, lx, ly, out = {}){
  if(!s || s.idx === 0) return localToWorld(m, lx, ly, out);
  const P = segLocalToWorld(m, m.segs[s.parent], s.pivot.x, s.pivot.y, {});
  const A = segAngle(m, s), ca = Math.cos(A), sa = Math.sin(A);
  const dx = lx - s.pivot.x, dy = ly - s.pivot.y;
  out.x = P.x + dx * ca - dy * sa; out.y = P.y + dx * sa + dy * ca; return out;
}
/* velocity of a world point riding on segment s */
function pointVel(m, s, wx, wy, out = {}){
  if(!s || s.idx === 0){ out.x = m.vx - m.w * (wy - m.y); out.y = m.vy + m.w * (wx - m.x); return out; }
  const P = segLocalToWorld(m, m.segs[s.parent], s.pivot.x, s.pivot.y, {});
  const vp = pointVel(m, m.segs[s.parent], P.x, P.y, {});
  const W = segW(m, s);
  out.x = vp.x - W * (wy - P.y); out.y = vp.y + W * (wx - P.x); return out;
}
/* world position of a part (by its anchor key) — through its segment */
export function cellWorld(m, k, out){
  const p = m.parts.get(k);
  if(!p){ const [i, j] = parseKey(k); return localToWorld(m, i * CELL, j * CELL, out); }
  return segLocalToWorld(m, m.segs[p.seg || 0], p.lx, p.ly, out);
}
/* world-facing unit vector of a part (its rot on top of its segment's heading) */
export function partFacing(m, p, out = {}){ const A = segAngle(m, m.segs[p.seg || 0]) + (p.rot & 3) * Math.PI / 2; out.x = Math.sin(A); out.y = -Math.cos(A); out.a = A; return out; }
/* topmost occupied layer at a local cell (or -1) */
export function topAt(m, ci, cj){ for(let l = m.layers - 1; l >= 0; l--) if(m.occ.has(key(ci, cj, l))) return l; return -1; }
/* which ground wheels a drive/brake block works on: its configured list (that still exists) or all of them */
function wheelsFor(m, p){
  const w = p.cfg && p.cfg.wheels;
  if(w && w.length){ const list = m.wheels.filter(x => w.includes(x.k)); if(list.length) return list; }
  return m.wheels;
}

/* ---- power: what every engine / motor / brake / thruster asks of the wheels this step ---- */
function powerTick(m, dt, world){
  const A = m.act;
  for(const wh of m.wheels){ wh.drive = 0; wh.brake = 0; }
  const breath = m.engineNeeds ? Math.min(1, m.freeIntakes / m.engineNeeds) : 1;     // V8 / JET need an intake each; the rest just like them
  const bonus = 1 + 0.08 * Math.min(3, m.freeIntakes);                               // "intakes improve it slightly"
  const turboK = 1 + 0.35 * Math.min(m.freeTurbos, m.engines);
  const speed = Math.hypot(m.vx, m.vy);
  let usedBoost = false;
  for(const e of m.eng){
    const p = e.p; let thr = A.get(e.k) || 0; thr = Math.max(-0.6, Math.min(1, thr));
    p.on = 0;
    if(e.motor){
      if(thr === 0 || m.battMax <= 0 || m.batt <= 0) continue;
      const F = TUNE.motP * thr; const list = wheelsFor(m, p);
      for(const wh of list) wh.drive += F / list.length;
      m.batt = Math.max(0, m.batt - TUNE.motRate * Math.abs(thr) * dt);
      p.on = Math.abs(thr); continue;
    }
    const br = e.needs ? breath : 1;
    if(e.jet){
      // spools up slow, pushes from where it sits, along its facing — no wheels needed, works in the air
      const want = thr > 0 && m.fuel > 0 && br > 0 ? thr : 0;
      p.spool += (want - p.spool) * Math.min(1, dt / 1.4);
      if(p.spool > 0.01 && m.fuel > 0){
        const F = e.power * TUNE.engP * br * bonus * p.spool;
        const f = partFacing(m, p), wp = cellWorld(m, e.k);
        applyForce(m, f.x * F, f.y * F, wp.x - m.x, wp.y - m.y, dt);
        m.fuel = Math.max(0, m.fuel - e.burn * TUNE.fuelRate * p.spool * dt);
        p.on = p.spool; p.spin += p.spool * 30 * dt;
      }
      continue;
    }
    if(thr === 0 || m.fuelMax <= 0 || m.fuel <= 0 || br <= 0) continue;
    const F = e.power * TUNE.engP * br * bonus * turboK * thr; const list = wheelsFor(m, p);
    for(const wh of list) wh.drive += F / list.length;
    m.fuel = Math.max(0, m.fuel - e.burn * TUNE.fuelRate * br * turboK * Math.abs(thr) * dt);
    p.on = Math.abs(thr);
  }
  if(m.boosting && m.battMax > 0 && m.batt > 0 && m.wheels.length){
    for(const wh of m.wheels) wh.drive += TUNE.boostP / m.wheels.length;
    m.batt = Math.max(0, m.batt - TUNE.boostRate * dt); usedBoost = true;
  }
  for(const b of m.brakes){
    const amt = Math.min(1, (A.get(b.k) || 0) * (b.p.cfg && b.p.cfg.amount != null ? b.p.cfg.amount : 1));
    b.p.on = amt; if(amt <= 0) continue;
    for(const wh of wheelsFor(m, b.p)) wh.brake = Math.max(wh.brake, amt);
  }
  for(const t of m.thrusters){
    const p = t.p; const on = Math.min(1, A.get(t.k) || 0);
    const ok = on > 0 && (t.fuel ? (m.fuelMax > 0 && m.fuel > 0) : (m.battMax > 0 && m.batt > 0));
    p.on += ((ok ? on : 0) - p.on) * Math.min(1, dt * 10);
    if(!ok) continue;
    const F = t.f * TUNE.thrustP * on;
    const f = partFacing(m, p), wp = cellWorld(m, t.k);
    applyForce(m, f.x * F, f.y * F, wp.x - m.x, wp.y - m.y, dt);
    if(t.fuel) m.fuel = Math.max(0, m.fuel - t.fuel * on * dt); else m.batt = Math.max(0, m.batt - t.batt * on * dt);
  }
  // rotors: spin up while held (the car feels the reaction), two at full spin lift you off the ground
  let fullSpin = 0;
  for(const r of m.rotors){
    const p = r.p; const on = Math.min(1, A.get(r.k) || 0) * (p.cfg && p.cfg.amount != null ? p.cfg.amount : 1);
    const want = on * 30; const prev = p.rs;
    p.rs += (want - p.rs) * Math.min(1, dt * (on ? 1.6 : 2.5));
    m.w -= (p.rs - prev) * TUNE.rotorT * m.invI * 0.5;
    p.spin += p.rs * dt; p.on = p.rs / 30;
    if(p.rs > 26) fullSpin++;
  }
  if(fullSpin >= 2){ if(!m.air && !m.hopLatch){ m.air = true; m.vz = 7; m.hopLatch = true; } } else m.hopLatch = false;
  // pistons: edge-triggered punch (main.js decides who gets hit); walls punch back
  for(const pi of m.pistons){
    const p = pi.p; const on = (A.get(pi.k) || 0) > 0;
    if(on && !p.wasOn && p.ext <= 0.05){
      p.ext = 1; const f = partFacing(m, p), wp = cellWorld(m, pi.k);
      const tipx = wp.x + f.x * 0.9, tipy = wp.y + f.y * 0.9;
      m.punch = { x: tipx, y: tipy, fx: f.x, fy: f.y, k: pi.k };
      // a wall within reach → kick off it (and a lil hop)
      for(const wl of world.walls){ if(tipx >= wl.x0 - 0.3 && tipx <= wl.x1 + 0.3 && tipy >= wl.y0 - 0.3 && tipy <= wl.y1 + 0.3 && m.z <= wl.h){ m.vx -= f.x * TUNE.punchV; m.vy -= f.y * TUNE.punchV; if(!m.air){ m.air = true; m.vz = 4; } m.punch.wall = true; break; } }
    }
    p.wasOn = on; p.ext = Math.max(0, p.ext - dt * 3.2); p.on = p.ext;
  }
  if(m.freeFans > 0 && m.battMax > 0 && speed > 2)
    m.batt = Math.min(m.battMax, m.batt + m.freeFans * TUNE.fanRate * speed * dt);
  if(m.solarFree > 0 && m.battMax > 0)
    m.batt = Math.min(m.battMax, m.batt + m.solarFree * 1.2 * dt);   // the sun is always out in kRacing
  return usedBoost;
}

function applyForce(m, fx, fy, rx, ry, dt){
  m.vx += fx * dt / m.mass; m.vy += fy * dt / m.mass;
  m.w += (rx * fy - ry * fx) * m.invI * dt;
}

/* ---- physics step (only for machines this client simulates) -------------- */
export function stepMachine(m, world, dt, onImpact){
  if(m.parts.size === 0 || !m.segs.length) return;
  m.grace = Math.max(0, m.grace - dt);
  m.squash = Math.max(0, m.squash - dt * 4);
  powerTick(m, dt, world);   // (m.punch is consumed by main.js, not cleared here — substeps must not eat it)
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
    const wingGrip = 1 + Math.min(1.2, m.wings * 0.10 * speed * 0.06);
    const steerA = m.steer * TUNE.steerMax / (1 + speed / 45);
    m.steerVis += (steerA - m.steerVis) * Math.min(1, dt * 14);
    for(const s of m.segs){
      const A = segAngle(m, s);
      const pivW = s.idx === 0 ? null : segLocalToWorld(m, m.segs[s.parent], s.pivot.x, s.pivot.y, {});
      for(const wh of s.wheels){
        const load = (s.mass * GRAV * wh.load) * 0.06;          // its share of the weight
        const W = segLocalToWorld(m, s, wh.lx, wh.ly, {});
        const rx = W.x - m.x, ry = W.y - m.y;
        const pv = pointVel(m, s, W.x, W.y, {});
        const aa = A + (wh.steer ? steerA : 0);
        const fx = Math.sin(aa), fy = -Math.cos(aa), sx = Math.cos(aa), sy = Math.sin(aa);
        const slip = pv.x * sx + pv.y * sy;
        const onRoad = world.surfaceAt ? world.surfaceAt(W.x, W.y) === 1 : true;
        let surf = (world.gripAt ? world.gripAt(W.x, W.y) : 1) * (onRoad ? wh.road : wh.off) * wh.gk;   // tyre compound × size × surface
        if(world.slipAt) surf *= world.slipAt(W.x, W.y);                                          // oil / peels
        if(wh.flat) surf *= 0.5;
        const fSpeed = pv.x * fx + pv.y * fy;
        if(wh.brake > 0 && Math.abs(fSpeed) > 3) surf *= (1 - 0.5 * wh.brake);                    // locked wheels slide
        let gripF = -slip * TUNE.grip * wingGrip * surf;
        gripF = Math.max(-load * 3, Math.min(load * 3, gripF));
        let driveF = wh.drive - fSpeed * TUNE.roll;
        if(wh.brake > 0){ const fb = Math.min(TUNE.brakeP * wh.brake * (wh.load * s.wheels.length), Math.abs(fSpeed) * m.mass * wh.load / dt); driveF -= Math.sign(fSpeed) * fb; }
        const Fx = sx * gripF * m.mass * 0.25 + fx * driveF, Fy = sy * gripF * m.mass * 0.25 + fy * driveF;
        if(s.idx === 0) applyForce(m, Fx, Fy, rx, ry, dt);
        else {
          // a trailer wheel: torque about the hinge, and the hinge drags the body
          const ax = W.x - pivW.x, ay = W.y - pivW.y;
          s.wrel += (ax * Fy - ay * Fx) / s.I * dt;
          applyForce(m, Fx, Fy, pivW.x - m.x, pivW.y - m.y, dt);
        }
        wh.spin += fSpeed / 0.29 * dt;
        wh.slip = Math.abs(slip); wh.surf = surf;
      }
    }
  }
  // hinges swing: joint friction, limits
  for(const s of m.segs){
    if(s.idx === 0) continue;
    s.wrel *= Math.pow(m.air ? 0.6 : 0.2, dt);
    s.rel += s.wrel * dt;
    if(s.rel > TUNE.hingeLimit){ s.rel = TUNE.hingeLimit; if(s.wrel > 0) s.wrel = 0; }
    if(s.rel < -TUNE.hingeLimit){ s.rel = -TUNE.hingeLimit; if(s.wrel < 0) s.wrel = 0; }
  }

  // aero drag from your cross-section — long and low beats wide and tall
  const v2 = m.vx * m.vx + m.vy * m.vy;
  if(v2 > 0.01){
    const k = m.cd * Math.sqrt(v2) * dt / Math.max(1, m.mass * 0.4);
    m.vx -= m.vx * k; m.vy -= m.vy * k;
  }

  m.x += m.vx * dt; m.y += m.vy * dt; m.a += m.w * dt;
  m.w *= Math.pow(m.air ? 0.8 : 0.35 * Math.pow(0.5, m.fins), dt);   // fins = stability
  if(m.air){ m.vx *= Math.pow(0.9, dt); m.vy *= Math.pow(0.9, dt); }
  // smoothed local acceleration (the antenna wobbles with it)
  { const ax = (m.vx - m.pvx) / dt, ay = (m.vy - m.pvy) / dt; m.pvx = m.vx; m.pvy = m.vy; const ca = Math.cos(m.a), sa = Math.sin(m.a);
    const lx = ax * ca + ay * sa, ly = -ax * sa + ay * ca; const k = Math.min(1, dt * 6); m.acc.x += (lx - m.acc.x) * k; m.acc.y += (ly - m.acc.y) * k; }

  wallHits(m, world, onImpact);
}

function wallHits(m, world, onImpact){
  for(const s of m.segs){
    const r = s.radius * 0.8;
    const C = s.idx === 0 ? { x: m.x, y: m.y } : segLocalToWorld(m, s, s.com.x, s.com.y, {});
    for(const wl of world.walls){
      if(m.z > wl.h) continue;
      const cx = Math.max(wl.x0, Math.min(wl.x1, C.x)), cy = Math.max(wl.y0, Math.min(wl.y1, C.y));
      const dx = C.x - cx, dy = C.y - cy, d2 = dx * dx + dy * dy;
      if(d2 > r * r) continue;
      let d = Math.sqrt(d2), nx, ny;
      if(d < 1e-4){
        const l = C.x - wl.x0, rr = wl.x1 - C.x, t = C.y - wl.y0, b = wl.y1 - C.y, mn = Math.min(l, rr, t, b);
        nx = mn === l ? -1 : mn === rr ? 1 : 0; ny = mn === t ? -1 : mn === b ? 1 : 0; d = 0;
      } else { nx = dx / d; ny = dy / d; }
      const pen = r - d;
      m.x += nx * pen; m.y += ny * pen;
      const vn = m.vx * nx + m.vy * ny;
      if(vn < 0){
        const J = -vn * m.mass;
        m.vx -= vn * nx * 1.4; m.vy -= vn * ny * 1.4;
        if(s.idx > 0){ const P = segLocalToWorld(m, m.segs[s.parent], s.pivot.x, s.pivot.y, {}); s.wrel += ((C.x - P.x) * ny - (C.y - P.y) * nx) * (-vn) * 0.4 / s.I; }
        if(J > TUNE.wallThresh && onImpact) onImpact(m, J, cx, cy);
      }
    }
  }
}

/* every segment as a world circle (bumping, ropes, proximity) */
export function segCircles(m){
  if(!m.segs || !m.segs.length) return [{ x: m.x, y: m.y, r: m.radius, s: null }];
  return m.segs.map(s => s.idx === 0 ? { x: m.x, y: m.y, r: m.radius, s } : { ...segLocalToWorld(m, s, s.com.x, s.com.y, {}), r: s.radius, s });
}

/* machine-vs-machine bump: push ME away, report impulse (both clients run this
   for their own machine, so nobody moves anyone else's body) */
export function bumpMachines(me, other, onImpact){
  if(!other.parts.size || Math.abs(me.z - other.z) > 0.8) return;
  const mine = segCircles(me), theirs = segCircles(other);
  for(const a of mine) for(const b of theirs){
    const dx = a.x - b.x, dy = a.y - b.y;
    const r = (a.r + b.r) * 0.72;
    const d2 = dx * dx + dy * dy;
    if(d2 > r * r || d2 < 1e-6) continue;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = r - d;
    me.x += nx * pen * 0.6; me.y += ny * pen * 0.6;
    const rvx = me.vx - (other.vx || 0), rvy = me.vy - (other.vy || 0);
    const vn = rvx * nx + rvy * ny;
    if(vn < 0){
      const J = -vn * me.mass * 0.8;
      me.vx -= vn * nx * 1.1; me.vy -= vn * ny * 1.1;
      if(a.s && a.s.idx > 0){ const P = segLocalToWorld(me, me.segs[a.s.parent], a.s.pivot.x, a.s.pivot.y, {}); a.s.wrel += ((a.x - P.x) * ny - (a.y - P.y) * nx) * (-vn) * 0.4 / a.s.I; }
      if(J > 22 && onImpact) onImpact(me, J, b.x + nx * b.r, b.y + ny * b.r, other);
    }
  }
}

/* ---- shearing: pick exposed parts near the hit and rip them off --------- */
export function shearParts(m, impulse, ax, ay){
  const n = Math.min(3, 1 + Math.floor(impulse / 60));
  const cands = [];
  for(const [k, p] of m.parts){
    const [i, j, l] = parseKey(k);
    const def = PARTS[p.type];
    if(impulse * TUNE.shearScale < def.shear * 2) continue;
    // exposed only: some covered cell has an open neighbour (sideways, above or below)
    let exposed = false;
    outer:
    for(const [ci, cj] of cellsOf(i, j, p.type, l, p))
      for(const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]){
        if(l + d[2] < 0){ continue; }
        if(!m.occ.has(key(ci + d[0], cj + d[1], l + d[2]))){ exposed = true; break outer; }
      }
    if(!exposed) continue;
    const wp = cellWorld(m, k);
    const dist = Math.hypot(wp.x - ax, wp.y - ay) + l * 0.2;
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
      for(const [ci, cj] of cellsOf(i, j, p.type, l, p)) if(m.occ.has(key(ci, cj, l - 1))){ held = true; break; }
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
  if(m.net.sa) m.segs.forEach((s, i) => { if(i > 0 && m.net.sa[i - 1] != null) s.rel += (m.net.sa[i - 1] - s.rel) * k; });
}

/* ---- drawing --------------------------------------------------------------- */
export function drawMachine(ctx, m, zoom, t, ghostAlpha = 1, opts = {}){
  if(!m.parts.size || !m.segs.length) return;
  const lift = m.z * 0.5, sc = 1 + m.z * 0.03;
  if(ghostAlpha >= 1){
    for(const s of m.segs){
      const C = s.idx === 0 ? { x: m.x, y: m.y } : segLocalToWorld(m, s, s.com.x, s.com.y, {});
      ctx.save(); ctx.translate(C.x, C.y); ctx.rotate(segAngle(m, s));
      const k = Math.max(0.45, 1 - m.z * 0.06);
      const bx = s.idx === 0 ? m.boxC.x : s.boxC.x - s.com.x, by = s.idx === 0 ? m.boxC.y : s.boxC.y - s.com.y;
      shadow(ctx, bx, by, (s.half.x + 0.12) * (0.7 + 0.3 * k), (s.half.y + 0.12) * (0.7 + 0.3 * k), 0.2 * k);
      ctx.restore();
    }
  }
  const spinning = m.freeFans > 0 && (m.vx * m.vx + m.vy * m.vy) > 4;
  const list = [...m.parts].map(([k, p]) => ({ k, p, l: p.l || 0 })).sort((a, b) => a.l - b.l);
  for(const s of m.segs){
    ctx.save();
    if(s.idx === 0){ ctx.translate(m.x, m.y - lift); ctx.rotate(m.a); const sq = m.squash; ctx.scale(sc * (1 + sq * 0.12), sc * (1 - sq * 0.12)); ctx.translate(-m.center.x, -m.center.y); }
    else { const P = segLocalToWorld(m, m.segs[s.parent], s.pivot.x, s.pivot.y, {}); ctx.translate(P.x, P.y - lift); ctx.rotate(segAngle(m, s)); ctx.scale(sc, sc); ctx.translate(-s.pivot.x, -s.pivot.y); }
    // layer by layer, flat: the top tile covers what's under it; a lil badge says how tall the stack is
    for(const { k, p, l } of list){
      if((p.seg || 0) !== s.idx) continue;
      const def = PARTS[p.type];
      ctx.save(); ctx.translate(p.lx, p.ly);
      let steer = 0;
      if(def.wheel && l === 0){ const wh = m.wheels.find(w => w.k === k); if(wh && wh.steer) steer = m.steerVis; }
      const alpha = (opts.xray && def.panel) ? ghostAlpha * 0.45 : ghostAlpha;
      const inst = { p, t, on: p.on || 0, text: def.text ? ((p.cfg && p.cfg.text) || opts.name || '') : null };
      if(def.antenna) drawAntenna(ctx, m, p);
      drawPart(ctx, p.type, p.rot, zoom, alpha, def.rotor || def.engine && def.engine.jet ? p.spin : (spinning ? t * 12 : 0), steer, inst);
      if(def.wheel && p.flat){ ctx.fillStyle = rgba(PAL.red, 0.7); ctx.beginPath(); ctx.arc(0, 0, 0.09, 0, 7); ctx.fill(); }
      if(def.hinge && ghostAlpha >= 1){ ctx.beginPath(); ctx.arc(0, 0, 0.07, 0, 7); ctx.fillStyle = hex(PAL.ink); ctx.fill(); }
      if(l > 0 && ghostAlpha >= 1){
        const [w, d] = fpOf(p.type, p).map(v => v * CELL);
        ctx.beginPath(); ctx.arc(w / 2 - 0.09, -d / 2 + 0.09, 0.085, 0, Math.PI * 2); ctx.fillStyle = hex(PAL.ink); ctx.fill();
        ctx.fillStyle = hex(PAL.paper); ctx.font = '900 0.12px Trebuchet MS, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(l + 1), w / 2 - 0.09, -d / 2 + 0.1);
      }
      ctx.restore();
    }
    // centre-of-mass marker (garage / build)
    if(opts.com && s.idx === 0){
      ctx.save(); ctx.translate(m.center.x, m.center.y);
      ctx.beginPath(); ctx.arc(0, 0, 0.16, 0, Math.PI * 2); ctx.fillStyle = hex(PAL.paper); ctx.fill(); ctx.lineWidth = 0.04; ctx.strokeStyle = hex(PAL.ink); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 0.16, -Math.PI / 2, 0); ctx.closePath(); ctx.fillStyle = hex(PAL.ink); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 0.16, Math.PI / 2, Math.PI); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}
function drawAntenna(ctx, m, p){
  // the mast leans AGAINST the acceleration (in the body frame), a ball on top
  const k = 0.012, tx = -m.acc.x * k, ty = -m.acc.y * k - 0.02;
  const L = Math.min(0.45, Math.hypot(tx, ty) + 0.05), ang = Math.atan2(ty, tx);
  const ex = Math.cos(ang) * L, ey = Math.sin(ang) * L;
  ctx.lineWidth = 0.05; ctx.strokeStyle = hex(PAL.antenna); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0.15); ctx.quadraticCurveTo(ex * 0.4, 0.15 + ey * 0.4 - 0.15, ex, 0.15 + ey - 0.3); ctx.stroke();
  ctx.beginPath(); ctx.arc(ex, 0.15 + ey - 0.3, 0.08, 0, 7); ctx.fillStyle = hex(PAL.red); ctx.fill();
}
