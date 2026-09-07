---
title: "一文读懂扩散模型家族：从加噪去噪到 Stable Diffusion 与 Sora"
date: 2026-09-07
draft: false
description: "一份扩散模型家族交互长卷：用家族地图、加噪去噪、采样、Latent Diffusion、Flow Matching、Guidance 和测验建立完整认知。"
tags:
  - AI
  - Diffusion
  - 生成模型
  - 可视化
categories:
  - AI 基础
series:
  - AI 学习路线
series_order: 1
---

<style>
  .diffusion-lab-frame {
    width: 100%;
    height: min(82vh, 900px);
    min-height: 720px;
    border: 0;
    border-radius: 12px;
    overflow: hidden;
    background: #f5f6f9;
  }
  @media (max-width: 720px) {
    .diffusion-lab-frame {
      display: none;
    }
  }
</style>

这是一份**扩散模型家族交互长卷**。它用家族地图、加噪/去噪动画、采样对比、Score/SDE 可视化、Latent 成本对比、Flow Matching 路径演示、Guidance 调节和归位测验，把扩散模型从核心直觉一路串到 Stable Diffusion 与 Sora 这类具体系统。

核心阅读线索是五个变量：

```text
数据表示在哪里 -> 路径怎么定义 -> 模型预测什么 -> 采样怎么走 -> 条件如何注入
```

后面的 DDPM、DDIM、Score/SDE、Latent Diffusion、DiT、Flow Matching、Consistency、CFG、Stable Diffusion、Sora，都可以放回这五个变量里理解。

{{< button href="interactive.html" target="_blank" rel="noopener noreferrer" >}}打开完整交互长卷{{< /button >}}

<iframe
  class="diffusion-lab-frame"
  src="interactive.html"
  title="扩散模型完整交互长卷"
  sandbox="allow-scripts"
  loading="lazy">
</iframe>
