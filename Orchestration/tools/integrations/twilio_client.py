"""
twilio_client.py

Wrapper around the Twilio API for sending transactional SMS messages.
All outbound SMS from the orchestration system flow through this module.

Usage (standalone test):
    python Orchestration/tools/integrations/twilio_client.py --test --to +15551234567

Usage (as module):
    from Orchestration.tools.integrations.twilio_client import send_sms, send_sms_to_client
"""

import os
import re
import argparse
import logging
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("twilio_client")

FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")
ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")

MAX_SMS_LENGTH = 160


def _get_client():
    if not ACCOUNT_SID or not AUTH_TOKEN:
        raise RuntimeError("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in .env")
    try:
        from twilio.rest import Client
        return Client(ACCOUNT_SID, AUTH_TOKEN)
    except ImportError:
        raise RuntimeError("twilio package not installed. Run: pip install twilio")


def normalize_phone(phone: str) -> str:
    """Convert (555) 867-5309 or 5558675309 to +15558675309."""
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 10:
        return f"+1{digits}"
    elif len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    return f"+{digits}"


def is_valid_phone(phone: str) -> bool:
    digits = re.sub(r"\D", "", phone)
    return len(digits) in (10, 11)


def send_sms(to_phone: str, message: str) -> dict:
    """
    Send a single SMS via Twilio.

    Returns: {"success": bool, "sid": str or None, "error": str or None}
    """
    if not FROM_NUMBER:
        return {"success": False, "sid": None, "error": "TWILIO_FROM_NUMBER not set in .env"}
    if not to_phone or not is_valid_phone(to_phone):
        return {"success": False, "sid": None, "error": f"Invalid phone number: {to_phone}"}

    to_normalized = normalize_phone(to_phone)

    if len(message) > MAX_SMS_LENGTH:
        log.warning(f"SMS to {to_normalized} is {len(message)} chars — will be split by carrier")

    try:
        client = _get_client()
        msg = client.messages.create(
            body=message,
            from_=FROM_NUMBER,
            to=to_normalized,
        )
        return {"success": True, "sid": msg.sid, "error": None}
    except Exception as e:
        log.error(f"Twilio error sending to {to_normalized}: {e}")
        return {"success": False, "sid": None, "error": str(e)}


def send_sms_to_client(first_name: str, phone: str, message_template: str) -> dict:
    """Personalizes template and sends SMS to a client."""
    business_name = os.getenv("MARKETING_FROM_NAME", "us")
    message = (
        message_template
        .replace("{{first_name}}", first_name)
        .replace("{{business_name}}", business_name)
        .replace("{{review_link}}", os.getenv("REVIEW_LINK", ""))
        .replace("{{booking_link}}", os.getenv("VITE_API_URL", ""))
    )
    return send_sms(to_phone=phone, message=message)


def send_bulk_sms(recipients: list, message_template: str) -> list:
    """
    Send personalized SMS to a list of recipients.

    recipients: list of dicts with keys: first_name, phone
    Returns: list of result dicts
    """
    results = []
    for r in recipients:
        result = send_sms_to_client(
            first_name=r.get("first_name", ""),
            phone=r.get("phone", ""),
            message_template=message_template,
        )
        results.append({**r, "sms_result": result})
    return results


def main():
    parser = argparse.ArgumentParser(description="Twilio SMS client test.")
    parser.add_argument("--test", action="store_true", help="Send a test SMS.")
    parser.add_argument("--to", type=str, help="Phone number to send test to (+1XXXXXXXXXX).")
    args = parser.parse_args()

    if args.test:
        if not args.to:
            print("Pass --to +1XXXXXXXXXX to send a test SMS")
            return

        result = send_sms(
            to_phone=args.to,
            message=(
                "Test from your business orchestration system. "
                "If you received this, Twilio is configured correctly."
            ),
        )
        if result["success"]:
            print(f"✅ Test SMS sent to {args.to} (SID: {result['sid']})")
        else:
            print(f"❌ Failed: {result['error']}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
