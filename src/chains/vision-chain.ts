import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { createChatOpenAIConfig } from "@/utils/openaiProvider";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export function createVisionChain(llm?: BaseChatModel) {
  const prompt = ChatPromptTemplate.fromTemplate(`
你是一个专业的AI绘画助手。

当前模式：视觉生成模式
- 根据用户的文字描述生成高质量的图片。
- 理解并执行复杂的场景、物体和风格要求。
- 输出的应该是一张图片，而不是文字描述。

用户请求：{input}
`);

  const model = llm ?? new ChatOpenAI({
    modelName: process.env.VISION_MODEL_NAME || "gpt-5-all",
    temperature: 0.8,
    maxTokens: 1024,
    apiKey: createChatOpenAIConfig().apiKey,
    ...(createChatOpenAIConfig().configuration ? { configuration: createChatOpenAIConfig().configuration } : {}),
  });

  return RunnableSequence.from([prompt, model]);
}
