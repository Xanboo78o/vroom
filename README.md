# kRacing (was VROOM)

A cute, fully **2D** top-down build-and-race toy. Build little machines out of tiles,
race your friends on one hand-made map, knock each other's wheels off, steal them.
All the art is SVG — see `ART.md` — Adam draws it, the game hot-reloads it (T).

- **Play**: https://xanboo78o.github.io/vroom/
- **Local**: `python3 -m http.server 8144` in this folder
- The earlier **3D** build (UPDATE 1 look, cameras, paint) is frozen in `3d/` and still
  plays at https://xanboo78o.github.io/vroom/3d/

## The rules of the machine
- A machine is tiles on a fine grid, STACKED in layers (full 2D: you see the top tile, a badge counts the
  stack); frames 1×1/2×2/3×3, everything else 2×2. Hover the MIDDLE of a block to stack on it, an EDGE to
  extend sideways. Only layer-0 wheels touch the ground
- It pivots on its CENTRE OF MASS; wheels closer to it carry more weight (more grip) — the garage readout
  shows mass, drag, cross-section (width × height), front/rear balance, layers
- Engines burn fuel and need an **intake with clear air ahead** — cover it and the engine chokes
- Motors drain **batteries**; **fans** recharge them from airflow while you drive
- Engine + motor together = hybrid = extra VROOM (Shift)
- Your **shape is your top speed** — width is drag; where you bolt wheels changes how it turns
- Hard hits **shear parts off for real**; they lie on the track — grab yours back (F) or steal theirs
- Ramps launch you (blob shadow = height); belly-flops can pop a wheel
- Pit pads (yellow) refuel + recharge; rooms can be "repairs anywhere" or "pit only"
- Teleport pads in Kris's Corner take you to every track (Paddock GP, L8TER, Switchback,
  the Bowl, Otterbend, Lost Woods) and to the GARAGE
- **B = go to the GARAGE**: your car lands on your AERO TUNNEL pad (air streams over it live, bends
  around blocks, gets sucked into breathing intakes), you build top-down, leaving build mode fills the
  tank; a small all-terrain TEST LOOP (asphalt + bump → gravel → sand → grass + puddle, lap-timed) is
  right there; the PADDOCK pad takes you home

## Controls
WASD / arrows drive (on foot: W walks toward the mouse, S away, A/D strafe) · Space jump ·
E hop in/out · B garage/build (right-click = the ring catalog, click add — middle of a block stacks, edge extends —
X / middle remove (takes the stack above with it), R rotate, Ctrl+G recenter the build view) · F grab/bolt parts · Q full repair · Shift boost (or run) · wheel zoom · M mute VC · T reload art

## Netcode
Supabase Realtime rooms (4-letter codes) + WebRTC voice mesh — recipes from the
shooter project and Foglast's ProxyChat. Whoever drives a machine simulates it.

## Deploy note
`.git/hooks/pre-commit` stamps `?v=<epoch>` onto every module/CSS URL in index.html, so a plain
reload right after a push gets a consistent new build (GitHub Pages caches assets 10 min).
If the hook is missing (fresh clone): `sed -i -E "s/\?v=[0-9]+/?v=$(date +%s)/g" index.html` before committing.
When you add a js module, add it to the importmap in index.html too, or it'll be the one stale file.
