/* =============================================================================
   guy.js — the little guy. Walks the world, hops into seats, gets yeeted
   when his seat shears off. Flat-vector two-tone dude.
   ============================================================================= */
import * as THREE from 'three';
import { vbox, vcyl, shade, mat } from './parts.js';
import { artTex } from './art.js';

const WALK = 9, RUN = 14, G = 26, JUMP = 9.5;

export function makeGuy(color = 0xe8574f, name = ''){
  const g = {
    name, color,
    pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    yaw: 0, inMachine: null,          // machine id when seated
    flying: false,                    // true right after ejection (tumble!)
    group: buildGuyMesh(color),
    netP: null, netYaw: 0, remote: false,
    walkT: 0,
  };
  return g;
}

export function buildGuyMesh(color){
  const g = new THREE.Group();
  fillGuyMesh(g, color);
  return g;
}

// (re)build the guy's look in place — SVG sprite if Adam drew one, blocks if not
export function fillGuyMesh(g, color){
  while(g.children.length) g.remove(g.children[0]);
  const tex = artTex('guy');
  if(tex){
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.8),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    quad.rotation.x = -Math.PI / 2;
    quad.position.y = 0.5;                 // floats a touch: reads over machines
    g.add(quad);
    return;
  }
  const body = vbox(0.42, 0.55, 0.3, color); body.position.y = 0.62; body.name = 'body'; g.add(body);
  const head = vbox(0.34, 0.3, 0.3, 0xf2d1a8); head.position.y = 1.06; g.add(head);
  const cap = vbox(0.38, 0.12, 0.34, shade(color, 0.85)); cap.position.y = 1.24; g.add(cap);
  const legL = vbox(0.16, 0.36, 0.2, 0x4a5560); legL.position.set(-0.11, 0.18, 0); legL.name = 'legL'; g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.11; legR.name = 'legR'; g.add(legR);
  const armL = vbox(0.12, 0.4, 0.16, shade(color, 0.88)); armL.position.set(-0.29, 0.68, 0); armL.name = 'armL'; g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.29; armR.name = 'armR'; g.add(armR);
}

export function stepGuy(g, world, input, camYaw, dt, aim){
  if(g.inMachine){ g.group.visible = false; return; }
  g.group.visible = true;

  if(g.flying){
    g.vel.y -= G * dt;
    g.pos.addScaledVector(g.vel, dt);
    g.group.rotation.x += dt * 9;      // TUMBLE
    const gy = world.h(g.pos.x, g.pos.z);
    if(g.pos.y <= gy){ g.pos.y = gy; g.flying = false; g.vel.set(0, 0, 0); g.group.rotation.x = 0; }
  } else {
    let mx = 0, mz = 0, mag = 0;
    const speed = input.run ? RUN : WALK;
    if(aim){
      // mouse-aimed: W = toward the cursor, S = away, A/D = strafe around it
      const rx = -aim.z, rz = aim.x;
      if(input.up){ mx += aim.x; mz += aim.z; }
      if(input.down){ mx -= aim.x; mz -= aim.z; }
      if(input.right){ mx += rx; mz += rz; }
      if(input.left){ mx -= rx; mz -= rz; }
      mag = Math.hypot(mx, mz);
      if(mag > 0){
        g.vel.x = mx / mag * speed; g.vel.z = mz / mag * speed;
        g.walkT += dt * speed;
      } else { g.vel.x = 0; g.vel.z = 0; g.walkT *= 0.8; }
      g.yaw = Math.atan2(aim.x, aim.z) + Math.PI;   // always face the cursor
      mag = Math.min(1, mag);
    } else {
      if(input.up) mz -= 1; if(input.down) mz += 1;
      if(input.left) mx -= 1; if(input.right) mx += 1;
      mag = Math.hypot(mx, mz);
      if(mag > 0){
        const a = Math.atan2(mx, mz) + camYaw;
        g.vel.x = Math.sin(a) * speed; g.vel.z = Math.cos(a) * speed;
        g.yaw = a + Math.PI;
        g.walkT += dt * speed;
      } else { g.vel.x = 0; g.vel.z = 0; g.walkT *= 0.8; }
    }

    const gy = world.h(g.pos.x, g.pos.z);
    const onGround = g.pos.y <= gy + 0.02;
    if(input.jump && onGround) g.vel.y = JUMP;
    g.vel.y -= G * dt;
    g.pos.addScaledVector(g.vel, dt);
    if(g.pos.y < world.h(g.pos.x, g.pos.z)){ g.pos.y = world.h(g.pos.x, g.pos.z); g.vel.y = 0; }

    // wall pushout (circle r=0.4)
    for(const wl of world.walls){
      const cx = THREE.MathUtils.clamp(g.pos.x, wl.min.x, wl.max.x);
      const cz = THREE.MathUtils.clamp(g.pos.z, wl.min.z, wl.max.z);
      if(g.pos.y > wl.max.y) continue;
      const dx = g.pos.x - cx, dz = g.pos.z - cz, d2 = dx * dx + dz * dz;
      if(d2 < 0.16 && d2 > 1e-6){
        const d = Math.sqrt(d2); g.pos.x += dx / d * (0.4 - d); g.pos.z += dz / d * (0.4 - d);
      }
    }
    // waddle
    const sw = Math.sin(g.walkT * 1.6) * 0.5 * Math.min(1, mag);
    for(const nm of ['legL', 'armR']){ const o = g.group.getObjectByName(nm); if(o) o.rotation.x = sw; }
    for(const nm of ['legR', 'armL']){ const o = g.group.getObjectByName(nm); if(o) o.rotation.x = -sw; }
  }

  g.group.position.copy(g.pos);
  g.group.rotation.y = g.yaw;
}

export function syncRemoteGuy(g, dt){
  if(!g.netP) return;
  g.pos.lerp(g.netP, Math.min(1, dt * 10));
  g.yaw += (g.netYaw - g.yaw) * Math.min(1, dt * 10);
  g.group.position.copy(g.pos);
  g.group.rotation.y = g.yaw;
  g.group.visible = !g.inMachine;
}

export function eject(g, fromPos){
  g.inMachine = null;
  g.flying = true;
  g.pos.copy(fromPos);
  g.vel.set((Math.random() - 0.5) * 8, 12, (Math.random() - 0.5) * 8);
}
