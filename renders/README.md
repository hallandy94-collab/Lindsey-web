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
| aerial | `Goldie_Street_aerial.jpg` | (-70, 40, -40) | (-22, 5, 12) | 35 mm, tilted | 15 Mar 2027, 15:30 NZDT (afternoon) | 45.7° / 314.2° | 160 | 1920x1080 | 16m 17s |
| pool_court | `Goldie_Street_pool_court.jpg` | (-23.6, 6.2, 25.9) | (-21.6, 7.4, 17) | 20 mm, vertical | 15 Mar 2027, 10:00 NZDT (morning) | 30.8° / 67.2° | 160 | 1920x1080 | 25m 54s |
| rear_evening | `Goldie_Street_rear_evening.jpg` | (-8, 15, 36) | (-24, 5.5, 19) | 26 mm, tilted | 20 Jan 2027, 17:30 NZDT (evening) | 35.9° / 270.6° | 160 | 1920x1080 | 19m 36s |
| interior_living | `Goldie_Street_interior_living.jpg` | (-16.2, 9.45, 12) | (-14.2, 9.2, 0) | 18 mm, vertical | 15 Mar 2027, 15:30 NZDT (afternoon) | 45.7° / 314.2° | 160 | 1920x1080 | 33m 34s |

Shot notes:

- **street_hero**: Across Goldie Street from Vellenoweth Green reserve, eye level, the whole 5-house frontage.
- **street_oblique**: North-west corner of Goldie Street, eye level, oblique along the frontage.
- **aerial**: Drone view from the south-west.
- **pool_court**: House 3 rear pool court on the podium, eye level, looking west at the rear facade and pool.
- **rear_evening**: Rear pool courts from above, evening, interior lights on.
- **interior_living**: House 2 L1 living and dining, looking west to the street glazing.

Full-resolution PNGs are in `png/`. The JPEGs are quality 90.
