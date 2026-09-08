---
title: "HTDemucs-FT ONNX：模型讲解与部署路径"
date: 2026-09-08
lastmod: 2026-09-08
draft: false
showHero: false
description: "理解 HTDemucs-FT ONNX 的模型定位、输入输出、ONNX 推理边界、切片 overlap-add，以及从本地推理到阿里云部署的整体路径。"
tags:
  - AI
  - 音频
  - ONNX
  - onnxruntime
  - HTDemucs
categories:
  - AI 音频
series:
  - HTDemucs ONNX
series_order: 2
---

{{< lead >}}
HTDemucs-FT ONNX 的价值不是“又一个模型文件”，而是把 PyTorch 里的音乐源分离模型整理成更容易跨平台推理和部署的 ONNX 形态。
{{< /lead >}}

这篇交互笔记把模型解释和工程路径放在一起看：先理解 HTDemucs-FT 为什么是四个 specialist 组成的模型袋，再看 ONNX 导出后输入输出、STFT / iSTFT、固定片段推理、overlap-add 和云端部署会带来哪些工程约束。

阅读时抓住这条主线：

```text
模型能力
  -> ONNX 运行形态
  -> 音频前后处理
  -> 本地 onnxruntime 验证
  -> 云端推理服务部署
```

{{< button href="interactive.html" target="_blank" rel="noopener noreferrer" >}}打开完整交互笔记{{< /button >}}

<style>
  .htdemucs-deploy-frame { width: 100%; height: 920px; border: 0; border-radius: 12px; overflow: hidden; background: #0f172a; }
  @media (max-width: 720px) { .htdemucs-deploy-frame { display: none; } }
</style>

<iframe class="htdemucs-deploy-frame" src="interactive.html" title="HTDemucs-FT ONNX 模型讲解与部署路径" sandbox="allow-scripts" loading="lazy"></iframe>
