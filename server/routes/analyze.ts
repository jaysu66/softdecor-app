import { Hono } from "hono";
import { LLM_BASE_URL, LLM_VISION_MODEL, llmHeaders } from "../lib/llm";

export const analyzeRoute = new Hono();

analyzeRoute.post("/analyze", async (c) => {
  try {
    const { imageBase64 } = await c.req.json();

    if (!imageBase64) {
      return c.json({ error: "No image provided" }, 400);
    }

    const imageUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    console.log("Calling LLM for room analysis... imageUrl length:", imageUrl.length);

    const response = await fetch(LLM_BASE_URL, {
      signal: AbortSignal.timeout(60000),
      method: "POST",
      headers: llmHeaders(),
      body: JSON.stringify({
        model: LLM_VISION_MODEL,
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
              {
                type: "text",
                text: `你是一个专业的室内设计师。请分析这张房间照片，返回JSON格式的分析结果。

请严格返回如下JSON格式（不要包含其他文字，只返回JSON）：
{
  "room_type": "客厅/卧室/餐厅/书房/...",
  "style": "北欧/现代简约/轻奢/日式/中式/侘寂/...",
  "secondary_styles": ["可能匹配的其他风格"],
  "lighting": "明亮/柔和/昏暗/自然光",
  "color_tone": "暖色调/冷色调/中性/...",
  "existing_furniture": ["已有的家具列表"],
  "suggested_categories": ["建议添加的软装品类"],
  "space_features": "空间特点描述",
  "suggestions": "搭配建议"
}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("LLM error:", response.status, errText.slice(0, 300));
      // Retry with simpler prompt as fallback
      console.log("Retrying with simpler prompt...");
      const fallback = await fetch(LLM_BASE_URL, {
        signal: AbortSignal.timeout(60000),
        method: "POST",
        headers: llmHeaders(),
        body: JSON.stringify({
          model: LLM_VISION_MODEL,
          max_tokens: 2000,
          messages: [{ role: "user", content: [
            { type: "image_url", image_url: { url: imageUrl } },
            { type: "text", text: `你是一个专业的室内设计师。请分析这张房间照片，返回JSON格式。只返回JSON：
{"room_type":"客厅","style":"北欧","secondary_styles":["现代简约"],"lighting":"明亮","color_tone":"暖色调","existing_furniture":[],"suggested_categories":["沙发","茶几","地毯","灯具"],"space_features":"空间描述","suggestions":"搭配建议"}` },
          ]}],
        }),
      });
      if (!fallback.ok) {
        return c.json({ error: "AI analysis failed", details: errText.slice(0, 200) }, 500);
      }
      const fbData = await fallback.json();
      const fbContent = fbData.choices?.[0]?.message?.content || "";
      try {
        const analysis = JSON.parse(fbContent.match(/\{[\s\S]*\}/)?.[0] || "{}");
        return c.json({ success: true, analysis });
      } catch {
        return c.json({ error: "Failed to parse fallback response" }, 500);
      }
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    console.log("AI response received, length:", content.length);

    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1].trim());
      } else {
        const objMatch = content.match(/\{[\s\S]*\}/);
        if (objMatch) {
          analysis = JSON.parse(objMatch[0]);
        } else {
          return c.json({ error: "Failed to parse AI response", raw: content }, 500);
        }
      }
    }

    return c.json({ success: true, analysis });
  } catch (err: any) {
    console.error("Analyze error:", err);
    return c.json({ error: err.message }, 500);
  }
});
