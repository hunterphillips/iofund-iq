---
name: iofund-fetch
description: Fetch premium io-fund.com articles using credentials from the project's .env file. Authenticates against Firebase (the flow the browser uses), caches the token to /tmp until it expires, and prints cleaned article text to stdout. Use this whenever an io-fund.com URL is given and WebFetch returns 401.
---

# iofund-fetch — Authenticated io-fund.com Article Fetcher

## When to use

Whenever the user asks you to read an `io-fund.com/premium/...` URL (or any io-fund page that returns 401 to anonymous WebFetch), run this skill instead of asking the user to paste cookies.

## Requirements

The project's `.env` (auto-discovered by walking up from `cwd`) must contain:

```
IO_FUND_USERNAME=...
IO_FUND_PASSWORD=...
```

## Usage

```bash
# Cleaned text to stdout, auth/log info to stderr
python3 .Codex/skills/iofund-fetch/fetch.py <url>

# Raw HTML (no text cleanup)
python3 .Codex/skills/iofund-fetch/fetch.py <url> --raw

# Force re-login (ignore cached token)
python3 .Codex/skills/iofund-fetch/fetch.py <url> --force-login

# Sanity check the auth flow without fetching
python3 .Codex/skills/iofund-fetch/fetch.py --refresh-only
```

Pipe to `head`, redirect to a file, or chain into other tools as needed.

## How it works

1. POSTs to Firebase Identity Toolkit `signInWithPassword` with the project's API key (extracted from the site's JS bundle).
2. Stores `{idToken, refreshToken, expiresAt}` at `/tmp/iofund_token.json` (chmod 600).
3. On the next run, reuses the cached `idToken` if still valid; otherwise calls Firebase's `securetoken` refresh endpoint, falling back to a full sign-in if refresh fails.
4. Sends the `idToken` as the `io_fund_session_token` cookie (this is exactly what the site's client-side JS does).
5. Strips `<script>`/`<style>`/`<nav>`/`<footer>` and converts block tags to newlines for a clean read.

No third-party dependencies — pure stdlib.

## Cache

- Path: `/tmp/iofund_token.json`
- TTL: ~1 hour (matches Firebase idToken lifetime; refreshed automatically)
- Delete it if you suspect a bad cached state: `rm /tmp/iofund_token.json`

## Limitations

- Article body only — embedded charts/images are not exported.
- If io-fund rotates their Firebase API key, update the `FIREBASE_API_KEY` constant at the top of `fetch.py` (grep the site's `_next/static/chunks/pages/_app-*.js` for `AIza`).
