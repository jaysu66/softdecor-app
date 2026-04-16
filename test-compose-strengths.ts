/**
 * 测试不同 strength 值对多图合成效果的影响
 * 直接调用 Seedream API，跳过 Claude prompt 生成
 */
import fs from "fs";
import path from "path";

const ARK_ENDPOINT = process.env.ARK_ENDPOINT || "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const ARK_KEY = process.env.ARK_KEY || "";
if (!ARK_KEY) { console.error("Missing ARK_KEY env var"); process.exit(1); }

const HOME = process.env.HOME || process.env.USERPROFILE || "";

async function testStrength(strength: number, imageUrls: string[], prompt: string) {
  console.log(`\n--- strength=${strength} ---`);
  const start = Date.now();

  const resp = await fetch(ARK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ARK_KEY}` },
    body: JSON.stringify({
      model: "doubao-seedream-5-0-260128",
      prompt,
      image_urls: imageUrls,
      strength,
      size: "1920x1920",
      n: 1,
      response_format: "b64_json",
      watermark: false,
    }),
    signal: AbortSignal.timeout(120000),
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (!resp.ok) {
    const err = await resp.text();
    console.log(`  ✗ 失败 (${elapsed}s): ${err.slice(0, 200)}`);
    return;
  }

  const data = await resp.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    console.log(`  ✗ 空结果 (${elapsed}s)`);
    return;
  }

  const outPath = path.join(HOME, `Desktop/softdecor-ai-images/test-multi-s${(strength * 100).toFixed(0)}.png`);
  fs.writeFileSync(outPath, Buffer.from(b64, "base64"));
  console.log(`  ✓ 成功 (${elapsed}s) → ${outPath}`);
}

async function main() {
  // 加载房间图
  const bgPath = path.join(HOME, "Desktop/softdecor-ai-images/room-backgrounds/empty-living-1.jpg");
  const bgBase64 = `data:image/jpeg;base64,${fs.readFileSync(bgPath).toString("base64")}`;

  // 商品抠图 URLs
  const cutoutUrls = JSON.parse(
    fs.readFileSync(path.join(HOME, "Desktop/softdecor-ai-images/cutout_urls.json"), "utf-8")
  );

  const imageUrls = [
    bgBase64,                    // 第1张：房间
    cutoutUrls["SF-001"],        // 第2张：沙发
    cutoutUrls["CJ-001"],       // 第3张：茶几
    cutoutUrls["DT-001"],       // 第4张：地毯
  ];

  const prompt = `保持第1张图房间的建筑结构、墙面颜色、地板材质、窗户位置和窗外景色完全不变。将第2张图中的浅灰色布艺三人沙发放在房间中央靠窗位置，面向电视墙。将第3张图中的大理石圆茶几（白色台面、金色腿）放在沙发正前方。将第4张图中的米白色编织地毯铺在沙发和茶几下方区域。所有家具保持参考图中的真实外观、颜色、材质和比例。光线匹配房间现有的自然光，添加柔和阴影。高端室内设计杂志摄影风格。`;

  console.log("=== 多图合成 strength 对比测试 ===");
  console.log(`参考图: ${imageUrls.length} 张`);

  // 测试3个不同 strength
  for (const s of [0.30, 0.40, 0.50]) {
    await testStrength(s, imageUrls, prompt);
  }

  console.log("\n完成！请对比三张图片。");
}

main().catch(console.error);
