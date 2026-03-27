"""CFPB data loading, filtering, and sampling utilities."""
import logging
from pathlib import Path
from typing import Optional

import pandas as pd

from src.config import (
    CFPB_DATA_PATH,
    RAW_DATA_DIR,
    PROCESSED_DATA_DIR,
    SAMPLE_DATA_DIR,
    SAMPLE_SIZE,
    TEST_SIZE,
)

logger = logging.getLogger(__name__)


def load_raw_data(path: Optional[str] = None) -> pd.DataFrame:
    """Load the raw CFPB complaints CSV."""
    data_path = Path(path or CFPB_DATA_PATH)
    if not data_path.exists():
        raise FileNotFoundError(
            f"CFPB data not found at {data_path}. "
            "Download from: https://www.consumerfinance.gov/data-research/consumer-complaints/"
        )
    logger.info(f"Loading data from {data_path}...")
    df = pd.read_csv(data_path, low_memory=False)
    logger.info(f"Loaded {len(df):,} complaints")
    return df


def load_sample_data() -> pd.DataFrame:
    """Load the small committed sample (for testing without full dataset)."""
    sample_path = SAMPLE_DATA_DIR / "cfpb_sample_100.csv"
    if not sample_path.exists():
        raise FileNotFoundError(
            f"Sample data not found at {sample_path}. Run setup.sh first."
        )
    return pd.read_csv(sample_path)


def filter_with_narratives(df: pd.DataFrame) -> pd.DataFrame:
    """Filter to only complaints that have consumer narratives."""
    filtered = df[df["consumer_complaint_narrative"].notna()].copy()
    logger.info(
        f"Filtered to {len(filtered):,} complaints with narratives "
        f"({len(filtered)/len(df)*100:.1f}% of total)"
    )
    return filtered


def create_working_sets(
    df: pd.DataFrame,
    sample_size: int = SAMPLE_SIZE,
    test_size: int = TEST_SIZE,
    random_state: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Create stratified dev and test sets from the filtered data."""
    # Ensure we have narratives
    df_narr = filter_with_narratives(df)

    # Sample for development
    if len(df_narr) > sample_size + test_size:
        sampled = df_narr.sample(n=sample_size + test_size, random_state=random_state)
    else:
        sampled = df_narr
        logger.warning(
            f"Dataset ({len(df_narr)}) smaller than requested "
            f"({sample_size + test_size}). Using all data."
        )

    # Split into dev and test
    dev_set = sampled.iloc[:sample_size]
    test_set = sampled.iloc[sample_size : sample_size + test_size]

    # Save processed files
    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
    dev_path = PROCESSED_DATA_DIR / "dev_set.csv"
    test_path = PROCESSED_DATA_DIR / "test_set.csv"
    dev_set.to_csv(dev_path, index=False)
    test_set.to_csv(test_path, index=False)

    logger.info(f"Dev set: {len(dev_set):,} → {dev_path}")
    logger.info(f"Test set: {len(test_set):,} → {test_path}")
    return dev_set, test_set


def get_data_summary(df: pd.DataFrame) -> dict:
    """Return a summary dict of the dataset for EDA."""
    narr_count = df["consumer_complaint_narrative"].notna().sum()
    return {
        "total_complaints": len(df),
        "with_narratives": narr_count,
        "narrative_pct": round(narr_count / len(df) * 100, 1),
        "date_range": (
            str(df["date_received"].min()),
            str(df["date_received"].max()),
        ),
        "unique_products": df["product"].nunique(),
        "top_products": df["product"].value_counts().head(10).to_dict(),
        "unique_issues": df["issue"].nunique(),
        "top_issues": df["issue"].value_counts().head(10).to_dict(),
        "unique_companies": df["company"].nunique(),
        "top_companies": df["company"].value_counts().head(10).to_dict(),
        "states": df["state"].nunique(),
    }
