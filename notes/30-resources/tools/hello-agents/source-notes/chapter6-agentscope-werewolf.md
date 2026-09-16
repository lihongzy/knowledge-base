# 第六章：AgentScope 多智能体狼人杀

源码：[main_cn.py](../code/chapter6/AgentScopeDemo/main_cn.py)、[prompt_cn.py](../code/chapter6/AgentScopeDemo/prompt_cn.py)、[game_roles.py](../code/chapter6/AgentScopeDemo/game_roles.py)、[structured_output_cn.py](../code/chapter6/AgentScopeDemo/structured_output_cn.py)、[utils_cn.py](../code/chapter6/AgentScopeDemo/utils_cn.py)

![三国狼人杀：夜议与消息网络](images/chapter6-cover.png)

## 学习目标

理解多智能体框架如何接管第四章中手写的控制逻辑：Agent、Model、Formatter、Pipeline、Memory 各司其职，智能体之间只通过消息协作；并掌握用结构化输出约束智能体行为的方法。

## 项目功能

六名 AI 玩家扮演三国人物进行狼人杀。每个玩家是一个 `ReActAgent`，拥有双重身份：游戏角色（狼人、预言家、女巫、猎人、村民）和三国人物（刘备、曹操、孙权等）。

```text
夜晚：狼人讨论并投票击杀 -> 预言家查验 -> 女巫选择救人或毒杀
白天：公布死讯 -> 所有存活玩家自由讨论 -> 投票淘汰 -> 被淘汰的猎人可开枪
每轮结束检查胜负，狼人全灭则好人胜，狼人数量达到或超过好人则狼人胜
```

游戏不设人类玩家，全部由模型驱动，用于观察多智能体的对话、结盟、欺骗与推理行为。

## 本章定位：从手写循环到框架

第四章的 ReAct 需要自己拼提示词、正则解析 `Action: Search[...]`、维护 `history` 字符串。AgentScope 把这些职责拆成独立层：

| 职责 | 第四章做法 | AgentScope 做法 |
| --- | --- | --- |
| 调用模型 | 自己封装 `HelloAgentsLLM` | `ChatModelBase` 子类（如 `OpenAIChatModel`） |
| 消息格式 | 手写字符串拼接 | `Formatter` 负责把 `Msg` 转成 API 需要的结构 |
| 工具/输出协议 | 正则解析文本 | 原生 tool calling + Pydantic 模型 |
| 记忆 | 自己维护 `history` 列表 | `Memory` 对象，由 Agent 自动读写 |
| 多智能体协作 | 无 | `MsgHub` 广播 + `pipeline` 编排 |

分工的核心变化是：**程序不再解析模型说了什么，而是约定模型必须用什么结构返回**。解析工作交给框架和 Pydantic。

## 智能体架构

### 分层视图

```text
编排层   ThreeKingdomsWerewolfGame
         |  决定阶段顺序、谁参与、何时结算
         v
智能体层  6 个 ReActAgent（玩家） + GameModerator（主持人）
         |  每个玩家有独立记忆，独立调用模型
         v
消息层    Msg / MsgHub / pipeline
         |  广播或点对点传递，决定谁看得到什么
         v
模型层    OpenAIChatModel（DeepSeek）
         |  只负责发请求、解析响应
         v
约束层    Pydantic 模型 -> generate_response 工具 -> Msg.metadata
```

编排层是唯一的"上帝视角"，它持有全部真相并驱动流程；智能体只知道自己被告知的事。

![智能体架构：五层结构](images/chapter6-architecture.png)

图中的意象自上而下对应五层：

```text
执笔的手与展开的卷轴   -> 编排层，掌控全局、决定流程
六位人物与提灯的信使   -> 智能体层，玩家与主持人
同心光环与往来的信笺   -> 消息层，广播域与点对点传递
青铜方鼎               -> 模型层，所有请求的唯一入口
印玺与网格格栅         -> 约束层，结构化输出与类型校验
```

### 单个玩家的构造

```text
ReActAgent（一名玩家）
├── sys_prompt  游戏角色 + 三国人物 + 输出规则
├── model       OpenAIChatModel（DeepSeek），所有玩家共用同一份配置
├── formatter   DeepSeekMultiAgentFormatter，把记忆转成 API 的 messages
├── memory      独立记忆，只保存自己收到过的消息
└── toolkit     内置收尾工具 generate_response
                调用时由 structured_model 动态替换其参数 schema
```

一次 `reply()` 的内部过程：

```text
reply(msg, structured_model)
-> 把 structured_model 的字段注入 generate_response 的参数 schema
-> 循环，最多 max_iters 次
   -> 用 sys_prompt + memory 组装请求，附带工具 schema
   -> 模型回复
      -> 调用 generate_response 且参数校验通过 -> 结果写入 metadata，结束
      -> 参数校验失败 -> 错误信息作为工具结果回传，进入下一轮
      -> 只输出纯文本 -> 被包装成 {"response": ...} 再校验，通常失败并重来
-> 达到上限仍未成功 -> 生成总结文本，metadata 为 None
```

### 玩家如何被创建

`create_player(role, character)` 做四件事：

```text
1. name = 三国人物名（如「曹操」）
2. self.roles[name] = role          # 身份真相记在游戏侧
3. 创建 ReActAgent，sys_prompt 由 get_role_prompt(role, character) 生成
4. await agent.observe(主持人发布身份告知)   # 写入该玩家记忆，不触发回复
```

关键设计：**身份真相存在游戏类的 `roles` 字典里，智能体只知道自己的身份**。预言家查验时，由游戏侧查 `self.roles` 得出结果，再私聊给预言家。智能体之间没有查询彼此身份的通道，只能通过对话去猜。

### 主持人：只发消息的伪智能体

`GameModerator` 继承 `AgentBase`，但它没有 `model`、没有 `formatter`，**从不调用大模型**。它只做两件事：构造 `Msg(name="游戏主持人", role="system")` 并打印、把公告记入 `game_log`。

它控制信息流向的方式是同一次 `announce()` 的两种用法：

```python
await self.moderator.announce(...)                        # 只打印，不进任何人的记忆
await agent.observe(await self.moderator.announce(...))   # 打印，并只写入该智能体的记忆
```

**是否 `observe`，决定了这条消息是公开广播还是私聊。** 这是整个架构中最重要的一个细节：没有独立的权限系统，信息隔离完全由"发给谁"决定。

### 三种通信域

| 通信域 | 实现 | 参与者 | 用途 |
| --- | --- | --- | --- |
| 狼人域 | `MsgHub(self.werewolves)` | 狼人 | 夜间讨论、击杀投票 |
| 全体域 | `MsgHub(self.alive_players)` | 全体存活玩家 | 白天讨论、淘汰投票 |
| 点对点 | `agent.observe(...)` | 单个玩家 | 身份告知、查验结果、女巫看到的死讯 |

![消息拓扑：主持人、广播域与点对点私聊](images/chapter6-topology.png)

`MsgHub` 的 `announcement` 参数在成员进入域时发给大家；`set_auto_broadcast(False)` 用于投票阶段关闭广播，否则后投票的人会看到前面的人投了谁。

### 白天阶段的完整时序

```text
主持人宣布天亮（仅打印）
-> 进入 MsgHub(alive_players, auto_broadcast=True)
   -> announcement 写入所有人的记忆
   -> sequential_pipeline：玩家依次发言，每次发言自动广播给域内其他人
-> set_auto_broadcast(False)
-> fanout_pipeline(..., structured_model=get_vote_model_cn(alive_players))
   -> 同一条「请投票」消息并发发给所有人
   -> 每人独立返回 Msg，metadata 中是 vote / reason / suspicion_level
-> 游戏侧汇总 votes
-> majority_vote_cn 得出被淘汰者
-> 主持人公布投票结果
```

讨论用 `sequential_pipeline`（串行），因为发言要基于前面人的话；投票用 `fanout_pipeline`（并发）加关闭广播，因为投票必须互相隔离。同一个 `MsgHub` 内切换广播开关，是这里控制信息可见范围的手法。

### 状态分为两层

| 层 | 持有者 | 内容 | 说明 |
| --- | --- | --- | --- |
| 游戏状态 | `ThreeKingdomsWerewolfGame` | `roles`、`alive_players`、各阵营列表、女巫道具 | 全局唯一，是真相来源 |
| 智能体状态 | 每个 `ReActAgent` 的 memory | 自己收到过的消息 | 各自独立，互不共享 |

两层**不自动同步**：`update_alive_players()` 只把死者从游戏侧的列表中移除，既不清理死者的记忆，也不主动通知存活者。玩家之所以"知道"谁死了，是因为下一轮公告文本里带着存活名单。

### 数据流闭环

```text
Pydantic 模型 -> 工具 schema -> 模型调用 -> Msg.metadata
     ^                                          |
     |                                          v
下一轮候选名单 <- update_alive_players <- majority_vote_cn <- votes 汇总
```

上一轮的投票结果改变存活名单，存活名单又决定下一轮 `structured_model` 中 `Literal` 的候选范围。游戏规则因此从提示词里的自然语言，变成了代码中的类型约束——模型想投一个已出局的人，在类型层面就做不到。

## 代码结构

| 文件 | 职责 |
| --- | --- |
| `main_cn.py` | 游戏主类 `ThreeKingdomsWerewolfGame`，编排夜晚与白天各阶段 |
| `game_roles.py` | 角色能力、人物性格、按人数生成角色配置 |
| `prompt_cn.py` | 按角色生成系统提示词 |
| `structured_output_cn.py` | 各阶段的 Pydantic 输出模型 |
| `utils_cn.py` | 主持人 `GameModerator`、投票统计、胜负判定 |

## AgentScope 的四个核心抽象

### Agent

`ReActAgent` 由三部分组成：

```python
ReActAgent(
    name=name,
    sys_prompt=...,      # 角色设定
    model=...,           # 使用哪个模型
    formatter=...,       # 消息如何格式化
)
```

它在内部维持"推理—行动"循环：每轮把系统提示词和记忆交给模型，若模型返回工具调用就执行，直到产生最终回复或达到 `max_iters`。

### Model

模型类只负责发请求和解析响应，不关心业务。`OpenAIChatModel` 兼容所有 OpenAI 格式的接口，通过 `client_args={"base_url": ...}` 切换到 DeepSeek 等厂商。

### Formatter

`Formatter` 决定记忆里的 `Msg` 列表如何变成 API 的 `messages`。这一点在多智能体场景尤其重要：API 通常只有 `user` / `assistant` / `system` 三种角色，而场上有六个智能体。

`DeepSeekMultiAgentFormatter` 的做法是把其他智能体的发言合并进一段对话历史，并在每条前加上发言者名字：

```text
刘备：我认为曹操可疑。
关羽：某亦附议。
```

这解释了为什么换模型必须同时换 Formatter——它不是可选的装饰，而是消息能否被正确理解的前提。

### Pipeline 与 MsgHub

`MsgHub` 是一个消息广播域。进入同一个 hub 的智能体，发言会自动广播给域内其他成员：

```python
async with MsgHub(self.werewolves, enable_auto_broadcast=True) as hub:
    for wolf in self.werewolves:
        await wolf(...)
    hub.set_auto_broadcast(False)   # 投票时关闭广播，避免互相看到投票
```

`sequential_pipeline` 让智能体依次发言；`fanout_pipeline` 让它们并发处理同一条消息（用于投票）。

本项目如何组合这些域、以及广播开关在何处切换，见上一节「智能体架构」。

## 游戏主流程

```text
setup_game
-> 随机分配角色与三国人物
-> 为每个玩家创建 ReActAgent

run_game（最多 MAX_GAME_ROUND 轮）
-> 夜晚
   -> werewolf_phase：狼人在 MsgHub 内讨论 3 轮，再投票击杀
   -> seer_phase：预言家查验一名玩家，仅自己得知结果
   -> witch_phase：女巫得知死讯，决定解药与毒药
   -> update_alive_players
   -> 检查胜负
-> 白天
   -> day_phase：sequential_pipeline 依次发言，再 fanout_pipeline 并发投票
   -> hunter_phase：若被淘汰者是猎人，可开枪带走一人
   -> update_alive_players
   -> 检查胜负
```

信息隔离通过"给谁发消息"实现：预言家的查验结果只写入预言家自己的记忆，狼人的讨论在狼人专用的 `MsgHub` 内广播，白天讨论则在包含所有存活玩家的 hub 内进行。

## 关键机制：结构化输出

这是本项目最值得理解的部分。

### 它不是让模型输出 JSON

`ReActAgent` 内置一个收尾工具 `generate_response`。调用 `agent(structured_model=X)` 时，框架把 `X` 的字段**注入** `generate_response` 的参数 schema，然后要求模型通过**工具调用**提交结果。

```text
定义 Pydantic 模型
-> 注入 generate_response 的参数 schema
-> 模型发起一次工具调用并填入字段
-> 框架用 Pydantic 校验
-> 校验通过：结果写入 Msg.metadata
-> 校验失败：错误信息作为工具结果回传，模型重试
```

最终结果在 `Msg.metadata` 里，而不是在正文中。所以游戏代码这样取票：

```python
votes[self.alive_players[i].name] = vote_msg.metadata.get("vote")
```

### 各阶段的输出模型

| 阶段 | 模型 | 关键字段 |
| --- | --- | --- |
| 讨论 | `DiscussionModelCN` | `reach_agreement`、`confidence_level`、`key_evidence` |
| 白天投票 | `get_vote_model_cn()` | `vote`、`reason`、`suspicion_level` |
| 狼人击杀 | `WerewolfKillModelCN` | `target`、`kill_strategy` |
| 预言家查验 | `get_seer_model_cn()` | `target`、`check_reason` |
| 女巫行动 | `WitchActionModelCN` | `use_antidote`、`use_poison`、`target_name` |
| 猎人开枪 | `get_hunter_model_cn()` | `shoot`、`target` |

带参数的构造函数（如 `get_vote_model_cn(agents)`）用 `Literal[tuple(...)]` 把候选玩家名写进类型，模型只能从存活玩家中选，无法凭空捏造。

### 与第四章手写协议的对比

第四章依赖正则匹配 `Action: Search[...]`，模型换个说法就解析失败。这里依赖 API 原生 tool calling：schema 由框架生成并随请求发送，参数校验由 Pydantic 完成，模型不遵守也无法绕过。

代价是**模型必须支持 Function Calling**。这也决定了模型选型，见下一节。

## 容错设计

单个智能体出错不应中断整局游戏。`main_cn.py` 在每个取 `metadata` 的地方都做了兜底：

```python
if vote_msg is not None and ... and vote_msg.metadata is not None:
    votes[...] = vote_msg.metadata.get("vote")
else:
    print(f"{名字} 的投票无效，视为弃票")
    votes[...] = None
```

狼人投票无效则随机选目标，女巫行动无效则视为不使用技能，猎人技能失败则视为放弃开枪。

这类兜底让游戏能跑完，但也掩盖问题：如果看到大量"投票无效"，说明模型没有正确调用工具，应该去查模型能力或参数配置，而不是接受降级结果。

## 模型接入：改用 DeepSeek 的实战记录

原案例使用阿里云 DashScope 的 `qwen-max`。本项目改为 DeepSeek，过程中暴露了框架版本与模型能力之间的三个约束。

### 用 OpenAI 兼容接口接入

AgentScope 没有独立的 DeepSeek 模型类，但有配套的 `DeepSeekMultiAgentFormatter`，说明官方推荐走 OpenAI 兼容通道：

```python
OpenAIChatModel(
    model_name="deepseek-flash",
    api_key=DEEPSEEK_API_KEY,
    client_args={"base_url": "https://api.deepseek.com"},
    stream=False,
    generate_kwargs={"extra_body": {"thinking": {"type": "disabled"}}},
)
```

配置通过 `python-dotenv` 从 `code/.env` 读取，与第一章保持一致：

```python
CODE_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(CODE_ROOT / ".env")
```

模型必须选支持 Function Calling 的档位（`deepseek-flash` 支持，`deepseek-reasoner` 不支持），否则结构化输出全线失败。

### 必须关闭思考模式

DeepSeek 默认开启思考，响应中带 `reasoning_content`，且要求**下一轮请求原样回传**。而 AgentScope 1.0.2 的 `DeepSeekMultiAgentFormatter` 不支持 `ThinkingBlock`，格式化历史时会丢弃该字段：

```text
模型返回 reasoning_content
-> AgentScope 解析为 ThinkingBlock 存入记忆
-> Formatter 不支持该类型，格式化时跳过
-> 回传的 assistant 消息缺少 reasoning_content
-> DeepSeek 返回 400：
   The reasoning_content in the thinking mode must be passed back to the API.
```

表现是前几轮正常，历史累积到一定长度后必然崩溃。关闭思考后问题消失，同时省下大量思考 token。

注意 `thinking` 必须放在 `extra_body` 里：新版 OpenAI SDK 的 `create()` 是显式签名，未知关键字参数不会进入请求体。

### 必须关闭流式输出

`stream=True` 时，AgentScope 1.0.2 解析 DeepSeek 的工具调用参数会出错，参数被解析成 `["response"]` 这样的数组而非对象：

```text
模型发起工具调用
-> 流式分片累积后参数解析异常
-> block["input"].get("response") 抛异常
-> 控制台打印 Error in block input ['response']
-> 工具校验失败，模型重试一轮
```

实测同一个提示词下：流式 18 次错误，非流式 0 次。关闭流式后每次发言少跑一轮，token 接近减半，代价只是发言不再逐字打印。

### 不要用提示词去修框架层的 bug

最初观察到 `Error in block input` 时，判断是提示词让模型"直接输出 JSON 而不是调用工具"，于是在提示词中加入"禁止填写 `response` 参数""参数必须是 JSON 对象"等约束——**无效**。

真正的定位方法是找到这行输出的来源，而不是猜测模型的行为。它在 `_react_agent.py` 显示层钩子的 `except` 分支里，意味着参数结构本身已经异常，属于框架与模型的兼容问题。

结论：提示词能约束模型的意图，不能修复协议解析的错误。遇到反复重试，先看日志来源，再决定改哪一层。

## 我的理解

多智能体应用的复杂度不在单个智能体，而在**谁在什么时刻看到哪些消息**。这个案例把信息隔离做成了结构：`MsgHub` 划分广播域，管道决定串行还是并发，`observe` 决定一条公告是公开还是私聊，结构化输出决定结果能否被程序消费。规则由此从提示词里的自然语言，变成了代码中的类型约束。

另一个要点是**状态的所有权**。游戏真相（谁是什么身份、谁还活着）集中在编排层，智能体只持有自己的记忆，两层不自动同步。这样设计的好处是信息隔离天然成立——智能体无法访问它没被写入的东西；代价是编排层必须显式地把每条信息"投递"出去，漏投一次，某个智能体就会基于过时的认知行动。

同时它也说明一个现实：框架版本、模型能力、接口协议之间存在隐性契约。DeepSeek 要求回传 `reasoning_content`、流式参数解析异常，都不是业务代码的问题，却能让整个应用崩溃。切换模型时，验证顺序应该是：能否调用 -> 能否正确调用工具 -> 多轮后是否仍然稳定，而不是只看第一句话能不能生成。
