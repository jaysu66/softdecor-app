# 软装搭配 AI 场景生图 — 项目上下文

> 这个文件会被 Claude Code 自动加载。接手人用 Claude Code 打开本仓库即可获得完整上下文。

## 项目概述

这是一个软装供应链公司的 AI 搭配生图工具。用户上传房间照片 → AI 分析空间 → 推荐商品 → Seedream 5.0 多图合成效果图 → 对话微调 → 精修输出。

GitHub: https://github.com/jaysu66/softdecor-app

## 技术栈

- 前端：React 19 + Zustand + Tailwind CSS + Vite（port 8080）
- 后端：Hono + Node.js + TypeScript（port 3001）
- AI 文本/视觉：OpenAI 兼容格式，通过 `server/lib/llm.ts` 统一配置
- AI 图像生成：Seedream 5.0 / 3.0（字节火山引擎 ARK API）
- 数据：30 个 SKU（`server/data/products.json`），21 张测试背景图（`assets/room-backgrounds/`）

## 环境配置

需要两组 API Key，写在 `.env` 里（模板见 `.env.example`）：

1. **LLM 服务**（任意 OpenAI 兼容服务）：
   - `LLM_BASE_URL` — API 端点
   - `LLM_API_KEY` — API Key
   - `LLM_VISION_MODEL` — 需支持 vision（看图），用于房间分析和 prompt 生成
   - `LLM_AGENT_MODEL` — 需支持 tool calling，用于画布 Agent

2. **火山引擎 ARK**（Seedream 生图，必须）：
   - `ARK_KEY` — API Key
   - `ARK_ENDPOINT` — `https://ark.cn-beijing.volces.com/api/v3/images/generations`

## 启动命令

```bash
npm install && cd client && npm install && cd ..
npm run dev   # 同时启动前端(8080)和后端(3001)
```

## 5 步产品流程 → 代码对应关系

| 步骤 | 前端组件 | 后端路由 | AI 调用 |
|------|---------|---------|--------|
| 1. 上传 | UploadPanel.tsx | 无（前端 Canvas 压缩） | 无 |
| 2. 分析 | AnalysisResult.tsx | POST /api/analyze (analyze.ts) | LLM Vision → JSON |
| 3. 推荐 | SchemeSelector.tsx | POST /api/recommend (recommend.ts) | 无（纯规则评分算法） |
| 4. 合成 | CanvasEditor.tsx | POST /api/compose (compose.ts) | LLM 写 prompt → Seedream 5.0 多图生成 |
| 4b. 微调 | CanvasEditor.tsx 聊天框 | POST /api/compose/adjust (compose.ts) | LLM 改 prompt → Seedream 重新生成 |
| 4c. Agent | CanvasEditor.tsx | POST /api/agent-adjust (agent.ts) | LLM tool-use（5个工具） |
| 5. 精修 | RefinePanel.tsx | POST /api/refine (refine.ts) | Seedream 3.0 → LLM 评分反馈 → 原图 |

## 前端状态机

```
upload → analyzing → analysis → recommending → recommend → canvas → refining → result
```

状态管理在 `client/src/stores/useStore.ts`（Zustand）。

## 场景合成核心逻辑（compose.ts）

1. 构建 image_urls 数组：[房间照片 base64, 商品1抠图URL, 商品2抠图URL, ...]（最多10张）
2. LLM 生成 prompt：看房间照片，用"第N张图"引用每件商品
3. Seedream 5.0 生成：image_url（锁房间结构）+ image_urls（多图参考）+ strength=0.30
4. 降级：多图失败 → 单图模式（strength=0.40）→ 报错

## 对话微调逻辑（/compose/adjust）

- 用户输入反馈 → LLM 基于上一轮 prompt + 反馈生成新 prompt → Seedream 重新生成整张图
- 每次微调都是全图重生，不是局部编辑
- 多图 strength=0.35，单图 strength=0.45

## 推荐算法（recommend.ts）

纯规则评分，不调 AI：
- 风格完全匹配 +30、兼容风格 +10~20
- 品类匹配 +25、空间匹配 +15、关联推荐 +5
- 方案A：Top 7（每品类最多2个）
- 方案B：排除A的SKU，Top 6

## 精修三层降级（refine.ts）

1. Seedream 3.0（strength=0.35, 1024x1024）
2. LLM Vision 评分反馈（打分+建议）
3. 原图直出

## 已知限制

- 图片全程 base64 in-memory，不上传文件系统也不持久化
- 商品图走 iili.io 图床 URL，可能限流或过期
- Fabric.js 已安装但画布拖拽功能未实现
- Agent 的 tool-use 返回指令但前端未接执行逻辑
- 无用户系统、无数据库、无登录
