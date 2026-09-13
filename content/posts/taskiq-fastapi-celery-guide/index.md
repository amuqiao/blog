---
title: "一文读懂 Taskiq：架构、Celery 对比与 FastAPI 接入"
date: 2026-09-13T23:20:13+08:00
lastmod: 2026-09-13T23:20:13+08:00
draft: false
description: "用 HTML 图解、心智模型和最小代码讲清 Taskiq 架构、它和 Celery 的区别，以及 FastAPI 项目如何接入和配置。"
summary: "先建立心智模型：FastAPI 发任务消息，broker 运输，worker 执行，result backend 存结果。Taskiq 更贴近 async FastAPI，Celery 更像成熟任务平台。"
tags: ["Python", "FastAPI", "Taskiq", "Celery", "AsyncIO"]
categories: ["后端工程"]
series: []
series_order:
showHero: false
showTableOfContents: true
---

{{< lead >}}
Taskiq 的核心不是“后台跑一个函数”，而是把一次函数调用改造成一条能跨进程旅行的消息。
{{< /lead >}}

**本文主旨：** FastAPI 负责把请求接住，Taskiq 负责把慢任务送出去。你只要抓住“发消息、运消息、跑任务、存结果”这条线，就能理解 Taskiq 的架构、配置和它与 Celery 的取舍。

<style>
.taskiq-html-guide {
  --ti-border: rgb(var(--color-neutral-200));
  --ti-soft: rgb(var(--color-neutral-100));
  --ti-panel: rgb(var(--color-neutral-50));
  --ti-text: rgb(var(--color-neutral-800));
  --ti-muted: rgb(var(--color-neutral-600));
  --ti-primary: rgb(var(--color-primary-600));
  --ti-primary-soft: rgb(var(--color-primary-100));
  --ti-warn: rgb(180 83 9);
  --ti-ok: rgb(22 101 52);
  margin: 2rem 0;
  color: var(--ti-text);
}
html.dark .taskiq-html-guide {
  --ti-border: rgb(var(--color-neutral-700));
  --ti-soft: rgb(var(--color-neutral-800));
  --ti-panel: rgb(var(--color-neutral-900));
  --ti-text: rgb(var(--color-neutral-100));
  --ti-muted: rgb(var(--color-neutral-300));
  --ti-primary: rgb(var(--color-primary-300));
  --ti-primary-soft: rgb(var(--color-primary-900));
  --ti-warn: rgb(251 191 36);
  --ti-ok: rgb(134 239 172);
}
.taskiq-html-guide * {
  box-sizing: border-box;
}
.taskiq-html-guide .viz {
  border: 1px solid var(--ti-border);
  border-radius: 10px;
  background: linear-gradient(180deg, var(--ti-panel), transparent 140%);
  padding: 1rem;
}
.taskiq-html-guide .viz-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  margin-bottom: .9rem;
}
.taskiq-html-guide .viz-title h2,
.taskiq-html-guide .viz-title h3 {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.35;
}
.taskiq-html-guide .badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.65rem;
  padding: .2rem .55rem;
  border: 1px solid var(--ti-border);
  border-radius: 999px;
  color: var(--ti-primary);
  background: var(--ti-primary-soft);
  font-size: .78rem;
  font-weight: 700;
  white-space: nowrap;
}
.taskiq-html-guide .caption {
  margin: .85rem 0 0;
  color: var(--ti-muted);
  font-size: .92rem;
  line-height: 1.65;
}
.taskiq-html-guide .flow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
  gap: .65rem;
  align-items: stretch;
}
.taskiq-html-guide .node,
.taskiq-html-guide .card,
.taskiq-html-guide .mini {
  min-width: 0;
  border: 1px solid var(--ti-border);
  border-radius: 8px;
  background: var(--ti-soft);
  padding: .85rem;
}
.taskiq-html-guide .node strong,
.taskiq-html-guide .card strong,
.taskiq-html-guide .mini strong {
  display: block;
  margin-bottom: .35rem;
  font-size: .95rem;
  line-height: 1.35;
}
.taskiq-html-guide .node span,
.taskiq-html-guide .card span,
.taskiq-html-guide .mini span {
  display: block;
  color: var(--ti-muted);
  font-size: .84rem;
  line-height: 1.5;
}
.taskiq-html-guide .arrow {
  align-self: center;
  justify-self: center;
  color: var(--ti-primary);
  font-weight: 800;
}
.taskiq-html-guide .split,
.taskiq-html-guide .compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .8rem;
}
.taskiq-html-guide .lane {
  border: 1px solid var(--ti-border);
  border-radius: 8px;
  padding: .9rem;
  background: var(--ti-soft);
}
.taskiq-html-guide .lane h3 {
  margin: 0 0 .7rem;
  font-size: .98rem;
}
.taskiq-html-guide .chips {
  display: flex;
  flex-wrap: wrap;
  gap: .45rem;
}
.taskiq-html-guide .chip {
  border: 1px solid var(--ti-border);
  border-radius: 999px;
  padding: .28rem .55rem;
  font-size: .82rem;
  color: var(--ti-muted);
  background: var(--ti-panel);
}
.taskiq-html-guide .matrix {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: .7rem;
}
.taskiq-html-guide .decision {
  border-left: 4px solid var(--ti-primary);
}
.taskiq-html-guide .warn {
  border-left: 4px solid var(--ti-warn);
}
.taskiq-html-guide .ok {
  border-left: 4px solid var(--ti-ok);
}
.taskiq-html-guide .stage {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: .75rem;
}
.taskiq-html-guide .stage button {
  width: 100%;
  min-height: 2.25rem;
  border: 1px solid var(--ti-border);
  border-radius: 8px;
  background: var(--ti-soft);
  color: var(--ti-text);
  font-weight: 700;
  cursor: pointer;
}
.taskiq-html-guide .stage button[aria-pressed="true"] {
  border-color: var(--ti-primary);
  color: var(--ti-primary);
  background: var(--ti-primary-soft);
}
.taskiq-html-guide .stage-output {
  margin-top: .8rem;
  border: 1px solid var(--ti-border);
  border-radius: 8px;
  padding: .9rem;
  background: var(--ti-soft);
}
.taskiq-html-guide .stage-output strong {
  display: block;
  margin-bottom: .35rem;
}
.taskiq-html-guide .stage-output span {
  color: var(--ti-muted);
  line-height: 1.6;
}
@media (max-width: 760px) {
  .taskiq-html-guide .flow,
  .taskiq-html-guide .split,
  .taskiq-html-guide .compare,
  .taskiq-html-guide .matrix,
  .taskiq-html-guide .stage {
    grid-template-columns: 1fr;
  }
  .taskiq-html-guide .arrow {
    transform: rotate(90deg);
  }
  .taskiq-html-guide .viz-title {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>

<section class="taskiq-html-guide not-prose">
<div class="viz">
<div class="viz-title"><h2>先建立心智模型</h2><span class="badge">Message Trip</span></div>
<div class="flow">
<div class="node decision"><strong>FastAPI</strong><span>接住 HTTP 请求，尽快返回 task_id。</span></div>
<div class="arrow">-&gt;</div>
<div class="node"><strong>Broker</strong><span>运输任务消息，不保存业务结果。</span></div>
<div class="arrow">-&gt;</div>
<div class="node ok"><strong>Worker</strong><span>真正执行函数，把结果写回 backend。</span></div>
</div>
<div class="flow" style="margin-top:.65rem;">
<div class="node"><strong>Kicker</strong><span>task.kiq() 把函数调用包装成消息。</span></div>
<div class="arrow">-&gt;</div>
<div class="node"><strong>Message</strong><span>带着任务名、参数和 labels 去排队。</span></div>
<div class="arrow">-&gt;</div>
<div class="node"><strong>Result backend</strong><span>需要查结果时，状态和返回值在这里。</span></div>
</div>
<p class="caption">读 Taskiq 不要从源码入口开始。先把它想成一条消息旅行线：Web 进程负责发送，worker 进程负责执行，结果后端只在你需要追踪结果时登场。</p>
</div>
</section>

{{< alert icon="circle-info" >}}
本文所有 HTML 图解都是机制示意，不是性能测试。吞吐、延迟、重试效果要在自己的 broker、网络和任务负载下验证。
{{< /alert >}}

## 为什么不是直接在接口里跑

第一性原理很简单：**HTTP 请求要快，慢任务要稳**。文件转码、报表生成、AI 推理、外部系统同步，都不应该占着一次请求不放。

<section class="taskiq-html-guide not-prose">
<div class="viz">
<div class="viz-title"><h3>把一条路拆成两条路</h3><span class="badge">Request Path vs Worker Path</span></div>
<div class="split">
<div class="lane ok"><h3>请求路径：追求快</h3><div class="chips"><span class="chip">校验参数</span><span class="chip">发送任务消息</span><span class="chip">返回 task_id</span></div><p class="caption">endpoint 的目标是把请求转成一个可追踪的后台任务。</p></div>
<div class="lane decision"><h3>执行路径：追求稳</h3><div class="chips"><span class="chip">拿到消息</span><span class="chip">执行任务</span><span class="chip">重试 / 超时</span><span class="chip">保存结果</span></div><p class="caption">worker 的目标是把慢动作做完，并留下可诊断的状态。</p></div>
</div>
</div>
</section>

最小伪代码是这样：

```text
HTTP endpoint:
  校验请求
  投递任务消息
  返回 task_id

worker:
  监听 broker
  收到任务消息
  执行业务函数
  保存结果或错误
```

## Taskiq 各组件怎么配合

Taskiq 官方架构的基本关系是：客户端通过 kicker 和 broker 发送消息，worker 侧通过 broker 接收消息，结果交给 result backend 保存。

<section class="taskiq-html-guide not-prose">
<div class="viz">
<div class="viz-title"><h3>组件职责地图</h3><span class="badge">Architecture</span></div>
<div class="matrix">
<div class="card decision"><strong>Task</strong><span>你声明的后台动作，例如 render_report(report_id)。</span></div>
<div class="card"><strong>Kicker</strong><span>由 task.kiq() 触发，把调用信息变成消息。</span></div>
<div class="card"><strong>Broker</strong><span>对外系统执行 kick 和 listen：一边投递，一边监听。</span></div>
<div class="card ok"><strong>Worker</strong><span>导入任务模块，收到消息后真正运行函数。</span></div>
<div class="card"><strong>Result backend</strong><span>保存任务状态、返回值和错误。</span></div>
<div class="card warn"><strong>Middleware</strong><span>在发送、执行、保存前后插入横切逻辑。</span></div>
</div>
<p class="caption">一旦分清“运输”和“结果”是两件事，就不会把 broker 当数据库，也不会在没配 result backend 时期待稳定拿回返回值。</p>
</div>
</section>

## 一条任务到底发生了什么

这个小交互只模拟状态切换，帮助你把 `kiq()`、worker 和结果后端分开看。

<section class="taskiq-html-guide not-prose" id="taskiq-trip-demo">
<div class="viz">
<div class="viz-title"><h3>消息旅行模拟器</h3><span class="badge">Interactive</span></div>
<div class="stage" role="group" aria-label="选择任务阶段">
<button type="button" data-stage="send" aria-pressed="true">1. endpoint 投递</button>
<button type="button" data-stage="run" aria-pressed="false">2. worker 执行</button>
<button type="button" data-stage="result" aria-pressed="false">3. 查询结果</button>
<button type="button" data-stage="fail" aria-pressed="false">4. 失败处理</button>
</div>
<div class="stage-output" role="status" aria-live="polite">
<strong>endpoint 投递</strong>
<span>await render_report.kiq(id) 等到的是消息发送完成；接口返回 task_id，不是报表内容。</span>
</div>
</div>
</section>

<script>
(() => {
  const root = document.querySelector("#taskiq-trip-demo");
  if (!root) return;
  const output = root.querySelector(".stage-output");
  const copy = {
    send: ["endpoint 投递", "await render_report.kiq(id) 等到的是消息发送完成；接口返回 task_id，不是报表内容。"],
    run: ["worker 执行", "worker 从 broker 收到消息，解析参数和依赖，然后运行真正的业务函数。"],
    result: ["查询结果", "只有配置了 result backend，调用方才有稳定位置读取状态、返回值或错误。"],
    fail: ["失败处理", "重试只适合临时故障；任务有副作用时，先确认幂等，再谈自动重试。"]
  };
  root.querySelectorAll("button[data-stage]").forEach((button) => {
    button.addEventListener("click", () => {
      root.querySelectorAll("button[data-stage]").forEach((item) => item.setAttribute("aria-pressed", "false"));
      button.setAttribute("aria-pressed", "true");
      const [title, text] = copy[button.dataset.stage];
      output.innerHTML = `<strong>${title}</strong><span>${text}</span>`;
    });
  });
})();
</script>

## 和 Celery 怎么选

不要把 Taskiq 理解成“新 Celery”。更准确的说法是：**Taskiq 更贴近 async Python 应用代码；Celery 更像成熟的任务平台。**

<section class="taskiq-html-guide not-prose">
<div class="viz">
<div class="viz-title"><h3>选型不是二选一，是看主矛盾</h3><span class="badge">Taskiq vs Celery</span></div>
<div class="compare">
<div class="lane decision"><h3>先看 Taskiq</h3><div class="chips"><span class="chip">FastAPI / asyncio 是主线</span><span class="chip">想复用依赖注入</span><span class="chip">希望 API 更贴近类型提示</span><span class="chip">任务编排不复杂</span></div></div>
<div class="lane warn"><h3>先看 Celery</h3><div class="chips"><span class="chip">团队已有 Celery 运维体系</span><span class="chip">需要 canvas 编排</span><span class="chip">需要成熟监控生态</span><span class="chip">需要兼容老系统</span></div></div>
</div>
<p class="caption">Celery 文档把任务队列描述成跨线程或跨机器分发工作的机制，并提供 chain、group、chord 等 canvas 原语。Taskiq 的优势则在 async、依赖注入和较轻的接入心智负担。</p>
</div>
</section>

## FastAPI 项目怎么接入

最小目录先长这样，不需要一上来拆源码：

```text
app/
  tkq.py     # broker、result backend、taskiq_fastapi.init
  main.py    # FastAPI app、lifespan、endpoint
  tasks.py   # @broker.task 后台任务
  deps.py    # 可复用的应用级依赖
```

{{< tabs group="taskiq-fastapi-files" >}}
{{< tab label="tkq.py" >}}
```python
# app/tkq.py
import taskiq_fastapi
from taskiq_redis import ListQueueBroker, RedisAsyncResultBackend

broker = ListQueueBroker(
    "redis://localhost:6379/0",
    queue_name="fastapi-tasks",
).with_result_backend(
    RedisAsyncResultBackend("redis://localhost:6379/1"),
)

# 用字符串路径指向 FastAPI app，避免直接 import 造成循环依赖。
taskiq_fastapi.init(broker, "app.main:app")
```
{{< /tab >}}
{{< tab label="main.py" >}}
```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.tkq import broker
from app.tasks import render_report

@asynccontextmanager
async def lifespan(app: FastAPI):
    # worker 也会导入 app 来构造依赖上下文，别在 worker 里重复启动 broker。
    if not broker.is_worker_process:
        await broker.startup()
    yield
    if not broker.is_worker_process:
        await broker.shutdown()

app = FastAPI(lifespan=lifespan)

@app.post("/reports/{report_id}")
async def create_report(report_id: str):
    task = await render_report.kiq(report_id)
    return {"task_id": task.task_id}
```
{{< /tab >}}
{{< tab label="tasks.py" >}}
```python
# app/tasks.py
from app.tkq import broker

@broker.task
async def render_report(report_id: str) -> dict[str, str]:
    # 这里只放后台动作：查数据、生成文件、上传对象存储。
    return {"report_id": report_id, "status": "done"}
```
{{< /tab >}}
{{< /tabs >}}

启动 worker 的心智模型也只有一句：**让 worker 找到 broker，再导入任务模块。**

```bash
taskiq worker app.tkq:broker app.tasks
```

任务模块很多时，再考虑文件系统发现：

```bash
taskiq worker app.tkq:broker --fs-discover
```

## FastAPI 依赖能复用到什么程度

Taskiq + FastAPI 最容易误解的一点是：它能复用 FastAPI 的应用级依赖，但不会把某一次 HTTP 请求原样带进 worker。

<section class="taskiq-html-guide not-prose">
<div class="viz">
<div class="viz-title"><h3>依赖边界</h3><span class="badge">Dependency Boundary</span></div>
<div class="compare">
<div class="lane ok"><h3>适合复用</h3><div class="chips"><span class="chip">app.state.settings</span><span class="chip">数据库连接池</span><span class="chip">Redis client</span><span class="chip">配置对象</span></div></div>
<div class="lane warn"><h3>不要隐式复用</h3><div class="chips"><span class="chip">本次请求 headers</span><span class="chip">client IP</span><span class="chip">登录态</span><span class="chip">request body</span></div></div>
</div>
<p class="caption">这些请求级信息应该作为明确参数传入任务。任务越像一个普通函数，排障越容易。</p>
</div>
</section>

```python
# app/deps.py
from typing import Annotated
from fastapi import Request
from taskiq import TaskiqDepends

async def get_settings(request: Annotated[Request, TaskiqDepends()]):
    # 这是 taskiq-fastapi 提供的模拟 Request。
    # 适合拿 app.state；不适合读本次 HTTP 请求的信息。
    return request.app.state.settings
```

{{< alert icon="triangle-exclamation" >}}
任务里使用依赖时，优先使用 `TaskiqDepends`。`taskiq-fastapi` 注入的 `Request` / `HTTPConnection` 不是发送任务时的真实连接。
{{< /alert >}}

## 关键配置怎么判断

<section class="taskiq-html-guide not-prose">
<div class="viz">
<div class="viz-title"><h3>配置不是复制粘贴，是回答问题</h3><span class="badge">Config Map</span></div>
<div class="matrix">
<div class="card decision"><strong>Broker</strong><span>任务要不要跨进程、跨机器、可靠投递？生产环境不要把 InMemoryBroker 当队列。</span></div>
<div class="card"><strong>Result backend</strong><span>用户要不要查状态或拿返回值？要查就显式配置。</span></div>
<div class="card"><strong>Worker import</strong><span>worker 是否导入了所有任务模块？没导入就等于没注册。</span></div>
<div class="card warn"><strong>Retry</strong><span>失败是否是临时故障？任务是否幂等？否则重试会放大副作用。</span></div>
<div class="card"><strong>Timeout</strong><span>最长能跑多久？超时后外部副作用如何补偿？</span></div>
<div class="card"><strong>Scheduler</strong><span>是否需要定时发任务？多实例部署时要避免重复发送。</span></div>
</div>
</div>
</section>

## 最后带走三句话

<section class="taskiq-html-guide not-prose">
<div class="viz">
<div class="viz-title"><h3>收束心智模型</h3><span class="badge">Takeaway</span></div>
<div class="matrix">
<div class="card decision"><strong>1. kiq() 是发消息</strong><span>它不是远程调用函数结果。接口通常返回 task_id。</span></div>
<div class="card ok"><strong>2. worker 才是执行者</strong><span>它需要能导入 broker 和任务模块，也要能访问依赖资源。</span></div>
<div class="card warn"><strong>3. 选型看主矛盾</strong><span>async FastAPI 优先看 Taskiq；复杂编排和成熟平台优先看 Celery。</span></div>
</div>
</div>
</section>

## 参考资料

- Taskiq Architecture overview: https://taskiq-python.github.io/guide/architecture-overview.html
- Taskiq Getting started: https://taskiq-python.github.io/guide/getting-started.html
- Taskiq + FastAPI: https://taskiq-python.github.io/framework_integrations/taskiq-with-fastapi.html
- Taskiq CLI: https://taskiq-python.github.io/guide/cli.html
- Celery introduction: https://docs.celeryq.dev/en/main/getting-started/introduction.html
- Celery canvas: https://docs.celeryq.dev/en/main/userguide/canvas.html
