---
title: "FastAPI 接 Taskiq：架构、配置、使用与踩坑"
date: 2026-09-13T13:05:00+08:00
draft: false
description: "Taskiq 是 asyncio 原生的分布式任务队列。本文先建立它的组件心智模型，再给出 FastAPI 集成的最小可跑项目、逐项配置说明、依赖注入与定时任务用法，最后是一份按症状排列的踩坑清单。面向有 Celery 经验的 Python 后端。"
tags:
  - FastAPI
  - Taskiq
  - Python
  - 任务队列
  - 异步
categories:
  - 后端工程
series:
  - Python 后端工程
series_order: 1
---

{{< lead >}}
一句话主旨：Taskiq 把一次函数调用序列化成消息、在另一个进程里按类型注解重建——**"传过去的东西会变形"和"worker 侧没有那次请求"这两件事，决定了它全部的配置项和几乎全部的坑。**
{{< /lead >}}

**本文负责**：Taskiq 的组件心智模型、FastAPI 集成的最小可跑路径、配置项逐个说明、依赖注入与定时任务、按症状排列的踩坑清单。

**本文不负责**：RabbitMQ / Redis 本身的运维选型，Celery 到 Taskiq 的完整迁移方案，生产环境的部署编排。

**适用读者**：写过 FastAPI、用过 Celery 的 Python 后端。不解释 HTTP、依赖注入、连接池这些基础概念。

**版本**：`taskiq 0.12.6` / `taskiq-fastapi 0.5.0` / `taskiq-aio-pika 0.6.0` / `taskiq-redis 1.2.3`。本文的行为描述基于这组版本的源码链路。

## 一、先建立心智模型

### 它和 Celery 是什么关系

如果你带着 Celery 的经验过来，先对齐这张表，后面会省很多力气：

| 维度 | Celery | Taskiq |
| --- | --- | --- |
| 并发模型 | 以同步为中心，async 支持是后补的 | **asyncio 原生**，任务默认就是 `async def` |
| 序列化 | 默认 JSON / pickle，靠 kombu | **pydantic** `model_dump(mode="json")` + JSON |
| 参数还原 | 收到什么就是什么 | 按任务函数的**类型注解**自动 parse 回去 |
| 依赖注入 | 无，靠全局对象或 `bind=True` | **内建 DI**，语法接近 FastAPI 的 `Depends` |
| 定时任务 | beat 独立进程 | `taskiq scheduler` 独立进程，任务标签里写 cron |
| Broker 抽象 | kombu | 自己的 `AsyncBroker` 抽象，按需装驱动包 |

最需要记住的差异是第三行：**Taskiq 会用类型注解把参数"还原"回去**。这带来了 Celery 没有的便利，也带来了 Celery 没有的坑——本文后面会反复回到这一点。

### 组件全图

{{< mermaid >}}
flowchart LR
    App["FastAPI 进程"] --> Kicker["Kicker 组装消息"]
    Kicker --> MW1["Middleware pre_send"]
    MW1 --> Broker["Broker 投递"]
    Broker --> Queue["消息队列 RabbitMQ 或 Redis"]
    Queue --> Worker["Worker 进程 listen"]
    Worker --> MW2["Middleware pre_execute"]
    MW2 --> Task["任务函数 执行"]
    Task --> RB["Result backend 保存结果"]
    Sched["Scheduler 进程"] --> Broker
{{< /mermaid >}}

### 每个组件是个黑盒

先不看内部实现，只看它解决什么问题、吃什么、吐什么、怎么算成功：

{{< tabs group="taskiq-components" default="Broker" >}}
{{< tab label="Broker" >}}
**解决什么问题**：把任务消息送出去，以及在 worker 侧把它们取回来。

- **输入**：`TaskiqMessage`（task_id、task_name、labels、args、kwargs）
- **输出**：投递成功，或抛 `SendTaskError`
- **关键参数**：连接 URL（决定 API 和 worker 是不是在同一个队列上）
- **成功标志**：`.kiq()` 返回了带 `task_id` 的对象
- **常见错误**：API 连 `localhost`、worker 在容器里也连 `localhost`——那是两个队列
- **能不能跳过**：不能，它是核心抽象
- **下一步**：消息进队列，等 worker `listen` 取走
{{< /tab >}}
{{< tab label="Result backend" >}}
**解决什么问题**：保存任务的返回值、异常和执行信息，供之后按 `task_id` 查询。

- **输入**：`task_id` + `TaskiqResult`
- **输出**：`is_result_ready()` 的布尔值、`get_result()` 的 `TaskiqResult`
- **关键参数**：存储 URL、结果保留时长
- **成功标志**：查询接口能拿到真实的 `return_value`
- **常见错误**：**不配也不会报错**——默认的 `DummyResultBackend` 会假装成功，详见第四节
- **能不能跳过**：fire-and-forget 的任务可以跳过；要轮询状态就不能
- **下一步**：`post_save` 中间件钩子
{{< /tab >}}
{{< tab label="Worker" >}}
**解决什么问题**：跑一个独立进程，从 broker 取消息、找到函数、执行。

- **输入**：命令行给的 `module:broker` 和任务模块列表
- **输出**：任务执行，结果写进 result backend
- **关键参数**：`--workers`（进程数，默认 2）、`--max-async-tasks`（单进程并发上限）、`--ack-type`
- **成功标志**：worker 日志里出现任务执行记录
- **常见错误**：没在命令里列出任务模块，注册表是空的
- **能不能跳过**：不能
- **下一步**：调用任务函数前先过 `pre_execute`
{{< /tab >}}
{{< tab label="Middleware" >}}
**解决什么问题**：在消息发送前后、任务执行前后插逻辑——重试、埋点、日志。

- **输入**：消息或执行上下文
- **输出**：修改后的消息，或副作用
- **钩子顺序**：`pre_send` → `post_send` →（跨进程）→ `pre_execute` →（异常时 `on_error`）→ `post_execute` → `post_save`
- **成功标志**：失败任务真的被重投了，或指标真的上报了
- **常见错误**：以为加了 `SimpleRetryMiddleware` 所有任务就会重试——还要在任务上打标签
- **能不能跳过**：可以，但重试基本是刚需
- **下一步**：见第四节的重试配置
{{< /tab >}}
{{< tab label="Scheduler" >}}
**解决什么问题**：按 cron 或指定时间把任务投进队列。

- **输入**：`TaskiqScheduler(broker=..., sources=[LabelScheduleSource(broker)])`
- **输出**：到点往 broker 投消息
- **关键参数**：任务装饰器上的 `schedule=[{"cron": "..."}]`
- **成功标志**：到点队列里出现新消息
- **常见错误**：**起了多个 scheduler 实例**，同一个时间点任务被投多次
- **能不能跳过**：不需要定时任务就跳过
- **下一步**：消息进队列，和普通任务走同一条路
{{< /tab >}}
{{< /tabs >}}

### 两条边界

把上面这张图压缩一下，只剩两件事会影响你后面写的每一行代码：

| 边界 | 划在哪 | 直接后果 |
| --- | --- | --- |
| **序列化边界** | `.kiq()` 组装消息的那一刻 | 参数要能被 pydantic 转成 JSON，而且**会变形** |
| **进程边界** | broker 两侧 | worker 有自己的注册表、自己的连接、**没有那次 HTTP 请求** |

这两条是本文剩余部分的判断依据。遇到任何没见过的 Taskiq 问题，先问：**这东西过得了序列化边界吗？它在哪一侧被重建？**

## 二、看见那条消息

"参数会变形"是本文最反直觉的一点，用表格讲不如直接看。下面这个 demo 让你把不同类型的参数丢进 `.kiq()`，看它在队列里变成什么、worker 侧又拿到什么。

<div class="kiqmsg">
  <div class="kiqmsg__picker" role="group" aria-label="选择传给 kiq 的参数类型">
    <button type="button" class="kiqmsg__btn" data-case="int" aria-pressed="true">int</button>
    <button type="button" class="kiqmsg__btn" data-case="dict" aria-pressed="false">dict</button>
    <button type="button" class="kiqmsg__btn" data-case="datetime" aria-pressed="false">datetime</button>
    <button type="button" class="kiqmsg__btn" data-case="set" aria-pressed="false">set</button>
    <button type="button" class="kiqmsg__btn" data-case="model" aria-pressed="false">Pydantic model</button>
    <button type="button" class="kiqmsg__btn" data-case="noannot" aria-pressed="false">datetime 但没注解</button>
    <button type="button" class="kiqmsg__btn" data-case="session" aria-pressed="false">DB session</button>
  </div>

  <div class="kiqmsg__live" role="status" aria-live="polite">
    <div class="kiqmsg__grid">
      <div class="kiqmsg__col">
        <h3 class="kiqmsg__h">① 你写的调用</h3>
        <pre class="kiqmsg__code" data-call></pre>
      </div>
      <div class="kiqmsg__col">
        <h3 class="kiqmsg__h">
          <span data-outlabel>② 队列里的消息</span>
          <span class="kiqmsg__tag" data-tag>过得去</span>
        </h3>
        <pre class="kiqmsg__code" data-out></pre>
      </div>
      <div class="kiqmsg__col">
        <h3 class="kiqmsg__h">③ worker 侧拿到</h3>
        <pre class="kiqmsg__code" data-recv></pre>
      </div>
    </div>
    <p class="kiqmsg__note" data-note></p>
  </div>

  <p class="kiqmsg__disclaimer">依据 taskiq 0.12.6 的序列化链路（<code>ProxyFormatter</code> → <code>model_dump(mode="json")</code> → <code>JSONSerializer</code>）与 worker 侧 <code>parse_params</code> 复刻验证得出，页面本身没有连接 broker，展示的不是实时运行输出。</p>
</div>

<style>
.kiqmsg {
  --kq-line: rgb(var(--color-neutral-300));
  --kq-soft: rgb(var(--color-neutral-100));
  --kq-ink: rgb(var(--color-neutral-700));
  --kq-ok: rgb(13 92 43);
  --kq-warn: rgb(146 64 14);
  --kq-bad: rgb(159 18 18);
  margin: 2rem 0;
  padding: 1rem;
  border: 1px solid var(--kq-line);
  border-radius: 8px;
}
html.dark .kiqmsg {
  --kq-line: rgb(var(--color-neutral-600));
  --kq-soft: rgb(var(--color-neutral-800));
  --kq-ink: rgb(var(--color-neutral-200));
  --kq-ok: rgb(134 239 172);
  --kq-warn: rgb(253 205 140);
  --kq-bad: rgb(252 165 165);
}
.kiqmsg__picker { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.9rem; }
.kiqmsg__btn {
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--kq-line);
  border-radius: 999px;
  background: transparent;
  color: var(--kq-ink);
  font-size: 0.85rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  cursor: pointer;
}
.kiqmsg__btn[aria-pressed="true"] {
  border-color: rgb(var(--color-primary-600));
  background: var(--kq-soft);
  font-weight: 700;
}
.kiqmsg__btn:focus-visible {
  outline: 2px solid rgb(var(--color-primary-600));
  outline-offset: 2px;
}
.kiqmsg__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.9rem; }
@media (max-width: 900px) { .kiqmsg__grid { grid-template-columns: 1fr; } }
.kiqmsg__col { min-width: 0; }
.kiqmsg__h {
  margin: 0 0 0.35rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--kq-ink);
  display: flex; align-items: center; gap: 0.5rem;
}
.kiqmsg__tag { font-size: 0.72rem; padding: 0.05rem 0.45rem; border-radius: 4px; border: 1px solid currentColor; }
.kiqmsg__tag[data-ok="yes"] { color: var(--kq-ok); }
.kiqmsg__tag[data-ok="warn"] { color: var(--kq-warn); }
.kiqmsg__tag[data-ok="no"] { color: var(--kq-bad); }
.kiqmsg__code {
  margin: 0;
  padding: 0.7rem;
  border-radius: 6px;
  background: var(--kq-soft);
  color: var(--kq-ink);
  font-size: 0.8rem;
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre;
  min-height: 7rem;
}
@media (max-width: 480px) { .kiqmsg__code { font-size: 0.72rem; } }
.kiqmsg__note { margin: 0.8rem 0 0; font-size: 0.9rem; }
.kiqmsg__disclaimer { margin: 0.5rem 0 0; font-size: 0.78rem; color: var(--kq-ink); }
</style>

<script>
(() => {
  const root = document.querySelector('.kiqmsg');
  const CASES = {
    int: {
      call: 'await send_mail.kiq(42)\n\n# 任务签名\nasync def send_mail(user_id: int)',
      ok: 'yes', label: '② 队列里的消息',
      out: '{\n  "task_name": "emails.send",\n  "args": [42],\n  "kwargs": {}\n}',
      recv: 'user_id = 42\ntype: int',
      note: '原样过去，原样回来。数字、字符串、布尔、None 都是这种情况。'
    },
    dict: {
      call: 'await build_report.kiq({"month": "2026-09"})\n\n# 任务签名\nasync def build_report(spec: dict)',
      ok: 'yes', label: '② 队列里的消息',
      out: '{\n  "task_name": "reports.build",\n  "args": [{"month": "2026-09"}],\n  "kwargs": {}\n}',
      recv: 'spec = {"month": "2026-09"}\ntype: dict',
      note: '嵌套的 dict 和 list 也原样过，只要里面装的还是 JSON 认识的类型。'
    },
    datetime: {
      call: 'await build_report.kiq(datetime(2026, 9, 13, 12, 0))\n\n# 任务签名\nasync def build_report(at: datetime)',
      ok: 'warn', label: '② 队列里的消息（已变形）',
      out: '{\n  "task_name": "reports.build",\n  "args": ["2026-09-13T12:00:00"],\n  "kwargs": {}\n}',
      recv: 'at = datetime(2026, 9, 13, 12, 0)\ntype: datetime',
      note: '这是 Taskiq 和 Celery 最不一样的地方：队列里躺的是 ISO 字符串，但 worker 按 at: datetime 这个注解又把它 parse 回了 datetime。端到端是通的——前提是注解写对了。'
    },
    set: {
      call: 'await sync_tags.kiq({"vip", "beta"})\n\n# 任务签名\nasync def sync_tags(tags: set[str])',
      ok: 'warn', label: '② 队列里的消息（已变形）',
      out: '{\n  "task_name": "tags.sync",\n  "args": [["beta", "vip"]],\n  "kwargs": {}\n}',
      recv: 'tags = {"vip", "beta"}\ntype: set',
      note: 'set 在队列里是 list，注解写了 set[str] 就能还原。注意中间那一步顺序是不保证的——如果你的任务依赖顺序，这里会埋雷。'
    },
    model: {
      call: 'await create_user.kiq(UserCreate(name="张三", age=30))\n\n# 任务签名\nasync def create_user(u: UserCreate)',
      ok: 'yes', label: '② 队列里的消息',
      out: '{\n  "task_name": "users.create",\n  "args": [{"name": "张三", "age": 30}],\n  "kwargs": {}\n}',
      recv: 'u = UserCreate(name="张三", age=30)\ntype: UserCreate',
      note: 'Pydantic 模型能直接传——序列化成 dict，worker 按注解验证回模型对象。Celery 用户在这里往往会习惯性先 .model_dump()，其实不必。'
    },
    noannot: {
      call: 'await build_report.kiq(datetime(2026, 9, 13, 12, 0))\n\n# 任务签名（注意：没写类型）\nasync def build_report(at)',
      ok: 'no', label: '② 队列里的消息（已变形）',
      out: '{\n  "task_name": "reports.build",\n  "args": ["2026-09-13T12:00:00"],\n  "kwargs": {}\n}',
      recv: 'at = "2026-09-13T12:00:00"\ntype: str   ← 不是 datetime',
      note: '同样的调用，只因为少写了一个注解，worker 拿到的就是字符串。不报错、不警告，直到你在任务里调 at.year 才炸。这是 Taskiq 最隐蔽的坑：还原靠的是注解，不是魔法。'
    },
    session: {
      call: 'await refresh_user.kiq(db=session)\n\n# session 是 AsyncSession 实例',
      ok: 'no', label: '② 打包时抛出的异常',
      out: 'taskiq.exceptions.SendTaskError\n\n由 pydantic_core\n  .PydanticSerializationError\n  Unable to serialize unknown type\n引发',
      recv: '（worker 全程没有参与）',
      note: '连接、句柄、client 这类活对象真的过不去。注意异常抛在 API 进程里——接口直接 500，worker 日志干干净净，别去 worker 那边找。'
    }
  };

  const els = {
    call: root.querySelector('[data-call]'),
    out: root.querySelector('[data-out]'),
    recv: root.querySelector('[data-recv]'),
    tag: root.querySelector('[data-tag]'),
    outlabel: root.querySelector('[data-outlabel]'),
    note: root.querySelector('[data-note]'),
    btns: Array.from(root.querySelectorAll('.kiqmsg__btn'))
  };
  const TAG_TEXT = { yes: '过得去', warn: '过得去但变形', no: '有问题' };

  const render = (key) => {
    const c = CASES[key];
    els.call.textContent = c.call;
    els.out.textContent = c.out;
    els.recv.textContent = c.recv;
    els.outlabel.textContent = c.label;
    els.tag.textContent = TAG_TEXT[c.ok];
    els.tag.dataset.ok = c.ok;
    els.note.textContent = c.note;
    els.btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.case === key)));
  };

  els.btns.forEach((b) => b.addEventListener('click', () => render(b.dataset.case)));
  render('int');
})();
</script>

点完一轮，序列化边界的规律就出来了：

- **活对象过不去**，而且失败发生在 API 进程，不在 worker。
- **富类型过得去，但在队列里是变形的**，还原完全依赖任务函数的类型注解。
- 所以 Taskiq 里"参数写对"包含两件事：**传的东西能序列化**，以及**函数签名上的注解写全了**。

## 三、先跑通：三份文件

{{< alert icon="circle-info" >}}
如果你的场景只是"请求结束后写条日志、发个轻通知"，先跳到第六节的选型表——很可能你不需要 Taskiq，`BackgroundTasks` 就够。
{{< /alert >}}

```text
app/
  broker.py    # broker、result backend、FastAPI app 路径
  main.py      # FastAPI app 和 HTTP 接口
  tasks.py     # worker 要执行的任务
```

文件名用 `broker.py` 而不是 `taskiq.py`——后者会和库同名，在 `app/` 目录里直接跑脚本时会遮蔽掉真正的 `taskiq` 包。

本文示例要求 **Python 3.10+**（用到了 `int | str` 这类联合类型注解）。

```bash
pip install fastapi uvicorn taskiq taskiq-fastapi taskiq-aio-pika taskiq-redis

docker run --rm -d --name tq-rabbit -p 5672:5672 rabbitmq:4-alpine
docker run --rm -d --name tq-redis  -p 6379:6379 redis:7-alpine
```

三份文件各自的职责，先看伪代码：

```text
broker.py:  建 broker -> 挂 result backend -> 告诉它 FastAPI app 在哪
main.py:    API 进程启动 broker client -> 接口里 kiq 投递 -> 另开接口按 task_id 查
tasks.py:   装饰器注册任务 -> 参数只收数据 -> 注解写全
```

{{< tabs group="taskiq-minimal" default="app/broker.py" >}}
{{< tab label="app/broker.py" >}}
```python
from taskiq_aio_pika import AioPikaBroker
from taskiq_redis import RedisAsyncResultBackend
import taskiq_fastapi

broker = AioPikaBroker("amqp://guest:guest@localhost:5672/").with_result_backend(
    # 不挂这一行也能跑，但查询结果会拿到假的成功。见第四节。
    RedisAsyncResultBackend("redis://localhost:6379/0"),
)

# 告诉 worker：需要 FastAPI app 时去这个路径导入。
# 传字符串而不是 app 对象，避开循环导入。
taskiq_fastapi.init(broker, "app.main:app")
```
{{< /tab >}}
{{< tab label="app/main.py" >}}
```python
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from pydantic import BaseModel
from redis.asyncio import ConnectionPool

from app.broker import broker
from app.tasks import send_welcome_email


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 这个 lifespan 会被执行两次：API 进程一次，worker 进程一次。
    # taskiq_fastapi.init 注册的 WORKER_STARTUP 处理器会在 worker 侧
    # 把 app 的 lifespan 再跑一遍——这正是 worker 能拿到 app.state 的原因。
    app.state.redis_pool = ConnectionPool.from_url("redis://localhost:6379/1")

    # 而 broker client 只有 API 进程需要启动，不加守卫会递归。
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
    task = await send_welcome_email.kiq(payload.user_id)
    return {"task_id": task.task_id}


@app.get("/tasks/{task_id}")
async def get_task_result(task_id: str):
    # 注意：不存在的 task_id 在这里也会返回 pending——result backend
    # 只知道"没有这个 key"，区分不了"还没跑完"和"你拼错了"。
    if not await broker.result_backend.is_result_ready(task_id):
        return {"status": "pending"}

    # 上下两行是两次独立往返，中间结果可能过期，
    # 此时 get_result 抛 ResultIsMissingError。不要吞掉它。
    result = await broker.result_backend.get_result(task_id)
    if result.is_err:
        # 把真实异常带出去，否则调试失败任务时只能看到"failed"。
        return {"status": "failed", "error": str(result.error)}
    return {"status": "done", "value": result.return_value}
```
{{< /tab >}}
{{< tab label="app/tasks.py" >}}
```python
from app.broker import broker


# task_name 显式写死：以后挪模块、改函数名，队列里的旧消息仍然认得它。
@broker.task(task_name="emails.send_welcome")
async def send_welcome_email(user_id: int) -> dict[str, int | str]:
    # 注解不只是文档——worker 靠它把参数 parse 回正确的类型。
    return {"user_id": user_id, "status": "sent"}
```
{{< /tab >}}
{{< /tabs >}}

两个进程分别起：

```bash
uvicorn app.main:app --reload                    # 进程一：API
taskiq worker app.broker:broker app.tasks        # 进程二：worker
```

**成功标志**是这一串：

```bash
TASK_ID=$(curl -sX POST http://127.0.0.1:8000/emails/welcome \
  -H "content-type: application/json" -d '{"user_id": 42}' | jq -r .task_id)
# 拿到 task_id，说明 broker 通了

curl "http://127.0.0.1:8000/tasks/$TASK_ID"
# {"status":"done","value":{"user_id":42,"status":"sent"}}
#                   ^^^^^ value 不是 null，才说明 result backend 真的在工作
```

## 四、配置

### Broker

驱动包是分开装的，选哪个就装哪个：

| Broker | 包 | 适合 |
| --- | --- | --- |
| RabbitMQ | `taskiq-aio-pika` | 需要可靠投递、路由、死信队列 |
| Redis | `taskiq-redis` | 已有 Redis，任务量中等，不想多一个组件 |
| NATS | `taskiq-nats` | 已有 NATS 基础设施 |
| Kafka | `taskiq-aio-kafka` | 已有 Kafka，需要高吞吐和消息留存 |
| 内存 | 内置 `InMemoryBroker` | **仅测试**，不跨进程 |

唯一一个必须对齐的配置是连接 URL：**API 进程和 worker 进程必须指向同一个队列**。容器化之后这是最高频的故障源——API 在宿主机连 `localhost:5672`，worker 在容器里也写 `localhost:5672`，后者指向容器自己，通常是连接被拒；如果容器里恰好也有个 broker，那更糟——两边各连各的，消息永远碰不到面。

### Result backend 与那个假的成功

这是我认为 Taskiq 最值得单独拎出来讲的一个默认行为。

不挂 result backend，broker 会用默认的 `DummyResultBackend`。它的 `is_result_ready()` **无条件返回 `True`**，`get_result()` 返回一个 `return_value=None` 的空结果，同时发一条 `UserWarning`。

也就是说，用第三节那个查询接口，没配 result backend 时你会看到：

```json
{"status": "done", "value": null}
```

**任务可能还没开始跑，接口已经告诉你"完成了"。** 这比报错难查得多——它长得像成功。

| 你看到的 | 真实情况 |
| --- | --- |
| 立刻 `done` 且 `value` 为 `null` | 大概率没配 result backend |
| 日志里有 `No result backend configured` | 确认没配 |
| `pending` 一直不变 | 这才是"任务真的没被执行" |

配上之后还有一个参数要想清楚：**结果留多久**。`RedisAsyncResultBackend` 支持 `result_ex_time`（秒）和 `result_px_time`（毫秒）设置过期。不设的话结果会一直堆在 Redis 里。

### taskiq_fastapi.init

```python
taskiq_fastapi.init(broker, "app.main:app")
```

它解决的是"worker 侧怎么拿到 FastAPI app"。第二个参数可以是 `"module:attr"` 字符串、`FastAPI` 实例，或者返回实例的工厂函数。**传字符串是推荐写法**，因为 broker 模块通常被 `main.py` 导入，反过来再导入 app 就成环了。

### Worker CLI

```bash
taskiq worker app.broker:broker app.tasks
#              ^^^^^^^^^^^^^^^^ broker 在哪    ^^^^^^^^^ 任务模块，不写就没有任务
```

常用参数：

| 参数 | 默认 | 作用 |
| --- | --- | --- |
| `--workers` | `2` | 起几个 worker 进程 |
| `--max-async-tasks` | 无上限 | 单个进程内同时跑多少个异步任务 |
| `--max-prefetch` | `0` | 预取多少条消息，`0` 表示不预取 |
| `--ack-type` | `when_saved` | 什么时候确认消费，见下 |
| `--fs-discover` / `-fsd` | 关 | 递归扫描任务文件，不用手写模块名 |
| `--tasks-pattern` / `-tp` | `**/tasks.py` | 配合 `--fs-discover` 的匹配模式 |
| `--reload` / `-r` | 关 | 热重载，**只在开发用** |
| `--max-threadpool-threads` | — | 同步任务函数用的线程数 |
| `--no-parse` | 关 | 关掉按注解自动还原参数 |
| `--shutdown-timeout` | `5` 秒 | 优雅关闭等待时长 |

`--ack-type` 值得单独说，它决定消息什么时候从队列里消失：

| 值 | 何时 ack | 崩溃时的后果 |
| --- | --- | --- |
| `when_received` | 一收到就确认 | 任务丢失 |
| `when_executed` | 执行完确认 | 结果可能没存上 |
| `when_saved`（默认） | 结果存完才确认 | 最安全，可能重复执行 |
| `manual` | 自己在任务里调 | 完全自己负责 |

默认的 `when_saved` 意味着**任务可能被执行不止一次**（worker 在存结果后、ack 前崩了）。所以任务函数应当尽量幂等——这一点和 Celery 是一样的。

### 任务级配置与重试

重试需要两步，只做一步不生效：

```python
from taskiq import SimpleRetryMiddleware

# 第一步：给 broker 装上中间件
broker = AioPikaBroker(url).with_middlewares(
    SimpleRetryMiddleware(default_retry_count=3),
)

# 第二步：在任务上打标签，否则这个任务不会重试
@broker.task(task_name="emails.send_welcome", retry_on_error=True, max_retries=5)
async def send_welcome_email(user_id: int) -> None:
    ...
```

需要指数退避和抖动时换 `SmartRetryMiddleware`，它多了 `default_delay`、`use_jitter`、`use_delay_exponent` 这些参数。

### 配置速查

| 配置点 | 放在哪 | 配错了会怎样 |
| --- | --- | --- |
| broker URL | `broker.py` | 消息投到了另一个队列，看起来像"任务不执行" |
| result backend | `broker.py` | 查询接口返回假的 `done` + `null` |
| 结果过期时间 | result backend 参数 | 结果永久堆积在 Redis |
| `taskiq_fastapi.init` | `broker.py` | worker 侧依赖注入拿不到 app |
| `broker.startup()` | FastAPI lifespan | 接口里 `.kiq()` 报错 |
| 任务模块 | worker 命令行 | worker 找不到任务 |
| `task_name` | `@broker.task` | 改模块名后旧消息认不出来 |
| `retry_on_error` | `@broker.task` | 装了中间件也不重试 |
| 参数类型注解 | 任务函数签名 | **参数类型被静默改变** |

## 五、使用

### 依赖注入的三层

Taskiq 的 DI 有三种来源，解决的问题不同：

{{< tabs group="taskiq-di" default="TaskiqState" >}}
{{< tab label="TaskiqState" >}}
worker 进程自己的全局状态，适合放连接池这类需要在 worker 启动时建立、关闭时释放的资源：

```python
from taskiq import Context, TaskiqDepends, TaskiqEvents, TaskiqState

@broker.on_event(TaskiqEvents.WORKER_STARTUP)
async def startup(state: TaskiqState) -> None:
    state.redis = ConnectionPool.from_url("redis://localhost/1")

@broker.on_event(TaskiqEvents.WORKER_SHUTDOWN)
async def shutdown(state: TaskiqState) -> None:
    await state.redis.disconnect()

@broker.task
async def my_task(context: Context = TaskiqDepends()) -> None:
    redis = Redis(connection_pool=context.state.redis)
```

可用事件：`WORKER_STARTUP` / `WORKER_SHUTDOWN` / `CLIENT_STARTUP` / `CLIENT_SHUTDOWN`。
{{< /tab >}}
{{< tab label="TaskiqDepends" >}}
和 FastAPI 的 `Depends` 用法几乎一样，支持函数依赖、类依赖和生成器依赖：

```python
async def get_dao(context: Context = TaskiqDepends()) -> MyDAO:
    return MyDAO(context.state.db_pool)

@broker.task
async def sync_user(user_id: int, dao: MyDAO = TaskiqDepends(get_dao)) -> None:
    await dao.touch(user_id)
```

生成器依赖可以做前后置，适合事务：

```python
async def transaction(context: Context = TaskiqDepends()) -> AsyncGenerator[Conn, None]:
    async with context.state.db_pool.begin() as conn:
        yield conn   # 任务里抛异常时，这里能捕获并回滚
```

同一次执行里共享依赖默认只求值一次，要强制重算传 `use_cache=False`。
{{< /tab >}}
{{< tab label="FastAPI Request" >}}
装了 `taskiq-fastapi` 之后，可以在任务依赖里注入 `Request`——但它是 worker 侧**重建出来的壳**：

```python
from typing import Annotated
from fastapi import Request
from taskiq import TaskiqDepends

async def get_redis_pool(request: Annotated[Request, TaskiqDepends()]):
    return request.app.state.redis_pool
```

这个壳上有什么、没什么：

| 能读 | 读不到 |
| --- | --- |
| `request.app` | `request.headers` |
| `request.app.state` | `request.cookies` |
| 应用级配置和连接池 | `request.client.host`、path 参数、当前用户 |

读不到的那些不是返回空，是 `scope` 里根本没有这个键——直接 `KeyError`。
{{< /tab >}}
{{< /tabs >}}

判断标准一句话：**把这段依赖从 HTTP 请求里拿走，它还活得下去吗？** 活不下去的值，在 `.kiq()` 时当普通参数显式传过去：

下面是接在前面 `app/main.py` 后面的片段，`request.state.user_id` 假设由鉴权中间件写入：

```python
class ReportRequest(BaseModel):
    report_id: int


@app.post("/reports")
async def create_report(request: Request, payload: ReportRequest):
    # 缺这个 header 会 KeyError -> 500，语义上它应该是 400。
    # 真实项目里用 FastAPI 的 Header 参数声明成必填更合适。
    tenant_id = request.headers["x-tenant-id"]

    # 该从请求里取的，在 API 这一侧取干净，再作为数据送过边界。
    task = await build_report.kiq(
        user_id=request.state.user_id,
        tenant_id=tenant_id,
        report_id=payload.report_id,
    )
    return {"task_id": task.task_id}
```

### 定时任务

```python
from taskiq import TaskiqScheduler
from taskiq.schedule_sources import LabelScheduleSource

scheduler = TaskiqScheduler(broker=broker, sources=[LabelScheduleSource(broker)])

@broker.task(schedule=[{"cron": "*/5 * * * *", "args": [1]}])
async def heavy_task(value: int) -> int:
    return value + 1
```

```bash
taskiq scheduler app.broker:scheduler app.tasks
```

**scheduler 只能起一个实例。** 起两个，每个 cron 点都会投两条消息。它是独立进程，和 worker 分开部署、分开扩容——worker 可以起十个，scheduler 只能有一个。

### 测试

测试用 `InMemoryBroker`，但要注意它不跨进程，也不会重建 FastAPI 的依赖上下文。用到 `Request` 注入的任务需要手动填：

```python
import taskiq_fastapi

@pytest.fixture(autouse=True)
def init_taskiq_deps(fastapi_app: FastAPI):
    taskiq_fastapi.populate_dependency_context(broker, fastapi_app)
    yield
    broker.custom_dependency_context = {}
```

## 六、什么时候别用它

两个进程、一条序列化边界、一套注解约定——这些代价不是每个"后台任务"都值得付：

| 场景 | 更合适 | 理由 |
| --- | --- | --- |
| 请求结束后写日志、发轻通知 | `BackgroundTasks` | 同进程跑完，不需要 broker 和 worker |
| 调外部慢接口，但调用方必须拿结果才能继续 | 直接 `await` | 拆成任务只是把等待挪个地方，还多一次轮询 |
| 批量邮件、报表、音视频处理 | Taskiq | HTTP 请求不该等这些 |
| 需要重试、ack、worker 独立扩容 | Taskiq | 正是任务队列的职责 |
| 重 CPU 计算、长时间推理 | Taskiq 或专门的任务平台 | 还要额外考虑进程池、资源隔离、超时 |

一个常见误判：「加了 Taskiq 接口就变快了」。接口确实变快了，**活并没有变少**，只是挪到了 worker 上。worker 吞吐跟不上的话，任务照样堆积，只是堆在你平时不看的地方。

## 七、常见坑

{{< accordion >}}
{{< accordionItem title="参数类型悄悄变了，任务里调方法才炸" >}}
**症状**：任务里 `at.year` 报 `AttributeError: 'str' object has no attribute 'year'`。

**原因**：`datetime` 序列化成 ISO 字符串后，worker 靠函数签名的类型注解 parse 回来。注解没写（或写成 `Any`），拿到的就是字符串。

**检查点**：任务函数签名上的注解是否完整；是否加了 `--no-parse`。

**修复**：把注解补全。这是 Taskiq 里注解的真实职责——不是文档，是运行时契约。
{{< /accordionItem >}}
{{< accordionItem title="查询接口秒回 done，但 value 永远是 null" >}}
**症状**：任务像是瞬间完成了，返回值却总是 `null`。

**原因**：没配 result backend，默认的 `DummyResultBackend` 的 `is_result_ready()` 无条件返回 `True`。

**检查点**：日志里有没有 `No result backend configured` 警告；broker 有没有 `.with_result_backend(...)`。

**修复**：挂上 result backend，顺手设结果过期时间。
{{< /accordionItem >}}
{{< accordionItem title="接口返回 task_id，任务却一直不执行" >}}
**症状**：查询一直 `pending`，worker 日志没有任何动静。

**原因**：多数是 API 和 worker 不在同一个队列上——URL 不同、vhost 不同，或者一边在容器里另一边在宿主机。

**检查点**：两边的 broker URL 逐字比对；去 RabbitMQ 管理界面看队列里有没有堆积的消息。

**修复**：统一连接地址；容器里不要写 `localhost`。
{{< /accordionItem >}}
{{< accordionItem title="worker 报找不到任务" >}}
**症状**：worker 日志提示任务名未注册。

**原因**：`@broker.task` 是导入时才执行的注册动作。worker 命令里没列出任务模块，注册表就是空的。另一种情况是函数挪了模块，默认 `task_name` 跟着变了，队列里的旧消息对不上。

**检查点**：`taskiq worker app.broker:broker app.tasks` 后面有没有跟模块；`task_name` 是否显式写死。

**修复**：显式列模块，或用 `--fs-discover`；重要任务一律显式写 `task_name`。
{{< /accordionItem >}}
{{< accordionItem title="接口直接 500，worker 日志干干净净" >}}
**症状**：`.kiq()` 抛 `SendTaskError`。

**原因**：参数里有无法序列化的活对象（DB session、client、文件句柄）。异常发生在 API 进程，worker 全程没参与。

**检查点**：看异常链里是不是 `PydanticSerializationError`。

**修复**：不传对象，传数据；任务在 worker 侧自己取连接。
{{< /accordionItem >}}
{{< accordionItem title="装了重试中间件，任务失败却不重试" >}}
**症状**：`SimpleRetryMiddleware` 已经加上了，任务抛异常后没有重投。

**原因**：中间件只是提供能力，具体哪个任务要重试得在装饰器上打标签。

**检查点**：`@broker.task(retry_on_error=True, max_retries=N)` 有没有写。

**修复**：补标签。需要退避就换 `SmartRetryMiddleware`。
{{< /accordionItem >}}
{{< accordionItem title="定时任务每次执行两遍" >}}
**症状**：cron 到点，任务被执行多次。

**原因**：起了多个 scheduler 实例。scheduler 不是无状态的，不能像 worker 那样水平扩容。

**检查点**：`ps` 一下有几个 `taskiq scheduler` 进程；容器编排里 scheduler 的副本数是不是 1。

**修复**：全局只留一个 scheduler。
{{< /accordionItem >}}
{{< accordionItem title="任务偶尔被执行两次" >}}
**症状**：没有重试配置，任务却重复执行了。

**原因**：默认 `--ack-type=when_saved`，worker 在保存结果之后、ack 之前崩掉，消息会被重新投递。

**检查点**：worker 有没有异常退出记录。

**修复**：这是 at-least-once 的正常代价。让任务幂等，或按需调整 `--ack-type`（要清楚每个值丢失什么）。
{{< /accordionItem >}}
{{< /accordion >}}

## 八、排障顺序

出问题时不要从配置文件开始翻，按消息经过的顺序切：

{{< steps >}}
{{< step number="1" title="消息发出去了吗" >}}
接口是不是返回了 `task_id`。直接 500 就是序列化失败或 `broker.startup()` 没执行——**在 API 侧解决，别去 worker 找**。
{{< /step >}}
{{< step number="2" title="两边连的是同一个队列吗" >}}
比对 API 和 worker 的 broker URL，去队列管理界面确认消息是不是真的进来了。
{{< /step >}}
{{< step number="3" title="worker 认识这个任务吗" >}}
看 worker 启动日志里注册了哪些任务名，和消息里的 `task_name` 对一下。
{{< /step >}}
{{< step number="4" title="参数还是你传的那个类型吗" >}}
任务里第一行打印参数的 `type()`。注解漏写导致的类型退化，只有在这里才看得见。
{{< /step >}}
{{< step number="5" title="结果有人记录吗" >}}
秒回 `done` 且 `value` 为 `null` 就是没配 result backend，和前四步无关。
{{< /step >}}
{{< /steps >}}

## 九、收束

一句话带走：

> **Taskiq 把一次调用序列化成消息、在另一个进程按类型注解重建。**

这句话能推出本文几乎所有内容：参数要能被 pydantic 转成 JSON（所以活对象过不去），注解决定还原成什么类型（所以漏注解会静默退化），worker 有自己的注册表（所以要显式导入任务模块），返回值走的是另一条路（所以要单独配 result backend），worker 没有那次 HTTP 请求（所以请求级上下文只能显式传）。

遇到新问题时先问那两句：**这东西过得了序列化边界吗？它在哪一侧被重建？**

## 参考

- [Taskiq Architecture overview](https://taskiq-python.github.io/guide/architecture-overview.html)
- [Taskiq CLI](https://taskiq-python.github.io/guide/cli.html)
- [State and dependencies](https://taskiq-python.github.io/guide/state-and-deps.html)
- [Scheduling tasks](https://taskiq-python.github.io/guide/scheduling-tasks.html)
- [Available middlewares](https://taskiq-python.github.io/available-components/middlewares.html)
- [Taskiq with FastAPI](https://taskiq-python.github.io/framework_integrations/taskiq-with-fastapi.html)
