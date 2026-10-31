// Prospect Valley – free Homestead claims (PV_Website_Plan.md § 4, Realm Charter 7.5, PV_Land_Rush_and_Discovery.md).
// While only Giza is open every Homestead goes to Giza: desert hearts → West or East Desert, river / garden hearts →
// Nile Valley or the oasis, all others → Nile Valley (plus one free move to their heart's Land when it opens).
// Plots are offered in a fixed public order (giza.js nextPlots); the player sees each plot's deposit and feature
// BEFORE choosing; the first completed claim of a plot wins it (a UNIQUE key in the database). No draw, no fee.

import { decodeClaim, nameHash32Hex } from "./lib/codes.js";
import { nextPlots, districtsForHeart, START_RING, fromKey, gizaDistrict, describeGizaPlot } from "./lib/giza.js";

const OFFERS = 6;            // plots shown to a player at once
const CLAIM_WINDOW = 30;     // a claim must be one of the next 30 free plots of its district (keeps the order fair)
const RING_SPAN = 60;

export const CLAIM_TABLES = [
  `CREATE TABLE IF NOT EXISTS plots (
     key INTEGER PRIMARY KEY, land INTEGER NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL, parcel TEXT NOT NULL,
     district TEXT NOT NULL, ring INTEGER NOT NULL, type INTEGER NOT NULL, account_id INTEGER NOT NULL,
     claimed_at TEXT NOT NULL, renew_by TEXT NOT NULL, free_move INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS plots_account ON plots(account_id)`,
  `CREATE INDEX IF NOT EXISTS plots_district_ring ON plots(district, ring)`,
  `CREATE TABLE IF NOT EXISTS used_codes (code_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL, used_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS cursors (district TEXT PRIMARY KEY, ring INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS dirty (item TEXT PRIMARY KEY)`,
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
];

const ringOf = (x, y) => Math.max(Math.abs(x - 511.5), Math.abs(y - 511.5)) + 0.5;
const nowIso = () => new Date().toISOString();

async function cursor(env, district) {
  const r = await env.DB.prepare(`SELECT ring FROM cursors WHERE district = ?`).bind(district).first();
  return r ? r.ring : START_RING[district];
}

async function takenNear(env, district, fromRing) {
  const rows = await env.DB.prepare(`SELECT key FROM plots WHERE district = ? AND ring >= ? AND ring < ?`)
    .bind(district, fromRing, fromRing + RING_SPAN).all();
  return new Set(rows.results.map(r => r.key));
}

/** The next free plots of a district, in placement order. */
export async function offers(env, district, count = OFFERS) {
  if (!(district in START_RING)) return [];
  const from = await cursor(env, district);
  const res = nextPlots(district, from, count, await takenNear(env, district, from), RING_SPAN);
  if (res.firstRing > from) await env.DB.prepare(`INSERT INTO cursors (district, ring) VALUES (?, ?) ON CONFLICT(district) DO UPDATE SET ring = excluded.ring`).bind(district, res.firstRing).run();
  return res.plots;
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

/** POST /api/claim { code, key } */
export async function claim(env, acct, body) {
  if (env.CLAIMS_OPEN !== "true") return { status: 403, ok: false, message: "Homestead claims open with the Land Rush." };
  if (!acct.vrchat_name) return { status: 400, ok: false, message: "Add your VRChat display name first." };
  if (await homesteadOf(env, acct.id)) return { status: 409, ok: false, message: "You already have a Homestead – one per player." };
  const code = String(body && body.code || "");
  const r = decodeClaim(code, acct.vrchat_name, env.SALT_HC);
  if (!r.ok) return { status: 400, ok: false, message: r.message };
  if (r.kind !== "claim") return { status: 400, ok: false, message: "That's a renewal code. Make a claim code at the Scroll Desk." };
  const codeHash = await sha256(code.toUpperCase().replace(/[^0-9A-Z]/g, ""));
  if (await env.DB.prepare(`SELECT 1 FROM used_codes WHERE code_hash = ?`).bind(codeHash).first())
    return { status: 409, ok: false, message: "That code has already been used. Make a fresh one at the Scroll Desk." };

  const key = Number(body && body.key);
  if (!Number.isInteger(key) || key < 0) return { status: 400, ok: false, message: "Choose a plot from the list." };
  const [land, x, y] = fromKey(key);
  const district = land === 1 ? gizaDistrict(x, y) : null;
  if (!district || !districtsForHeart(r.heart).includes(district))
    return { status: 400, ok: false, message: "That plot isn't in one of your districts." };
  const window = await offers(env, district, CLAIM_WINDOW);
  if (!window.some(p => p.key === key)) return { status: 409, ok: false, message: "That plot has just been taken – here are the next ones." };

  const p = describeGizaPlot(x, y);
  const renewBy = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO plots (key, land, x, y, parcel, district, ring, type, account_id, claimed_at, renew_by, free_move, updated_at)
                      VALUES (?, 1, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1, ?)`)
        .bind(key, x, y, p.parcel, district, ringOf(x, y), acct.id, nowIso(), renewBy, nowIso()),
      env.DB.prepare(`INSERT INTO used_codes (code_hash, account_id, used_at) VALUES (?, ?, ?)`).bind(codeHash, acct.id, nowIso()),
      env.DB.prepare(`INSERT OR IGNORE INTO dirty (item) VALUES (?)`).bind("parcel:giz:" + p.parcel),
      env.DB.prepare(`INSERT OR IGNORE INTO dirty (item) VALUES (?)`).bind("owners:" + nameHash32Hex(acct.vrchat_name).slice(0, 2)),
    ]);
  } catch (e) {
    return { status: 409, ok: false, message: "That plot has just been taken – here are the next ones." };
  }
  return { status: 200, ok: true, homestead: await homesteadOf(env, acct.id),
           message: "Your Homestead is yours. It appears in the worlds within the hour – use Find my home on the World Overlook." };
}

/** Marks everything an account owned as changed (before the account is deleted). */
export async function forgetPlots(env, acct) {
  const rows = await env.DB.prepare(`SELECT parcel, land FROM plots WHERE account_id = ?`).bind(acct.id).all();
  const stmts = rows.results.map(r => env.DB.prepare(`INSERT OR IGNORE INTO dirty (item) VALUES (?)`).bind("parcel:giz:" + r.parcel));
  if (acct.vrchat_name) stmts.push(env.DB.prepare(`INSERT OR IGNORE INTO dirty (item) VALUES (?)`).bind("owners:" + nameHash32Hex(acct.vrchat_name).slice(0, 2)));
  stmts.push(env.DB.prepare(`DELETE FROM plots WHERE account_id = ?`).bind(acct.id));
  await env.DB.batch(stmts);
}

export { districtsForHeart };
