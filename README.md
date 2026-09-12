# amuqiao 的博客

<p align="center">
  <a href="https://amuqiao.github.io/blog/">
    <img src="assets/images/v3/welcome.png" alt="amuqiao 的博客首页视觉图" width="820">
  </a>
</p>

<p align="center">
  <a href="https://amuqiao.github.io/blog/">在线访问</a>
  ·
  <a href="docs/github-pages-deploy.md">部署说明</a>
  ·
  <a href="docs/runbooks/html-animation-gif-cover.md">HTML 动画封面 Runbook</a>
  ·
  <a href="content/posts/">文章目录</a>
  ·
  <a href=".github/workflows/hugo.yaml">GitHub Actions</a>
</p>

<p align="center">
  <a href="https://gohugo.io/"><img alt="Hugo" src="https://img.shields.io/badge/Hugo-0.165.0-ff4088?logo=hugo&logoColor=white"></a>
  <a href="https://blowfish.page/"><img alt="Blowfish" src="https://img.shields.io/badge/Theme-Blowfish-2f81f7"></a>
  <a href="https://github.com/amuqiao/blog/actions/workflows/hugo.yaml"><img alt="Deploy" src="https://github.com/amuqiao/blog/actions/workflows/hugo.yaml/badge.svg"></a>
  <a href="https://amuqiao.github.io/blog/"><img alt="GitHub Pages" src="https://img.shields.io/badge/GitHub%20Pages-amuqiao.github.io%2Fblog-222?logo=github"></a>
</p>

这个仓库使用 [Hugo](https://gohugo.io/) + [Blowfish](https://blowfish.page/) 构建个人博客，发布到 [https://amuqiao.github.io/blog/](https://amuqiao.github.io/blog/)。

## 工作方式

```text
Markdown 文章        content/posts/<slug>/index.md
静态演示与交互页     static/posts/<slug>/
主题                themes/blowfish/，通过 Git submodule 管理
站点配置            config/_default/
部署                GitHub Actions -> GitHub Pages
```

Hugo 负责把 `content/` 构建成静态站点，Blowfish 负责页面布局、导航、搜索、文章元信息和主题样式。

## 快速开始

环境要求：

- [Hugo extended](https://gohugo.io/installation/) `0.162.0` - `0.165.0`
- Git submodule 支持，用于拉取 [Blowfish](https://blowfish.page/) 主题
- 可选：使用封面生成或 GIF 工具时需要 Node.js 20+ 并运行 `npm install`
- 可选：生成静态封面需要环境变量 `OPENAI_API_KEY`
- 可选：生成 HTML 动画预览 GIF 还需要 [Playwright](https://playwright.dev/)、Google Chrome 和 `gifski`，macOS 可用 `brew install gifski`

首次克隆后拉取主题：

```bash
git submodule update --init --recursive --depth 1
```

启动本地预览：

```bash
./run.sh up
```

默认访问 [http://localhost:1313/blog/](http://localhost:1313/blog/)。Hugo 会监听文章、配置和静态资源变化，并触发浏览器热重载。

停止本地预览：

```bash
./run.sh down
```

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `./run.sh -h` | 查看所有常用入口 |
| `./run.sh up` | 前台启动本地预览服务 |
| `./run.sh down` | 停止当前项目的本地预览服务 |
| `HUGO_PORT=1314 ./run.sh up` | 临时换端口启动 |
| `./run.sh blog new-post my-post` | 创建文章页面包 |
| `./run.sh blog cover my-post` | 使用 OpenAI Image API 生成文章封面 |
| `./run.sh blog gif static/posts/my-post/demo.html` | 将 HTML 动画导出为文章 GIF |
| `./run.sh blog build` | 构建静态站点到 `public/` |
| `./run.sh blog verify` | 发布前最小验证 |
| `./run.sh doctor all` | 完整排障检查 |

本地预览按单例处理：如果目标端口上已经运行的是当前项目的 Hugo 预览服务，再次执行 `./run.sh up` 会提示已运行并成功退出。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| [`config/_default/`](config/_default/) | Hugo 和 Blowfish 配置 |
| [`archetypes/`](archetypes/) | 新文章模板 |
| [`content/posts/`](content/posts/) | 博客文章页面包 |
| [`static/posts/`](static/posts/) | 文章对应的原样静态资源 |
| [`assets/`](assets/) | Hugo Pipes 处理的图片和 CSS |
| [`themes/blowfish/`](themes/blowfish/) | Blowfish 主题 submodule |
| [`docs/`](docs/) | 仓库维护文档 |
| [`docs/runbooks/`](docs/runbooks/) | 可复用维护流程 |
| `public/` | 构建产物，不提交 |

## 写文章

推荐使用页面包：

```bash
./run.sh blog new-post my-post
```

生成结构：

```text
content/posts/my-post/
└── index.md
```

文章专属图片和动图也放在页面包里，统一使用这两个名字：

```text
content/posts/my-post/
├── index.md
├── cover.png        # 首页/列表卡片静态封面；动图使用 cover.gif
└── background.png   # 文章页顶部背景
```

为普通文章生成静态封面时，先在当前终端设置 API Key，再传入文章 slug：

```bash
export OPENAI_API_KEY="..."
npm install
./run.sh blog cover my-post
```

命令分两段：先让文本模型把文章的 `title`、`description`、`tags` 和正文摘要写成图片提示词，再交给生图模型出图，产出 `content/posts/my-post/cover.png`。如果 `static/posts/my-post/` 下有 HTML 交互页，还会一并抽取交互页的标题层级、每节导语和收束一起作为输入——这类文章的正文真源在交互页里，`index.md` 只有导语和 iframe，只读 `index.md` 会让封面文不对题。没有同名静态目录的普通文章行为不变。同目录的 `cover-prompt.txt` 记录本次的完整提示词、文本模型先写下的一行中文「画面构思」、两个模型名和全部参数，便于复现。默认不会覆盖已有文件；需要重做时使用 `--force`，定制画面时使用 `--prompt "补充要求"`。

画风有三种来源，优先级从高到低：

```bash
# 用预设；预设放在可插拔的 scripts/cover/styles.json，增删改风格不需要动代码
./run.sh blog cover my-post --style flat-vector

# 临时指定，不入库
./run.sh blog cover my-post --style-text "胶片颗粒的黑白纪实"

# 都不传，由文本模型自选画风；它选了什么会记进 cover-prompt.txt
./run.sh blog cover my-post
```

`--style list` 查看全部预设。`--dry-run` 只跑文本模型看提示词，不出图也不写文件；它会先打印那行「画面构思」——画面主体是谁、正在做什么动作，一句中文说死。先用 `--dry-run` 看构思有没有抓住文章主题，抓对了再正式出图，能省一次出图的钱。`--out <path>` 换输出位置，`--json` 把提示词、参数和产物路径打成 JSON，便于被其它程序或 agent 调用。

看到满意的封面时，打开它旁边的 `cover-prompt.txt`，把里面的风格描述抄进 `scripts/cover/styles.json` 起个名字，以后就能 `--style <你的名字>` 长期复用。

交互文章采用“Markdown 发布壳 + HTML 正文真源”的方式：

```text
content/posts/<slug>/index.md          # front matter、少量导语、入口按钮、iframe
static/posts/<slug>/interactive.html   # 完整正文和交互内容
```

不要在发布内容中引用 `.data/`；`.data/` 只作为临时输入、截图或素材缓存。

如果 HTML demo 需要配一张动图预览，可以从 `static/posts/<slug>/` 里的 HTML 生成 GIF：

```bash
npm install
./run.sh blog gif static/posts/<slug>/demo.html
```

默认按博客封面尺寸生成：`--duration 4 --fps 15 --width 900 --height 594 --selector body --clock auto`。如果页面里有更稳定的动画舞台，可以用 `--selector` 指定，例如 `--selector '#stage'` 或 `--selector .stage`。
`--clock auto` 会为 `requestAnimationFrame` 和 `performance.now()` 驱动的动画选择 `virtual`，让导出的 GIF 速度更稳定；其他动画走 `realtime`。

需要作为封面时，显式输出为 `cover.gif`：

```bash
./run.sh blog gif static/posts/<slug>/demo.html content/posts/<slug>/cover.gif
```

完整操作流程见 [HTML 动画封面 Runbook](docs/runbooks/html-animation-gif-cover.md)。

## 部署

GitHub 仓库的 Pages 发布源选择 `GitHub Actions` 后，推送到 `main` 会自动触发部署：

```bash
git add .
git commit -m "chore: update blog"
git push origin main
```

查看部署状态：

- [Actions 运行记录](https://github.com/amuqiao/blog/actions)
- [部署 workflow](.github/workflows/hugo.yaml)
- [GitHub Pages 部署说明](docs/github-pages-deploy.md)

## 维护

发布前建议先运行：

```bash
./run.sh blog verify
./run.sh doctor content-map
```

更新 Blowfish 主题：

```bash
git submodule update --remote --merge themes/blowfish
```

如果正式域名不是 [https://amuqiao.github.io/blog/](https://amuqiao.github.io/blog/)，发布前修改 [`config/_default/hugo.toml`](config/_default/hugo.toml) 里的 `baseURL`，并同步检查 [部署文档](docs/github-pages-deploy.md)。
