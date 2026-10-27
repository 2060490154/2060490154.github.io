#!/usr/bin/env node
/**
 * 清空 ljx520.me 的 Cloudflare 边缘缓存。
 *
 * 什么时候需要：改动了已发布文章、换掉了 public/ 下的同名图片，想让所有人立刻看到新版。
 * 只是发新文章不用跑（新 URL 本来就没有缓存）。
 *
 * 令牌来源（按顺序）：环境变量 CLOUDFLARE_API_TOKEN → ~/.cloudflare/api-token
 *   pnpm flush
 *   pnpm flush --dry-run
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || "32d9990ec4fe01e99cd72dd6ec276cdc";
const TOKEN_FILE = path.join(os.homedir(), ".cloudflare", "api-token");
const dryRun = process.argv.includes("--dry-run");

async function readToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN.trim();

  if (existsSync(TOKEN_FILE)) {
    const token = (await readFile(TOKEN_FILE, "utf8")).trim();
    if (token) return token;
  }

  throw new Error(
    `找不到 API Token：设置环境变量 CLOUDFLARE_API_TOKEN，或把令牌写入 ${TOKEN_FILE}`
  );
}

let token;
try {
  token = await readToken();
} catch (error) {
  process.stderr.write(`\n✗ ${error.message}\n\n`);
  process.exit(1);
}

if (dryRun) {
  process.stdout.write(`→ [dry-run] 将清空 zone ${ZONE_ID} 的全部边缘缓存\n`);
  process.exit(0);
}

const endpoint = `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`;
const response = await globalThis.fetch(endpoint, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ purge_everything: true }),
});

const payload = await response.json().catch(() => ({}));

if (!response.ok || !payload.success) {
  const detail =
    (payload.errors || []).map(item => `${item.code} ${item.message}`).join("; ") ||
    `HTTP ${response.status}`;
  process.stderr.write(`\n✗ 清缓存失败：${detail}\n`);
  process.stderr.write(`  令牌权限需包含 ljx520.me 的 Cache Purge，可在 Cloudflare 面板重新签发。\n\n`);
  process.exit(1);
}

process.stdout.write(
  `\n✓ 已清空边缘缓存（${new Date().toLocaleString("zh-CN")}）\n` +
    `  已缓存过的访客仍可能在自己浏览器的 TTL 窗口内看到旧版，属正常现象。\n\n`
);
