import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { createChatOpenAIConfig } from "@/utils/openaiProvider";
import { ChatPromptTemplate } from "@langchain/core/prompts";

export function createBasicChain() {
  const prompt = ChatPromptTemplate.fromTemplate(`
你是一个智能AI助手。

当前模式：基础对话模式
- 提供简洁、直接、友好的回答
- 使用自然、易懂的语言  
- 避免过于技术性的内容
- 保持对话的轻松氛围

用户请求：{input}
`);

  const compat = createChatOpenAIConfig({ model: process.env.BASIC_MODEL_NAME || "gpt-5-mini", fallbackBaseURL: process.env.OPENAI_BASE_URL });
  const model = new ChatOpenAI({
    modelName: compat.model,
    temperature: 0.0,
    maxTokens: 800,
    apiKey: compat.apiKey,
    ...(compat.configuration ? { configuration: compat.configuration } : {}),
  });

  return RunnableSequence.from([prompt, model]);
}
