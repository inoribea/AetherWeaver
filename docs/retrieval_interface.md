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