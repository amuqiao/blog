#!/usr/bin/env node
/**
 * 一文读懂交互页工具链 · 共享基础设施
 *
 * 约定的路径关系（slug 一一对应，见 AGENTS.md）：
 *   content/posts/<slug>/index.md              发布壳
 *   static/posts/<slug>/interactive.html       交互页（正文真源）
 *   .data/explainer/<slug>/                    工作目录（gitignore，不发布）
 *     skeleton.html                            骨架，含三个注入占位符
 *     manifest.json                            分组契约：谁负责哪些 section、用什么前缀
 *     parts/<stem>.{html,css,js}               各组片段
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function requireSlug(slug) {
  if (!slug) die("缺少 slug 参数。用法示例：node docs/explainer/scripts/verify.mjs my-post");
  if (!SLUG_RE.test(slug)) die(`slug 只允许小写字母、数字和连字符，收到：${slug}`);
  return slug;
}

export function paths(slug) {
  return {
    slug,
    md: path.join(ROOT_DIR, "content", "posts", slug, "index.md"),
    html: path.join(ROOT_DIR, "static", "posts", slug, "interactive.html"),
    publicHtml: path.join(ROOT_DIR, "public", "posts", slug, "interactive.html"),
    publicIndex: path.join(ROOT_DIR, "public", "posts", slug, "index.html"),
    sitemap: path.join(ROOT_DIR, "public", "sitemap.xml"),
    searchIndex: path.join(ROOT_DIR, "public", "index.json"),
    work: path.join(ROOT_DIR, ".data", "explainer", slug),
    skeleton: path.join(ROOT_DIR, ".data", "explainer", slug, "skeleton.html"),
    manifest: path.join(ROOT_DIR, ".data", "explainer", slug, "manifest.json"),
    parts: path.join(ROOT_DIR, ".data", "explainer", slug, "parts"),
  };
}

export const rel = (p) => path.relative(ROOT_DIR, p);

export async function readText(p) {
  try {
    return await fs.readFile(p, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") die(`文件不存在：${rel(p)}`);
    throw err;
  }
}

export async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

export async function readManifest(slug) {
  const P = paths(slug);
  const raw = await readText(P.manifest);
  let m;
  try {
    m = JSON.parse(raw);
  } catch (err) {
    die(`manifest.json 不是合法 JSON：${err.message}`);
  }
  if (!Array.isArray(m.groups) || !m.groups.length) die("manifest.json 缺少非空的 groups 数组");
  m.groups.forEach((g, i) => {
    if (!g.stem) die(`groups[${i}] 缺少 stem`);
    if (!g.prefix) die(`groups[${i}] 缺少 prefix`);
    if (!Array.isArray(g.sections) || !g.sections.length) die(`groups[${i}] 缺少非空的 sections`);
  });
  return m;
}

/** Playwright 从仓库根的 node_modules 加载，脚本放在哪都能跑 */
export async function chromium() {
  const entry = path.join(ROOT_DIR, "node_modules", "playwright", "index.mjs");
  if (!(await exists(entry))) {
    die("未找到 playwright。先在仓库根执行 npm install。");
  }
  return (await import(pathToFileURL(entry).href)).chromium;
}

export const fileUrl = (p) => pathToFileURL(p).href;

/** 打开交互页并把懒加载全部预热；关掉平滑滚动，否则截图与断言会和滚动动画抢时序 */
export async function openPage(browser, target, opts = {}) {
  const page = await browser.newPage({
    viewport: opts.viewport || { width: 1280, height: 940 },
    deviceScaleFactor: opts.deviceScaleFactor || 1,
  });
  await page.addInitScript(() => {
    const s = document.createElement("style");
    s.textContent = "html{scroll-behavior:auto !important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s));
  });
  if (opts.onPage) opts.onPage(page);
  await page.goto(fileUrl(target), { waitUntil: "load" });
  await page.waitForTimeout(500);
  if (opts.warm !== false) {
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.6;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 80));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1200);
  }
  return page;
}

/* ── 输出 ── */
export const ok = (s) => console.log(`  \x1b[32m✓\x1b[0m ${s}`);
export const bad = (s) => console.log(`  \x1b[31m✗\x1b[0m ${s}`);
export const warn = (s) => console.log(`  \x1b[33m!\x1b[0m ${s}`);
export const head = (s) => console.log(`\n\x1b[1m${s}\x1b[0m`);

export function die(msg) {
  console.error(`\x1b[31m错误：\x1b[0m ${msg}`);
  process.exit(2);
}

/** 汇总：有任一失败则以非 0 退出，便于串进 CI 或 && 链 */
export function finish(failures, okMsg) {
  if (failures.length) {
    head(`不通过（${failures.length} 项）`);
    failures.forEach((f) => bad(f));
    process.exit(1);
  }
  head(okMsg || "全部通过");
  process.exit(0);
}
