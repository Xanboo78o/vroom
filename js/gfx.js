/* =============================================================================
   gfx.js — graphics presets. Target: 60 fps on a mid laptop at LOW.
   low  = real shadows (1024, hard PCF), no post pipeline at all
   med  = 2048 soft shadows, MSAA 2, AO, motion blur
   high = 2048 soft shadows, MSAA 4, AO, bloom, motion blur
   Auto-detected from the GPU string, stepped down once if the first frames crawl.
   Saved in localStorage.kr_gfx; ?gfx=low|med|high overrides for testing.
   ============================================================================= */
export const TIERS = {
  low:  { shadow: 1024, soft: false, msaa: 0, ao: false, bloom: false, blur: false, composer: false },
  med:  { shadow: 2048, soft: true,  msaa: 2, ao: true,  bloom: false, blur: true,  composer: true },
  high: { shadow: 2048, soft: true,  msaa: 4, ao: true,  bloom: true,  blur: true,  composer: true },
};
const ORDER = ['low', 'med', 'high'];

export const GFX = {
  preset: 'auto',        // what the player chose ('auto' | tier)
  tier: 'med',           // what we're actually running
  onChange: null,        // main.js hooks this to rebuild the pipeline
  _acc: 0, _n: 0, _judged: false,
  get cfg(){ return TIERS[this.tier]; },
};

function detectTier(renderer){
  let gpu = '';
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : (gl.getParameter(gl.RENDERER) || '');
  } catch(e){}
  gpu = String(gpu);
  if(/SwiftShader|llvmpipe|Mesa OffScreen|Intel\(R\) (HD|UHD|Iris)|Mali|Adreno|Apple GPU/i.test(gpu)) return 'low';
  if(/GeForce|RTX|Radeon RX|Radeon\(TM\) RX|Arc\(TM\)/i.test(gpu)) return 'high';
  return 'med';
}

export function initGfx(renderer){
  const q = new URLSearchParams(location.search).get('gfx');
  const saved = localStorage.getItem('kr_gfx');
  GFX.preset = (q && TIERS[q]) ? q : (saved && (TIERS[saved] || saved === 'auto')) ? saved : 'auto';
  GFX.tier = GFX.preset === 'auto' ? detectTier(renderer) : GFX.preset;
  GFX._judged = q ? true : false;          // explicit ?gfx= never auto-steps
  return GFX.tier;
}

export function setTier(t, save = true){
  if(!TIERS[t] || t === GFX.tier && GFX.preset !== 'auto') { GFX.preset = t; }
  GFX.tier = t; GFX.preset = t;
  if(save) localStorage.setItem('kr_gfx', t);
  if(GFX.onChange) GFX.onChange(GFX.cfg);
}

export function cycleTier(){
  const i = ORDER.indexOf(GFX.tier);
  setTier(ORDER[(i + 1) % ORDER.length]);
}

// call once per frame while playing: on 'auto', step down once if the first ~120 frames crawl
export function sampleFrame(dt){
  if(GFX._judged || GFX.preset !== 'auto') return;
  GFX._acc += dt; GFX._n++;
  if(GFX._n < 120) return;
  GFX._judged = true;
  const avg = GFX._acc / GFX._n * 1000;
  if(avg > 22 && GFX.tier !== 'low'){
    const i = ORDER.indexOf(GFX.tier);
    GFX.tier = ORDER[Math.max(0, i - 1)];
    if(GFX.onChange) GFX.onChange(GFX.cfg);
    console.log('[kRacing] slow start (' + avg.toFixed(1) + ' ms/frame) → gfx', GFX.tier);
  }
}

export function tierLabel(){ return 'GFX · ' + GFX.tier.toUpperCase() + (GFX.preset === 'auto' ? ' (auto)' : ''); }
