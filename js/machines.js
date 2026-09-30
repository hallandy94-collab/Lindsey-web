// Construction plant, vehicles, site furniture and people, modelled to real dimensions.
// Everything is built facing +x (vehicles) or with the working boom along +z inside a
// slewing group, so the sequencer can place, relocate and slew them.

import * as THREE from 'three';

const geo = new Map();
const G = (k, f) => { if (!geo.has(k)) geo.set(k, f()); return geo.get(k); };
const bx = (w, h, d) => G(`b${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`, () => new THREE.BoxGeometry(w, h, d));
const cy = (rt, rb, h, s = 16) => G(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));

export const PAINT = {
  craneYellow: 0xf2b21b, liebherr: 0xf4c20d, white: 0xf1f2f0, red: 0xc3262d, blue: 0x1f4e8c, green: 0x2f6b3a,
  orange: 0xe8621a, grey: 0x5d6368, dark: 0x2b2e32, black: 0x161718, cream: 0xe8e1cf,
};
const mats = new Map();
export function paint(color, rough = 0.42, metal = 0.35) {
  const k = `${color}|${rough}|${metal}`;
  if (!mats.has(k)) { const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }); m.userData.keep = true; mats.set(k, m); }
  return mats.get(k).clone();
}
const rubber = () => paint(0x151515, 0.9, 0);
const steel = () => paint(0x6f757a, 0.35, 0.85);
const chrome = () => paint(0xd8dcde, 0.12, 1);
const glassM = () => { const m = new THREE.MeshStandardMaterial({ color: 0x1d2a33, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.82 }); return m; };
const lamp = (c = 0xfff7e0) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.4, roughness: 0.2 });

function mesh(g, m, x = 0, y = 0, z = 0, parent) {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true;
  o.userData.keepLook = true;
  if (parent) parent.add(o);
  return o;
}
// box from corner coordinates
function B(parent, x0, y0, z0, x1, y1, z1, m) { return mesh(bx(x1 - x0, y1 - y0, z1 - z0), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, parent); }
// member between two points (square or round)
function member(parent, a, b, t, m, round = false) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), len = va.distanceTo(vb);
  const o = mesh(round ? cy(t / 2, t / 2, len, 8) : bx(t, len, t), m);
  o.position.copy(va).add(vb).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  parent.add(o); return o;
}

// ------------------------------------------------------------------ wheels & tracks
export function wheel(r = 0.53, w = 0.38, rimColor = 0xb9bec2) {
  const g = new THREE.Group();
  const prof = [];
  for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + i / 12 * Math.PI; prof.push(new THREE.Vector2(r - 0.06 + Math.cos(a) * 0.06, Math.sin(a) * w / 2)); }
  const inner = r * 0.62;
  prof.push(new THREE.Vector2(inner, w / 2), new THREE.Vector2(inner, -w / 2), prof[0].clone());
  const tyre = mesh(G(`tyre${r},${w}`, () => new THREE.LatheGeometry(prof, 28)), rubber(), 0, 0, 0, g);
  tyre.rotation.x = Math.PI / 2;
  const rim = mesh(cy(inner, inner, w * 0.8, 20), paint(rimColor, 0.3, 0.8), 0, 0, 0, g); rim.rotation.x = Math.PI / 2;
  const hub = mesh(cy(inner * 0.35, inner * 0.35, w * 0.9, 10), steel(), 0, 0, 0, g); hub.rotation.x = Math.PI / 2;
  return g;
}
function track(parent, len, h, w, z, color = 0x1a1a1a) {
  const g = new THREE.Group(); g.position.z = z; parent.add(g);
  const shape = new THREE.Shape();
  const r = h / 2;
  shape.moveTo(-len / 2 + r, 0); shape.lineTo(len / 2 - r, 0); shape.absarc(len / 2 - r, r, r, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-len / 2 + r, h); shape.absarc(-len / 2 + r, r, r, Math.PI / 2, Math.PI * 1.5, false);
  const eg = G(`trk${len},${h},${w}`, () => { const e = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false, curveSegments: 10 }); e.translate(0, 0, -w / 2); return e; });
  mesh(eg, paint(color, 0.85, 0.3), 0, 0, 0, g);
  // grousers
  for (let x = -len / 2 + r; x <= len / 2 - r; x += 0.22) B(g, x - 0.03, -0.03, -w / 2, x + 0.03, 0.02, w / 2, paint(0x222222, 0.7, 0.5));
  // rollers and idler
  for (let x = -len / 2 + r * 1.2; x <= len / 2 - r * 1.2; x += (len - 2 * r) / 4) { const rl = mesh(cy(0.13, 0.13, w + 0.04, 12), steel(), x, 0.2, 0, g); rl.rotation.x = Math.PI / 2; }
  const id = mesh(cy(r * 0.85, r * 0.85, w + 0.06, 18), paint(0x333333, 0.5, 0.7), len / 2 - r, r, 0, g); id.rotation.x = Math.PI / 2;
  const sp = mesh(cy(r * 0.85, r * 0.85, w + 0.06, 12), paint(0x333333, 0.5, 0.7), -len / 2 + r, r, 0, g); sp.rotation.x = Math.PI / 2;
  return g;
}

// ------------------------------------------------------------------ truck cab (European forward-control)
function cab(parent, x, color, { w = 2.5, h = 3.1, d = 2.3, sleeper = false } = {}) {
  const g = new THREE.Group(); g.position.x = x; parent.add(g);
  const y0 = 1.05;
  B(g, -d / 2, y0, -w / 2, d / 2, y0 + h - 0.25, w / 2, paint(color, 0.35, 0.3));
  // roof fairing
  B(g, -d / 2 + 0.1, y0 + h - 0.25, -w / 2 + 0.08, d / 2 - 0.25, y0 + h, w / 2 - 0.08, paint(color, 0.35, 0.3));
  // windscreen & side windows
  B(g, d / 2 - 0.01, y0 + 1.25, -w / 2 + 0.12, d / 2 + 0.02, y0 + h - 0.45, w / 2 - 0.12, glassM());
  for (const s of [-1, 1]) B(g, d / 2 - 1.0, y0 + 1.35, s * (w / 2) - 0.02, d / 2 - 0.15, y0 + h - 0.5, s * (w / 2) + 0.02, glassM());
  // grille, bumper, lights, steps, mirrors
  B(g, d / 2 + 0.02, y0 + 0.35, -0.8, d / 2 + 0.05, y0 + 1.1, 0.8, paint(0x222426, 0.5, 0.6));
  B(g, d / 2, y0 - 0.25, -w / 2, d / 2 + 0.18, y0 + 0.2, w / 2, paint(0x2a2c2e, 0.6, 0.4));
  for (const s of [-1, 1]) {
    B(g, d / 2 + 0.04, y0 + 0.05, s * (w / 2 - 0.4) - 0.18, d / 2 + 0.19, y0 + 0.18, s * (w / 2 - 0.4) + 0.18, lamp());
    B(g, d / 2 - 0.9, y0 - 0.55, s * (w / 2) - 0.05, d / 2 - 0.3, y0 - 0.45, s * (w / 2) + 0.05, steel());
    member(g, [d / 2 - 0.1, y0 + 2.0, s * (w / 2)], [d / 2 + 0.25, y0 + 2.2, s * (w / 2 + 0.35)], 0.04, paint(0x1a1a1a, 0.5, 0.5), true);
    B(g, d / 2 + 0.2, y0 + 1.8, s * (w / 2 + 0.33) - 0.05, d / 2 + 0.28, y0 + 2.35, s * (w / 2 + 0.33) + 0.05, paint(0x1a1a1a, 0.5, 0.5));
  }
  // beacon
  mesh(cy(0.08, 0.1, 0.14, 10), lamp(0xff8a00), 0, y0 + h + 0.07, 0, g);
  return g;
}
function axle(parent, x, halfTrack = 0.95, r = 0.53, dual = true) {
  for (const s of [-1, 1]) {
    const w = wheel(r, 0.36); w.position.set(x, r, s * halfTrack); parent.add(w);
    if (dual) { const w2 = wheel(r, 0.36); w2.position.set(x, r, s * (halfTrack - 0.38)); parent.add(w2); }
  }
}

// ------------------------------------------------------------------ vehicles
export function tipTruck(color = PAINT.white, bodyColor = 0x7b8288) {
  const g = new THREE.Group();
  B(g, -4.2, 0.85, -0.45, 3.2, 1.15, 0.45, paint(0x1d1f22, 0.6, 0.4));             // chassis rails
  cab(g, 3.1, color);
  for (const x of [2.9, 1.6, -1.9, -3.2]) axle(g, x, 0.95, 0.53, x < 0);
  // tipper body: tapered sides, reinforced ribs, tailgate
  const body = new THREE.Group(); body.position.set(-1.5, 1.2, 0); g.add(body);
  B(body, -2.75, 0, -1.2, 2.75, 0.12, 1.2, paint(bodyColor, 0.5, 0.5));
  for (const s of [-1, 1]) {
    const side = B(body, -2.75, 0.1, s * 1.22 - 0.04, 2.75, 1.4, s * 1.22 + 0.04, paint(bodyColor, 0.5, 0.5)); side.rotation.x = s * 0.06;
    for (let x = -2.4; x <= 2.4; x += 0.8) B(body, x - 0.05, 0.1, s * 1.28 - 0.05, x + 0.05, 1.35, s * 1.28 + 0.05, paint(bodyColor, 0.5, 0.5));
  }
  B(body, 2.7, 0.1, -1.25, 2.85, 1.7, 1.25, paint(bodyColor, 0.5, 0.5));
  B(body, -2.85, 0.1, -1.2, -2.75, 1.35, 1.2, paint(bodyColor, 0.5, 0.5));
  B(body, -2.6, 0.12, -1.15, 2.6, 1.05, 1.15, paint(0x7a5a3c, 1, 0));                // load of spoil
  return g;
}

export function deliveryTruck(color = PAINT.white) {
  const g = new THREE.Group();
  B(g, -3.8, 0.8, -0.45, 2.6, 1.05, 0.45, paint(0x1d1f22, 0.6, 0.4));
  cab(g, 2.6, color, { h: 2.8, w: 2.4, d: 2.0 });
  axle(g, 2.4, 0.95, 0.5, false); axle(g, -2.6, 0.95, 0.5, true);
  B(g, -4.1, 1.1, -1.25, 1.4, 1.22, 1.25, paint(0x3a3d40, 0.6, 0.4));                 // flat deck
  // Hiab knuckle crane behind the cab
  const post = B(g, 1.0, 1.2, -0.3, 1.4, 2.6, 0.3, paint(PAINT.red, 0.4, 0.4));
  member(g, [1.2, 2.6, 0], [-1.5, 3.1, 0], 0.28, paint(PAINT.red, 0.4, 0.4));
  // packs of joinery / plasterboard on pallets
  for (const [x0, x1, c] of [[-3.9, -2.2, 0xe9e6de], [-2.1, -0.6, 0x8aa0ad], [-0.5, 0.9, 0xd8c8a8]]) {
    B(g, x0, 1.22, -1.1, x1, 1.36, 1.1, paint(0xb58f60, 0.9, 0));
    B(g, x0 + 0.05, 1.36, -1.05, x1 - 0.05, 2.2, 1.05, paint(c, 0.8, 0));
  }
  return g;
}

// Heavy haulage (HPMV) prime mover with a drop-deck trailer carrying precast.
export function hpmv(load = 'planks') {
  const g = new THREE.Group();
  B(g, 0.2, 0.8, -0.45, 6.2, 1.1, 0.45, paint(0x1d1f22, 0.6, 0.4));
  cab(g, 5.1, PAINT.red, { sleeper: true, h: 3.3 });
  axle(g, 5.1, 0.95, 0.53, false); axle(g, 2.6, 0.95, 0.53, true); axle(g, 1.25, 0.95, 0.53, true);
  mesh(cy(0.9, 0.9, 0.12, 20), steel(), 1.9, 1.2, 0, g);                                 // turntable
  // trailer: gooseneck + low deck
  B(g, -1.2, 1.25, -1.25, 2.6, 1.55, 1.25, paint(0x2b2d31, 0.6, 0.5));
  B(g, -14.5, 0.95, -1.25, -1.2, 1.2, 1.25, paint(0x2b2d31, 0.6, 0.5));
  for (const x of [-10.8, -12.1, -13.4]) axle(g, x, 0.95, 0.45, true);
  if (load === 'planks') {
    for (let k = 0; k < 3; k++) {
      B(g, -13.9, 1.28 + k * 0.26, -1.2, -6.5, 1.48 + k * 0.26, 1.2, paint(0xc3bfb5, 0.85, 0));
      for (const x of [-12.5, -8]) B(g, x - 0.08, 1.2 + k * 0.26, -1.2, x + 0.08, 1.28 + k * 0.26, 1.2, paint(0x9b7a52, 0.9, 0));
    }
  } else {
    // A-frame with wall panels on edge
    const af = paint(PAINT.blue, 0.5, 0.5);
    for (const x of [-12.5, -5]) { member(g, [x, 1.2, -1.1], [x, 4.0, 0], 0.12, af); member(g, [x, 1.2, 1.1], [x, 4.0, 0], 0.12, af); }
    for (const s of [-1, 1]) { const p = B(g, -13.8, 1.3, s * 0.35 - 0.075, -3.5, 4.0, s * 0.35 + 0.075, paint(0xc6c2b8, 0.8, 0)); p.rotation.x = s * 0.18; }
  }
  // wide-load signs
  B(g, 6.35, 3.5, -1.0, 6.4, 3.9, 1.0, paint(0xf7d117, 0.5, 0));
  return g;
}

export function agitator() {
  const g = new THREE.Group();
  B(g, -4.2, 0.85, -0.45, 3.0, 1.15, 0.45, paint(0x1d1f22, 0.6, 0.4));
  cab(g, 2.95, PAINT.white);
  for (const x of [2.75, 1.45, -2.0, -3.3]) axle(g, x, 0.95, 0.53, x < 0);
  const drum = mesh(G('drum', () => { const p = []; for (let i = 0; i <= 16; i++) { const t = i / 16; p.push(new THREE.Vector2(0.35 + Math.sin(t * Math.PI) * 0.95 + t * 0.2, t * 5.2 - 2.6)); } return new THREE.LatheGeometry(p, 24); }), paint(0xe44d26, 0.4, 0.4), -1.0, 2.55, 0, g);
  drum.rotation.z = Math.PI / 2 - 0.2;
  for (let k = 0; k < 5; k++) { const f = mesh(cy(0.9 + Math.sin(k / 4 * Math.PI) * 0.5, 0.9 + Math.sin(k / 4 * Math.PI) * 0.5, 0.06, 20), paint(0xffffff, 0.4, 0.3), -3.2 + k * 1.1, 2.55 + (k - 2) * 0.22, 0, g); f.rotation.z = Math.PI / 2 - 0.2; }
  B(g, -4.4, 1.6, -0.5, -3.8, 2.6, 0.5, paint(0x444, 0.6, 0.5));                     // chute & hopper
  return g;
}

// Truck-mounted concrete boom pump. Boom folded over the site from the street.
export function boomPump(reach = 20) {
  const g = new THREE.Group();
  B(g, -4.5, 0.85, -0.45, 3.4, 1.15, 0.45, paint(0x1d1f22, 0.6, 0.4));
  cab(g, 3.3, PAINT.white);
  for (const x of [3.1, 1.8, -2.2, -3.5]) axle(g, x, 0.95, 0.53, x < 0);
  B(g, -4.3, 1.15, -1.2, 1.6, 2.1, 1.2, paint(PAINT.white, 0.4, 0.3));
  B(g, -5.0, 1.0, -0.9, -4.3, 2.0, 0.9, paint(0x444a50, 0.6, 0.6));                   // hopper
  // outriggers (front X-type, rear swing)
  const o = paint(PAINT.red, 0.4, 0.4);
  for (const [x, s] of [[1.2, -1], [1.2, 1], [-3.8, -1], [-3.8, 1]]) {
    member(g, [x, 1.3, s * 1.1], [x + (x > 0 ? 1.6 : -1.2), 1.3, s * 3.6], 0.3, o);
    B(g, x + (x > 0 ? 1.6 : -1.2) - 0.1, 0.1, s * 3.6 - 0.1, x + (x > 0 ? 1.6 : -1.2) + 0.1, 1.3, s * 3.6 + 0.1, steel());
    B(g, x + (x > 0 ? 1.6 : -1.2) - 0.5, 0, s * 3.6 - 0.5, x + (x > 0 ? 1.6 : -1.2) + 0.5, 0.1, s * 3.6 + 0.5, paint(0x8b6a45, 0.9, 0));
  }
  // turret and 4-section Z-fold boom reaching +z over the site
  mesh(cy(0.7, 0.8, 0.9, 16), o, 0.8, 2.55, 0, g);
  const pts = [[0.8, 3.0, 0], [0.8, 12.5, reach * 0.3], [0.8, 14.0, reach * 0.65], [0.8, 10.5, reach * 0.92], [0.8, 3.5, reach]];
  pts.slice(0, -1).forEach((a, i) => {
    const t = 0.55 - i * 0.1;
    member(g, a, pts[i + 1], t, i === 3 ? paint(0x2b2d31, 0.7, 0.3) : o);
    member(g, [a[0] + 0.3, a[1] + 0.3, a[2]], [pts[i + 1][0] + 0.3, pts[i + 1][1] + 0.3, pts[i + 1][2]], 0.13, paint(0x9aa0a5, 0.4, 0.8), true); // delivery line
  });
  return g;
}

// ------------------------------------------------------------------ mobile cranes
// All-terrain mobile crane. axles: 3 (55 t), 5 (130 t). Boom along +z in userData.slewGroup.
export function mobileCrane({ axles = 5, reach = 30, hookY = 8, color = PAINT.liebherr, ring = true, luff = 0.95 } = {}) {
  const g = new THREE.Group();
  const L = 3.2 + axles * 1.65, x0 = -L / 2;
  // carrier
  const c = paint(color, 0.38, 0.35);
  B(g, x0, 0.95, -1.35, x0 + L, 1.85, 1.35, c);
  B(g, x0 + L - 0.3, 1.0, -1.4, x0 + L + 0.2, 1.6, 1.4, paint(0x2a2c2e, 0.5, 0.5));           // front bumper
  for (let i = 0; i < axles; i++) axle(g, x0 + 1.4 + i * 1.65 + (i >= axles / 2 ? 0.8 : 0), 1.0, 0.6, false);
  // driver's cab (offset left, low)
  const dc = new THREE.Group(); dc.position.set(x0 + L - 1.2, 1.85, -0.75); g.add(dc);
  B(dc, -0.9, 0, -0.55, 0.9, 1.45, 0.55, c); B(dc, 0.88, 0.45, -0.5, 0.92, 1.35, 0.5, glassM()); B(dc, -0.6, 0.5, -0.57, 0.8, 1.3, -0.53, glassM());
  // outriggers: beams fully extended, jacks down on timber mats
  for (const xo of [x0 + 1.0, x0 + L - 1.6]) for (const s of [-1, 1]) {
    B(g, xo - 0.22, 1.1, s * 1.3, xo + 0.22, 1.5, s * 3.8, paint(0x2a2c2e, 0.5, 0.6));
    mesh(cy(0.14, 0.14, 1.35, 10), steel(), xo, 0.75, s * 3.8, g);
    mesh(cy(0.4, 0.4, 0.08, 16), paint(0x2a2c2e, 0.6, 0.5), xo, 0.12, s * 3.8, g);
    B(g, xo - 0.7, 0, s * 3.8 - 0.7, xo + 0.7, 0.08, s * 3.8 + 0.7, paint(0x8b6a45, 0.9, 0));
  }
  // superstructure
  const slew = new THREE.Group(); slew.position.set(x0 + L * 0.42, 1.85, 0); g.add(slew);
  mesh(cy(1.15, 1.15, 0.35, 24), paint(0x2a2c2e, 0.5, 0.6), 0, 0.17, 0, slew);
  B(slew, -1.25, 0.35, -1.9, 1.25, 1.55, 1.2, c);                                          // turntable deck & winches (boom runs +z)
  B(slew, -1.35, 0.35, -3.2, 1.35, 1.85, -1.9, paint(PAINT.dark, 0.5, 0.4));                // counterweight slabs
  for (let k = 0; k < 3; k++) B(slew, -1.37, 0.4 + k * 0.48, -3.22, 1.37, 0.43 + k * 0.48, -1.88, paint(0x111111, 0.6, 0.3));
  const oc = new THREE.Group(); oc.position.set(1.05, 0.35, 0.2); slew.add(oc);                  // operator's cab
  B(oc, 0, 0, -0.9, 0.9, 1.7, 0.9, c); B(oc, 0.05, 0.7, 0.88, 0.85, 1.6, 0.92, glassM()); B(oc, 0.88, 0.7, -0.8, 0.92, 1.6, 0.8, glassM());
  // telescopic boom: nested sections tapering to the head
  const bl = reach / Math.cos(luff), pivY = 1.9;
  const boom = new THREE.Group(); boom.position.set(0, pivY, -0.6); boom.rotation.x = -luff; slew.add(boom);
  const secs = 5, secL = bl / secs * 1.12;
  for (let i = 0; i < secs; i++) {
    const w = 0.95 - i * 0.12, h = 1.25 - i * 0.16, z0 = i * (bl - secL) / (secs - 1);
    B(boom, -w / 2, -h / 2, z0, w / 2, h / 2, z0 + secL, paint(color, 0.35 + i * 0.02, 0.4));
    B(boom, -w / 2 - 0.005, -h / 2 + 0.05, z0 + secL - 0.25, w / 2 + 0.005, -h / 2 + 0.2, z0 + secL - 0.05, paint(0x2a2c2e, 0.5, 0.5));
  }
  B(boom, -0.3, -0.45, bl - 0.1, 0.3, 0.35, bl + 0.6, paint(0x2a2c2e, 0.5, 0.6));             // boom head
  for (const s of [-0.15, 0.15]) { const sh = mesh(cy(0.32, 0.32, 0.08, 18), steel(), s, 0.1, bl + 0.35, boom); sh.rotation.z = Math.PI / 2; }
  // luffing ram
  member(slew, [0, 0.6, 0.9], [0, pivY + Math.sin(luff) * bl * 0.3 - 0.6, -0.6 + Math.cos(luff) * bl * 0.3], 0.34, steel(), true);
  // hoist ropes and hook block
  const tipY = pivY + Math.sin(luff) * (bl + 0.35) + 1.85, tipZ = -0.6 + Math.cos(luff) * (bl + 0.35);
  const hy = Math.max(hookY - 1.85, 1.5);
  for (const s of [-0.08, 0.08]) member(slew, [s, tipY - 1.85, tipZ], [s, hy + 0.9, tipZ], 0.025, paint(0x222222, 0.4, 0.8), true);
  B(slew, -0.3, hy, tipZ - 0.2, 0.3, hy + 0.9, tipZ + 0.2, paint(color, 0.35, 0.4));
  mesh(G('hook', () => new THREE.TorusGeometry(0.16, 0.05, 8, 16, Math.PI * 1.5)), steel(), 0, hy - 0.2, tipZ, slew);
  g.userData.slewGroup = slew;
  if (ring) {
    const rg = new THREE.Mesh(new THREE.RingGeometry(reach - 0.15, reach + 0.15, 128), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    rg.rotation.x = -Math.PI / 2; rg.position.y = 0.06; g.add(rg);
    const ex = new THREE.Mesh(new THREE.CircleGeometry(5.5, 48), new THREE.MeshBasicMaterial({ color: 0xd62828, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    ex.rotation.x = -Math.PI / 2; ex.position.y = 0.05; g.add(ex);
  }
  return g;
}

// ------------------------------------------------------------------ piling rig (rotary, CFA / cased)
export function pilingRig() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) track(g, 5.4, 0.95, 0.8, s * 1.55, 0x1b1b1b);
  B(g, -2.2, 0.55, -1.2, 2.2, 1.0, 1.2, paint(0x333, 0.6, 0.5));
  mesh(cy(1.0, 1.0, 0.3, 20), paint(0x2a2a2a, 0.5, 0.6), 0, 1.15, 0, g);
  const up = new THREE.Group(); up.position.y = 1.3; g.add(up);
  const c = paint(0xf2a900, 0.4, 0.35);
  B(up, -2.6, 0, -1.4, 1.6, 1.8, 1.4, c);                                  // engine house
  B(up, -3.2, 0, -1.4, -2.6, 1.6, 1.4, paint(0x222, 0.6, 0.4));            // counterweight
  B(up, 0.6, 0, 0.35, 1.7, 2.3, 1.4, c); B(up, 1.68, 0.9, 0.45, 1.72, 2.1, 1.3, glassM()); B(up, 0.7, 0.9, 1.38, 1.6, 2.1, 1.42, glassM());
  // parallel kinematics to the mast
  member(up, [1.2, 1.2, -0.6], [2.6, 2.2, -0.6], 0.3, c); member(up, [1.2, 0.3, -0.6], [2.6, 0.9, -0.6], 0.3, c);
  const mastX = 2.9;
  B(up, mastX - 0.35, -0.9, -0.95, mastX + 0.35, 20, -0.25, c);                // leader mast (box section)
  for (let y = 0; y < 19; y += 1.2) B(up, mastX - 0.36, y, -0.96, mastX + 0.36, y + 0.06, -0.24, paint(0xd99700, 0.4, 0.4));
  B(up, mastX - 0.5, 20, -1.1, mastX + 0.5, 20.8, -0.1, paint(0x2a2a2a, 0.5, 0.6)); // crown sheaves
  member(up, [-1.8, 1.8, -0.6], [mastX, 15, -0.6], 0.22, steel(), true);      // backstay ram
  // rotary head, kelly bar and auger
  B(up, mastX + 0.3, 7.5, -1.25, mastX + 1.4, 9.0, 0.05, paint(0x2a2c2e, 0.5, 0.6));
  mesh(cy(0.18, 0.18, 17, 12), steel(), mastX + 0.85, 10.5, -0.6, up);
  const aug = mesh(cy(0.3, 0.3, 3.6, 16), paint(0x575b5f, 0.5, 0.8), mastX + 0.85, 0.2, -0.6, up);
  for (let k = 0; k < 10; k++) { const f = mesh(G('flight', () => new THREE.TorusGeometry(0.3, 0.035, 6, 20)), paint(0x575b5f, 0.5, 0.8), mastX + 0.85, -1.4 + k * 0.33, -0.6, up); f.rotation.x = Math.PI / 2 + 0.25; }
  return g;
}

// ------------------------------------------------------------------ excavator (20 t)
export function excavator(color = PAINT.craneYellow) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) track(g, 4.4, 0.85, 0.6, s * 1.2, 0x1b1b1b);
  B(g, -1.8, 0.45, -0.9, 1.8, 0.85, 0.9, paint(0x2a2a2a, 0.6, 0.5));
  mesh(cy(0.85, 0.85, 0.25, 18), paint(0x2a2a2a, 0.5, 0.6), 0, 0.97, 0, g);
  const up = new THREE.Group(); up.position.y = 1.1; g.add(up);
  const c = paint(color, 0.38, 0.35);
  B(up, -2.3, 0, -1.3, 1.0, 1.25, 1.3, c);
  B(up, -2.75, 0, -1.3, -2.25, 1.15, 1.3, paint(0x2b2b2b, 0.5, 0.4));          // counterweight
  const ck = new THREE.Group(); ck.position.set(0.1, 0, 0.35); up.add(ck);     // cab (left front)
  B(ck, 0, 0, 0, 1.35, 2.0, 0.95, c); B(ck, 1.33, 0.6, 0.06, 1.37, 1.9, 0.89, glassM()); B(ck, 0.1, 0.8, 0.93, 1.25, 1.9, 0.97, glassM());
  // boom (two-piece bend), stick and bucket, with rams
  const bm = paint(color, 0.38, 0.35);
  const p0 = [0.9, 0.9, -0.25], p1 = [3.4, 3.4, -0.25], p2 = [5.2, 2.2, -0.25], p3 = [5.5, -0.2, -0.25];
  member(up, p0, p1, 0.5, bm); member(up, p1, p2, 0.45, bm); member(up, p2, p3, 0.35, bm);
  member(up, [0.9, 0.3, -0.25], [2.4, 2.4, -0.25], 0.14, chrome(), true);
  member(up, [3.1, 3.8, -0.25], [5.0, 2.8, -0.25], 0.12, chrome(), true);
  const bk = new THREE.Group(); bk.position.set(...p3); up.add(bk);
  B(bk, -0.55, -0.6, -0.55, 0.35, 0.1, 0.55, paint(0x303234, 0.6, 0.6));
  for (let k = -2; k <= 2; k++) B(bk, 0.3, -0.62, k * 0.2 - 0.04, 0.5, -0.55, k * 0.2 + 0.04, steel());
  return g;
}

// ------------------------------------------------------------------ site furniture
export function siteCabin(w = 6, d = 2.4, h = 2.7, color = 0xeceae2) {
  const g = new THREE.Group();
  const c = paint(color, 0.55, 0.2); c.userData.surf = 'cabin';
  const body = B(g, 0, 0.15, 0, w, h, d, c); body.material.userData.surf = 'cabin'; body.userData.keepLook = false;
  B(g, -0.02, 0, -0.02, w + 0.02, 0.15, d + 0.02, paint(0x303234, 0.6, 0.5));
  B(g, -0.02, h, -0.02, w + 0.02, h + 0.08, d + 0.02, paint(0x303234, 0.6, 0.5));
  for (let x = 0.8; x < w - 1.5; x += 1.8) B(g, x, 1.1, -0.02, x + 1.1, 2.0, 0.02, glassM());
  B(g, w - 1.3, 0.2, -0.03, w - 0.4, 2.2, 0.02, paint(0x7a8187, 0.4, 0.6));
  B(g, w - 1.5, 0, -0.6, w - 0.2, 0.18, -0.03, paint(0x6f757a, 0.5, 0.8));
  return g;
}
export function skipBin(color = PAINT.craneYellow, load = 0x7a6a58) {
  const g = new THREE.Group();
  const s = new THREE.Shape(); s.moveTo(-1.6, 0); s.lineTo(1.6, 0); s.lineTo(2.1, 1.35); s.lineTo(-2.1, 1.35); s.closePath();
  const e = mesh(G('skip', () => { const x = new THREE.ExtrudeGeometry(s, { depth: 1.8, bevelEnabled: false }); x.translate(0, 0, -0.9); return x; }), paint(color, 0.55, 0.45), 0, 0, 0, g);
  B(g, -2.0, 0.9, -0.85, 2.0, 1.3, 0.85, paint(load, 1, 0));
  for (const x of [-1.4, 1.4]) B(g, x - 0.06, 1.2, -0.95, x + 0.06, 1.45, 0.95, paint(0x2a2a2a, 0.6, 0.6));
  return g;
}
export function waterBarrier(color = 0xe8591a) {
  const g = new THREE.Group();
  const s = new THREE.Shape(); s.moveTo(-0.28, 0); s.lineTo(0.28, 0); s.lineTo(0.14, 0.4); s.lineTo(0.11, 0.8); s.lineTo(-0.11, 0.8); s.lineTo(-0.14, 0.4); s.closePath();
  const m = mesh(G('wb', () => { const x = new THREE.ExtrudeGeometry(s, { depth: 1.9, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }); x.translate(0, 0, -0.95); x.rotateY(Math.PI / 2); return x; }), paint(color, 0.5, 0), 0, 0, 0, g);
  return g;
}
export function cone() {
  const g = new THREE.Group();
  B(g, -0.2, 0, -0.2, 0.2, 0.04, 0.2, paint(0x1a1a1a, 0.8, 0));
  mesh(cy(0.035, 0.15, 0.68, 14), paint(0xff5a0a, 0.5, 0), 0, 0.38, 0, g);
  mesh(cy(0.07, 0.1, 0.12, 14), paint(0xf2f2f2, 0.3, 0.2), 0, 0.46, 0, g);
  return g;
}

// Worker in hi-vis, hard hat and boots. pose: 0 standing, 1 walking, 2 bending.
export function worker(vest = 0xf6d31c, hat = 0xf5f5f2, pose = 0) {
  const g = new THREE.Group();
  const pants = paint(0x2a3440, 0.9, 0), skin = paint(0xc9926e, 0.7, 0), v = paint(vest, 0.55, 0), boot = paint(0x1a1612, 0.8, 0);
  const lg = pose === 1 ? 0.25 : 0;
  for (const s of [-1, 1]) {
    const leg = mesh(cy(0.075, 0.065, 0.82, 8), pants, 0, 0.47, s * 0.1, g); leg.rotation.z = s * lg;
    B(g, -0.06 + s * lg * 0.4, 0, s * 0.1 - 0.06, 0.18 + s * lg * 0.4, 0.09, s * 0.1 + 0.06, boot);
  }
  const torso = new THREE.Group(); torso.position.y = 0.9; if (pose === 2) torso.rotation.z = -0.6; g.add(torso);
  mesh(cy(0.17, 0.15, 0.6, 10), v, 0, 0.3, 0, torso);
  for (const y of [0.18, 0.38]) mesh(cy(0.175, 0.175, 0.035, 10), paint(0xd9dde0, 0.25, 0.6), 0, y, 0, torso);  // reflective tape
  for (const s of [-1, 1]) { const a = mesh(cy(0.05, 0.045, 0.6, 8), v, 0.02, 0.28, s * 0.22, torso); a.rotation.x = s * 0.15; a.rotation.z = pose === 1 ? -s * 0.3 : 0.1; }
  mesh(G('head', () => new THREE.SphereGeometry(0.105, 14, 10)), skin, 0, 0.72, 0, torso);
  const ht = mesh(G('hat', () => new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), paint(hat, 0.35, 0), 0, 0.77, 0, torso);
  mesh(cy(0.16, 0.16, 0.012, 16), paint(hat, 0.35, 0), 0.03, 0.775, 0, torso);
  return g;
}

// Car (hatch / SUV mix) from a side profile. Length along +x.
export function car(color = 0x8a9aa8, type = 'sedan') {
  const g = new THREE.Group();
  const P = type === 'suv'
    ? [[-2.35, 0.35], [-2.4, 0.95], [-2.2, 1.05], [-1.9, 1.62], [0.9, 1.66], [1.55, 1.08], [2.3, 0.95], [2.4, 0.4]]
    : [[-2.3, 0.35], [-2.35, 0.9], [-2.0, 1.0], [-1.2, 1.42], [0.6, 1.44], [1.35, 0.98], [2.25, 0.85], [2.35, 0.4]];
  const s = new THREE.Shape(); P.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath();
  const w = 1.84;
  const body = mesh(G('car' + type, () => { const e = new THREE.ExtrudeGeometry(s, { depth: w - 0.12, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3 }); e.translate(0, 0, -(w - 0.12) / 2); return e; }), paint(color, 0.22, 0.6), 0, 0, 0, g);
  // glasshouse
  const gy = type === 'suv' ? 1.08 : 1.0;
  const Q = type === 'suv' ? [[-2.1, gy], [-1.85, 1.56], [0.85, 1.6], [1.45, gy]] : [[-1.9, gy], [-1.15, 1.38], [0.55, 1.4], [1.25, gy]];
  const s2 = new THREE.Shape(); Q.forEach(([x, y], i) => i ? s2.lineTo(x, y) : s2.moveTo(x, y)); s2.closePath();
  mesh(G('glass' + type, () => { const e = new THREE.ExtrudeGeometry(s2, { depth: w - 0.02, bevelEnabled: false }); e.translate(0, 0, -(w - 0.02) / 2); return e; }), glassM(), 0, 0.02, 0, g);
  for (const [x, sd] of [[-1.45, 1], [1.45, 1], [-1.45, -1], [1.45, -1]]) { const wh = wheel(0.34, 0.24, 0x9ca3a8); wh.position.set(x, 0.34, sd * 0.8); g.add(wh); }
  for (const sd of [-1, 1]) { B(g, 2.33, 0.62, sd * 0.62 - 0.14, 2.42, 0.75, sd * 0.62 + 0.14, lamp()); B(g, -2.42, 0.72, sd * 0.62 - 0.16, -2.34, 0.84, sd * 0.62 + 0.16, lamp(0xb3121b)); }
  return g;
}

// Pōhutukawa-style tree: spreading trunk and branches with clustered canopy.
export function tree(scale = 1, seed = 1) {
  const g = new THREE.Group();
  let a = seed * 9301 + 49297; const r = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
  const bark = paint(0x5a4636, 0.95, 0), leaf = [0x3b5a2f, 0x46663a, 0x355230, 0x4f6f3c];
  member(g, [0, 0, 0], [0, 2.2 * scale, 0], 0.32 * scale, bark, true);
  const canG = G('can', () => { const c = new THREE.IcosahedronGeometry(1, 1); const p = c.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.85 + ((i * 7919) % 97) / 97 * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.75, p.getZ(i) * k); } c.computeVertexNormals(); return c; });
  for (let k = 0; k < 5; k++) {
    const ang = r() * Math.PI * 2, len = (1.4 + r()) * scale, top = [Math.cos(ang) * len, (2.2 + 1.4 * r()) * scale + 0.8 * scale, Math.sin(ang) * len];
    member(g, [0, 2.0 * scale, 0], top, 0.14 * scale, bark, true);
    const cm = mesh(canG, paint(leaf[k % 4], 0.95, 0), top[0], top[1] + 0.5 * scale, top[2], g); cm.scale.setScalar((1.3 + r() * 0.6) * scale);
    cm.material.flatShading = true;
  }
  const c0 = mesh(canG, paint(leaf[1], 0.95, 0), 0, 4.2 * scale, 0, g); c0.scale.setScalar(2.1 * scale); c0.material.flatShading = true;
  return g;
}
