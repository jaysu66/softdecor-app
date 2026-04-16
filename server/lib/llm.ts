/**
 * LLM 统一配置
 * ─────────────────────────────────────────────────────────────
 * 代码使用标准 OpenAI 兼容的 /v1/chat/completions 格式
 * 可以对接任何 OpenAI 兼容的服务（详见 README "配置 LLM 提供方"）
 */

export const LLM_BASE_URL =
  process.env.LLM_BASE_URL || "https://api.openai.com/v1/chat/completions";

export const LLM_API_KEY = process.env.LLM_API_KEY || "";

/** 通用模型 — 用于房间分析、场景 prompt 生成、精修反馈 */
/** 需要支持：vision（看图）+ JSON 结构化输出 */
export const LLM_VISION_MODEL = process.env.LLM_VISION_MODEL || "gpt-4o";

/** Agent 模型 — 用于画布 Agent 的 tool-use */
/** 需要支持：function/tool calling */
export const LLM_AGENT_MODEL =
  process.env.LLM_AGENT_MODEL || process.env.LLM_VISION_MODEL || "gpt-4o";

/** 统一 headers 构造 */
export function llmHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${LLM_API_KEY}`,
  };
}

/** 启动时检查必要环境变量 */
export function assertLLMConfig(): void {
  if (!LLM_API_KEY) {
    console.warn(
      "[WARN] LLM_API_KEY not set. All AI features will fail. " +
      "Copy .env.example to .env and fill in your credentials."
    );
  }
}
