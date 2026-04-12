"""Canonical product mapping for CFPB complaint categories."""

# Maps every CFPB product name to one of 12 canonical categories
PRODUCT_CANONICAL_MAP = {
    # Credit Reporting (3 variants → 1)
    "Credit reporting or other personal consumer reports": "Credit Reporting",
    "Credit reporting, credit repair services, or other personal consumer reports": "Credit Reporting",
    "Credit reporting": "Credit Reporting",

    # Debt Collection
    "Debt collection": "Debt Collection",

    # Mortgage
    "Mortgage": "Mortgage",

    # Checking or Savings (2 variants → 1)
    "Checking or savings account": "Checking or Savings Account",
    "Bank account or service": "Checking or Savings Account",

    # Credit Card (3 variants → 1)
    "Credit card": "Credit Card",
    "Credit card or prepaid card": "Credit Card",
    "Prepaid card": "Credit Card",

    # Money Transfer (3 variants → 1)
    "Money transfer, virtual currency, or money service": "Money Transfer",
    "Money transfers": "Money Transfer",
    "Virtual currency": "Money Transfer",

    # Student Loan
    "Student loan": "Student Loan",

    # Vehicle Loan
    "Vehicle loan or lease": "Vehicle Loan",

    # Consumer Loan
    "Consumer Loan": "Consumer Loan",

    # Payday Loan (3 variants → 1)
    "Payday loan, title loan, or personal loan": "Payday Loan",
    "Payday loan, title loan, personal loan, or advance loan": "Payday Loan",
    "Payday loan": "Payday Loan",

    # Debt Management
    "Debt or credit management": "Debt Management",

    # Other
    "Other financial service": "Other Financial Service",
}

# The 12 canonical product names
CANONICAL_PRODUCTS = [
    "Credit Reporting",
    "Debt Collection",
    "Mortgage",
    "Checking or Savings Account",
    "Credit Card",
    "Money Transfer",
    "Student Loan",
    "Vehicle Loan",
    "Consumer Loan",
    "Payday Loan",
    "Debt Management",
    "Other Financial Service",
]


def canonicalize_product(product_name: str) -> str:
    """Map any CFPB product name to its canonical form."""
    if not product_name:
        return "Other Financial Service"

    # Direct lookup
    canonical = PRODUCT_CANONICAL_MAP.get(product_name)
    if canonical:
        return canonical

    # Case-insensitive lookup
    product_lower = product_name.lower().strip()
    for key, value in PRODUCT_CANONICAL_MAP.items():
        if key.lower() == product_lower:
            return value

    # Fuzzy matching — check if any canonical name is contained in the input
    for canonical_name in CANONICAL_PRODUCTS:
        if canonical_name.lower() in product_lower or product_lower in canonical_name.lower():
            return canonical_name

    # Keyword matching
    keyword_map = {
        "credit report": "Credit Reporting",
        "credit card": "Credit Card",
        "prepaid": "Credit Card",
        "debt collect": "Debt Collection",
        "mortgage": "Mortgage",
        "checking": "Checking or Savings Account",
        "savings": "Checking or Savings Account",
        "bank account": "Checking or Savings Account",
        "student loan": "Student Loan",
        "vehicle": "Vehicle Loan",
        "auto loan": "Vehicle Loan",
        "car loan": "Vehicle Loan",
        "payday": "Payday Loan",
        "title loan": "Payday Loan",
        "personal loan": "Payday Loan",
        "money transfer": "Money Transfer",
        "virtual currency": "Money Transfer",
        "crypto": "Money Transfer",
        "consumer loan": "Consumer Loan",
        "debt management": "Debt Management",
    }
    for keyword, canonical in keyword_map.items():
        if keyword in product_lower:
            return canonical

    # Ultimate fallback
    return "Other Financial Service"
