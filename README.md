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


## UPDATE 2 — THE BLOCKS FLOOD (2026-08-22): 28 → 63 blocks, one push
Locked in 5 "card packs" (DESIGN.md → BLOCKS PACKS). Every block hooks a real system.

**Garage rules (new):** right-click EMPTY = the catalog ring · right-click a BLOCK = its config card
(key binds, FWD/REV, harshness, which wheels, wires, threshold, text, paint) · the PANEL block is
free-draw: click points (they snap to cell corners + centres), click the first point to close,
Backspace undoes, Esc cancels. A panel occupies the cells you drew over (one level, all the same);
it's what you paint, it streamlines a front face, it takes the hit before the block under it, and
it HIDES your build from everyone else (the owner sees through it in the garage).

**Catalog (13 rings):**
- FRAMES 1×1/2×2/3×3 · LEAD (heavy) · FOAM (light, fragile) · PLATE (armour) · BUMPER (soaks half a hit)
- BODY: PANEL (free-draw skin)
- WHEELS: 3 sizes × road / SLICK / OFF-ROAD / SPIKED (S, M, L) + CASTER + BRAKE (per-wheel, harshness; 100 % = handbrake slide, default Space)
- ENGINE: PUTT (1×1) · ENGINE · V8 (needs 1 intake) · JET (3×3: thrust from where it sits, spools up, needs 1 intake, works mid-air) · TURBO · FUEL · JERRYCAN ("do NOT shake") · INTAKE (every engine likes one, +8 % each)
- ELECTRIC: BATT · BIG BATT · MOTOR · FAN · SOLAR
- THRUST: ROCKET (fuel, R) · ION (battery, R) — facing blocks, sideways = drift control, mid-air too
- AERO: WING · NOSE · WEDGE · CURVE · FIN
- MECH: HINGE (whatever is AHEAD of it swings free: trailers, whips) · PISTON (F = punch; walls punch back) · ROTOR (G = spin; saws on contact; two at full spin = HOP)
- GADGETS (room toggle): OIL (1) · SMOKE (hold 2 — hides you on THEIR screens) · SPIKES · RAM PLATE (your hits ×2, theirs ×½) · CALTROPS (3 — flat tyres till Q / pit) · BANANA (4 — find out)
- TOOLS: TOW HOOK (C near a machine = rope, C again = let go)
- DECOR: FLAG · NUMBER PLATE (text) · ANTENNA (wobbles with your driving) · HORN (H; clips: honk / meep / airhorn / duck)
- LOGIC: SPEED SENSOR · PROXIMITY (each carries its own threshold and wires straight into blocks with an amount — "speed > 60 → BRAKE 100 %" = a pit limiter) · AND / OR / NOT / NOR

**Engines + brakes pick their wheels** (config card → "pick wheels", click up to 4 on your build; default = all).
Default binds: W/S engines + motors · Space brake · R thrusters · F piston · G rotor · 1/2/3/4 gadgets · C hook · H horn — all rebindable per block.
Pit lane / garage / Q also restock gadget ammo and fix flats. Net: builds carry configs; drops, ropes, punches, flames, trailer angles sync.
Art slots for all 35 new blocks are listed in ART.md (code fallbacks draw them until Adam does).
