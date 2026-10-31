// Run: node test/giza.test.mjs – compares the website's plot maths with pv_realm_tools.py (Garden project PV_Reference).
import { execFileSync } from "node:child_process";
import { gizaZone, plotCentre, plotDeposit, plotFeature, landParcel, ringPlots, nextPlots, plotKey, START_RING } from "../worker/lib/giza.js";
const TOOLS = process.env.PV_TOOLS || "../PV World 1 - Celestial Garden/PV_Reference/pv_realm_tools.py";
const dir = TOOLS.replace(/[^/]+$/, "");
const py = (code) => execFileSync("python3", ["-c", `import sys, json, random; sys.path.insert(0, ${JSON.stringify(dir)}); import pv_realm_tools as t\n${code}`], { maxBuffer: 64 << 20 }).toString();
let pass = 0, fail = 0;
const eq = (l, g, w) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++; else { fail++; if (fail < 15) console.log("FAIL", l, g, w); } };

const rows = JSON.parse(py(`
random.seed(11)
out = []
for i in range(4000):
    x, y = random.randint(104, 920), random.randint(104, 920)
    e, n = t.plot_centre_m(x, y)
    z = t.giza_zone(e, n)
    out.append([x, y, z, list(t.plot_deposit(1, x, y, z)), list(t.plot_feature(1, x, y, z)), t.land_parcel(x, y)])
print(json.dumps(out))`));
for (const [x, y, z, dep, feat, parcel] of rows) {
  const [e, n] = plotCentre(x, y);
  const zj = gizaZone(e, n);
  eq(`zone ${x},${y}`, zj, z);
  eq(`deposit ${x},${y}`, plotDeposit(1, x, y, z), dep);
  eq(`feature ${x},${y}`, plotFeature(1, x, y, z), feat);
  eq(`parcel ${x},${y}`, landParcel(x, y), parcel);
}
// rings cover every cell exactly once
const seen = new Set(); let dup = 0;
for (let k = 1; k <= 40; k++) for (const [x, y] of ringPlots(k)) { const key = x * 2048 + y; if (seen.has(key)) dup++; seen.add(key); }
eq("rings 1–40 cover an 80×80 square once", [seen.size, dup], [6400, 0]);
// placement gives free plots in order and skips taken ones
const a = nextPlots("nile-valley", START_RING["nile-valley"], 5, new Set());
eq("5 nile plots", a.plots.length, 5);
const b = nextPlots("nile-valley", START_RING["nile-valley"], 5, new Set([a.plots[0].key]));
eq("taken plot skipped", b.plots[0].key, a.plots[1].key);
for (const d of ["west-desert", "east-desert", "nile-valley", "oasis"]) {
  const r = nextPlots(d, START_RING[d], 3, new Set());
  eq("district has plots: " + d, r.plots.length, 3);
}
console.log(`PV website plot maths test: ${pass} passed, ${fail} failed.`);
console.log("first Nile Valley offers:", a.plots.slice(0, 3).map(p => `${p.code} ${p.metresFromPyramid} m ${p.deposit}${p.feature ? " +" + p.feature : ""}`).join(" | "));
process.exit(fail ? 1 : 0);
