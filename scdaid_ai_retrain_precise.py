import numpy as np
import pandas as pd
import joblib
import warnings

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, VotingClassifier


warnings.filterwarnings("ignore")

np.random.seed(42)

N = 6000


# =========================
# 1. Clinical helper rules
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


def functional_phenotype(
    baseline,
    inhibitor,
    inflammation,
    previous_codeine_failure,
    previous_opioid_toxicity
):
    """
    Functional phenotype = real-time phenotype after clinical modifiers.
    CYP2D6 genotype gives baseline phenotype.
    Inhibitors, inflammation, and previous response may shift phenotype.
    """

    # Strong inhibitor can cause phenoconversion toward PM
    if inhibitor == "strong":
        if baseline in ["NM", "IM"]:
            return "PM"
        if baseline == "UM":
            return "IM"
        return "PM"

    # Moderate inhibitor causes partial reduction
    if inhibitor == "moderate":
        if baseline == "NM":
            return "IM"
        if baseline == "IM":
            return "PM"
        if baseline == "UM":
            return "NM"
        return baseline

    # High inflammation may reduce metabolic activity
    if inflammation == "high":
        if baseline == "NM":
            return "IM"
        if baseline == "IM":
            return "PM"

    # Previous ineffective codeine/tramadol suggests reduced CYP2D6 activation
    if previous_codeine_failure == "yes":
        if baseline == "NM":
            return "IM"
        if baseline == "IM":
            return "PM"

    # Previous opioid toxicity does not always mean CYP2D6 issue,
    # but in this prototype, it adds caution only, not automatic phenotype shift.
    return baseline


def safety_risk_level(
    egfr,
    spo2,
    suspected_acs,
    sedatives,
    previous_opioid_toxicity,
    inflammation
):
    score = 0

    # Renal safety
    if egfr < 30:
        score += 3
    elif egfr < 60:
        score += 2

    # Respiratory safety
    if spo2 < 92:
        score += 3
    elif spo2 < 95:
        score += 2

    if suspected_acs == "yes":
        score += 3

    if sedatives == "yes":
        score += 2

    if previous_opioid_toxicity == "yes":
        score += 2

    if inflammation == "high":
        score += 1

    if score >= 6:
        return "high"
    elif score >= 3:
        return "moderate"
    else:
        return "low"


def analgesic_recommendation(
    egfr,
    morphine_allergy,
    functional_pheno,
    spo2,
    suspected_acs,
    sedatives,
    previous_opioid_toxicity
):
    """
    More precise label logic:
    - eGFR mainly determines renal-safe opioid choice.
    - Morphine allergy changes opioid selection.
    - Respiratory risk/ACS/sedatives increase monitoring needs.
    - CYP2D6 PM/UM mainly triggers avoid codeine/tramadol, not automatic hydromorphone.
    """

    respiratory_concern = (
        spo2 < 95 or
        suspected_acs == "yes" or
        sedatives == "yes" or
        previous_opioid_toxicity == "yes"
    )

    avoid_cyp2d6_opioids = functional_pheno in ["PM", "UM"]

    # 1. Severe renal impairment: fentanyl is preferred
    if egfr < 30:
        if avoid_cyp2d6_opioids:
            return "fentanyl_preferred_avoid_codeine_tramadol"
        return "fentanyl_preferred"

    # 2. Morphine allergy: avoid morphine
    if morphine_allergy == "yes":
        if respiratory_concern:
            return "hydromorphone_preferred_with_close_monitoring"
        return "hydromorphone_preferred"

    # 3. Moderate renal impairment: hydromorphone preferred
    if 30 <= egfr < 60:
        if respiratory_concern:
            return "hydromorphone_preferred_with_close_monitoring"
        if avoid_cyp2d6_opioids:
            return "hydromorphone_preferred_avoid_codeine_tramadol"
        return "hydromorphone_preferred"

    # 4. Low renal risk + respiratory concern: either morphine or hydromorphone, but monitor
    if respiratory_concern:
        if avoid_cyp2d6_opioids:
            return "morphine_or_hydromorphone_with_close_monitoring_avoid_codeine_tramadol"
        return "morphine_or_hydromorphone_with_close_monitoring"

    # 5. Low renal risk + CYP2D6 PM/UM: morphine may be considered, avoid codeine/tramadol
    if avoid_cyp2d6_opioids:
        return "morphine_considered_avoid_codeine_tramadol"

    # 6. Standard low-risk case
    return "morphine_considered"


# =========================
# 2. Generate synthetic data
# =========================

data = []

activity_scores = [0, 0.5, 1, 1.5, 2, 2.5, 3]
activity_probs = [0.04, 0.08, 0.18, 0.26, 0.30, 0.08, 0.06]

for _ in range(N):
    age = np.random.randint(12, 70)

    weight_kg = round(np.random.normal(60, 15), 1)
    weight_kg = max(30, min(weight_kg, 120))

    pain_severity = np.random.choice(
        ["mild", "moderate", "severe"],
        p=[0.18, 0.37, 0.45]
    )

    # Make renal distribution more realistic and varied
    renal_group = np.random.choice(
        ["normal", "moderate", "severe"],
        p=[0.65, 0.25, 0.10]
    )

    if renal_group == "normal":
        egfr = round(np.random.normal(85, 18), 1)
    elif renal_group == "moderate":
        egfr = round(np.random.normal(45, 8), 1)
    else:
        egfr = round(np.random.normal(22, 6), 1)

    egfr = max(5, min(egfr, 130))
    renal_risk = renal_risk_from_egfr(egfr)

    suspected_acs = np.random.choice(["yes", "no"], p=[0.18, 0.82])
    sedatives = np.random.choice(["yes", "no"], p=[0.15, 0.85])
    previous_opioid_toxicity = np.random.choice(["yes", "no"], p=[0.12, 0.88])

    # SpO2 affected by ACS/respiratory risk
    if suspected_acs == "yes":
        spo2 = round(np.random.normal(93, 3), 1)
    else:
        spo2 = round(np.random.normal(97, 2), 1)

    spo2 = max(82, min(spo2, 100))

    opioid_tolerant = np.random.choice(["yes", "no"], p=[0.35, 0.65])
    morphine_allergy = np.random.choice(["yes", "no"], p=[0.08, 0.92])

    cyp2d6_activity_score = np.random.choice(activity_scores, p=activity_probs)
    baseline_phenotype = phenotype_from_as(cyp2d6_activity_score)

    cyp2d6_inhibitor = np.random.choice(
        ["none", "moderate", "strong"],
        p=[0.72, 0.18, 0.10]
    )

    inflammation = np.random.choice(
        ["none", "mild", "high"],
        p=[0.45, 0.35, 0.20]
    )

    previous_codeine_failure = np.random.choice(["yes", "no"], p=[0.20, 0.80])

    func_pheno = functional_phenotype(
        baseline_phenotype,
        cyp2d6_inhibitor,
        inflammation,
        previous_codeine_failure,
        previous_opioid_toxicity
    )

    recommendation = analgesic_recommendation(
        egfr,
        morphine_allergy,
        func_pheno,
        spo2,
        suspected_acs,
        sedatives,
        previous_opioid_toxicity
    )

    risk = safety_risk_level(
        egfr,
        spo2,
        suspected_acs,
        sedatives,
        previous_opioid_toxicity,
        inflammation
    )

    data.append({
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
        "functional_phenotype": func_pheno,
        "analgesic_recommendation": recommendation,
        "safety_risk": risk
    })


df = pd.DataFrame(data)
df.to_csv("scdaid_synthetic_dataset_precise.csv", index=False)

print("\nDataset saved as: scdaid_synthetic_dataset_precise.csv")
print("\nAnalgesic label distribution:")
print(df["analgesic_recommendation"].value_counts())
print("\nSafety label distribution:")
print(df["safety_risk"].value_counts())
print("\nFunctional phenotype distribution:")
print(df["functional_phenotype"].value_counts())


# =========================
# 3. Train 3 models
# =========================

target_columns = [
    "functional_phenotype",
    "analgesic_recommendation",
    "safety_risk"
]

X = df.drop(columns=target_columns)

numeric_features = [
    "age",
    "weight_kg",
    "egfr",
    "spo2",
    "cyp2d6_activity_score"
]

categorical_features = [
    "pain_severity",
    "renal_risk",
    "suspected_acs",
    "opioid_tolerant",
    "sedatives",
    "morphine_allergy",
    "baseline_phenotype",
    "cyp2d6_inhibitor",
    "inflammation",
    "previous_codeine_failure",
    "previous_opioid_toxicity"
]

preprocessor = ColumnTransformer(
    transformers=[
        ("num", StandardScaler(), numeric_features),
        ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features)
    ]
)


def build_model():
    logistic_model = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier", LogisticRegression(
            max_iter=3000,
            solver="liblinear",
            class_weight="balanced"
        ))
    ])

    random_forest_model = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier", RandomForestClassifier(
            n_estimators=500,
            max_depth=12,
            min_samples_leaf=3,
            random_state=42,
            class_weight="balanced"
        ))
    ])

    ensemble_model = VotingClassifier(
        estimators=[
            ("logistic", logistic_model),
            ("random_forest", random_forest_model)
        ],
        voting="soft",
        weights=[1, 2]
    )

    return ensemble_model


model_files = {
    "functional_phenotype": "functional_phenotype_model.pkl",
    "analgesic_recommendation": "analgesic_recommendation_model.pkl",
    "safety_risk": "safety_risk_model.pkl"
}


for target in target_columns:
    print("\n====================================")
    print("Training model for:", target)
    print("====================================")

    y = df[target]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y
    )

    model = build_model()
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)

    print("\nAccuracy:", round(accuracy_score(y_test, y_pred), 4))
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

    joblib.dump(model, model_files[target])
    print("\nSaved model as:", model_files[target])


print("\nAll precise SCDAid AI models trained and saved successfully.")
print("Now restart Flask app.py and refresh the website.")
