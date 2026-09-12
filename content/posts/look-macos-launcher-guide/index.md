---
title: "Look：轻量好用的键盘启动器"
date: 2026-09-12
lastmod: 2026-09-12
draft: false
showHero: false
featureimage: "cover.png"
description: "面向新用户的 Look 上手指南：DMG 安装、核心快捷键、命令模式、中文搜索配置和简单磁贴设置。"
tags:
  - Look
  - macOS
  - Launcher
  - 效率工具
categories:
  - 工具效率
series:
  - macOS 工具配置
series_order: 1
---

{{< lead >}}
Look 是一个轻量的键盘启动器，适合替代 Spotlight：打开应用、找文件、查剪贴板、进番茄钟、写今日待办、结束卡住的进程，都可以从一个输入框开始。
{{< /lead >}}

{{< button href="https://noah-code.com/docs/look" target="_blank" rel="noopener noreferrer" >}}官方文档{{< /button >}}
{{< button href="https://github.com/kunkka19xx/look" target="_blank" rel="noopener noreferrer" >}}GitHub 仓库{{< /button >}}

<div class="look-official-owl">
  <iframe src="owl-ascii-animation.html" title="Look 官方猫头鹰 ASCII 动画" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" loading="lazy"></iframe>
</div>

<style>
.look-official-owl {
  margin: 1.25rem 0 1.5rem;
}

.look-official-owl iframe {
  display: block;
  width: 100%;
  height: min(520px, 68vw);
  min-height: 360px;
  border: 0;
  border-radius: 14px;
  background: #000;
  overflow: hidden;
}
</style>

上面这段动画直接来自 Look 官方页面使用的 HTML 资源。因为 Look 仓库使用 GPL-3.0，随文保留了一份 [GPL-3.0 许可证](LOOK-GPL-3.0-LICENSE.txt)。

官方文档把 Look 定位为 keyboard-first、local-first 的启动器；GitHub 仓库也说明它是开源、跨平台、轻量的 Spotlight / Raycast 替代品。我的建议是：新用户不用研究所有功能，先掌握几个核心键，再打开中文搜索，就已经很好用。

{{< alert icon="circle-info" >}}
最核心的 5 个入口：`Cmd+Space` 呼出、`Cmd+/` 进命令面板、`:pomo` 番茄钟、`:todo` 待办、`:kill` 结束进程。
{{< /alert >}}

## 适合谁

Look 适合这些场景：

- 想用键盘快速打开应用和文件
- 觉得 Spotlight 搜索结果不够顺手
- 想要一个轻量、少打扰的启动器
- 偶尔需要番茄钟、今日待办、结束卡住进程
- 愿意改一两个配置，让中文搜索更准

不建议一开始就把它当成复杂插件平台。先把搜索、命令模式和中文应用名配置好，就够用了。

## 安装

我用的是 DMG 安装：

{{< steps >}}
{{< step number="1" title="下载 DMG" >}}
从官方 GitHub Releases 下载 macOS 版本。
{{< /step >}}
{{< step number="2" title="拖到 Applications" >}}
打开 DMG，把 `Look.app` 拖到 `/Applications`。
{{< /step >}}
{{< step number="3" title="启动 Look" >}}
从启动台打开，或在终端运行 `open -a Look`。
{{< /step >}}
{{< step number="4" title="让出 Cmd+Space" >}}
如果要用 `Cmd+Space` 呼出 Look，到系统设置里关闭 Spotlight 的同名快捷键。
{{< /step >}}
{{< /steps >}}

官方也提供 Homebrew 安装：

```bash
brew tap kunkka19xx/tap
brew install --cask look
```

## 先记住这几个键

新用户最该先记的是这些：

| 快捷键 / 输入 | 作用 |
| --- | --- |
| `Cmd+Space` | 呼出 Look |
| `Cmd+/` | 进入命令面板 |
| `:pomo` | 直接进入番茄钟 |
| `:todo` | 直接进入今日待办 |
| `:kill` | 直接进入结束进程面板 |
| `Cmd+Shift+;` | 重新加载配置 |
| `Cmd+Option+Q` | 完全退出 Look |

`Esc` 只是关闭搜索弹窗，不是退出 Look。Look 是菜单栏常驻应用，如果只是按 `Esc`，程序还在后台。

{{< alert icon="triangle-exclamation" >}}
改完配置后，如果 `Cmd+Shift+;` 没刷新出来，就完全退出 Look 再打开。不要把关闭弹窗当成退出程序。
{{< /alert >}}

## 日常怎么用

最普通的用法：

```text
Cmd+Space -> 输入应用名或文件名 -> Enter
```

常用前缀：

| 输入 | 用途 |
| --- | --- |
| `a"quark` | 只搜应用 |
| `f"report` | 只搜文件 |
| `d"project` | 只搜文件夹 |
| `rc"screenshot` | 搜最近文件和文件夹 |
| `c"token` | 搜剪贴板历史 |

命令模式才是 Look 很有用的一块。可以按 `Cmd+/` 打开命令面板，也可以直接输入冒号命令：

```text
:pomo   番茄钟
:todo   今日待办
:kill   查找并结束进程
```

这三个比首页磁贴更核心，因为它们是 Look 内置能力，不依赖自定义脚本。

## 中文搜索必须设置

如果搜“夸克网盘”搜不到，但搜 `QuarkCloudDrive` 能搜到，通常是因为应用包里的真实名字是英文。中文系统建议直接打开本地化应用名索引。

打开主配置文件：

```text
~/.look/config
```

设置：

```ini
localized_app_names=true
```

改完后按：

```text
Cmd+Shift+;
```

如果还不生效，完全退出 Look 后重新打开。

常用中文应用可以再补 alias：

```ini
alias_quark=QuarkCloudDrive|夸克网盘|夸克
alias_music=网易云音乐|NeteaseMusic|Music
```

alias 的作用是把“你习惯输入的中文叫法”和“应用真实名称”连起来。

## 配置文件在哪

新用户先知道这三个就够：

```text
~/.look/config                 # 主配置
~/.look/super-actions.toml     # 首页磁贴
~/.look/sources/*.toml         # 自定义搜索来源，后面再看
```

我建议先只改这些配置：

```ini
localized_app_names=true
launch_at_login=true
file_scan_roots=Desktop,Documents,Downloads
file_scan_extra_roots=
super_actions_enabled=true
```

如果你常在代码目录里找文件，可以加：

```ini
file_scan_extra_roots=/Users/admin/Code
```

不要一开始把整个 Home 目录都加进去，搜索结果会变乱。

## 退出和重启 Look

Look 是常驻应用。改配置后，有时只重载不够，需要完整退出再打开。

推荐三种方式：

```text
菜单栏 Look 图标 -> Quit Look
Cmd+Option+Q
killall Look && open /Applications/Look.app
```

终端一键重启：

```bash
killall Look && open /Applications/Look.app
```

记住区别：

```text
Esc             只关闭弹窗
Cmd+Shift+;     重新加载配置
Cmd+Option+Q    退出 Look 程序
killall Look    强制结束 Look 进程
```

## 首页磁贴少量配置

Super Actions 磁贴是 Look 空搜索框首页里的快捷按钮。配置文件：

```text
~/.look/super-actions.toml
```

我建议新用户先用简单布局：

```toml
layout = [
    "lslot       lslot       bluetooth   keepawake   screensaver weather",
    "lslot       lslot       .           .           .           weather",
    "nowplaying  nowplaying  nowplaying  .           .           .",
]
```

几个常见磁贴：

| 磁贴 | 作用 |
| --- | --- |
| `lslot` | Todo / Pomo / Clock 预览，只读 |
| `bluetooth` | 蓝牙开关 |
| `keepawake` | 防止睡眠 |
| `screensaver` | 启动屏幕保护 |
| `weather` | 天气 |
| `nowplaying` | 当前媒体播放 / 暂停 |

不建议把 `restart`、`shutdown` 放首页。它们是系统重启和关机，不是重启 Look。

## 自定义磁贴知道这么多就够

自定义磁贴可以理解成“首页上的脚本按钮”：

```text
value  显示什么
press  点击后执行什么
```

比如加一个打开网易云音乐的磁贴：

```toml
layout = [
    "lslot       lslot       netease     keepawake   screensaver weather",
    "lslot       lslot       .           .           .           weather",
    "nowplaying  nowplaying  nowplaying  .           .           .",
]

[tiles.netease]
value = "printf '{\"value\":\"Netease\",\"caption\":\"网易云音乐\",\"icon\":\"music.note\"}'"
press = "open -a '网易云音乐'"
title = "Netease"
mnemonic = "N"
```

这就够了。更复杂的脚本以后再折腾。

{{< alert icon="circle-info" >}}
如果只是想进番茄钟、待办或结束进程，不一定要写磁贴。直接输入 `:pomo`、`:todo`、`:kill` 更稳。
{{< /alert >}}

## 结论

Look 的新用户上手顺序很简单：

```text
安装 Look
接管 Cmd+Space
记住 Cmd+/ 和 :pomo / :todo / :kill
打开 localized_app_names=true
按需补 alias
少量整理首页磁贴
```

先做到这些，Look 就已经足够顺手了。
