#!/usr/bin/env node
/**
 * 静态契约检查（不开浏览器）。
 *
 *   node docs/explainer/scripts/lint.mjs <slug>
 *
 * 分两段：
 *   A 片段契约   多人并行写作时唯一能防互撞的东西（需要 manifest.json + parts/）
 *   B 成品静态   离线性、重复 id、标签平衡、发布壳的 front matter
 *
 * 设计原则：能用脚本查的坑就不要写进文档。references/pitfalls.md 里
 * 只保留机器查不了的那些。往这里加断言，比往文档里加条目有用。
 */

import path from "node:path";
import { requireSlug, paths, readManifest, readText, exists, rel, head, ok, bad, warn, finish } from "./lib.mjs";

const slug = requireSlug(process.argv[2]);
const P = paths(slug);
const fails = [];
const F = (m) => { fails.push(m); bad(m); };

/*
 * 第三项 = 成品里允许出现几处：
 *   0     成品也不许有
 *   1     骨架自身可以有一处（DOMContentLoaded 引导、唯一的 <script> 容器）
 *   null  只查片段，不查成品
 */
const FORBIDDEN_JS = [
  [/\blocalStorage\b/, "localStorage —— iframe sandbox 无 allow-same-origin 时会抛 SecurityError，整节挂掉", 0],
  [/\bsessionStorage\b/, "sessionStorage —— 同上", 0],
  [/document\.cookie/, "document.cookie —— 同上", 0],
  [/\bfetch\s*\(/, "fetch —— 单文件离线页不得发起网络请求", 0],
  [/XMLHttpRequest/, "XMLHttpRequest —— 同上", 0],
  [/\bimport\s*\(/, "动态 import() —— 同上", 0],
  [/Math\.random\s*\(/, "Math.random() —— 页面每次加载必须逐像素一致，随机一律走带 seed 的 PRNG", 0],
  [/new Date\s*\(/, "new Date() —— 同上", 0],
  [/document\.addEventListener\(\s*['"]DOMContentLoaded/, "DOMContentLoaded —— 章节应走骨架的 ready() 钩子", 1],
  [/window\.onload/, "window.onload —— 同上", 0],
  [/<script/i, "<script 标签不应出现在 .js 片段里", null],
];

const EXTERNAL_HTML = [
  [/<link\b/i, "<link> 外部样式"],
  [/<script[^>]+\bsrc=/i, "<script src> 外部脚本"],
  [/@import/i, "@import"],
  [/url\(\s*['"]?https?:/i, "url(http…) 外部资源"],
  [/<img\b/i, "<img> —— 图形必须程序化生成（inline SVG / canvas）"],
  [/data:image/i, "base64 图片 —— 同上"],
];

/* ═══════════ A 段：片段契约 ═══════════ */
if (await exists(P.manifest)) {
  head("A 片段契约");
  const manifest = await readManifest(slug);
  const ns = manifest.ns;
  if (!ns) F("manifest.json 缺少 ns（命名空间前缀，如 \"sd\"）");

  const allSections = manifest.groups.flatMap((g) => g.sections);
  const dupSec = allSections.filter((s, i) => allSections.indexOf(s) !== i);
  if (dupSec.length) F(`多个分组认领了同一个 section：${[...new Set(dupSec)].join(", ")}`);

  const seenPrefix = new Set();
  for (const g of manifest.groups) {
    if (seenPrefix.has(g.prefix)) F(`前缀重复：${g.prefix}`);
    seenPrefix.add(g.prefix);
    if (ns && !g.prefix.startsWith(`${ns}-`)) F(`${g.stem} 的前缀 ${g.prefix} 未以 ${ns}- 开头`);
  }

  for (const g of manifest.groups) {
    const html = (await exists(path.join(P.parts, `${g.stem}.html`)))
      ? await readText(path.join(P.parts, `${g.stem}.html`)) : null;
    const css = (await exists(path.join(P.parts, `${g.stem}.css`)))
      ? await readText(path.join(P.parts, `${g.stem}.css`)) : null;
    const js = (await exists(path.join(P.parts, `${g.stem}.js`)))
      ? await readText(path.join(P.parts, `${g.stem}.js`)) : null;
    if (html === null && css === null && js === null) { warn(`${g.stem}：尚未交付`); continue; }
    if (html === null) F(`${g.stem}：缺 .html`);
    if (css === null) F(`${g.stem}：缺 .css`);
    if (js === null) F(`${g.stem}：缺 .js`);

    if (html !== null) {
      const secs = [...html.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]);
      const missing = g.sections.filter((s) => !secs.includes(s));
      const extra = secs.filter((s) => !g.sections.includes(s));
      if (missing.length) F(`${g.stem}：缺 section ${missing.join(", ")}`);
      if (extra.length) F(`${g.stem}：越界 section ${extra.join(", ")}`);
      const wanted = g.sections.filter((s) => secs.includes(s)).join(",");
      if (secs.join(",") !== wanted) F(`${g.stem}：section 顺序与 manifest 不一致（${secs.join(", ")}）`);
      for (const t of ["<html", "<head", "<body", "<!DOCTYPE"]) {
        if (html.includes(t)) F(`${g.stem}：片段不应包含 ${t}`);
      }
      for (const [re, label] of EXTERNAL_HTML) {
        if (re.test(html)) F(`${g.stem}.html：${label}`);
      }
      for (const m of html.matchAll(/\sid="([^"]+)"/g)) {
        const id = m[1];
        if (g.sections.includes(id)) continue;
        if (!id.startsWith(g.prefix)) F(`${g.stem}.html：id #${id} 未加前缀 ${g.prefix}`);
      }
    }

    if (css !== null) {
      const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
      for (const m of stripped.matchAll(/(^|[,}])\s*([^{}@][^{}]*?)\{/g)) {
        for (const raw of m[2].split(",")) {
          const b = raw.trim();
          if (!b || b.startsWith("@") || b === "from" || b === "to" || /^\d+%/.test(b)) continue;
          const scoped = b.includes(`.${g.prefix}`) || b.includes(`#${g.prefix}`) ||
            g.sections.some((s) => b.includes(`#${s}`));
          if (scoped) continue;
          const classes = [...b.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((x) => x[1]);
          const ids = [...b.matchAll(/#([A-Za-z0-9_-]+)/g)].map((x) => x[1]);
          const foreign = classes.filter((c) => !ns || !c.startsWith(`${ns}-`));
          if (foreign.length) F(`${g.stem}.css：裸选择器会污染其它章节 "${b}"（未加前缀：${foreign.map((c) => "." + c).join(" ")}）`);
          for (const id of ids) F(`${g.stem}.css：id 选择器 #${id} 未加前缀 "${b}"`);
          if (!classes.length && !ids.length) F(`${g.stem}.css：无 class/id 限定的元素选择器 "${b}"`);
        }
      }
      if (/@import|url\(\s*['"]?https?:/i.test(css)) F(`${g.stem}.css：含外部资源`);
    }

    if (js !== null) {
      const code = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      for (const [re, label] of FORBIDDEN_JS) {
        if (re.test(code)) F(`${g.stem}.js：${label}`);
      }
      for (const m of code.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)) {
        F(`${g.stem}.js：写了全局 window.${m[1]}`);
      }
      if (ns) {
        const NS = ns.toUpperCase();
        for (const m of code.matchAll(new RegExp(`\\b${NS}\\.([A-Za-z_$][\\w$]*)\\s*=`, "g"))) {
          F(`${g.stem}.js：覆盖了共享命名空间 ${NS}.${m[1]}`);
        }
      }
      const first = code.trim().slice(0, 12);
      if (!first.startsWith("(function") && !first.startsWith("(()")) {
        F(`${g.stem}.js：未以 IIFE 开头（实际以 "${first.replace(/\n/g, " ")}" 开头）`);
      }
      for (const m of code.matchAll(/<(pattern|marker|clipPath|mask)[^>]*\sid=["']([^"']+)/gi)) {
        if (!m[2].startsWith(g.prefix)) F(`${g.stem}.js：SVG defs id #${m[2]} 未加前缀 ${g.prefix}（跨图冲突的经典来源）`);
      }
    }
  }
  if (!fails.length) ok("片段契约全部通过");
} else {
  head("A 片段契约");
  warn(`未找到 ${rel(P.manifest)}，跳过片段检查`);
}

/* ═══════════ B 段：成品静态检查 ═══════════ */
if (await exists(P.html)) {
  head("B 成品静态检查");
  const s = await readText(P.html);

  for (const [re, label] of EXTERNAL_HTML) {
    const n = (s.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g")) || []).length;
    if (n) F(`成品含 ${label}（${n} 处）`);
  }
  for (const [re, label, allowance] of FORBIDDEN_JS) {
    if (allowance === null) continue;   // 只针对片段的规则
    const n = (s.match(new RegExp(re.source, "gi")) || []).length;
    if (n > allowance) F(`成品含 ${label}（${n} 处，允许 ${allowance}）`);
  }

  /*
   * 结构类检查必须先剥掉 <script>/<style>/注释：
   * 脚本注释里出现一句 "用原生 <details> 承载…" 就会让标签计数假报警。
   */
  const markup = s
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = [...new Set(ids.filter((i, n) => ids.indexOf(i) !== n))];
  if (dup.length) F(`标记里重复 id：${dup.join(", ")}`); else ok(`标记 id ${ids.length} 个，无重复（JS 动态生成的由 verify 在运行时查）`);

  // <div> 被写成 </p> 这类错误肉眼看不出，但会把后面整块内容吞进上一个容器
  for (const tag of ["div", "p", "section", "details", "table", "ul", "ol"]) {
    const open = (markup.match(new RegExp(`<${tag}\\b`, "gi")) || []).length;
    const close = (markup.match(new RegExp(`</${tag}>`, "gi")) || []).length;
    if (open !== close) F(`<${tag}> 开闭不平衡：${open} 开 / ${close} 闭`);
  }

  /*
   * 逐像素绘制必须走 raw 模式，否则 putImageData 无视 ctx.scale(dpr)，画面只填左上角。
   * 两点讲究：
   * 一是先剥注释——骨架里解释这条规则的注释本身就含 "putImageData"，不剥会自己报自己；
   * 二是只要求「至少有一个 raw」，不要求全部。一篇里既有逐像素画布又有矢量画布是正常的，
   *   静态扫描无法把某次 putImageData 绑定到某个 canvas，要求全部 raw 只会逼作者乱传参。
   */
  const codeNoComments = s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  if (/putImageData/.test(codeNoComments)) {
    const calls = (codeNoComments.match(/\.canvas\s*\(/g) || []).length;
    const raws = (codeNoComments.match(/raw:\s*true/g) || []).length;
    if (!raws) F(`用到 putImageData，但 ${calls} 处 canvas 创建里没有一处传 raw:true`);
    else ok(`canvas ${calls} 处，其中 ${raws} 处声明 raw 模式（用到 putImageData）`);
  }
  if (!fails.length) ok("成品静态检查通过");
} else {
  head("B 成品静态检查");
  warn(`未找到 ${rel(P.html)}，跳过`);
}

/* ═══════════ C 段：发布壳 ═══════════ */
if (await exists(P.md)) {
  head("C 发布壳 front matter");
  const md = await readText(P.md);
  const fm = md.split(/^---\s*$/m)[1] || "";
  const date = (fm.match(/^date:\s*(.+)$/m) || [])[1]?.trim();
  if (!date) F("缺少 date");
  else if (!/[+-]\d{2}:\d{2}$|Z$/.test(date)) {
    F(`date 缺少时区偏移（当前 "${date}"）—— buildFuture=false 且未配 timeZone 时，裸日期按 UTC 解析，晚上写的文章会被当成未来文静默跳过，且构建仍返回 0。请写成 2026-09-10T20:00:00+08:00 这种形式`);
  } else ok(`date 带时区偏移：${date}`);

  const draft = (fm.match(/^draft:\s*(.+)$/m) || [])[1]?.trim();
  if (draft === "true") F("draft: true —— blog verify 不带 -D，会静默不产出");
  else ok(`draft: ${draft ?? "未设置（默认 false）"}`);

  if (!md.includes(`src="interactive.html"`)) warn("发布壳未内嵌 interactive.html 的 iframe");
  if (!/sandbox="allow-scripts"/.test(md)) warn("iframe 未设 sandbox=\"allow-scripts\"");
} else {
  head("C 发布壳 front matter");
  warn(`未找到 ${rel(P.md)}，跳过`);
}

finish(fails, "lint 全部通过");
