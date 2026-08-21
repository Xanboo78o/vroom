/* =============================================================================
   postfx.js — the post pipeline (med/high only; low renders straight).
   RenderPass → AO (depth-only SSAO-lite) → bloom (only emissives; threshold above
   the lit flat fills) → directional SPEED BLUR → OutputPass (sRGB, no tonemap).
   Ported from apex-racer/valcorsa's postfx and trimmed to kRacing's flat look.
   ============================================================================= */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Depth-only ambient occlusion: creases where blocks meet the ground / each other.
// 12 golden-angle taps, interleaved-gradient-noise rotation, world-radius projected to pixels.
const AO_SHADER = {
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    cameraNear: { value: 0.1 }, cameraFar: { value: 900 },
    tanHalfFov: { value: 0.6 },
    radius: { value: 0.45 }, strength: { value: 0.45 },
  },
  vertexShader: VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse, tDepth;
    uniform vec2 resolution;
    uniform float cameraNear, cameraFar, tanHalfFov, radius, strength;
    varying vec2 vUv;
    float linD(vec2 uv){
      float ndc = texture2D(tDepth, uv).x * 2.0 - 1.0;
      return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - ndc * (cameraFar - cameraNear));
    }
    void main(){
      vec4 col = texture2D(tDiffuse, vUv);
      float d = linD(vUv);
      if(d > 200.0){ gl_FragColor = col; return; }
      float rPx = radius * resolution.y / (2.0 * d * tanHalfFov);
      rPx = clamp(rPx, 1.5, 48.0);
      float ign = fract(52.9829189 * fract(0.06711056 * gl_FragCoord.x + 0.00583715 * gl_FragCoord.y));
      float rot = ign * 6.2831853;
      float occ = 0.0;
      for(int i = 0; i < 12; i++){
        float fi = float(i);
        float ang = rot + fi * 2.39996323;
        float r = rPx * sqrt((fi + 0.5) / 12.0);
        vec2 off = vec2(cos(ang), sin(ang)) * r / resolution;
        float dn = linD(vUv + off);
        float diff = d - dn;                          // neighbour closer to the camera by diff
        if(diff > 0.02 && diff < 1.2) occ += 1.0 - diff / 1.2;
      }
      float ao = 1.0 - strength * (occ / 12.0);
      gl_FragColor = vec4(col.rgb * ao, col.a);
    }`,
};

// Directional speed blur: smears away from the centre along the car's screen-space velocity.
const BLUR_SHADER = {
  uniforms: { tDiffuse: { value: null }, strength: { value: 0 }, dir: { value: new THREE.Vector2(0, 1) } },
  vertexShader: VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float strength; uniform vec2 dir; varying vec2 vUv;
    void main(){
      vec2 d = vUv - vec2(0.5);
      float falloff = smoothstep(0.08, 0.55, length(d));   // the middle stays crisp
      vec4 sum = vec4(0.0);
      for(int i = 0; i < 8; i++){
        float t = float(i) / 7.0 - 0.5;
        sum += texture2D(tDiffuse, vUv + dir * strength * falloff * t);
      }
      gl_FragColor = sum / 8.0;
    }`,
};

export const POSTFX = {
  composer: null, renderPass: null, aoPass: null, bloomPass: null, blurPass: null,
  cfg: null, renderer: null, scene: null, camera: null,
  _size: new THREE.Vector2(),
};

export function buildPostFX(renderer, scene, camera, cfg){
  disposePostFX();
  POSTFX.renderer = renderer; POSTFX.scene = scene; POSTFX.camera = camera; POSTFX.cfg = cfg;
  if(!cfg.composer) return null;
  const size = renderer.getDrawingBufferSize(POSTFX._size);
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { samples: cfg.msaa, type: THREE.HalfFloatType });
  rt.depthTexture = new THREE.DepthTexture(size.x, size.y);
  const composer = new EffectComposer(renderer, rt);
  // the scene may land in either ping-pong buffer — share ONE depth texture so AO reads live depth
  if(composer.renderTarget2.depthTexture) composer.renderTarget2.depthTexture.dispose();
  composer.renderTarget2.depthTexture = rt.depthTexture;
  POSTFX.renderPass = new RenderPass(scene, camera);
  composer.addPass(POSTFX.renderPass);
  if(cfg.ao){
    POSTFX.aoPass = new ShaderPass({ uniforms: THREE.UniformsUtils.clone(AO_SHADER.uniforms), vertexShader: AO_SHADER.vertexShader, fragmentShader: AO_SHADER.fragmentShader });
    POSTFX.aoPass.uniforms.tDepth.value = rt.depthTexture;
    composer.addPass(POSTFX.aoPass);
  } else POSTFX.aoPass = null;
  if(cfg.bloom){
    POSTFX.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.25, 0.3, 1.9);
    composer.addPass(POSTFX.bloomPass);
  } else POSTFX.bloomPass = null;
  if(cfg.blur){
    POSTFX.blurPass = new ShaderPass({ uniforms: THREE.UniformsUtils.clone(BLUR_SHADER.uniforms), vertexShader: BLUR_SHADER.vertexShader, fragmentShader: BLUR_SHADER.fragmentShader });
    POSTFX.blurPass.enabled = false;
    composer.addPass(POSTFX.blurPass);
  } else POSTFX.blurPass = null;
  composer.addPass(new OutputPass());
  POSTFX.composer = composer;
  return composer;
}

export function disposePostFX(){
  if(POSTFX.composer){ try { POSTFX.composer.dispose(); } catch(e){} }
  POSTFX.composer = null; POSTFX.aoPass = null; POSTFX.bloomPass = null; POSTFX.blurPass = null; POSTFX.renderPass = null;
}

export function resizePostFX(){
  if(POSTFX.composer) POSTFX.composer.setSize(innerWidth, innerHeight);
}

/* render one frame. ctx = { speed (u/s), dir: THREE.Vector2 screen-space unit dir or null } */
export function renderFrame(dt, ctx){
  const { renderer, scene, camera, composer } = POSTFX;
  if(!composer){ renderer.render(scene, camera); return; }
  if(POSTFX.aoPass){
    const u = POSTFX.aoPass.uniforms;
    const size = renderer.getDrawingBufferSize(POSTFX._size);
    u.resolution.value.set(size.x, size.y);
    u.cameraNear.value = camera.near; u.cameraFar.value = camera.far;
    u.tanHalfFov.value = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  }
  if(POSTFX.blurPass){
    const sp = ctx ? ctx.speed || 0 : 0;
    const s = THREE.MathUtils.clamp((sp - 12) / 30, 0, 1) * 0.05;
    POSTFX.blurPass.enabled = s > 0.0025 && !!(ctx && ctx.dir);
    if(POSTFX.blurPass.enabled){ POSTFX.blurPass.uniforms.strength.value = s; POSTFX.blurPass.uniforms.dir.value.copy(ctx.dir); }
  }
  composer.render(dt);
}
