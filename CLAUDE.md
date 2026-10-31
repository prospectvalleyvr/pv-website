# PV Website – www.ProspectValleyVR.com

Owner: PVVR, LLC (Prospect Valley VR). Built and maintained by Claude. Plan: PV_Reference/PV_Website_Plan.md (Project copy wins).
Herald (the concierge voice for Help/FAQ): PV_Reference/PV_Herald.md.

## How it is built
- `build.py` makes the static pages in `site/` from the texts inside it plus `src/assets/` (style.css, site.js, pv-mark.svg).
  Claude runs `python3 build.py`; the owner never needs to. Never edit files in `site/` by hand.
- Hosting: Cloudflare (account in the company's name, Free plan). Stage 1 = static site uploaded to Cloudflare
  (Workers & Pages, project name `prospectvalley`). Stage 2 = Workers + D1 for accounts / claims / publisher.
- The Land Rush countdown reads `https://prospectvalleyvr.github.io/realm/feed/index.json` → `opens` (same as the worlds).
- `_headers` sets security headers incl. a strict Content-Security-Policy: no inline styles or scripts, no outside
  scripts; the only outside fetch allowed is prospectvalleyvr.github.io.

## Rules
- NEVER put salts, tokens or passwords in this folder or its git history. Secrets live only in Cloudflare Secrets.
- Git is local; if a remote is added it must be the PRIVATE repo prospectvalleyvr/pv-website.
- Money words: Homesteads are free; land is a use licence, never an investment; PV Chips are play-only; nothing cashes out.
- 13+ audience; under-18 / age-unknown accounts never appear in the public owners index.
- PV palette only (greens, gold, white, black, silver). No IP. Never mention Atlantis.
- Keep CHECKLIST.txt (CRLF) up to date.

## Domain / DNS (Oct 31)
- prospectvalleyvr.com registered at GoDaddy (owner's account). Cloudflare zone added, NOT activated yet.
- Scan found: 3 A + www CNAME → old Wix site (to replace); _dmarc + s1/s2._domainkey CNAMEs → Wix email (must be
  DNS only, not proxied); 5 MX → Google Workspace (keep); TXT spf + google-site-verification (keep).
- Still to check before switching nameservers: the live record list at the current DNS host (GoDaddy or Wix),
  especially google._domainkey (Google Workspace DKIM), which the scan did not show.

## Deploys
- Oct 31: first upload via the dashboard (Workers & Pages → static upload). Worker name `square-snowflake-2d1c` (auto-named; rename to `prospectvalley` in its Settings if wanted). Preview: https://square-snowflake-2d1c.twilight-tooth-9ded.workers.dev
- To update: Workers & Pages → the worker → New deployment → upload the `site` folder again.

## Stage 2b (Oct 31)
- worker/lib/giza.js: plot keys, parcels, Giza zones, deposits, features, districts, placement order (square rings from the
  Great Pyramid; START_RING per district). test/giza.test.mjs compares with pv_realm_tools.py.
- worker/claims.js: /api/offers, /api/claim (only when CLAIMS_OPEN = "true"), tables plots / used_codes / cursors / dirty / meta.
- worker/publisher.js: cron at :07 → changed parcel files + owner buckets + feed/index.json in ONE commit to FEED_REPO@FEED_BRANCH.
  Owner hash only for 18+ verified names; names never published yet (no opt-in). Needs secret GITHUB_TOKEN + PUBLISH_ENABLED "true".
- Local testing: wrangler dev --local in /tmp (never in this folder); workerd can't use the proxy, so test GitHub calls with node.
- Files copied through /mnt/user-data/outputs get a C2PA metadata block added to SVGs – write SVGs directly on the device.
