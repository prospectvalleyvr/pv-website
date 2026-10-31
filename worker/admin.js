// Prospect Valley – the owner's admin page API (/api/admin/*). Only accounts whose sign-in is listed in the ADMINS var
// (wrangler.jsonc, e.g. "discord:123456789") may use it. Everything an admin changes is written to admin_log.
// What it does: Land Rush opening time, claims closed / open / opening by themselves at that time, publish the feed now,
// and counts. It never shows player names, emails or codes.

import { readMeta, claimsOpenFrom, OPENS_RE, isAdmin, signInKeys } from "./claims.js";
import { DISTRICT_PLOTS } from "./lib/giza.js";
import { publish } from "./publisher.js";


const log = (env, acct, action, detail) =>
  env.DB.prepare(`INSERT INTO admin_log (at, account_id, action, detail) VALUES (?, ?, ?, ?)`).bind(new Date().toISOString(), acct.id, action, detail || "");

export async function adminRoute(request, env, url, acct, json) {
  const p = url.pathname, m = request.method;
  if (!(await isAdmin(env, acct))) {
    // a signed-in player sees only their own sign-in key (so the owner can send it to Claude to be added)
    if (p === "/api/admin/status" && m === "GET") return json({ ok: true, admin: false, key: (await signInKeys(env, acct))[0] || "" });
    return json({ ok: false, message: "Admins only." }, 403);
  }

  if (p === "/api/admin/status" && m === "GET") {
    const meta = await readMeta(env);
    const q = (sql) => env.DB.prepare(sql);
    const [districts, accounts, dirty, logRows] = await env.DB.batch([
      q(`SELECT district, COUNT(*) n FROM plots WHERE type = 1 GROUP BY district`),
      q(`SELECT COUNT(*) total, SUM(name_verified) verified, SUM(adult) adults FROM accounts`),
      q(`SELECT COUNT(*) n FROM feed_dirty`),
      q(`SELECT at, action, detail FROM admin_log ORDER BY id DESC LIMIT 12`),
    ]);
    const claimed = Object.fromEntries(districts.results.map(r => [r.district, r.n]));
    const a = accounts.results[0] || {};
    return json({
      ok: true, admin: true,
      settings: { claimsMode: meta.claims_mode || "closed", opens: meta.opens || "", claimsOpenNow: claimsOpenFrom(meta) },
      homesteads: Object.keys(DISTRICT_PLOTS).map(d => ({ district: d, claimed: claimed[d] || 0, size: DISTRICT_PLOTS[d] })),
      accounts: { total: a.total || 0, verified: a.verified || 0, adults: a.adults || 0 },
      feed: { enabled: env.PUBLISH_ENABLED === "true", branch: (env.FEED_BRANCH || "main") + " / " + (env.FEED_DIR || "feed"), rev: Number(meta.feed_rev || 0),
              lastPublish: meta.last_publish || "", waiting: dirty.results[0].n, claimsInFeed: meta.claims_state || "" },
      log: logRows.results,
    });
  }

  if (p === "/api/admin/settings" && m === "POST") {
    let body; try { body = JSON.parse(await request.text()); } catch { body = null; }
    if (!body) return json({ ok: false, message: "Request refused." }, 400);
    const mode = body.claimsMode;
    if (!["closed", "admins", "open", "auto"].includes(mode)) return json({ ok: false, message: "Choose closed, admins only, open or open at the time." }, 400);
    const opens = typeof body.opens === "string" ? body.opens : "";
    if (opens && !OPENS_RE.test(opens)) return json({ ok: false, message: "That date and time isn't valid." }, 400);
    if (mode === "auto" && !opens) return json({ ok: false, message: "Set the opening date and time first." }, 400);
    const meta = await readMeta(env);
    const isPublic = (m) => m === "open" || m === "auto";
    if (isPublic(mode) && !isPublic(meta.claims_mode) && body.confirm !== "OPEN")
      return json({ ok: false, message: "Type OPEN in the box to confirm – this lets players claim Homesteads." }, 400);
    const set = (k, v) => env.DB.prepare(`INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`).bind(k, v);
    const stmts = [set("claims_mode", mode), set("index_dirty", "1"), log(env, acct, "settings", `claims ${mode}; opens ${opens || "none"}`)];
    stmts.push(opens ? set("opens", opens) : env.DB.prepare(`DELETE FROM meta WHERE k = 'opens'`));
    await env.DB.batch(stmts);
    return json({ ok: true, message: "Saved. The worlds and the countdown pick this up at the next publish (or press Publish now)." });
  }

  if (p === "/api/admin/publish" && m === "POST") {
    await log(env, acct, "publish now", "").run();
    try {
      const r = await publish(env, "admin");
      if (r.skipped) return json({ ok: true, message: "Nothing published: " + r.skipped + "." });
      if (!r.ok) return json({ ok: false, message: "Publish failed: " + r.error });
      return json({ ok: true, message: `Published feed rev ${r.rev} (${r.files.length} file${r.files.length === 1 ? "" : "s"})` + (r.more ? " – more waiting, press again." : ".") });
    } catch (e) {
      return json({ ok: false, message: "Publish failed: " + String(e && e.message || e).slice(0, 160) });
    }
  }
  return json({ ok: false, message: "Not found." }, 404);
}
