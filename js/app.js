import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { STAGES, PACKAGES, PROJECT } from './stages.js';
import { buildModel, DIM } from './model.js';

const N = STAGES.length;
const stageIndex = id => {
  const i = STAGES.findIndex(s => s.id === id);
  if (i < 0) throw new Error('Unknown stage ' + id);
  return i;
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ scene
const host = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = !/[?&]rec\b/.test(location.search); // ?rec: faster frames for video capture
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = false;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.3, 600);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 4; controls.maxDistance = 220;

scene.add(new THREE.HemisphereLight(0xf4f7fb, 0x5a5146, 1.25));
const sun = new THREE.DirectionalLight(0xfff4e2, 2.2);
sun.position.set(-30, 60, -18); // afternoon sun from the north-west (southern hemisphere)
sun.target.position.set(15, 0, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 5, far: 160 });
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);

const { root, items, context, ground } = buildModel(stageIndex);
scene.add(root);

// Per-item animation setup
const ghostMat = new THREE.LineBasicMaterial({ color: 0x33414f, transparent: true, opacity: 0.11, depthWrite: false });
const box3 = new THREE.Box3();
items.forEach(o => {
  const el = o.userData.el;
  el.base = { pos: o.position.clone(), scale: o.scale.clone() };
  box3.setFromObject(o);
  el.bottom = box3.min.y; el.top = box3.max.y;
  el.mats = [];
  // wireframe "ghost" of the finished work, shown before the element is built
  if (o.isMesh && !el.temp && !el.soil) {
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), ghostMat);
    edges.visible = false; edges.raycast = () => {};
    o.add(edges); el.edges = edges;
  }
  o.traverse(c => {
    if (c.isLineSegments) return;
    if (c.material) {
      const m = c.material;
      el.mats.push({ m, op: m.opacity, tr: m.transparent, em: m.emissive ? m.emissive.clone() : null });
    }
  });
});
// timing windows inside each stage by seq rank
function assignWindows(key, seqKey, d0Key, d1Key) {
  const byStage = new Map();
  items.forEach(o => {
    const el = o.userData.el; const s = el[key];
    if (s == null) return;
    if (!byStage.has(s)) byStage.set(s, []);
    byStage.get(s).push(o);
  });
  byStage.forEach(list => {
    const seqs = [...new Set(list.map(o => o.userData.el[seqKey]))].sort((a, b) => a - b);
    const n = seqs.length;
    const w = n === 1 ? 0.9 : Math.min(0.9, Math.max(0.16, 1.8 / n));
    list.forEach(o => {
      const el = o.userData.el; const r = seqs.indexOf(el[seqKey]);
      el[d0Key] = n === 1 ? 0.05 : 0.02 + (r / (n - 1)) * (0.96 - w);
      el[d1Key] = el[d0Key] + w;
    });
  });
}
assignWindows('s', 'seq', 'd0', 'd1');
assignWindows('rs', 'rseq', 'rd0', 'rd1');

// ------------------------------------------------------------------ state
const state = {
  t: 0, playing: false, speed: 1,
  ghost: true, temp: true, ctx: true, highlight: true, autoCam: true, xray: true,
  explode: 0, explodeTarget: 0,
  cutZ: 0, cutLevel: 'all',
};
let lastStage = -1;

const prog = (t, s, d0, d1) => {
  const a = t - s;
  if (a <= d0) return 0;
  if (a >= d1) return 1;
  return (a - d0) / (d1 - d0);
};
const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const accentColor = new THREE.Color();

function setOpacity(el, k) {
  for (const r of el.mats) {
    const o = r.op * k;
    r.m.opacity = o;
    r.m.transparent = r.tr || k < 0.999;
    r.m.depthWrite = k > 0.5 && !(r.tr && r.op < 0.5);
  }
}
function setEmissive(el, on) {
  for (const r of el.mats) {
    if (!r.em) continue;
    if (on) r.m.emissive.copy(accentColor).multiplyScalar(0.35); else r.m.emissive.copy(r.em);
  }
}

function update(time) {
  const t = state.t;
  const cs = Math.min(Math.floor(t), N - 1);
  const expl = state.explode;
  for (const o of items) {
    const el = o.userData.el;
    if (el.temp && !state.temp) { o.visible = false; continue; }
    const e = el.anim === 'none' ? 1 : prog(t, el.s, el.d0, el.d1);
    const r = el.rs == null ? 0 : prog(t, el.rs, el.rd0, el.rd1);
    if (r >= 1) { o.visible = false; continue; }
    o.position.copy(el.base.pos); o.scale.copy(el.base.scale);
    if (e <= 0) {
      if (state.ghost && el.edges) {
        o.visible = true; setOpacity(el, 0); el.edges.visible = true; setEmissive(el, false);
        for (const r of el.mats) r.m.visible = false;
      } else o.visible = false;
      continue;
    }
    o.visible = true;
    if (el.edges) el.edges.visible = false;
    for (const r of el.mats) r.m.visible = true;
    const k = ease(e);
    let op = 1;
    switch (el.anim) {
      case 'drop': o.position.y += (1 - k) * 5; op = Math.min(1, e * 2.5); break;
      case 'fade': op = k; break;
      case 'rise': o.scale.y = el.base.scale.y * Math.max(k, 0.001); o.position.y = el.bottom - (el.bottom - el.base.pos.y) * Math.max(k, 0.001); break;
      case 'bore': o.scale.y = el.base.scale.y * Math.max(k, 0.001); o.position.y = el.top - (el.top - el.base.pos.y) * Math.max(k, 0.001); break;
      case 'grow': o.scale.setScalar(Math.max(k, 0.001)); break;
    }
    if (r > 0) {
      const rk = ease(r);
      if (el.ranim === 'dig') { const s = Math.max(1 - rk, 0.001); o.scale.y = el.base.scale.y * s; o.position.y = el.bottom - (el.bottom - el.base.pos.y) * s; }
      else op *= 1 - rk;
    }
    // exploded tanking: each layer lifts and steps back so every edge shows, like a build-up detail
    if (typeof el.layer === 'number' && el.layer <= 4) { o.position.y += el.layer * 0.45 * expl; o.position.z += el.layer * 2.4 * expl; }
    if (el.soil && state.xray) op *= 0.25;
    setOpacity(el, op);
    setEmissive(el, state.highlight && !el.temp && el.s === cs && t < N);

    // living details
    if (el.rigPath && e > 0) {
      const p = prog(t, el.s, 0, 1);
      const pt = el.rigPath[Math.min(el.rigPath.length - 1, Math.floor(p * el.rigPath.length))];
      o.position.x = pt[0] + (pt[1] < 0.5 ? 0 : pt[0] > DIM.W - 1 ? -3 : 3);
      o.position.z = pt[1] < 0.5 ? 3 : pt[1];
    }
    if (el.drive && !reduceMotion) o.position.x = -14 + ((time * 0.004) % 60);
    // cranes relocate between planned set-ups through a stage, and slew towards the work
    if (el.setups) {
      const list = el.setups[STAGES[cs].id] || el.setups[STAGES[el.s].id];
      if (list) {
        const p = STAGES[cs].id in el.setups ? t - cs : 1;
        const pt = list[Math.min(list.length - 1, Math.floor(p * list.length))];
        o.position.x = pt[0]; o.position.z = pt[1];
      }
    }
    if (el.slew && o.userData.slewGroup) {
      const a = Math.atan2(el.slew[0] - o.position.x, el.slew[1] - o.position.z);
      o.userData.slewGroup.rotation.y = a + (reduceMotion ? 0 : Math.sin(time * 0.0004) * 0.35);
    }
  }
  context.visible = state.ctx;
  // see-through ground only while the work is in the ground (up to the ramps), so services
  // under the road and the piles show; the finished street stays solid after that
  const xr = state.xray && cs <= XRAY_LAST;
  if (groundX !== xr) {
    groundX = xr;
    const set = c => { if (c.material) { c.material.transparent = xr; c.material.opacity = xr ? 0.3 : 1; c.material.depthWrite = !xr; } };
    ground.traverse(set);
    context.children.forEach(c => { if (c.userData.surface) set(c); });
  }
}
let groundX = null;
const XRAY_LAST = stageIndex('ramps');

// ------------------------------------------------------------------ clipping
// interior stages are shown through a section cut so the work inside can be seen
const STAGE_CUT = { services: 6, fitout: 6 };
function stageCut(i) {
  if (!state.autoCam) return;
  state.cutZ = STAGE_CUT[STAGES[i].id] || 0;
  const el = document.getElementById('cutz'); if (el) el.value = state.cutZ;
  const v = document.getElementById('cutz-v'); if (v) v.textContent = state.cutZ > 0 ? `${state.cutZ.toFixed(1)} m` : 'Off';
  applyClipping();
}
function applyClipping() {
  const planes = [];
  if (state.cutZ > 0) planes.push(new THREE.Plane(new THREE.Vector3(0, 0, 1), -state.cutZ));
  const lv = { all: null, l2: DIM.ROOF - 0.5, l1: DIM.L2 - 0.3, lg: DIM.L1 - 0.3, l0: DIM.LG - 0.3 }[state.cutLevel];
  if (lv != null) planes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), lv));
  renderer.clippingPlanes = planes;
}

// ------------------------------------------------------------------ camera
const VIEWS = {
  iso: { pos: [-24, 30, -30], tgt: [15, 5, 14] },
  street: { pos: [15, 15, -31], tgt: [15, 6.5, 8] },
  plan: { pos: [15.1, 78, 18], tgt: [15, 0, 17.9] },
  basement: { pos: [-14, 24, -12], tgt: [15, 1.5, 13] },
  rear: { pos: [48, 26, 66], tgt: [15, 5, 22] },
  pools: { pos: [38, 13, 52], tgt: [14, 3.9, 32] },
  road: { pos: [-10, 13, -24], tgt: [14, 1.2, -5] },
};
const STAGE_VIEW = {
  est: 'iso', piles: 'iso', reroute: 'road', dig: 'basement', capping: 'basement', drain: 'basement',
  tank: 'basement', slab: 'basement', ducts: 'road', ramps: 'basement', undercroft: 'basement', pools: 'rear',
  lg: 'iso', w1: 'iso', l1: 'iso', w2: 'iso', l2: 'iso', xmas: 'iso', roof: 'iso', membrane: 'street',
  joinery: 'street', facade: 'street', doors: 'street', services: 'iso', fitout: 'iso', strike: 'street', extslab: 'rear', extpool: 'pools', extdeck: 'rear', extfront: 'street', soft: 'rear', pc: 'iso',
};
let camTween = null;
function goView(name, instant) {
  const v = VIEWS[name]; if (!v) return;
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === name));
  const to = { pos: new THREE.Vector3(...v.pos), tgt: new THREE.Vector3(...v.tgt) };
  if (instant || reduceMotion) { camera.position.copy(to.pos); controls.target.copy(to.tgt); controls.update(); return; }
  camTween = { from: { pos: camera.position.clone(), tgt: controls.target.clone() }, to, t0: performance.now(), dur: 1100 };
}
function tickCamera(now) {
  if (!camTween) return;
  const k = ease(Math.min(1, (now - camTween.t0) / camTween.dur));
  camera.position.lerpVectors(camTween.from.pos, camTween.to.pos, k);
  controls.target.lerpVectors(camTween.from.tgt, camTween.to.tgt, k);
  if (k >= 1) camTween = null;
}
controls.addEventListener('start', () => { camTween = null; document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', 'false')); });

// ------------------------------------------------------------------ theme
function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  ghostMat.color.set(cs.getPropertyValue('--ghost').trim() || '#33414f');
  scene.background = new THREE.Color(cs.getPropertyValue('--sky').trim() || '#dde5ea');
  scene.fog = new THREE.Fog(scene.background, 120, 320);
  accentColor.set(cs.getPropertyValue('--accent').trim() || '#1f5fbf');
}
readTokens();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTokens);
new MutationObserver(readTokens).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ------------------------------------------------------------------ UI
const $ = s => document.querySelector(s);
const fmt = d => d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtShort = d => d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
const toDate = s => new Date(s + 'T00:00:00');
const START = toDate(PROJECT.start);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const scrub = $('#scrub');
scrub.max = N; scrub.step = 0.001;

// tick marks & milestones on the scrubber track
const ticks = $('#ticks');
STAGES.forEach((s, i) => {
  const d = document.createElement('span');
  d.className = 'tick' + (s.milestone ? ' ms' : '');
  d.style.left = `${(i / N) * 100}%`;
  if (s.milestone) d.title = s.milestone;
  ticks.appendChild(d);
});

// sequence list
const list = $('#seq');
STAGES.forEach((s, i) => {
  const li = document.createElement('li');
  li.innerHTML = `<button type="button" data-i="${i}"><span class="dot"></span><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="tt">${esc(s.title)}</span><span class="dt">${fmtShort(toDate(s.start))}</span></button>`;
  list.appendChild(li);
});
list.addEventListener('click', e => {
  const b = e.target.closest('button[data-i]'); if (!b) return;
  jumpTo(+b.dataset.i);
});

function renderStage(i) {
  const s = STAGES[i];
  $('#st-n').textContent = `Stage ${String(i + 1).padStart(2, '0')} of ${N}`;
  $('#st-title').textContent = s.title;
  $('#st-pkg').textContent = PACKAGES[s.pkg];
  $('#st-pkg').dataset.pkg = s.pkg;
  $('#st-wk').textContent = `Wk ${s.wk}`;
  $('#st-dates').textContent = `${fmtShort(toDate(s.start))} – ${fmt(toDate(s.end))}`;
  $('#st-ms').hidden = !s.milestone; $('#st-ms').textContent = s.milestone || '';
  $('#st-what').textContent = s.what;
  $('#st-crane-wrap').hidden = !s.crane; $('#st-crane').textContent = s.crane || '';
  $('#st-qty').innerHTML = s.qty.map(q => `<li>${esc(q)}</li>`).join('');
  $('#st-holds').innerHTML = s.holds.map(q => `<li>${esc(q)}</li>`).join('');
  $('#st-plant').textContent = s.plant;
  $('#st-crew').textContent = s.crew ? `${s.crew} on site` : '–';
  $('#st-note').hidden = !s.note; $('#st-note').textContent = s.note || '';
  const def = $('#st-def');
  def.hidden = !s.defences;
  if (s.defences) $('#st-def-list').innerHTML = s.defences.map(([a, b], k) => `<li><b>${k + 1}. ${esc(a)}</b><span>${esc(b)}</span></li>`).join('');
  $('#explode-wrap').hidden = !s.water && !['drain', 'slab'].includes(s.id);
  $('#flow').hidden = !s.flow;
  list.querySelectorAll('button').forEach((b, k) => {
    b.dataset.state = k < i ? 'done' : k === i ? 'now' : 'next';
    if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
  // keep the current stage in view inside the register (desktop only – on phones the list is not a scroller)
  const cur = list.querySelector('[aria-current]');
  if (cur && !state.userScrolling && list.scrollHeight > list.clientHeight + 4) {
    const top = cur.offsetTop - list.offsetTop, h = cur.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top - 8;
    else if (top + h > list.scrollTop + list.clientHeight) list.scrollTop = top + h - list.clientHeight + 8;
  }
}

function updateReadout() {
  const t = Math.min(state.t, N - 0.0001);
  const i = Math.floor(t), s = STAGES[i];
  const a = toDate(s.start), b = toDate(s.end);
  const d = new Date(a.getTime() + (b - a) * (t - i));
  const wk = Math.floor((d - START) / 864e5 / 7) + 1;
  $('#date').textContent = fmt(d);
  $('#week').textContent = `Week ${wk}`;
  scrub.value = state.t;
  scrub.style.setProperty('--p', `${(state.t / N) * 100}%`);
  if (i !== lastStage) {
    if (state.playing && state.autoCam && lastStage >= 0) { goView(STAGE_VIEW[s.id]); stageCut(i); }
    lastStage = i; renderStage(i);
  }
  // flow-line house indicator
  if (s.flow) {
    const p = t - i;
    document.querySelectorAll('#flow i').forEach((el, h) => { el.dataset.s = p > (h + 1) / 5 ? 'done' : p > h / 5 ? 'now' : 'next'; });
  }
}

function jumpTo(i, keepCam) {
  state.playing = false; syncPlay();
  state.t = Math.min(i + 0.999, N);
  if (state.autoCam && !keepCam) { goView(STAGE_VIEW[STAGES[i].id]); stageCut(i); }
  updateReadout();
}
// Next: play the following stage from its start. Previous: show the stage before, complete.
function step(dir) {
  const i = Math.min(Math.floor(state.t), N - 1);
  const target = i + dir;
  if (target < 0 || target >= N) return;
  if (state.autoCam) { goView(STAGE_VIEW[STAGES[target].id]); stageCut(target); }
  if (dir > 0) { state.t = target; state.playTo = target + 0.999; }
  else { state.t = target + 0.999; state.playTo = null; }
  updateReadout();
}

function syncPlay() {
  $('#play').setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
  $('#play').dataset.on = state.playing;
}
$('#play').addEventListener('click', () => {
  if (state.t >= N - 0.001) state.t = 0;
  state.playing = !state.playing; state.playTo = null; syncPlay();
});
$('#prev').addEventListener('click', () => { state.playing = false; syncPlay(); step(-1); });
$('#next').addEventListener('click', () => { state.playing = false; syncPlay(); step(1); });
$('#speed').addEventListener('change', e => { state.speed = +e.target.value; });
scrub.addEventListener('input', () => { state.t = +scrub.value; state.playing = false; state.playTo = null; syncPlay(); updateReadout(); });

document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => goView(b.dataset.view)));
const bindToggle = (id, key, after) => {
  const el = document.getElementById(id);
  el.checked = state[key];
  el.addEventListener('change', () => { state[key] = el.checked; after && after(); });
};
bindToggle('tg-ghost', 'ghost');
bindToggle('tg-temp', 'temp');
bindToggle('tg-ctx', 'ctx');
bindToggle('tg-hl', 'highlight');
bindToggle('tg-cam', 'autoCam');
bindToggle('tg-xray', 'xray');
$('#explode').addEventListener('change', e => {
  state.explodeTarget = e.target.checked ? 1 : 0;
  if (e.target.checked) goView('basement');
});
$('#cutz').addEventListener('input', e => { state.cutZ = +e.target.value; $('#cutz-v').textContent = state.cutZ > 0 ? `${state.cutZ.toFixed(1)} m` : 'Off'; applyClipping(); });
$('#cutlv').addEventListener('change', e => { state.cutLevel = e.target.value; applyClipping(); });

list.addEventListener('pointerenter', () => { state.userScrolling = true; });
list.addEventListener('pointerleave', () => { state.userScrolling = false; });

window.addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea')) return;
  if (e.key === ' ') { e.preventDefault(); $('#play').click(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); $('#next').click(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); $('#prev').click(); }
});

// ------------------------------------------------------------------ loop
function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);
resize();

let last = performance.now();
const STAGE_SECONDS = 5;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (state.playing) {
    state.t = Math.min(N, state.t + dt * state.speed / STAGE_SECONDS);
    if (state.t >= N) { state.playing = false; syncPlay(); }
    updateReadout();
  } else if (state.playTo != null) {
    state.t = Math.min(state.playTo, state.t + dt * Math.max(state.speed, 1) / STAGE_SECONDS * 1.6);
    if (state.t >= state.playTo) state.playTo = null;
    updateReadout();
  }
  state.explode += (state.explodeTarget - state.explode) * Math.min(1, dt * 5);
  tickCamera(now);
  controls.update();
  update(now);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// start on the first stage, fully built, so the first frame shows work on site
const initial = (() => { const h = location.hash.replace('#', ''); const i = STAGES.findIndex(s => s.id === h); return i >= 0 ? i : 0; })();
state.t = initial + 0.999;
goView(STAGE_VIEW[STAGES[initial].id], true);
applyClipping();
updateReadout();
syncPlay();
requestAnimationFrame(frame);
// frame-exact hook used to record the sequence as a video
let camStage = -1;
function setT(t) {
  const i = Math.min(Math.floor(t), N - 1);
  if (i !== camStage) { camStage = i; if (state.autoCam) { goView(STAGE_VIEW[STAGES[i].id], true); stageCut(i); } }
  state.playing = false; state.playTo = null; state.t = t; updateReadout();
}
window.__gs = { state, goView, jumpTo, setT, N, cam: ([p, t]) => { camTween = null; camera.position.set(...p); controls.target.set(...t); controls.update(); } };
