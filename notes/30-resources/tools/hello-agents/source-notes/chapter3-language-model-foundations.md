# 第三章：语言模型基础

源码：[BPE.py](../code/chapter3/BPE.py)、[N_gram.py](../code/chapter3/N_gram.py)、[Word_Embedding.py](../code/chapter3/Word_Embedding.py)、[Transformer.py](../code/chapter3/Transformer.py)、[Qwen.py](../code/chapter3/Qwen.py)

## 学习目标

理解大语言模型处理文本和生成回答的基本过程：文本会先被切分为 Token，再转换为向量，模型根据上下文预测下一个 Token，并重复这个过程生成完整回答。

```text
文本
-> Tokenizer 切分 Token
-> Token 转换为向量
-> Transformer 计算上下文关系
-> 预测下一个 Token
-> 重复预测并生成回答
```

## N-gram：用统计概率预测下一个词

`N_gram.py` 使用语料中连续词语出现的次数计算条件概率。

对于 `datawhale agent learns`，程序近似计算：

```text
P(datawhale agent learns)
= P(datawhale)
× P(agent | datawhale)
× P(learns | agent)
```

含义是：先计算 `datawhale` 出现的概率，再计算它后面出现 `agent` 的概率，最后计算 `agent` 后面出现 `learns` 的概率。

现代大语言模型同样在预测下一个 Token，但能参考更长的上下文，不局限于相邻的一两个词。

## 词向量：用数字表示语义

`Word_Embedding.py` 使用二维数组模拟词向量。计算机不能直接处理 `king` 或 `queen` 等文字，需要先将它们表示为数值向量。

### 什么是向量

向量是一组按固定顺序排列的数字，例如二维向量 `[0.9, 0.8]`。在大语言模型中，一个 Token 会对应一个高维向量，常见维度为数百到数千维。每一维不需要人为指定具体含义；模型会在训练过程中调整这些数值，使整组数字能够表达 Token 在不同语言环境中的特征。

例如，模型可以将语义或用法相近的 Token 放在向量空间中较接近的位置。代码使用余弦相似度计算两个向量方向的接近程度，值越接近 `1`，代表它们在这个向量空间中越相似。

### 向量有什么用

Token ID 只是一个编号，例如 `42` 和 `43` 的数值接近不代表两个词的意思接近。向量则是模型可以进行加法、乘法、相似度计算和神经网络变换的数值表示。

Transformer 的注意力机制会基于 Token 向量生成 `Q`、`K`、`V`，通过向量点积计算当前 Token 应该关注上下文中的哪些 Token。前馈网络也持续变换这些向量，让每个位置的向量逐层融合语法、指代和语义等上下文信息。

### 向量为什么与下一个 Token 预测有关

模型输入的一串 Token ID 会先查找对应的初始向量。经过多层 Transformer 后，最后一个位置得到一个包含上下文信息的隐藏向量。例如输入“今天天气很”，该向量会同时编码“今天”“天气”“很”等上下文。

模型再将这个隐藏向量与词表中每个 Token 的输出向量计算分数，得到所有候选 Token 的概率分布：

```text
上下文隐藏向量
-> 与词表中每个候选 Token 计算分数
-> softmax 转换为概率
-> 选择或采样概率较高的下一个 Token
```

因此，大模型不是直接从文字中选择下一个词，而是在向量空间中将上下文表示转换为候选 Token 的概率。训练的目标就是不断调整这些向量和网络参数，让正确的下一个 Token 获得更高概率。

示例计算：

```text
king - man + woman ≈ queen
```

它表示向量可以保留部分语义关系。实际模型中的词向量通常有数百或数千个维度，并在训练中自动学习。

## BPE：将文本切分为 Token

`BPE.py` 演示 Byte Pair Encoding 的合并过程。

### 为什么要转换为 Token

模型不能直接计算文字字符串，只能计算固定形状的数字张量。因此文本必须先被拆成模型可识别的基本单位，并映射为 Token ID，之后才能查表得到词向量并输入 Transformer。

如果将每个完整词都作为一个 Token，词表会非常大，而且新词、人名、拼写变化或罕见词会找不到对应编号。若只按单个字符切分，任何文本都能表示，但序列会很长，模型计算注意力的成本更高。

Token 是这两种做法之间的折中：常见词或常见片段可以整体表示，罕见词仍可以拆为较小片段。例如一个未出现在词表中的词，也可以由多个已知子词 Token 组成。这样模型既能处理开放文本，又能控制词表和输入长度。

在生成阶段，模型也不是直接输出文字，而是先预测下一个 Token ID；Tokenizer 再将连续的 Token ID 解码为人类可读的文本。

程序从字符级表示开始，例如：

```text
h u g </w>
p u g </w>
```

它统计相邻 Token 对的频率，将最高频的组合合并，并重复多次。例如 `u` 和 `g` 经常相邻时，可能合并为 `ug`。

BPE 让模型既能用常见词或片段减少序列长度，也能将未见过的词拆成较小片段处理。

## Transformer：根据上下文理解 Token

`Transformer.py` 用 PyTorch 手写了原始 Transformer 的主要组成部分。

### 多头注意力

`MultiHeadAttention` 为每个 Token 计算与其他 Token 的关联强度。不同注意力头可以学习不同类型的关系，例如指代、语法关系或语义关联。

注意力机制的含义是：处理某个 Token 时，模型不平均看待句子中其他 Token，而是根据当前任务为它们分配不同的关注权重，再将重要信息汇总回来。

例如在“苹果从树上掉下来，因为它成熟了”中，处理“它”时，模型需要更关注“苹果”，而不是“树上”或“掉下来”。注意力机制使“它”对应的向量能从“苹果”获得更高权重的信息，从而形成带上下文含义的表示。

每个 Token 向量会经过三组可学习的线性变换，产生：

- `Q`（Query，查询）：当前 Token 想从上下文寻找什么信息。
- `K`（Key，键）：每个 Token 提供什么可被匹配的特征。
- `V`（Value，值）：每个 Token 实际提供给其他 Token 的信息。

模型将当前 Token 的 `Q` 与所有 Token 的 `K` 做点积，得到关联分数。分数经缩放和 `softmax` 后成为权重，所有 `V` 按这些权重加权求和，得到当前 Token 融合上下文后的新向量。

核心计算为：

```text
Attention(Q, K, V) = softmax(QK^T / sqrt(d_k))V
```

其中 `sqrt(d_k)` 用于避免向量维度较高时分数过大；`softmax` 将分数转换为总和为 `1` 的权重。权重越高，表示当前 Token 从对应 Token 获取的信息越多。

“多头”表示这套计算会并行执行多次。不同注意力头使用不同的 Q/K/V 变换，因此可以同时关注不同关系；最后再将各头结果拼接并映射回模型向量维度。

### 位置编码

注意力机制本身没有顺序概念。`PositionalEncoding` 使用正弦和余弦函数生成位置向量，并将其加到 Token 向量上，使模型能够区分词语所在的位置。

### 前馈网络、残差连接和归一化

每层注意力后都包含前馈网络，随后通过残差连接和 `LayerNorm` 保留原始信息并让训练更稳定。

### 掩码

`generate_mask()` 会遮住补齐位置和未来位置。解码器在预测下一个 Token 时，只能看到已经生成的内容，不能提前看到答案后面的 Token。

## 运行 Qwen 模型

`Qwen.py` 使用 Hugging Face 的 `transformers` 库运行 `Qwen/Qwen1.5-0.5B-Chat`。

程序流程：

```text
加载 Tokenizer 和模型
-> 将 system 和 user 消息套入聊天模板
-> 编码为 Token ID
-> model.generate() 生成新的 Token ID
-> 解码为文本回答
```

`HF_ENDPOINT` 用于设置 Hugging Face 的镜像下载地址。`torch.cuda.is_available()` 会检测是否可使用 GPU；没有 GPU 时程序使用 CPU，但加载和生成会更慢。

## 原始 Transformer 与 Qwen 的关系

本章的 `Transformer.py` 包含 Encoder 和 Decoder，属于论文《Attention Is All You Need》中的原始架构。Qwen 和 GPT 这类文本生成模型主要采用 Decoder 的自回归生成思路：每次只预测一个下一个 Token，再将新 Token 作为后续输入的一部分。

## 我的理解

语言模型并不是一次性写出完整答案。它先将文本编码为 Token 和向量，借助 Transformer 建立上下文关联，然后反复预测最可能的下一个 Token。Agent 调用大语言模型时，底层完成的就是这种逐 Token 的生成过程。
