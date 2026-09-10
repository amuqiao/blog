# 发布前验收

## 机器查（跑脚本，全绿才算过）

```bash
node docs/explainer/scripts/lint.mjs     <slug>
./run.sh blog build
node docs/explainer/scripts/verify.mjs   <slug>
node docs/explainer/scripts/contrast.mjs <slug>
```

覆盖：离线性、禁用 API、命名隔离、标签平衡、重复 id、canvas raw 模式、**版式契约**（段落无 max-width、无 ch 单位、shell/列宽/导语/字号在区间内）、导航锚点、canvas 文字读数、滑杆可访问名称、窄屏是否真能横向滚动、减弱动效、sandbox 嵌入态、构建四项产物、static↔public 字节一致、对比度。

## 人工看（脚本查不了）

**截图**
- [ ] 首屏一眼能抓住主题与主问题
- [ ] 每个重交互节截一张：有没有标签重叠、canvas 只填一角、宽表撑破
- [ ] 360px 下再截一次

**内容**
- [ ] 第一因在**它自己那一节**被显式命名，不是只在标题里
- [ ] 每节导语接住上一节留下的缺口；每节收束把读者交给下一节
- [ ] 没有哪一节退化成并列的名词清单
- [ ] 每一处模拟演示都在图注里说明「不是真的在跑模型 / 不是真实数据」
- [ ] 「见第 N 节」的指向都对
- [ ] 同一概念全文一个叫法；术语首现给了中英对照
- [ ] 没有编造的论文数字、跑分、耗时、显存
- [ ] 正文里没有出现「建议设为 X」这类没有依据的推荐值

**发布壳**
- [ ] `date` 带 `+08:00` 偏移
- [ ] `draft: false`
- [ ] `showTableOfContents: false`（正文在 iframe 里，站内 TOC 会是空的）
- [ ] Markdown 没有重复维护交互页里的正文、目录或模块清单
