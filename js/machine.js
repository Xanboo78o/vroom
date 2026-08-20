/* =============================================================================
   machine.js — a machine is a grid of parts that becomes ONE rigid body.
   Hand-rolled physics: raycast wheels, springs, grip, drag from FRONTAL AREA
   (your shape literally is your top speed). Impacts shear parts off for real.
   Power: engines burn fuel and need breathing intakes; motors drain batteries;
   fans charge batteries from airflow; both at once = hybrid VROOM.
   ============================================================================= */
import * as THREE from 'three';
import { PARTS, CELL, buildPartMesh, facingDir } from './parts.js';

const G = 22;                    // gravity, tuned arcade-heavy
const key = (x, y, z) => x + ',' + y + ',' + z;

export const TUNE = {
  engP: 95,          // drive force per breathing engine
  motP: 72,          // drive force per powered motor
  boostP: 130,       // extra force while boosting (drains battery fast)
  fuelRate: 0.9,     // fuel % per second per engine at full throttle
  motRate: 2.2,      // battery % per second per motor
  boostRate: 14,
  fanRate: 0.16,     // battery % per second per fan per unit speed
  dragBase: 0.012,
  dragArea: 0.010,   // per frontal cell — shape matters
  grip: 8.5,
  steerMax: 0.55,
  spring: 260, damper: 26,
  wheelRadius: CELL * 0.48, susLen: CELL * 0.45,
  shearScale: 1.0,
};

let nextId = 1;
export function makeMachine(owner, pos){
  return {
    id: owner + ':' + (nextId++),
    owner, driver: null,
    pos: pos.clone(), quat: new THREE.Quaternion(),
    vel: new THREE.Vector3(), angVel: new THREE.Vector3(),
    parts: new Map(),            // "x,y,z" -> {type, rot}
    fuel: 100, batt: 100, grace: 2,   // no shearing right after spawn/settle
    steer: 0, throttle: 0, boosting: false,
    // caches (rebuilt by refresh())
    mass: 1, invI: 1, wheels: [], engines: 0, freeIntakes: 0,
    motors: 0, fans: 0, freeFans: 0, wings: 0, tanks: 0, batts: 0,
    seatKey: null, frontal: 1, radius: 1, half: new THREE.Vector3(1, 1, 1),
    center: new THREE.Vector3(),
    group: null,                 // THREE group (main.js owns adding to scene)
    remote: false,               // true = another client simulates it
    netP: null, netQ: null,      // interpolation targets for remote machines
  };
}

// the starter machine everyone spawns with — hand-authored layout
export function starterLayout(){
  const p = new Map();
  for(let z = -1; z <= 2; z++) for(let x = -1; x <= 0; x++) p.set(key(x, 0, z), { type: 'frame', rot: 0 });
  p.set(key(0, 1, 0), { type: 'seat', rot: 0 });
  p.set(key(-1, 1, 2), { type: 'engine', rot: 0 });
  p.set(key(0, 1, 2), { type: 'intake', rot: 0 });
  p.set(key(-1, 1, 1), { type: 'tank', rot: 0 });
  p.set(key(-2, 0, 2), { type: 'wheel', rot: 0 });
  p.set(key(1, 0, 2), { type: 'wheel', rot: 0 });
  p.set(key(-2, 0, -1), { type: 'wheel', rot: 0 });
  p.set(key(1, 0, -1), { type: 'wheel', rot: 0 });
  return p;
}

export function serializeParts(m){
  return [...m.parts.entries()].map(([k, p]) => [k, p.type, p.rot]);
}
export function loadParts(m, arr){
  m.parts.clear();
  for(const [k, type, rot] of arr) m.parts.set(k, { type, rot });
  refresh(m);
}

/* ---- derived caches ------------------------------------------------------ */
export function refresh(m){
  let mass = 0, engines = 0, motors = 0, fans = 0, freeFans = 0, wings = 0,
      tanks = 0, batts = 0, freeIntakes = 0;
  m.wheels = []; m.seatKey = null;
  const min = new THREE.Vector3(1e9, 1e9, 1e9), max = new THREE.Vector3(-1e9, -1e9, -1e9);
  const frontCells = new Set();

  for(const [k, p] of m.parts){
    const [x, y, z] = k.split(',').map(Number);
    const def = PARTS[p.type];
    mass += def.mass;
    min.min(new THREE.Vector3(x, y, z)); max.max(new THREE.Vector3(x, y, z));
    frontCells.add(x + '|' + y);
    if(p.type === 'seat' && !m.seatKey) m.seatKey = k;
    if(p.type === 'engine') engines++;
    if(p.type === 'motor') motors++;
    if(p.type === 'tank') tanks++;
    if(p.type === 'battery') batts++;
    if(p.type === 'wing') wings++;
    if(p.type === 'intake' || p.type === 'fan'){
      const d = facingDir(p.rot);
      const clear = !m.parts.has(key(x + d[0], y + d[1], z + d[2]));
      if(p.type === 'intake' && clear) freeIntakes++;
      if(p.type === 'fan'){ fans++; if(clear) freeFans++; }
    }
    if(p.type === 'wheel') m.wheels.push({ k, x, y, z, steer: false, spin: 0 });
  }
  if(m.parts.size === 0){ m.mass = 1; return; }

  m.center.set((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2).multiplyScalar(CELL);
  m.half.set((max.x - min.x) / 2 + .5, (max.y - min.y) / 2 + .5, (max.z - min.z) / 2 + .5).multiplyScalar(CELL);
  m.radius = Math.hypot(m.half.x, m.half.z);
  m.mass = Math.max(1, mass);
  const ext = (m.half.x + m.half.y + m.half.z) / 3 * 2;
  m.invI = 1 / Math.max(0.4, m.mass * ext * ext / 6);
  m.engines = engines; m.motors = motors; m.fans = fans; m.freeFans = freeFans;
  m.tanks = tanks; m.batts = batts; m.wings = wings; m.freeIntakes = freeIntakes;
  m.frontal = frontCells.size;
  // front-half wheels steer
  const midZ = (min.z + max.z) / 2;
  for(const w of m.wheels) w.steer = w.z > midZ + 0.01;
}

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
  // fans harvest airflow
  const speed = m.vel.length();
  if(m.freeFans > 0 && m.batts > 0 && speed > 2)
    m.batt = Math.min(100, m.batt + m.freeFans * TUNE.fanRate * speed * dt);
  return force;
}

/* ---- physics step (only for machines this client simulates) -------------- */
const _up = new THREE.Vector3(), _fwd = new THREE.Vector3(), _side = new THREE.Vector3();
const _wp = new THREE.Vector3(), _rel = new THREE.Vector3(), _pv = new THREE.Vector3(), _f = new THREE.Vector3();

function applyForce(m, F, at, dt){
  m.vel.addScaledVector(F, dt / m.mass);
  _rel.copy(at).sub(m.pos);
  const tq = new THREE.Vector3().crossVectors(_rel, F);
  m.angVel.addScaledVector(tq, dt * m.invI);
}

export function stepMachine(m, world, dt, onImpact){
  if(m.parts.size === 0) return;
  m.grace = Math.max(0, m.grace - dt);
  const drive = m.driver ? powerTick(m, dt) : (powerTick(m, dt), 0);

  m.vel.y -= G * dt;
  _up.set(0, 1, 0).applyQuaternion(m.quat);
  _fwd.set(0, 0, 1).applyQuaternion(m.quat);
  _side.set(1, 0, 0).applyQuaternion(m.quat);

  // wheels: suspension + grip + drive
  let grounded = 0;
  const wingGrip = 1 + Math.min(1.2, m.wings * 0.10 * m.vel.length() * 0.06);
  for(const w of m.wheels){
    _wp.set(w.x * CELL, w.y * CELL, w.z * CELL).sub(m.center).applyQuaternion(m.quat).add(m.pos);
    const gy = world.h(_wp.x, _wp.z);
    const compress = (TUNE.wheelRadius + TUNE.susLen) - (_wp.y - gy);
    if(compress <= 0){ w.spin *= 0.98; continue; }
    grounded++;
    // point velocity
    _rel.copy(_wp).sub(m.pos);
    _pv.crossVectors(m.angVel, _rel).add(m.vel);
    const springF = TUNE.spring * compress - TUNE.damper * _pv.y;
    if(springF > 0){
      _f.set(0, springF, 0);
      applyForce(m, _f, _wp, dt);
    }
    // steering basis
    let f = _fwd, s = _side;
    if(w.steer && Math.abs(m.steer) > 0.01){
      const a = -m.steer * TUNE.steerMax;
      f = _fwd.clone().applyAxisAngle(_up, a);
      s = _side.clone().applyAxisAngle(_up, a);
    }
    // lateral grip (flattened to ground plane)
    const slip = _pv.dot(s);
    const load = Math.max(0, springF) * 0.06;
    const gripF = THREE.MathUtils.clamp(-slip * TUNE.grip * wingGrip, -load * 3, load * 3);
    _f.copy(s).multiplyScalar(gripF * m.mass * 0.25); _f.y = 0;
    applyForce(m, _f, _wp, dt);
    // drive + rolling drag
    const fSpeed = _pv.dot(f);
    let driveF = (drive / Math.max(1, m.wheels.length)) * m.throttle;
    driveF -= fSpeed * 0.35;                       // rolling/engine drag
    _f.copy(f).multiplyScalar(driveF); _f.y = 0;
    applyForce(m, _f, _wp, dt);
    w.spin += fSpeed / TUNE.wheelRadius * dt;
  }

  // aero drag from FRONTAL AREA — long and low beats tall and boxy
  const v2 = m.vel.lengthSq();
  if(v2 > 0.01){
    const cd = TUNE.dragBase + m.frontal * TUNE.dragArea;
    _f.copy(m.vel).normalize().multiplyScalar(-cd * v2);
    m.vel.addScaledVector(_f, dt / Math.max(1, m.mass * 0.4));
  }

  // integrate
  m.pos.addScaledVector(m.vel, dt);
  const w = m.angVel;
  const dq = new THREE.Quaternion(w.x * dt / 2, w.y * dt / 2, w.z * dt / 2, 0).multiply(m.quat);
  m.quat.x += dq.x; m.quat.y += dq.y; m.quat.z += dq.z; m.quat.w += dq.w;
  m.quat.normalize();
  m.angVel.multiplyScalar(Math.pow(0.35, dt));     // angular damping
  if(grounded === 0) m.angVel.multiplyScalar(Math.pow(0.8, dt));

  // body-vs-ground (belly landing) — hard hits shear parts
  bodyGround(m, world, dt, onImpact);
  // walls
  wallHits(m, world, onImpact);
}

function bodyGround(m, world, dt, onImpact){
  // sample the 4 bottom corners of the bbox
  let worst = 0, hitAt = null;
  for(const sx of [-1, 1]) for(const sz of [-1, 1]){
    _wp.set(m.half.x * sx, -m.half.y, m.half.z * sz).applyQuaternion(m.quat).add(m.pos);
    const gy = world.h(_wp.x, _wp.z);
    const pen = gy - _wp.y - 0.12;      // slack so wheel springs absorb first
    if(pen > 0){
      m.pos.y += pen * 0.5;
      _rel.copy(_wp).sub(m.pos);
      _pv.crossVectors(m.angVel, _rel).add(m.vel);
      if(_pv.y < 0){
        const J = -_pv.y * m.mass * 0.5;
        if(J > worst){ worst = J; hitAt = _wp.clone(); }
        _f.set(0, -_pv.y * m.mass * 0.35 / dt * dt, 0);   // impulse-ish
        applyForce(m, _f.multiplyScalar(1 / dt), _wp, dt);
        m.vel.y = Math.max(m.vel.y, -1);
      }
    }
  }
  if(worst > 46 && hitAt && onImpact) onImpact(m, worst, hitAt);
}

function wallHits(m, world, onImpact){
  for(const wall of world.walls){
    // machine as a circle in XZ vs wall AABB
    const cx = THREE.MathUtils.clamp(m.pos.x, wall.min.x, wall.max.x);
    const cz = THREE.MathUtils.clamp(m.pos.z, wall.min.z, wall.max.z);
    if(m.pos.y - m.half.y > wall.max.y) continue;
    const dx = m.pos.x - cx, dz = m.pos.z - cz;
    const d2 = dx * dx + dz * dz, r = m.radius * 0.8;
    if(d2 > r * r) continue;
    const d = Math.sqrt(d2) || 0.001;
    const nx = dx / d, nz = dz / d;
    const pen = r - d;
    m.pos.x += nx * pen; m.pos.z += nz * pen;
    const vn = m.vel.x * nx + m.vel.z * nz;
    if(vn < 0){
      const J = -vn * m.mass;
      m.vel.x -= vn * nx * 1.4; m.vel.z -= vn * nz * 1.4;   // bounce a bit
      if(J > 20 && onImpact) onImpact(m, J, new THREE.Vector3(cx, m.pos.y, cz));
    }
  }
}

/* machine-vs-machine bump: push ME away, report impulse (both clients run this
   for their own machine, so nobody moves anyone else's body) */
export function bumpMachines(me, other, onImpact){
  const dx = me.pos.x - other.pos.x, dz = me.pos.z - other.pos.z;
  const dy = Math.abs(me.pos.y - other.pos.y);
  if(dy > me.half.y + other.half.y) return;
  const r = (me.radius + other.radius) * 0.72;
  const d2 = dx * dx + dz * dz;
  if(d2 > r * r || d2 < 1e-6) return;
  const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = r - d;
  me.pos.x += nx * pen * 0.6; me.pos.z += nz * pen * 0.6;
  const ovel = other.vel || new THREE.Vector3();
  const rvx = me.vel.x - ovel.x, rvz = me.vel.z - ovel.z;
  const vn = rvx * nx + rvz * nz;
  if(vn < 0){
    const J = -vn * me.mass * 0.8;
    me.vel.x -= vn * nx * 1.1; me.vel.z -= vn * nz * 1.1;
    if(J > 22 && onImpact) onImpact(me, J, new THREE.Vector3(other.pos.x + nx * other.radius, me.pos.y, other.pos.z + nz * other.radius));
  }
}

/* ---- shearing: pick exterior parts near the hit and rip them off --------- */
export function shearParts(m, impulse, atWorld){
  const local = atWorld.clone().sub(m.pos).applyQuaternion(m.quat.clone().invert()).add(m.center);
  const n = Math.min(3, 1 + Math.floor(impulse / 60));
  const cands = [];
  for(const [k, p] of m.parts){
    const [x, y, z] = k.split(',').map(Number);
    const def = PARTS[p.type];
    if(impulse * TUNE.shearScale < def.shear * 2) continue;
    // exterior only: at least one empty neighbor
    let exposed = false;
    for(const d of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])
      if(!m.parts.has(key(x + d[0], y + d[1], z + d[2]))){ exposed = true; break; }
    if(!exposed) continue;
    const dist = Math.hypot(x * CELL - local.x, y * CELL - local.y, z * CELL - local.z);
    cands.push({ k, p, dist, thresh: def.shear });
  }
  cands.sort((a, b) => a.dist - b.dist);
  const out = [];
  for(const c of cands.slice(0, 6)){
    if(out.length >= n) break;
    if(impulse * TUNE.shearScale > c.thresh * (1 + c.dist * 1.2)) out.push(c);
  }
  // never strand a machine as JUST a seat pile: fine, that's funny actually
  for(const c of out) m.parts.delete(c.k);
  if(out.length) refresh(m);
  return out;   // [{k, p:{type,rot}}]
}

/* world position of a machine grid cell */
export function cellWorld(m, x, y, z, out){
  return (out || new THREE.Vector3()).set(x * CELL, y * CELL, z * CELL).sub(m.center).applyQuaternion(m.quat).add(m.pos);
}

/* ---- visuals ------------------------------------------------------------- */
export function rebuildMesh(m){
  if(!m.group){ m.group = new THREE.Group(); m.group.userData.machine = m; }
  while(m.group.children.length) m.group.remove(m.group.children[0]);
  for(const [k, p] of m.parts){
    const [x, y, z] = k.split(',').map(Number);
    const mesh = buildPartMesh(p.type, p.rot);
    mesh.position.set(x * CELL, y * CELL, z * CELL).sub(m.center);
    mesh.userData.cellKey = k;
    m.group.add(mesh);
  }
}

export function syncMesh(m, dt){
  if(!m.group) return;
  if(m.remote && m.netP){
    m.pos.lerp(m.netP, Math.min(1, dt * 10));
    m.quat.slerp(m.netQ, Math.min(1, dt * 10));
  }
  m.group.position.copy(m.pos);
  m.group.quaternion.copy(m.quat);
  // spin fans while charging
  if(m.freeFans > 0 && m.vel.lengthSq() > 4){
    m.group.traverse(o => { if(o.name === 'spin') o.rotation.z += dt * 12; });
  }
}
