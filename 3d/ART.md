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

## UPDATE 1 additions (all hot-reload with T)
- `assets/logo.svg` — the kRacing logo (menu title + favicon).
- `assets/sky/{dawn,noon,golden,dusk,night}.png` — painted sky domes (equirect, 2:1). Nearest to the hour wins.
- `assets/tiles/{asphalt,shoulder,grass,sand,gravel,kerb}.png` — tileable ground textures (the material goes white; your tile carries the colour).
- `assets/billboards/*.png|svg` + `assets/billboards/list.json` — trackside billboard art (512×256 looks best; anything is letterboxed).
- Critters/props are 3D primitives in `js/critters.js` / `js/props.js` — colours come from `js/palette.js`.
