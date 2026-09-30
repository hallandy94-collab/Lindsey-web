// Exports the completed project as one binary glTF (.glb): the finished building with all five
// houses fitted out, the street, neighbours and suburb, in true orientation (x east-west mirrored
// back, y up, metres). Materials carry their surface names (concrete, oak, glass, water…) so a
// renderer can swap in its own PBR library. Open tools/export.html and press the button, or call
// window.__export() from a script.

import * as THREE from 'three';
import { GLTFExporter } from '../vendor/GLTFExporter.js';
import { STAGES } from './stages.js';
import { buildModel, houseX } from './model.js';
import { FIT_STAGES } from './fitout-stages.js';
import { buildHouse } from './fitout-model.js';
import { realify, buildSuburb } from './realism.js';
import { furnishHouse } from './furniture.js';

export function buildCompleted({ suburb = true, interiors = true } = {}) {
  const scene = new THREE.Scene();
  const MIRROR = new THREE.Group(); MIRROR.scale.x = -1; scene.add(MIRROR);
  const bIndex = id => STAGES.findIndex(s => s.id === id);
  const bld = buildModel(bIndex);
  MIRROR.add(bld.root);
  const hideInHouse = new Set(['fitout', 'services']);
  for (const o of bld.items) {
    const el = o.userData.el;
    o.visible = !(el.temp || el.rs != null || o.isSprite || (interiors && hideInHouse.has(STAGES[el.s].id)));
  }
  bld.root.traverse(o => { if (o.isSprite || (o.isMesh && o.material?.isMeshBasicMaterial)) o.visible = false; });
  if (interiors) {
    const fIndex = id => FIT_STAGES.findIndex(s => s.id === id);
    const hidden = new Set(['plumb', 'elec', 'ufh', 'insul', 'hvac', 'frame', 'preline']);
    for (let h = 0; h < 5; h++) {
      const house = buildHouse(fIndex);
      house.root.position.set(houseX(h) + 0.075, 4.61, 0);
      house.shell.visible = false; house.nearWall.visible = false; house.context.visible = false; house.labels.visible = false;
      for (const o of house.items) {
        const el = o.userData.el;
        o.visible = !(el.temp || el.hideAfter != null || o.isSprite || hidden.has(FIT_STAGES[el.s].id));
      }
      furnishHouse(house.root, h);
      MIRROR.add(house.root);
    }
  }
  realify(MIRROR);
  if (suburb) { const w = new THREE.Group(); buildSuburb(w, new THREE.Vector3(-22.3, 0, 12)); scene.add(w); }
  // drop hidden objects so the file only carries the finished project
  const dead = [];
  scene.traverse(o => { if (!o.visible) dead.push(o); });
  dead.forEach(o => o.parent && o.parent.remove(o));
  scene.updateMatrixWorld(true);
  return scene;
}

export async function exportGLB(opts) {
  const scene = buildCompleted(opts);
  await new Promise(r => setTimeout(r, 2500));          // let the textures finish loading
  const ex = new GLTFExporter();
  return await ex.parseAsync(scene, { binary: true, maxTextureSize: 1024 });
}

window.__export = async (opts) => {
  const buf = await exportGLB(opts);
  const bytes = new Uint8Array(buf); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const btn = document.getElementById('go');
if (btn) btn.addEventListener('click', async () => {
  btn.disabled = true; btn.textContent = 'Building…';
  const buf = await exportGLB();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
  a.download = 'Goldie_Street_Completed.glb'; a.click();
  btn.disabled = false; btn.textContent = 'Download again';
});
