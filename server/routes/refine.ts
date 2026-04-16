import { Hono } from "hono";
import { LLM_BASE_URL, LLM_VISION_MODEL, llmHeaders } from "../lib/llm";

export const refineRoute = new Hono();

const SEEDREAM_ENDPOINT = process.env.ARK_BASE || "https://ark.cn-beijing.volces.com/api/v3";
const SEEDREAM_KEY = process.env.ARK_KEY || "";

refineRoute.post("/refine", async (c) => {
  try {
    const { canvasImage, prompt } = await c.req.json();

    if (!canvasImage) {
      return c.json({ error: "No canvas image provided" }, 400);
    }

    // Extract base64 data
    const base64Match = canvasImage.match(/^data:(image\/\w+);base64,(.+)$/);
    const base64Data = base64Match ? base64Match[2] : canvasImage;

    const refinePrompt = prompt ||
      "请将这张室内设计合成图精修为真实照片效果。保持所有家具和装饰品的位置不变，优化光影效果、阴影、反射，使整体看起来像一张真实的室内摄影照片。";

    // Try Seedream first
    let refinedImage: string | null = null;

    try {
      const seedreamResp = await fetch(`${SEEDREAM_ENDPOINT}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SEEDREAM_KEY}`,
        },
        body: JSON.stringify({
          model: "seedream-3.0",
          prompt: refinePrompt,
          image: base64Data,
          strength: 0.35,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json",
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (seedreamResp.ok) {
        const seedreamData = await seedreamResp.json();
        if (seedreamData.data?.[0]?.b64_json) {
          refinedImage = `data:image/png;base64,${seedreamData.data[0].b64_json}`;
        }
      }
    } catch (seedErr) {
      console.log("Seedream unavailable, falling back to LLM feedback...");
    }

    // Fallback: use LLM for feedback analysis
    if (!refinedImage) {
      try {
        const llmResp = await fetch(LLM_BASE_URL, {
          method: "POST",
          headers: llmHeaders(),
          body: JSON.stringify({
            model: LLM_VISION_MODEL,
            max_tokens: 4096,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: {
                      url: canvasImage,
                    },
                  },
                  {
                    type: "text",
                    text: `这是一张室内设计的合成预览图。请分析这张图片并给出以下改进建议（JSON格式）：
{
  "overall_score": 8,
  "lighting_notes": "光影分析",
  "composition_notes": "构图分析",
  "color_harmony": "色彩协调性",
  "suggestions": ["改进建议1", "改进建议2"],
  "refined_description": "精修后的理想效果描述"
}`,
                  },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (llmResp.ok) {
          const llmData = await llmResp.json();
          const content = llmData.choices?.[0]?.message?.content || "";

          let feedback;
          try {
            feedback = JSON.parse(content);
          } catch {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) feedback = JSON.parse(jsonMatch[0]);
          }

          return c.json({
            success: true,
            mode: "feedback",
            feedback,
            message: "AI已分析合成效果并给出改进建议",
            originalImage: canvasImage,
          });
        }
      } catch (llmErr) {
        console.log("LLM feedback also unavailable");
      }
    }

    if (refinedImage) {
      return c.json({
        success: true,
        mode: "refined",
        refinedImage,
        message: "AI精修完成",
      });
    }

    // Final fallback: return the original with a note
    return c.json({
      success: true,
      mode: "original",
      originalImage: canvasImage,
      message: "AI精修服务暂不可用，已保存原始合成图",
    });
  } catch (err: any) {
    console.error("Refine error:", err);
    return c.json({ error: err.message }, 500);
  }
});
