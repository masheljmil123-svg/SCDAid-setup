
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

    if (type === "sanger") {
      return `
        <h3>Sanger Chromatogram requirements</h3>
        <p>SCAIA can assess chromatogram readability and possible mixed peak patterns.</p>
        <ol>
          <li>Upload a Sanger chromatogram image.</li>
          <li>Add gene target if known, e.g., CYP2D6.</li>
          <li>Add variant / rsID / allele if known, e.g., rs3892097 or *4.</li>
          <li>Add expected base change if available, e.g., G>A.</li>
          <li>Add notes such as position, read direction, or sample ID.</li>
        </ol>
        <p><b>Note:</b> SCAIA cannot confirm final genotype from a screenshot alone.</p>
      `;
    }

    if (type === "qpcr") {
      return `
        <h3>qPCR Amplification Curve requirements</h3>
        <p>SCAIA can assess visible amplification pattern and whether key controls are present.</p>
        <ol>
          <li>Upload a qPCR amplification curve image or screenshot.</li>
          <li>Add gene/assay target, e.g., CYP2D6 or CYP2D6*4 assay.</li>
          <li>Add Ct/Cq value if known.</li>
          <li>Add threshold information if available.</li>
          <li>Add control notes: positive control, negative control/NTC, and replicates.</li>
        </ol>
        <p><b>Note:</b> Final interpretation needs assay target, threshold, controls, and lab validation.</p>
      `;
    }

    if (type === "allelic_discrimination") {
      return `
        <h3>Allelic Discrimination Plot requirements</h3>
        <p>SCAIA can assess cluster separation and whether a sample appears near WT, heterozygous, mutant, or no-call regions.</p>
        <ol>
          <li>Upload an allelic discrimination plot image or screenshot.</li>
          <li>Add gene/assay target, e.g., CYP2D6*4 or rs3892097.</li>
          <li>Add dye/channel labels if known, e.g., FAM = mutant, VIC/HEX = wild-type.</li>
          <li>Add control labels if available: WT control, mutant control, heterozygous control, NTC.</li>
          <li>Add sample ID or notes if one sample should be interpreted.</li>
        </ol>
        <p><b>Note:</b> SCAIA can describe cluster pattern only. Final genotype requires validated assay controls and lab confirmation.</p>
      `;
    }

    if (type === "hrm") {
      return `
        <h3>HRM / Melt Curve requirements</h3>
        <p>SCAIA can assess melt curve shape, possible Tm shift, and whether the pattern appears different from controls.</p>
        <ol>
          <li>Upload an HRM or melt curve image/screenshot.</li>
          <li>Add gene/assay target, e.g., CYP2D6 variant assay.</li>
          <li>Add expected WT Tm or reference curve if known.</li>
          <li>Add sample Tm value if available.</li>
          <li>Add control notes: WT control, variant control, heterozygous control, NTC.</li>
        </ol>
        <p><b>Note:</b> HRM can suggest differences in melting behavior, but final genotype requires validated controls and confirmation.</p>
      `;
    }

    if (type === "cnv") {
      return `
        <h3>CNV / Copy Number requirements</h3>
        <p>SCAIA can assess copy-number result screenshots and explain whether the pattern suggests normal copy number, deletion, duplication, or no-call.</p>
        <ol>
          <li>Upload a CNV result image/screenshot, qPCR CNV plot, MLPA summary, or copy-number table screenshot.</li>
          <li>Add gene target, e.g., CYP2D6.</li>
          <li>Add expected normal copy number if known, e.g., 2 copies.</li>
          <li>Add reference gene or calibrator sample if available.</li>
          <li>Add threshold/cutoff notes, controls, or sample ID.</li>
        </ol>
        <p><b>Note:</b> CNV interpretation requires validated thresholds, controls, and confirmatory lab workflow.</p>
      `;
    }

    if (type === "ngs_table") {
      return `
        <h3>NGS Variant Table requirements</h3>
        <p>SCAIA can review visible NGS result tables and explain variant fields, zygosity, coverage, and interpretation limitations.</p>
        <ol>
          <li>Upload an NGS variant table screenshot or report table image.</li>
          <li>Add gene target, e.g., CYP2D6, CYP2C19, CYP2C9, or VKORC1.</li>
          <li>Add variant/rsID if known, e.g., rs3892097.</li>
          <li>Add coverage/depth, allele frequency, or zygosity if shown.</li>
          <li>Add notes about panel type, reference genome, or filter status if available.</li>
        </ol>
        <p><b>Note:</b> SCAIA can explain visible table fields, but final PGx phenotype requires validated variant calling and allele translation.</p>
      `;
    }

    const label = assayLabels[type] || assayLabels.auto;

    return `
      <h3>${label} requirements</h3>
      <p>SCAIA will give a preliminary interpretation based on the uploaded image.</p>
      <ol>
        <li>Upload the assay image or screenshot.</li>
        <li>Add gene target if known, e.g., CYP2D6.</li>
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
    if (type === "sanger") {
      return `
        <h3>Sanger Chromatogram Interpreter</h3>
        <div class="scaiaLabFormGrid">
          <input class="full" id="labAssayFile" type="file" accept="image/png,image/jpeg,image/jpg,image/webp">
          <input id="labGene" type="text" placeholder="Gene target, e.g., CYP2D6">
          <input id="labVariant" type="text" placeholder="Variant / rsID / allele, e.g., rs3892097 or *4">
          <input id="labExpected" type="text" placeholder="Expected change, e.g., G>A or reference/alternate base">
          <input id="labNotes" type="text" placeholder="Position / sample ID / forward or reverse read / notes">
        </div>
        <button class="scaiaLabAnalyzeBtn" id="labAnalyzeAssayBtn">Analyze Sanger Chromatogram</button>
        <div class="scaiaLabResult" id="labResultBox">Upload a chromatogram image. SCAIA will assess peak clarity, possible mixed peaks, and missing information.</div>
      `;
    }

    if (type === "qpcr") {
      return `
        <h3>qPCR Curve Interpreter</h3>
        <div class="scaiaLabFormGrid">
          <input class="full" id="labAssayFile" type="file" accept="image/png,image/jpeg,image/jpg,image/webp">
          <input id="labGene" type="text" placeholder="Gene/assay target, e.g., CYP2D6 or CYP2D6*4">
          <input id="labVariant" type="text" placeholder="Variant/allele or assay channel, e.g., FAM/HEX">
          <input id="labExpected" type="text" placeholder="Ct/Cq value or threshold, e.g., Ct 27.4">
          <input id="labNotes" type="text" placeholder="Controls: positive control, NTC, sample ID, replicate notes">
        </div>
        <button class="scaiaLabAnalyzeBtn" id="labAnalyzeAssayBtn">Analyze qPCR Curve</button>
        <div class="scaiaLabResult" id="labResultBox">Upload a qPCR amplification plot. SCAIA will assess amplification pattern, Ct/Cq context, controls, and missing information.</div>
      `;
    }

    if (type === "allelic_discrimination") {
      return `
        <h3>Allelic Discrimination Plot Interpreter</h3>
        <div class="scaiaLabFormGrid">
          <input class="full" id="labAssayFile" type="file" accept="image/png,image/jpeg,image/jpg,image/webp">
          <input id="labGene" type="text" placeholder="Gene/assay target, e.g., CYP2D6*4">
          <input id="labVariant" type="text" placeholder="Variant/rsID, e.g., rs3892097">
          <input id="labExpected" type="text" placeholder="Channel labels, e.g., FAM mutant / VIC wild-type">
          <input id="labNotes" type="text" placeholder="Controls or sample notes: WT, mutant, heterozygous, NTC">
        </div>
        <button class="scaiaLabAnalyzeBtn" id="labAnalyzeAssayBtn">Analyze Allelic Plot</button>
        <div class="scaiaLabResult" id="labResultBox">Upload an allelic discrimination plot. SCAIA will assess cluster separation, possible genotype region, controls, and no-call limitations.</div>
      `;
    }

    if (type === "hrm") {
      return `
        <h3>HRM / Melt Curve Interpreter</h3>
        <div class="scaiaLabFormGrid">
          <input class="full" id="labAssayFile" type="file" accept="image/png,image/jpeg,image/jpg,image/webp">
          <input id="labGene" type="text" placeholder="Gene/assay target, e.g., CYP2D6 HRM assay">
          <input id="labVariant" type="text" placeholder="Variant/allele if known, e.g., CYP2D6*4">
          <input id="labExpected" type="text" placeholder="Expected WT/sample Tm, e.g., WT 78.5°C, sample 77.9°C">
          <input id="labNotes" type="text" placeholder="Controls: WT, variant, heterozygous, NTC, replicate notes">
        </div>
        <button class="scaiaLabAnalyzeBtn" id="labAnalyzeAssayBtn">Analyze HRM / Melt Curve</button>
        <div class="scaiaLabResult" id="labResultBox">Upload an HRM/melt curve image. SCAIA will assess curve shape, Tm shift, controls, and whether interpretation is limited.</div>
      `;
    }

    if (type === "cnv") {
      return `
        <h3>CNV / Copy Number Interpreter</h3>
        <div class="scaiaLabFormGrid">
          <input class="full" id="labAssayFile" type="file" accept="image/png,image/jpeg,image/jpg,image/webp">
          <input id="labGene" type="text" placeholder="Gene target, e.g., CYP2D6">
          <input id="labVariant" type="text" placeholder="CNV type if known, e.g., deletion or duplication">
          <input id="labExpected" type="text" placeholder="Expected normal copy number / observed value, e.g., 2 copies or CN=3">
          <input id="labNotes" type="text" placeholder="Reference gene, calibrator, cutoff, controls, sample ID">
        </div>
        <button class="scaiaLabAnalyzeBtn" id="labAnalyzeAssayBtn">Analyze CNV / Copy Number</button>
        <div class="scaiaLabResult" id="labResultBox">Upload a CNV/copy-number result. SCAIA will assess copy-number pattern, controls, thresholds, and limitations.</div>
      `;
    }

    if (type === "ngs_table") {
      return `
        <h3>NGS Variant Table Interpreter</h3>
        <div class="scaiaLabFormGrid">
          <input class="full" id="labAssayFile" type="file" accept="image/png,image/jpeg,image/jpg,image/webp">
          <input id="labGene" type="text" placeholder="Gene target, e.g., CYP2D6 or CYP2C19">
          <input id="labVariant" type="text" placeholder="Variant/rsID/allele, e.g., rs3892097 or *4">
          <input id="labExpected" type="text" placeholder="Coverage / VAF / zygosity, e.g., DP 120, VAF 50%, heterozygous">
          <input id="labNotes" type="text" placeholder="Panel, reference genome, filter status, transcript, sample ID">
        </div>
        <button class="scaiaLabAnalyzeBtn" id="labAnalyzeAssayBtn">Analyze NGS Variant Table</button>
        <div class="scaiaLabResult" id="labResultBox">Upload an NGS variant table screenshot. SCAIA will assess visible fields, zygosity/coverage context, and PGx interpretation limits.</div>
      `;
    }

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
