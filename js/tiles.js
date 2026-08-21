/* =============================================================================
   tiles.js — ground TEXTURE. Every surface is a repeating tile (8×8 world units):
   grass blades, asphalt grain + cracks, concrete with expansion joints, sand,
   gravel pebbles, water ripples. Generated once in code; drop
   assets/tiles/<name>.png (or .svg) to replace any with Adam's art (T reloads).
   Use: ctx.fillStyle / strokeStyle = pat(ctx, 'grass') — it's anchored in WORLD
   space, so it scrolls with the camera and never swims.
   ============================================================================= */
import { PAL, hex, shade, tint, rgba } from './palette.js';

export const TILE_U = 8;          // one tile covers 8 × 8 units
const PX = 512;                   // generated at 64 px per unit
const NAMES = ['grass', 'grassDark', 'asphalt', 'shoulder', 'concrete', 'sand', 'gravel', 'water', 'pit'];
const TILE = new Map();           // name -> canvas|image
const PAT = new Map();            // name -> CanvasPattern (rebuilt when the tile changes)
let seed = 7;
function rnd(){ seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function r(a, b){ return a + rnd() * (b - a); }
function cv(){ const c = document.createElement('canvas'); c.width = c.height = PX; return c; }
// draw something at (x,y) and at its wrapped copies so the tile seams are invisible
function wrap(x, y, f){ for(const dx of [-PX, 0, PX]) for(const dy of [-PX, 0, PX]) f(x + dx, y + dy); }

const GEN = {
  grass(base = PAL.grass){ const c = cv(), x = c.getContext('2d'); seed = 11;
    x.fillStyle = hex(base); x.fillRect(0, 0, PX, PX);
    // mowed stripes: two 4-unit bands per tile (reads as turf at any zoom)
    x.fillStyle = rgba(0xffffff, 0.075); x.fillRect(0, 0, PX, PX / 2);
    x.fillStyle = rgba(0x000000, 0.04); x.fillRect(0, PX / 2, PX, PX / 2);
    // soft mottling
    for(let i = 0; i < 18; i++){ const px = r(0, PX), py = r(0, PX), rr = r(50, 130); wrap(px, py, (a, b) => { x.beginPath(); x.arc(a, b, rr, 0, 7); x.fillStyle = rgba(i % 2 ? tint(base, .12) : shade(base, .93), 0.2); x.fill(); }); }
    // blades
    x.lineCap = 'round';
    for(let i = 0; i < 2600; i++){ const px = r(0, PX), py = r(0, PX), L = r(5, 13), a = r(-0.5, 0.5), lw = r(1.2, 2.4);
      x.strokeStyle = rgba(i % 3 ? (i % 2 ? tint(base, .22) : shade(base, .8)) : tint(base, .4), 0.75); x.lineWidth = lw;
      wrap(px, py, (p, q) => { x.beginPath(); x.moveTo(p, q); x.lineTo(p + Math.sin(a) * L, q - Math.cos(a) * L); x.stroke(); }); }
    // a few clover dots
    for(let i = 0; i < 120; i++){ const px = r(0, PX), py = r(0, PX); wrap(px, py, (a, b) => { x.beginPath(); x.arc(a, b, r(1.5, 3), 0, 7); x.fillStyle = rgba(shade(base, .72), 0.55); x.fill(); }); }
    return c; },
  grassDark(){ return GEN.grass(PAL.grassDark); },
  asphalt(base = PAL.asphalt, grain = 9000){ const c = cv(), x = c.getContext('2d'); seed = 23;
    x.fillStyle = hex(base); x.fillRect(0, 0, PX, PX);
    for(let i = 0; i < 10; i++){ const px = r(0, PX), py = r(0, PX), rr = r(60, 150); wrap(px, py, (a, b) => { x.beginPath(); x.arc(a, b, rr, 0, 7); x.fillStyle = rgba(i % 2 ? tint(base, .06) : shade(base, .9), 0.14); x.fill(); }); }
    for(let i = 0; i < grain; i++){ const s = r(1, 2.6); x.fillStyle = rgba(i % 2 ? 0xffffff : 0x000000, i % 2 ? 0.09 : 0.13); x.fillRect(r(0, PX), r(0, PX), s, s); }
    // cracks
    x.strokeStyle = rgba(0x000000, 0.22); x.lineWidth = 1.4; x.lineCap = 'round';
    for(let k = 0; k < 5; k++){ let px = r(0, PX), py = r(0, PX); x.beginPath(); x.moveTo(px, py); for(let j = 0; j < 7; j++){ px += r(-26, 26); py += r(-26, 26); x.lineTo(px, py); } x.stroke(); }
    return c; },
  shoulder(){ return GEN.asphalt(PAL.shoulder, 5000); },
  pit(){ return GEN.asphalt(PAL.pitLane, 7000); },
  concrete(){ const c = cv(), x = c.getContext('2d'); seed = 41; const base = PAL.concrete;
    x.fillStyle = hex(base); x.fillRect(0, 0, PX, PX);
    for(let i = 0; i < 5000; i++){ const s = r(1, 2.2); x.fillStyle = rgba(i % 2 ? 0xffffff : 0x000000, i % 2 ? 0.1 : 0.08); x.fillRect(r(0, PX), r(0, PX), s, s); }
    for(let i = 0; i < 8; i++){ const px = r(0, PX), py = r(0, PX), rr = r(70, 160); wrap(px, py, (a, b) => { x.beginPath(); x.arc(a, b, rr, 0, 7); x.fillStyle = rgba(i % 2 ? tint(base, .08) : shade(base, .92), 0.1); x.fill(); }); }
    // expansion joints every 4 u (= half a tile)
    x.strokeStyle = rgba(shade(base, .7), 0.5); x.lineWidth = 2.5;
    x.beginPath(); x.moveTo(0, 0.5); x.lineTo(PX, 0.5); x.moveTo(0, PX / 2 + 0.5); x.lineTo(PX, PX / 2 + 0.5); x.moveTo(0.5, 0); x.lineTo(0.5, PX); x.moveTo(PX / 2 + 0.5, 0); x.lineTo(PX / 2 + 0.5, PX); x.stroke();
    return c; },
  sand(){ const c = cv(), x = c.getContext('2d'); seed = 57; const base = PAL.plaza;
    x.fillStyle = hex(base); x.fillRect(0, 0, PX, PX);
    for(let i = 0; i < 7000; i++){ const s = r(1, 2.2); x.fillStyle = rgba(i % 2 ? 0xffffff : 0x000000, i % 2 ? 0.16 : 0.07); x.fillRect(r(0, PX), r(0, PX), s, s); }
    for(let i = 0; i < 160; i++){ const px = r(0, PX), py = r(0, PX); wrap(px, py, (a, b) => { x.beginPath(); x.ellipse(a, b, r(2, 4), r(1.5, 3), r(0, 3), 0, 7); x.fillStyle = rgba(shade(base, .78), 0.5); x.fill(); }); }
    return c; },
  gravel(){ const c = cv(), x = c.getContext('2d'); seed = 73; const base = PAL.gravel;
    x.fillStyle = hex(base); x.fillRect(0, 0, PX, PX);
    for(let i = 0; i < 2600; i++){ const px = r(0, PX), py = r(0, PX), rr = r(2, 5); wrap(px, py, (a, b) => { x.beginPath(); x.ellipse(a, b, rr, rr * r(.6, 1), r(0, 3), 0, 7); x.fillStyle = rgba(i % 3 ? shade(base, r(.72, .9)) : tint(base, .3), 0.85); x.fill(); }); }
    return c; },
  water(){ const c = cv(), x = c.getContext('2d'); seed = 91; const base = PAL.water;
    x.fillStyle = hex(base); x.fillRect(0, 0, PX, PX);
    for(let i = 0; i < 8; i++){ const px = r(0, PX), py = r(0, PX), rr = r(60, 160); wrap(px, py, (a, b) => { x.beginPath(); x.arc(a, b, rr, 0, 7); x.fillStyle = rgba(i % 2 ? PAL.waterDeep : tint(base, .1), 0.35); x.fill(); }); }
    x.lineCap = 'round'; x.lineWidth = 3;
    for(let i = 0; i < 70; i++){ const px = r(0, PX), py = r(0, PX), L = r(20, 60); x.strokeStyle = rgba(0xffffff, 0.35);
      wrap(px, py, (a, b) => { x.beginPath(); x.moveTo(a - L / 2, b); x.quadraticCurveTo(a, b - 6, a + L / 2, b); x.stroke(); }); }
    return c; },
};

export function initTiles(){ for(const n of NAMES) if(!TILE.has(n)) TILE.set(n, GEN[n]()); loadAdamTiles(); }

/* a pattern for this ctx, anchored in world units (TILE_U per repeat) */
export function pat(ctx, name){
  let p = PAT.get(name);
  if(p) return p;
  const t = TILE.get(name); if(!t) return hex(PAL[name] || PAL.grass);
  p = ctx.createPattern(t, 'repeat');
  const w = t.width || t.naturalWidth || PX;
  p.setTransform(new DOMMatrix().scale(TILE_U / w));
  PAT.set(name, p);
  return p;
}

/* Adam's overrides: assets/tiles/<name>.png or .svg — reload with T */
export function loadAdamTiles(){
  for(const name of NAMES){
    let tried = 0;
    const tryExt = ext => {
      const img = new Image();
      img.onload = () => { if(img.naturalWidth > 0){ img.userData = { adam: true }; TILE.set(name, img); PAT.delete(name); } };
      img.onerror = () => { if(++tried < 2) tryExt('svg'); else { const cur = TILE.get(name); if(cur && cur.userData && cur.userData.adam){ TILE.set(name, GEN[name]()); PAT.delete(name); } } };
      img.src = './assets/tiles/' + name + '.' + ext + '?t=' + Date.now();
    };
    tryExt('png');
  }
}
export function reloadTiles(){ loadAdamTiles(); }
