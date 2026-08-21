/* =============================================================================
   parts.js — the Lego catalog, 2D. A machine is a single layer of tiles on a
   fine grid (CELL = 0.3 u); every part covers a footprint fp:[w,d] of cells.
   Frames come in 1x1 / 2x2 / 3x3, everything else is 2x2. Forward = UP (-y).
   Each part draws as Adam's assets/parts/<type>.svg; the code-drawn fallback
   below stands in until he draws it. Flat fills, darker-shade outlines.
   ============================================================================= */
import { PAL, hex, shade, tint } from './palette.js';
import { box, disc, rrect, blob, art } from './draw.js';
import { hasArt } from './art.js';

export const CELL = 0.3;                 // fine grid step (x and y)
export const keyOf = (i, j) => i + ',' + j;

/* Categories — the inner rings of the catalog. Adding one here + `cat:` on parts is
   all it takes; the ring menu lays itself out. Order = clockwise from the top. */
export const CATS = [
  { id: 'frame',    label: 'FRAMES',   color: PAL.frame },
  { id: 'wheel',    label: 'WHEELS',   color: PAL.wheel },
  { id: 'seat',     label: 'SEATS',    color: PAL.seat },
  { id: 'engine',   label: 'ENGINE',   color: PAL.engine },
  { id: 'electric', label: 'ELECTRIC', color: PAL.battery },
  { id: 'aero',     label: 'AERO',     color: PAL.intake },
];

/* fallback drawers: centred on the origin, s = side length in units, forward = up */
const LW = 0.04;
function stud(ctx, s, c){ disc(ctx, 0, 0, s * 0.16, tint(c, 0.35), 0); }
const DRAW = {
  frame(ctx, s){ box(ctx, -s / 2, -s / 2, s, s, s * 0.22, PAL.frame, LW); stud(ctx, s, PAL.frame); },
  seat(ctx, s){
    box(ctx, -s / 2, -s / 2, s, s, s * 0.25, PAL.seat, LW);
    box(ctx, -s * .34, -s * .34, s * .68, s * .5, s * .12, tint(PAL.seat, .3), 0);        // cushion
    box(ctx, -s * .4, s * .16, s * .8, s * .26, s * .1, shade(PAL.seat, .85), 0);       // backrest (back = down)
  },
  wheel(ctx, s){
    box(ctx, -s * .42, -s / 2, s * .84, s, s * .26, PAL.wheel, LW);
    ctx.fillStyle = hex(tint(PAL.wheel, .18));
    for(let i = 0; i < 4; i++){ rrect(ctx, -s * .3, -s * .38 + i * s * .22, s * .6, s * .09, s * .04); ctx.fill(); }
    disc(ctx, 0, 0, s * .17, PAL.hub, LW * .8);
  },
  engine(ctx, s){
    box(ctx, -s / 2, -s / 2, s, s, s * .2, PAL.engine, LW);
    for(let i = 0; i < 3; i++) disc(ctx, (i - 1) * s * .27, -s * .05, s * .1, PAL.engineDark, 0);
    box(ctx, -s * .12, s * .3, s * .24, s * .2, s * .06, shade(PAL.engine, .7), 0);        // exhaust stub (back)
  },
  tank(ctx, s){
    box(ctx, -s * .36, -s / 2, s * .72, s, s * .36, PAL.tank, LW);
    disc(ctx, 0, -s * .22, s * .12, PAL.tankDark, 0);
    box(ctx, -s * .05, -s * .1, s * .1, s * .42, s * .05, tint(PAL.tank, .4), 0);
  },
  intake(ctx, s){
    box(ctx, -s * .42, -s * .3, s * .84, s * .8, s * .2, PAL.intake, LW);
    box(ctx, -s * .3, -s / 2, s * .6, s * .34, s * .12, PAL.intakeDark, 0);               // the mouth (front = up)
  },
  battery(ctx, s){
    box(ctx, -s * .4, -s * .42, s * .8, s * .84, s * .18, PAL.battery, LW);
    box(ctx, -s * .16, -s / 2, s * .32, s * .14, s * .05, PAL.batteryDark, 0);           // the tip
    ctx.fillStyle = hex(tint(PAL.battery, .5));
    rrect(ctx, -s * .04, -s * .22, s * .08, s * .4, s * .03); ctx.fill();
    rrect(ctx, -s * .2, -s * .06, s * .4, s * .08, s * .03); ctx.fill();                  // +
  },
  motor(ctx, s){
    box(ctx, -s / 2, -s * .36, s, s * .72, s * .36, PAL.motor, LW);
    box(ctx, -s * .14, -s * .4, s * .28, s * .8, s * .1, PAL.motorDark, 0);             // the band
  },
  fan(ctx, s, spin = 0){
    disc(ctx, 0, 0, s * .46, PAL.fan, LW);
    disc(ctx, 0, 0, s * .36, tint(PAL.fan, .25), 0);
    ctx.save(); ctx.rotate(spin);
    for(let i = 0; i < 4; i++){ ctx.rotate(Math.PI / 2); rrect(ctx, -s * .06, -s * .34, s * .12, s * .3, s * .05); blob(ctx, PAL.fanDark, 0); }
    ctx.restore();
    disc(ctx, 0, 0, s * .08, PAL.fanDark, 0);
  },
  wing(ctx, s){
    for(const sx of [-1, 1]) box(ctx, sx * s * .3 - s * .05, -s * .4, s * .1, s * .6, s * .04, PAL.wingDark, 0);   // struts
    box(ctx, -s / 2, s * .05, s, s * .32, s * .12, PAL.wing, LW);                          // the plane (back)
    box(ctx, -s * .4, s * .1, s * .8, s * .08, s * .04, tint(PAL.wingDark, .4), 0);
  },
};

/* Part defs.
   fp      — footprint in grid cells [w, d]
   mass    — light influence only (shape+mechanisms, not weight yet)
   facing  — part cares about its rotation (needs clear air ahead)
   shear   — impulse needed to knock it off (wheels pop easiest)
   art     — assets/parts/<art>.svg (falls back along `alt`)                        */
export const PARTS = {
  frame1:  { label: '1×1',    key: '1', cat: 'frame',    fp: [1, 1], mass: 0.3, color: PAL.frame,   shear: 26, art: 'frame1', alt: 'frame', draw: DRAW.frame },
  frame:   { label: '2×2',    key: '2', cat: 'frame',    fp: [2, 2], mass: 1.0, color: PAL.frame,   shear: 30, art: 'frame',  draw: DRAW.frame },
  frame3:  { label: '3×3',    key: '3', cat: 'frame',    fp: [3, 3], mass: 2.2, color: PAL.frame,   shear: 36, art: 'frame3', alt: 'frame', draw: DRAW.frame },
  seat:    { label: 'SEAT',   key: '4', cat: 'seat',     fp: [2, 2], mass: 0.8, color: PAL.seat,    shear: 34, art: 'seat',   draw: DRAW.seat },
  wheel:   { label: 'WHEEL',  key: '5', cat: 'wheel',    fp: [2, 2], mass: 0.9, color: PAL.wheel,   shear: 16, art: 'wheel',  draw: DRAW.wheel },   // pops off easiest
  engine:  { label: 'ENGINE', key: '6', cat: 'engine',   fp: [2, 2], mass: 1.6, color: PAL.engine,  shear: 40, art: 'engine', draw: DRAW.engine },
  tank:    { label: 'FUEL',   key: '7', cat: 'engine',   fp: [2, 2], mass: 1.2, color: PAL.tank,    shear: 34, art: 'tank',   draw: DRAW.tank },
  intake:  { label: 'INTAKE', key: '8', cat: 'engine',   fp: [2, 2], mass: 0.6, color: PAL.intake,  shear: 26, art: 'intake', draw: DRAW.intake, facing: true },
  battery: { label: 'BATT',   key: '9', cat: 'electric', fp: [2, 2], mass: 1.3, color: PAL.battery, shear: 34, art: 'battery', draw: DRAW.battery },
  motor:   { label: 'MOTOR',  key: '0', cat: 'electric', fp: [2, 2], mass: 1.1, color: PAL.motor,   shear: 36, art: 'motor',  draw: DRAW.motor },
  fan:     { label: 'FAN',    key: '',  cat: 'electric', fp: [2, 2], mass: 0.7, color: PAL.fan,     shear: 24, art: 'fan',    draw: DRAW.fan, facing: true },
  wing:    { label: 'WING',   key: '',  cat: 'aero',     fp: [2, 2], mass: 0.5, color: PAL.wing,    shear: 22, art: 'wing',   draw: DRAW.wing, facing: true },
};
export const PART_ORDER = ['frame1', 'frame', 'frame3', 'seat', 'wheel', 'engine', 'tank', 'intake', 'battery', 'motor', 'fan', 'wing'];

export function fpOf(type){ return PARTS[type].fp || [2, 2]; }
export function sizeOf(type){ const [w, d] = fpOf(type); return [w * CELL, d * CELL]; }

// machine-local centre (before the centre offset) of a part anchored at cell (i,j)
export function localCenterOf(i, j, type){
  const [w, d] = fpOf(type);
  return { x: (i + (w - 1) / 2) * CELL, y: (j + (d - 1) / 2) * CELL };
}
// every cell a part covers, from its anchor
export function* cellsOf(i, j, type){
  const [w, d] = fpOf(type);
  for(let a = 0; a < w; a++) for(let b = 0; b < d; b++) yield [i + a, j + b];
}
// facing direction of a rotated part, in grid steps (rot 0 = up = forward)
export function facingDir(rot){ return [[0, -1], [1, 0], [0, 1], [-1, 0]][rot & 3]; }

/* draw one part centred on the origin (caller translated). rot = quarter turns. */
export function drawPart(ctx, type, rot = 0, zoom = 40, alpha = 1, spin = 0, steer = 0){
  const def = PARTS[type]; if(!def) return;
  const [w, d] = sizeOf(type);
  ctx.save();
  ctx.rotate(rot * Math.PI / 2 + steer);
  let key = 'parts/' + def.art;
  if(!hasArt(key) && def.alt) key = 'parts/' + def.alt;
  if(!art(ctx, key, w, d, zoom, alpha)){
    if(alpha < 1) ctx.globalAlpha *= alpha;
    def.draw(ctx, Math.max(w, d), spin);
  }
  ctx.restore();
}

/* part icons for the ring: rendered once per part, cleared by T */
const ICONS = new Map();
export function partIcon(type){
  if(ICONS.has(type)) return ICONS.get(type);
  const N = 96, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const x = cv.getContext('2d');
  const [w] = sizeOf(type);
  const scale = 84 / (3 * CELL);                    // shared scale: a 1×1 LOOKS smaller than a 3×3
  x.translate(N / 2, N / 2); x.scale(scale, scale);
  drawPart(x, type, 0, scale);
  const url = cv.toDataURL(); ICONS.set(type, url); return url;
}
export function clearIcons(){ ICONS.clear(); }
