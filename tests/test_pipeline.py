"""End-to-end pipeline tests including edge cases."""
import logging
import sys
from pathlib import Path

import pandas as pd

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.agents.orchestrator import Pipeline
from src.models.schemas import ComplaintInput, PipelineOutput

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

DATA_PATH = Path(__file__).parent.parent / "data" / "processed" / "dev_set_10k.csv"
MAX_NARRATIVE_LENGTH = 3000


def load_df() -> pd.DataFrame:
    return pd.read_csv(DATA_PATH)


def row_to_complaint(row: pd.Series) -> ComplaintInput:
    """Convert a DataFrame row to a ComplaintInput, truncating long narratives."""
    narrative = str(row["Consumer complaint narrative"])
    if len(narrative) > MAX_NARRATIVE_LENGTH:
        narrative = narrative[:MAX_NARRATIVE_LENGTH]
    return ComplaintInput(
        complaint_id=str(row["Complaint ID"]),
        date_received=str(row["Date received"]),
        product=str(row["Product"]) if pd.notna(row["Product"]) else None,
        sub_product=str(row["Sub-product"]) if pd.notna(row["Sub-product"]) else None,
        issue=str(row["Issue"]) if pd.notna(row["Issue"]) else None,
        sub_issue=str(row["Sub-issue"]) if pd.notna(row["Sub-issue"]) else None,
        narrative=narrative,
        company=str(row["Company"]) if pd.notna(row["Company"]) else None,
        state=str(row["State"]) if pd.notna(row["State"]) else None,
        zip_code=str(row["ZIP code"]) if pd.notna(row["ZIP code"]) else None,
    )


def assert_valid_output(output: PipelineOutput, test_name: str) -> list[str]:
    """Assert output validity. Returns list of failure messages."""
    failures = []

    def check(condition: bool, msg: str):
        if not condition:
            failures.append(f"[{test_name}] {msg}")

    # Pydantic validation passes if we got here (construction would have raised)
    check(output.complaint is not None, "complaint is None")
    check(output.classification is not None, "classification is None")
    check(output.causal_analysis is not None, "causal_analysis is None")
    check(output.routing is not None, "routing is None")
    check(output.resolution is not None, "resolution is None")
    check(output.quality_check is not None, "quality_check is None")

    if output.classification:
        check(
            output.classification.severity in ("low", "medium", "high", "critical"),
            f"invalid severity: {output.classification.severity}",
        )
        check(
            0.0 <= output.classification.compliance_risk_score <= 1.0,
            f"compliance_risk_score out of range: {output.classification.compliance_risk_score}",
        )

    if output.resolution:
        check(
            len(output.resolution.remediation_steps) >= 1,
            "no remediation steps",
        )
        check(
            len(output.resolution.customer_response_letter) >= 100,
            f"customer_response_letter too short: {len(output.resolution.customer_response_letter)} chars",
        )

    if output.quality_check:
        check(
            output.quality_check.quality_flag in ("pass", "review", "fail"),
            f"invalid quality_flag: {output.quality_check.quality_flag}",
        )

    return failures


def print_output(output: PipelineOutput, label: str):
    """Print a formatted summary of pipeline output."""
    c = output.classification
    ca = output.causal_analysis
    r = output.routing
    res = output.resolution
    qc = output.quality_check

    print(f"\n{'='*60}")
    print(f"TEST: {label}")
    print(f"Complaint ID: {output.complaint.complaint_id}")
    print(f"Narrative (first 200 chars): {output.complaint.narrative[:200]}...")
    print(f"\n--- CLASSIFICATION ---")
    print(f"  Product: {c.predicted_product}")
    print(f"  Issue: {c.predicted_issue}")
    print(f"  Severity: {c.severity}")
    print(f"  Compliance Risk: {c.compliance_risk_score:.2f}")
    print(f"  Confidence: {c.confidence:.2f}")
    print(f"\n--- CAUSAL ANALYSIS ---")
    print(f"  Root Cause: {ca.root_cause}")
    print(f"  Causal Depth: {ca.causal_depth}")
    print(f"  Counterfactual: {ca.counterfactual_intervention}")
    print(f"  Confidence: {ca.confidence:.2f}")
    print(f"\n--- ROUTING ---")
    print(f"  Team: {r.assigned_team}")
    print(f"  Priority: {r.priority_level}")
    print(f"  Escalation: {r.escalation_flag}")
    print(f"\n--- RESOLUTION ---")
    print(f"  Steps: {len(res.remediation_steps)} steps")
    print(f"  Regulations: {res.applicable_regulations}")
    print(f"  Timeline: {res.estimated_resolution_days} days")
    print(f"  Letter (first 200 chars): {res.customer_response_letter[:200]}...")
    print(f"\n--- QUALITY CHECK ---")
    print(f"  Overall Confidence: {qc.overall_confidence:.2f}")
    print(f"  Quality Flag: {qc.quality_flag}")
    print(f"  Consistency Issues: {qc.consistency_issues}")
    print(f"{'='*60}\n")


def run_tests():
    df = load_df()
    pipeline = Pipeline()
    all_failures: list[str] = []
    tests_passed = 0
    tests_total = 0

    def run_test(label: str, complaint: ComplaintInput, expected_product: str = None):
        nonlocal tests_passed, tests_total
        tests_total += 1
        logger.info(f"Running test: {label}")
        try:
            output = pipeline.run(complaint)
            failures = assert_valid_output(output, label)
            if expected_product:
                actual = output.classification.predicted_product
                if actual != expected_product:
                    logger.warning(
                        f"[{label}] Product mismatch: expected '{expected_product}', got '{actual}'"
                    )
            print_output(output, label)
            if failures:
                all_failures.extend(failures)
                for f in failures:
                    print(f"  FAIL: {f}")
            else:
                tests_passed += 1
                print(f"  PASS: {label}")
        except Exception as exc:
            all_failures.append(f"[{label}] Exception: {exc}")
            print(f"  FAIL: {label} — {exc}")
            import traceback
            traceback.print_exc()

    # ── Test 1: Credit reporting complaint ────────────────────────────────
    row = df[df["Product"] == "Credit reporting or other personal consumer reports"].iloc[0]
    run_test(
        "Credit Reporting",
        row_to_complaint(row),
        expected_product="Credit reporting or other personal consumer reports",
    )

    # ── Test 2: Credit card complaint ─────────────────────────────────────
    row = df[df["Product"] == "Credit card"].iloc[0]
    run_test("Credit Card", row_to_complaint(row), expected_product="Credit card")

    # ── Test 3: Debt collection complaint ─────────────────────────────────
    row = df[df["Product"] == "Debt collection"].iloc[0]
    run_test("Debt Collection", row_to_complaint(row), expected_product="Debt collection")

    # ── Test 4: Checking or savings account ───────────────────────────────
    row = df[df["Product"] == "Checking or savings account"].iloc[0]
    run_test(
        "Checking/Savings",
        row_to_complaint(row),
        expected_product="Checking or savings account",
    )

    # ── Test 5: Mortgage complaint ────────────────────────────────────────
    row = df[df["Product"] == "Mortgage"].iloc[0]
    run_test("Mortgage", row_to_complaint(row), expected_product="Mortgage")

    # ── Test 6: Very short narrative (edge case) ──────────────────────────
    short_narrative = "HARD INQUIRY WAS NOT COMMITTED BY FRAUD XXXX XXXX XXXX XXXX"
    short_rows = df[df["Consumer complaint narrative"].str.len() < 100]
    if not short_rows.empty:
        row = short_rows.iloc[0]
        complaint = row_to_complaint(row)
    else:
        complaint = ComplaintInput(
            complaint_id="test_short_001",
            date_received="2024-01-01",
            narrative=short_narrative,
            product="Credit reporting or other personal consumer reports",
        )
    run_test("Short Narrative (Edge Case)", complaint)

    # ── Test 7: Very long narrative (edge case) ───────────────────────────
    long_rows = df[df["Consumer complaint narrative"].str.len() > 5000]
    if not long_rows.empty:
        row = long_rows.iloc[0]
        complaint = row_to_complaint(row)  # truncated to 3000 chars in row_to_complaint
        run_test("Long Narrative (Edge Case)", complaint)

    # ── Test 8: Narrative with special characters ─────────────────────────
    special_rows = df[df["Consumer complaint narrative"].str.contains(r"\{|\$|XXXX", regex=True, na=False)]
    if not special_rows.empty:
        row = special_rows.iloc[0]
        run_test("Special Characters (Edge Case)", row_to_complaint(row))

    # ── Summary ──────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"RESULTS: {tests_passed}/{tests_total} tests passed")
    if all_failures:
        print(f"\nFAILURES:")
        for f in all_failures:
            print(f"  - {f}")
    else:
        print("All assertions passed!")
    print(f"{'='*60}\n")

    return tests_passed, tests_total


if __name__ == "__main__":
    passed, total = run_tests()
    sys.exit(0 if passed == total else 1)
