/* =============================================================================
   main.js — kRacing (was VROOM). Build machines out of Lego parts, race your
   friends on one hand-made map, knock each other's wheels off, steal them.
   ============================================================================= */
import * as THREE from 'three';
import { makeRing } from './ring.js';
import { PARTS, PART_ORDER, CELLXZ, CELLY, fpOf, localCenterOf, buildPartMesh, mat, shade } from './parts.js';
import { makeMachine, starterLayout, serializeParts, loadParts, refresh, rebuildMesh,
         syncMesh, stepMachine, bumpMachines, shearParts, cellWorld, TUNE } from './machine.js';
import { buildWorld, WORLD, inPit } from './world.js';
import { makeGuy, stepGuy, syncRemoteGuy, eject, fillGuyMesh } from './guy.js';
import { loadArt } from './art.js';
import { NET, makeCode } from './net.js';
import { VOICE } from './voice.js';
import { PAL, GUY_COLORS } from './palette.js';
import { GFX, initGfx, cycleTier, sampleFrame, tierLabel } from './gfx.js';
import { buildPostFX, renderFrame, resizePostFX } from './postfx.js';
import { DAY, initLight, updateLight, nudgeTime, setShadowCfg, loadSky } from './light.js';
import { reloadTiles } from './tiles.js';
import { CAM, updateCam, cycleCam, camLabel, kick as camKick } from './cam.js';
import { PAINT, initPaint, setPaint, paintHover, paintDown, paintUp, paintStrip, rotateDecal, scaleDecal, dropDecal, stampDecal } from './paint.js';
import { reloadBillboards } from './props.js';
import { copyPart, applySkin } from './skin.js';

const $ = s => document.querySelector(s);
const key = (x, y, z) => x + ',' + y + ',' + z;

const G = {
  scene: null, camera: null, renderer: null,
  me: null, guys: new Map(), machines: new Map(), debris: new Map(),
  mode: 'menu', solo: true,
  camYaw: 0, camDist: 14,          // camDist = camera height (top-down)
  buildCamPos: null,               // frozen view point while building (Ctrl+G re-centers)
  input: {},
  buildSel: 'frame', buildRot: 0, buildTarget: null, ghost: null, ghostCell: null,
  carried: [],
  roomCfg: { repair: 'any' },
  lap: { track: -1, next: -1, t0: 0, last: 0, best: 0 },
  padT: 0,
  board: new Map(),
  sendT: 0, debrisN: 1, paintT: 0, mouseDelta: { x: 0, y: 0 },
};
window.VR = { G, NET, TUNE, WORLD, VOICE, DAY, GFX, CAM, PAINT };  // debug handle
window.KR = window.VR;

/* ---- boot ---------------------------------------------------------------- */
function boot(){
  G.renderer = new THREE.WebGLRenderer({ canvas: $('#c'), antialias: true });
  G.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  initGfx(G.renderer);
  G.renderer.shadowMap.enabled = true;
  G.renderer.shadowMap.type = THREE.PCFShadowMap;
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(64, 1, 0.1, 900);
  onResize(); addEventListener('resize', onResize);
  buildWorld(G.scene, G.renderer);
  initLight(G.scene, GFX.cfg);
  applyGfx(GFX.cfg);
  GFX.onChange = applyGfx;
  $('#gfxChip').onclick = () => cycleTier();
  $('#camChip').onclick = () => { cycleCam(); onCamMode(); };
  initPaint(G.scene);
  wireInput(); wireMenu(); wireNet();
  window.VR.dbg = { serializeParts, loadParts, rebuildMesh, onImpact, sendBuilds, stampDecal, copyPart };
  probeLogo();
  requestAnimationFrame(loop);
}
// camera mode changed: chip, pointer lock (3rd-person / fps = mouse look), sprite vs block guy
function onCamMode(){
  $('#camChip').textContent = camLabel();
  const cv = $('#c');
  if(CAM.mode === 'top'){ if(document.pointerLockElement === cv) document.exitPointerLock(); }
  else if(G.mode === 'play') lockPointer(cv);
  refillGuys();
}
// pointer lock needs a user gesture; swallow the rejection when it isn't one (tests, programmatic)
function lockPointer(cv){ try { const r = cv.requestPointerLock && cv.requestPointerLock(); if(r && r.catch) r.catch(() => {}); } catch(e){} }
function refillGuys(){
  const sprite = CAM.mode === 'top';
  if(G.me) fillGuyMesh(G.me.group, G.me.color, sprite);
  for(const [, g] of G.guys) fillGuyMesh(g.group, g.color, sprite);
}
function onResize(){
  G.renderer.setSize(innerWidth, innerHeight);
  G.camera.aspect = innerWidth / innerHeight;
  G.camera.updateProjectionMatrix();
  resizePostFX();
}
// graphics preset → shadow map size/type, post pipeline, every material recompiles
function applyGfx(cfg){
  G.renderer.shadowMap.type = THREE.PCFShadowMap;   // (PCFSoft is deprecated in r185)
  G.renderer.shadowMap.needsUpdate = true;
  setShadowCfg(cfg);
  buildPostFX(G.renderer, G.scene, G.camera, cfg);
  G.scene.traverse(o => { if(o.material){ const ms = Array.isArray(o.material) ? o.material : [o.material]; for(const m of ms) m.needsUpdate = true; } });
  const chip = $('#gfxChip'); if(chip) chip.textContent = tierLabel();
}
// Adam's logo: assets/logo.svg replaces the text title + becomes the favicon
function probeLogo(){
  const img = new Image();
  img.onload = () => {
    const h1 = $('#logo'); if(!h1) return;
    const sub = h1.querySelector('.sub');
    h1.innerHTML = ''; img.alt = 'kRacing'; img.id = 'logoImg'; h1.appendChild(img); if(sub) h1.appendChild(sub);
    let link = document.querySelector('link[rel=icon]');
    if(!link){ link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = img.src;
  };
  img.src = './assets/logo.svg?t=' + Date.now();
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
  fillGuyMesh(G.me.group, G.me.color, CAM.mode === 'top');
  G.me.pos.copy(WORLD.spawn);
  G.scene.add(G.me.group);
  const spot = WORLD.parking[hash(pid) % WORLD.parking.length];
  const m = makeMachine(pid, spot.clone());
  m.parts = starterLayout(); refresh(m); rebuildMesh(m);
  G.machines.set(m.id, m); G.scene.add(m.group);
  G.mode = 'play';
  document.body.classList.add('playing');        // native cursor off, fun cursor on
  $('#menu').classList.add('hide');
  $('#hud').classList.remove('hide');
  $('#gfxChip').style.display = 'block'; $('#gfxChip').textContent = tierLabel();
  $('#camChip').style.display = 'block'; $('#camChip').textContent = camLabel();
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
      fillGuyMesh(g.group, g.color, CAM.mode === 'top');
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
    noteLap(nm, d.ms, d.track ? trackById(d.track) : null);
    toast(nm + ' — ' + fmtMs(d.ms));
  });
}
function myPid(){ return G.solo ? 'solo' : NET.me; }
function simOwner(m){ return m.driver || m.owner; }
function sendBuild(m){
  NET.send('build', { mid: m.id, owner: m.owner, parts: serializeParts(m),
    p: m.pos.toArray(), q: m.quat.toArray(), fuel: m.fuel, batt: m.batt });
}
function sendBuilds(){
  for(const m of G.machines.values()) if(m.owner === myPid()) sendBuild(m);
}
function sendGuy(force){
  if(G.solo || !G.me) return;
  NET.send('g', { p: G.me.pos.toArray(), yaw: G.me.yaw, inM: G.me.inMachine });
}

/* ---- input --------------------------------------------------------------- */
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump', ControlLeft: 'crouch',
  KeyQ: 'lookL', KeyZ: 'lookR' };
function wireInput(){
  addEventListener('keydown', e => {
    if(G.mode === 'menu') return;
    if(e.target && e.target.tagName === 'INPUT') return;     // typing a decal, not driving
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
    if(e.code === 'KeyC' && !e.ctrlKey && G.mode === 'play'){ cycleCam(); onCamMode(); }
    if(e.code === 'KeyM' && VOICE.on) $('#vcBtn').textContent = VOICE.toggleMute() ? '🔇 VC' : '🎙 VC';
    if(e.code === 'KeyT'){         // hot-reload Adam's art
      loadArt().then(loaded => {
        for(const m of G.machines.values()) rebuildMesh(m);
        refillGuys();
        ICONS.clear(); if(G.ring && G.ring.isOpen) G.ring.render();   // catalog icons show the new art too
        console.log('[art] reloaded:', loaded.join(', ') || '(none drawn yet)');
      });
      reloadTiles(); loadSky(); probeLogo(); reloadBillboards();
    }
    if(e.code === 'BracketLeft' || e.code === 'BracketRight'){   // tune the hour
      const h = nudgeTime(e.code === 'BracketRight' ? 0.5 : -0.5);
      console.log('[kRacing] time of day', h.toFixed(1) + 'h');
    }
    if(G.mode === 'build'){
      const bm = G.machines.get(G.buildTarget);
      if(e.code === 'Escape'){
        if(G.ring && G.ring.isOpen) G.ring.close();
        else if(!dropDecal() && PAINT.on) setPaint(false);
      }
      if(e.code === 'KeyP') setPaint(!PAINT.on);
      if(e.code === 'KeyR'){ if(!(PAINT.on && rotateDecal())) G.buildRot = (G.buildRot + 1) & 3; }
      if(e.code === 'KeyX' && !(G.ring && G.ring.isOpen)){ if(PAINT.on) paintStrip(bm); else removePart(); }
      const idx = PART_ORDER.findIndex(t => PARTS[t].key === e.key);
      if(idx >= 0) selectPart(PART_ORDER[idx]);
    }
    if(e.code === 'Space' && G.mode === 'play') e.preventDefault();
  });
  addEventListener('keyup', e => { if(e.target && e.target.tagName === 'INPUT') return; if(KEYMAP[e.code]) G.input[KEYMAP[e.code]] = false; });

  const cv = $('#c');
  addEventListener('mousemove', e => {
    if(document.pointerLockElement === cv){ G.mouseDelta.x += e.movementX; G.mouseDelta.y += e.movementY; return; }
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  });
  addEventListener('mouseup', () => paintUp());
  document.addEventListener('pointerlockchange', () => document.body.classList.toggle('locked', document.pointerLockElement === cv));
  cv.addEventListener('mousedown', e => {
    if(G.mode === 'play' && CAM.mode !== 'top' && document.pointerLockElement !== cv){ lockPointer(cv); return; }
    if(G.mode !== 'build') return;
    const bm = G.machines.get(G.buildTarget);
    if(e.button === 0){ if(PAINT.on) paintDown(bm, e.shiftKey); else placePart(); }
    else if(e.button === 1){ e.preventDefault(); if(PAINT.on) paintStrip(bm); else removePart(); }
    else if(e.button === 2) G.ring.toggle(e.clientX, e.clientY);   // the catalog lives at the cursor
  });
  addEventListener('contextmenu', e => { if(document.body.classList.contains('playing')) e.preventDefault(); });
  cv.addEventListener('wheel', e => {
    if(PAINT.on && PAINT.dec){ e.preventDefault(); scaleDecal(e.deltaY); return; }
    if(G.mode === 'play' && CAM.mode === 'chase'){ CAM.dist = THREE.MathUtils.clamp(CAM.dist + e.deltaY * 0.01, 5, 16); return; }
    G.camDist = THREE.MathUtils.clamp(G.camDist + e.deltaY * 0.02, 8, 42);
  }, { passive: false });
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
    const d = cellWorld(mm, mm.seatKey).distanceTo(G.me.pos);
    if(d < bd){ bd = d; best = mm; }
  }
  if(!best) return;
  best.driver = myPid();
  best.remote = false;                       // I simulate what I drive
  G.me.inMachine = best.id;
  if(!G.solo){ NET.send('seat', { mid: best.id, driver: myPid() }); sendGuy(true); }
  if(best.owner !== myPid()) toast("borrowing " + ownerName(best) + "'s machine 😈");
  G.lap.next = -1; G.lap.track = -1;
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
    const wp = cellWorld(m, c.k);
    const db = { did: myPid() + ':' + (G.debrisN++), ...copyPart(c.p),
      p: wp.toArray(), v: [m.vel.x * 0.5 + rnd(4), 5 + rnd(3), m.vel.z * 0.5 + rnd(4)],
      home: { mid: m.id, k: c.k } };
    list.push(db); spawnDebris(db, true);
  }
  if(!G.solo) NET.send('shear', { mid: m.id, cells: shed.map(c => [c.k]), debris: list });
  toast('-' + shed.map(c => PARTS[c.p.type].label).join(', -'));
  if(G.me.inMachine === m.id) camKick(J);
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
  applySkin(mesh, db);
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
    const gy = WORLD.h(db.pos.x, db.pos.z) + CELLY * 0.35;
    if(db.pos.y < gy){
      db.pos.y = gy;
      db.vel.y *= -0.32; db.vel.x *= 0.7; db.vel.z *= 0.7;
      if(db.vel.lengthSq() < 0.6){ db.vel.set(0, 0, 0); db.asleep = true; db.mesh.rotation.set(0, db.mesh.rotation.y, 0); }
    }
    db.mesh.position.copy(db.pos);
    if(!db.asleep){ db.mesh.rotation.x += db.spinA.x * dt; db.mesh.rotation.y += db.spinA.y * dt; }
  }
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
        myM.parts.set(c.home.k, copyPart(c)); n++; return false;
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
    home.parts.set(best.home.k, copyPart(best));
    refresh(home); anchorFix(home, c0); rebuildMesh(home);
    toast(PARTS[best.type].label + ' back on!');
    if(!G.solo){ NET.send('grab', { did: best.did }); sendBuilds(); }
  } else {
    G.carried.push({ ...copyPart(best), home: best.home });
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
  target.pos.y = WORLD.h(target.pos.x, target.pos.z) + target.half.y + CELLY;
  G.buildCamPos = target.pos.clone();
  G.mode = 'build';
  document.exitPointerLock && document.exitPointerLock();
  if(!G.ring) G.ring = makeRing({ iconFor: partIcon, held: () => G.buildSel, onPick: selectPart });
  G.ghost = new THREE.Group(); G.scene.add(G.ghost);
}
function exitBuild(){
  const m = G.machines.get(G.buildTarget);
  if(m){ m.editing = false; m.grace = 1.5; refresh(m); rebuildMesh(m); if(!G.solo) sendBuilds(); }   // settle drop never shears
  G.mode = 'play';
  setPaint(false);
  if(G.ring) G.ring.close();
  if(G.ghost){ G.scene.remove(G.ghost); G.ghost = null; }
  G.ghostCell = null;
  G.buildCamPos = null;
}
function selectPart(t){ G.buildSel = t; setPaint(false); }
/* part icons: every part rendered top-down (ortho, no smoothing), cached; T clears the cache */
let iconR = null;
const ICONS = new Map();
function partIcon(type){
  if(ICONS.has(type)) return ICONS.get(type);
  if(!iconR){
    iconR = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
    iconR.setSize(96, 96);
  }
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0xcfe0b8, 1.15));
  const dl = new THREE.DirectionalLight(0xfff4d6, 0.5); dl.position.set(2, 5, 3); sc.add(dl);
  sc.add(buildPartMesh(type, 0));
  const R = 0.48;                       // shared scale: a 1×1 LOOKS smaller than a 3×3
  const cam = new THREE.OrthographicCamera(-R, R, R, -R, 0.1, 20);
  cam.up.set(0, 0, -1); cam.position.set(0, 6, 0); cam.lookAt(0, 0, 0);
  iconR.render(sc, cam);
  const url = iconR.domElement.toDataURL();
  ICONS.set(type, url);
  return url;
}
function setGhost(m, nc){
  G.ghostCell = { cell: nc };
  while(G.ghost.children.length) G.ghost.remove(G.ghost.children[0]);
  const gm = buildPartMesh(G.buildSel, G.buildRot);
  gm.traverse(ob => { ob.castShadow = false; if(ob.material){ ob.material = ob.material.clone(); ob.material.transparent = true; ob.material.opacity = 0.55; } });
  G.ghost.add(gm);
  G.ghost.position.copy(localCenterOf(nc[0], nc[1], nc[2], G.buildSel).sub(m.center).applyQuaternion(m.quat).add(m.pos));
  G.ghost.quaternion.copy(m.quat);
  G.ghost.visible = true;
}
function buildHover(){
  const m = G.machines.get(G.buildTarget);
  if(!m || !G.ghost) return;
  if(G.ring && G.ring.isOpen){ G.ghostCell = null; G.ghost.visible = false; return; }
  G.ghostCell = null;
  G.ghost.visible = false;
  ray.setFromCamera(mouse, G.camera);
  const [fw, fd] = fpOf(G.buildSel);
  const hits = ray.intersectObjects(m.group.children, true).filter(h => h.object.isMesh);
  let o = hits.length ? hits[0].object : null;
  while(o && !o.userData.cellKey) o = o.parent;
  let y, ax, az;
  if(o){
    // top-down rule: middle of a part stacks UP, near an edge extends SIDEWAYS (same layer)
    const [ox, oy, oz] = o.userData.cellKey.split(',').map(Number);
    const [ow, od] = fpOf(m.parts.get(o.userData.cellKey).type);
    const hp = m.group.worldToLocal(hits[0].point.clone()).add(m.center);
    const ux = hp.x / CELLXZ - (ox - 0.5), uz = hp.z / CELLXZ - (oz - 0.5);   // 0..ow / 0..od across the part
    const ex = Math.min(ux, ow - ux) / ow, ez = Math.min(uz, od - uz) / od;   // 0 = on an edge, .5 = dead center
    if(Math.min(ex, ez) < 0.25){
      y = oy;
      if(ex <= ez){ ax = ux < ow / 2 ? ox - fw : ox + ow; az = Math.round(hp.z / CELLXZ - (fd - 1) / 2); }
      else        { az = uz < od / 2 ? oz - fd : oz + od; ax = Math.round(hp.x / CELLXZ - (fw - 1) / 2); }
    } else {
      y = oy + 1;
      ax = Math.round(hp.x / CELLXZ - (fw - 1) / 2); az = Math.round(hp.z / CELLXZ - (fd - 1) / 2);
    }
  } else {
    // open ground = bottom layer, beside the machine, footprint snapped under the cursor
    let minY = 1e9;
    for(const k of m.parts.keys()){ const yy = +k.split(',')[1]; if(yy < minY) minY = yy; }
    const planeY = m.pos.y + (minY * CELLY - m.center.y);
    const t = (planeY - ray.ray.origin.y) / ray.ray.direction.y;
    if(!(t > 0)) return;
    y = minY;
    const lp = m.group.worldToLocal(ray.ray.origin.clone().addScaledVector(ray.ray.direction, t)).add(m.center);
    ax = Math.round(lp.x / CELLXZ - (fw - 1) / 2); az = Math.round(lp.z / CELLXZ - (fd - 1) / 2);
  }
  // valid = footprint free + touching the machine somewhere
  let touch = false;
  for(let i = 0; i < fw; i++) for(let j = 0; j < fd; j++){
    const cx = ax + i, cz = az + j;
    if(m.occ.has(key(cx, y, cz))) return;
    for(const d of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])
      if(m.occ.has(key(cx + d[0], y + d[1], cz + d[2]))) touch = true;
  }
  if(touch) setGhost(m, [ax, y, az]);
}
function placePart(){
  const m = G.machines.get(G.buildTarget);
  if(!m || !G.ghostCell) return;
  const c0 = m.center.clone();
  m.parts.set(key(...G.ghostCell.cell), { type: G.buildSel, rot: G.buildRot });
  refresh(m); anchorFix(m, c0); rebuildMesh(m);
  m.pos.y = Math.max(m.pos.y, WORLD.h(m.pos.x, m.pos.z) + m.half.y + CELLY * 0.5);
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

/* ---- laps: whichever track's start line you cross owns the timer ------------- */
function stepLap(m){
  const L = G.lap;
  if(L.track < 0){
    for(let i = 0; i < WORLD.tracks.length; i++){
      const c0 = WORLD.tracks[i].cps[0];
      if(Math.hypot(m.pos.x - c0.x, m.pos.z - c0.z) < c0.r){ L.track = i; L.next = 1; L.t0 = performance.now(); return; }
    }
    return;
  }
  const tr = WORLD.tracks[L.track], cps = tr.cps, nx = L.next;
  // crossing another track's start line = switch tracks
  for(let i = 0; i < WORLD.tracks.length; i++){ if(i === L.track) continue; const c0 = WORLD.tracks[i].cps[0];
    if(Math.hypot(m.pos.x - c0.x, m.pos.z - c0.z) < c0.r){ L.track = i; L.next = 1; L.t0 = performance.now(); return; } }
  if(tr.closed){
    const c = cps[nx % cps.length];
    if(Math.hypot(m.pos.x - c.x, m.pos.z - c.z) < c.r){
      if(nx === cps.length){          // back at start = lap done
        const ms = performance.now() - L.t0;
        L.last = ms;
        if(!L.best || ms < L.best) L.best = ms;
        noteLap(G.me.name, ms, tr);
        if(!G.solo) NET.send('lap', { ms, track: tr.id });
        toast(tr.name + ' LAP ' + fmtMs(ms) + (ms === L.best ? '  — BEST' : ''));
        L.next = 1; L.t0 = performance.now();
      } else L.next = nx + 1;
    }
  } else {
    const c = cps[Math.min(nx, cps.length - 1)];
    if(Math.hypot(m.pos.x - c.x, m.pos.z - c.z) < c.r){
      if(nx >= cps.length - 1){      // stage finish
        const ms = performance.now() - L.t0;
        L.last = ms; if(!L.best || ms < L.best) L.best = ms;
        noteLap(G.me.name, ms, tr);
        if(!G.solo) NET.send('lap', { ms, track: tr.id });
        toast(tr.name + ' STAGE ' + fmtMs(ms));
        L.track = -1; L.next = -1;
      } else L.next = nx + 1;
    }
  }
}
function trackById(id){ return WORLD.tracks.find(t => t.id === id); }
/* teleport pads in Kris's Corner: stand (or park) on one for a moment → the track's start */
function stepPads(dt, drv){
  const p = drv ? drv.pos : G.me.pos;
  if(G.padT < 0){ G.padT += dt; return null; }            // cooldown after a jump
  let on = null;
  for(const pad of WORLD.pads) if(Math.hypot(p.x - pad.x, p.z - pad.z) < pad.r){ on = pad; break; }
  if(!on){ G.padT = 0; return null; }
  G.padT += dt;
  if(G.padT > 0.8){ teleportTo(on.track, drv); G.padT = -2; }
  return on;
}
function teleportTo(trackId, drv){
  const tr = trackById(trackId); if(!tr) return;
  const st = tr.start, gy = WORLD.h(st.x, st.z);
  const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), st.yaw);
  const park = (m, side) => { m.pos.set(st.x + Math.cos(st.yaw) * side, gy + m.half.y + 0.6, st.z - Math.sin(st.yaw) * side); m.quat.copy(yawQ); m.vel.set(0, 0, 0); m.angVel.set(0, 0, 0); m.grace = 1.5; if(m.netP){ m.netP.copy(m.pos); m.netQ.copy(m.quat); } };
  if(drv) park(drv, 0);
  else {
    // my nearest parked machine comes along (if it's close), and I stand beside the grid
    let mine = null, bd = 14; for(const m of G.machines.values()) if(m.owner === myPid() && !m.driver){ const d = m.pos.distanceTo(G.me.pos); if(d < bd){ bd = d; mine = m; } }
    if(mine) park(mine, 0);
    G.me.pos.set(st.x + Math.cos(st.yaw) * 4, gy, st.z - Math.sin(st.yaw) * 4);
  }
  G.lap.track = -1; G.lap.next = -1;
  if(!G.solo){ sendGuy(true); sendBuilds(); }
  toast('→ ' + tr.name);
}
function noteLap(nm, ms, tr){
  const k = nm + (tr ? ' · ' + tr.name : '');
  const prev = G.board.get(k);
  if(!prev || ms < prev) G.board.set(k, ms);
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
  if(G.mode === 'menu' || !G.me){ camera(dt, null); renderFrame(dt, null); return; }

  const drv = drivenMachine();
  const freeCam = G.mode === 'play' && CAM.mode === 'free';
  if(drv && !freeCam){
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
  if(G.mode === 'play'){
    const topCam = CAM.mode === 'top';
    stepGuy(G.me, WORLD, freeCam ? {} : G.input, topCam ? G.camYaw : CAM.camYaw, dt, (freeCam || !topCam) ? null : mouseAim());
  }
  else if(G.mode === 'build'){   // guy stands by while building
    G.me.group.visible = !G.me.inMachine;
    G.me.group.position.copy(G.me.pos);
  }
  for(const [pid, g] of G.guys) syncRemoteGuy(g, dt);
  for(const m of G.machines.values()) syncMesh(m, dt);
  stepDebris(dt);
  for(const a of WORLD.anim) a.update(t / 1000, dt);

  // teleport pads (driving or on foot)
  const onPad = G.mode === 'play' ? stepPads(dt, drv) : null;
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
  if(G.mode === 'build'){ if(PAINT.on) paintHover(G.machines.get(G.buildTarget), (ray.setFromCamera(mouse, G.camera), ray), !!G.input.run); else buildHover(); }
  if(G.mode === 'play' && CAM.mode === 'fps' && !G.me.inMachine) G.me.group.visible = false;
  if(!G.solo && PAINT.dirty.size && t - G.paintT > 500){
    G.paintT = t;
    for(const id of PAINT.dirty){ const pm = G.machines.get(id); if(pm && pm.owner === myPid()) sendBuild(pm); }
    PAINT.dirty.clear();
  }

  camLookInput();
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
  sampleFrame(dt);
  renderFrame(dt, blurCtx(drv));
}
// screen-space velocity of the driven machine, for the directional speed blur
const _bp = new THREE.Vector3(), _bq = new THREE.Vector3(), _bd = new THREE.Vector2();
function blurCtx(drv){
  if(!drv) return null;
  const sp = drv.vel.length();
  if(sp < 6) return { speed: sp, dir: null };
  _bp.copy(drv.pos).project(G.camera);
  _bq.copy(drv.pos).add(drv.vel).project(G.camera);
  _bd.set(_bq.x - _bp.x, _bq.y - _bp.y);
  if(_bd.lengthSq() < 1e-8) return { speed: sp, dir: null };
  _bd.normalize(); _bd.y *= innerHeight / innerWidth;    // dir in UV space (aspect-corrected)
  _bd.normalize();
  return { speed: sp, dir: _bd };
}

/* the ground point under the cursor, as a walk direction from the guy */
function mouseAim(){
  if(!G.me || G.me.inMachine) return null;
  ray.setFromCamera(mouse, G.camera);
  const t = (G.me.pos.y + 0.5 - ray.ray.origin.y) / ray.ray.direction.y;
  if(!(t > 0)) return null;
  const wp = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t);
  const dx = wp.x - G.me.pos.x, dz = wp.z - G.me.pos.z;
  const L = Math.hypot(dx, dz);
  return L > 0.5 ? { x: dx / L, z: dz / L } : null;   // dead zone on top of the guy
}

/* ---- camera: top-down by default; C cycles chase / fps / free (cam.js) --------- */
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
    H = G.camDist + (CAM.pullback ? drv.vel.length() * 0.45 : 0);     // zoom out a bit at speed
  } else focus = G.me ? G.me.pos : WORLD.spawn;
  camT.lerp(focus, Math.min(1, dt * 18));
  const seatPos = drv && drv.seatKey ? cellWorld(drv, drv.seatKey) : null;
  const out = updateCam({ camera: G.camera, dt, mode: G.mode, drv, guy: G.me || { pos: WORLD.spawn, yaw: 0 }, focus: camT, H,
    seatPos, input: G.input, mouseDelta: G.mouseDelta, pointerLocked: document.pointerLockElement === $('#c') || !!G.forceLock, WORLD });
  G.mouseDelta.x = 0; G.mouseDelta.y = 0;
  updateLight(out.focus, out.reach, G.camera);
}
// free cam / chase look keys
function camLookInput(){ CAM.look = (G.input.lookL && G.input.lookR) ? 2 : G.input.lookL ? -1 : G.input.lookR ? 1 : 0; }

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
    if(G.lap.next > 0) lapEl.textContent = (WORLD.tracks[G.lap.track] ? WORLD.tracks[G.lap.track].name + '  ' : '') + fmtMs(performance.now() - G.lap.t0) + (G.lap.best ? '  best ' + fmtMs(G.lap.best) : '');
    const pad = G.padT > 0 ? WORLD.pads.find(p => Math.hypot(drv.pos.x - p.x, drv.pos.z - p.z) < p.r) : null;
    prompt(pad ? '→ ' + (trackById(pad.track) || {}).name + ' …' : t - lastPitFlash < 400 ? 'PIT — refueling' :
      (drv.fuel <= 0 && drv.engines ? 'OUT OF FUEL — pit lane refuels' : 'E hop out · Shift VROOM'));
  } else {
    sp.style.display = 'none'; $('#bars').style.display = 'none'; lapEl.style.display = 'none';
    // context prompt
    let p = '';
    if(G.mode === 'build'){
      p = PAINT.on
        ? (PAINT.dec ? 'DECAL — click stamp (top faces) · scroll size · R rotate · X undo · Esc drop'
                     : 'PAINT — click block · Shift-click face · hold spray · X strip · P/Esc done')
        : 'right-click: catalog · click add (middle = stack up, edge = sideways) · X remove · R rotate · P paint · Ctrl+G recenter · B done';
    }
    else {
      let nearSeat = false, nearDb = false;
      for(const m of G.machines.values()){
        if(!m.seatKey || m.driver) continue;
        if(cellWorld(m, m.seatKey).distanceTo(G.me.pos) < 2.6){ nearSeat = true; break; }
      }
      for(const db of G.debris.values()) if(db.pos.distanceTo(G.me.pos) < 2.6){ nearDb = true; break; }
      let nearMine = false;
      if(G.carried.length) for(const m of G.machines.values())
        if(m.owner === myPid() && m.pos.distanceTo(G.me.pos) < 7){ nearMine = true; break; }
      const pad = G.padT > 0 ? WORLD.pads.find(pp => Math.hypot(G.me.pos.x - pp.x, G.me.pos.z - pp.z) < pp.r) : null;
      p = pad ? '→ ' + (trackById(pad.track) || {}).name + ' …' : nearSeat ? 'E — hop in' : nearDb ? 'F — grab part'
        : nearMine ? 'F — bolt ' + G.carried.length + ' carried part' + (G.carried.length > 1 ? 's' : '') + ' on'
        : 'WASD walk · B build';
    }
    prompt(p);
  }
}
function prompt(s){ const el = $('#prompt'); if(el.textContent !== s) el.textContent = s; }
// no toasts — pure Trailmakers, the world shows what happened (Adam's ruling)
function toast(s){ console.log('[kRacing]', s); }
function renderPeers(){
  const names = [...NET.peers.values()].map(p => p.name);
  $('#peers').textContent = names.join(' · ');
}

boot();
