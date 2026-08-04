"""Shared LLM caller for the cron scripts.

Two providers, selected by the LLM_PROVIDER env var:

    gateway     (default) POST to the Vercel AI Gateway with AI_GATEWAY_API_KEY.
    claude-cli  Run headless Claude Code (`claude -p`). In GitHub Actions this
                authenticates via CLAUDE_CODE_OAUTH_TOKEN (minted once with
                `claude setup-token`), so generation draws on the operator's
                Claude subscription instead of prepaid API credits. Any CLI
                failure falls back to the gateway when a key is available, so
                a broken CLI never breaks a cron harder than today.

The CLI path runs from a temp directory so headless Claude Code doesn't pick
up this repo's CLAUDE.md as project context, and ignores max_tokens and
temperature (not supported by the CLI; the prompts constrain length).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

AI_GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions"
PROVIDERS = ("gateway", "claude-cli")
CLI_TIMEOUT_SECONDS = 600


def _log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def provider() -> str:
    value = os.environ.get("LLM_PROVIDER", "gateway")
    if value not in PROVIDERS:
        sys.exit(f"ERROR: LLM_PROVIDER must be one of {PROVIDERS}, got {value!r}")
    return value


def llm_available() -> bool:
    """True when some provider can serve a call (used to gate optional LLM steps)."""
    if provider() == "claude-cli":
        return True
    return bool(os.environ.get("AI_GATEWAY_API_KEY"))


def require_llm_key() -> str:
    """Resolve the gateway key according to the active provider.

    gateway: the key is mandatory (exit if missing). claude-cli: the key is
    optional and only used as a fallback path — returns "" when unset.
    """
    key = os.environ.get("AI_GATEWAY_API_KEY", "")
    if provider() == "gateway" and not key:
        sys.exit("ERROR: AI_GATEWAY_API_KEY is not set (LLM_PROVIDER=gateway)")
    return key


def cli_model_id(model: str) -> str:
    """Gateway model ids carry a provider prefix ('anthropic/claude-x'); the CLI doesn't."""
    return model.split("/", 1)[1] if model.startswith("anthropic/") else model


def claude_cli_args(model: str, system: str) -> list[str]:
    return [
        "claude",
        "-p",
        "--model",
        cli_model_id(model),
        "--system-prompt",
        system,
        "--output-format",
        "text",
    ]


def _call_claude_cli(*, system: str, user: str, model: str) -> str:
    result = subprocess.run(
        claude_cli_args(model, system),
        input=user,
        capture_output=True,
        text=True,
        timeout=CLI_TIMEOUT_SECONDS,
        cwd=tempfile.gettempdir(),
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"claude -p exited {result.returncode}: {result.stderr.strip()[:500]}"
        )
    out = result.stdout.strip()
    if not out:
        raise RuntimeError("claude -p returned empty output")
    return out


def _call_gateway(
    api_key: str,
    *,
    system: str,
    user: str,
    model: str,
    max_tokens: int,
    temperature: float,
) -> str:
    payload = {
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    req = urllib.request.Request(
        AI_GATEWAY_URL,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            body = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise RuntimeError(f"AI Gateway {e.code}: {detail}") from e
    return body["choices"][0]["message"]["content"]


def call_llm(
    api_key: str,
    *,
    system: str,
    user: str,
    model: str,
    max_tokens: int,
    temperature: float = 0.3,
) -> str:
    """Route a single system+user completion through the configured provider."""
    if provider() == "claude-cli":
        try:
            return _call_claude_cli(system=system, user=user, model=model)
        except Exception as e:  # CLI missing, auth expired, timeout, empty output
            if not api_key:
                raise
            _log(f"llm: claude-cli failed ({e}); falling back to gateway")
    return _call_gateway(
        api_key,
        system=system,
        user=user,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
    )
