"""
SCDAid decision helpers: merge CPIC-based CYP2D6 translation with ML outputs.

Medication guardrails remain in app.py; this module bridges genotype translation
to the functional phenotype labels consumed by those rules.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple


def merge_functional_with_cyp2d6(
    ml_prediction: str,
    ml_confidence: float,
    ml_probabilities: Dict[str, float],
    cyp_bundle: Optional[Dict[str, Any]],
) -> Tuple[str, float, Dict[str, float]]:
    """
    When genotype translation succeeds, use clinical phenotype (after
    phenoconversion) as the functional label for guardrails and messaging.

    ML probabilities are replaced with a deterministic distribution because
    the phenotype is now driven by the CPIC-based translation engine, not
    the functional classifier.
    """
    if not cyp_bundle or not cyp_bundle.get("ok"):
        return ml_prediction, ml_confidence, ml_probabilities

    label = cyp_bundle.get("clinical_phenotype_after_phenoconversion")
    if label is None:
        label = cyp_bundle.get("clinical_phenotype")
    if not label:
        return ml_prediction, ml_confidence, ml_probabilities

    # Align with sklearn functional model labels (NM not EM).
    if label == "EM":
        label = "NM"

    label = str(label)
    return label, 1.0, {label: 1.0}


def enrich_explanation_with_cyp2d6(
    explanation: List[str],
    cyp_bundle: Optional[Dict[str, Any]],
) -> List[str]:
    if not cyp_bundle:
        return explanation

    out = list(explanation)

    if cyp_bundle.get("cyp2d6_input_source") == "alleles" and not cyp_bundle.get("ok"):
        dip = cyp_bundle.get("internally_constructed_diplotype") or cyp_bundle.get("diplotype")
        if dip:
            line = (
                f"Alleles produced diplotype {dip}, but CPIC-based activity scoring could not be completed; "
                "manual phenotype is used for modeling."
            )
            if line not in out:
                out.append(line)
        for w in cyp_bundle.get("warnings") or []:
            tagged = f"Translation warning: {w}"
            if tagged not in out:
                out.append(tagged)
        return out

    if not cyp_bundle.get("ok"):
        out = list(explanation)
        if cyp_bundle.get("cyp2d6_input_source") == "manual phenotype":
            for note in cyp_bundle.get("recommendation_notes") or []:
                if note not in out:
                    out.append(note)
            for w in cyp_bundle.get("warnings") or []:
                tagged = f"Translation warning: {w}"
                if tagged not in out:
                    out.append(tagged)
        return out

    dip = cyp_bundle.get("internally_constructed_diplotype") or cyp_bundle.get("diplotype")
    if dip:
        cas = cyp_bundle.get("calculated_activity_score", cyp_bundle.get("activity_score"))
        gph = cyp_bundle.get("calculated_genetic_phenotype", cyp_bundle.get("genetic_phenotype"))
        cph = cyp_bundle.get("clinical_phenotype_after_phenoconversion", cyp_bundle.get("clinical_phenotype"))
        ccs = cyp_bundle.get("clinical_activity_score")
        line = (
            f"CPIC-based genotype-to-phenotype translation: diplotype {dip}, "
            f"activity score {cas} → genetic phenotype {gph}; "
            f"after phenoconversion, clinical phenotype {cph} "
            f"(clinical activity score {ccs})."
        )
        if line not in out:
            out.append(line)

    for note in cyp_bundle.get("recommendation_notes") or []:
        if note not in out:
            out.append(note)

    for w in cyp_bundle.get("warnings") or []:
        tagged = f"Translation warning: {w}"
        if tagged not in out:
            out.append(tagged)

    mm = cyp_bundle.get("mismatch_warning") or cyp_bundle.get("phenotype_mismatch_warning")
    if mm and mm not in out:
        out.append(mm)

    return out
