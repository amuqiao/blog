#!/usr/bin/env node

import { access, link, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";
import OpenAI from "openai";

const DEFAULT_MODEL = "gpt-image-2";
const DEFAULT_QUALITY = "high";
const OUTPUT_SIZE = "2048x1152";
const VALID_QUALITIES = new Set(["low", "medium", "high", "auto"]);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function usage() {
  console.log(`用法:
  ./run.sh blog cover <slug> [options]

作用:
  读取 content/posts/<slug>/index.md，调用 OpenAI Image API，生成同目录 cover.png。

选项:
  --prompt <text>    补充画面要求。
  --quality <level>  low、medium、high 或 auto，默认 ${DEFAULT_QUALITY}。
  --force            覆盖已有 cover.png。
  --dry-run          只打印请求信息和最终提示词，不调用 API。
  -h, --help         显示帮助。

示例:
  ./run.sh blog cover my-post
  ./run.sh blog cover my-post --prompt "突出请求排队" --force

环境变量:
  OPENAI_API_KEY     实际生成时必须设置，不会写入仓库。`);
}

function fail(message) {
  console.error(`错误：${message}`);
  process.exit(1);
}

function takeValue(args, option) {
  const value = args.shift();
  if (!value || value.startsWith("--")) {
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
    quality: DEFAULT_QUALITY,
    force: false,
    dryRun: false,
  };

  while (args.length > 0) {
    const option = args.shift();
    switch (option) {
      case "--prompt":
        options.prompt = takeValue(args, option);
        break;
      case "--quality":
        options.quality = takeValue(args, option);
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
  if (options.prompt.length > 2000) {
    fail("--prompt 不能超过 2000 个字符。");
  }

  return options;
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

function plainExcerpt(markdown) {
  return markdown
    .replace(/\{\{<\s*mermaid\s*>\}\}[\s\S]*?\{\{<\s*\/mermaid\s*>\}\}/gi, " ")
    .replace(/\{\{[<%][\s\S]*?[>%]\}\}/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[[^\]]+\]\([^\)]+\)/g, " ")
    .replace(/[#>*_`|~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map(String).join("、");
  return tags ? String(tags) : "未设置";
}

function buildPrompt({ title, description, tags, excerpt, extraPrompt }) {
  return `Use case: editorial illustration for a technical personal blog cover
Asset type: responsive article card cover
Article title: ${title}
Article description: ${description || "未设置"}
Article tags: ${tags}
Article excerpt: ${excerpt}
Primary request: Create one polished visual concept that communicates the article's central technical problem and solution at a glance.
Style: sophisticated editorial technical illustration, crisp geometry, restrained professional detail, not a UI screenshot.
Composition: wide 16:9 landscape, primary subject centered in a generous safe area so responsive cropping preserves the meaning.
Constraints: no readable text, no letters, no numbers, no logos, no trademarks, no watermark, no decorative dashboard, no meaningless charts. Depict technically meaningful relationships rather than generic atmosphere.${extraPrompt ? `\nAdditional direction: ${extraPrompt}` : ""}`;
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
      if (buffer.readUInt32BE(offset + 8) !== 2048 || buffer.readUInt32BE(offset + 12) !== 1152) return false;
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(SCRIPT_DIR, "..", "..");
  const contentRoot = path.join(rootDir, "content", "posts");
  const postDir = path.join(contentRoot, options.slug);
  const articlePath = path.join(postDir, "index.md");

  if (!(await pathExists(articlePath))) {
    fail(`文章不存在：${path.relative(rootDir, articlePath)}`);
  }
  const [contentRootReal, postDirReal, articleReal] = await Promise.all([
    realpath(contentRoot),
    realpath(postDir),
    realpath(articlePath),
  ]);
  if (postDirReal !== path.join(contentRootReal, options.slug)) {
    fail(`文章页面包不能是指向其他目录的符号链接：${path.relative(rootDir, postDir)}`);
  }
  if (articleReal !== path.join(postDirReal, "index.md")) {
    fail(`文章入口不能是符号链接：${path.relative(rootDir, articlePath)}`);
  }
  const outputPath = path.join(postDirReal, "cover.png");
  if (!options.dryRun && !options.force && (await pathExists(outputPath))) {
    fail(`封面已存在：${path.relative(rootDir, outputPath)}；如需覆盖请添加 --force。`);
  }

  const source = await readFile(articlePath, "utf8");
  const article = matter(source);
  const title = typeof article.data.title === "string" ? article.data.title.trim() : "";
  const excerpt = plainExcerpt(article.content);
  if (!title) fail("文章 front matter 缺少 title。");
  if (!excerpt) fail("文章正文为空，无法生成封面提示词。");

  const prompt = buildPrompt({
    title,
    description: typeof article.data.description === "string" ? article.data.description.trim() : "",
    tags: normalizeTags(article.data.tags),
    excerpt,
    extraPrompt: options.prompt,
  });

  console.log(`文章：${options.slug}`);
  console.log(`模型：${DEFAULT_MODEL}`);
  console.log(`规格：${OUTPUT_SIZE}，${options.quality}`);
  console.log(`输出：${path.relative(rootDir, outputPath)}`);

  if (options.dryRun) {
    console.log("\n最终提示词：\n");
    console.log(prompt);
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    fail("环境变量 OPENAI_API_KEY 未设置。");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log("正在调用 OpenAI Image API，生成过程可能需要几分钟...");
  const response = await client.images.generate({
    model: DEFAULT_MODEL,
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

  const temporaryPath = path.join(postDirReal, `.cover-${randomUUID()}.tmp`);
  let temporaryExists = false;
  let temporaryHandle;
  try {
    temporaryHandle = await open(temporaryPath, "wx");
    temporaryExists = true;
    await temporaryHandle.writeFile(image);
    await temporaryHandle.close();
    temporaryHandle = undefined;
    if (options.force) {
      await rename(temporaryPath, outputPath);
      temporaryExists = false;
    } else {
      try {
        await link(temporaryPath, outputPath);
      } catch (error) {
        if (error.code === "EEXIST") {
          throw new Error(`封面已存在：${path.relative(rootDir, outputPath)}；如需覆盖请添加 --force。`);
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
      throw new AggregateError(failures, "封面写入失败，且临时文件关闭或清理失败。");
    }
    throw error;
  }

  console.log(`封面已生成：${path.relative(rootDir, outputPath)}`);
}

main().catch((error) => {
  console.error(`错误：${error.message}`);
  process.exit(1);
});
