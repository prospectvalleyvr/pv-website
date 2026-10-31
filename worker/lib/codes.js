// Prospect Valley – Homestead claim codes (HC-…), server side. Same maths as pv_realm_tools.py (encode_hc / decode_hc)
// and PV_LandCodes.cs in the worlds. The salt is passed in from Cloudflare Secrets (env.SALT_HC) – never stored in code.

export const ALPH = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const ORIGINS = ["Sandborn", "Lampkeeper", "Grower", "Contender", "Trader", "Wright", "Mariner"];
export const CALLINGS = ["Knight", "Ranger", "Scholar", "Merchant", "Artisan", "Angler", "Tamer", "Bard"];
const FNV0 = -2128831035, FNVP = 16777619;
const EPOCH_MS = Date.UTC(2026, 0, 1);
const DAY_MS = 86400000;
const HC_WIDTHS = [4, 16, 4, 4, 9, 12, 20];   // kind, name hash, origin, calling, answers, day, link

/** UTF-16 code units, as C# strings and the Python tool see them. */
function units(s) { const out = []; for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); return out; }

export function nameHash16(name) {
  let h = FNV0;
  for (const c of units(name)) h = Math.imul(h ^ c, FNVP);
  return (h ^ (h >> 16)) & 0xFFFF;
}

export function nameHash32Hex(name) {
  let h = FNV0;
  for (const c of units(name)) h = Math.imul(h ^ c, FNVP);
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function checkValue(syms, salt, nbits) {
  let h = FNV0;
  const su = units(salt);
  for (const c of su) h = Math.imul(h ^ c, FNVP);
  for (const s of syms) { h = Math.imul(h ^ (s + 1), FNVP); h = h ^ ((h >> 13) & 0x7FFFF); }
  for (let i = 0; i < su.length; i += 3) h = Math.imul(h ^ su[i], FNVP);
  return (h ^ (h >> 11) ^ (h >> 22)) & ((1 << nbits) - 1);
}

export function clean(code) {
  const map = { O: "0", I: "1", L: "1" };
  const out = [];
  for (let ch of code.toUpperCase()) { ch = map[ch] || ch; const i = ALPH.indexOf(ch); if (i >= 0) out.push(i); }
  return out;
}

function unpack(syms, widths) {
  const bits = syms.map(s => s.toString(2).padStart(5, "0")).join("");
  const out = []; let pos = 0;
  for (const n of widths) { out.push(parseInt(bits.slice(pos, pos + n), 2)); pos += n; }
  return out;
}

/** Days since 2026-01-01 (UTC) for a Date. */
export function dayIndex(date) { return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - EPOCH_MS) / DAY_MS); }

/** The 12-bit day in a code → the most recent real date on or before today with that day number. */
function resolveDay(day12, today) {
  const base = dayIndex(today);
  const d = base - (((base - day12) % 4096) + 4096) % 4096;
  return new Date(EPOCH_MS + d * DAY_MS);
}

/**
 * Checks a Homestead claim / renewal code for a display name.
 * Returns { ok: true, kind, origin, originName, calling, callingName, tests:[t1,t2,t3], heart, made:"YYYY-MM-DD", link }
 * or { ok: false, error, message } with a player-friendly message.
 */
export function decodeClaim(code, displayName, salt, today = new Date(), maxAgeDays = 30) {
  if (!salt) throw new Error("SALT_HC missing");
  let s = String(code || "").trim().toUpperCase();
  if (s.startsWith("HC")) s = s.slice(2);
  const syms = clean(s);
  if (syms.length !== 20) return fail("length", "That code is the wrong length – check for a missing or extra character.");
  let chk = 0;
  for (const x of syms.slice(15)) chk = (chk << 5) | x;
  if (chk !== checkValue(syms.slice(0, 15), salt, 25)) return fail("check", "That code doesn't add up – look for a typo.");
  const [kind, nh, origin, calling, answers, day, link] = unpack(syms.slice(0, 15), HC_WIDTHS);
  if (kind !== 1 && kind !== 2) return fail("kind", "That isn't a Homestead claim code.");
  if (nh !== nameHash16(String(displayName || ""))) return fail("name", "The code doesn't match that name – enter your VRChat display name exactly, with capitals and spaces.");
  const made = resolveDay(day, today);
  const age = Math.round((dayIndex(today) - dayIndex(made)));
  if (age > maxAgeDays) return fail("expired", "That code has expired. Make a fresh one at the Scroll Desk – it's free.");
  return {
    ok: true, kind: kind === 1 ? "claim" : "renewal",
    origin, originName: origin < 7 ? ORIGINS[origin] : "none",
    calling, callingName: calling < 8 ? CALLINGS[calling] : "none",
    tests: [answers >> 7, (answers >> 5) & 3, (answers >> 3) & 3], heart: answers & 7,
    made: made.toISOString().slice(0, 10), link,
    canon: syms.map(i => ALPH[i]).join(""),   // one spelling per code (HC- prefix, O/0, I/L/1, extra letters removed)
  };
}

function fail(error, message) { return { ok: false, error, message }; }
