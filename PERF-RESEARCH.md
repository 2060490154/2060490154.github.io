# 访客加载速度调研报告

> 调研日期：2026-10-27 ｜ 站点：<https://ljx520.me/> ｜ 结论基于**仓库代码审查 + 线上实测**（Lighthouse / curl / DNS 探测）。

---

## 一、结论先行

**页面本身已经没有多少可榨的油水了，剩下的时间基本都花在"路上"。**

| 判断 | 依据 |
| :--- | :--- |
| 实验室性能已接近满分 | 数学页移动端 Performance **99**，FCP/LCP 1.4s、TBT 0ms、CLS 0、16 个请求、123KB |
| 首屏资源极小 | HTML 5.5KB、CSS 7.5KB、JS 6.5KB（均为 Brotli 后实测值） |
| 无双字体/无外链图片/无重型三方脚本 | 字体走系统栈，正文 0 张图片，评论区已改原生 giscus + 懒加载 |
| **剩余瓶颈按影响排序** | ①大陆/远距离网络的 RTT ②1 个渲染阻塞 CSS ③CF Web Analytics 信标 ④首次回源 ⑤全量预取 |

一句话：**想再快一步，主要靠"换更近的路"（网络层），而不是"再删几 KB"（页面层）。**

---

## 二、实测基线

### 2.1 Lighthouse（本地 Chrome 123，经本机代理，绝对数值偏大、比例可信）

| 页面 / 预设 | Perf | FCP | LCP | TBT | CLS | 请求数 | 传输量 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 首页 / 桌面 | — | 0.53s | 0.53s | 0ms | 0 | 18 | 102 KiB |
| `/posts/markdown-latex-demo/` / 移动 | **99** | 1.4s | 1.4s | 0ms | 0 | 16 | 123 KiB |

### 2.2 首屏请求构成（首页，按体积）

```
13.8 KB  /posts/记录在astro官网的学习/   ← prefetch（VeryLow）
12.3 KB  /posts/markdown-latex-demo/     ← prefetch（VeryLow）
10.6 KB  /posts/无聊的一天/               ← prefetch（VeryLow）
10.2 KB  static.cloudflareinsights.com/beacon.min.js  ← 三方信标（High）★
 7.5 KB  /_astro/about.*.css             ← 渲染阻塞 ★
 6.3 KB  /  (文档本体)
 7.6+6.1+6.1+6.0+5.4+1.4 KB             ← 其余 6 个 prefetch
 4.6 KB  /_astro/hoisted.*.js  (prefetch 逻辑 + 汉堡菜单)
 1.6 KB  /_astro/index.*.js   (prefetch 引擎)
```

首屏**真正必需**的东西只有约 **20KB**，其余 80KB 全是预取和信标。预取优先级 `VeryLow`、不抢带宽，但**移动端流量账要认**。

### 2.3 传输与缓存现状

| 项 | 实测 | 评价 |
| :--- | :--- | :--- |
| 压缩 | `Content-Encoding: br` | ✅ 已在用 Brotli |
| 协议 | `Alt-Svc: h3`，TLS1.3 可用 | ✅ HTTP/3 已开 |
| HTML（br 后） | 首页 5.5KB / 列表 5.3KB / 文章 9.6–13.1KB / 搜索 6.8KB | ✅ 很小 |
| CSS（br 后） | 7.5KB（42.7KB 原始）单文件 | ✅ 单文件，但**阻塞渲染** |
| JS（br 后） | 4.6 + 1.6 + 0.5KB | ✅ 极小 |
| 边缘缓存 | `cf-cache-status: HIT/EXPIRED`，`Server-Timing: cfOrigin;dur=40` | ✅ 规则生效 |
| 数学页额外开销 | katex.css 8.4KB + 3 个 woff2 共 **68KB** | ⚠️ 仅公式页，可接受 |
| OG 图 | `astropaper-og.jpg` 83.5KB | ✅ 仅社交抓取，访客不下载 |

---

## 三、瓶颈逐项拆解

| # | 瓶颈 | 影响 | 量级 | 根治难度 |
| :--- | :--- | :--- | :--- | :--- |
| R1 | **网络路径**（大陆访客 → CF 落 HKG/NRT/LAX） | TTFB 与首包决定一切 | 大陆 0.15–0.6s，极端可达 1s+ | 中～高（见方案 A） |
| R2 | **1 个渲染阻塞 CSS** | 首屏要等第 2 个 RTT | ≈ 1×RTT（大陆 40–200ms） | 低（内联即可） |
| R3 | **CF Web Analytics 信标 10.2KB（High 优先级）** | 抢首屏带宽 + 三方 DNS/TLS | 30–150ms | 极低（面板关掉） |
| R4 | **首次回源 1–2s**（新文章 / 缓存过期后第一个访客） | 冷启动体验断崖 | 1–2s | 低（开 Tiered Cache / 预热） |
| R5 | **预取 8 个页面 ≈ 66KB** | 移动端流量与解析开销 | 4G 下 0.3–0.8s 额外交互 | 低（分级预取） |
| R6 | **没有预渲染**，切换仍是文档级导航 | 点开文章要等 1 个 RTT | 大陆 0.15–0.4s | 低（Speculation Rules） |
| R7 | **HTML `max-age=60`** | 回访者每 60s 一次 304 往返 | 1×RTT | 低（调 TTL） |
| R8 | 数学页 KaTeX 字体 68KB | 仅 2 篇含公式 | 一次性 | 中（子集化，性价比低） |
| R9 | 搜索页 React 132KB（`client:idle`） | 仅搜索页，空闲加载 | 40KB br | 中（改原生实现） |
| R10 | 边缘节点回源 Pages 需跨洋 | 与 R4 同源 | 见 R4 | 低（Tiered Cache） |

> 说明：R2/R3/R5/R6 是"不管访客在哪都能拿到的确定性收益"；R1 是"访客在中国大陆时最大的那个变量"。

---

## 四、方案矩阵

### A. 网络 / 托管层（决定大陆访客体感，收益最大）

#### A1. Cloudflare 优选 IP / 自定义 CNAME（FaaS-in-China）
- **做法**：不走 CF 官方 NS 解析，改用第三方"优选域名/优选 IP"或 Partner 的 CNAME 接入，让大陆三网解析到延迟最低的 CF 边缘 IP。
- **预期**：RTT 从 200ms+ 降到 60–150ms；LCP 改善 0.3–0.8s。
- **成本**：0 元。
- **风险**：⚠️ 依赖第三方域名稳定性；IP 段可能被封；与 Pages 自定义域集成别扭（要摘掉 Pages domain 的解析）；属于"能用但不体面"的方案。
- **适配度**：★★☆☆☆（应急可用，不建议长期）

#### A2. 香港 / 日本 VPS + 大陆优化线路（自托管静态站）
- **做法**：CI 构建后用 `rsync`/Docker 推静态产物到香港 VPS（Nginx/Caddy，开 HTTP/3 + Brotli），大陆访客走 CN2 GIA / CMIN2 / 9929 回程；海外访客继续走 Cloudflare Pages（GeoDNS 分流）。
- **预期**：大陆 TTFB 稳定 **40–90ms**，首屏 0.4–0.8s；彻底摆脱绕行。
- **成本**：30–100 元/月 + 约半天运维搭建。
- **风险**：单点、无 DDoS 防护、证书续期、多一份运维负担；`.me` **不需要** ICP 备案（服务器在境外）。
- **适配度**：★★★★☆（若访客主要在大陆，这是"根治"路线）

#### A3. 腾讯云 EdgeOne 海外版（免费）
- **做法**：把静态站接到 EdgeOne International 免费版，全球节点（**不含中国大陆**）。
- **预期**：对大陆访客仍是境外绕行，改善有限；对海外/东南亚访客可用。
- **成本**：0 元。
- **风险**：迁移成本 + 与现有 CF 缓存规则重做。
- **适配度**：★☆☆☆☆（针对"大陆慢"issue 不解决问题）

#### A4. 换可备案域名 + 国内 CDN
- **做法**：换 `.com/.cn` 等可备案后缀 → ICP 备案 → 阿里云/腾讯云 CDN 或 OSS。
- **预期**：大陆 TTFB 20–50ms，最优解。
- **成本**：域名费 + 备案 2–4 周 + 实名/幕布/核验流程；`.me`（学生包，2027 到期）作废或做跳转。
- **风险**：⚠️ **`.me` 不支持 ICP 备案**（多省管局明确不接受，见参考），所以必须换域名，SEO 与外链要重做。
- **适配度**：★★☆☆☆（除非准备长期认真做站，否则性价比低）

#### A5. 双线 GeoDNS 分流
- **做法**：DNSPod/Cloudflare Load Balancing 按线路分流：大陆 → A2 的 VPS，海外 → CF Pages。
- **预期**：两类访客都拿到各自最优路径。
- **成本**：在 A2 基础上 +0～5 美元/月。
- **适配度**：★★★★☆（与 A2 组合是最优形态）

> **已被排除的选项**：Cloudflare China Network（大陆节点）需要 **Enterprise 订阅 + 每个根域名的 ICP 备案**，个人站不可行（[官方文档](https://developers.cloudflare.com/china-network/)）。

---

### B. 传输层（确定性收益，0 成本）

| 编号 | 方案 | 做法 | 预期收益 | 风险 |
| :--- | :--- | :--- | :--- | :--- |
| **B1** | **内联全站 CSS** | `astro.config.ts` 加 `build: { inlineStylesheets: "always" }` | 省掉 1 个渲染阻塞往返：大陆 ≈40–200ms，海外 ≈10–30ms | HTML 增大约 7.5KB（br 后），任何 CSS 改动会让所有页 HTML 失效；本项目 HTML 本身只有 60s 浏览器缓存，代价可忽略 |
| **B2** | **关掉 CF Web Analytics 信标** | Cloudflare 面板 → 该 Pages 项目 / Web Analytics → 关闭自动注入 | 少 1 个三方请求 + 10.2KB（High 优先级），首屏更快、隐私更干净 | 失去 RUM 数据；若要留存，改用自建 Umami 或仅在需要时开 |
| **B3** | **关闭 Email Obfuscation** | Scrape Shield → Email Address Obfuscation 关闭 | 少 `email-decode.min.js` 0.9KB（因站点有 `mailto:` 分享链接被注入） | 邮箱明文暴露（本站无真实邮箱，无影响） |
| **B4** | **开 Tiered Cache** | Caching → Tiered Cache → 开启（Free 计划免费） | 缓存未命中时先到上级层，不再直接跨洋回源 → 冷启动从 1–2s 降到数百 ms | 无 |
| **B5** | **HTML 缓存 TTL 微调** | 文章页 `max-age=60 → 300` | 回访者少一次 304 往返 | 改文章后最多 5 分钟才在访客端更新（可主动 Purge） |
| B6 | Early Hints 真正生效 | 需要源站返回 `Link: <css>; rel=preload`，本项目 CSS 名带 hash，无法写死 | —— | **不做**，B1 已覆盖 |
| B7 | Brotli / HTTP/3 / 0-RTT | 已开启 | —— | 维持现状 |

---

### C. 前端层

| 编号 | 方案 | 做法 | 预期收益 | 风险 |
| :--- | :--- | :--- | :--- | :--- |
| **C1** | **Speculation Rules 预渲染** | `astro.config.ts` 的 `prefetch` 加 `experimental: { clientPrerender: true }` | 点击文章 = 瞬时（导航前已渲染好），比现在的 `<link rel=prefetch>` 强 | ⚠️ 预渲染会执行页面脚本、占内存；`prefetchAll + viewport` 下首页会一次性预渲染 8 个页面，低端机不友好 → **建议同时把预取范围收窄**（见 C2） |
| **C2** | **预取分级** | `prefetchAll: false`，只在文章卡片、上一篇/下一篇加 `data-astro-prefetch="viewport"`，导航链接用 `hover` | 首屏少发 6–8 个请求（≈50KB），移动端流量友好 | 少部分链接失去秒开（可用 hover 兜底） |
| **C3** | 搜索页去 React | 用原生 JS 重写 Fuse 搜索（保留 URL `?q=` 同步） | 搜索页省 ~40KB（br）与 132KB 运行时 | 约 2–3 小时开发 + 回归测试 |
| **C4** | KaTeX 字体子集 | 只用 `KaTeX_Main-Regular/Math-Italic` 两个 woff2，其余按需 | 数学页最多省 40KB | 特殊符号可能缺字，**不建议**（只有 2 篇） |
| **C5** | 图片管线 | 未来配图放 `src/assets/` + `<Image />`（AVIF/WebP + 尺寸 + lazy） | 新文章才有意义 | 已写进 BLOG_CONFIG，无需改动 |
| C6 | Astro 5 升级 | 按官方 upgrade guide 走（`astro:transitions` → `ClientRouter`） | 构建更快、组件更小，**对访客 LCP 影响很小** | 中等迁移成本，收益不成正比，**暂缓** |

---

### D. 观测层（没有数据就没有优化）

| 编号 | 方案 | 说明 |
| :--- | :--- | :--- |
| **D1** | 国内多节点测速 | itdog.cn / 站长工具 ping+HTTP 测试，采三网（电信/联通/移动）× 华南/华东/华北，记录 TTFB 与首屏 |
| **D2** | 真实用户监控 | CF Web Analytics 已有（若按 B2 关掉，改用 Umami/自托管）→ 看 LCP p75 与 TTFB p75 分国家/地区 |
| **D3** | 回归防线 | GitHub Actions 里加 Lighthouse CI（阈值 LCP < 1.5s @ mobile），防止后续改动回退 |
| **D4** | 缓存观测 | 定期抓 `cf-cache-status` 与 `Server-Timing`，确认边缘命中率（尤其发版后） |

---

## 五、推荐路线

### P0 —— 今天就能做，0 成本，预计首屏 −100～300ms（大陆）

1. **B1 内联 CSS**（`build.inlineStylesheets: "always"`）——确定性最大的一笔。
2. **B2 + B3 关信标 / 关邮箱混淆**（面板操作，零风险）。
3. **B4 开 Tiered Cache**（面板，冷启动体验质变）。
4. **C1 + C2 预渲染 + 预取分级**（`clientPrerender: true` + 只给文章卡片挂 `data-astro-prefetch`）。
5. **B5 文章页 `max-age` → 300**。

> 预期结果：首页请求从 **18 → 约 12**（去掉信标 + 预取收窄），传输量从 102KiB → 约 60KiB；渲染不再等第二个 RTT，回访几乎零往返。

### P1 —— 先量测，再决定要不要花半天到两天

1. 用 D1/D2 拿到大陆三网真实 TTFB（预计 150–600ms）。
2. 若 **p75 TTFB > 250ms**：走 **A2 + A5**（香港 VPS + 双线分流），这是唯一能根治大陆体感的方案，成本 30–100 元/月。
3. 若访客主要在海外：P0 已足够，**不必动架构**。

### P2 —— 可选，视精力

- C3 搜索页去 React（省 40KB，只影响搜索页）
- D3 Lighthouse CI 回归门槛
- A4 换域名 + 备案（仅当准备长期运营并接受重做 SEO 时）

---

## 六、明确不做（有依据的取舍）

| 事项 | 原因 |
| :--- | :--- |
| Cloudflare China Network 大陆节点 | 需 Enterprise + ICP（[文档](https://developers.cloudflare.com/china-network/)） |
| 用 `.me` 做国内备案 / 国内 CDN | `.me` 不在可备案后缀白名单（[参考](https://www.pady.com.cn/record/262710.html)、[参考](https://www.pady.com.cn/record/262711.html)） |
| 给非哈希文件名加 `immutable` | 换图后老访客一年看不到新图 |
| KaTeX 字体子集化 | 仅 2 篇公式文章，收益 40KB，缺字风险不值得 |
| Astro 5 大版本升级 | 对访客 LCP 几乎无收益，迁移成本不低 |

---

## 七、验收标准

| 指标 | 现状（实验室） | P0 目标 | P1 目标（大陆 p75） |
| :--- | :--- | :--- | :--- |
| 移动端 Lighthouse Perf | 99 | 99（不掉） | 99 |
| 首屏请求数（首页） | 18 | ≤ 12 | ≤ 12 |
| 首屏传输量（首页） | 102 KiB | ≤ 60 KiB | ≤ 60 KiB |
| TTFB | 300–420ms（经代理） | 同区间 −0～100ms | **≤ 120ms** |
| LCP（移动端） | 1.4s | ≤ 1.2s | **≤ 1.0s** |
| 切换页面 | 1×RTT | 瞬时（预渲染） | 瞬时 |

---

## 八、P0 实施与验证结果（2026-10-27）

### 8.1 落地情况

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| B1 内联全站 CSS | ❌ **A/B 后回退** | FCP −76ms，但 LCP +70ms、传输 +12KB，净收益为零 |
| B2 关 Web Analytics 信标 | ⏸ **未关** | 由 Zone 级 RUM 注入规则下发，token 无法暂停；`type="module"` 延后执行，不影响 LCP 与评分（10.2KB） |
| B3 关邮箱混淆 | ✅ | 页面不再注入 `email-decode.min.js` |
| B4 开 Smart Tiered Cache | ✅ | 边缘未命中改走上级层，不再直连 Pages 回源 |
| B5 文章页 `max-age` 60→300 | ✅ | 回访者少一次 304 往返 |
| C1 Speculation Rules 预渲染 | ⏸ **未启用** | 见 8.3，收益小于风险 |
| C2 预取分级 | ✅ | `prefetchAll: false`；卡片/上下篇 `viewport`，导航 `hover` |

### 8.2 前后对比（本机 preview + Lighthouse 移动端模拟）

| 页面 | 指标 | 基线 | 上线版 | 变化 |
| :--- | :--- | :--- | :--- | :--- |
| 首页 | Perf / FCP / LCP | 100 / 1,055ms / 1,206ms | 100 / 1,054ms / 1,204ms | 持平 |
| 首页 | 请求数 / 传输量 | 10 / 45.2 KB | 9 / 44.2 KB | −1 请求 / −1 KB |
| 公式页 | Perf / FCP / LCP | 99 / 1,656ms / 1,656ms | 99 / 1,654ms / 1,654ms | 持平 |
| 公式页 | 请求数 / 传输量 | 13 / 112.3 KB | 12 / 106.6 KB | −1 请求 / **−5.7 KB** |

**结论**：页面层确实到顶了——Lab 分数本来就打满，本轮的真实收益是"少一次预取、少 5.7KB、冷启动更快、回访少一次往返"，而不是分数变化。剩下能明显改善体感的只有网络层（P1）。

### 8.3 为什么砍掉内联 CSS 和预渲染

**内联 CSS（实测数据）**

| 方案 | FCP | LCP | 传输量 |
| :--- | :--- | :--- | :--- |
| 外链 CSS（基线） | 1,055ms | 1,206ms | 45.2 KB |
| 外链 CSS（仅收窄预取） | 1,055ms | **1,131ms** | 43.5 KB |
| 内联 CSS | **979ms** | 1,205ms | 57.1 KB |

渲染阻塞确实是 152ms，内联也确实吃掉了它（FCP 领先），但多出来的 6.7KB 塞在文档里会推迟 LCP 文本绘制，两者几乎抵消；再加上预取文档也被撑大（13.1KB → 19.8KB/页），最终决定保留外链 CSS。

**预渲染**：Astro 4 生成的 speculation rules 是 `source: "list"`，eagerness 等效 `immediate`——首页会把首屏所有挂了 `viewport` 的卡片立刻整页预渲染。预渲染页会执行脚本，评论区的 `IntersectionObserver`（rootMargin 600px）很可能在预渲染时就拉起 giscus 的 ~100KB 资源；而它换来的只是省一次 DOM 解析（网络等待早已被 prefetch 吃掉）。等站点访问量上来再单独 A/B。

### 8.4 下一步（P1 建议）

1. 用 itdog/站长工具跑三网测速，拿到大陆真实 TTFB。
2. 若 p75 TTFB > 250ms → 香港 VPS + GeoDNS 双线（详见第四章 A2/A5）。
3. 顺带可做：评论区改为"点击加载"，避免每个读完文章的访客都拉 giscus 的 ~100KB 第三方资源。

---

## 九、参考

- [Cloudflare China Network（需 Enterprise + ICP）](https://developers.cloudflare.com/china-network/)
- [Cloudflare Speed Brain：基于 Speculation Rules API](https://developers.cloudflare.com/speed/optimization/content/speed-brain/)
- [Astro Prefetch / Speculation Rules](https://docs.astro.build/en/guides/prefetch/)
- [Astro 实验特性：Client Prerender](https://docs.astro.build/en/reference/experimental-flags/client-prerender/)
- [Smart Tiered Cache 全计划免费](https://developers.cloudflare.com/changelog/post/2026-04-17-smart-tiered-cache-for-public-cloud/)
- [可备案域名后缀说明](https://www.pady.com.cn/record/262710.html)
- [境外注册域名的备案要求](https://www.pady.com.cn/record/262711.html)
- [FaaS-in-China：CF/Vercel/Netlify 大陆访问优化实践](https://github.com/1143520/enhanced-FaaS-in-China)
