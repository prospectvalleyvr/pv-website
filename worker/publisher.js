// Prospect Valley – the feed publisher (PV_Data_Feed_Spec.md v1.1). Runs on the hourly Cron Trigger (and from the admin
// page later). Writes only what changed – parcel files, owner buckets – plus feed/index.json, as ONE commit to the
// public repo prospectvalleyvr/realm through the GitHub API. Nothing private is published:
//   · owner hash and shown name only for accounts that ticked 18+ (decided Oct 30); others: empty owner, no name;
//   · names are never shown yet (no name opt-in exists) – rows carry "" → worlds show "Private owner".
// Settings: vars PUBLISH_ENABLED ("true" to run), FEED_BRANCH (e.g. "feed-test", then "main"), FEED_REPO;
// secret GITHUB_TOKEN (fine-grained, Contents read/write on realm only).

import { nameHash32Hex } from "./lib/codes.js";
import { COLS } from "./lib/giza.js";

const API = "https://api.github.com";

export async function publish(env, reason = "hourly") {
  if (env.PUBLISH_ENABLED !== "true") return { ok: true, skipped: "publishing is switched off" };
  if (!env.GITHUB_TOKEN) return { ok: false, error: "GITHUB_TOKEN missing" };
  const repo = env.FEED_REPO || "prospectvalleyvr/realm";
  const branch = env.FEED_BRANCH || "feed-test";

  const dirty = (await env.DB.prepare(`SELECT item FROM dirty`).all()).results.map(r => r.item);
  const metaRows = (await env.DB.prepare(`SELECT k, v FROM meta`).all()).results;
  const meta = Object.fromEntries(metaRows.map(r => [r.k, r.v]));
  const claimsState = env.CLAIMS_OPEN === "true" ? "open" : "closed";
  const indexWanted = meta.index_dirty === "1" || !meta.index_rev || meta.claims_state !== claimsState;
  if (!dirty.length && !indexWanted) return { ok: true, skipped: "nothing changed" };

  const files = {};
  const rev = Number(meta.feed_rev || 0) + 1;
  for (const item of dirty) {
    const [kind, a, b] = item.split(":");
    if (kind === "parcel" && a === "giz" && /^[A-HJ-NP-U](1[0-9]|[1-9])$/.test(b)) files[`feed/giz/${b.toLowerCase()}.json`] = await parcelFile(env, b, rev);
    if (kind === "owners" && /^[0-9a-f]{2}$/.test(a)) files[`feed/owners/${a}.json`] = await ownersFile(env, a, rev);
  }
  const index = { format: "pv-feed-1", rev, time: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
                  lands: { giz: { rev, claims: env.CLAIMS_OPEN === "true" ? "open" : "closed" } } };
  if (meta.opens && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(meta.opens)) index.opens = meta.opens;
  files["feed/index.json"] = JSON.stringify(index);

  for (const [path, body] of Object.entries(files)) {
    if (body.length > 300000) return { ok: false, error: "file over budget: " + path };
    JSON.parse(body);   // never publish something that doesn't parse
  }
  const commit = await commitFiles(env.GITHUB_TOKEN, repo, branch, files, `Feed rev ${rev} (${reason}): ${Object.keys(files).length} file(s)`);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM dirty WHERE item IN (${dirty.map(() => "?").join(",") || "''"})`).bind(...dirty),
    env.DB.prepare(`INSERT INTO meta (k, v) VALUES ('feed_rev', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`).bind(String(rev)),
    env.DB.prepare(`INSERT INTO meta (k, v) VALUES ('index_rev', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`).bind(String(rev)),
    env.DB.prepare(`INSERT INTO meta (k, v) VALUES ('index_dirty', '0') ON CONFLICT(k) DO UPDATE SET v = '0'`),
    env.DB.prepare(`INSERT INTO meta (k, v) VALUES ('claims_state', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`).bind(claimsState),
    env.DB.prepare(`INSERT INTO meta (k, v) VALUES ('last_publish', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`).bind(new Date().toISOString()),
  ]);
  return { ok: true, rev, files: Object.keys(files), commit };
}

async function parcelFile(env, parcel, rev) {
  const rows = (await env.DB.prepare(
    `SELECT p.key, p.type, a.vrchat_name, a.adult, a.name_verified FROM plots p JOIN accounts a ON a.id = p.account_id
     WHERE p.land = 1 AND p.parcel = ? ORDER BY p.key`).bind(parcel).all()).results;
  const plots = rows.map(r => [r.key, r.type, r.adult && r.name_verified && r.vrchat_name ? nameHash32Hex(r.vrchat_name) : "", "", 0, 0, 0, "", null, 0, 0, 0]);
  return JSON.stringify({ format: "pv-plots-1", land: 1, parcel, rev, plots });
}

async function ownersFile(env, bucket, rev) {
  const rows = (await env.DB.prepare(
    `SELECT p.key, a.vrchat_name FROM plots p JOIN accounts a ON a.id = p.account_id
     WHERE a.adult = 1 AND a.name_verified = 1 AND a.vrchat_name IS NOT NULL ORDER BY p.key`).all()).results;
  const o = {};
  for (const r of rows) {
    const h = nameHash32Hex(r.vrchat_name);
    if (h.slice(0, 2) !== bucket) continue;
    (o[h] = o[h] || []).push(r.key);
  }
  return JSON.stringify({ format: "pv-owners-1", rev, o });
}

// ---------------------------------------------------------------- GitHub: one commit with several files

async function gh(token, method, path, body) {
  const r = await fetch(API + path, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "pv-website-publisher",
               "X-GitHub-Api-Version": "2022-11-28", ...(body ? { "Content-Type": "application/json" } : {}) },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`GitHub ${method} ${path} → ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}

export async function commitFiles(token, repo, branch, files, message) {
  let ref;
  try { ref = await gh(token, "GET", `/repos/${repo}/git/ref/heads/${branch}`); }
  catch (e) {   // create the branch from the default branch the first time (e.g. feed-test)
    const info = await gh(token, "GET", `/repos/${repo}`);
    const base = await gh(token, "GET", `/repos/${repo}/git/ref/heads/${info.default_branch}`);
    ref = await gh(token, "POST", `/repos/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: base.object.sha });
  }
  const parent = await gh(token, "GET", `/repos/${repo}/git/commits/${ref.object.sha}`);
  const tree = await gh(token, "POST", `/repos/${repo}/git/trees`, {
    base_tree: parent.tree.sha,
    tree: Object.entries(files).map(([path, content]) => ({ path, mode: "100644", type: "blob", content })),
  });
  const commit = await gh(token, "POST", `/repos/${repo}/git/commits`, {
    message, tree: tree.sha, parents: [parent.sha],
    author: { name: "Prospect Valley VR", email: "Info@ProspectValleyVR.com", date: new Date().toISOString() },
  });
  await gh(token, "PATCH", `/repos/${repo}/git/refs/heads/${branch}`, { sha: commit.sha });
  return commit.sha;
}

export { COLS };
