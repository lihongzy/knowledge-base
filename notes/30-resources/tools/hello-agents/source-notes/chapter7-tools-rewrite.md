# 第七章：工具层重写——计算器与多源搜索

源码：[my_calculator_tool.py](../code/chapter7/my_calculator_tool.py)、[my_advanced_search.py](../code/chapter7/my_advanced_search.py)、[test_my_calculator.py](../code/chapter7/test_my_calculator.py)、[test_advanced_search.py](../code/chapter7/test_advanced_search.py)

## 学习目标

掌握向 `ToolRegistry` 注册工具的两种方式（函数注册 / 对象注册），理解「LLM 决定调什么、Python 决定怎么执行」的分工在框架里如何落地；顺带学会用 AST 白名单实现安全表达式求值。

## 工具在框架中的位置

```text
用户问题 -> Agent 构建提示词（含工具描述 get_tools_description()）
-> LLM 输出「调用哪个工具 + 参数」         （模型的职责）
-> Agent 调 registry.execute_tool(name, input) （程序的职责）
-> 结果作为 Observation 写回上下文 -> LLM 继续
```

工具对框架而言只需满足一个最小契约：**有 `name`、有 `description`、能从字符串输入得到字符串输出**。本章两个工具分别示范了函数式和类式两种形态。

## my_calculator_tool：函数式注册 + 安全求值

[my_calculator_tool.py](../code/chapter7/my_calculator_tool.py) 没有继承任何基类，就是一个普通函数配一个注册助手：

```python
registry = ToolRegistry()
registry.register_function(
    name="my_calculator",
    description="简单的数学计算工具，支持基本运算(+,-,*,/)和sqrt函数",
    func=my_calculate
)
```

值得学的是 `my_calculate` 的**安全求值**：计算表达式不能直接用 `eval()`（会执行任意代码），它改用 `ast.parse(expression, mode='eval')` 把表达式解析成语法树，再用自己的递归函数 `_eval_node` 只放行白名单节点：

```text
Constant    -> 数字字面量
BinOp       -> 查 operators 字典（只有 + - * /）
Call        -> 查 functions 字典（只有 sqrt）
Name        -> 常量查找（只有 pi）
其他一切节点 -> 求值失败，返回错误提示
```

这就是「能力最小化」：LLM 生成的表达式无论写多花哨，最多只能做四则运算，`__import__("os")` 之类根本过不了白名单。

## my_advanced_search：类式注册 + 多源降级

[my_advanced_search.py](../code/chapter7/my_advanced_search.py) 示范工具更复杂的形态——一个有内部状态的类。核心设计有三层：

**1. 能力探测（初始化时）**

```text
有 TAVILY_API_KEY 且能 import tavily -> search_sources 加入 "tavily"
有 SERPAPI_API_KEY 且能 import serpapi -> search_sources 加入 "serpapi"
都没有 -> 列表为空，search() 返回配置指引而不是崩溃
```

工具在构造阶段就把「环境里有什么」探明，运行期不再猜。

**2. 多源降级（搜索时）**

```text
按优先级遍历 search_sources
-> tavily 出结果且非空 -> 直接返回（带 "AI直接答案" 摘要）
-> 失败或无结果 -> 换 serpapi 重试
-> 全部失败 -> 返回汇总错误
```

同一个逻辑动作（搜索）背后挂多个实现，单个源故障不影响工具可用性。这正对应类注释里说的「多源整合和智能选择的设计模式」。

**3. 绑定的实例方法注册**

```python
registry.register_function(
    name="advanced_search",
    description="高级搜索工具，整合Tavily和SerpAPI多个搜索源…",
    func=search_tool.search          # 实例方法的绑定引用
)
```

注册的是**实例方法的 bound reference**，工具内部持有客户端状态，对外接口却和普通函数一样：进一个字符串，出一个字符串。

## 两种注册路径对比

| | register_function | register_tool |
| --- | --- | --- |
| 传入 | 裸函数 + 名字 + 描述 | 工具对象（需有 name/description/run） |
| 本章用例 | my_calculator、advanced_search | 测试脚本里的框架内置 CalculatorTool |
| 适合 | 轻量函数、把类方法包一层 | 有生命周期/多方法的正式工具 |

两条路殊途同归：`execute_tool(name, input_text)` 统一按字符串协议调用。

## ToolRegistry 常用接口速查

```text
register_function(name, description, func)   函数注册
register_tool(tool) / unregister(name)       对象注册 / 注销
get_tools_description()                      拼给提示词的工具说明书
execute_tool(name, input_text)               按名字执行（1.0.0 返回 ToolResponse 对象）
list_tools()                                 当前注册的工具名列表
```

注意 `execute_tool` 在 1.0.0 返回的是 `ToolResponse` 对象而非字符串，拼回对话前需取 `.text`（见[踩坑录](chapter7-v1.0.0-compat-pitfalls.md)第 2 条）。

## 测试脚本

- [test_my_calculator.py](../code/chapter7/test_my_calculator.py)：直接调 `my_calculate` 验证四则运算、sqrt、非法表达式兜底——不经过 LLM，零 token。
- [test_advanced_search.py](../code/chapter7/test_advanced_search.py)：构造 registry 后真实调用搜索源，会消耗 Tavily/SerpAPI 配额。

## 我的理解

这两个工具文件代码不长，却划清了 Agent 系统里最重要的一条线：**「决定」归模型，「执行」归程序**。模型只在文本里写出 `my_calculator[15.2*10]` 这样的意图；真正把 `15.2*10` 算出来、并且保证这段来路不明的文本不变成任意代码执行的，是程序这边的 AST 白名单。写工具时的功夫应该全花在后者：输入校验、能力最小化、外部依赖的探测与降级。

## 参考

- 同章笔记：[框架与环境](chapter7-helloagents-framework-setup.md)、[四种 Agent 范式重写](chapter7-agent-paradigms-rewrite.md)
- 框架源码：`.venv/Lib/site-packages/hello_agents/tools/registry.py`
