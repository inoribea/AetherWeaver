# 检索与 Embedding 配置文档

## 概述
本文档介绍项目中与检索增强生成（RAG）相关的接口和 Embedding 模型配置。

---

## 检索接口
项目提供了多种包含 RAG 功能的聊天接口，例如 `/api/chat/retrieval` 和 `/api/chat/retrieval_agents`。这些接口通常接收标准的消息数组，并返回包含检索上下文的生成结果。

```typescript
// 示例请求体
export interface RetrievalRequest {
  messages: {
    role: "user" | "assistant" | "system";
    content: string;
  }[];
  showIntermediateSteps?: boolean;
}
```

---

## Embedding 模型配置
本项目支持多种 Embedding 模型，用于文本向量化。

- **通用 OpenAI 兼容提供商（推荐）**
  - 若已按 `.env.example` 配置了默认 OpenAI 兼容提供商（例如 `OPENAI_COMPAT_PROVIDER=O3` 与其配套 `O3_API_KEY/O3_BASE_URL`），向量存储会自动优先使用该提供商的 OpenAI Embeddings。
  - 可选调优：
    - `OPENAI_EMBEDDINGS_MODEL`: 模型名称（如 `text-embedding-3-small`）
    - `OPENAI_EMBEDDINGS_DIMENSIONS`: 向量维度（默认 1536）

- **仅 OpenAI 官方**
  - `OPENAI_API_KEY`: API 密钥（可不设 `OPENAI_BASE_URL`）
  - `OPENAI_EMBEDDINGS_MODEL`: 模型名称
  - `OPENAI_EMBEDDINGS_DIMENSIONS`: 向量维度

- **Cloudflare Workers AI**
  - `CLOUDFLARE_API_TOKEN`: API Token
  - `CLOUDFLARE_ACCOUNT_ID`: 账户 ID
  - `CLOUDFLARE_EMBEDDING_MODEL`: 模型名称（默认 `@cf/baai/bge-base-en-v1.5`）
  - 设置 `EMBEDDING_PROVIDER=Cloudflare` 可强制优先使用 Cloudflare

---

## 向量数据库配置
系统支持多种向量数据库，用于存储和检索文档向量。

- **Qdrant**:
  - `QDRANT_URL`: Qdrant 实例的 URL (e.g., `http://localhost:6333`)。
- **Upstash**:
  - `UPSTASH_VECTOR_REST_URL`: Upstash REST URL。
  - `UPSTASH_VECTOR_REST_TOKEN`: Upstash REST Token。
- **Pinecone**:
  - `PINECONE_API_KEY`: Pinecone API 密钥。
  - `PINECONE_ENVIRONMENT`: Pinecone 环境名称。

系统会根据环境变量自动配置并连接到相应的向量数据库。
