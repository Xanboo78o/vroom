/* =============================================================================
   art.js — Adam's drop-in SVG pipeline (same deal as the shooter: he draws,
   the game hot-reloads). Each part type looks for assets/<type>.svg and shows
   it as its top face. Missing file = the code-drawn geometry stands in.
   Press T in game to re-load art mid-session.
   ============================================================================= */
import * as THREE from 'three';

export const ART_FILES = ['frame', 'seat', 'wheel', 'engine', 'tank', 'intake',
  'battery', 'motor', 'fan', 'wing', 'guy'];

const TEX = new Map();

export function artTex(name){ return TEX.get(name) || null; }

function loadOne(name){
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 128;
        const cx = cv.getContext('2d');
        cx.drawImage(img, 0, 0, 128, 128);
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        TEX.set(name, tex);
      } catch(e){ TEX.delete(name); }
      res();
    };
    img.onerror = () => { TEX.delete(name); res(); };
    img.src = './assets/' + name + '.svg?t=' + Date.now();
  });
}

export async function loadArt(){
  await Promise.all(ART_FILES.map(loadOne));
  return [...TEX.keys()];
}
