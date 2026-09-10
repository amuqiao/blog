#!/usr/bin/env node

import { access, link, open, readFile, readdir, realpath, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";
import OpenAI from "openai";

import { plainExcerpt, extractHtmlSkeleton, SKELETON_LIMITS } from "./source.mjs";

const DEFAULT_TEXT_MODEL = "gpt-4.1";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_QUALITY = "high";
const OUTPUT_SIZE = "2048x1152";
const OUTPUT_WIDTH = 2048;
const OUTPUT_HEIGHT = 1152;
const VALID_QUALITIES = new Set(["low", "medium", "high", "auto"]);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STYLES_FILE = path.join(SCRIPT_DIR, "styles.json");
const MAX_HTML_FILES = 8;
const MAX_HTML_BYTES = 2 * 1024 * 1024;

/*
 * 这几条是正确性，不交给文本模型决定：它一旦自作主张删掉「no readable text」，
 * 出来的图会满是乱码字符，白花一次钱。脚本在文本模型的产出之后无条件追加。
 */
const INVARIANTS = [
  "Composition: wide 16:9 landscape, primary subject centered in a generous safe area so responsive cropping preserves the meaning.",
  "Constraints: no readable text, no letters, no numbers, no logos, no trademarks, no watermark, no decorative dashboard, no meaningless charts. Depict technically meaningful relationships rather than generic atmosphere.",
].join("\n");

function usage() {
  console.log(`用法:
  ./run.sh blog cover <slug> [options]

作用:
  两段生成文章封面。先让文本模型把文章信息写成图片提示词，再交给生图模型出图。
  图片写入 content/posts/<slug>/cover.png，本次提示词与全部模型参数写入同目录
  cover-prompt.txt，便于复现。
  若 static/posts/<slug>/ 下有 HTML 交互页，会一并抽取其标题层级与每节导语作为输入：
  这类文章的正文真源在交互页里，index.md 只有导语和 iframe。

风格:
  预设放在可插拔的数据文件 scripts/cover/styles.json，增删改风格不需要改代码。
  三种来源，优先级从高到低：
    --style <name>        使用预设；名字写错直接报错并列出可选值
    --style-text <text>   临时指定画风，不入库
    都不传                 由文本模型自选画风，选了什么会记进存档

选项:
  --style <name>       预设名；传 list 查看全部预设。
  --style-text <text>  临时画风描述。
  --prompt <text>      补充画面要求，附加在文章信息之后。
  --quality <level>    low、medium、high 或 auto，默认 ${DEFAULT_QUALITY}。
  --text-model <name>  写提示词的模型，默认 ${DEFAULT_TEXT_MODEL}。
  --image-model <name> 出图的模型，默认 ${DEFAULT_IMAGE_MODEL}。
  --styles-file <path> 预设数据文件，默认 scripts/cover/styles.json。
  --out <path>         图片输出路径；存档同目录同名，扩展名换成 -prompt.txt。
  --json               结果以 JSON 打印到 stdout，便于程序解析。
  --force              覆盖已有图片和存档。
  --dry-run            只跑文本模型看提示词，不出图、不写文件；会打印画面构思，可在出图前判断是否抓住主题。
  -h, --help           显示帮助。

示例:
  ./run.sh blog cover my-post
  ./run.sh blog cover my-post --style list
  ./run.sh blog cover my-post --style flat-vector --quality low --force
  ./run.sh blog cover my-post --style-text "胶片颗粒的黑白纪实" --dry-run
  ./run.sh blog cover my-post --json

环境变量:
  OPENAI_API_KEY       实际生成时必须设置，不会写入仓库。`);
}

function fail(message) {
  console.error(`错误：${message}`);
  process.exit(1);
}

function takeValue(args, option) {
  const value = args.shift();
  if (value === undefined || value.startsWith("--")) {
    fail(`${option} 缺少参数。`);
  }
  return value;
}

function parseArgs(argv) {
  const args = [...argv];
  if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
    usage();
    process.exit(args.length === 0 ? 2 : 0);
  }

  const options = {
    slug: args.shift(),
    prompt: "",
    style: "",
    styleText: "",
    quality: DEFAULT_QUALITY,
    textModel: DEFAULT_TEXT_MODEL,
    imageModel: DEFAULT_IMAGE_MODEL,
    stylesFile: DEFAULT_STYLES_FILE,
    out: "",
    json: false,
    force: false,
    dryRun: false,
  };

  while (args.length > 0) {
    const option = args.shift();
    switch (option) {
      case "--prompt":
        options.prompt = takeValue(args, option);
        break;
      case "--style":
        options.style = takeValue(args, option);
        break;
      case "--style-text":
        options.styleText = takeValue(args, option);
        break;
      case "--quality":
        options.quality = takeValue(args, option);
        break;
      case "--text-model":
        options.textModel = takeValue(args, option);
        break;
      case "--image-model":
        options.imageModel = takeValue(args, option);
        break;
      case "--styles-file":
        options.stylesFile = path.resolve(takeValue(args, option));
        break;
      case "--out":
        options.out = path.resolve(takeValue(args, option));
        break;
      case "--json":
        options.json = true;
        break;
      case "--force":
        options.force = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "-h":
      case "--help":
        usage();
        process.exit(0);
        break;
      default:
        fail(`未知参数：${option}`);
    }
  }

  if (!options.slug || options.slug.includes("/") || options.slug.includes("..") || /\s/.test(options.slug)) {
    fail("文章 slug 不能为空，且不能包含 /、.. 或空白字符。");
  }
  if (!VALID_QUALITIES.has(options.quality)) {
    fail(`不支持的质量档位：${options.quality}`);
  }
  if (options.style && options.styleText) {
    fail("--style 与 --style-text 不能同时使用。");
  }
  if (options.prompt.length > 2000) {
    fail("--prompt 不能超过 2000 个字符。");
  }
  if (options.styleText.length > 2000) {
    fail("--style-text 不能超过 2000 个字符。");
  }

  return options;
}

async function loadStyles(stylesFile) {
  let raw;
  try {
    raw = await readFile(stylesFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") fail(`风格数据文件不存在：${stylesFile}`);
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`风格数据文件不是合法 JSON：${stylesFile}\n${error.message}`);
  }
  const styles = parsed.styles;
  if (!styles || typeof styles !== "object" || Array.isArray(styles)) {
    fail(`风格数据文件缺少对象字段 styles：${stylesFile}`);
  }
  for (const [name, entry] of Object.entries(styles)) {
    if (!entry || typeof entry.label !== "string" || typeof entry.direction !== "string") {
      fail(`风格预设 ${name} 必须同时有字符串字段 label 和 direction：${stylesFile}`);
    }
  }
  if (Object.keys(styles).length === 0) {
    fail(`风格数据文件里一个预设都没有：${stylesFile}`);
  }
  return styles;
}

function listStyles(styles, stylesFile) {
  console.log(`风格预设（来自 ${stylesFile}）：\n`);
  for (const [name, entry] of Object.entries(styles)) {
    console.log(`  ${name}`);
    console.log(`    ${entry.label}`);
    console.log(`    ${entry.direction}\n`);
  }
}

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

/*
 * 「Markdown 壳 + HTML 交互页」那类文章的正文真源在 static/posts/<slug>/ 下，
 * index.md 只剩 front matter、导语和 iframe。只读 Markdown 摘要拿到的信号太少，
 * 模型据此画出来的封面会文不对题，所以把同名静态目录里的交互页一并读进来。
 */
async function readPostHtmlSkeletons({ rootDir, slug, show }) {
  const staticRoot = path.join(rootDir, "static", "posts");
  const staticDir = path.join(staticRoot, slug);

  let entries;
  try {
    entries = await readdir(staticDir, { withFileTypes: true });
  } catch (error) {
    // 普通文章本来就没有同名静态目录，这是正常路径，不是错误
    if (error.code === "ENOENT") return { files: [], skeleton: null };
    throw error;
  }

  const [staticRootReal, staticDirReal] = await Promise.all([realpath(staticRoot), realpath(staticDir)]);
  if (staticDirReal !== path.join(staticRootReal, slug)) {
    fail(`文章静态目录不能是指向其他目录的符号链接：${show(staticDir)}`);
  }

  // dirent 的 isFile 基于 lstat，符号链接自然落不进来，无需另做判断
  const names = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => entry.name)
    .sort();
  if (names.length === 0) return { files: [], skeleton: null };
  if (names.length > MAX_HTML_FILES) {
    fail(
      `${show(staticDir)} 下有 ${names.length} 个 HTML，超过 ${MAX_HTML_FILES} 个的上限；`
      + "这么多入口拼出来的骨架只会稀释主题，请改用 --prompt 手工描述画面。",
    );
  }

  // 多个交互页平分总预算，但每份不低于下限，免得文件一多每份都短到没有信息
  const perFileBudget = Math.max(
    Math.floor(SKELETON_LIMITS.totalChars / names.length),
    SKELETON_LIMITS.minPerFile,
  );
  const files = [];
  const documents = [];
  for (const name of names) {
    const displayPath = path.join(staticDir, name);
    const info = await stat(path.join(staticDirReal, name));
    if (info.size > MAX_HTML_BYTES) {
      fail(
        `交互页过大：${show(displayPath)}，${info.size} 字节，上限 ${MAX_HTML_BYTES} 字节；`
        + "请改用 --prompt 手工描述画面。",
      );
    }
    const html = await readFile(path.join(staticDirReal, name), "utf8");
    files.push(show(displayPath));
    // 保留文件名：pelican 那种一篇文章六个 demo 的情况，各自的标题不是一回事
    documents.push({ file: name, ...extractHtmlSkeleton(html, perFileBudget) });
  }
  return {
    files,
    skeleton: { documents, truncated: documents.some((document) => document.truncated) },
  };
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map(String).join("、");
  return tags ? String(tags) : "未设置";
}

/*
 * 块的先后就是优先级声明：页首的主问题和核心隐喻排在章节列表之前，
 * 而章节列表必须带降级标注 —— 十几个章节标题拼起来又是一份零件清单，
 * 不明说「这只是背景」，模型就会把它当成一份要逐项作画的清单。
 * 所有面向模型的英文措辞都留在这里，source.mjs 只吐结构化数据。
 */
function buildBrief({ title, description, tags, excerpt, htmlSkeleton, styleDirection, extraPrompt }) {
  const lines = [
    `Article title: ${title}`,
    `Article description: ${description || "未设置"}`,
    `Article tags: ${tags}`,
    `Article excerpt: ${excerpt}`,
  ];
  if (htmlSkeleton) {
    const multiple = htmlSkeleton.documents.length > 1;
    const openings = [];
    const outline = [];
    for (const document of htmlSkeleton.documents) {
      const label = multiple ? `[${document.file}] ` : "";
      const head = [document.title, ...document.opening].filter(Boolean).join(" — ");
      if (head) openings.push(`${label}${head}`);
      for (const section of document.sections) {
        const parts = [section.heading, section.lead, section.out].filter(Boolean);
        if (parts.length > 0) outline.push(`- ${label}${parts.join(" | ")}`);
      }
    }
    if (openings.length > 0) {
      lines.push(
        "Driving question and core metaphor (from the interactive page): the lines below state the"
        + " question this article exists to answer and the central metaphor it answers with. This is"
        + " what the cover must depict. Everything else in this brief is context for it.\n"
        + openings.join("\n"),
      );
    }
    if (outline.length > 0) {
      lines.push(
        "Section outline (background only): this is a table of contents, not a shot list. Do not"
        + " illustrate the sections one by one, and do not turn this list into a ring, row or grid of"
        + " icons, panels, dials or labelled modules. Read it only to know what ground the article"
        + " covers, then draw one single scene.\n"
        // 没有页首块时不能说「回到上面的 driving question」——上面没有。
        // 那样等于只给模型留下一份被否定的清单，恰好推回我们要防的清单式构图。
        + (openings.length > 0
          ? "Go back to the driving question above: that is the scene.\n"
          : "This article states no driving question. Infer the single problem all these"
            + " sections exist to solve, and draw that one problem.\n")
        + outline.join("\n"),
      );
      if (htmlSkeleton.truncated) {
        lines.push(
          "Note: the section outline above was truncated to fit a length budget, so later sections"
          + " and some section conclusions are missing.",
        );
      }
    }
  }
  if (styleDirection) {
    lines.push(`Requested visual style: ${styleDirection}`);
  } else {
    lines.push(
      "Requested visual style: none given. Choose one yourself. Pick something specific and"
      + " not obvious — avoid the default dark neon 3D tech look unless it genuinely fits."
      + " Describe the look by its visual characteristics (medium, palette, lighting, texture,"
      + " background value); never name a living artist, studio, or brand.",
    );
  }
  if (extraPrompt) lines.push(`Additional direction from the author: ${extraPrompt}`);
  return lines.join("\n");
}

/*
 * concept 必须排在 schema 第一个字段：json_object 是自回归生成，字段顺序就是思考顺序。
 * 先用中文把画面说死，再展开成英文提示词，等于在一次调用里完成「先收束再作画」。
 */
const SYSTEM_PROMPT = [
  "You write image-generation prompts for the cover illustration of a technical blog post.",
  "Return a JSON object with exactly three string fields, emitted in exactly this order:",
  '  "concept": 中文一句话。这张图画的是什么、画面主体是谁、正在发生什么动作，一次说死。',
  '  "style_label": a short Chinese label naming the visual style you used, for the author\'s records.',
  '  "prompt": the English image prompt, one paragraph, no markdown, no bullet points.',
  "",
  "concept comes first because prompt must be a faithful expansion of it: the prompt may not introduce a",
  "second subject or a second scene that concept did not already name. Settle the picture in concept, then",
  "render that same picture in English.",
  "",
  "Rules for concept:",
  "1. One scene, one subject, one action that is happening right now. Never a diptych, triptych, grid,",
  "   collage, exploded-parts catalogue, component overview, or architecture diagram.",
  "2. Never turn the article's terminology into a ring — or a row, or a set of cells — of separate icons,",
  "   panels, dials, gauges, or labelled modules. 「文章列了 N 个部件就画 N 个符号」 is the default failure",
  "   mode of technical cover art, and it is the one thing these instructions exist to forbid: it produces",
  "   a parts display that says nothing about what the article is arguing.",
  "3. When the article enumerates many parts, the thing to draw is not that list. Draw the single problem",
  "   that makes every one of those parts necessary.",
  "4. Prefer a concrete physical metaphor carrying a visible causal action — reaching in and taking,",
  "   routing, collapsing, hitting a target, choosing one path over another — over an arrangement of",
  "   abstract shapes.",
  "",
  "Worked examples on unrelated topics; copy the reasoning, never the subject matter or the look:",
  "  Topic: database indexing.",
  "    Bad concept: 四个带标签的图标并排，分别代表 B 树、哈希索引、位图索引、全表扫描。",
  "    Good concept: 一整面墙的档案抽屉前，一只手径直拉开唯一正确的那一格，其余抽屉全部紧闭。",
  "  Topic: cache invalidation.",
  "    Bad concept: 六个表盘围成一圈，分别写着 TTL、LRU、写穿透、雪崩、击穿、预热。",
  "    Good concept: 送奶工正把新鲜牛奶放进门口的奶箱，取奶的人却已经伸手拿走了昨天那瓶结块的旧奶。",
  "",
  "The prompt must also spell out the visual style concretely: medium, palette, lighting, texture and",
  "background value.",
  "Do not mention composition, aspect ratio, or forbidden elements — those are appended separately.",
  // 只说「不要复述约束」是不够的：模型会照样描述一个带字的书脊，
  // 和脚本随后追加的 no readable text 直接打架。必须说明约束对内容本身生效。
  "Those appended constraints still bind what you invent. The finished image must contain no readable",
  "text, letters, numbers, logos or watermarks, so never describe a label, title, sign, caption,",
  "inscription or spine bearing a word — not even in another language.",
  "Convey identity by depicting the thing itself, never by naming it: draw the animal, not its name;",
  "draw the tool, not a tag reading its name.",
  "Never name a living artist, studio, or brand in the prompt.",
].join("\n");

/*
 * 文本模型即使被告知「图里不能有可读文字」，仍会写出 labelled / lettering / the word 'cat'
 * 这类描述，与脚本随后追加的 no readable text 直接打架。实测两次里错一次。
 * 矛盾必须在出图之前拦下——出图才是花钱的那一步。命中即报错，不改写、不重试。
 */
const TEXT_BEARING = [
  /\blabell?ed\b/i,
  /\blettering\b/i,
  /\binscription\b/i,
  /\bcaptioned?\b/i,
  /\bsignage\b/i,
  /\btypography\b/i,
  /\bcalligraphy\b/i,
  /\bhandwrit(ing|ten)\b/i,
  /\bthe word\b/i,
  /\bspelling\b/i,
];

function assertNoRenderedText(prompt, textModel) {
  for (const pattern of TEXT_BEARING) {
    const hit = pattern.exec(prompt);
    if (!hit) continue;
    const start = Math.max(0, hit.index - 70);
    const context = prompt.slice(start, hit.index + hit[0].length + 70).replace(/\s+/g, " ");
    fail(
      `文本模型 ${textModel} 写出了带文字的画面（命中「${hit[0]}」），`
      + "与「图中不得出现可读文字」的硬约束冲突，已在出图前停下。\n"
      + `上下文：…${context}…\n`
      + "重跑一次即可；若反复命中，说明 SYSTEM_PROMPT 的约束还不够狠。",
    );
  }
}

async function writePrompt(client, { textModel, brief }) {
  const completion = await client.chat.completions.create({
    model: textModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: brief },
    ],
    response_format: { type: "json_object" },
    temperature: 1,
  });
  const content = completion.choices?.[0]?.message?.content;
  if (!content) fail(`文本模型 ${textModel} 未返回内容。`);

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    fail(`文本模型 ${textModel} 返回的不是合法 JSON：\n${content}`);
  }
  if (typeof parsed.concept !== "string" || !parsed.concept.trim()) {
    fail(`文本模型 ${textModel} 返回的 JSON 缺少非空的 concept 字段：\n${content}`);
  }
  if (typeof parsed.prompt !== "string" || !parsed.prompt.trim()) {
    fail(`文本模型 ${textModel} 返回的 JSON 缺少非空的 prompt 字段：\n${content}`);
  }
  if (typeof parsed.style_label !== "string" || !parsed.style_label.trim()) {
    fail(`文本模型 ${textModel} 返回的 JSON 缺少非空的 style_label 字段：\n${content}`);
  }
  const prompt = parsed.prompt.trim();
  assertNoRenderedText(prompt, textModel);
  return {
    concept: parsed.concept.trim(),
    prompt,
    styleLabel: parsed.style_label.trim(),
  };
}

function isPng(buffer) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length < 45 || !signature.every((byte, index) => buffer[index] === byte)) return false;

  let offset = 8;
  let chunkIndex = 0;
  let hasImageData = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const nextOffset = offset + 12 + length;
    if (nextOffset > buffer.length) return false;

    if (chunkIndex === 0) {
      if (type !== "IHDR" || length !== 13) return false;
      if (buffer.readUInt32BE(offset + 8) !== OUTPUT_WIDTH) return false;
      if (buffer.readUInt32BE(offset + 12) !== OUTPUT_HEIGHT) return false;
    } else if (type === "IDAT") {
      hasImageData = true;
    } else if (type === "IEND") {
      return length === 0 && hasImageData && nextOffset === buffer.length;
    }

    offset = nextOffset;
    chunkIndex += 1;
  }
  return false;
}

function localTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absolute = Math.abs(offset);
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    + `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    + `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

/*
 * 存档格式是「# 开头的单行注释」。带换行的值会把某一行撑成多行，从第二行起就没有 #
 * 前缀，和下面的正文提示词混在一起。concept 和 styleLabel 来自模型，extraPrompt 与
 * 内嵌它的 replayCommand 来自 --prompt——shell 里传真实换行完全合法。四个都要折平。
 */
function flatten(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function buildRecord(result) {
  const lines = [
    `# 生成时间 ${localTimestamp()}`,
    `# 文本模型 ${result.textModel}`,
    `# 生图模型 ${result.imageModel} · ${OUTPUT_SIZE} · quality=${result.quality}`,
    `# 风格来源 ${result.styleSourceLabel}`,
    `# 画面构思 ${flatten(result.concept)}`,
    `# 风格 ${flatten(result.styleLabel)}`,
  ];
  // 没有交互页就不写这一行，而不是拿占位值凑一行
  if (result.htmlSources.length > 0) {
    lines.push(`# 交互页 ${result.htmlSources.join("、")}`);
  }
  lines.push(
    `# 补充要求 ${result.extraPrompt ? flatten(result.extraPrompt) : "无"}`,
    `# 复现 ${flatten(result.replayCommand)}`,
    "",
    result.prompt,
    "",
  );
  return lines.join("\n");
}

/*
 * 先写同目录临时文件再落位：--force 走 rename 覆盖，否则走 link 让并发写入撞上 EEXIST。
 * 失败时清理临时文件，清理本身再出错就一并抛出，不吞。
 */
async function commitFile({ dir, outputPath, data, force, show, label }) {
  const temporaryPath = path.join(dir, `.${label}-${randomUUID()}.tmp`);
  let temporaryExists = false;
  let temporaryHandle;
  try {
    temporaryHandle = await open(temporaryPath, "wx");
    temporaryExists = true;
    await temporaryHandle.writeFile(data);
    await temporaryHandle.close();
    temporaryHandle = undefined;
    if (force) {
      await rename(temporaryPath, outputPath);
      temporaryExists = false;
    } else {
      try {
        await link(temporaryPath, outputPath);
      } catch (error) {
        if (error.code === "EEXIST") {
          throw new Error(`文件已存在：${show(outputPath)}；如需覆盖请添加 --force。`);
        }
        throw error;
      }
      await unlink(temporaryPath);
      temporaryExists = false;
    }
  } catch (error) {
    const failures = [error];
    if (temporaryHandle) {
      try {
        await temporaryHandle.close();
      } catch (closeError) {
        failures.push(closeError);
      }
    }
    if (temporaryExists) {
      try {
        await unlink(temporaryPath);
      } catch (cleanupError) {
        failures.push(cleanupError);
      }
    }
    if (failures.length > 1) {
      throw new AggregateError(failures, "文件写入失败，且临时文件关闭或清理失败。");
    }
    throw error;
  }
}

function promptPathFor(imagePath) {
  const dir = path.dirname(imagePath);
  const stem = path.basename(imagePath, path.extname(imagePath));
  return path.join(dir, `${stem}-prompt.txt`);
}

function shellQuote(value) {
  return `"${String(value).replace(/(["\\$`])/g, "\\$1")}"`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(SCRIPT_DIR, "..", "..");
  // --out 可以指向仓库外；那种情况下相对路径只会更难读，直接打绝对路径
  const show = (target) => {
    const relative = path.relative(rootDir, target);
    return relative && !relative.startsWith("..") ? relative : target;
  };
  const styles = await loadStyles(options.stylesFile);

  if (options.style === "list") {
    listStyles(styles, show(options.stylesFile));
    return;
  }
  if (options.style && !Object.hasOwn(styles, options.style)) {
    fail(`不支持的风格预设：${options.style}；可选 ${Object.keys(styles).join("、")}，或用 --style list 查看。`);
  }

  const contentRoot = path.join(rootDir, "content", "posts");
  const postDir = path.join(contentRoot, options.slug);
  const articlePath = path.join(postDir, "index.md");

  if (!(await pathExists(articlePath))) {
    fail(`文章不存在：${show(articlePath)}`);
  }
  const [contentRootReal, postDirReal, articleReal] = await Promise.all([
    realpath(contentRoot),
    realpath(postDir),
    realpath(articlePath),
  ]);
  if (postDirReal !== path.join(contentRootReal, options.slug)) {
    fail(`文章页面包不能是指向其他目录的符号链接：${show(postDir)}`);
  }
  if (articleReal !== path.join(postDirReal, "index.md")) {
    fail(`文章入口不能是符号链接：${show(articlePath)}`);
  }

  const outputPath = options.out || path.join(postDirReal, "cover.png");
  const promptPath = promptPathFor(outputPath);
  const outputDir = path.dirname(outputPath);
  if (!options.dryRun && !options.force) {
    for (const existing of [outputPath, promptPath]) {
      if (await pathExists(existing)) {
        fail(`文件已存在：${show(existing)}；如需覆盖请添加 --force。`);
      }
    }
  }

  const source = await readFile(articlePath, "utf8");
  const article = matter(source);
  const title = typeof article.data.title === "string" ? article.data.title.trim() : "";
  const excerpt = plainExcerpt(article.content);
  if (!title) fail("文章 front matter 缺少 title。");
  if (!excerpt) fail("文章正文为空，无法生成封面提示词。");
  const htmlInput = await readPostHtmlSkeletons({ rootDir, slug: options.slug, show });

  let styleDirection = "";
  let styleSource = "model";
  let styleSourceLabel = "文本模型自选";
  let replayStyleArgs = "";
  if (options.style) {
    styleDirection = styles[options.style].direction;
    styleSource = `preset:${options.style}`;
    styleSourceLabel = `预设 ${options.style}（${styles[options.style].label}）`;
    replayStyleArgs = ` --style ${options.style}`;
  } else if (options.styleText) {
    styleDirection = options.styleText;
    styleSource = "custom";
    styleSourceLabel = "命令行临时指定";
    replayStyleArgs = ` --style-text ${shellQuote(options.styleText)}`;
  }

  const brief = buildBrief({
    title,
    description: typeof article.data.description === "string" ? article.data.description.trim() : "",
    tags: normalizeTags(article.data.tags),
    excerpt,
    htmlSkeleton: htmlInput.skeleton,
    styleDirection,
    extraPrompt: options.prompt,
  });

  if (!process.env.OPENAI_API_KEY) {
    fail("环境变量 OPENAI_API_KEY 未设置。");
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  if (!options.json) {
    console.log(`文章：${options.slug}`);
    // 多打这一行，是为了让人一眼看出这次的输入不只有 index.md
    if (htmlInput.files.length > 0) console.log(`交互页：${htmlInput.files.join("、")}`);
    console.log(`文本模型：${options.textModel}`);
    console.log(`生图模型：${options.imageModel}，${OUTPUT_SIZE}，${options.quality}`);
    console.log(`风格来源：${styleSourceLabel}`);
    console.log(`输出：${show(outputPath)}`);
    console.log(`存档：${show(promptPath)}`);
    console.log("正在调用文本模型撰写提示词...");
  }

  const written = await writePrompt(client, { textModel: options.textModel, brief });
  const prompt = `${written.prompt}\n${INVARIANTS}`;

  const replayCommand = `./run.sh blog cover ${options.slug}`
    + replayStyleArgs
    + (options.prompt ? ` --prompt ${shellQuote(options.prompt)}` : "")
    + ` --quality ${options.quality} --force`;

  const result = {
    slug: options.slug,
    image: show(outputPath),
    promptFile: show(promptPath),
    textModel: options.textModel,
    imageModel: options.imageModel,
    size: OUTPUT_SIZE,
    quality: options.quality,
    styleSource,
    styleSourceLabel,
    concept: written.concept,
    styleLabel: written.styleLabel,
    extraPrompt: options.prompt,
    htmlSources: htmlInput.files,
    replayCommand,
    prompt,
  };

  if (options.dryRun) {
    if (options.json) {
      console.log(JSON.stringify({ ...result, dryRun: true, image: null, promptFile: null }, null, 2));
    } else {
      console.log(`风格：${written.styleLabel}`);
      console.log(`构思：${written.concept}`);
      console.log("\n最终提示词：\n");
      console.log(prompt);
    }
    return;
  }

  if (!options.json) {
    console.log(`风格：${written.styleLabel}`);
    console.log(`构思：${written.concept}`);
    console.log("正在调用生图模型，可能需要几分钟...");
  }
  const response = await client.images.generate({
    model: options.imageModel,
    prompt,
    size: OUTPUT_SIZE,
    quality: options.quality,
    output_format: "png",
  });
  const encoded = response.data?.[0]?.b64_json;
  if (!encoded) fail("Image API 未返回图片数据。");
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    fail("Image API 返回了无效的 Base64 图片数据。");
  }
  const image = Buffer.from(encoded, "base64");
  if (!isPng(image)) fail(`Image API 返回的数据不是有效的 ${OUTPUT_SIZE} PNG。`);

  // 图片是花钱换来的主产物，先落位；存档紧随其后，失败直接报错不兜底。
  await commitFile({ dir: outputDir, outputPath, data: image, force: options.force, show, label: "cover" });
  await commitFile({ dir: outputDir, outputPath: promptPath, data: buildRecord(result), force: options.force, show, label: "cover-prompt" });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`封面已生成：${result.image}`);
    console.log(`提示词已存档：${result.promptFile}`);
  }
}

main().catch((error) => {
  console.error(`错误：${error.message}`);
  process.exit(1);
});
