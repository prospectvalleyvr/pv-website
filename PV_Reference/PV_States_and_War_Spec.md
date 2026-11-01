# PV States, Diplomacy & War – Data and Rules Spec (v0.1, Nov 1 2026)

Part of Realm Charter v2.2 (Part 14). Merges PV_Vision_Addendum_1 §§ 1–4 with the owners' decisions of Nov 1. **Design only – build after Homesteads are live** (Vision § 16). Numbers are starting points to tune in testing. Items marked **OPEN** need the owners; items marked **ATTORNEY** wait for legal review.

Companions: PV_Vision.md § 9 (paths, states, war), PV_Data_Feed_Spec.md (the feed), PV_Soul_Scroll_Spec.md (codes – the Battle code `BT-` and its salt live there), PV_Website_Plan.md (accounts, publisher, admin), PV_Realm_Plan.md § 10 (Thermopylae wave battle).

## 0. Decisions (owners, Nov 1)

| # | Decision |
|---|---|
| D1 | The pay-per-prompt service is **Decrees**. |
| D2 | The place-and-time portals are **Ring Gates**. |
| D3 | **Attack ≠ War.** An **attack** (a raid, open or by stealth) is one-sided; its consequences depend on the target area's **security**, and it never takes a deed. **War** is entered only when **both sides agree** to a War Pact; its outcome can include a **total takeover**, with **deeds won and lost** as the pact's stakes allow (§ 7). |
| D4 | The **Kings' army** sells and rents **guards / protection**, and the Crown **gifts** landowners a **Realm Guard** in proportion to the plots they own (numbers: § 6). |
| D5 | Paid (Decree-built or bought) defences count in battles, **capped** so skill and strategy still win (≤ 10 % of a battle's score; ≤ +20 security). Claude's recommendation, recorded because the owners left it open – change any time before war ships. |

## 1. Principles

1. **Civilian by default.** No account is ever forced into a state, an army or a war. A player with no state can't be attacked or drafted; the Crown protects them.
2. **The website is the source of truth.** States, citizens, relations, provinces, armies, wars and results live in the website database (D1). Worlds only read the published feed; results come back by codes players type in (VRChat worlds can't send data).
3. **The Kings are sovereign.** Every state exists under the Crown; the Kings (PV ownership) can dissolve, restore, correct, freeze or appoint a regent for any state, and review any war result. This is lore and our moderation tool, and the Terms of Use say so plainly.
4. **Nothing personal is taken by force.** Raids and control never touch a player's wallet, stockpile or deed. Only a **War Pact the owner personally signed** can move a deed (§ 7.3).
5. **No real-money gambling, no cash-out.** War stakes never include real money, PV Bucks wallets, Chips or anything that cashes out. State funds (Supplies, Influence) are website-only and play-only.
6. **No chance in results.** Strategy-map outcomes are deterministic (numbers, not dice); battles are skill. This keeps war clear of "game of chance" rules.
7. **13+ and stylised.** No gore; defeated soldiers fall and respawn. State names, banners and laws are reviewed like plot signs (13+, no IP, no slurs).

## 2. Three paths

| Path | Who | Data |
|---|---|---|
| **Civilian** | everyone by default | nothing extra |
| **Government** | a land owner who founds or helps run a state | `state_members.role` = founder / leader / minister / councillor / citizen |
| **Military** | pledged players | **two separate services:** (a) the spiritual war – Army of Light / Darkness, side + rank in the **Soul Scroll** (unchanged v3 fields, Charter Part 7.6); (b) a **state army** – rank kept on the **website** (`state_members.rank`, 0–31), published in the feed for 18+ verified players only |

A player can be a civilian citizen of a state, a soldier of a state, and separately pledged to Light or Darkness. Leaving a state army ends that service record (a new one starts on rejoining).

## 3. States

### 3.1 Founding and growth

- **Any account that owns at least one plot** (a free Homestead counts) can found a state. It starts as a **Household**. One citizenship per account at a time.
- **Tiers** (computed daily from citizens and the plots they own; titles follow the government type):

| Tier | Citizens | Plots held by citizens | Unlocks |
|---|---|---|---|
| 1 Household | 1+ | 1+ | name, banner, laws, diplomacy requests |
| 2 Village | 5+ | 25+ | a state army, alliances, trade pacts |
| 3 Town | 15+ | 150+ | raids, a capital building (Decree), embassies |
| 4 City | 40+ | 600+ | War Pacts, vassals, a second army |
| 5 Nation (Kingdom / Republic / …) | 100+ | 2,500+ | ministers, multiple provinces as a realm, Empire title if it rules 3+ provinces outside its own |

- **Leaders who sign War Pacts or treaties with stakes must be 18+ verified** (website account). Under-18 founders can run a Household or Village (names hidden as everywhere) but can't sign War Pacts.

### 3.2 Government types

The founder picks a type, or **Custom** (set the same knobs freely). The knobs are what the code reads; the type is a preset and a title.

| Type | Leader chosen by | Term | Laws pass by | War / treaties declared by | Treasury |
|---|---|---|---|---|---|
| Monarchy | inheritance (named heir) | life | ruler | ruler | ruler |
| Empire | inheritance or appointment | life | ruler (+ council advice) | ruler | ruler; vassals pay tribute |
| Democratic republic | citizen vote | 30 days | citizen vote (majority) | vote (60 %) | budget vote |
| Council | council vote (3–9 members) | 60 days | council majority | council 2/3 | council |
| Communist state | party council (appointed) | 90 days | council | council | shared equally to citizens' projects |
| Theocracy | appointed by the order's elders | life | elders | elders | the order |
| Tribe | elders by acclaim | life | gathering vote | chief + elders | shared |
| Guild-state | richest members (by Supplies given) | 30 days | members by stake | officers | by stake |

All votes run on the website (one account, one vote; 48-hour windows). Laws are short texts (≤ 280 characters) plus a few switches the code reads: tax rate on citizens' **state contribution** (0–20 %, see § 4.3), who may join (open / approval / closed), neutrality, draft (volunteer only – no state can force a citizen to fight).

### 3.3 The Kings' powers (in the code and the Terms)

`royal_action(state, kind, note)`: **dissolve**, **restore**, **correct** (rename, re-banner, reset a law), **freeze** (no actions for N days), **appoint regent**, **void result** (a battle or war), **lift / impose sanctions**. Every royal action is logged in `admin_log` and shown publicly in the feed (`royal` notes, plain words, no personal data).

## 4. Territory, provinces, control

### 4.1 Provinces

- **A province = one parcel** (Lands: `GIZ-H11`, 361 per Land, 1,849 plots; the Realm: its parcels by WID). It is the unit of the strategy map.
- **Crown provinces never change hands:** Wonder grounds, the Plaza, towns' crown cores, Thermopylae, schools, dig sites (Charter 1.7). They show the Crown banner.

### 4.2 Influence and control

- Each state has **Influence 0–1,000** in each province. Sources (computed at the daily tick):
  - **+1 per plot** in the province owned by a citizen (max 400);
  - **+2 per improvement** on those plots (kit farm, quarry …);
  - **+garrison strength / 10** (armies stationed there, § 8);
  - **+50** for each battle won there (decays);
  - **−** raids suffered (§ 6.4).
  - Everything above the plot base **decays 5 % a day**.
- **Control:** the state with the most Influence controls a province if it has **≥ 300** and leads the next by **≥ 100**. Otherwise the province is **contested** (no controller) or stays the **Crown's**.
- Control means: the state's banner on the map, the province's **tribute** (§ 4.3), the right to set **tolls on trade routes** crossing it, and garrison bonuses. **Control never changes who owns a plot.**

### 4.3 State funds (website-only, play-only)

- **Supplies** – the state's working resource (armies, hired guards, buildings, embassies). Earned from **tribute** (each controlled province pays 1 Supply per 10 owned plots per day, from the Crown – never taken from players), **citizen musters** (a citizen who checks in on the website or in a PV world with a muster code gives 5 a day), battle and raid wins, trade-route tolls, and the state contribution law (citizens may pledge a share of their *muster* to the state, not of their own goods).
- **Influence** – per province, above.
- **Never** exchangeable for PV Bucks, Chips, resources or real money, in either direction. (A later "donate resources to my state" path would need a world-side code; not in v0.1.)

## 5. Diplomacy

### 5.1 Relations (one row per pair)

`alliance` · `non-aggression` · `trade pact` · `passage` (route across land, with a toll) · `embassy` · `vassal` (tribute %, protection) · `rival` · `enemy` · `ceasefire` (N days) · `at war` (only via a War Pact). Defaults: **none** (peace).

### 5.2 Requests

A **request** = kind + terms (JSON, ≤ 2 KB) + expiry (7 days). The receiver **accepts, refuses or counters** (a counter is a new request). Every request and answer is logged. Treaties with stakes need the signer roles from the government type.

### 5.3 Neutrality

- A state (or a lone owner – lone owners are neutral by default) can declare **neutral**. Neutral states can't be raided or warred, and hold no alliance / enemy / rival / vassal relations.
- **One at a time:** a neutral state has at most **one open incoming and one open outgoing** request. Allowed kinds: passage (with toll), trade pact, embassy, ceasefire.
- **Switching:** declaring neutral needs no active war and no raid in the last 7 days; leaving neutrality is announced in the feed and takes effect after **7 days** (no surprise attacks).

## 6. Security, guards and attacks (raids)

### 6.1 Security score (per plot, 0–100)

`security = zone base + Crown watch + gifted guards + hired guards + paid defences (≤ +20) + state garrison bonus`, capped at **100**. **Security ≥ 90 = can't be raided.**

| Zone base | |
|---|---|
| Crown land, the Plaza, Wonder grounds, town cores | 100 (never raidable) |
| Towns and bazaars | 60 |
| Farmland, oasis, river banks | 40 |
| Desert, hills, wilds | 25 |
| Frontier (Realm Ring 3, far districts) | 15 |

### 6.2 The Crown's gift – the Realm Guard (D4)

- **Crown watch:** every owner's **Homestead (home) plot** gets **+10**, and is fully protected for its first **30 days** after the claim.
- **Gifted Realm Guard posts:** **1 post per 25 plots** an owner holds in one Land (first post at 25 plots; up to **20 posts = 500 plots** per Land). Each post adds **+15** to the 25 owned plots nearest it; posts stack to **+30** on any plot. Posts are placed automatically (owner can move them on the website); they show in-world as a PV guard post with a patrolling guard (kit, data feed).
- Why these numbers: a small owner is covered by the zone + Crown watch; a 25-plot estate in farmland reaches 40 + 15 = 55 before any spending; a 100-plot estate with overlapping posts reaches 70+. Raids stay possible against big, unguarded frontier holdings – the game – but never against a newcomer's home.

### 6.3 Hiring protection from the Kings' army (D4)

Paid with **Supplies** (state funds) – never with PV Bucks moved out of worlds, never with real money except as § 6.5.

| Hire | Effect | Covers | Cost |
|---|---|---|---|
| Watchman | +5 security | 25 plots | 50 Supplies / week |
| Realm Guard squad | +10 security | 100 plots | 150 Supplies / week |
| Crown Garrison | +20 security province-wide for the state's citizens; +50 defender strength in that province's battles | 1 province | 1,000 Supplies / week |

### 6.4 Raids (attacks – one-sided, never deeds)

- **Who:** a state of tier 3+ that isn't neutral, against a state it lists as **rival / enemy** or is **at war** with. Never against civilians, neutral states, allies or the Crown.
- **Target:** one **province** where the defender has Influence.
- **Resolution (daily tick, deterministic):** `attack = raiding army strength (+ stealth bonus +20 % if declared as a stealth raid and the defender has no Watchman there)`, `defence = average security of the defender's plots there × 10 + garrison strength`. If attack > defence → **success**, magnitude `m = (attack − defence) / attack` (0–1).
  - **Effects of a success:** defender loses `m × 200` Influence there; loses `min(10 % of its Supplies, m × 500)` Supplies (to the raider); its plots there show "raided" scorch marks for 24 h (cosmetic, feed flag). **Never** deeds, wallets, stockpiles or buildings.
  - **A failed raid** costs the raider `20 %` of the raiding army and gives the defender +50 Influence there.
- **Live option:** if both sides have players online inside the raid window, the raid can be fought as a small **skirmish** in a battle world (§ 9); the result code replaces the formula.
- **Limits:** a state launches ≤ 3 raids a day; a province can be raided once a day.

### 6.5 Paid defences (Decrees and charters, D5)

- **Decree-built defences** (walls, towers, gates, barracks, a war machine, banners, uniforms, a battlefield on your territory) are built between battles, reviewed and shipped on Realm Update Day like any Decree.
- **Caps (in code, on the website and in battle worlds):** paid sources add **≤ +20 security** (shared cap) and **≤ 10 % of a battle's score**. Cosmetic Decrees (uniforms, banners) have no cap and no effect.
- **ATTORNEY:** selling security or battle advantage for real money (a "Royal Protection Charter") – check against consumer-protection and VRChat Creator Economy rules before offering it.

## 7. War (both sides agree)

### 7.1 The War Pact

A war exists only when **both** sides' signers accept the same **War Pact**:

| Field | |
|---|---|
| sides | attacker state (+ allies who sign), defender state (+ allies who sign) |
| stakes | per side: provinces (control), Supplies (≤ 50 %), vassalage, **total takeover** (yes / no), **deeds** (an explicit list of plots, § 7.3) |
| format | number of battles (1, best of 3, best of 5), battle kinds (field, siege, pass), mode (Simulation / Arcade), max players per side |
| schedule | up to 3 battle windows a week, each ≥ 2 h, agreed times (UTC), within **14 days** |
| battlefield | each side picks alternate battles; a defender may pick its own territory (its Decree defences apply, within the cap) |
| rules | no-show: forfeit that battle 15 min into its window; surrender any time; ceasefire by mutual request |

### 7.2 Outcomes

- The side that wins the format wins its stakes. **Total takeover** (only if both sides staked it): the loser's state is **dissolved into** the winner (its citizens become the winner's citizens, free to leave within 7 days) or becomes a **vassal** (the pact says which).
- **Peace after a war:** 30 days of enforced peace between the same states.

### 7.3 Deeds at stake (D3, with safeguards)

- **Only an owner can stake their own plots**, plot by plot, with a personal confirmation (18+ verified account, re-signed in within 10 minutes). A leader can't stake citizens' land.
- **The Homestead (home plot) can never be staked.** Every player always keeps a home.
- Staked plots are **locked** (no sale, gift or move) from signing until the result is final.
- **Kings' review:** every result that moves deeds waits **48 hours** for the Kings; then the deeds transfer in the next publish.
- **ATTORNEY (blocking):** plots **bought with real money** can't be staked until the attorney confirms it isn't wagering under gambling law (a paid item put at stake on a contest outcome). Until then only **plots obtained free in play** (Lost Claims, Contested Claims, war winnings – PV_Land_Rush_and_Discovery.md) can be staked; the website tracks each plot's `origin` (`homestead` / `free-claim` / `paid` / `won`).

## 8. The strategy map

- **Map:** provinces on the website map and the Overlook table (the same `status.png` base, with a state-colour layer).
- **Armies:** a state army has **strength** = citizen soldiers × 10 + hired troops (bought with Supplies: 10 strength per 20 Supplies, upkeep 1 Supply per 10 strength a week). Cap: **20 hired strength per citizen soldier** – armies grow with real players.
- **Orders** (website, any time before the tick): move (to an adjacent province: 1 tick; across a Land: 3 ticks), garrison, raid, siege.
- **Daily tick (00:07 UTC, the website cron):** upkeep → movements → raids → influence → control → tiers → publish. Where two warring armies meet, the tick **schedules a battle** inside the pact's next window instead of resolving it.
- **No-show fallback:** a scheduled battle nobody fights resolves by strength (deterministic) at the window's end.

## 9. Battles in VRChat (and how results come back)

- **Battle worlds:** **S-05 Battlefield – Field**, **S-06 Battlefield – Siege** (templates, WIDs 205–206) and the **Thermopylae** pass (OLY-06, story and wave battle). One world, many battlefields: terrain and defences load from the feed (kit pieces, Decree builds that shipped).
- **Instances:** VRChat caps an instance (plan 40–80 players); a battle is **≤ 32 players a side** with **≤ 60 active AI troops** on Quest (front lines only; the rest are cheap instanced crowds).
- **Setup:** the world reads `feed/war.json` and lists today's battles; a commander picks one at the war table; the instance owner holds the battle id (synced; changes by `[NetworkCallable]` checked against `NetworkCalling.CallingPlayer`).
- **Result:** at the end the world shows each player a **Battle code** `BT-…` (20 symbols, PV_Soul_Scroll_Spec.md): battle id, side, outcome, mode, score, name hash, day.
  - The website accepts a result when **both commanders** enter matching codes, or one does and the other doesn't dispute within 24 h. Disputes and every deed-moving result go to the Kings.
  - Players enter their own codes for personal rewards (rank in the state army, titles, leaderboards).
- **Honest limits:** a salt can be extracted from a world and codes forged; both-sides agreement, the Kings' review and rate limits are the protection, and nothing at stake ever cashes out.
- **Fairness in code:** paid defences ≤ 10 % of score; equal player caps per side; Arcade and Simulation have separate leaderboards.

## 10. Data – website database (D1)

| Table | Key columns |
|---|---|
| `states` | id, name, type, knobs (JSON), tier, colour, banner_asset, capital_key, founded_at, status (active / frozen / dissolved / royal), neutral, neutral_from, supplies |
| `state_members` | state_id, account_id, role, rank (0–31), soldier (0/1), joined_at |
| `laws` | state_id, n, text, switches (JSON), passed_at, by (vote id) |
| `votes`, `ballots` | id, state_id, subject, opens, closes, result · vote_id, account_id, choice |
| `relations` | a, b, kind, terms (JSON), since, until |
| `requests` | id, from_state, to_state (or owner), kind, terms, status, created, expires |
| `provinces` | land, parcel, controller (state id / 0 Crown / null contested), crown (0/1), updated |
| `influence` | land, parcel, state_id, base, extra |
| `armies` | id, state_id, land, parcel, strength, order (JSON) |
| `guards` | account_id, land, key (post plot), kind (gift / watchman / squad / garrison), until |
| `raids` | id, attacker, defender, land, parcel, kind (open / stealth), tick, result (JSON) |
| `wars` | id, pact (JSON), signed_a, signed_b, status, result, review_until |
| `war_stakes` | war_id, side, kind (province / supplies / takeover / deed), ref, locked |
| `battles` | id, war_id or raid_id, wid, land, parcel, window_start, window_end, mode, status, result (JSON) |
| `battle_codes` | code_hash (PK), battle_id, account_id, side, outcome, score, at |
| `plots.origin` *(new column)* | homestead / free-claim / paid / won |
| `admin_log` | as now (royal actions too) |

## 11. Data – the feed (additive to `pv-feed-1`; worlds ignore unknown fields)

| File | Format | Contents | Who loads it |
|---|---|---|---|
| `realm/states.json` | `pv-states-1` | `[id, name, type, tier, colour, bannerCell, capitalKey, neutral, citizens, status]` per state; `royal` notes | Overlook, Homestead and battle worlds that show banners |
| `feed/<land>/control.json` | `pv-control-1` | per province: `[parcel, controller, top-3 influence, raided-until]` | Overlook map, Homestead horizon |
| `feed/war.json` | `pv-war-1` | active wars (sides, stakes summary without plot lists), battles `[id, wid, land, parcel, start, end, mode, status, score]` | battle worlds, the Overlook war table |
| parcel files | `pv-plots-1` + optional `st` | `{ "st": { "<plotKey>": stateId } }` for banners; `g` = guard posts in the parcel | Homestead worlds |
| owners files | `pv-owners-1` + optional `s` | `{ "s": { "<ownerHash>": [stateId, armyRank] } }` – 18+ verified only, as the rest of that file | Find my home / Find an owner |

Budgets: `states.json` ≤ 300 KB (≈ 2,000 states); beyond that it shards to `realm/states/<bucket>.json`. String loading stays one request every 5 s; banners use image loading (one atlas per 64 states, `realm/banners/<n>.png`, 1024², reviewed).

## 12. Soul Scroll

- **No change to v3.** The spiritual war (side, pledge changes, school, rank) stays in v3; state citizenship and state army rank live on the website and the feed (they change too often and need moderation).
- **New code: the Battle code `BT-`** (20 symbols, 75 data bits + 25 check, salt `BT` in PV_Soul_Scroll_Spec.md): kind (1 battle result · 2 wave score · 3 skirmish), name hash, battle id (20 bits; 0 for wave runs), side, outcome, mode, score / waves, day.
- **Achievements 48–55 (proposed, reserved – write into the Soul Scroll spec only when approved):** 48 Citizen · 49 Founder · 50 Diplomat · 51 Defender · 52 Veteran (5 battles) · 53 Ring Walker (first Ring Gate journey) · 54 Agoge (Sparta training complete) · 55 The Hot Gates (finished Thermopylae). Readers widen the `ach1` mask when these ship.

## 13. Terms of Use and attorney items

- **Terms (add when states ship):** the Kings' sovereignty (§ 3.3); war results and deed transfers under a signed pact; Homesteads never at stake; state funds are play-only; no real-money trading of states, armies or plots.
- **ATTORNEY:** (1) deeds bought with real money staked in a War Pact (§ 7.3); (2) selling security / battle advantage (§ 6.5); (3) under-18 citizens in states run by adults (chat and contact rules – VRChat's own rules apply in worlds; the website has no chat in v0.1).

## 14. Build phases (after Homesteads are live)

1. **States v1:** found / join / leave, government types and votes, banners (review), `states.json`, citizen banners in Homestead worlds. No war.
2. **Diplomacy:** relations, requests, neutrality, passage tolls.
3. **Security & guards:** zone base, Crown watch, gifted posts in the feed and in-world, hired guards.
4. **Strategy map + raids:** provinces, influence, control, armies, the daily tick, `control.json`.
5. **Battles:** Thermopylae's wave engine (PV_Realm_Plan.md § 10) becomes the field-battle template; Battle codes; War Pacts **without deed stakes**.
6. **Deed stakes** – only after the attorney's answer and an independent review (saved data + land).
