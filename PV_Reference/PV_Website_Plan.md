# PV Website & Realm Services – Plan (v1.2, Oct 31 2026)

Owners' decisions, Oct 31: build **www.ProspectValleyVR.com** fresh (not Wix), hosted on **Cloudflare**, built and maintained by Claude in code; aim for **independence from any one platform** (VRChat first, others later); privacy policy and terms are **living drafts** for the attorney; Claude sets up **"handshakes"** between projects so as much as possible runs by itself; the concierge character is **Herald** (PV_Herald.md). Domain registered at **GoDaddy** – the move to Cloudflare is **parked until needed** (before Google sign-in or the public launch).

Companion files: PV_Data_Feed_Spec.md (v1.1), PV_World_Registry.md, PV_Soul_Scroll_Spec.md (claim codes – salts), PV_Land_Rush_and_Discovery.md, PV_Blue_Pages_Spec.md, PV_Brand_Sheet.md.

---

## 1. The idea in one picture

```
              ┌──────────────────────────── www.ProspectValleyVR.com ────────────────────────────┐
 players ───► │ pages · accounts · Claim your Homestead · map · News / Land Rush · Help (Herald)  │
              │                         Realm API (Cloudflare Workers)                            │
              │          the Realm database (Cloudflare D1): accounts, plots, claims, owners      │
              └───────────────┬────────────────────────────────────────────────┬─────────────────┘
                publisher (Cron, every 15 min)                         read-only Realm API (JSON)
                              ▼                                                ▼
            prospectvalleyvr.github.io/realm  (registry.json + feed/…)    future platforms, apps,
                              ▼                                           partner tools
              VRChat worlds (Garden, Giza, Homesteads …) read the feed – they can't call the site
```

**The website's database is the single source of truth for land.** Every platform is a *window* onto it. VRChat reads the published files (it can only download from trusted hosts like GitHub Pages); other platforms that allow web requests can read the Realm API directly. This is what lets the same plot exist on more than one platform later.

## 2. Platforms beyond VRChat (honest view)

- **Build for:** platforms that let creators host worlds *and* load outside data or link out: Resonite, ChilloutVR, Roblox, Fortnite (UEFN), Rec Room, Meta Horizon, and the open web (a browser 3D view of the map, three.js). Each gets its own world builds reading the same Realm API.
- **Not possible / not now:** AltspaceVR closed in 2023. GTA and No Man's Sky do not offer player-hosted worlds or land that a company can sell into; anything there would need the publisher's official programme and terms, so we watch for it rather than plan on it. Modding against a game's terms is off the table.
- **The rule that makes it work:** a plot is a **use licence in the Realm**, not tied to one app (attorney to confirm wording). Each platform's own terms apply inside it (e.g. no real-money trade inside VRChat).

## 3. Hosting and accounts (who owns what)

| Thing | Where | Owner / login |
|---|---|---|
| Domain `prospectvalleyvr.com` | GoDaddy (registrar) – nameservers move to Cloudflare when needed | Owner |
| Website, Realm API, database, timers, secrets | Cloudflare Worker `square-snowflake-2d1c` + D1 `pv-realm` + Cron + Secrets – free tier | Owner (company account) |
| Website source code | private GitHub repo `prospectvalleyvr/pv-website` (**no salts in it, ever**) | Owner's GitHub; Claude works in it |
| Published feed + registry | public GitHub repo `prospectvalleyvr/realm` (GitHub Pages); feed on branch `feed-test` until go-live | Publisher commits only when something changed |
| Company email `Info@ProspectValleyVR.com` | Google Workspace (MX) – **its records must be copied to Cloudflare before the nameserver switch** | Owner |

Secrets (claim-code salt, Blue Pages salt, land-code salt, GitHub token) live **only** in Cloudflare Secrets (type *Secret*, never a plain variable). They are never written into code, the repo, the feed or a chat.

## 4. Website part 1 – what gets built

**Pages (public):** Home · The Realm · Land Rush (countdown from the same `opens` time the worlds use) · For business · Help & FAQ (Herald's voice) · Contact · Privacy · Terms · Account. Later: News, Map (read-only: Lands → Giza parcels, coloured from `status.png`).

**Accounts (decided Oct 31):** **Sign in with Discord** (live) and **Sign in with Google** (after the domain move) – no passwords. Scopes: Discord `identify email`, Google `openid email`; we keep the account id, the email (renewal reminders, support) and nothing else from them → link a **VRChat display name** (typed exactly) → **"I am 18 or older"** tick (unticked = treated as under 18: never in the public owners index, no shown name, no Blue Pages person listing).

**Claim your Homestead (built, claims closed):**
1. Player makes a claim code at the Garden's Scroll Desk.
2. On the site: display name + code. The Worker checks it with the **server-side salt**: right name hash, kind = claim, date within 30 days, never used (one canonical spelling per code). A claim also verifies the name; one verified account per VRChat name.
3. Placement (Charter Part 7.5): the districts for that heart; plots offered in one fixed public order (square rings outward from the Great Pyramid) – **no lottery, no paid boost**; 6 offers with deposit + feature shown before choosing; the first completed claim wins.
4. Saved → the next publish (≤ 15 min) puts it in the feed.
5. Renewal once a year with a fresh code (free). Unrenewed Homesteads return to the Crown after a grace month, with emailed reminders (renewal reminders: to build).

**Publisher (built):** Cron every 15 minutes; commits only when something changed: changed parcel files, owners buckets (18+ verified only), `index.json` (incl. claims state and `opens`) as one commit to `realm`. Never loses a change (seq per item), one run at a time, ≤ 40 files a run. Later: `map.json`, `status.png`, `status.json`, owner alert e-mail on failure.

**Admin (built, `/admin.html`):** owners only (ADMINS list); Land Rush `opens` time; claims closed / open at the time / open now (type OPEN); publish now; counts; admin log. To come: search players / plots, takedown of names / signs / logos, per-Land claims, two-step sign-in.

**Off until the attorney answers:** paid plots, checkout, resale. The pages say Homesteads are free – never a promise of rising value.

## 4b. How code gets to the live site (decided Oct 31)

- The website project lives on the owner's computer (`C:\VRChat Projects\PV Website`, local git). Claude pushes it to the **private** GitHub repo `prospectvalleyvr/pv-website`; Cloudflare **Workers Builds** deploys every push to `main` (`npx wrangler deploy`).
- Claude's push uses a GitHub fine-grained token kept in `C:\VRChat Projects\PV Keys\` – a folder that is never a git repo and never synced. Cloudflare's own API isn't reachable from Claude's tools, so GitHub is the bridge.
- Secrets are pasted by the owner into **Cloudflare → the Worker → Settings → Variables and Secrets** as type *Secret*. Never in chat, never in a repo.

## 5. Handshakes (how the projects talk without anyone carrying messages)

| Handshake | From → to | How |
|---|---|---|
| Registry | studio → every world | `registry.json` (rev'd); a world goes live by editing one entry – no re-upload of others |
| Feed | website → every world | publisher (above); worlds bake the URLs |
| Claim codes | world → website | player types the code (worlds can't call out) |
| Soul Scroll | world → world | player copies the code (PV_Soul_Scroll_Spec.md) |
| Realm API | website → other platforms / tools | read-only JSON: `/api/v1/lands`, `/plots/<code>`, `/owners/<hash>` (18+ only), `/status` |
| Studio status | everything → the owners and Claude | `realm/status.json` (publisher last run, feed revs, open claims, errors) + a Project doc `PV_Status.md` Claude updates each session |
| Scheduled checks | Claude | a scheduled task (owners approve) that reads `status.json` and the feed daily, and reports problems |
| Projects | Unity projects ↔ Project | `PV_Reference/` copies + CLAUDE.md + CHECKLIST in every project folder (as now) |

## 6. Privacy and safety (living drafts, attorney to review)

- Collect only: sign-in id, verified email, VRChat display name, 18+ tick, code answers + date, claims / plots, code-try counter, hashed sign-in and used-code fingerprints, admin log. No real names unless a business listing needs them, no addresses, no birthdays, no payment data (no payments yet).
- Players 13+ (VRChat's age); under-18 / unknown-age accounts: hidden from Find an owner, no shown name, no person listings.
- Delete-my-account and download-my-data buttons (live); takedown within the next publish.
- Cookies: sign-in only (no ad trackers). Analytics, if any, cookie-free.
- **Drafts published Oct 31:** Privacy Policy v0.1 and Terms of Use v0.1 on the site, marked as drafts under attorney review, versioned in the website repo (`build.py`). They describe exactly what the code does today – update them with every data change.

## 7. Build order (website)

1. ~~Static site skeleton~~ – live Oct 31.
2. ~~Accounts + 18+ tick~~ (Discord) – live Oct 31. Google after the domain move.
3. ~~Claim checker + placement~~ – built, independent review passed with fixes (Oct 31); claims closed.
4. ~~Publisher → `realm` (`feed-test`)~~ – live Oct 31. Next: the Garden test world reads `feed-test` (Find my home end-to-end).
5. ~~Admin page~~ – live Oct 31.
6. ~~Privacy + Terms drafts v0.1~~ – on the site Oct 31 → **attorney**.
7. Domain move → Google sign-in → go-live of the site (claims closed) → Land Rush launch gate → `opens` set on the admin page → claims open on the second (mode "open at the time").

## 8. What the owners do vs. what Claude does

- **Owners:** create accounts in the company's name, paste secrets, approve each go-live, decide prices / legal / anything irreversible, approve scheduled tasks.
- **Claude:** writes and tests all code, keeps docs and checklists current, deploys previews, prepares each go-live for one-click approval, runs scheduled health checks, drafts policies, writes Herald's lines.

## 9. Questions for the attorney (add to the existing list)

1. Homestead and plot wording as a **use licence** valid across platforms; what happens to plots if a platform closes.
2. Free Homesteads to players 13–17: consent, data, renewal reminders by email.
3. Land Rush "first come, first served" and unique plot features shown before choosing – confirm no lottery / gambling issue.
4. Terms for owner signs, logos and owner worlds (IP, takedown, mature content rules).
5. Data: worldwide players (GDPR / UK GDPR / CCPA basics) for a small studio.
6. **Review Privacy Policy v0.1 and Terms of Use v0.1** (on the site): governing law, venue / dispute resolution, liability limits, the company's postal address and data-controller details, notice periods for changes.
7. The public plot list carries an **owner code** (a short hash of the VRChat display name) for 18+ verified owners. Is that personal data under GDPR, and is the disclosure in the privacy policy enough?
8. **Public history:** earlier versions of the plot list stay in the public GitHub repository's history after a player deletes their account. Acceptable with disclosure, or should the feed branch be squashed regularly (we can do this)?
9. Under-13s: we ask for 13+ and delete accounts we learn belong to children – enough for COPPA, given we collect an email from the sign-in service?
10. Deleting an account frees the plot immediately for the next claimer (a player could "hand" a near plot to a friend at a set time). Fine to allow with the terms as written?
