#!/usr/bin/env bash
# ============================================================
# setup.sh — One-command project bootstrap
# Run: chmod +x setup.sh && ./setup.sh
# ============================================================
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$PROJECT_DIR/venv"
KERNEL_NAME="cfpb-agents"
KERNEL_DISPLAY="CFPB Agentic Complaint System"

echo "============================================"
echo "  CFPB Agentic Complaint System — Setup"
echo "============================================"
echo ""

# ---- Step 1: Python virtual environment ----
echo "[1/6] Creating Python virtual environment..."
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
    echo "  ✓ Created venv at $VENV_DIR"
else
    echo "  ✓ venv already exists"
fi

# Activate
source "$VENV_DIR/bin/activate"
echo "  ✓ Activated venv (Python: $(python --version))"

# ---- Step 2: Install dependencies ----
echo ""
echo "[2/6] Installing Python dependencies..."
pip install --upgrade pip -q
pip install -r "$PROJECT_DIR/requirements.txt" -q
echo "  ✓ All dependencies installed"

# ---- Step 3: Create Jupyter kernel ----
echo ""
echo "[3/6] Creating Jupyter kernel '$KERNEL_NAME'..."
python -m ipykernel install --user --name="$KERNEL_NAME" --display-name="$KERNEL_DISPLAY"
echo "  ✓ Kernel installed — select '$KERNEL_DISPLAY' in VSCode/Jupyter"

# ---- Step 4: Create .env from template ----
echo ""
echo "[4/6] Setting up environment file..."
if [ ! -f "$PROJECT_DIR/.env" ]; then
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    echo "  ✓ Created .env from template"
    echo "  ⚠  IMPORTANT: Edit .env and add your API key(s)"
    echo "     - Anthropic: https://console.anthropic.com/"
    echo "     - OpenAI:    https://platform.openai.com/api-keys"
else
    echo "  ✓ .env already exists"
fi

# ---- Step 5: Download CFPB sample data via API ----
echo ""
echo "[5/6] Downloading CFPB sample data (100 complaints with narratives)..."
python3 << 'PYEOF'
import json
import csv
import os
import urllib.request

# Use the CFPB API to get complaints WITH narratives
# Filter: has_narrative=true, size=100, sort=created_date_desc
api_url = (
    "https://efts.sec.gov/LATEST/search-index/complaints/"
)

# Alternative: use the direct search API
search_url = (
    "https://www.consumerfinance.gov/data-research/consumer-complaints/"
    "search/api/v1/?has_narrative=true&size=100"
    "&sort=created_date_desc&no_aggs=true"
)

sample_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "sample")
sample_file = os.path.join(sample_dir, "cfpb_sample_100.csv")

if os.path.exists(sample_file):
    print("  ✓ Sample data already exists")
else:
    try:
        print("  Fetching from CFPB API...")
        req = urllib.request.Request(search_url)
        req.add_header("User-Agent", "UMD-AgenticAI-Challenge/1.0")
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())

        hits = data.get("hits", {}).get("hits", [])
        if not hits:
            raise Exception("No results from API")

        # Write to CSV
        fields = [
            "complaint_id", "date_received", "product", "sub_product",
            "issue", "sub_issue", "consumer_complaint_narrative",
            "company", "state", "zip_code",
            "company_response_to_consumer", "timely_response",
            "consumer_disputed"
        ]

        with open(sample_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()
            for hit in hits:
                src = hit.get("_source", {})
                row = {
                    "complaint_id": src.get("complaint_id", ""),
                    "date_received": src.get("date_received", ""),
                    "product": src.get("product", ""),
                    "sub_product": src.get("sub_product", ""),
                    "issue": src.get("issue", ""),
                    "sub_issue": src.get("sub_issue", ""),
                    "consumer_complaint_narrative": src.get("complaint_what_happened", ""),
                    "company": src.get("company", ""),
                    "state": src.get("state", ""),
                    "zip_code": src.get("zip_code", ""),
                    "company_response_to_consumer": src.get("company_response", ""),
                    "timely_response": src.get("timely", ""),
                    "consumer_disputed": src.get("consumer_disputed", ""),
                }
                writer.writerow(row)

        print(f"  ✓ Downloaded {len(hits)} sample complaints to {sample_file}")

    except Exception as e:
        print(f"  ⚠  API download failed: {e}")
        print("  Creating placeholder sample file...")
        # Create a minimal placeholder so the project structure works
        with open(sample_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "complaint_id", "date_received", "product", "sub_product",
                "issue", "sub_issue", "consumer_complaint_narrative",
                "company", "state", "zip_code",
                "company_response_to_consumer", "timely_response",
                "consumer_disputed"
            ])
            writer.writerow([
                "1234567", "2025-01-15", "Credit card", "General-purpose credit card or charge card",
                "Problem with a purchase shown on your statement",
                "Credit card company isn't resolving a dispute about a purchase on your statement",
                "I noticed a charge on my credit card statement for $500 from a merchant I never purchased from. I contacted the credit card company to dispute the charge but they have not resolved my dispute after 60 days. They keep saying they are investigating but provide no updates.",
                "Example Bank", "MD", "20742",
                "Closed with explanation", "Yes", "N/A"
            ])
        print("  ✓ Created placeholder sample (download full data manually)")
        print("     Download from: https://www.consumerfinance.gov/data-research/consumer-complaints/")
PYEOF

# ---- Step 6: Initialize git ----
echo ""
echo "[6/6] Initializing git repository..."
cd "$PROJECT_DIR"
if [ ! -d ".git" ]; then
    git init
    git add .
    git commit -m "Initial project scaffold: CFPB Agentic Complaint System"
    echo "  ✓ Git initialized with initial commit"
else
    echo "  ✓ Git already initialized"
fi

# ---- Done ----
echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your API key(s)"
echo "  2. Download full CFPB data:"
echo "     https://www.consumerfinance.gov/data-research/consumer-complaints/"
echo "     Save as: data/raw/complaints.csv"
echo "  3. Open in VSCode: code ."
echo "  4. Select kernel '$KERNEL_DISPLAY' in Jupyter notebooks"
echo "  5. Start with: notebooks/01_data_exploration.ipynb"
echo ""
echo "To activate the environment later:"
echo "  source venv/bin/activate"
echo ""
