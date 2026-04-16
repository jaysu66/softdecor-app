/**
 * 端到端测试：多图合成
 * 1. 加载一张房间背景图 → base64
 * 2. 加载商品列表（含 cutout URLs）
 * 3. 调用 /api/compose
 * 4. 保存结果图
 */
import fs from "fs";
import path from "path";

const SERVER = "http://localhost:3001";

async function main() {
  console.log("=== 多图合成 E2E 测试 ===\n");

  // 1. 加载房间背景图
  const bgPath = path.join(
    process.env.HOME || process.env.USERPROFILE || "",
    "Desktop/softdecor-ai-images/room-backgrounds/empty-living-1.jpg"
  );
  if (!fs.existsSync(bgPath)) {
    console.error("背景图不存在:", bgPath);
    process.exit(1);
  }
  const bgBuffer = fs.readFileSync(bgPath);
  const bgBase64 = `data:image/jpeg;base64,${bgBuffer.toString("base64")}`;
  console.log(`房间图: ${bgPath} (${(bgBuffer.length / 1024).toFixed(0)}KB)`);

  // 2. 从服务器获取商品列表
  const productsResp = await fetch(`${SERVER}/api/products`);
  const allProducts = await productsResp.json();
  console.log(`商品总数: ${allProducts.length}`);

  // 选3个不同品类的商品测试
  const testProducts = [
    allProducts.find((p: any) => p.sku === "SF-001"), // 沙发
    allProducts.find((p: any) => p.sku === "CJ-001"), // 茶几
    allProducts.find((p: any) => p.sku === "DT-001"), // 地毯
  ].filter(Boolean);

  console.log(`选中商品: ${testProducts.map((p: any) => `${p.sku}(${p.name})`).join(", ")}`);
  console.log(`商品图 URLs:`);
  for (const p of testProducts) {
    console.log(`  ${p.sku}: ${p.img}`);
  }

  // 3. 模拟分析结果
  const analysis = {
    room_type: "客厅",
    style: "北欧",
    lighting: "明亮",
    color_tone: "暖色调",
    suggested_categories: ["沙发", "茶几", "地毯"],
  };

  // 4. 调用 compose API
  console.log("\n>>> 调用 /api/compose (多图模式)...");
  const startTime = Date.now();

  const composeResp = await fetch(`${SERVER}/api/compose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomImageBase64: bgBase64,
      selectedProducts: testProducts,
      analysis,
    }),
    signal: AbortSignal.timeout(180000),
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const result = await composeResp.json();

  if (result.success) {
    console.log(`\n✓ 成功！耗时 ${elapsed}s`);
    console.log(`  模式: ${result.mode}`);
    console.log(`  参考图数: ${result.imageCount}`);
    console.log(`  消息: ${result.message}`);
    console.log(`  Prompt: ${result.scenePrompt?.slice(0, 150)}...`);

    // 保存结果图
    const b64Data = result.composedImage.replace(/^data:image\/\w+;base64,/, "");
    const outPath = path.join(
      process.env.HOME || process.env.USERPROFILE || "",
      "Desktop/softdecor-ai-images/test-multiimg-compose.png"
    );
    fs.writeFileSync(outPath, Buffer.from(b64Data, "base64"));
    console.log(`  结果图: ${outPath}`);
  } else {
    console.log(`\n✗ 失败！耗时 ${elapsed}s`);
    console.log(`  错误: ${result.error}`);
    console.log(`  详情: ${JSON.stringify(result).slice(0, 500)}`);
  }
}

main().catch(console.error);
