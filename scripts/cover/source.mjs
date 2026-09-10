/*
 * 封面提示词的文本来源抽取：Markdown 摘要，以及「HTML 交互页 → 结构化骨架」。
 * 纯函数模块，只吃字符串、吐数据；不做任何 I/O，也不含面向模型的文案。
 *
 * 这是近似抽取，不是 HTML 解析器。去标签走的是 /<[^>]*>/，属性值里一旦出现 >
 * （例如 aria-label="a > b"）就会早断一格，把半截属性文本混进正文。产物是喂给
 * 文本模型的近似描述，不是要拿去做结构化处理的数据，这个精度可以接受。
 * 不要为此引入 HTML parser 依赖：本仓库 devDependencies 只有 3 个，
 * 为一段生成封面用的启发式抽取再加一个解析器不划算。
 *
 * 收束元素的判别式 isOutClass 为什么长这样：本仓库的 explainer 长卷按
 * docs/explainer/references/contract.md 约定，每节以 <div class="<NS>-out"> 收尾，
 * 命名空间前缀每篇不同（transformer 是 tx-out，stable diffusion 是 sd-out），
 * 所以不能写死前缀，只能匹配「单段前缀 + -out」。实测必须排除两类邻居：
 *   tx-e-h-out    前缀 tx-e-h 自带短横，它是图注不是收束
 *   tx-f-readout  结尾的 out 不是独立分段，是 readout 这个词
 * 因此用 ^[a-z0-9]+-out$ 而不是 /-out$/，另外单独允许裸 out 这个 token。
 */

export const SKELETON_LIMITS = {
  openingParagraphs: 2,
  openingChars: 240,
  maxSections: 24,
  leadChars: 160,
  outChars: 140,
  totalChars: 6000,
  minPerFile: 800,
};

/*
 * 剥噪声：注释必须第一个删。
 * 注释排在后面的话，注释里出现的 "<script" 会被当成真开标签，一路吃到文档里下一个
 * 真 </script>，中间的正文整节消失且不置 truncated——「先注释掉一段 script 再改」
 * 是常见的编辑中间态，这个静默丢内容的代价太大。
 * 反向风险（script 内部出现裸 "<!--" 而无 "-->"）是 XHTML 时代的写法，罕见得多。
 * section 匹配必须排在整个剥离之后。
 */
const NOISE_BLOCKS = [
  /<!--[\s\S]*?-->/g,
  /<script\b[\s\S]*?<\/script>/gi,
  /<style\b[\s\S]*?<\/style>/gi,
  /<svg\b[\s\S]*?<\/svg>/gi,
  /<canvas\b[\s\S]*?<\/canvas>/gi,
  /<noscript\b[\s\S]*?<\/noscript>/gi,
  /<template\b[\s\S]*?<\/template>/gi,
];

const NAMED_ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&nbsp;": " ",
};

const ENTITY_PATTERN = /&(?:amp|lt|gt|quot|nbsp|#\d+|#x[0-9a-fA-F]+);/g;

const OUT_TOKEN_PATTERN = /^[a-z0-9]+-out$/;

const TAG_WITH_CLASS = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/g;

export function plainExcerpt(markdown) {
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

function decodeEntities(text) {
  return text.replace(ENTITY_PATTERN, (entity) => {
    if (entity.startsWith("&#x") || entity.startsWith("&#X")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(3, -1), 16));
    }
    if (entity.startsWith("&#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2, -1), 10));
    }
    return NAMED_ENTITIES[entity];
  });
}

/*
 * 去标签会把 <br> 与 <span> 里的文字直接接起来，这正是想要的：
 * 标题的主副标题、正文里被 <span class="em"> 标重点的词都应该连成一句话。
 */
function textOf(fragment) {
  return decodeEntities(fragment.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function stripNoise(html) {
  let cleaned = html;
  for (const pattern of NOISE_BLOCKS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  return cleaned;
}

/*
 * 从开标签之后取到配对的闭标签，按同名标签计深度，处理 <div> 套 <div>。
 * 没有配对闭标签时取到末尾。
 */
function contentAfterTag(html, tagName, contentStart) {
  const pairs = new RegExp(`<(/?)${tagName}\\b[^>]*>`, "gi");
  pairs.lastIndex = contentStart;
  let depth = 1;
  let match = pairs.exec(html);
  while (match !== null) {
    depth += match[1] === "/" ? -1 : 1;
    if (depth === 0) return html.slice(contentStart, match.index);
    match = pairs.exec(html);
  }
  return html.slice(contentStart);
}

function firstElementText(html, tagName) {
  const opening = new RegExp(`<${tagName}\\b[^>]*>`, "i").exec(html);
  if (!opening) return "";
  return textOf(contentAfterTag(html, tagName, opening.index + opening[0].length));
}

function isOutClass(classValue) {
  return classValue
    .split(/\s+/)
    .some((token) => token === "out" || OUT_TOKEN_PATTERN.test(token));
}

function lastOutText(section) {
  let found;
  TAG_WITH_CLASS.lastIndex = 0;
  let match = TAG_WITH_CLASS.exec(section);
  while (match !== null) {
    const classValue = match[2] ?? match[3];
    if (isOutClass(classValue)) {
      found = { tagName: match[1], contentStart: match.index + match[0].length };
    }
    match = TAG_WITH_CLASS.exec(section);
  }
  if (!found) return "";
  return textOf(contentAfterTag(section, found.tagName, found.contentStart));
}

function collectOpening(head, limits) {
  const opening = [];
  const pattern = /<p\b[^>]*>/gi;
  let match = pattern.exec(head);
  while (match !== null && opening.length < limits.openingParagraphs) {
    const contentStart = match.index + match[0].length;
    const text = textOf(contentAfterTag(head, "p", contentStart));
    if (text) opening.push(text.slice(0, limits.openingChars));
    pattern.lastIndex = contentStart;
    match = pattern.exec(head);
  }
  return opening;
}

function collectSections(cleaned, limits) {
  const sections = [];
  const pattern = /<section\b[^>]*>([\s\S]*?)<\/section>/g;
  let overflow = false;
  let match = pattern.exec(cleaned);
  while (match !== null) {
    if (sections.length >= limits.maxSections) {
      overflow = true;
      break;
    }
    const body = match[1];
    const heading = firstElementText(body, "h2") || firstElementText(body, "h3");
    sections.push({
      heading,
      lead: firstElementText(body, "p").slice(0, limits.leadChars),
      out: lastOutText(body).slice(0, limits.outChars),
    });
    match = pattern.exec(cleaned);
  }
  return { sections, overflow };
}

function measure(skeleton) {
  let total = skeleton.title.length;
  for (const paragraph of skeleton.opening) total += paragraph.length;
  for (const section of skeleton.sections) {
    total += section.heading.length + section.lead.length + section.out.length;
  }
  return total;
}

/*
 * 裁剪顺序：先丢全部 out，再从尾部丢 section。
 * 前几节承载「问题 → 第一因」，尾部多是应用、坑和回顾，对封面主题贡献最小。
 */
function fitBudget(skeleton, budget) {
  if (measure(skeleton) <= budget) return skeleton;
  const trimmed = {
    ...skeleton,
    sections: skeleton.sections.map((section) => ({ ...section, out: "" })),
    truncated: true,
  };
  while (trimmed.sections.length > 0 && measure(trimmed) > budget) {
    trimmed.sections.pop();
  }
  return trimmed;
}

export function extractHtmlSkeleton(html, budget = SKELETON_LIMITS.totalChars) {
  const limits = SKELETON_LIMITS;
  const cleaned = stripNoise(html);
  const sectionStart = cleaned.search(/<section\b/i);
  const head = sectionStart === -1 ? cleaned : cleaned.slice(0, sectionStart);
  const { sections, overflow } = collectSections(cleaned, limits);

  return fitBudget(
    {
      title: firstElementText(cleaned, "h1"),
      opening: collectOpening(head, limits),
      sections,
      truncated: overflow,
    },
    budget,
  );
}
