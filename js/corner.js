/* =============================================================================
   corner.js — Kris's Corner (the plaza) and its cast:
     TOMATHY  horse-sized duck, saddle + saddle bag (Jimothy inside), his BREAD golf cart
     JIMOTHY  the goob raccoon, asleep in the bag
     DILLON   armadillo, runs DILLON'S 24/7 tire shop, rolls a tire back and forth
     CORVAL   otter, ALWAYS holding his coral, beside PLOWVAL the plow
     KRIS     lost-in-the-woods human: statue ("got lost. got found."), commentary
              booth by the start line, his one rule: LAUGH
   Everything here is a sprite slot: assets/critters/<name>.svg, assets/props/<name>.svg.
   Until Adam draws them, the round code-drawn cuties below stand in.
   ============================================================================= */
import { PAL, hex, shade, tint } from './palette.js';
import { box, disc, rrect, blob, art, shadow, label } from './draw.js';

const SPOTS = {
  tomathy: { x: -19, y: 36, a: Math.PI / 2 }, cart: { x: -21, y: 43.5, a: Math.PI / 2 },
  shop: { x: 21, y: 36 }, dillon: { x: 19.2, y: 33.5 },
  plowval: { x: 18, y: 57, a: -Math.PI * 0.75 }, corval: { x: 15, y: 54, a: -Math.PI * 0.6 },
  statue: { x: 0, y: 16 }, laugh: { x: 8, y: 17 }, live: { x: -9, y: 17 },
  grandstand: { x: -52, y: -25 }, booth: { x: -66, y: -26 },
  signs: [{ x: -22, y: 72, text: "DILLON'S 24/7", bg: PAL.pad, fg: PAL.text }, { x: 22, y: 72, text: 'BREAD', bg: PAL.bread, fg: PAL.breadDark },
          { x: -30, y: -20, text: 'coral facts by Corval', bg: PAL.otterBelly, fg: PAL.otter }, { x: 30, y: -20, text: 'PLOWVAL · we plow.', bg: PAL.plow, fg: PAL.paper }],
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

/* ---- fallback cuties (top view, forward = up, roughly 1 unit = 1 u) ----------------- */
function eyes(ctx, x, y, dx, r = 0.07){ for(const s of [-1, 1]) disc(ctx, x + s * dx, y, r, PAL.mask, 0); }
function tomathy(ctx, t){
  ctx.save(); ctx.translate(0, Math.sin(t * 1.6) * 0.03);
  ctx.beginPath(); ctx.ellipse(0, 0.55, 0.5, 0.35, 0, 0, Math.PI * 2); blob(ctx, PAL.duck, 0.05);         // tail end
  ctx.beginPath(); ctx.ellipse(0, 0, 0.68, 1.1, 0, 0, Math.PI * 2); blob(ctx, PAL.duck, 0.05);             // body
  for(const s of [-1, 1]){ ctx.beginPath(); ctx.ellipse(s * 0.55, 0.1, 0.22, 0.5, s * 0.3, 0, Math.PI * 2); blob(ctx, shade(PAL.duck, .94), 0.04); }   // wings
  box(ctx, -0.45, -0.45, 0.9, 0.75, 0.12, PAL.leather, 0.04);                                              // saddle
  box(ctx, -0.95, -0.1, 0.42, 0.5, 0.1, shade(PAL.leather, .9), 0.04);                                     // saddle bag (left flank)
  ctx.save(); ctx.translate(-0.74, 0.12); ctx.scale(0.55, 0.55); jimothy(ctx, t); ctx.restore();            // Jimothy peeking
  ctx.save(); ctx.translate(0, -1.05); ctx.rotate(Math.sin(t * 0.7) * 0.35);                                 // neck + head turn
  disc(ctx, 0, -0.15, 0.36, PAL.duck, 0.05);
  box(ctx, -0.17, -0.7, 0.34, 0.45, 0.12, PAL.beak, 0.04);                                                 // beak
  eyes(ctx, 0, -0.2, 0.18);
  ctx.restore(); ctx.restore();
}
function jimothy(ctx, t){
  const br = 1 + Math.sin(t * 2.2) * 0.04;
  ctx.save(); ctx.scale(br, br);
  for(let i = 0; i < 3; i++) disc(ctx, 0.32 + i * 0.12, 0.3 + i * 0.1, 0.09, i % 2 ? PAL.mask : PAL.raccoon, 0);   // striped tail
  ctx.beginPath(); ctx.ellipse(0, 0.1, 0.34, 0.4, 0, 0, Math.PI * 2); blob(ctx, PAL.raccoon, 0.04);
  disc(ctx, 0, -0.3, 0.26, PAL.raccoon, 0.04);
  for(const s of [-1, 1]) disc(ctx, s * 0.2, -0.48, 0.09, PAL.mask, 0);                                    // ears
  box(ctx, -0.27, -0.36, 0.54, 0.16, 0.08, PAL.mask, 0);                                                  // the mask
  eyes(ctx, 0, -0.28, 0.11, 0.045);
  ctx.restore();
}
function dillon(ctx, t){
  ctx.beginPath(); ctx.ellipse(0, 0, 0.3, 0.42, 0, 0, Math.PI * 2); blob(ctx, PAL.armadillo, 0.04);
  for(let i = 0; i < 3; i++) box(ctx, -0.3, -0.2 + i * 0.16, 0.6, 0.07, 0.03, PAL.armadilloDark, 0);    // bands
  disc(ctx, 0, -0.5, 0.16, PAL.armadillo, 0.04); disc(ctx, 0, -0.64, 0.08, PAL.armadilloDark, 0);          // head + snout
  box(ctx, -0.04, 0.38, 0.08, 0.4, 0.04, PAL.armadilloDark, 0);                                           // tail
  eyes(ctx, 0, -0.5, 0.09, 0.035);
}
function corval(ctx, t){
  box(ctx, -0.1, 0.3, 0.2, 0.6, 0.1, PAL.otter, 0.04);                                                    // tail
  ctx.beginPath(); ctx.ellipse(0, 0, 0.3, 0.42, 0, 0, Math.PI * 2); blob(ctx, PAL.otter, 0.04);
  disc(ctx, 0, -0.3, 0.26, PAL.otter, 0.04);
  for(const s of [-1, 1]) disc(ctx, s * 0.22, -0.44, 0.07, PAL.otter, 0.03);                               // ears
  disc(ctx, 0, -0.2, 0.12, PAL.otterBelly, 0); disc(ctx, 0, -0.27, 0.04, PAL.mask, 0);                    // muzzle + nose
  eyes(ctx, 0, -0.36, 0.1, 0.04);
  ctx.save(); ctx.translate(0, -0.6); ctx.rotate(Math.sin(t * 0.6) * 0.15);                                 // arms + THE CORAL
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
  ctx.beginPath(); ctx.arc(0, -0.04, 0.22, Math.PI, 0); ctx.closePath(); blob(ctx, stone || shade(c, .85), 0.035);   // hood up
  if(!stone){ box(ctx, -0.26, -0.1, 0.52, 0.07, 0.03, PAL.ink, 0); disc(ctx, -0.24, -0.06, 0.07, PAL.ink, 0);      // headset + cup
    disc(ctx, 0.33, 0.22, 0.08, PAL.paper, 0.03); }                                                            // mug
}
function cart(ctx){
  box(ctx, -0.55, -0.9, 1.1, 1.8, 0.2, PAL.paper, 0.05);                                                  // roof
  label(ctx, 'BREAD', 0, 0, 0.34, PAL.breadDark, { bg: PAL.bread, font: "Impact, 'Arial Black', sans-serif", weight: 900 });
  for(const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(ctx, sx * 0.6 - 0.1, sy * 0.62 - 0.2, 0.2, 0.4, 0.08, PAL.wheel, 0.03);
}
function plowval(ctx, t){
  for(const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(ctx, sx * 0.72 - 0.14, sy * 0.7 - 0.28, 0.28, 0.56, 0.1, PAL.wheel, 0.03);
  box(ctx, -0.6, -1.0, 1.2, 2.0, 0.25, PAL.plow, 0.05);
  box(ctx, -0.5, -0.1, 1.0, 0.9, 0.15, shade(PAL.plow, .9), 0.04);                                        // cab
  box(ctx, -0.44, -0.05, 0.88, 0.32, 0.08, tint(PAL.paper, .1), 0);                                         // glass
  disc(ctx, 0, 0.45, 0.1, (Math.sin(t * 6) > 0) ? PAL.beacon : shade(PAL.beacon, .8), 0.03);                // beacon
  box(ctx, -0.95, -1.45, 1.9, 0.35, 0.1, PAL.blade, 0.05);                                                // the blade
  label(ctx, 'PLOWVAL', 0, -0.5, 0.26, PAL.paper, { font: "Impact, 'Arial Black', sans-serif", weight: 900 });
}
function tireTop(ctx, x, y, r = 0.4){ disc(ctx, x, y, r, PAL.wheel, 0.04); disc(ctx, x, y, r * 0.38, PAL.hub, 0.03); }

/* ---- drawing: static furniture then the cast (call after the ground, before machines) --- */
export function drawCorner(ctx, view, zoom, t){
  if(view.x1 < -90 || view.x0 > 60 || view.y1 < -40 || view.y0 > 90) return;
  const S = SPOTS;
  // statue of Kris
  ctx.save(); ctx.translate(S.statue.x, S.statue.y);
  box(ctx, -0.9, -0.9, 1.8, 1.8, 0.2, PAL.plinth, 0.06);
  if(!art(ctx, 'props/statue', 1.6, 1.6, zoom)){ ctx.save(); ctx.scale(1.3, 1.3); kris(ctx, t, PAL.stone); ctx.restore(); }
  label(ctx, 'got lost. got found.', 0, 1.45, 0.42, PAL.text, { bg: PAL.border });
  ctx.restore();
  // LAUGH — Kris's one rule · LIVE board
  label(ctx, 'LAUGH', S.laugh.x, S.laugh.y, 1.2, PAL.cream, { bg: PAL.red, font: "Impact, 'Arial Black', sans-serif", weight: 900 });
  ctx.save(); ctx.translate(S.live.x, S.live.y); rrect(ctx, -2.1, -0.9, 4.2, 1.8, 0.25); blob(ctx, PAL.cream, 0.08);
  label(ctx, 'DAILY · coming soon', 0, 0, 0.5, PAL.mute); ctx.restore();
  // grandstand (rows) + rail
  ctx.save(); ctx.translate(S.grandstand.x, S.grandstand.y);
  for(let i = 0; i < 4; i++) box(ctx, -10, -3 + i * 1.5, 20, 1.4, 0.3, i % 2 ? PAL.stand : shade(PAL.stand, .92), 0.06);
  box(ctx, -10, 2.8, 20, 0.3, 0.15, PAL.red, 0.04);
  for(let i = 0; i < 14; i++) disc(ctx, -9.2 + i * 1.42, -2.3 + (i % 4) * 1.5, 0.32, [PAL.red, PAL.blue, PAL.batt, PAL.pad, PAL.motor][i % 5], 0.03);   // lil fans
  ctx.restore();
  // commentary booth with Kris
  ctx.save(); ctx.translate(S.booth.x, S.booth.y);
  box(ctx, -1.4, -1.1, 2.8, 2.2, 0.3, PAL.stand, 0.08); box(ctx, -1.1, 0.3, 2.2, 0.5, 0.1, PAL.leather, 0.04);
  ctx.save(); ctx.translate(0, -0.15); ctx.rotate(Math.sin(t * 0.35) * 0.5); if(!art(ctx, 'critters/kris', 1.1, 1.1, zoom)) kris(ctx, t); ctx.restore();
  label(ctx, 'ON AIR', 0, -1.5, 0.45, PAL.paper, { bg: PAL.red });
  ctx.restore();
  // Dillon's tire shop
  ctx.save(); ctx.translate(S.shop.x, S.shop.y);
  box(ctx, -0.7, -2.1, 1.4, 4.2, 0.25, PAL.pad, 0.08);
  for(let i = 0; i < 5; i++) box(ctx, -0.85, -1.95 + i * 0.8, 1.7, 0.6, 0.08, i % 2 ? PAL.paper : PAL.red, 0.03);   // striped awning
  tireTop(ctx, -1.6, -1.2); tireTop(ctx, -1.7, -0.3, 0.36); tireTop(ctx, 1.6, 1.4); tireTop(ctx, 1.5, 0.55, 0.34);
  label(ctx, "DILLON'S 24/7", 0, -2.9, 0.5, PAL.text, { bg: PAL.pad, font: "Impact, 'Arial Black', sans-serif", weight: 900 });
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
  for(const s of S.signs) label(ctx, s.text, s.x, s.y, 0.9, s.fg, { bg: s.bg, font: "Impact, 'Arial Black', sans-serif", weight: 900 });
}
export { SPOTS as CORNER };
