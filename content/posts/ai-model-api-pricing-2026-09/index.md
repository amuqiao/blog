---
title: "AI 模型 API 价格月报（2026 年 9 月）：OpenAI、Claude 与 DeepSeek"
date: 2026-09-08
lastmod: 2026-09-08
draft: false
showHero: false
description: "冻结 2026 年 9 月 OpenAI、Claude 与 DeepSeek 主力模型的 API 文本价格，用价格图和文本表快速比较输入、缓存与输出单价。"
tags:
  - OpenAI
  - Claude
  - DeepSeek
  - GPT
  - API
  - ECharts
categories:
  - AI 工程
series:
  - AI 模型价格月报
series_order: 202609
---

{{< lead >}}
模型价格会变，历史价格仍有参考价值。这份月报冻结 2026 年 9 月 OpenAI、Claude 与 DeepSeek 主力文本模型的官方 API 价格，方便横向比较，也方便以后按月份回看价格变化。
{{< /lead >}}

图表和下方价格表由同一份 `pricing.json` 生成；DeepSeek 因为区分峰时与谷时，所以分别列出。

## 价格图

<p id="model-pricing-meta" class="model-pricing-meta"></p>
<div id="model-pricing-chart" class="model-pricing-chart" role="img" aria-label="AI 模型 API 价格图"></div>

## 文本价格表

<div class="model-pricing-table-wrap">
  <table class="model-pricing-table">
    <thead>
      <tr>
        <th scope="col">供应商</th>
        <th scope="col">模型</th>
        <th scope="col">费率</th>
        <th scope="col">输入</th>
        <th scope="col">缓存读取</th>
        <th scope="col">输出</th>
      </tr>
    </thead>
    <tbody id="model-pricing-table-body"></tbody>
  </table>
</div>

<script src="https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js"></script>
<script>
  (async () => {
    const response = await fetch(new URL("pricing.json", window.location.href));
    if (!response.ok) {
      throw new Error(`价格配置加载失败：HTTP ${response.status}`);
    }

    const pricing = await response.json();
    const chartElement = document.getElementById("model-pricing-chart");
    const tableBody = document.getElementById("model-pricing-table-body");
    const meta = document.getElementById("model-pricing-meta");

    chartElement.style.setProperty("--chart-height", `${pricing.chart.height}px`);
    chartElement.style.setProperty("--chart-mobile-height", `${pricing.chart.mobileHeight}px`);
    chartElement.setAttribute("aria-label", pricing.chart.title);
    meta.textContent = `快照：${pricing.snapshot} · 单位：${pricing.currency} / ${pricing.unit} · 横轴：${pricing.chart.xAxisLabel}`;

    for (const model of pricing.models) {
      const row = document.createElement("tr");
      const values = [
        model.provider,
        model.model,
        model.rate,
        `${pricing.currencySymbol}${model.input}`,
        `${pricing.currencySymbol}${model.cachedInput}`,
        `${pricing.currencySymbol}${model.output}`
      ];

      for (const value of values) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      }
      tableBody.appendChild(row);
    }

    const chart = echarts.init(chartElement);
    const labels = pricing.models.map((model) =>
      model.rate === "标准" ? model.model : `${model.model}（${model.rate}）`
    );

    const buildOption = () => {
      const textColor = getComputedStyle(chartElement).color;
      return {
        baseOption: {
          color: ["#2563eb", "#16a34a", "#dc2626"],
          title: { text: pricing.chart.title, left: "center", textStyle: { color: textColor } },
          tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            valueFormatter: (value) => `${pricing.currencySymbol}${value}`
          },
          legend: { top: 34, data: ["输入", "缓存读取", "输出"], textStyle: { color: textColor } },
          grid: { top: 82, right: 28, bottom: 48, left: 190 },
          xAxis: {
            type: pricing.chart.xAxisType,
            min: pricing.chart.minimum,
            axisLabel: { color: textColor, formatter: `${pricing.currencySymbol}{value}` },
            splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.28)" } }
          },
          yAxis: {
            type: "category",
            inverse: true,
            data: labels,
            axisLabel: { color: textColor, fontSize: 11, width: 174, overflow: "truncate" }
          },
          series: [
            { name: "输入", type: "bar", data: pricing.models.map((model) => model.input) },
            { name: "缓存读取", type: "bar", data: pricing.models.map((model) => model.cachedInput) },
            { name: "输出", type: "bar", data: pricing.models.map((model) => model.output) }
          ]
        },
        media: [{
          query: { maxWidth: 720 },
          option: {
            grid: { left: 128 },
            yAxis: { axisLabel: { fontSize: 10, width: 112 } }
          }
        }]
      };
    };

    chart.setOption(buildOption());

    const themeObserver = new MutationObserver(() => chart.setOption(buildOption()));
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    });

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(chartElement);
  })();
</script>

<style>
  .model-pricing-meta { font-size: 0.9rem; opacity: 0.72; }
  .model-pricing-chart { width: 100%; min-width: 0; height: var(--chart-height); }
  .model-pricing-table-wrap { width: 100%; overflow-x: auto; }
  .model-pricing-table { width: 100%; min-width: 680px; border-collapse: collapse; }
  .model-pricing-table th,
  .model-pricing-table td { padding: 0.65rem 0.75rem; border-bottom: 1px solid #d0d5dd; text-align: right; white-space: nowrap; }
  .model-pricing-table th:nth-child(-n+3),
  .model-pricing-table td:nth-child(-n+3) { text-align: left; }
  @media (max-width: 720px) {
    .model-pricing-chart { height: var(--chart-mobile-height); }
  }
</style>

## 怎么看这份价格表

- **输入价格**：发送给模型的普通输入 token 单价。
- **缓存读取**：重复使用已缓存上下文时的读取单价，各厂商的缓存规则并不完全相同。
- **输出价格**：模型生成 token 的单价，通常明显高于输入价格。

图表采用对数轴，因为最低价与最高价相差数千倍；柱子的视觉高度适合比较数量级，精确价格以文本表为准。

## 比价边界

这份表只比较标准文本 token 单价，不做请求成本估算，也不把不同模型的能力简化成价格排名。

| 未纳入基础对比的项目 | 为什么单独处理 |
| --- | --- |
| 推理档位 | `low`、`high` 等档位通常改变实际推理 token 和延迟，而不是提供一个固定价格倍率。 |
| Batch、Fast 与区域处理 | 属于不同服务层或处理方式，可能另有折扣或加价。 |
| 超长上下文 | 部分厂商会在输入超过阈值后使用另一套费率。 |
| 工具调用与多模态 | 搜索、图像、音频等可能按次或按其他单位收费。 |
| Claude 缓存写入 | 写入价格还与缓存 TTL 有关，本表只保留跨厂商更容易比较的缓存读取价。 |

价格低不等于完成任务的总成本低。正式选型时，还需要用自己的任务集比较正确率、延迟、实际 token 消耗和返工次数。

## 数据来源

- [OpenAI 模型总览](https://developers.openai.com/api/docs/models/)与各模型详情页。
- [Claude 模型总览](https://platform.claude.com/docs/en/models/overview)与 [Claude API 定价](https://platform.claude.com/docs/en/about-claude/pricing)。
- [DeepSeek Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/)与 [DeepSeek V4 发布说明](https://api-docs.deepseek.com/news/news260813/)。
