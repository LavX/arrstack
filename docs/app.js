// arrstack-installer: tiny vanilla snippet for copy-to-clipboard.
// No build step. No dependencies. Safe on older browsers (graceful fallback).

(function () {
  "use strict";

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback for non-secure contexts (e.g. plain http on LAN preview).
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  function bind(btn) {
    btn.addEventListener("click", function () {
      var sel = btn.getAttribute("data-copy-target");
      var target = sel ? document.querySelector(sel) : null;
      var text = target ? target.innerText.trim() : (btn.getAttribute("data-copy") || "");
      if (!text) return;
      copyText(text).then(function () {
        var original = btn.textContent;
        btn.setAttribute("data-copied", "true");
        btn.textContent = "copied";
        setTimeout(function () {
          btn.removeAttribute("data-copied");
          btn.textContent = original;
        }, 1400);
      }).catch(function () {
        btn.textContent = "press Ctrl+C";
        setTimeout(function () { btn.textContent = "copy"; }, 1400);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var buttons = document.querySelectorAll("[data-copy-target], [data-copy]");
    for (var i = 0; i < buttons.length; i++) bind(buttons[i]);
  });
})();
