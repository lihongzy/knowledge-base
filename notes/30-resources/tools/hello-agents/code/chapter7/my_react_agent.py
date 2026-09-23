MY_REACT_PROMPT = """你是一个具备推理和行动能力的AI助手。你可以通过思考分析问题，然后调用合适的工具来获取信息，最终给出准确的答案。

## 可用工具
{tools}

## 工作流程
请严格按照以下格式进行回应，每次只能执行一个步骤：

Thought: 你的思考过程，用于分析问题、拆解任务和规划下一步行动。
Action: 你决定采取的行动，必须是以下格式之一：
- `{{tool_name}}[{{tool_input}}]` - 调用指定工具
- `Finish[最终答案]` - 当你有足够信息给出最终答案时

## 重要提醒
1. 每次回应必须包含Thought和Action两部分
2. 工具调用的格式必须严格遵循：工具名[参数]
3. 只有当你确信有足够信息回答问题时，才使用Finish
4. 如果工具返回的信息不够，继续使用其他工具或相同工具的不同参数

## 当前任务
**Question:** {question}

## 执行历史
{history}

现在开始你的推理和行动：
"""

import re
from typing import Optional, List, Tuple
from hello_agents import ReActAgent, HelloAgentsLLM, Config, Message, ToolRegistry

class MyReActAgent(ReActAgent):
    """
    重写的ReAct Agent - 推理与行动结合的智能体
    """

    def __init__(
        self,
        name: str,
        llm: HelloAgentsLLM,
        tool_registry: ToolRegistry,
        system_prompt: Optional[str] = None,
        config: Optional[Config] = None,
        max_steps: int = 5,
        custom_prompt: Optional[str] = None
    ):
        # 注意：hello-agents 1.0.0 的 ReActAgent 签名为 (name, llm, tool_registry, system_prompt, config, max_steps)，
        # 必须用关键字传参，否则 system_prompt 会被误传给 tool_registry
        # 基类默认的系统提示词面向 Function Calling（Thought/Finish 工具），
        # 与本文件基于文本格式（Thought:/Action:）的 ReAct 冲突，故显式提供匹配的系统提示词
        default_system_prompt = (
            "你是一个具备推理和行动能力的AI助手，"
            "请严格按照用户消息中规定的 Thought/Action 格式逐步回应。"
        )
        super().__init__(
            name=name,
            llm=llm,
            tool_registry=tool_registry,
            system_prompt=system_prompt or default_system_prompt,
            config=config,
            max_steps=max_steps
        )
        # tool_registry 已由基类完成保存与兼容处理（未传时自动创建）
        self.max_steps = max_steps
        self.current_history: List[str] = []
        self.prompt_template = custom_prompt if custom_prompt else MY_REACT_PROMPT
        print(f"✅ {name} 初始化完成，最大步数: {max_steps}")

    def run(self, input_text: str, **kwargs) -> str:
        """运行ReAct Agent"""
        self.current_history = []
        current_step = 0

        print(f"\n🤖 {self.name} 开始处理问题: {input_text}")

        while current_step < self.max_steps:
            current_step += 1
            print(f"\n--- 第 {current_step} 步 ---")

            # 1. 构建提示词
            tools_desc = self.tool_registry.get_tools_description()
            history_str = "\n".join(self.current_history)
            prompt = self.prompt_template.format(
                tools=tools_desc,
                question=input_text,
                history=history_str
            )

            # 2. 调用LLM
            messages = [{"role": "user", "content": prompt}]
            response_text = self.llm.invoke(messages, **kwargs).content

            # 3. 解析输出
            thought, action = self._parse_output(response_text)

            # 4. 检查完成条件
            if action and action.startswith("Finish"):
                final_answer = self._parse_action_input(action)
                self.add_message(Message(input_text, "user"))
                self.add_message(Message(final_answer, "assistant"))
                return final_answer

            # 若模型没有输出 Action（直接给出了答案），将文本作为最终回答
            if not action:
                final_answer = (thought or response_text).strip()
                self.add_message(Message(input_text, "user"))
                self.add_message(Message(final_answer, "assistant"))
                return final_answer

            # 5. 执行工具调用
            if action:
                tool_name, tool_input = self._parse_action(action)
                observation = self.tool_registry.execute_tool(tool_name, tool_input)
                # hello-agents 1.0.0 中 execute_tool 返回 ToolResponse 对象，取其中的文本内容
                observation_text = getattr(observation, "text", None) or str(observation)
                self.current_history.append(f"Action: {action}")
                self.current_history.append(f"Observation: {observation_text}")

        # 达到最大步数
        final_answer = "抱歉，我无法在限定步数内完成这个任务。"
        self.add_message(Message(input_text, "user"))
        self.add_message(Message(final_answer, "assistant"))
        return final_answer

    def _parse_output(self, text: str) -> Tuple[Optional[str], Optional[str]]:
        """从模型输出中解析 Thought 和 Action 两部分"""
        thought_match = re.search(
            r"Thought:\s*(.+?)(?=\n\s*Action:|\Z)", text, re.DOTALL
        )
        action_match = re.search(r"Action:\s*(.+)", text)

        thought = thought_match.group(1).strip() if thought_match else None
        action = action_match.group(1).strip() if action_match else None
        return thought, action

    def _parse_action(self, text: str) -> Tuple[str, str]:
        """解析形如 `tool_name[tool_input]` 的动作，返回 (工具名, 工具输入)"""
        match = re.match(r"(\w+)\s*\[\s*(.*)\s*\]", text, re.DOTALL)
        if match:
            return match.group(1), match.group(2).strip()
        # 格式不符时兜底：把整个文本当作输入，工具名置空
        return "", text

    def _parse_action_input(self, text: str) -> str:
        """提取 Finish[最终答案] 方括号内的内容"""
        match = re.search(r"\[\s*(.*)\s*\]", text, re.DOTALL)
        return match.group(1).strip() if match else text