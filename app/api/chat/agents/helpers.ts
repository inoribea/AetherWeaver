import { ChatOpenAI } from "@langchain/openai";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAlibabaTongyi } from "@langchain/community/chat_models/alibaba_tongyi";
import { SerpAPI } from "@langchain/community/tools/serpapi";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { Calculator } from "@langchain/community/tools/calculator";
import { Tool } from "@langchain/core/tools";
import { BaseChatModel, BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { AIMessageChunk } from "@langchain/core/messages";
import { getBestEmbeddingProvider } from "../../../../utils/embeddings";

export function createAlibabaTongyiModel(config: {
  temperature?: number;
  model?: string;
  apiKey?: string;
}): ChatAlibabaTongyi {
  return new ChatAlibabaTongyi({
    temperature: config.temperature,
    model: config.model,
    alibabaApiKey: config.apiKey,
  });
}

export function getAvailableAgentModel(): { model: BaseChatModel<BaseChatModelCallOptions, AIMessageChunk>, modelName: string } {
  const tokenCountingCallbacks = [
    {
      handleLLMStart: async (llm: any, prompts: string[]) => {
        console.log(`[${new Date().toISOString()}] 🚀 Agent Model Started`);
        console.log(`[${new Date().toISOString()}] 📝 Prompts: ${prompts.length} prompt(s)`);
      },
      handleLLMEnd: async (output: any) => {
        if (output.llmOutput?.tokenUsage) {
          const usage = output.llmOutput.tokenUsage;
          console.log(`[${new Date().toISOString()}] 📊 Agent Token Usage:`);
          console.log(`  - Prompt Tokens: ${usage.promptTokens || 0}`);
          console.log(`  - Completion Tokens: ${usage.completionTokens || 0}`);
          console.log(`  - Total Tokens: ${usage.totalTokens || 0}`);
        }
      },
      handleLLMError: async (error: any) => {
        console.error(`[${new Date().toISOString()}] ❌ Agent Model Error:`, error);
      },
    },
  ];

  if (process.env.OPENAI_API_KEY || process.env.NEKO_API_KEY) {
    return {
      model: new ChatOpenAI({
        model: "gpt-4o-mini",
        temperature: 0.2,
        apiKey: process.env.NEKO_API_KEY || process.env.OPENAI_API_KEY,
        configuration: { baseURL: process.env.NEKO_BASE_URL || process.env.OPENAI_BASE_URL },
        callbacks: tokenCountingCallbacks,
      }),
      modelName: "gpt-4o-mini",
    };
  } else if (process.env.GOOGLE_API_KEY) {
    return {
      model: new ChatGoogleGenerativeAI({
        model: "gemini-2.5-flash-preview-05-20",
        temperature: 0.2,
        apiKey: process.env.GOOGLE_API_KEY,
        callbacks: tokenCountingCallbacks,
      }),
      modelName: "gemini-flash",
    };
  } else if (process.env.DASHSCOPE_API_KEY) {
    return {
      model: new ChatAlibabaTongyi({
        model: "qwen-turbo-latest",
        temperature: 0.2,
        alibabaApiKey: process.env.DASHSCOPE_API_KEY,
        callbacks: tokenCountingCallbacks,
      }),
      modelName: "qwen-turbo",
    };
  } else {
    throw new Error("No API keys configured for agent models. Please set up OpenAI, Google, or Alibaba Tongyi API keys.");
  }
}

/**
 * Get the best available embedding provider for agents
 */
export function getBestAgentEmbeddingProvider() {
  return getBestEmbeddingProvider();
}

export function getAgentTools(): Tool[] {
  const tools: Tool[] = [new Calculator()];

  if (process.env.SERPAPI_API_KEY) {
    tools.push(new SerpAPI());
  } else if (process.env.TAVILY_API_KEY) {
    tools.push(new TavilySearchResults({ maxResults: 5, apiKey: process.env.TAVILY_API_KEY }));
  }

  return tools;
}