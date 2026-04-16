import { Hono } from "hono";
import { LLM_BASE_URL, LLM_AGENT_MODEL, llmHeaders } from "../lib/llm";

export const agentRoute = new Hono();

// Tool definitions for Gemini
const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "move_product",
      description: "移动商品到指定位置。x和y是百分比坐标(0-100)，0,0是左上角。",
      parameters: {
        type: "object",
        properties: {
          sku: { type: "string", description: "商品SKU编号" },
          x: { type: "number", description: "水平位置百分比(0-100)" },
          y: { type: "number", description: "垂直位置百分比(0-100)" },
        },
        required: ["sku", "x", "y"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "resize_product",
      description: "调整商品大小。scale是缩放比例，0.1=很小，0.5=中等，1.0=原始大小。",
      parameters: {
        type: "object",
        properties: {
          sku: { type: "string", description: "商品SKU编号" },
          scale: { type: "number", description: "缩放比例(0.05-1.0)" },
        },
        required: ["sku", "scale"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "rotate_product",
      description: "旋转商品。angle是角度，0-360度。",
      parameters: {
        type: "object",
        properties: {
          sku: { type: "string", description: "商品SKU编号" },
          angle: { type: "number", description: "旋转角度(0-360)" },
        },
        required: ["sku", "angle"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "remove_product",
      description: "从画布移除商品",
      parameters: {
        type: "object",
        properties: {
          sku: { type: "string", description: "要移除的商品SKU编号" },
        },
        required: ["sku"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_product",
      description: "从商品库添加新商品到画布",
      parameters: {
        type: "object",
        properties: {
          sku: { type: "string", description: "要添加的商品SKU编号" },
        },
        required: ["sku"],
      },
    },
  },
];

agentRoute.post("/agent-adjust", async (c) => {
  try {
    const { message, canvasState, selectedSkus, availableProducts, canvasSize } = await c.req.json();

    const systemPrompt = `你是一个专业的室内设计AI助手。你正在帮用户调整房间中软装商品的摆放。

当前画布状态（每个商品的位置和大小）：
${JSON.stringify(canvasState, null, 2)}

画布大小：${canvasSize.w}x${canvasSize.h}像素
坐标系统：x和y是百分比(0-100)，0,0是左上角，100,100是右下角

当前已选商品SKU：${selectedSkus.join(", ")}

可添加的商品库：
${availableProducts.map((p: any) => `${p.sku}: ${p.name} (${p.cat}, ${p.style}, 放置:${p.place})`).join("\n")}

规则：
- 用户说"往左"意味着减小x值，"往右"增大x值
- 用户说"往上"意味着减小y值，"往下"增大y值
- "大一点"意味着增大scale，"小一点"意味着减小scale
- "太挤了"意味着适当分散各商品位置
- 每次调整幅度适中，不要一下子移太多（通常5-15%的位移）
- 必须调用工具来执行调整，不要只是文字描述

请根据用户的要求调用合适的工具来调整画布上的商品。回复时用简短中文说明你做了什么调整。`;

    console.log("Agent: calling LLM with tool-use...");

    const response = await fetch(LLM_BASE_URL, {
      method: "POST",
      headers: llmHeaders(),
      body: JSON.stringify({
        model: LLM_AGENT_MODEL,
        max_tokens: 1500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        tools: TOOLS,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("LLM error:", response.status, errText);
      // Fallback: try simpler JSON-based approach if tool-use fails
      return await fallbackJson(c, message, canvasState, selectedSkus, availableProducts, canvasSize);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      return c.json({ reply: "AI 无响应", actions: [] });
    }

    // Extract tool calls
    const actions: any[] = [];
    let reply = "";

    if (choice.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        const fn = tc.function;
        const args = typeof fn.arguments === "string" ? JSON.parse(fn.arguments) : fn.arguments;

        switch (fn.name) {
          case "move_product":
            actions.push({ type: "move", sku: args.sku, x: args.x, y: args.y });
            break;
          case "resize_product":
            actions.push({ type: "resize", sku: args.sku, scale: args.scale });
            break;
          case "rotate_product":
            actions.push({ type: "rotate", sku: args.sku, angle: args.angle });
            break;
          case "remove_product":
            actions.push({ type: "remove", sku: args.sku });
            break;
          case "add_product":
            actions.push({ type: "add", sku: args.sku });
            break;
        }
      }
      reply = choice.message?.content || `已执行 ${actions.length} 个调整`;
    } else {
      reply = choice.message?.content || "我理解了你的需求，但没有找到需要调整的地方。";
    }

    console.log(`Agent: ${actions.length} actions, reply: ${reply.slice(0, 50)}`);
    return c.json({ reply, actions });

  } catch (err: any) {
    console.error("Agent error:", err);
    return c.json({ reply: "出错了: " + err.message, actions: [] }, 500);
  }
});

// Fallback: JSON-based command (when tool-use fails)
async function fallbackJson(c: any, message: string, canvasState: any, selectedSkus: string[], availableProducts: any[], canvasSize: any) {
  console.log("Agent: falling back to JSON mode...");

  const prompt = `你是室内设计AI助手。用户说："${message}"

当前画布上的商品：
${JSON.stringify(canvasState, null, 2)}

请返回JSON格式的调整指令（不要其他文字）：
{
  "reply": "你的回复文字",
  "actions": [
    {"type": "move", "sku": "XX-001", "x": 30, "y": 60},
    {"type": "resize", "sku": "XX-001", "scale": 0.2},
    {"type": "remove", "sku": "XX-001"},
    {"type": "add", "sku": "XX-001"}
  ]
}

x,y是百分比坐标(0-100)。往左=减x，往右=加x，往上=减y，往下=加y。每次调整幅度5-15%。`;

  const response = await fetch(LLM_BASE_URL, {
    method: "POST",
    headers: llmHeaders(),
    body: JSON.stringify({
      model: LLM_AGENT_MODEL,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    return c.json({ reply: "AI服务暂时不可用", actions: [] }, 500);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  try {
    const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || "{}");
    return c.json({ reply: parsed.reply || "已调整", actions: parsed.actions || [] });
  } catch {
    return c.json({ reply: content.slice(0, 200), actions: [] });
  }
}
