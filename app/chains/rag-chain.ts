import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { getBestEmbeddingProvider } from "../../utils/embeddings";

export function createRAGChain() {
  const prompt = ChatPromptTemplate.fromTemplate(`
你是一个智能AI助手。

当前模式：知识检索模式
- 基于提供的参考文档和知识库回答
- 确保信息的准确性和可靠性
- 明确引用相关文档内容
- 如果文档不足，明确说明信息来源
- 优先使用已验证的知识

参考文档：
{context_documents}

用户请求：{input}
`);

  const embeddingProvider = getBestEmbeddingProvider();

  const model = new ChatOpenAI({
    modelName: process.env.RAG_MODEL_NAME || "gpt-5",
    temperature: -0.1, // 更低温度确保准确性
    maxTokens: 1000,
  });

  // TODO: 根据实际RAG链构造，传入embeddingProvider.instance
  // 这里示例仅返回RunnableSequence，实际可根据需求扩展

  return RunnableSequence.from([prompt, model]);
}