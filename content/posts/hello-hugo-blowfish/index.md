---
title: "使用 Hugo 和 Blowfish 搭建博客"
date: 2026-09-07
lastmod: 2026-09-08
draft: false
description: "从博客建站选型开始，解释静态与动态方案的区别，并完整记录 Hugo + Blowfish 从 0 搭建、写作、预览、发布和长期维护的流程。"
tags:
  - Hugo
  - Blowfish
  - GitHub Pages
  - GitHub Actions
categories:
  - 博客建设
series:
  - 博客建设
series_order: 1
---

{{< lead >}}
这不是一篇只讲命令的搭建笔记，而是一次从选型到发布的完整梳理：为什么选静态博客，为什么选 Hugo，为什么用 Blowfish，以及如何把它维护成一个长期个人博客。
{{< /lead >}}

如果只想“做出一个页面”，可选项很多；如果想长期写作、迁移、备份、发布都省心，选型标准就会变得很清楚。

```text
长期博客不是一个页面，而是一条写作流水线：

内容怎么写
  -> Markdown、本地文件、图片、交互 demo

站点怎么生成
  -> 静态生成器、主题、配置、构建产物

发布怎么完成
  -> Git、GitHub Actions、GitHub Pages、域名路径

以后怎么维护
  -> 分类、标签、系列、项目、主题升级、内容迁移
```

这篇文章按这个顺序走一遍。

## 先看选型

博客建站大体可以分成两条线：静态线和动态线。

```text
静态线：
Markdown 文件 -> 构建命令 -> HTML/CSS/JS -> 托管到 GitHub Pages/CDN

动态线：
浏览器后台 -> 数据库 -> 服务端程序 -> 运行时渲染或发布
```

它们没有绝对好坏，只是适合不同人。

| 维度 | 静态博客 | 动态博客 |
| --- | --- | --- |
| 典型工具 | Hugo、Astro、Jekyll、Hexo、Zola | Ghost、Halo、WordPress、Typecho |
| 写作方式 | 本地 Markdown + Git | 网页后台写作 |
| 数据形态 | 文件就是内容 | 内容主要在数据库 |
| 部署成本 | 低，生成静态文件即可 | 高，需要长期运行服务 |
| 备份迁移 | 直接备份仓库 | 要处理数据库和附件 |
| 适合谁 | 程序员、长期笔记、技术博客 | 多作者、后台编辑、运营型站点 |

我的需求是个人长期博客，核心动作是写 Markdown、放代码、嵌交互 demo、用 Git 管理历史。所以静态线更合适。

## 榜单只是参考

下面这组数据是 **2026-09-07 的观察值**，只用来判断生态量级，不作为实时榜单维护。Star 数会变化，选型不应该每天跟着榜单摇摆。

| 排名 | 项目 | Star | 类型 | 备注 |
| --- | --- | ---: | --- | --- |
| 1 | Hugo | 89.7k | 静态框架 | 构建速度快，单二进制 |
| 2 | Astro | 62.4k | 静态框架 | 通用内容框架，不止博客 |
| 3 | Ghost | 55.2k | 动态系统 | Node 后台出版平台 |
| 4 | Jekyll | 51.7k | 静态框架 | GitHub Pages 原生生态 |
| 5 | Hexo | 41.8k | 静态框架 | Node 系，中文生态广 |
| 6 | Halo | 39.7k | 动态系统 | 国产建站工具 |
| 7 | VuePress | 22.7k | 静态框架 | Vue 系，偏文档 |
| 8 | WordPress | 21.4k | 动态系统 | 全球最大 CMS，表中为镜像仓库量级 |
| 9 | Zola | 17.4k | 静态框架 | Rust 单二进制 |
| 10 | Typecho | 12.4k | 动态系统 | PHP 轻量博客 |
| 11 | Gridea | 10.2k | 写作客户端 | 中文 GUI 写 Markdown 发布 |

Next.js、Nuxt、Gatsby 这类通用前端框架当然也能做博客，但要自己拼内容层、主题、构建和发布约定。对个人博客来说，它们不是我这次优先比较的“建站工具”。

所以这张表给我的结论很简单：Hugo/Astro 是静态线头部，Ghost/Halo/WordPress/Typecho 是动态线。我的写作方式更靠近“本地 Markdown + Git”，因此继续选择 Hugo。

## 为什么是 Hugo

Hugo 对个人长期博客最有吸引力的点不是“Star 多”，而是维护面小。

```text
一个 Hugo 博客的核心依赖很少：

hugo 可执行文件
  + config/_default/
  + content/
  + themes/
  + static/
```

这意味着它有几个现实优势。

| 需求 | Hugo 的对应能力 |
| --- | --- |
| 本地写 Markdown | `content/` 目录天然就是内容库 |
| 快速预览 | `hugo server` 支持监听和热重载 |
| 长期备份 | Git 仓库就是主要资产 |
| 部署简单 | 生成 `public/` 静态文件 |
| 迁移容易 | Markdown、图片、HTML demo 都是普通文件 |
| 维护成本低 | 不需要数据库和后台服务常驻 |

如果我要做团队内容平台，Ghost 或 Halo 的后台会更舒服；如果我要做复杂前端应用，Astro 或 Next.js 的组件体系更强。但这次是个人长期博客，Hugo 的简单性正好是优势。

## 为什么是 Blowfish

Hugo 只是生成器，主题决定了博客的默认体验。常见选择大概是这样：

这组 Hugo 主题数据同样是 **2026-09-07 的观察值**，只用来建立候选池：

| 主题 | Star | 风格 | 适合场景 |
| --- | ---: | --- | --- |
| PaperMod | 13.9k | 极简高速 | 经典程序员博客 |
| Stack | 6.5k | 卡片流、标签云 | 中文博客、内容归档 |
| Book | 4.1k | 书本/文档式 | 笔记、文档、手册 |
| LoveIt | 3.9k | 功能完整、视觉优雅 | 中文技术博客 |
| Coder | 3.1k | 单栏极简 | 个人介绍、工程师主页 |
| Blowfish | 2.9k | 图文丰富、布局多 | 个人长期博客、项目展示、交互内容 |
| Terminal | 2.8k | 终端风 | 极客风格博客 |

如果只追求极简和稳定，PaperMod 是很强的选择；如果喜欢卡片流和中文生态，Stack 也合适。我最后选 Blowfish，是因为它不只适合写文章，也适合做“长期个人站点”：

```text
首页：profile / page / hero / card / background / landing / custom
文章：Hero 图、目录、阅读进度、上一篇下一篇、相关文章
组织：分类、标签、作者、系列
内容：时间线、按钮、提示框、图表、Mermaid、Tabs、画廊、项目卡片
体验：搜索、暗黑模式、代码复制、图片缩放、Zen mode
```

这对我很重要。我的博客里不仅有普通文章，还会有项目页、手记、模型测试、独立 HTML 交互页。Blowfish 的 shortcode 和布局能力能覆盖这些形态。

## 从 0 开始搭建

下面是从空目录搭建 Hugo + Blowfish 的主流程。命令以 macOS 为例，其他系统只需要替换 Hugo 安装方式。

先安装 Hugo extended：

```bash
brew install hugo
hugo version
```

创建站点：

```bash
hugo new site blog
cd blog
git init
```

安装 Blowfish 主题：

```bash
git submodule add https://github.com/nunocoracao/blowfish.git themes/blowfish
```

这个仓库使用的是 Git submodule 方式，当前主题版本是 `v3.6.0`。安装主题后，把 Blowfish 的默认配置复制出来再改：

```bash
mv hugo.toml hugo.toml.bak
mkdir -p config/_default
cp themes/blowfish/config/_default/*.toml config/_default/
mv config/_default/languages.en.toml config/_default/languages.zh-cn.toml
mv config/_default/menus.en.toml config/_default/menus.zh-cn.toml
```

如果是克隆已经搭好的仓库，不需要重新 `submodule add`，只要拉取主题内容：

```bash
git submodule update --init --recursive --depth 1
```

然后先改 Hugo 主配置。站点至少需要知道主题、站点地址、标题和默认语言：

```toml
# config/_default/hugo.toml
theme = "blowfish"
baseURL = "https://your-name.github.io/blog/"
title = "你的博客"
defaultContentLanguage = "zh-cn"
hasCJKLanguage = true

[taxonomies]
  tag = "tags"
  category = "categories"
  author = "authors"
  series = "series"

[outputs]
  home = ["HTML", "RSS", "JSON"]
```

如果是 GitHub 项目页，例如 `https://your-name.github.io/blog/`，`baseURL` 末尾的 `/blog/` 很关键。很多线上 404 或资源路径不对，最后都能追到这里。

## 配置中文和作者

语言和作者信息放在：

```text
config/_default/languages.zh-cn.toml
```

一个最小例子：

```toml
disabled = false
locale = "zh-cn"
label = "简体中文"
weight = 1
title = "你的博客"

[params]
  displayName = "简体中文"
  isoCode = "zh-cn"
  rtl = false
  dateFormat = "2006-01-02"
  description = "记录技术、项目和长期思考。"

[params.author]
  name = "your-name"
  headline = "记录技术、项目和长期思考。"
  bio = "这里会沉淀工程实践、读书笔记和个人项目复盘。"
  links = [
    { github = "https://github.com/your-name" }
  ]
```

这里的 `hasCJKLanguage` 会让中文阅读时间和字数统计更接近实际情况。`outputs.home` 里的 `JSON` 则是 Blowfish 搜索需要的输出格式。

## 配置主题体验

主题参数主要在：

```text
config/_default/params.toml
```

我的取舍是先打开长期博客最常用的一组能力：

```toml
colorScheme = "burufugu"
defaultAppearance = "dark"
autoSwitchAppearance = true

enableSearch = true
enableCodeCopy = true
enableStructuredBreadcrumbs = true
mainSections = ["posts", "notes"]

[homepage]
  layout = "landing"
  showRecent = true
  showRecentItems = 8
  showMoreLink = true
  showMoreLinkDest = "posts"
  cardView = true

[article]
  showHero = true
  heroStyle = "background"
  showBreadcrumbs = true
  showDateUpdated = true
  showReadingTime = true
  showReadingProgress = true
  showTableOfContents = true
  showRelatedContent = true
  showTaxonomies = true
  showWordCount = true
  showZenMode = true
```

我没有一开始打开评论、阅读量、点赞、统计、赞助和广告。它们不是不能做，而是会引入外部服务、隐私说明、脚本加载和后续维护。个人博客刚开始更应该先保证内容结构和发布链路稳定。

## 配置内容入口

一个长期博客不应该只有 `posts`。我的结构是：

```text
content/
├── _index.md          # 首页
├── posts/             # 长文
├── notes/             # 短手记
├── projects/          # 项目索引
├── about/             # 关于页
└── series/            # 系列页说明
```

它们的职责不同：

| 入口 | 放什么 | 频率 |
| --- | --- | --- |
| `posts` | 正式文章、教程、复盘 | 低频但完整 |
| `notes` | 短想法、观察、摘录 | 高频但轻量 |
| `projects` | 项目、实验、交互 demo 索引 | 随项目更新 |
| `about` | 个人介绍、关注方向、时间线 | 偶尔更新 |
| `series` | 专题聚合入口 | 随文章增长 |

导航可以这样放：

```toml
# config/_default/menus.zh-cn.toml
[[main]]
  name = "文章"
  pageRef = "posts"
  weight = 10

[[main]]
  name = "系列"
  pageRef = "series"
  weight = 20

[[main]]
  name = "项目"
  pageRef = "projects"
  weight = 30

[[main]]
  name = "手记"
  pageRef = "notes"
  weight = 40

[[main]]
  name = "关于"
  pageRef = "about"
  weight = 50

[[main]]
  name = "标签"
  pageRef = "tags"
  weight = 60
```

分类可以放在页脚。分类是归档维度，不一定要占用顶部最重要的位置。

## 写第一篇文章

Hugo 的内容可以是普通 Markdown 文件，也可以是页面包。我更推荐页面包：

```text
content/posts/my-post/
└── index.md
```

页面包的好处是同一篇文章的正文、图片、附件可以放在同一个目录里。

新建文章：

```bash
hugo new content posts/my-post/index.md
```

在这个仓库里，我封装成了：

```bash
./run.sh blog new-post my-post
```

一篇文章的 front matter 可以这样写：

```yaml
---
title: "文章标题"
date: 2026-09-08
draft: false
description: "一句话说明这篇文章解决什么问题。"
tags:
  - Hugo
  - Blowfish
categories:
  - 博客建设
series:
  - 博客建设
series_order: 1
---
```

这里有一个长期维护经验：分类少一点，标签可以多一点，系列只给真正连续的主题使用。

```text
categories：粗粒度，比如 AI、博客建设、工程实践、读书
tags：细粒度，比如 Hugo、Blowfish、GitHub Actions、Three.js
series：连续阅读线，比如 博客建设、AI 学习路线、模型能力测试
```

## 嵌入交互 HTML

有些文章不是纯 Markdown，比如模型可视化、动画 demo、交互实验。这类内容不要硬塞进 Markdown，也不要引用临时目录。

我采用这个映射规则：

```text
content/posts/<slug>/index.md          # 文章入口、导语、按钮、iframe
static/posts/<slug>/interactive.html   # 完整交互页面
```

两边使用同一个 `<slug>`，以后文件多了也能一眼对应。

文章中引用同名静态目录里的 HTML 时，用相对路径：

```md
{{</* button href="interactive.html" target="_blank" rel="noopener noreferrer" */>}}打开交互页{{</* /button */>}}

<iframe
  src="interactive.html"
  title="交互演示"
  loading="lazy"
  style="width:100%; aspect-ratio:16 / 10; border:0; border-radius:12px;">
</iframe>
```

构建后路径会变成：

```text
/posts/<slug>/interactive.html
```

临时输入、截图、草稿素材可以放在仓库约定的临时目录里，但发布内容不要引用临时目录。它不属于 Hugo 发布内容。

## 本地预览

最原始的 Hugo 命令是：

```bash
hugo server -D
```

这个仓库封装了更顺手的入口：

```bash
./run.sh up
```

默认访问：

```text
http://localhost:1313/blog/
```

它是前台服务，会监听 `content/`、`config/`、`static/`、`assets/` 的变化，并自动热重载浏览器。

如果端口被占用，可以临时换端口：

```bash
HUGO_PORT=1314 ./run.sh up
```

因为它是前台服务，正常停止方式是在当前终端按 `Ctrl+C`。如果找不到原来的终端，再用：

```bash
./run.sh down
```

## 发布到 GitHub Pages

发布前要先明白 GitHub Pages 的两种常见模式：

```text
用户主页：
your-name.github.io
baseURL = "https://your-name.github.io/"

项目页：
your-name.github.io/blog/
baseURL = "https://your-name.github.io/blog/"
```

这个博客使用的是项目页，所以 `baseURL` 是：

```toml
baseURL = "https://amuqiao.github.io/blog/"
```

GitHub 仓库需要在 Pages 设置里选择：

```text
Settings
  -> Pages
  -> Build and deployment
  -> Source
  -> GitHub Actions
```

然后新增 workflow：

```text
.github/workflows/hugo.yaml
```

这个 workflow 的职责是：

```text
push main
  -> checkout 仓库和 Blowfish submodule
  -> 安装 Hugo extended
  -> hugo --gc --minify 构建 public/
  -> upload Pages artifact
  -> deploy 到 GitHub Pages
```

发布时先本地验证：

```bash
./run.sh blog verify
./run.sh doctor content-map
```

再提交并推送：

```bash
git status --short
git add content/posts/my-post/
git add static/posts/my-post/    # 如果这篇文章有独立 HTML demo
git commit -m "docs: 发布第一篇博客文章"
git push origin main
```

如果这次还改了配置或 workflow，就把对应路径一起加入 `git add`。`git push` 只会发布已经 commit 的内容；工作区里还没提交的文章、配置、页面包资源或静态 demo，不会出现在 GitHub Actions 构建里。

## 未来扩展清单

博客先跑通，不代表以后只能停在基础形态。更合理的方式是把功能分层：先启用不依赖第三方的能力，等内容稳定、访问量变大、读者互动变多，再逐步接入外部服务。

```text
基础可用
  -> 内容可发现
  -> 阅读体验
  -> 互动反馈
  -> 数据分析
  -> 商业化或个人品牌
```

| 扩展方向 | 适合什么时候加 | 需要注意什么 |
| --- | --- | --- |
| 站内搜索 | 文章数量超过十几篇后 | 需要 `outputs.home` 生成 `JSON` |
| 系列文章 | 一个主题开始连续写 3 篇以上 | 每篇文章的 `series` 和顺序要维护一致 |
| 项目页 | 有可展示的项目、demo、复盘时 | 项目页更适合放结果，文章更适合讲过程 |
| 时间轴 | 想展示建站过程、学习路线、版本演进时 | 适合少量关键节点，不适合堆太多日志 |
| 目录和阅读进度 | 长文、教程、方法论文章增多后 | 目录层级要克制，标题不要过碎 |
| 相关文章 | 同主题文章变多后 | 依赖标签、分类、系列等元数据质量 |
| 评论系统 | 真正需要读者讨论时 | 会引入第三方服务、审核和隐私说明 |
| 访问统计 | 需要知道哪些内容被阅读时 | 优先选择轻量、隐私友好的方案 |
| 阅读量 / 点赞 | 想增加轻互动时 | 通常需要后端或第三方服务，不是纯静态能力 |
| RSS / 订阅 | 稳定更新后 | 标题、摘要和发布时间要保持干净 |
| 多语言 | 确认要长期维护英文或其他语言时 | 多语言不是翻译一次，而是长期双份维护 |
| 站点图标和分享图 | 开始对外传播后 | 影响收藏夹、社交分享和搜索结果展示 |
| 自定义样式 | 主题默认样式不够用时 | 只改少量全站变量和布局约束，避免覆盖太深 |
| 赞助入口 | 内容持续产出且有明确读者后 | 保持克制，不要影响阅读体验 |

这份清单的作用不是催着一次性做完，而是给未来留出方向。个人博客真正重要的是长期可维护：每加一个功能，都要问它是否能帮助写作、检索、展示或发布；如果只是看起来热闹，可以先不加。

## 常见问题

| 现象 | 优先检查 |
| --- | --- |
| 线上 404 | GitHub Pages 是否选择了 GitHub Actions，Actions 是否成功 |
| 样式丢失 | `baseURL` 是否包含正确的 `/blog/` 子路径 |
| 主题没生效 | `theme = "blowfish"` 是否存在，`themes/blowfish` 是否拉取成功 |
| Actions 找不到主题 | workflow checkout 是否开启 `submodules: recursive` |
| 本地端口占用 | `./run.sh doctor port` 或换 `HUGO_PORT` |
| demo 打不开 | `content/posts/<slug>/` 和 `static/posts/<slug>/` 的 slug 是否一致 |
| push 后没变化 | 是否忘了 `git add` 或 `git commit` |

## 长期维护

博客刚建好时，最容易犯的错是把所有功能都打开，最后内容没多少，配置先变复杂。我的维护顺序是反过来的。

{{< timeline >}}
{{< timelineItem icon="code" header="先跑通写作链路" badge="Step 1" subheader="Hugo + Blowfish + 本地预览" md="true" >}}
能新建文章，能本地预览，能看到主题效果，能稳定构建。
{{< /timelineItem >}}

{{< timelineItem icon="file-lines" header="再稳定内容结构" badge="Step 2" subheader="文章、系列、项目、手记、关于" md="true" >}}
先用占位内容撑起入口，后续逐步替换成真实文章和项目。
{{< /timelineItem >}}

{{< timelineItem icon="github" header="然后自动发布" badge="Step 3" subheader="GitHub Actions -> GitHub Pages" md="true" >}}
本地验证通过后推送到 `main`，让 Actions 构建和部署。
{{< /timelineItem >}}

{{< timelineItem icon="check" header="最后再加增强功能" badge="Step 4" subheader="评论、统计、点赞、赞助" md="true" >}}
等内容稳定后，再考虑是否接入第三方服务，避免早期维护面过大。
{{< /timelineItem >}}
{{< /timeline >}}

最终，我想要的不是一个“功能最多”的博客，而是一个能长期写、容易找、方便迁移、发布稳定的个人知识库。Hugo 负责把复杂度压低，Blowfish 负责给内容足够好的展示能力；这两个组合起来，正好适合从 0 开始搭一个长期个人博客。
