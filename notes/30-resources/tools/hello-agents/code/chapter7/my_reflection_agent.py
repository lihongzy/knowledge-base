# my_reflection_agent.py
from typing import Optional, Dict
from hello_agents import ReflectionAgent, HelloAgentsLLM, Config, Message

# 默认三阶段提示词：初始执行 -> 反思 -> 优化
MY_REFLECTION_PROMPTS = {
    "initial": """请完成以下任务：

{task}

请给出你的回答。""",

    "reflect": """请仔细审查以下回答，并找出可能的问题或改进空间：

# 原始任务:
{task}

# 当前回答:
{content}

请分析这个回答的质量，指出不足之处，并提出具体的改进建议。
如果回答已经很好，请只回答"无需改进"。""",

    "refine": """请根据反馈意见改进你的回答：

# 原始任务:
{task}

# 上一轮回答:
{content}

# 反馈意见:
{feedback}

请提供一个改进后的完整回答。"""
}

class MyReflectionAgent(ReflectionAgent):
    """
    重写的Reflection Agent - 自我反思与迭代优化的智能体

    通过"初始执行 -> 反思 -> 优化"的循环提升输出质量，
    支持通过 custom_prompts 自定义三个阶段的提示词（如代码生成场景）。
    """

    def __init__(
        self,
        name: str,
        llm: HelloAgentsLLM,
        system_prompt: Optional[str] = None,
        config: Optional[Config] = None,
        max_iterations: int = 3,
        custom_prompts: Optional[Dict[str, str]] = None
    ):
        super().__init__(name, llm, system_prompt, config, max_iterations=max_iterations)

        # 合并默认提示词，允许只覆盖其中某个阶段
        self.prompts = dict(MY_REFLECTION_PROMPTS)
        if custom_prompts:
            self.prompts.update(custom_prompts)

        print(f"✅ {name} 初始化完成，最大反思迭代次数: {max_iterations}")

    def run(self, input_text: str, **kwargs) -> str:
        """运行Reflection Agent：初始执行 -> 反思 -> 优化循环"""
        print(f"\n🤖 {self.name} 开始处理任务: {input_text}")

        # 1. 初始执行
        print("\n--- 正在进行初始尝试 ---")
        current_result = self._execute(self.prompts["initial"].format(task=input_text), **kwargs)

        # 2. 迭代：反思与优化
        for i in range(self.max_iterations):
            print(f"\n--- 第 {i + 1}/{self.max_iterations} 轮迭代 ---")

            print("\n-> 正在进行反思...")
            feedback = self._execute(
                self.prompts["reflect"].format(task=input_text, content=current_result),
                **kwargs
            )

            # 反思认为无需改进，提前结束
            if "无需改进" in feedback or "no need for improvement" in feedback.lower():
                print("\n✅ 反思认为结果已无需改进，任务完成。")
                break

            print("\n-> 正在进行优化...")
            current_result = self._execute(
                self.prompts["refine"].format(task=input_text, content=current_result, feedback=feedback),
                **kwargs
            )

        # 保存到历史记录
        self.add_message(Message(input_text, "user"))
        self.add_message(Message(current_result, "assistant"))
        print(f"\n--- 任务完成 ---\n最终结果:\n{current_result}")

        return current_result

    def _execute(self, prompt: str, **kwargs) -> str:
        """调用LLM并返回文本响应"""
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": prompt}
        ]
        return self.llm.invoke(messages, **kwargs).content
