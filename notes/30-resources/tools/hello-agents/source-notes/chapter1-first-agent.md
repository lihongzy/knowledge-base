# 第一章：第一个智能旅行助手

源码：[FirstAgentTest.py](../code/chapter1/FirstAgentTest.py)

## 学习目标

理解 Agent 如何在“思考 -> 调用工具 -> 获取结果 -> 再思考”的循环中完成任务。

## 项目功能

用户提出旅游需求后，程序先让大语言模型决定下一步行动，再调用相应工具查询天气或搜索景点，最后整合结果并输出回答。

## 核心模块

### `get_weather`

调用 `wttr.in` 获取指定城市的天气和温度。

### `get_attraction`

通过 Tavily 搜索与城市和天气匹配的旅游景点。

### `OpenAICompatibleClient`

通过 OpenAI Python SDK 调用兼容 OpenAI Responses 格式的中转 API。

### `available_tools`

将天气和景点搜索函数注册为工具字典，供程序根据模型输出调用。

## Agent 执行流程

```text
用户请求
-> LLM 输出 Thought 和 Action
-> 程序解析 Action
-> 调用天气或搜索工具
-> 将 Observation 写回上下文
-> LLM 决定下一步
-> Finish 输出最终答案
```

## 我的理解

Agent 的关键不是一次生成最终答案，而是让模型基于工具返回的观察结果持续选择下一步行动，直到能够完成任务。
