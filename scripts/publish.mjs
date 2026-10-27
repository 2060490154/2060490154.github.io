#!/usr/bin/env node
/**
 * 一键发布：提交 → 与远端对齐 → 推送。推送后 Cloudflare Pages 自动构建上线。
 *
 *   pnpm ship                  # 自动生成提交信息
 *   pnpm ship "feat: 新文章"    # 自定义提交信息
 *   pnpm ship --check          # 推送前先本地打包，构建挂了就不推
 *   pnpm ship --dry-run        # 只告诉我将发生什么，不改仓库
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

const REMOTE = "origin";
const BRANCH = "main";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const withCheck = args.includes("--check");
const customMessage = args
  .filter(arg => !arg.startsWith("--"))
  .join(" ")
  .trim();

function fail(reason, hint) {
  process.stderr.write(`\n✗ ${reason}\n`);
  if (hint) process.stderr.write(`  ${hint}\n`);
  process.stderr.write("\n");
  process.exit(1);
}

function say(text) {
  process.stdout.write(`${text}\n`);
}

function git(argv, { capture = true, allowFail = false } = {}) {
  const result = spawnSync("git", argv, {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.status !== 0 && !allowFail) {
    fail(`git ${argv.join(" ")} 失败`, (result.stderr || "").trim());
  }
  return result;
}

const out = result => (result.stdout || "").trim();

function stamp(date = new Date()) {
  const pad = value => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

if (git(["rev-parse", "--is-inside-work-tree"], { allowFail: true }).status !== 0) {
  fail("当前目录不是 git 仓库", "请在仓库根目录执行 pnpm ship");
}

const branch = out(git(["rev-parse", "--abbrev-ref", "HEAD"]));
if (branch !== BRANCH) {
  fail(`当前在 ${branch} 分支，只能在 ${BRANCH} 上发布`, `先执行 git switch ${BRANCH}`);
}

if (withCheck) {
  say("→ 本地构建检查（pnpm build）…");
  const build = spawnSync("pnpm", ["build"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (build.status !== 0) {
    fail("本地构建失败，没有提交任何改动", "修好之后再跑一次 pnpm ship");
  }
}

// 先把远端摸清楚：落后就快进，分叉就让人自己 rebase，绝不自动合并
const fetched = git(["fetch", REMOTE, BRANCH], { allowFail: true });
let ahead = 0;
if (fetched.status === 0) {
  const counts = out(
    git(["rev-list", "--left-right", "--count", `${REMOTE}/${BRANCH}...HEAD`], {
      allowFail: true,
    })
  );
  const [behind = 0, localAhead = 0] = counts.split(/\s+/).map(Number);
  if (behind > 0 && localAhead > 0) {
    fail(
      `本地与 ${REMOTE}/${BRANCH} 已分叉（落后 ${behind} / 领先 ${localAhead}）`,
      `先执行 git pull --rebase ${REMOTE} ${BRANCH} 处理完再发布`
    );
  }
  if (behind > 0) {
    say(`→ 远端领先 ${behind} 个提交，先快进…`);
    if (!dryRun) git(["pull", "--ff-only", REMOTE, BRANCH], { capture: false });
  }
  ahead = localAhead;
}

if (!dryRun) git(["add", "-A"]);

// 注意：这里不能用 out() 整体 trim，porcelain 首行的第一列是空格（未暂存），
// 整体 trim 会把状态列吃掉，导致路径少一个字符。
const porcelain = git(["-c", "core.quotepath=false", "status", "--porcelain"]).stdout || "";
const changes = porcelain
  .split(/\r?\n/)
  .filter(line => line.length > 0)
  .map(line => ({
    code: line.slice(0, 2).trim() || "??",
    path: line.slice(3).trim(),
  }));

const postOnly =
  changes.length > 0 &&
  changes.every(change => change.path.startsWith("src/content/blog/"));

if (changes.length === 0) {
  if (ahead === 0) {
    say("✓ 工作区干净，没有待提交或待推送的改动。");
    process.exit(0);
  }
  if (dryRun) {
    say(`→ [dry-run] 工作区干净，但有 ${ahead} 个提交待推送。`);
    process.exit(0);
  }
  say(`→ 工作区干净，但有 ${ahead} 个提交待推送…`);
}

const message =
  customMessage || (postOnly ? `post: 更新文章 ${stamp()}` : `chore: 更新站点 ${stamp()}`);

if (changes.length > 0) {
  if (dryRun) {
    say(`→ [dry-run] 将提交 ${changes.length} 个文件：`);
    for (const change of changes.slice(0, 20)) {
      say(`   ${change.code.padEnd(2)} ${change.path}`);
    }
    if (changes.length > 20) say(`   … 还有 ${changes.length - 20} 个`);
    say(`→ [dry-run] 提交信息：${message}`);
  } else {
    git(["commit", "-m", message]);
    say(`✓ 已提交：${message}`);
  }
}

if (dryRun) {
  say(`→ [dry-run] 将推送到 ${REMOTE}/${BRANCH}，到此为止。`);
  process.exit(0);
}

const pushed = git(["push", REMOTE, BRANCH], { allowFail: true });
if (pushed.status !== 0) {
  fail(`推送失败`, (pushed.stderr || pushed.stdout || "").trim());
}

say("");
say(`✓ 已推送到 ${REMOTE}/${BRANCH}`);
say("  · Cloudflare Pages 会在 15~30 秒内自动构建上线，稍后刷新 https://ljx520.me 验收");

const touchedPublished = changes.some(
  change =>
    change.path.startsWith("src/content/blog/") &&
    change.code !== "A" &&
    change.code !== "??"
);

if (touchedPublished) {
  say("  · 本次改动了已发布文章：等部署完成后执行 pnpm flush，让边缘和访客立刻看到新版");
}

say("");
