/* Strong guard: Lab Interpreter opens only for explicit upload/image/file analysis intent */
(function () {
  let lastChatText = "";

  function getChatInput() {
    return document.getElementById("scdChatInput") ||
           document.getElementById("chatInput") ||
           document.querySelector("input[placeholder*='SCAIA']") ||
           document.querySelector("textarea[placeholder*='SCAIA']");
  }

  function isClinicalReasoning(text) {
    const q = String(text || "").toLowerCase();

    return (
      /patient|scd|voc|severe pain|egfr|spo2|acs|suspected acs|renal|respiratory|opioid|morphine|hydromorphone|fentanyl|tramadol|codeine|fluoxetine|paroxetine|phenoconversion|model output|accept|override|recommendation|safety|clinical reasoning/.test(q) ||
      /مريض|ألم|الم|كلية|تنفس|أكسجين|اكسجين|مورفين|هيدرومورفون|فنتانيل|ترامادول|كودايين|توصية|سلامة|هل يفتح|يفتح اللاب|يجاوب|قرار|اختيار المسكن/.test(q)
    );
  }

  function asksAboutLabRouting(text) {
    const q = String(text || "").toLowerCase();

    return (
      /should scaia open|should.*open.*lab|whether.*open.*lab|when.*open.*lab|open the lab interpreter|open lab interpreter/.test(q) ||
      /هل.*يفتح.*لاب|متى.*يفتح.*لاب|يفتح.*لاب.*ولا|يفتح.*lab|هل يفتح lab/.test(q)
    );
  }

  function asksExplanation(text) {
    const q = String(text || "").toLowerCase();

    return (
      /explain|logic|workflow|algorithm|method|why|how|should|compare|rationale|what should|did you use|copy code|gelanalyzer|gelgenie/.test(q) ||
      /اشرح|شرح|اللوجيك|الخوارزم|الطريقة|ليش|ليه|كيف|وش|هل|مقارنة|كود|استخدمتوا|نسختوا/.test(q)
    );
  }

  function hasExplicitLabAnalysisIntent(text) {
    const q = String(text || "").toLowerCase();

    const action =
      /upload|analyze|analyse|interpret|read|scan|test|check/.test(q) ||
      /ارفع|أرفع|رفع|حلل|أحلل|احلل|اقرأ|اقرا|افحص|اختبر/.test(q);

    const object =
      /image|file|photo|picture|screenshot|chromatogram|gel|qpcr|hrm|cnv|ngs|allelic|assay result|lab result|dna result/.test(q) ||
      /صورة|ملف|سكرين|لقطة|تحليل|نتيجة|جل|لاب|مختبر|كروماتوجرام|منحنى/.test(q);

    return action && object;
  }

  function shouldOpenLab(text) {
    const q = String(text || "");

    if (!q.trim()) return false;

    // Questions ABOUT whether to open lab should be answered in chat, not open lab.
    if (asksAboutLabRouting(q)) return false;

    // Clinical reasoning must stay in chat.
    if (isClinicalReasoning(q)) return false;

    // Explanation/method questions stay in chat unless user clearly asks to analyze/upload image.
    if (asksExplanation(q) && !hasExplicitLabAnalysisIntent(q)) return false;

    return hasExplicitLabAnalysisIntent(q);
  }

  function captureText() {
    const input = getChatInput();
    if (input) lastChatText = input.value || "";
  }

  function installGuard() {
    if (window.__scaiaLabGuardInstalled) return;
    window.__scaiaLabGuardInstalled = true;

    const originalOpen = window.scaiaOpenLabInterpreter;

    window.scaiaOpenLabInterpreter = function (type) {
      const text = lastChatText || (getChatInput() ? getChatInput().value : "");

      if (!shouldOpenLab(text)) {
        console.log("SCAIA Lab Interpreter blocked by routing guard:", text);
        return false;
      }

      if (typeof originalOpen === "function") {
        return originalOpen(type);
      }

      return false;
    };
  }

  function bindCapture() {
    const input = getChatInput();

    if (input && input.dataset.routingGuardCapture !== "1") {
      input.dataset.routingGuardCapture = "1";

      input.addEventListener("keydown", function () {
        captureText();
      }, true);

      input.addEventListener("input", function () {
        captureText();
      }, true);
    }

    document.querySelectorAll("button").forEach((btn) => {
      const txt = (btn.textContent || "").trim().toLowerCase();

      if (txt === "ask" && btn.dataset.routingGuardAsk !== "1") {
        btn.dataset.routingGuardAsk = "1";
        btn.addEventListener("click", function () {
          captureText();
        }, true);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindCapture();
    setTimeout(installGuard, 500);
  });

  window.addEventListener("load", function () {
    bindCapture();
    setTimeout(installGuard, 500);
  });

  setInterval(function () {
    bindCapture();
    installGuard();
  }, 700);
})();
