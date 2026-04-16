/**
 * 测试混合模式：
 * 方案A: image_url（单图锁房间）+ image_urls（多图商品参考）同时传
 * 方案B: 只用 image_url 锁房间 + prompt 中引用外部商品 URL
 * 方案C: image_urls 但 prompt 极度强调不改房间
 */
import fs from "fs";
import path from "path";

const ARK_ENDPOINT = process.env.ARK_ENDPOINT || "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const ARK_KEY = process.env.ARK_KEY || "";
if (!ARK_KEY) { console.error("Missing ARK_KEY env var"); process.exit(1); }
const HOME = process.env.HOME || process.env.USERPROFILE || "";

const bgPath = path.join(HOME, "Desktop/softdecor-ai-images/room-backgrounds/empty-living-1.jpg");
const bgBase64 = `data:image/jpeg;base64,${fs.readFileSync(bgPath).toString("base64")}`;
const cutoutUrls = JSON.parse(
  fs.readFileSync(path.join(HOME, "Desktop/softdecor-ai-images/cutout_urls.json"), "utf-8")
);

const productUrls = [cutoutUrls["SF-001"], cutoutUrls["CJ-001"], cutoutUrls["DT-001"]];

async function testVariant(name: string, body: any) {
  console.log(`\n--- ${name} ---`);
  const start = Date.now();

  try {
    const resp = await fetch(ARK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ARK_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    if (!resp.ok) {
      const err = await resp.text();
      console.log(`  ✗ ${resp.status} (${elapsed}s): ${err.slice(0, 300)}`);
      return;
    }

    const data = await resp.json();
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) { console.log(`  ✗ 空结果 (${elapsed}s)`); return; }

    const outPath = path.join(HOME, `Desktop/softdecor-ai-images/test-hybrid-${name}.png`);
    fs.writeFileSync(outPath, Buffer.from(b64, "base64"));
    console.log(`  ✓ 成功 (${elapsed}s) → ${outPath}`);
  } catch (e: any) {
    console.log(`  ✗ 异常: ${e.message}`);
  }
}

async function main() {
  console.log("=== 混合模式测试 ===\n");

  const basePrompt = `保持房间的建筑结构、墙面颜色、地板材质、窗户和窗外海景完全不变。在房间中添加：一张浅灰色北欧布艺三人沙发放在中央面向电视墙，一张白色大理石圆茶几（金色腿）放在沙发前方，一张米白色手工编织方形地毯铺在沙发区域。保持参考图中家具的真实外观。自然光照，柔和阴影。高端室内设计摄影。`;

  const multiRefPrompt = `严格保持第1张图房间的所有建筑细节完全不变：深灰色电视背景墙、灰色墙面、灰色石材地板、大窗户和窗外海景、白色电视柜。不允许改变房间的任何元素。仅在房间中添加家具：将第2张图的浅灰色布艺三人沙发放在房间中央靠窗位置面向电视，将第3张图的白色大理石圆茶几（金色腿）放在沙发正前方，将第4张图的米白色编织地毯铺在沙发和茶几下方。家具必须保持参考图中的真实外观。自然光，柔和阴影。高端室内设计摄影。`;

  // 方案A: image_url + image_urls 同时传
  await testVariant("A-both", {
    model: "doubao-seedream-5-0-260128",
    prompt: multiRefPrompt,
    image_url: bgBase64,
    image_urls: [bgBase64, ...productUrls],
    strength: 0.30,
    size: "1920x1920",
    n: 1,
    response_format: "b64_json",
    watermark: false,
  });

  // 方案B: 只用 image_url 锁房间 + 纯文字描述商品（但 prompt 中提到参考商品图的 URL）
  await testVariant("B-single-lock", {
    model: "doubao-seedream-5-0-260128",
    prompt: basePrompt,
    image_url: bgBase64,
    strength: 0.30,
    size: "1920x1920",
    n: 1,
    response_format: "b64_json",
    watermark: false,
  });

  // 方案C: image_urls 但 prompt 极度强调不改房间，strength 更低
  await testVariant("C-multi-strict", {
    model: "doubao-seedream-5-0-260128",
    prompt: multiRefPrompt,
    image_urls: [bgBase64, ...productUrls],
    strength: 0.20,
    size: "1920x1920",
    n: 1,
    response_format: "b64_json",
    watermark: false,
  });

  // 方案D: image_urls 只放商品（不放房间），image_url 放房间
  await testVariant("D-split", {
    model: "doubao-seedream-5-0-260128",
    prompt: `保持底图房间完全不变。参考以下商品图片，将第1张参考图的浅灰色三人沙发放在中央，第2张参考图的白色大理石圆茶几放在沙发前，第3张参考图的米白编织地毯铺在下方。保持商品真实外观。自然光。`,
    image_url: bgBase64,
    image_urls: productUrls,
    strength: 0.30,
    size: "1920x1920",
    n: 1,
    response_format: "b64_json",
    watermark: false,
  });

  console.log("\n完成！");
}

main().catch(console.error);
