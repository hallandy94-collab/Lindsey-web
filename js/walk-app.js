// Goldie Street – walkthrough of the completed project.
// The finished whole-building model with House 2 fitted out inside (the house fitout
// model placed between its party walls). Two modes: a guided tour along a set route
// with captions, and a free walk at eye height with simple collision.

import * as THREE from 'three';
import { STAGES } from './stages.js';
import { buildModel, DIM as D } from './model.js';
import { FIT_STAGES } from './fitout-stages.js';
import { buildHouse } from './fitout-model.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const REC = /[?&]rec\b/.test(location.search);
const EYE = 1.6;
const HOUSE = 1;                          // House 2 (0-based) is the fitted-out one
const HOUSE_W = D.W / 5;
const HX = HOUSE_W * HOUSE + 0.075;       // clear face of House 2's north party wall
// house-local coords → building coords (y relative to LG FFL)
const H = (x, y, z) => [HX + x, D.LG + y, z];

// ------------------------------------------------------------------ scene
const host = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(REC ? 1 : Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfdfe9);
scene.fog = new THREE.Fog(0xcfdfe9, 90, 260);
const camera = new THREE.PerspectiveCamera(68, 1, 0.05, 500);
scene.add(new THREE.HemisphereLight(0xf7f9fc, 0x6f665a, 1.35));
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xfff2de, 1.5);
sun.position.set(-30, 60, -18); scene.add(sun);

// whole building, as completed
const bIndex = id => STAGES.findIndex(s => s.id === id);
const bld = buildModel(bIndex);
scene.add(bld.root);
const hideInHouse2 = new Set(['fitout', 'services', 'roof']);
for (const o of bld.items) {
  const el = o.userData.el;
  const sid = STAGES[el.s].id;
  o.visible = !(el.temp || el.rs != null || o.isSprite || (el.house === HOUSE && hideInHouse2.has(sid)));
}

// House 2 interior, completed
const fIndex = id => FIT_STAGES.findIndex(s => s.id === id);
const house = buildHouse(fIndex);
house.root.position.set(HX, D.LG, 0);
scene.add(house.root);
house.shell.visible = false; house.nearWall.visible = false; house.context.visible = false; house.labels.visible = false;
// services rough-in and insulation are hidden behind the finished linings
const hiddenFit = new Set(['plumb', 'elec', 'ufh', 'insul']);
for (const o of house.items) {
  const el = o.userData.el;
  o.visible = !(el.temp || el.hideAfter != null || (el.variant && el.variant !== 'spiral') || o.isSprite || hiddenFit.has(FIT_STAGES[el.s].id));
  if (el.glow === 'comm') o.traverse(c => { if (c.material?.emissive) { c.material.emissive.set(0xffd98a); c.material.emissiveIntensity = 1.1; } });
  if (o.userData.flame) { o.userData.flame.material.emissiveIntensity = 1.8; }
}
// warm interior light in the living area and the basement lobby
// labels and street lettering are for the construction viewers, not the walkthrough
scene.traverse(o => { if (o.isSprite || (o.isMesh && o.material?.map && o.material.isMeshBasicMaterial)) o.visible = false; });

// a few parked cars in the basement, and a car on Goldie Street
function car(x, y, z, rot, color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 4.4), new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35 }));
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.3), new THREE.MeshStandardMaterial({ color: 0x223040, metalness: 0.3, roughness: 0.15 }));
  cabin.position.set(0, 1.15, -0.2);
  g.add(body, cabin);
  for (const [dx, dz] of [[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.4], [0.85, -1.4]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 16), new THREE.MeshStandardMaterial({ color: 0x1b1b1b }));
    w.rotation.z = Math.PI / 2; w.position.set(dx, 0.33, dz); g.add(w);
  }
  g.position.set(x, y, z); g.rotation.y = rot; scene.add(g);
  return g;
}
car(8, D.L0, 6.5, 0, 0x8a9aa8); car(11, D.L0, 6.5, 0, 0x2c2f33); car(17, D.L0, 7, 0.05, 0xe8e8e6); car(23, D.L0, 6.5, 0, 0x5a1f1f);
car(20.5, D.GL, -5.5, 0, 0x33485e);

// ------------------------------------------------------------------ collision (walk mode)
// Door leaves, the LG front/rear sliders of House 2 and the vehicle/carpark doors are
// treated as open so you can walk through them.
const noCollide = new Set();
const bb = new THREE.Box3();
for (const o of bld.items) {
  if (!o.visible) continue;
  const sid = STAGES[o.userData.el.s].id;
  bb.setFromObject(o);
  if (sid === 'joinery' && o.userData.el.house === HOUSE && bb.min.y < D.L1 && (bb.max.z < 1 || bb.min.z > D.HD1 - 1)) noCollide.add(o);
  if (sid === 'joinery' && o.userData.el.house === HOUSE && bb.min.y > D.L2 - 0.2 && bb.min.z > D.HD2 - 1) noCollide.add(o);
  if (sid === 'doors' && bb.min.y < D.LG) noCollide.add(o);
  if (sid === 'extfront' && bb.max.y - bb.min.y > 1 && bb.max.y - bb.min.y < 1.8 && bb.max.z < 0) noCollide.add(o); // gates
}
for (const o of house.items) if (FIT_STAGES[o.userData.el.s].id === 'doors') noCollide.add(o);
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
house.items.forEach(o => { if (o.userData.el.liftCar || o.userData.flame) o.traverse(c => moving.add(c)); });
const groups = new Map();
scene.traverse(o => {
  if (!o.isMesh || o.isSprite || moving.has(o)) return;
  for (let p = o; p; p = p.parent) if (!p.visible) return;
  const m = o.material;
  const key = [m.type, m.color?.getHexString(), m.emissive?.getHexString(), m.emissiveIntensity, m.opacity, m.transparent, m.roughness, m.metalness, m.map?.uuid, m.side, m.flatShading].join('|');
  if (!groups.has(key)) groups.set(key, { m, list: [] });
  groups.get(key).list.push(o);
});
const merged = new THREE.Group(); scene.add(merged);
for (const { m, list } of groups.values()) {
  if (list.length < 2) continue;
  const geos = list.map(o => { let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; });
  const g = mergeGeometries(geos, false);
  if (!g) continue;
  merged.add(new THREE.Mesh(g, m));
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
  { title: 'Goldie Street', text: 'Vellenoweth Green Residences: five terrace houses over a full basement carpark, with drive-in parking along the frontage. We walk through House 2.', p0: [-20, 10, -26], l0: [12, 7, 8], p1: [9.05, 5.35, -7.5], l1: [9.05, 7.4, 4], d: 10 },
  { title: 'Front entry', text: 'Pedestrian gate and letterbox in the block front wall. Sto render with GRC fins, APL joinery and glass balustrades above.', p0: [9.05, 5.35, -7.5], l0: [9.05, 7.4, 4], p1: [9.05, 5.35, -1.4], l1: [9.05, 6.3, 6], d: 6 },
  { title: 'Entry – LG', text: 'Engineered oak floor and Level 5 plasterboard against the exposed architectural concrete party wall. Powder room to the right.', p0: H(2.4, EYE, 0.7), l0: H(2.4, 1.4, 8), p1: H(2.3, EYE, 4.6), l1: H(1.6, 1.3, 12), d: 7, cut: true },
  { title: 'Spiral stair', text: 'The internal spiral stair rises LG → L1 → L2: steel centre column, oak treads and a steel balustrade with an oak handrail.', p0: H(2.95, EYE, 8.3), l0: H(1.1, 1.7, 10.25), p1: H(2.95, EYE, 9.3), l1: H(1.1, 5.2, 10.25), d: 7 },
  { title: 'Kitchen & scullery', text: 'Island with a sintered stone benchtop, Gaggenau ovens in the tall joinery and a scullery behind. Kitchens By Design, By Owner supply.', p0: H(1.0, EYE, 15.2), l0: H(3.2, 0.9, 12.2), p1: H(1.3, EYE, 16.0), l1: H(4.9, 1.0, 13), d: 7 },
  { title: 'Living & dining', text: 'Escea gas fire, underfloor heating and full-height APL sliders opening to the terrace and pool.', p0: H(3.0, EYE, 16.4), l0: H(0.6, 1.0, 19.6), p1: H(3.1, EYE, 18.2), l1: H(3.0, 1.3, 26), d: 8 },
  { title: 'LG terrace', text: 'Porcelain on the concrete terrace and an outdoor kitchen. Block walls with steps down to the pool garden.', p0: [9.05, D.LG + EYE, 22.9], l0: [9.05, D.LG - 0.4, 32], p1: [8.0, D.LG + EYE, 25.1], l1: [9.4, D.GL - 0.2, 33], d: 6, cut: true },
  { title: 'Pool', text: 'Precast shell with a fibreglass lining and stone coping. Frameless glass pool barrier to NZBC F9 with a self-closing, self-latching gate.', p0: [6.95, D.GL + 0.2 + EYE, 29.0], l0: [9.8, D.GL - 0.1, 33.5], p1: [11.2, D.GL + 0.2 + EYE, 30.0], l1: [8.4, D.GL - 0.1, 34.2], d: 7 },
  { title: 'Garden & rear elevation', text: 'Vitex deck, lawn, planting and garden lighting. The external spiral stair climbs to the L2 terrace.', p0: [9.05, D.GL + EYE, 43.2], l0: [9.05, 9, 15], p1: [12.3, D.GL + 2.6, 41.8], l1: [9.0, 10.2, 16], d: 7 },
  { title: 'Basement carpark – L0', text: 'Power-floated slab over the fully tanked box. One-way ramps (in at the south, out at the north) with carpark extract overhead.', p0: [5, D.L0 + EYE, 1.8], l0: [15, D.L0 + 1.2, 12], p1: [12.5, D.L0 + EYE, 4.6], l1: [21, D.L0 + 1.2, 13.5], d: 8, cut: true },
  { title: 'Undercroft below House 2', text: 'Undercroft below House 2: precast basement stair, carpark extract and the heat-pump hot water cylinders. Where the stair arrives in the house is to be confirmed on the HAL plans.', p0: [10.9, D.L0 + EYE, 13.4], l0: [7.44, D.L0 + 1.2, 21.5], p1: [10.6, D.L0 + EYE, 15.6], l1: [7.44, D.L0 + 2.4, 22.5], d: 6 },
  { title: 'L1 – stair landing', text: 'Three bedrooms and two bathrooms off the landing. Wool carpet to the bedrooms, oak to the landing and stair.', p0: H(1.0, 3.23 + EYE, 16.2), l0: H(1.1, 3.9, 9), p1: H(1.2, 3.23 + EYE, 14.9), l1: H(2.2, 4.4, 8.2), d: 6, cut: true },
  { title: 'Bedroom 4', text: 'Garden outlook through full-height joinery, wool carpet and a built-in robe.', p0: H(2.9, 3.23 + EYE, 17.9), l0: H(2.9, 3.23 + 0.9, 26), p1: H(3.6, 3.23 + EYE, 20.3), l1: H(2.0, 3.23 + 0.3, 30), d: 6 },
  { title: 'L2 – master bedroom', text: 'Full-height glazing to the balcony with Vellenoweth Green beyond. Level 5 finish and wool carpet.', p0: H(3.0, 6.46 + EYE, 6.2), l0: H(3.0, 6.46 + 1.2, -3), p1: H(4.2, 6.46 + EYE, 4.4), l1: H(1.4, 6.46 + 1.0, -4), d: 7, cut: true },
  { title: 'Ensuite', text: 'Walk-in frameless shower, freestanding bath, twin vanities with sintered stone tops and under-tile heating.', p0: H(2.55, 6.46 + EYE, 13.45), l0: H(5.3, 6.46 + 0.7, 10.8), p1: H(2.95, 6.46 + EYE, 13.25), l1: H(4.3, 6.46 + 0.5, 10.4), d: 6 },
  { title: 'L2 terrace', text: 'Outdoor porcelain on pedestals and the heat-pump outdoor unit, with the spiral stair down to the garden and pool.', p0: [7.4, D.L2 + 0.14 + EYE, 18.3], l0: [9.05, D.L2 - 1, 40], p1: [8.6, D.L2 + 0.14 + EYE, 21.0], l1: [9.05, D.GL, 40], d: 7, cut: true },
  { title: 'Practical completion', text: 'Vellenoweth Green Residences, Houses 1–5. PC target Oct/Nov 2027.', p0: [9.05, D.L2 + EYE, -1.2], l0: [9.05, D.L2 - 0.6, -25], p1: [-24, 27, -36], l1: [15, 7, 14], d: 10, cut: true },
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
  const pos = v3(s.p0).lerp(v3(s.p1), k), look = v3(s.l0).lerp(v3(s.l1), k);
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
  street: { p: [9.05, D.GL, -6.5], yaw: Math.PI },
  basement: { p: [12, D.L0, 3], yaw: Math.PI - 0.3 },
  lg: { p: H(2.4, 0, 1.2), yaw: Math.PI },
  l1: { p: H(1.0, 3.23, 15.8), yaw: 0 },
  l2: { p: H(3.0, 6.46, 5.5), yaw: 0 },
  garden: { p: [9.05, D.GL, 42], yaw: 0 },
};
function goPlace(name) {
  const pl = PLACES[name]; if (!pl) return;
  walk.feet.set(...pl.p); walk.yaw = pl.yaw; walk.pitch = 0; walk.vy = 0;
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
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
document.body.dataset.mode = 'tour';
syncPlay(); applyTour();
requestAnimationFrame(frame);
// frame-exact hook for video capture
window.__wk = { T, shots: SHOTS, setT: t => { state.playing = false; state.mode = 'tour'; state.t = t; applyTour(); }, state, setMode, goPlace, walk };
