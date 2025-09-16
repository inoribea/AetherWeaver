import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { createChatOpenAIConfig } from "@/utils/openaiProvider";
import { ChatPromptTemplate } from "@langchain/core/prompts";

export function createVisionChain() {
  const prompt = ChatPromptTemplate.fromTemplate(`
你是一个专业的AI绘画助手。

当前模式：视觉生成模式
- 根据用户的文字描述生成高质量的图片。
- 理解并执行复杂的场景、物体和风格要求。
- 输出的应该是一张图片，而不是文字描述。

用户请求：{input}
`);

  const compat = createChatOpenAIConfig({ model: process.env.VISION_MODEL_NAME || "gpt-5-all", fallbackBaseURL: process.env.OPENAI_BASE_URL });
  const model = new ChatOpenAI({
    modelName: compat.model,
    temperature: 0.8,
    maxTokens: 1024,
    apiKey: compat.apiKey,
    ...(compat.configuration ? { configuration: compat.configuration } : {}),
  });

  return RunnableSequence.from([prompt, model]);
}
