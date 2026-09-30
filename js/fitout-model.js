// One Goldie Street terrace house (LG + L1 + L2), built for the fitout sequence.
// Axes: x across the house between party walls (0 at the north party-wall face → W at
// the south one), z from the street facade (0, grid G) to the rear (17.9, grid C), y from
// LG FFL. Shell to HAL AD-06 / AD-10 / AD-11 Rev D: 7.4 m party-wall centres, 17.9 m LG / L1
// plates, 14.2 m L2 plate (525 m² / 37 m) with a rear roof terrace, 3.23 m floor-to-floor.
// LG rooms follow AD-11: recessed west terrace (G–F), entry porch, bed 4 / office, gallery,
// bath 1, coats, straight stair + lift on the south party wall, laundry, bed 3, media, east
// terrace with the external spiral stair. L1 / L2 layouts are INDICATIVE (plans not in the pack).

import * as THREE from 'three';

export const W = 7.25;            // clear width between party walls
export const DEPTH = 17.9, DEPTH2 = 14.2;
export const LEVELS = [
  { id: 'LG', y: 0, depth: DEPTH },
  { id: 'L1', y: 3.23, depth: DEPTH },
  { id: 'L2', y: 6.46, depth: DEPTH2 },
];
export const ROOF_Y = 9.49;
const CEIL = 2.7;                  // ceiling lining height above FFL
export const LIFT = { x0: 6.15, x1: 7.1, z0: 10.55, z1: 11.75 };
export const FRONT_LG = 1.1;       // LG facade set back to grid F behind the west terrace
export const PORCH = [0, 1.1, 1.6, 3.3];
// straight stairs, stacked scissor-fashion on the south party wall, then across to the north wall
export const FLIGHTS = [
  { id: 'B', x0: 6.05, x1: 7.2, zBot: 5.3, zTop: 9.3, yBot: -2.79, yTop: 0, n: 13 },     // L0 → LG (precast, AD-10/11 south wall, lands by the lift)
  { id: 'F1', x0: 0.15, x1: 1.25, zBot: 6.0, zTop: 10.3, yBot: 0, yTop: 3.23, n: 15 },   // LG → L1 (open stair in the gallery, north wall)
  { id: 'F2', x0: 6.05, x1: 7.2, zBot: 9.3, zTop: 5.3, yBot: 3.23, yTop: 6.46, n: 15 },  // L1 → L2 (south wall, over the basement flight)
];
// slab openings under each level (stair wells) and the lift shaft
export const SLAB_HOLES = { LG: [6.0, 5.2, W, 9.4], L1: [0.05, 5.9, 1.4, 10.4], L2: [6.0, 5.2, W, 9.4] };
export const LIFT_HOLE = [LIFT.x0 - 0.15, LIFT.z0 - 0.15, W, LIFT.z1 + 0.15];
// legacy names used by the building model
export const STAIR_HOLE = SLAB_HOLES.L2;
export const BSTAIR_HOLE = SLAB_HOLES.LG;
// rectangle minus holes → list of rectangles [x0, z0, x1, z1]
export function rectMinus(r, holes) {
  let out = [r];
  for (const [hx0, hz0, hx1, hz1] of holes) {
    const next = [];
    for (const [x0, z0, x1, z1] of out) {
      if (hx1 <= x0 || hx0 >= x1 || hz1 <= z0 || hz0 >= z1) { next.push([x0, z0, x1, z1]); continue; }
      if (hz0 > z0) next.push([x0, z0, x1, hz0]);
      if (hz1 < z1) next.push([x0, hz1, x1, z1]);
      const zz0 = Math.max(z0, hz0), zz1 = Math.min(z1, hz1);
      if (hx0 > x0) next.push([x0, zz0, hx0, zz1]);
      if (hx1 < x1) next.push([hx1, zz0, x1, zz1]);
    }
    out = next;
  }
  return out.filter(([a, b, c, d]) => c - a > 0.01 && d - b > 0.01);
}

// walls: [x0, z0, x1, z1, doorStart?] – door gaps are 0.85 wide along the wall
const WALLS = {
  LG: [[1.6, 1.1, 1.6, 5.1], [0, 3.3, 1.6, 3.3, 0.4], [1.6, 5.1, 6.0, 5.1, 2.8], [3.75, 5.1, 3.75, 8.5, 5.4], [3.75, 8.5, 6.0, 8.5],
       [3.75, 9.1, 6.0, 9.1, 4.6], [6.0, 5.1, 6.0, 9.1], [0, 11.3, 1.1, 11.3], [3.75, 11.3, 3.75, 13.6, 12.4], [3.75, 13.6, 3.75, DEPTH],
       [5.1, 11.9, W, 11.9], [5.1, 11.9, 5.1, 13.6, 12.5], [3.75, 13.6, W, 13.6, 4.0]],
  L1: [[5.1, 12.0, W, 12.0], [5.1, 12.0, 5.1, 14.2, 13.2], [5.1, 14.2, W, 14.2]],
  L2: [[0, 4.6, W, 4.6, 5.0], [3.6, 4.6, 3.6, 9.0, 6.3], [3.6, 9.0, 3.6, 12.0, 10.0], [0, 9.0, 3.6, 9.0], [0, 12.0, W, 12.0, 4.2]],
};
// wet rooms
const WET = {
  LG: [{ name: 'Bath 1', x0: 3.75, z0: 5.1, x1: 6.0, z1: 8.5, wc: [5.65, 6.9], basin: [4.45, 5.45], shower: [3.8, 7.3, 5.95, 8.45] },
       { name: 'Laundry', x0: 5.1, z0: 11.9, x1: W, z1: 13.6, basin: [6.0, 13.3] }],
  L1: [{ name: 'Powder', x0: 5.1, z0: 12.0, x1: W, z1: 14.2, wc: [6.9, 13.8], basin: [5.9, 12.3] }],
  L2: [{ name: 'Ensuite', x0: 0, z0: 4.6, x1: 3.6, z1: 9.0, wc: [3.2, 6.9], basin: [1.0, 4.9], basin2: [2.2, 4.9], shower: [0.05, 7.2, 1.6, 8.95], bath: [1.8, 8.1, 3.5, 8.9] }],
};
const CARPET = { LG: [[1.6, 1.1, W, 5.1], [3.75, 13.6, W, DEPTH], [0, 11.3, 3.75, DEPTH]], L2: [[0, 0, W, 4.6], [0, 12.0, W, DEPTH2]] };
const OAK = {
  LG: [[0, 3.3, 1.6, 5.1], [0, 5.1, 3.75, 11.3], [3.75, 9.1, 6.0, 11.9], [3.75, 11.3, 5.1, 13.6]],
  L1: [[0, 0, W, 12.0], [0, 12.0, 5.1, DEPTH], [5.1, 14.2, W, DEPTH]],
  L2: [[3.6, 4.6, W, 12.0], [0, 9.0, 3.6, 12.0]],
};
const FLOOR_HOLES = { LG: [SLAB_HOLES.LG, LIFT_HOLE], L1: [SLAB_HOLES.L1, LIFT_HOLE], L2: [SLAB_HOLES.L2, LIFT_HOLE] };
export const ROOMS = {
  LG: [['West tce', 4.4, 0.55], ['Entry', 0.8, 4.2], ['Bed 4 / office', 4.4, 3.1], ['Bath 1', 4.9, 6.6], ['Gallery', 2.0, 8.0], ['Laundry', 6.2, 12.7], ['Bed 3', 5.5, 15.8], ['Media', 1.9, 14.6]],
  L1: [['Living', 3.6, 2.6], ['Dining', 3.4, 7.8], ['Kitchen', 3.0, 15.5], ['Powder', 6.2, 13.1]],
  L2: [['Master', 3.6, 2.3], ['Ensuite', 1.8, 6.4], ['Landing', 4.8, 8.0], ['Robe', 1.8, 10.5], ['Bed 2', 3.6, 13.1], ['Terrace', 3.6, 16.0]],
};

export const COL = {
  concrete: 0xc4c0b6, slab: 0xb3b0a8, glass: 0x9cc9dc, frame: 0x2e3236, steelStud: 0x9aa3ab, timber: 0xc9a26b,
  cold: 0x2a6fd1, hot: 0xc8412f, waste: 0x8f969c, gas: 0xe0b000, cable: 0xf2f2f2, cableData: 0x2f9e5a, box: 0x2a6fd1,
  duct: 0xb9c0c6, ufh: 0xe36a2d, batts: 0xe9a3b3, gib: 0xcfd0ca, skim: 0xf3f1ea, membrane: 0x2c8fb0, screed: 0x9c9993,
  paint1: 0xefe8dc, paint2: 0xf2ece2, door: 0xe6e0d4, bronze: 0x8a6a3c, joinery: 0x4a4038, bench: 0xeeeae3,
  oakTread: 0xb98b56, balustrade: 0xbfe3ee, lift: 0x8c96a0, liftDoor: 0xb7bec5, sanitary: 0xf7f7f5, appliance: 0x27292c,
  carpet: 0xa8a39a, protect: 0xc9b58a, light: 0xfff2d6, grass: 0x7fa35a, water: 0x46b3d6,
};

export function buildHouse(stageIndex) {
  const root = new THREE.Group();
  const items = [];
  const shell = new THREE.Group(); root.add(shell);
  const nearWall = new THREE.Group(); root.add(nearWall);
  const context = new THREE.Group(); root.add(context);
  const labels = new THREE.Group(); root.add(labels);

  const geo = new Map();
  const boxGeo = (w, h, d) => {
    const k = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
    if (!geo.has(k)) geo.set(k, new THREE.BoxGeometry(w, h, d));
    return geo.get(k);
  };
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...o });

  function add(obj, o) {
    obj.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    (o.parent || root).add(obj);
    obj.userData.el = {
      s: stageIndex(o.stage), seq: o.seq ?? 0, anim: o.anim || 'drop',
      rs: o.rm ? stageIndex(o.rm) : null, rseq: o.rmSeq ?? 0, ranim: o.rmAnim || 'fade',
      temp: !!o.temp, level: o.level ?? null, glow: o.glow || null,
      hideAfter: o.hideAfter ? stageIndex(o.hideAfter) : null, liftCar: !!o.liftCar, ceiling: !!o.ceiling, variant: o.variant || null,
    };
    items.push(obj);
    return obj;
  }
  function box(x0, y0, z0, x1, y1, z1, color, o, mo) {
    const m = new THREE.Mesh(boxGeo(Math.abs(x1 - x0) || 0.001, Math.abs(y1 - y0) || 0.001, Math.abs(z1 - z0) || 0.001), mat(color, mo));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    if (!o) { m.castShadow = m.receiveShadow = true; return m; }
    return add(m, o);
  }
  function pipe(pts, r, color, o) {
    const g = new THREE.Group();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = new THREE.Vector3(...pts[i]), b = new THREE.Vector3(...pts[i + 1]);
      const len = a.distanceTo(b); if (len < 1e-3) continue;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat(color, { roughness: 0.45 }));
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      g.add(m);
    }
    return add(g, { anim: 'fade', ...o });
  }
  const tex = (draw, w = 256, h = 256, rx = 1, ry = 1) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  };
  const tileTex = () => tex((g, w, h) => {
    g.fillStyle = '#bdb6ab'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    g.strokeStyle = '#e7e2d8'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
  }, 256, 512);
  const oakTex = () => tex((g, w, h) => {
    for (let i = 0; i < 8; i++) {
      const l = 150 + Math.random() * 30;
      g.fillStyle = `rgb(${l + 32},${l},${l - 50})`; g.fillRect(0, i * h / 8, w, h / 8);
      g.fillStyle = 'rgba(80,50,20,0.25)'; g.fillRect(0, i * h / 8, w, 2);
      g.fillRect((Math.random() * w) | 0, i * h / 8, 2, h / 8);
    }
  });

  // ------------------------------------------------------------------ shell (existing structure)
  for (const l of LEVELS) {
    const hgt = l.id === 'L2' ? ROOF_Y - 0.35 - l.y : 3.23 - 0.275;
    // party walls (exposed architectural face)
    const far = box(W, l.y, 0, W + 0.15, l.y + hgt, l.depth, COL.concrete, null, { roughness: 0.9 });
    far.name = 'farWall'; shell.add(far);
    const near = box(-0.15, l.y, 0, 0, l.y + hgt, l.depth, COL.concrete, null, { roughness: 0.9 });
    nearWall.add(near);
    // slab under the level
    for (const [a, b, c, d] of rectMinus([-0.15, 0, W + 0.15, l.depth], [SLAB_HOLES[l.id], LIFT_HOLE]))
      shell.add(box(a, l.y - 0.275, b, c, l.y, d, COL.slab));
    // lift shaft (precast)
    const sh = (x0, z0, x1, z1) => shell.add(box(x0, l.y, z0, x1, l.y + hgt, z1, COL.concrete));
    sh(LIFT.x0 - 0.15, LIFT.z0 - 0.15, LIFT.x1 + 0.15, LIFT.z0);
    sh(LIFT.x0 - 0.15, LIFT.z1, LIFT.x1 + 0.15, LIFT.z1 + 0.15);
    sh(LIFT.x1, LIFT.z0, W, LIFT.z1);
    // glazing front & back
    const panes = l.id === 'LG' ? [[1.6, W, FRONT_LG + 0.02], [0, W, l.depth - 0.02]] : [[0, W, 0.02], [0, W, l.depth - 0.02]];
    for (const [px0, px1, z] of panes) {
      const g = new THREE.Group(), pw = px1 - px0;
      const pane = new THREE.Mesh(boxGeo(pw - 0.2, hgt - 0.1, 0.03), mat(COL.glass, { transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.3, depthWrite: false }));
      pane.position.set((px0 + px1) / 2, l.y + hgt / 2, z); g.add(pane);
      const nm = Math.max(1, Math.round(pw / 1.9));
      for (let k = 0; k <= nm; k++) { const m = new THREE.Mesh(boxGeo(0.06, hgt, 0.08), mat(COL.frame)); m.position.set(px0 + 0.1 + k * (pw - 0.2) / nm, l.y + hgt / 2, z); g.add(m); }
      shell.add(g);
    }
    if (l.id === 'LG') {
      // entry door (solid timber pivot) at the back of the porch, and the west terrace paving
      shell.add(box(0.35, 0, PORCH[3] - 0.03, 1.3, 2.4, PORCH[3] + 0.03, 0x6a5646));
      shell.add(box(-0.15, -0.02, 0, W + 0.15, 0, FRONT_LG, 0xd9d3c7));
      shell.add(box(-0.15, -0.02, FRONT_LG, PORCH[2], 0, PORCH[3], 0xd9d3c7));
    }
  }
  // L2 terrace slab and roof
  shell.add(box(-0.15, 6.46 - 0.275, DEPTH2, W + 0.15, 6.46, DEPTH, COL.slab));
  const roof = box(-0.15, ROOF_Y - 0.35, 0, W + 0.15, ROOF_Y, DEPTH2, 0x33373d);
  roof.name = 'roof'; shell.add(roof);
  // balconies
  for (const y of [3.23, 6.46]) shell.add(box(0.5, y - 0.25, -1.8, W - 0.5, y, 0, COL.concrete));
  // LG garden & pool, neighbours ghosted
  // basement stair (precast, L0 → LG) seen through its void
  { const f = FLIGHTS[0], go = (f.zBot - f.zTop) / f.n, rise = (f.yTop - f.yBot) / f.n;
    for (let i = 0; i < f.n; i++) shell.add(box(f.x0 + 0.03, f.yBot + i * rise - 0.18, f.zBot - (i + 1) * go, f.x1 - 0.03, f.yBot + (i + 1) * rise, f.zBot - i * go, COL.concrete)); }
  // rear terrace (grid C–B) and pool podium (grid B–A), house bay neighbours ghosted
  context.add(box(-7.55, -0.06, DEPTH, W + 7.55, -0.02, 26.5, COL.grass));
  context.add(box(1.1, -1.4, 21.7, 6.1, -0.06, 24.6, COL.water, null, { transparent: true, opacity: 0.8, roughness: 0.1 }));
  for (const dx of [-7.4, 7.4]) {
    const n = box(dx + (dx < 0 ? 0.15 : 0), -0.275, 0, dx + W, ROOF_Y, DEPTH, 0xd9d5cc, null, { transparent: true, opacity: 0.18, depthWrite: false });
    context.add(n);
  }

  // ------------------------------------------------------------------ helpers per level
  const segs = (w) => {
    // split a wall into solid pieces around its door gap
    const [x0, z0, x1, z1, door] = w;
    const alongX = z0 === z1;
    const a = alongX ? x0 : z0, b = alongX ? x1 : z1;
    const parts = door == null ? [[a, b]] : [[a, door], [door + 0.85, b]].filter(([p, q]) => q - p > 0.05);
    return parts.map(([p, q]) => alongX ? [p, z0, q, z0] : [x0, p, x0, q]);
  };
  const T = 0.09; // stud depth

  LEVELS.forEach((l, li) => {
    const y = l.y, walls = WALLS[l.id];
    const studCol = l.id === 'L2' ? COL.timber : COL.steelStud;
    const wallSegs = walls.flatMap(segs);

    // 1 framing: studs @ 600 + plates
    wallSegs.forEach(([x0, z0, x1, z1], k) => {
      const g = new THREE.Group();
      const alongX = z0 === z1, len = alongX ? x1 - x0 : z1 - z0;
      for (let s = 0; s <= len + 0.001; s += Math.min(0.6, len)) {
        const st = new THREE.Mesh(boxGeo(alongX ? 0.045 : T, CEIL, alongX ? T : 0.045), mat(studCol, { metalness: l.id === 'L2' ? 0 : 0.4 }));
        st.position.set(alongX ? x0 + s : x0, y + CEIL / 2, alongX ? z0 : z0 + s); g.add(st);
      }
      for (const py of [0.02, CEIL - 0.02]) {
        const p = new THREE.Mesh(boxGeo(alongX ? len : T, 0.045, alongX ? T : len), mat(studCol, { metalness: 0.3 }));
        p.position.set(alongX ? (x0 + x1) / 2 : x0, y + py, alongX ? z0 : (z0 + z1) / 2); g.add(p);
      }
      add(g, { stage: 'frame', seq: li * 20 + k, anim: 'rise', level: li });
    });
    // ceiling battens
    const cb = new THREE.Group();
    for (let z = 0.3; z < l.depth; z += 0.6) { const b = new THREE.Mesh(boxGeo(W, 0.04, 0.035), mat(studCol, { metalness: 0.3 })); b.position.set(W / 2, y + CEIL + 0.02, z); cb.add(b); }
    add(cb, { stage: 'frame', seq: li * 20 + 15, anim: 'fade', level: li, ceiling: true });

    // 2 plumbing & gas
    const stackX = 5.9, stackZ = 11.95;
    pipe([[stackX, y - 0.2, stackZ], [stackX, y + 3.0, stackZ]], 0.055, COL.waste, { stage: 'plumb', seq: li * 10, level: li });
    for (const r of WET[l.id]) {
      const fx = [r.wc, r.basin, r.basin2, r.shower && [(r.shower[0] + r.shower[2]) / 2, (r.shower[1] + r.shower[3]) / 2], r.bath && [(r.bath[0] + r.bath[2]) / 2, (r.bath[1] + r.bath[3]) / 2]].filter(Boolean);
      fx.forEach(([fx0, fz], k) => {
        pipe([[fx0, y + 0.05, fz], [fx0, y + 0.05, stackZ], [stackX, y + 0.05, stackZ]], 0.04, COL.waste, { stage: 'plumb', seq: li * 10 + 1 + k, level: li });
        pipe([[stackX - 0.15, y + 0.2, stackZ], [stackX - 0.15, y + 0.2, fz + 0.1], [fx0 + 0.1, y + 0.2, fz + 0.1], [fx0 + 0.1, y + 0.6, fz + 0.1]], 0.012, COL.cold, { stage: 'plumb', seq: li * 10 + 1 + k, level: li });
        pipe([[stackX - 0.25, y + 0.25, stackZ], [stackX - 0.25, y + 0.25, fz - 0.1], [fx0 - 0.1, y + 0.25, fz - 0.1], [fx0 - 0.1, y + 0.6, fz - 0.1]], 0.012, COL.hot, { stage: 'plumb', seq: li * 10 + 1 + k, level: li });
      });
    }
    if (l.id === 'L1') {
      // kitchen feeds (sink on the island), gas to the hob and the living-room fire
      pipe([[stackX - 0.2, y + 0.2, stackZ], [3.9, y + 0.2, stackZ], [3.9, y + 0.2, 14.3], [3.9, y + 0.9, 14.3]], 0.012, COL.cold, { stage: 'plumb', seq: 8 });
      pipe([[stackX - 0.3, y + 0.25, stackZ], [4.0, y + 0.25, stackZ], [4.0, y + 0.25, 14.4], [4.0, y + 0.9, 14.4]], 0.012, COL.hot, { stage: 'plumb', seq: 8 });
      pipe([[0.2, y + 0.3, 0.3], [0.2, y + 0.3, 15.6], [0.5, y + 0.3, 15.6], [0.5, y + 0.9, 15.6]], 0.014, COL.gas, { stage: 'plumb', seq: 9 });
      pipe([[0.2, y + 0.3, 2.6], [0.3, y + 0.5, 2.6]], 0.014, COL.gas, { stage: 'plumb', seq: 9 });
    }

    // 3 electrical & data: ceiling cable runs + boxes on studs
    const cab = [];
    for (let x = 0.6; x < W; x += 1.6) cab.push([[x, y + CEIL + 0.08, 0.3], [x, y + CEIL + 0.08, l.depth - 0.3]]);
    cab.forEach((p, k) => pipe(p, 0.008, k % 3 === 2 ? COL.cableData : COL.cable, { stage: 'elec', seq: li * 10 + k, level: li }));
    wallSegs.forEach(([x0, z0, x1, z1], k) => {
      const alongX = z0 === z1, len = alongX ? x1 - x0 : z1 - z0;
      for (let s = 0.4; s < len; s += 1.8) for (const h of [0.3, 1.1]) {
        const px = alongX ? x0 + s : x0 + 0.06, pz = alongX ? z0 + 0.06 : z0 + s;
        box(px - 0.04, y + h - 0.05, pz - 0.04, px + 0.04, y + h + 0.05, pz + 0.04, COL.box, { stage: 'elec', seq: li * 10 + 5, anim: 'fade', level: li, hideAfter: 'line' });
      }
    });
    if (l.id === 'LG') box(0.01, 1.2, 4.3, 0.14, 1.9, 4.9, 0x3a4450, { stage: 'elec', seq: 9, anim: 'fade' }); // DigiHome panel in the entry

    // 4 HVAC: trunk + branches + grilles
    const dy = y + CEIL + 0.14;
    box(2.55, dy - 0.1, 0.8, 3.05, dy + 0.1, l.depth - 1, COL.duct, { stage: 'hvac', seq: li * 10, anim: 'fade', level: li }, { metalness: 0.6, roughness: 0.4 });
    for (let z = 2.5; z < l.depth - 1; z += 4.5) {
      pipe([[3.05, dy, z], [4.8, dy, z]], 0.09, COL.duct, { stage: 'hvac', seq: li * 10 + 1, level: li });
      pipe([[2.55, dy, z + 1], [1, dy, z + 1]], 0.09, COL.duct, { stage: 'hvac', seq: li * 10 + 1, level: li });
    }
    if (l.id === 'L2') {
      const odu = new THREE.Group();
      const b = new THREE.Mesh(boxGeo(1, 0.8, 0.4), mat(0xe4e6e8)); b.position.set(W - 0.8, y + 0.45, 17.3);
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 20), mat(0x333)); f.rotation.x = Math.PI / 2; f.position.set(W - 0.8, y + 0.45, 17.09);
      odu.add(b, f);
      add(odu, { stage: 'hvac', seq: 29, level: 2 });
      pipe([[W - 0.8, y + 0.85, 17.3], [W - 0.8, y + 0.85, 14.3], [3, dy, 13.2]], 0.025, 0x222222, { stage: 'hvac', seq: 29, level: 2 });
    }

    // 5 UFH / under-tile heating: serpentine loops
    const loop = (x0, z0, x1, z1, k) => {
      const pts = []; let up = true;
      for (let x = x0 + 0.15; x <= x1 - 0.15; x += 0.3) { pts.push([x, y + 0.02, up ? z0 + 0.15 : z1 - 0.15], [x, y + 0.02, up ? z1 - 0.15 : z0 + 0.15]); up = !up; }
      pipe(pts, 0.01, COL.ufh, { stage: 'ufh', seq: li * 10 + k, level: li });
    };
    if (l.id === 'L1') { loop(0.2, 0.3, 3.6, 5.0, 0); loop(3.7, 0.3, W - 0.1, 5.0, 1); loop(1.4, 10.5, 5.0, 17.6, 2); }
    WET[l.id].forEach((r, k) => loop(r.x0, r.z0, r.x1, r.z1, 4 + k));

    // 6 pre-line: check marks
    const pass = makeLabel('PRE-LINE ✓', 0.55, '#2e7d4f');
    pass.position.set(W / 2, y + 2.2, l.depth / 2);
    add(pass, { stage: 'preline', seq: li, anim: 'fade', rm: 'insul', rmSeq: 0, temp: true, level: li });

    // 7 insulation in wall cavities + ceiling
    wallSegs.forEach(([x0, z0, x1, z1], k) => {
      const alongX = z0 === z1;
      box(alongX ? x0 : x0 - T / 2 + 0.01, y + 0.05, alongX ? z0 - T / 2 + 0.01 : z0, alongX ? x1 : x0 + T / 2 - 0.01, y + CEIL - 0.05, alongX ? z0 + T / 2 - 0.01 : z1, COL.batts,
        { stage: 'insul', seq: li * 20 + k, anim: 'rise', level: li }, { roughness: 1 });
    });
    box(0, y + CEIL + 0.05, 0, W, y + CEIL + 0.12, l.depth, COL.batts, { stage: 'insul', seq: li * 20 + 18, anim: 'fade', level: li, ceiling: true }, { roughness: 1, transparent: true, opacity: 0.55 });

    // 8/9/12/20 lining layers: board, skim, paint, final coat – each hides the one below when done
    const layers = [['line', COL.gib, 0.013, 'skim'], ['skim', COL.skim, 0.016, 'paint'], ['paint', COL.paint1, 0.019, 'final'], ['final', COL.paint2, 0.022, null]];
    // L2 party walls are timber framed (not exposed precast), so they are lined and painted too
    const liningSegs = l.id === 'L2' ? [...wallSegs, [0.02, 0, 0.02, l.depth], [W - 0.02, 0, W - 0.02, l.depth]] : wallSegs;
    layers.forEach(([stage, color, off, hide]) => {
      liningSegs.forEach(([x0, z0, x1, z1], k) => {
        const alongX = z0 === z1;
        const o = T / 2 + off;
        const opts = { stage, seq: li * 20 + k, anim: stage === 'line' ? 'rise' : 'fade', level: li, hideAfter: hide };
        if (alongX) box(x0, y, z0 - o, x1, y + CEIL, z0 + o, color, opts, { roughness: stage === 'final' ? 0.55 : 0.9 });
        else box(x0 - o, y, z0, x0 + o, y + CEIL, z1, color, opts, { roughness: stage === 'final' ? 0.55 : 0.9 });
      });
      // ceilings stop at the stairwell on LG and L1
      for (const [a, b, c, d] of rectMinus([0.01, 0.05, W - 0.01, l.depth - 0.05], li < 2 ? [SLAB_HOLES[LEVELS[li + 1].id], LIFT_HOLE] : [LIFT_HOLE]))
        box(a, y + CEIL - 0.004 - off * 0.2, b, c, y + CEIL + 0.005 - off * 0.2, d, color,
          { stage, seq: li * 20 + 19, anim: 'fade', level: li, hideAfter: hide, ceiling: true }, { roughness: 0.9 });
    });
    // shadow-gap trims at party walls (visible lines where linings meet concrete)
    box(0.005, y + CEIL - 0.02, 0.05, 0.025, y + CEIL, l.depth - 0.05, 0x1a1a1a, { stage: 'line', seq: li * 20 + 19, anim: 'fade', level: li });
    box(W - 0.025, y + CEIL - 0.02, 0.05, W - 0.005, y + CEIL, l.depth - 0.05, 0x1a1a1a, { stage: 'line', seq: li * 20 + 19, anim: 'fade', level: li });

    // 10 wet areas: screed + membrane, 11 tiling
    const tileMat = { userData: { surf: 'tile' }, roughness: 0.35 };
    WET[l.id].forEach((r, k) => {
      box(r.x0 + 0.06, y, r.z0 + 0.06, r.x1 - 0.01, y + 0.04, r.z1 - 0.06, COL.screed, { stage: 'wp', seq: li * 4 + k, anim: 'rise', level: li });
      box(r.x0 + 0.06, y + 0.04, r.z0 + 0.06, r.x1 - 0.01, y + 0.047, r.z1 - 0.06, COL.membrane, { stage: 'wp', seq: li * 4 + k + 0.5, anim: 'fade', level: li, hideAfter: 'tile' }, { roughness: 0.5 });
      // wall membrane up to 1.8 on the far party wall side and the back wall
      box(r.x1 - 0.03, y, r.z0 + 0.06, r.x1 - 0.01, y + 1.8, r.z1 - 0.06, COL.membrane, { stage: 'wp', seq: li * 4 + k + 0.5, anim: 'rise', level: li, hideAfter: 'tile' });
      // tiles
      const tf = box(r.x0 + 0.06, y + 0.047, r.z0 + 0.06, r.x1 - 0.01, y + 0.06, r.z1 - 0.06, 0xffffff, { stage: 'tile', seq: li * 4 + k, anim: 'fade', level: li }, tileMat);
      const tw = box(r.x1 - 0.035, y + 0.06, r.z0 + 0.06, r.x1 - 0.015, y + 2.6, r.z1 - 0.06, 0xffffff, { stage: 'tile', seq: li * 4 + k + 0.5, anim: 'rise', level: li }, { userData: { surf: 'tile' }, roughness: 0.35 });
    });
    if (l.id === 'L2') {
      // outdoor porcelain on pedestals to the terrace
      for (let x = 0.3; x < W - 0.2; x += 1.2) for (let z = DEPTH2 + 0.3; z < DEPTH - 0.3; z += 0.6)
        box(x, y + 0.12, z, x + 1.18, y + 0.14, z + 0.58, 0xffffff, { stage: 'tile', seq: 12 + x, anim: 'drop', level: 2 }, { userData: { surf: 'tile' }, roughness: 0.5 });
    }

    // 13 lift: car + landing doors
    box(LIFT.x0 - 0.2, y, LIFT.z0 + 0.15, LIFT.x0 - 0.17, y + 2.1, LIFT.z1 - 0.15, COL.liftDoor, { stage: 'lift', seq: 1 + li, anim: 'rise', level: li }, { metalness: 0.7, roughness: 0.3 });

    // 14 doors & skirtings
    walls.forEach(([x0, z0, x1, z1, door], k) => {
      if (door == null) return;
      const alongX = z0 === z1;
      const g = new THREE.Group();
      const leaf = new THREE.Mesh(boxGeo(alongX ? 0.82 : 0.04, 2.4, alongX ? 0.04 : 0.82), mat(COL.door));
      // doors shown open 30°
      leaf.position.set(alongX ? door + 0.42 : x0, y + 1.2, alongX ? z0 : door + 0.42);
      const pivot = new THREE.Group(); pivot.position.set(alongX ? door : x0, 0, alongX ? z0 : door);
      leaf.position.sub(pivot.position); pivot.add(leaf); pivot.rotation.y = alongX ? -1.35 : 1.35; // doors shown open against the wall
      const h = new THREE.Mesh(boxGeo(0.03, 0.03, 0.16), mat(COL.bronze, { metalness: 0.8, roughness: 0.3 }));
      h.position.set(leaf.position.x + (alongX ? 0.34 : 0.04), y + 1.05, leaf.position.z + (alongX ? 0.04 : 0.34)); pivot.add(h);
      g.add(pivot);
      add(g, { stage: 'doors', seq: li * 10 + k, anim: 'fade', level: li });
    });
    wallSegs.forEach(([x0, z0, x1, z1], k) => {
      const alongX = z0 === z1, o = T / 2 + 0.035;
      if (alongX) box(x0, y, z0 - o, x1, y + 0.12, z0 + o, 0xf4f1ea, { stage: 'doors', seq: li * 10 + 8, anim: 'fade', level: li });
      else box(x0 - o, y, z0, x0 + o, y + 0.12, z1, 0xf4f1ea, { stage: 'doors', seq: li * 10 + 8, anim: 'fade', level: li });
    });

    // 15 kitchen, scullery, wardrobes, vanities
    const cab2 = (x0, z0, x1, z1, h, seq) => box(x0, y, z0, x1, y + h, z1, COL.joinery, { stage: 'kitchen', seq, level: li }, { roughness: 0.6 });
    if (l.id === 'L1') {
      cab2(2.6, 13.4, 4.9, 15.6, 0.9, 0);           // island with the sink
      cab2(0.01, 12.6, 0.63, 17.2, 0.9, 1);          // back run on the north party wall (hob)
      cab2(0.01, 11.0, 0.63, 12.6, 2.4, 1.5);        // tall ovens / fridge
      box(0.01, y + 1.5, 13.2, 0.36, y + 2.4, 17.2, COL.joinery, { stage: 'kitchen', seq: 2.5, level: li }, { roughness: 0.6 }); // wall units
    }
    if (l.id === 'LG') { cab2(1.7, 4.45, 3.6, 5.05, 2.4, 3); cab2(W - 0.61, 13.7, W - 0.01, 15.4, 2.4, 3); cab2(3.1, 3.3, 3.74, 5.05, 2.4, 3); }
    if (l.id === 'L2') { cab2(0.01, 9.1, 0.61, 11.95, 2.4, 3); cab2(2.95, 9.1, 3.55, 11.95, 2.4, 3); cab2(0.01, 12.1, 0.61, 13.9, 2.4, 3); }
    WET[l.id].forEach((r, k) => {
      for (const b of [r.basin, r.basin2].filter(Boolean))
        box(b[0] - 0.5, y + 0.35, b[1] - 0.25, b[0] + 0.5, y + 0.8, b[1] + 0.25, COL.joinery, { stage: 'kitchen', seq: 4 + k, level: li }, { roughness: 0.6 });
    });

    // 17 benchtops
    const top2 = (x0, z0, x1, z1, h, seq) => box(x0, y + h, z0, x1, y + h + 0.03, z1, COL.bench, { stage: 'bench', seq, level: li }, { roughness: 0.25 });
    if (l.id === 'L1') { top2(2.55, 13.35, 4.95, 15.65, 0.9, 0); top2(0.01, 12.6, 0.66, 17.2, 0.9, 1); }
    WET[l.id].forEach((r, k) => { for (const b of [r.basin, r.basin2].filter(Boolean)) top2(b[0] - 0.52, b[1] - 0.27, b[0] + 0.52, b[1] + 0.27, 0.8, 2 + k); });

    // 18 second fix: sanitaryware, appliances, lights, grilles
    WET[l.id].forEach((r, k) => {
      if (r.wc) { const [wx, wz] = r.wc; box(wx - 0.18, y + 0.3, wz - 0.25, wx + 0.18, y + 0.42, wz + 0.25, COL.sanitary, { stage: 'fitoff', seq: li * 6 + k, level: li }, { roughness: 0.2 }); }
      for (const b of [r.basin, r.basin2].filter(Boolean)) box(b[0] - 0.25, y + 0.83, b[1] - 0.18, b[0] + 0.25, y + 0.95, b[1] + 0.18, COL.sanitary, { stage: 'fitoff', seq: li * 6 + k, level: li }, { roughness: 0.2 });
      if (r.bath) box(r.bath[0], y + 0.06, r.bath[1], r.bath[2], y + 0.6, r.bath[3], COL.sanitary, { stage: 'fitoff', seq: li * 6 + k + 1, level: li }, { roughness: 0.2 });
      if (r.shower) box(r.shower[0], y + 0.06, r.shower[1], r.shower[0] + 0.012, y + 2.1, r.shower[3], COL.balustrade, { stage: 'fitoff', seq: li * 6 + k + 1, level: li }, { transparent: true, opacity: 0.35, roughness: 0.05 });
    });
    if (l.id === 'L1') {
      box(0.63, y + 0.6, 11.1, 0.66, y + 1.5, 11.7, COL.appliance, { stage: 'fitoff', seq: 20 }, { roughness: 0.3, metalness: 0.5 }); // ovens
      box(0.63, y, 11.8, 0.66, y + 2.0, 12.5, 0x777d83, { stage: 'fitoff', seq: 20 }, { metalness: 0.7 }); // fridge
      box(0.1, y + 0.93, 14.6, 0.55, y + 0.935, 15.4, COL.appliance, { stage: 'fitoff', seq: 20 }); // hob
      box(0.05, y + 1.5, 14.6, 0.5, y + 1.55, 15.4, 0x9aa1a8, { stage: 'fitoff', seq: 20 }, { metalness: 0.8 }); // rangehood
    }
    const lights = [];
    for (let x = 0.9; x < W; x += 1.8) for (let z = 1; z < l.depth; z += 2)
      lights.push(box(x - 0.06, y + CEIL - 0.03, z - 0.06, x + 0.06, y + CEIL - 0.005, z + 0.06, COL.light, { stage: 'fitoff', seq: li * 6 + 5, anim: 'fade', level: li, glow: 'comm' }));
    for (let z = 2.5; z < l.depth - 1; z += 4.5)
      box(3.8, y + CEIL - 0.02, z - 0.1, 4.6, y + CEIL - 0.004, z + 0.1, 0xdadcdd, { stage: 'fitoff', seq: li * 6 + 5, anim: 'fade', level: li });

    // 21 floors: oak + carpet + protection
    const oakMat = () => ({ userData: { surf: 'oak' }, roughness: 0.55 });
    (OAK[l.id] || []).flatMap(r => rectMinus(r, FLOOR_HOLES[l.id])).forEach(([x0, z0, x1, z1], k) => {
      const m = box(x0 + 0.01, y + 0.001, z0 + 0.01, x1 - 0.01, y + 0.02, z1 - 0.01, 0xffffff, { stage: 'floor', seq: li * 6 + k, anim: 'fade', level: li }, oakMat());
      m.userData.surf = 'oak';
      box(x0 + 0.05, y + 0.02, z0 + 0.05, x1 - 0.05, y + 0.03, z1 - 0.05, COL.protect, { stage: 'floor', seq: li * 6 + k + 0.5, anim: 'fade', level: li, rm: 'handover', rmSeq: li, temp: true });
    });
    (CARPET[l.id] || []).forEach(([x0, z0, x1, z1], k) => box(x0 + 0.05, y + 0.001, z0 + 0.05, x1 - 0.05, y + 0.025, z1 - 0.05, COL.carpet, { stage: 'floor', seq: li * 6 + 3 + k, anim: 'fade', level: li }, { roughness: 1 }));

    // room labels
    ROOMS[l.id].forEach(([n, x, z]) => { const s = makeLabel(n, 0.32); s.position.set(x, y + 1.3, z); s.userData.level = li; labels.add(s); });
  });

  // ------------------------------------------------------------------ internal stair (AD-11: straight flights on the south wall, then the north wall)
  FLIGHTS.slice(1).forEach((fl, f) => {
    const g = new THREE.Group();
    const dir = Math.sign(fl.zTop - fl.zBot), run = Math.abs(fl.zTop - fl.zBot), go = run / fl.n, rise = (fl.yTop - fl.yBot) / fl.n;
    for (let i = 0; i < fl.n; i++) {
      const t = new THREE.Mesh(boxGeo(fl.x1 - fl.x0, 0.05, go + 0.03), mat(COL.oakTread, { roughness: 0.5 }));
      t.position.set((fl.x0 + fl.x1) / 2, fl.yBot + (i + 1) * rise - 0.025, fl.zBot + dir * (i + 0.5) * go);
      g.add(t);
    }
    const len = Math.hypot(run, fl.yTop - fl.yBot), tilt = -dir * Math.atan2(fl.yTop - fl.yBot, run);
    const openX = fl.x0 < 1 ? fl.x1 + 0.02 : fl.x0 - 0.02;       // the side away from the party wall
    const mk = (geo, m, x, yo) => { const o = new THREE.Mesh(geo, m); o.position.set(x, (fl.yBot + fl.yTop) / 2 + yo, (fl.zBot + fl.zTop) / 2); o.rotation.x = tilt; g.add(o); return o; };
    mk(boxGeo(0.06, 0.3, len), mat(0x2d2f33), openX, 0);
    mk(boxGeo(0.015, 1.0, len), mat(COL.balustrade, { transparent: true, opacity: 0.3, roughness: 0.05 }), openX, 0.6);
    mk(boxGeo(0.05, 0.05, len), mat(COL.oakTread), openX, 1.12);
    add(g, { stage: 'stair', seq: f, anim: 'rise', level: f });
  });

  // lift car rides the shaft once installed
  const car = new THREE.Group();
  { const c = new THREE.Mesh(boxGeo(LIFT.x1 - LIFT.x0 - 0.12, 2.15, LIFT.z1 - LIFT.z0 - 0.12), mat(COL.lift, { metalness: 0.6, roughness: 0.35 }));
    c.position.set((LIFT.x0 + LIFT.x1) / 2, 1.1, (LIFT.z0 + LIFT.z1) / 2); car.add(c); }
  add(car, { stage: 'lift', seq: 0, anim: 'fade', liftCar: true });

  // gas fire
  const fire = new THREE.Group();
  { const b = new THREE.Mesh(boxGeo(0.35, 0.6, 1.2), mat(0x1f2124)); b.position.set(0.18, 3.23 + 0.7, 2.6);
    const fl = new THREE.Mesh(boxGeo(0.02, 0.18, 0.95), mat(0xff7a1a, { emissive: 0xff5a00, emissiveIntensity: 0 })); fl.position.set(0.36, 3.23 + 0.6, 2.6);
    fire.add(b, fl); fire.userData.flame = fl; }
  add(fire, { stage: 'fire', seq: 0 });

  // commissioning / handover badges
  LEVELS.forEach((l, li) => {
    const s = makeLabel('COMMISSIONED', 0.45, '#1f5fbf'); s.position.set(W / 2, l.y + 2.2, l.depth / 2 + 2);
    add(s, { stage: 'comm', seq: li, anim: 'fade', rm: 'handover', rmSeq: 5, temp: true, level: li });
  });
  const ho = makeLabel('HANDED OVER', 0.6, '#2e7d4f'); ho.position.set(W / 2, 7.9, 9);
  add(ho, { stage: 'handover', seq: 9, anim: 'fade' });

  return { root, items, shell, nearWall, context, labels };
}

export function makeLabel(text, size = 0.5, bg = 'rgba(20,28,38,0.8)') {
  const c = document.createElement('canvas'); const g = c.getContext('2d');
  const fs = 64, font = `600 ${fs}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  g.font = font; const w = Math.ceil(g.measureText(text).width) + 36;
  c.width = w; c.height = fs + 26;
  g.font = font; g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, w, c.height, 12); g.fill();
  g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(text, 18, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  sp.scale.set(size * w / c.height, size, 1); sp.renderOrder = 10;
  return sp;
}
