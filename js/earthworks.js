// Bulk excavation as a real, continuously re-cut ground surface.
// The basement plug is dug top-down in three lifts from the two ramp mouths inwards, with
// 1:1 batters between lifts, so at any moment you see benches, faces and the formation
// opening up behind the secant wall. The ground is coloured by depth like the Auckland
// profile at Goldie St: fill / topsoil, weathered orange-brown clay, mottled clay, then grey
// East Coast Bays siltstone at formation. Two excavators work the faces and load tippers.

import * as THREE from 'three';
import * as MX from './machines.js';

// deterministic value noise
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.3 + 7, z * 2.3 + 3) * 0.3 + vnoise(x * 5.1 + 1, z * 5.1 + 9) * 0.15;
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };

export function buildEarthworks({ D, add }) {
  const X0 = 0.3, X1 = D.W - 0.3, Z0 = 0.3, Z1 = D.BD - 0.3;
  const STEP = 0.25;
  const nx = Math.round((X1 - X0) / STEP), nz = Math.round((Z1 - Z0) / STEP);
  const FLOOR = D.FORM - 0.03;
  const TOP = D.GL + 0.3;                             // the GAP65 piling platform is dug out with the first lift
  const lifts = [[TOP, D.GL - 0.8], [D.GL - 0.8, D.GL - 1.6], [D.GL - 1.6, FLOOR]];
  const windows = [[0, 0.56], [0.22, 0.78], [0.44, 1]];
  const HALF = (X1 - X0) / 2;
  const SKEW = 0.2;                                   // the faces lead along the front, where the ramps are
  const REACH = HALF + SKEW * (Z1 - Z0) + 3;
  const SUMP = [X0 + 6, Z0 + 2.2];                   // dewatering sump: front, north end, where formation is reached first

  // geometry: a grid in model space with metre UVs
  const geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, nx, nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
  const col = new Float32Array(pos.count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // static per-vertex noise
  const N1 = new Float32Array(pos.count), N2 = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); N1[i] = fbm(x * 0.35, z * 0.35); N2[i] = fbm(x * 1.7 + 40, z * 1.7 + 11); }

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, vertexColors: true });
  mat.userData.surf = 'clay';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'Bulk excavation';

  // the dig front distance for a point, measured in from the nearer ramp mouth
  const dist = (x, z) => Math.min(x - X0, X1 - x) + SKEW * Math.max(0, z - 11);
  const fronts = p => windows.map(([a, b]) => smooth((p - a) / (b - a)) * REACH);
  function height(x, z, F, n1 = fbm(x * 0.35, z * 0.35)) {
    const d = dist(x, z);
    let y = lifts[0][0];
    lifts.forEach(([top, bot], k) => {
      const th = top - bot, bw = th * 1.1 + 0.25;
      const r = clamp01((F[k] - d + (n1 - 0.5) * 1.2) / bw);
      y -= th * r;
      if (k === 2) { const ds = Math.hypot(x - SUMP[0], z - SUMP[1]); if (ds < 1.6) y -= 0.5 * r * smooth((1.6 - ds) / 1.1); }
    });
    return y;
  }

  // strata colours (linear), blended by depth below existing ground
  const C = {
    fill: new THREE.Color(0x6e5a48), clay: new THREE.Color(0xb27a45), mottle: new THREE.Color(0xa69472),
    rock: new THREE.Color(0x8f8f88), wet: new THREE.Color(0x5d5850), gravel: new THREE.Color(0x9c978c),
  };
  const tmp = new THREE.Color();
  function shade(i, y, slope, x, z) {
    const dep = D.GL - y, n = N2[i];
    if (dep < 0.02) tmp.copy(C.gravel).multiplyScalar(0.95 + 0.1 * n);              // GAP65 piling platform
    else if (dep < 0.3) tmp.copy(C.fill).lerp(C.clay, smooth((dep - 0.12) / 0.2));
    else if (dep < 1.25) tmp.copy(C.clay).lerp(C.mottle, smooth((dep - 0.85) / 0.4) * 0.6 + (n - 0.5) * 0.35);
    else if (dep < 1.9) tmp.copy(C.mottle).lerp(C.rock, smooth((dep - 1.5) / 0.4));
    else tmp.copy(C.rock);
    // thin dark bedding bands on faces; wet, tracked formation
    if (slope > 0.35) tmp.multiplyScalar(0.9 + 0.12 * Math.sin(dep * 23 + n * 3));
    if (dep > 2.3) {
      const track = Math.abs(Math.sin(z * 1.9 + Math.sin(x * 0.11) * 2)) > 0.93 ? 0.85 : 1;
      tmp.lerp(C.wet, smooth((N1[i] - 0.58) / 0.12) * 0.55).multiplyScalar(track);
    }
    tmp.multiplyScalar(0.88 + n * 0.24);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }

  let lastP = -2;
  // p < 0: before the dig, the existing ground at GL under the piling platform
  function setProgress(p) {
    if (p < 0) {
      if (lastP === -1) return; lastP = -1;
      for (let i = 0; i < pos.count; i++) { pos.setY(i, D.GL - 0.01); tmp.copy(C.fill).multiplyScalar(0.85 + N2[i] * 0.3); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b; }
      geo.computeVertexNormals(); pos.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.computeBoundingSphere();
      return;
    }
    p = clamp01(p);
    if (Math.abs(p - lastP) < 1e-4) return;
    lastP = p;
    const F = fronts(p);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      let y = height(x, z, F, N1[i]);
      const dep = D.GL - y;
      // bucket scallops and rough faces; a near-flat trimmed formation
      y += dep > 2.35 ? (N2[i] - 0.5) * 0.015 : (N2[i] - 0.5) * 0.07;
      pos.setY(i, y);
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) shade(i, pos.getY(i), 1 - nrm.getY(i), pos.getX(i), pos.getZ(i));
    pos.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    geo.computeBoundingSphere();
  }
  setProgress(-1);
  add(mesh, { stage: 'est', seq: -1, anim: 'none', soil: true });

  // -------------------------------------------------------------- dewatering
  // a sump in the formation with brown standing water, a submersible pump on auto-start and a
  // lay-flat hose up the shotcrete face and over the fence to the stormwater (via the silt control)
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.85, 28), new THREE.MeshStandardMaterial({ color: 0x5a5444, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2; water.position.set(SUMP[0], FLOOR - 0.22, SUMP[1]); water.userData.keepLook = true; water.receiveShadow = true;
  add(water, { stage: 'dig', seq: 3, anim: 'fade', rm: 'tank', rmSeq: 0, temp: true, at: [0.64, 0.7] });
  const pump = new THREE.Group();
  const pm = new THREE.MeshStandardMaterial({ color: 0x2b5fa8, roughness: 0.4, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.55, 16), pm); body.position.y = 0.2; pump.add(body);
  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0.4, 0.35, -0.6), new THREE.Vector3(0.8, 0.45, -1.4),
    new THREE.Vector3(0.9, 1.5, -1.95), new THREE.Vector3(0.9, D.GL - FLOOR + 0.5, -2.15), new THREE.Vector3(0.9, D.GL - FLOOR + 1.0, -2.65),
    new THREE.Vector3(0.85, D.GL - FLOOR + 1.2, -3.2),
  ]);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 60, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0x1f4f9a, roughness: 0.6 }));
  pump.add(hose);
  // discharge into a settlement tank (IBC) in the front yard, then to stormwater via the silt control
  const ibc = new THREE.Group(); ibc.position.set(0.85, D.GL - FLOOR + 0.35, -3.9); pump.add(ibc);
  const tankM = new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.35, transparent: true, opacity: 0.85 });
  const tk = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.95, 0.85), tankM); tk.position.y = 0.6; ibc.add(tk);
  const cage = new THREE.MeshStandardMaterial({ color: 0x9aa0a5, roughness: 0.4, metalness: 0.8 });
  for (const [x, z] of [[-0.56, -0.43], [0.56, -0.43], [-0.56, 0.43], [0.56, 0.43]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.1, 0.04), cage); p.position.set(x, 0.55, z); ibc.add(p); }
  const pal = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.13, 0.9), new THREE.MeshStandardMaterial({ color: 0x2b2d2f, roughness: 0.8 })); pal.position.y = 0.065; ibc.add(pal);
  pump.traverse(o => { o.castShadow = true; o.receiveShadow = true; o.userData.keepLook = true; });
  pump.position.set(SUMP[0], FLOOR - 0.35, SUMP[1]);
  add(pump, { stage: 'dig', seq: 3, anim: 'fade', rm: 'slab', rmSeq: 0, temp: true, at: [0.62, 0.66] });

  // -------------------------------------------------------------- plant working the faces
  // north and south crews: a 30 t and a 20 t excavator, each loading a tipper on its bench
  const crews = [
    { side: 1, z: 6.5, ex: MX.excavator(), truck: MX.tipTruck(0xf1f2f0), phase: 0 },
    { side: -1, z: 15.5, ex: MX.excavator(), truck: MX.tipTruck(0xc3262d), phase: 0.45 },
  ];
  crews[1].ex.scale.setScalar(0.88);
  for (const c of crews) {
    add(c.ex, { stage: 'dig', seq: 0, anim: 'fade', rm: 'capping', rmSeq: 0, temp: true });
    add(c.truck, { stage: 'dig', seq: 0, anim: 'fade', rm: 'capping', rmSeq: 0, temp: true });
  }
  // where each machine stands: on the deepest bench that is open, just behind its face
  function place(p) {
    const F = fronts(p);
    let k = 0; for (let j = 0; j < 3; j++) if (F[j] > 4) k = j;
    for (const c of crews) {
      const back = Math.min(HALF - 5, Math.max(1.5, F[k] - 5.5 - SKEW * Math.max(0, c.z - 11)));   // each crew keeps to its half
      const x = c.side > 0 ? X0 + back : X1 - back;
      const yEx = Math.max(height(x, c.z, F) , lifts[k][1]);
      c.ex.position.set(x, yEx, c.z);
      c.ex.rotation.y = c.side > 0 ? 0 : Math.PI;                      // boom towards the face
      // the tipper stands behind and beside, on the bench the machine has just cut
      const tx = c.side > 0 ? Math.max(X0 + 4.4, x - 3.2) : Math.min(X1 - 4.4, x + 3.2);
      const tz = c.z + 4.4;
      c.truck.position.set(tx, Math.max(height(tx, tz, F), lifts[k][1]) - 0.02, tz);
      c.truck.rotation.y = c.side > 0 ? Math.PI : 0;                   // cab to the ramp mouth, ready to drive out
      // the dig cycle runs off the programme clock, so a recording is smooth and repeatable
      const a = Math.atan2(tz - c.z, Math.abs(tx - x)) ;
      MX.poseExcavator(c.ex, p * 18 + c.phase, c.side > 0 ? -(Math.PI - a) : (Math.PI - a));
    }
  }

  return { mesh, setProgress, place, crews, height: (x, z, p) => height(x, z, fronts(p)) };
}
