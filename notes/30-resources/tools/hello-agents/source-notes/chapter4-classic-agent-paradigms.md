# 第四章：智能体经典范式

源码：[llm_client.py](../code/chapter4/llm_client.py)、[tools.py](../code/chapter4/tools.py)、[Plan_and_solve.py](../code/chapter4/Plan_and_solve.py)、[ReAct.py](../code/chapter4/ReAct.py)、[Reflection.py](../code/chapter4/Reflection.py)

## 学习目标

理解 Agent 如何围绕大语言模型组织“规划、行动、观察、反思”过程，并能区分 Plan-and-Solve、ReAct 和 Reflection 三种经典范式的适用场景。

## 本章结构

本章没有训练新的语言模型，而是在已有 LLM 之上构建控制流程。每个 Agent 都由提示词、LLM 调用、状态记录和循环条件组成。

```text
用户任务
-> Agent 组织提示词
-> LLM 给出计划、行动或反馈
-> 程序解析结果并执行下一步
-> 将结果写入上下文
-> LLM 基于新上下文继续决策
-> 得到最终答案或满足停止条件
```

## 基础组件

### LLM 客户端

`HelloAgentsLLM` 将模型调用封装为 `think(messages, temperature=0)`。

它完成以下工作：

```text
读取 OPENAI_MODEL、OPENAI_API_KEY、OPENAI_BASE_URL
-> 创建 OpenAI 客户端
-> 发送 Chat Completions 请求
-> 流式打印每个响应片段
-> 拼接所有片段并返回完整文本
```

`messages` 是角色消息列表，例如：

```python
[
    {"role": "system", "content": "你是一个有帮助的助手。"},
    {"role": "user", "content": "写一个快速排序算法。"},
]
```

本章其余 Agent 不直接处理 API 请求，而是依赖 `HelloAgentsLLM`。这使模型配置、流式输出和异常处理集中在一个位置。

### 工具执行器

`ToolExecutor` 是工具注册表。每个工具使用名称、说明和函数注册：

```python
toolExecutor.registerTool("Search", search_description, search)
```

注册后，Agent 可以通过工具名查找函数：

```python
tool_function = toolExecutor.getTool("Search")
observation = tool_function("华为最新的手机")
```

工具说明会被加入提示词，告诉 LLM 可用工具及其使用条件。模型负责决定“是否调用、调用哪个工具、传入什么参数”；Python 程序负责真正执行工具并返回结果。这是 Agent 工具调用的基本分工。

### SerpApi 搜索工具

`tools.py` 的 `search(query)` 使用 `SERPAPI_API_KEY` 调用 Google 搜索，并按优先级返回结果：

```text
answer_box_list
-> answer_box 的直接答案
-> knowledge_graph 描述
-> 前三个自然搜索结果摘要
```

工具返回的文本称为 Observation（观察结果）。它不是模型自己编造的内容，而是外部工具提供的新信息，随后会写回 Agent 的上下文。

## Plan-and-Solve：先规划，再逐步执行

源码：[Plan_and_solve.py](../code/chapter4/Plan_and_solve.py)

Plan-and-Solve 将复杂任务分为两个角色：Planner（规划器）和 Executor（执行器）。

```text
问题
-> Planner 将问题拆为步骤列表
-> Executor 依次完成当前步骤
-> 每一步结果加入 history
-> 下一步参考完整计划和历史结果
-> 输出最后一步结果
```

### 它解决的核心问题

Plan-and-Solve 将“想清楚怎么做”和“真正完成每一步”分开。规划阶段关注全局顺序，执行阶段只关注当前步骤，因此每次模型调用的目标比较单一。

以“比较两款手机并给出购买建议”为例，规划器可能先给出：

```text
1. 列出两款手机的关键对比维度。
2. 分别整理处理器、屏幕、相机和价格。
3. 根据用户预算和使用需求给出建议。
```

执行器不会一次性回答全部问题，而是先完成第 1 步，将结果写入历史；第 2 步读取该历史后补充具体信息；第 3 步再根据前两步的内容作出结论。

### 程序维护的状态

该范式有两个主要状态：

```text
plan：固定的步骤列表
history：已完成步骤及其结果
```

`plan` 在开始后保持不变，`history` 随每一步完成而增长。下一步模型看到的是“完整路线图 + 已走过的路线”，而不是从零开始回答问题。

### Planner

`Planner.plan(question)` 将问题填入 `PLANNER_PROMPT_TEMPLATE`，要求模型返回 Python 列表：

```python
["步骤1", "步骤2", "步骤3"]
```

程序提取 Markdown 代码块中的内容，再用 `ast.literal_eval()` 转为 Python 列表。`literal_eval()` 只能解析 Python 字面量，不能执行任意代码，因此比 `eval()` 安全。

这里的约束较严格：如果模型没有按 ` ```python ... ``` ` 格式返回，解析会失败并返回空计划。这说明 Agent 的程序逻辑与提示词输出格式是一个明确契约。

### Executor

`Executor.execute(question, plan)` 按顺序遍历计划。每轮都向模型提供：原始问题、完整计划、已完成步骤与结果、当前步骤。

```text
步骤 1 的结果
-> 加入 history
-> 步骤 2 读取 history
-> 继续执行
```

这种设计适合步骤相对固定、每一步都可独立描述的任务，例如数学题、信息整理、研究流程和文档草稿。

### 局限

计划在开始时一次性生成。如果任务执行中发现需要查询新信息、原计划不成立或出现错误，示例不会自动重规划；它只会继续执行最初的计划。

因此，当任务的步骤可以在开始时较准确地确定时，Plan-and-Solve 很合适；当下一步必须等待外部查询结果才能决定时，应该使用 ReAct，或为计划器增加重规划能力。

## ReAct：思考与行动交替

源码：[ReAct.py](../code/chapter4/ReAct.py)

ReAct 的名称来自 Reasoning and Acting，核心思想是让模型在每一轮决定下一步行动，并根据行动结果继续推理。

```text
Question
-> Thought：分析下一步需要什么
-> Action：调用工具或 Finish
-> Python 执行工具
-> Observation：得到工具结果
-> 将 Action 和 Observation 写入 History
-> 下一轮 Thought
```

### 它与 Plan-and-Solve 的根本区别

Plan-and-Solve 是“先制定完整路线，再按路线前进”；ReAct 是“走一步、看一眼结果、再决定下一步”。ReAct 不要求模型在开始时知道所有步骤，关键决策发生在每一轮 Observation 返回之后。

仍以“比较两款手机并给出购买建议”为例，ReAct 可能执行：

```text
Thought: 我需要先确认手机 A 的当前价格和规格。
Action: Search[手机 A 当前价格 处理器 屏幕]
Observation: 搜索结果

Thought: 还缺少手机 B 的相机信息。
Action: Search[手机 B 相机规格]
Observation: 搜索结果

Thought: 信息已经足够，可以根据预算做推荐。
Action: Finish[最终购买建议]
```

它不预先规定必须搜索几次，也不预先规定查询顺序。下一步由最新观察结果决定。

### 程序维护的状态

ReAct 的核心状态是 `history`。它按时间顺序保存已经发生的行动和观察：

```text
Action: Search[查询 A]
Observation: 查询 A 的结果
Action: Search[查询 B]
Observation: 查询 B 的结果
```

每一轮都将这个历史写入提示词。模型于是知道自己已经查过什么，也能避免重复询问，并基于工具结果形成最终答案。

### 输出协议

`REACT_PROMPT_TEMPLATE` 要求模型遵循固定格式：

```text
Thought: 我需要先搜索最新机型。
Action: Search[华为最新的手机]
```

当信息足够时，模型应返回：

```text
Thought: 已获得所需信息。
Action: Finish[最终答案]
```

`_parse_output()` 从模型文本中提取 `Thought` 和 `Action`；`_parse_action()` 再将 `Search[查询内容]` 拆为工具名和参数。

### 观察结果如何驱动后续推理

模型不能直接访问搜索引擎。程序执行 `Search[...]` 后，将返回内容写为：

```text
Action: Search[华为最新的手机]
Observation: 搜索结果摘要
```

下一轮模型会看到这段历史，因而能依据真实搜索结果决定继续搜索、补充信息或输出最终答案。

### 停止条件

ReAct 示例在以下情况停止：

- 模型输出 `Finish[...]`。
- 模型没有返回有效内容或无法解析 `Action`。
- 达到 `max_steps`，默认最多 5 轮。

`max_steps` 用于限制模型反复调用工具造成的时间和费用。

需要注意：`Thought` 只是模型输出的文本，真正改变外部世界的是 `Action` 被 Python 程序执行之后。程序必须只执行允许的工具，并限制工具参数、调用次数和权限，不能因为模型输出了一段文字就直接执行任意代码或命令。

### 适用场景与局限

ReAct 适合问题执行中需要根据实时信息调整下一步的任务，例如网页搜索、数据库查询、文件检索和 API 调用。

它依赖模型严格遵守文本协议。若模型输出的 `Action` 格式不正确，正则解析失败，流程会停止。实际生产系统通常会使用 JSON Schema 或原生 tool calling 代替手写文本解析。

ReAct 的代价也通常更高：每次工具调用后都需要再次请求 LLM。只有在外部信息确实会改变下一步决策时，这种循环才值得使用。

## Reflection：生成、评审、改进

源码：[Reflection.py](../code/chapter4/Reflection.py)

Reflection 让 Agent 对已有结果进行评审，再根据反馈生成更好的版本。

```text
任务
-> 初次生成结果
-> Reflection 审查结果
-> 若需改进，Refine 根据反馈重写
-> 再次审查
-> 满足质量条件或达到最大轮数后结束
```

### 它解决的核心问题

Reflection 关注的不是“下一步该调用什么工具”，而是“当前结果是否达到要求，如何改进”。它适合初稿已经可以生成，但质量需要通过多轮审查提升的任务。

例如任务是“实现一个判断素数的 Python 函数”，循环可能是：

```text
初稿：逐个尝试 2 到 n-1 的除数。
评审：时间复杂度为 O(n)，可以只检查到 sqrt(n)。
改写：使用平方根作为循环上界。
再次评审：算法已满足当前要求。
```

这里每一轮都围绕同一个产物展开。反馈不是最终答案，而是下一轮改写的输入。

### 程序维护的状态

Reflection 的状态是版本历史，而不只是最新答案：

```text
execution v1：初始代码
reflection v1：对初始代码的评审
execution v2：根据评审改写的代码
reflection v2：对新版代码的评审
```

`Memory` 保存这些记录。当前代码通过 `get_last_execution()` 取出最近一版代码，交给评审器和改写器继续处理。保留历史的价值在于能够追踪每次修改的原因，并在需要时对比不同版本。

### Memory

`Memory` 用列表保存两类记录：

- `execution`：当前生成的代码。
- `reflection`：评审员对代码的反馈。

`get_trajectory()` 可将完整历史格式化为提示词文本；`get_last_execution()` 从后向前找到最新代码版本。

### 三类提示词

示例中定义了三个提示词：

```text
INITIAL_PROMPT_TEMPLATE
-> 按任务生成初始 Python 代码

REFLECT_PROMPT_TEMPLATE
-> 审查代码的算法效率，提出可执行的优化建议

REFINE_PROMPT_TEMPLATE
-> 根据原任务、上一版代码和评审反馈生成新代码
```

### 迭代与停止

`ReflectionAgent.run()` 最多迭代 `max_iterations` 次。每轮先评审，再检查反馈是否包含“无需改进”或 `no need for improvement`；若包含则停止，否则生成新版代码。

这个示例将停止条件写成文本判断，简单但不稳定。模型可以使用不同措辞表达“无需改进”，导致程序继续执行。更可靠的实现可要求模型返回结构化字段，例如 `{"needs_improvement": false}`。

### 适用场景

Reflection 适合有明确质量标准且能够通过反馈改进的任务，例如代码优化、文章修改、测试补全、计划审查和提示词迭代。

它不保证每次迭代都更好：评审和改写都由模型完成，可能引入新问题。因此实际使用时应加入单元测试、静态检查或人工审核等外部验证机制。

对代码任务而言，最可靠的 Reflection 循环是“模型提出改进 -> 程序运行测试 -> 测试结果作为反馈 -> 模型再修改”。只有模型自我评价时，评审结果仍可能有误。

## 三种范式的比较

| 范式 | 核心循环 | 优点 | 局限 | 适用任务 |
| --- | --- | --- | --- | --- |
| Plan-and-Solve | 先规划，再顺序执行 | 过程清晰，适合拆分稳定任务 | 不能根据执行结果灵活重规划 | 数学推导、研究大纲、固定工作流 |
| ReAct | 思考 -> 行动 -> 观察 | 能依据工具结果动态调整 | 依赖行动格式，可能循环或解析失败 | 搜索、检索、API 和文件操作 |
| Reflection | 生成 -> 评审 -> 改进 | 将质量反馈纳入循环 | 可能重复改写而不提升 | 代码、文案、方案和测试优化 |

### 选择方法

先判断任务的不确定性来自哪里：

```text
步骤已知，但任务较复杂
-> Plan-and-Solve

下一步取决于搜索、数据库或 API 返回的实时结果
-> ReAct

已有初稿，但需要针对质量标准持续优化
-> Reflection
```

三种范式也可以组合。例如先用 Plan-and-Solve 制定研究步骤，在每个需要外部信息的步骤中使用 ReAct 搜索，最后用 Reflection 审查研究报告。组合的前提是每个子流程都有明确的输入、输出和停止条件，否则上下文会不断膨胀，流程也难以控制。

## 本章与第一章的关系

第一章展示了一个能调用天气和景点工具的旅行 Agent；第 4 章将 Agent 的控制逻辑进一步拆为可复用范式。

```text
第一章：工具调用循环的基础示例
第四章：规划、行动观察、反思改进的三种组织方式
```

## 我的理解

Agent 的能力不只来自模型本身，还来自程序如何安排模型调用。Plan-and-Solve 给模型一个预先确定的执行框架；ReAct 让模型根据观察结果即时决定行动；Reflection 让模型在反馈循环中改进已有结果。选择范式时，应依据任务是否需要预先规划、是否依赖外部信息、以及是否需要迭代提高质量来决定。
