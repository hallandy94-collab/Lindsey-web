// Loose furniture, soft furnishings and styling for a finished Goldie Street house, placed
// to the AD-11 LG plan (bed 4 / office, bed 3, media, east terrace) and the indicative L1
// (living, dining, kitchen) and L2 (master, bed 2, roof terrace) layouts. House-local
// coordinates: x from the north party wall (0 → 7.25), z from grid G, y from LG FFL.

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';

const L1 = 3.23, L2 = 6.46;
const cache = new Map();
const rb = (w, h, d, r = 0.04) => { const k = `${w}|${h}|${d}|${r}`; if (!cache.has(k)) cache.set(k, new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.99)); return cache.get(k); };
const cyl = (rt, rb2, h, s = 20) => { const k = `c${rt}|${rb2}|${h}|${s}`; if (!cache.has(k)) cache.set(k, new THREE.CylinderGeometry(rt, rb2, h, s)); return cache.get(k); };
const M = (color, rough = 0.8, metal = 0, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }); return m; };
const F = {
  linen: () => M(0xd8d0c2, 0.95), oat: () => M(0xc9bca6, 0.95), charcoal: () => M(0x3a3c40, 0.95), sage: () => M(0x8c9a84, 0.95),
  walnut: () => M(0x5a4231, 0.55), oak: () => M(0xb89468, 0.55), black: () => M(0x1c1d1f, 0.4, 0.6), brass: () => M(0xb4935a, 0.3, 0.9),
  leather: () => M(0x7c4f33, 0.6), white: () => M(0xf2f1ec, 0.7), marble: () => M(0xeeece7, 0.2), rug: () => M(0xb7ad9c, 1), rug2: () => M(0x6f6a64, 1),
  leaf: () => M(0x3f6a35, 0.9), pot: () => M(0x9a8c7c, 0.85), sheer: () => M(0xf4f2ee, 0.9, 0, { transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  art: c => M(c, 0.8), glow: () => M(0xfff4dc, 0.4, 0, { emissive: 0xffe2b0, emissiveIntensity: 0.9 }),
};
function put(parent, geo, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true;
  m.userData.keepLook = true; parent.add(m); return m;
}
const grp = (parent, x, y, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; };

// ------------------------------------------------------------------ pieces (built along +x = width, +z = depth)
function bed(p, x, y, z, ry, w = 1.6, l = 2.1) {
  const g = grp(p, x, y, z, ry);
  put(g, rb(w + 0.1, 0.32, l, 0.03), F.walnut(), 0, 0.16, 0);                      // base
  put(g, rb(w, 0.24, l - 0.1, 0.08), F.white(), 0, 0.44, 0.02);                      // mattress & sheet
  put(g, rb(w + 0.02, 0.08, l * 0.55, 0.04), F.oat(), 0, 0.58, l * 0.2);             // throw
  put(g, rb(w + 0.3, 1.1, 0.1, 0.03), F.linen(), 0, 0.55, -l / 2 - 0.02);             // upholstered bedhead
  for (const s of [-1, 1]) {
    put(g, rb(0.62, 0.16, 0.38, 0.07), F.white(), s * w * 0.25, 0.64, -l / 2 + 0.3);  // pillows
    put(g, rb(0.5, 0.5, 0.4, 0.02), F.walnut(), s * (w / 2 + 0.4), 0.25, -l / 2 + 0.25); // bedside
    put(g, cyl(0.1, 0.13, 0.28), F.linen(), s * (w / 2 + 0.4), 0.64, -l / 2 + 0.25);    // lamp shade
    put(g, cyl(0.05, 0.05, 0.02), F.glow(), s * (w / 2 + 0.4), 0.51, -l / 2 + 0.25);
  }
  return g;
}
function sofa(p, x, y, z, ry, w = 2.6, col = F.oat) {
  const g = grp(p, x, y, z, ry);
  put(g, rb(w, 0.42, 0.95, 0.06), col(), 0, 0.21, 0);
  put(g, rb(w, 0.4, 0.22, 0.08), col(), 0, 0.6, -0.36);
  for (const s of [-1, 1]) put(g, rb(0.2, 0.25, 0.9, 0.08), col(), s * (w / 2 - 0.1), 0.52, 0);
  const n = Math.max(2, Math.round(w / 0.9));
  for (let i = 0; i < n; i++) put(g, rb((w - 0.4) / n - 0.02, 0.14, 0.72, 0.06), col(), -w / 2 + 0.2 + (i + 0.5) * (w - 0.4) / n, 0.48, 0.08);
  put(g, rb(0.42, 0.42, 0.14, 0.06), F.sage(), -w / 2 + 0.45, 0.66, -0.2, 0.2);
  put(g, rb(0.42, 0.42, 0.14, 0.06), F.charcoal(), w / 2 - 0.45, 0.66, -0.2, -0.2);
  return g;
}
function armchair(p, x, y, z, ry, col = F.leather) {
  const g = grp(p, x, y, z, ry);
  put(g, rb(0.78, 0.4, 0.8, 0.08), col(), 0, 0.3, 0);
  put(g, rb(0.78, 0.45, 0.16, 0.07), col(), 0, 0.62, -0.33);
  for (const s of [-1, 1]) put(g, cyl(0.015, 0.015, 0.12, 6), F.black(), s * 0.32, 0.06, 0.3);
  return g;
}
function table(p, x, y, z, ry, w, d, h = 0.74, top = F.oak, n = 0) {
  const g = grp(p, x, y, z, ry);
  put(g, rb(w, 0.04, d, 0.01), top(), 0, h - 0.02, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(g, rb(0.05, h - 0.04, 0.05, 0.01), F.black(), sx * (w / 2 - 0.1), (h - 0.04) / 2, sz * (d / 2 - 0.1));
  // chairs around a dining table
  for (let i = 0; i < n; i++) {
    const side = i < n / 2 ? -1 : 1, k = i % (n / 2), cx = -w / 2 + (k + 0.5) * w / (n / 2);
    const c = grp(g, cx, 0, side * (d / 2 + 0.28), side > 0 ? Math.PI : 0);
    put(c, rb(0.46, 0.06, 0.46, 0.02), F.linen(), 0, 0.46, 0);
    put(c, rb(0.46, 0.4, 0.05, 0.02), F.walnut(), 0, 0.7, -0.2);
    for (const [a, b] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) put(c, cyl(0.015, 0.015, 0.44, 6), F.black(), a, 0.22, b);
  }
  return g;
}
function stool(p, x, y, z) { const g = grp(p, x, y, z); put(g, cyl(0.19, 0.19, 0.05), F.leather(), 0, 0.68, 0); put(g, cyl(0.02, 0.02, 0.66, 8), F.brass(), 0, 0.33, 0); put(g, cyl(0.18, 0.18, 0.02), F.brass(), 0, 0.01, 0); return g; }
function rug(p, x, y, z, w, d, col = F.rug) { return put(p, rb(w, 0.015, d, 0.005), col(), x, y + 0.028, z); }
function plant(p, x, y, z, s = 1) {
  // harakeke (NZ flax) in a planter: long tapering blades fanning out
  const g = grp(p, x, y, z);
  put(g, cyl(0.24 * s, 0.19 * s, 0.45 * s, 20), F.pot(), 0, 0.225 * s, 0);
  put(g, cyl(0.22 * s, 0.22 * s, 0.02, 20), M(0x3b2c20, 1), 0, 0.44 * s, 0);
  const blade = cache.get('blade') || (() => { const sh = new THREE.Shape(); sh.moveTo(-0.035, 0); sh.quadraticCurveTo(-0.03, 0.6, 0, 1); sh.quadraticCurveTo(0.03, 0.6, 0.035, 0); sh.closePath(); const b = new THREE.ShapeGeometry(sh, 6); cache.set('blade', b); return b; })();
  const bm = M(0x4f6b3a, 0.7, 0, { side: THREE.DoubleSide });
  for (let k = 0; k < 16; k++) {
    const a = k * 2.4, len = (0.9 + (k % 5) * 0.12) * s;
    const m = put(g, blade, bm, 0, 0.44 * s, 0, a); m.scale.set(1.2 * s, len, 1);
    m.rotation.order = 'YXZ'; m.rotation.x = -(0.12 + (k % 4) * 0.1); m.castShadow = true;
  }
  return g;
}
function pendant(p, x, y, z, drop = 0.9) {
  const g = grp(p, x, y, z);
  put(g, cyl(0.004, 0.004, drop, 4), F.black(), 0, -drop / 2, 0);
  put(g, new THREE.SphereGeometry(0.16, 20, 12), M(0xfff6e6, 0.3, 0, { emissive: 0xffe3b5, emissiveIntensity: 1.2, transparent: true, opacity: 0.95 }), 0, -drop - 0.12, 0);
  return g;
}
function art(p, x, y, z, ry, w, h, c) { const g = grp(p, x, y, z, ry); put(g, rb(w + 0.06, h + 0.06, 0.03, 0.005), F.black(), 0, 0, 0); put(g, rb(w, h, 0.01, 0.002), F.art(c), 0, 0, 0.016); return g; }
function tv(p, x, y, z, ry) { const g = grp(p, x, y, z, ry); put(g, rb(1.45, 0.83, 0.04, 0.01), M(0x0c0d0f, 0.15, 0.4), 0, 1.35, 0); put(g, rb(2.2, 0.45, 0.42, 0.02), F.walnut(), 0, 0.225, 0.2); return g; }
function sheer(p, x0, x1, y, z, h = 2.7) { const w = x1 - x0; const m = put(p, new THREE.PlaneGeometry(w, h - 0.05, Math.max(2, Math.round(w * 6)), 1), F.sheer(), (x0 + x1) / 2, y + h / 2, z); const pos = m.geometry.attributes.position; for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 18) * 0.03); m.geometry.computeVertexNormals(); m.castShadow = false; return m; }
function lounger(p, x, y, z, ry) { const g = grp(p, x, y, z, ry); put(g, rb(0.7, 0.12, 1.9, 0.03), F.white(), 0, 0.3, 0); const b = put(g, rb(0.7, 0.1, 0.75, 0.03), F.white(), 0, 0.55, -0.7); b.rotation.x = -0.9; put(g, rb(0.72, 0.06, 1.95, 0.02), F.walnut(), 0, 0.2, 0); return g; }
function umbrella(p, x, y, z) { const g = grp(p, x, y, z); put(g, cyl(0.02, 0.02, 2.4, 8), F.black(), 0, 1.2, 0); put(g, new THREE.ConeGeometry(1.4, 0.35, 16, 1, true), M(0xe9e3d6, 0.9, 0, { side: THREE.DoubleSide }), 0, 2.3, 0); put(g, cyl(0.3, 0.3, 0.06), F.black(), 0, 0.03, 0); return g; }

// ------------------------------------------------------------------ one house
export function furnishHouse(root, h = 0) {
  const g = new THREE.Group(); g.name = 'furniture'; root.add(g);
  const tint = [0x7f93a3, 0xb5703f, 0x3f5b4a, 0xc9a44c, 0x8a3b2e][h % 5];
  // ---- LG (AD-11)
  bed(g, 5.0, 0, 4.0, Math.PI, 1.6, 2.05);                       // bed 4 / office: bedhead on the gallery wall
  table(g, 2.6, 0, 1.75, 0, 1.2, 0.6, 0.74, F.walnut);            // desk at the west terrace glazing
  armchair(g, 2.4, 0, 2.6, Math.PI, F.leather);
  rug(g, 5.0, 0, 2.7, 2.4, 2.8);
  art(g, 1.62, 1.55, 3.9, Math.PI / 2, 0.8, 1.0, tint);
  bed(g, 6.1, 0, 15.9, -Math.PI / 2, 1.5, 2.0);                   // bed 3: bedhead on the south party wall
  rug(g, 5.5, 0, 15.9, 2.2, 2.6, F.rug2);
  plant(g, 4.1, 0, 17.4, 1);
  sofa(g, 0.55, 0, 14.6, Math.PI / 2, 3.2, F.charcoal);           // media: sofa on the north party wall
  armchair(g, 2.8, 0, 16.9, Math.PI + 0.5, F.oat);
  put(g, cyl(0.45, 0.45, 0.36, 32), F.walnut(), 1.9, 0.18, 14.6); // round coffee table
  rug(g, 1.8, 0, 14.6, 2.6, 3.4);
  tv(g, 3.62, 0, 14.6, -Math.PI / 2);
  plant(g, 0.5, 0, 12.0, 0.9);
  art(g, 3.73, 1.5, 6.9, -Math.PI / 2, 1.2, 0.9, tint);            // gallery, on the bath wall
  art(g, 0.02, 1.5, 4.2, Math.PI / 2, 0.7, 0.9, 0x2d3b45);            // entry
  put(g, rb(0.6, 0.85, 0.6, 0.02), F.white(), 6.55, 0.425, 12.8); // washer
  put(g, rb(0.6, 0.85, 0.6, 0.02), F.white(), 5.9, 0.425, 12.8);
  // east terrace: outdoor dining setting (the outdoor kitchen and spiral stair are in the building model)
  table(g, 2.4, 0, 18.9, 0, 1.8, 0.9, 0.74, F.oak, 6);
  plant(g, 4.2, 0, 19.6, 1.2);
  // west terrace
  plant(g, 6.7, 0, 0.5, 1.1); plant(g, 2.2, 0, 0.5, 0.8);
  // ---- L1 (indicative): living to the street, dining, kitchen to the rear
  const y1 = L1;
  sofa(g, 3.6, y1, 2.6, -Math.PI / 2, 2.8, F.oat);                // faces the fire on the north wall
  armchair(g, 1.6, y1, 0.9, Math.PI * 0.15, F.leather); armchair(g, 1.6, y1, 4.3, Math.PI * 0.85, F.leather);
  put(g, rb(1.2, 0.36, 0.7, 0.03), F.walnut(), 2.2, y1 + 0.18, 2.6);
  rug(g, 2.4, y1, 2.6, 3.2, 3.6);
  art(g, 0.02, y1 + 1.8, 2.6, Math.PI / 2, 1.4, 0.9, tint);
  plant(g, 6.6, y1, 0.7, 1.3); plant(g, 0.6, y1, 5.2, 1);
  table(g, 3.4, y1, 7.8, 0, 2.2, 1.0, 0.74, F.oak, 6);            // dining
  for (const x of [2.8, 4.0]) pendant(g, x, y1 + 2.7, 7.8, 1.0);
  for (const x of [3.0, 3.7, 4.4]) stool(g, x, y1, 16.0);         // island stools on the garden side
  for (const x of [3.2, 4.3]) pendant(g, x, y1 + 2.7, 14.5, 0.85);
  put(g, rb(0.5, 0.3, 0.35, 0.03), F.walnut(), 3.8, y1 + 0.95, 14.2); // fruit bowl / styling
  sheer(g, 0.2, 7.05, y1, 0.12);                                   // sheers to the street glazing
  // ---- L2 (indicative): master, bed 2, roof terrace
  const y2 = L2;
  bed(g, 3.4, y2, 3.45, Math.PI, 1.8, 2.1);                        // master: bedhead on the hall wall
  armchair(g, 1.3, y2, 1.2, Math.PI * 0.2, F.oat);
  rug(g, 3.4, y2, 2.4, 3.0, 2.8, F.rug);
  art(g, 7.23, y2 + 1.6, 2.4, -Math.PI / 2, 1.0, 1.2, tint);
  sheer(g, 0.2, 7.05, y2, 0.3);
  bed(g, 2.4, y2, 13.1, Math.PI / 2, 1.2, 2.0);                   // bed 2
  plant(g, 5.8, y2, 13.6, 0.9);
  lounger(g, 2.2, y2, 16.1, Math.PI / 2); lounger(g, 3.3, y2 + 0.001, 16.1, Math.PI / 2);
  umbrella(g, 5.6, y2, 16.2);
  for (const x of [0.6, 6.7]) plant(g, x, y2, 17.3, 1.1);
  return g;
}

// pool-court furniture for the building model (per house, world x of the house's north party wall)
export function poolFurniture(parent, hx, podiumY, poolZ1) {
  const g = new THREE.Group(); parent.add(g);
  lounger(g, hx + 3.6, podiumY + 0.18, poolZ1 + 1.0, Math.PI / 2);
  lounger(g, hx + 5.0, podiumY + 0.18, poolZ1 + 1.0, Math.PI / 2);
  umbrella(g, hx + 6.6, podiumY + 0.18, poolZ1 + 1.1);
  return g;
}
