/* =============================================================================
   cfgpanel.js — RIGHT-CLICK a placed block in the garage → its little config
   card (Adam: "configure their inputs too, just by right-clicking them").
   Binds (press a key), FWD/REV for engines, harshness/speed, which WHEELS a
   brake or engine works on (click the wheels on your build, max 4), sensor
   threshold + direction, OUTPUT wires (click a block, set the amount), text,
   paint. Right-click on EMPTY space still opens the parts ring.
   ============================================================================= */
import { PARTS, isDrivable } from './parts.js';
import { cfgOf } from './machine.js';
import { PAL, hex } from './palette.js';

export const SWATCHES = [0xf5d2a6, 0xef4b42, 0xff6f2e, 0xffcf3d, 0x7fc855, 0x2fcfa1, 0x3d9de6, 0x9b6fe0, 0xf98fb8, 0xfffdf6, 0x8892a0, 0x2f343c];
export const keyName = code => !code ? '—' : code.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'SHIFT').replace('ShiftRight', 'R-SHIFT').replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('ArrowLeft', '←').replace('ArrowRight', '→').replace('ControlLeft', 'CTRL').replace('Space', 'SPACE').toUpperCase();

export function makeCfgPanel({ onChange, onDelete, partName }){
  const root = document.getElementById('cfg');
  const S = { m: null, k: null, mode: null, wait: null };
  const $ = s => root.querySelector(s);
  const cfg = () => { const p = S.m.parts.get(S.k); if(!p.cfg) p.cfg = {}; return p.cfg; };
  const part = () => S.m && S.m.parts.get(S.k);

  function open(m, k){ S.m = m; S.k = k; S.mode = null; S.wait = null; root.classList.remove('hide'); render(); }
  function close(){ S.m = null; S.k = null; S.mode = null; S.wait = null; root.classList.add('hide'); }
  function changed(){ if(onChange) onChange(S.m, S.k); render(); }

  function render(){
    const p = part(); if(!p){ close(); return; }
    const def = PARTS[p.type], c = cfgOf(p);
    let h = `<div class="cfgHead"><b>${def.label}</b><button class="x" data-act="close">×</button></div>`;
    if(def.tip) h += `<div class="tip">${def.tip}</div>`;
    const keyBtn = (field, label) => `<div class="row"><span>${label}</span><button class="key ${S.wait === field ? 'wait' : ''}" data-act="key" data-f="${field}">${S.wait === field ? 'press a key…' : keyName(c[field])}</button></div>`;
    if(def.engine || def.motor){ h += keyBtn('fwd', 'FORWARD'); h += keyBtn('rev', 'REVERSE'); }
    else if(def.bind || def.brake) h += keyBtn('bind', 'KEY');
    if(def.brake) h += slider('HARSHNESS', 'amount', Math.round(c.amount * 100), 10, 100, '%');
    if(def.rotor) h += slider('SPEED', 'amount', Math.round(c.amount * 100), 20, 100, '%');
    if(def.engine && !def.engine.jet || def.motor || def.brake) h += wheelsUI(c);
    if(def.horn) h += `<div class="row"><span>CLIP</span><select data-act="clip">${['honk', 'meep', 'airhorn', 'duck'].map(x => `<option ${c.clip === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>`;
    if(def.sensor){
      h += `<div class="row"><span>FIRES WHEN</span><button class="key" data-act="op">${def.sensor === 'speed' ? 'speed' : 'distance'} ${c.op}</button><input type="number" data-act="thr" value="${c.thr}" step="${def.sensor === 'speed' ? 5 : 1}" min="0"> <i>${def.sensor === 'speed' ? 'mph' : 'u'}</i></div>`;
      h += `<div class="state ${p.sig ? 'on' : ''}">${p.sig ? '● ON' : '○ off'}</div>`;
    }
    if(def.gate){
      const ins = []; for(const [k2, p2] of S.m.parts) for(const o of cfgOf(p2).out) if(o.k === S.k) ins.push(PARTS[p2.type].label);
      h += `<div class="row"><span>INPUTS</span><span class="muted">${ins.length ? ins.join(', ') : 'none wired in yet'}</span></div>`;
      h += `<div class="state ${p.sig ? 'on' : ''}">${p.sig ? '● ON' : '○ off'}</div>`;
    }
    if(def.sensor || def.gate) h += outsUI(c);
    if(def.text) h += `<div class="row"><span>TEXT</span><input type="text" maxlength="8" data-act="text" value="${(c.text || '').replace(/"/g, '&quot;')}" placeholder="${partName ? partName() : ''}"></div>`;
    if(def.panel || def.paint) h += `<div class="row"><span>PAINT</span><span class="sw">${SWATCHES.map(x => `<i data-act="color" data-c="${x}" style="background:${hex(x)}" class="${c.color === x ? 'on' : ''}"></i>`).join('')}</span></div>`;
    h += `<div class="row end"><button class="del" data-act="del">remove</button><span class="muted">Esc closes</span></div>`;
    root.innerHTML = h;
  }
  const slider = (label, field, val, min, max, unit) => `<div class="row"><span>${label}</span><input type="range" data-act="slider" data-f="${field}" min="${min}" max="${max}" value="${val}"><b data-val="${field}">${val}${unit}</b></div>`;
  function wheelsUI(c){
    const wl = c.wheels && c.wheels.length ? c.wheels.filter(k => S.m.parts.has(k)) : [];
    const names = wl.map(k => { const p = S.m.parts.get(k); return PARTS[p.type].label; });
    return `<div class="row"><span>WHEELS</span><span>${wl.length ? names.join(' · ') : 'ALL'}</span></div>
      <div class="row"><button class="${S.mode === 'wheels' ? 'on' : ''}" data-act="wheels">${S.mode === 'wheels' ? 'click wheels on your build… (done)' : 'pick wheels (max 4)'}</button>${wl.length ? '<button data-act="allwheels">all</button>' : ''}</div>`;
  }
  function outsUI(c){
    let h = `<div class="row"><span>OUTPUT →</span><button class="${S.mode === 'wire' ? 'on' : ''}" data-act="wire">${S.mode === 'wire' ? 'click a block… (done)' : '+ wire to a block'}</button></div>`;
    c.out.forEach((o, i) => { const t = S.m.parts.get(o.k); if(!t) return; const td = PARTS[t.type]; const amt = Math.round((o.amt == null ? 1 : o.amt) * 100);
      h += `<div class="row out"><span>→ ${td.label}</span>${td.gate ? '' : `<input type="range" data-act="amt" data-i="${i}" min="0" max="100" value="${amt}"><b>${amt}%</b>`}<button class="x" data-act="unwire" data-i="${i}">×</button></div>`; });
    return h;
  }

  root.addEventListener('mousedown', e => e.stopPropagation());
  root.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); });
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if(!b || !part()) return;
    const act = b.dataset.act;
    if(act === 'close') close();
    else if(act === 'key'){ S.wait = b.dataset.f; render(); }
    else if(act === 'wheels'){ S.mode = S.mode === 'wheels' ? null : 'wheels'; render(); }
    else if(act === 'allwheels'){ delete cfg().wheels; changed(); }
    else if(act === 'wire'){ S.mode = S.mode === 'wire' ? null : 'wire'; render(); }
    else if(act === 'unwire'){ const c = cfg(); c.out = (c.out || []).filter((_, i) => i !== +b.dataset.i); changed(); }
    else if(act === 'op'){ const c = cfg(); c.op = cfgOf(part()).op === '>' ? '<' : '>'; changed(); }
    else if(act === 'color'){ cfg().color = +b.dataset.c; changed(); }
    else if(act === 'del'){ const k = S.k; close(); if(onDelete) onDelete(k); }
  });
  root.addEventListener('input', e => {
    const b = e.target.closest('[data-act]'); if(!b || !part()) return;
    const act = b.dataset.act, c = cfg();
    if(act === 'slider'){ c[b.dataset.f] = +b.value / 100; const v = root.querySelector(`[data-val="${b.dataset.f}"]`); if(v) v.textContent = b.value + '%'; if(onChange) onChange(S.m, S.k); }
    else if(act === 'amt'){ c.out[+b.dataset.i].amt = +b.value / 100; b.nextElementSibling.textContent = b.value + '%'; if(onChange) onChange(S.m, S.k); }
    else if(act === 'thr'){ c.thr = +b.value || 0; if(onChange) onChange(S.m, S.k); }
    else if(act === 'text'){ c.text = b.value; if(onChange) onChange(S.m, S.k); }
  });
  root.addEventListener('change', e => { const b = e.target.closest('[data-act]'); if(!b || !part()) return; if(b.dataset.act === 'clip'){ cfg().clip = b.value; if(onChange) onChange(S.m, S.k); } });

  /* main.js forwards keydowns here first; true = consumed */
  function onKey(e){
    if(!S.m) return false;
    if(S.wait){ if(e.code === 'Escape'){ S.wait = null; render(); return true; } cfg()[S.wait] = e.code; S.wait = null; changed(); return true; }
    if(e.code === 'Escape'){ if(S.mode){ S.mode = null; render(); } else close(); return true; }
    return false;
  }
  /* a block on the build got clicked while the card is open; true = consumed */
  function clickPart(k2){
    const p = part(); if(!p || !S.mode) return false;
    const t = S.m.parts.get(k2); if(!t) return false;
    const td = PARTS[t.type], c = cfg();
    if(S.mode === 'wheels'){
      if(!td.wheel) return true;
      c.wheels = c.wheels || [];
      const i = c.wheels.indexOf(k2);
      if(i >= 0) c.wheels.splice(i, 1); else if(c.wheels.length < 4) c.wheels.push(k2);
      if(!c.wheels.length) delete c.wheels;
      changed(); return true;
    }
    if(S.mode === 'wire'){
      if(k2 === S.k || !(isDrivable(td) || td.gate)) return true;
      c.out = c.out || [];
      if(!c.out.some(o => o.k === k2)) c.out.push({ k: k2, amt: 1 });
      changed(); return true;
    }
    return false;
  }
  return { open, close, render, onKey, clickPart, get isOpen(){ return !!S.m; }, get key(){ return S.k; }, get mode(){ return S.mode; }, get machine(){ return S.m; } };
}
