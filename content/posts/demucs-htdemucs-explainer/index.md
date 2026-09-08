---
title: "一文读懂 Demucs / HTDemucs：把一首歌拆回四轨"
date: 2026-09-08
lastmod: 2026-09-08
draft: false
showHero: false
description: "从音乐源分离任务、Demucs 家族演化、HTDemucs 双域架构、Transformer 融合和四轨输出，理解一首混音如何被拆回 drums、bass、other、vocals。"
tags:
  - AI
  - 音频
  - Demucs
  - HTDemucs
categories:
  - AI 音频
series:
  - HTDemucs ONNX
series_order: 1
---

{{< lead >}}
音乐源分离的目标很直观：输入一首混好的歌，输出 drums、bass、other、vocals 四条可单独听的音轨。Demucs / HTDemucs 是这条路线里最值得先理解的一组开源模型。
{{< /lead >}}

这篇交互笔记先回答“它到底在解决什么问题”，再顺着三代演化、双域架构、训练与推理流程、适用边界，把 HTDemucs 的核心直觉串起来。

核心线索是：

```text
混音波形
  -> 时域支路看瞬态和相位
  -> 频域支路看音高和谐波
  -> Transformer 在瓶颈处融合两种证据
  -> 输出四条同长度 stereo stem
```

{{< button href="interactive.html" target="_blank" rel="noopener noreferrer" >}}打开完整交互笔记{{< /button >}}

<style>
  .demucs-explainer-frame { width: 100%; height: 920px; border: 0; border-radius: 12px; overflow: hidden; background: #0f172a; }
  @media (max-width: 720px) { .demucs-explainer-frame { display: none; } }
</style>

<iframe class="demucs-explainer-frame" src="interactive.html" title="一文读懂 Demucs / HTDemucs 音乐源分离" sandbox="allow-scripts" loading="lazy"></iframe>
