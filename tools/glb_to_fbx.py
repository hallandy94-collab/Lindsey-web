"""Convert a Goldie Street GLB to FBX for Twinmotion / Lumion / D5 (textures embedded, hierarchy kept).

    python3 tools/glb_to_fbx.py in.glb out.fbx

Twinmotion ignores vertex colours, so the leaf and dug-clay materials get a matching base colour.
"""
import sys
import bpy

src, dst = sys.argv[1], sys.argv[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src, merge_vertices=False)
BASE = {'leaf': (0.07, 0.12, 0.045, 1), 'clay': (0.42, 0.31, 0.2, 1)}
for m in bpy.data.materials:
    key = m.name.split('.')[0]
    if key in BASE and m.use_nodes:
        for nd in m.node_tree.nodes:
            if nd.type == 'BSDF_PRINCIPLED':
                for l in list(nd.inputs['Base Color'].links):
                    m.node_tree.links.remove(l)
                nd.inputs['Base Color'].default_value = BASE[key]
for o in list(bpy.data.objects):
    if o.type in ('CAMERA', 'LIGHT'):
        bpy.data.objects.remove(o)

# FBX has no texture transform, so bake each material's glTF texture transform (Mapping node)
# into the UVs of the faces that use it, then wire UV -> image directly.
import math
from mathutils import Matrix, Vector


def mapping_of(mat):
    if not mat or not mat.use_nodes:
        return None
    for nd in mat.node_tree.nodes:
        if nd.type == 'MAPPING':
            return nd
    return None


done = set()
for o in bpy.data.objects:
    if o.type != 'MESH' or not o.data.uv_layers:
        continue
    me = o.data
    uv = me.uv_layers.active.data
    for si, slot in enumerate(o.material_slots):
        mp = mapping_of(slot.material)
        if mp is None or (me.name, si) in done:
            continue
        done.add((me.name, si))
        t = mp.inputs['Location'].default_value; r = mp.inputs['Rotation'].default_value[2]; sc = mp.inputs['Scale'].default_value
        c, s_ = math.cos(r), math.sin(r)
        for poly in me.polygons:
            if poly.material_index != si:
                continue
            for li in poly.loop_indices:
                x, y = uv[li].uv
                x, y = x * sc[0], y * sc[1]
                uv[li].uv = (x * c - y * s_ + t[0], x * s_ + y * c + t[1])
for m in bpy.data.materials:
    mp = mapping_of(m)
    if mp is None:
        continue
    nt = m.node_tree
    src = mp.inputs['Vector'].links[0].from_socket if mp.inputs['Vector'].links else None
    for l in list(mp.outputs[0].links):
        to = l.to_socket
        nt.links.remove(l)
        if src is not None:
            nt.links.new(src, to)
    nt.nodes.remove(mp)
print('baked texture transforms on %d mesh/material pairs' % len(done))

# FBX also has no colour factor on a texture: bake glTF's  image x baseColorFactor  (a MULTIPLY
# Mix node) into a tinted copy of the image, so tinted surfaces (lawns, membrane...) keep their look.
import numpy as np
tinted = {}
nmix = 0
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None or not bsdf.inputs['Base Color'].is_linked:
        continue
    mix = bsdf.inputs['Base Color'].links[0].from_node
    if mix.type != 'MIX':
        continue
    img_node, col = None, None
    for inp in mix.inputs:
        if inp.is_linked and inp.links[0].from_node.type == 'TEX_IMAGE':
            img_node = inp.links[0].from_node
        elif inp.type == 'RGBA' and not inp.is_linked:
            col = tuple(inp.default_value)
    if img_node is None or col is None or img_node.image is None:
        continue
    key = (img_node.image.name, tuple(round(c, 3) for c in col[:3]))
    if key not in tinted:
        src = img_node.image
        px = np.array(src.pixels[:], dtype=np.float32).reshape(-1, 4)
        # image pixels are sRGB-encoded, the factor is linear: decode, multiply, re-encode
        rgb = px[:, :3]
        lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4) * np.array(col[:3], dtype=np.float32)
        px[:, :3] = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(np.maximum(lin, 0), 1 / 2.4) - 0.055)
        im = bpy.data.images.new(src.name + '_tint', src.size[0], src.size[1], alpha=True)
        im.pixels = px.ravel().tolist()
        # write it to disk so the FBX exporter can embed it like the others
        import os, tempfile
        fp = os.path.join(tempfile.gettempdir(), 'gs_tint_%d.png' % len(tinted))
        im.filepath_raw = fp; im.file_format = 'PNG'; im.save()
        im.filepath = fp
        tinted[key] = im
    img_node.image = tinted[key]
    nt.links.new(img_node.outputs['Color'], bsdf.inputs['Base Color'])
    nt.nodes.remove(mix)
    nmix += 1
print('baked colour tints into %d materials (%d new images)' % (nmix, len(tinted)))
# glTF images arrive unnamed ("Image_0"…); in an FBX they would collide and every material would
# end up showing the same picture. Name each after the first material that uses it, and give it a
# matching unique file name for embedding.
import os, tempfile
named = set()
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    for nd in m.node_tree.nodes:
        if nd.type == 'TEX_IMAGE' and nd.image and nd.image.name not in named:
            im = nd.image
            base = '%s_%s' % (m.name.split('.')[0], 'color' if im.colorspace_settings.name == 'sRGB' else 'data')
            nm, k = base, 1
            while nm in named:
                k += 1; nm = '%s_%d' % (base, k)
            im.name = nm
            d = os.path.join(tempfile.gettempdir(), 'gs_tex'); os.makedirs(d, exist_ok=True)
            if im.packed_file:                      # original JPEG/PNG bytes from the GLB
                data = bytes(im.packed_file.data)
                ext = '.jpg' if data[:3] == b'\xff\xd8\xff' else '.png'
                fp = os.path.join(d, nm + ext)
                open(fp, 'wb').write(data)
                im.filepath = fp
                im.unpack(method='REMOVE')
            elif im.filepath and os.path.exists(bpy.path.abspath(im.filepath)):   # baked tint images
                fp = os.path.join(d, nm + '.png'); import shutil; shutil.copy(bpy.path.abspath(im.filepath), fp); im.filepath = fp
            im.reload()
            named.add(nm)
print('named %d textures' % len(named))
bpy.ops.export_scene.fbx(filepath=dst, use_selection=False, apply_unit_scale=True, apply_scale_options='FBX_SCALE_UNITS',
                         path_mode='COPY', embed_textures=True, use_mesh_modifiers=True, mesh_smooth_type='FACE',
                         bake_space_transform=False, object_types={'EMPTY', 'MESH'}, use_custom_props=False)
print('wrote', dst)
