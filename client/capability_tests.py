"""Predefined capability test cases for local LLMs.

Each test has a *name*, a *prompt*, and an optional *category*.  The
:class:`CapabilityTester` class runs all tests against a chosen model and
collects the results.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from .ollama_client import OllamaClient


@dataclass
class TestCase:
    """A single capability test."""

    name: str
    prompt: str
    category: str = "general"
    system: Optional[str] = None


@dataclass
class TestResult:
    """Result of running a single :class:`TestCase`."""

    test: TestCase
    response: str = ""
    error: Optional[str] = None
    duration_seconds: float = 0.0

    @property
    def passed(self) -> bool:
        """A test is considered *passed* if it produced a non-empty response."""
        return bool(self.response) and self.error is None


# ---------------------------------------------------------------------------
# Built-in test cases
# ---------------------------------------------------------------------------

DEFAULT_TESTS: List[TestCase] = [
    # --- Reasoning ---
    TestCase(
        name="逻辑推理",
        category="reasoning",
        prompt=(
            "小明有5个苹果，他给了小红2个，又从商店买了3个。"
            "请问小明现在有几个苹果？请一步步推理。"
        ),
    ),
    TestCase(
        name="因果分析",
        category="reasoning",
        prompt="为什么天空是蓝色的？请用简洁的语言解释。",
    ),
    # --- Math ---
    TestCase(
        name="基础数学",
        category="math",
        prompt="计算：(123 × 456) − 1000 = ？只给出最终数字答案。",
    ),
    TestCase(
        name="应用数学",
        category="math",
        prompt=(
            "一辆汽车以60公里/小时的速度行驶，"
            "需要2.5小时到达目的地，请问路程是多少公里？"
        ),
    ),
    # --- Coding ---
    TestCase(
        name="Python代码生成",
        category="coding",
        prompt=(
            "用Python写一个函数，接收一个整数列表，"
            "返回列表中所有偶数的平方和。"
            "只返回代码，不需要解释。"
        ),
    ),
    TestCase(
        name="代码调试",
        category="coding",
        prompt=(
            "下面的Python代码有bug，请找出并修复：\n\n"
            "```python\n"
            "def fibonacci(n):\n"
            "    if n <= 0:\n"
            "        return []\n"
            "    elif n == 1:\n"
            "        return [0]\n"
            "    seq = [0, 1]\n"
            "    for i in range(2, n):\n"
            "        seq.append(seq[i-1] + seq[i-2])\n"  # noqa: E501
            "    return seq\n\n"
            "print(fibonacci(5))  # 期望输出: [0, 1, 1, 2, 3]\n"
            "```\n"
            "只返回修复后的代码。"
        ),
    ),
    # --- Language understanding ---
    TestCase(
        name="文本摘要",
        category="language",
        prompt=(
            "请用不超过50个字总结以下内容：\n\n"
            "人工智能（AI）是指由计算机系统展示的智能，与人类和动物展示的自然智能形成对比。"
            "AI研究被定义为研究'智能代理'的领域，即感知环境并采取行动以最大化实现其目标的"
            "机会的任何设备。术语'人工智能'通常用于描述模仿与人类心智相关的'认知'功能的机器，"
            "例如'学习'和'问题解决'。"
        ),
    ),
    TestCase(
        name="情感分析",
        category="language",
        prompt=(
            "判断以下句子的情感倾向（正面/负面/中性），只回答一个词：\n\n"
            "\"这家餐厅的食物味道一般，服务态度也不太好，但价格还算合理。\""
        ),
    ),
    # --- Instruction following ---
    TestCase(
        name="指令遵循",
        category="instruction",
        prompt=(
            "用以下格式回答：名字：[你的名字]，类型：[AI/人类]\n\n"
            "你是谁？"
        ),
    ),
    TestCase(
        name="角色扮演",
        category="instruction",
        system="你是一位专业的营养师，请以专业但通俗易懂的方式回答问题。",
        prompt="每天应该喝多少水？",
    ),
]


class CapabilityTester:
    """Runs capability tests against a local LLM via :class:`OllamaClient`.

    Args:
        client: An :class:`OllamaClient` instance.
        model: The Ollama model name to test.
        tests: List of :class:`TestCase` objects.  Defaults to
            :data:`DEFAULT_TESTS`.
    """

    def __init__(
        self,
        client: OllamaClient,
        model: str,
        tests: Optional[List[TestCase]] = None,
    ) -> None:
        self.client = client
        self.model = model
        self.tests: List[TestCase] = tests if tests is not None else DEFAULT_TESTS

    def run_single(self, test: TestCase) -> TestResult:
        """Run a single test and return its :class:`TestResult`."""
        import time

        start = time.monotonic()
        try:
            response = self.client.generate(
                model=self.model,
                prompt=test.prompt,
                system=test.system,
                stream=False,
            )
            duration = time.monotonic() - start
            return TestResult(test=test, response=response, duration_seconds=duration)
        except Exception as exc:  # noqa: BLE001
            duration = time.monotonic() - start
            return TestResult(
                test=test,
                error=str(exc),
                duration_seconds=duration,
            )

    def run_all(self) -> List[TestResult]:
        """Run all test cases and return a list of :class:`TestResult` objects."""
        return [self.run_single(t) for t in self.tests]

    def run_category(self, category: str) -> List[TestResult]:
        """Run tests belonging to *category* only."""
        subset = [t for t in self.tests if t.category == category]
        return [self.run_single(t) for t in subset]

    @property
    def categories(self) -> List[str]:
        """Return a sorted list of unique category names."""
        return sorted({t.category for t in self.tests})
