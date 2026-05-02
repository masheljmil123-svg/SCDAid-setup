import pandas as pd
import joblib


# =========================
# 1. Load trained models
# =========================

functional_model = joblib.load("functional_phenotype_model.pkl")
analgesic_model = joblib.load("analgesic_recommendation_model.pkl")
safety_model = joblib.load("safety_risk_model.pkl")


# =========================
# 2. Helper functions
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

    return prediction, confidence, probability_dict


def build_explanation(patient, functional_prediction, analgesic_prediction, safety_prediction):
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
        explanation.append("Fentanyl is preferred, usually due to high renal risk or safety concerns.")
    elif analgesic_prediction == "hydromorphone_preferred":
        explanation.append("Hydromorphone is preferred due to renal risk, allergy, or safety-related factors.")
    elif analgesic_prediction == "morphine_considered":
        explanation.append("Morphine may be considered because no major renal or allergy contraindication was detected.")
    elif analgesic_prediction == "morphine_or_hydromorphone_preferred_avoid_codeine_tramadol":
        explanation.append("Morphine or hydromorphone may be preferred while avoiding codeine and tramadol.")

    if safety_prediction == "high":
        explanation.append("Overall safety risk is high; close monitoring is required.")
    elif safety_prediction == "moderate":
        explanation.append("Overall safety risk is moderate; monitoring is recommended.")
    else:
        explanation.append("Overall safety risk is low based on the entered variables.")

    return explanation


def print_probability_table(probabilities):
    for label, prob in probabilities.items():
        print(f"- {label}: {prob}")


# =========================
# 3. Enter patient data here
# =========================
# غيري بيانات المريض من هنا فقط

age = 24
weight_kg = 58
pain_severity = "severe"          # mild / moderate / severe
egfr = 45
spo2 = 94
suspected_acs = "yes"             # yes / no
opioid_tolerant = "no"            # yes / no
sedatives = "no"                  # yes / no
morphine_allergy = "no"           # yes / no

cyp2d6_activity_score = 1.5       # 0 / 0.5 / 1 / 1.5 / 2 / 2.5 / 3
cyp2d6_inhibitor = "strong"       # none / moderate / strong
inflammation = "high"             # none / mild / high
previous_codeine_failure = "yes"  # yes / no
previous_opioid_toxicity = "no"   # yes / no


# =========================
# 4. Auto-calculate derived values
# =========================

renal_risk = renal_risk_from_egfr(egfr)
baseline_phenotype = phenotype_from_as(cyp2d6_activity_score)


# =========================
# 5. Prepare patient dataframe
# =========================

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


# =========================
# 6. Predictions
# =========================

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


# =========================
# 7. Output
# =========================

print("\n====================================")
print("SCDAid AI Full Prediction")
print("====================================")

print("\nPatient summary:")
print("Age:", age)
print("Weight:", weight_kg, "kg")
print("Pain severity:", pain_severity)
print("eGFR:", egfr)
print("Renal risk:", renal_risk)
print("SpO2:", spo2)
print("Suspected ACS:", suspected_acs)
print("Opioid tolerant:", opioid_tolerant)
print("Sedatives:", sedatives)
print("Morphine allergy:", morphine_allergy)
print("CYP2D6 Activity Score:", cyp2d6_activity_score)
print("Baseline CYP2D6 phenotype:", baseline_phenotype)
print("CYP2D6 inhibitor:", cyp2d6_inhibitor)
print("Inflammation:", inflammation)
print("Previous codeine/tramadol failure:", previous_codeine_failure)
print("Previous opioid toxicity:", previous_opioid_toxicity)

print("\n------------------------------------")
print("1) Functional CYP2D6 phenotype prediction")
print("------------------------------------")
print("Prediction:", functional_prediction)
print("Confidence:", round(functional_conf * 100, 2), "%")
print("Probabilities:")
print_probability_table(functional_probs)

print("\n------------------------------------")
print("2) Analgesic recommendation prediction")
print("------------------------------------")
print("Prediction:", analgesic_prediction)
print("Confidence:", round(analgesic_conf * 100, 2), "%")
print("Probabilities:")
print_probability_table(analgesic_probs)

print("\n------------------------------------")
print("3) Safety risk prediction")
print("------------------------------------")
print("Prediction:", safety_prediction)
print("Confidence:", round(safety_conf * 100, 2), "%")
print("Probabilities:")
print_probability_table(safety_probs)

print("\n------------------------------------")
print("Clinical explanation")
print("------------------------------------")

explanations = build_explanation(
    patient,
    functional_prediction,
    analgesic_prediction,
    safety_prediction
)

for item in explanations:
    print("-", item)

print("\n------------------------------------")
print("Important note")
print("------------------------------------")
print("This is a proof-of-concept AI model trained on clinically informed synthetic data.")
print("It is not for real clinical use without validation.")
