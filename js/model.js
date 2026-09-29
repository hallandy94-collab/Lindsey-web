// Builds the Goldie Street 3D model, one mesh per buildable element.
// Every element is tagged with the stage it is built in (and, for temporary
// works, the stage it is removed in) so the sequencer can animate it.
//
// Axes: x runs along Goldie Street (north 0 → south 30.18), z runs east
// away from the street, y is RL in metres. Massing is derived from the pack
// quantities (30.18 m frontage, 769 m² L0 plate, 670 / 525 m² L1 / L2
// plates, RLs from the methodology). It is indicative, not the HAL design.

import * as THREE from 'three';

export const DIM = {
  W: 30.18,          // frontage
  BD: 25.5,          // basement depth (769 m² / 30.18)
  SITE_D: 45.2,      // site depth (1,364 m² / 30.18)
  HD1: 22.2,         // LG / L1 house depth (670 m² / 30.18)
  HD2: 17.4,         // L2 house depth (525 m² / 30.18)
  GL: 3.75,          // existing ground / street
  FORM: 1.32,        // basement formation
  L0: 1.82,          // top of L0 slab
  LG: 4.61, L1: 7.84, L2: 11.07, ROOF: 14.1,
  PLANK: 0.2, TOP: 0.075,
  RAMP_W: 3.6, RAMP_L: 12,
};
const D = DIM;
const HOUSE_W = D.W / 5;

export const MAT = {
  soil: 0x7c5e40, soilDeep: 0x5f4630, gravel: 0x9a948a, precast: 0xc2beb4, insitu: 0xaeaba3,
  shot: 0x98958d, membrane: 0x26272b, wallMembrane: 0x3b3c44, drainBoard: 0x3f7a4f, xps: 0x6ea6d8,
  hardfill: 0x8d857a, blinding: 0xcdbd8e, steel: 0x56616e, timber: 0xc9a26b, ply: 0xd8bd8b,
  roofMem: 0x33373d, glass: 0x9cc9dc, render: 0xefeee8, grc: 0xd6cfbf, nuwall: 0x41474d,
  prop: 0xe0a91b, scaffold: 0xa0a9b2, crane: 0xf0b323, truck: 0xe9ecef, fence: 0x2f6480,
  ww: 0xb05a24, sw: 0x2f8a55, duct: 0x2a6fd1, water: 0x46b3d6, grass: 0x7fa35a, road: 0x4a4d52,
  path: 0xb9b6ad, kerb: 0xd0cdc5, neighbour: 0xd9d4ca, roofN: 0x8e8a84, reserve: 0x8fb46a,
  aggregate: 0x5b5a57, lift: 0x7f95a8, duct2: 0xd46a3a, fit: 0xf3e9d8, tree: 0x4f7a3a, trunk: 0x6b4f35,
  office: 0xe8e2d0, balustrade: 0xbfe3ee, door: 0x6d7379,
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

  // ------------------------------------------------------------- context
  // Ground mass around the basement hole, cut by the section plane too.
  const gb = -4;
  const X0 = -45, X1 = 75, Z0 = -40, Z1 = 75;
  const soilM = { roughness: 1 };
  staticBox(ground, X0, gb, D.SITE_D, X1, D.GL, Z1, MAT.soil, soilM);            // behind site
  staticBox(ground, X0, gb, 0, 0, D.GL, D.SITE_D, MAT.soil, soilM);              // north
  staticBox(ground, D.W, gb, 0, X1, D.GL, D.SITE_D, MAT.soil, soilM);            // south
  staticBox(ground, 0, gb, D.BD, D.W, D.GL, D.SITE_D, MAT.soil, soilM);          // east garden
  staticBox(ground, X0, gb, Z0, X1, D.GL - 0.02, 0, MAT.soil, soilM);            // under street
  staticBox(ground, 0, gb, 0, D.W, D.FORM, D.BD, MAT.soilDeep, soilM);           // below formation
  // surface finishes
  staticBox(context, X0, D.GL - 0.02, -2.6, X1, D.GL + 0.02, 0, MAT.path);       // footpath
  staticBox(context, X0, D.GL - 0.02, -3.0, X1, D.GL + 0.1, -2.6, MAT.kerb);     // kerb
  // Goldie Street: drive-in (nose-in) parking bays along the frontage (z −8 → −3), then the carriageway
  staticBox(context, X0, D.GL - 0.04, -8.0, X1, D.GL, -3.0, 0x55585d);            // drive-in parking bays
  staticBox(context, X0, D.GL - 0.04, -16.0, X1, D.GL, -8.0, MAT.road);          // carriageway
  staticBox(context, X0, D.GL - 0.02, Z0, X1, D.GL + 0.04, -16.0, MAT.reserve);  // Vellenoweth Green
  staticBox(context, X0, D.GL, 0, -0.4, D.GL + 0.03, Z1, MAT.grass);             // neighbour lawns
  staticBox(context, D.W + 0.4, D.GL, 0, X1, D.GL + 0.03, Z1, MAT.grass);
  staticBox(context, -0.4, D.GL, D.SITE_D, D.W + 0.4, D.GL + 0.03, Z1, MAT.grass);
  // road markings
  for (let x = X0 + 2; x < X1; x += 6) staticBox(context, x, D.GL + 0.001, -12.1, x + 3, D.GL + 0.012, -11.95, 0xf2f2ee);
  // existing drive-in bay lines (faded) – 2.5 m bays, 5 m deep
  for (let x = -14; x <= 44; x += 2.5) staticBox(context, x, D.GL + 0.001, -8.0, x + 0.1, D.GL + 0.008, -3.2, 0xb9bcbf);
  staticBox(context, -14, D.GL + 0.001, -8.05, 44.1, D.GL + 0.008, -7.95, 0xb9bcbf);
  // neighbours No. 8 (north) and No. 16 (south)
  const neighbour = (x0, x1, label) => {
    staticBox(context, x0, D.GL, 6, x1, D.GL + 6, 20, MAT.neighbour);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 8.2, 3.2, 4, 1), mat(MAT.roofN));
    roof.rotation.y = Math.PI / 4; roof.scale.set((x1 - x0) / 11.6, 1, 14 / 11.6);
    roof.position.set((x0 + x1) / 2, D.GL + 6 + 1.6, 13); roof.castShadow = true;
    context.add(roof);
    const g = makeLabel(label); g.position.set((x0 + x1) / 2, D.GL + 12, 13); context.add(g);
  };
  neighbour(-15, -3, 'No. 8');
  neighbour(D.W + 3, D.W + 15, 'No. 16');
  // reserve trees
  for (const [x, z] of [[-18, -21], [-8, -32], [40, -22], [50, -30], [-30, -26], [62, -23]]) tree(context, x, D.GL, z, 1.3);
  const lbl = makeFlatLabel('GOLDIE STREET', 1.6); lbl.position.set(15, D.GL + 0.03, -13.6); context.add(lbl);
  const lbl2 = makeFlatLabel('VELLENOWETH GREEN', 1.8); lbl2.position.set(15, D.GL + 0.06, -20); context.add(lbl2);
  const north = makeFlatLabel('NORTH →', 1.2); north.position.set(-8, D.GL + 0.03, -10.2); context.add(north);

  function tree(parent, x, y, z, s) {
    const g = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.2 * s, 2.2 * s, 6), mat(MAT.trunk));
    t.position.y = 1.1 * s; t.castShadow = true;
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 * s, 0), mat(MAT.tree, { flatShading: true }));
    c.position.y = 3 * s; c.castShadow = true;
    g.add(t, c); g.position.set(x, y, z); parent.add(g);
    return g;
  }

  // ------------------------------------------------------------- 1 establishment
  const fenceH = 1.8;
  const fenceRun = (x0, z0, x1, z1) => box(Math.min(x0, x1) - 0.03, D.GL, Math.min(z0, z1) - 0.03, Math.max(x0, x1) + 0.03, D.GL + fenceH, Math.max(z0, z1) + 0.03, MAT.fence,
    { stage: 'est', seq: 0, anim: 'rise', rm: 'extfront', rmSeq: 0, temp: true }, { transparent: true, opacity: 0.4 });
  fenceRun(-0.3, -0.3, 5, -0.3); fenceRun(9, -0.3, 21, -0.3); fenceRun(25.2, -0.3, D.W + 0.3, -0.3);
  fenceRun(-0.3, -0.3, -0.3, D.SITE_D); fenceRun(D.W + 0.3, -0.3, D.W + 0.3, D.SITE_D); fenceRun(-0.3, D.SITE_D, D.W + 0.3, D.SITE_D);
  // site office & amenities (east garden)
  for (let i = 0; i < 3; i++) box(20 + i * 3.2, D.GL, 38, 22.8 + i * 3.2, D.GL + 2.7, 44, MAT.office, { stage: 'est', seq: 1, rm: 'extslab', rmSeq: 1, temp: true });
  box(20, D.GL + 2.7, 38, 23, D.GL + 5.3, 44, MAT.office, { stage: 'est', seq: 2, rm: 'extslab', rmSeq: 1, temp: true });
  // wheel-wash at the north exit
  box(0.5, D.GL, -0.2, 4.5, D.GL + 0.25, 3.5, 0x6f7b85, { stage: 'est', seq: 2, rm: 'ramps', temp: true });
  // silt fence along the frontage
  box(-0.2, D.GL, 0.3, D.W + 0.2, D.GL + 0.6, 0.4, 0x1d1f22, { stage: 'est', seq: 1, anim: 'rise', rm: 'dig', temp: true });
  // piling platform
  box(0, D.GL, 0, D.W, D.GL + 0.3, D.BD, MAT.gravel, { stage: 'est', seq: 3, anim: 'rise', rm: 'dig', rmSeq: 0, rmAnim: 'fade', temp: true, soil: true });

  // ------------------------------------------------------------- Goldie St works zone (TMP)
  // The drive-in bays along the frontage are taken as the construction works zone for
  // crane standings, deliveries/unloading and skips, and handed back re-marked at the end.
  const WZ0 = -1.5, WZ1 = D.W + 1.5;
  // barriers along the carriageway edge of the bays, with openings for trucks to pull in
  for (let x = WZ0; x < WZ1; x += 1.9) {
    if ((x > 6 && x < 12.5) || (x > 17 && x < 23)) continue;
    const b = new THREE.Group();
    const body = new THREE.Mesh(boxGeo(1.8, 0.8, 0.4), mat((Math.round((x - WZ0) / 1.9) % 2) ? 0xf2f2ee : 0xe8591a, { roughness: 0.6 }));
    body.position.set(x + 0.9, D.GL + 0.4, -8.2); b.add(body);
    add(b, { stage: 'est', seq: 4, anim: 'rise', rm: 'extfront', rmSeq: 8, temp: true });
  }
  // end barriers across the bays
  for (const x of [WZ0, WZ1]) box(x - 0.2, D.GL, -8.0, x + 0.2, D.GL + 0.8, -3.3, 0xe8591a, { stage: 'est', seq: 4, anim: 'rise', rm: 'extfront', rmSeq: 8, temp: true });
  { const w = makeFlatLabel('WORKS ZONE · TMP', 0.9); w.position.set(26, D.GL + 0.03, -7.2);
    add(w, { stage: 'est', seq: 4, anim: 'fade', rm: 'extfront', rmSeq: 8, temp: true }); }
  // skips in the bays: muck/demo skip early, fitout skips later
  const skip = (x, color, o) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(boxGeo(2.0, 1.3, 3.8), mat(color, { roughness: 0.7, metalness: 0.3 })); body.position.set(x, D.GL + 0.65, -5.4);
    const load = new THREE.Mesh(boxGeo(1.8, 0.2, 3.5), mat(0x8a8176, { roughness: 1 })); load.position.set(x, D.GL + 1.2, -5.4);
    g.add(body, load);
    return add(g, o);
  };
  skip(27.8, 0xd9a21b, { stage: 'est', seq: 5, anim: 'drop', rm: 'roof', rmSeq: 5, temp: true });
  skip(27.8, 0x2f6fb0, { stage: 'membrane', seq: 8, anim: 'drop', rm: 'extfront', rmSeq: 8, temp: true });
  skip(1.2, 0x2f6fb0, { stage: 'facade', seq: 20, anim: 'drop', rm: 'extfront', rmSeq: 8, temp: true });
  // timber crane mats at the 130 t standing in the bays
  const mats = (cx, stage, rm) => {
    for (const [dx, dz] of [[-4, 2.2], [-4, -2.2], [3, 2.2], [3, -2.2]])
      box(cx + dx - 0.6, D.GL, -6.5 + dz - 0.6, cx + dx + 0.6, D.GL + 0.15, -6.5 + dz + 0.6, 0x8b6a45, { stage, seq: -1, anim: 'fade', rm, rmSeq: 100, temp: true });
  };
  mats(22, 'pools', 'pools');
  mats(15, 'lg', 'l2');
  // HPMV precast delivery parked in the unloading bay during the panel & plank windows
  const hpmv = new THREE.Group();
  { const cab = new THREE.Mesh(boxGeo(2.6, 3.0, 2.5), mat(0xc0392b)); cab.position.set(-0.2, 1.8, 0);
    const deckT = new THREE.Mesh(boxGeo(13, 0.3, 2.5), mat(0x2d3034)); deckT.position.set(7.6, 1.2, 0);
    const a1 = new THREE.Mesh(boxGeo(0.3, 2.8, 2.2), mat(0x2d3034)); a1.position.set(7.6, 2.7, 0); a1.rotation.z = 0.08;
    hpmv.add(cab, deckT, a1);
    for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(boxGeo(7.4, 0.2, 2.4), mat(0xc8c4ba)); p.position.set(9, 1.45 + k * 0.22, 0); hpmv.add(p); }
    for (const x of [-0.8, 5.2, 11.2, 12.4]) for (const z of [-1.1, 1.1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 14), mat(0x1c1c1c)); w.rotation.x = Math.PI / 2; w.position.set(x, 0.5, z); hpmv.add(w); }
    hpmv.traverse(c => { if (c.isMesh) c.castShadow = true; }); }
  hpmv.position.set(-0.5, D.GL, -5.3);
  add(hpmv, { stage: 'lg', seq: 0, anim: 'fade', rm: 'l2', rmSeq: 100, temp: true });
  // fitout / facade delivery truck at the unloading bay
  const deliv = makeTruck(0xf0f2f4); deliv.position.set(9.5, D.GL, -5.3);
  add(deliv, { stage: 'joinery', seq: 0, anim: 'fade', rm: 'fitout', rmSeq: 100, temp: true });

  // ------------------------------------------------------------- 2 secant piles
  // perimeter: front (z=0) with ramp mouths, sides, back (z=BD)
  const pilePts = [];
  const spacing = 0.75;
  const pushLine = (ax, az, bx, bz, skip) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / spacing);
    for (let i = 0; i < n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (skip && skip(x, z)) continue;
      pilePts.push([x, z]);
    }
  };
  const inMouth = (x, z) => z < 0.5 && ((x > 0.1 && x < 0.3 + D.RAMP_W + 0.2) || (x > D.W - 0.3 - D.RAMP_W - 0.2 && x < D.W - 0.1));
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
  const rig = new THREE.Group();
  { const body = new THREE.Mesh(boxGeo(4, 1.6, 3), mat(MAT.crane)); body.position.y = 1.1;
    const tr = new THREE.Mesh(boxGeo(4.6, 0.7, 3.6), mat(0x2b2d31)); tr.position.y = 0.35;
    const mast = new THREE.Mesh(boxGeo(0.5, 16, 0.5), mat(MAT.crane)); mast.position.set(-2.2, 8.5, 0);
    const kelly = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 12, 8), mat(0x444)); kelly.position.set(-2.6, 7, 0);
    [body, tr, mast, kelly].forEach(p => { p.castShadow = true; rig.add(p); }); }
  rig.position.set(0, D.GL + 0.3, 0);
  add(rig, { stage: 'piles', seq: 0, anim: 'fade', rm: 'piles', rmSeq: 99, temp: true });
  rig.userData.el.rigPath = pilePts;

  // ------------------------------------------------------------- 3 public WW/SW re-route
  const pz = -6, pz2 = -8.2, py = D.GL - 1.8;
  pipe([-8, py, pz], [37, py, pz], 0.09, MAT.ww, { stage: 'reroute', seq: 0, anim: 'fade' });
  pipe([-8, py + 0.3, pz2], [27, py + 0.3, pz2], 0.12, MAT.sw, { stage: 'reroute', seq: 1, anim: 'fade' });
  for (const [x, z, c] of [[2, pz, MAT.ww], [28, pz, MAT.ww], [15, pz2, MAT.sw]])
    cyl(x, py - 0.3, z, 0.55, D.GL - py + 0.35, c, { stage: 'reroute', seq: 2, anim: 'rise' }, 16);
  // traffic management cones
  for (let x = -6; x < 36; x += 3) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 8), mat(0xff6a13));
    c.position.set(x, D.GL + 0.35, -4.6);
    add(c, { stage: 'reroute', seq: 0, anim: 'fade', rm: 'reroute', rmSeq: 99, temp: true });
  }

  // ------------------------------------------------------------- 4 bulk excavation
  // soil plug inside the wall, removed in 3 lifts × 5 bays
  const lifts = [[D.GL - 0.8, D.GL], [D.GL - 1.6, D.GL - 0.8], [D.FORM, D.GL - 1.6]];
  lifts.forEach(([y0, y1], li) => {
    for (let b = 0; b < 5; b++) {
      const x0 = 0.3 + b * (D.W - 0.6) / 5, x1 = 0.3 + (b + 1) * (D.W - 0.6) / 5;
      box(x0, y0, 0.3, x1, y1, D.BD - 0.3, MAT.soil, { stage: 'est', seq: -1, anim: 'none', rm: 'dig', rmSeq: li * 5 + (b % 2 ? 4 - b : b), rmAnim: 'dig', soil: true }, { roughness: 1 });
    }
  });
  // excavator + truck
  const excavator = new THREE.Group();
  { const t = new THREE.Mesh(boxGeo(3.2, 0.8, 2.6), mat(0x2b2d31)); t.position.y = 0.4;
    const b = new THREE.Mesh(boxGeo(2.6, 1.4, 2.2), mat(MAT.crane)); b.position.y = 1.5;
    const arm = new THREE.Mesh(boxGeo(5, 0.35, 0.35), mat(MAT.crane)); arm.position.set(3, 2.4, 0); arm.rotation.z = -0.35;
    [t, b, arm].forEach(p => { p.castShadow = true; excavator.add(p); }); }
  excavator.position.set(14, D.FORM, 12);
  add(excavator, { stage: 'dig', seq: 0, anim: 'fade', rm: 'drain', rmSeq: 0, temp: true });
  const truck = makeTruck(MAT.truck); truck.position.set(8, D.GL, -10); truck.rotation.y = Math.PI / 2;
  add(truck, { stage: 'dig', seq: 0, anim: 'fade', rm: 'dig', rmSeq: 99, temp: true });
  truck.userData.el.drive = true;

  function makeTruck(color) {
    const g = new THREE.Group();
    const cab = new THREE.Mesh(boxGeo(2.4, 2.6, 2.3), mat(color)); cab.position.set(3.6, 1.6, 0);
    const bed = new THREE.Mesh(boxGeo(5.4, 1.6, 2.4), mat(0x6c757d)); bed.position.set(0, 1.7, 0);
    const ch = new THREE.Mesh(boxGeo(7.6, 0.4, 2.2), mat(0x222)); ch.position.set(0.9, 0.6, 0);
    [cab, bed, ch].forEach(p => { p.castShadow = true; g.add(p); });
    return g;
  }

  // ------------------------------------------------------------- 5 capping beam & shotcrete
  const cb = [D.GL - 0.35, D.GL + 0.1];
  // front beam stops at the two ramp mouths
  box(0.3 + D.RAMP_W + 0.4, cb[0], -0.3, D.W - 0.7 - D.RAMP_W, cb[1], 0.3, MAT.insitu, { stage: 'capping', seq: 0, anim: 'rise' });
  box(D.W - 0.3, cb[0], -0.3, D.W + 0.3, cb[1], D.BD + 0.3, MAT.insitu, { stage: 'capping', seq: 1, anim: 'rise' });
  box(-0.3, cb[0], D.BD - 0.3, D.W + 0.3, cb[1], D.BD + 0.3, MAT.insitu, { stage: 'capping', seq: 2, anim: 'rise' });
  box(-0.3, cb[0], -0.3, 0.3, cb[1], D.BD + 0.3, MAT.insitu, { stage: 'capping', seq: 3, anim: 'rise' });
  // shotcrete facing on inner face (walls)
  const sh = 0.1, fy0 = D.FORM, fy1 = D.GL - 0.35;
  box(D.W - 0.3 - sh, fy0, 0.3, D.W - 0.3, fy1, D.BD - 0.3, MAT.shot, { stage: 'capping', seq: 4, anim: 'rise' });
  box(0.3, fy0, D.BD - 0.3 - sh, D.W - 0.3, fy1, D.BD - 0.3, MAT.shot, { stage: 'capping', seq: 5, anim: 'rise' });
  box(0.3, fy0, 0.3, 0.3 + sh, fy1, D.BD - 0.3, MAT.shot, { stage: 'capping', seq: 6, anim: 'rise' });
  box(0.3 + D.RAMP_W + 0.4, fy0, 0.3, D.W - 0.7 - D.RAMP_W, fy1, 0.3 + sh, MAT.shot, { stage: 'capping', seq: 7, anim: 'rise' });

  // ------------------------------------------------------------- 6 private drainage
  const dy = D.FORM - 0.25;
  for (let h = 0; h < 5; h++) {
    const x = HOUSE_W * (h + 0.5);
    pipe([x, dy, 3], [x, dy - 0.2, D.BD - 2], 0.06, MAT.ww, { stage: 'drain', seq: h });
  }
  pipe([2, dy - 0.25, D.BD - 2], [D.W - 2, dy - 0.3, D.BD - 2], 0.08, MAT.ww, { stage: 'drain', seq: 5 });
  pipe([1, dy, 1], [D.W - 1, dy, 1], 0.1, MAT.sw, { stage: 'drain', seq: 6 });
  // herringbone subsoil
  for (let x = 2; x < D.W - 1; x += 3) pipe([x, dy + 0.1, 1.2], [x + 1.5, dy + 0.1, D.BD - 1.2], 0.05, 0x2d2d2d, { stage: 'drain', seq: 7 });
  // sumps
  for (const [x, z] of [[1.5, D.BD - 1.5], [D.W - 1.5, D.BD - 1.5]]) cyl(x, D.FORM - 1.2, z, 0.6, 1.4, 0x5d6166, { stage: 'drain', seq: 8, anim: 'rise' });

  // ------------------------------------------------------------- 7 tanking, XPS, hardfill
  // Stack from formation up. Each layer is tagged so "explode" can separate them.
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
  // wall 3PG + Nuradrain on shotcrete face
  const wm = (x0, z0, x1, z1, s) => box(x0, D.FORM, z0, x1, D.GL - 0.55, z1, MAT.wallMembrane, { stage: 'tank', seq: 5 + s, anim: 'rise', layer: 5 });
  const wd = (x0, z0, x1, z1, s) => box(x0, D.FORM, z0, x1, D.GL - 0.55, z1, MAT.drainBoard, { stage: 'tank', seq: 7 + s, anim: 'rise', layer: 6 });
  const f = 0.3 + sh;
  wm(D.W - f - 0.02, f, D.W - f, D.BD - f, 0); wm(f, D.BD - f - 0.02, D.W - f, D.BD - f, 0); wm(f, f, f + 0.02, D.BD - f, 0);
  wd(D.W - f - 0.06, f, D.W - f - 0.02, D.BD - f, 0); wd(f, D.BD - f - 0.06, D.W - f, D.BD - f - 0.02, 0); wd(f + 0.02, f, f + 0.06, D.BD - f, 0);

  // ------------------------------------------------------------- 8 footings, lift pits, L0 slab
  const slabB = D.FORM + 0.31;
  for (let i = 0; i <= 5; i++) {
    const x = i * HOUSE_W, xc = Math.min(Math.max(x, 0.6), D.W - 0.6);
    box(xc - 0.35, slabB - 0.35, 0.6, xc + 0.35, slabB, D.BD - 0.6, MAT.insitu, { stage: 'slab', seq: 0, anim: 'rise' });
  }
  for (let h = 0; h < 5; h++) {
    const x = HOUSE_W * h + HOUSE_W - 1.6;
    box(x - 0.8, slabB - 1.1, 15.5, x + 0.8, D.L0, 17.1, MAT.insitu, { stage: 'slab', seq: 1, anim: 'rise' });
  }
  // 4 pour zones, grid lines across the length
  const zones = [[0.4, 7.6], [7.6, 15.1], [15.1, 22.6], [22.6, D.W - 0.4]];
  zones.forEach(([x0, x1], i) => box(x0, slabB, 0.4, x1, D.L0, D.BD - 0.4, 0xb6b3ab, { stage: 'slab', seq: 2 + i, anim: 'rise' }, { roughness: 0.55 }));
  // boom pump on the street
  const pump = makePump(); pump.position.set(15, D.GL, -5);
  add(pump, { stage: 'slab', seq: 2, anim: 'fade', rm: 'ramps', rmSeq: 99, temp: true });

  function makePump() {
    // truck on the street, boom reaching over the site
    const g = makeTruck(0xe0e3e6);
    g.rotation.y = 0;
    const pts = [[1, 3.2, 0], [1, 12, 7], [1, 9, 17], [1, 3, 20]];
    for (let k = 0; k < pts.length - 1; k++) {
      const a = new THREE.Vector3(...pts[k]), b = new THREE.Vector3(...pts[k + 1]);
      const seg = new THREE.Mesh(boxGeo(0.35, 0.35, a.distanceTo(b)), mat(k === 2 ? 0x333333 : 0xd23c2a));
      seg.position.copy(a).add(b).multiplyScalar(0.5);
      seg.lookAt(b.clone().add(g.position));
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize());
      seg.castShadow = true; g.add(seg);
    }
    return g;
  }

  // ------------------------------------------------------------- 9 incoming ducts
  const dcY = D.GL - 0.9;
  [[0x2a6fd1, 0], [0x2a6fd1, 0.25], [0x3aa0d8, 0.5], [0xe0b000, 0.75], [0x6a6a6a, 1.0]].forEach(([c, o], i) =>
    pipe([18 + o, dcY, -10], [18 + o, dcY, 0.4], 0.05, c, { stage: 'ducts', seq: i }));

  // ------------------------------------------------------------- 10 ramps & flank walls
  const ramp = (xa, xb, seq) => {
    const g = new THREE.Mesh(boxGeo(xb - xa, 0.18, Math.hypot(D.RAMP_L, D.GL - D.L0)), mat(0xa4a19a));
    g.position.set((xa + xb) / 2, (D.GL + D.L0) / 2 - 0.09, D.RAMP_L / 2);
    g.rotation.x = Math.atan2(D.GL - D.L0, D.RAMP_L);
    add(g, { stage: 'ramps', seq, anim: 'fade' });
    // flank wall on the inner side
    const inner = xa < D.W / 2 ? xb : xa - 0.2;
    box(inner, D.L0, 0.4, inner + 0.2, D.GL + 0.4, D.RAMP_L, MAT.insitu, { stage: 'ramps', seq: seq + 1, anim: 'rise' });
  };
  ramp(0.4, 0.4 + D.RAMP_W, 0);
  ramp(D.W - 0.4 - D.RAMP_W, D.W - 0.4, 2);
  // ACO channels at ramp feet
  box(0.4, D.L0, D.RAMP_L, 0.4 + D.RAMP_W, D.L0 + 0.05, D.RAMP_L + 0.3, 0x444b52, { stage: 'ramps', seq: 4 });
  box(D.W - 0.4 - D.RAMP_W, D.L0, D.RAMP_L, D.W - 0.4, D.L0 + 0.05, D.RAMP_L + 0.3, 0x444b52, { stage: 'ramps', seq: 4 });

  // ------------------------------------------------------------- props (LG, L1, L2)
  const props = (yBot, yTop, depth, stage, rm, seqBase) => {
    let k = 0;
    for (let x = 1.8; x < D.W - 1; x += 3.6) for (let z = 1.8; z < depth - 1; z += 3.7) {
      if (yBot === D.L0 && ((x < 0.4 + D.RAMP_W + 0.3 && z < D.RAMP_L) || (x > D.W - 0.7 - D.RAMP_W && z < D.RAMP_L))) continue;
      cyl(x, yBot, z, 0.05, yTop - yBot, MAT.prop, { stage, seq: seqBase + (k++ % 6) * 0.01, anim: 'rise', rm, rmSeq: k, temp: true, layer: 'prop' }, 6);
    }
  };

  // ------------------------------------------------------------- 11 undercroft walls & stairs
  const lgSoffit = D.LG - D.TOP - D.PLANK;
  for (let i = 1; i <= 4; i++) {
    const x = i * HOUSE_W;
    for (let s = 0; s < 5; s++) {
      const z0 = D.RAMP_L + 0.6 + s * (D.BD - D.RAMP_L - 1.2) / 5, z1 = z0 + (D.BD - D.RAMP_L - 1.2) / 5 - 0.05;
      box(x - 0.075, D.L0, z0, x + 0.075, lgSoffit, z1, MAT.precast, { stage: 'undercroft', seq: i * 5 + s });
    }
  }
  // plant / bin room walls
  box(12, D.L0, D.BD - 5, 12.15, lgSoffit, D.BD - 0.5, MAT.precast, { stage: 'undercroft', seq: 30 });
  box(18, D.L0, D.BD - 5, 18.15, lgSoffit, D.BD - 0.5, MAT.precast, { stage: 'undercroft', seq: 31 });
  // stairs – one per house, sloped
  for (let h = 0; h < 5; h++) {
    const x = HOUSE_W * h + 1.4, run = 4.2, rise = lgSoffit - D.L0 + 0.1;
    const st = new THREE.Mesh(boxGeo(1.1, 0.25, Math.hypot(run, rise)), mat(MAT.precast));
    st.position.set(x, D.L0 + rise / 2, 19 + run / 2);
    st.rotation.x = -Math.atan2(rise, run);
    add(st, { stage: 'undercroft', seq: 40 + h });
  }
  const crane55a = makeCrane(0.75); crane55a.position.set(15, D.L0, 10);
  add(crane55a, { stage: 'undercroft', seq: 0, anim: 'fade', rm: 'undercroft', rmSeq: 99, temp: true });

  // ------------------------------------------------------------- 12 pools
  for (let h = 0; h < 5; h++) {
    const cx = HOUSE_W * (h + 0.5);
    const pit = box(cx - 1.8, D.GL - 1.9, 29.4, cx + 1.8, D.GL - 1.6, 35.6, MAT.gravel, { stage: 'pools', seq: h * 2, anim: 'rise' });
    pit.name = 'Pool bedding';
    // shell: base + 4 walls
    const g = new THREE.Group();
    const b0 = new THREE.Mesh(boxGeo(3, 0.2, 5), mat(MAT.precast));
    b0.position.y = -1.4;
    const w1 = new THREE.Mesh(boxGeo(0.2, 1.5, 5), mat(MAT.precast)); w1.position.set(-1.4, -0.75, 0);
    const w2 = w1.clone(); w2.position.x = 1.4;
    const w3 = new THREE.Mesh(boxGeo(3, 1.5, 0.2), mat(MAT.precast)); w3.position.set(0, -0.75, -2.4);
    const w4 = w3.clone(); w4.position.z = 2.4;
    const lining = new THREE.Mesh(boxGeo(2.6, 0.02, 4.6), mat(0xe8f3f7)); lining.position.y = -1.29;
    [b0, w1, w2, w3, w4, lining].forEach(p => { p.castShadow = true; p.receiveShadow = true; g.add(p); });
    g.position.set(cx, D.GL + 0.1, 32.5);
    add(g, { stage: 'pools', seq: h * 2 + 1 });
  }
  const crane130a = makeCrane(1); crane130a.position.set(22, D.GL, -6.5);
  add(crane130a, { stage: 'pools', seq: 0, anim: 'fade', rm: 'pools', rmSeq: 99, temp: true });

  // ------------------------------------------------------------- 13 LG planks + topping
  const planks = (y, depth, stage, seqBase, skip) => {
    const cols = Math.round(D.W / 2.4), pw = D.W / cols;
    const rows = Math.max(1, Math.round(depth / 7.4)), pd = depth / rows;
    let k = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (skip && skip(c, r)) continue;
      box(c * pw + 0.02, y, r * pd + 0.02, (c + 1) * pw - 0.02, y + D.PLANK, (r + 1) * pd - 0.02, 0xc8c4ba,
        { stage, seq: seqBase + k++ });
    }
    return k;
  };
  const topping = (y, depth, stage, seq) => box(0, y, 0, D.W, y + D.TOP, depth, 0xb4b1a9, { stage, seq, anim: 'rise' }, { roughness: 0.5 });

  props(D.L0, lgSoffit, D.BD, 'lg', 'roof', 0);
  const nLG = planks(lgSoffit, D.BD, 'lg', 1);
  topping(lgSoffit + D.PLANK, D.BD, 'lg', nLG + 2);
  const crane130b = makeCrane(1); crane130b.position.set(15, D.GL, -6.5);
  add(crane130b, { stage: 'lg', seq: 0, anim: 'fade', rm: 'l2', rmSeq: 99, temp: true });
  crane130b.userData.el.slew = true;

  // ------------------------------------------------------------- 14/16 party walls
  const partyWalls = (y0, y1, depth, stage, seqOff, north) => {
    const n = 6;
    for (let i = 0; i <= 5; i++) {
      const x = Math.min(Math.max(i * HOUSE_W, 0.075), D.W - 0.075);
      for (let s = 0; s < n; s++) {
        const z0 = s * depth / n, z1 = (s + 1) * depth / n - 0.04;
        const isSandwich = north && i === 0 && s >= 0;
        box(x - 0.075, y0, z0, x + 0.075, y1, z1, isSandwich ? 0xa9b3b8 : MAT.precast, { stage, seq: seqOff + i * n + s, house: Math.min(i, 4) });
      }
    }
  };
  partyWalls(D.LG, D.L1 - D.TOP - D.PLANK, D.HD1, 'w1', 0, false);
  const crane55b = makeCrane(0.75); crane55b.position.set(15, D.LG, 11);
  add(crane55b, { stage: 'w1', seq: 0, anim: 'fade', rm: 'w2', rmSeq: 99, temp: true });
  crane55b.userData.el.slew = true;

  // ------------------------------------------------------------- 15 L1 planks, balconies, topping
  const l1S = D.L1 - D.TOP - D.PLANK;
  props(D.LG, l1S, D.HD1, 'l1', 'roof', 0);
  const nL1 = planks(l1S, D.HD1, 'l1', 1);
  topping(l1S + D.PLANK, D.HD1, 'l1', nL1 + 8);
  for (let h = 0; h < 5; h++) box(HOUSE_W * h + 0.6, D.L1 - 0.25, -1.8, HOUSE_W * (h + 1) - 0.6, D.L1, 0, MAT.precast, { stage: 'l1', seq: nL1 + 2 + h });

  partyWalls(D.L1, D.L2 - D.TOP - D.PLANK, D.HD1, 'w2', 0, true);

  // ------------------------------------------------------------- 17 L2
  const l2S = D.L2 - D.TOP - D.PLANK;
  props(D.L1, l2S, D.HD1, 'l2', 'roof', 0);
  const nL2 = planks(l2S, D.HD1, 'l2', 1);
  topping(l2S + D.PLANK, D.HD1, 'l2', nL2 + 8);
  for (let h = 0; h < 5; h++) box(HOUSE_W * h + 0.6, D.L2 - 0.25, -1.8, HOUSE_W * (h + 1) - 0.6, D.L2, 0, MAT.precast, { stage: 'l2', seq: nL2 + 2 + h });

  // ------------------------------------------------------------- 19 steel, L2 framing, roof
  for (let h = 0; h < 5; h++) {
    const x0 = HOUSE_W * h;
    for (const z of [0.3, D.HD2 - 0.3]) box(x0 + HOUSE_W / 2 - 0.1, D.L2, z - 0.1, x0 + HOUSE_W / 2 + 0.1, D.ROOF, z + 0.1, MAT.steel, { stage: 'roof', seq: h, anim: 'rise', house: h });
    box(x0 + 0.2, D.ROOF - 0.35, 0.2, x0 + HOUSE_W - 0.2, D.ROOF - 0.05, 0.45, MAT.steel, { stage: 'roof', seq: 5 + h, house: h });
  }
  // L2 timber framing (studs) front & back
  for (let h = 0; h < 5; h++) for (const z of [0.1, D.HD2 - 0.1]) {
    for (let x = HOUSE_W * h + 0.3; x < HOUSE_W * (h + 1) - 0.2; x += 0.6)
      box(x, D.L2, z - 0.045, x + 0.045, D.ROOF - 0.35, z + 0.045, MAT.timber, { stage: 'roof', seq: 10 + h, anim: 'rise', house: h });
  }
  // L2 party walls continue in timber (framed)
  for (let i = 0; i <= 5; i++) {
    const x = Math.min(Math.max(i * HOUSE_W, 0.1), D.W - 0.1);
    box(x - 0.1, D.L2, 0, x + 0.1, D.ROOF, D.HD2, 0xd5c29f, { stage: 'roof', seq: 15 + i, anim: 'rise' });
  }
  // rafters / joists
  for (let z = 0.3; z < D.HD2; z += 0.9) box(0, D.ROOF - 0.3, z, D.W, D.ROOF - 0.05, z + 0.06, MAT.timber, { stage: 'roof', seq: 22 + z / 3 });
  box(0, D.ROOF - 0.05, 0, D.W, D.ROOF, D.HD2, MAT.ply, { stage: 'roof', seq: 30 });
  // parapets
  box(0, D.ROOF, -0.05, D.W, D.ROOF + 0.6, 0.15, MAT.ply, { stage: 'roof', seq: 31, anim: 'rise' });
  box(0, D.ROOF, D.HD2 - 0.15, D.W, D.ROOF + 0.6, D.HD2 + 0.05, MAT.ply, { stage: 'roof', seq: 31, anim: 'rise' });
  const hiab = makeCrane(0.6); hiab.position.set(10, D.GL, -6.5);
  add(hiab, { stage: 'roof', seq: 0, anim: 'fade', rm: 'roof', rmSeq: 99, temp: true });

  // ------------------------------------------------------------- 20 scaffold + membrane
  const scaf = (x0, z0, x1, z1, seq) => {
    const g = new THREE.Group();
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const len = along ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const top = D.ROOF + 1.2;
    for (let s = 0; s <= len; s += 2.4) for (const off of [0, 1.1]) {
      const post = new THREE.Mesh(boxGeo(0.06, top - D.GL, 0.06), mat(MAT.scaffold, { metalness: 0.4 }));
      post.position.set(along ? Math.min(x0, x1) + s : x0 + (x0 < 1 ? -off : off), (top + D.GL) / 2, along ? z0 - off : Math.min(z0, z1) + s);
      g.add(post);
    }
    for (let y = D.GL + 2; y <= top; y += 2) for (const off of [0, 1.1]) {
      const led = new THREE.Mesh(boxGeo(along ? len : 0.05, 0.05, along ? 0.05 : len), mat(MAT.scaffold, { metalness: 0.4 }));
      led.position.set(along ? (x0 + x1) / 2 : x0 + (x0 < 1 ? -off : off), y, along ? z0 - off : (z0 + z1) / 2);
      g.add(led);
      if (off === 1.1) {
        const deck = new THREE.Mesh(boxGeo(along ? len : 1.1, 0.04, along ? 1.1 : len), mat(0x9b7b4f));
        deck.position.set(along ? (x0 + x1) / 2 : x0 + (x0 < 1 ? -0.55 : 0.55), y - 0.05, along ? z0 - 0.55 : (z0 + z1) / 2);
        g.add(deck);
      }
    }
    // containment netting
    const net = new THREE.Mesh(new THREE.PlaneGeometry(len, top - D.GL), mat(0xcfd6da, { transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    net.position.set(along ? (x0 + x1) / 2 : x0 + (x0 < 1 ? -1.15 : 1.15), (top + D.GL) / 2, along ? z0 - 1.15 : (z0 + z1) / 2);
    if (!along) net.rotation.y = Math.PI / 2;
    g.add(net);
    g.children.forEach(c => { c.castShadow = true; });
    add(g, { stage: 'membrane', seq, anim: 'rise', rm: 'strike', rmSeq: seq, temp: true });
  };
  scaf(0, -0.4, D.W, -0.4, 0);
  scaf(-0.4, 0, -0.4, D.HD1, 1);
  scaf(D.W + 0.4, 0, D.W + 0.4, D.HD1, 2);
  // protected pedestrian gantry
  box(-0.4, D.GL + 2.6, -2.6, D.W + 0.4, D.GL + 2.8, -0.2, 0x7b8a96, { stage: 'membrane', seq: 0, anim: 'fade', rm: 'strike', rmSeq: 3, temp: true });
  // goods hoist
  box(14.6, D.GL, -2.2, 15.8, D.ROOF + 1.5, -1.2, 0xd5d9dc, { stage: 'membrane', seq: 1, anim: 'rise', rm: 'strike', rmSeq: 2, temp: true }, { transparent: true, opacity: 0.6 });
  // membrane roof
  box(0.1, D.ROOF, 0.15, D.W - 0.1, D.ROOF + 0.04, D.HD2 - 0.15, MAT.roofMem, { stage: 'membrane', seq: 4, anim: 'fade' }, { roughness: 0.6 });
  box(0.1, D.L2, D.HD2, D.W - 0.1, D.L2 + 0.03, D.HD1, MAT.roofMem, { stage: 'membrane', seq: 5, anim: 'fade' }, { roughness: 0.6 });
  box(-0.05, D.ROOF + 0.6, -0.1, D.W + 0.05, D.ROOF + 0.66, 0.2, 0x8a9096, { stage: 'membrane', seq: 6 });
  box(-0.05, D.ROOF + 0.6, D.HD2 - 0.2, D.W + 0.05, D.ROOF + 0.66, D.HD2 + 0.1, 0x8a9096, { stage: 'membrane', seq: 6 });

  // ------------------------------------------------------------- 21 joinery
  const glassM = { transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.3 };
  const joinery = (h, y0, y1, z, seq) => {
    const x0 = HOUSE_W * h + 0.5, x1 = HOUSE_W * (h + 1) - 0.5;
    const g = new THREE.Group();
    const gl = new THREE.Mesh(boxGeo(x1 - x0, y1 - y0, 0.03), mat(MAT.glass, glassM)); gl.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
    g.add(gl);
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 3) {
      const mull = new THREE.Mesh(boxGeo(0.06, y1 - y0, 0.08), mat(0x2e3236)); mull.position.set(x, (y0 + y1) / 2, z); g.add(mull);
    }
    for (const y of [y0, y1]) { const tr = new THREE.Mesh(boxGeo(x1 - x0, 0.06, 0.08), mat(0x2e3236)); tr.position.set((x0 + x1) / 2, y, z); g.add(tr); }
    add(g, { stage: 'joinery', seq, anim: 'fade', house: h });
  };
  for (let h = 0; h < 5; h++) {
    joinery(h, D.LG + 0.05, D.L1 - 0.45, 0.02, h);
    joinery(h, D.L1 + 0.05, D.L2 - 0.45, 0.02, h + 5);
    joinery(h, D.L2 + 0.05, D.ROOF - 0.4, 0.2, h + 10);
    joinery(h, D.LG + 0.05, D.L1 - 0.45, D.HD1 - 0.02, h + 15);
    joinery(h, D.L1 + 0.05, D.L2 - 0.45, D.HD1 - 0.02, h + 20);
    joinery(h, D.L2 + 0.05, D.ROOF - 0.4, D.HD2 - 0.2, h + 25);
  }

  // ------------------------------------------------------------- 22 facade
  for (let h = 0; h < 5; h++) {
    const x0 = HOUSE_W * h, x1 = x0 + HOUSE_W;
    // render bands at slab edges (front and back)
    for (const [y0, y1] of [[D.L1 - 0.45, D.L1 + 0.05], [D.L2 - 0.45, D.L2 + 0.05]]) {
      box(x0, y0, -0.1, x1, y1, 0.02, MAT.render, { stage: 'facade', seq: h, house: h, anim: 'fade' });
      box(x0, y0, D.HD1 - 0.02, x1, y1, D.HD1 + 0.1, MAT.render, { stage: 'facade', seq: h, house: h, anim: 'fade' });
    }
    // GRC feature fins at party lines (front)
    box(x0 + 0.05, D.LG, -0.35, x0 + 0.5, D.L2 + 0.05, 0.02, MAT.grc, { stage: 'facade', seq: 5 + h, house: h, anim: 'rise' });
    // Nu-Wall to L2 front/back spandrels
    box(x0, D.ROOF - 0.4, 0.1, x1, D.ROOF + 0.6, 0.2, MAT.nuwall, { stage: 'facade', seq: 10 + h, house: h, anim: 'fade' });
    box(x0, D.ROOF - 0.4, D.HD2 - 0.2, x1, D.ROOF + 0.6, D.HD2 - 0.1, MAT.nuwall, { stage: 'facade', seq: 10 + h, house: h, anim: 'fade' });
    // LG plinth render
    box(x0, D.GL, -0.1, x1, D.LG + 0.05, 0.02, MAT.render, { stage: 'facade', seq: h, house: h, anim: 'fade' });
  }
  // end wall render
  box(-0.12, D.LG, 0, 0, D.ROOF + 0.6, D.HD1, MAT.render, { stage: 'facade', seq: 15, anim: 'fade' });
  box(D.W, D.LG, 0, D.W + 0.12, D.ROOF + 0.6, D.HD1, MAT.render, { stage: 'facade', seq: 16, anim: 'fade' });
  // Abodo soffits under balconies
  for (let h = 0; h < 5; h++) for (const y of [D.L1 - 0.28, D.L2 - 0.28])
    box(HOUSE_W * h + 0.6, y, -1.8, HOUSE_W * (h + 1) - 0.6, y + 0.03, 0, 0x9c6b3f, { stage: 'facade', seq: 17 + h, house: h, anim: 'fade' });

  // ------------------------------------------------------------- 23 carpark doors & balustrades
  for (const xa of [0.4, D.W - 0.4 - D.RAMP_W]) box(xa, D.L0 + 0.8, D.RAMP_L - 0.1, xa + D.RAMP_W, D.GL + 0.4, D.RAMP_L, MAT.door, { stage: 'doors', seq: 0, anim: 'rise' }, { metalness: 0.5 });
  for (let h = 0; h < 5; h++) for (const y of [D.L1, D.L2])
    box(HOUSE_W * h + 0.6, y, -1.85, HOUSE_W * (h + 1) - 0.6, y + 1.05, -1.78, MAT.balustrade, { stage: 'doors', seq: 1 + h, house: h, anim: 'rise' }, { transparent: true, opacity: 0.4 });

  // ------------------------------------------------------------- 24 services & lifts (house flow-line)
  for (let h = 0; h < 5; h++) {
    const x = HOUSE_W * h + HOUSE_W - 1.6;
    box(x - 0.6, D.L0, 15.7, x + 0.6, D.ROOF - 0.4, 16.95, MAT.lift, { stage: 'services', seq: h * 3 + 2, house: h, anim: 'rise' }, { transparent: true, opacity: 0.7, metalness: 0.4 });
    // HVAC duct runs each level
    for (const y of [D.L1 - 0.6, D.L2 - 0.6, D.ROOF - 0.7])
      box(HOUSE_W * h + 0.8, y, 3, HOUSE_W * h + 1.2, y + 0.3, D.HD2 - 2, MAT.duct2, { stage: 'services', seq: h * 3, house: h, anim: 'fade' });
    // plumbing stack
    cyl(HOUSE_W * h + 2.2, D.L0, 12, 0.08, D.ROOF - D.L0, MAT.ww, { stage: 'services', seq: h * 3 + 1, house: h, anim: 'rise' }, 8);
    // HWCs in basement
    for (const dx of [0, 0.8]) cyl(HOUSE_W * h + 3 + dx, D.L0, 22.5, 0.33, 1.8, 0xe8e8e8, { stage: 'services', seq: h * 3 + 1, house: h, anim: 'rise' }, 14);
  }
  // carpark extract fans
  box(6, lgSoffit - 0.5, 20, 24, lgSoffit - 0.1, 20.5, 0x9aa4ad, { stage: 'services', seq: 16, anim: 'fade' });

  // ------------------------------------------------------------- 25 fitout (house flow-line)
  for (let h = 0; h < 5; h++) {
    const x0 = HOUSE_W * h + 0.2, x1 = HOUSE_W * (h + 1) - 0.2;
    for (const [y, depth] of [[D.LG, D.HD1], [D.L1, D.HD1], [D.L2, D.HD2]]) {
      const top = y === D.L2 ? D.ROOF - 0.35 : y + 3.23 - 0.5;
      // internal partitions
      box(x0, y, depth * 0.45, x1 - 1.4, top, depth * 0.45 + 0.1, MAT.fit, { stage: 'fitout', seq: h * 4, house: h, anim: 'rise' });
      box(x0 + 2.2, y, depth * 0.45, x0 + 2.3, top, depth - 0.4, MAT.fit, { stage: 'fitout', seq: h * 4, house: h, anim: 'rise' });
      // oak floor
      box(x0, y + 0.001, 0.2, x1, y + 0.03, depth - 0.2, 0xb88a57, { stage: 'fitout', seq: h * 4 + 3, house: h, anim: 'fade' });
      // kitchen / joinery block
      box(x0 + 0.3, y, depth * 0.62, x0 + 1.9, y + 0.9, depth * 0.62 + 3, 0x3c3f44, { stage: 'fitout', seq: h * 4 + 2, house: h });
    }
  }

  // ------------------------------------------------------------- 27–31 external works
  // Per-house scope from the Lindsay Building Estimate Rev A (terraces, 20-series block,
  // Vitex deck, outdoor tiles, outdoor kitchen, spiral stair, pavers, gates, soft landscape)
  // plus the F9 pool barrier. Garden layout per house (z from the street):
  //   LG terrace 22.2–25.5 · steps / lawn 25.7–28.4 · pool surround 28.4–36.8 · deck 36.9–39.2 · garden 39.3–45.2
  const EX = {
    slab: 0xcfccc4, block: 0xc7c1b4, coping: 0xebe6db, tile: 0xd9d3c7, deck: 0x8c7660, soil: 0x4e3b2a,
    pebble: 0xbab6ad, nuwall: 0x3f454b, alu: 0x9aa1a8, shrub: 0x5d8a45, fill: 0xa39c90,
  };
  const slatTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 8; const g = c.getContext('2d');
    g.fillStyle = '#6e5a46'; g.fillRect(0, 0, 64, 8);
    for (let i = 0; i < 4; i++) { g.fillStyle = '#9c8166'; g.fillRect(i * 16, 0, 12, 8); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const slatFence = (x0, z0, x1, z1, h, o) => {
    const len = Math.hypot(x1 - x0, z1 - z0), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const t = slatTex.clone(); t.needsUpdate = true; t.repeat.set(len / 0.36, 1);
    const m = new THREE.Mesh(boxGeo(alongX ? len : 0.04, h, alongX ? 0.04 : len), mat(0xffffff, { map: t, roughness: 0.9 }));
    m.position.set((x0 + x1) / 2, D.GL + h / 2, (z0 + z1) / 2);
    if (!alongX) m.material.map.rotation = 0;
    return add(m, o);
  };
  const glassPanel = (x0, z0, x1, z1, o) => {
    const g = new THREE.Group();
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = alongX ? x1 - x0 : z1 - z0;
    const pane = new THREE.Mesh(boxGeo(alongX ? len : 0.012, 1.2, alongX ? 0.012 : len), mat(MAT.balustrade, { transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2 }));
    pane.position.set((x0 + x1) / 2, D.GL + 0.15 + 0.1 + 0.6, (z0 + z1) / 2); g.add(pane);
    for (let s2 = 0.2; s2 < len; s2 += 0.9) {
      const sp = new THREE.Mesh(boxGeo(0.05, 0.28, 0.05), mat(0x3a3f44, { metalness: 0.7, roughness: 0.3 }));
      sp.position.set(alongX ? x0 + s2 : x0, D.GL + 0.15 + 0.14, alongX ? z0 : z0 + s2); g.add(sp);
    }
    return add(g, o);
  };

  for (let h = 0; h < 5; h++) {
    const x0 = HOUSE_W * h, x1 = x0 + HOUSE_W, cx = x0 + HOUSE_W / 2;
    const stepX0 = x0 + 0.5, stepX1 = x0 + 1.7;

    // --- Externals 1: fill, block walls, concrete terraces & pool surround slabs
    // AP40 fill either side of the pool surround (the surround slab covers the middle)
    box(x0 + 0.05, D.GL - 0.06, 25.7, x1 - 0.05, D.GL + 0.02, 28.4, EX.fill, { stage: 'extslab', seq: h * 0.01, anim: 'rise', house: h }, { roughness: 1 });
    box(x0 + 0.05, D.GL - 0.06, 36.8, x1 - 0.05, D.GL + 0.02, D.SITE_D - 0.05, EX.fill, { stage: 'extslab', seq: h * 0.01, anim: 'rise', house: h }, { roughness: 1 });
    box(x0 + 0.05, D.LG - 0.14, D.HD1, x1 - 0.05, D.LG, D.BD, EX.slab, { stage: 'extslab', seq: 2 + h * 0.01, anim: 'rise', house: h }, { roughness: 0.8 });
    // retaining / courtyard block wall along the terrace edge, gap for steps
    box(x0 + 0.05, D.GL - 0.1, D.BD, stepX0, D.LG + 0.35, D.BD + 0.2, EX.block, { stage: 'extslab', seq: 1 + h * 0.01, anim: 'rise', house: h });
    box(stepX1, D.GL - 0.1, D.BD, x1 - 0.05, D.LG + 0.35, D.BD + 0.2, EX.block, { stage: 'extslab', seq: 1 + h * 0.01, anim: 'rise', house: h });
    // low block walls to the sides of each courtyard (between houses)
    if (h > 0) box(x0 - 0.1, D.LG, D.HD1, x0 + 0.1, D.LG + 1.1, D.BD, EX.block, { stage: 'extslab', seq: 1.5, anim: 'rise', house: h });
    // steps down from the terrace to the garden
    const nSteps = 4, rise = (D.LG - D.GL) / nSteps;
    for (let k = 0; k < nSteps; k++)
      box(stepX0, D.GL - 0.05, D.BD + 0.2 + k * 0.3, stepX1, D.LG - (k + 1) * rise + rise, D.BD + 0.5 + k * 0.3, EX.slab, { stage: 'extslab', seq: 2.5 + h * 0.01, anim: 'rise', house: h });
    // pool surround slab (4 strips around the pool opening)
    const px0 = cx - 1.5, px1 = cx + 1.5, pz0 = 30, pz1 = 35, sx0 = x0 + 0.3, sx1 = x1 - 0.3, sz0 = 28.4, sz1 = 36.8, sy0 = D.GL, sy1 = D.GL + 0.15;
    for (const [a1, b1, c1, d1] of [[sx0, sz0, sx1, pz0], [sx0, pz1, sx1, sz1], [sx0, pz0, px0, pz1], [px1, pz0, sx1, pz1]])
      box(a1, sy0, b1, c1, sy1, d1, EX.slab, { stage: 'extslab', seq: 3 + h * 0.01, anim: 'rise', house: h }, { roughness: 0.8 });

    // --- Externals 2: pool plant, coping, outdoor tiles, pool fence, fill
    const cp = 0.3;
    for (const [a1, b1, c1, d1] of [[px0 - cp, pz0 - cp, px1 + cp, pz0], [px0 - cp, pz1, px1 + cp, pz1 + cp], [px0 - cp, pz0, px0, pz1], [px1, pz0, px1 + cp, pz1]])
      box(a1, sy1, b1, c1, sy1 + 0.06, d1, EX.coping, { stage: 'extpool', seq: 1 + h * 0.01, house: h }, { roughness: 0.5 });
    // outdoor porcelain to the pool surround and the LG terrace
    for (const [a1, b1, c1, d1] of [[sx0, sz0, sx1, pz0 - cp], [sx0, pz1 + cp, sx1, sz1], [sx0, pz0 - cp, px0 - cp, pz1 + cp], [px1 + cp, pz0 - cp, sx1, pz1 + cp]])
      box(a1, sy1, b1, c1, sy1 + 0.02, d1, EX.tile, { stage: 'extpool', seq: 2 + h * 0.01, anim: 'fade', house: h }, { roughness: 0.45 });
    box(x0 + 0.1, D.LG, D.HD1 + 0.05, x1 - 0.1, D.LG + 0.02, D.BD - 0.02, EX.tile, { stage: 'extpool', seq: 2 + h * 0.01, anim: 'fade', house: h }, { roughness: 0.45 });
    // pool plant enclosure (behind the deck)
    const plant = new THREE.Group();
    { const enc = new THREE.Mesh(boxGeo(1.2, 1.0, 0.9), mat(EX.nuwall, { metalness: 0.4 })); enc.position.set(x0 + 1.0, D.GL + 0.5, 39.95);
      const hp = new THREE.Mesh(boxGeo(0.9, 0.7, 0.35), mat(0xe4e6e8)); hp.position.set(x0 + 2.3, D.GL + 0.35, 40.1);
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 18), mat(0x333333)); fan.rotation.x = Math.PI / 2; fan.position.set(x0 + 2.3, D.GL + 0.38, 39.92);
      plant.add(enc, hp, fan); }
    add(plant, { stage: 'extpool', seq: 0 + h * 0.01, house: h });
    // frameless glass pool barrier with a self-closing gate on the path side
    const fx0 = x0 + 0.45, fx1 = x1 - 0.45, fz0 = 28.6, fz1 = 36.6, gate0 = stepX0 + 0.1, gate1 = stepX0 + 1.1;
    glassPanel(fx0, fz0, gate0, fz0, { stage: 'extpool', seq: 3 + h * 0.01, anim: 'rise', house: h });
    glassPanel(gate1, fz0, fx1, fz0, { stage: 'extpool', seq: 3 + h * 0.01, anim: 'rise', house: h });
    glassPanel(fx0, fz1, fx1, fz1, { stage: 'extpool', seq: 3 + h * 0.01, anim: 'rise', house: h });
    glassPanel(fx0, fz0, fx0, fz1, { stage: 'extpool', seq: 3 + h * 0.01, anim: 'rise', house: h });
    glassPanel(fx1, fz0, fx1, fz1, { stage: 'extpool', seq: 3 + h * 0.01, anim: 'rise', house: h });
    const pg = new THREE.Group();
    { const leaf = new THREE.Mesh(boxGeo(1.0, 1.2, 0.014), mat(MAT.balustrade, { transparent: true, opacity: 0.35, roughness: 0.05 }));
      leaf.position.set((gate0 + gate1) / 2, D.GL + 0.85, fz0);
      const hinge = new THREE.Mesh(boxGeo(0.06, 0.18, 0.06), mat(0x222222, { metalness: 0.8 })); hinge.position.set(gate0 + 0.05, D.GL + 1.1, fz0);
      const latch = new THREE.Mesh(boxGeo(0.06, 0.12, 0.08), mat(0x222222, { metalness: 0.8 })); latch.position.set(gate1 - 0.05, D.GL + 1.5, fz0);
      pg.add(leaf, hinge, latch); }
    add(pg, { stage: 'extpool', seq: 3.5 + h * 0.01, anim: 'fade', house: h });
    // fill the pool only once the barrier is complete
    const water = box(px0 + 0.2, D.GL - 1.1, pz0 + 0.2, px1 - 0.2, D.GL - 0.02, pz1 - 0.2, MAT.water, { stage: 'extpool', seq: 5 + h * 0.01, anim: 'rise', house: h }, { transparent: true, opacity: 0.78, roughness: 0.08 });
    water.name = 'Pool fill';

    // --- Externals 3: deck, outdoor kitchen, spiral stair, fences, pavers
    const deck = new THREE.Group();
    { const frame = new THREE.Mesh(boxGeo(HOUSE_W - 0.8, 0.14, 2.3), mat(0x6b5a48)); frame.position.set(cx, D.GL + 0.08, 38.05); deck.add(frame);
      for (let z = 36.95; z < 39.15; z += 0.16) { const b2 = new THREE.Mesh(boxGeo(HOUSE_W - 0.8, 0.02, 0.14), mat(EX.deck, { roughness: 0.85 })); b2.position.set(cx, D.GL + 0.16, z + 0.07); deck.add(b2); } }
    add(deck, { stage: 'extdeck', seq: 0 + h * 0.01, anim: 'rise', house: h });
    // outdoor kitchen on the LG terrace
    const ok = new THREE.Group();
    { const cab = new THREE.Mesh(boxGeo(2.3, 0.88, 0.62), mat(0x3d4146, { roughness: 0.6 })); cab.position.set(x0 + 1.5, D.LG + 0.44, D.BD - 0.45);
      const top = new THREE.Mesh(boxGeo(2.36, 0.03, 0.66), mat(0xeeeae3, { roughness: 0.25 })); top.position.set(x0 + 1.5, D.LG + 0.9, D.BD - 0.45);
      const bbq = new THREE.Mesh(boxGeo(0.8, 0.12, 0.5), mat(0x9aa1a8, { metalness: 0.8, roughness: 0.3 })); bbq.position.set(x0 + 1.0, D.LG + 0.98, D.BD - 0.45);
      ok.add(cab, top, bbq); }
    add(ok, { stage: 'extdeck', seq: 1 + h * 0.01, house: h });
    // external spiral stair, LG terrace → L2 roof terrace (By Owner)
    const sp = new THREE.Group();
    { const sx = x1 - 1.1, sz = D.HD1 + 1.2, rise2 = D.L2 - D.LG, n = 30;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, rise2 + 1.1, 10), mat(0x2d3034, { metalness: 0.6 })); pole.position.set(sx, D.LG + (rise2 + 1.1) / 2, sz); sp.add(pole);
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2 * 1.75;
        const tr = new THREE.Mesh(boxGeo(0.85, 0.04, 0.26), mat(0x3a3e42, { metalness: 0.5, roughness: 0.4 }));
        tr.position.set(sx + Math.cos(a) * 0.45, D.LG + (k + 1) * rise2 / n, sz + Math.sin(a) * 0.45); tr.rotation.y = -a;
        sp.add(tr);
        const post = new THREE.Mesh(boxGeo(0.02, 1.0, 0.02), mat(0x2d3034)); post.position.set(sx + Math.cos(a) * 0.88, D.LG + (k + 1) * rise2 / n + 0.5, sz + Math.sin(a) * 0.88); sp.add(post);
      } }
    add(sp, { stage: 'extdeck', seq: 2 + h * 0.01, anim: 'rise', house: h });
    // paver path from the steps to the pool gate
    for (let k = 0; k < 3; k++) box(stepX0 + 0.1, D.GL + 0.02, 26.6 + k * 0.6, stepX0 + 1.0, D.GL + 0.07, 27.1 + k * 0.6, 0xa9a39a, { stage: 'extdeck', seq: 3 + h * 0.01, anim: 'drop', house: h });
    // privacy fence between gardens (and boundary fences on the outside houses)
    if (h > 0) slatFence(x0, D.BD + 0.2, x0, D.SITE_D, 1.8, { stage: 'extdeck', seq: 4 + h * 0.01, anim: 'rise', house: h });
    // storage & bin enclosure (Nu-Wall, aluminium door) – one per house
    const bin = new THREE.Group();
    { const b2 = new THREE.Mesh(boxGeo(1.4, 2.1, 1.5), mat(EX.nuwall, { metalness: 0.4, roughness: 0.5 })); b2.position.set(x1 - 1.0, D.GL + 1.05, D.SITE_D - 0.9);
      const d2 = new THREE.Mesh(boxGeo(0.9, 1.95, 0.03), mat(EX.alu, { metalness: 0.7, roughness: 0.35 })); d2.position.set(x1 - 1.0, D.GL + 0.98, D.SITE_D - 1.66);
      bin.add(b2, d2); }
    add(bin, { stage: 'extfront', seq: 6 + h * 0.01, house: h });

    // --- Externals 5: soft landscaping & lighting
    box(stepX1 + 0.1, D.GL + 0.02, D.BD + 0.2, x1 - 0.1, D.GL + 0.09, 28.35, MAT.grass, { stage: 'soft', seq: 0 + h * 0.01, anim: 'fade', house: h });
    box(x0 + 0.1, D.GL + 0.02, 39.3, x1 - 0.1, D.GL + 0.09, D.SITE_D - 0.1, MAT.grass, { stage: 'soft', seq: 0 + h * 0.01, anim: 'fade', house: h });
    // planting bed along the fence with shrubs
    box(x0 + 0.1, D.GL + 0.02, 40.6, x0 + 0.8, D.GL + 0.12, D.SITE_D - 1.8, EX.soil, { stage: 'soft', seq: 1 + h * 0.01, anim: 'fade', house: h });
    for (let z = 41.1; z < D.SITE_D - 2; z += 0.9) {
      const sh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), mat(EX.shrub, { flatShading: true }));
      sh.position.set(x0 + 0.45, D.GL + 0.4, z); add(sh, { stage: 'soft', seq: 2 + h * 0.01, anim: 'grow', house: h });
    }
    // pebble strip at the foot of the terrace wall
    box(stepX1 + 0.1, D.GL + 0.02, D.BD + 0.2, x1 - 0.1, D.GL + 0.1, D.BD + 0.55, EX.pebble, { stage: 'soft', seq: 1 + h * 0.01, anim: 'fade', house: h }, { roughness: 1 });
    // garden lighting bollards
    for (const [bx, bz] of [[stepX1 + 0.3, 27.8], [x1 - 0.6, 39.6]]) {
      const bl = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 10), mat(0x2d3034, { metalness: 0.5 })); post.position.set(bx, D.GL + 0.35, bz);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.08, 10), mat(0xfff1c9, { emissive: 0xffd98a, emissiveIntensity: 0.8 })); lamp.position.set(bx, D.GL + 0.66, bz);
      bl.add(post, lamp); add(bl, { stage: 'soft', seq: 3 + h * 0.01, anim: 'rise', house: h });
    }
  }
  // boundary fences: north & south sides of the gardens and the rear boundary
  slatFence(0.02, D.HD1, 0.02, D.SITE_D, 1.8, { stage: 'extdeck', seq: 4, anim: 'rise' });
  slatFence(D.W - 0.02, D.HD1, D.W - 0.02, D.SITE_D, 1.8, { stage: 'extdeck', seq: 4, anim: 'rise' });
  slatFence(0, D.SITE_D - 0.02, D.W, D.SITE_D - 0.02, 1.8, { stage: 'extdeck', seq: 4.5, anim: 'rise' });
  // garden trees
  for (const [x, z] of [[4.2, 42.5], [9.3, 43], [16.1, 42.2], [21.8, 43], [27.4, 42.4]]) {
    const t = tree(root, x, D.GL, z, 0.9); root.remove(t);
    add(t, { stage: 'soft', seq: 4, anim: 'grow' });
  }

  // --- Externals 4: frontage
  // exposed-aggregate crossings & driveway aprons
  box(0.4, D.GL, -2.6, 0.4 + D.RAMP_W, D.GL + 0.045, 0.4, MAT.aggregate, { stage: 'extfront', seq: 0, anim: 'fade' }, { roughness: 0.95 });
  box(D.W - 0.4 - D.RAMP_W, D.GL, -2.6, D.W - 0.4, D.GL + 0.045, 0.4, MAT.aggregate, { stage: 'extfront', seq: 0, anim: 'fade' }, { roughness: 0.95 });
  // footpath reinstated to AT standard
  box(0.4 + D.RAMP_W, D.GL, -2.55, D.W - 0.4 - D.RAMP_W, D.GL + 0.035, -0.35, 0xc9c6bd, { stage: 'extfront', seq: 1, anim: 'fade' });
  // permanent flood barriers at both ramp mouths
  for (const xa of [0.4, D.W - 0.4 - D.RAMP_W]) {
    box(xa, D.GL, 0.45, xa + D.RAMP_W, D.GL + 0.18, 0.75, 0x55595e, { stage: 'extfront', seq: 2, anim: 'rise' }, { metalness: 0.5 });
    for (const px of [xa - 0.12, xa + D.RAMP_W + 0.02]) box(px, D.GL, 0.4, px + 0.1, D.GL + 1.2, 0.8, 0x3a3e42, { stage: 'extfront', seq: 2, anim: 'rise' }, { metalness: 0.6 });
  }
  // vehicle gates with number-plate recognition
  for (const xa of [0.4, D.W - 0.4 - D.RAMP_W]) {
    box(xa, D.GL, -0.35, xa + D.RAMP_W, D.GL + 1.6, -0.3, 0x2a2d31, { stage: 'extfront', seq: 3, anim: 'rise' }, { metalness: 0.6 });
    box(xa - 0.35, D.GL, -0.9, xa - 0.2, D.GL + 1.3, -0.75, 0x2a2d31, { stage: 'extfront', seq: 3, anim: 'rise' }, { metalness: 0.6 }); // NPR camera post
  }
  // front wall with a pedestrian gate and letterbox per house
  const gates = [[4.5, 5.5], [HOUSE_W * 1.5 - 0.5, HOUSE_W * 1.5 + 0.5], [HOUSE_W * 2.5 - 0.5, HOUSE_W * 2.5 + 0.5], [HOUSE_W * 3.5 - 0.5, HOUSE_W * 3.5 + 0.5], [D.W - 5.5, D.W - 4.5]];
  let wx = 0.4 + D.RAMP_W + 0.1;
  for (const [g0, g1] of gates) {
    box(wx, D.GL, -0.3, g0, D.GL + 1.1, -0.1, EX.block, { stage: 'extfront', seq: 4, anim: 'rise' });
    box(g0 + 0.02, D.GL + 0.05, -0.24, g1 - 0.02, D.GL + 1.05, -0.2, 0x2a2d31, { stage: 'extfront', seq: 5, anim: 'fade' }, { metalness: 0.6 });
    box(g1 + 0.1, D.GL + 0.75, -0.42, g1 + 0.45, D.GL + 1.05, -0.3, 0x2a2d31, { stage: 'extfront', seq: 5, anim: 'fade' }, { metalness: 0.5 }); // letterbox
    wx = g1;
  }
  box(wx, D.GL, -0.3, D.W - 0.5 - D.RAMP_W, D.GL + 1.1, -0.1, EX.block, { stage: 'extfront', seq: 4, anim: 'rise' });
  // new on-street carpark markings
  // drive-in bays resurfaced and re-marked across the frontage (the new on-street carpark)
  box(-1.5, D.GL + 0.001, -8.0, D.W + 1.5, D.GL + 0.012, -3.05, 0x3f4247, { stage: 'extfront', seq: 7, anim: 'fade' }, { roughness: 0.95 });
  for (let x = -1.5; x <= D.W + 1.6; x += 2.5) box(x, D.GL + 0.012, -8.0, x + 0.12, D.GL + 0.02, -3.2, 0xf2f2ee, { stage: 'extfront', seq: 7.5, anim: 'fade' });
  // street trees in the berm
  for (let x = 6; x < 24; x += 3) {
    const t = tree(root, x, D.GL, -1.5, 0.45); root.remove(t);
    add(t, { stage: 'soft', seq: 5, anim: 'grow' });
  }

  // ------------------------------------------------------------- 28 PC – house number plates
  for (let h = 0; h < 5; h++) {
    const l = makeLabel(`House ${h + 1}`, 1.1);
    l.position.set(HOUSE_W * (h + 0.5), D.ROOF + 2.2, D.HD2 / 2);
    add(l, { stage: 'pc', seq: h, anim: 'fade' });
    l.castShadow = false;
  }

  // ------------------------------------------------------------- helpers
  function makeCrane(s) {
    const g = new THREE.Group();
    const carrier = new THREE.Mesh(boxGeo(10 * s, 1.6 * s, 2.8 * s), mat(MAT.crane)); carrier.position.y = 1.4 * s;
    const cab = new THREE.Mesh(boxGeo(2 * s, 1.6 * s, 2.4 * s), mat(0x2d3136)); cab.position.set(3.8 * s, 2.9 * s, 0);
    const slew = new THREE.Group(); slew.position.y = 2.4 * s;
    const house = new THREE.Mesh(boxGeo(3.4 * s, 1.6 * s, 2.4 * s), mat(MAT.crane)); house.position.set(-1 * s, 0.8 * s, 0);
    const boomLen = 26 * s;
    const boom = new THREE.Mesh(boxGeo(0.6 * s, 0.6 * s, boomLen), mat(MAT.crane));
    boom.geometry = boom.geometry.clone(); boom.geometry.translate(0, 0, boomLen / 2);
    boom.position.set(0, 1.4 * s, 0); boom.rotation.x = -0.9;
    const hook = new THREE.Mesh(boxGeo(0.05, 8 * s, 0.05), mat(0x222)); hook.position.set(0, 1.4 * s + Math.sin(0.9) * boomLen - 4 * s, Math.cos(0.9) * boomLen);
    slew.add(house, boom, hook);
    // outriggers
    for (const [x, z] of [[-4, 2.6], [-4, -2.6], [3, 2.6], [3, -2.6]]) {
      const o = new THREE.Mesh(boxGeo(0.5 * s, 1.4 * s, 0.5 * s), mat(0x2d3136)); o.position.set(x * s, 0.7 * s, z * s); g.add(o);
    }
    [carrier, cab].forEach(p => g.add(p)); g.add(slew);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    g.userData.slewGroup = slew;
    slew.rotation.y = Math.PI * 0.5;
    return g;
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
