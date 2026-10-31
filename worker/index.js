// Prospect Valley – the Realm API (Cloudflare Worker). Static pages come from ./site; this Worker answers /auth/* and /api/*.
// Stage 2a: Sign in with Discord (Google next), the account (VRChat display name + 18+ tick), "check my claim code",
// download / delete my data. Stage 2b: free Homestead claims (claims.js) and the hourly feed publisher (publisher.js).
// Secrets (Cloudflare → Settings → Variables and Secrets): DISCORD_CLIENT_SECRET, SALT_HC. Vars (wrangler.jsonc): DISCORD_CLIENT_ID.
// Database: D1 binding DB (tables are created on first use).

import { decodeClaim, nameHash32Hex } from "./lib/codes.js";
import { CLAIM_TABLES, offers, claim, homesteadOf, forgetPlots, districtsForHeart } from "./claims.js";
import { publish } from "./publisher.js";

const SESSION_COOKIE = "__Host-pv_session";
const STATE_COOKIE = "__Host-pv_oauth";
const SESSION_DAYS = 30;
const CODE_TRIES_PER_HOUR = 20;

export default {
  async scheduled(event, env, ctx) {
    await ensureSchema(env);
    try { console.log("PV publish", JSON.stringify(await publish(env, "hourly"))); }
    catch (e) { console.log("PV publish failed", e && e.message); }
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/auth/") || url.pathname.startsWith("/api/")) {
        await ensureSchema(env);
        return await route(request, env, url);
      }
      return env.ASSETS.fetch(request);
    } catch (e) {
      console.log("PV error", url.pathname, e && e.stack || e);
      return json({ ok: false, message: "Something went wrong on our side. Please try again in a moment." }, 500);
    }
  },
};

async function route(request, env, url) {
  const p = url.pathname, m = request.method;
  if (p === "/auth/discord/login" && m === "GET") return discordLogin(request, env, url);
  if (p === "/auth/discord/callback" && m === "GET") return discordCallback(request, env, url);
  if (p === "/auth/logout" && m === "POST") return logout(request, env);

  // everything below changes or reads an account: same-origin JSON requests only
  if (m !== "GET" && !sameOrigin(request, url)) return json({ ok: false, message: "Request refused." }, 403);
  const acct = await currentAccount(request, env);
  if (p === "/api/me" && m === "GET") {
    if (!acct) return json({ ok: true, signedIn: false, account: null, claimsOpen: env.CLAIMS_OPEN === "true" });
    const districts = acct.heart === null || acct.heart === undefined ? [] : districtsForHeart(acct.heart);
    return json({ ok: true, signedIn: true, account: publicAccount(acct), claimsOpen: env.CLAIMS_OPEN === "true",
                  homestead: await homesteadOf(env, acct.id), districts });
  }
  if (!acct) return json({ ok: false, message: "Please sign in first." }, 401);
  if (p === "/api/profile" && m === "POST") return saveProfile(request, env, acct);
  if (p === "/api/check-code" && m === "POST") return checkCode(request, env, acct);
  if (p === "/api/offers" && m === "GET") {
    const d = url.searchParams.get("district");
    const allowed = acct.heart === null || acct.heart === undefined ? [] : districtsForHeart(acct.heart);
    if (!allowed.includes(d)) return json({ ok: false, message: "Check your claim code first – your heart's answer decides your district." }, 400);
    return json({ ok: true, district: d, plots: await offers(env, d) });
  }
  if (p === "/api/claim" && m === "POST") { const r = await claim(env, acct, await readJson(request)); return json(r, r.status || 200); }
  if (p === "/api/export" && m === "GET") return exportData(env, acct);
  if (p === "/api/delete" && m === "POST") return deleteAccount(request, env, acct);
  return json({ ok: false, message: "Not found." }, 404);
}

// ---------------------------------------------------------------- database

let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch(CLAIM_TABLES.map(sql => env.DB.prepare(sql)));
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, email TEXT,
      vrchat_name TEXT, name_verified INTEGER NOT NULL DEFAULT 0, adult INTEGER NOT NULL DEFAULT 0,
      origin INTEGER, calling INTEGER, heart INTEGER,
      code_tries INTEGER NOT NULL DEFAULT 0, code_tries_since TEXT)`),
    env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS accounts_verified_name ON accounts(vrchat_name) WHERE name_verified = 1`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS identities (
      provider TEXT NOT NULL, provider_id TEXT NOT NULL, account_id INTEGER NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY (provider, provider_id))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)`),
  ]);
  schemaReady = true;
}

const now = () => new Date().toISOString();

async function currentAccount(request, env) {
  const tok = cookie(request, SESSION_COOKIE);
  if (!tok) return null;
  const row = await env.DB.prepare(
    `SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires_at > ?`)
    .bind(await sha256(tok), now()).first();
  return row || null;
}

function publicAccount(a) {
  return {
    vrchatName: a.vrchat_name || "", nameVerified: !!a.name_verified, adult: !!a.adult,
    email: a.email || "", origin: a.origin, calling: a.calling, heart: a.heart, since: a.created_at.slice(0, 10),
  };
}

// ---------------------------------------------------------------- Discord sign-in

function discordLogin(request, env, url) {
  if (!env.DISCORD_CLIENT_ID) return text("Discord sign-in isn't set up yet.", 503);
  const state = randomToken(24);
  const q = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID, response_type: "code", scope: "identify email",
    redirect_uri: url.origin + "/auth/discord/callback", state,
  });
  return new Response(null, {
    status: 302,
    headers: { Location: "https://discord.com/oauth2/authorize?" + q, "Set-Cookie": setCookie(STATE_COOKIE, state, 600) },
  });
}

async function discordCallback(request, env, url) {
  const state = url.searchParams.get("state"), code = url.searchParams.get("code");
  const expected = cookie(request, STATE_COOKIE);
  if (url.searchParams.get("error")) return redirect("/account.html?error=signin&why=" + encodeURIComponent(url.searchParams.get("error").slice(0, 40)));
  if (!code || !state) return redirect("/account.html?error=signin&why=nocode");
  if (!expected || state !== expected) return redirect("/account.html?error=signin&why=state");
  if (!env.DISCORD_CLIENT_SECRET) return redirect("/account.html?error=signin&why=nosecret");
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: "authorization_code",
      code, redirect_uri: url.origin + "/auth/discord/callback",
    }),
  });
  if (!tokenRes.ok) {
    console.log("PV discord token", tokenRes.status, (await tokenRes.text()).slice(0, 200));
    return redirect("/account.html?error=signin&why=token" + tokenRes.status);
  }
  const tok = await tokenRes.json();
  const meRes = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: "Bearer " + tok.access_token } });
  if (!meRes.ok) return redirect("/account.html?error=signin&why=me" + meRes.status);
  const me = await meRes.json();
  const email = me.verified && me.email ? String(me.email).slice(0, 200) : null;
  return signIn(env, "discord", String(me.id), email);
}

async function signIn(env, provider, providerId, email) {
  let ident = await env.DB.prepare(`SELECT account_id FROM identities WHERE provider = ? AND provider_id = ?`).bind(provider, providerId).first();
  let accountId;
  if (ident) {
    accountId = ident.account_id;
    if (email) await env.DB.prepare(`UPDATE accounts SET email = ? WHERE id = ?`).bind(email, accountId).run();
  } else {
    const r = await env.DB.prepare(`INSERT INTO accounts (created_at, email) VALUES (?, ?)`).bind(now(), email).run();
    accountId = r.meta.last_row_id;
    await env.DB.prepare(`INSERT INTO identities (provider, provider_id, account_id, created_at) VALUES (?, ?, ?, ?)`)
      .bind(provider, providerId, accountId, now()).run();
  }
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.DB.prepare(`INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)`)
    .bind(await sha256(token), accountId, now(), expires).run();
  await env.DB.prepare(`DELETE FROM sessions WHERE expires_at < ?`).bind(now()).run();
  const h = new Headers({ Location: "/account.html" });
  h.append("Set-Cookie", setCookie(SESSION_COOKIE, token, SESSION_DAYS * 86400));
  h.append("Set-Cookie", setCookie(STATE_COOKIE, "", 0));
  return new Response(null, { status: 302, headers: h });
}

async function logout(request, env) {
  const tok = cookie(request, SESSION_COOKIE);
  if (tok) await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(await sha256(tok)).run();
  return new Response(null, { status: 303, headers: { Location: "/account.html", "Set-Cookie": setCookie(SESSION_COOKIE, "", 0) } });
}

// ---------------------------------------------------------------- account

async function saveProfile(request, env, acct) {
  const body = await readJson(request);
  if (!body) return json({ ok: false, message: "Request refused." }, 400);
  let name = typeof body.vrchatName === "string" ? body.vrchatName.trim() : acct.vrchat_name || "";
  if (name.length > 32 || /[\u0000-\u001f<>]/.test(name)) return json({ ok: false, message: "That display name isn't valid." }, 400);
  const adult = body.adult === true ? 1 : 0;
  const nameChanged = name !== (acct.vrchat_name || "");
  if ((nameChanged || adult !== acct.adult) && await homesteadOf(env, acct.id)) {
    // what the public feed shows depends on the name and the 18+ tick: republish this owner's parcel and owner buckets
    const rows = (await env.DB.prepare(`SELECT parcel FROM plots WHERE account_id = ?`).bind(acct.id).all()).results;
    const items = rows.map(r => "parcel:giz:" + r.parcel);
    if (acct.vrchat_name) items.push("owners:" + nameHash32Hex(acct.vrchat_name).slice(0, 2));
    if (name) items.push("owners:" + nameHash32Hex(name).slice(0, 2));
    await env.DB.batch(items.map(i => env.DB.prepare(`INSERT OR IGNORE INTO dirty (item) VALUES (?)`).bind(i)));
  }
  await env.DB.prepare(`UPDATE accounts SET vrchat_name = ?, adult = ?, name_verified = CASE WHEN ? THEN 0 ELSE name_verified END WHERE id = ?`)
    .bind(name || null, adult, nameChanged ? 1 : 0, acct.id).run();
  return json({ ok: true, message: "Saved." });
}

async function checkCode(request, env, acct) {
  if (!env.SALT_HC) return json({ ok: false, message: "Code checking isn't switched on yet." }, 503);
  if (!acct.vrchat_name) return json({ ok: false, message: "Add your VRChat display name first." }, 400);
  // limit tries per hour (codes can't be guessed in practice, but nobody should be able to try)
  const since = acct.code_tries_since && Date.now() - Date.parse(acct.code_tries_since) < 3600000 ? acct.code_tries_since : now();
  const tries = since === acct.code_tries_since ? acct.code_tries : 0;
  if (tries >= CODE_TRIES_PER_HOUR) return json({ ok: false, message: "Too many tries – please wait an hour and try again." }, 429);
  await env.DB.prepare(`UPDATE accounts SET code_tries = ?, code_tries_since = ? WHERE id = ?`).bind(tries + 1, since, acct.id).run();

  const body = await readJson(request);
  const r = decodeClaim(body && body.code, acct.vrchat_name, env.SALT_HC);
  if (!r.ok) return json({ ok: false, message: r.message });
  // the code proves the name: lock it to this account (unless another account already proved it)
  const taken = await env.DB.prepare(`SELECT id FROM accounts WHERE vrchat_name = ? AND name_verified = 1 AND id != ?`).bind(acct.vrchat_name, acct.id).first();
  if (taken) return json({ ok: false, message: "That display name is already linked to another account. Write to Info@ProspectValleyVR.com and we'll sort it out." }, 409);
  await env.DB.prepare(`UPDATE accounts SET name_verified = 1, origin = ?, calling = ?, heart = ? WHERE id = ?`)
    .bind(r.origin, r.calling, r.heart, acct.id).run();
  return json({
    ok: true, kind: r.kind, origin: r.originName, calling: r.callingName, heart: r.heart, made: r.made,
    claimsOpen: env.CLAIMS_OPEN === "true",
    message: env.CLAIMS_OPEN === "true" ? "Your code is good." : "Your code is good. Homestead claims open with the Land Rush – bring a fresh code then.",
  });
}

async function exportData(env, acct) {
  const ids = await env.DB.prepare(`SELECT provider, created_at FROM identities WHERE account_id = ?`).bind(acct.id).all();
  const data = { account: publicAccount(acct), signInMethods: ids.results, exported: now() };
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="prospect-valley-my-data.json"', "Cache-Control": "no-store" },
  });
}

async function deleteAccount(request, env, acct) {
  const body = await readJson(request);
  if (!body || body.confirm !== "DELETE") return json({ ok: false, message: "Type DELETE to confirm." }, 400);
  await forgetPlots(env, acct);   // their Homestead returns to the Crown; the next publish removes it from the feed
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM sessions WHERE account_id = ?`).bind(acct.id),
    env.DB.prepare(`DELETE FROM identities WHERE account_id = ?`).bind(acct.id),
    env.DB.prepare(`DELETE FROM accounts WHERE id = ?`).bind(acct.id),
  ]);
  return new Response(JSON.stringify({ ok: true, message: "Your account and its data are deleted." }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": setCookie(SESSION_COOKIE, "", 0) },
  });
}

// ---------------------------------------------------------------- helpers

function sameOrigin(request, url) {
  const o = request.headers.get("Origin");
  return o === url.origin && (request.headers.get("Content-Type") || "").startsWith("application/json");
}

async function readJson(request) {
  try { const t = await request.text(); if (t.length > 4000) return null; return JSON.parse(t); } catch { return null; }
}

function cookie(request, name) {
  const h = request.headers.get("Cookie") || "";
  for (const part of h.split(/;\s*/)) { const i = part.indexOf("="); if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1)); }
  return null;
}

function setCookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function randomToken(bytes) {
  const b = new Uint8Array(bytes); crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join("");
}

const redirect = (to) => new Response(null, { status: 302, headers: { Location: to } });
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const text = (t, status = 200) => new Response(t, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
