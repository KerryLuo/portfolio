import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.routers import contact, github

logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s: %(message)s")

app = FastAPI(title="Portfolio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(contact.router)
app.include_router(github.router)


@app.get("/api/health", tags=["meta"])
async def health() -> dict[str, bool]:
    return {"ok": True}


# Friendly per-field messages for the contact form. The frontend shows
# `error` as a banner and `fields` under each input.
FIELD_MESSAGES = {
    "name": "Name is required",
    "email": "Enter a valid email address",
    "message": "Message is too short",
}


@app.exception_handler(RequestValidationError)
async def validation_error(_req: Request, exc: RequestValidationError) -> JSONResponse:
    fields: dict[str, str] = {}
    for err in exc.errors():
        field = str(err["loc"][-1])
        if field in fields:
            continue
        if err["type"] == "string_too_long":
            fields[field] = f"{field.capitalize()} is too long"
        else:
            fields[field] = FIELD_MESSAGES.get(field, "Invalid value")
    return JSONResponse({"error": "Please check the form.", "fields": fields}, status_code=400)


# Keep every error in the same {"error": "..."} shape the frontend expects.
@app.exception_handler(StarletteHTTPException)
async def http_error(_req: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)
