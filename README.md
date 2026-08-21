# kRacing (was VROOM) (working title)

Trailmakers-but-racing prototype toy. Build machines out of Lego parts, race your
friends on one hand-made map, knock each other's wheels off, steal them.

- **Play**: https://xanboo78o.github.io/vroom/
- **Local**: `python3 -m http.server 8144` in this folder

## The rules of the machine
- Engines burn fuel and need an **intake with clear air** — cover it and the engine chokes
- Motors drain **batteries**; **fans** recharge them from airflow while you drive
- Engine + motor together = hybrid = extra VROOM (Shift)
- Your **shape is your top speed** — frontal area is drag
- Hard hits **shear parts off for real**; they lie on the track — grab yours back (F) or steal theirs
- Pit pads (yellow) refuel + recharge; rooms can be "repairs anywhere" or "pit only"

## Controls
WASD move/drive · E hop in/out · B build (click add, right-click remove, R rotate,
shift-drag orbit) · F grab/bolt parts · Shift boost · M mute VC

## Netcode
Supabase Realtime rooms (4-letter codes) + WebRTC voice mesh — recipes from the
shooter project and Foglast's ProxyChat.

## Deploy note
`.git/hooks/pre-commit` stamps `?v=<epoch>` onto every module/CSS URL in index.html, so a plain reload right after a push gets a consistent new build (GitHub Pages caches assets 10 min). If the hook is missing (fresh clone), copy it back from this note: `sed -i -E "s/\?v=[0-9]+/?v=$(date +%s)/g" index.html` before committing.

## UPDATE 1 — the look, Kris's Corner, paint, cameras (2026-08-21)
- **Lighting**: one sun with real shadow maps (golden hour default, `[`/`]` nudge the hour),
  hemisphere fill + fog from `js/palette.js` SKY keyframes, flat-shaded faces, sky dome
  (gradient → put `assets/sky/{dawn,noon,golden,dusk,night}.png` to paint it), ground tiles
  (`assets/tiles/{asphalt,shoulder,grass,sand,gravel,kerb}.png` override the generated ones).
- **Graphics presets**: `GFX` chip (bottom-right) or `?gfx=low|med|high`. low = shadows only,
  med = +AO +motion blur (post pipeline), high = +bloom. Auto-detected from the GPU.
- **Palette**: `js/palette.js` is the single source of truth (3D + CSS `--k-*` vars).
- **Kris's Corner** (the plaza): Tomathy + golf cart, Jimothy in the saddle bag, Dillon's tire
  shop + Dillon, PLOWVAL + Corval (with the coral), statue of Kris ("got lost. got found."),
  the LAUGH sign, a LIVE board, Kris in the commentary booth by the start line, a grandstand.
- **Billboards**: drop images in `assets/billboards/` and list them in
  `assets/billboards/list.json` (`["a.png","b.svg"]`); boards along the straights + plaza rotate
  through them (parody sponsors when empty). `T` reloads.
- **Paint + decals v1** (build mode → `P`): left strip of swatches; click = block, Shift-click =
  one face, hold = spray; decals (text w/ 3 fonts, shapes, logos): pick → scroll size → `R`
  rotate → click stamps on TOP faces (v1) → `X` undo → Esc drop. Paint travels in the build
  tuple (4th element), over the net, through shear/grab/bolt-back.
- **Cameras**: `C` cycles top-down → chase → fps → free (remembered). Chase: `Q`/`Z` look
  left/right (both = behind), wheel = distance. Free: WASD/Space/Ctrl fly, Shift fast, hold
  right-mouse to look. Build mode is always the frozen top-down view.
- Logo: drop `assets/logo.svg` and it replaces the title (+ favicon).
