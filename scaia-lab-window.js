
function shouldOpenLabIntent(text) {
  const q = String(text || "").toLowerCase();

  const openWords =
    /upload|analyze|analyse|test|interpret|read|scan|ارفع|رفع|حلل|احلل|أحلل|تحليل صورة|اختبر|افحص|اقرأ|اقرا|صورة|ملف/.test(q);

  const explanationWords =
    /logic|workflow|algorithm|code|explain|method|principle|idea|used|use|copy|gelanalyzer|gelgenie|اللوجيك|الخوارزم|الكود|الطريقة|الفكرة|اشرح|شرح|وش|كيف|ليش|استخدم|استخدمت|نسخت|كودهم/.test(q);

  // If user is asking ABOUT the method, do not open the lab window.
  if (explanationWords && !openWords) return false;

  // Open lab only when user clearly wants to analyze/upload/read an assay image/result.
  if (openWords) return true;

  return false;
}


(function () {
  let currentType = "gel";

  const assayLabels = {
    gel: "DNA Gel Image Assist",
    sanger: "Sanger Chromatogram",
    qpcr: "qPCR Amplification Curve",
    allelic_discrimination: "Allelic Discrimination Plot",
    hrm: "HRM / Melt Curve",
    cnv: "Copy Number / CNV Plot",
    ngs_table: "NGS Variant Table",
    auto: "Auto-detect PGx Result"
  };

  function detectType(text) {
    const q = String(text || "").toLowerCase();

    if (/gel|electrophoresis|band|bands|ladder|bp|جل|باند|لادر/.test(q)) return "gel";
    if (/sanger|chromatogram|peak|peaks|sequencing|سانجر/.test(q)) return "sanger";
    if (/qpcr|real.?time|ct value|amplification|منحنى/.test(q)) return "qpcr";
    if (/allelic|discrimination|cluster|clusters|allele plot/.test(q)) return "allelic_discrimination";
    if (/hrm|melt|melting|tm|melt curve/.test(q)) return "hrm";
    if (/cnv|copy number|duplication|deletion|نسخ/.test(q)) return "cnv";
    if (/ngs|variant table|coverage|zygosity|vcf/.test(q)) return "ngs_table";
    if (/dna|pgx|genetic|genotype|اختبر|تحليل|جين|وراث/.test(q)) return "auto";

    return null;
  }

  function guideHTML(type) {
    if (type === "gel") {
      return `
        <h3>What SCAIA needs for Gel Analysis</h3>
        <p>SCAIA can estimate band sizes using the DNA ladder.</p>
        <ol>
          <li>Upload a cropped gel image.</li>
          <li>Enter the ladder lane number.</li>
          <li>Enter ladder sizes from top to bottom.</li>
          <li>Optional: enter expected target size in bp.</li>
        </ol>
        <p><b>Note:</b> This is educational preliminary analysis, not a final genotype call.</p>
      `;
    }

    const label = assayLabels[type] || assayLabels.auto;

    return `
      <h3>${label} requirements</h3>
      <p>SCAIA will give a preliminary interpretation based on the uploaded image.</p>
      <ol>
        <li>Upload the assay image or screenshot.</li>
        <li>Add gene target if known, e.g., CYP2D6.</li>
        <li>Add variant/allele if known, e.g., *4 or rs3892097.</li>
        <li>Add expected result, controls, threshold, or reference info if available.</li>
        <li>SCAIA will explain what is visible and what is missing.</li>
      </ol>
      <p><b>Note:</b> Final genotype must be confirmed by the validated lab workflow.</p>
    `;
  }

  function gelFormHTML() {
    return `
      <h3>DNA Gel Image Assist</h3>
      <div class="scaiaLabFormGrid">
        <input class="full" id="labGelFile" type="file" accept="image/png,image/jpeg,image/jpg,image/webp">
        <input id="labGelLadderLane" type="number" min="1" value="1" placeholder="Ladder lane e.g., 1">
        <input id="labGelTarget" type="number" min="1" placeholder="Expected target size bp optional">
        <input class="full" id="labGelSizes" type="text" value="1500,1000,700,500,300,200,100" placeholder="Ladder sizes from top to bottom">
      </div>
      <button class="scaiaLabAnalyzeBtn" id="labAnalyzeGelBtn">Analyze Gel Image</button>
      <div class="scaiaLabResult" id="labResultBox">Result will appear here.</div>
    `;
  }

  function assayFormHTML(type) {
    return `
      <h3>${assayLabels[type] || assayLabels.auto}</h3>
      <div class="scaiaLabFormGrid">
        <input class="full" id="labAssayFile" type="file" accept="image/png,image/jpeg,image/jpg,image/webp">
        <input id="labGene" type="text" placeholder="Gene target optional, e.g., CYP2D6">
        <input id="labVariant" type="text" placeholder="Variant/allele optional, e.g., *4">
        <input id="labExpected" type="text" placeholder="Expected result / control optional">
        <input id="labNotes" type="text" placeholder="Notes: controls, lane, threshold, reference">
      </div>
      <button class="scaiaLabAnalyzeBtn" id="labAnalyzeAssayBtn">Analyze PGx Lab Image</button>
      <div class="scaiaLabResult" id="labResultBox">Result will appear here.</div>
    `;
  }

  function buildWindow() {
    if (document.getElementById("scaiaLabWindowOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "scaiaLabWindowOverlay";
    overlay.innerHTML = `
      <div class="scaiaLabWindow">
        <div class="scaiaLabHeader">
          <div>
            <h2>SCAIA Lab Interpreter</h2>
            <p>Specialized workspace for DNA / PGx assay image interpretation.</p>
          </div>
          <button class="scaiaLabClose" id="scaiaLabCloseBtn">Back to SCAIA</button>
        </div>

        <div class="scaiaLabTabs">
          <button class="scaiaLabTab" data-type="gel">Gel</button>
          <button class="scaiaLabTab" data-type="sanger">Sanger</button>
          <button class="scaiaLabTab" data-type="qpcr">qPCR</button>
          <button class="scaiaLabTab" data-type="allelic_discrimination">Allelic Plot</button>
          <button class="scaiaLabTab" data-type="hrm">HRM</button>
          <button class="scaiaLabTab" data-type="cnv">CNV</button>
          <button class="scaiaLabTab" data-type="ngs_table">NGS Table</button>
          <button class="scaiaLabTab" data-type="auto">Auto</button>
        </div>

        <div class="scaiaLabBody">
          <div class="scaiaLabGuide" id="scaiaLabGuide"></div>
          <div class="scaiaLabPanel" id="scaiaLabPanel"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("scaiaLabCloseBtn").addEventListener("click", closeLab);

    overlay.querySelectorAll(".scaiaLabTab").forEach((btn) => {
      btn.addEventListener("click", function () {
        renderType(btn.dataset.type);
      });
    });
  }

  function renderType(type) {
    currentType = type || "auto";
    buildWindow();

    document.querySelectorAll(".scaiaLabTab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.type === currentType);
    });

    document.getElementById("scaiaLabGuide").innerHTML = guideHTML(currentType);
    document.getElementById("scaiaLabPanel").innerHTML =
      currentType === "gel" ? gelFormHTML() : assayFormHTML(currentType);

    bindAnalysisButtons();
  }

  function openLab(type) {
    buildWindow();
    renderType(type || "auto");
    document.getElementById("scaiaLabWindowOverlay").classList.add("open");
  }

  function closeLab() {
    const overlay = document.getElementById("scaiaLabWindowOverlay");
    if (overlay) overlay.classList.remove("open");
  }

  function setResult(text, imageBase64) {
    const box = document.getElementById("labResultBox");
    if (!box) return;

    box.textContent = text || "";

    if (imageBase64) {
      const img = document.createElement("img");
      img.src = "data:image/png;base64," + imageBase64;
      box.appendChild(img);
    }
  }

  function formatGelResults(data) {
    let text = (data.message || "") + "\n\nDetected bands by lane:\n";

    if (data.results) {
      data.results.forEach((lane) => {
        text += `- Lane ${lane.lane} (${lane.type}): `;
        if (!lane.bands || lane.bands.length === 0) {
          text += "no clear bands detected\n";
        } else {
          text += lane.bands.map((b) => `~${Math.round(b.estimated_bp)} bp`).join(", ") + "\n";
        }
      });
    }

    return text;
  }

  function bindAnalysisButtons() {
    const gelBtn = document.getElementById("labAnalyzeGelBtn");
    if (gelBtn) {
      gelBtn.onclick = async function () {
        const file = document.getElementById("labGelFile").files[0];
        if (!file) return setResult("Please upload a gel image first.");

        const form = new FormData();
        form.append("image", file);
        form.append("ladder_lane", document.getElementById("labGelLadderLane").value || "1");
        form.append("ladder_sizes", document.getElementById("labGelSizes").value || "");
        form.append("target_size", document.getElementById("labGelTarget").value || "");

        gelBtn.disabled = true;
        gelBtn.textContent = "Analyzing...";

        try {
          const res = await fetch("/analyze-gel", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Gel analysis failed.");
          setResult(formatGelResults(data), data.annotated_image_base64);
        } catch (e) {
          setResult("Gel analysis error: " + e.message);
        } finally {
          gelBtn.disabled = false;
          gelBtn.textContent = "Analyze Gel Image";
        }
      };
    }

    const assayBtn = document.getElementById("labAnalyzeAssayBtn");
    if (assayBtn) {
      assayBtn.onclick = async function () {
        const file = document.getElementById("labAssayFile").files[0];
        if (!file) return setResult("Please upload an assay image first.");

        const form = new FormData();
        form.append("file", file);
        form.append("assay_type", currentType || "auto");
        form.append("gene_target", document.getElementById("labGene").value || "");
        form.append("variant_target", document.getElementById("labVariant").value || "");
        form.append("expected_result", document.getElementById("labExpected").value || "");
        form.append("extra_notes", document.getElementById("labNotes").value || "");

        assayBtn.disabled = true;
        assayBtn.textContent = "Analyzing...";

        try {
          const res = await fetch("/analyze-assay", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Analysis failed.");
          setResult(data.answer || "No answer returned.");
        } catch (e) {
          setResult("PGx lab image analysis error: " + e.message);
        } finally {
          assayBtn.disabled = false;
          assayBtn.textContent = "Analyze PGx Lab Image";
        }
      };
    }
  }

  function bindChatIntent() {
    const input = document.getElementById("scdChatInput") || document.getElementById("chatInput");
    if (!input || input.dataset.labIntentBound === "1") return;

    input.dataset.labIntentBound = "1";

    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;

      if (!shouldOpenLabIntent(input.value)) return;
      const type = detectType(input.value);
      if (!type) return;

      setTimeout(() => openLab(type), 450);
    });
  }

  function bindLauncherButtons() {
    document.querySelectorAll("[data-lab-tool]").forEach((btn) => {
      if (btn.dataset.boundLabWindow === "1") return;
      btn.dataset.boundLabWindow = "1";
      btn.addEventListener("click", function () {
        openLab(btn.getAttribute("data-lab-tool") || "auto");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    buildWindow();
    bindChatIntent();
    bindLauncherButtons();
  });

  window.addEventListener("load", function () {
    buildWindow();
    bindChatIntent();
    bindLauncherButtons();
  });

  setInterval(function () {
    bindChatIntent();
    bindLauncherButtons();
  }, 1000);

  window.scaiaOpenLabInterpreter = openLab;
})();
