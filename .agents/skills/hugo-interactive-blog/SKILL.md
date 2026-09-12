---
name: hugo-interactive-blog
description: 把想法、素材或草稿转成适合长期维护的 Hugo Blowfish 知识型博客文章，默认用 Markdown + shortcode 组织正文，按需加入文章级 HTML/CSS/vanilla JS 局部交互。
---

# Hugo Interactive Blog

在本仓库创建、扩写、重写或整理博客文章时使用本 skill，尤其是用户只给出想法、主题、笔记或素材，希望产出可发布的 Hugo 知识型文章时。

目标是写出面向实践者的 Hugo 知识型教程：让读者快速建立心智模型，知道怎么使用、怎么判断、怎么排错，并能迁移到自己的项目。

创建或大幅重写教程、解释、配置、排障类文章时，必须先读 [写作指南](references/writing-guide.md)。

## 稳定产物

- Markdown 是正文真源，负责主线、解释、边界和结论。
- Blowfish shortcode 负责主题一致的图文表达，例如 Mermaid、图表、步骤、时间线、折叠、标签页、图片集。
- 文章级 HTML/CSS/vanilla JS 只负责局部交互，让读者通过切换、拖动、播放、重置或观察状态变化来理解机制。
- 新文章以 Hugo 页面包、Markdown 正文、shortcode 和局部交互为基本形态。
- 默认读者是想学会使用、理解关键点并能迁移的实践者；源码只作为必要原理和排障依据。

## 教程底线

创建或大幅重写教程、原理、配置、排障类文章时，不能只交付自然段加代码块。默认至少满足：

- 有一个明确心智模型，并且至少在图、表、交互 demo 或结尾检查表中落地一次。
- 至少使用一个实质性 shortcode 可视化组件；仅用 `lead` 或 `alert` 不算图文表达。
- 涉及流程、状态、队列、生命周期、调度、参数变化或故障分支时，默认设计一个可观察的局部交互 demo；确实不用交互时，必须用更合适的图解替代。
- 关键代码块前先给伪代码、状态表、时序图、组件地图或文件职责图。
- 真实代码只展示可迁移的最小实现，并用少量关键注释解释生命周期、进程边界、序列化、错误处理、依赖注入或资源归属。
- 不用大量库源码证明理解。源码摘录只放在“深入原理”或折叠块中，并且必须回答一个具体问题。

## 仓库契约

仓库结构、资源映射和启动入口以根目录 `AGENTS.md` 为准。常用硬规则：

- 普通文章放在 `content/posts/<post-slug>/index.md`。
- 文章专属图片、PDF、JSON、音频、视频等页面资源优先放在 `content/posts/<post-slug>/...`。
- `date` 必须带 `+08:00` 时区偏移，并且是当前时间之前的过去时间；正式发布文章必须 `draft: false`。
- 未来日期和 `draft: true` 都会让 Hugo 静默跳过文章，构建仍可能成功。
- 正文在 Markdown 中，默认保留站内目录；只有文章确有特殊理由时才设置 `showTableOfContents: false`。
- 文章列表/首页卡片封面使用 `cover.*`，文章页 hero 背景使用 `background.*`。
- 用户要求生成普通静态封面时，使用 `./run.sh blog cover <slug>`。

## Hugo 与 Blowfish

- 对 Blowfish 已支持的能力，优先使用 shortcode，不手写等价 raw HTML。常见 shortcode 包括 `alert`、`badge`、`button`、`cta`、`lead`、`figure`、`gallery`、`mermaid`、`chart`、`tabs` + `tab`、`accordion` + `accordionItem`、`steps` + `step`、`timeline` + `timelineItem`、`feature-grid` + `feature`、`stat`、`stats`、`video`、`youtubeLite`、`katex`、`typeit`、`codeimporter`。实际清单以 `themes/blowfish/layouts/shortcodes/` 为准。
- 架构图、流程图、时序图优先用 Blowfish 的 `mermaid` shortcode；不要使用当前站点尚未配置渲染支持的 Mermaid 代码围栏。
- Mermaid flowchart 默认用最低风险语法：矩形节点 `A["label"]`、普通箭头 `A --> B`、短 label。避免 raw HTML、`@name`、开头点号、复杂括号、复杂标点、菱形判断节点和边标签；分支含义写进目标节点 label。
- Hugo 构建不会执行 Mermaid。改过 Mermaid 后，要用本地预览或浏览器错误信息确认没有运行时语法错误。
- 站点已开启 Goldmark raw HTML 和 block attributes；小型文章级 HTML、`<style>`、`<script>` 可以直接写在 Markdown 中，Markdown 块也可以用 `{.class}` 加类。

## 局部交互

- 默认把局部 demo 内联在 Markdown 中。只有需要独立打开、代码过长或确实需要隔离时，才放在 `static/posts/<post-slug>/...` 并用相对链接或 `iframe` 引用。
- `content/posts/<post-slug>/` 与 `static/posts/<post-slug>/` 的 slug 必须一致。
- `iframe` 是独立文档，不能继承父页面的 `html.dark`；iframe demo 必须在自身 CSS 中用 `prefers-color-scheme` 适配明暗，并接受它不跟随站点外观开关这一代价。
- 所有 CSS 必须通过文章专属 root class 或 ID 限定作用域；一次性 demo 样式优先内联，第二次复用同一套样式时再上提到 `assets/css/custom.css`。
- 本站默认外观是 dark，并会随系统自动切换。文章级 demo 必须同时适配亮色和暗色。
- 暗色分支使用 `html.dark .my-demo { ... }`；界面色优先使用主题变量，例如 `rgb(var(--color-neutral-200))`、`rgb(var(--color-neutral-800))`、`rgb(var(--color-primary-500))`。
- 明暗两套都要满足基本对比度；颜色不能作为唯一信息载体。深色底不要设置 `-webkit-font-smoothing: antialiased`，淡化状态不要用 `opacity` 压整块文字。
- 控件要有可访问名称；滑块等动态控件要同步可读状态，例如 `aria-valuetext`；状态变化需要读屏提示时使用 `role="status"`。
- 移动端和桌面端都要能阅读和操作，文字、控件、SVG/canvas 内容不得重叠或横向溢出。

## 内容诚信

- 模拟演示必须在图注或相邻文字中说明它是示意，不是真实模型输出或真实数据输出。
- 避免写“演示均为程序化实算”这类容易被误解为真实模型运行的措辞；需要说明时写“公式实算的示意，非模型输出”。
- 不编造论文数字、跑分、耗时、显存、提升百分比或质量损失；要给具体数字就现场推导、计算或引用可核验来源。
- 不写无依据的“建议设为 X”。需要给操作建议时，说明判断方法和观察标准。

## 验证

声称完成前，运行最小相关验证：

- 内容或构建相关改动：`./run.sh blog verify`。
- 新文章或改 slug/date/front matter 后：确认 `public/posts/<post-slug>/index.html` 存在，并确认 `public/sitemap.xml` 收录该 URL。
- 脚本或 shell 改动：补充与编辑文件匹配的窄范围语法检查或单元检查。
- 文章级 HTML/CSS/JS 改动：当视觉行为重要时，用 `./run.sh up` 预览；至少检查亮色、暗色和 360px 窄屏；如果浏览器工具可用，再用浏览器或截图检查页面。
- Mermaid 改动：除 Hugo 构建外，还要用浏览器控制台或 headless browser 确认 Mermaid 已渲染成 SVG 且没有 `Syntax error in text`。

如果无法验证，说明具体原因和剩余风险。

## 维护本 Skill

往本 skill 加规则前，先问两件事：这条是否来自真实写作或验证中反复出现的问题？违反它能否当场判定？两个答案都是否定时，不要加入。能放进 `references/writing-guide.md` 的写作方法，不要塞回入口文件。
