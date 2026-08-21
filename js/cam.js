/* =============================================================================
   cam.js — cameras. Top-down is the default (Adam's art view); C cycles
   top → chase → fps → free; remembered in localStorage.kr_cam.
   Build mode is ALWAYS the frozen top-down view (main.js handles that).
     chase: behind + above the driven machine (or the guy), yaw-only follow,
            Q = look left, Z = look right, both = look behind, wheel = distance
     fps:   from the seat (machine roll/pitch felt) or the guy's eyes
     free:  fly with WASD / Space / Shift, hold RIGHT mouse to look (pointer lock)
   FOV slider (chase/fps), screen shake and speed pull-back are toggles.
   ============================================================================= */
import * as THREE from 'three';

const MODES = ['top', 'chase', 'fps', 'free'];
export const CAM = {
  mode: 'top', fov: 75, shake: true, pullback: true, dist: 9, sens: 0.0025,
  look: 0,                        // -1 left, +1 right, 2 behind (held keys)
  orbit: { yaw: 0, pitch: 0.35 }, // mouse-look offset (chase: relative to the car; on foot: absolute yaw)
  fpsLook: { yaw: 0, pitch: 0 },  // mouse-look in the seat
  idle: 0,                        // seconds since the mouse last moved (chase recentres)
  camYaw: 0,                      // yaw to walk relative to (stepGuy's camYaw) in chase/fps
  free: { pos: new THREE.Vector3(0, 20, 60), yaw: 0, pitch: -0.6 },
  _kick: 0, _shakeT: 0,
  _pos: new THREE.Vector3(), _tgt: new THREE.Vector3(), _init: false,
};
try { const sv = JSON.parse(localStorage.getItem('kr_cam') || '{}'); for(const k of ['mode','fov','shake','pullback','dist','sens']) if(sv[k] !== undefined) CAM[k] = sv[k]; } catch(e){}
if(!MODES.includes(CAM.mode)) CAM.mode = 'top';

export function saveCam(){ localStorage.setItem('kr_cam', JSON.stringify({ mode: CAM.mode, fov: CAM.fov, shake: CAM.shake, pullback: CAM.pullback, dist: CAM.dist, sens: CAM.sens })); }
export function cycleCam(){ CAM.mode = MODES[(MODES.indexOf(CAM.mode) + 1) % MODES.length]; CAM._init = false; CAM.orbit.yaw = 0; CAM.orbit.pitch = 0.35; CAM.fpsLook.yaw = 0; CAM.fpsLook.pitch = 0; saveCam(); return CAM.mode; }
export function setCam(mode){ if(MODES.includes(mode)){ CAM.mode = mode; CAM._init = false; saveCam(); } }
export function camLabel(){ return 'CAM · ' + CAM.mode.toUpperCase(); }
export function kick(J){ if(CAM.shake) CAM._kick = Math.min(1, CAM._kick + J / 120); }

const _f = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _o = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _look = new THREE.Vector3();

/* ctx: { camera, dt, mode (game mode), drv (machine|null), guy, focus (top-down focus), H (top-down height),
         seatPos (world Vector3|null), input, mouseDelta {x,y}, pointerLocked, WORLD } */
export function updateCam(ctx){
  const { camera, dt } = ctx;
  const mode = ctx.mode === 'build' ? 'top' : CAM.mode;
  const wantFov = mode === 'top' ? 64 : CAM.fov;
  if(camera.fov !== wantFov){ camera.fov = wantFov; camera.updateProjectionMatrix(); }
  let reach = 20, focus = ctx.focus;

  if(mode === 'top'){
    camera.up.set(0, 0, -1);
    const H = ctx.H;
    camera.position.set(focus.x, focus.y + H, focus.z);
    camera.lookAt(focus.x, focus.y, focus.z);
    reach = 1.3 * H + 8;
  } else if(mode === 'chase'){
    camera.up.set(0, 1, 0);
    const m = ctx.drv;
    const md = ctx.mouseDelta;
    const moved = ctx.pointerLocked && md && (md.x || md.y);
    if(moved){ CAM.orbit.yaw -= md.x * CAM.sens; CAM.orbit.pitch = THREE.MathUtils.clamp(CAM.orbit.pitch + md.y * CAM.sens, -0.15, 1.25); CAM.idle = 0; }
    else CAM.idle += dt;
    let baseYaw, tgt;
    if(m){
      _f.set(0, 0, 1).applyQuaternion(m.quat); baseYaw = Math.atan2(_f.x, _f.z); tgt = m.pos;
      // driving: after a moment without mouse input the view settles back behind the car
      if(CAM.idle > 1.2 && m.vel.lengthSq() > 4){ const k = Math.min(1, dt * 2.5); CAM.orbit.yaw += (Math.atan2(Math.sin(-CAM.orbit.yaw), Math.cos(-CAM.orbit.yaw))) * k; CAM.orbit.pitch += (0.35 - CAM.orbit.pitch) * k; }
      if(!CAM._init) CAM.orbit.yaw = 0;
    } else { baseYaw = 0; tgt = ctx.guy.pos; if(!CAM._init) CAM.orbit.yaw = ctx.guy.yaw + Math.PI; }   // on foot: absolute orbit (3rd-person controller)
    const lookYaw = CAM.look === 2 ? Math.PI : CAM.look * Math.PI / 2;
    const a = baseYaw + CAM.orbit.yaw + lookYaw, p = CAM.orbit.pitch;
    const d = CAM.dist * (m ? 1 : 0.6);
    const cp = Math.cos(p), sp = Math.sin(p);
    _o.set(-Math.sin(a) * d * cp, d * sp + (m ? 0.6 : 1.2), -Math.cos(a) * d * cp).add(tgt);
    if(!CAM._init){ CAM._pos.copy(_o); CAM._tgt.copy(tgt); CAM._init = true; }
    CAM._pos.lerp(_o, Math.min(1, dt * (moved ? 40 : 16)));
    CAM._tgt.lerp(tgt, Math.min(1, dt * 24));
    camera.position.copy(CAM._pos);
    _look.set(Math.sin(a) * 1.5, m ? 0.8 : 1.2, Math.cos(a) * 1.5).add(CAM._tgt);
    camera.lookAt(_look);
    CAM.camYaw = a - Math.PI;                               // stepGuy: W walks where the camera looks
    focus = CAM._tgt; reach = d * 2.2 + 12;
  } else if(mode === 'fps'){
    camera.up.set(0, 1, 0);
    const m = ctx.drv;
    const md = ctx.mouseDelta;
    const moved = ctx.pointerLocked && md && (md.x || md.y);
    if(moved){ CAM.fpsLook.yaw -= md.x * CAM.sens; CAM.fpsLook.pitch = THREE.MathUtils.clamp(CAM.fpsLook.pitch - md.y * CAM.sens, -1.4, 1.4); CAM.idle = 0; }
    else CAM.idle += dt;
    const lookYaw = (CAM.look === 2 ? Math.PI : CAM.look * Math.PI / 2);
    if(m && ctx.seatPos){
      // in the seat: mouse looks around, settles forward again after a moment while moving
      if(CAM.idle > 1.5 && m.vel.lengthSq() > 4){ const k = Math.min(1, dt * 2.5); CAM.fpsLook.yaw += Math.atan2(Math.sin(-CAM.fpsLook.yaw), Math.cos(-CAM.fpsLook.yaw)) * k; CAM.fpsLook.pitch *= 1 - k; }
      camera.position.copy(ctx.seatPos).add(_o.set(0, 0.9, 0).applyQuaternion(m.quat));
      _e.set(CAM.fpsLook.pitch, Math.PI + CAM.fpsLook.yaw - lookYaw, 0, 'YXZ');
      _q.setFromEuler(_e);
      camera.quaternion.copy(m.quat).multiply(_q);
      focus = m.pos; reach = 30;
    } else {
      // on foot: a plain FPS controller — mouse turns the guy, WASD walks relative to the view
      const g = ctx.guy;
      if(!CAM._init){ CAM.fpsLook.yaw = g.yaw + Math.PI; CAM.fpsLook.pitch = 0; CAM._init = true; }
      camera.position.set(g.pos.x, g.pos.y + 1.3, g.pos.z);
      _e.set(CAM.fpsLook.pitch, CAM.fpsLook.yaw - lookYaw, 0, 'YXZ');
      camera.quaternion.setFromEuler(_e);
      CAM.camYaw = CAM.fpsLook.yaw;                          // camera forward = -z rotated by yaw
      focus = g.pos; reach = 30;
    }
  } else { // free
    camera.up.set(0, 1, 0);
    const F = CAM.free;
    if(ctx.pointerLocked && ctx.mouseDelta){ F.yaw -= ctx.mouseDelta.x * 0.0025; F.pitch = THREE.MathUtils.clamp(F.pitch - ctx.mouseDelta.y * 0.0025, -1.5, 1.5); }
    _e.set(F.pitch, F.yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(_e);
    const sp = (ctx.input.run ? 60 : 20) * dt;
    _f.set(0, 0, -1).applyQuaternion(camera.quaternion);
    _o.set(1, 0, 0).applyQuaternion(camera.quaternion);
    if(ctx.input.up) F.pos.addScaledVector(_f, sp);
    if(ctx.input.down) F.pos.addScaledVector(_f, -sp);
    if(ctx.input.right) F.pos.addScaledVector(_o, sp);
    if(ctx.input.left) F.pos.addScaledVector(_o, -sp);
    if(ctx.input.jump) F.pos.y += sp;
    if(ctx.input.crouch) F.pos.y -= sp;
    const gy = ctx.WORLD ? ctx.WORLD.h(F.pos.x, F.pos.z) + 0.5 : 0.5;
    if(F.pos.y < gy) F.pos.y = gy;
    camera.position.copy(F.pos);
    focus = F.pos; reach = 40;
  }
  // screen shake (impacts, toggle)
  if(CAM._kick > 0.001){
    CAM._shakeT += dt * 40;
    const k = CAM._kick * 0.35;
    camera.position.x += Math.sin(CAM._shakeT * 1.7) * k;
    camera.position.y += Math.cos(CAM._shakeT * 2.3) * k * 0.6;
    camera.position.z += Math.sin(CAM._shakeT * 1.3 + 1) * k;
    CAM._kick *= Math.max(0, 1 - dt * 5);
  }
  return { focus, reach, mode };
}
