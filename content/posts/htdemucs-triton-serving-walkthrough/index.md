---
title: "一文读懂 htdemucs on Triton：从一个模型目录，到一次人声分离"
date: 2026-09-10T15:40:00+08:00
draft: false
description: "/v2/health/ready 返回 200 之后，凭什么说这个服务真的能分离音频？沿着一条走通了的链路走 17 站：目录怎么被 Triton 读、EAS 怎么挂载启动、每一层就绪各自证明了什么、一条请求进来经过谁的手、以及跑起来之后该看哪些数。每站都给代码、原理、验证方式和坏掉的样子。"
showTableOfContents: false
tags:
  - Triton
  - PAI-EAS
  - htdemucs
  - 模型部署
  - 可视化
categories:
  - 模型服务
series:
  - AI 学习路线
series_order: 6
---

`/v2/health/ready` 返回 200，只证明**模型文件按契约装载成功**。它没有、也不可能证明「喂一段真实音频进去能出对的结果」——中间还隔着形状契约、Python 编排层、对象存储读写，以及一条一首歌要跑上百次子推理的流水线。任何一环坏了，ready 照样是 200。

这篇沿着一条**已经在跑的**链路走 17 站：四个 302 MB 的 ONNX 模型加一个 Python 编排层，放在 OSS 上，由 PAI-EAS 的 Triton 容器挂载运行。

```text
目录契约 -> EAS 挂载启动 -> 冷启动加载 -> 各层就绪 -> 最小探针
        -> 请求契约 -> 解码 -> 切段 -> 四模型子推理 -> 重叠相加 -> 混音上传
        -> 运行时观测 -> 排障回退
```

每一站固定给四样东西：**代码在哪个函数、它做了什么、为什么必须这么做、这一站坏了长什么样。** 读者不需要音视频背景，音频的最小心智模型在第 02 站建立。

{{< button href="interactive.html" target="_blank" rel="noopener noreferrer" >}}打开完整交互长卷{{< /button >}}

<style>
  .tw-embed { width: 100%; height: 880px; border: 1px solid #C9D2D4; border-radius: 3px; background: #EEF1F2; }
  @media (max-width: 720px) { .tw-embed { display: none; } }
</style>

<iframe class="tw-embed" src="interactive.html" title="一文读懂 htdemucs on Triton · 交互长卷" sandbox="allow-scripts" loading="lazy"></iframe>
