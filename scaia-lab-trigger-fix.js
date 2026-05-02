/* SCAIA Lab Interpreter trigger - natural language strict version */
(function () {
  function detectLabType(text) {
    const q = String(text || "").toLowerCase();

    if (/sanger|chromatogram|peak|peaks|sequencing|سانجر|كروماتوجرام/.test(q)) return "sanger";
    if (/qpcr|real.?time|ct value|amplification|منحنى/.test(q)) return "qpcr";
    if (/allelic|discrimination|cluster|clusters|allele plot/.test(q)) return "allelic_discrimination";
    if (/hrm|melt|melting|tm|melt curve/.test(q)) return "hrm";
    if (/cnv|copy number|duplication|deletion|نسخ/.test(q)) return "cnv";
    if (/ngs|variant table|coverage|zygosity|vcf/.test(q)) return "ngs_table";
    if (/gel|electrophoresis|band|bands|ladder|bp|جل|باند|لادر/.test(q)) return "gel";
    if (/dna|pgx|genetic|genotype|جين|وراث|تحليل/.test(q)) return "auto";

    return null;
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

  function getChatInput() {
    return document.getElementById("scdChatInput") ||
           document.getElementById("chatInput") ||
           document.querySelector("input[placeholder*='SCAIA']") ||
           document.querySelector("textarea[placeholder*='SCAIA']");
  }

  function getAskButton() {
    return Array.from(document.querySelectorAll("button"))
      .find(btn => (btn.textContent || "").trim().toLowerCase() === "ask");
  }

  function addBotMessage(text) {
    const box = document.getElementById("scdChatMessages") ||
                document.getElementById("chatMessages") ||
                document.querySelector(".scdChatMessages");

    if (!box) return;

    const wrapper = document.createElement("div");
    wrapper.className = "scdMsg bot";

    const bubble = document.createElement("div");
    bubble.className = "scdBubble";
    bubble.textContent = text;

    wrapper.appendChild(bubble);
    box.appendChild(wrapper);
    box.scrollTop = box.scrollHeight;
  }

  function openLabFromText(text) {
    if (!shouldOpenLab(text)) return false;

    const type = detectLabType(text) || "auto";

    setTimeout(function () {
      if (typeof window.scaiaOpenLabInterpreter === "function") {
        window.scaiaOpenLabInterpreter(type);
        addBotMessage("I opened the SCAIA Lab Interpreter for you. Upload the assay image and add any available details such as gene target, variant, expected result, or notes.");
      } else {
        console.warn("SCAIA Lab Interpreter function not loaded.");
      }
    }, 250);

    return true;
  }

  function bindInputAndAsk() {
    const input = getChatInput();
    const askBtn = getAskButton();

    if (input && input.dataset.labTriggerFixed !== "1") {
      input.dataset.labTriggerFixed = "1";

      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          openLabFromText(input.value);
        }
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
