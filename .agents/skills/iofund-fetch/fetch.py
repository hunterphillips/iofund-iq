#!/usr/bin/env python3
"""Fetch an io-fund.com premium article using credentials from .env.

Auths against Firebase Identity Toolkit (the same flow the browser uses),
caches the idToken to /tmp until it expires, and prints cleaned article
text to stdout. JSON metadata goes to stderr.

Usage:
    fetch.py <url>            # cleaned text to stdout
    fetch.py <url> --raw      # raw HTML to stdout
    fetch.py --refresh-only   # force re-auth, print token info, no fetch
"""
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from html.parser import HTMLParser
from pathlib import Path

FIREBASE_API_KEY = "AIzaSyBbWVb0wkR8tHpNezOqdU49hpgjjzzU6k0"
SIGNIN_URL = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
REFRESH_URL = f"https://securetoken.googleapis.com/v1/token?key={FIREBASE_API_KEY}"
TOKEN_CACHE = Path("/tmp/iofund_token.json")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"


def log(msg):
    print(msg, file=sys.stderr)


def find_env_file(start: Path) -> Path | None:
    for d in [start, *start.parents]:
        candidate = d / ".env"
        if candidate.is_file():
            return candidate
    return None


def load_env() -> tuple[str, str]:
    env_path = find_env_file(Path.cwd()) or find_env_file(Path(__file__).resolve().parent)
    if not env_path:
        sys.exit("ERROR: no .env file found (need IO_FUND_USERNAME / IO_FUND_PASSWORD)")
    env = {}
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    user = env.get("IO_FUND_USERNAME") or os.environ.get("IO_FUND_USERNAME")
    pw = env.get("IO_FUND_PASSWORD") or os.environ.get("IO_FUND_PASSWORD")
    if not user or not pw:
        sys.exit(f"ERROR: IO_FUND_USERNAME/IO_FUND_PASSWORD not set in {env_path}")
    return user, pw


def http_json(url: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        sys.exit(f"ERROR: {url} returned {e.code}: {body}")


def sign_in(email: str, password: str) -> dict:
    log("auth: signInWithPassword")
    data = http_json(SIGNIN_URL, {"email": email, "password": password, "returnSecureToken": True})
    return {
        "idToken": data["idToken"],
        "refreshToken": data["refreshToken"],
        "expiresAt": int(time.time()) + int(data["expiresIn"]) - 60,
    }


def refresh(refresh_token: str) -> dict | None:
    log("auth: refreshing token")
    try:
        data = http_json(REFRESH_URL, {"grant_type": "refresh_token", "refresh_token": refresh_token})
    except SystemExit:
        return None
    return {
        "idToken": data["id_token"],
        "refreshToken": data["refresh_token"],
        "expiresAt": int(time.time()) + int(data["expires_in"]) - 60,
    }


def get_token(force: bool = False) -> dict:
    if not force and TOKEN_CACHE.exists():
        try:
            cached = json.loads(TOKEN_CACHE.read_text())
            if cached.get("expiresAt", 0) > time.time():
                log(f"auth: cached token valid for {cached['expiresAt'] - int(time.time())}s")
                return cached
            log("auth: cached token expired, refreshing")
            refreshed = refresh(cached["refreshToken"])
            if refreshed:
                TOKEN_CACHE.write_text(json.dumps(refreshed))
                TOKEN_CACHE.chmod(0o600)
                return refreshed
        except (json.JSONDecodeError, KeyError):
            pass
    user, pw = load_env()
    tok = sign_in(user, pw)
    TOKEN_CACHE.write_text(json.dumps(tok))
    TOKEN_CACHE.chmod(0o600)
    return tok


def fetch_url(url: str, token: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Cookie": f"io_fund_session_token={token}",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


class _Extractor(HTMLParser):
    BLOCK = {"p", "h1", "h2", "h3", "h4", "h5", "li", "br", "div", "tr"}
    DROP = {"script", "style", "nav", "footer", "header", "aside", "form", "noscript"}

    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.DROP:
            self.skip += 1
        if tag in self.BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self.DROP and self.skip:
            self.skip -= 1

    def handle_data(self, d):
        if not self.skip:
            self.parts.append(d)


def html_to_text(html: str) -> str:
    html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
    p = _Extractor()
    p.feed(html)
    text = "".join(p.parts)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def main():
    args = sys.argv[1:]
    raw = "--raw" in args
    refresh_only = "--refresh-only" in args
    force = "--force-login" in args
    urls = [a for a in args if not a.startswith("--")]

    if refresh_only:
        tok = get_token(force=force)
        log(f"token expires at {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(tok['expiresAt']))}")
        return

    if not urls:
        sys.exit("usage: fetch.py <url> [--raw] [--force-login]\n       fetch.py --refresh-only")

    tok = get_token(force=force)
    for url in urls:
        log(f"fetch: {url}")
        html = fetch_url(url, tok["idToken"])
        out = html if raw else html_to_text(html)
        print(out)


if __name__ == "__main__":
    main()
