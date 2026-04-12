"""Two-email system: acknowledgment on case creation, resolution + survey on resolve."""
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_SMTP_HOST = "smtp.gmail.com"
_SMTP_PORT = 587

# Single recipient for all emails
RECIPIENT_EMAIL = "akhilkambhatla.work@gmail.com"


def _get_credentials() -> tuple[str, str] | None:
    addr = os.getenv("EMAIL_ADDRESS", "")
    pwd = os.getenv("EMAIL_APP_PASSWORD", "")
    if not addr or not pwd:
        return None
    return addr, pwd


def _send_email(subject: str, html_body: str) -> bool:
    """Send an HTML email via Gmail SMTP. Returns True on success."""
    creds = _get_credentials()
    if not creds:
        logger.info(
            "[EMAIL] Not configured — set EMAIL_ADDRESS and EMAIL_APP_PASSWORD. Draft: '%s'",
            subject,
        )
        return False

    from_addr, password = creds
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = RECIPIENT_EMAIL
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(from_addr, password)
            smtp.sendmail(from_addr, RECIPIENT_EMAIL, msg.as_string())
        logger.info("[EMAIL] Sent '%s' to %s", subject, RECIPIENT_EMAIL)
        return True
    except Exception as exc:
        logger.error("[EMAIL] Failed to send '%s': %s", subject, exc)
        return False


def _footer() -> str:
    return """
    <div style="padding:12px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        CFPB Complaint Intelligence System — UMD Agentic AI Challenge 2026
      </p>
    </div>
    """


def _wrap(inner_html: str, header_html: str) -> str:
    return f"""<!DOCTYPE html>
    <html><head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;
                  border:1px solid #e5e7eb;overflow:hidden;">
        {header_html}
        <div style="padding:24px;">{inner_html}</div>
        {_footer()}
      </div>
    </body></html>"""


def _save_sent_email(email_type: str, subject: str, case_number: str = "") -> None:
    """Best-effort save to DB. Import here to avoid circular imports."""
    try:
        from src.data.database import save_sent_email
        save_sent_email(email_type, RECIPIENT_EMAIL, subject, case_number)
    except Exception as exc:
        logger.debug("[EMAIL] Could not save email record: %s", exc)


# ─────────────────────────────────────────────────────────────
# Email 1: Acknowledgment (sent automatically on case creation)
# ─────────────────────────────────────────────────────────────

def send_acknowledgment_email(case_data: dict) -> bool:
    """Send Email 1: complaint received acknowledgment."""
    case_number = case_data.get("case_number", "")
    product = case_data.get("product", "Financial Product")
    team = case_data.get("assigned_team", "our team").replace("_", " ").title()

    header = f"""
    <div style="background:#2563eb;padding:20px 24px;">
      <h2 style="color:#fff;margin:0;font-size:18px;">CFPB Complaint Intelligence System</h2>
    </div>
    """

    body = f"""
    <p style="font-size:14px;color:#111827;margin-bottom:16px;">
      We have received your complaint regarding <strong>{product}</strong>.
    </p>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:16px;margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="font-size:13px;color:#6b7280;padding:4px 0;width:40%;">Case Number:</td>
          <td style="font-size:13px;font-weight:700;color:#1d4ed8;padding:4px 0;">{case_number}</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:#6b7280;padding:4px 0;">Assigned Team:</td>
          <td style="font-size:13px;font-weight:600;padding:4px 0;">{team}</td>
        </tr>
      </table>
    </div>
    <p style="font-size:13px;color:#374151;">
      Your complaint has been assigned to our {team} team.
      You will receive an update when your case has been resolved.
    </p>
    <p style="font-size:12px;color:#6b7280;margin-top:16px;">
      Please reference your case number <strong>{case_number}</strong> in any future correspondence.
    </p>
    """

    html = _wrap(body, header)
    subject = f"Complaint Received — Case {case_number}"
    sent = _send_email(subject, html)
    _save_sent_email("acknowledgment", subject, case_number)
    return sent


# ─────────────────────────────────────────────────────────────
# Email 2: Resolution + Survey (sent when human clicks "Resolve Case")
# ─────────────────────────────────────────────────────────────

def send_resolution_email(case_data: dict, response_letter: str) -> bool:
    """Send Email 2: case resolved + AI customer response letter + clickable rating links."""
    case_number = case_data.get("case_number", "")
    product = case_data.get("product", "Financial Product")

    letter_html = (response_letter or "").replace("\n", "<br>")

    # Build rating buttons
    base_url = os.getenv("API_BASE_URL", "http://localhost:8000/api")
    rating_buttons = "".join(
        f'<a href="{base_url}/satisfaction/{case_number}/rate?score={i}" '
        f'style="display:inline-block;width:52px;height:52px;line-height:52px;'
        f'border-radius:50%;background:#7c3aed;color:#fff;font-size:20px;font-weight:700;'
        f'text-decoration:none;text-align:center;margin:0 6px;">{i}</a>'
        for i in range(1, 6)
    )

    header = f"""
    <div style="background:#059669;padding:20px 24px;">
      <h2 style="color:#fff;margin:0;font-size:18px;">CFPB Complaint Intelligence System — Case Resolved</h2>
    </div>
    """

    body = f"""
    <p style="font-size:14px;color:#111827;margin-bottom:16px;">
      Your case <strong>{case_number}</strong> has been resolved.
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;
                padding:16px;margin-bottom:16px;line-height:1.7;font-size:14px;color:#111827;">
      {letter_html}
    </div>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />

    <p style="font-size:13px;color:#374151;">
      If you are not satisfied with this resolution, please contact us referencing case number
      <strong>{case_number}</strong> to file a dispute.
    </p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />

    <p style="font-size:14px;color:#111827;font-weight:600;margin-bottom:8px;">
      How did we do? Please rate your experience:
    </p>
    <div style="margin:16px 0;text-align:center;">
      {rating_buttons}
    </div>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:8px;">
      1 = Very Dissatisfied &nbsp;&nbsp;&nbsp; 5 = Very Satisfied
    </p>
    """

    html = _wrap(body, header)
    subject = f"Case Resolved — {case_number} — {product}"
    sent = _send_email(subject, html)
    _save_sent_email("resolution", subject, case_number)
    return sent


def send_progress_email(case_data: dict) -> bool:
    """Send a progress update when all human tasks have been completed."""
    case_number = case_data.get("case_number", "")
    product = case_data.get("product", "Financial Product")

    header = """
    <div style="background:#2563eb;padding:20px 24px;">
      <h2 style="color:#fff;margin:0;font-size:18px;">CFPB Complaint Intelligence System — Progress Update</h2>
    </div>
    """
    body = f"""
    <p style="font-size:14px;color:#111827;margin-bottom:16px;">
      All required actions for your case <strong>{case_number}</strong> have been completed.
    </p>
    <p style="font-size:14px;color:#374151;">
      Product: <strong>{product}</strong><br>
      Status: <strong>All tasks complete — final review in progress</strong>
    </p>
    <p style="font-size:13px;color:#6b7280;margin-top:16px;">
      You will receive a resolution email shortly with detailed findings and next steps.
    </p>
    """
    html = _wrap(body, header)
    subject = f"Progress Update — {case_number} — Actions Complete"
    sent = _send_email(subject, html)
    _save_sent_email("progress", subject, case_number)
    return sent
