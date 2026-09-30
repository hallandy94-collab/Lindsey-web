import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { FIT_STAGES, PHASES, HOUSES, stageDates, houseSpan } from './fitout-stages.js';
import { buildHouse, LEVELS, W, ROOF_Y, makeLabel } from './fitout-model.js';
import { realify, setupWorld } from './realism.js';

const N = FIT_STAGES.length;
const stageIndex = id => { const i = FIT_STAGES.findIndex(s => s.id === id); if (i < 0) throw new Error('stage ' + id); return i; };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ scene
const host = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.minDistance = 2; controls.maxDistance = 80;
const hemi = new THREE.HemisphereLight(0xf6f8fb, 0x6a6155, 1.35); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3e0, 1.9);
sun.position.set(-18, 30, -8); sun.target.position.set(3, 3, 11);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 2, far: 80 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);
const warm = new THREE.PointLight(0xffd9a0, 0, 30); warm.position.set(W / 2, 5, 9); scene.add(warm);

const { root, items, nearWall, context, labels, shell } = buildHouse(stageIndex);
// set out like the drawings; mirrored in x for true handedness (north party wall on the left from the street)
const MIRROR = new THREE.Group(); MIRROR.scale.x = -1; MIRROR.add(root); scene.add(MIRROR);
const toW = a => [-a[0], a[1], a[2]];
realify(root);
const world = setupWorld({ renderer, scene, camera, sun, hemi, target: new THREE.Vector3(-3.6, 0, 11), suburb: false, shadowSize: 2048, shadowExtent: 26 });
{ // ground at the street level around the house (LG is 0.86 m above the street)
  const g = new THREE.Mesh(new THREE.CircleGeometry(400, 64), new THREE.MeshStandardMaterial({ color: 0x9fb088, roughness: 1 }));
  g.rotation.x = -Math.PI / 2; g.position.y = -0.9; g.receiveShadow = true; scene.add(g);
}
const roof = shell.getObjectByName('roof');

const ghostMat = new THREE.LineBasicMaterial({ color: 0x33414f, transparent: true, opacity: 0.18, depthWrite: false });
const box3 = new THREE.Box3();
items.forEach(o => {
  const el = o.userData.el;
  el.base = { pos: o.position.clone(), scale: o.scale.clone() };
  box3.setFromObject(o); el.bottom = box3.min.y; el.top = box3.max.y;
  el.mats = [];
  if (o.isMesh && !el.temp) {
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), ghostMat);
    e.visible = false; o.add(e); el.edges = e;
  }
  o.traverse(c => { if (c.isLineSegments) return; if (c.material) el.mats.push({ m: c.material, op: c.material.opacity, tr: c.material.transparent, em: c.material.emissive ? c.material.emissive.clone() : null }); });
});
// Exploded floors: L1 and L2 step up and across so every floor's interior can be seen at once
const GAP = 0.9, SHIFT = 8.8;
const lvlOfY = y => (y >= 6.1 ? 2 : y >= 2.9 ? 1 : 0);
items.forEach(o => { const el = o.userData.el; el.lvl = el.level ?? lvlOfY(el.bottom); });
const stacked = [];
for (const grp of [shell, nearWall]) grp.children.forEach(c => { box3.setFromObject(c); stacked.push({ o: c, y: c.position.y, x: c.position.x, lvl: lvlOfY(box3.min.y + 0.01) }); });
labels.children.forEach(c => stacked.push({ o: c, y: c.position.y, x: c.position.x, lvl: c.userData.level }));
// level tags floating at the street end of each floor
const levelTags = new THREE.Group(); scene.add(levelTags);
LEVELS.forEach((l, i) => {
  const tag = makeLabel(l.id, 0.9, '#1f5fbf'); tag.position.set(W + 0.4, l.y + 3.2, 0.5);
  levelTags.add(tag); stacked.push({ o: tag, y: tag.position.y, x: tag.position.x, lvl: i });
});
let explodeAmt = 1;
function windows(key, seqKey, a, b) {
  const by = new Map();
  items.forEach(o => { const el = o.userData.el; if (el[key] == null) return; if (!by.has(el[key])) by.set(el[key], []); by.get(el[key]).push(o); });
  by.forEach(list => {
    const seqs = [...new Set(list.map(o => o.userData.el[seqKey]))].sort((x, y) => x - y);
    const n = seqs.length, w = n === 1 ? 0.9 : Math.min(0.9, Math.max(0.18, 1.8 / n));
    list.forEach(o => { const el = o.userData.el, r = seqs.indexOf(el[seqKey]); el[a] = n === 1 ? 0.05 : 0.02 + r / (n - 1) * (0.96 - w); el[b] = el[a] + w; });
  });
}
windows('s', 'seq', 'd0', 'd1');
windows('rs', 'rseq', 'rd0', 'rd1');

// ------------------------------------------------------------------ state
const state = { t: 0.999, house: 0, playing: false, playTo: null, speed: 1, ghost: true, highlight: true, cutaway: true, ceilings: true, stairType: 'spiral', exploded: true, labels: false, ctx: true, autoCam: true, level: 'all' };
const prog = (t, s, d0, d1) => { const a = t - s; return a <= d0 ? 0 : a >= d1 ? 1 : (a - d0) / (d1 - d0); };
const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const accent = new THREE.Color();
const setOp = (el, k) => { for (const r of el.mats) { r.m.opacity = r.op * k; r.m.transparent = r.tr || k < 0.999; r.m.depthWrite = k > 0.5 && !(r.tr && r.op < 0.5); } };
const setEm = (el, on, glow) => {
  for (const r of el.mats) {
    if (!r.em) continue;
    if (glow) { r.m.emissive.set(0xffc873); r.m.emissiveIntensity = 1.2; }
    else if (on) { r.m.emissive.copy(accent).multiplyScalar(0.35); r.m.emissiveIntensity = 1; }
    else { r.m.emissive.copy(r.em); r.m.emissiveIntensity = 1; }
  }
};
const levelTop = { all: 99, LG: 2.6, L1: 3.23 + 2.6, L2: 6.46 + 2.6 };

function update(time) {
  const t = state.t, cs = Math.min(Math.floor(t), N - 1);
  const commOn = t >= stageIndex('comm') + 0.6;
  for (const o of items) {
    const el = o.userData.el;
    const e = prog(t, el.s, el.d0, el.d1);
    const r = el.rs == null ? 0 : prog(t, el.rs, el.rd0, el.rd1);
    const hidden = r >= 1 || (el.hideAfter != null && t >= el.hideAfter + 1) || (el.variant && el.variant !== state.stairType);
    if (hidden) { o.visible = false; continue; }
    o.position.copy(el.base.pos); o.scale.copy(el.base.scale);
    if (e <= 0) {
      if (state.ghost && el.edges) { o.visible = true; el.edges.visible = true; for (const m of el.mats) m.m.visible = false; }
      else o.visible = false;
      continue;
    }
    o.visible = true; if (el.edges) el.edges.visible = false; for (const m of el.mats) m.m.visible = true;
    const k = ease(e); let op = 1;
    switch (el.anim) {
      case 'drop': o.position.y += (1 - k) * 1.2; op = Math.min(1, e * 2.5); break;
      case 'fade': op = k; break;
      case 'rise': { const s = Math.max(k, 0.001); o.scale.y = el.base.scale.y * s; o.position.y = el.bottom - (el.bottom - el.base.pos.y) * s; break; }
    }
    if (r > 0) op *= 1 - ease(r);
    if (el.ceiling && state.ceilings && state.level === 'all') op *= 0.15;
    setOp(el, op);
    const glow = el.glow === 'comm' && commOn;
    setEm(el, state.highlight && !el.temp && el.s === cs, glow);
    if (o.userData.flame) { o.userData.flame.material.emissiveIntensity = commOn ? 1.6 + Math.sin(time * 0.01) * 0.3 : 0; }
    o.position.y += explodeAmt * GAP * el.lvl; o.position.x += explodeAmt * SHIFT * el.lvl;
    if (el.liftCar) {
      const ride = reduceMotion ? 0 : (Math.sin(time * 0.0006) + 1) / 2;
      o.position.y = el.base.pos.y + (e >= 1 ? ride * (LEVELS[2].y + explodeAmt * GAP * 2) : 0);
    }
  }
  // exploded: the far party walls would hide the next floor along, so they drop out
  for (const st of stacked) if (st.o.name === 'farWall') st.o.visible = explodeAmt < 0.5;
  for (const st of stacked) { st.o.position.y = st.y + explodeAmt * GAP * st.lvl; st.o.position.x = st.x + explodeAmt * SHIFT * st.lvl; }
  warm.intensity = commOn ? 18 : 0;
  nearWall.visible = !state.cutaway;
  context.visible = state.ctx;
  labels.visible = state.labels;
  labels.children.forEach(s => { s.visible = state.level === 'all' || LEVELS[s.userData.level].id === state.level; });
  roof.visible = state.level === 'all' && !state.cutaway;
}

function applyClip() {
  const y = levelTop[state.level];
  renderer.clippingPlanes = y < 50 ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), y)] : [];
}

// ------------------------------------------------------------------ camera
const VIEWS = {
  iso: { pos: [-15, 13.5, -6], tgt: [3.6, 3.6, 9], xpos: [3, 45, -19], xtgt: [12.5, 0.5, 9] },
  side: { pos: [-21, 5.2, 9], tgt: [3.6, 4.6, 9] },
  rear: { pos: [14, 9.5, 31], tgt: [3.6, 4, 12], xpos: [27, 25, 35], xtgt: [12.5, 2, 10] },
  LG: { pos: [3.6, 42, 9.2], tgt: [3.6, 0, 9], level: 'LG' },
  L1: { pos: [3.6, 45, 9.2], tgt: [3.6, 3.23, 9], level: 'L1' },
  L2: { pos: [3.6, 47, 7.3], tgt: [3.6, 6.46, 7.1], level: 'L2' },
};
let tween = null, explodeTarget = 1, currentView = 'iso';
function goView(name, instant) {
  const v = VIEWS[name]; if (!v) return;
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === name));
  currentView = name;
  state.level = v.level || 'all'; applyClip();
  const ex = state.exploded && !v.level && name !== 'side';
  explodeTarget = ex ? 1 : 0;
  const to = { pos: new THREE.Vector3(...toW(ex && v.xpos ? v.xpos : v.pos)), tgt: new THREE.Vector3(...toW(ex && v.xtgt ? v.xtgt : v.tgt)) };
  if (instant || reduceMotion) { camera.position.copy(to.pos); controls.target.copy(to.tgt); controls.update(); tween = null; return; }
  tween = { from: { pos: camera.position.clone(), tgt: controls.target.clone() }, to, t0: performance.now(), dur: 1000 };
}
controls.addEventListener('start', () => { tween = null; });

function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  accent.set(cs.getPropertyValue('--accent').trim() || '#1f5fbf');
  ghostMat.color.set(cs.getPropertyValue('--ghost').trim() || '#33414f');
}
readTokens();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTokens);
new MutationObserver(readTokens).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ------------------------------------------------------------------ UI
const $ = s => document.querySelector(s);
const fmt = d => d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtS = d => d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const scrub = $('#scrub'); scrub.max = N; scrub.step = 0.001;
FIT_STAGES.forEach((s, i) => { const d = document.createElement('span'); d.className = 'tick' + (s.hold ? ' ms' : ''); d.style.left = `${i / N * 100}%`; $('#ticks').appendChild(d); });

// house picker
const picker = $('#houses');
for (let h = 0; h < HOUSES; h++) {
  const b = document.createElement('button'); b.type = 'button'; b.dataset.h = h; b.textContent = `House ${h + 1}`;
  b.setAttribute('aria-pressed', h === state.house);
  picker.appendChild(b);
}
picker.addEventListener('click', e => { const b = e.target.closest('button[data-h]'); if (b) setHouse(+b.dataset.h); });
function setHouse(h) {
  state.house = h;
  picker.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.h === h));
  lastStage = -1; renderRegister(); updateReadout();
}

// register
const list = $('#seq');
function renderRegister() {
  list.innerHTML = FIT_STAGES.map((s, i) => {
    const d = stageDates(s, state.house);
    return `<li><button type="button" data-i="${i}"><span class="dot"></span><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="tt">${esc(s.title)}</span><span class="dt">${fmtS(d.start)}</span></button></li>`;
  }).join('');
  const sp = houseSpan(state.house);
  $('#reg-h').textContent = `House ${state.house + 1} · ${N} stages · ${fmtS(sp.start)} → ${fmt(sp.end)}`;
}
list.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) jumpTo(+b.dataset.i); });

let lastStage = -1, curDate = null;
function renderStage(i) {
  const s = FIT_STAGES[i], d = stageDates(s, state.house);
  $('#st-n').textContent = `House ${state.house + 1} · Stage ${String(i + 1).padStart(2, '0')} of ${N}`;
  $('#st-title').textContent = s.title;
  $('#st-trade').textContent = s.trade;
  $('#st-phase').textContent = PHASES.find(p => p.id === s.phase).name;
  $('#st-phase').dataset.ph = s.phase;
  $('#st-dates').textContent = `${fmtS(d.start)} – ${fmt(d.end)}`;
  $('#st-owner').hidden = !s.owner;
  $('#st-bench').hidden = !(s.bench && state.house === 0);
  $('#st-hold').hidden = !s.hold;
  $('#st-what').textContent = s.what;
  $('#st-scope').innerHTML = s.scope.map(x => `<li>${esc(x)}</li>`).join('');
  $('#st-holds').innerHTML = s.holds.length ? s.holds.map(x => `<li>${esc(x)}</li>`).join('') : '<li class="none">No hold point</li>';
  list.querySelectorAll('button').forEach((b, k) => { b.dataset.state = k < i ? 'done' : k === i ? 'now' : 'next'; if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  const cur = list.querySelector('[aria-current]');
  if (cur && list.scrollHeight > list.clientHeight + 4) {
    const top = cur.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top + cur.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top - list.clientHeight / 2;
  }
}

function updateReadout() {
  const t = Math.min(state.t, N - 0.0001), i = Math.floor(t), s = FIT_STAGES[i];
  const d = stageDates(s, state.house);
  curDate = new Date(d.start.getTime() + (d.end - d.start) * (t - i));
  $('#date').textContent = fmt(curDate);
  $('#week').textContent = `House ${state.house + 1}`;
  scrub.value = state.t; scrub.style.setProperty('--p', `${state.t / N * 100}%`);
  if (i !== lastStage) { lastStage = i; renderStage(i); }
  drawFlow();
}

// ------------------------------------------------------------------ flow-line chart
const F0 = houseSpan(0).start, F1 = houseSpan(HOUSES - 1).end;
function drawFlow() {
  const svg = $('#flowline');
  const L = 34, R = 356, top = 16, rowH = 19;
  const x = d => L + (d - F0) / (F1 - F0) * (R - L);
  let h = '';
  // months
  const m = new Date(F0.getFullYear(), F0.getMonth(), 1);
  while (m <= F1) {
    const xx = x(m);
    if (xx >= L) h += `<line x1="${xx}" y1="${top - 4}" x2="${xx}" y2="${top + rowH * HOUSES}" class="grid"/><text x="${xx + 2}" y="${top - 6}" class="mo">${m.toLocaleDateString('en-NZ', { month: 'short' })}</text>`;
    m.setMonth(m.getMonth() + 1);
  }
  for (let hh = 0; hh < HOUSES; hh++) {
    const y = top + hh * rowH;
    h += `<g class="row${hh === state.house ? ' sel' : ''}" data-h="${hh}"><rect x="0" y="${y}" width="${R + 4}" height="${rowH}" class="hit"/>`;
    h += `<text x="4" y="${y + 13}" class="hl">H${hh + 1}</text>`;
    for (const p of PHASES) {
      const st = FIT_STAGES.filter(s => s.phase === p.id).map(s => stageDates(s, hh));
      const a = Math.min(...st.map(q => q.start)), b = Math.max(...st.map(q => q.end));
      h += `<rect x="${x(a)}" y="${y + 4}" width="${Math.max(1, x(b) - x(a))}" height="${rowH - 8}" rx="2" class="ph ph-${p.id}"><title>House ${hh + 1} · ${p.name}: ${fmtS(new Date(a))} – ${fmtS(new Date(b))}</title></rect>`;
    }
    h += '</g>';
  }
  if (curDate) {
    const cx = Math.max(L, Math.min(R, x(curDate)));
    h += `<line x1="${cx}" y1="${top - 4}" x2="${cx}" y2="${top + rowH * HOUSES + 2}" class="now"/>`;
  }
  svg.innerHTML = h;
  // status on this date
  if (curDate) {
    $('#flow-date').textContent = fmt(curDate);
    $('#flow-status').innerHTML = Array.from({ length: HOUSES }, (_, hh) => {
      const sp = houseSpan(hh);
      let txt;
      if (curDate < sp.start) txt = 'not started';
      else if (curDate >= sp.end) txt = 'handed over';
      else if (hh === state.house) txt = FIT_STAGES[Math.min(Math.floor(state.t), N - 1)].title;
      else {
        const active = FIT_STAGES.filter(s => { const d = stageDates(s, hh); return d.start <= curDate && curDate < d.end; });
        txt = active.length ? active[active.length - 1].title : 'between stages';
      }
      return `<li${hh === state.house ? ' class="sel"' : ''}><b>H${hh + 1}</b><span>${esc(txt)}</span></li>`;
    }).join('');
  }
}
$('#flowline').addEventListener('click', e => { const g = e.target.closest('g[data-h]'); if (g) setHouse(+g.dataset.h); });

// ------------------------------------------------------------------ transport
function syncPlay() { $('#play').dataset.on = state.playing; $('#play').setAttribute('aria-label', state.playing ? 'Pause' : 'Play'); }
function jumpTo(i) {
  state.playing = false; syncPlay(); state.playTo = null;
  state.t = i + 0.999;
  if (state.autoCam) goView(FIT_STAGES[i].view);
  updateReadout();
}
function step(dir) {
  const i = Math.min(Math.floor(state.t), N - 1), target = i + dir;
  if (target < 0 || target >= N) return;
  if (state.autoCam && FIT_STAGES[target].view !== FIT_STAGES[i].view) goView(FIT_STAGES[target].view);
  if (dir > 0) { state.t = target; state.playTo = target + 0.999; } else { state.t = target + 0.999; state.playTo = null; }
  updateReadout();
}
$('#play').addEventListener('click', () => { if (state.t >= N - 0.001) state.t = 0; state.playing = !state.playing; state.playTo = null; syncPlay(); });
$('#prev').addEventListener('click', () => { state.playing = false; syncPlay(); step(-1); });
$('#next').addEventListener('click', () => { state.playing = false; syncPlay(); step(1); });
$('#speed').addEventListener('change', e => { state.speed = +e.target.value; });
scrub.addEventListener('input', () => { state.t = +scrub.value; state.playing = false; state.playTo = null; syncPlay(); updateReadout(); });
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => goView(b.dataset.view)));
const bind = (id, key, after) => { const el = document.getElementById(id); el.checked = state[key]; el.addEventListener('change', () => { state[key] = el.checked; after && after(); }); };
bind('tg-ghost', 'ghost'); bind('tg-hl', 'highlight'); bind('tg-cut', 'cutaway'); bind('tg-lbl', 'labels'); bind('tg-ctx', 'ctx'); bind('tg-cam', 'autoCam'); bind('tg-ceil', 'ceilings');
bind('tg-explode', 'exploded', () => goView(currentView));
window.addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea')) return;
  if (e.key === ' ') { e.preventDefault(); $('#play').click(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); $('#next').click(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); $('#prev').click(); }
  else if (/^[1-5]$/.test(e.key)) setHouse(+e.key - 1);
});

function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(host); resize();

let last = performance.now();
const STAGE_SECONDS = 4;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (state.playing) { state.t = Math.min(N, state.t + dt * state.speed / STAGE_SECONDS); if (state.t >= N) { state.playing = false; syncPlay(); } updateReadout(); }
  else if (state.playTo != null) { state.t = Math.min(state.playTo, state.t + dt * Math.max(1, state.speed) / STAGE_SECONDS * 1.5); if (state.t >= state.playTo) state.playTo = null; updateReadout(); }
  if (tween) { const k = ease(Math.min(1, (now - tween.t0) / tween.dur)); camera.position.lerpVectors(tween.from.pos, tween.to.pos, k); controls.target.lerpVectors(tween.from.tgt, tween.to.tgt, k); if (k >= 1) tween = null; }
  explodeAmt += (explodeTarget - explodeAmt) * (reduceMotion ? 1 : Math.min(1, dt * 4));
  if (Math.abs(explodeTarget - explodeAmt) < 0.001) explodeAmt = explodeTarget;
  controls.update(); update(now); world.tick(now); renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// deep links: #h3 or #h3-tile
const m = location.hash.match(/^#h([1-5])(?:-(\w+))?$/);
if (m) { state.house = +m[1] - 1; picker.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.h === state.house)); if (m[2]) { const i = FIT_STAGES.findIndex(s => s.id === m[2]); if (i >= 0) state.t = i + 0.999; } }
renderRegister();
goView(FIT_STAGES[Math.floor(Math.min(state.t, N - 1))].view, true);
updateReadout(); syncPlay();
requestAnimationFrame(frame);
// frame-exact hook used to record the sequence as a video
let camStage = -1;
function setT(t) {
  const i = Math.min(Math.floor(t), N - 1);
  if (i !== camStage) { camStage = i; if (state.autoCam) goView(FIT_STAGES[i].view, true); explodeAmt = explodeTarget; }
  state.playing = false; state.playTo = null; state.t = t; updateReadout();
}
window.__fo = { state, jumpTo, setHouse, goView, setT, N, cam: ([p, t]) => { tween = null; camera.position.set(...p); controls.target.set(...t); controls.update(); } };
