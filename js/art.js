/* =============================================================================
   art.js — Adam's drop-in SVG pipeline. He draws, the game hot-reloads (T).
     assets/parts/<type>.svg     the whole part, seen from above (forward = UP)
     assets/guy.svg              the little guy from above
     assets/critters/<name>.svg  Kris's Corner cast
     assets/props/<name>.svg     cart, plow, cone, bush, tree, statue, sign…
   Each file is rasterized on demand at the size it's drawn (bucketed), so his
   vectors stay crisp at any zoom. Missing/broken file = the code-drawn fallback
   stands in. Never a crash.
   ============================================================================= */
export const ART = {
  parts: ['frame1', 'frame', 'frame3', 'seat', 'wheel', 'engine', 'tank', 'intake', 'battery', 'motor', 'fan', 'wing', 'nose', 'wedge', 'curve', 'lead', 'foam', 'plate', 'bumper', 'monster', 'slick', 'caster', 'v8', 'turbo', 'jerry', 'solar', 'bigbatt', 'fin',
    'panel', 'wheel1', 'wheel3', 'slick1', 'slick3', 'knobby1', 'knobby', 'spike1', 'spike', 'spike3', 'brake', 'putt', 'jet', 'rocket', 'ion', 'hinge', 'piston', 'rotor',
    'oil', 'smoke', 'spikes', 'ram', 'caltrops', 'banana', 'hook', 'flag', 'numplate', 'antenna', 'horn', 'sensespeed', 'senseprox', 'and', 'or', 'not', 'nor'],
  critters: ['tomathy', 'jimothy', 'dillon', 'corval', 'kris'],
  props: ['cart', 'plowval', 'cone', 'bush', 'tree', 'statue', 'tire', 'flower'],
};
const IMG = new Map();        // key -> HTMLImageElement (decoded)
const RAS = new Map();        // key@px -> canvas
const BUCKETS = [12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768];

function loadOne(key, url){
  return new Promise(res => {
    const img = new Image();
    img.onload = () => { if(img.naturalWidth > 0 && img.naturalHeight > 0){ IMG.set(key, img); } else IMG.delete(key); res(); };
    img.onerror = () => { IMG.delete(key); res(); };
    img.src = url + '?t=' + Date.now();
  });
}

export async function loadArt(){
  RAS.clear();
  const jobs = [loadOne('guy', './assets/guy.svg')];
  for(const n of ART.parts) jobs.push(loadOne('parts/' + n, './assets/parts/' + n + '.svg'));
  for(const n of ART.critters) jobs.push(loadOne('critters/' + n, './assets/critters/' + n + '.svg'));
  for(const n of ART.props) jobs.push(loadOne('props/' + n, './assets/props/' + n + '.svg'));
  await Promise.all(jobs);
  return [...IMG.keys()];
}

export function hasArt(key){ return IMG.has(key); }
export function artImg(key){ return IMG.get(key) || null; }

/* rasterized copy of an SVG whose LONGEST side is ~px pixels (bucketed, cached) */
export function raster(key, px){
  const img = IMG.get(key); if(!img) return null;
  let b = BUCKETS[BUCKETS.length - 1];
  for(const v of BUCKETS){ if(v >= px){ b = v; break; } }
  const k = key + '@' + b;
  let cv = RAS.get(k);
  if(cv) return cv;
  const ar = img.naturalWidth / img.naturalHeight;
  const w = ar >= 1 ? b : Math.max(1, Math.round(b * ar)), h = ar >= 1 ? Math.max(1, Math.round(b / ar)) : b;
  cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  try {
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, w, h);
  } catch(e){ IMG.delete(key); return null; }
  RAS.set(k, cv);
  return cv;
}
