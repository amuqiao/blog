---
name: hugo-interactive-blog
description: 在本仓库写 Hugo 博客文章时使用。用于把主题、笔记或草稿构建成有主旨、有心智模型的文章，并用 Blowfish shortcode、Mermaid、图表、文字可视化、局部 HTML/CSS/vanilla JS 交互或 iframe demo 辅助讲解。
---

# Hugo Interactive Blog

这个 skill 只负责一件事：把博客写成适合 Hugo 长期维护、读者容易理解的形态。

不要把它当写作待办清单。主题、结构、深浅和表达方式由当前文章决定；这里只提醒如何使用 Hugo、Blowfish shortcode、Markdown、Mermaid、HTML/CSS/JS 组合出更清楚、更美观的文章。

目标不是优先 Markdown，而是优先讲清楚。每篇博客都要有一个清楚主旨，并给读者建立可带走的心智模型；文字、图表、shortcode 和交互都围绕这个目标服务。

默认采用总分总：先用主旨和心智模型给出全局图景，再用图文、shortcode 和交互拆解关键部分，最后收束成读者能复述和迁移的结论。

## 讲解方法

可以按主题选择成熟讲解方法，但不要把方法论机械展开成模板。

- 费曼学习法：用自然语言解释复杂概念，专业术语保留并讲清楚。
- 第一性原理：先讲底层问题和核心机制，再解释配置、现象和坑。
- SCQA：用场景、冲突、问题、答案打开主题，让读者知道为什么要读。
- 金字塔原理：先给主旨，再分层展开，最后回到结论和心智模型。
- 双编码 / 多媒体学习：让文字、图表、Mermaid、shortcode 和 HTML/CSS/JS 交互一起辅助理解。
- Diataxis：先判断文章更像教程、解释、指南还是参考，避免把入门、原理、排障和 API 手册混成一篇。

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

## 仓库与验证

仓库结构、资源映射和启动入口以根目录 `AGENTS.md` 为准。新建文章优先使用 `./run.sh blog new-post <slug>`。

发布文章时留意 `draft: false`、带 `+08:00` 的过去时间，以及 `./run.sh blog verify` 后产物页面和 `sitemap.xml` 是否真的包含新文章。普通文章也按 `AGENTS.md` 的资源约定准备 `cover.*`；构建通过不代表列表卡片和首页展示完整。

验证亮色时不要只依赖系统外观。本仓库默认是 dark，需要在浏览器里设置 `localStorage.setItem("appearance", "light")` 后刷新，确认看到的确实是亮色页面。
