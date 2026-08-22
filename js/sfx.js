/* sfx.js — tiny synthesized sounds (no assets): horns, squeaks, thuds. Audio wakes on the first key. */
let AC = null;
function ac(){ if(!AC){ try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ AC = null; } } if(AC && AC.state === 'suspended') AC.resume().catch(() => {}); return AC; }
export function wakeAudio(){ ac(); }
function tone(c, type, f0, f1, t0, dur, vol, shape = 'lin'){
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0);
  if(f1 !== f0) o.frequency[shape === 'exp' ? 'exponentialRampToValueAtTime' : 'linearRampToValueAtTime'](f1, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015); g.gain.setValueAtTime(vol, t0 + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
export function honk(kind = 'honk', vol = 0.22){
  const c = ac(); if(!c) return; const t = c.currentTime;
  if(kind === 'meep'){ tone(c, 'square', 880, 880, t, 0.11, vol); tone(c, 'square', 880, 880, t + 0.15, 0.11, vol); return; }
  if(kind === 'airhorn'){ for(const f of [233, 277, 349]) tone(c, 'sawtooth', f, f * 1.01, t, 0.9, vol * 0.5); return; }
  if(kind === 'duck'){ tone(c, 'triangle', 640, 470, t, 0.18, vol, 'exp'); tone(c, 'triangle', 600, 440, t + 0.22, 0.16, vol * 0.8, 'exp'); return; }
  tone(c, 'sawtooth', 330, 330, t, 0.35, vol * 0.6); tone(c, 'sawtooth', 415, 415, t, 0.35, vol * 0.6);
}
export function squeak(vol = 0.15){ const c = ac(); if(!c) return; tone(c, 'sine', 1400, 900, c.currentTime, 0.12, vol, 'exp'); }
export function thud(vol = 0.2){ const c = ac(); if(!c) return; tone(c, 'triangle', 120, 50, c.currentTime, 0.16, vol, 'exp'); }
