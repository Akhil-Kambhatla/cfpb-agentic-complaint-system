"""Project configuration — loads from .env and provides defaults."""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ---- Paths ----
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
SAMPLE_DATA_DIR = DATA_DIR / "sample"

# ---- LLM Configuration ----
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

# Determine which provider to use
LLM_PROVIDER = "anthropic" if ANTHROPIC_API_KEY else "openai" if OPENAI_API_KEY else None

# ---- Data Configuration ----
CFPB_DATA_PATH = os.getenv("CFPB_DATA_PATH", str(RAW_DATA_DIR / "complaints.csv"))
SAMPLE_SIZE = int(os.getenv("SAMPLE_SIZE", "10000"))
TEST_SIZE = int(os.getenv("TEST_SIZE", "1000"))

# ---- CFPB Product Categories (ground truth) ----
CFPB_PRODUCTS = [
    "Credit reporting, credit repair services, or other personal consumer reports",
    "Debt collection",
    "Credit card or prepaid card",
    "Mortgage",
    "Checking or savings account",
    "Student loan",
    "Vehicle loan or lease",
    "Money transfer, virtual currency, or money service",
    "Payday loan, title loan, or personal loan",
    "Credit card",
    "Bank account or service",
    "Consumer Loan",
    "Money transfers",
    "Prepaid card",
    "Other financial service",
]

# ---- Severity Levels ----
SEVERITY_LEVELS = ["low", "medium", "high", "critical"]

# ---- Internal Teams for Routing ----
INTERNAL_TEAMS = [
    "compliance",
    "billing_disputes",
    "fraud",
    "customer_service",
    "legal",
    "executive_escalation",
]

# ---- Relevant Regulations by Product ----
REGULATIONS_MAP = {
    "Credit card": ["TILA", "CARD Act", "FCRA", "Reg Z"],
    "Credit reporting": ["FCRA", "Reg V"],
    "Debt collection": ["FDCPA", "Reg F"],
    "Mortgage": ["TILA", "RESPA", "ECOA", "HMDA", "Reg X", "Reg Z"],
    "Checking or savings account": ["EFTA", "Reg E", "Reg DD"],
    "Student loan": ["TILA", "Reg Z", "HEA"],
    "Payday loan": ["TILA", "CFPA", "State lending laws"],
    "default": ["CFPA", "UDAAP"],
}
