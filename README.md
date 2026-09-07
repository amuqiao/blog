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

交互文章采用“Markdown 发布壳 + HTML 正文真源”的方式：

```text
content/posts/<slug>/index.md          # front matter、少量导语、入口按钮、iframe
static/posts/<slug>/interactive.html   # 完整正文和交互内容
```

不要在发布内容中引用 `.data/`；`.data/` 只作为临时输入、截图或素材缓存。

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
