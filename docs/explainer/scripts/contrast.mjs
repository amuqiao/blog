#!/usr/bin/env node
/**
 * 对比度检查（WCAG AA）。
 *
 *   node docs/explainer/scripts/contrast.mjs <slug>
 *
 * 关键在于背景色要沿祖先链做 alpha 合成。半透明的渐变/叠层如果被当成
 * 不透明色，会误报一大片 —— 我第一版就是这么误报了 20 处，实际是 0 处。
 */

import { requireSlug, paths, exists, rel, chromium, openPage, head, ok, bad, finish } from "./lib.mjs";

const slug = requireSlug(process.argv[2]);
const P = paths(slug);
if (!(await exists(P.html))) { console.error(`未找到 ${rel(P.html)}`); process.exit(2); }

const browser = await chromium();
const b = await browser.launch();
const page = await openPage(b, P.html);

const result = await page.evaluate(() => {
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  /*
   * 两种计算值格式都要认：
   *   rgb(250, 249, 245)              分量 0–255
   *   color(srgb 0.98 0.976 0.961)    分量 0–1，Chrome 对 color-mix() 的结果就返回这种
   * 只按第一种解析的话，浅色底会被读成近黑，整篇误报。
   */
  const parse = (s) => {
    const str = s || "";
    const m = str.match(/[\d.]+/g);
    if (!m) return null;
    const norm = /\bcolor\(/i.test(str);
    const v = m.slice(0, 3).map((x) => (norm ? Number(x) * 255 : Number(x)));
    return { v, a: m.length > 3 ? Number(m[3]) : 1 };
  };
  // 沿祖先链收集带 alpha 的背景，再从最外层往内合成
  const bgOf = (el) => {
    const stack = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) stack.push(c);
    }
    let base = parse(getComputedStyle(document.body).backgroundColor)?.v || [255, 255, 255];
    for (let i = stack.length - 1; i >= 0; i--) {
      const c = stack[i];
      base = [0, 1, 2].map((k) => c.v[k] * c.a + base[k] * (1 - c.a));
    }
    return base;
  };
  const ratio = (f, g) => {
    const a = lum(f), bb = lum(g), hi = Math.max(a, bb), lo = Math.min(a, bb);
    return (hi + 0.05) / (lo + 0.05);
  };

  const bad = [];
  const sel = "p,li,td,th,span,div,a,button,summary,code,h1,h2,h3,h4,label,figcaption";
  document.querySelectorAll(sel).forEach((el) => {
    const txt = (el.textContent || "").trim();
    if (!txt) return;
    // 只看自己直接承载文字的元素，避免父容器重复统计
    if (el.children.length && txt === [...el.children].map((c) => c.textContent).join("").trim()) return;
    const st = getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none" || Number(st.opacity) === 0) return;
    const fs = parseFloat(st.fontSize), bold = parseInt(st.fontWeight) >= 700;
    const need = (fs >= 24 || (fs >= 18.66 && bold)) ? 3 : 4.5;
    const fg = parse(st.color);
    if (!fg) return;
    const bg = bgOf(el);
    const r = ratio(fg.v, bg);
    if (r < need) {
      bad.push({
        text: txt.slice(0, 18), ratio: +r.toFixed(2), need, fontSize: +fs.toFixed(1),
        fg: `rgb(${fg.v.map(Math.round).join(",")})`, bg: `rgb(${bg.map(Math.round).join(",")})`,
        cls: String(el.className).slice(0, 30),
      });
    }
  });
  const seen = new Set(), uniq = [];
  for (const x of bad) { const k = `${x.cls}|${x.fg}|${x.bg}`; if (!seen.has(k)) { seen.add(k); uniq.push(x); } }
  return { total: bad.length, uniq };
});

await b.close();

head("对比度 WCAG AA");
const fails = [];
if (!result.total) ok("全部达标（正文 4.5:1，大字 3:1）");
else {
  for (const x of result.uniq) {
    const m = `${x.ratio}:1（需 ${x.need}）  ${x.fontSize}px  ${x.fg} on ${x.bg}  .${x.cls}  「${x.text}」`;
    fails.push(m); bad(m);
  }
  console.log(`\n  共 ${result.total} 个元素不达标，去重后 ${result.uniq.length} 组`);
}
finish(fails, "对比度全部达标");
