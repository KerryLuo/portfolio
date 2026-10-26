import html
import logging
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, StringConstraints

from app.config import settings
from app.ratelimit import RateLimiter

log = logging.getLogger("portfolio.contact")

router = APIRouter(prefix="/api/contact", tags=["contact"])

# 5 messages per IP per hour is plenty for a real person.
limiter = RateLimiter(5, 60 * 60, "Too many messages. Please try again later.")


class ContactMessage(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    email: EmailStr
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=5000)]
    # Honeypot: hidden from people, so only bots fill it in.
    website: str | None = None


async def send_email(msg: ContactMessage) -> None:
    name = html.escape(msg.name)
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.contact_from_email,
                "to": [settings.contact_to_email],
                "reply_to": msg.email,
                "subject": f"Portfolio message from {msg.name[:80]}",
                "html": (
                    f"<p><strong>{name}</strong> &lt;{html.escape(msg.email)}&gt;</p>"
                    f'<p style="white-space:pre-wrap">{html.escape(msg.message)}</p>'
                ),
            },
        )
    res.raise_for_status()


@router.post("", dependencies=[Depends(limiter)])
async def submit(msg: ContactMessage) -> dict[str, bool]:
    # Pretend success so bots get no signal that they were caught.
    if msg.website:
        return {"ok": True}

    if not settings.resend_api_key or not settings.contact_to_email:
        if settings.production:
            log.error("Contact form is not configured (RESEND_API_KEY / CONTACT_TO_EMAIL)")
            raise HTTPException(503, "Contact form is unavailable right now.")
        log.warning("(not emailed, no RESEND_API_KEY) %s <%s>:\n%s", msg.name, msg.email, msg.message)
        return {"ok": True}

    try:
        await send_email(msg)
    except httpx.HTTPError:
        log.exception("Failed to send contact email")
        raise HTTPException(502, "Could not send your message. Please try again later.")
    return {"ok": True}
