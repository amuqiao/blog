---
title: "一文读懂 taskiq：kiq 之后，你的函数并没有被调用"
date: 2026-09-10T19:20:00+08:00
draft: false
description: "await send_mail.kiq(user_id) 这一行没有执行 send_mail，它把这次调用压成了一条 JSON 消息。这条序列化边界一旦划下，taskiq 后面所有设计——参数为什么不能传数据库连接、worker 为什么会「找不到任务」、结果为什么需要单独一个后端、依赖注入为什么存在——都是它的直接后果。15 站交互长卷，每处机制配一段伪代码，再对上真实源码。"
showTableOfContents: false
tags:
  - Python
  - taskiq
  - 异步
  - 任务队列
  - 可视化
categories:
  - 后端工程
series:
  - AI 学习路线
series_order: 7
---

写下 `await send_mail.kiq(user_id)`，这一行到底做了什么？

它**没有执行** `send_mail`。它把这次调用打包成一条 JSON 消息，扔进队列就返回了。真正的执行发生在另一个进程、可能另一台机器上。

```text
打包成消息  ->  扔进 broker  ->  返回一张只有 task_id 的凭据
```

这条**序列化边界**一旦划下，taskiq 后面每一个设计都是它的后果：参数为什么不能传数据库连接、worker 为什么会「找不到任务」还不报错、结果为什么要走另一条路回来、依赖注入为什么必须存在、消息什么时候才算处理完。

本文沿这条因果链走 15 站。每处机制先给一段**伪代码**说明它在做什么，再对上 taskiq 的**真实源码**（版本 0.12.4）。读者不需要用过任务队列，涉及的概念都在首次出现处讲清。

{{< button href="interactive.html" target="_blank" rel="noopener noreferrer" >}}打开完整交互长卷{{< /button >}}

<style>
  .tq-embed { width: 100%; height: 880px; border: 1px solid #D8D4E4; border-radius: 4px; background: #F5F4F8; }
  @media (max-width: 720px) { .tq-embed { display: none; } }
</style>

<iframe class="tq-embed" src="interactive.html" title="一文读懂 taskiq · 交互长卷" sandbox="allow-scripts" loading="lazy"></iframe>
