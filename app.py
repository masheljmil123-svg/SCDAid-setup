from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pandas as pd
import joblib
import os


app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)


# =========================
# Load trained models
# =========================

try:
    try:
    try:
    functional_model = joblib.load("functional_phenotype_model.pkl")
except Exception as e:
    print("Warning: functional phenotype model could not be loaded:", e)
    functional_model = None
except Exception as e:
    print("Warning: functional phenotype model could not be loaded:", e)
    functional_model = None
except Exception as e:
    print("Warning: functional phenotype model could not be loaded:", e)
    functional_model = None
analgesic_model = joblib.load("analgesic_recommendation_model.pkl")
safety_model = joblib.load("safety_risk_model.pkl")


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

        renal_risk = renal_risk_from_egfr(egfr)
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
            "previous_opioid_toxicity": previous_opioid_toxicity
        }

        patient_df = pd.DataFrame([patient])

        # AI predictions
        functional_prediction, functional_conf, functional_probs = predict_with_confidence(
            functional_model,
            patient_df
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

        result = {
            "patient_summary": patient,
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
            "disclaimer": "Proof-of-concept AI model trained on clinically informed synthetic data with guideline-based safety guardrails. Not for real clinical use without validation."
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


def local_scdaid_answer(question, context):
    q = str(question).lower()

    if "tramadol" in q or "codeine" in q:
        return (
            "SCDAid flags codeine and tramadol because they are CYP2D6-dependent. "
            "In CYP2D6 poor metabolizers, they may provide inadequate analgesia. "
            "In ultrarapid metabolizers, toxicity risk may increase. Strong CYP2D6 inhibitors can also reduce functional CYP2D6 activity through phenoconversion. "
            "SCDAid is an educational prototype and not a substitute for clinical judgment."
        )

    if "hydromorphone" in q:
        return (
            "Hydromorphone may be preferred in SCDAid prototype logic when renal risk is moderate, when morphine is less preferred, "
            "or when safety factors make morphine less suitable. It is mainly chosen due to renal/safety considerations, not because of CYP2D6 directly. "
            "SCDAid is an educational prototype and not a substitute for clinical judgment."
        )

    if "fentanyl" in q:
        return (
            "Fentanyl may be preferred in SCDAid prototype logic when eGFR is below 30 because that represents high renal risk. "
            "It has less concern for active renal metabolite accumulation compared with morphine. "
            "SCDAid is an educational prototype and not a substitute for clinical judgment."
        )

    if "egfr" in q or "renal" in q or "kidney" in q:
        return (
            "In SCDAid prototype logic, eGFR below 30 is high renal risk, eGFR 30–59 is moderate renal risk, "
            "and eGFR 60 or above is low renal risk. Do not confuse low renal risk with low eGFR."
        )

    return (
        "SCAIA can explain CYP2D6 phenotype, opioid choice, renal safety, inhibitors, inflammation, toxicity, "
        "and why codeine/tramadol may be avoided. SCDAid is educational and not a substitute for clinical judgment."
    )



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

        if not question:
            return jsonify({
                "answer": "Please enter a question for SCAIA.",
                "mode": "empty"
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

            system_prompt = f"""
You are SCAIA, a conversational clinical pharmacy explanation assistant inside the SCDAid prototype.

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
{scdaid_knowledge}

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
            fallback = local_scdaid_answer(question, context)
            return jsonify({
                "answer": fallback + "\n\nNote: OpenAI knowledge mode failed, so SCDAid answered in local mode. Backend error: " + str(ai_error),
                "mode": "local_openai_error"
            })

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)