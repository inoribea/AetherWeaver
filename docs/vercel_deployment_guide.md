# Vercel 部署与环境变量配置指南

本文档详细介绍如何在 Vercel 平台部署本项目，配置环境变量，以及如何通过环境变量灵活调整决策路由模型映射和复杂模型决策的四路径模型选项。

---

## 一、项目部署指南

### 1. 部署准备

- 将项目代码推送到 GitHub 或其他代码仓库。
- 在 Vercel 创建新项目，连接代码仓库。

### 2. 依赖安装

项目已包含所需依赖，Vercel 会自动安装。确保 `package.json` 中包含以下依赖：

```json
"dependencies": {
  "@langchain/pinecone": "...",
  "@pinecone-database/pinecone": "...",
  "@langchain/community": "...",
  "@neondatabase/serverless": "...",
  "@upstash/vector": "...",
  "@langchain/openai": "..."
}
```

### 3. 部署步骤

1. 在 Vercel 项目设置中配置环境变量（详见下文环境变量配置）。
2. 部署项目，Vercel 会自动构建并启动。
3. 访问部署的应用，确认数据库连接正常。

### 4. 注意事项

- 确保环境变量配置正确，避免连接失败。
- 根据实际需求选择使用的数据库类型，修改项目配置或调用参数。
- 监控 Vercel 部署日志，及时排查问题。

---

## 二、环境变量配置

请在 Vercel 项目的环境变量设置中添加以下变量，确保项目功能正常运行。

### 1. 向量数据库配置

- **Pinecone 向量数据库**

  - `PINECONE_API_KEY`（必填）：Pinecone API 密钥
  - `PINECONE_INDEX`（必填）：Pinecone 索引名称
  - `PINECONE_ENVIRONMENT`（选填）：Pinecone 环境

- **Neon Postgres 数据库**

  - `DATABASE_URL`（必填）：Neon Postgres 连接字符串，格式示例：

    ```
    postgresql://user:password@host:port/database?schema=public
    ```

- **Upstash 向量数据库**

  - `UPSTASH_VECTOR_REST_URL`（必填）：Upstash 向量数据库 REST URL
  - `UPSTASH_VECTOR_REST_TOKEN`（必填）：Upstash 向量数据库访问令牌

### 2. 主模型 API 密钥

- `OPENAI_API_KEY`（必填）：用于 OpenAI API 密钥

### 3. 应用基础配置

- `VERCEL_APP_URL`：应用基础 URL
- `APP_TITLE`：应用标题

### 4. 多模型 API 密钥配置

支持多种模型的 API 密钥配置，详见 `.env.example` 文件，包括 Google Gemini、DeepSeek、阿里云通义千问、Neko、Claude、OpenRouter、腾讯混元、Cloudflare Workers AI 等。

### 5. 统一智能路由系统配置

- 路由功能开关、路由决策配置、复杂度阈值模型优先级配置等。

### 6. 高级功能配置

- 网络搜索、内存和持久化、监控和日志、性能和限制、安全配置、功能开关、语言优化、开发和测试配置等。

---

## 三、通过环境变量配置决策路由

### 1. 环境变量 `LANGFLOW_CONDITIONAL_ROUTER_CONFIG`

该环境变量为 JSON 格式字符串，用于覆盖默认的决策路由配置，主要包括：

- **matching_strategies**：定义多种路由匹配策略及其参数。
- **route_similarities**：路由名称与相似词的映射，用于模糊匹配。
- **confidence_adjustments**：置信度调整参数。
- **memory_support**：记忆相关支持配置。
- **langchainjs_compatibility**：LangChain.js 兼容性配置。
- **lcel_configuration**：LCEL 相关可运行接口配置。

#### 示例配置（需转义为单行字符串）：

```json
{
  "matching_strategies": {
    "exact_match": { "strict": true, "fallback": false },
    "metadata_priority": { "prefer_metadata": true, "text_fallback": true },
    "confidence_aware": { "threshold_required": true, "dynamic_threshold": false },
    "smart_flexible": { "multi_level": true, "adaptive": true },
    "langchainjs_compatible": { "runnable_interface": true, "flatten_output": true }
  },
  "route_similarities": {
    "basic": ["simple", "easy", "quick", "fast"],
    "enhanced": ["complex", "advanced", "detailed", "deep", "sophisticated"],
    "rag": ["search", "retrieve", "document", "knowledge", "lookup"],
    "agent": ["tool", "execute", "action", "api", "compute"]
  },
  "confidence_adjustments": {
    "reassignment_penalty": 0.2,
    "fallback_boost": 0.1,
    "memory_boost": 0.15
  },
  "memory_support": {
    "langflow_chat_memory": true,
    "custom_memory": true,
    "boost_factor": 0.1
  },
  "langchainjs_compatibility": {
    "export_format": true,
    "flatten_metadata": true,
    "runnable_interface": true,
    "async_support": true,
    "streaming_support": true
  },
  "lcel_configuration": {
    "enable_runnable": true,
    "enable_passthrough": true,
    "enable_lambda": true,
    "enable_parallel": true
  }
}
```

### 2. 拆分环境变量配置

为简化管理，支持将配置拆分为多个独立环境变量：

| 环境变量名称                              | 配置字段                  | 说明                             |
|-----------------------------------------|---------------------------|----------------------------------|
| `LANGFLOW_ROUTER_MATCHING_STRATEGIES`   | matchingStrategies        | 路由匹配策略及参数               |
| `LANGFLOW_ROUTER_ROUTE_SIMILARITIES`    | routeSimilarities         | 路由名称与相似词映射             |
| `LANGFLOW_ROUTER_CONFIDENCE_ADJUSTMENTS`| confidenceAdjustments     | 置信度调整参数                   |
| `LANGFLOW_ROUTER_MEMORY_SUPPORT`        | memorySupport             | 记忆相关支持配置                 |
| `LANGFLOW_ROUTER_LANGCHAINJS_COMPATIBILITY` | langchainjsCompatibility | LangChain.js 兼容性配置          |
| `LANGFLOW_ROUTER_LCEL_CONFIGURATION`    | lcelConfiguration        | LCEL 相关可运行接口配置          |

#### 示例拆分配置：

```bash
export LANGFLOW_ROUTER_MEMORY_SUPPORT='{
  "langflowChatMemory": true,
  "customMemory": true,
  "boostFactor": 0.2
}'

export LANGFLOW_ROUTER_MATCHING_STRATEGIES='{
  "exact_match": { "strict": true, "fallback": false },
  "smart_flexible": { "multiLevel": true, "adaptive": true }
}'
```

### 3. 配置加载顺序与建议

- 系统优先加载拆分的多个环境变量，逐个合并覆盖默认配置。
- 兼容旧的单一大环境变量 `LANGFLOW_CONDITIONAL_ROUTER_CONFIG`，优先级最低。
- 推荐拆分配置，便于单独调整和版本管理。
- 保持 JSON 格式合法，避免加载失败。
- 根据业务需求灵活启用或禁用各部分配置。

---

## 四、总结

通过以上步骤，您可以在 Vercel 平台顺利部署本项目，并通过环境变量灵活配置数据库连接及智能路由决策，满足不同业务场景需求。

如需详细环境变量说明，请参考项目根目录下的 `.env.example` 文件。

---