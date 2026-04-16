/**
 * 最终 E2E 测试：方案A (image_url + image_urls)
 * 5件商品，走完整 /api/compose 链路
 */
import fs from "fs";
import path from "path";

const SERVER = "http://localhost:3001";
const HOME = process.env.HOME || process.env.USERPROFILE || "";

async function main() {
  console.log("=== 最终 E2E 测试 (方案A: 双参数) ===\n");

  // 1. 房间图
  const bgPath = path.join(HOME, "Desktop/softdecor-ai-images/room-backgrounds/empty-living-1.jpg");
  const bgBase64 = `data:image/jpeg;base64,${fs.readFileSync(bgPath).toString("base64")}`;
  console.log(`房间图: ${bgPath}`);

  // 2. 获取商品
  const allProducts = await (await fetch(`${SERVER}/api/products`)).json();

  // 选5件不同品类
  const testProducts = [
    allProducts.find((p: any) => p.sku === "SF-001"), // 沙发
    allProducts.find((p: any) => p.sku === "CJ-001"), // 茶几
    allProducts.find((p: any) => p.sku === "DT-001"), // 地毯
    allProducts.find((p: any) => p.sku === "DG-001"), // 灯具
    allProducts.find((p: any) => p.sku === "DH-001"), // 装饰画
  ].filter(Boolean);

  console.log(`选中 ${testProducts.length} 件商品:`);
  for (const p of testProducts) {
    console.log(`  ${p.sku}: ${p.name} (img: ${p.img?.slice(0, 40)}...)`);
  }

  // 3. 分析结果
  const analysis = {
    room_type: "客厅",
    style: "北欧",
    lighting: "明亮自然光",
    color_tone: "冷灰色调",
    suggested_categories: ["沙发", "茶几", "地毯", "灯具", "装饰画"],
  };

  // 4. 调用 compose
  console.log("\n>>> 调用 /api/compose...");
  const start = Date.now();

  const resp = await fetch(`${SERVER}/api/compose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomImageBase64: bgBase64, selectedProducts: testProducts, analysis }),
    signal: AbortSignal.timeout(180000),
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const result = await resp.json();

  if (result.success) {
    console.log(`\n✓ 成功！耗时 ${elapsed}s`);
    console.log(`  模式: ${result.mode}`);
    console.log(`  参考图数: ${result.imageCount}`);
    console.log(`  Prompt:\n${result.scenePrompt}`);

    const b64Data = result.composedImage.replace(/^data:image\/\w+;base64,/, "");
    const outPath = path.join(HOME, "Desktop/softdecor-ai-images/test-final-e2e-5products.png");
    fs.writeFileSync(outPath, Buffer.from(b64Data, "base64"));
    console.log(`\n  结果图: ${outPath}`);

    // 5. 测试 adjust
    console.log("\n>>> 测试 /api/compose/adjust（微调）...");
    const adjStart = Date.now();
    const adjResp = await fetch(`${SERVER}/api/compose/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        previousPrompt: result.scenePrompt,
        userFeedback: "沙发再往左移一点，灯光氛围调暖一些",
        selectedProducts: testProducts,
        roomImageBase64: bgBase64,
        analysis,
      }),
      signal: AbortSignal.timeout(180000),
    });
    const adjElapsed = ((Date.now() - adjStart) / 1000).toFixed(1);
    const adjResult = await adjResp.json();

    if (adjResult.success) {
      console.log(`  ✓ 微调成功！(${adjElapsed}s) 模式: ${adjResult.mode}`);
      const adjB64 = adjResult.composedImage.replace(/^data:image\/\w+;base64,/, "");
      const adjPath = path.join(HOME, "Desktop/softdecor-ai-images/test-final-e2e-adjusted.png");
      fs.writeFileSync(adjPath, Buffer.from(adjB64, "base64"));
      console.log(`  结果图: ${adjPath}`);
    } else {
      console.log(`  ✗ 微调失败: ${adjResult.error}`);
    }
  } else {
    console.log(`\n✗ 失败 (${elapsed}s): ${result.error}`);
    console.log(JSON.stringify(result).slice(0, 500));
  }
}

main().catch(console.error);
