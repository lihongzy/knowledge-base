# my_main.py
import os
from dotenv import load_dotenv
from my_llm import MyLLM # 注意：这里导入我们自己的类

# 加载环境变量
load_dotenv()

# 根据环境变量选择 provider：
# - 配置了 MODELSCOPE_API_KEY → 走 MyLLM 重写的自定义 ModelScope 分支
# - 否则 → 不传 provider，回退父类统一配置（LLM_MODEL_ID / LLM_API_KEY / LLM_BASE_URL，当前为 DeepSeek）
if os.getenv("MODELSCOPE_API_KEY"):
    llm = MyLLM(provider="modelscope")
else:
    print("未检测到 MODELSCOPE_API_KEY，使用统一配置的默认 provider（LLM_BASE_URL）")
    llm = MyLLM()

# 准备消息
messages = [{"role": "user", "content": "你好，请介绍一下你自己。"}]

# 发起调用，think等方法都已从父类继承，无需重写
response_stream = llm.think(messages)

# 打印响应
print("ModelScope Response:")
for chunk in response_stream:
    # chunk在my_llm库中已经打印过一遍，这里只需要pass即可
    # print(chunk, end="", flush=True)
    pass