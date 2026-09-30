# Goldie Street – professional visualisation brief

Vellenoweth Green Residences, 10–14 Goldie Street, St Heliers, Auckland. The client is Fran Young, the project manager is PMD Services, the architect is Hulena Architects Ltd (HAL) and construction consulting is by RWC.

This brief is for a visualisation studio, or for producing marketing-grade stills and film ourselves in Twinmotion, Lumion, D5 Render or Unreal Engine. Everything below can be built from the model in this repository today. The items under *Still needed* would take it from "accurate and realistic" to "exactly the HAL design".

## 1. The model

- **File**: `Goldie_Street_Completed.glb`, exported from `tools/export.html`. It contains:
  - the building set out to HAL AD-06, AD-10 and AD-11 Rev D
  - all five houses fitted out and furnished
  - Goldie Street with its drive-in bays, the neighbours, and the surrounding suburb
- **Units and axes**: metres, Y up. It's in true orientation: +X = north, +Z = east, and Goldie Street is to the west.
- **Materials**: named by surface (concrete, render, grc, cladding, glass, water, oak, carpet, tile, stone, marble, paving, aggregate, asphalt, grass, block, cedar, decking, galv, membrane…). In Twinmotion, Lumion or D5, replace each by name with the library material in section 3.
- **Levels (RL)**: street 3.75, L0 1.82, LG 4.61, L1 7.84, L2 11.07, roof about 14.1.

## 2. Shot list

| # | Shot | Camera | Time and light |
|---|---|---|---|
| 1 | Street hero: whole frontage | Across Goldie St on the Vellenoweth Green side, eye height 1.6 m, 24–28 mm, verticals corrected | 15 Mar, 15:30, sun north-west (alt 46°, az 314°) |
| 2 | Street oblique | North-west corner of the frontage, 35 mm | Same |
| 3 | Aerial | Drone from the south-west, about 40 m, 35 mm | Same |
| 4 | Pool court | House 3 court at podium level, looking back at the rear facade and pool | 20 Jan, 17:30, low west sun (alt 36°, az 271°) |
| 5 | Rear dusk | Elevated from the rear boundary, interiors lit | Civil dusk, interiors 2700 K |
| 6 | L1 living | House 2, looking to the street glazing and the reserve | 10:00, soft morning light |
| 7 | Kitchen / dining | House 2 L1, island foreground, garden beyond | Same |
| 8 | Master bedroom | House 2 L2, sheers, view to Vellenoweth Green | Same |
| 9 | Ensuite | Vanity foreground, walk-in shower and bath | Interior lighting |
| 10 | Film, 90 s | Follow the walkthrough route in `walkthrough.html`: street, porch, gallery, media, terrace, pool, basement, L1, L2, roof terrace, aerial pull-out | As above, with a time-of-day ramp for the finale |

Camera positions for shots 1–6 are defined in `tools/render_blender.py`. The film route is `SHOTS` in `js/walk-app.js`, in building coordinates; mirror x for world coordinates.

## 3. Materials schedule

These are from the HAL Outline Spec Rev 00 and the Lindsay Building Estimate Rev A. Confirm them against the HAL finishes schedule when it's issued.

| Element | Specification | Render look |
|---|---|---|
| Walls, main | Sto render system on cavity | Fine float finish, warm white (about Resene Alabaster), slightly matte |
| Feature fins | GRC panels | Off-white with a fine sand texture, crisp arrises |
| Spandrels / parapets | Nu-Wall profiled aluminium | Dark grey/charcoal, satin, vertical profile |
| Joinery | APL Architectural Series, Low-E IGU | Dark bronze or black frames, neutral glass with a slight green edge |
| Balustrades | Viridian frameless glass | Clear, low-iron look, stainless spigots |
| Balcony soffits | Abodo timber | Warm natural timber, vertical grain |
| Party walls (inside) | Exposed architectural precast | Smooth grey concrete, faint form joints |
| Floors, living | Engineered oak | Light-to-mid European oak, matt lacquer, 180–220 mm boards |
| Floors, bedrooms | Wool carpet | Warm grey-beige loop pile |
| Wet areas | Large-format porcelain 600 × 1200 | Light stone look, 2 mm grout |
| Benchtops | Sintered stone | White with soft grey veining |
| Kitchens | Kitchens By Design (By Owner) | Dark timber veneer and matt white, handleless |
| Appliances | Gaggenau | Black glass and stainless |
| Fire | Escea gas fire | Black frame, live flame |
| Pools | Precast shell, fibreglass lining, stone coping | Aqua lining, travertine-look coping |
| Terraces | Outdoor porcelain | Anti-slip light stone |
| Fences | Cedar slat screens | Natural cedar, 20–30 mm gaps |
| Driveway | Exposed aggregate, black oxide | Dark with white and grey stones |
| Carpark doors | Metalbilt ARA perforated | Dark grey, perforated |

## 4. Context

- **Location**: St Heliers, Auckland (−36.85°, 174.86°). Vellenoweth Green reserve is across Goldie Street to the west. The Hauraki Gulf is to the north, with Rangitoto on the northern horizon.
- **Neighbours**: No. 8 Goldie St (north), No. 16 (south), and Maheke St / Polygon Rd houses behind. These are mostly weatherboard and plaster homes with pitched iron or tile roofs.
- **Planting**: native coastal planting. Suggested:
  - pōhutukawa in the reserve and street berm
  - harakeke (flax), lomandra and griselinia hedges in the planters
  - a specimen tree in each rear planter

## 5. Still needed to finish the job

1. HAL **L1 and L2 floor plans** (AD-12 / AD-13). The upper floors are indicative now.
2. HAL **elevations and sections** (AD-31, AD-50, AD-51). These give the exact fin rhythm, window mullions, parapet heights and balcony profiles.
3. HAL **finishes schedule** (colours and products), and the **landscape plan**.
4. The **IFC or Revit model**, if HAL can release it, to replace the massing one-for-one.
5. **Site photos or a drone flyover** of 10–14 Goldie St and the street. These are for matching the real neighbours, trees, kerbs and the reserve, and for a photo-matched hero shot.
