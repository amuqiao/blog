# 表达手册

用什么讲、怎么写对。**讲什么、怎么组织**在 [写作指南](writing-guide.md)。

载体分四档，判据在 `SKILL.md`。这里是每一档的具体写法。

## 上探判断

每次想上探一档，先回答一句话：**这一档能让读者看到低一档看不到的什么？**

- 答不出来 → 停在当前档。
- 答案是「更好看」「更丰富」「更有技术感」 → 停在当前档。
- 答案是「读者能看到 X 随 Y 变化」「读者能对比 A 和 B 的差别」「这段流程有分支，文字讲会绕」 → 上探。

交互组件必须服务理解，不服务炫技。设计 demo 前先写一句：**这个 demo 让读者观察什么变化？** 写不出来就不要做。

## 档 1：Markdown

文字、表格、代码块、伪代码。伪代码和注释的写法见写作指南第五节。

表格是被低估的表达手段。概念对比、参数差异、症状到原因的映射，表格往往比图更清楚，也更好维护。

站点已开启 Goldmark raw HTML 和 block attributes，Markdown 块可以用 `{.class}` 加类。

## 档 2：Blowfish shortcode

对 Blowfish 已支持的能力**优先用 shortcode，不要手写等价 raw HTML**。

按表达目标选：

| 要表达什么 | 用什么 |
| --- | --- |
| 组件关系、模块依赖、调用链 | `mermaid` flowchart、`feature-grid` + `feature`、结构表 |
| 请求生命周期、消息传递、执行顺序 | `mermaid` sequence diagram、`timeline` + `timelineItem`、`steps` + `step` |
| 状态机、算法步骤、协议流转 | `mermaid` 状态图；需要逐步播放或改参数时上探到档 3 |
| 概念对比、方案取舍、参数差异 | 表格、`tabs` + `tab`、`accordion` + `accordionItem`、`chart` |
| 数值趋势、分布、占比 | `chart` |
| 强调、提示、警告 | `alert`、`badge`、`lead` |
| 外链入口、下载、打开交互页 | `button`、`cta` |
| 图片、图集、截图 | `figure`、`gallery`、`screenshot` |

常见的还有 `stat` / `stats`、`video`、`youtubeLite`、`katex`、`typeit`、`codeimporter`、`carousel`、`swatches`、`icon`、`keyword`。**实际清单以 `themes/blowfish/layouts/shortcodes/` 为准**，用之前扫一眼目录。

注意 `lead` 和 `alert` 只是排版强调，**不算可视化**，不能用来满足硬底线里「至少一个实质性可视化」。

### Mermaid

架构图、流程图、时序图优先用 `mermaid` shortcode。**不要用 Mermaid 代码围栏**——当前站点没配渲染支持，围栏只会显示成纯文本。

用最低风险语法：

- 矩形节点 `A["标签"]`，普通箭头 `A --> B`，label 短。
- **不要**在 label 里塞 raw HTML、开头点号、`@` 符号、复杂括号或复杂标点。
- **不要**用菱形判断节点和边标签。分支含义写进目标节点的 label。

Hugo 构建**不执行** Mermaid，语法错只会在浏览器里暴露。改过 Mermaid 必须打开页面确认渲染成了 SVG，控制台没有 `Syntax error in text`。

## 档 3：文章级内联 demo

小型 HTML、`<style>`、`<script>` 直接写在 Markdown 里。

### 作用域

**所有 CSS 必须用文章专属 root class 或 ID 限定作用域**，避免污染全站样式。

一次性 demo 的样式内联在文章里；**同一套样式第二次复用时**才上提到 `assets/css/custom.css`。

### 明暗适配

本站默认外观是 dark，并且会跟随系统自动切换。**demo 必须同时适配亮色和暗色**，这不是可选项。

- 暗色分支写 `html.dark .my-demo { ... }`。
- 界面色优先用主题变量：`rgb(var(--color-neutral-200))`、`rgb(var(--color-neutral-800))`、`rgb(var(--color-primary-500))`。
- 明暗两套都要满足基本对比度。
- **颜色不能作为唯一信息载体**，要配形状、文字或图标。

### 可访问性

- 控件要有可访问名称。
- 滑块等动态控件要同步可读状态，例如 `aria-valuetext`。
- 状态变化需要读屏播报时用 `role="status"`。
- 复杂交互要给合理初始状态、重置能力和可见反馈。

### 几个踩过的坑

- **淡化不要用 `opacity`**：它会把文字一起压下去，实测能把文字压到 1.6:1。要弱化就只降背景饱和度或调背景色，文字保持原色。
- **深色底不要 `-webkit-font-smoothing: antialiased`**：中日韩字形会变细、更难读。深色下行高再调大一档。
- **图上的标签会重叠**：两条曲线在端点收敛、两个向量方向接近时，贴在端点的标签必然叠。要么错开，要么改图例。更根本的是——**如果示意数值本身太接近，图想教的东西就演示不出来**，该改的是那组数值。
- **移动端和桌面端都要能读能操作**：文字、控件、SVG/canvas 不得重叠或横向溢出。宽表放进 `overflow-x: auto` 容器。

### 最小骨架

```html
<style>
  .demo-x { border: 1px solid rgb(var(--color-neutral-300)); border-radius: 6px; padding: 1rem; }
  .demo-x__readout { font-variant-numeric: tabular-nums; }
  html.dark .demo-x { border-color: rgb(var(--color-neutral-700)); }
  @media (max-width: 720px) { .demo-x { padding: 0.75rem; } }
</style>

<div class="demo-x">
  <label for="demo-x-k">批大小</label>
  <input id="demo-x-k" type="range" min="1" max="64" value="8"
         aria-valuetext="批大小 8">
  <p class="demo-x__readout" role="status">吞吐：—</p>
</div>

<script>
  (() => {
    const el = document.getElementById('demo-x-k');
    const out = document.querySelector('.demo-x__readout');
    const render = () => {
      const k = Number(el.value);
      el.setAttribute('aria-valuetext', `批大小 ${k}`);
      out.textContent = `吞吐：${(k * 1.6).toFixed(1)} 条/秒（公式实算的示意，非实测数据）`;
    };
    el.addEventListener('input', render);
    render();
  })();
</script>
```

要点：root class 限定作用域、`html.dark` 分支、主题变量、`aria-valuetext` 同步、`role="status"` 播报、初始渲染一次、示意数据当场标注。

## 档 4：独立单文件 HTML

正文真源转移到 HTML，Markdown 退化成入口。上探到这一档要有明确理由：多站长卷、需要贯穿全文的统一交互语言、需要独立打开或离线分享、代码量大到会淹没正文。

### 文件位置

- 交互页放 `static/posts/<post-slug>/<page>.html`。
- `content/posts/<post-slug>/` 与 `static/posts/<post-slug>/` 的 slug **必须一致**。
- 文章里用**同级相对路径**引用，例如 `interactive.html`；构建后对应 `/posts/<post-slug>/interactive.html`。

### 单文件契约

`static/` 下的文件**不经过 Hugo 处理**，也拿不到主题的 CSS 和 JS。所以：

- **单文件内联**：CSS、JS、数据、SVG 全部内联，不引外部资源，不用 CDN。
- **离线可打开**：用 `file://` 直接打开必须完整可用。
- **自建导航**：站内 TOC 对 iframe 里的内容无效，长卷必须自己做目录锚点和当前位置高亮。
- **自建首屏**：首屏视觉要贴合知识点本身，一眼能抓住主题和主问题。
- **自己适配明暗**：iframe 是独立文档，**继承不到父页面的 `html.dark`**。必须在自身 CSS 里用 `prefers-color-scheme` 适配，并接受它不跟随站点外观开关这一代价。
- 上面档 3 的可访问性要求、踩坑清单在这里同样成立，而且因为篇幅更长，更容易犯。

### 摘要页写法

`index.md` 只保留 front matter、导语、入口按钮和 `iframe`。**不要重复维护交互页里的正文、目录或模块清单**，那会变成两份笔记。

front matter 注意 `showTableOfContents: false`——正文在 iframe 里，站内 TOC 会是空的。

导语要把主问题和第一因说清楚，它是读者决定要不要点开的唯一依据。

```markdown
{{< button href="interactive.html" target="_blank" rel="noopener noreferrer" >}}打开完整交互长卷{{< /button >}}

<style>
  .xx-embed { width: 100%; height: 880px; border: 1px solid #D8D4E4; border-radius: 4px; }
  @media (max-width: 720px) { .xx-embed { display: none; } }
</style>

<iframe class="xx-embed" src="interactive.html" title="……交互长卷"
        sandbox="allow-scripts" loading="lazy"></iframe>
```

高度自己定死，**不做自动高度计算**。窄屏下藏掉 iframe、只留按钮，比塞一个挤扁的嵌入框好。固定画幅的演示用 `aspect-ratio` 代替固定 `height`。
