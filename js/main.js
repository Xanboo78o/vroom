/* =============================================================================
   main.js — VROOM (working title). Build machines out of Lego parts, race your
   friends on one hand-made map, knock each other's wheels off, steal them.
   ============================================================================= */
import * as THREE from 'three';
import { PARTS, PART_ORDER, CELL, buildPartMesh, mat, shade } from './parts.js';
import { makeMachine, starterLayout, serializeParts, loadParts, refresh, rebuildMesh,
         syncMesh, stepMachine, bumpMachines, shearParts, cellWorld, TUNE } from './machine.js';
import { buildWorld, WORLD, inPit } from './world.js';
import { makeGuy, stepGuy, syncRemoteGuy, eject, fillGuyMesh } from './guy.js';
import { loadArt } from './art.js';
import { NET, makeCode } from './net.js';
import { VOICE } from './voice.js';

const $ = s => document.querySelector(s);
const key = (x, y, z) => x + ',' + y + ',' + z;
const GUY_COLORS = [0xe8574f, 0x5aa7e0, 0x46c2a5, 0xe0c23e, 0x9b6fd6, 0xe8804f, 0x6fd6d0, 0x92bd63];

const G = {
  scene: null, camera: null, renderer: null,
  me: null, guys: new Map(), machines: new Map(), debris: new Map(),
  mode: 'menu', solo: true,
  camYaw: 0, camDist: 14,          // camDist = camera height (top-down)
  buildCamPos: null,               // frozen view point while building (Ctrl+G re-centers)
  shad: new Map(),
  input: {},
  buildSel: 'frame', buildRot: 0, buildTarget: null, ghost: null, ghostCell: null,
  carried: [],
  roomCfg: { repair: 'any' },
  lap: { next: -1, t0: 0, last: 0, best: 0 },
  board: new Map(),
  sendT: 0, debrisN: 1,
};
window.VR = { G, NET, TUNE, WORLD, VOICE };            // debug handle

/* ---- boot ---------------------------------------------------------------- */
function boot(){
  G.renderer = new THREE.WebGLRenderer({ canvas: $('#c'), antialias: true });
  G.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(64, 1, 0.1, 900);
  onResize(); addEventListener('resize', onResize);
  buildWorld(G.scene);
  wireInput(); wireMenu(); wireNet();
  requestAnimationFrame(loop);
}
function onResize(){
  G.renderer.setSize(innerWidth, innerHeight);
  G.camera.aspect = innerWidth / innerHeight;
  G.camera.updateProjectionMatrix();
}

/* ---- menu ---------------------------------------------------------------- */
function wireMenu(){
  $('#nm').value = localStorage.vr_name || '';
  $('#soloBtn').onclick = () => startGame({ solo: true });
  $('#createBtn').onclick = async () => {
    const code = makeCode();
    const repair = $('#repAny').checked ? 'any' : 'pit';
    await startGame({ solo: false, host: true, code, repair });
  };
  $('#joinBtn').onclick = async () => {
    const code = $('#code').value.trim().toUpperCase();
    if(code.length !== 4){ $('#menuMsg').textContent = 'code is 4 letters'; return; }
    await startGame({ solo: false, host: false, code });
  };
}

async function startGame(opt){
  const name = ($('#nm').value.trim() || 'DRIVER').slice(0, 12);
  localStorage.vr_name = name;
  await loadArt();                       // Adam's SVGs, if drawn
  G.solo = opt.solo;
  if(!opt.solo){
    $('#menuMsg').textContent = 'connecting…';
    try { await NET.join(opt.code, name, opt.host); }
    catch(e){ $('#menuMsg').textContent = 'no luck: ' + e.message; return; }
    if(opt.host){ G.roomCfg.repair = opt.repair; }
    $('#roomChip').textContent = NET.code;
    $('#roomChip').style.display = 'block';
    VOICE.start(NET).then(ok => { $('#vcBtn').style.display = 'block'; if(!ok) toast('mic blocked — no VC'); });
  }
  // my guy + my starter machine
  const pid = G.solo ? 'solo' : NET.me;
  G.me = makeGuy(colorFor(pid), name);
  G.me.pos.copy(WORLD.spawn);
  G.scene.add(G.me.group);
  const spot = WORLD.parking[hash(pid) % WORLD.parking.length];
  const m = makeMachine(pid, spot.clone());
  m.parts = starterLayout(); refresh(m); rebuildMesh(m);
  G.machines.set(m.id, m); G.scene.add(m.group);
  G.mode = 'play';
  $('#menu').classList.add('hide');
  $('#hud').classList.remove('hide');
  if(!G.solo){ NET.send('hi', {}); sendBuilds(); }
  toast(G.solo ? 'sandbox — your machine is parked ahead' : 'room ' + NET.code + ' — bring friends');
}

const hash = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const colorFor = pid => GUY_COLORS[hash(pid) % GUY_COLORS.length];

/* ---- net wiring ---------------------------------------------------------- */
function wireNet(){
  NET.on('peers', peers => {
    for(const [pid, info] of peers){
      if(pid === NET.me || G.guys.has(pid)) continue;
      const g = makeGuy(colorFor(pid), info.name); g.remote = true;
      G.guys.set(pid, g); G.scene.add(g.group);
    }
    for(const [pid, g] of G.guys){
      if(!peers.has(pid)){
        G.scene.remove(g.group); G.guys.delete(pid);
        for(const m of G.machines.values()) if(m.driver === pid) m.driver = null;
      }
    }
    renderPeers();
  });
  NET.on('hi', (_, from) => { sendBuilds(); if(NET.isHost) NET.send('cfg', G.roomCfg); sendGuy(true); });
  NET.on('cfg', d => { G.roomCfg = d; });
  NET.on('build', d => {
    let m = G.machines.get(d.mid);
    if(!m){
      m = makeMachine(d.owner, new THREE.Vector3().fromArray(d.p));
      m.id = d.mid; G.machines.set(m.id, m);
    }
    m.owner = d.owner; m.remote = true;
    m.pos.fromArray(d.p); m.quat.fromArray(d.q);
    m.netP = m.pos.clone(); m.netQ = m.quat.clone();
    m.fuel = d.fuel; m.batt = d.batt;
    loadParts(m, d.parts); rebuildMesh(m);
    if(!m.group.parent) G.scene.add(m.group);
  });
  NET.on('m', d => {
    const m = G.machines.get(d.mid); if(!m || !m.remote) return;
    m.netP = (m.netP || new THREE.Vector3()).fromArray(d.p);
    m.netQ = (m.netQ || new THREE.Quaternion()).fromArray(d.q);
    m.vel.fromArray(d.v); m.fuel = d.fuel; m.batt = d.batt;
  });
  NET.on('g', (d, from) => {
    const g = G.guys.get(from); if(!g) return;
    g.netP = (g.netP || new THREE.Vector3()).fromArray(d.p);
    g.netYaw = d.yaw; g.inMachine = d.inM || null;
  });
  NET.on('seat', d => {
    const m = G.machines.get(d.mid); if(!m) return;
    m.driver = d.driver;
    // sim ownership: driver first, else owner
    m.remote = simOwner(m) !== myPid();
  });
  NET.on('shear', d => {
    const m = G.machines.get(d.mid);
    if(m && m.remote){
      const c0 = m.center.clone();
      for(const [k] of d.cells) m.parts.delete(k);
      refresh(m); anchorFix(m, c0); rebuildMesh(m);
    }
    for(const db of d.debris) spawnDebris(db, false);
  });
  NET.on('grab', d => {
    const db = G.debris.get(d.did);
    if(db){ G.scene.remove(db.mesh); G.debris.delete(d.did); }
  });
  NET.on('lap', (d, from) => {
    const nm = (NET.peers.get(from) || {}).name || '???';
    noteLap(nm, d.ms);
    toast(nm + ' — ' + fmtMs(d.ms));
  });
}
function myPid(){ return G.solo ? 'solo' : NET.me; }
function simOwner(m){ return m.driver || m.owner; }
function sendBuilds(){
  for(const m of G.machines.values()) if(m.owner === myPid()){
    NET.send('build', { mid: m.id, owner: m.owner, parts: serializeParts(m),
      p: m.pos.toArray(), q: m.quat.toArray(), fuel: m.fuel, batt: m.batt });
  }
}
function sendGuy(force){
  if(G.solo || !G.me) return;
  NET.send('g', { p: G.me.pos.toArray(), yaw: G.me.yaw, inM: G.me.inMachine });
}

/* ---- input --------------------------------------------------------------- */
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump' };
function wireInput(){
  addEventListener('keydown', e => {
    if(G.mode === 'menu') return;
    if(e.ctrlKey && e.code === 'KeyG'){      // re-center the build view
      e.preventDefault();
      const m = G.machines.get(G.buildTarget);
      if(G.mode === 'build' && m && G.buildCamPos) G.buildCamPos.copy(m.pos);
      return;
    }
    if(KEYMAP[e.code]) G.input[KEYMAP[e.code]] = true;
    if(e.code === 'KeyE') actionSeat();
    if(e.code === 'KeyF') actionGrab();
    if(e.code === 'KeyB') toggleBuild();
    if(e.code === 'KeyM' && VOICE.on) $('#vcBtn').textContent = VOICE.toggleMute() ? '🔇 VC' : '🎙 VC';
    if(e.code === 'KeyT'){         // hot-reload Adam's art
      loadArt().then(loaded => {
        for(const m of G.machines.values()) rebuildMesh(m);
        if(G.me) fillGuyMesh(G.me.group, G.me.color);
        for(const [, g] of G.guys) fillGuyMesh(g.group, g.color);
        console.log('[art] reloaded:', loaded.join(', ') || '(none drawn yet)');
      });
    }
    if(G.mode === 'build'){
      if(e.code === 'KeyR'){ G.buildRot = (G.buildRot + 1) & 3; }
      const idx = PART_ORDER.findIndex(t => PARTS[t].key === e.key);
      if(idx >= 0) selectPart(PART_ORDER[idx]);
    }
    if(e.code === 'Space' && G.mode === 'play') e.preventDefault();
  });
  addEventListener('keyup', e => { if(KEYMAP[e.code]) G.input[KEYMAP[e.code]] = false; });

  const cv = $('#c');
  addEventListener('mousemove', e => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  });
  cv.addEventListener('mousedown', e => {
    if(G.mode !== 'build') return;
    if(e.button === 0) placePart();
    else if(e.button === 2) removePart();
  });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => {
    G.camDist = THREE.MathUtils.clamp(G.camDist + e.deltaY * 0.02, 8, 42);
  });
  $('#vcBtn').onclick = () => { $('#vcBtn').textContent = VOICE.toggleMute() ? '🔇 VC' : '🎙 VC'; };
}

/* ---- seats --------------------------------------------------------------- */
function drivenMachine(){ return G.me && G.me.inMachine ? G.machines.get(G.me.inMachine) : null; }

/* When the part grid changes, m.center moves — shift m.pos to match so the
   BLOCKS stay exactly where they were in the world (no recenter jump).
   Capture c0 = m.center.clone() BEFORE the change, call this after refresh. */
function anchorFix(m, c0){
  m.pos.add(m.center.clone().sub(c0).applyQuaternion(m.quat));
  if(m.netP) m.netP.add(m.center.clone().sub(c0).applyQuaternion(m.quat));
}

function actionSeat(){
  const m = drivenMachine();
  if(m){   // hop out
    m.driver = null; m.throttle = 0; m.steer = 0; m.boosting = false;
    G.me.inMachine = null;
    G.me.pos.copy(m.pos).add(new THREE.Vector3(m.radius + 0.8, 0, 0));
    G.me.pos.y = WORLD.h(G.me.pos.x, G.me.pos.z);
    if(!G.solo){ NET.send('seat', { mid: m.id, driver: null }); sendGuy(true); }
    return;
  }
  // find nearest free seat
  let best = null, bd = 2.6;
  for(const mm of G.machines.values()){
    if(!mm.seatKey || mm.driver) continue;
    const [x, y, z] = mm.seatKey.split(',').map(Number);
    const sp = cellWorld(mm, x, y, z);
    const d = sp.distanceTo(G.me.pos);
    if(d < bd){ bd = d; best = mm; }
  }
  if(!best) return;
  best.driver = myPid();
  best.remote = false;                       // I simulate what I drive
  G.me.inMachine = best.id;
  if(!G.solo){ NET.send('seat', { mid: best.id, driver: myPid() }); sendGuy(true); }
  if(best.owner !== myPid()) toast("borrowing " + ownerName(best) + "'s machine 😈");
  G.lap.next = -1;
}
function ownerName(m){
  if(m.owner === myPid()) return 'your';
  return ((NET.peers.get(m.owner) || {}).name || '???');
}

/* ---- impacts / shear / debris -------------------------------------------- */
function onImpact(m, J, at){
  if(m.remote || m.grace > 0) return;
  const c0 = m.center.clone();
  const shed = shearParts(m, J, at);
  if(!shed.length) return;
  anchorFix(m, c0); rebuildMesh(m);
  const list = [];
  for(const c of shed){
    const [x, y, z] = c.k.split(',').map(Number);
    const wp = cellWorld(m, x, y, z);
    const db = { did: myPid() + ':' + (G.debrisN++), type: c.p.type, rot: c.p.rot,
      p: wp.toArray(), v: [m.vel.x * 0.5 + rnd(4), 5 + rnd(3), m.vel.z * 0.5 + rnd(4)],
      home: { mid: m.id, k: c.k } };
    list.push(db); spawnDebris(db, true);
  }
  if(!G.solo) NET.send('shear', { mid: m.id, cells: shed.map(c => [c.k]), debris: list });
  toast('-' + shed.map(c => PARTS[c.p.type].label).join(', -'));
  // seat gone while I'm in it → YEET
  if(G.me.inMachine === m.id && !m.seatKey){
    eject(G.me, m.pos.clone().add(new THREE.Vector3(0, m.half.y + 1, 0)));
    m.driver = null;
    if(!G.solo){ NET.send('seat', { mid: m.id, driver: null }); }
    toast('EJECTED!!');
  }
}
const rnd = s => (Math.random() - 0.5) * s;

function spawnDebris(db, local){
  if(G.debris.has(db.did)) return;
  const mesh = buildPartMesh(db.type, db.rot);
  mesh.position.fromArray(db.p);
  G.scene.add(mesh);
  G.debris.set(db.did, { ...db, mesh,
    pos: new THREE.Vector3().fromArray(db.p), vel: new THREE.Vector3().fromArray(db.v),
    spinA: new THREE.Vector3(rnd(8), rnd(8), rnd(8)), asleep: false });
}
function stepDebris(dt){
  for(const db of G.debris.values()){
    if(db.asleep) continue;
    db.vel.y -= 22 * dt;
    db.pos.addScaledVector(db.vel, dt);
    const gy = WORLD.h(db.pos.x, db.pos.z) + CELL * 0.35;
    if(db.pos.y < gy){
      db.pos.y = gy;
      db.vel.y *= -0.32; db.vel.x *= 0.7; db.vel.z *= 0.7;
      if(db.vel.lengthSq() < 0.6){ db.vel.set(0, 0, 0); db.asleep = true; db.mesh.rotation.set(0, db.mesh.rotation.y, 0); }
    }
    db.mesh.position.copy(db.pos);
    if(!db.asleep){ db.mesh.rotation.x += db.spinA.x * dt; db.mesh.rotation.y += db.spinA.y * dt; }
  }
}

/* ---- blob shadows: the depth cue that sells jumps from above -------------- */
const SHAD_GEO = new THREE.CircleGeometry(1, 18);
function updateShadows(){
  for(const s of G.shad.values()) s.userData.used = false;
  const put = (id, x, z, y, r) => {
    let s = G.shad.get(id);
    if(!s){
      s = new THREE.Mesh(SHAD_GEO, new THREE.MeshBasicMaterial({ color: 0x233618, transparent: true, opacity: 0.24, depthWrite: false }));
      s.rotation.x = -Math.PI / 2;
      G.scene.add(s); G.shad.set(id, s);
    }
    s.userData.used = true;
    const gy = WORLD.h(x, z);
    const lift = Math.max(0, y - gy);
    const k = THREE.MathUtils.clamp(1 - lift * 0.05, 0.45, 1);
    s.position.set(x, gy + 0.055, z);
    s.scale.setScalar(r * (0.7 + 0.3 * k));
    s.material.opacity = 0.26 * k;
  };
  for(const m of G.machines.values()) if(m.parts.size)
    put('m:' + m.id, m.pos.x, m.pos.z, m.pos.y - m.half.y, Math.max(0.8, m.radius * 0.9));
  if(G.me && !G.me.inMachine) put('me', G.me.pos.x, G.me.pos.z, G.me.pos.y, 0.5);
  for(const [pid, g] of G.guys) if(!g.inMachine) put('g:' + pid, g.pos.x, g.pos.z, g.pos.y, 0.5);
  for(const db of G.debris.values()) put('d:' + db.did, db.pos.x, db.pos.z, db.pos.y, 0.42);
  for(const [id, s] of G.shad) if(!s.userData.used){ G.scene.remove(s); G.shad.delete(id); }
}

function actionGrab(){
  if(!G.me || G.me.inMachine) return;
  // carrying parts + near my machine → bolt them back on
  let myM = null, md = 7;
  for(const mm of G.machines.values()){
    if(mm.owner !== myPid()) continue;
    const d = mm.pos.distanceTo(G.me.pos);
    if(d < md){ md = d; myM = mm; }
  }
  if(myM && G.carried.length && repairOK(myM.pos)){
    let n = 0;
    const c0 = myM.center.clone();
    G.carried = G.carried.filter(c => {
      if(c.home && c.home.mid === myM.id && !myM.parts.has(c.home.k)){
        myM.parts.set(c.home.k, { type: c.type, rot: c.rot }); n++; return false;
      }
      return true;
    });
    if(n){
      refresh(myM); anchorFix(myM, c0); rebuildMesh(myM);
      toast(n + (n > 1 ? ' parts' : ' part') + ' back on!');
      if(!G.solo) sendBuilds();
      return;
    }
  }
  // else: grab nearest debris
  let best = null, bd = 2.6;
  for(const db of G.debris.values()){
    const d = db.pos.distanceTo(G.me.pos);
    if(d < bd){ bd = d; best = db; }
  }
  if(!best) return;
  const home = G.machines.get(best.home?.mid);
  const mine = home && home.owner === myPid();
  if(mine && home.pos.distanceTo(G.me.pos) < 9 && !home.parts.has(best.home.k) && repairOK(home.pos)){
    const c0 = home.center.clone();
    home.parts.set(best.home.k, { type: best.type, rot: best.rot });
    refresh(home); anchorFix(home, c0); rebuildMesh(home);
    toast(PARTS[best.type].label + ' back on!');
    if(!G.solo){ NET.send('grab', { did: best.did }); sendBuilds(); }
  } else {
    G.carried.push({ type: best.type, rot: best.rot, home: best.home });
    const theirs = home && home.owner !== myPid();
    toast('carrying ' + PARTS[best.type].label + (theirs ? ' (STOLEN 😈)' : ' — F at your machine to bolt it on'));
    if(!G.solo) NET.send('grab', { did: best.did });
  }
  G.scene.remove(best.mesh); G.debris.delete(best.did);
}
function repairOK(pos){
  if(G.solo || G.roomCfg.repair === 'any') return true;
  return inPit(pos.x, pos.z);
}

/* ---- build mode ----------------------------------------------------------- */
const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2();
ray.params.Line = { threshold: 0 };
G.mouseV = mouse;                       // exposed for tests

function toggleBuild(){
  if(G.mode === 'build'){ exitBuild(); return; }
  if(G.me.inMachine){ toast('hop out first (E)'); return; }
  // nearest machine of mine, else a fresh one right here
  let target = null, bd = 7;
  for(const m of G.machines.values()){
    if(m.owner !== myPid()) continue;
    const d = m.pos.distanceTo(G.me.pos);
    if(d < bd){ bd = d; target = m; }
  }
  if(target && !repairOK(target.pos)){ toast('pit-only room — build in the yellow pads'); return; }
  if(!target){
    if(!repairOK(G.me.pos)){ toast('pit-only room — build in the yellow pads'); return; }
    const fwd = new THREE.Vector3(Math.sin(G.me.yaw), 0, Math.cos(G.me.yaw));
    target = makeMachine(myPid(), G.me.pos.clone().addScaledVector(fwd, 3).setY(1.2));
    target.parts.set(key(0, 0, 0), { type: 'frame', rot: 0 });
    refresh(target); rebuildMesh(target);
    G.machines.set(target.id, target); G.scene.add(target.group);
  }
  G.buildTarget = target.id;
  target.editing = true; target.vel.set(0, 0, 0); target.angVel.set(0, 0, 0);
  // stand it flat for editing
  target.quat.setFromEuler(new THREE.Euler(0, new THREE.Euler().setFromQuaternion(target.quat, 'YXZ').y, 0));
  target.pos.y = WORLD.h(target.pos.x, target.pos.z) + target.half.y + CELL;
  G.buildCamPos = target.pos.clone();
  G.mode = 'build';
  document.exitPointerLock && document.exitPointerLock();
  $('#tray').classList.remove('hide');
  renderTray();
  G.ghost = new THREE.Group(); G.scene.add(G.ghost);
}
function exitBuild(){
  const m = G.machines.get(G.buildTarget);
  if(m){ m.editing = false; refresh(m); rebuildMesh(m); if(!G.solo) sendBuilds(); }
  G.mode = 'play';
  $('#tray').classList.add('hide');
  if(G.ghost){ G.scene.remove(G.ghost); G.ghost = null; }
  G.ghostCell = null;
  G.buildCamPos = null;
}
function selectPart(t){
  G.buildSel = t;
  [...document.querySelectorAll('.tbtn')].forEach(b => b.classList.toggle('sel', b.dataset.t === t));
}
function renderTray(){
  const tray = $('#trayBtns'); tray.innerHTML = '';
  for(const t of PART_ORDER){
    const b = document.createElement('button');
    b.className = 'tbtn' + (t === G.buildSel ? ' sel' : ''); b.dataset.t = t;
    b.innerHTML = '<b>' + PARTS[t].key + '</b> ' + PARTS[t].label;
    b.style.setProperty('--pc', '#' + PARTS[t].color.toString(16).padStart(6, '0'));
    b.onclick = () => selectPart(t);
    tray.appendChild(b);
  }
}
function hasNeighbor(m, [x, y, z]){
  for(const d of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])
    if(m.parts.has(key(x + d[0], y + d[1], z + d[2]))) return true;
  return false;
}
function setGhost(m, nc, on){
  G.ghostCell = { cell: nc, on };
  while(G.ghost.children.length) G.ghost.remove(G.ghost.children[0]);
  const gm = buildPartMesh(G.buildSel, G.buildRot);
  gm.traverse(ob => { if(ob.material){ ob.material = ob.material.clone(); ob.material.transparent = true; ob.material.opacity = 0.55; } });
  G.ghost.add(gm);
  G.ghost.position.copy(cellWorld(m, ...nc));
  G.ghost.quaternion.copy(m.quat);
  G.ghost.visible = true;
}
function buildHover(){
  const m = G.machines.get(G.buildTarget);
  if(!m || !G.ghost) return;
  ray.setFromCamera(mouse, G.camera);
  const hits = ray.intersectObjects(m.group.children, true).filter(h => h.object.isMesh);
  G.ghostCell = null;
  G.ghost.visible = false;
  let o = hits.length ? hits[0].object : null;
  while(o && !o.userData.cellKey) o = o.parent;
  if(o){
    // top-down rule: middle of a block stacks UP, near an edge extends sideways
    const [cx, cy, cz] = o.userData.cellKey.split(',').map(Number);
    const lp = m.group.worldToLocal(hits[0].point.clone()).add(m.center).divideScalar(CELL);
    const dx = lp.x - cx, dz = lp.z - cz;
    const ax = Math.abs(dx), az = Math.abs(dz);
    let d;
    if(Math.max(ax, az) > 0.33) d = ax >= az ? [Math.sign(dx) || 1, 0, 0] : [0, 0, Math.sign(dz) || 1];
    else d = [0, 1, 0];
    const nc = [cx + d[0], cy + d[1], cz + d[2]];
    if(!m.parts.has(key(...nc))) setGhost(m, nc, o.userData.cellKey);
    return;
  }
  // missed the machine: aim at its bottom-layer plane, snap to the nearest cell
  let minY = 1e9;
  for(const k of m.parts.keys()){ const y = +k.split(',')[1]; if(y < minY) minY = y; }
  const planeY = m.pos.y + (minY * CELL - m.center.y);
  const t = (planeY - ray.ray.origin.y) / ray.ray.direction.y;
  if(!(t > 0)) return;
  const wp = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t);
  const lp = m.group.worldToLocal(wp).add(m.center).divideScalar(CELL);
  const nc = [Math.round(lp.x), minY, Math.round(lp.z)];
  if(!m.parts.has(key(...nc)) && hasNeighbor(m, nc)) setGhost(m, nc, null);
}
function placePart(){
  const m = G.machines.get(G.buildTarget);
  if(!m || !G.ghostCell) return;
  const c0 = m.center.clone();
  m.parts.set(key(...G.ghostCell.cell), { type: G.buildSel, rot: G.buildRot });
  refresh(m); anchorFix(m, c0); rebuildMesh(m);
  m.pos.y = Math.max(m.pos.y, WORLD.h(m.pos.x, m.pos.z) + m.half.y + CELL * 0.5);
}
function removePart(){
  const m = G.machines.get(G.buildTarget);
  if(!m) return;
  ray.setFromCamera(mouse, G.camera);
  const hits = ray.intersectObjects(m.group.children, true).filter(h => h.object.isMesh);
  if(!hits.length) return;
  let o = hits[0].object;
  while(o && !o.userData.cellKey) o = o.parent;
  if(!o || m.parts.size <= 1) return;
  const c0 = m.center.clone();
  m.parts.delete(o.userData.cellKey);
  refresh(m); anchorFix(m, c0); rebuildMesh(m);
}

/* ---- laps ----------------------------------------------------------------- */
function stepLap(m){
  const cps = WORLD.checkpoints;
  const nx = G.lap.next;
  if(nx < 0){
    const c0 = cps[0];
    if(Math.hypot(m.pos.x - c0.x, m.pos.z - c0.z) < c0.r){ G.lap.next = 1; G.lap.t0 = performance.now(); }
    return;
  }
  const c = cps[nx % cps.length];
  if(Math.hypot(m.pos.x - c.x, m.pos.z - c.z) < c.r){
    if(nx === cps.length){          // back at start = lap done
      const ms = performance.now() - G.lap.t0;
      G.lap.last = ms;
      if(!G.lap.best || ms < G.lap.best) G.lap.best = ms;
      noteLap(G.me.name, ms);
      if(!G.solo) NET.send('lap', { ms });
      toast('LAP ' + fmtMs(ms) + (ms === G.lap.best ? '  — BEST' : ''));
      G.lap.next = 1; G.lap.t0 = performance.now();
    } else G.lap.next = nx + 1;
  }
}
function noteLap(nm, ms){
  const prev = G.board.get(nm);
  if(!prev || ms < prev) G.board.set(nm, ms);
  renderBoard();
}
function renderBoard(){
  const rows = [...G.board.entries()].sort((a, b) => a[1] - b[1]).slice(0, 5);
  $('#board').innerHTML = rows.map(([n, t], i) => `<div>${i + 1}. ${n} <i>${fmtMs(t)}</i></div>`).join('');
  $('#board').style.display = rows.length ? 'block' : 'none';
}
const fmtMs = ms => (ms / 1000).toFixed(2) + 's';

/* ---- main loop ------------------------------------------------------------ */
let last = 0;
function loop(t){
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
  if(G.mode === 'menu' || !G.me){ G.renderer.render(G.scene, G.camera); return; }

  const drv = drivenMachine();
  if(drv){
    drv.throttle = (G.input.up ? 1 : 0) + (G.input.down ? -0.6 : 0);
    drv.steer = (G.input.left ? -1 : 0) + (G.input.right ? 1 : 0);
    drv.boosting = !!G.input.run;
  }
  // step everything I simulate
  const sub = 2, sdt = dt / sub;
  for(let s = 0; s < sub; s++){
    for(const m of G.machines.values()){
      if(m.editing || m.remote) continue;
      if(simOwner(m) !== myPid()) continue;
      stepMachine(m, WORLD, sdt, onImpact);
      for(const o of G.machines.values()) if(o !== m) bumpMachines(m, o, onImpact);
    }
  }
  if(G.mode === 'play') stepGuy(G.me, WORLD, G.input, G.camYaw, dt);
  else if(G.mode === 'build'){   // guy stands by while building
    G.me.group.visible = !G.me.inMachine;
    G.me.group.position.copy(G.me.pos);
  }
  for(const [pid, g] of G.guys) syncRemoteGuy(g, dt);
  for(const m of G.machines.values()) syncMesh(m, dt);
  stepDebris(dt);
  updateShadows();

  // driving extras: lap timing, pit refuel, guy rides along
  if(drv){
    G.me.pos.copy(drv.pos);
    stepLap(drv);
    if(inPit(drv.pos.x, drv.pos.z) && drv.vel.length() < 2){
      const before = drv.fuel;
      drv.fuel = Math.min(100, drv.fuel + 22 * dt);
      drv.batt = Math.min(100, drv.batt + 22 * dt);
      if(drv.fuel > before) pitFlash(t);
    }
  }
  if(G.mode === 'build') buildHover();

  camera(dt, drv);
  hud(drv, t);

  // net send @ ~12Hz
  if(!G.solo){
    G.sendT -= dt;
    if(G.sendT <= 0){
      G.sendT = 1 / 12;
      sendGuy();
      for(const m of G.machines.values()){
        if(m.remote || m.editing || simOwner(m) !== myPid()) continue;
        if(m.vel.lengthSq() < 0.01 && !m.driver) continue;
        NET.send('m', { mid: m.id, p: m.pos.toArray(), q: m.quat.toArray(), v: m.vel.toArray(), fuel: m.fuel | 0, batt: m.batt | 0 });
      }
    }
  }
  G.renderer.render(G.scene, G.camera);
}

/* ---- camera: fixed top-down, north up ------------------------------------- */
const camT = new THREE.Vector3();
function camera(dt, drv){
  let focus, H = G.camDist;
  if(G.mode === 'build'){
    // frozen while you build — the view never chases the growing machine
    const m = G.machines.get(G.buildTarget);
    focus = G.buildCamPos || (m ? m.pos : G.me.pos);
    H = Math.min(H, 16);
  } else if(drv){
    focus = drv.pos;
    H = G.camDist + drv.vel.length() * 0.45;     // zoom out a bit at speed
  } else focus = G.me.pos;

  camT.lerp(focus, Math.min(1, dt * 8));
  G.camera.up.set(0, 0, -1);
  G.camera.position.set(camT.x, camT.y + H, camT.z);
  G.camera.lookAt(camT.x, camT.y, camT.z);
}

/* ---- hud ------------------------------------------------------------------ */
let lastPitFlash = 0;
function pitFlash(t){ lastPitFlash = t; }
function hud(drv, t){
  const sp = $('#speed'), fu = $('#fuelFill'), ba = $('#battFill'), lapEl = $('#lap');
  if(drv){
    sp.style.display = 'block';
    sp.textContent = Math.round(drv.vel.length() * 3.1) + ' mph';
    $('#bars').style.display = 'flex';
    fu.style.width = drv.fuel + '%';
    ba.style.width = drv.batt + '%';
    lapEl.style.display = G.lap.next > 0 ? 'block' : 'none';
    if(G.lap.next > 0) lapEl.textContent = fmtMs(performance.now() - G.lap.t0) + (G.lap.best ? '  best ' + fmtMs(G.lap.best) : '');
    prompt(t - lastPitFlash < 400 ? 'PIT — refueling' :
      (drv.fuel <= 0 && drv.engines ? 'OUT OF FUEL — pit lane refuels' : 'E hop out · Shift VROOM'));
  } else {
    sp.style.display = 'none'; $('#bars').style.display = 'none'; lapEl.style.display = 'none';
    // context prompt
    let p = '';
    if(G.mode === 'build') p = 'click add (middle = stack up, edge = sideways) · right-click remove · R rotate · Ctrl+G recenter · B done';
    else {
      let nearSeat = false, nearDb = false;
      for(const m of G.machines.values()){
        if(!m.seatKey || m.driver) continue;
        const [x, y, z] = m.seatKey.split(',').map(Number);
        if(cellWorld(m, x, y, z).distanceTo(G.me.pos) < 2.6){ nearSeat = true; break; }
      }
      for(const db of G.debris.values()) if(db.pos.distanceTo(G.me.pos) < 2.6){ nearDb = true; break; }
      let nearMine = false;
      if(G.carried.length) for(const m of G.machines.values())
        if(m.owner === myPid() && m.pos.distanceTo(G.me.pos) < 7){ nearMine = true; break; }
      p = nearSeat ? 'E — hop in' : nearDb ? 'F — grab part'
        : nearMine ? 'F — bolt ' + G.carried.length + ' carried part' + (G.carried.length > 1 ? 's' : '') + ' on'
        : 'WASD walk · B build';
    }
    prompt(p);
  }
}
function prompt(s){ const el = $('#prompt'); if(el.textContent !== s) el.textContent = s; }
// no toasts — pure Trailmakers, the world shows what happened (Adam's ruling)
function toast(s){ console.log('[vroom]', s); }
function renderPeers(){
  const names = [...NET.peers.values()].map(p => p.name);
  $('#peers').textContent = names.join(' · ');
}

boot();
