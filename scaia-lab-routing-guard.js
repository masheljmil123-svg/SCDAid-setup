/* Final routing guard: block only explanation/clinical questions, allow real upload/analyze requests */
(function () {
  let lastChatText = "";

  function getChatInput() {
    return document.getElementById("scdChatInput") ||
           document.getElementById("chatInput") ||
           document.querySelector("input[placeholder*='SCAIA']") ||
           document.querySelector("textarea[placeholder*='SCAIA']");
  }

  function shouldBlockLab(text) {
    const q = String(text || "").toLowerCase();

    if (/do not analyze|don't analyze|not analyze|without analyzing|no analysis|لا تحلل|بدون تحليل|مو تحليل/.test(q)) return true;

    if (/explain|logic|workflow|algorithm|method|principle|how does|how it works|why|rationale|اشرح|شرح|اللوجيك|الخوارزم|الطريقة|كيف يشتغل|كيف يحلل|وش المنطق/.test(q)) return true;

    if (/patient|scd|voc|egfr|spo2|acs|opioid|morphine|hydromorphone|fentanyl|tramadol|codeine|fluoxetine|paroxetine|phenoconversion|accept or override|model output|clinical reasoning/.test(q)) return true;

    if (/should scaia open|open the lab interpreter\?|should.*open.*lab|whether.*open.*lab|متى يفتح|هل يفتح|يفتح اللاب/.test(q)) return true;

    return false;
  }

  function hasExplicitLabAnalysisIntent(text) {
    const q = String(text || "").toLowerCase();

    const action =
      /i want to analyze|i need to analyze|i want to upload|i need to upload|i have a|i have an|analyze a|analyze an|analyze this|analyse a|analyse an|interpret a|interpret an|interpret this|read a|read an|read this|upload a|upload an|scan a|scan an|test a|test an|check a|check an/.test(q) ||
      /أبي أحلل|ابي احلل|أبغى أحلل|ابغى احلل|عندي صورة|عندي تحليل|أبي أرفع|ابي ارفع|حلل هذه|حلل هذي|حلل الصورة|اقرأ الصورة|اقرا الصورة|افحص الصورة|اختبر الصورة/.test(q);

    const object =
      /image|file|photo|picture|screenshot|chromatogram|gel|qpcr|hrm|cnv|ngs|assay result|lab result|dna result/.test(q) ||
      /صورة|ملف|لقطة|تحليل|نتيجة|جل|مختبر|كروماتوجرام|منحنى/.test(q);

    return action && object;
  }

  function shouldOpenLab(text) {
    if (!String(text || "").trim()) return false;
    if (shouldBlockLab(text)) return false;
    return hasExplicitLabAnalysisIntent(text);
  }

  function captureText() {
    const input = getChatInput();
    if (input) lastChatText = input.value || "";
  }

  function installGuard() {
    const currentOpen = window.scaiaOpenLabInterpreter;

    if (typeof currentOpen !== "function") return;
    if (currentOpen.__guarded) return;

    function guardedOpen(type) {
      const input = getChatInput();
      const text = lastChatText || (input ? input.value : "");

      if (!shouldOpenLab(text)) {
        console.log("Blocked Lab Interpreter:", text);
        return false;
      }

      return currentOpen(type);
    }

    guardedOpen.__guarded = true;
    window.scaiaOpenLabInterpreter = guardedOpen;
  }

  function bindCapture() {
    const input = getChatInput();

    if (input && input.dataset.routingGuardCapture !== "1") {
      input.dataset.routingGuardCapture = "1";

      input.addEventListener("input", captureText, true);
      input.addEventListener("keydown", captureText, true);
    }

    document.querySelectorAll("button").forEach((btn) => {
      const txt = (btn.textContent || "").trim().toLowerCase();

      if (txt === "ask" && btn.dataset.routingGuardAsk !== "1") {
        btn.dataset.routingGuardAsk = "1";
        btn.addEventListener("click", captureText, true);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindCapture();
    setTimeout(installGuard, 600);
  });

  window.addEventListener("load", function () {
    bindCapture();
    setTimeout(installGuard, 600);
  });

  setInterval(function () {
    bindCapture();
    installGuard();
  }, 700);
})();
