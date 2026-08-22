/* =============================================================================
   parts.js — the Lego catalog, 2D. A machine is a stack of tile LAYERS on a
   fine grid (CELL = 0.3 u); every part covers a footprint fp:[w,d] of cells
   (a PANEL covers whatever cells you drew it over). Forward = UP (-y).
   Each part draws as Adam's assets/parts/<type>.svg; the code-drawn fallback
   below stands in until he draws it. Flat fills, darker-shade outlines.
   Every block hooks a real system (machine.js) — see README "BLOCKS".
   ============================================================================= */
import { PAL, hex, shade, tint, rgba } from './palette.js';
import { box, disc, rrect, blob, art } from './draw.js';
import { hasArt } from './art.js';

export const CELL = 0.3;                 // fine grid step (x and y)
export const keyOf = (i, j, l = 0) => i + ',' + j + ',' + l;
// "i,j" (old builds) or "i,j,l" -> [i, j, l]
export const parseKey = k => { const a = k.split(',').map(Number); return [a[0], a[1], a[2] || 0]; };

/* Categories — the inner rings of the catalog. Adding one here + `cat:` on parts is
   all it takes; the ring menu lays itself out. Order = clockwise from the top. */
export const CATS = [
  { id: 'frame',    label: 'FRAMES',   color: PAL.frame },
  { id: 'body',     label: 'BODY',     color: PAL.panel },
  { id: 'wheel',    label: 'WHEELS',   color: PAL.wheel },
  { id: 'seat',     label: 'SEATS',    color: PAL.seat },
  { id: 'engine',   label: 'ENGINE',   color: PAL.engine },
  { id: 'electric', label: 'ELECTRIC', color: PAL.battery },
  { id: 'thrust',   label: 'THRUST',   color: PAL.rocket },
  { id: 'aero',     label: 'AERO',     color: PAL.intake },
  { id: 'mech',     label: 'MECH',     color: PAL.mech },
  { id: 'gadget',   label: 'GADGETS',  color: PAL.oil },
  { id: 'tool',     label: 'TOOLS',    color: PAL.hook },
  { id: 'decor',    label: 'DECOR',    color: PAL.flag },
  { id: 'logic',    label: 'LOGIC',    color: PAL.logic },
];

/* fallback drawers: centred on the origin, s = side length in units, forward = up */
const LW = 0.04;
function stud(ctx, s, c){ disc(ctx, 0, 0, s * 0.16, tint(c, 0.35), 0); }
function txt(ctx, t, size, color, y = 0, font = 'Impact, sans-serif'){ ctx.fillStyle = hex(color); ctx.font = `900 ${size}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, 0, y); }
// tyres: a rounded block with treads; compound changes the face
function tyre(ctx, s, color, kind){
  box(ctx, -s * .42, -s / 2, s * .84, s, s * .26, color, LW);
  if(kind === 'slick'){ box(ctx, -s * .3, -s * .02, s * .6, s * .04, s * .02, tint(color, .2), 0); disc(ctx, 0, 0, s * .17, PAL.red, LW * .8); return; }
  if(kind === 'knobby'){ ctx.fillStyle = hex(tint(color, .3)); for(let r = 0; r < 3; r++) for(let i = 0; i < 3; i++){ rrect(ctx, -s * .32 + i * s * .22 + (r % 2) * s * .1, -s * .38 + r * s * .28, s * .12, s * .14, s * .04); ctx.fill(); } disc(ctx, 0, 0, s * .15, PAL.hub, LW * .8); return; }
  if(kind === 'spike'){ ctx.fillStyle = hex(tint(color, .18)); for(let i = 0; i < 4; i++){ rrect(ctx, -s * .3, -s * .38 + i * s * .22, s * .6, s * .09, s * .04); ctx.fill(); }
    ctx.fillStyle = hex(PAL.spikeTip); for(let i = 0; i < 5; i++) for(const sx of [-1, 1]){ const x = sx * s * .3, y = -s * .4 + i * s * .2; ctx.beginPath(); ctx.moveTo(x - s * .05, y); ctx.lineTo(x + sx * s * .12, y + s * .05); ctx.lineTo(x + s * .05, y + s * .1); ctx.closePath(); ctx.fill(); }
    disc(ctx, 0, 0, s * .15, PAL.hub, LW * .8); return; }
  ctx.fillStyle = hex(tint(color, .18)); for(let i = 0; i < 4; i++){ rrect(ctx, -s * .3, -s * .38 + i * s * .22, s * .6, s * .09, s * .04); ctx.fill(); }
  disc(ctx, 0, 0, s * .17, PAL.hub, LW * .8);
}
function gate(ctx, s, letters){ box(ctx, -s / 2, -s / 2, s, s, s * .18, PAL.gate, LW); box(ctx, -s * .38, -s * .3, s * .76, s * .6, s * .1, shade(PAL.gate, .8), 0); txt(ctx, letters, s * .3, PAL.paper, s * .02); disc(ctx, 0, -s * .42, s * .07, PAL.wire, 0); disc(ctx, 0, s * .42, s * .07, PAL.wire, 0); }
const DRAW = {
  frame(ctx, s){ box(ctx, -s / 2, -s / 2, s, s, s * .22, PAL.frame, LW); stud(ctx, s, PAL.frame); },
  seat(ctx, s){
    box(ctx, -s / 2, -s / 2, s, s, s * .25, PAL.seat, LW);
    box(ctx, -s * .34, -s * .34, s * .68, s * .5, s * .12, tint(PAL.seat, .3), 0);        // cushion
    box(ctx, -s * .4, s * .16, s * .8, s * .26, s * .1, shade(PAL.seat, .85), 0);       // backrest (back = down)
  },
  wheel(ctx, s){ tyre(ctx, s, PAL.wheel, 'road'); },
  slick(ctx, s){ tyre(ctx, s, PAL.slick, 'slick'); },
  knobby(ctx, s){ tyre(ctx, s, PAL.knobby, 'knobby'); },
  monster(ctx, s){ box(ctx, -s * .44, -s / 2, s * .88, s, s * .3, PAL.monster, LW); ctx.fillStyle = hex(tint(PAL.monster, .25)); for(let i = 0; i < 5; i++){ rrect(ctx, -s * .34, -s * .4 + i * s * .18, s * .68, s * .09, s * .04); ctx.fill(); } disc(ctx, 0, 0, s * .16, PAL.hub, LW * .8); },
  spike(ctx, s){ tyre(ctx, s, PAL.spike, 'spike'); },
  caster(ctx, s){ disc(ctx, 0, 0, s * .42, PAL.caster, LW); disc(ctx, 0, 0, s * .16, PAL.hub, 0.02); },
  brake(ctx, s){ disc(ctx, 0, 0, s * .44, PAL.brake, LW); disc(ctx, 0, 0, s * .3, shade(PAL.brake, .75), 0); box(ctx, -s * .14, -s * .46, s * .28, s * .34, s * .06, PAL.ink, 0.02); disc(ctx, 0, 0, s * .1, PAL.hub, 0); },
  engine(ctx, s){
    box(ctx, -s / 2, -s / 2, s, s, s * .2, PAL.engine, LW);
    for(let i = 0; i < 3; i++) disc(ctx, (i - 1) * s * .27, -s * .05, s * .1, PAL.engineDark, 0);
    box(ctx, -s * .12, s * .3, s * .24, s * .2, s * .06, shade(PAL.engine, .7), 0);        // exhaust stub (back)
  },
  putt(ctx, s){ box(ctx, -s / 2, -s / 2, s, s, s * .22, PAL.putt, LW); disc(ctx, 0, -s * .08, s * .2, shade(PAL.putt, .75), 0); box(ctx, -s * .08, s * .3, s * .16, s * .18, s * .05, shade(PAL.putt, .6), 0); box(ctx, -s * .3, -s * .44, s * .12, s * .12, s * .03, PAL.ink, 0); },
  v8(ctx, s){ box(ctx, -s / 2, -s / 2, s, s, s * .12, PAL.v8, LW); for(let r = 0; r < 2; r++) for(let i = 0; i < 4; i++) disc(ctx, (i - 1.5) * s * .22, (r - .5) * s * .3, s * .08, shade(PAL.v8, .7), 0); txt(ctx, 'V8', s * .26, tint(PAL.v8, .5), s * .02); box(ctx, -s * .3, s * .38, s * .12, s * .1, s * .03, shade(PAL.v8, .5), 0); box(ctx, s * .18, s * .38, s * .12, s * .1, s * .03, shade(PAL.v8, .5), 0); },
  jet(ctx, s, spin = 0, on = 0){ box(ctx, -s * .4, -s / 2, s * .8, s, s * .3, PAL.jet, LW); disc(ctx, 0, -s * .2, s * .3, shade(PAL.jet, .8), LW * .6);
    ctx.save(); ctx.translate(0, -s * .2); ctx.rotate(spin); for(let i = 0; i < 6; i++){ ctx.rotate(Math.PI / 3); rrect(ctx, -s * .04, -s * .27, s * .08, s * .24, s * .03); blob(ctx, tint(PAL.jet, .45), 0); } ctx.restore();
    disc(ctx, 0, -s * .2, s * .07, PAL.ink, 0);
    box(ctx, -s * .26, s * .24, s * .52, s * .26, s * .08, shade(PAL.jet, .6), 0);
    if(on > 0){ ctx.beginPath(); ctx.moveTo(-s * .2, s * .5); ctx.lineTo(0, s * (.5 + .6 * on)); ctx.lineTo(s * .2, s * .5); ctx.closePath(); blob(ctx, PAL.jetGlow, 0); } },
  tank(ctx, s){
    box(ctx, -s * .36, -s / 2, s * .72, s, s * .36, PAL.tank, LW);
    disc(ctx, 0, -s * .22, s * .12, PAL.tankDark, 0);
    box(ctx, -s * .05, -s * .1, s * .1, s * .42, s * .05, tint(PAL.tank, .4), 0);
  },
  jerry(ctx, s){ box(ctx, -s * .4, -s * .35, s * .8, s * .8, s * .12, PAL.jerry, LW); box(ctx, -s * .12, -s / 2, s * .24, s * .2, s * .05, shade(PAL.jerry, .7), 0); },
  intake(ctx, s){
    box(ctx, -s * .42, -s * .3, s * .84, s * .8, s * .2, PAL.intake, LW);
    box(ctx, -s * .3, -s / 2, s * .6, s * .34, s * .12, PAL.intakeDark, 0);               // the mouth (front = up)
  },
  turbo(ctx, s){ box(ctx, -s * .42, -s * .2, s * .84, s * .68, s * .2, PAL.turbo, LW); disc(ctx, 0, -s * .18, s * .3, shade(PAL.turbo, .85), LW); disc(ctx, 0, -s * .18, s * .14, shade(PAL.turbo, .6), 0); box(ctx, -s * .2, -s / 2, s * .4, s * .2, s * .06, shade(PAL.turbo, .7), 0); },
  battery(ctx, s){
    box(ctx, -s * .4, -s * .42, s * .8, s * .84, s * .18, PAL.battery, LW);
    box(ctx, -s * .16, -s / 2, s * .32, s * .14, s * .05, PAL.batteryDark, 0);           // the tip
    ctx.fillStyle = hex(tint(PAL.battery, .5));
    rrect(ctx, -s * .04, -s * .22, s * .08, s * .4, s * .03); ctx.fill();
    rrect(ctx, -s * .2, -s * .06, s * .4, s * .08, s * .03); ctx.fill();                  // +
  },
  bigbatt(ctx, s){ box(ctx, -s / 2, -s * .4, s, s * .9, s * .12, PAL.bigbatt, LW); box(ctx, -s * .3, -s / 2, s * .2, s * .14, s * .04, shade(PAL.bigbatt, .7), 0); box(ctx, s * .1, -s / 2, s * .2, s * .14, s * .04, shade(PAL.bigbatt, .7), 0); for(let i = 0; i < 4; i++) box(ctx, -s * .36 + i * s * .2, s * .05, s * .14, s * .3, s * .03, shade(PAL.bigbatt, .75), 0); },
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
  solar(ctx, s){ box(ctx, -s / 2, -s / 2, s, s, s * .08, PAL.solar, LW); ctx.strokeStyle = hex(tint(PAL.solar, .35)); ctx.lineWidth = 0.02; for(let i = 1; i < 4; i++){ ctx.beginPath(); ctx.moveTo(-s / 2 + i * s / 4, -s / 2); ctx.lineTo(-s / 2 + i * s / 4, s / 2); ctx.moveTo(-s / 2, -s / 2 + i * s / 4); ctx.lineTo(s / 2, -s / 2 + i * s / 4); ctx.stroke(); } disc(ctx, -s * .3, -s * .3, s * .08, tint(PAL.solar, .6), 0); },
  rocket(ctx, s, spin = 0, on = 0){ box(ctx, -s * .3, -s * .42, s * .6, s * .84, s * .22, PAL.rocket, LW); box(ctx, -s * .18, -s * .5, s * .36, s * .2, s * .08, shade(PAL.rocket, .75), 0); for(const sx of [-1, 1]){ ctx.beginPath(); ctx.moveTo(sx * s * .3, s * .1); ctx.lineTo(sx * s * .48, s * .42); ctx.lineTo(sx * s * .3, s * .42); ctx.closePath(); blob(ctx, shade(PAL.rocket, .8), 0.02); }
    box(ctx, -s * .22, s * .32, s * .44, s * .16, s * .05, PAL.ink, 0);
    if(on > 0){ ctx.beginPath(); ctx.moveTo(-s * .18, s * .48); ctx.lineTo(0, s * (.5 + .9 * on)); ctx.lineTo(s * .18, s * .48); ctx.closePath(); blob(ctx, PAL.jetGlow, 0); ctx.beginPath(); ctx.moveTo(-s * .09, s * .48); ctx.lineTo(0, s * (.5 + .5 * on)); ctx.lineTo(s * .09, s * .48); ctx.closePath(); blob(ctx, PAL.paper, 0); } },
  ion(ctx, s, spin = 0, on = 0){ box(ctx, -s * .4, -s / 2, s * .8, s, s * .18, PAL.ion, LW); disc(ctx, 0, -s * .15, s * .2, tint(PAL.ion, .4), 0.02); for(let i = 0; i < 3; i++) box(ctx, -s * .3 + i * s * .22, s * .2, s * .14, s * .22, s * .04, shade(PAL.ion, .7), 0);
    if(on > 0){ ctx.fillStyle = rgba(0xa8f0ff, 0.8); for(let i = 0; i < 3; i++){ ctx.beginPath(); ctx.arc(-s * .23 + i * s * .22, s * (.5 + .25 * on), s * .07, 0, 7); ctx.fill(); } } },
  hinge(ctx, s){ box(ctx, -s / 2, -s / 2, s, s, s * .2, PAL.hinge, LW); disc(ctx, 0, 0, s * .3, shade(PAL.hinge, .7), LW * .6); disc(ctx, 0, 0, s * .1, PAL.hub, 0); box(ctx, -s * .08, -s / 2, s * .16, s * .2, s * .04, PAL.ink, 0); },
  piston(ctx, s, spin = 0, on = 0){ box(ctx, -s * .3, -s * .1, s * .6, s * .6, s * .12, PAL.piston, LW); box(ctx, -s * .12, -s * .5 - s * .45 * on, s * .24, s * .5 + s * .45 * on, s * .04, shade(PAL.piston, .7), 0.02); box(ctx, -s * .22, -s * .56 - s * .45 * on, s * .44, s * .14, s * .04, PAL.ink, 0); },
  rotor(ctx, s, spin = 0){ disc(ctx, 0, 0, s * .46, PAL.rotor, LW); ctx.save(); ctx.rotate(spin); for(let i = 0; i < 3; i++){ ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * .1, -s * .46); ctx.lineTo(-s * .1, -s * .46); ctx.closePath(); blob(ctx, PAL.rotorBlade, 0); } ctx.restore(); disc(ctx, 0, 0, s * .12, PAL.hub, 0.02); },
  oil(ctx, s){ box(ctx, -s * .4, -s * .3, s * .8, s * .8, s * .14, PAL.oil, LW); box(ctx, -s * .14, -s / 2, s * .28, s * .22, s * .05, shade(PAL.oil, .6), 0); ctx.fillStyle = rgba(0xffffff, .25); ctx.beginPath(); ctx.ellipse(-s * .14, s * .1, s * .1, s * .2, 0, 0, 7); ctx.fill(); },
  smoke(ctx, s){ box(ctx, -s * .36, -s * .2, s * .72, s * .7, s * .12, PAL.smoke, LW); for(const [x, y, r] of [[-.16, -.34, .16], [.1, -.4, .2], [.3, -.28, .13]]) disc(ctx, x * s, y * s, r * s, 0xfafaf5, 0.02); },
  spikes(ctx, s){ box(ctx, -s / 2, 0, s, s * .5, s * .1, PAL.spikes, LW); ctx.fillStyle = hex(PAL.spikeTip); for(let i = 0; i < 5; i++){ const x = -s * .4 + i * s * .2; ctx.beginPath(); ctx.moveTo(x - s * .08, s * .02); ctx.lineTo(x, -s * .5); ctx.lineTo(x + s * .08, s * .02); ctx.closePath(); ctx.fill(); ctx.lineWidth = 0.02; ctx.strokeStyle = hex(shade(PAL.spikes, .6)); ctx.stroke(); } },
  ram(ctx, s){ box(ctx, -s / 2, -s * .1, s, s * .6, s * .1, PAL.ram, LW); box(ctx, -s * .46, -s * .5, s * .92, s * .46, s * .12, shade(PAL.ram, .8), 0.03); ctx.fillStyle = hex(tint(PAL.ram, .4)); for(let i = 0; i < 4; i++){ rrect(ctx, -s * .38 + i * s * .22, -s * .4, s * .1, s * .26, s * .03); ctx.fill(); } },
  caltrops(ctx, s){ box(ctx, -s * .4, -s * .4, s * .8, s * .8, s * .14, shade(PAL.caltrop, 1.3), LW); for(const [x, y] of [[-.15, -.12], [.18, -.05], [0, .2]]){ ctx.strokeStyle = hex(PAL.caltrop); ctx.lineWidth = 0.035; ctx.lineCap = 'round'; for(let i = 0; i < 4; i++){ const a = i * Math.PI / 2 + .6; ctx.beginPath(); ctx.moveTo(x * s, y * s); ctx.lineTo(x * s + Math.cos(a) * s * .14, y * s + Math.sin(a) * s * .14); ctx.stroke(); } } },
  banana(ctx, s){ ctx.beginPath(); ctx.moveTo(-s * .38, -s * .1); ctx.quadraticCurveTo(0, s * .55, s * .4, -s * .2); ctx.quadraticCurveTo(s * .1, s * .2, -s * .3, -s * .28); ctx.closePath(); blob(ctx, PAL.banana, LW, PAL.bananaDark); disc(ctx, s * .38, -s * .22, s * .05, PAL.bananaDark, 0); },
  hook(ctx, s){ box(ctx, -s * .3, -s * .05, s * .6, s * .5, s * .1, PAL.hook, LW); ctx.lineWidth = s * .1; ctx.strokeStyle = hex(shade(PAL.hook, .7)); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, -s * .2, s * .18, -Math.PI * .1, Math.PI * 1.1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -s * .38); ctx.lineTo(0, -s * .05); ctx.stroke(); },
  flag(ctx, s, t = 0){ ctx.lineWidth = s * .07; ctx.strokeStyle = hex(PAL.ink); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-s * .3, s * .4); ctx.lineTo(-s * .3, -s * .45); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * .28, -s * .45); for(let i = 0; i <= 6; i++){ const x = -s * .28 + i * s * .12; ctx.lineTo(x, -s * .45 + Math.sin(t * 6 + i) * s * .03); } for(let i = 6; i >= 0; i--){ const x = -s * .28 + i * s * .12; ctx.lineTo(x, -s * .05 + Math.sin(t * 6 + i + 1) * s * .03); } ctx.closePath(); blob(ctx, PAL.flag, 0.02, shade(PAL.flag, .7)); },
  numplate(ctx, s){ box(ctx, -s / 2 + 0.01, -s * .22, s - 0.02, s * .44, s * .06, PAL.numplate, LW); },
  antenna(ctx, s){ disc(ctx, 0, s * .15, s * .28, PAL.antenna, LW); disc(ctx, 0, s * .15, s * .1, PAL.hub, 0); },
  horn(ctx, s){ ctx.beginPath(); ctx.moveTo(-s * .2, s * .3); ctx.lineTo(s * .05, -s * .45); ctx.lineTo(s * .45, -s * .35); ctx.lineTo(s * .15, s * .4); ctx.closePath(); blob(ctx, PAL.horn, LW, shade(PAL.horn, .7)); disc(ctx, -s * .22, s * .34, s * .14, PAL.ink, 0); },
  sensespeed(ctx, s){ box(ctx, -s / 2, -s / 2, s, s, s * .18, PAL.sensor, LW); disc(ctx, 0, s * .05, s * .3, PAL.paper, 0.02); ctx.strokeStyle = hex(PAL.red); ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(0, s * .05); ctx.lineTo(s * .18, -s * .16); ctx.stroke(); disc(ctx, 0, s * .42, s * .07, PAL.wire, 0); },
  senseprox(ctx, s){ box(ctx, -s / 2, -s / 2, s, s, s * .18, PAL.sensor, LW); ctx.strokeStyle = hex(PAL.paper); ctx.lineWidth = 0.03; for(let r = 1; r <= 3; r++){ ctx.beginPath(); ctx.arc(0, s * .2, s * .13 * r, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); } disc(ctx, 0, s * .2, s * .06, PAL.paper, 0); disc(ctx, 0, s * .42, s * .07, PAL.wire, 0); },
  and(ctx, s){ gate(ctx, s, 'AND'); }, or(ctx, s){ gate(ctx, s, 'OR'); }, not(ctx, s){ gate(ctx, s, 'NOT'); }, nor(ctx, s){ gate(ctx, s, 'NOR'); },
  panel(ctx, s){ ctx.beginPath(); ctx.moveTo(-s * .45, s * .4); ctx.lineTo(-s * .3, -s * .42); ctx.lineTo(s * .42, -s * .2); ctx.lineTo(s * .3, s * .44); ctx.closePath(); blob(ctx, PAL.panel, LW, shade(PAL.panel, .7)); },
  lead(ctx, s){ box(ctx, -s / 2, -s / 2, s, s, s * .1, PAL.lead, LW); box(ctx, -s * .34, -s * .2, s * .68, s * .4, s * .06, shade(PAL.lead, .85), 0); txt(ctx, 'Pb', s * .3, tint(PAL.lead, .4), s * .02); },
  foam(ctx, s){ box(ctx, -s / 2, -s / 2, s, s, s * .3, PAL.foam, LW); for(let i = 0; i < 6; i++){ const a = i * 2.4; disc(ctx, Math.cos(a) * s * .25, Math.sin(a) * s * .25, s * .07, tint(PAL.foam, .5), 0); } },
  plate(ctx, s){ box(ctx, -s / 2, -s / 2, s, s, s * .08, PAL.plate, LW); box(ctx, -s * .38, -s * .38, s * .76, s * .76, s * .05, tint(PAL.plate, .12), 0.02); for(const [x, y] of [[-.35, -.35], [.35, -.35], [-.35, .35], [.35, .35]]) disc(ctx, x * s, y * s, s * .06, shade(PAL.plate, .7), 0); },
  bumper(ctx, s){ box(ctx, -s / 2, -s / 2, s, s, s * .28, PAL.bumper, LW); box(ctx, -s * .4, -s * .12, s * .8, s * .24, s * .06, PAL.pad, 0); ctx.fillStyle = hex(PAL.bumper); for(let i = 0; i < 4; i++) ctx.fillRect(-s * .36 + i * s * .2, -s * .12, s * .08, s * .24); },
  fin(ctx, s){ ctx.beginPath(); ctx.moveTo(0, -s / 2 + 0.02); ctx.lineTo(s * .18, s / 2 - 0.02); ctx.lineTo(-s * .18, s / 2 - 0.02); ctx.closePath(); blob(ctx, PAL.fin, LW); },
  // aero shapes: forward = up. wedge/curve fill the bottom-left with the slant/curve facing up-right (rot 0 = front-right corner; R rotates)
  nose(ctx, s){ ctx.beginPath(); ctx.moveTo(0, -s / 2 + 0.02); ctx.lineTo(s / 2 - 0.02, s / 2 - 0.02); ctx.lineTo(-s / 2 + 0.02, s / 2 - 0.02); ctx.closePath(); blob(ctx, PAL.aero, LW); ctx.beginPath(); ctx.moveTo(0, -s * .3); ctx.lineTo(0, s * .4); ctx.lineWidth = LW; ctx.strokeStyle = hex(tint(PAL.aero, .5)); ctx.stroke(); },
  wedge(ctx, s){ ctx.beginPath(); ctx.moveTo(-s / 2 + 0.02, -s / 2 + 0.02); ctx.lineTo(s / 2 - 0.02, s / 2 - 0.02); ctx.lineTo(-s / 2 + 0.02, s / 2 - 0.02); ctx.closePath(); blob(ctx, PAL.aero, LW); ctx.beginPath(); ctx.moveTo(-s * .3, -s * .1); ctx.lineTo(s * .1, s * .3); ctx.lineWidth = LW; ctx.strokeStyle = hex(tint(PAL.aero, .5)); ctx.stroke(); },
  curve(ctx, s){ ctx.beginPath(); ctx.moveTo(-s / 2 + 0.02, -s / 2 + 0.02); ctx.arc(-s / 2 + 0.02, s / 2 - 0.02, s - 0.04, -Math.PI / 2, 0); ctx.lineTo(-s / 2 + 0.02, s / 2 - 0.02); ctx.closePath(); blob(ctx, PAL.aero, LW); ctx.beginPath(); ctx.arc(-s / 2, s / 2, s * 0.62, -Math.PI / 2, 0); ctx.lineWidth = LW; ctx.strokeStyle = hex(tint(PAL.aero, .5)); ctx.stroke(); },
  wing(ctx, s){
    for(const sx of [-1, 1]) box(ctx, sx * s * .3 - s * .05, -s * .4, s * .1, s * .6, s * .04, PAL.wingDark, 0);   // struts
    box(ctx, -s / 2, s * .05, s, s * .32, s * .12, PAL.wing, LW);                          // the plane (back)
    box(ctx, -s * .4, s * .1, s * .8, s * .08, s * .04, tint(PAL.wingDark, .4), 0);
  },
};

/* Part defs.
   fp      — footprint in grid cells [w, d]        mass — real weight (centre of mass, inertia, wheel loads)
   facing  — part cares about its rotation           shear — impulse needed to knock it off
   bind    — default key (e.code) that drives it; right-click the placed block to change it
   art     — assets/parts/<art>.svg (falls back along `alt`)      tip — the tooltip (Adam's humour rule) */
export const PARTS = {
  // ---- frames ----
  frame1:  { label: '1×1',    key: '1', cat: 'frame',    fp: [1, 1], mass: 0.3, color: PAL.frame,   shear: 26, art: 'frame1', alt: 'frame', draw: DRAW.frame },
  frame:   { label: '2×2',    key: '2', cat: 'frame',    fp: [2, 2], mass: 1.0, color: PAL.frame,   shear: 30, art: 'frame',  draw: DRAW.frame },
  frame3:  { label: '3×3',    key: '3', cat: 'frame',    fp: [3, 3], mass: 2.2, color: PAL.frame,   shear: 36, art: 'frame3', alt: 'frame', draw: DRAW.frame },
  lead:    { label: 'LEAD',    key: '', cat: 'frame',    fp: [2, 2], mass: 4.0,  color: PAL.lead,    shear: 60, art: 'lead',    draw: DRAW.lead, tip: 'heavy. that is the whole idea.' },
  foam:    { label: 'FOAM',    key: '', cat: 'frame',    fp: [2, 2], mass: 0.25, color: PAL.foam,    shear: 14, art: 'foam',    draw: DRAW.foam, tip: 'weighs nothing, breaks if you look at it' },
  plate:   { label: 'PLATE',   key: '', cat: 'frame',    fp: [2, 2], mass: 2.0,  color: PAL.plate,   shear: 80, art: 'plate',   draw: DRAW.plate, tip: 'armour. does not come off. ever.' },
  bumper:  { label: 'BUMPER',  key: '', cat: 'frame',    fp: [2, 2], mass: 1.0,  color: PAL.bumper,  shear: 50, art: 'bumper',  draw: DRAW.bumper, bumper: true, tip: 'soaks up half a hit next to it' },
  // ---- body ----
  panel:   { label: 'PANEL',  key: '', cat: 'body',     fp: [1, 1], mass: 0.15, color: PAL.panel,   shear: 30, art: 'panel',  draw: DRAW.panel, custom: true, panel: true, aero: 'panel', noContour: true, tip: 'draw your own shape. paint it. hide the engine.' },
  // ---- seats ----
  seat:    { label: 'SEAT',   key: '4', cat: 'seat',     fp: [2, 2], mass: 0.8, color: PAL.seat,    shear: 34, art: 'seat',   draw: DRAW.seat },
  // ---- wheels: 3 sizes × 4 compounds (+ caster) ----
  wheel1:  { label: 'WHEEL S', key: '', cat: 'wheel',  fp: [1, 1], mass: 0.35, color: PAL.wheel,   shear: 14, art: 'wheel1',  alt: 'wheel', draw: DRAW.wheel, wheel: { road: 1, off: 1, steer: true, k: 0.8 } },
  wheel:   { label: 'WHEEL',  key: '5', cat: 'wheel',    fp: [2, 2], mass: 0.9, color: PAL.wheel,   shear: 16, art: 'wheel',  draw: DRAW.wheel, wheel: { road: 1, off: 1, steer: true, k: 1 } },   // pops off easiest
  wheel3:  { label: 'WHEEL L', key: '', cat: 'wheel',  fp: [3, 3], mass: 1.9, color: PAL.wheel,   shear: 20, art: 'wheel3',  alt: 'wheel', draw: DRAW.wheel, wheel: { road: 1, off: 1, steer: true, k: 1.2 } },
  slick1:  { label: 'SLICK S', key: '', cat: 'wheel',  fp: [1, 1], mass: 0.3,  color: PAL.slick,   shear: 14, art: 'slick1',  alt: 'slick', draw: DRAW.slick, wheel: { road: 1.3, off: 0.55, steer: true, k: 0.8 } },
  slick:   { label: 'SLICK',   key: '', cat: 'wheel',    fp: [2, 2], mass: 0.8,  color: PAL.slick,   shear: 16, art: 'slick',   draw: DRAW.slick, wheel: { road: 1.3, off: 0.55, steer: true, k: 1 }, tip: 'asphalt: yes. grass: no.' },
  slick3:  { label: 'SLICK L', key: '', cat: 'wheel',  fp: [3, 3], mass: 1.8,  color: PAL.slick,   shear: 20, art: 'slick3',  alt: 'slick', draw: DRAW.slick, wheel: { road: 1.3, off: 0.55, steer: true, k: 1.2 } },
  knobby1: { label: 'OFF-ROAD S', key: '', cat: 'wheel', fp: [1, 1], mass: 0.4, color: PAL.knobby, shear: 14, art: 'knobby1', alt: 'knobby', draw: DRAW.knobby, wheel: { road: 0.9, off: 1.6, steer: true, k: 0.8 } },
  knobby:  { label: 'OFF-ROAD', key: '', cat: 'wheel',  fp: [2, 2], mass: 1.0,  color: PAL.knobby,  shear: 16, art: 'knobby',  draw: DRAW.knobby, wheel: { road: 0.9, off: 1.6, steer: true, k: 1 } },
  monster: { label: 'MONSTER', key: '', cat: 'wheel',    fp: [3, 3], mass: 2.2,  color: PAL.monster, shear: 26, art: 'monster', draw: DRAW.monster, wheel: { road: 0.9, off: 1.6, steer: true, k: 1.2 }, tip: 'grass, gravel, sand, your friend' },
  spike1:  { label: 'SPIKED S', key: '', cat: 'wheel', fp: [1, 1], mass: 0.4,  color: PAL.spike,   shear: 14, art: 'spike1',  alt: 'spike', draw: DRAW.spike, wheel: { road: 0.75, off: 1.45, steer: true, k: 0.8, spiked: true } },
  spike:   { label: 'SPIKED',  key: '', cat: 'wheel',    fp: [2, 2], mass: 1.0,  color: PAL.spike,   shear: 16, art: 'spike',   draw: DRAW.spike, wheel: { road: 0.75, off: 1.45, steer: true, k: 1, spiked: true }, tip: 'bites grass + ice, eats asphalt' },
  spike3:  { label: 'SPIKED L', key: '', cat: 'wheel', fp: [3, 3], mass: 2.1,  color: PAL.spike,   shear: 20, art: 'spike3',  alt: 'spike', draw: DRAW.spike, wheel: { road: 0.75, off: 1.45, steer: true, k: 1.2, spiked: true } },
  caster:  { label: 'CASTER',  key: '', cat: 'wheel',    fp: [1, 1], mass: 0.25, color: PAL.caster,  shear: 14, art: 'caster',  draw: DRAW.caster, wheel: { road: 0.7, off: 0.5, steer: false, k: 0.7 }, tip: 'shopping cart energy' },
  brake:   { label: 'BRAKE',   key: '', cat: 'wheel',    fp: [1, 1], mass: 0.4,  color: PAL.brake,   shear: 24, art: 'brake',   draw: DRAW.brake, brake: true, bind: 'Space', amount: 1, tip: 'pick its wheels · 100% = handbrake slide' },
  // ---- engine ----
  putt:    { label: 'PUTT',    key: '', cat: 'engine',   fp: [1, 1], mass: 0.6,  color: PAL.putt,    shear: 26, art: 'putt',    draw: DRAW.putt, engine: { power: 0.45, burn: 0.4, needs: 0 }, tip: 'lawnmower. sips fuel. hums.' },
  engine:  { label: 'ENGINE', key: '6', cat: 'engine',   fp: [2, 2], mass: 1.6, color: PAL.engine,  shear: 40, art: 'engine', draw: DRAW.engine, engine: { power: 1, burn: 1, needs: 0 } },
  v8:      { label: 'V8',      key: '', cat: 'engine',   fp: [3, 3], mass: 4.0,  color: PAL.v8,      shear: 50, art: 'v8',      draw: DRAW.v8, engine: { power: 2.4, burn: 2.2, needs: 1 }, tip: 'needs one intake breathing' },
  jet:     { label: 'JET',     key: '', cat: 'engine',   fp: [3, 3], mass: 3.6,  color: PAL.jet,     shear: 46, art: 'jet',     draw: DRAW.jet, facing: true, engine: { power: 3.2, burn: 3.2, needs: 1, jet: true }, tip: 'pushes. no wheels needed. spools up slow.' },
  turbo:   { label: 'TURBO',   key: '', cat: 'engine',   fp: [2, 2], mass: 0.9,  color: PAL.turbo,   shear: 30, art: 'turbo',   draw: DRAW.turbo, facing: true, turbo: true, tip: '+35% per engine, wants clear air' },
  tank:    { label: 'FUEL',   key: '7', cat: 'engine',   fp: [2, 2], mass: 1.2, color: PAL.tank,    shear: 34, art: 'tank',   draw: DRAW.tank, fuel: 100 },
  jerry:   { label: 'JERRYCAN', key: '', cat: 'engine',  fp: [1, 1], mass: 0.4,  color: PAL.jerry,   shear: 20, art: 'jerry',   draw: DRAW.jerry, fuel: 40, tip: 'do NOT shake' },
  intake:  { label: 'INTAKE', key: '8', cat: 'engine',   fp: [2, 2], mass: 0.6, color: PAL.intake,  shear: 26, art: 'intake', draw: DRAW.intake, facing: true, tip: 'V8 + JET need one · every engine likes one' },
  // ---- electric ----
  battery: { label: 'BATT',   key: '9', cat: 'electric', fp: [2, 2], mass: 1.3, color: PAL.battery, shear: 34, art: 'battery', draw: DRAW.battery, batt: 100 },
  bigbatt: { label: 'BIG BATT', key: '', cat: 'electric', fp: [3, 3], mass: 3.2, color: PAL.bigbatt, shear: 44, art: 'bigbatt', draw: DRAW.bigbatt, batt: 320 },
  motor:   { label: 'MOTOR',  key: '0', cat: 'electric', fp: [2, 2], mass: 1.1, color: PAL.motor,   shear: 36, art: 'motor',  draw: DRAW.motor, motor: true },
  fan:     { label: 'FAN',    key: '',  cat: 'electric', fp: [2, 2], mass: 0.7, color: PAL.fan,     shear: 24, art: 'fan',    draw: DRAW.fan, facing: true },
  solar:   { label: 'SOLAR',   key: '', cat: 'electric', fp: [2, 2], mass: 0.7,  color: PAL.solar,   shear: 22, art: 'solar',   draw: DRAW.solar, solar: 1.2, tip: 'the sun is always out in kRacing' },
  // ---- thrust ----
  rocket:  { label: 'ROCKET',  key: '', cat: 'thrust',   fp: [2, 2], mass: 1.0,  color: PAL.rocket,  shear: 30, art: 'rocket',  draw: DRAW.rocket, facing: true, thrust: { f: 1, fuel: 3 }, bind: 'KeyR', tip: 'hold R. works mid-air. point it sideways, I dare you' },
  ion:     { label: 'ION',     key: '', cat: 'thrust',   fp: [1, 2], mass: 0.5,  color: PAL.ion,     shear: 22, art: 'ion',     draw: DRAW.ion, facing: true, thrust: { f: 0.3, batt: 3 }, bind: 'KeyR', tip: 'weak, steady, runs on battery' },
  // ---- aero ----
  wing:    { label: 'WING',   key: '',  cat: 'aero',     fp: [2, 2], mass: 0.5, color: PAL.wing,    shear: 22, art: 'wing',   draw: DRAW.wing, facing: true },
  nose:    { label: 'NOSE',   key: '',  cat: 'aero',     fp: [2, 2], mass: 0.6, color: PAL.aero,    shear: 28, art: 'nose',   draw: DRAW.nose, facing: true, aero: 'nose', noContour: true },
  wedge:   { label: 'WEDGE',  key: '',  cat: 'aero',     fp: [2, 2], mass: 0.6, color: PAL.aero,    shear: 28, art: 'wedge',  draw: DRAW.wedge, facing: true, aero: 'wedge', noContour: true },
  curve:   { label: 'CURVE',  key: '',  cat: 'aero',     fp: [2, 2], mass: 0.6, color: PAL.aero,    shear: 28, art: 'curve',  draw: DRAW.curve, facing: true, aero: 'curve', noContour: true },
  fin:     { label: 'FIN',     key: '', cat: 'aero',     fp: [1, 1], mass: 0.2,  color: PAL.fin,     shear: 18, art: 'fin',     draw: DRAW.fin, facing: true, fin: true, noContour: true, tip: 'stops the spinning. mostly.' },
  // ---- mech ----
  hinge:   { label: 'HINGE',   key: '', cat: 'mech',     fp: [1, 1], mass: 0.3,  color: PAL.hinge,   shear: 40, art: 'hinge',   draw: DRAW.hinge, facing: true, hinge: true, tip: 'whatever is AHEAD of it swings free — trailers, whips, jackknives' },
  piston:  { label: 'PISTON',  key: '', cat: 'mech',     fp: [1, 2], mass: 0.6,  color: PAL.piston,  shear: 32, art: 'piston',  draw: DRAW.piston, facing: true, piston: true, bind: 'KeyF', tip: 'F = punch. walls punch back.' },
  rotor:   { label: 'ROTOR',   key: '', cat: 'mech',     fp: [2, 2], mass: 1.2,  color: PAL.rotor,   shear: 34, art: 'rotor',   draw: DRAW.rotor, rotor: true, bind: 'KeyG', amount: 1, tip: 'G = spin. saws things. two of them can HOP.' },
  // ---- gadgets (room toggle) ----
  oil:     { label: 'OIL',     key: '', cat: 'gadget',   fp: [1, 1], mass: 0.4,  color: PAL.oil,     shear: 20, art: 'oil',     draw: DRAW.oil, gadget: 'oil', ammo: 3, bind: 'Digit1', tip: '1 = drop a slick behind you. 3 per can.' },
  smoke:   { label: 'SMOKE',   key: '', cat: 'gadget',   fp: [1, 1], mass: 0.4,  color: PAL.smoke,   shear: 20, art: 'smoke',   draw: DRAW.smoke, gadget: 'smoke', ammo: 6, bind: 'Digit2', tip: 'hold 2 = they can\'t see you. 6 seconds a can.' },
  spikes:  { label: 'SPIKES',  key: '', cat: 'gadget',   fp: [2, 1], mass: 0.6,  color: PAL.spikes,  shear: 36, art: 'spikes',  draw: DRAW.spikes, facing: true, spikes: true, tip: 'whoever touches these loses a block' },
  ram:     { label: 'RAM PLATE', key: '', cat: 'gadget', fp: [2, 1], mass: 1.4,  color: PAL.ram,     shear: 70, art: 'ram',     draw: DRAW.ram, facing: true, ram: true, tip: 'your hits ×2, theirs ×½' },
  caltrops:{ label: 'CALTROPS', key: '', cat: 'gadget',  fp: [1, 1], mass: 0.5,  color: PAL.caltrop, shear: 20, art: 'caltrops', draw: DRAW.caltrops, gadget: 'caltrops', ammo: 3, bind: 'Digit3', tip: '3 = drop spikies. flat tyres till Q / pit.' },
  banana:  { label: 'BANANA',  key: '', cat: 'gadget',   fp: [1, 1], mass: 0.2,  color: PAL.banana,  shear: 12, art: 'banana',  draw: DRAW.banana, gadget: 'banana', ammo: 3, bind: 'Digit4', aero: 'banana', noContour: true, tip: '4 = ??? · hold 4 = ???' },
  // ---- tools ----
  hook:    { label: 'TOW HOOK', key: '', cat: 'tool',    fp: [1, 1], mass: 0.5,  color: PAL.hook,    shear: 34, art: 'hook',    draw: DRAW.hook, facing: true, hook: true, bind: 'KeyC', tip: 'C near a machine = rope. C again = let go.' },
  // ---- decor ----
  flag:    { label: 'FLAG',    key: '', cat: 'decor',    fp: [1, 1], mass: 0.15, color: PAL.flag,    shear: 16, art: 'flag',    draw: DRAW.flag, flag: true, noContour: true, paint: true, tip: 'waves. that is all. that is enough.' },
  numplate:{ label: 'NUMBER PLATE', key: '', cat: 'decor', fp: [2, 1], mass: 0.2, color: PAL.numplate, shear: 18, art: 'numplate', draw: DRAW.numplate, text: true, tip: 'your name / number / threat' },
  antenna: { label: 'ANTENNA', key: '', cat: 'decor',    fp: [1, 1], mass: 0.1,  color: PAL.antenna, shear: 14, art: 'antenna', draw: DRAW.antenna, antenna: true, noContour: true, tip: 'wobbles when you do' },
  horn:    { label: 'HORN',    key: '', cat: 'decor',    fp: [1, 1], mass: 0.2,  color: PAL.horn,    shear: 18, art: 'horn',    draw: DRAW.horn, horn: true, bind: 'KeyH', tip: 'H. everyone hears it. everyone.' },
  // ---- logic: sensors carry their own threshold and wire straight into a block ----
  sensespeed:{ label: 'SPEED SENSOR', key: '', cat: 'logic', fp: [1, 1], mass: 0.2, color: PAL.sensor, shear: 20, art: 'sensespeed', draw: DRAW.sensespeed, sensor: 'speed', thr: 60, op: '>', tip: 'speed > 60 → wire it to a brake = pit limiter' },
  senseprox: { label: 'PROXIMITY', key: '', cat: 'logic', fp: [1, 1], mass: 0.2, color: PAL.sensor, shear: 20, art: 'senseprox', draw: DRAW.senseprox, sensor: 'prox', thr: 6, op: '<', tip: 'something within 6 → fires' },
  and:     { label: 'AND',     key: '', cat: 'logic',    fp: [1, 1], mass: 0.15, color: PAL.gate,    shear: 20, art: 'and',     draw: DRAW.and, gate: 'and', tip: 'all wired inputs on' },
  or:      { label: 'OR',      key: '', cat: 'logic',    fp: [1, 1], mass: 0.15, color: PAL.gate,    shear: 20, art: 'or',      draw: DRAW.or, gate: 'or', tip: 'any wired input on' },
  not:     { label: 'NOT',     key: '', cat: 'logic',    fp: [1, 1], mass: 0.15, color: PAL.gate,    shear: 20, art: 'not',     draw: DRAW.not, gate: 'not', tip: 'input off → on' },
  nor:     { label: 'NOR',     key: '', cat: 'logic',    fp: [1, 1], mass: 0.15, color: PAL.gate,    shear: 20, art: 'nor',     draw: DRAW.nor, gate: 'nor', tip: 'nothing on → on' },
};
export const PART_ORDER = [
  'frame1', 'frame', 'frame3', 'lead', 'foam', 'plate', 'bumper',
  'panel', 'seat',
  'wheel1', 'wheel', 'wheel3', 'slick1', 'slick', 'slick3', 'knobby1', 'knobby', 'monster', 'spike1', 'spike', 'spike3', 'caster', 'brake',
  'putt', 'engine', 'v8', 'jet', 'turbo', 'tank', 'jerry', 'intake',
  'battery', 'bigbatt', 'motor', 'fan', 'solar',
  'rocket', 'ion',
  'wing', 'nose', 'wedge', 'curve', 'fin',
  'hinge', 'piston', 'rotor',
  'oil', 'smoke', 'spikes', 'ram', 'caltrops', 'banana',
  'hook',
  'flag', 'numplate', 'antenna', 'horn',
  'sensespeed', 'senseprox', 'and', 'or', 'not', 'nor',
];
/* is this part something a key / a wire can drive? */
export function isDrivable(def){ return !!(def.bind || def.engine || def.motor || def.gadget || def.thrust || def.piston || def.rotor || def.brake || def.horn || def.hook || def.gate); }

/* footprint helpers — `p` (the placed part) matters for PANELS, whose cells are their own */
export function fpOf(type, p){
  if(p && p.cfg && p.cfg.cells){ let mi = 0, mj = 0; for(const [a, b] of p.cfg.cells){ if(a > mi) mi = a; if(b > mj) mj = b; } return [mi + 1, mj + 1]; }
  return PARTS[type].fp || [2, 2];
}
export function sizeOf(type, p){ const [w, d] = fpOf(type, p); return [w * CELL, d * CELL]; }
// machine-local centre (before the centre offset) of a part anchored at cell (i,j) — panels: centroid of their cells
export function localCenterOf(i, j, type, p){
  if(p && p.cfg && p.cfg.cells){ let sa = 0, sb = 0; for(const [a, b] of p.cfg.cells){ sa += a; sb += b; } const n = p.cfg.cells.length || 1; return { x: (i + sa / n) * CELL, y: (j + sb / n) * CELL }; }
  const [w, d] = fpOf(type);
  return { x: (i + (w - 1) / 2) * CELL, y: (j + (d - 1) / 2) * CELL };
}
// every cell a part covers, from its anchor (on its layer)
export function* cellsOf(i, j, type, l = 0, p = null){
  if(p && p.cfg && p.cfg.cells){ for(const [a, b] of p.cfg.cells) yield [i + a, j + b, l]; return; }
  const [w, d] = fpOf(type);
  for(let a = 0; a < w; a++) for(let b = 0; b < d; b++) yield [i + a, j + b, l];
}
export function cellCount(type, p){ if(p && p.cfg && p.cfg.cells) return p.cfg.cells.length; const [w, d] = fpOf(type); return w * d; }
export function massOf(type, p){ const def = PARTS[type]; return def.custom ? def.mass * cellCount(type, p) : def.mass; }
// facing direction of a rotated part, in grid steps (rot 0 = up = forward)
export function facingDir(rot){ return [[0, -1], [1, 0], [0, 1], [-1, 0]][rot & 3]; }

/* PANEL geometry: poly points in cell units (cell (a,b) is centred on (a,b)); a cell is covered
   when its centre is inside. Returns { cells (offsets from the min cell), poly (shifted), i0, j0 }. */
export function panelFromPoly(poly){
  if(!poly || poly.length < 3) return null;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for(const [x, y] of poly){ if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; }
  const cells = [];
  for(let a = Math.floor(x0); a <= Math.ceil(x1); a++) for(let b = Math.floor(y0); b <= Math.ceil(y1); b++) if(pointInPoly(a, b, poly)) cells.push([a, b]);
  if(!cells.length) return null;
  let i0 = 1e9, j0 = 1e9; for(const [a, b] of cells){ if(a < i0) i0 = a; if(b < j0) j0 = b; }
  return { i0, j0, cells: cells.map(([a, b]) => [a - i0, b - j0]), poly: poly.map(([x, y]) => [+(x - i0).toFixed(2), +(y - j0).toFixed(2)]) };
}
export function pointInPoly(x, y, poly){
  let inside = false;
  for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if(((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

/* draw one part centred on the origin (caller translated). rot = quarter turns.
   inst (optional): { p, t, on, text, color } — the placed part + live state (flame on, flag time…) */
export function drawPart(ctx, type, rot = 0, zoom = 40, alpha = 1, spin = 0, steer = 0, inst = null){
  const def = PARTS[type]; if(!def) return;
  const p = inst && inst.p;
  if(def.panel && p && p.cfg && p.cfg.cells){ drawPanel(ctx, p, alpha, inst); return; }
  const [w, d] = sizeOf(type, p);
  ctx.save();
  ctx.rotate(rot * Math.PI / 2 + steer);
  // contour: every block reads as a block (aero shapes carry their own outline)
  if(!def.noContour){ rrect(ctx, -w / 2 + 0.01, -d / 2 + 0.01, w - 0.02, d - 0.02, 0.06);
    ctx.lineWidth = 0.05; ctx.strokeStyle = hex(shade(def.color, .55)); if(alpha < 1) ctx.globalAlpha *= alpha; ctx.stroke(); if(alpha < 1) ctx.globalAlpha /= alpha; }
  let key = 'parts/' + def.art;
  if(!hasArt(key) && def.alt) key = 'parts/' + def.alt;
  const on = inst && inst.on ? inst.on : 0;
  if(!art(ctx, key, w, d, zoom, alpha) || on > 0){
    if(alpha < 1) ctx.globalAlpha *= alpha;
    if(hasArt(key)){ /* art drew the body; add live bits only */ if(def.thrust || (def.engine && def.engine.jet)) drawFlame(ctx, Math.max(w, d), on); }
    else def.draw(ctx, Math.max(w, d), def.flag ? (inst && inst.t || 0) : spin, on);
  }
  // live text (number plate)
  if(def.text){ const s = inst && inst.text != null ? String(inst.text) : (p && p.cfg && p.cfg.text) || ''; if(s){ if(alpha < 1) ctx.globalAlpha *= alpha; ctx.fillStyle = hex(PAL.ink); ctx.font = `900 ${Math.min(0.2, 0.5 / Math.max(2, s.length))}px Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.slice(0, 8), 0, 0.01); } }
  ctx.restore();
}
function drawFlame(ctx, s, on){ ctx.beginPath(); ctx.moveTo(-s * .18, s * .48); ctx.lineTo(0, s * (.5 + .9 * on)); ctx.lineTo(s * .18, s * .48); ctx.closePath(); blob(ctx, PAL.jetGlow, 0); }
function drawPanel(ctx, p, alpha, inst){
  const cells = p.cfg.cells, poly = p.cfg.poly; if(!poly) return;
  let sa = 0, sb = 0; for(const [a, b] of cells){ sa += a; sb += b; } const n = cells.length || 1;
  const ox = -sa / n * CELL, oy = -sb / n * CELL;           // anchor cell centre, relative to the centroid (where we are)
  const col = (inst && inst.color) || (p.cfg.color != null ? p.cfg.color : PAL.panel);
  ctx.save(); if(alpha < 1) ctx.globalAlpha *= alpha;
  ctx.beginPath();
  poly.forEach(([x, y], i) => { const px = ox + x * CELL, py = oy + y * CELL; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
  ctx.closePath(); blob(ctx, col, 0.045, shade(col, .7));
  // a soft highlight along the first edge so it reads as a skin, not a flat sticker
  if(poly.length >= 2){ ctx.lineWidth = 0.03; ctx.strokeStyle = rgba(0xffffff, 0.35); ctx.beginPath(); ctx.moveTo(ox + poly[0][0] * CELL, oy + poly[0][1] * CELL); ctx.lineTo(ox + poly[1][0] * CELL, oy + poly[1][1] * CELL); ctx.stroke(); }
  ctx.restore();
}

/* part icons for the ring: rendered once per part, cleared by T */
const ICONS = new Map();
export function partIcon(type){
  if(ICONS.has(type)) return ICONS.get(type);
  const N = 96, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const x = cv.getContext('2d');
  const scale = 84 / (3 * CELL);                    // shared scale: a 1×1 LOOKS smaller than a 3×3
  x.translate(N / 2, N / 2); x.scale(scale, scale);
  drawPart(x, type, 0, scale, 1, 0, 0, PARTS[type].text ? { text: '78' } : null);
  const url = cv.toDataURL(); ICONS.set(type, url); return url;
}
export function clearIcons(){ ICONS.clear(); }
