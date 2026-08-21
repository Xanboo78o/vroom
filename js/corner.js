/* =============================================================================
   corner.js — Kris's Corner: the cast + furniture, now ON the paddock apron.
     TOMATHY  horse-sized duck, saddle + saddle bag (Jimothy inside), his BREAD golf cart   [west]
     JIMOTHY  the goob raccoon, asleep in the bag
     DILLON   armadillo, runs DILLON'S 24/7 tire shop, rolls a tire back and forth         [east]
     CORVAL   otter, ALWAYS holding his coral, beside PLOWVAL the plow                      [east]
     KRIS     lost-in-the-woods human: statue ("got lost. got found.") + LAUGH + LIVE board
              [centre, under the garages]; commentary booth + grandstand on the infield
              across the main straight, his one rule: LAUGH
   Everything here is a sprite slot: assets/critters/<name>.svg, assets/props/<name>.svg.
   Until Adam draws them, the code-drawn fallbacks below stand in.
   ============================================================================= */
import { PAL, hex, shade, tint, rgba } from './palette.js';
import { box, disc, rrect, blob, art, shadow, label } from './draw.js';

const SPOTS = {
  tomathy: { x: -32, y: -212, a: Math.PI / 2 }, cart: { x: -36, y: -203.5, a: Math.PI / 2 },
  shop: { x: 34, y: -213 }, dillon: { x: 31, y: -216.5 },
  plowval: { x: 38, y: -204, a: -Math.PI * 0.75 }, corval: { x: 33, y: -207, a: -Math.PI * 0.6 },
  statue: { x: 0, y: -212 }, laugh: { x: 9, y: -212 }, live: { x: -10, y: -212 },
  grandstand: { x: -10, y: -155 }, booth: { x: -40, y: -154 },
  signs: [{ x: -56, y: -212, text: "DILLON'S 24/7", bg: PAL.pad, fg: PAL.text }, { x: 56, y: -212, text: 'BREAD', bg: PAL.bread, fg: PAL.breadDark },
          { x: -62, y: -150, text: 'coral facts by Corval', bg: PAL.otterBelly, fg: PAL.otter }, { x: 62, y: -150, text: 'PLOWVAL · we plow.', bg: PAL.plow, fg: PAL.paper }],
};

export function buildCorner(W, { wall }){
  wall(SPOTS.tomathy.x, SPOTS.tomathy.y, 2.4, 2.4, 1.6, PAL.duck, true);
  wall(SPOTS.cart.x, SPOTS.cart.y, 1.9, 1.9, 1.2, PAL.duck, true);
  wall(SPOTS.shop.x, SPOTS.shop.y, 1.6, 4.2, 2.4, PAL.pad, true);
  wall(SPOTS.plowval.x, SPOTS.plowval.y, 2.6, 2.6, 1.8, PAL.plow, true);
  wall(SPOTS.statue.x, SPOTS.statue.y, 1.8, 1.8, 2.6, PAL.plinth, true);
  wall(SPOTS.grandstand.x, SPOTS.grandstand.y, 20, 6, 2.7, PAL.stand, true);
  wall(SPOTS.booth.x, SPOTS.booth.y, 2.8, 2.2, 3.2, PAL.ink, true);
  wall(SPOTS.laugh.x, SPOTS.laugh.y, 2.2, 0.8, 1.2, PAL.red, true);
  wall(SPOTS.live.x, SPOTS.live.y, 4.2, 0.8, 1.2, PAL.cream, true);
  for(const s of SPOTS.signs) wall(s.x, s.y, 6, 1, 1.2, PAL.ink, true);
}

/* ---- fallback cast (top view, forward = up) ---------------------------------------- */
function eyes(ctx, x, y, dx, r = 0.07){ for(const s of [-1, 1]) disc(ctx, x + s * dx, y, r, PAL.mask, 0); }
function tomathy(ctx, t){
  ctx.save(); ctx.translate(0, Math.sin(t * 1.6) * 0.03);
  ctx.beginPath(); ctx.ellipse(0, 0.55, 0.5, 0.35, 0, 0, Math.PI * 2); blob(ctx, PAL.duck, 0.05);
  ctx.beginPath(); ctx.ellipse(0, 0, 0.68, 1.1, 0, 0, Math.PI * 2); blob(ctx, PAL.duck, 0.05);
  for(const s of [-1, 1]){ ctx.beginPath(); ctx.ellipse(s * 0.55, 0.1, 0.22, 0.5, s * 0.3, 0, Math.PI * 2); blob(ctx, shade(PAL.duck, .94), 0.04); }
  box(ctx, -0.45, -0.45, 0.9, 0.75, 0.12, PAL.leather, 0.04);
  box(ctx, -0.95, -0.1, 0.42, 0.5, 0.1, shade(PAL.leather, .9), 0.04);
  ctx.save(); ctx.translate(-0.74, 0.12); ctx.scale(0.55, 0.55); jimothy(ctx, t); ctx.restore();
  ctx.save(); ctx.translate(0, -1.05); ctx.rotate(Math.sin(t * 0.7) * 0.35);
  disc(ctx, 0, -0.15, 0.36, PAL.duck, 0.05);
  box(ctx, -0.17, -0.7, 0.34, 0.45, 0.12, PAL.beak, 0.04);
  eyes(ctx, 0, -0.2, 0.18);
  ctx.restore(); ctx.restore();
}
function jimothy(ctx, t){
  const br = 1 + Math.sin(t * 2.2) * 0.04;
  ctx.save(); ctx.scale(br, br);
  for(let i = 0; i < 3; i++) disc(ctx, 0.32 + i * 0.12, 0.3 + i * 0.1, 0.09, i % 2 ? PAL.mask : PAL.raccoon, 0);
  ctx.beginPath(); ctx.ellipse(0, 0.1, 0.34, 0.4, 0, 0, Math.PI * 2); blob(ctx, PAL.raccoon, 0.04);
  disc(ctx, 0, -0.3, 0.26, PAL.raccoon, 0.04);
  for(const s of [-1, 1]) disc(ctx, s * 0.2, -0.48, 0.09, PAL.mask, 0);
  box(ctx, -0.27, -0.36, 0.54, 0.16, 0.08, PAL.mask, 0);
  eyes(ctx, 0, -0.28, 0.11, 0.045);
  ctx.restore();
}
function dillon(ctx, t){
  ctx.beginPath(); ctx.ellipse(0, 0, 0.3, 0.42, 0, 0, Math.PI * 2); blob(ctx, PAL.armadillo, 0.04);
  for(let i = 0; i < 3; i++) box(ctx, -0.3, -0.2 + i * 0.16, 0.6, 0.07, 0.03, PAL.armadilloDark, 0);
  disc(ctx, 0, -0.5, 0.16, PAL.armadillo, 0.04); disc(ctx, 0, -0.64, 0.08, PAL.armadilloDark, 0);
  box(ctx, -0.04, 0.38, 0.08, 0.4, 0.04, PAL.armadilloDark, 0);
  eyes(ctx, 0, -0.5, 0.09, 0.035);
}
function corval(ctx, t){
  box(ctx, -0.1, 0.3, 0.2, 0.6, 0.1, PAL.otter, 0.04);
  ctx.beginPath(); ctx.ellipse(0, 0, 0.3, 0.42, 0, 0, Math.PI * 2); blob(ctx, PAL.otter, 0.04);
  disc(ctx, 0, -0.3, 0.26, PAL.otter, 0.04);
  for(const s of [-1, 1]) disc(ctx, s * 0.22, -0.44, 0.07, PAL.otter, 0.03);
  disc(ctx, 0, -0.2, 0.12, PAL.otterBelly, 0); disc(ctx, 0, -0.27, 0.04, PAL.mask, 0);
  eyes(ctx, 0, -0.36, 0.1, 0.04);
  ctx.save(); ctx.translate(0, -0.6); ctx.rotate(Math.sin(t * 0.6) * 0.15);
  for(const s of [-1, 1]) box(ctx, s * 0.22 - 0.05, -0.05, 0.1, 0.35, 0.05, PAL.otter, 0);
  box(ctx, -0.04, -0.35, 0.08, 0.35, 0.04, PAL.coral, 0);
  for(const [x, r] of [[-0.1, -0.5], [0.0, 0.0], [0.11, 0.45]]){ ctx.save(); ctx.translate(x, -0.35); ctx.rotate(r); box(ctx, -0.04, -0.24, 0.08, 0.24, 0.04, PAL.coral2, 0); ctx.restore(); }
  ctx.restore();
}
function kris(ctx, t, stone = null){
  const c = stone || PAL.hoodie;
  for(const s of [-1, 1]) disc(ctx, s * 0.36, 0.1, 0.12, stone || shade(c, .9), 0.03);
  ctx.beginPath(); ctx.ellipse(0, 0.06, 0.34, 0.28, 0, 0, Math.PI * 2); blob(ctx, c, 0.04);
  disc(ctx, 0, -0.04, 0.22, stone || PAL.skin, 0.035);
  ctx.beginPath(); ctx.arc(0, -0.04, 0.22, Math.PI, 0); ctx.closePath(); blob(ctx, stone || shade(c, .85), 0.035);
  if(!stone){ box(ctx, -0.26, -0.1, 0.52, 0.07, 0.03, PAL.ink, 0); disc(ctx, -0.24, -0.06, 0.07, PAL.ink, 0); disc(ctx, 0.33, 0.22, 0.08, PAL.paper, 0.03); }
}
function cart(ctx){
  box(ctx, -0.55, -0.9, 1.1, 1.8, 0.15, PAL.paper, 0.05);
  label(ctx, 'BREAD', 0, 0, 0.34, PAL.breadDark, { bg: PAL.bread, font: "Impact, 'Arial Black', sans-serif", weight: 900 });
  for(const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(ctx, sx * 0.6 - 0.1, sy * 0.62 - 0.2, 0.2, 0.4, 0.06, PAL.wheel, 0.03);
}
function plowval(ctx, t){
  for(const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(ctx, sx * 0.72 - 0.14, sy * 0.7 - 0.28, 0.28, 0.56, 0.08, PAL.wheel, 0.03);
  box(ctx, -0.6, -1.0, 1.2, 2.0, 0.18, PAL.plow, 0.05);
  box(ctx, -0.5, -0.1, 1.0, 0.9, 0.12, shade(PAL.plow, .9), 0.04);
  box(ctx, -0.44, -0.05, 0.88, 0.32, 0.06, tint(PAL.paper, .1), 0);
  disc(ctx, 0, 0.45, 0.1, (Math.sin(t * 6) > 0) ? PAL.beacon : shade(PAL.beacon, .8), 0.03);
  box(ctx, -0.95, -1.45, 1.9, 0.35, 0.08, PAL.blade, 0.05);
  label(ctx, 'PLOWVAL', 0, -0.5, 0.26, PAL.paper, { font: "Impact, 'Arial Black', sans-serif", weight: 900 });
}
function tireTop(ctx, x, y, r = 0.4){ disc(ctx, x, y, r, PAL.wheel, 0.04); disc(ctx, x, y, r * 0.38, PAL.hub, 0.03); }
/* a sign on a post, readable from above */
function sign(ctx, x, y, text, bg, fg, size = 0.9){
  ctx.save(); ctx.translate(x, y);
  ctx.font = `900 ${size}px Impact, 'Arial Black', sans-serif`; const w = ctx.measureText(text).width + size * 1.2, h = size * 1.6;
  shadow(ctx, 0.15, 0.2, w / 2, h / 2, 0.16);
  rrect(ctx, -w / 2, -h / 2, w, h, 0.18); blob(ctx, bg, 0.1);
  rrect(ctx, -w / 2 + 0.18, -h / 2 + 0.18, w - 0.36, h - 0.36, 0.1); ctx.lineWidth = 0.06; ctx.strokeStyle = rgba(0xffffff, 0.5); ctx.stroke();
  for(const s of [-1, 1]) disc(ctx, s * (w / 2 - 0.12), 0, 0.07, shade(bg, .7), 0);   // posts
  ctx.fillStyle = hex(fg); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, size * 0.06);
  ctx.restore();
}

/* ---- drawing: static furniture then the cast (call after the ground, before machines) --- */
export function drawCorner(ctx, view, zoom, t){
  if(view.x1 < -100 || view.x0 > 100 || view.y1 < -260 || view.y0 > -140) return;
  const S = SPOTS;
  // statue of Kris
  ctx.save(); ctx.translate(S.statue.x, S.statue.y);
  shadow(ctx, 0.2, 0.3, 1.1, 1.1, 0.18);
  box(ctx, -0.9, -0.9, 1.8, 1.8, 0.12, PAL.plinth, 0.06); box(ctx, -0.7, -0.7, 1.4, 1.4, 0.08, tint(PAL.plinth, .12), 0.04);
  if(!art(ctx, 'props/statue', 1.6, 1.6, zoom)){ ctx.save(); ctx.scale(1.3, 1.3); kris(ctx, t, PAL.stone); ctx.restore(); }
  label(ctx, 'got lost. got found.', 0, 1.5, 0.42, PAL.text, { bg: PAL.border });
  ctx.restore();
  // LAUGH — Kris's one rule · LIVE board
  sign(ctx, S.laugh.x, S.laugh.y, 'LAUGH', PAL.red, PAL.cream, 1.2);
  sign(ctx, S.live.x, S.live.y, 'DAILY · coming soon', PAL.cream, PAL.mute, 0.5);
  // grandstand (infield, facing the main straight) + rail
  ctx.save(); ctx.translate(S.grandstand.x, S.grandstand.y);
  shadow(ctx, 0.4, 0.5, 10.3, 3.2, 0.18);
  for(let i = 0; i < 4; i++) box(ctx, -10, -3 + i * 1.5, 20, 1.4, 0.12, i % 2 ? PAL.stand : shade(PAL.stand, .92), 0.06);
  box(ctx, -10, -3.3, 20, 0.3, 0.1, PAL.red, 0.04);
  for(let i = 0; i < 14; i++) disc(ctx, -9.2 + i * 1.42, -2.3 + (i % 4) * 1.5, 0.32, [PAL.red, PAL.blue, PAL.batt, PAL.pad, PAL.motor][i % 5], 0.03);   // lil fans
  ctx.restore();
  // commentary booth with Kris
  ctx.save(); ctx.translate(S.booth.x, S.booth.y);
  shadow(ctx, 0.3, 0.4, 1.6, 1.3, 0.18);
  box(ctx, -1.4, -1.1, 2.8, 2.2, 0.15, PAL.stand, 0.08); box(ctx, -1.1, 0.3, 2.2, 0.5, 0.08, PAL.leather, 0.04);
  ctx.save(); ctx.translate(0, -0.15); ctx.rotate(Math.sin(t * 0.35) * 0.5); if(!art(ctx, 'critters/kris', 1.1, 1.1, zoom)) kris(ctx, t); ctx.restore();
  sign(ctx, 0, -1.8, 'ON AIR', PAL.red, PAL.paper, 0.45);
  ctx.restore();
  // Dillon's tire shop
  ctx.save(); ctx.translate(S.shop.x, S.shop.y);
  shadow(ctx, 0.3, 0.4, 1.0, 2.3, 0.18);
  box(ctx, -0.7, -2.1, 1.4, 4.2, 0.12, PAL.pad, 0.08);
  for(let i = 0; i < 5; i++) box(ctx, -0.85, -1.95 + i * 0.8, 1.7, 0.6, 0.06, i % 2 ? PAL.paper : PAL.red, 0.03);   // striped awning
  tireTop(ctx, -1.6, -1.2); tireTop(ctx, -1.7, -0.3, 0.36); tireTop(ctx, 1.6, 1.4); tireTop(ctx, 1.5, 0.55, 0.34);
  sign(ctx, 0, -2.9, "DILLON'S 24/7", PAL.pad, PAL.text, 0.5);
  ctx.restore();
  // Tomathy (+ Jimothy) + the BREAD cart
  ctx.save(); ctx.translate(S.tomathy.x, S.tomathy.y); ctx.rotate(S.tomathy.a);
  shadow(ctx, 0, 0, 1.0, 1.4, 0.16);
  if(!art(ctx, 'critters/tomathy', 2.4, 3.2, zoom)) tomathy(ctx, t); ctx.restore();
  ctx.save(); ctx.translate(S.cart.x, S.cart.y); ctx.rotate(S.cart.a); shadow(ctx, 0, 0, 0.8, 1.1, 0.14);
  if(!art(ctx, 'props/cart', 1.6, 2.2, zoom)) cart(ctx); ctx.restore();
  // Dillon rolling his tire
  const roll = Math.sin(t * 0.8) * 0.6;
  ctx.save(); ctx.translate(S.dillon.x, S.dillon.y + roll);
  shadow(ctx, 0, 0.9, 0.45, 0.45, 0.14); if(!art(ctx, 'props/tire', 0.8, 0.8, zoom)){ ctx.save(); ctx.translate(0, 0.9); ctx.rotate(roll * 3); tireTop(ctx, 0, 0, 0.36); ctx.restore(); }
  shadow(ctx, 0, 0, 0.4, 0.5, 0.14); if(!art(ctx, 'critters/dillon', 1.0, 1.4, zoom)) dillon(ctx, t); ctx.restore();
  // PLOWVAL + Corval
  ctx.save(); ctx.translate(S.plowval.x, S.plowval.y); ctx.rotate(S.plowval.a); shadow(ctx, 0, 0, 1.0, 1.5, 0.16);
  if(!art(ctx, 'props/plowval', 2.2, 3.2, zoom)) plowval(ctx, t); ctx.restore();
  ctx.save(); ctx.translate(S.corval.x, S.corval.y); ctx.rotate(S.corval.a); shadow(ctx, 0, 0, 0.45, 0.55, 0.14);
  if(!art(ctx, 'critters/corval', 1.1, 1.6, zoom)) corval(ctx, t); ctx.restore();
  // parody signs
  for(const s of S.signs) sign(ctx, s.x, s.y, s.text, s.bg, s.fg, 0.9);
}
export { SPOTS as CORNER };
