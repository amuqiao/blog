---
title: "AI 模型 API 价格月报（2026 年 9 月）：OpenAI、Claude 与 DeepSeek"
date: 2026-09-08
lastmod: 2026-09-08
draft: false
showHero: false
description: "冻结 2026 年 9 月 OpenAI、Claude 与 DeepSeek 主力模型的 API 文本价格、缓存价格、推理档位和上下文，并用交互估算器比较单次请求成本。"
tags:
  - OpenAI
  - Claude
  - DeepSeek
  - GPT
  - API
  - ECharts
  - 模型选型
categories:
  - AI 工程
series:
  - AI 模型价格月报
series_order: 202609
---

{{< lead >}}
模型价格会变，旧价格也有参考价值。这份月报冻结 2026 年 9 月的官方 API 价格，把 OpenAI、Claude 与 DeepSeek 的主力文本模型放到同一套输入、输出、缓存和推理口径中比较。
{{< /lead >}}

这是一份**月度价格快照**，不是实时价格接口，也不是模型排行榜。以后价格发生变化时新增月份文章，不覆盖本期数据，才能回看同一模型何时涨价、降价或改变计费规则。

本期价格截至 2026-09-08，单位为美元 / 百万文本 token。OpenAI 与 Claude 使用标准 API 价格；DeepSeek 自 2026-08-16 起区分峰时与谷时，交互页可切换两种费率。Batch、Fast、区域处理、工具调用及云厂商加价不纳入基础柱状图。

```text
供应商 + 模型决定 token 单价
推理档位影响实际推理 token、延迟与完成率
输入 / 输出 / 缓存命中共同决定请求成本
```

{{< button href="interactive.html" target="_blank" rel="noopener noreferrer" >}}打开完整对比图{{< /button >}}

<style>
  .model-cost-frame { width: 100%; height: 1900px; border: 0; border-radius: 12px; overflow: hidden; background: #f6f7fb; }
  @media (max-width: 720px) { .model-cost-frame { display: none; } }
</style>

<iframe class="model-cost-frame" src="interactive.html" title="2026 年 9 月 AI 模型 API 价格交互对比" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" loading="lazy"></iframe>

## 先分清三件事

`Claude Opus 5`、`high` 与 DeepSeek 的“峰时”不在同一个维度：Opus 是模型，`high` 是推理投入档位，峰时是计费时段。它们必须分别建模。

| 维度 | 决定什么 | 是否有固定单价 |
| --- | --- | --- |
| 模型 | 能力定位、上下文、输入与输出 token 单价 | 有 |
| 推理档位 | 推理深度、延迟、完成率和实际推理 token | 通常没有独立 token 单价，成本通过实际用量变化 |
| 缓存状态 | 输入是未命中、读取缓存还是写入缓存 | 各供应商术语与费率不同 |
| 计费时段 / 服务层 | DeepSeek 峰谷、Fast、Batch、区域处理等 | 可能直接改变单价 |

推理档位本身不是可靠的价格倍率。同一个 `high` 在不同模型、不同任务上会产生不同 token 数，供应商之间也没有统一语义。预算时应从 API usage 中采集实际推理 token 或总输出 token，按任务类型统计中位数与 P90，再填入估算器。

## 结论先行

| 任务类型 | 优先考虑 | 原因 |
| --- | --- | --- |
| 最高能力候选 | GPT-6 Astra / Claude Fable 5.1 | 先用自己的高难任务评测完成率，再判断高单价是否减少返工。 |
| 复杂 agent 与专业工作 | GPT-5.6 Sol / Claude Opus 5 | 适合作为能力优先但仍关注成本的起点。 |
| 日常生产平衡 | GPT-5.6 Terra / Claude Sonnet 5 | 用代表性任务比较质量、延迟和每个成功任务成本。 |
| 高吞吐与成本敏感 | GPT-5.6 Luna / Claude Haiku 4.5 / DeepSeek V4 Flash | 先确认低价模型能否稳定达到业务验收线。 |
| 峰谷可调度任务 | DeepSeek V4 Flash / Pro | 谷时价格更低，适合能够延迟执行的批处理。 |

这里的价格只包含文本 token。图像、网页搜索、电脑操作等工具可能单独计费；超长上下文、Batch、Fast、区域处理与第三方云平台也会改变账单。最终选型应比较**每个成功任务的总成本**，而不是只比较每百万 token 的最低数字。

## 数据来源

- [OpenAI 模型总览](https://developers.openai.com/api/docs/models/)与各模型详情页。
- [Claude 模型总览](https://platform.claude.com/docs/en/models/overview)与 [Claude API 定价](https://platform.claude.com/docs/en/about-claude/pricing)。
- [DeepSeek Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/)与 [DeepSeek V4 发布说明](https://api-docs.deepseek.com/news/news260813/)。
