---
title: "一文读懂 Transformer：从一次可微的字典查询推出全部零件"
date: 2026-09-10T00:30:00+08:00
draft: false
description: "把注意力理解成一次可微的字典查询，再由这次查询的五个天然漏洞逐个推出位置编码、多头、FFN、残差、Norm 和 Mask，最后落到 O(n²) 的账单与 KV cache 显存估算。18 节交互长卷。"
showTableOfContents: false
tags:
  - AI
  - Transformer
  - Attention
  - 可视化
categories:
  - AI 基础
series:
  - AI 学习路线
series_order: 2
---

Transformer 的零件表看着很长：位置编码、多头、FFN、残差、LayerNorm、Mask。但它们不是并列的设计选择。

只要接受**「让每个位置自己去序列里做一次可微的字典查询」**这一个动作，剩下每个零件都是这次查询某个具体漏洞的补丁：

```text
一次加权平均检索  ->  它有哪五个漏洞  ->  每个漏洞逼出哪个零件  ->  O(n²) 的账单在哪
```

这份交互长卷按这条因果链走一遍，主问题只有一个——**怎么让「它」一步读到「猫」**。读完的目标不是记住结构，是能自己把结构推出来。

{{< button href="interactive.html" target="_blank" rel="noopener noreferrer" >}}打开完整交互长卷{{< /button >}}

<style>
  .tx-embed { width: 100%; height: 880px; border: 1px solid #DED6C9; border-radius: 2px; background: #FAF9F5; }
  @media (max-width: 720px) { .tx-embed { display: none; } }
</style>

<iframe class="tx-embed" src="interactive.html" title="一文读懂 Transformer · 交互长卷" sandbox="allow-scripts" loading="lazy"></iframe>
