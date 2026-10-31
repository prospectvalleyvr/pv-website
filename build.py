#!/usr/bin/env python3
"""Prospect Valley website – builds the static pages into ./site from the page texts below.
Claude runs this; the owner never needs to. No secrets live here (they go in Cloudflare Secrets only)."""
import os, shutil, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "site")
SRC = os.path.join(ROOT, "src")
YEAR = datetime.date.today().year

NAV = [("index.html", "Home"), ("realm.html", "The Realm"), ("land-rush.html", "Land Rush"),
       ("business.html", "For business"), ("help.html", "Help"), ("contact.html", "Contact"), ("account.html", "Account")]

MARK = open(os.path.join(SRC, "assets", "pv-mark.svg"), encoding="utf-8").read().replace(
    'role="img" aria-label="Prospect Valley"', 'aria-hidden="true"')

def page(fname, title, desc, body, hero=None, scripts=False):
    nav = "".join('<a href="/%s"%s>%s</a>' % ("" if f == "index.html" else f, ' aria-current="page"' if f == fname else "", n) for f, n in NAV)
    full_title = "Prospect Valley" if fname == "index.html" else "%s · Prospect Valley" % title
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{full_title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#0f2e1c">
<link rel="icon" href="/assets/pv-mark.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/style.css">
<meta property="og:title" content="{full_title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head"><div class="wrap">
  <a class="brand" href="/">{MARK}<span>Prospect Valley</span></a>
  <nav class="nav" aria-label="Main">{nav}</nav>
</div></header>
<main id="main">
{hero or ""}
{body}
</main>
<footer class="site-foot"><div class="wrap">
  <div class="foot-grid">
    <div><h4>Prospect Valley</h4><p>A world of worlds in VRChat – a game, a Realm of land, and the PV Blue Pages directory.</p></div>
    <div><h4>Explore</h4><ul><li><a href="/realm.html">The Realm</a></li><li><a href="/land-rush.html">Land Rush</a></li><li><a href="/help.html">Help &amp; FAQ</a></li></ul></div>
    <div><h4>Business</h4><ul><li><a href="/business.html">The PV Blue Pages</a></li><li><a href="/business.html#leasing">Storefronts &amp; leasing</a></li><li><a href="/contact.html">Contact</a></li></ul></div>
    <div><h4>Contact</h4><ul><li><a href="mailto:Info@ProspectValleyVR.com">Info@ProspectValleyVR.com</a></li><li><a href="https://www.instagram.com/prospectvalleyvr/" rel="noopener">Instagram @ProspectValleyVR</a></li></ul></div>
  </div>
  <p class="fine">© {YEAR} PVVR, LLC · Prospect Valley VR · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a><br>
  VRChat is a trademark of VRChat Inc. Prospect Valley is an independent creator project and is not affiliated with or endorsed by VRChat Inc.</p>
</div></footer>
{('<script src="/assets/' + (scripts if isinstance(scripts, str) else 'site.js') + '" defer></script>') if scripts else ''}
</body>
</html>
"""

def hero(eyebrow, h1, lead, buttons="", cls="hero"):
    return f'<section class="{cls}"><div class="wrap"><p class="eyebrow">{eyebrow}</p><h1>{h1}</h1><p class="lead">{lead}</p>{buttons}</div></section>'

def herald(text):
    return f'<div class="herald"><div class="seal" aria-hidden="true">H</div><div><p class="who">Herald, your concierge</p><p>{text}</p></div></div>'

PAGES = []

# ---------------------------------------------------------------- Home
PAGES.append(("index.html", "Home",
 "Prospect Valley – a world of worlds in VRChat. Begin in the Celestial Garden, claim a free Homestead, and help shape a Realm across the ages.",
 hero("A world of worlds in VRChat", "The Realm of Prospect Valley",
      "Begin above the clouds in the Celestial Garden. Discover who you are, claim a free Homestead, and explore a gamer-scale Earth that opens Land by Land.",
      '<div class="btns"><a class="btn gold" href="/land-rush.html">The Land Rush</a><a class="btn ghost" href="/realm.html">Explore the Realm</a></div>'),
 """
<section class="block"><div class="wrap">
  <h2>Every journey begins in the Garden</h2>
  <p class="intro">A floating garden of white stone and gold light. Walk the path of three quiet tests, choose your calling, learn where you come from – and step through the Birth Gate into the Realm.</p>
  <div class="grid">
    <div class="card"><span class="tag">Begin</span><h3>The Celestial Garden</h3><p>Your character is born here: your calling, your origin, your starting strengths. Your Soul Scroll carries them to every world.</p></div>
    <div class="card"><span class="tag">Free</span><h3>A Homestead of your own</h3><p>Everyone born in the Garden can claim one free plot in their home Land. Make your claim code at the Scroll Desk and bring it here when claims open.</p></div>
    <div class="card"><span class="tag">See the World</span><h3>The World Overlook</h3><p>From the Garden's edge, look down on the Realm and the Seven Lands, find any plot, and travel by gate as each world opens.</p></div>
  </div>
</div></section>
<section class="block alt"><div class="wrap">
  <h2>Seven Lands, one Realm</h2>
  <p class="intro">At the heart of the World lies the Realm of Prospect Valley. Around it, seven starter Lands are built on the Seven Wonders of the ancient world – each in our own original design. Giza opens first.</p>
  <div class="btns"><a class="btn green" href="/realm.html">Meet the Lands</a></div>
</div></section>
<section class="block"><div class="wrap">
  <h2>For business: the PV Blue Pages</h2>
  <p class="intro">A directory of people and businesses inside the Realm – where they are, what they offer, and how to reach them. Storefronts, signage and listings, presented with care.</p>
  <div class="btns"><a class="btn green" href="/business.html">Learn more</a></div>
</div></section>
"""))

# ---------------------------------------------------------------- The Realm
LANDS = [("The Realm of Prospect Valley", "Prospect Valley Plaza and the three Rings", "The capital Land, at the heart of the World", "Opening soon"),
         ("Giza", "The Great Pyramid", "Desert sands and a great river", "Being built now"),
         ("Alexandria", "The Lighthouse", "A coast of scholars", "Planned"),
         ("Babylon", "The Hanging Gardens", "A river valley of farms and gardens", "Planned"),
         ("Olympia", "The Statue of Zeus", "Green hills and the great games", "Planned"),
         ("Ephesus", "The Temple of Artemis", "A busy trading city", "Planned"),
         ("Halicarnassus", "The Mausoleum", "A coastal city of artisans", "Planned"),
         ("Rhodes", "The Colossus", "An island harbour", "Planned")]
rows = "".join(f'<tr><td><strong>{n}</strong></td><td>{w}</td><td>{f}</td><td class="status{" now" if s.startswith("Being") else ""}">{s}</td></tr>' for n, w, f, s in LANDS)
PAGES.append(("realm.html", "The Realm",
 "The Realm of Prospect Valley and the Seven Lands – Giza, Alexandria, Babylon, Olympia, Ephesus, Halicarnassus and Rhodes.",
 hero("The World", "The Realm and the Seven Lands", "A gamer-scale Earth, opening one Land at a time. Each Land is a set of connected VRChat worlds joined by gates.", cls="hero page-hero"),
 f"""
<section class="block"><div class="wrap">
  <h2>The Lands</h2>
  <p class="intro">Lands open as they are built. Gates in every world open by themselves when a new world goes live.</p>
  <div class="table-wrap"><table class="lands"><thead><tr><th>Land</th><th>Wonder</th><th>Feel</th><th>Status</th></tr></thead><tbody>{rows}</tbody></table></div>
</div></section>
<section class="block alt"><div class="wrap">
  <h2>Ages of the World</h2>
  <p class="intro">The Modern era is where every journey starts. Discoveries in the Lands open the way to other ages – the same places, long before they became ruins.</p>
  <div class="grid">
    <div class="card"><span class="tag">Now</span><h3>Modern</h3><p>Ruins, dig sites and lost places waiting to be found.</p></div>
    <div class="card"><span class="tag">To discover</span><h3>After the Flood</h3><p>The Wonders in their glory. Reached by uncovering what the sands have hidden.</p></div>
    <div class="card"><span class="tag">Later</span><h3>More ages</h3><p>Further eras open as the story unfolds.</p></div>
  </div>
</div></section>
"""))

# ---------------------------------------------------------------- Land Rush
PAGES.append(("land-rush.html", "Land Rush",
 "The Prospect Valley Land Rush – free Homesteads, first come, first served. Countdown and how it works.",
 '<section class="hero page-hero"><div class="wrap"><p class="eyebrow">The Land Rush</p><h1>Stake your place in the Realm</h1>'
 '<div class="countdown" data-countdown aria-live="polite">Coming soon</div><p class="countdown-label" data-countdown-label>The date will be announced here, in the Garden and on Instagram @ProspectValleyVR.</p></div></section>',
 """
<section class="block"><div class="wrap">
  <h2>How it works</h2>
  <div class="grid">
    <div class="card"><span class="tag">1</span><h3>Be born in the Garden</h3><p>Finish the Celestial Garden in VRChat. At the Birth Gate the Scroll Desk gives you your claim code.</p></div>
    <div class="card"><span class="tag">2</span><h3>Bring your code here</h3><p>When the Land Rush opens, sign in, enter your VRChat display name and claim code, and receive your free Homestead in your home Land.</p></div>
    <div class="card"><span class="tag">3</span><h3>See it in-world</h3><p>Within the hour your Homestead appears on the World Overlook – use <em>Find my home</em> to see it.</p></div>
  </div>
</div></section>
<section class="block alt"><div class="wrap prose">
  <h2>Fair and simple</h2>
  <ul>
    <li><strong>Free Homesteads come first.</strong> One per player, renewed once a year with a fresh code – also free.</li>
    <li><strong>First come, first served.</strong> No draws, no entry fees, nothing reserved in advance.</li>
    <li><strong>Every plot's special features are shown before you choose</strong> – no surprises, no chance.</li>
    <li><strong>A Homestead is a licence to use your plot in the game.</strong> It is not an investment and is not sold for profit. Paid land, if offered later, will be announced separately.</li>
  </ul>
  <div class="note">Claims are not open yet. Your claim code stays valid for 30 days after you make it – if it runs out, simply make a fresh one at the Scroll Desk.</div>
</div></section>
""", True))

# ---------------------------------------------------------------- Business
PAGES.append(("business.html", "For business",
 "The PV Blue Pages – a professional directory of people and businesses in the Realm of Prospect Valley. Storefronts, signage and listings.",
 hero("For business", "The PV Blue Pages", "A directory of people and businesses inside the Realm: where they are, what they offer, and how to reach them – designed to bring you closer to the sale.", cls="hero page-hero"),
 """
<section class="block"><div class="wrap">
  <div class="grid">
    <div class="card"><span class="tag">Directory</span><h3>Listings</h3><p>Your name, services and contact details, findable from kiosks and maps across the Realm.</p></div>
    <div class="card" id="leasing"><span class="tag">Presence</span><h3>Storefronts &amp; leasing</h3><p>Distinguished spaces on Prospect Valley Plaza and in town centres – your logo, your colours, your storefront.</p></div>
    <div class="card"><span class="tag">Studio</span><h3>Build services</h3><p>Custom worlds and buildings by Prospect Valley VR, linked from your place in the Realm.</p></div>
  </div>
</div></section>
<section class="block alt"><div class="wrap prose">
  <h2>Available – limited properties</h2>
  <p>The Blue Pages open alongside the first Lands. To register your interest, or to discuss a storefront or a custom build, write to <a href="mailto:Info@ProspectValleyVR.com">Info@ProspectValleyVR.com</a>.</p>
</div></section>
"""))

# ---------------------------------------------------------------- Help (Herald)
FAQ = [
 ("What is Prospect Valley?", "<p>A connected set of VRChat worlds: a game, a Realm of land you can call home, and the PV Blue Pages directory. It begins in the Celestial Garden.</p>"),
 ("How do I start?", "<p>Visit the Celestial Garden in VRChat. Walk the path of the three tests, choose your calling and origin, answer the heart question, and step through the Birth Gate.</p><p>Herald: <em>Take your time. The Garden has been waiting a while; another minute won't hurt it.</em></p>"),
 ("What is my Soul Scroll?", "<p>A code that carries your character – calling, origin, strengths, places you've visited – from one Prospect Valley world to the next. Copy it at any Scroll Desk and read it in the next world.</p>"),
 ("How do I get a free Homestead?", "<p>Make your claim code at the Scroll Desk beside the Birth Gate. When the Land Rush opens, enter it on this website with your VRChat display name. One free Homestead per player, renewed once a year for free.</p>"),
 ("Is a Homestead an investment?", "<p>No. A Homestead is a free licence to use your plot in the game. It does not earn money and is not sold for profit.</p>"),
 ("What are PV Bucks and PV Chips?", "<p>PV Bucks are the Realm's currency for shops and markets. PV Chips are for games only – they are never sold and never swapped for anything. Nothing in the game can be cashed out for real money.</p>"),
 ("My claim code ran out.", "<p>Codes last 30 days. Visit the Scroll Desk again and make a fresh one – it's free.</p>"),
 ("Who can play?", "<p>Prospect Valley's own worlds are for everyone 13 and over, following VRChat's own age rules.</p>"),
 ("Something isn't working.", "<p>Write to <a href=\"mailto:Info@ProspectValleyVR.com\">Info@ProspectValleyVR.com</a> with the world's name and what happened.</p><p>Herald: <em>The owner records are sometimes still in the post. Even I can't hurry the post.</em></p>"),
]
faq = "".join(f'<details class="faq"><summary>{q}</summary><div class="a">{a}</div></details>' for q, a in FAQ)
PAGES.append(("help.html", "Help",
 "Help and FAQ for Prospect Valley – starting in the Celestial Garden, Soul Scrolls, free Homesteads, PV Bucks and more.",
 hero("Help &amp; FAQ", "How may I help?", "Answers to the questions travellers ask most.", cls="hero page-hero"),
 f"""
<section class="block"><div class="wrap">
  {herald("Lost? Splendid – that's how most adventures begin. Ask away; if the answer isn't below, write to us and a real person will reply.")}
  <div class="spacer"></div>
  {faq}
</div></section>
"""))

# ---------------------------------------------------------------- Contact
PAGES.append(("contact.html", "Contact",
 "Contact Prospect Valley VR – Info@ProspectValleyVR.com, Instagram @ProspectValleyVR.",
 hero("Contact", "Get in touch", "Players, partners and businesses – we'd be glad to hear from you.", cls="hero page-hero"),
 """
<section class="block"><div class="wrap">
  <div class="grid">
    <div class="card"><span class="tag">Email</span><h3><a href="mailto:Info@ProspectValleyVR.com">Info@ProspectValleyVR.com</a></h3><p>Help, Homesteads, listings, storefronts and custom builds.</p></div>
    <div class="card"><span class="tag">Instagram</span><h3><a href="https://www.instagram.com/prospectvalleyvr/" rel="noopener">@ProspectValleyVR</a></h3><p>News, Land Rush dates and first looks.</p></div>
  </div>
</div></section>
"""))

# ---------------------------------------------------------------- Privacy / Terms (interim)
PAGES.append(("privacy.html", "Privacy",
 "Prospect Valley privacy notice.",
 hero("Privacy", "Privacy", "A short, plain notice while the website is being built. A full privacy policy will be published before Homestead claims open.", cls="hero page-hero"),
 """
<section class="block"><div class="wrap prose">
  <h2>What we keep</h2>
  <p>Browsing this website collects nothing about you: no advertising, no tracking cookies, no analytics. The Land Rush page reads a public file to show the countdown and sends nothing about you.</p>
  <p>If you <strong>create an account</strong> (sign in with Discord, or Google when available), we keep only:</p>
  <ul>
    <li>the account number your sign-in provider gives us, so we recognise you next time – never your password;</li>
    <li>your email address, if your provider shares a verified one – used only for Homestead renewal reminders and replies to you;</li>
    <li>the VRChat display name you type, and whether you ticked "I am 18 or older";</li>
    <li>from a claim code you check: your origin, calling and heart answer, and the date the code was made;</li>
    <li>one sign-in cookie, which keeps you signed in for up to 30 days.</li>
  </ul>
  <p>We never sell or share this information. Players under 18 – or anyone who hasn't ticked the 18+ box – are never shown by name and can't be found by others on the public owner lists.</p>
  <h2>Your choices</h2>
  <p>On your account page you can <strong>download your data</strong> or <strong>delete your account</strong> at any time. Deleting removes it straight away.</p>
  <p>Questions: <a href="mailto:Info@ProspectValleyVR.com">Info@ProspectValleyVR.com</a></p>
</div></section>
"""))
PAGES.append(("terms.html", "Terms",
 "Prospect Valley terms of use.",
 hero("Terms", "Terms of use", "A short, plain notice while the website is in its first stage.", cls="hero page-hero"),
 """
<section class="block"><div class="wrap prose">
  <p>This website shares information about Prospect Valley, a set of worlds on VRChat. Your use of VRChat is governed by VRChat's own terms.</p>
  <p>Full terms of use – covering accounts, free Homesteads and the PV Blue Pages – will be published before Homestead claims open.</p>
  <p>Homesteads are a free licence to use a plot in the game; they are not an investment. Nothing in Prospect Valley can be cashed out for real money.</p>
</div></section>
"""))

# ---------------------------------------------------------------- Account
PAGES.append(("account.html", "Account",
 "Your Prospect Valley account – sign in, link your VRChat display name, check your Homestead claim code.",
 hero("Your account", "Your place in the Realm", "Sign in, link your VRChat display name, and check your Homestead claim code.", cls="hero page-hero"),
 """
<section class="block"><div class="wrap">
  <div id="signed-out">
    <h2>Sign in</h2>
    <p class="intro">No passwords: sign in with an account you already have. We only learn your account number and, if shared, your email.</p>
    <div class="signin-btns">
      <a class="btn discord" href="/auth/discord/login">Sign in with Discord</a>
      <a class="btn discord" aria-disabled="true" href="#">Sign in with Google (coming soon)</a>
    </div>
    <p class="msg" id="signin-msg"></p>
  </div>
  <div id="signed-in" hidden>
    <h2>Welcome</h2>
    <dl class="facts"><dt>Member since</dt><dd id="since"></dd><dt>Email</dt><dd id="email"></dd><dt>Display name</dt><dd id="verified"></dd><dt>Heart's home</dt><dd id="heart">–</dd></dl>

    <div class="card"><h3>Your VRChat display name</h3>
      <form class="form" id="profile-form">
        <label for="vrchat-name">Exactly as it appears in VRChat – capitals and spaces too</label>
        <input type="text" id="vrchat-name" maxlength="32" autocomplete="off">
        <label class="check"><input type="checkbox" id="adult"> I am 18 or older. (Leave this unticked if you're under 18 – your name will never be shown publicly.)</label>
        <button class="btn green" type="submit">Save</button>
        <p class="msg" id="profile-msg"></p>
      </form>
    </div>
    <div class="spacer"></div>
    <div class="card"><h3>Check your Homestead claim code</h3>
      <form class="form" id="code-form">
        <label for="claim-code">Make it at the Scroll Desk beside the Birth Gate in the Celestial Garden</label>
        <input type="text" id="claim-code" maxlength="40" autocomplete="off" placeholder="HC-XXXXX-XXXXX-XXXXX-XXXXX">
        <button class="btn green" type="submit">Check my code</button>
        <p class="msg" id="code-msg"></p>
      </form>
    </div>
    <div class="spacer"></div>
    <div class="card" id="home-card" hidden><span class="tag">Your Homestead</span><h3 id="home-code"></h3><p id="home-text"></p></div>
    <div class="card" id="claim-card" hidden><h3>Claim your free Homestead</h3>
      <p id="claim-intro">Check your claim code above first. Then choose your district and a plot – every plot's deposit and features are shown before you choose.</p>
      <div class="btns" id="district-btns"></div>
      <ul class="offers" id="offers"></ul>
      <p class="msg" id="claim-msg"></p>
    </div>
    <div class="spacer"></div>
    <div class="card"><h3>Your data</h3>
      <p><a href="/api/export">Download my data</a></p>
      <form method="post" action="/auth/logout"><button class="btn green" type="submit">Sign out</button></form>
    </div>
    <div class="spacer"></div>
    <div class="card danger"><h3>Delete my account</h3>
      <form class="form" id="delete-form">
        <label for="delete-confirm">Type DELETE to remove your account and everything we keep about you.</label>
        <input type="text" id="delete-confirm" maxlength="10" autocomplete="off">
        <button class="btn green" type="submit">Delete my account</button>
        <p class="msg" id="delete-msg"></p>
      </form>
    </div>
  </div>
</div></section>
""", "account.js"))

# ---------------------------------------------------------------- 404
PAGES.append(("404.html", "Page not found",
 "Page not found.",
 hero("404", "This page has wandered off", "It does that. Try the map of the Realm – it never wanders.",
      '<div class="btns"><a class="btn gold" href="/">Home</a><a class="btn ghost" href="/realm.html">The Realm</a></div>', cls="hero page-hero"),
 ""))

def build():
    if os.path.isdir(OUT): shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, "assets"))
    for f in os.listdir(os.path.join(SRC, "assets")):
        shutil.copy(os.path.join(SRC, "assets", f), os.path.join(OUT, "assets", f))
    for p in PAGES:
        fname, title, desc, h, body = p[:5]
        scripts = p[5] if len(p) > 5 else False
        with open(os.path.join(OUT, fname), "w", encoding="utf-8", newline="\n") as fh:
            fh.write(page(fname, title, desc, body, hero=h, scripts=scripts))
    # security headers for Cloudflare (Pages / Workers static assets)
    with open(os.path.join(OUT, "_headers"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write("/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n"
                 "  Permissions-Policy: camera=(), microphone=(), geolocation=()\n"
                 "  Content-Security-Policy: default-src 'self'; connect-src 'self' https://prospectvalleyvr.github.io; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'\n")
    with open(os.path.join(OUT, "robots.txt"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write("User-agent: *\nAllow: /\n")
    print("built", len(PAGES), "pages into", OUT)

if __name__ == "__main__":
    build()
