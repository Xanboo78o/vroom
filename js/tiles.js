/* =============================================================================
   tiles.js — ground textures. Generated luminance-only detail (grain, cracks,
   grass strokes) so the MATERIAL colour stays the palette's truth; drop
   assets/tiles/<name>.png (asphalt, shoulder, grass, sand, gravel, kerb) to
   replace any of them with Adam's art (then the material goes white and the
   tile carries the colour). T hot-reloads.
   ============================================================================= */
import * as THREE from 'three';
import { PAL, hex } from './palette.js';

const TEX = new Map();        // name -> texture (generated or Adam's)
const MATS = new Map();       // name|hex -> MeshLambertMaterial
let maxAniso = 4;

function canvas(n = 256){ const c = document.createElement('canvas'); c.width = c.height = n; return c; }
function rnd(a, b){ return a + Math.random() * (b - a); }

const GEN = {
  asphalt(){ const c = canvas(), x = c.getContext('2d'); x.fillStyle = '#f9f9f9'; x.fillRect(0, 0, 256, 256);
    for(let i = 0; i < 2600; i++){ x.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.10)'; const s = rnd(1, 2.2); x.fillRect(rnd(0, 256), rnd(0, 256), s, s); }
    x.strokeStyle = 'rgba(0,0,0,.11)'; x.lineWidth = 1;
    for(let k = 0; k < 3; k++){ x.beginPath(); let px = rnd(0, 256), py = rnd(0, 256); x.moveTo(px, py); for(let j = 0; j < 6; j++){ px += rnd(-30, 30); py += rnd(-30, 30); x.lineTo(px, py); } x.stroke(); }
    return c; },
  shoulder(){ const c = canvas(), x = c.getContext('2d'); x.fillStyle = '#fafafa'; x.fillRect(0, 0, 256, 256);
    for(let i = 0; i < 1800; i++){ x.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.10)'; const s = rnd(1, 2.6); x.fillRect(rnd(0, 256), rnd(0, 256), s, s); }
    return c; },
  gravel(){ const c = canvas(), x = c.getContext('2d'); x.fillStyle = '#f7f7f7'; x.fillRect(0, 0, 256, 256);
    for(let i = 0; i < 1400; i++){ x.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.14)'; const s = rnd(2, 4); x.beginPath(); x.arc(rnd(0, 256), rnd(0, 256), s / 2, 0, 7); x.fill(); }
    return c; },
  grass(){ const c = canvas(), x = c.getContext('2d'); x.fillStyle = '#f9f9f9'; x.fillRect(0, 0, 256, 256);
    x.lineWidth = 1.2;
    for(let i = 0; i < 1500; i++){ const px = rnd(0, 256), py = rnd(0, 256), l = rnd(4, 9), a = rnd(-.35, .35);
      x.strokeStyle = Math.random() < .5 ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.09)';
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.sin(a) * l, py - Math.cos(a) * l); x.stroke(); }
    return c; },
  sand(){ const c = canvas(), x = c.getContext('2d'); x.fillStyle = '#fafafa'; x.fillRect(0, 0, 256, 256);
    for(let i = 0; i < 2200; i++){ x.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.12)'; x.fillRect(rnd(0, 256), rnd(0, 256), 1.4, 1.4); }
    return c; },
  kerb(){ const c = canvas(), x = c.getContext('2d');              // coloured: red/cream stripes along v
    for(let i = 0; i < 4; i++){ x.fillStyle = hex(i % 2 ? PAL.kerbCream : PAL.kerbRed); x.fillRect(0, i * 64, 256, 64); }
    x.fillStyle = 'rgba(0,0,0,.07)'; for(let i = 0; i < 500; i++) x.fillRect(rnd(0, 256), rnd(0, 256), 1.5, 1.5);
    return c; },
};
const COLOURED = new Set(['kerb']);         // tiles that carry their own colour (material = white)

function finish(tex){
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAniso);
  tex.needsUpdate = true;
  return tex;
}

export function initTiles(renderer){
  if(renderer) maxAniso = renderer.capabilities.getMaxAnisotropy();
  for(const name of Object.keys(GEN)) if(!TEX.has(name)) TEX.set(name, finish(new THREE.CanvasTexture(GEN[name]())));
  loadAdamTiles();
}

export function tileTex(name){ return TEX.get(name) || null; }

/* a Lambert material with this tile, coloured by hex (or white if the tile is Adam's / coloured) */
export function tileMat(name, colour, repeat = 1){
  const k = name + '|' + colour + '|' + repeat;
  if(MATS.has(k)) return MATS.get(k);
  const base = tileTex(name);
  const tex = base ? base.clone() : null;
  if(tex){ tex.repeat.set(repeat, repeat); tex.needsUpdate = true; }
  const m = new THREE.MeshLambertMaterial({ color: (COLOURED.has(name) || (tex && tex.userData.adam)) ? 0xffffff : colour, map: tex, flatShading: true });
  m.userData = { tile: name, colour, repeat };
  MATS.set(k, m);
  return m;
}

/* Adam's overrides: assets/tiles/<name>.png — reload with T */
export function loadAdamTiles(){
  const loader = new THREE.TextureLoader();
  for(const name of Object.keys(GEN)){
    loader.load('./assets/tiles/' + name + '.png?t=' + Date.now(), tex => {
      tex.userData.adam = true; finish(tex); TEX.set(name, tex); swapAll(name);
    }, undefined, () => {
      const cur = TEX.get(name);
      if(cur && cur.userData.adam){ TEX.set(name, finish(new THREE.CanvasTexture(GEN[name]()))); swapAll(name); }
    });
  }
}
function swapAll(name){
  const base = TEX.get(name);
  for(const m of MATS.values()){
    if(m.userData.tile !== name) continue;
    const old = m.map;
    m.map = base.clone(); m.map.repeat.set(m.userData.repeat, m.userData.repeat); m.map.needsUpdate = true;
    m.color.setHex((COLOURED.has(name) || base.userData.adam) ? 0xffffff : m.userData.colour);
    m.needsUpdate = true;
    if(old) old.dispose();
  }
}
export function reloadTiles(){ loadAdamTiles(); }
