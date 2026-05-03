from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pandas as pd
import joblib
import os

from cyp2d6_engine import translate_cyp2d6_from_alleles
from scdaid_decision_engine import (
    enrich_explanation_with_cyp2d6,
    merge_functional_with_cyp2d6,
)


app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)


def text_contains_arabic(text):
    return any("\u0600" <= ch <= "\u06FF" for ch in str(text or ""))

def get_scaia_language_instruction(question):
    q = str(question or "").lower()

    arabic_triggers = [
        "تكلم عربي",
        "رد عربي",
        "بالعربي",
        "اشرح عربي",
        "اكتب عربي",
        "عربي"
    ]

    if text_contains_arabic(question) or any(t in q for t in arabic_triggers):
        return (
            "LANGUAGE REQUIREMENT: The user is writing in Arabic or requested Arabic. "
            "Reply in Arabic only. Keep English scientific terms when needed, such as CYP2D6, phenotype, eGFR, SpO2, ACS. "
            "Do not reply in English unless the user explicitly asks for English."
        )

    return (
        "LANGUAGE REQUIREMENT: Reply in the same language as the user's question."
    )





def load_text_file_safe(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""



# =========================
# Load trained models
# =========================

def safe_load_model(path):
    try:
        return joblib.load(path)
    except Exception as e:
        print(f"Warning: model could not be loaded: {path}. Error: {e}")
        return None

functional_model = safe_load_model("functional_phenotype_model.pkl")
analgesic_model = safe_load_model("analgesic_recommendation_model.pkl")
safety_model = safe_load_model("safety_risk_model.pkl")


# =========================
# Helper functions
# =========================

def renal_risk_from_egfr(egfr):
    if egfr < 30:
        return "high"
    elif egfr < 60:
        return "moderate"
    else:
        return "low"


def phenotype_from_as(activity_score):
    if activity_score == 0:
        return "PM"
    elif activity_score == 0.5:
        return "IM"
    elif activity_score <= 2.25:
        return "NM"
    else:
        return "UM"


def predict_with_confidence(model, patient_df):
    prediction = model.predict(patient_df)[0]
    probabilities = model.predict_proba(patient_df)[0]
    classes = model.classes_
    confidence = max(probabilities)

    probability_dict = {
        str(cls): float(round(prob, 3))
        for cls, prob in zip(classes, probabilities)
    }

    return str(prediction), float(round(confidence, 4)), probability_dict


def clean_text_value(value, default="no"):
    if value is None:
        return default
    return str(value).strip().lower()


def clean_float_value(value, default=0):
    try:
        return float(value)
    except:
        return default


def apply_clinical_guardrails(
    egfr,
    spo2,
    suspected_acs,
    sedatives,
    morphine_allergy,
    functional_prediction,
    functional_conf,
    functional_probs,
    analgesic_prediction,
    analgesic_conf,
    analgesic_probs,
    safety_prediction,
    safety_conf,
    safety_probs
):
    """
    Clinical Safety Guardrails:
    AI prediction is used first, then hard clinical rules correct unsafe or inconsistent outputs.

    Logic:
    - eGFR < 30 should force high safety risk and fentanyl preference.
    - eGFR 30–59 should force at least moderate safety risk and hydromorphone preference.
    - Morphine allergy should remove morphine-containing recommendations.
    - ACS / low SpO2 / sedatives should increase monitoring risk.
    - CYP2D6 PM/UM should always preserve avoid codeine/tramadol warning.
    """

    override_notes = []

    avoid_codeine_tramadol = functional_prediction in ["PM", "UM"]

    # -------------------------
    # 1. Severe renal impairment
    # -------------------------
    if egfr < 30:
        safety_prediction = "high"
        safety_conf = max(safety_conf, 0.95)
        safety_probs = {
            "high": 0.95,
            "moderate": 0.04,
            "low": 0.01
        }

        if avoid_codeine_tramadol:
            analgesic_prediction = "fentanyl_preferred_avoid_codeine_tramadol"
        else:
            analgesic_prediction = "fentanyl_preferred"

        analgesic_conf = max(analgesic_conf, 0.95)
        analgesic_probs = {
            analgesic_prediction: analgesic_conf
        }

        override_notes.append(
            "Clinical guardrail applied: eGFR below 30 indicates high renal risk; fentanyl is preferred."
        )

    # -------------------------
    # 2. Moderate renal impairment
    # -------------------------
    elif 30 <= egfr < 60:
        if safety_prediction == "low":
            safety_prediction = "moderate"
            safety_conf = max(safety_conf, 0.90)
            safety_probs = {
                "high": 0.05,
                "moderate": 0.90,
                "low": 0.05
            }

        if morphine_allergy == "yes":
            analgesic_prediction = "hydromorphone_preferred"
        elif avoid_codeine_tramadol:
            analgesic_prediction = "hydromorphone_preferred_avoid_codeine_tramadol"
        else:
            analgesic_prediction = "hydromorphone_preferred"

        analgesic_conf = max(analgesic_conf, 0.90)
        analgesic_probs = {
            analgesic_prediction: analgesic_conf
        }

        override_notes.append(
            "Clinical guardrail applied: eGFR between 30 and 59 indicates moderate renal risk; hydromorphone is preferred."
        )

    # -------------------------
    # 3. Morphine allergy
    # -------------------------
    if morphine_allergy == "yes":
        if egfr < 30:
            if avoid_codeine_tramadol:
                analgesic_prediction = "fentanyl_preferred_avoid_codeine_tramadol"
            else:
                analgesic_prediction = "fentanyl_preferred"
        else:
            if avoid_codeine_tramadol:
                analgesic_prediction = "hydromorphone_preferred_avoid_codeine_tramadol"
            else:
                analgesic_prediction = "hydromorphone_preferred"

        analgesic_conf = max(analgesic_conf, 0.95)
        analgesic_probs = {
            analgesic_prediction: analgesic_conf
        }

        override_notes.append(
            "Clinical guardrail applied: morphine allergy reported; morphine-containing recommendations were removed."
        )

    # -------------------------
    # 4. Respiratory risk / ACS / low SpO2 / sedatives
    # -------------------------
    respiratory_concern = (
        suspected_acs == "yes" or
        spo2 < 95 or
        sedatives == "yes"
    )

    if respiratory_concern:
        if safety_prediction == "low":
            safety_prediction = "moderate"
            safety_conf = max(safety_conf, 0.90)
            safety_probs = {
                "high": 0.10,
                "moderate": 0.85,
                "low": 0.05
            }

        # Add close monitoring label when possible
        if analgesic_prediction == "hydromorphone_preferred":
            analgesic_prediction = "hydromorphone_preferred_with_close_monitoring"
        elif analgesic_prediction == "hydromorphone_preferred_avoid_codeine_tramadol":
            analgesic_prediction = "hydromorphone_preferred_with_close_monitoring_avoid_codeine_tramadol"
        elif analgesic_prediction == "morphine_considered":
            analgesic_prediction = "morphine_or_hydromorphone_with_close_monitoring"
        elif analgesic_prediction == "morphine_considered_avoid_codeine_tramadol":
            analgesic_prediction = "morphine_or_hydromorphone_with_close_monitoring_avoid_codeine_tramadol"

        analgesic_conf = max(analgesic_conf, 0.88)
        analgesic_probs = {
            analgesic_prediction: analgesic_conf
        }

        override_notes.append(
            "Clinical guardrail applied: respiratory concern detected; close monitoring is required."
        )

    # -------------------------
    # 5. CYP2D6 PM/UM avoid codeine/tramadol
    # -------------------------
    if avoid_codeine_tramadol:
        if analgesic_prediction == "morphine_considered":
            analgesic_prediction = "morphine_considered_avoid_codeine_tramadol"

        elif analgesic_prediction == "hydromorphone_preferred":
            analgesic_prediction = "hydromorphone_preferred_avoid_codeine_tramadol"

        elif analgesic_prediction == "fentanyl_preferred":
            analgesic_prediction = "fentanyl_preferred_avoid_codeine_tramadol"

        elif analgesic_prediction == "hydromorphone_preferred_with_close_monitoring":
            analgesic_prediction = "hydromorphone_preferred_with_close_monitoring_avoid_codeine_tramadol"

        elif analgesic_prediction == "morphine_or_hydromorphone_with_close_monitoring":
            analgesic_prediction = "morphine_or_hydromorphone_with_close_monitoring_avoid_codeine_tramadol"

        analgesic_probs = {
            analgesic_prediction: analgesic_conf
        }

        override_notes.append(
            "Clinical guardrail applied: CYP2D6 PM/UM phenotype requires avoiding codeine and tramadol."
        )

    return {
        "functional_prediction": functional_prediction,
        "functional_conf": functional_conf,
        "functional_probs": functional_probs,
        "analgesic_prediction": analgesic_prediction,
        "analgesic_conf": analgesic_conf,
        "analgesic_probs": analgesic_probs,
        "safety_prediction": safety_prediction,
        "safety_conf": safety_conf,
        "safety_probs": safety_probs,
        "override_notes": override_notes
    }


def build_explanation(patient, functional_prediction, analgesic_prediction, safety_prediction, override_notes=None):
    explanation = []

    if patient["renal_risk"] == "high":
        explanation.append("High renal risk detected because eGFR is below 30.")
    elif patient["renal_risk"] == "moderate":
        explanation.append("Moderate renal risk detected because eGFR is between 30 and 59.")
    else:
        explanation.append("Low renal risk detected because eGFR is 60 or above.")

    if patient["cyp2d6_inhibitor"] == "strong":
        explanation.append("Strong CYP2D6 inhibitor detected; this may reduce CYP2D6 functional activity.")
    elif patient["cyp2d6_inhibitor"] == "moderate":
        explanation.append("Moderate CYP2D6 inhibitor detected; partial CYP2D6 reduction is possible.")

    if patient["inflammation"] == "high":
        explanation.append("High inflammation may contribute to phenoconversion or reduced drug-metabolizing activity.")
    elif patient["inflammation"] == "mild":
        explanation.append("Mild inflammation is present and may slightly affect drug-metabolizing activity.")

    if patient["previous_codeine_failure"] == "yes":
        explanation.append("Previous codeine/tramadol failure supports concern for reduced CYP2D6-related activation.")

    if patient["previous_opioid_toxicity"] == "yes":
        explanation.append("Previous opioid toxicity increases safety concern.")

    if patient["suspected_acs"] == "yes":
        explanation.append("Suspected acute chest syndrome increases respiratory monitoring needs.")

    if patient["spo2"] < 95:
        explanation.append("SpO2 below 95% increases respiratory safety concern.")

    if patient["sedatives"] == "yes":
        explanation.append("Sedative exposure increases opioid-related respiratory depression risk.")

    if patient["morphine_allergy"] == "yes":
        explanation.append("Morphine allergy is reported, so morphine should be avoided.")

    if functional_prediction in ["PM", "UM"]:
        explanation.append("Functional CYP2D6 phenotype suggests avoiding codeine and tramadol.")

    if analgesic_prediction == "fentanyl_preferred":
        explanation.append("Fentanyl is preferred due to high renal risk or safety considerations.")

    elif analgesic_prediction == "fentanyl_preferred_avoid_codeine_tramadol":
        explanation.append("Fentanyl is preferred, and codeine/tramadol should be avoided due to CYP2D6-related risk.")

    elif analgesic_prediction == "hydromorphone_preferred":
        explanation.append("Hydromorphone is preferred due to renal risk, allergy, or safety-related factors.")

    elif analgesic_prediction == "hydromorphone_preferred_avoid_codeine_tramadol":
        explanation.append("Hydromorphone is preferred, and codeine/tramadol should be avoided.")

    elif analgesic_prediction == "hydromorphone_preferred_with_close_monitoring":
        explanation.append("Hydromorphone is preferred with close monitoring due to respiratory or safety concerns.")

    elif analgesic_prediction == "hydromorphone_preferred_with_close_monitoring_avoid_codeine_tramadol":
        explanation.append("Hydromorphone is preferred with close monitoring, and codeine/tramadol should be avoided.")

    elif analgesic_prediction == "morphine_considered":
        explanation.append("Morphine may be considered because no major renal or allergy contraindication was detected.")

    elif analgesic_prediction == "morphine_considered_avoid_codeine_tramadol":
        explanation.append("Morphine may be considered, but codeine/tramadol should be avoided due to CYP2D6-related risk.")

    elif analgesic_prediction == "morphine_or_hydromorphone_with_close_monitoring":
        explanation.append("Morphine or hydromorphone may be considered with close monitoring.")

    elif analgesic_prediction == "morphine_or_hydromorphone_with_close_monitoring_avoid_codeine_tramadol":
        explanation.append("Morphine or hydromorphone may be considered with close monitoring, and codeine/tramadol should be avoided.")

    elif analgesic_prediction == "morphine_or_hydromorphone_preferred_avoid_codeine_tramadol":
        explanation.append("Morphine or hydromorphone may be preferred while avoiding codeine and tramadol.")

    if safety_prediction == "high":
        explanation.append("Overall safety risk is high; close monitoring is required.")
    elif safety_prediction == "moderate":
        explanation.append("Overall safety risk is moderate; monitoring is recommended.")
    else:
        explanation.append("Overall safety risk is low based on the entered variables.")

    if override_notes:
        for note in override_notes:
            if note not in explanation:
                explanation.append(note)

    return explanation


# =========================
# Routes
# =========================

@app.route("/")
def home():
    return send_from_directory(".", "index.html")


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        age = clean_float_value(data.get("age"), 24)
        weight_kg = clean_float_value(data.get("weight_kg"), 58)
        pain_severity = clean_text_value(data.get("pain_severity"), "severe")

        egfr = clean_float_value(data.get("egfr"), 60)
        spo2 = clean_float_value(data.get("spo2"), 98)

        suspected_acs = clean_text_value(data.get("suspected_acs"), "no")
        opioid_tolerant = clean_text_value(data.get("opioid_tolerant"), "no")
        sedatives = clean_text_value(data.get("sedatives"), "no")
        morphine_allergy = clean_text_value(data.get("morphine_allergy"), "no")

        cyp2d6_activity_score = clean_float_value(data.get("cyp2d6_activity_score"), 1.5)
        cyp2d6_inhibitor = clean_text_value(data.get("cyp2d6_inhibitor"), "none")
        inflammation = clean_text_value(data.get("inflammation"), "none")
        previous_codeine_failure = clean_text_value(data.get("previous_codeine_failure"), "no")
        previous_opioid_toxicity = clean_text_value(data.get("previous_opioid_toxicity"), "no")

        allele1 = data.get("cyp2d6_allele1")
        allele2 = data.get("cyp2d6_allele2")
        diplotype_in = data.get("cyp2d6_diplotype")
        selected_phenotype_ui = data.get("cyp2d6_selected_phenotype")
        if selected_phenotype_ui is None or str(selected_phenotype_ui).strip() == "":
            selected_phenotype_ui = data.get("cyp2d6_manual_phenotype")

        cyp2d6_translation = translate_cyp2d6_from_alleles(
            allele1,
            allele2,
            diplotype_in,
            cyp2d6_inhibitor,
            selected_phenotype_ui,
        )

        renal_risk = renal_risk_from_egfr(egfr)

        if cyp2d6_translation.get("ok"):
            cyp2d6_activity_score = float(cyp2d6_translation["clinical_activity_score"])
            baseline_phenotype = cyp2d6_translation["genetic_phenotype"]
        else:
            baseline_phenotype = phenotype_from_as(cyp2d6_activity_score)

        patient = {
            "age": age,
            "weight_kg": weight_kg,
            "pain_severity": pain_severity,
            "egfr": egfr,
            "renal_risk": renal_risk,
            "spo2": spo2,
            "suspected_acs": suspected_acs,
            "opioid_tolerant": opioid_tolerant,
            "sedatives": sedatives,
            "morphine_allergy": morphine_allergy,
            "cyp2d6_activity_score": cyp2d6_activity_score,
            "baseline_phenotype": baseline_phenotype,
            "cyp2d6_inhibitor": cyp2d6_inhibitor,
            "inflammation": inflammation,
            "previous_codeine_failure": previous_codeine_failure,
            "previous_opioid_toxicity": previous_opioid_toxicity,
            "cyp2d6_translation_applied": bool(cyp2d6_translation.get("ok")),
        }

        patient_df = pd.DataFrame([patient])

        # AI predictions (analgesic / safety); functional model may be overridden by CPIC translation
        functional_prediction, functional_conf, functional_probs = predict_with_confidence(
            functional_model,
            patient_df
        )

        functional_prediction, functional_conf, functional_probs = merge_functional_with_cyp2d6(
            functional_prediction,
            functional_conf,
            functional_probs,
            cyp2d6_translation,
        )

        analgesic_prediction, analgesic_conf, analgesic_probs = predict_with_confidence(
            analgesic_model,
            patient_df
        )

        safety_prediction, safety_conf, safety_probs = predict_with_confidence(
            safety_model,
            patient_df
        )

        # Apply clinical guardrails
        guarded = apply_clinical_guardrails(
            egfr=egfr,
            spo2=spo2,
            suspected_acs=suspected_acs,
            sedatives=sedatives,
            morphine_allergy=morphine_allergy,
            functional_prediction=functional_prediction,
            functional_conf=functional_conf,
            functional_probs=functional_probs,
            analgesic_prediction=analgesic_prediction,
            analgesic_conf=analgesic_conf,
            analgesic_probs=analgesic_probs,
            safety_prediction=safety_prediction,
            safety_conf=safety_conf,
            safety_probs=safety_probs
        )

        functional_prediction = guarded["functional_prediction"]
        functional_conf = guarded["functional_conf"]
        functional_probs = guarded["functional_probs"]

        analgesic_prediction = guarded["analgesic_prediction"]
        analgesic_conf = guarded["analgesic_conf"]
        analgesic_probs = guarded["analgesic_probs"]

        safety_prediction = guarded["safety_prediction"]
        safety_conf = guarded["safety_conf"]
        safety_probs = guarded["safety_probs"]

        override_notes = guarded["override_notes"]

        explanation = build_explanation(
            patient,
            functional_prediction,
            analgesic_prediction,
            safety_prediction,
            override_notes
        )
        explanation = enrich_explanation_with_cyp2d6(explanation, cyp2d6_translation)

        disclaimer = (
            "Proof-of-concept: analgesic and safety outputs use ML models trained on clinically informed synthetic data, "
            "with guideline-based safety guardrails. "
            "When CYP2D6 star alleles are provided, functional phenotype is derived from a "
            "CPIC-based genotype-to-phenotype translation engine (not symptom-based AI). "
            "Not for real clinical use without validation."
        )

        result = {
            "patient_summary": patient,
            "cyp2d6_translation": cyp2d6_translation,
            "functional_phenotype": {
                "prediction": functional_prediction,
                "confidence": functional_conf,
                "probabilities": functional_probs
            },
            "analgesic_recommendation": {
                "prediction": analgesic_prediction,
                "confidence": analgesic_conf,
                "probabilities": analgesic_probs
            },
            "safety_risk": {
                "prediction": safety_prediction,
                "confidence": safety_conf,
                "probabilities": safety_probs
            },
            "clinical_explanation": explanation,
            "guardrails_applied": override_notes,
            "disclaimer": disclaimer,
        }

        return jsonify(result)

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


# =========================


# =========================
# SCAIA Chat with OpenAI + Knowledge Base
# =========================

from pathlib import Path


def load_scdaid_knowledge():
    knowledge_path = Path("scdaid_knowledge.txt")
    if knowledge_path.exists():
        return knowledge_path.read_text()
    return """
SCDAid is an educational clinical decision-support prototype for sickle cell disease vaso-occlusive crisis (SCD VOC) analgesic selection.
SCDAid is not an official guideline and is not a substitute for clinical judgment.

Core rules:
- Do not call SCDAid logic guidelines. Say prototype logic, decision logic, or safety guardrails.
- CYP2D6 PM = poor metabolizer.
- CYP2D6 IM = intermediate metabolizer.
- CYP2D6 NM/EM = normal metabolizer.
- CYP2D6 UM = ultrarapid metabolizer.
- Codeine and tramadol are CYP2D6-dependent.
- Avoid or flag codeine/tramadol in CYP2D6 PM or UM.
- Strong CYP2D6 inhibitors can cause phenoconversion.
- Fluoxetine, paroxetine, and bupropion are strong CYP2D6 inhibitors.
- eGFR < 30 = HIGH renal risk.
- eGFR 30–59 = MODERATE renal risk.
- eGFR >= 60 = LOW renal risk.
- Never say low eGFR when eGFR is 60 or above. Say low renal risk.
- If eGFR < 30, fentanyl is generally preferred in this prototype.
- If eGFR 30–59, hydromorphone is generally preferred in this prototype.
- If eGFR >= 60 and no contraindications, morphine may be considered.
- SpO2 < 95% or suspected ACS increases respiratory monitoring needs.
- If model output conflicts with safety guardrails, safety guardrails should override model output.
"""



def local_arabic_dialect_intent_answer(question):
    """
    Handles short Saudi/Arabic casual messages before generic fallback.
    Returns a string answer or None.
    """
    q = str(question or "").strip()
    q_norm = q.replace("؟", "").replace("!", "").replace(".", "").strip()
    q_lower = q_norm.lower()

    # Identity/name follow-ups
    if any(x in q_lower for x in ["ليه اسمك", "ليش اسمك", "معنى اسمك", "وش يعني سكايا", "وش معنى scaia", "ليش scaia"]):
        return (
            "اسم SCAIA جاي من فكرة إنها مساعد ذكي مرتبط بـ SCDAid. "
            "يعني هو جزء الشرح والمحادثة داخل المشروع، يساعد المستخدم يفهم التوصيات والتحاليل بدل ما تكون الأداة مجرد أرقام ونتائج."
        )

    if q_lower in ["اسمك", "وش اسمك", "ايش اسمك", "من انت", "مين انت", "انت مين"]:
        return (
            "اسمي SCAIA، وأنا المساعد الذكي داخل SCDAid. "
            "أشرح لك منطق التوصيات، CYP2D6، اختيار المسكن، عوامل السلامة، والتحاليل الجينية بطريقة مبسطة."
        )

    # Rejection / dissatisfaction
    if q_lower in ["لا", "لا ابي", "ما ابي", "مو كذا", "لا مو كذا", "غلط", "مو هذا", "لا غلط"]:
        return (
            "تمام، فهمت إن الرد مو اللي تبغينه. "
            "قولي لي تبغينه أقصر؟ أبسط؟ أشرح نقطة معيّنة؟ أو أعدّل طريقة جواب SCAIA؟"
        )

    # Simple acknowledgment / casual continuation
    if q_lower in ["تمام", "اوكي", "أوكي", "طيب", "ايه", "اي", "صح", "حلو", "كويس", "تمام خلاص"]:
        return (
            "تمام، أنا معك. كمّلي وش تبغين نعدّل أو نختبر؟"
        )

    # Why / clarify
    if q_lower in ["ليه", "ليش", "كيف يعني", "وش تقصد", "ما فهمت", "مو فاهمة", "وضح", "اشرح اكثر"]:
        return (
            "أكيد، أوضح لك. أي جزء تقصدين بالضبط؟ الاسم؟ اللوجيك؟ التحاليل؟ أو طريقة رد SCAIA؟"
        )

    # Ask to be more human/friendly
    if any(x in q_lower for x in ["تكلم طبيعي", "خلك طبيعي", "تكلم كانك انسان", "لا تكون رسمي", "فرندلي", "اسلوبك"]):
        return (
            "تمام، بخلي أسلوبي أبسط وأقرب للمحادثة الطبيعية. "
            "بس مع المعلومات الطبية بحافظ على الدقة وما أعطي كلام نهائي بدون تنبيه."
        )

    # Lab routing explanation
    if any(x in q_lower for x in ["متى تفتح اللاب", "متى اروح للاب", "متى يفتح lab", "متى يفتح اللاب"]):
        return (
            "أفتح Lab Interpreter فقط إذا طلبتي تحليل صورة أو نتيجة، مثل: "
            "«أبي أحلل gel image» أو «عندي Sanger chromatogram». "
            "أما إذا سألتي عن الشرح أو اللوجيك أو الفكرة، أجاوبك هنا داخل الشات."
        )

    return None


# UI-ready answer for genotype-from-symptoms / SCD history / VOC pain methodology questions.
# Single source for /chat early return, OpenAI-error fallback, and local_scdaid_answer.
CYP2D6_GENOTYPE_PREDICTION_CONCISE_REPLY = (
    "No, not reliably. AI cannot determine CYP2D6 genotype from symptoms, VOC pain response, "
    "or SCD history alone. These clinical features are not sufficient to confirm genotype.\n\n"
    "AI may only support probabilistic genotype estimation when broader genetic data are "
    "available, such as CYP2D6 sequencing, copy-number information, structural variants, or "
    "phasing data.\n\n"
    "For SCDAid, the core workflow should remain CPIC-based genotype-to-phenotype translation "
    "using confirmed allele/genotype data, followed by phenoconversion adjustment and then "
    "analgesic recommendation support. AI-based genotype imputation should remain an optional "
    "future layer, not the current clinical foundation."
)


def format_genotype_prediction_knowledge_reply(question):
    """
    Exclusive reply for genotype-prediction / genotype-to-phenotype methodology questions.
    Always the same concise text (no file extraction, no offline notes).
    """
    _ = question  # signature kept for callers
    return CYP2D6_GENOTYPE_PREDICTION_CONCISE_REPLY


def should_route_genotype_prediction_to_knowledge_base(question):
    """
    True when the user is asking about inferring/ predicting CYP2D6 genotype from
    clinical presentation, AI/ML, or genotype-to-phenotype translation — not a VOC vignette.
    """
    q = str(question or "").strip()
    if not q:
        return False
    ql = q.lower()

    topic = (
        "cyp2d6" in ql
        or "genotype" in ql
        or "diplotype" in ql
        or ("allele" in ql and ("cyp2d6" in ql or "copy number" in ql or "cnv" in ql or "structural" in ql))
    )
    if not topic:
        return False

    methodology_en = [
        "predict", "prediction", "infer", "inference", "imput", "symptom", "symptoms",
        "clinical data", "scd history", "pain response", "machine learning",
        " can ai", "can ai", "does ai", "could ai", "will ai", " ai infer",
        "genotype-to-phenotype", "phenotype translation",
        "without laboratory", "without lab", "without genetic",
        "reliable", "sufficient to determine", "difference between",
        "from symptoms", "from clinical presentation", "estimate genotype",
        "guessing genotype", "guess genotype", "infer genotype",
        "predict genotype", "imputation",
    ]
    if any(m in ql for m in methodology_en):
        return True
    if "translation" in ql and ("genotype" in ql or "phenotype" in ql or "cpic" in ql):
        return True

    if text_contains_arabic(q):
        if ("جين" in q or "جينات" in q or "cyp2d6" in ql) and any(
            x in q for x in ("تنبؤ", "استنتاج", "أعراض", "الأعراض", "ذكاء", "اصطناعي", "توقع", "من التاريخ")
        ):
            return True

    return False


def triggers_voc_case_template_answer(q_lower):
    """
    The legacy canned response describes a multi-variable VOC scenario (renal + resp + CYP2D6).
    Only use it when the question looks like that kind of case, not for single-topic queries.
    """
    score = 0
    if "egfr" in q_lower or " gfr" in q_lower or q_lower.startswith("gfr"):
        score += 1
    if "spo2" in q_lower or "o2 sat" in q_lower:
        score += 1
    if any(w in q_lower for w in ("voc", "vaso-occlusive", "vasoocclusive", "sickle cell", " sickle ")):
        score += 1
    if any(w in q_lower for w in ("fluoxetine", "paroxetine", "bupropion")):
        score += 1
    if any(
        w in q_lower
        for w in (
            "patient",
            "case",
            "scenario",
            "year-old",
            "year old",
            " y/o",
            " yo ",
            "56-year",
            "58-year",
        )
    ):
        score += 1
    return score >= 2


def local_scdaid_answer(question, context=None):
    """
    Smarter local fallback when OpenAI is unavailable.
    Uses triple-quoted strings to avoid syntax errors.
    """
    q = str(question or "").strip()
    q_lower = q.lower()

    wants_arabic = (
        text_contains_arabic(q)
        or "تكلم عربي" in q_lower
        or "رد عربي" in q_lower
        or "بالعربي" in q_lower
        or "عربي" in q_lower
    )

    if wants_arabic:
        dialect_answer = local_arabic_dialect_intent_answer(q)
        if dialect_answer:
            return dialect_answer

    if should_route_genotype_prediction_to_knowledge_base(q):
        return format_genotype_prediction_knowledge_reply(q)

    clinical_terms = [
        "voc", "sickle", "scd", "cyp2d6", "egfr", "spo2", "fluoxetine",
        "paroxetine", "renal", "respiratory", "acs", "opioid", "morphine",
        "hydromorphone", "fentanyl", "tramadol", "codeine",
        "أنيميا", "منجل", "منجلية", "أزمة", "ألم", "جين", "مسكن",
        "مورفين", "هيدرومورفون", "فنتانيل", "ترامادول", "كودايين",
        "كلية", "تنفس", "اكسجين", "أكسجين"
    ]

    is_case = any(term in q_lower for term in clinical_terms)
    use_voc_case_template = is_case and triggers_voc_case_template_answer(q_lower)

    if wants_arabic and use_voc_case_template:
        return """هذا سؤال clinical reasoning، لذلك SCAIA المفروض يجاوب داخل الشات ولا يفتح Lab Interpreter؛ لأنه ما فيه طلب رفع صورة أو تحليل مختبري.

التحليل المنطقي حسب SCDAid:

1. CYP2D6 genotype غير معروف، ومع وجود fluoxetine فهذا مهم لأنه يعتبر strong CYP2D6 inhibitor. هذا قد يسبب phenoconversion، يعني حتى لو كان الجين طبيعي ممكن وظيفة CYP2D6 تنخفض. لذلك codeine و tramadol ما يكونون خيارات مناسبة أو مفضلة لأنهم يعتمدون على CYP2D6.

2. eGFR = 42 يعني renal risk متوسط. هنا لازم الحذر مع الأدوية اللي تتأثر بالكلى. morphine قد يحتاج حذر بسبب احتمال تراكم metabolites مع ضعف الكلى، لذلك hydromorphone قد يكون خيارًا أنسب من ناحية renal safety حسب منطق النموذج والبروتوكول المحلي.

3. SpO2 = 93% يعتبر منخفض، وهذا يرفع القلق من respiratory risk أو احتمال ACS خصوصًا في مريض SCD مع VOC. SCAIA لازم يذكر monitoring قوي: تقييم ACS، متابعة SpO2، التنفس، sedation score، والتصعيد السريري إذا الحالة غير مستقرة.

4. إذا الألم severe VOC، يحتاج تسكين فعال وسريع، لكن مع safety guardrails. القرار لا يعتمد فقط على شدة الألم، بل على الكلى، التنفس، الأدوية المصاحبة، وCYP2D6.

الخلاصة: SCAIA يجب أن يشرح أن fluoxetine يجعل codeine/tramadol غير مناسبين، eGFR 42 يدعم الحذر الكلوي وقد يميل إلى hydromorphone بدل morphine، وSpO2 93% يتطلب تقييم respiratory/ACS ومراقبة لصيقة. هذا تفسير تعليمي وليس أمرًا علاجيًا نهائيًا."""

    if (not wants_arabic) and use_voc_case_template:
        return """This is a clinical reasoning question, so SCAIA should answer in chat and should not open the Lab Interpreter unless the user asks to upload or analyze a lab image.

Reasoning:
1. CYP2D6 genotype is unknown, and fluoxetine is a strong CYP2D6 inhibitor. This may cause phenoconversion, so codeine and tramadol should not be preferred because they depend on CYP2D6 activation.
2. eGFR 42 indicates moderate renal risk. Morphine may require caution because of metabolite accumulation concerns, so hydromorphone may be considered more suitable depending on protocol and patient context.
3. SpO2 93% raises respiratory safety concern and should prompt assessment for hypoxia or acute chest syndrome, with close monitoring.
4. Severe VOC pain needs effective analgesia, but SCDAid safety guardrails should consider renal function, respiratory status, CYP2D6 inhibition, and toxicity history.

Educational interpretation only, not a substitute for clinical judgment."""

    if wants_arabic:
        if "وظيفة" in q or "وش" in q or "ايش" in q or "ما وظيفة" in q:
            return """وظيفة SCAIA إنه يكون مساعد تعليمي داخل SCDAid. يشرح منطق التوصيات، CYP2D6، اختيار المسكن، عوامل السلامة، ومتى نفتح Lab Interpreter للتحليل."""

        return """تمام، فهمت عليك. اسأليني بشكل مباشر عن الجزء اللي تبينه، وبجاوبك بالعربي: منطق SCDAid، CYP2D6، اختيار المسكن، السلامة، أو تحاليل SCAIA Lab Interpreter."""

    return """SCAIA can explain SCDAid recommendations, CYP2D6 logic, opioid selection, renal and respiratory safety, and PGx lab interpretation. Please ask a specific question so I can help clearly."""


def fetch_cpic_live_context():
    """
    Fetches current public CPIC context from official CPIC/ClinPGx pages.
    If internet access fails, it returns a clear message and the chat will rely on local knowledge.
    """
    try:
        import requests
        from bs4 import BeautifulSoup
    except Exception as e:
        return "CPIC live context unavailable because required packages are missing: " + str(e)

    urls = [
        "https://www.clinpgx.org/guideline/PA166251454",
        "https://cpicpgx.org/gene/CYP2D6/",
        "https://cpicpgx.org/guidelines/"
    ]

    chunks = []

    for url in urls:
        try:
            response = requests.get(
                url,
                timeout=12,
                headers={
                    "User-Agent": "SCDAid educational prototype"
                }
            )
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")

            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()

            text = " ".join(soup.get_text(" ").split())

            if text:
                chunks.append(
                    "Source: " + url + "\n" + text[:5000]
                )

        except Exception as e:
            chunks.append(
                "Could not fetch " + url + ". Error: " + str(e)
            )

    return "\n\n".join(chunks)


@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json() or {}
        question = data.get("question") or data.get("message") or ""
        context = data.get("context", {})
        chat_history = data.get("chat_history", [])
        language_instruction = get_scaia_language_instruction(question)

        if not question:
            return jsonify({
                "answer": "Please enter a question for SCAIA.",
                "mode": "empty"
            })

        if any(x in str(question).lower() for x in ["تكلم عربي", "رد عربي", "بالعربي", "اشرح عربي"]):
            return jsonify({
                "answer": "أكيد، من الآن برد عليك بالعربي. اسألني عن SCDAid أو SCAIA أو التحاليل، وبشرح لك بشكل واضح.",
                "mode": "arabic_direct"
            })

        if should_route_genotype_prediction_to_knowledge_base(str(question)):
            return jsonify({
                "answer": format_genotype_prediction_knowledge_reply(question),
                "mode": "genotype_knowledge_only",
            })

        api_key = os.getenv("OPENAI_API_KEY")

        if not api_key:
            return jsonify({
                "answer": local_scdaid_answer(question, context),
                "mode": "local_no_api_key"
            })

        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)

            scdaid_knowledge = load_scdaid_knowledge()
            latest_terms = ["latest", "current", "update", "updates", "news", "cpic", "CPIC", "أحدث", "آخر", "اخر", "تحديث", "تحديثات", "السيبك", "سيبك"]
            if any(term in str(question) for term in latest_terms):
                cpic_live_context = fetch_cpic_live_context()
            else:
                cpic_live_context = "CPIC live context was not fetched because the user did not ask for current CPIC updates. Use the local SCDAid knowledge base."

            learned_rules = load_text_file_safe("scaia_learned_rules.txt")
            system_prompt = f"""
You are SCAIA, a conversational clinical pharmacy explanation assistant inside the SCDAid prototype.

{language_instruction}

CRITICAL LANGUAGE RULE:
If the user's message contains Arabic letters, reply in Arabic.
If the user asks "تكلم عربي", "رد عربي", "بالعربي", or similar, reply in Arabic only.
Do not answer Arabic messages in English.
Keep scientific terms in English only when needed, such as CYP2D6, phenotype, eGFR, SpO2, ACS.

Your goal:
You should be able to take and give in conversation. Do not only give one rigid answer.
Explain, clarify, compare, and answer follow-up questions naturally.

Use the SCDAid knowledge base, the current CPIC live context, and the provided patient/result context when explaining the tool.
If the user asks for latest CPIC news, recent CPIC updates, or current CPIC changes, use the CPIC live context.
If the CPIC live context could not be fetched, say that live CPIC checking is unavailable and answer from the local SCDAid knowledge base.
Do not invent recent CPIC updates.
Do not claim there is a new CPIC update unless the live CPIC context explicitly supports it.

Important behavior:
- Be conversational, but clinically professional.
- Explain the reasoning behind the recommendation.
- If the user asks “why,” explain the mechanism and decision logic.
- If the user asks about an enzyme, explain what it does, why it matters, and how SCDAid uses it.
- If the user asks about CYP2D6, connect it to codeine/tramadol when relevant.
- If the user asks about inhibitors, explain phenoconversion.
- If the user asks about renal function, explain eGFR categories and opioid safety.
- If the user asks about ACS, SpO2, respiratory risk, sedatives, inflammation, or toxicity, connect these to safety monitoring.
- If patient data is missing, do not invent data. Say what is missing and answer generally.
- If the model output conflicts with safety guardrails, explain that SCDAid safety guardrails should override the model output.
- If the user asks how to explain the project to a professor, answer in clear presentation language.
- If the user asks a skeptical professor-style question, give a strong but honest defense.

Strict safety and wording:
- SCDAid is NOT an official guideline.
- Do not call SCDAid logic “guidelines.”
- Say “SCDAid prototype logic,” “SCDAid decision logic,” or “SCDAid safety guardrails.”
- Do not claim SCDAid is clinically validated.
- Do not give definitive medical orders.
- Always mention that SCDAid is an educational prototype and not a substitute for clinical judgment when giving clinical interpretation.

SCDAid knowledge base:
{scdaid_knowledge}\n\nSCAIA learned rules from reviewed feedback:\n{learned_rules}

Current CPIC live context:
{cpic_live_context}
"""
            user_prompt = f"""
Recent chat history:
{chat_history}

User question:
{question}

Current SCDAid context:
{context}

Answer as SCAIA.

{language_instruction}

If the user wrote in Arabic or requested Arabic, your entire answer must be in Arabic, except necessary scientific terms.
Keep the answer clinically clear, accurate, conversational, and not too long.
"""

            response = client.responses.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
                input=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.45,
                max_output_tokens=700
            )

            return jsonify({
                "answer": response.output_text,
                "mode": "openai_knowledge"
            })

        except Exception as ai_error:
            if should_route_genotype_prediction_to_knowledge_base(str(question)):
                return jsonify({
                    "answer": format_genotype_prediction_knowledge_reply(question),
                    "mode": "genotype_knowledge_only",
                })
            fallback = local_scdaid_answer(question, context)
            return jsonify({
                "answer": fallback + "\n\nNote: OpenAI knowledge mode failed, so SCDAid answered in local mode. Backend error: " + str(ai_error),
                "mode": "local_openai_error"
            })

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500



# =========================
# SCAIA DNA Gel Image Assist
# Educational image analysis only
# =========================

@app.route("/analyze-gel", methods=["POST"])
def analyze_gel():
    try:
        import cv2
        import numpy as np
        import base64

        if "image" not in request.files:
            return jsonify({"error": "No image uploaded."}), 400

        file = request.files["image"]

        ladder_lane = int(request.form.get("ladder_lane", "1"))
        ladder_sizes_raw = request.form.get("ladder_sizes", "1500,1000,700,500,300,200,100")
        target_size_raw = request.form.get("target_size", "").strip()

        ladder_sizes = []
        for x in ladder_sizes_raw.replace(" ", "").split(","):
            if x:
                ladder_sizes.append(float(x))

        if len(ladder_sizes) < 3:
            return jsonify({"error": "Please provide at least 3 ladder sizes, e.g. 1500,1000,700,500,300,200,100"}), 400

        img_bytes = np.frombuffer(file.read(), np.uint8)
        img = cv2.imdecode(img_bytes, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({"error": "Could not read the uploaded image."}), 400

        original = img.copy()
        h, w = img.shape[:2]

        # Resize very large images for stable processing
        max_w = 1100
        if w > max_w:
            scale = max_w / w
            img = cv2.resize(img, (int(w * scale), int(h * scale)))
            original = cv2.resize(original, (int(w * scale), int(h * scale)))
            h, w = img.shape[:2]

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Normalize and invert if needed so bands become bright signal
        gray = cv2.GaussianBlur(gray, (5, 5), 0)
        norm = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)

        # If background is bright and bands dark, invert
        if np.mean(norm) > 120:
            signal = 255 - norm
        else:
            signal = norm

        # Enhance contrast
        signal = cv2.normalize(signal, None, 0, 255, cv2.NORM_MINMAX)

        # Detect lane centers from vertical intensity profile
        vertical_profile = np.mean(signal, axis=0)
        vertical_profile = cv2.GaussianBlur(vertical_profile.reshape(1, -1), (1, 31), 0).flatten()

        threshold = np.percentile(vertical_profile, 75)
        peaks = []
        min_dist = max(20, w // 30)

        for i in range(1, len(vertical_profile) - 1):
            if vertical_profile[i] > threshold and vertical_profile[i] >= vertical_profile[i - 1] and vertical_profile[i] >= vertical_profile[i + 1]:
                if not peaks or abs(i - peaks[-1]) > min_dist:
                    peaks.append(i)
                elif vertical_profile[i] > vertical_profile[peaks[-1]]:
                    peaks[-1] = i

        # Fallback if lanes are not detected well
        if len(peaks) < 2:
            n_guess = 6
            peaks = [int((i + 0.5) * w / n_guess) for i in range(n_guess)]

        lane_centers = sorted(peaks)
        lane_count = len(lane_centers)

        if ladder_lane < 1 or ladder_lane > lane_count:
            return jsonify({
                "error": f"Ladder lane number is out of range. Detected approximately {lane_count} lanes."
            }), 400

        lane_half_width = max(8, min(22, w // 80))

        def lane_band_positions(center_x):
            x1 = max(0, center_x - lane_half_width)
            x2 = min(w, center_x + lane_half_width)
            lane_img = signal[:, x1:x2]
            profile = np.mean(lane_img, axis=1)
            profile = cv2.GaussianBlur(profile.reshape(-1, 1), (1, 9), 0).flatten()

            band_threshold = np.percentile(profile, 85)
            min_band_dist = max(10, h // 45)

            ys = []
            for y in range(1, len(profile) - 1):
                if profile[y] > band_threshold and profile[y] >= profile[y - 1] and profile[y] >= profile[y + 1]:
                    if not ys or abs(y - ys[-1]) > min_band_dist:
                        ys.append(y)
                    elif profile[y] > profile[ys[-1]]:
                        ys[-1] = y

            # Remove very weak bands using relative intensity
            if ys:
                max_val = max(profile[y] for y in ys)
                ys = [y for y in ys if profile[y] >= max_val * 0.35]

            return sorted(ys), profile

        ladder_center = lane_centers[ladder_lane - 1]
        ladder_ys, ladder_profile = lane_band_positions(ladder_center)

        if len(ladder_ys) < 3:
            return jsonify({
                "error": "Could not detect enough ladder bands. Try a clearer gel image or adjust ladder lane."
            }), 400

        # Match ladder bands to provided sizes.
        # Larger bp bands stay higher; smaller bp bands migrate lower.
        n = min(len(ladder_ys), len(ladder_sizes))
        ladder_ys_used = np.array(ladder_ys[:n], dtype=float)
        ladder_sizes_used = np.array(ladder_sizes[:n], dtype=float)

        # Fit log10(bp) = a*y + b
        coeff = np.polyfit(ladder_ys_used, np.log10(ladder_sizes_used), 1)

        def estimate_bp(y):
            log_bp = coeff[0] * y + coeff[1]
            return float(10 ** log_bp)

        results = []
        annotated = original.copy()

        # Draw lanes
        for idx, cx in enumerate(lane_centers, start=1):
            color = (0, 215, 255) if idx == ladder_lane else (255, 180, 60)
            cv2.line(annotated, (cx, 0), (cx, h), color, 1)
            cv2.putText(annotated, f"L{idx}", (max(3, cx - 15), 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)

        # Draw ladder bands
        for y, size in zip(ladder_ys_used, ladder_sizes_used):
            cv2.circle(annotated, (ladder_center, int(y)), 6, (0, 255, 255), -1)
            cv2.putText(annotated, f"{int(size)}bp", (min(w - 90, ladder_center + 12), int(y) + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 255, 255), 1)

        # Analyze sample lanes
        for idx, cx in enumerate(lane_centers, start=1):
            ys, _ = lane_band_positions(cx)

            lane_bands = []
            for y in ys:
                bp = estimate_bp(y)
                lane_bands.append({
                    "y_px": int(y),
                    "estimated_bp": round(bp, 1)
                })

                if idx != ladder_lane:
                    cv2.circle(annotated, (cx, int(y)), 5, (0, 80, 255), -1)
                    cv2.putText(annotated, f"{int(round(bp))}bp", (min(w - 85, cx + 10), int(y) + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 80, 255), 1)

            results.append({
                "lane": idx,
                "type": "ladder" if idx == ladder_lane else "sample",
                "bands": lane_bands
            })

        target_comment = ""
        if target_size_raw:
            try:
                target_size = float(target_size_raw)
                tolerance = max(30, target_size * 0.12)
                matching = []
                for lane in results:
                    if lane["type"] == "sample":
                        for band in lane["bands"]:
                            if abs(band["estimated_bp"] - target_size) <= tolerance:
                                matching.append((lane["lane"], band["estimated_bp"]))

                if matching:
                    target_comment = "Possible target-size bands detected near the expected size in: " + ", ".join(
                        [f"Lane {lane} (~{round(bp)} bp)" for lane, bp in matching]
                    )
                else:
                    target_comment = "No clear sample band was detected near the expected target size using the current tolerance."
            except Exception:
                target_comment = "Target size was provided but could not be interpreted as a number."

        # Encode annotated image
        ok, buffer = cv2.imencode(".png", annotated)
        annotated_b64 = ""
        if ok:
            annotated_b64 = base64.b64encode(buffer).decode("utf-8")

        explanation_lines = []
        explanation_lines.append("SCAIA DNA Gel Image Assist detected approximate lanes and bands from the uploaded gel image.")
        explanation_lines.append(f"Detected lanes: {lane_count}. Ladder lane used: Lane {ladder_lane}.")
        explanation_lines.append("Band sizes were estimated by calibrating migration distance against the DNA ladder using a log10(bp) relationship.")
        if target_comment:
            explanation_lines.append(target_comment)
        explanation_lines.append("This is an educational preliminary image analysis, not a final genotype call. Final interpretation requires assay target, expected band size, controls, and laboratory validation.")

        return jsonify({
            "mode": "gel_image_assist",
            "message": "\n".join(explanation_lines),
            "lane_count": lane_count,
            "ladder_lane": ladder_lane,
            "ladder_bands_detected": len(ladder_ys),
            "results": results,
            "annotated_image_base64": annotated_b64
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500



# =========================
# SCAIA PGx Lab Result Interpreter
# Multimodal educational interpretation
# =========================

@app.route("/analyze-assay", methods=["POST"])
def analyze_assay():
    try:
        import base64
        import mimetypes
        from openai import OpenAI

        if "file" not in request.files:
            return jsonify({"error": "No image/file uploaded."}), 400

        uploaded = request.files["file"]
        assay_type = request.form.get("assay_type", "auto")
        gene_target = request.form.get("gene_target", "").strip()
        variant_target = request.form.get("variant_target", "").strip()
        expected_result = request.form.get("expected_result", "").strip()
        extra_notes = request.form.get("extra_notes", "").strip()

        file_bytes = uploaded.read()
        filename = uploaded.filename or "uploaded_assay_image"
        mime_type = uploaded.mimetype or mimetypes.guess_type(filename)[0] or "image/png"

        if not mime_type.startswith("image/"):
            return jsonify({
                "error": "This first version accepts images only. PDF/table upload can be added next."
            }), 400

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return jsonify({
                "error": "OPENAI_API_KEY is missing. Add it in Render Environment or terminal."
            }), 500

        image_b64 = base64.b64encode(file_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{image_b64}"

        client = OpenAI(api_key=api_key)
        model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

        system = """
You are SCAIA PGx Lab Result Interpreter.

You help users interpret uploaded pharmacogenomic / molecular assay output images in educational mode.

Supported result types:
- Gel electrophoresis
- Sanger sequencing chromatogram
- qPCR amplification curve
- Allelic discrimination plot
- HRM / melt curve
- Copy number / CNV plot
- NGS variant table screenshot
- Unknown molecular assay image

Important safety:
- Do NOT give a final genotype call from an image alone.
- Do NOT claim diagnostic certainty.
- Provide preliminary educational interpretation only.
- Always state what additional assay details are needed.
- If the image is not suitable, say why.
- If the image type is unclear, identify possible types and ask for clarification.
- If the result could later be used in SCDAid, say it must be confirmed first by the validated laboratory workflow.

Style:
- Be clear, professional, concise, and useful.
- If Arabic is appropriate, answer in Arabic with English scientific terms when needed.
- Focus on what is visible in the image, not assumptions.
"""

        prompt = f"""
Analyze this uploaded molecular / pharmacogenomic assay image.

User-selected assay type: {assay_type}
Gene target if provided: {gene_target or "not provided"}
Variant/allele target if provided: {variant_target or "not provided"}
Expected result / expected band size / expected cluster if provided: {expected_result or "not provided"}
Extra notes: {extra_notes or "none"}

If the assay type is Sanger chromatogram, focus specifically on:
- chromatogram peak quality
- peak overlap or noise
- possible mixed peak / heterozygous pattern
- whether the highlighted or provided variant position is visible
- whether reference base, alternate base, position, and read direction are missing
- whether the image is sufficient for preliminary interpretation
- do NOT claim a final genotype from image alone

If the assay type is qPCR, focus specifically on:
- whether amplification curves are visible
- whether the curve has a true exponential phase or looks like background/noise
- approximate Ct/Cq context if provided by the user
- whether positive control and NTC/negative control are shown or missing
- whether replicates look consistent if visible
- whether the image supports preliminary positive/negative/indeterminate interpretation
- do NOT claim a final genotype without assay target, threshold, controls, and lab validation

If the assay type is allelic discrimination, focus specifically on:
- whether distinct clusters are visible
- whether sample points appear near WT, heterozygous, mutant, or NTC/no-call regions
- whether cluster separation is clear or overlapping
- whether dye/channel labels are provided, e.g., FAM vs VIC/HEX
- whether control clusters are present and labeled
- whether the sample can only be described as preliminary/possible
- do NOT claim a final genotype without validated controls, channel mapping, and lab confirmation

If the assay type is HRM or melt curve, focus specifically on:
- whether melt curves are visible and readable
- whether curve shape differs from the WT/reference control
- whether a Tm shift is visible or provided by the user
- whether WT, variant, heterozygous, and NTC controls are present
- whether the result suggests possible variant pattern or is indeterminate
- do NOT claim a final genotype without validated control curves, Tm thresholds, and lab confirmation

If the assay type is CNV or copy number, focus specifically on:
- whether the screenshot appears to show copy-number values, CNV plot, MLPA/qPCR CNV output, or a copy-number table
- whether the result suggests normal copy number, deletion, duplication, or indeterminate/no-call
- whether expected normal copy number is provided, usually 2 copies for autosomal genes
- whether a reference gene, calibrator, thresholds, and controls are provided
- whether CYP2D6 copy-number complexity may require confirmatory testing
- do NOT claim a final diplotype or genotype without validated CNV workflow and confirmation

If the assay type is NGS variant table, focus specifically on:
- whether the screenshot appears to show a variant table, report table, or sequencing result summary
- visible gene, variant, rsID, genomic position, transcript, consequence, zygosity, allele frequency, and coverage/depth
- whether the variant appears heterozygous, homozygous, or uncertain based only on visible fields
- whether coverage/depth and quality/filter status are sufficient or missing
- whether PGx star-allele translation is possible or requires a validated allele-calling tool
- do NOT claim a final diplotype, phenotype, or clinical recommendation without validated variant calling, allele translation, and lab confirmation

Return the answer using this structure:

1. Image type detected
2. Image quality / peak clarity
3. Visible peak pattern
4. Possible preliminary interpretation
5. Missing information needed for reliable interpretation
6. Confidence level: Low / Moderate / High
7. Can this be applied to SCDAid now? Explain why or why not

For gel images:
- Mention bands/lanes visually if visible.
- If exact ladder sizes are not clear, do not invent exact bp sizes.
- Recommend using the Gel Image Assist tool for ladder-based bp estimation.

For Sanger chromatograms:
- Discuss peak clarity, possible mixed peaks, and need for reference sequence/position.

For qPCR:
- Discuss amplification, Ct/threshold/controls needed.

For allelic discrimination:
- Discuss clusters and need for control labels.

For HRM/melt curve:
- Discuss curve shift/Tm and need for wild-type/variant controls.

For CNV/copy number:
- Discuss signal/copy number pattern and need for validated thresholds.

For NGS table:
- Extract visible gene/variant/zygosity/coverage if readable, but do not overclaim.
"""

        response = client.responses.create(
            model=model,
            input=[
                {
                    "role": "system",
                    "content": system
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": prompt},
                        {"type": "input_image", "image_url": data_url}
                    ]
                }
            ],
            temperature=0.25,
            max_output_tokens=900
        )

        answer = response.output_text

        return jsonify({
            "mode": "pgx_lab_result_interpreter",
            "assay_type": assay_type,
            "answer": answer
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500





# =========================
# SCAIA Feedback Collection + Safe Learning
# =========================

def validate_feedback_correction(question, answer, reason, correction):
    """
    Classifies user feedback correction before learning.
    Returns: (decision, cleaned_rule, explanation)
    decision = approved / pending / rejected
    """
    correction = (correction or "").strip()
    reason = (reason or "").strip()

    if not correction:
        reason_lower = reason.lower()

        if "عربي" in reason_lower or "arabic" in reason_lower:
            return (
                "approved",
                "If the user writes in Arabic or asks SCAIA to speak Arabic, SCAIA must reply in Arabic.",
                "Arabic language correction inferred from feedback reason."
            )

        if "english" in reason_lower or "إنجليزي" in reason_lower or "انجليزي" in reason_lower:
            return (
                "approved",
                "If the user asks for Arabic, SCAIA must not reply in English.",
                "Language mismatch correction inferred from feedback reason."
            )

        return "pending", "", "No correction was provided."

    if len(correction) < 12:
        return "pending", "", "Correction is too short to become a rule."

    if len(correction) > 700:
        return "pending", "", "Correction is too long and needs review."

    lower = correction.lower()

    dangerous_patterns = [
        "ignore safety",
        "ignore clinical judgment",
        "remove disclaimer",
        "definitive medical order",
        "always prescribe",
        "never monitor",
        "override physician",
        "diagnose genotype directly",
        "final genotype from image",
        "اعط تشخيص نهائي",
        "احذف التحذير",
        "تجاهل السلامة",
        "لا تذكر التحذير",
        "صرف الدواء مباشرة",
        "اعتبرها نتيجة نهائية",
        "شخص الجين من الصورة مباشرة"
    ]

    for pat in dangerous_patterns:
        if pat in lower:
            return "rejected", "", "Correction conflicts with medical/safety guardrails."

    medical_high_risk_terms = [
        "dose", "dosing", "opioid", "morphine", "hydromorphone", "fentanyl",
        "tramadol", "codeine", "ketorolac", "nsaid", "renal", "egfr",
        "cyp2d6", "cpic", "genotype", "phenotype",
        "جرعة", "مورفين", "هيدرومورفون", "فنتانيل", "ترامادول", "كودايين",
        "كلية", "جين", "فينوتايب", "جينوتايب"
    ]

    if any(term in lower for term in medical_high_risk_terms):
        return "pending", "", "Medical/PGx correction requires human review before learning."

    safe_rule_patterns = [
        "reply in arabic",
        "answer in arabic",
        "speak arabic",
        "do not mention",
        "only mention",
        "be concise",
        "ask a clarifying question",
        "open lab interpreter",
        "do not open lab",
        "رد بالعربي",
        "تكلم عربي",
        "لا تذكر",
        "اذكر فقط",
        "اختصر",
        "اسأل سؤال توضيحي",
        "افتح اللاب",
        "لا تفتح اللاب"
    ]

    if any(pat in lower for pat in safe_rule_patterns):
        cleaned = correction.replace("\\n", " ").strip()
        return "approved", cleaned, "Safe style/routing correction approved."

    return "pending", "", "Correction saved for review but not auto-learned."


@app.route("/scaia-feedback", methods=["POST"])
def scaia_feedback():
    try:
        import json
        from datetime import datetime

        data = request.get_json(force=True) or {}

        feedback_item = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "rating": data.get("rating", ""),
            "reason": data.get("reason", ""),
            "corrected_answer": data.get("corrected_answer", ""),
            "question": data.get("question", ""),
            "answer": data.get("answer", ""),
            "page": data.get("page", "")
        }

        decision = ""
        review_note = ""

        if feedback_item.get("rating") == "dislike":
            decision, cleaned_rule, review_note = validate_feedback_correction(
                feedback_item.get("question", ""),
                feedback_item.get("answer", ""),
                feedback_item.get("reason", ""),
                feedback_item.get("corrected_answer", "")
            )

            feedback_item["learning_decision"] = decision
            feedback_item["learning_review_note"] = review_note

            if decision == "approved" and cleaned_rule:
                with open("scaia_learned_rules.txt", "a", encoding="utf-8") as rf:
                    rf.write("\\n- Auto-approved learned rule from feedback: " + cleaned_rule + "\\n")

            elif decision == "pending":
                with open("scaia_pending_feedback.jsonl", "a", encoding="utf-8") as pf:
                    pf.write(json.dumps(feedback_item, ensure_ascii=False) + "\\n")

            elif decision == "rejected":
                with open("scaia_rejected_feedback.jsonl", "a", encoding="utf-8") as rjf:
                    rjf.write(json.dumps(feedback_item, ensure_ascii=False) + "\\n")

        with open("scaia_feedback.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps(feedback_item, ensure_ascii=False) + "\\n")

        return jsonify({
            "ok": True,
            "message": "Feedback saved.",
            "learning_decision": decision,
            "learning_review_note": review_note
        })

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500



if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
