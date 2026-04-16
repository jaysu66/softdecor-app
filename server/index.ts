import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { uploadRoute } from "./routes/upload";
import { analyzeRoute } from "./routes/analyze";
import { recommendRoute } from "./routes/recommend";
import { refineRoute } from "./routes/refine";
import { agentRoute } from "./routes/agent";
import { composeRoute } from "./routes/compose";
import { assertLLMConfig } from "./lib/llm";
import fs from "fs";
import path from "path";


assertLLMConfig();

const app = new Hono();

// CORS
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// Body size limit
app.use("*", async (c, next) => {
  // Allow large uploads (20MB)
  await next();
});

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Data directory: project assets/ first, then external DATA_DIR, then legacy path
const ASSETS_DIR = process.env.DATA_DIR || path.resolve(__dirname, "../assets");

// Products API - serve product data with cutout URLs (transparent bg)
app.get("/api/products", (c) => {
  const productsPath = path.resolve(__dirname, "data/products.json");
  const urlsPath = path.resolve(__dirname, "data/uploaded_urls.json");
  const cutoutUrlsPath = path.join(ASSETS_DIR, "cutout_urls.json");
  const products = JSON.parse(fs.readFileSync(productsPath, "utf-8"));
  const urls = JSON.parse(fs.readFileSync(urlsPath, "utf-8"));
  let cutoutUrls: Record<string, string> = {};
  try { cutoutUrls = JSON.parse(fs.readFileSync(cutoutUrlsPath, "utf-8")); } catch {}

  const merged = products.map((p: any) => ({
    ...p,
    img: cutoutUrls[p.sku] || urls[p.sku] || p.img,
    imgOriginal: urls[p.sku] || p.img,
  }));

  return c.json(merged);
});

// Room background images API
app.get("/api/backgrounds", (c) => {
  const bgDir = path.join(ASSETS_DIR, "room-backgrounds");
  try {
    const files = fs.readdirSync(bgDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    const backgrounds = files.map(f => ({
      name: f.replace(/\.\w+$/, "").replace(/-/g, " "),
      url: `/api/bg-image/${f}`,
    }));
    return c.json(backgrounds);
  } catch {
    return c.json([]);
  }
});

// Serve background image files
app.get("/api/bg-image/:filename", (c) => {
  const filename = c.req.param("filename");
  const filePath = path.join(ASSETS_DIR, "room-backgrounds", filename);
  if (!fs.existsSync(filePath)) return c.json({ error: "Not found" }, 404);
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const mime = ext === ".png" ? "image/png" : "image/jpeg";
  return new Response(buffer, { headers: { "Content-Type": mime } });
});

// Serve cutout product images locally (fallback before upload completes)
app.get("/api/cutout/:filename", (c) => {
  const filename = c.req.param("filename");
  const filePath = path.join(ASSETS_DIR, "products-cutout", filename);
  if (!fs.existsSync(filePath)) return c.json({ error: "Not found" }, 404);
  const buffer = fs.readFileSync(filePath);
  return new Response(buffer, { headers: { "Content-Type": "image/png" } });
});

// Mount routes
app.route("/api", uploadRoute);
app.route("/api", analyzeRoute);
app.route("/api", recommendRoute);
app.route("/api", refineRoute);
app.route("/api", agentRoute);
app.route("/api", composeRoute);

// Serve uploaded files
app.get("/uploads/:filename", (c) => {
  const filename = c.req.param("filename");
  const filePath = path.resolve(__dirname, "uploads", filename);
  if (!fs.existsSync(filePath)) {
    return c.json({ error: "File not found" }, 404);
  }
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };
  return new Response(buffer, {
    headers: { "Content-Type": mimeTypes[ext] || "application/octet-stream" },
  });
});

const port = 3001;
console.log(`Server running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
