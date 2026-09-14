---
title: "Agent Skill 包管理器：用 skillctl 统一管理本机 Skill"
date: 2026-09-14T11:54:59+08:00
lastmod: 2026-09-14T16:27:53+08:00
draft: false
description: "从安装 skillctl 到管理 meta-skill 和个人 my-skills 仓库，讲清 Agent Skill 的真源、Store、软链接、能力型 skill 与完整生命周期。"
summary: "skillctl 的核心不是复制安装，而是把 skill 管理改成：源码仓库是事实源，~/.agents/skills 是全局 Store，Agent 通过链接消费。本文用图表、流程和实例梳理安装、使用、个人 skill 标准化和排障。"
tags: ["Skills", "Agent", "CLI", "Codex", "Claude"]
categories: ["AI 工程"]
series: []
series_order:
showHero: false
showTableOfContents: true
---

{{< lead >}}
Agent Skill 一多，真正难的不是“装上”，而是知道哪一份该维护、哪个目录只是入口、出了问题从哪里查。
{{< /lead >}}

本文重写成一份可复用的本机操作手册：用 `skillctl` 管理 Agent Skill，把所有源码统一放在 `~/Code/agent-skills`，把 `~/.agents/skills` 当全局 Store，再让 Codex、Claude 或其他 Agent 从 Store 消费。

参考原文：[120+ 个 Agent Skill 管不过来？我造了套「包管理器」：仓库是源，链接是安装](https://wangruofeng007.com/blog/2026-09/skillctl-skill-management/)。

## 一句话模型

```text
源码仓库负责维护，~/.agents/skills 负责汇聚，Agent 目录负责消费。
```

不要把 `~/.codex/skills`、`~/.claude/skills`、`~/.agents/skills` 都当成“真源”。它们职责不同：

{{< feature-grid columns="4" >}}
{{< feature icon="github" title="Source" headingLevel="h3" >}}
`~/Code/agent-skills/sources/*`  
真正修改、提交、推送 skill 的地方。
{{< /feature >}}
{{< feature icon="code" title="Manager" headingLevel="h3" >}}
`~/Code/agent-skills/manager/skillctl`  
管理器源码，提供 link、doctor、sync 等能力。
{{< /feature >}}
{{< feature icon="link" title="Store" headingLevel="h3" >}}
`~/.agents/skills`  
全局汇聚层，优先放软链接，不手工养副本。
{{< /feature >}}
{{< feature icon="check" title="Agent" headingLevel="h3" >}}
`~/.codex/skills` / `~/.claude/skills`  
消费入口，能链接就链接，避免复制。
{{< /feature >}}
{{< /feature-grid >}}

## 第一性原理：到底在管什么

用费曼学习法讲，Agent Skill 管理只回答五个问题。

| 根本问题 | 通俗说法 | 这套方案的答案 |
| --- | --- | --- |
| 真源在哪里 | 以后到底改哪一份 | 改 `~/Code/agent-skills/sources/<repo>` 或 `manager/skillctl` |
| 怎么安装 | Agent 怎么看见它 | 用 `skills-link` 把源码目录软链接到 `~/.agents/skills` |
| 怎么共用 | Codex 和 Claude 怎么都能用 | 能读 Store 的直接读；不能读的补专属软链接 |
| 怎么验收 | 怎么知道没有坏 | 跑 `skills-doctor --no-project` |
| 怎么演进 | 新增、更新、删除怎么不乱 | 先改源码仓库，再 link、doctor、commit、push |

这就是“仓库是源，链接是安装”。复制安装的问题是会制造多个看起来都是真的副本；软链接安装的问题收敛得很干净：只要链接指向真源，改源码仓库就够了。

## 本机目录设计

我建议把管理器和被管理的 skill 源码放到一个专门目录，避免和普通项目仓库混在一起：

```text
~/Code/agent-skills/
├── manager/
│   └── skillctl/
└── sources/
    ├── archify/
    ├── meta-skill/
    └── my-skills/
```

展开之后是这样：

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
    ├── my-skills/
    │   └── skills/
    │       ├── choose-architecture-pattern/
    │       ├── document-writing/
    │       └── implementation-contract-plans/
    └── archify/
        └── archify/
```

对应的全局 Store 应该像这样：

```text
~/.agents/skills/
├── rf-skill-link          -> ~/Code/agent-skills/manager/skillctl/skills/rf-skill-link
├── rf-skill-doctor        -> ~/Code/agent-skills/manager/skillctl/skills/rf-skill-doctor
├── rf-skill-installer     -> ~/Code/agent-skills/manager/skillctl/skills/rf-skill-installer
├── rf-first-principles    -> ~/Code/agent-skills/sources/meta-skill/skills/rf-first-principles
├── rf-adversarial-review  -> ~/Code/agent-skills/sources/meta-skill/skills/rf-adversarial-review
├── document-writing       -> ~/Code/agent-skills/sources/my-skills/skills/document-writing
└── archify                -> ~/Code/agent-skills/sources/archify/archify
```

{{< mermaid >}}
flowchart LR
  A[manager skillctl] --> B[全局 Store]
  C[sources meta skill] --> B
  D[sources my skills] --> B
  E[sources archify] --> B
  B --> F[Codex]
  B --> G[Claude]
  B --> H[其他 Agent]
{{< /mermaid >}}

## 两类 skill：管理工具和能力工具

前面混乱的根源在这里：`rf-skill-*` 和 `rf-first-principles` 不是同一类东西。

{{< feature-grid >}}
{{< feature icon="code" title="管理工具型 skill" headingLevel="h3" >}}
`rf-skill-link`、`rf-skill-doctor`、`rf-skill-init`、`rf-skill-sync`、`rf-skill-installer`。  
它们帮你安装、链接、诊断、同步其他 skill。
{{< /feature >}}
{{< feature icon="star" title="能力增强型 skill" headingLevel="h3" >}}
`rf-first-principles`、`rf-adversarial-review`、`archify`、`document-writing`。  
它们是 Agent 工作时调用的能力。
{{< /feature >}}
{{< feature icon="github" title="源码仓库" headingLevel="h3" >}}
`meta-skill`、`my-skills`、`archify` 这类仓库可以装一个或多个 skill。  
仓库负责维护，是否可用取决于里面有没有 `SKILL.md`。
{{< /feature >}}
{{< /feature-grid >}}

一个简单判断：

```text
如果它解决“怎么管理 skill”，它是管理工具。
如果它解决“Agent 如何更好完成任务”，它是能力工具。
```

## skillctl 工具矩阵

这里必须补上 `rf-skill-installer`。它不是本地软链接工具，而是“把 GitHub skill 仓库 URL 翻译成安装命令”的助手。

| Skill | 你怎么用 | 典型场景 | 输出结果 |
| --- | --- | --- | --- |
| `rf-skill-link` | 终端命令 `skills-link` | 有一个源码仓库要全局可用 | 创建或修复到 `~/.agents/skills` 的软链接 |
| `rf-skill-doctor` | 终端命令 `skills-doctor` | skill 没生效、链接断了、目录混乱 | 检查 Store、consumer、lock、`SKILL.md`、备份 |
| `rf-skill-init` | 终端命令 `skills-init` | 某个项目要维护项目级 skill | 初始化 `.claude/skills` 和镜像目录 |
| `rf-skill-sync` | 终端命令 `skills-sync` | 项目级 skill 发生增删改 | 同步到 `.codex/skills`、`.zcode/skills` 等 |
| `rf-skill-installer` | 在 Agent 对话里点名使用 | 给一个 GitHub skill 仓库，想生成安装命令 | 输出 `npx skills add ...` 命令组合 |

`rf-skill-installer` 的使用方式更像这样：

```text
使用 rf-skill-installer，帮我为 https://github.com/wangruofeng/meta-skill 生成安装命令。
```

它会生成类似：

```bash
npx skills add wangruofeng/meta-skill
npx skills add wangruofeng/meta-skill -a claude-code -y
npx skills add wangruofeng/meta-skill -g
npx skills add wangruofeng/meta-skill -g -a claude-code -y
npx skills add wangruofeng/meta-skill --list
```

但在本文这套本机长期维护方案里，我更推荐：

```text
长期维护：git clone 到 ~/Code/agent-skills/sources，再用 skills-link。
临时体验：用 rf-skill-installer 生成 npx skills add 命令。
```

## meta-skill 提供什么能力

[`wangruofeng/meta-skill`](https://github.com/wangruofeng/meta-skill) 不是 `skillctl` 管理器本身，它是一个能力型 skill 仓库。当前重点是两个 skill：

{{< feature-grid >}}
{{< feature icon="search" title="rf-first-principles" headingLevel="h3" >}}
把技术栈、新领域、复杂问题或一段内容拆到根本问题，再重建可迁移的心智模型。  
适合：想搞懂本质、写解释文、拆方案、建立认知框架。
{{< /feature >}}
{{< feature icon="check" title="rf-adversarial-review" headingLevel="h3" >}}
站在对立面审查代码、文章、方案或决策，主动找漏洞、反例和风险。  
适合：提交前审查、方案挑刺、文章查漏、风险排查。
{{< /feature >}}
{{< feature icon="link" title="组合用法" headingLevel="h3" >}}
先用 `rf-first-principles` 把问题想清楚，再用 `rf-adversarial-review` 找破绽。  
适合：写方案、写博客、做架构决策前后各跑一遍。
{{< /feature >}}
{{< /feature-grid >}}

这两个能力是互补关系：

{{< mermaid >}}
flowchart LR
  A[先想清楚] --> B[rf first principles]
  B --> C[形成模型]
  C --> D[再挑毛病]
  D --> E[rf adversarial review]
  E --> F[修正方案]
  F --> C
{{< /mermaid >}}

在对话里可以这样用：

```text
使用 $rf-first-principles，帮我拆解 skillctl 的管理模型。
```

```text
使用 $rf-adversarial-review，帮我审查这篇博客有没有逻辑漏洞。
```

它们不是终端命令。它们的价值是改变 Agent 的工作方式：一个负责把问题想清楚，一个负责把方案打穿。

## 安装 skillctl

新机器上先建目录：

```bash
mkdir -p ~/Code/agent-skills/manager ~/Code/agent-skills/sources
```

拉取管理器：

```bash
git clone https://github.com/wangruofeng/skillctl.git \
  ~/Code/agent-skills/manager/skillctl
```

把 skillctl 自己的 skill 链到全局 Store：

```bash
bash ~/Code/agent-skills/manager/skillctl/skills/rf-skill-link/scripts/link.sh \
  --source ~/Code/agent-skills/manager/skillctl/skills
```

安装常用命令别名：

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

如果命令执行器每次都是一个新 shell，`source ~/.zshrc` 只影响那一次。可以直接这样跑：

```bash
zsh -ic 'source ~/.zshrc; skills-doctor --no-project'
```

或者绕过 alias：

```bash
python3 ~/Code/agent-skills/manager/skillctl/skills/rf-skill-doctor/scripts/skill_doctor.py \
  --no-project
```

## 安装 meta-skill

把源码仓库放到 `sources`：

```bash
git clone https://github.com/wangruofeng/meta-skill.git \
  ~/Code/agent-skills/sources/meta-skill
```

先预览：

```bash
skills-link \
  --source ~/Code/agent-skills/sources/meta-skill/skills \
  --dry-run
```

确认后链接：

```bash
skills-link \
  --source ~/Code/agent-skills/sources/meta-skill/skills
```

如果目标里已经有复制安装留下的真实目录，确认无误后再加 `--force`：

```bash
skills-link \
  --source ~/Code/agent-skills/sources/meta-skill/skills \
  --force
```

最后体检：

```bash
skills-doctor --no-project
```

成功后的结构应该是：

```text
~/.agents/skills/rf-first-principles
  -> ~/Code/agent-skills/sources/meta-skill/skills/rf-first-principles

~/.agents/skills/rf-adversarial-review
  -> ~/Code/agent-skills/sources/meta-skill/skills/rf-adversarial-review
```

## 把自己的 skill 做成标准仓库

外部仓库是 clone 下来再 link。自己的 skill 更容易乱，因为它们可能先散落在 `~/.codex/skills`、`~/.claude/skills` 或项目目录里。

本机这次把三个个人 skill 收进了 [`amuqiao/my-skills`](https://github.com/amuqiao/my-skills)：

```text
~/Code/agent-skills/sources/my-skills/
├── README.md
├── CLAUDE.md
├── AGENTS.md -> CLAUDE.md
└── skills/
    ├── choose-architecture-pattern/
    │   └── SKILL.md
    ├── document-writing/
    │   └── SKILL.md
    └── implementation-contract-plans/
        └── SKILL.md
```

标准 skill 仓库最少要满足这几条：

| 对象 | 必须有什么 | 为什么 |
| --- | --- | --- |
| 仓库根目录 | `README.md` | 新机器或新同事能知道这里是什么 |
| 仓库根目录 | `skills/` | 多 skill 仓库的统一入口 |
| 每个 skill | `SKILL.md` | Agent 读取 skill 的入口文件 |
| front matter | `name` / `description` / `version` | 工具能识别、展示和检查 |
| 维护规则 | `CLAUDE.md` / `AGENTS.md` | 说明这个仓库怎么维护 |

迁移一个已有 Codex skill：

```bash
mkdir -p ~/Code/agent-skills/sources/my-skills/skills

rsync -a ~/.codex/skills/document-writing \
  ~/Code/agent-skills/sources/my-skills/skills/
```

检查 `SKILL.md`：

```markdown
---
name: document-writing
description: 文档写作与 Markdown 文档结构优化 skill。
version: 0.1.0
---

# document-writing

这里写 Agent 应该遵循的长期指令。
```

链接个人仓库：

```bash
skills-link \
  --source ~/Code/agent-skills/sources/my-skills/skills \
  --dry-run

skills-link \
  --source ~/Code/agent-skills/sources/my-skills/skills

skills-doctor --no-project
```

如果 `~/.codex/skills/<name>` 原来是真实目录，而你想让 Codex 也消费 Store，可以把原目录备份，再补链接：

```bash
mkdir -p /private/tmp/codex-skills-backup-20260914

mv ~/.codex/skills/document-writing \
  /private/tmp/codex-skills-backup-20260914/

ln -s ../../.agents/skills/document-writing \
  ~/.codex/skills/document-writing
```

Claude 目录要先比较差异。如果 `~/.claude/skills/<name>` 和源码仓库内容不同，不要直接覆盖，先决定哪一份才应该成为真源。

## 生命周期总图

{{< mermaid >}}
flowchart TD
  A[发现 skill] --> B[放入源码仓库]
  B --> C[检查 SKILL md]
  C --> D[链接到 Store]
  D --> E[Agent 消费]
  E --> F[doctor 验收]
  F --> G[提交推送]
  G --> H[日常更新]
  H --> C
  H --> I[删除下线]
  I --> D
{{< /mermaid >}}

{{< timeline >}}
{{< timelineItem icon="github" header="1. 收进源码仓库" badge="Source" subheader="只在 sources 或 manager 里维护真源" md="true" >}}
外部仓库放 `~/Code/agent-skills/sources/<repo>`；管理器放 `~/Code/agent-skills/manager/skillctl`；自己的 skill 放 `~/Code/agent-skills/sources/my-skills/skills/<name>`。
{{< /timelineItem >}}
{{< timelineItem icon="link" header="2. 链接到全局 Store" badge="Link" subheader="Store 是汇聚层，不是手工副本目录" md="true" >}}
先跑 `skills-link --dry-run` 看会新增、修复还是跳过；确认后再正式 `skills-link`。遇到旧复制目录时，再考虑 `--force`。
{{< /timelineItem >}}
{{< timelineItem icon="check" header="3. 验收和排障" badge="Doctor" subheader="每次增删改后都跑 doctor" md="true" >}}
`skills-doctor --no-project` 检查 Store、链接、lock、`SKILL.md`、备份和 Agent 消费端。看到 `.bak-*` 备份时，确认链接正常后再清理。
{{< /timelineItem >}}
{{< timelineItem icon="code" header="4. 提交和迁移" badge="Git" subheader="Git 负责跨机器复用" md="true" >}}
自己的 skill 改完后在 `my-skills` 仓库提交推送。新机器只需要 clone `manager/skillctl` 和 `sources/*`，重新 link，再 doctor。
{{< /timelineItem >}}
{{< /timeline >}}

## 日常操作清单

新增一个外部 skill 仓库：

```bash
git clone <repo-url> ~/Code/agent-skills/sources/<repo-name>
skills-link --source ~/Code/agent-skills/sources/<repo-name>/skills --dry-run
skills-link --source ~/Code/agent-skills/sources/<repo-name>/skills
skills-doctor --no-project
```

新增一个自己的 skill：

```bash
mkdir -p ~/Code/agent-skills/sources/my-skills/skills/<skill-name>
$EDITOR ~/Code/agent-skills/sources/my-skills/skills/<skill-name>/SKILL.md

skills-link --source ~/Code/agent-skills/sources/my-skills/skills --dry-run
skills-link --source ~/Code/agent-skills/sources/my-skills/skills
skills-doctor --no-project
```

更新一个 skill 仓库：

```bash
cd ~/Code/agent-skills/sources/meta-skill
git pull
skills-doctor --no-project
```

更新管理器本身：

```bash
cd ~/Code/agent-skills/manager/skillctl
git pull

skills-link --source ~/Code/agent-skills/manager/skillctl/skills
bash skills/rf-skill-doctor/scripts/install.sh
bash skills/rf-skill-link/scripts/install.sh
skills-doctor --no-project
```

删除单个 skill：

```text
1. 在真源仓库删除对应 skill 目录
2. 对同一个 source 重新运行 skills-link
3. 运行 skills-doctor --no-project
```

删除整个仓库贡献的链接：

```bash
skills-link \
  --source ~/Code/agent-skills/sources/<repo-name>/skills \
  --remove

skills-doctor --no-project
```

## 常见误会

| 现象 | 真实原因 | 正确处理 |
| --- | --- | --- |
| `skills-doctor: command not found` | alias 没在当前 shell 生效 | 新开终端，或用 `zsh -ic 'source ~/.zshrc; skills-doctor --no-project'` |
| `~/.codex/skills` 没看到某个 skill | 总账是 `~/.agents/skills` | 先看 `ls -l ~/.agents/skills` |
| `skills-link` 提示目标是真实目录 | 以前复制安装过同名 skill | 先 `--dry-run`，确认后再 `--force` |
| doctor 提示 `.bak-*` | `--force` 迁移留下备份 | 确认同名链接正常后再清理 |
| Claude 和 Codex 同名 skill 内容不同 | 两边曾经各自复制维护 | 先比较差异，再决定谁进源码仓库 |
| 以为 skill 仓库本身就是 skill | 仓库可以装多个 skill | 只有含 `SKILL.md` 的目录才是 skill |
| `rf-skill-installer` 没终端命令 | 它是 Agent 对话里的命令生成 skill | 在对话里给 GitHub URL，让它生成 `npx skills add` |

## 最终复述

把这套系统记成五句话：

```text
skillctl 是管理器，放 manager。
外部 skill 和个人 skill 源码放 sources。
~/.agents/skills 是全局 Store，只做汇聚。
Codex 和 Claude 只是消费端，缺什么补链接。
新增、更新、删除后跑 skills-doctor。
```

最小安装路径：

```bash
mkdir -p ~/Code/agent-skills/manager ~/Code/agent-skills/sources
git clone https://github.com/wangruofeng/skillctl.git ~/Code/agent-skills/manager/skillctl
bash ~/Code/agent-skills/manager/skillctl/skills/rf-skill-link/scripts/link.sh --source ~/Code/agent-skills/manager/skillctl/skills
bash ~/Code/agent-skills/manager/skillctl/skills/rf-skill-doctor/scripts/install.sh
bash ~/Code/agent-skills/manager/skillctl/skills/rf-skill-link/scripts/install.sh
```

安装 [`meta-skill`](https://github.com/wangruofeng/meta-skill)：

```bash
git clone https://github.com/wangruofeng/meta-skill.git ~/Code/agent-skills/sources/meta-skill
skills-link --source ~/Code/agent-skills/sources/meta-skill/skills
skills-doctor --no-project
```

安装自己的 [`my-skills`](https://github.com/amuqiao/my-skills)：

```bash
git clone git@github.com:amuqiao/my-skills.git ~/Code/agent-skills/sources/my-skills
skills-link --source ~/Code/agent-skills/sources/my-skills/skills
skills-doctor --no-project
```

到这里，这套管理方式就闭环了：**源码一处维护，链接负责分发，doctor 负责验收，Git 负责迁移和协作。**
