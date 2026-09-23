# 第七章：四种 Agent 范式的框架化重写

源码：[my_simple_agent.py](../code/chapter7/my_simple_agent.py)、[my_react_agent.py](../code/chapter7/my_react_agent.py)、[my_plan_solve_agent.py](../code/chapter7/my_plan_solve_agent.py)、[my_reflection_agent.py](../code/chapter7/my_reflection_agent.py)

## 学习目标

把[第四章手写的三种经典范式](chapter4-classic-agent-paradigms.md)迁移到 hello-agents 框架上，看清「重写一个框架 Agent」的通用套路；理解 SimpleAgent 的文本工具协议与 ReAct 协议的区别；掌握四个被重写方法之外的框架约定（`_history`、`add_message`、`invoke().content`）。

## 重写的通用骨架

四个 Agent 的重写方式高度同构，都遵循同一模板：

```text
class MyXxxAgent(框架基类):
    1. __init__：super().__init__(...) 接上框架，再存自己的参数
    2. 模块级提示词常量（含 {占位符}）
    3. 重写 run(input_text)：自己组织 提示词 -> invoke -> 解析 -> 循环
    4. 解析方法：正则从模型自由文本里抠出结构化意图
    5. 收尾：add_message() 写回历史，返回最终字符串
```

框架真正替你拿下的部分：LLM 客户端与配置（`HelloAgentsLLM`）、工具注册与执行（`ToolRegistry`）、对话历史容器（`_history` / `Message`）、trace 记录。**你负责的部分只剩提示词和循环逻辑**——这正是 Agent 范式的本质所在。

一个关键调用约定：`self.llm.invoke(messages)` 在 1.0.0 返回 `LLMResponse` 对象，取文本要用 `.content`（详见[踩坑录](chapter7-v1.0.0-compat-pitfalls.md)第 1 条）。

## MySimpleAgent：文本协议的工具调用

继承 `SimpleAgent`。它展示了**不依赖 Function Calling** 的工具调用——协议完全由提示词约定：

```text
系统提示词 = 基础角色 + "## 可用工具"（来自 registry.get_tools_description()）
                    + 调用格式说明：[TOOL_CALL:{工具名}:{参数}]

模型输出含 [TOOL_CALL:calculator:15*2]
-> _parse_tool_calls() 正则提取 (工具名, 参数)
-> _execute_tool_call() 查 registry 执行
-> 结果以 user 消息「工具执行结果：…」回填 messages
-> 下一轮模型基于结果给出无标记的最终回答（循环上限 max_tool_iterations=3）
```

三个细节值得注意：

- **协议是提示词的一部分**。`_get_enhanced_system_prompt()` 把工具清单和调用格式说明书拼进系统提示词，模型「学会」这个私有格式全靠这段文字。格式契约不成立（模型不按格式输出）时，正则匹配不到，自然跳过工具分支——软失败。
- **参数解析双轨制**（`_execute_tool_call`）：对内置 `calculator` 直接传表达式字符串；对其他工具走 `_parse_tool_parameters`，支持 `key=value,key=value` 和按工具名智能推断（search → `{'query': …}`）。
- **多轮迭代**：一次 `run` 内可以连续发生多轮「调用→回填→再思考」，与普通对话的区别只是往 messages 里插入 assistant 输出和工具结果两类消息。

另有扩展接口：`stream_run()` 生成器流式输出并累积历史；`add_tool()/remove_tool()/list_tools()` 运行期增删工具。

## MyReActAgent：Thought/Action 循环

继承 `ReActAgent`，把 chapter4 手写的 ReAct 搬进框架，`run()` 每一轮：

```text
构建 prompt = MY_REACT_PROMPT.format(tools=工具描述, question=问题, history=已发生的 Action/Observation)
-> invoke().content
-> _parse_output() 抠出 Thought 和 Action
-> Action 以 Finish 开头？ -> _parse_action_input() 取方括号内容，返回最终答案
-> 没有 Action？           -> 模型直接给了答案，兜底返回文本
-> 否则 _parse_action() 拆出 (工具名, 输入)
-> registry.execute_tool() 执行，Observation 取 ToolResponse.text
-> 追加 "Action: …" / "Observation: …" 到 current_history，进入下一步（上限 max_steps=5）
```

与 SimpleAgent 的协议差异是教学重点：

| | SimpleAgent | ReActAgent |
| --- | --- | --- |
| 协议 | 回答文本里**内嵌** `[TOOL_CALL:…]` 标记 | 整条回复就是**状态机输出**：`Thought:` + `Action:` |
| 每轮职责 | 可能边回答边调工具 | 强制「先想再做」，一次一个动作 |
| 终止 | 输出不含标记即完成 | 显式 `Finish[答案]` |
| 历史 | 框架 `_history` | 任务内局部 `current_history`（每次 run 清空） |

三个解析器 `_parse_output / _parse_action / _parse_action_input` 在 1.0.0 框架基类里**不存在**（基类是另一套 Function Calling 实现），是本章自己补齐的——这也是本章最大的坑，完整来龙去脉见[踩坑录](chapter7-v1.0.0-compat-pitfalls.md)第 3、4 条。

还有一个容易忽略的接线细节：重写 `__init__` 时基类 `ReActAgent` 的参数顺序是 `(name, llm, tool_registry, system_prompt, …)`，与另外三个 Agent 的 `(name, llm, system_prompt, …)` 不同，**必须用关键字传参**，否则提示词会静默接到注册表位子上。

## MyPlanAndSolveAgent：纯文本解析计划

继承 `PlanSolveAgent`。两阶段结构照搬 chapter4，但做了一次**有意的技术选型**：框架 1.0.0 基类用 Function Calling 生成计划，本重写版改用纯文本编号列表 + 正则解析，以兼容不支持工具调用的模型服务：

```text
_plan(question)：
   PLANNER_PROMPT 要求模型输出 "1. 步骤" 编号列表
   正则 ^\s*(\d+)[\.、\)：:]\s*(.+)$ (MULTILINE) 逐行提取
   一行都没解析到 -> 把整个问题当作单步计划（降级，不中断）

_solve(question, plan)：
   for 当前步骤 in 计划:
       EXECUTOR_PROMPT.format(问题, 完整计划, 已获结果 history, 当前步骤)
       -> invoke -> 结果追加进 history -> 最后一步结果即最终答案
```

「完整计划 + 历史结果」每轮都全量重发给执行器，所以模型始终知道自己在路线图的哪一格。计划一次生成、中途不重规划——局限与 chapter4 相同。

提示词解析器接受了 `1.`、`1、`、`1)`、`1：` 多种编号风格，这是对中文模型输出的务实防御；而 chapter4 依赖模型返回 ```` ```python ```` 代码块 + `ast.literal_eval`，格式契约脆得多。**同一范式的两种实现，健壮性差距就在解析器这几行**。（框架基类另提供 `enable_tool_calling` 钩子，执行阶段可接 ToolRegistry 查资料，本重写未启用。）

## MyReflectionAgent：三阶段迭代优化

继承 `ReflectionAgent`，把「输出→批评→修订」流程化：

```text
initial：完成 task，得 current_result
循环 max_iterations 次：
    reflect：以评审视角找 current_result 的问题，得 feedback
    feedback 含 "无需改进" -> break（自我满意即提前收敛）
    refine：按 feedback 修订 current_result
返回最后一版
```

它唯一的结构性设计是**提示词即配置**：三个阶段各是一条模板（`{task}`/`{content}`/`{feedback}` 占位符），存进 `MY_REFLECTION_PROMPTS` 字典；构造时传 `custom_prompts` 可以只覆盖其中某个阶段（`dict` 合并语义），测试脚本正是用它切换到代码生成场景的评审提示词。

三阶段模型分工也值得一记：同一个 deepseek-chat 轮流戴三顶帽子（干活的、挑刺的、改稿的），角色差异完全由提示词制造——和 chapter6 AutoGen 的「角色即 system_message」一脉相承。

## 四种范式横向对比

| | Simple | ReAct | Plan-and-Solve | Reflection |
| --- | --- | --- | --- | --- |
| 控制结构 | 单轮 + 工具回填循环 | Thought→Action→Observation 循环 | Plan 一次 + 逐步执行 | 初版→(批评→修订)×N |
| 下一步由谁定 | 模型输出里有无工具标记 | 每轮的 Observation | 开局定死的计划 | 固定的三阶段 |
| 适合任务 | 问答 + 偶尔查算 | 信息获取类（答案在外部） | 步骤可预先拆解 | 生成质量类（写作/代码） |
| 终止条件 | 无工具标记 / 3 轮 | Finish / 5 步 | 走完计划 | 「无需改进」/ 3 轮 |
| token 开销 | 低-中 | 中（历史逐轮膨胀） | 中（计划+历史全量重发） | 高（每轮 2 次调用） |

选型口诀保持 chapter4 的结论：**事先知道步骤用 Plan-and-Solve，下一步要看结果才知道用 ReAct，在乎产出质量用 Reflection，其余用 Simple。**

## 我的理解

把这四种重写摆在一起看，框架化后的 Agent 代码呈现出非常清晰的「薄」与「厚」：LLM 通信、工具执行、历史管理这些厚活全在框架里，自己的代码薄得只剩提示词模板和几个正则。这反过来暴露了 Agent 范式的真相——所谓 ReAct、Plan-and-Solve、Reflection，差别不在算法，而在**你用什么样的循环结构和输出契约去驯服模型的自由文本**。解析器的健壮程度（PlanSolve 的多格式编号、ReAct 的无 Action 兜底）直接决定了范式在真实模型上能不能跑通。

## 参考

- 同章笔记：[框架与环境](chapter7-helloagents-framework-setup.md)、[工具层重写](chapter7-tools-rewrite.md)、[1.0.0 兼容踩坑录](chapter7-v1.0.0-compat-pitfalls.md)
- 前作对照：[第四章：智能体经典范式](chapter4-classic-agent-paradigms.md)（本章四篇全部对应其手写版）
- 测试入口：[test_simple_agent.py](../code/chapter7/test_simple_agent.py)、[test_react_agent.py](../code/chapter7/test_react_agent.py)、[test_plan_solve_agent.py](../code/chapter7/test_plan_solve_agent.py)、[test_reflection_agent.py](../code/chapter7/test_reflection_agent.py)
