---
title: "用 Playwright 和 gifski 给 HTML 动画生成博客封面"
date: 2026-09-08
lastmod: 2026-09-08
draft: false
description: "把 SVG、Canvas 或 Three.js 动画变成博客 GIF 封面的一个实用办法：用 Playwright 打开页面截图，再交给 gifski 合成动图。"
tags:
  - Playwright
  - gifski
  - Hugo
  - 可视化
categories:
  - 博客建设
series:
  - 博客建设
series_order: 2
---

{{< lead >}}
HTML 动画已经能在浏览器里跑，怎样把它变成一张适合放在博客首页的动图封面？我的做法是：让浏览器真实播放，再用脚本把画面录成 GIF。
{{< /lead >}}

这件事可以用一个简单模型理解：

```text
HTML 页面负责表演
浏览器负责真实渲染
Playwright 负责按帧截图
gifski 负责合成 GIF
博客主题负责展示封面
```

也就是说，我不尝试从 SVG、Canvas 或 Three.js 的内部状态里“导出动画”。这些技术最后都会落到浏览器画面上，所以直接录浏览器画面最稳。

## 为什么这样做

博客封面和完整交互页的职责不同。

| 形态 | 适合做什么 |
| --- | --- |
| 完整 HTML | 保留交互、按钮、相机控制、动画参数 |
| GIF 封面 | 在首页和文章列表里快速传达“这篇文章是动态的” |
| 静态背景图 | 作为文章顶部大图，不抢正文注意力 |

以“鹈鹕骑自行车”的模型测试为例，完整页面里有 2D SVG 动画和 Three.js 3D 场景；但首页卡片只需要一张短 GIF，让读者一眼知道它在动。

{{< button href="../pelican-bicycle-two-step-test/" target="_blank" rel="noopener noreferrer" >}}查看鹈鹕骑车案例{{< /button >}}

## 工具分工

这条链路涉及两个关键开源工具：

| 工具 | 负责什么 |
| --- | --- |
| Playwright | 启动浏览器，打开 HTML，定位元素，逐帧截图 |
| gifski | 把多张 PNG 截图合成高质量 GIF |

Playwright 的价值是“看到真实浏览器看到的东西”。不管动画来自 CSS、SVG、Canvas 还是 WebGL，只要页面能播放，就能截图。

gifski 的价值是编码质量。GIF 格式本身不算现代，但兼容性好，放在博客卡片里很省心。用 gifski 合成的结果通常比很多普通 GIF 工具更干净。

## 一个可复用流程

假设你写了一篇文章，文章名字叫 `my-animation`，里面有一个可独立打开的动画页面 `demo.html`。它们的关系可以先想成这样：

```text
my-animation 是文章
demo.html 是文章里的动画舞台
cover.gif 是从舞台里截出来的封面
```

在 Hugo 这类静态博客里，完整交互页通常会原样发布，所以可以放成：

```text
static/posts/my-animation/demo.html
```

文章封面则放在文章自己的资源目录里：

```text
content/posts/my-animation/cover.gif
```

截图前，最好让 HTML 主体画面包在一个稳定容器里，例如：

```html
<main class="stage">
  <!-- SVG、Canvas 或 Three.js 容器 -->
</main>
```

这样截图代码就知道“只截舞台，不截整个浏览器页面”。

路径也可以按同一个模型理解：

```text
static/posts/my-animation/demo.html
             ^^^^^^^^^^^^ 文章名
                          ^^^^^^^^^ 动画页面
```

然后把 GIF 输出到文章资源目录：

```text
content/posts/my-animation/cover.gif
```

## 核心代码

如果只看原理，截图脚本并不神秘。它本质上就是四步：

```text
打开 HTML
  -> 等待页面加载
  -> 找到 .stage
  -> 连续截取 PNG 帧
  -> 调用 gifski
  -> 输出 cover.gif
```

下面是一段最小伪代码。它不是完整生产脚本，而是用注释把核心动作拆开，读懂后就可以改成自己的实现：

```js
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";

// 1. 指定输入、输出和截图目标。
// input 是要播放的 HTML 动画页面。
// output 是最终要放到文章里的 GIF 封面。
// selector 是动画主舞台，避免把整个网页都截进去。
const input = "static/posts/my-animation/demo.html";
const output = "content/posts/my-animation/cover.gif";
const selector = ".stage";

// 2. 指定录制时长和帧率。
// 4 秒 * 15 fps = 60 张 PNG 帧。
const duration = 4;
const fps = 15;

// 3. 启动浏览器。
// Playwright 负责控制浏览器，真正的 SVG / Canvas / WebGL 渲染仍由浏览器完成。
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 880, height: 700 } });

// 4. 打开本地 HTML，并给动画一点启动时间。
await page.goto(new URL(input, `file://${process.cwd()}/`).href);
await page.waitForTimeout(300);

// 5. 找到要截图的舞台元素。
const stage = page.locator(selector).first();
const frames = [];

// 6. 按固定间隔截图。
// 每等 1000 / fps 毫秒截一次图，得到一组连续 PNG。
for (let i = 0; i < duration * fps; i += 1) {
  if (i > 0) {
    await page.waitForTimeout(1000 / fps);
  }

  const frame = `/tmp/frame-${String(i).padStart(4, "0")}.png`;
  await stage.screenshot({ path: frame });
  frames.push(frame);
}

await browser.close();

// 7. 把 PNG 帧交给 gifski。
// Playwright 到这里已经完成任务；GIF 编码交给专门的工具处理。
spawnSync("gifski", [
  "--fps",
  String(fps),
  "--width",
  "800",
  "--quality",
  "90",
  "--output",
  output,
  ...frames,
]);
```

读这段代码时，抓住两个点就够了。

第一，Playwright 不负责生成 GIF，它只负责让浏览器打开页面，并把 `.stage` 截成一张张 PNG。

第二，gifski 不关心 HTML 是怎么写的，它只接收图片帧，然后按照帧率合成 GIF。

实际项目里可以把这段逻辑封装成命令：

```bash
./run.sh blog gif \
  static/posts/my-animation/demo.html \
  --duration 4 \
  --fps 15 \
  --width 800 \
  --height 700 \
  --selector .stage
```

几个参数最常调整：

| 参数 | 什么时候改 |
| --- | --- |
| `--duration` | 动画循环比较长，需要录完整动作 |
| `--fps` | 动作不够顺滑，或文件太大 |
| `--width` | 首页封面尺寸过大或过小 |
| `--height` | 页面主体被截断 |
| `--selector` | 主舞台不是 `.stage` |

## 截图前检查

生成 GIF 前，我会先检查四件事：

```text
页面能不能独立打开
动画是否自动播放
截图容器是否稳定
主体是否在目标尺寸里看得清
```

如果页面依赖外部 CDN，比如 Three.js，也要接受一个现实：在线部署后读者打开页面时仍然需要能加载这些依赖。要么使用稳定 CDN，要么把依赖本地化。

## 封面和背景不要混用

这次实践里踩过一个小坑：GIF 适合做文章卡片封面，但不一定适合做文章顶部背景。

很多博客主题会对文章 hero 图做裁剪、放大、模糊或遮罩。静态图片在这种位置通常更稳；动图放大后容易糊，也容易分散读者注意力。

所以我的习惯是：

```text
cover.gif       给首页和列表卡片
background.png  给文章页顶部背景
HTML demo       给完整交互体验
```

这个分工看起来朴素，但长期很省事。读者看到卡片时知道文章有动画，进入文章后又不会被一个模糊的大动图打断阅读。

## 什么时候不用 GIF

GIF 不是万能格式。

如果动画很长、颜色很多、尺寸很大，GIF 文件会迅速膨胀。这个时候可以考虑：

| 替代方案 | 适合场景 |
| --- | --- |
| WebP 动图 | 需要更小体积，但仍想保留动图 |
| MP4 / WebM | 动画较长，移动端加载敏感 |
| 静态截图 | 文章重点不是动画本身 |

我现在先用 GIF，是因为它够简单、够通用，也容易被 Hugo 主题当作普通图片处理。等封面越来越多，再考虑批量转 WebP 或视频。

## 小结

这套方法的关键不是某个命令，而是分清三件事：

```text
完整体验留给 HTML
快速预览交给 GIF
稳定阅读交给静态背景图
```

Playwright 和 gifski 刚好把中间那一步补上：前者让浏览器真实播放，后者把截图变成可发布的动图。对包含 SVG、Canvas、Three.js 的技术博客来说，这是一条很实用的内容生产流水线。
