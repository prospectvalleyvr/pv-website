// Prospect Valley – plot maths for the website: plot keys, Land parcels, Giza zones, deposits and features.
// Same results as pv_realm_tools.py (PV_Land_Giza.md, Realm Charter Part 1) – test/giza.test.mjs checks it.
// Everything here is public world-generation maths (no secrets).

export const PLOT_M = 12.192, GRID = 1024, GC = 512, LAND_PARCELS = 19, PARCEL_PLOTS = 43;
export const LAND_START = GC - Math.floor((LAND_PARCELS * PARCEL_PLOTS) / 2);   // 104
export const COLS = "ABCDEFGHJKLMNPQRSTU";
export const LAND_CODES = ["PVR", "GIZ", "ALX", "BAB", "OLY", "EPH", "HAL", "RHO"];
const FNV0 = -2128831035, FNVP = 16777619;

export const plotKey = (land, x, y) => (land << 20) | (x << 10) | y;
export const fromKey = (k) => [k >> 20, (k >> 10) & 1023, k & 1023];
export const plotCode = (land, x, y) => `${LAND_CODES[land] || "L" + String(land).padStart(3, "0")}-${String(x).padStart(4, "0")}-${String(y).padStart(4, "0")}`;
export const plotCentre = (x, y) => [(x - GC + 0.5) * PLOT_M, (y - GC + 0.5) * PLOT_M];

export function landParcel(x, y) {
  if (x < LAND_START || y < LAND_START) return null;
  const c = Math.floor((x - LAND_START) / PARCEL_PLOTS), r = Math.floor((y - LAND_START) / PARCEL_PLOTS);
  return c < LAND_PARCELS && r < LAND_PARCELS ? `${COLS[c]}${r + 1}` : null;
}

export const gizaNileE = (n) => 3000 + 250 * Math.sin(n / 1800.0);

export function gizaZone(e, n) {
  const ne = gizaNileE(n);
  if (Math.abs(e - ne) < 130) return "water";
  if (Math.abs(e) < 786 && Math.abs(n) < 786) return "crown grounds";
  for (const [de, dn] of [[-1400, 600], [2100, -2600], [-2600, 1900], [-3700, -3300]])
    if (Math.hypot(e - de, n - dn) < 60) return "dig site";
  if (Math.abs(n) < 12.2 || Math.abs(e - (ne - 450)) < 12.2) return "road";
  if (ne - 1500 < e && e < ne - 300 && Math.abs(n) < 1100) return "town";
  if (Math.abs(e - ne) < 1700) return "river farmland";
  if (-3000 < e && e < -1500 && 1400 < n && n < 2600) return "quarry ridge";
  if (Math.hypot(e + 3200, n + 2600) < 650) return "oasis";
  return "desert";
}

/** Homestead district of a Giza plot, or null if it isn't free-Homestead land. */
export function gizaDistrict(x, y) {
  if (!landParcel(x, y)) return null;
  const [e, n] = plotCentre(x, y);
  const z = gizaZone(e, n);
  if (z === "desert") return e < gizaNileE(n) ? "west-desert" : "east-desert";
  if (z === "river farmland") return "nile-valley";
  if (z === "oasis") return "oasis";
  return null;
}

function units(s) { const o = []; for (let i = 0; i < s.length; i++) o.push(s.charCodeAt(i)); return o; }
function seedHash(seed, land, x, y) {
  let h = FNV0;
  for (const c of units(seed)) h = Math.imul(h ^ c, FNVP);
  for (const v of [land, x, y]) { h = Math.imul(h ^ (v + 1), FNVP); h = h ^ ((h >> 13) & 0x7FFFF); }
  return h;
}

const ZONE_DEPOSITS = {
  "river farmland": [["Grain", 5], ["Linen", 3], ["Reed", 3], ["Clay", 2], ["Fish", 2], ["Livestock", 1]],
  "desert": [["Sand", 5], ["Salt", 2], ["Limestone", 2], ["Copper", 1], ["Gold", 1]],
  "quarry ridge": [["Limestone", 5], ["Granite", 2], ["Copper", 2], ["Gold", 1], ["Gems", 1]],
  "oasis": [["Dates", 5], ["Fruit", 3], ["Herbs", 2], ["Incense", 1]],
  "town": [["Clay", 2], ["Sand", 1]],
};
const RICHNESS = ["", "Poor", "Fair", "Rich"];

/** [resource, richness 0–3] of a plot – identical to plot_deposit() in the tools and the worlds. */
export function plotDeposit(land, x, y, zone) {
  const table = ZONE_DEPOSITS[zone];
  if (!table) return ["none", 0];
  const h = seedHash("PV-deposits-v1", land, x, y);
  const total = table.reduce((a, [, w]) => a + w, 0);
  let roll = (h & 0x7FFF) % total, res = table[table.length - 1][0];
  for (const [r, w] of table) { if (roll < w) { res = r; break; } roll -= w; }
  return [res, [0, 1, 1, 1, 2, 2, 3][((h >> 15) & 0xFFFF) % 7]];
}
export const richnessName = (r) => RICHNESS[r] || "";

const FEATURES = ["none", "Spring", "Ancient palm", "Ruined wall", "Viewpoint", "Buried cache", "Cave mouth", "Fossil bed"];
const CACHE_RELICS = ["Clay seal", "Bronze mirror", "Scarab amulet", "Gold ring", "Inscribed tablet shard", "Star chart fragment"];
const FEATURE_ZONES = new Set(["river farmland", "desert", "oasis", "town", "quarry ridge"]);

/** [feature, relic or ""] – shown BEFORE a player chooses a plot (no surprises, no chance). */
export function plotFeature(land, x, y, zone) {
  if (!FEATURE_ZONES.has(zone)) return ["none", ""];
  const h = seedHash("PV-features-v1", land, x, y);
  if ((h & 0xFFFF) % 40 !== 0) return ["none", ""];
  const f = 1 + ((h >> 16) & 0x7FFF) % 7;
  return [FEATURES[f], FEATURES[f] === "Buried cache" ? CACHE_RELICS[((h >> 8) & 0xFF) % CACHE_RELICS.length] : ""];
}

/** Everything a player sees about a Giza plot before choosing it. */
export function describeGizaPlot(x, y) {
  const [e, n] = plotCentre(x, y);
  const zone = gizaZone(e, n);
  const [res, rich] = plotDeposit(1, x, y, zone);
  const [feature, relic] = plotFeature(1, x, y, zone);
  return {
    key: plotKey(1, x, y), code: plotCode(1, x, y), parcel: landParcel(x, y), zone, district: gizaDistrict(x, y),
    metresFromPyramid: Math.round(Math.hypot(e, n)), deposit: res, richness: richnessName(rich),
    feature: feature === "none" ? "" : feature, relic,
  };
}

// ---------------------------------------------------------------- placement order (public and fixed)
// Free Homesteads are offered in one fixed order: square rings outward from the Great Pyramid (ring k = plots whose
// larger offset from the centre is k), each ring walked clockwise from its north-west corner. The first players to
// claim get the plots nearest the Wonder – first come, first served, no draw.

/** Plots of square ring k around the centre, in order. */
export function ringPlots(k) {
  const out = [];
  if (k === 0) return out;
  const lo = GC - k, hi = GC + k - 1;          // the centre sits on the corner between cells 511 and 512
  for (let x = lo; x <= hi; x++) out.push([x, hi]);           // north edge, west → east
  for (let y = hi - 1; y >= lo; y--) out.push([hi, y]);       // east edge, north → south
  for (let x = hi - 1; x >= lo; x--) out.push([x, lo]);       // south edge, east → west
  for (let y = lo + 1; y <= hi - 1; y++) out.push([lo, y]);   // west edge, south → north
  return out;
}

/** First ring holding each district, and its size in plots (computed once; matches PV_Realm_Charter 1.5). */
export const START_RING = { "west-desert": 65, "nile-valley": 95, "oasis": 210, "east-desert": 366 };
export const DISTRICT_PLOTS = { "west-desert": 382156, "nile-valley": 191055, "oasis": 8932, "east-desert": 19146 };

/** The next `count` plots of a district in placement order, starting at ring `fromRing`, skipping `taken` keys. */
export function nextPlots(district, fromRing, count, taken, maxRings = 60) {
  const out = [];
  let ring = fromRing, firstRing = -1;
  for (; ring < fromRing + maxRings && ring <= GC && out.length < count; ring++) {
    for (const [x, y] of ringPlots(ring)) {
      if (gizaDistrict(x, y) !== district) continue;
      if (firstRing < 0) firstRing = ring;
      const k = plotKey(1, x, y);
      if (taken.has(k)) continue;
      out.push(describeGizaPlot(x, y));
      if (out.length >= count) break;
    }
  }
  return { plots: out, firstRing: firstRing < 0 ? fromRing : firstRing, scannedTo: ring };
}

/** Districts a heart answer may choose from while only Giza is open (Charter 7.5). */
export function districtsForHeart(heart) {
  if (heart === 0) return ["west-desert", "east-desert"];
  if (heart === 1 || heart === 5) return ["nile-valley", "oasis"];
  return ["nile-valley"];
}
