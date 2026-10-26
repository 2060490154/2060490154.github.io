# 异想天开的出题者 - 博客系统全套架构与配置指南

> 本文档详细记录了本博客的基础信息、开发环境、云端部署、网络协议与性能优化策略，供作者备忘及后续其他 AI Agent 快速熟悉项目上下文。

---

## 一、 博客基本信息

* **博客名称**：异想天开的出题者
* **座右铭 / Slogan**：怎样都行，别不快乐
* **专属顶级域名**：[https://ljx520.me/](https://ljx520.me/)（支持根域及 www 双跳转）
* **备用/源站域名**：[https://2060490154-github-io.pages.dev/](https://2060490154-github-io.pages.dev/)
* **作者社交链接**：
  * **GitHub**：[https://github.com/2060490154](https://github.com/2060490154)
  * **哔哩哔哩**：[https://space.bilibili.com/629386398](https://space.bilibili.com/629386398)
* **代码仓库**：`git@github.com:2060490154/2060490154.github.io.git`（分支：`main`）
* **本地工作区目录**：`/home/archer/Projects/blog`

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
pnpm install       # 安装依赖
pnpm dev           # 本地启动开发服务器 (http://localhost:4321)
pnpm build         # 本地生产打包 (输出至 dist/)
pnpm preview       # 本地预览打包产物
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

### 2. 静态打包资源永久强缓存（Immutable Cache）
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
    Cache-Control: public, max-age=60, s-maxage=86400, stale-while-revalidate=604800

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
  /posts/*.png
    Cache-Control: public, max-age=86400

  # 全站安全与传输头 —— 只设置响应头，不带 Cache-Control，不参与上面的 TTL 推导
  /*
    Strict-Transport-Security: max-age=15552000
    Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'self'
    X-Frame-Options: DENY
    Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  ```
* **注意**：`s-maxage` 控制边缘缓存时长，`max-age` 控制浏览器缓存时长（浏览器会忽略 `s-maxage`）。新增页面类型时要在这里显式加规则（不要用 `/*` 兜底，会与具体规则叠加导致 TTL 不可预测）。
* **注意**：`/posts/*.png` 是构建期由 Satori 生成的 OG 分享图（`src/pages/posts/[slug]/index.png.ts`），并非仓库内静态文件。
* **收益**：带有哈希值的 CSS / JS 静态资源被访客浏览器永久存入磁盘，二次跳转时静态资源 0ms 秒读；HTML 文档 60 秒内返回缓存、过期后后台静默刷新。

### 3. 高级传输协议（Cloudflare 边缘开关）
* **HTTP/3 (QUIC)**：`开启`（基于 UDP 传输，消灭弱网与移动端队头阻塞）。
* **0-RTT 连接恢复**：`开启`（老访客跳过 TLS 握手）。
* **Early Hints (103)**：`开启`（提前指示浏览器并发加载 CSS）。
* **Brotli 极致压缩**：`开启`（比 Gzip 体积更小）。

### 4. 前端交互与加载提速
* **Astro Prefetch 预加载**：在 `astro.config.ts` 中开启了 `prefetchAll: true, defaultStrategy: "viewport"`。链接进入视口即在后台静默拉取目标页（桌面与移动端均生效），点击时如同单页应用（SPA）瞬间切换。
* **KaTeX 样式按需加载**：KaTeX CSS 与字体由 Vite 打包成本地 `_astro/` 资源（已移除 cdnjs 外链）。`PostDetails.astro` 用 `import katexCssHref from "katex/dist/katex.min.css?url"` 取资源地址，仅在正文含 `$...$` / `$$...$$` 时才插入 `<link>`。注意：Astro 会把组件里静态 `import` 的 CSS 提升到共享 chunk，所以「条件渲染一个承担 import 的组件」是无效的，必须走 `?url` 才能真正按文章拆包。实测无公式的文章页不再加载这 28KB。
* **评论区零 React**：`src/components/Comments.astro` 使用 giscus 官方原生脚本，通过 IntersectionObserver 距离视口 600px 时才加载；文章页不再下载 135KB 的 React runtime。
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
  * 享受项目配好的 Cloudflare 1 年强缓存与 CDN 加速。

---

## 六、 部署发布与日常运维流程

```bash
# 1. 撰写新文章或修改代码后：
git add .
git commit -m "feat: 发布新文章-xxx"
git push origin main
```
* **自动发布**：GitHub 收到推送后，Cloudflare Pages 会在 15~30 秒内自动拉取代码并完成构建上线。
* **推送即校验**：`.github/workflows/ci.yml` 在 **push 到 main** 和 PR 时都会跑 `lint` / `format:check` / `build`（Node 版本读 `.node-version`，pnpm 9 + `--frozen-lockfile`）。注意：`pnpm format:check` 在 Windows 本地会因 CRLF 换行全量报错，这是本机 `core.autocrlf=true` 造成的现象，Linux runner 上文件是 LF，检查是干净的。
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
| `public/_headers` | Cloudflare Pages 缓存头配置（哈希资源 1 年 immutable，HTML 60s + SWR） |
| `tailwind.config.cjs` | 样式与原生跨平台系统字体栈配置 |
| `src/layouts/Layout.astro` | 全站根 HTML 骨架、SEO 结构化数据、内联主题切换脚本 |
| `src/layouts/PostDetails.astro` | 文章详情页模版、上一篇/下一篇导航、回到顶部、KaTeX 样式按需引入 |
| `src/components/Comments.astro` | giscus 评论区（原生脚本 + 懒加载 + 主题同步，无 React） |
| `src/components/Search.tsx` | 中文模糊搜索核心组件（Fuse.js） |
| `src/pages/index.astro` | 博客主页布局（精选推荐、最新发布、关于作者） |
