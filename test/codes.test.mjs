// Run: node test/codes.test.mjs  (from the website folder, on the owner's computer – Claude runs it).
// Test vectors are made live by pv_realm_tools.py in the Garden project's PV_Reference (the salt is read from there at
// test time only; it is never copied into this project).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { decodeClaim, nameHash16, nameHash32Hex } from "../worker/lib/codes.js";

const TOOLS = process.env.PV_TOOLS || "../PV World 1 - Celestial Garden/PV_Reference/pv_realm_tools.py";
const salt = /SALT_HC = "([^"]+)"/.exec(readFileSync(TOOLS, "utf8"))[1];
const py = (code) => execFileSync("python3", ["-c", `import sys, datetime; sys.path.insert(0, ${JSON.stringify(TOOLS.replace(/[^/]+$/, ""))}); import pv_realm_tools as t\n${code}`]).toString().trim();

let pass = 0, failN = 0;
const eq = (label, got, want) => { if (JSON.stringify(got) === JSON.stringify(want)) pass++; else { failN++; console.log("FAIL", label, "got", got, "want", want); } };

eq("name hash 16", nameHash16("Prospect Valley"), 4775);
eq("owner hash", nameHash32Hex("Prospect Valley"), "ed3fff98");
eq("owner hash 2", nameHash32Hex("Knight Rider 7"), "75b65691");

const NAME = "Prospect Valley";
const h1 = py(`print(t.encode_hc("${NAME}", 1, 0, 0, t.answers_pack(0, 1, 2, 0), datetime.date(2026, 10, 30)))`);
let r = decodeClaim(h1, NAME, salt, new Date(Date.UTC(2026, 9, 30)));
eq("claim ok", [r.ok, r.kind, r.originName, r.callingName, r.tests, r.heart, r.made], [true, "claim", "Sandborn", "Knight", [0, 1, 2], 0, "2026-10-30"]);
eq("lower case + O/I typos tolerated", decodeClaim(h1.toLowerCase(), NAME, salt, new Date(Date.UTC(2026, 9, 31))).ok, true);
eq("wrong name", decodeClaim(h1, "Prospect valley", salt, new Date(Date.UTC(2026, 9, 30))).error, "name");
eq("expired", decodeClaim(h1, NAME, salt, new Date(Date.UTC(2026, 11, 15))).error, "expired");
eq("typo", decodeClaim(h1.slice(0, -1) + (h1.endsWith("0") ? "1" : "0"), NAME, salt, new Date(Date.UTC(2026, 9, 30))).error, "check");
eq("short", decodeClaim("HC-12345", NAME, salt).error, "length");

const h3 = py(`print(t.encode_hc("Knight Rider 7", 2, 1, 2, t.answers_pack(1, 0, 0, 2), datetime.date(2027, 10, 1)))`);
r = decodeClaim(h3, "Knight Rider 7", salt, new Date(Date.UTC(2027, 9, 5)));
eq("renewal 2027", [r.ok, r.kind, r.originName, r.callingName, r.heart, r.made], [true, "renewal", "Lampkeeper", "Scholar", 2, "2027-10-01"]);

const lk = py(`print(t.link_value("LINK-7KQ2"))`);
const h2 = py(`print(t.encode_hc("${NAME}", 1, 4, 3, t.answers_pack(0, 0, 1, 4), datetime.date(2026, 10, 30), t.link_value("LINK-7KQ2")))`);
r = decodeClaim(h2, NAME, salt, new Date(Date.UTC(2026, 9, 30)));
eq("link", [r.ok, r.originName, r.callingName, r.heart, r.link], [true, "Trader", "Merchant", 4, Number(lk)]);

// a sweep: 300 random codes from the Python tool must all decode the same way
const many = JSON.parse(py(`
import random, json
random.seed(7)
out = []
for i in range(300):
    name = "Player " + str(random.randint(1, 99999))
    d = datetime.date(2026, 1, 1) + datetime.timedelta(days=random.randint(0, 2000))
    o, c, a = random.randint(0, 6), random.randint(0, 7), t.answers_pack(random.randint(0,3), random.randint(0,3), random.randint(0,3), random.randint(0,7))
    out.append([name, t.encode_hc(name, 1, o, c, a, d), o, c, a & 7, d.isoformat()])
print(json.dumps(out))`));
for (const [name, code, o, c, heart, made] of many) {
  const [y, m, d] = made.split("-").map(Number);
  const res = decodeClaim(code, name, salt, new Date(Date.UTC(y, m - 1, d + 3)));
  eq("sweep " + code, [res.ok, res.origin, res.calling, res.heart, res.made], [true, o, c, heart, made]);
}
console.log(`PV website codes test: ${pass} passed, ${failN} failed.`);
process.exit(failN ? 1 : 0);
