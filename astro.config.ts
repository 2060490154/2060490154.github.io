import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import sitemap from "@astrojs/sitemap";
import { SITE } from "./src/config";
// other imports
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// https://astro.build/config
export default defineConfig({
  site: SITE.website,
  // Prefetch only what the visitor is actually likely to open: post cards and
  // prev/next links carry `data-astro-prefetch="viewport"`; everything else is
  // left alone. `prefetchAll` would fetch every link in the viewport (~66 KB on
  // the home page) which is wasted on mobile data plans.
  prefetch: {
    prefetchAll: false,
    defaultStrategy: "hover",
  },
  // Tried `build.inlineStylesheets: "always"` (2026-10-27): the render-blocking
  // CSS hop (~152 ms wasted) disappears and FCP improves ~75 ms, but the extra
  // ~7 KB of CSS inside every document — including every prefetched document —
  // delays the LCP text paint by a similar amount (~70 ms) and grows total
  // transfer by ~12 KB. Net change on LCP was zero, so the external 1-year
  // immutable stylesheet stays.
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    react(),
    sitemap({
      filter: page => SITE.showArchives || !page.endsWith("/archives"),
    }),
  ],
  markdown: {
    remarkPlugins: [
      remarkMath,
      remarkToc,
      [
        remarkCollapse,
        {
          test: "Table of contents",
        },
      ],
    ],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      // For more themes, visit https://shiki.style/themes
      themes: { light: "min-light", dark: "night-owl" },
      wrap: true,
    },
  },
  vite: {
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
  scopedStyleStrategy: "where",
  experimental: {
    contentLayer: true,
  },
});
