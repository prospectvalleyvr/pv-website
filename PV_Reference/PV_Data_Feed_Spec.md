# The PV Data Feed – Plot ownership, kit choices and maps (v1.1)

Settled Oct 30, 2026 with Realm Charter v2. VRChat worlds can't call our website, so the website **publishes read-only files** that worlds download with String Loading and Image Loading. This spec fixes those files. Companion files: PV_Realm_Charter.md (plots, Part 1), PV_World_Registry.md, PV_Blue_Pages_Spec.md, PV_Soul_Scroll_Spec.md (claim codes).

**v1.1 (Oct 30):** `index.json` gains `"opens"` (Land Rush opening time, UTC `YYYY-MM-DDTHH:MM:SSZ`, left out until the 24-hour countdown starts); PV_Feed keeps one request at a time, ≥ 5.5 s apart, index at 7 s; World 1 bakes index + 256 owner files + Giza's 361 parcel files. DECIDED (owners, Oct 30): under-18 and age-unknown accounts are left out of the public owners index and their plot rows carry an empty owner hash; their Find my home points them to their website account (full wording in the Project copy, § 6).

## 1. Where it lives

- Same GitHub Pages site as the registry and the Blue Pages: **`https://prospectvalleyvr.github.io/realm/feed/…`** (GitHub account `prospectvalleyvr`, public repo `realm`). VRChat trusts `*.github.io`.
- **Never a custom domain** on this site (GitHub would redirect; VRChat refuses redirects).
- Every URL a world loads is **baked in at build time** (a VRCUrl can't be made from a string at runtime). So file names are fixed and predictable; worlds bake the full set of names they may need (e.g. all 361 parcel files of a Land: a `VRCUrl[]` array).
- The repo is public: **nothing private goes in the feed** – no emails, no real names unless the owner chose to show them, no account data.
- GitHub Pages limits (soft): 1 GB site, 100 GB/month bandwidth, 10 builds an hour. The website pushes **one batch commit per hour at most**. If the Realm outgrows Pages, the feed moves to another VRChat-trusted host with a **new baked URL in new world builds** (old builds keep the old URL serving a copy) – plan for it before 1 GB.

## 2. Files

| File | What | Budget |
|---|---|---|
| `feed/index.json` | Feed header: format, rev, time, which Lands have data, current Homestead district fill, `claims` open / closed | ≤ 10 KB |
| `feed/<land>/map.json` | One row per parcel: owned, free, crown, for-sale counts, Homestead count, price phase (when sales open) | ≤ 40 KB |
| `feed/<land>/status.png` | **1024 × 1024 PNG, one pixel per plot** (the Land grid): colour = status (§ 4). The Overlook map's overlay | ≈ 4 MB in memory |
| `feed/<land>/<parcel>.json` | **One file per parcel**: every non-crown plot that has an owner, with kit choices (§ 3) | ≤ 200 KB |
| `feed/<land>/prices.json` | Market prices for that Land (resource ID → buy / sell PV Bucks) | ≤ 5 KB |
| `feed/owners/<xx>.json` | Owner index: 256 files by the first two hex digits of the 32-bit owner hash → that owner's plot keys | ≤ 300 KB each |
| `feed/kits/kits.json` | Kit catalogue version (which kit IDs exist, per era / biome) | ≤ 20 KB |
| `feed/logos/plots-00.png` … | Plot-sign logo atlases (same 1024², 8 × 8 cell layout as Blue Pages logos) | ≈ 3 MB each |

`<land>` = the Land code in lower case (`pvr`, `giz`). `<parcel>` = Realm parcel code (`1-s-b2`) or Land parcel code (`k10`).

## 3. Formats

### `feed/index.json`
```json
{ "format": "pv-feed-1", "rev": 1, "time": "2026-11-20T15:00:00Z",
  "opens": "2026-11-21T15:00:00Z",
  "lands": { "giz": { "rev": 1, "claims": "open" }, "pvr": { "rev": 1, "claims": "closed" } },
  "districts": { "giz-west-desert": 0.02, "giz-nile-valley": 0.03 } }
```

### `feed/<land>/<parcel>.json`
```json
{ "format": "pv-plots-1", "land": 1, "parcel": "E5", "rev": 7,
  "plots": [
    [1356076, 1, "ed3fff98", "Prospect Valley", 3, 2, 0, "The Valley Date Grove", [0, 4], 1024, 0, 0],
    [1356077, 1, "ed3fff98", "", 3, 2, 0, "", null, 0, 0, 0]
  ] }
```
Each plot row is a fixed-position array (fast to parse in Udon):

| # | Field | Meaning |
|---|---|---|
| 0 | key | plot key |
| 1 | type | 1 Homestead (free) · 2 owned (paid) · 3 leased (PV-owned, business) · 4 for sale (no owner) |
| 2 | owner | 32-bit owner hash (hex) |
| 3 | name | display name if the owner opted in, else `""` → "Private owner" |
| 4 | kit | kit building ID (era / biome kit catalogue; 0 = bare land) |
| 5 | colour | 0–7 PV-palette trim colour |
| 6 | improvement | 0 none · 1 farm · 2 quarry · 3 mine · 4 lumber camp · 5 fishery · 6 grove; +8 = upgraded |
| 7 | sign | sign text ≤ 32 characters (studio-approved; empty = owner's shown name or nothing) |
| 8 | logo | `[page, cell]` in the plot logo atlases, or `null` |
| 9 | lid | linked Blue Pages listing ID (0 = none) |
| 10 | go | owner world WID for the plot portal (0 = none) |
| 11 | estate | estate number within this parcel (0 = single plot) |

Plots not listed are free (or crown, which the world knows from its baked zone map). The deposit is never stored – worlds compute it (`plot_deposit`).

### `feed/owners/<xx>.json`
```json
{ "format": "pv-owners-1", "rev": 3, "o": { "ed3fff98": [1356076, 1356077] } }
```
Used by "Find my home" (the local player's own hash) and "Find an owner" (a typed display name, hashed in-world). An owner who hides their name is still findable by someone who types it exactly – said plainly in the opt-in form.

### `status.png` colours (PV palette, exact RGB)

| Status | RGB |
|---|---|
| Out of the Land / sea | 0, 0, 0 |
| Crown (grounds, roads, digs) | 192, 192, 192 (silver) |
| Water | 40, 70, 60 (dark green-grey) |
| Free – claimable | 245, 245, 235 (white) |
| Free – paid-only zone (town, quarry) | 200, 200, 190 |
| Homestead | 120, 190, 90 (PV green) |
| Owned (paid) | 30, 120, 60 (forest green) |
| Leased / business | 255, 219, 77 (gold) |
| For sale | 255, 240, 160 (pale gold) |
| Owned with a Blue Pages listing | 255, 219, 77 + a gold ring on the map shader |

The image is loaded with `TextureInfo` point filtering, no mipmaps, no compression; the map shader reads it directly (no CPU parsing). Dispose it when the map closes on Android / iOS.

## 4. Loading in worlds (PV_Feed)

- **One shared queue with PV_Registry and PV_BluePages** – VRChat allows one string download every 5 s per world (and one image every 5 s). Order: `registry.json` → `bluepages.json` → `feed/index.json` → what this world needs.
- **Homestead worlds:** index → the shown parcel's file (+ its 8 neighbours lazily, for the horizon) → the owners file of the local player (Find my home).
- **The Overlook:** index → `map.json` of the Land in view → `status.png` → parcel files only when a player zooms in on a parcel.
- **Realm parcel worlds** (Knights Bay, the Plaza): their own parcel file(s) only.
- Parse over frames (≤ 100 plot rows per frame on Android / iOS); strip `<` `>` and control characters from `name` and `sign`; clamp lengths; ignore unknown fields; drop rows whose key isn't inside this file's parcel.
- A file is used only if it parses, `format` matches and `rev` ≥ the last good one this session. **Baked fallback** (PV > Core > Bake Feed): `index.json` and `map.json` of the world's Land at build time; no ownership is baked (a stale baked owner would be wrong).
- Feed failures never block play: plots show as "Owner data loading…" then bare land.

## 5. The website side (www.ProspectValleyVR.com)

- Source of truth: the website's database (accounts, VRChat display names, claims, plots, kit forms, orders).
- **Publisher job** (hourly, only when something changed): writes the changed parcel files, the affected owner files, `map.json`, `status.png`, `index.json` (bump `rev`s) and pushes **one commit** to the `realm` repo through the GitHub API.
- **Realm Update Day** (monthly): prompt-built buildings (custom meshes) ship in world uploads; the feed only switches them on.
- `pv_feed_tool.py` (studio, with Core 0.6) validates every file against this spec, re-renders `status.png` from parcel files, and checks budgets.
- The website (custom web app, embeddable in Wix) needs: accounts, claim-code check (server-side salt), Homestead placement, owner form (name opt-in, kit, colour, improvement, sign, logo upload with review), the read-only map (same `status.png` + `map.json`). Paid checkout and resale stay **off** until the attorney answers.

## 6. Privacy and safety

- Owner names shown only by opt-in. No emails, no real-world addresses, no ages.
- Sign text and logos are reviewed before publishing (13+ worlds; no IP, no slurs, no links).
- Takedown: any plot's name, sign or logo can be blanked in the next hourly batch.
- Players under 18 may hold Homesteads (VRChat is 13+); their plots never show a name by default and can't link a Blue Pages listing (person listings are 18+).
