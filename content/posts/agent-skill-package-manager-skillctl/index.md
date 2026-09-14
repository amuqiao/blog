---
title: "Agent Skill 包管理器：用 skillctl 统一管理本机 Skill"
date: 2026-09-14T11:54:59+08:00
lastmod: 2026-09-14T11:54:59+08:00
draft: false
description: "基于 skillctl 的“仓库是源，链接是安装”模型，整理一套适合本机长期复用的 Agent Skill 管理目录、安装流程、meta-skill 示例和排障方法。"
summary: "把 skillctl 当管理器，把 skill 源码仓库统一放到 ~/Code/agent-skills，把 ~/.agents/skills 当全局汇聚层。新增、更新、删除 skill 都围绕真源和软链接展开。"
tags: ["Skills", "Agent", "CLI", "Codex", "Claude"]
categories: ["AI 工程"]
series: []
series_order:
showHero: false
showTableOfContents: true
---

{{< lead >}}
Agent Skill 变多之后，真正难的不是安装，而是知道“哪一份才应该被维护”。
{{< /lead >}}

本文主旨：**skillctl 不是把 skill 到处复制的工具，而是把 skill 管理改成“源码仓库是事实源，`~/.agents/skills` 是汇聚层，Agent 只消费链接”的工作流。**

这篇文章是一次本机整理的复盘：我把 `skillctl`、`meta-skill`、`archify` 统一放进 `~/Code/agent-skills`，再用 `skills-link` 汇聚到 `~/.agents/skills`。以后新增、更新、删除全局 skill，都照这套流程走。

参考原文：[120+ 个 Agent Skill 管不过来？我造了套「包管理器」：仓库是源，链接是安装](https://wangruofeng007.com/blog/2026-09/skillctl-skill-management/)。

## 先把位置说清楚

最容易混乱的是这几个目录：

```text
~/Code/agent-skills/
├── manager/
│   └── skillctl/        # 管理器源码，提供 skills-link / skills-doctor 等工具
└── sources/
    ├── archify/         # 第三方 skill 源码仓库
    └── meta-skill/      # 第三方或自有 skill 源码仓库

~/.agents/skills/        # 全局 Store，Agent 读取的汇聚层
~/.codex/skills/         # Codex 专属/历史目录，不再当全局总账
~/.claude/skills/        # Claude 专属/历史目录，可逐个链接或整目录链接
```

压缩成一句话：

```text
维护源码仓库，不维护 ~/.agents/skills 里的副本。
```

`~/Code/agent-skills` 是我选择的本机管理目录。它不是 skillctl 强制要求的路径，但它把“管理器”和“被管理的 skill 源码”分开了，后续不容易和普通项目仓库混在一起。

## 心智模型：三层一链

{{< mermaid >}}
flowchart LR
  A[源码仓库] -->|skills-link| B[全局 Store]
  B -->|Agent 加载| C[Codex]
  B -->|软链接消费| D[Claude]
  B -->|软链接消费| E[其他 Agent]
  A1[skillctl] --> A
  A2[meta-skill] --> A
  A3[archify] --> A
{{< /mermaid >}}

这张图有三个角色：

| 层级 | 目录 | 作用 | 是否手工维护 |
| --- | --- | --- | --- |
| 源码层 | `~/Code/agent-skills/manager/skillctl` | 管理器源码 | 是 |
| 源码层 | `~/Code/agent-skills/sources/*` | 各个 skill 仓库源码 | 是 |
| 汇聚层 | `~/.agents/skills` | 全局 Store，只放链接或少量直装目录 | 一般不手改 |
| 消费层 | `~/.codex/skills` / `~/.claude/skills` | Agent 自己的目录 | 尽量不手改 |

为什么不直接把 skill 都复制到 `~/.codex/skills` 或 `~/.claude/skills`？

因为复制会制造多个“看起来都是真的”的版本：

```text
复制安装：
meta-skill/rf-first-principles
  -> ~/.agents/skills/rf-first-principles
  -> ~/.claude/skills/rf-first-principles
  -> ~/.codex/skills/rf-first-principles

问题：改了哪一份？哪一份过期？Agent 读的是哪一份？
```

链接安装把问题收敛成一条线：

```text
链接安装：
~/Code/agent-skills/sources/meta-skill/skills/rf-first-principles
  -> ~/.agents/skills/rf-first-principles
  -> Agent 消费

答案：真源只有一个，改源码仓库。
```

## skillctl 到底管什么

skillctl 管的不是某一个 Agent 的目录，而是**全局 Store**：

```text
skillctl 的用户级主战场：
~/.agents/skills
```

它提供的几个工具可以这样理解：

| 命令 | 用在什么时候 | 做什么 |
| --- | --- | --- |
| `skills-link` | 有一个 skill 源码仓库要全局可用 | 把仓库里的 skill 软链接到 `~/.agents/skills` |
| `skills-doctor` | 感觉 skill 没生效、目录混乱、链接断了 | 检查 Store、链接、lock、`SKILL.md`、备份 |
| `skills-init` | 新项目想维护项目级 skill | 建项目内 `.claude/skills` 真源和镜像目录 |
| `skills-sync` | 项目级 skill 增删改后 | 把 `.claude/skills` 同步到 `.codex/skills`、`.zcode/skills` 等 |

注意这里有两套模型：

```text
用户级全局 skill：
源码仓库 -> ~/.agents/skills -> Agent
用 skills-link / skills-doctor

项目级私有 skill：
项目/.claude/skills -> 项目/.codex/skills
用 skills-init / skills-sync
```

本文主要讲用户级全局 skill。

## 推荐目录结构

我建议固定用这个结构：

```text
~/Code/agent-skills/
├── manager/
│   └── skillctl/
│       └── skills/
│           ├── rf-skill-link/
│           ├── rf-skill-doctor/
│           ├── rf-skill-init/
│           ├── rf-skill-sync/
│           ├── rf-skill-installer/
│           └── rf-commit-push/
└── sources/
    ├── meta-skill/
    │   └── skills/
    │       ├── rf-first-principles/
    │       └── rf-adversarial-review/
    └── archify/
        └── archify/
```

对应的全局 Store 应该长这样：

```text
~/.agents/skills/
├── rf-skill-link          -> ~/Code/agent-skills/manager/skillctl/skills/rf-skill-link
├── rf-skill-doctor        -> ~/Code/agent-skills/manager/skillctl/skills/rf-skill-doctor
├── rf-first-principles    -> ~/Code/agent-skills/sources/meta-skill/skills/rf-first-principles
├── rf-adversarial-review  -> ~/Code/agent-skills/sources/meta-skill/skills/rf-adversarial-review
└── archify                -> ~/Code/agent-skills/sources/archify/archify
```

这就是“仓库是源，链接是安装”。

## 从零安装 skillctl

新机器上可以按这个流程来：

```bash
mkdir -p ~/Code/agent-skills/manager ~/Code/agent-skills/sources

git clone https://github.com/wangruofeng/skillctl.git \
  ~/Code/agent-skills/manager/skillctl
```

把 skillctl 自己提供的 skill 链到全局 Store：

```bash
bash ~/Code/agent-skills/manager/skillctl/skills/rf-skill-link/scripts/link.sh \
  --source ~/Code/agent-skills/manager/skillctl/skills
```

安装终端命令 alias：

```bash
bash ~/Code/agent-skills/manager/skillctl/skills/rf-skill-init/scripts/install.sh
bash ~/Code/agent-skills/manager/skillctl/skills/rf-skill-sync/scripts/install.sh
bash ~/Code/agent-skills/manager/skillctl/skills/rf-skill-doctor/scripts/install.sh
bash ~/Code/agent-skills/manager/skillctl/skills/rf-skill-link/scripts/install.sh
```

让当前终端生效：

```bash
source ~/.zshrc
```

如果你是在某些“一条命令一个 shell”的执行器里运行，`source ~/.zshrc` 只影响当前那一条命令。可以写成：

```bash
zsh -ic 'source ~/.zshrc; skills-doctor --no-project'
```

或者直接绕过 alias：

```bash
python3 ~/Code/agent-skills/manager/skillctl/skills/rf-skill-doctor/scripts/skill_doctor.py --no-project
```

## 示例：安装和管理 meta-skill

`meta-skill` 里有两个适合长期复用的 skill：

```text
rf-first-principles      # 第一性原理解读
rf-adversarial-review    # 对抗式审查
```

第一步，把源码仓库放进统一目录：

```bash
git clone https://github.com/wangruofeng/meta-skill.git \
  ~/Code/agent-skills/sources/meta-skill
```

第二步，先预览链接结果：

```bash
skills-link \
  --source ~/Code/agent-skills/sources/meta-skill/skills \
  --dry-run
```

如果目标里没有同名 skill，会看到新增；如果之前已经通过复制方式安装过，会看到“目标已存在真实目录/文件，不覆盖”。

第三步，确认要把旧复制目录改成软链接时，加 `--force`：

```bash
skills-link \
  --source ~/Code/agent-skills/sources/meta-skill/skills \
  --force
```

`--force` 不会直接吞掉旧目录，而是先备份：

```text
~/.agents/skills/rf-first-principles.bak-20260914113427
~/.agents/skills/rf-adversarial-review.bak-20260914113427
```

第四步，确认链接正确后清理备份：

```bash
skills-doctor --clean-backups --no-project
```

第五步，体检：

```bash
skills-doctor --no-project
```

最终你应该看到类似结构：

```text
~/.agents/skills/rf-first-principles
  -> ~/Code/agent-skills/sources/meta-skill/skills/rf-first-principles

~/.agents/skills/rf-adversarial-review
  -> ~/Code/agent-skills/sources/meta-skill/skills/rf-adversarial-review
```

到这里，`meta-skill` 就不是“复制安装”了，而是“源码仓库维护，Store 只持有链接”。

## 为什么 Codex 目录里看不到

一个常见误会是：

```bash
ls ~/.codex/skills
```

发现没有 `rf-first-principles`，就以为 Codex 没装上。

在这套模型里，先看总账：

```bash
ls ~/.agents/skills
```

新版 Codex 可以直接读取 `~/.agents/skills`。因此 `~/.codex/skills` 不需要列出全部全局 skill，它可以只保留 Codex 专属或历史安装的 skill。

可以这样理解：

```text
~/.agents/skills = 全局公共 Store
~/.codex/skills  = Codex 专属目录，不再当总账
~/.claude/skills = Claude 专属目录，可链接到 Store
```

如果某个 Agent 不会直接读 `~/.agents/skills`，再把它自己的目录链接到 Store，或者在它的目录里做逐 skill 软链接。

## 复盘：这次整理实际做了什么

这次整理分三步。

第一步，把源码仓库移动到统一目录：

```text
旧位置：
~/Code/skillctl
~/Code/meta-skill
~/Code/archify

新位置：
~/Code/agent-skills/manager/skillctl
~/Code/agent-skills/sources/meta-skill
~/Code/agent-skills/sources/archify
```

第二步，修复全局 Store 里的软链接：

```text
旧链接：
~/.agents/skills/rf-skill-link -> ~/Code/skillctl/skills/rf-skill-link

新链接：
~/.agents/skills/rf-skill-link -> ~/Code/agent-skills/manager/skillctl/skills/rf-skill-link
```

第三步，更新 CLI alias：

```text
旧 alias：
skills-doctor -> ~/Code/skillctl/skills/rf-skill-doctor/scripts/skill_doctor.py

新 alias：
skills-doctor -> ~/Code/agent-skills/manager/skillctl/skills/rf-skill-doctor/scripts/skill_doctor.py
```

整理后的检查项：

```bash
ls -l ~/.agents/skills
type skills-link
type skills-doctor
skills-doctor --no-project
```

如果 `skills-doctor` 报 `.bak-*` 备份，会清理：

```bash
skills-doctor --clean-backups --no-project
```

## 日常维护流程

新增一个全局 skill 仓库：

```bash
git clone <repo-url> ~/Code/agent-skills/sources/<repo-name>
skills-link --source ~/Code/agent-skills/sources/<repo-name>/skills --dry-run
skills-link --source ~/Code/agent-skills/sources/<repo-name>/skills
skills-doctor --no-project
```

如果这个仓库是单 skill 仓库，`SKILL.md` 不在 `skills/<name>/`，而是在某个单独目录里，就把 `--source` 指到那个目录的上一级或它本身：

```bash
skills-link --source ~/Code/agent-skills/sources/archify
```

更新一个 skill 仓库：

```bash
cd ~/Code/agent-skills/sources/meta-skill
git pull

skills-doctor --no-project
```

因为 `~/.agents/skills` 里是软链接，`git pull` 后通常不需要重新安装。

更新管理器本身：

```bash
cd ~/Code/agent-skills/manager/skillctl
git pull

skills-link --source ~/Code/agent-skills/manager/skillctl/skills
bash skills/rf-skill-doctor/scripts/install.sh
bash skills/rf-skill-link/scripts/install.sh
skills-doctor --no-project
```

删除一个全局 skill：

```text
1. 在真源仓库删除对应 skill 目录
2. 重新运行 skills-link
3. 运行 skills-doctor 检查断链或 lock 残留
```

如果只是临时不想让 Agent 看到某个 skill，可以先不要删源码，改为摘掉 Store 里的链接。但长期规则仍然是：**真源里有什么，Store 里就汇聚什么。**

## 常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `skills-doctor: command not found` | alias 没在当前 shell 生效，或命令执行器每次开新 shell | 新开终端，或用 `zsh -ic 'source ~/.zshrc; skills-doctor'` |
| `~/.codex/skills` 没有某个 skill | 总账在 `~/.agents/skills`，不是 `~/.codex/skills` | 先看 `ls ~/.agents/skills` |
| `skills-link` 提示目标是真实目录 | 之前复制安装过同名 skill | 先 `--dry-run`，确认后 `--force` |
| doctor 提示 `.bak-*` | `--force` 迁移留下备份 | 确认同名链接正常后 `skills-doctor --clean-backups` |
| doctor 提示消费端缺失 | 某些 Agent 目录没有链接到 Store | 只影响对应 Agent，不影响 Store 真源 |

## 最终规则

把这套流程记成四句话就够了：

```text
skillctl 是管理器，放 manager。
skill 源码仓库放 sources。
~/.agents/skills 是全局 Store，只做汇聚。
新增、更新、删除后跑 skills-doctor。
```

对于新用户，最小路径是：

```bash
mkdir -p ~/Code/agent-skills/manager ~/Code/agent-skills/sources
git clone https://github.com/wangruofeng/skillctl.git ~/Code/agent-skills/manager/skillctl
bash ~/Code/agent-skills/manager/skillctl/skills/rf-skill-link/scripts/link.sh --source ~/Code/agent-skills/manager/skillctl/skills
bash ~/Code/agent-skills/manager/skillctl/skills/rf-skill-doctor/scripts/install.sh
bash ~/Code/agent-skills/manager/skillctl/skills/rf-skill-link/scripts/install.sh
```

然后安装 `meta-skill`：

```bash
git clone https://github.com/wangruofeng/meta-skill.git ~/Code/agent-skills/sources/meta-skill
skills-link --source ~/Code/agent-skills/sources/meta-skill/skills
skills-doctor --no-project
```

这就是可复用的 Agent Skill 包管理方式：**源码一处维护，链接负责分发，doctor 负责验收。**
