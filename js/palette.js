/* =============================================================================
   palette.js — kRacing's ONE source of truth for colour (2D, VIBRANT edition).
   Saturated fills, outlines in a darker shade of the SAME fill — never black
   (Adam's rule). CSS reads them as --k-* vars. Tune THIS file, nothing else.
   ============================================================================= */
export const PAL = {
  // ---- UI ----
  cream: 0xfdf6e4, border: 0xe6d9bd, paper: 0xfffdf6, panel: 0xf6ecd2, panelBorder: 0xe6d9bd,
  red: 0xef4b42, redDark: 0xc9372f, blue: 0x3d9de6, blueDark: 0x2b7fc2,
  text: 0x4b4638, mute: 0x8f8870, sky: 0x9fdcf7, cardShadow: 0x6fb5d9,
  dim: 0xf1e8d0, dimBorder: 0xd9cdb0, fuel: 0xb5d33b, batt: 0x2fcfa1,
  // ---- world ----
  grass: 0x7fc855, grassDark: 0x6db449, grassLight: 0x95d76a,
  shoulder: 0xb4b9c1, asphalt: 0x5a6170, concrete: 0xbdb7a9, gravel: 0xc7b185, gravelEdge: 0xd9c79c, dash: 0xf6f3e8, edgeLine: 0xfafaf5,
  checker: 0xf8f5ec, checkerDark: 0x4b515d, kerbRed: 0xe8403a, kerbCream: 0xfaf5e6,
  pitLane: 0x6b7382, pad: 0xffcf3d, padDot: 0xd9a91f, pitWall: 0xe3e6ea, bay: 0xfaf8f0,
  plaza: 0xe6c27c, ramp: 0xf28a2e, rampSkirt: 0xcc6d1f, chevron: 0xfff1d6, cone: 0xff6f2e, coneStripe: 0xfff6ea,
  wall: 0xf08d8d, block: 0xd9a832, stone: 0xc2bbad, plinth: 0x9e978b,
  bush: 0x5eb84c, tree: 0x4aa847, treeLight: 0x6cc45e, trunk: 0x8f6a45,
  flowerP: 0xf98fb8, flowerW: 0xfffaf0, flowerC: 0xffd23f, rock: 0xc1bbad, water: 0x46b4ec, waterDeep: 0x2d96d4,
  garage: 0xd8d3c8, garageDoor: 0x8e9aa8, shadow: 0x1f3a18,
  // ---- parts ----
  frame: 0xa9b4c2, wheel: 0x3f454f, hub: 0xf2c230, seat: 0xef4b42, engine: 0xf2963a, engineDark: 0xcf7623,
  tank: 0xb5d33b, tankDark: 0x8fa82a, intake: 0x3d9de6, intakeDark: 0x2b7fc2, battery: 0x2fcfa1,
  batteryDark: 0x22a67f, motor: 0x9b6fe0, motorDark: 0x7c53c4, fan: 0x5dd3cc, fanDark: 0x3fb0a9,
  wing: 0xf4f6f8, wingDark: 0xc3cad2, aero: 0xdde6ee, skin: 0xf5d2a6, ink: 0x4b4638,
  lead: 0x6d7580, foam: 0xfff0a8, plate: 0x8892a0, bumper: 0x3f454f, monster: 0x2f343c, slick: 0x23272e, caster: 0x5a6170,
  v8: 0xe0552d, turbo: 0xf7b267, jerry: 0xa7c33a, solar: 0x2f5fa8, bigbatt: 0x1f9f7a, fin: 0xf4f6f8,
  knobby: 0x6b4e33, spike: 0x4b515d, spikeTip: 0xe8e9ec, brake: 0xc9372f, putt: 0xc7b185, jet: 0x7a8694, jetGlow: 0xffa33a,
  rocket: 0xff7a3d, ion: 0x7fd4ff, hinge: 0x8f8870, piston: 0xb5bcc6, rotor: 0x9b6fe0, rotorBlade: 0x5a4a80,
  oil: 0x2b2420, smoke: 0xc9c5bd, spikes: 0xd0d4d9, ram: 0xe0552d, caltrop: 0x5a6170, banana: 0xffd23f, bananaDark: 0xc9a42a,
  hook: 0xf2c230, rope: 0xd9b587, flag: 0xef4b42, numplate: 0xfffdf6, antenna: 0x4b4638, horn: 0xffcf3d,
  logic: 0x2fcfa1, sensor: 0x3d9de6, gate: 0x6db449, wire: 0xff6f2e, panel: 0xf5d2a6, mech: 0xb5bcc6,
  // ---- critters ----
  duck: 0xf8f2dd, beak: 0xf7931e, leather: 0x9a6540, raccoon: 0x8d9099, mask: 0x3f454f,
  armadillo: 0xc19960, armadilloDark: 0x96743f, otter: 0x7a5132, otterBelly: 0xd9b587,
  coral: 0xf78b92, coral2: 0xf9a94d, plow: 0x3d9de6, blade: 0xff6f2e, beacon: 0xffcf3d,
  hoodie: 0x3d9de6, stand: 0x98a0ab, bread: 0xe3a954, breadDark: 0xb07f32,
};

// player colours (hashed by pid)
export const GUY_COLORS = [0xef4b42, 0x3d9de6, 0x2fcfa1, 0xffcf3d, 0x9b6fe0, 0xff6f2e, 0x5dd3cc, 0x6db449];

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
