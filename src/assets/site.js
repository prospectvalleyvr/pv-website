// Prospect Valley – small site script: the Land Rush countdown, read from the same feed the VRChat worlds read
// (https://prospectvalleyvr.github.io/realm/feed/index.json → "opens"). No cookies, no tracking.
(function () {
  var FEED = "https://prospectvalleyvr.github.io/realm/feed/index.json";
  var el = document.querySelector("[data-countdown]");
  if (!el) return;
  var label = document.querySelector("[data-countdown-label]");
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function waiting() {
    el.textContent = "Coming soon";
    if (label) label.textContent = "The date will be announced here, in the Garden and on Instagram @ProspectValleyVR.";
  }
  function run(opens) {
    function tick() {
      var left = Math.floor((opens - Date.now()) / 1000);
      if (left <= 0) {
        el.textContent = "Open";
        if (label) label.textContent = "The Land Rush is open. Claim your free Homestead.";
        return;
      }
      var d = Math.floor(left / 86400), h = Math.floor(left / 3600) % 24, m = Math.floor(left / 60) % 60, s = left % 60;
      el.textContent = (d > 0 ? d + "d " : "") + two(h) + ":" + two(m) + ":" + two(s);
      if (label) label.textContent = "until the Land Rush opens (the same second in every world).";
      setTimeout(tick, 1000);
    }
    tick();
  }
  fetch(FEED, { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (j) {
      var t = j && j.format === "pv-feed-1" && typeof j.opens === "string" ? Date.parse(j.opens) : NaN;
      if (isNaN(t)) waiting(); else run(t);
    })
    .catch(waiting);
})();
