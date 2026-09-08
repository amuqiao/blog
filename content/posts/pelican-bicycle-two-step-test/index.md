---
title: "用两步测试比较模型能否生成鹈鹕骑车"
date: 2026-09-07
lastmod: 2026-09-08
draft: false
description: "用同一组 2D SVG 与 Three.js 3D 提示，对比 Opus 5 High、DeepSeek-V4-Flash High 和 Fable 5.1 Medium 生成可运行交互资产的表现。"
tags:
  - AI
  - SVG
  - Three.js
  - 可视化
categories:
  - 模型测试
series:
  - 模型能力测试
series_order: 1
---

{{< lead >}}
我想测试的不是“模型会不会画一只鸟”，而是它能不能把一个听起来很离谱的需求拆成可验证的工程对象：一只鹈鹕真的在骑自行车。
{{< /lead >}}

这篇文章用同一组提示做两步测试：先让模型生成 **2D SVG 动画**，再让它把同一个命题升级成 **Three.js 3D 场景**。目前纳入对照的模型有三个：

```text
Opus 5 High
DeepSeek-V4-Flash High
Fable 5.1 Medium
```

这里不急着给模型排名。更重要的是先把测试对象、演示入口和验收标准固定下来。只有提示和验收规则稳定，后面继续加入其他模型时，比较才不会变成主观印象。

## 测试命题

两段提示保持一致：

```text
创建一个 html，内容是 svg 绘制一个鹈鹕骑自行车的 2d 动画。

编写 three.js 代码，将其变为 3d 资产，搭配适宜的环境和光照。
```

这个命题看起来像玩笑，但对模型其实很刁钻。

第一，鹈鹕骑车不能只靠静态造型骗过去。只要腿、脚踏、车轮和路面各动各的，画面马上就会穿帮。

第二，2D 到 3D 不是“把 SVG 换成 WebGL”。模型需要重新处理体积、相机、光照、空间关系、环境层次和交互方式。

所以我把它拆成两步：

```text
Step 1: 2D SVG 动画
        验证角色、车辆、背景和运动约束能否组织成一个可运行页面。

Step 2: 3D Three.js 场景
        验证同一动作命题能否迁移到空间资产、光照和交互里。
```

## 演示目录

每个模型都保留两个单文件 HTML：一个 2D，一个 3D。2D 版本主要看 SVG 造型和运动同步；3D 版本主要看空间建模、光照、相机和交互。

| 模型 | 配置 | 2D SVG | 3D Three.js |
| --- | --- | --- | --- |
| Opus 5 | High | [打开 2D](opus-5-high-2d.html) | [打开 3D](opus-5-high-3d.html) |
| DeepSeek-V4-Flash | High | [打开 2D](deepseek-v4-flash-high-2d.html) | [打开 3D](deepseek-v4-flash-high-3d.html) |
| Fable 5.1 | Medium | [打开 2D](fable-5-1-medium-2d.html) | [打开 3D](fable-5-1-medium-3d.html) |

3D 页面会加载 Three.js。不同模型生成的版本使用的 CDN 和 Three.js 版本不完全一致，所以如果 3D 页面空白，优先检查浏览器控制台和网络请求。

## Opus 5 High

Opus 5 High 的 2D 版本比较强调“骑行系统”本身：速度滑块、踏板、腿部、车轮和路面滚动围绕同一个节奏联动。3D 版本则把命题扩展成黄昏海边公路，包含相机控制、光照、雾、路面和布景循环。

{{< button href="opus-5-high-2d.html" target="_blank" rel="noopener noreferrer" >}}打开 Opus 5 High 2D{{< /button >}}

<iframe
  src="opus-5-high-2d.html"
  title="Opus 5 High 生成的鹈鹕骑自行车 2D SVG 动画"
  loading="lazy"
  style="width:100%; aspect-ratio:16 / 10; border:0; border-radius:12px; overflow:hidden; background:#0e2229;">
</iframe>

{{< button href="opus-5-high-3d.html" target="_blank" rel="noopener noreferrer" >}}打开 Opus 5 High 3D{{< /button >}}

<iframe
  src="opus-5-high-3d.html"
  title="Opus 5 High 生成的鹈鹕骑自行车 3D Three.js 场景"
  loading="lazy"
  style="width:100%; aspect-ratio:16 / 10; border:0; border-radius:12px; overflow:hidden; background:#0e2229;">
</iframe>

## DeepSeek-V4-Flash High

DeepSeek-V4-Flash High 的 2D 版本是纯 SVG 循环动画，界面里提供暂停和速度切换。3D 版本使用 Three.js module import 和 OrbitControls，页面中也做了依赖加载失败提示。

{{< button href="deepseek-v4-flash-high-2d.html" target="_blank" rel="noopener noreferrer" >}}打开 DeepSeek-V4-Flash High 2D{{< /button >}}

<iframe
  src="deepseek-v4-flash-high-2d.html"
  title="DeepSeek-V4-Flash High 生成的鹈鹕骑自行车 2D SVG 动画"
  loading="lazy"
  style="width:100%; aspect-ratio:16 / 10; border:0; border-radius:12px; overflow:hidden; background:#0e2229;">
</iframe>

{{< button href="deepseek-v4-flash-high-3d.html" target="_blank" rel="noopener noreferrer" >}}打开 DeepSeek-V4-Flash High 3D{{< /button >}}

<iframe
  src="deepseek-v4-flash-high-3d.html"
  title="DeepSeek-V4-Flash High 生成的鹈鹕骑自行车 3D Three.js 场景"
  loading="lazy"
  style="width:100%; aspect-ratio:16 / 10; border:0; border-radius:12px; overflow:hidden; background:#0e2229;">
</iframe>

## Fable 5.1 Medium

Fable 5.1 Medium 的 2D 版本更像一个轻量舞台：画面结构短小，主体识别和循环运动比较直接。3D 版本同样使用 Three.js module import 和 OrbitControls，整体代码规模更小，便于快速观察模型如何压缩实现。

{{< button href="fable-5-1-medium-2d.html" target="_blank" rel="noopener noreferrer" >}}打开 Fable 5.1 Medium 2D{{< /button >}}

<iframe
  src="fable-5-1-medium-2d.html"
  title="Fable 5.1 Medium 生成的鹈鹕骑自行车 2D SVG 动画"
  loading="lazy"
  style="width:100%; aspect-ratio:16 / 10; border:0; border-radius:12px; overflow:hidden; background:#0e2229;">
</iframe>

{{< button href="fable-5-1-medium-3d.html" target="_blank" rel="noopener noreferrer" >}}打开 Fable 5.1 Medium 3D{{< /button >}}

<iframe
  src="fable-5-1-medium-3d.html"
  title="Fable 5.1 Medium 生成的鹈鹕骑自行车 3D Three.js 场景"
  loading="lazy"
  style="width:100%; aspect-ratio:16 / 10; border:0; border-radius:12px; overflow:hidden; background:#0e2229;">
</iframe>

## 验收清单

这类测试不适合只看截图。最低限度要把页面跑起来看。

```text
2D:
- 页面能直接打开
- SVG 场景正常显示
- 鹈鹕、车、脚踏和背景关系清楚
- 速度控制、暂停或循环动画能工作
- 脚、踏板、车轮和路面滚动尽量保持同步

3D:
- Three.js 成功加载时出现 WebGL 场景
- Three.js 加载失败时有明确提示，或至少能从控制台定位
- 鹈鹕、自行车和环境都有空间关系
- 拖动、缩放或自动环绕等相机交互可用
- 窗口 resize 后画面比例正常
```

这套验收关注的是“能否运行”和“动作是否可信”。它不评价代码是否适合生产复用，也不把单个案例当作完整模型能力结论。

## 观察方式

后续我会按同一张表补充观察，而不是每加一个模型就重写标准。

| 观察维度 | 看什么 |
| --- | --- |
| 角色识别 | 是否一眼能看出是鹈鹕，而不是普通鸟 |
| 骑行动作 | 腿、脚踏、曲柄、车轮是否同节奏 |
| 工程完整度 | 页面是否单文件可运行，控制项是否有效 |
| 2D 到 3D 迁移 | 是否保留动作约束，并补上体积、相机和光照 |
| 失败处理 | 依赖加载失败、浏览器不支持时是否容易定位 |

目前这篇先作为多模型演示入口和测试方法记录。真正的结论要等更多模型、更多提示约束和更稳定的评分表补齐后再下。
