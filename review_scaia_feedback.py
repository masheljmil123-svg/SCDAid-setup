import json
from pathlib import Path

feedback_file = Path("scaia_feedback.jsonl")
rules_file = Path("scaia_learned_rules.txt")

if not feedback_file.exists():
    print("No feedback file found yet.")
    raise SystemExit

items = []
with feedback_file.open("r", encoding="utf-8") as f:
    for line in f:
        try:
            item = json.loads(line)
            if item.get("rating") == "dislike":
                items.append(item)
        except Exception:
            pass

if not items:
    print("No dislike feedback found.")
    raise SystemExit

print("\nDislike feedback found:\n")

new_rules = []
for i, item in enumerate(items[-20:], start=1):
    print(f"\n--- Feedback #{i} ---")
    print("Question:", item.get("question", ""))
    print("Reason:", item.get("reason", ""))
    print("Suggested correction:", item.get("corrected_answer", ""))

    correction = (item.get("corrected_answer") or "").strip()
    reason = (item.get("reason") or "").strip()

    if correction:
        rule = f"- Reviewed feedback rule: {correction}"
        new_rules.append(rule)
    elif reason:
        rule = f"- Reviewed feedback note: Avoid this issue: {reason}"
        new_rules.append(rule)

if new_rules:
    with rules_file.open("a", encoding="utf-8") as f:
        f.write("\n\nAUTO-APPENDED REVIEWED FEEDBACK RULES\n")
        for rule in new_rules:
            f.write(rule + "\n")

    print(f"\nAdded {len(new_rules)} reviewed rule(s) to {rules_file}.")
else:
    print("\nNo correction text to add.")
