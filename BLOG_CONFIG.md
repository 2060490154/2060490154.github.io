# 异想天开的出题者 - 博客系统全套架构与配置指南

> 本文档详细记录了本博客的基础信息、开发环境、云端部署、网络协议与性能优化策略，供作者备忘及后续其他 AI Agent 快速熟悉项目上下文。

---

## 一、 博客基本信息

* **博客名称**：异想天开的出题者
* **座右铭 / Slogan**：怎样都行，别不快乐
* **专属顶级域名**：[https://ljx520.me/](https://ljx520.me/)（唯一正式地址；`www.ljx520.me` 以 301 永久跳转到根域，见第三节第 5 条）
* **备用/源站域名**：[https://2060490154-github-io.pages.dev/](https://2060490154-github-io.pages.dev/)
* **作者社交链接**：
  * **GitHub**：[https://github.com/2060490154](https://github.com/2060490154)
  * **哔哩哔哩**：[https://space.bilibili.com/629386398](https://space.bilibili.com/629386398)
* **代码仓库**：`git@github.com:2060490154/2060490154.github.io.git`（分支：`main`）
* **本地工作区目录**：
  * Linux（Arch 笔记本）：`/home/archer/Projects/blog`
  * Windows（主力机）：`C:\Users\Administrator\work\blog`
* **同步模型**：两台机器**都只与 GitHub 同步**，彼此不直连。`origin` 指向 GitHub，`pull.ff = only`（只允许快进，分叉时直接报错而不是生成合并提交）。

---

## 二、 技术栈与本地开发环境

* **核心框架**：[Astro v4.16.x](https://astro.build/)（采用静态构建模式 `output: "static"`）
* **基础主题**：AstroPaper v4.8.0（深度定制、汉化与优化版）
* **Node.js 运行时**：v20.18.0 LTS（通过根目录下 `.node-version` 严格锁定，保证本地与云端一致）
* **包管理器**：pnpm（仓库只保留 `pnpm-lock.yaml`；`package-lock.json` 已移除，避免两套锁文件互相漂移）。CI 与 Cloudflare Pages 均走 pnpm。
* **样式框架**：Tailwind CSS v3 + @tailwindcss/typography
* **离线字体与降级**：
  * **正文字体**：纯原生系统字体栈（macOS/iOS 苹方与 SFMono，Windows 微软雅黑与 Consolas，Linux 文泉驿微米黑与 Liberation Mono）。彻底移除外部 Google Fonts 网络依赖，0ms 渲染无闪烁。
  * **OpenGraph 本地字体**：`src/assets/fonts/regular.ttf` 与 `bold.ttf` 用于编译期 Satori 封面生成，避免因外网网络波动导致构建超时。

### 常用本地命令
```bash
pnpm install       # 安装依赖（唯一锁文件 pnpm-lock.yaml）
pnpm dev           # 本地启动开发服务器 (http://localhost:4321)
pnpm build         # 本地生产打包 (输出至 dist/)
pnpm preview       # 本地预览打包产物
pnpm lint          # ESLint
pnpm format:check  # Prettier 校验（Windows 上会因 CRLF 误报，见第六节）
```

---

## 三、 域名、DNS 与网络接入架构

```
[访客浏览器]
      │
      ▼ (HTTP/3 + Anycast 边缘网络)
[Cloudflare 全球边缘节点]  ──(命中 Cache Rule)──> 秒级直返 HTML (TTFB ~30-50ms)
      │ (未命中 / 静态文件)
      ▼
[Cloudflare Pages 源服务器] (自动拉取 GitHub 构建部署)
```

1. **域名注册**：Namecheap（通过 GitHub Student Developer Pack 领取的免费 `.me` 域名，有效期至 2027 年）。
2. **权威 Nameservers**（已完全托管至 Cloudflare）：
   * `chuck.ns.cloudflare.com`
   * `collins.ns.cloudflare.com`
3. **Cloudflare Zone 信息**：
   * 域名：`ljx520.me`
   * Zone ID：`32d9990ec4fe01e99cd72dd6ec276cdc`
   * 状态：`active`
4. **SSL / TLS 证书**：由 Cloudflare 自动签发并维护（Google Trust Services CA），开启强制 HTTPS 301 重定向；HSTS 由 `public/_headers` 全站下发（`max-age=15552000`，暂未启用 `includeSubDomains` 与 `preload`）。
5. **www 子域 301 到根域**：通过 Cloudflare **Bulk Redirects**（账户级 URL Forwarding）实现，源 `www.ljx520.me/` → 目标 `https://ljx520.me`，301、保留查询串与路径后缀。列表名 `www_to_apex`，规则位于 `http_request_redirect` 阶段。
   * **为什么不用 Redirect Rules**：`www.ljx520.me` 是 Pages 项目的自定义域，该主机名的请求**不经过** Zone 的 `http_request_dynamic_redirect` 阶段（实测同一条路径规则在根域立即生效、在 www 从不触发）。
   * **为什么不用 `_redirects`**：Cloudflare 官方明确不支持域名级重定向，该写法会被静默忽略。
   * Bulk Redirects 运行在 Pages 之前，是当前唯一有效且不需要改代码发版的方案；www 的 DNS 仍是 CNAME 到根域，无需改成文档里的 `A 192.0.2.1`。

---

## 四、 核心性能与缓存策略（已落地实操）

本项目经过深度网络调优，实测页面加载耗时从最初的 1300ms+ 降低至 300ms 左右：

### 1. 边缘全站 HTML 缓存（Cache Rules）
* **规则配置**：在 Cloudflare 中配置了全站缓存规则（匹配 `http.host eq "ljx520.me"`）。
* **边缘 TTL**：选择 **`使用缓存控制标头（如果存在），否则绕过缓存`**。Cloudflare 免费版“忽略缓存标头、使用固定 TTL”模式最短只能选 2 小时，因此改用尊重源站头的模式：由 `public/_headers` 按页面类型分配 `s-maxage`（列表页 600s / 文章页 86400s / 其余 3600s）。
* **浏览器 TTL**：设置为 `接受源服务器 TTL`，实际由 `public/_headers` 的 `max-age=60, stale-while-revalidate=86400` 控制。
* **收益**：访客打开首页与文章时直接由最近的 Anycast 节点提供服务，首字节时间（TTFB）大幅下降。

### 2. 静态资源缓存分级（Immutable / 短 TTL）
* **配置文件**：`public/_headers`（打包后位于 `dist/_headers`）。
* **规则详情**（按页面类型分配 TTL；注意 Cloudflare Pages 会合并**所有**匹配规则的头，因此规则必须互不重叠）：
  ```http
  # 列表/导航页 —— 新文章 ~10 分钟内可见
  /
  /posts/
  /tags/*
  /archives/
    Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=86400

  # 文章详情页 —— 内容稳定，边缘常驻 1 天
  /posts/:slug/
    Cache-Control: public, max-age=300, s-maxage=86400, stale-while-revalidate=604800

  # 独立页 / 订阅 / 元数据 —— 1 小时
  /about/
  /search/
  /rss.xml
  /robots.txt
  /sitemap*
    Cache-Control: public, max-age=60, s-maxage=3600, stale-while-revalidate=86400

  # 构建产物（文件名含内容哈希）—— 1 年 immutable
  /_astro/*
    Cache-Control: public, max-age=31536000, immutable

  # public/assets 下的原样文件（logo.png 等，文件名无哈希）—— 1 天
  # 注意：绝不能给这里加 immutable，否则换图后老访客一年都看不到新图
  /assets/*
    Cache-Control: public, max-age=86400

  # 静态图片
  /favicon.svg
  /astropaper-og.jpg
  /og.png
    Cache-Control: public, max-age=86400

  # Satori 构建期生成的 OG 分享图 —— 文件名随文章标题走，可长期驻留边缘
  /posts/*.png
    Cache-Control: public, max-age=86400, s-maxage=31536000

  # 全站安全与传输头 —— 只设置响应头，不带 Cache-Control，不参与上面的 TTL 推导
  /*
    Strict-Transport-Security: max-age=15552000
    Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'self'
    X-Frame-Options: DENY
    Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  ```
* **注意**：`s-maxage` 控制边缘缓存时长，`max-age` 控制浏览器缓存时长（浏览器会忽略 `s-maxage`）。新增页面类型时要在这里显式加规则；**`/*` 只用来下发与缓存无关的响应头**（就是上面那块 HSTS / CSP），一旦 `/*` 里带了 `Cache-Control`，就会与所有具体规则叠加，TTL 变得不可预测。
* **注意**：`/posts/*.png` 是构建期由 Satori 生成的 OG 分享图（`src/pages/posts/[slug]/index.png.ts`），并非仓库内静态文件。
* **收益**：带有哈希值的 CSS / JS 静态资源被访客浏览器永久存入磁盘，二次跳转时静态资源 0ms 秒读；HTML 文档 60 秒内返回缓存、过期后后台静默刷新。

### 3. 高级传输协议（Cloudflare 边缘开关）
* **HTTP/3 (QUIC)**：`开启`（基于 UDP 传输，消灭弱网与移动端队头阻塞）。
* **0-RTT 连接恢复**：`开启`（老访客跳过 TLS 握手）。
* **Early Hints (103)**：`开启`（提前指示浏览器并发加载 CSS）。
* **Brotli 极致压缩**：`开启`（比 Gzip 体积更小）。

### 4. 前端交互与加载提速
* **Astro Prefetch 分级预取（2026-10-27 起）**：`prefetchAll: false` + `defaultStrategy: "hover"`。只给"最可能被点"的链接挂 `data-astro-prefetch`：文章卡片（`Card.tsx`）与上一篇/下一篇用 `viewport`（进视口即拉，手机可用），导航栏 5 个链接用 `hover`（桌面悬停才拉）。原 `prefetchAll: true` 会在首屏页面一口气预取 8 个链接（≈66KB），对移动流量不友好。
* **KaTeX 样式按需加载**：KaTeX CSS 与字体由 Vite 打包成本地 `_astro/` 资源（已移除 cdnjs 外链）。`PostDetails.astro` 用 `import katexCssHref from "katex/dist/katex.min.css?url"` 取资源地址，仅在正文含 `$...$` / `$$...$$` 时才插入 `<link>`。注意：Astro 会把组件里静态 `import` 的 CSS 提升到共享 chunk，所以「条件渲染一个承担 import 的组件」是无效的，必须走 `?url` 才能真正按文章拆包。实测无公式的文章页不再加载这 28KB。
* **评论区点击加载**：`src/components/Comments.astro` 使用 giscus 官方原生脚本（无 React）。默认只渲染一个「想说点什么？点击加载评论」按钮，**读者点了才注入 `giscus.app/client.js`**。实测文章页从 29 请求 / 153KB 降到 7 请求 / 26KB——挂载一次评论要拉 19 个 giscus 请求（98KB）+ 1 个 GitHub 头像动图（18KB），不点就一分不花。挂载后通过 MutationObserver 移除按钮，15 秒没出 iframe 则降级为「加载失败，点击重试」。
* **搜索页延迟水合**：`src/pages/search.astro` 的 `SearchBar` 用 `client:idle`（原 `client:load`），先把静态输入框交给浏览器，空闲时才下载 React runtime（135KB，Brotli 后约 40KB）。只有搜索页受影响。
* **主题脚本内联**：`toggle-theme.js` 已内联进 `src/layouts/Layout.astro` 的 `<head>`，消除每个页面一次额外请求（原 `public/toggle-theme.js` 已删除）。
* **中文单字搜索优化**：在 `src/components/Search.tsx` 中将 Fuse.js 最低字符限制改为 1（`minMatchCharLength: 1`），完美解决中文单字（如“学”、“天”）搜不出结果的问题。

---

## 五、 文章与静态资源编写指南

### 1. 文章存放与格式
* **文件路径**：`src/content/blog/你的文章标题.md`
* **标准 Frontmatter 头信息**：
  ```markdown
  ---
  author: 异想天开的出题者
  pubDatetime: 2026-10-16T20:00:00.000Z
  title: 文章标题
  featured: false
  draft: false
  tags:
    - 随笔
    - 学习笔记
  description: 这是一篇关于...的简要概述。
  ---

  这里是正文 Markdown 内容...
  ```

### 2. 图片使用策略（推荐直接放本地）
* **存放位置**：直接存放在项目内：
  * 公共直连图：放在 `public/images/xxx.png`，正文引用 `![说明](/images/xxx.png)`。
  * 自动压缩图：放在 `src/assets/images/` 中，通过 Astro `<Image />` 组件调用（会自动无损编译为极小体积的 WebP）。
* **优势**：
  * 免除第三方图床跑路或防盗链风险。
  * 享受同域名 HTTP/3 连接复用（免除了跨域图床 100~200ms 的额外 DNS + TLS 握手）。
  * **缓存差异**：`src/assets/` 里的图会生成带内容哈希的文件名，命中 `/_astro/*` 的 1 年 immutable；`public/` 下的文件保持原名，其中只有 `public/assets/` 有 1 天规则，`public/images/` 走 Pages 默认值。想要长期强缓存，优先把图放到 `src/assets/` 走哈希。

---

## 六、 部署发布与日常运维流程

```bash
# 1. 撰写新文章或修改代码后：
git add .
git commit -m "feat: 发布新文章-xxx"
git push origin main
```
* **自动发布**：GitHub 收到推送后，Cloudflare Pages 会在 15~30 秒内自动拉取代码并完成构建上线。
* **推送即校验**：`.github/workflows/ci.yml` 在 **push 到 main** 和 PR 时都会跑 `lint` / `format:check` / `build`（Node 读 `.node-version`，pnpm 12 + `--frozen-lockfile`）。
  * **pnpm 版本必须 ≥10**：`pnpm-workspace.yaml` 里只有 `allowBuilds` 没有 `packages`，pnpm 9 会直接报 `ERROR packages field missing or empty`，整个 job 挂掉。
  * **`src/content/blog/` 不参与 Prettier**：格式化器会重排中文长句，并把代码块里的示例压缩（实测把 `function demo() {` 加空行的写法压成 `function demo() {}`）——那是改内容不是改风格，已在 `.prettierignore` 中排除，正文保持手写原样。
  * **Windows 本地 `pnpm format:check` 会全量报错**：本机 `core.autocrlf=true` 让工作区是 CRLF，而 Prettier 配置要求 LF。这只是本地现象，Linux runner 上是干净的，不要为了"让本地不红"去改仓库。
* **全球缓存即时刷新**：正常情况下无需操作——
  * 发布新文章：列表页（首页/文章列表）边缘缓存 10 分钟自动滚动；文章页是新 URL，立即可见。
  * 修改已发布文章：文章页边缘缓存为 1 天，想立即可见时打开 [Cloudflare 控制台](https://dash.cloudflare.com/) ➡️ 进入 `ljx520.me` ➡️ **`Caching`（缓存）** ➡️ **`Configuration`（配置）** ➡️ 点击 **`Purge Everything`（清除所有内容）**。
  * 实测 Cloudflare 边缘的 `stale-while-revalidate` 对 HTML 不生效，因此不要在 HTML 上使用短 TTL——低流量站点的短 TTL 会让每个访客都触发回源（实测回源 TTFB 约 1~2s）。

---

## 七、 核心代码文件导航

| 文件路径 | 核心用途 |
| :--- | :--- |
| `src/config.ts` | 站点基本信息、作者名、Slogan、社交媒体链接与 Giscus 配置 |
| `astro.config.ts` | Astro 框架配置、Prefetch 预加载策略、Markdown/LaTeX 插件 |
| `public/_headers` | 全部响应头：缓存策略（哈希资源 1 年 immutable、非哈希 `/assets/*` 1 天、HTML 按类型分 TTL）+ 安全头（HSTS / CSP / X-Frame-Options / Permissions-Policy） |
| `tailwind.config.cjs` | 样式与原生跨平台系统字体栈配置 |
| `src/layouts/Layout.astro` | 全站根 HTML 骨架、SEO 结构化数据、内联主题切换脚本 |
| `src/layouts/PostDetails.astro` | 文章详情页模版、上一篇/下一篇导航、回到顶部、KaTeX 样式按需引入 |
| `src/components/Comments.astro` | giscus 评论区（原生脚本 + 点击加载 + 主题同步，无 React；不点不拉第三方资源） |
| `src/components/Search.tsx` | 中文模糊搜索核心组件（Fuse.js） |
| `src/pages/index.astro` | 博客主页布局（精选推荐、最新发布、关于作者） |
| `.github/workflows/ci.yml` | 推送与 PR 触发：lint、format:check、build（pnpm 12 + `.node-version`） |
| `.prettierignore` | 白名单式忽略：只检查代码与配置，`src/content/blog/` 正文豁免 |
| `pnpm-workspace.yaml` | pnpm 10+ 的构建脚本白名单（`allowBuilds`: esbuild / sharp / workerd）；注意它**没有** `packages` 字段，低版本 pnpm 会因此报错 |

---

## 八、 2026-10-26 优化记录与已知限制

### 1. 本次落地

| 项 | 变更 |
| :--- | :--- |
| HSTS | 由 `public/_headers` 全站下发；边缘的 HSTS 开关**保持关闭**，避免两个来源同时发头导致重复而被浏览器忽略 |
| www 301 | 改用账户级 **Bulk Redirects**（Zone 的 Redirect Rules 对 Pages 自定义域不生效，`_redirects` 不支持域名级） |
| `/assets/*` | 去掉误用的 `immutable`，降为 1 天（这些文件名没有内容哈希） |
| 安全头 | 新增 CSP（`frame-ancestors` / `object-src` / `base-uri`）、`X-Frame-Options`、`Permissions-Policy` |
| KaTeX | 改为 `katex.min.css?url` + 条件 `<link>`，无公式的文章页省掉 28.8KB CSS |
| 搜索页 | `client:load` → `client:idle`，React runtime 延后到空闲时加载 |
| OG 图 | 增加 `s-maxage=31536000` |
| 依赖 | 删除 `package-lock.json`，只保留 `pnpm-lock.yaml` |
| CI | Node 18 → `.node-version`；npm → pnpm 12；新增 push 触发；`.prettierignore` 排除正文 |

### 2. 已知限制（有意识保留，不是遗漏）

* **分页缓存误伤**：`/posts/:slug/` 同样会匹配将来的 `/posts/2/`，把它当文章页缓存 1 天。文章超过 10 篇出现第二页时需要处理：改分页路由，或给分页页单独加规则。
* **KaTeX 字体三份格式**：`dist/_astro` 里同时有 woff2 / woff / ttf，浏览器只会下 woff2，不影响访客，只是部署体积。
* **Prefetch 全量视口预取**：`prefetchAll + viewport` 会在移动端预取首屏所有链接，属于有意的体验取舍；改成 `hover` 会失去手机端的秒开感。
* **Bulk Redirects 不在仓库里**：它是账户级配置。Zone 级设置（`_headers`）随仓库走，账户级设置（Bulk Redirects、Pages 构建配置）需要重建时手动重配。
* **Cloudflare API Token 与本地工具**：令牌在 `C:\Users\Administrator\.cloudflare\api-token`（ACL 收紧到本机用户），配套 `cf.ps1` 直接调 API，令牌从文件读取、不进命令行。例：清缓存
  ```powershell
  cd C:\Users\Administrator\.cloudflare
  .\cf.ps1 -Method POST -Path "/zones/32d9990ec4fe01e99cd72dd6ec276cdc/purge_cache" -Body '{"purge_everything":true}'
  ```
  不再需要时请到面板 Revoke，并删除该文件。
* **CSP 只做了"不碰脚本"的部分**：`script-src` 未设白名单，因为页面有内联主题脚本和 Astro 注入脚本，硬上需要每次构建重算 hash。当前配置已能防点击劫持、插件注入和 `<base>` 劫持。

---

## 九、 2026-10-27 性能优化记录（P0 轮）

完整调研与方案矩阵见 [`PERF-RESEARCH.md`](./PERF-RESEARCH.md)。

### 1. 已落地

| 项 | 变更 | 位置 |
| :--- | :--- | :--- |
| 预取分级 | `prefetchAll: false` + `hover` 默认；卡片/上下篇 `viewport`，导航栏 `hover` | `astro.config.ts`、`Card.tsx`、`PostDetails.astro`、`Header.astro`、`LinkButton.astro`（新增 `prefetch` 属性） |
| 文章页浏览器 TTL | `max-age=60` → `300`，回访者少一次 304 往返 | `public/_headers` |
| Smart Tiered Cache | 边缘未命中时先取上级层，不再跨洋回源（免费计划可用） | Cloudflare 面板/API |
| 邮箱混淆 | 关闭，页面不再注入 `email-decode.min.js` | Cloudflare Scrape Shield |
| 评论区点击加载 | giscus 不再随视口自动加载，改为按钮触发；文章页 29 请求/153KB → **7 请求/26KB** | `src/components/Comments.astro` |
| Always Use HTTPS | 开启，避免访客敲裸域名时先吃一次 `http → https` 的 301 往返 | Cloudflare 面板/API |
| HTML 浏览器 TTL | 文章页 `60→3600`、列表页 `60→300`：回访者在窗口期内**零请求**，省掉一次 ~840ms 的跨境握手 | `public/_headers` |

### 2. 验证数据（本机 preview + Lighthouse 移动端模拟，基线 vs 上线版）

| 页面 | 指标 | 基线 | 上线版 |
| :--- | :--- | :--- | :--- |
| 首页 | FCP / LCP | 1,055ms / 1,206ms | 1,054ms / 1,204ms |
| 首页 | 请求数 / 传输量 | 10 / 45.2KB | 9 / 44.2KB |
| 公式页 | FCP / LCP | 1,656ms / 1,656ms | 1,654ms / 1,654ms |
| 公式页 | 请求数 / 传输量 | 13 / 112.3KB | 12 / 106.6KB |

结论：页面层确实已到天花板（Perf 100/99 打满），本轮收益主要是**少一次预取请求、少 5.7KB 传输、冷启动更快、回访少一次往返**，实验室指标基本持平。

### 3. 试过但回退/未做（有数据）

* **内联全站 CSS（`build.inlineStylesheets: "always"`）**：A/B 实测 FCP 提前 76ms（消掉 152ms 渲染阻塞），但 LCP **反而晚 70ms**、传输量 +12KB（预取文档也被撑大），净收益为零 → 回退，保留 1 年 immutable 的外链 CSS。
* **Speculation Rules 预渲染（`experimental.clientPrerender`）**：Astro 4 的 list 规则是 `immediate` eagerness，首页会一次性预渲染多篇文章；预渲染页会执行脚本，评论区的 IntersectionObserver 可能提前拉起 giscus（≈100KB 第三方资源）。收益（省一次 DOM 解析）小于风险 → 暂不开，后续可单独 A/B。
* **Web Analytics 信标（未关）**：`beacon.min.js`（10.2KB）由 Zone 级的 RUM 注入规则下发，API token 改不动规则（`is_paused`），只读 `curl` 也看不到——它是按浏览器导航注入的，必须用真实浏览器（如 Lighthouse）才能观察到。实测它 `type="module"` 延后执行、不阻塞渲染，Lighthouse 仍是 100 分。要关的话在面板 **Web Analytics → 对应站点 → 删除/暂停注入**，代价是失去目前唯一的真实用户数据源。

---

## 十、 真实用户数据（Cloudflare RUM，2026-10-13 ~ 10-27）

数据源：Cloudflare Web Analytics 的 GraphQL 数据集（`rumWebVitalsEventsAdaptiveGroups` / `rumPerformanceEventsAdaptiveGroups`），按国家聚合的 p75。

### 1. 核心指标

| 国家 | 样本 | TTFB p75 | FCP p75 | LCP p75 |
| :--- | ---: | ---: | ---: | ---: |
| 中国大陆 | 20 | **930 ms** | 1,512 ms | **1,516 ms** |
| 日本 | 20 | 861 ms | 1,408 ms | 1,408 ms |

### 2. TTFB 拆解（7 天）

| 国家 | DNS p75 | TCP 建连 p75 | TLS 握手 p75 |
| :--- | ---: | ---: | ---: |
| 中国大陆 | 26 ms | **502 ms** | **342 ms** |
| 日本 | 0 ms | 183 ms | 291 ms |
| 美国 | 10 ms | 18 ms | 17 ms |

### 3. 结论（重要）

* 大陆访客的 930ms TTFB 里，**DNS 只占 26ms，TCP+TLS 占 844ms**，服务端响应几乎不花时间。
* 也就是说：**任何页面级优化（内联、减字节、预取）都动不了这 844ms**，它由 CF 免费版从大陆到边缘节点的路由决定。
* 好消息是 **LCP p75 = 1.5s，已经达到 Core Web Vitals「良好」标准（< 2.5s）**，不需要为此花钱。
* 能免费改善的只有两处，都已在第九节落地：**让回访者少连一次**（HTML TTL 拉长、去掉多余第三方域名）、**让首次访问少跳一次**（Always Use HTTPS）。

> 查询方式（令牌在 `C:\Users\Administrator\.cloudflare\api-token`）：
> ```powershell
> # GraphQL，按国家取 p75
> $q = 'query { viewer { accounts(filter: {accountTag: "..."}) {
>   rumWebVitalsEventsAdaptiveGroups(limit: 30, filter: {siteTag: "...", datetime_geq: "...", datetime_leq: "..."}) {
>     count dimensions { countryName } quantiles { timeToFirstByteP75 largestContentfulPaintP75 }
>   } } } }'
> ```
> 数据集：`rumWebVitalsEventsAdaptiveGroups`（LCP/FCP/TTFB/INP/CLS）、`rumPerformanceEventsAdaptiveGroups`（DNS/TCP/TLS 分段）。


