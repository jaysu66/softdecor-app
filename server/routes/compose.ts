import { Hono } from "hono";
import { LLM_BASE_URL, LLM_VISION_MODEL, llmHeaders } from "../lib/llm";

export const composeRoute = new Hono();

const ARK_ENDPOINT = process.env.ARK_ENDPOINT || "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const ARK_KEY = process.env.ARK_KEY || "";

function ensureDataUrl(b64: string): string {
  if (b64.startsWith("data:")) return b64;
  return `data:image/jpeg;base64,${b64}`;
}

// ─── 多图合成（主路由） ───
composeRoute.post("/compose", async (c) => {
  try {
    const { roomImageBase64, selectedProducts, analysis } = await c.req.json();

    if (!selectedProducts || selectedProducts.length === 0) {
      return c.json({ error: "No products selected" }, 400);
    }

    // ── 构建 image_urls 数组 ──
    // Seedream 5.0 最多 10 张参考图
    const imageUrls: string[] = [];
    const imageDescs: string[] = [];

    // 第1张：房间照片
    if (roomImageBase64) {
      imageUrls.push(ensureDataUrl(roomImageBase64));
      imageDescs.push("第1张图：用户的房间照片");
    }

    // 第2张起：商品抠图（从 product.img 取，已是 cutout URL）
    const maxProducts = roomImageBase64 ? 9 : 10;
    const productsIncluded: any[] = [];

    for (const p of selectedProducts.slice(0, maxProducts)) {
      const imgUrl = p.img;
      // 只接受 http URL（抠图托管在 iili.io）
      if (imgUrl && imgUrl.startsWith("http")) {
        imageUrls.push(imgUrl);
        const idx = imageUrls.length;
        const placement = p.place === "floor" ? "地面"
          : p.place === "back" ? "墙面"
          : p.place === "ceiling" ? "天花板"
          : p.place === "surface" ? "家具表面上" : p.place;
        imageDescs.push(`第${idx}张图：${p.name}（${p.color}，${p.material}，尺寸${p.size}cm，放置：${placement}）`);
        productsIncluded.push({ ...p, refIndex: idx });
      }
    }

    console.log(`Compose: ${imageUrls.length} images (1 room + ${productsIncluded.length} products)`);

    // 如果没有可用的商品图 URL，走单图 fallback
    if (productsIncluded.length === 0) {
      console.log("No product image URLs, falling back to single-image mode");
      return await singleImageCompose(c, roomImageBase64, selectedProducts, analysis);
    }

    // ── Step 1: Claude 生成引用多图的 prompt ──
    const roomInfo = analysis
      ? `房间：${analysis.room_type}，风格：${analysis.style}，光线：${analysis.lighting}，色调：${analysis.color_tone}`
      : "现代风格房间";

    const claudeMessages: any[] = [{
      role: "user",
      content: [] as any[],
    }];

    // 给 Claude 看房间图以便理解空间
    if (roomImageBase64) {
      claudeMessages[0].content.push({
        type: "image_url",
        image_url: { url: ensureDataUrl(roomImageBase64) },
      });
    }

    claudeMessages[0].content.push({
      type: "text",
      text: `你正在为 Seedream 图像生成模型写 prompt。共有 ${imageUrls.length} 张参考图：
${imageDescs.join("\n")}

${roomInfo}

请生成 prompt，要求：
1. 保持第1张图房间的建筑结构（墙面、地板、窗户、天花板）完全不变
2. 将每件商品以其参考图中的真实外观放入房间对应位置
3. 具体描述每件商品在房间中的摆放位置和朝向
4. 商品之间保持合理的空间关系和比例
5. 匹配房间现有光线，添加自然阴影和反射
6. 整体风格：高端室内设计杂志摄影

只输出 prompt，不超过 250 字。必须用"第N张图"引用每件商品。`,
    });

    console.log("Compose: LLM generating multi-ref prompt...");
    const llmResp = await fetch(LLM_BASE_URL, {
      method: "POST",
      headers: llmHeaders(),
      body: JSON.stringify({ model: LLM_VISION_MODEL, max_tokens: 600, messages: claudeMessages }),
      signal: AbortSignal.timeout(30000),
    });

    if (!llmResp.ok) {
      const err = await llmResp.text();
      console.error("LLM error:", err.slice(0, 300));
      return c.json({ error: "AI prompt generation failed" }, 500);
    }

    const llmData = await llmResp.json();
    const scenePrompt = llmData.choices?.[0]?.message?.content?.trim() || "";
    console.log("Prompt:", scenePrompt.slice(0, 200));

    // ── Step 2: Seedream 多图生成 ──
    // 方案A: image_url 锁房间底图 + image_urls 提供商品参考图
    console.log(`Compose: Seedream multi-image (${imageUrls.length} refs)...`);
    const seedBody: any = {
      model: "doubao-seedream-5-0-260128",
      prompt: scenePrompt,
      image_urls: imageUrls,
      strength: 0.30,
      size: "1920x1920",
      n: 1,
      response_format: "b64_json",
      watermark: false,
    };

    // image_url 单独锁住房间作为 img2img 底图（与 image_urls 共存）
    if (roomImageBase64) {
      seedBody.image_url = ensureDataUrl(roomImageBase64);
    }

    const seedResp = await fetch(ARK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ARK_KEY}` },
      body: JSON.stringify(seedBody),
      signal: AbortSignal.timeout(120000),
    });

    if (!seedResp.ok) {
      const errText = await seedResp.text();
      console.error("Seedream multi-image error:", errText.slice(0, 500));

      // 多图失败 → 自动降级到单图模式
      console.log("Multi-image failed, falling back to single-image...");
      return await singleImageCompose(c, roomImageBase64, scenePrompt, null);
    }

    const seedData = await seedResp.json();
    const b64 = seedData.data?.[0]?.b64_json;
    if (!b64) {
      return c.json({ error: "Image generation returned empty" }, 500);
    }

    console.log(`Compose SUCCESS! (multi-image, ${imageUrls.length} refs)`);
    return c.json({
      success: true,
      composedImage: `data:image/png;base64,${b64}`,
      scenePrompt,
      mode: "multi-image",
      imageCount: imageUrls.length,
      message: `AI 多图合成完成（${productsIncluded.length} 件商品参考图 + 房间照片）`,
    });

  } catch (err: any) {
    console.error("Compose error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── 单图 fallback（原逻辑） ───
async function singleImageCompose(
  c: any,
  roomImageBase64: string | null,
  promptOrProducts: string | any[],
  analysis: any | null,
) {
  let scenePrompt: string;

  if (typeof promptOrProducts === "string") {
    // 已有 prompt，直接用
    scenePrompt = promptOrProducts;
  } else {
    // 需要先生成 prompt
    const products = promptOrProducts;
    const productsDesc = products.map((p: any, i: number) =>
      `${i + 1}. ${p.name} (${p.color}, ${p.material}, ${p.size}) - placement: ${p.place}`
    ).join("\n");
    const roomInfo = analysis
      ? `Room: ${analysis.room_type}, Style: ${analysis.style}, Light: ${analysis.lighting}`
      : "A modern room";

    const messages: any[] = [{ role: "user", content: [] as any[] }];
    if (roomImageBase64) {
      messages[0].content.push({ type: "image_url", image_url: { url: ensureDataUrl(roomImageBase64) } });
    }
    messages[0].content.push({
      type: "text",
      text: `${roomImageBase64 ? "Look at this room photo carefully. " : ""}Add these furniture items into this room:\n${productsDesc}\n${roomInfo}\nWrite a detailed English image-to-image prompt that PRESERVES the room architecture and ADDS each product. Photorealistic interior design photograph. Under 200 words. Output ONLY the prompt.`,
    });

    const resp = await fetch(LLM_BASE_URL, {
      method: "POST",
      headers: llmHeaders(),
      body: JSON.stringify({ model: LLM_VISION_MODEL, max_tokens: 500, messages }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) return c.json({ error: "AI prompt generation failed" }, 500);
    const data = await resp.json();
    scenePrompt = data.choices?.[0]?.message?.content?.trim() || "";
  }

  const seedBody: any = {
    model: "doubao-seedream-5-0-260128",
    prompt: scenePrompt,
    size: "1920x1920",
    n: 1,
    response_format: "b64_json",
    watermark: false,
  };

  if (roomImageBase64) {
    seedBody.image_url = ensureDataUrl(roomImageBase64);
    seedBody.strength = 0.4;
  }

  const seedResp = await fetch(ARK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ARK_KEY}` },
    body: JSON.stringify(seedBody),
    signal: AbortSignal.timeout(90000),
  });

  if (!seedResp.ok) {
    const err = await seedResp.text();
    return c.json({ error: "Scene generation failed (fallback)", details: err.slice(0, 200) }, 500);
  }

  const seedData = await seedResp.json();
  const b64 = seedData.data?.[0]?.b64_json;
  if (!b64) return c.json({ error: "Image generation returned empty" }, 500);

  return c.json({
    success: true,
    composedImage: `data:image/png;base64,${b64}`,
    scenePrompt,
    mode: "single-image",
    imageCount: 1,
    message: "AI 场景合成完成（单图模式）",
  });
}

// ─── 对话式微调 ───
composeRoute.post("/compose/adjust", async (c) => {
  try {
    const { previousPrompt, userFeedback, selectedProducts, roomImageBase64, analysis } = await c.req.json();

    // 重建 image_urls 数组
    const imageUrls: string[] = [];
    if (roomImageBase64) {
      imageUrls.push(ensureDataUrl(roomImageBase64));
    }
    const maxProducts = roomImageBase64 ? 9 : 10;
    for (const p of (selectedProducts || []).slice(0, maxProducts)) {
      if (p.img && p.img.startsWith("http")) {
        imageUrls.push(p.img);
      }
    }

    // LLM 根据反馈修改 prompt
    const adjustResp = await fetch(LLM_BASE_URL, {
      method: "POST",
      headers: llmHeaders(),
      body: JSON.stringify({
        model: LLM_VISION_MODEL,
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `之前的场景 prompt：
"${previousPrompt}"

用户要求修改："${userFeedback}"

商品列表：${(selectedProducts || []).map((p: any, i: number) => `第${i + 2}张图=${p.name}(${p.color})`).join("，")}

请根据用户反馈更新 prompt。保持房间结构不变，保留"第N张图"的引用方式。只输出新 prompt，不超过 250 字。`,
        }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!adjustResp.ok) {
      return c.json({ error: "Prompt adjustment failed" }, 500);
    }

    const adjustData = await adjustResp.json();
    const newPrompt = adjustData.choices?.[0]?.message?.content?.trim() || previousPrompt;

    // Seedream 重新生成
    console.log(`Adjust: Seedream with ${imageUrls.length} images...`);
    const seedBody: any = {
      model: "doubao-seedream-5-0-260128",
      prompt: newPrompt,
      size: "1920x1920",
      n: 1,
      response_format: "b64_json",
      watermark: false,
    };

    // 多图模式: image_url 锁房间 + image_urls 参考商品
    if (imageUrls.length > 1) {
      seedBody.image_urls = imageUrls;
      seedBody.strength = 0.35;
      if (roomImageBase64) {
        seedBody.image_url = ensureDataUrl(roomImageBase64);
      }
    } else if (roomImageBase64) {
      seedBody.image_url = ensureDataUrl(roomImageBase64);
      seedBody.strength = 0.45;
    }

    const seedResp = await fetch(ARK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ARK_KEY}` },
      body: JSON.stringify(seedBody),
      signal: AbortSignal.timeout(120000),
    });

    if (!seedResp.ok) {
      const errText = await seedResp.text();
      console.error("Adjust Seedream error:", errText.slice(0, 300));
      return c.json({ error: "Regeneration failed", details: errText.slice(0, 200) }, 500);
    }

    const seedData = await seedResp.json();
    const b64 = seedData.data?.[0]?.b64_json;
    if (!b64) return c.json({ error: "Regeneration returned empty" }, 500);

    return c.json({
      success: true,
      composedImage: `data:image/png;base64,${b64}`,
      scenePrompt: newPrompt,
      mode: imageUrls.length > 1 ? "multi-image" : "single-image",
      message: "已根据反馈重新生成",
    });
  } catch (err: any) {
    console.error("Adjust error:", err);
    return c.json({ error: err.message }, 500);
  }
});
