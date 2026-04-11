"""
Prepare the 100K analysis dataset and 35K Bayesian training set from full CFPB data.
"""
import pandas as pd
import json
import os
import numpy as np

print("Loading full CFPB dataset...")
# The CSV might be named complaints.csv after unzipping
csv_path = "data/raw/complaints.csv"
if not os.path.exists(csv_path):
    # Try other common names
    for name in ["data/raw/Consumer_Complaints.csv", "data/raw/rows.csv"]:
        if os.path.exists(name):
            csv_path = name
            break

# Load with only needed columns to save memory
cols_needed = [
    "Date received", "Product", "Sub-product", "Issue", "Sub-issue",
    "Consumer complaint narrative", "Company public response",
    "Company", "State", "ZIP code", "Consumer consent provided?",
    "Submitted via", "Date sent to company", "Company response to consumer",
    "Timely response?", "Consumer disputed?", "Complaint ID"
]

print(f"Reading from {csv_path}...")
df = pd.read_csv(csv_path, usecols=cols_needed, low_memory=False)
print(f"Total complaints loaded: {len(df):,}")

# Filter to complaints with a company response (we need outcome data)
df = df[df["Company response to consumer"].notna()]
print(f"With company response: {len(df):,}")

# Define resolution outcome
resolution_responses = ["Closed with monetary relief", "Closed with non-monetary relief"]
df["got_resolution"] = df["Company response to consumer"].isin(resolution_responses).astype(int)

# Has narrative flag
df["has_narrative"] = df["Consumer complaint narrative"].notna() & (df["Consumer complaint narrative"].str.len() > 10)

print(f"With narratives: {df['has_narrative'].sum():,}")
print(f"Without narratives: {(~df['has_narrative']).sum():,}")

# ============================================
# SAMPLE 100K FOR STATISTICS
# ============================================
# Stratified by product to maintain distribution
print("\nSampling 100K for statistics...")
if len(df) > 100000:
    # Stratified sample
    sample_100k = df.groupby("Product", group_keys=False).apply(
        lambda x: x.sample(n=min(len(x), max(1, int(100000 * len(x) / len(df)))), random_state=42)
    )
    # If we're short of 100K due to rounding, add more
    if len(sample_100k) < 100000:
        remaining = df[~df.index.isin(sample_100k.index)].sample(n=100000 - len(sample_100k), random_state=42)
        sample_100k = pd.concat([sample_100k, remaining])
    sample_100k = sample_100k.head(100000)
else:
    sample_100k = df.copy()

print(f"100K sample size: {len(sample_100k):,}")

# Save 100K dataset
os.makedirs("data/processed", exist_ok=True)
sample_100k.to_csv("data/processed/analysis_100k.csv", index=False)
print("Saved data/processed/analysis_100k.csv")

# ============================================
# COMPUTE ALL STATISTICS FROM 100K
# ============================================
print("\nComputing statistics...")

stats = {}

# Basic counts
stats["total_complaints_analyzed"] = len(sample_100k)
stats["total_complaints_in_database"] = len(df)
stats["unique_products"] = int(sample_100k["Product"].nunique())
stats["unique_issues"] = int(sample_100k["Issue"].nunique())
stats["with_narratives"] = int(sample_100k["has_narrative"].sum())
stats["without_narratives"] = int((~sample_100k["has_narrative"]).sum())

# Response distribution
resp_dist = sample_100k["Company response to consumer"].value_counts()
stats["response_distribution"] = resp_dist.to_dict()

closed_with_explanation = (sample_100k["Company response to consumer"] == "Closed with explanation").sum()
stats["pct_closed_with_explanation"] = round(closed_with_explanation / len(sample_100k) * 100, 1)
stats["pct_got_resolution"] = round(sample_100k["got_resolution"].mean() * 100, 1)

# Resolution rates by product
res_by_product = sample_100k.groupby("Product")["got_resolution"].agg(["mean", "count"])
res_by_product["mean"] = (res_by_product["mean"] * 100).round(1)
res_by_product = res_by_product.sort_values("mean", ascending=False)
stats["resolution_rates_by_product"] = {
    row.Index: {"rate": row.mean, "count": int(row.count)}
    for row in res_by_product.itertuples()
}

# Product distribution
prod_dist = sample_100k["Product"].value_counts()
stats["product_distribution"] = {k: int(v) for k, v in prod_dist.items()}
stats["product_distribution_pct"] = {k: round(v/len(sample_100k)*100, 1) for k, v in prod_dist.items()}

# Issue distribution (top 20)
issue_dist = sample_100k["Issue"].value_counts().head(20)
stats["top_issues"] = {k: int(v) for k, v in issue_dist.items()}

# Company distribution (top 20)
company_dist = sample_100k["Company"].value_counts().head(20)
stats["top_companies"] = {k: int(v) for k, v in company_dist.items()}

# Narrative length stats (for those with narratives)
narr = sample_100k[sample_100k["has_narrative"]]["Consumer complaint narrative"].str.len()
stats["narrative_length_median"] = int(narr.median())
stats["narrative_length_mean"] = int(narr.mean())

# State distribution (top 10)
state_dist = sample_100k["State"].value_counts().head(10)
stats["top_states"] = {k: int(v) for k, v in state_dist.items()}

# Save stats
with open("data/processed/dataset_stats.json", "w") as f:
    json.dump(stats, f, indent=2)
print("Saved data/processed/dataset_stats.json")

# ============================================
# SAMPLE 35K FOR BAYESIAN TRAINING
# ============================================
print("\nSampling 35K for Bayesian model training...")

# Include BOTH with and without narratives (product type is the main feature)
# Stratify by product
if len(sample_100k) > 35000:
    train_35k = sample_100k.groupby("Product", group_keys=False).apply(
        lambda x: x.sample(n=min(len(x), max(1, int(35000 * len(x) / len(sample_100k)))), random_state=99)
    ).head(35000)
else:
    train_35k = sample_100k.sample(n=min(35000, len(sample_100k)), random_state=99)

print(f"Training set size: {len(train_35k):,}")
train_35k.to_csv("data/processed/bayesian_train_35k.csv", index=False)
print("Saved data/processed/bayesian_train_35k.csv")

# Also save a dev set with narratives for testing (keep existing 10K if available, else create new)
if not os.path.exists("data/processed/dev_set_10k.csv"):
    narr_df = sample_100k[sample_100k["has_narrative"]]
    dev_10k = narr_df.sample(n=min(10000, len(narr_df)), random_state=42)
    dev_10k.to_csv("data/processed/dev_set_10k.csv", index=False)
    print("Saved new data/processed/dev_set_10k.csv")
else:
    print("data/processed/dev_set_10k.csv already exists — skipping")

print("\n=== Summary ===")
print(f"Full database: {len(df):,} complaints")
print(f"Analysis dataset: {len(sample_100k):,} complaints")
print(f"Bayesian training: {len(train_35k):,} complaints")
print(f"Resolution rate: {stats['pct_got_resolution']}%")
print(f"Closed with explanation: {stats['pct_closed_with_explanation']}%")
print(f"Products: {stats['unique_products']}")
print(f"Issues: {stats['unique_issues']}")
print("\nDone!")
