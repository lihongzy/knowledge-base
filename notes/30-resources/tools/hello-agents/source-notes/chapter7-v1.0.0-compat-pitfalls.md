# 第七章：hello-agents 1.0.0 兼容性踩坑录

源码：本章全部 `my_*.py` 的修复记录；相关笔记见[框架与环境](chapter7-helloagents-framework-setup.md)、[工具层重写](chapter7-tools-rewrite.md)、[Agent 范式重写](chapter7-agent-paradigms-rewrite.md)

## 学习目标

沉淀 chapter7 示例在 **hello-agents 1.0.0 + Windows + DeepSeek** 环境下跑通过程中遇到的全部坑。每条按「现象 → 根因 → 修复 → 教训」记录，供后续章节和同类框架升级时排查参考。

这些坑的共性根源：**教材示例代码的编写时间早于（或不晚于）PyPI 发布版 1.0.0，API 在两者之间发生了演进**，而 GitHub 上游仓库本身还有文件残缺。跑教材代码跑不通，先怀疑版本差异，再怀疑自己。

## 1. invoke() 返回 LLMResponse 对象，不再是字符串

- **现象**：`test_simple_agent.py` 初始化 Agent 成功后，调用时抛 `pydantic.ValidationError: content Input should be a valid string … input_type=LLMResponse`，报错点在 `Message(response, "assistant")`。
- **根因**：旧版 `llm.invoke()` 直接返回字符串；1.0.0 返回结构化的 `LLMResponse`（含 content/model/usage 等），示例代码把整个对象塞进了只收字符串的 `Message`。
- **修复**：所有 `self.llm.invoke(messages, **kwargs)` 取文本处改为 `….content`——`my_simple_agent.py` 三处、`my_react_agent.py` 一处，`my_reflection_agent.py`、`my_plan_solve_agent.py` 新建时即按新 API 编写。
- **教训**：把第三方库返回值塞进构造函数前，先 `print(type(x))` 确认；pydantic 的校验报错信息里 `input_type=` 直接告诉你实际类型，是定位此类问题的最快线索。

## 2. execute_tool() 返回 ToolResponse 对象

- **现象**：与第 1 条同族。ReAct 循环里把 `registry.execute_tool()` 的返回值直接拼进 history，日志中出现 `<hello_agents…ToolResponse object at 0x…>` 字样。
- **根因**：1.0.0 的 `execute_tool(name, input_text)` 返回 `ToolResponse` 对象，文本在 `.text` 属性。
- **修复**：`observation_text = getattr(observation, "text", None) or str(observation)`——取 `.text`，万一未来又改回字符串也能兜底。
- **教训**：框架的返回值对象化（str → Response 对象）是常见升级方向，所有「拿返回值拼提示词」的代码都要显式解包，别依赖 `str()` 的默认表示。

## 3. ReActAgent 基类变成了 Function Calling 实现，文本解析方法不存在

- **现象**：`test_react_agent.py` 四个测试全部抛 `'MyReActAgent' object has no attribute '_parse_output'`。
- **根因**：两层。其一，chapter7 仓库里的 `my_react_agent.py` 是个**被截断的残缺文件**——`run()` 调用了 `_parse_output/_parse_action/_parse_action_input`，但文件里根本没有这三个方法的定义。其二，指望从基类继承也不成立：1.0.0 的 `ReActAgent` 基类已重写为 Function Calling 实现（向 registry 注入 Thought/Finish 工具），不含任何文本解析方法。
- **修复**：在子类中补齐三个正则解析方法（Thought/Action 分段、`tool[input]` 拆分、Finish 取参），并在 `run()` 中为「模型没输出 Action」加兜底分支。
- **教训**：报 `no attribute` 时，把「调用方文件是否完整」也列入嫌疑——教材仓库的示例文件可能因编辑事故被截断，`git log` 或直接通读文件一眼可辨。

## 4. super().__init__ 位置传参错位：提示词被接到了注册表位子上

- **现象**：修完第 3 条后日志仍诡异：`可用工具数量: 0`（明明注册了 calculator），且工具列表里莫名多出 Skill/Task/TodoWrite/DevLog。
- **根因**：`ReActAgent.__init__` 的签名是 `(name, llm, tool_registry, system_prompt, config, max_steps)`——**第 3 参是 tool_registry**，而 `SimpleAgent` 等其他基类第 3 参是 system_prompt。原书代码沿用 `super().__init__(name, llm, system_prompt, config)` 的位置传参，导致 system_prompt 字符串被当成 tool_registry，基类见 registry 为 None 便自建了一个空的（还自动注册内置工具），自己存的 registry 又被子类覆盖——两边接错线。
- **修复**：全部改为关键字传参 `super().__init__(name=…, llm=…, tool_registry=…, system_prompt=…, …)`；并为文本版 ReAct 显式提供匹配的系统提示词（基类默认提示词面向 Function Calling 协议，与 Thought:/Action: 文本协议冲突）。
- **教训**：**跨类调用 `__init__` 永远用关键字参数**。位置传参在参数顺序不一致的兄弟基类之间是静默错误源——不抛异常，只是行为悄悄不对。同框架里 `Agent` 系与 `ReActAgent` 的签名并不统一，必须读基类源码确认。

## 5. 原书仓库缺失 my_reflection_agent.py 与 my_plan_solve_agent.py

- **现象**：`test_reflection_agent.py` 报 `ModuleNotFoundError: No module named 'my_reflection_agent'`。
- **根因**：不是本地丢失——GitHub 上游 `datawhalechina/hello-agents` 的 chapter7 目录里这两个实现文件**本来就没有**，只发布了测试脚本。
- **修复**：以测试脚本的构造签名和提示词占位符为接口契约，按本章重写风格补建两个实现（Reflection 用三阶段 custom_prompts，PlanSolve 用纯文本编号解析计划）。
- **教训**：测试即契约。补写实现前先通读 `test_*.py`，把构造参数、属性访问、期望输出格式全部列出来再动笔，可以让补建的实现与既有生态无缝对接。

## 6. 示例硬编码 provider，缺密钥直接崩

- **现象**：`python my_main.py` 抛 `ValueError: ModelScope API key not found`。
- **根因**：`my_main.py` 写死 `MyLLM(provider="modelscope")`，而环境只配了 DeepSeek 的统一 `LLM_*` 变量。
- **修复**：检测 `MODELSCOPE_API_KEY` 存在才走自定义分支，否则回落 `MyLLM()`（父类统一配置）。
- **教训**：与环境相关的示例入口应「显式探测 + 优雅降级」，而不是假设用户配齐所有密钥。

## 7. deepseek-flash 不是合法模型名

- **现象**：配置照抄参考 env 里的 `deepseek-flash` 后，调用报模型不存在。
- **根因**：DeepSeek API 只有 `deepseek-chat` 和 `deepseek-reasoner` 两个模型 ID，「flash」是杜撰的别名。
- **修复**：`LLM_MODEL_ID=deepseek-chat`。
- **教训**：模型名以官方 API 文档为准；此类错误在配置阶段无任何提示，只在第一次请求时暴露。

## 8. Windows GBK 控制台打印 emoji 崩溃

- **现象**：框架与示例大量使用 ✅🔧🤖 等 emoji，`python xxx.py` 中途抛 `UnicodeEncodeError: 'gbk' codec can't encode character '\u2705'`。
- **根因**：中文 Windows 控制台默认代码页 GBK，Python stdout 编码随它。
- **修复**：运行加 `python -X utf8`（或设 `PYTHONIOENCODING=utf-8`）。
- **教训**：跨平台示例在 Windows 上首跑，先解决编码再谈逻辑。

## 9. load_dotenv() 从脚本所在目录向上查找

- **现象**：把检查脚本放在别处运行，报 `HelloAgentsException: 必须提供模型名称`——明明 `.env` 里配了 `LLM_MODEL_ID`。
- **根因**：`load_dotenv()` 无参调用时从**脚本文件所在目录**（不是 cwd）逐级向上找 `.env`；脚本不在 chapter7 下自然什么都找不到。
- **修复**：跨目录脚本显式传路径 `load_dotenv(r'…\chapter7\.env')`。
- **教训**：`.env` 是否被加载，用 `print(os.getenv('LLM_MODEL_ID'))` 在 load 之后立刻验证，别等到 LLM 初始化报错才回头查。

## 10. requirements.txt 缺 hello-agents；openai 版本互相冲突

- **现象**：新环境按 `requirements.txt` 装完仍 `ModuleNotFoundError: No module named 'hello_agents'`；安装时 pip 报告 openai 被从 3.14.0 降到 1.109.1，且与 langchain-openai 冲突。
- **根因**：清单里漏了本章核心依赖 `hello-agents`；它约束 `openai<2.0.0`，而清单里 `langchain-openai>=0.3.0` 解析到的新版本要求 `openai>=2.45`。
- **修复**：清单补上 `hello-agents>=1.0.0`，`openai` 标注 `<2.0.0` 上限。chapter7 不用 langchain，冲突暂无实际影响。
- **教训**：venv 里 `pip check` 常能提前暴露这类问题；若后续章节确需同时使用两个生态，应拆分为独立 venv 而不是强行合并依赖。

## 修复顺序复盘

这些坑不是同时暴露的，实际调试链路是：**1 → 3 → 4**（simple/react 逐个报错逐个修）、**5**（reflection 首跑）、**6**（my_main 首跑）、**7-10**（环境搭建期）。规律：先修「跑不起来」（导入、构造），再修「跑偏了」（接错线、返回值类型），最后修「跑不好」（兜底、降级）。

## 我的理解

一整张坑表里最值钱的三条是 1、3、4，它们分别对应框架升级的三种典型断裂：**返回值对象化**（str → LLMResponse/ToolResponse）、**实现换代**（文本解析 → Function Calling，旧 hook 消失）、**签名漂移**（兄弟基类参数顺序不一致）。读一个不活跃维护的框架时，PyPI 版本与教材版本的 diff 比任何文档都可信——唯一可靠的核对方式是直接翻 `.venv/Lib/site-packages/hello_agents/` 里的实际源码。
