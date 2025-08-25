# Vercel 部署与环境变量配置指南

本指南专注于在 Vercel 平台上部署本项目时，环境变量的细节配置和管理。

## 1. 重要环境变量

- `VERCEL_FUNCTION_TIMEOUT`  
  函数最大执行时间，单位秒，默认30秒  
  **示例：** `VERCEL_FUNCTION_TIMEOUT=30`

- `VERCEL_ENV`  
  当前部署环境标识，如：`production` / `preview` / `development`  
  **示例：** `VERCEL_ENV=production`

- `VERCEL_APP_URL`  
  Vercel 部署后应用的 URL，用于前端访问和回调  
  **示例：** `VERCEL_APP_URL="https://your-app-name.vercel.app"`

- `NEXT_PUBLIC_APP_URL`  
  前端公开的应用 URL，通常与 `VERCEL_APP_URL` 相同  
  **示例：** `NEXT_PUBLIC_APP_URL="https://your-app-name.vercel.app"`

- `VERCEL_PROJECT_ID`  
  Vercel 项目ID，用于API调用和项目识别  
  **示例：** `VERCEL_PROJECT_ID=prj_xxxxxxxxxxxxxxxxx`

- `VERCEL_ORG_ID`  
  Vercel 组织ID，用于API调用和组织识别  
  **示例：** `VERCEL_ORG_ID=org_xxxxxxxxxxxxxxxxx`

## 2. API Key管理

建议通过 Vercel Dashboard 的 Environment Variables 页面统一设置所有 API Keys。以下是一些常见的 API Keys：

- `OPENAI_API_KEY`  
- `DEEPSEEK_API_KEY`  
- `GOOGLE_API_KEY`  
- `CLOUDFLARE_API_TOKEN`  
- `SERPAPI_API_KEY`  
- `TAVILY_API_KEY`  
- `BING_SEARCH_API_KEY`  
- `CLAUDE_API_KEY`  
- `OPENROUTER_API_KEY`  
- `LANGCHAIN_API_KEY`  
- `LANGFUSE_API_KEY`  
- `LANGFUSE_PUBLIC_KEY`  
- `LANGFUSE_SECRET_KEY`  
- `QDRANT_API_KEY` (如果 Qdrant 是远程服务)  
- `PINECONE_API_KEY`  
- `SUPABASE_SERVICE_ROLE_KEY`  
- `API_SECRET_KEY` (用于自定义API认证)

## 3. 数据库及存储配置

- `DATABASE_URL`  
  数据库连接字符串，例如 PostgreSQL, MongoDB 等  
  **示例：** `DATABASE_URL="postgresql://user:password@host:port/database"`

- `UPSTASH_VECTOR_REST_URL`  
- `UPSTASH_VECTOR_REST_TOKEN`  
- `REDIS_URL`  
- `REDIS_TOKEN`  
- `QDRANT_URL`  
- `PINECONE_ENVIRONMENT`  
- `SUPABASE_URL`  

## 4. 功能开关与配置

本项目包含多个功能开关，可以通过环境变量控制其启用或禁用：

- `ENABLE_API_AUTH`  
- `ENABLE_UNIFIED_ROUTING`  
- `ENABLE_INTELLIGENT_ROUTING`  
- `ENABLE_MODEL_SWITCHING`  
- `ENABLE_PERFORMANCE_MONITORING`  
- `ENABLE_VISION_PROCESSING`  
- `ENABLE_WEB_SEARCH`  
- `ENABLE_DOCUMENT_RETRIEVAL`  
- `ENABLE_STRUCTURED_OUTPUT`  
- `ENABLE_AGENT_TOOLS`  
- `ENABLE_COMPLEX_REASONING`  
- `ENABLE_CHINESE_OPTIMIZATION`  
- `ENABLE_MULTILINGUAL_SUPPORT`  
- `ENABLE_MODEL_FALLBACK`  
- `ENABLE_AUTOMATIC_RETRIES`  
- `ENABLE_CONTEXT_AWARENESS`  
- `ENABLE_MEMORY`  
- `ENABLE_RESPONSE_CACHE`  
- `ENABLE_CORS`  
- `ENABLE_HEALTH_CHECK`  
- `MOCK_API_RESPONSES`  
- `ENABLE_BUNDLE_ANALYZER`  
- `ENABLE_PERFORMANCE_PROFILING`  

## 6. 智能路由详细配置

除了简单的功能开关，智能路由 (`SmartRouterComponent`) 支持更细粒度的配置：

- `ANALYSIS_MODE`
  控制路由决策的分析模式。
  - **`rule_based`** (默认): 仅使用基于关键字和规则的快速分析。性能高，但可能不够智能。
  - **`llm_enhanced`**: 在规则分析的基础上，会调用一个指定的语言模型（`ROUTING_MODEL_NAME`）来进一步增强决策的准确性。这会带来额外的延迟和成本。
  **示例：** `ANALYSIS_MODE=llm_enhanced`

- `LANGFLOW_ROUTER_MEMORY_SUPPORT`
  控制路由是否考虑对话历史（内存）。
  - 可以是简单的布尔值: `true` 或 `false`。
  - 也可以是JSON字符串以支持更复杂的配置，例如: `{"enabled": true}`。
  **示例：** `LANGFLOW_ROUTER_MEMORY_SUPPORT=true`

## 5. 安全及注意事项

- 严格保密所有密钥，不要硬编码到代码库。  
- 使用 Vercel 的加密存储功能。  
- 确保配置的变量与本地`.env`文件保持同步，避免部署异常。

---

请根据本指南配置环境变量，确保项目部署运行稳定。