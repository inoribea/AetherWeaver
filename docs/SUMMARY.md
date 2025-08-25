# 项目功能与配置总览

## 核心功能
- **多模型支持**: 集成 OpenAI, Google Gemini, Deepseek, Claude, 腾讯混元等多种 LLM。
- **智能路由**:
  - 支持基于规则 (`rule_based`) 和 LLM 增强 (`llm_enhanced`) 的路由模式。
  - 可根据任务类型（代码、视觉、推理等）将请求路由到专用模型池。
- **RAG (检索增强生成)**:
  - 支持多种 Embedding 模型 (OpenAI, Cloudflare)。
  - 支持多种向量数据库 (Qdrant, Upstash, Pinecone)。
- **OpenAI 兼容 API**: 提供 `/api/v1/chat/completions` 接口，无缝兼容 OpenAI 生态工具。
- **可观测性**: 集成 Langfuse 实现请求日志、追踪和性能监控。
- **Agent 与工具**: 支持 LangChain Agent 及自定义工具（如网络搜索）。

---

## 快速开始
1.  **克隆项目**: `git clone <repository-url>`
2.  **安装依赖**: `yarn install`
3.  **配置环境变量**:
    - 复制 `.env.example` 为 `.env.local`。
    - 至少配置一个模型服务的 API Key (例如 `OPENAI_API_KEY`)。
    - （可选）配置向量数据库 URL 和 Token。
4.  **启动开发服务器**: `yarn dev`
5.  **访问**: `http://localhost:3000`

---

## 关键环境变量
- `ANALYSIS_MODE`: 智能路由模式 (`rule_based` / `llm_enhanced`)。
- `EMBEDDING_PROVIDER`: Embedding 提供商 (`OpenAI` / `Cloudflare`)。
- `QDRANT_URL` / `UPSTASH_VECTOR_REST_URL`: 向量数据库地址。
- `LANGFUSE_SECRET_KEY`: 启用 Langfuse 监控。
- `ENABLE_API_AUTH`: 是否启用 API 密钥验证。

详细配置请参考 `vercel-guide.md`。