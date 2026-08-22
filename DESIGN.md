> **PIVOT 2026-08-21 (evening), Adam:** "lets turn kRacing back into what it started as. Itll be a cute fun
> top down racing game again lol high accentuation on the cute, i want my fun lil vector designs … and itll be
> full 2d." → The game is now FULL 2D (canvas, his SVGs are the art, single-layer tile builder). Everything below
> about 3D lighting / shadows / shaders / cameras / post-FX / paint-on-faces is superseded; the 3D build is frozen
> in `3d/`. The cast, the humour, the blocks-≥3-uses law, optional depth, pure discovery, tracks, modes and the
> universe all still stand.

# kRacing (was VROOM) — DESIGN.md (the question marathon, started 2026-08-21; capped at 75 rounds)

Adam's four technical pillars: **fully configurable controls · realistic physics + computed
aerodynamics · WAY more blocks · textures.** 100 rounds × 4 questions. Locked answers land
here as we go. (Silly answers get incorporated too — they're canon.)

## Locked so far
- Q1 — Aero: YES to full airflow computation ("all of that") — per-block exposure, shielding
  behind other blocks, wings need clean air, stalls. Shape must *mean* something.

## Rounds

### R1 (physics/aero)
- Q2 Aero model: **Hybrid** (per-car ray-shadow exposure + coarse world wake-field). AND **visible
  airflow**: streamlines flowing over the build, colour = quality — green great, yellow good, red
  eh, blue none, **purple = "how?"** (physically weird / wrong-way flow).
- Q3 Lift/drag: **everything is an airfoil** — every exposed face drags, every flat panel lifts/
  downforces by angle; wings are just very good panels.
- Q4 Dirty air: **"how it works irl"** — less drag AND less downforce in the tow, intakes breathe a
  little less. Real F1.
- Q5 Wall sound: **CRUNCH**. Plus: **epic moments / visions / clips** — the game should capture and
  replay highlight moments.

### R2 (physics/aero + clips + weight)
- Q6 Airflow viz: **wind tunnel in build (toggle) + live toggle while driving**.
- Q7 Wind tunnel controls: **speed (scroll) + yaw** (hold to angle the wind like mid-corner).
- Q8 Clips: the game **auto-captures cool moments it sees** (jumps, near-misses, big crashes,
  overtakes, photo finishes) AND **Ctrl+C opens a capture menu: last 15 / 30 / 45 / 60 s**.
- Q9 Weight: **FULL weight** — every block has mass, centre of mass affects balance/rollover/
  turn-in, heavy = slower accel + longer braking, ballast blocks exist. (Supersedes the old
  "not so much weight yet".)

### R3 (grip / suspension / surfaces / water)
- Q10 Tires: **compounds (slick/wet/offroad) + temperature + wear** — cold = slidey, overheat
  from sliding, wear → pit stops matter.
- Q11 Suspension: **suspension BLOCKS that are configurable** (dials: stiffness / damping /
  ride height / camber).
- Q12 Surfaces: **asphalt, gravel/dirt, grass/sand, water** + "grass with blades, rocks you can
  rock-crawl, big hills, tunnels, etc etc etc" — the world wants real terrain variety.
- Q13 Water: **waves and stuff** ("it'd be so cool") — per-block buoyancy + real waves/wake.
- Also from Q13: **fullscreen button/key**; **Adam will make the music** (needs a music hook +
  per-track/menu slots); **these question rounds should feel like opening a booster pack,
  with colour** → from R4 on, rounds are "packs", questions are "cards" with rarity.

### R4 / PACK 4 (damage / drivetrain / contact / pit critter)
- Q14 Damage: **depends on the block** — some shear right off, some crumble; driven by type,
  material, and HOW it's attached (joint strength).
- Q15 Drivetrain: **NEW RULE, PROCLAIMED: EVERY BLOCK HAS AT LEAST 3 USES.** No "gearbox block" —
  add general blocks (gears, axles, …) you can BUILD gearboxes from, that also do other
  things. (Same law as his own-minecraft "≥3 uses per item".) Torque/gears still real.
- Q16 Contact: **full rigid car-vs-car contact** — push, bump, spin, hard hits shear both.
- Q17 Pit critter (canon): **"A duck the size of a horse, orange beak and a saddle! His name
  is Tomathy :3 and the internet sensation… JIMOTHY!!!"** (verbatim — Tomathy/Jimothy, the
  giant saddled duck of the pit lane.)

### R5 / PACK 5 (materials / teaching / mech primitives / duck)
- Q18 Materials: **every block has a pre-assigned material from its real-world version** ("there's
  like all the metals irl"); where a block can be several, the **material is a configure-setting
  on the block**. Material drives damage (crumble/bend/shatter), mass, floating.
- Q19 Teaching uses: **PURE DISCOVERY. No hints ever.** (Hardcore.) — the ring shows icon + name only.
- Q20 Mech primitives (all four): **gears, axles/shafts, hinges + pistons, clutch/belt/chain** —
  gearboxes, active aero, suspension arms, winches etc. are BUILT from these.
- Q21 Duck: **ALL OF IT** — Tomathy/Jimothy is a track hazard (waddles across), RIDEABLE (saddle;
  slow, unstoppable, pace car), and pit commentator (quacks, reacts to epic moments).

### R6 / PACK 6 (heat / brakes / steering / ERS)
- Q22 Heat: exists, **"not required at all but it can improve your performance"** — cooling is
  optional optimisation (radiators in airflow keep you at peak), neglect = mild loss, not failure.
- Q23 Brakes: **brake blocks with front/rear bias, fade when hot, regen braking for motors**.
- Q24 Steering: **built from hinges "and stuff"** — steering is a mechanism assembled from the
  mech primitives (hinge + axle + …), not a dedicated steering block.
- Q25 ERS: **yes, all of it, with understandable names: "Brake Harvester", "Heat Harvester"**
  (+ deploy button w/ per-lap budget). Electric family grows accordingly.

### R7 / PACK 7 (flipped / weather / limits / blueprints)
- Q26 Flipped: **BOTH** — reset exists but costs (time + a chunk of fuel/battery); physical flips
  (piston flipper, friend push, Tomathy) are free.
- Q27 Weather: **rain, wind, night, fog/dust — all** + "dust blows up from tires on dirt, clouds
  screen, all sorts of fun stuff — **this is Sledding Game for engineers**".
- Q28 Limits: **max 20 people per room with proxy chat. NO limit on blocks, NO limit on weight.
  No limits.** (perf is my problem → LOD/budgeting must scale.)
- Q29 Blueprints: **GALLERY** — save + share codes + a public gallery of builds with pictures,
  **sorted/filtered by track tags** etc.

### R8 / PACK 8 (controls + GAMBLE)
- Q30 Binding: **per-block bindings + global presets** — AND the steering preset gets a
  **"towards mouse"** option, and maybe **"towards nearest block" ("missiles???")** — homing steer.
  Also: he wants MORE silly questions in the packs.
- Q31 Devices: **keyboard + mouse, gamepad** (wheel/phone not now).
- Q32 Rebind UI: **full menu + profiles** (deadzone/sens/invert per axis, conflict warnings,
  import/export).
- Q33 GAMBLE doors → he picked **Door 2 = the free bonus** (pre-decided: 1 = must name the game
  this session, 2 = a free extra block category of his choice built first, 3 = one silly-shaped
  block). Reward claimed in R9.

### R9 / PACK 9 (prize / weapons / camera / horn)
- Q34 PRIZE families (he took all three): **Weapons/gadgets, Tools (winch/claw/flipper/tow hook),
  Lights + decor** get built FIRST among new block families. (Boats after.)
- Q35 Weapons: **gadgets, ROOM TOGGLE** — off = pure racing; on = missiles/oil/smoke/EMP are
  blocks you build on (weight + drag, all physical); homing missiles use "towards nearest block".
- Q36 Camera: **fully player-configurable — free cam, chase cam ("attached like behind you"),
  top-down, FPS. "Screw it."** (Supersedes "camera is fixed top-down": top-down stays the
  default/art-canon view, but the player can pick.)
- Q37 Horn default: **meep meep**.

### R10 / PACK 10 (default cam / mouse steer / crew / win text)
- Q38 Default camera: **top-down default, C cycles** (top-down → chase → FPS → free), remembered.
- Q39 Mouse steer: **A/D default; "towards mouse" is a preset** one click away.
- Q40 Crew: **each seat binds its own blocks (driver/gunner/engineer…) AND passengers-as-cargo
  seats exist** (weight, no controls). Crew racing is real.
- Q41 Win text: **"nice."** (lowercase, period.)

### R11 / PACK 11 (frames / wheels / engines / critter lore)
- Q42 Frames: **plates, beams, wedges/slopes, curved/round — all**.
- Q43 Wheels: **sizes small/medium/monster + casters/omni-wheels**. (No tank treads, no skis.)
- Q44 Engines: **tiers (3-cyl → V6 → V8 → V12), turbo/supercharger, jet + rocket thrusters,
  exhaust pipes — all.** BUT **intakes are NOT required: they INCREASE performance, amount
  depends on the engine** — e.g. a turbo alone ≈ +3 mph top speed, turbo WITH an intake ≈
  +20–40. (Supersedes "covered intake = choked engine": no intake = base power, intake = bonus.)
- Q45 Critter lore clarified: **Tomathy = the horse-sized saddled duck. JIMOTHY = "the raccoon
  with short spine syndrome"** — the internet sensation. Two pit critters.

### R12 / PACK 12 (electric / routing / aero / Jimothy)
- Q46 Electric: **all** — motor tiers + hub motors, battery sizes + solar panel, generator, Brake
  Harvester + Heat Harvester + Deploy button.
- Q47 Power routing — THE PRINCIPLE (stated twice now): **"you don't NEED wires, axles or gears,
  but they make it way better."** Adjacency is the baseline; explicit routing (axles/gears/wires)
  = bonus performance/control. Same law as intakes. Call it **OPTIONAL DEPTH**.
- Q48 Aero: **all** — wings (sizes + flaps; hinge = DRS), floor/diffuser/splitter (ground effect),
  fins/stabilizers, parachute + air brake.
- Q49 Jimothy: **"he's just a goob. cute lil raccoon noises, 'no thoughts head empty' chill guy."**

### R13 / PACK 13 (gadgets / tools / logic / loading screens)
- Q50 Gadgets: **oil slick / smoke dropper, ram plate / spikes** as blocks; **homing missiles must be
  ENGINEERED** from primitives — "everything has to be engineered. every block has more than 3
  uses, remember." (No missile block; thruster + sensor + logic + hinge = missile.)
- Q51 Tools: **winch + hook, grabber claw, magnet / tow bar**; a flipper kick is **engineered**
  (piston).
- Q52 Logic: **sensors AND logic blocks, FULL depth** — "you can make a pit limiter, an auto DRS,
  an overtake button etc. — those go from EASY to INSANELY HARD."
- Q53 Loading screens: **all of them** — "we're gonna make a bunch of meme-y loading screens and
  tooltips, gen-z humor: cute, dumb stuff, and diabolical shi."

### R14 / PACK 14 (boats / lights / seats / humor)
- Q54 Boats: **"no boats yet."** (Parked. Water stays in the world; boat blocks later.)
- Q55 Lights & decor: **all** — headlights/brake/indicators (bindable, brake auto-ties), underglow/
  neon/strips, flags/banners/number plates (texture-able), horn/siren/speaker (plays clips).
- Q56 Seats & control: **all** — seat types (kart/cockpit/saddle/bench), crew seats, remote-control
  block (drones/decoys/engineered missiles), camera block (bumper cam etc.).
- Q57 Humor note (my tips were WRONG register): he wants **gen-z / zillennial POV humor** — "POV:
  (diabolically absurdly specific situation)", "POV: (global situation everyone's experienced)",
  or an absurdly funny photo/expression. Study the register before writing any tooltip/loading
  screen. No dad-joke tips.

### R15 / PACK 15 (misc / fuel / pits / humor take two)
- Q58 Misc: **ballast weights, rubber bumpers/springs, cargo box** (no balloons). AND: "we should
  add all sorts of fun lil creatures, **a whole cast, they get houses** AWWWW — but **in its own
  huge update**."
- Q59 Fuel: **tank sizes + fuel types** (petrol / jet fuel / NITRO canisters; weight burns off;
  fuel lines = optional depth).
- Q60 Pit stops: **both, room setting** — auto (timed, Tomathy + Jimothy crew) / manual (you're
  the crew) / both.
- Q61 Humor, final word: loading screens are **captions PAIRED WITH PHOTOS, not extra text**.
  "STUDY OUR HUMOR." His reference: a "WHAT'S YOUR TYPE OF HUMOR?" video — *unexpected*: guy
  looks at a ladder, "are you good?", pans up, he's stuck on the ceiling, "i ate a balloon :3";
  *random*: "I, have a whistle." / "and I, am a missile" → turns into a human missile and slams
  into the other guy. → Don't write jokes for him; build the screen as image + caption slots he
  fills. I stop inventing tip text.

### R16 / PACK 16 (textures / livery / style / saddle)
- Q62 "Textures" means: **material looks (auto by material), player paint + decals, world textures
  (asphalt cracks, gravel, grass blades, kerbs, skid marks that stay)**. He did NOT pick "SVG on
  all faces" — the per-block SVG pipeline is not the texture plan.
- Q63 Livery: **in-game paint + decals + upload** (colour/flood-fill blocks, decal sheet, numbers/
  text, upload own PNG/SVG; liveries save with blueprint AND as reusable skins).
- Q64 Style: **"like Sledding Game textures — cartoony, but realistic shaders and attention to
  detail carry it."** (Flat-vector fills stay the base; real lighting/shadows/shader polish on top.)
- Q65 Saddle: **brown leather, boring, correct.**

### R17 / PACK 17 (shaders / world detail / decals / tire brand)
- Q66 Shaders: **real shadows + AO, gloss/metallic paint, rubber-in + skid marks** (no dirt build-up).
- Q67 World detail: **grass blades that bend, 3D kerbs that shake you, puddles + reflections**
  (no gravel ruts).
- Q68 Decal sheet: **numbers + letters (fonts), stripes/shapes/flames, parody sponsor logos**
  (no critter stickers by default).
- Q69 Tire brand: name TBD — **"the tires will be a future character, and it'll be an ARMADILLO."**
  (Cast so far: Tomathy the horse-sized duck, Jimothy the goob raccoon, the Armadillo of tires.)

### R18 / PACK 18 (config UI / unlocks / modes / budget)
- Q70 Config UI: **click a placed block → side panel** (material, dials, binds; Ctrl+C/V config).
- Q71 Unlocks: **everything available from the start EXCEPT some blocks are FOUND in the world —
  mostly decor.** (Exploration rewards = cosmetics, never performance.)
- Q72 Modes: **lap races, rally stages, elimination** (no tag/chase).
- Q73 Budget/points cost: **ranked only** → a ranked / league mode exists and uses points caps;
  casual rooms never have costs.

### R19 / PACK 19 (ranked / world / tracks / spectate)
- Q74 Ranked: **"not yet."** (Parked; budget caps wait for it.)
- Q75 World: **one continuous world + teleport pads** to each start line.
- Q76 Tracks: **both** — official hand-made tracks (his sketches, my build) + an in-game track
  editor (road pieces, kerbs, cones, checkpoints) with gallery sharing.
- Q77 Spectate: **in-room spectator + auto-director** (free cam / follow / director cuts to
  battles & crashes; Tomathy + Jimothy commentary).

### R20 / PACK 20 (saves / netcode / rooms / BET)
- Q78 Saves/accounts: **play + local garage without an account; a CONFIRMED account is required to
  post to the gallery and to make/publish tracks.**
- Q79 Netcode: **owner-sim + soft reconcile** (each PC sims its own car; contacts computed both
  sides and nudged to agree; shear decided by the car that got hit).
- Q80 Rooms: **codes + persistent named rooms** (group-owned room keeps settings/track list).
- Q81 BET (block count at the end): his guess **"probably 60–100, but I WANT 100–150."** Payout
  rule: guess right = he picks what I build first, period. (Count at Q400.)

### R21 / PACK 21 (rumble / input tuning / bind rules / duck speed)
- Q82 Rumble: **full** (kerbs, lock-ups, crashes, engine hum; per-source strength).
- Q83 Input tuning exposed: **steering sensitivity + linearity curve, speed-sensitive steering,
  per-axis deadzones, keyboard smoothing — all.**
- Q84 Bind rules: **full Trailmakers-grade** — one key → many blocks w/ own direction/amount,
  toggle or hold per block, analog axes → hinges/pistons, invertible.
- Q85 Tomathy ridden speed: **depends on how much bread he ate** (feed him in the pits; risky).

### R22 / PACK 22 (bodies / tick / wake / clips)
- Q86 Bodies: **multi-body + joint solver** (each rigid cluster a body; hinges/pistons/axles real
  joints). The right way, the hard way.
- Q87 Tick: **120 Hz fixed.** Reality check: "I don't have nearly enough friends for 20 to a room
  lmao, max like 6" → cap stays 20, design for 6.
- Q88 Wake: **depends on the car's shape and its exhausts** — per-car wake shaped by its geometry
  + exhaust placement (not one fixed tube).
- Q89 Clips: **NOT deterministic replays — record positions / "it just records your screen"** →
  clips = screen recording of the last N seconds (canvas capture ring buffer).

### R23 / PACK 23 (clip export / engine audio / units / circuit name)
- Q90 Clips go: **download (.webm) + gallery** (account); auto-moments land in a "moments" tray.
- Q91 Engine audio: **procedural from RPM + cylinders** (turbo whistle, exhaust length = tone).
- Q92 Units: **GAME units**, with hidden lore: speed unit **xTP/h = "Times Tomathy Per Hour"**;
  **1 xTP/h = Tomathy's canon speed at Low Feed = literally 1 mph** (find it in all sorts of stuff).
- Q93 Main circuit name: **"I'll name it later."**

### R24 / PACK 24 (build tools / the guy / hot build / coin flip)
- Q94 Build tools: **mirror mode, group select + copy/paste, undo/redo, grid + measure overlay — all.**
- Q95 The guy: **ragdoll + climb + swim** (cars tumble him, he climbs builds/kerbs, swims, carries).
- Q96 Hot build: **anyone, anytime** — open build mode mid-corner if you dare. Chaos.
- Q97 Coin flip for who writes default keybinds: he called **TAILS**; real flip ($RANDOM) came up
  **HEADS** → I write the default keybinds.

### R25 / PACK 25 (track editor / regions / time / Jimothy's bed)
- Q98 Track editor: **"you draw a line from top-down, adjust the thickness and boom there's your
  track, then you manually add kerbs"** — spline-drawn road + terrain sculpt + checkpoints/grid/
  pit boxes + kerbs/barriers/tire walls. (No snap-together road segments.)
- Q99 Launch regions: **2 GP circuits, an OVAL, a MotoGP track, rally stage, rock crawl + big
  hills, lake + beach, + "little engineering challenges" (e.g. rock-crawl to get an item).**
- Q100 Time: **room picks fixed time OR a ~20-min live cycle.**
- Q101 Jimothy sleeps in **Tomathy's saddle bag** (duck carries raccoon; they're friends).

### R26 / PACK 26 (bikes / challenges / music / bots)
- Q102 Bikes: **YES, real lean physics** (gyro + counter-steer + lean angle; rider ragdolls off).
- Q103 Challenges: **fetch (crawl/climb to an item) + distance jump board**.
- Q104 Music: **everywhere, always** — his soundtrack under everything, ducks under engine noise.
- Q105 Bots: **NO bots.** Humans only.

### R27 / PACK 27 (wheel variants / sensors / logic / snack)
- Q106 Wheel variants: **every size×compound combo is its own block** (9+ wheel blocks; the
  WHEELS ring looks rich; config stays light). Bet count goes up.
- Q107 Sensors: **all** — speed/RPM, distance/proximity, tilt/gyro, temperature/fuel/battery.
- Q108 Logic: **all** — AND/OR/NOT, timer/delay, compare/threshold, toggle/latch.
- Q109 Tomathy's snack: **the race leader's sandwich** (he knows who's winning).

### R28 / PACK 28 (HUD / HUD style / paint / Dillon)
- Q110 HUD: **lap / position / gaps on by default; fuel, speed, ERS, battery, minimap only if you
  turn them on in configure settings.**
- Q111 HUD style: **configurable overlay** (toggle/move/scale each element; minimal default).
- Q112 Paint: **per block + per face + spray** (click / Shift-click / hold), decals project.
- Q113 Armadillo's name: **DILLON.**

### R29 / PACK 29 (crispness / marks / damage FX / Dillon's job)
- Q114 Crispness: **vector-crisp at any zoom** (paint/decals/patterns rendered from vector data).
- Q115 Skid marks / rubber-in: **persistent per named room** — the track remembers for weeks.
- Q116 Damage FX: **all** — debris + CRUNCH, sparks when scraping, dents/bends (steel/alu),
  shatter shards (carbon).
- Q117 Dillon's job: **runs the tire shop in the pits** (opinions about your compound).

### R30 / PACK 30 (parts supply / teams / toggles / card pick)
- Q118 Parts supply: **infinite — in build you just put a new one on, OR hit REPAIR and it
  restores your build to the last time it came out of build mode** (snapshot on build-exit).
- Q119 Teams: **room option** (team colours, shared garage, team points).
- Q120 Extra room toggles: **damage strength slider (none/normal/REAL) + weather control.**
  (No collisions toggle, no block bans.)
- Q121 Card pick: he took **Clubs** — the skip pass was under **Hearts**. No pass.

### R31 / PACK 31 (start / limits / results / podium)
- Q122 Start: **F1 five lights + jump-start penalty** (ovals may roll).
- Q123 Track limits: **only in time trial** (cuts invalidate a TT lap; races = anything goes).
- Q124 Results: **podium (real top-3 builds) + "nice." + standings + auto-moments reel**, critters react.
- Q125 Podium drink: **a juice box.** (Sponsored.)

### R32 / PACK 32 (mech count / found decor / guy drip / secrets)
- Q126 Mech: **full + exotic (~16)** — gears ×3 sizes, axles ×3 lengths, free hinge, powered hinge,
  piston, clutch, belt, chain, spring, + differential, ratchet, flywheel, universal joint.
- Q127 Found decor: **all** — bobbleheads/antenna toppers, trophies, hats for the guy, rare paints/decals.
- Q128 Guy drip: **hats + colours + your own SVG.**
- Q129 Secrets: **LOTS** — hidden tunnels, a Tomathy shrine, lore plaques, a secret track, codes.

### R33 / PACK 33 (graphics / platform / join / shrine)
- Q130 Graphics: **auto preset + per-toggle** (shadows, AO, grass, reflections, airflow viz, particles).
- Q131 Platform: **browser now; desktop app "way later".**
- Q132 Join flow: **codes only** (4 letters).
- Q133 Tomathy shrine: **in a tunnel you need a winch to reach** (tools family meets lore).

### R34 / PACK 34 (sounds / voice / replays / bet)
- Q134 Sounds: **tire squeal/gravel spray, wind rush + tow whoosh, critter voices** (no crowd ambience).
- Q135 Voice: **proximity + team radio** (push-to-talk to teammates anywhere).
- Q136 Replays: **YES — position replays + free cam + director; clips can be cut from replays.**
- Q137 BET final: **switched to 100–150 blocks.**

### R35 / PACK 35 (frame count / exhaust / decor / noises)
- Q138 Frames: **full family (~14)** — cubes 1/2/3, plates ×3, beams ×3, wedges ×2, curves ×3.
- Q139 Exhaust/dressing: **straight + bent pipes, backfire tip, air filter / velocity stacks**
  (no side-exit stacks).
- Q140 Decor: **all** — mirrors + antenna (mirrors work in FPS), flag pole + banners, number +
  name plates, horn variants.
- Q141 Jimothy's noises: **"mrrp and chirps and a lil blep."**

### R36 / PACK 36 (ARG / moderation / first car / shop)
- Q142 ARG: he went back and couldn't find the letters → hint given in R37 (scrambled letters).
- Q143 Moderation: **open and wild** (public, no tools, trust).
- Q144 First car: **a starter car** parked ahead, learn by poking.
- Q145 Tire shop: **"Dillon's".**

### R37 / PACK 37 (ARG solved / tunnel data / telemetry / debris)
- Q146 **ARG SOLVED: "DRAFTING"** → reward: a secret block of his choice, built free (claimed in
  R38); and **"DRAFTING" is the in-game name for slipstream.**
- Q147 Tunnel readouts: **drag + downforce + front/rear balance %.**
- Q148 Telemetry: **yes — a telemetry page** (lap graphs, overlay a friend's lap).
- Q149 Debris: **a track button sends a BIG PLOW CAR that plows debris to the sides — or auto-clear.**

### R38 / PACK 38 (prize / plow / flags / pit limit)
- Q150 ARG prize: **BANKED** — one secret block of his choice, owed, cash any time.
- Q151 Plow driver: **"Corval"** (new name — who/what Corval is asked in R39).
- Q152 Flags: **yellow/blue/red + safety car** bunches the field after big crashes (room toggle).
- Q153 Pit lane: **speed limit, NO penalty** (a limiter is handy, engineer it yourself).

### R39 / PACK 39 (Corval / safety car / NPCs / scratch)
- Q154 Corval: **a new critter** (species asked R40). Cast: Tomathy (duck), Jimothy (raccoon),
  Dillon (armadillo), Corval (?).
- Q155 Safety car: **TOMATHY drives the safety car**; Corval drives the plow.
- Q156 NPCs: **all critters. "The one human is worshipped — it's weird."** (clarified R40.)
  (Also: he got a salami sammich.)
- Q157 Scratch card: **Spot 3 → his banked secret block MUST BE SILLY** (spot 2 was the double).

### R40 / PACK 40 (Corval / the human / perf / safety car)
- Q158 Corval: **an OTTER who always has some coral — he loves coral, knows all about it.** Drives the plow.
- Q159 The worshipped human: **one human NPC who lives in the world** (name/role asked R41).
- Q160 Perf: **physics LOD** — near cars full 120 Hz multi-body, far cars simplified, parked cars sleep.
- Q161 Tomathy's safety car: **a golf cart.**

### R41 / PACK 41 (the human / purple / air control / daily)
- Q162 The worshipped human NPC: **"a guy who got lost in the woods when he was 8. got adopted
  (by the critters) and adapted."**
- Q163 Purple airflow = **reversed or trapped flow** (air going the wrong way through the car, or
  stuck in a pocket with no exit).
- Q164 Air control: **a little arcade help** (small pitch/roll authority so jumps are less lethal).
- Q165 Heartbeat: **DAILY challenge — gives you a track + modifiers, like Google Snake's daily.**

### R42 / PACK 42 (modifiers / rewards / colourblind / the human's name)
- Q166 Daily modifiers: **forced weather/time, physics twists, track twists** (no block bans).
- Q167 Daily rewards: **board + streaks** (streaks unlock small cosmetics).
- Q168 Airflow accessibility — already planned by him: **line STYLE carries meaning: smooth/great =
  straight, good = kinda wavy, eh = jagged triangle wave, bad = X's** (colour is the second cue).
- Q169 The human's name: **"Krisssstoper"** — "very confident on the s's, he kinda didn't know how to
  spell his name lol."

### R43 / PACK 43 (engine dials / wing dials / wheel dials / Kris)
- Q170 Engine config: **the kind of fuel** (that's the dial; rev/mixture/sound not chosen).
- Q171 Wing config: **angle of attack (continuous), flap stages, endplates on/off, material — all.**
- Q172 Wheel config: **camber + toe, tire pressure, brake bias link** (no steer lock — steering
  is a hinge mechanism).
- Q173 Krisssstoper: **"he's just a chill guy."**

### R44 / PACK 44 (hinge / gear / seat dials / crate)
- Q174 Hinge/piston config: **range limits, speed, power/torque, spring-return vs hold — all.**
- Q175 Gear/axle/clutch config: **ratio override, free-spin vs locked, direction flip, clutch engage point — all.**
- Q176 Seat config: **role slot, default camera per seat, eject-on-shear toggle, seat belt — all.**
- Q177 Loot crate: **Crate B = WIN → he invents one daily modifier for the pool** (typed in R45).

### R45 / PACK 45 (modifier prize / tags / rally / oval)
- Q178 Modifier prize: **banked** (owed: he invents one daily modifier).
- Q179 Track tags: **type, surface, length + laps, difficulty + vibe — all.**
- Q180 Rally: **staggered solo starts (30 s) + live ghosts + splits; co-driver seat calls corners.**
- Q181 Oval: **standard laps, DRAFTING rules, pit windows, safety car.**

### R46 / PACK 46 (cap / bikes / map / gallery / sign-in)
- **CAP CHANGED: 75 rounds, not 100** ("400 of these is a bit much") → the marathon ends at R75;
  block-count bet settles at R75.
- Q182 Bikes: **MANUAL balance** (stick = lean; you hold the bike up yourself).
- Q183 Map: **~3 km across.** And: **"everything needs shadows and shaders, and light, and
  textures"** — full lighting pass is a pillar, not polish.
- Q184 Gallery: **in-game + a public web page.**
- Q185 Sign-in: **Google / Discord sign-in.**

### R47 / PACK 47 (first build / phys order / block order / NAME)
- Q186 FIRST BUILD after the marathon: **TEXTURES + LIGHTING PASS** (shadows, shaders, paint —
  make it look like the game before it plays like it).
- Q187 Physics order (when we get there): **weight → multi-body joints → aero + tunnel.**
- Q188 Block order (after prize families gadgets/tools/lights): **frames full family + wheel
  variants, engines/electric tiers + ERS, mech primitives**; aero family after the air sim.
- Q189 **NAME: "kracing"** — the game is now called **KRACING** (working title VROOM retired).

### R48 / PACK 48 (lighting / look / post FX / logo)
- Q190 Lighting: **real-time sun shadow maps moving with the day cycle + AO + a budget of dynamic
  lights near the camera** (headlights, neon, backfire).
- Q191 The look (from Sledding Game): **soft warm lighting + long shadows, rich ground detail,
  chunky cartoon proportions, saturated clean palette — all.**
- Q192 Post FX: **bloom (neon/backfire/brake glow), motion blur at speed, depth of field in
  replays/clips** (no vignette/grain).
- Q193 Logo: **Adam draws the KRACING logo (SVG), I wire it in** (menu, loading, favicon).

### R49 / PACK 49 (shading / ground art / sky / spin)
- Q194 Shading: **flat-shaded faces + real shadows + AO** (single specular band on carbon/steel).
- Q195 Ground art: **mix — his base tiles + procedural detail** (grain, cracks, blades, wet darkening).
- Q196 Sky: **his painted sky domes** (dawn/noon/dusk/night), the game fades between.
- Q197 Spin A → **he holds ONE VETO over any decision I make in the lighting pass.**

### R50 / PACK 50 (shadows / materials / props / cart)
- Q198 Shadows: **real sun shadows only** (blobs retired).
- Q199 Material patterns: **I generate them procedurally in his style** (SVG swatch override possible).
- Q200 Props: **mix — his billboards (trees/bushes/critters) + my 3D structures** (buildings, stands, rocks).
- Q201 Tomathy's golf cart: **a bread logo on the side.**

### R51 / PACK 51 (keyboard red lines / pad / new keys / coral)
- Q202 Keyboard red lines (ALL stay): WASD drive + A/D steer · on-foot W-toward-mouse + guy faces
  cursor · B build / E hop / F grab · right-click ring / X remove.
- Q203 Gamepad default: **racing standard** (LS steer, RT throttle, LT brake, A ERS, B horn,
  X grab, Y camera, bumpers shift, Start build/menu).
- Q204 New keys: **cluster by hand position** (driving extras near WASD: Shift boost, Space
  handbrake, Q/E look, R reset, C camera, Tab map, V airflow, Ctrl+C clip; build extras near the
  mouse hand).
- Q205 Corval's coral: **he holds it. Always. Even driving.**

### R52 / PACK 52 (ring hover / ring order / panel / search)
- Q206 Ring: **click to open (keep).**
- Q207 Ring order: **basic → exotic, fixed, hand-ordered** (muscle memory).
- Q208 Config panel: **left edge** (right side stays clear for the ring hand); stays open while
  clicking blocks, Esc closes.
- Q209 Search: **yes — type while the ring is open, it collapses to matches from every category.**

### R53 / PACK 53 (decals / skins / uploads / Kris home)
- Q210 Decals: **drag to place, scroll resize, R rotate; mirror mode copies across the centreline.**
- Q211 Skins: **their own gallery item** (apply to compatible builds); blueprints still carry paint.
- Q212 Uploads: **any PNG/SVG up to ~1 MB; sharing needs the signed-in account.**
- Q213 Krisssstoper lives in **the old commentary box** above the main straight.

### R54 / PACK 54 (fragility / grip / top speed / cart speed)
- Q214 Fragility default: **"you choose the lobby difficulty"** → the room picks the damage level
  at creation; no hidden global default.
- Q215 Grip: **sim-cade** (real-ish curves, catchable slides).
- Q216 Top speed: **uncapped, physics decides — AND things should just snap off at high speeds**
  (aero loads / flutter shear flimsy parts).
- Q217 Tomathy's golf cart: **30 xTP/h, bread-independent.**

### R55 / PACK 55 (spawn / duck level / music / mixer)
- Q218 Spawn: **plaza with garage pads** (pits, Dillon's, shrine tunnel entrance, teleport pads around it).
- Q219 Tomathy on track: **rare, fixed** (once a race max; not a setting).
- Q220 Music: **one folder (assets/music/*.mp3) + list file with mood tags (menu/build/race/night),
  shuffle within mood; untagged = everywhere.**
- Q221 Audio: **full mixer** (master, music, engines, effects, voice, critters).

### R56 / PACK 56 (host leaves / daily reset / perf / shop hours)
- Q222 Host leaves: **ownership passes to the next player** (longest-present); room continues.
- Q223 Daily reset: **one global moment** (e.g. 4 pm his time) — friends race the same daily together.
- Q224 Perf target: **60 fps on a mid laptop at low preset** (his PC runs high).
- Q225 Dillon's hours: **24/7, he never sleeps.**

### R57 / PACK 57 (publish / replay store / clip res / gallery look)
- Q226 Track publishing: **publish anything** (no validation lap).
- Q227 Replays: **last 10 locally + pin to gallery with account.**
- Q228 Clip resolution: **1080p 60 fps.**
- Q229 Gallery look: **card grid with spinning 3D previews for builds; TRACK cards are an FPV
  drone flying through the track; SKIN cards show the colour + pattern like fabric sliding, with
  the decals/drawings patterned on.**

### R58 / PACK 58 (must-builds / settings / Kris rule)
- Q230 Must be buildable day one: **DRS, active suspension, homing missile** (gearbox not required
  day one).
- Q231 Also: **crane/claw truck, trailer with hitch, bike (2 wheels inline)** (self-righting
  flipper not required).
- Q232 Settings menu: **"super fun and easy to read, with things like rainbow text"** (not a dry
  tab page; playful, legible).
- Q233 Krisssstoper's ONE rule on the sign: **"LAUGH"** (his correction — not "be nice to the otter").

### R59 / PACK 59 (profile / bike blocks / density / high card)
- Q234 Profile page: **yes** — builds, tracks, skins, best laps, daily streak; you choose which builds show.
- Q235 Bike blocks: **handlebar (hinge preset), bike saddle seat, narrow bike wheels front/rear**
  (no kickstand).
- Q236 Found decor density: **~30 hidden items at launch.**
- Q237 High card: he drew **Seven vs my pre-drawn Queen → lost.** The "silly" rule on his banked
  secret block STAYS.

### R60 / PACK 60 (lore / critter spots / export / plow name)
- Q238 Lore: **plaques + environment + audio logs** (short hidden voice clips — Kris talking, subtitled quacks).
- Q239 Critter spots (pre-houses update): **each has a spot in the plaza/pits** — Tomathy by the
  golf cart, Jimothy in the saddle bag, Dillon at his shop, Corval by the plow.
- Q240 Export: **yes — whole garage as one file, import anywhere.**
- Q241 Corval's plow is named **PLOWVAL.**

### R61 / PACK 61 (two GPs / oval / rally / universe)
- Q242 Two GPs: **one fast & flowing, one tight & technical — "I'll draw another, you'll make [one]"**
  → Adam sketches one GP circuit, I author the other.
- Q243 Oval: **steep banking** (flat-out, 3-wide, DRAFTING decides).
- Q244 Rally stage: **~2 minutes point-to-point** (gravel, crests, water splash, jumps, tree hairpins).
- Q245 **KRACING is part of THE UNIVERSE** ("kRacing is part of it all") — Tomathy, Jimothy,
  Dillon, Corval, Krisssstoper are universe canon.

### R62 / PACK 62 (≥3-uses ideas / loading bar)
- Q246 Wheel uses: **flywheel, spin-attack, and "if you spin it super fast then detach it, it goes
  FLYING"** (launch a wheel as a projectile).
- Q247 Seat uses: **camera mount, tow/winch anchor, critter carrier, ejector — all.**
- Q248 Intake uses: **vacuum (sucks small debris into cargo), reverse = air brake, horn resonator.**
- Q249 Loading bar: **random — all of them** (duck lap / rolling tire / growing coral / bread eaten).

### R63 / PACK 63 (pad build / late join / next track / podium cast)
- Q250 Build on gamepad: **full support** (stick cursor, RT place, X remove, RB ring, bumpers rotate).
- Q251 Late join: **join from the pits, a lap down.**
- Q252 Next track: **no UI — "hey guys meet up at ___" over VC; the room owner can TELEPORT
  everyone there.** (Owner teleport-all is a feature.)
- Q253 Podium ceremony: **Corval shows everyone the coral** (only that; unprompted, detailed).

### R64 / PACK 64 (categories / empty tank / griefing / coral facts)
- Q254 Ring categories: **~13 families** — FRAMES · WHEELS · SEATS · ENGINE · ELECTRIC · AERO ·
  MECH · SENSORS+LOGIC · TOOLS · GADGETS · LIGHTS+DECOR · BIKE · MISC.
- Q255 Out of fuel/battery: **push it, Tomathy tows you, reset to pits w/ penalty, beg a friend
  for a tow — all.**
- Q256 Griefing: **pit lane + pads are safe zones AND vote-kick** (plus owner kick).
- Q257 Corval's coral facts: **"he has like 80 banked facts that are actually TRUE"** → real coral
  facts, a pool of ~80, delivered randomly.

### R65 / PACK 65 (hot reload / his art / billboards / laps)
- Q258 Hot reload: **T reloads everything in assets/** (sprites, tiles, skies, swatches, decals,
  music list, logo).
- Q259 Adam draws FIRST: **the KRACING logo** (skies/tiles/critters later or mine).
- Q260 Billboards: **NO — make critters/trees/props 3D from primitives in his palette**
  (supersedes the R50 "mix": no sprite billboards; the guy.svg sprite may still exist).
- Q261 Race length: **room picks, default 5 laps.**

### R66 / PACK 66 (weather FX / menus / mic / cam feel)
- Q262 Weather FX: **all** — rain (drops + wet sheen + spray), wind (grass/flags/dust streaks),
  fog depth fade, lightning + thunder at night.
- Q263 Menus: **playful chunky UI with the live 3D plaza behind it** (critters wandering, daily on a
  card, rainbow text where fun).
- Q264 Mic default: **open mic + M mute; team radio = push-to-talk.**
- Q265 Camera feel toggles: **all** — FOV slider, screen shake toggle, speed pull-back toggle +
  strength, look-behind/side keys.

### R67 / PACK 67 (playtest / must-feel / cameos / plaza)
- **SPELLING: it's "kRacing"** (lowercase k, capital R) — his correction. Use it everywhere.
- Q266 First playtest: **straight into a friend room** (chaos is data).
- Q267 Must already feel right: **looks like a game (shadows/lighting/sky), ring + building flow,
  plaza + critters present, paint + decals — all four.**
- Q268 Universe cameos: **yes — other universe characters can appear as NPCs** in kRacing.
- Q269 The plaza: **Kris's Corner.**

### R68 / PACK 68 (worry / cadence / feedback / statue)
- Q270 Biggest worry: **THE LOOK** (lighting / textures / vibe) — get this right first.
- Q271 Cadence: **milestones, each playtestable the same day** (lighting pass → push, blocks → push…).
- Q272 Feedback: **chat only.**
- Q273 Kris's Corner statue: **Kris himself (he's embarrassed, walks past it fast).**

### R69 / PACK 69 (references / palette / default time / plaque)
- Q274 Visual references to study: **Untitled Goose Game + Astroneer** (+ Sledding Game).
- Q275 Palette: **"let's make a palette"** — we build a shared kRacing palette together (a swatch
  file in the repo) before the pass.
- Q276 Default time of day: **golden hour.**
- Q277 Kris's statue plaque: **"got lost. got found."**

### Adam's custom GP course (his sketch, 2026-08-21)
- File: `assets/tracks/adam-gp.svg` (from his Scratch export "costume3.svg"). Main loop with a
  long flowing top-right straight/sweeper down to a bottom-right hairpin-ish return; a PIT LANE
  along the left inside edge; and an OPTIONAL EXTRA SECTION (the triangular loop off the bottom
  right — "an extra area you can choose to do") = an alternate/longer route joined to the lap.
  This is the GP he draws; I author the other one (Q242).

### R70 / PACK 70 (Adam's course rules)
- Q278 Optional section: **room picks** (joker / free / always / never).
- Q279 His course is **its own THIRD GP** (so: his GP + my fast one + my technical one).
- Q280 Direction: **clockwise; start/finish in the middle of the straight that has the pit lane**
  (the left side).
- Q281 Course name: **"L8ter"** (his answer verbatim — working name until he renames).

### R71 / PACK 71 (missed / banked / veto / tagline)
- Q282 Missed: **"we should add literal BILLBOARDS that my art goes on"** — trackside advertising
  boards (grandstands, straights, plaza) showing Adam's drawings / parody sponsor art; a simple
  assets/billboards/ folder → boards pick from it.
- Q283 Banked prizes: **still banked** (silly secret block + his daily modifier).
- Q284 Veto: **saved for the lighting pass.**
- Q285 Tagline: **"build it · race it · lose a wheel"** stays.

### R72 / PACK 72 (priority / billboards / board art / lake) — marathon paused here ("make the first update")
- Q286 After the lighting pass, the next THREE: **blocks flood, physics core, controls + config
  panels + gamepad** (tracks/world after those).
- Q287 Billboards stand: **along main straights, on grandstands, in Kris's Corner, small signs on the
  rally stage / rock crawl — all.**
- Q288 Board art: **his drawings (assets/billboards/ rotates through them), parody sponsors, and one
  LIVE board in the plaza showing today's daily + leaderboard** (no friend uploads).
- Q289 The lake: **Lake Tomathy.**

## UPDATE 1 (started 2026-08-21): the LOOK + Kris's Corner + paint v1 + cameras
Plan: `~/.claude/plans/make-the-firdst-update-purring-lobster.md` — Part A lighting/shadows/sky/
ground/post-FX/palette/rename; Part B critters/billboards/paint+decals v1; Part C cameras (C cycles
top-down → chase → FPS → free; his add-on: "also add camera in this update").
**Shipped 2026-08-21 (milestone 1):** lighting/shadows/sky/tiles/kerbs/post-FX/presets/palette/
rename, Kris's Corner (4 critters + Kris + statue + signs + billboards + grandstand + booth),
paint + decals v1, cameras (top/chase/fps/free). See README "UPDATE 1".

## BLOCKS PACKS (2D era, 2026-08-22) — 5 packs × 4, brainstorm for the "blocks flood"
Context: 2D pivot done; 28 blocks exist (frames ×3, lead, foam, plate, bumper, seat, wheel, slick,
monster, caster, engine, v8, turbo, tank, jerry, intake, battery, bigbatt, motor, fan, solar, wing,
nose, wedge, curve, fin). Answers below decide what floods next.

### B1 / PACK 1 (order / wheels / mech / banked prize)
- B1.1 Order: **PANELS FIRST** — "i want panels that i can use to make my car look cool like the
  besiege panels." (Besiege-style body panels = the first new family; reshuffles the old Q188 order.)
- B1.2 Wheels: **3 sizes × 4 compounds** (1×1 / 2×2 / 3×3 × road / slick / off-road / spiked)
  + caster = 13 wheel blocks. Size = grip radius + mass; compound = surface multipliers.
- B1.3 Mech in 2D: **hinge = trailer joint** (splits the machine into two pivoting bodies),
  piston = extends on a bind (ram/flipper), rotor = spins what's attached (flail).
- B1.4 Banked silly secret block: **KEEP BANKED.**

### B2 / PACK 2 (panels)
- B2.1 Shape kit: **FREE-DRAW PANEL** — one PANEL block; you drag/click a polygon over your frame
  and it becomes a panel shape ("the player literally makes the panel shapes"). No preset kit.
- B2.2 Placing: **thin blocks** — a panel occupies the cells its polygon covers (1 layer, light,
  no grip); normal stack rules. Drawn as the real polygon, not as cells.
- B2.3 Uses: **looks (paintable) + aero (front-face panel = streamlined) + armour (panel takes
  shear before the block under it) + HIDE YOUR BUILD** — others see your skin, not your engines;
  ramming panels off = spying.
- B2.4 Coin flip: **VOIDED** by B2.1 (no preset shapes to win/hide); it was tails, for the record.

### B3 / PACK 3 (draw tool / gadgets / thrusters / crates)
- B3.1 Panel draw tool: **click points, snap to grid corners + cell centres**; click first point to
  close; right-click undoes a point.
- B3.2 Gadgets (room toggle): **oil dropper (slick puddle tile, grip ×0.2, fades), smoke (cloud hides
  YOUR car on others' screens), spikes (contact shears their block), ram plate (your impulse ×2,
  theirs ×0.5) + 5th: CALTROPS** (dropped spikies puncture wheels: grip halves until pit / Q).
- B3.3 Thrusters: **BOTH** — ROCKET (fuel, big thrust while held, works mid-air, glows) and ION
  (battery, weaker, steady; pairs with solar/fans). Facing blocks, bindable; sideways = drift
  control; thruster + hinge + 'towards nearest block' = engineered missile.
- B3.4 Crate C → **I build ONE extra silly block of MY design** (pre-written outcome; A = critter
  fact, B = he vetoes one of my block stats).

### B4 / PACK 4 (tools / power+config / decor / tooltip)
- B4.1 Tools: **TOW HOOK + ROPE first** — hook block; bind near another machine/prop → rope links
  you (tow a dead friend, slingshot a pole, drag a trailer). Magnet/winch later.
- B4.2 Power + config (his words, verbatim-ish): **brakes are configurable to specific wheels, up to
  4 per brake block, "just like an engine"** (engines assign to up to 4 wheels too) **and their
  INPUTS (binds) are configurable — by RIGHT-CLICKING the placed block** (opens its config).
  **Right-click on EMPTY space (not on your build) = opens the parts ring.** Also ADD the other
  engines (PUTT 1×1 lawnmower, JET 3×3 turbine). **JET needs 1 intake; the NORMAL engine needs
  NO intakes — intakes just improve it slightly.** (V8: unchanged at 2 until he says otherwise.)
- B4.3 Decor: **decor only, NO night/day cycle** — FLAG (waves, texture-able), NUMBER PLATE
  (your number/name), ANTENNA (wobbles), HORN (plays a clip).
- B4.4 Jerrycan tooltip: **"do NOT shake"**.

### B5 / PACK 5 (logic / found / ship order / bet)
- B5.1 Logic (his spec): **"a pit limiter would be a Speed Sensor, set to >60, then it outputs to
  brakes on 100% harshness, then it brings you down to 60."** So SENSORS carry their own threshold
  dial and WIRE STRAIGHT INTO a block's input with an amount (no separate compare/switch).
  Add: **SPEED sensor, PROXIMITY sensor, AND, OR, NOT, NOR.**
- B5.2 Found-in-world: **nothing hidden this flood** — everything in the ring from the start.
- B5.3 Ship order: **ONE GIANT PUSH.**
- B5.4 Bet: **HOLD 100–150.**

**THE FLOOD (locked by B1–B5):** free-draw PANEL (points snap to grid; thin block; paint/aero/
armour/hide) · 13 wheels (3 sizes × road/slick/off/spiked + caster) · BRAKE (assign ≤4 wheels,
bindable, harshness) · engines assign ≤4 wheels · PUTT + JET engines (jet needs 1 intake, normal
needs 0, intakes = small bonus) · right-click block = config panel, right-click empty = ring ·
HINGE (trailer joint) / PISTON / ROTOR · OIL / SMOKE / SPIKES / RAM PLATE / CALTROPS (room toggle) ·
ROCKET + ION thrusters · TOW HOOK + ROPE · FLAG / NUMBER PLATE / ANTENNA / HORN · SPEED + PROXIMITY
sensors, AND / OR / NOT / NOR · one silly block of mine (crate C) · jerrycan tooltip "do NOT shake".


## UPDATE 2 — BLOCKS FLOOD shipped 2026-08-22 (one giant push, per B5.3)
Everything in "THE FLOOD" above is live: free-draw PANEL (snap points, one-level rule, paint/aero/armour/hide),
13 wheels + BRAKE (per-wheel, harshness, lock = slide), engines + brakes pick ≤4 wheels, right-click block = config card /
right-click empty = ring, PUTT + JET (jet = thrust block, spools, needs 1 intake; normal engine needs 0, intakes +8 % each;
V8 needs 1), HINGE segments (trailer swings on a pin, limits ±1.5 rad, reaction drags the body), PISTON (edge punch,
wall-kick hop), ROTOR (spin, reaction torque, 2 at full spin = hop, saw ×2 on contact), OIL / SMOKE / SPIKES / RAM /
CALTROPS (+ the crate-C silly block), ROCKET + ION, TOW HOOK + rope (spring, both clients pull their own), FLAG /
NUMBER PLATE / ANTENNA / HORN (synth clips), SPEED + PROXIMITY sensors with threshold → wires with amounts,
AND/OR/NOT/NOR. Gadgets room toggle on the CREATE ROOM card. Count: 63 blocks.
- 2026-08-22 (after the push): **"make the tire compound configurable"** → compound is a SETTING on the wheel (right-click → ROAD / SLICK / OFF-ROAD / SPIKED), wheel blocks collapse to S / M / L + caster (the 9 per-compound blocks alias-load into these). Count: 54.
- 2026-08-22 (Adam: "driving 120, it apparently breaks at 100, but it wasn't breaking" + "aero blocks should increase the
  speed to shear things off behind it"): **your SPEED is the wind on the track** — past the build's break point parts rip
  off while driving (one per 0.35 s, debris tumbles back, seat gone = eject). **Air flows through the build column by
  column:** a cell with nothing ahead takes load 1; every other part ahead in its column cuts it ×0.2 if AERO (nose /
  wedge / curve / panel) or ×0.5 if blunt; a part's own body doesn't load itself; aero parts take half. Readout says
  "BREAKS AT N mph (wind or your speed)".
