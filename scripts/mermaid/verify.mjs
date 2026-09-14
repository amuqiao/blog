#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";

const rootDir = path.resolve(import.meta.dirname, "../..");

const openShortcode = /\{\{[<%]\s*mermaid(?:\s+[^}]*)?\s*[>%]\}\}/;
const closeShortcode = /\{\{[<%]\s*\/mermaid\s*[>%]\}\}/;

function usage() {
  console.log(`用法:
  node scripts/mermaid/verify.mjs [path...]

说明:
  无参数时扫描 content/posts 下的 Markdown 文件。
  可传入一个或多个 Markdown 文件或目录。
  只验证 Hugo mermaid shortcode，不处理普通 markdown 代码围栏。
`);
}

function toRepoPath(filePath) {
  return path.relative(rootDir, filePath) || ".";
}

async function collectMarkdownFiles(targetPath) {
  const absolutePath = path.resolve(rootDir, targetPath);
  if (!existsSync(absolutePath)) {
    throw new Error(`路径不存在：${targetPath}`);
  }

  const stats = statSync(absolutePath);
  if (stats.isFile()) {
    if (!/\.(md|markdown)$/i.test(absolutePath)) {
      throw new Error(`不是 Markdown 文件：${targetPath}`);
    }
    return [absolutePath];
  }

  if (!stats.isDirectory()) {
    throw new Error(`不支持的路径类型：${targetPath}`);
  }

  const files = [];
  await walkMarkdownDirectory(absolutePath, files);
  return files;
}

async function walkMarkdownDirectory(directory, files) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if ([".git", "node_modules", "public", "resources", ".data"].includes(entry.name)) {
        continue;
      }
      await walkMarkdownDirectory(entryPath, files);
    } else if (entry.isFile() && /\.(md|markdown)$/i.test(entry.name)) {
      files.push(entryPath);
    }
  }
}

function extractMermaidBlocks(filePath) {
  const source = readFileSync(filePath, "utf8");
  const lines = source.split(/\r?\n/);
  const blocks = [];
  let current = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;

    if (!current) {
      const openMatch = line.match(openShortcode);
      const closeMatch = line.match(closeShortcode);

      if (closeMatch && (!openMatch || closeMatch.index < openMatch.index)) {
        throw new Error(`${toRepoPath(filePath)}:${lineNumber} 发现未匹配的 mermaid 结束 shortcode`);
      }

      if (!openMatch) {
        continue;
      }

      const afterOpen = line.slice(openMatch.index + openMatch[0].length);
      const inlineClose = afterOpen.match(closeShortcode);

      current = {
        filePath,
        startLine: lineNumber,
        lines: [],
      };

      if (inlineClose) {
        current.lines.push(afterOpen.slice(0, inlineClose.index));
        pushBlock(blocks, current);
        current = null;
      } else {
        current.lines.push(afterOpen);
      }

      continue;
    }

    const closeMatch = line.match(closeShortcode);
    if (!closeMatch) {
      current.lines.push(line);
      continue;
    }

    current.lines.push(line.slice(0, closeMatch.index));
    pushBlock(blocks, current);
    current = null;
  }

  if (current) {
    throw new Error(`${toRepoPath(current.filePath)}:${current.startLine} mermaid shortcode 未闭合`);
  }

  return blocks;
}

function pushBlock(blocks, block) {
  const content = block.lines.join("\n").trim();
  if (!content) {
    throw new Error(`${toRepoPath(block.filePath)}:${block.startLine} mermaid 内容为空`);
  }

  blocks.push({
    ...block,
    content,
  });
}

async function verifyBlock(mermaid, block) {
  try {
    await mermaid.parse(block.content);
  } catch (error) {
    throw new Error(`${toRepoPath(block.filePath)}:${block.startLine} mermaid 语法错误\n${formatMermaidError(error)}`);
  }
}

function formatMermaidError(error) {
  return String(error?.message || error);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("-h") || args.includes("--help") || args.includes("help")) {
    usage();
    return;
  }

  const targets = args.length > 0 ? args : ["content/posts"];
  const fileLists = await Promise.all(targets.map((target) => collectMarkdownFiles(target)));
  const files = [...new Set(fileLists.flat())].sort();
  const blocks = files.flatMap((filePath) => extractMermaidBlocks(filePath));

  if (blocks.length === 0) {
    console.log(`未发现 mermaid shortcode：${targets.join(", ")}`);
    return;
  }

  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;

  const { default: mermaid } = await import("mermaid");

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
  });

  for (const block of blocks) {
    await verifyBlock(mermaid, block);
  }

  console.log(`Mermaid 验证通过：${blocks.length} 个图，${files.length} 个 Markdown 文件。`);
}

main().catch((error) => {
  console.error(`错误：${error.message}`);
  process.exit(1);
});
