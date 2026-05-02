import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, VotingClassifier


# =========================
# 1. Load synthetic dataset
# =========================

df = pd.read_csv("scdaid_synthetic_dataset.csv")


# =========================
# 2. Features and targets
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


# =========================
# 3. Preprocessor
# =========================

preprocessor = ColumnTransformer(
    transformers=[
        ("num", StandardScaler(), numeric_features),
        ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features)
    ]
)


# =========================
# 4. Function to build ensemble model
# =========================

def build_model():
    logistic_model = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier", LogisticRegression(
            max_iter=3000,
            solver="lbfgs",
            class_weight="balanced"
        ))
    ])

    random_forest_model = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier", RandomForestClassifier(
            n_estimators=300,
            max_depth=8,
            random_state=42,
            class_weight="balanced"
        ))
    ])

    ensemble_model = VotingClassifier(
        estimators=[
            ("logistic", logistic_model),
            ("random_forest", random_forest_model)
        ],
        voting="soft"
    )

    return ensemble_model


# =========================
# 5. Train 3 models
# =========================

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


print("\nAll 3 SCDAid AI models trained and saved successfully.")