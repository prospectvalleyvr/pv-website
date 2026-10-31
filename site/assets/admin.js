// Prospect Valley – the owner's admin page. Talks only to this site's /api/admin addresses.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var NAMES = { "west-desert": "West Desert", "east-desert": "East Desert", "nile-valley": "Nile Valley", "oasis": "Sandsea Oasis" };
  var current = "closed";
  function post(path, data) {
    return fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data || {}), credentials: "same-origin" })
      .then(function (r) { return r.json().catch(function () { return { ok: false, message: "Something went wrong." }; }); });
  }
  function say(el, msg, good) { el.textContent = msg; el.className = "msg " + (good ? "good" : "bad"); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function toLocalInput(iso) { if (!iso) return ""; var d = new Date(iso); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function fmt(iso) { return iso ? new Date(iso).toLocaleString() : "never"; }
  function mode() { var r = document.querySelector('input[name="mode"]:checked'); return r ? r.value : "closed"; }
  function isPublic(m) { return m === "open" || m === "auto"; }
  function updateConfirm() { $("confirm-box").hidden = !(!isPublic(current) && isPublic(mode())); }

  function load() {
    fetch("/api/admin/status", { credentials: "same-origin" }).then(function (r) {
      if (r.status === 401) { location.href = "/account.html"; return null; }
      return r.json();
    }).then(function (s) {
      if (!s) return;
      $("admin-msg").textContent = "";
      if (!s.admin) { $("not-admin").hidden = false; $("admin-key").textContent = s.key || "(no sign-in found)"; return; }
      $("admin").hidden = false;
      current = s.settings.claimsMode;
      var radio = document.querySelector('input[name="mode"][value="' + current + '"]'); if (radio) radio.checked = true;
      $("opens").value = toLocalInput(s.settings.opens);
      $("confirm").value = ""; updateConfirm();
      $("state-line").textContent = "Right now claims are " + (s.settings.claimsOpenNow ? "OPEN" : current === "admins" ? "open to admins only" : "closed") +
        (s.settings.opens ? " · opening time " + fmt(s.settings.opens) : " · no opening time set");
      var f = s.feed;
      $("feed-line").textContent = (f.enabled ? "Publishing on" : "Publishing OFF") + " · branch " + f.branch + " · rev " + f.rev +
        " · last published " + fmt(f.lastPublish) + " · " + f.waiting + " change(s) waiting · worlds see claims " + (f.claimsInFeed || "–") +
        ". Runs by itself every 15 minutes.";
      var rows = $("home-rows"); rows.textContent = "";
      s.homesteads.forEach(function (h) {
        var tr = document.createElement("tr");
        [NAMES[h.district] || h.district, String(h.claimed), h.size.toLocaleString()].forEach(function (t) { var td = document.createElement("td"); td.textContent = t; tr.appendChild(td); });
        rows.appendChild(tr);
      });
      $("acct-line").textContent = s.accounts.total + " accounts · " + s.accounts.verified + " verified names · " + s.accounts.adults + " ticked 18+";
      var log = $("log"); log.textContent = "";
      s.log.forEach(function (l) { var li = document.createElement("li"); li.textContent = fmt(l.at) + " – " + l.action + (l.detail ? " (" + l.detail + ")" : ""); log.appendChild(li); });
      if (!s.log.length) { var li = document.createElement("li"); li.textContent = "None yet."; log.appendChild(li); }
    }).catch(function () { say($("admin-msg"), "Couldn't load the admin data.", false); });
  }

  document.querySelectorAll('input[name="mode"]').forEach(function (r) { r.addEventListener("change", updateConfirm); });
  $("settings-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("opens").value, iso = "";
    if (v) { var d = new Date(v); if (isNaN(d)) { say($("settings-msg"), "That date and time isn't valid.", false); return; } iso = d.toISOString().replace(/\.\d+Z$/, "Z"); }
    post("/api/admin/settings", { claimsMode: mode(), opens: iso, confirm: $("confirm").value.trim() }).then(function (r) {
      say($("settings-msg"), r.message, r.ok); if (r.ok) load();
    });
  });
  $("publish-btn").addEventListener("click", function () {
    say($("publish-msg"), "Publishing…", true);
    post("/api/admin/publish", {}).then(function (r) { say($("publish-msg"), r.message, r.ok); load(); });
  });
  load();
})();
