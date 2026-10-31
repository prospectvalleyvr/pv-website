// Prospect Valley – the feed publisher (PV_Data_Feed_Spec.md v1.1). Runs on the hourly Cron Trigger (and from the admin
// page later). Writes only what changed – parcel files, owner buckets – plus feed/index.json, as ONE commit to the
// public repo prospectvalleyvr/realm through the GitHub API. Nothing private is published:
//   · owner hash only for accounts that ticked 18+ AND verified their name (decided Oct 30); others: empty owner;
//   · names are never shown yet (no name opt-in exists) – rows carry "" → worlds show "Private owner".
// Safety (independent review, Oct 31):
//   · feed_dirty rows carry a seq; only the exact seq that was published is removed, so a change made during a run
//     is published next run, never lost;
//   · one run at a time (a 10-minute lease in meta); the rev number is reserved before the commit, so a run that
//     fails after committing never reuses a rev;
//   · at most MAX_ITEMS files per run (D1 / Worker limits); the rest wait for the next run; all reads are one batch.
// Settings: vars PUBLISH_ENABLED ("true" to run), FEED_REPO, FEED_BRANCH ("main" – GitHub Pages serves it), FEED_DIR
// ("feed-test" while testing → worlds baked with the TEST feed read it; "feed" when live). Changing repo / branch / dir
// republishes everything there on the next run.
// secret GITHUB_TOKEN (fine-grained, Contents read/write).

import { nameHash32Hex } from "./lib/codes.js";
import { fillNameBuckets, readMeta, claimsOpenFrom, OPENS_RE } from "./claims.js";

const API = "https://api.github.com";
const MAX_ITEMS = 40;
const LEASE_MS = 10 * 60000;

export async function publish(env, reason = "hourly") {
  if (env.PUBLISH_ENABLED !== "true") return { ok: true, skipped: "publishing is switched off" };
  if (!env.GITHUB_TOKEN) return { ok: false, error: "GITHUB_TOKEN missing" };

  const lease = String(Date.now() + LEASE_MS);
  const got = await env.DB.prepare(
    `INSERT INTO meta (k, v) VALUES ('publish_lock', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v WHERE CAST(meta.v AS INTEGER) < ?`)
    .bind(lease, Date.now()).run();
  if (!got.meta || !got.meta.changes) return { ok: true, skipped: "another publish is running" };
  try {
    return await publishLocked(env, reason);
  } finally {
    await env.DB.prepare(`UPDATE meta SET v = '0' WHERE k = 'publish_lock' AND v = ?`).bind(lease).run();
  }
}

async function publishLocked(env, reason) {
  const repo = env.FEED_REPO || "prospectvalleyvr/realm";
  const branch = env.FEED_BRANCH || "main";
  const dir = /^[a-z0-9-]{1,30}$/.test(env.FEED_DIR || "") ? env.FEED_DIR : "feed";
  await fillNameBuckets(env);
  const target = `${repo}@${branch}/${dir}`;
  if ((await readMeta(env)).feed_target !== target) {
    // a new place to publish: write every parcel with plots, every owners bucket in use, and the index there
    const set = (k, v) => env.DB.prepare(`INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`).bind(k, v);
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO feed_dirty (item, seq) SELECT DISTINCT 'parcel:giz:' || parcel, 1 FROM plots WHERE land = 1
                      ON CONFLICT(item) DO UPDATE SET seq = feed_dirty.seq + 1`),
      env.DB.prepare(`INSERT INTO feed_dirty (item, seq) SELECT DISTINCT 'owners:' || a.name_bucket, 1 FROM plots p JOIN accounts a ON a.id = p.account_id
                      WHERE a.name_bucket IS NOT NULL ON CONFLICT(item) DO UPDATE SET seq = feed_dirty.seq + 1`),
      set("index_dirty", "1"), set("feed_target", target),
    ]);
  }
  const dirty = (await env.DB.prepare(`SELECT item, seq FROM feed_dirty ORDER BY item LIMIT ?`).bind(MAX_ITEMS).all()).results;
  const meta = await readMeta(env);
  const claimsState = claimsOpenFrom(meta) ? "open" : "closed";
  const indexWanted = meta.index_dirty === "1" || !meta.index_rev || meta.claims_state !== claimsState;
  if (!dirty.length && !indexWanted) return { ok: true, skipped: "nothing changed" };

  // reserve the rev first: if anything later fails, the next run uses a new number
  const rev = Number(meta.feed_rev || 0) + 1;
  await env.DB.prepare(`INSERT INTO meta (k, v) VALUES ('feed_rev', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`).bind(String(rev)).run();

  // read everything needed in ONE batch
  const jobs = [];
  for (const d of dirty) {
    const [kind, a, b] = d.item.split(":");
    if (kind === "parcel" && a === "giz" && /^[A-HJ-NP-U](1[0-9]|[1-9])$/.test(b))
      jobs.push({ path: `${dir}/giz/${b.toLowerCase()}.json`, kind, key: b, stmt: env.DB.prepare(
        `SELECT p.key, p.type, a.vrchat_name, a.adult, a.name_verified FROM plots p JOIN accounts a ON a.id = p.account_id
         WHERE p.land = 1 AND p.parcel = ? ORDER BY p.key`).bind(b) });
    else if (kind === "owners" && /^[0-9a-f]{2}$/.test(a))
      jobs.push({ path: `${dir}/owners/${a}.json`, kind, key: a, stmt: env.DB.prepare(
        `SELECT p.key, a.vrchat_name FROM plots p JOIN accounts a ON a.id = p.account_id
         WHERE a.adult = 1 AND a.name_verified = 1 AND a.vrchat_name IS NOT NULL AND a.name_bucket = ? ORDER BY p.key`).bind(a) });
    // anything else is not a feed file: it is simply cleared below
  }
  const results = jobs.length ? await env.DB.batch(jobs.map(j => j.stmt)) : [];

  const files = {};
  jobs.forEach((j, i) => {
    const rows = results[i].results;
    if (j.kind === "parcel") {
      const plots = rows.map(r => [r.key, r.type, r.adult && r.name_verified && r.vrchat_name ? nameHash32Hex(r.vrchat_name) : "", "", 0, 0, 0, "", null, 0, 0, 0]);
      files[j.path] = JSON.stringify({ format: "pv-plots-1", land: 1, parcel: j.key, rev, plots });
    } else {
      const o = {};
      for (const r of rows) {
        const h = nameHash32Hex(r.vrchat_name);
        if (h.slice(0, 2) !== j.key) continue;      // name_bucket is a filter only – the hash decides
        (o[h] = o[h] || []).push(r.key);
      }
      files[j.path] = JSON.stringify({ format: "pv-owners-1", rev, o });
    }
  });
  const index = { format: "pv-feed-1", rev, time: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
                  lands: { giz: { rev, claims: claimsState } } };
  if (meta.opens && OPENS_RE.test(meta.opens)) index.opens = meta.opens;
  files[`${dir}/index.json`] = JSON.stringify(index);

  for (const [path, body] of Object.entries(files)) {
    if (body.length > 300000) return { ok: false, error: "file over budget: " + path };
    JSON.parse(body);   // never publish something that doesn't parse
  }
  const commit = await commitFiles(env.GITHUB_TOKEN, repo, branch, files, `Feed rev ${rev} (${reason}): ${Object.keys(files).length} file(s)`);

  const set = (k, v) => env.DB.prepare(`INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`).bind(k, v);
  await env.DB.batch([
    ...dirty.map(d => env.DB.prepare(`DELETE FROM feed_dirty WHERE item = ? AND seq = ?`).bind(d.item, d.seq)),
    set("index_rev", String(rev)), set("index_dirty", "0"), set("claims_state", claimsState), set("last_publish", new Date().toISOString()),
  ]);
  return { ok: true, rev, files: Object.keys(files), commit, more: dirty.length === MAX_ITEMS };
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
  await gh(token, "PATCH", `/repos/${repo}/git/refs/heads/${branch}`, { sha: commit.sha });   // not forced: refuses if moved
  return commit.sha;
}
