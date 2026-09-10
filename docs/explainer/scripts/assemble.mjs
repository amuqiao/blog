#!/usr/bin/env node
/**
 * 装配：把 .data/explainer/<slug>/parts/ 下的片段注入骨架，产出单文件交互页。
 *
 *   node docs/explainer/scripts/assemble.mjs <slug>
 *
 * 骨架必须包含三个占位符：
 *   /*__PARTS_CSS__* /      注入所有 <stem>.css
 *   <!--__PARTS_HTML__-->   注入所有 <stem>.html
 *   /*__PARTS_JS__* /       注入所有 <stem>.js
 *
 * 只装配 html/css/js 三件齐备的分组，缺件的会被跳过并列出——
 * 这样多个作者并行写作时，随时可以对已完成的部分装配验证，不必等全部交付。
 */

import fs from "node:fs/promises";
import path from "node:path";
import { requireSlug, paths, readManifest, readText, exists, rel, head, ok, warn, die } from "./lib.mjs";

const slug = requireSlug(process.argv[2]);
const P = paths(slug);
const manifest = await readManifest(slug);

const EXTS = ["html", "css", "js"];
const ready = [];
const partial = [];

for (const g of manifest.groups) {
  const found = {};
  for (const ext of EXTS) {
    const f = path.join(P.parts, `${g.stem}.${ext}`);
    if (await exists(f)) found[ext] = f;
  }
  const missing = EXTS.filter((e) => !found[e]);
  if (missing.length) partial.push(`${g.stem}（缺 ${missing.join(" / ")}）`);
  else ready.push({ ...g, files: found });
}

if (!ready.length) die("没有任何三件齐备的分组，无法装配。");

const chunk = async (f, stem, ext) =>
  `\n/* ==== ${stem}.${ext} ==== */\n` + (await readText(f)).trim();
const htmlChunk = async (f, stem) =>
  `\n<!-- ==== ${stem}.html ==== -->\n` + (await readText(f)).trim();

const css = (await Promise.all(ready.map((g) => chunk(g.files.css, g.stem, "css")))).join("\n");
const js = (await Promise.all(ready.map((g) => chunk(g.files.js, g.stem, "js")))).join("\n");
const html = (await Promise.all(ready.map((g) => htmlChunk(g.files.html, g.stem)))).join("\n");

let out = await readText(P.skeleton);
const slots = [
  ["/*__PARTS_CSS__*/", css],
  ["<!--__PARTS_HTML__-->", html],
  ["/*__PARTS_JS__*/", js],
];
for (const [marker, body] of slots) {
  if (!out.includes(marker)) die(`骨架缺少占位符 ${marker}`);
  out = out.replace(marker, () => body);
}

await fs.mkdir(path.dirname(P.html), { recursive: true });
await fs.writeFile(P.html, out, "utf8");

head(`装配完成 → ${rel(P.html)}`);
ok(`分组 ${ready.length} / ${manifest.groups.length}：${ready.map((g) => g.stem).join(", ")}`);
if (partial.length) warn(`跳过未齐备：${partial.join("；")}`);
ok(`${(out.length / 1024).toFixed(1)}K 字符 · ${(Buffer.byteLength(out, "utf8") / 1024).toFixed(0)} KB`);
