// Shared "real world" layer for all three viewers: physically based materials with
// real-scale textures, a sky and sun for St Heliers, image-based reflections, tone mapping,
// and the surrounding suburb, sea and Rangitoto on the horizon.
//
// Materials are matched from the colours the models are built with, so the construction
// logic in model.js / fitout-model.js stays readable and the look is changed in one place.

import * as THREE from 'three';
import { Sky } from '../vendor/Sky.js';

// ------------------------------------------------------------------ textures
// Share builds inline the images as data URIs in window.__GS_TEX.
const loader = new THREE.TextureLoader();
const texCache = new Map();
function tex(name, tile, srgb = true) {
  const k = name + '|' + tile + '|' + srgb;
  if (texCache.has(k)) return texCache.get(k);
  const src = (window.__GS_TEX && window.__GS_TEX[name]) || new URL(`../textures/${name}.jpg`, import.meta.url).href;
  const t = loader.load(src);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / tile, 1 / tile);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(k, t);
  return t;
}

// Surface library: texture, tile size (m), tint, roughness, metalness, bump.
export const SURF = {
  concrete: { map: 'concrete', tile: 2.4, tint: 0xffffff, rough: 0.78, bump: 0.6 },
  concreteSmooth: { map: 'concrete', tile: 2.4, tint: 0xf4f2ee, rough: 0.55, bump: 0.3 },
  concreteDark: { map: 'concrete_dark', tile: 2.4, tint: 0xffffff, rough: 0.85, bump: 0.6 },
  slabFloat: { map: 'concrete_dark', tile: 3, tint: 0xe6e3dc, rough: 0.42, bump: 0.2 },
  shotcrete: { map: 'shotcrete', tile: 1.6, tint: 0xffffff, rough: 0.95, bump: 2 },
  asphalt: { map: 'asphalt', tile: 2, tint: 0xffffff, rough: 0.9, bump: 1.2 },
  paving: { map: 'paving', tile: 1.5, tint: 0xffffff, rough: 0.8, bump: 0.5 },
  aggregate: { map: 'aggregate', tile: 0.8, tint: 0xffffff, rough: 0.7, bump: 1.5 },
  gravel: { map: 'gravel', tile: 1.2, tint: 0xffffff, rough: 1, bump: 2.5 },
  sand: { map: 'gravel', tile: 0.6, tint: 0xe9d6a6, rough: 1, bump: 0.6 },
  soil: { map: 'soil', tile: 3, tint: 0xffffff, rough: 1, bump: 2 },
  soilDeep: { map: 'soil', tile: 3, tint: 0xb8a48c, rough: 1, bump: 2 },
  mulch: { map: 'mulch', tile: 1.2, tint: 0xffffff, rough: 1, bump: 2 },
  grass: { map: 'grass', tile: 3.5, tint: 0xd8e6c8, rough: 1, bump: 1 },
  reserve: { map: 'grass', tile: 5, tint: 0xe6f0d0, rough: 1, bump: 1 },
  render: { map: 'render', tile: 1.2, tint: 0xffffff, rough: 0.9, bump: 0.8 },
  renderNeighbour: { map: 'render', tile: 1.2, tint: 0xf1ede4, rough: 0.9, bump: 0.8 },
  grc: { map: 'concrete', tile: 3, tint: 0xf6efe2, rough: 0.6, bump: 0.3 },
  membrane: { map: 'membrane', tile: 1, tint: 0xffffff, rough: 0.75, bump: 1 },
  membraneLight: { map: 'membrane', tile: 1, tint: 0xd0d4d8, rough: 0.7, bump: 1 },
  block: { map: 'block', tile: 0.8, tint: 0xffffff, rough: 0.9, bump: 1.2 },
  tile: { map: 'tile', tile: 1.2, tint: 0xffffff, rough: 0.35, bump: 0.2 },
  stone: { map: 'stone', tile: 1.5, tint: 0xffffff, rough: 0.5, bump: 0.3 },
  marble: { map: 'marble', tile: 1.5, tint: 0xffffff, rough: 0.18, bump: 0 },
  carpet: { map: 'carpet', tile: 0.6, tint: 0xffffff, rough: 1, bump: 1 },
  oak: { map: 'oak', tile: 1.6, tint: 0xd9c3a3, rough: 0.5, bump: 0.3 },
  oakDark: { map: 'oak', tile: 1.6, tint: 0x6a5646, rough: 0.55, bump: 0.3 },
  cedar: { map: 'slats', tile: 1.44, tint: 0xffffff, rough: 0.85, bump: 0.6 },
  decking: { map: 'slats', tile: 1.44, tint: 0xc8bba8, rough: 0.8, bump: 0.6 },
  plywood: { map: 'plywood', tile: 1.2, tint: 0xffffff, rough: 0.8, bump: 0.4 },
  timber: { map: 'plywood', tile: 0.9, tint: 0xf2dcb4, rough: 0.8, bump: 0.3 },
  timberDark: { map: 'plywood', tile: 1.2, tint: 0x8a6a48, rough: 0.9, bump: 0.3 },
  xps: { map: 'xps', tile: 1.2, tint: 0xffffff, rough: 0.9, bump: 0.3 },
  drainboard: { map: 'drainboard', tile: 0.6, tint: 0xffffff, rough: 0.6, bump: 1.5 },
  galv: { map: 'galv', tile: 1, tint: 0xffffff, rough: 0.45, metal: 0.8, bump: 0.1 },
  paint: { map: 'paint', tile: 1.5, tint: 0xffffff, rough: 0.6, bump: 0.1 },
  paintSatin: { map: 'paint', tile: 1.5, tint: 0xffffff, rough: 0.45, bump: 0.05 },
  cladding: { map: 'corrugated', tile: 0.8, tint: 0x5a6068, rough: 0.45, metal: 0.55, bump: 1 },
  cabin: { map: 'corrugated', tile: 0.8, tint: 0xffffff, rough: 0.55, metal: 0.2, bump: 1 },
  roofMetal: { map: 'corrugated', tile: 0.8, tint: 0x6f757c, rough: 0.5, metal: 0.5, bump: 1 },
};

// Colour → surface. Any colour not listed keeps its flat colour (plant paint, pipes, labels…).
const BY_COLOR = {
  0x7c5e40: 'soil', 0x5f4630: 'soilDeep', 0x9a948a: 'gravel', 0xc2beb4: 'concrete', 0xaeaba3: 'concreteDark',
  0x98958d: 'shotcrete', 0x26272b: 'membrane', 0x3b3c44: 'membrane', 0x3f7a4f: 'drainboard', 0x6ea6d8: 'xps',
  0x8d857a: 'gravel', 0xcdbd8e: 'sand', 0xc9a26b: 'timber', 0xd8bd8b: 'plywood', 0x33373d: 'membrane',
  0xefeee8: 'render', 0xd6cfbf: 'grc', 0x41474d: 'cladding', 0xa0a9b2: 'galv', 0x7fa35a: 'grass',
  0x4a4d52: 'asphalt', 0xb9b6ad: 'paving', 0xd0cdc5: 'concreteSmooth', 0xd9d4ca: 'renderNeighbour', 0x8e8a84: 'roofMetal',
  0x8fb46a: 'reserve', 0x5b5a57: 'aggregate', 0xf3e9d8: 'paint', 0xe8e2d0: 'cabin', 0xc7c1b4: 'block',
  0x6b6e72: 'concreteDark', 0x55585c: 'asphalt', 0xc8c4ba: 'concrete', 0xb4b1a9: 'concreteDark', 0xb6b3ab: 'slabFloat',
  0xa4a19a: 'paving', 0xc9c6bd: 'paving', 0xcfccc4: 'paving', 0xd9d3c7: 'tile', 0xebe6db: 'stone', 0x8c7660: 'decking',
  0x4e3b2a: 'mulch', 0xd8d6cf: 'paint', 0x8b6a45: 'timberDark', 0x9f9a90: 'concrete', 0xb3aea4: 'concrete',
  0xd5c29f: 'plywood', 0x9c6b3f: 'cedar', 0x8a9096: 'galv', 0x7b8a96: 'galv', 0xb88a57: 'oak', 0xa39c90: 'gravel',
  0x5d6166: 'concreteDark', 0xbab6ad: 'gravel', 0x55595e: 'galv',
  // fitout
  0xc4c0b6: 'concreteSmooth', 0xb3b0a8: 'concreteDark', 0xcfd0ca: 'paint', 0xf3f1ea: 'paint', 0xefe8dc: 'paint', 0xf2ece2: 'paintSatin',
  0xe6e0d4: 'paintSatin', 0x4a4038: 'oakDark', 0xeeeae3: 'marble', 0xb98b56: 'oak', 0xa8a39a: 'carpet', 0x9c9993: 'concreteDark',
  0xf4f1ea: 'paintSatin',
};
const GLASS = new Set([0x9cc9dc, 0xbfe3ee]);
const WATER = new Set([0x46b3d6]);

// Rewrite box / cylinder UVs to metres so every texture is at true scale.
function metreUV(g) {
  if (!g || g.userData.metreUV || !g.attributes.position || !g.attributes.normal) return;
  const t = g.type;
  if (t !== 'BoxGeometry' && t !== 'CylinderGeometry') return;
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  const out = new Float32Array(p.count * 2);
  const circ = t === 'CylinderGeometry' ? 2 * Math.PI * Math.max(g.parameters.radiusTop, g.parameters.radiusBottom) : 0;
  const hgt = t === 'CylinderGeometry' ? g.parameters.height : 0;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (t === 'CylinderGeometry' && ay < 0.9) { u = uv.getX(i) * circ; v = uv.getY(i) * hgt; }
    else if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    out[i * 2] = u; out[i * 2 + 1] = v;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(out, 2));
  g.userData.metreUV = true;
}

function applySurf(m, name) {
  const s = SURF[name]; if (!s) return;
  m.name = name;
  m.map = tex(s.map, s.tile);
  if (s.bump) { m.bumpMap = tex(s.map, s.tile, false); m.bumpScale = s.bump; }
  m.color.set(s.tint);
  m.roughness = s.rough; m.metalness = s.metal ?? 0;
  m.needsUpdate = true;
}

// Physically based glass and water, keeping the opacity the sequencer animates.
function makeGlass(m) {
  m.name = 'glass';
  m.color.set(0xb9d3dc);
  m.roughness = 0.04; m.metalness = 0.0;
  m.envMapIntensity = 1.6;
  m.opacity = Math.min(m.opacity, 0.32);
  m.transparent = true; m.depthWrite = false;
  m.needsUpdate = true;
}
let waterNormals = null;
const waterMats = [];
function makeWater(m) {
  m.name = 'water';
  waterNormals = waterNormals || tex('waternormals', 2.5, false);
  m.color.set(0x3fa7c4);
  m.normalMap = waterNormals; m.normalScale = new THREE.Vector2(0.35, 0.35);
  m.roughness = 0.03; m.metalness = 0.1; m.envMapIntensity = 1.4;
  m.opacity = Math.max(m.opacity, 0.86); m.transparent = true;
  m.needsUpdate = true;
  waterMats.push(m);
}

// Walk a model and give every standard material its real surface.
export function realify(root) {
  root.traverse(o => {
    if (!o.isMesh || !o.material || o.userData.keepLook) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    let textured = false;
    for (const m of mats) {
      if (!m.isMeshStandardMaterial) continue;
      const surf = m.userData.surf || o.userData.surf;
      const hex = m.color.getHex();
      if (surf) { applySurf(m, surf); textured = true; }
      else if (GLASS.has(hex) && m.transparent) makeGlass(m);
      else if (WATER.has(hex)) makeWater(m);
      else if (m.map && m.map.isCanvasTexture) continue;
      else if (BY_COLOR[hex]) { applySurf(m, BY_COLOR[hex]); textured = true; }
      else if (!m.map) { m.roughness = Math.min(m.roughness, 0.75); }
    }
    if (textured) metreUV(o.geometry);
  });
}

// ------------------------------------------------------------------ sky, sun, environment
// St Heliers, Auckland (−36.85°, 174.86°). World axes: north = +x, Goldie St (west) = −z.
// Sun position for a given local date/time, returned as a unit vector in model space.
export function sunDirection(date = new Date('2027-03-15T15:30:00+13:00')) {
  const lat = -36.85 * Math.PI / 180, lon = 174.86;
  const d = (date.getTime() / 86400000) - 10957.5;             // days since J2000
  const g = (357.529 + 0.98560028 * d) * Math.PI / 180;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;
  const e = (23.439 - 0.00000036 * d) * Math.PI / 180;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = ((gmst * 15 + lon) * Math.PI / 180) - ra;
  const alt = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(ha)); // from north, clockwise
  // world axes (after the scene mirror): north = +x, east = +z, up = +y
  return new THREE.Vector3(Math.cos(alt) * Math.cos(az), Math.sin(alt), Math.cos(alt) * Math.sin(az)).normalize();
}

export function setupWorld({ renderer, scene, camera, sun, hemi, target = new THREE.Vector3(22, 0, 12), date, exposure = 0.95, suburb = true, shadowSize = 4096, shadowExtent = 60 }) {
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const dir = sunDirection(date);
  // sky dome that travels with the camera
  const sky = new Sky();
  sky.scale.setScalar(900);
  const u = sky.material.uniforms;
  u.turbidity.value = 2.6; u.rayleigh.value = 1.1; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
  u.sunPosition.value.copy(dir);
  sky.onBeforeRender = (r, s, cam) => { sky.position.copy(cam.position); };
  sky.frustumCulled = false;
  scene.add(sky);
  scene.background = null;
  if (camera.far < 2400) { camera.far = 2400; camera.updateProjectionMatrix(); }

  // image-based lighting from the same sky
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky(); envSky.scale.setScalar(100); envSky.material.uniforms.sunPosition.value.copy(dir);
  Object.assign(envSky.material.uniforms.turbidity, { value: 2.6 }); envSky.material.uniforms.rayleigh.value = 1.1;
  envScene.add(envSky);
  const gnd = new THREE.Mesh(new THREE.CircleGeometry(90, 32), new THREE.MeshBasicMaterial({ color: 0x5d6a4c }));
  gnd.rotation.x = -Math.PI / 2; gnd.position.y = -2; envScene.add(gnd);
  const env = pmrem.fromScene(envScene, 0.02).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.75;

  // sun: warm, low shadow bias, sized to the site
  sun.color.set(0xfff1dc);
  sun.intensity = 3.2;
  sun.position.copy(target).addScaledVector(dir, 120);
  sun.target.position.copy(target);
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, { left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent, near: 20, far: 260 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.03;
  if (hemi) { hemi.intensity = 0.35; hemi.color.set(0xdfe9f5); hemi.groundColor.set(0x6b6152); }

  scene.fog = new THREE.Fog(0xc9d6df, 260, 1500);

  const world = new THREE.Group(); world.name = 'world';
  if (suburb) buildSuburb(world, target);
  scene.add(world);

  // animated pool water
  const tick = t => { if (waterNormals) { waterNormals.offset.x = t * 0.00002; waterNormals.offset.y = t * 0.000013; } };
  return { sky, world, tick, sunDir: dir };
}

// ------------------------------------------------------------------ surroundings
// Suburban blocks, street trees, the sea to the north and Rangitoto on the horizon.
// Everything is instanced so it costs a handful of draw calls.
export function buildSuburb(world, c = new THREE.Vector3(22, 0, 12)) {
  const GL = 3.75;
  const rand = mulberry(11);
  // wide ground to the horizon
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
  ground.material.map = tex('grass', 6); ground.material.color.set(0xb9c9a4);
  const g2 = ground.geometry; const uv = g2.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2400, uv.getY(i) * 2400);
  ground.rotation.x = -Math.PI / 2; ground.position.set(c.x, GL - 0.12, c.z); ground.receiveShadow = true;
  world.add(ground);
  // sea: Hauraki Gulf to the north (+x)
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2600, 3000), new THREE.MeshStandardMaterial({ color: 0x4f7f95, roughness: 0.12, metalness: 0.2, envMapIntensity: 1.3 }));
  sea.material.normalMap = tex('waternormals', 40, false); sea.material.normalScale = new THREE.Vector2(0.25, 0.25);
  const su = sea.geometry.attributes.uv; for (let i = 0; i < su.count; i++) su.setXY(i, su.getX(i) * 2600, su.getY(i) * 3000);
  sea.rotation.x = -Math.PI / 2; sea.position.set(c.x + 250 + 1300, GL - 0.1, c.z + 200); world.add(sea);
  // Rangitoto: the low symmetrical shield volcano on the northern horizon, scaled to its real
  // apparent size (260 m high, ~5.5 km across, ~8 km away)
  const rDist = 1500, s = rDist / 8000;
  const pts = []; for (let i = 0; i <= 24; i++) { const r = i / 24; pts.push(new THREE.Vector2(r * 2750 * s, Math.pow(1 - r, 1.6) * 260 * s + (r < 0.08 ? 6 * s : 0))); }
  const rangi = new THREE.Mesh(new THREE.LatheGeometry(pts.reverse(), 48), new THREE.MeshStandardMaterial({ color: 0x4d5f4a, roughness: 1 }));
  rangi.position.set(c.x + rDist * 0.94, GL - 0.2, c.z + rDist * 0.34); rangi.scale.y = 1; world.add(rangi);

  // houses: instanced bodies and hipped roofs laid out along a street grid around the site
  const lots = [];
  // keep clear: the site and its modelled neighbours, Goldie St and Vellenoweth Green (world coords, relative to the site centre)
  const blocked = (x, z) => x > c.x - 42 && x < c.x + 44 && z > c.z - 75 && z < c.z + 42;
  for (let gx = c.x - 280; gx < c.x + 280; gx += 16) for (let gz = c.z - 310; gz < c.z + 310; gz += 24) {
    if (Math.abs((gz - c.z + 300) % 96) < 12) continue;                // streets every 4 blocks
    const x = gx + (rand() - 0.5) * 3, z = gz + (rand() - 0.5) * 4;
    if (blocked(x, z) || x > c.x + 230 - z * 0.1) continue;               // beach reserve before the sea (north = +x)
    lots.push([x, z, 9 + rand() * 5, 10 + rand() * 6, rand() < 0.35 ? 6.2 : 3.4, rand()]);
  }
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, map: facadeTexture() }), lots.length);
  const roofGeo = new THREE.CylinderGeometry(0.02, 0.72, 1, 4, 1); roofGeo.rotateY(Math.PI / 4);
  const roofTex = tex('corrugated', 1).clone(); roofTex.repeat.set(24, 1); roofTex.needsUpdate = true;
  const roof = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.45, map: roofTex }), lots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  const WALLS = [0xf2efe8, 0xe8e2d6, 0xdcd8d0, 0xf5f3ee, 0xcfd3d4, 0xe9e1d0], ROOFS = [0x3d4247, 0x5b5f63, 0x7a4b3a, 0x2f3a45, 0x8b8f93];
  lots.forEach(([x, z, w, d, h, r], i) => {
    m4.compose(new THREE.Vector3(x, GL + h / 2, z), q, new THREE.Vector3(w, h, d)); body.setMatrixAt(i, m4);
    body.setColorAt(i, col.set(WALLS[(r * 97 | 0) % WALLS.length]));
    m4.compose(new THREE.Vector3(x, GL + h + 1.3, z), q, new THREE.Vector3(w * 1.12, 2.6, d * 1.12)); roof.setMatrixAt(i, m4);
    roof.setColorAt(i, col.set(ROOFS[(r * 53 | 0) % ROOFS.length]));
  });
  body.castShadow = roof.castShadow = true; body.receiveShadow = true;
  world.add(body, roof);
  // roads between the blocks
  const roadM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }); roadM.map = tex('asphalt', 3);
  for (let gz = c.z - 300; gz < c.z + 310; gz += 96) {
    if (gz > c.z - 75 && gz < c.z + 42) continue;
    const r = new THREE.Mesh(new THREE.PlaneGeometry(560, 8), roadM);
    const ru = r.geometry.attributes.uv; for (let i = 0; i < ru.count; i++) ru.setXY(i, ru.getX(i) * 560, ru.getY(i) * 8);
    r.rotation.x = -Math.PI / 2; r.position.set(c.x, GL - 0.08, gz); r.receiveShadow = true; world.add(r);
  }
  // trees: instanced trunks + canopies (pōhutukawa, oaks, palms read as mixed greens)
  const trees = [];
  for (let i = 0; i < 900; i++) {
    const x = c.x - 270 + rand() * 540, z = c.z - 310 + rand() * 620;
    if (blocked(x, z) || x > c.x + 225 - z * 0.1) continue;
    trees.push([x, z, 0.8 + rand() * 1.1, rand()]);
  }
  // the reserve across Goldie St: big specimen trees
  addTrees(world, trees);
  return world;
}

export function addTrees(parent, list, GL = 3.75) {
  const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 3, 6); trunkG.translate(0, 1.5, 0);
  const canG = new THREE.IcosahedronGeometry(1, 1);
  const pos = canG.attributes.position; const r = mulberry(5);
  for (let i = 0; i < pos.count; i++) { const k = 0.82 + r() * 0.3; pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.8, pos.getZ(i) * k); }
  canG.computeVertexNormals();
  const n = list.length;
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 1 }), n);
  const cans = new THREE.InstancedMesh(canG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), n * 3);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  const GREENS = [0x3f5f2e, 0x4c6b34, 0x355a33, 0x5a7440, 0x42613a, 0x2f4d2b];
  list.forEach(([x, z, s, rr], i) => {
    const y = (Array.isArray(GL) ? GL[i] : GL);
    m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s)); trunks.setMatrixAt(i, m4);
    for (let k = 0; k < 3; k++) {
      const a = rr * 6.28 + k * 2.1, off = k === 0 ? 0 : 1.1 * s;
      const cs = s * (k === 0 ? 2.4 : 1.8);
      m4.compose(new THREE.Vector3(x + Math.cos(a) * off, y + 3 * s + (k === 0 ? 1.3 * s : 0.7 * s), z + Math.sin(a) * off), q.setFromEuler(new THREE.Euler(0, a, 0)), new THREE.Vector3(cs, cs * 0.85, cs));
      cans.setMatrixAt(i * 3 + k, m4);
      cans.setColorAt(i * 3 + k, col.set(GREENS[(rr * 31 + k) * 7 % GREENS.length | 0]));
    }
  });
  trunks.castShadow = cans.castShadow = true; cans.receiveShadow = true;
  parent.add(trunks, cans);
  return { trunks, cans };
}

// Kiwi weatherboard villa / bungalow wall: bevel-back boards, white-framed windows and a door.
function facadeTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, 512, 256);
  for (let y = 0; y < 256; y += 9) { g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(0, y, 512, 2); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, y + 2, 512, 1); }
  const win = (x, y, w, h) => {
    g.fillStyle = '#f8f8f6'; g.fillRect(x - 5, y - 5, w + 10, h + 10);
    const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#3d4a55'); gr.addColorStop(0.6, '#6f8595'); gr.addColorStop(1, '#2d3740');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = '#f8f8f6'; g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h * 0.35, w, 4);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 5, y + h + 5, w + 10, 4);
  };
  win(40, 60, 90, 110); win(380, 60, 90, 110); win(200, 70, 120, 90);
  g.fillStyle = '#5a6b76'; g.fillRect(150, 110, 34, 146);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
