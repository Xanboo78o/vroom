/* =============================================================================
   logic.js — what every block is being ASKED to do this frame (m.act).
   Two sources, merged: the driver's keys (each block's bind; engines/motors have
   FWD/REV) and the WIRES: a sensor carries its own threshold (speed > 60 …) and
   wires straight into blocks with an amount ("brakes at 100 %"); AND/OR/NOT/NOR
   sit in between. "speed > 60 → brake 100 %" = a pit limiter. Adam's spec.
   ============================================================================= */
import { PARTS } from './parts.js';
import { cfgOf } from './machine.js';

export function buildAct(m, keys, machines){
  const A = m.act; A.clear();
  // 1) keys
  if(keys) for(const [k, p] of m.parts){
    const def = PARTS[p.type]; const c = cfgOf(p);
    if(def.engine || def.motor){ if(keys.has(c.fwd)) A.set(k, 1); else if(keys.has(c.rev)) A.set(k, -0.6); continue; }
    if(c.bind && keys.has(c.bind)) A.set(k, 1);
  }
  if(!m.sensors.length && !m.gates.length) return A;
  // 2) sensors → signals
  const sig = new Map();
  const speed = Math.hypot(m.vx, m.vy) * 3.1;   // mph, same as the HUD
  for(const s of m.sensors){
    const c = cfgOf(s.p); let v = 0;
    if(s.kind === 'speed') v = c.op === '<' ? (speed < c.thr ? 1 : 0) : (speed > c.thr ? 1 : 0);
    else if(s.kind === 'prox'){
      let d = 1e9; for(const o of machines){ if(o === m || !o.parts.size) continue; const dd = Math.hypot(o.x - m.x, o.y - m.y) - o.radius - m.radius; if(dd < d) d = dd; }
      v = c.op === '>' ? (d > c.thr ? 1 : 0) : (d < c.thr ? 1 : 0);
    }
    sig.set(s.k, v); s.p.sig = v;
  }
  // 3) gates: inputs = every wire pointing at them (a few passes so chains settle)
  const inputsOf = new Map();
  for(const [k, p] of m.parts){ const c = cfgOf(p); for(const o of c.out){ const t = m.parts.get(o.k); if(t && PARTS[t.type].gate){ if(!inputsOf.has(o.k)) inputsOf.set(o.k, []); inputsOf.get(o.k).push(k); } } }
  for(const g of m.gates) sig.set(g.k, 0);
  for(let pass = 0; pass < 4; pass++) for(const g of m.gates){
    const ins = (inputsOf.get(g.k) || []).map(k => sig.get(k) || 0);
    let v = 0;
    if(g.kind === 'and') v = ins.length && ins.every(x => x >= .5) ? 1 : 0;
    else if(g.kind === 'or') v = ins.some(x => x >= .5) ? 1 : 0;
    else if(g.kind === 'not') v = ins.length && ins[0] < .5 ? 1 : 0;          // NOT with nothing wired stays off
    else if(g.kind === 'nor') v = ins.length && !ins.some(x => x >= .5) ? 1 : 0;
    sig.set(g.k, v); g.p.sig = v;
  }
  // 4) live wires → their targets, with the amount on the wire
  for(const [k, p] of m.parts){
    const v = sig.get(k); if(!v) continue;
    for(const o of cfgOf(p).out){
      const t = m.parts.get(o.k); if(!t || PARTS[t.type].gate) continue;
      const amt = o.amt == null ? 1 : o.amt; const cur = A.get(o.k) || 0;
      A.set(o.k, Math.max(cur, amt));
    }
  }
  return A;
}
