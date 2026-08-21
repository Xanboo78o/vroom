/* =============================================================================
   palette.js — kRacing's ONE source of truth for colour.
   Every hex the game uses lives here (3D + UI). CSS reads them as --k-* vars
   (injected at load, style.css keeps fallbacks). Flat fills, darker-shade edges,
   never black — that's the rule. Adam and I tune THIS file, nothing else.
   ============================================================================= */
export const PAL = {
  // ---- UI ----
  cream: 0xf6f1e3, border: 0xd8d2bf, paper: 0xfffdf6, panel: 0xeee8d5, panelBorder: 0xddd6c1,
  red: 0xe8574f, redDark: 0xc43f38, blue: 0x5aa7e0, blueDark: 0x3f83b8,
  text: 0x55503f, mute: 0x8b8677, sky: 0xbfe3f2, cardShadow: 0xa9c9d6,
  dim: 0xe9e3d2, dimBorder: 0xd0c9b4, fuel: 0xb9c94e, batt: 0x46c2a5,
  // ---- world ----
  grass: 0x9ec96f, grassDark: 0x92bd63, shoulder: 0x7f8894, asphalt: 0x555e69, dash: 0xe8e4d8,
  checker: 0xf2efe6, pitLane: 0x6b7480, pad: 0xe0c23e, padDot: 0xb89f2c, pitWall: 0xd0d6dd,
  plaza: 0xc9bfa8, ramp: 0xd8935a, rampSkirt: 0xc07c44, chevron: 0xeadcc4, cone: 0xe8804f,
  wall: 0xd9a0a0, block: 0xc9a44a, kerbRed: 0xe8574f, kerbCream: 0xf2efe6, stone: 0xb9b3a6, plinth: 0x9a948a,
  // ---- parts ----
  frame: 0xaab4c0, wheel: 0x4a4f57, hub: 0xd8b13c, seat: 0xe8574f, engine: 0xe69a3c, engineDark: 0xc57d22,
  tank: 0xb9c94e, tankDark: 0x94a33a, intake: 0x5aa7e0, intakeDark: 0x3f83b8, battery: 0x46c2a5,
  batteryDark: 0x2f9c82, motor: 0x9b6fd6, motorDark: 0x7d51b8, fan: 0x6fd6d0, fanDark: 0x4db3ad,
  wing: 0xeef1f4, wingDark: 0xc9ced4, skin: 0xf2d1a8, legs: 0x4a5560, ink: 0x55503f,
  // ---- critters ----
  duck: 0xf4efe0, beak: 0xf0902e, leather: 0x8a5a3c, raccoon: 0x8d8f96, mask: 0x4a4f57,
  armadillo: 0xb08d5e, armadilloDark: 0x8f6f46, otter: 0x6b4b32, otterBelly: 0xc9a57a,
  coral: 0xf08a8a, coral2: 0xf4a261, plow: 0x5aa7e0, blade: 0xe8804f, beacon: 0xf2c14e,
  hoodie: 0x5aa7e0, stand: 0x8f96a0,
};

// player colours (hashed by pid)
export const GUY_COLORS = [0xe8574f, 0x5aa7e0, 0x46c2a5, 0xe0c23e, 0x9b6fd6, 0xe8804f, 0x6fd6d0, 0x92bd63];

// the paint swatches (livery editor) — 24, in a pleasing order; first is "factory" (handled by the UI)
export const SWATCHES = [
  0xe8574f, 0xe8804f, 0xe69a3c, 0xe0c23e, 0xb9c94e, 0x92bd63, 0x46c2a5, 0x6fd6d0,
  0x5aa7e0, 0x3f83b8, 0x9b6fd6, 0xc05aa0, 0xf2d1a8, 0xc9a44a, 0x8a5a3c, 0x55503f,
  0x4a4f57, 0x7f8894, 0xaab4c0, 0xd0d6dd, 0xeef1f4, 0xfffdf6, 0xf6f1e3, 0x233618,
];

/* Sky / light keyframes by hour. The game interpolates between neighbours.
   sunI/hemiI are three.js intensities (top face ≈ hemiI + sunI·cos(elev-angle)). */
export const SKY = [
  { h: 5.0,  skyTop: 0x0e1730, skyHorizon: 0x2a3556, sunColor: 0x6f86c8, sunI: 0.25, hemiSky: 0x3a4a73, hemiGround: 0x202833, hemiI: 0.45, fog: 0x1f2a44 },
  { h: 6.5,  skyTop: 0x9fc3e6, skyHorizon: 0xf2c9a0, sunColor: 0xffc08a, sunI: 0.90, hemiSky: 0xcfe0f0, hemiGround: 0x9c8f7a, hemiI: 0.90, fog: 0xe8d2bf },
  { h: 12.5, skyTop: 0x7fb6e8, skyHorizon: 0xbfe3f2, sunColor: 0xfff4d6, sunI: 0.70, hemiSky: 0xffffff, hemiGround: 0xa8c98a, hemiI: 1.08, fog: 0xbfe3f2 },
  { h: 17.0, skyTop: 0x86a9d6, skyHorizon: 0xffcf9a, sunColor: 0xffd09a, sunI: 1.45, hemiSky: 0xeef2f8, hemiGround: 0xbfae8c, hemiI: 1.12, fog: 0xf0d3b0 },
  { h: 19.5, skyTop: 0x4e5f8f, skyHorizon: 0xf08f6a, sunColor: 0xff9a5a, sunI: 0.80, hemiSky: 0x9fa8c9, hemiGround: 0x6f6657, hemiI: 0.70, fog: 0xc99a86 },
  { h: 21.5, skyTop: 0x0e1730, skyHorizon: 0x2a3556, sunColor: 0x6f86c8, sunI: 0.25, hemiSky: 0x3a4a73, hemiGround: 0x202833, hemiI: 0.45, fog: 0x1f2a44 },
];

export function hex(n){ return '#' + (n >>> 0).toString(16).padStart(6, '0'); }

// darker shade of a colour (the no-black-outline rule)
export function shade(h, f = 0.78){
  const r = ((h >> 16) & 255) * f, g = ((h >> 8) & 255) * f, b = (h & 255) * f;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

// lerp two hex colours in RGB
export function mixHex(a, b, t){
  const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
  const br = b >> 16 & 255, bg = b >> 8 & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

// interpolated sky/light state for an hour of the day (0..24)
export function skyAt(hour){
  const h = ((hour % 24) + 24) % 24;
  let a = SKY[SKY.length - 1], b = SKY[0], t = 0;
  if(h < SKY[0].h || h >= SKY[SKY.length - 1].h){
    const span = (24 - SKY[SKY.length - 1].h) + SKY[0].h;
    const d = h >= SKY[SKY.length - 1].h ? h - SKY[SKY.length - 1].h : h + (24 - SKY[SKY.length - 1].h);
    t = d / span;
  } else {
    for(let i = 0; i < SKY.length - 1; i++){
      if(h >= SKY[i].h && h < SKY[i + 1].h){ a = SKY[i]; b = SKY[i + 1]; t = (h - a.h) / (b.h - a.h); break; }
    }
  }
  const out = {};
  for(const k of ['skyTop', 'skyHorizon', 'sunColor', 'hemiSky', 'hemiGround', 'fog']) out[k] = mixHex(a[k], b[k], t);
  for(const k of ['sunI', 'hemiI']) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

// CSS gets the same truth as --k-<name>
export function injectCssVars(){
  if(typeof document === 'undefined' || document.getElementById('kpal')) return;
  const st = document.createElement('style'); st.id = 'kpal';
  st.textContent = ':root{' + Object.entries(PAL).map(([k, v]) => `--k-${k}:${hex(v)};`).join('') + '}';
  document.head.appendChild(st);
}
injectCssVars();
