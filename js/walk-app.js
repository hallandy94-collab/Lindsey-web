// Goldie Street – walkthrough of the completed project.
// The finished whole-building model with House 2 fitted out inside (the house fitout
// model placed between its party walls). Two modes: a guided tour along a set route
// with captions, and a free walk at eye height with simple collision.

import * as THREE from 'three';
import { STAGES } from './stages.js';
import { buildModel, DIM as D, houseX } from './model.js';
import { FIT_STAGES } from './fitout-stages.js';
import { buildHouse } from './fitout-model.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { realify, setupWorld } from './realism.js';
import { furnishHouse } from './furniture.js';
import * as MX from './machines.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const REC = /[?&]rec\b/.test(location.search);
const EYE = 1.6;
const HOUSE = 1;                          // House 2 (0-based) is the one we walk through
const HX = houseX(HOUSE) + 0.075;         // clear face of House 2's north party wall
// house-local coords → building coords (y relative to LG FFL)
const H = (x, y, z) => [HX + x, D.LG + y, z];
// building coords are set out like the drawings; the scene is mirrored in x for true handedness
const toW = a => [-a[0], a[1], a[2]];

// ------------------------------------------------------------------ scene
const host = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(REC ? 1 : Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, 1, 0.05, 2400);
const hemi = new THREE.HemisphereLight(0xf7f9fc, 0x6f665a, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2de, 3); sun.castShadow = true; scene.add(sun, sun.target);
const MIRROR = new THREE.Group(); MIRROR.scale.x = -1; scene.add(MIRROR);

// whole building, as completed
const bIndex = id => STAGES.findIndex(s => s.id === id);
const bld = buildModel(bIndex);
MIRROR.add(bld.root);
for (const o of bld.items) {
  const el = o.userData.el;
  const sid = STAGES[el.s].id;
  // every house is fitted out below, so hide the building model's simplified fitout, services and roof framing
  // ducts and stacks sit behind the linings of the fitted-out houses; the lift shafts, battens and cylinders stay
  const hidden = sid === 'fitout' || (sid === 'services' && o.isMesh && [0xd46a3a, 0xb05a24].includes(o.material.color.getHex())) || (sid === 'roof' && el.house != null);
  o.visible = !(el.temp || el.rs != null || o.isSprite || hidden);
}

// all five houses, completed and furnished (House 2 is the one on the tour)
const fIndex = id => FIT_STAGES.findIndex(s => s.id === id);
const hiddenFit = new Set(['plumb', 'elec', 'ufh', 'insul', 'hvac', 'frame', 'preline']);
const houses = [];
for (let h = 0; h < 5; h++) {
  const house = buildHouse(fIndex);
  house.root.position.set(houseX(h) + 0.075, D.LG, 0);
  MIRROR.add(house.root);
  house.shell.visible = false; house.nearWall.visible = false; house.context.visible = false; house.labels.visible = false;
  for (const o of house.items) {
    const el = o.userData.el;
    o.visible = !(el.temp || el.hideAfter != null || o.isSprite || hiddenFit.has(FIT_STAGES[el.s].id));
    if (el.glow === 'comm') o.traverse(c => { if (c.material?.emissive) { c.material.emissive.set(0xffd98a); c.material.emissiveIntensity = 1.1; } });
    if (o.userData.flame) { o.userData.flame.material.emissiveIntensity = 1.8; }
  }
  furnishHouse(house.root, h);
  houses.push(house);
}
const house = houses[HOUSE];
// warm interior light in the living area and the basement lobby
// labels and street lettering are for the construction viewers, not the walkthrough
scene.traverse(o => { if (o.isSprite || (o.isMesh && o.material?.map && o.material.isMeshBasicMaterial)) o.visible = false; });

// cars: in the garages (nose to the street), in the aisle, and in the drive-in bays on Goldie St
const carAt = (x, y, z, rot, color, type) => { const c = MX.car(color, type); c.position.set(x, y, z); c.rotation.y = rot; MIRROR.add(c); return c; };
[[0, 0x8a9aa8, 'suv'], [0, 0x2c2f33], [1, 0xe8e8e6, 'suv'], [1, 0x1f2f45], [2, 0x5a1f1f], [3, 0xd0d2d4, 'suv'], [4, 0x3b4046], [4, 0xb9b2a4, 'suv']]
  .forEach(([h, c, t], i) => carAt(houseX(h) + (i % 2 ? 3.9 : 1.6), D.L0, 7.6, Math.PI / 2, c, t));
carAt(30, D.GL, -7.7, -Math.PI / 2, 0x33485e, 'suv'); carAt(7.5, D.GL, -7.7, -Math.PI / 2, 0xe8e8e6);
realify(MIRROR);
const world = setupWorld({ renderer, scene, camera, sun, hemi, target: new THREE.Vector3(-22.3, 0, 12), shadowExtent: 26 });
// warm interior light on each level of House 2 (downlights on, late afternoon)
for (const [x, y, z] of [[3.6, 2.4, 7.5], [3.6, 2.4, 14.5], [3.6, 5.6, 4.0], [3.6, 5.6, 13.5], [3.6, 8.8, 3.0], [3.6, 8.8, 9.5]]) {
  const l = new THREE.PointLight(0xffe2bd, 9, 9, 1.6); l.position.set(...toW(H(x, y, z))); scene.add(l);
}

// ------------------------------------------------------------------ collision (walk mode)
// Door leaves, the LG front/rear sliders of House 2 and the vehicle/carpark doors are
// treated as open so you can walk through them.
const noCollide = new Set();
const bb = new THREE.Box3();
for (const o of bld.items) {
  if (!o.visible) continue;
  const sid = STAGES[o.userData.el.s].id;
  bb.setFromObject(o);
  if (sid === 'joinery' && o.userData.el.house === HOUSE && bb.min.y < D.L1 && (bb.max.z < 1.5 || bb.min.z > D.HD1 - 1)) noCollide.add(o);
  if (sid === 'joinery' && o.userData.el.house === HOUSE && bb.min.y > D.L2 - 0.2 && bb.min.z > D.HD2 - 1) noCollide.add(o);
  if (sid === 'doors' && bb.min.y < D.LG) noCollide.add(o);
  if (sid === 'extfront' && bb.max.y - bb.min.y > 1 && bb.max.y - bb.min.y < 1.8 && bb.max.z < 0) noCollide.add(o); // gates
}
for (const hs of houses) for (const o of hs.items) if (FIT_STAGES[o.userData.el.s].id === 'doors') noCollide.add(o);
const colliders = [];
scene.updateMatrixWorld(true);
scene.traverse(o => {
  if (!o.isMesh || o.isSprite) return;
  let p = o, skip = false;
  while (p) { if (!p.visible || noCollide.has(p)) { skip = true; break; } p = p.parent; }
  if (skip) return;
  const box = new THREE.Box3().setFromObject(o);
  colliders.push({ o, box });
});
// Merge everything static into a few meshes per material so the walkthrough renders
// quickly on phones. The original meshes stay (hidden) for collision rays.
const moving = new Set();
houses.forEach(hs => hs.items.forEach(o => { if (o.userData.el.liftCar || o.userData.flame) o.traverse(c => moving.add(c)); }));
const groups = new Map();
scene.traverse(o => {
  if (!o.isMesh || o.isSprite || moving.has(o)) return;
  for (let p = o; p; p = p.parent) if (!p.visible) return;
  const m = o.material;
  const key = [m.type, m.name, m.color?.getHexString(), m.emissive?.getHexString(), m.emissiveIntensity, m.opacity, m.transparent, m.roughness, m.metalness, m.map?.uuid, m.bumpMap?.uuid, m.normalMap?.uuid, m.side, m.flatShading].join('|');
  if (!groups.has(key)) groups.set(key, { m, list: [] });
  groups.get(key).list.push(o);
});
const merged = new THREE.Group(); scene.add(merged);
for (const { m, list } of groups.values()) {
  if (list.length < 2) continue;
  const geos = list.map(o => {
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    // a mirrored transform turns the triangles inside out: restore the winding
    if (o.matrixWorld.determinant() < 0) for (const a of Object.values(g.attributes)) { const n = a.itemSize, v = a.array; for (let t = 0; t < a.count; t += 3) for (let c = 0; c < n; c++) { const i1 = (t + 1) * n + c, i2 = (t + 2) * n + c, tmp = v[i1]; v[i1] = v[i2]; v[i2] = tmp; } }
    return g;
  });
  const g = mergeGeometries(geos, false);
  if (!g) continue;
  const mm = new THREE.Mesh(g, m); mm.castShadow = mm.receiveShadow = !m.transparent; merged.add(mm);
  for (const o of list) o.visible = false;
}
const ray = new THREE.Raycaster();
const near = (p, r) => { const out = []; for (const c of colliders) if (p.x > c.box.min.x - r && p.x < c.box.max.x + r && p.z > c.box.min.z - r && p.z < c.box.max.z + r && p.y > c.box.min.y - 30 && p.y < c.box.max.y + r) out.push(c.o); return out; };
function hitDist(origin, dir, far, list) {
  ray.set(origin, dir); ray.far = far;
  const h = ray.intersectObjects(list, false);
  return h.length ? h[0] : null;
}

// ------------------------------------------------------------------ tour
// p0/l0 → p1/l1 over d seconds; cut = fade through black into this shot
const SHOTS = [
  { title: 'Goldie Street', text: 'Vellenoweth Green Residences: five terrace houses over a full basement carpark, set out to Hulena Architects AD-06/AD-11. Exit ramp at the north end, entry at the south. We walk through House 2.', p0: [-6, 12, -36], l0: [22, 7, 8], p1: [HX + 1.6, D.GL + EYE, -6.8], l1: [HX + 1.6, D.LG + 1.8, 4], d: 10 },
  { title: 'Front garden & entry porch', text: 'Pedestrian gate in the block front wall, steps up to the recessed west terrace and the entry porch. Sto render, GRC fins, APL joinery and glass balustrades to the balconies above.', p0: [HX + 1.6, D.GL + EYE, -6.8], l0: [HX + 1.6, D.LG + 1.8, 4], p1: H(0.85, EYE, -0.5), l1: H(0.85, 1.4, 5), d: 7 },
  { title: 'Entry & gallery – LG', text: 'The front door opens to the gallery: engineered oak, Level 5 plasterboard and the exposed architectural concrete party wall. Bed 4 / office to the right, bath 1 ahead.', p0: H(0.8, EYE, 3.7), l0: H(1.8, 1.4, 10), p1: H(2.4, EYE, 5.6), l1: H(2.6, 1.3, 12), d: 7, cut: true },
  { title: 'Open stair', text: 'Oak treads on steel stringers with a frameless glass balustrade rise LG → L1 along the north wall. The basement stair and the lift sit on the south wall, per AD-11.', p0: H(3.0, EYE, 5.6), l0: H(0.7, 1.4, 8.6), p1: H(2.6, EYE, 6.6), l1: H(0.7, 3.8, 10.2), d: 7 },
  { title: 'Media room', text: 'The media room at the rear of the LG opens through sliders to the east terrace and pool court. Bed 3 and the laundry are across the hall.', p0: H(3.0, EYE, 11.6), l0: H(1.2, 0.9, 15.5), p1: H(2.9, EYE, 12.3), l1: H(1.6, 1.0, 18.5), d: 7 },
  { title: 'Bedroom 3', text: 'Wool carpet, garden outlook and a built-in robe on the party wall.', p0: H(4.3, EYE, 14.1), l0: H(6.8, 0.8, 15.9), p1: H(4.5, EYE, 14.5), l1: H(6.0, 1.0, 17.9), d: 6 },
  { title: 'East terrace', text: 'Porcelain on the podium over the basement, the outdoor kitchen, and the external spiral stair up to the L2 roof terrace (By Owner).', p0: H(2.2, EYE, 17.0), l0: H(3.6, 0.4, 24), p1: H(3.0, EYE, 19.2), l1: H(6.4, 2.6, 18.7), d: 7, cut: true },
  { title: 'Pool court', text: 'Precast 3 × 5 m shell with a fibreglass lining and stone coping, a Vitex deck, and a frameless glass barrier to NZBC F9 with a self-closing, self-latching gate.', p0: H(0.9, EYE, 20.5), l0: H(4.0, -0.3, 23.2), p1: H(0.7, EYE, 25.3), l1: H(3.6, 3.0, 15), d: 8 },
  { title: 'Basement carpark – L0', text: 'Power-floated slab over the fully tanked box. One-way ramps (entry south, exit north), a double garage per house off the aisle, third spaces and storage behind.', p0: [HX + 3.2, D.L0 + EYE, 13.9], l0: [HX - 8, D.L0 + 1.2, 13.6], p1: [HX + 2.6, D.L0 + EYE, 12.6], l1: [HX + 2.7, D.L0 + 1.0, 5], d: 8, cut: true },
  { title: 'Garage, stair & lift', text: 'From the garage, the precast stair rises along the south party wall to the LG gallery, beside the Powerglide lift. Heat-pump hot water cylinders are at the front of the garage.', p0: [HX + 3.6, D.L0 + EYE, 2.6], l0: [HX + 6.6, D.L0 + 1.2, 6.5], p1: [HX + 4.3, D.L0 + EYE, 3.4], l1: [HX + 6.6, D.L0 + 2.4, 9.0], d: 7 },
  { title: 'L1 – living', text: 'The living level (layout indicative): Escea gas fire, underfloor heating and full-height joinery to the balcony, with Vellenoweth Green across the street.', p0: H(5.2, 3.23 + EYE, 5.0), l0: H(1.0, 3.23 + 1.0, 2.6), p1: H(5.3, 3.23 + EYE, 4.2), l1: H(3.4, 3.23 + 1.2, -6), d: 8, cut: true },
  { title: 'Dining & kitchen', text: 'Island with a sintered stone benchtop, Gaggenau appliances and the kitchen opening to the garden side. Kitchens By Design, By Owner supply.', p0: H(3.2, 3.23 + EYE, 10.6), l0: H(3.6, 3.23 + 0.9, 14.6), p1: H(4.4, 3.23 + EYE, 11.0), l1: H(1.2, 3.23 + 1.2, 16.5), d: 8 },
  { title: 'L2 – master bedroom', text: 'Full-height glazing to the balcony with Vellenoweth Green beyond. Level 5 finish, wool carpet and sheers.', p0: H(5.6, 6.46 + EYE, 4.1), l0: H(3.0, 6.46 + 1.2, -3), p1: H(4.9, 6.46 + EYE, 3.9), l1: H(1.0, 6.46 + 1.0, -4), d: 7, cut: true },
  { title: 'Ensuite', text: 'Walk-in frameless shower, freestanding bath, twin vanities with sintered stone tops and under-tile heating.', p0: H(3.25, 6.46 + EYE, 5.0), l0: H(0.8, 6.46 + 1.0, 8.4), p1: H(3.2, 6.46 + EYE, 5.8), l1: H(1.6, 6.46 + 0.9, 8.8), d: 6 },
  { title: 'L2 roof terrace', text: 'Outdoor porcelain on pedestals over the membrane roof, the heat-pump unit, and the spiral stair down to the terrace and pool court.', p0: H(2.4, 6.6 + EYE, 14.6), l0: H(3.6, 4.8, 26), p1: H(3.6, 6.6 + EYE, 16.9), l1: H(6.2, 3.8, 30), d: 7, cut: true },
  { title: 'Practical completion', text: 'Vellenoweth Green Residences, Houses 1–5. PC target Oct/Nov 2027.', p0: H(3.6, 6.46 + EYE, 1.0), l0: [HX + 3.6, D.L2 - 0.6, -25], p1: [-26, 30, -46], l1: [22, 6, 12], d: 10, cut: true },
];
let acc = 0; for (const s of SHOTS) { s.t0 = acc; acc += s.d; }
const T = acc;
const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeIO = x => 0.5 - Math.cos(Math.PI * x) / 2;
const FADE = 0.55;
const v3 = a => new THREE.Vector3(...a);

function shotAt(t) {
  t = Math.max(0, Math.min(T - 1e-4, t));
  let i = SHOTS.findIndex(s => t >= s.t0 && t < s.t0 + s.d); if (i < 0) i = SHOTS.length - 1;
  const s = SHOTS[i], k = easeIO((t - s.t0) / s.d);
  const pos = v3(toW(s.p0)).lerp(v3(toW(s.p1)), k), look = v3(toW(s.l0)).lerp(v3(toW(s.l1)), k);
  // fade through black around cuts
  let fade = 0;
  if (s.cut && t - s.t0 < FADE) fade = 1 - (t - s.t0) / FADE;
  const nx = SHOTS[i + 1];
  if (nx && nx.cut && s.t0 + s.d - t < FADE) fade = 1 - (s.t0 + s.d - t) / FADE;
  if (i === 0 && t < FADE) fade = 1 - t / FADE;
  return { i, pos, look, fade };
}

// ------------------------------------------------------------------ state & UI
const $ = s => document.querySelector(s);
const state = { mode: 'tour', t: 0, playing: !reduceMotion, speed: 1 };
const walk = { feet: new THREE.Vector3(), yaw: 0, pitch: 0, vy: 0, keys: new Set(), stick: { x: 0, y: 0 } };
const fadeEl = $('#fade');
const chapters = $('#chapters');
SHOTS.forEach((s, i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chap'; b.style.left = `${s.t0 / T * 100}%`; b.style.width = `${s.d / T * 100}%`;
  b.title = s.title; b.setAttribute('aria-label', `Go to ${s.title}`);
  b.addEventListener('click', () => { state.t = s.t0 + 0.01; renderCaption(true); });
  chapters.appendChild(b);
});
const tourList = $('#tour-list');
tourList.innerHTML = SHOTS.map((s, i) => `<li><button type="button" data-i="${i}"><span class="n">${String(i + 1).padStart(2, '0')}</span>${s.title}</button></li>`).join('');
tourList.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; setMode('tour'); state.t = SHOTS[+b.dataset.i].t0 + 0.01; renderCaption(true); });

let lastShot = -1;
function renderCaption(force) {
  const { i } = shotAt(state.t);
  if (i === lastShot && !force) return;
  lastShot = i;
  $('#cap-title').textContent = SHOTS[i].title;
  $('#cap-text').textContent = SHOTS[i].text;
  $('#cap-n').textContent = `${String(i + 1).padStart(2, '0')} / ${SHOTS.length}`;
  tourList.querySelectorAll('button').forEach((b, k) => b.toggleAttribute('aria-current', k === i));
}
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function syncPlay() { $('#play').dataset.on = state.playing; $('#play').setAttribute('aria-label', state.playing ? 'Pause tour' : 'Play tour'); }
$('#play').addEventListener('click', () => { if (state.mode !== 'tour') setMode('tour'); if (state.t >= T - 0.05) state.t = 0; state.playing = !state.playing; syncPlay(); });
$('#speed').addEventListener('change', e => { state.speed = +e.target.value; });
$('#progress').addEventListener('pointerdown', e => {
  const r = e.currentTarget.getBoundingClientRect();
  state.t = Math.max(0, Math.min(T - 0.01, (e.clientX - r.left) / r.width * T)); renderCaption(true);
});

// walk places
const PLACES = {
  // yaw 0 faces the street (−z); π faces into the site (+z)
  street: { p: [HX + 1.6, D.GL, -6.8], yaw: Math.PI },
  basement: { p: [HX + 3.2, D.L0, 13.6], yaw: 0 },
  lg: { p: H(0.8, 0, 3.8), yaw: Math.PI },
  l1: { p: H(4.5, 3.23, 6.0), yaw: 0 },
  l2: { p: H(4.8, 6.46, 3.9), yaw: 0 },
  garden: { p: H(2.6, 0, 19.2), yaw: Math.PI },
};
function goPlace(name) {
  const pl = PLACES[name]; if (!pl) return;
  walk.feet.set(...toW(pl.p)); walk.yaw = pl.yaw; walk.pitch = 0; walk.vy = 0;
  document.querySelectorAll('[data-place]').forEach(b => b.setAttribute('aria-pressed', b.dataset.place === name));
}
document.querySelectorAll('[data-place]').forEach(b => b.addEventListener('click', () => { setMode('walk'); goPlace(b.dataset.place); }));

function setMode(m) {
  if (state.mode === m) return;
  state.mode = m;
  document.body.dataset.mode = m;
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
  if (m === 'walk') {
    state.playing = false; syncPlay();
    // start walking from wherever the tour camera is standing, if it's a sensible spot
    const { pos, look } = shotAt(state.t);
    walk.feet.set(pos.x, pos.y - EYE, pos.z);
    const d = look.clone().sub(pos); walk.yaw = Math.atan2(-d.x, -d.z); walk.pitch = 0;
    if (pos.y - EYE > D.L2 + 2 || pos.z < -10) goPlace('street');
    fadeEl.style.opacity = 0;
  }
}
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

// look by dragging, move with keys or the on-screen stick
let drag = null;
renderer.domElement.addEventListener('pointerdown', e => {
  if (state.mode !== 'walk') return;
  drag = { x: e.clientX, y: e.clientY, yaw: walk.yaw, pitch: walk.pitch };
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!drag) return;
  walk.yaw = drag.yaw - (e.clientX - drag.x) * 0.005;
  walk.pitch = Math.max(-1.2, Math.min(1.2, drag.pitch - (e.clientY - drag.y) * 0.004));
});
renderer.domElement.addEventListener('pointerup', () => { drag = null; });
window.addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea')) return;
  if (e.key === ' ' && state.mode === 'tour') { e.preventDefault(); $('#play').click(); return; }
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'q', 'e'].includes(k)) {
    if (state.mode !== 'walk') setMode('walk');
    walk.keys.add(k); if (k.startsWith('arrow')) e.preventDefault();
  }
});
window.addEventListener('keyup', e => walk.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => walk.keys.clear());
const stick = $('#stick'), knob = $('#knob');
let stickId = null;
stick.addEventListener('pointerdown', e => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
stick.addEventListener('pointermove', e => { if (e.pointerId === stickId) moveStick(e); });
stick.addEventListener('pointerup', () => { stickId = null; walk.stick.x = walk.stick.y = 0; knob.style.transform = ''; });
function moveStick(e) {
  const r = stick.getBoundingClientRect(), R = r.width / 2;
  let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R;
  const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
  walk.stick.x = x; walk.stick.y = y;
  knob.style.transform = `translate(${x * R * 0.6}px, ${y * R * 0.6}px)`;
}

const down = new THREE.Vector3(0, -1, 0);
function stepWalk(dt) {
  const k = walk.keys;
  if (k.has('q')) walk.yaw += dt * 1.6;
  if (k.has('e')) walk.yaw -= dt * 1.6;
  if (k.has('arrowleft')) walk.yaw += dt * 1.8;
  if (k.has('arrowright')) walk.yaw -= dt * 1.8;
  let f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0) - walk.stick.y;
  let st = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0) + walk.stick.x;
  const speed = (k.has('shift') ? 3.2 : 1.5) * dt;
  const fw = new THREE.Vector3(-Math.sin(walk.yaw), 0, -Math.cos(walk.yaw));
  const rt = new THREE.Vector3(-fw.z, 0, fw.x);
  const move = fw.multiplyScalar(f).add(rt.multiplyScalar(st));
  if (move.lengthSq() > 1) move.normalize();
  move.multiplyScalar(speed);
  const list = near(walk.feet, 3);
  // slide along walls: try the full move, then each axis
  for (const m of [move, new THREE.Vector3(move.x, 0, 0), new THREE.Vector3(0, 0, move.z)]) {
    const len = m.length(); if (len < 1e-5) continue;
    const dir = m.clone().normalize();
    let blocked = false;
    for (const h of [0.55, 1.25, 1.75]) {
      const o = walk.feet.clone(); o.y += h;
      if (hitDist(o, dir, len + 0.3, list)) { blocked = true; break; }
    }
    if (!blocked) { walk.feet.add(m); break; }
  }
  // floor: step up to 0.45 m, fall under gravity
  const o = walk.feet.clone(); o.y += 0.45;
  const g = hitDist(o, down, 40, near(walk.feet, 1));
  const floorY = g ? g.point.y : walk.feet.y - 1;
  if (floorY >= walk.feet.y - 0.02) { walk.feet.y = floorY; walk.vy = 0; }
  else { walk.vy -= 9.8 * dt; walk.feet.y = Math.max(floorY, walk.feet.y + walk.vy * dt); if (walk.feet.y === floorY) walk.vy = 0; }
  camera.position.set(walk.feet.x, walk.feet.y + EYE, walk.feet.z);
  const dir = new THREE.Vector3(-Math.sin(walk.yaw) * Math.cos(walk.pitch), Math.sin(walk.pitch), -Math.cos(walk.yaw) * Math.cos(walk.pitch));
  camera.lookAt(camera.position.clone().add(dir));
}

function applyTour() {
  const { pos, look, fade } = shotAt(state.t);
  camera.position.copy(pos); camera.lookAt(look);
  fadeEl.style.opacity = fade.toFixed(3);
  $('#bar').style.width = `${state.t / T * 100}%`;
  $('#time').textContent = `${fmtT(state.t)} / ${fmtT(T)}`;
  renderCaption();
}

function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(host); resize();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (state.mode === 'tour') {
    if (state.playing) { state.t += dt * state.speed; if (state.t >= T) { state.t = T - 0.001; state.playing = false; syncPlay(); } }
    applyTour();
  } else stepWalk(dt);
  world.tick(now, camera);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
document.body.dataset.mode = 'tour';
syncPlay(); applyTour();
requestAnimationFrame(frame);
// frame-exact hook for video capture
window.__wk = { T, shots: SHOTS, setT: t => { state.playing = false; state.mode = 'tour'; state.t = t; applyTour(); }, state, setMode, goPlace, walk };
