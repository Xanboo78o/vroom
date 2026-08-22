/* =============================================================================
   main.js — kRacing, full 2D. Build little machines out of tiles, race your
   friends on one hand-made map, knock each other's wheels off, steal them.
   Canvas renderer in world units; Adam's SVGs are the art (T hot-reloads).
   ============================================================================= */
import { makeRing } from './ring.js';
import { PARTS, PART_ORDER, CELL, fpOf, localCenterOf, drawPart, partIcon, clearIcons, keyOf, cellsOf, parseKey, isDrivable, panelFromPoly } from './parts.js';
import { makeMachine, starterLayout, serializeParts, loadParts, refresh, anchorFix, stepMachine, bumpMachines,
         shearParts, cellWorld, worldToLocal, localToWorld, netSync, drawMachine, topAt, removePartKeys, TUNE, cfgOf, partFacing, segCircles } from './machine.js';
import { buildAct } from './logic.js';
import { GAD, addPuddle, addCaltrop, popCaltrop, addCloud, slipAt, stepGadgets, drawPuddles, drawClouds, stepRopes, drawRopes } from './gadgets.js';
import { makeCfgPanel, keyName } from './cfgpanel.js';
import { honk, squeak, thud, wakeAudio } from './sfx.js';
import { GARAGE, inGarage, padOf, stepFlow, drawFlow, drawReadout, setWind, windBreakKey } from './garage.js';
import { settleAir, partsHash } from './air.js';
import { buildWorld, WORLD, inPit, drawWorld, drawCanopy, surfaceAt } from './world.js';
import { SURF } from './tracks.js';
import { makeGuy, stepGuy, syncRemoteGuy, eject, drawGuy, GUY_SIZE } from './guy.js';
import { loadArt } from './art.js';
import { reloadTiles } from './tiles.js';
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
  cam: { x: 0, y: -215, dist: 20, zoom: 40 },   // dist ≈ the old camera height: 8..42
  buildDist: 11,                               // build mode zooms in on the machine + its readout (wheel: 5..18)
  buildCam: null,                              // frozen view point while building (Ctrl+G re-centres)
  shake: 0, shakeT: 0,
  input: {}, mouse: { sx: 0, sy: 0, x: 0, y: 0 },
  buildSel: 'frame', buildRot: 0, buildTarget: null, ghost: null, hoverKey: null,
  carried: [],
  keys: new Set(),                             // every key held right now (e.code) — blocks read their binds from it
  poly: [], polySnap: null,                    // PANEL draw mode: points so far (cell units, machine-local) + the snapped cursor
  entN: 1,                                     // ids for things I drop in the world
  roomCfg: { repair: 'any', gadgets: true },
  lap: { track: -1, next: -1, t0: 0, last: 0, best: 0 },
  padT: 0, board: new Map(),
  sendT: 0, debrisN: 1, exhT: 0, dustT: 0,
};
window.KR = window.VR = { G, NET, TUNE, WORLD, VOICE };   // debug handle

/* ---- boot ---------------------------------------------------------------- */
function boot(){
  G.cv = $('#c'); G.ctx = G.cv.getContext('2d');
  onResize(); addEventListener('resize', onResize);
  buildWorld(); WORLD.slipAt = slipAt;
  wireInput(); wireMenu(); wireNet();
  G.cfg = makeCfgPanel({ onChange: m => { const c0 = { ...m.center }; refresh(m); anchorFix(m, c0); }, onDelete: k => removePart(k), partName: () => G.me ? G.me.name : '' });
  window.KR.dbg = { serializeParts, loadParts, onImpact, sendBuilds, teleportTo, toggleBuild, placePart, removePart, selectPart, actionSeat, actionGrab, actionRepair, exitBuild, closePoly, openCfg, GAD, buildAct, cfgOf, makeMachine, starterLayout, refresh, snapshotBlue, restock };
  probeLogo(); loadArt();
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
    const gadgets = $('#gadOn') ? $('#gadOn').checked : true;
    await startGame({ solo: false, host: true, code, repair, gadgets });
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
    if(opt.host){ G.roomCfg.repair = opt.repair; G.roomCfg.gadgets = opt.gadgets !== false; }
    $('#roomChip').textContent = NET.code;
    $('#roomChip').style.display = 'block';
    VOICE.start(NET).then(ok => { $('#vcBtn').style.display = 'block'; if(!ok) toast('mic blocked — no VC'); });
  }
  // my guy + my starter machine
  const pid = myPid();
  G.me = makeGuy(colorFor(pid), name);
  G.me.x = WORLD.spawn.x; G.me.y = WORLD.spawn.y;
  const spot = WORLD.parking[hash(pid) % WORLD.parking.length];
  G.bay = spot; G.padIdx = hash(pid) % GARAGE.pads.length;
  const m = makeMachine(pid, spot.x, spot.y);
  m.parts = starterLayout(); refresh(m); snapshotBlue(m);
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
    m.net = { x: d.p[0], y: d.p[1], a: d.a, z: d.z || 0, sa: d.sa || null };
    m.vx = d.v[0]; m.vy = d.v[1]; m.fuel = d.fuel; m.batt = d.batt;
    // live bits of their blocks (flames, brake lights, horn) for drawing
    for(const p of m.parts.values()) p.on = 0;
    if(d.on) for(const [k, v] of d.on){ const p = m.parts.get(k); if(!p) continue; p.on = v;
      if(PARTS[p.type].horn && performance.now() - (p.hornAt || 0) > 700){ p.hornAt = performance.now(); honk(cfgOf(p).clip, 0.12); } }
  });
  NET.on('drop', d => { if(d.kind === 'caltrop') addCaltrop(d); else if(d.kind === 'cloud') addCloud(d); else addPuddle(d); });
  NET.on('pop', d => popCaltrop(d.id));
  NET.on('rope', d => { if(d.on) GAD.ropes.set(d.rope.id, d.rope); else GAD.ropes.delete(d.id); });
  NET.on('punch', d => { const m = G.machines.get(d.mid); if(m && simOwner(m) === myPid() && !m.remote) applyPunch(m, d); });
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
    if(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    wakeAudio();
    if(G.cfg && G.cfg.isOpen && G.cfg.onKey(e)) return;   // the config card eats keys while it's waiting for a bind / Esc
    G.keys.add(e.code);
    if(e.ctrlKey && e.code === 'KeyG'){      // re-centre the build view
      e.preventDefault();
      const m = G.machines.get(G.buildTarget);
      if(G.mode === 'build' && m && G.buildCam){ G.buildCam.x = m.x; G.buildCam.y = m.y; }
      return;
    }
    if(KEYMAP[e.code]) G.input[KEYMAP[e.code]] = true;
    if(e.code === 'KeyE') actionSeat();
    if(e.code === 'KeyF') actionGrab();
    if(e.code === 'KeyQ') actionRepair();
    if(e.code === 'KeyB') toggleBuild();
    if(e.code === 'KeyM' && VOICE.on) $('#vcBtn').textContent = VOICE.toggleMute() ? '🔇 VC' : '🎙 VC';
    if(e.code === 'KeyT'){         // hot-reload Adam's art
      loadArt().then(loaded => {
        clearIcons(); if(G.ring && G.ring.isOpen) G.ring.render();
        console.log('[art] reloaded:', loaded.join(', ') || '(none drawn yet)');
      });
      probeLogo(); reloadTiles();
    }
    if(G.mode === 'build'){
      if(e.code === 'BracketLeft' || e.code === 'BracketRight') setWind(e.code === 'BracketRight' ? 10 : -10);   // the wind
      if(e.code === 'Escape'){ if(G.ring && G.ring.isOpen) G.ring.close(); else if(G.poly.length) G.poly = []; }
      if(e.code === 'Backspace' && G.poly.length){ e.preventDefault(); G.poly.pop(); }
      if(e.code === 'Enter' && G.poly.length >= 3) closePoly();
      if(e.code === 'KeyR') G.buildRot = (G.buildRot + 1) & 3;
      if(e.code === 'KeyX' && !(G.ring && G.ring.isOpen)){ if(G.poly.length) G.poly = []; else removePart(); }
      const idx = PART_ORDER.findIndex(t => PARTS[t].key === e.key);
      if(idx >= 0) selectPart(PART_ORDER[idx]);
    }
    if(e.code === 'Space' && G.mode !== 'menu') e.preventDefault();
  });
  addEventListener('keyup', e => { G.keys.delete(e.code); if(e.target && e.target.tagName === 'INPUT') return; if(KEYMAP[e.code]) G.input[KEYMAP[e.code]] = false; });
  addEventListener('blur', () => { G.keys.clear(); for(const k in G.input) G.input[k] = false; });
  addEventListener('mousemove', e => { G.mouse.sx = e.clientX; G.mouse.sy = e.clientY; });
  const cv = G.cv;
  cv.addEventListener('mousedown', e => {
    if(G.mode !== 'build') return;
    if(e.button === 0){
      if(G.cfg.isOpen && G.cfg.mode && G.hoverKey && G.cfg.clickPart(G.hoverKey)) return;   // picking wheels / wiring
      if(G.buildSel === 'panel') polyClick(); else placePart();
    }
    else if(e.button === 1){ e.preventDefault(); removePart(); }
    else if(e.button === 2){
      // right-click a block = its config card · right-click empty = the catalog (Adam's rule)
      const m = G.machines.get(G.buildTarget); const k = hoverPartKey(m);
      if(k){ if(G.ring.isOpen) G.ring.close(); openCfg(m, k); }
      else { if(G.cfg.isOpen) G.cfg.close(); G.ring.toggle(e.clientX, e.clientY); }
    }
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
const gadgetsOn = () => G.solo || G.roomCfg.gadgets !== false;
const nearHit = (m, list, ax, ay, r = 1.2) => list.some(e => { const w = cellWorld(m, e.k); return Math.hypot(w.x - ax, w.y - ay) < r; });
function onImpact(m, J, ax, ay, other){
  if(m.remote || m.grace > 0) return;
  // a BUMPER / RAM PLATE near the hit soaks up more than half of it
  if(nearHit(m, m.bumpers, ax, ay, 1.1)){ J *= 0.45; burst(ax, ay, 5, PAL.pad, 3, 0.08); }
  else if(gadgetsOn() && nearHit(m, m.rams, ax, ay, 1.1)){ J *= 0.5; burst(ax, ay, 5, PAL.ram, 3, 0.08); }
  // THEIR spikes / ram plate / spinning rotor next to the contact hurt a lot more
  if(other && gadgetsOn()){
    if(nearHit(other, other.spikes, ax, ay, 1.3)){ J *= 2.5; burst(ax, ay, 8, PAL.spikeTip, 5, 0.08); }
    else if(nearHit(other, other.rams, ax, ay, 1.3)){ J *= 2; burst(ax, ay, 6, PAL.ram, 4, 0.08); }
    if(other.rotors.some(r => r.p.rs > 15 && Math.hypot(cellWorld(other, r.k).x - ax, cellWorld(other, r.k).y - ay) < 1.4)){ J *= 2; burst(ax, ay, 10, PAL.rotorBlade, 6, 0.07); }
  }
  if(G.me.inMachine === m.id){ G.shake = Math.min(1, G.shake + J / 120); if(J > 30) thud(Math.min(0.3, J / 300)); }
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
/* the blueprint = the machine as you last built it; Q puts back whatever got knocked off */
function snapshotBlue(m){ m.blue = new Map([...m.parts].map(([k, p]) => [k, { ...p }])); }
function actionRepair(){
  if(G.mode !== 'play') return;
  let m = drivenMachine();
  if(!m || m.owner !== myPid()) m = myNearestMachine(1e9);     // my car, wherever it is
  if(!m || !m.blue) return;
  const c0 = { ...m.center }; let n = 0;
  for(const [k, p] of m.blue) if(!m.parts.has(k)){ m.parts.set(k, { ...p }); n++; }
  n += restock(m);
  if(!n) return;
  refresh(m); anchorFix(m, c0);
  // the knocked-off copies vanish from the track (and from friends' screens)
  for(const [did, db] of G.debris) if(db.home && db.home.mid === m.id){ G.debris.delete(did); if(!G.solo) NET.send('grab', { did }); }
  G.carried = G.carried.filter(c => !(c.home && c.home.mid === m.id));
  burst(m.x, m.y, 10, PAL.paper, 4, 0.1);
  toast('repaired — ' + n + ' back on');
  if(!G.solo) sendBuilds();
}

/* full ammo, no flats, cold jets — the pit / the garage / Q do this */
function restock(m){
  let n = 0;
  for(const p of m.parts.values()){ const def = PARTS[p.type];
    if(def.ammo != null && p.ammo < def.ammo){ p.ammo = def.ammo; n++; }
    if(p.flat){ p.flat = false; n++; } }
  for(const wh of m.wheels) wh.flat = false;
  return n;
}

/* ---- build mode ----------------------------------------------------------- */
function myPad(){ return GARAGE.pads[G.padIdx ?? 0]; }
function myNearestMachine(maxD){ let t = null, bd = maxD; for(const m of G.machines.values()){ if(m.owner !== myPid()) continue; const d = Math.hypot(m.x - G.me.x, m.y - G.me.y); if(d < bd){ bd = d; t = m; } } return t; }
/* put a machine on my aero-tunnel pad, nose into the wind */
function parkOnPad(m){ const p = myPad(); m.x = p.x; m.y = p.y - 0.5; m.a = 0; m.vx = m.vy = m.w = 0; m.z = 0; m.air = false; m.grace = 1.5; if(m.net){ m.net.x = m.x; m.net.y = m.y; m.net.a = 0; } }
function goGarage(){
  const p = myPad();
  const m = myNearestMachine(1e9);                    // my car comes along from wherever it is
  if(m && !m.driver) parkOnPad(m);
  G.me.x = p.x + p.w / 2 + 1.2; G.me.y = p.y + 2; G.me.z = 0;
  G.cam.x = p.x; G.cam.y = p.y;
  if(!G.solo){ sendGuy(); sendBuilds(); }
  toast('→ GARAGE');
}
function toggleBuild(){
  if(G.mode === 'build'){ exitBuild(); return; }
  if(G.mode !== 'play') return;
  if(G.me.inMachine){ toast('hop out first (E)'); return; }
  if(!inGarage(G.me.x, G.me.y)) goGarage();          // building happens in the garage
  let target = myNearestMachine(12);
  if(!target){
    target = makeMachine(myPid(), 0, 0);
    target.parts.set(key(0, 0), { type: 'frame', rot: 0 });
    refresh(target); snapshotBlue(target);
    G.machines.set(target.id, target);
  }
  if(!padOf(target) || padOf(target) !== myPad()) parkOnPad(target);
  G.buildTarget = target.id;
  target.editing = true; target.vx = target.vy = target.w = 0; target.z = 0; target.air = false;
  for(const s of target.segs){ s.rel = 0; s.wrel = 0; }   // trailers straighten out on the pad
  G.buildCam = { x: target.x, y: target.y };
  G.mode = 'build'; G.poly = [];
  if(!G.ring) G.ring = makeRing({ iconFor: partIcon, held: () => G.buildSel, onPick: selectPart });
  G.ghost = null;
}
function exitBuild(){
  const m = G.machines.get(G.buildTarget);
  if(m){ m.editing = false; m.grace = 1.5; restock(m); refresh(m); if(m.airLoad && m.airHash === partsHash(m)) m.cd = TUNE.dragBase + (m.frontalAir + m.wings * 2) * TUNE.dragArea; for(const s of m.segs){ s.rel = 0; s.wrel = 0; } m.fuel = m.fuelMax; m.batt = m.battMax; snapshotBlue(m); if(!G.solo) sendBuilds(); }   // settle never shears; the garage fills you up; keep the tunnel's real drag
  G.mode = 'play';
  if(G.ring) G.ring.close();
  if(G.cfg) G.cfg.close();
  G.ghost = null; G.buildCam = null; G.poly = [];
}
function selectPart(t){ G.buildSel = t; if(t !== 'panel') G.poly = []; }
/* the topmost part under the cursor (any layer) */
function hoverPartKey(m){ if(!m) return null; const L = worldToLocal(m, G.mouse.x, G.mouse.y); const ci = Math.round(L.x / CELL), cj = Math.round(L.y / CELL); const tl = topAt(m, ci, cj); return tl >= 0 ? m.occ.get(key(ci, cj, tl)) : null; }
function openCfg(m, k){ if(!m || !m.parts.has(k)) return; G.cfg.open(m, k); }
function buildHover(){
  const m = G.machines.get(G.buildTarget);
  G.ghost = null; G.hoverKey = null; G.polySnap = null;
  if(!m) return;
  if(G.ring && G.ring.isOpen) return;
  const L = worldToLocal(m, G.mouse.x, G.mouse.y);
  const ci = Math.round(L.x / CELL), cj = Math.round(L.y / CELL);
  const tl = topAt(m, ci, cj);                                   // topmost part under the cursor
  const top = tl >= 0 ? m.occ.get(key(ci, cj, tl)) : null;
  G.hoverKey = top;
  if(G.buildSel === 'panel'){
    // PANEL draw mode: the cursor snaps to the nearest cell CENTRE or CORNER (cell units)
    const x = L.x / CELL, y = L.y / CELL;
    const c = [Math.round(x), Math.round(y)], k = [Math.round(x - 0.5) + 0.5, Math.round(y - 0.5) + 0.5];
    G.polySnap = Math.hypot(x - c[0], y - c[1]) <= Math.hypot(x - k[0], y - k[1]) ? { x: c[0], y: c[1] } : { x: k[0], y: k[1] };
    return;
  }
  const [fw, fd] = fpOf(G.buildSel);
  let ai, aj, al;
  if(top){
    // the top-down rule: MIDDLE of a part stacks UP, near an edge extends SIDEWAYS on that layer
    const [oi, oj, ol] = parseKey(top); const [ow, od] = fpOf(m.parts.get(top).type);
    const ux = L.x / CELL - (oi - 0.5), uy = L.y / CELL - (oj - 0.5);
    const ex = Math.min(ux, ow - ux) / ow, ey = Math.min(uy, od - uy) / od;
    if(Math.min(ex, ey) < 0.25){
      al = ol;
      if(ex <= ey){ ai = ux < ow / 2 ? oi - fw : oi + ow; aj = Math.round(L.y / CELL - (fd - 1) / 2); }
      else        { aj = uy < od / 2 ? oj - fd : oj + od; ai = Math.round(L.x / CELL - (fw - 1) / 2); }
    } else { al = ol + 1; ai = Math.round(L.x / CELL - (fw - 1) / 2); aj = Math.round(L.y / CELL - (fd - 1) / 2); }
  } else { al = 0; ai = Math.round(L.x / CELL - (fw - 1) / 2); aj = Math.round(L.y / CELL - (fd - 1) / 2); }
  // valid = footprint free on that layer + (layer 0: touching a neighbour · above: every cell supported)
  let ok = true, touch = false;
  for(let i = 0; i < fw && ok; i++) for(let j = 0; j < fd; j++){
    const cx = ai + i, cy = aj + j;
    if(m.occ.has(key(cx, cy, al))){ ok = false; break; }
    if(al === 0){ for(const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if(m.occ.has(key(cx + d[0], cy + d[1], 0))) touch = true; }
    else if(!m.occ.has(key(cx, cy, al - 1))){ ok = false; break; }
  }
  if(ok && (al > 0 || touch)) G.ghost = { i: ai, j: aj, l: al };
}
function placePart(){
  const m = G.machines.get(G.buildTarget);
  if(!m || !G.ghost) return;
  const c0 = { ...m.center };
  m.parts.set(key(G.ghost.i, G.ghost.j, G.ghost.l), { type: G.buildSel, rot: G.buildRot });
  refresh(m); anchorFix(m, c0);
  G.ghost = null;
}
function removePart(rk = G.hoverKey){
  const m = G.machines.get(G.buildTarget);
  if(!m || !rk || !m.parts.has(rk) || m.parts.size <= 1) return;
  const c0 = { ...m.center };
  const p = m.parts.get(rk); const wp = cellWorld(m, rk);
  // anything stacked on it comes off too
  const [ri, rj, rl] = parseKey(rk);
  const mine = new Set([...cellsOf(ri, rj, p.type, rl, p)].map(([a, b]) => a + ',' + b));
  const gone = [rk];
  for(let l = rl + 1; l < m.layers; l++) for(const [k, q] of m.parts){ const [i, j, kl] = parseKey(k); if(kl !== l || gone.includes(k)) continue;
    for(const [a, b] of cellsOf(i, j, q.type, l, q)) if(mine.has(a + ',' + b)){ gone.push(k); for(const [a2, b2] of cellsOf(i, j, q.type, l, q)) mine.add(a2 + ',' + b2); break; } }
  for(const k of gone) m.parts.delete(k);
  // wires / wheel picks pointing at what's gone go too
  for(const q of m.parts.values()){ if(!q.cfg) continue; if(q.cfg.out) q.cfg.out = q.cfg.out.filter(o => m.parts.has(o.k)); if(q.cfg.wheels){ q.cfg.wheels = q.cfg.wheels.filter(k => m.parts.has(k)); if(!q.cfg.wheels.length) delete q.cfg.wheels; } }
  refresh(m); anchorFix(m, c0);
  if(p) burst(wp.x, wp.y, 5, PARTS[p.type].color, 3, 0.08);
  if(G.cfg.isOpen && (G.cfg.key === rk || !m.parts.has(G.cfg.key))) G.cfg.close();
  G.hoverKey = null;
}
/* ---- PANEL draw mode: click points, close on the first one ---- */
function polyClick(){
  const s = G.polySnap; if(!s) return;
  if(G.poly.length >= 3 && Math.hypot(s.x - G.poly[0][0], s.y - G.poly[0][1]) < 0.35){ closePoly(); return; }
  if(G.poly.length && Math.hypot(s.x - G.poly[G.poly.length - 1][0], s.y - G.poly[G.poly.length - 1][1]) < 0.01) return;
  G.poly.push([s.x, s.y]);
}
function closePoly(){
  const m = G.machines.get(G.buildTarget); if(!m || G.poly.length < 3){ G.poly = []; return; }
  const pf = panelFromPoly(G.poly); G.poly = [];
  if(!pf){ toast('panel covers no cells'); return; }
  // one layer for the whole panel: the layer above whatever it sits on — all of it the same
  let L = -2, touch = false;
  for(const [a, b] of pf.cells){ const t = topAt(m, pf.i0 + a, pf.j0 + b); if(L === -2) L = t; else if(t !== L){ toast('a panel must sit on ONE level (or all on the ground)'); return; }
    if(t < 0) for(const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if(m.occ.has(key(pf.i0 + a + d[0], pf.j0 + b + d[1], 0))) touch = true; }
  if(L < 0 && !touch){ toast('a ground panel must touch the build'); return; }
  const c0 = { ...m.center };
  m.parts.set(key(pf.i0, pf.j0, L + 1), { type: 'panel', rot: 0, cfg: { cells: pf.cells, poly: pf.poly, color: G.panelColor || PAL.panel } });
  refresh(m); anchorFix(m, c0);
}
function drawBuildOverlay(ctx, zoom){
  const m = G.machines.get(G.buildTarget); if(!m) return;
  ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.a);
  // soft grid dots around the machine (machine-local)
  const R = 7;
  const i0 = Math.round(m.center.x / CELL) - R, i1 = Math.round(m.center.x / CELL) + R, j0 = Math.round(m.center.y / CELL) - R, j1 = Math.round(m.center.y / CELL) + R;
  ctx.fillStyle = rgba(PAL.ink, 0.16);
  for(let i = i0; i <= i1; i++) for(let j = j0; j <= j1; j++){ if(m.occ.has(key(i, j, 0))) continue; ctx.beginPath(); ctx.arc(i * CELL - m.center.x, j * CELL - m.center.y, 0.028, 0, Math.PI * 2); ctx.fill(); }
  // hovered part outline (removal target)
  if(G.hoverKey && !G.ghost){
    const p = m.parts.get(G.hoverKey); const [i, j] = parseKey(G.hoverKey); const [w, d] = fpOf(p.type);
    rrect(ctx, i * CELL - CELL / 2 - m.center.x, j * CELL - CELL / 2 - m.center.y, w * CELL, d * CELL, 0.08);
    ctx.lineWidth = 0.05; ctx.strokeStyle = rgba(PAL.red, 0.8); ctx.stroke();
  }
  // wires (sensor → block, with the amount) and wheel picks (engine/brake → wheels)
  const cfgK = G.cfg.isOpen ? G.cfg.key : null;
  for(const [k, p] of m.parts){
    const c = cfgOf(p); const bold = k === cfgK;
    for(const o of c.out){ const t = m.parts.get(o.k); if(!t) continue; link(ctx, m, p, t, PAL.wire, bold ? 0.9 : 0.45, t && !PARTS[t.type].gate ? Math.round((o.amt == null ? 1 : o.amt) * 100) + '%' : '', p.sig ? 0.09 : 0.05); }
    if(c.wheels) for(const wk of c.wheels){ const t = m.parts.get(wk); if(t) link(ctx, m, p, t, PARTS[p.type].brake ? PAL.brake : PAL.engine, bold ? 0.9 : 0.35, '', 0.05); }
  }
  if(cfgK && m.parts.has(cfgK)){
    const p = m.parts.get(cfgK); const [w, d] = fpOf(p.type, p).map(v => v * CELL);
    rrect(ctx, p.lx - w / 2 - 0.04 - m.center.x, p.ly - d / 2 - 0.04 - m.center.y, w + 0.08, d + 0.08, 0.1); ctx.lineWidth = 0.06; ctx.strokeStyle = hex(PAL.blue); ctx.stroke();
    if(G.cfg.mode) for(const [k, q] of m.parts){ const qd = PARTS[q.type]; const ok = G.cfg.mode === 'wheels' ? qd.wheel : (k !== cfgK && (isDrivable(qd) || qd.gate)); if(!ok) continue;
      const [qw, qd2] = fpOf(q.type, q).map(v => v * CELL); rrect(ctx, q.lx - qw / 2 - m.center.x, q.ly - qd2 / 2 - m.center.y, qw, qd2, 0.08); ctx.lineWidth = 0.05; ctx.setLineDash([0.08, 0.08]); ctx.strokeStyle = rgba(PAL.blue, 0.9); ctx.stroke(); ctx.setLineDash([]); }
  }
  // PANEL in progress: points, edges, the snapped cursor, the cells it would cover
  if(G.buildSel === 'panel'){
    const pts = G.poly.map(([x, y]) => [x * CELL - m.center.x, y * CELL - m.center.y]);
    if(G.poly.length >= 3){ const pf = panelFromPoly(G.poly); if(pf){ ctx.fillStyle = rgba(PAL.panel, 0.35); for(const [a, b] of pf.cells) ctx.fillRect((pf.i0 + a - 0.5) * CELL - m.center.x, (pf.j0 + b - 0.5) * CELL - m.center.y, CELL, CELL); } }
    if(pts.length){ ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); if(G.polySnap) ctx.lineTo(G.polySnap.x * CELL - m.center.x, G.polySnap.y * CELL - m.center.y); ctx.lineWidth = 0.05; ctx.strokeStyle = hex(PAL.ink); ctx.setLineDash([0.1, 0.08]); ctx.stroke(); ctx.setLineDash([]);
      pts.forEach(([x, y], i) => { ctx.beginPath(); ctx.arc(x, y, i === 0 ? 0.11 : 0.07, 0, 7); ctx.fillStyle = hex(i === 0 ? PAL.red : PAL.ink); ctx.fill(); }); }
    if(G.polySnap){ ctx.beginPath(); ctx.arc(G.polySnap.x * CELL - m.center.x, G.polySnap.y * CELL - m.center.y, 0.09, 0, 7); ctx.fillStyle = hex(PAL.blue); ctx.fill(); }
  }
  // ghost of what you'd place
  if(G.ghost){
    const c = localCenterOf(G.ghost.i, G.ghost.j, G.buildSel);
    ctx.save(); ctx.translate(c.x - m.center.x, c.y - m.center.y);
    drawPart(ctx, G.buildSel, G.buildRot, zoom, 0.55);
    if(G.ghost.l > 0){ const [w, d] = fpOf(G.buildSel).map(v => v * CELL); ctx.beginPath(); ctx.arc(w / 2 - 0.09, -d / 2 + 0.09, 0.085, 0, Math.PI * 2); ctx.fillStyle = hex(PAL.ink); ctx.fill(); ctx.fillStyle = hex(PAL.paper); ctx.font = '900 0.12px Trebuchet MS, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(G.ghost.l + 1), w / 2 - 0.09, -d / 2 + 0.1); }
    ctx.restore();
  }
  ctx.restore();
}

function link(ctx, m, a, b, color, alpha, text, lw){
  const x0 = a.lx - m.center.x, y0 = a.ly - m.center.y, x1 = b.lx - m.center.x, y1 = b.ly - m.center.y;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineWidth = lw; ctx.strokeStyle = rgba(color, alpha); ctx.lineCap = 'round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(x1, y1, 0.07, 0, 7); ctx.fillStyle = rgba(color, alpha); ctx.fill();
  if(text){ ctx.fillStyle = rgba(PAL.ink, alpha); ctx.font = '900 0.16px Trebuchet MS, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, (x0 + x1) / 2, (y0 + y1) / 2 - 0.12); }
}

/* ---- gadgets the DRIVER fires: oil, smoke, caltrops, the banana, the tow hook, the horn ---- */
function dropAt(m, back = 0.6){
  // behind the WHOLE machine (trailers included), so you don't run over your own mess
  const f = partFacing(m, { rot: 0, seg: 0 }); let far = m.radius;
  for(const c of segCircles(m)){ const d = -((c.x - m.x) * f.x + (c.y - m.y) * f.y) + c.r; if(d > far) far = d; }
  return { x: m.x - f.x * (far + back), y: m.y - f.y * (far + back) };
}
function sendDrop(d){ if(!G.solo) NET.send('drop', d); }
function stepMyGadgets(m, dt){
  const on = gadgetsOn(); const A = m.act;
  for(const g of m.gadgets){
    const p = g.p; const a = (A.get(g.k) || 0) > 0; const edge = a && !p.wasAct; p.wasAct = a;
    if(!on) continue;
    if(g.kind === 'oil' && edge && p.ammo > 0){ p.ammo--; const d = { id: myPid() + ':' + (G.entN++), kind: 'oil', ...dropAt(m), r: 1.7 }; addPuddle(d); sendDrop(d); burst(d.x, d.y, 6, PAL.oil, 3, 0.09); }
    else if(g.kind === 'caltrops' && edge && p.ammo > 0){ p.ammo--; const o = dropAt(m, 0.8); for(let i = 0; i < 3; i++){ const d = { id: myPid() + ':' + (G.entN++), kind: 'caltrop', x: o.x + rnd(2.2), y: o.y + rnd(2.2) }; addCaltrop(d); sendDrop(d); } }
    else if(g.kind === 'smoke' && a && p.ammo > 0){ p.ammo = Math.max(0, p.ammo - dt); p.smokeT = (p.smokeT || 0) - dt;
      if(p.smokeT <= 0){ p.smokeT = 0.14; const o = dropAt(m, 0.4); const d = { id: myPid() + ':' + (G.entN++), kind: 'cloud', x: o.x + rnd(0.6), y: o.y + rnd(0.6), r: 1.5, vx: rnd(0.8), vy: rnd(0.8), owner: myPid(), t: 5 }; addCloud(d); sendDrop(d); } }
    else if(g.kind === 'banana'){
      if(edge){ p.holdT = 0; p.ate = false; }
      if(a && p.ammo > 0){ p.holdT = (p.holdT || 0) + dt; if(p.holdT > 0.8 && !p.ate){ p.ate = true; p.ammo--; m.fuel = Math.min(m.fuelMax, m.fuel + 8); burst(m.x, m.y, 8, PAL.banana, 4, 0.09); squeak(0.1); toast('mm. +8 fuel'); } }
      if(!a && p.wasHeld && !p.ate && (p.holdT || 0) < 0.8 && p.ammo > 0){ p.ammo--; const d = { id: myPid() + ':' + (G.entN++), kind: 'peel', ...dropAt(m), r: 0.9 }; addPuddle(d); sendDrop(d); }
      p.wasHeld = a;
    }
  }
  for(const h of m.hooks){
    const p = h.p; const a = (A.get(h.k) || 0) > 0; const edge = a && !p.wasAct; p.wasAct = a; if(!edge) continue;
    const mine = [...GAD.ropes.values()].find(r => r.from === m.id && r.k === h.k);
    if(mine){ GAD.ropes.delete(mine.id); if(!G.solo) NET.send('rope', { on: false, id: mine.id }); toast('rope off'); continue; }
    const hp = cellWorld(m, h.k); let best = null, bd = 7;
    for(const o of G.machines.values()){ if(o === m || !o.parts.size) continue; const d = Math.hypot(o.x - hp.x, o.y - hp.y) - o.radius; if(d < bd){ bd = d; best = o; } }
    if(!best){ toast('nothing to hook (get within 7)'); continue; }
    const rope = { id: myPid() + ':' + (G.entN++), from: m.id, k: h.k, to: best.id, len: Math.max(3, Math.hypot(best.x - hp.x, best.y - hp.y) + 0.5) };
    GAD.ropes.set(rope.id, rope); if(!G.solo) NET.send('rope', { on: true, rope }); burst(hp.x, hp.y, 5, PAL.hook, 3, 0.08);
  }
  for(const d of m.decor){
    const p = d.p; if(!PARTS[p.type].horn) continue;
    const a = (A.get(d.k) || 0) > 0; const edge = a && !p.wasAct; p.wasAct = a; p.on = a ? 1 : 0;
    if(edge){ honk(cfgOf(p).clip); const w = cellWorld(m, d.k); burst(w.x, w.y, 4, PAL.horn, 3, 0.07); }
  }
}
/* a piston punched THIS machine (mine, or told over the net) */
function applyPunch(o, d){
  o.vx += d.fx * TUNE.punchV * 0.9; o.vy += d.fy * TUNE.punchV * 0.9;
  o.w += ((d.x - o.x) * d.fy - (d.y - o.y) * d.fx) * o.invI * 2.2;
  if(!o.air){ o.air = true; o.vz = 3; }
  burst(d.x, d.y, 6, PAL.piston, 4, 0.08);
  onImpact(o, 36, d.x, d.y);
}
function stepPunches(){
  for(const m of G.machines.values()){
    if(!m.punch || m.remote || simOwner(m) !== myPid()) continue;
    const pu = m.punch; m.punch = null; thud(0.12);
    for(const o of G.machines.values()){
      if(o === m || !o.parts.size || Math.abs(o.z - m.z) > 0.8) continue;
      if(Math.hypot(o.x - pu.x, o.y - pu.y) > o.radius + 0.5) continue;
      const d = { mid: o.id, x: pu.x, y: pu.y, fx: pu.fx, fy: pu.fy };
      if(simOwner(o) === myPid() && !o.remote) applyPunch(o, d); else if(!G.solo) NET.send('punch', d);
      m.vx -= pu.fx * TUNE.punchV * 0.4; m.vy -= pu.fy * TUNE.punchV * 0.4;   // reaction
    }
  }
}
/* a caltrop got one of my wheels */
function onFlat(m, wh, c){ burst(c.x, c.y, 6, PAL.caltrop, 3, 0.08); if(!G.solo) NET.send('pop', { id: c.id }); if(m.driver === myPid()) toast('FLAT TYRE — Q / pit fixes it'); }

/* too much AIR for a part → it rips off (one part every 0.35 s = drama). In the tunnel the air is
   the wind; on the track the air is YOUR SPEED — the readout's break point is real either way. */
function airStress(m, dt, W, driving){
  m.windT = (m.windT || 0) - dt; if(m.windT > 0) return;
  if(!driving && G.mode !== 'build') return;
  const k = windBreakKey(m, W); if(!k || m.parts.size <= 1) return;   // never burst-settle mid-race (uses the garage-settled loads, or the cheap estimate after a shear)
  m.windT = 0.35;
  const c0 = { ...m.center };
  const gone = removePartKeys(m, [k]); anchorFix(m, c0);
  const bx = Math.sin(m.a), by = -Math.cos(m.a);   // forward; debris tumbles backwards
  for(const g of gone){
    const wp = cellWorld(m, g.k); const [, , l] = parseKey(g.k);
    const db = { did: myPid() + ':' + (G.debrisN++), type: g.p.type, rot: g.p.rot, p: [wp.x, wp.y], z: m.z + 0.3 + l * 0.3,
      v: driving ? [m.vx * 0.6 - bx * 3 + rnd(3), m.vy * 0.6 - by * 3 + rnd(3)] : [rnd(2), 4 + W * 0.12], vz: 3 + rnd(2), ang: m.a, home: { mid: m.id, k: g.k } };
    spawnDebris(db); burst(wp.x, wp.y, 6, PARTS[g.p.type].color, 3, 0.08);
    if(!G.solo) NET.send('shear', { mid: m.id, cells: [[g.k]], debris: [db] });
  }
  if(driving && G.me.inMachine === m.id) G.shake = Math.min(1, G.shake + 0.35);
  toast((driving ? 'AIR at ' + Math.round(W) + ' mph ripped off ' : 'WIND ripped off ') + gone.map(g => PARTS[g.p.type].label).join(', '));
  // seat gone → YEET (same as a crash)
  if(G.me.inMachine === m.id && !m.seatKey){ eject(G.me, m.x, m.y, m.z + 0.5); m.driver = null; if(!G.solo) NET.send('seat', { mid: m.id, driver: null }); toast('EJECTED!!'); }
}

/* ---- laps: whichever track's start line you cross owns the timer ------------- */
function stepLap(m){
  const L = G.lap;
  if(L.track < 0){
    for(let i = 0; i < WORLD.tracks.length; i++){
      const c0 = WORLD.tracks[i].cps[0]; if(!c0) continue;
      if(Math.hypot(m.x - c0.x, m.y - c0.y) < c0.r){ L.track = i; L.next = 1; L.t0 = performance.now(); return; }
    }
    return;
  }
  const tr = WORLD.tracks[L.track], cps = tr.cps, nx = L.next;
  for(let i = 0; i < WORLD.tracks.length; i++){ if(i === L.track) continue; const c0 = WORLD.tracks[i].cps[0]; if(!c0) continue;
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
  if(trackId === 'garage'){           // my aero-tunnel pad
    if(drv){ drv.driver = null; drv.throttle = 0; G.me.inMachine = null; if(!G.solo) NET.send('seat', { mid: drv.id, driver: null }); }
    goGarage(); G.padT = -2; G.lap.track = -1; G.lap.next = -1; return;
  }
  if(trackId === 'home'){             // back to the paddock: machine to my bay, me by it
    const m = drv || myNearestMachine(14);
    if(m){ if(drv){ drv.driver = null; drv.throttle = 0; G.me.inMachine = null; if(!G.solo) NET.send('seat', { mid: drv.id, driver: null }); }
      m.x = G.bay.x; m.y = G.bay.y; m.a = 0; m.vx = m.vy = m.w = 0; m.z = 0; m.air = false; m.grace = 1.5; if(m.net){ m.net.x = m.x; m.net.y = m.y; m.net.a = 0; } }
    G.me.x = WORLD.spawn.x; G.me.y = WORLD.spawn.y; G.me.z = 0; G.cam.x = G.me.x; G.cam.y = G.me.y;
    G.lap.track = -1; G.lap.next = -1; if(!G.solo){ sendGuy(); sendBuilds(); } toast('→ PADDOCK'); return;
  }
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
    if(G.exhT <= 0){
      for(const [k, p] of m.parts){ const def = PARTS[p.type]; if(!(p.on > 0.05)) continue;
        if(def.engine && !def.engine.jet && m.fuel > 0){ const wp = cellWorld(m, k); const f = partFacing(m, p);
          puff(wp.x - f.x * 0.38, wp.y - f.y * 0.38, { vx: -fwdx * 1.5 + rnd(1), vy: -fwdy * 1.5 + rnd(1), r: 0.14, grow: 0.9, life: 0.5, color: m.boosting ? PAL.intake : 0xe8e4d8, alpha: 0.5, z: m.z }); }
        else if(def.thrust || (def.engine && def.engine.jet)){ const wp = cellWorld(m, k); const f = partFacing(m, p); const R = def.thrust ? 0.45 : 0.6;
          puff(wp.x - f.x * R, wp.y - f.y * R, { vx: -f.x * 9 * p.on + rnd(1.5), vy: -f.y * 9 * p.on + rnd(1.5), r: 0.12, grow: 1.6, life: 0.35, color: def.thrust && PARTS[p.type].thrust.batt ? 0xa8f0ff : PAL.jetGlow, alpha: 0.7, z: m.z }); }
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
  const ts = t / 1000;
  if(G.mode === 'menu' || !G.me){ menuScene(ts); return; }

  const drv = drivenMachine();
  if(drv){
    drv.throttle = (G.input.up ? 1 : 0) + (G.input.down ? -0.6 : 0);
    drv.steer = (G.input.left ? -1 : 0) + (G.input.right ? 1 : 0);
    drv.boosting = !!G.input.run;
  }
  // what every block is asked to do: the driver's keys + the logic wires
  for(const m of G.machines.values()){
    if(m.editing || m.remote || simOwner(m) !== myPid()) continue;
    buildAct(m, m === drv ? G.keys : null, G.machines.values());
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
    stepRopes(sdt, G.machines, m => !m.remote && !m.editing && simOwner(m) === myPid());
  }
  stepPunches();
  if(drv) stepMyGadgets(drv, dt);
  stepGadgets(dt, G.machines, m => !m.remote && !m.editing && simOwner(m) === myPid(), onFlat);
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
      drv.fuel = Math.min(drv.fuelMax, drv.fuel + 22 * dt); drv.batt = Math.min(drv.battMax, drv.batt + 22 * dt);
      if(restock(drv)) burst(drv.x, drv.y, 6, PAL.paper, 3, 0.08);
      if(drv.fuel > before) pitFlash(t);
    }
  }
  if(G.mode === 'build'){ buildHover(); const bm = G.machines.get(G.buildTarget); if(bm){ stepFlow(dt, bm); airStress(bm, dt, GARAGE.wind, false); } }
  // on the track your speed IS the wind: past the build's break point, parts start ripping off
  for(const m of G.machines.values()){ if(m.editing || m.remote || simOwner(m) !== myPid() || m.grace > 0) continue; const mph = Math.hypot(m.vx, m.vy) * 3.1; if(mph > 40) airStress(m, dt, mph, true); }

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
        const on = []; for(const [k, p] of m.parts) if(p.on > 0.05 && (PARTS[p.type].thrust || PARTS[p.type].horn || PARTS[p.type].brake || PARTS[p.type].rotor || PARTS[p.type].piston || (PARTS[p.type].engine && PARTS[p.type].engine.jet))) on.push([k, Math.round(p.on * 100) / 100]);
        const sa = m.segs.length > 1 ? m.segs.slice(1).map(s => Math.round(s.rel * 100) / 100) : undefined;
        NET.send('m', { mid: m.id, p: [m.x, m.y], a: m.a, v: [m.vx, m.vy], z: m.z, fuel: m.fuel | 0, batt: m.batt | 0, on, sa });
      }
    }
  }
}

/* the paddock drifting by behind the menu card */
function menuScene(ts){
  const mc = WORLD.menuCam;
  G.cam.x = mc.x + Math.sin(ts * 0.11) * 26; G.cam.y = mc.y + Math.cos(ts * 0.07) * 7;
  G.cam.zoom = G.H / (1.25 * 24);
  stepFX(0.016);
  render(ts);
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
  drawPuddles(ctx);
  drawDebris(ctx, z);
  drawRopes(ctx, G.machines);
  for(const m of G.machines.values()) drawMachine(ctx, m, z, ts, 1, { com: G.mode === 'build' && m.id === G.buildTarget, xray: G.mode === 'build' && m.id === G.buildTarget, name: plateName(m) });
  if(G.mode === 'build'){ const bm = G.machines.get(G.buildTarget); if(bm){ drawFlow(ctx); drawReadout(ctx, bm); } drawBuildOverlay(ctx, z); }
  for(const g of G.guys.values()) drawGuy(ctx, g, z, ts);
  if(G.me) drawGuy(ctx, G.me, z, ts);
  // carried parts float by the guy
  if(G.me && G.carried.length && !G.me.inMachine){ ctx.save(); ctx.translate(G.me.x, G.me.y - 0.9 - Math.sin(ts * 4) * 0.06); ctx.scale(0.7, 0.7); drawPart(ctx, G.carried[G.carried.length - 1].type, 0, z); ctx.restore(); }
  drawFX(ctx);
  drawClouds(ctx, myPid());
  drawCanopy(ctx, view, z);
}
function plateName(m){ return m.owner === myPid() ? (G.me ? G.me.name : '') : ((NET.peers.get(m.owner) || {}).name || ''); }

/* ---- hud ------------------------------------------------------------------ */
let lastPitFlash = 0;
function pitFlash(t){ lastPitFlash = t; }
function hud(drv, t){
  const sp = $('#speed'), fu = $('#fuelFill'), ba = $('#battFill'), lapEl = $('#lap');
  if(drv){
    sp.style.display = 'block';
    sp.textContent = Math.round(Math.hypot(drv.vx, drv.vy) * 3.1) + ' mph';
    $('#bars').style.display = 'flex';
    fu.style.width = (drv.fuelMax ? drv.fuel / drv.fuelMax * 100 : 0) + '%'; ba.style.width = (drv.battMax ? drv.batt / drv.battMax * 100 : 0) + '%';
    lapEl.style.display = G.lap.next > 0 ? 'block' : 'none';
    if(G.lap.next > 0) lapEl.textContent = (WORLD.tracks[G.lap.track] ? WORLD.tracks[G.lap.track].name + '  ' : '') + fmtMs(performance.now() - G.lap.t0) + (G.lap.best ? '  best ' + fmtMs(G.lap.best) : '');
    const pad = G.padT > 0 ? WORLD.pads.find(p => Math.hypot(drv.x - p.x, drv.y - p.y) < p.r) : null;
    const ammo = gadgetsOn() ? drv.gadgets.map(g => PARTS[g.p.type].label + ' ' + (g.kind === 'smoke' ? Math.ceil(g.p.ammo) + 's' : g.p.ammo)).join(' · ') : '';
    prompt(pad ? '→ ' + pad.name + ' …' : t - lastPitFlash < 400 ? 'PIT — refueling' :
      (drv.fuel <= 0 && drv.engines ? 'OUT OF FUEL — pit lane refuels' : (drv.blue && drv.parts.size < drv.blue.size ? 'Q repair · ' : '') + (drv.wheels.some(w => w.flat) ? 'FLAT · ' : '') + 'E hop out · Shift VROOM' + (ammo ? ' · ' + ammo : '')));
  } else {
    sp.style.display = 'none'; $('#bars').style.display = 'none'; lapEl.style.display = 'none';
    let p = '';
    if(G.mode === 'build') p = G.buildSel === 'panel' ? 'PANEL: click points (they snap to the grid) · click the first point to close · Backspace undo · Esc cancel · right-click: catalog'
      : G.cfg.isOpen && G.cfg.mode ? (G.cfg.mode === 'wheels' ? 'click the WHEELS this block works on (max 4) · Esc done' : 'click a block to wire into · Esc done')
      : 'right-click empty: catalog · right-click a block: configure · click add (middle = stack, edge = sideways) · X remove · R rotate · [ ] wind · B done';
    else {
      let nearSeat = false, nearDb = false;
      for(const m of G.machines.values()){ if(!m.seatKey || m.driver) continue; const s = cellWorld(m, m.seatKey); if(Math.hypot(s.x - G.me.x, s.y - G.me.y) < 2.6){ nearSeat = true; break; } }
      for(const db of G.debris.values()) if(Math.hypot(db.x - G.me.x, db.y - G.me.y) < 2.6){ nearDb = true; break; }
      let nearMine = false;
      if(G.carried.length) for(const m of G.machines.values()) if(m.owner === myPid() && Math.hypot(m.x - G.me.x, m.y - G.me.y) < 7){ nearMine = true; break; }
      const pad = G.padT > 0 ? WORLD.pads.find(pp => Math.hypot(G.me.x - pp.x, G.me.y - pp.y) < pp.r) : null;
      p = pad ? '→ ' + pad.name + ' …' : nearSeat ? 'E — hop in' : nearDb ? 'F — grab part'
        : nearMine ? 'F — bolt ' + G.carried.length + ' carried part' + (G.carried.length > 1 ? 's' : '') + ' on'
        : inGarage(G.me.x, G.me.y) ? 'B build · test drive the loop · pad → PADDOCK' : 'WASD walk · B build (→ garage)';
    }
    prompt(p);
  }
}
function prompt(s){ const el = $('#prompt'); if(el.textContent !== s) el.textContent = s; }
// no toasts — pure Trailmakers, the world shows what happened (Adam's ruling)
function toast(s){ console.log('[kRacing]', s); }
function renderPeers(){ $('#peers').textContent = [...NET.peers.values()].map(p => p.name).join(' · '); }

boot();
