#!/usr/bin/env python3
"""Photoreal Cycles render pipeline for Goldie Street / Vellenoweth Green Residences.

    python3 tools/render_blender.py --glb goldie.glb --out renders [--samples N] [--res WxH]
                                    [--shots street_hero,aerial] [--preview]

Imports the three.js GLB export (tools/export.html), rebuilds every material as a physically
based Cycles shader (world-scale triplanar textures from ../textures with luminance bump and
roughness variation, thin architectural glass, pool water with volume and waves, APL dark-bronze
joinery, leaf translucency), lights it with a Nishita sky plus a matching sun for St Heliers
(-36.85, 174.86), scatters grass blades near each camera, and renders the named shots with
Cycles on the CPU, denoised with OpenImageDenoise. PNGs go to <out>/png, JPEG q90 copies to
<out>/Goldie_Street_<shot>.jpg, and <out>/README.md is regenerated with cameras, sun and timings.

Coordinates: the GLB is glTF Y-up metres. Shots are written in glTF/world coordinates
(x: north +, y: up, z: east +) and converted with g2b(x, y, z) = (x, -z, y).
The first import of a GLB is cached as a .blend (keyed by path, size and mtime), so re-renders
after the first skip the ~5 min glTF import. Use --no-cache to force a fresh import.
"""
import argparse
import json
import math
import os
import re
import sys
import tempfile
import time

import bpy
import bmesh
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
TEX_DIR = os.path.join(REPO, 'textures')

# ----------------------------------------------------------------------------- surfaces
# Mirrors SURF in js/realism.js (parsed from it at run time when present; this is the fallback).
SURF = {
    'concrete': ('concrete', 2.4, 0xffffff, 0.78, 0, 0.6), 'concreteSmooth': ('concrete', 2.4, 0xf4f2ee, 0.55, 0, 0.3),
    'concreteDark': ('concrete_dark', 2.4, 0xffffff, 0.85, 0, 0.6), 'slabFloat': ('concrete_dark', 3, 0xe6e3dc, 0.42, 0, 0.2),
    'shotcrete': ('shotcrete', 1.6, 0xffffff, 0.95, 0, 2), 'asphalt': ('asphalt', 2, 0xffffff, 0.9, 0, 1.2),
    'paving': ('paving', 1.5, 0xffffff, 0.8, 0, 0.5), 'aggregate': ('aggregate', 0.8, 0xffffff, 0.7, 0, 1.5),
    'gravel': ('gravel', 1.2, 0xffffff, 1, 0, 2.5), 'sand': ('gravel', 0.6, 0xe9d6a6, 1, 0, 0.6),
    'soil': ('soil', 3, 0xffffff, 1, 0, 2), 'soilDeep': ('soil', 3, 0xb8a48c, 1, 0, 2), 'mulch': ('mulch', 1.2, 0xffffff, 1, 0, 2),
    'grass': ('grass', 3.5, 0xd8e6c8, 1, 0, 1), 'reserve': ('grass', 5, 0xe6f0d0, 1, 0, 1),
    'render': ('render', 1.2, 0xffffff, 0.9, 0, 0.8), 'renderNeighbour': ('render', 1.2, 0xf1ede4, 0.9, 0, 0.8),
    'grc': ('concrete', 3, 0xf6efe2, 0.6, 0, 0.3), 'membrane': ('membrane', 1, 0xffffff, 0.75, 0, 1),
    'membraneLight': ('membrane', 1, 0xd0d4d8, 0.7, 0, 1), 'block': ('block', 0.8, 0xffffff, 0.9, 0, 1.2),
    'tile': ('tile', 1.2, 0xffffff, 0.35, 0, 0.2), 'stone': ('stone', 1.5, 0xffffff, 0.5, 0, 0.3),
    'marble': ('marble', 1.5, 0xffffff, 0.18, 0, 0), 'carpet': ('carpet', 0.6, 0xffffff, 1, 0, 1),
    'oak': ('oak', 1.6, 0xd9c3a3, 0.5, 0, 0.3), 'oakDark': ('oak', 1.6, 0x6a5646, 0.55, 0, 0.3),
    'cedar': ('slats', 1.44, 0xffffff, 0.85, 0, 0.6), 'decking': ('slats', 1.44, 0xc8bba8, 0.8, 0, 0.6),
    'plywood': ('plywood', 1.2, 0xffffff, 0.8, 0, 0.4), 'timber': ('plywood', 0.9, 0xf2dcb4, 0.8, 0, 0.3),
    'timberDark': ('plywood', 1.2, 0x8a6a48, 0.9, 0, 0.3), 'xps': ('xps', 1.2, 0xffffff, 0.9, 0, 0.3),
    'drainboard': ('drainboard', 0.6, 0xffffff, 0.6, 0, 1.5), 'galv': ('galv', 1, 0xffffff, 0.45, 0.8, 0.1),
    'paint': ('paint', 1.5, 0xffffff, 0.6, 0, 0.1), 'paintSatin': ('paint', 1.5, 0xffffff, 0.45, 0, 0.05),
    'cladding': ('corrugated', 0.8, 0x5a6068, 0.45, 0.55, 1), 'cabin': ('corrugated', 0.8, 0xffffff, 0.55, 0.2, 1),
    'roofMetal': ('corrugated', 0.8, 0x6f757c, 0.5, 0.5, 1),
}
# Photoreal adjustments on top of the web table (the web values are tuned for a raster preview).
OVERRIDE = {
    'render': dict(rough=0.88, bevel=True),            # Sto render
    'renderNeighbour': dict(rough=0.9),
    'grc': dict(rough=0.55, bevel=True),                # GRC fins
    'concrete': dict(bevel=True), 'concreteSmooth': dict(bevel=True),
    'cladding': dict(tint=0x3b3f45, rough=0.38, metal=0.65),   # Nu-Wall dark aluminium spandrels
    'roofMetal': dict(rough=0.42),
    'tile': dict(rough=0.3), 'marble': dict(rough=0.12), 'stone': dict(rough=0.45),
    'oak': dict(rough=0.42), 'paintSatin': dict(rough=0.4),
    'timber': dict(tint=0xe8c99a, rough=0.7),           # Abodo soffits
    'cedar': dict(tint=0xd9b48c, rough=0.8),
}
BEVEL_RADIUS = 0.006


def parse_surf_js():
    path = os.path.join(REPO, 'js', 'realism.js')
    try:
        src = open(path).read()
    except OSError:
        return
    pat = re.compile(r"(\w+): \{ map: '(\w+)', tile: ([\d.]+), tint: 0x([0-9a-fA-F]+), rough: ([\d.]+)"
                     r"(?:, metal: ([\d.]+))?, bump: ([\d.]+) \}")
    for m in pat.finditer(src):
        SURF[m.group(1)] = (m.group(2), float(m.group(3)), int(m.group(4), 16), float(m.group(5)),
                            float(m.group(6) or 0), float(m.group(7)))


# ----------------------------------------------------------------------------- sun & shots
SUNS = {
    # altitude, azimuth (deg from north, clockwise), label
    'hero': (45.7, 314.2, '15 Mar 2027, 15:30 NZDT (afternoon)'),
    'evening': (35.9, 270.6, '20 Jan 2027, 17:30 NZDT (evening)'),
    'morning': (30.8, 67.2, '15 Mar 2027, 10:00 NZDT (morning)'),
}

# Cameras in glTF/world coordinates. 'vertical': keep verticals vertical (level camera + shift_y).
SHOTS = {
    'street_hero': dict(cam=(-22.3, 5.35, -30.0), target=(-22.3, 9.0, 0.0), lens=22, sun='hero', vertical=True,
                        desc='Across Goldie Street from Vellenoweth Green reserve, eye level, whole 5-house frontage'),
    'street_oblique': dict(cam=(8.0, 5.4, -16.0), target=(-20.0, 8.5, 6.0), lens=24, sun='hero', vertical=True,
                           desc='North-west corner of Goldie Street, eye level, oblique along the frontage'),
    'aerial': dict(cam=(-70.0, 40.0, -40.0), target=(-22.0, 5.0, 12.0), lens=35, sun='hero', vertical=False,
                   desc='Drone view from the south-west'),
    'pool_court': dict(cam=(-23.6, 6.2, 25.9), target=(-21.6, 7.4, 17.0), lens=20, sun='morning', vertical=True,
                       desc="House 3 rear pool court on the podium, eye level, looking west at the rear facade and pool"),
    'rear_evening': dict(cam=(-10.0, 16.0, 34.0), target=(-22.0, 7.0, 16.0), lens=26, sun='evening', vertical=False,
                         lights=True, desc='Rear pool courts from above, evening'),
    'interior_living': dict(cam=(-15.5, 9.4, 9.5), target=(-14.5, 9.2, 0.0), lens=18, sun='hero', vertical=True,
                            exposure=1.6, desc='House 2 L1 living, looking west to the street glazing'),
}
SHOT_ORDER = ['street_hero', 'street_oblique', 'aerial', 'pool_court', 'rear_evening', 'interior_living']


def g2b(x, y, z):
    return Vector((x, -z, y))


def sun_vector(alt, az):
    """Unit vector towards the sun in Blender space (north = +X, east = -Y, up = +Z)."""
    a, z = math.radians(alt), math.radians(az)
    return Vector((math.cos(a) * math.cos(z), -math.cos(a) * math.sin(z), math.sin(a)))


def nishita_rotation(az):
    """Nishita puts the sun at (-sin r, cos r) in XY; the compass azimuth A lies at (cos A, -sin A)."""
    return math.radians((270.0 - az) % 360.0)


# ----------------------------------------------------------------------------- helpers
def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin_to_srgb(c):
    c = max(0.0, c)
    return c * 12.92 if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def hex_lin(h):
    return (srgb_to_lin(((h >> 16) & 255) / 255), srgb_to_lin(((h >> 8) & 255) / 255), srgb_to_lin((h & 255) / 255), 1.0)


def hex_of(col):
    return '%02x%02x%02x' % tuple(max(0, min(255, round(255 * lin_to_srgb(c)))) for c in col[:3])


class NT:
    """Tiny node-tree builder."""

    def __init__(self, mat):
        self.t = mat.node_tree
        self.t.nodes.clear()
        self.x = 0

    def n(self, kind, **props):
        nd = self.t.nodes.new(kind)
        self.x += 180
        nd.location = (self.x, 0)
        for k, v in props.items():
            if k.startswith('in_'):
                nd.inputs[k[3:].replace('_', ' ')].default_value = v
            else:
                setattr(nd, k, v)
        return nd

    def link(self, a, b):
        self.t.links.new(a, b)

    def math(self, op, a, b=None, clamp=False):
        nd = self.n('ShaderNodeMath', operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                nd.inputs[i].default_value = v
            else:
                self.link(v, nd.inputs[i])
        return nd.outputs[0]

    def vmath(self, op, a, b=None, scale=None):
        nd = self.n('ShaderNodeVectorMath', operation=op)
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (tuple, list)):
                nd.inputs[i].default_value = v
            else:
                self.link(v, nd.inputs[i])
        if scale is not None:
            nd.inputs['Scale'].default_value = scale
        return nd.outputs['Value'] if op in ('DOT_PRODUCT', 'LENGTH', 'DISTANCE') else nd.outputs['Vector']


_images = {}


def tex_image(name):
    if name not in _images:
        path = os.path.join(TEX_DIR, name + '.jpg')
        _images[name] = bpy.data.images.load(path, check_existing=True) if os.path.exists(path) else None
    return _images[name]


def triplanar(nt, img, tile, geo):
    """World-space triplanar projection of a seamless tile of `tile` metres. Returns colour socket."""
    pos = nt.vmath('SCALE', geo.outputs['Position'], scale=1.0 / tile)
    sep = nt.n('ShaderNodeSeparateXYZ')
    nt.link(pos, sep.inputs[0])
    nrm = nt.vmath('ABSOLUTE', geo.outputs['True Normal'])
    nsep = nt.n('ShaderNodeSeparateXYZ')
    nt.link(nrm, nsep.inputs[0])
    w = [nt.math('POWER', nsep.outputs[i], 4.0) for i in range(3)]
    tot = nt.math('ADD', nt.math('ADD', w[0], w[1]), w[2])
    planes = [(1, 2), (0, 2), (0, 1)]  # x-facing uses (y,z), y-facing (x,z), z-facing (x,y)
    acc = None
    for i, (a, b) in enumerate(planes):
        c = nt.n('ShaderNodeCombineXYZ')
        nt.link(sep.outputs[a], c.inputs[0])
        nt.link(sep.outputs[b], c.inputs[1])
        if i < 2:  # decorrelate side projections a little
            c.inputs[2].default_value = 0
        t = nt.n('ShaderNodeTexImage', image=img, interpolation='Cubic')
        nt.link(c.outputs[0], t.inputs[0])
        wi = nt.math('DIVIDE', w[i], tot)
        m = nt.vmath('SCALE', t.outputs['Color'])
        nt.link(wi, m.node.inputs['Scale'])
        acc = m if acc is None else nt.vmath('ADD', acc, m)
    return acc


def macro_noise(nt, geo, scale, lo, hi):
    noi = nt.n('ShaderNodeTexNoise', in_Scale=scale, in_Detail=3.0, in_Roughness=0.55)
    nt.link(geo.outputs['Position'], noi.inputs['Vector'])
    mr = nt.n('ShaderNodeMapRange', in_From_Min=0.3, in_From_Max=0.7, in_To_Min=lo, in_To_Max=hi)
    nt.link(noi.outputs['Fac'], mr.inputs[0])
    return mr.outputs[0]


def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m


# ----------------------------------------------------------------------------- material builders
def build_surface(name):
    mp, tile, tint, rough, metal, bump = SURF[name]
    ov = OVERRIDE.get(name, {})
    tint, rough, metal = ov.get('tint', tint), ov.get('rough', rough), ov.get('metal', metal)
    m = new_mat('PBR_' + name)
    nt = NT(m)
    geo = nt.n('ShaderNodeNewGeometry')
    img = tex_image(mp)
    bsdf = nt.n('ShaderNodeBsdfPrincipled', in_Metallic=metal, in_IOR=1.5)
    out = nt.n('ShaderNodeOutputMaterial')
    nt.link(bsdf.outputs[0], out.inputs['Surface'])
    tl = hex_lin(tint)
    if img is None:
        bsdf.inputs['Base Color'].default_value = tl
        bsdf.inputs['Roughness'].default_value = rough
        return m
    col = triplanar(nt, img, tile, geo)
    # macro variation breaks up tiling (stronger on landscape)
    land = name in ('grass', 'reserve', 'soil', 'mulch', 'gravel')
    var = macro_noise(nt, geo, 0.08 if land else 0.18, 0.82 if land else 0.93, 1.12 if land else 1.05)
    col = nt.vmath('SCALE', col)
    nt.link(var, col.node.inputs['Scale'])
    col = nt.vmath('MULTIPLY', col, tl[:3])
    if land:  # hue drift: patches of drier grass
        hsv = nt.n('ShaderNodeHueSaturation', in_Saturation=1.0, in_Value=1.0)
        nt.link(col, hsv.inputs['Color'])
        h = macro_noise(nt, geo, 0.05, 0.47, 0.53)
        nt.link(h, hsv.inputs['Hue'])
        col = hsv.outputs[0]
    nt.link(col, bsdf.inputs['Base Color'])
    lum = nt.n('ShaderNodeRGBToBW')
    nt.link(col, lum.inputs[0])
    # roughness: darker texels (pores, joints) a little rougher, plus macro drift
    rmap = nt.n('ShaderNodeMapRange', in_From_Min=0.0, in_From_Max=0.8,
                in_To_Min=min(1, rough + 0.08), in_To_Max=max(0.02, rough - 0.08))
    nt.link(lum.outputs[0], rmap.inputs[0])
    rvar = macro_noise(nt, geo, 0.5, 0.93, 1.07)
    nt.link(nt.math('MULTIPLY', rmap.outputs[0], rvar, clamp=True), bsdf.inputs['Roughness'])
    nrm_in = None
    if ov.get('bevel'):
        bev = nt.n('ShaderNodeBevel', samples=4, in_Radius=BEVEL_RADIUS)
        nrm_in = bev.outputs[0]
    if bump > 0:
        b = nt.n('ShaderNodeBump', in_Strength=min(1.0, 0.25 + 0.3 * bump), in_Distance=0.002 * max(0.5, bump))
        nt.link(lum.outputs[0], b.inputs['Height'])
        if nrm_in:
            nt.link(nrm_in, b.inputs['Normal'])
        nrm_in = b.outputs[0]
    if nrm_in:
        nt.link(nrm_in, bsdf.inputs['Normal'])
    if metal > 0.3:
        bsdf.inputs['Specular IOR Level'].default_value = 0.5
    if name in ('grass', 'reserve'):
        bsdf.inputs['Specular IOR Level'].default_value = 0.3
    return m


def shadow_pass(nt, surface, tint):
    """Let shadow and diffuse rays pass through tinted (no caustics needed for lit interiors/pools)."""
    lp = nt.n('ShaderNodeLightPath')
    fac = nt.math('MAXIMUM', lp.outputs['Is Shadow Ray'], lp.outputs['Is Diffuse Ray'])
    tr = nt.n('ShaderNodeBsdfTransparent')
    tr.inputs[0].default_value = tint
    mix = nt.n('ShaderNodeMixShader')
    nt.link(fac, mix.inputs[0])
    nt.link(surface, mix.inputs[1])
    nt.link(tr.outputs[0], mix.inputs[2])
    return mix.outputs[0]


def build_glass():
    m = new_mat('PBR_glass')
    nt = NT(m)
    g = nt.n('ShaderNodeBsdfPrincipled', in_Roughness=0.0, in_IOR=1.52, in_Transmission_Weight=1.0)
    g.inputs['Base Color'].default_value = (0.90, 0.965, 0.955, 1)   # low-iron-ish blue-green edge tint
    s = shadow_pass(nt, g.outputs[0], (0.86, 0.93, 0.92, 1))
    out = nt.n('ShaderNodeOutputMaterial')
    nt.link(s, out.inputs['Surface'])
    return m


def build_water():
    m = new_mat('PBR_water')
    nt = NT(m)
    geo = nt.n('ShaderNodeNewGeometry')
    w = nt.n('ShaderNodeBsdfPrincipled', in_Roughness=0.015, in_IOR=1.333, in_Transmission_Weight=1.0)
    w.inputs['Base Color'].default_value = (0.82, 0.95, 0.95, 1)
    noi = nt.n('ShaderNodeTexNoise', in_Scale=1.6, in_Detail=6.0, in_Roughness=0.55)
    nt.link(geo.outputs['Position'], noi.inputs['Vector'])
    wav = nt.n('ShaderNodeTexWave', wave_type='BANDS', in_Scale=0.9, in_Distortion=6.0, in_Detail=3.0)
    nt.link(geo.outputs['Position'], wav.inputs['Vector'])
    h = nt.math('ADD', noi.outputs['Fac'], nt.math('MULTIPLY', wav.outputs['Fac'], 0.35))
    b = nt.n('ShaderNodeBump', in_Strength=0.18, in_Distance=0.03)
    nt.link(h, b.inputs['Height'])
    nt.link(b.outputs[0], w.inputs['Normal'])
    s = shadow_pass(nt, w.outputs[0], (0.80, 0.93, 0.93, 1))
    vol = nt.n('ShaderNodeVolumeAbsorption', in_Density=0.55)
    vol.inputs['Color'].default_value = (0.30, 0.78, 0.80, 1)
    out = nt.n('ShaderNodeOutputMaterial')
    nt.link(s, out.inputs['Surface'])
    nt.link(vol.outputs[0], out.inputs['Volume'])
    return m


def build_leaf(col, rough=0.6, name='leaf', big=False):
    m = new_mat('PBR_' + name)
    nt = NT(m)
    geo = nt.n('ShaderNodeNewGeometry')
    oi = nt.n('ShaderNodeObjectInfo')
    base = nt.n('ShaderNodeHueSaturation', in_Saturation=1.0)
    base.inputs['Color'].default_value = col
    hv = nt.n('ShaderNodeMapRange', in_To_Min=0.47, in_To_Max=0.54)
    nt.link(oi.outputs['Random'], hv.inputs[0])
    nt.link(hv.outputs[0], base.inputs['Hue'])
    vv = nt.n('ShaderNodeMapRange', in_To_Min=0.75, in_To_Max=1.2)
    nt.link(oi.outputs['Random'], vv.inputs[0])
    nt.link(vv.outputs[0], base.inputs['Value'])
    p = nt.n('ShaderNodeBsdfPrincipled', in_Roughness=rough, in_Specular_IOR_Level=0.4)
    nt.link(base.outputs[0], p.inputs['Base Color'])
    tr = nt.n('ShaderNodeBsdfTranslucent')
    nt.link(base.outputs[0], tr.inputs['Color'])
    mix = nt.n('ShaderNodeMixShader', in_Fac=0.3)
    nt.link(p.outputs[0], mix.inputs[1])
    nt.link(tr.outputs[0], mix.inputs[2])
    if big:  # low-poly canopies: leafy clumps via Voronoi bump
        vo = nt.n('ShaderNodeTexVoronoi', in_Scale=5.0)
        nt.link(geo.outputs['Position'], vo.inputs['Vector'])
        b = nt.n('ShaderNodeBump', in_Strength=0.9, in_Distance=0.15)
        nt.link(vo.outputs['Distance'], b.inputs['Height'])
        nt.link(b.outputs[0], p.inputs['Normal'])
        # darker in the clump crevices
        dk = nt.n('ShaderNodeMapRange', in_To_Min=0.55, in_To_Max=1.1)
        nt.link(vo.outputs['Distance'], dk.inputs[0])
        cm = nt.vmath('SCALE', base.outputs[0])
        nt.link(dk.outputs[0], cm.node.inputs['Scale'])
        nt.link(cm, p.inputs['Base Color'])
    out = nt.n('ShaderNodeOutputMaterial')
    nt.link(mix.outputs[0], out.inputs['Surface'])
    return m


def build_palette(name, palette, rough, metal=0.0):
    """Per-object random colour from a palette (suburb instancing lost its instance colours on import)."""
    m = new_mat('PBR_' + name)
    nt = NT(m)
    oi = nt.n('ShaderNodeObjectInfo')
    ramp = nt.n('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    els = ramp.color_ramp.elements
    for i, h in enumerate(palette):
        e = els[i] if i < len(els) else els.new(0)
        e.position = i / len(palette)
        e.color = hex_lin(h)
    nt.link(oi.outputs['Random'], ramp.inputs[0])
    p = nt.n('ShaderNodeBsdfPrincipled', in_Roughness=rough, in_Metallic=metal)
    nt.link(ramp.outputs[0], p.inputs['Base Color'])
    out = nt.n('ShaderNodeOutputMaterial')
    nt.link(p.outputs[0], out.inputs['Surface'])
    return m


JOINERY = {'2e3236', '2d3034', '2d2f33', '2a2d31', '1c1d1f', '1f2124'}


def build_flat(col, rough, metal, alpha, emit_col, emit_str, hexc):
    """Upgrade an unnamed flat-colour glTF material."""
    m = new_mat('PBR_flat_' + hexc)
    nt = NT(m)
    geo = nt.n('ShaderNodeNewGeometry')
    p = nt.n('ShaderNodeBsdfPrincipled')
    r, g, b = col[:3]
    rough = max(0.05, min(0.95, rough))
    spec = 0.5
    if hexc in JOINERY:                 # APL dark-bronze anodised aluminium joinery
        col, metal, rough = hex_lin(0x3a3129), 0.8, 0.34
    elif metal >= 0.55 and rough <= 0.25 and alpha > 0.99:   # car paint
        p.inputs['Coat Weight'].default_value = 1.0
        p.inputs['Coat Roughness'].default_value = 0.03
    elif g > r * 1.15 and g > b * 1.15 and rough >= 0.85:   # foliage
        return build_leaf(col, 0.55, 'leaf_' + hexc)
    p.inputs['Base Color'].default_value = col
    p.inputs['Metallic'].default_value = metal
    # small, per-surface roughness / specular drift so flat colours don't read as CG plastic
    noi = nt.n('ShaderNodeTexNoise', in_Scale=3.0, in_Detail=2.0)
    nt.link(geo.outputs['Position'], noi.inputs['Vector'])
    rm = nt.n('ShaderNodeMapRange', in_To_Min=rough * 0.9, in_To_Max=min(1, rough * 1.1))
    nt.link(noi.outputs['Fac'], rm.inputs[0])
    nt.link(rm.outputs[0], p.inputs['Roughness'])
    sm = nt.n('ShaderNodeMapRange', in_To_Min=spec * 0.85, in_To_Max=spec * 1.15)
    nt.link(noi.outputs['Fac'], sm.inputs[0])
    nt.link(sm.outputs[0], p.inputs['Specular IOR Level'])
    if emit_str > 0:
        p.inputs['Emission Color'].default_value = emit_col
        p.inputs['Emission Strength'].default_value = emit_str * 2.0
        m['emissive'] = emit_str * 2.0
    shader = p.outputs[0]
    if alpha < 0.99:
        if max(col[:3]) < 0.1:          # tinted car / dark glass: opaque glossy
            p.inputs['Roughness'].default_value = 0.03
            p.inputs['Base Color'].default_value = (0.01, 0.012, 0.015, 1)
            p.inputs['Metallic'].default_value = 0.0
        else:                           # sheers, frosted panels
            tl = nt.n('ShaderNodeBsdfTranslucent')
            tl.inputs[0].default_value = col
            mx = nt.n('ShaderNodeMixShader', in_Fac=0.5)
            nt.link(p.outputs[0], mx.inputs[1])
            nt.link(tl.outputs[0], mx.inputs[2])
            tr = nt.n('ShaderNodeBsdfTransparent')
            mx2 = nt.n('ShaderNodeMixShader', in_Fac=alpha)
            nt.link(tr.outputs[0], mx2.inputs[1])
            nt.link(mx.outputs[0], mx2.inputs[2])
            shader = mx2.outputs[0]
    out = nt.n('ShaderNodeOutputMaterial')
    nt.link(shader, out.inputs['Surface'])
    return m


def principled_of(mat):
    if not mat or not mat.use_nodes:
        return None
    for nd in mat.node_tree.nodes:
        if nd.type == 'BSDF_PRINCIPLED':
            return nd
    return None


def upgrade_materials():
    parse_surf_js()
    cache, report = {}, {}
    glass, water = build_glass(), build_water()
    suburb = {
        'canopy': build_leaf((0.05, 0.11, 0.035, 1), 0.7, 'canopy', big=True),
        'walls': build_palette('suburbWall', [0xf2efe8, 0xe8e2d6, 0xdcd8d0, 0xf5f3ee, 0xcfd3d4, 0xe9e1d0], 0.85),
        'roofs': build_palette('suburbRoof', [0x3d4247, 0x5b5f63, 0x7a4b3a, 0x2f3a45, 0x8b8f93], 0.5, 0.4),
    }
    old = set(bpy.data.materials)
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        inst = o.data.users > 50
        for slot in o.material_slots:
            mat = slot.material
            if mat is None or mat not in old:
                continue
            base = re.sub(r'\.\d+$', '', mat.name)
            bs = principled_of(mat)
            if inst and bs is not None:
                npoly = len(o.data.polygons)
                col = bs.inputs['Base Color'].default_value
                if hex_of(col) == 'ffffff':
                    key = {80: 'canopy', 12: 'walls', 16: 'roofs'}.get(npoly)
                    if key:
                        slot.material = suburb[key]
                        continue
            if base == 'glass':
                slot.material = glass
                continue
            if base == 'water':
                slot.material = water
                continue
            if base in SURF:
                if base not in cache:
                    cache[base] = build_surface(base)
                slot.material = cache[base]
                report[base] = report.get(base, 0) + 1
                continue
            if bs is None:
                continue
            has_tex = any(nd.type == 'TEX_IMAGE' for nd in mat.node_tree.nodes)
            if has_tex:     # suburb ground / roads keep their embedded (metre-UV) textures
                bs.inputs['Roughness'].default_value = max(0.5, bs.inputs['Roughness'].default_value)
                mat.blend_method = 'OPAQUE'
                continue
            col = tuple(bs.inputs['Base Color'].default_value)
            rough = bs.inputs['Roughness'].default_value
            metal = bs.inputs['Metallic'].default_value
            alpha = bs.inputs['Alpha'].default_value
            ec = tuple(bs.inputs['Emission Color'].default_value)
            es = bs.inputs['Emission Strength'].default_value if max(ec[:3]) > 0 else 0.0
            hx = hex_of(col)
            key = (hx, round(rough, 2), round(metal, 2), round(alpha, 2), hex_of(ec), round(es, 2))
            if key not in cache:
                cache[key] = build_flat(col, rough, metal, alpha, ec, es, hx)
            slot.material = cache[key]
    for mat in list(bpy.data.materials):
        if mat.users == 0:
            bpy.data.materials.remove(mat)
    print('materials: %d surfaces, %d total after dedupe' % (len(report), len(bpy.data.materials)))
    return report


# ----------------------------------------------------------------------------- grass scatter
def make_grass_clump():
    me = bpy.data.meshes.new('GrassClump')
    bm = bmesh.new()
    import random
    rnd = random.Random(7)
    for i in range(9):
        a = rnd.uniform(0, 2 * math.pi)
        r = rnd.uniform(0, 0.035)
        x, y = r * math.cos(a), r * math.sin(a)
        h = rnd.uniform(0.045, 0.1)
        w = rnd.uniform(0.004, 0.007)
        lean = rnd.uniform(0.2, 0.55)
        d = rnd.uniform(0, 2 * math.pi)
        dx, dy = math.cos(d), math.sin(d)
        px, py = -dy * w, dx * w
        v0 = bm.verts.new((x - px, y - py, 0))
        v1 = bm.verts.new((x + px, y + py, 0))
        v2 = bm.verts.new((x + dx * h * lean * 0.5 + px * 0.6, y + dy * h * lean * 0.5 + py * 0.6, h * 0.55))
        v3 = bm.verts.new((x + dx * h * lean * 0.5 - px * 0.6, y + dy * h * lean * 0.5 - py * 0.6, h * 0.55))
        v4 = bm.verts.new((x + dx * h * lean, y + dy * h * lean, h))
        bm.faces.new((v0, v1, v2, v3))
        bm.faces.new((v3, v2, v4))
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new('GrassClump', me)
    bpy.context.scene.collection.objects.link(ob)
    ob.hide_render = True
    ob.hide_viewport = True
    me.materials.append(build_leaf((0.075, 0.16, 0.035, 1), 0.5, 'grassBlade'))
    return ob


def grass_nodes(clump):
    ng = bpy.data.node_groups.new('GrassScatter', 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Camera', in_out='INPUT', socket_type='NodeSocketVector')
    s = ng.interface.new_socket('Radius', in_out='INPUT', socket_type='NodeSocketFloat')
    s.default_value = 20.0
    s = ng.interface.new_socket('Density', in_out='INPUT', socket_type='NodeSocketFloat')
    s.default_value = 300.0
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N, L = ng.nodes, ng.links
    gi, go = N.new('NodeGroupInput'), N.new('NodeGroupOutput')
    nrm = N.new('GeometryNodeInputNormal')
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(nrm.outputs[0], sep.inputs[0])
    up = N.new('FunctionNodeCompare')
    up.data_type, up.operation = 'FLOAT', 'GREATER_THAN'
    up.inputs[1].default_value = 0.7
    L.new(sep.outputs[2], up.inputs[0])
    # only faces near the camera get scattered: keep faces whose nearest point lies within the radius
    dist = N.new('GeometryNodeDistributePointsOnFaces')
    L.new(gi.outputs['Geometry'], dist.inputs['Mesh'])
    L.new(up.outputs[0], dist.inputs['Selection'])
    L.new(gi.outputs['Density'], dist.inputs['Density'])
    pos = N.new('GeometryNodeInputPosition')
    vd = N.new('ShaderNodeVectorMath')
    vd.operation = 'DISTANCE'
    L.new(pos.outputs[0], vd.inputs[0])
    L.new(gi.outputs['Camera'], vd.inputs[1])
    far = N.new('ShaderNodeMath')
    far.operation = 'GREATER_THAN'
    L.new(vd.outputs['Value'], far.inputs[0])
    L.new(gi.outputs['Radius'], far.inputs[1])
    # thin out with distance: keep probability 1 -> 0.25 from 40% of the radius to the radius
    ratio = N.new('ShaderNodeMapRange')
    L.new(vd.outputs['Value'], ratio.inputs['Value'])
    mul = N.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = 0.4
    L.new(gi.outputs['Radius'], mul.inputs[0])
    L.new(mul.outputs[0], ratio.inputs['From Min'])
    L.new(gi.outputs['Radius'], ratio.inputs['From Max'])
    ratio.inputs['To Min'].default_value = 0.0
    ratio.inputs['To Max'].default_value = 0.75
    rv = N.new('FunctionNodeRandomValue')
    rv.data_type = 'FLOAT'
    thin = N.new('ShaderNodeMath')
    thin.operation = 'LESS_THAN'
    L.new(rv.outputs[1], thin.inputs[0])
    L.new(ratio.outputs[0], thin.inputs[1])
    kill = N.new('FunctionNodeBooleanMath')
    kill.operation = 'OR'
    L.new(far.outputs[0], kill.inputs[0])
    L.new(thin.outputs[0], kill.inputs[1])
    dele = N.new('GeometryNodeDeleteGeometry')
    dele.domain = 'POINT'
    L.new(dist.outputs['Points'], dele.inputs['Geometry'])
    L.new(kill.outputs[0], dele.inputs['Selection'])
    oi = N.new('GeometryNodeObjectInfo')
    oi.inputs['Object'].default_value = clump
    iop = N.new('GeometryNodeInstanceOnPoints')
    L.new(dele.outputs[0], iop.inputs['Points'])
    L.new(oi.outputs['Geometry'], iop.inputs['Instance'])
    rr = N.new('FunctionNodeRandomValue')
    rr.data_type = 'FLOAT_VECTOR'
    rr.inputs['Min'].default_value = (0, 0, 0)
    rr.inputs['Max'].default_value = (0.25, 0.25, 6.283)
    L.new(rr.outputs['Value'], iop.inputs['Rotation'])
    rs = N.new('FunctionNodeRandomValue')
    rs.data_type = 'FLOAT'
    rs.inputs[2].default_value = 0.7
    rs.inputs[3].default_value = 1.4
    L.new(rs.outputs[1], iop.inputs['Scale'])
    join = N.new('GeometryNodeJoinGeometry')
    L.new(gi.outputs['Geometry'], join.inputs[0])
    L.new(iop.outputs[0], join.inputs[0])
    L.new(join.outputs[0], go.inputs[0])
    return ng


def setup_grass():
    targets = [o for o in bpy.data.objects if o.type == 'MESH' and o.data.users == 1 and any(
        s.material and s.material.name in ('PBR_grass', 'PBR_reserve') for s in o.material_slots)]
    if not targets:
        return []
    clump = make_grass_clump()
    ng = grass_nodes(clump)
    mods = []
    for o in targets:
        md = o.modifiers.new('Grass', 'NODES')
        md.node_group = ng
        mods.append((o, md))
    print('grass scatter on %d objects' % len(mods))
    return mods


def aim_grass(mods, cam_loc, radius, density):
    for o, md in mods:
        local = o.matrix_world.inverted() @ cam_loc
        ids = {s.name: s.identifier for s in md.node_group.interface.items_tree if s.item_type == 'SOCKET' and s.in_out == 'INPUT'}
        md[ids['Camera']] = local[:]
        md[ids['Radius']] = radius
        md[ids['Density']] = density
        md.show_render = radius > 0
        o.update_tag()


# ----------------------------------------------------------------------------- world, sun, camera
def calibrate_sun(alt, az):
    """Measure the Nishita sun disc's irradiance and colour with a 16 px probe render.
    Returns (rgb, strength) for a Sun lamp that matches the disc (before scene scaling)."""
    import numpy as np
    sc = bpy.data.scenes.new('calib')
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 32
    sc.cycles.use_denoising = False
    sc.render.resolution_x = sc.render.resolution_y = 8
    sc.view_settings.view_transform = 'Standard'
    me = bpy.data.meshes.new('calibPlane')
    me.from_pydata([(-5, -5, 0), (5, -5, 0), (5, 5, 0), (-5, 5, 0)], [], [(0, 1, 2, 3)])
    mat = new_mat('calibWhite')
    b = principled_of(mat)
    b.inputs['Base Color'].default_value = (1, 1, 1, 1)
    b.inputs['Roughness'].default_value = 1.0
    b.inputs['Specular IOR Level'].default_value = 0.0
    me.materials.append(mat)
    pl = bpy.data.objects.new('calibPlane', me)
    sc.collection.objects.link(pl)
    cd = bpy.data.cameras.new('calibCam')
    cd.type = 'ORTHO'
    cd.ortho_scale = 2
    co = bpy.data.objects.new('calibCam', cd)
    co.location = (0, 0, 3)
    sc.collection.objects.link(co)
    sc.camera = co
    w = bpy.data.worlds.new('calibWorld')
    w.use_nodes = True
    sky = w.node_tree.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'NISHITA'
    sky.sun_elevation = math.radians(alt)
    sky.sun_rotation = nishita_rotation(az)
    sky.dust_density = 1.2
    w.node_tree.links.new(sky.outputs[0], w.node_tree.nodes['Background'].inputs[0])
    sc.world = w
    res = []
    path = os.path.join(tempfile.gettempdir(), 'goldie_calib.exr')
    sc.render.image_settings.file_format = 'OPEN_EXR'
    for disc in (False, True):
        sky.sun_disc = disc
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True, scene=sc.name)
        im = bpy.data.images.load(path, check_existing=False)
        a = np.array(im.pixels[:]).reshape(-1, 4)[:, :3].mean(0)
        bpy.data.images.remove(im)
        res.append(a)
    for d in (sc, ):
        bpy.data.scenes.remove(d)
    for x in (pl,):
        bpy.data.objects.remove(x)
    bpy.data.worlds.remove(w)
    sun_rad = res[1] - res[0]                      # white lambertian radiance from the disc
    E_h = sun_rad * math.pi                        # horizontal irradiance
    E_n = E_h / max(0.05, math.sin(math.radians(alt)))
    strength = float(E_n.mean())
    rgb = E_n / max(E_n.max(), 1e-6)
    # Nishita skews warm/blue; pull 55 % toward neutral daylight so render stays reads white
    rgb = [0.45 * c + 0.55 * n for c, n in zip(rgb, (1.0, 0.96, 0.9))]
    mx = max(rgb)
    rgb = tuple(c / mx for c in rgb)
    return rgb, strength, res[0]


LIGHT_SCALE = 1.0 / 25.0     # keeps scene radiance near 1 so clamping and AgX behave


def setup_world(sc):
    w = bpy.data.worlds.new('Nishita')
    w.use_nodes = True
    nt = w.node_tree
    sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'NISHITA'
    sky.sun_disc = False            # the Sun lamp provides the direct sun (crisp, sampled)
    sky.dust_density = 1.2
    sky.air_density = 1.0
    sky.ozone_density = 1.0
    bg = nt.nodes['Background']
    bg.inputs['Strength'].default_value = LIGHT_SCALE
    nt.links.new(sky.outputs[0], bg.inputs[0])
    sc.world = w
    sd = bpy.data.lights.new('Sun', 'SUN')
    sd.angle = math.radians(0.53)
    sun = bpy.data.objects.new('Sun', sd)
    sc.collection.objects.link(sun)
    return sky, sun


_sun_cache = {}


def aim_sun(sky, sun, key):
    alt, az, _ = SUNS[key]
    sky.sun_elevation = math.radians(alt)
    sky.sun_rotation = nishita_rotation(az)
    if key not in _sun_cache:
        _sun_cache[key] = calibrate_sun(alt, az)
    rgb, strength, _ = _sun_cache[key]
    sun.data.color = rgb
    sun.data.energy = strength * LIGHT_SCALE
    d = sun_vector(alt, az)
    sun.rotation_mode = 'QUATERNION'
    sun.rotation_quaternion = d.to_track_quat('Z', 'Y')     # lamp shines along its -Z, i.e. along -d
    return rgb, strength


def place_camera(sc, shot, aspect):
    cd = bpy.data.cameras.get('ShotCam') or bpy.data.cameras.new('ShotCam')
    co = bpy.data.objects.get('ShotCam')
    if co is None:
        co = bpy.data.objects.new('ShotCam', cd)
        sc.collection.objects.link(co)
    cd.sensor_fit = 'HORIZONTAL'
    cd.sensor_width = 36.0
    cd.lens = shot['lens']
    cd.clip_start = 0.05
    cd.clip_end = 5000
    c, t = g2b(*shot['cam']), g2b(*shot['target'])
    d = t - c
    dh = math.hypot(d.x, d.y)
    yaw = math.atan2(d.y, d.x)
    co.location = c
    co.rotation_mode = 'XYZ'
    if shot.get('vertical'):
        co.rotation_euler = (math.pi / 2, 0, yaw - math.pi / 2)
        cd.shift_y = cd.lens * (d.z / dh) / cd.sensor_width
    else:
        pitch = math.atan2(d.z, dh)
        co.rotation_euler = (math.pi / 2 + pitch, 0, yaw - math.pi / 2)
        cd.shift_y = 0
    cd.shift_x = 0
    sc.camera = co
    return co


def set_emission(on):
    for m in bpy.data.materials:
        if 'emissive' not in m:
            continue
        for nd in m.node_tree.nodes:
            if nd.type == 'BSDF_PRINCIPLED':
                nd.inputs['Emission Strength'].default_value = m['emissive'] * (4.0 if on else 1.0)


# ----------------------------------------------------------------------------- scene
def import_glb(glb, use_cache=True):
    st = os.stat(glb)
    cache_dir = os.path.join(tempfile.gettempdir(), 'goldie_render_cache')
    key = '%s_%d_%d.blend' % (os.path.splitext(os.path.basename(glb))[0], st.st_size, int(st.st_mtime))
    cache = os.path.join(cache_dir, key)
    t0 = time.time()
    if use_cache and os.path.exists(cache):
        bpy.ops.wm.open_mainfile(filepath=cache)
        print('loaded cached import %s (%.0fs)' % (cache, time.time() - t0))
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb, merge_vertices=False, import_shading='NORMALS')
    print('imported %s (%.0fs)' % (glb, time.time() - t0))
    for o in list(bpy.data.objects):
        if o.type in ('CAMERA', 'LIGHT'):
            bpy.data.objects.remove(o)
    if use_cache:
        os.makedirs(cache_dir, exist_ok=True)
        for f in os.listdir(cache_dir):        # one cache per GLB name
            if f.startswith(key.split('_')[0]) and f != key:
                try:
                    os.remove(os.path.join(cache_dir, f))
                except OSError:
                    pass
        bpy.ops.wm.save_as_mainfile(filepath=cache, compress=False)


def setup_render(sc, samples, res, preview):
    sc.render.engine = 'CYCLES'
    cy = sc.cycles
    cy.device = 'CPU'
    cy.samples = samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.03 if preview else 0.012
    cy.adaptive_min_samples = 0
    cy.use_denoising = True
    cy.denoiser = 'OPENIMAGEDENOISE'
    cy.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    cy.denoising_prefilter = 'ACCURATE'
    cy.max_bounces = 6
    cy.diffuse_bounces = 3
    cy.glossy_bounces = 4
    cy.transmission_bounces = 8
    cy.volume_bounces = 1
    cy.transparent_max_bounces = 16
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.blur_glossy = 1.0
    cy.sample_clamp_direct = 0.0
    cy.sample_clamp_indirect = 10.0
    cy.use_light_tree = True
    sc.render.threads_mode = 'AUTO'
    sc.render.use_persistent_data = True
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        sc.view_settings.look = 'None'
    sc.display_settings.display_device = 'sRGB'
    sc.render.image_settings.color_management = 'FOLLOW_SCENE'


def save_outputs(sc, name, out, png_dir):
    img = bpy.data.images['Render Result']
    os.makedirs(png_dir, exist_ok=True)
    png = os.path.join(png_dir, 'Goldie_Street_%s.png' % name)
    jpg = os.path.join(out, 'Goldie_Street_%s.jpg' % name)
    s = sc.render.image_settings
    s.file_format, s.color_mode, s.color_depth, s.compression = 'PNG', 'RGB', '8', 15
    img.save_render(png, scene=sc)
    s.file_format, s.color_mode, s.quality = 'JPEG', 'RGB', 90
    img.save_render(jpg, scene=sc)
    return png, jpg


def write_readme(out, log):
    lines = ['# Goldie Street / Vellenoweth Green Residences: Cycles renders', '',
             'Photoreal stills of the five 3-storey terrace houses at Goldie Street, St Heliers, Auckland. '
             'They are rendered from the three.js GLB export with `tools/render_blender.py` (Blender 4.2, Cycles CPU, '
             'OpenImageDenoise, AgX Medium High Contrast, Nishita sky and a matching sun for lat -36.85, lon 174.86).', '',
             'Re-render after re-exporting the GLB:', '', '```',
             'python3 tools/render_blender.py --glb <path/to/goldie.glb> --out renders --samples 192 --res 1920x1080',
             '```', '',
             'Camera and target positions are in glTF/world metres (x north +, y up, z east +). Focal lengths are full-frame '
             '(36 mm sensor). "Vertical" means the camera is level and framed with lens shift, so verticals stay vertical.', '',
             '| Shot | File | Camera (x, y, z) | Target | Lens | Sun / time | Sun alt / az | Samples | Resolution | Render time |',
             '|---|---|---|---|---|---|---|---|---|---|']
    for name in SHOT_ORDER:
        if name not in log:
            continue
        e = log[name]
        sh = SHOTS[name]
        alt, az, lab = SUNS[sh['sun']]
        lines.append('| %s | `Goldie_Street_%s.jpg` | (%s) | (%s) | %d mm%s | %s | %.1f° / %.1f° | %d | %s | %s |' % (
            name, name, ', '.join('%g' % v for v in sh['cam']), ', '.join('%g' % v for v in sh['target']), sh['lens'],
            ', vertical' if sh.get('vertical') else ', tilted', lab, alt, az, e['samples'], e['res'],
            '%dm %02ds' % divmod(int(e['seconds']), 60)))
    lines += ['', 'Shot notes:', '']
    for name in SHOT_ORDER:
        if name in log:
            lines.append('- **%s**: %s.' % (name, SHOTS[name]['desc']))
    lines += ['', 'Full-resolution PNGs are in `png/`. The JPEGs are quality 90.', '']
    open(os.path.join(out, 'README.md'), 'w').write('\n'.join(lines))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--glb', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--samples', type=int, default=192)
    ap.add_argument('--res', default='1920x1080')
    ap.add_argument('--shots', default=','.join(SHOT_ORDER))
    ap.add_argument('--preview', action='store_true', help='looser adaptive threshold, no README update')
    ap.add_argument('--no-cache', action='store_true')
    ap.add_argument('--no-grass', action='store_true')
    ap.add_argument('--grass-density', type=float, default=320.0, help='clumps per m² near the camera')
    ap.add_argument('--save-blend', help='also save the prepared .blend here')
    a = ap.parse_args(sys.argv[1:])
    res = tuple(int(v) for v in a.res.lower().split('x'))
    shots = [s.strip() for s in a.shots.split(',') if s.strip()]
    bad = [s for s in shots if s not in SHOTS]
    if bad:
        sys.exit('unknown shots: %s (have %s)' % (bad, ', '.join(SHOTS)))
    out = os.path.abspath(a.out)
    os.makedirs(out, exist_ok=True)
    png_dir = os.path.join(out, 'png')

    import_glb(os.path.abspath(a.glb), not a.no_cache)
    sc = bpy.context.scene
    upgrade_materials()
    grass = [] if a.no_grass else setup_grass()
    sky, sun = setup_world(sc)
    setup_render(sc, a.samples, res, a.preview)
    if a.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a.save_blend))

    log_path = os.path.join(out, 'render_log.json')
    try:
        log = json.load(open(log_path))
    except (OSError, ValueError):
        log = {}
    for name in shots:
        sh = SHOTS[name]
        t0 = time.time()
        co = place_camera(sc, sh, res[0] / res[1])
        rgb, strength = aim_sun(sky, sun, sh['sun'])
        set_emission(sh.get('lights', False))
        sc.view_settings.exposure = sh.get('exposure', 0.0)
        if grass:
            aim_grass(grass, co.location, sh.get('grass_radius', 22.0), a.grass_density)
        print('[%s] sun %s rgb=(%.2f,%.2f,%.2f) E=%.0f  rendering %dx%d @ %d spp' % (
            name, sh['sun'], *rgb, strength, res[0], res[1], a.samples), flush=True)
        bpy.ops.render.render(write_still=False)
        png, jpg = save_outputs(sc, name, out, png_dir)
        dt = time.time() - t0
        print('[%s] done in %.0fs -> %s' % (name, dt, jpg), flush=True)
        if not a.preview:
            log[name] = dict(seconds=dt, samples=a.samples, res='%dx%d' % res)
            json.dump(log, open(log_path, 'w'), indent=1)
            write_readme(out, log)


if __name__ == '__main__':
    main()
