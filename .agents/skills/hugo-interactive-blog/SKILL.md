---
name: hugo-interactive-blog
description: 把想法、素材或草稿转成适合长期维护的 Hugo Blowfish 知识型博客文章，默认用 Markdown + shortcode 组织正文，按需加入文章级 HTML/CSS/vanilla JS 局部交互。
---

# Hugo Interactive Blog

当任务是在本仓库创建、扩写、重写或整理博客文章时使用本 skill，尤其是用户只给出想法、主题、素材或草稿，希望产出可发布的 Hugo 知识型文章时。

目标不是生成一份难维护的单文件 HTML，也不是堆文字，而是用 Hugo 正文、Blowfish shortcode、图文表达和必要的局部交互，把知识点讲透并方便长期维护。

不要把它用于通用前端应用、无关文档，或不触碰博客内容的仓库维护任务。创建或大幅改写教程/解释型文章时，先阅读 [写作指南](references/writing-guide.md)。

## 创作取向

- 默认产物是契合 Hugo 的博客文章：Markdown 承担主线，shortcode 承担主题一致的图文组件，HTML/CSS/JS 只作为必要的文章级交互增强。
- 能用图表达的，不用长段文字硬讲；能用交互图表达的，用少量文字辅助读者观察和验证。
- 写作目标是建立可复述的心智模型：先让读者看见结构、流程、输入输出或状态变化，再补术语和边界。
- 交互不是装饰。只有当它能帮助理解、对比、验证或迁移时才加入。
- 不再以既有单文件交互长卷或 `static/posts/` 下的旧完整 HTML 页作为新文章范本。

## 仓库形态

仓库结构、资源映射和启动入口以根目录 `AGENTS.md` 为准。常用规则：

- 普通文章放在 `content/posts/<post-slug>/index.md`。
- 文章专属图片、PDF、JSON、音频、视频等页面资源优先放在 `content/posts/<post-slug>/...`。
- 局部交互 demo 默认内联在 Markdown 中。只有需要独立打开、代码过长，或确实需要与主题页面隔离时，才放在 `static/posts/<post-slug>/...` 并从文章用相对链接或 `iframe` 引用。
- `content/posts/<post-slug>/` 与 `static/posts/<post-slug>/` 的 slug 必须一致。

## 表达复杂度阶梯

按文章需要逐级增加表达能力，不要一开始就进入全 HTML：

- 第一层：用 Markdown 写清主线、上下文、例子、边界和结论。
- 第二层：用 Blowfish shortcode 承担主题一致的图文表达，例如 Mermaid、图表、步骤、时间线、折叠、标签页、图片集。
- 第三层：当 shortcode 不足以表达“读者需要操作后观察变化”的内容时，增加文章级 HTML/CSS/vanilla JS 局部交互。默认直接内联在 Markdown 中，确有独立打开或隔离需求时才放到 `static/posts/<slug>/...` 后嵌入或链接。

新文章默认由 Markdown 做正文真源。HTML/CSS/JS 是局部增强，不维护另一份完整正文。

## Front Matter 契约

- 新文章必须有 `date`，并带 `+08:00` 时区偏移。
- `date` 必须是当前时间之前的过去时间，正式发布文章必须设置 `draft: false`。未来时间和 `draft: true` 都会导致 Hugo 静默跳过文章，构建仍可能成功。
- 新形态正文在 Markdown 中，默认保留站内目录；不要照抄旧文章把 `showTableOfContents` 设为 `false`，除非这篇文章确有特殊理由。
- 创建文章后，构建验证还要确认 `public/posts/<post-slug>/index.html` 已实际生成，并被 `public/sitemap.xml` 收录。

## Hugo 与 Blowfish

- 对 Blowfish 已支持的能力，优先使用 Blowfish shortcode，而不是手写 raw HTML。当前主题可用的常见 shortcode 包括 `alert`、`badge`、`button`、`cta`、`lead`、`figure`、`gallery`、`mermaid`、`chart`、`tabs` + `tab`、`accordion` + `accordionItem`、`steps` + `step`、`timeline` + `timelineItem`、`feature-grid` + `feature`、`stat`、`stats`、`video`、`youtubeLite`、`katex`、`typeit`、`codeimporter`。实际可用清单以 `themes/blowfish/layouts/shortcodes/` 为准。
- 架构图、流程图、时序图优先使用 Blowfish 的 `mermaid` shortcode；除非站点已明确支持 Mermaid 代码围栏渲染，否则不要使用 Mermaid 代码围栏。
- 站点已开启 Goldmark raw HTML 和 block attributes；小型文章级 HTML、`<style>`、`<script>` 可以直接写在 Markdown 中，Markdown 块也可以用 `{.class}` 加类。
- Markdown 链接到同名静态目录页面时，优先使用 `2d.html`、`3d.html` 这类相对链接；构建后会落在 `/posts/<slug>/` 下。
- 嵌入局部 demo 页面时使用普通 `iframe`。根据交互内容设置明确的固定高度或 `aspect-ratio`；除非用户明确要求，不要增加自动 iframe 高度同步。
- `iframe` 是独立文档，不能继承父页面的 `html.dark`。放进 `iframe` 的 demo 必须在自身 CSS 中用 `prefers-color-scheme` 适配明暗，并接受它不跟随站点外观开关这一代价。

## 明暗主题

- 本站默认外观是 dark，并会随系统自动切换。文章级 demo 必须同时适配亮色和暗色。
- 暗色分支使用 `html.dark .my-demo { ... }`，因为 Blowfish 通过 `html.dark` 控制暗色模式。
- demo 的文字、边框、背景、按钮等界面色优先使用主题变量，例如 `rgb(var(--color-neutral-200))`、`rgb(var(--color-neutral-800))`、`rgb(var(--color-primary-500))`。
- 不要把 UI 颜色硬编码成只适合某一套主题的色值。确需数据可视化配色时，用本 demo 的 CSS 变量集中声明，并为亮色/暗色各给一套。
- 明暗两套都要满足基本对比度；颜色不能作为唯一信息载体。
- 深色底不要设置 `-webkit-font-smoothing: antialiased`；它会让中日韩字形变细。深色 demo 的行高应比亮色略宽松。
- 淡化状态不要用 `opacity` 压整块内容，避免把文字对比度一起压低；优先只降低背景饱和度或调整背景色，文字保持可读。

## 文章级 HTML/CSS/JS

- 优先使用普通 HTML、作用域隔离的 CSS 和 vanilla JavaScript。除非用户明确要求，或文章确实需要，不要新增前端构建链或运行时依赖。
- 所有 CSS 必须通过文章专属 root class 或 ID 限定作用域，避免污染主题或其他 demo。
- 一次性 demo 样式优先放在文章内联 `<style>`；同一套样式在第二篇文章复用时，再上提到 `assets/css/custom.css`。
- demo 块宽度贴合正文列，不自定义全站正文宽度，也不覆盖 `assets/css/custom.css` 中的内容宽度策略。
- 首屏应直接有用：demo 类页面应直接展示可工作的交互、可观察状态或核心图解，不要做成营销式 landing page。
- 提供读者自然会期待的控件和状态。控件要有可访问名称；滑块等动态控件要同步可读状态，例如 `aria-valuetext`；状态变化需要读屏提示时使用 `role="status"`。
- 所有交互必须键盘可达。确保文字、控件、canvas/SVG 内容在移动端和桌面端都不重叠、不横向溢出。
- 只在外部资源稳定且适合静态发布时引用它们；否则把资源放在页面包或同名静态目录里。

## 内容诚信

- 模拟演示必须在图注或相邻文字中说明它是示意，不是真实模型输出或真实数据输出。
- 避免写“演示均为程序化实算”这类容易被误解为真实模型运行的措辞；需要说明时写“公式实算的示意，非模型输出”。
- 不编造论文数字、跑分、耗时、显存、提升百分比或质量损失；要给具体数字就现场推导、计算或引用可核验来源。
- 不写无依据的“建议设为 X”。需要给操作建议时，说明判断方法和观察标准。

## 资源

- 文章列表/首页卡片封面使用 `cover.*`。
- 文章页 hero 背景使用 `background.*`。
- 用户要求生成普通静态封面时，使用 `./run.sh blog cover <slug>`。
- 文章局部的图片、JSON、音频、视频、PDF 和 demo 资源，应根据服务方式放在文章旁边或同名静态目录里。

## 验证

声称完成前，运行最小相关验证：

- 内容或构建相关改动：`./run.sh blog verify`。
- 新文章或改 slug/date/front matter 后：确认 `public/posts/<post-slug>/index.html` 存在，并确认 `public/sitemap.xml` 收录该 URL。
- 脚本或 shell 改动：补充与编辑文件匹配的窄范围语法检查或单元检查。
- 文章级 HTML/CSS/JS 改动：当视觉行为重要时，用 `./run.sh up` 预览；至少检查亮色、暗色和 360px 窄屏；如果浏览器工具可用，再用浏览器或截图检查页面。

如果无法验证，说明具体原因和剩余风险。

## 维护本 Skill

往本 skill 增加规则前，先问两件事：这条是否来自真实写作或验证中反复出现的问题？违反它能否当场判定？两个答案都是否定时，不要加入。
