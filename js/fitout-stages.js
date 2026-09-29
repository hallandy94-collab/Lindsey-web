// Goldie Street – house fitout sequence, repeated for Houses 1–5.
// Trade order and scope from RWC Construction Methodology Rev C (sections 10–13)
// and Detailed Programme Rev C (6.2–6.9, 7.1–7.12, 9.1–9.5). Per-house durations
// are an indicative 17-week takt with a 3-week offset between houses, fitted to
// the programme window (services from 1 Mar 2027, fitout complete ~24 Sep 2027).
// House 1 carries an extra week for the Level 5 and tiling benchmarks.

export const HOUSES = 5;
export const FLOW = {
  firstStart: '2027-03-01', // House 1 starts, after weathertight (late Feb 2027)
  offsetWeeks: 3,            // gap between houses in the flow-line
  h1Benchmark: 1,            // extra weeks on House 1 from the L5 skim onward
};

// phase: groups stages for the flow-line chart
export const PHASES = [
  { id: 'rough', name: 'Framing & rough-in' },
  { id: 'close', name: 'Close-in & linings' },
  { id: 'wet', name: 'Wet areas & paint' },
  { id: 'joinery', name: 'Joinery & fit-off' },
  { id: 'finish', name: 'Floors & commissioning' },
];

// s = start week within the house, d = duration in weeks (standard house)
export const FIT_STAGES = [
  { id: 'frame', phase: 'rough', s: 0, d: 1.5, trade: 'Lindsay Building – carpenters', view: 'iso',
    title: 'Set-out & internal framing',
    what: 'Set out walls from the structure survey, then frame the partitions and bulkheads: steel stud on LG and L1, prenail timber on L2. Leave the exposed concrete party walls clean. Nothing fixes to them without the agreed junction detail.',
    scope: ['Steel stud partitions LG & L1', 'Prenail timber walls L2', 'Bulkhead & ceiling framing for services voids', 'Nogs for joinery, grab rails & TV walls'],
    holds: ['Set-out checked against the structure survey', 'No fixings into exposed-face precast'] },
  { id: 'plumb', phase: 'rough', s: 1, d: 1.5, trade: 'Lindsay Building – plumbing & gas', view: 'iso',
    title: 'Plumbing & gas rough-in',
    what: 'Rough in hot, cold and waste to every wet area off the house stack, with gas to the hob, the Escea fire and the HWCs. Pressure test before anything closes in.',
    scope: ['Hot & cold PEX to powder, 2 baths, ensuite, kitchen, scullery', 'uPVC wastes to the house stack', 'Gas to hob and fireplace', 'Feeds to 2 × 380 L heat-pump HWCs'],
    holds: ['Water pressure test', 'Gas pressure test & certificate'] },
  { id: 'elec', phase: 'rough', s: 1.5, d: 1.5, trade: 'Leck (electrical) + DigiHome', view: 'iso',
    title: 'Electrical, data & DigiHome rough-in',
    what: 'Cable the lighting, power and data. Fix switch and outlet boxes in the studs, and cable security, cameras, WiFi and access control for DigiHome.',
    scope: ['Lighting & power circuits', 'Data / WiFi / AV cabling', 'DigiHome security & automation', 'Lift & HVAC supplies'],
    holds: ['Box heights checked against joinery & tile set-out'] },
  { id: 'hvac', phase: 'rough', s: 2, d: 2, trade: 'Econair (HVAC)', view: 'iso',
    title: 'Ducted heat pump & ventilation',
    what: 'Ducted heat-pump trunks and branches in the ceiling voids and bulkheads, with the outdoor unit on the L2 terrace, plus bathroom and laundry ventilation.',
    scope: ['Ducted heat-pump system per level', 'Supply & return grilles', 'Bathroom extract ventilation', 'Outdoor unit on L2 terrace'],
    holds: ['Duct leakage check before ceilings close'] },
  { id: 'ufh', phase: 'rough', s: 3, d: 1, trade: 'Lindsay Building – plumbing', view: 'iso',
    title: 'Underfloor & under-tile heating',
    what: 'Lay the underfloor heating loops in the living areas and the under-tile heating in the bathrooms, then pressure test and record them before any screed or floor goes over.',
    scope: ['UFH loops to LG living / dining', 'Under-tile heating to powder, baths & ensuite'],
    holds: ['Loop pressure test & as-laid photos'] },
  { id: 'preline', phase: 'rough', s: 4, d: 0.4, trade: 'Auckland Council inspector', view: 'iso', hold: true,
    title: 'Pre-line inspection',
    what: 'Council pre-line inspection of framing, services, bracing and fire separation before insulation and linings go on. This is a hold point: nothing closes in until it passes.',
    scope: ['Framing & bracing', 'Plumbing & drainage', 'Passive fire at intertenancy penetrations'],
    holds: ['Council pre-line PASS before insulation'] },
  { id: 'insul', phase: 'close', s: 4.2, d: 1, trade: 'Insulation installer', view: 'iso',
    title: 'Insulation & acoustic / fire integrity',
    what: 'Acoustic batts in every partition and ceiling. Seal and fire-stop around the intertenancy panels so the acoustic and fire ratings between houses hold.',
    scope: ['Acoustic batts to partitions', 'Ceiling insulation', 'Fire-stopping at intertenancy junctions'],
    holds: ['Passive fire inspection (third party)'] },
  { id: 'line', phase: 'close', s: 5, d: 1.5, trade: 'Lindsay Building – GIB fixers', view: 'iso',
    title: 'Plasterboard linings',
    what: 'Fix walls and ceilings, with shadow-gap trims wherever plasterboard meets the exposed concrete party walls.',
    scope: ['Wall & ceiling linings', 'Wet-area aqualine to baths & ensuite', 'Shadow-gap trims at concrete junctions'],
    holds: ['Fixing inspection before stopping'] },
  { id: 'skim', phase: 'close', s: 6.5, d: 2, trade: 'Lindsay Building – stoppers', view: 'iso', bench: true,
    title: 'Level 5 stopping & skim coat',
    what: 'Level 5 finish: skim-coat all walls and ceilings, then check them under raking light. House 1 sets the benchmark for the plasterboard-to-concrete junctions before the other houses start.',
    scope: ['Full skim coat walls & ceilings', 'Raking-light check'],
    holds: ['Raking-light inspection', 'House 1 benchmark signed off before roll-out'] },
  { id: 'wp', phase: 'wet', s: 7, d: 1, trade: 'Waterproofing applicator', view: 'iso',
    title: 'Wet-area waterproofing & screeds',
    what: 'Screed to falls in the showers and bathrooms, then apply the liquid membrane to floors and up the walls with bond-breakers at every corner.',
    scope: ['Screeds to falls', 'Membrane to floors & walls', 'Flood test to showers'],
    holds: ['Membrane inspection + 24 h flood test before tiling'] },
  { id: 'tile', phase: 'wet', s: 8, d: 2, trade: 'Tiler', view: 'iso', bench: true,
    title: 'Porcelain tiling',
    what: 'Large-format porcelain to the bathroom floors and walls, with outdoor porcelain on pedestals to the L2 terrace. House 1 is the tiling benchmark.',
    scope: ['Floor & wall tiles – powder, 2 baths, ensuite', 'Outdoor pedestal tiles – L2 terrace'],
    holds: ['House 1 tiling benchmark', 'Set-out & lippage check'] },
  { id: 'paint', phase: 'wet', s: 8.5, d: 1.5, trade: 'Painter', view: 'iso',
    title: 'Painting – Resene first coats',
    what: 'Seal and first coat the walls and ceilings (Resene 3-coat system). The final coat goes on at the end, after the other trades have left.',
    scope: ['Sealer + first coat walls & ceilings'],
    holds: ['Surface check before paint'] },
  { id: 'lift', phase: 'joinery', s: 9, d: 3, trade: 'Powerglide', view: 'side',
    title: 'Lift install & commission',
    what: 'Install the Powerglide S-Series 350 kg lift in the precast shaft, surveyed and signed off for plumb, then commission it for WorkSafe registration.',
    scope: ['Powerglide S-Series 350 kg', 'Landing doors LG, L1, L2'],
    holds: ['Shaft plumb survey vs Powerglide tolerance', 'WorkSafe registration'] },
  { id: 'doors', phase: 'joinery', s: 10, d: 1, trade: 'Lindsay Building – carpenters', view: 'iso',
    title: 'Doors, trims & carpentry',
    what: 'Hang the over-height solid-core doors with FSB bronze hardware, then fit the skirtings, trims and front-of-wall carpentry.',
    scope: ['Over-height solid-core doors', 'FSB bronze hardware', 'Skirtings & trims'],
    holds: [] },
  { id: 'kitchen', phase: 'joinery', s: 10.5, d: 1.5, trade: 'Kitchens By Design (By Owner)', view: 'iso', owner: true,
    title: 'Kitchen, scullery & wardrobes',
    what: 'Kitchens By Design fits the kitchen, scullery, wardrobes and vanities, site-measured into the flow-line. This is By Owner supply, so late delivery is tracked as a client risk and the house can be leapfrogged.',
    scope: ['Kitchen & island', 'Scullery', 'Wardrobes & walk-in robe', 'Vanities'],
    holds: ['Site measure window booked with owner supplier'] },
  { id: 'stair', phase: 'joinery', s: 11, d: 1.5, trade: 'Stair maker (By Owner)', view: 'side', owner: true,
    title: 'Feature stair, oak handrail & balustrade',
    what: 'The internal feature stair (By Owner) with oak treads and handrail and a frameless glass balustrade, from LG to L2.',
    scope: ['Oak stair LG → L1 → L2', 'Glass balustrade & oak handrail'],
    holds: ['Balustrade load / PS3'] },
  { id: 'bench', phase: 'joinery', s: 11.5, d: 1.5, trade: 'Stone / porcelain fabricator', view: 'iso',
    title: 'Benchtops – template & fit',
    what: 'Template over the installed cabinetry, then fabricate and fit the sintered and porcelain benchtops to the kitchen, scullery and vanities.',
    scope: ['Kitchen & island benchtops', 'Scullery & vanity tops'],
    holds: ['Template sign-off'] },
  { id: 'fitoff', phase: 'joinery', s: 13, d: 1.5, trade: 'Plumber, Leck, Econair', view: 'iso',
    title: 'Services second fix & fit-off',
    what: 'Terminate everything: sanitaryware and tapware (Duravit), appliances (Gaggenau / Miele, By Owner), light fittings, switch plates and HVAC grilles.',
    scope: ['Sanitaryware & tapware', 'Appliances (By Owner supply)', 'Lights, switches, grilles'],
    holds: [] },
  { id: 'fire', phase: 'joinery', s: 13.5, d: 0.5, trade: 'Gas fitter (By Owner supply)', view: 'iso', owner: true,
    title: 'Escea gas fire',
    what: 'Install the Escea feature gas fire in the living room and connect it to the gas rough-in.',
    scope: ['Escea gas fire & flue'],
    holds: ['Gas certificate'] },
  { id: 'final', phase: 'finish', s: 14, d: 1, trade: 'Painter', view: 'iso',
    title: 'Final paint coat',
    what: 'Final Resene coat after the trades have finished, then touch-ups.',
    scope: ['Final coat walls & ceilings', 'Doors & trims'],
    holds: [] },
  { id: 'floor', phase: 'finish', s: 14.5, d: 1.5, trade: 'Flooring (By Owner supply)', view: 'iso', owner: true,
    title: 'Oak flooring & carpet',
    what: 'Engineered oak goes down last in living areas and halls, then wool carpet in the bedrooms, all laid behind the final paint and protected with Ramboard.',
    scope: ['Engineered oak floors', 'Wool carpet to bedrooms', 'Ramboard protection'],
    holds: [] },
  { id: 'comm', phase: 'finish', s: 15.5, d: 1, trade: 'Econair, Leck, DigiHome', view: 'iso',
    title: 'Commissioning',
    what: 'Commission and pre-commission the house: HVAC, UFH and under-tile heating, hot water, lighting scenes and DigiHome automation and security.',
    scope: ['HVAC & ventilation', 'UFH & HWCs', 'DigiHome scenes & security'],
    holds: ['Commissioning records per system'] },
  { id: 'handover', phase: 'finish', s: 16, d: 1, trade: 'Lindsay Building', view: 'iso',
    title: 'Clean, defects & handover',
    what: 'Remove the protection, do the builder\'s clean, close out defects and hand over the house with O&M manuals and warranties.',
    scope: ['Protection removed', 'Builder\'s clean', 'Defects closed', 'O&M, warranties'],
    holds: ['Defects walk with client'] },
];

const DAY = 864e5;
const toDate = s => new Date(s + 'T00:00:00');

// Dates of a stage for a given house (0-based)
export function stageDates(stage, house) {
  const idx = FIT_STAGES.indexOf(stage);
  const benchIdx = FIT_STAGES.findIndex(s => s.id === 'skim');
  const houseStart = FLOW.offsetWeeks * house + (house > 0 ? FLOW.h1Benchmark : 0);
  let s = stage.s, d = stage.d;
  if (house === 0) {
    if (idx >= benchIdx) s += FLOW.h1Benchmark;
    if (stage.bench) d += FLOW.h1Benchmark * 0.5;
  }
  const base = toDate(FLOW.firstStart).getTime();
  const start = new Date(base + (houseStart + s) * 7 * DAY);
  const end = new Date(start.getTime() + d * 7 * DAY);
  return { start, end };
}

export function houseSpan(house) {
  const all = FIT_STAGES.map(s => stageDates(s, house));
  return { start: new Date(Math.min(...all.map(a => a.start))), end: new Date(Math.max(...all.map(a => a.end))) };
}
