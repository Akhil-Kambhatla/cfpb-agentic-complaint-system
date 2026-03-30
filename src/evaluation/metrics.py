"""Evaluation metrics — runs the classifier on a sample and measures accuracy."""
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, confusion_matrix

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.agents.classifier import ClassifierAgent
from src.models.schemas import ComplaintInput

logger = logging.getLogger(__name__)

DATA_PATH = Path(__file__).parent.parent.parent / "data" / "processed" / "dev_set_10k.csv"
EVAL_SAMPLE_SIZE = 50


def load_sample(n: int = EVAL_SAMPLE_SIZE, seed: int = 42) -> pd.DataFrame:
    """Load a stratified sample of complaints for evaluation."""
    df = pd.read_csv(DATA_PATH)
    df = df[df["Consumer complaint narrative"].notna()].copy()
    # Stratify by product if possible
    try:
        sampled = (
            df.groupby("Product", group_keys=False)
            .apply(
                lambda g: g.sample(min(len(g), max(1, n // df["Product"].nunique())), random_state=seed),
                include_groups=False,
            )
        )
        # Restore Product column after include_groups=False drops it
        sampled = df.loc[sampled.index]
        if len(sampled) < n:
            extra = df[~df.index.isin(sampled.index)].sample(n - len(sampled), random_state=seed)
            sampled = pd.concat([sampled, extra])
        return sampled.head(n).reset_index(drop=True)
    except Exception:
        return df.sample(n, random_state=seed).reset_index(drop=True)


def row_to_complaint(row: pd.Series) -> ComplaintInput:
    """Convert a DataFrame row to ComplaintInput."""
    return ComplaintInput(
        complaint_id=str(row["Complaint ID"]),
        date_received=str(row["Date received"]),
        product=str(row["Product"]) if pd.notna(row.get("Product")) else None,
        issue=str(row["Issue"]) if pd.notna(row.get("Issue")) else None,
        narrative=str(row["Consumer complaint narrative"])[:3000],
        company=str(row["Company"]) if pd.notna(row.get("Company")) else None,
        state=str(row["State"]) if pd.notna(row.get("State")) else None,
    )


def run_evaluation(sample_size: int = EVAL_SAMPLE_SIZE) -> dict:
    """Run classifier on a sample and return evaluation metrics."""
    logger.info(f"Loading {sample_size}-complaint evaluation sample...")
    df = load_sample(n=sample_size)
    agent = ClassifierAgent()

    true_products: list[str] = []
    pred_products: list[str] = []
    true_issues: list[str] = []
    pred_issues: list[str] = []
    confidences: list[float] = []
    risk_scores: list[float] = []

    for i, (_, row) in enumerate(df.iterrows()):
        logger.info(f"Evaluating complaint {i + 1}/{sample_size} (ID: {row['Complaint ID']})")
        complaint = row_to_complaint(row)
        try:
            result = agent.run(complaint)
            true_products.append(str(row["Product"]))
            pred_products.append(result.predicted_product)
            true_issues.append(str(row["Issue"]) if pd.notna(row.get("Issue")) else "")
            pred_issues.append(result.predicted_issue)
            confidences.append(result.confidence)
            risk_scores.append(result.compliance_risk_score)
        except Exception as exc:
            logger.error(f"Failed on complaint {row['Complaint ID']}: {exc}")

    if not true_products:
        logger.error("No results collected — evaluation failed.")
        return {}

    product_accuracy = accuracy_score(true_products, pred_products)
    issue_accuracy = accuracy_score(true_issues, pred_issues)

    # Confusion matrix for products
    all_products = sorted(set(true_products) | set(pred_products))
    cm = confusion_matrix(true_products, pred_products, labels=all_products)

    metrics = {
        "sample_size": len(true_products),
        "product_accuracy": round(product_accuracy, 4),
        "issue_accuracy": round(issue_accuracy, 4),
        "avg_confidence": round(float(np.mean(confidences)), 4),
        "avg_compliance_risk": round(float(np.mean(risk_scores)), 4),
        "product_labels": all_products,
        "confusion_matrix": cm.tolist(),
    }

    _print_report(metrics, true_products, pred_products, all_products, cm)
    return metrics


def _print_report(
    metrics: dict,
    true_products: list[str],
    pred_products: list[str],
    labels: list[str],
    cm,
):
    """Print a human-readable evaluation report."""
    print("\n" + "=" * 70)
    print("CFPB CLASSIFIER EVALUATION REPORT")
    print("=" * 70)
    print(f"Sample size:          {metrics['sample_size']}")
    print(f"Product accuracy:     {metrics['product_accuracy']:.1%}")
    print(f"Issue accuracy:       {metrics['issue_accuracy']:.1%}")
    print(f"Avg confidence:       {metrics['avg_confidence']:.2f}")
    print(f"Avg compliance risk:  {metrics['avg_compliance_risk']:.2f}")

    print("\nPer-product breakdown:")
    print(f"  {'Product':<55} {'True':>5} {'Correct':>8} {'Acc':>6}")
    print(f"  {'-'*55} {'-'*5} {'-'*8} {'-'*6}")
    for label in labels:
        indices = [i for i, t in enumerate(true_products) if t == label]
        correct = sum(1 for i in indices if pred_products[i] == label)
        total = len(indices)
        acc = correct / total if total else 0
        short = label[:53]
        print(f"  {short:<55} {total:>5} {correct:>8} {acc:>6.1%}")

    print("\nConfusion Matrix (rows=true, cols=predicted):")
    # Print abbreviated labels
    abbrevs = [lbl[:15] for lbl in labels]
    header = "  " + "  ".join(f"{a:>15}" for a in abbrevs)
    print(header)
    for i, row_label in enumerate(labels):
        row_str = f"{row_label[:15]:>15}  " + "  ".join(f"{v:>15}" for v in cm[i])
        print(row_str)

    print("=" * 70 + "\n")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    run_evaluation()
