"""Ollama API client for interacting with locally running LLM servers."""

from __future__ import annotations

import json
from typing import Generator, List, Optional

import requests


class OllamaClient:
    """Client for the Ollama local LLM server (https://ollama.ai).

    The Ollama server is assumed to be running at *base_url* (default:
    ``http://localhost:11434``).
    """

    def __init__(self, base_url: str = "http://localhost:11434", timeout: int = 120) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    # ------------------------------------------------------------------
    # Model management
    # ------------------------------------------------------------------

    def list_models(self) -> List[dict]:
        """Return a list of model objects available on the local Ollama server."""
        resp = requests.get(f"{self.base_url}/api/tags", timeout=self.timeout)
        resp.raise_for_status()
        return resp.json().get("models", [])

    def is_server_running(self) -> bool:
        """Return *True* if the Ollama server is reachable."""
        try:
            requests.get(f"{self.base_url}/api/tags", timeout=5)
            return True
        except requests.exceptions.ConnectionError:
            return False
        except requests.exceptions.Timeout:
            return False

    # ------------------------------------------------------------------
    # Chat
    # ------------------------------------------------------------------

    def chat(
        self,
        model: str,
        messages: List[dict],
        stream: bool = True,
    ) -> Generator[str, None, None]:
        """Send a chat request and yield response text chunks.

        Each yielded value is a *string* fragment of the assistant reply.
        When *stream* is ``False`` the full reply is yielded as a single
        string.

        Args:
            model: Ollama model name (e.g. ``"llama3"``).
            messages: Conversation history in OpenAI-style format::

                [{"role": "user", "content": "Hello"}]

            stream: If *True* (default), stream the reply incrementally.
        """
        payload = {"model": model, "messages": messages, "stream": stream}
        with requests.post(
            f"{self.base_url}/api/chat",
            json=payload,
            stream=stream,
            timeout=self.timeout,
        ) as resp:
            resp.raise_for_status()
            if stream:
                for line in resp.iter_lines():
                    if not line:
                        continue
                    data = json.loads(line)
                    content = data.get("message", {}).get("content", "")
                    if content:
                        yield content
                    if data.get("done"):
                        break
            else:
                data = resp.json()
                yield data.get("message", {}).get("content", "")

    def generate(
        self,
        model: str,
        prompt: str,
        system: Optional[str] = None,
        stream: bool = False,
    ) -> str:
        """Generate a single completion for *prompt* and return the full text.

        Args:
            model: Ollama model name.
            prompt: The user prompt.
            system: Optional system prompt.
            stream: If *True*, stream internally but still return the full
                assembled reply.
        """
        payload: dict = {"model": model, "prompt": prompt, "stream": stream}
        if system:
            payload["system"] = system

        with requests.post(
            f"{self.base_url}/api/generate",
            json=payload,
            stream=stream,
            timeout=self.timeout,
        ) as resp:
            resp.raise_for_status()
            if stream:
                parts: List[str] = []
                for line in resp.iter_lines():
                    if not line:
                        continue
                    data = json.loads(line)
                    parts.append(data.get("response", ""))
                    if data.get("done"):
                        break
                return "".join(parts)
            else:
                return resp.json().get("response", "")
