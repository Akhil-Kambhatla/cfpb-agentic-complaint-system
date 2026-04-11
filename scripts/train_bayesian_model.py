"""
Retrain the Bayesian logistic regression model on 35K CFPB complaints.
"""
import pandas as pd
import numpy as np
import pymc as pm
import pickle
import json
from sklearn.preprocessing import StandardScaler

print("Loading 35K training data...")
df = pd.read_csv("data/processed/bayesian_train_35k.csv")
print(f"Training samples: {len(df):,}")

# Define outcome
resolution_responses = ["Closed with monetary relief", "Closed with non-monetary relief"]
df["got_resolution"] = df["Company response to consumer"].isin(resolution_responses).astype(int)

# Features
# 1. Product resolution rate (continuous) — encode product as its historical resolution rate
product_rates = df.groupby("Product")["got_resolution"].mean()
df["product_rate"] = df["Product"].map(product_rates)

# 2-5. Narrative features (0 for complaints without narratives)
df["Consumer complaint narrative"] = df["Consumer complaint narrative"].fillna("")
df["narrative_length"] = df["Consumer complaint narrative"].str.len()
df["mentions_regulation"] = df["Consumer complaint narrative"].str.contains(
    r"FCRA|FDCPA|TILA|RESPA|CFPA|ECOA|Regulation|regulation|Fair Credit|Fair Debt|Truth in Lending",
    case=False, na=False
).astype(int)
df["mentions_attorney"] = df["Consumer complaint narrative"].str.contains(
    r"attorney|lawyer|legal|lawsuit|court|sue",
    case=False, na=False
).astype(int)
df["mentions_dollar"] = df["Consumer complaint narrative"].str.contains(
    r"\$\d+|dollar|USD|refund|credit|reimburse",
    case=False, na=False
).astype(int)

# Prepare features
feature_cols = ["product_rate", "narrative_length", "mentions_regulation", "mentions_attorney", "mentions_dollar"]
X = df[feature_cols].values.astype(float)
y = df["got_resolution"].values.astype(float)

# Standardize
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

print(f"Outcome distribution: {y.mean():.3f} resolution rate")
print(f"Features: {feature_cols}")

# Build Bayesian model
print("\nTraining Bayesian logistic regression (this may take 10-15 minutes)...")
with pm.Model() as model:
    # Priors
    intercept = pm.Normal("intercept", mu=0, sigma=2)
    betas = pm.Normal("betas", mu=0, sigma=1, shape=len(feature_cols))
    # Linear predictor
    logit_p = intercept + pm.math.dot(X_scaled, betas)
    # Likelihood
    p = pm.Deterministic("p", pm.math.sigmoid(logit_p))
    obs = pm.Bernoulli("obs", p=p, observed=y)
    # Sample
    trace = pm.sample(
        draws=1000,
        tune=500,
        chains=2,
        cores=1,  # Use 1 core to avoid multiprocessing issues
        random_seed=42,
        return_inferencedata=True,
        progressbar=True
    )

# Extract posterior
print("\nExtracting posterior statistics...")
posterior = trace.posterior
beta_means = posterior["betas"].mean(dim=["chain", "draw"]).values
beta_stds = posterior["betas"].std(dim=["chain", "draw"]).values
intercept_mean = float(posterior["intercept"].mean())

# HDI (95% credible intervals)
beta_samples = posterior["betas"].values.reshape(-1, len(feature_cols))
intercept_samples = posterior["intercept"].values.reshape(-1)

results = {
    "intercept_mean": intercept_mean,
    "coefficients": {},
    "scaler_mean": scaler.mean_.tolist(),
    "scaler_scale": scaler.scale_.tolist(),
    "feature_names": feature_cols,
    "training_samples": len(df),
    "resolution_rate": float(y.mean()),
    "product_rates": {k: float(v) for k, v in product_rates.items()},
}

for i, name in enumerate(feature_cols):
    ci_low = float(np.percentile(beta_samples[:, i], 2.5))
    ci_high = float(np.percentile(beta_samples[:, i], 97.5))
    results["coefficients"][name] = {
        "mean": float(beta_means[i]),
        "std": float(beta_stds[i]),
        "ci_lower": ci_low,
        "ci_upper": ci_high,
    }
    print(f"  {name}: {beta_means[i]:.4f} (95% CI: {ci_low:.4f} to {ci_high:.4f})")

# Save model artifacts in the format expected by risk_analyzer.py
# We build a posterior_samples dict matching the existing model structure
print("\nSaving model...")

# Build per-named-key posterior samples (existing format)
posterior_samples_dict = {
    "intercept": intercept_samples.tolist(),
    "beta_product_risk": beta_samples[:, 0].tolist(),
    "beta_narrative_length": beta_samples[:, 1].tolist(),
    "beta_mentions_regulation": beta_samples[:, 2].tolist(),
    "beta_mentions_attorney": beta_samples[:, 3].tolist(),
    "beta_mentions_dollar": beta_samples[:, 4].tolist(),
}

# Build scaler params in existing format (product = product_rate feature)
scaler_params = {
    "product_mean": float(scaler.mean_[0]),
    "product_std": float(scaler.scale_[0]),
    "length_mean": float(scaler.mean_[1]),
    "length_std": float(scaler.scale_[1]),
}

model_data = {
    "posterior_samples": posterior_samples_dict,
    "product_resolution_rates": {k: float(v) for k, v in product_rates.items()},
    "scaler_params": scaler_params,
    "feature_importances": {name: float(abs(beta_means[i])) for i, name in enumerate(feature_cols)},
}

with open("data/processed/bayesian_model.pkl", "wb") as f:
    pickle.dump(model_data, f)

with open("data/processed/bayesian_results.json", "w") as f:
    json.dump(results, f, indent=2)

print("Saved data/processed/bayesian_model.pkl")
print("Saved data/processed/bayesian_results.json")

# Compute risk gap statistics on the 100K dataset
print("\nComputing risk gap statistics on 100K dataset...")
analysis_df = pd.read_csv("data/processed/analysis_100k.csv")
analysis_df["Consumer complaint narrative"] = analysis_df["Consumer complaint narrative"].fillna("")
analysis_df["got_resolution"] = analysis_df["Company response to consumer"].isin(resolution_responses).astype(int)

# Apply model to get resolution probabilities for all 100K
analysis_df["product_rate"] = analysis_df["Product"].map(product_rates).fillna(y.mean())
analysis_df["narrative_length"] = analysis_df["Consumer complaint narrative"].str.len()
analysis_df["mentions_regulation"] = analysis_df["Consumer complaint narrative"].str.contains(
    r"FCRA|FDCPA|TILA|RESPA|CFPA|ECOA|Regulation|regulation|Fair Credit|Fair Debt|Truth in Lending",
    case=False, na=False
).astype(int)
analysis_df["mentions_attorney"] = analysis_df["Consumer complaint narrative"].str.contains(
    r"attorney|lawyer|legal|lawsuit|court|sue",
    case=False, na=False
).astype(int)
analysis_df["mentions_dollar"] = analysis_df["Consumer complaint narrative"].str.contains(
    r"\$\d+|dollar|USD|refund|credit|reimburse",
    case=False, na=False
).astype(int)

X_analysis = analysis_df[feature_cols].values.astype(float)
X_analysis_scaled = scaler.transform(X_analysis)

# Use posterior mean for point estimates
logits = intercept_mean + X_analysis_scaled @ beta_means
probs = 1 / (1 + np.exp(-logits))
analysis_df["resolution_probability"] = probs


def compute_regulatory_risk(row):
    risk = 0.0
    product = str(row.get("Product", "")).lower()
    narrative = str(row.get("Consumer complaint narrative", "")).lower()
    # Product risk
    high_risk_products = ["debt collection", "payday loan", "mortgage"]
    medium_risk_products = ["credit card", "credit reporting", "checking or savings"]
    if any(p in product for p in high_risk_products):
        risk += 0.35
    elif any(p in product for p in medium_risk_products):
        risk += 0.20
    else:
        risk += 0.10
    # Narrative signals (strengthened weights)
    if row.get("mentions_regulation", 0):
        risk += 0.25
    if row.get("mentions_attorney", 0):
        risk += 0.20
    if row.get("mentions_dollar", 0):
        risk += 0.10
    # Multiple contact attempts
    if "called" in narrative and ("times" in narrative or "multiple" in narrative or "repeated" in narrative):
        risk += 0.10
    # Elderly/vulnerable consumer
    if "senior" in narrative or "elderly" in narrative or "disabled" in narrative or "fixed income" in narrative:
        risk += 0.10
    return min(risk, 1.0)


analysis_df["regulatory_risk"] = analysis_df.apply(compute_regulatory_risk, axis=1)
analysis_df["risk_gap"] = analysis_df["regulatory_risk"] - analysis_df["resolution_probability"]

# Risk gap stats
high_risk_gap = (analysis_df["risk_gap"] > 0.2).sum()
pct_high_risk = round(high_risk_gap / len(analysis_df) * 100, 1)

risk_gap_stats = {
    "high_risk_gap_count": int(high_risk_gap),
    "high_risk_gap_pct": pct_high_risk,
    "mean_risk_gap": round(float(analysis_df["risk_gap"].mean()), 3),
    "mean_resolution_probability": round(float(analysis_df["resolution_probability"].mean()), 3),
    "mean_regulatory_risk": round(float(analysis_df["regulatory_risk"].mean()), 3),
}

print(f"High risk gap (>0.2): {high_risk_gap:,} ({pct_high_risk}%)")
print(f"Mean resolution probability: {risk_gap_stats['mean_resolution_probability']}")
print(f"Mean regulatory risk: {risk_gap_stats['mean_regulatory_risk']}")
print(f"Mean risk gap: {risk_gap_stats['mean_risk_gap']}")

# Update dataset_stats.json with risk gap info
with open("data/processed/dataset_stats.json", "r") as f:
    stats = json.load(f)

stats.update(risk_gap_stats)
stats["bayesian_training_samples"] = len(df)
stats["bayesian_coefficients"] = results["coefficients"]

with open("data/processed/dataset_stats.json", "w") as f:
    json.dump(stats, f, indent=2)

print("\nUpdated data/processed/dataset_stats.json with Bayesian results")
print("\n=== Training Complete ===")
