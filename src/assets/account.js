// Prospect Valley – the account page. Talks only to this site's own /api and /auth addresses. No tracking.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var HEARTS = ["Desert sands", "A great river", "The open sea", "Green hills", "A busy city", "A quiet garden", "An island harbour", "A workshop by the sea"];
  function post(path, data) {
    return fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data || {}), credentials: "same-origin" })
      .then(function (r) { return r.json().catch(function () { return { ok: false, message: "Something went wrong." }; }); });
  }
  function say(el, msg, good) { el.textContent = msg; el.className = "msg " + (good ? "good" : "bad"); }
  function show(signedIn) { $("signed-out").hidden = signedIn; $("signed-in").hidden = !signedIn; }

  var err = new URLSearchParams(location.search).get("error");
  var why = new URLSearchParams(location.search).get("why");
  if (err) say($("signin-msg"), "Sign-in didn't finish. Please try again." + (why ? " (" + why.replace(/[^a-z0-9_]/gi, "") + ")" : ""), false);

  fetch("/api/me", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (me) {
    if (!me.signedIn) { show(false); return; }
    show(true);
    var a = me.account;
    $("vrchat-name").value = a.vrchatName;
    $("adult").checked = a.adult;
    $("since").textContent = a.since;
    $("email").textContent = a.email || "not shared";
    $("verified").textContent = a.nameVerified ? "Verified by your claim code" : "Not verified yet – check a claim code below";
    if (a.heart !== null && a.heart !== undefined) $("heart").textContent = HEARTS[a.heart] || "";
    if (me.homestead) showHome(me.homestead);
    else if (me.claimsOpen && me.districts && me.districts.length) showClaim(me.districts);
  }).catch(function () { show(false); });

  var DISTRICT_NAMES = { "west-desert": "West Desert", "east-desert": "East Desert", "nile-valley": "Nile Valley", "oasis": "Sandsea Oasis" };
  function showHome(h) {
    $("home-card").hidden = false; $("claim-card").hidden = true;
    $("home-code").textContent = h.code;
    $("home-text").textContent = "Giza · " + (DISTRICT_NAMES[h.district] || h.district) + " · parcel " + h.parcel + " · " + h.metresFromPyramid +
      " m from the Great Pyramid · " + h.richness + " " + h.deposit + (h.feature ? " · " + h.feature + (h.relic ? " (" + h.relic + ")" : "") : "") +
      ". Renew by " + h.renewBy + " with a fresh code – it's free.";
  }
  function showClaim(districts) {
    $("claim-card").hidden = false;
    var box = $("district-btns"); box.textContent = "";
    districts.forEach(function (d, i) {
      var b = document.createElement("button"); b.type = "button"; b.className = "btn small"; b.textContent = DISTRICT_NAMES[d] || d;
      b.addEventListener("click", function () {
        [].forEach.call(box.children, function (c) { c.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true"); loadOffers(d);
      });
      box.appendChild(b);
      if (i === 0) b.click();
    });
  }
  function loadOffers(d) {
    var list = $("offers"); list.textContent = "Loading…";
    fetch("/api/offers?district=" + encodeURIComponent(d), { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (r) {
      list.textContent = "";
      if (!r.ok) { say($("claim-msg"), r.message, false); return; }
      r.plots.forEach(function (p) {
        var li = document.createElement("li");
        var left = document.createElement("div");
        var code = document.createElement("div"); code.className = "code"; code.textContent = p.code;
        var meta = document.createElement("div"); meta.className = "meta";
        meta.textContent = "Parcel " + p.parcel + " · " + p.metresFromPyramid + " m from the Great Pyramid · " + p.richness + " " + p.deposit;
        left.appendChild(code); left.appendChild(meta);
        if (p.feature) { var f = document.createElement("div"); f.className = "feat"; f.textContent = p.feature + (p.relic ? " – " + p.relic : ""); left.appendChild(f); }
        var b = document.createElement("button"); b.type = "button"; b.className = "btn green small"; b.textContent = "Claim this plot";
        b.addEventListener("click", function () { claimPlot(p.key, d); });
        li.appendChild(left); li.appendChild(b); list.appendChild(li);
      });
    });
  }
  function claimPlot(key, d) {
    var code = $("claim-code").value;
    if (!code.trim()) { say($("claim-msg"), "Paste your claim code in the box above first.", false); return; }
    post("/api/claim", { code: code, key: key }).then(function (r) {
      say($("claim-msg"), r.message, r.ok);
      if (r.ok && r.homestead) showHome(r.homestead); else loadOffers(d);
    });
  }

  $("profile-form").addEventListener("submit", function (e) {
    e.preventDefault();
    post("/api/profile", { vrchatName: $("vrchat-name").value, adult: $("adult").checked }).then(function (r) {
      say($("profile-msg"), r.message || (r.ok ? "Saved." : "Not saved."), r.ok);
    });
  });
  $("code-form").addEventListener("submit", function (e) {
    e.preventDefault();
    post("/api/check-code", { code: $("claim-code").value }).then(function (r) {
      if (!r.ok) { say($("code-msg"), r.message, false); return; }
      say($("code-msg"), r.message + " Origin: " + r.origin + " · Calling: " + r.calling + " · Heart: " + (HEARTS[r.heart] || "") + " · Made " + r.made + ".", true);
      $("verified").textContent = "Verified by your claim code";
      $("heart").textContent = HEARTS[r.heart] || "–";
    });
  });
  $("delete-form").addEventListener("submit", function (e) {
    e.preventDefault();
    post("/api/delete", { confirm: $("delete-confirm").value.trim() }).then(function (r) {
      say($("delete-msg"), r.message, r.ok);
      if (r.ok) setTimeout(function () { location.href = "/"; }, 1500);
    });
  });
})();
