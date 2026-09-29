# Goldie Street – 3D build sequence

An interactive 3D model of the Goldie Street project (10–14 Goldie Street, St Heliers) that shows the build step by step, so the construction team can see the sequence. It runs in any browser and needs no install.

It covers 28 stages from site establishment on 29 Jun 2026 to PC in Nov 2027: secant piles, bulk dig, basement tanking, the L0 slab, the CLL undercroft, pools, the Concretec precast cycle, roof, weathertight, facade, the House 1 → 5 services and fitout flow-line, external works and handover.

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
| `js/stages.js` | The 28 stages: dates, weeks, package, description, quantities, hold points, plant and crew. Edit this to change the sequence text. |
| `js/model.js` | Builds every element and tags it with the stage it is built in (and, for temporary works, the stage it comes out). |
| `js/app.js` | Scene, sequencer, camera views, section cuts and the stage panel. |

## Sources

These are all from the Goldie Street pack in Google Drive:

- RWC Construction Methodology Rev C
- Concrete Phase Methodology Rev 6
- Detailed Programme Rev C
- Site Logistics & Phasing Rev C

The massing is built from the pack's quantities and levels: 30.18 m frontage, 769 m² L0 plate, 670 / 525 m² L1 / L2 plates, and the RLs in the methodology. It is **indicative, not the HAL architectural model**. The next step is to import the architect's IFC model and tag its elements to these stages. Not for construction.
