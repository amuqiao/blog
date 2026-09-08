# HTML 动画生成博客 GIF 封面 Runbook

本文是本仓库的维护手册：把一个可交互 HTML demo 放进 Hugo + Blowfish 博客，并从动画里截取片段生成文章卡片 GIF 封面。

先用一句话建立心智模型：

```text
HTML 动画是舞台
浏览器是摄像机
Playwright 负责按时间截图
gifski 负责把截图合成 GIF
Hugo + Blowfish 负责把文章、封面和交互页发布出去
```

维护时不要把这条链路理解成“上传附件”。这里维护的是一组可构建文件：Markdown 负责文章入口，HTML 负责完整演示，图片和 GIF 负责列表页与文章页展示，Hugo 负责把它们编译成 GitHub Pages 可发布的静态站点。

## 最终效果

这次案例来自一组“鹈鹕骑自行车”的模型测试。每个模型生成两个 HTML：

```text
2D SVG 动画
3D Three.js 场景
```

博客里保留完整交互页，同时给文章卡片生成一张短 GIF 封面。读者可以先在首页看到动图，再进入文章打开完整 demo。

最终形成的关系是：

```text
文章入口
  content/posts/pelican-bicycle-two-step-test/index.md

文章资源
  content/posts/pelican-bicycle-two-step-test/cover.gif
  content/posts/pelican-bicycle-two-step-test/background.png

独立演示页
  static/posts/pelican-bicycle-two-step-test/opus-5-high-2d.html
  static/posts/pelican-bicycle-two-step-test/opus-5-high-3d.html
  static/posts/pelican-bicycle-two-step-test/deepseek-v4-flash-high-2d.html
  static/posts/pelican-bicycle-two-step-test/deepseek-v4-flash-high-3d.html
  static/posts/pelican-bicycle-two-step-test/fable-5-1-medium-2d.html
  static/posts/pelican-bicycle-two-step-test/fable-5-1-medium-3d.html
```

成品文章是 `content/posts/pelican-bicycle-two-step-test/index.md`，本地预览地址是 `/blog/posts/pelican-bicycle-two-step-test/`。

## 为什么拆成两个目录

Hugo 里有两类资源容易混在一起：文章资源和原样静态文件。

```text
content/posts/<slug>/
  给 Hugo 管。
  适合放 index.md、文章封面、文章背景图、正文引用图片。

static/posts/<slug>/
  原样发布。
  适合放完整 HTML demo、实验页面、可直接打开的小作品。
```

这里的 `<slug>` 是文章在 URL 里的稳定名字。比如：

```text
content/posts/pelican-bicycle-two-step-test/index.md
static/posts/pelican-bicycle-two-step-test/opus-5-high-2d.html
```

构建后会对应到：

```text
/posts/pelican-bicycle-two-step-test/
/posts/pelican-bicycle-two-step-test/opus-5-high-2d.html
```

这就是一一对应关系。文章和 demo 不放在同一个目录，不是为了增加维护成本，而是因为它们的发布方式不同：`content/` 会被 Hugo 当作内容处理，`static/` 会被原样复制。

## 命名约定

为了避免每篇文章都写一堆额外配置，我把文章图片约定成两个名字：

```text
cover.*       首页和列表卡片封面
background.* 文章页顶部背景图
```

比如这篇测试文章现在是：

```text
content/posts/pelican-bicycle-two-step-test/
├── index.md
├── cover.gif
└── background.png
```

这个约定解决了一个实际问题：GIF 很适合做卡片封面，因为它能让读者一眼看到动画；但 GIF 不适合做文章顶部背景，尤其是 Blowfish 的背景样式会裁剪、放大、模糊处理，动图放上去反而容易显得脏。

所以最终的取舍是：

| 用途 | 文件 | 原因 |
| --- | --- | --- |
| 首页/列表卡片 | `cover.gif` | 小尺寸预览，适合展示动画 |
| 文章顶部背景 | `background.png` | 静态清晰，不干扰阅读 |
| 完整交互 | `static/posts/<slug>/*.html` | 保留原始页面、脚本和交互 |

不建议把同一张动图同时配置成封面和背景。之前如果在 front matter 里显式写 `featureimage` 指向 GIF，就可能让文章 hero 背景也使用这张 GIF，结果就是顶部大图模糊、裁剪还分散注意力。

## 准备依赖

这条流水线涉及几个开源项目，每个工具只负责一件事。

| 工具 | 作用 | 为什么需要 |
| --- | --- | --- |
| Hugo | 静态站点生成器 | 把 Markdown、配置和资源构建成 HTML 站点 |
| Blowfish | Hugo 主题 | 提供首页、文章页、封面、背景、搜索、标签等博客体验 |
| Node.js | 脚本运行环境 | 运行本仓库的截图脚本 |
| Playwright | 浏览器自动化 | 打开 HTML 动画并按帧截图 |
| Chrome / Chromium | 页面渲染引擎 | 真正执行 SVG、CSS、Canvas 或 Three.js 动画 |
| gifski | GIF 编码器 | 把多张 PNG 帧合成为高质量 GIF |

本仓库的 Node 依赖在 `package.json` 里：

```json
{
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "devDependencies": {
    "playwright": "^1.55.0"
  }
}
```

下面命令以 macOS 为例。其他系统只需要替换 Hugo、gifski 和浏览器的安装方式。

如果是从零搭建 Hugo + Blowfish，先准备站点本身：

```bash
brew install hugo
hugo version
git submodule update --init --recursive --depth 1
```

如果是克隆这个仓库，主题已经通过 Git submodule 记录在仓库里，重点是把 submodule 拉下来。`hugo version` 需要看到 extended 版本，否则 Blowfish 的部分资源处理能力可能不可用。

然后准备 GIF 生成工具链：

```bash
npm ci
brew install gifski
```

`npm ci` 会严格按照 `package-lock.json` 安装 Node 依赖，更适合复现。如果是自己新建仓库、还没有 lockfile，再使用 `npm install`。

默认截图使用本机 Google Chrome。如果没有 Chrome，也可以安装 Playwright 自带的 Chromium：

```bash
npx playwright install chromium
```

然后截图时加：

```bash
--browser chromium
```

## 放入 HTML demo

假设要新增一篇文章，先确定 slug：

```text
pelican-bicycle-two-step-test
```

文章目录放在：

```text
content/posts/pelican-bicycle-two-step-test/
```

完整 HTML demo 放在：

```text
static/posts/pelican-bicycle-two-step-test/
```

例如：

```text
static/posts/pelican-bicycle-two-step-test/opus-5-high-2d.html
static/posts/pelican-bicycle-two-step-test/opus-5-high-3d.html
```

从命令看，最小操作链是：

```bash
slug=pelican-bicycle-two-step-test

./run.sh blog new-post "$slug"
mkdir -p "static/posts/$slug"

cp /path/to/opus-5-high-2d.html "static/posts/$slug/opus-5-high-2d.html"
cp /path/to/opus-5-high-3d.html "static/posts/$slug/opus-5-high-3d.html"
```

如果文章页面包已经存在，就不需要重复执行 `new-post`，只维护同名 `content/posts/<slug>/` 和 `static/posts/<slug>/` 即可。

放进去之前，先用浏览器直接打开 HTML 看一遍。一个适合被截图脚本处理的 demo，至少要满足这些条件：

```text
能独立打开
  不依赖本机临时文件路径。

动画能自动播放
  页面 load 之后，主体画面已经开始运动。

有稳定截图容器
  默认建议给主舞台加 .stage；没有这个类时，截图命令要显式传 --selector。

画面比例可控
  主体不要依赖超宽屏或超高屏才能看清。

外部依赖可接受
  例如 Three.js CDN 可以用于演示页，但发布前要确认网络失败时问题容易定位。
```

文章里引用这些 HTML 时，直接使用同级相对路径：

```md
{{</* button href="opus-5-high-2d.html" target="_blank" rel="noopener noreferrer" */>}}打开 2D{{</* /button */>}}

<iframe
  src="opus-5-high-2d.html"
  title="鹈鹕骑自行车 2D SVG 动画"
  loading="lazy"
  style="width:100%; aspect-ratio:16 / 10; border:0; border-radius:12px; overflow:hidden;">
</iframe>
```

这里不需要写 `/blog/posts/...` 这种绝对路径。相对路径更容易迁移，也能减少本地预览和 GitHub Pages 路径不一致的问题。

## 生成 GIF 封面

核心命令是：

```bash
./run.sh blog gif static/posts/pelican-bicycle-two-step-test/opus-5-high-2d.html
```

如果输入文件位于：

```text
static/posts/<slug>/<name>.html
```

脚本会默认输出：

```text
content/posts/<slug>/cover.gif
```

也可以显式指定输出路径：

```bash
./run.sh blog gif \
  static/posts/pelican-bicycle-two-step-test/opus-5-high-2d.html \
  content/posts/pelican-bicycle-two-step-test/cover.gif
```

常用参数：

```bash
./run.sh blog gif \
  static/posts/pelican-bicycle-two-step-test/opus-5-high-2d.html \
  --duration 4 \
  --fps 15 \
  --width 800 \
  --height 700 \
  --selector .stage \
  --browser chrome \
  --clock realtime
```

这些参数分别控制：

| 参数 | 含义 | 常见调整 |
| --- | --- | --- |
| `--duration` | 截取几秒动画 | 动作周期长就调大 |
| `--fps` | 每秒截几帧 | 越高越顺滑，文件也越大 |
| `--width` | GIF 最大宽度 | 首页卡片一般不必太大 |
| `--height` | 浏览器视口高度 | 页面内容被截断时调大 |
| `--selector` | 截哪个元素 | 默认 `.stage`，没有这个类就换成实际容器 |
| `--browser` | 用 Chrome 还是 Chromium | 本机没 Chrome 时用 `chromium` |
| `--clock` | 实时时钟或虚拟时钟 | 普通动画用 `realtime` 更稳 |

## 截图脚本做了什么

命令背后调用的是：

```text
scripts/capture-html-gif.mjs
```

它的流程可以拆成六步：

```text
1. 解析命令行参数
2. 打开输入 HTML
3. 等页面和字体加载完成
4. 找到截图元素，比如 .stage
5. 按 duration * fps 截出多张 PNG
6. 调用 gifski 合成 cover.gif
```

换成更直观的流水线就是：

```text
HTML 动画
  -> Playwright 启动浏览器
  -> Chrome 渲染真实页面
  -> 截取 .stage 元素
  -> 生成 frame-0001.png、frame-0002.png、...
  -> gifski 合成 GIF
  -> content/posts/<slug>/cover.gif
```

这个脚本放在 `scripts/`，不是放在某篇文章目录里，是因为它是通用工具。以后任何 HTML 动画、Canvas demo、SVG demo，只要能在浏览器里播放，都可以用同一条命令生成封面。

脚本还有两个细节值得保留。

第一，输出文件先写到临时文件，成功后再替换目标 GIF。这样如果截图或编码中途失败，不会把原来的 `cover.gif` 破坏掉。

第二，默认用 `realtime`。有些动画靠 `requestAnimationFrame`、CSS animation、第三方渲染循环共同驱动，真实浏览器时间比强行虚拟时间更接近读者实际看到的效果。

## 写文章入口

文章 `index.md` 不需要重复维护 HTML 里的所有实现细节。它更像一个入口页：解释测试目标、给出演示按钮、嵌入 iframe、列出观察标准。

一个简化结构可以是：

```md
---
title: "用两步测试比较模型能否生成鹈鹕骑车"
date: 2026-09-07
draft: false
tags:
  - AI
  - SVG
  - Three.js
categories:
  - 模型测试
---

这篇文章用同一组提示做两步测试：先生成 2D SVG 动画，再生成 3D Three.js 场景。

{{</* button href="opus-5-high-2d.html" target="_blank" rel="noopener noreferrer" */>}}打开 2D{{</* /button */>}}

<iframe src="opus-5-high-2d.html" title="2D SVG 动画"></iframe>
```

如果 HTML 本身已经是一篇完整交互长文，Markdown 就应该保持克制：保留 front matter、少量导语、入口按钮和 iframe 即可。否则同一份内容会在 Markdown 和 HTML 里维护两遍，时间一长一定会不一致。

## 本地预览

启动 Hugo：

```bash
./run.sh up
```

默认访问：

```text
http://localhost:1313/blog/
```

这个服务是前台进程，支持热重载。也就是说，修改 Markdown、配置、静态资源后，Hugo 会自动重建页面，浏览器通常会自动刷新。

如果预览服务就在当前终端运行，优先按 `Ctrl+C` 停止。找不到旧终端，或想在另一个终端停止当前项目的预览服务，再执行：

```bash
./run.sh down
```

如果端口被占用，可以临时换端口：

```bash
HUGO_PORT=1314 ./run.sh up
```

## 发布前验证

发布前先跑最小验证：

```bash
./run.sh blog verify
./run.sh doctor content-map
```

第一条命令检查 Hugo 是否能成功构建。第二条命令检查文章和静态 demo 的 slug 映射是否一致，并拒绝发布内容引用临时素材缓存目录。

发布内容不要引用仓库里的临时素材缓存目录。这个目录名写作 `.` + `data`，只用于暂存输入草稿、截图和中间产物，不属于 Hugo 构建输入。

还可以手动查旧文件名是否残留：

```bash
rg "opus-5-high-2d\\.gif|image\\.png" content static config README.md AGENTS.md
```

如果已经改成统一命名，旧名字不应该再出现在发布内容里。

## 发布到 GitHub Pages

如果是在这个仓库里，GitHub Actions 已经配置好，日常流程就是提交本次相关文件再推送：

```bash
slug=pelican-bicycle-two-step-test

git add "content/posts/$slug"
git add "static/posts/$slug"
git commit -m "docs: 新增 HTML 动画转博客封面复盘"
git push origin main
```

如果这次还新增或修改了截图工具链，再把对应工具文件一起加入提交：

```bash
git add run.sh scripts/blog.sh scripts/capture-html-gif.mjs package.json package-lock.json
```

推送后 GitHub Actions 会构建 Hugo 站点，并发布到：

```text
https://amuqiao.github.io/blog/
```

如果线上页面没有立刻变化，先看 GitHub Actions 是否完成，再强制刷新浏览器。GitHub Pages 和浏览器缓存都会让旧页面短暂存在。

## 常见问题

**为什么不能直接引用临时素材缓存目录？**

临时素材缓存目录只适合放输入草稿、截图和中间产物，不属于 Hugo 发布目录。文章引用它，本地也许能看到，构建或部署后就可能丢失。

**为什么 HTML 不放进 `content/posts/<slug>/`？**

因为完整 HTML demo 通常希望原样发布。放进 `static/posts/<slug>/` 后，Hugo 不会把它当 Markdown 内容处理，路径也更可预测。

**为什么封面叫 `cover.gif`，背景叫 `background.png`？**

这是为了让用途从文件名就能看出来，也减少 front matter 里的手工配置。封面服务列表页，背景服务文章页顶部，两者的显示方式不同。

**为什么生成 GIF 要用浏览器，而不是直接从代码里导出？**

因为 SVG、CSS 动画、Canvas、Three.js 最终都是浏览器渲染出来的。用 Playwright 截真实浏览器画面，最接近读者实际看到的结果。

**为什么不用视频当封面？**

GIF 的兼容性和管理成本更低，适合作为文章卡片预览。以后如果封面尺寸和加载性能成为问题，可以再扩展到 WebP 或 MP4。

## 未来可以扩展什么

这条流水线已经能覆盖“HTML demo -> GIF 封面 -> Hugo 文章发布”，后续可以按需增强，但都不是当前复现流程的必做项：

| 方向 | 价值 |
| --- | --- |
| WebP / MP4 输出 | 减小文件体积，提升移动端加载速度 |
| 每篇文章独立截图配置 | 为不同 demo 固定 selector、尺寸、时长 |
| 批量生成封面 | 一次更新多篇交互文章的封面 |
| iframe shortcode | 统一交互 demo 的边框、比例和移动端行为 |
| 多模型对比模板 | 固定 2D / 3D / 观察维度，方便继续扩展模型测试 |

这些都不是第一天必须做的。现在最重要的是先把规则固定下来：文章有稳定 slug，demo 放同名 `static/posts/<slug>/`，封面用 `cover.*`，背景用 `background.*`，截图工具统一从 `./run.sh blog gif` 进入。
