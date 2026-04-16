import { Hono } from "hono";
import fs from "fs";
import path from "path";

export const recommendRoute = new Hono();

interface Product {
  sku: string;
  name: string;
  cat: string;
  style: string;
  color: string;
  material: string;
  size: string;
  price: number;
  place: string;
  trans: number;
  refl: number;
  rough: number;
  img: string;
  space: string;
  related: string;
}

function loadProducts(): Product[] {
  const productsPath = path.resolve(__dirname, "../data/products.json");
  const urlsPath = path.resolve(__dirname, "../data/uploaded_urls.json");
  const products = JSON.parse(fs.readFileSync(productsPath, "utf-8"));
  const urls = JSON.parse(fs.readFileSync(urlsPath, "utf-8"));
  return products.map((p: any) => ({
    ...p,
    img: urls[p.sku] || p.img,
  }));
}

// Style compatibility map
const STYLE_COMPAT: Record<string, string[]> = {
  "北欧": ["北欧", "日式", "现代简约"],
  "现代简约": ["现代简约", "北欧", "轻奢"],
  "轻奢": ["轻奢", "现代简约"],
  "日式": ["日式", "北欧", "侘寂"],
  "中式": ["中式", "日式"],
  "侘寂": ["侘寂", "日式", "北欧"],
};

function scoreProduct(product: Product, analysis: any): number {
  let score = 0;
  const style = analysis.style || "";
  const room = analysis.room_type || "";
  const categories = analysis.suggested_categories || [];
  const secondaryStyles = analysis.secondary_styles || [];

  // Style match (primary)
  if (product.style === style) score += 30;
  // Style match (secondary)
  else if (secondaryStyles.includes(product.style)) score += 20;
  // Style compatibility
  else if (STYLE_COMPAT[style]?.includes(product.style)) score += 10;

  // Category match
  if (categories.some((cat: string) => product.cat.includes(cat) || cat.includes(product.cat))) {
    score += 25;
  }

  // Space match
  if (product.space.includes(room)) score += 15;

  // Related items boost
  const existing = analysis.existing_furniture || [];
  if (existing.some((f: string) => product.related.includes(f))) score += 5;

  return score;
}

function generateSchemes(products: Product[], analysis: any): any[] {
  const scored = products.map((p) => ({
    product: p,
    score: scoreProduct(p, analysis),
  })).filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

  // Scheme A: Best match (top scoring, diverse categories)
  const schemeA: Product[] = [];
  const usedCatsA = new Set<string>();
  for (const s of scored) {
    if (schemeA.length >= 7) break;
    // Allow max 2 per category
    const catCount = schemeA.filter((p) => p.cat === s.product.cat).length;
    if (catCount < 2) {
      schemeA.push(s.product);
      usedCatsA.add(s.product.cat);
    }
  }

  // Scheme B: Alternative style mix
  const schemeB: Product[] = [];
  const usedSkus = new Set(schemeA.map((p) => p.sku));
  for (const s of scored) {
    if (schemeB.length >= 6) break;
    if (!usedSkus.has(s.product.sku)) {
      const catCount = schemeB.filter((p) => p.cat === s.product.cat).length;
      if (catCount < 2) {
        schemeB.push(s.product);
      }
    }
  }

  // If scheme B is too small, fill with remaining scored items
  if (schemeB.length < 5) {
    for (const s of scored) {
      if (schemeB.length >= 6) break;
      if (!schemeB.find((p) => p.sku === s.product.sku)) {
        schemeB.push(s.product);
      }
    }
  }

  const totalA = schemeA.reduce((sum, p) => sum + p.price, 0);
  const totalB = schemeB.reduce((sum, p) => sum + p.price, 0);

  return [
    {
      id: "scheme-a",
      name: "精选搭配方案",
      description: `完美匹配${analysis.style || "当前"}风格，${schemeA.length}件精选单品`,
      products: schemeA,
      totalPrice: totalA,
    },
    {
      id: "scheme-b",
      name: "混搭风格方案",
      description: `融合多种风格元素，${schemeB.length}件创意单品`,
      products: schemeB,
      totalPrice: totalB,
    },
  ];
}

recommendRoute.post("/recommend", async (c) => {
  try {
    const { analysis } = await c.req.json();

    if (!analysis) {
      return c.json({ error: "No analysis data provided" }, 400);
    }

    const products = loadProducts();
    const schemes = generateSchemes(products, analysis);

    return c.json({ success: true, schemes });
  } catch (err: any) {
    console.error("Recommend error:", err);
    return c.json({ error: err.message }, 500);
  }
});
