# 第七章：HelloAgents 框架与环境搭建

源码：[my_llm.py](../code/chapter7/my_llm.py)、[my_main.py](../code/chapter7/my_main.py)、[.env.example](../code/chapter7/.env.example)

## 学习目标

理解 HelloAgents 框架的定位与「统一配置」设计：一套 `LLM_*` 环境变量如何适配任意 OpenAI 兼容厂商；框架默认开启哪些运行时功能（Trace、会话、Skills）；以及如何通过继承 `HelloAgentsLLM` 插入自定义 provider。

## 本章结构

前六章的代码要么手写控制流（chapter4），要么借第三方框架（chapter6）。从本章起改用教材配套框架 `hello-agents`，全部示例围绕一个动作展开：**继承框架基类，重写关键方法**。

```text
hello-agents 包（pip 安装）
-> LLM 层：  MyLLM(HelloAgentsLLM)        重写 provider 选择
-> 工具层：  my_calculator / advanced_search 注册进 ToolRegistry
-> Agent 层：四个范式 Agent 继承框架基类重写 run()
```

## 框架安装

```powershell
# 在 code/ 目录的 venv 中
pip install hello-agents    # 当前 PyPI 版本 1.0.0
```

安装会带入 openai、pydantic、tavily-python 等约 140 个间接依赖。注意两点：

- `hello-agents` 要求 `openai<2.0.0`，若环境里已装 openai 3.x 会被降级（`requirements.txt` 已如实标注约束）。
- venv 与 chapter 目录分离：`code/.venv` 是全章共享的，新建 venv 后需要重新安装。

## 统一配置：LLM_* 环境变量

框架不读各厂商专用变量（`OPENAI_API_KEY` 等），而是用一组**与厂商无关的统一变量**，配合 OpenAI 兼容协议 + base_url 自动识别 provider：

| 变量 | 含义 | 本章取值 |
| --- | --- | --- |
| `LLM_MODEL_ID` | 模型名 | `deepseek-chat` |
| `LLM_API_KEY` | 密钥 | DeepSeek 密钥 |
| `LLM_BASE_URL` | 服务地址 | `https://api.deepseek.com` |
| `LLM_TIMEOUT` | 超时秒数 | `60` |

这套设计的含义：**换厂商 = 换三个环境变量，代码零改动**。任何 OpenAI 兼容服务（DeepSeek、ModelScope、Moonshot…）都走同一个 `HelloAgentsLLM` 类。

真实密钥放在 `chapter7/.env`（已被 `.gitignore` 全局规则忽略），`.env.example` 只留占位模板。

另注意一个易错点：DeepSeek 官方模型名只有 `deepseek-chat` 和 `deepseek-reasoner`，不存在 `deepseek-flash` 这类别名——模型名写错会在调用时报 400/bad request，而不是配置时报错。

## Config 默认功能与运行时目录

`Config` 类默认开启一批「生产级」能力，运行任何示例后会在**工作目录**下自动创建：

```text
memory/traces/    trace_enabled=True   每次运行的调用轨迹（jsonl + html 可视化）
memory/sessions/  session_enabled=True 会话持久化（未自动保存时为空）
memory/todos/     todowrite_enabled    TodoWrite 工具的持久化任务列表
memory/devlogs/   devlog_enabled       DevLog 工具的开发日志
skills/           skills_enabled=True  Skill 知识外化目录（无 skill 时为空）
tool-output/      tool_output_dir      超长工具输出（>2000 行或 >50KB）的完整落盘处
```

这些目录不是垃圾，是框架可观测性/持久化功能的工作产物；其中 `traces/` 下的文件与每次测试一一对应，排查 Agent 行为时可直接打开 html 看每步的 prompt 和响应。若不想要，可构造 `Config(trace_enabled=False, ...)` 逐项关闭。`Config` 里还有熔断器、上下文压缩、子代理、流式输出等默认配置，本章示例均未显式使用。

同时，Agent 基类会向传入的 `ToolRegistry` **自动注册**四个内置工具：`Skill`、`Task`、`TodoWrite`、`DevLog`。所以测试输出里的工具列表比你注册的多，属于预期行为。

## MyLLM：插入自定义 provider

[my_llm.py](../code/chapter7/my_llm.py) 的教学点是「框架留的口子不够用时，用子类补」：

```text
MyLLM.__init__(provider=...)
-> provider == "modelscope"：走自己写的分支
     读 MODELSCOPE_API_KEY，固定 base_url 为 ModelScope 端点，
     自己 new 一个 OpenAI 客户端塞进 self._client
-> 其他情况：super().__init__(...) 全权交给父类
     父类读 LLM_* 统一配置并自动检测 provider
```

自定义分支只做一件事：把 ModelScope 的凭证解析逻辑替换进去，客户端本体仍是 OpenAI SDK（因为 ModelScope 兼容 OpenAI 协议）。`think()`、`invoke()` 等方法完全继承，无需重写。

## my_main：密钥缺失时的降级策略

原书 `my_main.py` 写死 `MyLLM(provider="modelscope")`，在没有 ModelScope 密钥的环境直接抛 `ValueError`。修正后按环境变量自适应：

```text
检测到 MODELSCOPE_API_KEY -> MyLLM(provider="modelscope")   走自定义分支
否则                      -> MyLLM()                        回落父类统一配置（DeepSeek）
```

原则：**示例代码对环境的依赖应当显式检测并给出降级路径，而不是假设用户配齐了所有密钥。**

## 运行方式

```powershell
cd notes/30-resources/tools/hello-agents/code/chapter7
..\.venv\Scripts\Activate.ps1        # 激活共享 venv（若未激活）
python -X utf8 .\my_main.py          # -X utf8 规避 Windows GBK 控制台打印 emoji 崩溃
```

## 我的理解

HelloAgents 这一章给我的最大感受是「配置的收敛」：chapter4 里每个 demo 都要自己写一遍 OpenAI 客户端和读环境变量的样板，框架把这些收进 `HelloAgentsLLM` + 统一 `LLM_*` 之后，业务代码只剩提示词和流程控制。而 `MyLLM` 示范了框架设计的边界感——统一配置覆盖 95% 的场景，剩下 5%（特殊 provider 的凭证解析）用继承插入，不必 fork 框架。

需要留心的是默认全开的功能（Trace、内置工具注册）会悄悄改变运行产物和工具列表，读输出时别把它们当成 bug。

## 参考

- 同章笔记：[工具层重写](chapter7-tools-rewrite.md)、[四种 Agent 范式重写](chapter7-agent-paradigms-rewrite.md)、[1.0.0 兼容踩坑录](chapter7-v1.0.0-compat-pitfalls.md)
- 框架源码：`.venv/Lib/site-packages/hello_agents/`（core/config.py、core/llm.py、agents/）
