# Vercel 部署与环境变量配置指南

## 1. Vercel 平台变量
- `VERCEL_FUNCTION_TIMEOUT`: 函数最大执行时间 (默认 30s)。
- `VERCEL_ENV`: 部署环境 (`production`, `preview`, `development`)。
- `VERCEL_APP_URL`: Vercel 部署的应用 URL。
- `NEXT_PUBLIC_APP_URL`: 前端公开的应用 URL。

---

> 提示：仓库已提供示例环境文件 `.env.example`，建议复制为 `.env` 或 `.env.local` 后按需填写。不要混合填写多个“聊天模型提供商”方案，优先选择一种（官方 OpenAI 或第三方兼容提供商）。

## 2. API Keys
- **模型服务**:
  - `OPENAI_API_KEY`, `OPENAI_BASE_URL`
  - `DEEPSEEK_API_KEY`
  - `GOOGLE_API_KEY`, `GOOGLE_BASE_URL`
  - `CLAUDE_API_KEY`, `CLAUDE_BASE_URL`
  - `TENCENT_HUNYUAN_SECRET_ID`, `TENCENT_HUNYUAN_SECRET_KEY`
  - `DASHSCOPE_API_KEY`
  - `OPENROUTER_BASE_URL`
- **工具服务**:
  - `SERPAPI_API_KEY`
  - `TAVILY_API_KEY`
- **访问控制**:
  - `ENABLE_API_AUTH`: 是否启用 API 密钥验证 (默认 `true`)。
  - `LANGCHAIN_API_KEYS`: 允许访问的 API Key 列表 (逗号分隔)。
  - `LANGCHAIN_ADMIN_KEY`: 管理员 API Key。

示例：

```
# 启用 v1 兼容端点的鉴权（推荐线上开启）
ENABLE_API_AUTH=true
LANGCHAIN_API_KEYS=user_key_1,user_key_2
LANGCHAIN_ADMIN_KEY=admin_key
```

---

## 3. 向量数据库与存储
- **Qdrant**: `QDRANT_URL`
- **Upstash**: `UPSTASH_VECTOR_REST_URL`, `UPSTASH_VECTOR_REST_TOKEN`
- **Pinecone**: `PINECONE_API_KEY`, `PINECONE_ENVIRONMENT`
- **PostgreSQL**: `DATABASE_URL` (用于其他数据存储)

---

## 4. 模型与 Embedding 配置
- `EMBEDDING_PROVIDER`: `OpenAI` 或 `Cloudflare`。
- `OPENAI_EMBEDDINGS_MODEL`, `OPENAI_EMBEDDINGS_DIMENSIONS`
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_EMBEDDING_MODEL`
- **任务模型池** (可选, 覆盖 `models-config.json`):
  - `ENHANCED_TASKS_MODELS`
  - `VISION_TASKS_MODELS`
  - `REASONING_TASKS_MODELS`
  - `CHINESE_TASKS_MODELS`
  - `SEARCH_TASKS_MODELS`
  - `CODE_TASKS_MODELS`
  - `CREATIVE_TASKS_MODELS`
  - `STRUCTURED_OUTPUT_MODELS`

示例（仅对部分路由使用第三方真实模型名）：

```
BASIC_MODELS=Qwen/Qwen3-235B-A22B-search
STRUCTURED_OUTPUT_MODELS=Qwen/Qwen3-235B-A22B-search
```

---

## 5. 智能路由配置
- `ANALYSIS_MODE`: `rule_based` (默认) 或 `llm_enhanced`。
- `ROUTING_MODEL_NAME`: `llm_enhanced` 模式下使用的模型。
- `ROUTING_PROMPT`: `llm_enhanced` 模式下使用的 Prompt。
- `LANGFLOW_ROUTER_MEMORY_SUPPORT`: 是否启用路由记忆 (`true`/`false`)。

---

## 6. 可观测性
- **Langfuse**:
  - `LANGFUSE_API_URL`
  - `LANGFUSE_PUBLIC_KEY`
  - `LANGFUSE_SECRET_KEY`

---

## 7. 文档处理
- `DOCUMENT_CHUNK_SIZE`: 文档分块大小 (默认 1000)。
- `DOCUMENT_CHUNK_OVERLAP`: 分块重叠大小 (默认 200)。

---

## 8. OpenAI 兼容提供商（通用）
- 项目支持任意前缀的 OpenAI 格式提供商环境变量对：`<PREFIX>_API_KEY` + `<PREFIX>_BASE_URL`。
- 选择默认提供商的方式：
  - 设置 `OPENAI_COMPAT_PROVIDER=<prefix>`（如 `OPENAI` / `NEKO` / `O3` / `OPENROUTER`）。
  - 未设置时，按顺序尝试：`OPENAI` → `NEKO` → `O3` → `OPENROUTER` → 动态扫描所有 `*_API_KEY`/`*_BASE_URL` 成对变量。
- 注意：
  - 官方 OpenAI 允许不设置 `OPENAI_BASE_URL`（使用默认官方域名）。
  - 第三方提供商必须保证 `PREFIX_API_KEY` 与 `PREFIX_BASE_URL` 同源，否则会返回 401。
  - 也可通过“路由模型池覆盖”仅对特定路由切换第三方真实模型名（如 `Qwen/Qwen3-235B-A22B-search`）。

快速示例：

官方 OpenAI（全局）
```
OPENAI_API_KEY=sk-xxxxxxxx
# OPENAI_BASE_URL 可省略（https://api.openai.com/v1）

# 可选：链的默认模型名，避免回退到占位名
BASIC_MODEL_NAME=gpt-4o-mini
RAG_MODEL_NAME=gpt-4o
VISION_MODEL_NAME=gpt-4o-mini
```

O3 提供商（api.o3.fan）
```
OPENAI_COMPAT_PROVIDER=O3
O3_API_KEY=your_o3_key
O3_BASE_URL=https://api.o3.fan/v1

# 可选：仅对部分路由切换到 O3 的真实模型
BASIC_MODELS=Qwen/Qwen3-235B-A22B-search
STRUCTURED_OUTPUT_MODELS=Qwen/Qwen3-235B-A22B-search
```

NEKO 提供商
```
OPENAI_COMPAT_PROVIDER=NEKO
NEKO_API_KEY=your_neko_key
NEKO_BASE_URL=https://your-neko.example.com/v1
```

调用 /api/v1/chat/completions（需鉴权）示例：
```
curl -X POST https://your-domain/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer user_key_1" \
  -d '{
    "model": "gpt-5-mini",
    "messages": [{"role": "user", "content": "你好！"}],
    "stream": false
  }'
```

常见问题（401 无效令牌）
- 若日志显示上游 401（非我们自定义鉴权），请检查：
  - `OPENAI_BASE_URL` 是否指向第三方而仍用官方 `OPENAI_API_KEY`
  - 或 `PREFIX_API_KEY` 与 `PREFIX_BASE_URL` 是否来自不同提供商
