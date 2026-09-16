# modules/payments/razorpay_client.py
"""Thin Razorpay REST client -- httpx, no `razorpay` SDK dependency, same
"hand-roll it with the HTTP client already in this project" choice
core/whatsapp.py's WhatsAppClient already made for the Meta Graph API rather
than adding Meta's own SDK.

Every hospital has its OWN Razorpay account (own key_id/key_secret,
db/repositories/hospitals.py's get_razorpay_credentials()) -- these
functions are key-agnostic (caller passes credentials in), same
"caller-supplied key" shape core/crypto.py already establishes, so a
misconfigured/unconnected hospital never leaks into a shared global client."""
import hashlib
import hmac
import logging

import httpx

logger = logging.getLogger(__name__)

RAZORPAY_API_BASE = "https://api.razorpay.com/v1"


class RazorpayError(Exception):
    """Order creation failed -- bad credentials, Razorpay API error, or a
    network failure. Callers turn this into a clean error message rather
    than letting it crash the WhatsApp flow or portal request."""


async def create_payment_link(
    key_id: str, key_secret: str, amount_paise: int, currency: str, description: str, receipt: str,
    notes: dict, customer_phone: str | None = None,
) -> dict:
    """POST /v1/payment_links -- correction made while wiring Sub-stage 3's
    WhatsApp layer: Sub-stage 2 originally used the Orders API (POST
    /v1/orders), which is meant for Razorpay's client-side Checkout.js
    widget running in a browser -- it has no standalone URL a WhatsApp text
    message can send. Payment Links is the API actually meant for "send the
    guest a link, they pay on a hosted Razorpay page, no app/browser
    integration needed on our side" -- exactly this product's WhatsApp-only
    delivery mechanism. Never exercised against a live Razorpay account
    either way (no real credentials in any environment yet), so swapping the
    implementation before the WhatsApp flow's own first real use carries no
    regression risk.

    `notes` still carries hospital_id/food_order_id -- Razorpay echoes
    `notes` back verbatim on every webhook event for this payment link/its
    payments, which is what handle_razorpay_webhook() reads to resolve which
    hospital a webhook is for, BEFORE verifying the signature -- same
    "structural read of routing metadata first" shape webhook/routes.py's
    own extract_phone_number_id() already establishes for Meta webhooks.
    Response includes `short_url`, the actual link to send the guest."""
    payload = {
        "amount": amount_paise, "currency": currency, "description": description,
        "reference_id": receipt, "notes": notes, "notify": {"sms": False, "email": False},
    }
    if customer_phone:
        payload["customer"] = {"contact": customer_phone}
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            response = await client.post(
                f"{RAZORPAY_API_BASE}/payment_links", auth=(key_id, key_secret), json=payload,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("Razorpay payment link creation failed: %s", exc)
            raise RazorpayError(f"Razorpay payment link creation failed: {exc}") from exc
    return response.json()


def verify_webhook_signature(body: bytes, signature: str, webhook_secret: str | None) -> bool:
    """Razorpay's webhook signature -- raw hex HMAC-SHA256 of the request
    body, header `X-Razorpay-Signature` (no "sha256=" prefix, unlike Meta's
    own X-Hub-Signature-256 validate_webhook_signature() checks) -- fail
    closed on a missing secret rather than raising, same discipline
    validate_webhook_signature() uses for a hospital with no app_secret
    configured yet."""
    if not webhook_secret or not signature:
        return False
    expected = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
