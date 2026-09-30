# Goldie Street / Vellenoweth Green Residences: Cycles renders

Photoreal stills of the five 3-storey terrace houses at Goldie Street, St Heliers, Auckland. They are rendered from the three.js GLB export with `tools/render_blender.py` (Blender 4.2, Cycles CPU, OpenImageDenoise, AgX Medium High Contrast, Nishita sky and a matching sun for lat -36.85, lon 174.86).

Re-render after re-exporting the GLB:

```
python3 tools/render_blender.py --glb <path/to/goldie.glb> --out renders --samples 192 --res 1920x1080
```

Camera and target positions are in glTF/world metres (x north +, y up, z east +). Focal lengths are full-frame (36 mm sensor). "Vertical" means the camera is level and framed with lens shift, so verticals stay vertical.

| Shot | File | Camera (x, y, z) | Target | Lens | Sun / time | Sun alt / az | Samples | Resolution | Render time |
|---|---|---|---|---|---|---|---|---|---|
| street_hero | `Goldie_Street_street_hero.jpg` | (-6, 5.35, -31) | (-19, 9, 0) | 24 mm, vertical | 15 Mar 2027, 15:30 NZDT (afternoon) | 45.7° / 314.2° | 160 | 1920x1080 | 49m 28s |
| street_oblique | `Goldie_Street_street_oblique.jpg` | (8, 5.4, -16) | (-20, 8.5, 6) | 24 mm, vertical | 15 Mar 2027, 15:30 NZDT (afternoon) | 45.7° / 314.2° | 160 | 1920x1080 | 69m 36s |

Shot notes:

- **street_hero**: Across Goldie Street from Vellenoweth Green reserve, eye level, the whole 5-house frontage.
- **street_oblique**: North-west corner of Goldie Street, eye level, oblique along the frontage.

Full-resolution PNGs are in `png/`. The JPEGs are quality 90.
