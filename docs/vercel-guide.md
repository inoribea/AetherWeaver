# Vercel 部署与环境变量配置指南

## 1. Vercel 平台变量
- `VERCEL_FUNCTION_TIMEOUT`: 函数最大执行时间 (默认 30s)。
- `VERCEL_ENV`: 部署环境 (`production`, `preview`, `development`)。
- `VERCEL_APP_URL`: Vercel 部署的应用 URL。
- `NEXT_PUBLIC_APP_URL`: 前端公开的应用 URL。

---

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
  - `STRUCTURED_OUTPUT_TASKS_MODELS`

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