// arrstack-installer: hero background p5 sketch.
//
// Concept: Auto-wiring constellation (Concept 1).
// A fixed-layout graph of 12 service nodes. Edges wire themselves in sequence
// with a single phosphor-green pulse, representing the installer's cross-wiring
// step (Prowlarr -> Sonarr/Radarr/Bazarr, FlareSolverr tags, Caddy fanout,
// Jellyseerr -> Jellyfin, etc.). After the sequence completes at ~6s the
// sketch goes idle, re-pulsing one random edge every few seconds like a
// healthcheck. Stepped drawing, hairline grid, no glow, no bloom.
//
// Instance mode. 30 fps. Paused when document.hidden. Destroyed on pagehide.
// Reduced-motion branch: renders one static final frame.
// Skipped entirely below 640px viewport.
//
// Canonical brand palette only: --accent-brand (#3FB950), --fg-muted (#8B949E),
// --fg-dim (#6E7681), --line (#30363D), --bg-base (#0D1117).

(function () {
  "use strict";

  var MOBILE_CUTOFF = 640;
  var CONTAINER_ID = "hero-sketch";

  var SERVICES = [
    { id: "QB",  label: "QB",  role: "download",  col: 0, row: 1 },
    { id: "GLU", label: "GLU", role: "vpn",       col: 0, row: 2 },
    { id: "PRO", label: "PRO", role: "indexer",   col: 1, row: 0 },
    { id: "FLA", label: "FLA", role: "indexer",   col: 0, row: 0 },
    { id: "SON", label: "SON", role: "arr",       col: 2, row: 0 },
    { id: "RAD", label: "RAD", role: "arr",       col: 2, row: 1 },
    { id: "BAZ", label: "BAZ", role: "subtitles", col: 2, row: 2 },
    { id: "REC", label: "REC", role: "quality",   col: 3, row: 2 },
    { id: "CAD", label: "CAD", role: "proxy",     col: 1, row: 2 },
    { id: "JF",  label: "JF",  role: "media",     col: 3, row: 0 },
    { id: "JS",  label: "JS",  role: "requests",  col: 3, row: 1 },
    { id: "TRA", label: "TRA", role: "trailers",  col: 4, row: 1 }
  ];

  // Wiring order reflects what the installer actually does.
  var EDGES = [
    ["FLA", "PRO"],   // FlareSolverr tagged at create-time on Prowlarr
    ["PRO", "SON"],   // Prowlarr app-sync to Sonarr
    ["PRO", "RAD"],   // Prowlarr app-sync to Radarr
    ["QB",  "SON"],   // qBittorrent as Sonarr download client
    ["QB",  "RAD"],   // qBittorrent as Radarr download client
    ["GLU", "QB"],    // Gluetun wraps qBittorrent
    ["SON", "BAZ"],   // Bazarr reads Sonarr library
    ["RAD", "BAZ"],   // Bazarr reads Radarr library
    ["REC", "SON"],   // Recyclarr syncs to Sonarr
    ["REC", "RAD"],   // Recyclarr syncs to Radarr
    ["JS",  "JF"],    // Jellyseerr linked to Jellyfin
    ["JS",  "SON"],   // Jellyseerr talks to Sonarr
    ["JS",  "RAD"],   // Jellyseerr talks to Radarr
    ["TRA", "RAD"],   // Trailarr linked to Radarr
    ["CAD", "JF"],    // Caddy vhosts
    ["CAD", "JS"],
    ["CAD", "SON"],
    ["CAD", "RAD"],
    ["CAD", "PRO"],
    ["CAD", "BAZ"],
    ["CAD", "QB"]
  ];

  var prefersReducedMotion = false;
  try {
    prefersReducedMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (_) {}

  function belowCutoff() {
    return window.innerWidth < MOBILE_CUTOFF;
  }

  function indexById(id) {
    for (var i = 0; i < SERVICES.length; i++) if (SERVICES[i].id === id) return i;
    return -1;
  }

  var sketchInstance = null;
  var containerEl = null;
  var pauseOnHidden = null;

  function defineSketch(p) {
    var W = 0, H = 0;
    var nodes = [];
    var edges = [];
    var startMs = 0;
    // Per-edge: drawIndex start time; a single pulse head that runs 0 -> 1 over PULSE_MS.
    var EDGE_STEP_MS = 260;       // gap between edges starting to draw
    var PULSE_MS = 420;           // pulse traversal time along an edge
    var WIRING_DONE_AT;
    var idlePulseAt = 0;
    var IDLE_PULSE_MIN = 3800;
    var IDLE_PULSE_MAX = 6200;
    var idleEdgeIndex = -1;
    var idleEdgeStart = 0;
    var gridEl = null;

    var COLORS = {
      bg:      [13, 17, 23],       // --bg-base (not painted; canvas is transparent)
      line:    [48, 54, 61],       // --line (hairline grid)
      muted:   [139, 148, 158],    // --fg-muted (idle edges, labels)
      dim:     [110, 118, 129],    // --fg-dim
      accent:  [63, 185, 80]       // --accent-brand (phosphor)
    };

    function layout() {
      // 5 columns by 3 rows, centered, with padding.
      var padX = Math.max(28, W * 0.06);
      var padY = Math.max(24, H * 0.10);
      var cols = 5, rows = 3;
      var cellW = (W - padX * 2) / (cols - 1);
      var cellH = (H - padY * 2) / (rows - 1);
      nodes = SERVICES.map(function (s) {
        return {
          id: s.id,
          label: s.label,
          x: padX + s.col * cellW,
          y: padY + s.row * cellH
        };
      });
      edges = EDGES.map(function (pair, i) {
        return {
          from: indexById(pair[0]),
          to:   indexById(pair[1]),
          startAt: i * EDGE_STEP_MS
        };
      });
      WIRING_DONE_AT = EDGES.length * EDGE_STEP_MS + PULSE_MS + 200;
    }

    function resizeFromContainer() {
      var rect = containerEl.getBoundingClientRect();
      W = Math.max(320, Math.floor(rect.width));
      H = Math.max(220, Math.floor(rect.height));
      p.resizeCanvas(W, H);
      layout();
    }

    p.setup = function () {
      var rect = containerEl.getBoundingClientRect();
      W = Math.max(320, Math.floor(rect.width));
      H = Math.max(220, Math.floor(rect.height));
      var c = p.createCanvas(W, H);
      c.parent(containerEl);
      c.elt.setAttribute("aria-hidden", "true");
      c.elt.setAttribute("tabindex", "-1");
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
      p.frameRate(prefersReducedMotion ? 1 : 30);
      p.textFont("JetBrains Mono, ui-monospace, monospace");
      p.textAlign(p.CENTER, p.CENTER);
      layout();
      startMs = p.millis();

      if (prefersReducedMotion) {
        // One static frame representing the settled state.
        drawStatic();
        p.noLoop();
      }
    };

    p.windowResized = function () {
      resizeFromContainer();
      if (prefersReducedMotion) {
        drawStatic();
      }
    };

    function drawGrid() {
      // Faint hairline grid. Schematic feel. Step 32px.
      p.noFill();
      p.stroke(COLORS.line[0], COLORS.line[1], COLORS.line[2], 40);
      p.strokeWeight(1);
      var step = 32;
      for (var x = 0; x < W; x += step) p.line(x + 0.5, 0, x + 0.5, H);
      for (var y = 0; y < H; y += step) p.line(0, y + 0.5, W, y + 0.5);
    }

    function drawEdgeBase(a, b, alpha) {
      p.stroke(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2], alpha);
      p.strokeWeight(1);
      p.line(a.x, a.y, b.x, b.y);
    }

    function drawEdgePulse(a, b, t, pulseAlpha) {
      // Single bright segment running along the edge at position t in [0,1].
      // No glow, no gradient, just a short lit chord.
      var segLen = 0.18; // fraction of edge
      var t0 = Math.max(0, t - segLen);
      var t1 = Math.min(1, t);
      var x0 = a.x + (b.x - a.x) * t0;
      var y0 = a.y + (b.y - a.y) * t0;
      var x1 = a.x + (b.x - a.x) * t1;
      var y1 = a.y + (b.y - a.y) * t1;
      p.stroke(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2], pulseAlpha);
      p.strokeWeight(1.5);
      p.line(x0, y0, x1, y1);
    }

    function drawNode(n, active) {
      // Hollow square, 3-letter mono label beneath.
      var s = 14;
      p.noFill();
      if (active) {
        p.stroke(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2], 200);
      } else {
        p.stroke(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2], 170);
      }
      p.strokeWeight(1);
      p.rect(n.x - s / 2 + 0.5, n.y - s / 2 + 0.5, s, s);

      // small center dot
      p.noStroke();
      if (active) {
        p.fill(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2], 220);
      } else {
        p.fill(COLORS.dim[0], COLORS.dim[1], COLORS.dim[2], 180);
      }
      p.rect(n.x - 1, n.y - 1, 2, 2);

      // label
      p.noStroke();
      p.fill(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2], 190);
      p.textSize(10);
      p.text(n.label, n.x, n.y + s + 8);
    }

    function pickIdleEdge() {
      idleEdgeIndex = Math.floor(Math.random() * edges.length);
      idleEdgeStart = p.millis();
      idlePulseAt = p.millis() + IDLE_PULSE_MIN + Math.random() * (IDLE_PULSE_MAX - IDLE_PULSE_MIN);
    }

    function drawStatic() {
      p.clear();
      drawGrid();
      // all edges at idle tone
      for (var i = 0; i < edges.length; i++) {
        var e = edges[i];
        drawEdgeBase(nodes[e.from], nodes[e.to], 70);
      }
      for (var j = 0; j < nodes.length; j++) drawNode(nodes[j], false);
    }

    p.draw = function () {
      if (prefersReducedMotion) return;
      p.clear();
      drawGrid();

      var now = p.millis() - startMs;
      var wiring = now < WIRING_DONE_AT;

      // Edges: draw base for those that have begun; overlay pulse for the one in flight.
      for (var i = 0; i < edges.length; i++) {
        var e = edges[i];
        var a = nodes[e.from], b = nodes[e.to];
        var localT = now - e.startAt;
        if (localT < 0) {
          // not started: draw nothing (or a very faint hint)
          p.stroke(COLORS.line[0], COLORS.line[1], COLORS.line[2], 50);
          p.strokeWeight(1);
          p.drawingContext.setLineDash([2, 4]);
          p.line(a.x, a.y, b.x, b.y);
          p.drawingContext.setLineDash([]);
          continue;
        }
        drawEdgeBase(a, b, 70);
        if (localT < PULSE_MS) {
          var t = localT / PULSE_MS;
          drawEdgePulse(a, b, t, 220);
        }
      }

      // Idle re-pulse (after wiring completes).
      if (!wiring) {
        if (idleEdgeIndex === -1 || p.millis() >= idlePulseAt) {
          pickIdleEdge();
        }
        if (idleEdgeIndex >= 0) {
          var elapsed = p.millis() - idleEdgeStart;
          if (elapsed < PULSE_MS) {
            var ie = edges[idleEdgeIndex];
            drawEdgePulse(nodes[ie.from], nodes[ie.to], elapsed / PULSE_MS, 180);
          }
        }
      }

      // Nodes: active if any connected edge has been visited (post wiring all are active).
      var active = new Array(nodes.length);
      for (var n = 0; n < nodes.length; n++) active[n] = !wiring;
      if (wiring) {
        for (var k = 0; k < edges.length; k++) {
          var ek = edges[k];
          if (now - ek.startAt >= 0) { active[ek.from] = true; active[ek.to] = true; }
        }
      }
      for (var m = 0; m < nodes.length; m++) drawNode(nodes[m], active[m]);
    };

    p.remove_ = function () {
      // p5 provides p.remove(); wrapper for parity.
      try { p.remove(); } catch (_) {}
    };
  }

  function mount() {
    if (sketchInstance) return;
    if (typeof window.p5 !== "function") return;
    containerEl = document.getElementById(CONTAINER_ID);
    if (!containerEl) return;
    if (belowCutoff()) return; // skip entirely on small viewports
    sketchInstance = new window.p5(defineSketch, containerEl);

    // Pause when tab is hidden.
    pauseOnHidden = function () {
      if (!sketchInstance) return;
      if (document.hidden) {
        try { sketchInstance.noLoop(); } catch (_) {}
      } else if (!prefersReducedMotion) {
        try { sketchInstance.loop(); } catch (_) {}
      }
    };
    document.addEventListener("visibilitychange", pauseOnHidden);
  }

  function unmount() {
    if (pauseOnHidden) {
      document.removeEventListener("visibilitychange", pauseOnHidden);
      pauseOnHidden = null;
    }
    if (sketchInstance) {
      try { sketchInstance.remove(); } catch (_) {}
      sketchInstance = null;
    }
  }

  // Remount on resize across the mobile cutoff boundary.
  var remountTimer = null;
  window.addEventListener("resize", function () {
    if (remountTimer) clearTimeout(remountTimer);
    remountTimer = setTimeout(function () {
      var below = belowCutoff();
      if (below && sketchInstance) {
        unmount();
      } else if (!below && !sketchInstance) {
        mount();
      }
    }, 180);
  });

  window.addEventListener("pagehide", unmount, { once: false });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
