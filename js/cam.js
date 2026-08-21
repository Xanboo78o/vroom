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
  mode: 'top', fov: 75, shake: true, pullback: true, dist: 9,
  look: 0,                        // -1 left, +1 right, 2 behind (held keys)
  free: { pos: new THREE.Vector3(0, 20, 60), yaw: 0, pitch: -0.6 },
  _kick: 0, _shakeT: 0,
  _pos: new THREE.Vector3(), _tgt: new THREE.Vector3(), _init: false,
};
try { Object.assign(CAM, JSON.parse(localStorage.getItem('kr_cam') || '{}'), { free: CAM.free, _pos: CAM._pos, _tgt: CAM._tgt }); } catch(e){}
if(!MODES.includes(CAM.mode)) CAM.mode = 'top';

export function saveCam(){ localStorage.setItem('kr_cam', JSON.stringify({ mode: CAM.mode, fov: CAM.fov, shake: CAM.shake, pullback: CAM.pullback, dist: CAM.dist })); }
export function cycleCam(){ CAM.mode = MODES[(MODES.indexOf(CAM.mode) + 1) % MODES.length]; CAM._init = false; saveCam(); return CAM.mode; }
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
    let yaw, tgt;
    if(m){ _f.set(0, 0, 1).applyQuaternion(m.quat); yaw = Math.atan2(_f.x, _f.z); tgt = m.pos; }
    else { yaw = ctx.guy.yaw + Math.PI; tgt = ctx.guy.pos; }
    const lookYaw = CAM.look === 2 ? Math.PI : CAM.look * Math.PI / 2;
    const a = yaw + lookYaw;
    const d = CAM.dist;
    _o.set(-Math.sin(a) * d, d * 0.5 + 0.6, -Math.cos(a) * d).add(tgt);
    if(!CAM._init){ CAM._pos.copy(_o); CAM._tgt.copy(tgt); CAM._init = true; }
    CAM._pos.lerp(_o, Math.min(1, dt * 6));
    CAM._tgt.lerp(tgt, Math.min(1, dt * 10));
    camera.position.copy(CAM._pos);
    _look.set(Math.sin(a) * 2, 0.8, Math.cos(a) * 2).add(CAM._tgt);
    camera.lookAt(_look);
    focus = CAM._tgt; reach = d * 2.2 + 12;
  } else if(mode === 'fps'){
    camera.up.set(0, 1, 0);
    const m = ctx.drv;
    const lookYaw = CAM.look === 2 ? Math.PI : CAM.look * Math.PI / 2;
    if(m && ctx.seatPos){
      camera.position.copy(ctx.seatPos).add(_o.set(0, 0.9, 0).applyQuaternion(m.quat));
      _q.setFromAxisAngle(_up, Math.PI - lookYaw);          // camera looks down -z, machine forward is +z
      camera.quaternion.copy(m.quat).multiply(_q);
      focus = m.pos; reach = 30;
    } else {
      const g = ctx.guy;
      camera.position.set(g.pos.x, g.pos.y + 1.3, g.pos.z);
      const a = g.yaw + Math.PI - lookYaw;                   // guy faces -(sin yaw, cos yaw)
      _e.set(0, a, 0, 'YXZ');
      camera.quaternion.setFromEuler(_e);
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
