/* =============================================================================
   light.js — the sun, its shadow, the sky dome and the time of day.
   Golden hour by default (16.6 h): low warm sun from screen top-right, long
   shadows falling bottom-left. One DirectionalLight casts the only shadow map;
   its ortho frustum follows whatever the camera is looking at (the world is
   big, the view is small). Hemisphere fill + fog come from the palette's SKY
   keyframes. Adam's painted sky domes (assets/sky/*.png) replace the gradient
   when present. [ / ] nudge the hour for tuning.
   ============================================================================= */
import * as THREE from 'three';
import { skyAt } from './palette.js';

export const DAY = {
  timeOfDay: 16.6,
  sun: null, hemi: null, sky: null, scene: null,
  sunDir: new THREE.Vector3(0, 1, 0),
  state: null,                 // last skyAt()
  cfg: { shadow: 2048, soft: true },
  dyn: [],                     // future dynamic lights (headlights/neon) — budget slot
  skyTex: {},                  // hour-key -> texture (Adam's domes)
  _c: new THREE.Color(),
};

const SKY_VS = /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FS = /* glsl */`
  uniform vec3 topC, horC, sunC, sunDir; uniform float glow;
  varying vec3 vDir;
  void main(){
    vec3 dir = normalize(vDir);
    float t = pow(clamp(dir.y, 0.0, 1.0), 0.58);
    vec3 c = mix(horC, topC, t);
    float g = pow(max(dot(dir, normalize(sunDir)), 0.0), 6.0);
    c += sunC * g * glow * 0.5;                      // warm lobe around the sun
    gl_FragColor = vec4(c, 1.0);
  }`;

export function initLight(scene, cfg){
  DAY.scene = scene;
  if(cfg) DAY.cfg = cfg;
  scene.background = new THREE.Color(0xbfe3f2);
  scene.fog = new THREE.Fog(0xbfe3f2, 260, 520);

  DAY.hemi = new THREE.HemisphereLight(0xffffff, 0xa8c98a, 1.0);
  scene.add(DAY.hemi);

  const sun = new THREE.DirectionalLight(0xfff4d6, 1.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(DAY.cfg.shadow, DAY.cfg.shadow);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.05;
  const sc = sun.shadow.camera;
  sc.near = 10; sc.far = 420; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30;
  scene.add(sun, sun.target);
  DAY.sun = sun;

  // sky dome: gradient placeholder until Adam paints assets/sky/*.png
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { topC: { value: new THREE.Color() }, horC: { value: new THREE.Color() }, sunC: { value: new THREE.Color() },
      sunDir: { value: DAY.sunDir }, glow: { value: 0.4 } },
    vertexShader: SKY_VS, fragmentShader: SKY_FS,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 12), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -10;
  sky.name = 'sky';
  scene.add(sky);
  DAY.sky = sky; DAY.skyGradMat = skyMat;
  applyTime();
  loadSky();
}

// sun direction for an hour: rises toward +x (screen right), arcs overhead, sets toward -x.
// Azimuth is tilted so the afternoon sun sits screen TOP-RIGHT (+x, -z): shadows fall bottom-left.
export function sunDirFor(h){
  const a = (h - 6) / 12 * Math.PI;                 // 0 at 6h, π at 18h
  let elev = THREE.MathUtils.degToRad(70) * Math.sin(a);
  const night = elev < THREE.MathUtils.degToRad(8);
  elev = Math.max(THREE.MathUtils.degToRad(8), elev);
  // screen-space azimuth φ: 0 = screen top (-z), 90° = screen right (+x).
  // dawn bottom-right (150°) → noon right (90°) → golden hour TOP-RIGHT (~44°) → dusk top (30°)
  const phi = THREE.MathUtils.degToRad(150 - (h - 6) / 12 * 120);
  const ce = Math.cos(elev);
  return { dir: new THREE.Vector3(Math.sin(phi) * ce, Math.sin(elev), -Math.cos(phi) * ce), night };
}

export function setTime(h){ DAY.timeOfDay = ((h % 24) + 24) % 24; applyTime(); }

function applyTime(){
  const s = skyAt(DAY.timeOfDay); DAY.state = s;
  const { dir } = sunDirFor(DAY.timeOfDay);
  DAY.sunDir.copy(dir);
  DAY.sun.color.setHex(s.sunColor); DAY.sun.intensity = s.sunI;
  DAY.hemi.color.setHex(s.hemiSky); DAY.hemi.groundColor.setHex(s.hemiGround); DAY.hemi.intensity = s.hemiI;
  DAY.scene.fog.color.setHex(s.fog);
  DAY.scene.background.setHex(s.skyHorizon);
  const u = DAY.skyGradMat.uniforms;
  u.topC.value.setHex(s.skyTop); u.horC.value.setHex(s.skyHorizon); u.sunC.value.setHex(s.sunColor);
  const elev = Math.asin(dir.y);
  u.glow.value = THREE.MathUtils.clamp(1 - elev / 0.9, 0.15, 1);
  pickSkyTex();
}

/* per frame: follow the view. focus = what the camera looks at, reach = how wide the view is (u). */
const _p = new THREE.Vector3();
export function updateLight(focus, reach, camera){
  const sun = DAY.sun; if(!sun) return;
  const ext = THREE.MathUtils.clamp(reach, 22, 70);
  const sc = sun.shadow.camera;
  if(sc.right !== ext){ sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix(); }
  // snap the shadow frustum to texel steps in light space so edges don't swim as you move
  const texel = (2 * ext) / sun.shadow.mapSize.x;
  sun.shadow.normalBias = 1.6 * texel;
  _p.set(Math.round(focus.x / texel) * texel, 0, Math.round(focus.z / texel) * texel);
  sun.target.position.copy(_p);
  sun.position.copy(_p).addScaledVector(DAY.sunDir, 200);
  if(camera && DAY.sky) DAY.sky.position.copy(camera.position);
}

export function nudgeTime(dh){ setTime(DAY.timeOfDay + dh); return DAY.timeOfDay; }

/* Adam's painted domes: assets/sky/{dawn,noon,golden,dusk,night}.png — nearest to the hour wins */
const SKY_FILES = [['night', 2], ['dawn', 6.5], ['noon', 12.5], ['golden', 17], ['dusk', 19.5], ['night', 23]];
export function loadSky(){
  const loader = new THREE.TextureLoader();
  for(const name of new Set(SKY_FILES.map(f => f[0]))){
    loader.load('./assets/sky/' + name + '.png?t=' + Date.now(), tex => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.mapping = THREE.EquirectangularReflectionMapping;
      DAY.skyTex[name] = tex; pickSkyTex();
    }, undefined, () => { delete DAY.skyTex[name]; pickSkyTex(); });
  }
}
function pickSkyTex(){
  if(!DAY.sky) return;
  let best = null, bd = 99;
  for(const [name, h] of SKY_FILES){ if(!DAY.skyTex[name]) continue; const d = Math.abs(h - DAY.timeOfDay); if(d < bd){ bd = d; best = name; } }
  if(best){
    if(!DAY.skyTexMat) DAY.skyTexMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
    DAY.skyTexMat.map = DAY.skyTex[best]; DAY.skyTexMat.needsUpdate = true;
    DAY.sky.material = DAY.skyTexMat; DAY.sky.scale.x = -1;       // painted on the inside, un-mirrored
  } else { DAY.sky.material = DAY.skyGradMat; DAY.sky.scale.x = 1; }
}

export function setShadowCfg(cfg){
  DAY.cfg = cfg;
  const sun = DAY.sun; if(!sun) return;
  sun.shadow.mapSize.set(cfg.shadow, cfg.shadow);
  if(sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; }
}
