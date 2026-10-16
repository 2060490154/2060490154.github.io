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
* **包管理器**：pnpm（v12）/ npm
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
4. **SSL / TLS 证书**：由 Cloudflare 自动签发并维护（Google Trust Services CA），开启强制 HTTPS 301 重定向与 HSTS。

---

## 四、 核心性能与缓存策略（已落地实操）

本项目经过深度网络调优，实测页面加载耗时从最初的 1300ms+ 降低至 300ms 左右：

### 1. 边缘全站 HTML 缓存（Cache Rules）
* **规则配置**：在 Cloudflare 中配置了 `全站HTML边缘缓存` 规则（匹配 `http.host eq "ljx520.me"`）。
* **边缘 TTL**：设置为 `4 hours`。
* **浏览器 TTL**：设置为 `接受源服务器 TTL`（保持 `max-age=0, must-revalidate`）。
* **收益**：访客打开首页与文章时直接由最近的 Anycast 节点提供服务，首字节时间（TTFB）大幅下降。

### 2. 静态打包资源永久强缓存（Immutable Cache）
* **配置文件**：`public/_headers`（打包后位于 `dist/_headers`）。
* **规则详情**：
  ```http
  /_astro/*
    Cache-Control: public, max-age=31536000, immutable

  /assets/*
    Cache-Control: public, max-age=31536000, immutable

  /favicon.svg
    Cache-Control: public, max-age=86400

  /astropaper-og.jpg
    Cache-Control: public, max-age=604800
  ```
* **收益**：带有哈希值的 CSS / JS 静态资源被访客浏览器永久存入磁盘，二次跳转时静态资源 0ms 秒读。

### 3. 高级传输协议（Cloudflare 边缘开关）
* **HTTP/3 (QUIC)**：`开启`（基于 UDP 传输，消灭弱网与移动端队头阻塞）。
* **0-RTT 连接恢复**：`开启`（老访客跳过 TLS 握手）。
* **Early Hints (103)**：`开启`（提前指示浏览器并发加载 CSS）。
* **Brotli 极致压缩**：`开启`（比 Gzip 体积更小）。

### 4. 前端交互与加载提速
* **Astro Prefetch 预加载**：在 `astro.config.ts` 中开启了 `prefetchAll: true, defaultStrategy: "hover"`。访客鼠标滑过链接瞬间在后台静默拉取目标页，点击时如同单页应用（SPA）瞬间切换。
* **KaTeX 公式按需加载**：在 `src/layouts/Layout.astro` 中将 22KB 的 KaTeX 样式改为按需加载（仅在文章正文启用），减轻非公式页首屏负载。
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
* **全球缓存即时刷新**（可选）：
  由于设置了 4 小时的边缘 HTML 缓存，如果发布新文章后想让 `https://ljx520.me/` 全球节点即刻刷新：
  * 打开 [Cloudflare 控制台](https://dash.cloudflare.com/) ➡️ 进入 `ljx520.me`。
  * 点击左侧 **`Caching`（缓存）** ➡️ **`Configuration`（配置）** ➡️ 点击 **`Purge Everything`（清除所有内容）** 即可。

---

## 七、 核心代码文件导航

| 文件路径 | 核心用途 |
| :--- | :--- |
| `src/config.ts` | 站点基本信息、作者名、Slogan、社交媒体链接与 Giscus 配置 |
| `astro.config.ts` | Astro 框架配置、Prefetch 预加载策略、Markdown/LaTeX 插件 |
| `public/_headers` | Cloudflare Pages 静态资源 1 年强缓存与头信息配置 |
| `tailwind.config.cjs` | 样式与原生跨平台系统字体栈配置 |
| `src/layouts/Layout.astro` | 全站根 HTML 骨架、SEO 结构化数据、KaTeX 按需加载 |
| `src/layouts/PostDetails.astro` | 文章详情页模版、上一篇/下一篇导航、回到顶部、评论区 |
| `src/components/Search.tsx` | 中文模糊搜索核心组件（Fuse.js） |
| `src/pages/index.astro` | 博客主页布局（精选推荐、最新发布、关于作者） |
