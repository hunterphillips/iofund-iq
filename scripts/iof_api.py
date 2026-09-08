"""Shared client for I/O Fund's Firebase-authenticated member API."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

FIREBASE_API_KEY = os.environ.get(
    "IOF_FIREBASE_API_KEY", "AIzaSyD38rcRNteF-z4bsAZIfZdJYf0c3HfgbaY"
)
API_BASE = "https://io-fund.com/api/v1"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


class IofApiError(RuntimeError):
    """An authenticated member API request failed."""

    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message
        super().__init__(f"I/O Fund API returned {status}: {message}")


def load_dotenv_if_present() -> None:
    """Load script, repo, and chat env files without overriding process env."""
    script_dir = Path(__file__).resolve().parent
    candidates = (
        script_dir / ".env",
        script_dir.parent / ".env",
        script_dir.parent / "chat" / ".env.local",
    )
    for env_path in candidates:
        if not env_path.is_file():
            continue
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(
                key.strip(), value.strip().strip('"').strip("'")
            )


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"ERROR: {name} is not set")
    return value


def _error_message(body: bytes, fallback: str) -> str:
    try:
        payload = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        text = body.decode("utf-8", errors="replace").strip()
        return text or fallback

    error = payload.get("error") if isinstance(payload, dict) else None
    if isinstance(error, dict):
        error = error.get("message") or error.get("error")
    message = error or (payload.get("message") if isinstance(payload, dict) else None)
    return str(message or fallback)


def sign_in(email: str, password: str) -> str:
    """Return a fresh Firebase idToken for bearer-only API requests."""
    api_key = os.environ.get("IOF_FIREBASE_API_KEY", FIREBASE_API_KEY)
    url = (
        "https://identitytoolkit.googleapis.com/v1/"
        f"accounts:signInWithPassword?key={api_key}"
    )
    req = urllib.request.Request(
        url,
        data=json.dumps(
            {"email": email, "password": password, "returnSecureToken": True}
        ).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            payload = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        message = _error_message(exc.read(), exc.reason or "sign-in failed")
        sys.exit(f"ERROR: Firebase sign-in failed ({exc.code}): {message}")
    except urllib.error.URLError as exc:
        sys.exit(f"ERROR: Firebase sign-in request failed: {exc.reason}")
    token = payload.get("idToken") if isinstance(payload, dict) else None
    if not token:
        sys.exit("ERROR: Firebase sign-in response did not include idToken")
    return token


def api_get(
    path: str,
    id_token: str,
    params: dict | None = None,
    timeout: int = 30,
) -> dict:
    """GET and decode one `/api/v1` JSON object using a Firebase bearer token."""
    if not path.startswith("/"):
        raise ValueError(f"API path must start with '/': {path!r}")
    url = f"{API_BASE}{path}"
    if params:
        url = f"{url}?{urllib.parse.urlencode(params, doseq=True)}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "application/json",
            "Authorization": f"Bearer {id_token}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        message = _error_message(exc.read(), exc.reason or "request failed")
        raise IofApiError(exc.code, message) from exc
    except urllib.error.URLError as exc:
        raise IofApiError(503, f"request failed: {exc.reason}") from exc
    except json.JSONDecodeError as exc:
        raise IofApiError(502, f"invalid JSON response from {path}") from exc
    if not isinstance(payload, dict):
        raise IofApiError(502, f"unexpected JSON shape from {path}")
    return payload
