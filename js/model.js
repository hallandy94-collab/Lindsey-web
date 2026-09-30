// Builds the Goldie Street 3D model, one mesh per buildable element.
// Every element is tagged with the stage it is built in (and, for temporary
// works, the stage it is removed in) so the sequencer can animate it.
//
// Set out to HAL AD-06 / AD-10 Rev D (Vellenoweth Green Residences):
//   x runs along Goldie Street from grid 1 (north, x = 0) to grid 8 (south, x = 44.6):
//     3.8 exit-ramp bay · 5 houses × 7.4 m (grids 2–7) · 3.8 entry-ramp bay.
//   z runs away from the street from grid G (building front, z = 0) to grid A (z = 26.5):
//     G–F 1.1 · F–E 9.8 · E–D 5.5 · D–C 1.5 (houses G–C = 17.9) · C–B 2.0 terrace · B–A 6.6 pools.
//   Front boundary z = −2.6, rear boundary z = 27.58 (site 45.27 × 30.18 m = 1,364 m²).
//   y is RL in metres (methodology RLs).
// The basement fills grid 1–8 × A–G. Houses, pools and levels are to the drawings; the
// fitout inside the houses is indicative.

import * as THREE from 'three';
import { rectMinus, SLAB_HOLES, LIFT, LIFT_HOLE, FLIGHTS, FRONT_LG, PORCH } from './fitout-model.js';
import * as MX from './machines.js';
import { poolFurniture } from './furniture.js';

export const DIM = {
  W: 44.6,           // grid 1 → 8 (basement / secant line)
  BD: 26.5,          // basement depth, grid G → A
  HD1: 17.9,         // LG / L1 house depth (670 m² / 37 m), grid G → C
  HD2: 14.2,         // L2 house depth (525 m² / 37 m)
  FB: -2.6, RB: 27.58, SX0: -0.335, SX1: 44.935,   // site boundaries
  GL: 3.75,          // street / existing ground
  FORM: 1.32,        // basement formation
  L0: 1.82,          // top of L0 slab
  LG: 4.61, L1: 7.84, L2: 11.07, ROOF: 14.1,
  PLANK: 0.2, TOP: 0.075,
  RAMP_W: 3.2, RAMP_Z1: 10.9,     // ramps run from the boundary down to grid E
  HW: 7.4, HX0: 3.8,
};
const D = DIM;
export const houseX = h => D.HX0 + D.HW * h;          // party-wall centre line on the north side of house h
const HX = houseX, HC = h => HX(h) + D.HW / 2;
const HF = h => HX(h) + 0.075;                          // clear face of house h's north party wall (fitout origin)
// ramp strips (x) and the ramp surface level at z
const RAMPS = [[0.45, 0.45 + D.RAMP_W], [D.W - 0.45 - D.RAMP_W, D.W - 0.45]];
const rampY = z => D.GL - Math.min(1, Math.max(0, (z - D.FB) / (D.RAMP_Z1 - D.FB))) * (D.GL - D.L0);
// pool shells (3 × 5 m), per house, in the B–A zone
const POOL = h => [HX(h) + 1.2, 21.65, HX(h) + 6.2, 24.65];
// street (z from the front boundary out): footpath, berm, drive-in bays, kerb, carriageway
const ST = { fp: -4.2, berm: -5.2, bay: -10.2, kerb: -10.5, road: -18.5 };
const CZ = (ST.berm + ST.bay) / 2;                      // crane standing line in the bays
const LANE = (ST.kerb + ST.road) / 2 + 2;               // near traffic lane (HPMV stands here)

export const MAT = {
  soil: 0x7c5e40, soilDeep: 0x5f4630, gravel: 0x9a948a, precast: 0xc2beb4, insitu: 0xaeaba3,
  shot: 0x98958d, membrane: 0x26272b, wallMembrane: 0x3b3c44, drainBoard: 0x3f7a4f, xps: 0x6ea6d8,
  hardfill: 0x8d857a, blinding: 0xcdbd8e, steel: 0x56616e, timber: 0xc9a26b, ply: 0xd8bd8b,
  roofMem: 0x33373d, glass: 0x9cc9dc, render: 0xefeee8, grc: 0xd6cfbf, nuwall: 0x41474d,
  prop: 0xe0a91b, scaffold: 0xa0a9b2, crane: 0xf0b323, truck: 0xe9ecef, fence: 0x2f6480,
  ww: 0xb05a24, sw: 0x2f8a55, duct: 0x2a6fd1, water: 0x46b3d6, grass: 0x7fa35a, road: 0x4a4d52,
  path: 0xb9b6ad, kerb: 0xd0cdc5, neighbour: 0xd9d4ca, roofN: 0x8e8a84, reserve: 0x8fb46a,
  aggregate: 0x5b5a57, lift: 0x7f95a8, duct2: 0xd46a3a, fit: 0xf3e9d8, tree: 0x4f7a3a, trunk: 0x6b4f35,
  office: 0xe8e2d0, balustrade: 0xbfe3ee, door: 0x6d7379, block: 0xc7c1b4,
};

// ---------------------------------------------------------------------------

export function buildModel(stageIndex) {
  const root = new THREE.Group();
  const items = [];   // animated elements
  const context = new THREE.Group(); context.name = 'context';
  const ground = new THREE.Group(); ground.name = 'ground';
  root.add(context, ground);

  const geoCache = new Map();
  const boxGeo = (w, h, d) => {
    const k = `b${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
    if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
    return geoCache.get(k);
  };
  const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...opts });

  // Add an animated element.
  // o = { stage, seq, anim, rm, rmSeq, rmAnim, temp, house, parent }
  function add(mesh, o) {
    mesh.castShadow = true; mesh.receiveShadow = true;
    (o.parent || root).add(mesh);
    mesh.userData.el = {
      s: stageIndex(o.stage), seq: o.seq ?? 0, anim: o.anim || 'drop',
      rs: o.rm ? stageIndex(o.rm) : null, rseq: o.rmSeq ?? 0, ranim: o.rmAnim || 'fade',
      temp: !!o.temp, soil: !!o.soil, house: o.house ?? null, layer: o.layer ?? null,
    };
    items.push(mesh);
    return mesh;
  }
  function box(x0, y0, z0, x1, y1, z1, color, o, matOpts) {
    const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
    const m = new THREE.Mesh(boxGeo(w, h, d), mat(color, matOpts));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return o ? add(m, o) : m;
  }
  function cyl(x, y0, z, r, h, color, o, seg = 12) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat(color));
    m.position.set(x, y0 + h / 2, z);
    return o ? add(m, o) : m;
  }
  function staticBox(parent, x0, y0, z0, x1, y1, z1, color, matOpts) {
    const m = box(x0, y0, z0, x1, y1, z1, color, null, matOpts);
    m.receiveShadow = true; m.castShadow = true;
    parent.add(m); return m;
  }
  // pipe between two points
  function pipe(a, b, r, color, o) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat(color, { roughness: 0.5 }));
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    return add(m, o);
  }
  // sloped slab between two z stations (e.g. ramps, stair flights)
  function slope(x0, x1, zA, yA, zB, yB, t, color, o) {
    const len = Math.hypot(zB - zA, yB - yA);
    const m = new THREE.Mesh(boxGeo(x1 - x0, t, len), mat(color));
    m.position.set((x0 + x1) / 2, (yA + yB) / 2 - t / 2, (zA + zB) / 2);
    m.rotation.x = -Math.atan2(yB - yA, zB - zA);
    return add(m, o);
  }
  // house-local rectangle [x0, z0, x1, z1] → world
  const inHouse = (h, [a, b, c, d]) => [HF(h) + a, b, HF(h) + c, d];

  // ------------------------------------------------------------- context
  // Ground mass around the basement hole, cut by the section plane too.
  const gb = -4;
  const X0 = -50, X1 = 95, Z0 = -55, Z1 = 75;
  const soilM = { roughness: 1 };
  staticBox(ground, X0, gb, D.BD, X1, D.GL, Z1, MAT.soil, soilM);                 // behind the basement
  staticBox(ground, X0, gb, 0, 0, D.GL, D.BD, MAT.soil, soilM);                    // north
  staticBox(ground, D.W, gb, 0, X1, D.GL, D.BD, MAT.soil, soilM);                  // south
  staticBox(ground, X0, gb, Z0, X1, D.GL - 0.1, D.FB, MAT.soil, soilM);            // under the street
  // front yard, cut by the two ramps
  staticBox(ground, X0, gb, D.FB, RAMPS[0][0], D.GL, 0, MAT.soil, soilM);
  staticBox(ground, RAMPS[0][1], gb, D.FB, RAMPS[1][0], D.GL, 0, MAT.soil, soilM);
  staticBox(ground, RAMPS[1][1], gb, D.FB, X1, D.GL, 0, MAT.soil, soilM);
  for (const [a, b] of RAMPS) staticBox(ground, a, gb, D.FB, b, rampY(0) - 0.2, 0, MAT.soil, soilM);
  staticBox(ground, 0, gb, 0, D.W, D.FORM, D.BD, MAT.soilDeep, soilM);             // below formation
  // surface finishes: footpath, berm, drive-in bays, kerb, carriageway, reserve
  const surf = (x0, y0, z0, x1, y1, z1, c) => { staticBox(context, x0, y0, z0, x1, y1, z1, c).userData.surface = true; };
  surf(X0, D.GL - 0.02, ST.fp, X1, D.GL + 0.02, D.FB, MAT.path);
  surf(X0, D.GL - 0.02, ST.berm, X1, D.GL + 0.03, ST.fp, MAT.grass);
  surf(X0, D.GL - 0.04, ST.bay, X1, D.GL, ST.berm, 0x6b6e72);                        // concrete drive-in parking bays
  surf(X0, D.GL - 0.04, ST.kerb, X1, D.GL + 0.1, ST.bay, MAT.kerb);
  surf(X0, D.GL - 0.08, ST.road, X1, D.GL - 0.04, ST.kerb, MAT.road);
  staticBox(context, X0, D.GL - 0.08, Z0, X1, D.GL + 0.04, ST.road - 2.5, MAT.reserve); // Vellenoweth Green
  staticBox(context, X0, D.GL - 0.08, ST.road - 2.5, X1, D.GL + 0.1, ST.road, MAT.kerb);
  staticBox(context, X0, D.GL, D.FB, D.SX0 - 0.05, D.GL + 0.03, Z1, MAT.grass);       // neighbour lawns
  staticBox(context, D.SX1 + 0.05, D.GL, D.FB, X1, D.GL + 0.03, Z1, MAT.grass);
  staticBox(context, D.SX0 - 0.05, D.GL, D.RB + 0.05, D.SX1 + 0.05, D.GL + 0.03, Z1, MAT.grass);
  // road centre line
  for (let x = X0 + 2; x < X1; x += 6) staticBox(context, x, D.GL - 0.039, (ST.kerb + ST.road) / 2 - 0.08, x + 3, D.GL - 0.03, (ST.kerb + ST.road) / 2 + 0.08, 0xf2f2ee);
  // existing drive-in bay lines (faded) – 2.5 m bays, clear of the two vehicle crossings
  const crossing = x => (x > RAMPS[0][0] - 1.4 && x < RAMPS[0][1] + 1.4) || (x > RAMPS[1][0] - 1.4 && x < RAMPS[1][1] + 1.4);
  for (let x = -16; x <= 60; x += 2.5) if (!crossing(x)) staticBox(context, x, D.GL + 0.001, ST.bay + 0.1, x + 0.1, D.GL + 0.008, ST.berm - 0.2, 0xc4c6c8);
  // neighbours: No. 8 Goldie St (north), No. 16 (south), and Maheke St / Polygon Rd behind
  const neighbour = (x0, x1, z0, z1, h, label) => {
    staticBox(context, x0, D.GL, z0, x1, D.GL + h, z1, MAT.neighbour);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 8.2, 3.0, 4, 1), mat(MAT.roofN));
    roof.rotation.y = Math.PI / 4; roof.scale.set((x1 - x0) / 11.6, 1, (z1 - z0) / 11.6);
    roof.position.set((x0 + x1) / 2, D.GL + h + 1.5, (z0 + z1) / 2); roof.castShadow = true;
    context.add(roof);
    if (label) { const g = makeLabel(label); g.position.set((x0 + x1) / 2, D.GL + h + 5.5, (z0 + z1) / 2); context.add(g); }
  };
  neighbour(-16, -3.5, 1, 15, 6, 'No. 8');
  neighbour(D.SX1 + 3, D.SX1 + 14, 2, 16, 6, 'No. 16');
  neighbour(1, 12, 35, 46, 5.2, null);          // Maheke St / Polygon Rd houses behind
  neighbour(15, 25, 36, 46, 5.2, null);
  neighbour(31, 43, 35, 46, 5.2, null);
  // reserve trees
  for (const [x, z, k] of [[-18, -26, 1], [-8, -36, 2], [-30, -30, 5], [64, -27, 6], [70, -40, 7], [-26, -44, 8]]) { const t = MX.tree(1.5, k); t.position.set(x, D.GL, z); context.add(t); }
  // cars parked along the far side of Goldie St
  [[-20, 0x2c2f33], [-6, 0xe8e8e6], [9, 0x5a1f1f], [26, 0x8a9aa8, 'suv'], [41, 0x1f2f45], [58, 0xd0d2d4, 'suv']].forEach(([x, c, t]) => { const v = MX.car(c, t); v.position.set(x, D.GL - 0.04, ST.road + 1.2); context.add(v); });
  const lbl = makeFlatLabel('GOLDIE STREET', 1.6); lbl.position.set(22.3, D.GL - 0.02, -15.6); context.add(lbl);
  const lbl2 = makeFlatLabel('VELLENOWETH GREEN', 1.4); lbl2.position.set(22.3, D.GL + 0.06, -30); context.add(lbl2);
  const north = makeFlatLabel('← NORTH', 1.2); north.position.set(-6, D.GL - 0.02, -13.2); context.add(north);

  let treeSeed = 20;
  function tree(parent, x, y, z, s) {
    const g = MX.tree(s * 1.1, treeSeed++);
    g.position.set(x, y, z); parent.add(g);
    return g;
  }
  // site crew in hi-vis for a stage: [x, y, z, facing, pose]
  const crew = (stage, list) => list.forEach(([x, y, z, r = 0, pose = 0], i) => {
    const w = MX.worker(i % 3 === 2 ? 0xff7a1a : 0xf6d31c, i % 4 === 3 ? 0x2f6fd0 : 0xf5f5f2, pose);
    w.position.set(x, y, z); w.rotation.y = r;
    add(w, { stage, seq: 0, anim: 'fade', rm: stage, rmSeq: 99, temp: true });
  });

  // ------------------------------------------------------------- 1 establishment
  const fenceH = 1.8;
  const fenceRun = (x0, z0, x1, z1) => box(Math.min(x0, x1) - 0.03, D.GL, Math.min(z0, z1) - 0.03, Math.max(x0, x1) + 0.03, D.GL + fenceH, Math.max(z0, z1) + 0.03, MAT.fence,
    { stage: 'est', seq: 0, anim: 'rise', rm: 'extfront', rmSeq: 0, temp: true }, { transparent: true, opacity: 0.4 });
  // boundary hoarding with the north exit gate (grid 1–2) and the south entry gate (grid 7–8)
  fenceRun(RAMPS[0][1] + 0.3, D.FB, RAMPS[1][0] - 0.3, D.FB);
  fenceRun(D.SX0, D.FB, D.SX0, D.RB); fenceRun(D.SX1, D.FB, D.SX1, D.RB); fenceRun(D.SX0, D.RB, D.SX1, D.RB);
  // site office & amenities: two-storey cabins in the north end of the works zone
  for (const [x, y, sq] of [[-12.6, D.GL, 1], [-12.6, D.GL + 2.85, 2]]) {
    const c = MX.siteCabin(6, 2.4, 2.7); c.position.set(x, y, ST.bay + 0.9); c.rotation.y = 0;
    add(c, { stage: 'est', seq: sq, rm: 'extfront', rmSeq: 7, temp: true });
  }
  { const st = new THREE.Group(); const sm = new THREE.MeshStandardMaterial({ color: 0x8a9096, metalness: 0.7, roughness: 0.4 });
    for (let k = 0; k < 13; k++) { const t = new THREE.Mesh(boxGeo(1.0, 0.04, 0.26), sm); t.position.set(-6.1 - k * 0.22, D.GL + 0.22 * (k + 1), ST.bay + 0.6); st.add(t); }
    add(st, { stage: 'est', seq: 2, rm: 'extfront', rmSeq: 7, temp: true }); }
  // wheel-wash at the north exit
  box(RAMPS[0][0], D.GL, D.FB - 1.4, RAMPS[0][1], D.GL + 0.25, D.FB + 1.2, 0x6f7b85, { stage: 'est', seq: 2, rm: 'ramps', temp: true });
  // silt fence along the frontage
  box(D.SX0, D.GL, D.FB + 0.3, D.SX1, D.GL + 0.6, D.FB + 0.4, 0x1d1f22, { stage: 'est', seq: 1, anim: 'rise', rm: 'dig', temp: true });
  // piling platform
  box(0, D.GL, 0, D.W, D.GL + 0.3, D.BD, MAT.gravel, { stage: 'est', seq: 3, anim: 'rise', rm: 'dig', rmSeq: 0, rmAnim: 'fade', temp: true, soil: true });

  // ------------------------------------------------------------- Goldie St works zone (TMP)
  // The drive-in bays along the frontage are taken as the construction works zone for
  // crane standings, deliveries/unloading and skips, and handed back re-marked at the end.
  const WZ0 = -13, WZ1 = D.W + 2;
  // barriers along the carriageway edge of the bays, with openings for trucks to pull in
  for (let x = WZ0; x < WZ1; x += 1.9) {
    if ((x > 8 && x < 14.5) || (x > 27 && x < 33)) continue;
    const b = MX.waterBarrier((Math.round((x - WZ0) / 1.9) % 2) ? 0xf2f2ee : 0xe8591a);
    b.position.set(x + 0.95, D.GL, ST.bay - 0.05);
    add(b, { stage: 'est', seq: 4, anim: 'rise', rm: 'extfront', rmSeq: 8, temp: true });
  }
  for (const x of [WZ0, WZ1]) for (const z of [ST.bay + 1, ST.bay + 3]) { const b = MX.waterBarrier(0xe8591a); b.rotation.y = Math.PI / 2; b.position.set(x, D.GL, z); add(b, { stage: 'est', seq: 4, anim: 'rise', rm: 'extfront', rmSeq: 8, temp: true }); }
  { const w = makeFlatLabel('WORKS ZONE · TMP', 0.9); w.position.set(36, D.GL + 0.03, ST.bay + 0.8);
    add(w, { stage: 'est', seq: 4, anim: 'fade', rm: 'extfront', rmSeq: 8, temp: true }); }
  // skips in the bays: muck/demo skip early, fitout skips later
  const skip = (x, color, o) => {
    const g = MX.skipBin(color); g.rotation.y = Math.PI / 2; g.position.set(x, D.GL, CZ);
    return add(g, o);
  };
  skip(-4.5, 0xd9a21b, { stage: 'est', seq: 5, anim: 'drop', rm: 'roof', rmSeq: 5, temp: true });
  skip(38.5, 0x2f6fb0, { stage: 'membrane', seq: 8, anim: 'drop', rm: 'extfront', rmSeq: 8, temp: true });
  skip(-2, 0x2f6fb0, { stage: 'facade', seq: 20, anim: 'drop', rm: 'extfront', rmSeq: 8, temp: true });
  // timber crane mats at each planned standing in the bays
  const mats = (cx, stage, rm) => {
    for (const [dx, dz] of [[-4, 2.2], [-4, -2.2], [3, 2.2], [3, -2.2]])
      box(cx + dx - 0.6, D.GL, CZ + dz - 0.6, cx + dx + 0.6, D.GL + 0.15, CZ + dz + 0.6, 0x8b6a45, { stage, seq: -1, anim: 'fade', rm, rmSeq: 100, temp: true });
  };
  for (const x of [13, 31]) mats(x, 'pools', 'pools');
  for (const x of [10, 22.3, 34.6]) mats(x, 'lg', 'l2');
  // footpath closed and pedestrians escorted past during lift windows (never a load over the public)
  for (const x of [-1.6, D.W + 1.6]) box(x - 0.2, D.GL, ST.fp, x + 0.2, D.GL + 1.0, D.FB, 0xe8591a, { stage: 'lg', seq: -1, anim: 'rise', rm: 'l2', rmSeq: 100, temp: true });
  { const f = makeFlatLabel('FOOTPATH CLOSED IN LIFT WINDOWS', 0.7); f.position.set(22.3, D.GL + 0.05, (ST.fp + D.FB) / 2);
    add(f, { stage: 'lg', seq: -1, anim: 'fade', rm: 'l2', rmSeq: 100, temp: true }); }
  // lane closure for the HPMV standing in the traffic lane while its load is lifted
  for (let x = 2; x < 26; x += 2.5) {
    const c = MX.cone(); c.position.set(x, D.GL - 0.05, LANE - 2.2);
    add(c, { stage: 'lg', seq: -1, anim: 'fade', rm: 'l2', rmSeq: 100, temp: true });
  }
  // HPMV precast delivery parked in the traffic lane during the panel & plank windows
  const hpmv = MX.hpmv('planks');
  hpmv.position.set(22, D.GL - 0.04, LANE);
  add(hpmv, { stage: 'lg', seq: 0, anim: 'fade', rm: 'l2', rmSeq: 100, temp: true });
  // fitout / facade delivery truck at the unloading bay
  const deliv = MX.deliveryTruck(0xf0f2f4); deliv.position.set(11.5, D.GL, CZ);
  add(deliv, { stage: 'joinery', seq: 0, anim: 'fade', rm: 'fitout', rmSeq: 100, temp: true });

  // ------------------------------------------------------------- 2 secant piles
  // perimeter on grid 1–8 × A–G, less the two ramp mouths on grid G
  const pilePts = [];
  const spacing = 0.75;
  const pushLine = (ax, az, bx, bz, skipFn) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / spacing);
    for (let i = 0; i < n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (skipFn && skipFn(x, z)) continue;
      pilePts.push([x, z]);
    }
  };
  const inMouth = (x, z) => z < 0.5 && ((x > 0.1 && x < RAMPS[0][1] + 0.1) || (x > RAMPS[1][0] - 0.1 && x < D.W - 0.1));
  pushLine(0, 0, D.W, 0, inMouth);
  pushLine(D.W, 0, D.W, D.BD);
  pushLine(D.W, D.BD, 0, D.BD);
  pushLine(0, D.BD, 0, 0);
  const pileTop = D.GL + 0.05, pileLen = 6.5;
  pilePts.forEach(([x, z], i) => {
    const primary = i % 2 === 0;
    cyl(x, pileTop - pileLen, z, 0.3, pileLen, primary ? 0xb3aea4 : 0x9f9a90,
      { stage: 'piles', seq: primary ? i : i + 0.5 + pilePts.length, anim: 'bore' }, 10);
  });
  // piling rig travels the wall line
  const rig = MX.pilingRig();
  rig.position.set(0, D.GL + 0.3, 0);
  add(rig, { stage: 'piles', seq: 0, anim: 'fade', rm: 'piles', rmSeq: 99, temp: true });
  rig.userData.el.rigPath = pilePts;

  // ------------------------------------------------------------- 3 public WW/SW re-route
  const pzW = (ST.berm + ST.fp) / 2, pzS = ST.berm - 1.2, py = D.GL - 1.8;
  pipe([-12, py, pzW], [33, py, pzW], 0.09, MAT.ww, { stage: 'reroute', seq: 0, anim: 'fade' });
  pipe([-8, py + 0.3, pzS], [27, py + 0.3, pzS], 0.12, MAT.sw, { stage: 'reroute', seq: 1, anim: 'fade' });
  for (const [x, z, c] of [[-10, pzW, MAT.ww], [15, pzW, MAT.ww], [24, pzS, MAT.sw]]) {
    cyl(x, py - 0.3, z, 0.55, D.GL - py + 0.3, c, { stage: 'reroute', seq: 2, anim: 'rise' }, 16);
    cyl(x, D.GL, z, 0.33, 0.035, 0x2e3033, { stage: 'reroute', seq: 2.5, anim: 'fade' }, 24);   // cast-iron lid
  }
  for (let x = -10; x < 36; x += 3) {
    const c = MX.cone();
    c.position.set(x, D.GL, ST.bay + 0.3);
    add(c, { stage: 'reroute', seq: 0, anim: 'fade', rm: 'reroute', rmSeq: 99, temp: true });
  }

  // ------------------------------------------------------------- 4 bulk excavation
  // soil plug inside the wall, removed in 3 lifts × 6 bays (ramp mouths first)
  const lifts = [[D.GL - 0.8, D.GL], [D.GL - 1.6, D.GL - 0.8], [D.FORM, D.GL - 1.6]];
  const NB = 6;
  lifts.forEach(([y0, y1], li) => {
    for (let b = 0; b < NB; b++) {
      const x0 = 0.3 + b * (D.W - 0.6) / NB, x1 = 0.3 + (b + 1) * (D.W - 0.6) / NB;
      const order = [0, 5, 1, 4, 2, 3].indexOf(b);
      box(x0, y0, 0.3, x1, y1, D.BD - 0.3, MAT.soil, { stage: 'est', seq: -1, anim: 'none', rm: 'dig', rmSeq: li * NB + order, rmAnim: 'dig', soil: true }, { roughness: 1 });
    }
  });
  const excavator = MX.excavator();
  excavator.position.set(22, D.FORM, 13);
  add(excavator, { stage: 'dig', seq: 0, anim: 'fade', rm: 'drain', rmSeq: 0, temp: true });
  const truck = MX.tipTruck(0xf1f2f0); truck.position.set(8, D.GL - 0.04, LANE);
  add(truck, { stage: 'dig', seq: 0, anim: 'fade', rm: 'dig', rmSeq: 99, temp: true });
  truck.userData.el.drive = true;

  // ------------------------------------------------------------- 5 capping beam & shotcrete
  const cb = [D.GL - 0.35, D.GL + 0.1];
  const FM0 = RAMPS[0][1] + 0.1, FM1 = RAMPS[1][0] - 0.1;   // front wall between the ramp mouths
  box(FM0, cb[0], -0.3, FM1, cb[1], 0.3, MAT.insitu, { stage: 'capping', seq: 0, anim: 'rise' });
  box(D.W - 0.3, cb[0], -0.3, D.W + 0.3, cb[1], D.BD + 0.3, MAT.insitu, { stage: 'capping', seq: 1, anim: 'rise' });
  box(-0.3, cb[0], D.BD - 0.3, D.W + 0.3, cb[1], D.BD + 0.3, MAT.insitu, { stage: 'capping', seq: 2, anim: 'rise' });
  box(-0.3, cb[0], -0.3, 0.3, cb[1], D.BD + 0.3, MAT.insitu, { stage: 'capping', seq: 3, anim: 'rise' });
  const sh = 0.1, fy0 = D.FORM, fy1 = D.GL - 0.35;
  box(D.W - 0.3 - sh, fy0, 0.3, D.W - 0.3, fy1, D.BD - 0.3, MAT.shot, { stage: 'capping', seq: 4, anim: 'rise' });
  box(0.3, fy0, D.BD - 0.3 - sh, D.W - 0.3, fy1, D.BD - 0.3, MAT.shot, { stage: 'capping', seq: 5, anim: 'rise' });
  box(0.3, fy0, 0.3, 0.3 + sh, fy1, D.BD - 0.3, MAT.shot, { stage: 'capping', seq: 6, anim: 'rise' });
  box(FM0, fy0, 0.3, FM1, fy1, 0.3 + sh, MAT.shot, { stage: 'capping', seq: 7, anim: 'rise' });

  // ------------------------------------------------------------- 6 private drainage
  const dy = D.FORM - 0.25;
  for (let h = 0; h < 5; h++) pipe([HC(h), dy, 3], [HC(h), dy - 0.2, D.BD - 2], 0.06, MAT.ww, { stage: 'drain', seq: h });
  pipe([2, dy - 0.25, D.BD - 2], [D.W - 2, dy - 0.3, D.BD - 2], 0.08, MAT.ww, { stage: 'drain', seq: 5 });
  pipe([1, dy, 1], [D.W - 1, dy, 1], 0.1, MAT.sw, { stage: 'drain', seq: 6 });
  for (let x = 2; x < D.W - 1; x += 3) pipe([x, dy + 0.1, 1.2], [x + 1.5, dy + 0.1, D.BD - 1.2], 0.05, 0x2d2d2d, { stage: 'drain', seq: 7 });
  for (const [x, z] of [[1.5, D.BD - 1.5], [D.W - 1.5, D.BD - 1.5]]) cyl(x, D.FORM - 1.2, z, 0.6, 1.4, 0x5d6166, { stage: 'drain', seq: 8, anim: 'rise' });

  // ------------------------------------------------------------- 7 tanking, XPS, hardfill
  const tk = [
    ['Sand blinding 50', MAT.blinding, D.FORM, D.FORM + 0.05, 0],
    ['Nuraply 3PTM membrane', MAT.membrane, D.FORM + 0.05, D.FORM + 0.07, 1],
    ['XPS 40 mm', MAT.xps, D.FORM + 0.07, D.FORM + 0.11, 2],
    ['Hardfill GAP65 150', MAT.hardfill, D.FORM + 0.11, D.FORM + 0.26, 3],
    ['Sand blinding 50', MAT.blinding, D.FORM + 0.26, D.FORM + 0.31, 4],
  ];
  const tIn = 0.4;
  tk.forEach(([name, c, y0, y1, k]) => {
    const m = box(tIn, y0, tIn, D.W - tIn, y1, D.BD - tIn, c, { stage: 'tank', seq: k, anim: 'rise', layer: k }, { roughness: k === 1 ? 0.55 : 0.95 });
    m.name = name;
  });
  const wm = (x0, z0, x1, z1, s) => box(x0, D.FORM, z0, x1, D.GL - 0.55, z1, MAT.wallMembrane, { stage: 'tank', seq: 5 + s, anim: 'rise', layer: 5 });
  const wd = (x0, z0, x1, z1, s) => box(x0, D.FORM, z0, x1, D.GL - 0.55, z1, MAT.drainBoard, { stage: 'tank', seq: 7 + s, anim: 'rise', layer: 6 });
  const f = 0.3 + sh;
  wm(D.W - f - 0.02, f, D.W - f, D.BD - f, 0); wm(f, D.BD - f - 0.02, D.W - f, D.BD - f, 0); wm(f, f, f + 0.02, D.BD - f, 0); wm(FM0, f, FM1, f + 0.02, 0);
  wd(D.W - f - 0.06, f, D.W - f - 0.02, D.BD - f, 0); wd(f, D.BD - f - 0.06, D.W - f, D.BD - f - 0.02, 0); wd(f + 0.02, f, f + 0.06, D.BD - f, 0); wd(FM0, f + 0.02, FM1, f + 0.06, 0);

  // ------------------------------------------------------------- 8 footings, lift pits, L0 slab
  const slabB = D.FORM + 0.31;
  for (let i = 0; i <= 5; i++) box(HX(i) - 0.35, slabB - 0.35, 0.6, HX(i) + 0.35, slabB, D.BD - 0.6, MAT.insitu, { stage: 'slab', seq: 0, anim: 'rise' });
  for (let h = 0; h < 5; h++) {
    const [a, b, c, d] = inHouse(h, LIFT_HOLE);
    box(a, slabB - 1.1, b, c, D.L0, d, MAT.insitu, { stage: 'slab', seq: 1, anim: 'rise' });
  }
  // 4 pours (AD-10: Pour 1 grid 1–3, Pours 2 + 3 grid 3–5, Pour 4 grid 5–8), less the ramps
  const rampRects = RAMPS.map(([a, b]) => [a - 0.05, -1, b + 0.05, D.RAMP_Z1]);
  [[0.4, HX(1)], [HX(1), HX(2)], [HX(2), HX(3)], [HX(3), D.W - 0.4]].forEach(([x0, x1], i) => {
    for (const [a, b, c, d] of rectMinus([x0, 0.4, x1, D.BD - 0.4], rampRects))
      box(a, slabB, b, c, D.L0, d, 0xb6b3ab, { stage: 'slab', seq: 2 + i, anim: 'rise' }, { roughness: 0.55 });
  });
  const pump = makePump(); pump.position.set(22.3, D.GL, CZ);
  add(pump, { stage: 'slab', seq: 2, anim: 'fade', rm: 'ramps', rmSeq: 99, temp: true });

  function makePump() { return MX.boomPump(21); }
  // agitator trucks queue in the bays behind the pump
  { const ag = MX.agitator(); ag.position.set(33, D.GL, CZ); add(ag, { stage: 'slab', seq: 2, anim: 'fade', rm: 'slab', rmSeq: 99, temp: true }); }

  // ------------------------------------------------------------- 9 incoming ducts (AD-06: trench near grid 6)
  const dcY = D.GL - 0.9;
  [[0x2a6fd1, 0], [0x2a6fd1, 0.25], [0x3aa0d8, 0.5], [0xe0b000, 0.75], [0x6a6a6a, 1.0]].forEach(([c, o], i) =>
    pipe([32.4 + o, dcY, ST.road + 2], [32.4 + o, dcY, 0.4], 0.05, c, { stage: 'ducts', seq: i }));

  // ------------------------------------------------------------- 10 ramps & flank walls
  // Exit ramp (north, grid 1–2) and entry ramp (south, grid 7–8) are open to the sky in the side
  // yards, falling from the boundary at the street level to the L0 slab at grid E.
  RAMPS.forEach(([a, b], k) => {
    slope(a, b, D.FB, D.GL, D.RAMP_Z1, D.L0, 0.18, 0xa4a19a, { stage: 'ramps', seq: k * 2, anim: 'fade' });
    // short insitu retaining flanks in the front yard, where the ramp leaves the pile line
    for (const x of [a - 0.2, b]) box(x, rampY(0) - 0.3, D.FB, x + 0.2, D.GL + 0.3, 0.3, MAT.insitu, { stage: 'ramps', seq: k * 2 + 1, anim: 'rise' });
    box(a, D.L0, D.RAMP_Z1, b, D.L0 + 0.05, D.RAMP_Z1 + 0.3, 0x444b52, { stage: 'ramps', seq: 4 }); // ACO channel at the foot
  });

  // ------------------------------------------------------------- props
  const props = (yBot, yTop, x0, z0, x1, z1, stage, rm, seqBase, skipAt) => {
    let k = 0;
    for (let x = x0 + 1.5; x < x1 - 0.8; x += 3.6) for (let z = z0 + 1.6; z < z1 - 0.8; z += 3.7) {
      if (skipAt && skipAt(x, z)) continue;
      cyl(x, yBot, z, 0.05, yTop - yBot, MAT.prop, { stage, seq: seqBase + (k++ % 6) * 0.01, anim: 'rise', rm, rmSeq: k, temp: true, layer: 'prop' }, 6);
    }
  };
  const inside = (x, z, [a, b, c, d], m = 0) => x > a - m && x < c + m && z > b - m && z < d + m;

  // ------------------------------------------------------------- 11 undercroft walls, columns & stairs
  const lgSoffit = D.LG - D.TOP - D.PLANK;
  // precast walls on grids 2–7 from G to E (red on AD-10): 6 lines × 4 panels
  for (let i = 0; i <= 5; i++) for (let s = 0; s < 4; s++) {
    const z0 = 0.3 + s * (D.RAMP_Z1 - 0.3) / 4, z1 = z0 + (D.RAMP_Z1 - 0.3) / 4 - 0.04;
    box(HX(i) - 0.075, D.L0, z0, HX(i) + 0.075, lgSoffit, z1, MAT.precast, { stage: 'undercroft', seq: i * 4 + s });
  }
  // columns and downstand beams on the grid lines behind grid E carry the LG slab over the aisle,
  // third spaces and storage (2.1 m clear under the beams)
  for (let i = 0; i <= 5; i++) {
    for (const z of [16.4, 19.9, 23.2]) box(HX(i) - 0.18, D.L0, z - 0.18, HX(i) + 0.18, lgSoffit - 0.35, z + 0.18, MAT.insitu, { stage: 'undercroft', seq: 30 + i, anim: 'rise' });
    box(HX(i) - 0.15, lgSoffit - 0.35, D.RAMP_Z1, HX(i) + 0.15, lgSoffit, D.BD - 0.4, MAT.insitu, { stage: 'undercroft', seq: 36 + i, anim: 'rise' });
  }
  // storage / plant / bin store walls (blockwork): per-house storage behind grid B, House 1
  // storage in grid 1–2, services plant room grid 7–8 A–B, bin store grid 7–8 B–C
  for (let h = 0; h < 5; h++) {
    box(HX(h) + 0.2, D.L0, 19.9 - 0.1, HX(h) + 5.4, lgSoffit - 0.35, 19.9 + 0.1, MAT.block, { stage: 'undercroft', seq: 42 + h, anim: 'rise' });
    box(HX(h) + 6.4, D.L0, 19.9 - 0.1, HX(h + 1) - 0.2, lgSoffit - 0.35, 19.9 + 0.1, MAT.block, { stage: 'undercroft', seq: 42 + h, anim: 'rise' });
  }
  box(0.4, D.L0, 17.8, 2.4, lgSoffit, 18.0, MAT.block, { stage: 'undercroft', seq: 47, anim: 'rise' });
  box(RAMPS[1][0], D.L0, 19.8, D.W - 1.6, lgSoffit, 20.0, MAT.block, { stage: 'undercroft', seq: 47, anim: 'rise' });
  box(RAMPS[1][0], D.L0, 17.8, D.W - 1.6, lgSoffit, 18.0, MAT.block, { stage: 'undercroft', seq: 47, anim: 'rise' });
  // painted internal wall lining to the basement perimeter (over the Nuradrain board)
  { const fi = 0.3 + 0.1 + 0.07, t = 0.15, top = lgSoffit - 0.05, col = 0xd8d6cf;
    box(D.W - fi - t, D.L0, D.RAMP_Z1, D.W - fi, top, D.BD - fi, col, { stage: 'undercroft', seq: 48, anim: 'rise' });
    box(fi, D.L0, D.BD - fi - t, D.W - fi, top, D.BD - fi, col, { stage: 'undercroft', seq: 48, anim: 'rise' });
    box(fi, D.L0, D.RAMP_Z1, fi + t, top, D.BD - fi, col, { stage: 'undercroft', seq: 48, anim: 'rise' });
    box(FM0, D.L0, fi, FM1, top, fi + t, col, { stage: 'undercroft', seq: 48, anim: 'rise' }); }
  // precast basement stair flights, one per house, along the south party wall (L0 at z 7.8 → LG at z 3.3)
  const FB0 = FLIGHTS[0];
  for (let h = 0; h < 5; h++) slope(HF(h) + FB0.x0 + 0.03, HF(h) + FB0.x1 - 0.03, FB0.zTop, D.LG, FB0.zBot, D.L0, 0.25, MAT.precast, { stage: 'undercroft', seq: 50 + h });
  // 55 t AT drives down the SOUTH (entry) ramp onto the L0 slab (mats), stands in the aisle and
  // erects the undercroft panels from the north end first, retreating south and backing out up the ramp
  const crane55a = makeCrane(0.75, 12, 3.2); crane55a.position.set(8, D.L0, 13.6);
  add(crane55a, { stage: 'undercroft', seq: 0, anim: 'fade', rm: 'undercroft', rmSeq: 99, temp: true });
  crane55a.userData.el.setups = { undercroft: [[8, 13.6], [15, 13.6], [22.3, 13.6], [29.6, 13.6], [36.5, 13.6], [42.5, 8]] };
  crane55a.userData.el.slew = [22.3, 5];

  // ------------------------------------------------------------- 12 pools
  // Precast shells hang from the podium into the storage zone (the dashed outlines on AD-10),
  // bedded on insitu plinth walls off the L0 slab. Top of shell = podium level.
  for (let h = 0; h < 5; h++) {
    const [px0, pz0, px1, pz1] = POOL(h), cx = (px0 + px1) / 2, cz = (pz0 + pz1) / 2;
    const shellBot = D.LG - 1.5;
    for (const z of [pz0 + 0.3, pz1 - 0.5]) box(px0 + 0.2, D.L0, z, px1 - 0.2, shellBot, z + 0.2, MAT.insitu, { stage: 'pools', seq: h * 2, anim: 'rise' }).name = 'Pool plinth';
    const g = new THREE.Group();
    const b0 = new THREE.Mesh(boxGeo(5, 0.2, 3), mat(MAT.precast)); b0.position.y = -1.4;
    const w1 = new THREE.Mesh(boxGeo(0.2, 1.5, 3), mat(MAT.precast)); w1.position.set(-2.4, -0.75, 0);
    const w2 = w1.clone(); w2.position.x = 2.4;
    const w3 = new THREE.Mesh(boxGeo(5, 1.5, 0.2), mat(MAT.precast)); w3.position.set(0, -0.75, -1.4);
    const w4 = w3.clone(); w4.position.z = 1.4;
    const lining = new THREE.Mesh(boxGeo(4.6, 0.02, 2.6), mat(0xe8f3f7)); lining.position.y = -1.29;
    [b0, w1, w2, w3, w4, lining].forEach(p => { p.castShadow = true; p.receiveShadow = true; g.add(p); });
    g.position.set(cx, D.LG, cz);
    add(g, { stage: 'pools', seq: h * 2 + 1 });
  }
  // ~15 t shells lifted from the Goldie St bays at ~32 m radius, over the open basement
  const crane130a = makeCrane(1, 32, 6); crane130a.position.set(13, D.GL, CZ);
  add(crane130a, { stage: 'pools', seq: 0, anim: 'fade', rm: 'pools', rmSeq: 99, temp: true });
  crane130a.userData.el.setups = { pools: [[13, CZ], [31.6, CZ]] };
  crane130a.userData.el.slew = [22.3, 23];

  // ------------------------------------------------------------- 13 LG planks + topping
  // Hollowcore planks span between the grid lines (7.4 m across each bay, 3.8 m in the ramp bays),
  // laid in 2.4 m widths. holes: [x0, z0, x1, z1] openings (stairs, lift shafts, pools).
  const planksIn = (y, [x0, z0, x1, z1], stage, seqBase, holes = []) => {
    const rows = Math.max(1, Math.round((z1 - z0) / 2.4)), pd = (z1 - z0) / rows;
    let k = 0;
    for (let r = 0; r < rows; r++) {
      const pieces = rectMinus([x0 + 0.02, z0 + r * pd + 0.02, x1 - 0.02, z0 + (r + 1) * pd - 0.02], holes);
      if (!pieces.length) continue;
      const seq = seqBase + k++;
      for (const [a, b, c, d] of pieces) box(a, y, b, c, y + D.PLANK, d, 0xc8c4ba, { stage, seq });
    }
    return k;
  };
  const toppingIn = (y, rect, stage, seq, holes = []) => {
    for (const [a, b, c, d] of rectMinus(rect, holes))
      box(a, y, b, c, y + D.TOP, d, 0xb4b1a9, { stage, seq, anim: 'rise' }, { roughness: 0.5 });
  };
  const LIFTS = [0, 1, 2, 3, 4].map(h => inHouse(h, LIFT_HOLE));
  const BSTAIRS = [0, 1, 2, 3, 4].map(h => inHouse(h, SLAB_HOLES.LG));
  const L1HOLES = [0, 1, 2, 3, 4].map(h => inHouse(h, SLAB_HOLES.L1));
  const L2HOLES = [0, 1, 2, 3, 4].map(h => inHouse(h, SLAB_HOLES.L2));
  const POOLS = [0, 1, 2, 3, 4].map(POOL);
  const LG_AREAS = [
    ...[0, 1, 2, 3, 4].map(h => [HX(h), 0, HX(h + 1), D.BD]),           // houses + podium, bay by bay
    [0, D.RAMP_Z1, HX(0), D.BD], [HX(5), D.RAMP_Z1, D.W, D.BD],          // side yards behind the ramps
  ];
  const LG_HOLES = [...LIFTS, ...BSTAIRS, ...POOLS];
  props(D.L0, lgSoffit, 0, 0, D.W, D.BD, 'lg', 'roof', 0, (x, z) =>
    (z < D.RAMP_Z1 && (x < HX(0) || x > HX(5))) || POOLS.some(p => inside(x, z, p, 0.4)) || LIFTS.some(p => inside(x, z, p, 0.3)) || BSTAIRS.some(p => inside(x, z, p, 0.3)));
  let nLG = 1;
  LG_AREAS.forEach(r => { nLG += planksIn(lgSoffit, r, 'lg', nLG, LG_HOLES); });
  LG_AREAS.forEach(r => toppingIn(lgSoffit + D.PLANK, r, 'lg', nLG + 2, LG_HOLES));
  // slab edge upstands where the side-yard deck meets the open ramp
  for (const [a, b] of [[0, HX(0)], [HX(5), D.W]])
    box(a, lgSoffit, D.RAMP_Z1 - 0.2, b, D.LG + 0.1, D.RAMP_Z1, MAT.insitu, { stage: 'lg', seq: nLG + 3, anim: 'rise' });
  // 130 t AT works only from the Goldie St bays, relocating along the frontage so it is
  // never stood on (or trapped by) the deck: set-ups in front of Houses 1–2, House 3 and Houses 4–5
  const crane130b = makeCrane(1, 30, 12); crane130b.position.set(10, D.GL, CZ);
  add(crane130b, { stage: 'lg', seq: 0, anim: 'fade', rm: 'l2', rmSeq: 99, temp: true });
  const SET3 = [[10, CZ], [22.3, CZ], [34.6, CZ]];
  crane130b.userData.el.setups = { lg: SET3, w1: SET3, l1: SET3, w2: SET3, l2: SET3 };
  crane130b.userData.el.slew = [22.3, 10];

  // ------------------------------------------------------------- 14/16 party walls
  const partyWalls = (y0, y1, depth, stage, seqOff, north) => {
    const n = 6;
    for (let i = 0; i <= 5; i++) {
      for (let s = 0; s < n; s++) {
        const z0 = s * depth / n, z1 = (s + 1) * depth / n - 0.04;
        const isSandwich = north && i === 0;
        box(HX(i) - 0.075, y0, z0, HX(i) + 0.075, y1, z1, isSandwich ? 0xa9b3b8 : MAT.precast, { stage, seq: seqOff + i * n + s, house: Math.min(i, 4) });
      }
    }
  };
  partyWalls(D.LG, D.L1 - D.TOP - D.PLANK, D.HD1, 'w1', 0, false);

  // ------------------------------------------------------------- 15 L1 planks, balconies, topping
  const HOUSE_RECTS = [0, 1, 2, 3, 4].map(h => [HX(h), 0, HX(h + 1), D.HD1]);
  const UP_HOLES = [...LIFTS, ...L1HOLES, ...L2HOLES];
  const L1_HOLES = [...LIFTS, ...L1HOLES], L2_HOLES = [...LIFTS, ...L2HOLES];
  const l1S = D.L1 - D.TOP - D.PLANK;
  props(D.LG, l1S, HX(0), 0, HX(5), D.HD1, 'l1', 'roof', 0, (x, z) => L1_HOLES.some(p => inside(x, z, p, 0.3)));
  let nL1 = 1;
  HOUSE_RECTS.forEach(r => { nL1 += planksIn(l1S, r, 'l1', nL1, L1_HOLES); });
  HOUSE_RECTS.forEach(r => toppingIn(l1S + D.PLANK, r, 'l1', nL1 + 8, L1_HOLES));
  for (let h = 0; h < 5; h++) box(HX(h) + 0.6, D.L1 - 0.25, -1.8, HX(h + 1) - 0.6, D.L1, 0, MAT.precast, { stage: 'l1', seq: nL1 + 2 + h });

  partyWalls(D.L1, D.L2 - D.TOP - D.PLANK, D.HD1, 'w2', 0, true);

  // ------------------------------------------------------------- 17 L2 (floor runs to grid C; the rear 3.7 m is the roof terrace)
  const l2S = D.L2 - D.TOP - D.PLANK;
  props(D.L1, l2S, HX(0), 0, HX(5), D.HD1, 'l2', 'roof', 0, (x, z) => L2_HOLES.some(p => inside(x, z, p, 0.3)));
  let nL2 = 1;
  HOUSE_RECTS.forEach(r => { nL2 += planksIn(l2S, r, 'l2', nL2, L2_HOLES); });
  HOUSE_RECTS.forEach(r => toppingIn(l2S + D.PLANK, r, 'l2', nL2 + 8, L2_HOLES));
  for (let h = 0; h < 5; h++) box(HX(h) + 0.6, D.L2 - 0.25, -1.8, HX(h + 1) - 0.6, D.L2, 0, MAT.precast, { stage: 'l2', seq: nL2 + 2 + h });

  // ------------------------------------------------------------- 19 steel, L2 framing, roof
  const BX0 = HX(0), BX1 = HX(5);
  for (let h = 0; h < 5; h++) {
    for (const z of [0.3, D.HD2 - 0.3]) box(HC(h) - 0.1, D.L2, z - 0.1, HC(h) + 0.1, D.ROOF, z + 0.1, MAT.steel, { stage: 'roof', seq: h, anim: 'rise', house: h });
    box(HX(h) + 0.2, D.ROOF - 0.35, 0.2, HX(h + 1) - 0.2, D.ROOF - 0.05, 0.45, MAT.steel, { stage: 'roof', seq: 5 + h, house: h });
  }
  for (let h = 0; h < 5; h++) for (const z of [0.1, D.HD2 - 0.1]) {
    for (let x = HX(h) + 0.3; x < HX(h + 1) - 0.2; x += 0.6)
      box(x, D.L2, z - 0.045, x + 0.045, D.ROOF - 0.35, z + 0.045, MAT.timber, { stage: 'roof', seq: 10 + h, anim: 'rise', house: h });
  }
  for (let i = 0; i <= 5; i++) box(HX(i) - 0.1, D.L2, 0, HX(i) + 0.1, D.ROOF, D.HD2, 0xd5c29f, { stage: 'roof', seq: 15 + i, anim: 'rise' });
  for (let z = 0.3; z < D.HD2; z += 0.9) box(BX0, D.ROOF - 0.3, z, BX1, D.ROOF - 0.05, z + 0.06, MAT.timber, { stage: 'roof', seq: 22 + z / 3 });
  box(BX0, D.ROOF - 0.05, 0, BX1, D.ROOF, D.HD2, MAT.ply, { stage: 'roof', seq: 30 });
  box(BX0, D.ROOF, -0.05, BX1, D.ROOF + 0.6, 0.15, MAT.ply, { stage: 'roof', seq: 31, anim: 'rise' });
  box(BX0, D.ROOF, D.HD2 - 0.15, BX1, D.ROOF + 0.6, D.HD2 + 0.05, MAT.ply, { stage: 'roof', seq: 31, anim: 'rise' });
  const hiab = makeCrane(0.6, 18, 15); hiab.position.set(22.3, D.GL, CZ);
  add(hiab, { stage: 'roof', seq: 0, anim: 'fade', rm: 'roof', rmSeq: 99, temp: true });
  hiab.userData.el.setups = { roof: [[12, CZ], [22.3, CZ], [32.6, CZ]] };
  hiab.userData.el.slew = [22.3, 7];

  // ------------------------------------------------------------- 20 scaffold + membrane
  // base(x, z): what each standard lands on (street / front yard, ramp slab, or the podium deck)
  const scafBase = (x, z) => {
    if (z > D.HD1) return D.LG;
    if (x < HX(0) || x > HX(5)) return z < D.RAMP_Z1 ? rampY(z) : D.LG;
    return D.GL;
  };
  const scaf = (x0, z0, x1, z1, out, seq) => {
    // out: [dx, dz] direction away from the building
    const g = new THREE.Group();
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const len = along ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const top = D.ROOF + 1.2;
    const at = (s, off) => [along ? Math.min(x0, x1) + s + out[0] * off : x0 + out[0] * off, along ? z0 + out[1] * off : Math.min(z0, z1) + s + out[1] * off];
    for (let s = 0; s <= len; s += 2.4) for (const off of [0, 1.1]) {
      const [px, pz] = at(s, off), b0 = scafBase(px, pz);
      const post = new THREE.Mesh(boxGeo(0.06, top - b0, 0.06), mat(MAT.scaffold, { metalness: 0.4 }));
      post.position.set(px, (top + b0) / 2, pz); g.add(post);
    }
    const lo = Math.max(D.GL, scafBase(...at(0, 0)), scafBase(...at(len, 0))) + 2;
    for (let y = lo; y <= top; y += 2) for (const off of [0, 1.1]) {
      const [px, pz] = at(len / 2, off);
      const led = new THREE.Mesh(boxGeo(along ? len : 0.05, 0.05, along ? 0.05 : len), mat(MAT.scaffold, { metalness: 0.4 }));
      led.position.set(px, y, pz); g.add(led);
      if (off === 1.1) {
        const [dx2, dz2] = at(len / 2, 0.55);
        const deck = new THREE.Mesh(boxGeo(along ? len : 1.1, 0.04, along ? 1.1 : len), mat(0x9b7b4f));
        deck.position.set(dx2, y - 0.05, dz2); g.add(deck);
      }
    }
    const [nx, nz] = at(len / 2, 1.15);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(len, top - lo + 2), mat(0xcfd6da, { transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    net.position.set(nx, (top + lo - 2) / 2, nz);
    if (!along) net.rotation.y = Math.PI / 2;
    g.add(net);
    g.children.forEach(c => { c.castShadow = true; });
    add(g, { stage: 'membrane', seq, anim: 'rise', rm: 'strike', rmSeq: seq, temp: true });
  };
  scaf(BX0 - 0.4, -0.4, BX1 + 0.4, -0.4, [0, -1], 0);
  scaf(BX0 - 0.4, 0, BX0 - 0.4, D.HD1, [-1, 0], 1);
  scaf(BX1 + 0.4, 0, BX1 + 0.4, D.HD1, [1, 0], 2);
  scaf(BX0 - 0.4, D.HD1 + 0.4, BX1 + 0.4, D.HD1 + 0.4, [0, 1], 3);
  // protected pedestrian gantry over the footpath
  box(-0.4, D.GL + 2.6, ST.fp, D.W + 0.4, D.GL + 2.8, D.FB + 0.2, 0x7b8a96, { stage: 'membrane', seq: 0, anim: 'fade', rm: 'strike', rmSeq: 3, temp: true });
  // goods hoist
  box(21.7, D.GL, -2.2, 22.9, D.ROOF + 1.5, -1.2, 0xd5d9dc, { stage: 'membrane', seq: 1, anim: 'rise', rm: 'strike', rmSeq: 2, temp: true }, { transparent: true, opacity: 0.6 });
  // membrane roof + L2 roof terraces
  box(BX0 + 0.1, D.ROOF, 0.15, BX1 - 0.1, D.ROOF + 0.04, D.HD2 - 0.15, MAT.roofMem, { stage: 'membrane', seq: 4, anim: 'fade' }, { roughness: 0.6 });
  box(BX0 + 0.1, D.L2, D.HD2, BX1 - 0.1, D.L2 + 0.03, D.HD1, MAT.roofMem, { stage: 'membrane', seq: 5, anim: 'fade' }, { roughness: 0.6 });
  box(BX0 - 0.05, D.ROOF + 0.68, -0.16, BX1 + 0.05, D.ROOF + 0.72, 0.2, 0x8a9096, { stage: 'membrane', seq: 6 });
  box(BX0 - 0.05, D.ROOF + 0.68, D.HD2 - 0.2, BX1 + 0.05, D.ROOF + 0.72, D.HD2 + 0.16, 0x8a9096, { stage: 'membrane', seq: 6 });

  // ------------------------------------------------------------- 21 joinery
  const glassM = { transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.3 };
  const joinery = (h, y0, y1, z, seq, xs) => {
    const x0 = xs ?? HX(h) + 0.5, x1 = HX(h + 1) - 0.5;
    const g = new THREE.Group();
    const gl = new THREE.Mesh(boxGeo(x1 - x0, y1 - y0, 0.03), mat(MAT.glass, glassM)); gl.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
    g.add(gl);
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 4) {
      const mull = new THREE.Mesh(boxGeo(0.06, y1 - y0, 0.08), mat(0x2e3236)); mull.position.set(x, (y0 + y1) / 2, z); g.add(mull);
    }
    for (const y of [y0, y1]) { const tr = new THREE.Mesh(boxGeo(x1 - x0, 0.06, 0.08), mat(0x2e3236)); tr.position.set((x0 + x1) / 2, y, z); g.add(tr); }
    add(g, { stage: 'joinery', seq, anim: 'fade', house: h });
  };
  for (let h = 0; h < 5; h++) {
    joinery(h, D.LG + 0.05, D.L1 - 0.45, FRONT_LG + 0.02, h, HF(h) + PORCH[2]);
    joinery(h, D.L1 + 0.05, D.L2 - 0.45, 0.02, h + 5);
    joinery(h, D.L2 + 0.05, D.ROOF - 0.4, 0.2, h + 10);
    joinery(h, D.LG + 0.05, D.L1 - 0.45, D.HD1 - 0.02, h + 15);
    joinery(h, D.L1 + 0.05, D.L2 - 0.45, D.HD1 - 0.02, h + 20);
    joinery(h, D.L2 + 0.05, D.ROOF - 0.4, D.HD2 - 0.2, h + 25);
  }

  // ------------------------------------------------------------- 22 facade
  for (let h = 0; h < 5; h++) {
    const x0 = HX(h), x1 = HX(h + 1);
    for (const [y0, y1] of [[D.L1 - 0.45, D.L1 + 0.05], [D.L2 - 0.45, D.L2 + 0.05]]) {
      box(x0, y0, -0.1, x1, y1, 0.02, MAT.render, { stage: 'facade', seq: h, house: h, anim: 'fade' });
      box(x0, y0, D.HD1 - 0.02, x1, y1, D.HD1 + 0.1, MAT.render, { stage: 'facade', seq: h, house: h, anim: 'fade' });
    }
    box(x0 + 0.05, D.LG, -0.35, x0 + 0.5, D.L2 + 0.05, 0.02, MAT.grc, { stage: 'facade', seq: 5 + h, house: h, anim: 'rise' });
    box(x0, D.ROOF - 0.4, -0.13, x1, D.ROOF + 0.68, -0.07, MAT.nuwall, { stage: 'facade', seq: 10 + h, house: h, anim: 'fade' });
    box(x0, D.ROOF - 0.4, D.HD2 + 0.07, x1, D.ROOF + 0.68, D.HD2 + 0.13, MAT.nuwall, { stage: 'facade', seq: 10 + h, house: h, anim: 'fade' });
    box(x0, D.GL - 0.1, -0.1, x1, D.LG + 0.05, 0.02, MAT.render, { stage: 'facade', seq: h, house: h, anim: 'fade' });  // LG plinth
  }
  // end walls rendered to the side yards: down to the ramp over grid G–E, down to the deck behind
  for (const [x0, x1, s] of [[BX0 - 0.2, BX0 - 0.075, 15], [BX1 + 0.075, BX1 + 0.2, 16]]) {
    box(x0, D.L0 + 0.3, 0, x1, D.ROOF + 0.6, D.RAMP_Z1, MAT.render, { stage: 'facade', seq: s, anim: 'fade' });
    box(x0, D.LG, D.RAMP_Z1, x1, D.ROOF + 0.6, D.HD1, MAT.render, { stage: 'facade', seq: s, anim: 'fade' });
  }
  for (let h = 0; h < 5; h++) for (const y of [D.L1 - 0.28, D.L2 - 0.28])
    box(HX(h) + 0.6, y, -1.8, HX(h + 1) - 0.6, y + 0.03, 0, 0x9c6b3f, { stage: 'facade', seq: 17 + h, house: h, anim: 'fade' });

  // ------------------------------------------------------------- 23 carpark doors, garage doors & balustrades
  // Metalbilt carpark doors where each ramp runs under the side-yard deck at grid E (shown open)
  for (const [a, b] of RAMPS) box(a, lgSoffit - 0.45, D.RAMP_Z1 - 0.1, b, lgSoffit, D.RAMP_Z1 + 0.35, MAT.door, { stage: 'doors', seq: 0, anim: 'rise' }, { metalness: 0.5 });
  // double garage door per house, facing the aisle on grid E (shown open, rolled into the head)
  for (let h = 0; h < 5; h++) box(HX(h) + 0.4, lgSoffit - 0.5, D.RAMP_Z1 - 0.35, HX(h) + 5.6, lgSoffit - 0.05, D.RAMP_Z1 - 0.05, 0x8d949b, { stage: 'doors', seq: 0.5, anim: 'rise', house: h }, { metalness: 0.4 });
  for (let h = 0; h < 5; h++) for (const y of [D.L1, D.L2])
    box(HX(h) + 0.6, y, -1.85, HX(h + 1) - 0.6, y + 1.05, -1.78, MAT.balustrade, { stage: 'doors', seq: 1 + h, house: h, anim: 'rise' }, { transparent: true, opacity: 0.4 });
  // L2 roof terrace balustrades
  for (let h = 0; h < 5; h++) box(HX(h) + 0.1, D.L2, D.HD1 - 0.08, HX(h + 1) - 0.1, D.L2 + 1.05, D.HD1 - 0.02, MAT.balustrade, { stage: 'doors', seq: 6 + h, house: h, anim: 'rise' }, { transparent: true, opacity: 0.4 });

  // ------------------------------------------------------------- 24 services & lifts (house flow-line)
  for (let h = 0; h < 5; h++) {
    const [a, b, c, d] = inHouse(h, [LIFT.x0, LIFT.z0, LIFT.x1, LIFT.z1]);
    box(a, D.L0, b, c, D.ROOF - 0.4, d, MAT.lift, { stage: 'services', seq: h * 3 + 2, house: h, anim: 'rise' }, { transparent: true, opacity: 0.7, metalness: 0.4 });
    for (const y of [D.L1 - 0.6, D.L2 - 0.6, D.ROOF - 0.7])
      box(HF(h) + 2.55, y, 1, HF(h) + 3.05, y + 0.3, D.HD2 - 1.5, MAT.duct2, { stage: 'services', seq: h * 3, house: h, anim: 'fade' });
    cyl(HF(h) + 5.9, D.L0, 11.95, 0.08, D.ROOF - D.L0, MAT.ww, { stage: 'services', seq: h * 3 + 1, house: h, anim: 'rise' }, 8);
    // HWCs in the basement, in front of the garage
    for (const dx of [0, 0.8]) cyl(HF(h) + 1.0 + dx, D.L0, 1.1, 0.33, 1.8, 0xe8e8e8, { stage: 'services', seq: h * 3 + 1, house: h, anim: 'rise' }, 14);
  }
  // carpark LED battens: along the aisle, over each garage and in the ramp bays
  for (let x = 2; x < D.W - 1; x += 3.7) box(x - 0.6, lgSoffit - 0.06, 12.4, x + 0.6, lgSoffit - 0.02, 12.5, 0xffffff, { stage: 'services', seq: 17, anim: 'fade' }, { emissive: 0xfff6e8, emissiveIntensity: 1.4 });
  for (let h = 0; h < 5; h++) for (const z of [3, 7.5]) box(HF(h) + 2.0, lgSoffit - 0.06, z, HF(h) + 3.2, lgSoffit - 0.02, z + 0.1, 0xffffff, { stage: 'services', seq: 17, anim: 'fade', house: h }, { emissive: 0xfff6e8, emissiveIntensity: 1.4 });
  // carpark extract fans along the aisle
  box(6, lgSoffit - 0.5, 13.4, 38, lgSoffit - 0.1, 13.9, 0x9aa4ad, { stage: 'services', seq: 16, anim: 'fade' });

  // ------------------------------------------------------------- 25 fitout (house flow-line)
  for (let h = 0; h < 5; h++) {
    const x0 = HF(h), x1 = HF(h) + 7.25;
    for (const [y, depth] of [[D.LG, D.HD1], [D.L1, D.HD1], [D.L2, D.HD2]]) {
      const top = y === D.L2 ? D.ROOF - 0.35 : y + 3.23 - 0.5;
      box(x0, y, 4.35, x1, top, 4.45, MAT.fit, { stage: 'fitout', seq: h * 4, house: h, anim: 'rise' });
      box(x0 + 3.25, y, 4.4, x0 + 3.35, top, 8.0, MAT.fit, { stage: 'fitout', seq: h * 4, house: h, anim: 'rise' });
      box(x0 + 3.3, y, 7.95, x1, top, 8.05, MAT.fit, { stage: 'fitout', seq: h * 4, house: h, anim: 'rise' });
      for (const [a, b, c, d] of rectMinus([x0 + 0.02, y === D.LG ? FRONT_LG + 0.1 : 0.2, x1 - 0.02, depth - 0.2], y === D.LG ? [BSTAIRS[h], LIFTS[h]] : y === D.L1 ? [L1HOLES[h], LIFTS[h]] : [L2HOLES[h], LIFTS[h]]))
        box(a, y + 0.001, b, c, y + 0.03, d, 0xb88a57, { stage: 'fitout', seq: h * 4 + 3, house: h, anim: 'fade' });
      if (y === D.L1) box(x0 + 2.6, y, 13.4, x0 + 4.9, y + 0.9, 15.6, 0x3c3f44, { stage: 'fitout', seq: h * 4 + 2, house: h });
    }
  }

  // ------------------------------------------------------------- 27–31 external works
  // Per-house scope from the Lindsay Building Estimate Rev A, laid out to AD-06: the LG terrace
  // on grid C–B and the pool court on grid B–A, both on the podium over the basement at LG level.
  const EX = {
    slab: 0xcfccc4, block: 0xc7c1b4, coping: 0xebe6db, tile: 0xd9d3c7, deck: 0x8c7660, soil: 0x4e3b2a,
    pebble: 0xbab6ad, nuwall: 0x3f454b, alu: 0x9aa1a8, shrub: 0x5d8a45, fill: 0xa39c90,
  };
  const slatFence = (x0, z0, x1, z1, y0, h, o) => {
    const len = Math.hypot(x1 - x0, z1 - z0), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const m = new THREE.Mesh(boxGeo(alongX ? len : 0.04, h, alongX ? 0.04 : len), mat(0x9c6b3f, { roughness: 0.9 }));
    m.position.set((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2);
    return add(m, o);
  };
  const glassPanel = (x0, z0, x1, z1, y0, o) => {
    const g = new THREE.Group();
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = alongX ? x1 - x0 : z1 - z0;
    const pane = new THREE.Mesh(boxGeo(alongX ? len : 0.012, 1.2, alongX ? 0.012 : len), mat(MAT.balustrade, { transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2 }));
    pane.position.set((x0 + x1) / 2, y0 + 0.1 + 0.6, (z0 + z1) / 2); g.add(pane);
    for (let s2 = 0.2; s2 < len; s2 += 0.9) {
      const sp = new THREE.Mesh(boxGeo(0.05, 0.28, 0.05), mat(0x3a3f44, { metalness: 0.7, roughness: 0.3 }));
      sp.position.set(alongX ? x0 + s2 : x0, y0 + 0.14, alongX ? z0 : z0 + s2); g.add(sp);
    }
    return add(g, o);
  };
  const PY = D.LG;                    // podium finished level
  const TZ0 = D.HD1, TZ1 = 19.9;      // LG terrace (grid C–B)
  const QZ0 = 19.9, QZ1 = D.BD - 0.35; // pool court (grid B–A)

  for (let h = 0; h < 5; h++) {
    const x0 = HX(h), x1 = HX(h + 1), cx = HC(h);
    const [px0, pz0, px1, pz1] = POOL(h);

    // --- Externals 1: podium build-up, block upstands, concrete terraces & pool surrounds
    for (const [a1, b1, c1, d1] of rectMinus([x0 + 0.1, TZ0 + 0.02, x1 - 0.1, QZ1], [[px0, pz0, px1, pz1]]))
      box(a1, PY - 0.02, b1, c1, PY + 0.08, d1, EX.slab, { stage: 'extslab', seq: 2 + h * 0.01, anim: 'rise', house: h }, { roughness: 0.8 });
    // block upstand walls between the courts (party lines) and the rear planter wall on grid A
    box(x0 - 0.1, PY, TZ0, x0 + 0.1, PY + 0.9, QZ1, EX.block, { stage: 'extslab', seq: 1.5, anim: 'rise', house: h });
    if (h === 4) box(x1 - 0.1, PY, TZ0, x1 + 0.1, PY + 0.9, QZ1, EX.block, { stage: 'extslab', seq: 1.5, anim: 'rise', house: h });
    box(x0 + 0.1, PY, QZ1, x1 - 0.1, PY + 0.55, D.BD + 0.2, EX.block, { stage: 'extslab', seq: 1 + h * 0.01, anim: 'rise', house: h });

    // --- Externals 2: pool plant, coping, outdoor tiles, pool fence, fill
    const cp = 0.3;
    for (const [a1, b1, c1, d1] of [[px0 - cp, pz0 - cp, px1 + cp, pz0], [px0 - cp, pz1, px1 + cp, pz1 + cp], [px0 - cp, pz0, px0, pz1], [px1, pz0, px1 + cp, pz1]])
      box(a1, PY + 0.08, b1, c1, PY + 0.13, d1, EX.coping, { stage: 'extpool', seq: 1 + h * 0.01, house: h }, { roughness: 0.5 });
    for (const [a1, b1, c1, d1] of rectMinus([x0 + 0.1, TZ0 + 0.02, x1 - 0.1, QZ1 - 0.6], [[px0 - cp, pz0 - cp, px1 + cp, pz1 + cp]]))
      box(a1, PY + 0.08, b1, c1, PY + 0.1, d1, EX.tile, { stage: 'extpool', seq: 2 + h * 0.01, anim: 'fade', house: h }, { roughness: 0.45 });
    // pool plant enclosure against the rear planter wall
    const plant = new THREE.Group();
    { const enc = new THREE.Mesh(boxGeo(1.2, 1.0, 0.8), mat(EX.nuwall, { metalness: 0.4 })); enc.position.set(x0 + 1.0, PY + 0.6, QZ1 - 0.95);
      const hp = new THREE.Mesh(boxGeo(0.9, 0.7, 0.35), mat(0xe4e6e8)); hp.position.set(x0 + 2.3, PY + 0.45, QZ1 - 0.8);
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 18), mat(0x333333)); fan.rotation.x = Math.PI / 2; fan.position.set(x0 + 2.3, PY + 0.48, QZ1 - 0.99);
      plant.add(enc, hp, fan); }
    add(plant, { stage: 'extpool', seq: 0 + h * 0.01, house: h });
    // frameless glass pool barrier across the court on grid B, gate on the north side
    const g0 = x0 + 0.5, g1 = x0 + 1.5;
    glassPanel(x0 + 0.15, QZ0, g0, QZ0, PY + 0.1, { stage: 'extpool', seq: 3 + h * 0.01, anim: 'rise', house: h });
    glassPanel(g1, QZ0, x1 - 0.15, QZ0, PY + 0.1, { stage: 'extpool', seq: 3 + h * 0.01, anim: 'rise', house: h });
    const pg = new THREE.Group();
    { const leaf = new THREE.Mesh(boxGeo(1.0, 1.2, 0.014), mat(MAT.balustrade, { transparent: true, opacity: 0.35, roughness: 0.05 }));
      leaf.position.set((g0 + g1) / 2, PY + 0.8, QZ0);
      const hinge = new THREE.Mesh(boxGeo(0.06, 0.18, 0.06), mat(0x222222, { metalness: 0.8 })); hinge.position.set(g0 + 0.05, PY + 1.05, QZ0);
      const latch = new THREE.Mesh(boxGeo(0.06, 0.12, 0.08), mat(0x222222, { metalness: 0.8 })); latch.position.set(g1 - 0.05, PY + 1.45, QZ0);
      pg.add(leaf, hinge, latch); }
    add(pg, { stage: 'extpool', seq: 3.5 + h * 0.01, anim: 'fade', house: h });
    const water = box(px0 + 0.2, PY - 1.25, pz0 + 0.2, px1 - 0.2, PY - 0.02, pz1 - 0.2, MAT.water, { stage: 'extpool', seq: 5 + h * 0.01, anim: 'rise', house: h }, { transparent: true, opacity: 0.78, roughness: 0.08 });
    water.name = 'Pool fill';

    // --- Externals 3: deck, outdoor kitchen, spiral stair, fences
    const deck = new THREE.Group();
    { const dz0 = pz1 + cp + 0.05, dz1 = QZ1 - 0.65, dx0 = x0 + 2.9, dx1 = x1 - 0.2;
      const frame = new THREE.Mesh(boxGeo(dx1 - dx0, 0.06, dz1 - dz0), mat(0x6b5a48)); frame.position.set((dx0 + dx1) / 2, PY + 0.13, (dz0 + dz1) / 2); deck.add(frame);
      for (let x = dx0; x < dx1 - 0.1; x += 0.16) { const b2 = new THREE.Mesh(boxGeo(0.14, 0.02, dz1 - dz0), mat(EX.deck, { roughness: 0.85 })); b2.position.set(x + 0.07, PY + 0.17, (dz0 + dz1) / 2); deck.add(b2); } }
    add(deck, { stage: 'extdeck', seq: 0 + h * 0.01, anim: 'rise', house: h });
    const ok = new THREE.Group();
    { const cab = new THREE.Mesh(boxGeo(0.62, 0.88, 1.6), mat(0x3d4146, { roughness: 0.6 })); cab.position.set(x0 + 0.5, PY + 0.52, TZ0 + 1.0);
      const top = new THREE.Mesh(boxGeo(0.66, 0.03, 1.66), mat(0xeeeae3, { roughness: 0.25 })); top.position.set(x0 + 0.5, PY + 0.98, TZ0 + 1.0);
      const bbq = new THREE.Mesh(boxGeo(0.5, 0.12, 0.8), mat(0x9aa1a8, { metalness: 0.8, roughness: 0.3 })); bbq.position.set(x0 + 0.5, PY + 1.06, TZ0 + 0.8);
      ok.add(cab, top, bbq); }
    add(ok, { stage: 'extdeck', seq: 1 + h * 0.01, house: h });
    { const pf = new THREE.Group(); poolFurniture(pf, x0, PY, pz1 - 0.1); add(pf, { stage: 'extdeck', seq: 1.5 + h * 0.01, anim: 'fade', house: h }); }
    // external spiral stair, LG terrace → L2 roof terrace (By Owner)
    const sp = new THREE.Group();
    { const sx = x1 - 1.1, sz = TZ0 + 1.0, rise2 = D.L2 - D.LG, n = 30;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, rise2 + 1.1, 10), mat(0x2d3034, { metalness: 0.6 })); pole.position.set(sx, D.LG + (rise2 + 1.1) / 2, sz); sp.add(pole);
      for (let k = 0; k < n; k++) {
        const a = Math.PI / 2 + k / n * Math.PI * 2 * 1.75;
        const tr = new THREE.Mesh(boxGeo(0.8, 0.04, 0.26), mat(0x3a3e42, { metalness: 0.5, roughness: 0.4 }));
        tr.position.set(sx + Math.cos(a) * 0.42, D.LG + (k + 1) * rise2 / n, sz + Math.sin(a) * 0.42); tr.rotation.y = -a;
        sp.add(tr);
        const post = new THREE.Mesh(boxGeo(0.02, 1.0, 0.02), mat(0x2d3034)); post.position.set(sx + Math.cos(a) * 0.83, D.LG + (k + 1) * rise2 / n + 0.5, sz + Math.sin(a) * 0.83); sp.add(post);
      } }
    add(sp, { stage: 'extdeck', seq: 2 + h * 0.01, anim: 'rise', house: h });
    // privacy fences between courts, on the block upstands
    slatFence(x0, TZ0 + 0.3, x0, QZ1, PY + 0.9, 0.9, { stage: 'extdeck', seq: 4 + h * 0.01, anim: 'rise', house: h });
    if (h === 4) slatFence(x1, TZ0 + 0.3, x1, QZ1, PY + 0.9, 0.9, { stage: 'extdeck', seq: 4 + h * 0.01, anim: 'rise', house: h });

    // --- Externals 4 (per house): front path, steps up to the LG entry, pedestrian gate & letterbox
    const fx0 = HF(h) + 0.1, fx1 = HF(h) + 1.55, nS = 5, rs = (D.LG - D.GL) / nS;
    for (let k = 0; k < nS; k++) box(fx0, D.GL, -0.3 - (nS - 1 - k) * 0.32 - 0.32, fx1, D.GL + (k + 1) * rs, -0.3 - (nS - 1 - k) * 0.32, EX.slab, { stage: 'extfront', seq: 4 + h * 0.01, anim: 'rise', house: h });
    box(fx0, D.GL, -0.3, fx1, D.LG, 0, EX.slab, { stage: 'extfront', seq: 4 + h * 0.01, anim: 'rise', house: h });

    // --- Externals 5: soft landscaping & lighting
    box(x0 + 0.2, PY + 0.55, QZ1 + 0.05, x1 - 0.2, PY + 0.6, D.BD + 0.15, EX.soil, { stage: 'soft', seq: 1 + h * 0.01, anim: 'fade', house: h });
    for (let x = x0 + 0.5; x < x1 - 0.3; x += 0.9) {
      const shb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), mat(EX.shrub, { flatShading: true }));
      shb.position.set(x, PY + 0.85, (QZ1 + D.BD) / 2 + 0.05); add(shb, { stage: 'soft', seq: 2 + h * 0.01, anim: 'grow', house: h });
    }
    // front garden beds either side of the entry steps
    box(HF(h) + 1.8, D.GL, D.FB + 0.35, HX(h + 1) - 0.1, D.GL + 0.12, -0.15, EX.soil, { stage: 'soft', seq: 1 + h * 0.01, anim: 'fade', house: h });
    for (let x = HF(h) + 2.2; x < HX(h + 1) - 0.3; x += 0.9) {
      const shb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), mat(EX.shrub, { flatShading: true }));
      shb.position.set(x, D.GL + 0.35, -1.2); add(shb, { stage: 'soft', seq: 2 + h * 0.01, anim: 'grow', house: h });
    }
    for (const [bx, bz] of [[x1 - 0.5, TZ1 - 0.3], [x0 + 0.4, QZ1 - 0.3]]) {
      const bl = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 10), mat(0x2d3034, { metalness: 0.5 })); post.position.set(bx, PY + 0.45, bz);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.08, 10), mat(0xfff1c9, { emissive: 0xffd98a, emissiveIntensity: 0.8 })); lamp.position.set(bx, PY + 0.76, bz);
      bl.add(post, lamp); add(bl, { stage: 'soft', seq: 3 + h * 0.01, anim: 'rise', house: h });
    }
  }
  // side yards over the basement behind the ramps (grid 1–2 and 7–8, E–A): paving and planting
  for (const [a, b] of [[0.1, HX(0) - 0.1], [HX(5) + 0.1, D.W - 0.1]]) {
    box(a, PY - 0.02, D.RAMP_Z1 + 0.05, b, PY + 0.08, D.BD - 0.2, EX.slab, { stage: 'extslab', seq: 4, anim: 'rise' }, { roughness: 0.8 });
    box(a + 0.1, PY + 0.08, D.RAMP_Z1 + 1, a + 1.1, PY + 0.2, D.BD - 1, EX.soil, { stage: 'soft', seq: 1, anim: 'fade' });
  }
  // balustrades along the open ramps and the podium edge on the side boundaries
  for (const [a, b] of RAMPS) box(a < 20 ? b - 0.03 : a, D.GL, D.FB, a < 20 ? b : a + 0.03, D.GL + 1.1, 0, MAT.balustrade, { stage: 'extfront', seq: 2.5, anim: 'rise' }, { transparent: true, opacity: 0.4 });
  // boundary fences: north & south sides and the rear boundary
  slatFence(D.SX0 + 0.02, D.FB, D.SX0 + 0.02, D.RB, D.GL, 1.8, { stage: 'extdeck', seq: 4, anim: 'rise' });
  slatFence(D.SX1 - 0.02, D.FB, D.SX1 - 0.02, D.RB, D.GL, 1.8, { stage: 'extdeck', seq: 4, anim: 'rise' });
  slatFence(D.SX0, D.RB - 0.02, D.SX1, D.RB - 0.02, D.GL, 1.8, { stage: 'extdeck', seq: 4.5, anim: 'rise' });
  box(D.SX0, D.GL, D.BD + 0.3, D.SX1, D.GL + 0.08, D.RB - 0.05, EX.soil, { stage: 'soft', seq: 0, anim: 'fade' });
  // specimen trees at the rear planters
  for (const x of [HC(0), HC(2), HC(4)]) {
    const t = tree(root, x - 2.5, PY + 0.55, (QZ1 + D.BD) / 2, 0.8); root.remove(t);
    add(t, { stage: 'soft', seq: 4, anim: 'grow' });
  }

  // --- Externals 4: frontage
  for (const [a, b] of RAMPS) {
    // exposed-aggregate vehicle crossing through the footpath and berm, onto the ramp
    box(a - 0.6, D.GL, ST.berm, b + 0.6, D.GL + 0.045, D.FB, MAT.aggregate, { stage: 'extfront', seq: 0, anim: 'fade' }, { roughness: 0.95 });
    // permanent flood barrier and vehicle gate at the boundary, NPR camera post
    box(a, D.GL, D.FB + 0.15, b, D.GL + 0.18, D.FB + 0.45, 0x55595e, { stage: 'extfront', seq: 2, anim: 'rise' }, { metalness: 0.5 });
    box(a, D.GL, D.FB + 0.02, b, D.GL + 1.6, D.FB + 0.07, 0x2a2d31, { stage: 'extfront', seq: 3, anim: 'rise' }, { metalness: 0.6 });
    const px = a < 20 ? b + 0.25 : a - 0.4;
    box(px, D.GL, D.FB - 0.6, px + 0.15, D.GL + 1.3, D.FB - 0.45, 0x2a2d31, { stage: 'extfront', seq: 3, anim: 'rise' }, { metalness: 0.6 });
  }
  box(-12, D.GL, ST.fp + 0.05, D.W + 12, D.GL + 0.035, D.FB - 0.05, 0xc9c6bd, { stage: 'extfront', seq: 1, anim: 'fade' });   // footpath reinstated
  // front wall with a pedestrian gate and letterbox per house
  let wx = RAMPS[0][1] + 0.2;
  for (let h = 0; h < 5; h++) {
    const g0 = HF(h) + 0.1, g1 = HF(h) + 1.55;
    box(wx, D.GL, D.FB + 0.02, g0, D.GL + 1.1, D.FB + 0.22, EX.block, { stage: 'extfront', seq: 4, anim: 'rise' });
    box(g0 + 0.02, D.GL + 0.05, D.FB + 0.08, g1 - 0.02, D.GL + 1.05, D.FB + 0.12, 0x2a2d31, { stage: 'extfront', seq: 5, anim: 'fade' }, { metalness: 0.6 });
    box(g1 + 0.1, D.GL + 0.75, D.FB - 0.05, g1 + 0.45, D.GL + 1.05, D.FB + 0.1, 0x2a2d31, { stage: 'extfront', seq: 5, anim: 'fade' }, { metalness: 0.5 });
    wx = g1;
  }
  box(wx, D.GL, D.FB + 0.02, RAMPS[1][0] - 0.2, D.GL + 1.1, D.FB + 0.22, EX.block, { stage: 'extfront', seq: 4, anim: 'rise' });
  // drive-in bays resurfaced and re-marked across the frontage (the new on-street carpark)
  box(-12, D.GL + 0.001, ST.bay + 0.05, D.W + 12, D.GL + 0.012, ST.berm - 0.05, 0x55585c, { stage: 'extfront', seq: 7, anim: 'fade' }, { roughness: 0.95 });
  for (let x = -12; x <= D.W + 12; x += 2.5) if (!crossing(x)) box(x, D.GL + 0.012, ST.bay + 0.1, x + 0.12, D.GL + 0.02, ST.berm - 0.2, 0xf2f2ee, { stage: 'extfront', seq: 7.5, anim: 'fade' });
  // street trees in the berm, on the party-wall lines
  for (const i of [1, 2, 3, 4]) {
    const t = tree(root, HX(i), D.GL, (ST.fp + ST.berm) / 2, 0.45); root.remove(t);
    add(t, { stage: 'soft', seq: 5, anim: 'grow' });
  }

  // ------------------------------------------------------------- site crews by stage
  const { GL, FORM, L0, LG, L1, L2, ROOF } = D, TK = FORM + 0.31;
  crew('est', [[-3, GL, -3.5, 1], [2, GL, -1.8, 0, 1], [10, GL, 3, 2]]);
  crew('piles', [[6, GL + 0.3, 2.5, 0.5], [8, GL + 0.3, 1.8, 2, 2], [-2, GL, -6, 1]]);
  crew('reroute', [[5, GL, ST.fp - 0.4, 0, 2], [12, GL, ST.fp - 0.2, 1], [20, GL, ST.bay + 1.2, 3]]);
  crew('dig', [[12, FORM, 8, 1], [30, FORM, 6, 2, 1]]);
  crew('capping', [[1.4, FORM, 12, 0], [43, FORM, 16, 3, 2]]);
  crew('drain', [[10, FORM, 5, 0, 2], [20, FORM, 20, 1]]);
  crew('tank', [[8, TK, 6, 0, 2], [16, TK, 10, 1], [30, TK, 18, 2, 2], [38, TK, 8, 3]]);
  crew('slab', [[12, L0, 8, 0, 2], [14, L0, 9, 1], [26, L0, 12, 2], [28, L0, 13, 0, 2], [20, L0, 20, 1]]);
  crew('ducts', [[32, GL, -3, 0, 2], [34, GL, ST.fp - 0.4, 1]]);
  crew('ramps', [[2, L0 + 0.6, 8, 0], [42.5, L0 + 0.6, 8, 2, 2]]);
  crew('undercroft', [[6, L0, 12, 0], [18, L0, 12.2, 1], [11, L0, 5, 0, 2], [30, L0, 12.4, 2]]);
  crew('pools', [[7, L0, 20.6, 0], [25, L0, 20.8, 0, 2], [13, GL, ST.fp - 0.6, 1]]);
  crew('lg', [[8, LG, 5, 0], [15, LG, 9, 1, 2], [30, LG, 6, 2], [36, LG, 12, 3], [22, GL, ST.fp - 0.6, 0]]);
  crew('w1', [[6, LG, 3, 0], [18, LG, 10, 1], [33, LG, 14, 0, 1]]);
  crew('l1', [[10, L1, 6, 0, 2], [26, L1, 8, 1], [34, L1, 12, 2]]);
  crew('w2', [[9, L1, 4, 0], [24, L1, 11, 1]]);
  crew('l2', [[12, L2, 6, 0], [28, L2, 9, 0, 2], [37, L2, 5, 2]]);
  crew('roof', [[10, ROOF, 5, 0], [20, ROOF, 9, 0, 2], [34, ROOF, 7, 1]]);
  crew('membrane', [[15, ROOF + 0.04, 6, 0, 2], [30, ROOF + 0.04, 10, 1]]);
  crew('joinery', [[12, GL, -1.5, 0], [27, GL, -1.2, 0, 1]]);
  crew('facade', [[9, GL + 5.97, -0.95, 0], [30, GL + 7.97, -0.95, 0, 2]]);
  crew('extslab', [[10, LG, 22, 0, 2], [26, LG, 24, 1]]);
  crew('extpool', [[15, LG, 20.4, 0], [34, LG, 20.6, 2, 2]]);
  crew('extdeck', [[20, LG, 25.3, 0, 2]]);
  crew('extfront', [[5, GL, ST.fp + 0.6, 0, 2], [40, GL, ST.berm - 1, 1], [22, GL, -2.1, 0]]);
  crew('soft', [[12, LG, 25.8, 0, 2], [8, GL, -1.3, 0, 2]]);

  // ------------------------------------------------------------- 28 PC – house number plates
  for (let h = 0; h < 5; h++) {
    const l = makeLabel(`House ${h + 1}`, 1.1);
    l.position.set(HC(h), D.ROOF + 2.2, D.HD2 / 2);
    add(l, { stage: 'pc', seq: h, anim: 'fade' });
    l.castShadow = false;
  }

  // ------------------------------------------------------------- helpers
  // s = size, reach = working radius shown on the ground (m)
  function makeCrane(s, reach = 16, hookY = 9) {
    return MX.mobileCrane({ axles: s >= 1 ? 5 : s >= 0.7 ? 3 : 2, reach, hookY, luff: s >= 1 ? 0.95 : 0.8 });
  }

  return { root, items, context, ground };
}

export function makeFlatLabel(text, size = 1.5) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const fs = 96;
  const font = `700 ${fs}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 20;
  c.width = w; c.height = fs + 20;
  ctx.font = font; ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 10, c.height / 2 + 4);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size * w / c.height, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI; // readable from the street side looking east
  m.scale.x = -1; // the scene is mirrored to true handedness (see MIRROR in the apps)
  return m;
}

export function makeLabel(text, size = 1.4) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const fs = 64;
  ctx.font = `600 ${fs}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 40;
  c.width = w; c.height = fs + 30;
  ctx.font = `600 ${fs}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  ctx.fillStyle = 'rgba(20,28,38,0.78)';
  const r = 14; ctx.beginPath(); ctx.roundRect(0, 0, w, c.height, r); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(text, 20, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(size * w / c.height, size, 1);
  sp.renderOrder = 10;
  return sp;
}
