---
name: hugo-interactive-blog
description: 把想法、素材或草稿转成适合长期维护的 Hugo Blowfish 知识型博客文章，优先用 Markdown + shortcode + 图文表达，复杂知识点再配文章级 HTML/CSS/vanilla JS 交互可视化。
---

# Hugo Interactive Blog

当任务是在本仓库创建、扩写、重写或整理博客文章时使用本 skill，尤其是用户只给出想法、主题、素材或草稿，希望产出可发布的 Hugo 知识型文章时。

目标不是生成一份难维护的单文件 HTML，也不是堆文字，而是用 Hugo 的内容结构、Blowfish shortcode、图文表达和必要的交互可视化，把知识点讲透并方便长期维护。

不要把它用于通用前端应用、无关文档，或不触碰博客内容的仓库维护任务。创建或大幅改写教程/解释型文章时，先阅读 [写作指南](references/writing-guide.md)。

## 创作取向

- 默认产物是契合 Hugo 的博客文章：Markdown 承担主线，shortcode 承担主题一致的图文组件，复杂交互才进入独立 HTML/CSS/JS。
- 能用图表达的，不用长段文字硬讲；能用交互图表达的，用少量文字辅助读者观察和验证。
- 写作目标是建立可复述的心智模型：先让读者看见结构、流程、输入输出或状态变化，再补术语和边界。
- 交互不是装饰。只有当它能帮助理解、对比、验证或迁移时才加入。

## 仓库形态

- 普通文章放在 `content/posts/<post-slug>/index.md`。
- 需要作为 Hugo 页面资源处理的文章专属文件，放在 `content/posts/<post-slug>/...`。
- 独立交互页放在 `static/posts/<post-slug>/...`。
- `content/posts/<post-slug>/` 与 `static/posts/<post-slug>/` 的 slug 必须一致。
- 发布内容不要引用 `.data/`；它只作为源素材、截图或外部资源的临时工作区。

## 内容策略

按文章需要选择最小发布形态：

- Hugo 原生文章：全文保留在 `index.md`，用 Markdown、Mermaid、图表、tabs、steps、timeline、gallery 等 shortcode 组织说明。
- Markdown + 局部交互：`index.md` 保留完整讲解主线，把需要操作、调参、播放、对比的部分嵌入 `iframe` 或链接到独立页面。
- 高交互讲义或模拟器：`index.md` 只保留 front matter、简短导语、入口链接和 `iframe`；完整正文和交互体验以 HTML 页面为真源。

不要在 Markdown 和独立 HTML 里重复维护完整正文。两者同时存在时，必须明确哪一份是真源。

## Hugo 与 Blowfish

- 对 Blowfish 已支持的能力，优先使用 Blowfish shortcode，而不是手写 raw HTML。当前主题可用的常见 shortcode 包括 `alert`、`badge`、`button`、`cta`、`figure`、`gallery`、`mermaid`、`chart`、`tabs`、`accordion`、`steps`、`timeline`、`feature-grid`、`video`、`youtubeLite`、`katex`、`typeit`。
- 架构图、流程图、时序图优先使用 Blowfish 的 `mermaid` shortcode；除非站点已明确支持 Mermaid 代码围栏渲染，否则不要使用 Mermaid 代码围栏。
- Markdown 链接到同名静态目录页面时，优先使用 `2d.html`、`3d.html` 这类相对链接；构建后会落在 `/posts/<slug>/` 下。
- 嵌入独立 HTML 时使用普通 `iframe`。根据交互内容设置明确的固定高度或 `aspect-ratio`；除非用户明确要求，不要增加自动 iframe 高度同步。

## 交互式 HTML

- 优先使用普通 HTML、作用域隔离的 CSS 和 vanilla JavaScript。除非用户明确要求，或文章确实需要，不要新增前端构建链或运行时依赖。
- 所有 CSS 必须通过文章专属 root class 或 ID 限定作用域，避免污染主题或其他 demo。
- 首屏应直接有用：demo 类页面应直接展示可工作的交互、可观察状态或核心图解，不要做成营销式 landing page。
- 提供读者自然会期待的控件和状态。标签保持简洁，不要在页面里写只是在解释显而易见控件的说明文字。
- 确保文字、控件、canvas/SVG 内容在移动端和桌面端都不重叠、不溢出。
- 只在外部资源稳定且适合静态发布时引用它们；否则把资源放在页面包或同名静态目录里。

## 资源

- 文章列表/首页卡片封面使用 `cover.*`。
- 文章页 hero 背景使用 `background.*`。
- 用户要求生成普通静态封面时，使用 `./run.sh blog cover <slug>`。
- 文章局部的图片、JSON、音频、视频、PDF 和 demo 资源，应根据服务方式放在文章旁边或同名静态目录里。

## 验证

声称完成前，运行最小相关验证：

- 内容或构建相关改动：`./run.sh blog verify`。
- 脚本或 shell 改动：补充与编辑文件匹配的窄范围语法检查或单元检查。
- 交互页改动：当视觉行为重要时，用 `./run.sh up` 预览；如果浏览器工具可用，再用浏览器或截图检查页面。

如果无法验证，说明具体原因和剩余风险。
