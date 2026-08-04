"""Pure tests for the LLM provider switch (scripts/llm.py). No network/subprocess."""
import pytest

import llm


class TestProviderSelection:
    def test_defaults_to_gateway(self, monkeypatch):
        monkeypatch.delenv("LLM_PROVIDER", raising=False)
        assert llm.provider() == "gateway"

    def test_claude_cli(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "claude-cli")
        assert llm.provider() == "claude-cli"

    def test_unknown_provider_exits(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "openai")
        with pytest.raises(SystemExit):
            llm.provider()


class TestAvailability:
    def test_gateway_needs_key(self, monkeypatch):
        monkeypatch.delenv("LLM_PROVIDER", raising=False)
        monkeypatch.delenv("AI_GATEWAY_API_KEY", raising=False)
        assert llm.llm_available() is False
        monkeypatch.setenv("AI_GATEWAY_API_KEY", "k")
        assert llm.llm_available() is True

    def test_claude_cli_always_available(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "claude-cli")
        monkeypatch.delenv("AI_GATEWAY_API_KEY", raising=False)
        assert llm.llm_available() is True

    def test_require_key_exits_for_gateway(self, monkeypatch):
        monkeypatch.delenv("LLM_PROVIDER", raising=False)
        monkeypatch.delenv("AI_GATEWAY_API_KEY", raising=False)
        with pytest.raises(SystemExit):
            llm.require_llm_key()

    def test_require_key_optional_for_claude_cli(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "claude-cli")
        monkeypatch.delenv("AI_GATEWAY_API_KEY", raising=False)
        assert llm.require_llm_key() == ""


class TestModelMapping:
    def test_strips_gateway_prefix(self):
        assert llm.cli_model_id("anthropic/claude-sonnet-4-6") == "claude-sonnet-4-6"
        assert llm.cli_model_id("anthropic/claude-opus-4-8") == "claude-opus-4-8"

    def test_bare_id_passes_through(self):
        assert llm.cli_model_id("claude-sonnet-4-6") == "claude-sonnet-4-6"

    def test_cli_args_shape(self):
        args = llm.claude_cli_args("anthropic/claude-opus-4-8", "SYSTEM")
        assert args[0] == "claude"
        assert "-p" in args
        assert args[args.index("--model") + 1] == "claude-opus-4-8"
        assert args[args.index("--system-prompt") + 1] == "SYSTEM"
        assert args[args.index("--output-format") + 1] == "text"


class TestFallback:
    def test_cli_failure_falls_back_to_gateway_when_key_present(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "claude-cli")
        calls = []

        def boom(**kwargs):
            raise RuntimeError("cli broke")

        def fake_gateway(api_key, **kwargs):
            calls.append(api_key)
            return "from gateway"

        monkeypatch.setattr(llm, "_call_claude_cli", boom)
        monkeypatch.setattr(llm, "_call_gateway", fake_gateway)
        out = llm.call_llm("key", system="s", user="u", model="m", max_tokens=10)
        assert out == "from gateway"
        assert calls == ["key"]

    def test_cli_failure_raises_without_key(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "claude-cli")
        monkeypatch.setattr(
            llm, "_call_claude_cli", lambda **k: (_ for _ in ()).throw(RuntimeError("x"))
        )
        with pytest.raises(RuntimeError):
            llm.call_llm("", system="s", user="u", model="m", max_tokens=10)

    def test_gateway_provider_never_touches_cli(self, monkeypatch):
        monkeypatch.delenv("LLM_PROVIDER", raising=False)

        def fail(**kwargs):
            raise AssertionError("cli should not be called")

        monkeypatch.setattr(llm, "_call_claude_cli", fail)
        monkeypatch.setattr(llm, "_call_gateway", lambda api_key, **k: "ok")
        assert llm.call_llm("key", system="s", user="u", model="m", max_tokens=10) == "ok"
