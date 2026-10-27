# 访客加载速度调研报告

> 调研日期：2026-10-27 ｜ 站点：<https://ljx520.me/> ｜ 结论基于**仓库代码审查 + 线上实测**（Lighthouse / curl / DNS 探测）。

---

## 一、结论先行

**页面本身已经没有多少可榨的油水了，剩下的时间基本都花在"路上"。**

| 判断 | 依据 |
| :--- | :--- |
| 实验室性能已接近满分 | 数学页移动端 Performance **99**，FCP/LCP 1.4s、TBT 0ms、CLS 0、16 个请求、123KB |
| 首屏资源极小 | HTML 5.5KB、CSS 7.5KB、JS 6.5KB（均为 Brotli 后实测值） |
| 无双字体/无外链图片/无重型三方脚本 | 字体走系统栈，正文 0 张图片，评论区改点击加载后文章页 0 个第三方域名 |
| **剩余瓶颈按影响排序** | ①大陆/远距离网络的 RTT ②1 个渲染阻塞 CSS ③CF Web Analytics 信标 ④首次回源 ⑤全量预取 |

一句话：**想再快一步，主要靠"换更近的路"（网络层），而不是"再删几 KB"（页面层）。**

---

## 二、实测基线

### 2.1 Lighthouse（本机 Chrome，经本机代理，绝对数值偏大、比例可信）

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

| # | 瓶颈 | 影响 | 量级（实测） | 处理状态 |
| :--- | :--- | :--- | :--- | :--- |
| R1 | **网络路径**（大陆访客 → CF 边缘） | TTFB 与首包决定一切 | **TCP 502ms + TLS 342ms**（RUM p75） | ⛔ 只能换线路，要钱 |
| R2 | **1 个渲染阻塞 CSS** | 首屏要等第 2 个 RTT | 152ms（Lighthouse `wastedMs`） | ⚖️ A/B 两轮后放弃，见 8.3 |
| R3 | **CF Web Analytics 信标 10.2KB** | 多一个第三方域名 = 一次 TLS | 30–150ms | ⏸ 需面板关闭 |
| R4 | **首次回源 1–2s**（缓存未命中） | 冷启动体验断崖 | 1–2s | ✅ Smart Tiered Cache 已开 |
| R5 | **预取 8 个页面 ≈ 66KB** | 移动端流量与解析开销 | 4G 下 0.3–0.8s | ✅ 已收窄到卡片/上下篇 |
| R6 | **没有预渲染**，切换仍是文档级导航 | 点开文章要等 1 个 RTT | 大陆 0.15–0.4s | ⏸ 评估后不做，见 8.3 |
| R7 | **HTML `max-age` 过短** | 回访者反复 304 / 重新握手 | 1×RTT（大陆 ~840ms） | ✅ 文章 1h / 列表 5min |
| R8 | 数学页 KaTeX 字体 68KB | 仅 1 篇含公式 | 一次性 | ⏸ 子集化性价比低 |
| R9 | 搜索页 React 132KB（`client:idle`） | 仅搜索页，空闲加载 | 40KB br | ⏸ 未做 |
| R10 | 边缘回源 Pages 需跨洋 | 与 R4 同源 | 见 R4 | ✅ 同 R4 |

> 说明：R1 是唯一"改代码解决不了、只能换线路"的一项；R2/R6 都已做过 A/B 并明确不做；R3/R8/R9 是剩余的可选项。

---

## 四、方案矩阵

### A. 网络 / 托管层（决定大陆访客体感，收益最大）

#### A1. Cloudflare 优选 IP / 自定义 CNAME（FaaS-in-China）
- **做法**：不走 CF 官方 NS 解析，改用第三方"优选域名/优选 IP"或 Partner 的 CNAME 接入，让大陆三网解析到延迟最低的 CF 边缘 IP。
- **预期**：RTT 从 200ms+ 降到 60–150ms；LCP 改善 0.3–0.8s。
- **成本**：0 元。
- **风险**：⚠️ 依赖第三方域名稳定性；IP 段可能被封；与 Pages 自定义域集成别扭（要摘掉 Pages domain 的解析）；属于"能用但不体面"的方案。
- **适配度**：★☆☆☆☆。**本项目直接不适用**：Pages 自定义域要求域名 zone 托管在 Cloudflare，而优选 IP 要求把 NS 迁到第三方 DNS（DNSPod 等），两者互斥。网上的 FaaS-in-China 教程基本面向 Vercel/Netlify。

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
| **B1** | **内联全站 CSS** | `astro.config.ts` 加 `build: { inlineStylesheets: "always" }` | 省掉 1 个渲染阻塞往返：大陆 ≈40–200ms，海外 ≈10–30ms | HTML 增大约 7.5KB（br 后），且预取文档一起变大；**实测两轮 A/B 后净收益为零，已放弃**（见 8.3） |
| **B2** | **关掉 CF Web Analytics 信标** | Cloudflare 面板 → 该 Pages 项目 / Web Analytics → 关闭自动注入 | 少 1 个三方请求 + 10.2KB（High 优先级），首屏更快、隐私更干净 | 失去 RUM 数据；若要留存，改用自建 Umami 或仅在需要时开 |
| **B3** | **关闭 Email Obfuscation** | Scrape Shield → Email Address Obfuscation 关闭 | 少 `email-decode.min.js` 0.9KB（因站点有 `mailto:` 分享链接被注入） | 邮箱明文暴露（本站无真实邮箱，无影响） |
| **B4** | **开 Tiered Cache** | Caching → Tiered Cache → 开启（Free 计划免费） | 缓存未命中时先到上级层，不再直接跨洋回源 → 冷启动从 1–2s 降到数百 ms | 无 |
| **B5** | **HTML 缓存 TTL** | 文章页 `60 → 3600`，列表页 `60 → 300` | 回访者在窗口期内**零请求**，直接绕过一次 ~840ms 的跨境握手 | 改文章后最多 1 小时才在回访者浏览器更新（可 Purge 边缘，但浏览器窗口不可撤回） |
| B6 | Early Hints 真正生效 | 需要源站返回 `Link: <css>; rel=preload`，本项目 CSS 名带 hash，无法写死 | —— | **不做**，B1 已覆盖 |
| B7 | Brotli / HTTP/3 / 0-RTT | 已开启 | —— | 维持现状 |

---

### C. 前端层

| 编号 | 方案 | 做法 | 预期收益 | 风险 |
| :--- | :--- | :--- | :--- | :--- |
| **C1** | **Speculation Rules 预渲染** | `astro.config.ts` 的 `prefetch` 加 `experimental: { clientPrerender: true }` | 点击文章 = 瞬时（导航前已渲染好），比 `<link rel=prefetch>` 强 | ⚠️ 预渲染会执行脚本、占内存；Astro 4 的 list 规则等效 `immediate`。评论区改点击加载后风险已降低，但收益仍薄 → **评估后暂不开**（见 8.3） |
| **C2** | **预取分级** | `prefetchAll: false`，只在文章卡片、上一篇/下一篇加 `data-astro-prefetch="viewport"`，导航链接用 `hover` | 首屏少发 6–8 个请求（≈50KB），移动端流量友好 | 少部分链接失去秒开（可用 hover 兜底） |
| **C3** | 搜索页去 React | 用原生 JS 重写 Fuse 搜索（保留 URL `?q=` 同步） | 搜索页省 ~40KB（br）与 132KB 运行时 | 约 2–3 小时开发 + 回归测试 |
| **C4** | KaTeX 字体子集 | 只用 `KaTeX_Main-Regular/Math-Italic` 两个 woff2，其余按需 | 数学页最多省 40KB | 特殊符号可能缺字，**不建议**（只有 2 篇） |
| **C5** | 图片管线 | 未来配图放 `src/assets/` + `<Image />`（AVIF/WebP + 尺寸 + lazy） | 新文章才有意义 | 已写进 BLOG_CONFIG，无需改动 |
| C6 | Astro 5 升级 | 按官方 upgrade guide 走（`astro:transitions` → `ClientRouter`） | 构建更快、组件更小，**对访客 LCP 影响很小** | 中等迁移成本，收益不成正比，**暂缓** |

---

### D. 观测层（没有数据就没有优化）

| 编号 | 方案 | 说明 |
| :--- | :--- | :--- |
| **D1** | 国内多节点测速 | itdog.cn / 站长工具三网测速。**已不需要**：Cloudflare RUM 的 GraphQL 数据直接给了分国家的 TTFB/LCP 与 DNS/TCP/TLS 分段（见 8.5） |
| **D2** | 真实用户监控 | ✅ CF Web Analytics 已在跑，数据见 8.5；若将来按 B2 关掉，改用 Umami/自托管 |
| **D3** | 回归防线 | GitHub Actions 里加 Lighthouse CI（阈值 LCP < 1.5s @ mobile），防止后续改动回退 |
| **D4** | 缓存观测 | 定期抓 `cf-cache-status` 与 `Server-Timing`，确认边缘命中率（尤其发版后） |

---

## 五、推荐路线

### P0 —— 已于 2026-10-27 执行完毕

| 项 | 结果 |
| :--- | :--- |
| B1 内联 CSS | ⚖️ 两轮 A/B 后放弃（150ms / 300ms RTT 都抵消），见 8.3 |
| B2 关信标 | ⏸ 需面板手动，token 改不动 zone 级注入规则 |
| B3 关邮箱混淆 | ✅ 已关 |
| B4 Tiered Cache | ✅ 已开（Smart Tiered Cache） |
| B5 HTML TTL | ✅ 文章 3600s / 列表 300s |
| C1 预渲染 | ⏸ 评估后不做，见 8.3 |
| C2 预取分级 | ✅ 卡片/上下篇 `viewport`，导航 `hover` |
| C3 评论区点击加载 | ✅ 额外加的，收益最大（文章页 −116KB） |

### P1 —— 已用真实数据做完决策

1. ✅ 真实数据已拿到（见 8.5）：大陆 TTFB p75 **930ms**，其中 TCP 502 + TLS 342；LCP p75 **1.5s**。
2. 结论：**不买 VPS**。理由不是省钱，而是收益不成正比——LCP 已在良好线内，VPS 只能把首次访问的 844ms 压到 ~150ms，而它同时带来运维、证书、单点故障、DDoS 无防护等成本。
3. 触发条件（满足任一再考虑）：访客量明显上来 / 大陆访客占比高且有人抱怨 / 将来有闲钱与闲时。届时走 A2 + A5（香港 CN2 线路 + GeoDNS 双线）。

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
| KaTeX 字体子集化 | 只有 1 篇公式文章，收益 40KB，缺字风险不值得 |
| Astro 5 大版本升级 | 对访客 LCP 几乎无收益，迁移成本不低 |

---

## 七、验收标准与实际结果

| 指标 | 优化前 | 现在 | 说明 |
| :--- | :--- | :--- | :--- |
| 移动端 Lighthouse Perf | 99–100 | **100** | 本来就打满，扣分项极少 |
| 首页 请求 / 传输 | 10 / 45.2 KB | **9 / 44.2 KB** | 本机口径 |
| 文章页 请求 / 传输 | 29 / 153.1 KB | **8 / 27.0 KB** | 线上口径，评论点击加载 |
| 大陆 TTFB p75 | 930 ms | 930 ms | 免费手段改不动握手 |
| 大陆 LCP p75 | 1,516 ms | 1,516 ms | 已达良好线（2.5s） |
| 回访窗口 | 60 s | **文章 1 h / 列表 5 min** | 窗口内零请求 |

> 说明：TTFB 这一行不会有变化，这是 CF 免费版的路由决定的，不是代码问题。把它留在表里，是为了以后有人再问"为什么没变快"时有个对照。

---

## 八、P0 实施与验证结果（2026-10-27）

### 8.1 落地情况

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| B1 内联全站 CSS | ❌ **A/B 后回退** | FCP −76ms，但 LCP +70ms、传输 +12KB，净收益为零 |
| B2 关 Web Analytics 信标 | ⏸ **未关** | 由 Zone 级 RUM 注入规则下发，token 无法暂停；`type="module"` 延后执行，不影响 LCP 与评分（10.2KB） |
| B3 关邮箱混淆 | ✅ | 页面不再注入 `email-decode.min.js` |
| B4 开 Smart Tiered Cache | ✅ | 边缘未命中改走上级层，不再直连 Pages 回源 |
| B5 HTML 浏览器 TTL | ✅ | 文章 `60→3600`、列表 `60→300`；回访窗口内零请求 |
| C1 Speculation Rules 预渲染 | ⏸ **未启用** | 见 8.3，收益小于风险 |
| C2 预取分级 | ✅ | `prefetchAll: false`；卡片/上下篇 `viewport`，导航 `hover` |
| C3 评论区点击加载 | ✅ | giscus 改为按钮触发，文章页 **29 请求/153KB → 8 请求/27KB**（−83%） |
| B8 Always Use HTTPS | ✅ | 裸域名访问不再先吃一次 `http → https` 301 |
| B9 HTML 浏览器 TTL | ✅ | 文章 3600s / 列表 300s，回访窗口内零请求 |

### 8.2 前后对比（本机 preview + Lighthouse 移动端模拟）

| 页面 | 指标 | 基线 | 上线版 | 变化 |
| :--- | :--- | :--- | :--- | :--- |
| 首页 | Perf / FCP / LCP | 100 / 1,055ms / 1,206ms | 100 / 1,054ms / 1,204ms | 持平 |
| 首页 | 请求数 / 传输量 | 10 / 45.2 KB | 9 / 44.2 KB | −1 请求 / −1 KB |
| 公式页 | Perf / FCP / LCP | 99 / 1,656ms / 1,656ms | 99 / 1,654ms / 1,654ms | 持平 |
| 公式页 | 请求数 / 传输量 | 13 / 112.3 KB | 12 / 106.6 KB | −1 请求 / **−5.7 KB** |

> 上表只反映 P0 的代码改动；评论区改为点击加载后，文章页请求数进一步下降，实测见 8.6。

**结论**：页面层确实到顶了——Lab 分数本来就打满，本轮的真实收益是"少一次预取、少 5.7KB、冷启动更快、回访少一次往返"，而不是分数变化。剩下能明显改善体感的只有网络层（P1）。

### 8.3 为什么砍掉内联 CSS 和预渲染

**内联 CSS（实测数据）**

| 方案 | FCP | LCP | 传输量 |
| :--- | :--- | :--- | :--- |
| 外链 CSS（基线） | 1,055ms | 1,206ms | 45.2 KB |
| 外链 CSS（仅收窄预取） | 1,055ms | **1,131ms** | 43.5 KB |
| 内联 CSS | **979ms** | 1,205ms | 57.1 KB |

渲染阻塞确实是 152ms，内联也确实吃掉了它（FCP 领先），但多出来的 6.7KB 塞在文档里会推迟 LCP 文本绘制，两者几乎抵消；再加上预取文档也被撑大（13.1KB → 19.8KB/页），最终决定保留外链 CSS。

用 300ms RTT 复测也得到同样结论：

| 页面 | 外链 CSS | 内联 CSS | 差 |
| :--- | ---: | ---: | ---: |
| 首页 LCP | 2,258 ms | **2,103 ms** | 内联赢 155 ms |
| 公式页 LCP | **2,706 ms** | 3,004 ms | 内联输 298 ms |

**预渲染**：Astro 4 生成的 speculation rules 是 `source: "list"`，eagerness 等效 `immediate`——首页会把首屏所有挂了 `viewport` 的卡片立刻整页预渲染，占内存与 CPU。评论区改成点击加载后，"预渲染提前拉起 giscus"的风险已经消失，但收益（省一次 DOM 解析，网络等待早被 prefetch 吃掉）依然很薄。**当前不启用**；等站点访问量上来、且有低端设备实测需求时再单独 A/B。

### 8.4 结论与后续触发条件

1. ✅ 真实数据已拿到（见 8.5）：大陆 TTFB p75 **930ms**，其中 844ms 是跨境握手；LCP p75 **1.5s**。
2. ✅ 评论区改点击加载：文章页第三方资源 **116KB → 0**。
3. ✅ 免费侧收尾：`Always Use HTTPS` 开启、HTML 浏览器 TTL 拉长（文章 1h / 列表 5min）。
4. ⛔ **不买 VPS**：LCP 已在良好线内，VPS 只能把首次访问的握手从 844ms 压到 ~150ms，换来的是月租、证书、单点故障与运维成本，性价比不成立。
5. 重新启动 P1 的触发条件（满足任一）：大陆访客占比明显上升 / 有访客明确抱怨慢 / 有了闲钱与闲时。届时走 A2 + A5（香港 CN2 线路 + GeoDNS 双线）。

### 8.5 真实用户数据（2026-10-13 ~ 10-27，Cloudflare RUM）

实验室之外，第一次拿到线上访客的真实分段数据：

| 国家 | 样本 | TTFB p75 | FCP p75 | LCP p75 |
| :--- | ---: | ---: | ---: | ---: |
| 中国大陆 | 20 | **930 ms** | 1,512 ms | **1,516 ms** |
| 日本 | 20 | 861 ms | 1,408 ms | 1,408 ms |

TTFB 拆分（7 天）：

| 国家 | DNS | TCP 建连 | TLS 握手 |
| :--- | ---: | ---: | ---: |
| 中国大陆 | 26 ms | **502 ms** | **342 ms** |
| 日本 | 0 ms | 183 ms | 291 ms |
| 美国 | 10 ms | 18 ms | 17 ms |

**这组数字改变了优化优先级：**

1. 大陆访客的 930ms TTFB 中，**844ms 是跨境 TCP+TLS 握手**，服务端响应可以忽略。
2. 所以页面层已经没有任何能再抠的空间——之前内联 CSS 的 A/B（300ms RTT 下首页 −155ms、公式页 +298ms）也印证了这点：省 RTT 的收益被更大的文档吃掉。
3. **LCP p75 = 1.5s 已经达标**（良好线 2.5s），不属于"必须花钱修"的问题。

免费区间还能做的三件事（已落地）：

| 做法 | 原理 | 状态 |
| :--- | :--- | :--- |
| HTML TTL 拉长（文章 1h / 列表 5min） | 回访者窗口期内零请求，直接绕过 844ms 握手 | ✅ |
| 开启 Always Use HTTPS | 裸域名访问不再先吃一次 301 | ✅ |
| 第三方域名清零 / 点击加载 | 每个新域名 = 一次独立的 DNS+TCP+TLS，在大陆就是 +840ms | ✅（giscus 已改，信标待手动关） |

> 注意：**Cloudflare 优选 IP 对 Pages 自定义域不适用**——它要求把域名的 NS 迁出 Cloudflare，而 Pages 自定义域依赖 zone 托管在 Cloudflare。想靠它提速只能换托管方式，收益不确定、稳定性也差，不建议。

**结论**：在没有预算的前提下，这套站已经到顶了。剩下的 844ms 只能靠"换一条更近的路"（境外优化线路 VPS / 可备案域名 + 国内 CDN），而那两条路都需要钱或备案资格。当前状态（LCP 1.5s）是可以安心不折腾的水平。

### 8.6 评论区实测账目

| 来源 | 请求数 | 传输量 | 点击加载后 |
| :--- | :--- | :--- | :--- |
| giscus.app | 19 | 98.0 KB | 0 |
| github.githubassets.com | 1 | 18.3 KB | 0 |
| 本站 HTML/CSS/JS | 8 | 26.6 KB | 7 / 25.9 KB |
| CF 分析信标 | 1 | 10.2 KB | 1 |
| **合计** | **29** | **153.1 KB** | **8 / 36 KB** |

注：giscus 最初是 `IntersectionObserver` 懒加载（离视口 600px），所以它从不影响 FCP/LCP；改为按钮触发后，连"读到文末就自动拉 116KB"也省了。文中数字为 **Lighthouse 实测**（它会滚动页面，所以旧版会触发懒加载），而真实读者只有在点击按钮时才付出这 116KB。

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
