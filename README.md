# VROOM (working title)

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
