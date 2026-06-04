"""
sendgrid_client.py

Wrapper around the SendGrid API for sending transactional and marketing emails.
All outbound emails from the orchestration system flow through this module.

Usage (standalone test):
    python Orchestration/tools/integrations/sendgrid_client.py --test

Usage (as module):
    from Orchestration.tools.integrations.sendgrid_client import send_email, send_email_to_client
"""

import os
import argparse
import logging
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("sendgrid_client")

FROM_EMAIL = os.getenv("MARKETING_FROM_EMAIL", "")
FROM_NAME = os.getenv("MARKETING_FROM_NAME", "Your Business")
OWNER_EMAIL = os.getenv("OWNER_EMAIL", "")


def _get_client():
    api_key = os.getenv("SENDGRID_API_KEY")
    if not api_key:
        raise RuntimeError("SENDGRID_API_KEY not set in .env")
    try:
        from sendgrid import SendGridAPIClient
        return SendGridAPIClient(api_key)
    except ImportError:
        raise RuntimeError("sendgrid package not installed. Run: pip install sendgrid")


def send_email(
    to_email: str,
    subject: str,
    body_text: str,
    body_html: str = None,
    from_email: str = None,
    from_name: str = None,
    reply_to: str = None,
) -> dict:
    """
    Send a single email via SendGrid.

    Returns: {"success": bool, "status_code": int, "error": str or None}
    """
    from_email = from_email or FROM_EMAIL
    from_name = from_name or FROM_NAME

    if not from_email:
        return {"success": False, "status_code": 0, "error": "MARKETING_FROM_EMAIL not set in .env"}
    if not to_email:
        return {"success": False, "status_code": 0, "error": "No recipient email provided"}

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, Email, To, Content, ReplyTo

        message = Mail()
        message.from_email = Email(from_email, from_name)
        message.to = [To(to_email)]
        message.subject = subject
        message.content = [Content("text/plain", body_text)]

        if body_html:
            message.content.append(Content("text/html", body_html))

        if reply_to:
            message.reply_to = ReplyTo(reply_to)

        sg = _get_client()
        response = sg.send(message)

        return {
            "success": response.status_code in (200, 202),
            "status_code": response.status_code,
            "error": None,
        }

    except Exception as e:
        log.error(f"SendGrid error sending to {to_email}: {e}")
        return {"success": False, "status_code": 0, "error": str(e)}


def send_email_to_client(
    first_name: str,
    email: str,
    subject: str,
    body: str,
) -> dict:
    """Convenience wrapper — personalizes subject and body with client name."""
    personalized_subject = subject.replace("{{first_name}}", first_name)
    personalized_body = body.replace("{{first_name}}", first_name)
    return send_email(to_email=email, subject=personalized_subject, body_text=personalized_body)


def send_owner_email(subject: str, body: str) -> dict:
    """Send an internal report or alert email to the business owner."""
    if not OWNER_EMAIL:
        log.warning("OWNER_EMAIL not set — cannot send owner notification")
        return {"success": False, "status_code": 0, "error": "OWNER_EMAIL not set"}
    return send_email(to_email=OWNER_EMAIL, subject=subject, body_text=body)


def send_bulk(recipients: list, subject: str, body_template: str) -> list:
    """
    Send personalized emails to a list of recipients.

    recipients: list of dicts with keys: first_name, email
    Returns: list of result dicts
    """
    results = []
    for r in recipients:
        result = send_email_to_client(
            first_name=r.get("first_name", ""),
            email=r.get("email", ""),
            subject=subject,
            body=body_template,
        )
        results.append({**r, **result})
    return results


def main():
    parser = argparse.ArgumentParser(description="SendGrid client test.")
    parser.add_argument("--test", action="store_true", help="Send a test email to OWNER_EMAIL.")
    parser.add_argument("--to", type=str, help="Override recipient for test.")
    args = parser.parse_args()

    if args.test:
        recipient = args.to or OWNER_EMAIL
        if not recipient:
            print("Set OWNER_EMAIL in .env or pass --to your@email.com")
            return

        result = send_email(
            to_email=recipient,
            subject="Orchestration System — Email Test",
            body_text=(
                "This is a test email from your business orchestration system.\n\n"
                "If you're reading this, SendGrid is configured correctly.\n\n"
                "You're ready to go live."
            ),
        )
        if result["success"]:
            print(f"✅ Test email sent to {recipient} (status {result['status_code']})")
        else:
            print(f"❌ Failed: {result['error']}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
