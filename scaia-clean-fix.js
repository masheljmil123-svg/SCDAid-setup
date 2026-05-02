// FINAL CLEAN FIX FOR SCAIA BACK BUTTON
(function () {
  function getOverlay() {
    return document.querySelector(".scdChatOverlay") ||
           document.getElementById("scdChatOverlay") ||
           document.querySelector("[class*='ChatOverlay']") ||
           document.querySelector("[class*='chatOverlay']");
  }

  function getModal() {
    return document.querySelector(".scdChatModal") ||
           document.getElementById("scdChatModal") ||
           document.querySelector("[class*='ChatModal']") ||
           document.querySelector("[class*='chatModal']");
  }

  function closeSCAIA() {
    const ov = getOverlay();
    const modal = getModal();

    if (ov) {
      ov.style.display = "none";
      ov.classList.remove("open", "active", "show", "isOpen");
    }

    if (!ov && modal) {
      modal.style.display = "none";
    }

    document.body.classList.remove("scaiaOpen", "chatOpen", "scdChatOpen");

    // remove URL flag if any
    if (window.history && window.location.search.includes("scaia")) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  function ensureBackButton() {
    const modal = getModal();
    if (!modal) return;

    let btn = document.getElementById("scaiaBackToToolBtn");

    if (!btn) {
      btn = document.createElement("button");
      btn.id = "scaiaBackToToolBtn";
      btn.type = "button";
      btn.textContent = "← Back to SCDAid";
      modal.appendChild(btn);
    }

    btn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      closeSCAIA();
      return false;
    };
  }

  function removeBadQuickButtons() {
    const badTexts = [
      "Why hydromorphone?",
      "Why avoid tramadol?",
      "Explain CYP2D6 phenotype",
      "Why is safety risk high?"
    ];

    const modal = getModal();
    if (!modal) return;

    modal.querySelectorAll("button, a, [role='button']").forEach((el) => {
      const txt = (el.textContent || "").trim();
      if (badTexts.includes(txt)) el.remove();
    });
  }

  function init() {
    ensureBackButton();
    removeBadQuickButtons();
  }

  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("load", init);
  setInterval(init, 700);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeSCAIA();
  });

  window.closeSCAIA = closeSCAIA;
})();
