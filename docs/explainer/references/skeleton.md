# 骨架：分层结构与能力清单

**视觉身份每篇重做**，从主题推导。这里固化的是分层结构和「必须具备什么能力」，不是具体长什么样。

两篇的对照：一篇是暖白纸面 + 残差流脊线导航（讲 Transformer），一篇是深色画布 + 节点连线导航（讲 ComfyUI）。**导航形态从主题里长出来**，比套一个通用侧栏目录有说服力得多。

## 分层

```text
1  设计令牌       :root 变量。表面色、文字色、语义色轴、字体栈、圆角
2  布局           侧栏导航 + 正文两列；窄屏折叠成可展开列表
3  排版           section / h2 / 导语 / 收束 / 正文
4  共享组件       卡片、提示块、栅格、表格、代码块、控件、tabs、步骤器、展开、测验
5  首屏           一眼抓住主题与主问题的那个东西
6  共享命名空间   window.<NS>：数学、格式化、可复现随机、DOM、颜色、组件、生命周期
7  三个占位符     /*__PARTS_CSS__*/  <!--__PARTS_HTML__-->  /*__PARTS_JS__*/
```

## 语义色轴

用**内容驱动**的色轴，不要装饰性用色。例：按数据类型分色（MODEL / CLIP / CONDITIONING / LATENT / IMAGE / VAE），或按角色分色（Query / Key / Value / 位置）。

两条硬规则：
- 颜色**永远不是唯一信息载体**，每次出现都要同时有文字或数值
- 相邻色相（黄与橙）对部分色觉障碍读者不可区分，连线要加虚实等冗余编码

## 能力清单（每篇都要有，长相各异）

**导航与阅读**
- 侧栏导航，按滚动位置计算当前节 —— **不要用 IntersectionObserver 做高亮**：没有 section 落在激活带里时没人更新，会留下陈旧高亮（滚到底再回顶部仍停在最后一节）
- 阅读进度指示
- 跳转正文链接（`:focus` 时归位），否则键盘用户要按十几次 Tab 才能越过侧栏
- 窄屏折叠导航

**交互组件**
- 分段按钮 / tabs / 步骤器 / 测验，统一由命名空间提供，不要各章节各写一套
- tabs 要完整 ARIA：`role=tablist/tab/tabpanel` + `aria-selected` + `aria-controls` + 方向键 + roving tabindex
- 网格/矩阵用 `role="grid"` + roving tabindex，整个矩阵只占一个 Tab 站；**不要用 `role="img"`**，那会把所有数字从无障碍树里抹掉

**无障碍**
- 减弱动效下全局关过渡，且**只去掉自主运动、不砍功能**
- 滑杆的可见读数自动同步进 `aria-valuetext`（对数/指数刻度下读屏只念原始值，和页面显示对不上）
- canvas 必须有 `aria-label`，且**旁边要有文字读数**
- 对比度：所有文字令牌在**它实际所处的每一种底色**上都要过 4.5:1

**可复现**
- 随机一律走带 seed 的 PRNG，页面每次加载逐像素一致
- 数值单一真源：让所有章节的数字由**同一份计算**得出，跨节天然一致
  这份实现必须自己写、不外包——它错了会同时污染全篇

**离线**
- 零外部资源。图形只能 inline SVG / canvas 现画，不许外部图片，也不许 base64
- 禁用 `localStorage` / `sessionStorage` / `document.cookie`：页面会以 `sandbox="allow-scripts"`（无 `allow-same-origin`）嵌进文章页，访问会抛 `SecurityError`

## canvas 封装

逐像素绘制和普通矢量绘制的 dpr 处理**不一样**，封装时要给出两种模式：

```text
普通模式   后备存储 = 逻辑像素 × dpr，ctx.scale(dpr)，按 CSS 像素坐标画
raw 模式   后备存储 = 逻辑像素，不做 scale，靠 CSS 放大 + image-rendering: pixelated
```

用 `putImageData` 就必须走 raw 模式，原因见 `pitfalls.md`。
