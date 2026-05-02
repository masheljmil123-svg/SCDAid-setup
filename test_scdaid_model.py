import pandas as pd
import joblib


# =========================
# 1. Load trained AI model
# =========================

model = joblib.load("scdaid_ai_model.pkl")


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


def explain_recommendation(prediction, patient):
    egfr = patient["egfr"]
    renal_risk = patient["renal_risk"]
    inhibitor = patient["cyp2d6_inhibitor"]
    baseline = patient["baseline_phenotype"]
    acs = patient["suspected_acs"]
    spo2 = patient["spo2"]
    sedatives = patient["sedatives"]
    morphine_allergy = patient["morphine_allergy"]

    explanation = []

    if renal_risk == "high":
        explanation.append("High renal risk detected because eGFR is below 30.")
    elif renal_risk == "moderate":
        explanation.append("Moderate renal risk detected because eGFR is between 30 and 59.")
    else:
        explanation.append("Low renal risk detected because eGFR is 60 or above.")

    if morphine_allergy == "yes":
        explanation.append("Morphine allergy is reported, so morphine should be avoided.")

    if inhibitor == "strong":
        explanation.append("Strong CYP2D6 inhibitor detected, which may reduce CYP2D6 functional activity.")
    elif inhibitor == "moderate":
        explanation.append("Moderate CYP2D6 inhibitor detected, which may partially reduce CYP2D6 activity.")

    if baseline in ["PM", "UM"]:
        explanation.append("CYP2D6 phenotype suggests avoiding codeine and tramadol due to poor efficacy or toxicity risk.")

    if acs == "yes":
        explanation.append("Suspected acute chest syndrome requires careful respiratory monitoring.")

    if spo2 < 95:
        explanation.append("SpO2 is below 95%, which increases respiratory safety concern.")

    if sedatives == "yes":
        explanation.append("Sedative exposure increases the risk of opioid-related respiratory depression.")

    if prediction == "fentanyl_preferred":
        explanation.append("Fentanyl is preferred due to high renal risk or safety considerations.")
    elif prediction == "hydromorphone_preferred":
        explanation.append("Hydromorphone is preferred due to renal risk, allergy, or safety factors.")
    elif prediction == "morphine_considered":
        explanation.append("Morphine may be considered because no major renal or allergy contraindication was detected.")
    elif prediction == "morphine_or_hydromorphone_preferred_avoid_codeine_tramadol":
        explanation.append("Morphine or hydromorphone may be preferred while avoiding codeine and tramadol.")

    return explanation


# =========================
# 3. Enter patient data here
# =========================

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
# 6. Make prediction
# =========================

prediction = model.predict(patient_df)[0]
probabilities = model.predict_proba(patient_df)[0]
classes = model.classes_

confidence = max(probabilities)


# =========================
# 7. Print results
# =========================

print("\n==============================")
print("SCDAid AI Prediction")
print("==============================")

print("\nPatient summary:")
print("Age:", age)
print("Weight:", weight_kg, "kg")
print("Pain severity:", pain_severity)
print("eGFR:", egfr)
print("Renal risk:", renal_risk)
print("SpO2:", spo2)
print("Suspected ACS:", suspected_acs)
print("CYP2D6 Activity Score:", cyp2d6_activity_score)
print("Baseline CYP2D6 phenotype:", baseline_phenotype)
print("CYP2D6 inhibitor:", cyp2d6_inhibitor)

print("\nPredicted analgesic recommendation:")
print(prediction)

print("\nConfidence:")
print(round(confidence * 100, 2), "%")

print("\nPrediction probabilities:")
for cls, prob in zip(classes, probabilities):
    print(cls, ":", round(prob, 3))

print("\nClinical explanation:")
explanations = explain_recommendation(prediction, patient)

for item in explanations:
    print("-", item)

print("\nImportant note:")
print("This is a proof-of-concept AI model trained on clinically informed synthetic data. It is not for real clinical use without validation.")