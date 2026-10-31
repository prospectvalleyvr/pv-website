// Prospect Valley – free Homestead claims (PV_Website_Plan.md § 4, Realm Charter 7.5, PV_Land_Rush_and_Discovery.md).
// While only Giza is open every Homestead goes to Giza: desert hearts → West or East Desert, river / garden hearts →
// Nile Valley or the oasis, all others → Nile Valley (plus one free move to their heart's Land when it opens).
// Plots are offered in a fixed public order (giza.js nextPlots); the player sees each plot's deposit and feature
// BEFORE choosing; the first completed claim of a plot wins it. No draw, no fee.
// Guarantees kept by the DATABASE (not only by checks in code – reviewed Oct 31):
//   · a plot has one owner (plots.key PRIMARY KEY); one Homestead per account (unique index plots_one_homestead);
//   · a claim code works once (used_codes keyed on the code's single canonical spelling);
//   · one verified account per VRChat name (accounts_verified_name, index.js) – a claim verifies the name.

import { decodeClaim, nameHash32Hex } from "./lib/codes.js";
import { nextPlots, districtsForHeart, START_RING, fromKey, gizaDistrict, describeGizaPlot, GC } from "./lib/giza.js";

const OFFERS = 6;            // plots shown to a player at once
const CLAIM_WINDOW = 30;     // a claim must be one of the next 30 free plots of its district (keeps the order fair)
const RING_SPAN = 60;        // rings looked at per pass
export const CODE_TRIES_PER_HOUR = 20;   // shared by "check my code" and claims

export const CLAIM_TABLES = [
  `CREATE TABLE IF NOT EXISTS plots (
     key INTEGER PRIMARY KEY, land INTEGER NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL, parcel TEXT NOT NULL,
     district TEXT NOT NULL, ring INTEGER NOT NULL, type INTEGER NOT NULL, account_id INTEGER NOT NULL,
     claimed_at TEXT NOT NULL, renew_by TEXT NOT NULL, free_move INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS plots_account ON plots(account_id)`,
  `CREATE INDEX IF NOT EXISTS plots_district_ring ON plots(district, ring)`,
  `CREATE INDEX IF NOT EXISTS plots_parcel ON plots(land, parcel)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS plots_one_homestead ON plots(account_id) WHERE type = 1`,
  `CREATE TABLE IF NOT EXISTS used_codes (code_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL, used_at TEXT NOT NULL)`,
  // place_cursor: first ring of each district that may still hold a free plot. ver goes up whenever a plot is freed,
  // so moving the cursor forward is a compare-and-set that can never skip a plot freed at the same moment.
  `CREATE TABLE IF NOT EXISTS place_cursor (district TEXT PRIMARY KEY, ring INTEGER NOT NULL, ver INTEGER NOT NULL)`,
  // feed_dirty: what the publisher must rewrite. seq goes up on every change, so a change made while a publish is
  // running is never lost (the publisher only removes the exact seq it published).
  `CREATE TABLE IF NOT EXISTS feed_dirty (item TEXT PRIMARY KEY, seq INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS admin_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, account_id INTEGER NOT NULL, action TEXT NOT NULL, detail TEXT)`,
  `CREATE TABLE IF NOT EXISTS dirty (item TEXT PRIMARY KEY)`,   // first version of the list: moved across, then emptied
  `INSERT INTO feed_dirty (item, seq) SELECT item, 1 FROM dirty WHERE true ON CONFLICT(item) DO UPDATE SET seq = feed_dirty.seq + 1`,
  `DELETE FROM dirty`,
];

// ---------------------------------------------------------------- Land Rush settings (admin page; stored in meta)
// claims_mode: "closed" (default) | "open" | "auto" (opens by itself at the `opens` time). opens: "YYYY-MM-DDTHH:MM:SSZ" or none.
export const OPENS_RE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
export function claimsOpenFrom(meta, nowMs = Date.now()) {
  const mode = meta.claims_mode || "closed";
  if (mode === "open") return true;
  if (mode === "auto" && meta.opens && OPENS_RE.test(meta.opens)) return nowMs >= Date.parse(meta.opens);
  return false;
}
export async function readMeta(env) {
  return Object.fromEntries((await env.DB.prepare(`SELECT k, v FROM meta`).all()).results.map(r => [r.k, r.v]));
}
export async function claimsOpen(env) { return claimsOpenFrom(await readMeta(env)); }

/** Statement: mark a feed item (e.g. "parcel:giz:E5", "owners:3f") as changed. */
export const markDirty = (env, item) =>
  env.DB.prepare(`INSERT INTO feed_dirty (item, seq) VALUES (?, 1) ON CONFLICT(item) DO UPDATE SET seq = feed_dirty.seq + 1`).bind(item);

const ringOf = (x, y) => Math.max(Math.abs(x - 511.5), Math.abs(y - 511.5)) + 0.5;
const nowIso = () => new Date().toISOString();

/** Fills accounts.name_bucket (first 2 hex of the owner hash) where it is missing. Used by the schema check and the publisher. */
export async function fillNameBuckets(env) {
  const old = (await env.DB.prepare(`SELECT id, vrchat_name FROM accounts WHERE vrchat_name IS NOT NULL AND name_bucket IS NULL LIMIT 200`).all()).results;
  if (old.length) await env.DB.batch(old.map(r => env.DB.prepare(`UPDATE accounts SET name_bucket = ? WHERE id = ? AND vrchat_name = ?`)
    .bind(nameHash32Hex(r.vrchat_name).slice(0, 2), r.id, r.vrchat_name)));
}

/** Counts one code try for an account (atomic). false = over the hourly limit. */
export async function takeCodeTry(env, accountId) {
  const hourAgo = new Date(Date.now() - 3600000).toISOString(), t = nowIso();
  const r = await env.DB.prepare(
    `UPDATE accounts SET
       code_tries = CASE WHEN code_tries_since IS NULL OR code_tries_since < ? THEN 1 ELSE code_tries + 1 END,
       code_tries_since = CASE WHEN code_tries_since IS NULL OR code_tries_since < ? THEN ? ELSE code_tries_since END
     WHERE id = ? RETURNING code_tries`).bind(hourAgo, hourAgo, t, accountId).first();
  return !!r && r.code_tries <= CODE_TRIES_PER_HOUR;
}

async function cursor(env, district) {
  const r = await env.DB.prepare(`SELECT ring, ver FROM place_cursor WHERE district = ?`).bind(district).first();
  return r ? { ring: r.ring, ver: r.ver, row: true } : { ring: START_RING[district], ver: 0, row: false };
}

async function takenNear(env, district, fromRing) {
  const rows = await env.DB.prepare(`SELECT key FROM plots WHERE district = ? AND ring >= ? AND ring < ?`)
    .bind(district, fromRing, fromRing + RING_SPAN).all();
  return new Set(rows.results.map(r => r.key));
}

/** The next free plots of a district, in placement order. Moves the district's cursor past rings that are full. */
export async function offers(env, district, count = OFFERS) {
  if (!(district in START_RING)) return [];
  const cur = await cursor(env, district);
  let from = cur.ring, res = null;
  for (let pass = 0; pass < 4 && from <= GC; pass++) {
    res = nextPlots(district, from, count, await takenNear(env, district, from), RING_SPAN);
    if (res.plots.length) break;
    from = res.scannedTo;              // every plot in these rings is taken: look further out
  }
  const newRing = res && res.firstFree >= 0 ? res.firstFree : from;
  if (newRing > cur.ring) {
    if (!cur.row) await env.DB.prepare(`INSERT OR IGNORE INTO place_cursor (district, ring, ver) VALUES (?, ?, 0)`).bind(district, newRing).run();
    else await env.DB.prepare(`UPDATE place_cursor SET ring = ? WHERE district = ? AND ver = ? AND ring < ?`).bind(newRing, district, cur.ver, newRing).run();
  }
  return res ? res.plots : [];
}

export async function homesteadOf(env, accountId) {
  const r = await env.DB.prepare(`SELECT key, renew_by, free_move FROM plots WHERE account_id = ? AND type = 1`).bind(accountId).first();
  if (!r) return null;
  const [, x, y] = fromKey(r.key);
  return { ...describeGizaPlot(x, y), renewBy: r.renew_by, freeMove: !!r.free_move };
}

async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join("");
}

const TAKEN = { status: 409, ok: false, message: "That plot has just been taken – here are the next ones." };

/** POST /api/claim { code, key } */
export async function claim(env, acct, body) {
  if (!(await claimsOpen(env))) return { status: 403, ok: false, message: "Homestead claims open with the Land Rush." };
  if (!env.SALT_HC) return { status: 503, ok: false, message: "Code checking isn't switched on yet." };
  if (!acct.vrchat_name) return { status: 400, ok: false, message: "Add your VRChat display name first." };
  if (await homesteadOf(env, acct.id)) return { status: 409, ok: false, message: "You already have a Homestead – one per player." };
  if (!(await takeCodeTry(env, acct.id))) return { status: 429, ok: false, message: "Too many tries – please wait an hour and try again." };
  const r = decodeClaim(String(body && body.code || ""), acct.vrchat_name, env.SALT_HC);
  if (!r.ok) return { status: 400, ok: false, message: r.message };
  if (r.kind !== "claim") return { status: 400, ok: false, message: "That's a renewal code. Make a claim code at the Scroll Desk." };
  const codeHash = await sha256("HC|" + r.canon);
  if (await env.DB.prepare(`SELECT 1 FROM used_codes WHERE code_hash = ?`).bind(codeHash).first())
    return { status: 409, ok: false, message: "That code has already been used. Make a fresh one at the Scroll Desk." };
  if (await env.DB.prepare(`SELECT 1 FROM accounts WHERE vrchat_name = ? AND name_verified = 1 AND id != ?`).bind(acct.vrchat_name, acct.id).first())
    return { status: 409, ok: false, message: "That display name is already linked to another account. Write to Info@ProspectValleyVR.com and we'll sort it out." };

  const key = Number(body && body.key);
  if (!Number.isInteger(key) || key < 0) return { status: 400, ok: false, message: "Choose a plot from the list." };
  const [land, x, y] = fromKey(key);
  const district = land === 1 ? gizaDistrict(x, y) : null;
  if (!district || !districtsForHeart(r.heart).includes(district))
    return { status: 400, ok: false, message: "That plot isn't in one of your districts." };
  const window = await offers(env, district, CLAIM_WINDOW);
  if (!window.some(p => p.key === key)) return TAKEN;

  const p = describeGizaPlot(x, y), t = nowIso();
  const renewBy = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  try {
    // one transaction: the plot, the used code, the verified name and the feed marks all happen, or none do
    await env.DB.batch([
      env.DB.prepare(`UPDATE accounts SET name_verified = 1, name_bucket = ?, origin = ?, calling = ?, heart = ? WHERE id = ?`)
        .bind(nameHash32Hex(acct.vrchat_name).slice(0, 2), r.origin, r.calling, r.heart, acct.id),
      env.DB.prepare(`INSERT INTO plots (key, land, x, y, parcel, district, ring, type, account_id, claimed_at, renew_by, free_move, updated_at)
                      SELECT ?, 1, ?, ?, ?, ?, ?, 1, id, ?, ?, 1, ? FROM accounts WHERE id = ?`)
        .bind(key, x, y, p.parcel, district, ringOf(x, y), t, renewBy, t, acct.id),
      env.DB.prepare(`INSERT INTO used_codes (code_hash, account_id, used_at) VALUES (?, ?, ?)`).bind(codeHash, acct.id, t),
      markDirty(env, "parcel:giz:" + p.parcel),
      markDirty(env, "owners:" + nameHash32Hex(acct.vrchat_name).slice(0, 2)),
    ]);
  } catch (e) {
    const m = String(e && e.message || e);
    if (m.includes("used_codes")) return { status: 409, ok: false, message: "That code has already been used. Make a fresh one at the Scroll Desk." };
    if (m.includes("accounts")) return { status: 409, ok: false, message: "That display name is already linked to another account. Write to Info@ProspectValleyVR.com and we'll sort it out." };
    if (m.includes("plots.account_id") || m.includes("plots_one_homestead")) return { status: 409, ok: false, message: "You already have a Homestead – one per player." };
    return TAKEN;
  }
  const home = await homesteadOf(env, acct.id);
  if (!home) return { status: 409, ok: false, message: "Your account was closed while claiming – nothing was claimed." };
  return { status: 200, ok: true, homestead: home,
           message: "Your Homestead is yours. It appears in the worlds within the hour – use Find my home on the World Overlook." };
}

/** Statements that release everything an account owns and mark the feed (run them in the account-deletion batch). */
export async function forgetPlotsStatements(env, acct) {
  const rows = (await env.DB.prepare(`SELECT parcel, district, ring FROM plots WHERE account_id = ?`).bind(acct.id).all()).results;
  const stmts = rows.map(r => markDirty(env, "parcel:giz:" + r.parcel));
  // the freed plot may be the nearest free one again: move the district's cursor back to its ring and bump ver
  // (a missing row means "still at the first ring" – written explicitly so an offer running now can't jump past it)
  for (const r of rows) stmts.push(env.DB.prepare(
    `INSERT INTO place_cursor (district, ring, ver) VALUES (?, ?, 1)
     ON CONFLICT(district) DO UPDATE SET ring = MIN(place_cursor.ring, ?), ver = place_cursor.ver + 1`)
    .bind(r.district, START_RING[r.district], r.ring));
  if (acct.vrchat_name) stmts.push(markDirty(env, "owners:" + nameHash32Hex(acct.vrchat_name).slice(0, 2)));
  stmts.push(env.DB.prepare(`DELETE FROM plots WHERE account_id = ?`).bind(acct.id));
  return stmts;
}

export { districtsForHeart };
