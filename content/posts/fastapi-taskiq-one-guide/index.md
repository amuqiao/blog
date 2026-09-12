---
title: "FastAPI 接入 Taskiq：从请求到 worker 的一条线"
date: 2026-09-13T01:15:00+08:00
draft: false
showHero: false
description: "面向实践者的 FastAPI + Taskiq 入门教程：先看组件如何协作，再用最小项目跑通任务投递、worker 执行、结果查询和常见排障。"
tags:
  - FastAPI
  - Taskiq
  - Python
  - 异步任务
  - 任务队列
categories:
  - 后端工程
series:
  - Python 后端工程
series_order: 1
---

{{< lead >}}
FastAPI 负责把 HTTP 请求接进来，Taskiq 负责把耗时动作交给另一个进程慢慢做。先别读源码，先把这条线看清：请求进来，消息出去，worker 消费，结果按需保存。
{{< /lead >}}

你接 Taskiq，通常不是因为“想用一个更高级的异步库”，而是因为接口里出现了这种动作：

- 发邮件、发短信、推送消息
- 调第三方慢接口
- 音视频处理、图片处理、报表生成
- 任务失败后需要重试、观察、告警
- worker 数量需要和 API 进程分开扩容

这篇文章回答一个问题：**在 FastAPI 项目里，如何把一次 HTTP 请求变成一条可以被 worker 执行的 Taskiq 任务？**

读完你应该能做到三件事：

1. 看懂 Taskiq 的几个组件各负责什么。
2. 在 FastAPI 中跑通一个最小任务。
3. 出问题时知道该查 broker、worker、任务注册、result backend 还是依赖注入。

## 先看全图

Taskiq 的心智模型很简单：**API 不执行慢任务，API 只投递消息；worker 不处理 HTTP，worker 只消费消息。**

{{< mermaid >}}
flowchart LR
    Browser["浏览器或客户端"] --> API["FastAPI 接口"]
    API --> Broker["Broker 消息队列"]
    Broker --> Worker["Taskiq worker"]
    Worker --> Task["任务函数"]
    Worker --> Result["Result backend"]
    API --> Query["查询结果接口"]
    Query --> Result
{{< /mermaid >}}

{{< feature-grid columns="4" >}}
{{< feature title="FastAPI" headingLevel="h3" >}}
接收 HTTP 请求，校验参数，决定要不要投递任务。
{{< /feature >}}
{{< feature title="Broker" headingLevel="h3" >}}
保存待执行的任务消息，例如 RabbitMQ、Redis、NATS。
{{< /feature >}}
{{< feature title="Worker" headingLevel="h3" >}}
独立进程，从 broker 取消息，找到任务函数并执行。
{{< /feature >}}
{{< feature title="Result backend" headingLevel="h3" >}}
按需保存任务返回值、异常和执行信息，供后续查询。
{{< /feature >}}
{{< /feature-grid >}}

把它想成餐厅更容易：

| 角色 | 餐厅类比 | 在项目里的含义 |
| --- | --- | --- |
| FastAPI | 前台收单 | 接请求、校验、返回 `task_id` |
| Broker | 出单机 | 把任务排队，不负责做菜 |
| Worker | 后厨 | 一个一个拿任务执行 |
| Result backend | 取餐柜 | 需要回看结果时保存状态和返回值 |

这就是第一因：**Taskiq 不是让 FastAPI 换一种方式调用函数，而是把函数调用变成跨进程消息。**

## 什么时候该用

不要一看到“后台任务”就上 Taskiq。先用这张表判断：

| 场景 | 更合适的选择 | 判断理由 |
| --- | --- | --- |
| 请求结束后写日志、发一个很轻的通知 | FastAPI `BackgroundTasks` | 不需要独立 worker、队列和结果查询 |
| 调用外部慢服务、发批量邮件、生成报表 | Taskiq | HTTP 请求不应该等慢动作完成 |
| 任务需要失败重试、ack、独立扩容 | Taskiq | 这些是任务队列的职责 |
| 任务完成后要让前端查询结果 | Taskiq + result backend | broker 管排队，result backend 管结果 |
| 强 CPU 计算、长时间模型任务 | Taskiq 或更专门的任务平台 | 需要考虑进程池、资源隔离和超时策略 |

{{< alert icon="circle-info" >}}
第一版不要先纠结“最优 broker”。先问：任务是否需要跨进程？是否需要 worker 独立扩容？是否需要结果查询？这三个问题比选型名字更重要。
{{< /alert >}}

## 一次任务发生了什么

从一次请求开始，整条链路可以读成 6 步：

{{< steps >}}
{{< step number="1" title="HTTP 请求进入 FastAPI" >}}
接口校验参数，确认这件事可以排队执行。
{{< /step >}}
{{< step number="2" title="handler 调用 `.kiq()`" >}}
`.kiq()` 把函数名和可序列化参数打包成任务消息。
{{< /step >}}
{{< step number="3" title="Broker 保存消息" >}}
消息进入队列，HTTP 进程可以先返回 `task_id`。
{{< /step >}}
{{< step number="4" title="Worker 消费消息" >}}
worker 进程从 broker 拉取任务消息。
{{< /step >}}
{{< step number="5" title="Worker 执行任务函数" >}}
worker 根据任务名找到函数，解析参数，按需注入依赖。
{{< /step >}}
{{< step number="6" title="Result backend 保存结果" >}}
如果配置了 result backend，返回值或异常可以之后按 `task_id` 查询。
{{< /step >}}
{{< /steps >}}

伪代码比源码更适合先建立模型：

```text
HTTP handler:
  validate request
  task = enqueue task_name + serializable_args
  return task.task_id

Worker:
  receive message from broker
  find function by task_name
  rebuild dependencies if needed
  execute function
  save result if result backend exists
```

这里最重要的词是 **serializable_args**。不要把 `Request`、数据库连接、Redis client、文件句柄这类进程内对象塞进任务参数。worker 在另一个进程，能收到的应该是字符串、数字、布尔值、列表、字典这类可序列化数据。

## 交互看一遍

下面这个 demo 不是在真实连接 RabbitMQ 或 Redis，它只是一个链路示意，用来观察不同配置缺失时任务会卡在哪一层。

<div class="taskiq-path-demo not-prose" data-mode="happy">
  <div class="taskiq-path-demo__toolbar" role="group" aria-label="选择 Taskiq 链路场景">
    <button type="button" data-mode="happy" aria-pressed="true">正常链路</button>
    <button type="button" data-mode="no-worker" aria-pressed="false">worker 没启动</button>
    <button type="button" data-mode="not-imported" aria-pressed="false">任务未导入</button>
    <button type="button" data-mode="no-result" aria-pressed="false">没配 result backend</button>
  </div>

  <div class="taskiq-path-demo__stage" aria-label="Taskiq 任务链路示意">
    <div class="taskiq-path-demo__node" data-node="api">
      <strong>FastAPI</strong>
      <span>接请求，调用 .kiq()</span>
    </div>
    <div class="taskiq-path-demo__line" data-line="api-broker"></div>
    <div class="taskiq-path-demo__node" data-node="broker">
      <strong>Broker</strong>
      <span>保存任务消息</span>
    </div>
    <div class="taskiq-path-demo__line" data-line="broker-worker"></div>
    <div class="taskiq-path-demo__node" data-node="worker">
      <strong>Worker</strong>
      <span>消费消息，执行任务</span>
    </div>
    <div class="taskiq-path-demo__line" data-line="worker-result"></div>
    <div class="taskiq-path-demo__node" data-node="result">
      <strong>Result backend</strong>
      <span>保存返回值或异常</span>
    </div>
  </div>

  <div class="taskiq-path-demo__panel" role="status" aria-live="polite">
    <strong data-title>正常链路</strong>
    <p data-copy>接口返回 task_id，worker 消费消息并执行任务；如果任务需要回看结果，result backend 保存返回值或异常。</p>
  </div>
</div>

<style>
.taskiq-path-demo {
  --demo-bg: rgb(var(--color-neutral-50));
  --demo-border: rgb(var(--color-neutral-200));
  --demo-text: rgb(var(--color-neutral-900));
  --demo-muted: rgb(var(--color-neutral-600));
  --demo-node: rgb(255 255 255);
  --demo-primary: rgb(var(--color-primary-600));
  --demo-ok: rgb(22 163 74);
  --demo-warn: rgb(217 119 6);
  --demo-bad: rgb(220 38 38);
  margin: 2rem 0;
  padding: 1rem;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--demo-bg);
  color: var(--demo-text);
}

html.dark .taskiq-path-demo {
  --demo-bg: rgb(var(--color-neutral-800));
  --demo-border: rgb(var(--color-neutral-700));
  --demo-text: rgb(var(--color-neutral-100));
  --demo-muted: rgb(var(--color-neutral-300));
  --demo-node: rgb(var(--color-neutral-900));
  --demo-primary: rgb(var(--color-primary-400));
  --demo-ok: rgb(74 222 128);
  --demo-warn: rgb(251 191 36);
  --demo-bad: rgb(248 113 113);
  line-height: 1.65;
}

.taskiq-path-demo__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.taskiq-path-demo__toolbar button {
  min-height: 2.5rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--demo-node);
  color: var(--demo-text);
  font: inherit;
  font-size: 0.92rem;
  cursor: pointer;
}

.taskiq-path-demo__toolbar button[aria-pressed="true"] {
  border-color: var(--demo-primary);
  box-shadow: inset 0 -3px 0 var(--demo-primary);
}

.taskiq-path-demo__stage {
  display: grid;
  grid-template-columns: minmax(8rem, 1fr) 2.5rem minmax(8rem, 1fr) 2.5rem minmax(8rem, 1fr) 2.5rem minmax(8rem, 1fr);
  align-items: stretch;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.25rem 0.125rem 0.5rem;
}

.taskiq-path-demo__node {
  min-height: 7rem;
  border: 2px solid var(--demo-border);
  border-radius: 8px;
  background: var(--demo-node);
  padding: 0.8rem;
  display: grid;
  align-content: center;
  gap: 0.4rem;
}

.taskiq-path-demo__node strong {
  color: var(--demo-text);
  font-size: 1rem;
}

.taskiq-path-demo__node span {
  color: var(--demo-muted);
  font-size: 0.88rem;
  line-height: 1.45;
}

.taskiq-path-demo__line {
  align-self: center;
  height: 0.25rem;
  border-radius: 999px;
  background: var(--demo-border);
}

.taskiq-path-demo[data-mode="happy"] [data-node],
.taskiq-path-demo[data-mode="happy"] [data-line] {
  border-color: var(--demo-ok);
  background-color: color-mix(in srgb, var(--demo-ok) 10%, var(--demo-node));
}

.taskiq-path-demo[data-mode="no-worker"] [data-node="worker"],
.taskiq-path-demo[data-mode="not-imported"] [data-node="worker"],
.taskiq-path-demo[data-mode="no-result"] [data-node="result"] {
  border-color: var(--demo-bad);
}

.taskiq-path-demo[data-mode="no-worker"] [data-line="broker-worker"],
.taskiq-path-demo[data-mode="not-imported"] [data-line="broker-worker"],
.taskiq-path-demo[data-mode="no-result"] [data-line="worker-result"] {
  background: var(--demo-bad);
}

.taskiq-path-demo[data-mode="no-result"] [data-node="api"],
.taskiq-path-demo[data-mode="no-result"] [data-node="broker"],
.taskiq-path-demo[data-mode="no-result"] [data-node="worker"] {
  border-color: var(--demo-warn);
}

.taskiq-path-demo__panel {
  margin-top: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--demo-node);
}

.taskiq-path-demo__panel strong {
  display: block;
  margin-bottom: 0.25rem;
}

.taskiq-path-demo__panel p {
  margin: 0;
  color: var(--demo-muted);
}

@media (max-width: 720px) {
  .taskiq-path-demo {
    padding: 0.85rem;
  }

  .taskiq-path-demo__stage {
    grid-template-columns: 1fr;
  }

  .taskiq-path-demo__line {
    width: 0.25rem;
    height: 1.25rem;
    justify-self: center;
  }

  .taskiq-path-demo__node {
    min-height: 5rem;
  }
}
</style>

<script>
(() => {
  const root = document.querySelector(".taskiq-path-demo");
  if (!root) return;

  const states = {
    happy: {
      title: "正常链路",
      copy: "接口返回 task_id，worker 消费消息并执行任务；如果任务需要回看结果，result backend 保存返回值或异常。",
    },
    "no-worker": {
      title: "worker 没启动",
      copy: "消息已经进 broker，但没有 worker 消费。排查时先看 worker 进程是否启动，以及它连的是不是同一个 broker。",
    },
    "not-imported": {
      title: "任务未导入",
      copy: "worker 启动了，但任务模块没被导入，装饰器没有注册任务。检查 taskiq worker 命令后面是否带了任务模块，或是否正确使用文件发现。",
    },
    "no-result": {
      title: "没配 result backend",
      copy: "任务可以执行，但接口之后查不到返回值。broker 负责排队，result backend 才负责保存结果；不需要回看结果时可以不配。",
    },
  };

  const title = root.querySelector("[data-title]");
  const copy = root.querySelector("[data-copy]");
  const buttons = root.querySelectorAll("button[data-mode]");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode;
      const state = states[mode];
      root.dataset.mode = mode;
      title.textContent = state.title;
      copy.textContent = state.copy;
      buttons.forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
    });
  });
})();
</script>

## 先跑通最小项目

先不要上复杂业务。一个最小项目只需要三份文件：

```text
app/
  __init__.py
  taskiq.py    # broker 和 result backend
  main.py      # FastAPI app 和 HTTP 接口
  tasks.py     # worker 要执行的任务
```

先装依赖：

```bash
pip install fastapi uvicorn taskiq taskiq-fastapi taskiq-aio-pika taskiq-redis
```

本地用 Docker 启动 RabbitMQ 和 Redis：

```bash
docker run --rm -d \
  --name taskiq-rabbitmq \
  -p "5672:5672" \
  -p "15672:15672" \
  rabbitmq:3-management-alpine

docker run --rm -d \
  --name taskiq-redis \
  -p "6379:6379" \
  redis:7-alpine
```

代码先看伪代码：

```text
app/taskiq.py:
  create broker
  attach result backend
  bind broker with FastAPI app path

app/main.py:
  startup broker client when running as API
  POST endpoint calls task.kiq(...)
  GET endpoint reads result by task_id

app/tasks.py:
  register task function with broker
  task receives plain serializable arguments
```

{{< tabs group="taskiq-minimal" default="app/taskiq.py" >}}
{{< tab label="app/taskiq.py" >}}
```python
from taskiq_aio_pika import AioPikaBroker
from taskiq_redis import RedisAsyncResultBackend
import taskiq_fastapi


broker = AioPikaBroker(
    "amqp://guest:guest@localhost:5672/",
).with_result_backend(
    # broker 负责排队；result backend 负责保存返回值和异常。
    RedisAsyncResultBackend("redis://localhost:6379/0"),
)

# 让 worker 知道 FastAPI app 在哪里。
# 这里传字符串路径，可以减少循环导入。
taskiq_fastapi.init(broker, "app.main:app")
```
{{< /tab >}}
{{< tab label="app/main.py" >}}
```python
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from pydantic import BaseModel

from app.taskiq import broker
from app.tasks import send_welcome_email


@asynccontextmanager
async def lifespan(app: FastAPI):
    # API 进程需要启动 broker client，才能调用 .kiq() 投递消息。
    # worker 进程有自己的启动流程，所以这里要避开 worker。
    if not broker.is_worker_process:
        await broker.startup()
    yield
    if not broker.is_worker_process:
        await broker.shutdown()


app = FastAPI(lifespan=lifespan)


class SendWelcomeRequest(BaseModel):
    user_id: int


@app.post("/emails/welcome", status_code=status.HTTP_202_ACCEPTED)
async def create_welcome_email(payload: SendWelcomeRequest):
    # .kiq() 不是执行函数，而是把任务消息交给 broker。
    task = await send_welcome_email.kiq(payload.user_id)
    return {"task_id": task.task_id}


@app.get("/tasks/{task_id}")
async def get_task_result(task_id: str):
    # 没有完成时先返回 pending，避免把“未完成”和“失败”混在一起。
    if not await broker.result_backend.is_result_ready(task_id):
        return {"status": "pending"}

    result = await broker.result_backend.get_result(task_id)
    if result.is_err:
        return {"status": "failed"}

    return {"status": "done", "value": result.return_value}
```
{{< /tab >}}
{{< tab label="app/tasks.py" >}}
```python
from app.taskiq import broker


@broker.task(task_name="emails.send_welcome")
async def send_welcome_email(user_id: int) -> dict[str, int | str]:
    # 任务参数应该是可序列化数据，不要传 Request、DB session、Redis client。
    # 真实项目里这里可以发邮件、写数据库、调用第三方服务。
    return {"user_id": user_id, "status": "sent"}
```
{{< /tab >}}
{{< /tabs >}}

启动时需要两个进程：

```bash
uvicorn app.main:app --reload
```

```bash
taskiq worker app.taskiq:broker app.tasks
```

然后投递任务：

```bash
curl -X POST http://127.0.0.1:8000/emails/welcome \
  -H "content-type: application/json" \
  -d '{"user_id": 42}'
```

返回 `task_id` 之后，再查：

```bash
curl http://127.0.0.1:8000/tasks/<task_id>
```

## 关键配置怎么理解

Taskiq 接入 FastAPI，真正需要记住的是这几类配置。

| 配置点 | 放在哪里 | 解决什么问题 | 错了会怎样 |
| --- | --- | --- | --- |
| broker URL | `app/taskiq.py` | API 和 worker 通过同一个队列说话 | `.kiq()` 投不出去，或 worker 消费不到 |
| `taskiq_fastapi.init` | broker 文件 | 让 Taskiq 知道 FastAPI app 路径 | 依赖注入拿不到 FastAPI 上下文 |
| `broker.startup()` | FastAPI lifespan | API 进程启动 broker client | handler 里调用 `.kiq()` 出错 |
| worker 命令 | 终端或进程管理器 | 告诉 worker broker 和任务模块在哪 | 任务未注册，消息无人执行 |
| result backend | broker 配置 | 保存返回值、异常和执行信息 | 任务能跑，但查不到结果 |
| `task_name` | `@broker.task(...)` | 给任务一个稳定名字 | 移动模块后任务名变化，排障困难 |

这里有两个容易混的点。

第一，**broker 和 result backend 不是一回事**。broker 负责“任务排队和投递”，result backend 负责“任务结果回看”。只需要 fire-and-forget 的任务，可以先不查结果；需要前端轮询状态，就必须配置 result backend。

第二，**worker 必须导入任务模块**。`@broker.task` 是注册动作；如果 `app.tasks` 没被 worker 导入，worker 就不知道这个任务存在。任务少时显式写模块最清楚，任务多时再考虑文件系统发现。

## FastAPI 依赖怎么用

Taskiq 可以复用 FastAPI 风格的依赖，但要先划清边界：worker 执行任务时没有那次 HTTP 请求。

能迁移到任务里的依赖，通常长这样：

```text
dependency:
  read app-level resource
  return db_pool or redis_pool or settings
```

不适合直接迁移的依赖，通常长这样：

```text
dependency:
  read request headers
  read cookies
  read client ip
  read path params
  infer current user from this HTTP request
```

原因很直接：任务消息进入 broker 后，worker 收到的是一组参数，不是原始 HTTP 请求。

如果任务需要用户 ID、tenant ID、语言、trace ID，就在投递时显式传进去：

```python
@app.post("/reports")
async def create_report(request: Request, payload: ReportRequest):
    task = await build_report.kiq(
        user_id=request.state.user_id,
        tenant_id=request.headers["x-tenant-id"],
        report_id=payload.report_id,
    )
    return {"task_id": task.task_id}
```

如果依赖只需要 `app.state` 里的连接池，就可以用 `TaskiqDepends`：

```python
from typing import Annotated

from fastapi import Request
from taskiq import TaskiqDepends


def get_redis_pool(
    request: Annotated[Request, TaskiqDepends()],
):
    # 这个依赖只读 app.state，不依赖某次 HTTP 请求的 header/cookie。
    return request.app.state.redis_pool


@broker.task(task_name="cache.refresh_user")
async def refresh_user_cache(
    user_id: int,
    redis_pool=TaskiqDepends(get_redis_pool),
):
    ...
```

{{< alert icon="triangle-exclamation" >}}
判断标准只有一句：把这段依赖从 HTTP 请求里拿走，它还活得下去吗？活不下去的值，就在 `.kiq()` 时作为普通参数传过去。
{{< /alert >}}

## 常见坑怎么定位

{{< accordion >}}
{{< accordionItem title="接口里调用 `.kiq()` 报错" >}}
先查 FastAPI lifespan 里有没有在非 worker 进程执行 `await broker.startup()`。API 进程要启动 broker client，才能把消息投出去。
{{< /accordionItem >}}
{{< accordionItem title="接口返回了 `task_id`，但任务没有执行" >}}
先查 worker 是否启动，再查它连的是不是同一个 broker。然后看 worker 命令是否导入了任务模块，例如 `taskiq worker app.taskiq:broker app.tasks`。
{{< /accordionItem >}}
{{< accordionItem title="worker 提示找不到任务" >}}
任务函数所在模块没有被导入，或者任务名变化了。先显式导入任务模块；重要任务建议设置稳定的 `task_name`。
{{< /accordionItem >}}
{{< accordionItem title="任务执行了，但查询接口一直没有结果" >}}
确认是否真的配置了 result backend。broker 只保证消息投递和消费，不负责保存业务返回值。
{{< /accordionItem >}}
{{< accordionItem title="任务里拿不到 request header 或 cookie" >}}
不要让 worker 依赖某次 HTTP 请求。把需要的 user id、tenant id、trace id 在 `.kiq()` 时作为普通参数传进去。
{{< /accordionItem >}}
{{< accordionItem title="测试里用 InMemoryBroker，依赖注入不工作" >}}
`InMemoryBroker` 适合本地和测试，但它不等同于真实 worker 进程。测试中需要显式准备依赖上下文，或者把任务逻辑拆成普通函数单测。
{{< /accordionItem >}}
{{< /accordion >}}

## 必要原理

到这里已经可以使用了。剩下只需要知道三个原理，方便你排障。

| 原理 | 人话解释 | 排障时看什么 |
| --- | --- | --- |
| `.kiq()` 是投递 | 它把任务名和参数发给 broker，不在 HTTP 请求里执行业务函数 | API 日志、broker 连接、返回的 `task_id` |
| worker 靠导入注册任务 | 任务模块被导入时，`@broker.task` 才把函数注册到 broker | worker 启动命令、任务模块路径、`task_name` |
| result backend 只管结果 | 没有 result backend，任务仍可执行，但之后查不到返回值 | result backend 配置、`is_result_ready`、`get_result` |

不用先拆源码，也能记住这条线：

```text
HTTP 请求
  -> FastAPI handler
  -> .kiq() 生成任务消息
  -> broker 排队
  -> worker 消费
  -> task function 执行
  -> result backend 按需保存结果
```

## 参考

- [Taskiq Getting started](https://taskiq-python.github.io/guide/getting-started.html)
- [Taskiq Architecture overview](https://taskiq-python.github.io/guide/architecture-overview.html)
- [Taskiq CLI](https://taskiq-python.github.io/guide/cli.html)
- [Taskiq + FastAPI](https://taskiq-python.github.io/framework_integrations/taskiq-with-fastapi.html)
- [Taskiq available result backends](https://taskiq-python.github.io/available-components/result-backends.html)
- [Taskiq result backend](https://taskiq-python.github.io/extending-taskiq/result-backend.html)

## 收束

FastAPI 接 Taskiq，不是把一个函数“异步一下”那么简单。真正要建立的模型是：

| 问题 | 记住这句话 |
| --- | --- |
| 接口为什么能立刻返回 | API 只投递消息，不等待 worker 做完 |
| worker 为什么能执行任务 | worker 导入任务模块后，才能知道任务函数 |
| 为什么查不到返回值 | broker 不保存结果，result backend 才保存 |
| 依赖为什么会失效 | worker 没有那次 HTTP 请求，只能重建进程级依赖 |
| 配置从哪里排查 | 按 API、broker、worker、result backend 四层切开看 |

先会开，再懂结构。真出问题时，再顺着这张图往下查，就不会被一堆配置名绕晕。
