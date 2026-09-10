# 《一文读懂》交互页工具集

为指定知识点生成**单文件、离线可打开、可交互的 HTML 长卷**，再由 Hugo 文章内嵌发布。

先建立心智模型：

```text
知识点          决定主线形态（因果链 / 过程链 / 对比链 / 决策链）
骨架            设计令牌 + 共享组件 + 共享 JS 命名空间 + 首屏
片段            每组作者只写自己那几个 <section>，互不可见
装配            片段注入骨架的三个占位符，产出单文件
验证            lint 查静态契约，verify 开浏览器查运行时
发布壳          content/posts/<slug>/index.md 只放导语 + 按钮 + iframe
```

**交互页是正文真源，Markdown 只是入口。** 这条来自 `AGENTS.md`，不要在两边各维护一份正文。

## 何时用

- 要把一个知识点讲透，且**可视化与交互能显著降低理解成本**（机制演示、参数联动、逐步推演）
- 内容量大到需要拆给多个作者并行写
- 需要长期回查（速查表、参数表、排障链）

不适用：短文、纯文字说明、一两张静态图就能讲清的东西。那些直接写 Markdown。

## 目录

```text
docs/explainer/
  README.md              本文
  scripts/               可执行资产（规则的真身）
    lib.mjs              路径解析 / manifest / Playwright 加载 / 页面预热
    assemble.mjs         片段 → 骨架三个占位符 → 单文件
    lint.mjs             静态契约：片段隔离、离线性、标签平衡、front matter
    verify.mjs           运行时：离线性、无障碍、窄屏、减弱动效、嵌入态、构建产物
    contrast.mjs         对比度 WCAG AA（含 alpha 合成）
    shot.mjs             元素级截图
  references/
    workflow.md          从选题到发布的完整流程
    contract.md          分发给子 agent 的逐字契约模板
    skeleton.md          骨架的分层结构与能力清单
    pitfalls.md          机器查不了的那些坑
    checklist.md         发布前验收
```

## 工作目录

```text
.data/explainer/<slug>/          gitignore，不发布，跨会话保留
  skeleton.html                  骨架，含三个注入占位符
  manifest.json                  分组契约：谁负责哪些 section、用什么前缀
  parts/<stem>.{html,css,js}     各组片段
```

`parts/` 是**可弃的**：装配产物一落盘就是真源。所以**每完成一组片段就装配一次**，不要等全部写完——中途丢失工作目录也不至于返工。

`manifest.json`：

```json
{
  "slug": "my-post",
  "ns": "mp",
  "groups": [
    { "stem": "10-open",  "prefix": "mp-a-", "sections": ["question", "tradeoff"] },
    { "stem": "20-core",  "prefix": "mp-b-", "sections": ["first-cause"] }
  ]
}
```

命名约定：`ns` 是全文命名空间（如 `mp`），共享组件类写作 `mp-card`；分组私有类写作 `mp-a-xxx`（`ns` + 单字母 + 连字符）。lint 靠这条规则区分「可以用的共享类」和「必须加前缀的私有类」。

## 命令

```bash
node docs/explainer/scripts/assemble.mjs <slug>
node docs/explainer/scripts/lint.mjs     <slug>
node docs/explainer/scripts/verify.mjs   <slug>          # 需要先 ./run.sh blog build
node docs/explainer/scripts/contrast.mjs <slug>
node docs/explainer/scripts/shot.mjs     <slug> out.png [selector] [--full] [--width=360]
```

暂不接入 `./run.sh`：接口还在变，现在固化入口反而增加改动成本。稳定后再按 `AGENTS.md` 的归类规则并入 `blog`。

## 给这套东西加规则时

**能用脚本查的，就写进 `lint.mjs` 或 `verify.mjs`，不要写进文档。** `references/pitfalls.md` 只保留机器查不了的。文档一长就没人看，断言不会。

## 演进路线

这套东西现在是「目录 + 脚本 + 文档」，目标形态是 skill（`SKILL.md` + `scripts/` + `references/` 正是 skill 的骨架，所以现在就照这个形状长）。满足以下三条再抽：

1. `scripts/` 连续两篇没有改动
2. `references/contract.md` 连续两篇逐字可用，不需要为新主题改结构
3. 新一篇的 review 没有报出 `pitfalls.md` 里没有的**新类别**坑
