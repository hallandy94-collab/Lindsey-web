// Construction plant, vehicles, site furniture and people, modelled to real dimensions.
// Everything is built facing +x (vehicles) or with the working boom along +z inside a
// slewing group, so the sequencer can place, relocate and slew them.

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';

const geo = new Map();
const G = (k, f) => { if (!geo.has(k)) geo.set(k, f()); return geo.get(k); };
// panels get softly bevelled edges so they catch the light like pressed or fabricated metal
const bx = (w, h, d) => G(`b${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`, () => {
  const m = Math.min(w, h, d);
  return m >= 0.08 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(0.045, m * 0.2)) : new THREE.BoxGeometry(w, h, d);
});
const cy = (rt, rb, h, s = 16) => G(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));

export const PAINT = {
  craneYellow: 0xf2b21b, liebherr: 0xf4c20d, white: 0xf1f2f0, red: 0xc3262d, blue: 0x1f4e8c, green: 0x2f6b3a,
  orange: 0xe8621a, grey: 0x5d6368, dark: 0x2b2e32, black: 0x161718, cream: 0xe8e1cf,
};
const mats = new Map();
export function paint(color, rough = 0.42, metal = 0.35) {
  const k = `${color}|${rough}|${metal}`;
  if (!mats.has(k)) {
    // smooth painted metal gets a clear coat (vehicle and plant paint); rubber, timber and grime stay matt
    const coat = rough <= 0.45 && metal <= 0.5;
    const m = coat ? new THREE.MeshPhysicalMaterial({ color, roughness: rough + 0.08, metalness: metal * 0.6, clearcoat: 0.7, clearcoatRoughness: 0.18 })
      : new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    m.userData.keep = true; mats.set(k, m);
  }
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
  const y0 = 1.05, body = paint(color, 0.3, 0.3), dark = paint(0x1c1e20, 0.55, 0.3), trim = paint(0x2a2c2f, 0.45, 0.4);
  const prof = (k, pts, depth, m, bev = 0.05) => {
    const sh = new THREE.Shape(); pts.forEach(([px, py], i) => i ? sh.lineTo(px, py) : sh.moveTo(px, py)); sh.closePath();
    return mesh(G(k, () => { const e = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 3 }); e.translate(0, 0, -depth / 2); return e; }), m, 0, 0, 0, g);
  };
  const D2 = d / 2, rake = 0.3, wy = y0 + 1.2, top = y0 + h - 0.12;
  // lower cab and the raked upper cab, as side profiles extruded across the width
  prof(`cabL${d}${w}`, [[-D2, y0 - 0.1], [D2 + 0.04, y0 - 0.1], [D2 + 0.04, wy], [-D2, wy]], w - 0.1, body);
  prof(`cabU${d}${w}${h}`, [[-D2, wy - 0.02], [D2 - 0.02, wy - 0.02], [D2 - rake, top - 0.12], [D2 - rake - 0.12, top], [-D2, top]], w - 0.1, body);
  // windscreen in a black frame, on the raked face
  const ang = Math.atan2(rake - 0.02, top - 0.12 - wy), wl = Math.hypot(rake - 0.02, top - 0.12 - wy);
  const ws = new THREE.Group(); ws.position.set(D2 - 0.02 - (rake - 0.02) / 2 + 0.05, (wy + top - 0.12) / 2, 0); ws.rotation.z = ang; g.add(ws);
  B(ws, -0.02, -wl / 2, -(w - 0.12) / 2, 0.01, wl / 2, (w - 0.12) / 2, dark);
  B(ws, 0.01, -wl / 2 + 0.06, -(w - 0.3) / 2, 0.03, wl / 2 - 0.08, (w - 0.3) / 2, glassM());
  // sun visor and roof marker lights
  B(g, D2 - rake - 0.1, top - 0.16, -(w - 0.2) / 2, D2 - rake + 0.16, top - 0.04, (w - 0.2) / 2, dark);
  for (let k = -2; k <= 2; k++) mesh(cy(0.035, 0.035, 0.04, 8), lamp(0xffa21a), D2 - rake + 0.1, top - 0.02, k * 0.28, g);
  if (sleeper) prof(`cabS${d}${w}`, [[-D2, top - 0.02], [D2 - rake - 0.3, top - 0.02], [D2 - rake - 0.5, top + 0.55], [-D2 + 0.1, top + 0.6]], w - 0.3, body);
  // side glass, door shut-lines and handles, B-pillar
  for (const sd of [-1, 1]) {
    const zf = sd * ((w - 0.1) / 2 + 0.055);
    B(g, D2 - 1.05, wy + 0.08, zf - 0.012, D2 - 0.22, top - 0.32, zf + 0.012, glassM());
    B(g, D2 - 1.12, y0 - 0.05, zf - 0.008, D2 - 1.08, top - 0.25, zf + 0.008, dark);           // rear door shut-line
    B(g, D2 - 1.1, y0 + 0.9, zf - 0.03, D2 - 0.85, y0 + 0.96, zf + 0.03, trim);                // handle
    // corner deflector, mirrors on arms (main + wide-angle), steps, front mudguard
    B(g, D2 - 0.06, wy - 0.4, zf - sd * 0.02, D2 + 0.06, top - 0.3, zf + sd * 0.06, body);
    member(g, [D2 - 0.25, wy + 0.65, zf], [D2 + 0.12, wy + 0.85, zf + sd * 0.42], 0.035, trim, true);
    B(g, D2 + 0.05, wy + 0.35, zf + sd * 0.4 - 0.06, D2 + 0.17, wy + 1.0, zf + sd * 0.4 + 0.06, dark);
    B(g, D2 + 0.05, wy + 0.08, zf + sd * 0.4 - 0.06, D2 + 0.17, wy + 0.3, zf + sd * 0.4 + 0.06, dark);
    for (const [yy, dz] of [[y0 - 0.35, 0.04], [y0 - 0.75, 0.08]]) B(g, D2 - 1.0, yy, zf - sd * 0.32, D2 - 0.25, yy + 0.06, zf + sd * dz, trim);
    // (the half cylinder is turned so its axis runs with the wheel axle and the open half faces down)
    const mg = mesh(G('mguard', () => { const c = new THREE.CylinderGeometry(0.66, 0.66, 0.5, 20, 1, true, Math.PI / 2, Math.PI); c.rotateX(Math.PI / 2); return c; }), paint(0x16181a, 0.7, 0.1), 0, 0.53, sd * (w / 2 - 0.25), g);
    mg.material.side = THREE.DoubleSide;
  }
  // grille with slats and badge, headlight clusters, indicators, bumper, fog lights, number plate
  B(g, D2 + 0.03, y0 + 0.32, -0.78, D2 + 0.07, wy - 0.12, 0.78, dark);
  for (let k = 0; k < 4; k++) B(g, D2 + 0.06, y0 + 0.42 + k * 0.17, -0.74, D2 + 0.09, y0 + 0.46 + k * 0.17, 0.74, chrome());
  B(g, D2 + 0.08, wy - 0.3, -0.12, D2 + 0.1, wy - 0.2, 0.12, chrome());
  for (const sd of [-1, 1]) {
    B(g, D2 + 0.02, y0 + 0.08, sd * (w / 2 - 0.45) - 0.24, D2 + 0.1, y0 + 0.28, sd * (w / 2 - 0.45) + 0.24, trim);
    B(g, D2 + 0.08, y0 + 0.11, sd * (w / 2 - 0.45) - 0.21, D2 + 0.11, y0 + 0.25, sd * (w / 2 - 0.45) + 0.05 * sd, lamp());
    B(g, D2 + 0.08, y0 + 0.11, sd * (w / 2 - 0.25) - 0.04, D2 + 0.11, y0 + 0.25, sd * (w / 2 - 0.25) + 0.04, lamp(0xff9a1a));
    mesh(cy(0.06, 0.06, 0.05, 12), lamp(), D2 + 0.2, y0 - 0.25, sd * (w / 2 - 0.4), g).rotation.z = Math.PI / 2;
  }
  B(g, D2, y0 - 0.45, -w / 2 + 0.02, D2 + 0.2, y0 - 0.02, w / 2 - 0.02, trim);
  B(g, D2 + 0.2, y0 - 0.32, -0.26, D2 + 0.22, y0 - 0.16, 0.26, paint(0xf2f2ee, 0.5, 0));
  // beacon
  mesh(cy(0.08, 0.1, 0.14, 10), lamp(0xff8a00), D2 - rake - 0.5, (sleeper ? top + 0.6 : top) + 0.07, 0, g);
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
  // 8 m³ drum: rear charging cone, short barrel, long front cone to the gearbox; tilted ~12° up to the rear
  const drumG = G('drum2', () => {
    const p = [[0.0, 0.42], [0.25, 0.55], [1.6, 1.12], [2.0, 1.16], [2.6, 1.14], [4.3, 0.62], [4.55, 0.4], [4.6, 0.0]];
    const pts = []; for (let i = 0; i < p.length - 1; i++) for (let k = 0; k < 6; k++) { const t = k / 6, a = p[i], b2 = p[i + 1]; pts.push(new THREE.Vector2(a[1] + (b2[1] - a[1]) * t, a[0] + (b2[0] - a[0]) * t)); }
    pts.push(new THREE.Vector2(0, 4.6));
    const l = new THREE.LatheGeometry(pts, 48); l.translate(0, -2.3, 0); return l;
  });
  const dg = new THREE.Group(); dg.position.set(-1.0, 2.5, 0); dg.rotation.z = -Math.PI / 2 - 0.21; g.add(dg);   // gearbox end forward and low
  mesh(drumG, paint(0xd8471f, 0.32, 0.35), 0, 0, 0, dg);
  // painted white bands, roller track ring, front gearbox
  for (const [y, r] of [[-0.55, 1.13], [0.25, 1.15]]) mesh(G('band' + y, () => new THREE.CylinderGeometry(r + 0.012, r + 0.012, 0.28, 48, 1, true)), paint(0xf4f4f0, 0.35, 0.2), 0, y, 0, dg);
  mesh(G('dring', () => new THREE.TorusGeometry(1.1, 0.06, 8, 48)), steel(), 0, -0.75, 0, dg).rotation.x = Math.PI / 2;
  mesh(cy(0.35, 0.35, 0.45, 20), paint(0x2a2c2e, 0.5, 0.6), 0, 2.45, 0, dg);
  // drum pedestals: front gearbox stand and rear roller frame
  B(g, 1.0, 1.15, -0.5, 1.5, 2.6, 0.5, paint(0x2a2c2e, 0.5, 0.5));
  for (const sd of [-1, 1]) member(g, [-2.6, 1.15, sd * 0.45], [-2.4, 2.35, sd * 0.95], 0.16, paint(0x2a2c2e, 0.5, 0.5));
  // charge hopper, swing chute, ladder and platform, water tank behind the cab
  B(g, -3.85, 3.0, -0.55, -3.2, 3.6, 0.55, paint(0x5b6166, 0.5, 0.6));
  const chute = new THREE.Group(); chute.position.set(-4.15, 2.35, 0); chute.rotation.y = 0.5; g.add(chute);
  B(chute, -1.6, -0.12, -0.25, 0, 0.0, 0.25, paint(0x5b6166, 0.5, 0.6)); chute.rotation.z = -0.25;
  for (const sd of [-1, 1]) member(g, [-4.35, 1.1, sd * 0.35], [-3.9, 3.0, sd * 0.35], 0.04, steel(), true);
  for (let k = 0; k < 6; k++) member(g, [-4.33 + k * 0.075, 1.25 + k * 0.3, -0.35], [-4.33 + k * 0.075, 1.25 + k * 0.3, 0.35], 0.03, steel(), true);
  B(g, -4.1, 2.95, -0.6, -3.7, 3.0, 0.6, steel());
  mesh(cy(0.32, 0.32, 1.2, 16), paint(0x2b6fb3, 0.4, 0.3), 1.65, 1.65, 0, g).rotation.x = Math.PI / 2;
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
  for (const sx of [-0.15, -0.05, 0.05, 0.15]) member(slew, [sx, tipY - 1.85, tipZ], [sx, hy + 1.0, tipZ], 0.022, paint(0x222222, 0.35, 0.85), true);
  // hook block: side plates in the crane colour, visible sheaves, swivel, hook with safety latch
  for (const sd of [-1, 1]) B(slew, sd * 0.24 - 0.03, hy + 0.15, tipZ - 0.38, sd * 0.24 + 0.03, hy + 1.05, tipZ + 0.38, paint(color, 0.32, 0.4));
  for (const sx of [-0.1, 0.1]) { const sv = mesh(cy(0.32, 0.32, 0.07, 20), steel(), sx, hy + 0.75, tipZ, slew); sv.rotation.z = Math.PI / 2; }
  B(slew, -0.22, hy + 0.12, tipZ - 0.36, 0.22, hy + 0.32, tipZ + 0.36, paint(0x2a2c2e, 0.5, 0.5));
  mesh(cy(0.07, 0.07, 0.2, 10), steel(), 0, hy + 0.02, tipZ, slew);
  const hk = mesh(G('hook', () => new THREE.TorusGeometry(0.16, 0.055, 10, 20, Math.PI * 1.5)), steel(), 0, hy - 0.25, tipZ, slew); hk.rotation.z = Math.PI * 0.75;
  // carrier livery stripe and walkway chequer plate
  for (const sd of [-1, 1]) B(g, x0 + 0.4, 1.35, sd * 1.36 - 0.01, x0 + L - 0.4, 1.5, sd * 1.36 + 0.01, paint(0x2a2c2e, 0.4, 0.4));
  B(g, x0 + 0.2, 1.85, -1.3, x0 + L * 0.3, 1.88, 1.3, steel());
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
  const up = new THREE.Group(); up.position.y = 1.1; g.add(up);               // slewing house
  const c = paint(color, 0.38, 0.35), dk = paint(0x2b2b2b, 0.5, 0.4);
  B(up, -1.9, 0, -1.3, 1.0, 1.2, 1.3, c);
  // rounded counterweight at the rear, with a dark lower skirt
  mesh(G('cwt', () => { const k = new THREE.CylinderGeometry(1.32, 1.32, 1.1, 28, 1, false, Math.PI, Math.PI); return k; }), dk, -1.45, 0.58, 0, up);
  mesh(G('cwtTop', () => new THREE.CylinderGeometry(1.33, 1.33, 0.06, 28, 1, false, Math.PI, Math.PI)), c, -1.45, 1.16, 0, up);
  B(up, -1.9, 1.2, -1.1, -0.5, 1.28, 0.2, dk);                                   // engine hood grille
  mesh(cy(0.06, 0.06, 0.7, 8), paint(0x1a1a1a, 0.5, 0.7), -1.5, 1.55, -0.8, up); // exhaust stack
  // cab (left front): dark pillars, big glazed front and side, painted roof and rear
  const ck = new THREE.Group(); ck.position.set(0.05, 0, 0.32); up.add(ck);
  const CW = 0.98, CL = 1.45, CH = 2.05, glz = glassM(), pil = paint(0x1b1b1b, 0.45, 0.4);
  B(ck, 0, 0, 0, CL, 0.6, CW, c);                                              // lower panel
  B(ck, -0.02, CH - 0.06, -0.02, CL + 0.04, CH + 0.04, CW + 0.04, c);           // roof
  B(ck, 0, 0.6, 0, 0.12, CH - 0.06, CW, c);                                     // rear wall
  for (const [x, z] of [[CL - 0.05, 0.03], [CL - 0.05, CW - 0.03], [0.62, CW - 0.03], [0.62, 0.03]]) B(ck, x - 0.04, 0.6, z - 0.03, x + 0.04, CH - 0.06, z + 0.03, pil);
  B(ck, CL - 0.03, 0.62, 0.05, CL - 0.01, CH - 0.08, CW - 0.05, glz);           // windscreen
  B(ck, 0.12, 0.62, CW - 0.02, CL - 0.08, CH - 0.08, CW, glz);                  // door + side glass
  B(ck, 0.12, 0.62, 0, CL - 0.08, CH - 0.08, 0.02, glz);
  B(ck, 0.9, 1.05, CW, 1.0, 1.1, CW + 0.04, chrome());                          // door handle
  mesh(cy(0.07, 0.07, 0.1, 10), lamp(0xff8a1a), 0.5, CH + 0.1, 0.5, ck);        // beacon
  B(ck, CL - 0.1, CH - 0.05, 0.25, CL + 0.02, CH + 0.06, 0.45, lamp());         // work light
  // boom and stick as tapered welded box sections, on pins so the machine can dig
  const bm = paint(color, 0.38, 0.35);
  const P0 = [0.9, 0.9, -0.25];
  const boom = new THREE.Group(); boom.position.set(...P0); up.add(boom);
  const b2 = [4.3, 1.3, 0];
  const prof = (k, pts, depth, m) => { const sh = new THREE.Shape(); pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); sh.closePath();
    return G(k, () => { const e = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 2 }); e.translate(0, 0, -depth / 2); return e; }); };
  mesh(prof('exBoom', [[-0.22, 0.22], [2.4, 2.9], [2.75, 2.85], [4.42, 1.5], [4.2, 1.1], [2.6, 2.15], [0.22, -0.22]], 0.46, bm), bm, 0, 0, 0, boom);
  member(up, [0.9, 0.3, -0.25], [1.9, 1.7, -0.25], 0.2, paint(0x2b2b2b, 0.5, 0.5), true);   // boom ram barrel
  member(boom, [0.35, 0.05, 0], [1.5, 1.5, 0], 0.13, chrome(), true);                        // boom ram rod
  member(boom, [2.2, 2.9, 0], [4.1, 1.9, 0], 0.12, chrome(), true);                          // stick ram
  const stick = new THREE.Group(); stick.position.set(...b2); boom.add(stick);
  mesh(prof('exStick', [[-0.2, 0.35], [0.22, 0.35], [0.45, -2.35], [0.15, -2.5]], 0.36, bm), bm, 0, 0, 0, stick);
  member(stick, [0.05, 0.3, 0], [0.32, -1.9, 0], 0.11, chrome(), true);                      // bucket ram
  const bucket = new THREE.Group(); bucket.position.set(0.3, -2.4, 0); stick.add(bucket);
  B(bucket, -0.55, -0.6, -0.55, 0.35, 0.1, 0.55, paint(0x303234, 0.6, 0.6));
  for (let k = -2; k <= 2; k++) B(bucket, 0.3, -0.62, k * 0.2 - 0.04, 0.5, -0.55, k * 0.2 + 0.04, steel());
  const load = B(bucket, -0.5, 0.05, -0.5, 0.3, 0.32, 0.5, paint(0x8a6a48, 1, 0)); load.visible = false;
  // handrails on the house, hydraulic hose runs along the boom and stick, cab door frame, steps
  const rail = paint(0x2b2b2b, 0.5, 0.5);
  for (const [a, e] of [[[-1.8, 1.25, -1.25], [0.0, 1.25, -1.25]], [[-1.8, 1.25, -1.25], [-1.8, 1.6, -1.25]], [[0.0, 1.25, -1.25], [0.0, 1.6, -1.25]], [[-1.8, 1.6, -1.25], [0.0, 1.6, -1.25]]]) member(up, a, e, 0.035, rail, true);
  const hose = paint(0x141414, 0.6, 0.1);
  for (const dz of [-0.12, 0.12]) { member(boom, [0.3, 0.35, dz], [2.45, 2.85, dz], 0.05, hose, true); member(boom, [2.45, 2.85, dz], [4.1, 1.75, dz], 0.05, hose, true); member(stick, [0.1, 0.1, dz], [0.25, -1.9, dz], 0.045, hose, true); }
  B(up, 0.35, -0.55, 1.3, 1.0, -0.5, 1.6, steel()); B(up, 0.35, -0.15, 1.3, 1.0, -0.1, 1.5, steel());
  g.userData.rig = { up, boom, stick, bucket, load };
  return g;
}

// One dig-and-load cycle, phase 0–1: crowd into the face, curl, lift, slew to the truck, dump, return.
export function poseExcavator(ex, phase, slewToTruck = 1.7) {
  const r = ex.userData.rig; if (!r) return;
  const f = phase % 1, sm = x => x * x * (3 - 2 * x), seg = (a, b) => sm(Math.min(1, Math.max(0, (f - a) / (b - a))));
  const dig = seg(0, 0.22), curl = seg(0.18, 0.32), lift = seg(0.3, 0.45), sl = seg(0.38, 0.6), dump = seg(0.6, 0.7), back = seg(0.72, 0.98);
  const out = 1 - back;
  r.up.rotation.y = slewToTruck * sl * out;
  r.boom.rotation.z = (-0.42 + 0.3 * (1 - dig)) * (1 - lift) + 0.18 * lift * out + (-0.12) * back;
  r.stick.rotation.z = (0.55 - 0.85 * dig) * (1 - lift) + (-0.1) * lift;
  r.bucket.rotation.z = 0.2 - 1.25 * curl * (1 - dump) + 0.9 * dump * out;
  r.load.visible = curl > 0.6 && dump < 0.4;
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
// Temporary site fence: 2.4 × 1.8 m galvanised mesh panels on rubber feet, coupled with clips,
// braced with stays, optionally clad in shade cloth (street frontage). Built along +x, 0 → len.
export function tempFence(len, { cloth = false, h = 1.8 } = {}) {
  const g = new THREE.Group();
  const PW = 2.4, n = Math.max(1, Math.round(len / PW)), pw = len / n;
  const galv = paint(0xb4b9bd, 0.45, 0.85);
  const wire = new THREE.InstancedMesh(bx(1, 1, 1), galv, n * 40);
  const tube = new THREE.InstancedMesh(cy(0.019, 0.019, 1, 8), galv, n * 4);
  const feet = new THREE.InstancedMesh(bx(0.6, 0.14, 0.22), paint(0x1b1d1f, 0.9, 0), n + 1);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const P = new THREE.Vector3(), S = new THREE.Vector3();
  let wi = 0, ti = 0;
  for (let i = 0; i < n; i++) {
    const x0 = i * pw + 0.03, x1 = (i + 1) * pw - 0.03;
    // frame: two uprights and top and bottom rails
    for (const x of [x0, x1]) { m4.compose(P.set(x, 0.12 + h / 2, 0), q, S.set(1, h, 1)); tube.setMatrixAt(ti++, m4); }
    for (const y of [0.18, h + 0.06]) { m4.compose(P.set((x0 + x1) / 2, y, 0), qz, S.set(1, x1 - x0, 1)); tube.setMatrixAt(ti++, m4); }
    // mesh: 4 mm wires at ~200 × 300
    const nv = Math.round((x1 - x0) / 0.2);
    for (let k = 1; k < nv; k++) { m4.compose(P.set(x0 + k * (x1 - x0) / nv, 0.12 + h / 2, 0), q, S.set(0.005, h - 0.1, 0.005)); wire.setMatrixAt(wi++, m4); }
    for (let k = 1; k < 7; k++) { m4.compose(P.set((x0 + x1) / 2, 0.18 + k * (h - 0.12) / 7, 0), q, S.set(x1 - x0, 0.005, 0.005)); wire.setMatrixAt(wi++, m4); }
  }
  for (let i = 0; i <= n; i++) { m4.compose(P.set(i * pw, 0.07, 0), q, S.set(1, 1, 1)); feet.setMatrixAt(i, m4); }
  wire.count = wi; tube.count = ti;
  for (const o of [wire, tube, feet]) { o.castShadow = true; o.receiveShadow = true; o.userData.keepLook = true; g.add(o); }
  // stays every third panel, on the inside
  for (let i = 1; i < n; i += 3) member(g, [i * pw, 1.5, 0], [i * pw, 0.05, 1.1], 0.035, galv.clone(), true);
  if (cloth) {
    const cm = new THREE.MeshStandardMaterial({ color: 0x1f2e26, roughness: 0.95, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
    const c = mesh(new THREE.PlaneGeometry(len - 0.1, h - 0.15), cm, len / 2, 0.12 + h / 2 + 0.02, -0.03, g);
    c.userData.keepLook = true;
  }
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
const cap = (r, l) => G(`cap${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 10));
export function worker(vest = 0xf6d31c, hat = 0xf5f5f2, pose = 0) {
  const g = new THREE.Group();
  const pants = paint(0x2c3540, 0.9, 0), shirt = paint(0x1f3d63, 0.9, 0), skin = paint(0xc08a66, 0.65, 0), v = paint(vest, 0.6, 0), boot = paint(0x2a2018, 0.75, 0);
  const tape = paint(0xdfe3e6, 0.2, 0.7);
  const stride = pose === 1 ? 0.32 : 0;
  // legs: thigh and shin with a slight knee bend when walking, boots
  for (const sd of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0, 0.92, sd * 0.1); hip.rotation.z = sd * stride; g.add(hip);
    mesh(cap(0.078, 0.36), pants, 0, -0.22, 0, hip);
    const knee = new THREE.Group(); knee.position.y = -0.44; knee.rotation.z = pose === 1 ? Math.max(0, -sd) * 0.3 : 0; hip.add(knee);
    mesh(cap(0.066, 0.34), pants, 0, -0.21, 0, knee);
    B(knee, -0.08, -0.48, -0.06, 0.17, -0.38, 0.06, boot);
    B(knee, 0.08, -0.48, -0.065, 0.19, -0.44, 0.065, paint(0x4a3a2a, 0.6, 0));            // steel toe cap
  }
  const torso = new THREE.Group(); torso.position.y = 0.95; if (pose === 2) torso.rotation.z = -0.7; g.add(torso);
  mesh(G('torso', () => { const t = new THREE.CapsuleGeometry(0.16, 0.32, 4, 12); t.scale(0.78, 1, 1.22); return t; }), shirt, 0, 0.3, 0, torso);   // long-sleeve shirt, wider than deep
  // hi-vis vest: slightly proud of the shirt, with two hoops of reflective tape and shoulder straps
  mesh(G('vest', () => { const c = new THREE.CylinderGeometry(0.172, 0.168, 0.5, 16, 1, true); c.scale(0.82, 1, 1.24); return c; }), v, 0, 0.3, 0, torso).material.side = THREE.DoubleSide;
  for (const y of [0.14, 0.32]) mesh(G('tape', () => { const c = new THREE.CylinderGeometry(0.176, 0.176, 0.045, 16, 1, true); c.scale(0.83, 1, 1.25); return c; }), tape, 0, y, 0, torso);
  for (const sd of [-1, 1]) B(torso, -0.1, 0.5, sd * 0.1 - 0.035, 0.1, 0.6, sd * 0.1 + 0.035, v);
  // arms: upper arm, forearm and hand
  for (const sd of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(0, 0.55, sd * 0.215); sh.rotation.z = pose === 1 ? -sd * 0.35 : 0.06; sh.rotation.x = sd * 0.08; torso.add(sh);
    mesh(cap(0.052, 0.22), shirt, 0, -0.14, 0, sh);
    const el = new THREE.Group(); el.position.y = -0.3; el.rotation.z = pose === 2 ? 0.6 : 0.15; sh.add(el);
    mesh(cap(0.045, 0.2), shirt, 0, -0.13, 0, el);
    mesh(G('hand', () => new THREE.SphereGeometry(0.048, 10, 8)), paint(0x6b5b3e, 0.8, 0), 0, -0.29, 0, el);   // rigger gloves
  }
  // neck, head, glasses, hard hat with brim
  mesh(cy(0.05, 0.055, 0.08, 10), skin, 0, 0.67, 0, torso);
  mesh(G('head2', () => { const h = new THREE.SphereGeometry(0.1, 16, 12); h.scale(1, 1.15, 0.95); return h; }), skin, 0, 0.79, 0, torso);
  B(torso, 0.07, 0.79, -0.075, 0.105, 0.82, 0.075, paint(0x15181a, 0.1, 0.6));
  mesh(G('hat2', () => new THREE.SphereGeometry(0.125, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), paint(hat, 0.3, 0), 0, 0.845, 0, torso);
  const brim = mesh(G('brim', () => { const c = new THREE.CylinderGeometry(0.15, 0.155, 0.015, 20); c.scale(1.18, 1, 1); return c; }), paint(hat, 0.3, 0), 0.025, 0.845, 0, torso);
  return g;
}

// Car (sedan / SUV) from side profiles: body to the belt line, glazed cabin, roof. Length along +x.
export function car(color = 0x8a9aa8, type = 'sedan') {
  const g = new THREE.Group();
  const suv = type === 'suv', belt = suv ? 1.06 : 0.96, top = suv ? 1.7 : 1.44, w = 1.86;
  const ext = (k, pts, depth, m, y = 0, bev = 0.05) => {
    const sh = new THREE.Shape(); pts.forEach(([x, yy], i) => i ? sh.lineTo(x, yy) : sh.moveTo(x, yy)); sh.closePath();
    const geo2 = G(k, () => { const e = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelSegments: 3, curveSegments: 6 }); e.translate(0, 0, -depth / 2); return e; });
    return mesh(geo2, m, 0, y, 0, g);
  };
  const body = paint(color, 0.18, 0.7);
  ext('carB' + type, [[-2.3, 0.32], [-2.36, 0.78], [-2.12, belt], [suv ? 1.35 : 1.2, belt], [2.28, suv ? 0.9 : 0.8], [2.38, 0.46], [2.25, 0.32]], w - 0.12, body);
  const gl = new THREE.MeshStandardMaterial({ color: 0x52636e, roughness: 0.04, metalness: 0.9 });
  const cab = suv ? [[-2.12, belt], [-2.02, top - 0.04], [0.95, top], [1.55, belt]] : [[-1.95, belt], [-1.2, top - 0.02], [0.55, top], [1.3, belt]];
  ext('carG' + type, cab, w - 0.34, gl, 0, 0.02);
  const roof = suv ? [[-2.0, top - 0.06], [0.9, top - 0.02], [0.88, top + 0.03], [-2.0, top - 0.01]] : [[-1.18, top - 0.04], [0.52, top - 0.02], [0.5, top + 0.02], [-1.15, top]];
  ext('carR' + type, roof, w - 0.3, body, 0, 0.02);
  // pillars
  for (const sd of [-1, 1]) for (const [x0, x1] of suv ? [[0.9, 1.55], [-0.45, -0.35], [-2.05, -1.95]] : [[0.5, 1.3], [-0.35, -0.25]])
    member(g, [x1, belt, sd * (w / 2 - 0.19)], [x0, top - 0.02, sd * (w / 2 - 0.19)], 0.07, body);
  // wheels in the arches, lights, grille, mirrors
  for (const [x, sd] of [[-1.42, 1], [1.42, 1], [-1.42, -1], [1.42, -1]]) {
    const wh = wheel(0.35, 0.24, 0x9ca3a8); wh.position.set(x, 0.35, sd * 0.8); g.add(wh);
  }
  for (const sd of [-1, 1]) {
    B(g, 2.28, 0.66, sd * 0.62 - 0.17, 2.4, 0.76, sd * 0.62 + 0.17, lamp());
    B(g, -2.42, 0.74, sd * 0.6 - 0.2, -2.33, 0.84, sd * 0.6 + 0.2, lamp(0xb3121b));
    B(g, 1.25, belt - 0.02, sd * (w / 2 + 0.08) - 0.05, 1.42, belt + 0.1, sd * (w / 2 + 0.08) + 0.05, body);
  }
  B(g, 2.36, 0.46, -0.45, 2.42, 0.62, 0.45, paint(0x1a1b1d, 0.4, 0.6));
  return g;
}

// Foliage clump: n small leaf sprays scattered through a unit ellipsoid, mostly near its skin.
// Real geometry (no alpha cut-outs), so shadows and ambient occlusion fall through the canopy
// properly. Normals lean outward from the clump centre, which shades the mass softly like a
// real canopy; colours vary leaf to leaf, darker inside, lighter where the top catches the sun.
export function leafClump(n = 600, seed = 1, size = 0.15) {
  return G(`leaf${n},${seed},${size}`, () => {
    let a = seed * 7919 + 17; const r = () => ((a = (a * 16807) % 2147483647) / 2147483647);
    const pos = new Float32Array(n * 12 * 3), nor = new Float32Array(n * 12 * 3), col = new Float32Array(n * 12 * 3);
    const base = [[0.085, 0.15, 0.05], [0.1, 0.17, 0.055], [0.07, 0.125, 0.045], [0.12, 0.19, 0.065], [0.11, 0.15, 0.06]];   // linear albedo of glossy evergreen leaves
    const v = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), nn = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      // point in the ellipsoid, biased to the outer shell, flatter underneath
      v.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1); if (v.lengthSq() < 1e-4) v.set(0, 1, 0);
      v.normalize().multiplyScalar(1 - 0.5 * Math.pow(r(), 2.2));
      v.y *= v.y < 0 ? 0.55 : 0.85;
      nn.copy(v).normalize();
      const lean = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.1); nn.add(lean).normalize();   // each leaf tilts its own way
      // leaf plane: roughly facing out and up, randomly rolled
      t1.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1); t1.addScaledVector(nn, -t1.dot(nn)); if (t1.lengthSq() < 1e-4) t1.crossVectors(nn, up); t1.normalize();
      t2.crossVectors(nn, t1).normalize();
      const L = size * (0.75 + r() * 0.6), W = L * 0.55;
      const tip = v.clone().addScaledVector(t1, L), tail = v.clone().addScaledVector(t1, -L * 0.6);
      const sideA = v.clone().addScaledVector(t2, W).addScaledVector(nn, 0.02), sideB = v.clone().addScaledVector(t2, -W).addScaledVector(nn, 0.02);
      // both windings, same outward normal: lit the same from either side (no black backs)
      const tri = [tail, sideA, tip, tail, tip, sideB, tail, tip, sideA, tail, sideB, tip];
      const c = base[(r() * base.length) | 0], depth = v.length(), sunny = Math.max(0, v.y) * 0.35;
      const k = (0.62 + 0.45 * depth) * (0.75 + r() * 0.5);
      for (let j = 0; j < 12; j++) {
        const o = (i * 12 + j) * 3; pos[o] = tri[j].x; pos[o + 1] = tri[j].y; pos[o + 2] = tri[j].z;
        nor[o] = nn.x; nor[o + 1] = nn.y; nor[o + 2] = nn.z;
        col[o] = c[0] * k + sunny * 0.05; col[o + 1] = c[1] * k + sunny * 0.07; col[o + 2] = c[2] * k + sunny * 0.02;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeBoundingSphere(); return g;
  });
}
export const leafMaterial = () => new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.55, metalness: 0 });

// Pōhutukawa-style tree: short trunk splitting into spreading limbs, with a broad dome of leaf clumps.
export function tree(scale = 1, seed = 1) {
  const g = new THREE.Group();
  let a = seed * 9301 + 49297; const r = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
  const bark = paint(0x4f4034, 0.95, 0);
  member(g, [0, 0, 0], [0.1 * scale, 1.9 * scale, 0], 0.36 * scale, bark, true);
  mesh(cy(0.3 * scale, 0.42 * scale, 0.35 * scale, 12), bark, 0, 0.17 * scale, 0, g);            // root flare
  const clumps = [];
  const nb = 4 + ((r() * 2) | 0);
  for (let k = 0; k < nb; k++) {
    const ang = k / nb * Math.PI * 2 + r() * 0.6, len = (1.6 + r() * 1.1) * scale;
    const mid = [Math.cos(ang) * len * 0.5, (2.6 + r() * 0.6) * scale, Math.sin(ang) * len * 0.5];
    const top = [Math.cos(ang) * len, (3.4 + r() * 1.0) * scale, Math.sin(ang) * len];
    member(g, [0.1 * scale, 1.8 * scale, 0], mid, 0.2 * scale, bark, true);
    member(g, mid, top, 0.13 * scale, bark, true);
    clumps.push([top[0], top[1] + 0.5 * scale, top[2], (1.25 + r() * 0.4) * scale]);
    clumps.push([mid[0] * 1.3, mid[1] + 0.9 * scale, mid[2] * 1.3, (1.1 + r() * 0.3) * scale]);
  }
  for (let j = 0; j < 4; j++) { const an = r() * 6.28, d = r() * 0.9 * scale; clumps.push([Math.cos(an) * d, (4.3 + r() * 0.8) * scale, Math.sin(an) * d, (1.35 + r() * 0.4) * scale]); }
  const im = new THREE.InstancedMesh(leafClump(700, 1 + (seed % 4)), leafMaterial(), clumps.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  clumps.forEach(([x, y, z, sc], i) => { q.setFromEuler(new THREE.Euler(0, r() * 6.28, 0)); m4.compose(P.set(x, y, z), q, S.set(sc * 1.15, sc * 0.8, sc * 1.15)); im.setMatrixAt(i, m4); });
  im.castShadow = true; im.receiveShadow = true; im.userData.keepLook = true; g.add(im);
  return g;
}
