# llm-test-client

用于测试选定的本地大模型能力和基础对话的命令行客户端工具。

## 功能

- **基础对话** – 与本地 LLM 进行多轮交互式对话
- **能力测试** – 通过预设题目测试模型在以下方面的能力：
  - 逻辑推理
  - 数学计算
  - 代码生成与调试
  - 文本理解（摘要、情感分析）
  - 指令遵循与角色扮演
- **模型切换** – 在运行中切换至任意本地可用模型

## 依赖

- [Ollama](https://ollama.ai) – 本地 LLM 运行时（需单独安装并运行）
- Python 3.9+

## 快速开始

### 1. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

### 2. 启动 Ollama 服务器

```bash
ollama serve
```

确保至少拉取了一个模型，例如：

```bash
ollama pull llama3
```

### 3. 运行客户端

```bash
python main.py
```

连接到非默认地址时：

```bash
python main.py --url http://192.168.1.100:11434
```

直接指定模型（跳过交互式选择）：

```bash
python main.py --model llama3
```

## 运行测试

```bash
python -m pytest tests/ -v
```

## 目录结构

```
llm-test-client/
├── main.py                  # CLI 入口
├── requirements.txt
├── client/
│   ├── __init__.py
│   ├── ollama_client.py     # Ollama HTTP API 客户端
│   └── capability_tests.py  # 预设能力测试用例与测试执行器
└── tests/
    └── test_client.py       # 单元测试
```