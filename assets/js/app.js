/* Squad Goals — concept prototype runtime.
   Navigation = HTMX (hx-get -> #screen, innerHTML + View Transitions).
   This file only adds: deep links (#screen), back button, Judge mode, toasts, micro-animations,
   keyboard access, the simulated payment step and the VPN soft notice. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var html = document.documentElement;
  var params = new URLSearchParams(location.search);
  var SCREENS = ["home", "pay_success", "moments", "moment_detail", "squad", "drop", "recap", "unlock", "widget",
    /* More flows */ "invite", "streak", "pay_failed", "onboarding", "settings", "rules"];
  var phone = $("#phone"), device = $(".js-device");
  var current = null, fromPop = false, nextDir = null, timers = [], histIdx = 0;
  var rmq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reduced() { return !!(rmq && rmq.matches); }
  var vpnOn = params.get("vpn") === "1", vpnDismissed = false, paying = false;

  if (params.has("shot")) html.classList.add("shot");
  if (!document.startViewTransition) html.classList.add("no-vt");

  /* ---------------- Session memory (A8: count-ups play once per session) ---------------- */
  var seen = {};
  function wasSeen(k) {
    if (seen[k]) return true;
    try { if (sessionStorage.getItem("sg-cu:" + k)) return true; } catch (e) {}
    return false;
  }
  function markSeen(k) { seen[k] = 1; try { sessionStorage.setItem("sg-cu:" + k, "1"); } catch (e) {} }

  /* ---------------- Judge mode ---------------- */
  var judge = false;
  try { judge = localStorage.getItem("sg-judge") === "1"; } catch (e) {}
  if (params.has("judge")) judge = params.get("judge") === "1";
  function setJudge(on, save) {
    judge = !!on;
    html.classList.toggle("judge", judge);
    $$(".js-judge-sw").forEach(function (s) { s.classList.toggle("on", judge); });
    $$("[data-act=judge][role=switch]").forEach(function (s) { s.setAttribute("aria-checked", judge); });
    var fab = $(".js-jfab"); if (fab) fab.classList.toggle("on", judge);
    if (save) { try { localStorage.setItem("sg-judge", judge ? "1" : "0"); } catch (e) {} }
  }
  setJudge(judge, false);

  function menu(open) {
    var m = $(".js-jmenu"), f = $(".js-jfab"); if (!m) return;
    var on = open == null ? !m.classList.contains("show") : !!open;
    m.classList.toggle("show", on);
    if (f) f.setAttribute("aria-expanded", on ? "true" : "false");
  }

  /* ---------------- Navigation helpers ---------------- */
  function load(name, opts) {
    opts = opts || {};
    if (name === "vpn") { vpnOn = true; vpnDismissed = false; name = "home"; }
    if (SCREENS.indexOf(name) < 0) name = "home";
    fromPop = !!opts.pop;
    nextDir = opts.dir || "fwd";
    menu(false);
    htmx.ajax("GET", "screens/" + name + ".html", { target: "#screen", swap: "innerHTML transition:true" });
  }
  // E3: back = browser history when there is in-app history, else the element's hx-get, else Home
  function goBack(fallback) {
    if (histIdx > 0) { history.back(); return; }
    load(fallback || "home", { dir: "back" });
  }
  window.SG = { load: load, setJudge: setJudge, back: goBack };

  function screenOf(path) { var m = /screens\/([\w-]+)\.html/.exec(path || ""); return m ? m[1] : null; }

  // htmx:confirm lets us intercept hx-get clicks before the request goes out
  document.body.addEventListener("htmx:confirm", function (evt) {
    var elt = evt.detail && evt.detail.elt; if (!elt || !elt.getAttribute) return;
    var target = screenOf(elt.getAttribute("hx-get"));
    // E3: data-act="back" with an hx-get fallback
    if (elt.getAttribute("data-act") === "back" && histIdx > 0) { evt.preventDefault(); history.back(); return; }
    // B3: on Home, every "pay" entry point shows a short simulated payment step first
    if (current === "home" && target === "pay_success" && !elt.closest(".js-slist,.js-mlist")) {
      evt.preventDefault();
      if (paying) return;
      paying = true;
      toast("Paying ₹60 to Sharma Canteen…", { busy: true, ms: 1500 });
      setTimeout(function () { paying = false; evt.detail.issueRequest(true); }, reduced() ? 350 : 1150);
    }
  });

  document.body.addEventListener("htmx:beforeRequest", function (evt) {
    var elt = evt.detail.elt;
    var d = nextDir || (elt && elt.closest && elt.closest("[data-dir]") ? elt.closest("[data-dir]").getAttribute("data-dir") : "fwd");
    if (elt && elt.getAttribute && elt.getAttribute("data-act") === "back") d = "back";
    html.setAttribute("data-dir", d);
    nextDir = null;
    menu(false);
  });

  document.body.addEventListener("htmx:afterSettle", function (evt) {
    if (!evt.detail.target || evt.detail.target.id !== "screen") return;
    var scr = $("#screen .scr");
    if (!scr) return;
    var name = scr.getAttribute("data-screen");
    phone.setAttribute("data-sb", scr.getAttribute("data-sb") || "dark");
    var t = $(".js-time"); if (t) t.textContent = scr.getAttribute("data-time") || "1:12";
    $$("[data-s]").forEach(function (a) {
      var on = a.getAttribute("data-s") === name;
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    var tpl = $("template.notes", scr), notes = $(".js-notes");
    if (notes) notes.innerHTML = tpl ? tpl.innerHTML : "—";
    try {
      if (!fromPop && current !== null) { histIdx++; history.pushState({ s: name, i: histIdx }, "", "#" + name); }
      else if (current === null) {
        histIdx = 0;
        if (location.hash && location.hash.slice(1) !== name) history.replaceState({ s: name, i: 0 }, "", "#" + name);
        else history.replaceState({ s: name, i: 0 }, "");
      } else histIdx = (history.state && history.state.i) || 0;
    } catch (e) {}
    fromPop = false;
    var first = current === null;
    current = name;
    initScreen(scr);
    focusTitle(scr, first);
  });

  document.body.addEventListener("htmx:responseError", function () { toast("Could not load screen — serve over http (see README)"); });

  window.addEventListener("popstate", function (e) {
    histIdx = (e.state && e.state.i) || 0;
    load((location.hash || "#home").slice(1), { pop: true, dir: "back" });
  });

  /* ---------------- Toast ---------------- */
  var toastTimer;
  function toast(msg, o) {
    o = o || {};
    var el = $(".js-toast"); if (!el) return;
    el.textContent = msg; el.classList.toggle("busy", !!o.busy); el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, o.ms || 2600);
  }

  /* ---------------- Confetti / burst ---------------- */
  function confetti(host, n, ox, oy) {
    if (!host || reduced()) return;
    var box = document.createElement("div"); box.className = "confetti";
    var colors = ["#8800EC", "#FFC53D", "#FF7A1A", "#0E9F6E", "#E5197E", "#5B7BE8", "#FFFFFF", "#B26BFF"];
    for (var i = 0; i < (n || 70); i++) {
      var s = document.createElement("i");
      var ang = Math.random() * Math.PI * 2, dist = 90 + Math.random() * 190;
      s.style.setProperty("--x", (ox == null ? 50 : ox) + "%");
      s.style.setProperty("--y", (oy == null ? 35 : oy) + "%");
      s.style.setProperty("--dx", Math.round(Math.cos(ang) * dist) + "px");
      s.style.setProperty("--dy", Math.round(Math.sin(ang) * dist + 140) + "px");
      s.style.setProperty("--r", Math.round(Math.random() * 720 - 360) + "deg");
      s.style.setProperty("--c", colors[i % colors.length]);
      s.style.setProperty("--w", (5 + Math.random() * 6).toFixed(1) + "px");
      s.style.setProperty("--h", (7 + Math.random() * 9).toFixed(1) + "px");
      s.style.setProperty("--t", (1.3 + Math.random() * 1.1).toFixed(2) + "s");
      s.style.setProperty("--dl", (Math.random() * 0.15).toFixed(2) + "s");
      if (Math.random() < 0.3) s.className = "rd";
      box.appendChild(s);
    }
    host.appendChild(box);
    setTimeout(function () { box.remove(); }, 2800);
  }

  /* ---------------- E10: keyboard reach + focus ---------------- */
  function makeFocusable(root) {
    if (!root) return;
    $$("[hx-get],[data-toast],[data-act]", root).forEach(function (e) {
      if (e.matches("button,a[href],input,select,textarea,.sw")) return;
      if (!e.hasAttribute("tabindex")) e.tabIndex = 0;
      if (!e.hasAttribute("role")) e.setAttribute("role", "button");
    });
  }
  function focusTitle(scr, first) {
    var h = $("[data-title]", scr) || $("h1", scr) || $(".topbar .t", scr) || $("h2", scr) || $(".mhero .ttl", scr) || $(".paid-to", scr);
    if (!h || first) return;
    if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1");
    try { h.focus({ preventScroll: true }); } catch (e) {}
  }

  /* ---------------- B6: VPN soft notice (injected on Home; no app exit) ---------------- */
  var VPN_HTML =
    '<span class="jm"><b class="k-guard">Guardrail</b>Soft notice, not an app exit</span>' +
    '<span class="vi" aria-hidden="true"><svg class="ic"><use href="assets/icons/sprite.svg#i-info"/></svg></span>' +
    '<div style="flex:1;min-width:0"><div class="t1">VPN is on — payments may fail</div>' +
    '<div class="t2">Some banks block UPI over a VPN. You can keep using Neu; if a payment fails, your streak is safe.</div>' +
    '<div class="row"><button class="pill sm vpn-ok" data-act="vpn-ok">Continue</button><button class="pill sm vpn-off" data-act="vpn-off">Turn off VPN</button></div></div>' +
    '<button class="x" data-act="vpn-ok" aria-label="Dismiss VPN notice"><svg class="ic"><use href="assets/icons/sprite.svg#i-x"/></svg></button>';
  function injectVpn(scr) {
    if (!vpnOn || vpnDismissed || $(".vpn", scr)) return;
    var el = document.createElement("div");
    el.className = "vpn jm-host"; el.setAttribute("role", "status"); el.innerHTML = VPN_HTML;
    var hero = $(".hero", scr), body = $(".scr-body", scr);
    if (hero && hero.parentNode) hero.parentNode.insertBefore(el, hero.nextSibling);
    else if (body) body.insertBefore(el, body.firstChild);
    else return;
    if (body) body.scrollTop = 0;
  }
  function hideVpn() {
    vpnDismissed = true;
    var v = $("#screen .vpn"); if (!v) return;
    v.style.transition = "opacity .2s"; v.style.opacity = "0";
    setTimeout(function () { v.remove(); }, reduced() ? 0 : 220);
  }

  /* ---------------- Per-screen micro-animations ---------------- */
  function fmtINR(n) { return "₹" + Math.round(n).toLocaleString("en-IN"); }
  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }

  function initScreen(scr) {
    timers.forEach(function (id) { clearTimeout(id); clearInterval(id); });
    timers = [];
    var name = scr.getAttribute("data-screen");
    makeFocusable(scr);
    if (name === "home") injectVpn(scr);
    // fills, rings, ladders: start empty, animate to target on next frame
    later(function () {
      $$("[data-w]", scr).forEach(function (el) { el.style.width = el.getAttribute("data-w") + "%"; });
      $$("[data-h]", scr).forEach(function (el) { el.style.height = el.getAttribute("data-h") + "%"; });
      $$(".fg[data-p]", scr).forEach(function (el) {
        var p = +el.getAttribute("data-p"); el.style.strokeDashoffset = (283 * (1 - p / 100)).toFixed(1);
      });
    }, 60);
    // count-ups / price ticker (from -> to). A8: each one plays once per session; E9: none under reduced motion
    $$("[data-count]", scr).forEach(function (el, i) {
      var to = +el.getAttribute("data-count"), from = +(el.getAttribute("data-from") || 0);
      var dur = +(el.getAttribute("data-dur") || 1100), delay = +(el.getAttribute("data-delay") || 150);
      var money = el.hasAttribute("data-inr"), suffix = el.getAttribute("data-suffix") || "";
      var fmt = function (v) { return (money ? fmtINR(v) : Math.round(v)) + suffix; };
      var key = name + ":" + i + ":" + from + ">" + to;
      if (reduced() || wasSeen(key)) { el.textContent = fmt(to); return; }
      markSeen(key);
      var start = null;
      el.textContent = fmt(from);
      later(function () {
        function step(ts) {
          if (!start) start = ts;
          var k = Math.min(1, (ts - start) / dur), e = 1 - Math.pow(1 - k, 3);
          el.textContent = fmt(from + (to - from) * e);
          if (k < 1 && document.body.contains(el)) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }, delay);
    });
    // live countdown
    var cd = $(".js-count", scr);
    if (cd) {
      var left = +cd.getAttribute("data-secs");
      var paint = function () {
        var d = Math.floor(left / 86400), h = Math.floor(left % 86400 / 3600), m = Math.floor(left % 3600 / 60), s = left % 60;
        var pad = function (x) { return (x < 10 ? "0" : "") + x; };
        var u = function (k, v) { var x = $("[data-u=" + k + "]", cd); if (x) x.textContent = v; };
        u("d", d); u("h", pad(h)); u("m", pad(m)); u("s", pad(s));
      };
      paint();
      timers.push(setInterval(function () { left--; paint(); }, 1000));
    }
    if (scr.hasAttribute("data-confetti")) later(function () { confetti(scr, 90, 50, 22); }, 500);
    var ff = scr.getAttribute("data-autoreveal");
    if (ff || params.get("reveal") === "1") { var r = $("[data-act=reveal]", scr); if (r) later(function () { r.click(); }, 400); }
    if (params.get("open") === "1") { var o = $("[data-act=recap-open]", scr); if (o) later(function () { o.click(); }, 300); }
    // ?tab=<panel> opens a variant (e.g. #streak with ?tab=missed, #invite with ?tab=web)
    var tab = params.get("tab");
    if (tab && $('[data-act=tab][data-tab="' + tab + '"]', scr)) setTab(scr, tab);
  }

  function setTab(scr, key) {
    $$(".seg [data-act=tab]", scr).forEach(function (b) {
      var on = b.getAttribute("data-tab") === key;
      b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false");
    });
    var sb = null;
    $$("[data-panel]", scr).forEach(function (p) {
      var on = p.getAttribute("data-panel") === key;
      p.classList.toggle("on", on);
      if (on && p.getAttribute("data-sb")) sb = p.getAttribute("data-sb");
    });
    if (sb) phone.setAttribute("data-sb", sb);
    var body = $(".scr-body", scr); if (body) body.scrollTop = 0;
  }

  /* ---------------- Click delegation ---------------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-toast],[data-act]");
    if (!t) {
      if (!e.target.closest(".js-jmenu")) menu(false);
      return;
    }
    if (t.hasAttribute("data-toast")) { toast(t.getAttribute("data-toast")); }
    var act = t.getAttribute("data-act");
    if (!act) return;
    var scr = $("#screen .scr");
    switch (act) {
      case "judge": setJudge(!judge, true); break;
      case "jmenu": menu(); break;
      case "back": if (!t.hasAttribute("hx-get")) goBack(screenOf(t.getAttribute("data-fallback"))); break;
      case "vpn": {
        vpnOn = true; vpnDismissed = false; menu(false);
        if (current === "home" && scr) { injectVpn(scr); makeFocusable(scr); toast("VPN detected: soft notice instead of closing the app"); }
        else load("home");
        break;
      }
      case "vpn-ok": hideVpn(); toast("OK. If a payment fails, we'll say so, and your streak stays safe"); break;
      case "vpn-off": hideVpn(); toast("Opens your phone's VPN settings (prototype)"); break;
      case "toggle": {
        var sw = $(".sw", t); if (!sw) break;
        var on = !sw.classList.contains("on");
        sw.classList.toggle("on", on); t.setAttribute("aria-checked", on);
        var sel = t.getAttribute("data-target");
        if (sel) $$(sel).forEach(function (x) { x.classList.toggle("show", on); });
        if (on) toast(t.getAttribute("data-on-msg") || "Added");
        else if (t.getAttribute("data-off-msg")) toast(t.getAttribute("data-off-msg"));
        break;
      }
      case "tab": if (scr) setTab(scr, t.getAttribute("data-tab")); break;
      case "pick": {
        var picked = t.getAttribute("aria-checked") !== "true";
        t.setAttribute("aria-checked", picked ? "true" : "false");
        toast(t.getAttribute(picked ? "data-on-msg" : "data-off-msg") || (picked ? "Added" : "Removed"));
        var meter = $(".js-act", scr);
        if (meter) {
          var n = $$(".pick[aria-checked=true]", scr).length;
          meter.innerHTML = n ? "<b>✓ Activation ready</b> · " + n + " of 2 picked" : "Pick at least one to activate";
        }
        break;
      }
      case "verify": {
        if (t.classList.contains("done")) break;
        t.classList.add("done");
        t.innerHTML = '<svg class="ic"><use href="assets/icons/sprite.svg#i-check"/></svg>Link sent to your college email';
        toast("1-tap link sent to your college email (prototype)");
        break;
      }
      case "otp": {
        if (t.classList.contains("done")) break;
        t.classList.add("done");
        toast("OTP sent to +91 ••••• •••10 · one step, no forms (prototype)", { busy: true, ms: 1600 });
        later(function () {
          var d = $(".otp-done", scr); if (d) d.classList.add("show");
          t.innerHTML = 'Open Tata Neu <svg class="ic" style="width:16px;height:16px"><use href="assets/icons/sprite.svg#i-chev"/></svg>';
          toast("You're in the squad. Your first Neu UPI payment adds +10% for everyone");
        }, reduced() ? 300 : 1500);
        break;
      }
      case "view-plan": {
        var plan = $("[data-plan]", scr);
        if (plan) plan.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
        toast("View only: no app or sign-up needed to see the plan");
        break;
      }
      case "pay-retry": {
        if (paying) break;
        paying = true;
        toast("Retrying ₹60 to Sharma Canteen…", { busy: true, ms: 1500 });
        setTimeout(function () { paying = false; load("pay_success"); }, reduced() ? 350 : 1150);
        break;
      }
      case "leave": {
        if (t.classList.contains("done")) break;
        if (!t.classList.contains("arm")) {
          t.classList.add("arm"); t.textContent = "Tap again to leave · your coins stay";
          break;
        }
        t.classList.remove("arm"); t.classList.add("done");
        t.textContent = "You've left Squad Goals · rejoin anytime";
        toast("Left Squad Goals. Coins and any booked trips stay yours (prototype)");
        break;
      }
      case "lockfare": {
        if (t.classList.contains("done")) break;
        t.classList.add("done");
        t.innerHTML = '<svg class="ic"><use href="assets/icons/sprite.svg#i-check"/></svg> Fare locked at ₹3,240 for 7 days';
        toast("Fare locked for 7 days (prototype — nothing is charged)");
        break;
      }
      case "nudge": t.textContent = "Nudged ✓"; t.classList.add("done"); toast("Meera gets a WhatsApp nudge (prototype)"); break;
      case "reveal": {
        if (t.classList.contains("open")) break;
        t.classList.add("open");
        var wrap = t.closest(".box-wrap");
        later(function () {
          var rv = $(".reveal", wrap); if (rv) rv.classList.add("show");
          confetti(wrap, 110, 50, 45);
          $$(".after", scr).forEach(function (x) { x.classList.add("show"); });
          var pre = $(".js-pre", scr); if (pre) pre.style.display = "none";
        }, reduced() ? 0 : 380);
        break;
      }
      case "odds": { var od = $(".odds", scr); if (od) od.classList.toggle("show"); break; }
      case "recap-open": { var sh = $(".sheet", scr); if (sh) sh.classList.add("show"); break; }
      case "recap-close": { var sc = $(".sheet", scr); if (sc) sc.classList.remove("show"); break; }
      case "burst": confetti(scr, 80, 50, 30); break;
    }
  });

  document.addEventListener("keydown", function (e) {
    var tg = e.target;
    var typing = tg && tg.matches && tg.matches("input,textarea,select,[contenteditable]");
    if ((e.key === "Enter" || e.key === " ") && tg.matches && tg.matches("[data-act],[hx-get],[data-toast]") && !tg.matches("button,a[href]")) {
      e.preventDefault(); tg.click(); return;
    }
    if (e.key === "Escape") { menu(false); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "j" || e.key === "J") { setJudge(!judge, true); return; }
    // B10: left/right arrows step through the screen list on desktop
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && window.innerWidth >= 900) {
      var i = SCREENS.indexOf(current); if (i < 0) i = 0;
      var n = SCREENS.length, fwd = e.key === "ArrowRight";
      e.preventDefault();
      load(SCREENS[(i + (fwd ? 1 : -1) + n) % n], { dir: fwd ? "fwd" : "back" });
    }
  });

  /* ---------------- E1: JM button hides while scrolling down, returns on scroll up / at top ---------------- */
  var lastY = 0;
  document.addEventListener("scroll", function (e) {
    var el = e.target; if (!el || !el.classList || !el.classList.contains("scr-body")) return;
    var f = $(".js-jfab"), m = $(".js-jmenu"); if (!f || (m && m.classList.contains("show"))) return;
    var y = el.scrollTop;
    f.classList.toggle("hid", y > 40 && y > lastY);
    lastY = y;
  }, true);
  document.body.addEventListener("htmx:afterSettle", function () { lastY = 0; var f = $(".js-jfab"); if (f) f.classList.remove("hid"); });

  /* ---------------- E6: fit the phone frame to the window (scale floor 0.85) ---------------- */
  var FLOOR = 0.85;
  function fit() {
    if (!device) return;
    if (window.innerWidth >= 900) {
      var avail = window.innerHeight - 32, s = avail / 868, ph = 844;
      if (s < FLOOR) { s = FLOOR; ph = Math.max(560, Math.floor(avail / FLOOR - 24)); }
      s = Math.min(1, s);
      phone.style.setProperty("--ph", ph + "px");
      if (s < 1) {
        var w = device.offsetWidth || 414, h = ph + 24;
        device.style.transform = "scale(" + s.toFixed(3) + ")";
        device.style.margin = (-(1 - s) * h / 2).toFixed(1) + "px " + (-(1 - s) * w / 2).toFixed(1) + "px";
      } else { device.style.transform = ""; device.style.margin = ""; }
    } else {
      device.style.transform = ""; device.style.margin = "";
      phone.style.removeProperty("--ph");
    }
  }
  window.addEventListener("resize", fit); fit();

  /* ---------------- Boot ---------------- */
  makeFocusable($(".panel"));
  makeFocusable($(".js-jmenu"));
  load((location.hash || "#home").slice(1), { pop: true });
})();
