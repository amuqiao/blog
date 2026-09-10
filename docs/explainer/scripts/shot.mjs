#!/usr/bin/env node
/**
 * 截图。排版问题几乎只有看图才发现：标签重叠、canvas 只填一角、宽表撑破。
 *
 *   node docs/explainer/scripts/shot.mjs <slug> <out.png> [selector] [--full] [--width=360]
 *
 * 两个必须做的事：关掉平滑滚动（否则和 scrollTo 抢时序，出假象），
 * 以及先全页滚一遍预热懒加载（否则截到空容器）。lib.openPage 已经都做了。
 */

import path from "node:path";
import { requireSlug, paths, exists, rel, chromium, openPage, head, ok, die } from "./lib.mjs";

const [, , slugArg, outArg, ...rest] = process.argv;
const slug = requireSlug(slugArg);
if (!outArg) die("缺少输出路径。用法：node docs/explainer/scripts/shot.mjs <slug> <out.png> [selector]");

const selector = rest.find((a) => !a.startsWith("--"));
const full = rest.includes("--full");
const widthArg = rest.find((a) => a.startsWith("--width="));
const width = widthArg ? Number(widthArg.split("=")[1]) : 1280;

const P = paths(slug);
if (!(await exists(P.html))) die(`未找到 ${rel(P.html)}`);

const browser = await chromium();
const b = await browser.launch();
const page = await openPage(b, P.html, { viewport: { width, height: 940 }, deviceScaleFactor: 2 });

const out = path.resolve(outArg);
if (full) {
  await page.screenshot({ path: out, fullPage: true });
} else if (selector) {
  const el = await page.$(selector);
  if (!el) { await b.close(); die(`未找到元素 ${selector}`); }
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await el.screenshot({ path: out });
} else {
  await page.screenshot({ path: out });
}
await b.close();
head("截图完成");
ok(`${out}　宽度 ${width}px${full ? " · 整页" : selector ? ` · ${selector}` : ""}`);
