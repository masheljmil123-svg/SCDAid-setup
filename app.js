// SCDAid - app.js
// - Main SCDAid algorithm
// - CYP2D6 activity score + phenotype
// - OPRM1 + COMT informational modifiers
// - Auto-save every Run Algorithm case to SCDAid Learn dataset

const $ = (id) => document.getElementById(id);

let lang = "EN";

const LINKS = {
  MOH: "https://www.moh.gov.sa/Ministry/MediaCenter/Publications/Documents/Protocol-001.pdf",
  CPIC: "https://ascpt.onlinelibrary.wiley.com/doi/10.1002/cpt.2149",
  ASH: "https://ashpublications.org/bloodadvances/article/4/12/2656/461665",
  OWSIANY: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6917891/",
};

const API_BASE = "https://scdaid-api.onrender.com";

const TXT = {
  EN: {
    title: "SCDAid",
    subtitle:
      "SCD VOC analgesia decision support — Severity + CPIC (CYP2D6) + Renal & Safety guardrails",
    patientInputsTitle: "Patient Inputs",
    ageLabel: "Age (years) *",
    weightLabel: "Weight *",
    weightHint: "Used to calculate adult starting doses.",
    egfrLabel: "eGFR (mL/min/1.73m²) *",
    egfrHint: "Enter eGFR (mL/min/1.73m²).",
    doseUnitLabel: "Output Dose Unit",
    doseUnitHint: "Controls the unit used when displaying calculated doses.",
    crisesLabel: "Pain crises/year (optional)",
    severityLabel: "Pain severity *",
    genoAvailLabel: "CYP2D6 genotype availability",
    genoAvailHint: "If unknown, tool avoids CYP2D6-dependent opioids.",
    cypLabel: "CYP2D6 phenotype",
    opioidTolLabel: "Opioid tolerant",
    sedativesLabel: "Concurrent sedatives",
    respRiskLabel: "Respiratory risk",
    acsLabel: "Suspected ACS",
    morphineAllergyLabel: "Morphine allergy",
    runBtn: "Run Algorithm",
    resetBtn: "Reset",
    disclaimerText: "Educational prototype only. Not a substitute for clinical judgment.",
    resultsTitle: "Results",
    placeholderText: 'Enter inputs then click "Run Algorithm".',
    refsTitle: "References",

    phenoPredTitle: "Functional CYP2D6 Phenotype Prediction",
    phenoPredHint:
      "Optional: use API to predict CYP2D6 phenotype and auto-fill the field above.",
    sexLabel: "Sex",
    inhibitorLabel: "CYP2D6 inhibitor",
    inhibitorHint: "Examples: strong CYP2D6 inhibitors may reduce CYP2D6 activity.",
    codeineRespLabel: "Prior codeine response",
    tramadolRespLabel: "Prior tramadol response",
    predictBtn: "Predict",
    predictStatusIdle: "API-based phenotype prediction.",
    predictLoading: "Predicting…",
    predictApplied: "Applied to CYP2D6 phenotype.",
    predictApiDown: "API not reachable. Check server status.",
    predictBad: "Prediction failed. Check API logs.",

    genoBoxTitle: "If CYP2D6 genotype is unavailable",
    genoBoxIntro:
      "Clinical indicators suggestive of altered CYP2D6 activity (informational only; does not replace genotyping):",
    genoBoxItems: [
      `<b>Past response (strongest clue)</b><br>
       • Possible UM: marked sedation/respiratory depression or severe nausea on small doses of codeine/tramadol.<br>
       • Possible PM: no analgesic effect despite maximum recommended doses of codeine/tramadol.`,
      `<b>Drug–drug interactions (phenoconversion)</b><br>
       • Strong CYP2D6 inhibitors (e.g., fluoxetine, paroxetine) may make a normal genotype behave like PM.`,
      `<b>Ethnicity/geography</b><br>
       • Some Middle Eastern/North African populations show higher prevalence of UM alleles; use caution with first-time codeine.`,
      `<b>Organ function (secondary modifiers)</b><br>
       • Liver/renal impairment can amplify toxicity or mask expected response; monitor closely.`,
      `<b>Therapeutic drug monitoring (rare)</b><br>
       • In specialized centers, high codeine with near-zero morphine may suggest PM.`,
    ],
    genoBoxNote:
      "<b>Clinical note:</b> If genotype is unknown and codeine/tramadol is being considered, prefer non-CYP2D6-dependent options and monitor closely.",

    pills: {
      low: "Low renal risk",
      moderate: "Moderate renal risk",
      high: "High renal risk",
      ok: "OK",
      avoid: "Avoid",
    },
    sections: {
      renal: "Renal Stratification",
      genetics: "Genetics Summary",
      neph: "Nephropathy add-ons",
      dosing: "Adult IV Opioid Starting Dose",
      plan: "Recommended Plan",
      options: "Optional Next Steps",
      monitoring: "General VOC Monitoring",
      safety: "Medication Safety Monitoring",
      avoid: "Avoid / Contraindications",
      medicationWarningsTitle: "Medication-Specific Warnings & Avoidance",
      stops: "Safety Stops",
      critical: "Critical Safety Flags",
    },
    errors: {
      age: "Age is required.",
      weight: "Weight is required.",
      egfr: "eGFR is required.",
      ageInvalid: "Age must be a positive number.",
      weightInvalid: "Weight must be a positive number.",
      egfrInvalid: "eGFR must be zero or greater.",
      spo2Invalid: "SpO₂ must be a valid number when entered.",
      spo2Range: "SpO₂ must be between 0 and 100 when entered.",
    },
    cyp2d6MismatchWarning:
      "Manual CYP2D6 phenotype conflicts with allele-derived CPIC translation. Review genotype/phenotype inputs before using the recommendation.",
  },

  AR: {
    title: "SCDAid",
    subtitle:
      "أداة دعم قرار لألم نوبة الانسداد الوعائي — الشدة + CYP2D6 (CPIC) + اعتبارات الكلى والسلامة",
    patientInputsTitle: "بيانات المريض",
    ageLabel: "العمر (سنة) *",
    weightLabel: "الوزن *",
    weightHint: "يستخدم لحساب جرعات البداية للكبار.",
    egfrLabel: "eGFR (مل/دقيقة/1.73م²) *",
    egfrHint: "ادخل eGFR (مل/دقيقة/1.73م²).",
    doseUnitLabel: "وحدة الجرعة (المخرجات)",
    doseUnitHint: "تحدد وحدة عرض الجرعات المحسوبة.",
    crisesLabel: "عدد النوبات/سنة (اختياري)",
    severityLabel: "شدة الألم *",
    genoAvailLabel: "توفر جينوتايب CYP2D6",
    genoAvailHint: "إذا غير معروف، تتجنب الأداة الخيارات المعتمدة على CYP2D6.",
    cypLabel: "فينوتايب CYP2D6",
    opioidTolLabel: "تحمل للأفيونات",
    sedativesLabel: "مهدئات مصاحبة",
    respRiskLabel: "خطورة تنفسية",
    acsLabel: "اشتباه ACS",
    morphineAllergyLabel: "حساسية مورفين",
    runBtn: "تشغيل الخوارزمية",
    resetBtn: "مسح",
    disclaimerText: "نموذج تعليمي فقط. لا يغني عن الحكم السريري.",
    resultsTitle: "النتائج",
    placeholderText: "ادخل البيانات ثم اضغط تشغيل الخوارزمية.",
    refsTitle: "المراجع",

    phenoPredTitle: "التنبؤ الوظيفي لفينوتايب CYP2D6",
    phenoPredHint: "اختياري: استخدمي الـ API للتنبؤ بـ CYP2D6 وتعبئة الخانة تلقائيًا.",
    sexLabel: "الجنس",
    inhibitorLabel: "مثبط CYP2D6",
    inhibitorHint: "مثال: بعض المثبطات القوية تقلل نشاط CYP2D6.",
    codeineRespLabel: "استجابة سابقة للكودايين",
    tramadolRespLabel: "استجابة سابقة للترامادول",
    predictBtn: "تنبأ",
    predictStatusIdle: "تنبؤ الفينوتايب عبر API.",
    predictLoading: "جاري التنبؤ…",
    predictApplied: "تمت تعبئة الفينوتايب في الأعلى.",
    predictApiDown: "الـ API غير متاح. تأكدي من حالة السيرفر.",
    predictBad: "فشل التنبؤ. راجعي سجلات الـ API.",

    genoBoxTitle: "إذا كان جينوتايب CYP2D6 غير متوفر",
    genoBoxIntro:
      "مؤشرات سريرية قد توحي بتغيّر نشاط CYP2D6 (للتثقيف فقط ولا تغني عن الفحص الجيني):",
    genoBoxItems: [
      `<b>الاستجابة السابقة (أقوى مؤشر)</b><br>
       • احتمال UM: نعاس شديد/تثبيط تنفسي أو غثيان شديد مع جرعات صغيرة من الكودايين/الترامادول.<br>
       • احتمال PM: عدم وجود تسكين رغم الجرعات القصوى الموصى بها من الكودايين/الترامادول.`,
      `<b>تداخلات دوائية (Phenoconversion)</b><br>
       • مثبطات CYP2D6 القوية (مثل فلوكسيتين/باروكسيتين) قد تجعل النمط الطبيعي يتصرف كأنه PM.`,
      `<b>العرق/الجغرافيا</b><br>
       • بعض سكان الشرق الأوسط/شمال أفريقيا قد يكون لديهم انتشار أعلى لأليلات UM؛ الحذر مع أول استخدام للكودايين.`,
      `<b>وظائف الأعضاء (عوامل ثانوية)</b><br>
       • ضعف الكبد/الكلى قد يزيد السمية أو يخفي الاستجابة المتوقعة؛ راقبي عن قرب.`,
      `<b>المراقبة العلاجية (نادر)</b><br>
       • في مراكز متخصصة: كودايين مرتفع مع مورفين شبه صفري قد يوحي بـ PM.`,
    ],
    genoBoxNote:
      "<b>ملاحظة سريرية:</b> إذا كان الجينوتايب غير معروف ويتم التفكير بالكودايين/الترامادول، فالأفضل تفضيل خيارات غير معتمدة على CYP2D6 مع مراقبة لصيقة.",

    pills: {
      low: "خطورة كلوية منخفضة",
      moderate: "خطورة كلوية متوسطة",
      high: "خطورة كلوية عالية",
      ok: "مسموح",
      avoid: "تجنب",
    },
    sections: {
      renal: "تصنيف الكلى",
      genetics: "ملخص الجينات",
      neph: "إضافات النيفروباثي",
      dosing: "جرعة بداية IV للكبار",
      plan: "الخطة المقترحة",
      options: "خيارات إضافية",
      monitoring: "مراقبة عامة لنوبة VOC",
      safety: "مراقبة سلامة الأدوية",
      avoid: "تجنب / موانع",
      medicationWarningsTitle: "تحذيرات دوائية محددة وتجنب أدوية معينة",
      stops: "قواعد الإيقاف",
      critical: "تنبيهات سلامة حرجة",
    },
    errors: {
      age: "العمر مطلوب.",
      weight: "الوزن مطلوب.",
      egfr: "eGFR مطلوب.",
      ageInvalid: "العمر يجب أن يكون رقمًا موجبًا.",
      weightInvalid: "الوزن يجب أن يكون رقمًا موجبًا.",
      egfrInvalid: "eGFR يجب ألا يكون سالبًا.",
      spo2Invalid: "SpO₂ يجب أن يكون رقمًا صالحًا عند الإدخال.",
      spo2Range: "SpO₂ يجب أن يكون بين 0 و 100 عند الإدخال.",
    },
    cyp2d6MismatchWarning:
      "الفينوتايب اليدوي لـ CYP2D6 يتعارض مع الترجمة المشتقة من الأليل وفق CPIC. راجع المدخلات الجينية/الفينوتايبية قبل الاعتماد على التوصية.",
  },
};

// ---------- Utils ----------
function num(v) {
  const x = Number(String(v ?? "").trim());
  return Number.isFinite(x) ? x : null;
}

function normalizePhenotypeForMismatchCompare(ph) {
  if (ph == null || String(ph).trim() === "") return "";
  const u = String(ph).trim().toUpperCase();
  if (u === "NM") return "EM";
  return u;
}

function cyp2d6PhenotypesEquivalent(a, b) {
  return normalizePhenotypeForMismatchCompare(a) === normalizePhenotypeForMismatchCompare(b);
}

function collectSpo2InputState() {
  const el = $("spo2Input");
  if (!el) return { spo2Numeric: null, spo2Provided: false };
  const raw = String(el.value ?? "").trim();
  if (raw === "") return { spo2Numeric: null, spo2Provided: false };
  return { spo2Numeric: num(el.value), spo2Provided: true };
}

function patientFieldErrors({ age, weightKg, eGFR, spo2Numeric, spo2Provided }) {
  const t = TXT[lang];
  const errs = [];

  if (age === null) errs.push(t.errors.age);
  else if (!Number.isFinite(age) || age <= 0) errs.push(t.errors.ageInvalid);

  if (weightKg === null) errs.push(t.errors.weight);
  else if (!Number.isFinite(weightKg) || weightKg <= 0) errs.push(t.errors.weightInvalid);

  if (eGFR === null) errs.push(t.errors.egfr);
  else if (!Number.isFinite(eGFR) || eGFR < 0) errs.push(t.errors.egfrInvalid);

  if (spo2Provided) {
    if (spo2Numeric === null || !Number.isFinite(spo2Numeric)) errs.push(t.errors.spo2Invalid);
    else if (spo2Numeric < 0 || spo2Numeric > 100) errs.push(t.errors.spo2Range);
  }

  return errs;
}

function lbToKg(lb) {
  return lb * 0.45359237;
}

function riskRenal(eGFR) {
  if (eGFR === null) return "unknown";
  if (eGFR < 30) return "high";
  if (eGFR < 60) return "moderate";
  return "low";
}

function pillClass(risk) {
  if (risk === "high") return "danger";
  if (risk === "moderate") return "warn";
  return "ok";
}

function roundTo(x, step) {
  return Math.round(x / step) * step;
}

function mgToMcg(mg) {
  return mg * 1000;
}

function mgToG(mg) {
  return mg / 1000;
}

function mcgToMg(mcg) {
  return mcg / 1000;
}

function formatDoseMultiFromMg(mg) {
  const unit = $("doseUnit")?.value || "mg";
  if (!Number.isFinite(mg)) return "-";

  if (unit === "mcg") {
    const mcg = mgToMcg(mg);
    return `${mcg.toFixed(0)} mcg (${mg.toFixed(3)} mg)`;
  }

  if (unit === "g") {
    const g = mgToG(mg);
    return `${g.toFixed(3)} g (${mg.toFixed(0)} mg)`;
  }

  if (mg < 2) return `${mg.toFixed(2)} mg (${mgToMcg(mg).toFixed(0)} mcg)`;
  return `${mg.toFixed(2)} mg`;
}

// ---------- CYP2D6 ----------
const CYP2D6_ALLELE_ACTIVITY = {
  "*1": 1,
  "*2": 1,
  "*35": 1,

  "*9": 0.5,
  "*17": 0.5,
  "*29": 0.5,
  "*41": 0.5,

  "*10": 0.25,
  "*36": 0.25,

  "*3": 0,
  "*4": 0,
  "*5": 0,
  "*6": 0,
  "*7": 0,
  "*8": 0,
  "*11": 0,
  "*12": 0,
  "*14": 0,
  "*15": 0,
  "*19": 0,
  "*20": 0,
  "*40": 0,
  "*42": 0,

  "*22": null,
  "*25": null,
  "*31": null,
  "*44": null,
};

function normalizeAllele(a) {
  if (!a) return "";
  let x = String(a).trim().toUpperCase().replace(/\s+/g, "");
  if (x && !x.startsWith("*")) x = "*" + x;
  return x;
}

function parseAlleleWithCopies(raw) {
  const a = normalizeAllele(raw);
  const m = a.match(/^(\*\w+)X(\d+|N)$/i);

  if (m) {
    const allele = m[1].toUpperCase();
    const tok = m[2].toUpperCase();
    const copies = tok === "N" ? 2 : parseInt(tok, 10);

    return {
      allele,
      copies: Number.isFinite(copies) ? copies : 1,
    };
  }

  return {
    allele: a,
    copies: 1,
  };
}

function calcCYP2D6ActivityScoreFromAlleles(a1Raw, a2Raw) {
  const p1 = parseAlleleWithCopies(a1Raw);
  const p2 = parseAlleleWithCopies(a2Raw);

  if (!p1.allele || !p2.allele) return { score: null, reason: "missing" };

  const v1 = CYP2D6_ALLELE_ACTIVITY[p1.allele];
  const v2 = CYP2D6_ALLELE_ACTIVITY[p2.allele];

  if (v1 === null || v2 === null) return { score: null, reason: "uncertain" };
  if (v1 === undefined || v2 === undefined) return { score: null, reason: "unknown" };

  const score = v1 * p1.copies + v2 * p2.copies;
  return { score, reason: "ok" };
}

function cyp2d6PhenotypeFromAS(as) {
  if (as === null || Number.isNaN(as)) return null;

  if (as === 0) return "PM";
  if (as > 0 && as < 1.25) return "IM";
  if (as >= 1.25 && as <= 2.25) return "EM";
  if (as > 2.25) return "UM";
  return "EM";
}

function cyp2d6Label(ph) {
  const map = {
    PM: "Poor (PM)",
    IM: "Intermediate (IM)",
    EM: "Normal (NM/EM)",
    NM: "Normal (NM/EM)",
    UM: "Ultrarapid (UM)",
  };

  return map[ph] || ph;
}

// ---------- OPRM1 + COMT ----------
function oprm1Note(genotype) {
  if (!genotype || genotype === "None") return null;

  if (genotype === "AA") {
    return {
      title: "OPRM1 AA",
      note: "Expected opioid receptor sensitivity.",
      alert: "Use standard pain reassessment and routine opioid safety monitoring.",
    };
  }

  if (genotype === "AG") {
    return {
      title: "OPRM1 AG",
      note: "Possible reduced opioid receptor sensitivity.",
      alert:
        "Patient may need closer pain reassessment and careful titration. Do not increase opioid dose based on genotype alone.",
    };
  }

  if (genotype === "GG") {
    return {
      title: "OPRM1 GG",
      note: "Higher possibility of reduced opioid response.",
      alert:
        "Monitor pain control closely, but avoid automatic dose escalation without checking sedation, respiratory rate, and SpO2.",
    };
  }

  return {
    title: `OPRM1 ${genotype}`,
    note: "OPRM1 result detected.",
    alert: "Informational only; do not use as a hard rule for opioid selection.",
  };
}

function comtNote(genotype) {
  if (!genotype || genotype === "None") return null;

  if (genotype === "Val/Val") {
    return {
      title: "COMT Val/Val",
      note: "May be associated with differences in pain sensitivity.",
      alert: "Clinical pain score remains the main guide. Do not assume pain is less severe from COMT alone.",
    };
  }

  if (genotype === "Val/Met") {
    return {
      title: "COMT Val/Met",
      note: "Intermediate pain sensitivity profile.",
      alert: "Reassess pain response clinically. Do not use COMT alone to determine opioid dose.",
    };
  }

  if (genotype === "Met/Met") {
    return {
      title: "COMT Met/Met",
      note: "Possible higher pain sensitivity.",
      alert:
        "Patient may report stronger pain; reassess frequently and avoid undertreatment while monitoring sedation and respiration.",
    };
  }

  return {
    title: `COMT ${genotype}`,
    note: "COMT result detected.",
    alert: "Informational only; do not use as a hard rule for opioid selection.",
  };
}

// ---------- Decision logic ----------
function chooseOpioid(renalRisk, morphineAllergy) {
  if (morphineAllergy) return "Hydromorphone";
  if (renalRisk === "high") return "Fentanyl";
  if (renalRisk === "moderate") return "Hydromorphone";
  return "Morphine";
}

function allowNSAID(inputs, renalRisk) {
  const renalOk = renalRisk === "low" || renalRisk === "moderate";
  if (inputs.nephropathy) return false;
  return renalOk && !inputs.respRisk && !inputs.suspectedACS;
}

function chooseNSAIDName(severity) {
  return severity === "mild" ? "NSAIDs" : "Ketorolac";
}

function canOfferOxycodone(inputs, renalRisk) {
  if (renalRisk === "high") return false;
  if (inputs.respRisk || inputs.suspectedACS) return false;
  return inputs.severity !== "severe";
}

function buildPlan(inputs) {
  const renalRisk = riskRenal(inputs.eGFR);
  const meds = [];
  const options = [];
  const avoid = [];
  const nephAddons = [];

  meds.push({
    name: "Acetaminophen",
    text: "Acetaminophen: 650–1000 mg PO q6–8 h (or 1 g IV q6 h). Max 3–4 g/day.",
  });

  const nsaidAllowed = allowNSAID(inputs, renalRisk);

  if (nsaidAllowed) {
    const n = chooseNSAIDName(inputs.severity);

    if (n === "Ketorolac") {
      meds.push({
        name: "Ketorolac",
        text: "Ketorolac ED adjunct: 15–30 mg IV (use 15 mg if eGFR 30–59). Avoid if eGFR <30.",
      });
    } else {
      meds.push({
        name: "NSAIDs",
        text: "Ibuprofen: 400–600 mg PO q6–8 h PRN (short-term). Avoid if renal/bleeding risk.",
      });
    }
  } else {
    meds.push({
      name: "NSAIDs",
      text: inputs.nephropathy
        ? "NSAIDs: avoid/minimize due to nephropathy flag (renal protection)."
        : "NSAIDs: avoid due to renal/ACS/respiratory risk.",
    });
  }

  if (inputs.severity === "severe" && inputs.opioidTol) {
    meds.push({
      name: "Ketamine",
      text: "Low-dose ketamine: 0.1–0.3 mg/kg IV bolus or 0.1–0.3 mg/kg/hr infusion (monitor BP + emergence).",
    });
  }

  if (canOfferOxycodone(inputs, renalRisk)) {
    options.push("If stable and tolerating PO: consider oxycodone IR 5–10 mg PO q4–6 h (avoid/very low dose if eGFR <30).");
  }

  if (inputs.nephropathy) {
    nephAddons.push("Consider ACEi/ARB if albuminuria/proteinuria is present (per local protocol).");
    nephAddons.push("Monitor serum creatinine and potassium after ACEi/ARB initiation or dose changes.");
    nephAddons.push("Avoid/minimize nephrotoxins when possible (especially NSAIDs), particularly if renal function is impaired.");
  }

  avoid.push("Meperidine: strongly not recommended due to neurotoxicity (normeperidine accumulation).");
  avoid.push(
    "Codeine & tramadol: not recommended in acute VOC due to CYP2D6 variability and unpredictable efficacy/safety. Consider only if no IV options and genotype known."
  );

  if (renalRisk === "high") {
    avoid.push("Renal high risk (eGFR <30 or AKI suspected): avoid NSAIDs and avoid morphine metabolite accumulation.");
  }

  if (inputs.nephropathy) {
    avoid.push("Nephropathy: avoid/minimize NSAIDs when possible; prioritize renal-safe options and monitoring.");
  }

  return {
    renalRisk,
    meds,
    options,
    avoid,
    nsaidAllowed,
    nephAddons,
  };
}

// ---------- Inputs ----------
function readInputs() {
  const age = num($("ageInput")?.value);

  let weight = num($("weightInput")?.value);
  const unit = $("weightUnit")?.value || "kg";

  if (weight !== null && unit === "lb") {
    weight = lbToKg(weight);
  }

  const eGFR = num($("gfrInput")?.value);
  const genoAvail = $("genoAvail")?.value || "known";

  const phenoEl = $("cyp2d6Input");
  const cyp2d6ManualSelection =
    genoAvail === "unknown" || !phenoEl
      ? null
      : phenoEl.dataset.manualCyp2d6Phenotype != null && String(phenoEl.dataset.manualCyp2d6Phenotype).trim() !== ""
        ? String(phenoEl.dataset.manualCyp2d6Phenotype).trim()
        : (phenoEl.value || "EM").trim();

  let phenotype = genoAvail === "unknown" ? "EM" : cyp2d6ManualSelection || "EM";

  const allele1 = ($("cyp2d6_allele1")?.value || "").trim();
  const allele2 = ($("cyp2d6_allele2")?.value || "").trim();

  let activityScore = null;
  let cyp2d6MismatchWarning = null;
  const t = TXT[lang];

  if (genoAvail !== "unknown" && allele1 && allele2) {
    const out = calcCYP2D6ActivityScoreFromAlleles(allele1, allele2);
    activityScore = out.score;

    if (activityScore !== null) {
      const phFromAS = cyp2d6PhenotypeFromAS(activityScore);

      if (phFromAS) {
        if (!cyp2d6PhenotypesEquivalent(cyp2d6ManualSelection, phFromAS)) {
          cyp2d6MismatchWarning = t.cyp2d6MismatchWarning;
        }
        phenotype = phFromAS;
      }

      if ($("genoAvail")) {
        $("genoAvail").value = "known";
      }

      if ($("cyp2d6Input")) {
        $("cyp2d6Input").disabled = false;
        $("cyp2d6Input").value = phenotype;
      }
    }
  }

  const spo2State = collectSpo2InputState();

  const oprm1Genotype = $("oprm1_genotype")?.value || "";
  const comtGenotype = $("comt_genotype")?.value || "";
  const nephropathy = !!$("flag_nephropathy")?.checked;

  return {
    age,
    weightKg: weight,
    eGFR,
    crises: num($("crisesInput")?.value),
    severity: $("severityInput")?.value || "moderate",
    genoAvail,
    phenotype,
    activityScore,
    cyp2d6ManualSelection,
    cyp2d6MismatchWarning,
    spo2Numeric: spo2State.spo2Numeric,
    spo2Provided: spo2State.spo2Provided,
    oprm1Genotype,
    comtGenotype,
    nephropathy,

    opioidTol: !!$("opioidTol")?.checked,
    sedatives: !!$("sedatives")?.checked,
    respRisk: !!$("respRisk")?.checked,
    suspectedACS: !!$("suspectedACS")?.checked,
    morphineAllergy: !!$("morphineAllergy")?.checked,
  };
}

function validate(inputs) {
  return patientFieldErrors({
    age: inputs.age,
    weightKg: inputs.weightKg,
    eGFR: inputs.eGFR,
    spo2Numeric: inputs.spo2Numeric,
    spo2Provided: inputs.spo2Provided,
  });
}

// ---------- Auto-save to SCDAid Learn ----------
function normalizePhenotypeForLearn(ph) {
  if (ph === "EM") return "NM";
  if (ph === "NM") return "NM";
  return ph || "";
}

function saveCaseToLearnDataset(inputs, model) {
  const existingCases = JSON.parse(localStorage.getItem("scdaid_learn_cases") || "[]");

  const learnCase = {
    age: inputs.age ?? "",
    sex: $("sexInput")?.value || "",
    weight: inputs.weightKg ? Math.round(inputs.weightKg) : "",
    egfr: inputs.eGFR ?? "",
    inhibitor: $("inhibitorInput")?.value || "no",
    codeine: $("codeineRespInput")?.value || "unknown",
    tramadol: $("tramadolRespInput")?.value || "unknown",
    oprm1: inputs.oprm1Genotype || "",
    comt: inputs.comtGenotype || "",
    predicted: normalizePhenotypeForLearn(inputs.phenotype),
    actual: "",
    reviewed: "no",

    source: "SCDAid main tool",
    severity: inputs.severity || "",
    renalRisk: model.renalRisk || "",
    opioid: model.opioid || "",
    nephropathy: inputs.nephropathy ? "yes" : "no",
    suspectedACS: inputs.suspectedACS ? "yes" : "no",
    morphineAllergy: inputs.morphineAllergy ? "yes" : "no",
    timestamp: new Date().toISOString(),
  };

  existingCases.push(learnCase);
  localStorage.setItem("scdaid_learn_cases", JSON.stringify(existingCases));
}

// ---------- API Prediction ----------
function setPredictStatus({ predicted, confidence, probabilities, note, mode }) {
  const el = $("predictStatus");
  if (!el) return;

  if (mode === "loading") {
    el.innerHTML = `<span class="tag info">${TXT[lang].predictLoading}</span>`;
    return;
  }

  if (mode === "error") {
    el.innerHTML = `<span class="tag low">${note || TXT[lang].predictBad}</span>`;
    return;
  }

  if (mode === "idle") {
    el.innerHTML = `<span class="small">${TXT[lang].predictStatusIdle}</span>`;
    return;
  }

  const confClass =
    confidence === "high" ? "high" : confidence === "medium" ? "medium" : "low";

  const probsText = probabilities
    ? `PM ${Math.round((probabilities.PM || 0) * 100)}% · IM ${Math.round(
        (probabilities.IM || 0) * 100
      )}% · NM ${Math.round((probabilities.NM || 0) * 100)}% · UM ${Math.round(
        (probabilities.UM || 0) * 100
      )}%`
    : "";

  el.innerHTML = `
    <span class="tag info">Predicted: ${predicted}</span>
    <span class="tag ${confClass}">Confidence: ${confidence}</span>
    ${probsText ? `<span class="small">${probsText}</span>` : ""}
    ${note ? `<span class="small">${note}</span>` : ""}
  `;
}

async function predictPhenotype() {
  // Keep backward compatibility for older listeners, but route all final prediction
  // through the backend /predict pipeline.
  return runThreeSCDAidModels();
}

// ---------- Language ----------
function safeText(id, value) {
  const el = $(id);
  if (el && value !== undefined && value !== null) {
    el.textContent = value;
  }
}

function safeHTML(id, value) {
  const el = $(id);
  if (el && value !== undefined && value !== null) {
    el.innerHTML = value;
  }
}

function setLang(newLang) {
  lang = newLang;
  const t = TXT[lang];

  document.documentElement.dir = lang === "AR" ? "rtl" : "ltr";
  document.documentElement.lang = lang === "AR" ? "ar" : "en";

  safeText("titleText", t.title);
  safeText("subtitleText", t.subtitle);

  safeText("patientInputsTitle", t.patientInputsTitle);
  safeText("ageLabel", t.ageLabel);
  safeText("weightLabel", t.weightLabel);
  safeText("weightHint", t.weightHint);
  safeText("egfrLabel", t.egfrLabel);
  safeText("egfrHint", t.egfrHint);
  safeText("doseUnitLabel", t.doseUnitLabel);
  safeText("doseUnitHint", t.doseUnitHint);
  safeText("crisesLabel", t.crisesLabel);
  safeText("severityLabel", t.severityLabel);

  safeText("genoAvailLabel", t.genoAvailLabel);
  safeText("genoAvailHint", t.genoAvailHint);
  safeText("cypLabel", t.cypLabel);

  safeText("opioidTolLabel", t.opioidTolLabel);
  safeText("sedativesLabel", t.sedativesLabel);
  safeText("respRiskLabel", t.respRiskLabel);
  safeText("acsLabel", t.acsLabel);
  safeText("morphineAllergyLabel", t.morphineAllergyLabel);

  safeText("runBtn", t.runBtn);
  safeText("resetBtn", t.resetBtn);
  safeText("disclaimerText", t.disclaimerText);

  safeText("resultsTitle", t.resultsTitle);
  safeText("refsTitle", t.refsTitle);

  safeText("phenoPredTitle", t.phenoPredTitle);
  safeText("phenoPredHint", t.phenoPredHint);
  safeText("sexLabel", t.sexLabel);

  // Old fields may not exist in the new detailed HTML, so these must be safe.
  safeText("inhibitorLabel", t.inhibitorLabel);
  safeText("inhibitorHint", t.inhibitorHint);

  safeText("codeineRespLabel", t.codeineRespLabel);
  safeText("tramadolRespLabel", t.tramadolRespLabel);
  safeText("predictBtn", t.predictBtn);

  safeText("genoBoxTitle", t.genoBoxTitle);
  safeText("genoBoxIntro", t.genoBoxIntro);

  const genoBoxList = $("genoBoxList");
  if (genoBoxList) {
    genoBoxList.innerHTML = (t.genoBoxItems || [])
      .map((x) => `<li>${x}</li>`)
      .join("");
  }

  safeHTML("genoBoxNote", t.genoBoxNote);

  const results = $("results");
  const placeholder = $("placeholderText");

  if (results && placeholder && results.querySelector(".placeholder")) {
    placeholder.textContent = t.placeholderText;
  }

  safeText("langToggle", lang === "AR" ? "EN" : "AR");

  if (typeof setPredictStatus === "function") {
    setPredictStatus({
      mode: "idle",
    });
  }
}
function run() {
  // Frontend keeps validation/formatting, but final recommendation comes from backend.
  runThreeSCDAidModels();
}

function reset() {
  ["ageInput", "weightInput", "gfrInput", "crisesInput"].forEach((id) => {
    if ($(id)) $(id).value = "";
  });

  $("severityInput").value = "moderate";
  $("weightUnit").value = "kg";
  $("doseUnit").value = "mg";

  $("genoAvail").value = "known";
  $("cyp2d6Input").value = "EM";
  $("cyp2d6Input").disabled = false;
  delete $("cyp2d6Input").dataset.manualCyp2d6Phenotype;

  if ($("cyp2d6_allele1")) $("cyp2d6_allele1").value = "";
  if ($("cyp2d6_allele2")) $("cyp2d6_allele2").value = "";

  if ($("oprm1_genotype")) $("oprm1_genotype").value = "";
  if ($("comt_genotype")) $("comt_genotype").value = "";

  if ($("optional_gene_select")) $("optional_gene_select").value = "";
  if ($("optional_gene_genotype")) $("optional_gene_genotype").innerHTML = "";

  if ($("flag_nephropathy")) $("flag_nephropathy").checked = false;

  if ($("sexInput")) $("sexInput").value = "F";
  if ($("inhibitorInput")) $("inhibitorInput").value = "no";
  if ($("codeineRespInput")) $("codeineRespInput").value = "ineffective";
  if ($("tramadolRespInput")) $("tramadolRespInput").value = "ineffective";

  setPredictStatus({
    mode: "idle",
  });

  ["opioidTol", "sedatives", "respRisk", "suspectedACS", "morphineAllergy"].forEach(
    (id) => {
      if ($(id)) $(id).checked = false;
    }
  );

  $("results").innerHTML = `<div id="placeholderText" class="placeholder">${TXT[lang].placeholderText}</div>`;
}

function initLinks() {
  const moh = $("mohLink");
  const cpic = $("cpicLink");
  const ash = $("ashLink");
  const ows = $("owsianyLink");
  if (moh) moh.href = LINKS.MOH;
  if (cpic) cpic.href = LINKS.CPIC;
  if (ash) ash.href = LINKS.ASH;
  if (ows) ows.href = LINKS.OWSIANY;
}

function initOptionalGeneUI() {
  const geneSel = $("optional_gene_select");
  const genoSel = $("optional_gene_genotype");

  if (!geneSel || !genoSel) return;

  function setOptions(list) {
    genoSel.innerHTML = "";

    list.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      genoSel.appendChild(opt);
    });
  }

  geneSel.addEventListener("change", () => {
    const g = geneSel.value;

    if (!g) {
      genoSel.innerHTML = "";
      return;
    }

    if (g === "OPRM1") setOptions(["AA", "AG", "GG"]);
    if (g === "COMT") setOptions(["Val/Val", "Val/Met", "Met/Met"]);
  });
}

function initAlleleUI() {
  const a1 = $("cyp2d6_allele1");
  const a2 = $("cyp2d6_allele2");
  const phenoSel = $("cyp2d6Input");

  if (!a1 || !a2 || !phenoSel) return;

  phenoSel.addEventListener("change", () => {
    phenoSel.dataset.manualCyp2d6Phenotype = phenoSel.value;
  });

  function apply() {
    const genoAvail = $("genoAvail")?.value || "known";

    if (genoAvail === "unknown") return;

    const out = calcCYP2D6ActivityScoreFromAlleles(a1.value, a2.value);

    if (out.score === null) return;

    const ph = cyp2d6PhenotypeFromAS(out.score);

    if (!ph) return;

    if ($("genoAvail")) $("genoAvail").value = "known";

    phenoSel.disabled = false;
    phenoSel.value = ph;
  }

  a1.addEventListener("input", apply);
  a2.addEventListener("input", apply);
}

function init() {
  initLinks();
  setLang("EN");

  const langToggle = $("langToggle");
  if (langToggle) {
    langToggle.addEventListener("click", () => {
      setLang(lang === "EN" ? "AR" : "EN");
    });
  }

  const runBtn = $("runBtn");
  const resetBtn = $("resetBtn");
  const predictBtn = $("predictBtn");
  const genoAvail = $("genoAvail");
  const cyp2d6Input = $("cyp2d6Input");

  if (runBtn) runBtn.addEventListener("click", run);
  if (resetBtn) resetBtn.addEventListener("click", reset);
  if (predictBtn) predictBtn.addEventListener("click", predictPhenotype);

  if (genoAvail && cyp2d6Input) {
    genoAvail.addEventListener("change", () => {
      const v = genoAvail.value;
      cyp2d6Input.disabled = v === "unknown";
      if (v === "unknown") delete cyp2d6Input.dataset.manualCyp2d6Phenotype;
    });
  }

  initOptionalGeneUI();
  initAlleleUI();

  setPredictStatus({
    mode: "idle",
  });
}

init();
// ======================================================
// SCDAid AI Detailed Inputs + Ask SCDAid Chat
// Paste this entire block AFTER init();
// ======================================================


// ======================================================
// Utility helpers
// ======================================================

function getValue(id, fallback = "") {
  const el = document.getElementById(id);
  if (!el) return fallback;
  return el.value || fallback;
}

function getValueFromPossibleIds(ids, fallback = "") {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && el.value !== undefined && el.value !== "") {
      return el.value;
    }
  }
  return fallback;
}

function isChecked(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}

function getWeightKg() {
  const weight = parseFloat(getValue("weightInput", "58"));
  const unit = getValue("weightUnit", "kg");

  if (unit === "lb") {
    return +(weight * 0.453592).toFixed(1);
  }

  return weight;
}

function getActivityScoreFromPhenotype() {
  const pheno = getValue("cyp2d6Input", "EM");

  if (pheno === "PM") return 0;
  if (pheno === "IM") return 0.5;
  if (pheno === "UM") return 3;

  return 1.5;
}

function mapFunctionalPhenotypeToSelectValue(prediction) {
  if (prediction === "PM") return "PM";
  if (prediction === "IM") return "IM";
  if (prediction === "UM") return "UM";

  return "EM";
}


// ======================================================
// Auto-fill linked fields in index.html
// ======================================================

function initDetailedInputAutofill() {
  const drugSelect = document.getElementById("cyp2d6InhibitorDrugInput");
  const strengthSelect = document.getElementById("inhibitorLevelInput");

  if (drugSelect && strengthSelect) {
    drugSelect.addEventListener("change", () => {
      const selected = drugSelect.options[drugSelect.selectedIndex];
      const strength = selected?.dataset?.strength || "none";

      if (strength === "custom") {
        strengthSelect.value = "none";
      } else if (["none", "weak", "moderate", "strong"].includes(strength)) {
        strengthSelect.value = strength;
      }
    });
  }

  const inflammationType = document.getElementById("inflammationTypeInput");
  const inflammationSeverity = document.getElementById("inflammationInput");

  if (inflammationType && inflammationSeverity) {
    inflammationType.addEventListener("change", () => {
      const selected = inflammationType.options[inflammationType.selectedIndex];
      const severity = selected?.dataset?.severity || "none";

      if (severity === "custom") {
        inflammationSeverity.value = "mild";
      } else if (["none", "mild", "high"].includes(severity)) {
        inflammationSeverity.value = severity;
      }
    });
  }

  const toxicityType = document.getElementById("opioidToxicityTypeInput");
  const toxicityYesNo = document.getElementById("opioidToxicityInput");

  if (toxicityType && toxicityYesNo) {
    toxicityType.addEventListener("change", () => {
      toxicityYesNo.value = toxicityType.value === "none" ? "no" : "yes";
    });
  }
}


// ======================================================
// CYP2D6 inhibitor mapping
// ======================================================

const CYP2D6_INHIBITOR_STRENGTH = {
  // Strong CYP2D6 inhibitors
  "paroxetine": "strong",
  "fluoxetine": "strong",
  "bupropion": "strong",
  "quinidine": "strong",
  "terbinafine": "strong",
  "cinacalcet": "strong",

  // Moderate CYP2D6 inhibitors
  "duloxetine": "moderate",
  "sertraline": "moderate",
  "escitalopram": "moderate",
  "citalopram": "moderate",
  "venlafaxine": "moderate",
  "desvenlafaxine": "moderate",
  "amiodarone": "moderate",
  "celecoxib": "moderate",
  "ritonavir": "moderate",
  "mirabegron": "moderate",
  "propafenone": "moderate",
  "abiraterone": "moderate",
  "rolapitant": "moderate",

  // Weak / possible CYP2D6 inhibitors
  "chlorpromazine": "weak",
  "haloperidol": "weak",
  "diphenhydramine": "weak",
  "hydroxyzine": "weak",
  "methadone": "weak",
  "clomipramine": "weak",
  "doxepin": "weak",
  "imipramine": "weak",
  "nortriptyline": "weak",
  "amitriptyline": "weak",
  "cimetidine": "weak",
  "metoclopramide": "weak",
  "ticlopidine": "weak",

  // None
  "none": "none",
  "no": "none",
  "unknown": "none",
  "other": "none"
};

function normalizeTextForMatch(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function inferInhibitorStrengthFromText(text) {
  const x = normalizeTextForMatch(text);

  if (!x) return "none";

  // Strong
  if (
    x.includes("paroxetine") ||
    x.includes("paxil") ||
    x.includes("fluoxetine") ||
    x.includes("prozac") ||
    x.includes("bupropion") ||
    x.includes("wellbutrin") ||
    x.includes("zyban") ||
    x.includes("quinidine") ||
    x.includes("terbinafine") ||
    x.includes("cinacalcet")
  ) {
    return "strong";
  }

  // Moderate
  if (
    x.includes("duloxetine") ||
    x.includes("cymbalta") ||
    x.includes("sertraline") ||
    x.includes("zoloft") ||
    x.includes("escitalopram") ||
    x.includes("lexapro") ||
    x.includes("citalopram") ||
    x.includes("celexa") ||
    x.includes("venlafaxine") ||
    x.includes("effexor") ||
    x.includes("desvenlafaxine") ||
    x.includes("amiodarone") ||
    x.includes("celecoxib") ||
    x.includes("ritonavir") ||
    x.includes("mirabegron") ||
    x.includes("propafenone") ||
    x.includes("abiraterone") ||
    x.includes("rolapitant")
  ) {
    return "moderate";
  }

  // Weak / possible
  if (
    x.includes("diphenhydramine") ||
    x.includes("benadryl") ||
    x.includes("hydroxyzine") ||
    x.includes("haloperidol") ||
    x.includes("chlorpromazine") ||
    x.includes("methadone") ||
    x.includes("amitriptyline") ||
    x.includes("nortriptyline") ||
    x.includes("imipramine") ||
    x.includes("doxepin") ||
    x.includes("clomipramine") ||
    x.includes("cimetidine") ||
    x.includes("metoclopramide") ||
    x.includes("ticlopidine")
  ) {
    return "weak";
  }

  return "none";
}

function getCYP2D6InhibitorDrug() {
  const drug = getValueFromPossibleIds(
    [
      "cyp2d6InhibitorDrugInput",
      "cyp2d6_inhibitor_drug",
      "inhibitorDrugInput",
      "inhibitorMedicationInput",
      "inhibitorDrugSelect"
    ],
    "none"
  );

  return normalizeTextForMatch(drug);
}

function getCYP2D6InhibitorOtherText() {
  return getValueFromPossibleIds(
    [
      "customInhibitorDrugInput",
      "cyp2d6InhibitorOtherInput",
      "inhibitorOtherInput",
      "inhibitorOtherText",
      "otherInhibitorInput"
    ],
    ""
  );
}

function getCYP2D6InhibitorLevel() {
  const drug = getCYP2D6InhibitorDrug();

  if (drug && drug !== "none" && drug !== "other") {
    return CYP2D6_INHIBITOR_STRENGTH[drug] || inferInhibitorStrengthFromText(drug);
  }

  const otherText = getCYP2D6InhibitorOtherText();
  const inferred = inferInhibitorStrengthFromText(otherText);

  if (inferred !== "none") return inferred;

  const levelInput = document.getElementById("inhibitorLevelInput");

  if (levelInput && levelInput.value) {
    return levelInput.value;
  }

  const oldInhibitor = getValue("inhibitorInput", "no");

  if (oldInhibitor === "yes") return "strong";

  return "none";
}


// ======================================================
// Inflammation mapping
// ======================================================

function getInflammationType() {
  return getValueFromPossibleIds(
    [
      "inflammationTypeInput",
      "inflammationInput",
      "inflammationStatusInput",
      "inflammationSelect"
    ],
    "none"
  );
}

function getInflammationOtherText() {
  return getValueFromPossibleIds(
    [
      "customInflammationInput",
      "inflammationOtherInput",
      "inflammationOtherText",
      "otherInflammationInput"
    ],
    ""
  );
}

function inferInflammationStatusFromType(type, otherText) {
  const t = normalizeTextForMatch(type);
  const o = normalizeTextForMatch(otherText);
  const combined = `${t} ${o}`;

  if (!combined.trim() || combined.includes("none")) {
    return "none";
  }

  if (
    combined.includes("acute chest") ||
    combined.includes("acute_chest") ||
    combined.includes("acs") ||
    combined.includes("sepsis") ||
    combined.includes("septic") ||
    combined.includes("pneumonia") ||
    combined.includes("osteomyelitis") ||
    combined.includes("meningitis") ||
    combined.includes("bacteremia") ||
    combined.includes("bloodstream") ||
    combined.includes("high fever") ||
    combined.includes("crp high") ||
    combined.includes("high crp") ||
    combined.includes("wbc high") ||
    combined.includes("high wbc") ||
    combined.includes("severe infection") ||
    combined.includes("abscess") ||
    combined.includes("post_surgery") ||
    combined.includes("trauma")
  ) {
    return "high";
  }

  if (
    combined.includes("uti") ||
    combined.includes("urinary") ||
    combined.includes("viral") ||
    combined.includes("influenza") ||
    combined.includes("covid") ||
    combined.includes("tonsillitis") ||
    combined.includes("pharyngitis") ||
    combined.includes("sinusitis") ||
    combined.includes("bronchitis") ||
    combined.includes("mild fever") ||
    combined.includes("moderate") ||
    combined.includes("mild") ||
    combined.includes("infection") ||
    combined.includes("inflammation") ||
    combined.includes("voc")
  ) {
    if (combined.includes("high") || combined.includes("severe")) {
      return "high";
    }

    return "mild";
  }

  if (t.includes("other") && o.length > 0) {
    return "mild";
  }

  return "none";
}

function getInflammationStatus() {
  const type = getInflammationType();
  const otherText = getInflammationOtherText();

  const severityDropdown = document.getElementById("inflammationInput");

  if (severityDropdown && severityDropdown.value && severityDropdown.value !== "none") {
    return severityDropdown.value;
  }

  const inferred = inferInflammationStatusFromType(type, otherText);

  if (isChecked("suspectedACS") || isChecked("respRisk")) {
    return "high";
  }

  return inferred;
}


// ======================================================
// Opioid toxicity mapping
// ======================================================

function getToxicityType() {
  return getValueFromPossibleIds(
    [
      "opioidToxicityTypeInput",
      "opioidToxicityInput",
      "toxicityTypeInput",
      "toxicityInput"
    ],
    "no"
  );
}

function getToxicityOtherText() {
  return getValueFromPossibleIds(
    [
      "customOpioidToxicityInput",
      "opioidToxicityOtherInput",
      "toxicityOtherInput",
      "toxicityOtherText",
      "otherToxicityInput"
    ],
    ""
  );
}

function getPreviousOpioidToxicity() {
  const yesNo = getValue("opioidToxicityInput", "no");
  const type = normalizeTextForMatch(getToxicityType());
  const other = normalizeTextForMatch(getToxicityOtherText());
  const combined = `${type} ${other}`;

  if (yesNo === "yes") return "yes";

  if (!combined.trim()) return "no";

  if (
    type === "no" ||
    type === "none" ||
    combined.includes("no toxicity") ||
    combined.includes("no adverse")
  ) {
    return "no";
  }

  if (
    combined.includes("respiratory") ||
    combined.includes("resp depression") ||
    combined.includes("respiratory depression") ||
    combined.includes("rr low") ||
    combined.includes("low rr") ||
    combined.includes("oxygen") ||
    combined.includes("hypoxia") ||
    combined.includes("spo2") ||
    combined.includes("sedation") ||
    combined.includes("oversedation") ||
    combined.includes("somnolence") ||
    combined.includes("unconscious") ||
    combined.includes("naloxone") ||
    combined.includes("coma") ||
    combined.includes("hypotension") ||
    combined.includes("bradycardia") ||
    combined.includes("severe nausea") ||
    combined.includes("vomiting") ||
    combined.includes("itching") ||
    combined.includes("rash") ||
    combined.includes("allergy") ||
    combined.includes("anaphylaxis") ||
    combined.includes("adverse") ||
    combined.includes("toxicity") ||
    combined.includes("other")
  ) {
    return "yes";
  }

  const codeineResponse = getValue("codeineRespInput", "ineffective");
  const tramadolResponse = getValue("tramadolRespInput", "ineffective");

  if (codeineResponse === "adverse" || tramadolResponse === "adverse") {
    return "yes";
  }

  return "no";
}

function getPreviousCodeineFailure() {
  const codeineResponse = getValue("codeineRespInput", "ineffective");
  const tramadolResponse = getValue("tramadolRespInput", "ineffective");

  if (codeineResponse === "ineffective" || tramadolResponse === "ineffective") {
    return "yes";
  }

  return "no";
}


// ======================================================
// SpO2
// ======================================================

function getSpO2Estimate() {
  const spo2Input = document.getElementById("spo2Input");

  if (spo2Input && spo2Input.value !== "") {
    return parseFloat(spo2Input.value);
  }

  if (isChecked("suspectedACS") || isChecked("respRisk")) return 94;

  return 98;
}


// ======================================================
// Formatting
// ======================================================

function formatPercent(value) {
  return (value * 100).toFixed(2) + "%";
}

function formatPredictionLabel(label) {
  const labels = {
    PM: "Poor metabolizer (PM)",
    IM: "Intermediate metabolizer (IM)",
    NM: "Normal metabolizer (NM)",
    EM: "Normal metabolizer (NM/EM)",
    UM: "Ultrarapid metabolizer (UM)",

    hydromorphone_preferred: "Hydromorphone preferred",
    fentanyl_preferred: "Fentanyl preferred",
    morphine_considered: "Morphine may be considered",

    morphine_or_hydromorphone_preferred_avoid_codeine_tramadol:
      "Morphine or hydromorphone preferred; avoid codeine/tramadol",

    hydromorphone_preferred_avoid_codeine_tramadol:
      "Hydromorphone preferred; avoid codeine/tramadol",

    fentanyl_preferred_avoid_codeine_tramadol:
      "Fentanyl preferred; avoid codeine/tramadol",

    hydromorphone_preferred_with_close_monitoring:
      "Hydromorphone preferred with close monitoring",

    hydromorphone_preferred_with_close_monitoring_avoid_codeine_tramadol:
      "Hydromorphone preferred with close monitoring; avoid codeine/tramadol",

    morphine_or_hydromorphone_with_close_monitoring:
      "Morphine or hydromorphone with close monitoring",

    morphine_or_hydromorphone_with_close_monitoring_avoid_codeine_tramadol:
      "Morphine or hydromorphone with close monitoring; avoid codeine/tramadol",

    morphine_considered_avoid_codeine_tramadol:
      "Morphine may be considered; avoid codeine/tramadol",

    high: "High",
    moderate: "Moderate",
    low: "Low"
  };

  return labels[label] || label;
}

function buildProbabilityList(probabilities) {
  return Object.entries(probabilities)
    .map(([key, value]) => {
      return `<li><strong>${formatPredictionLabel(key)}:</strong> ${(value * 100).toFixed(1)}%</li>`;
    })
    .join("");
}


// ======================================================
// Save latest AI result for Ask SCDAid
// ======================================================

window.lastSCDAidContext = window.lastSCDAidContext || null;

function saveLastSCDAidContext(result) {
  window.lastSCDAidContext = result;
}


// ======================================================
// Render AI result
// ======================================================

function renderSCDAidAIResult(result) {
  saveLastSCDAidContext(result);

  function escapeHtmlSafe(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const resultsBox = document.getElementById("results");
  const statusBox = document.getElementById("predictStatus");

  const functional = result.functional_phenotype;
  const analgesic = result.analgesic_recommendation;
  const safety = result.safety_risk;
  const cypTx = result.cyp2d6_translation;

  const cyp2d6EngineHTML =
    cypTx && cypTx.cyp2d6_input_source === "alleles"
      ? cypTx.ok
        ? `
      <div class="resultCard">
        <h4>CYP2D6 — CPIC-based genotype-to-phenotype translation</h4>
        <p><strong>Input source:</strong> ${escapeHtmlSafe(cypTx.cyp2d6_input_source || "")}</p>
        <p><strong>Allele 1:</strong> ${escapeHtmlSafe(cypTx.allele1 || "")} &nbsp; <strong>Allele 2:</strong> ${escapeHtmlSafe(cypTx.allele2 || "")}</p>
        <p><strong>Internally constructed diplotype:</strong> ${escapeHtmlSafe(cypTx.internally_constructed_diplotype || cypTx.diplotype || "")}</p>
        <p><strong>Calculated activity score:</strong> ${escapeHtmlSafe(String(cypTx.calculated_activity_score ?? cypTx.activity_score ?? ""))}</p>
        <p><strong>Calculated genetic phenotype:</strong> ${escapeHtmlSafe(cypTx.calculated_genetic_phenotype || cypTx.genetic_phenotype || "")}</p>
        <p><strong>Selected manual phenotype:</strong> ${escapeHtmlSafe(cypTx.selected_manual_phenotype || cypTx.selected_phenotype || "—")}</p>
        <p><strong>Inhibitor adjustment:</strong> ${escapeHtmlSafe((cypTx.inhibitor_adjustment && cypTx.inhibitor_adjustment.rule_applied) || "")}</p>
        <p><strong>Clinical phenotype (after phenoconversion):</strong> ${escapeHtmlSafe(cypTx.clinical_phenotype_after_phenoconversion || cypTx.clinical_phenotype || "")}</p>
        ${
          cypTx.mismatch_warning || cypTx.phenotype_mismatch_warning
            ? `<p class="hint"><strong>Phenotype mismatch:</strong> ${escapeHtmlSafe(cypTx.mismatch_warning || cypTx.phenotype_mismatch_warning)}</p>`
            : ""
        }
        ${
          cypTx.allele_functions && Object.keys(cypTx.allele_functions).length
            ? `<p><strong>Allele function (per copy):</strong> ${escapeHtmlSafe(
                Object.entries(cypTx.allele_functions)
                  .map(([k, v]) => `${k}: ${v === null || v === undefined ? "indeterminate" : v}`)
                  .join("; ")
              )}</p>`
            : ""
        }
        ${
          cypTx.recommendation_notes && cypTx.recommendation_notes.length
            ? `<div><strong>Recommendation notes</strong><ul>${cypTx.recommendation_notes
                .map(n => `<li>${escapeHtmlSafe(n)}</li>`)
                .join("")}</ul></div>`
            : ""
        }
        ${
          cypTx.warnings && cypTx.warnings.length
            ? `<p class="hint"><strong>Warnings:</strong> ${cypTx.warnings.map(escapeHtmlSafe).join(" ")}</p>`
            : ""
        }
      </div>
    `
        : `
      <div class="resultCard">
        <h4>CYP2D6 — Genotype translation</h4>
        <p><strong>Input source:</strong> alleles</p>
        <p><strong>Allele 1:</strong> ${escapeHtmlSafe(cypTx.allele1 || "—")} &nbsp; <strong>Allele 2:</strong> ${escapeHtmlSafe(cypTx.allele2 || "—")}</p>
        <p><strong>Internally constructed diplotype:</strong> ${escapeHtmlSafe(cypTx.internally_constructed_diplotype || cypTx.diplotype || "—")}</p>
        <p class="hint">Could not complete CPIC-based activity scoring. Using manual phenotype and request activity score for models.</p>
        ${
          cypTx.warnings && cypTx.warnings.length
            ? `<p class="hint"><strong>Warnings:</strong> ${cypTx.warnings.map(escapeHtmlSafe).join(" ")}</p>`
            : ""
        }
      </div>
    `
      : "";

  const explanationHTML = result.clinical_explanation
    .map(item => `<li>${item}</li>`)
    .join("");
  const warningsHTML = (result.medication_specific_warnings || [])
    .map(item => `<li>${escapeHtmlSafe(item)}</li>`)
    .join("");
  const monitoringHTML = (result.monitoring_alerts || [])
    .map(item => `<li>${escapeHtmlSafe(item)}</li>`)
    .join("");
  const doseNotesHTML = (result.dose_notes || [])
    .map(item => `<li>${escapeHtmlSafe(item)}</li>`)
    .join("");

  const alertItems = [];
  if (result.guardrails_applied && result.guardrails_applied.length) {
    alertItems.push(...result.guardrails_applied);
  }
  if (cypTx && (cypTx.mismatch_warning || cypTx.phenotype_mismatch_warning)) {
    alertItems.push(cypTx.mismatch_warning || cypTx.phenotype_mismatch_warning);
  }
  if (cypTx && cypTx.warnings && cypTx.warnings.length) {
    alertItems.push(...cypTx.warnings);
  }
  if (safety.prediction === "high") {
    alertItems.push(
      "Safety risk: high — reinforce respiratory and renal monitoring per protocol."
    );
  }

  const alertsHTML =
    alertItems.length > 0
      ? `
      <div class="resultCard resultAlertStrip ${
        safety.prediction === "high" ? "resultAlertStrip--danger" : ""
      }">
        <h4>Alerts & guardrails</h4>
        <ul>${alertItems.map((item) => `<li>${escapeHtmlSafe(item)}</li>`).join("")}</ul>
      </div>
    `
      : "";

  if (statusBox) {
    statusBox.innerHTML = `
      <span class="tag info">AI complete: ${formatPredictionLabel(functional.prediction)}</span>
    `;
  }

  if (resultsBox) {
    resultsBox.innerHTML = `
      <div class="resultBlock predictionOutput">
        <h3 class="predictionSummaryTitle">SCDAid AI prediction</h3>

        <div class="pillRow">
          <span class="pill info">Functional phenotype: ${formatPredictionLabel(functional.prediction)}</span>
          <span class="pill info">Analgesic: ${formatPredictionLabel(analgesic.prediction)}</span>
          <span class="pill ${safety.prediction === "high" ? "danger" : safety.prediction === "moderate" ? "warn" : "ok"}">
            Safety risk: ${formatPredictionLabel(safety.prediction)}
          </span>
        </div>

        <div class="predictionSummaryRows">
          <div class="predictionSummaryRow">
            <strong>Functional CYP2D6:</strong> ${formatPredictionLabel(functional.prediction)}
            · confidence ${formatPercent(functional.confidence)}
          </div>
          <div class="predictionSummaryRow">
            <strong>Analgesic recommendation:</strong> ${formatPredictionLabel(analgesic.prediction)}
            · confidence ${formatPercent(analgesic.confidence)}
          </div>
          <div class="predictionSummaryRow">
            <strong>Safety risk:</strong> ${formatPredictionLabel(safety.prediction)}
            · confidence ${formatPercent(safety.confidence)}
          </div>
        </div>

        ${alertsHTML}

        <details class="predictionDetails">
          <summary class="predictionDetailsSummary">
            <span class="predSumClosed">Show details ▼</span>
            <span class="predSumOpen">Hide details ▲</span>
          </summary>
          <div class="predictionDetailsInner">
            ${cyp2d6EngineHTML}

            <div class="resultCard">
              <h4>1) Functional CYP2D6 Phenotype</h4>
              <p><strong>Prediction:</strong> ${formatPredictionLabel(functional.prediction)}</p>
              ${
                cypTx && cypTx.ok && cypTx.cyp2d6_input_source === "alleles"
                  ? `<p class="hint">This label reflects the <strong>clinical phenotype</strong> after phenoconversion from the CPIC-based genotype-to-phenotype translation engine, not symptom-based AI.</p>`
                  : ""
              }
              <p><strong>Confidence:</strong> ${formatPercent(functional.confidence)}</p>
              <details>
                <summary>Show probabilities</summary>
                <ul>${buildProbabilityList(functional.probabilities)}</ul>
              </details>
            </div>

            <div class="resultCard">
              <h4>2) Analgesic Recommendation</h4>
              <p><strong>Prediction:</strong> ${formatPredictionLabel(analgesic.prediction)}</p>
              <p><strong>Confidence:</strong> ${formatPercent(analgesic.confidence)}</p>
              <details>
                <summary>Show probabilities</summary>
                <ul>${buildProbabilityList(analgesic.probabilities)}</ul>
              </details>
            </div>

            <div class="resultCard">
              <h4>3) Safety Risk</h4>
              <p><strong>Prediction:</strong> ${formatPredictionLabel(safety.prediction)}</p>
              <p><strong>Confidence:</strong> ${formatPercent(safety.confidence)}</p>
              <details>
                <summary>Show probabilities</summary>
                <ul>${buildProbabilityList(safety.probabilities)}</ul>
              </details>
            </div>

            <div class="resultCard">
              <h4>4) Medication-Specific Warnings & Avoidance</h4>
              ${warningsHTML ? `<ul>${warningsHTML}</ul>` : `<p class="hint">No additional warnings returned.</p>`}
            </div>

            <div class="resultCard">
              <h4>5) Dose Notes</h4>
              ${doseNotesHTML ? `<ul>${doseNotesHTML}</ul>` : `<p class="hint">No dose notes returned.</p>`}
            </div>

            <div class="resultCard">
              <h4>6) Monitoring Alerts</h4>
              ${monitoringHTML ? `<ul>${monitoringHTML}</ul>` : `<p class="hint">No special monitoring alerts returned.</p>`}
            </div>

            <div class="resultCard">
              <h4>7) Clinical explanation</h4>
              <ul>${explanationHTML}</ul>
            </div>

            <div class="note">
              ${escapeHtmlSafe(result.disclaimer)}
            </div>
          </div>
        </details>
      </div>
    `;
  }

  const cypSelect = document.getElementById("cyp2d6Input");

  if (cypSelect) {
    cypSelect.value = mapFunctionalPhenotypeToSelectValue(functional.prediction);
  }
}


// ======================================================
// Run AI models
// ======================================================

async function runThreeSCDAidModels() {
  const statusBox = document.getElementById("predictStatus");
  const resultsBox = document.getElementById("results");
  const predictButton = document.getElementById("predictBtn");

  const runErrs = validate(readInputs());
  if (runErrs.length) {
    alert(runErrs.join("\n"));
    if (typeof setPredictStatus === "function") {
      setPredictStatus({ mode: "idle" });
    } else if (statusBox) {
      statusBox.innerHTML = `<span class="small">${TXT[lang].predictStatusIdle}</span>`;
    }
    return;
  }

  if (predictButton) predictButton.disabled = true;

  if (statusBox) {
    statusBox.innerHTML = `<span class="tag info">Running SCDAid AI models...</span>`;
  }

  if (resultsBox) {
    resultsBox.innerHTML = `
      <div class="placeholder">Running SCDAid AI models...</div>
    `;
  }

  const payload = {
    age: parseFloat(getValue("ageInput", "24")),
    weight_kg: getWeightKg(),
    pain_severity: getValue("severityInput", "moderate"),

    egfr: parseFloat(getValue("gfrInput", "60")),
    spo2: getSpO2Estimate(),

    suspected_acs: isChecked("suspectedACS") ? "yes" : "no",
    opioid_tolerant: isChecked("opioidTol") ? "yes" : "no",
    sedatives: isChecked("sedatives") ? "yes" : "no",
    morphine_allergy: isChecked("morphineAllergy") ? "yes" : "no",

    cyp2d6_allele1: getValue("cyp2d6_allele1", "").trim(),
    cyp2d6_allele2: getValue("cyp2d6_allele2", "").trim(),
    cyp2d6_selected_phenotype: getValue("cyp2d6Input", "EM"),

    cyp2d6_activity_score: getActivityScoreFromPhenotype(),

    cyp2d6_inhibitor: getCYP2D6InhibitorLevel(),
    cyp2d6_inhibitor_drug: getCYP2D6InhibitorDrug(),
    cyp2d6_inhibitor_other: getCYP2D6InhibitorOtherText(),

    inflammation: getInflammationStatus(),
    inflammation_type: getInflammationType(),
    inflammation_other: getInflammationOtherText(),

    previous_codeine_failure: getPreviousCodeineFailure(),
    previous_opioid_toxicity: getPreviousOpioidToxicity(),
    opioid_toxicity_type: getToxicityType(),
    opioid_toxicity_other: getToxicityOtherText()
  };

  try {
    const response = await fetch("/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      const message = result.error || "Unknown prediction error.";

      if (statusBox) {
        statusBox.innerHTML = `<span class="tag low">AI error.</span>`;
      }

      if (resultsBox) {
        resultsBox.innerHTML = `
          <div class="placeholder" style="color:#ff6b6b;">
            Error: ${message}
          </div>
        `;
      }

      return;
    }

    renderSCDAidAIResult(result);
    // Keep SCDAid Learn capture while backend owns final recommendation.
    const inputs = readInputs();
    const learnModel = {
      renalRisk: result?.patient_summary?.renal_risk || riskRenal(inputs.eGFR),
      opioid: String(result?.analgesic_recommendation?.prediction || ""),
    };
    saveCaseToLearnDataset(inputs, learnModel);

  } catch (error) {
    if (statusBox) {
      statusBox.innerHTML = `<span class="tag low">Connection error.</span>`;
    }

    if (resultsBox) {
      resultsBox.innerHTML = `
        <div class="placeholder" style="color:#ff6b6b;">
          Connection error: ${error.message}
        </div>
      `;
    }
  } finally {
    if (predictButton) predictButton.disabled = false;
  }
}


// ======================================================
// Ask SCDAid Chat
// ======================================================

function appendChatMessage(role, text) {
  const box = document.getElementById("chatMessages");

  if (!box) {
    alert("chatMessages box not found in index.html");
    return;
  }

  const align = role === "user" ? "right" : "left";
  const label = role === "user" ? "You" : "Ask SCDAid";

  const bubble = document.createElement("div");
  bubble.style.margin = "10px 0";
  bubble.style.textAlign = align;

  bubble.innerHTML = `
    <div style="
      display:inline-block;
      max-width:90%;
      padding:12px 14px;
      border-radius:14px;
      background:${role === "user" ? "#1f6feb" : "#202b3d"};
      color:white;
      border:1px solid rgba(255,255,255,0.15);
      text-align:left;
      line-height:1.5;
    ">
      <strong>${label}:</strong><br>
      ${String(text).replace(/\n/g, "<br>")}
    </div>
  `;

  box.appendChild(bubble);
  box.scrollTop = box.scrollHeight;
}

async function askSCDAid() {
  const input = document.getElementById("chatInput");
  const btn = document.getElementById("chatSendBtn");

  if (!input) {
    alert("chatInput not found in index.html");
    return;
  }

  const question = input.value.trim();

  if (!question) {
    alert("Write a question first.");
    return;
  }

  appendChatMessage("user", question);
  input.value = "";

  if (btn) btn.disabled = true;

  appendChatMessage("assistant", "Thinking...");

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: question,
        context: window.lastSCDAidContext || {}
      })
    });

    const result = await response.json();

    const messages = document.getElementById("chatMessages");

    if (messages && messages.lastChild) {
      messages.removeChild(messages.lastChild);
    }

    if (!response.ok || result.error) {
      appendChatMessage("assistant", "Error: " + (result.error || "Chat failed."));
      return;
    }

    appendChatMessage("assistant", result.answer || "No answer returned.");

  } catch (error) {
    const messages = document.getElementById("chatMessages");

    if (messages && messages.lastChild) {
      messages.removeChild(messages.lastChild);
    }

    appendChatMessage("assistant", "Connection error: " + error.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function initAskSCDAidChat() {
  const btn = document.getElementById("chatSendBtn");
  const input = document.getElementById("chatInput");

  if (!btn || !input) {
    console.log("Ask SCDAid chat elements not found yet.");
    return;
  }

  btn.addEventListener("click", askSCDAid);

  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      askSCDAid();
    }
  });

  console.log("Ask SCDAid chat initialized.");
}


// ======================================================
// Replace old Predict Phenotype button listener
// ======================================================

function predictButtonLabel() {
  return TXT && TXT[lang] && TXT[lang].predictBtn ? TXT[lang].predictBtn : "Predict";
}

const oldPredictBtn = document.getElementById("predictBtn");

if (oldPredictBtn) {
  const newPredictBtn = oldPredictBtn.cloneNode(true);
  oldPredictBtn.parentNode.replaceChild(newPredictBtn, oldPredictBtn);

  newPredictBtn.textContent = predictButtonLabel();
  newPredictBtn.addEventListener("click", runThreeSCDAidModels);
}


// ======================================================
// Initialize detailed UI + chat
// ======================================================

initDetailedInputAutofill();
initAskSCDAidChat();
// ======================================================
// FORCE ATTACH BUTTONS - FINAL FIX
// Put this at the VERY END of app.js
// ======================================================

console.log("Final SCDAid button fixer loaded.");

function forceAttachSCDAidButtons() {
  const aiBtn = document.getElementById("predictBtn");
  const chatBtn = document.getElementById("chatSendBtn");
  const chatInput = document.getElementById("chatInput");

  if (aiBtn) {
    aiBtn.textContent = predictButtonLabel();
    aiBtn.onclick = function () {
      console.log("Predict clicked.");

      if (typeof runThreeSCDAidModels === "function") {
        runThreeSCDAidModels();
      } else if (typeof predictPhenotype === "function") {
        predictPhenotype();
      } else {
        alert("AI function is not found. Check app.js.");
      }
    };
  }

  if (chatBtn) {
    chatBtn.onclick = function () {
      console.log("Ask SCDAid clicked.");

      if (typeof askSCDAid === "function") {
        askSCDAid();
      } else {
        alert("askSCDAid function is not found. Check app.js.");
      }
    };
  }

  if (chatInput) {
    chatInput.onkeydown = function (event) {
      if (event.key === "Enter") {
        if (typeof askSCDAid === "function") {
          askSCDAid();
        } else {
          alert("askSCDAid function is not found. Check app.js.");
        }
      }
    };
  }
}

window.addEventListener("load", forceAttachSCDAidButtons);
setTimeout(forceAttachSCDAidButtons, 500);
setTimeout(forceAttachSCDAidButtons, 1500);
/* =========================
   SCAIA popup chat (single controller)
   ========================= */

(function () {
  const overlay = document.getElementById("scdChatOverlay");
  const openBtn = document.getElementById("openScdChatBtn");
  const closeBtn = document.getElementById("closeScdChatBtn");
  const chatMessages = document.getElementById("scdChatMessages");
  const quickChips = document.querySelectorAll(".scdChip");

  let chatInput = document.getElementById("scdChatInput");
  let chatSendBtn = document.getElementById("scdChatSendBtn");

  if (!overlay || !openBtn || !closeBtn || !chatInput || !chatSendBtn || !chatMessages) {
    console.log("SCAIA chat elements not found.");
    return;
  }

  (function resetScdChatControlsToSingleHandlerSurface() {
    const inParent = chatInput.parentNode;
    const freshInput = chatInput.cloneNode(true);
    inParent.replaceChild(freshInput, chatInput);
    chatInput = freshInput;

    const btnParent = chatSendBtn.parentNode;
    const freshBtn = chatSendBtn.cloneNode(true);
    btnParent.replaceChild(freshBtn, chatSendBtn);
    chatSendBtn = freshBtn;
  })();

  let scdChatRequestInFlight = false;

  function openScdChat() {
    overlay.classList.remove("hidden");
    setTimeout(() => {
      const el = document.getElementById("scdChatInput");
      if (el) el.focus();
    }, 80);
  }

  function closeScdChat() {
    overlay.classList.add("hidden");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function isArabicText(text) {
    return /[\u0600-\u06FF]/.test(String(text));
  }

  function addChatMessage(role, text) {
    const wrapper = document.createElement("div");
    wrapper.className = `scdMsg ${role}`;

    const bubble = document.createElement("div");
    const langClass = isArabicText(text) ? "rtlText" : "ltrText";

    bubble.className = `scdBubble ${langClass}`;
    bubble.setAttribute("dir", isArabicText(text) ? "rtl" : "ltr");
    bubble.innerHTML = escapeHtml(text);

    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function getValue(id) {
    const el = document.getElementById(id);
    if (!el) return "";
    if (el.type === "checkbox") return el.checked ? "yes" : "no";
    return el.value || "";
  }

  function collectScdContext() {
    return {
      patient_summary: {
        age: getValue("ageInput"),
        weight_kg: getValue("weightInput"),
        egfr: getValue("gfrInput"),
        pain_severity: getValue("severityInput"),
        spo2: getValue("spo2Input"),
        cyp2d6_phenotype: getValue("cyp2d6Input"),
        cyp2d6_inhibitor_drug: getValue("cyp2d6InhibitorDrugInput"),
        cyp2d6_inhibitor_strength: getValue("inhibitorLevelInput"),
        prior_codeine_response: getValue("codeineRespInput"),
        prior_tramadol_response: getValue("tramadolRespInput"),
        inflammation_type: getValue("inflammationTypeInput"),
        inflammation_severity: getValue("inflammationInput"),
        previous_opioid_toxicity: getValue("opioidToxicityInput"),
        opioid_toxicity_type: getValue("opioidToxicityTypeInput"),
        morphine_allergy: getValue("morphineAllergy"),
        suspected_acs: getValue("suspectedACS"),
        respiratory_risk: getValue("respRisk"),
        sedatives: getValue("sedatives")
      },
      last_result: window.lastSCDAidContext || {}
    };
  }

  async function askScdChat() {
    const message = chatInput.value.trim();
    if (!message) return;
    if (scdChatRequestInFlight) return;

    scdChatRequestInFlight = true;
    addChatMessage("user", message);
    chatInput.value = "";
    chatSendBtn.disabled = true;
    chatSendBtn.textContent = "Thinking...";

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: message,
          message: message,
          context: collectScdContext(),
          chat_history: Array.from(document.querySelectorAll(".scdMsg .scdBubble"))
            .slice(-8)
            .map((bubble) => bubble.innerText)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Chat request failed.");
      }

      const answer =
        data.answer ||
        data.response ||
        data.message ||
        "No response returned from SCDAid.";

      addChatMessage("bot", answer);
    } catch (error) {
      addChatMessage(
        "bot",
        "Sorry, SCAIA is not responding correctly right now. Please check the /chat endpoint in app.py."
      );
      console.error("SCAIA chat error:", error);
    } finally {
      scdChatRequestInFlight = false;
      const btn = document.getElementById("scdChatSendBtn");
      const inp = document.getElementById("scdChatInput");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Ask";
      }
      if (inp) inp.focus();
    }
  }

  openBtn.addEventListener("click", openScdChat);
  closeBtn.addEventListener("click", closeScdChat);

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeScdChat();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) {
      closeScdChat();
    }
  });

  chatSendBtn.addEventListener("click", function (e) {
    e.preventDefault();
    askScdChat();
  });

  chatInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      askScdChat();
    }
  });

  quickChips.forEach((chip) => {
    chip.addEventListener("click", function () {
      const inp = document.getElementById("scdChatInput");
      if (inp) inp.value = chip.textContent.trim();
      askScdChat();
    });
  });
})();

// Exposed for developer validation harness (validation.html). Does not alter clinical logic paths.
window.__SCDAidValidationHooks = Object.freeze({
  calcCYP2D6ActivityScoreFromAlleles,
  cyp2d6PhenotypeFromAS,
  chooseOpioid,
  buildPlan,
  allowNSAID,
  canOfferOxycodone,
  riskRenal,
  chooseNSAIDName,
  validate,
});
