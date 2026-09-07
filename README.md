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

## 本地预览

启动开发服务器：

```bash
hugo server -D
```

当前 `baseURL` 带 `/blog/` 路径，默认访问地址是 `http://localhost:1313/blog/`。

## 构建

生成静态站点：

```bash
hugo
```

构建产物会输出到 `public/`，该目录已加入 `.gitignore`。

## 写文章

推荐使用页面包组织文章：

```bash
hugo new content posts/my-post/index.md
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

更新 Blowfish 主题：

```bash
git submodule update --remote --merge themes/blowfish
```

如果正式域名不是 GitHub Pages 的 `https://amuqiao.github.io/blog/`，发布前修改 `config/_default/hugo.toml` 里的 `baseURL`。
