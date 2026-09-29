// One Goldie Street terrace house (LG + L1 + L2), built for the fitout sequence.
// Axes: x across the house between party walls (0 → W), z from the street
// facade (0) to the garden, y from LG FFL. The room layout is INDICATIVE, drawn
// to the shell sizes in the pack (6.04 m party-wall centres, 22.2 m / 17.4 m
// plate depths, 3.23 m floor-to-floor). It is not the HAL floor plan.

import * as THREE from 'three';

export const W = 5.89;            // clear width between party walls
export const LEVELS = [
  { id: 'LG', y: 0, depth: 22.2 },
  { id: 'L1', y: 3.23, depth: 22.2 },
  { id: 'L2', y: 6.46, depth: 17.4 },
];
export const ROOF_Y = 9.49;
const CEIL = 2.7;                  // ceiling lining height above FFL
const LIFT = { x0: 4.4, x1: 5.65, z0: 15.6, z1: 16.9 };
const STAIR = { x0: 0.12, x1: 1.2, z0: 8, z1: 12.5 };
// slab opening for the 1.8 m spiral stair (centre x 1.1, z 10.25)
export const STAIR_HOLE = [0.05, 9.15, 2.2, 11.35];
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
  LG: [[4.2, 3.5, 4.2, 6, 4.2], [4.2, 6, W, 6], [4.2, 11, W, 11], [4.2, 11, 4.2, 15.3, 11.3], [4.2, 15.3, W, 15.3]],
  L1: [[0, 5, W, 5, 0.3], [3.2, 5, 3.2, 8.5, 5.4], [2.1, 8.5, W, 8.5], [2.1, 8.5, 2.1, 13.5, 12.4], [2.1, 13.5, W, 13.5],
       [3.2, 13.5, 3.2, 15.4, 13.8], [3.2, 15.4, W, 15.4], [0, 17, W, 17, 0.3]],
  L2: [[0, 7, W, 7, 0.3], [2.1, 7, 2.1, 14, 7.6], [2.1, 10, W, 10, 3.6], [2.1, 14, W, 14, 2.4]],
};
// wet rooms
const WET = {
  LG: [{ name: 'Powder', x0: 4.2, z0: 3.5, x1: W, z1: 6, wc: [5.4, 5.55], basin: [4.75, 5.6] }],
  L1: [{ name: 'Bath 2', x0: 3.2, z0: 5, x1: W, z1: 8.5, wc: [5.45, 5.4], basin: [3.9, 5.3], bath: [3.4, 7.7, W - 0.1, 8.4] },
       { name: 'Bath 3', x0: 3.2, z0: 13.5, x1: W, z1: 15.4, wc: [3.6, 15.05], basin: [4.1, 13.8], shower: [4.8, 13.6, W - 0.05, 15.3] }],
  L2: [{ name: 'Ensuite', x0: 2.1, z0: 10, x1: W, z1: 14, wc: [5.45, 13.6], basin: [3.6, 13.7], basin2: [4.7, 13.7], shower: [4.4, 10.1, W - 0.05, 11.9], bath: [2.5, 11.2, 4.2, 12.0] }],
};
const CARPET = { L1: [[0, 0, W, 5], [2.1, 8.5, W, 13.5], [0, 17, W, 22.2]], L2: [[0, 0, W, 7], [2.1, 7, W, 10]] };
const OAK = { LG: [[0, 0, W, 3.5], [0, 3.5, 4.2, 22.2], [4.2, 6, W, 22.2]], L1: [[0, 5, 3.2, 8.5], [0, 8.5, 2.1, 13.5], [0, 13.5, 3.2, 17]], L2: [[0, 7, 2.1, 17.4], [2.1, 14, W, 17.4]] };
export const ROOMS = {
  LG: [['Entry', 2.1, 1.7], ['Powder', 5.05, 4.7], ['Kitchen', 2.7, 9], ['Scullery', 5.05, 13], ['Dining', 2.4, 15], ['Living', 2.9, 19.6]],
  L1: [['Bed 2', 2.9, 2.5], ['Bath 2', 4.6, 6.4], ['Bed 3', 4.0, 11], ['Bath 3', 4.2, 14.4], ['Landing', 0.7, 15], ['Bed 4', 2.9, 19.6]],
  L2: [['Master', 2.9, 3.5], ['Robe', 4.0, 8.5], ['Ensuite', 3.6, 12.8], ['Lounge', 2.2, 15.7], ['Terrace', 2.9, 19.8]],
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
    if (l.id === 'LG') shell.add(box(-0.15, l.y - 0.275, 0, W + 0.15, l.y, l.depth, COL.slab));
    else for (const [a, b, c, d] of rectMinus([-0.15, 0, W + 0.15, l.depth], [STAIR_HOLE]))
      shell.add(box(a, l.y - 0.275, b, c, l.y, d, COL.slab));
    // lift shaft (precast)
    const sh = (x0, z0, x1, z1) => shell.add(box(x0, l.y, z0, x1, l.y + hgt, z1, COL.concrete));
    sh(LIFT.x0 - 0.15, LIFT.z0 - 0.15, LIFT.x1 + 0.15, LIFT.z0);
    sh(LIFT.x0 - 0.15, LIFT.z1, LIFT.x1 + 0.15, LIFT.z1 + 0.15);
    sh(LIFT.x1, LIFT.z0, W, LIFT.z1);
    // glazing front & back
    for (const z of [0.02, l.depth - 0.02]) {
      const g = new THREE.Group();
      const pane = new THREE.Mesh(boxGeo(W - 0.2, hgt - 0.1, 0.03), mat(COL.glass, { transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.3, depthWrite: false }));
      pane.position.set(W / 2, l.y + hgt / 2, z); g.add(pane);
      for (let x = 0.1; x <= W - 0.09; x += (W - 0.2) / 3) { const m = new THREE.Mesh(boxGeo(0.06, hgt, 0.08), mat(COL.frame)); m.position.set(x, l.y + hgt / 2, z); g.add(m); }
      shell.add(g);
    }
  }
  // L2 terrace slab and roof
  shell.add(box(-0.15, 6.46 - 0.275, 17.4, W + 0.15, 6.46, 22.2, COL.slab));
  const roof = box(-0.15, ROOF_Y - 0.35, 0, W + 0.15, ROOF_Y, 17.4, 0x33373d);
  roof.name = 'roof'; shell.add(roof);
  // balconies
  for (const y of [3.23, 6.46]) shell.add(box(0.5, y - 0.25, -1.8, W - 0.5, y, 0, COL.concrete));
  // LG garden & pool, neighbours ghosted
  context.add(box(-6.2, -0.9, 22.2, W + 6.2, -0.86, 36, COL.grass));
  context.add(box(1.4, -1.4, 27, 4.4, -0.85, 32, COL.water, null, { transparent: true, opacity: 0.8, roughness: 0.1 }));
  for (const dx of [-6.04, 6.04]) {
    const n = box(dx + (dx < 0 ? 0.15 : 0), -0.275, 0, dx + W, ROOF_Y, 22.2, 0xd9d5cc, null, { transparent: true, opacity: 0.18, depthWrite: false });
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
    const stackX = 5.7, stackZ = l.id === 'L2' ? 9.8 : 8.7;
    pipe([[stackX, y - 0.2, stackZ], [stackX, y + 3.0, stackZ]], 0.055, COL.waste, { stage: 'plumb', seq: li * 10, level: li });
    for (const r of WET[l.id]) {
      const fx = [r.wc, r.basin, r.basin2, r.shower && [(r.shower[0] + r.shower[2]) / 2, (r.shower[1] + r.shower[3]) / 2], r.bath && [(r.bath[0] + r.bath[2]) / 2, (r.bath[1] + r.bath[3]) / 2]].filter(Boolean);
      fx.forEach(([fx0, fz], k) => {
        pipe([[fx0, y + 0.05, fz], [fx0, y + 0.05, stackZ], [stackX, y + 0.05, stackZ]], 0.04, COL.waste, { stage: 'plumb', seq: li * 10 + 1 + k, level: li });
        pipe([[stackX - 0.15, y + 0.2, stackZ], [stackX - 0.15, y + 0.2, fz + 0.1], [fx0 + 0.1, y + 0.2, fz + 0.1], [fx0 + 0.1, y + 0.6, fz + 0.1]], 0.012, COL.cold, { stage: 'plumb', seq: li * 10 + 1 + k, level: li });
        pipe([[stackX - 0.25, y + 0.25, stackZ], [stackX - 0.25, y + 0.25, fz - 0.1], [fx0 - 0.1, y + 0.25, fz - 0.1], [fx0 - 0.1, y + 0.6, fz - 0.1]], 0.012, COL.hot, { stage: 'plumb', seq: li * 10 + 1 + k, level: li });
      });
    }
    if (l.id === 'LG') {
      // kitchen & scullery feeds, gas to hob and fire
      pipe([[stackX - 0.2, y + 0.2, stackZ], [3.2, y + 0.2, stackZ], [3.2, y + 0.2, 12.5], [3.2, y + 0.9, 12.5]], 0.012, COL.cold, { stage: 'plumb', seq: 8 });
      pipe([[stackX - 0.3, y + 0.25, stackZ], [3.35, y + 0.25, stackZ], [3.35, y + 0.25, 12.5], [3.35, y + 0.9, 12.5]], 0.012, COL.hot, { stage: 'plumb', seq: 8 });
      pipe([[W - 0.2, y + 0.3, 0.3], [W - 0.2, y + 0.3, 12.55], [2.85, y + 0.3, 12.55], [2.85, y + 0.9, 12.55]], 0.014, COL.gas, { stage: 'plumb', seq: 9 });
      pipe([[W - 0.2, y + 0.3, 10.2], [W - 0.2, y + 0.3, 19.5], [0.3, y + 0.3, 19.5], [0.3, y + 0.5, 19.5]], 0.014, COL.gas, { stage: 'plumb', seq: 9 });
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
    if (l.id === 'LG') box(5.75, 1.2, 13.2, 5.88, 1.9, 13.8, 0x3a4450, { stage: 'elec', seq: 9, anim: 'fade' }); // DigiHome panel

    // 4 HVAC: trunk + branches + grilles
    const dy = y + CEIL + 0.14;
    box(2.55, dy - 0.1, 0.8, 3.05, dy + 0.1, l.depth - 1, COL.duct, { stage: 'hvac', seq: li * 10, anim: 'fade', level: li }, { metalness: 0.6, roughness: 0.4 });
    for (let z = 2.5; z < l.depth - 1; z += 4.5) {
      pipe([[3.05, dy, z], [4.8, dy, z]], 0.09, COL.duct, { stage: 'hvac', seq: li * 10 + 1, level: li });
      pipe([[2.55, dy, z + 1], [1, dy, z + 1]], 0.09, COL.duct, { stage: 'hvac', seq: li * 10 + 1, level: li });
    }
    if (l.id === 'L2') {
      const odu = new THREE.Group();
      const b = new THREE.Mesh(boxGeo(1, 0.8, 0.4), mat(0xe4e6e8)); b.position.set(W - 0.8, y + 0.45, 21.6);
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 20), mat(0x333)); f.rotation.x = Math.PI / 2; f.position.set(W - 0.8, y + 0.45, 21.39);
      odu.add(b, f);
      add(odu, { stage: 'hvac', seq: 29, level: 2 });
      pipe([[W - 0.8, y + 0.85, 21.6], [W - 0.8, y + 0.85, 17.5], [3, dy, 16.4]], 0.025, 0x222222, { stage: 'hvac', seq: 29, level: 2 });
    }

    // 5 UFH / under-tile heating: serpentine loops
    const loop = (x0, z0, x1, z1, k) => {
      const pts = []; let up = true;
      for (let x = x0 + 0.15; x <= x1 - 0.15; x += 0.3) { pts.push([x, y + 0.02, up ? z0 + 0.15 : z1 - 0.15], [x, y + 0.02, up ? z1 - 0.15 : z0 + 0.15]); up = !up; }
      pipe(pts, 0.01, COL.ufh, { stage: 'ufh', seq: li * 10 + k, level: li });
    };
    if (l.id === 'LG') { loop(0.2, 13.2, 4.2, 22, 0); loop(4.3, 15.5, W, 22, 1); }
    WET[l.id].forEach((r, k) => loop(r.x0, r.z0, r.x1, r.z1, 2 + k));

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
    layers.forEach(([stage, color, off, hide]) => {
      wallSegs.forEach(([x0, z0, x1, z1], k) => {
        const alongX = z0 === z1;
        const o = T / 2 + off;
        const opts = { stage, seq: li * 20 + k, anim: stage === 'line' ? 'rise' : 'fade', level: li, hideAfter: hide };
        if (alongX) box(x0, y, z0 - o, x1, y + CEIL, z0 + o, color, opts, { roughness: stage === 'final' ? 0.55 : 0.9 });
        else box(x0 - o, y, z0, x0 + o, y + CEIL, z1, color, opts, { roughness: stage === 'final' ? 0.55 : 0.9 });
      });
      // ceilings stop at the stairwell on LG and L1
      for (const [a, b, c, d] of rectMinus([0.01, 0.05, W - 0.01, l.depth - 0.05], li < 2 ? [STAIR_HOLE] : []))
        box(a, y + CEIL - 0.004 - off * 0.2, b, c, y + CEIL + 0.005 - off * 0.2, d, color,
          { stage, seq: li * 20 + 19, anim: 'fade', level: li, hideAfter: hide, ceiling: true }, { roughness: 0.9 });
    });
    // shadow-gap trims at party walls (visible lines where linings meet concrete)
    box(0.005, y + CEIL - 0.02, 0.05, 0.025, y + CEIL, l.depth - 0.05, 0x1a1a1a, { stage: 'line', seq: li * 20 + 19, anim: 'fade', level: li });
    box(W - 0.025, y + CEIL - 0.02, 0.05, W - 0.005, y + CEIL, l.depth - 0.05, 0x1a1a1a, { stage: 'line', seq: li * 20 + 19, anim: 'fade', level: li });

    // 10 wet areas: screed + membrane, 11 tiling
    const tileMat = { map: tileTex(), roughness: 0.35 };
    WET[l.id].forEach((r, k) => {
      box(r.x0 + 0.06, y, r.z0 + 0.06, r.x1 - 0.01, y + 0.04, r.z1 - 0.06, COL.screed, { stage: 'wp', seq: li * 4 + k, anim: 'rise', level: li });
      box(r.x0 + 0.06, y + 0.04, r.z0 + 0.06, r.x1 - 0.01, y + 0.047, r.z1 - 0.06, COL.membrane, { stage: 'wp', seq: li * 4 + k + 0.5, anim: 'fade', level: li, hideAfter: 'tile' }, { roughness: 0.5 });
      // wall membrane up to 1.8 on the far party wall side and the back wall
      box(r.x1 - 0.03, y, r.z0 + 0.06, r.x1 - 0.01, y + 1.8, r.z1 - 0.06, COL.membrane, { stage: 'wp', seq: li * 4 + k + 0.5, anim: 'rise', level: li, hideAfter: 'tile' });
      // tiles
      const tf = box(r.x0 + 0.06, y + 0.047, r.z0 + 0.06, r.x1 - 0.01, y + 0.06, r.z1 - 0.06, 0xffffff, { stage: 'tile', seq: li * 4 + k, anim: 'fade', level: li }, tileMat);
      tf.material.map.repeat.set((r.x1 - r.x0) / 0.6, (r.z1 - r.z0) / 1.2);
      const tw = box(r.x1 - 0.035, y + 0.06, r.z0 + 0.06, r.x1 - 0.015, y + 2.6, r.z1 - 0.06, 0xffffff, { stage: 'tile', seq: li * 4 + k + 0.5, anim: 'rise', level: li }, { map: tileTex(), roughness: 0.35 });
      tw.material.map.repeat.set((r.z1 - r.z0) / 0.6, 2.6 / 1.2);
    });
    if (l.id === 'L2') {
      // outdoor porcelain on pedestals to the terrace
      for (let x = 0.3; x < W; x += 1.2) for (let z = 17.7; z < 22; z += 0.6)
        box(x, y + 0.12, z, x + 1.18, y + 0.14, z + 0.58, 0xffffff, { stage: 'tile', seq: 12 + x, anim: 'drop', level: 2 }, { map: tileTex(), roughness: 0.5 });
    }

    // 13 lift: car + landing doors
    box(LIFT.x0 - 0.16, y, LIFT.z0 - 0.17, LIFT.x0 + 0.02 + 0.0, y + 2.1, LIFT.z0 - 0.15, COL.liftDoor, { stage: 'lift', seq: 1 + li, anim: 'rise', level: li }, { metalness: 0.7, roughness: 0.3 });

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
    if (l.id === 'LG') {
      cab2(2.3, 11.4, 3.4, 14.0, 0.87, 0);          // island (clear of the spiral stair)
      cab2(4.2 - 0.62, 8.2, 4.18, 10.9, 2.4, 1);     // tall pantry / oven tower
      cab2(W - 0.6, 11.2, W - 0.01, 15.1, 0.87, 2);  // scullery run
      box(W - 0.35, y + 1.5, 11.2, W - 0.01, y + 2.4, 15.1, COL.joinery, { stage: 'kitchen', seq: 2.5, level: li }, { roughness: 0.6 }); // wall units
    }
    if (l.id === 'L1') { cab2(1.5, 4.35, 3.1, 4.94, 2.4, 3); cab2(2.2, 8.56, 3.6, 9.15, 2.4, 3); }
    if (l.id === 'L2') { cab2(2.2, 7.06, W - 0.01, 7.65, 2.4, 3); cab2(2.2, 9.35, 3.6, 9.94, 2.4, 3); }
    WET[l.id].forEach((r, k) => {
      for (const b of [r.basin, r.basin2].filter(Boolean))
        box(b[0] - 0.5, y + 0.35, b[1] - 0.25, b[0] + 0.5, y + 0.8, b[1] + 0.25, COL.joinery, { stage: 'kitchen', seq: 4 + k, level: li }, { roughness: 0.6 });
    });

    // 17 benchtops
    const top2 = (x0, z0, x1, z1, h, seq) => box(x0, y + h, z0, x1, y + h + 0.03, z1, COL.bench, { stage: 'bench', seq, level: li }, { roughness: 0.25 });
    if (l.id === 'LG') { top2(2.25, 11.35, 3.45, 14.05, 0.87, 0); top2(W - 0.62, 11.2, W - 0.01, 15.1, 0.87, 1); }
    WET[l.id].forEach((r, k) => { for (const b of [r.basin, r.basin2].filter(Boolean)) top2(b[0] - 0.52, b[1] - 0.27, b[0] + 0.52, b[1] + 0.27, 0.8, 2 + k); });

    // 18 second fix: sanitaryware, appliances, lights, grilles
    WET[l.id].forEach((r, k) => {
      const [wx, wz] = r.wc;
      box(wx - 0.18, y + 0.3, wz - 0.25, wx + 0.18, y + 0.42, wz + 0.25, COL.sanitary, { stage: 'fitoff', seq: li * 6 + k, level: li }, { roughness: 0.2 });
      for (const b of [r.basin, r.basin2].filter(Boolean)) box(b[0] - 0.25, y + 0.83, b[1] - 0.18, b[0] + 0.25, y + 0.95, b[1] + 0.18, COL.sanitary, { stage: 'fitoff', seq: li * 6 + k, level: li }, { roughness: 0.2 });
      if (r.bath) box(r.bath[0], y + 0.06, r.bath[1], r.bath[2], y + 0.6, r.bath[3], COL.sanitary, { stage: 'fitoff', seq: li * 6 + k + 1, level: li }, { roughness: 0.2 });
      if (r.shower) box(r.shower[0], y + 0.06, r.shower[1], r.shower[0] + 0.012, y + 2.1, r.shower[3], COL.balustrade, { stage: 'fitoff', seq: li * 6 + k + 1, level: li }, { transparent: true, opacity: 0.35, roughness: 0.05 });
    });
    if (l.id === 'LG') {
      box(4.2 - 0.6, y + 0.6, 9.3, 4.2 - 0.02, y + 1.5, 10.0, COL.appliance, { stage: 'fitoff', seq: 20 }, { roughness: 0.3, metalness: 0.5 }); // ovens
      box(4.2 - 0.62, y, 10.95, 4.18, y + 2.0, 11.0, 0x777d83, { stage: 'fitoff', seq: 20 }, { metalness: 0.7 });
      box(2.55, y + 0.9, 12.2, 3.15, y + 0.905, 12.9, COL.appliance, { stage: 'fitoff', seq: 20 }); // hob
    }
    const lights = [];
    for (let x = 0.9; x < W; x += 1.8) for (let z = 1; z < l.depth; z += 2)
      lights.push(box(x - 0.06, y + CEIL - 0.03, z - 0.06, x + 0.06, y + CEIL - 0.005, z + 0.06, COL.light, { stage: 'fitoff', seq: li * 6 + 5, anim: 'fade', level: li, glow: 'comm' }));
    for (let z = 2.5; z < l.depth - 1; z += 4.5)
      box(3.8, y + CEIL - 0.02, z - 0.1, 4.6, y + CEIL - 0.004, z + 0.1, 0xdadcdd, { stage: 'fitoff', seq: li * 6 + 5, anim: 'fade', level: li });

    // 21 floors: oak + carpet + protection
    const oakMat = () => ({ map: oakTex(), roughness: 0.55 });
    (OAK[l.id] || []).flatMap(r => rectMinus(r, li > 0 ? [STAIR_HOLE] : [])).forEach(([x0, z0, x1, z1], k) => {
      const m = box(x0 + 0.01, y + 0.001, z0 + 0.01, x1 - 0.01, y + 0.02, z1 - 0.01, 0xffffff, { stage: 'floor', seq: li * 6 + k, anim: 'fade', level: li }, oakMat());
      m.material.map.repeat.set((x1 - x0) / 1.8, (z1 - z0) / 1.6);
      box(x0 + 0.05, y + 0.02, z0 + 0.05, x1 - 0.05, y + 0.03, z1 - 0.05, COL.protect, { stage: 'floor', seq: li * 6 + k + 0.5, anim: 'fade', level: li, rm: 'handover', rmSeq: li, temp: true });
    });
    (CARPET[l.id] || []).forEach(([x0, z0, x1, z1], k) => box(x0 + 0.05, y + 0.001, z0 + 0.05, x1 - 0.05, y + 0.025, z1 - 0.05, COL.carpet, { stage: 'floor', seq: li * 6 + 3 + k, anim: 'fade', level: li }, { roughness: 1 }));

    // room labels
    ROOMS[l.id].forEach(([n, x, z]) => { const s = makeLabel(n, 0.32); s.position.set(x, y + 1.3, z); s.userData.level = li; labels.add(s); });
  });

  // ------------------------------------------------------------------ stair (LG → L2)
  for (let f = 0; f < 2; f++) {
    const y0 = LEVELS[f].y, n = 17, rise = 3.23 / n, go = (STAIR.z1 - STAIR.z0) / n;
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const t = new THREE.Mesh(boxGeo(STAIR.x1 - STAIR.x0, 0.05, go + 0.03), mat(COL.oakTread, { roughness: 0.5 }));
      t.position.set((STAIR.x0 + STAIR.x1) / 2, y0 + (i + 1) * rise - 0.025, STAIR.z0 + (i + 0.5) * go);
      g.add(t);
    }
    const stringer = new THREE.Mesh(boxGeo(0.06, 0.3, Math.hypot(STAIR.z1 - STAIR.z0, 3.23)), mat(0x2d2f33));
    stringer.position.set(STAIR.x1 - 0.03, y0 + 3.23 / 2, (STAIR.z0 + STAIR.z1) / 2); stringer.rotation.x = -Math.atan2(3.23, STAIR.z1 - STAIR.z0);
    g.add(stringer);
    const glass = new THREE.Mesh(boxGeo(0.015, 1.0, Math.hypot(STAIR.z1 - STAIR.z0, 3.23)), mat(COL.balustrade, { transparent: true, opacity: 0.3, roughness: 0.05 }));
    glass.position.set(STAIR.x1 + 0.02, y0 + 3.23 / 2 + 0.6, (STAIR.z0 + STAIR.z1) / 2); glass.rotation.x = stringer.rotation.x; g.add(glass);
    const rail = new THREE.Mesh(boxGeo(0.05, 0.05, Math.hypot(STAIR.z1 - STAIR.z0, 3.23)), mat(COL.oakTread));
    rail.position.set(STAIR.x1 + 0.02, y0 + 3.23 / 2 + 1.12, (STAIR.z0 + STAIR.z1) / 2); rail.rotation.x = stringer.rotation.x; g.add(rail);
    add(g, { stage: 'stair', seq: f, anim: 'rise', level: f, variant: 'straight' });
  }
  // alternative: internal spiral stair in the same zone (switch in Display)
  for (let f = 0; f < 2; f++) {
    const y0 = LEVELS[f].y, n = 17, rise = 3.23 / n, cx = 1.1, cz = (STAIR.z0 + STAIR.z1) / 2, r = 0.9;
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.23, 12), mat(0x2d2f33, { metalness: 0.5 }));
    pole.position.set(cx, y0 + 3.23 / 2, cz); g.add(pole);
    for (let i = 0; i < n; i++) {
      const a = (f * n + i) * (Math.PI * 2 / 13);
      const t = new THREE.Mesh(boxGeo(r, 0.05, 0.34), mat(COL.oakTread, { roughness: 0.5 }));
      t.position.set(cx + Math.cos(a) * r / 2, y0 + (i + 1) * rise - 0.025, cz + Math.sin(a) * r / 2); t.rotation.y = -a;
      g.add(t);
      const post = new THREE.Mesh(boxGeo(0.02, 1.0, 0.02), mat(0x2d2f33)); post.position.set(cx + Math.cos(a) * (r - 0.03), y0 + (i + 1) * rise + 0.5, cz + Math.sin(a) * (r - 0.03)); g.add(post);
      const rail = new THREE.Mesh(boxGeo(0.05, 0.05, 0.36), mat(COL.oakTread)); rail.position.set(cx + Math.cos(a) * (r - 0.03), y0 + (i + 1) * rise + 1.0, cz + Math.sin(a) * (r - 0.03)); rail.rotation.y = -a; g.add(rail);
    }
    add(g, { stage: 'stair', seq: f, anim: 'rise', level: f, variant: 'spiral' });
  }

  // lift car rides the shaft once installed
  const car = new THREE.Group();
  { const c = new THREE.Mesh(boxGeo(LIFT.x1 - LIFT.x0 - 0.12, 2.15, LIFT.z1 - LIFT.z0 - 0.12), mat(COL.lift, { metalness: 0.6, roughness: 0.35 }));
    c.position.set((LIFT.x0 + LIFT.x1) / 2, 1.1, (LIFT.z0 + LIFT.z1) / 2); car.add(c); }
  add(car, { stage: 'lift', seq: 0, anim: 'fade', liftCar: true });

  // gas fire
  const fire = new THREE.Group();
  { const b = new THREE.Mesh(boxGeo(0.35, 0.6, 1.2), mat(0x1f2124)); b.position.set(0.18, 0.7, 19.5);
    const fl = new THREE.Mesh(boxGeo(0.02, 0.18, 0.95), mat(0xff7a1a, { emissive: 0xff5a00, emissiveIntensity: 0 })); fl.position.set(0.36, 0.6, 19.5);
    fire.add(b, fl); fire.userData.flame = fl; }
  add(fire, { stage: 'fire', seq: 0 });

  // commissioning / handover badges
  LEVELS.forEach((l, li) => {
    const s = makeLabel('COMMISSIONED', 0.45, '#1f5fbf'); s.position.set(W / 2, l.y + 2.2, l.depth / 2 + 2);
    add(s, { stage: 'comm', seq: li, anim: 'fade', rm: 'handover', rmSeq: 5, temp: true, level: li });
  });
  const ho = makeLabel('HANDED OVER', 0.6, '#2e7d4f'); ho.position.set(W / 2, 7.9, 12);
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
