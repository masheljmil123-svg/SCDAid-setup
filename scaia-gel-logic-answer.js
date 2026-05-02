/* Direct SCAIA answer for gel workflow / originality questions */
(function () {
  function isGelLogicQuestion(text) {
    const q = String(text || "").toLowerCase();

    const mentionsGel =
      /gel|electrophoresis|band|bands|ladder|bp|جل|باند|لادر/.test(q);

    const asksLogic =
      /logic|workflow|algorithm|method|code|gelanalyzer|gelgenie|original|copy|used|اللوجيك|الخوارزم|الكود|الطريقة|الفكرة|كيف|وش|هل استخدم|استخدمتوا|نسختوا|مكررة|موجودة/.test(q);

    return mentionsGel && asksLogic;
  }

  function getInput() {
    return document.getElementById("scdChatInput") ||
           document.getElementById("chatInput") ||
           document.querySelector("input[placeholder*='SCAIA']") ||
           document.querySelector("textarea[placeholder*='SCAIA']");
  }

  function getAskButton() {
    return Array.from(document.querySelectorAll("button"))
      .find(btn => (btn.textContent || "").trim().toLowerCase() === "ask");
  }

  function getMessagesBox() {
    return document.getElementById("scdChatMessages") ||
           document.getElementById("chatMessages") ||
           document.querySelector(".scdChatMessages");
  }

  function addUserMessage(text) {
    const box = getMessagesBox();
    if (!box) return;

    const wrapper = document.createElement("div");
    wrapper.className = "scdMsg user";

    const bubble = document.createElement("div");
    bubble.className = /[\u0600-\u06FF]/.test(text) ? "scdBubble rtlText" : "scdBubble ltrText";
    bubble.setAttribute("dir", /[\u0600-\u06FF]/.test(text) ? "rtl" : "ltr");
    bubble.textContent = text;

    wrapper.appendChild(bubble);
    box.appendChild(wrapper);
    box.scrollTop = box.scrollHeight;
  }

  function addBotMessage(html) {
    const box = getMessagesBox();
    if (!box) return;

    const wrapper = document.createElement("div");
    wrapper.className = "scdMsg bot";

    const bubble = document.createElement("div");
    bubble.className = "scdBubble rtlText";
    bubble.setAttribute("dir", "rtl");
    bubble.innerHTML = html;

    wrapper.appendChild(bubble);
    box.appendChild(wrapper);
    box.scrollTop = box.scrollHeight;
  }

  function answerGelLogic(question) {
    addUserMessage(question);

    addBotMessage(`
      <b>اللوجيك المستخدم في تحليل Gel Image داخل SCAIA:</b><br><br>

      SCAIA يستخدم منهجية اسمها:<br>
      <b>Ladder-based densitometric gel analysis workflow with semi-log band-size estimation.</b><br><br>

      يعني باختصار:<br>
      1. يحوّل صورة الجل إلى grayscale / intensity map.<br>
      2. يحسّن الصورة ويقلل الخلفية والـ noise.<br>
      3. يحدد الـ lanes باستخدام vertical intensity profiles.<br>
      4. يكتشف الـ bands كـ intensity peaks داخل كل lane.<br>
      5. يستخدم الـ DNA ladder lane كمرجع للقياس.<br>
      6. يطابق أحجام الـ ladder المعروفة مع مواقع الباندات.<br>
      7. يبني semi-log calibration curve بين migration distance و log10(bp).<br>
      8. يقدر حجم bands في العينات عن طريق interpolation مقارنة بالـ ladder.<br>
      9. إذا المستخدم كتب expected target size، يقارن الباندات معه ويحدد possible target-size match.<br>
      10. يعطي تفسير تعليمي مبدئي، وليس genotype نهائي.<br><br>

      <b>وش الإضافة في SCAIA؟</b><br>
      إن تحليل الجل هنا مو أداة مستقلة فقط؛ هو جزء من SCAIA Lab Interpreter، اللي يربط قراءة مخرجات المختبر بالسياق الدوائي الجيني PGx وبمشروع SCDAid.<br><br>

      <b>ملاحظة مهمة:</b><br>
      هذا التحليل يعطي قراءة تعليمية مبدئية، ولا يعتبر genotype نهائي أو بديل عن تأكيد المختبر.
    `);
  }

  function handleIfNeeded(e) {
    const input = getInput();
    if (!input) return false;

    const text = input.value.trim();
    if (!isGelLogicQuestion(text)) return false;

    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }

    input.value = "";
    answerGelLogic(text);
    return true;
  }

  function bind() {
    const input = getInput();
    const askBtn = getAskButton();

    if (input && input.dataset.gelLogicBound !== "1") {
      input.dataset.gelLogicBound = "1";
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") handleIfNeeded(e);
      }, true);
    }

    if (askBtn && askBtn.dataset.gelLogicBound !== "1") {
      askBtn.dataset.gelLogicBound = "1";
      askBtn.addEventListener("click", handleIfNeeded, true);
    }
  }

  document.addEventListener("DOMContentLoaded", bind);
  window.addEventListener("load", bind);
  setInterval(bind, 700);
})();

/* Direct answer only if user asks about existing tools / copied code */
(function () {
  function isExistingToolQuestion(text) {
    const q = String(text || "").toLowerCase();
    return /gelanalyzer|gelgenie|existing tool|already exists|copy code|copied code|مكررة|موجودة|نسختوا|كودهم|أدوات ثانية|برامج ثانية/.test(q);
  }

  function getInput() {
    return document.getElementById("scdChatInput") ||
           document.getElementById("chatInput") ||
           document.querySelector("input[placeholder*='SCAIA']") ||
           document.querySelector("textarea[placeholder*='SCAIA']");
  }

  function getAskButton() {
    return Array.from(document.querySelectorAll("button"))
      .find(btn => (btn.textContent || "").trim().toLowerCase() === "ask");
  }

  function getMessagesBox() {
    return document.getElementById("scdChatMessages") ||
           document.getElementById("chatMessages") ||
           document.querySelector(".scdChatMessages");
  }

  function addUserMessage(text) {
    const box = getMessagesBox();
    if (!box) return;
    const wrapper = document.createElement("div");
    wrapper.className = "scdMsg user";
    const bubble = document.createElement("div");
    bubble.className = /[\u0600-\u06FF]/.test(text) ? "scdBubble rtlText" : "scdBubble ltrText";
    bubble.setAttribute("dir", /[\u0600-\u06FF]/.test(text) ? "rtl" : "ltr");
    bubble.textContent = text;
    wrapper.appendChild(bubble);
    box.appendChild(wrapper);
    box.scrollTop = box.scrollHeight;
  }

  function addBotMessage(html) {
    const box = getMessagesBox();
    if (!box) return;
    const wrapper = document.createElement("div");
    wrapper.className = "scdMsg bot";
    const bubble = document.createElement("div");
    bubble.className = "scdBubble rtlText";
    bubble.setAttribute("dir", "rtl");
    bubble.innerHTML = html;
    wrapper.appendChild(bubble);
    box.appendChild(wrapper);
    box.scrollTop = box.scrollHeight;
  }

  function answerExistingToolQuestion(question) {
    addUserMessage(question);
    addBotMessage(`
      تحليل صور الجل بحد ذاته موجود في أدوات وبرامج سابقة، لكن SCAIA لا ينسخ كود خارجي منها.<br><br>
      SCAIA يطبق نسخة تعليمية مبسطة مبنية على نفس سير العمل العلمي المعروف: تحديد lanes، كشف bands، استخدام DNA ladder للمعايرة، ثم تقدير الحجم بطريقة semi-log.<br><br>
      الفرق في SCAIA أن التحليل مدمج داخل مساعد PGx Lab Interpreter، ويرتبط لاحقًا بسياق SCDAid بدل ما يكون برنامج gel مستقل فقط.
    `);
  }

  function handle(e) {
    const input = getInput();
    if (!input) return false;

    const text = input.value.trim();
    if (!isExistingToolQuestion(text)) return false;

    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }

    input.value = "";
    answerExistingToolQuestion(text);
    return true;
  }

  function bind() {
    const input = getInput();
    const askBtn = getAskButton();

    if (input && input.dataset.existingToolBound !== "1") {
      input.dataset.existingToolBound = "1";
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") handle(e);
      }, true);
    }

    if (askBtn && askBtn.dataset.existingToolBound !== "1") {
      askBtn.dataset.existingToolBound = "1";
      askBtn.addEventListener("click", handle, true);
    }
  }

  document.addEventListener("DOMContentLoaded", bind);
  window.addEventListener("load", bind);
  setInterval(bind, 700);
})();
