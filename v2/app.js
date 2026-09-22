/* Website behaviour: audio, saved progress, loading feedback. No framework, no dependencies. */
(function () {
  "use strict";
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem("h24." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("h24." + k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- loading feedback ---------- */
  function done() { var b = document.getElementById("bar"); if (b) b.classList.add("done"); }
  addEventListener("load", done); setTimeout(done, 8000);
  addEventListener("load", function (e) { var t = e.target; if (t && t.tagName === "IMG") t.classList.add("is-loaded"); }, true);
  function sweep() {
    document.querySelectorAll("img:not(.is-loaded)").forEach(function (i) {
      if (i.complete && i.naturalWidth) i.classList.add("is-loaded");
      else i.addEventListener("load", function () { i.classList.add("is-loaded"); }, { once: true });
    });
  }
  document.addEventListener("DOMContentLoaded", sweep); addEventListener("load", sweep);

  /* ---------- voice ---------- */
  var voice = LS.get("voice", "m");
  function paintVoice() {
    document.querySelectorAll("[data-voice]").forEach(function (b) { b.classList.toggle("on", b.dataset.voice === voice); });
  }
  window.setVoice = function (v) { voice = v; LS.set("voice", v); paintVoice(); stop(); };
  document.addEventListener("DOMContentLoaded", paintVoice);

  /* ---------- audio ---------- */
  var audio = null, cur = null, queue = null, synth = window.speechSynthesis, base = document.documentElement.dataset.audioBase || "audio/";   /* the audio lives above the site folder */
  function clearState() {
    document.querySelectorAll(".playing,.buffering").forEach(function (e) { e.classList.remove("playing", "buffering"); });
  }
  function stop() {
    queue = null;
    if (audio) { audio.onended = audio.onerror = audio.onplaying = null; audio.pause(); }
    if (synth) synth.cancel();
    clearState(); cur = null;
  }
  window.stopAudio = stop;
  function speak(text, then) {
    if (!synth || !text) { then && then(); return; }
    var u = new SpeechSynthesisUtterance(text); u.lang = "ar-SA"; u.rate = .8;
    var vs = synth.getVoices().filter(function (v) { return /^ar/i.test(v.lang); });
    if (vs.length) u.voice = vs[0];
    u.onend = u.onerror = function () { then && then(); }; synth.speak(u);
  }
  function play(el, then) {
    if (!el) { then && then(); return; }
    var key = el.dataset.audio, text = el.dataset.text || el.textContent;
    if (audio) { audio.onended = audio.onerror = audio.onplaying = null; audio.pause(); }
    if (synth) synth.cancel();
    clearState();
    cur = el; el.classList.add("playing", "buffering");
    if (!audio) audio = new Audio();
    audio.playbackRate = parseFloat(document.body.dataset.rate || "1");
    var t = setTimeout(function () { el.classList.remove("buffering"); }, 4000);
    var finish = function () { clearTimeout(t); if (cur === el) { el.classList.remove("playing", "buffering"); cur = null; } then && then(); };
    audio.onplaying = function () { clearTimeout(t); el.classList.remove("buffering"); };
    audio.onended = finish;
    audio.onerror = function () { clearTimeout(t); el.classList.remove("buffering"); speak(text, finish); };
    audio.src = base + voice + "/" + key + ".mp3";
    var p = audio.play(); if (p && p.catch) p.catch(function () { audio.onerror(); });
  }
  function playAll(items, i) {
    queue = items; i = i || 0;
    if (!items[i]) { queue = null; return; }
    play(items[i], function () { if (queue === items) setTimeout(function () { playAll(items, i + 1); }, 350); });
  }
  document.addEventListener("click", function (e) {
    var seq = e.target.closest("[data-playall]");
    if (seq) {
      e.preventDefault();
      if (seq.classList.contains("on")) { seq.classList.remove("on"); stop(); return; }
      stop(); seq.classList.add("on");
      var items = [].slice.call(document.querySelectorAll(seq.dataset.playall));
      playAll(items, 0); return;
    }
    var el = e.target.closest("[data-audio]");
    if (!el) return;
    e.preventDefault();
    if (el.classList.contains("playing")) { stop(); return; }
    stop(); play(el);
  });
  addEventListener("keydown", function (e) { if (e.key === "Escape") stop(); });

  /* ---------- practice controls ---------- */
  window.toggleMeanings = function (btn) {
    var on = document.querySelectorAll(".w.hide").length === 0;
    document.querySelectorAll(".w").forEach(function (w) { w.classList.toggle("hide", on); });
    btn.textContent = btn.dataset[on ? "off" : "on"];
  };
  window.setRate = function (btn) {
    var r = document.body.dataset.rate === "0.75" ? "1" : "0.75";
    document.body.dataset.rate = r; if (audio) audio.playbackRate = parseFloat(r);
    btn.textContent = r === "1" ? "1×" : "0.75×"; btn.classList.toggle("on", r === "0.75");
  };

  /* ---------- progress ---------- */
  function tasksDone() { return LS.get("tasks", {}); }
  window.markRead = function (n, slug, title, lang) {
    var seen = LS.get("seen", {}); seen[n] = Date.now(); LS.set("seen", seen);
    LS.set("last", { n: n, slug: slug, title: title, lang: lang });
  };
  document.addEventListener("DOMContentLoaded", function () {
    /* "continue where you left off" */
    var box = document.getElementById("continue");
    if (box) {
      var last = LS.get("last", null);
      if (last && last.slug) {
        box.querySelector("a").href = (box.dataset.prefix || "") + last.slug + "/";
        box.querySelector(".ct").textContent = last.title;
        box.hidden = false;
      }
    }
    /* stats ring */
    var ring = document.getElementById("ring");
    if (ring) {
      var seen = Object.keys(LS.get("seen", {})).length, total = parseInt(ring.dataset.total, 10) || 24;
      var ticks = 0, t = tasksDone(); for (var k in t) if (t[k]) ticks++;
      var pct = Math.round(seen / total * 100);
      ring.style.setProperty("--p", pct); ring.querySelector("i").textContent = pct + "%";
      var s = document.getElementById("ringtext");
      if (s) s.textContent = s.dataset.tpl.replace("{seen}", seen).replace("{total}", total).replace("{ticks}", ticks);
    }
    /* ticks already done show on the contents tiles */
    var t2 = tasksDone();
    document.querySelectorAll(".tile[data-n]").forEach(function (tile) {
      var n = tile.dataset.n, any = Object.keys(t2).some(function (k) { return k.indexOf(n + ".") === 0 && t2[k]; });
      if (any) tile.classList.add("has-done");
    });
  });
  window.toggleTask = function (key, box) {
    var t = tasksDone(); t[key] = !t[key]; LS.set("tasks", t);
    box.classList.toggle("on", !!t[key]); box.setAttribute("aria-pressed", !!t[key]);
  };
})();
