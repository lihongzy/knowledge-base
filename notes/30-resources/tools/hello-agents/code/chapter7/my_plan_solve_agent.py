# my_plan_solve_agent.py
import re
from typing import Optional, List
from hello_agents import PlanSolveAgent, HelloAgentsLLM, Config, Message

# 规划器提示词：将复杂问题分解为可执行的步骤列表
MY_PLANNER_PROMPT = """你是一个顶级的AI规划专家。你的任务是将用户提出的复杂问题分解成一个由多个简单步骤组成的行动计划。
请确保计划中的每个步骤都是一个独立的、可执行的子任务，并且严格按照逻辑顺序排列。

## 输出格式
请严格使用以下格式输出计划：
1. [第一步的任务描述]
2. [第二步的任务描述]
...

## 问题
{question}

现在开始规划：
"""

# 执行器提示词：聚焦当前步骤，结合历史结果给出答案
MY_EXECUTOR_PROMPT = """你是一位顶级的AI执行专家。你的任务是严格按照给定的计划，一步步地解决问题。
请专注于解决当前步骤，并输出该步骤的最终答案。

# 原始问题:
{question}

# 完整计划:
{plan}

# 历史步骤与结果:
{history}

# 当前步骤:
{step}

请执行当前步骤并给出结果：
"""

class MyPlanAndSolveAgent(PlanSolveAgent):
    """
    重写的Plan-and-Solve Agent - 规划与执行结合的智能体

    工作流程：
    1. Plan：将复杂问题分解为多个简单步骤
    2. Solve：按照计划逐步执行，每步结果带入下一步上下文
    3. 得出最终答案

    与框架基类不同，这里采用纯文本提示词解析计划，
    不依赖 Function Calling，兼容更多模型服务。
    """

    def __init__(
        self,
        name: str,
        llm: HelloAgentsLLM,
        system_prompt: Optional[str] = None,
        config: Optional[Config] = None,
        planner_prompt: Optional[str] = None,
        executor_prompt: Optional[str] = None
    ):
        super().__init__(name, llm, system_prompt, config)
        self.planner_prompt = planner_prompt or MY_PLANNER_PROMPT
        self.executor_prompt = executor_prompt or MY_EXECUTOR_PROMPT
        print(f"✅ {name} 初始化完成")

    def run(self, input_text: str, **kwargs) -> str:
        """运行Plan-and-Solve Agent"""
        print(f"\n🤖 {self.name} 开始处理问题: {input_text}")

        # 1. 生成计划
        plan = self._plan(input_text, **kwargs)
        if not plan:
            final_answer = "无法生成有效的行动计划，任务终止。"
            self.add_message(Message(input_text, "user"))
            self.add_message(Message(final_answer, "assistant"))
            return final_answer

        # 2. 逐步执行计划
        final_answer = self._solve(input_text, plan, **kwargs)

        # 保存到历史记录
        self.add_message(Message(input_text, "user"))
        self.add_message(Message(final_answer, "assistant"))
        print(f"\n--- 任务完成 ---\n最终答案: {final_answer}")

        return final_answer

    def _plan(self, question: str, **kwargs) -> List[str]:
        """调用LLM生成计划，并解析为步骤列表"""
        print("\n--- 正在生成计划 ---")
        prompt = self.planner_prompt.format(question=question)
        response_text = self._invoke(prompt, **kwargs)

        # 匹配 "1. xxx" / "1、xxx" / "1) xxx" 格式的编号行
        pattern = r'^\s*(\d+)[\.、\)：:]\s*(.+)$'
        steps = [m[1].strip() for m in re.findall(pattern, response_text, re.MULTILINE)]

        if steps:
            print("✅ 计划已生成:")
            for i, step in enumerate(steps, 1):
                print(f"  {i}. {step}")
        else:
            print("⚠️ 未能解析出有效计划，将问题作为单步处理")
            steps = [question]

        return steps

    def _solve(self, question: str, plan: List[str], **kwargs) -> str:
        """按照计划逐步执行，每步结果累积到历史上下文中"""
        print("\n--- 正在执行计划 ---")
        plan_text = "\n".join([f"{i}. {step}" for i, step in enumerate(plan, 1)])
        history: List[str] = []
        final_answer = ""

        for i, step in enumerate(plan, 1):
            print(f"\n-> 正在执行步骤 {i}/{len(plan)}: {step}")
            prompt = self.executor_prompt.format(
                question=question,
                plan=plan_text,
                history="\n\n".join(history) if history else "无",
                step=step
            )
            result = self._invoke(prompt, **kwargs)
            history.append(f"步骤 {i}: {step}\n结果: {result}")
            final_answer = result
            print(f"✅ 步骤 {i} 已完成，结果: {result}")

        return final_answer

    def _invoke(self, prompt: str, **kwargs) -> str:
        """调用LLM并返回文本响应"""
        messages = [{"role": "user", "content": prompt}]
        return self.llm.invoke(messages, **kwargs).content
