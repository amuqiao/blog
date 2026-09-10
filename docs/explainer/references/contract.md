# 子 agent 契约模板

下面这段**逐字**贴进每个写作 agent 的 prompt，把尖括号占位换成实际值。
任何一条不遵守，装配就会冲突或 lint 不过。

---

## 背景

你在为一篇《一文读懂 <主题>》的**单文件离线交互长卷**写其中 <N> 个 `<section>`。整页骨架、设计令牌、共享 CSS 组件与共享 JS 工具已写好。

工作目录：`<WORK>`（= `.data/explainer/<slug>/`）
**动手前必须先完整读 `<WORK>/skeleton.html`**，理解设计令牌、可复用 class 和 `window.<NS>` API。

## 硬约束

- **禁止读取 `content/` 与 `static/` 下的任何其它文章或 HTML。** 仓库 `AGENTS.md` 要求默认不展开这两个目录。你唯一要读的文件是 `<WORK>/skeleton.html`。
- 产出三个文件到 `<WORK>/parts/`：`<stem>.html`、`<stem>.css`、`<stem>.js`
  - `.html` 只含你负责的 `<section id="…">…</section>`，按给定顺序，无 `<html>/<head>/<body>`
  - `.js` 整体一个 `(function(){ "use strict"; … })();`
- 禁止：改 `skeleton.html`；改别人的 parts；写入仓库；引用任何外部资源（CDN / 字体 / 图片 URL / fetch / XHR / 动态 import）。**图像一律程序化生成，禁止外部图片与 base64 图片。**
- **禁止 `localStorage` / `sessionStorage` / `document.cookie`**——本页以 `sandbox="allow-scripts"` 嵌入文章页，访问会抛 SecurityError。
- **禁止 `Math.random()` 与 `new Date()` 参与渲染**——页面每次加载必须逐像素一致，随机一律用 `<NS>.rng(seed)`。

## 命名隔离（另有 <M> 个作者并行）

- 新增 CSS class 与 element id 一律以 `<PREFIX>` 开头
- 允许 `.<PREFIX>foo .bar` 这类被前缀祖先限定的后代/修饰选择器；**不允许**完全无前缀限定的裸选择器
- SVG `<defs>` 里的 `pattern` / `marker` / `clipPath` / `mask` id 必须写成 `<PREFIX>def-xxx`，两节不得共用
- JS 不得有全局变量/函数，不得给 `window.*` 赋值，不得覆盖 `<NS>` 已有键
- DOM 查询限定在自己 section 内：`var root = document.getElementById('<第一个 section id>'); <NS>.$('.<PREFIX>x', root)`
- 初始化用 `<NS>.ready(fn)`；canvas 与大循环用 `<NS>.onVisible(el, fn)`；自动播放先判 `<NS>.reduced()`
- `onVisible` 要挂在**有实际高度**的祖先上，挂在初始高度为 0 的空容器上永不触发

## 可复用组件

<把骨架里的共享 class 清单原样列在这里，标注每个的用途>

## 共享 JS API

<把 window.<NS> 的完整签名列在这里>

## 章节骨架格式

```html
<section id="<id>">
  <span class="<NS>-tag">[ <NN> · <小标签> ]</span>
  <h2>…</h2>
  <p class="<NS>-lead">…</p>
  …
  <div class="<NS>-out"><span class="<NS>-lb">本节收束</span>…</div>
</section>
```

导语要**接住上一节留下的缺口**；收束要**把读者交给下一节**，且是一句能记住的话。

## 全文位置

<一段话说清：第一因是什么、前面各节已经讲了什么、你这几节负责什么、后面是什么>

## 话题边界（防撞车，逐条执行）

| 话题 | 归谁 | 其它节只能怎么提 |
| --- | --- | --- |
| <易撞话题> | <第 N 节> | 一句话 + 「见第 N 节」，不展开 |

## 写作要求

- 中文自然表达；术语、参数名、代码、公式符号保留英文
- 讲因果不讲清单：先现象/问题 → 再机制 → 再「所以结构必须长这样」
- 每个论断要么可推导、要么能在页面上验证
- **绝对不要编造论文数字、跑分、耗时、显存占用、加速倍数、质量损失百分比。** 要具体数字就当场算给读者看
- **不要在正文里给推荐值**（「建议设为 X」）。要给就给怎么判断
- 数值标注「示意值」；能用共享计算函数算出来的**绝不手写死数字**
- **每一处模拟演示都必须在图注里说明它不是真实模型输出**
- 每节 <X>~<Y> 中文字符，配 1~2 个可视化/交互
- 不写「接下来我们将介绍」这类空话；不用 emoji
- 无障碍：有信息的 canvas/SVG 加 `role="img"` + `aria-label`，装饰性加 `aria-hidden="true"`；canvas 旁必须有文字读数；控件用真实 `<button>`；颜色不做唯一信息载体

## 你负责的章节

<逐节给出：id、tag、标题、要讲清的因果、核心交互的具体要求>

---

完成后用中文简述：各节写了什么、用了哪些共享 API、新增了哪些带前缀的 class 和 id、**你自己怎么验证的**、以及需要我复核的技术点。不要粘贴大段代码。
