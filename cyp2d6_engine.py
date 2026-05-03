"""
CPIC-based CYP2D6 genotype-to-phenotype translation engine.

Translates star-allele diplotypes into activity scores and phenotypes using
internally stored allele function values aligned with CPIC-style activity scoring.
This is deterministic rule-based translation, not symptom-based AI inference.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

# Activity values per gene copy (CPIC-style numeric activity score contribution).
# None = indeterminate / cannot score deterministically from this table alone.
ALLELE_FUNCTION: Dict[str, Optional[float]] = {
    "*1": 1.0,
    "*2": 1.0,
    "*35": 1.0,
    "*9": 0.5,
    "*17": 0.5,
    "*29": 0.5,
    "*41": 0.5,
    "*10": 0.25,
    "*36": 0.25,
    "*3": 0.0,
    "*4": 0.0,
    "*5": 0.0,
    "*6": 0.0,
    "*7": 0.0,
    "*8": 0.0,
    "*11": 0.0,
    "*12": 0.0,
    "*14": 0.0,
    "*15": 0.0,
    "*19": 0.0,
    "*20": 0.0,
    "*40": 0.0,
    "*42": 0.0,
    "*22": None,
    "*25": None,
    "*31": None,
    "*44": None,
}


def normalize_star_allele(token: str) -> str:
    if not token:
        return ""
    x = str(token).strip().upper().replace(" ", "")
    if not x:
        return ""
    if not x.startswith("*"):
        x = "*" + x
    return x


def parse_allele_with_copies(raw: str) -> Tuple[str, int, str]:
    """
    Parse e.g. *1, *1X2, *1xN -> (base allele like *1, integer copies, display string).
    xN is treated as copy number 2 when unspecified (conservative default).
    """
    a = normalize_star_allele(raw)
    if not a:
        return "", 1, ""

    m = re.match(r"^(\*\w+)[xX](\d+|N)$", a)
    if m:
        base = m.group(1).upper()
        tok = m.group(2).upper()
        if tok == "N":
            copies = 2
        else:
            copies = int(tok)
        copies = max(1, min(copies, 10))
        display = f"{base}x{copies}" if copies != 1 else base
        return base, copies, display

    return a, 1, a


def split_diplotype_string(s: str) -> Optional[Tuple[str, str]]:
    if not s or not str(s).strip():
        return None
    t = str(s).strip().replace(" ", "")
    parts = re.split(r"[/|]+", t)
    if len(parts) != 2:
        return None
    return parts[0].strip(), parts[1].strip()


def activity_score_to_phenotype(score: float) -> str:
    """CPIC consensus-style thresholds used across SCDAid (PM / IM / NM / UM)."""
    if score <= 0:
        return "PM"
    if 0 < score < 1.25:
        return "IM"
    if 1.25 <= score <= 2.25:
        return "NM"
    return "UM"


def apply_inhibitor_phenoconversion(
    genetic_score: float, inhibitor: str
) -> Tuple[float, Dict[str, Any]]:
    inh = (inhibitor or "none").strip().lower()
    before = float(genetic_score)

    if inh == "strong":
        after = 0.0
        return after, {
            "level": "strong",
            "activity_score_before": before,
            "activity_score_after": after,
            "rule_applied": (
                "Strong CYP2D6 inhibitor: clinical activity score set to 0 "
                "(poor-metabolizer–like functional effect for safety planning)."
            ),
        }

    if inh == "moderate":
        after = max(0.0, before - 0.5)
        return after, {
            "level": "moderate",
            "activity_score_before": before,
            "activity_score_after": after,
            "rule_applied": (
                "Moderate CYP2D6 inhibitor: activity score reduced by 0.5 "
                "(cautious partial phenoconversion)."
            ),
        }

    if inh == "weak":
        after = max(0.0, before - 0.25)
        return after, {
            "level": "weak",
            "activity_score_before": before,
            "activity_score_after": after,
            "rule_applied": (
                "Weak / possible CYP2D6 inhibitor: activity score reduced by 0.25."
            ),
        }

    return before, {
        "level": "none",
        "activity_score_before": before,
        "activity_score_after": before,
        "rule_applied": "No CYP2D6 inhibitor effect modeled.",
    }


def normalize_phenotype_token(raw: Optional[str]) -> Optional[str]:
    """Map UI labels to engine tokens (EM ≡ NM for comparison)."""
    if raw is None or str(raw).strip() == "":
        return None
    u = str(raw).strip().upper()
    if u == "EM":
        return "NM"
    if u in ("PM", "IM", "NM", "UM"):
        return u
    return u


def translate_cyp2d6_from_alleles(
    allele1: Optional[str],
    allele2: Optional[str],
    diplotype_str: Optional[str],
    inhibitor_level: str,
    selected_manual_phenotype: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build internally_constructed_diplotype from allele1 + allele2 (preferred).

    Optional diplotype_str is only used when both allele strings are empty
    (e.g. legacy API), not as a separate UI field.
    """
    warnings: List[str] = []
    notes: List[str] = [
        "CYP2D6 interpretation uses the CPIC-based genotype-to-phenotype "
        "translation engine (rule-based; not symptom-based AI)."
    ]

    selected_norm = normalize_phenotype_token(selected_manual_phenotype)

    a1_in = (allele1 or "").strip()
    a2_in = (allele2 or "").strip()

    a_raw: Optional[str] = None
    b_raw: Optional[str] = None

    if a1_in and a2_in:
        a_raw, b_raw = a1_in, a2_in
        notes.append("Diplotype constructed internally from CYP2D6 allele 1 and allele 2.")
    else:
        dip = split_diplotype_string(diplotype_str) if diplotype_str else None
        if dip:
            a_raw, b_raw = dip
            notes.append("Diplotype parsed from combined string (API/legacy).")

    p1 = parse_allele_with_copies(a_raw or "")
    p2 = parse_allele_with_copies(b_raw or "")

    if not p1[0] or not p2[0]:
        warnings.append("Both CYP2D6 allele 1 and allele 2 are required for genotype translation.")
        return {
            "ok": False,
            "cyp2d6_input_source": "manual phenotype",
            "allele1": a1_in or None,
            "allele2": a2_in or None,
            "internally_constructed_diplotype": None,
            "parsed_alleles": [],
            "allele_functions": {},
            "activity_score": None,
            "calculated_activity_score": None,
            "genetic_phenotype": None,
            "calculated_genetic_phenotype": None,
            "selected_manual_phenotype": selected_manual_phenotype,
            "selected_phenotype": selected_manual_phenotype,
            "inhibitor_adjustment": None,
            "clinical_activity_score": None,
            "clinical_phenotype": None,
            "clinical_phenotype_after_phenoconversion": None,
            "mismatch_warning": None,
            "phenotype_mismatch_warning": None,
            "diplotype": None,
            "warnings": warnings,
            "recommendation_notes": notes
            + [
                "No complete allele pair: using manual CYP2D6 phenotype and activity score from the request for models."
            ],
        }

    f1 = ALLELE_FUNCTION.get(p1[0])
    f2 = ALLELE_FUNCTION.get(p2[0])

    if f1 is None or f2 is None:
        warnings.append(
            "One or both alleles have indeterminate function in the built-in table "
            "(*22, *25, *31, *44, etc.). Confirm with validated laboratory reporting."
        )
        dip_partial = f"{p1[2]}/{p2[2]}"
        return {
            "ok": False,
            "cyp2d6_input_source": "alleles",
            "allele1": a1_in or p1[2],
            "allele2": a2_in or p2[2],
            "internally_constructed_diplotype": dip_partial,
            "parsed_alleles": [
                {
                    "allele": p1[0],
                    "copies": p1[1],
                    "display": p1[2],
                    "function": f1,
                },
                {
                    "allele": p2[0],
                    "copies": p2[1],
                    "display": p2[2],
                    "function": f2,
                },
            ],
            "allele_functions": {p1[0]: f1, p2[0]: f2},
            "activity_score": None,
            "calculated_activity_score": None,
            "genetic_phenotype": None,
            "calculated_genetic_phenotype": None,
            "selected_manual_phenotype": selected_manual_phenotype,
            "selected_phenotype": selected_manual_phenotype,
            "inhibitor_adjustment": None,
            "clinical_activity_score": None,
            "clinical_phenotype": None,
            "clinical_phenotype_after_phenoconversion": None,
            "mismatch_warning": None,
            "phenotype_mismatch_warning": None,
            "diplotype": dip_partial,
            "warnings": warnings,
            "recommendation_notes": notes
            + ["Indeterminate allele function: cannot compute a numeric activity score."],
        }

    genetic_score = float(f1) * p1[1] + float(f2) * p2[1]
    genetic_ph = activity_score_to_phenotype(genetic_score)

    clinical_score, inh_adj = apply_inhibitor_phenoconversion(
        genetic_score, inhibitor_level
    )
    clinical_ph = activity_score_to_phenotype(clinical_score)

    diplotype = f"{p1[2]}/{p2[2]}"
    parsed = [
        {
            "allele": p1[0],
            "copies": p1[1],
            "display": p1[2],
            "function": f1,
        },
        {
            "allele": p2[0],
            "copies": p2[1],
            "display": p2[2],
            "function": f2,
        },
    ]

    if inh_adj["level"] == "strong":
        notes.append(
            "Phenoconversion: strong inhibitor modeled as poor-metabolizer–like "
            "for CYP2D6-dependent substrate planning."
        )
    elif inh_adj["level"] == "moderate":
        notes.append(
            "Phenoconversion: moderate inhibitor modeled with cautious reduction "
            "of activity score."
        )
    elif inh_adj["level"] == "weak":
        notes.append(
            "Phenoconversion: weak inhibitor modeled with small reduction in activity score."
        )

    if clinical_ph != genetic_ph:
        notes.append(
            f"Clinical phenotype after phenoconversion ({clinical_ph}) differs from "
            f"genetic phenotype ({genetic_ph})."
        )

    mismatch: Optional[str] = None
    genetic_norm = normalize_phenotype_token(genetic_ph)
    if selected_norm and genetic_norm and selected_norm != genetic_norm:
        mismatch = (
            f"Manual phenotype ({selected_manual_phenotype}) does not match "
            f"calculated genetic phenotype ({genetic_ph}) from alleles. "
            "Decision support uses the clinical phenotype after phenoconversion."
        )
        warnings.append(mismatch)

    dip_out = diplotype
    allele_functions = {p1[0]: f1, p2[0]: f2}
    cas = round(genetic_score, 4)
    ccs = round(clinical_score, 4)

    return {
        "ok": True,
        "cyp2d6_input_source": "alleles",
        "allele1": a1_in or p1[2],
        "allele2": a2_in or p2[2],
        "internally_constructed_diplotype": dip_out,
        "parsed_alleles": parsed,
        "allele_functions": allele_functions,
        "calculated_activity_score": cas,
        "calculated_genetic_phenotype": genetic_ph,
        "selected_manual_phenotype": selected_manual_phenotype,
        "inhibitor_adjustment": inh_adj,
        "clinical_activity_score": ccs,
        "clinical_phenotype_after_phenoconversion": clinical_ph,
        "mismatch_warning": mismatch,
        "recommendation_notes": notes,
        "warnings": warnings,
        # Legacy / internal aliases
        "diplotype": dip_out,
        "activity_score": cas,
        "genetic_phenotype": genetic_ph,
        "clinical_phenotype": clinical_ph,
        "selected_phenotype": selected_manual_phenotype,
        "phenotype_mismatch_warning": mismatch,
    }
