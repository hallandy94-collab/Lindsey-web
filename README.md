# Goldie Street – 3D build sequence

An interactive 3D model of the Goldie Street project (10–14 Goldie Street, St Heliers) that shows the build step by step, so the construction team can see the sequence. It runs in any browser and needs no install.

It covers 32 stages from site establishment on 29 Jun 2026 to PC in Nov 2027: secant piles, bulk dig, basement tanking, the L0 slab, the CLL undercroft, pools, the Concretec precast cycle, roof, weathertight, facade, the House 1 → 5 services and fitout flow-line, external works and handover.

## Using it

- **Play / step**: press play, or use ◀ ▶ (keyboard: space, ← →). The scrubber has diamonds at each milestone (MS1–MS5).
- **Stage card**: shows what is built, quantities, hold points, plant and crew for the current stage, taken from the pack.
- **Views**: 3D, Street, Basement, Plan and Garden. The camera follows each stage unless you turn that off.
- **Display** menu:
  - outline of work still to come
  - see-through ground (to show the piles and drains)
  - temporary works and plant (cranes, rig, props, scaffold)
  - street and neighbours
  - section cut from the street
  - show up to a chosen level
- **Tanking stage**: tick *Separate the tanking layers* to pull the basement build-up apart (blinding, 3PTM, XPS, hardfill) and read the five lines of defence against water.
- Deep link to a stage with `#stage-id`, e.g. `index.html#tank`.

## House fitout viewer (`fitout.html`)

This is a separate visual for the fitout of one terrace house (LG, L1 and L2), shown as a dollhouse cutaway. It covers 23 trade stages in order:

1. Framing
2. Plumbing and gas rough-in
3. Electrical, data and DigiHome rough-in
4. HVAC
5. UFH
6. Pre-line hold point
7. Insulation
8. Linings
9. Level 5 skim
10. Waterproofing
11. Tiling
12. Paint first coats
13. Lift
14. Doors and trims
15. Kitchens
16. Feature stair
17. Benchtops
18. Services second fix
19. Gas fire
20. Final paint coat
21. Oak and carpet
22. Commissioning
23. Handover

- **House 1–5 switch** (or keys 1–5): repeats the fitout for each house with its own dates. House 1 carries the benchmark week for the Level 5 skim and tiling.
- **Terrace flow-line chart**: shows all five houses, with a live line for "on site today" and what each house is doing on that date. Click a house row to switch to it.
- **Plan views**: LG, L1 and L2 plans, plus section and garden views.
- **Display toggles**: see-through ceilings and room names.
- **Deep links**: e.g. `fitout.html#h3-tile`.

## Walkthrough (`walkthrough.html`)

A walkthrough of the completed project at eye height (1.6 m). It uses the finished whole-building model with all five houses fitted out and furnished.

- **Guided tour** (about 2 minutes, 16 stops): Goldie Street, front garden and porch, LG entry and gallery, open stair, media room, bedroom 3, east terrace, pool court, basement carpark, garage/stair/lift, L1 living, dining and kitchen, L2 master, ensuite, L2 roof terrace, and a final aerial. Each stop has a caption on its finishes. Click any stop in the route list, or on the timeline, to jump to it.
- **Walk it yourself**: W A S D or arrow keys to walk, drag to look, Shift to go faster. On phones, use the on-screen stick. You can't walk through walls, and you can walk down the ramps into the basement and between floors. The *Go to* buttons jump to the street, LG, L1, L2, the garden or the basement.

The LG follows HAL AD-11. The L1 and L2 layouts and all furniture are indicative, because the HAL upper-floor plans aren't in the pack.

## Running locally

It uses ES modules, so serve the folder rather than opening the file directly:

```
python3 -m http.server 8000
# open http://localhost:8000
```

three.js is vendored in `vendor/` (MIT licence), so the viewer works offline.

## Files

| File | What it holds |
|---|---|
| `js/stages.js` | The 32 stages: dates, weeks, package, description, quantities, hold points, plant and crew. Edit this to change the sequence text. |
| `js/model.js` | Builds every element and tags it with the stage it is built in (and, for temporary works, the stage it comes out). |
| `js/app.js` | Scene, sequencer, camera views, section cuts and the stage panel. |
| `js/fitout-stages.js` | The 23 house fitout stages and the flow-line timing (start, 3-week offset, House 1 benchmark). |
| `js/fitout-model.js` | The house model: shell, framing, services, linings, wet areas, joinery, lift, stair, floors. |
| `js/fitout-app.js` | Fitout viewer: sequencer, house switch, flow-line chart. |

## Sources

These are all from the Goldie Street pack in Google Drive:

- RWC Construction Methodology Rev C
- Concrete Phase Methodology Rev 6
- Detailed Programme Rev C
- Site Logistics & Phasing Rev C

### Set-out

The model is set out to Hulena Architects AD-06 (site plan), AD-10 (L0 basement) and AD-11 (LG ground floor), Rev D:

- **Grids and houses**: grids 1–8 cover 44.6 m, with a 3.8 m exit ramp bay (north), five 7.4 m houses and a 3.8 m entry ramp bay (south).
- **Rows**: rows G→A cover 26.5 m. The houses run G–C (17.9 m), the LG terrace C–B and the pool court B–A.
- **Site**: 45.27 × 30.18 m (1,364 m²), with a 2.6 m front yard and a 1.08 m rear yard.
- **Levels**: from the methodology. L2 is set back to 14.2 m (525 m² / 37 m), with the roof terrace behind.
- **Basement**: double garages off the aisle on grid E, third spaces, storage under the pool court, the plant room and bin store in grid 7–8, and the basement stair and lift on each house's south party wall.
- **LG layout (AD-11)**: recessed west terrace, entry porch, bed 4 / office, gallery with the open stair, bath 1, coats, laundry, bed 3, media, and the east terrace with the external spiral stair.

Everything is built in drawing coordinates (x = grid 1 → 8, z = street → rear) and mirrored in x at scene level, so the real handedness is kept: the north exit ramp is on the left seen from the street. Not for construction.

### Realism layer

- **`js/realism.js`**: gives every surface a real-scale PBR material (textures in `textures/`, 512 px seamless), and the sky and sun for St Heliers from the actual solar position. It adds image-based reflections, AgX tone mapping, the surrounding suburb, the sea to the north and Rangitoto on the horizon.
- **`js/machines.js`**: models the plant to real dimensions:
  - 130 t / 55 t all-terrain cranes with outriggers on mats, telescopic booms, hook blocks, and working-radius and exclusion rings
  - rotary piling rig, 20 t excavator, 8-wheel tippers, HPMV with precast, boom pump and agitator
  - site cabins, skips, water-filled barriers and cones
  - crews in hi-vis, cars and trees
- **`js/furniture.js`**: furnishes each house (beds, sofas, dining, stools, rugs, lighting, art, sheers, terrace and pool furniture).

### Export and photoreal rendering

- **`tools/export.html`**: exports the finished project (all houses fitted out, the street and suburb) as one `.glb`, in metres with Y up and materials named by surface. Open it in Blender, Twinmotion, Lumion, D5 Render, Enscape or SketchUp.
- **`tools/render_blender.py`**: renders photoreal stills of that `.glb` with Blender Cycles. Output goes to `renders/`.
- **`tools/build_share.py`**: rebuilds the three standalone share files, with textures embedded.

### Open items flagged from the drawings

- **Stairs**: AD-11 shows the internal stairs as straight flights. The spiral stair is the external one on each east terrace. Confirm with HAL if a spiral is wanted inside.
- **Basement area**: AD-10 draws the basement over grid 1–8 × A–G (~1,180 m², secant line ~135 lm), but the pack carries 769 m² and 115 lm.

## Sending to people without Claude

`share/` holds standalone single-file versions with everything built in, plus MP4 videos:

- `Goldie_Street_Build_Sequence.html` / `.mp4`
- `Goldie_Street_House_Fitout.html` / `.mp4`
- `Goldie_Street_Walkthrough.html` / `.mp4`

Email them or put them on a shared drive. The recipient downloads each file and double-clicks it to open it in any modern browser. No login and no server are needed. If you change the source, rebuild them by bundling `js/app.js` and `js/fitout-app.js` with esbuild (`--bundle --format=iife --alias:three=./vendor/three.module.min.js`) and inlining the result in place of the module script.
