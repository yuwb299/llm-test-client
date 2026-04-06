#!/usr/bin/env python3
"""LLM Test Client – interactive CLI for testing local large language models.

Usage::

    python main.py                      # connect to default Ollama server
    python main.py --url http://host:11434

The tool connects to a locally running Ollama server, lets you pick a model,
then offers three modes:

1. **Chat** – interactive multi-turn conversation.
2. **Capability Test** – run a suite of predefined tests across categories
   (reasoning, math, coding, language understanding, instruction following).
3. **Quit** – exit the program.
"""

from __future__ import annotations

import argparse
import sys
import time
from typing import List

try:
    from rich.console import Console
    from rich.markdown import Markdown
    from rich.panel import Panel
    from rich.progress import Progress, SpinnerColumn, TextColumn
    from rich.prompt import Prompt
    from rich.table import Table

    RICH_AVAILABLE = True
except ImportError:  # pragma: no cover
    RICH_AVAILABLE = False

from client import CapabilityTester, OllamaClient
from client.capability_tests import TestResult

console = Console() if RICH_AVAILABLE else None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _print(text: str, style: str = "") -> None:
    if console:
        console.print(text, style=style)
    else:
        print(text)


def _input(prompt: str) -> str:
    if RICH_AVAILABLE and Prompt:
        return Prompt.ask(prompt)
    return input(f"{prompt}: ")


def _ask_choice(prompt: str, choices: List[str]) -> str:
    """Ask the user to enter a numbered choice and return the chosen string."""
    for i, choice in enumerate(choices, 1):
        _print(f"  [{i}] {choice}")
    while True:
        raw = _input(f"{prompt} (1-{len(choices)})")
        if raw.isdigit() and 1 <= int(raw) <= len(choices):
            return choices[int(raw) - 1]
        _print("[red]无效输入，请重新输入。[/red]" if console else "无效输入，请重新输入。")


# ---------------------------------------------------------------------------
# Model selection
# ---------------------------------------------------------------------------


def select_model(client: OllamaClient) -> str:
    """List available models and ask the user to choose one.

    Returns the selected model name.
    """
    _print("\n[bold cyan]正在获取本地模型列表…[/bold cyan]" if console else "\n正在获取本地模型列表…")
    models = client.list_models()
    if not models:
        _print(
            "[red]未发现任何模型。请先通过 `ollama pull <model>` 下载模型。[/red]"
            if console
            else "未发现任何模型。请先通过 `ollama pull <model>` 下载模型。"
        )
        sys.exit(1)

    names = [m["name"] for m in models]
    _print("\n[bold]可用模型：[/bold]" if console else "\n可用模型：")
    return _ask_choice("请选择模型", names)


# ---------------------------------------------------------------------------
# Chat mode
# ---------------------------------------------------------------------------


def run_chat(client: OllamaClient, model: str) -> None:
    """Run an interactive multi-turn chat session."""
    _print(
        f"\n[bold green]进入对话模式（模型：{model}）[/bold green]\n"
        "[dim]输入 /quit 或 /exit 返回主菜单，/clear 清空对话历史。[/dim]\n"
        if console
        else f"\n进入对话模式（模型：{model}）\n输入 /quit 或 /exit 返回主菜单，/clear 清空对话历史。\n"
    )

    messages: List[dict] = []

    while True:
        try:
            user_input = _input("[bold blue]你[/bold blue]" if console else "你")
        except (KeyboardInterrupt, EOFError):
            _print("\n[dim]返回主菜单…[/dim]" if console else "\n返回主菜单…")
            break

        user_input = user_input.strip()
        if not user_input:
            continue
        if user_input.lower() in ("/quit", "/exit"):
            break
        if user_input.lower() == "/clear":
            messages.clear()
            _print("[dim]对话历史已清空。[/dim]" if console else "对话历史已清空。")
            continue

        messages.append({"role": "user", "content": user_input})

        _print("\n[bold yellow]助手[/bold yellow]：" if console else "\n助手：", end="")

        reply_parts: List[str] = []
        try:
            for chunk in client.chat(model=model, messages=messages, stream=True):
                reply_parts.append(chunk)
                print(chunk, end="", flush=True)
        except Exception as exc:  # noqa: BLE001
            _print(
                f"\n[red]请求失败：{exc}[/red]" if console else f"\n请求失败：{exc}"
            )
            messages.pop()
            continue

        print()  # newline after streaming ends
        full_reply = "".join(reply_parts)
        messages.append({"role": "assistant", "content": full_reply})


# ---------------------------------------------------------------------------
# Capability test mode
# ---------------------------------------------------------------------------


def _render_results(results: List[TestResult]) -> None:
    """Pretty-print test results."""
    if console:
        table = Table(title="测试结果", show_lines=True)
        table.add_column("测试名称", style="cyan", no_wrap=True)
        table.add_column("类别", style="magenta")
        table.add_column("状态", justify="center")
        table.add_column("耗时 (s)", justify="right")
        table.add_column("回答摘要", max_width=60)

        for r in results:
            status = "[green]✓[/green]" if r.passed else "[red]✗[/red]"
            summary = (r.error or r.response or "").replace("\n", " ")
            if len(summary) > 100:
                summary = summary[:100] + "…"
            table.add_row(
                r.test.name,
                r.test.category,
                status,
                f"{r.duration_seconds:.1f}",
                summary,
            )

        console.print(table)

        passed = sum(1 for r in results if r.passed)
        console.print(
            f"\n[bold]通过：{passed}/{len(results)}[/bold]",
            style="green" if passed == len(results) else "yellow",
        )
    else:
        for r in results:
            status = "✓" if r.passed else "✗"
            print(
                f"{status} [{r.test.category}] {r.test.name} "
                f"({r.duration_seconds:.1f}s)"
            )
            if r.error:
                print(f"   错误: {r.error}")
            else:
                preview = r.response.replace("\n", " ")[:120]
                print(f"   回答: {preview}")
        passed = sum(1 for r in results if r.passed)
        print(f"\n通过：{passed}/{len(results)}")


def _show_detail(results: List[TestResult]) -> None:
    """Let the user browse full responses for each test."""
    names = [r.test.name for r in results]
    choice = _ask_choice("查看哪个测试的详细回答？（选 0 退出）", ["[返回]"] + names)
    if choice == "[返回]":
        return
    for r in results:
        if r.test.name == choice:
            if console:
                console.print(
                    Panel(
                        Markdown(r.response) if r.response else f"[red]{r.error}[/red]",
                        title=f"[cyan]{r.test.name}[/cyan]",
                        subtitle=f"耗时 {r.duration_seconds:.1f}s",
                    )
                )
            else:
                print(f"\n=== {r.test.name} ===")
                print(r.response or r.error)
            break


def run_capability_test(client: OllamaClient, model: str) -> None:
    """Run the capability test suite for *model*."""
    tester = CapabilityTester(client=client, model=model)

    _print(
        "\n[bold]选择测试范围：[/bold]" if console else "\n选择测试范围："
    )
    scope_options = ["全部测试"] + tester.categories
    scope = _ask_choice("测试范围", scope_options)

    if scope == "全部测试":
        tests_to_run = tester.tests
    else:
        tests_to_run = [t for t in tester.tests if t.category == scope]

    _print(
        f"\n[bold cyan]开始运行 {len(tests_to_run)} 项测试（模型：{model}）…[/bold cyan]\n"
        if console
        else f"\n开始运行 {len(tests_to_run)} 项测试（模型：{model}）…\n"
    )

    results: List[TestResult] = []
    for test in tests_to_run:
        _print(f"  ▶ [dim]{test.name}[/dim]" if console else f"  ▶ {test.name}", end="  ")
        start = time.monotonic()
        result = tester.run_single(test)
        elapsed = time.monotonic() - start
        status = "[green]OK[/green]" if result.passed else "[red]FAIL[/red]"
        _print(f"{status} [dim]({elapsed:.1f}s)[/dim]" if console else f"{'OK' if result.passed else 'FAIL'} ({elapsed:.1f}s)")
        results.append(result)

    _print("")
    _render_results(results)

    while True:
        view = _input("\n查看详细回答？[y/N]")
        if view.lower() in ("y", "yes", "是"):
            _show_detail(results)
        else:
            break


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def main(argv: List[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="LLM Test Client – 测试本地大模型能力与基础对话"
    )
    parser.add_argument(
        "--url",
        default="http://localhost:11434",
        help="Ollama 服务器地址 (默认: http://localhost:11434)",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="直接指定模型名称，跳过选择步骤",
    )
    args = parser.parse_args(argv)

    if console:
        console.print(
            Panel.fit(
                "[bold cyan]LLM Test Client[/bold cyan]\n"
                "[dim]本地大模型能力测试与基础对话工具[/dim]",
                border_style="cyan",
            )
        )
    else:
        print("=" * 40)
        print("LLM Test Client")
        print("本地大模型能力测试与基础对话工具")
        print("=" * 40)

    client = OllamaClient(base_url=args.url)

    _print(
        f"\n[dim]连接 Ollama 服务器：{args.url}[/dim]" if console else f"\n连接 Ollama 服务器：{args.url}"
    )
    if not client.is_server_running():
        _print(
            "[red]无法连接到 Ollama 服务器。请确认 Ollama 已启动并监听正确地址。[/red]"
            "\n[dim]启动方法：运行 `ollama serve`[/dim]"
            if console
            else "无法连接到 Ollama 服务器。请确认 Ollama 已启动并监听正确地址。\n启动方法：运行 `ollama serve`"
        )
        sys.exit(1)

    model = args.model or select_model(client)
    _print(
        f"\n[bold green]已选择模型：{model}[/bold green]" if console else f"\n已选择模型：{model}"
    )

    while True:
        _print("\n[bold]请选择功能：[/bold]" if console else "\n请选择功能：")
        try:
            choice = _ask_choice("功能", ["💬 基础对话", "🧪 能力测试", "🔄 切换模型", "🚪 退出"])
        except (KeyboardInterrupt, EOFError):
            _print("\n[dim]再见！[/dim]" if console else "\n再见！")
            break

        if "对话" in choice:
            run_chat(client, model)
        elif "能力" in choice:
            run_capability_test(client, model)
        elif "切换" in choice:
            model = select_model(client)
            _print(
                f"\n[bold green]已切换模型：{model}[/bold green]"
                if console
                else f"\n已切换模型：{model}"
            )
        else:
            _print("[dim]再见！[/dim]" if console else "再见！")
            break


if __name__ == "__main__":
    main()
