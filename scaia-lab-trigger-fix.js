/* Robust SCAIA Lab Interpreter trigger from chat - STRICT */
(function () {
  function detectLabType(text) {
    const q = String(text || "").toLowerCase();

    if (/sanger|chromatogram|peak|peaks|sequencing|سانجر/.test(q)) return "sanger";
    if (/qpcr|real.?time|ct value|amplification|منحنى/.test(q)) return "qpcr";
    if (/allelic|discrimination|cluster|clusters|allele plot/.test(q)) return "allelic_discrimination";
    if (/hrm|melt|melting|tm|melt curve/.test(q)) return "hrm";
    if (/cnv|copy number|duplication|deletion|نسخ/.test(q)) return "cnv";
    if (/ngs|variant table|coverage|zygosity|vcf/.test(q)) return "ngs_table";
    if (/gel|electrophoresis|band|bands|ladder|bp|جل|باند|لادر/.test(q)) return "gel";
    if (/dna|pgx|genetic|genotype|جين|وراث|تحليل/.test(q)) return "auto";

    return null;
  }

  function shouldOpenLab(text) {
    const q = String(text || "").toLowerCase();

    // Absolute block: user is asking for explanation, not analysis
    const explicitDoNotAnalyze =
      /do not analyze|don't analyze|not analyze|without analyzing|no analysis|لا تحلل|بدون تحليل|مو تحليل/.test(q);

    const asksLogicOrExplanation =
      /explain|logic|workflow|algorithm|method|principle|how does|how it works|why|rationale|اشرح|شرح|اللوجيك|الخوارزم|الطريقة|كيف يشتغل|كيف يحلل|وش المنطق/.test(q);

    const asksClinicalReasoning =
      /patient|scd|voc|egfr|spo2|acs|opioid|morphine|hydromorphone|fentanyl|tramadol|codeine|fluoxetine|paroxetine|phenoconversion|accept or override|model output|clinical reasoning/.test(q);

    const asksAboutRouting =
      /should scaia open|open the lab interpreter|should.*open.*lab|whether.*open.*lab|متى يفتح|هل يفتح|يفتح اللاب/.test(q);

    if (explicitDoNotAnalyze) return false;
    if (asksAboutRouting) return false;
    if (asksClinicalReasoning) return false;
    if (asksLogicOrExplanation) return false;

    // Open only for clear practical upload/analyze request
    const clearAction =
      /upload|analyze this|analyse this|interpret this|read this|scan this|test this|check this|ارفع|أرفع|حلل هذه|حلل هذي|حلل الصورة|اقرأ الصورة|اقرا الصورة|افحص الصورة|اختبر الصورة/.test(q);

    const clearObject =
      /image|file|photo|picture|screenshot|chromatogram|gel|qpcr|hrm|cnv|ngs|assay result|lab result|صورة|ملف|لقطة|تحليل|نتيجة|جل|مختبر/.test(q);

    return clearAction && clearObject;
  }

  function getChatInput() {
    return document.getElementById("scdChatInput") ||
           document.getElementById("chatInput") ||
           document.querySelector("input[placeholder*='SCAIA']") ||
           document.querySelector("textarea[placeholder*='SCAIA']");
  }

  function getAskButton() {
    const buttons = Array.from(document.querySelectorAll("button"));
    return buttons.find(btn => (btn.textContent || "").trim().toLowerCase() === "ask");
  }

  function openLabFromText(text) {
    if (!shouldOpenLab(text)) return false;

    const type = detectLabType(text);
    if (!type) return false;

    setTimeout(function () {
      if (typeof window.scaiaOpenLabInterpreter === "function") {
        window.scaiaOpenLabInterpreter(type);
      }
    }, 350);

    return true;
  }

  function bindInputAndAsk() {
    const input = getChatInput();
    const askBtn = getAskButton();

    if (input && input.dataset.labTriggerFixed !== "1") {
      input.dataset.labTriggerFixed = "1";

      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") openLabFromText(input.value);
      }, true);
    }

    if (askBtn && askBtn.dataset.labTriggerFixed !== "1") {
      askBtn.dataset.labTriggerFixed = "1";

      askBtn.addEventListener("click", function () {
        const inputNow = getChatInput();
        if (inputNow) openLabFromText(inputNow.value);
      }, true);
    }
  }

  document.addEventListener("DOMContentLoaded", bindInputAndAsk);
  window.addEventListener("load", bindInputAndAsk);
  setInterval(bindInputAndAsk, 700);
})();
