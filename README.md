# amuqiao 的博客

这个仓库使用 Hugo + Blowfish 构建个人博客。主题通过 Git submodule 放在 `themes/blowfish/`，站点配置集中在 `config/_default/`。

## 工作方式

Hugo 负责把 `content/` 里的 Markdown 文章构建成静态站点，Blowfish 负责页面布局、导航、搜索、文章元信息和主题样式。

主干目录如下：

```text
config/_default/             # Hugo 和 Blowfish 配置
archetypes/                  # 新文章模板
content/                     # Markdown 内容
content/posts/               # 博客文章
themes/blowfish/             # Blowfish 主题 submodule
static/                      # 原样复制到站点根目录的静态文件
assets/                      # 交给 Hugo Pipes 处理的资源
public/                      # 构建产物，不提交
```

## 本地准备

先安装 Hugo。当前随仓库引入的 Blowfish 子模块声明需要 extended 版 Hugo，兼容范围是 `0.162.0` 到 `0.165.0`；以后升级主题时，以 `themes/blowfish/config.toml` 为准。

macOS 可以使用 Homebrew：

```bash
brew install hugo
```

确认版本：

```bash
hugo version
```

首次克隆本仓库后，拉取主题 submodule：

```bash
git submodule update --init --recursive --depth 1
```

## 启动入口

仓库入口借鉴服务项目的分层方式，但按静态博客的实际工作流拆成两类：

```text
blog    日常写作、前台预览、构建、建文章
doctor  排障诊断，检查环境、主题、内容映射和严格构建
```

查看可复制命令：

```bash
./run.sh -h
```

最常用的两个命令可以直接用简写：

```bash
./run.sh up
./run.sh down
```

## 本地预览

启动开发服务器：

```bash
./run.sh up
```

这个命令等价于 `./run.sh blog dev`，会以前台方式运行 `hugo server -D`，Hugo 会监听文章、配置和静态资源变更并触发浏览器热重载。当前 `baseURL` 带 `/blog/` 路径，默认访问地址是 `http://localhost:1313/blog/`。

停止本地预览服务时，在运行命令的终端按 `Ctrl+C`。

本地预览按单例处理：如果目标端口上已经运行的是当前项目的 Hugo 预览服务，再次执行 `./run.sh blog dev` 会提示“已运行”并成功退出，不会重复启动第二个服务。

如果找不到旧服务所在终端，可以通过入口停止当前项目的本地预览服务：

```bash
./run.sh down
HUGO_PORT=1314 ./run.sh down
```

如果默认端口被占用，可以临时换端口：

```bash
HUGO_PORT=1314 ./run.sh up
```

如果看到“本地预览端口已被占用”或 `address already in use`，说明本地预览端口被其他项目或进程占用。先查看占用情况：

```bash
./run.sh doctor port
./run.sh doctor port 1314
```

## 构建

生成静态站点：

```bash
./run.sh blog build
```

构建产物会输出到 `public/`，该目录已加入 `.gitignore`。

## 写文章

推荐使用页面包组织文章：

```bash
./run.sh blog new-post my-post
```

也可以手动创建：

```text
content/posts/my-post/
└── index.md
```

文章 front matter 示例：

```yaml
---
title: "文章标题"
date: 2026-09-07
draft: false
tags:
  - Hugo
categories:
  - 博客建设
---
```

## 常用维护

发布前运行最小验证：

```bash
./run.sh blog verify
```

排查本地环境、主题 submodule、文章与静态 demo 映射、构建问题：

```bash
./run.sh doctor all
```

排查端口占用：

```bash
./run.sh doctor port
./run.sh doctor port 1314
```

更新 Blowfish 主题：

```bash
git submodule update --remote --merge themes/blowfish
```

如果正式域名不是 GitHub Pages 的 `https://amuqiao.github.io/blog/`，发布前修改 `config/_default/hugo.toml` 里的 `baseURL`。
