/* Squad Goals — concept prototype runtime.
   Navigation = HTMX (hx-get -> #screen, innerHTML + View Transitions).
   This file only adds: deep links (#screen), back button, Judge mode, toasts and micro-animations. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var html = document.documentElement;
  var params = new URLSearchParams(location.search);
  var SCREENS = ["home", "pay_success", "moments", "moment_detail", "squad", "drop", "recap", "unlock", "widget"];
  var phone = $("#phone"), device = $(".js-device");
  var current = null, fromPop = false, nextDir = null, timers = [];

  if (params.has("shot")) html.classList.add("shot");
  if (!document.startViewTransition) html.classList.add("no-vt");

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

  /* ---------------- Navigation helpers ---------------- */
  function load(name, opts) {
    opts = opts || {};
    if (SCREENS.indexOf(name) < 0) name = "home";
    fromPop = !!opts.pop;
    nextDir = opts.dir || "fwd";
    htmx.ajax("GET", "screens/" + name + ".html", { target: "#screen", swap: "innerHTML transition:true" });
  }
  window.SG = { load: load, setJudge: setJudge };

  document.body.addEventListener("htmx:beforeRequest", function (evt) {
    var elt = evt.detail.elt;
    var d = nextDir || (elt && elt.closest && elt.closest("[data-dir]") ? elt.closest("[data-dir]").getAttribute("data-dir") : "fwd");
    html.setAttribute("data-dir", d);
    nextDir = null;
    var m = $(".js-jmenu"); if (m) m.classList.remove("show");
  });

  document.body.addEventListener("htmx:afterSettle", function (evt) {
    if (!evt.detail.target || evt.detail.target.id !== "screen") return;
    var scr = $("#screen .scr");
    if (!scr) return;
    var name = scr.getAttribute("data-screen");
    phone.setAttribute("data-sb", scr.getAttribute("data-sb") || "dark");
    var t = $(".js-time"); if (t) t.textContent = scr.getAttribute("data-time") || "1:12";
    $$("[data-s]").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-s") === name); });
    var tpl = $("template.notes", scr), notes = $(".js-notes");
    if (notes) notes.innerHTML = tpl ? tpl.innerHTML : "—";
    if (!fromPop && current !== null) { try { history.pushState({ s: name }, "", "#" + name); } catch (e) {} }
    else if (current === null && location.hash.slice(1) !== name && location.hash) { try { history.replaceState({ s: name }, "", "#" + name); } catch (e) {} }
    fromPop = false;
    current = name;
    initScreen(scr);
  });

  document.body.addEventListener("htmx:responseError", function () { toast("Could not load screen — serve over http (see README)"); });

  window.addEventListener("popstate", function () {
    load((location.hash || "#home").slice(1), { pop: true, dir: "back" });
  });

  /* ---------------- Toast ---------------- */
  var toastTimer;
  function toast(msg) {
    var el = $(".js-toast"); if (!el) return;
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2600);
  }

  /* ---------------- Confetti / burst ---------------- */
  function confetti(host, n, ox, oy) {
    if (!host) return;
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

  /* ---------------- Per-screen micro-animations ---------------- */
  function fmtINR(n) { return "₹" + Math.round(n).toLocaleString("en-IN"); }
  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }

  function initScreen(scr) {
    timers.forEach(function (id) { clearTimeout(id); clearInterval(id); });
    timers = [];
    // fills, rings, ladders: start empty, animate to target on next frame
    later(function () {
      $$("[data-w]", scr).forEach(function (el) { el.style.width = el.getAttribute("data-w") + "%"; });
      $$("[data-h]", scr).forEach(function (el) { el.style.height = el.getAttribute("data-h") + "%"; });
      $$(".fg[data-p]", scr).forEach(function (el) {
        var p = +el.getAttribute("data-p"); el.style.strokeDashoffset = (283 * (1 - p / 100)).toFixed(1);
      });
    }, 60);
    // count-ups / price ticker (from -> to)
    $$("[data-count]", scr).forEach(function (el) {
      var to = +el.getAttribute("data-count"), from = +(el.getAttribute("data-from") || 0);
      var dur = +(el.getAttribute("data-dur") || 1100), delay = +(el.getAttribute("data-delay") || 150);
      var money = el.hasAttribute("data-inr"), suffix = el.getAttribute("data-suffix") || "";
      var start = null;
      el.textContent = (money ? fmtINR(from) : Math.round(from)) + suffix;
      later(function () {
        function step(ts) {
          if (!start) start = ts;
          var k = Math.min(1, (ts - start) / dur), e = 1 - Math.pow(1 - k, 3);
          var v = from + (to - from) * e;
          el.textContent = (money ? fmtINR(v) : Math.round(v)) + suffix;
          if (k < 1 && document.body.contains(el)) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }, delay);
    });
    // live countdown (fictional "now": Diwali in 18 days)
    var cd = $(".js-count", scr);
    if (cd) {
      var left = +cd.getAttribute("data-secs");
      var paint = function () {
        var d = Math.floor(left / 86400), h = Math.floor(left % 86400 / 3600), m = Math.floor(left % 3600 / 60), s = left % 60;
        var pad = function (x) { return (x < 10 ? "0" : "") + x; };
        $("[data-u=d]", cd).textContent = d; $("[data-u=h]", cd).textContent = pad(h);
        $("[data-u=m]", cd).textContent = pad(m); $("[data-u=s]", cd).textContent = pad(s);
      };
      paint();
      timers.push(setInterval(function () { left--; paint(); }, 1000));
    }
    if (scr.hasAttribute("data-confetti")) later(function () { confetti(scr, 90, 50, 22); }, 500);
    var ff = scr.getAttribute("data-autoreveal");
    if (ff || params.get("reveal") === "1") { var r = $("[data-act=reveal]", scr); if (r) later(function () { r.click(); }, 400); }
    if (params.get("open") === "1") { var o = $("[data-act=recap-open]", scr); if (o) later(function () { o.click(); }, 300); }
  }

  /* ---------------- Click delegation ---------------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-toast],[data-act]");
    if (!t) {
      var m = $(".js-jmenu"); if (m && !e.target.closest(".js-jmenu")) m.classList.remove("show");
      return;
    }
    if (t.hasAttribute("data-toast")) { toast(t.getAttribute("data-toast")); }
    var act = t.getAttribute("data-act");
    if (!act) return;
    var scr = $("#screen .scr");
    switch (act) {
      case "judge": setJudge(!judge, true); break;
      case "jmenu": $(".js-jmenu").classList.toggle("show"); break;
      case "toggle": {
        var sw = $(".sw", t); var on = !sw.classList.contains("on");
        sw.classList.toggle("on", on); t.setAttribute("aria-checked", on);
        $$(t.getAttribute("data-target")).forEach(function (x) { x.classList.toggle("show", on); });
        if (on) toast(t.getAttribute("data-on-msg") || "Added");
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
          $(".reveal", wrap).classList.add("show");
          confetti(wrap, 110, 50, 45);
          $$(".after", scr).forEach(function (x) { x.classList.add("show"); });
          var pre = $(".js-pre", scr); if (pre) pre.style.display = "none";
        }, 380);
        break;
      }
      case "odds": $(".odds", scr).classList.toggle("show"); break;
      case "recap-open": $(".sheet", scr).classList.add("show"); break;
      case "recap-close": $(".sheet", scr).classList.remove("show"); break;
      case "burst": confetti(scr, 80, 50, 30); break;
    }
  });
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-act],[hx-get]") && e.target.tagName !== "BUTTON") { e.preventDefault(); e.target.click(); }
    if (e.key === "j" && !e.target.matches("input,textarea")) setJudge(!judge, true);
  });

  /* ---------------- Desktop: fit the phone frame to the window ---------------- */
  function fit() {
    if (!device) return;
    if (window.innerWidth >= 900) {
      var s = Math.min(1, (window.innerHeight - 32) / 868);
      device.style.transform = s < 1 ? "scale(" + s.toFixed(3) + ")" : "";
    } else device.style.transform = "";
  }
  window.addEventListener("resize", fit); fit();

  /* ---------------- Boot ---------------- */
  load((location.hash || "#home").slice(1), { pop: true });
})();
