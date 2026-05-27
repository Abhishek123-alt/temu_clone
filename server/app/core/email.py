import logging
import os
import smtplib
from email.message import EmailMessage

from dotenv import load_dotenv
from fastapi import HTTPException, status

load_dotenv()

logger = logging.getLogger(__name__)


def _bool_env(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def send_email(*, to: str, subject: str, body: str, reply_to: str | None = None) -> None:
    """Send a plain-text email via the SMTP server configured in .env.

    Raises HTTPException(503) when SMTP isn't configured so callers don't
    silently swallow misconfiguration.
    """
    host = os.getenv("SMTP_HOST", "").strip()
    if not host:
        logger.error("SMTP_HOST is not configured — cannot send email")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email service is not configured. Please contact the administrator.",
        )

    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    # Gmail app passwords are displayed with spaces ("abcd efgh ijkl mnop")
    # but the SMTP server expects no spaces — strip them defensively.
    password = os.getenv("SMTP_PASSWORD", "").replace(" ", "")
    from_email = (
        os.getenv("EMAILS_FROM_EMAIL")
        or os.getenv("SMTP_FROM")
        or user
        or "no-reply@temu-clone.example"
    ).strip()
    from_name = os.getenv("EMAILS_FROM_NAME", "").strip()
    sender = f"{from_name} <{from_email}>" if from_name else from_email
    # Accept either SMTP_TLS (matches the convention the user added in .env)
    # or SMTP_USE_TLS (original name). Either form turns on STARTTLS.
    use_tls = _bool_env("SMTP_TLS", _bool_env("SMTP_USE_TLS", True))

    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body)

    try:
        with smtplib.SMTP(host, port, timeout=15) as server:
            server.ehlo()
            if use_tls:
                server.starttls()
                server.ehlo()
            if user:
                server.login(user, password)
            server.send_message(msg)
        logger.info(f"Support email sent to {to} (reply_to={reply_to})")
    except smtplib.SMTPException as exc:
        logger.exception(f"SMTP failure sending to {to}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not send your message. Please try again later.",
        ) from exc
