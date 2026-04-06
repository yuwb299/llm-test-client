"""Unit tests for the LLM Test Client.

These tests mock the HTTP layer so they can run without a real Ollama server.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from client.capability_tests import (
    CapabilityTester,
    TestCase,
    TestResult,
    DEFAULT_TESTS,
)
from client.ollama_client import OllamaClient


# ---------------------------------------------------------------------------
# OllamaClient tests
# ---------------------------------------------------------------------------


class TestOllamaClientListModels:
    def test_returns_model_list(self):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "models": [{"name": "llama3"}, {"name": "mistral"}]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("client.ollama_client.requests.get", return_value=mock_response) as mock_get:
            client = OllamaClient()
            models = client.list_models()

        mock_get.assert_called_once_with("http://localhost:11434/api/tags", timeout=120)
        assert models == [{"name": "llama3"}, {"name": "mistral"}]

    def test_empty_model_list(self):
        mock_response = MagicMock()
        mock_response.json.return_value = {"models": []}
        mock_response.raise_for_status = MagicMock()

        with patch("client.ollama_client.requests.get", return_value=mock_response):
            client = OllamaClient()
            models = client.list_models()

        assert models == []


class TestOllamaClientIsServerRunning:
    def test_server_running(self):
        mock_response = MagicMock()
        with patch("client.ollama_client.requests.get", return_value=mock_response):
            client = OllamaClient()
            assert client.is_server_running() is True

    def test_server_not_running_connection_error(self):
        import requests as req

        with patch(
            "client.ollama_client.requests.get",
            side_effect=req.exceptions.ConnectionError,
        ):
            client = OllamaClient()
            assert client.is_server_running() is False

    def test_server_not_running_timeout(self):
        import requests as req

        with patch(
            "client.ollama_client.requests.get",
            side_effect=req.exceptions.Timeout,
        ):
            client = OllamaClient()
            assert client.is_server_running() is False


class TestOllamaClientGenerate:
    def test_generate_non_stream(self):
        mock_response = MagicMock()
        mock_response.__enter__ = lambda s: s
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {"response": "Paris"}

        with patch("client.ollama_client.requests.post", return_value=mock_response):
            client = OllamaClient()
            result = client.generate(model="llama3", prompt="What is the capital of France?", stream=False)

        assert result == "Paris"

    def test_generate_with_system_prompt(self):
        mock_response = MagicMock()
        mock_response.__enter__ = lambda s: s
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {"response": "答案是42。"}

        with patch("client.ollama_client.requests.post", return_value=mock_response) as mock_post:
            client = OllamaClient()
            result = client.generate(
                model="llama3",
                prompt="生命的意义是什么？",
                system="你是一个哲学家。",
                stream=False,
            )

        call_kwargs = mock_post.call_args
        payload = call_kwargs[1]["json"]
        assert payload["system"] == "你是一个哲学家。"
        assert result == "答案是42。"

    def test_generate_stream(self):
        chunks = [
            json.dumps({"response": "Hello", "done": False}).encode(),
            json.dumps({"response": " world", "done": True}).encode(),
        ]
        mock_response = MagicMock()
        mock_response.__enter__ = lambda s: s
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_response.raise_for_status = MagicMock()
        mock_response.iter_lines.return_value = iter(chunks)

        with patch("client.ollama_client.requests.post", return_value=mock_response):
            client = OllamaClient()
            result = client.generate(model="llama3", prompt="Hi", stream=True)

        assert result == "Hello world"


class TestOllamaClientChat:
    def test_chat_stream_yields_chunks(self):
        chunks = [
            json.dumps({"message": {"role": "assistant", "content": "Hi"}, "done": False}).encode(),
            json.dumps({"message": {"role": "assistant", "content": " there"}, "done": True}).encode(),
        ]
        mock_response = MagicMock()
        mock_response.__enter__ = lambda s: s
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_response.raise_for_status = MagicMock()
        mock_response.iter_lines.return_value = iter(chunks)

        with patch("client.ollama_client.requests.post", return_value=mock_response):
            client = OllamaClient()
            messages = [{"role": "user", "content": "Hello"}]
            result = "".join(client.chat(model="llama3", messages=messages, stream=True))

        assert result == "Hi there"

    def test_chat_non_stream(self):
        mock_response = MagicMock()
        mock_response.__enter__ = lambda s: s
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "message": {"role": "assistant", "content": "你好！"}
        }

        with patch("client.ollama_client.requests.post", return_value=mock_response):
            client = OllamaClient()
            messages = [{"role": "user", "content": "你好"}]
            result = "".join(client.chat(model="llama3", messages=messages, stream=False))

        assert result == "你好！"

    def test_custom_base_url(self):
        mock_response = MagicMock()
        mock_response.json.return_value = {"models": [{"name": "phi3"}]}
        mock_response.raise_for_status = MagicMock()

        with patch("client.ollama_client.requests.get", return_value=mock_response) as mock_get:
            client = OllamaClient(base_url="http://192.168.1.100:11434")
            client.list_models()

        mock_get.assert_called_once_with(
            "http://192.168.1.100:11434/api/tags", timeout=120
        )


# ---------------------------------------------------------------------------
# TestCase & TestResult tests
# ---------------------------------------------------------------------------


class TestTestCase:
    def test_default_category(self):
        tc = TestCase(name="test", prompt="hello")
        assert tc.category == "general"
        assert tc.system is None

    def test_custom_category(self):
        tc = TestCase(name="math", prompt="1+1=?", category="math")
        assert tc.category == "math"


class TestTestResult:
    def test_passed_with_response(self):
        tc = TestCase(name="t", prompt="p")
        r = TestResult(test=tc, response="some answer")
        assert r.passed is True

    def test_failed_with_error(self):
        tc = TestCase(name="t", prompt="p")
        r = TestResult(test=tc, response="", error="Connection refused")
        assert r.passed is False

    def test_failed_empty_response(self):
        tc = TestCase(name="t", prompt="p")
        r = TestResult(test=tc, response="")
        assert r.passed is False


# ---------------------------------------------------------------------------
# CapabilityTester tests
# ---------------------------------------------------------------------------


class TestCapabilityTester:
    def _make_client(self, response_text: str = "OK") -> OllamaClient:
        """Return a mock OllamaClient whose generate() returns *response_text*."""
        mock_client = MagicMock(spec=OllamaClient)
        mock_client.generate.return_value = response_text
        return mock_client

    def test_run_single_success(self):
        client = self._make_client("答案是6个。")
        tester = CapabilityTester(client=client, model="llama3")
        result = tester.run_single(tester.tests[0])
        assert result.passed is True
        assert result.error is None

    def test_run_single_error(self):
        client = MagicMock(spec=OllamaClient)
        client.generate.side_effect = RuntimeError("timeout")
        tester = CapabilityTester(client=client, model="llama3")
        result = tester.run_single(tester.tests[0])
        assert result.passed is False
        assert "timeout" in result.error

    def test_run_all_returns_all_results(self):
        client = self._make_client("some response")
        tester = CapabilityTester(client=client, model="llama3")
        results = tester.run_all()
        assert len(results) == len(DEFAULT_TESTS)
        assert all(r.passed for r in results)

    def test_run_category(self):
        client = self._make_client("答案")
        tester = CapabilityTester(client=client, model="llama3")
        results = tester.run_category("math")
        math_tests = [t for t in DEFAULT_TESTS if t.category == "math"]
        assert len(results) == len(math_tests)

    def test_categories_property(self):
        client = self._make_client()
        tester = CapabilityTester(client=client, model="llama3")
        cats = tester.categories
        assert isinstance(cats, list)
        assert "math" in cats
        assert "coding" in cats
        assert "reasoning" in cats
        assert cats == sorted(cats)  # must be sorted

    def test_custom_tests(self):
        custom = [TestCase(name="custom", prompt="hello", category="custom")]
        client = self._make_client("hi")
        tester = CapabilityTester(client=client, model="llama3", tests=custom)
        assert tester.tests == custom
        results = tester.run_all()
        assert len(results) == 1

    def test_default_tests_not_empty(self):
        assert len(DEFAULT_TESTS) > 0
        for t in DEFAULT_TESTS:
            assert t.name
            assert t.prompt
            assert t.category
