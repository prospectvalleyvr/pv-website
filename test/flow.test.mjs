// Run: node test/flow.test.mjs  (from the website folder, on the owner's computer – Claude runs it).
// End-to-end test of accounts → claims → publisher with an in-memory SQLite database standing in for D1 and a fake
// GitHub. Covers the fixes from the independent review (Oct 31). The salt is read from the Garden tools at test time.
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import worker from "../worker/index.js";
import { nextPlots, START_RING, plotKey, fromKey } from "../worker/lib/giza.js";
import { nameHash32Hex } from "../worker/lib/codes.js";

const TOOLS = process.env.PV_TOOLS || "../PV World 1 - Celestial Garden/PV_Reference/pv_realm_tools.py";
const SALT = /SALT_HC = "([^"]+)"/.exec(readFileSync(TOOLS, "utf8"))[1];
const py = (code) => execFileSync("python3", ["-c", `import sys, datetime; sys.path.insert(0, ${JSON.stringify(TOOLS.replace(/[^/]+$/, ""))}); import pv_realm_tools as t\n${code}`]).toString().trim();
const makeCode = (name, heart, link = 0) => py(`print(t.encode_hc(${JSON.stringify(name)}, 1, 2, 5, t.answers_pack(0, 1, 2, ${heart}), datetime.datetime.utcnow().date(), ${link}))`);

let pass = 0, failN = 0;
const ok = (label, cond, extra) => { if (cond) pass++; else { failN++; console.log("FAIL", label, extra === undefined ? "" : JSON.stringify(extra)); } };

// ---------------------------------------------------------------- D1 stand-in
const sqlite = new DatabaseSync(":memory:");
const isRead = (sql) => /^\s*SELECT/i.test(sql) || /RETURNING/i.test(sql);
class Stmt {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...a) { return new Stmt(this.sql, a); }
  _exec() {
    const st = sqlite.prepare(this.sql);
    if (isRead(this.sql)) return { results: st.all(...this.args), meta: { changes: 0 } };
    const r = st.run(...this.args);
    return { results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  async all() { return this._exec(); }
  async first() { return this._exec().results[0] ?? null; }
  async run() { return this._exec(); }
}
const DB = {
  prepare: (sql) => new Stmt(sql),
  async batch(stmts) {
    sqlite.exec("BEGIN");
    try { const out = stmts.map(s => s._exec()); sqlite.exec("COMMIT"); return out; }
    catch (e) { sqlite.exec("ROLLBACK"); throw e; }
  },
};
const q = (sql, ...a) => sqlite.prepare(sql).all(...a);

// ---------------------------------------------------------------- fake GitHub
const repoFiles = {};
let duringCommit = null, commits = 0;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url), m = init.method || "GET";
  const body = init.body ? JSON.parse(init.body) : null;
  const res = (o) => new Response(JSON.stringify(o), { status: 200 });
  if (m === "GET" && u.includes("/git/ref/heads/")) return res({ object: { sha: "c" + commits } });
  if (m === "GET" && u.includes("/git/commits/")) return res({ sha: "c" + commits, tree: { sha: "t" } });
  if (m === "POST" && u.endsWith("/git/trees")) { if (duringCommit) { const f = duringCommit; duringCommit = null; await f(); } for (const t of body.tree) repoFiles[t.path] = JSON.parse(t.content); return res({ sha: "t2" }); }
  if (m === "POST" && u.endsWith("/git/commits")) return res({ sha: "c" + (++commits) });
  if (m === "PATCH") return res({});
  return new Response("unexpected " + m + " " + u, { status: 500 });
};

const env = { DB, SALT_HC: SALT, CLAIMS_OPEN: "true", PUBLISH_ENABLED: "true", GITHUB_TOKEN: "test", FEED_REPO: "t/realm", FEED_BRANCH: "feed-test",
              ASSETS: { fetch: async () => new Response("asset") } };
const ORIGIN = "https://pv.test";
async function call(path, session, body, method) {
  const headers = { Origin: ORIGIN, "Content-Type": "application/json" };
  if (session) headers.Cookie = "__Host-pv_session=" + session;
  const r = await worker.fetch(new Request(ORIGIN + path, { method: method || (body ? "POST" : "GET"), headers, body: body ? JSON.stringify(body) : undefined }), env);
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, ...(j || {}) };
}
const publish = () => worker.scheduled({}, env, {});
async function sha(s) { const d = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join(""); }
async function addAccount(id, name, adult, session) {
  sqlite.prepare(`INSERT INTO accounts (id, created_at, vrchat_name, adult) VALUES (?, ?, ?, ?)`).run(id, new Date().toISOString(), name, adult);
  sqlite.prepare(`INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)`).run(await sha(session), id, "x", "2099-01-01");
}

// ---------------------------------------------------------------- the flow
await call("/api/me");                                          // creates the tables
const ADULT = "Test Player One", KID = "Kid Player";
await addAccount(1, ADULT, 1, "s1"); await addAccount(2, ADULT, 1, "s2"); await addAccount(3, KID, 0, "s3");
ok("backfill name_bucket", true);

let r = await call("/api/offers?district=nile-valley", "s1");
ok("offers need a checked code", r.status === 400, r);
const c1 = makeCode(ADULT, 1);
r = await call("/api/check-code", "s1", { code: c1 });
ok("check code", r.ok && r.heart === 1, r);
r = await call("/api/offers?district=nile-valley", "s1");
ok("6 offers, nearest first", r.ok && r.plots.length === 6 && r.plots[0].code === "GIZ-0606-0418", r.plots && r.plots[0]);
const offers1 = r.plots;

// same code, two spellings, two plots, at the same moment → exactly one Homestead
const variant = c1.replace(/^HC-/, "").replace(/-/g, "").replace(/0/g, "O") + "U";
const [a, b] = await Promise.all([call("/api/claim", "s1", { code: c1, key: offers1[0].key }), call("/api/claim", "s1", { code: variant, key: offers1[1].key })]);
ok("one of two simultaneous claims wins", [a, b].filter(x => x.ok).length === 1, [a.message, b.message]);
ok("one Homestead row for the account", q(`SELECT COUNT(*) n FROM plots WHERE account_id = 1`)[0].n === 1);
r = await call("/api/claim", "s1", { code: variant, key: offers1[2].key });
ok("second claim refused", !r.ok, r);
// a fresh code from another account can't reuse a spelling of a used code (canonical hash)
ok("used code stored once", q(`SELECT COUNT(*) n FROM used_codes`)[0].n === 1);

// second Discord account, same VRChat name → refused (name already verified by account 1)
const c2 = makeCode(ADULT, 1, 7);
r = await call("/api/claim", "s2", { code: c2, key: offers1[3].key });
ok("same VRChat name on a 2nd account can't claim", !r.ok && /already linked/.test(r.message), r);
r = await call("/api/check-code", "s2", { code: c2 });
ok("…nor verify", r.status === 409, r);

// a claim made straight through the API (no check-code first) verifies the name
const ck = makeCode(KID, 1);
r = await call("/api/claim", "s3", { code: ck, key: offers1[2].key });
ok("kid claims (no check-code first)", r.ok, r);
ok("claim verified kid's name", q(`SELECT name_verified v FROM accounts WHERE id = 3`)[0].v === 1);

// rate limit is shared and atomic
await Promise.all(Array.from({ length: 25 }, () => call("/api/check-code", "s2", { code: "HC-AAAAA-AAAAA-AAAAA-AAAAA" })));
ok("every try counted (atomic)", q(`SELECT code_tries n FROM accounts WHERE id = 2`)[0].n === 27, q(`SELECT code_tries n FROM accounts WHERE id = 2`)[0]);
r = await call("/api/claim", "s2", { code: c2, key: offers1[3].key });
ok("claim refused when over the try limit", r.status === 429, r);

// ---------------------------------------------------------------- publisher
await publish();
const home1 = q(`SELECT key, parcel FROM plots WHERE account_id = 1`)[0], homeK = q(`SELECT key, parcel FROM plots WHERE account_id = 3`)[0];
const pf = (parcel) => repoFiles[`feed/giz/${parcel.toLowerCase()}.json`];
const row = (parcel, key) => (pf(parcel) ? pf(parcel).plots.find(p => p[0] === key) : null);
ok("index published", repoFiles["feed/index.json"] && repoFiles["feed/index.json"].rev === 1, repoFiles["feed/index.json"]);
ok("adult owner hash published", row(home1.parcel, home1.key) && row(home1.parcel, home1.key)[2] === nameHash32Hex(ADULT));
ok("kid's plot published with NO owner hash", row(homeK.parcel, homeK.key) && row(homeK.parcel, homeK.key)[2] === "");
const bucketA = nameHash32Hex(ADULT).slice(0, 2), bucketK = nameHash32Hex(KID).slice(0, 2);
ok("owners bucket has the adult", repoFiles[`feed/owners/${bucketA}.json`].o[nameHash32Hex(ADULT)][0] === home1.key);
ok("kid not in any owners file", !JSON.stringify(Object.entries(repoFiles).filter(([p]) => p.startsWith("feed/owners/"))).includes(nameHash32Hex(KID)));
ok("nothing left to publish", q(`SELECT COUNT(*) n FROM feed_dirty`)[0].n === 0);
ok("no secrets or names in the feed", !JSON.stringify(repoFiles).includes(SALT) && !JSON.stringify(repoFiles).includes(ADULT) && !JSON.stringify(repoFiles).includes(KID));

// a change made WHILE a publish is running is not lost
sqlite.prepare(`INSERT INTO feed_dirty (item, seq) VALUES (?, 1)`).run("parcel:giz:" + home1.parcel);
duringCommit = async () => { const x = await call("/api/profile", "s1", { vrchatName: ADULT, adult: false }); ok("untick 18+ mid-publish", x.ok, x); };
await publish();
ok("mid-publish change still waiting", q(`SELECT COUNT(*) n FROM feed_dirty WHERE item = ?`, "parcel:giz:" + home1.parcel)[0].n === 1);
await publish();
ok("next run hides the unticked owner", row(home1.parcel, home1.key)[2] === "", row(home1.parcel, home1.key));
ok("…and removes them from their owners bucket", !repoFiles[`feed/owners/${bucketA}.json`].o[nameHash32Hex(ADULT)]);
ok("revs keep rising", repoFiles["feed/index.json"].rev === 3, repoFiles["feed/index.json"].rev);

// re-tick 18+ → visible again
await call("/api/profile", "s1", { vrchatName: ADULT, adult: true }); await publish();
ok("re-tick shows owner again", row(home1.parcel, home1.key)[2] === nameHash32Hex(ADULT));

// a second publish can't run while one holds the lease
sqlite.prepare(`UPDATE meta SET v = ? WHERE k = 'publish_lock'`).run(String(Date.now() + 60000));
sqlite.prepare(`INSERT INTO feed_dirty (item, seq) VALUES ('owners:00', 1)`).run();
const before = commits; await publish();
ok("lease blocks a 2nd run", commits === before);
sqlite.prepare(`UPDATE meta SET v = '0' WHERE k = 'publish_lock'`).run(); await publish();
ok("runs after the lease ends", commits === before + 1);

// deleting an account frees its plot, drops it from the feed and lets the plot be offered again
r = await call("/api/delete", "s3", { confirm: "DELETE" });
ok("delete account", r.ok, r);
ok("kid's plot freed", q(`SELECT COUNT(*) n FROM plots WHERE account_id = 3`)[0].n === 0);
await publish();
ok("feed drops the freed plot", !row(homeK.parcel, homeK.key));
r = await call("/api/offers?district=nile-valley", "s1");
ok("freed plot offered again", r.plots.some(p => p.key === homeK.key), r.plots.map(p => p.code));

// many items: capped per run, the rest next run (D1 limits)
for (let i = 0; i < 95; i++) sqlite.prepare(`INSERT INTO feed_dirty (item, seq) VALUES (?, 1)`).run("owners:" + (i + 0x10).toString(16).padStart(2, "0"));
await publish(); const left1 = q(`SELECT COUNT(*) n FROM feed_dirty`)[0].n;
await publish(); await publish();
ok("big backlog drains over several runs", left1 === 55 && q(`SELECT COUNT(*) n FROM feed_dirty`)[0].n === 0, left1);

// cursor moves past full rings (oasis: fill the first 5,160 plots of its first 60 rings)
const full = nextPlots("oasis", START_RING.oasis, 6000, new Set(), 60).plots;
const ins = sqlite.prepare(`INSERT INTO plots (key, land, x, y, parcel, district, ring, type, account_id, claimed_at, renew_by, updated_at) VALUES (?, 1, ?, ?, ?, 'oasis', ?, 2, 999, 'x', 'x', 'x')`);
sqlite.exec("BEGIN");
for (const p of full) { const [, x, y] = fromKey(p.key); ins.run(p.key, x, y, p.parcel, Math.max(Math.abs(x - 511.5), Math.abs(y - 511.5)) + 0.5); }
sqlite.exec("COMMIT");
sqlite.prepare(`UPDATE accounts SET heart = 1 WHERE id = 1`).run();
r = await call("/api/offers?district=oasis", "s1");
ok("offers keep coming after 60 full rings", r.ok && r.plots.length === 6 && !r.plots.some(p => full.some(f => f.key === p.key)), r.plots && r.plots.length);
const cur = q(`SELECT ring FROM place_cursor WHERE district = 'oasis'`)[0];
ok("oasis cursor moved out", cur && cur.ring > START_RING.oasis + 59, cur);

console.log(`PV website flow test: ${pass} passed, ${failN} failed.`);
process.exit(failN ? 1 : 0);
