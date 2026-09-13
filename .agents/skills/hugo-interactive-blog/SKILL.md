---
name: hugo-interactive-blog
description: 在本仓库写 Hugo 博客文章时使用。用于把主题、笔记或草稿构建成有主旨、有心智模型的文章，并用 Blowfish shortcode、Mermaid、图表、文字可视化、局部 HTML/CSS/vanilla JS 交互或 iframe demo 辅助讲解。
---

# 本项目 Hugo 博客写作规范

这个 skill 只负责本项目新增、扩写和重写博客文章的写作规范：先用成熟讲解方法确定文章主旨和可见心智模型，再用 Hugo shortcode、Mermaid、文字可视化和局部 HTML/CSS/JS 把知识讲清楚、讲美观、讲可维护。

不要把它当执行待办清单。主题、结构、深浅和表达方式由当前文章决定；这里给的是本项目博客的默认表达方向和少量仓库事实。

目标不是优先 Markdown，而是优先讲清楚。每篇博客必须在开头给出清楚主旨，并用文字可视化或图文结合呈现核心心智模型；读者应能通过这部分快速理解文章要解决什么问题、关键对象如何关联、后文会沿哪条线展开。

默认采用总分总：先用主旨和心智模型给出全局图景，再用图文、shortcode 和交互拆解关键部分，最后收束成读者能复述和迁移的结论。

## 默认讲解偏好

如果用户没有指定讲解方法，默认采用这组偏好。它用于固定本博客的表达口味，不是要求每篇文章机械套模板。

- 总分总 / 金字塔原理：开头给出文章主旨和可见心智模型，中间分层展开机制、步骤、例子或取舍，结尾回到读者能复述的结论。
- SCQA：开头交代场景、冲突、问题和答案，让读者先知道为什么要读，以及这篇文章解决什么问题。
- 费曼学习法 / 第一性原理：先用自然语言讲清底层问题、核心机制和必要术语，再解释配置、现象、边界和常见坑。
- Literate Programming / Worked Examples / Cognitive Load Theory：代码嵌入讲解，只给最小但完整的范例；优先伪代码、注释、输入输出和关键配置解释，避免大段源码制造认知负荷。
- 双编码 / 多媒体学习：用文字、图表、Mermaid、shortcode、文字可视化和 HTML/CSS/JS 交互共同辅助理解；能用图说明的地方少堆文字，能用交互说明状态变化的地方让读者动手观察。

如果用户指定 `$rf-first-principles` 等认知拆解结果，优先沿用其主旨、根本问题、心智模型和讲解主线；本 skill 负责把它落地成 Hugo 文章。需要区分文章类型时，可用 Diataxis 判断它更像教程、解释、指南还是参考，避免把入门、原理、排障和 API 手册混成一篇。

## 文章形态

- 页面包使用 `content/posts/<slug>/index.md`；Markdown 只是承载正文和组件的基底，不是表达上限。
- 需要结构化表达时，优先使用 Blowfish shortcode，而不是手写等价 raw HTML。
- 需要看到流程、关系、状态或变化时，主动使用图、表、Mermaid、shortcode、文字可视化或局部交互辅助讲解。
- 局部 HTML/CSS/JS 是正文的补充，不要把普通文章写成整页前端应用。
- 独立 HTML + `iframe` 只用于确实需要单独打开、隔离运行或代码量较大的 demo。

## 表达选择

按内容需要选择工具，不需要机械凑齐。

| 想表达什么 | 优先考虑 |
| --- | --- |
| 流程、架构、调用链、状态流 | `mermaid` shortcode、`steps`、`timeline` |
| 概念、方案、参数对比 | Markdown 表格、`tabs`、`accordion` |
| 重点提示、风险提醒、开篇导语 | `lead`、`alert`、`badge` |
| 图片、截图、图集 | `figure`、`gallery`、页面包资源 |
| 参数变化、分支结果、状态切换 | 文章级 HTML/CSS/vanilla JS demo |
| 大型可视化或完整交互页 | `static/posts/<slug>/...` + `iframe` |

文字负责解释上下文和结论；可视化负责呈现关系；交互负责让读者观察变化。能用图说明的地方，少堆文字；能用简单交互说明的地方，让交互辅助少量文字。

## Shortcode

Blowfish 已有 shortcode 以 `themes/blowfish/layouts/shortcodes/` 为准。常用组合：

- `mermaid` 用于流程图、架构图、时序图。使用 `{{< mermaid >}}...{{< /mermaid >}}`，不要用 Mermaid 代码围栏。
- `steps` + `step` 用于操作顺序或生命周期。
- `tabs` + `tab` 用于并列代码、配置或方案。
- `accordion` + `accordionItem` 用于常见问题、坑点和可选深入内容。
- `feature-grid` + `feature` 用于组件地图或能力概览。

Mermaid 语法尽量朴素：短 label、普通箭头、少用复杂标点。Hugo 构建不会执行 Mermaid，改过 Mermaid 后要在浏览器里确认没有 `Syntax error in text`。

## 局部 HTML/CSS/JS

文章级交互适合回答一个局部问题：调一个参数会怎样、某个状态如何变化、几个分支结果有什么不同。

小型 demo 可以直接写在 Markdown 中：HTML 外层给文章专属 class，CSS 用这个 class 限定作用域，JS 用 vanilla JS 并包在 IIFE 里。需要适配暗色时使用 `html.dark .my-demo` 和主题变量，例如 `rgb(var(--color-primary-500))`。

demo 里的文字、图形、按钮和状态反馈都应该服务讲解；模拟数据或示意动画要在相邻文字里说明是示意，不要让读者误以为是真实结果。

## 独立 iframe demo

如果 demo 需要独立打开或代码量会淹没正文，放到 `static/posts/<slug>/`，并在文章中用相对路径 iframe 引入。`content/posts/<slug>/` 和 `static/posts/<slug>/` 的 slug 保持一致。

iframe 是独立页面，继承不到父页面的主题状态；需要明暗适配时在 iframe 自己的 CSS 中处理。

## 文章元信息

新文章 front matter 保持足够完整，方便长期维护、列表展示、搜索和分享。默认包含 `title`、`description`、`summary`、`date`、`lastmod`、`draft`、`tags`、`categories`、`series`、`series_order`、`showHero`、`showTableOfContents`。

`title` 写清主题和角度；`description` 面向 SEO / meta 描述，说明文章解决什么问题；`summary` 面向站内卡片和摘要入口，帮助读者判断是否点击。`date` 和 `lastmod` 使用带 `+08:00` 的时间；正式发布时 `draft: false`。`series` / `series_order` 只在系列文章里填值。

不要默认写 `slug`、`url`、`aliases`、`robots`、`externalUrl`、`layout`、`type`；这些只在迁移、隐藏、外链或特殊模板时使用。

## 仓库与验证

仓库结构、资源映射和启动入口以根目录 `AGENTS.md` 为准。新建文章优先使用 `./run.sh blog new-post <slug>`。

发布文章时留意 `draft: false`、带 `+08:00` 的过去时间，以及 `./run.sh blog verify` 后产物页面和 `sitemap.xml` 是否真的包含新文章。普通文章也按 `AGENTS.md` 的资源约定准备 `cover.*`；构建通过不代表列表卡片和首页展示完整。

验证亮色时不要只依赖系统外观。本仓库默认是 dark，需要在浏览器里设置 `localStorage.setItem("appearance", "light")` 后刷新，确认看到的确实是亮色页面。
