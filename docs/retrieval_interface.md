# 记忆检索接口数据结构设计

## 请求参数接口

```typescript
export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface RetrievalRequest {
  messages: Message[];
  showIntermediateSteps?: boolean;
}
```

- `messages`：对话消息数组，包含用户和助手的消息。
- `showIntermediateSteps`：是否返回中间步骤，默认为false。

## 响应结果接口

```typescript
export interface RetrievalResponse {
  // 当 showIntermediateSteps 为 false 时，返回流式文本内容
  streamContent?: ReadableStream<Uint8Array>;

  // 当 showIntermediateSteps 为 true 时，返回消息数组
  messages?: Message[];
}
```

- `streamContent`：流式返回的文本内容，用于实时展示生成结果。
- `messages`：完整的消息数组，包含中间步骤信息。

---

以上接口设计基于项目中`app/api/chat/retrieval_agents/route.ts`的实现，兼顾了流式响应和完整消息响应两种场景。
## Embedding 模型支持

本项目支持多种 Embedding 模型，包括 Cloudflare Embeddings 和 OpenAI Embeddings。Embedding 模型用于向量化文本，实现向量检索和增强生成（RAG）等功能。

### 配置说明

- 通过环境变量配置 Embedding 模型及其参数：
  - `EMBEDDING_PROVIDER`：指定使用的 Embedding 提供商，支持 `OpenAI` 或 `Cloudflare`。
  - `OPENAI_API_KEY`：OpenAI API 密钥，启用 OpenAI Embeddings。
  - `OPENAI_EMBEDDINGS_MODEL`：OpenAI Embedding 模型名称，默认 `text-embedding-3-small`。
  - `OPENAI_EMBEDDINGS_DIMENSIONS`：OpenAI Embedding 向量维度，默认 1536。
  - `CLOUDFLARE_API_TOKEN`：Cloudflare API Token，启用 Cloudflare Embeddings。
  - `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账户 ID。
  - `CLOUDFLARE_EMBEDDING_MODEL`：Cloudflare Embedding 模型名称，默认 `@cf/baai/bge-base-en-v1.5`。

### 使用场景

- Embedding 模型在检索路由（Retrieval）、RAG 路由和 Agent 路由中均有支持，且均可通过环境变量灵活切换。
- 系统会根据环境变量自动选择可用的 Embedding 模型，优先级可通过 `EMBEDDING_PROVIDER` 强制指定。

详细实现请参考 `utils/embeddings.ts` 和相关路由代码。