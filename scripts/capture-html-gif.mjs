#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const defaults = {
  duration: 4,
  fps: 15,
  width: 800,
  height: 700,
  quality: 90,
  selector: ".stage",
  clock: "realtime",
  browser: "chrome",
  keepFrames: false,
};

function usage() {
  console.log(`用法:
  ./run.sh blog gif <input.html> [output.gif] [options]

示例:
  ./run.sh blog gif static/posts/pelican-bicycle-two-step-test/opus-5-high-2d.html
  ./run.sh blog gif static/posts/pelican-bicycle-two-step-test/opus-5-high-2d.html content/posts/pelican-bicycle-two-step-test/cover.gif

参数:
  input.html          要打开并截图的 HTML 文件。
  output.gif         输出 GIF；省略时，static/posts/<slug>/<name>.html 会输出到 content/posts/<slug>/cover.gif。

选项:
  --duration <秒>     动画时长，默认 4。
  --fps <帧率>        GIF 帧率，默认 15。
  --width <像素>      GIF 最大宽度，默认 800。
  --height <像素>     浏览器视口高度，默认 700。
  --quality <1-100>  gifski 质量，默认 90。
  --selector <CSS>   截图元素，默认 .stage。
  --clock <模式>      realtime 或 virtual，默认 realtime。
  --browser <浏览器>  chrome 或 chromium，默认 chrome。
  --keep-frames      保留临时 PNG 帧目录，便于排查。
  -h, --help         查看帮助。
`);
}

function parseArgs(argv) {
  const options = { ...defaults };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "-h" || arg === "--help" || arg === "help") {
      options.help = true;
      continue;
    }

    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const raw = arg.slice(2);
    const eq = raw.indexOf("=");
    const key = eq === -1 ? raw : raw.slice(0, eq);
    let value = eq === -1 ? undefined : raw.slice(eq + 1);

    if (key === "keep-frames") {
      options.keepFrames = true;
      continue;
    }

    if (value === undefined) {
      i += 1;
      value = argv[i];
    }

    if (value === undefined || value.startsWith("--")) {
      throw new Error(`选项缺少值：--${key}`);
    }

    switch (key) {
      case "duration":
        options.duration = Number(value);
        break;
      case "fps":
        options.fps = Number(value);
        break;
      case "width":
        options.width = Number(value);
        break;
      case "height":
        options.height = Number(value);
        break;
      case "quality":
        options.quality = Number(value);
        break;
      case "selector":
        options.selector = value;
        break;
      case "clock":
        options.clock = value;
        break;
      case "browser":
        options.browser = value;
        break;
      default:
        throw new Error(`未知选项：--${key}`);
    }
  }

  if (positional.length > 2) {
    throw new Error("位置参数过多。");
  }

  options.input = positional[0];
  options.output = positional[1];
  return options;
}

function assertNumber(name, value, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} 必须是 ${min} 到 ${max} 之间的数字。`);
  }
}

function validateOptions(options) {
  if (options.help) {
    return;
  }

  if (!options.input) {
    throw new Error("缺少 input.html。");
  }

  assertNumber("--duration", options.duration, 0.1, 60);
  assertNumber("--fps", options.fps, 1, 60);
  assertNumber("--width", options.width, 80, 4096);
  assertNumber("--height", options.height, 80, 4096);
  assertNumber("--quality", options.quality, 1, 100);

  if (!["virtual", "realtime"].includes(options.clock)) {
    throw new Error("--clock 只能是 virtual 或 realtime。");
  }

  if (!["chrome", "chromium"].includes(options.browser)) {
    throw new Error("--browser 只能是 chrome 或 chromium。");
  }

  if (!options.selector.trim()) {
    throw new Error("--selector 不能为空。");
  }
}

function defaultOutputPath(inputAbs) {
  const rel = path.relative(ROOT_DIR, inputAbs);
  const baseName = path.basename(inputAbs, path.extname(inputAbs));
  const parts = rel.split(path.sep);

  if (!rel.startsWith("..") && !path.isAbsolute(rel) && parts[0] === "static" && parts[1] === "posts" && parts.length >= 4) {
    return path.join(ROOT_DIR, "content", "posts", parts[2], "cover.gif");
  }

  return path.join(path.dirname(inputAbs), `${baseName}.gif`);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} 退出失败：${signal || code}`));
    });
  });
}

async function importPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(`缺少 Playwright 依赖。请先运行：npm install
原始错误：${error.message}`);
  }
}

async function assertInputFile(inputAbs) {
  const stat = await fs.stat(inputAbs);
  if (!stat.isFile()) {
    throw new Error(`输入路径不是文件：${inputAbs}`);
  }
  if (path.extname(inputAbs).toLowerCase() !== ".html") {
    throw new Error(`输入文件必须是 .html：${inputAbs}`);
  }
}

async function preparePage(page, inputAbs, options) {
  if (options.clock === "virtual") {
    await page.addInitScript(() => {
      let now = 0;
      let nextId = 1;
      const queue = new Map();

      Object.defineProperty(window.performance, "now", {
        configurable: true,
        value: () => now,
      });

      window.requestAnimationFrame = (callback) => {
        const id = nextId;
        nextId += 1;
        queue.set(id, callback);
        return id;
      };

      window.cancelAnimationFrame = (id) => {
        queue.delete(id);
      };

      window.__captureStep = (time) => {
        now = time;
        const callbacks = Array.from(queue.values());
        queue.clear();
        for (const callback of callbacks) {
          callback(now);
        }
      };
    });
  }

  await page.goto(pathToFileURL(inputAbs).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts?.ready);

  if (options.clock === "virtual") {
    await page.evaluate(() => window.__captureStep?.(0));
  } else {
    await page.waitForTimeout(300);
  }
}

async function captureFrames(page, frameDir, options) {
  const locator = page.locator(options.selector).first();
  const count = await page.locator(options.selector).count();
  if (count === 0) {
    throw new Error(`未找到截图元素：${options.selector}`);
  }

  await locator.scrollIntoViewIfNeeded();

  const frameCount = Math.max(2, Math.round(options.duration * options.fps));
  const frameDelay = 1000 / options.fps;
  const frames = [];

  for (let i = 0; i < frameCount; i += 1) {
    if (options.clock === "virtual") {
      await page.evaluate((time) => window.__captureStep?.(time), i * frameDelay);
    } else if (i > 0) {
      await page.waitForTimeout(frameDelay);
    }

    const framePath = path.join(frameDir, `frame-${String(i + 1).padStart(4, "0")}.png`);
    await locator.screenshot({ path: framePath });
    frames.push(framePath);
  }

  return frames;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    usage();
    return;
  }

  validateOptions(options);

  const inputAbs = path.resolve(options.input);
  const outputAbs = path.resolve(options.output || defaultOutputPath(inputAbs));
  const tempOutputAbs = path.join(
    path.dirname(outputAbs),
    `.${path.basename(outputAbs)}.${process.pid}.tmp`,
  );

  await assertInputFile(inputAbs);
  await fs.mkdir(path.dirname(outputAbs), { recursive: true });
  await fs.rm(tempOutputAbs, { force: true });

  const frameRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blog-html-gif-"));
  const frameDir = path.join(frameRoot, "frames");
  await fs.mkdir(frameDir);

  const { chromium } = await importPlaywright();
  let browser;

  try {
    const launchOptions = options.browser === "chrome" ? { channel: "chrome" } : {};
    browser = await chromium.launch(launchOptions);
    const page = await browser.newPage({
      viewport: {
        width: Math.max(options.width + 80, options.width),
        height: options.height,
      },
      deviceScaleFactor: 1,
    });

    await preparePage(page, inputAbs, options);
    const frames = await captureFrames(page, frameDir, options);

    await run("gifski", [
      "--fps",
      String(options.fps),
      "--quality",
      String(options.quality),
      "--width",
      String(options.width),
      "--no-sort",
      "--output",
      tempOutputAbs,
      ...frames,
    ]);

    await fs.rename(tempOutputAbs, outputAbs);
    console.log(`已生成 GIF：${path.relative(ROOT_DIR, outputAbs) || outputAbs}`);
  } catch (error) {
    if (String(error.message).includes("Executable doesn't exist")) {
      throw new Error(`缺少浏览器运行时。默认模式需要安装 Google Chrome；或运行 npx playwright install chromium 后改用 --browser chromium。
原始错误：${error.message}`);
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
    await fs.rm(tempOutputAbs, { force: true });
    if (options.keepFrames) {
      console.log(`临时帧目录：${frameDir}`);
    } else {
      await fs.rm(frameRoot, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(`错误：${error.message}`);
  process.exit(1);
});
