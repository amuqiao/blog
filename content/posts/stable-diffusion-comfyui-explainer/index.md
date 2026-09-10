---
title: "一文读懂 Stable Diffusion：跟着 ComfyUI 的数据流走一遍文生图"
date: 2026-09-10T01:40:00+08:00
draft: false
description: "一句提示词是怎么变成一张图的。从「模型不是在画、是在擦」这个第一因出发，沿 ComfyUI 的六个节点走一遍：Load Checkpoint、CLIP 文本编码、潜空间、KSampler、VAE 解码，讲清每个节点在做什么、挂在它上面的参数动一下会怎样，最后给一条排障决策链。"
showTableOfContents: false
tags:
  - AI
  - Stable Diffusion
  - ComfyUI
  - 扩散模型
  - 可视化
categories:
  - AI 基础
series:
  - AI 学习路线
series_order: 3
---

你在 ComfyUI 里敲下一句提示词，点 Queue，几秒后出来一张图。中间这几秒到底发生了什么？

它**不是「画」出来的**。模型从一团纯随机噪声出发，按提示词的指引，一步步把不该有的东西**减掉**——去噪不是往上加细节，是做减法。

```text
纯噪声 -> 每步预测「哪部分是噪声」并减掉 -> 在潜空间里重复几十次 -> VAE 解码回像素
```

这份交互长卷沿 ComfyUI 的六个节点走一遍，每个节点讲清它在做什么、以及挂在它上面的参数动一下会发生什么，最后给一条**排障决策链**：图不对时，该动哪个节点的哪个旋钮。

页面里所有的噪声、去噪轨迹与图像都是程序化实时算出来的，不是预渲染的截图。

{{< button href="interactive.html" target="_blank" rel="noopener noreferrer" >}}打开完整交互长卷{{< /button >}}

<style>
  .sd-embed { width: 100%; height: 880px; border: 1px solid #2E333C; border-radius: 4px; background: #14161B; }
  @media (max-width: 720px) { .sd-embed { display: none; } }
</style>

<iframe class="sd-embed" src="interactive.html" title="一文读懂 Stable Diffusion + ComfyUI · 交互长卷" sandbox="allow-scripts" loading="lazy"></iframe>
