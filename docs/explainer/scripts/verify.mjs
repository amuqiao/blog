#!/usr/bin/env node
/**
 * 运行时验证（开无头浏览器）。
 *
 *   node docs/explainer/scripts/verify.mjs <slug>
 *
 * 「离线可打开」必须是证明出来的，不是声称的：这里真的加载页面、
 * 拦截所有请求、点遍所有控件、再在窄屏和减弱动效下各跑一遍。
 */

import { requireSlug, paths, exists, rel, chromium, openPage, fileUrl, head, ok, bad, warn, finish } from "./lib.mjs";

const slug = requireSlug(process.argv[2]);
const P = paths(slug);
if (!(await exists(P.html))) { console.error(`未找到 ${rel(P.html)}，先跑 assemble.mjs`); process.exit(2); }

const fails = [];
const F = (m) => { fails.push(m); bad(m); };
const browser = await chromium();
const b = await browser.launch();

/* ── 1 离线性 / 运行时错误 / 控件遍历 ── */
head("1 离线性与运行时");
{
  const consoleErrors = [], pageErrors = [], external = [], failed = [];
  const page = await openPage(b, P.html, {
    onPage: (p) => {
      p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
      p.on("pageerror", (e) => pageErrors.push(e.message));
      p.on("request", (r) => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
      p.on("requestfailed", (r) => failed.push(`${r.url()} :: ${r.failure()?.errorText}`));
    },
  });

  // 点遍所有可交互控件，把事件处理器里的错误逼出来
  for (const el of await page.$$('button, [role="tab"], summary, input[type="radio"], input[type="checkbox"]')) {
    try { await el.click({ timeout: 700, force: true }); } catch { /* 不可见/被遮挡的跳过 */ }
  }
  for (const el of await page.$$('input[type="range"]')) {
    for (const frac of [0, 0.5, 1]) {
      try {
        await el.evaluate((n, f) => {
          const min = Number(n.min || 0), max = Number(n.max || 100);
          n.value = String(min + (max - min) * f);
          n.dispatchEvent(new Event("input", { bubbles: true }));
          n.dispatchEvent(new Event("change", { bubbles: true }));
        }, frac);
      } catch { /* ignore */ }
    }
  }
  await page.waitForTimeout(700);

  const stat = await page.evaluate(() => {
    const secs = [...document.querySelectorAll("main > section[id]")].map((s) => s.id);
    const anchors = [...document.querySelectorAll('nav a[href^="#"], details a[href^="#"]')]
      .map((a) => a.getAttribute("href").slice(1));
    const canvases = [...document.querySelectorAll("canvas")];
    const sliders = [...document.querySelectorAll('input[type=range]')];
    const named = (el) => !!(el.getAttribute("aria-label") || el.getAttribute("title") ||
      (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest("label"));
    return {
      sections: secs,
      brokenAnchors: [...new Set(anchors)].filter((id) => !secs.includes(id)),
      canvas: canvases.length,
      canvasNoLabel: canvases.filter((c) => !c.getAttribute("aria-label") && c.getAttribute("aria-hidden") !== "true").length,
      canvasNoReadout: canvases.filter((c) => {
        const box = c.closest("[class*=card]") || c.closest("section");
        return box && !box.querySelector('[role="status"], [class*=cap], [class*=rd]');
      }).length,
      sliders: sliders.length,
      slidersUnnamed: sliders.filter((s) => !named(s)).map((s) => s.id || "(no id)"),
      // 只报「读屏会念错」的：value 本身没出现在名称/邻近读数里，说明刻度经过换算
      slidersMismatch: sliders.filter((s) => {
        if (s.getAttribute("aria-valuetext")) return false;
        const box = s.closest("label") || s.closest("[class*=ctl]") || s.parentElement;
        const shown = ((s.getAttribute("aria-label") || "") + " " + (box ? box.textContent : "")).replace(/\s+/g, "");
        return !shown.includes(String(Number(s.value)));
      }).map((s) => s.id || s.className || "(no id)"),
      h1: document.querySelectorAll("h1").length,
      // 运行时查重复 id：能抓到 JS 动态生成的那些，静态扫标记看不见
      dupIds: (() => {
        const all = [...document.querySelectorAll("[id]")].map((e) => e.id);
        return [...new Set(all.filter((x, i) => all.indexOf(x) !== i))];
      })(),
      skip: !!document.querySelector('a[href^="#"][class*=skip]'),
      height: document.body.scrollHeight,
    };
  });
  await page.close();

  ok(`${stat.sections.length} 节 · 页面高度 ${stat.height}px`);
  if (consoleErrors.length) F(`console error ${consoleErrors.length} 条：${consoleErrors.slice(0, 3).join(" | ")}`); else ok("console error 0");
  if (pageErrors.length) F(`page error ${pageErrors.length} 条：${pageErrors.slice(0, 3).join(" | ")}`); else ok("page error 0");
  if (external.length) F(`外部请求 ${[...new Set(external)].join(", ")}`); else ok("外部请求 0");
  if (failed.length) F(`失败请求 ${failed.slice(0, 3).join(" | ")}`); else ok("失败请求 0");
  if (stat.brokenAnchors.length) F(`导航锚点指向不存在的 section：${stat.brokenAnchors.join(", ")}`); else ok("导航锚点全部命中");
  if (stat.canvasNoLabel) F(`${stat.canvasNoLabel} 个 canvas 既无 aria-label 也未标 aria-hidden`);
  if (stat.canvasNoReadout) F(`${stat.canvasNoReadout} 个 canvas 旁边没有文字读数 —— canvas 不能是信息的唯一载体`);
  if (stat.canvas) ok(`canvas ${stat.canvas} 个，均有标签与文字读数`);
  if (stat.slidersUnnamed.length) F(`滑杆缺可访问名称：${stat.slidersUnnamed.join(", ")}`);
  if (stat.slidersMismatch.length) warn(`滑杆刻度经过换算但没有 aria-valuetext，读屏会念原始 value：${stat.slidersMismatch.join(", ")}`);
  if (stat.sliders) ok(`滑杆 ${stat.sliders} 个，均有可访问名称`);
  if (stat.h1 !== 1) F(`<h1> 有 ${stat.h1} 个，应为 1`);
  if (stat.dupIds.length) F(`运行时重复 id：${stat.dupIds.join(", ")}`); else ok("运行时无重复 id");
  if (!stat.skip) warn("没有跳转正文链接 —— 侧栏导航长时键盘用户要按很多次 Tab");
}

/* ── 2 窄屏 ── */
head("2 窄屏 360×740");
{
  const page = await openPage(b, P.html, { viewport: { width: 360, height: 740 } });
  const r = await page.evaluate(() => {
    const de = document.documentElement, over = [];
    if (de.scrollWidth > de.clientWidth + 1) {
      document.querySelectorAll("main *").forEach((el) => {
        const box = el.getBoundingClientRect();
        if (box.right > de.clientWidth + 1) {
          let a = el.parentElement, scrolls = false;
          while (a) { if (/auto|scroll/.test(getComputedStyle(a).overflowX)) { scrolls = true; break; } a = a.parentElement; }
          if (!scrolls) over.push(`${el.tagName}.${String(el.className).slice(0, 24)} right=${Math.round(box.right)}`);
        }
      });
    }
    return { sw: de.scrollWidth, cw: de.clientWidth, over: [...new Set(over)].slice(0, 5) };
  });
  await page.close();
  if (r.over.length) F(`横向溢出 ${r.sw - r.cw}px：${r.over.join("；")}`);
  else ok(`无横向溢出（scrollWidth ${r.sw} / clientWidth ${r.cw}）`);
}

/* ── 3 减弱动效 ── */
head("3 prefers-reduced-motion");
{
  const page = await b.newPage({ viewport: { width: 1280, height: 940 } });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(fileUrl(P.html), { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({
    running: document.getAnimations().filter((a) => a.playState === "running").length,
    controls: document.querySelectorAll("button, input[type=range]").length,
  }));
  await page.close();
  if (r.running) F(`减弱动效下仍有 ${r.running} 个动画在跑`);
  else ok(`无自主动画在跑；控件仍有 ${r.controls} 个可用（减弱动效只能去掉运动，不能砍功能）`);
}

/* ── 4 真实文章页 + sandbox iframe ── */
head("4 文章页与 sandbox iframe");
if (await exists(P.publicIndex)) {
  const inner = [];
  const page = await b.newPage({ viewport: { width: 1280, height: 940 } });
  page.on("pageerror", (e) => inner.push(e.message));
  await page.goto(fileUrl(P.publicIndex), { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const frames = page.frames().filter((f) => f !== page.mainFrame());
  if (!frames.length) F("文章页里没有 iframe");
  else {
    const r = await frames[0].evaluate(() => ({
      sections: document.querySelectorAll("main > section[id]").length,
      // sandbox 无 allow-same-origin 时访问存储会抛异常；抛说明沙箱生效，不抛说明宿主没设 sandbox
      storageThrows: (() => { try { void window.localStorage; return false; } catch { return true; } })(),
    })).catch((e) => ({ error: String(e) }));
    if (r.error) F(`iframe 内部读取失败：${r.error}`);
    else {
      ok(`iframe 内 ${r.sections} 节可用`);
      if (r.storageThrows) ok("sandbox 生效且页面未触碰存储 API");
      else warn("iframe 未处于无 allow-same-origin 的 sandbox 下，存储类 API 的约束未被强制");
    }
  }
  if (inner.length) F(`嵌入态 page error：${inner.slice(0, 3).join(" | ")}`);
  await page.close();
} else {
  warn(`未找到 ${rel(P.publicIndex)}，先跑 ./run.sh blog build`);
}

/* ── 5 构建产物 ── */
head("5 构建产物（不能只看 exit code）");
{
  const items = [
    [P.publicIndex, "文章页"],
    [P.publicHtml, "交互页"],
  ];
  for (const [f, label] of items) {
    if (await exists(f)) ok(`${label} ${rel(f)}`);
    else F(`${label}缺失 ${rel(f)} —— 构建可能静默跳过了这篇（查 draft 与日期时区）`);
  }
  for (const [f, label] of [[P.sitemap, "sitemap"], [P.searchIndex, "搜索索引"]]) {
    if (!(await exists(f))) { warn(`${label} 不存在，跳过`); continue; }
    const { readFile } = await import("node:fs/promises");
    const txt = await readFile(f, "utf8");
    if (txt.includes(slug)) ok(`${label}已收录`);
    else F(`${label}未收录 ${slug}`);
  }
  if (await exists(P.publicHtml)) {
    const { readFile } = await import("node:fs/promises");
    const [a, c] = await Promise.all([readFile(P.html), readFile(P.publicHtml)]);
    if (a.equals(c)) ok("static ↔ public 逐字节一致（--minify 未触碰 static）");
    else F("static 与 public 下的交互页不一致");
  }
}

await b.close();
finish(fails, "verify 全部通过");
