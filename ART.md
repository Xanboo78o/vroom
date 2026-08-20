# VROOM art — the deal: you draw, the game hot-reloads

Drop an SVG in `assets/`, press **T** in game. No SVG = the game's built-in
blocky look stands in. Broken SVG = same fallback, never a crash.

## Files the game looks for
`frame.svg` `seat.svg` `wheel.svg` `engine.svg` `tank.svg` `intake.svg`
`battery.svg` `motor.svg` `fan.svg` `wing.svg` — one square top-down view each,
shown as the TOP FACE of that part on every machine.

`guy.svg` — the little guy seen from above (head + shoulders + cap kind of view).

## Rules
- **Draw the TOP view** (bird's eye) — the camera looks straight down.
- Square-ish canvas, any size, but **keep `width` and `height` attributes** on the
  `<svg>` tag (some browsers can't rasterize without them).
- Parts that have a FACING (intake, fan, wing): draw them pointing **UP** on your
  canvas — that's "forward". R in the builder rotates them.
- Transparent background = the 3D part shows around your art. Solid = fully yours.
- `guy.svg` and `wheel.svg` already have placeholder art — overwrite them.
