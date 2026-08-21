/* =============================================================================
   guy.js — the little guy. Walks the world (faces the cursor; W toward it,
   S away, A/D strafe), hops into seats, gets yeeted when his seat shears off.
   Drawn as Adam's assets/guy.svg (top view) — or a round code-drawn dude.
   ============================================================================= */
import { PAL, shade, tint, hex } from './palette.js';
import { disc, box, art, shadow, rrect, blob } from './draw.js';

const WALK = 9, RUN = 14, GRAV = 26, JUMP = 9.5, R = 0.4;
export const GUY_SIZE = 1.1;

export function makeGuy(color = PAL.red, name = ''){
  return {
    name, color,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    yaw: 0, inMachine: null,          // machine id when seated
    flying: false, tumble: 0,         // true right after ejection (tumble!)
    net: null, remote: false,
    walkT: 0, moving: 0,
  };
}

export function stepGuy(g, world, input, dt, aim){
  if(g.inMachine) return;
  if(g.flying){
    g.vz -= GRAV * dt;
    g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
    g.tumble += dt * 9;
    const gz = world.h(g.x, g.y);
    if(g.z <= gz){ g.z = gz; g.flying = false; g.vx = g.vy = g.vz = 0; g.tumble = 0; }
    return;
  }
  let mx = 0, my = 0, mag = 0;
  const speed = input.run ? RUN : WALK;
  if(aim){
    const rx = -aim.y, ry = aim.x;                       // right of the aim
    if(input.up){ mx += aim.x; my += aim.y; }
    if(input.down){ mx -= aim.x; my -= aim.y; }
    if(input.right){ mx += rx; my += ry; }
    if(input.left){ mx -= rx; my -= ry; }
    g.yaw = Math.atan2(aim.x, -aim.y);                   // always face the cursor
  } else {
    if(input.up) my -= 1; if(input.down) my += 1;
    if(input.left) mx -= 1; if(input.right) mx += 1;
    if(mx || my) g.yaw = Math.atan2(mx, -my);
  }
  mag = Math.hypot(mx, my);
  if(mag > 0){ g.vx = mx / mag * speed; g.vy = my / mag * speed; g.walkT += dt * speed; }
  else { g.vx = 0; g.vy = 0; g.walkT *= 0.8; }
  g.moving += ((mag > 0 ? 1 : 0) - g.moving) * Math.min(1, dt * 10);

  const gz = world.h(g.x, g.y);
  const onGround = g.z <= gz + 0.02;
  if(input.jump && onGround) g.vz = JUMP;
  g.vz -= GRAV * dt;
  g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
  const gz2 = world.h(g.x, g.y);
  if(g.z < gz2){ g.z = gz2; g.vz = 0; }

  // wall pushout (circle)
  for(const wl of world.walls){
    if(g.z > wl.h) continue;
    const cx = Math.max(wl.x0, Math.min(wl.x1, g.x)), cy = Math.max(wl.y0, Math.min(wl.y1, g.y));
    const dx = g.x - cx, dy = g.y - cy, d2 = dx * dx + dy * dy;
    if(d2 < R * R && d2 > 1e-6){ const d = Math.sqrt(d2); g.x += dx / d * (R - d); g.y += dy / d * (R - d); }
  }
}

export function syncRemoteGuy(g, dt){
  if(!g.net) return;
  const k = Math.min(1, dt * 10);
  const dx = g.net.x - g.x, dy = g.net.y - g.y;
  g.x += dx * k; g.y += dy * k;
  let da = g.net.yaw - g.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); g.yaw += da * k;
  g.moving += ((Math.hypot(dx, dy) > 0.05 ? 1 : 0) - g.moving) * k;
  if(g.moving > 0.2) g.walkT += dt * WALK;
}

export function eject(g, x, y, z){
  g.inMachine = null; g.flying = true;
  g.x = x; g.y = y; g.z = z;
  g.vx = (Math.random() - 0.5) * 8; g.vy = (Math.random() - 0.5) * 8; g.vz = 12;
}

/* ---- drawing: Adam's sprite or the round dude -------------------------------------- */
export function drawGuy(ctx, g, zoom, t){
  if(g.inMachine) return;
  const S = GUY_SIZE;
  const k = Math.max(0.4, 1 - g.z * 0.08);
  shadow(ctx, g.x, g.y, S * 0.42 * (0.7 + 0.3 * k), S * 0.34 * (0.7 + 0.3 * k), 0.2 * k);
  ctx.save();
  ctx.translate(g.x, g.y - g.z * 0.5);
  ctx.rotate(g.yaw + (g.flying ? g.tumble : 0));
  const bob = Math.sin(g.walkT * 1.6) * 0.06 * g.moving;
  ctx.scale(1 + bob, 1 - bob);
  // your colour: a ring at your feet (the sprite is shared art)
  ctx.beginPath(); ctx.arc(0, 0.05, S * 0.5, 0, Math.PI * 2); ctx.lineWidth = 0.07; ctx.strokeStyle = hex(g.color); ctx.stroke();
  if(!art(ctx, 'guy', S, S, zoom)){
    const c = g.color;
    for(const sx of [-1, 1]) disc(ctx, sx * S * 0.36, S * 0.1 + Math.sin(g.walkT * 1.6 + (sx > 0 ? 0 : Math.PI)) * 0.08 * g.moving, S * 0.12, shade(c, .9), 0.03);   // hands
    ctx.beginPath(); ctx.ellipse(0, S * 0.06, S * 0.34, S * 0.28, 0, 0, Math.PI * 2); blob(ctx, c, 0.04);   // shoulders
    disc(ctx, 0, -S * 0.04, S * 0.22, PAL.skin, 0.035);                                                   // head
    ctx.beginPath(); ctx.arc(0, -S * 0.04, S * 0.22, Math.PI, 0); ctx.closePath(); blob(ctx, shade(c, .85), 0.035);   // cap
    disc(ctx, 0, -S * 0.2, S * 0.06, PAL.red, 0);                                                         // the lil bobble
  }
  ctx.restore();
}
