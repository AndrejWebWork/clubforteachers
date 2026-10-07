import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { pages } from "./src/site.js";
import { clubApiMiddleware } from "./server/clubDb.mjs";

function sitemapXml(origin) {
  const base = origin.replace(/\/$/, "");
  const urls = pages
    .map((page) => {
      const priority = page.path === "/" ? "1.0" : page.path.startsWith("/prav") || page.path === "/privatnost" ? "0.4" : "0.8";
      return `  <url><loc>${base}${page.path}</loc><changefreq>weekly</changefreq><priority>${priority}</priority></url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function clubApi() {
  return {
    name: "club-api",
    configureServer(server) {
      server.middlewares.use(clubApiMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(clubApiMiddleware());
    },
  };
}

function seoFiles() {
  return {
    name: "seo-files",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/sitemap.xml") return next();
        const proto = req.headers["x-forwarded-proto"] || "http";
        const host = req.headers.host || "127.0.0.1:5173";
        res.setHeader("Content-Type", "application/xml; charset=utf-8");
        res.end(sitemapXml(`${proto}://${host}`));
      });
    },
    generateBundle() {
      const origin = process.env.VITE_SITE_URL || "http://127.0.0.1:5173";
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemapXml(origin) });
    },
  };
}

export default defineConfig({
  plugins: [clubApi(), react(), tailwindcss(), seoFiles()],
});
