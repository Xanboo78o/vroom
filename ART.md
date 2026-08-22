# kRacing art — the deal: you draw, the game hot-reloads

The whole game is your vectors. Drop an SVG in `assets/`, press **T** in game.
No SVG = the game's round code-drawn placeholder stands in. Broken SVG = same
fallback, never a crash. Everything is seen from ABOVE (the camera looks straight
down) and things that face somewhere face **UP** on your canvas.

## Slots the game looks for
| file | what | size hint |
|---|---|---|
| `assets/parts/frame.svg` `seat.svg` `wheel.svg` `engine.svg` `tank.svg` `intake.svg` `battery.svg` `motor.svg` `fan.svg` `wing.svg` `nose.svg` `wedge.svg` `curve.svg` `lead.svg` `foam.svg` `plate.svg` `bumper.svg` `monster.svg` `slick.svg` `caster.svg` `v8.svg` `turbo.svg` `jerry.svg` `solar.svg` `bigbatt.svg` `fin.svg` | the whole part (it IS the tile now — no 3D underneath) | square, e.g. 128×128 |
| `assets/parts/frame1.svg` / `frame3.svg` | optional: the 1×1 / 3×3 frames (else frame.svg is reused) | square |
| `assets/guy.svg` | the little guy from above (head, cap, shoulders) — everyone shares it; your colour shows as a ring at your feet | 128×128 |
| `assets/critters/tomathy.svg` `jimothy.svg` `dillon.svg` `corval.svg` `kris.svg` | Kris's Corner cast | any (tall is fine) |
| `assets/props/cart.svg` `plowval.svg` `cone.svg` `bush.svg` `tree.svg` `statue.svg` `tire.svg` `flower.svg` | plaza furniture + world decoration | any |
| `assets/logo.svg` | the kRacing logo (menu title + favicon) | wide |

Placeholders are shipped for parts, the guy and the cast — **overwrite them**.

## Rules
- **Draw the TOP view.** Forward/facing = **UP** on your canvas (intake mouth, fan,
  wing, the guy's face, Tomathy's beak). R in the builder rotates parts.
- **Keep `width` and `height` attributes** on the `<svg>` tag (some browsers can't
  rasterize without them). `viewBox` too.
- Your SVG is fitted inside the part's footprint (2×2 cells = 0.6 units square),
  keeping its aspect — so square canvases fill the tile, tall ones get letterboxed.
- Transparent background is fine (the grass/track shows through).
- Outlines: a slightly darker shade of the fill, not black (your rule).
- The ring catalog icons are rendered from the same files — T refreshes them too.

## Ground textures (tiles)
Every surface is a repeating tile of **8 × 8 units**. The game generates them
(`js/tiles.js`); drop `assets/tiles/<name>.png` (or `.svg`) to replace one with yours —
`grass` `grassDark` `asphalt` `shoulder` `concrete` `sand` `gravel` `water` `pit`.
Any pixel size (512 px looks crisp zoomed in). Make the edges wrap. T reloads.

## BLOCKS FLOOD slots (2026-08-22) — `assets/parts/<name>.svg`, 128×128, forward = UP, flat fill + darker-shade outline
- `assets/parts/panel.svg` — PANEL
- `assets/parts/wheel1.svg` — WHEEL1
- `assets/parts/wheel3.svg` — WHEEL3
- `assets/parts/slick1.svg` — SLICK1
- `assets/parts/slick3.svg` — SLICK3
- `assets/parts/knobby1.svg` — KNOBBY1
- `assets/parts/knobby.svg` — KNOBBY
- `assets/parts/spike1.svg` — SPIKE1
- `assets/parts/spike.svg` — SPIKE
- `assets/parts/spike3.svg` — SPIKE3
- `assets/parts/brake.svg` — BRAKE
- `assets/parts/putt.svg` — PUTT
- `assets/parts/jet.svg` — JET
- `assets/parts/rocket.svg` — ROCKET
- `assets/parts/ion.svg` — ION
- `assets/parts/hinge.svg` — HINGE
- `assets/parts/piston.svg` — PISTON
- `assets/parts/rotor.svg` — ROTOR
- `assets/parts/oil.svg` — OIL
- `assets/parts/smoke.svg` — SMOKE
- `assets/parts/spikes.svg` — SPIKES
- `assets/parts/ram.svg` — RAM
- `assets/parts/caltrops.svg` — CALTROPS
- `assets/parts/banana.svg` — BANANA
- `assets/parts/hook.svg` — HOOK
- `assets/parts/flag.svg` — FLAG
- `assets/parts/numplate.svg` — NUMPLATE
- `assets/parts/antenna.svg` — ANTENNA
- `assets/parts/horn.svg` — HORN
- `assets/parts/sensespeed.svg` — SENSESPEED
- `assets/parts/senseprox.svg` — SENSEPROX
- `assets/parts/and.svg` — AND
- `assets/parts/or.svg` — OR
- `assets/parts/not.svg` — NOT
- `assets/parts/nor.svg` — NOR
