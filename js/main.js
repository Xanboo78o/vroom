/* =============================================================================
   main.js — kRacing, full 2D. Build little machines out of tiles, race your
   friends on one hand-made map, knock each other's wheels off, steal them.
   Canvas renderer in world units; Adam's SVGs are the art (T hot-reloads).
   ============================================================================= */
import { makeRing } from './ring.js';
import { PARTS, PART_ORDER, CELL, fpOf, localCenterOf, drawPart, partIcon, clearIcons, keyOf, cellsOf } from './parts.js';
import { makeMachine, starterLayout, serializeParts, loadParts, refresh, anchorFix, stepMachine, bumpMachines,
         shearParts, cellWorld, worldToLocal, localToWorld, netSync, drawMachine, TUNE } from './machine.js';
import { buildWorld, WORLD, inPit, drawWorld, drawCanopy, surfaceAt } from './world.js';
import { SURF } from './tracks.js';
import { makeGuy, stepGuy, syncRemoteGuy, eject, drawGuy, GUY_SIZE } from './guy.js';
import { loadArt } from './art.js';
import { NET, makeCode } from './net.js';
import { VOICE } from './voice.js';
import { PAL, GUY_COLORS, hex, shade, rgba, tint } from './palette.js';
import { puff, burst, stepFX, drawFX, shadow, rrect, blob, label, disc } from './draw.js';

const $ = s => document.querySelector(s);
const key = keyOf;

const G = {
  cv: null, ctx: null, dpr: 1, W: 1, H: 1,
  me: null, guys: new Map(), machines: new Map(), debris: new Map(),
  mode: 'menu', solo: true,
  cam: { x: 0, y: 37, dist: 17, zoom: 40 },   // dist ≈ the old camera height: 8..42
  buildDist: 9,                                // build mode zooms in on the machine (wheel: 5..18)
  buildCam: null,                              // frozen view point while building (Ctrl+G re-centres)
  shake: 0, shakeT: 0,
  input: {}, mouse: { sx: 0, sy: 0, x: 0, y: 0 },
  buildSel: 'frame', buildRot: 0, buildTarget: null, ghost: null, hoverKey: null,
  carried: [],
  roomCfg: { repair: 'any' },
  lap: { track: -1, next: -1, t0: 0, last: 0, best: 0 },
  padT: 0, board: new Map(),
  sendT: 0, debrisN: 1, exhT: 0, dustT: 0,
};
window.KR = window.VR = { G, NET, TUNE, WORLD, VOICE };   // debug handle

/* ---- boot ---------------------------------------------------------------- */
function boot(){
  G.cv = $('#c'); G.ctx = G.cv.getContext('2d');
  onResize(); addEventListener('resize', onResize);
  buildWorld();
  wireInput(); wireMenu(); wireNet();
  window.KR.dbg = { serializeParts, loadParts, onImpact, sendBuilds, teleportTo, toggleBuild, placePart, removePart, selectPart, actionSeat, actionGrab, exitBuild };
  probeLogo();
  requestAnimationFrame(loop);
}
function onResize(){
  G.dpr = Math.min(2, devicePixelRatio || 1);
  G.W = innerWidth; G.H = innerHeight;
  G.cv.width = Math.round(G.W * G.dpr); G.cv.height = Math.round(G.H * G.dpr);
  G.cv.style.width = G.W + 'px'; G.cv.style.height = G.H + 'px';
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
  const pid = myPid();
  G.me = makeGuy(colorFor(pid), name);
  G.me.x = WORLD.spawn.x; G.me.y = WORLD.spawn.y;
  const spot = WORLD.parking[hash(pid) % WORLD.parking.length];
  const m = makeMachine(pid, spot.x, spot.y);
  m.parts = starterLayout(); refresh(m);
  G.machines.set(m.id, m);
  G.cam.x = G.me.x; G.cam.y = G.me.y;
  G.mode = 'play';
  document.body.classList.add('playing');        // native cursor off, fun cursor on
  $('#menu').classList.add('hide');
  $('#hud').classList.remove('hide');
  if(!G.solo){ NET.send('hi', {}); sendBuilds(); }
  toast(G.solo ? 'sandbox — your machine is parked ahead' : 'room ' + NET.code + ' — bring friends');
}

const hash = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const colorFor = pid => GUY_COLORS[hash(pid) % GUY_COLORS.length];
function myPid(){ return G.solo ? 'solo' : NET.me; }
function simOwner(m){ return m.driver || m.owner; }

/* ---- net wiring ---------------------------------------------------------- */
function wireNet(){
  NET.on('peers', peers => {
    for(const [pid, info] of peers){
      if(pid === NET.me || G.guys.has(pid)) continue;
      const g = makeGuy(colorFor(pid), info.name); g.remote = true;
      G.guys.set(pid, g);
    }
    for(const [pid] of G.guys){
      if(!peers.has(pid)){
        G.guys.delete(pid);
        for(const m of G.machines.values()) if(m.driver === pid) m.driver = null;
      }
    }
    renderPeers();
  });
  NET.on('hi', () => { sendBuilds(); if(NET.isHost) NET.send('cfg', G.roomCfg); sendGuy(); });
  NET.on('cfg', d => { G.roomCfg = d; });
  NET.on('build', d => {
    let m = G.machines.get(d.mid);
    if(!m){ m = makeMachine(d.owner, d.p[0], d.p[1]); m.id = d.mid; G.machines.set(m.id, m); }
    m.owner = d.owner; m.remote = true;
    m.x = d.p[0]; m.y = d.p[1]; m.a = d.a; m.z = d.z || 0;
    m.net = { x: m.x, y: m.y, a: m.a, z: m.z };
    m.fuel = d.fuel; m.batt = d.batt;
    loadParts(m, d.parts);
  });
  NET.on('m', d => {
    const m = G.machines.get(d.mid); if(!m || !m.remote) return;
    m.net = { x: d.p[0], y: d.p[1], a: d.a, z: d.z || 0 };
    m.vx = d.v[0]; m.vy = d.v[1]; m.fuel = d.fuel; m.batt = d.batt;
  });
  NET.on('g', (d, from) => {
    const g = G.guys.get(from); if(!g) return;
    g.net = { x: d.p[0], y: d.p[1], yaw: d.yaw }; g.inMachine = d.inM || null;
  });
  NET.on('seat', d => {
    const m = G.machines.get(d.mid); if(!m) return;
    m.driver = d.driver;
    m.remote = simOwner(m) !== myPid();        // sim ownership: driver first, else owner
    if(!m.remote) m.net = null;
  });
  NET.on('shear', d => {
    const m = G.machines.get(d.mid);
    if(m && m.remote){
      const c0 = { ...m.center };
      for(const [k] of d.cells) m.parts.delete(k);
      refresh(m); anchorFix(m, c0);
    }
    for(const db of d.debris) spawnDebris(db);
  });
  NET.on('grab', d => { G.debris.delete(d.did); });
  NET.on('lap', (d, from) => {
    const nm = (NET.peers.get(from) || {}).name || '???';
    noteLap(nm, d.ms, d.track ? trackById(d.track) : null);
  });
}
function sendBuild(m){
  NET.send('build', { mid: m.id, owner: m.owner, parts: serializeParts(m), p: [m.x, m.y], a: m.a, z: m.z, fuel: m.fuel, batt: m.batt });
}
function sendBuilds(){ for(const m of G.machines.values()) if(m.owner === myPid()) sendBuild(m); }
function sendGuy(){ if(G.solo || !G.me) return; NET.send('g', { p: [G.me.x, G.me.y], yaw: G.me.yaw, inM: G.me.inMachine }); }

/* ---- input --------------------------------------------------------------- */
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump' };
function wireInput(){
  addEventListener('keydown', e => {
    if(G.mode === 'menu') return;
    if(e.target && e.target.tagName === 'INPUT') return;
    if(e.ctrlKey && e.code === 'KeyG'){      // re-centre the build view
      e.preventDefault();
      const m = G.machines.get(G.buildTarget);
      if(G.mode === 'build' && m && G.buildCam){ G.buildCam.x = m.x; G.buildCam.y = m.y; }
      return;
    }
    if(KEYMAP[e.code]) G.input[KEYMAP[e.code]] = true;
    if(e.code === 'KeyE') actionSeat();
    if(e.code === 'KeyF') actionGrab();
    if(e.code === 'KeyB') toggleBuild();
    if(e.code === 'KeyM' && VOICE.on) $('#vcBtn').textContent = VOICE.toggleMute() ? '🔇 VC' : '🎙 VC';
    if(e.code === 'KeyT'){         // hot-reload Adam's art
      loadArt().then(loaded => {
        clearIcons(); if(G.ring && G.ring.isOpen) G.ring.render();
        console.log('[art] reloaded:', loaded.join(', ') || '(none drawn yet)');
      });
      probeLogo();
    }
    if(G.mode === 'build'){
      if(e.code === 'Escape' && G.ring && G.ring.isOpen) G.ring.close();
      if(e.code === 'KeyR') G.buildRot = (G.buildRot + 1) & 3;
      if(e.code === 'KeyX' && !(G.ring && G.ring.isOpen)) removePart();
      const idx = PART_ORDER.findIndex(t => PARTS[t].key === e.key);
      if(idx >= 0) selectPart(PART_ORDER[idx]);
    }
    if(e.code === 'Space' && G.mode !== 'menu') e.preventDefault();
  });
  addEventListener('keyup', e => { if(e.target && e.target.tagName === 'INPUT') return; if(KEYMAP[e.code]) G.input[KEYMAP[e.code]] = false; });
  addEventListener('mousemove', e => { G.mouse.sx = e.clientX; G.mouse.sy = e.clientY; });
  const cv = G.cv;
  cv.addEventListener('mousedown', e => {
    if(G.mode !== 'build') return;
    if(e.button === 0) placePart();
    else if(e.button === 1){ e.preventDefault(); removePart(); }
    else if(e.button === 2) G.ring.toggle(e.clientX, e.clientY);   // the catalog lives at the cursor
  });
  addEventListener('contextmenu', e => { if(document.body.classList.contains('playing')) e.preventDefault(); });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    if(G.mode === 'build') G.buildDist = Math.max(5, Math.min(18, G.buildDist + e.deltaY * 0.01));
    else G.cam.dist = Math.max(8, Math.min(42, G.cam.dist + e.deltaY * 0.02));
  }, { passive: false });
  $('#vcBtn').onclick = () => { $('#vcBtn').textContent = VOICE.toggleMute() ? '🔇 VC' : '🎙 VC'; };
}
/* screen <-> world */
function toWorld(sx, sy){ return { x: G.cam.x + (sx - G.W / 2) / G.cam.zoom, y: G.cam.y + (sy - G.H / 2) / G.cam.zoom }; }

/* ---- seats --------------------------------------------------------------- */
function drivenMachine(){ return G.me && G.me.inMachine ? G.machines.get(G.me.inMachine) : null; }
function actionSeat(){
  if(G.mode !== 'play') return;
  const m = drivenMachine();
  if(m){   // hop out (to the right of the machine)
    m.driver = null; m.throttle = 0; m.steer = 0; m.boosting = false;
    G.me.inMachine = null;
    const d = m.radius + 0.8;
    G.me.x = m.x + Math.cos(m.a) * d; G.me.y = m.y + Math.sin(m.a) * d; G.me.z = WORLD.h(G.me.x, G.me.y);
    if(!G.solo){ NET.send('seat', { mid: m.id, driver: null }); sendGuy(); }
    return;
  }
  let best = null, bd = 2.6;
  for(const mm of G.machines.values()){
    if(!mm.seatKey || mm.driver) continue;
    const s = cellWorld(mm, mm.seatKey);
    const d = Math.hypot(s.x - G.me.x, s.y - G.me.y);
    if(d < bd){ bd = d; best = mm; }
  }
  if(!best) return;
  best.driver = myPid(); best.remote = false; best.net = null;   // I simulate what I drive
  G.me.inMachine = best.id;
  if(!G.solo){ NET.send('seat', { mid: best.id, driver: myPid() }); sendGuy(); }
  if(best.owner !== myPid()) toast("borrowing " + ownerName(best) + "'s machine 😈");
  G.lap.next = -1; G.lap.track = -1;
}
function ownerName(m){ return m.owner === myPid() ? 'your' : ((NET.peers.get(m.owner) || {}).name || '???'); }

/* ---- impacts / shear / debris -------------------------------------------- */
function onImpact(m, J, ax, ay){
  if(m.remote || m.grace > 0) return;
  if(G.me.inMachine === m.id) G.shake = Math.min(1, G.shake + J / 120);
  const c0 = { ...m.center };
  const shed = shearParts(m, J, ax, ay);
  if(!shed.length){ burst(ax, ay, 4, PAL.paper, 3, 0.08); return; }
  anchorFix(m, c0);
  const list = [];
  for(const c of shed){
    const wp = cellWorld(m, c.k);
    const db = { did: myPid() + ':' + (G.debrisN++), type: c.p.type, rot: c.p.rot,
      p: [wp.x, wp.y], z: m.z + 0.3, v: [m.vx * 0.5 + rnd(4), m.vy * 0.5 + rnd(4)], vz: 5 + rnd(3), ang: m.a,
      home: { mid: m.id, k: c.k } };
    list.push(db); spawnDebris(db);
    burst(wp.x, wp.y, 7, PARTS[c.p.type].color, 4, 0.1);
  }
  if(!G.solo) NET.send('shear', { mid: m.id, cells: shed.map(c => [c.k]), debris: list });
  toast('-' + shed.map(c => PARTS[c.p.type].label).join(', -'));
  // seat gone while I'm in it → YEET
  if(G.me.inMachine === m.id && !m.seatKey){
    eject(G.me, m.x, m.y, m.z + 0.5);
    m.driver = null;
    if(!G.solo){ NET.send('seat', { mid: m.id, driver: null }); }
    toast('EJECTED!!');
  }
}
const rnd = s => (Math.random() - 0.5) * s;

function spawnDebris(db){
  if(G.debris.has(db.did)) return;
  G.debris.set(db.did, { ...db, x: db.p[0], y: db.p[1], z: db.z || 0.3, vx: db.v[0], vy: db.v[1], vz: db.vz || 5,
    ang: db.ang || 0, spin: rnd(8), asleep: false });
}
function stepDebris(dt){
  for(const db of G.debris.values()){
    if(db.asleep) continue;
    db.vz -= 22 * dt;
    db.x += db.vx * dt; db.y += db.vy * dt; db.z += db.vz * dt; db.ang += db.spin * dt;
    const gz = WORLD.h(db.x, db.y);
    if(db.z < gz){
      db.z = gz;
      db.vz *= -0.32; db.vx *= 0.7; db.vy *= 0.7; db.spin *= 0.5;
      if(db.vx * db.vx + db.vy * db.vy + db.vz * db.vz < 0.6){ db.vx = db.vy = db.vz = 0; db.asleep = true; }
    }
  }
}
function drawDebris(ctx, zoom){
  for(const db of G.debris.values()){
    const k = Math.max(0.4, 1 - db.z * 0.08);
    shadow(ctx, db.x, db.y, 0.36 * k, 0.3 * k, 0.18 * k);
    ctx.save(); ctx.translate(db.x, db.y - db.z * 0.5); ctx.rotate(db.ang);
    drawPart(ctx, db.type, db.rot, zoom);
    ctx.restore();
  }
}

function actionGrab(){
  if(G.mode !== 'play' || !G.me || G.me.inMachine) return;
  // carrying parts + near my machine → bolt them back on
  let myM = null, md = 7;
  for(const mm of G.machines.values()){
    if(mm.owner !== myPid()) continue;
    const d = Math.hypot(mm.x - G.me.x, mm.y - G.me.y);
    if(d < md){ md = d; myM = mm; }
  }
  if(myM && G.carried.length && repairOK(myM.x, myM.y)){
    let n = 0;
    const c0 = { ...myM.center };
    G.carried = G.carried.filter(c => {
      if(c.home && c.home.mid === myM.id && !myM.parts.has(c.home.k)){ myM.parts.set(c.home.k, { type: c.type, rot: c.rot }); n++; return false; }
      return true;
    });
    if(n){
      refresh(myM); anchorFix(myM, c0);
      toast(n + (n > 1 ? ' parts' : ' part') + ' back on!');
      burst(myM.x, myM.y, 6, PAL.paper, 3, 0.08);
      if(!G.solo) sendBuilds();
      return;
    }
  }
  // else: grab nearest debris
  let best = null, bd = 2.6;
  for(const db of G.debris.values()){
    const d = Math.hypot(db.x - G.me.x, db.y - G.me.y);
    if(d < bd){ bd = d; best = db; }
  }
  if(!best) return;
  const home = G.machines.get(best.home?.mid);
  const mine = home && home.owner === myPid();
  if(mine && Math.hypot(home.x - G.me.x, home.y - G.me.y) < 9 && !home.parts.has(best.home.k) && repairOK(home.x, home.y)){
    const c0 = { ...home.center };
    home.parts.set(best.home.k, { type: best.type, rot: best.rot });
    refresh(home); anchorFix(home, c0);
    toast(PARTS[best.type].label + ' back on!');
    if(!G.solo){ NET.send('grab', { did: best.did }); sendBuilds(); }
  } else {
    G.carried.push({ type: best.type, rot: best.rot, home: best.home });
    const theirs = home && home.owner !== myPid();
    toast('carrying ' + PARTS[best.type].label + (theirs ? ' (STOLEN 😈)' : ' — F at your machine to bolt it on'));
    if(!G.solo) NET.send('grab', { did: best.did });
  }
  G.debris.delete(best.did);
}
function repairOK(x, y){ if(G.solo || G.roomCfg.repair === 'any') return true; return inPit(x, y); }

/* ---- build mode ----------------------------------------------------------- */
function toggleBuild(){
  if(G.mode === 'build'){ exitBuild(); return; }
  if(G.mode !== 'play') return;
  if(G.me.inMachine){ toast('hop out first (E)'); return; }
  let target = null, bd = 7;
  for(const m of G.machines.values()){
    if(m.owner !== myPid()) continue;
    const d = Math.hypot(m.x - G.me.x, m.y - G.me.y);
    if(d < bd){ bd = d; target = m; }
  }
  if(target && !repairOK(target.x, target.y)){ toast('pit-only room — build in the yellow pads'); return; }
  if(!target){
    if(!repairOK(G.me.x, G.me.y)){ toast('pit-only room — build in the yellow pads'); return; }
    target = makeMachine(myPid(), G.me.x + Math.sin(G.me.yaw) * 3, G.me.y - Math.cos(G.me.yaw) * 3);
    target.a = G.me.yaw;
    target.parts.set(key(0, 0), { type: 'frame', rot: 0 });
    refresh(target);
    G.machines.set(target.id, target);
  }
  G.buildTarget = target.id;
  target.editing = true; target.vx = target.vy = target.w = 0; target.z = WORLD.h(target.x, target.y); target.air = false;
  G.buildCam = { x: target.x, y: target.y };
  G.mode = 'build';
  if(!G.ring) G.ring = makeRing({ iconFor: partIcon, held: () => G.buildSel, onPick: selectPart });
  G.ghost = null;
}
function exitBuild(){
  const m = G.machines.get(G.buildTarget);
  if(m){ m.editing = false; m.grace = 1.5; refresh(m); if(!G.solo) sendBuilds(); }   // settle never shears
  G.mode = 'play';
  if(G.ring) G.ring.close();
  G.ghost = null; G.buildCam = null;
}
function selectPart(t){ G.buildSel = t; }
function buildHover(){
  const m = G.machines.get(G.buildTarget);
  G.ghost = null; G.hoverKey = null;
  if(!m) return;
  if(G.ring && G.ring.isOpen) return;
  const L = worldToLocal(m, G.mouse.x, G.mouse.y);
  // what's under the cursor (for X / middle-click)
  const ci = Math.round(L.x / CELL), cj = Math.round(L.y / CELL);
  G.hoverKey = m.occ.get(key(ci, cj)) || null;
  // footprint snapped under the cursor
  const [fw, fd] = fpOf(G.buildSel);
  const ai = Math.round(L.x / CELL - (fw - 1) / 2), aj = Math.round(L.y / CELL - (fd - 1) / 2);
  let touch = false;
  for(let i = 0; i < fw; i++) for(let j = 0; j < fd; j++){
    const cx = ai + i, cy = aj + j;
    if(m.occ.has(key(cx, cy))) return;
    for(const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if(m.occ.has(key(cx + d[0], cy + d[1]))) touch = true;
  }
  if(touch) G.ghost = { i: ai, j: aj };
}
function placePart(){
  const m = G.machines.get(G.buildTarget);
  if(!m || !G.ghost) return;
  const c0 = { ...m.center };
  m.parts.set(key(G.ghost.i, G.ghost.j), { type: G.buildSel, rot: G.buildRot });
  refresh(m); anchorFix(m, c0);
  G.ghost = null;
}
function removePart(){
  const m = G.machines.get(G.buildTarget);
  if(!m || !G.hoverKey || m.parts.size <= 1) return;
  const c0 = { ...m.center };
  const p = m.parts.get(G.hoverKey); const wp = cellWorld(m, G.hoverKey);
  m.parts.delete(G.hoverKey);
  refresh(m); anchorFix(m, c0);
  if(p) burst(wp.x, wp.y, 5, PARTS[p.type].color, 3, 0.08);
  G.hoverKey = null;
}
function drawBuildOverlay(ctx, zoom){
  const m = G.machines.get(G.buildTarget); if(!m) return;
  ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.a);
  // soft grid dots around the machine (machine-local)
  const R = 7;
  const i0 = Math.round(m.center.x / CELL) - R, i1 = Math.round(m.center.x / CELL) + R, j0 = Math.round(m.center.y / CELL) - R, j1 = Math.round(m.center.y / CELL) + R;
  ctx.fillStyle = rgba(PAL.ink, 0.16);
  for(let i = i0; i <= i1; i++) for(let j = j0; j <= j1; j++){ if(m.occ.has(key(i, j))) continue; ctx.beginPath(); ctx.arc(i * CELL - m.center.x, j * CELL - m.center.y, 0.028, 0, Math.PI * 2); ctx.fill(); }
  // hovered part outline (removal target)
  if(G.hoverKey && !G.ghost){
    const p = m.parts.get(G.hoverKey); const [i, j] = G.hoverKey.split(',').map(Number); const [w, d] = fpOf(p.type);
    rrect(ctx, i * CELL - CELL / 2 - m.center.x, j * CELL - CELL / 2 - m.center.y, w * CELL, d * CELL, 0.08);
    ctx.lineWidth = 0.05; ctx.strokeStyle = rgba(PAL.red, 0.8); ctx.stroke();
  }
  // ghost of what you'd place
  if(G.ghost){
    const c = localCenterOf(G.ghost.i, G.ghost.j, G.buildSel);
    ctx.save(); ctx.translate(c.x - m.center.x, c.y - m.center.y);
    drawPart(ctx, G.buildSel, G.buildRot, zoom, 0.55);
    ctx.restore();
  }
  ctx.restore();
}

/* ---- laps: whichever track's start line you cross owns the timer ------------- */
function stepLap(m){
  const L = G.lap;
  if(L.track < 0){
    for(let i = 0; i < WORLD.tracks.length; i++){
      const c0 = WORLD.tracks[i].cps[0];
      if(Math.hypot(m.x - c0.x, m.y - c0.y) < c0.r){ L.track = i; L.next = 1; L.t0 = performance.now(); return; }
    }
    return;
  }
  const tr = WORLD.tracks[L.track], cps = tr.cps, nx = L.next;
  for(let i = 0; i < WORLD.tracks.length; i++){ if(i === L.track) continue; const c0 = WORLD.tracks[i].cps[0];
    if(Math.hypot(m.x - c0.x, m.y - c0.y) < c0.r){ L.track = i; L.next = 1; L.t0 = performance.now(); return; } }
  if(tr.closed){
    const c = cps[nx % cps.length];
    if(Math.hypot(m.x - c.x, m.y - c.y) < c.r){
      if(nx === cps.length){
        const ms = performance.now() - L.t0;
        L.last = ms; if(!L.best || ms < L.best) L.best = ms;
        noteLap(G.me.name, ms, tr);
        if(!G.solo) NET.send('lap', { ms, track: tr.id });
        toast(tr.name + ' LAP ' + fmtMs(ms) + (ms === L.best ? '  — BEST' : ''));
        burst(m.x, m.y, 10, PAL.pad, 5, 0.1);
        L.next = 1; L.t0 = performance.now();
      } else L.next = nx + 1;
    }
  } else {
    const c = cps[Math.min(nx, cps.length - 1)];
    if(Math.hypot(m.x - c.x, m.y - c.y) < c.r){
      if(nx >= cps.length - 1){
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
  const px = drv ? drv.x : G.me.x, py = drv ? drv.y : G.me.y;
  if(G.padT < 0){ G.padT += dt; return null; }
  let on = null;
  for(const pad of WORLD.pads) if(Math.hypot(px - pad.x, py - pad.y) < pad.r){ on = pad; break; }
  if(!on){ G.padT = 0; return null; }
  G.padT += dt;
  if(G.padT > 0.8){ teleportTo(on.track, drv); G.padT = -2; }
  return on;
}
function teleportTo(trackId, drv){
  const tr = trackById(trackId); if(!tr) return;
  const st = tr.start;
  const park = (m) => { m.x = st.x; m.y = st.y; m.a = st.a; m.vx = m.vy = m.w = 0; m.z = WORLD.h(m.x, m.y); m.air = false; m.grace = 1.5; if(m.net){ m.net.x = m.x; m.net.y = m.y; m.net.a = m.a; } };
  if(drv) park(drv);
  else {
    let mine = null, bd = 14; for(const m of G.machines.values()) if(m.owner === myPid() && !m.driver){ const d = Math.hypot(m.x - G.me.x, m.y - G.me.y); if(d < bd){ bd = d; mine = m; } }
    if(mine) park(mine);
    G.me.x = st.x + Math.cos(st.a) * 4; G.me.y = st.y + Math.sin(st.a) * 4; G.me.z = WORLD.h(G.me.x, G.me.y);
  }
  G.cam.x = drv ? drv.x : G.me.x; G.cam.y = drv ? drv.y : G.me.y;
  G.lap.track = -1; G.lap.next = -1;
  if(!G.solo){ sendGuy(); sendBuilds(); }
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

/* ---- the ground point under the cursor, as a walk direction from the guy ----- */
function mouseAim(){
  if(!G.me || G.me.inMachine) return null;
  const dx = G.mouse.x - G.me.x, dy = G.mouse.y - G.me.y;
  const L = Math.hypot(dx, dy);
  return L > 0.5 ? { x: dx / L, y: dy / L } : null;   // dead zone on top of the guy
}

/* ---- little effects: exhaust, dust, splashes ----------------------------------- */
function stepEffects(dt){
  G.exhT -= dt; G.dustT -= dt;
  for(const m of G.machines.values()){
    if(!m.parts.size || m.editing) continue;
    const sp = Math.hypot(m.vx, m.vy);
    const fwdx = Math.sin(m.a), fwdy = -Math.cos(m.a);
    // exhaust from engines while driving
    if(G.exhT <= 0 && m.driver && Math.abs(m.throttle) > 0.1 && m.engines && m.fuel > 0 && Math.min(m.engines, m.freeIntakes) > 0){
      for(const [k, p] of m.parts){ if(p.type !== 'engine') continue;
        const [i, j] = k.split(',').map(Number); const c = localCenterOf(i, j, p.type);
        const wp = localToWorld(m, c.x, c.y + 0.38);
        puff(wp.x, wp.y, { vx: -fwdx * 1.5 + rnd(1), vy: -fwdy * 1.5 + rnd(1), r: 0.14, grow: 0.9, life: 0.5, color: m.boosting ? PAL.intake : 0xe8e4d8, alpha: 0.5, z: m.z });
      }
    }
    // dust / splash off the asphalt, tire smoke when sliding
    if(G.dustT <= 0 && !m.air && sp > 4){
      for(const wh of m.wheels){
        const wp = localToWorld(m, wh.lx, wh.ly);
        const s = surfaceAt(wp.x, wp.y);
        if(s === SURF.water){ puff(wp.x, wp.y, { vx: rnd(2), vy: rnd(2), r: 0.18, grow: 0.8, life: 0.45, color: PAL.water, alpha: 0.7, vz: 2 + Math.random() * 2, gravity: 14 }); }
        else if(s !== SURF.asphalt){ const col = s === SURF.sand ? PAL.plaza : s === SURF.gravel ? PAL.gravelEdge : tint(PAL.grassDark, .25);
          puff(wp.x, wp.y, { vx: -fwdx * 1 + rnd(1.5), vy: -fwdy * 1 + rnd(1.5), r: 0.16, grow: 1.0, life: 0.4, color: col, alpha: 0.45 }); }
        else if(wh.slip > 7){ puff(wp.x, wp.y, { vx: rnd(1), vy: rnd(1), r: 0.14, grow: 1.2, life: 0.5, color: 0xffffff, alpha: 0.5 }); }
      }
    }
    if(m.landed > 4){ for(let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2; puff(m.x + Math.cos(a) * m.radius * 0.7, m.y + Math.sin(a) * m.radius * 0.7, { vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, r: 0.2, grow: 1.2, life: 0.45, color: 0xf4f0e4, alpha: 0.5 }); } m.landed = 0; }
    else m.landed = 0;
  }
  if(G.exhT <= 0) G.exhT = 0.07;
  if(G.dustT <= 0) G.dustT = 0.06;
}

/* ---- main loop ------------------------------------------------------------ */
let last = 0;
function loop(t){
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
  if(G.mode === 'menu' || !G.me) return;
  const ts = t / 1000;

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
  // the cursor in world space (camera from last frame is fine)
  const mw = toWorld(G.mouse.sx, G.mouse.sy); G.mouse.x = mw.x; G.mouse.y = mw.y;
  if(G.mode === 'play') stepGuy(G.me, WORLD, G.input, dt, mouseAim());
  for(const g of G.guys.values()) syncRemoteGuy(g, dt);
  for(const m of G.machines.values()) netSync(m, dt);
  stepDebris(dt); stepFX(dt); stepEffects(dt);

  const onPad = G.mode === 'play' ? stepPads(dt, drv) : null;
  if(drv){
    G.me.x = drv.x; G.me.y = drv.y; G.me.z = drv.z;
    stepLap(drv);
    if(inPit(drv.x, drv.y) && Math.hypot(drv.vx, drv.vy) < 2){
      const before = drv.fuel;
      drv.fuel = Math.min(100, drv.fuel + 22 * dt); drv.batt = Math.min(100, drv.batt + 22 * dt);
      if(drv.fuel > before) pitFlash(t);
    }
  }
  if(G.mode === 'build') buildHover();

  camera(dt, drv);
  render(ts);
  hud(drv, t);

  // net send @ ~12Hz
  if(!G.solo){
    G.sendT -= dt;
    if(G.sendT <= 0){
      G.sendT = 1 / 12;
      sendGuy();
      for(const m of G.machines.values()){
        if(m.remote || m.editing || simOwner(m) !== myPid()) continue;
        if(m.vx * m.vx + m.vy * m.vy < 0.01 && !m.driver) continue;
        NET.send('m', { mid: m.id, p: [m.x, m.y], a: m.a, v: [m.vx, m.vy], z: m.z, fuel: m.fuel | 0, batt: m.batt | 0 });
      }
    }
  }
}

/* ---- camera: fixed top-down, north up, tight follow ----------------------------- */
function camera(dt, drv){
  let fx, fy, D = G.cam.dist;
  if(G.mode === 'build'){ const m = G.machines.get(G.buildTarget); fx = G.buildCam ? G.buildCam.x : m.x; fy = G.buildCam ? G.buildCam.y : m.y; D = G.buildDist; }
  else if(drv){ fx = drv.x; fy = drv.y; D = G.cam.dist + Math.hypot(drv.vx, drv.vy) * 0.25; }   // zoom out a bit at speed
  else { fx = G.me.x; fy = G.me.y; }
  const k = Math.min(1, dt * 18);
  G.cam.x += (fx - G.cam.x) * k; G.cam.y += (fy - G.cam.y) * k;
  const wantZoom = G.H / (1.25 * D);
  G.cam.zoom += (wantZoom - G.cam.zoom) * Math.min(1, dt * 6);
  if(G.shake > 0.001){ G.shakeT += dt * 40; G.shake *= Math.max(0, 1 - dt * 5); } else G.shake = 0;
}

/* ---- render ---------------------------------------------------------------- */
function render(ts){
  const ctx = G.ctx, z = G.cam.zoom, d = G.dpr;
  const shx = G.shake ? Math.sin(G.shakeT * 1.7) * G.shake * 0.3 : 0, shy = G.shake ? Math.cos(G.shakeT * 2.3) * G.shake * 0.2 : 0;
  const cx = G.cam.x + shx, cy = G.cam.y + shy;
  ctx.setTransform(d * z, 0, 0, d * z, d * (G.W / 2 - cx * z), d * (G.H / 2 - cy * z));
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const view = { x0: cx - G.W / 2 / z, x1: cx + G.W / 2 / z, y0: cy - G.H / 2 / z, y1: cy + G.H / 2 / z };
  drawWorld(ctx, view, z, ts);
  drawDebris(ctx, z);
  for(const m of G.machines.values()) drawMachine(ctx, m, z, ts);
  if(G.mode === 'build') drawBuildOverlay(ctx, z);
  for(const g of G.guys.values()) drawGuy(ctx, g, z, ts);
  drawGuy(ctx, G.me, z, ts);
  // carried parts float by the guy
  if(G.carried.length && !G.me.inMachine){ ctx.save(); ctx.translate(G.me.x, G.me.y - 0.9 - Math.sin(ts * 4) * 0.06); ctx.scale(0.7, 0.7); drawPart(ctx, G.carried[G.carried.length - 1].type, 0, z); ctx.restore(); }
  drawFX(ctx);
  drawCanopy(ctx, view, z);
}

/* ---- hud ------------------------------------------------------------------ */
let lastPitFlash = 0;
function pitFlash(t){ lastPitFlash = t; }
function hud(drv, t){
  const sp = $('#speed'), fu = $('#fuelFill'), ba = $('#battFill'), lapEl = $('#lap');
  if(drv){
    sp.style.display = 'block';
    sp.textContent = Math.round(Math.hypot(drv.vx, drv.vy) * 3.1) + ' mph';
    $('#bars').style.display = 'flex';
    fu.style.width = drv.fuel + '%'; ba.style.width = drv.batt + '%';
    lapEl.style.display = G.lap.next > 0 ? 'block' : 'none';
    if(G.lap.next > 0) lapEl.textContent = (WORLD.tracks[G.lap.track] ? WORLD.tracks[G.lap.track].name + '  ' : '') + fmtMs(performance.now() - G.lap.t0) + (G.lap.best ? '  best ' + fmtMs(G.lap.best) : '');
    const pad = G.padT > 0 ? WORLD.pads.find(p => Math.hypot(drv.x - p.x, drv.y - p.y) < p.r) : null;
    prompt(pad ? '→ ' + pad.name + ' …' : t - lastPitFlash < 400 ? 'PIT — refueling' :
      (drv.fuel <= 0 && drv.engines ? 'OUT OF FUEL — pit lane refuels' : 'E hop out · Shift VROOM'));
  } else {
    sp.style.display = 'none'; $('#bars').style.display = 'none'; lapEl.style.display = 'none';
    let p = '';
    if(G.mode === 'build') p = 'right-click: catalog · click add · X remove · R rotate · Ctrl+G recenter · B done';
    else {
      let nearSeat = false, nearDb = false;
      for(const m of G.machines.values()){ if(!m.seatKey || m.driver) continue; const s = cellWorld(m, m.seatKey); if(Math.hypot(s.x - G.me.x, s.y - G.me.y) < 2.6){ nearSeat = true; break; } }
      for(const db of G.debris.values()) if(Math.hypot(db.x - G.me.x, db.y - G.me.y) < 2.6){ nearDb = true; break; }
      let nearMine = false;
      if(G.carried.length) for(const m of G.machines.values()) if(m.owner === myPid() && Math.hypot(m.x - G.me.x, m.y - G.me.y) < 7){ nearMine = true; break; }
      const pad = G.padT > 0 ? WORLD.pads.find(pp => Math.hypot(G.me.x - pp.x, G.me.y - pp.y) < pp.r) : null;
      p = pad ? '→ ' + pad.name + ' …' : nearSeat ? 'E — hop in' : nearDb ? 'F — grab part'
        : nearMine ? 'F — bolt ' + G.carried.length + ' carried part' + (G.carried.length > 1 ? 's' : '') + ' on'
        : 'WASD walk · B build';
    }
    prompt(p);
  }
}
function prompt(s){ const el = $('#prompt'); if(el.textContent !== s) el.textContent = s; }
// no toasts — pure Trailmakers, the world shows what happened (Adam's ruling)
function toast(s){ console.log('[kRacing]', s); }
function renderPeers(){ $('#peers').textContent = [...NET.peers.values()].map(p => p.name).join(' · '); }

boot();
