/* =============================================================================
   tiles.js — ground TEXTURE, "poppy" recipe (Adam picked it in lab/textures.html:
   POPPY at detail 0.2). Every surface is a repeating 8×8-unit tile of CRISP,
   OPAQUE shapes — hard-edged mowed stripes + a few clover dots on grass, flat
   asphalt with a sparse speck, concrete with joints, pebbles, wave dashes.
   No noise, no soft blobs (those read as fuzz). Tiles are generated per zoom
   bucket (16/32/64 px per unit) so they're never blurred by downscaling.
   Drop assets/tiles/<name>.png (or .svg) to replace any with Adam's art (T reloads).
   Use: ctx.fillStyle / strokeStyle = pat(ctx, 'grass', zoom) — anchored in WORLD
   space, so it scrolls with the camera and never swims.
   ============================================================================= */
import { PAL, hex, shade, tint, rgba } from './palette.js';

export const TILE_U = 8;          // one tile covers 8 × 8 units
export const DETAIL = 0.2;        // his pick
const STRIPE = 4;                 // mowed band width (u)
const NAMES = ['grass', 'grassDark', 'asphalt', 'shoulder', 'concrete', 'sand', 'gravel', 'water', 'pit'];
const RES = [16, 32, 64];
const TILE = new Map();           // name@res -> canvas  (or name -> Adam's image)
const PAT = new Map();            // name@res -> CanvasPattern
let seed = 7;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const r = (a, b) => a + rnd() * (b - a);
function tile(res, fn){ const c = document.createElement('canvas'); c.width = c.height = TILE_U * res; const x = c.getContext('2d'); fn(x, res, c.width); return c; }
const flat = (x, S, c) => { x.fillStyle = hex(c); x.fillRect(0, 0, S, S); };
function stripes(x, res, S, base, k = .07){ flat(x, S, base); const sw = STRIPE * res; for(let y = 0, i = 0; y < S; y += sw, i++){ x.fillStyle = i % 2 ? rgba(0, .05) : rgba(0xffffff, k); x.fillRect(0, y, S, sw); } }
function clover(x, res, S, base, n){ for(let i = 0; i < n; i++){ const px = r(0, S), py = r(0, S), rr = res * 0.11; x.fillStyle = hex(shade(base, .8)); for(const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]){ x.beginPath(); x.arc(px + dx * rr * 0.9, py + dy * rr * 0.9, rr, 0, 7); x.fill(); } } }
function blades(x, res, S, base, n){ x.lineCap = 'round'; x.lineWidth = Math.max(1, res * 0.06); x.strokeStyle = hex(tint(base, .28)); for(let i = 0; i < n; i++){ const px = r(0, S), py = r(0, S), L = res * r(.25, .5); x.beginPath(); x.moveTo(px, py); x.lineTo(px + res * r(-.1, .1), py - L); x.stroke(); } }
function specks(x, S, n, size, colA, colB){ if(S >= 512) size *= 0.7;   // close-up: smaller specks, not confetti
 for(let i = 0; i < n; i++){ x.fillStyle = hex(i % 2 ? colA : colB); const s = Math.max(1, size * r(.7, 1.3)); x.fillRect(Math.round(r(0, S)), Math.round(r(0, S)), s, s); } }
function joints(x, res, S, col){ x.strokeStyle = hex(col); x.lineWidth = Math.max(1, res * 0.07); x.beginPath(); for(const v of [0, S / 2]){ x.moveTo(0, v + .5); x.lineTo(S, v + .5); x.moveTo(v + .5, 0); x.lineTo(v + .5, S); } x.stroke(); }
function pebbles(x, res, S, base, n, rmin, rmax){ for(let i = 0; i < n; i++){ const px = r(0, S), py = r(0, S), rr = res * r(rmin, rmax); x.fillStyle = hex(i % 3 ? shade(base, r(.74, .88)) : tint(base, .3)); x.beginPath(); x.ellipse(px, py, rr, rr * r(.6, 1), r(0, 3), 0, 7); x.fill(); } }
// wrap-safe duplicates so seams vanish (for bigger shapes)
function wrap(S, px, py, f){ for(const dx of [-S, 0, S]) for(const dy of [-S, 0, S]) f(px + dx, py + dy); }

const D = DETAIL;
const GEN = {
  grass(res, base = PAL.grass){ seed = 11; return tile(res, (x, rs, S) => { stripes(x, rs, S, base); clover(x, rs, S, base, 40 * D); blades(x, rs, S, base, 60 * D); }); },
  grassDark(res){ return GEN.grass(res, PAL.grassDark); },
  asphalt(res, base = PAL.asphalt, n = 140){ seed = 23; return tile(res, (x, rs, S) => { flat(x, S, base); specks(x, S, n * D, rs * 0.12, tint(base, .22), shade(base, .8)); }); },
  shoulder(res){ return GEN.asphalt(res, PAL.shoulder, 60); },
  pit(res){ return GEN.asphalt(res, PAL.pitLane, 100); },
  concrete(res){ seed = 41; return tile(res, (x, rs, S) => { const b = PAL.concrete; flat(x, S, b); specks(x, S, 120 * D, rs * 0.1, tint(b, .2), shade(b, .82)); joints(x, rs, S, shade(b, .82)); }); },
  sand(res){ seed = 57; return tile(res, (x, rs, S) => { const b = PAL.plaza; flat(x, S, b); pebbles(x, rs, S, b, 160 * D + 10, 0.04, 0.09); }); },
  gravel(res){ seed = 73; return tile(res, (x, rs, S) => { const b = PAL.gravel; flat(x, S, b); pebbles(x, rs, S, b, 900, 0.04, 0.1); }); },
  water(res){ seed = 91; return tile(res, (x, rs, S) => { const b = PAL.water; flat(x, S, b);
    for(let i = 0; i < 5; i++){ const px = r(0, S), py = r(0, S), rr = rs * r(1, 2.2); wrap(S, px, py, (a, c) => { x.beginPath(); x.arc(a, c, rr, 0, 7); x.fillStyle = hex(i % 2 ? PAL.waterDeep : tint(b, .1)); x.fill(); }); }
    x.lineCap = 'round'; x.lineWidth = Math.max(1, rs * 0.08); x.strokeStyle = hex(tint(b, .7));
    for(let i = 0; i < 16; i++){ const px = r(0, S), py = r(0, S), L = rs * r(.8, 1.6); wrap(S, px, py, (a, c) => { x.beginPath(); x.moveTo(a - L / 2, c); x.quadraticCurveTo(a, c - rs * .2, a + L / 2, c); x.stroke(); }); } }); },
};

export function initTiles(){ loadAdamTiles(); }
function resFor(zoom){ return zoom <= 20 ? 16 : zoom <= 40 ? 32 : 64; }

/* a pattern for this ctx, anchored in world units (TILE_U per repeat), crisp at this zoom */
export function pat(ctx, name, zoom = 32){
  const adam = TILE.get(name);                       // Adam's image tile (any res)
  const res = adam ? 'adam' : resFor(zoom);
  const k = name + '@' + res;
  let p = PAT.get(k);
  if(p) return p;
  let t = adam || TILE.get(k);
  if(!t){ if(!GEN[name]) return hex(PAL[name] || PAL.grass); t = GEN[name](res); TILE.set(k, t); }
  p = ctx.createPattern(t, 'repeat');
  const w = t.width || t.naturalWidth || 512;
  p.setTransform(new DOMMatrix().scale(TILE_U / w));
  PAT.set(k, p);
  return p;
}

/* Adam's overrides: assets/tiles/<name>.png or .svg — reload with T */
export function loadAdamTiles(){
  for(const name of NAMES){
    let tried = 0;
    const tryExt = ext => {
      const img = new Image();
      img.onload = () => { if(img.naturalWidth > 0){ TILE.set(name, img); for(const k of [...PAT.keys()]) if(k.startsWith(name + '@')) PAT.delete(k); } };
      img.onerror = () => { if(++tried < 2) tryExt('svg'); else if(TILE.has(name)){ TILE.delete(name); for(const k of [...PAT.keys()]) if(k.startsWith(name + '@')) PAT.delete(k); } };
      img.src = './assets/tiles/' + name + '.' + ext + '?t=' + Date.now();
    };
    tryExt('png');
  }
}
export function reloadTiles(){ loadAdamTiles(); }
