---
title: "PAI-EAS Triton 服务并发排队问题：完整复盘"
date: 2026-09-09
lastmod: 2026-09-09
draft: false
description: "复盘 HTDemucs 服务并发 2 即排队的问题，理解 EAS 实例、Triton 模型实例、显存约束与水平扩容。"
tags:
  - Triton
  - PAI-EAS
  - HTDemucs
  - 性能优化
  - 并发
categories:
  - AI 部署
series:
  - HTDemucs ONNX
series_order: 5
---

{{< lead >}}
资源利用率没有跑满，不代表服务没有排队。可同时执行请求的模型实例数量，是判断并发能力的关键约束之一。
{{< /lead >}}

## 一、你的原始诉求

你有一个部署在 PAI-EAS 上的 **HTDemucs 音频分离模型**，使用 Triton Inference Server 推理。压测数据让你困惑：

| 指标 | 数值 | 你的疑问 |
| --- | --- | --- |
| 单次推理耗时 | **1.98s** | 基准 |
| 并发 2 的端到端 P50 | **3.96s** | 为什么不是约 2s？ |
| Triton 排队时间 | **1.62s** | 这排队是哪来的？ |
| 吞吐量 | **0.505 req/s** | 并发 2 为什么几乎没提升？ |
| GPU 利用率 | 17.8% | 资源明明没满啊 |
| GPU 显存 | 59.4% | 还有 40% 空闲 |
| CPU | 6% | 也很闲 |
| 内存 | 8.4% | 也很闲 |

**核心困惑**：资源都没满，为什么并发 2 就排队了？为什么吞吐量上不去？

---

## 二、问题定位：串行执行的根因

### 2.1 三层结构

你的服务由三层组成，每一层负责不同的事：

#### 字符图：适合复制和快速阅读

```text
┌────────────────────────────────────────────────┐
│                  用户请求                       │
│            HTTP -> EAS 网关 -> 服务             │
└────────────────────┬───────────────────────────┘
                     │
┌────────────────────▼───────────────────────────┐
│  EAS 实例（1 台）                                │
│  ecs.gn8is.4xlarge · 1 x L20 48GB · 16 CPU     │
│  ┌─────────────────────────────────────────┐   │
│  │  Docker 容器                             │   │
│  │  ┌───────────────────────────────────┐  │   │
│  │  │  Triton Inference Server          │  │   │
│  │  │  ┌─────────────────────────────┐  │  │   │
│  │  │  │  模型实例 x1（默认）           │  │  │   │
│  │  │  │  一次执行一个请求或 batch      │  │  │   │
│  │  │  └─────────────────────────────┘  │  │   │
│  │  └───────────────────────────────────┘  │   │
│  └─────────────────────────────────────────┘   │
└────────────────────────────────────────────────┘
```

<style>
  .service-stack-mermaid pre.mermaid {
    margin: 0;
    padding: 0;
    overflow-x: auto;
    background: transparent;
  }
  .service-stack-mermaid pre.mermaid svg {
    display: block;
    margin-inline: auto;
  }
  .service-stack-mermaid div.labelBkg,
  .service-stack-mermaid span.edgeLabel,
  .service-stack-mermaid span.edgeLabel p {
    color: #cbd5e1 !important;
    background: #0b1220 !important;
  }
  .service-stack-mermaid {
    margin: 1.25rem 0 1.75rem;
    padding: 1rem;
    overflow: hidden;
    border: 1px solid #334155;
    border-radius: 8px;
    background: #0b1220;
  }
</style>

#### Mermaid：突出请求流向

<div class="service-stack-mermaid">

{{< mermaid >}}
%%{init: {"flowchart": {"curve": "basis", "nodeSpacing": 36, "rankSpacing": 44}}}%%
flowchart TB
    request(["用户请求"])
    gateway(["EAS 网关<br/>接收并校验 HTTP 请求"])
    service["EAS 服务<br/>选择可用计算副本"]

    subgraph eas["EAS 实例 x1 · ecs.gn8is.4xlarge · L20 48GB · 16 CPU"]
        direction TB
        subgraph docker["Docker 容器"]
            direction TB
            triton["Triton Inference Server"]
            model[["模型实例 x1（默认）<br/>一次执行一个请求或 batch"]]
        end
    end
    request -->|HTTP| gateway
    gateway -->|路由| service
    service -->|转发| triton
    triton -->|调度| model

    classDef request fill:#1e293b,stroke:#94a3b8,color:#f8fafc,stroke-width:1.5px;
    classDef gateway fill:#1d4ed8,stroke:#93c5fd,color:#ffffff,stroke-width:2px;
    classDef service fill:#0e7490,stroke:#67e8f9,color:#ffffff,stroke-width:2px;
    classDef triton fill:#78350f,stroke:#fbbf24,color:#ffffff,stroke-width:2px;
    classDef model fill:#14532d,stroke:#4ade80,color:#ffffff,stroke-width:2px;
    class request request;
    class gateway gateway;
    class service service;
    class triton triton;
    class model model;
    style eas fill:#172554,stroke:#60a5fa,color:#dbeafe,stroke-width:2px;
    style docker fill:#164e63,stroke:#22d3ee,color:#cffafe,stroke-width:2px;
    linkStyle default stroke:#94a3b8,stroke-width:2px;
{{< /mermaid >}}

</div>

关键区别：

- **EAS 实例**：一台运行服务容器的计算实例，提供 GPU、CPU 和内存。
- **Triton 模型实例**：模型的一条执行通道，是真正干活的“工人”。
- 当前配置：1 个 EAS 实例 x 1 个 Triton 模型实例，只有一个执行通道。

### 2.2 为什么并发 2 就排队

一个模型实例同一时刻只能执行一个请求，或执行一个由动态批处理器合成的 batch。当前没有形成有效 batch 时，并发 2 的第二个请求只能等待：

```text
时间轴 ->

请求 A  [████████████████ 推理 1.98s ████████████████] 返回
请求 B  [    排队 1.62s    ] [████████ 推理 1.98s ████████] 返回

                              B 端到端约为排队 + 推理

持续闭环并发 2 的实测吞吐量 = 0.505 req/s，约等于 1 / 1.98s
```

**吞吐量几乎等于单请求耗时的倒数**，说明增加客户端并发后，服务仍大约每 1.98 秒完成一个请求。这是“单通道串行”的典型特征。

这里的 P50 结论以持续闭环压测为前提：客户端始终维持两个在途请求，而不是只同时发送两条请求后立即结束。

### 2.3 为什么资源监控看起来没问题

这是关键误区：**GPU 利用率 17.8% 不等于服务还有 82.2% 的并发能力。**

```text
GPU 利用率 17.8% 的含义：

┌──────────────────────────────────────────────┐
│  L20 GPU 总计算能力                            │
│                                              │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  17.8%                                       │
│  采样窗口内的平均活跃程度                        │
│                                              │
│  低利用率可能来自前后处理、数据搬运、              │
│  kernel 间隙、同步点或监控采样粒度。              │
└──────────────────────────────────────────────┘
```

仅凭 GPU 利用率，不能直接断言音频分离是 I/O 密集型任务。还需要结合 Triton 的 `queue`、`compute_input`、`compute_infer` 和 `compute_output` 指标判断时间花在哪里。

但无论低利用率的具体原因是什么，只要当前只有一个模型实例，第二个请求就可能在该执行通道前排队。

---

## 三、为什么不能简单增加 Triton 模型实例

### 3.1 显存是硬约束

当前服务在 GPU 显存里的占用约为：

```text
48 GB x 59.4% = 28.5 GB
```

这 28.5 GB 是当时整个模型服务进程的显存占用，通常包括：

- 模型权重和 backend 执行上下文。
- ONNX Runtime 或 CUDA workspace。
- 推理中间张量和输入输出缓冲。

不能只凭总占用精确拆出每一部分，也不能假设所有显存都会严格随模型实例数翻倍。

### 3.2 同一张 GPU 上开 2 个模型实例会怎样

```text
┌──────────────────────────────────────┐
│  L20：48 GB 显存                      │
│                                      │
│  实例 1：当前服务约 28.5 GB             │
│  实例 2：新增模型上下文和推理缓冲         │
│  双请求：还会叠加峰值中间张量             │
│                                      │
│  风险：总峰值可能超过 48 GB -> OOM      │
└──────────────────────────────────────┘
```

多个 Triton 模型实例通常会增加模型执行上下文、workspace 和推理缓冲。当前剩余显存约 19.5 GB，但新增实例究竟需要多少显存，仅凭 59.4% 的总占用无法判断。是否会 OOM，必须在隔离环境中通过加载、预热和双请求峰值实测确认，不能只用 `59.4% x 2` 下定论。

---

## 四、GPU 选型分析

### 4.1 模型需要多少显存

当前服务实测占用约 28.5 GB。选卡时至少要装下当前服务，还要为最长音频、并发峰值、allocator 波动和版本升级保留余量。

### 4.2 可选 GPU 筛选

以下价格是本次项目当时的 55 折报价快照，不是长期固定价格：

| GPU | 显存 | 能否承载当前约 28.5GB 占用 | 单价（55折） | 判定 |
| --- | --- | --- | --- | --- |
| T4 | 16 GB | 不能 | $0.83/h | 太小 |
| GU30 | 24 GB | 不能 | $0.92/h | 太小 |
| **L20** | **48 GB** | 可以 | **$1.75/h** | **当前选择** |
| V100 | 32 GB | 余量过小 | $2.57/h | 风险高且更贵 |
| H20 | 96 GB | 可以 | $5.22/h | 当前场景过剩 |

在这份候选规格和报价快照中，L20 是能够承载当前显存占用的最低价选择。地域、资源组和折扣变化后，需要重新比较。

### 4.3 当前卡是否浪费

| 资源 | 用量 | 判断 | 说明 |
| --- | --- | --- | --- |
| GPU 算力 | 17.8% | 有优化空间 | 需要进一步拆分前处理、推理和数据传输耗时 |
| GPU 显存 | 59.4% | 合理 | 更小的候选卡装不下，双实例又可能 OOM |
| CPU | 6% | 不是当前瓶颈 | 不能据此断言 CPU 完全不参与推理 |
| 内存 | 8.4% | 不是当前瓶颈 | 当前没有增加内存规格的依据 |

---

## 五、解决方案

### 水平扩展：EAS 实例数 1 -> 2

如果隔离测试确认单卡 `count=2` 不安全，那么不改 GPU 规格、不改 Triton 配置，只把 EAS 实例数从 1 改成 2：

```text
之前                               之后
┌────────────────┐       ┌────────────────┐  ┌────────────────┐
│ EAS 实例 x1     │       │ EAS 实例 #1    │  │ EAS 实例 #2     │
│ L20 x1 48GB    │       │ L20 x1 48GB    │  │ L20 x1 48GB    │
│ Triton 实例 x1  │  ->   │ Triton 实例 x1 │  │ Triton 实例 x1  │
│ $1.749/h       │       │                │  │                │
└────────────────┘       └────────────────┘  └────────────────┘
                                  $3.498/h

请求 A -> EAS 实例 #1
请求 B -> EAS 实例 #2
```

**效果预期**：

| 指标 | 当前 | 扩到 2 个 EAS 实例后 |
| --- | --- | --- |
| 并发 2 端到端 P50 | 3.96s | 约 2s |
| 排队时间 | 1.62s | 接近 0s |
| 吞吐量 | 0.505 req/s | 接近 1 req/s |
| 费用 | $1.749/h | $3.498/h |

这些是两个请求被均匀路由到两个已预热实例时的理想预期，不是上线保证。实际结果还会受到 EAS 路由、输入音频长度、网络和预处理耗时影响。

扩容后至少验证五项：

1. 两个 EAS 实例均为 Ready，并使用同一模型版本。
2. 两个实例均完成预热，请求能够分布到不同实例。
3. 使用同一批音频重跑并发 1 和并发 2。
4. 对比 P50、P95、吞吐、Triton queue 和错误率。
5. 指标没有改善或错误率上升时，回滚到原实例数。

---

## 六、完整决策逻辑链

```text
问题：并发 2 排队，吞吐量上不去
  │
  ├─ CPU 和内存没有达到瓶颈
  │
  └─ 数据高度符合 Triton 单模型实例串行特征
       │
       ├─ 复核生效配置中的模型实例数和 Triton queue 指标
       │
       ├─ 能加 Triton 模型实例（count=2）吗？
       │   ├─ 隔离环境测加载和双请求峰值显存
       │   └─ 若 OOM 或余量过小，则不采用
       │
       ├─ 能换更便宜的 GPU 吗？
       │   └─ 当前候选 T4(16GB) / GU30(24GB) 装不下
       │
       ├─ 需要加 CPU/内存吗？
       │   └─ 当前监控没有支持这一结论
       │
       └─ 水平扩展：EAS 实例数 1 -> 2
            两个容器各使用一张 GPU，形成两条独立执行通道
```

---

## 七、记住这个心智模型

```text
一个 EAS 实例 = 一套独立的服务容器和计算资源
一个 Triton 模型实例 = 一条模型执行通道 = 一个工人
一个工人同一时刻执行一个请求或一个 batch
同一张 GPU 增加工人 = 额外占用显存，必须先测峰值
增加 EAS 实例 = 增加独立 GPU 和执行通道，成本也随之增加
```

## 参考资料

- [NVIDIA Triton：Concurrent Model Execution](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/model_execution.html)
- [NVIDIA Triton：Metrics](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/metrics.html)
- [PAI-EAS 服务调用方式](https://help.aliyun.com/zh/pai/methods-for-calling-services/)
- [PAI-EAS 水平自动扩缩容](https://help.aliyun.com/zh/pai/enable-or-disable-the-horizontal-auto-scaling-feature)
