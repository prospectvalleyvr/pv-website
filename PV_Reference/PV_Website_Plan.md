# PV Website & Realm Services – Plan (v1.0, Oct 31 2026)

Owners' decisions, Oct 31: build **www.ProspectValleyVR.com** fresh (not Wix), hosted on **Cloudflare**, built and maintained by Claude in code; aim for **independence from any one platform** (VRChat first, others later); privacy policy and terms are **living drafts** for the attorney; Claude sets up **"handshakes"** between projects so as much as possible runs by itself; the concierge character is **Herald** (PV_Herald.md). Domain registered at **GoDaddy**.

Companion files: PV_Data_Feed_Spec.md (v1.1), PV_World_Registry.md, PV_Soul_Scroll_Spec.md (claim codes – salts), PV_Land_Rush_and_Discovery.md, PV_Blue_Pages_Spec.md, PV_Brand_Sheet.md.

---

## 1. The idea in one picture

```
              ┌──────────────────────────── www.ProspectValleyVR.com ────────────────────────────┐
 players ───► │ pages · accounts · Claim your Homestead · map · News / Land Rush · Help (Herald)  │
              │                         Realm API (Cloudflare Workers)                            │
              │          the Realm database (Cloudflare D1): accounts, plots, claims, owners      │
              └───────────────┬────────────────────────────────────────────────┬─────────────────┘
                hourly publisher (Cron)                                read-only Realm API (JSON)
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
| Domain `prospectvalleyvr.com` | GoDaddy (registrar) – nameservers moved to Cloudflare | Owner |
| Website, Realm API, database, timers, secrets | Cloudflare (Pages, Workers, D1, Cron Triggers, Secrets) – free tier to start | Owner creates the account in the company's name |
| Website source code | private GitHub repo `prospectvalleyvr/pv-website` (**no salts in it, ever**) | Owner's GitHub; Claude works in it |
| Published feed + registry | public GitHub repo `prospectvalleyvr/realm` (GitHub Pages) – exists | Publisher pushes one commit an hour at most |
| Company email `Info@ProspectValleyVR.com` | wherever it is hosted today – **its MX records must be copied to Cloudflare before the nameserver switch** | Owner |

Secrets (claim-code salt, Blue Pages salt, land-code salt, GitHub token) live **only** in Cloudflare Secrets. They are never written into code, the repo, the feed or a chat.

## 4. Website part 1 – what gets built

**Pages (public):** Home (the Realm, the Garden, the Land Rush, a "Visit in VRChat" button) · The Realm (Lands, Wonders, eras – no lore spoilers) · Land Rush (countdown from the same `opens` time the worlds use) · News · Map (read-only: Lands → Giza parcels, coloured from `status.png`) · Help & FAQ (Herald's voice) · Contact (Info@ProspectValleyVR.com, @ProspectValleyVR) · Privacy · Terms.

**Accounts:** email sign-in (magic link, no passwords to leak) → link a **VRChat display name** (typed exactly) → **"I am 18 or older"** tick (unticked = treated as under 18: never in the public owners index, no shown name, no Blue Pages person listing).

**Claim your Homestead:**
1. Player makes a claim code at the Garden's Scroll Desk.
2. On the site: enter display name + code. The Worker checks it with the **server-side salt** (same maths as `pv_realm_tools.py hc …`): right name hash, kind = claim, date within 30 days, not used before.
3. Placement by origin + heart answer (Charter Part 7.5): the home Land's district for that heart, first free claimable plot from a fair, seeded walk – **no lottery, no paid boost**; unique plot features are shown before the player confirms.
4. Confirmed → saved; the next hourly publish puts it in the feed; the player sees "Your Homestead: GIZ-0412-0377 – visible in-world within the hour".
5. Renewal once a year with a fresh code (free). Unrenewed Homesteads return to the Crown after a grace month, with emailed reminders.

**Publisher (Cron, hourly, only when something changed):** writes changed parcel files, owners files (18+ only), `map.json`, `status.png`, `index.json` (incl. `opens`), bumps `rev`s, pushes one commit to `realm` with the GitHub API. Validates against PV_Data_Feed_Spec.md before pushing; if validation fails it pushes nothing and alerts the owner by email.

**Admin (owners only):** search players / plots, blank a name / sign / logo (takedown), set the Land Rush `opens` time, open / close claims per Land, see publisher health. Two-step sign-in.

**Off until the attorney answers:** paid plots, checkout, resale. The pages say "Homesteads are free; land sales open later" – never a promise of rising value.

## 5. Handshakes (how the projects talk without anyone carrying messages)

| Handshake | From → to | How |
|---|---|---|
| Registry | studio → every world | `registry.json` (rev'd); a world goes live by editing one entry – no re-upload of others |
| Feed | website → every world | hourly publish (above); worlds bake the URLs |
| Claim codes | world → website | player types the code (worlds can't call out) |
| Soul Scroll | world → world | player copies the code (PV_Soul_Scroll_Spec.md) |
| Realm API | website → other platforms / tools | read-only JSON: `/api/v1/lands`, `/plots/<code>`, `/owners/<hash>` (18+ only), `/status` |
| Studio status | everything → the owners and Claude | `realm/status.json` (publisher last run, feed revs, open claims, errors) + a Project doc `PV_Status.md` Claude updates each session |
| Scheduled checks | Claude | a scheduled task (owners approve) that reads `status.json` and the feed daily, and reports problems |
| Projects | Unity projects ↔ Project | `PV_Reference/` copies + CLAUDE.md + CHECKLIST in every project folder (as now) |

## 6. Privacy and safety (living drafts, attorney to review)

- Collect only: email, VRChat display name, 18+ tick, claims / plots, owner-form choices, login times. No real names unless a business listing needs them, no addresses, no birthdays, no payment data (no payments yet).
- Players 13+ (VRChat's age); under-18 / unknown-age accounts: hidden from Find an owner, no shown name, no person listings.
- Delete-my-account and download-my-data buttons; takedown within the next hourly batch.
- Cookies: sign-in only (no ad trackers). Analytics, if any, cookie-free.
- Drafts: **Privacy Policy** and **Terms of Use** written by Claude when claims are about to open, marked DRAFT – FOR ATTORNEY REVIEW, versioned in the website repo; the site shows the date of the version in force. Topics for the attorney are listed in § 9.

## 7. Build order (website)

1. **Owner setup (~20 min, with Claude's step list):** Cloudflare account → add `prospectvalleyvr.com` (Free plan) → check the DNS records it imports (keep every MX / email record) → switch the two nameservers at GoDaddy → GitHub: private repo `pv-website`; a fine-grained token for `realm` only → Cloudflare Secrets (owner pastes salts and token; Claude never sees them in chat).
2. **Claude:** site skeleton + pages + Herald help, deployed to a preview address; owner reviews.
3. Accounts + 18+ tick; admin sign-in.
4. Claim checker (test vectors from `pv_realm_tools.py`; independent review – saved data) + placement (dry run on test data).
5. Publisher → `realm` (test branch first) → Garden test world reads it (Find my home works end-to-end).
6. Privacy + Terms drafts → attorney.
7. Go-live of the site (claims closed) → Land Rush launch gate → `opens` set → claims open on the second.

## 8. What the owners do vs. what Claude does

- **Owners:** create accounts in the company's name, paste secrets, approve each go-live, decide prices / legal / anything irreversible, approve scheduled tasks.
- **Claude:** writes and tests all code, keeps docs and checklists current, deploys previews, prepares each go-live for one-click approval, runs scheduled health checks, drafts policies, writes Herald's lines.

## 9. Questions for the attorney (add to the existing list)

1. Homestead and plot wording as a **use licence** valid across platforms; what happens to plots if a platform closes.
2. Free Homesteads to players 13–17: consent, data, renewal reminders by email.
3. Land Rush "first come, first served" and unique plot features shown before purchase – confirm no lottery / gambling issue.
4. Terms for owner signs, logos and owner worlds (IP, takedown, mature content rules).
5. Data: worldwide players (GDPR / UK GDPR / CCPA basics) for a small studio.
