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
  }).catch(function () { show(false); });

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
