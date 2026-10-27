#!/usr/bin/env node
/**
 * 新建一篇博客的骨架文件（frontmatter 与 src/content/config.ts 的 schema 对齐）。
 *
 *   pnpm new "文章标题"
 *   pnpm new "文章标题" --tags 随笔,学习笔记 --desc "一句话简介"
 *   pnpm new "文章标题" --slug my-post --featured
 *   pnpm new "还没写完" --draft
 *
 * 中文标题直接用，文件名会保留中文（URL 也随之是中文，和现有文章一致）。
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const BLOG_DIR = path.resolve("src/content/blog");
const CONFIG_FILE = path.resolve("src/config.ts");
const FALLBACK_AUTHOR = "异想天开的出题者";

const USAGE = `用法: pnpm new "文章标题" [选项]

选项:
  -t, --tags <a,b>   标签，逗号分隔，默认「随笔」
  -d, --desc <文本>   描述（列表页/meta 用），默认取标题
  -s, --slug <名字>   指定文件名，默认由标题生成
      --draft         草稿：不会出现在任何页面（包括 pnpm dev）
      --featured      设为首页精选
  -h, --help          显示本帮助`;

function write(text) {
  process.stdout.write(`${text}\n`);
}

function fail(reason, hint) {
  process.stderr.write(`\n✗ ${reason}\n`);
  if (hint) process.stderr.write(`  ${hint}\n`);
  process.stderr.write("\n");
  process.exit(1);
}

/** 需要加引号时才加，保持和手写文章一样的朴素 YAML 风格 */
function yamlScalar(value) {
  const reserved = /^(true|false|null|yes|no|on|off|~)$/i.test(value);
  const risky = /^[\s]|[\s]$|[:#[\]{}&*!|>'"%@`,?]|^-|^\d/.test(value);
  return reserved || risky ? JSON.stringify(value) : value;
}

/** 本地时间 + 时区偏移，例如 2026-10-27T17:45:00.000+08:00 */
function localStamp(date = new Date()) {
  const pad = value => String(value).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${clock}.000${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function slugify(value) {
  return value
    .replace(/[\\/:*?"<>|#%{}$!'@+`=~^&;,，。！？；：、（）【】《》“”‘’\s]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function readAuthor() {
  try {
    const source = await readFile(CONFIG_FILE, "utf8");
    const match = source.match(/^\s*author:\s*["'`](.+?)["'`]\s*,?\s*$/m);
    if (match) return match[1];
  } catch {
    /* 读不到 config.ts 就用默认作者 */
  }
  return FALLBACK_AUTHOR;
}

const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
  write(USAGE);
  process.exit(argv.length === 0 ? 1 : 0);
}

const options = { tags: ["随笔"], desc: "", slug: "", draft: false, featured: false };
const words = [];

for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index];

  if (arg === "--draft") {
    options.draft = true;
  } else if (arg === "--featured") {
    options.featured = true;
  } else if (arg === "--tags" || arg === "-t") {
    const raw = argv[(index += 1)];
    if (raw === undefined) fail("--tags 后面要跟标签", "例如 --tags 随笔,学习笔记");
    const tags = raw
      .split(/[,，]/)
      .map(tag => tag.trim())
      .filter(Boolean);
    if (tags.length > 0) options.tags = tags;
  } else if (arg === "--desc" || arg === "-d") {
    const raw = argv[(index += 1)];
    if (raw === undefined) fail("--desc 后面要跟描述文本");
    options.desc = raw.trim();
  } else if (arg === "--slug" || arg === "-s") {
    const raw = argv[(index += 1)];
    if (raw === undefined) fail("--slug 后面要跟文件名");
    options.slug = raw.trim();
  } else if (arg.startsWith("--")) {
    fail(`未知参数 ${arg}`, "查看帮助：pnpm new --help");
  } else {
    words.push(arg);
  }
}

const title = words.join(" ").trim();
if (!title) fail("缺少文章标题", '例如：pnpm new "我的第一篇随笔"');
if (!existsSync(BLOG_DIR)) fail(`找不到文章目录：${BLOG_DIR}`, "请在仓库根目录执行");

const stem = slugify(options.slug || title) || `post-${Date.now()}`;
let file = path.join(BLOG_DIR, `${stem}.md`);
for (let suffix = 2; existsSync(file); suffix += 1) {
  file = path.join(BLOG_DIR, `${stem}-${suffix}.md`);
}

const author = await readAuthor();
const content = [
  "---",
  `title: ${yamlScalar(title)}`,
  `author: ${yamlScalar(author)}`,
  `pubDatetime: ${localStamp()}`,
  `featured: ${options.featured}`,
  `draft: ${options.draft}`,
  "tags:",
  ...options.tags.map(tag => `  - ${yamlScalar(tag)}`),
  `description: ${yamlScalar(options.desc || title)}`,
  "---",
  "",
  "> 开头一句话，说说这篇文章要讲什么。",
  "",
  "## 小标题",
  "",
  "",
].join("\n");

await writeFile(file, content, "utf8");

const relative = path.relative(process.cwd(), file).replace(/\\/g, "/");
write(`✓ 已创建 ${relative}`);
write(`  预览：pnpm dev  →  http://localhost:4321`);
write(`  发布：pnpm ship  （推送后 Cloudflare Pages 15~30 秒自动上线）`);
if (options.draft) {
  write(`  注意：draft 为 true 时不会出现在任何页面，本地预览前先改成 false。`);
}
