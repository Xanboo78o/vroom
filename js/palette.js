/* =============================================================================
   palette.js — kRacing's ONE source of truth for colour (2D, cute edition).
   Pastel fills, outlines in a slightly darker shade of the SAME fill — never
   black (Adam's rule). CSS reads them as --k-* vars. Tune THIS file, nothing else.
   ============================================================================= */
export const PAL = {
  // ---- UI ----
  cream: 0xfbf6e9, border: 0xe3dccb, paper: 0xfffdf6, panel: 0xf3eddb, panelBorder: 0xe3dccb,
  red: 0xf26d65, redDark: 0xd4524b, blue: 0x6fb4e8, blueDark: 0x4a8fc7,
  text: 0x5a5546, mute: 0x958f7e, sky: 0xcfeaf6, cardShadow: 0xa9cfe0,
  dim: 0xefe9d8, dimBorder: 0xd8d1bc, fuel: 0xc2d45a, batt: 0x5fd0b4,
  // ---- world ----
  grass: 0xa9dc86, grassDark: 0x9acf77, grassLight: 0xb6e394,
  shoulder: 0xc3c7ce, asphalt: 0x6f7787, gravel: 0xc9b58f, gravelEdge: 0xd9c8a6, dash: 0xf4f0e4,
  checker: 0xf6f2e8, checkerDark: 0x5a6170, kerbRed: 0xf26d65, kerbCream: 0xfbf6e9,
  pitLane: 0x8a93a3, pad: 0xf5d35e, padDot: 0xd2b43f, pitWall: 0xdfe3e8,
  plaza: 0xe6d9bf, ramp: 0xf0a46a, rampSkirt: 0xd48a52, chevron: 0xfff0d8, cone: 0xf58f5a, coneStripe: 0xfff3e6,
  wall: 0xf0b3b3, block: 0xd9b35a, stone: 0xc5bfb2, plinth: 0xa7a197,
  bush: 0x7fc46d, tree: 0x6db86a, treeLight: 0x8fcc7f, trunk: 0x9c7a55,
  flowerP: 0xf7a8c4, flowerW: 0xfffaf0, flowerC: 0xf7d35e, rock: 0xc8c2b4, water: 0x8fd0ec, waterDeep: 0x6fbde3,
  shadow: 0x2b4a22,
  // ---- parts ----
  frame: 0xb3bdc9, wheel: 0x4f5560, hub: 0xe3c04a, seat: 0xf26d65, engine: 0xf0a352, engineDark: 0xd2843a,
  tank: 0xc2d45a, tankDark: 0x9eb043, intake: 0x6fb4e8, intakeDark: 0x4a8fc7, battery: 0x5fd0b4,
  batteryDark: 0x3fae93, motor: 0xa985e0, motorDark: 0x8a66c4, fan: 0x7fdcd6, fanDark: 0x5bbab4,
  wing: 0xf1f3f6, wingDark: 0xcbd1d8, skin: 0xf5d6b0, ink: 0x5a5546,
  // ---- critters ----
  duck: 0xf7f2e3, beak: 0xf39a3a, leather: 0x9a6a47, raccoon: 0x9699a2, mask: 0x4f5560,
  armadillo: 0xbf9a68, armadilloDark: 0x9a7a4f, otter: 0x7a5638, otterBelly: 0xd3b48c,
  coral: 0xf59aa0, coral2: 0xf7b26a, plow: 0x6fb4e8, blade: 0xf58f5a, beacon: 0xf5d35e,
  hoodie: 0x6fb4e8, stand: 0x9aa1ab, bread: 0xe0ad66, breadDark: 0xb88545,
};

// player colours (hashed by pid)
export const GUY_COLORS = [0xf26d65, 0x6fb4e8, 0x5fd0b4, 0xf5d35e, 0xa985e0, 0xf58f5a, 0x7fdcd6, 0x9acf77];

export function hex(n){ return '#' + (n >>> 0).toString(16).padStart(6, '0'); }

// darker shade of a colour (the no-black-outline rule; ~20% darker reads as "his" line)
export function shade(h, f = 0.8){
  const r = ((h >> 16) & 255) * f, g = ((h >> 8) & 255) * f, b = (h & 255) * f;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
// lighter tint (toward white)
export function tint(h, f = 0.25){
  const r = ((h >> 16) & 255), g = ((h >> 8) & 255), b = (h & 255);
  return (Math.round(r + (255 - r) * f) << 16) | (Math.round(g + (255 - g) * f) << 8) | Math.round(b + (255 - b) * f);
}
export function rgba(h, a){ return `rgba(${(h >> 16) & 255},${(h >> 8) & 255},${h & 255},${a})`; }

// CSS gets the same truth as --k-<name>
export function injectCssVars(){
  if(typeof document === 'undefined' || document.getElementById('kpal')) return;
  const st = document.createElement('style'); st.id = 'kpal';
  st.textContent = ':root{' + Object.entries(PAL).map(([k, v]) => `--k-${k}:${hex(v)};`).join('') + '}';
  document.head.appendChild(st);
}
injectCssVars();
