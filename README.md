# 软装搭配 AI 场景生图

用户上传房间照片 → AI 分析空间风格 → 智能推荐软装商品 → AI 将商品合成到场景中 → 对话式微调 → 精修输出。

![端到端效果](https://github.com/jaysu66/softdecor-app/blob/main/e2e-test-result.png?raw=true)

---

## 产品交互流程

```
Step 1  上传房间照片（或选测试背景图）
  ↓
Step 2  AI 自动分析房间：房型、风格、光线、色调、已有家具
  ↓     调用 LLM Vision 模型
Step 3  智能推荐商品方案（方案 A 精选搭配 / 方案 B 混搭风格）
  ↓     用户也可自由浏览全部 30 个 SKU 增删商品
Step 4  AI 场景合成 + 对话微调 ⭐
  ↓     Seedream 5.0 多图模式，最多同时放入 9 件商品
  ↓     聊天框输入"沙发换深色"、"加盏落地灯" → AI 修改 prompt → 重新生成
Step 5  AI 精修 → 下载最终效果图
```

**状态流转**（前端 Zustand）：
```
upload → analyzing → analysis → recommending → recommend → canvas → refining → result
```

---

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/jaysu66/softdecor-app.git
cd softdecor-app
```

### 2. 安装依赖

```bash
npm install           # 后端依赖
cd client && npm install && cd ..   # 前端依赖
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

然后编辑 `.env`，填入 **两组必须的 API Key**：

| 变量 | 作用 | 去哪申请 |
|------|------|---------|
| `LLM_API_KEY` | AI 文本/视觉模型（房间分析、prompt 生成、画布 Agent） | 见下方"配置 LLM" |
| `ARK_KEY` | 火山引擎 Seedream 图像生成（场景合成 + 精修） | https://www.volcengine.com/product/ark |

### 4. 启动

```bash
npm run dev
```

浏览器打开 **http://localhost:8080**

> 后端跑在 `localhost:3001`，前端 Vite dev server 自动代理 `/api` 请求。

---

## 配置 LLM（AI 文本/视觉模型）

代码里所有 AI 调用都是标准 **OpenAI `/v1/chat/completions` 格式**，不依赖任何 SDK，直接 `fetch`。
所以可以对接**任意 OpenAI 兼容服务**。

### 需要填的 4 个环境变量

```bash
# .env
LLM_BASE_URL=https://api.openai.com/v1/chat/completions   # API 端点
LLM_API_KEY=sk-...                                          # API Key
LLM_VISION_MODEL=gpt-4o          # 需要支持看图（vision）
LLM_AGENT_MODEL=gpt-4o           # 需要支持 tool calling
```

### 各家配置示例

直接复制到 `.env` 覆盖对应行即可。

**OpenAI**
```
LLM_BASE_URL=https://api.openai.com/v1/chat/completions
LLM_API_KEY=sk-...
LLM_VISION_MODEL=gpt-4o
LLM_AGENT_MODEL=gpt-4o
```

**OpenRouter**（一个 key 调所有模型，推荐）
```
LLM_BASE_URL=https://openrouter.ai/api/v1/chat/completions
LLM_API_KEY=sk-or-v1-...
LLM_VISION_MODEL=anthropic/claude-sonnet-4
LLM_AGENT_MODEL=openai/gpt-4o
```

**Google Gemini**
```
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
LLM_API_KEY=your-google-api-key
LLM_VISION_MODEL=gemini-2.0-flash
LLM_AGENT_MODEL=gemini-2.0-flash
```

**阿里云百炼 DashScope**
```
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
LLM_API_KEY=sk-...
LLM_VISION_MODEL=qwen-vl-max
LLM_AGENT_MODEL=qwen-max
```

**硅基流动 SiliconFlow**
```
LLM_BASE_URL=https://api.siliconflow.cn/v1/chat/completions
LLM_API_KEY=sk-...
LLM_VISION_MODEL=Qwen/Qwen2-VL-72B-Instruct
LLM_AGENT_MODEL=Qwen/Qwen2.5-72B-Instruct
```

**Ollama（本地免费）**
```
LLM_BASE_URL=http://localhost:11434/v1/chat/completions
LLM_API_KEY=ollama
LLM_VISION_MODEL=llava
LLM_AGENT_MODEL=llama3.1
```

> 完整列表见 `.env.example`，Azure OpenAI / Anthropic / DeepSeek / LM Studio 都有示例。

### 对模型的要求

- `LLM_VISION_MODEL` 必须支持**图片输入**（房间分析要看照片）
- `LLM_AGENT_MODEL` 必须支持 **tool calling / function calling**（画布 Agent 要调工具）
- 两个可以指向同一个模型（如 gpt-4o 同时支持两种能力）

---

## 配置 Seedream（AI 图像生成）

Seedream 是字节跳动的图像生成模型，通过火山引擎 ARK API 调用。**这是必须的，没有 ARK_KEY 合成功能无法工作。**

```bash
# .env
ARK_KEY=your-volcano-ark-key-here
ARK_ENDPOINT=https://ark.cn-beijing.volces.com/api/v3/images/generations
ARK_BASE=https://ark.cn-beijing.volces.com/api/v3
```

申请地址：https://www.volcengine.com/product/ark

使用的模型：
- **Seedream 5.0**（`doubao-seedream-5-0-260128`）— 场景合成，支持多图参考
- **Seedream 3.0**（`seedream-3.0`）— 图像精修

---

## API 接口

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/upload` | 上传房间照片 |
| POST | `/api/analyze` | AI 房间分析（LLM Vision） |
| POST | `/api/recommend` | 智能推荐商品方案 |
| POST | `/api/compose` | AI 场景合成（Seedream 多图） |
| POST | `/api/compose/adjust` | 对话式微调（用户文字反馈 → 重新生成）|
| POST | `/api/agent-adjust` | 画布 Agent（LLM tool-use 调整商品位置）|
| POST | `/api/refine` | AI 精修（Seedream 3.0）|
| GET | `/api/products` | 商品列表（30 SKU） |
| GET | `/api/backgrounds` | 测试背景图列表 |
| GET | `/health` | 健康检查 |

---

## 项目结构

```
softdecor-app/
├── server/                         # 后端 (Hono, port 3001)
│   ├── index.ts                    # 入口 + 静态路由
│   ├── lib/llm.ts                  # LLM 统一配置
│   ├── routes/
│   │   ├── analyze.ts              # 房间 AI 分析
│   │   ├── recommend.ts            # 评分推荐算法
│   │   ├── compose.ts              # Seedream 多图合成 + 对话微调
│   │   ├── agent.ts                # 画布 Agent (tool-use)
│   │   ├── refine.ts               # 精修
│   │   └── upload.ts               # 图片上传
│   └── data/
│       ├── products.json           # 30 个 SKU 商品数据
│       └── uploaded_urls.json      # 商品图在线 URL
│
├── client/                         # 前端 (React + Vite, port 8080)
│   └── src/
│       ├── App.tsx                 # 主应用（5步流程路由）
│       ├── stores/useStore.ts      # Zustand 全局状态
│       └── components/
│           ├── UploadPanel.tsx      # Step 1: 上传
│           ├── AnalysisResult.tsx   # Step 2: 分析结果
│           ├── SchemeSelector.tsx   # Step 3: 方案选择
│           ├── CanvasEditor.tsx     # Step 4: 合成 + 对话微调
│           └── RefinePanel.tsx      # Step 5: 精修 + 下载
│
├── assets/                         # 数据资产
│   ├── room-backgrounds/           # 21 张测试背景图
│   └── cutout_urls.json            # 商品抠图在线 URL
│
├── test-compose.ts                 # 合成端到端测试
├── test-compose-hybrid.ts          # 4 种 Seedream 调用方式对比
├── test-compose-strengths.ts       # strength 参数对比
├── test-final-e2e.ts               # 完整 5 件商品 E2E 测试
└── .env.example                    # 环境变量模板（必看）
```

---

## 商品数据

内置 30 个 SKU，覆盖 10 个品类：沙发、茶几、装饰画、地毯、灯具、抱枕、花瓶、边几、壁挂、镜子。

每个 SKU 包含：
```json
{
  "sku": "SF-001",
  "name": "北欧布艺三人沙发",
  "cat": "沙发",
  "style": "北欧",
  "color": "浅灰",
  "material": "科技布",
  "size": "220x90x85",
  "price": 3999,
  "place": "floor",
  "trans": 0,
  "refl": 8,
  "rough": 0.85,
  "space": "客厅",
  "related": "茶几、地毯、抱枕"
}
```

商品图使用在线 URL（`cutout_urls.json`），透明底抠图，合成时直接引用。

---

## Seedream 参数速查

| 场景 | strength | size | 超时 |
|------|----------|------|------|
| 多图合成（主路径） | 0.30 | 1920x1920 | 120s |
| 单图回退 | 0.40 | 1920x1920 | 90s |
| 对话微调（多图） | 0.35 | 1920x1920 | 120s |
| 对话微调（单图） | 0.45 | 1920x1920 | 120s |
| 精修 | 0.35 | 1024x1024 | 30s |

降级策略：多图失败 → 自动降级到单图 → 仍失败返回错误。

---

## 常见问题

**Q: 没有火山引擎账号怎么办？**
A: 必须有。所有图像合成都依赖 Seedream API。去 https://www.volcengine.com/product/ark 注册，开通后获取 API Key。

**Q: 可以用免费的 LLM 吗？**
A: 可以。Gemini 有免费额度，Ollama 完全免费（本地运行）。只要是 OpenAI 兼容格式且支持 vision 就行。

**Q: 推荐的 LLM 配置是什么？**
A: 最省事用 OpenRouter（一个 key 调所有模型）。效果最好用 GPT-4o 或 Claude Sonnet。最便宜用阿里 Qwen VL。

**Q: Node.js 版本要求？**
A: ≥ 20.6（用到 `--env-file` 参数）。如果版本低，安装 `dotenv` 包替代。

**Q: 启动后前端白屏？**
A: 确认 `cd client && npm install` 执行过。前端 Vite 端口 8080，不是 3001。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Zustand + Tailwind CSS + Vite |
| 后端 | Hono + Node.js + TypeScript |
| AI 文本/视觉 | OpenAI 兼容格式（可接任意提供方）|
| AI 图像生成 | Seedream 5.0 / 3.0（火山引擎 ARK）|
| 画布 | Fabric.js（已集成，预留拖拽编辑能力）|

---

## License

Private — 仅供授权人员使用。
