---
title: "一文读懂 Triton Server：模型仓库、配置与推理协议"
date: 2026-09-08
lastmod: 2026-09-08
draft: false
showHero: false
description: "从 Triton Inference Server 的模型仓库、config.pbtxt、HTTP / gRPC 协议和动态批处理，理解如何把模型变成标准在线推理服务。"
tags:
  - Triton
  - PAI-EAS
  - ONNX
  - 模型部署
categories:
  - AI 部署
series:
  - HTDemucs ONNX
series_order: 3
---

{{< lead >}}
Triton Server 做的不是训练模型，而是把已经训练好的模型按标准协议托管起来，让它能被稳定调用、批处理、监控和扩展。
{{< /lead >}}

这篇交互笔记从“为什么不能只写一个 Flask 接口”讲起，重点拆解 Triton 的模型仓库结构、`config.pbtxt`、后端运行时、KServe v2 调用方式，以及在 PAI-EAS 上用镜像部署时真正需要对齐的几件事。

可以先把 Triton 理解成：

```text
模型文件
  + config.pbtxt
  + 版本目录
  -> Triton 加载成标准推理 API
  -> 云平台负责网关、鉴权、资源和扩缩容
```

{{< button href="interactive.html" target="_blank" rel="noopener noreferrer" >}}打开完整交互笔记{{< /button >}}

<style>
  .triton-server-frame { width: 100%; height: 920px; border: 0; border-radius: 12px; overflow: hidden; background: #07130f; }
  @media (max-width: 720px) { .triton-server-frame { display: none; } }
</style>

<iframe class="triton-server-frame" src="interactive.html" title="Triton Server 镜像部署交互笔记" sandbox="allow-scripts" loading="lazy"></iframe>
